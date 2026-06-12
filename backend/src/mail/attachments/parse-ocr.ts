import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { extractRowsFromPlainText } from './extract-rows'
import type { ParsedPriceRowInput } from './types'

export type OcrOptions = {
  tesseractBin?: string
  tesseractLang?: string
}

export function parseOcrText(text: string): ParsedPriceRowInput[] {
  return extractRowsFromPlainText(text, 'ocr')
}

export async function parseImageBufferWithOcr(
  filename: string,
  buffer: Buffer,
  options: OcrOptions = {},
): Promise<ParsedPriceRowInput[]> {
  const tesseractBin = options.tesseractBin?.trim() || 'tesseract'
  const tesseractLang = options.tesseractLang?.trim() || 'rus+eng'
  const workdir = await mkdtemp(path.join(tmpdir(), 'zakup-ocr-'))
  const extension = path.extname(filename).toLowerCase() || '.img'
  const inputPath = path.join(workdir, `input${extension}`)
  const outputBase = path.join(workdir, 'output')
  const outputPath = `${outputBase}.txt`

  try {
    await writeFile(inputPath, buffer)
    const proc = Bun.spawn([tesseractBin, inputPath, outputBase, '-l', tesseractLang], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stderr).text(),
    ])

    if (exitCode !== 0) {
      const message = stderr.trim() || `Tesseract exited with code ${exitCode}`
      throw new Error(`OCR failed: ${message}`)
    }

    const text = await readFile(outputPath, 'utf8')
    return parseOcrText(text)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`OCR binary "${tesseractBin}" was not found`)
    }
    throw error
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
}
