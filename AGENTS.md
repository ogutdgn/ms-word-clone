# AGENTS.md — ms-word-clone

A faithful **Microsoft Word desktop clone** built from scratch: an Electron app
whose UI, behaviour, and on-screen outcomes match real MS Word as closely as
possible. This file orients any AI agent (or human) working in the repo. Read it
first, then dive into the linked `docs/`.

> ⚠️ **Project direction (as of 2026-06):** the app is being repurposed into a
> **computer-use-agent (CUA) reinforcement-learning / eval environment** (logger +
> verifier + MCP). The document core is a **ProseMirror model forked from SuperDoc**.
> - **Start every session at [docs/plan/](docs/plan/):** `last-point.md` (where we are),
>   `execution-map.md` (what to do now), `plan.md` (roadmap + dev process). Renew them at
>   session end with the **`plan-tracking`** skill (`.claude/skills/plan-tracking/`).
> - **Locked decisions:** [docs/decisions/](docs/decisions/) (ADR-0001…0005 + `OPEN_DECISIONS.md`).
>   **Target architecture & tech stack:** [docs/architecture/](docs/architecture/).
>   **Research (incl. the green de-risk spike):** [docs/research/](docs/research/).
>
> **SINGLE WORLD:** the renderer builds with **electron-vite + TypeScript**, and the document core
> is an **owned, vendored ProseMirror engine forked from SuperDoc** (`src/renderer/core/superdoc-fork/`,
> no `superdoc` npm dep, telemetry off) mounted at `#pm-editor`. Phase 2 wired every ribbon area onto
> that engine via the `WC.PM` bridge (`src/renderer/bridge/*.ts`): character/paragraph/lists/styles,
> clipboard + editing-misc, find-replace, insert-basics + full Table Tools, file-io (docx/html/txt/csv
> open + docx/html/txt save; `test:roundtrip` is THE docx gate), review (Track Changes + comments that
> EXPORT), references (TOC, footnotes/endnotes, citations/bibliography, captions/index, cross-reference),
> and slice 10 (themes, mail-merge, draw, insert-exotica). **Slice 11 RETIRED the legacy world** —
> the `--legacy` flag, the `contenteditable` `WC.Editor`, the leaf legacy engines, and the
> `mammoth`/`html-to-docx` converter are gone; the fork's `super-converter` is the sole `.docx` path.
> The parity reference is **Word for Windows 16.0** (COM oracle `scripts/oracle/word-oracle-win.ps1`).
> Exact state: [docs/plan/](docs/plan/).

## What this is

- **Goal:** clone MS Word's desktop UI and functionality — ribbon, features, and
  the *visible outcome* of every control — not a generic text editor.
- **Shell:** Electron 31; renderer built by **electron-vite + TypeScript**. The editor is the
  **owned ProseMirror core** (TS/ESM under `src/renderer/`, vendored fork in
  `src/renderer/core/superdoc-fork/`). The shared chrome (ribbon, dialogs, backstage, statusbar)
  is still vanilla JS — classic `<script>` tags served verbatim from `src/renderer/public/js/` onto
  the global `window.WC` namespace; its WC→TS/ESM migration is DEFERRED to a future slice.
- **Document model:** a vendored ProseMirror `Editor` rendering into `#pm-editor`, driven by the
  `WC.PM` bridge (`src/renderer/bridge/*.ts`) — every document write is a ProseMirror transaction.
- **Files:** the main process does fs + dialogs and exposes a narrow `window.wordAPI` bridge via a
  `contextBridge` preload; `.docx` is converted renderer-side by the fork's `super-converter`.

## Directory map

```
electron.vite.config.ts electron-vite build config: main/preload/renderer; @superdoc/* + @core/@converter
                        aliases; single-PM `resolve.dedupe`; dev-CSP + .vue-stub plugins
tsconfig.json           TS config for the renderer module graph (the PM core + bridge)
src/main/main.js        Electron main (plain CJS): window, IPC, fs, text/PDF IO; dev/prod loader split
src/main/preload.js     contextBridge -> window.wordAPI (the only privileged surface)

src/renderer/index.html Loads the shared-chrome classic scripts (build window.WC) FIRST, then the ESM
                        entry ./main.ts LAST; strict CSP (relaxed only in dev via a Vite plugin)
src/renderer/main.ts    Core entry (TS/ESM): constructs the vendored Editor, mounts #pm-editor,
                        exposes window.WC.view + window.__WC_READY; logger seam = editor.on('transaction')
src/renderer/bridge/    WC.PM bridge (TS/ESM): ribbon commands -> ProseMirror transactions —
                        index.ts (the WC.PM surface), io.ts (file open/save), insert/table/search/
                        review/references/design/mail/draw/… per ribbon area
src/renderer/core/      The owned ProseMirror core (TypeScript):
  superdoc-fork/        vendored + stripped SuperDoc engine — schema + super-converter + extensions,
                        plus _vendor/superdoc/* siblings; telemetry-noop.ts; NOTICE.md (AGPL-3.0)
  fixture.ts, generated/  base64-inlined .docx fixture (file://-safe; regen via scripts/gen-fixture.js)
src/renderer/pm/index.ts  single ProseMirror barrel (enforces one PM copy)
src/renderer/public/    Shared chrome, served VERBATIM by Vite (static, untransformed):
  js/                   the classic window.WC chrome modules — ribbon.js, ribbon-data.js (generated),
                        commands.js (WC.Commands + H[cmd] table; PM-only dispatch), icons*.js, util.js,
                        dialogs.js, statusbar.js, files.js, backstage.js, app.js, table-tools-pm.js,
                        home-features.js (WC.Clipboard), *-tools.js value/state tables,
                        00-netlog.js (no-network guard for the smoke test)
  styles/               base.css (page geometry vars), editor.css, ribbon.css, comments-pm.css, …
  vendor/               purify.min.js
scripts/                test-suite-pm.js (PM functional suite), test-roundtrip-pm.js +
                        test-roundtrip-pm-probe.js (PM-converter docx round-trip — THE docx gate),
                        smoke-pm.js (9 PM-core smoke), gen-icons.js, gen.js, gen-fixture.js
out/                    electron-vite build output (gitignored): out/{main,preload,renderer}
docs/                   the documentation set (below)
.claude/skills/commit-style/   the commit convention (follow it for every commit)
```
> **Run/test note:** the in-renderer harness needs a build first —
> `npm run build && npm run test:pm` (or `test:smoke`/`test:roundtrip`). `npm run dev`
> / `npm run build` / `npm run preview` are the electron-vite scripts. See [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md).

## Documentation set (`docs/`)

Read the doc that matches your task:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — process model, security, the
  `wordAPI` bridge, the PM core + `WC.PM` bridge, the shared-chrome `WC` namespace +
  load order, command dispatch, per-file module map.
- [docs/TECH_STACK.md](docs/TECH_STACK.md) — Electron, electron-vite + TypeScript, the
  vendored SuperDoc-fork converter, and every library (ProseMirror, DOMPurify,
  @fluentui/svg-icons, jszip) + versions.
- [docs/RIBBON.md](docs/RIBBON.md) — the data-driven ribbon (10 tabs / 212
  controls), control types, dispatch, flyouts, toggle sync, Styles gallery, and
  the runtime contextual-tab mechanism. **How to add/change a control.**
- [docs/ICONS.md](docs/ICONS.md) — `WC.icon()` resolution, the Fluent mapping, and
  the `gen-icons.js` build step. **How to add/remap an icon.**
- [docs/PAGINATION.md](docs/PAGINATION.md) — the page sheet: PM continuous flow today;
  real model-driven multi-page sheets are Phase-7-gated.
- [docs/FEATURES.md](docs/FEATURES.md) — tab-by-tab feature inventory; links to
  each `docs/*_TAB.md`, the UI-fidelity audit, and `NOT_IMPLEMENTED.md`.
- [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md) — how to run, the headless QA
  harness, and the real-Word COM oracle workflow.
- [docs/TESTING.md](docs/TESTING.md) — the in-renderer test harness, the docx
  round-trip suite, the COM oracles, and the "regression test per fix" rule.
- Per-tab status: `docs/{HOME,INSERT,DRAW,DESIGN,LAYOUT,REFERENCES,MAILINGS,REVIEW,VIEW}_TAB.md`.
- [docs/UI_FIDELITY_AUDIT.md](docs/UI_FIDELITY_AUDIT.md) — on-screen-outcome parity work.
- [docs/NOT_IMPLEMENTED.md](docs/NOT_IMPLEMENTED.md) — features that need a cloud/host runtime.
- [docs/GRAPHIFY.md](docs/GRAPHIFY.md) — the prebuilt knowledge graph (`graphify-out/`).
  **Query it instead of reading many files** for architecture/"what connects to X"
  research — it's the cheap way to explore the codebase.

## Run & test (copy-paste)

**Three gates** — always `npm run build` first.

```bash
# run (builds via electron-vite, then launches)
npm start

# PM functional suite — returns JSON to --probe-out
npm run build && npm run test:pm
node -e "const r=require('/tmp/wc-pm.json');console.log(r.summary)"

# PM-core smoke (9)
npm run build && npm run test:smoke

# PM-converter docx round-trip (THE docx gate)
npm run build && npm run test:roundtrip

# headless screenshot + arbitrary probe (CSP blocks page eval -> use a file)
npx electron . --shot=/tmp/x.png --shot-evalfile=/tmp/probe.js \
  --probe-out=/tmp/x.json --shot-delay=1400 --win=1200x900
```

## Validating against real MS Word (COM oracle)

The dev machine has MS Word installed and reachable from WSL. Use it as the
ground truth for differential testing:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\Public\wcprobe\<probe>.ps1'
```

**PID safety is mandatory:** snapshot the WINWORD PID list before/after
`New-Object -ComObject Word.Application`, and `Stop-Process` **only** the newly
spawned PID. Never call `$word.Quit()` if you attached to an existing instance —
you would close the user's visible Word window. See `pagination_probe.ps1` for the
safe pattern.

## Conventions

- **Commits:** follow `.claude/skills/commit-style/SKILL.md` — `type(scope):
  imperative` subject, a body (what/why), explicit `git add <path>` (never
  `git add .`), and **no `Co-Authored-By` / AI-authorship trailer**.
- **Branches:** feature/fix work on a branch; PR anything touching the save/docx
  format, the test harness, or 5+ files. Never force-push `main`.
- **Every fix ships a regression test** in `scripts/test-suite-pm.js`.

## Critical gotchas (learned the hard way)

- **The `WC.PM` bridge is the ONLY document-write path.** Every document mutation is a
  ProseMirror transaction dispatched through `src/renderer/bridge/*.ts`. Ribbon handlers in
  `commands.js` must call `WC.PM.*` (the legacy `WC.Editor`/`E()`/`execCommand` path is gone).
- **`.docx` is the fork `super-converter`, renderer-side.** Open/save go through the vendored
  fork (`bridge/io.ts` → `doc:openBytes`/`doc:saveBytes`); `mammoth`/`html-to-docx` no longer
  exist. The converter rebuilds OOXML (not byte-identical) — guard round-trip with `test:roundtrip`.
- **No `window.prompt()`:** Electron disables it — use `WC.dialog`.
- **Phase-7 deferred areas honestly block.** layout-page, layout-arrange, header-footer, and
  text-effects commands are gated by `isBlocked`/`notifyBlocked` and show a Word-like deferral
  toast; their `commands.js` handler bodies are dead Phase-7 stubs (they reference the deleted
  `WC.HeaderFooter`/`WC.Layout`/`E()` and never run). Don't "fix" them — they await Phase 7.
- **Generated files:** `ribbon-data.js` (from `scripts/gen.js`) and
  `icons-fluent.js` (from `scripts/gen-icons.js`) are auto-generated — edit the
  sources + regenerate, don't hand-edit.
