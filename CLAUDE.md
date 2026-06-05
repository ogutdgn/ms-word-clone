# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in **ms-word-clone** — a
from-scratch, faithful Microsoft Word desktop clone (Electron + vanilla JS).

> **Start here:** read [AGENTS.md](AGENTS.md) for the full orientation (directory
> map, run/test commands, conventions, and critical gotchas). The deep references
> live in [`docs/`](docs/). This file is the quick, Claude-specific entry point.

> ⚠️ **Project direction (as of 2026-06):** this app is being repurposed into a
> **computer-use-agent (CUA) reinforcement-learning / eval environment** (logger +
> verifier + MCP), and the document core is moving from DOM-as-model to a
> **ProseMirror model forked from SuperDoc**.
> - **Start each session at [docs/plan/](docs/plan/):** `last-point.md` (where we are),
>   `execution-map.md` (what to do now), `plan.md` (the roadmap + dev process). Keep these
>   current with the **`plan-tracking`** skill (`.claude/skills/plan-tracking/`) at session end.
> - **Locked decisions:** [docs/decisions/](docs/decisions/) (ADR-0001…0005 + `OPEN_DECISIONS.md`).
>   **Target architecture/tech-stack:** [docs/architecture/](docs/architecture/).
>   **Research (incl. the green de-risk spike):** [docs/research/](docs/research/).
>
> **Phase 1 (Scaffold) is BUILT** (branch `build/phase-1-scaffold`, PR #10): the renderer now
> builds with **electron-vite + TypeScript**, and the new document core is an **owned, vendored
> ProseMirror engine forked from SuperDoc** (`src/renderer/core/superdoc-fork/`, no `superdoc` npm
> dep). It runs **alongside** the legacy app — **"two worlds":** the legacy vanilla-JS `window.WC`
> editor is still the *wired/active* one (and is what the TL;DR below describes); the new core is
> mounted but not yet wired. **Phase 2** wires the ribbon to the new core and retires the legacy
> editor. Exact state: [docs/plan/](docs/plan/).

## TL;DR

- **Stack:** Electron 31 shell; renderer built by **electron-vite + TypeScript** (since Phase 1).
  **Two worlds:** the *legacy* app is still vanilla JS — classic `<script>` tags (now under
  `src/renderer/public/js/`, served verbatim) build the global `window.WC` namespace — running
  beside the **new owned ProseMirror core** (TS/ESM: `src/renderer/main.ts` → vendored fork in
  `src/renderer/core/superdoc-fork/`, single `prosemirror-model` copy, telemetry off). Main
  process (plain CJS) owns fs + `.docx` via the `window.wordAPI` `contextBridge` bridge.
- **Document (legacy, still active):** one `#editor` `contenteditable` + a custom command layer
  over `execCommand`. Pagination fakes page sheets in that single flow — see
  [docs/PAGINATION.md](docs/PAGINATION.md). *(The new core renders into `#pm-editor`; Phase 2
  makes it the active page.)*
- **Ribbon:** data-driven from `WC.RIBBON` (10 tabs / 212 controls) →
  `WC.Ribbon` renders → `WC.Commands` dispatches `H[cmd]`. See
  [docs/RIBBON.md](docs/RIBBON.md).

## Where to look

| Task | Read |
|------|------|
| Big picture, module map, dispatch | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Libraries / versions / why no bundler | [docs/TECH_STACK.md](docs/TECH_STACK.md) |
| Add/change a ribbon control | [docs/RIBBON.md](docs/RIBBON.md) |
| Add/remap an icon | [docs/ICONS.md](docs/ICONS.md) |
| Touch pagination/page breaks | [docs/PAGINATION.md](docs/PAGINATION.md) |
| What works per tab | [docs/FEATURES.md](docs/FEATURES.md) + `docs/*_TAB.md` |
| Run / harness / COM oracle | [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md) |
| Tests | [docs/TESTING.md](docs/TESTING.md) |

## Working rules

1. **Validate against real MS Word.** The dev box has Word reachable from WSL via
   `powershell.exe -ComObject Word.Application`. Use it as ground truth for any
   behaviour/geometry change. **PID-safe:** kill only the spawned WINWORD PID,
   never the user's window (see AGENTS.md → COM oracle).
2. **Every fix ships a regression test** in `scripts/test-suite.js`. Re-run the
   suite (257 tests) + `scripts/test_docx.js` (17 tests) before committing.
3. **Commits:** follow `.claude/skills/commit-style/SKILL.md` —
   `type(scope): summary`, a what/why body, explicit `git add <path>`, and **no
   `Co-Authored-By`/AI trailer**. Branch for non-trivial work; PR for
   save/docx-format, harness, or 5+ file changes.
4. **Don't hand-edit generated files:** `src/renderer/js/ribbon-data.js`
   (`scripts/gen.js`) and `src/renderer/js/icons-fluent.js` (`scripts/gen-icons.js`).
5. **Mind the gotchas** in AGENTS.md (html-to-docx integer margins, `insertNodeHTML`
   vs `insertHTML`, no `window.prompt`, pagination caret preservation).

## Quick commands

```bash
npm start                                   # run the app
# functional suite (JSON -> --probe-out):
npm run build && npx electron . --probe-out=/tmp/results.json \
  --shot-evalfile=scripts/test-suite.js --shot-delay=800
node scripts/test_docx.js                   # docx round-trip (17 pass / 0 fail)
# ProseMirror smoke test (9 assertions):
npm run build && npx electron . --probe-out=/tmp/smoke.json \
  --shot-evalfile=scripts/smoke-pm.js
```
