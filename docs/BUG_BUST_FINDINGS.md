# Bug-Bust Findings

Auto-collected from a 12-area find→adversarial-verify workflow. **55 confirmed real
bugs** (22 high, 30 medium, 3 low).

## Status

- ✅ **All HIGH-severity bugs fixed** — data loss + document corruption. Shipped in:
  - PR #2 `fix/bug-bust-high` — save-as-text, Change Case, cover-page, label-table,
    Labels→Print, Accept/Reject dirty, theme-hover accent, Shift+Tab list,
    Track-Changes Cut/word-delete/replace, CSV import (RFC-4180), merge→new-doc,
    table page-split, Format Painter.
  - PR #3 `fix/bug-bust-high-2` — footnote/endnote ordering, content-aware line
    numbers, .docx header/footer parts, nested-table flatten.
  - PR #4 `feat/undo-history` — real snapshot-based undo/redo (covers direct-DOM edits).
  - PR #5 `feat/comments-docx` — comments exported as native Word comments
    (validated against real Word via COM).
- 🔄 **MEDIUM / LOW in progress** (round 3) — see lists below.
- Suite at this point: **245 functional + 17 docx**, all passing.

See `docs/PROGRESS.md` for the running log.

## HIGH

- [ ] **Shift+Tab on a top-level list item produces invalid block structure (bare span/br, split list) instead of a paragraph** (?)
  - _fix:_ In editor.js promoteListItem(), replace the top-level else branch (lines 190-192 `this.exec('outdent')`) with manual DOM surgery that converts the <li> into a real <p>, mirroring the existing manual approach used for nested items. Concretely: const p = document.createElement('p'); while (li.firstChi
- [ ] **Importing a real .csv via 'Use an Existing List' silently does nothing (no .csv handler in main process)** (?)
  - _fix:_ In src/main/main.js openPath(), add a branch before the final return for delimited text: `if (ext === '.csv' || ext === '.tsv' || ext === '.txt') { const raw = await fsp.readFile(filePath, 'utf8'); await pushRecentFile(filePath); const html = raw.split(/\r?\n/).map((l) => `<p>${escapeHtml(l) || '<br
- [ ] **Update Labels clobbers an ordinary user table when no label table exists (falls back to first &lt;table&gt;)** (?)
  - _fix:_ In src/renderer/js/mailings-tools.js, updateLabels(): remove the dangerous fallback so it only operates on a real labels table. Change line 193 from `const table = E().node.querySelector('table.wc-labels') || E().node.querySelector('table');` to `const table = E().node.querySelector('table.wc-labels
- [ ] **Format Painter across a paragraph boundary corrupts the document (an inline <span> ends up wrapping <p> blocks; boundary paragraphs get split, paragraph count grows)** (?)
  - _fix:_ In commands.js painterHandler (the body around line 971), stop applying one surroundContents/extractContents over a possibly multi-block range. Instead apply the captured inline style per intersected block. Concretely: add a shared block-aware helper, e.g. `surroundRangeInline(range, makeSpan)`, tha
- [ ] **Table straddling a page boundary gets a page-gap spacer injected inside a &lt;td&gt;, tearing the cell's text with a gray band through the table** (?)
  - _fix:_ In editor.js _repaginate (the `if (straddle)` branch at ~406), detect when the straddling block is (or contains) a table and break it at a ROW boundary instead of binary-searching textContent. Minimal approach: before the text-binary-search, add `const cells = straddle.tagName === 'TABLE' ? straddle
- [ ] **Nested tables silently dropped (inner-table content deleted) on .docx export** (?)
  - _fix:_ In src/main/main.js writeDocx (around line 316-332), stop relying on html-to-docx for nested tables, since it discards any <table> nested inside a <td> while keeping the cell's text. Minimal robust fix: before calling htmlToDocx, detect nested tables in the HTML (a <table> descendant of a <td>); if 
- [ ] **Finish & Merge → Edit Individual Documents overwrites the merge template in place instead of opening a new document** (?)
  - _fix:_ In src/renderer/js/mailings-tools.js finishMerge(), for the 'edit' branch, open the merged result in a new document instead of overwriting the current editor. Replace line 149 `E().setHTML(merged);` (and its toast) with an async call to the existing helper, e.g.: `const ok = await WC.Files.newDocWit
- [ ] **Footnote/endnote markers and note text get mismatched when notes are inserted out of document order** (?)
  - _fix:_ In Ref.insertNote() (references-tools.js, ~line 56-67), replace the unconditional container.appendChild(note) on line 63 with a position-aware insert so the note DIV order matches the marker's document order. After inserting the marker (line 61), determine the new marker's index among same-kind mark
- [ ] **Cut / Ctrl+Backspace / Enter bypass Track Changes (untracked deletions and paragraph breaks)** (?)
  - _fix:_ In Review.onBeforeInput (review-tools.js:28-35) add branches for the missing destructive/structural inputTypes. Route deletions through the existing deleteTracked logic and intercept paragraph splits. Concretely: after the existing deleteContentForward branch, add: else if (t === 'deleteByCut') { e.
- [ ] **Line numbers number the whole blank page and never refresh after editing** (?)
  - _fix:_ In src/renderer/js/layout-tools.js, rewrite renderLineNumbers() to (a) count only real text lines instead of the min-height area, and (b) re-run on edits. For (a): iterate the editor's flow blocks (Array.from(E().node.children) filtered to paragraph/heading/li elements, skipping .wc-header/.wc-foote
- [ ] **Comments silently discarded when saving to .docx (data loss)** (?)
- [ ] **Labels → Print permanently appends the labels table into the current document** (?)
  - _fix:_ In src/renderer/js/mailings-tools.js:169 (the Labels dialog "Print" footer handler), snapshot the document before injecting and restore it after printing instead of leaving the table in place. Concretely, change the handler to capture the node's current innerHTML, append the labels HTML, repaginate,
- [ ] **CSV/text import corrupts & < > (entity-stripped to a space, not decoded) and ignores RFC-4180 quoting** (?)
  - _fix:_ In src/renderer/js/mailings-tools.js useExistingList(): (a) decode HTML entities instead of stripping them. Replace line 41's `.replace(/&[^;]+;/g, ' ')` by parsing the imported HTML's text content properly, e.g. set the html into a temp element and read textContent after converting block boundaries
- [ ] **Hover-previewing two Color/Theme gallery cells leaves --word-blue (whole-UI accent) stuck on the wrong color after mouseleave** (?)
  - _fix:_ In WC.Design.restore (src/renderer/js/design-tools.js:84), handle the captured-null case so the accent state is fully reverted instead of left stale. Replace `if (s.accents && WC.setThemeColors) WC.setThemeColors(s.accents);` with: `if (WC.setThemeColors) { if (s.accents) WC.setThemeColors(s.accents
- [ ] **Undo (Ctrl+Z) ignores direct-DOM editor operations and can revert an earlier execCommand edit instead** (?)
  - _fix:_ Introduce a real undo/redo history in WC.Editor instead of relying on the native execCommand stack. Concretely: (1) add `undoStack`/`redoStack` arrays plus `pushHistory()` that snapshots `this.node.innerHTML` together with the current `_caretCharOffset()`; (2) call `pushHistory()` at the start of ev
- [ ] **Saving a file opened from .txt/.md/.rtf throws "Unsupported save format: text" — user cannot save edits** (docx-io)
  - _file:_ `src/main/main.js:281,341,345`
  - _fix:_ In src/main/main.js saveToPath (line ~341), change the plain-text branch condition from `else if (ext === 'txt')` to `else if (ext === 'txt' || ext === 'text')` so the 'text' format label produced by openPath (main.js:281) is accepted and written as plain text. (Alternatively, normalize at the sourc
- [ ] **Headers, footers, and page-number fields are demoted to ordinary body text in saved .docx** (docx-io)
  - _file:_ `src/main/main.js:324-328 (header/footer:false + writeDocx); src/renderer/js/header-footer.js:13-20`
  - _fix:_ In editor.js getHTML(): detach .wc-header and .wc-footer from the body clone (remove them from the returned innerHTML) and expose their innerHTML separately, e.g. return { body, header, footer } or stash them on the save payload. In main.js writeDocx(): when header/footer HTML is present, set header
- [ ] **Comments are silently discarded when saving to .docx (data loss)** (docx-io)
  - _file:_ `src/main/main.js:316-332 (writeDocx); src/renderer/js/comments.js:16,45-46`
  - _fix:_ Before export, serialize comments out-of-band: collect every .wc-comment-anchor's data-comment/data-comment-id, build a word/comments.xml part and wrap the anchored runs with commentRangeStart/commentRangeEnd/commentReference. Since html-to-docx can't do this, either post-process the produced zip (J
- [ ] **Change Case on a multi-paragraph selection injects spurious empty paragraphs (document corruption)** (home)
  - _file:_ `src/renderer/js/commands.js:1039`
  - _fix:_ In changeCase() at src/renderer/js/commands.js:1030-1040, stop round-tripping multi-block text through execCommand('insertText'). Instead operate on the DOM directly: get the selection range, collect the text nodes that intersect the range (TreeWalker SHOW_TEXT + range.intersectsNode), and rewrite e
- [ ] **Inserting a cover page does not replace the existing one — covers stack up** (insert)
  - _file:_ `src/renderer/js/insert-features.js:33`
  - _fix:_ In Insert.insertCover (src/renderer/js/insert-features.js:33), before setting the caret and inserting, strip any existing cover page. Insert at the top of the function: const old = E().node.querySelector('.cover-page'); if (old) { const brk = old.nextElementSibling; old.remove(); if (brk && brk.clas
- [ ] **Typing over a selection with Track Changes on hard-deletes the original text (no <del>, revision history lost)** (review-comments)
  - _file:_ `src/renderer/js/review-tools.js:36`
  - _fix:_ In insertTracked() (review-tools.js:36-44), before deleting, handle a non-collapsed selection by recording it as a tracked deletion instead of destroying it. Replace `const range = sel.getRangeAt(0); range.deleteContents();` with logic like: get the range; if `!range.collapsed`, extract the selected
- [ ] **'Accept This Change' / 'Reject This Change' don't mark the document dirty — accepted change can be silently lost on close** (review-comments)
  - _file:_ `src/renderer/js/commands.js:872`
  - _fix:_ In src/renderer/js/commands.js, in the 'accept' and 'reject' flyout handlers (lines 872-873), make the "This Change" items mark the document modified the same way the other variants do. Simplest: replace the inline `{ const n = WC.Review.currentRevision(); if (n) { WC.Review.acceptNode(n); E().repag

## MEDIUM

- [ ] **Next/Previous change navigation doesn't advance — Next re-selects the first revision; Previous only scrolls to the last and never selects** (?)
  - _fix:_ In src/renderer/js/review-tools.js, add a tracked index and make navigation find the revision relative to the current selection. Add `revisionIdx: -1,` to the Review object (alongside commentIdx). Rewrite nextChange/prevChange to advance modularly like nextComment/prevComment, syncing the index to t
- [ ] **Oversized inline image (taller than the content area) is not paginated: useless spacers are added inside its paragraph and the image bleeds across the page seams** (?)
  - _fix:_ In _repaginate's straddle branch (editor.js around 406-431, src/renderer/js/editor.js), before the text-offset binary search detect an effectively unsplittable/oversized block: if straddle.offsetHeight > contentH AND a text split is impossible (e.g. straddle.textContent.trim()==='' or bottomAt(strad
- [ ] **Convert Text to Table nests an invalid &lt;table&gt; inside &lt;ul&gt;/&lt;ol&gt; when the selection is a list** (?)
  - _fix:_ In Insert.convertTextToTable (src/renderer/js/insert-features.js, ~line 62), insert the table relative to the outermost list container when the first block is a list item, instead of relative to the &lt;li&gt;. Minimal change: replace `blocks[0].parentNode.insertBefore(wrap.firstChild, blocks[0]);` 
- [ ] **Point/Small/Medium/Large/Segment erasers all delete the entire stroke (eraseMode is never read)** (?)
  - _fix:_ In draw-tools.js eraseAt(p), branch on this.eraseMode. For 'stroke' (and as the default), keep the current whole-stroke s.remove(). For 'point'/'segment', implement partial erasure: for each stroke within range, sample its path with getPointAtLength over [0,len]; classify each sample as kept or remo
- [ ] **Page Width zoom divides by hardcoded 816px, over-zooming Landscape / non-Letter page widths** (?)
  - _fix:_ Replace the hardcoded 816 with the live --page-w value in both spots, using the existing getComputedStyle pattern (editor.js:286-288). In commands.js:1300, change fitWidthZoom() to: function fitWidthZoom() { const a = document.getElementById('canvas'); const pw = parseFloat(getComputedStyle(document
- [ ] **Greeting Line / Address Block discard all dialog choices; merge output is hardcoded** (?)
  - _fix:_ In mailings-tools.js, persist the dialog selections as data-attributes and read them in composite(). (1) greetingLine() OK handler: change insertField to encode choices, e.g. insertField('__GreetingLine__', '«GreetingLine»') -> build a node carrying data-greet=greet.value, data-fmt=nameFmt.value, da
- [ ] **restyle() resolves citations by stale array index first, silently rebinding to the wrong source after a source is deleted** (?)
  - _fix:_ In references-tools.js restyle() (lines 157-160), make the stable author tag the primary key and demote the array index. Replace the index-first block with author-first resolution: `let s = this.sources.find((x) => x.author === c.dataset.src); if (!s) { const idx = parseInt(c.dataset.srcIdx, 10); if
- [ ] **IEEE/numbered bibliography is alphabetized and unnumbered, so in-text [n] markers don't match the reference list** (?)
  - _fix:_ In src/renderer/js/references-tools.js make the bibliography ordering and numbering style-aware. (1) Add a helper that returns the ordered source list: for IEEE return this.sources.slice() (keep array/appearance order, no alpha sort); for other styles return this.sources.slice().sort((a,b)=>(a.autho
- [ ] **Go To page jump uses pageH instead of pitch and omits the top-margin/padding offset, so it scrolls progressively too high** (?)
  - _fix:_ In commands.js goToDialog() (line 1117), replace the stride-based formula with one that mirrors the existing page-metrics helpers and accounts for the canvas top padding. Replace `const top = (p - 1) * E().pageH * E().zoom;` with something like: `const m = E().pageMetrics(); const canvas = document.
- [ ] **Change Case uses execCommand('insertText'), corrupting run formatting at boundaries and collapsing the selection** (?)
  - _fix:_ In src/renderer/js/commands.js, rewrite changeCase(mode) to transform case in place over the existing text nodes instead of delete+insertText. Walk the text nodes that intersect the current Range (the codebase already uses document.createTreeWalker(node, NodeFilter.SHOW_TEXT, ...) — see editor.js:35
- [ ] **Position presets (Top Center / Middle Center) and Align Middle place the object's edge at 50%, not its center** (?)
  - _fix:_ In src/renderer/js/layout-tools.js, add a translate compensation only on the axis/axes pinned at 50%, and append it to any existing rotate transform so rotate()/flip() are preserved. In position() (after line 99): compute tx = (l==='50%' || r==='50%') ? -50 : 0 and ty = (t==='50%' || b==='50%') ? -5
- [ ] **Update Table never rebuilds the Table of Figures — entries and page numbers stay stale** (?)
  - _fix:_ In references-tools.js, replace the ToF branch of updateAny() so it actually rebuilds the existing Table of Figures in place instead of only toasting. Add a helper that clears the existing .wc-tof's rows and re-collects captions, e.g. add to the Ref object: `rebuildTOF() { const tof = E().node.query
- [ ] **PDF export and Print capture app chrome (title bar, ribbon) and inter-page gap bands — no print stylesheet exists** (?)
  - _fix:_ Ship a print stylesheet and apply it during export. Add src/renderer/styles/print.css with an @media print block that hides chrome and gap bands and resets page layout, e.g.: @media print { #titlebar, #tabstrip, #ribbon, #ruler, #statusbar, #backstage, #modal-root { display: none !important; } #app,
- [ ] **Thesaurus "insert synonym" inserts into the middle of the word instead of replacing it when nothing is selected** (?)
  - _fix:_ In review-tools.js, fix the synonym insertion so it replaces the source word. Capture word boundaries when no selection exists and select the word before inserting. Concretely: in wordAtCaret() also store the source text node and start/end offsets (e.g. this._caretWord = {node, s, e}); in showThesau
- [ ] **Captions numbered by count, not document position — mid-document insertion yields out-of-order numbers** (?)
  - _fix:_ In references-tools.js add a renumberCaptions(label) method modeled on renumberNotes(): const caps = Array.from(E().node.querySelectorAll('.wc-caption[data-label="'+label+'"]')); caps.forEach((c,i) => { const b = c.querySelector('b'); if (b) b.textContent = label + ' ' + (i+1); }); Then in insertCap
- [ ] **applyInlineStyle nests empty spans + ZWSPs on repeated collapsed-caret color picks** (?)
  - _fix:_ In applyInlineStyle's collapsed branch (editor.js:110-115), before inserting a new span, check whether the caret already sits inside an editor-created empty pending span and reuse it. Add a helper: const host = range.startContainer.nodeType===3 ? range.startContainer.parentNode : range.startContaine
- [ ] **Positioned objects anchor to the whole document, not their own page** (?)
  - _fix:_ In layout-tools.js, make the absolute offsets relative to the object's own page rather than to #editor. Concrete minimal approach in position()/align()/wrapText(): before applying offsets, compute the object's page index from its offsetTop (pageIndex = Math.floor(o.offsetTop / E().pageMetrics().pitc
- [ ] **Editing during Preview Results is silently discarded when preview is toggled off (data loss)** (?)
  - _fix:_ In WC.Mail.previewResults (src/renderer/js/mailings-tools.js), prevent silent destruction of edits. Minimal, lowest-risk fix: make the document non-editable while preview is on so transient previewed text can't be edited/lost — in the on-branch set E().node.setAttribute('contenteditable','false') an
- [ ] **Choosing a Page Color erases an existing Watermark (background shorthand wipes background-image)** (?)
  - _fix:_ In src/renderer/js/commands.js, change applyColor's page branch to use the backgroundColor longhand instead of the background shorthand: at line 1014 replace `E().node.style.background = color;` with `E().node.style.backgroundColor = color;`, and at the no-color branch on line 1020 replace `E().node
- [ ] **Split Cell adds a whole column to every row instead of splitting just the selected cell** (?)
  - _fix:_ In src/renderer/js/table-tools.js splitCell (line 56), replace the plain-cell branch `else this.insertColumn('right', cell);` so it splits only the targeted cell while keeping the grid aligned. Minimal version: in the else branch, (1) widen the corresponding cell in every OTHER row by incrementing i
- [ ] **Inserting a cover page when a header exists pushes the header below the cover (into mid-document)** (?)
  - _fix:_ In Insert.insertCover (src/renderer/js/insert-features.js:33-37), stop anchoring at (E().node, 0). Instead place the caret before the first real BODY block, after any header. Minimal version: replace the range setup with logic that finds the first child that is NOT a .wc-header (and not a leading ma
- [ ] **Replace / Replace All does not repaginate — stale page count and orphaned gap-band spacers persist** (?)
  - _fix:_ In src/renderer/js/dialogs.js doReplace(), add E().repaginate() in both branches to match the codebase's dirty/repaginate/updateStatus pattern. All-branch (line 177): change `E().node.normalize(); E().dirty = true; E().updateStatus();` to `E().node.normalize(); E().dirty = true; E().repaginate(); E(
- [ ] **Lasso-selected ink cannot be deleted — Delete key is ignored after a lasso selection (dead-end selection)** (draw)
  - _file:_ `src/renderer/js/draw-tools.js:78`
  - _fix:_ In src/renderer/js/draw-tools.js, make lassoed strokes deletable. Minimal option: broaden the keydown guard at line 78 to also accept the lasso tool: change `this.tool === 'select'` to `(this.tool === 'select' || this.tool === 'lasso')`. Cleaner option (matches Word, which drops into a selection sta
- [ ] **Insert/Delete Column corrupts the grid when the table contains merged (colspan) cells** (insert)
  - _file:_ `src/renderer/js/table-tools.js:11`
  - _fix:_ In src/renderer/js/table-tools.js, make column operations logical-column-aware instead of using raw DOM indices. (1) Add a helper that computes the logical (grid) column index of a cell by summing the colspans of its preceding siblings in its row, e.g. logicalIndex(cell){let i=0;let n=cell.previousE
- [ ] **Adding a bookmark with an existing name creates a duplicate element with the same id instead of moving it** (insert)
  - _file:_ `src/renderer/js/insert-features.js:296`
  - _fix:_ In Insert.bookmarkDialog's Add onClick (src/renderer/js/insert-features.js:296), before creating the new span, dedupe by name: const existing = E().node.querySelector('[data-bookmark="' + (window.CSS && CSS.escape ? CSS.escape(n) : n) + '"]'); if (existing) existing.replaceWith(...existing.childNode
- [ ] **Rotating an object discards its flip; repeated flips accumulate instead of toggling** (layout)
  - _file:_ `src/renderer/js/layout-tools.js:92`
  - _fix:_ Track flip state separately from rotation in dataset and always rebuild the full transform from both. In src/renderer/js/layout-tools.js, add a helper and rewrite rotate/flip: applyTransform(o){ const r=parseInt(o.dataset.rot||'0',10); const sx=o.dataset.flipH==='1'?-1:1; const sy=o.dataset.flipV===
- [ ] **Match Fields mapping is never applied to Address Block / Greeting Line / merge fields (Match Fields is a no-op)** (mailings)
  - _file:_ `src/renderer/js/mailings-tools.js:108`
  - _fix:_ In src/renderer/js/mailings-tools.js, route recipient lookups through the Match Fields map instead of hardcoded keys. Add a resolver, e.g. mapped(rec, std) { const STD2CANON = {Title:'Title','First Name':'FirstName','Last Name':'LastName',Company:'CompanyName','Address 1':'Address1',City:'City',Stat
- [ ] **Bibliography heading is wrongly picked up as a document heading and added to the Table of Contents** (references)
  - _file:_ `src/renderer/js/references-tools.js:16`
  - _fix:_ In src/renderer/js/references-tools.js, exclude bibliography headings from the TOC collector. Change line 16 to also filter out headings inside .wc-bibliography: headings() { return Array.from(E().node.querySelectorAll('h1, h2, h3')).filter((h) => !h.closest('.wc-toc') && !h.closest('.wc-bibliograph
- [ ] **Pasting with Track Changes on inserts untracked content** (review-comments)
  - _file:_ `src/renderer/js/review-tools.js:34`
  - _fix:_ In src/renderer/js/review-tools.js onBeforeInput, replace the no-op insertFromPaste branch (line 34) with logic that intercepts the paste and inserts it as a tracked insertion. Concretely: e.preventDefault(); read text from e.dataTransfer (when available) or the clipboard event, then wrap it in <ins
- [ ] **Ribbon 'Delete' / 'Delete All Comments' leave stale orphan cards in the open Comments pane** (review-comments)
  - _file:_ `src/renderer/js/review-tools.js:82`
  - _fix:_ In src/renderer/js/review-tools.js, add a pane refresh after the DOM mutation in both methods. deleteComment() (line 82): after the toast call WC.Comments && WC.Comments.rebuild(). deleteAllComments() (line 83): after the toast call WC.Comments && WC.Comments.rebuild(). E.g. deleteComment() { const 

## LOW

- [ ] **Inserting Table of Figures or Bibliography twice stacks a duplicate (no replace-in-place, unlike Index/ToA)** (?)
  - _fix:_ In src/renderer/js/references-tools.js, mirror the sibling pattern. In insertTableOfFigures, before building wrap add: const existing = E().node.querySelector('.wc-tof'); if (existing) existing.remove(); (placed right after the label default, before constructing caps/wrap). In insertBibliography, be
- [ ] **Block formatting leaks onto manual page-break div and persists to saved file** (?)
  - _fix:_ In editor.js selectedBlocks() (src/renderer/js/editor.js:234-251), exclude layout artifacts from the returned blocks. Add a guard mirroring the isContent check: define isArtifact = (e) => e.classList && (e.classList.contains('manual-break') || e.classList.contains('wc-gap-band') || e.classList.conta
- [ ] **Ink overlay height is sized once and never resyncs to the document — ink cannot be placed on regions the document grows into while Drawing is active** (draw)
  - _file:_ `src/renderer/js/draw-tools.js:43`
  - _fix:_ In draw-tools.js, expose the resync and call it from the layout paths. Add a guarded helper, e.g. resync() { if (this.layer) this.size(); }, then invoke WC.Draw && WC.Draw.resync() at the tail of editor.js _repaginate() (after page layout settles, both the print-view return points and the continuous
