# Tasks — 015 Font advanced effects

Derived from plan.md (P1 Caps → P2 Spacing+Position → P3 Scale). NO-FORK (spike-confirmed). Each effect ships TDD tests + the 4 gates + the Word-COM oracle. `[P]` = parallelizable.

## Setup / shared
- T001 Create the owned extension `src/renderer/extensions/advanced-font-effects.ts` — `Extension.create` with `addGlobalAttributes` declaring `smallCaps` (render `font-variant:small-caps`, parse from font-variant) and `w` (scale; best-effort render, parse) on `textStyle`. Model on `extensions/font-size/font-size.js`.
- T002 Wire it into `bridge/create-editor.ts`: `extensions: [...getStarterExtensions(), ImageResize, AdvancedFontEffects]`.
- T003 Bridge: add `setAdvancedFontEffects(patch)` (and/or the 5 discrete verbs) in `bridge/commands.ts`; export on `WC.PM`; clearing → `null`.
- T004 Oracle: `scripts/oracle/validate-fonteffects-win.ps1` reading Font.SmallCaps/AllCaps/Spacing/Position/Scaling (PID-safe). `scripts/paged-fonteffects-probe.js` + a `probe:fonteffects` npm script.

## P1 — Caps (Small Caps + All Caps)
- T101 [TDD] test:pm: All Caps via bridge → model `textTransform:'uppercase'` + export `<w:caps/>`; clear drops it.
- T102 [TDD] test:pm: Small Caps via bridge (owned attr) → model `smallCaps:true` + export `<w:smallCaps/>`; clear drops it.
- T103 Implement T001–T003 enough for caps; build; GREEN.
- T104 Dialog: `dialogs.js` D.font OK routes All/Small Caps through the chain (one undo step); remove the `notifyBlocked` for these; prefill the two checkboxes on open.
- T105 [TDD] test:pm: Font dialog OK with Small caps ticked → `<w:smallCaps/>`; reopen pre-checks it; no blocked toast.
- T106 COM: author caps fixture → validate-fonteffects → Font.SmallCaps/AllCaps = True.

## P2 — Spacing + Position
- T201 [TDD] test:pm: Char Spacing Expanded 2pt → `<w:spacing w:val="40"/>`; Condensed 1.5pt → `-30`; Normal clears.
- T202 [TDD] test:pm: Position Raised 3pt → `<w:position w:val="6"/>`; Lowered 2pt → `-4`; Normal clears; coexists with vertAlign.
- T203 Implement the two verbs (existing attrs) + dialog spinners wiring + prefill; build; GREEN.
- T204 COM: validate Font.Spacing=2, Font.Position=3.

## P3 — Character Scale
- T301 [TDD] test:pm: Scale 150 → `<w:w w:val="150"/>`; 100 clears.
- T302 Implement the `w` attr usage + dialog scale wiring + prefill; build; GREEN.
- T303 COM: validate Font.Scaling=150.

## Close-out
- T401 Remove the residual `notifyBlocked('Caps and Advanced font effects')` entirely (all 5 implemented).
- T402 Run 4 gates (test:pm/smoke/roundtrip/bundle) + probe:fonteffects + the COM oracle.
- T403 `/code-review` high; fix confirmed findings.
- T404 ff-merge `feature/015-font-effects` → main; push; checkpoint (plan-tracking).
