# Feature Specification: Multi-column page layout (Columns)

**Feature Branch**: `feature/columns-paged`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "Multi-column page layout (Layout tab → Columns). Wire the Columns command to the paged engine: One / Two / Three / Left / Right presets + a 'More Columns' dialog (count, equal/unequal width, spacing, line-between, apply-to) write real OOXML w:cols, the paged engine renders the body text flowed into the columns, and a Column break is supported. Validated against real Microsoft Word for Windows via the COM oracle. No fork edits; the WC.PM bridge is the only document-write path; the doc model stays page-free; incremental oracle-gated slices."

## User Scenarios & Testing *(mandatory)*

The Layout → Columns control is currently blocked (an honest deferral toast) even though the paged
layout engine now renders multi-column text and the model/export already supports `w:cols`. This feature
wires the control onto the engine so users can lay out a document in newspaper-style columns that match
Microsoft Word and round-trip to a real `.docx`.

### User Story 1 - Apply a column preset (Priority: P1) 🎯 MVP

A user picks **One / Two / Three** from the Layout → Columns dropdown; the body text immediately
re-flows into that many equal-width columns on the page, and saving produces a `.docx` that opens in
Word with the same column layout.

**Why this priority**: This is the core, most-used Columns capability and is independently demonstrable.
It is the prerequisite slice that proves the engine-render + export + oracle path; P2/P3 extend it.

**Independent Test**: With a paragraph of body text, choose Columns → Two; the text visibly splits into
two side-by-side columns on the page; save → reopen (and open in Word) shows two equal columns; choose
Columns → One restores a single column.

**Acceptance Scenarios**:

1. **Given** a single-column document with body text, **When** the user chooses Columns → Two, **Then** the page renders the text in two equal columns and the exported `sectPr` carries `<w:cols w:num="2">`.
2. **Given** a two-column document, **When** the user chooses Columns → One, **Then** the page renders a single column and the export no longer carries a multi-column `w:cols` (or carries `w:num="1"`).
3. **Given** a two-column document saved to `.docx`, **When** it is opened in Microsoft Word, **Then** `Sections(1).PageSetup.TextColumns.Count == 2` and the document opens without repair.
4. **Given** Columns → Three on a full page, **When** rendered, **Then** three equal columns are visible and the export carries `<w:cols w:num="3">`.

---

### User Story 2 - Customize columns ("More Columns") (Priority: P2)

A user opens **More Columns** and sets the number of columns, the spacing between them, whether the
columns are equal width, and (via the **Left / Right** presets) an unequal two-column layout; the page
and the export reflect those choices.

**Why this priority**: Customization (spacing, equal-width, the Left/Right presets) is the next layer of
Word fidelity, but the One/Two/Three MVP already delivers value without it.

**Independent Test**: Open More Columns, set 2 columns with 1" spacing; the rendered gap and the exported
`w:space` match; choose the **Left** preset; the export carries a narrow + wide column pair and Word reads
back the two unequal widths.

**Acceptance Scenarios**:

1. **Given** the More Columns dialog, **When** the user sets 2 columns with a 1" spacing, **Then** the export carries `<w:cols w:num="2" w:space="1440">` and Word reads `PageSetup.TextColumns.Spacing ≈ 72pt`.
2. **Given** the More Columns dialog, **When** the user chooses **Left** (or **Right**), **Then** the two columns render unequal (narrow + wide / wide + narrow) and the export distinguishes the two widths so Word reads back two different `TextColumns` widths.
3. **Given** the More Columns dialog with a **Line between** toggle on, **When** applied, **Then** a separating line is requested in the export and Word reads `PageSetup.TextColumns.LineBetween` true. *(Subject to the engine/exporter supporting a column separator — see Assumptions; if not reachable no-fork it degrades to an honest toast and is recorded.)*
4. **Given** any More Columns choice, **When** "Equal column width" is unchecked vs checked, **Then** the export and Word read-back reflect the even/uneven setting.

---

### User Story 3 - Column break (Priority: P3)

A user places the caret and inserts a **Column break** (Layout → Breaks → Column); the text after the
break moves to the top of the next column.

**Why this priority**: Column breaks are useful but secondary to defining the columns themselves; they are
only meaningful once columns exist (P1/P2).

**Independent Test**: In a two-column document, place the caret mid-text, insert a Column break; the
following text jumps to the top of the second column; the export carries a `<w:br w:type="column"/>` run
and Word renders the same break.

**Acceptance Scenarios**:

1. **Given** a two-column document with the caret in the first column, **When** the user inserts a Column break, **Then** the subsequent text starts at the top of the next column and the export carries `<w:br w:type="column"/>`.

---

### Edge Cases

- **Single-column / "One" preset**: choosing One on an already single-column doc is a no-op (or clears `w:cols`); must not corrupt the section.
- **Column count vs page width**: a count that leaves columns too narrow still exports the requested `w:num`; rendering degrades gracefully (Word behaves the same).
- **Unequal columns no-fork limit**: if the section adapter cannot write individual `<w:col>` children no-fork, the Left/Right presets are limited to what the adapter supports — recorded honestly rather than faked (the MVP equal-width path is unaffected).
- **Line-between no-fork limit**: same — `w:sep` support is verified at the spike; if unreachable no-fork it degrades to an honest toast.
- **Multi-section**: v1 targets the single (primary) section; "apply to whole document" only.
- **Reopen**: a column doc exported then reopened in the app keeps its column layout (import already carries `w:cols`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Layout → Columns control MUST be un-blocked (no deferral toast) and drive the paged engine.
- **FR-002**: Choosing One / Two / Three MUST render the body text in that many equal-width columns on the page.
- **FR-003**: The column layout MUST export as real OOXML `<w:cols>` in the section's `sectPr` (`w:num`, `w:space`, `w:equalWidth`), NOT as a visual-only effect.
- **FR-004**: A saved column document MUST open in Microsoft Word without repair, with `Sections(1).PageSetup.TextColumns.Count` equal to the chosen count.
- **FR-005**: A "More Columns" surface MUST let the user set the count, the spacing between columns, and whether columns are equal width; these MUST persist to the export and read back in Word.
- **FR-006**: The Left / Right presets MUST produce an unequal two-column layout to the extent the no-fork export path supports it; any limit is recorded (not faked).
- **FR-007**: A "Line between" option MUST request a column separator in the export to the extent the no-fork path supports it; any limit is recorded.
- **FR-008**: A Column break MUST be insertable and MUST export as `<w:br w:type="column"/>`, moving following text to the next column.
- **FR-009**: Choosing One (single column) MUST cleanly remove/normalize the multi-column setting without corrupting the section.
- **FR-010**: All column writes MUST go through the `WC.PM` bridge (the only document-write path); the document model stays page-free; NO edits to the vendored fork (`src/renderer/core/superdoc-fork/*`). A minimal, documented fork accessor is a last resort only if a sub-capability is otherwise unreachable, recorded in plan.md Complexity Tracking.

### Key Entities *(include if feature involves data)*

- **Section column layout**: the per-section column configuration — `count`, `spacing` (gap), `equalWidth`, optional `lineBetween`, optional per-column widths (unequal). Lives in the section's `sectPr/w:cols`; read back from Word as `PageSetup.TextColumns`.
- **Column break**: an inline break in the body run stream (`w:br w:type="column"`) that advances text to the next column.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch a document between one, two, and three columns from the Columns dropdown and SEE the text re-flow on the page each time.
- **SC-002**: 100% of the exercised column layouts (One/Two/Three + a custom spacing) open in **Microsoft Word for Windows** without repair and read back the correct `PageSetup.TextColumns.Count` (and spacing for the custom case).
- **SC-003**: The in-app rendered column count matches the exported `w:num` for every preset (no divergence between what the user sees and what Word receives).
- **SC-004**: A column break moves the following text to the next column in-app and exports a `w:type="column"` break that Word honors.
- **SC-005**: No regression: the existing gate suite stays green (`test:pm` overlay 475, `test:smoke` 9, `test:roundtrip` 27, `test:bundle` 4) and the paged column probe + the Word-COM oracle pass.

## Assumptions

- **Parity oracle**: "Microsoft Word for Windows" in the success criteria is the project's domain ground-truth oracle (COM read-back), not an implementation technology of this system — consistent with the project's standing fidelity reference (as in 001/002).
- **Engine renders columns**: feasibility-probed — `editor.doc.sections.setColumns({count, gap, equalWidth, target})` makes the paged engine render multiple columns live and exports `<w:cols w:num=… w:space=… w:equalWidth=…>`; this feature wires the ribbon onto that seam.
- **Scope = single (primary) section**, "apply to whole document". Multi-section "apply from this point forward" is out of scope for v1.
- **Equal-width is the MVP**; unequal columns (Left/Right via individual `<w:col>`) and the line-between separator (`w:sep`) are P2 and are bounded by what the no-fork export path supports — verified at the Phase-0 spike, with any gap recorded rather than faked.
- **Reuses** the existing paged engine, the `WC.PM` bridge, the contextual/Layout ribbon plumbing, the real-paged-renderer probe harness, and the Word-COM oracle (`com-validate.js`) established in 001/002.
- **Delivery** is incremental, oracle-gated slices (P1 → P2 → P3), each its own verify → `/code-review` → ff-merge-to-`main` → push cycle on `feature/columns-paged`.
