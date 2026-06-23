// One construction path for the vendored Editor (boot + Open + New).
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'
// Live image resize — an owned NodeSelection-driven handle overlay over the fork (out-of-fork
// philosophy). See src/renderer/imageresize/. (The legacy overlay decoration-paginator was
// retired in 008 — the paged PresentationEditor is the sole paginator.)
import { ImageResize } from '@/imageresize/image-resize'
// Option-B: SuperDoc's real per-page layout engine (PresentationEditor). Imported LAZILY
// inside constructPresentationEditor (a dynamic import — Milestone 1) so the heavy engine
// subgraph (presentation-editor + layout-engine + painter-dom + measuring-dom) stays code-split
// into its own chunk (fetched at boot now that paged is the default — FR-013; the entry stays
// under the bundle ceiling and a WC_LAYOUT=overlay build skips the chunk entirely).

// Real shapes: docx → DocxFileEntry[] | Record<string,unknown> (EditorOptions.content),
// mediaFiles → Record<string,unknown> (EditorOptions.mediaFiles),
// fonts → Record<string,unknown> (EditorOptions.fonts).
// Kept as unknown: @core/types/EditorConfig.js is a vendored .ts file; importing
// EditorOptions type-only from there requires an extra path alias round-trip that
// adds no runtime value. See src/renderer/core/superdoc-fork/core/types/EditorConfig.ts.
export type ParsedDocx = { docx: unknown; mediaFiles: unknown; fonts: unknown }

// Parse only — throws on corrupt input. Callers parse BEFORE tearing anything down.
export async function parseDocx(source: ArrayBuffer): Promise<ParsedDocx> {
  const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(source)
  return { docx, mediaFiles, fonts }
}

// "Change User Name…" (Track Changes Options, T18) persists the identity here. A REAL display
// identity — stamped as w:author/w:initials on tracked changes + creatorName on comment cards;
// the dialog persists an override here so the identity survives relaunch + replaceFile remounts.
function storedAuthorName(): string {
  try { return localStorage.getItem('wc-author-name') || 'Word User' } catch { return 'Word User' }
}

// ─── Option-B paged path (WC_LAYOUT=paged) — the standup spike ──────────────────────
// PresentationEditor EXTENDS Editor, wipes mountEl, builds a HIDDEN offscreen inner Editor
// (the real PM view/edit/undo/IME source), and paints REAL per-page DOM (.superdoc-page
// [data-page-index]). It IS the paginator, so pass getStarterExtensions() ONLY — adding our
// Pagination/ImageResize would measure the hidden host and inject spurious seams. The WC
// bridge reads `editor.view`, which PresentationEditor does NOT expose; callers must bind the
// bridge to `.editor` (the inner Editor, which HAS `.view`), never to the PresentationEditor.
export type PagedMount = { presentation: any; editor: any }

export async function constructPresentationEditor(mountEl: HTMLElement, parsed: ParsedDocx): Promise<PagedMount> {
  // Lazy (dynamic) import — see the file-top note. Rollup splits this into its own chunk,
  // keeping the overlay default lean. Adding one `await` here is behavior-preserving: the
  // paged boot is already async (it awaits the first onLayoutUpdated below).
  // @ts-ignore - vendored fork TS module (no ambient types for the barrel)
  const { PresentationEditor } = await import('@core/presentation-editor/index.js')
  const presentation = new (PresentationEditor as any)({
    element: mountEl,
    mode: 'docx',
    content: parsed.docx,
    mediaFiles: parsed.mediaFiles,
    fonts: parsed.fonts,
    // M4b: + ImageResize (a NodeSelection-driven handle overlay; positions via WC.PM.coords.nodeBoxFor, so
    // it tracks the PAINTED image). NOT Pagination — PE is the sole paginator (our Pagination would measure
    // the hidden host and inject spurious seams; ImageResize neither measures nor paginates).
    extensions: [...getStarterExtensions(), ImageResize],
    documentId: 'wc-paged-boot',
    documentMode: 'editing',
    user: { name: storedAuthorName(), email: '' },
    isDebug: false,
    telemetry: { enabled: false },
  })
  // Paint is automatic (the ctor schedules a rAF rerender). Await the FIRST layout before
  // returning so __WC_READY never races first paint. On reject, tear down to avoid an orphaned
  // hidden host + a live static-registry entry (the ctor appends/self-registers synchronously,
  // BEFORE this await, so the ctor's own try/catch can't clean up an async-layout failure).
  try {
    await new Promise<void>((resolve, reject) => {
      let done = false
      const finish = (fn: () => void) => {
        if (done) return
        done = true
        clearTimeout(timer)
        try { offUpdate?.() } catch {}
        try { offError?.() } catch {}
        fn()
      }
      const offUpdate = presentation.onLayoutUpdated?.(() => finish(resolve))
      const offError = presentation.onLayoutError?.((e: any) =>
        finish(() => reject(new Error('[PE layout] ' + (e?.error?.message ?? e?.message ?? String(e))))))
      const timer = setTimeout(() => finish(() => reject(new Error('[PE layout] first-paint timeout (15s)'))), 15000)
      if (!offUpdate) finish(() => reject(new Error('[PE layout] onLayoutUpdated missing — fork API drift')))
    })
  } catch (e) {
    try { presentation.destroy?.() } catch {}
    throw e
  }
  return { presentation, editor: presentation.editor }
}

export async function createPagedEditor(mountEl: HTMLElement, source: ArrayBuffer): Promise<PagedMount> {
  return constructPresentationEditor(mountEl, await parseDocx(source))
}
