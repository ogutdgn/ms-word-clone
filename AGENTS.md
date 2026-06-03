# AGENTS.md — ms-word-clone

A faithful **Microsoft Word desktop clone** built from scratch: an Electron app
whose UI, behaviour, and on-screen outcomes match real MS Word as closely as
possible. This file orients any AI agent (or human) working in the repo. Read it
first, then dive into the linked `docs/`.

> ⚠️ **Project direction (as of 2026-06):** the app is being repurposed into a
> **computer-use-agent (CUA) reinforcement-learning / eval environment** (logger +
> verifier + MCP), and the document core is moving from DOM-as-model to a
> **ProseMirror model forked from SuperDoc**. **Locked decisions:**
> [docs/decisions/](docs/decisions/) (ADR-0001…0005 + `OPEN_DECISIONS.md`). **Target
> architecture & tech stack:** [docs/architecture/](docs/architecture/). **Research:**
> [docs/research/](docs/research/). This happens on the `research-architecture` branch,
> gated on a de-risking spike — **not yet built**. Everything below describes the
> **current/legacy** app, still the source of truth until the migration lands.

## What this is

- **Goal:** clone MS Word's desktop UI and functionality — ribbon, features, and
  the *visible outcome* of every control — not a generic text editor.
- **Shell:** Electron 31 + a vanilla-JS renderer. **No bundler** — classic
  `<script>` tags load modules in order onto a global `window.WC` namespace.
- **Document model:** one `#editor` `contenteditable` + a custom command layer
  over `document.execCommand` (with `styleWithCSS`).
- **Files:** the main process does fs + dialogs + `.docx` conversion and exposes
  a narrow `window.wordAPI` bridge via a `contextBridge` preload.

## Directory map

```
src/main/main.js        Electron main: window, IPC, fs, docx import/export, COM-free
src/main/preload.js     contextBridge -> window.wordAPI (the only privileged surface)
src/renderer/index.html Script load order (the dependency graph) + CSP
src/renderer/js/        All renderer logic on the global WC namespace:
  editor.js             WC.Editor: the contenteditable, command layer, PAGINATION
  ribbon.js             renders WC.RIBBON, wires controls to WC.Commands
  ribbon-data.js        WC.RIBBON data (generated; do not hand-edit)
  commands.js           WC.Commands dispatcher + the H[cmd] handler table + menus
  icons.js / icons-fluent.js   WC.icon() dispatcher + generated Fluent icon set
  *-features.js / *-tools.js   per-tab feature modules (home, insert, draw, …)
  comments.js, formatting.js, statusbar.js, dialogs.js, files.js, backstage.js, app.js
src/renderer/styles/    base.css (page geometry vars), editor.css, ribbon.css, …
scripts/                test-suite.js (in-renderer QA), test_docx.js, gen-icons.js, gen.js
docs/                   the documentation set (below)
.claude/skills/commit-style/   the commit convention (follow it for every commit)
```

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

# docx round-trip suite (9 tests)
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

- **docx export:** `html-to-docx` needs **full integer margins** (top/right/bottom/
  left/header/footer/gutter) or it emits `w:header="undefined"` and **real Word
  rejects the file** (mammoth/LibreOffice tolerate it — only real Word catches it).
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
