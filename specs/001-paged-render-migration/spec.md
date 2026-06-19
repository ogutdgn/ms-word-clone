# Feature Specification: Paged Render Migration (real per-page layout)

**Feature Branch**: `001-paged-render-migration` *(branch created at plan/implement time)*

**Created**: 2026-06-18

**Status**: Draft — clarifications resolved; ready for `/speckit-plan`

**Input**: User description: "Retarget the editor's render layer to SuperDoc's real per-page layout engine (the vendored PresentationEditor) behind the WC_LAYOUT=overlay|paged toggle, replacing the decoration-overlay pagination hack. A standup spike proved the engine paints real per-page DOM, paginates 1→N pages, keeps the model page-free (.docx round-trips), and caret/typing work, with zero overlay-mode regression."

> WHY / context: today "pages" are an illusion painted as decoration spacers over one continuous sheet, which structurally cannot do real per-section geometry, on-page headers/footers/footnotes, table row-split, true float wrap, or correct caret near breaks — and is the root cause of a large class of bugs. The standup spike (see [docs/layout-engine-standup-findings.md](../../docs/layout-engine-standup-findings.md)) proved the real engine works. This feature migrates the **render layer** to it. The HOW (coordinate adapter, dynamic-import, milestone order) belongs in the plan, not here.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit on real, separate pages with a correct caret (Priority: P1)

A person editing a document in paged mode sees it laid out as **real, distinct pages** (not one continuous ribbon); the page count reflects the true number of pages; clicking anywhere and typing places the caret exactly where expected — including near page boundaries, where it is misplaced today.

**Why this priority**: Foundational and must-work. Without real pages + a correct caret, paged mode is not usable for editing. It is the slice that proves the real engine is editable in our app and kills the standup-confirmed caret-misplacement bug class.

**Independent Test**: Open a document longer than one page in paged mode; verify N distinct page containers render, the page-count indicator reads N (matching the engine), and clicking/typing on any page — including the first/last line of a page — lands the caret at the clicked position.

**Acceptance Scenarios**:

1. **Given** a document that overflows one page in paged mode, **When** it renders, **Then** the app shows N real separate page containers and the page-count indicator reads N.
2. **Given** the caret is placed by clicking glyph G on page P, **When** the user types, **Then** the inserted text appears at G's position with no off-by-line or off-by-page jump.
3. **Given** the document is edited and pages reflow, **When** the document is saved, **Then** the saved file's structure is unchanged by paged rendering (no page artifacts introduced).

---

### User Story 2 - Page-anchored objects and annotations (Priority: P2)

A person using images, freehand ink, comments, tracked changes, footnotes/notes, and headers/footers sees each of these positioned correctly relative to the **real page** it belongs to in paged mode.

**Why this priority**: These are the high-value editing surfaces; in paged mode they must follow the real pages, not the old continuous geometry, or the feature is visibly broken for real documents.

**Independent Test**: In paged mode, resize an image, draw ink, add a comment and a tracked change, and confirm each renders anchored to the correct page region (handles on the image, comment card/bar against the right page, etc.).

**Acceptance Scenarios**:

1. **Given** a floating/inline image on page P in paged mode, **When** it is selected, **Then** its resize handles align to the image on page P.
2. **Given** a comment / tracked change / footnote anchored to content on page P, **When** the page renders, **Then** its chrome (card, change bar, note region) is positioned against page P.

---

### User Story 3 - Save to Word with matching layout (Priority: P2)

A person saves a paged-mode document to `.docx` and opens it in Microsoft Word; Word opens it without a repair prompt and the page/paragraph layout matches what the app showed.

**Why this priority**: Export fidelity is the product's core promise (faithful Word clone + CUA verification env). The render migration must not regress the `.docx` path.

**Independent Test**: Save a paged-mode document; open it via the Word COM oracle (`scripts/oracle/word-oracle-win.ps1`); assert no-repair + page-count / paragraph-count parity with the app.

**Acceptance Scenarios**:

1. **Given** a document edited in paged mode, **When** it is saved and opened in Word, **Then** Word opens it without repair.
2. **Given** the same document opened+saved in paged vs overlay mode, **When** both are inspected via the oracle, **Then** their page and paragraph counts match.

---

### User Story 4 - Page-break fidelity to real Word (Priority: P3)

A person comparing the app's paged layout to Microsoft Word sees page breaks and lines-per-page that match Word within an agreed tolerance.

**Why this priority**: Fidelity polish; valuable but bounded by the accepted browser-glyph-metric ceiling, so it ranks below correctness and unblocking.

**Independent Test**: For the calibration fixtures, compare paged-mode page-break positions and lines-per-page to the COM oracle within tolerance.

**Acceptance Scenarios**:

1. **Given** a calibration document, **When** laid out in paged mode, **Then** its page count and per-page line count match the oracle within the agreed tolerance.

---

### Edge Cases

- Empty / single-paragraph document → renders exactly one page (not zero, not two).
- Very long document (dozens of pages) → renders without a noticeable typing/scroll stall.
- A document overflowing while the user types near a page boundary → the caret stays put (no jump as a new page appears).
- A table or image taller than one page → handled without painting across the inter-page gap (the reproduced overlay bug must not recur).
- Toggling the renderer / re-opening a document → no leaked DOM, no stale page count, model intact.
- A document with a section break or a landscape section → see Assumptions (per-section geometry as a *feature* may be a downstream slice; this spec covers the render foundation).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In paged mode, the system MUST render the document as real, separate per-page containers (not a continuous sheet with painted seams).
- **FR-002**: The page-count indicator MUST reflect the layout engine's actual page count.
- **FR-003**: A pointer click MUST place the caret at the correct model position on the painted pages, including at and near page boundaries (the two sites that misplace today).
- **FR-004**: Typing/editing in paged mode MUST insert at the caret's correct model position and MUST keep the document model free of page artifacts (no "page" nodes), so `.docx` export is unaffected by paged rendering.
- **FR-005**: In paged mode, image resize/relocate, freehand ink, comments, tracked changes, footnotes/notes, and headers/footers MUST be positioned relative to the correct page.
- **FR-006**: A paged-mode document saved to `.docx` MUST open in Microsoft Word without a repair prompt, with page-count and paragraph-count matching the app (validated via the Word COM oracle).
- **FR-007**: With the feature DISABLED (default), the system MUST behave identically to the current shipping app — the existing functional, smoke, and round-trip gates pass unchanged.
- **FR-008**: The system MUST let the renderer be selected between the current (overlay) renderer and the paged renderer, defaulting to overlay.
- **FR-009**: Page-break positions and lines-per-page in paged mode MUST match the Word COM oracle within an agreed tolerance for the calibration fixtures.
- **FR-010**: Loading the paged renderer MUST NOT increase the default (overlay) experience's startup cost beyond its current baseline.
- **FR-011**: A document taller than one page MUST split across page boundaries without content painting into the inter-page gap.
- **FR-012**: Every migration slice MUST be independently verifiable against the three gates and the Word COM oracle before it is considered done.
- **FR-013**: End-state: paged is the intended faithful **DEFAULT**. The overlay is retired via a **LATER, separately-gated flip** (only after all milestones are green and full COM-oracle parity is reached) — the toggle is a temporary migration scaffold, NOT a permanent co-equal mode. Within THIS feature, flipping the default and retiring the overlay remain **non-goals** (see Assumptions); they are a follow-on once parity is proven.

### Key Entities

- **Page (rendered)**: a real, indexed page container with geometry (size, margins, header/footer/footnote bands). DERIVED at render time from the document model — never stored in the model.
- **Document model**: the single source of truth for content; stays page-free and is what round-trips to `.docx`.
- **Page-anchored object/annotation**: an image, ink stroke, comment, tracked change, note, or header/footer whose on-screen position is resolved relative to the page it belongs to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each multi-page test fixture, the number of rendered page containers equals the engine's page count AND equals the count the page indicator shows (100% match).
- **SC-002**: In the caret regression set (including the two boundary sites that misplace today), a click lands the caret within ±1 character of the target, with 0 misplacements.
- **SC-003**: With the feature off (default), `test:pm`, `test:smoke`, and `test:roundtrip` pass at their current counts (268 / 9 / 27) — zero regression.
- **SC-004**: For each export fixture, a paged-mode-saved `.docx` opens in Word with no repair prompt AND matches the app's page-count and paragraph-count (oracle parity).
- **SC-005**: For the calibration fixtures, paged-mode page count and per-page line count match the oracle within the agreed tolerance.
- **SC-006**: For each of the 6 object/annotation types, it renders anchored to the correct page in the paged-mode test set (0 mis-anchored).
- **SC-007**: A document taller than one page splits across pages with 0 instances of content painted into the inter-page gap.

## Assumptions

- The document model stays **page-free**; pages are derived at render time. This is a non-negotiable constraint (it is what preserves the `.docx` round-trip).
- Validation ground truth is the **Word-for-Windows COM oracle** (`scripts/oracle/word-oracle-win.ps1`); the regression gates are `test:pm` / `test:smoke` / `test:roundtrip`.
- Feasibility is already proven by the standup spike (real per-page DOM, pagination 1→12, page-free model, working caret/typing) — this spec is the migration, not a re-investigation.
- Final glyph layout is performed by the browser engine, so page-break parity is **tuned to the oracle, not byte-identical** to Word's own typesetter (accepted ceiling; bounds FR-009 / SC-005).
- The migration proceeds **behind a toggle** (strangler-fig); the default stays the current renderer until an explicit, separately-gated decision (see FR-013).
- New layout **features** themselves — per-section geometry, on-page headers/footers/page-borders/watermark, columns, frames — are **downstream slices** built on this render foundation, not in this spec's scope (this spec delivers the foundation + retargets what already exists).
- Scope is the **whole render-layer migration as an umbrella**, with detailed design produced per-slice as each is reached (not all up front).
