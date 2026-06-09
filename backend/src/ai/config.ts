import type { AppEnv } from '../env'

export type AiConfig = {
  apiKey: string
  folderId: string
  model: string
  autoAnalyze: boolean
  completionUrl: string
}

export function aiConfigFromEnv(env: AppEnv): AiConfig | null {
  if (!env.YANDEX_GPT_API_KEY || !env.YANDEX_GPT_FOLDER_ID) return null

  return {
    apiKey: env.YANDEX_GPT_API_KEY,
    folderId: env.YANDEX_GPT_FOLDER_ID,
    model: env.YANDEX_GPT_MODEL,
    autoAnalyze: env.AI_AUTO_ANALYZE,
    completionUrl: env.YANDEX_GPT_COMPLETION_URL,
  }
}

export function isAiConfigured(env: AppEnv) {
  return aiConfigFromEnv(env) !== null
}
