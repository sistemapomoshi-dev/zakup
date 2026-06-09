import type { StrategyStepDto } from '@web-app-demo/contracts'

export type AiNegotiationOutput = {
  analysis: string
  strategy: StrategyStepDto[]
  nextStep: string
  draftSubject: string
  draftBody: string
}

export function parseAiNegotiationOutput(raw: string): AiNegotiationOutput {
  const jsonText = extractJsonObject(raw)
  const parsed = JSON.parse(jsonText) as Record<string, unknown>

  const strategy = Array.isArray(parsed.strategy)
    ? parsed.strategy
        .map((step) => normalizeStrategyStep(step))
        .filter((step): step is StrategyStepDto => step !== null)
    : []

  return {
    analysis: stringField(parsed.analysis) ?? stringField(parsed.supplierAnalysis) ?? '',
    strategy,
    nextStep: stringField(parsed.nextStep) ?? '',
    draftSubject: stringField(parsed.draftSubject) ?? 'Ответ поставщику',
    draftBody: stringField(parsed.draftBody) ?? raw.trim(),
  }
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1)
  }

  throw new Error('AI response does not contain JSON')
}

function normalizeStrategyStep(value: unknown): StrategyStepDto | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const title = stringField(record.title)
  const description = stringField(record.description)
  if (!title || !description) return null

  const status = record.status
  const normalizedStatus =
    status === 'done' || status === 'in_progress' || status === 'pending' ? status : 'pending'

  return { title, description, status: normalizedStatus }
}

function stringField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
