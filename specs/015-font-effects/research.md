# Research — 015 Font advanced effects (the NO-FORK spike)

## Decision: all five effects are achievable NO-FORK

Probe `scripts/paged-fonteffects-spike-probe.js` (real paged renderer) tried `setMark('textStyle', {attr: val})` for each effect and inspected the model attr + exported rPr.

| Effect | textStyle attr | Declared today? | Export (probe) | Route |
|--------|----------------|-----------------|----------------|-------|
| All Caps | `textTransform: 'uppercase'` | ✅ yes | `<w:caps w:val="1"/>` | direct via bridge `setMark` |
| Char Spacing | `letterSpacing: 'Npt'` | ✅ yes | `<w:spacing w:val="40"/>` (2pt→40 twips) | direct |
| Position | `position: 'Npt'` | ✅ yes | `<w:position w:val="6"/>` (3pt→6 half-pt) | direct |
| Small Caps | `smallCaps: true` | ❌ **dropped** (undeclared) | — | **owned extension** |
| Char Scale | `w: 150` | ❌ **dropped** (undeclared) | — | **owned extension** |

**Rationale**: the fork's v3 rPr translators already exist for all five (`caps`→sdKey `textTransform`; `smallCaps`→`smallCaps`; `w`→`w`; spacing→letter-spacing; `position`→`position`). The export pipeline is proven end-to-end for declared attrs (caps/spacing/position all exported correctly in the probe). The only gap is that `smallCaps` and `w` are **not declared `textStyle` attributes**, so `setMark` silently drops them.

**Alternatives considered**:
- *Edit the fork's `text-style.js` `addAttributes()`* to declare `smallCaps`/`w` — REJECTED (Constitution P1: a fork-source edit). It would be one small edit but it's exactly the kind of in-tree change that rots on rebase.
- *Owned extension with `addGlobalAttributes`* — CHOSEN. This is precisely how the existing **`FontSize`** extension adds `fontSize` to `textStyle` (`extensions/font-size/font-size.js` `addGlobalAttributes` → `types: ['textStyle','tableCell']`). It declares the attr from OUTSIDE the fork, so `setMark` accepts it and the fork's own translators export it. Proven pattern (the font-size feature ships on it). Wired into `bridge/create-editor.ts`'s `extensions: [...getStarterExtensions(), ImageResize, AdvancedFontEffects]`.

## Decision: render fidelity

- Small Caps → CSS `font-variant: small-caps` (faithful).
- All Caps → CSS `text-transform: uppercase` (already the `textTransform` render).
- Char Spacing → CSS `letter-spacing` (already rendered).
- Position → CSS vertical-align offset (already rendered by the `position` attr).
- Char Scale (`w`) → best-effort CSS (`display:inline-block; transform: scaleX(n/100)` or a horizontal-scale approximation). **The export `<w:w>` is the COM-validated fidelity contract; pixel-exact glyph stretch is not required** (spec Assumptions).

## Decision: units (Word ↔ OOXML)

- `w:spacing` (letter-spacing) `w:val` = **twips** (1pt = 20 twips). Word `Font.Spacing` is points → val = pt×20. Expanded = +, Condensed = −.
- `w:position` `w:val` = **half-points** (1pt = 2). Word `Font.Position` is points → val = pt×2. Raised = +, Lowered = −.
- `w:w` `w:val` = **percent** (150 = 150%). Word `Font.Scaling` = percent.
- `w:smallCaps` / `w:caps` = boolean flags (`w:val="1"` / absent = off). Word `Font.SmallCaps` / `Font.AllCaps` = True/False.

## Decision: clearing semantics

Returning a control to none/Normal/100% MUST set the attr to `null` (drop the property), not leave a stale value — the partial-update-carryover class of bug seen in line-numbers (004). Bridge verbs accept a clear/null path.

## Open risks

- The owned-extension export for `smallCaps`/`w` is asserted by the FontSize precedent but will be **proven by TDD** at implementation (a failing-then-passing export test); if the v3 path does not pick up the owned global attr, fall back to a STOP-AND-ASK for a minimal fork accessor.
- `position` attr is shared with the sub/superscript mechanism (`hasExplicitPosition`); setting an explicit `position` must not be confused with `vertAlign` — verify the two coexist (Position raised/lowered is `w:position`, sub/superscript is `w:vertAlign`).
