# Re-Discovery Campaign — repeatable playbook for re-baselining bugs + feature gaps

> **Purpose.** The `docs/bug-hunt/` corpus (65-bug ledger + 76-feature improvements + 321-control fidelity
> audit) was produced **2026-06-17 against `main @ 621da99…5f71cfa`** — *before* the paged-render migration,
> features 002–013, and the page-break work. It is **stale**. This doc is the **re-runnable roadmap** to
> re-baseline bug discovery + feature-improvement discovery against the *current* paged codebase, and to emit a
> prioritized backlog that drives the **Completeness Pass**.
>
> Re-run this whenever the engine or a large batch of features has changed enough that the ledger can no longer be
> trusted. It re-uses the proven method + tooling; it does **not** re-invent them.

## Objective & success criteria
- Re-classify **all 212 ribbon controls across 10 tabs** with *current* evidence.
- Emit a **fresh** `BUG-LEDGER.md` + `FEATURE-IMPROVEMENTS.md` + `FIDELITY-AUDIT.md` (dated), superseding the stale
  ones; **archive** (never delete) the prior corpus under `docs/bug-hunt/archive-<date>/`.
- Emit a **prioritized, grouped spec-kit backlog** — still-valid bugs + feature gaps bundled into feature-sized
  buckets, each ready to enter the Completeness Pass loop.
- Discovery only: this campaign re-defines *what* is broken/missing and *in what order*. Fixing is the separate
  per-feature Completeness Pass loop (specify→plan→tasks→spike→implement→verify→merge).

## The inventory (what to walk)
The authoritative enumeration is the **live ribbon** — `WC.RIBBON`, **10 tabs / 212 controls**, data-driven from
`src/renderer/public/js/ribbon-data.js` (generated; do not hand-edit). Each control maps to an `H[cmd]` handler
(`src/renderer/public/js/commands.js`) → the `WC.PM` bridge (`src/renderer/bridge/*.ts`). The 10 areas:
**Home · Insert · Draw · Design · Layout · References · Mailings · Review · View · File/Backstage.** This
supersedes the old hand-built 321-control list (which over-counted dropdown sub-items). Use `docs/GRAPHIFY.md` +
`graphify-out/` for cheap "what connects to this control / where is X handled" lookups.

## Severity & classification taxonomy (reused)
- **Bugs — severity:** S1 crash/data-loss/corruption · S2 major wrong behavior or export corruption · S3
  fidelity/visual deviation (content survives) · S4 minor/cosmetic · S5 confirmed-as-expected (a verified deferral).
- **Feature gaps — state:** works · partial · stub (UI present, no real effect) · missing · wrong.
- **Feature gaps — priority:** P1 core · P2 · P3 niche.

## Method — the hybrid loop (per control)
1. **State Word's real outcome** — the doc/OOXML change, panes, dialogs, contextual tabs, pressed-state, live
   preview. Sources: the per-tab docs (`docs/<TAB>_TAB.md`), `docs/FEATURES.md`, and the live Word oracle.
2. **Headless probe** — drive `H[cmd]` on the dev app; capture the PM model + exported OOXML + a screenshot
   (`electron . --shot-evalfile=<probe.js> --probe-out=<json> --shot=<png>`).
3. **COM oracle read-back** — save the bytes and read them back through real Word
   (`scripts/oracle/validate-*.ps1` via `com-validate.js`); this is ground truth for export/round-trip claims.
   **Validate export bugs via the real `.docx` package, not `exportXmlOnly`** (it omits w14 run effects — the
   lesson behind BUG-051/054).
4. **Classify** — works/partial/stub/missing/wrong; bugs get S1–S5, gaps get P1/P2/P3; attach evidence (file:line
   + probe/oracle JSON).
5. **Live spot-check (the hybrid layer)** — for render/visual-prone controls (pagination, floating objects,
   tables-across-pages, headers/footers, page geometry, text effects, view modes) drive the running app via
   computer-use and compare to **real Word side-by-side**. *(New since 2026-06-17: computer-use CAN drive the dev
   Electron app — `request_access(['electron.exe'])`, productName='Word', the 'Word User' avatar distinguishes it
   from real Word. This corrects the old "real-app verify BLOCKED" note.)*
6. **Adversarial re-verify** — a second agent tries to **refute** each flagged finding before it lands (the
   `docs/UI_FIDELITY_AUDIT.md` discipline that cut 81 flags → 53 real). Refute reasons: already fixed by 002–013,
   a harness artifact, Word-parity-correct, or a documented deferral.

## Execution — phased (so cost tracks value)
- **Phase 1 — classification sweep (multi-agent, code+docs+graphify, NO app runs).** One finder agent per tab
  re-classifies every control by reading its handler→bridge path, comparing to Word's documented behavior, and the
  prior ledger/audit as *priors to re-test* (not truth). Each finding carries `needsRuntime` / `needsLive` flags.
  An adversarial verify stage refutes/confirms each flagged finding (re-checking against 002–013 + the paged
  engine). A synthesis stage merges to a candidate ledger + audit + grouped backlog. **Fast, parallel; produces the
  bulk of the re-baseline.**
- **Phase 2 — runtime + COM confirmation.** For every `needsRuntime` finding, run the headless probe + COM oracle
  (sequential, careful — the harness uses a shared profile/screenshot dir). Promotes candidates to confirmed bugs
  with evidence; demotes harness artifacts.
- **Phase 3 — live spot-checks.** Drive the app + real Word side-by-side (computer-use) for the `needsLive`
  render/visual findings. Needs the dev machine; runs as a follow-up, does not block Phases 1–2.

## Outputs
- `docs/bug-hunt/archive-<date>/` ← the prior (stale) corpus, moved intact.
- Fresh `BUG-LEDGER.md` + `FEATURE-IMPROVEMENTS.md` + `FIDELITY-AUDIT.md` (dated), evidence per control.
- A **grouped, prioritized spec-kit backlog** — buckets like "mail-merge field codes", "text-effects export",
  "view modes", "table contextual completeness", each = one candidate Completeness-Pass spec-kit feature.

## How it feeds the Completeness Pass
The grouped backlog is the **input** to the per-feature loop in `docs/plan/execution-map.md` → the COMPLETENESS
PASS: `/speckit-specify → /speckit-plan → /speckit-tasks` → probe-first spike → implement (no-fork, `WC.PM` bridge
only, page-free model) → verify (the 4 gates + Word-COM oracle + `/code-review` fix-loop) → ff-merge → checkpoint.
No ad-hoc fixes; every fix ships a regression test + (for fidelity) Word-COM validation.

## Provenance
Designed via the brainstorming skill on 2026-06-25 (scope = full re-baseline; method = hybrid headless sweep + live
spot-checks). Supersedes the 2026-06-17 campaign recorded in the (now-archived) ledger header.
