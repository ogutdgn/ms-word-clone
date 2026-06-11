// file-content.ts — pure converters for slice-7 file IO (no DOM, no legacy deps).
// (No decode helper here: files.js — legacy-chrome JS that can't import bridge TS — inlines its
// own TextDecoder + BOM strip.)
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Mirrors the legacy main.js txt leg: line-per-<p>, blank line → empty paragraph.
export function textToParagraphHtml(text: string): string {
  return text.split(/\r?\n/).map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`).join('')
}

// RFC-4180 (port of the proven legacy parser, mailings-tools.js:231 — delimiter sniff: tab
// when tabs present and commas absent; quoted fields; "" escape; CRLF tolerant).
export function parseCsv(text: string): string[][] {
  const delim = text.indexOf('\t') >= 0 && text.indexOf(',') < 0 ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export function csvToTableHtml(text: string): string | null {
  const rows = parseCsv(text)
  if (!rows.length) return null
  // reduce, not Math.max(...spread): spreading ~100k+ rows as arguments blows the
  // call-stack limit (RangeError) and would escape PM.openCsv synchronously.
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const body = rows
    .map((r) => `<tr>${Array.from({ length: cols }, (_, i) => `<td>${escapeHtml(r[i] ?? '') || '<br>'}</td>`).join('')}</tr>`)
    .join('')
  return `<table>${body}</table>`
}
