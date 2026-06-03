# ADR-0001 — Repurpose the app into a CUA RL/eval environment

- **Status:** Locked
- **Date:** 2026-06-03
- **Supersedes:** the app's original goal ("a faithful standalone MS Word clone")

## Context
The ms-word-clone is a working Electron + vanilla-JS MS Word clone. Its new purpose is to
become a **reinforcement-learning / evaluation environment for teaching and training
computer-use agents (CUA)** — agents that operate a GUI by looking at the screen and
emitting mouse/keyboard actions. The app will eventually **merge into the monorepo
`new_coding/cua-bench`** (which already hosts an `apps/figma` environment and a separate
native `apps/ms-word`), and conform to its conventions.

The clone's value as an environment is **controllability, observability, verifiability,
and determinism** — things real MS Word (a closed box) cannot provide. Building a clone we
own lets us instrument every action and grade every outcome.

## Decision
Build the clone into a CUA environment with three new subsystems, while preserving the
Word-identical UI and all existing features:

1. **Logger** — captures full agent trajectories (what it saw, what it did, the resulting
   document state) for RL training and offline analysis.
2. **Verifier** — a programmatic grader that computes a **reward** by inspecting the
   ground-truth document state against a task goal.
3. **MCP server (+ a thin RPC for pixel actions)** — exposes the environment
   (reset / observe / act / reward + semantic tools) to agents.

The environment must be operable from **both** low-level **pixel** actions (true
computer-use) and high-level **semantic** tools, both converging on one authoritative
document model.

## Options considered
- **Drive real MS Word** (via COM/AppleScript) instead of a clone. *Rejected:* closed box —
  no reliable ground-truth state access, no clean reset/snapshot, no instrumentation.
- **Keep the clone as-is (DOM-as-model) and bolt on logging/grading.** *Rejected:* the DOM
  provides no structured, queryable ground truth → see ADR-0002.

## Rationale
A controllable clone is the only way to get a perfect verifier + logger. This is also where
the field is going (OSWorld, WebArena, AndroidWorld, WindowsAgentArena all build
app-grounded environments; office productivity is a major CUA benchmark category).

## Edge cases & risks
- **Skill transfer:** the clone must be Word-*faithful* enough that skills learned here
  transfer to real Word — there is a fidelity *floor* even though we don't need pixel-perfect
  consumer fidelity. (Drives the "looks exactly like Word" constraint and ADR-0003/0005.)
- **Determinism:** RL needs reproducible episodes — pinned fonts/DPI, seeded RNG/clock,
  version pins, view = pure function of model. (See OPEN_DECISIONS → Determinism.)
- **Privileged-state leakage:** the agent's observation must never contain the
  ground-truth/target (the verifier reads it privately). (See OPEN_DECISIONS → Logger.)
- **Two action modalities** (pixel vs semantic) must converge on one model, or the verifier
  becomes action-dependent.

## Consequences
- Forces a structured, serializable document model → ADR-0002.
- Adds logger/verifier/MCP subsystems (open decisions) on top of the model.
- The app will conform to `cua-bench` conventions on merge (log contract, task layout).
- Determinism + oracle-based gold generation become first-class concerns.

## Related
- Research: [`../research/2026-06-02-rl-cua-rearchitecture-notes.md`](../research/2026-06-02-rl-cua-rearchitecture-notes.md)
- ADR-0002 (the model), OPEN_DECISIONS (logger/verifier/MCP/determinism).
