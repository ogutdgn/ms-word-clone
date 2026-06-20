---
description: "Task list — Milestone 5 (paged export ↔ Word-COM-oracle parity)"
---

# Tasks: Paged Render Migration — **Milestone 5** (paged export ↔ Word-COM-oracle parity)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/m5-com-gate.md](contracts/m5-com-gate.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format
- **M5 ONLY** — prove the paged-mode `.docx` export is Word-valid + equivalent to overlay, end-to-end against real
  Word COM. **Dev-box-only** test infra: **NO `src/` change, NO fork edits.** M6 + the →main endgame out of scope.
- TWO-TIER parity (normalized structural diff for the 4 shared constructs + Word-valid/page-correct for ink);
  CONSOLIDATED kitchen-sink + focused multi-page ink. All tasks Setup/Foundational/Verification/Polish → **no `[US#]`**.
- `[P]` = parallelizable (different file, no incomplete-task dependency). **Word COM spawns run SANDBOX-DISABLED**
  (Word hangs at `New-Object` in a sandbox) and **PID-safe** (only the spawned WINWORD dies — never the user's window).

---

## Phase 1: Setup
- [ ] T001 Confirm on slice branch `slice/m5-paged-export-oracle` (off `layout-engine`; NEVER off/onto `main`). `git branch --show-current` before any edit. (M4d specs already archived to `milestones/m4d/`.)

---

## Phase 2: Probe-FIRST spike (the NOVEL surface — do BEFORE building the gate)
- [ ] T002 Write a throwaway `scripts/m5-spike.js` (Node) + run it to PIN, with evidence: **(1)** the Node→Word-COM bridge — `spawnSync('powershell.exe', ['-NonInteractive','-File','scripts/oracle/validate-open-win.ps1', <abs path to a KNOWN-GOOD .docx>])` **SANDBOX-DISABLED**, parse the last JSON object on stdout, assert `ok===true`; CONFIRM PID-safety (capture WINWORD PIDs before/after — only the spawned one dies, the user's Word window survives) AND that the same spawn HANGS when sandboxed (justifying the dangerouslyDisableSandbox path). **(2)** the DETERMINISM check — drive a tiny paged-export probe to `exportDocxBytes` + `wordApi.saveBytes` the SAME fixture TWICE in ONE mode (overlay) → unzip both + diff → RECORD exactly which fields differ run-to-run (`w:rsid*`, revision ids, `w14:*` wordIds, part/attr ordering) → this is the normalization MASK set. **(3)** confirm `window.wordApi.saveBytes({filePath:'C:/tmp/…', bytes})` writes the bytes to the absolute path. **Record (1)/(2)/(3)** — they steer T004 (helper), T006 (driver diff mask), T003 (sandbox handling). *(depends on T001)*

**Checkpoint**: the Node→COM bridge works sandbox-disabled + PID-safe; the determinism mask set is known.

---

## Phase 3: Foundational — the oracle harden + the reusable helper
- [ ] T003 HARDEN `scripts/oracle/validate-open-win.ps1`: change `Documents.Open($abs, $false, $true, $false)` to explicitly pass `OpenAndRepair:=false` (positional padding with `$missing`/`[Type]::Missing` for the intervening optional args: `Documents.Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles, PasswordDocument, …, Format, …, OpenAndRepair)`) so a SILENT auto-repair surfaces as NOT-ok (today `ok:true` rests only on `DisplayAlerts=0` catching an INTERACTIVE prompt). Keep `DisplayAlerts=0` + the spawned-PID-only kill + the `{ok,…}` JSON contract. (OUR oracle script — NOT the fork.) *(depends on T002)*
- [ ] T004 [P] Create `scripts/oracle/com-validate.js` (reusable): `comValidate(scriptName, docxAbsPath, extraArgs?) → { ok, raw, json }` — `spawnSync('powershell.exe', ['-NonInteractive','-File','scripts/oracle/'+scriptName, docxAbsPath, ...extra])` (the DRIVER invokes the gate sandbox-disabled); parse the LAST JSON object on stdout; `ok = !!(json && json.ok === true)`; NEVER throw on non-zero exit (return `{ok:false, raw}`). No `GetActiveObject` path — PID-safety relies on each `validate-*-win.ps1`'s spawned-PID kill. *(depends on T002)*

---

## Phase 4: The paged-export probe + the kitchen-sink/ink fixtures
- [ ] T005 Create `scripts/paged-export-m5-probe.js` (mode-aware renderer probe; model on `scripts/oracle-probe-headerfooter.js` + `scripts/paged-headerfooter-probe.js`): confirm `window.__WC_LAYOUT_MODE`; edit the KITCHEN-SINK fixture — an image, a comment, a tracked change, a footnote, an endnote, and a header/footer (the HEADER edited via the PAGED STORY SESSION where a public path exists, else `WC.PM.setHeaderText`) — each with DISTINCT marker text (`M5HDR`/`M5FTR`/`M5FTNOTE`/`M5ENOTE`/`M5CMT`/`M5TRK`); pre-save SANITY that each marker is in the model; then `const bytes = await window.WC.PM.exportDocxBytes(); await window.wordApi.saveBytes({ filePath: 'C:/tmp/wc-'+mode+'-m5-kitchensink.docx', bytes })`. Return `{summary,results[]}`. *(depends on T001)*
- [ ] T006 [P] Create the MULTI-PAGE ink fixture path — either extend `scripts/paged-ink-probe.js`'s draw+assert (reuse, do not duplicate) or a small `scripts/paged-export-m5-ink-probe.js` — drawing strokes at (a) a page-2+ float, (b) an inter-page-GAP-spanning stroke, (c) the TOP of page 2 (`TextSelection.near` snapping), asserting page-local `posOffset` EMU on the correct page, then `wordApi.saveBytes('C:/tmp/wc-paged-m5-ink.docx')`. *(depends on T001)*

---

## Phase 5: The driver + the gate wiring
- [ ] T007 Create `scripts/test-roundtrip-paged.js` (Node driver; model on `scripts/test-roundtrip-pm.js`): **(1)** glob-CLEAN `C:/tmp/wc-*-m5-*.docx`. **(2)** spawn `WC_LAYOUT=paged` + `WC_LAYOUT=overlay` runs of `paged-export-m5-probe.js` (kitchen-sink) + the `WC_LAYOUT=paged` ink-fixture run — all SANDBOX-DISABLED for the powershell legs. **(3)** per saved .docx → `comValidate('validate-open-win.ps1', docx)` assert `ok===true` (CORE: opens with no repair). **(4)** read-back: `comValidate('validate-comments-win.ps1'|'validate-notes-win.ps1'|'validate-headerfooter-win.ps1', pagedDocx)` assert read-back == the seeded markers (catch the `<scope-error>` sentinel). **(5)** SHARED constructs: `normalizedDiff(pagedKitchenSink, overlayKitchenSink)` — unzip both, MASK the T002 determinism fields, sort parts+attrs, assert EQUAL. **(6)** INK: `validate-open` `ok:true` + the page-local `posOffset` on the correct page (NOT a diff). Emit `{summary,results[]}`; **non-zero exit on any fail**. *(depends on T003, T004, T005, T006)*
- [ ] T008 Add `test:roundtrip:paged` (`node scripts/test-roundtrip-paged.js`) to `package.json`. **SEPARATE** gate — do NOT touch `test:roundtrip`'s overlay count pins (27). *(depends on T007)*

---

## Phase 6: VERIFY loop + close-out
- [ ] T009 `npm run build` clean; the 4 existing gates STAY GREEN (no `src/` change): `test:pm` (475), `test:smoke` (9), `test:roundtrip` (27), `test:bundle` (4). *(depends on T003–T008)*
- [ ] T010 Run `npm run test:roundtrip:paged` on the Windows dev box **SANDBOX-DISABLED** → ALL-PASS: kitchen-sink → `validate-open` `ok:true` (now `OpenAndRepair:=false`) + comments/notes/header-footer read-back==seeded + the paged-vs-overlay NORMALIZED diff EQUAL for the 4 shared constructs; multi-page ink (page-2+, gap-spanning, top-of-page-2) → `validate-open` `ok:true` + page-local `posOffset` on the correct page. CONFIRM PID-safety (the user's Word window untouched). Delete `scripts/m5-spike.js`. *(depends on T009)*
- [ ] T011 Run **`/code-review`** on the slice diff (adversarial; scrutinize the Node→COM bridge — sandbox-disable, PID-safety, JSON-stdout parsing, never-throw; and the diff MASKING for false-confidence — a too-aggressive mask HIDES a real divergence). FIX every finding, then re-run T009–T010 until clean. *(depends on T009–T010)*
- [ ] T012 Commit per `.claude/skills/commit-style` (explicit `git add <path>`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M5 done; document `test:roundtrip:paged` is **dev-box-only / not headless CI**; NEXT = M6) + memory. **At CHECK-IN, only after the user is satisfied:** ff-merge `slice/m5-paged-export-oracle` into `layout-engine`. *(depends on T011)*

---

## Dependencies & execution order
- **T001 → all. T002 (spike) → T003/T004/T006.** **T003+T004+T005+T006 → T007 → T008.** **Verify**: T009 → T010 → T011 → T012.
- COM-oracle: M5 IS the COM-oracle milestone (real Word). PID-safe; sandbox-disabled; dev-box-only.

## Parallel opportunities
- T004 (com-validate helper) ∥ T003 (validate-open harden) — different files. T005 (kitchen-sink probe) ∥ T006 (ink fixture) — different files.

## MVP / increment
"Done" = T009 green (existing gates flat) + T010 all-pass (the new paged COM gate) + T011 clean + T012 merged → STOP. Return to the runbook for **M6** (glyph-metric tolerance vs the COM oracle), then the `layout-engine → main` endgame.

## Notes
- NO `src/` change; NO fork edits; the doc model stays page-free (M5 VALIDATES it). All new files are `scripts/`.
- `validate-open` `ok:true` is NECESSARY-not-sufficient — ALWAYS paired with a per-construct read-back.
- The gate needs real foreground Word — run via the dangerouslyDisableSandbox path for the powershell COM spawns; it can NOT run in headless CI. OUT OF SCOPE: the docx-REOPENED multi-page ink import gap (no export→reopen leg).
