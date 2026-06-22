<!--
SYNC IMPACT REPORT
Version change: (template/unratified) → 1.0.0
Rationale: First ratification — codifies the repo's standing binding rules
  (CLAUDE.md / AGENTS.md / the post-migration spec-kit loop) into a formal
  constitution. MINOR/PATCH N/A on first adoption.
Principles defined (7):
  I.   No Fork Edits (vendored engine is read-only)
  II.  Single Document-Write Path (the WC.PM bridge)
  III. Page-Free Document Model
  IV.  Real-Word Fidelity, Oracle-Validated
  V.   Test-Gated, Regression-Covered Changes
  VI.  Spec-Kit-Driven, Incremental Delivery
  VII. Generated Files Are Never Hand-Edited
Added sections: Engine & Architecture Constraints; Development Workflow & Quality Gates; Governance.
Removed sections: none (template placeholders replaced).
Templates reviewed for alignment:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate maps to Principles I–VII (verify per plan).
  ✅ .specify/templates/spec-template.md — no conflict (specs stay implementation-agnostic; fidelity = the Word oracle).
  ✅ .specify/templates/tasks-template.md — no conflict (per-task test/oracle steps reinforce Principle V).
Deferred TODOs: none. RATIFICATION_DATE set to first-adoption date (2026-06-22).
-->

# ms-word-clone Constitution

A faithful Microsoft Word desktop clone (Electron + electron-vite + TypeScript) built on an
**owned ProseMirror engine forked from SuperDoc**, being repurposed into a computer-use-agent
(CUA) RL / eval environment. These principles are **non-negotiable** and govern every change.
They exist because the engine is a vendored fork and the product's whole value is **fidelity to
real Microsoft Word** — both are easy to violate silently, so the rules are written to be testable.

## Core Principles

### I. No Fork Edits (the vendored engine is read-only)

The vendored fork under `src/renderer/core/superdoc-fork/**` MUST NOT be edited to ship a feature.
Reach every capability through the fork's **public APIs** (`editor.commands.*`, `editor.doc.*`,
`editor.converter.*`) or an **owned bridge write** in `src/renderer/bridge/**`. If a capability
appears unreachable no-fork, run a **probe-first spike** to find the public seam and record it; a
minimal, documented fork accessor is a **last resort that requires an explicit decision in the
plan's Complexity Tracking** — never a silent edit. *Rationale: the fork is upstream-trackable and
license-bound; in-tree edits rot on every rebase and hide behavior from review.*

### II. Single Document-Write Path (the WC.PM bridge)

All document mutations MUST go through the `WC.PM` bridge (`src/renderer/bridge/*.ts`). No other
layer — ribbon handlers, overlays, chrome scripts — may write the document directly; they call
bridge verbs. Render overlays are **READ-ONLY** with respect to the document (they paint from the
DOM/model, never mutate it). *Rationale: one write path keeps undo, export, and state-sync correct
and auditable; scattered writes are the source of the hardest desync bugs.*

### III. Page-Free Document Model

The document model stays **page-free**. Pages are a **render concern** produced by the paged
engine, never modeled, persisted, or referenced by document data. Layout properties live where
OOXML puts them (`sectPr`, `pPr`, `rPr`, …), not in invented page nodes. *Rationale: a page-free
model is what lets the same document round-trip to `.docx` and re-paginate freely.*

### IV. Real-Word Fidelity, Oracle-Validated

Every **fidelity claim** (geometry, OOXML, read-back behavior) MUST be verified by reading it back
from **real Microsoft Word for Windows** via the dev-box-only Word-COM oracle
(`scripts/oracle/*-win.ps1` through `com-validate.js`). The oracle MUST be **sandbox-disabled and
PID-safe** — spawn an isolated hidden WINWORD, open with `OpenAndRepair:=false`, and in `finally`
kill **only the spawned PID**, never the user's open Word. XML inspection is a fast pre-check, not a
substitute for the oracle. *Rationale: "it looks right / the XML looks right" has repeatedly
disagreed with what Word actually reads — only Word is ground truth.*

### V. Test-Gated, Regression-Covered Changes

Every change ships a **regression test** and keeps the gates green. The four core gates MUST pass
before merge: `test:pm` (475, OVERLAY build) · `test:smoke` (9) · `test:roundtrip` (27) ·
`test:bundle` (4); plus the feature's **paged probe** (`scripts/paged-*-probe.js`, real renderer,
paged + overlay-parity) and `test:roundtrip:paged` wherever a fidelity claim is made. A test that
can pass while the feature is broken (false-green) is a defect. *Rationale: the gates are the only
thing that makes "done" mean done across sessions and refactors.*

### VI. Spec-Kit-Driven, Incremental Delivery

Work is delivered as **spec-kit features** under `specs/NNN-*`, never ad-hoc coding. Each feature
runs the chain `specify → clarify → plan → tasks → analyze`, then **probe-first spike →
implement → verify (gates + oracle + code-review fix-loop) → ff-merge → checkpoint (plan-tracking)**.
Features ship as **independently shippable slices** (P1, P2, …), each its own verify/review/merge
cycle. The spec-kit artifacts ARE the cross-session memory. *Rationale: small oracle-gated slices
keep risk bounded and let any session resume from `tasks.md`.*

### VII. Generated Files Are Never Hand-Edited

Generated files MUST be changed via their generator, never by hand: `ribbon-data.js`
(`scripts/gen.js`) and `icons-fluent.js` (`scripts/gen-icons.js`). *Rationale: hand edits are
silently overwritten on the next generate and desync the source of truth.*

## Engine & Architecture Constraints

- **Paged is the shipping engine.** The SuperDoc PresentationEditor (real per-page sheets) is the
  default; the legacy continuous-flow **overlay** engine is legacy, reachable only via
  `WC_LAYOUT=overlay npm run build`, and is slated for retirement. New rendering work targets paged.
- **`test:pm` validates the OVERLAY engine** (build overlay first; a boot-guard fails loud against a
  paged build). Paged rendering is covered by the dedicated `probe:*` probes + `test:roundtrip:paged`
  (dev-box-only). Do not "fix" `test:pm` by booting it paged.
- **Owned layers vs vendored core.** Owned code lives in `src/renderer/bridge/**` (TS/ESM) and the
  `window.WC` chrome (`src/renderer/public/js/**`); the vendored fork is `src/renderer/core/superdoc-fork/**`.
  The boundary is Principle I.

## Development Workflow & Quality Gates

- **Branching:** never commit feature work directly to `main`. Work on a short-lived branch; cleanup
  features land on the `general-done` integration branch (sub-branch per feature → ff-merge into
  `general-done`); `main` receives reviewed merges only.
- **Per-feature loop:** spec-kit chain → spike → implement → 4 gates + paged probe + Word-COM oracle
  → `/code-review` (or an adversarial-review workflow), fix the confirmed findings → ff-merge →
  renew the runbook + `docs/plan/` + memory.
- **Commits & merge mode:** follow `.claude/skills/commit-style/SKILL.md` (`type(scope): summary`,
  what/why body, explicit `git add <path>`, **no AI trailer**); ff-merge by default, `/code-review`
  still runs.
- **Validation honesty:** report outcomes faithfully — a skipped step, a failing gate, or an
  unverified fidelity claim is stated plainly, never asserted as done.

## Governance

This constitution supersedes ad-hoc practice. **Compliance is verified at the plan's "Constitution
Check" gate** (before Phase 0 and after design) and again at `/code-review` before merge; a plan
that violates a principle MUST either change to comply or record an explicit, justified exception in
its Complexity Tracking. Amendments are made by editing this file via `/speckit-constitution` with a
Sync Impact Report and a semantic-version bump: **MAJOR** = a principle removed or redefined
incompatibly, **MINOR** = a principle/section added or materially expanded, **PATCH** = clarifying
wording. Runtime development guidance lives in `CLAUDE.md` / `AGENTS.md` / `docs/` and must stay
consistent with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-06-22 | **Last Amended**: 2026-06-22
