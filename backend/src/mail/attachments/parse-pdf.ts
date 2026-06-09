import { PDFParse } from 'pdf-parse'

import { extractRowsFromPlainText } from './extract-rows'
import type { ParsedPriceRowInput } from './types'

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPriceRowInput[]> {
  const parser = new PDFParse({ data: buffer })
  try {
    const parsed = await parser.getText()
    const text = parsed.text?.trim() ?? ''
    if (!text) {
      return []
    }

    return extractRowsFromPlainText(text, 'pdf')
  } finally {
    await parser.destroy()
  }
}
