---
name: commit-style
description: Use before any git commit in ms-word-clone. Defines subject-line scope tags, body detail requirements, staging discipline, and PR-vs-direct-commit guidance.
---

# Commit Style (ms-word-clone)

## Subject line

Format: `<type>(<scope>): <imperative summary>`

`<scope>` is one of:
- `home`, `insert`, `draw`, `design`, `layout`, `references`, `mailings`, `review`, `view`, `help` — a specific ribbon tab's features.
- `editor`, `pagination`, `ribbon`, `icons`, `commands`, `comments`, `formatting` — core renderer subsystems.
- `main`, `ipc`, `docx`, `preload` — main-process / file-IO / conversion code.
- `test` — QA harness / test-suite / oracle scripts only.
- `docs`, `skills`, `repo` — documentation, skills, or repo-root / cross-cutting changes.
- `restructure` — large structural changes (rare).

`<type>` is one of:
- `feat` — new user-visible feature or capability.
- `fix` — bug fix (subject names the bug, not the solution).
- `refactor` — internal restructure with no behaviour change.
- `ui` — visual-only change (no logic).
- `docs` — documentation only.
- `test` — verifier or QA scripts only.
- `chore` — tooling, deps, config.

Imperative form, lowercase first word. Keep under 72 chars.

## Body — required for all non-trivial commits

Always include a body. One blank line after the subject, then:

**What changed** — bullet list of concrete changes (files/components/behaviour). Be specific: name the components, functions, or files touched.

**Why** — one or two sentences explaining the motivation. What problem does this solve, or what goal does it serve?

**Impact notes** (include when relevant):
- `Validation: Word COM oracle <name>` — when behaviour was validated against real MS Word.
- `Tests: N pass / 0 fail` — when the test-suite was run.
- `Breaking: <what>` — if any data-id, API, or save-format contract changed.

## Trailer

**Do NOT add `Co-Authored-By: Claude` or any AI authorship trailer.** Never.

## Staging

- Stage files explicitly by path — never `git add .` or `git add -A`.
- Run `git diff --cached --stat` before committing to verify the staged set.
- Never commit: `node_modules/`, `dist*`, `out/`, `*.log`, `.DS_Store`, credentials, agent log dumps, `package-lock.json` (unless deps actually changed intentionally).

## When to PR vs commit direct to branch

- **Direct commit**: single-concern change on a feature branch, already reviewed in conversation.
- **PR**: anything touching the save/docx format, the test harness, or 5+ files — create a PR so it can be reviewed before merging to main.
- Force-push only on your own branch, never on main.

## What NOT to do

- Skip hooks (`--no-verify`) — investigate the failing hook.
- Amend a published commit.
- Lump unrelated changes into one commit.
