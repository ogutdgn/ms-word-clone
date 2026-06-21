# Contract — `WC.PM` header/footer bridge verbs

The bridge is the only document-write path. Existing verbs stay; new verbs are added in `bridge/header-footer.ts`
and merged onto `WC.PM` in `bridge/index.ts`. All route persistence through the headless story-runtime
(`resolveHeaderFooterSlotRuntime`). `section` defaults to 0 (single-section v1).

## Existing (preserve — FR-005 no-regress)

- `WC.PM.setHeaderText(text)` / `setFooterText(text)` — set primary/default variant plain text.
- `WC.PM.getHeaderText()` / `getFooterText()` — read primary/default variant text.

## New — P1 (entry/exit state)

- `WC.PM.enterHeaderFooter(region)` — `region` ∈ `{'header','footer'}`. Enters on-page editing of that region on
  the current page via the spike-chosen mechanism. Returns `true` on success. (May be a thin wrapper over the
  existing engine path; exact internals decided at the spike.)
- `WC.PM.closeHeaderFooter()` — exits header/footer editing, returns focus to the body. Returns `true`.
- `WC.PM.headerFooterState()` — returns `{ active:boolean, region?:'header'|'footer', page?:number }` for the
  contextual-tab activation signal (consumed by `state-sync.ts`).

## New — P2 (variants + structure options)

- `WC.PM.setHeaderText(text, opts?)` / `setFooterText(text, opts?)` — `opts.variant` ∈
  `{'default','first','even'}` (default `'default'`); `opts.section` (default 0). Extends the existing verbs
  backward-compatibly (no `opts` ⇒ default variant, section 0).
- `WC.PM.getHeaderText(opts?)` / `getFooterText(opts?)` — variant/section-aware read.
- `WC.PM.setDifferentFirstPage(on)` — writes/clears `sectPr/titlePg`. Returns `true`.
- `WC.PM.setDifferentOddEven(on)` — writes/clears `settings/evenAndOddHeaders`. Returns `true`.
- `WC.PM.getHeaderFooterOptions()` — `{ differentFirstPage:boolean, differentOddEven:boolean }`.

## New — P3 (page-number field)

- `WC.PM.insertPageNumber(opts)` — `opts.position` ∈ `{'top','bottom','current'}`. Inserts a real OOXML `PAGE`
  field into the target header (top) / footer (bottom) / current region. Returns `true`.
- `WC.PM.removePageNumbers(opts?)` — removes `PAGE` fields from the targeted header/footer (default: both).
  Returns `true`.

## Inactive-bridge fallbacks

All new verbs get no-op fallbacks on the inactive bridge (parity with the existing `index.ts:410` no-ops:
return `false` / empty), so calling them before the engine is ready is safe.

## Invariants

- Backward-compatible: no-`opts` calls behave exactly as today (default variant, section 0).
- Persistence is single-path (story-runtime); on-page repaint is triggered explicitly if the spike (Q3) shows a
  divergence.
- No fork edit required by these verbs (they use the existing runtime seam).
