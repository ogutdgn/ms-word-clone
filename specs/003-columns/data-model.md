# Data Model — Columns

The document model stays **page-free**. These entities describe the column domain as it lives in the OOXML
model (the fork's section store) and the transient UI state — not new persisted model nodes.

## Entity: Section column layout

The per-section newspaper-column configuration. Lives in the section's `sectPr/w:cols`.

| Field | OOXML | Word COM read-back | Notes |
|-------|-------|--------------------|-------|
| `count` | `w:cols/@w:num` | `PageSetup.TextColumns.Count` | 1 = single column (One); 2/3 = Two/Three |
| `gap` (spacing) | `w:cols/@w:space` (twips) | `PageSetup.TextColumns.Spacing` (points) | inter-column spacing; default 720 twips (0.5") |
| `equalWidth` | `w:cols/@w:equalWidth` | `PageSetup.TextColumns.EvenlySpaced` | true for One/Two/Three; false for Left/Right |
| `lineBetween` (P2) | `w:cols/@w:sep` | `PageSetup.TextColumns.LineBetween` | a separating line; **reach verified at the spike** |
| `columns[]` (P2, unequal) | child `<w:col w:w=.. w:space=..>` | `PageSetup.TextColumns.Item(n).Width` | per-column widths for Left/Right; **reach verified at the spike** |

**Relationships**: belongs to a section (`sectPr`). v1 = the single primary section (`section-0`),
"apply to whole document".

**State transitions**: *single column* → *N columns* (setColumns) → *exported* (`w:cols` in `sectPr`) →
*reopened* (import reads `w:cols`, the engine re-flows). Setting `count = 1` normalizes back to a single
column without corrupting the section.

**Validation rules**: must render the chosen count in-app AND export the matching `w:num` (FR-003, SC-003);
must open in Word without repair with `TextColumns.Count == count` (FR-004, SC-002).

## Entity: Column break (transient inline)

An inline break in the body run stream that advances text to the next column.

| Field | Values | Notes |
|-------|--------|-------|
| `representation` | OOXML `w:br w:type="column"` | NOT a paragraph/page break |
| `rendered` | text after the break starts at the top of the next column | the paged engine flows it |

**Validation rules**: must export as a `w:type="column"` break (FR-008) that Word honors; in-app the
following text moves to the next column.

## Entity: Columns UI state (transient)

Not persisted — drives the dropdown's checked preset + the More Columns dialog defaults.

| Field | Values | Notes |
|-------|--------|-------|
| `activePreset` | One \| Two \| Three \| Left \| Right \| More | derived from `getColumns()` (count + equalWidth) |
| dialog fields | count, spacing, equalWidth, lineBetween | seeded from `getColumns()` |
