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

## Merge mode — PR vs ff-merge (ASK the user, then honor it)

The user controls how changes land. `main` is **not** branch-protected and commits are authored by the
user (`git config user.email` = the user) — so BOTH modes show the work as **the user's commits** on
`main`. A PR is only a review wrapper, **not** required for authorship; ff-merge is actually *cleaner*
(linear history, no "Merge pull request" commits, zero PR-tab entries).

**Ask once per session/loop** — unless the user already stated a preference this session or it's recorded
in memory (`merge-mode-ff`): *"Manage changes via PRs, or ff-merge straight to main (no PR)?"* Use that
mode for the rest of the session; switch whenever the user says so.

- **ff-merge mode — DEFAULT (the user's standing preference; memory `merge-mode-ff`).** NO PR, no PR-tab
  noise. Per change:
  1. Do the work on a short-lived **local** branch (so `/code-review` can diff `main...HEAD`).
  2. `npm run build` + the 3 gates + Word-COM validation, as usual.
  3. **Run `/code-review` and address findings — this STILL runs in ff-merge mode.** It reviews the
     `git diff`, not a GitHub PR; opting out of PR *review* ≠ skipping the automated review/quality gate.
  4. Land it locally: `git checkout main && git merge --ff-only <branch> && git push && git branch -d <branch>`.
     Do **not** push the feature branch and do **not** `gh pr create` — no remote branch, no PR.
  5. Checkpoint (plan-tracking) as usual. Low-risk docs/checkpoints may be committed **directly on `main`**
     (no branch) to cut noise further.
- **PR mode.** The classic flow: push the branch, `gh pr create`, `gh pr merge`. Use when the user wants
  to review on GitHub (or asks to gate an unusually risky change).

Either mode: explicit `git add <path>`, the subject/body above, all 3 gates green, and (for fidelity
changes) the Word-COM oracle BEFORE landing. **Force-push only on your own branch, never on `main`.**

## What NOT to do

- Skip hooks (`--no-verify`) — investigate the failing hook.
- Amend a published commit.
- Lump unrelated changes into one commit.
