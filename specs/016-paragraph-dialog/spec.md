# Feature Specification: Paragraph dialog completeness (016)

**Feature Branch**: `feature/016-paragraph-dialog` · **Created**: 2026-06-25 · **Status**: Draft

**Input**: The Home/Layout Paragraph dialog supports only the "Multiple" line rule (hardcoded `lineRule:'auto'`) and no Special indent. Add Word's full line-spacing rules + first-line/hanging indent + contextual spacing.

## Why / scope

The completeness audit flagged the Paragraph dialog as the top Home Paragraph gap: it has presets 1.0–3.0 only, no "At least"/"Exactly" line rules, no first-line/hanging Special indent, and no "Don't add space between paragraphs of the same style". The dialog already writes `paragraphProperties.spacing/indent` directly via `updateAttributes` (NOT the fork lineHeight command), so the spike confirmed this is **NO-FORK**: `lineRule:'exact'/'atLeast'` + `indent.firstLine/hanging` export correctly.

## User Scenarios (P1)

1. **Line spacing rule** (Given a paragraph, When the user picks "Exactly" + "At 18 pt" and OKs, Then the line height is fixed at 18pt and exports `<w:spacing w:line="360" w:lineRule="exact"/>`; Word reads `ParagraphFormat.LineSpacingRule = wdLineSpaceExactly`, `LineSpacing = 18`). Same for "At least" (`atLeast`), "Multiple" (`auto`, line=×240), and the Single/1.5/Double presets.
2. **Special indent** (When the user picks "First line" + "By 0.5"" → `<w:ind w:firstLine="720"/>`; "Hanging" + "By 0.25"" → `<w:ind w:hanging="360"/>`; "(none)" clears both).
3. **Don't add space between paragraphs of the same style** (→ `<w:contextualSpacing/>`).
4. **One undo step**; **prefill** the controls from the current paragraph on open.

## Functional Requirements

- **FR-001**: Line-spacing dropdown = Single / 1.5 lines / Double / At least / Exactly / Multiple, with an "At" value (pt for at-least/exactly, multiplier for Multiple) → correct `spacing.line` + `spacing.lineRule`.
- **FR-002**: Special-indent dropdown = (none) / First line / Hanging + a "By" value (inches) → `indent.firstLine` / `indent.hanging` (twips); switching clears the other.
- **FR-003**: "Don't add space…" checkbox → `paragraphProperties.contextualSpacing`.
- **FR-004**: Existing alignment / indent L-R / spacing before-after still work; all apply as ONE undo step.
- **FR-005**: Re-opening the dialog prefills line-rule + At + special-indent + by + contextual from the current paragraph.
- **FR-006**: COM-validated (LineSpacingRule/LineSpacing, ParagraphFormat.FirstLineIndent, contextual).

## Success Criteria

- SC-001: At least / Exactly / Multiple + the 3 presets each export the right `w:line`+`w:lineRule` and Word reads back the rule. SC-002: First-line + hanging export `w:ind`. SC-003: contextual spacing exports `<w:contextualSpacing/>`. SC-004: gates green + regression tests. SC-005: NO-FORK (spike-confirmed).

## Assumptions / out of scope

- NO-FORK (the dialog writes paragraphProperties directly). Parity = installed Word (COM).
- Out of scope (v1): the full Line-and-Page-Breaks tab (keepNext/keepLines/widow-orphan/pageBreakBefore) beyond what's trivial; tabs dialog; mirror-indents. Line-and-Page-Breaks may be a thin follow-up.
