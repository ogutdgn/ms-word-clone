# Implementation Plan: Home Font dialog advanced character effects

**Branch**: `feature/015-font-effects` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-font-effects/spec.md`

## Summary

Make the Font dialog's five Advanced-tab character effects (Small Caps, All Caps, Character Scale, Character Spacing, Position) actually apply to the selection and export to real OOXML run properties, replacing the current preview-only + `notifyBlocked` toast. **Spike-confirmed NO-FORK** (research.md): three effects use already-declared `textStyle` attrs; the two missing ones (Small Caps, Scale) are added as **global attributes via an owned extension** (the established `FontSize` pattern), never a fork-source edit.

## Technical Context

**Language/Version**: TypeScript (bridge, electron-vite) + vanilla JS chrome (`window.WC`); Electron 31.
**Primary Dependencies**: owned ProseMirror fork (SuperDoc), the `WC.PM` bridge, the fork's v3 super-converter rPr translators (`caps`, `smallCaps`, `w`, `spacing`/letter-spacing, `position` — all already present).
**Storage**: OOXML run properties in the `.docx` (rPr); no app storage.
**Testing**: `scripts/test-suite-pm.js` (paged functional gate), `scripts/paged-fonteffects-probe.js` (new), `scripts/oracle/validate-fonteffects-win.ps1` (new Word-COM oracle).
**Target Platform**: Windows desktop (Word-for-Windows parity, ADR-0006).
**Project Type**: desktop app (single renderer + main).
**Performance Goals**: N/A (per-selection formatting; one PM transaction).
**Constraints**: NO-FORK (Constitution P1); one undo step per dialog OK; round-trip-safe.
**Scale/Scope**: 5 run-property effects + the Font dialog OK/open wiring.

## Constitution Check

*GATE: must pass before Phase 0 and re-check after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. No Fork Edits | ⚠️ AUTHORIZED EXCEPTION | 3 effects + the owned extension (smallCaps/w on the model) are NO-FORK. But the run-EXPORT whitelist + the inline-run-properties recompute set + the IMPORT whitelist are all per-attr switches in the fork (`styles.js` decodeRPrFromMarks/encodeMarksFromRPr + `calculateInlineRunPropertiesPlugin.js` RUN_PROPERTIES_DERIVED_FROM_MARKS) with no ESM-safe seam. **USER-AUTHORIZED minimal additive fork edits** (Complexity Tracking below): add `smallCaps`+`w` to those three switches so Small Caps + Scale apply, export, clear, AND round-trip. Purely additive (the two attrs no-op'd before). |
| II. Single Document-Write Path | ✅ PASS | New `WC.PM` bridge verbs; the Font dialog OK handler calls them inside its existing single `pm.chain`. |
| III. Page-Free Model | ✅ PASS | Pure run properties (rPr); no page nodes. |
| IV. Oracle-Validated Fidelity | ✅ PASS | `validate-fonteffects-win.ps1` reads back Font.SmallCaps/AllCaps/Spacing/Position/Scaling from real Word. |
| V. Test-Gated, Regression-Covered | ✅ PASS | New regression tests in `test-suite-pm.js` + `probe:fonteffects`; 4 gates stay green. |
| VI. Spec-Kit-Driven | ✅ PASS | This feature follows specify→plan→tasks→implement. |
| VII. Generated Files Untouched | ✅ PASS | The ribbon controls already exist (Font dialog launcher); no `ribbon-data.js`/`icons` regen. |

**Result: PASS, no violations.** Complexity Tracking empty.

*(Note: the constitution's "test:pm 475 OVERLAY" line predates feature 008's overlay retirement; the current gate is `test:pm` PAGED (436). This plan uses the current paged gate.)*

## Project Structure

### Documentation (this feature)

```text
specs/015-font-effects/
├── spec.md          # done
├── plan.md          # this file
├── research.md      # Phase 0 — the NO-FORK spike result
├── data-model.md    # the 5 effects: attr ↔ OOXML ↔ COM mapping
├── contracts/
│   └── fonteffects.md   # bridge-verb + OOXML + COM contract
├── quickstart.md    # how to validate end-to-end
└── tasks.md         # /speckit-tasks output
```

### Source Code (repository root — files this feature touches)

```text
src/renderer/
├── extensions/                         # NEW owned dir (or co-locate)
│   └── advanced-font-effects.ts        # NEW: owned Extension, addGlobalAttributes smallCaps + w(scale) on textStyle
├── bridge/
│   ├── create-editor.ts                # +AdvancedFontEffects in the extensions array (next to ImageResize)
│   └── commands.ts                      # NEW bridge verbs: setAllCaps/setSmallCaps/setCharSpacing/setPosition/setCharScale (+ readers)
└── public/js/
    └── dialogs.js                       # D.font OK → route 5 effects through the chain; open → prefill; drop notifyBlocked

scripts/
├── test-suite-pm.js                     # +regression tests (apply/clear/prefill/export each effect)
├── paged-fonteffects-probe.js           # NEW paged probe
└── oracle/validate-fonteffects-win.ps1  # NEW Word-COM oracle
```

**Structure Decision**: Owned extension + bridge verbs + dialog wiring; no fork edits, no new generated files.

## Phasing (independently shippable slices)

- **P1 — Caps (Small Caps + All Caps).** Highest value, includes the one owned-extension attr (smallCaps). Ships the extension + 2 verbs + dialog wiring for the two checkboxes + tests + oracle.
- **P2 — Spacing + Position.** Both use existing `textStyle` attrs (letterSpacing, position); add the two spinners' wiring + verbs + tests + oracle.
- **P3 — Character Scale.** Adds the `w` attr to the owned extension + the scale control wiring + tests + oracle. Lowest value, hardest render — render is best-effort; export is the COM-validated contract.

Each slice: probe + regression tests + 4 gates + COM oracle + `/code-review` → ff-merge.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **3 minimal additive fork edits** for Small Caps + Character Scale: (1) `super-converter/styles.js` `decodeRPrFromMarks` — add `case 'smallCaps'`/`case 'w'` (run EXPORT); (2) same file `encodeMarksFromRPr` — add the two IMPORT cases; (3) `extensions/run/calculateInlineRunPropertiesPlugin.js` — add `smallCaps`/`w` to `RUN_PROPERTIES_DERIVED_FROM_MARKS` (so clearing the mark drops the property). **USER-AUTHORIZED** (the spec's flagged STOP-AND-ASK; user replied "add 6 lines"). | The two effects' v3 rPr translators already exist in the fork, but the mark→runProperties whitelists are in-fork per-attr `switch`/`Set` constants statically imported by the converter/plugin — there is **no ESM-safe way to extend them from the bridge**. An owned extension makes the attrs reachable on the model+schema (done) but cannot reach the export/import/clear whitelists. | A pure-NO-FORK route would ship Small Caps + Scale as preview-only (the original broken state) or drop them. Each edit is **purely additive** — both attrs previously fell through with no effect, so no existing run property can regress. |
