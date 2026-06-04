# Execution Map — what to do in a session

> The **session playbook**: how to orient, execute the current phase, and hand off. Updated
> when the phase advances (via the `plan-tracking` skill). Big picture: [plan.md](plan.md) ·
> exact state: [last-point.md](last-point.md).

## At session START (always, in order)
1. Read **[last-point.md](last-point.md)** — where we left off, current branch, next step.
2. Read **this file** — the current phase + concrete next actions.
3. Skim **[plan.md](plan.md)** — goal, locked architecture, the two hard constraints,
   branch-by-branch process.
4. Read the **ADR(s)** relevant to the current phase in [../decisions/](../decisions/), and
   the matching item in [../decisions/OPEN_DECISIONS.md](../decisions/OPEN_DECISIONS.md).

## How to execute ANY phase/subsystem (the loop)
1. **Branch** off the integration line (e.g. `feature/<subsystem>`).
2. **Confirm the decision:** read its `OPEN_DECISIONS.md` recommendation + edge cases; confirm
   or adjust against the *real* code; if it changes a locked choice, add a superseding ADR.
3. **Build** it (strangler-fig — behind the existing ribbon; never break the Word UI).
4. **Test:** the 228-test in-renderer suite + the 9-test docx suite must stay green; add a
   regression test per change; check feature parity.
5. **Checkpoint:** invoke the **`plan-tracking`** skill to renew last-point.md (and this file
   if the phase advanced).
6. **PR** for review; merge to the integration line; merge to `main` only at a stable milestone.

## CURRENT PHASE → Phase 1: Scaffold the new core
**Goal:** a minimal editable ProseMirror document — forked from SuperDoc — rendering in **our
own** `EditorView` with our CSS, inside Electron. (This also closes the spike's Q1 "last mile":
mount + type interactively.)

**Concrete next actions:**
1. Introduce **electron-vite + TypeScript** for the renderer (keep the hardened main/preload
   posture). This replaces the no-bundler `<script>` setup.
2. **Vendor the SuperDoc fork:** schema + `super-converter` + `getStarterExtensions()` (the PM
   extensions). **Strip** the Vue UI, the `DomPainter`, and **telemetry**. Pin the version.
   (Reference: `opensource-solutions/SuperDoc`; working headless pattern proven in `spike/`.)
3. Mount the imported model in a plain ProseMirror `EditorView` in an Electron window; style it
   with our CSS; **type into it** to confirm editing works (lists, Tab/indent).
4. Keep the existing ribbon/chrome visible (not yet wired) — UI must still look like Word.
5. Add a smoke test; checkpoint via `plan-tracking`; open a PR.

**Watch-outs (from the spike):** strip telemetry; the bundle reads `localStorage` at import
(native in Electron renderer); use the supported headless API `new Editor({ document })`;
editing behaviors come from the **extensions** — include them.

## At session END (always)
Invoke the **`plan-tracking`** skill to update [last-point.md](last-point.md) (date, branch,
phase, done/next/blockers) and, if the phase changed, the **CURRENT PHASE** section above.
