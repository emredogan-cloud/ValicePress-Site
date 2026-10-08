/**
 * CSV for the one file this site ever hands out full of real people's addresses.
 *
 * Two rules, both about what a spreadsheet does with a cell:
 *   - RFC 4180: every cell quoted, every inner quote doubled — a name with a
 *     comma, a quote or a newline cannot break a row apart;
 *   - NO FORMULAS: a cell that begins with `=`, `+`, `-`, `@`, tab or carriage
 *     return is read by Excel and Sheets as a formula, and a contact whose name
 *     is `=HYPERLINK("http://evil","click")` would run on the operator's machine
 *     the moment they opened the export. Such a cell gets a leading `'`, which
 *     both programs show as plain text.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(",");
}
