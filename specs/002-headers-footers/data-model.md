# Data Model — Headers & Footers

The document model stays **page-free**. These entities describe the header/footer domain as it lives in the OOXML
model (the fork's super-converter store) and the transient editing/UI state — not new persisted model nodes.

## Entity: Header/Footer slot

A header or footer of a given variant within a section.

| Field | Values | Notes |
|-------|--------|-------|
| `kind` | `header` \| `footer` | which band |
| `variant` | `default` \| `first` \| `even` | Word's three reference types (`wdHeaderFooterPrimary`/`FirstPage`/`EvenPages`); `default` ≈ primary/odd |
| `sectionIndex` | integer | v1 = `0` only (single primary section) |
| `content` | rich text (runs) + optional `PAGE` field | v1 authoring: plain text + a page-number field; existing plain-text path preserved |
| `partName` | `word/headerN.xml` / `word/footerN.xml` | materialized lazily on first edit; referenced from `sectPr` |

**Relationships**: belongs to a section; referenced from the section's `sectPr` via
`headerReference`/`footerReference` (`@w:type` = default/first/even, `@r:id` = the part rel).

**State transitions** (a slot's existence): *inherited/absent* → *materialized* (a local part is created on first
edit and a `sectPr` reference added) → *edited* (content changes commit through the story-runtime) → *exported*
(part + reference written to the `.docx`). Removing all content does not necessarily delete the part (must not
produce a structure that triggers a Word repair — see Edge Cases).

## Entity: Section header/footer structure options

Per-section toggles that decide which variants are active.

| Field | OOXML | Word COM read-back | Notes |
|-------|-------|--------------------|-------|
| `differentFirstPage` | `sectPr/titlePg` | `PageSetup.DifferentFirstPageHeaderFooter` | enables the `first` variant |
| `differentOddEven` | `settings/evenAndOddHeaders` | `PageSetup.OddAndEvenPagesHeaderFooter` | enables the `even` variant (document-level setting in OOXML, exposed per-section in Word's UI) |
| `linkToPrevious` | (n/a single-section) | `HeaderFooter.LinkToPrevious` | v1 inert within one section; control may show but does nothing meaningful |

## Entity: Page-number field

A live field placed in a header/footer slot that resolves to the current page.

| Field | Values | Notes |
|-------|--------|-------|
| `position` | `top` \| `bottom` \| `current` | where it is inserted; top/bottom imply a header/footer target |
| `representation` | OOXML `PAGE` field | `w:fldSimple w:instr=" PAGE "` (or `fldChar`+`instrText`), NOT static text |
| `rendered` | per-page integer | the paged engine resolves it to each page's number |

**Validation rules**: must export as a real field (FR-011 — Word shows an updating field); must render the correct
distinct number per page (FR-009) and update on pagination change.

## Entity: Header/Footer editing session (transient UI state)

Not persisted — drives the contextual tab and focus.

| Field | Values | Notes |
|-------|--------|-------|
| `active` | bool | true while editing a header/footer region |
| `region` | `header` \| `footer` | which band is focused |
| `page` | integer | the page whose band is being edited (for Go to Header/Footer) |

**State transitions**: *body* → *editing header/footer* (on enter via double-click / Insert / Go-to) → shows the
"Header & Footer Tools" contextual tab; *editing* → *body* (on Close / click body) → hides the tab. The `active`
signal drives `bridge/state-sync.ts` → `syncContextualTab` exactly as the picture/table tabs are driven.
