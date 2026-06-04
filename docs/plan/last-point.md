# Last Point — current state

> The exact "resume here" snapshot. **Updated every session** via the `plan-tracking` skill.

- **Last updated:** 2026-06-03
- **Branch:** `research-architecture` (4 commits ahead of `main`; nothing pushed yet → see note)
- **Current phase:** **Phase 0 complete → Phase 1 (Scaffold) is next.**
- **Mode:** end of the decision + de-risk session.

## Done
- **Architecture decided + de-risked.** Locked ADR-0001…0005 (CUA pivot · ProseMirror model ·
  **fork SuperDoc's schema + converter + extensions** · lists = paragraph+`numId` · `.docx`
  via the fork). License + effort were dropped as criteria; decided on architecture/fidelity/
  UI-control.
- **De-risking spike GREEN** (`docs/research/2026-06-03-spike-superdoc-fork.md`): headless
  `superdoc@1.38.0` round-trips real `.docx` with **no Vue**; model renders to clean DOM via
  `toDOM` (55/56 nodes) + loads into a fresh independent `EditorState`; closure 185 pkg/148 MB.
  Resolved "how much to fork" → schema + converter + PM extensions, minus Vue/painter, telemetry
  stripped.
- **Documentation in place:** `docs/decisions/` (ADRs + `OPEN_DECISIONS.md`),
  `docs/architecture/` (target arch + tech stack), `docs/research/` (deep-dive + spike),
  `docs/plan/` (this system). CLAUDE.md / AGENTS.md carry the project-direction banner + links.
- Upstream repos cloned to `opensource-solutions/` (gitignored); spike prototype in `spike/`
  (gitignored).

## Next (Phase 1 — Scaffold)
See [execution-map.md](execution-map.md) → "CURRENT PHASE". In short: electron-vite + TS; vendor
the SuperDoc fork (strip Vue/painter/telemetry); mount the model in our own `EditorView` and type
into it (closes the spike's Q1 last mile); keep the Word UI visible.

## Open / not yet decided
The subsystem decisions are intentionally deferred (decide branch-by-branch): pagination engine,
agent transport, logger contract, verifier language, determinism, task framework, repo/merge.
Recommendations + edge cases are in [../decisions/OPEN_DECISIONS.md](../decisions/OPEN_DECISIONS.md).

## Blockers / notes
- None blocking. Decision: keep building on the `research-architecture` line; spin a feature
  branch per subsystem; merge to `main` at a stable milestone.
- This branch was pushed to `origin` at the end of the 2026-06-03 session.
