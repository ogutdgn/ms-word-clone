# Deferrals & exclusions ledger

> The single place for everything the build must NOT chase right now. Three classes:
> **(A) Phase-4 / layout-engine-gated** (was "Phase-7 / pagination-gated"; re-sequenced 2026-06-14) — lands
> when the pagination/layout engine is built (Phase 4). **§A.1 below accumulates the layout-engine
> requirements** flagged during the Phase-3 ribbon-hardening pass — i.e. the Phase-4 spec.
> **(B) Cloud-runtime stubs** — physically need Microsoft cloud services; get graceful
> Word-like degraded behavior, final hide-vs-keep list presented to the user at Phase-2 end.
> **(C) Recorded product decisions / known deviations** — deliberate, evidence-backed.
> Moving a parity item HERE mid-slice requires it to fit A, B, or an explicit C decision —
> never "hard to fix". Append, date, justify; never silently drop items.
> *(Moved from `docs/loop/` 2026-06-11 when the short-lived loop process was retired —
> the ledger itself is process-independent and stays live.)*

> **2026-06-15 — §A is now the active Phase-4 feed.** Per the user pivot ("build the layout
> engine first, then fix bugs"), the consolidated spec + acceptance checklist + sub-phase build
> order lives in **[../LAYOUT_ENGINE.md](../LAYOUT_ENGINE.md)**; the rows below are its input.

## A — Phase-4 / layout-engine-gated (was Phase 7; spec §9.3)

- Page-setup *visual* geometry: margins, orientation, size, columns (model attrs may land earlier).
- Header/footer **editing** (needs live child editors); page-number fields' visual effect.
- Multi-page indicators, multi-page View modes, Side-to-Side.
- TOC page numbers (slice 9 ships TOC with degraded numbers).
- Find → Go To "Page"/"Line" visual landing.
- Table visuals pinned to layout: distribute-rows height render, AutoFit reflow,
  repeat-header render, text-direction BiDi metrics.
- **Mail-merge envelopes/labels page geometry (slice 10, D10.10).** PM mode inserts REAL
  content honestly — envelopes prepend a real PM page (`PM.openHtml(env + getHTML())`,
  existing content preserved); Labels → New Document builds a real PM label grid
  (`PM.openHtml(gridHtml)`). DEFERRED to Phase 4: Avery-grid page fidelity (true
  envelope/label sheet geometry), Labels → **Print** (PM path toasts, no E() mutation),
  and `updateLabels` «Next Record» propagation across a PM label table (PM path toasts,
  no E() mutation). NO `E()` mutation is reachable in PM mode (leak audit clean).

### A.1 — Layout-engine requirements (flagged during the Phase-3 ribbon-hardening pass)

> **The Phase-4 spec, accumulated bug-by-bug.** When the Phase-3 ribbon pass hits a feature whose correct
> behavior needs the layout engine, record it HERE with its *specific requirement* — and **never hack-fix it
> in continuous-flow** (the legacy spacer-hack was deleted in slice 11; do not grow a new one). Phase 4 is
> built to CLEAR this list (clearing = its acceptance test). **Flag classifier:** multi-page · floating-object
> position · text-wrap · headers/footers-on-page · columns · vertical page geometry.

| Tab/section | Feature | Required layout capability | Flagged |
|---|---|---|---|
| ~~Home → Paragraph → Borders~~ | ~~**Inside Horizontal border** between stacked paragraphs~~ | **RESOLVED 2026-06-15** (`e8d19aa`): in continuous flow two stacked paragraphs ARE adjacent blocks, so the "between" rule renders as the upper block's bottom border. `encodeCSSFromPPr` now implements Word's run-merge (top on first, bottom on last, between in the middle) + Enter carry-forward via `borderCarryPlugin`. No layout engine needed. | ~~2026-06-15~~ |
| Home → Paragraph → Borders | **Inside Vertical border** on paragraphs | No paragraph OOXML equivalent (it is a table/multi-column concept). The dropdown item + dialog toggle are present; applying flags a Phase-4 toast and writes no model attr. | 2026-06-15 |
| Home → Paragraph → Borders → Borders and Shading | **Page Border tab** (on-page render) | The tab writes a real `w:pgBorders` via `dePageBorders` (model + .docx faithful), but drawing a border around the page margins needs the layout engine. The tab carries an inline Phase-4 note. | 2026-06-15 |
| Home → Paragraph → Borders → Borders and Shading | **Shadow / 3-D border depth** (Setting buttons) | Approximated to a flat Box today; the offset/bevel depth needs the layout engine. OK shows a Phase-4 toast. | 2026-06-15 |
| Home → Paragraph → Borders → Borders and Shading | **Apply to: Text** (run-level `w:bdr`) | Run-level character borders are not on the fork command surface; the dialog applies to the paragraph and flags. | 2026-06-15 |
| Home → Paragraph → Borders | **Diagonal Down/Up border** (table cells) | Greyed outside tables (Word parity). In a cell, rendering the diagonal line needs the table layout pass. | 2026-06-15 |
| Insert → Header & Footer | **Header / Footer / Page Number** | Need the on-page header/footer region + page geometry. `isBlocked` today → honest deferral toast (no crash). | 2026-06-15 |
| Insert → Illustrations / Text | **Floating-object position + text-wrap** (Pictures/Shapes/Text Box/WordArt placed off-flow) | Insertion + .docx export are real (slice-10 anchors); absolute positioning + shape-aware wrap need the layout engine — renders inline today. | 2026-06-15 |
| ~~Insert → Pages~~ | ~~**Page Break vertical geometry**~~ | **RESOLVED 2026-06-15 (Phase 4a)**: the pagination engine (`src/renderer/pagination/pagination.ts`) renders manual page breaks (`hardBreak[pageBreakType='page']`) and blank pages (two consecutive breaks) as real page boundaries, plus auto multi-page flow + line-level intra-paragraph splitting. Oracle-validated vs Word for Windows 16.0 (`word-oracle-win.ps1 read-layout`): break paragraph + page count match exactly. | ~~2026-06-15~~ |
| ~~Insert → Picture / object selection~~ | ~~**Image RESIZE** (drag handles)~~ | **RESOLVED 2026-06-15 (Phase 4b)**: live resize via an owned 8-handle overlay (`src/renderer/imageresize/image-resize.ts`) — drag writes the image `size` attr (px), which the exporter turns into `wp:extent`/`a:ext` (EMU). Aspect-locked (Word's default). Oracle-validated (`read-shapes`): 200×100→260×130 px renders in Word as 195pt×97.5pt = 2476500×1238250 EMU. See §A.1c for the remaining 4b edges. | ~~2026-06-15~~ |
| Insert → Picture / Shapes / Text Box / WordArt | **Object RELOCATE** (floating) + ~~text-wrap~~ | **text-wrap RESOLVED 2026-06-15 (Phase 4c.1)**: `WC.PM.setImageWrap(mode)` wires the ribbon Wrap Text (inline/square/tight/through/top&bottom/behind/in-front) to the image `wrap`+`isAnchor` attrs → renders (float/shape-outside/absolute, real reflow) + exports a schema-valid `wp:anchor`; oracle-validated (all 6 floating modes open as floatingShapes). **Still deferred**: drag-to-RELOCATE (4c.2), z-order Bring/Send (4c.3), and the §A.1d edges. LAYOUT_ENGINE.md §2.3 / 4c. | 2026-06-15 |
| Insert / Table Tools → Table | ~~**Column RESIZE**~~ + **row RESIZE, table RELOCATE, row-split** | **Column RESIZE RESOLVED 2026-06-16 (Phase 4d.1)**: enabled prosemirror-tables `columnResizing` (was `handleWidth: 0` → re-armed at 5) — drag a column border → live `colwidth` write → exports `w:gridCol`/`w:tcW`; oracle-validated (180px → Word 135pt). **Row-height EXPORT fixed (4d.2)** — `w:trHeight` round-trips (oracle: 60px→45pt). **Row + Column size ribbon controls (4d.3)** — Table Layout "Cell Size" Row Height / Column Width flyouts set the row/col and export `w:trHeight`/`w:gridCol` (oracle: 0.5"→36pt, 1.5"→108pt). **Still deferred**: table RELOCATE, row-split across pages, AutoFit. LAYOUT_ENGINE.md §2 #4–6 / 4d+. | 2026-06-16 |

#### A.1b — Phase-4a pagination: recorded limitations (from the `/code-review max` pass, 2026-06-15)

> The 4a pagination engine matches Word for the common cases (oracle-validated). These edges
> are deliberately deferred. (High-value review findings FIXED: imported run-level
> `<w:br w:type="page">` breaks, the MID-document blank page + its status-bar weighting, the table
> mid-cell-seam mangling + nested-cell mis-attribution (tables are skipped at any nesting depth),
> asymmetric-margin band bleed, and the Linux opaque-headless-window regression. Two re-reviews of the
> fix commits then caught over-reaches that were REVERTED: `pageBreakSource` page-broke on the wrong
> side / for continuous sections (still deferred to 4f, below).
>
> **UPDATE 2026-06-15 (4a2):** the forced-break mechanism was redesigned to place the seam AT the
> break position `P` (pushing the content after `P` to the next page), which is the single fix the
> notes below predicted. This RESOLVED both **mid-paragraph breaks** and **trailing (doc-final)
> breaks** — they are now paginated + oracle-validated (`read-layout`: mid-para = one paragraph split
> across 2 pages; trailing = +1 blank page; blank page = content lands on page 3, all matching Word
> for Windows 16.0).
>
> **UPDATE 2026-06-15 (4a3):** the **next-page SECTION-break page boundary** is now paginated
> (`sectionBoundaries` in `pagination.ts`). The earlier spike's bug was diagnosed by oracle
> experiment: a `w:sectPr`'s `w:type` describes how ITS OWN section BEGINS (the break BEFORE it),
> NOT the break after it — so the break after a section-ending paragraph is governed by the NEXT
> section's type (the next ender's sectPr, or the body sectPr for the final section). Confirmed: a
> 3-para doc with one section break renders 2 pages in Word REGARDLESS of whether the ending
> paragraph's own `w:type` is absent, `continuous`, or `nextPage` (all → page break, because the body
> section defaults to nextPage). The MULTI-section rule is also oracle-validated: a doc whose MIDDLE
> section is `continuous` renders that middle section on the SAME page (2 pages, not the 3 a naive
> "break on every sectPr" gives) — Word and the engine agree. A section break before a TABLE also
> paginates correctly. `nextColumn` is treated as a page break (we render single-column; true columns
> are 4f). NOTE: the fork's `insertSectionBreakAtSelection` refuses the FIRST paragraph
> (`paraPos <= 0`) — a UI-command limitation, not an engine one; an IMPORTED first-paragraph sectPr is
> still handled. Per-section GEOMETRY and even/odd parity remain deferred (next bullet).
- **Section GEOMETRY + even/odd parity (the rest of section breaks → 4f).** The next-page section-break
  page BOUNDARY is paginated (4a3, above), but the engine still reads a single document-level
  `getPageStyles()`, so a section that changes margins / page size / orientation renders the new
  section with the OLD section's geometry. `evenPage`/`oddPage` section types are paginated as a plain
  page break (the extra blank page to LAND on an even/odd sheet is not inserted). A continuous section
  break that ONLY changes geometry (Word forces a page break on orientation/size change even when
  continuous — see the fork's `shouldRequirePageBoundary`) is not yet detected. All of this needs the
  per-section geometry pass (4f), which should reuse the fork's `extractSectionData` / section-state.
- ~~**Trailing (doc-final) page break is NOT paginated.**~~ **RESOLVED 2026-06-15 (4a2).** A
  `Ctrl+Enter` at the very end of the document now adds Word's trailing blank sheet (+1 page). The
  position-based forced seam (placed AT the break) handles it uniformly with mid-document breaks — no
  special-casing. Oracle-validated (`read-layout` = 2 pages, matching Word).
- **Page break inside a content-control / bibliography / index container.** The scan descends into all
  top-level blocks except tables, so a break in such a container IS detected and seams AT its position;
  whether the container's internal remainder flows correctly across the seam is untested. Niche.
- ~~**Mid-paragraph manual break.**~~ **RESOLVED 2026-06-15 (4a2).** A `Ctrl+Enter` in the MIDDLE of a
  paragraph (text both before and after) now splits the paragraph at the break — the after-the-break
  remainder moves to the next page. Implemented by placing the forced seam AT the break's position
  (`placeForcedSeam`), exactly as the prior note predicted. Oracle-validated (`read-layout` = one
  paragraph spanning 2 pages, matching Word).
- **A single block taller than one page that can't be line-split** (an image > 1 page, or a <4-line
  block taller than the content area) overflows the sheet without a seam and the page count is
  best-effort. True image/object pagination is sub-phase 4b/4d territory. (Corollary: the status bar
  counts seams above the caret, so a caret BELOW such an over-tall block reads a page number that is
  one-or-more too low — the over-tall block advanced `pageCount` without a seam entry. Resolves with
  the same sub-phase.)
- **Widow/orphan on the remainder of a mid-paragraph-broken paragraph that ALSO overflows a full
  page.** When a `Ctrl+Enter` sits inside a paragraph AND the after-break remainder is itself taller
  than one page, the auto line-split's ≥2-lines-each-side check (`findLineSplit`) counts lines from
  the BLOCK top, not from the forced break's page start, so it can strand a 1-line orphan on the
  forced-break page (or pull the split back to the break line). MED severity / RARE (needs a manual
  break mid-paragraph followed by >1 page of the same paragraph). Common mid-paragraph breaks (the
  remainder fits on the next page) are correct + oracle-validated. Confirmed by the 4a2 `/code-review`.
- **Forced break inside a block that `measureBlocks` skipped** (its `posAtDOM` threw) is dropped — no
  seam, page count short — whereas the pre-4a2 `prevPos` filter attributed it to the next block. LOW /
  EXOTIC: a top-level `#pm-editor` child whose `posAtDOM(el,0)` throws requires foreign DOM injected at
  the editor's top level (not produced by this codebase; the engine's own spacers are class-filtered
  first). Defensive-path divergence only. Confirmed by the 4a2 `/code-review`.
- **Pre-first-measure page count.** `counts().pages` / the status bar can show a one-frame "of 1"
  for a multi-page doc immediately on boot/Open, before the first rAF pagination measure publishes;
  it self-corrects on the next tick.
- **No automated oracle gate in `test:pm`.** The `[4a]` tests assert self-consistent geometry
  (page count, seam positions, band counts); the absolute lines-per-page parity vs Word is validated
  via the `word-oracle-win.ps1 read-layout` verb as a manual/PowerShell step (it needs a live Word),
  recorded in `docs/superpowers/plans/notes/2026-06-15-phase4a-pagination-oracle.json`. A future
  CI-friendly oracle harness could automate it.

#### A.1c — Phase-4b image resize: recorded limitations (from the `/code-review` pass, 2026-06-15)

> The 4b overlay does live, aspect-locked, oracle-validated image resize. These edges are
> deferred (none affect the common corner-drag-resize-a-picture path).

- **Free (one-axis) stretch is not supported; `lockAspectRatio` is not read.** All 8 handles
  resize PROPORTIONALLY (height = width / aspect), which is Word's default
  (`a:picLocks/@noChangeAspect`). Word lets the user UNCHECK "Lock aspect ratio" and stretch a
  single axis with an edge handle — the clone always locks, and the `node.attrs.lockAspectRatio`
  attr is currently ignored. Free-stretch also needs the fork's image `size` renderDOM to honor an
  explicit height (it emits `height: auto` today), and the exporter to emit the model height for a
  data-URI image even when it diverges from the intrinsic aspect. → a 4b follow-up.
- **Inline images are TOP-LEFT (flow) anchored, not opposite-corner anchored.** An inline image
  resizes from its text-flow position, so the SE / E / S handles feel natural (grow down-right) while
  the NW / N / W handles are size-only (the top-left stays pinned, matching the inline box). True
  opposite-corner anchoring + drag-to-reposition belongs to floating objects (4c).
- **A ROTATED image resizes from its axis-aligned bounding box.** `getBoundingClientRect` returns the
  enlarged AABB for an image with `transformData.rotation`, so the start size / aspect are the AABB's,
  not the image's own — resizing a rotated picture distorts it. Rotation handling is later layout work.
- **No automated oracle gate for image geometry in `test:pm`.** The `[4b]` tests assert
  self-consistent geometry (size grows, aspect locked, `wp:extent` EMU = px × 9525) + handle
  alignment; the Word-side parity is the manual `word-oracle-win.ps1 read-shapes` step.

#### A.1d — Phase-4c image floating/wrap: recorded limitations (from the `/code-review` pass, 2026-06-15)

> 4c.1 (text-wrap wiring) is DONE + oracle-validated (all 6 floating modes open in Word as
> floatingShapes; the exporter now emits a schema-valid CT_Anchor). These edges remain.

- **Drag-to-RELOCATE is not built (4c.2).** `setImageWrap` floats the image and seeds a
  column/paragraph-relative anchor at offset {0,0}; there is no overlay yet to drag a floating
  image to an arbitrary position (which would write `marginOffset` → `wp:posOffset`). So a freshly
  wrapped image sits at its paragraph/column origin rather than wherever Word would keep it; the
  user can't reposition it. Mirror the 4b resize overlay. (Latent: once 4c.2 writes a custom
  `marginOffset`, toggling to inline and back re-uses the stale offset — `setImageWrap`'s re-seed
  guard only fires when horizontal/top are null, not 0; reset it when 4c.2 lands.)
- ~~**Z-order Bring Forward / Send Backward is not wired (4c.3).**~~ **WIRED 2026-06-16 (4c.3).**
  `WC.PM.setImageZOrder(forward|backward|toFront|toBack)` mutates the floating image's
  `relativeHeight` relative to the other floating images (Word-sane values near the OOXML base);
  the ribbon Bring Forward / Bring to Front / Send Backward / Send to Back items call it (was the
  undefined `WC.Layout.*`). EXPORT is faithful + round-trips — oracle `read-shapes` confirms Word
  reads distinct `ZOrderPosition`s. **RENDER caveat (needs the frames-overlay):** the fork renders
  z-order as `z-index = max(0, relativeHeight − BASE)`, which (a) only affects ABSOLUTE (`wrap=None`)
  images — CSS-floated Square/Tight/Through stack by document order — and (b) conflates "behind text"
  (a negative z-index when `relativeHeight` is null) with inter-object stacking (`≥0`). So in-app
  z-stacking is partial; full render fidelity needs all floating objects rendered as absolutely-
  positioned frames with a managed z-index (the §3 frames-overlay). The "in front of / behind TEXT"
  toggle is the separate `behindDoc` (handled by `setImageWrap('front'|'behind')`). Also: for an
  IMPORTED floating image, `setImageZOrder` updates the top-level `relativeHeight` (EXPORT prefers it,
  so the .docx is correct) but `anchorData.renderDOM` still emits a z-index from the stale
  `originalAttributes.relativeHeight`, so the in-app re-stack may not show — another frames-overlay item.
- **Faithful free-RELOCATE + render z-stacking both need the frames-overlay (the big remaining 4c).**
  The current render positions floating images via CSS float (Square/Tight/Through) or absolute
  left/top (None only), and z-orders via z-index (positioned elements only). Faithful free-positioning
  with text wrap, AND faithful inter-object stacking, require rendering every floating object as an
  absolutely-positioned frame with text-exclusion (shape-outside / manual line exclusion) — the
  LAYOUT_ENGINE.md §3 frames overlay. 4c.1 (wrap) + 4c.3 (z-order export) are done on the current
  CSS-based render; the frames-overlay is the substantial remaining floating-objects work.
- **Tight/Through wrap follows the bounding box, not the image outline.** The default polygon is the
  image's rectangle (Word's own seed), so Tight ≈ Square for a rectangular image and does NOT hug a
  transparent-PNG silhouette; there is no polygon-edit UI. Faithful for rectangular images.
- **Image-in-table-cell floating is unverified.** `setImageWrap` floats an image at any selection
  depth (export sets `layoutInCell=1`), but in-cell anchoring vs Word isn't tested.
- **No automated Word-open gate.** The `[4c]` tests assert the export carries the required
  CT_Anchor attrs + wrap element (string match) — they'd catch a missing `simplePos`/`wrapPolygon` —
  but "does Word actually open it" is the manual `word-oracle-win.ps1 read-shapes` step.

#### A.1e — Phase-4d tables: status + remaining (column resize done 2026-06-16)

> Column RESIZE is DONE (4d.1): prosemirror-tables `columnResizing` re-enabled (`handleWidth` 0→5);
> drag a column border → `colwidth` (px). A grid-sync `appendTransaction` (table.js) rebuilds the
> table's `grid` attr (twips) from the changed colwidths, because the EXPORTER emits `w:gridCol`
> verbatim from `grid` — without the sync a resize on an IMPORTED table (which carries a `grid`)
> was silently DROPPED on save (caught by `/code-review`). Validated: border-hover arms the handle
> (`activeHandle` ≥ 0); oracle `read-table` reads a 180px resize as 135pt for BOTH a new table and an
> imported (stale-grid) table. These remain:

- ~~**Row-height export bug**~~ **FIXED 2026-06-16 (4d.2).** The export reconciliation
  (tr-translator) wrote the row-height `value` as a STRING via `String(pixelsToTwips(...))`, but the
  trHeight decode guards `typeof value === 'number'` and silently dropped it → a set/changed row
  height produced NO `<w:trHeight>` at all (not a px-vs-twips bug as first thought; px→twips was
  already reconciled — the regression was the string cast + it also dropped the `rule`). Now writes a
  number + preserves the rule. Oracle-validated: 60px → `w:trHeight w:val="900" w:hRule="atLeast"` →
  Word reads 45pt atLeast. **Row-resize UI affordance RESOLVED via ribbon controls** (next bullet).
- ~~**Row-resize UI is not built (4d.3)**~~ **RESOLVED 2026-06-16 (4d.3): ribbon Row Height + Column
  Width controls.** Added two `dropdown` controls to the Table Layout "Cell Size" group
  (`table-tools-pm.js`) wired to `H.tblRowHeight` / `H.tblColWidth` flyouts (`commands.js` — a shared
  `tblSizeFly` helper: an inches number input + presets, applying `tableSetRowHeight(px,'atLeast')` /
  `tableSetCellWidth(px)`); the two cmds were also added to the dropdown-dispatcher allow-list. Oracle-
  validated the full ribbon path: Row Height 0.5" → Word reads row 1 at 36pt heightRule=atLeast;
  Column Width 1.5" → Word reads col 0 at 108pt. Regression-tested (`[4d] ribbon Row Height/Column
  Width control …`). **Still optional polish:** a drag handle/overlay for row resize (prosemirror-tables
  has no built-in; would mirror the image overlay) — the ribbon control is the faithful Word affordance
  and is sufficient. (Note the caret won't stay in a freshly-`insertContent`ed HTML table — use
  `insertTable`; and synthetic drags don't drive PM pointer plugins headlessly.)
- **Table RELOCATE (drag the table) is not built.** Needs a move handle + (for a floating table) an
  anchor; mirror the image frames-overlay. 4d.
- **Row-split across a page boundary is not done.** The pagination engine still moves a table wholesale
  (skips it at any depth — pagination.ts). Row-split needs: measure row heights, find the boundary row,
  split via the fork's `splitTableAtRow`, seam before the continuation, repeat header rows. 4d.
- ~~**AutoFit (contents/window/fixed) geometry is not wired**~~ **WINDOW + FIXED DONE 2026-06-16 (4d.4).**
  `autoFitTable('window', targetWidthPx)` (fork `extensions/table/table.js`) now scales every column
  **proportionally** to fill the page text-column width — writes per-cell `colwidth` (px) via the
  TableMap; the `tableColwidthGridSync` plugin rebuilds the twips `grid`, so the in-app render AND the
  export (`w:gridCol`/`w:tcW`) both fill (no Phase-7 paint). `'fixed'` keeps the current widths +
  `tableLayout:'fixed'`. `'contents'` now also clears any prior Window stretch (was a no-op on
  `tableWidth`). The bridge (`tableAutoFit`, `bridge/table.ts`) computes the text width from
  `getPageStyles()` (`pageSize − L/R margins`)×96 and passes it down. Oracle `read-table` (real Word 16):
  Window 1:2 cols → 155.85pt + 311.65pt (sum 467.5pt = 6.5" text column, ratio 2.0); Fixed 120/180px →
  90pt + 135pt preserved; both open WITHOUT repair. Regression-tested (`[4d] AutoFit Window/Fixed/Contents …`).
  **Still deferred — AutoFit CONTENTS in-app reflow:** sizing columns to their CONTENT needs
  Word-equivalent text metrics (a content-measurement layout pass), so the live in-app shrink-to-content
  is layout-pass-deferred; the EXPORT intent is correct (`tableLayout:'autofit'` + cleared stretch), so
  Word content-fits the exported file when it opens it.
- **AutoFit cleanup-refactor (deferred, from the 4d.4 /code-review).** `/code-review high` found **zero
  correctness bugs** but flagged that `autoFitTable('window')`, `distributeColumnsEvenly`, and
  `setCellWidth` each hand-roll the same "walk the TableMap, dedupe by cellIndex, write a colspan-sliced
  `colwidth` array" loop, and that Window + distribute are arguably one primitive: **set all columns to
  sum exactly to TOTAL, distributed `even|proportional`**. A future tables-cleanup pass could extract a
  shared `setColumnsToTotal(total, mode)` helper (mind the divergences: distribute/setCellWidth set
  `userEdited:true` explicitly while autofit relies on the grid-sync plugin for it; different total-resolution
  fallbacks). Deferred from 4d.4 to avoid regressing the existing tested commands on a surgical slice.
- **Column-resize UX is prosemirror-tables' built-in** (thin drag indicator + col-resize cursor), not a
  Word-styled handle overlay. Faithful behaviour (drag the border); a fancier overlay is optional polish.
- **Grid-sync colspan edge (low).** The grid-sync rebuilds `grid` by pushing one entry per first-row
  `colwidth` array element. If a first-row merged cell's `colwidth` array is SHORTER than its colspan
  (the codebase normally keeps them equal), the rebuilt grid has fewer entries than columns; the export
  count stays right (`max(cellCount, gridLen)`) but a trailing sub-column falls back to a computed
  width. Rare; not padded defensively. (Per /code-review re-review.)

### A.2 — Text Effects quartet docx export (stage 2 — NOT layout-gated)

> **Stage 2a DONE (2026-06-15):** `w14:textOutline` + `w14:glow` now EXPORT and round-trip.
> Units: `w14:w`/`w14:rad` = pt × 12700 EMU (probe-verified: 2pt→25400, 6pt→63500); stroke/glow
> color via a `w14:srgbClr` child. New fork translators `w14-textOutline/` + `w14-glow/`
> (NOTICE'd), registered in `rpr-translator.js`; bridged both ways in `super-converter/styles.js`
> (`decodeRPrFromMarks` + `encodeMarksFromRPr`). Gated by `[effects]` in `test:pm`.
> - **Oracle status:** the macOS Word oracle timed out this session (`AppleEvent -1712`, the
>   documented Word-for-Mac AppleScript session fragility — not a docx defect). The structure
>   mirrors the **already-oracle-validated** typography trio's w14-under-`w:rPr` pattern, so Word
>   acceptance is high-confidence; a confirming oracle open + visual check is the recommended next step.
> - **Stage 2b PENDING — `w14:shadow` + `w14:reflection`:** deferred BECAUSE their units need
>   oracle-derived values, not because of any blocker. shadow = `{dx,dy,blur,color,preset}` →
>   `w14:shadow` needs cartesian→polar conversion (`dist`=hypot in EMU, `dir`=atan2 in 60000ths-degree,
>   plus `sx/sy/kx/ky`); reflection = a preset string → the full `w14:reflection` attribute set
>   (`stA/stPos/endA/endPos` in 1000ths-%, `dist/dir/fadeDir`) needs Word's exact preset values.
>   Build them the same way (translator dir + `decodeRPrFromMarks`/`encodeMarksFromRPr` branches +
>   registration) once the oracle is reachable to validate the polar/preset numbers.

### A.3 — Insert tab: non-layout content stubs (2026-06-15)

> **Picture sizing RESOLVED (`f77f3e9`):** Insert → Pictures now inserts at the image's natural
> size, clamped to the text-column width (aspect kept) — verified end-to-end via the real file
> picker (1400×900 → full column width). Was a hardcoded 100×100 tiny box.

These Insert controls are still STUBS (`WC.notImplemented` / honest degrade) — they are
content-authoring surfaces, not layout-gated, but each is a sizeable feature in its own right and
out of scope for the ribbon-hardening pass. Left for dedicated future slices:

| Control | Note |
|---|---|
| Shapes / SmartArt / Chart / Screenshot / 3D Models | net-new authoring UIs (shape vocab, diagram engine, chart data model). 3D + Screenshot also touch host/cloud. |
| Text Box / WordArt | insert inline today; off-flow positioning is the layout-engine item in §A.1. |
| Signature Line / Object (embedded/OLE) | OLE embedding + signature provider — host-integration features. |
| Equation | the equation editor builds OMML inline; the full equation authoring palette is a future slice. |

## B — Cloud-runtime stubs (docs/NOT_IMPLEMENTED.md is the authority)

Office.js add-ins · 3D models · online pictures/video playback · co-authoring ·
translator services · **Editor cloud ML** (the ML Editor Score, Similarity, Insights, and
the Formality / Punctuation Conventions / Resume / Vocabulary refinements) · Researcher.
Loop obligation: no jarring "not implemented" toasts — graceful Word-like degradation only.

> **Now shipping OFFLINE (2026-06-15):** the Editor pane's **Spelling** (nspell + a vendored
> SCOWL en_US Hunspell dictionary), **Grammar** (mechanical rules), and the **Clarity +
> Conciseness** refinements (heuristics) are real and run with no network — see
> `src/renderer/proofing/`. Only the ML/cloud pieces above stay in §B.

## C — Recorded decisions & known deviations (as of end of slice 7)

| Item | Decision / evidence | Recorded |
|---|---|---|
| Equation = styled Cambria-Math text, not OMML | real OMML math deferred (slice-6 deviation) | slice 6 |
| csv/tsv opens as a real PM **table**; opens UNSAVED (path=null) | user-directed; real Word shows raw delimited text (screenshot evidence in the slice-7 oracle JSON) | slice 7, D7.3/D7.4 |
| html import/export is **semantic** (inline styles stripped, alignment kept; headings export as styled paragraphs; `data-sd-*` attrs leak) | fork `stripHtmlStyles` + DOMSerializer design | slice 7, D7.10 + leg B |
| `.md`/`.rtf` open = legacy-only (fork `markdown` option noted as cheap future leg) | scope per spec §9.1 row 7 | slice 7, D7.2 |
| txt export: one block per line (Word tab-separates table cells); page break exports as `\n` | `textBetween` semantics | slice 7 |
| Save As offers docx/html/txt only | scope per spec | slice 7 |
| Phantom recents (push precedes import verdict) | pre-existing behavior carried forward; renderer-confirmed push = follow-up | slice 7 |
| Failed html import lands on a blank doc, binding UNBOUND via `PM.lastImportBlanked()` | data-loss guard; confirmDiscard consented | slice 7 |
| Mac Word ⌘F = toolbar search; our preserved sidebar pane | re-evaluate vs WINDOWS Word in slice-8 parity (Windows Word HAS a nav sidebar — may now be parity, not deviation) | slice 5 → revisit |
| Selection-scoped Replace All not supported (whole-doc only) | slice-5 deferral | slice 5 |
| Find "Sounds like / word forms / prefix-suffix / punctuation" options | deferred exotic options | slice 5 |
| Table Tools deferrals: tblLook checkboxes, ~50-style gallery breadth, border pen tools/Border Painter, Height/Width spinners, View Gridlines/Draw/Eraser/Properties, Cell Margins dialog, AutoFit-Contents reflow, banded-row live render, text-direction dropdown gallery | slice-6 recorded deferrals — candidates for slice-10/11 parity passes where NOT pagination-gated | slice 6 |
| Excel-Spreadsheet / Quick-Tables menu items | absent in Word Mac (re-check vs Windows Word in parity) | slice 6 |
| Authored data-URL images get a fresh rId per export | converter behavior | slice 6 |
| `onContentError` lifetime asymmetry (html- vs docx-seeded editors) | recorded follow-up, no current consumer | slice 7 review |
| No automated pin on the contentError recovery branch (probe-only) | synthetic fault injection needed | slice 7 review |
| `warnOnUnsupportedContent` not threaded (silent lossy html imports possible) | recorded follow-up | slice 7 review |
| `[0a] dirty flag` PM test flakes rarely on slow boots | re-run clears; don't chase | slice 7 |
| Suites flake under heavy parallel load | run gates on an idle machine | slice 7 |
| **PM-mode styles: NO hover Live Preview** — the gallery applies on CLICK only (selection → selection; caret → current paragraph) | user-directed (the hover preview restyled the selection/whole-paragraph live, read as a bug). REVERSIBLE — only `ribbon.js`'s hover wiring is disabled; `bridge/style-preview.ts` is intact. `--legacy` keeps its snapshot preview | post-slice-8 bug-fix (2026-06-11), PR #26 |
| TOC / Table of Figures / Index / Table of Authorities page numbers + caption SEQ numbers + rendered in-text-citation/bibliography text degrade to placeholders headless (TOC entry page run = `'0'`; caption number empty; bibliography/citation render empty) — the FIELD CODES + structure export and real Word repopulates on F9 (oracle Leg A clone→Word PASS) | Phase-7 layout gap (ledger-A class); `notes/2026-06-12-slice9-oracle.json` | slice 9 |
| Footnote/endnote note bodies are plain-text (rich formatting dropped); bibliography flyout title is cosmetic (the fork `BibliographyInsertInput` has no title slot — Bibliography/References/Works Cited collapse to one); Manual Table degrades to an auto TOC (`refInsertTOC` always builds from headings) | fork Document API shapes | slice 9 |
| **Word→clone import: the fork docx converter drops SEQ caption + CITATION complex fields → nodes** (footnotes + TOC import faithfully; an imported caption keeps its literal text but loses the SEQ number; an imported managed citation vanishes) — **PRIORITIZED fork-importer follow-up** (map `w:fldChar`+`w:instrText` SEQ/CITATION fields to `sequenceField`/`citation` nodes, or at least a `fieldAnnotation` preserving the cached display text) | oracle Leg B (`notes/2026-06-12-slice9-oracle.json`); pre-existing fork limitation, NOT a slice-9 wiring defect — clone create+export is faithful (Leg A) | slice 9 |
| **Mail-merge rule fields (IF/FILLIN/ASK/SKIPIF/SET) export as structurally-valid field codes but the IF OPERATOR is not mapped** — the legacy dialog builds `IF «F» Equal to "v" …`; Word's IF syntax is `IF «F» = "v" …`, so an exported IF won't auto-evaluate in Word (it round-trips as an inert-but-valid field, parity with the legacy engine which never evaluated rule fields). MERGEFIELD/GREETINGLINE/ADDRESSBLOCK/NEXT are full-fidelity (oracle Leg A PASS). Follow-up: map the operator labels (`Equal to`→`=`, `Not equal to`→`<>`, …) in `ifThenElseDialog` | recorded product decision (D10.9); `notes/2026-06-12-slice10-mailmerge-oracle.json` | slice 10 |
| **Word→clone import: a previewed/merged ADDRESSBLOCK/GREETINGLINE imports as the «…» placeholder, not the rendered multi-line text** — the `sd:mergeField` translator reconstructs `displayLabel` from the field instruction and discards the cached result runs. A plain MERGEFIELD is lossless (the cached run IS just «Name»). Follow-up: extract the cached text into `displayLabel` when it differs from the placeholder | recorded deviation (D10.12); `notes/2026-06-12-slice10-mailmerge-oracle.json` | slice 10 |
| **Themes redefine named styles with LITERAL fonts/colors, not theme-token indirection** — the clone writes `w:ascii`/`w:color@val` into `<w:style>` (valid real OOXML, opens identically in Word) rather than rewriting `theme/theme1.xml` `w:clrScheme`/`w:fontScheme`. Deeper-fidelity follow-up = a real theme-part rewrite so theme-token-referencing styles re-resolve | recorded decision (D10t/K5); `notes/2026-06-13-slice10-themes-oracle.json` | slice 10 PR2 |
| **Themes: Style Sets + Paragraph Spacing galleries are COMMIT-ONLY (no hover live-preview)** — the clone's style sets map to Normal paragraph spacing, which isn't cheaply wired for transient live preview; themes/colors/fonts DO hover-preview (font/color repaint via the linked-styles decoration). Honest degrade; click commits | recorded decision (D10t.9); slice 10 PR2 | slice 10 PR2 |
| **Themes: body-font live render for styleId-LESS paragraphs is best-effort** — heading restyle (explicit styleId) repaints live + exports; a styleId-less body paragraph's live font is Phase-7-class (EXPORT is correct via docDefaults + Normal redefinition regardless) | recorded deviation (K2, ledger A); `notes/2026-06-13-slice10-themes-oracle.json` | slice 10 PR2 |
| **Themes: watermark = visual stand-in + honest toast; on-page pageColor/pageBorders render = Phase-7** — the real header watermark needs live header child-editors (Phase 7); the `w:background`/`w:pgBorders` MODEL + EXPORT are real now and survive Word's resave (oracle Leg A), only the on-page visual paint is layout-gated | recorded deviation (ledger A); `notes/2026-06-13-slice10-themes-oracle.json` | slice 10 PR2 |
| **insert-exotica textBox: the fork has NO BLOCK-LEVEL VML-textbox importer** — `insertTextBox` EXPORTS a real editable `<v:textbox>` (Word opens/edits/resaves it — oracle Leg A PASS) and it is editable in-app at insert time, but on the CLONE's own reopen the editable shapeContainer is not reconstructed (`handleShapeTextboxImport` is only reached from the run-level `handlePictNode`, which discards block nodes — `pictNodeImporter.js:32-34`), so it degrades to `passthroughInline` (content + OOXML survive and re-export; editability is lost). Affects real-Word textboxes too — pre-existing, not a regression. **PRIORITIZED fork-importer follow-up**: wire a block-level `w:p`>`w:pict`>`v:textbox` → shapeContainer reconstruction | **USER-APPROVED** (defer reimport, ship the real export — 2026-06-13); `notes/2026-06-13-slice10-exotica-oracle.json` | slice 10 PR3 |
| **insert-exotica WordArt: non-editable + flat in-app render** — `insertWordArt` EXPORTS real DrawingML (`wps:wsp` + `bodyPr fromWordArt` + `a:prstTxWarp` + `w14:textFill`) that renders warped in Word and survives Word's resave (oracle Leg A); the in-app `vectorShape` NodeView paints the text FLAT (no warp) from `textContent` and is a non-editable atom. The warp/effects render in Word only | recorded deviation (ledger A/K2); `notes/2026-06-13-slice10-exotica-oracle.json` | slice 10 PR3 |
| **insert-exotica dropCap 'Dropped' not painted in-app** — `xeDropCap('drop')` EXPORTS a real `<w:framePr w:dropCap="drop">` (renders in Word, survives resave), but the fork's `dropcapPlugin` only visually paints `framePr.dropCap === 'margin'`, so 'Dropped' shows as a normal paragraph in-app ('In Margin' renders). In-app paint follow-up | recorded deviation (ledger A); `notes/2026-06-13-slice10-exotica-oracle.json` | slice 10 PR3 |
| **insert-exotica icons embed an SVG-only `w:drawing`** — `xeIcon` inserts an `image/svg+xml` data URL with no raster `a:blip` fallback; renders in-app, but a bare SVG `w:drawing` may not render in older Word without the asvg/svgBlip extension + PNG fallback. Icon-rasterization follow-up | recorded deviation; slice 10 PR3 | slice 10 PR3 |
| **insert-exotica chart / SmartArt / object(OLE) / signatureLine = honest no-op toasts** — no fork construction path (live `c:chartSpace`+data, `dgm:` diagrams, OLE host runtime, signature-provider). Each shows an honest "available in a future update / not available in this clone" toast; no `E()` leak, no false-success. object's "Text from File" keeps its real file-insert | recorded decision (D10ex.8); subsystem follow-ups | slice 10 PR3 |
| **insert-exotica onlineVideo = real hyperlink, no embedded playback** — `xeOnlineVideo` inserts a real link to the URL + an honest Phase-7 toast; no `wp15:webVideoPr` embedded-video frame (net-new follow-up). online image search / icon cloud library are non-replicable (honest local-pick degrade) | recorded decision (D10ex.7); slice 10 PR3 | slice 10 PR3 |
| **draw ink = real DrawingML freeform shape per stroke, NOT Word's literal w14:contentPart InkML** — `insertInkShape` exports a real `a:custGeom`/`a:pathLst` freeform AutoShape (wp:anchor, floats where drawn) that Word opens/edits/resaves (oracle Leg A+B PASS) — a STRICT upgrade over legacy ink (which never exported to .docx). Real InkML (`w14:contentPart` → `/word/ink/inkN.xml`) is fully net-new (run-level + OPC part plumbing, zero fork precedent, no COM stroke-injection oracle) — chart/smartart-tier deferral | recorded decision (D10dr.1); `notes/2026-06-13-slice10-draw-oracle.json` | slice 10 PR4 |
| **draw Drawing Canvas = a real bounded `prstGeom rect` shape, NOT a literal `wpc:wpc` wordprocessingCanvas** — `dInsertCanvas` inserts a real exporting rect frame; real `wpc:wpc` canvas (a drawing-grouping region) has no fork import/export and is net-new | recorded decision (D10dr.3); slice 10 PR4 | slice 10 PR4 |
| **draw inkToShape/inkToMath = honest toasts** — shape/equation recognition of ink has no real-Word ML construct here; `arcTo` in custGeom is dropped by the importer's parser (the stroke smoother only emits moveTo/quadBezTo, so no loss); highlighter = a fat translucent `a:ln` freeform stroke (honest degrade vs Word's true highlighter fill — the alpha DOES survive Word's resave) | recorded decision (D10dr.5); slice 10 PR4 | slice 10 PR4 |
| **draw live pointer-capture drawing not headless-tested** — the persist→render and Word-import→render paths are validated programmatically (Task-4 probe + oracle Leg B), but live pointerdown/move/up capture + the page-position mapping (R3) can only be confirmed by a manual `npm start` draw (the geometry is ported from the proven legacy WC.Draw). The bridge pen-state mirror to the ribbon tile-highlight (a cosmetic PM-mode highlight) is a minor follow-up | recorded note; slice 10 PR4 | slice 10 PR4 |

## C (slice 11 — legacy retirement, 2026-06)

Appended when the legacy world was retired (slice 11). These record the single-world
state of areas that previously leaned on the legacy engine.

| Item | Decision / evidence | Recorded |
|---|---|---|
| **`window.WC` chrome → TS/ESM module migration is DEFERRED** — the shared chrome (`commands.js`, `ribbon.js`, `dialogs.js`, `util.js`, `app.js`, `files.js`, `backstage.js`, `statusbar.js`, `*-tools.js` value tables, `home-features.js`, `table-tools-pm.js`, `icons*.js`, gen'd `ribbon-data.js`) stays as classic `<script>` tags on `window.WC`; only the editor core + bridge are TS/ESM. A future slice may migrate the chrome. | recorded decision (slice 11, decision 4); the editor core migration is what forced the bundler, the chrome migration is independent | slice 11 |
| **Shapes / Excel-Spreadsheet / Draw-Table inserts now show an honest toast** — there is no PM construct for them; they were silently-broken in PM since slice 10 (the legacy `E()`-mutating path was the only impl). Each now degrades to an honest "available in a future update" toast (no false success, no `E()` leak). Real PM constructs are a future follow-up. | recorded decision (slice 11) | slice 11 |
| **The 4 Phase-7 DEFERRED areas remain honestly `isBlocked`** — layout-page, layout-arrange, header-footer, text-effects. Their `commands.js` handler bodies are gated Phase-7 stubs (dead bodies that still reference the deleted `WC.HeaderFooter`/`WC.Layout`/`E()`, never reached because `isBlocked`/`notifyBlocked` short-circuits first). They show a Word-like deferral toast and await Phase 4 (pagination/layout engine + live child editors). `isBlocked`/`notifyBlocked` stay as the permanent Phase-7 gate (the D6 `FLIPPED`/`isFlipped` flip-tracking was retired in slice 11). | recorded decision (slice 11; Phase-7 class A) | slice 11 |
| **Office Clipboard pane opens but auto-capture is best-effort in PM** — the pane (`WC.Clipboard`) opens and manual paste works, but the auto-capture of cut/copy history was `editor.js`-wired in legacy; in PM it is best-effort. Full PM auto-capture is a follow-up. | recorded deviation (slice 11) | slice 11 |
| **Dictate / sensitivity-labels → honest toasts** — Dictate (Web Speech) and sensitivity labels show honest toasts in PM (the legacy `WC.Dictate`/sensitivity-bar wiring was retired with `editor.js`). Cloud-runtime class for sensitivity; Dictate is a possible future PM follow-up. | recorded deviation (slice 11; cloud/runtime class B for sensitivity) | slice 11 |

## Process notes

- Slices 1–7 were oracle-validated vs **Word for Mac 16.77.1**; from slice 8 the
  reference is **Word for Windows 16.0** (recorded in last-point.md, 2026-06-11
  Windows-replication entry). Mac-specific C-entries are
  re-evaluated against Windows Word during each slice's parity pass.
- Slice-6 UI-Codex leftover probes (A2 Insert-Table dialog, A5 Bookmark, B-layout/
  autofit, C1/C2) fold into the slice-10/11 parity passes naturally.
