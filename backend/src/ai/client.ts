import type { AiConfig } from './config'

export type AiMessage = {
  role: 'system' | 'user' | 'assistant'
  text: string
}

type YandexCompletionResponse = {
  result?: {
    alternatives?: Array<{
      message?: { text?: string }
    }>
  }
}

export async function completeChat(config: AiConfig, messages: AiMessage[]) {
  const response = await fetch(config.completionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${config.apiKey}`,
      'x-folder-id': config.folderId,
    },
    body: JSON.stringify({
      modelUri: `gpt://${config.folderId}/${config.model}`,
      completionOptions: {
        stream: false,
        temperature: 0.4,
        maxTokens: 4000,
      },
      messages: messages.map((message) => ({
        role: message.role,
        text: message.text,
      })),
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`YandexGPT HTTP ${response.status}: ${body.slice(0, 300)}`)
  }

  const payload = (await response.json()) as YandexCompletionResponse
  const text = payload.result?.alternatives?.[0]?.message?.text?.trim()
  if (!text) {
    throw new Error('YandexGPT returned an empty response')
  }

  return text
}
