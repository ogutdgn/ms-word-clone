# Quickstart — Validate Milestone 2 (pointer click hit-test routing)

M2 fixes the `focus.ts`/PE click conflict so real pointer clicks place the caret correctly in paged mode,
and migrates focus.ts's overlay hit-test to the M1 `WC.PM.coords` seam.

## Prerequisites
- Branch `slice/m2-pointer-hit-test` (off `layout-engine`); `npm run build` succeeds.

## 1. Regression gates (overlay default — MUST stay flat)
```bash
npm run build
npm run test:pm        # expect 475
npm run test:smoke     # expect 9
npm run test:roundtrip # expect 27
npm run test:bundle    # expect 4/4 (no bundle change)
```
Any deviation fails M2 (overlay default must be byte-identical; the focus.ts gate is false in overlay and
the `clientToPos` swap is behavior-identical).

## 2. Paged pointer probe (the headline check)
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-m2-pointer.json --shot-evalfile=scripts/paged-pointer-probe.js
```
Expect all rows PASS on a forced multi-page doc:
- single click at a known glyph → caret at that pos; typing inserts there;
- click near a page boundary (last line of page N / first line of N+1) → caret on the correct line;
- double-click → word selection; triple-click → paragraph selection; drag → extended range;
- (the probe also runs an overlay pass asserting focus.ts margin-click still places a caret).

## 3. Overlay pointer parity
```bash
npm run build   # default (overlay)
electron . --probe-out=/tmp/wc-m2-pointer-ovl.json --shot-evalfile=scripts/paged-pointer-probe.js
```
Expect the overlay rows PASS: margin-click places the caret (focus.ts unchanged behavior via the adapter).

## 4. Word fidelity
Behavioral reference (no COM oracle for interactive caret): in-text → that glyph; side margin → nearest
text on the line; below last paragraph → document end. The probe encodes these expectations.

## 5. Code review
`/code-review` on the slice diff; fix all findings; re-run steps 1–3.

## Done checklist
- [ ] Build clean.
- [ ] test:pm 475 / smoke 9 / roundtrip 27 / bundle 4.
- [ ] paged pointer probe all-PASS (single + boundary + double/triple/drag).
- [ ] overlay margin-click parity PASS.
- [ ] `/code-review` clean (or all findings fixed + re-verified).
- [ ] Runbook Current Status updated; slice ff-merged into `layout-engine`.
