# Quickstart — Validate Milestone 5 (paged export ↔ Word-COM-oracle parity)

M5 proves the paged-mode `.docx` export is Word-valid + equivalent to overlay, end-to-end against real Word.
**Dev-box-only** (real foreground Word, sandbox-disabled, PID-safe); not headless CI. No `src/` change.

## Prerequisites
- Windows dev box with Word 16 (M365). Branch `slice/m5-paged-export-oracle` (off `layout-engine`). `npm run build`.

## 1. Existing gates stay flat (no src change)
```bash
npm run build
npm run test:pm        # 475   |  npm run test:smoke   # 9
npm run test:roundtrip # 27    |  npm run test:bundle  # 4
```

## 2. The new paged COM gate (the M5 deliverable)
```bash
npm run test:roundtrip:paged   # runs sandbox-disabled (real Word COM); dev-box-only
```
Expect ALL-PASS:
- **Determinism check** — exporting one fixture twice (one mode) reveals exactly which fields are non-deterministic
  (revision ids / rsid / wordIds) → those are masked in the structural diff.
- **Kitchen-sink (paged)** → `validate-open` `ok:true` (now `OpenAndRepair:=false` — silent repairs surface too);
  `validate-comments`/`validate-notes`/`validate-headerfooter` read-back == the seeded markers (no `<scope-error>`).
- **Shared-construct parity** — the NORMALIZED structural diff of the paged save vs the overlay save of the SAME edit
  is EQUAL (the guard against a silent PE-side model divergence).
- **Multi-page ink** (page-2+, gap-spanning, top-of-page-2) → `validate-open` `ok:true` + the page-local `posOffset`
  EMU lands on the correct page (NOT a diff vs overlay — ink intentionally differs).

## 3. PID-safety + Word hygiene
- Only the SPAWNED WINWORD PIDs are killed — the user's live Word window is never touched. All powershell spawns are
  sandbox-disabled (Word COM hangs at `New-Object` in a sandbox). Stale `C:/tmp/wc-*-m5-*.docx` are glob-cleaned first.

## 4. Code review
`/code-review` on the slice diff (scrutinize the Node→COM bridge: sandbox-disable, PID-safety, JSON parsing, the diff
masking for false-confidence); fix all; re-run 1–2.

## Done checklist
- [ ] Build clean; pm 475 / smoke 9 / roundtrip 27 / bundle 4 unchanged.
- [ ] `test:roundtrip:paged` ALL-PASS: kitchen-sink open-ok + read-backs + normalized diff EQUAL; ink open-ok + page-correct.
- [ ] determinism check ran; the mask set is justified.
- [ ] PID-safe; sandbox-disabled; the user's Word untouched.
- [ ] `/code-review` clean.
- [ ] Runbook updated (test:roundtrip:paged is dev-box-only); slice ff-merged into `layout-engine`.
