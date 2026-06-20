# Phase 0 Research — Milestone 5 (paged export ↔ Word-COM-oracle parity)

Sourced from the **M5 understanding sweep** (3 parallel readers → synthesis → adversarial completeness critic;
code-grounded, file/line cited).

## Decision: the export is MODE-INDEPENDENT → M5 VALIDATES (does not change) it
- **Rationale (verified)**: `io.ts:16-21` `exportDocxBytes()` → `editor.exportDocx()`; `Editor.ts:3646-3656`
  `#prepareDocumentForExport` serializes ONLY `this.state.doc` via a Transform + `toJSON` (NO view/DOM/layout read);
  the bridge binds to `presentation.editor` = the SAME inner Editor (`create-editor.ts:127`, `index.ts:479`); PE does
  NOT override `exportDocx` (grep clean) and its internal dispatches are setSelection-only. So for an identical model,
  4 of 5 M4 constructs export identically; INK is the ONE intentional divergence.
- **Alternatives considered**: prove by static inspection only → REJECTED (the project lesson: exportXmlOnly +
  `test:roundtrip` BOTH miss Word-corruption). M5 proves it END-TO-END with real Word.

## Decision: `test:roundtrip` genuinely misses Word-corruption → M5 needs real Word COM
- **Rationale (verified)**: `test-roundtrip-pm.js` spawns `docx-inspect.js` (a JS unzip/XML inspector) + an Electron
  docx→PM→docx probe; it NEVER opens the file in Word. So a file can pass `test:roundtrip` yet trigger a Word repair.
  `window.wordAPI.saveBytes` (`main.js:357-365`) writes real export bytes to an absolute path — the probe→file
  primitive exists. The Word COM oracles (`scripts/oracle/*-win.ps1`) open real Word.

## Decision: build a Node → Word-COM bridge (THE new infra — not "primitive reuse")
- **Rationale (critic)**: NO existing Node driver spawns any `validate-*-win.ps1` — every reference in `scripts/*.js`
  is a comment/doc pointer; the 23 validate scripts are HAND-RUN per the runbook. So M5's Node→`spawnSync(powershell)`→
  Word-COM orchestration is brand-new: it must own sandbox-disable (Word COM HANGS at `New-Object` inside a sandbox),
  PID-safety (the validate-*-win.ps1 kill only the spawned WINWORD PID — never the user's window), STA/foreground
  sequencing, and JSON-stdout parsing. Ship a small REUSABLE `scripts/oracle/com-validate.js` so M6 reuses it.
- **Alternatives considered**: inline the spawn in the driver → REJECTED (M6 needs it too); use computer-use to drive
  Word → BLOCKED for the dev build (but PowerShell COM is NOT blocked).

## Decision: parity = TWO-TIER (normalized structural diff for shared; Word-valid+page for ink)
- **Rationale**: 4/5 constructs are model-shared → the strongest proof is the paged save EQUALS the overlay save of the
  same edit. But a LITERAL byte-diff is unachievable — `exportDocx` mints fresh revision ids per run
  (`Editor.ts #installWordIdAllocatorIfNeeded`), so even overlay-vs-overlay differs. → the shared-construct proof is a
  NORMALIZED structural diff: unzip both, mask `w:rsid*`/revision ids/wordIds, sort parts + attrs, compare. INK
  legitimately differs (re-anchored `insertPos` + page-local `posOffset`, `ink-overlay.ts:258-269` / `draw.ts:38-43` /
  `vector-shape.js:135-138`) → a naive ink diff FAILS by design; ink is held to Word-VALID (no repair) + correct page.
- **Verify FIRST**: export one fixture twice in one mode, diff the zips → confirm exactly which fields are
  non-deterministic, to drive the masking.

## Decision: HARDEN `validate-open-win.ps1` (`OpenAndRepair:=false`)
- **Rationale (critic)**: line 28 `Documents.Open($abs, $false, $true, $false)` passes only 4 positional args — the
  `OpenAndRepair` arg is OMITTED; the header comment claiming `OpenAndRepair:=false` is aspirational. So `ok:true`
  rests SOLELY on `DisplayAlerts=0` turning an INTERACTIVE repair prompt into a catchable error — a silent auto-repair
  returns `ok:true` (false green). → pass `OpenAndRepair:=false` (positional padding with `$missing`), AND always pair
  `ok:true` with the per-construct read-back (`ok:true` is necessary, NOT sufficient).

## Decision: validate a header EDITED VIA THE PAGED STORY SESSION
- **Rationale (critic)**: header/footer + footnotes are edited through SEPARATE story-session editors
  (`HeaderFooterSessionManager` / `StoryPresentationSessionManager`), NOT the main inner editor. The "same
  `convertedXml`" claim for a paged-SESSION edit was asserted, not traced. So M5 oracles a header edited via the paged
  session (where feasible) — not only a bridge `setHeaderText` — before declaring header parity.

## Decision: enumerate the ink corruption modes
- **Rationale (critic)**: `paged-ink-probe.js` asserts page-local EMU only for a fixed page-1 stroke. The Word-repair
  risks are: (a) a page-2+ float, (b) an inter-page-GAP-spanning stroke, (c) a top-of-page-2 stroke (where
  `TextSelection.near` may snap the anchor to the wrong page). M5's ink fixtures MUST include all three.

## Decision: HYBRID / local-only cadence
- **Rationale**: the gate's whole point is the real-Word save the headless gates miss → it needs real foreground Word
  (M365 dev box), sandbox-disabled; it CANNOT run in headless CI (Word COM hangs at `New-Object` in a sandbox). Ship
  `npm run test:roundtrip:paged`; run each milestone; document as dev-box-only / excluded from headless CI.

## Out of scope (documented)
- The pre-existing docx-REOPENED multi-page ink import gap (`customGeometry.inkPos` recovery — BOTH modes); no
  export→reopen leg in M5. M6 (glyph metrics) + the `layout-engine → main` endgame.
