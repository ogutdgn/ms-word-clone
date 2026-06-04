---
name: plan-tracking
description: Use when starting or ending a work session in ms-word-clone, after finishing a phase or a subsystem branch, or whenever the project's current phase, branch, or next step changes — so docs/plan/ never goes stale.
---

# Plan Tracking

## Overview
`docs/plan/` is the project's living memory across sessions. Three files, three roles. The
core rule: **append a dated entry to `last-point.md` every session** (newest first, never
overwrite) and **tick the dated Daily work log in `execution-map.md`**, so the accumulated
history shows progression and the next session resumes without guessing.

| File | Holds | Each session |
|------|-------|--------------|
| `docs/plan/plan.md` | goal, locked architecture, dev process, phase roadmap | **rarely** — only when the strategy changes |
| `docs/plan/execution-map.md` | session playbook + **CURRENT PHASE** + the dated **Daily work log** | **tick the Daily work log**; update CURRENT PHASE when the phase advances |
| `docs/plan/last-point.md` | **dated state checkpoints (append-only, newest first)** | **append a new dated entry** (never overwrite) |

## When to use
- **Session START:** read `last-point.md` → `execution-map.md` → `plan.md` to orient (do this
  before touching code).
- **Session END, phase/branch change, or after finishing a subsystem:** update the docs (below).

## How to renew (the procedure)
1. **`last-point.md` — ALWAYS append a new dated entry at the TOP.** A `## <YYYY-MM-DD>` block
   with: **Branch**, **Phase**, a short **State summary**, **Done this session**, **Next**,
   **Blockers/notes**. **Never overwrite older entries** — the accumulated history is the point.
   Use today's real date; be concrete (file paths, branch names, test status).
2. **`execution-map.md` — ALWAYS tick the Daily work log.** Mark completed items `- [x]` (start a
   new `### <YYYY-MM-DD>` block if it's a new day; carry unfinished items forward). **AND** if the
   phase advanced, update the `CURRENT PHASE` section + its next-action checkboxes.
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
- **Overwriting `last-point.md`** instead of appending a dated entry → you lose the progression.
  Always add a new `## <date>` block at the top and leave older ones intact.
- **Ending a session without updating the docs** → the next session is lost. Always append + tick.
- **Putting transient state in `plan.md`** → it belongs in `last-point.md`; `plan.md` is stable.
- **Letting the three docs disagree on the current phase** → run the consistency check.
- **Restating ADR content here** → link to `docs/decisions/` instead; keep one source of truth.
- **Forgetting to commit** the renewed docs → the memory only helps if it's committed.
