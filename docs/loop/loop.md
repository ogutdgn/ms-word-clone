# The Completion-Driven Agent Loop — contract

> **What this is:** the standing contract for the autonomous loop that finishes **Phase 2**
> (slices 8 → 9 → 10a–d → 11) of ms-word-clone. Each iteration is one slice (or one
> slice-10 engine PR). The per-iteration prompt is [loop-prompt.md](loop-prompt.md); the
> deferred/excluded ledger is [deferrals.md](deferrals.md). Nothing here duplicates project
> state — single sources of truth are linked below.

## Goal (the done-condition, written down first)

The clone behaves **exactly like Microsoft Word** in UI, features, buttons, popups,
dialogs, and in-document behavior ("flow") for every ribbon tab — verified feature-by-
feature against **real Word running side-by-side under computer use** (screenshots /
screen comparison), with all six test gates green. Exclusions: the **Phase-7 /
pagination-gated list** and the **cloud-runtime stubs** — both enumerated in
[deferrals.md](deferrals.md), never re-litigated mid-loop.

The loop is COMPLETE when slice 11 is merged, all six gates are green on
`completion-driven-agent-loop`, the deferrals ledger is current, and the agent outputs
the literal completion promise **`PHASE2-COMPLETE`**.

## Scope

- **In:** Phase 2 slices **8** (review: comments, track changes, proofing), **9**
  (references: footnotes/endnotes, TOC, citations, captions), **10** (FOUR independent
  PRs: themes · mail-merge · draw/ink · insert-exotica), **11** (legacy retirement).
- **Out:** project Phases 0/1 (done), slices 0a–7 (done, merged to `main` via PRs
  #10–#24), Phases 3–7 (logger/verifier/MCP/hard-constructs/pagination — after this loop).

## Branch policy (user-mandated)

- All loop work integrates into **`completion-driven-agent-loop`** (branched off `main`
  post-PR-#24). Per slice: branch `feature/phase-2-slice-N-<name>` **off
  `completion-driven-agent-loop`**, PR **based on `completion-driven-agent-loop`**, merge
  there when the slice's gates + parity checklist are green.
- **NEVER merge to `main`.** The user reviews the whole branch at loop end and decides.

## Step 0 — Windows environment replication (ONE TIME, BEFORE ANY SLICE)

This loop runs on the user's **Windows PC**; everything below must be done first.

1. **Permissions UP FRONT (user-mandated — do not defer):** at the very start of the
   first iteration, request **all** computer-use access the whole loop will need in ONE
   go: **Microsoft Word**, **the clone app** (the dev Electron app — run `npm start`
   first so it's resolvable; it may appear as "Electron"), and the **file manager**
   (Explorer). The user approves once and never has to wait at a prompt mid-loop again.
   If any later step discovers a missing grant, request it immediately, not lazily.
2. **Toolchain check:** repo cloned, `npm install`, `npm run build`, then ALL SIX gates
   green on Windows (`test:pm` 206, `test:legacy` 257, `test:smoke` ×2 9/9,
   `test:docx` 17, `test:roundtrip` 27). Shell notes: PowerShell — no `pkill`
   (use `taskkill /IM electron.exe /F`), no `/tmp` (probe `--probe-out` paths work
   anywhere writable, e.g. `%TEMP%`; update run patterns, NOT the repo's npm aliases —
   verify the aliases work as-is first).
3. **Port the oracle to Windows COM — keep BOTH oracles:** create
   `scripts/oracle/word-oracle-win.ps1` (or a Node wrapper spawning PowerShell)
   implementing the same verbs as the Mac `word-oracle.js` (`read-props`,
   `read-word-props`, `read-para-props`, `read-style-props`, `roundtrip`) against
   `Word.Application` COM, same JSON output shapes, same PID-safety rules (only ever
   close documents the harness opened; NEVER quit the user's Word). The Mac
   AppleScript oracle stays untouched. Validate the port live against real Windows Word
   (open a fixture, read props, roundtrip with no repair prompt), then add a **Windows
   section to `scripts/oracle/README.md`** (which oracle per platform + the Windows
   quirks discovered). The repo's git history has `*_probe.ps1` COM probes as prior art.
4. **Reference-target note (record in the Step-0 checkpoint):** slices 1–7 were
   oracle-validated against **Word for Mac 16.77.1**; from slice 8 onward the parity
   reference is **Word for Windows** (the user's machine — and the truer reference: the
   clone's ribbon is the M365/Windows-style ribbon). Slice-by-slice parity work uses
   Windows Word only; do not retroactively re-validate 1–7 unless a regression surfaces.
5. Checkpoint Step 0 via plan-tracking (dated entry in `docs/plan/last-point.md`) and
   commit the oracle port to `completion-driven-agent-loop` before starting slice 8.

## Per-slice procedure (one iteration)

1. **Orient (startup ritual):** read `docs/plan/last-point.md` (top entry, incl. the
   previous iteration's next-slice definition) → `docs/plan/execution-map.md` (CURRENT
   PHASE) → the spec section for the slice
   (`docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md` §9.1). Verify all
   six gates green on `completion-driven-agent-loop` before touching code.
2. **Capture the Word-side spec FIRST (computer use):** in real Word, walk every
   feature/control/dialog the slice covers; screenshot each dialog, pane, popup, menu,
   and the in-document outcome of each action. Save to `.oracle-probes/sliceN/word-ref/`.
   From these, write the slice's **parity checklist** at
   `.oracle-probes/sliceN/parity.md` — one line per feature/flow/dialog, ALL initially
   `[ ]` (failing). **Checklist items may never be deleted or weakened — only flipped
   after verified parity** (the screenshots are the evidence).
3. **Plan:** per-slice plan file in `docs/superpowers/plans/` (the established template:
   red tests → fork/bridge → entry points → flip → gates → verification → checkpoint →
   PR), hardened by an adversarial critique pass (agent critics verifying claims against
   the real code) + author pre-verification of the riskiest claims. Commit the plan.
4. **Execute** subagent-driven: red `[N]` tests first, two-stage review (spec, then
   quality) per task, fixes re-reviewed. Per-task commits per the commit-style skill.
   Subagent briefs always carry: never switch git branches; curly-quote byte-check
   after edits; build before suites; probe-harness return contract; never weaken tests.
5. **Gates:** all six suites green.
6. **The inner loop (execute ↔ compare ↔ fix):** run the clone (`npm start`) and real
   Word side-by-side under computer use. For every parity-checklist item: perform the
   same action in both → screenshot both → compare UI, popup/dialog content, and the
   in-document result. Mismatch ⇒ a fix task (subagent-driven, with a regression test
   when the mismatch is behavioral) ⇒ re-compare. Iterate until every item is `[x]`
   (excluding items moved to [deferrals.md](deferrals.md) with justification — moving an
   item there requires it to be Phase-7-gated, cloud-runtime, or an explicitly recorded
   product decision; never "hard to fix").
7. **Oracle legs** (document-level fidelity, spec §8.3): clone→Word and Word→clone via
   the Windows oracle; verdicts JSON in `docs/superpowers/plans/notes/`.
8. **Merge:** PR into `completion-driven-agent-loop`; merge when green.
9. **Checkpoint + next-slice definition:** plan-tracking entry in `last-point.md` that
   ENDS with a `### Next slice definition` subsection — the detailed brief the next
   iteration orients from (goal, spec rows, known entry points, carry-overs, risks).
10. Continue to the next slice. Context compaction is automatic; ALL durable state is in
    the repo files named here.

## Guardrails

- **No "not implemented" toasts survive the loop** (user-mandated): every slice removes
  its blocks; slice 11 sweeps the remainder. Cloud-runtime controls get graceful,
  Word-like degraded behavior — the final list is presented to the user at loop end.
- Tests/checklist items are never deleted/weakened to pass; the frozen-legacy rule holds
  until slice 11; generated files never hand-edited; fork edits NOTICE'd.
- **Stop conditions:** (a) `PHASE2-COMPLETE`; (b) a blocker only the user can resolve
  (OS permission dialogs that computer use cannot click, Word licensing, hardware) —
  document it in `last-point.md`, notify, and stop; (c) the runner's `--max-iterations`
  safety cap.
- One slice (or one slice-10 engine PR) per iteration — never two.

## State files (single sources of truth — do not duplicate)

| Role | File |
|---|---|
| Requirements/spec | `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md` |
| Task list / current phase | `docs/plan/execution-map.md` + the per-slice plan file |
| Progress log (append-only) | `docs/plan/last-point.md` |
| Build/run/test commands | `AGENTS.md`, `CLAUDE.md` |
| Parity evidence | `.oracle-probes/sliceN/parity.md` + screenshots |
| Deferred / excluded | [docs/loop/deferrals.md](deferrals.md) |
| This contract | `docs/loop/loop.md` |
| Per-iteration prompt | `docs/loop/loop-prompt.md` |
