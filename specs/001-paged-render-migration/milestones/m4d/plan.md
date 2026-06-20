# Implementation Plan: Paged Render Migration — **Milestone 4d** (notes-area disable + header-footer test)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 4d** (the LAST M4 sub-slice)
**Branch (slice)**: `slice/m4d-notes-hf` (off `layout-engine`) · **Date**: 2026-06-20
**Spec**: [spec.md](spec.md) (US2 / FR-005) · **Runbook**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)
**M1…M4c (done)**: archived at [milestones/](milestones/) · adapter at `src/renderer/layout/coordinate-adapter.ts`

> **M4 sub-slices:** M4a ✓ (comments+track) · M4b ✓/.1 (image-resize) · M4c ✓ (ink) · **M4d** = notes-disable + header-footer-test (THIS — the LIGHT one). After M4d, **M4 is COMPLETE** → M5/M6.

## Summary

The last two of the six overlays. **(a) Notes-area:** the bridge's `#pm-notes-area` overlay (an editable
footnote/endnote region flowed BELOW the page sheet — an overlay-mode workaround because note bodies are not
editable PM nodes there) **double-renders + mis-positions in paged**, because PE already paints footnote/endnote
bodies **per-page** at the page bottom and makes them **editable inline** (double-click → `NoteStorySession`,
`documentMode:'editing'`). → **DISABLE the overlay in paged** (the Word-faithful swap). **(b) Header-footer:**
`header-footer.ts` is **provably mode-agnostic** (4 doc-model verbs; **zero** coordinate/DOM math; binds to
`presentation.editor` in paged exactly as the plain Editor in overlay) → **NO production change; just a paged
integration TEST.**

## Decisions (planning Q&A + the M4d understanding sweep)

1. **Notes-area = DISABLE in paged** (user-accepted): editing is NOT lost — PE renders + edits footnotes inline
   per-page (Word-faithful). 2-point gate in `notes-area.ts` on `window.__WC_LAYOUT_MODE === 'paged'`; overlay
   byte-identical; the `WC.NotesArea` facade (`refresh`/`render`/`showNotes`) stays DEFINED (guarded no-ops).
2. **'Show Notes' (`refShowNotes`) in paged = SCROLL the first painted footnote into view** (user; Word behavior —
   References ▸ Show Notes jumps to the note area). Cheap: the footnote is painted DOM → first painted footnote
   element + `scrollIntoView({block:'nearest'})`; `return false` (documented) if none painted. NOT a PE
   story-session entry (out of scope for the light slice).
3. **Header-footer = PURE TEST, ZERO production change** — confirmed mode-agnostic (verbs operate on
   `editor.converter`/`editor.doc`; the PE-aware story-runtime routes a bridge set/get during an open PE header
   session into the SAME live editor — designed coexistence).
4. **Verification = standalone paged probes** (M2/M3/M4 cadence), NOT new `test-suite-pm.js` cases (the suite has a
   pre-existing 268/475 early-abort that could mask a new case; the probes are the trustworthy gate, and the existing
   overlay test `[9]` already covers overlay header/footer + the docx-export assertions).
5. **Interop driven PROGRAMMATICALLY** (computer-use is blocked for the dev build) — activate the PE header session
   via `HeaderFooterSessionManager` (a small test-only hook if not exposed), never a synthetic click.

## Technical Context
**Language/Version**: TypeScript on `window.WC`; Electron 31. **Primary Dependencies**: `notes-area.ts`,
`references.ts` (refShowNotes), `header-footer.ts` (unchanged), PE's footnote layout + `HeaderFooterSessionManager`.
**Testing**: 3 gates (pm/smoke/roundtrip) + bundle + NEW `probe:notes` + `probe:headerfooter`. **Constraints**: model
page-free; **overlay byte-identical** (paged-gated); **no fork edits**. **Scale/Scope**: ~1 small production change
family (notes-area 2-point gate + refShowNotes paged branch) + 2 new probes; ZERO change to header-footer.ts.

## Constitution Check
Unratified template; gates = project rules + runbook invariants.

| Gate | M4d compliance |
|------|----------------|
| Model page-free | ✅ overlay disable + a test; no model change. |
| Overlay byte-identical | ✅ both notes-area gates are `__WC_LAYOUT_MODE==='paged'`-only; overlay takes neither branch. header-footer untouched. Probe overlay-parity rows guard it. |
| 3 gates + bundle 4 | ✅ required (test:pm's pre-existing abort noted; paged behavior is probe-gated). |
| New behavior behind `WC_LAYOUT=paged` | ✅ every change is paged-gated. |
| No fork edits | ✅ header-footer.ts untouched; the interop hook (if needed) is a test-only WC-side accessor, not a fork edit. |
| No hand-edit of generated files | ✅ untouched. |

**Result: PASS.**

## Project Structure
```text
specs/001-paged-render-migration/
├── spec.md · plan.md (THIS, M4d) · research.md · data-model.md
├── contracts/notes-headerfooter.md
├── quickstart.md · checklists/requirements.md
└── milestones/{m1,m2,m3,m4a,m4b,m4c}/   # archived
```
### Source Code — M4d touch set
```text
src/renderer/bridge/notes-area.ts   # 2-point paged gate: renderInner() early-return+hide+teardown; installNotesArea() skip the transaction driver (keep the WC.NotesArea facade)
src/renderer/bridge/references.ts   # refShowNotes() paged branch — scroll the first painted footnote into view (else return false)
src/renderer/bridge/header-footer.ts# NO CHANGE (mode-agnostic — test only)
scripts/paged-notes-probe.js        # NEW — paged: PE painted footnote + #pm-notes-area hidden + no driver + endnotes + Show-Notes scroll; overlay parity (region still mounts)
scripts/paged-headerfooter-probe.js # NEW — paged parity (set/get + export round-trip) + PE-session interop; overlay parity
package.json                        # add probe:notes + probe:headerfooter
```
**Structure Decision**: notes-area disables itself in paged (PE owns footnotes); header-footer is proven
mode-agnostic and only tested. No fork edits; overlay byte-identical.

## Phase 0 — Research
See [research.md](research.md): PE's per-page footnote render + editable `NoteStorySession`; the
`#pm-notes-area` double-render in paged; header-footer.ts's zero-coordinate proof + the PE-aware story-runtime
coexistence; the disable mechanism + the Show-Notes scroll; the test-vs-fix verdict.

## Phase 1 — Design & Contracts
- **Entities**: [data-model.md](data-model.md) — the disabled notes region, the Show-Notes scroll target, the
  header/footer slot verbs + the live PE session.
- **Contract**: [contracts/notes-headerfooter.md](contracts/notes-headerfooter.md) — the notes-area paged-gate
  behavior + refShowNotes contract + the header-footer verbs (unchanged) the probes assert.
- **Validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M4d)
1. `npm run build` clean.
2. **3 gates** green (smoke 9 / roundtrip 27; test:pm — paged behavior is probe-gated, the suite's 268-abort is
   pre-existing/tracked) + `test:bundle` 4/4.
3. **`probe:notes`** (paged): inserting a footnote → PE PAINTED a per-page footnote body (so disabled ≠ no-notes),
   `#pm-notes-area` absent OR `display:none`, the transaction driver NOT installed, endnotes covered, `refShowNotes`
   scrolls the painted footnote into view. **Overlay parity**: `#pm-notes-area` still mounts + renders the editable
   region.
4. **`probe:headerfooter`** (paged): parity set/get + `exportDocxBytes` → `word/headerN.xml <w:hdr>` + `sectPr
   <w:headerReference>` + the rels relationship + a REPLACE (no stale text); **interop** — a programmatically-opened
   PE header session routes `WC.PM.get/setHeaderText` through the live editor + survives exit/commit. **Overlay
   parity**: same round-trip.
5. **`/code-review`** on the slice (watch listener-leak + probe-honesty); fix all; re-verify.
6. **COM-oracle: OPTIONAL** — header/footer export is doc-model/converter (mode-independent), identical to the
   overlay path already validated by test `[9]`; a Word-COM spot-check is a courtesy, not a new corruption risk.

## Risks
- **PE footnote-editing is PE-native** (double-click); the WC bridge has no explicit ENTER wiring → the probe asserts
  the *painted* footnote exists (not a live click — computer-use blocked), and `refShowNotes` only scrolls.
- **`refShowNotes` scope-creep** — keep it scroll-only (or a clean `return false`); do NOT build PE story-session
  entry in M4d.
- **Keep the `WC.NotesArea` facade DEFINED** in paged (guarded no-ops) — dropping it risks a throw in
  `references.ts`/tests.
- **Header/footer is GLOBAL converter state** not reset by `setDoc` (test `[9]` resets via `newBlank`) — the paged
  parity probe MUST replicate that teardown or it leaks header refs → false greens.
- **`test:pm` 268-abort** (pre-existing, tracked) could mask a suite case → that's exactly why M4d gates on the
  PROBES, not new suite cases.

## Complexity Tracking
*No constitution violations — empty.*
