# Quickstart — Validate Milestone 4d (notes-area disable + header-footer test)

M4d disables the `#pm-notes-area` overlay in paged (PE owns footnotes) + proves header/footer works in paged.
Overlay byte-identical; header-footer.ts unchanged.

## Prerequisites
- Branch `slice/m4d-notes-hf` (off `layout-engine`); `npm run build` succeeds.

## 1. Regression gates (overlay default — MUST stay flat)
```bash
npm run build
npm run test:smoke     # expect 9
npm run test:roundtrip # expect 27
npm run test:bundle    # expect 4/4
npm run test:pm        # paged behavior is PROBE-gated; the suite's 268/475 early-abort is pre-existing (tracked)
```

## 2. Notes probe
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-notes.json --shot-evalfile=scripts/paged-notes-probe.js
```
Expect PASS (paged): inserting a footnote → PE PAINTED a per-page footnote body; `#pm-notes-area` absent OR
`display:none`; the transaction driver did NOT re-render it; endnotes also disabled; `refShowNotes` scrolls the
painted footnote into view. Then overlay parity (`#pm-notes-area` still mounts + edits).
```bash
npm run build   # overlay
electron . --probe-out=/tmp/wc-notes-ovl.json --shot-evalfile=scripts/paged-notes-probe.js
```

## 3. Header/footer probe
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-hf.json --shot-evalfile=scripts/paged-headerfooter-probe.js
```
Expect PASS (paged): `setHeaderText`/`setFooterText` → `get*` round-trip; `exportDocxBytes` carries `word/headerN.xml
<w:hdr>` + `sectPr <w:headerReference>` + the rels relationship; a REPLACE leaves no stale text; a programmatically
opened PE header session routes the bridge verbs through the live editor + survives exit/commit. Then overlay parity.

## 4. Manual spot-check (real app — paged)
`WC_LAYOUT=paged npm run build && npx electron .` → insert a footnote (References tab) → it should appear at the
**page bottom** (PE), NOT in a separate panel below the doc; double-click it to edit. Show Notes jumps to it. Set a
header (Insert ▸ Header) → it shows + exports.

## 5. Code review
`/code-review` on the slice diff; fix all findings (watch listener-leak + probe-honesty); re-run 1–3.

## Done checklist
- [ ] Build clean.
- [ ] smoke 9 / roundtrip 27 / bundle 4 (test:pm probe-gated).
- [ ] probe:notes all-PASS (paged disabled + PE-painted + Show-Notes scroll; overlay parity).
- [ ] probe:headerfooter all-PASS (paged parity export + interop; overlay parity).
- [ ] overlay byte-identity (`#pm-notes-area` mounts in overlay).
- [ ] `/code-review` clean.
- [ ] Runbook Current Status updated; slice ff-merged into `layout-engine` → **M4 COMPLETE**.
