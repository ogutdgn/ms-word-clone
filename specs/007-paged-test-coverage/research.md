# Research: Paged test-coverage port

## Decision 1 — Mechanism: a data-driven paged-skip map + per-test paged branches (not 70 inline rewrites)

`scripts/test-suite-pm.js` registers each test via `t(name, fn)` / `ta(name, asyncFn)` where `fn` returns
`true` (pass) or a string/false (fail-with-detail). Rather than editing 70 call sites, 007:

1. Replaces the **halting boot-guard** with a soft `MODE`/`PAGED` record (done) — the suite runs in both modes.
2. Adds a **`PAGED_SKIP` map** (exact test name → `{reason, probe}`) of the Category-A overlay-only tests, and
   teaches `t()`/`ta()` to **skip-with-reason** when `PAGED && PAGED_SKIP.has(name)`: record
   `{name, pass:true, detail:'⊘ paged-skip (overlay-only): <reason> — paged covered by <probe>'}` and do NOT run
   the body (avoids the overlay-DOM `getComputedStyle`/`null` errors; safe because each test re-authors state).
3. Ports the **Category-B** (functional) tests individually with a `PAGED`-aware assertion branch.

**Rationale**: the skip map is auditable (one place lists every paged-skip + its covering probe — FR-004), keeps
overlay byte-unchanged (the skip is a `PAGED`-only branch — FR-002), and is far less error-prone than rewriting
70 bodies. **Alternative rejected**: rewriting each body with `if (PAGED) {...} else {...}` — 70× the diff and
risk, for tests that are genuinely overlay-rendering-specific anyway.

## Decision 2 — Categorization of the 70 (genuine paged run, fresh profile)

### Category A — overlay-only rendering → honest skip-with-reason (62 tests)

| Zone | n | Construct (overlay-only) | Covering paged probe |
|------|---|--------------------------|----------------------|
| `[4a]` | 22 | the overlay **Pagination engine** (`PM.__pagination`): page geometry, seams, spacers, page-count-via-pagination, manual/section break pagination | `probe:coords` + `probe:statusbar` (Page X/Y via `getCurrentPage`) + `report:glyphgeom` (multi-page geometry vs Word) |
| `[6b]` | 8 | overlay-rendered **table DOM** ("no table rendered", window-stretch geometry) | table **export** via `test:roundtrip`; paged paints tables in `.superdoc-page` |
| `[4d]` | 7 | **ribbon→table** ops asserted via overlay table DOM ("no table cell rendered"); the *exports* (`w:trHeight`/`w:gridCol`/`w:jc`/`w:vAlign`/`w:tcMar`) are mode-agnostic | `test:roundtrip` (the exports) |
| `[2]` | 7 | overlay-rendered **list-marker / shading** DOM (`1.`/`2.`, multilevel, separator width, nested indent, shading paint) | list/shading **structure** (the passing structural asserts) + `test:roundtrip` |
| `[9]` | 6 | the **`#pm-notes-area` overlay** (DISABLED in paged — the PE paints footnotes at the page foot, M4d) + the overlay TOC "0" page-number degradation | `probe:notes` |
| `[home]` | 5 | overlay-rendered **paragraph-border / text-effect / horizontal-rule** DOM (`getComputedStyle` on border boxes) | paged paints in `.superdoc-page`; border/effect **export** via `test:roundtrip` |
| `[4b]` | 3 | overlay **image-resize handles** + `#pm-editor <img>` render (grayscale/stretched) | `probe:imageresize` (M4b retargets the resize overlay to the painted image) |
| `[fix]` | 3 | overlay **caret-hit / `.ProseMirror-selectednode`** DOM | `probe:pointer` (M2 click-to-caret) |
| `[3]` | 1 | heading-color **decoration** render ("no decorated span") | mark application is mode-agnostic; render covered by `report:glyphgeom` |
| `[4c]` | 1 | `setImageWrap("square")` **float render** | wrap **export** via `test:roundtrip` + `probe:imageresize` |
| `[insert]` | 1 | Picture **natural-size render** (the rendered `<img>` box) | `probe:imageresize` + insert export |
| `[1]` | 1 | strike-on-superscript `<s>`-wrap **render** | mark application mode-agnostic |

Total Category A (`PAGED_SKIP`) = 22+8+7+7+6+5+3+3+1+1+1+1 = **65** (the planning estimate of 62 was an
arithmetic slip; the generator + collision-check produced 65 unique names — `summary.pagedSkips=65`).

### Category B — functional / mode-agnostic → INVESTIGATE (5 tests; OUTCOME below)

These are NOT rendering-specific; they go through the (mode-agnostic) `WC.PM` bridge / converter, so they
*should* pass in paged. They fail only because the **assertion mechanism** queries an overlay construct. Each is
investigated during implementation; ported to assert the paged equivalent, OR logged as a genuine paged gap
(NEVER silently skipped — FR-005):

| Zone | n | Test | Hypothesis |
|------|---|------|-----------|
| `[7]` | 1 | open `.html` imports headings/bold/list — "bold mark lost" | converter is mode-agnostic; assert the **doc-model mark**, not rendered DOM, or a load-timing settle |
| `[8]` | 1 | Restrict Editing → PM view read-only | `editable` flag — assert on the **PE view** (`WC.view`) in paged |
| `[0a]` | 1 | PK-prefixed junk import leaves the live editor intact | import resilience — assert the **live PE** survived |
| `[11]` | 2 | "PM is the only world" / "body is pm-active" | environment/class guards — assert the paged body class / single-world invariant |

### Category B — OUTCOME (after empirical investigation in a real paged build)

- **`[0a]` → PORTED (genuine pass).** Paged's PE editable DOM is not a `.ProseMirror` directly under
  `#pm-editor`; the editor genuinely survives the junk import (`v().dom` retains the text, `openDocx` returned
  `false`). The assertion was retargeted to `v().dom` survival in paged (overlay keeps the `.ProseMirror` mount
  check). 1 test.
- **`[7]` → KNOWN-GAP (deferred to feature 010).** `WC.Files.open('*.html')` in paged **dumps the raw HTML as
  literal text** into one text node instead of parsing it (the super-converter html→doc path isn't wired into the
  paged open flow; overlay parses it). A REAL paged import-fidelity gap → `PAGED_KNOWN_GAP`, tracked to 010.
- **`[8]` + `[11]`×2 → KNOWN-GAP (deferred to the open-path fix).** All three PASS in isolation but fail in the
  full suite as **downstream victims**: an earlier round-trip test's `PM().openDocx(bytes)` re-open (e.g. `[4b]
  Picture Format Crop`) tears the paged world down via the overlay-only path → `failBridge` clears `pm-active` +
  sets `PM.active=false` (instead of the paged-safe `replaceFile` `WC.Files.open` uses, cf. `627fec1`). The editor
  instance still edits (all content tests pass), but the world-flag / editability invariants read the torn state.
  A REAL paged gap in the programmatic open-path → `PAGED_KNOWN_GAP`, tracked. 3 tests.

So Category B resolved as **1 port + 4 known-gaps** (NOT 8; the planning estimate was wrong). The honesty
invariant (FR-005) holds: nothing functional was silently skipped — the 4 gaps are visible (`⚠️`, with trackers)
and surfaced via `summary.pagedKnownGaps`.

## Decision 3 — Harden the localStorage footgun (FR-006)

`main.ts` resolves `localStorage.getItem('WC_LAYOUT') || __WC_LAYOUT_DEFAULT__ || 'paged'` — localStorage WINS,
so a stale `'overlay'` in the shared `C:/tmp/wc-probe-profile` silently flipped paged builds (the migration
false-green). 007 hardens the **gate** (not production): the suite records the booted mode loudly (done via the
GATE MODE info row), and the paged gate uses a **fresh/cleared profile** so the build define wins. A
`test:pm:paged` npm convenience runs paged against a fresh `--user-data-dir` (e.g. `C:/tmp/wc-paged-test`) +
`--probe-out=C:/tmp/wc-pm-paged.json`, so CI/maintainers get a genuine paged run by construction.

**Rationale**: production (`main.ts`) keeping localStorage-override is correct (a user toggling the engine at
runtime should win); only the GATE must not be fooled. So the fix is test-harness-side (fresh profile + loud
mode record), not a `src` change — preserving the no-production-change invariant (FR-007).

## Decision 4 — No Word-COM oracle (this is test infra, not a fidelity feature)

007 changes only how `test:pm` asserts in paged. There is no new document-fidelity surface to read back in Word
(the features it covers were already oracle-validated in their own slices). Verification = overlay 475 + paged
0-hard-fail + smoke/roundtrip/bundle unaffected. (Constitution Principle IV applies to *fidelity claims*; 007
makes none.)

## Decision 5 — Adversarial review (`w4szfpzey`) reclassification: final split 59 skip + 10 known-gap + 1 port

The 20-agent review (focused on over-skips hiding real gaps) confirmed **2 defects**, both fixed in the same
feature:

- **Defect A — 6 `[4d]` table-ribbon tests were OVER-SKIPPED.** They sat in `PAGED_SKIP` with the reason
  "ribbon→table ops asserted via overlay table DOM", but their bodies assert **only** the PM model
  (`doc().descendants → n.attrs.*`) + `exportDocx` XML — **zero overlay-DOM**. An instrumented genuine-paged run
  (skip bypassed) proved all 6 fail at the **model read**: Row Height `rowHeight=null`, Column Width `gridCol`
  unchanged `[4680,4680]`, AutoFit `grid unchanged`, page-align `justification=undefined`, vertical-align
  `verticalAlign=null`, cell-margins `flyout did not open`. Root cause: the ribbon table command (caret→target
  cell via `setTextSelection(cellPos+2)` + the flyout dispatch) does **not** resolve/apply against the paged PE
  cell selection. `test:roundtrip` does NOT cover this (it greps pre-authored fixtures; it never drives the
  ribbon command) and there is no `probe:table`. The non-skipped twin `[4d] a set row height exports as
  w:trHeight` PASSES because it writes the model **directly** via `setNodeMarkup`, isolating the gap to the
  ribbon caret→cell path. → all 6 moved SKIP→`PAGED_KNOWN_GAP` with accurate per-symptom reasons + the tracker
  *"paged ribbon-table command cell-resolution + a probe:table (backlog — per-feature paged reconciliation)"*.
  This is a **real paged functional gap** (ribbon table formatting is broken in the shipping engine) — now
  VISIBLE, not masked as "already covered, overlay-only" ahead of 008. Only `[4d] column resize is armed`
  (genuinely reads `#pm-editor .ProseMirror` columnResizing) stays in `PAGED_SKIP`.
- **Defect B — the overlay `test:pm` gate lost its mode assertion.** 007 replaced the hard boot-guard (which
  failed loudly on a non-overlay build) with a soft mode-record, and re-added the mode check ONLY for paged
  (`run-pm-paged.js`). The bare overlay `test:pm` against the shared persistent profile could then boot paged
  (stale `localStorage WC_LAYOUT`) and report green `mode:paged` — the exact false-green 007 exists to kill. Fix:
  a symmetric `scripts/run-pm-overlay.js` (fresh profile + asserts `mode=overlay` + `fail===0`); `test:pm` now
  points at it. Verified: `test:pm` against a paged build now exits non-zero with "NOT OVERLAY — booted mode=paged".

**Final split**: 475 = 406 run-pass (incl. the `[0a]` port) + **59** `PAGED_SKIP` (overlay-only) + **10**
`PAGED_KNOWN_GAP` (`[7]` html-import, `[8]`+`[11]`×2 openDocx-teardown, 6×`[4d]` table-ribbon). The planning
estimate (62/8) and the first-pass split (65/4) were both corrected by the review.
