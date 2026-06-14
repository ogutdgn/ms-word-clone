# Plan — ms-word-clone → CUA RL environment

> The **general, agreed plan**. Stable; changes only when the strategy itself changes.
> Companion docs: [execution-map.md](execution-map.md) (what to do in a session) ·
> [last-point.md](last-point.md) (exact current state). Decisions: [../decisions/](../decisions/).

## Goal
Turn the Electron MS Word clone into a **computer-use-agent (CUA) reinforcement-learning /
evaluation environment** (logger + verifier + MCP), which later merges into the `cua-bench`
monorepo. (ADR-0001.)

## Locked architecture (de-risked, spike GREEN)
**Fork SuperDoc's document core** — its ProseMirror **schema** + its **OOXML converter** +
its PM **extensions** (commands/plugins/keymaps) — vendor/pin/own it, **drop the Vue UI +
painter + telemetry**. Render the model in **our own** ProseMirror `EditorView` with **our
CSS** and **our existing `WC.RIBBON` UI**. Instrument with our **logger** (taps
`dispatchTransaction`), **verifier** (headless query of the model / OOXML), and **MCP server**
(Electron main). See ADR-0002…0005 + [../architecture/TARGET_ARCHITECTURE.md](../architecture/TARGET_ARCHITECTURE.md).

## The two hard constraints (never violate)
1. **UI fidelity:** keep looking/behaving like Microsoft Word (ribbon, page sheets, dialogs).
2. **Feature preservation:** lose **no** already-implemented feature.

## Development process (how we work)
- **Foundation first, then subsystems branch-by-branch.** The foundational decisions are
  locked; each subsystem (logger, verifier, MCP, pagination, …) is designed **when we reach
  it, on its own branch**, against the now-real code — not up front on paper.
- **Each subsystem branch:** (1) read its recommendation + edge cases in
  [../decisions/OPEN_DECISIONS.md](../decisions/OPEN_DECISIONS.md); (2) confirm or adjust it
  against the real code; (3) build; (4) gate on the three suites (test:pm / test:smoke / test:roundtrip) +
  feature-parity; (5) **update the plan docs via the `plan-tracking` skill**; (6) PR for review.
- **Strangler-fig migration:** stand ProseMirror up *behind* the existing ribbon and flip one
  feature area at a time; never a big-bang rewrite.
- **Pagination / layout engine is Phase 4** (re-sequenced 2026-06-14 from "last"): built to clear
  the layout-coupled bugs flagged during the Phase-3 ribbon-hardening pass; validated against the Word oracle.
- **Decisions are append-only ADRs.** To change a locked decision, add a superseding ADR.

## Branching model
- **Never do code work on `main`.** Always **create + checkout a feature branch first**
  (verify with `git branch --show-current` before editing).
- `main` — stable; receives **only reviewed merges at coherent milestones**.
- `research-architecture` — the decision/integration line (current); feature branches start here.
- One **feature branch per phase/subsystem** (e.g. `build/phase-1-scaffold`, `feature/logger`,
  `feature/verifier`, `feature/mcp`) → PR → integration line → `main` at a milestone.

> **Re-sequenced 2026-06-14 (user decision):** primary goal = a **fully working editing env first**.
> So Phase 3 is now a **ribbon tab-by-tab hardening pass** (bugs + scope finalization + the ribbon
> **state machine**), Phase 4 is the **pagination / layout engine** pulled up from old "last", and
> logger/verifier/MCP follow at 5/6/7. Layout-coupled bugs found in Phase 3 are **flagged as the Phase-4
> spec** (`deferrals.md` §A.1), never hacked. See `execution-map.md` CURRENT PHASE + `SCOPE.md`.

## Phase roadmap
(Order may adjust; logger/verifier/MCP follow once the editing core is hardened.)

| Phase | What | Status |
|------|------|--------|
| **0** | Research + architecture decisions (ADR-0001…0005) + de-risk spike | ✅ done |
| **1** | Scaffold: electron-vite + TS; vendor the SuperDoc fork (strip Vue/painter/telemetry); mount the model in our own `EditorView` (closes Q1 last mile) | ✅ done (engine owned, gates green; branch pushed) |
| **2** | Editing core behind the existing ribbon (strangler-fig): commands → PM transactions | ✅ **done (all slices 0a–11).** PM core is the only editor; character/paragraph/lists/styles/clipboard+editing-misc/find-replace/insert-basics+full-Table-Tools/file-io/review/references/mail-merge/themes/insert-exotica/draw flipped & oracle-validated; **slice 11 retired the dual-world scaffolding** (legacy editor/converter/`--legacy` flag/3 legacy gates removed; −4229 lines; gates PM 326 · smoke 9 · roundtrip 27). Editing core COMPLETE → Phase 3 (ribbon hardening) next. |
| **3** | **Editing-core hardening + scope finalization** (branch-per-tab) — ribbon **tab-by-tab** bug-fix pass (research → compare-vs-live-clone → fix), the ribbon **state machine** (enablement + latch), `docs/SCOPE.md` (in/out scope), and **flagging layout-coupled bugs as the Phase-4 spec** (`deferrals.md` §A.1) | ◀ **current** |
| **4** | **Pagination / layout engine** (branch; pulled up from old "last") — model-driven PM plugin + overlay: multi-page + floating-object positioning + text-wrap; built to **clear the Phase-3 layout flags**; validate vs the Word oracle | |
| **5** | **Logger** (branch) — `dispatchTransaction` tap + raw capture + outcome serialize + firewall | |
| **6** | **Verifier** (branch) — headless predicates + reward + QA harness + oracle gold | |
| **7** | **MCP server** (branch) — tools/resources, transports, episodes; + pixel RPC | |
| **8** | Hard Word constructs — sections, headers/footers verification (wiring half absorbed into Phase 2 slices 8–9 per the 2026-06-05 spec) | |
| **9** | `.docx` per-construct round-trip tests vs the Word oracle | |
| **10** | RL env loop + determinism mode + observation bundle + task framework | |
| **11** | Merge into `cua-bench` (resolve relation to its native Qt/LOK `apps/ms-word`) | |

## Pointers
- Decisions: [../decisions/](../decisions/) (ADRs + `OPEN_DECISIONS.md`)
- Architecture / tech stack: [../architecture/](../architecture/)
- Research: [../research/](../research/) (incl. the spike + open-source deep-dive)
- Upstream reference clones: `opensource-solutions/` (gitignored); spike prototype: `spike/` (gitignored)
