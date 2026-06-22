# Contract — `WC.PM` columns bridge verbs

The bridge is the only document-write path. New verbs live in `bridge/columns.ts` and are merged onto
`WC.PM` in `bridge/index.ts`. All route through the public section API
(`editor.doc.sections.setColumns` / `sections.list`) — no fork edit. `section` is the single primary
section (v1).

## New — P1 (presets)

- `WC.PM.setColumns(opts)` — `opts = { count:number, gap?:number (inches), equalWidth?:boolean }`.
  Applies an equal-width N-column layout to section 0 via `sections.setColumns({count, gap*1440→twips,
  equalWidth, target})`. `count:1` normalizes to a single column. Returns `true` on success (NO_OP — already
  in that state — counts as success).
- `WC.PM.getColumns()` — `{ count:number, gap:number (inches), equalWidth:boolean, lineBetween?:boolean }`
  read from section 0's projection (`sections.get`/`list`). Drives the dropdown's active preset + the More
  Columns dialog defaults.

## New — P2 (customize) — bounded by the Phase-0 spike

- `WC.PM.setColumns(opts)` extended: `opts.lineBetween?:boolean` (separator) and `opts.columns?:Array<{width,
  space}>` (unequal, for Left/Right). Each is applied ONLY if the spike proves a no-fork path; otherwise the
  verb ignores that field and the caller surfaces an honest toast (recorded). Equal-width + count + spacing
  always work.

## New — P3 (column break)

- `WC.PM.insertColumnBreak()` — inserts a `w:br w:type="column"` at the caret (mirrors the page-break
  insert). Returns `true` on success. Reachability confirmed at the spike (Q3).

## Inactive-bridge fallbacks

All new verbs get no-op fallbacks on the inactive bridge (parity with `index.ts`): `setColumns`/
`insertColumnBreak` return `false`; `getColumns` returns `{ count:1, gap:0.5, equalWidth:true }`.

## Invariants

- Single document-write path (the section API); the model stays page-free (`w:cols` is a `sectPr` property,
  a column break is an inline run).
- `setColumns` is idempotent; `count:1` cleanly removes the multi-column setting (no section corruption).
- No fork edit required by the P1 verbs; any P2/P3 sub-capability that would require one is recorded (plan.md
  Complexity Tracking), not silently forked.
