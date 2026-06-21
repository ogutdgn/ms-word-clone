# Research — Headers & Footers in the paged editor

Grounded in a 6-agent landscape sweep (verified `file:line`). Decisions below; the three genuinely-open ones are
resolved by the **Phase-0 probe-first spike** (Task 0) before any production code.

## Decision 1 — Persistence/export path: the headless story-runtime (not the live PE session)

**Decision**: author + persist all header/footer content through the existing headless story-runtime seam
(`src/renderer/core/superdoc-fork/document-api-adapters/story-runtime/header-footer-story-runtime.ts`,
`resolveHeaderFooterSlotRuntime`), which the current `bridge/header-footer.ts` already uses. Extend it for
variants and fields rather than persisting through the live `HeaderFooterSessionManager` part-sync
(`PresentationEditor.ts:5394-5428`).

**Rationale**: the story-runtime is mode-agnostic, requires no fork edit, and is already Word-COM validated (M5
proved its `word/headerN.xml` + `sectPr` reference output round-trips through real Word). Using one persistence
path avoids a live-session-vs-headless divergence (a flagged risk). The live PE session remains the *editing/
painting* surface; the model write-back goes through the runtime.

**Alternatives considered**: persist via the live session part-sync (richer fidelity for on-page edits, but a
second source of truth + fork coupling + unvalidated). Rejected for v1; revisit only if the spike shows the
runtime can't capture on-page edits faithfully.

## Decision 2 — Architecture: wire in the owned layers, reuse the existing engine

**Decision**: all new logic lands in the owned bridge (`bridge/header-footer.ts`, `bridge/index.ts`,
`bridge/state-sync.ts`) and a new owned chrome module (`public/js/header-footer-tools-pm.js`) + `commands.js`
rewire. The contextual tab follows the proven `picture-tools-pm.js` / `table-tools-pm.js` template
(`ribbon.js:515-575` `showContextualTab`/`hideContextualTab`). The paged engine's existing per-page H/F painting
and double-click editing are reused as-is.

**Rationale**: the contextual-tab infrastructure is alive and proven by two precedents; a HF Tools tab used to
exist (retired) so the pattern fits. Keeping logic in owned layers preserves the fork's re-vendorability and the
single `WC.PM` document-write path.

**Alternatives**: rebuild a bespoke header/footer UI outside the contextual-tab system (more code, breaks the
established ribbon pattern). Rejected.

## Decision 3 — Incremental delivery by user story

**Decision**: land P1 (enter/edit/close + contextual tab + dead-handler rewire + un-defer) first as the MVP, then
P2 (variants), then P3 (page numbers), each its own verify → `/code-review` → ff-merge-to-main → push cycle on the
`feature/headers-footers-paged` branch.

**Rationale**: P1 is independently demonstrable and the prerequisite for P2/P3; incremental landing keeps each
`/code-review` small and each merge low-risk, matching the project's per-slice loop.

## Decision 4 — Dead-code policy

**Decision**: as part of P1, DELETE the dead header/footer command stubs that reference `E()=WC.Editor`
(retired) and `WC.HeaderFooter` (deleted) — `commands.js:399-408,457` — replacing them with real handlers that
drive the bridge + the spike's chosen entry/exit mechanism. Un-defer the now-delivered commands in
`bridge/index.ts` (ENGINE_READY / AREA / DEFERRED).

**Rationale**: leaving throw-on-reach stubs behind a soon-to-be-removed `isBlocked` gate is a latent crash; the
reconciliation is the point of this feature (FR-014).

## Decision 5 — Word-COM oracle: extend + harden

**Decision**: extend `scripts/oracle/validate-headerfooter-win.ps1` to read back, in addition to the primary
header/footer text: `PageSetup.DifferentFirstPageHeaderFooter`, `PageSetup.OddAndEvenPagesHeaderFooter`,
`Headers(wdHeaderFooterFirstPage=2)`/`Headers(wdHeaderFooterEvenPages=3)`/`Footers(...)` `.Range.Text`, and the
page-number field (presence + that it is a real `PAGE` field). Harden it with `OpenAndRepair:=false`
(`validate-open-win.ps1:32` form) so a malformed `.docx` ERRORS instead of being silently repaired, and
SELF-VERIFY the `wdHeaderFooter*` enum ints in-run (1/2/3) — heeding the M6 lesson that PowerShell variable names
are case-insensitive (avoid `$ln`/`$LN`-style collisions).

**Rationale**: the current validator reads only the primary text, so it cannot certify variants or page numbers;
expanding it is required for the P2/P3 acceptance criteria. Hardening matches the project's oracle standard.

**Alternatives**: assert variants only via exported-XML inspection (cheaper, but not real-Word parity). Rejected
for the fidelity-critical claims; XML inspection is kept as a fast in-app pre-check in the probe.

## OPEN — resolved by the Phase-0 spike (Task 0, real paged renderer, isolated probe profile)

### Spike Q1 — IMPORT → RENDER

**Question**: when a Word-authored `.docx` with a header + footer (+ a first-page variant + a `PAGE` field) is
opened, does the paged PE PAINT them per page (does import reach the header/footer registry init; does the header
band show the text)?

**What confirms it**: a probe opens such a fixture and reads the painted `.superdoc-page` header/footer band DOM
and finds the authored text on the right pages. **If import→render is broken**, that becomes a P1 blocker to fix
first (in owned import glue if possible).

### Spike Q2 — ON-PAGE ACTIVATION (the entry mechanism — the central unknown)

**Question**: is there a **no-fork** way to enter/exit header/footer editing programmatically (so the ribbon's
"Go to Header/Footer" + "Close" can drive it), given `HeaderFooterSessionManager.activateRegion/exitMode` are
private (wired only into PE pointer callbacks at `PresentationEditor.ts:5044-5048`)?

**Candidate answers, in preference order**:
1. **Existing accessor** — `WC.presentation` / the inner editor already exposes a path that reaches
   activate/exit. (Probe by enumerating the presentation/editor surface.)
2. **Synthetic-pointer** — dispatch the same double-click/pointer sequence on the painted header band that the PE
   already handles, to trigger activation with zero fork change. (Probe: does in-app double-click-to-edit work at
   all? then can it be synthesized deterministically?)
3. **One minimal public accessor on the fork** (Complexity-Tracking exception) — only if 1 and 2 both fail; a
   single documented passthrough method. Default is to avoid this.

**Decision rule**: pick the highest-preference candidate that the spike proves reliable. Bias to no-fork.

### Spike Q3 — BRIDGE ↔ PAINT CONSISTENCY

**Question**: after `setHeaderText` via the headless story-runtime, does the painted header band update (single
persistence path holds), or do the live session and the headless runtime diverge?

**What confirms it**: a probe sets header text via the bridge and reads the painted band; they match (possibly
after a relayout tick). **If they diverge**, the plan must add a re-render/refresh hook after a runtime commit (in
owned code) so on-page reflects the model — still single-source (the runtime), just with an explicit repaint.
