# Research — Multi-column page layout (Columns)

## Decision 1 — Render + persist path: the public `sections.setColumns` seam (no fork edit)

**Decision**: drive columns through the fork's public Document API
`editor.doc.sections.setColumns({ count, gap, equalWidth, target })` (assemble-adapters.ts:513 →
`sectionsSetColumnsAdapter` → `writeSectPrColumns` → `sectPr/w:cols`), wrapped by a new owned bridge verb
`WC.PM.setColumns`. The paged PresentationEditor reads the section model and re-flows the painted text into
columns; the exporter emits `<w:cols>` from the same model.

**Rationale**: feasibility-probed (2026-06-21, real paged renderer) — `setColumns({count:2, gap:0.5,
equalWidth:true, target})` returned `{success:true}`, the painted lines moved to **2 distinct x-bands**
(401, 737 px) = two columns rendered live, and the export carried `<w:cols w:space="720" w:num="2"
w:equalWidth="1"/>`. No fork edit, one persistence path, already engine-rendered. Mirrors the 002 pattern
(public `sections.*` adapter + a thin `WC.PM` verb).

**Alternatives**: a bespoke CSS multi-column overlay (visual-only, wouldn't export / wouldn't match Word's
flow). Rejected — the engine already does real column flow.

## Decision 2 — Owned-layers wiring; reuse the existing Columns dropdown

**Decision**: all new logic in the owned bridge (`bridge/columns.ts`, `bridge/index.ts`) + `commands.js`
(rewire the existing `H.columns = columnsMenu`). The Columns dropdown already exists in `ribbon-data.js`
(from `raw-research.json`); un-defer `columns` in `ENGINE_READY` so dispatch reaches the handler. The "More
Columns" dialog reuses `WC.dialog`; the Column break item goes under the existing Breaks dropdown.

**Rationale**: matches 002 — keep logic in owned layers, preserve fork re-vendorability and the single
doc-write path. No generated-file hand-edits.

## Decision 3 — Incremental delivery by user story (P1 → P2 → P3)

**Decision**: P1 (One/Two/Three equal columns + export + oracle) is the MVP; then P2 (More Columns: count +
spacing + equal-width; Left/Right + line-between bounded by the spike); then P3 (column break). Each is its
own verify → `/code-review` → ff-merge-to-`main` → push cycle on `feature/columns-paged`.

**Rationale**: P1 is independently demonstrable and the prerequisite; incremental landing keeps each review
small and each merge low-risk (the 002 cadence).

## Decision 4 — Word-COM oracle: a new `validate-columns-win.ps1`

**Decision**: add `scripts/oracle/validate-columns-win.ps1` (PID-safe, `OpenAndRepair:=false`, enum
self-verify where applicable) reading `Sections(1).PageSetup.TextColumns`: `.Count`, `.EvenlySpaced`,
`.Spacing` (and per-column widths / `.LineBetween` for P2), invoked via `com-validate.js`. Wire a columns
doc + read-back into `test:roundtrip:paged`.

**Rationale**: the export must be **real-Word-validated**, not just XML-inspected — the project's fidelity
standard (001/002). XML inspection stays as the fast in-probe pre-check.

## SPIKE RESULTS — RESOLVED 2026-06-21 (2 throwaway probe rounds, real paged renderer) — ALL NO-FORK

- **Q1 UNEQUAL (Left/Right): owned `bodySectPr` write.** The public `sections.setColumns` input is only
  `{count, gap, equalWidth, target}` (no per-column array; a `columns[]` arg is rejected); `equalWidth:false`
  writes `w:equalWidth="0"` but NO `<w:col>` children (Word then auto-distributes equally). The NO-FORK path:
  after `setColumns`, find the `w:cols` element in `editor.converter.bodySectPr` and push `<w:col w:w=.. w:space=..>`
  children (widths computed from the text-column width) — the export carries them. (An owned converter write,
  the plan's flagged option; NOT a fork-source edit.)
- **Q2 LINE-BETWEEN (`w:sep`): owned `bodySectPr` write — clean + robust.** `setColumns` ignores a `sep`/
  `lineBetween` option (NO_OP). Writing `w:sep="1"` onto `converter.bodySectPr`'s `w:cols` → export
  `<w:cols … w:sep="1"/>`, and it **PERSISTS across a later `setColumns`** (which mutates the same element
  in-place, keeping the sep attr). Verified both rounds.
- **Q3 COLUMN BREAK: fully NO-FORK.** No public column-break command, BUT the `hardBreak` node already has a
  `lineBreakType` attr; `editor.commands.insertContent({ type:'hardBreak', attrs:{ lineBreakType:'column' } })`
  exports `<w:br w:type="column"/>`. Verified.

**Decision**: P2 ships count + spacing + equalWidth (public `setColumns`) + line-between + Left/Right unequal
(owned `bodySectPr` w:cols writes — `w:sep` / `<w:col>` children). P3 ships the column break via the hardBreak
`lineBreakType:'column'` insert. All NO-FORK (no edits under `src/renderer/core/superdoc-fork/`). The owned
`bodySectPr` write is confined to the columns bridge module and validated via the Word-COM oracle
(`TextColumns.LineBetween` / per-column `.Width`). In-app render of the separator LINE may be a paged-engine gap
(export + Word are correct) — recorded if so.

## (historical) SPIKE plan — Phase-0, real paged renderer (resolved above)

The MVP (P1) is feasibility-proven (Decision 1). Three open questions for P2/P3, resolved by a throwaway
spike (deleted before the P1 commit), recorded here:

### Q1 — Unequal columns (Left / Right)
`writeSectPrColumns` writes only `w:num`/`w:space`/`w:equalWidth` — NOT individual `<w:col w:w=.. w:space=..>`.
**Question**: can the Left/Right (unequal) layout be produced no-fork — via a `setColumns` option, an owned
post-export `sectPr` write, or `sections.setPageSetup`? **Decision rule**: if no no-fork path, P2 ships
equal-width + count + spacing; Left/Right degrade to an honest toast, recorded (NOT a fork edit, NOT faked).

### Q2 — Line between (`w:cols w:sep="1"`)
**Question**: is the column separator reachable no-fork (a `setColumns` flag or an owned attr write)?
**Decision rule**: same as Q1 — no-fork if possible, else an honest toast + record.

### Q3 — Column break (`w:br w:type="column"`)
The super-converter's `w:br` handler supports `w:type="column"`. **Question**: is there a public insert
(a break command, or `insertContent` of a column-break run/mark) reachable from the bridge no-fork — mirroring
`insertPageBreak`? **Decision rule**: probe the break insert + assert the painted text moves to the next
column + the export carries `w:type="column"`. Likely yes; if not, record as a bounded gap.

**What confirms each**: a probe sets the option / inserts the break in the real paged renderer, reads the
painted columns, and exports — the `.docx` carries the expected OOXML and (for the oracle) real Word reads it
back. Any unreachable sub-capability is recorded here + in plan.md Complexity Tracking, never faked.
