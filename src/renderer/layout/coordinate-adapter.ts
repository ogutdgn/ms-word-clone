// Shared per-page coordinate adapter — Milestone 1 of the paged-render migration.
//
// The single seam for client(viewport)↔model coordinate mapping and page enumeration
// across BOTH renderers (overlay = the shipping decoration engine; paged = the vendored
// PresentationEditor). Installed at `WC.PM.coords`. Later milestones route their consumers
// (M2 margin-click caret, M3 status-bar page count, M4 the 6 overlays) THROUGH this instead
// of calling `editor.view.*` directly — which is exactly the latent paged-mode bug today.
//
// Why this is thin: the vendored Editor ALREADY branches by mode —
//   • `Editor.posAtCoords` → `presentationEditor.hitTest` else `view.posAtCoords`  (Editor.ts:2102)
//   • `Editor.coordsAtPos` → `presentationEditor.coordsAtPos` else `view.coordsAtPos` (Editor.ts:2053)
//   • `Editor.currentTotalPages` → `presentationEditor.getPages().length`            (Editor.ts:642)
// and the PresentationEditor wires the inner editor's back-reference
// (`#editor.presentationEditor = this`, PresentationEditor.ts:933). Our bridge binds to that
// inner editor, so the CORE methods are mode-agnostic delegations to `editor.*` (NOT
// `editor.view.*`). In overlay mode `presentationEditor` is null → the same calls resolve
// against the live `view`. One call site, correct in both modes.
//
// See specs/001-paged-render-migration/contracts/coordinate-adapter.md.

export interface PositionHit {
  pos: number
  inside: number
}

export interface ClientRect {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface PageInfo {
  index: number
  size?: { w: number; h: number }
  margins?: unknown
}

// Lazy getters so the adapter survives `replaceEditor` (Open/New) remounts: it holds no
// editor reference, it reads through these every call.
export interface CoordinateAdapterDeps {
  getEditor(): any | null
  getPresentation(): any | null
  getOverlayPageCount(): number
}

export interface CoordinateAdapter {
  /** Client(viewport) coords → model position. overlay: view.posAtCoords; paged: PE.hitTest (painted). */
  clientToPos(clientX: number, clientY: number): PositionHit | null
  /** Model position → viewport-space caret/selection rect. overlay: view.coordsAtPos; paged: PE.coordsAtPos. */
  posToClientRect(pos: number): ClientRect | null
  /** Total page count. paged: editor.currentTotalPages; overlay: getOverlayPageCount(). */
  getPageCount(): number
  /** Enumerate pages. paged: presentation.getPages() (real Layout pages); overlay: length-only shim. */
  getPages(): PageInfo[]
}

// ─── M4-DEFERRED (documented, NOT implemented in M1) ─────────────────────────────────────
// The per-annotation specialty helpers that encapsulate the viewport→overlay-local (page-
// relative, zoom-divided) math the 6 overlays currently each duplicate. M4 ADDS + TESTS each
// when it rewires its overlay; M1 ships none of them. Listed here only so M2/M3 consumers
// know the seam will grow here (do NOT implement in M1):
//   posToOverlayLocalY(pos)            ← replaces bridge/comments-ui.ts localY()
//   posToOverlayLocalRect(pos)         ← replaces bridge/track-chrome.ts localRect()
//   nodeBoxFor(pos)                    ← replaces imageresize/image-resize.ts boxFor()
//   clientToOverlayLocalPt(x, y)       ← replaces bridge/ink-overlay.ts localPt()
// ─────────────────────────────────────────────────────────────────────────────────────────

export function createCoordinateAdapter(deps: CoordinateAdapterDeps): CoordinateAdapter {
  // Local (not a method) so it never depends on `this` — safe under destructuring.
  const pageCount = (): number => {
    try {
      const editor = deps.getEditor()
      const paged = editor ? editor.currentTotalPages : undefined
      if (typeof paged === 'number' && paged > 0) return paged
    } catch {
      /* fall through to overlay count */
    }
    try {
      const n = deps.getOverlayPageCount()
      return typeof n === 'number' && n > 0 ? n : 1
    } catch {
      return 1
    }
  }

  return {
    clientToPos(clientX: number, clientY: number): PositionHit | null {
      try {
        const editor = deps.getEditor()
        if (!editor || typeof editor.posAtCoords !== 'function') return null
        // Editor.posAtCoords branches on `presentationEditor` — and the two branches need
        // DIFFERENT coordinate keys:
        //  • layout (paged) → presentationEditor.hitTest(clientX, clientY). On a MISS it
        //    falls through to the HIDDEN off-screen view.posAtCoords(coords); passing
        //    {left,top} there maps a viewport point into the off-screen host and returns a
        //    BOGUS pos. So in layout mode pass clientX/clientY ONLY → a miss yields null
        //    (the off-screen view cannot resolve undefined left/top).
        //  • overlay → view.posAtCoords(coords), which REQUIRES {left,top}; supplying them
        //    keeps the result byte-identical to the direct view.posAtCoords({left,top}) today.
        const layout = !!editor.presentationEditor
        const coords = layout ? { clientX, clientY } : { clientX, clientY, left: clientX, top: clientY }
        const hit = editor.posAtCoords(coords)
        if (!hit || typeof hit.pos !== 'number') return null
        return { pos: hit.pos, inside: typeof hit.inside === 'number' ? hit.inside : -1 }
      } catch {
        return null
      }
    },

    // NOTE: does NOT clamp `pos` — callers clamp to [1, doc.content.size] exactly as today,
    // so behavior is byte-identical to the direct `view.coordsAtPos` call this replaces.
    posToClientRect(pos: number): ClientRect | null {
      try {
        const editor = deps.getEditor()
        if (!editor || typeof editor.coordsAtPos !== 'function') return null
        const r = editor.coordsAtPos(pos)
        // Guard the four edges: PM rects omit width/height (we derive them), but a degenerate
        // rect with a non-finite edge must surface as null, not a NaN-bearing ClientRect.
        if (!r || ![r.top, r.bottom, r.left, r.right].every((n: number) => Number.isFinite(n))) return null
        const width = typeof r.width === 'number' ? r.width : r.right - r.left
        const height = typeof r.height === 'number' ? r.height : r.bottom - r.top
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width, height }
      } catch {
        return null
      }
    },

    getPageCount: pageCount,

    getPages(): PageInfo[] {
      try {
        const pe = deps.getPresentation()
        if (pe && typeof pe.getPages === 'function') {
          const pages = pe.getPages()
          if (Array.isArray(pages)) {
            return pages.map((p: any, index: number) => ({
              index,
              size: p && p.size ? { w: p.size.w, h: p.size.h } : undefined,
              margins: p ? p.margins : undefined,
            }))
          }
        }
      } catch {
        /* fall through to overlay shim */
      }
      // overlay (or PE absent / pre-layout): length-only shim from the page count.
      const n = pageCount()
      const out: PageInfo[] = []
      for (let i = 0; i < n; i++) out.push({ index: i })
      return out
    },
  }
}
