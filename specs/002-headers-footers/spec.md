# Feature Specification: Headers & Footers in the paged editor

**Feature Branch**: `feature/headers-footers-paged`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "Headers & Footers in the paged editor — make headers and footers a real, Word-faithful feature on the now-default paged engine."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter, edit, and close header/footer editing (Priority: P1)

A user wants to add a running header (e.g. a document title) and footer to their document the way they would in Microsoft Word. They enter the header area — by double-clicking the top margin of a page, or by choosing Insert → Header / Footer — and the editor shifts focus into that region: a "Header & Footer Tools" contextual tab appears in the ribbon, the body text dims, and a caret sits in the header. They type and format the header content directly on the page, watching it appear on every page. "Go to Footer" jumps to the footer region; "Go to Header" jumps back. When done, "Close Header and Footer" (or clicking back into the body) returns focus to the document body and hides the contextual tab. The header/footer they typed shows on every page and survives save → reopen.

**Why this priority**: This is the core of the feature — without a real way to enter, edit on-page, and exit the header/footer, none of the richer options (variants, page numbers) have anywhere to live. It is the minimum that turns the current single-line plain-text modal into a Word-like experience and is independently demonstrable.

**Independent Test**: Open a document, enter the header region, type text, switch to the footer, type text, close — and confirm both appear on every page, the contextual tab shows and hides correctly, and after save → reopen (and after opening the saved file in Microsoft Word) the same header and footer text is present.

**Acceptance Scenarios**:

1. **Given** a document in the body, **When** the user double-clicks the top page margin (or chooses Insert → Header), **Then** focus moves into the header region, the body dims, and the "Header & Footer Tools" contextual tab appears.
2. **Given** the user is editing the header, **When** they type text, **Then** that text appears in the header band of every page.
3. **Given** the user is editing the header, **When** they choose "Go to Footer", **Then** focus moves to the footer region of the current page.
4. **Given** the user is editing a header or footer, **When** they choose "Close Header and Footer" (or click into the body), **Then** focus returns to the body, the contextual tab is hidden, and the header/footer content remains on every page.
5. **Given** a document with a header and footer, **When** the user saves it and reopens it (and when the saved file is opened in Microsoft Word), **Then** the same header and footer text is shown with no repair prompt.

---

### User Story 2 - Different First Page / Different Odd & Even Pages (Priority: P2)

A user wants the first page of their document to have a different (or no) header than the rest — e.g. a title page — and/or wants left- and right-hand (odd/even) pages to carry mirrored headers, as in a printed book. While editing the header/footer they toggle "Different First Page" and/or "Different Odd & Even Pages"; the editor then lets them give the first page (and/or even pages) their own header and footer content distinct from the default. These choices and the distinct content survive save → reopen and match what Microsoft Word shows.

**Why this priority**: These are the two most common header/footer structure options in real documents (title pages, book layouts) and are standard Word section settings. They build directly on P1 (you must be able to edit a header before you can give the first page a different one) but are not required for the MVP.

**Independent Test**: Enable "Different First Page", give the first page a distinct header, give the default (rest-of-document) pages another header; save, reopen, and open in Microsoft Word — confirm the first-page header differs from the others and the "Different First Page" option is set. Repeat for "Different Odd & Even Pages".

**Acceptance Scenarios**:

1. **Given** a multi-page document being edited in the header, **When** the user enables "Different First Page" and edits the first-page header, **Then** page 1 shows the first-page header and pages 2+ show the default header.
2. **Given** "Different Odd & Even Pages" is enabled, **When** the user edits the even-page header, **Then** even-numbered pages show the even header and odd pages show the default/odd header.
3. **Given** either option is enabled with distinct content, **When** the document is saved and opened in Microsoft Word, **Then** Word reports the same option as enabled and shows the same distinct header/footer content, with no repair prompt.

---

### User Story 3 - Page numbers in the header/footer (Priority: P3)

A user wants automatic page numbers. While editing a header or footer (or via Insert → Page Number) they insert a page number at the top, bottom, or current cursor position. The inserted number shows the correct page on every page (1 on page 1, 2 on page 2, …) and updates as pages are added or removed. They can also remove the page numbers. When saved and opened in Microsoft Word, the page numbers are a real, live page-number field — not frozen text — and update in Word too.

**Why this priority**: Page numbering is the single most-used header/footer feature, but it depends on being able to edit a header/footer (P1) and is a self-contained increment that can ship after the editing experience exists.

**Independent Test**: Insert a page number into the footer, confirm each page shows its own number; add a page and confirm numbers update; remove the page number; save and open in Microsoft Word and confirm the footer carries a live page-number field showing the right values.

**Acceptance Scenarios**:

1. **Given** a multi-page document, **When** the user inserts a page number into the footer, **Then** each page's footer shows that page's number.
2. **Given** page numbers are present, **When** the document gains or loses a page, **Then** the displayed numbers update to stay correct.
3. **Given** page numbers are present, **When** the document is saved and opened in Microsoft Word, **Then** Word shows a live page-number field with the correct values and no repair prompt.
4. **Given** page numbers are present, **When** the user chooses "Remove Page Numbers", **Then** the page-number field is removed from the header/footer.

---

### Edge Cases

- **Empty header/footer**: entering and leaving a header without typing must not create an empty/garbage header part or change the saved file's structure in a way that triggers a Word repair.
- **Single-page document**: "Different Odd & Even" and page numbers must behave sensibly when there is only one page (page 1 only; the even variant simply has nowhere to show).
- **Existing plain-text header from the old modal**: a document whose header was set via the previous plain-text path must still open, display, and be editable; the new on-page editing must not lose or corrupt it.
- **Opening a .docx authored in Word that already has headers/footers** (including first-page/odd-even variants and page-number fields): those must render in the paged view and be editable, not dropped.
- **Close with focus ambiguity**: clicking directly from a header into the body, or from a header into a different page's footer, must resolve to a single unambiguous focus target.
- **No header/footer present**: choosing "Go to Header" on a document that has no header yet must create/enter an empty header rather than error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to enter header or footer editing on the page — both by double-clicking the page's top/bottom margin region and via the Insert → Header / Footer commands.
- **FR-002**: When header/footer editing is active, the system MUST show a "Header & Footer Tools" contextual ribbon tab, and MUST hide it when editing ends.
- **FR-003**: Users MUST be able to edit header and footer content directly on the page while editing is active, and the edited content MUST appear on every applicable page.
- **FR-004**: The system MUST provide "Go to Header" and "Go to Footer" to move focus between the two regions, and "Close Header and Footer" to return focus to the document body.
- **FR-005**: The existing plain-text header/footer set path MUST continue to function and MUST NOT regress (documents that used it keep working).
- **FR-006**: Users MUST be able to enable "Different First Page" so the first page can carry a header/footer distinct from the rest of the document.
- **FR-007**: Users MUST be able to enable "Different Odd & Even Pages" so odd and even pages can carry distinct headers/footers.
- **FR-008**: The first-page and odd/even header/footer variants, and the toggles that enable them, MUST round-trip to and from a saved document (saved, reopened, and opened in Microsoft Word, they match).
- **FR-009**: Users MUST be able to insert a page number into a header or footer (at top, bottom, or current position) that displays the correct page number on each page and updates when pagination changes.
- **FR-010**: Users MUST be able to remove inserted page numbers.
- **FR-011**: A saved page number MUST be a live page-number field (Microsoft Word shows it as an updating field, not static text).
- **FR-012**: The saved document MUST open in Microsoft Word for Windows without triggering a repair prompt, and the header/footer text, the Different-First-Page and Odd-&-Even settings, and the page-number field MUST read back correctly in Word (validated via the COM oracle).
- **FR-013**: Headers, footers, and page numbers MUST render correctly in the default paged view (real per-page header/footer regions on each page).
- **FR-014**: Header/footer commands that were previously blocked/deferred and are now delivered MUST be un-blocked, and any dead command handlers wired into them MUST be replaced so they cannot error.

### Key Entities *(include if feature involves data)*

- **Header / Footer region**: the editable area at the top (header) or bottom (footer) of a page. Has a *variant* — default, first-page, or even-page — and content (text, formatting, and possibly a page-number field). Belongs to a document section.
- **Header/Footer structure options**: per-section toggles — "Different First Page" and "Different Odd & Even Pages" — that determine which variants are active.
- **Page-number field**: a live field placed in a header/footer that resolves to the current page's number wherever it appears.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can enter a header, type content, switch to the footer, type content, and close — and the content appears on 100% of applicable pages — without leaving the page (no separate modal needed for the core flow).
- **SC-002**: 100% of documents saved with a header, footer, a distinct first-page header, and a page number open in Microsoft Word for Windows **without a repair prompt**.
- **SC-003**: When such a document is opened in Microsoft Word, the header text, footer text, the Different-First-Page flag, the Different-Odd-&-Even flag, and the page-number field all match what was authored (verified by reading them back from Word), with **zero mismatches** on the validated fields.
- **SC-004**: Inserted page numbers show the correct, distinct number on every page of a multi-page document, and remain correct after a page is added or removed.
- **SC-005**: The existing automated gates (the functional suite, smoke, and the docx round-trip) and the header/footer parity checks continue to pass with **zero regressions** after the feature lands.

## Assumptions

- **Single primary section**: documents are assumed to have one section for this feature; multi-section documents and true cross-section "Link to Previous" semantics are out of scope (the "Link to Previous" control may be shown but is inert within a single section).
- **Paged engine is the target**: the feature is built for and validated in the default paged rendering engine, which already paints per-page header/footer regions; the legacy overlay engine is not a target for the on-page experience.
- **Reasonable variant scope**: "default", "first page", and "even page" header/footer variants are supported; Word's three-variant model is assumed sufficient.
- **Out of scope for this feature (future work)**: Date & Time, Document Info / Quick Parts fields, inserting pictures into the header, the alignment-tab control, header/footer distance-from-edge spinners, and building-block / "Save to Gallery" galleries.
- **Validation environment**: Word-parity validation runs on the Windows development box against real Microsoft Word for Windows (the COM oracle) and is a development/CI-on-dev-box gate, not part of headless CI.
- **Existing edit seam reused**: the feature reuses the existing document-model header/footer editing path and the paged engine's existing per-page header/footer rendering rather than introducing a parallel model.
