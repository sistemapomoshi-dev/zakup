export type ColumnMapping = {
  sku?: number
  name?: number
  price?: number
  unit?: number
  quantity?: number
}

const skuHeaders = ['артикул', 'art', 'sku', 'код', 'code', 'article', 'vendor code', 'vendorcode']
const nameHeaders = [
  'наименование',
  'название',
  'name',
  'товар',
  'product',
  'описание',
  'номенклатура',
  'наим',
]
const priceHeaders = ['цена', 'price', 'стоимость', 'опт', 'wholesale', 'розница', 'сумма']
const unitHeaders = ['ед', 'ед.', 'единица', 'unit', 'изм', 'uom']
const quantityHeaders = ['moq', 'мин', 'min', 'кол-во', 'количество', 'qty', 'quantity', 'мин. партия']

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function detectColumnMapping(headerRow: unknown[]): ColumnMapping {
  const mapping: ColumnMapping = {}

  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(cell)
    if (!header) return

    if (mapping.sku === undefined && skuHeaders.some((token) => header.includes(token))) {
      mapping.sku = index
      return
    }
    if (mapping.name === undefined && nameHeaders.some((token) => header.includes(token))) {
      mapping.name = index
      return
    }
    if (mapping.price === undefined && priceHeaders.some((token) => header.includes(token))) {
      mapping.price = index
      return
    }
    if (mapping.unit === undefined && unitHeaders.some((token) => header.includes(token))) {
      mapping.unit = index
      return
    }
    if (mapping.quantity === undefined && quantityHeaders.some((token) => header.includes(token))) {
      mapping.quantity = index
      return
    }
  })

  return mapping
}

export function findHeaderRowIndex(rows: unknown[][]) {
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const mapping = detectColumnMapping(rows[index] ?? [])
    if (mapping.price !== undefined && (mapping.name !== undefined || mapping.sku !== undefined)) {
      return index
    }
  }

  return -1
}

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const raw = String(value ?? '').trim()
  if (!raw) return null

  const normalized = raw
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d,.\-]/g, '')
    .replace(/,(?=\d{1,2}$)/, '.')
    .replace(/,/g, '')

  if (!normalized) return null

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function cellText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

export function extractRowsFromSheet(
  rows: unknown[][],
  source: 'excel' | 'csv' | 'pdf' | 'ocr',
) {
  const headerIndex = findHeaderRowIndex(rows)
  if (headerIndex < 0) {
    return []
  }

  const mapping = detectColumnMapping(rows[headerIndex] ?? [])
  const extracted: Array<{
    rowIndex: number
    sku: string | null
    name: string | null
    unit: string | null
    quantity: number | null
    price: number | null
    currency: string | null
    source: 'excel' | 'csv' | 'pdf' | 'ocr'
    rawValues: Record<string, string | number | null>
  }> = []

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const sku = mapping.sku !== undefined ? cellText(row[mapping.sku]) : null
    const name = mapping.name !== undefined ? cellText(row[mapping.name]) : null
    const unit = mapping.unit !== undefined ? cellText(row[mapping.unit]) : null
    const quantity =
      mapping.quantity !== undefined ? parseNumericValue(row[mapping.quantity]) : null
    const price = mapping.price !== undefined ? parseNumericValue(row[mapping.price]) : null

    if (!price || (!sku && !name)) {
      continue
    }

    extracted.push({
      rowIndex,
      sku,
      name,
      unit,
      quantity,
      price,
      currency: 'RUB',
      source,
      rawValues: {
        sku,
        name,
        unit,
        quantity,
        price,
      },
    })
  }

  return extracted
}

export function extractRowsFromPlainText(text: string, source: 'pdf' | 'ocr') {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const rows = lines.map((line) => {
    if (line.includes('\t')) {
      return line.split('\t')
    }
    if (line.includes(';')) {
      return line.split(';')
    }
    if (line.includes('|')) {
      return line.split('|')
    }

    const priceMatch = line.match(/(.+?)\s+([\d\s]+[.,]\d{2})\s*$/)
    if (priceMatch) {
      return [priceMatch[1]?.trim() ?? '', priceMatch[2]?.trim() ?? '']
    }

    return [line]
  })

  return extractRowsFromSheet(rows, source)
}
