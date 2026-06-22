# Data Model — Section Breaks

The document model stays **page-free**. A section break is a paragraph property (`pPr/w:sectPr`), not a page node.

## Entity: Section break

A paragraph-level `pPr/w:sectPr` that ends a section; the document's trailing body `sectPr` ends the last section.

| Field | OOXML | Word COM read-back | Notes |
|-------|-------|--------------------|-------|
| presence | a paragraph's `pPr/w:sectPr` | `ActiveDocument.Sections.Count` (+1 per break) | the mid-doc break form |
| type | `w:sectPr/w:type/@w:val` | `Sections(i).PageSetup.SectionStart` | nextPage(absent/default=2) / continuous(0) / evenPage(3) / oddPage(4) |

**Relationships**: belongs to the governing paragraph's `paragraphProperties.sectPr`. **State transitions**:
*single section* → *insert break* (`insertSectionBreakAtSelection` + owned `w:type`) → *exported* (2 `sectPr`) →
*reopened* (importer reads the paragraph sectPr). **Validation**: Word reads the increased `Sections.Count` +
each `SectionStart` (FR-004).

**Out of scope (v1)**: per-section independent formatting (margins/orientation/columns differing per section);
in-app repagination at the break.
