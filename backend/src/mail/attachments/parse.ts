import { detectAttachmentKind, isParseableKind } from './detect'
import { parsePdfBuffer } from './parse-pdf'
import { parseCsvBuffer, parseExcelBuffer } from './parse-spreadsheet'
import type { ParseAttachmentResult } from './types'

export async function parseAttachmentContent(
  filename: string,
  mimeType: string | null | undefined,
  buffer: Buffer,
): Promise<ParseAttachmentResult> {
  const kind = detectAttachmentKind(filename, mimeType)

  if (kind === 'image') {
    return {
      status: 'skipped',
      reason: 'OCR для изображений будет добавлен отдельно; пока поддерживаются Excel, CSV и PDF',
    }
  }

  if (kind === 'unsupported') {
    return {
      status: 'skipped',
      reason: 'Формат вложения не поддерживается для автоматического парсинга',
    }
  }

  if (!isParseableKind(kind)) {
    return {
      status: 'skipped',
      reason: 'Формат вложения не поддерживается',
    }
  }

  try {
    let rows
    if (kind === 'excel') {
      rows = parseExcelBuffer(buffer, 'excel')
    } else if (kind === 'csv') {
      rows = parseCsvBuffer(buffer)
    } else {
      rows = await parsePdfBuffer(buffer)
    }

    if (rows.length === 0) {
      return {
        status: 'failed',
        error: 'Не удалось распознать строки прайса. Проверьте заголовки колонок (артикул/наименование/цена).',
      }
    }

    return { status: 'parsed', rows }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    return { status: 'failed', error: message }
  }
}
