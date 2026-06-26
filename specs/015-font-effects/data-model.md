# Data Model — 015 Font advanced effects

The five effects are run-level (rPr) properties carried on the `textStyle` mark. No new document entities; the model is the attr ↔ OOXML ↔ COM mapping.

| Effect | textStyle attr | Value (model) | OOXML (rPr) | `w:val` unit | Word COM read-back | Clear value |
|--------|----------------|---------------|-------------|--------------|--------------------|-------------|
| All Caps | `textTransform` | `'uppercase'` / `null` | `<w:caps/>` | `1`/off | `Font.AllCaps` True/False | `null` |
| Small Caps | `smallCaps` (owned) | `true` / `null` | `<w:smallCaps/>` | `1`/off | `Font.SmallCaps` True/False | `null` |
| Char Spacing | `letterSpacing` | `'Npt'` (signed) / `null` | `<w:spacing>` | twips = pt×20 | `Font.Spacing` (pt) | `null` |
| Position | `position` | `'Npt'` (signed) / `null` | `<w:position>` | half-pt = pt×2 | `Font.Position` (pt) | `null` |
| Char Scale | `w` (owned) | `100..` (percent) / `null` | `<w:w>` | percent | `Font.Scaling` (%) | `null` (=100%) |

## Validation / rules

- **Spacing / Position direction**: dialog "Expanded By"/"Raised By" → positive; "Condensed By"/"Lowered By" → negative; "Normal" → clear.
- **Scale**: any value ≠ 100 writes `w:w`; exactly 100 clears.
- **Caps independence**: `textTransform:'uppercase'` (All Caps) and `smallCaps:true` are independent rPr flags (Word allows both set; All Caps wins visually).
- **Position vs vertAlign**: explicit `position` (raised/lowered, `w:position`) is distinct from sub/superscript (`vertAlign`, `w:vertAlign`); both may coexist on a run.
- **One transaction**: all five (+ family/size/etc.) apply in a single `pm.chain` → one undo step.
- **Prefill**: opening the dialog reads the head run's `textStyle` attrs to set checkbox/spinner/percent state.
