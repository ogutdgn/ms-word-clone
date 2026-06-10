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
  against the real code; (3) build; (4) gate on the test suite (228 in-renderer + 9 docx) +
  feature-parity; (5) **update the plan docs via the `plan-tracking` skill**; (6) PR for review.
- **Strangler-fig migration:** stand ProseMirror up *behind* the existing ribbon and flip one
  feature area at a time; never a big-bang rewrite.
- **Pagination is done LAST**, validated against the macOS Word AppleScript oracle.
- **Decisions are append-only ADRs.** To change a locked decision, add a superseding ADR.

## Branching model
- **Never do code work on `main`.** Always **create + checkout a feature branch first**
  (verify with `git branch --show-current` before editing).
- `main` — stable; receives **only reviewed merges at coherent milestones**.
- `research-architecture` — the decision/integration line (current); feature branches start here.
- One **feature branch per phase/subsystem** (e.g. `build/phase-1-scaffold`, `feature/logger`,
  `feature/verifier`, `feature/mcp`) → PR → integration line → `main` at a milestone.

## Phase roadmap
(Order may adjust; logger/verifier/MCP can follow once the editing core is real.)

| Phase | What | Status |
|------|------|--------|
| **0** | Research + architecture decisions (ADR-0001…0005) + de-risk spike | ✅ done |
| **1** | Scaffold: electron-vite + TS; vendor the SuperDoc fork (strip Vue/painter/telemetry); mount the model in our own `EditorView` (closes Q1 last mile) | ✅ done (engine owned, gates green; branch pushed) |
| **2** | Editing core behind the existing ribbon (strangler-fig): commands → PM transactions | **in progress (slices 0a–5 done + on `main`; slice 6 insert-basics + full Table Tools BUILT, PR #23 — PM core is the visible editor; file IO + character/paragraph/lists/styles/clipboard+editing-misc/find-replace/insert-basics flipped & oracle-validated; slice 7 file-io next)** |
| **3** | **Logger** (branch) — `dispatchTransaction` tap + raw capture + outcome serialize + firewall | |
| **4** | **Verifier** (branch) — headless predicates + reward + QA harness + oracle gold | |
| **5** | **MCP server** (branch) — tools/resources, transports, episodes; + pixel RPC | |
| **6** | Hard Word constructs — sections, headers/footers remaining (wiring half absorbed into Phase 2 slices 8–9 per the 2026-06-05 spec; Phase 6 = verification of sections/headers-footers) | |
| **7** | **Pagination** (branch, LAST) — model-driven plugin or borrow layout-engine; validate vs oracle | |
| **8** | `.docx` per-construct round-trip tests vs the Word oracle | |
| **9** | RL env loop + determinism mode + observation bundle + task framework | |
| **10** | Merge into `cua-bench` (resolve relation to its native Qt/LOK `apps/ms-word`) | |

## Pointers
- Decisions: [../decisions/](../decisions/) (ADRs + `OPEN_DECISIONS.md`)
- Architecture / tech stack: [../architecture/](../architecture/)
- Research: [../research/](../research/) (incl. the spike + open-source deep-dive)
- Upstream reference clones: `opensource-solutions/` (gitignored); spike prototype: `spike/` (gitignored)
