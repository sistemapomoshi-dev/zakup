import type { MoySkladConfig } from './config'
import type { MoySkladListResponse, MoySkladTokenResponse } from './types'

const minRequestIntervalMs = 75

type TokenCache = {
  accessToken: string
  expiresAtMs: number
}

export class MoySkladClient {
  private tokenCache: TokenCache | null = null
  private lastRequestAtMs = 0

  constructor(private readonly config: MoySkladConfig) {}

  async get<T>(path: string, query?: Record<string, string | number | undefined>) {
    return this.request<T>('GET', path, undefined, query)
  }

  async fetchAllRows<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
    pageSize = 1000,
  ) {
    const rows: T[] = []
    let offset = 0

    while (true) {
      const page = await this.get<MoySkladListResponse<T>>(path, {
        ...query,
        limit: pageSize,
        offset,
      })
      rows.push(...page.rows)
      if (page.rows.length < pageSize) {
        break
      }
      offset += pageSize
    }

    return rows
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    await this.waitForRateLimit()
    const token = await this.getAccessToken()
    const url = new URL(`${this.config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`)

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json;charset=utf-8',
        ...(body ? { 'Content-Type': 'application/json;charset=utf-8' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 429) {
      await sleep(1000)
      return this.request<T>(method, path, body, query)
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`MoySklad API ${response.status}: ${text.slice(0, 300)}`)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  private async getAccessToken() {
    const now = Date.now()
    if (this.tokenCache && this.tokenCache.expiresAtMs > now + 30_000) {
      return this.tokenCache.accessToken
    }

    const credentials = Buffer.from(`${this.config.login}:${this.config.password}`).toString('base64')
    await this.waitForRateLimit()
    const response = await fetch(`${this.config.apiUrl}/security/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json;charset=utf-8',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`MoySklad auth failed (${response.status}): ${text.slice(0, 300)}`)
    }

    const payload = (await response.json()) as MoySkladTokenResponse
    this.tokenCache = {
      accessToken: payload.access_token,
      expiresAtMs: now + payload.expires_in * 1000,
    }
    return payload.access_token
  }

  private async waitForRateLimit() {
    const now = Date.now()
    const elapsed = now - this.lastRequestAtMs
    if (elapsed < minRequestIntervalMs) {
      await sleep(minRequestIntervalMs - elapsed)
    }
    this.lastRequestAtMs = Date.now()
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
