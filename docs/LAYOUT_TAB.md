# Layout Tab — Feature Status

_Verified by 10 tests (116/116 total) + MS Word oracle (`layout_probe.ps1`) + web research._

## Page Setup
- ✅ **Margins** (Normal/Narrow/Moderate/Wide), **Orientation** (Portrait/Landscape), **Size** (Letter/A4/Legal/A5/A3 — dimensions match real Word @96dpi), **Columns** (1/2/3), **Breaks** (page break)
- ✅ **Line Numbers** — None / Continuous / Restart Each Page / Restart Each Section / Suppress for Current Paragraph; rendered in a left-margin gutter overlay
- ✅ **Hyphenation** — None / Automatic (CSS `hyphens:auto` + lang)

## Paragraph
- ✅ **Indent Left / Right** (inches) and **Spacing Before / After** (points) ribbon spinners → apply to selected paragraphs (units validated vs real Word: indent pt, spacing pt)

## Arrange (operates on a selected image/shape — click to select)
- ✅ **Position** (In Line + 9 wrap positions), **Wrap Text** (Inline/Square/Tight/Through/Top&Bottom/Behind/In Front)
- ✅ **Bring Forward / Send Backward** (z-index), **Align** (left/center/right), **Rotate** (90° L/R, flip H/V), **Selection Pane** (lists objects, show/hide)
- 🟡 **Group/Ungroup** — approximated (objects arranged individually)

## Real-Word validation (`layout_probe.ps1`)
- ✅ Page sizes match (Letter 816×1056, A4 794×1123, Legal 816×1344 px @96dpi)
- ✅ Line numbering scriptable (Continuous/RestartPage/RestartSection)
- ✅ Hyphenation scriptable (auto, hyphenateCaps)
- ✅ Columns scriptable (SetCount)
- ✅ Indent/spacing in points (36pt=0.5″ left indent, 12pt after) — our spinners match
