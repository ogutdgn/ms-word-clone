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
| Insert → Pages | **Page Break vertical geometry** | Inserts a real break node; rendering an actual page boundary needs the multi-page layout engine. | 2026-06-15 |
| Insert → Picture / object selection | **Image RESIZE** (drag handles) | The selection frame + handles render (`2dca2e4`) but are **decorative**. Live resize needs an image **NodeView** whose handle-drag writes `w:extent` (EMU) back to the model. LAYOUT_ENGINE.md §2.2 / sub-phase 4b. | 2026-06-15 |
| Insert → Picture / Shapes / Text Box / WordArt | **Object RELOCATE + text-wrap** (floating) | Insert is **inline only**; drag-to-reposition + inline⇄floating + wrap (square/tight/through/top&bottom/behind/in-front) need the frames overlay + `w:anchor`/`posH`/`posV`. LAYOUT_ENGINE.md §2.3 / 4c. | 2026-06-15 |
| Insert / Table Tools → Table | **Column/row RESIZE, table RELOCATE, row-split across pages** | Tables render but the grid is fixed: dragging column/row borders (`w:gridCol`/`w:trHeight`), moving a table, and splitting a tall table's rows across a page boundary all need the table layout pass. LAYOUT_ENGINE.md §2 #4–6 / sub-phase 4d. | 2026-06-15 |

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
