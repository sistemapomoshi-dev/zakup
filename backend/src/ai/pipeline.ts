import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import { aiConfigFromEnv } from './config'
import { completeChat } from './client'
import { buildNegotiationContext, contextToPrompt } from './context'
import { mockAiNegotiationOutput } from './mock'
import { parseAiNegotiationOutput } from './parse-response'

const SYSTEM_PROMPT = `Ты AI-ассистент закупщика в B2B-переговорах о снижении оптовых цен.
Пиши по-русски, деловым тоном, с конкретными цифрами из контекста.
Не выдумывай цены — используй только переданные данные.
Ответ должен быть строго валидным JSON по запрошенной схеме.`

export async function processInboundMessage(
  db: DbClient,
  env: AppEnv,
  input: {
    supplierId: string
    threadId: string
    triggerMessageId: string
    mailboxUserId: string
  },
) {
  if (!env.AI_AUTO_ANALYZE) return null

  const existing = await db.emailDraft.findUnique({
    where: { triggerMessageId: input.triggerMessageId },
    select: { id: true },
  })
  if (existing) return existing.id

  const context = await buildNegotiationContext(db, env, input)
  const output = await generateNegotiationOutput(env, context)

  const supplier = await db.supplier.findUnique({
    where: { id: input.supplierId },
    select: { assignedManagerId: true, name: true },
  })

  const existingNegotiation = await db.negotiation.findFirst({
    where: { supplierId: input.supplierId, status: 'active' },
  })

  const negotiation = existingNegotiation
    ? await db.negotiation.update({
        where: { id: existingNegotiation.id },
        data: { managerId: supplier?.assignedManagerId ?? undefined },
      })
    : await db.negotiation.create({
        data: {
          supplierId: input.supplierId,
          managerId: supplier?.assignedManagerId ?? null,
          title: `Переговоры: ${supplier?.name ?? 'поставщик'}`,
        },
      })

  await db.negotiationStrategy.upsert({
    where: { negotiationId: negotiation.id },
    create: {
      negotiationId: negotiation.id,
      supplierAnalysis: output.analysis,
      strategyPlan: output.strategy,
      nextStep: output.nextStep,
      lastMessageId: input.triggerMessageId,
    },
    update: {
      supplierAnalysis: output.analysis,
      strategyPlan: output.strategy,
      nextStep: output.nextStep,
      lastMessageId: input.triggerMessageId,
    },
  })

  const draft = await db.emailDraft.create({
    data: {
      supplierId: input.supplierId,
      negotiationId: negotiation.id,
      threadId: input.threadId,
      triggerMessageId: input.triggerMessageId,
      mailboxUserId: input.mailboxUserId,
      status: 'draft',
      subject: output.draftSubject,
      versions: {
        create: {
          version: 1,
          bodyText: output.draftBody,
          source: 'ai',
        },
      },
    },
    select: { id: true },
  })

  return draft.id
}

async function generateNegotiationOutput(env: AppEnv, context: Parameters<typeof mockAiNegotiationOutput>[0]) {
  const config = aiConfigFromEnv(env)
  if (!config) {
    return mockAiNegotiationOutput(context)
  }

  const raw = await completeChat(config, [
    { role: 'system', text: SYSTEM_PROMPT },
    { role: 'user', text: contextToPrompt(context) },
  ])

  try {
    return parseAiNegotiationOutput(raw)
  } catch {
    return mockAiNegotiationOutput(context)
  }
}

export async function regenerateDraftFromAi(
  db: DbClient,
  env: AppEnv,
  draftId: string,
) {
  const draft = await db.emailDraft.findUnique({
    where: { id: draftId },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      triggerMessage: { select: { id: true } },
    },
  })
  if (!draft?.threadId || !draft.triggerMessageId) {
    throw new Error('Draft is missing thread context for regeneration')
  }

  const context = await buildNegotiationContext(db, env, {
    supplierId: draft.supplierId,
    threadId: draft.threadId,
    triggerMessageId: draft.triggerMessageId,
    mailboxUserId: draft.mailboxUserId,
  })
  const output = await generateNegotiationOutput(env, context)
  const nextVersion = (draft.versions[0]?.version ?? 0) + 1

  await db.$transaction([
    db.emailDraft.update({
      where: { id: draftId },
      data: {
        subject: output.draftSubject,
        status: 'draft',
        rejectedReason: null,
        approvedById: null,
        approvedAt: null,
      },
    }),
    db.draftVersion.create({
      data: {
        draftId,
        version: nextVersion,
        bodyText: output.draftBody,
        source: 'ai',
      },
    }),
    ...(draft.negotiationId
      ? [
          db.negotiationStrategy.upsert({
            where: { negotiationId: draft.negotiationId },
            create: {
              negotiationId: draft.negotiationId,
              supplierAnalysis: output.analysis,
              strategyPlan: output.strategy,
              nextStep: output.nextStep,
              lastMessageId: draft.triggerMessageId,
            },
            update: {
              supplierAnalysis: output.analysis,
              strategyPlan: output.strategy,
              nextStep: output.nextStep,
              lastMessageId: draft.triggerMessageId,
            },
          }),
        ]
      : []),
  ])

  return output
}
