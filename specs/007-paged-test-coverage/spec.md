# Feature Specification: Paged test-coverage port (`test:pm` paged-aware)

**Feature dir**: `specs/007-paged-test-coverage/` | **Branch**: `007-paged-test-coverage` (off `general-done`)
**Status**: Draft | **Type**: TEST INFRASTRUCTURE (no production-code change; no Word-COM oracle — not a fidelity feature)

## Why

`paged` is the shipping default render engine, but the `test:pm` functional suite
(`scripts/test-suite-pm.js`, 475 tests) is fundamentally an **overlay-rendering** suite: a genuine paged run
fails **70 tests** because they assert overlay-only rendering constructs that the paged `PresentationEditor`
(PE) does not expose (the overlay `PM.__pagination` engine, the `#pm-notes-area` overlay disabled in paged,
overlay-rendered table/list/border/image DOM). The migration's "paged 475" gates were a **false-green**: a stale
`localStorage WC_LAYOUT='overlay'` in the shared probe profile silently booted a paged build into overlay
(memory `paged-testpm-overlay-suite`). A current boot-guard pins `test:pm` to overlay (one loud fail on paged).

So there is **no functional test gate that genuinely exercises the paged engine** — only the dedicated paged
probes (coords/pointer/statusbar/overlays/imageresize/ink/notes/headerfooter/opennew + glyphgeom) do. This is
the **prerequisite for 008 (overlay retirement)**: overlay cannot be deleted while the only functional suite
that passes is the one that renders overlay.

## What (scope)

Make `test:pm` **mode-aware** so a genuine **paged** build runs a real paged functional suite that **passes
without a false-green**, while **overlay stays 475/475**. Concretely:

1. **Replace the halting boot-guard** with a soft mode-record: the suite runs in BOTH overlay and paged; the
   booted mode is surfaced (so the stale-localStorage footgun can never silently flip a build again).
2. For each of the **70 paged failures**, do ONE of (final split — see research Decision 2 + Decision 5):
   - **(A) honest skip-with-reason** (`PAGED_SKIP`, **59**) when the assertion targets a genuinely overlay-only
     rendering construct (absent in paged; a named dedicated probe gives the real paged coverage). Recorded as a
     PASS carrying `⊘ paged-skip (overlay-only): <reason> — paged covered by <probe>` — NOT a silent pass.
   - **(B) a paged-aware port** (**1**: `[0a]`) when the behaviour is functional and only the *assertion
     mechanism* was overlay-specific — assert the paged equivalent (e.g. `v().dom` survival vs the `.ProseMirror`
     mount). Genuinely passes.
   - **(C) a deferred known-gap** (`PAGED_KNOWN_GAP`, **10**) when investigation proves a REAL paged FUNCTIONAL
     gap (not overlay-only): `[7]` (html import), `[8]`+`[11]`×2 (downstream of `PM().openDocx()` teardown), and
     **6×`[4d]`** table-ribbon ops (row-height / column-width / autofit / page-align / vertical-align / cell-
     margins — the ribbon command no-ops against the paged PE cell selection; **caught by the adversarial review
     `w4szfpzey` as an over-skip** — they assert only model+export, fail at the model read, NOT overlay-only).
     Recorded as a VISIBLE pass carrying `⚠️ paged known-gap (deferred): <reason> — tracked: <feature>` — never
     hidden. Surfaced via `summary.pagedKnownGaps`.
3. **No real paged gap is hidden**: every functional failure was investigated; the 6 `[4d]` table-ribbon tests
   that the review proved were over-skipped were moved SKIP→KNOWN_GAP with accurate per-symptom reasons.
4. **Mode-assertion is symmetric** (review Defect B): BOTH gates run a fresh-profile runner that asserts the
   booted mode (`run-pm-overlay.js` → `mode=overlay`; `run-pm-paged.js` → `mode=paged`) + `fail===0`, so a stale
   `localStorage WC_LAYOUT` can no longer false-green EITHER direction.

**Out of scope**: changing any production code (this is test infra); the Word-COM oracle (not a fidelity
feature); fixing paged *rendering* gaps the probes already own; deleting the overlay engine (that is 008).

## User scenarios

- **Maintainer runs the paged gate**: `npm run build` (paged) → `test:pm` → the suite runs in paged, reports
  `mode=paged`, and **passes** (0 hard fails; overlay-only tests visibly skipped-with-reason). No false-green.
- **Maintainer runs the overlay gate**: `WC_LAYOUT=overlay npm run build` → `test:pm` → **475/475**, unchanged.
- **008 readiness**: a green paged `test:pm` + the dedicated probes together cover the paged engine functionally,
  so overlay can be retired without losing the functional gate.

## Functional requirements

- **FR-001**: The suite MUST run to completion in BOTH `overlay` and `paged` (no halting boot-guard).
- **FR-002**: A genuine overlay build MUST still report **475/475** (no regression; the 70 ports are paged-only
  branches — overlay behaviour is byte-unchanged).
- **FR-003**: A genuine paged build MUST report **0 hard failures**; the GATE MODE info row reports `mode=paged`.
- **FR-004**: Every paged-skipped test MUST carry an explicit `overlay-only` reason naming the construct AND the
  dedicated probe that covers it in paged — never a bare/silent pass.
- **FR-005**: Category-B (functional, mode-agnostic) failures MUST be ported to a paged-aware assertion (assert
  the paged equivalent), NOT skipped — unless investigation proves a genuine paged gap, which MUST be logged.
- **FR-006**: The mode MUST be derived from the actual booted engine (`window.__WC_LAYOUT_MODE`), and the harness
  MUST be hardened so a stale `localStorage WC_LAYOUT` cannot silently flip the intended mode (clear/assert).
- **FR-007**: No production code (`src/**`), no fork, no generated files are changed; only
  `scripts/test-suite-pm.js` (and, if needed, the harness/profile hardening + an npm `test:pm:paged` convenience).

## Success criteria

- **SC-001**: Overlay `test:pm` = **475/475**, `mode=overlay` asserted ✅.
- **SC-002**: Paged `test:pm:paged` = **475/475, 0 hard fails** (406 run-pass incl. the `[0a]` port + 59 skip +
  10 known-gap), `mode=paged` surfaced ✅.
- **SC-003**: `summary.pagedSkips=59` (each names a construct + covering probe) + `summary.pagedKnownGaps=10`
  (each names the gap + owning feature) — fully auditable ✅.
- **SC-004**: `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4 unaffected ✅.
- **SC-005**: BOTH `test:pm` (→ `run-pm-overlay.js`) and `test:pm:paged` (→ `run-pm-paged.js`) run a FRESH profile
  + assert the booted mode → a stale `localStorage WC_LAYOUT` can no longer produce a false-green in EITHER
  direction (review Defect B) ✅.

## Empirical baseline (genuine paged run, fresh profile)

Genuine paged `test:pm` = **406 pass / 70 fail** (the +1 vs the memory's 405 is the new GATE MODE info row).
70 failures by zone: `[4a]` 22 (pagination/`__pagination`), `[6b]` 8 + `[4d]` 7 (overlay table DOM), `[9]` 6
(`#pm-notes-area`), `[2]` 7 + `[home]` 5 (shading/list/border paint), `[4b]` 3 + `[4c]` 1 + `[insert]` 1 (image),
`[fix]` 3 (overlay caret-hit DOM), `[3]` 2 + `[1]` 1 (decoration render), `[11]` 2 + `[0a]` 1 + `[7]` 1 + `[8]` 1
(functional — Category B, to verify). See `research.md` for the per-test categorization.

## Assumptions

- The 70 failures are the documented overlay-only set (matches memory `paged-testpm-overlay-suite`), not new
  paged bugs — confirmed by the empirical run matching 405 genuine pass.
- The dedicated paged probes genuinely cover paged rendering (coords/pointer/statusbar/overlays/imageresize/ink/
  notes/headerfooter/opennew/glyphgeom) — so a skip-with-reason that points to a probe is honest coverage.
- Skipping an overlay-only test's BODY in paged (not just its assertion) is safe — each test re-authors its own
  document state, so later tests don't depend on a skipped test's side effects.
