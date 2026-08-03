/**
 * Shared "save a file" helper for every module's Export buttons. Desktop-only mechanism (per
 * product decision): builds a `Blob`, then clicks a throwaway `<a download>` anchor — the browser
 * handles the actual save-as-file dialog. No dependency on Web Share API / native file pickers.
 */
import { toCsv } from './csv'

function download(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Save CSV rows as a file. Prepends a UTF-8 BOM so Excel opens non-ASCII text correctly
 *  (`parseCsv` already strips a leading BOM, so re-importing the file works either way). */
export function downloadCsv(filename: string, rows: string[][]): void {
  download(filename, '\ufeff' + toCsv(rows), 'text/csv;charset=utf-8;')
}

/** Save a JSON-serializable value as a `.json` file, pretty-printed. */
export function downloadJson(filename: string, data: unknown): void {
  download(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;')
}
