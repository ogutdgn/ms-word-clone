# Data Model — Line Numbers

The document model stays **page-free**. These entities describe the line-numbering domain (the fork's section
store + a paragraph flag) and the transient overlay state — not new persisted model nodes.

## Entity: Section line-numbering

Per-section line-numbering config in `sectPr/w:lnNumType`.

| Field | OOXML | Word COM read-back | Notes |
|-------|-------|--------------------|-------|
| `mode` (restart) | `w:lnNumType/@w:restart` | `PageSetup.LineNumbering.RestartMode` | continuous (0) / newPage (1) / newSection (2); absent `w:lnNumType` ⇒ off (`.Active` false) |
| `countBy` | `@w:countBy` | `.CountBy` | show every Nth number (default 1) |
| `start` | `@w:start` | `.StartingNumber` | first line number (default 1) |
| `distance` | `@w:distance` (twips) | `.DistanceFromText` (points) | gap from text to the number |
| `active` | presence of `w:lnNumType` | `.Active` | on/off |

**Relationships**: belongs to the (v1 single primary) section's `sectPr`. **State transitions**: *off* →
*on(mode)* (`setLineNumbering enabled`) → *exported* (`w:lnNumType`) → *reopened* (import reads it). None
removes `w:lnNumType` without corrupting the section.

**Validation**: must export the matching `w:lnNumType` (FR-003) + open in Word with `.Active` + the right
`RestartMode` (FR-004); the in-app overlay must count to match (FR-005, SC-003).

## Entity: Paragraph line-number suppress (P3)

| Field | OOXML | Word COM | Notes |
|-------|-------|----------|-------|
| `suppress` | `pPr/w:suppressLineNumbers` | the paragraph's lines excluded from the count | "Suppress for Current Paragraph" |

## Entity: Line-number overlay (transient UI)

Not persisted — the owned in-app render.

| Field | Values | Notes |
|-------|--------|-------|
| `numbers` | one per counted painted `.superdoc-line` | positioned in the left margin |
| `counter` | continuous, or reset per `.superdoc-page` (Restart Each Page) | per the section mode |
| `visibleEvery` | `countBy` | show only every Nth number, starting at `start` |

**State transitions**: *hidden* (off / paged-only) → *rendered* (line numbers on, paged mode) → *recomputed*
(on `wc:paged-relayout` / zoom / scroll / edit). Single source — if the engine ever paints numbers natively,
the overlay disables (no double-render).
