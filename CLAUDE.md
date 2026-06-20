# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in **ms-word-clone** — a
from-scratch, faithful Microsoft Word desktop clone (Electron + electron-vite + TypeScript).

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
> - **NEXT/ACTIVE phase (pivot 2026-06-15): the LAYOUT ENGINE (Phase 4).** Most remaining
>   features/bugs (image/table **resize+relocate**, floating objects, multi-page, headers/footers,
>   page borders, columns) are layout-gated — build the engine first, then fix them. Spec +
>   acceptance checklist + sub-phases: **[docs/LAYOUT_ENGINE.md](docs/LAYOUT_ENGINE.md)**.
>   **Windows is the native target** (Word-for-Windows COM oracle, native Office fonts) — see
>   `plan.md` → "Cross-platform / running on Windows".
> - **Locked decisions:** [docs/decisions/](docs/decisions/) (ADR-0001…0005 + `OPEN_DECISIONS.md`).
>   **Target architecture/tech-stack:** [docs/architecture/](docs/architecture/).
>   **Research (incl. the green de-risk spike):** [docs/research/](docs/research/).
>
> **The app is now a SINGLE world: the PM/SuperDoc-fork engine is the ONLY editor.**
> Phase 1 (Scaffold) built the renderer on **electron-vite + TypeScript** with an **owned, vendored
> ProseMirror engine forked from SuperDoc** (`src/renderer/core/superdoc-fork/`, no `superdoc` npm
> dep). Phase 2 wired every ribbon area onto that engine through the `WC.PM` bridge
> (`src/renderer/bridge/*.ts`): character/paragraph/lists/styles, clipboard + editing-misc, find-replace,
> insert-basics + full Table Tools, file-io (docx/html/txt/csv open + docx/html/txt save), review (Track
> Changes + comments that EXPORT), references (TOC, footnotes/endnotes, citations/bibliography,
> captions/index, cross-reference), and slice 10 (themes, mail-merge, draw, insert-exotica). **Slice 11
> RETIRED the legacy world entirely** — the `--legacy` boot flag, the `contenteditable` `WC.Editor`, the
> leaf legacy engines, and the `mammoth`/`html-to-docx` converter are all gone. The fork's `super-converter`
> is the sole `.docx` path. The parity reference is **Word for Windows 16.0** (COM oracle
> `scripts/oracle/word-oracle-win.ps1`).
> Exact state: [docs/plan/](docs/plan/).

## TL;DR

- **Stack:** Electron 31 shell; renderer built by **electron-vite + TypeScript**. The **owned ProseMirror
  core** (`#pm-editor`, TS/ESM: `src/renderer/main.ts` → vendored fork in `src/renderer/core/superdoc-fork/`,
  single `prosemirror-model` copy, telemetry off) is the **only** editor. The shared chrome (ribbon,
  dialogs, backstage, statusbar) is still vanilla JS on the `window.WC` namespace — classic `<script>` tags
  under `src/renderer/public/js/` — kept as-is; its WC→TS/ESM migration is DEFERRED to a future slice. Main
  process (plain CJS) owns fs + `.docx` via the `window.wordAPI` `contextBridge` bridge.
- **Document:** `#pm-editor` driven by the `WC.PM` bridge (`src/renderer/bridge/*.ts` — commands/io/
  state-sync/focus). The page sheet is continuous-flow; real multi-page sheets are Phase-7-gated — see
  [docs/PAGINATION.md](docs/PAGINATION.md).
- **Ribbon:** data-driven from `WC.RIBBON` (10 tabs / 212 controls) →
  `WC.Ribbon` renders → `WC.Commands` dispatches `H[cmd]` (PM-only — each handler drives the `WC.PM` bridge).
  See [docs/RIBBON.md](docs/RIBBON.md).

## Where to look

| Task | Read |
|------|------|
| **Build the layout engine (Phase 4 — NEXT)** | **[docs/LAYOUT_ENGINE.md](docs/LAYOUT_ENGINE.md)** (+ `docs/plan/deferrals.md` §A feed) |
| Big picture, module map, dispatch | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Libraries / versions / the build (electron-vite + TS) | [docs/TECH_STACK.md](docs/TECH_STACK.md) |
| Add/change a ribbon control | [docs/RIBBON.md](docs/RIBBON.md) |
| Add/remap an icon | [docs/ICONS.md](docs/ICONS.md) |
| Touch pagination/page breaks | [docs/PAGINATION.md](docs/PAGINATION.md) |
| What works per tab | [docs/FEATURES.md](docs/FEATURES.md) + `docs/*_TAB.md` |
| Run / harness / COM oracle | [docs/BUILD_AND_RUN.md](docs/BUILD_AND_RUN.md) |
| Tests | [docs/TESTING.md](docs/TESTING.md) |
| Research "how does X work / what connects to Y" cheaply | [docs/GRAPHIFY.md](docs/GRAPHIFY.md) — query the prebuilt graph instead of reading many files |

## Working rules

1. **Validate against real MS Word.** The dev box has Word reachable from WSL via
   `powershell.exe -ComObject Word.Application`. Use it as ground truth for any
   behaviour/geometry change. **PID-safe:** kill only the spawned WINWORD PID,
   never the user's window (see AGENTS.md → COM oracle). On this machine the
   in-repo macOS oracle (`scripts/oracle/word-oracle.js` — see its README) drives
   Word via AppleScript and supersedes the WSL COM oracle.
2. **Every fix ships a regression test** in `scripts/test-suite-pm.js`. Run all **three gates**
   before committing (after `npm run build`): `test:pm` (PM functional suite), `test:smoke`
   (PM-core smoke), and `test:roundtrip` (the PM-converter docx gate).
3. **Commits & merge mode:** follow `.claude/skills/commit-style/SKILL.md` —
   `type(scope): summary`, a what/why body, explicit `git add <path>`, and **no
   `Co-Authored-By`/AI trailer**. **Merge mode = ff-merge straight to `main` by
   DEFAULT (no GitHub PRs — still the user's commits); `/code-review` still runs.**
   Ask PR-vs-ff once per session/loop and honor it. See SKILL.md → "Merge mode".
4. **Don't hand-edit generated files:** `src/renderer/public/js/ribbon-data.js`
   (`scripts/gen.js`) and `src/renderer/public/js/icons-fluent.js` (`scripts/gen-icons.js`).
5. **Mind the gotchas** in AGENTS.md (no `window.prompt`, the `WC.PM` bridge is the only
   document-write path, generated files).

## Quick commands

```bash
npm start                                   # build (electron-vite) + run the app

# Gate suites — always build first:
npm run build && npm run test:pm            # PM functional suite (grows per slice)
npm run build && npm run test:smoke         # PM-core smoke (9)
npm run build && npm run test:roundtrip     # PM-converter docx round-trip (THE docx gate)
```

<!-- SPECKIT START -->
Active spec-kit plan: [specs/001-paged-render-migration/plan.md](specs/001-paged-render-migration/plan.md)
(Paged Render Migration — **Milestone 5**: paged .docx export ↔ Word-COM-oracle parity; M4 COMPLETE).
M1+M2+M3+M4(a–d) done (archived under specs/001-paged-render-migration/milestones/). Sequencing is owned by
[docs/plan/layout-engine-runbook.md](docs/plan/layout-engine-runbook.md).
<!-- SPECKIT END -->
