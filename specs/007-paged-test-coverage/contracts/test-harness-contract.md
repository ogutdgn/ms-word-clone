# Contract: `test:pm` paged-aware harness

## C1 — Boot-mode (no halt)

- The suite MUST run to completion in both modes. The booted mode is surfaced via **`summary.mode`** (NOT a
  counted result row — so both modes report exactly 475), plus `summary.pagedSkips` (the skip count). The old
  `return`-on-non-overlay guard is removed (FR-001).

## C2 — `t(name, fn)` / `ta(name, asyncFn)` skip behaviour

- In **overlay** (`!PAGED`): unchanged — run `fn`, record pass/fail exactly as before. **Byte-identical
  behaviour** ⇒ overlay stays 475/475 (FR-002 / SC-001).
- In **paged** (`PAGED`) AND `PAGED_SKIP.has(name)`: DO NOT run `fn`. Record
  `{ name, pass: true, detail: '⊘ paged-skip (overlay-only): ' + reason + ' — paged covered by ' + probe }`.
- In **paged** AND NOT in `PAGED_SKIP`: run `fn` normally (these MUST pass — the 405 mode-agnostic tests + the
  ported Category-B tests).

## C3 — Reason format (auditable, FR-004)

- Every paged-skip detail MUST start `⊘ paged-skip (overlay-only): ` and name BOTH the overlay-only construct
  AND a dedicated paged probe (`probe:*` / `report:glyphgeom` / `test:roundtrip`) that covers it in paged.
- No paged-skip may have an empty/generic reason.

## C4 — Result summary

- `summary = { total, pass, fail }`. **Paged: `fail === 0`** (pass includes paged-skips) — SC-002. The skip
  count is derivable (`results.filter(r => /paged-skip/.test(r.detail)).length`) and bounded (≈62) — SC-003.
- **Overlay: `pass === 475, fail === 0`** — SC-001.

## C5 — Category-B (functional) — NO silent skip

- A Category-B test MUST NOT appear in `PAGED_SKIP`. It is ported to a `PAGED`-aware assertion and MUST genuinely
  PASS in paged, OR (if a real paged gap is proven) be recorded as an explicit FAIL/known-gap row — never hidden.

## C6 — Profile hardening (FR-006)

- `npm run test:pm:paged` runs a paged build against a FRESH `--user-data-dir` (no stale `localStorage WC_LAYOUT`)
  so the build define wins → a genuine paged run by construction. The GATE MODE row asserts `mode=paged`.
