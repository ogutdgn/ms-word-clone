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
> dep). **Phase 2 slices 0a–4 are DONE** (merged to `main` via PRs #11–#15, #17, #19 and #21): the PM
> core is the active visible editor; file IO, character formatting, **paragraph + lists**,
> **styles** (gallery + PM-native hover live-preview + pane + caret-driven gallery highlight), and
> **clipboard + editing-misc** (cut/copy/paste + paste-special + Word-scope Format Painter + select)
> are on the engine (oracle-validated against Word 16.77.1); flipped ribbon areas: `character`,
> `paragraph`, `lists`, `styles`, `clipboard`, `editing-misc`; the legacy app runs only under `--legacy`.
> **Phase 2** continues with slice 5 (find-replace). Exact state: [docs/plan/](docs/plan/).

## TL;DR

- **Stack:** Electron 31 shell; renderer built by **electron-vite + TypeScript** (since Phase 1).
  **Two worlds (slice 0a):** the **new owned ProseMirror core** (`#pm-editor`, TS/ESM: `src/renderer/main.ts`
  → vendored fork in `src/renderer/core/superdoc-fork/`, single `prosemirror-model` copy, telemetry off)
  is now the **active visible editor**. The legacy vanilla-JS app (`window.WC` namespace, classic `<script>`
  tags under `src/renderer/public/js/`) boots only under the **`--legacy`** flag; it runs alongside the new
  core as a frozen regression target. Main process (plain CJS) owns fs + `.docx` via the `window.wordAPI`
  `contextBridge` bridge.
- **Document (PM mode, active since slice 0a):** `#pm-editor` driven by the `WC.PM` bridge (commands/io/
  state-sync/focus). Pagination fakes page sheets in continuous flow — see [docs/PAGINATION.md](docs/PAGINATION.md).
  *(Legacy `#editor` contenteditable is hidden in PM mode; `--legacy` restores it.)*
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
   never the user's window (see AGENTS.md → COM oracle). On this machine the
   in-repo macOS oracle (`scripts/oracle/word-oracle.js` — see its README) drives
   Word via AppleScript and supersedes the WSL COM oracle.
2. **Every fix ships a regression test.** PM-mode features go in `scripts/test-suite-pm.js`;
   `scripts/test-suite.js` is **frozen** (legacy gate, run under `--legacy`) until legacy
   retirement. Run both suites + `scripts/test_docx.js` (17 tests) before committing.
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
npm start                                   # run the app (PM mode, default)
npm start -- --legacy                       # run in legacy mode

# Gate suites — always build first:
npm run build && npm run test:legacy        # frozen legacy gate (257) — runs under --legacy
npm run build && npm run test:pm            # PM functional suite (grows per slice)
npm run build && npm run test:smoke && npm run test:smoke:legacy  # 9 + 9
npm run test:docx                           # docx round-trip (17)
```
