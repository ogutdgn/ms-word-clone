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
  // The overlay decoration-paginator's live object (`WC.PM.__pagination`) — its `breaks` drive the
  // overlay current-page scan in getCurrentPage(). null in paged mode (PE owns the count there).
  getOverlayPagination(): { breaks?: Array<{ pos: number; pages?: number }> } | null
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
  /** 1-based current page of the caret. paged: PE.computeCaretLayoutRect(caret).pageIndex+1; overlay: __pagination break-scan. */
  getCurrentPage(): number
  /** 0-based page index of a model pos (paged: PE.computeCaretLayoutRect(pos).pageIndex). -1 if unknown/overlay. (018 — Go To Page) */
  pageIndexOfPos(pos: number): number
  /** Model pos → {top,bottom,left} in #pages-local space (page-relative, zoom-divided). null off-page/hidden run. (M4a — track-chrome) */
  posToOverlayLocalRect(pos: number): { top: number; bottom: number; left: number } | null
  /** Model pos → top in #pages-local space. null off-page. (M4a — comments-ui) */
  posToOverlayLocalY(pos: number): number | null
  /** Image-node box in #pages-local space. null off-page / no element. (M4b — image-resize) */
  nodeBoxFor(pos: number): { left: number; top: number; width: number; height: number } | null
  /** Rendered #pages scale (rect.width/offsetWidth, = WC.PM.zoom today). One scale source for overlays. (M4b) */
  overlayScale(): number
  /** Client(viewport) pt → #pages-local pt + the painted page under the pointer. null over a gap/off-page. (M4c — ink) */
  clientToOverlayLocalPt(clientX: number, clientY: number): { x: number; y: number; pageIndex: number } | null
  /** Painted .superdoc-page[data-page-index] box in #pages-local space. null overlay/virtualized. (M4c — ink page origin) */
  overlayPageBox(pageIndex: number): { left: number; top: number; width: number; height: number } | null
}

// ─── M4 overlay-local helpers — all implemented in the interface above ───────────────────
// The per-overlay specialty helpers that encapsulate the viewport↔overlay-local (page-relative,
// zoom-divided) math the overlays previously each duplicated. Each was added + tested when its
// milestone rewired its overlay onto the painted pages:
//   posToOverlayLocalY(pos)            ← comments-ui.ts localY()        [M4a]
//   posToOverlayLocalRect(pos)         ← track-chrome.ts localRect()   [M4a]
//   nodeBoxFor(pos)                    ← image-resize.ts boxFor()      [M4b]
//   clientToOverlayLocalPt(x, y)       ← ink-overlay.ts draw-page res. [M4c] (+ overlayPageBox)
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

  // Model pos → viewport-space rect (painted-aware in paged via editor.coordsAtPos; view rect in overlay).
  // The body of posToClientRect, extracted so the overlay-local helpers (M4a) reuse it without `this`.
  const clientRectOf = (pos: number): ClientRect | null => {
    try {
      const editor = deps.getEditor()
      if (!editor || typeof editor.coordsAtPos !== 'function') return null
      const r = editor.coordsAtPos(pos)
      if (!r || ![r.top, r.bottom, r.left, r.right].every((n: number) => Number.isFinite(n))) return null
      const width = typeof r.width === 'number' ? r.width : r.right - r.left
      const height = typeof r.height === 'number' ? r.height : r.bottom - r.top
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width, height }
    } catch {
      return null
    }
  }
  // Clamp a pos to [1, doc.content.size] exactly as the legacy localY/localRect did before coordsAtPos.
  const clampPos = (pos: number): number => {
    const editor = deps.getEditor()
    if (!editor) return pos
    let max: number | undefined
    try { max = editor.view.state.doc.content.size } catch { max = undefined }
    return typeof max === 'number' ? Math.max(1, Math.min(pos, max)) : pos
  }
  // The #pages overlay container + its rendered scale (= zoom in both modes: #pages' own transform ratio).
  const pagesScale = (): { r: DOMRect; scale: number } | null => {
    const pages = document.getElementById('pages')
    if (!pages) return null
    const r = pages.getBoundingClientRect()
    const scale = pages.offsetWidth ? r.width / pages.offsetWidth : 1
    return { r, scale: scale || 1 }
  }

  return {
    clientToPos(clientX: number, clientY: number): PositionHit | null {
      try {
        const editor = deps.getEditor()
        if (!editor || typeof editor.posAtCoords !== 'function') return null
        // Editor.posAtCoords → presentationEditor.hitTest(clientX, clientY). Pass clientX/clientY ONLY: on a
        // MISS it falls through to the HIDDEN off-screen view.posAtCoords, where supplying {left,top} would map
        // the viewport point into the off-screen host and return a BOGUS pos — so a miss must yield null.
        const hit = editor.posAtCoords({ clientX, clientY })
        if (!hit || typeof hit.pos !== 'number') return null
        return { pos: hit.pos, inside: typeof hit.inside === 'number' ? hit.inside : -1 }
      } catch {
        return null
      }
    },

    // Model position → viewport-space caret/selection rect (overlay: view.coordsAtPos; paged: PE.coordsAtPos).
    // Does NOT clamp `pos` — callers clamp; byte-identical to the direct view.coordsAtPos call it replaces.
    // (A degenerate non-finite rect surfaces as null, not a NaN-bearing ClientRect.) Body in clientRectOf.
    posToClientRect: clientRectOf,

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

    getCurrentPage(): number {
      try {
        const editor = deps.getEditor()
        if (!editor) return 1
        let caret = 1
        try { caret = editor.view.state.selection.from } catch { caret = 1 }
        const pe = deps.getPresentation()
        if (pe && typeof pe.computeCaretLayoutRect === 'function') {
          // paged: PE owns the caret→page mapping (DOM-first, geometry fallback).
          const r = pe.computeCaretLayoutRect(caret)
          return r && Number.isFinite(r.pageIndex) ? r.pageIndex + 1 : 1
        }
        // overlay: sheets advanced by the seams at/above the caret + 1 — VERBATIM from the legacy
        // statusbar.js:70 break-scan (a blank page is ONE seam spanning two boundaries → pages>1).
        const pg = deps.getOverlayPagination()
        const breaks = (pg && pg.breaks) || []
        return breaks.filter((b) => b.pos <= caret).reduce((a, b) => a + (b.pages || 1), 0) + 1
      } catch {
        return 1
      }
    },

    // 018 (Go To Page) — 0-based layout page index of a model pos. Paged: the PE owns the pos→page mapping
    // (DOM-first, geometry fallback), the same source getCurrentPage uses for the caret. Returns -1 when the
    // mapping isn't available (overlay / pre-layout / off-page) so the caller can skip rather than mis-jump.
    pageIndexOfPos(pos: number): number {
      try {
        const pe = deps.getPresentation()
        if (pe && typeof pe.computeCaretLayoutRect === 'function') {
          const r = pe.computeCaretLayoutRect(pos)
          return r && Number.isFinite(r.pageIndex) ? r.pageIndex : -1
        }
      } catch {
        /* unavailable → -1 */
      }
      return -1
    },

    // M4a — VERBATIM port of comments-ui.ts:125-136 localY (#pages-local Y of a model pos), with the only
    // change being view.coordsAtPos → clientRectOf (painted-aware in paged; identical in overlay).
    posToOverlayLocalY(pos: number): number | null {
      try {
        const c = clientRectOf(clampPos(pos))
        if (!c) return null
        const ps = pagesScale()
        if (!ps) return null
        return (c.top - ps.r.top) / ps.scale
      } catch {
        return null
      }
    },

    // M4a — VERBATIM port of track-chrome.ts:91-106 localRect ({top,bottom,left} in #pages-local space),
    // including the "zero viewport rect → null" hidden-run guard. Same coordsAtPos → clientRectOf swap.
    posToOverlayLocalRect(pos: number): { top: number; bottom: number; left: number } | null {
      try {
        const c = clientRectOf(clampPos(pos))
        if (!c || (c.top === 0 && c.bottom === 0)) return null // hidden/unlaid-out run
        const ps = pagesScale()
        if (!ps) return null
        return { top: (c.top - ps.r.top) / ps.scale, bottom: (c.bottom - ps.r.top) / ps.scale, left: (c.left - ps.r.left) / ps.scale }
      } catch {
        return null
      }
    },

    // M4b — the selected image's box in #pages-local space. The element source is the PE's painted image:
    // editor.getElementAtPos(pos) ([data-pm-start][data-pm-end] index → the PAINTED image; null off-page).
    // Then the same #pages-local formula as the M4a overlay helpers.
    nodeBoxFor(pos: number): { left: number; top: number; width: number; height: number } | null {
      try {
        const editor = deps.getEditor()
        if (!editor || typeof editor.getElementAtPos !== 'function') return null
        let el: any = null
        try { el = editor.getElementAtPos(pos) } catch { el = null }
        if (!el || typeof el.getBoundingClientRect !== 'function') return null
        const c = el.getBoundingClientRect()
        if (![c.left, c.top, c.width, c.height].every((n: number) => Number.isFinite(n))) return null
        const ps = pagesScale()
        if (!ps) return null
        return { left: (c.left - ps.r.left) / ps.scale, top: (c.top - ps.r.top) / ps.scale, width: c.width / ps.scale, height: c.height / ps.scale }
      } catch {
        return null
      }
    },

    // M4b — the rendered #pages scale (= WC.PM.zoom today, since #pages carries the only zoom transform and
    // PE's internal zoom stays 1). ONE scale source for image-resize handle positioning AND drag deltas.
    // No #pages (pre-mount/teardown) → fall back to the WC.PM zoom global, NOT 1 (a drag delta divided by 1
    // would be wrongly unscaled at non-100% zoom).
    overlayScale(): number {
      const ps = pagesScale()
      return ps ? ps.scale : (((window as any).WC?.PM?.zoom as number) || 1)
    },

    // M4c (ink) — viewport pt → #pages-local pt (the inverse of the M4a/M4b mapping) + WHICH painted page the
    // pointer is over. In paged the .superdoc-page[data-page-index] sheets exist → containment scan; null over an
    // inter-page gap / off-page. In overlay there are no painted sheets → pageIndex 0 (single continuous sheet).
    // Used at ink onDown to resolve the draw page (the stroke is then clamped to it).
    clientToOverlayLocalPt(clientX: number, clientY: number): { x: number; y: number; pageIndex: number } | null {
      try {
        const ps = pagesScale()
        if (!ps) return null
        const x = (clientX - ps.r.left) / ps.scale
        const y = (clientY - ps.r.top) / ps.scale
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        let pageIndex = 0
        const pagesEl = document.getElementById('pages')
        const sheets = pagesEl ? pagesEl.querySelectorAll('.superdoc-page[data-page-index]') : null
        if (sheets && sheets.length) {
          pageIndex = -1
          for (const el of Array.from(sheets)) {
            const b = (el as HTMLElement).getBoundingClientRect()
            if (clientX >= b.left && clientX <= b.right && clientY >= b.top && clientY <= b.bottom) {
              const idx = parseInt((el as HTMLElement).getAttribute('data-page-index') || '', 10)
              if (Number.isFinite(idx)) { pageIndex = idx; break }
            }
          }
          if (pageIndex < 0) return null // over an inter-page gap / off every painted page
        }
        return { x, y, pageIndex }
      } catch {
        return null
      }
    },

    // M4c (ink) — the painted page's #pages-local box (origin + size), same formula as nodeBoxFor. renderInk
    // offsets each committed (page-local) stroke onto its page origin; onUp subtracts it to persist page-local.
    // Overlay (no painted sheets) → null; paged page 0 → {left:0,top:0,...}. null for a virtualized/missing page.
    overlayPageBox(pageIndex: number): { left: number; top: number; width: number; height: number } | null {
      try {
        const pagesEl = document.getElementById('pages')
        if (!pagesEl) return null
        const el = pagesEl.querySelector('.superdoc-page[data-page-index="' + pageIndex + '"]') as HTMLElement | null
        if (!el || typeof el.getBoundingClientRect !== 'function') return null
        const c = el.getBoundingClientRect()
        if (![c.left, c.top, c.width, c.height].every((n: number) => Number.isFinite(n))) return null
        const ps = pagesScale()
        if (!ps) return null
        return { left: (c.left - ps.r.left) / ps.scale, top: (c.top - ps.r.top) / ps.scale, width: c.width / ps.scale, height: c.height / ps.scale }
      } catch {
        return null
      }
    },
  }
}
