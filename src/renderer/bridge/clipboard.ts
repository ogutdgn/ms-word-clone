// Slice 4: flavored clipboard surface. Default cut/copy/paste TRIGGER the native
// webContents path (prosemirror-view serializer/parser do the document work);
// flavored pastes read the Electron clipboard and enter through view.pasteText /
// view.pasteHTML / setImage so every insertion is a normal PM transaction.
type AnyEditor = any

// Phase 3 ribbon state machine: cache of whether the OS clipboard currently
// holds pasteable content. Drives the Paste button's enablement (Word greys
// Paste on an empty clipboard). It is EXTERNAL state — the user can copy in
// another app — so it is refreshed on window focus and after our own clipboard
// ops, never derived from an editor transaction. state-sync.ts reads the getter
// in toQueryState; clipboard.ts updates it here.
let _clipboardHasContent = false
export const clipboardHasContent = (): boolean => _clipboardHasContent

// Set Default Paste (Word Options → Advanced): the mode plain Paste (Ctrl+V /
// the split-button main face) uses. Persisted in localStorage by the dialog
// (dialogs.js D.setDefaultPaste); read here. 'keepSource' is Word's default.
export type DefaultPasteMode = 'keepSource' | 'merge' | 'text'
export function defaultPasteMode(): DefaultPasteMode {
  try {
    const m = localStorage.getItem('wc.defaultPaste')
    if (m === 'merge' || m === 'text') return m
  } catch { /* no storage */ }
  return 'keepSource'
}

// Merge Formatting (Word's middle paste option): keep the source's "meaningful"
// run formatting (bold/italic/underline/strike/links/lists/sub-superscript) but
// adopt the DESTINATION paragraph's font, size, and color so the pasted text
// blends in. Implemented as an HTML pre-pass that strips the inheriting
// properties — the stripped runs then fall through to the destination style,
// while the emphasis tags (<b>/<i>/<u>/<a>/<ul>…) survive untouched. Pure and
// exported so it is unit-testable without touching the OS clipboard.
const MERGE_STRIP_PROPS = [
  'font-family', 'font-size', 'color', 'background', 'background-color',
  'line-height', 'mso-ansi-font-size', 'mso-bidi-font-size',
  'mso-ascii-font-family', 'mso-hansi-font-family', 'mso-bidi-font-family',
]
export function mergeFormattingHtml(html: string): string {
  try {
    const docp = new DOMParser().parseFromString(html, 'text/html')
    docp.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (el.style) MERGE_STRIP_PROPS.forEach((p) => el.style.removeProperty(p))
      el.removeAttribute('face'); el.removeAttribute('size'); el.removeAttribute('color')
      if (el.getAttribute('style') === '') el.removeAttribute('style') // drop now-empty style=""
    })
    return docp.body.innerHTML
  } catch { return html }
}

// view.pasteText/pasteHTML synthesize a bare `new ClipboardEvent('paste')` whose
// clipboardData is null — but the fork's InputRule handlePaste reads
// event.clipboardData.getData(...) and would throw. Hand it a real ClipboardEvent
// carrying a populated DataTransfer so the fork paste pipeline runs normally.
// Exported (slice 7): PM.pasteHTMLString in index.ts drives the same paste route.
export const pasteEvent = (data: Record<string, string>): ClipboardEvent => {
  const dt = new DataTransfer()
  for (const k in data) dt.setData(k, data[k])
  return new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
}

export function installClipboard(editor: AnyEditor) {
  const api = () => (window as any).wordAPI?.clipboard

  const focusView = () => { try { editor.view.focus() } catch { /* view gone */ } }
  // A copy fires no editor transaction, so the per-transaction ribbon sync would
  // not re-run — nudge it explicitly so Paste re-enables immediately.
  const nudgeRibbon = () => { try { (window as any).WC?.PM?._scheduleRibbonSync?.() } catch { /* pre-mount */ } }

  // Re-probe the OS clipboard and re-evaluate the ribbon. Called on window focus
  // (clipboard may have changed in another app) and once at boot.
  async function refreshClipboardState(): Promise<boolean> {
    try {
      const f = await api()?.flavors()
      _clipboardHasContent = !!(f && (f.hasText || f.hasHtml || f.hasImage))
    } catch { /* clipboard unreadable */ }
    nudgeRibbon()
    return _clipboardHasContent
  }

  // Office Clipboard auto-capture (Word parity): record the selection into the
  // 24-item history BEFORE a cut removes it. capture() dedups, so the parallel
  // DOM copy/cut listener (keyboard path, home-features.js) is safe.
  const capture = () => { try { (window as any).WC?.Clipboard?.capture?.() } catch { /* no store */ } }

  async function cutSelection(): Promise<boolean> {
    focusView(); capture(); await api()?.cut(); _clipboardHasContent = true; nudgeRibbon(); return true
  }
  async function copySelection(): Promise<boolean> {
    focusView(); capture(); await api()?.copy(); _clipboardHasContent = true; nudgeRibbon(); return true
  }
  async function pasteDefault(): Promise<boolean> {
    // Honor the Set Default Paste mode (Word). keepSource → native paste; merge →
    // destination-style reconciliation; text → unformatted. (pasteTextOnly/pasteMerge
    // are hoisted function declarations, safe to call before their definition.)
    const mode = defaultPasteMode()
    if (mode === 'text') return pasteTextOnly()
    if (mode === 'merge') return pasteMerge()
    focusView(); await api()?.paste(); return true // keepSource — fire-and-forget, content lands async
  }
  async function pasteTextOnly(): Promise<boolean> {
    const text = await api()?.readText()
    if (!text) return false
    focusView()
    // "Keep Text Only" must never auto-linkify a pasted URL (Word) — suppress the
    // fork's plain-text autolink branch for the duration of this paste. pasteText
    // runs handlePaste synchronously, so the flag is reset right after.
    editor.options.noPasteAutolink = true
    try {
      return !!editor.view.pasteText(text, pasteEvent({ 'text/plain': text }))
    } finally {
      editor.options.noPasteAutolink = false
    }
  }
  async function pasteHTML(): Promise<boolean> {
    const html = await api()?.readHTML()
    if (!html) return false
    focusView()
    // Carry a text/plain companion too (matches the fork's own createPasteEventShim)
    // so the fork's pasteHtml-empty fallback branch can never read undefined.
    const text = (await api()?.readText()) || ''
    return !!editor.view.pasteHTML(html, pasteEvent({ 'text/html': html, 'text/plain': text }))
  }
  async function pastePicture(): Promise<boolean> {
    const img = await api()?.readImage()
    if (!img?.dataUrl) return false
    focusView()
    // Pass BOTH width+height: the fork's ImageRegistrationPlugin only registers a
    // data-URL image IN PLACE (synchronously) when size has finite positive w AND h
    // (shouldRegisterInPlace). With width alone it takes the async process path —
    // the node is deleted and re-inserted later, so it would not be in the doc yet.
    return !!editor.commands.setImage({ src: img.dataUrl, size: { width: img.width, height: img.height } })
  }
  async function clipboardFlavors(): Promise<{ hasText: boolean; hasHtml: boolean; hasImage: boolean; formats: string[] } | null> {
    return (await api()?.flavors()) ?? null
  }
  // Direct (clipboard-free) merge paste — testable and reused by pasteMerge.
  function pasteMergeHtml(html: string): boolean {
    focusView()
    const merged = mergeFormattingHtml(html)
    return !!editor.view.pasteHTML(merged, pasteEvent({ 'text/html': merged, 'text/plain': '' }))
  }
  async function pasteMerge(): Promise<boolean> {
    const html = await api()?.readHTML()
    if (!html) return pasteTextOnly() // no rich source → plain text already "merges"
    return pasteMergeHtml(html)
  }

  return { cutSelection, copySelection, pasteDefault, pasteTextOnly, pasteHTML, pastePicture, clipboardFlavors, refreshClipboardState, pasteMerge, pasteMergeHtml, defaultPasteMode }
}
