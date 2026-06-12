import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import { enrichComparisonWithRetail } from '../retail/enrich-comparison'
import { compareAttachmentPrices } from '../moysklad/compare'

export type PriceHighlight = {
  sku: string | null
  name: string | null
  parsedPrice: number | null
  ourPrice: number | null
  retailMedian: number | null
  maxWholesale: number | null
  isLowMargin: boolean
}

export type NegotiationContext = {
  supplierId: string
  supplierName: string
  managerName: string | null
  inboundSubject: string
  inboundExcerpt: string | null
  threadHistory: Array<{ direction: string; from: string; sentAt: string; excerpt: string }>
  priceHighlights: PriceHighlight[]
  currentStrategy: string | null
}

type ThreadMessageForContext = {
  direction: string
  fromEmail: string
  fromName: string | null
  sentAt: Date
  bodyText: string | null
  subject: string
}

export async function buildNegotiationContext(
  db: DbClient,
  env: AppEnv,
  input: {
    supplierId: string
    threadId: string
    triggerMessageId: string
    mailboxUserId: string
  },
): Promise<NegotiationContext> {
  const [supplier, triggerMessage, threadMessages, negotiation] = await Promise.all([
    db.supplier.findUnique({ where: { id: input.supplierId } }),
    db.emailMessage.findUnique({ where: { id: input.triggerMessageId } }),
    db.emailMessage.findMany({
      where: { threadId: input.threadId },
      orderBy: { sentAt: 'desc' },
      take: 12,
      select: {
        direction: true,
        fromEmail: true,
        fromName: true,
        sentAt: true,
        bodyText: true,
        subject: true,
      },
    }),
    db.negotiation.findFirst({
      where: { supplierId: input.supplierId, status: 'active' },
      include: { strategy: true },
    }),
  ])

  if (!supplier || !triggerMessage) {
    throw new Error('Supplier or trigger message not found')
  }

  const manager = supplier.assignedManagerId
    ? await db.user.findUnique({
        where: { id: supplier.assignedManagerId },
        select: { displayName: true },
      })
    : null

  const latestAttachment = await db.emailAttachment.findFirst({
    where: {
      message: { threadId: input.threadId },
      parseStatus: 'parsed',
      rowCount: { gt: 0 },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  let priceHighlights: PriceHighlight[] = []
  if (latestAttachment) {
    const rows = await compareAttachmentPrices(db, latestAttachment.id, input.supplierId)
    const enriched = await enrichComparisonWithRetail(db, env, rows)
    priceHighlights = enriched.slice(0, 20).map((row) => ({
      sku: row.sku,
      name: row.name,
      parsedPrice: row.parsedPrice,
      ourPrice: row.ourLastPurchasePrice,
      retailMedian: row.retail?.medianPrice ?? null,
      maxWholesale: row.retail?.maxWholesaleAtTargetMargin ?? null,
      isLowMargin: row.retail?.isLowMargin ?? false,
    }))
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    managerName: manager?.displayName ?? null,
    inboundSubject: triggerMessage.subject,
    inboundExcerpt: excerpt(triggerMessage.bodyText),
    threadHistory: recentThreadMessagesToPromptHistory(threadMessages),
    priceHighlights,
    currentStrategy: summarizeNegotiationStrategy(negotiation?.strategy ?? null),
  }
}

export function recentThreadMessagesToPromptHistory(messages: ThreadMessageForContext[]) {
  return messages
    .map((message) => ({
      direction: message.direction,
      from: message.fromName ?? message.fromEmail,
      sentAt: message.sentAt.toISOString(),
      excerpt: excerpt(message.bodyText) ?? message.subject,
    }))
    .reverse()
}

export function summarizeNegotiationStrategy(
  strategy: {
    supplierAnalysis: string | null
    strategyPlan: unknown
    nextStep: string | null
  } | null | undefined,
) {
  if (!strategy) return null

  const parts = [
    strategy.supplierAnalysis?.trim() ? `Анализ: ${strategy.supplierAnalysis.trim()}` : null,
    formatStrategyPlan(strategy.strategyPlan),
    strategy.nextStep?.trim() ? `Следующий шаг: ${strategy.nextStep.trim()}` : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join('\n') : null
}

function formatStrategyPlan(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null

  const steps = value
    .map((step, index) => {
      if (!step || typeof step !== 'object') return null
      const record = step as Record<string, unknown>
      const title = typeof record.title === 'string' ? record.title.trim() : ''
      const description = typeof record.description === 'string' ? record.description.trim() : ''
      if (!title && !description) return null
      return `${index + 1}. ${title || 'Шаг'}${description ? `: ${description}` : ''}`
    })
    .filter((step): step is string => step !== null)

  return steps.length > 0 ? `План:\n${steps.join('\n')}` : null
}

function excerpt(text: string | null | undefined, max = 240) {
  if (!text?.trim()) return null
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

export function contextToPrompt(context: NegotiationContext) {
  const history = context.threadHistory
    .map((entry) => `[${entry.direction}] ${entry.from} (${entry.sentAt}): ${entry.excerpt}`)
    .join('\n')

  const prices = context.priceHighlights
    .map(
      (row) =>
        `${row.name ?? row.sku ?? 'SKU'} | прайс=${row.parsedPrice ?? '—'} | закупка=${row.ourPrice ?? '—'} | розница=${row.retailMedian ?? '—'} | макс.опт=${row.maxWholesale ?? '—'} | низкая_маржа=${row.isLowMargin}`,
    )
    .join('\n')

  return `Поставщик: ${context.supplierName}
Тема входящего письма: ${context.inboundSubject}
Фрагмент входящего письма: ${context.inboundExcerpt ?? '—'}
Текущая стратегия: ${context.currentStrategy ?? 'нет'}

История переписки:
${history || '—'}

Данные по ценам:
${prices || 'нет распарсенного прайса'}

Верни ТОЛЬКО JSON без markdown:
{
  "analysis": "анализ ответа поставщика: что уступил, риски, где давить",
  "strategy": [{"title":"шаг","description":"описание","status":"pending|in_progress|done"}],
  "nextStep": "рекомендация следующего шага",
  "draftSubject": "тема письма",
  "draftBody": "текст черновика ответа поставщику на русском"
}`
}
