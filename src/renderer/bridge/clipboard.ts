// Slice 4: flavored clipboard surface. Default cut/copy/paste TRIGGER the native
// webContents path (prosemirror-view serializer/parser do the document work);
// flavored pastes read the Electron clipboard and enter through view.pasteText /
// view.pasteHTML / setImage so every insertion is a normal PM transaction.
type AnyEditor = any

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

  async function cutSelection(): Promise<boolean> {
    focusView(); await api()?.cut(); return true
  }
  async function copySelection(): Promise<boolean> {
    focusView(); await api()?.copy(); return true
  }
  async function pasteDefault(): Promise<boolean> {
    focusView(); await api()?.paste(); return true // fire-and-forget — content lands async
  }
  async function pasteTextOnly(): Promise<boolean> {
    const text = await api()?.readText()
    if (!text) return false
    focusView()
    return !!editor.view.pasteText(text, pasteEvent({ 'text/plain': text }))
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

  return { cutSelection, copySelection, pasteDefault, pasteTextOnly, pasteHTML, pastePicture, clipboardFlavors }
}
