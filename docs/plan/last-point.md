# Last Point — dated state checkpoints

> A running log of "where we are" at the end of each session/day. **Append a NEW dated entry at
> the TOP each time — never overwrite older entries.** The accumulated history shows our
> progression. Renewed via the `plan-tracking` skill. Big picture: [plan.md](plan.md) · session
> playbook + daily work log: [execution-map.md](execution-map.md).

---

## 2026-06-06 — Phase 2 slice 2 BUILT (paragraph + lists on the PM engine)

- **Branch:** `feature/phase-2-slice-2-paragraph` (directly off `main` post PR #15 — no stacked
  PRs; PR pending).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 2 DONE → slice 3 (styles) next.**
- **State summary:** areas **`paragraph` + `lists` FLIPPED** (registry `bridge/index.ts:23`):
  align ×4, list-aware indent (level in lists / 36pt text-indent outside), Layout spinners
  (twips dot-paths + caret readback — new fidelity win), line-spacing menu (dynamic Add/Remove
  labels — Word behavior), paragraph **shading** (new fork render in `encodeCSSFromPPr` + setter)
  and **borders** (Word-default 0.5pt box; single edges accumulate), **sort** (one-transaction
  bridge `sortParagraphs`), bullets/numbering (+libraries now **honor glyphs** via
  `toggle*ListStyle`/`applyListDefinition`), **Word-native multilevel** patterns (real per-level
  numbering definitions — the legacy ml-* CSS fake is not ported), Change List Level (new
  one-transaction fork cmd `changeListLevelBy`), Paragraph dialog (caret seeds + ONE-undo chained
  apply), Ctrl+L/E/R/J + Ctrl+Shift+L (= List Bullet; fork's colliding Mod-Shift keymap stripped).
  **The slice-1 hanging-indent gap is CLOSED** — root cause was the fork stylesheet never entering
  the build; `main.ts` now imports `assets/styles/elements/prosemirror.css` (markers/tabs get real
  widths; evidence `docs/superpowers/plans/notes/2026-06-06-slice2-css-markers.png`).
  New oracle verb **`read-para-props`** (paragraph format + list format; quirks #16-23 documented).
  Gates: **PM 76/76** (43 + 33 new `[2]`), legacy 257/257 frozen, smoke 9/9 ×2, docx 17/17;
  full slice-2 attr round-trip evidence `notes/2026-06-06-slice2-roundtrip.png`.
- **Done this session** (plan `docs/superpowers/plans/2026-06-06-phase2-slice-2-paragraph-lists.md`,
  hardened by a 3-critic adversarial workflow; executed subagent-driven with two-stage review):
  - `a81508f` plan · `9e6fa78`/`b9958a2` red tests (33 `[2]` + paraAttrs helpers + D6 test repoint)
  - `aabc710`/`e04bf45` oracle `read-para-props` (live-verified; enums + F0B7 bullet discovery)
  - `45d5017`/`9bd804b` fork: shading render + SuperDoc align-keymap strip (NOTICE'd)
  - `5cf1f2d`/`87a16ca` fork: `applyListDefinition` + `changeListLevelBy` commands (NOTICE'd)
  - `bda0278` fork element CSS into the build (the hanging-indent fix)
  - `1e64d82`/`78908a7` align/indent/spinners/line-spacing PM branches
  - `35fd50d`/`ac0ca1c` lists libraries + multilevel menus · `152634b`/`cf98b04` shading/borders/sort
  - `453a180` state-sync (Align-Left default pressed, resolved fields, spinner readback)
  - `931a2f0` Paragraph dialog · `8d8e14f` **THE FLIP** (76/76 on first post-flip run, zero triage)
  - `3e1a186` round-trip evidence · `882ea7e` oracle validation JSONs · `86ada55` quirks #22-23.
- **Oracle validation (spec §8.3) vs Word 16.77.1:** leg A paragraph family 4/4 PASS (center /
  double=24pt / 36pt indent / 12pt before); leg B Word→clone 4/4 PASS; shading+borders PASS via
  Word-authored attribute-identical fixtures; fresh-Word-paragraph Align-Left default PASS
  (live-read). **Two reads UNVERIFIED-THIS-SESSION** (lists-family Word read; literal roundtrip
  re-save): the long headless Word session degraded (quirk #23) — follow-up commands are in
  `notes/2026-06-06-slice2-oracleA-lists.json` (`followUp` fields); needs a USER Word relaunch,
  ~5 min.
- **KNOWN DEVIATIONS (recorded):** Paragraph dialog always writes lineRule 'auto' (exact/atLeast
  converted on OK); border single-edge accumulation seeds from the selection-head paragraph;
  sort 'Date' stays parseFloat-numeric; mixed-selection alignment still head-paragraph (slice-0a
  deviation); Borders-and-Shading…/Define-New-Multilevel…/inside borders stay notImplemented.
- **Tech-debt found:** vendored `resolvedPropertiesCache.js` passes `tableStyleId` (string) where
  `resolveParagraphProperties` expects a TableInfo object — table-style cascade silently skipped
  for in-table paragraphs (pre-existing; newly observable via state-sync's resolved fields).
- **Next:** PR slice 2 → `main`; the 5-min oracle follow-up after Word relaunch; then **slice 3 —
  styles** (gallery + LinkedStyles/setStyleById/toggleHeading; live-preview semantics on PM) via
  brainstorm → write-plan → execute.
- **Blockers/notes:** none for the PR. Word left running (never quit) but wedged for NEW opens —
  user relaunch recovers it.

---

## 2026-06-05 — Phase 2 slice 1 BUILT (character formatting on the PM engine)

- **Branch:** `feature/phase-2-slice-1-character` (stacked on `feature/phase-2-slice-0c`; PR up).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 1 DONE → slice 2 (paragraph + lists) next.**
- **State summary:** ALL character-formatting entry points now run on the PM engine (area
  `character` FLIPPED): bold/italic/underline/strike/sub/sup, font/size combos (comboCommit),
  grow/shrink, color/highlight, clearFormatting, changeCase, Font dialog (one chained PM
  transaction = one undo step), QAT undo/redo (engine history, Word-like greying), in-view
  keyboard shortcuts stand down to the engine. **Oracle validation (spec §8.3) run both ways
  vs Word for Mac 16.77.1 — all PASS:** leg A clone→Word (bold/italic/Georgia-20pt read back
  per-run via the new `read-word-props` oracle verb), leg B Word→clone (Word-authored bold word
  imports with run-level truth), leg C negation-run fixture (`tests/fixtures/negation-run.docx`,
  REAL-Word-authored `w:b w:val="0"`, checked in + inlined via gen-fixture). Leg C caught and
  fixed a REAL bug: style-cascade imports emit BOOLEAN negation attrs (`{value:false}`) which
  state-sync read as bold ON (`a.value !== '0'`); plus a PM-suite harness hole (string returns
  = failure paths counted green). Evidence: `docs/superpowers/plans/notes/2026-06-05-slice1-*`.
  Gates: **PM 43/43**, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- **Done this session** (validation + wrap-up, commit SHAs; slice build commits were
  `8e4e9c1` red tests, `9f03481` character+history flip, `9dc452f` guards, `3a16cdb` Font
  dialog one-transaction, `8888ad7` history keys/QAT greying):
  - `8e521b5` — word-oracle `read-word-props` verb (word-granularity reads; 2 new dictionary quirks: never `set` a word element range to a variable; trailing-space/paragraph-mark word slicing).
  - `30dc4ea` — fix: Word negation runs read as bold ON in PM ribbon state (markOn() mirrors fork renderDOM semantics) + negation-run fixture + suite test + harness string-return tightening.
  - `7fb31e9` — oracle validation notes (3 JSON verdicts) + PM-mode UI screenshot.
- **KNOWN FIDELITY GAPS (recorded, deferred):**
  - (a) mixed-size grow-font flattens the selection to one size — real Word steps per-run.
  - (b) Font dialog on a mixed-underline selection strips underline (legacy-parity; real Word shows an indeterminate state).
  - (c) toggled-off vertAlign leaves a residual all-null `textStyle` mark (cosmetic; no render/export effect).
  - (d) UI shot: list markers render inline without hanging-indent metrics (slice 2 territory); no pagination (Phase 7, expected).
- **Next:** slice 2 — **paragraph + lists** (align ×4, indent, spacing, line-spacing, shading/borders, show-marks; toggleBullet/OrderedList, multilevel, list indent) per the NEXT plan to be written (brainstorm → write-plan → execute).
- **Blockers/notes:** none. Word left clean after every oracle leg (document count at baseline 0; never quit).

---

## 2026-06-05 — Phase 2 slice 0c BUILT (macOS Word oracle harness)

- **Branch:** `feature/phase-2-slice-0c` (stacked on `feature/phase-2-slice-0b`; PR pending).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 0c DONE → slice 1 next.**
- **State summary:** `scripts/oracle/word-oracle.js` is live — read-props (per-paragraph
  bold/italic/underline/font/size/alignment via Word's AppleScript object model) + roundtrip
  (open + save-as). Object-model only; name-verified PID safety; leak-proof read-props,
  best-effort roundtrip close. Verified live against Word for Mac 16.77.1. 13+ AppleScript
  dictionary quirks documented in `scripts/oracle/README.md`. Gates unaffected (pure tooling):
  PM 28/28, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- **Done this session** (slice 0c tasks with commit SHAs):
  - `48f55e5` — `scripts/oracle/word-oracle.js`: read-props + roundtrip implementation.
  - `cd68993` — `scripts/oracle/README.md`: full oracle documentation + 13-entry quirk table.
  - `06a10f7` — `scripts/oracle/README.md`: roundtrip close is best-effort, not guaranteed (re-review fix).
- **Next:** slice 1 — character formatting (bold/italic/underline/font/size/color → PM transactions; plan Stage D).
- **Blockers/notes:** none. Gates unaffected (pure tooling addition).

---

## 2026-06-05 — Phase 2 slice 0b BUILT (file IO on the PM engine)

- **Branch:** `feature/phase-2-slice-0b` (stacked on `feature/phase-2-editing-core`; PR pending).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 0b DONE → 0c next.**
- **State summary:** Open/Save/New run on the PM engine via bytes IPC (docx-only; html/txt/csv
  blocked until slice 7); blank fixture; parse-once `replaceEditor` with `failBridge` recovery +
  replace mutex; `Files.path` invariant enforced + tested. Done: commits `8c13d5f`/`9048cfe`
  (fixture), `3819d82` (IPC), `f4b2443`/`9224d1b`/`041499f` (openDocx/newBlank),
  `ecb33fb`/`7d8ee90` (files.js + tests). Gates: PM 28/28, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- **Done this session** (slice 0b tasks with commit SHAs):
  - `8c13d5f` — blank-document fixture for New Document on the PM core.
  - `9048cfe` — gen-fixture usage guard + regeneration commands in fixture headers.
  - `3819d82` — `doc:saveBytes`/`saveAsBytes`/`openBytes` — raw `.docx` bytes IPC channels for the PM core.
  - `f4b2443` — bridge `openDocx`/`newBlank` — editor re-creation from `.docx` bytes.
  - `9224d1b` — `replaceEditor` parse-once: dry-parse BEFORE teardown.
  - `041499f` — `replaceEditor` failBridge on failure, replace mutex, atomic exposure.
  - `ecb33fb` — `files.js` save/open/new wired to PM engine in PM mode; `Files.path` invariant.
  - `7d8ee90` — de-vacuize save-clean assertion; align PM file-IO toast wording.
- **Next:** slice 0c (oracle harness for PM mode) then slice 1 (character formatting: bold/italic/underline/font/size/color → PM transactions).
- **Blockers/notes:** none. html/txt/csv formats + generated docs (mail merge) stay blocked with toasts until their slices. PR stacked on `feature/phase-2-editing-core` (#11).

---

## 2026-06-05 — Phase 2 slice 0a BUILT (PM core is the visible editor)

- **Branch:** `feature/phase-2-editing-core` (pushed to `origin`; PR pending).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 0a DONE, slice 0b next.**
- **State summary:** PM core (`#pm-editor`) is now the **default visible editor** behind the
  `WC.PM` bridge. The legacy app is still intact but boots only under `--legacy`. D6 two-layer
  guards are live (dispatch courtesy block + legacy mutation chokepoint). Ribbon state-sync is
  driven by engine events (caret-tracking font/size combos — fidelity win). Dirty state, statusbar,
  and visible-page commands all re-pointed to be mode-aware. PM-mode Save/Open are intentionally
  blocked until slice 0b. All gates green: legacy 257/257, PM 21/21, smoke 9/9 × 2 modes, docx 17/17.
- **Done this session** (slice 0a tasks with commit SHAs):
  - `870e01a` — `--legacy` boot flag (forwarded to renderer as `?legacy=1`)
  - `210f13f` — PM functional suite skeleton + `test:*` npm aliases
  - `a30f11c` — flip `#pm-editor` to the visible page + `WC.PM` bridge core
  - `7c25a79` — harden `failBridge` against pre-init focus; un-swallow first blocked toast
  - `cf68b84` — D6 integrity guard blocks legacy mutations in PM mode
  - `1ccc507` — block PM-mode Save until the bytes path; correct D6 audit doc
  - `9c6cad7` — D6 courtesy block: unflipped commands toast at dispatch, shortcuts D6-aware
  - `e033fe1` — PM state-sync: engine events drive toggles, combos, statusbar
  - `ab76c5f` — guard list toggle against undefined numberingType; tighten size parse
  - `23f1251` — focus discipline: chrome clicks never blur the PM view
  - `49e5e86` — keep scrollbar dragging alive inside focus-guarded containers
  - `e4ea0bf` — dirty-state readers are mode-aware (PM edits trigger save prompts)
  - `571b1e3` — visible-page commands (showHide, readMode, wordCount, properties) follow active engine
  - `e41fb67` — align paragraph-count selectors; strip `contenteditable` from overlay clones
- **Next:** slice 0b — file-IO bytes layer per
  `docs/superpowers/plans/2026-06-05-phase2-slices-0a-1.md` Stage B; then 0c oracle harness;
  then slice 1 character formatting.
- **Blockers/notes:** none. PM-mode Save/Open intentionally blocked until slice 0b. FYI the
  GitHub repo remote URL may still be `ogutdgn/ms-word-clone` (GitHub redirects; update when convenient).

---

## 2026-06-05 — Phase 1 COMPLETE; Phase 2 next
- **Branch:** `build/phase-1-scaffold` (pushed to `origin`; 18 commits ahead of `main`). Integration
  (merge/PR) is the user's pending choice; **Phase 2 starts on a fresh branch off the integration line.**
- **Phase:** **Phase 1 (Scaffold) DONE → Phase 2 (Editing core behind the ribbon) is next.**
- **State summary:** the owned ProseMirror engine mounts/renders/edits a real `.docx`; all gates green
  (smoke 9/9, functional 257/257, docx 17/17), single PM copy, telemetry off, no `superdoc` npm dep.
  Infra + visual sanity pass passed: `npm run dev` / `build` / built-launch all run; chrome is faithful
  Word; the new core renders the imported list on a Letter page (screenshots reviewed).
- **Done since the 2026-06-04 entry:**
  - Final review = **READY TO INTEGRATE** (spec §8 DoD fully covered); hardened the smoke Tab test (`8de524e`).
  - Docs follow-up: harness now needs `npm run build` first; counts 257/17 (`e5db257`).
  - **Fixed the `npm run dev` crash** (`Cannot find module './docx-utils'`): the A3 build-script `cp`
    didn't run under `electron-vite dev`; moved it to a `closeBundle` plugin (dev+build, cross-platform) (`93e5006`).
  - Plan-doc checkpoints (`4abe94b` + this entry); branch pushed.
- **Next (Phase 2, new session — WE ARE GOOD TO START):** integrate Phase 1 → cut
  `feature/phase-2-editing-core` → brainstorm → spec → plan → build: wire `WC.RIBBON` commands → PM
  transactions (strangler-fig), make `#pm-editor` the visible page (retire legacy `#editor`), wire
  `.docx` save/export on the new engine, per-feature Word fidelity vs the AppleScript oracle.
- **Blockers/notes:** none. **FYI** the GitHub repo was renamed — local `origin` still says
  `ogutdgn/ms-word-clone` (GitHub redirects; update the remote URL to the new name when convenient).
  Tech-debt carried from Phase 1: renderer bundle ~7.4 MB; `presentation-editor`+`layout-adapter`
  vendored (more than the painter-free ideal); list-marker fidelity polish.

---

## 2026-06-04 — Phase 1 build (Stages A–C)
- **Branch:** `build/phase-1-scaffold` (off `main`; not pushed yet).
- **Phase:** **Phase 1 (Scaffold) — Stages A, B, C DONE; only Stage D (final review + integrate) remains.**
- **State summary:** electron-vite + TypeScript renderer is live; the **SuperDoc engine is vendored
  as editable source** (`src/renderer/core/superdoc-fork/` incl. `_vendor/superdoc/` siblings) —
  **no `superdoc` npm dependency**, telemetry routed to a no-op, single `prosemirror-model@1.25.7`.
  The new ProseMirror core mounts a real `.docx`, renders with our schema, is typeable, and
  list **Tab/indent works**. Legacy Word app + chrome intact. **All gates green: smoke 9/9,
  functional 257/257, docx 17/17.**
- **Done this session:**
  - **Spec + plan** written/committed under `docs/superpowers/` (hardened by 4 analysis/critique
    workflows: context, design-verify, spec-critique, plan-critique).
  - **Stage A** — electron-vite + TS build chain; legacy renderer served static from `public/`;
    main dev/prod loader split + preload path; dev-only CSP via a Vite `transformIndexHtml`
    (a strict meta + relaxed header would intersect). (`e8c6276`, `0c9e904`, `d14ebd8`, `0250262`)
  - **Stage B** — npm-pin superdoc@1.38.0 + PM single-copy + barrel; headless `.docx` import +
    base64 fixture; mounted our own `EditorView` + smoke 8/8. (`2120739`, `b348425`, `3e1980b`)
  - **Stage C / Option B (own the engine)** — vendored 5 sibling `@superdoc/*` packages +
    `presentation-editor`/`layout-adapter`; stubbed 3 geometry pkgs at leaf sites; Vite
    aliases/dedupe/`define`; telemetry no-op; rewired to **Path B** (vendored `Editor` owns the
    PM view, `editor.on('transaction')` logger seam → Tab/indent for free); removed the npm dep;
    AGPL `NOTICE.md`. (`8f58e3d`, `38d1d51`, `707649a`, `3587598`)
- **Next:** Stage D — final review + `finishing-a-development-branch` (PR/merge decision) +
  docs follow-up (CLAUDE.md/BUILD_AND_RUN.md/TESTING.md: harness now needs `npm run build` first;
  real counts 257/17). Then **Phase 2** (wire ribbon commands → PM transactions).
- **Blockers/notes:** none. **Decisions this session:** ownership = **full editable source vendor
  within Phase 1** (Option B, per user); the view uses **Path B** (vendored Editor owns the view)
  — a refinement of spec §D5 ("our own thin wrapper"), plan-authorized, no ADR change (ADR-0002…0005
  still hold). **Tech-debt:** renderer bundle ~7.4 MB; `presentation-editor`+`layout-adapter`
  vendored (more than the painter-free ideal — trim in a later pass).

---

## 2026-06-04
- **Branch:** `main` (the `research-architecture` line was merged via PR #8). Today's doc work
  is on `docs/dated-plan-logs`.
- **Phase:** Phase 0 complete → **Phase 1 (Scaffold) is next** — not started.
- **State summary:** all decision/research/plan docs are now on `main`. Architecture is locked
  (ADR-0001…0005) and de-risked (spike GREEN). No build work has started.
- **Done this session:**
  - Made "**never do code work on `main`** — create + checkout a feature branch first" an
    explicit rule in `plan.md` + `execution-map.md`.
  - Restructured `last-point.md` and `execution-map.md` into **dated logs** (append-only history
    + a daily work-log with checkboxes); updated the `plan-tracking` skill to match.
- **Next:** Phase 1 — scaffold electron-vite + TS, vendor the SuperDoc fork, mount the model in
  our own `EditorView` (see [execution-map.md](execution-map.md) → CURRENT PHASE).
- **Blockers/notes:** none. ⚠️ A docs commit (`a7cb0a8`) landed on `main` by mistake before the
  branching rule was internalized; from here, all feature/doc work goes on a branch.

---

## 2026-06-03
- **Branch:** `research-architecture` (later merged to `main` via PR #8).
- **Phase:** Phase 0 complete → Phase 1 next.
- **Done this session:**
  - Locked **ADR-0001…0005** (CUA pivot · ProseMirror model · fork SuperDoc's schema + converter
    + extensions · lists = paragraph+`numId` · `.docx` via the fork).
  - **De-risk spike GREEN** (`docs/research/2026-06-03-spike-superdoc-fork.md`): headless `.docx`
    round-trip with **no Vue**; model renders to clean DOM; dependency closure 185 pkg / 148 MB.
  - Created `docs/decisions/` (ADRs + `OPEN_DECISIONS.md`), `docs/architecture/`,
    `docs/research/`, `docs/plan/`, the `plan-tracking` skill; CLAUDE.md/AGENTS.md banners;
    pushed the `research-architecture` branch.
- **Next:** Phase 1 scaffold.
- **Blockers/notes:** none.
