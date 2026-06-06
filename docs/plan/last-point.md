# Last Point — dated state checkpoints

> A running log of "where we are" at the end of each session/day. **Append a NEW dated entry at
> the TOP each time — never overwrite older entries.** The accumulated history shows our
> progression. Renewed via the `plan-tracking` skill. Big picture: [plan.md](plan.md) · session
> playbook + daily work log: [execution-map.md](execution-map.md).

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
