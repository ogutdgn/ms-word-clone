# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in **ms-word-clone** — a
from-scratch, faithful Microsoft Word desktop clone (Electron + vanilla JS).

> **Start here:** read [AGENTS.md](AGENTS.md) for the full orientation (directory
> map, run/test commands, conventions, and critical gotchas). The deep references
> live in [`docs/`](docs/). This file is the quick, Claude-specific entry point.

## TL;DR

- **Stack:** Electron 31 shell; renderer is vanilla JS with **no bundler** —
  ordered `<script>` tags build a global `window.WC` namespace. Main process owns
  fs + `.docx` via a `window.wordAPI` `contextBridge` bridge.
- **Document:** one `#editor` `contenteditable` + a custom command layer over
  `execCommand`. Pagination fakes page sheets in that single flow — see
  [docs/PAGINATION.md](docs/PAGINATION.md).
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
   suite (228 tests) + `scripts/test_docx.js` (9 tests) before committing.
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
npm start                                   # run (WSL: DISPLAY=:0)
# functional suite (JSON -> --probe-out):
DISPLAY=:0 npx electron . --probe-out=/tmp/results.json \
  --shot-evalfile=scripts/test-suite.js --shot-delay=800
node scripts/test_docx.js                   # docx round-trip
```
