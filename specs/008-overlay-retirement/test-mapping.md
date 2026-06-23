# 008 — Deleted overlay-only test:pm tests → paged coverage

Feature 008 retired the overlay rendering engine. The **59** test:pm tests that asserted OVERLAY-ONLY
rendering constructs (which no longer exist) were DELETED from scripts/test-suite-pm.js (user decision,
HARD-STOP review). Their paged-rendering coverage lives in the dedicated paged probes below — nothing was
silently dropped. The 10 PAGED_KNOWN_GAP (real paged functional gaps) STAY in the suite; the [0a] paged-aware
port stays. The suite is now PAGED-ONLY at 416 tests.

| Zone | n | Paged coverage |
|------|---|----------------|
| `[1]` | 1 | report:glyphgeom (strike-on-superscript render — mark application is mode-agnostic) |
| `[2]` | 7 | test:roundtrip + the passing structural asserts (overlay-rendered list-marker / shading DOM) |
| `[3]` | 1 | report:glyphgeom (style-color decoration render — mark application is mode-agnostic) |
| `[4a]` | 22 | probe:coords + probe:statusbar + report:glyphgeom (the overlay Pagination engine PM.__pagination → the PE is the sole paginator) |
| `[4b]` | 3 | probe:imageresize (overlay image-resize handles + #pm-editor <img> render) |
| `[4c]` | 1 | probe:imageresize + test:roundtrip (overlay image float/wrap render) |
| `[4d]` | 1 | test:roundtrip (only the column-resize handle was overlay-DOM; the other [4d] ribbon-table ops are PAGED_KNOWN_GAP) |
| `[6b]` | 8 | test:roundtrip (table export) + the PE .superdoc-page paint (overlay-rendered table DOM) |
| `[9]` | 6 | probe:notes (the #pm-notes-area overlay, retired in 008 — the PE paints footnotes) + test:roundtrip (the TOC node) |
| `[fix]` | 3 | probe:pointer (overlay caret-hit / .ProseMirror-selectednode DOM) |
| `[home]` | 5 | test:roundtrip + the PE .superdoc-page paint (overlay-rendered paragraph-border / text-effect / hr DOM) |
| `[insert]` | 1 | probe:imageresize (Picture natural-size render) |

**Total deleted: 59.** Full list (grouped by zone):

### `[1]` (1) — report:glyphgeom (strike-on-superscript render — mark application is mode-agnostic)
- [1] strike on superscript: line-through tracks the raised span (Word parity)

### `[2]` (7) — test:roundtrip + the passing structural asserts (overlay-rendered list-marker / shading DOM)
- [2] shading palette pick lands as paragraphProperties.shading + paints
- [2] borders face applies Word-default bottom border
- [2] numbering renders "1." / "2." markers across two paragraphs
- [2] multilevel Decimal: nested item shows 1.1.
- [2] multilevel Outline: 1) then nested a)
- [2] list marker separator has real width (fork CSS in the build)
- [2] nested list indents: margin-left grows with level

### `[3]` (1) — report:glyphgeom (style-color decoration render — mark application is mode-agnostic)
- [3] Heading1 text renders the style color via decorations

### `[4a]` (22) — probe:coords + probe:statusbar + report:glyphgeom (the overlay Pagination engine PM.__pagination → the PE is the sole paginator)
- [4a] pagination exposes page geometry from the document model
- [4a] editor line-height calibrated to Word (Aptos-12 -> 1.225)
- [4a] no phantom browser-default paragraph top-margin leaks
- [4a] short doc = single page, no page seams
- [4a] overflowing content paginates into multiple pages with rendered seams
- [4a] counts().pages + status bar reflect the live page count
- [4a] page margins are realized (top-margin + tail spacers present)
- [4a] each seam positions the next page content at the page content-top
- [4a] continuous (Web) view renders no page seams
- [4a] manual page break forces the following content onto a new page
- [4a] mid-paragraph break splits the paragraph (after-text on the next page)
- [4a] trailing manual page break adds a blank page
- [4a] blank page (two breaks) adds a blank sheet (two seams)
- [4a] manual page break is a BLOCK-boundary seam (no block-in-inline; page-2 click maps right)
- [4a] blank page uses BLOCK-boundary seams (no block-in-inline spacer)
- [4a] section break (w:sectPr) forces the next content onto a new page
- [4a] section break governed by the NEXT section: continuous-typed ender still page-breaks
- [4a] a CONTINUOUS middle section stays on the page (next-section governs)
- [4a] section break before a TABLE pushes the table to a new page
- [4a] a paragraph taller than a page splits at the line (mid-paragraph seam)
- [4a] status bar reports the caret page across a blank-page (two seams)
- [4a] a straddling table is moved wholesale, never line-split mid-cell

### `[4b]` (3) — probe:imageresize (overlay image-resize handles + #pm-editor <img> render)
- [4b] the resize handles align with the image box (overlay is correctly anchored)
- [4b] a stretched (aspect-divergent) image renders + exports its explicit height
- [4b] Picture Format Grayscale: setImageGrayscale → grayscale attr + CSS filter + <a:grayscl> in a:blip; OFF clears (Word COM ColorType=2)

### `[4c]` (1) — probe:imageresize + test:roundtrip (overlay image float/wrap render)
- [4c] setImageWrap("square") floats the image (wrap=Square + anchor + float render)

### `[4d]` (1) — test:roundtrip (only the column-resize handle was overlay-DOM; the other [4d] ribbon-table ops are PAGED_KNOWN_GAP)
- [4d] column resize is armed: hovering a column border sets the resize handle

### `[6b]` (8) — test:roundtrip (table export) + the PE .superdoc-page paint (overlay-rendered table DOM)
- [6b] AutoFit Fixed undoes the Window stretch
- [6b] tableSetStyle visibly changes the table (bake)
- [6b] fresh table renders visible cell gridlines (Word parity)
- [6b] borderless table shows no gridlines
- [6b] tableSetAlignment center visibly centers the table (geometry)
- [6b] tableSetAlignment right hugs the right (geometry)
- [6b] tableSetIndent still indents (no regression after the margin gating)
- [6b] a Table Layout tab control cmd dispatches (tblInsertBelow grows the row count)

### `[9]` (6) — probe:notes (the #pm-notes-area overlay, retired in 008 — the PE paints footnotes) + test:roundtrip (the TOC node)
- [9] insertTOC on a 2-heading doc: tableOfContents node with ≥2 entries; page-number run reads "0" (A1)
- [9] notes-area: refInsertFootnote renders #pm-notes-area with the note number + body (D9.1)
- [9] notes-area: editing a note body in #pm-notes-area persists via the bridge (refListFootnotes + footnotes.list reflect it) (D9.1)
- [9] notes-area: refShowNotes reveals the region (returns true with notes, focuses a body); false with none (D9.1)
- [9] notes-area CLOBBER GUARD: a re-render mid-edit does NOT revert a focused dirty note body (FIX 1)
- [9] notes-area: editing an ENDNOTE body in #pm-notes-area persists to the endnote (FIX 3)

### `[fix]` (3) — probe:pointer (overlay caret-hit / .ProseMirror-selectednode DOM)
- [fix] a node-selected image shows a visible selection frame (.ProseMirror-selectednode is styled)
- [fix] clicking the empty area below the text jumps the caret to the doc END
- [fix] clicking the left margin beside a paragraph places the caret in it

### `[home]` (5) — test:roundtrip + the PE .superdoc-page paint (overlay-rendered paragraph-border / text-effect / hr DOM)
- [home] Bottom Border carries on Enter + merges — the rule moves to the run’s new last paragraph
- [home] All Borders on stacked paragraphs renders an outer box + merged inside-horizontal rules
- [home] Inside Horizontal on stacked paragraphs draws rules BETWEEN only (no outer edges)
- [home] Horizontal Line menu item inserts a horizontal-rule block
- [home] Text Effects: all quartet effects apply + render

### `[insert]` (1) — probe:imageresize (Picture natural-size render)
- [insert] Picture inserts at NATURAL size, clamped to the column width (not tiny 100px)

