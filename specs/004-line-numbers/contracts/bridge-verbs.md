# Contract — `WC.PM` line-numbers bridge verbs

New verbs in `bridge/line-numbers.ts`, merged onto `WC.PM` in `bridge/index.ts`. All route through the
public `editor.doc.sections.setLineNumbering` / `sections.get` — no fork edit. v1 = the single primary section.

## New — P1 (mode/export)

- `WC.PM.setLineNumbers(opts)` — `opts = { mode: 'none'|'continuous'|'newPage'|'newSection', countBy?, start?,
  distance? (inches) }`. `mode:'none'` ⇒ `setLineNumbering({enabled:false, target})` (drops `w:lnNumType`);
  any other mode ⇒ `setLineNumbering({enabled:true, restart:mode, countBy, start, distance, target})`. NO_OP
  (already in that state) counts as success. Returns `true`.
- `WC.PM.getLineNumbers()` — `{ active:boolean, mode, countBy, start, distance }` from
  `sections.get({address}).lineNumbering`. Drives the dropdown's active preset + the Options dialog defaults.

## New — P3 (per-paragraph suppress) — spike-gated

- `WC.PM.suppressLineNumbers(on?)` — sets/clears `pPr/w:suppressLineNumbers` on the current paragraph via the
  spike-chosen no-fork mechanism; toggles when `on` is omitted. Returns `true` on success; if no-fork is
  unreachable, the caller surfaces an honest toast (recorded). The Options-dialog start/count-by/distance go
  through `setLineNumbers` (already no-fork).

## Inactive-bridge fallbacks

`setLineNumbers`/`suppressLineNumbers` → `false`; `getLineNumbers` → `{ active:false, mode:'none', countBy:1,
start:1, distance:0.25 }`.

## Invariants

- Single document-write path (the section/paragraph API); model stays page-free.
- `setLineNumbers` is idempotent; `mode:'none'` cleanly removes `w:lnNumType` (no section corruption).
- No fork edit for P1; any P3 sub-capability needing one is recorded (plan.md Complexity Tracking).
- The render overlay (P2) is READ-ONLY w.r.t. the document (it paints from the DOM/model; never writes).
