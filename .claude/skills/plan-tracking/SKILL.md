---
name: plan-tracking
description: Use when starting or ending a work session in ms-word-clone, after finishing a phase or a subsystem branch, or whenever the project's current phase, branch, or next step changes — so docs/plan/ never goes stale.
---

# Plan Tracking

## Overview
`docs/plan/` is the project's living memory across sessions. Three files, three roles. The
core rule: **`last-point.md` must always match reality** — renew it at the end of every session
and whenever state changes, so the next session resumes without guessing.

| File | Holds | Changes |
|------|-------|---------|
| `docs/plan/plan.md` | goal, locked architecture, dev process, phase roadmap | **rarely** (only when strategy changes) |
| `docs/plan/execution-map.md` | session playbook + the **CURRENT PHASE** + next actions | **when the phase advances** |
| `docs/plan/last-point.md` | exact "resume here" snapshot | **every session / every state change** |

## When to use
- **Session START:** read `last-point.md` → `execution-map.md` → `plan.md` to orient (do this
  before touching code).
- **Session END, phase/branch change, or after finishing a subsystem:** update the docs (below).

## How to renew (the procedure)
1. **`last-point.md` — ALWAYS.** Set `Last updated` to today's real date, `Branch` to the
   current branch, and `Current phase`. Rewrite `Done` / `Next` / `Open` / `Blockers` to match
   what is actually true right now. Be concrete (file paths, branch names, test status).
2. **`execution-map.md` — IF the phase advanced.** Update the `CURRENT PHASE` section and its
   concrete next actions to the new phase.
3. **`plan.md` — ONLY if the strategy/roadmap itself changed** (e.g. a phase was added/reordered,
   a process rule changed). Transient state never goes here.
4. **Consistency check:** the phase named in `last-point.md`, `execution-map.md`, and `plan.md`
   must agree. Locked architecture decisions live in `docs/decisions/` (ADRs) — link, don't
   restate; to change one, add a superseding ADR, then reflect it here.
5. **Commit** the doc updates following `.claude/skills/commit-style/SKILL.md`
   (`docs(repo): ...`, explicit `git add docs/plan/...`).

## Quick reference
- Resuming work? → read `last-point.md` first.
- "What phase are we in / what's next?" → `execution-map.md` → CURRENT PHASE.
- "What did we decide and why?" → `docs/decisions/` (ADRs), not these files.

## Common mistakes
- **Ending a session without updating `last-point.md`** → the next session is lost. Always renew it.
- **Putting transient state in `plan.md`** → it belongs in `last-point.md`; `plan.md` is stable.
- **Letting the three docs disagree on the current phase** → run the consistency check.
- **Restating ADR content here** → link to `docs/decisions/` instead; keep one source of truth.
- **Forgetting to commit** the renewed docs → the memory only helps if it's committed.
