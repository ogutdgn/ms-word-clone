# Contract — Milestone 5 (paged export ↔ Word-COM-oracle gate)

## `scripts/oracle/com-validate.js` (NEW — reusable Node→Word-COM helper)
- `comValidate(scriptName: string, docxAbsPath: string, extraArgs?: string[]): { ok: boolean, raw: string, json: any }`
- Behavior: `spawnSync('powershell.exe', ['-NonInteractive','-File', 'scripts/oracle/'+scriptName, docxAbsPath,
  ...extraArgs], { ... })` **SANDBOX-DISABLED** (Word COM hangs at `New-Object` inside a sandbox) — i.e. the harness
  must invoke it via the dangerous-sandbox-disabled path. Parse the LAST JSON object on stdout → `json`; `ok =
  json && json.ok === true`. Never throws on a non-zero exit — returns `{ok:false, raw}` so the driver reports it.
- PID-safety: relies on each `validate-*-win.ps1` spawning its own WINWORD and killing ONLY that PID in a `finally`
  (never `GetActiveObject`, never the user's window). The helper adds no GetActiveObject path.

## `scripts/paged-export-m5-probe.js` (NEW — renderer probe, mode-aware)
- Run via `electron . --probe-out=… --shot-evalfile=scripts/paged-export-m5-probe.js` (the driver spawns it under
  `WC_LAYOUT=paged` AND `WC_LAYOUT=overlay`).
- Behavior: confirm `window.__WC_LAYOUT_MODE`; edit the KitchenSinkFixture (image+comments+track+footnote+endnote+
  header/footer, header via the paged story session where feasible) with DISTINCT marker text; then
  `const bytes = await window.WC.PM.exportDocxBytes(); await window.wordApi.saveBytes({ filePath:
  'C:/tmp/wc-'+mode+'-m5-kitchensink.docx', bytes })`. Returns `{summary, results[]}` confirming the save + the
  seeded markers are present in the model (a pre-save sanity).

## `scripts/test-roundtrip-paged.js` (NEW — Node driver, modeled on `test-roundtrip-pm.js`)
- `npm run test:roundtrip:paged`. Steps: **(1)** glob-CLEAN `C:/tmp/wc-*-m5-*.docx`. **(2)** spawn the paged + overlay
  probe runs (kitchen-sink) + the ink probe run (multi-page fixtures). **(3)** per saved .docx →
  `comValidate('validate-open-win.ps1', docx)` assert `ok===true` (CORE: opens with no repair). **(4)** per-construct
  read-back: `comValidate('validate-comments-win.ps1', paged)` / `validate-notes-win.ps1` / `validate-headerfooter-win.ps1`
  assert read-back==seeded (no `<scope-error>`). **(5)** SHARED constructs: `normalizedDiff(pagedKitchenSink,
  overlayKitchenSink)` assert `equal`. **(6)** INK: `validate-open` `ok:true` + the page-local `posOffset` on the
  correct page (reuse `paged-ink-probe.js`'s assertion; NOT a diff). Emit a `{summary,results[]}` report; non-zero
  exit on any fail.
- Determinism: BEFORE trusting the diff, export one fixture twice (one mode) + diff → derive the mask set.

## `scripts/oracle/validate-open-win.ps1` (HARDEN — OUR oracle, not the fork)
- Change `Documents.Open($abs, $false, $true, $false)` → pass `OpenAndRepair:=false` explicitly (positional padding
  with `$missing` for the intervening optional args) so a SILENT auto-repair also surfaces as NOT-ok. Keep the
  `DisplayAlerts=0` + spawned-PID-only kill. Output contract unchanged (`{ok, …}` JSON).

## `package.json`
- Add `"test:roundtrip:paged": "node scripts/test-roundtrip-paged.js"`. **SEPARATE** gate — do NOT touch
  `test:roundtrip` (its overlay count pins stay 27).

## Behavioral guarantees
- NO `src/` change, NO fork edits; model page-free; overlay byte-identical (untouched).
- Tier-1 (shared): normalized diff EQUAL paged↔overlay. Tier-2 (ink): Word-valid (no repair) + correct page.
- `ok:true` always paired with a read-back. Dev-box-only (real Word, sandbox-disabled, PID-safe); not headless CI.
