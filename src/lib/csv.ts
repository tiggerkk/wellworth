/**
 * Minimal RFC-4180 CSV parser used by the bulk food import. Handles quoted fields, embedded
 * commas / newlines inside quotes, and `""` escapes. Returns rows of raw string cells; callers
 * trim and interpret. A leading UTF-8 BOM (common from Excel exports) is stripped.
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
