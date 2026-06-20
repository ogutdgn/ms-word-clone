# Layout-Engine (Paged Render Migration) — Execution Runbook

> **The single live doc for EXECUTING the Option-B layout-engine migration.** It holds
> (1) the locked decisions, (2) how we work (the per-milestone loop), (3) the milestone
> checklist, and (4) the **Current Status** (bottom) — where we are + what's next.
>
> **A new session resumes by reading this file top-to-bottom and continuing from
> "Current Status".** Keep the **Current Status** section up-to-date EVERY session
> (this is part of the `plan-tracking` discipline). [plan.md](plan.md) /
> [last-point.md](last-point.md) / [execution-map.md](execution-map.md) point HERE for
> the layout-engine execution state, so this is the one place that must not go stale.

**Pointers**
- Spec (the WHAT): [../../specs/001-paged-render-migration/spec.md](../../specs/001-paged-render-migration/spec.md) — US1–US4, FR-001..013, SC-001..007
- What's already proven + the retarget surface: [../layout-engine-standup-findings.md](../layout-engine-standup-findings.md)
- Memory: `layout-engine-redesign`, `merge-mode-ff`

## How to start a session (resume here)

> A new session can begin by reading THIS file and following the steps below — no external
> prompt needed. (One-liner that's enough to paste: *"Read docs/plan/layout-engine-runbook.md
> and follow it; start from Current Status."*)

1. Confirm you are on the `layout-engine` branch: `git branch --show-current`.
2. Read this runbook in full + orient via the **Pointers** above (spec, standup findings, memory). Then read **[Current Status](#current-status--keep-this-up-to-date-every-session)** (bottom) and continue from there.
3. Follow the **per-milestone loop** below EXACTLY. Non-negotiable guardrails:
   - **ONE milestone at a time.** Do not run ahead.
   - **PLAN FIRST:** run `/speckit-plan` scoped to the **CURRENT milestone ONLY** (not all 6 — spec-kit defaults to the whole feature; constrain it). Ask the user clarifying questions, present the plan, and **WAIT for approval. No code before approval.**
   - **VERIFY before "done":** `npm run build` + the 3 gates (overlay/default MUST stay **268 / 9 / 27**) + COM-oracle validation + **`/code-review`**. If `/code-review` finds ANYTHING, **FIX it and re-verify** — never proceed with unresolved findings.
   - When verified AND the user is satisfied: **ff-merge the slice into `layout-engine`**, **update Current Status** below, then go to the next milestone.
   - **Never touch `main`.** Keep the model **page-free**. All new render behind `WC_LAYOUT=paged`.

## Locked decisions

- **Methodology:** GitHub **spec-kit** — `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` (+ optional `/speckit-clarify`, `/speckit-analyze`).
- **Scope = A:** umbrella spec covers ALL milestones; detailed design is produced **per slice** via `/speckit-plan` as each is reached (not all up front).
- **End-state = A:** paged becomes the faithful **default** later, via a **separate gated flip** (all milestones green + full COM-oracle parity). The flip is a **non-goal** of this work; default stays overlay throughout.
- **Branch model:** long-lived **`layout-engine`** integration branch off `main`. Each slice branches off `layout-engine` and **ff-merges back into `layout-engine`**. `layout-engine` merges to **`main`** ONLY when the whole migration is complete + parity-proven.
- **Commit cadence:** consolidated — commit at **slice boundaries** (feature/fix/slice done), NOT per doc tweak. Fewer, coherent commits.
- **Strangler-fig:** all new render work lives behind `WC_LAYOUT=paged`; the default (`overlay`) is the **byte-identical shipping app** (the regression gate).
- **Invariant:** the document model stays **page-free** (no `page` nodes) so it keeps round-tripping to `.docx`. Never break this.

## How we work — the per-milestone loop

Repeat for each milestone, ONE at a time (never run ahead):

1. **PLAN** — run `/speckit-plan` for THIS milestone only. Ask clarifying questions FIRST, then present the plan (architecture, files, contracts, approach) and **WAIT for the user's approval before writing any code.**
2. **TASKS** — `/speckit-tasks`: break the approved plan into an ordered task list.
3. **IMPLEMENT** — on a slice branch off `layout-engine`; build incrementally behind `WC_LAYOUT=paged`; the default (overlay) must stay byte-identical.
4. **VERIFY (mandatory before "done"):**
   - `npm run build`, then the 3 gates — `npm run test:pm`, `npm run test:smoke`, `npm run test:roundtrip` — all green (overlay/default must stay **268 / 9 / 27**).
   - Validate the milestone's behavior against the **Word-for-Windows COM oracle** (`scripts/oracle/word-oracle-win.ps1`) where applicable.
   - Run **`/code-review`** on the slice diff. **If it surfaces ANY problems/findings, FIX them**, then re-run build + the 3 gates (and re-validate) before moving on. **Do not proceed with unresolved findings.**
5. **CHECK IN** — show the user the results. Only after the user is satisfied: **ff-merge the slice into `layout-engine`**, **update the Current Status section below**, then move to the next milestone.

## Milestones (order C) — checklist

- [x] **M1** — shared per-page coordinate adapter + dynamic-import of the paged path ✓ DONE 2026-06-19
- [x] **M2** — pointer click hit-test routing into the hidden inner editor ✓ DONE 2026-06-19
- [x] **M3** — status bar → `presentation.getPages()` ✓ DONE 2026-06-20
- [~] **M4** (split into M4a–M4d) — retarget the 6 overlays to the painted per-page DOM. **M4a ✓ DONE 2026-06-20** (helpers `posToOverlayLocalY`/`posToOverlayLocalRect` + comments-ui + track-chrome). Remaining: **M4b** image-resize · **M4c** ink-overlay (hard) · **M4d** notes-area (disable in paged) + header-footer (integration test).
- [ ] **M5** — paged-mode `.docx` export COM-oracle round-trip parity
- [ ] **M6** — glyph-metric tolerance vs the Word COM oracle
- [ ] **(later, separate)** flip the default to paged + retire the overlay (gated on all of M1–M6 + full parity)

---

## Current Status  ⟵ KEEP THIS UP TO DATE (every session)

- **Last updated:** 2026-06-20
- **Branch:** `layout-engine` (off `main` @ 7f15724). M1 + M2 + M3 + M4a ff-merged in (M1–M3 docs archived under `specs/001-paged-render-migration/milestones/`).
- **Done so far:**
  - Root-caused the old engine (decoration overlay) + chose Option B (adopt SuperDoc's real layout engine).
  - Vendored the 10 engine packages; build-proven; **standup spike PASSED** (real per-page DOM, pagination 1→12, model page-free, caret/typing) — see findings doc.
  - Installed spec-kit; wrote the umbrella spec (scope A, milestone order C, end-state A).
  - **M1 COMPLETE (2026-06-19):** shared `WC.PM.coords` coordinate adapter (`src/renderer/layout/coordinate-adapter.ts`, installed once in `preinstallBridge`) + dynamic-import of the PE path (overlay bundle code-split back to ~8.16 MB). Pure infra — NO consumer rewired (that's M2/M3/M4). New `scripts/paged-coords-probe.js` (overlay 9/9 parity + paged 10/10 round-trip Δ=0/0) and `scripts/check-overlay-bundle.js` gate (`test:bundle`, 4/4). `/code-review` xhigh → 5 findings fixed + re-verified.
  - **M2 COMPLETE (2026-06-19):** pointer click hit-test routing. Root cause = `focus.ts`'s margin-click handler clobbered PE's already-complete click pipeline in paged mode (it ran `view.posAtCoords` on the hidden off-screen view). Fix = `focus.ts` bails in paged mode (PE's `EditorInputManager` owns all paged clicks) + migrated its overlay hit-test to `WC.PM.coords.clientToPos` (first real consumer of the M1 seam). 3-line product change; no fork edits. New `scripts/paged-pointer-probe.js` (`probe:pointer`): paged 13/13 — single-click correct on page 0 **and page 1 (Δ=0)**, double-click word-select, focus + insert follow; **triple-click + drag are PE-native and INFO-only** (synthetic DOM events can't replicate native multi-click/drag detection — our change provably can't break them). Overlay parity 6/6. `/code-review` high → 4 probe-honesty gaps fixed + re-verified. Real-app gesture verification was BLOCKED (computer-use can't target the CLI-launched dev Electron build via the installed-app allowlist; "Word" title collides with MS Word) → user approved merge on the probe evidence.
  - **M3 COMPLETE (2026-06-20):** status bar → real page count. In paged mode the bar showed "Page 1 of 1" (both X/Y read the overlay `__pagination`, null in paged). Fix = added `WC.PM.coords.getCurrentPage()` (paged: `PE.computeCaretLayoutRect(caret).pageIndex+1`; overlay: the break-scan moved verbatim) + rewired `statusbar.js` to read `getPageCount()`/`getCurrentPage()` (never `__pagination` directly) + a paged `presentation.onLayoutUpdated → StatusBar.update` trigger (idempotent) for no-transaction re-paginations. No fork edits. New `scripts/paged-statusbar-probe.js` (`probe:statusbar`): paged 11/11 ("Page 1 of 8" → "Page 2 of 8" tracking the caret; trigger fires) + overlay parity 9/9 (9-page doc, page 1→9 advance, render byte-identical). `/code-review` high → 4 fixes (onLayoutUpdated unsub leak; probe trigger hard-gated; overlay parity made non-tautological; statusbar simplified).
  - **M4a COMPLETE (2026-06-20):** overlay retarget — comments-ui + track-chrome to the painted pages. Added `WC.PM.coords.posToOverlayLocalY` + `posToOverlayLocalRect` (verbatim ports of the overlays' `localY`/`localRect` with the only change `view.coordsAtPos` → the M1 `posToClientRect`; `#pages`'s own scale resolves the zoom baseline → mode-agnostic, overlay byte-identical). comments-ui/track-chrome `localY`/`localRect` now delegate to the seam; both listen to a new `wc:paged-relayout` window event dispatched from the (leak-hardened) `onLayoutUpdated` handler. No fork edits. `scripts/paged-overlays-probe.js` (`probe:overlays`): paged 10/10 (painted-aware Δ=278px vs hidden view; relayout fires) + overlay parity 7/7 (byte-identical 6/6 each). `/code-review` high → 5 fixes (onLayoutUpdated teardown moved outside the guard = leak + stale-dispatch fix; independent handler try/catch; 3 probe-honesty gaps).
- **Where we are:** **M1+M2+M3 + M4a done + verified + merged.** Active spec/plan/tasks (M4a) in `specs/001-paged-render-migration/`; M1–M3 archived under `milestones/`.
- **NEXT:** **Milestone 4b** — image-resize overlay: retarget `boxFor` → a new `WC.PM.coords.nodeBoxFor`, OR DISABLE the bridge handle overlay in paged mode if PE's `ImageInteractionLayer` already draws resize handles (VERIFY first). Then M4c (ink — hard) + M4d (notes-area disable + header-footer test). Run `/speckit-plan` scoped to M4b only → questions → approval → tasks/implement/verify.
- **Open questions:** none blocking. Carry-forward: triple-click/drag in paged mode are PE-native and unverified-by-automation — worth a real-app spot-check when a controllable run is available (not blocking).
- **Gates baseline (overlay/default):** test:pm **475** / smoke **9** / roundtrip **27** (+ `test:bundle` 4/4 for the M1 code-split). NOTE: the prior "268" figure here was STALE — the suite has had 475 `t()` cases since the standup commit (verified statically + by run).
