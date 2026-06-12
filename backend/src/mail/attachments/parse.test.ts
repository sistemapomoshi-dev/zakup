import { describe, expect, test } from 'bun:test'

import { detectAttachmentKind } from './detect'
import {
  detectColumnMapping,
  extractRowsFromPlainText,
  extractRowsFromSheet,
  findHeaderRowIndex,
  parseNumericValue,
} from './extract-rows'
import { parseOcrText } from './parse-ocr'

describe('attachment detect', () => {
  test('detects excel, csv, pdf and image kinds', () => {
    expect(detectAttachmentKind('price-list.xlsx', null)).toBe('excel')
    expect(detectAttachmentKind('data.csv', 'text/csv')).toBe('csv')
    expect(detectAttachmentKind('scan.pdf', 'application/pdf')).toBe('pdf')
    expect(detectAttachmentKind('photo.jpg', 'image/jpeg')).toBe('image')
    expect(detectAttachmentKind('readme.zip', 'application/zip')).toBe('unsupported')
  })
})

describe('price row extraction', () => {
  test('maps russian headers and parses numeric prices', () => {
    const rows = [
      ['Артикул', 'Наименование', 'Цена', 'MOQ'],
      ['A-1', 'Товар 1', '1 234,50', '10'],
      ['A-2', 'Товар 2', '999.00', ''],
    ]

    expect(findHeaderRowIndex(rows)).toBe(0)
    expect(detectColumnMapping(rows[0]!)).toEqual({
      sku: 0,
      name: 1,
      price: 2,
      quantity: 3,
    })
    expect(parseNumericValue('1 234,50')).toBe(1234.5)
    expect(extractRowsFromSheet(rows, 'excel')).toHaveLength(2)
  })

  test('keeps rows with either sku or name and a price', () => {
    const rows = [
      ['SKU', 'Name', 'Price'],
      ['', 'Only name', '100'],
      ['SKU-1', '', '200'],
      ['', '', '300'],
    ]

    expect(extractRowsFromSheet(rows, 'csv')).toHaveLength(2)
    expect(extractRowsFromSheet(rows, 'csv')[0]).toMatchObject({ name: 'Only name', price: 100 })
    expect(extractRowsFromSheet(rows, 'csv')[1]).toMatchObject({ sku: 'SKU-1', price: 200 })
  })
})

describe('parse spreadsheet buffer', () => {
  test('parses csv buffer into price rows', async () => {
    const { parseCsvBuffer } = await import('./parse-spreadsheet')
    const buffer = Buffer.from(
      'Артикул;Наименование;Цена\nP-1;Кабель USB;150,25\nP-2;Адаптер;89,00\n',
      'utf8',
    )

    const rows = parseCsvBuffer(buffer)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      sku: 'P-1',
      name: 'Кабель USB',
      price: 150.25,
      source: 'csv',
    })
  })
})

describe('parse OCR text', () => {
  test('extracts price rows from recognized image text', () => {
    const text = 'Артикул;Наименование;Цена\nP-1;Кабель USB;150,25\nP-2;Адаптер;89,00\n'

    expect(parseOcrText(text)).toEqual(extractRowsFromPlainText(text, 'ocr'))
    expect(parseOcrText(text)).toHaveLength(2)
    expect(parseOcrText(text)[0]).toMatchObject({
      sku: 'P-1',
      name: 'Кабель USB',
      price: 150.25,
      source: 'ocr',
    })
  })
})
