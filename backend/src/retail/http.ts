const DEFAULT_HEADERS = {

  'User-Agent':

    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',

  Accept: 'application/json,text/html,application/xhtml+xml',

  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',

}



export async function fetchText(url: string, timeoutMs: number) {

  const response = await fetch(url, {

    headers: DEFAULT_HEADERS,

    signal: AbortSignal.timeout(timeoutMs),

  })



  if (!response.ok) {

    throw new Error(`HTTP ${response.status} for ${url}`)

  }



  return response.text()

}



export async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {

  const text = await fetchText(url, timeoutMs)

  return JSON.parse(text) as T

}



export function extractJsonLdPrices(html: string): number[] {

  const prices: number[] = []

  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi



  for (const match of html.matchAll(scriptPattern)) {

    const raw = match[1]?.trim()

    if (!raw) continue



    try {

      collectJsonLdPrices(JSON.parse(raw), prices)

    } catch {

      // ignore malformed JSON-LD blocks

    }

  }



  const metaPrice = html.match(/property=["']product:price:amount["'][^>]*content=["']([\d.,]+)["']/i)

  if (metaPrice?.[1]) {

    const value = parseLocalizedNumber(metaPrice[1])

    if (value != null) prices.push(value)

  }



  return prices

}



function collectJsonLdPrices(node: unknown, prices: number[]) {

  if (Array.isArray(node)) {

    for (const item of node) collectJsonLdPrices(item, prices)

    return

  }



  if (!node || typeof node !== 'object') return



  const record = node as Record<string, unknown>

  if (record['@type'] === 'Product' || record['@type'] === 'Offer') {

    const offer = record.offers

    if (offer && typeof offer === 'object') {

      collectJsonLdPrices(offer, prices)

    }

    const price = parseLocalizedNumber(record.price)

    if (price != null) prices.push(price)

    const lowPrice = parseLocalizedNumber(record.lowPrice)

    if (lowPrice != null) prices.push(lowPrice)

  }



  if (record.price != null) {

    const price = parseLocalizedNumber(record.price)

    if (price != null) prices.push(price)

  }



  for (const value of Object.values(record)) {

    if (value && typeof value === 'object') {

      collectJsonLdPrices(value, prices)

    }

  }

}



export function parseLocalizedNumber(value: unknown): number | null {

  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value !== 'string') return null



  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '')

  if (!normalized) return null



  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null

}



export function pickLowestPositive(values: number[]) {

  const positive = values.filter((value) => value > 0)

  if (positive.length === 0) return null

  return Math.min(...positive)

}


