// Focus discipline (spec §5.1/§7.4). PRIMARY invariant: cmd()/chain() re-focus
// the view after dispatch (commands.ts). This capture-phase layer is the
// COSMETIC enhancement: chrome clicks shouldn't blur the view at all.
// Ribbon buttons already preventDefault per-element (ribbon.js:154/172/191/
// 270-271/281); this extends coverage to flyouts (appended to document.body —
// util.js), the tabstrip, statusbar buttons, and the QAT.
//   • #ribbon, #tabstrip, #statusbar — structural chrome containers
//   • .flyout — dynamic menus appended to document.body (util.js)
//   • .qat — quick-access toolbar // note: .qat sits in the draggable titlebar — preventDefault narrows the drag region by the gaps between QAT buttons (accepted)
// Exemptions: anything text-entry-ish legitimately takes focus (combos,
// spinners, search field, zoom range slider, dialog inputs) — those instead get
// a focusin capture that snapshots the PM selection (spec §7.1-4: a blocked
// command must never cost the user their selection).
let installed = false // idempotent: replaceEditor() re-runs installBridge on Open/New
export function installFocusGuards() {
  if (installed) return
  installed = true
  document.addEventListener(
    'mousedown',
    (e) => {
      const t = e.target as Element | null
      if (!t || !(t instanceof Element)) return
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      if (t.closest('#ribbon, #tabstrip, #statusbar, .qat, .flyout')) {
        // A mousedown on a scrollbar gutter must keep its default (drag-to-scroll):
        // clientWidth/Height exclude scrollbars, so a hit beyond them is the gutter.
        if (t instanceof HTMLElement) {
          const r = t.getBoundingClientRect()
          const x = e.clientX - r.left
          const y = e.clientY - r.top
          if (x > t.clientLeft + t.clientWidth || y > t.clientTop + t.clientHeight) return
        }
        e.preventDefault()
      }
    },
    true,
  )
  // Combos/spinners take real focus — capture the PM selection on the way out
  // so withSelection() can restore it (used by comboCommit + dialogs).
  // safe while dialogs contain no .rcombo/.rspinner (captureSelection would double-fire)
  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target as Element | null
      if (t instanceof Element && t.closest('.rcombo, .rspinner')) {
        ;(window as any).WC?.PM?.captureSelection?.()
      }
    },
    true,
  )
  // Page-region click → place the caret (Word: clicking the page MARGINS or the
  // empty area below the last paragraph drops the caret at the nearest text). The
  // page sheet `#pm-editor` realizes the margins as padding (fork print-layout
  // inline styles) and the editable `.ProseMirror` only covers the content box, so
  // those regions are non-editable: a bare click there places NO caret and blurs
  // the view (the user's "can't re-activate the cursor"). Bubble-phase, PM-only;
  // reads the LIVE editor so it survives replaceEditor (the listener binds once).
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return // left only — right-click keeps the context menu
    const t = e.target as Element | null
    if (!(t instanceof Element)) return
    const w = window as any
    if (!w.WC?.PM?.active) return
    if (!t.closest('#pm-editor')) return // not on the page sheet
    if (t.closest('.ProseMirror')) return // editable content handles its own clicks
    const editor = w.WC?.editor
    const view = editor?.view
    if (!view) return
    const max = view.state.doc.content.size - 1
    if (max < 1) return
    // CLAMP the click into the .ProseMirror content box, THEN hit-test: a click
    // below the (possibly short) content maps to the last row, a left-margin click
    // to the line start, a top-margin click to the first row. Clamping beats a
    // null-fallback heuristic — a short doc sits at the TOP of a tall page, so a
    // click "below the text" is still in the page's upper half (the heuristic's blind spot).
    const prose = (t.closest('#pm-editor') as HTMLElement).querySelector('.ProseMirror') as HTMLElement | null
    const box = (prose || (t.closest('#pm-editor') as HTMLElement)).getBoundingClientRect()
    const clamp = (val: number, lo: number, hi: number) => Math.max(lo, Math.min(val, hi))
    const x = clamp(e.clientX, box.left + 1, box.right - 1)
    const y = clamp(e.clientY, box.top + 1, box.bottom - 1)
    const hit = view.posAtCoords({ left: x, top: y })
    const pos = Math.max(1, Math.min(hit ? hit.pos : max, max))
    editor.commands.setTextSelection({ from: pos, to: pos })
    view.focus()
    e.preventDefault() // keep our caret — the browser's own mousedown would clear it
  })
}
