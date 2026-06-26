// Slice 10 PR3: insert-exotica doc-mutation surface on the PM engine. dropCap (real w:framePr),
// coverPage (documentPartObject content), dateTime/quickParts (real DATE/AUTHOR fields), screenshot/
// icons/onlinePictures (real w:drawing images), textBox (editable v:textbox), WordArt (real DrawingML
// blob); chart/smartart/object/signatureLine/onlineVideo degrade honestly. editor.doc/commands read
// fresh each call (K6). See plan §0 F2-F9.
import { TextSelection } from '@/pm'

type AnyEditor = any

export function installInsertExotica(editor: AnyEditor) {
  const w = window as any
  const refocus = () => editor.view?.focus()
  const toast = (m: string, d?: string) => { try { w.WC?.toast?.(m, d) } catch { /* none */ } }
  const pm = () => (w.WC && w.WC.PM) ? w.WC.PM : null
  const docApi = (): any => { try { return editor.doc } catch { return null } }

  // selection → TextTarget for field inserts; mint an sdBlockId when the caret block lacks one
  // (the references.ts K-risk-1 pattern, condensed).
  function inlineTarget(): any | null {
    const d = docApi(); if (!d) return null
    try { const t = d.selection.current({})?.target; if (t) return t } catch { /* mint */ }
    try {
      const { from } = editor.state.selection
      const $pos = editor.state.doc.resolve(from)
      let depth = $pos.depth
      while (depth > 0 && !$pos.node(depth).isTextblock) depth--
      const node = $pos.node(depth)
      if (!node || !node.isTextblock) return null
      const attrs = (node.attrs ?? {}) as Record<string, unknown>
      const existing = attrs.sdBlockId ?? attrs.id ?? attrs.blockId
      if (!(typeof existing === 'string' && existing.length > 0)) {
        if (!('sdBlockId' in (node.type.spec.attrs ?? {}))) return null
        const blockPos = $pos.before(depth)
        const minted = 'wc-xe-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        const tr = editor.state.tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, sdBlockId: minted })
        tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from)))
        editor.view?.dispatch(tr)
      }
    } catch { return null }
    try { return docApi()?.selection.current({})?.target ?? null } catch { return null }
  }

  function insertField(instruction: string): boolean {
    const d = docApi(); if (!d) return false
    const at = inlineTarget(); if (!at) return false
    try { const r = d.fields.insert({ at, instruction, mode: 'raw' }); refocus(); return !!(r && r.success !== false) } catch { return false }
  }

  // ---- dropCap (real w:framePr) ----
  function xeDropCap(kind: string, lines: number): boolean {
    const dc = kind === 'margin' ? 'margin' : (kind === 'none' || !kind) ? null : 'drop'
    try {
      const { from } = editor.state.selection
      const $pos = editor.state.doc.resolve(from)
      let depth = $pos.depth
      while (depth > 0 && $pos.node(depth).type.name !== 'paragraph') depth--
      const node = $pos.node(depth)
      if (!node || node.type.name !== 'paragraph') return false
      const pos = $pos.before(depth)
      const pp = { ...(node.attrs.paragraphProperties || {}) }
      if (dc) pp.framePr = { dropCap: dc, lines: lines || 3, wrap: 'around', vAnchor: 'text', hAnchor: 'text' }
      else delete pp.framePr
      editor.view?.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, paragraphProperties: pp }))
      refocus(); return true
    } catch { return false }
  }

  // ---- coverPage (documentPartObject content; replace existing) ----
  function xeCoverPage(name: string): boolean {
    try {
      // Remove an existing cover (the first documentPartObject) so we never stack two.
      let removeRange: { from: number; to: number } | null = null
      editor.state.doc.descendants((n: any, p: number) => {
        if (removeRange) return false
        if (n.type.name === 'documentPartObject') { removeRange = { from: p, to: p + n.nodeSize }; return false }
        return true
      })
      const title = (name && name.trim()) ? name : 'Document Title'
      const year = new Date().getFullYear()
      const cover = {
        // id MUST be a non-empty NUMERIC STRING: the docPartObj exporter's sanitizeId keeps any
        // non-empty string but drops a JS number (→ no <w:id>); and the sdt <w:id w:val> is an
        // ST_DecimalNumber, so a non-numeric string ("wc-cover-…") makes Word REFUSE to open the
        // file (oracle Leg A: hard open error). A digits-only string both survives sanitizeId and
        // validates. (Slice-10 PR3 oracle fix.)
        type: 'documentPartObject',
        attrs: { id: String(Date.now() % 1000000), docPartGallery: 'Cover Pages', docPartUnique: true },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: title, marks: [{ type: 'bold' }] }] },
          { type: 'paragraph', content: [{ type: 'text', text: '[Subtitle]' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '[Author Name] — ' + year }] },
        ],
      }
      let tr = editor.state.tr
      if (removeRange) tr = tr.delete(removeRange.from, removeRange.to)
      // Insert at the document start (pos 0 is before the first block).
      tr = tr.insert(0, editor.state.schema.nodeFromJSON(cover))
      editor.view?.dispatch(tr)
      refocus(); toast('Cover page "' + (name || 'Cover') + '" inserted.'); return true
    } catch { return false }
  }
  // Remove the current cover (re-points the legacy "Remove Current Cover Page").
  function xeRemoveCoverPage(): boolean {
    try {
      let range: { from: number; to: number } | null = null
      editor.state.doc.descendants((n: any, p: number) => {
        if (range) return false
        if (n.type.name === 'documentPartObject') { range = { from: p, to: p + n.nodeSize }; return false }
        return true
      })
      if (!range) { toast('No cover page found.'); return false }
      editor.view?.dispatch(editor.state.tr.delete(range.from, range.to))
      refocus(); toast('Cover page removed.'); return true
    } catch { return false }
  }

  // ---- dateTime + quickParts (real fields) ----
  function xeDateTime(fmt: string, opts?: { auto?: boolean; text?: string }): boolean {
    const f = (fmt && String(fmt).trim()) || 'M/d/yyyy'
    // RB-050: the Date & Time dialog's "Update automatically" checkbox. When checked — or when no opts
    // are passed (legacy callers / field default) — insert a live DATE field. When unchecked, real Word
    // inserts the formatted date as STATIC TEXT instead of a field.
    const auto = !opts || opts.auto !== false
    if (auto) {
      const ok = insertField('DATE \\@ "' + f + '"')
      if (ok) toast('Date field inserted (updates on F9 / open).')
      return ok
    }
    // Prefer the dialog's already-formatted display string; fall back to today's locale date (never the
    // raw format token f, which would insert a garbage literal like "M/d/yyyy").
    const text = (opts && typeof opts.text === 'string' && opts.text.trim()) ? opts.text : new Date().toLocaleDateString()
    try {
      const ok = editor.chain().insertContent(text).run() === true
      if (ok) { refocus(); toast('Date inserted as static text.') }
      return ok
    } catch { return false }
  }
  function xeQuickPart(kind: string): boolean {
    const MAP: Record<string, string> = {
      page: 'PAGE', numpages: 'NUMPAGES', date: 'DATE \\@ "M/d/yyyy"', author: 'AUTHOR',
      filename: 'FILENAME', title: 'DOCPROPERTY Title',
    }
    const instr = MAP[String(kind)] || String(kind).toUpperCase()
    return insertField(instr)
  }

  // ---- images (screenshot / icons / online pictures) ----
  async function xeScreenshot(): Promise<boolean> {
    try {
      if (!w.wordAPI?.screenshot) { toast('Screenshot capture is not available in this build.'); return false }
      const r = await w.wordAPI.screenshot()
      if (!(r && r.ok && r.dataUrl)) { toast('Screenshot ' + (r && r.error ? 'failed: ' + r.error : 'canceled') + '.'); return false }
      return pm()?.insertImage?.({ src: r.dataUrl, alt: 'Screenshot' }) === true
    } catch { return false }
  }
  function xeIcon(name: string): boolean {
    try {
      const svg = w.WC?.icon?.(name || 'save', 64)
      if (!svg) { toast('Icon not found.'); return false }
      const src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      return pm()?.insertImage?.({ src, alt: 'Icon: ' + name, width: 32, height: 32 }) === true
    } catch { return false }
  }
  async function xeOnlinePicture(): Promise<boolean> {
    try {
      if (!w.wordAPI?.pickImage) { toast('Online image search is unavailable — pick a local image instead.'); return false }
      toast('Online image search is unavailable in this clone — choose a local image.')
      const r = await w.wordAPI.pickImage()
      if (!(r && r.ok && r.dataUrl)) return false
      return pm()?.insertImage?.({ src: r.dataUrl, alt: r.name || 'Picture' }) === true
    } catch { return false }
  }

  // ---- textBox (editable VML) + WordArt (real DrawingML) ----
  function xeTextBox(text: string): boolean {
    try { const ok = editor.commands.insertTextBox({ text: text || 'Text' }); refocus(); return ok === true } catch { return false }
  }
  function xeWordArt(text: string, opts: any): boolean {
    try { const ok = editor.commands.insertWordArt({ text: text || 'WordArt', ...(opts || {}) }); refocus(); return ok === true } catch { return false }
  }

  // ---- onlineVideo (honest degrade: real link + toast) ----
  function xeOnlineVideo(url: string): boolean {
    const u = String(url || '').trim()
    if (!u) return false
    const ok = pm()?.insertLink?.({ href: u, text: u }) === true
    if (ok) toast('Inserted a link to the video — embedded playback lands at Phase 7.')
    return ok
  }

  // ---- honest-degrade no-op toasts (no fork construction path; recorded follow-ups) ----
  // Interim chart: the dialog computes an SVG (Insert.chartSVG) and passes it here; insert it as a
  // static image (the xeIcon data-URL pattern). A live c:chartSpace + embedded workbook is a separate
  // subsystem (NEEDS-USER) — this stops the control from silently inserting nothing.
  function xeChart(svg?: string): boolean {
    if (typeof svg === 'string' && svg.trim()) {
      try {
        const src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
        return pm()?.insertImage?.({ src, alt: 'Chart' }) === true
      } catch { return false }
    }
    toast('Charts (live c:chartSpace + data) need a chart subsystem — available in a future update.'); return true
  }
  function xeSmartArt(): boolean { toast('SmartArt (dgm: diagrams) needs a diagram subsystem — available in a future update.'); return true }
  function xeObject(): boolean { toast('Embedding OLE objects needs a host runtime — not available in this clone.'); return true }
  function xeSignatureLine(): boolean { toast('Signature lines need the signature-provider subsystem — available in a future update.'); return true }

  // NOTE: xeScreenshot/xeOnlinePicture/xeObject are reserve/test verbs — no live ribbon path invokes
  // them (screenshot re-points to PM.insertImage directly; onlinePictures is a toast-only phantom; the
  // object OLE branch is a non-mutating toast). They're exercised by the [10ex] degrade test only.
  return {
    xeDropCap, xeCoverPage, xeRemoveCoverPage, xeDateTime, xeQuickPart,
    xeScreenshot, xeIcon, xeOnlinePicture,
    xeTextBox, xeWordArt, xeOnlineVideo,
    xeChart, xeSmartArt, xeObject, xeSignatureLine,
  }
}
