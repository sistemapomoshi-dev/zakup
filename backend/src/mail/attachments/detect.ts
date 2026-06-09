import type { AttachmentKind } from './types'

const excelExtensions = new Set(['xlsx', 'xls', 'xlsm', 'xlsb'])
const csvExtensions = new Set(['csv', 'tsv', 'txt'])
const pdfExtensions = new Set(['pdf'])
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff'])

const excelMimeTypes = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
])
const csvMimeTypes = new Set(['text/csv', 'text/tab-separated-values', 'text/plain'])
const pdfMimeTypes = new Set(['application/pdf'])
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'])

function extensionOf(filename: string) {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) ?? '' : ''
}

export function detectAttachmentKind(filename: string, mimeType: string | null | undefined): AttachmentKind {
  const extension = extensionOf(filename)
  const normalizedMime = mimeType?.split(';')[0]?.trim().toLowerCase() ?? ''

  if (excelExtensions.has(extension) || excelMimeTypes.has(normalizedMime)) {
    return 'excel'
  }
  if (csvExtensions.has(extension) || csvMimeTypes.has(normalizedMime)) {
    return 'csv'
  }
  if (pdfExtensions.has(extension) || pdfMimeTypes.has(normalizedMime)) {
    return 'pdf'
  }
  if (imageExtensions.has(extension) || imageMimeTypes.has(normalizedMime)) {
    return 'image'
  }

  return 'unsupported'
}

export function isParseableKind(kind: AttachmentKind) {
  return kind === 'excel' || kind === 'csv' || kind === 'pdf'
}
