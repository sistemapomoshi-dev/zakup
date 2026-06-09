export type ParsedPriceRowInput = {
  rowIndex: number
  sku: string | null
  name: string | null
  unit: string | null
  quantity: number | null
  price: number | null
  currency: string | null
  source: 'excel' | 'csv' | 'pdf' | 'ocr'
  rawValues?: Record<string, string | number | null>
}

export type AttachmentKind = 'excel' | 'csv' | 'pdf' | 'image' | 'unsupported'

export type ParseAttachmentResult =
  | { status: 'parsed'; rows: ParsedPriceRowInput[] }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }
