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
let installed = false // idempotent: installBridge re-runs on Open/New
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
  // (008: the overlay page-region margin-click caret handler was retired. The paged PresentationEditor's
  // EditorInputManager owns ALL clicks — painted-page, margin, and below-text — with correct per-page geometry.)
}
