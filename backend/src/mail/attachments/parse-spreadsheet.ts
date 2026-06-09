import * as XLSX from 'xlsx'

import { extractRowsFromSheet } from './extract-rows'
import type { ParsedPriceRowInput } from './types'

function sheetToMatrix(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]
}

export function parseExcelBuffer(buffer: Buffer, source: 'excel' | 'csv'): ParsedPriceRowInput[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const rows: ParsedPriceRowInput[] = []

  for (const sheetName of workbook.SheetNames) {
    const matrix = sheetToMatrix(workbook.Sheets[sheetName]!)
    const extracted = extractRowsFromSheet(matrix, source)
    rows.push(...extracted)
  }

  return rows
}

export function parseCsvBuffer(buffer: Buffer): ParsedPriceRowInput[] {
  const text = buffer.toString('utf8')
  const delimiter = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ','
  const workbook = XLSX.read(text, { type: 'string', FS: delimiter, raw: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]!]
  if (!sheet) return []

  const matrix = sheetToMatrix(sheet)
  return extractRowsFromSheet(matrix, 'csv')
}
