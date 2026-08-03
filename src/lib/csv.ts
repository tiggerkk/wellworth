/**
 * Minimal RFC-4180 CSV parser/serializer shared by every module's bulk importer and exporter.
 * `parseCsv` handles quoted fields, embedded commas / newlines inside quotes, and `""` escapes,
 * returning rows of raw string cells (callers trim and interpret); a leading UTF-8 BOM (common
 * from Excel exports) is stripped. `toCsv` is its inverse, for the Export buttons — quoting a
 * cell only when it needs it (contains a comma, quote, or newline).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let started = false // did this row have any content/field yet (so a final empty field counts)

  let i = 0
  if (text.charCodeAt(0) === 0xfeff) i = 1 // strip BOM

  for (; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      started = true
    } else if (c === ',') {
      row.push(field)
      field = ''
      started = true
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      started = false
    } else if (c === '\r') {
      // ignore; a following \n closes the row
    } else {
      field += c
      started = true
    }
  }
  if (started || field !== '') {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Quote a cell only if it needs it (comma, double-quote, or newline), doubling any `"`. */
function escapeCsvField(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

/** Serialize rows of string cells to RFC-4180 CSV text (CRLF line endings, header row included
 *  by the caller as `rows[0]`). Inverse of `parseCsv`. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
}
