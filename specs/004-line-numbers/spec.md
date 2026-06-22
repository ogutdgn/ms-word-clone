# Feature Specification: Line Numbers

**Feature Branch**: `feature/line-numbers-paged`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Line Numbers (Layout → Line Numbers): None / Continuous / Restart Each Page / Restart Each Section / Suppress for Current Paragraph + a Line Numbering Options dialog, writing real OOXML `sectPr/w:lnNumType`, validated against real Word (PageSetup.LineNumbering); an owned overlay renders the numbers in the left margin (the engine doesn't paint them natively); no fork edits; incremental oracle-gated slices."

## User Scenarios & Testing *(mandatory)*

The Layout → Line Numbers control is currently blocked (an honest deferral toast). The section model and
exporter already support `w:lnNumType`, and the paged engine paints per-line DOM (`.superdoc-line`), but it
does NOT natively draw line numbers. This feature wires the control onto the engine + adds an owned overlay
so a document can show line numbers in the left margin that match Microsoft Word and round-trip to `.docx`.

### User Story 1 - Turn line numbers on/off and choose a numbering mode (Priority: P1) 🎯 MVP

A user chooses **Continuous** (or **Restart Each Page** / **Restart Each Section**) from Layout → Line
Numbers; the document is flagged to show line numbers, and saving produces a `.docx` that opens in Word with
line numbering active in that mode. Choosing **None** turns it off.

**Why this priority**: This is the core capability and the prerequisite slice — it proves the model + export
+ ribbon + oracle path. P2 (the in-app render) and P3 (paragraph suppress + options) extend it.

**Independent Test**: Choose Line Numbers → Continuous; save → reopen in Word — line numbering is **Active**
with **RestartMode = Continuous**; choose Restart Each Page → Word shows RestartMode = NewPage; choose None →
Word shows line numbering inactive.

**Acceptance Scenarios**:

1. **Given** a document, **When** the user chooses Line Numbers → Continuous, **Then** the exported `sectPr`
   carries `<w:lnNumType w:countBy="1" w:restart="continuous"/>` and Word reads `PageSetup.LineNumbering.Active`
   true with `RestartMode` = Continuous.
2. **Given** line numbers on, **When** the user chooses **Restart Each Page**, **Then** the export carries
   `w:restart="newPage"` and Word reads `RestartMode` = NewPage.
3. **Given** line numbers on, **When** the user chooses **None**, **Then** the export drops `w:lnNumType` and
   Word reads line numbering inactive; the document opens without repair.
4. **Given** **Restart Each Section**, **When** exported, **Then** `w:restart="newSection"` and Word reads
   RestartMode = NewSection.

---

### User Story 2 - See the line numbers in the margin (Priority: P2)

With line numbers on, the user SEES small numbers in the left margin beside each line on the page, counting
according to the chosen mode (continuous / restart per page / restart per section) and the count-by interval.

**Why this priority**: The in-app render is the visible payoff, but the paged engine does not paint line
numbers natively, so it needs an owned overlay (built after P1 establishes the model). P1 already delivers a
Word-correct document; P2 makes it visible in the app too.

**Independent Test**: With Continuous line numbers on a multi-line page, the margin shows 1, 2, 3, … beside
the lines; on a 2-page doc, Restart Each Page restarts the margin numbers at 1 on page 2; count-by 5 shows
only 5, 10, 15, ….

**Acceptance Scenarios**:

1. **Given** Continuous line numbers, **When** the page renders, **Then** a number appears in the left margin
   beside each counted painted line (1, 2, 3, …), tracking zoom/scroll/relayout.
2. **Given** Restart Each Page on a 2-page document, **When** rendered, **Then** page 2's margin numbers
   restart at 1.
3. **Given** a count-by of 5, **When** rendered, **Then** only every 5th line shows a number (5, 10, 15, …).
4. **Given** line numbers turned off (None), **When** rendered, **Then** no margin numbers appear.

---

### User Story 3 - Suppress for a paragraph + Line Numbering Options (Priority: P3)

A user opens **Line Numbering Options** to set the **start-at** number, the **count-by** interval, and the
**from-text distance**; and uses **Suppress for Current Paragraph** to exclude the current paragraph's lines
from the count.

**Why this priority**: Fine-grained control (start/count-by/distance, per-paragraph suppress) is secondary to
turning line numbering on and seeing it; it builds on P1/P2.

**Independent Test**: Set start-at 5, count-by 2 → Word reads StartingNumber 5, CountBy 2; place the caret in
a paragraph and Suppress for Current Paragraph → that paragraph carries `w:suppressLineNumbers` and Word skips
its lines in the count.

**Acceptance Scenarios**:

1. **Given** Line Numbering Options, **When** the user sets start-at 5 and count-by 2, **Then** the export
   carries `w:start="5" w:countBy="2"` and Word reads StartingNumber 5 / CountBy 2.
2. **Given** the caret in a paragraph, **When** the user chooses Suppress for Current Paragraph, **Then** that
   paragraph's properties carry `w:suppressLineNumbers` and Word excludes its lines from the count.
3. **Given** a from-text distance set, **When** exported, **Then** `w:distance` carries the value and Word
   reads DistanceFromText.

---

### Edge Cases

- **None on an already-off doc**: a no-op; must not corrupt the section.
- **Restart Each Section in a single-section doc**: behaves like Continuous (one section); exports
  `w:restart="newSection"` faithfully.
- **Count-by larger than the line count**: valid; few/no numbers show; export carries the requested countBy.
- **Reopen**: a line-numbered doc exported then reopened keeps line numbering on (import reads `w:lnNumType`).
- **Overlay vs paint**: the in-app numbers are an owned overlay; if the engine ever paints them natively the
  overlay must not double-render (single source).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Layout → Line Numbers control MUST be un-blocked (no deferral toast) and drive the paged engine.
- **FR-002**: The presets MUST set the section line-numbering mode — None (off), Continuous, Restart Each Page,
  Restart Each Section.
- **FR-003**: Line numbering MUST export as real OOXML `<w:lnNumType>` in the section's `sectPr`
  (`w:countBy`, `w:start`, `w:restart`, `w:distance`), NOT a visual-only effect.
- **FR-004**: A saved line-numbered document MUST open in Microsoft Word without repair, with
  `PageSetup.LineNumbering.Active` and the matching `RestartMode`.
- **FR-005**: The app MUST render the line numbers in the left margin beside the lines (an owned overlay),
  counting per the chosen mode + count-by; the rendered numbers MUST match the exported configuration.
- **FR-006**: A "Line Numbering Options" surface MUST let the user set start-at, count-by, and from-text
  distance; these MUST persist to the export and read back in Word.
- **FR-007**: "Suppress for Current Paragraph" MUST mark the current paragraph with `w:suppressLineNumbers`
  so Word excludes its lines from the count.
- **FR-008**: Choosing None MUST cleanly remove the line-numbering setting without corrupting the section.
- **FR-009**: All writes MUST go through the `WC.PM` bridge (the only document-write path); the document model
  stays page-free; NO edits to the vendored fork (`src/renderer/core/superdoc-fork/*`).

### Key Entities *(include if feature involves data)*

- **Section line-numbering**: the per-section config in `sectPr/w:lnNumType` — `mode/restart` (none /
  continuous / newPage / newSection), `countBy`, `start`, `distance`. Read back from Word as
  `PageSetup.LineNumbering` (Active / RestartMode / CountBy / StartingNumber / DistanceFromText).
- **Paragraph suppress**: a paragraph-level `w:suppressLineNumbers` flag excluding that paragraph from the count.
- **Line-number overlay (transient UI)**: the owned in-app render — numbers positioned in the left margin
  beside each painted `.superdoc-line`, recomputed on relayout; not persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can turn line numbering on (Continuous / Restart Each Page / Restart Each Section) and off
  from the Line Numbers dropdown.
- **SC-002**: 100% of the exercised modes open in **Microsoft Word for Windows** without repair and read back
  the correct `PageSetup.LineNumbering` (Active + RestartMode, plus CountBy/StartingNumber for the options case).
- **SC-003**: With line numbers on, the app shows the numbers in the margin counting correctly (continuous, or
  restarting per page), matching the exported configuration (no divergence between the app and what Word receives).
- **SC-004**: Suppress-for-paragraph excludes that paragraph's lines from the count both in-app and in Word's
  read-back (`w:suppressLineNumbers`).
- **SC-005**: No regression: the existing gate suite stays green (`test:pm` overlay 475, `test:smoke` 9,
  `test:roundtrip` 27, `test:bundle` 4) and the paged line-numbers probe + the Word-COM oracle pass.

## Assumptions

- **Parity oracle**: "Microsoft Word for Windows" in the success criteria is the project's domain ground-truth
  oracle (COM read-back), not an implementation technology — the project's standing fidelity reference (001–003).
- **Engine doesn't paint line numbers**: feasibility-probed — `editor.doc.sections.setLineNumbering(...)`
  exports `<w:lnNumType>` + reads back, but the paged engine renders **0** line-number elements, so the in-app
  render (P2) is an owned overlay over the painted `.superdoc-line` DOM (the comments/ink-overlay pattern).
- **Scope = single (primary) section** for the v1 mode/export; multi-section per-section line numbering is out
  of scope for v1 (Restart Each Section still exports `newSection` faithfully).
- **OOXML element names** (`w:lnNumType`, `w:suppressLineNumbers`) name the document file format Word
  reads/writes (the feature's domain), making the requirements testable against the Word-COM oracle (001–003).
- **Reuses** the paged engine, the `WC.PM` bridge, the Layout ribbon plumbing, the real-paged-renderer probe
  harness, the owned-overlay pattern (comments-ui/ink-overlay), and the Word-COM oracle (`com-validate.js`).
- **Delivery** is incremental, oracle-gated slices (P1 model+export+ribbon, P2 the in-app overlay render, P3
  paragraph-suppress + options), each its own verify → `/code-review` → ff-merge-to-`main` → push cycle on
  `feature/line-numbers-paged`.
