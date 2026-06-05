# Execution Map — session playbook + daily work log

> How to orient, execute the current phase, and record what got done. The forward plan lives
> here; the **Daily work log** (below) records what we actually did each day, with checkboxes.
> Big picture: [plan.md](plan.md) · dated state snapshots: [last-point.md](last-point.md).
> Renewed via the `plan-tracking` skill.

## At session START (always, in order)
1. Read **[last-point.md](last-point.md)** (top entry) — where we left off, current branch, next.
2. Read **this file** — current phase, next actions, and the Daily work log.
3. Skim **[plan.md](plan.md)** — goal, locked architecture, the two hard constraints, dev process.
4. Read the **ADR(s)** + matching [OPEN_DECISIONS.md](../decisions/OPEN_DECISIONS.md) item for
   the current phase.

> ⚠️ **Branching rule — never do code work on `main`.** Before writing or committing any code,
> **create and checkout a fresh feature branch** off the integration line, e.g. `feature/logger`.
> Confirm first with `git branch --show-current`. `main` receives **only reviewed merges at
> stable milestones**. (Docs-only updates may go on a docs branch and PR.)

## How to execute ANY phase/subsystem (the loop)
1. **Create + checkout a feature branch** (e.g. `feature/<subsystem>`) — do **NOT** work on
   `main`. Verify with `git branch --show-current` before any edit.
2. **Confirm the decision:** read its `OPEN_DECISIONS.md` recommendation + edge cases; confirm or
   adjust against the *real* code; if it changes a locked choice, add a superseding ADR.
3. **Build** it (strangler-fig — behind the existing ribbon; never break the Word UI).
4. **Test:** the 228-test in-renderer suite + the 9-test docx suite stay green; add a regression
   test per change; check feature parity.
5. **Checkpoint** (via the `plan-tracking` skill): **append** a dated entry to last-point.md and
   **tick** the Daily work log below.
6. **PR** for review; merge to the integration line; merge to `main` only at a stable milestone.

## CURRENT PHASE → Phase 1: Scaffold the new core — BUILD COMPLETE (Stages A–C); Stage D = integrate
**Goal:** a minimal editable ProseMirror document — forked from SuperDoc — rendering in our own
DOM with our CSS, inside Electron (closes the spike's Q1 "last mile"). **Achieved** on
`build/phase-1-scaffold`: all gates green (smoke 9/9, functional 257/257, docx 17/17), engine
vendored + owned, no `superdoc` npm dep.

**Actions (done this session):**
- [x] **electron-vite + TypeScript** for the renderer (hardened main/preload preserved; legacy
  app served static from `public/` for "two worlds" coexistence).
- [x] **Vendor + own the SuperDoc fork** (Option B): schema + `super-converter` +
  `getStarterExtensions()` + 5 sibling `@superdoc/*` packages, as **editable source**; Vue UI +
  telemetry stripped (telemetry → no-op); npm dep removed; single PM copy held.
- [x] Mount the model + **type into it** (lists, **Tab/indent**) — via **Path B** (the vendored
  `Editor` owns a plain PM view; logger seam = `editor.on('transaction')`).
- [x] Ribbon/chrome still visible (unwired) — UI still looks like Word.
- [x] Smoke test (`scripts/smoke-pm.js`); checkpoint via `plan-tracking`.
- [ ] **Stage D:** final review → `finishing-a-development-branch` (PR/merge) + docs follow-up.

**Next phase → Phase 2:** wire ribbon commands → PM transactions (strangler-fig, on a new branch).

**Watch-outs realized:** telemetry stripped (no-op + no-network smoke assertion); the published
bundle does NOT export `Schema`/`ExtensionService` (schema comes from a constructed `Editor`);
editing behaviors live in the **extensions** (Tab/indent free via Path B); single
`prosemirror-model` copy enforced via `resolve.dedupe`.

## Daily work log (newest first — check off what got done)

### 2026-06-04
- [x] Merged `research-architecture` → `main` (PR #8).
- [x] Made "never work on `main` — branch first" an explicit rule (plan.md + execution-map.md).
- [x] Restructured last-point.md + execution-map.md into dated logs; updated the `plan-tracking` skill.
- [x] Wrote + committed the Phase 1 spec + implementation plan (`docs/superpowers/`), hardened by 4 workflows.
- [x] Phase 1 **Stage A** — electron-vite + TS build chain; legacy app static under `public/`; gates green.
- [x] Phase 1 **Stage B** — npm-pin + PM single-copy; headless import + fixture; mounted our EditorView; smoke 8/8.
- [x] Phase 1 **Stage C / Option B** — vendored + own the SuperDoc engine (editable source, no npm dep, telemetry no-op, Path B view, Tab/indent); smoke 9/9, functional 257, docx 17.
- [ ] Phase 1 **Stage D** — final review + integrate (PR/merge) + docs follow-up (carries to next session if not finished today).

### 2026-06-03
- [x] Locked ADR-0001…0005; de-risk spike GREEN.
- [x] Created docs/decisions, docs/architecture, docs/research, docs/plan; the `plan-tracking` skill.
- [x] CLAUDE.md / AGENTS.md banners; pushed the `research-architecture` branch.

## At session END (always)
Invoke the **`plan-tracking`** skill: (1) **append** a new dated entry to
[last-point.md](last-point.md) (top); (2) **tick** the Daily work log above (start a new
`### <date>` block if it's a new day); (3) if the phase advanced, update the **CURRENT PHASE**
section.
