# Word Clone — Feature Coverage & Known Limitations

_Auto-generated from deep research (`docs/research/raw-research.json`). This catalogs which Microsoft Word features this clone implements, partially implements, or deliberately does not implement, and why._

> The user asked me to build a faithful MS Word clone and to **document the things that are not realistic to fully replicate** rather than stopping. This is that document.

## Legend

- ✅ **Feasible / implemented** — works in this clone (possibly simplified).
- 🟡 **Partial** — a usable approximation; full Word behavior not replicated.
- ❌ **Infeasible in this build** — would require a full Office-grade engine, a server/cloud backend, a proprietary runtime, or months of work.

> **Implementation reality vs. research notes.** The status icons below come from the feasibility research. The *Notes* column describes the approach the research **recommended** — which sometimes differs from what this build actually shipped. The biggest difference: the document core is a **ProseMirror model forked from SuperDoc** (`src/renderer/core/superdoc-fork/`), and `.docx` import/export both go through that fork's **`super-converter`** — a structural OOXML↔model round-trip (the legacy `contenteditable`/`execCommand` editor and the `mammoth`/`html-to-docx` pipeline were retired in slice 11). Items marked ✅ are implemented and working in the app; 🟡/❌ items are present in the UI but stubbed or approximated.

## Feature areas (from architecture feasibility research)

### Text & paragraph formatting

| Feature | Status | Notes |
|---|---|---|
| Inline character formatting (bold, italic, underline, strikethrough, sub/superscript, color, highlight, font family, font size) | ✅ | Use a wrapped command layer (own selection->Range manipulation, not the deprecated document.execCommand, though execCommand works for an MVP). Represent formatting as <span> with inline styles or class-based marks. Map to w:b, w:i, w:u, w:color, w:highlight, w:sz, w:rFonts on export via the 'docx' npm library. |
| Paragraph alignment, indentation, line spacing, space before/after | ✅ | Apply CSS to <p>/<div> blocks; serialize to ParagraphProperties. Watch unit conversion: OOXML uses twips (1/1440 inch) and EMUs; build a units helper. |
| Tabs and custom tab stops (leaders, decimal tabs) | 🟡 | For basic left tab stops, insert tab characters rendered with tab-size or padded spans. Decimal/leader tabs require a custom measurement pass (canvas text metrics) to position content; doable but laborious. Store tab definitions in model and approximate visually; round-trip the w:tabs definitions faithfully even if rendering is approximate. |
| Text effects, WordArt, shadows/glow/reflection on text | 🟡 | Implement visually with CSS for the editor. For round-trip, either drop to plain styled text on export or generate minimal DrawingML. Treat full WordArt fidelity as out of scope. |
| Character spacing / kerning / ligatures / OpenType features | 🟡 | Expose letter-spacing and font-feature-settings; map to w:spacing(letterSpacing)/w:kern. Exact metric parity with Word's renderer is not achievable. |

### Styles & themes

| Feature | Status | Notes |
|---|---|---|
| Paragraph & character styles (named styles, Normal/Heading 1-9, style inheritance) | ✅ | Maintain a style registry; render via a scoped stylesheet with class names; on export emit styles.xml entries and apply pStyle/rStyle references. Implement basedOn inheritance by CSS cascade or by resolving the chain in the model. |
| Linked styles, table styles, list styles | 🟡 | Implement paragraph/character/linked first. Table styles: store the styleId and render banding via CSS nth-child; full conditional formatting (tblStylePr per region) is partial. Round-trip the styleId even when rendering is simplified. |
| Themes (theme colors, theme fonts, color schemes) | 🟡 | Implement theme color/font tokens as CSS variables; a theme switch re-binds variables. Export theme1.xml with the color scheme and font scheme. Effect themes (subtle/moderate/intense shape effects) are out of scope. |
| Style sets, Style Inspector, Reveal Formatting | 🟡 | Reveal Formatting: read computed styles + model props at selection. Style sets: ship a few predefined style tables and swap. Cheap to do partially. |

### Pagination & page layout

| Feature | Status | Notes |
|---|---|---|
| Page size, margins, orientation (model + export) | ✅ | Store section properties; render a page-width container with CSS @page-like padding for the active section; export sectPr accurately. |
| True WYSIWYG pagination (line-accurate page breaks, page count, page-fill flow across pages) | ❌ | For an MVP, render as a single continuous 'web layout' page (Word has this mode too). Optionally overlay decorative page-break markers. Do NOT promise Word-identical page geometry. |
| Manual page breaks and section breaks | ✅ | Insert a break element; render as a horizontal divider/new-page marker; export as page break run or new sectPr. Continuous/odd/even/next-page section types stored in model. |
| Headers & footers (per-section, first-page-different, odd/even) | 🟡 | Provide editable header/footer zones bound to the section; round-trip the three header/footer types. Page-number fields in headers compute only at print/PDF time (see printing). Accept that on-screen they appear once, not per page. |
| Columns (newspaper-style multi-column) | 🟡 | Use CSS multicol for rendering and round-trip w:cols. Warn about editing quirks; column breaks stored in model and approximated. |
| Page background, watermark, page borders | 🟡 | CSS background + absolutely-positioned watermark overlay; border on page container. Export to background/pgBorders; watermark as header VML/DrawingML is the messy part - implement as best-effort. |
| Line numbers, vertical alignment of page content, gutter/mirror margins | 🟡 | Round-trip the properties; render line numbers per-paragraph as an approximation; skip true per-page vertical alignment. |

### Tables

| Feature | Status | Notes |
|---|---|---|
| Basic tables (insert, rows/cols, cell text, borders, shading, merge/split cells) | ✅ | Use native HTML tables; build toolbar for insert/delete row-col, merge (rowspan/colspan), borders, shading. Map to w:tbl/w:tr/w:tc, w:tcBorders, w:shd, w:gridSpan/w:vMerge on export. |
| Cell sizing, autofit, table width modes, alignment | 🟡 | Support fixed and percent widths (tblW, tcW); use table-layout:fixed for predictability; round-trip the grid (w:tblGrid). Exact autofit parity not guaranteed. |
| Nested tables, header rows repeating across pages, cell margins, text direction in cells | 🟡 | Support nesting and cell margins directly; round-trip tblHeader; writing-mode for vertical text. No per-page header repetition rendering. |
| Formulas in table cells, sort, convert text<->table | 🟡 | Implement a small formula evaluator for SUM/AVERAGE/COUNT over cell ranges; text<->table via delimiter parsing; sort by column. Round-trip formulas as fields. |

### Images, shapes, SmartArt, charts, icons, 3D models

| Feature | Status | Notes |
|---|---|---|
| Inline raster images (insert, resize, basic crop) | ✅ | Insert <img>, resize via handles, store bytes in the package media folder, emit the drawing XML + relationship. Crop via CSS clip on screen and srcRect on export. |
| Image wrapping (square/tight/through/behind/in front), text-wrap and absolute positioning | 🟡 | Support inline + float left/right (square wrap) well; round-trip anchor/wrap XML. Tight/through and free positioning: approximate with float or absolute overlay; full fidelity out of scope. |
| Shapes / text boxes (autoshapes, lines, connectors) | 🟡 | Render basic rectangles/ellipses/lines/text boxes as SVG overlays; map common presets (rect, ellipse, line) to a:prstGeom. Treat the long tail of shapes and connectors as out of scope. |
| Charts | 🟡 | Render via Chart.js/ECharts from a data table; export common types (bar/line/pie) to the chart part with an embedded data cache + fallback image. Less-common chart types out of scope. |
| SmartArt | ❌ | Best you can offer: import SmartArt as a flattened static image/grouped shapes (read-only), and let users insert plain grouped shapes instead. No authoring of true SmartArt. |
| Icons (stock icon library) | ✅ | Ship an SVG icon picker; insert as image (rasterize or embed SVG-as-image). Round-trips as a normal picture/SVG blip. |
| 3D models (.glb/.fbx animated models) | ❌ | At most, render an imported 3D model preview with three.js as read-only and substitute a static thumbnail on export. Not a real implementation. |

### Lists

| Feature | Status | Notes |
|---|---|---|
| Bulleted and numbered lists, indentation/demote/promote, restart/continue numbering | ✅ | Render ul/ol or use the numbering model with CSS counters for fidelity; Tab/Shift-Tab to change level; map to numId/ilvl and numbering.xml on export. Restart/continue via separate num definitions. |
| Multilevel lists, custom number formats (1.1.1, legal, mixed bullet/number), list styles linked to headings | 🟡 | Model abstractNum levels with lvlText/numFmt; render via CSS counters with counter() concatenation. Cover decimal/roman/letter/bullet and dotted patterns; exotic formats partial. Round-trip numbering.xml. |
| Picture bullets, list number alignment/spacing | 🟡 | list-style-image or pseudo-element marker; round-trip lvlPicBulletId. Spacing approximated. |

### Find & Replace (incl. wildcards)

| Feature | Status | Notes |
|---|---|---|
| Plain find & replace, case-sensitive, whole word, highlight all matches | ✅ | Flatten model to text with offset map back to DOM ranges; search; render highlights via Highlight API; replace by splicing the model and re-rendering affected runs. |
| Wildcard / regex find & replace | ✅ | Build a Word-wildcard->RegExp translator; apply over the text model; support group back-references in replacement. Straightforward. |
| Find by formatting / style / special characters (paragraph marks, page breaks), Go To | 🟡 | Extend search predicates to match run/paragraph properties and special-node types; Go To paragraph/bookmark works, Go To page only approximate. |

### Spelling & grammar (editor)

| Feature | Status | Notes |
|---|---|---|
| Spell check with squiggles and suggestions | ✅ | Enable native spellcheck for an instant MVP; for custom dictionaries/suggestions UI use nspell/hunspell-wasm over tokenized text, render squiggles via Highlight API, offer right-click suggestions. |
| Grammar checking / style critique (Editor pane) | 🟡 | Optionally call a bundled/remote LanguageTool instance for grammar/style suggestions. Honest limitation: quality differs from Word. |
| Multi-language detection, readability stats, thesaurus | 🟡 | Compute readability/word stats directly; ship WordNet for thesaurus; language detection via a small JS lib. All approximate but feasible at small scope. |

### Track Changes, Comments & Compare

| Feature | Status | Notes |
|---|---|---|
| Comments (add, reply, resolve, anchored to range) | ✅ | Store comment anchors as marker nodes around a range; render margin bubbles; threads/replies in model; round-trip comments.xml (+ commentsExtended for replies/resolve). |
| Track changes (record insertions/deletions/format changes with author/time, accept/reject) | 🟡 | Intercept all edits through a command layer (not raw contenteditable input) so every change is a tracked operation; render ins underlined/del struck; accept/reject mutates the model. Cover text + formatting changes well; structural change tracking (moved content, table edits) is partial. |
| Compare / combine documents (diff two docx) | 🟡 | Parse both docx to a normalized model, run a sequence/tree diff (e.g. Myers on flattened runs), render as tracked changes. Good for prose, weaker on tables/structure. |

### References (TOC, footnotes, citations, bibliography, captions, index)

| Feature | Status | Notes |
|---|---|---|
| Footnotes & endnotes | 🟡 | Store notes; render references as superscript links to a notes section at document end (or a hover panel); round-trip footnotes/endnotes XML. True page-bottom placement only at PDF/print stage if at all. |
| Table of contents (TOC) | 🟡 | Build TOC from heading nodes with clickable anchors; export as a TOC field with cached entries; page numbers only meaningful in the PDF/print pass, otherwise omit or show '#'. |
| Captions, cross-references, table of figures | 🟡 | Insert caption paragraphs with SEQ counters; cross-refs via bookmarks and REF fields; recompute numbers on edit. Page-number cross-refs limited by pagination. |
| Citations & bibliography (source manager, styles APA/MLA/Chicago) | ✅ | Use citeproc-js + CSL styles for formatting citations and bibliography from a sources store; insert as fields; export bibliography as a paragraph block. Round-trip Word's bibliography part is partial but citations themselves work well. |
| Index (mark entries, generate index) | 🟡 | Mark index entries (XE fields), generate sorted index block. Page numbers limited; otherwise full feature works. |

### Mail merge

| Feature | Status | Notes |
|---|---|---|
| Mail merge (data source -> merge fields -> generated documents, letters/labels/envelopes) | ✅ | Parse data source (CSV via papaparse, XLSX via SheetJS); insert MERGEFIELD placeholders; on merge, clone the template model per record and substitute; export each as docx/PDF or a combined file. Rules (IF/NEXT fields) and label grids are extra but feasible. Envelopes/labels need page templates. |

### Equations

| Feature | Status | Notes |
|---|---|---|
| Equation editor (insert/edit math, professional rendering) | 🟡 | Author via a MathLive/MathQuill editor producing MathML/LaTeX; render with MathJax; convert MathML<->OMML (existing XSLT) for round-trip. Common math covered; exotic constructs partial. |

### Macros / VBA

| Feature | Status | Notes |
|---|---|---|
| VBA macros (record, run, VBA project storage) | ❌ | Not realistic. The only honest alternative is a JavaScript-based scripting/macro API exposing a small subset of the document model (insert text, format selection) - a different, much smaller feature, NOT VBA compatibility. Existing VBA in opened files would be preserved as an opaque part if possible but not executed. |

### Add-ins

| Feature | Status | Notes |
|---|---|---|
| Office Add-ins (Office.js task panes / content add-ins / store) | ❌ | Out of scope. A homegrown plugin system (your own JS extension API + sandboxed iframe panels) is feasible as a SEPARATE concept, but it would not run actual Microsoft Office add-ins. |

### Real-time co-authoring / cloud

| Feature | Status | Notes |
|---|---|---|
| Real-time multi-user co-authoring (live cursors, conflict-free merge) | 🟡 | Use Yjs (Y.XmlFragment) bound to the editor with y-websocket and an awareness channel for cursors. Realistic only as a focused effort; full Word/OneDrive cloud parity (versioning, permissions) is out of scope for one session. |
| Cloud storage / autosave / version history integration | 🟡 | Integrate a storage backend (local + one cloud provider) with periodic autosave and a simple version log. Keep expectations modest. |

### File formats (.docx/.doc/.rtf/.odt/.pdf)

| Feature | Status | Notes |
|---|---|---|
| .docx read | 🟡 | Use docx-preview/custom unzip+XML parse for import into the model; cover the common 80%; preserve unknown parts to re-emit on save (round-trip preservation) where possible. |
| .docx write | 🟡 | Serialize model -> OOXML via the 'docx' lib (or hand-built XML + jszip). True round-trip fidelity (open Word file, edit, save, byte/semantic-stable) is the hardest correctness goal - aim for semantic preservation, not identity. |
| .doc (legacy binary Word 97-2003) | ❌ | At most extract text on import via a library; do not support saving .doc. Direct users to docx. |
| .rtf | 🟡 | Implement an RTF reader/writer for common constructs (runs, paragraphs, tables, images). Treat exotic control words as out of scope. |
| .odt | 🟡 | Parse/emit ODF XML for the common subset, reusing the same internal model. Lower priority than docx. |
| .pdf export | 🟡 | Use Electron printToPDF with a print stylesheet (@page, running headers/footers via CSS, page counters). This is also where header/footer/TOC-page-number features become real (Chromium-paginated, not Word-identical). PDF import/editing is out of scope. |

### Printing

| Feature | Status | Notes |
|---|---|---|
| Print to physical printer with options (range, copies, scaling, duplex) | 🟡 | Use webContents.print with a dedicated print CSS; expose range/copies/scale; rely on the OS dialog for driver options. Print preview = the PDF render. Pagination fidelity caveat applies. |

### Accessibility

| Feature | Status | Notes |
|---|---|---|
| Authoring-side: alt text, heading structure, accessibility checker | ✅ | Alt-text field on media; an accessibility-checker that lints the model against WCAG-like rules; export alt text into OOXML drawing properties. |
| App-side accessibility (screen reader support for the editor UI/content) | 🟡 | Add ARIA roles/labels to chrome and content regions, keyboard navigation, focus management. Achieve basic usability; full parity with Word's MSAA/UIA accessibility is out of scope. |

### Dictation / Read Aloud

| Feature | Status | Notes |
|---|---|---|
| Read Aloud (text-to-speech with highlighting) | ✅ | Walk the text model, feed SpeechSynthesisUtterance, use onboundary events to highlight the current word via the Highlight API. Quick win. |
| Dictation (speech-to-text into the document) | 🟡 | Use Web Speech Recognition or integrate a cloud STT (e.g. via an API); insert transcribed text at the caret. Treat punctuation/voice-command parity with Word's dictation as partial. |

### Protection & encryption

| Feature | Status | Notes |
|---|---|---|
| Document encryption (password to open) compatible with Word | 🟡 | For decryption use an existing MS-OFFCRYPTO JS implementation if available; for your own at-rest protection, encrypt the package with WebCrypto (not Word-openable). Word-compatible write-encryption is effectively out of scope for one session. |
| Restrict editing / formatting restrictions / mark as final / read-only | 🟡 | Implement editing restrictions in the editor (toggle editability, permitted regions), round-trip w:documentProtection. Honest note: it's advisory, not cryptographic. |
| Digital signatures, IRM/sensitivity labels | ❌ | Out of scope. Possibly preserve existing signature parts opaquely, but neither create nor validate them. |

## Ribbon controls present in the UI but not fully functional

Every ribbon tab, group, and control from Microsoft Word is rendered in this clone for UI fidelity. The controls below are present and clickable but are **stubbed or approximated** (clicking shows an explanatory message). This is intentional: the UI is complete; the deep engine behind these specific controls is out of scope for a one-session build.

### ❌ Not implemented (placeholder UI only)

- Home ▸ Voice ▸ Dictate
- Home ▸ Sensitivity ▸ Sensitivity
- Home ▸ Editor ▸ Editor
- Home ▸ Add-ins ▸ Add-ins
- Home ▸ Reuse Files ▸ Reuse Files
- Insert ▸ Illustrations ▸ 3D Models
- Insert ▸ Illustrations ▸ Screenshot
- Insert ▸ Add-ins ▸ Get Add-ins
- Insert ▸ Add-ins ▸ My Add-ins
- Insert ▸ Text ▸ Signature Line
- Insert ▸ Text ▸ Object
- Draw ▸ Convert ▸ Ink to Shape
- Draw ▸ Convert ▸ Ink to Math
- Draw ▸ Replay ▸ Ink Replay
- References ▸ Research ▸ Search
- References ▸ Research ▸ Researcher
- Review ▸ Compare ▸ Compare
- Review ▸ Protect ▸ Block Authors
- Review ▸ Ink ▸ Hide Ink
- View ▸ Macros ▸ Macros
- View ▸ SharePoint ▸ Properties
- Help ▸ Help ▸ Contact Support

### 🟡 Partial / approximated

- Home ▸ Clipboard ▸ Paste
- Home ▸ Clipboard ▸ Format Painter
- Home ▸ Clipboard ▸ Clipboard
- Home ▸ Font ▸ Font
- Home ▸ Font ▸ Underline
- Home ▸ Font ▸ Text Effects and Typography
- Home ▸ Font ▸ Font
- Home ▸ Paragraph ▸ Bullets
- Home ▸ Paragraph ▸ Numbering
- Home ▸ Paragraph ▸ Multilevel List
- Home ▸ Paragraph ▸ Sort
- Home ▸ Paragraph ▸ Show/Hide ¶
- Home ▸ Paragraph ▸ Justify
- Home ▸ Paragraph ▸ Line and Paragraph Spacing
- Home ▸ Paragraph ▸ Borders
- Home ▸ Paragraph ▸ Paragraph
- Home ▸ Styles ▸ Styles Gallery
- Home ▸ Styles ▸ Styles
- Home ▸ Editing ▸ Select
- Insert ▸ Pages ▸ Cover Page
- Insert ▸ Pages ▸ Blank Page
- Insert ▸ Pages ▸ Page Break
- Insert ▸ Tables ▸ Table
- Insert ▸ Illustrations ▸ Pictures
- Insert ▸ Illustrations ▸ Shapes
- Insert ▸ Illustrations ▸ Icons
- Insert ▸ Illustrations ▸ SmartArt
- Insert ▸ Illustrations ▸ Chart
- Insert ▸ Media ▸ Online Video
- Insert ▸ Links ▸ Bookmark
- Insert ▸ Links ▸ Cross-reference
- Insert ▸ Comments ▸ Comment
- Insert ▸ Header & Footer ▸ Header
- Insert ▸ Header & Footer ▸ Footer
- Insert ▸ Header & Footer ▸ Page Number
- Insert ▸ Text ▸ Text Box
- Insert ▸ Text ▸ Quick Parts
- Insert ▸ Text ▸ WordArt
- Insert ▸ Text ▸ Drop Cap
- Insert ▸ Symbols ▸ Equation
- Draw ▸ Tools ▸ Select Objects
- Draw ▸ Tools ▸ Lasso Select
- Draw ▸ Tools ▸ Eraser
- Draw ▸ Pens ▸ Pens Gallery
- Draw ▸ Pens ▸ Add Pen
- Draw ▸ Pens ▸ Draw with Trackpad
- Draw ▸ Pens ▸ Drawing
- Draw ▸ Insert ▸ Drawing Canvas
- Design ▸ Document Formatting ▸ Themes
- Design ▸ Document Formatting ▸ Style Set
- Design ▸ Document Formatting ▸ Effects
- Design ▸ Page Background ▸ Watermark
- Design ▸ Page Background ▸ Page Borders
- Layout ▸ Page Setup ▸ Breaks
- Layout ▸ Page Setup ▸ Line Numbers
- Layout ▸ Page Setup ▸ Hyphenation
- Layout ▸ Arrange ▸ Position
- Layout ▸ Arrange ▸ Wrap Text
- Layout ▸ Arrange ▸ Bring Forward
- Layout ▸ Arrange ▸ Send Backward
- Layout ▸ Arrange ▸ Selection Pane
- Layout ▸ Arrange ▸ Align
- Layout ▸ Arrange ▸ Group
- Layout ▸ Arrange ▸ Rotate
- References ▸ Table of Contents ▸ Table of Contents
- References ▸ Table of Contents ▸ Add Text
- References ▸ Table of Contents ▸ Update Table
- References ▸ Footnotes ▸ Insert Footnote
- References ▸ Footnotes ▸ Insert Endnote
- References ▸ Footnotes ▸ Next Footnote
- References ▸ Footnotes ▸ Show Notes
- References ▸ Citations & Bibliography ▸ Insert Citation
- References ▸ Citations & Bibliography ▸ Manage Sources
- References ▸ Citations & Bibliography ▸ Style
- References ▸ Citations & Bibliography ▸ Bibliography
- References ▸ Captions ▸ Insert Caption
- References ▸ Captions ▸ Insert Table of Figures
- References ▸ Captions ▸ Update Table
- References ▸ Captions ▸ Cross-reference
- References ▸ Index ▸ Mark Entry
- References ▸ Index ▸ Insert Index
- References ▸ Index ▸ Update Index
- References ▸ Table of Authorities ▸ Mark Citation
- References ▸ Table of Authorities ▸ Insert Table of Authorities
- References ▸ Table of Authorities ▸ Update Table
- Mailings ▸ Create ▸ Envelopes
- Mailings ▸ Create ▸ Labels
- Mailings ▸ Start Mail Merge ▸ Start Mail Merge
- Mailings ▸ Start Mail Merge ▸ Select Recipients
- Mailings ▸ Start Mail Merge ▸ Edit Recipient List
- Mailings ▸ Write & Insert Fields ▸ Highlight Merge Fields
- Mailings ▸ Write & Insert Fields ▸ Address Block
- Mailings ▸ Write & Insert Fields ▸ Greeting Line
- Mailings ▸ Write & Insert Fields ▸ Insert Merge Field
- Mailings ▸ Write & Insert Fields ▸ Rules
- Mailings ▸ Write & Insert Fields ▸ Match Fields
- Mailings ▸ Write & Insert Fields ▸ Update Labels
- Mailings ▸ Preview Results ▸ Preview Results
- Mailings ▸ Preview Results ▸ First Record
- Mailings ▸ Preview Results ▸ Previous Record
- Mailings ▸ Preview Results ▸ Go to Record
- Mailings ▸ Preview Results ▸ Next Record
- Mailings ▸ Preview Results ▸ Last Record
- Mailings ▸ Preview Results ▸ Find Recipient
- Mailings ▸ Preview Results ▸ Check for Errors
- Mailings ▸ Finish ▸ Finish & Merge
- Review ▸ Proofing ▸ Editor
- Review ▸ Proofing ▸ Spelling and Grammar
- Review ▸ Proofing ▸ Thesaurus
- Review ▸ Speech ▸ Read Aloud
- Review ▸ Accessibility ▸ Check Accessibility
- Review ▸ Language ▸ Translate
- Review ▸ Language ▸ Language
- Review ▸ Markup ▸ Display for Review
- Review ▸ Markup ▸ Filter All Markup
- Review ▸ Markup ▸ Show Markup
- Review ▸ Markup ▸ Reviewing Pane
- Review ▸ Markup ▸ Track Changes Options
- Review ▸ Tracking ▸ Track Changes
- Review ▸ Tracking ▸ Accept
- Review ▸ Tracking ▸ Reject
- Review ▸ Tracking ▸ Previous
- Review ▸ Tracking ▸ Next
- Review ▸ Protect ▸ Restrict Editing
- View ▸ Views ▸ Read Mode
- View ▸ Views ▸ Print Layout
- View ▸ Views ▸ Web Layout
- View ▸ Views ▸ Outline
- View ▸ Immersive ▸ Focus
- View ▸ Immersive ▸ Immersive Reader
- View ▸ Page Movement ▸ Vertical
- View ▸ Page Movement ▸ Side to Side
- View ▸ Zoom ▸ One Page
- View ▸ Zoom ▸ Multiple Pages
- View ▸ Zoom ▸ Page Width
- View ▸ Window ▸ New Window
- View ▸ Window ▸ Arrange All
- View ▸ Window ▸ Split
- View ▸ Window ▸ View Side by Side
- View ▸ Window ▸ Synchronous Scrolling
- View ▸ Window ▸ Reset Window Position
- View ▸ Window ▸ Switch Windows
- Help ▸ Help ▸ Help
- Help ▸ Help ▸ Feedback
- Help ▸ Help ▸ Show Training
- Help ▸ Help ▸ What's New

