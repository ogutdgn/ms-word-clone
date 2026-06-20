# Data Model — Milestone 5 (paged export ↔ Word-COM-oracle parity)

M5 adds NO document-model entities (no `src/` change). It introduces test-infra concepts.

## KitchenSinkFixture (the consolidated paged doc)
- ONE doc edited in PAGED mode exercising every shared-model M4 construct: an **image** (inserted/resized), a
  **comment** + a **tracked change**, a **footnote** + an **endnote**, and a **header/footer** (the header edited via
  the paged story session where feasible). Seeded with DISTINCT marker text per construct so the read-back assertions
  are unambiguous (e.g. `M5HDR`, `M5FTNOTE`, `M5CMT`).
- Saved twice for the diff: `wc-paged-m5-kitchensink.docx` (paged) + `wc-overlay-m5-kitchensink.docx` (overlay, the
  SAME edit) → the normalized structural diff proves equality.

## InkFixtureSet (the focused multi-page ink)
- Multi-page paged doc with strokes drawn at: **(a)** a page-2+ float, **(b)** an inter-page-GAP-spanning stroke,
  **(c)** the TOP of page 2 (where `TextSelection.near` snapping is touchy). Saved as `wc-paged-m5-ink.docx`. Reuses
  `scripts/paged-ink-probe.js`'s draw+assert (page-local `posOffset` EMU on the correct page). Held to Word-VALID +
  correct-page, NOT a diff vs overlay (ink intentionally differs).

## SavedExportArtifact
- `{ filePath: 'C:/tmp/wc-paged-m5-<name>.docx', mode: 'paged'|'overlay', constructs: string[] }`. Written via
  `window.wordApi.saveBytes({filePath, bytes})` from `WC.PM.exportDocxBytes()`. Glob-cleaned (`C:/tmp/wc-*-m5-*.docx`)
  before each run.

## NormalizedDiffResult (shared-construct parity, tier 1)
- Unzip both .docx; for each XML part, MASK the non-deterministic fields (`w:rsid*`, revision ids, `w14:*` wordIds,
  any per-run allocator id) → canonicalize (sort parts + attributes) → compare. `{ equal: bool, deltas: [{part,
  diff}] }`. `equal:true` proves the paged export === overlay export of the same model edit (the guard against a
  silent PE-side model mutation). The exact mask set is derived from the **determinism check** (export one fixture
  twice in one mode + diff).

## ComValidateResult (Word-COM validation, both tiers)
- `com-validate(scriptName, docxPath) → { ok: bool, … }` — spawnSync `powershell -File scripts/oracle/<scriptName>
  <docxPath>` SANDBOX-DISABLED, parse JSON stdout. `validate-open-win.ps1` → `{ ok }` (opens with no repair, now
  `OpenAndRepair:=false`). `validate-comments/notes/headerfooter-win.ps1` → read-back values (Comments Count +
  Scope.Text catching `<scope-error>`; Footnotes/Endnotes Count + Item(1).Range.Text; Headers/Footers Range.Text).
- **`ok:true` is necessary, NOT sufficient** — always paired with the read-back==seeded assertion.

## State transitions (the gate run)
`glob-clean → spawn paged probe (save) → spawn overlay probe (save) → per .docx: com-validate(validate-open) ok:true
→ com-validate(per-construct) read-back==seeded → normalized diff (shared) equal | ink: open-ok + page-correct →
PASS/FAIL`. PID-safe (spawned WINWORD only); dev-box-only.
