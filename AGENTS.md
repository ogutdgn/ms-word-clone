# AGENTS.md — ms-word-clone

A faithful **Microsoft Word desktop clone** built from scratch: an Electron app
whose UI, behaviour, and on-screen outcomes match real MS Word as closely as
possible. This file orients any AI agent (or human) working in the repo. Read it
first, then dive into the linked `docs/`.

> ⚠️ **Project direction (as of 2026-06):** the app is being repurposed into a
> **computer-use-agent (CUA) reinforcement-learning / eval environment** (logger +
> verifier + MCP), and the document core is moving from DOM-as-model to a
> **ProseMirror model forked from SuperDoc**.
> - **Start every session at [docs/plan/](docs/plan/):** `last-point.md` (where we are),
>   `execution-map.md` (what to do now), `plan.md` (roadmap + dev process). Renew them at
>   session end with the **`plan-tracking`** skill (`.claude/skills/plan-tracking/`).
> - **Locked decisions:** [docs/decisions/](docs/decisions/) (ADR-0001…0005 + `OPEN_DECISIONS.md`).
>   **Target architecture & tech stack:** [docs/architecture/](docs/architecture/).
>   **Research (incl. the green de-risk spike):** [docs/research/](docs/research/).
>
> **Phase 1 (Scaffold) is BUILT** (branch `build/phase-1-scaffold`, PR #10): the renderer now
> builds with **electron-vite + TypeScript**, and the new document core is an **owned, vendored
> ProseMirror engine forked from SuperDoc** (`src/renderer/core/superdoc-fork/`, no `superdoc`
> npm dep, telemetry off). **Phase 2 slices 0a–8 are DONE** (merged to `main` via PRs #11–#15,
> #17, #19, #21–#25): the PM core (`#pm-editor`) is now the **active visible editor** since
> slice 0a; the legacy vanilla-JS `window.WC` editor boots only under the `--legacy` flag as a frozen
> regression target. Flipped ribbon areas so far: **character** (slice 1), **paragraph +
> lists** (slice 2 — incl. shading/borders, Word-native multilevel, the Paragraph dialog),
> **styles** (slice 3 — gallery + PM-native hover live-preview, styles pane, caret-driven
> gallery highlight, 4 minted built-in style defaults), **clipboard + editing-misc**
> (slice 4 — cut/copy/paste via webContents IPC, paste-special dialog, Word-scope Format
> Painter, select; Cmd+Shift+C/V chords), **find-replace** (slice 5 — fork decoration-based
> Search; Match Case + Whole Words + Wildcards + Advanced Find + Go To), **insert-basics +
> full Table Tools** (slice 6, PR #23 — insert primitives + table insertion + the 9 ops +
> 14 NOTICE'd fork table commands + contextual ribbon tabs + minted real-Word table styles),
> **file-io** (slice 7, PR #24 — docx/html/txt/csv open + docx/html/txt save; `test:roundtrip`
> is THE docx gate), and **review** (slice 8, PR #25 — fork-engine Track Changes + lock dialog,
> tracked ins/del/format render with bars/balloons/Revisions pane, modern contextual comment
> cards on the Document-API path so comments EXPORT, accept/reject(+advance), 4 display modes,
> Track Changes Options/Advanced + Change User Name, Compare → REAL tracked-changes diff,
> Restrict Editing via engine `setEditable`, proofing re-points, the titlebar mode pill;
> oracle legs A+B PASS vs **Word for Windows 16.0** over COM — the parity reference since
> slice 8; slices 1–7 stay validated vs Word for Mac 16.77.1).
> **Phase 2** continues wiring ribbon commands → PM transactions (**slice 9: references** next —
> TOC + footnotes/endnotes + citations per spec §9.1 row 9).
> Exact state: [docs/plan/](docs/plan/).

## What this is

- **Goal:** clone MS Word's desktop UI and functionality — ribbon, features, and
  the *visible outcome* of every control — not a generic text editor.
- **Shell:** Electron 31; renderer built by **electron-vite + TypeScript** (since Phase 1).
  **Two worlds:** the *legacy* app is still vanilla JS — classic `<script>` tags (served verbatim
  from `src/renderer/public/js/`) load modules in order onto the global `window.WC` namespace —
  running beside the **new owned ProseMirror core** (TS/ESM under `src/renderer/`).
- **Document model (legacy, still active):** one `#editor` `contenteditable` + a custom command
  layer over `document.execCommand` (with `styleWithCSS`). *(New core: a vendored ProseMirror
  `Editor` rendering into `#pm-editor`; Phase 2 makes it the active page.)*
- **Files:** the main process does fs + dialogs + `.docx` conversion and exposes
  a narrow `window.wordAPI` bridge via a `contextBridge` preload.

## Directory map

```
electron.vite.config.ts electron-vite build config: main/preload/renderer; @superdoc/* + @core/@converter
                        aliases; single-PM `resolve.dedupe`; dev-CSP, .vue-stub, docx-utils-copy plugins
tsconfig.json           TS config for the renderer module graph (the new core)
src/main/main.js        Electron main (plain CJS): window, IPC, fs, docx import/export; dev/prod loader split
src/main/preload.js     contextBridge -> window.wordAPI (the only privileged surface)

src/renderer/index.html Loads the legacy classic scripts (build window.WC) FIRST, then the ESM
                        entry ./main.ts LAST; strict CSP (relaxed only in dev via a Vite plugin)
src/renderer/main.ts    NEW core entry (TS/ESM): constructs the vendored Editor, mounts #pm-editor,
                        exposes window.WC.view + window.__WC_READY; logger seam = editor.on('transaction')
src/renderer/core/      NEW owned ProseMirror core (TypeScript):
  superdoc-fork/        vendored + stripped SuperDoc engine — schema + super-converter + extensions,
                        plus _vendor/superdoc/* siblings; telemetry-noop.ts; NOTICE.md (AGPL-3.0)
  fixture.ts, generated/  base64-inlined .docx fixture (file://-safe; regen via scripts/gen-fixture.js)
src/renderer/pm/index.ts  single ProseMirror barrel (enforces one PM copy)
src/renderer/public/    LEGACY app, served VERBATIM by Vite (static, untransformed):
  js/                   the classic window.WC modules — editor.js (WC.Editor: contenteditable +
                        command layer + PAGINATION), ribbon.js, ribbon-data.js (generated), commands.js
                        (WC.Commands + H[cmd] table), icons*.js, *-features.js/*-tools.js, app.js,
                        00-netlog.js (no-network guard for the smoke test)
  styles/               base.css (page geometry vars), editor.css, ribbon.css, …
  vendor/               purify.min.js
scripts/                test-suite.js (257 in-renderer QA), test-suite-pm.js (PM functional suite),
                        test-roundtrip-pm.js + test-roundtrip-pm-probe.js (PM-converter docx
                        round-trip — THE docx gate), test_docx.js (17 — frozen legacy-converter
                        gate, retires at slice 11), smoke-pm.js (9 PM-core smoke), gen-icons.js,
                        gen.js, gen-fixture.js
out/                    electron-vite build output (gitignored): out/{main,preload,renderer}
docs/                   the documentation set (below)
.claude/skills/commit-style/   the commit convention (follow it for every commit)
```
> **Run/test note (post-Phase-1):** the in-renderer harness now needs a build first —
> `npm run build && npx electron . --probe-out=… --shot-evalfile=scripts/test-suite.js`. `npm run dev`
> / `npm run build` / `npm run preview` are the electron-vite scripts. See [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md).

## Documentation set (`docs/`)

Read the doc that matches your task:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — process model, security, the
  `wordAPI` bridge, the `WC` namespace + load order, the editor model, command
  dispatch, per-file module map.
- [docs/TECH_STACK.md](docs/TECH_STACK.md) — Electron, the no-bundler choice, and
  every library (mammoth, html-to-docx, DOMPurify, @fluentui/svg-icons) + versions.
- [docs/RIBBON.md](docs/RIBBON.md) — the data-driven ribbon (10 tabs / 212
  controls), control types, dispatch, flyouts, toggle sync, Styles gallery, and
  the runtime contextual-tab mechanism. **How to add/change a control.**
- [docs/ICONS.md](docs/ICONS.md) — `WC.icon()` resolution, the Fluent mapping, and
  the `gen-icons.js` build step. **How to add/remap an icon.**
- [docs/PAGINATION.md](docs/PAGINATION.md) — the trickiest subsystem: faking page
  sheets in one contenteditable via in-flow gap spacers, line-level splitting,
  and caret preservation. Validated against real Word.
- [docs/FEATURES.md](docs/FEATURES.md) — tab-by-tab feature inventory; links to
  each `docs/*_TAB.md`, the UI-fidelity audit, and `NOT_IMPLEMENTED.md`.
- [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md) — how to run, the headless QA
  harness, and the real-Word COM oracle workflow.
- [docs/TESTING.md](docs/TESTING.md) — the in-renderer test harness, the docx
  round-trip suite, the COM oracles, and the "regression test per fix" rule.
- Per-tab status: `docs/{HOME,INSERT,DRAW,DESIGN,LAYOUT,REFERENCES,MAILINGS,REVIEW,VIEW}_TAB.md`.
- [docs/UI_FIDELITY_AUDIT.md](docs/UI_FIDELITY_AUDIT.md) — on-screen-outcome parity work.
- [docs/NOT_IMPLEMENTED.md](docs/NOT_IMPLEMENTED.md) — features that need a cloud/host runtime.

## Run & test (copy-paste)

```bash
# run (WSL/WSLg: needs DISPLAY=:0; HW accel auto-disabled on WSL)
cd /home/ogutd/msword-clone && npm start

# in-renderer functional suite (currently 228 tests) — returns JSON to --probe-out
DISPLAY=:0 npx electron . --probe-out=/tmp/results.json \
  --shot-evalfile=scripts/test-suite.js --shot-delay=800
node -e "const r=require('/tmp/results.json');console.log(r.summary)"

# PM-converter docx round-trip (THE docx gate) — needs a build first
npm run build && npm run test:roundtrip

# frozen legacy-converter gate (--legacy html-to-docx; retires at slice 11)
node scripts/test_docx.js

# headless screenshot + arbitrary probe (CSP blocks page eval -> use a file)
DISPLAY=:0 npx electron . --shot=/tmp/x.png --shot-evalfile=/tmp/probe.js \
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
- **Every fix ships a regression test** in `scripts/test-suite.js`.

## Critical gotchas (learned the hard way)

- **docx export (`--legacy` mode only since slice 7):** `html-to-docx` needs **full
  integer margins** (top/right/bottom/left/header/footer/gutter) or it emits
  `w:header="undefined"` and **real Word rejects the file** (mammoth/LibreOffice
  tolerate it — only real Word catches it). The PM engine never touches this path.
- **insertHTML strips attributes:** `execCommand('insertHTML')` with `styleWithCSS`
  drops `class`/`data-*` on some elements — use `WC.Editor.insertNodeHTML(html)`
  for anything that must keep attributes (merge fields, comment anchors).
- **No `window.prompt()`:** Electron disables it — use `WC.dialog`.
- **Pagination caret:** `repaginate()` does live DOM surgery; it preserves the
  selection by absolute character offset and has a single-page fast path that does
  **not** touch the caret. Overlays (`.ink-layer`, SVG) are excluded from layout
  math, and `getHTML()` strips all `.wc-page-gap`/`.wc-gap-band` spacers so they
  never reach saved files. See docs/PAGINATION.md before editing it.
- **Aptos is unavailable on Linux** → `#editor p { line-height: 1.4 }` calibrates
  the fallback font so a page holds the same ~26 lines as real Word.
- **Generated files:** `ribbon-data.js` (from `scripts/gen.js`) and
  `icons-fluent.js` (from `scripts/gen-icons.js`) are auto-generated — edit the
  sources + regenerate, don't hand-edit.
