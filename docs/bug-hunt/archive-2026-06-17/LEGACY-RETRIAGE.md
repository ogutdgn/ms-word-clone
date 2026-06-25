# Legacy 55-bug re-triage vs current PM codebase (2026-06-17)

The pre-PM-pivot `BUG_BUST_FINDINGS.md` (55 bugs) re-checked against the current PM code. Status per bug + PM evidence.

**Totals:** 55 re-triaged — 3 new-variant · 37 fixed-in-pm · 6 already-logged · 6 not-applicable · 3 still-present

## Still-present / new-variant (NEW bugs not already logged)

### [S3] (Home) Shift+Tab on a top-level list item produces invalid block structure (bare span/br, split list) instead of a paragraph
- **PM status:** new-variant (clone behavior **runtime-confirmed** — probe `retriage-verify.js` → `SHIFT_TAB`: `hasNumbering` true before AND after, `stillInList:true`, `keyHandled:true` = silent no-op; Word's outdent-out-of-list is standard expected behavior)
- **PM evidence:** PM lists are NOT structural <ul>/<ol>/<li> nodes — they are flat paragraphs carrying numberingProperties{numId,ilvl} attrs. Shift+Tab is bound to decreaseListIndent (paragraph.js:268-270) -> decreaseListIndent.js:8-18 -> changeListLevel(-1) (changeListLevel.js:14). At top level ilvl=0, newLevel = 0 + (-1) = -1, hits the `if (newLevel < 0)` branch (changeListLevel.js:73-76): sets encounteredNegativeLevel=true, continues, and the function returns `true` at line 93 (consume the key) WITHOUT removing the list formatting. The legacy DOM-corruption class (bare span/br, split list, invalid block) is STRUCTURALLY IMPOSSIBLE here (no <li> to mangle). BUT a related-but-different fidelity bug exists: Shift+Tab on a level-1 list item is a SILENT NO-OP — Word instead removes the list formatting and converts the item to a normal paragraph. Same no-op path for the ribbon Decrease Indent button: stepIndent (commands.js:71-82) routes inList -> decreaseListIndent and never falls through to a remove-list/decreaseTextIndent command at ilvl=0. NOT in the ledger; the fidelity audit (FIDELITY-AUDIT-DETAIL.md:481-484 'Decrease Indent — match') only flags it as an open question ('decrease inside list at ilvl 0 (outdents out of list in Word?)') and never logged it.
- **Note:** Bug-class downgraded from the legacy S1 corruption to an S3 fidelity no-op. needsRuntime to confirm Word for Windows actually outdents a level-1 item out of the list on Shift+Tab (strongly expected). Fix: at ilvl=0, route to removeNumberingProperties (core/commands/removeNumberingProperties.js exists) instead of returning a bare consumed no-op.

### [S2] (Insert) Adding a bookmark with an existing name creates a duplicate element with the same id instead of moving it
- **PM status:** still-present (clone behavior **runtime-confirmed** — probe `retriage-verify.js` → `BOOKMARK_DUP`: after re-adding name "BM1", `startCountSameName:2`, `ids:["0","1"]`, `duplicateName:true` = two bookmarks share the name)
- **PM evidence:** src/renderer/bridge/insert.ts:102-123 insertBookmark() does NO name-existence/dedup check: it trims the name, mints a fresh id via nextBookmarkId (insert.ts:108,585-594), and unconditionally inserts a new bookmarkStart{name,id}+bookmarkEnd{id} pair (lines 114-118). The dialog's Add handler (public/js/insert-features.js:269) calls pm.insertBookmark with no guard, and nothing in commands.js (H.bookmark, commands.js:431) dedupes. So re-adding name 'BM1' yields TWO bookmarkStart nodes named 'BM1' (different ids) — invalid in Word (bookmark names must be unique) and not the move-in-place behavior Word performs. Corollary: removeBookmark/goToBookmark/renameBookmark (bookmark-start.js:169-217 / insert.ts:135-158) all stop at the FIRST name match (return false), so the duplicate persists and can't be cleanly removed/navigated.
- **Note:** NEW confirmed bug, NOT in the ledger. The ledger only verified 'Bookmark insert pairs start+end' (the B1 paired start/end fix) as CLEAN — it never tested re-adding an existing name. Word moves the bookmark (delete old, place at new selection); fix = in insertBookmark, if listBookmarks() already contains name, removeBookmark(name) first (or re-point start/end), then insert. Runtime check: add 'BM1', re-add 'BM1', confirm 2 bookmarkStart name=BM1 in the model and that export produces duplicate w:bookmarkStart names.

### [S4] (References) Inserting Table of Figures or Bibliography twice stacks a duplicate (no replace-in-place, unlike Index/ToA)
- **PM status:** still-present
- **PM evidence:** Neither the bridge nor the insert wrappers dedup. refInsertTOF (references.ts:318-329) calls d.fields.insert with no existing-field check; insertRawField unconditionally tr.insert(resolved.from, node) (field-wrappers.ts:209-225). refInsertBibliography (references.ts:611-619) calls d.citations.bibliography.insert({at:{kind:'documentEnd'}}); bibliographyInsertWrapper unconditionally tr.insert(pos, node) with a fresh uuid, no findAllBibliographies guard (citation-wrappers.ts:365-400). The flyout invokes these directly per click (commands.js:975 insertTableOfFigures; commands.js:1001-1005 bibliography). Two clicks => two ToF fields / two bibliography blocks. test-suite-pm.js only asserts countNodes('bibliography') < 1 (line 5270), so double-insert is unguarded AND untested. Word's Insert Bibliography / Insert Table of Figures replace/append once at the field location, not stack indefinitely.
- **Note:** NEW confirmed bug. Same defect class as legacy, re-implemented in the PM insert wrappers. Not in the BUG-LEDGER.

### [S4] (References) Index/ToA replace-in-place vs ToF/Bibliography stack (the asymmetry half of the legacy duplicate finding)
- **PM status:** new-variant
- **PM evidence:** The legacy asymmetry (Index/ToA replaced in place; ToF/Bibliography did not) is GONE — in PM NONE of the constructs dedup. indexInsertWrapper unconditionally tr.insert(pos, node) (index-wrappers.ts:120-135) with no findAllIndexNodes guard; authorities and TOC inserts follow the same pattern (refInsertTOA references.ts:410-418 -> d.authorities.insert; refInsertIndex references.ts:354-362 -> d.index.insert; both via the flyout/ribbon with no existence check). So in the PM world the variant is: inserting Index, ToA, ToC, ToF, OR Bibliography twice all stack a duplicate. The specific 'ToF/Bibliography only' framing no longer holds — it is now a uniform missing-dedup across all reference fields.
- **Note:** Related-but-different: the asymmetry inverted into a uniform no-dedup. Captured here so the duplicate-stacking fix covers all five constructs, not just ToF/Bibliography.

### [S3] (Layout) Positioned objects anchor to the whole document, not their own page
- **PM status:** new-variant (root cause **runtime-confirmed** — probe `anchor-print-verify.js` → `BUG029_pageAnchor`: on a 7-page doc `pagination-break-wrapper`=0 while `pm-page-spacer`=7/`pm-gap-band`=6, so `findPreviousDomNodeWithClass('pagination-break-wrapper')`→null = per-page anchor branch is dead code)
- **PM evidence:** PM has a different anchoring model and a latent mismatch. (a) The user-facing Position presets are blocked (layout-arrange not in ENGINE_READY, index.ts:157); session reposition goes through setImagePosition (insert.ts:528-556) writing marginOffset relative to column/paragraph (anchorData hRelativeFrom='column'/vRelativeFrom='paragraph', insert.ts:546) — column/paragraph-relative, neither whole-doc nor true page-relative. (b) The fork DOES have page-relative absolute anchoring for vRelativeFrom==='margin' images (imagePositionPlugin.js:153-169 anchors to the previous 'pagination-break-wrapper' DOM node), BUT the clone's owned pagination layer emits 'pm-page-spacer'/'pm-gap-band' nodes (pagination.ts:85/97), NOT 'pagination-break-wrapper' — so findPreviousDomNodeWithClass (imagePositionPlugin.js:214) returns null in the clone and the per-page branch is dead. wrap=None images fall back to position:absolute (image.js:437) resolved against the nearest positioned ancestor, with marginOffset.top (image.js:615) — not page-relative. Net: a multi-page floating-object anchor is layout-engine-gated and behaves differently from both legacy and Word; needs a live multi-page check.

### [S3] (File-IO) PDF export and Print capture app chrome (title bar, ribbon) and inter-page gap bands — no print stylesheet exists
- **PM status:** still-present (**runtime-confirmed** — probe `anchor-print-verify.js` → `BUG030_printCss`: 9 stylesheets scanned, `mediaPrintRules:0`, `printTargetedSheets:0`, and `#titlebar`/`#ribbon`/`#statusbar`/`#ruler` all present in the printed DOM)
- **PM evidence:** No @media print stylesheet and no before-print chrome-hiding logic exist anywhere in src/renderer (grep '@media print' -> 0 hits in source; grep 'beforeprint|window.print|media=print' -> only dictionary/ribbon-tooltip/unrelated fork matches). main.js:460-470 doc:print calls mainWindow.webContents.print({printBackground:true}) over the WHOLE window, and main.js:440-458 doc:exportPdf calls webContents.printToPDF (margins none, full page) — both capture #titlebar/#tabstrip/#ribbon/#ruler/#statusbar AND the pagination gray gap bands (pagination.ts pm-gap-band decorations) since nothing hides them at print time.
- **Note:** NEW confirmed bug not in the ledger. Runtime: doc:exportPdf -> open the PDF (or webContents.print to PDF) and confirm the chrome + inter-sheet gray bands appear. Self-contained fix: add an @media print block hiding chrome + .pm-gap-band and resetting the sheet.


## Fixed-in-PM / already-logged / N-A (no action)

| Status | Area | Legacy bug |
|--------|------|------------|
| fixed-in-pm | Home | Format Painter across a paragraph boundary corrupts the document (inline <span> wraps <p>  |
| fixed-in-pm | Home | Change Case on a multi-paragraph selection injects spurious empty paragraphs (document cor |
| already-logged (BUG-025) | Home | Change Case uses execCommand('insertText'), corrupting run formatting at boundaries and co |
| fixed-in-pm | Insert | Inserting a cover page does not replace the existing one — covers stack up |
| not-applicable | Insert | Inserting a cover page when a header exists pushes the header below the cover (into mid-do |
| fixed-in-pm | Insert | Convert Text to Table nests an invalid <table> inside <ul>/<ol> when the selection is a li |
| fixed-in-pm | Insert | Insert/Delete Column corrupts the grid when the table contains merged (colspan) cells |
| fixed-in-pm | Insert | Split Cell adds a whole column to every row instead of splitting just the selected cell |
| fixed-in-pm | References | Footnote/endnote markers and note text get mismatched when notes are inserted out of docum |
| fixed-in-pm | References | restyle() resolves citations by stale array index first, silently rebinding to the wrong s |
| fixed-in-pm | References | IEEE/numbered bibliography is alphabetized and unnumbered, so in-text [n] markers don't ma |
| fixed-in-pm | References | Update Table never rebuilds the Table of Figures — entries and page numbers stay stale |
| fixed-in-pm | References | Captions numbered by count, not document position — mid-document insertion yields out-of-o |
| fixed-in-pm | References | Bibliography heading is wrongly picked up as a document heading and added to the Table of  |
| fixed-in-pm | Mailings | Importing a real .csv via 'Use an Existing List' silently does nothing (no .csv handler in |
| fixed-in-pm | Mailings | Update Labels clobbers an ordinary user table when no label table exists (falls back to fi |
| fixed-in-pm | Mailings | Finish & Merge → Edit Individual Documents overwrites the merge template in place instead  |
| fixed-in-pm | Mailings | Labels → Print permanently appends the labels table into the current document |
| fixed-in-pm | Mailings | CSV/text import corrupts & < > (entity-stripped to a space) and ignores RFC-4180 quoting |
| already-logged (BUG-008) | Mailings | Greeting Line / Address Block discard all dialog choices; merge output is hardcoded |
| fixed-in-pm | Mailings | Match Fields mapping is never applied to Address Block / Greeting Line / merge fields (Mat |
| fixed-in-pm | Mailings | Editing during Preview Results is silently discarded when preview is toggled off (data los |
| fixed-in-pm | Review | Cut / Ctrl+Backspace / Enter bypass Track Changes (untracked deletions and paragraph break |
| fixed-in-pm | Review | Typing over a selection with Track Changes on hard-deletes the original text (no <del>, re |
| fixed-in-pm | Review | 'Accept This Change' / 'Reject This Change' don't mark the document dirty (accepted change |
| fixed-in-pm | Review | Next/Previous change navigation doesn't advance — Next re-selects the first revision; Prev |
| fixed-in-pm | Review | Pasting with Track Changes on inserts untracked content |
| fixed-in-pm | Review | Ribbon 'Delete' / 'Delete All Comments' leave stale orphan cards in the open Comments pane |
| already-logged (BUG-019c) | Draw | Point/Small/Medium/Large/Segment erasers all delete the entire stroke (eraseMode never rea |
| fixed-in-pm | Draw | Lasso-selected ink cannot be deleted — Delete key is ignored after a lasso selection (dead |
| fixed-in-pm | Draw | Ink overlay height is sized once and never resyncs to the document — ink cannot be placed  |
| fixed-in-pm | Layout | Rotating an object discards its flip; repeated flips accumulate instead of toggling |
| fixed-in-pm | Layout | Page Width zoom divides by hardcoded 816px, over-zooming Landscape / non-Letter page width |
| already-logged (BUG-026) | Layout | Page Width zoom (landscape variant) — an opened/imported landscape doc still over-zooms be |
| not-applicable | Layout | Go To page jump uses pageH instead of pitch and omits the top-margin/padding offset, so it |
| not-applicable | Layout | Position presets (Top Center / Middle Center) and Align Middle place the object's edge at  |
| not-applicable | Layout | Line numbers number the whole blank page and never refresh after editing |
| not-applicable | Layout | Block formatting leaks onto manual page-break div and persists to saved file (LOW) |
| fixed-in-pm | File-IO | Saving a file opened from .txt/.md/.rtf throws "Unsupported save format: text" |
| fixed-in-pm | File-IO | Headers, footers, and page-number fields demoted to ordinary body text in saved .docx |
| fixed-in-pm | File-IO | Comments silently discarded when saving to .docx (data loss) |
| fixed-in-pm | File-IO | Nested tables silently dropped (inner-table content deleted) on .docx export |
| fixed-in-pm | File-IO | Block formatting leaks onto manual page-break div and persists to saved file |
| fixed-in-pm | File-IO | Hover-previewing two Color/Theme gallery cells leaves --word-blue (whole-UI accent) stuck  |
| already-logged (BUG-LEDGER 'Legacy bug RESOLVED in PM' note (Page Color erases Watermark)) | File-IO | Choosing a Page Color erases an existing Watermark (background shorthand wipes background- |
| fixed-in-pm | File-IO | Replace / Replace All does not repaginate — stale page count and orphaned gap-band spacers |
| fixed-in-pm | File-IO | Thesaurus "insert synonym" inserts into the middle of the word instead of replacing it whe |
| not-applicable | File-IO | applyInlineStyle nests empty spans + ZWSPs on repeated collapsed-caret color picks |
| already-logged (BUG-003) | File-IO | Oversized inline image (taller than the content area) is not paginated: spacers added insi |
