# Implementation Plan: Paged Render Migration — **Milestone 5** (paged export ↔ Word-COM-oracle parity)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 5**
**Branch (slice)**: `slice/m5-paged-export-oracle` (off `layout-engine`) · **Date**: 2026-06-20
**Spec**: [spec.md](spec.md) (US2 / FR-005) · **Runbook**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)
**M1…M4 (COMPLETE)**: archived at [milestones/](milestones/)

> **After M4 (all 6 overlays).** M5 = prove the paged-mode `.docx` EXPORT is Word-valid + equivalent to overlay,
> END-TO-END against the real Word-for-Windows COM oracle. Then M6 (glyph metrics), then `layout-engine → main`.

## Summary

The migration kept the doc MODEL page-free and never touched the `.docx` export path — so the **thesis** is that a
doc edited/laid-out in **paged** mode exports Word-equivalently to **overlay** (the converter is a pure function of
`state.doc` + converter state, run by the SAME inner Editor in both modes). M5 **validates this end-to-end with real
Word**, because the project lesson is **"exportXmlOnly + `test:roundtrip` BOTH MISS Word-corruption"** (`test:roundtrip`
reimports via a JS unzip + the fork — it never opens the file in Word).

**The real work is NEW infra:** there is **no** existing Node→Word-COM bridge (the `validate-*-win.ps1` oracles are
hand-run). M5 builds a small **Node → `spawnSync(powershell)` → Word-COM** driver (sandbox-disabled, PID-safe,
JSON-stdout) that saves real paged-export bytes and opens them in Word.

## Decisions (planning Q&A + the M5 understanding sweep + adversarial critic)

1. **Parity = TWO-TIER** (user): **(a)** for the 4 SHARED-model constructs (images, comments+track, footnotes/endnotes,
   header/footer) — a **NORMALIZED structural diff** of the paged save vs the overlay save of the SAME edit (Word
   revision-ids/`rsid`/wordIds MASKED, parts sorted), proving equality (catches a silent dropped/duplicated-content
   divergence); **(b)** for INK (M4c) — **Word-VALID + correct page** (opens with no repair; page-local `posOffset` on
   the right page), EXPLICITLY NOT a diff vs overlay (ink intentionally differs: re-anchor + page-local).
2. **Scope = CONSOLIDATED + FOCUSED INK** (user): ONE kitchen-sink paged doc (image+comments+track+footnote+endnote+
   header/footer) → save → validate-open + normalized diff vs overlay; PLUS a focused multi-page ink COM test. NOT
   the full per-construct matrix.
3. **`validate-open` is HARDENED** (critic): it currently does NOT pass `OpenAndRepair:=false` (only 4 positional args)
   — `ok:true` = "no INTERACTIVE repair under `DisplayAlerts=0`", NOT "no silent repair". M5 adds `OpenAndRepair:=false`
   so silent repairs surface, AND always pairs `ok:true` with a per-construct read-back.
4. **The kitchen-sink normalized diff is the GUARD** (critic): PE exposes a public `dispatch(tr)` and there are
   unaudited drag/node-move paths; the consolidated paged-vs-overlay diff catches any unforeseen PE-side model
   mutation — it MUST stay.
5. **Validate a header EDITED VIA THE PAGED STORY SESSION** (critic): header/footer + footnotes route through separate
   story-session editors; M5 oracles a header edited via the paged session (not only a bridge `setHeaderText`).
6. **Ink fixtures enumerate the corruption modes** (critic): page-2+ float, **inter-page-gap-spanning** stroke,
   **top-of-page-2** (where `TextSelection.near` snapping is touchy).
7. **CADENCE = HYBRID / local-only**: the gate needs real foreground Word (M365 dev box), sandbox-disabled; it CANNOT
   run in headless CI (Word COM hangs at `New-Object` in a sandbox). Ship `npm run test:roundtrip:paged`, run each
   milestone, documented dev-box-only.
8. **NO fork edits, NO bridge edits** — the export path is already mode-correct; M5 only VALIDATES it.

## Technical Context
**Language/Version**: TypeScript renderer probe + Node driver + PowerShell COM; Electron 31; Windows 11 + Word 16
(M365 Current Channel, ADR-0006). **Primary Dependencies**: `WC.PM.exportDocxBytes`/`editor.exportDocx`,
`window.wordAPI.saveBytes` (main.js:357-365), `scripts/oracle/word-oracle-win.ps1` + `validate-open-win.ps1` +
`validate-comments/notes/headerfooter-win.ps1`, `scripts/paged-ink-probe.js` (reused). **Testing**: a NEW
`test:roundtrip:paged` (Node→Word-COM); the 4 existing gates UNCHANGED. **Constraints**: no fork edits; model
page-free; dev-box-only (real Word; sandbox-disabled; PID-safe). **Scale/Scope**: 1 paged probe + 1 Node driver + 1
reusable com-validate helper + a 1-line `validate-open` hardening + a package.json script. No `src/` changes.

## Constitution Check
Unratified template; gates = project rules + runbook invariants.

| Gate | M5 compliance |
|------|----------------|
| Model page-free | ✅ M5 VALIDATES it (the kitchen-sink diff is the proof); no model change. |
| Overlay byte-identical | ✅ no `src/` change at all. |
| 3 gates + bundle 4 | ✅ unchanged (pm 475 / smoke 9 / roundtrip 27 / bundle 4); M5 ADDS `test:roundtrip:paged`. |
| No fork edits | ✅ src/renderer/core/superdoc-fork untouched; only OUR oracle scripts + new test scripts. |
| Validate vs real Word (project lesson) | ✅ that IS M5 — real Word COM, not exportXmlOnly/roundtrip. |
| No hand-edit of generated files | ✅ untouched. |

**Result: PASS.**

## Project Structure
```text
specs/001-paged-render-migration/
├── spec.md · plan.md (THIS, M5) · research.md · data-model.md
├── contracts/m5-com-gate.md
├── quickstart.md · checklists/requirements.md
└── milestones/{m1,m2,m3,m4a,m4b,m4c,m4d}/   # archived
```
### Source Code — M5 touch set (NO src/ changes — test infra only)
```text
scripts/oracle/com-validate.js          # NEW — reusable Node helper: spawnSync a validate-*-win.ps1 SANDBOX-DISABLED, parse JSON stdout → {ok,…} (reused by M6)
scripts/paged-export-m5-probe.js        # NEW — paged probe: edit the kitchen-sink fixture (+ a paged-session header) → exportDocxBytes → wordAPI.saveBytes(C:/tmp/wc-paged-m5-*.docx); also an OVERLAY save of the same edit
scripts/test-roundtrip-paged.js         # NEW — Node driver: glob-clean stale files; spawn paged+overlay probes; per .docx → com-validate(validate-open ok:true + read-backs); normalized structural diff (id-masked) for the 4 shared constructs; ink = Word-valid + correct page
scripts/oracle/validate-open-win.ps1    # HARDEN — pass OpenAndRepair:=false (so silent repairs surface). OUR oracle script, not the fork.
package.json                            # add test:roundtrip:paged (SEPARATE gate; do NOT touch test:roundtrip's 27 pins)
scripts/paged-ink-probe.js              # REUSED (not modified) — already asserts page-local posOffset EMU; M5 adds the multi-page ink fixtures via the driver
```
**Structure Decision**: M5 is dev-box-only TEST INFRA building the Node→Word-COM bridge; zero `src/` change.

## Phase 0 — Research
See [research.md](research.md): the mode-independent-export proof; why `test:roundtrip` misses corruption; the
Node→COM orchestration (the new surface); the per-run-revision-id non-determinism → normalized diff; the
`validate-open` `OpenAndRepair` gap; the two-tier parity; the ink corruption modes; the story-session edit path; the
hybrid cadence.

## Phase 1 — Design & Contracts
- **Entities**: [data-model.md](data-model.md) — the kitchen-sink fixture, the paged/overlay save pair, the
  normalized-diff masking, the validate-open + read-back results, the ink fixture set.
- **Contract**: [contracts/m5-com-gate.md](contracts/m5-com-gate.md) — the `com-validate` helper signature, the probe
  save contract, the driver assertions, the `validate-open` hardened contract.
- **Validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M5)
1. `npm run build` clean; the 4 existing gates stay green (pm 475 / smoke 9 / roundtrip 27 / bundle 4 — no `src/`
   change).
2. **`npm run test:roundtrip:paged` ALL-PASS** on the Windows dev box (sandbox-disabled): kitchen-sink paged save →
   `validate-open` `ok:true` (now `OpenAndRepair:=false`) + comments/notes/header-footer read-back==seeded + the
   paged-vs-overlay NORMALIZED structural diff EQUAL for the 4 shared constructs; multi-page ink (page-2+,
   gap-spanning, top-of-page-2) → `validate-open` `ok:true` + page-local `posOffset` on the correct page.
3. **Determinism check** — export one fixture twice (same mode), diff → confirm exactly which fields are
   non-deterministic (drives the normalization masking; if even same-mode diffs nontrivially, the masking is required).
4. **PID-safety** — only spawned WINWORD PIDs killed (never the user's window); all powershell spawns sandbox-disabled.
5. **`/code-review`** on the slice; fix all; re-verify.

## Risks
- **The Node→Word-COM bridge is NEW** (no precedent) — sandbox-disable, PID-safety, STA/foreground, JSON parsing are
  the real engineering; get them right first (a small spike).
- **`validate-open` `ok:true` ≠ byte-perfect** — it's "no repair"; ALWAYS pair with read-back. Hardened with
  `OpenAndRepair:=false`.
- **Per-run revision ids** make a literal byte-diff fail even overlay-vs-overlay → the shared-construct proof MUST be
  a normalized structural diff. Verify the non-determinism first.
- **INK is the only real corruption risk** — exportXmlOnly/roundtrip MISS it; only a real Word save+open reveals a
  repair. Cover page-2+, gap-spanning, top-of-page-2.
- **Story-session edits** (header/footer/notes) route through separate editors — validate a paged-session-edited
  header, not only a bridge-API edit.
- **PE `dispatch(tr)` + drag/node-move** could (future) mutate `state.doc` paged-only — the kitchen-sink diff is the
  guard.
- **OUT OF SCOPE (documented):** the pre-existing docx-REOPENED multi-page ink import gap (`customGeometry.inkPos`
  recovery — both modes); no export→reopen leg in M5. M6 + the →main endgame.
- **Real Word + foreground** — never touch the user's live Word window; the gate is dev-box-only, not headless CI.

## Complexity Tracking
*No constitution violations — empty.*
