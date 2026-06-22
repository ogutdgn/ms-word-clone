# Feature Specification: Section Breaks

**Feature Branch**: `006-section-breaks`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Layout → Breaks → Section Breaks (Next Page / Continuous / Even Page / Odd Page):
insert a real mid-document section break so the document has multiple sections, each with its own `sectPr`.
Real OOXML (a paragraph-level `pPr/w:sectPr` + `w:type`), validated against real Word (`ActiveDocument.Sections.Count`
+ each section's `PageSetup.SectionStart`); no fork edits; the in-app repagination at the break is out of scope."

## Clarifications

### Session 2026-06-22

Resolved autonomously (Word/repo defaults), confirmed by the feasibility spike — none needed a product decision.

- **Q: Is mid-doc section break insertion reachable NO-FORK?** → A: **YES (spike-proven).** The fork's public
  `editor.commands.insertSectionBreakAtSelection()` sets a paragraph-level `pPr/w:sectPr` (OOXML's mid-doc
  section-break form) via `setNodeMarkup`; the export then carries two `<w:sectPr>` and **real Word reads
  `Sections.Count == 2`, each `PageSetup.SectionStart == NewPage`**. No fork edit.
- **Q: How are the section TYPES set (Continuous / Even / Odd)?** → A: a bare `w:sectPr` defaults to **Next Page**;
  the other types add `<w:type w:val="continuous|evenPage|oddPage"/>` to the created paragraph `sectPr` via an
  **owned write** (find the governing paragraph's `paragraphProperties.sectPr`, mutate it — the 003 columns
  `bodySectPr` pattern). No fork edit.
- **Q: Does the paged engine repaginate at the break in-app?** → A: **No (known limitation).** The spike showed
  the PE does not start a new sheet at the break (`pages=1`); in-app repagination is OUT OF SCOPE — the export +
  real-Word read-back (Word paginates correctly) is the fidelity guarantee, mirroring hyphenation's in-app render.
- **Q: Scope — inserting breaks vs per-section formatting?** → A: v1 = **inserting the section breaks** (the 4
  types); independent per-section formatting (different margins/orientation/columns per section) leverages the
  existing per-section APIs and is a future feature.

## User Scenarios & Testing *(mandatory)*

The Layout → Breaks dropdown's "Section Breaks" group (Next Page / Continuous / Even Page / Odd Page) is currently
an honest placeholder. This feature wires it onto the paged engine so inserting a section break produces a real
multi-section `.docx` that Word reads with the correct section count and section-start types.

### User Story 1 - Insert a Next Page section break (Priority: P1) 🎯 MVP

A user places the caret and chooses **Breaks → Next Page**; the document is split into two sections at that point,
and saving produces a `.docx` that opens in Word with **two sections**, the break starting a **new page**.

**Why this priority**: This is the core capability and the prerequisite slice — it proves the
section-break-insertion + export + ribbon + oracle path. The other types (P2) add `w:type`.

**Independent Test**: Place the caret mid-document → Breaks → Next Page → save → reopen in Word —
`ActiveDocument.Sections.Count == 2` and `Sections(1).PageSetup.SectionStart == wdSectionNewPage`; the document
opens without repair.

**Acceptance Scenarios**:

1. **Given** a single-section document, **When** the user inserts a Next Page section break, **Then** the export
   carries a paragraph-level `<w:pPr><w:sectPr>…</w:sectPr></w:pPr>` (plus the trailing body `sectPr`) and Word
   reads `Sections.Count == 2`.
2. **Given** the inserted break, **When** opened in Word, **Then** the first section's `SectionStart` is
   **NewPage** and the document opens without repair.

---

### User Story 2 - Continuous / Even Page / Odd Page section breaks (Priority: P2)

A user chooses **Continuous**, **Even Page**, or **Odd Page** from Breaks; the inserted section break carries the
matching start type, and Word reads the section's `SectionStart` accordingly.

**Why this priority**: The break-type variants build on P1's insertion path (they add `w:type`).

**Independent Test**: Insert a Continuous break → Word reads `Sections(1).PageSetup.SectionStart == wdSectionContinuous`;
Even Page → `wdSectionEvenPage`; Odd Page → `wdSectionOddPage`.

**Acceptance Scenarios**:

1. **Given** a section break, **When** the user chooses Continuous, **Then** the export carries
   `<w:type w:val="continuous"/>` in the section's `sectPr` and Word reads `SectionStart == Continuous`.
2. **Given** a section break, **When** the user chooses Even Page / Odd Page, **Then** the export carries
   `w:type="evenPage"` / `"oddPage"` and Word reads `SectionStart == EvenPage` / `OddPage`.

---

### Edge Cases

- **Caret at the very end / in the last (trailing-sectPr) paragraph**: the break still produces a valid sectPr;
  Word may show a short trailing section — acceptable; must open without repair.
- **Multiple breaks**: inserting two section breaks yields three sections (each break adds one); export stays valid.
- **Reopen**: a section-broken document round-trips (the importer reads the paragraph `sectPr`).
- **In-app render**: the paged engine does not repaginate at the break (known limitation); the document is still
  Word-correct (Word paginates on open).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Layout → Breaks → Section Breaks items MUST be wired (no placeholder) and drive the paged engine.
- **FR-002**: Inserting a section break MUST split the document into sections at the caret via a real
  paragraph-level `pPr/w:sectPr` (NOT a visual-only effect).
- **FR-003**: The four types MUST set the section start — Next Page (bare/`nextPage`), Continuous, Even Page, Odd
  Page — as `w:sectPr/w:type`.
- **FR-004**: A saved section-broken document MUST open in Microsoft Word without repair, with
  `ActiveDocument.Sections.Count` increased and each new section's `PageSetup.SectionStart` matching the type.
- **FR-005**: All writes MUST go through the `WC.PM` bridge (the only document-write path); the document model
  stays page-free; NO edits to the vendored fork (`src/renderer/core/superdoc-fork/*`).
- **FR-006**: In-app repagination at the break is OUT OF SCOPE (a recorded known-limitation); the export + Word
  read-back is the fidelity guarantee.

### Key Entities *(include if feature involves data)*

- **Section break**: a paragraph-level `pPr/w:sectPr` ending a section; `w:type` (nextPage default / continuous /
  evenPage / oddPage) sets where the next section starts. Read back from Word as `Sections.Count` +
  `PageSetup.SectionStart`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can insert each of the four section-break types from Layout → Breaks.
- **SC-002**: 100% of the exercised types open in **Microsoft Word for Windows** without repair with the correct
  `Sections.Count` and `SectionStart`.
- **SC-003**: No regression: the existing gate suite stays green (`test:pm` overlay 475, `test:smoke` 9,
  `test:roundtrip` 27, `test:bundle` 4) and the paged section-breaks probe + the Word-COM oracle pass.

## Assumptions

- **Parity oracle**: "Microsoft Word for Windows" is the project's domain ground-truth oracle (COM read-back),
  the standing fidelity reference (001–005).
- **No-fork via the public command** `editor.commands.insertSectionBreakAtSelection()` (spike-proven) + an owned
  `w:type` write for non-default types (the 003 `bodySectPr` pattern).
- **In-app repagination out of scope** (the paged PE does not repaginate at the break — known limitation).
- **Scope = inserting section breaks** (the 4 types); per-section independent formatting is a future feature.
- **Reuses** the paged engine, the `WC.PM` bridge, the already-un-deferred Layout → Breaks plumbing (003), the
  real-paged-renderer probe harness, and the Word-COM oracle (`com-validate.js`).
- **Delivery** is incremental, oracle-gated slices (P1 Next Page, P2 the other types), each its own verify →
  `/code-review` → ff-merge-into-`general-done` cycle on `006-section-breaks`.
