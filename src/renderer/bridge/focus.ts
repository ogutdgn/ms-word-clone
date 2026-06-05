// Focus discipline (spec §5.1/§7.4). PRIMARY invariant: cmd()/chain() re-focus
// the view after dispatch (commands.ts). This capture-phase layer is the
// COSMETIC enhancement: chrome clicks shouldn't blur the view at all.
// Ribbon buttons already preventDefault per-element (ribbon.js:154/172/191/
// 270-271/281); this extends coverage to flyouts (appended to document.body —
// util.js), the tabstrip, statusbar buttons, and the QAT.
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
      if (t.closest('#ribbon, #tabstrip, #statusbar, .qat, .flyout')) e.preventDefault()
    },
    true,
  )
  // Combos/spinners take real focus — capture the PM selection on the way out
  // so withSelection() can restore it (used by comboCommit + dialogs).
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
}
