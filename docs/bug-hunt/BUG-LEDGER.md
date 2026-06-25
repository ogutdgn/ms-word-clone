# ms-word-clone — Bug Ledger (re-baseline 2026-06-25)

> Fresh re-baseline of the clone vs **Word for Windows 16.0**, run against the **paged engine + features 002–013 + the page-break work**.
> Supersedes the stale 2026-06-17 corpus (moved to [archive-2026-06-17/](archive-2026-06-17/)). Method + how to re-run: [RE-DISCOVERY-CAMPAIGN.md](RE-DISCOVERY-CAMPAIGN.md).
>
> **54 confirmed bugs — 0 S1 · 18 S2 · 27 S3 · 9 S4.** Each is code-confirmed + adversarially verified (a second agent tried to refute it).
> Findings tagged `needs-runtime-probe+COM` (44) or `needs-live-compare` (46) await Phase-2/Phase-3 hardening. The actionable grouping is [COMPLETENESS-BACKLOG.md](COMPLETENESS-BACKLOG.md). Machine record: `findings-2026-06-25.json`.

## Severity scale
- **S1** crash / data-loss / doc corruption · **S2** major wrong behavior or export corruption · **S3** fidelity / visual deviation (content survives) · **S4** minor / cosmetic · **S5** confirmed-as-expected.

## S2 — 18

### RB-001 [S2] Fonts — Design › Document Formatting
- Shares BUG-011's heading-font export gap with Themes (same code path). Also 'Customize Fonts...' is WC.notImplemented (commands.js:794), and Word's Fonts gallery rewrites theme1.xml fontScheme (major/minor) rather than redefining named styles. Needs runtime+COM to re-confirm the heading vs body font asymmetry on a saved doc with a real Heading 1.
- **Evidence:** commands.js:794 H.fonts -> WC.PM.deApplyFonts (design.ts:94) -> redefine(themeUpdates(pair.heading,pair.body,null)) + applyDocDefaultsRun(body). SAME root cause as Themes: themeUpdates only emits the 6 paragraph styleIds, and redefineNamedStyles (linked-styles.js:164-181) strips theme bindings only on those, not the linked Heading*Char styles. Heading font change is therefore unreliable in Word (heading Char style retains asciiTheme=majorHAnsi); body font (Normal + docDefaults) is correct.
- **Confirm:** needs-runtime-probe+COM

### RB-002 [S2] Style Set — Design › Document Formatting
- Re-test of BUG-006: still fully present (the name->preset mapping was never populated). Word's style sets restyle headings AND spacing per set; here it's just one fallback spacing for all 9. Fix: a real per-name preset table covering fonts+spacing+heading styling. Runtime probe optional to confirm identical output across the 9 cells.
- **Evidence:** commands.js:792/801 styleSetGallery iterates WC.Design.STYLE_SETS = ['Default','Basic (Simple)','Basic (Elegant)','Lines (Distinctive)','Shaded','Casual','Centered','Word 2010','Word 2013'] (design-tools.js:102). Each cell calls WC.PM.deApplyStyleSet(name) -> design.ts:103 deApplyStyleSet, whose SETS map (design.ts:106-110) has keys ONLY {'No Paragraph Space','Compact','Double'}. None of the 9 gallery names intersect that map, so EVERY cell hits the fallback `{before:0,after:160,line:259,lineRule:'auto'}` (design.ts:111). All 9 style sets produce identical Normal-spacing output and change no fonts/heading styling, unlike Word where each set restyles distinctly.
- **Confirm:** needs-runtime-probe+COM

### RB-003 [S2] Themes — Design › Document Formatting
- Re-test of BUG-011 (was Word-confirmed). Code path UNCHANGED on the paged engine: themeUpdates() never enumerates the linked *Char styles, and redefineNamedStyles only strips theme bindings on the passed styleIds. Fix: also redefine/strip the linked Char styles' asciiTheme on theme apply. Needs runtime+COM oracle (read-word-props on a saved theme2.docx heading) to re-confirm the heading-font asymmetry.
- **Evidence:** commands.js:787 H.themes -> WC.PM.deApplyTheme -> design.ts:76 deApplyTheme -> redefine(themeUpdates(...)) (design.ts:50-63 builds updates ONLY for ['Title','Subtitle','Heading1','Heading2','Heading3','Normal']) -> fork command linked-styles.js:121 redefineNamedStyles. The export pass (linked-styles.js:164-181) deletes asciiTheme/hAnsiTheme bindings ONLY for the styleIds in `updates`. The linked '*Char' character styles (e.g. Heading1Char) are NOT in `updates`, so they keep w:asciiTheme="majorHAnsi". Word resolves run fonts from the linked Char style in preference to the literal, so headings still render in the OLD theme's major font (Aptos Display) while body becomes the new font. Body half works, heading half doesn't.
- **Confirm:** needs-runtime-probe+COM

### RB-004 [S2] Drawing (draw.pens.drawing, toggle) — Draw › Pens
- Ink mode toggles correctly under the hood, but the button never shows pressed-state and the menu label is stuck on 'Start Drawing' (WC.Draw.enabled never set). Wrong UI state = S3.
- **Evidence:** commands.js:740 H.drawing = () => { WC.PM.dSetDrawing(!WC.PM.dIsDrawing()); }. The bridge toggle works (draw.ts:108 flips drawState.on + syncs the overlay capture binding). BUG: the ribbon button gets NO pressed/latched state — 'drawing' is absent from ribbon.js TOGGLE_MAP (ll.35-40) and registers no state rule (grep of registerRibbonRule shows none for Draw), and H.drawing ignores the node so it never toggles '.toggled'. So the Drawing button never visually latches even though ink mode is on. Also commands.js:771 pensMenu reads WC.Draw.enabled to label 'Start/Stop Drawing', but WC.Draw.enabled is never set (always false) so it always says 'Start Drawing'. This is the drawing-toggle half of prior BUG-019, still live (ribbon.js:271/278 era, now commands.js:740/771).
- **Confirm:** needs-live-compare

### RB-005 [S2] Export → Create PDF/XPS — page geometry — File/Backstage › Backstage › Export
- Independent of BUG-030 (chrome capture). Even with a print stylesheet, the page box would be wrong for non-Letter/non-portrait docs.
- **Evidence:** main.js:448-452 printToPDF hardcodes `pageSize:'Letter'` and `margins:{marginType:'none'}` unconditionally. It ignores the document's actual page setup (A4/Legal/custom size, Landscape orientation, real margins) — all of which the clone now supports via Layout tab + the paged engine. A Landscape or A4 doc exports to a portrait Letter PDF with the wrong clipping. Word's PDF export honors the document page setup.
- **Confirm:** needs-live-compare

### RB-006 [S2] File → Close — File/Backstage › Backstage › rail
- Prior BUG-020 [S2] re-validated — still present at backstage.js:48 + files.js:53.
- **Evidence:** backstage.js:48 `if (pane === 'close') { WC.Files.newDoc(); return; }` → files.js:53 newDoc() opens a fresh blank document. Word's File → Close closes the current document (in a single-doc shell, returns to a backstage/no-document state or prompts). Here it silently REPLACES the doc with a new blank (after confirmDiscard), so you can never be document-less and 'Close' is indistinguishable from 'New'. Re-confirmed against current code; matches prior BUG-020. Note: confirmDiscard() does run first, so it's not data-loss, but the semantics are wrong.
- **Confirm:** code-confirmed

### RB-007 [S2] Info pane — Pages count — File/Backstage › Backstage › Info
- Same root cause feeds Properties dialog and Word Count dialog (see those findings). Fix: route counts().pages through WC.PM.coords.getPageCount().
- **Evidence:** backstage.js:107 shows ['Pages', c.pages] from WC.PM.counts(). counts() in bridge/io.ts:49 computes `const pages = (w.WC?.PM?.__pagination?.pageCount) || 1`. `__pagination` was the OVERLAY decoration-paginator, which was fully retired in feature 008 (paged is the sole engine). Under the paged PresentationEditor it does not exist, so pages ALWAYS falls back to 1. The correct paged count is available at WC.PM.coords.getPageCount() (coordinate-adapter.ts:89-103 → editor.currentTotalPages; exposed at bridge/index.ts:460). Word's Info backstage shows the true page count. This is the open follow-up task_3436e431. One-line fix, currently wrong for any multi-page doc.
- **Confirm:** needs-runtime-probe+COM

### RB-008 [S2] Print (and Export → Create PDF/XPS) — File/Backstage › Backstage › Print / Export
- Prior BUG-030 [S3] re-validated and arguably worse than S3 (full chrome capture). needsLive to see exact captured raster. Compounded by the geometry hardcode below.
- **Evidence:** Print: backstage.js:118 → files.js:154 print() → main.js:460 webContents.print({printBackground:true}). PDF: backstage.js:144/126 → files.js:148 exportPdf() → main.js:440 webContents.printToPDF({printBackground:true, pageSize:'Letter', margins:{marginType:'none'}}). There is NO print stylesheet anywhere — Grep for '@media print'/'@page' across src/renderer/public/styles returns zero hits (only .print-preview screen styles in backstage.css:94-95). So both paths capture the FULL app chrome: title bar, ribbon, status bar, the gray #pages background and inter-page gap bands. Word prints only the document pages. Re-confirmed against current paged engine; matches prior BUG-030.
- **Confirm:** needs-live-compare

### RB-009 [S2] Font Size (combo) — Home › Font
- Reachable via typed combo entry. Probe: setFontSize('120pt') then read back textStyle.fontSize == 96pt; COM oracle Word stores 120.
- **Evidence:** commands.js:1881 setFontSize -> WC.PM.cmd('setFontSize', pt+'pt'). Fork clamps to defaults min:8 max:96 (font-size.js:57-58, minMax at :113). Word allows 1-1638pt. A typed combo value (comboCommit:1788 parseFloat) of e.g. 120 or 4 is SILENTLY clamped to 96/8 with no feedback. Confirms prior BUG-014 still live.
- **Confirm:** needs-runtime-probe+COM

### RB-010 [S2] Shading (split) — Home › Paragraph
- Whole-paragraph selection is correct; sub-paragraph selection over-applies. Probe: select 2 words, apply shading, check pPr vs rPr shd.
- **Evidence:** commands.js:93 + applyColor 'shade' (commands.js:1912-1916) ALWAYS writes paragraphProperties.shading (pPr/w:shd) regardless of selection. On a partial text (sub-paragraph) selection Word applies RUN shading (rPr/w:shd) to just the selected characters; the clone floods the entire paragraph. Confirms prior BUG-036.
- **Confirm:** needs-runtime-probe+COM

### RB-011 [S2] Finish & Merge (mailings.finish.finish-merge) — Mailings › Finish
- S2: per-record page breaks are silently dropped in the paged engine -> merged output is one continuous blob, not one-page-per-record. Root cause: mmBuildMerge emits a manual-break DIV that createDocFromHTML cannot parse (needs a real pageBreakBefore paragraph per 013). Field substitution itself is correct. Also folds BUG-059 (mergeType ignored) and BUG-064 (NEXT rule no-op). Needs paged-render live check + COM oracle on the saved merge.
- **Evidence:** commands.js:1217 flyout -> WC.Mail.finishMerge(mode) (mailings-tools.js:171-182). 'Edit Individual Documents': turns preview off, mmBuildMerge(recipients, _mergeResolve) (mail.ts:39-57) builds per-record HTML joined by '<div class="manual-break" style="break-after:page">', then mmFinishToNewDoc -> WC.PM.openHtml -> createDocFromHTML. The fork has NO parse for class=manual-break / break-after:page (paragraph.js:196-204 makes it an empty <p>; grep=0 hits), so in the paged engine ALL RECORDS RUN TOGETHER with no page break between them — Word puts each record on its own section/page. This is a wrong-output regression introduced by the paged migration (the prior overlay engine honored break-after CSS). 'Print' = toast + Files.print (line 173). 'Send Email' = honest stub (line 174). BUG-059 (Directory ignored) and BUG-064 (NEXT field never advances the cursor; __NextRecord__->'' at mail.ts:51) also live here.
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-012 [S2] Go to Record (mailings.preview-results.go-to-record) — Mailings › Preview Results
- BUG-021 live: wrong icon, step=6 (functionally jumps 6 records), 'pt' unit, default 0. Plus no value sync-back from navigation. The generic spinner renderer needs a record-spinner variant. Live/visual to confirm rendering.
- **Evidence:** ribbon.js:450-461 renderSpinner is fully generic and mis-configures the goToRecord spinner (BUG-021 re-confirmed): isIndent=false so icon = increaseIndent (a paragraph-indent glyph), step='6' (arrows jump 6 records at a time), default value='0' (records are 1-based), unit span shows 'pt'. Dispatch commands.js:1817 WC.Mail.go((value||1)-1). Word's Go to Record box is a plain integer (default 1, step 1, no unit, no indent icon). Additionally the spinner value is NOT synced back after First/Prev/Next/Last navigation (no controlIndex.goToRecord.input.value update in go()), so the displayed number is stale.
- **Confirm:** needs-live-compare

### RB-013 [S2] Greeting Line (mailings.write-insert-fields.greeting-line) — Mailings › Write & Insert Fields
- BUG-008 still live for switches. Field type round-trips as w:fldSimple GREETINGLINE. Dialog options never reach the export. Preview also affected: see Preview Results / BUG-058.
- **Evidence:** commands.js:1176 -> WC.Mail.greetingLine(): the dialog (mailings-tools.js:90-111) collects greeting word/name-format/punctuation/fallback, but OK calls the PARAMETERLESS WC.PM.mmGreetingLine() (mail.ts:21). Export (translate-field-annotation.js:40) emits SIMPLE field instr just 'GREETINGLINE' with cached '«GreetingLine»'. BUG-008 re-confirmed: \f \l \e switches dropped. Word writes 'GREETINGLINE \f "..." \l 0 \e "..."'. Also note translate uses buildSimpleFieldElement (w:fldSimple) for GREETINGLINE while Word uses a complex fldChar field for GREETINGLINE — likely tolerable but a fidelity nit.
- **Confirm:** needs-runtime-probe+COM

### RB-014 [S2] Rules (mailings.write-insert-fields.rules) — Mailings › Write & Insert Fields
- BUG-008 IF operator/literal-field is the highest-severity Mailings bug — exports a functionally broken (non-evaluating) IF field. Plus condition-less NEXTIF/SKIPIF. Rule fields now DO export as real complex fldChar runs (improved), but the instruction strings are invalid Word field code.
- **Evidence:** commands.js:1178-1207 builds the Rules flyout (If/Fill-in/Ask/Merge Record#/Merge Seq#/Next/Next If/Set/Skip If). BUG-008 highest-severity re-confirmed: ifThenElseDialog (commands.js:1204) builds code 'IF «Field» Equal to "0" "Then" "Else"' using the HUMAN operator label op.value ('Equal to') and a LITERAL «Field» (not a nested MERGEFIELD). mmInsertRule (mail.ts:22) -> RULE export (translate-field-annotation.js:41-42, buildComplexFieldRuns) writes that instr verbatim. Word requires '=','<>','>','<' and a nested field, so this exports an IF that shows '!Syntax Error' / never evaluates. NEXTIF/SKIPIF (commands.js:1187,1189) insert bare 'NEXTIF'/'SKIPIF' with no condition. NEXT is handled but see BUG-064.
- **Confirm:** needs-runtime-probe+COM

### RB-015 [S2] Insert Citation (dropdown: Add New Source…, Add New Placeholder…, existing sources) — References › Citations & Bibliography
- Insert-citation core works (field exports). Two issues: (1) 'Add New Placeholder…' is a stub (gap); (2) BUG-047 S2 data-loss still live — Source Manager Edit drops authors 2+ (editPrefill authors[0] + buildSourceFields rebuild + Object.assign in the fork). The S2 belongs to the Edit/data-loss path.
- **Evidence:** commands.js:1057-1071 H.insertCitation flyout. 'Add New Source…' → WC.Dialogs.addSource() (dialogs.js:1282-1306) → refAddSource (references.ts:511-521, maps flat shape to fork CitationSourceFields, mints sourceId) then refInsertCitation (references.ts:524-534 → d.citations.insert). Working in-text CITATION field. BUT 'Add New Placeholder…' (commands.js:1060) is a no-op toast ('Add a source via Add New Source…') — Word inserts a real named placeholder citation. AND the addSource dialog only captures a SINGLE author string (dialogs.js:1285), and Source Manager Edit (editPrefill, dialogs.js:1317-1322) reads only authors[0] → editing a multi-author source DESTROYS authors 2+ via Object.assign (confirms BUG-047, S2 data loss).
- **Confirm:** needs-runtime-probe+COM

### RB-016 [S2] Manage Sources (button — Source Manager) — References › Citations & Bibliography
- BUG-047 S2 data loss confirmed in current code. Single-list (no Master vs Current split) is a fidelity gap. needsRuntime to confirm the round-trip author drop via a probe + COM read-back.
- **Evidence:** commands.js:1072 H.manageSources → WC.Dialogs.manageSources (dialogs.js:1307-1346). Lists sources (refListSources), Edit→refUpdateSource, Delete→refRemoveSource — a real master/current-list manager. DATA-LOSS bug: editPrefill (dialogs.js:1319-1321) collapses authors to authors[0] only, and the Edit submit (line 1333) routes the rebuilt single-author patch through refUpdateSource→buildSourceFields→fork Object.assign(source.fields,patch), overwriting the multi-author array. Confirms BUG-047. Word's Source Manager preserves all authors. Also lacks the two-pane Master/Current list + Copy/New/Browse of real Word (gap).
- **Confirm:** needs-runtime-probe+COM

### RB-017 [S2] Mark Entry (button, Alt+Shift+X) — References › Index
- BUG-022 still live: no Mark Index Entry dialog; silent no-op without a selection, and no subentry/cross-ref/page-range/Mark-All options when there is one. Word's dialog is the core of indexing UX.
- **Evidence:** commands.js:1050 H.markEntry → WC.PM.refMarkIndexEntry() called with NO args and NO dialog. references.ts:340-358 refMarkIndexEntry(info) with info undefined falls to the selection-text branch (line 346-352): if there is a non-empty selection it marks an XE field with the selected text, else returns false (silent no-op). Word ALWAYS opens the full 'Mark Index Entry' dialog (Main entry / Subentry / Cross-reference / Current page / Page range / bold-italic / Mark / Mark All). Confirms BUG-022. So with no selection the button silently does nothing; with a selection it marks a bare XE with no subentry/options.
- **Confirm:** code-confirmed

### RB-018 [S2] Restrict Editing (review.protect.restrict-editing) — Review › Protect
- Re-test of prior BUG-005 against current paged code: still present by inspection. The pane UI + Tracked-Changes-mode (enableTrackChanges + lock) leg work; the 'No changes (Read only)' leg leaks. Probe: setEditable(false), then run bold/insertText/addComment and check doc size/marks.
- **Evidence:** dialogs.js:885-947 D.restrictEditingPane: read-only Start calls `p.getEditor().setEditable(false,false)`. Editor.ts:2291 setEditable only flips ProseMirror's `editable` prop (gates USER DOM input), it does NOT reject programmatic `view.dispatch`. The ribbon write path (WC.PM.cmd / H[cmd]) has no read-only guard: bridge/index.ts:180 isBlocked is purely the D6 layout-area gate (DEFERRED = layout-page/layout-arrange/header-footer) with zero `editable` awareness. So with protection 'on', ribbon formatting, programmatic tr.insertText, and addComment still mutate the doc. This is exactly prior BUG-005 [S2] and the architecture is unchanged on the paged engine. Word blocks ALL edits under read-only protection.
- **Confirm:** needs-runtime-probe+COM

## S3 — 27

### RB-019 [S3] Pens Gallery (draw.pens.pens-gallery) — Draw › Pens
- Pen selection works functionally (dSetPen sets the bridge pen), but the active-pen highlight is dead (always 'Pen' tile) and the 2nd-click pen-options (thickness/color/effects) flyout is missing. Wrong pressed-state UI = S3 fidelity.
- **Evidence:** Two render paths. (a) In-ribbon gallery (ribbon.js:260-289 renderPensGallery): a tile's active highlight reads draw.pen && draw.pen.id === pen.id (line 271). WC.Draw.pen is NEVER reassigned anywhere (grep for 'WC.Draw.pen =' / 'Draw.pen =' returns no matches); it stays PENS[0]. So only the first 'Pen' tile ever shows active, regardless of the pen actually selected via dSetPen (draw.ts:120 only mutates the bridge drawState.pen, not WC.Draw.pen). (b) Flyout (commands.js:761 pensMenu) lists pens and calls dSetPen but also never updates WC.Draw.pen. This is prior BUG-019's pen-select half, still live. Also: the tooltip promises 'click again to set Thickness/Color/Effects' — there is no per-pen options flyout (tile click just toggles drawing).
- **Confirm:** needs-live-compare

### RB-020 [S3] Properties dialog — Pages row — File/Backstage › Backstage-adjacent (Info → Properties / Review Word Count)
- Fixing counts().pages once repairs Info pane, Properties dialog, and Word Count simultaneously.
- **Evidence:** commands.js:1562 propertiesDialog rows include ['Pages', c.pages] and dialogs.js:266 Word Count rows include ['Pages', c.pages]; both call WC.PM.counts() which has the dead __pagination read (io.ts:49). Same root cause as the Info-pane Pages bug — always 1. Listed separately since these are distinct surfaces a user sees.
- **Confirm:** needs-runtime-probe+COM

### RB-021 [S3] Text Effects and Typography — Outline — Home › Font
- Only the width-preset items are broken; the explicit Outline Color path works. Probe: apply '1 pt outline', export, inspect w14:textOutline > w14:srgbClr val.
- **Evidence:** commands.js:607-608 outlineMenu width presets pass color:'currentColor'. Export textOutline-translator.js:38 does String(o.color).replace(/^#/,'').toUpperCase() => 'CURRENTCOLOR', an invalid OOXML srgbClr w14:val. Word drops the invalid outline on open (data loss). Confirms prior BUG-051. (Outline Color... picker passes a real hex and is fine.)
- **Confirm:** needs-runtime-probe+COM

### RB-022 [S3] Text Highlight Color (split) — Home › Font
- Picking any of the 15 Word keyword colors is fine; any other swatch silently becomes shading. The palette itself is wrong (should be the 15-keyword highlighter grid).
- **Evidence:** commands.js:57 + 1637 colorMenu(node,'hilite') uses the FULL WC.colorPalette (theme + tints + standard + More Colors — util.js:109) instead of Word's fixed 15-keyword highlighter set. On export, highlight-translator.js:48 getDocxHighlightKeywordFromHex returns null for a non-keyword color -> falls back to w:shd (character shading) NOT w:highlight (lines 56-66). On reopen it is shading, not a highlight: different semantics + the highlighter button won't toggle it off. Confirms prior BUG-015.
- **Confirm:** needs-runtime-probe+COM

### RB-023 [S3] Cover Page — Insert › Pages
- All 6 gallery designs collapse to ONE generic 3-paragraph block (design name ignored). Re-test of prior BUG-009 — STILL PRESENT on the exotica bridge.
- **Evidence:** commands.js:435 H.coverPage -> insert-features.js:24-37 coverPageMenu lists 6 designs (Banded/Facet/Filigree/Ion/Motion/Retrospect) each calling Insert.insertCover(t) -> WC.PM.xeCoverPage(t.name). bridge/insert-exotica.ts:69 xeCoverPage(name) uses `name` ONLY as the title-paragraph string (line 78 `title = name`); the documentPartObject content (lines 88-92) is a fixed 3-paragraph stub (title bold / [Subtitle] / [Author Name] - year) regardless of which design was chosen. Word inserts 6 visually distinct fully-formatted cover layouts. The ribbon-data gallery/'More Cover Pages'/'Save Selection' items are also not individually wired. Remove Current Cover Page works (xeRemoveCoverPage deletes the first documentPartObject).
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-024 [S3] Align — Layout › Arrange
- ENGINE_READY has 'align' but only 3 of 13 items do anything. Align-to-Page/Margin (the relativeFrom toggle), gridlines, and multi-object distribute are missing. Pictures only. P2 + S3 mix; the missing-items are the dominant gap.
- **Evidence:** commands.js:991-995 H.align. Only Align Left/Center/Right are wired (-> setImageAlign({h}) -> margin-relative horizontal via insert.ts:597-608). Align Top/Middle/Bottom + Distribute H/V emit an honest 'is a follow-up' toast (commands.js:994). The ribbon-data control (ribbon-data.js:1537-1551) lists 13 items including 'Align to Page', 'Align to Margin', 'Align Selected Objects', 'View Gridlines', 'Grid Settings...' -- NONE of these 5 are rendered in the handler menu at all. setImageAlign is image-only and requires a single floating picture (no multi-select distribute).
- **Confirm:** needs-live-compare

### RB-025 [S3] Breaks — Layout › Page Setup
- All 7 menu items wired (matches ribbon-data 7), ENGINE_READY has 'breaks'. The mid-paragraph-split semantics deviation is the real S3. KNOWN open gap (CLAUDE.md): imported docs carrying an inline <w:br w:type=page> still need a converter-level fix. Paged PE does not repaginate at a section break in-app (export-faithful).
- **Evidence:** commands.js:552-566 breaksMenu. Page -> insertPageBreak (bridge/insert.ts:224-238 appendPageBreakParagraph); Column -> insertColumnBreak (insert.ts:254-258, hardBreak lineBreakType:'column' -> <w:br w:type=column>); Text Wrapping -> insertLineBreak (insert.ts:259-263); Next Page/Continuous/Even/Odd -> insertSectionBreak (bridge/section-breaks.ts). BUG: Page break (and Blank Page) ALWAYS insert a new EMPTY pageBreakBefore paragraph at $from.after(1) (insert.ts:226-229) -- it does NOT split the current paragraph at the caret. In Word, Ctrl+Enter mid-paragraph splits the paragraph and pushes the text AFTER the caret to the next page; here that text stays on the current page and a blank paragraph opens the new page. Section-breaks v1 (section-breaks.ts:68-79) refuses a 2nd+ TYPED break (one typed break per doc; multiple Next Page allowed).
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-026 [S3] Margins — Layout › Page Setup
- Unblocked (ENGINE_READY has 'margins'); export faithful for Normal/Narrow/Moderate/Wide/Custom. Mirrored != Word mirror margins (S3). Custom Margins dialog only offers a single uniform inches value, not per-side (Word's dialog has Top/Bottom/Left/Right/Gutter).
- **Evidence:** commands.js:2150-2166 marginsMenu + bridge/design.ts:249-258 dePageMargins. Presets pass full {top,right,bottom,left} to d.sections.setPageMargins -> body sectPr w:pgMar (correct OOXML, all 4 sides, Word-validated per ENGINE_READY note). TWO fidelity issues vs Word: (1) the 'Mirrored' preset is applied as a SYMMETRIC lr=1.25 (commands.js:2155) instead of true mirror margins (Word writes w:mirrorMargins + inside/outside) -> a mirrored doc round-trips as plain symmetric margins. (2) The CSS paint setPageVar('--page-margin', lr*96) only applies the L/R value uniformly and ignores top/bottom; in the paged PE the real geometry comes from the sectPr, so whether the on-screen sheet margin updates live is a render question.
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-027 [S3] Position — Layout › Arrange
- ENGINE_READY has 'position'. Vertical placement ignored (9 presets -> 3 distinct results) is the S3 fidelity gap. 'More Layout Options...' missing. Pictures only (no shapes).
- **Evidence:** commands.js:968 H.position. 'In Line with Text' -> setImageWrap('inline'); the 9 With-Text-Wrapping presets -> setImageWrap('square') + setImageAlign({h}) where h is only left/center/right. BUG: all three rows (Top/Middle/Bottom) collapse to the SAME horizontal-only placement -- Top-Left == Middle-Left == Bottom-Left (commented v1 limit, commands.js:964-967). Word's Position presets set BOTH a vertical (top/middle/bottom relative to margin) and horizontal anchor. Also ribbon-data lists 'More Layout Options...' (ribbon-data.js:1472) but the handler menu does NOT render it. setImageAlign (insert.ts:597-608) requires isAnchor and only acts on type 'image' (selectedImage insert.ts:273-277), so shapes/text boxes/WordArt are unsupported.
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-028 [S3] Size — Layout › Page Setup
- OOXML export faithful. Minor: paper-size pick resets orientation to portrait. Live sheet repaint in paged PE needs confirming.
- **Evidence:** commands.js:2181-2204 pageSizeMenu + dePageSize. Six presets Letter/Legal/A4/A3/Tabloid/Executive with px dims matching Word @96dpi (Letter 816x1056, Legal 816x1344, A4 794x1123, A3 1123x1587, Tabloid 1056x1632, Executive 696x1008). Each preset and the More-Paper-Sizes dialog ALWAYS pass orientation:'portrait' (commands.js:2189) even though dePageSize also passes width/height; harmless because dims are portrait-oriented, but if the doc was already landscape, choosing a paper size silently forces it back to portrait (Word preserves orientation when only the paper changes). Same live-repaint question as Orientation (BUG-026).
- **Confirm:** needs-live-compare

### RB-029 [S3] Address Block (mailings.write-insert-fields.address-block) — Mailings › Write & Insert Fields
- BUG-008 partially remediated: now exports a real ADDRESSBLOCK complex field (was bare). Remaining gap: dialog options never reach the bridge (parameterless mmAddressBlock) so all \f/\c/\e switches are lost; cached result is the literal placeholder. Preview/composite() resolves it in-app via _val.
- **Evidence:** commands.js:1175 -> WC.Mail.addressBlock(): the dialog (mailings-tools.js:66-89) has name-format/company/postal options and a live preview, but OK just calls WC.PM.mmAddressBlock() (mail.ts:20) which is PARAMETERLESS. Export (translate-field-annotation.js:39 mergeFieldInstruction COMPOSITE) emits a complex field with instr exactly 'ADDRESSBLOCK' and cached text '«AddressBlock»' (the literal placeholder, not resolved). BUG-008 re-confirmed: none of the \f \c \e switches the dialog collects are written. Word writes 'ADDRESSBLOCK \f "..." \c 1 \e ...'. Note: export DID improve since the prior — it is now a real 5-run w:fldChar complex field (buildComplexFieldRuns), so the field type round-trips; only the switches/params are dropped.
- **Confirm:** needs-runtime-probe+COM

### RB-030 [S3] Envelopes (mailings.create.envelopes) — Mailings › Create
- Functional dialog exists (delivery/return address). Two deviations: (1) the manual-break separator div is dropped by the paged importer so the envelope is not a separate page; (2) no real envelope page size/orientation. Needs a live paged-render check + COM oracle for envelope geometry.
- **Evidence:** commands.js:1169 H.envelopes -> WC.Mail.envelopes() (mailings-tools.js:184-192). The dialog builds an envelope HTML block + a '<div class="manual-break" style="break-after:page;page-break-after:always">' separator, then WC.PM.openHtml(env + existingHtml). openHtml -> replaceEditor -> createDocFromHTML (bridge/index.ts:260). The fork has NO parse rule for class=manual-break or break-after:page CSS (grep of superdoc-fork = 0 hits; paragraph.js:196-204 parses a bare <div> into an empty paragraph with extraAttrs, dropping the CSS). A real page break in the paged engine is a pageBreakBefore paragraph (013), not a styled div. So the envelope merges onto the same first page as the document instead of being its own page; envelope geometry (real envelope page size) is also not applied. Word produces a distinct envelope-sized page.
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-031 [S3] Insert Merge Field (mailings.write-insert-fields.insert-merge-field) — Mailings › Write & Insert Fields
- Core insertion works and exports as a real w:fldSimple MERGEFIELD. The unquoted-name-with-space bug truncates multi-word column names on docx export — a real wrong-output edge case. Split control's main vs arrow both reach the same menu (no 'last used field' fast-insert like Word, minor).
- **Evidence:** commands.js:1177 -> WC.Mail.insertMergeFieldMenu(node): flyout of the current field names; insertField -> WC.PM.mmInsertField(field) (mail.ts:19) -> addFieldAnnotationAtSelection MERGEFIELD. Insertion + getHTML round-trip is sound (field-annotation.js parseDOM/renderDOM emit data-field-type/data-default-display-label; sdt-translator->translateFieldAnnotation:56 -> buildSimpleFieldElement). BUG-008 'MERGEFIELD with space' re-confirmed: mergeFieldInstruction (translate-field-annotation.js:38) builds ' MERGEFIELD First Name ' UNQUOTED. Word parses only 'First' (truncates a column whose name has a space). Word requires 'MERGEFIELD "First Name"'. The default field set uses no-space names (FirstName) so the common case works, but any space-containing column name (e.g. from a CSV header) breaks on export.
- **Confirm:** needs-runtime-probe+COM

### RB-032 [S3] Labels (mailings.create.labels) — Mailings › Create
- BUG-060 still live (inert Full-page checkbox). Label cell sizing not oracle-calibrated. Grid does render as a real PM table via createDocFromHTML in paged. Print path is a documented stub.
- **Evidence:** commands.js:1170 -> WC.Mail.labels() (mailings-tools.js:193-203). Builds an Avery grid <table class="wc-labels"> via openHtml. BUG-060 prior re-confirmed: the 'Full page of the same label' checkbox (fullPage, line 196) is NEVER read by buildHTML (line 197) -> always emits the full grid even when unchecked. Word emits a single label when unchecked. Also label cell geometry is dashed-border CSS, not real Avery 5160 dimensions (Word lays out exact label sizes). 'Print' button is a toast stub (line 200).
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-033 [S3] Preview Results (mailings.preview-results.preview-results) — Mailings › Preview Results
- BUG-058 live: composite/rule fields are not resolved during preview. MERGEFIELD preview itself is correct. Live check needed to confirm the in-app paged repaint shows the swapped label.
- **Evidence:** commands.js:1210 -> WC.Mail.previewResults() (mailings-tools.js:149-159) -> WC.PM.mmPreview(map). BUG-058 re-confirmed: mmPreview (mail.ts:28-38) hard-filters to n.attrs.fieldType==='MERGEFIELD' (line 31), so when preview is ON, Address Block, Greeting Line, and rule fields KEEP their «placeholder» instead of showing resolved data (Word resolves all of them in preview). Plain MERGEFIELD preview works (replaces «Name» with the record value via _previewMap/_val). Toggle pressed-state managed manually (not in TOGGLE_MAP, see Highlight note).
- **Confirm:** needs-live-compare

### RB-034 [S3] Bibliography (dropdown: Bibliography / References / Works Cited / Insert Bibliography) — References › Citations & Bibliography
- BUG-062 (title dropped, all 3 identical, no heading) + BUG-031 (re-insert stacks a duplicate). Bibliography also 'renders empty headless' per references.ts ledger A — needsLive to confirm the paged PE paints the bibliography entries (resolved citations) vs an empty block.
- **Evidence:** commands.js:1074-1080 H.bibliography → refInsertBibliography(title). references.ts:617-625 refInsertBibliography(_title) DROPS the title entirely (d.citations.bibliography.insert({at:documentEnd}) with no title slot — the comment at 605-616 explains the fork has no title model and threading it through `style` would corrupt StyleName). So Bibliography/References/Works Cited produce a byte-identical block with NO heading. Confirms BUG-062. Also inserting twice STACKS a duplicate bibliography (no replace-in-place; references.ts always uses documentEnd) — confirms BUG-031 (Bib/ToF stack).
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-035 [S3] Cross-reference (button — Cross-reference dialog) — References › Captions
- BUG-013 S3 export-fidelity (pageNumber → \p collides with aboveBelow; should be PAGEREF) — a FORK fix in crossref-wrappers.ts:229. BUG-039 dialog-coverage gap (2 of 7 types, no checkboxes). needsRuntime to COM-confirm the field code Word reads back.
- **Evidence:** commands.js:445 H.crossReference → crossRefDialogPM (commands.js:1096-1134): Type select (Heading/Bookmark only), Insert-as select (Page number/Text/Above-below), target list → refCrossReference. references.ts:630-643 → d.crossRefs.insert. WRONG-OUTPUT (BUG-013): 'Page number' maps to display:'pageNumber' which the fork (crossref-wrappers.ts:229) emits as 'REF tgt \p' — but \p on a REF field is Word's ABOVE/BELOW switch (crossref-wrappers.ts:230 maps aboveBelow to \p too, and the importer crossReference-translator.js:105 reads \p back as 'aboveBelow'). A 'Page number' cross-ref should emit PAGEREF; here it renders above/below in Word, never the page. Also BUG-039: dialog exposes only 2 of Word's ~7 reference types (no Numbered item/Figure/Table/Equation/Footnote/Endnote) and no 'Insert as hyperlink' / 'Include above/below' checkboxes.
- **Confirm:** needs-runtime-probe+COM

### RB-036 [S3] Custom Table of Contents… dialog (Tab leader select) — References › Table of Contents
- BUG-056 still live: Tab leader is a dead/lying control (dialog→engine wiring drops leader.value). Fix is one line: pass tabLeader from leader.value.
- **Evidence:** commands.js:1016-1035 customTOCDialog builds a 'leader' select (dots/dashes/none) at line 1019 but the OK handler (line 1028-1032) only passes includePageNumbers/showLevels/rightAlignPageNumbers to refInsertTOC — leader.value is NEVER read. references.ts:125 refInsertTOC supports a tabLeader config key, but the dialog never sends it, so every choice yields the default dotted leader. Confirms BUG-056 against current code (the 'show levels' and the two checkboxes DO wire through correctly).
- **Confirm:** code-confirmed

### RB-037 [S3] Insert Endnote (button, Alt+Ctrl+D) — References › Footnotes
- BUG-010 endnote variant. needsLive to verify endnote renders at document end on the paged sheets vs Word, and caret placement.
- **Evidence:** commands.js:1045 H.insertEndnote → refInsertEndnote → insertNote('endnote'), references.ts:212 seeds content='Endnote'. Same literal-seed leak as footnotes (BUG-010). Endnote is roman-numbered at doc end (correct per spec), but the body ships the word 'Endnote' the user never typed.
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-038 [S3] Insert Footnote (button, Alt+Ctrl+F) — References › Footnotes
- BUG-010 still live (literal 'Footnote' seed leaks into export). Also: caret does NOT move into the note body for typing (seed substitutes for that UX). needsLive to confirm the paged PE paints the note at the page foot + caret placement vs Word.
- **Evidence:** commands.js:1044 H.insertFootnote → refInsertFootnote. references.ts:206-218 insertNote('footnote') calls d.footnotes.insert({type,at,content:seed}) where seed='Footnote' (line 212). Word creates an EMPTY note body and moves the caret there. Here the body is pre-seeded with the literal word 'Footnote', which exports as authored content in the .docx. Confirms BUG-010 against current code. The superscript ref + auto-number + per-page paint are otherwise correct.
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-039 [S3] Next Footnote (split button: Next/Prev Footnote, Next/Prev Endnote) — References › Footnotes
- BUG-023 still live and worse than logged: the endnote nav menu items are duplicates of the footnote items (no type filter passed or honored). Word filters by note type.
- **Evidence:** Main button: commands.js:1046 H.nextFootnote → refNextNote() (defaults 'next'). Flyout: commands.js:1706-1715 — 'Next Endnote' calls pm.refNextNote('next') and 'Previous Endnote' calls pm.refNextNote('prev'), i.e. the SAME function as Next/Prev Footnote with NO type argument. references.ts:260-277 refNextNote collects BOTH footnoteReference AND endnoteReference positions with no type filter (line 265). So 'Next Endnote' is byte-identical to 'Next Footnote' and navigation jumps over footnotes and endnotes interleaved. Confirms (and sharpens) BUG-023.
- **Confirm:** code-confirmed

### RB-040 [S3] Style (dropdown: APA/Chicago/IEEE/ISO 690/MLA/Turabian) — References › Citations & Bibliography
- BUG-045 still live: style chosen pre-bibliography is dropped but toasts success. The style does NOT persist as a document/global default (only binds to an existing bibliography node). Word stores the style globally and applies to citations immediately. Style list also incomplete (no Harvard despite docs).
- **Evidence:** commands.js:1073 H.style flyout updates WC.Ref.citationStyle (checkmark state works) then calls WC.PM.refSetCitationStyle(s) and ALWAYS toasts 'Citation style: '+s. references.ts:583-603 refSetCitationStyle finds the FIRST bibliography node and configures it; if NO bibliography exists yet it returns false (line 598) — but the toast fires regardless (commands.js:1073, unconditional). So picking a style before inserting a bibliography is silently lost while the UI claims success. Confirms BUG-045. Also the menu omits Harvard (FEATURES.md/REFERENCES_TAB.md claim Harvard) and the full Word style set ('and more' in ribbon-data).
- **Confirm:** code-confirmed

### RB-041 [S3] Table of Contents (dropdown: Automatic Table 1/2, Manual Table, Custom TOC…, Remove TOC) — References › Table of Contents
- Re-confirms BUG-044 (Automatic Table 1/2 collapse, caption dropped) + BUG-057 (Manual Table harvests headings). Auto-TOC heading collection + page numbers need a paged render check (needsLive) — paged PE has toc-page-number.js so likely paints, but verify entries/leaders/page-nums on real sheets vs Word.
- **Evidence:** commands.js:1002-1015 H.tableOfContents flyout. 'Automatic Table 1' → refInsertTOC({title:'Contents'}); 'Automatic Table 2' → refInsertTOC({title:'Table of Contents'}). references.ts:114-134 refInsertTOC NEVER reads opts.title (only showLevels/hyperlinks/rightAlign/includePageNumbers/tabLeader). So the two presets are byte-identical and the heading caption ('Contents'/'Table of Contents') is dropped — Word renders the chosen heading above the TOC. Confirms BUG-044 against current code. 'Manual Table' → refInsertTOC({showLevels:3}) which still harvests document headings instead of emitting literal 'Type chapter title' placeholder rows (confirms BUG-057). The real TOC engine (toc-entry-builder.ts, toc-page-number.js, toc-bookmark-sync.ts) IS substantial, so the auto-TOC core works; these are fidelity gaps on the gallery presets.
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-042 [S3] Draft — View › Views
- Same dead-#editor root cause as Web/Outline. Draft does not visibly differ from Print in the paged engine.
- **Evidence:** commands.js:1488 H.draft -> WC.PM.setView('draft') + toast. Draft CSS editor.css:326-327 (#workarea.view-draft #editor {box-shadow:none; continuous; max-width:860px}) targets the dead #editor. In paged mode #pm-editor keeps painting page sheets, so Draft produces no visible continuous-flow change (only #ruler/.pagebreak-guide hide, but .pagebreak-guide doesn't exist in paged either). Word's Draft = continuous no-page-sheet simplified view. ribbon-data.js marks draft feasible:'yes' but it is effectively a no-op in the paged engine.
- **Confirm:** needs-live-compare

### RB-043 [S3] Outline — View › Views
- Two defects: dead CSS (no outline rendering) + wrong setActiveView('print') literal. Plus no Outlining contextual tab (separate P2 gap). VIEW_TAB.md still advertises 'headings indented by level with markers, body dimmed' — stale claim.
- **Evidence:** commands.js:1487 H.outline -> WC.PM.setView('outline') + setActiveView('print') + toast. (1) Visual: editor.css:330-337 outline rules (heading indent, ⊟/○ markers, body dimming) all target #editor (dead in paged) — #pm-editor/.superdoc-page get nothing, so headings are NOT indented, no markers, no dimming (BUG-007). (2) State bug: H.outline calls setActiveView('print') (commands.js:1487) so the status bar shows Print Layout active even though WC.PM.view==='outline'. Word's Outline view also adds an Outlining contextual tab with promote/demote/collapse — entirely absent.
- **Confirm:** needs-live-compare

### RB-044 [S3] Side to Side (page movement) — View › Page Movement
- Same #editor-retirement root cause as the view modes. The flex rules touch #pages/#canvas (real) but the layout-producing rule is on dead #editor. Toggling does change scroll-snap on #canvas but produces no usable side-by-side.
- **Evidence:** commands.js:1491 H.sideToSide adds 'movement-side' to #workarea. CSS editor.css:373-377: #workarea.movement-side #canvas/#pages get flex-direction:row, but the column/page-height that creates the book-flip lives on #workarea.movement-side #editor (editor.css:375 columns:var(--page-w)) — the DEAD #editor. In paged mode #pages contains exactly ONE child (#pm-editor, main.ts:35), so flex-direction:row on #pages/#canvas reorders nothing; the .superdoc-page sheets inside #pm-editor still stack vertically. Word flips pages horizontally with scroll-snap. Net: no horizontal page layout, no book-flip — visually dead in the paged engine.
- **Confirm:** needs-live-compare

### RB-045 [S3] Web Layout — View › Views
- Re-confirmed against current paged code: view-mode CSS still points at the dead #editor id. Fix = re-point CSS to #pm-editor/.superdoc-page or have the engine switch layout mode. Grouped bug with Draft/Outline.
- **Evidence:** commands.js:515 H.webLayout -> WC.PM.setView('web') (index.ts:486-491) only adds class 'view-web' to #workarea. ALL web-view CSS targets the RETIRED #editor node: editor.css:318-320 (#workarea.view-web #editor {...}). In the paged engine there is NO #editor element (main.ts:32-35 creates only #pm-editor; create-editor.ts:37 PresentationEditor wipes mountEl and paints .superdoc-page sheets). editor.css:408-413 sets body.pm-active #editor {visibility:hidden} anyway. No rule targets #pm-editor or .superdoc-page for view-web. Net: clicking Web Layout produces NO visible change — pages still render as print sheets. Word reflows to continuous full-width no-page-sheet. Matches stale prior BUG-007.
- **Confirm:** needs-live-compare

## S4 — 9

### RB-046 [S4] Themes (gallery active checkmark) — Design › Document Formatting
- Re-test of BUG-024 (cosmetic, code-confirmed without runtime). The applied font is correct via redefined styles; only the gallery's tick is wrong. Fix: drive isActive from the applied theme name (track last-applied), not the unused --doc-font var.
- **Evidence:** commands.js:787 isActive=(t)=>firstFont(t.body)===currentDocFont(); commands.js:800 currentDocFont() reads getComputedStyle(documentElement)['--doc-font']. --doc-font is defined statically only in base.css:52 ('Aptos',Calibri,...) and is NEVER set by any apply path (grep for setProperty('--doc-font') across src/renderer returns zero writes; deApplyTheme/deApplyFonts in design.ts redefine named styles + docDefaults but do not touch --doc-font). So currentDocFont() always returns 'Aptos' -> the gallery checkmark is permanently stuck on the Office theme regardless of which theme is applied.
- **Confirm:** code-confirmed

### RB-047 [S4] Change Case (5 modes) — Home › Font
- Length-preserving single PM transaction (good). Edge-case fidelity only.
- **Evidence:** commands.js:1937 changeCaseMenu -> commands.ts:53 changeCase. Sentence-case regex commands.ts:58 needs whitespace after terminator ('end.New' not recapitalized); toggle-case commands.ts:59 is locale-naive (Turkish dotless i, German eszett); no Shift+F3 cycle binding. Confirms prior BUG-025. Core upper/lower/caps are correct.
- **Confirm:** code-confirmed

### RB-048 [S4] Increase Font Size (Ctrl+>) — Home › Font
- Matches Word's jump-list 8..72 but does not continue above 72. Cosmetic for normal use.
- **Evidence:** commands.js:50 stepFont(1) walks SIZES list (commands.js:13: 8..72) then sticks at 72; also bounded by the 96pt fork clamp. Word's grow-font continues past 72 (80,90,...) up to 1638. Minor jump-list ceiling deviation.
- **Confirm:** code-confirmed

### RB-049 [S4] Sort — Home › Paragraph
- Date sorting is the only defect; otherwise faithful single-transaction reorder.
- **Evidence:** commands.js:90/2081 sortDialog -> commands.ts:82 sortParagraphs. Type=Date maps to numeric parseFloat (commands.js:2095 numeric:type.value!=='Text'; commands.ts:102), so dates sort by leading number not chronologically. Confirms prior BUG-042. Text/Number sort correct; same-parent contiguity guard.
- **Confirm:** code-confirmed

### RB-050 [S4] Date & Time — Insert › Text
- Dialog inserts a REAL DATE field, but the 'Update automatically' checkbox is IGNORED — it always inserts an updating field. Word inserts STATIC text when the box is unchecked (the dialog's default). Minor wrong-behavior.
- **Evidence:** commands.js:482 H.dateTime / dispatch 1676 -> WC.Insert.dateTimeDialog (insert-features.js:186). The 'Update automatically' checkbox `upd` (line 190) is BUILT but never read; OK onClick (line 193) always calls WC.PM.xeDateTime(fmt) -> bridge/insert-exotica.ts:118 inserts a DATE field unconditionally. Word: unchecked = static text snapshot, checked = field. Also verify the format list (6 entries, line 188) aligns with the OK mapping array (6 entries, line 193).
- **Confirm:** needs-runtime-probe+COM

### RB-051 [S4] Rotate — Layout › Arrange
- Core rotate/flip works and exports correctly (012). Only gap: arbitrary-angle 'More Rotation Options...' dialog missing (S4 minor). Pictures only. Live render of the rotated/flipped image worth a spot-check.
- **Evidence:** commands.js:999 H.rotate -> Rotate Right/Left 90 (setImageTransform({rotate:+/-90})) + Flip Vertical/Horizontal (setImageTransform({flipV/flipH:true})). bridge/insert.ts:500-529 mutates transformData.rotation (a:xfrm rot, normalized mod 360) + horizontalFlip/verticalFlip (export emits truthy flips only). ENGINE_READY has 'rotate'. Spec-kit 012, oracle-validated (rotation=90/flip). MINOR: ribbon-data lists 'More Rotation Options...' (ribbon-data.js:1578) for an arbitrary-angle dialog -- NOT rendered in the handler menu. selectedImage is image-only (Word also rotates shapes/text boxes).
- **Confirm:** needs-live-compare

### RB-052 [S4] Insert Table of Figures (button) — References › Captions
- BUG-031 (ToF double-insert stacks). Field code is correct; entries are layout-resolved. needsLive to confirm the paged PE paints ToF entries with page numbers vs Word. No dialog = gap.
- **Evidence:** commands.js:1049 H.insertTableOfFigures → refInsertTOF('Figure'). references.ts:324-335 inserts a RAW TOC field 'TOC \c "Figure" \h \z' at the caret (inlineTarget). Correct field code. BUG-031: re-inserting STACKS a second ToF (no replace-in-place; index/ToA use a replace path but ToF does not). Also no Table-of-Figures dialog (label chooser, tab leader, show page numbers) — hardcoded to 'Figure'. Entries repopulate in Word on F9/open (ledger C).
- **Confirm:** needs-runtime-probe+COM, needs-live-compare

### RB-053 [S4] Word Count (review.proofing.word-count) — Review › Proofing
- Cosmetic/minor fidelity. Whole-doc counts themselves are accurate (prior batch verified 5 words/23 chars). Selection-scoped count is the missing piece.
- **Evidence:** dialogs.js:264-275 D.wordCount reads only WC.PM.counts() (whole-doc totals) and renders 6 fixed rows. There is no selection-aware 'Words: N of M' line. Word's dialog shows 'Words N' reflecting the current selection when text is selected (and the status bar shows 'N of M'). Matches prior BUG-049 [S4]; unchanged.
- **Confirm:** code-confirmed

### RB-054 [S4] Navigation Pane — View › Show
- Pane works (headings nav). Two defects: (a) checkbox pressed-state never updates [S4 cosmetic 'lying control']; (b) missing Pages-thumbnails + search tabs [P2 gap]. Reads view.dom headings live so it reflects the doc.
- **Evidence:** commands.js:528 H.navigationPane -> WC.Dialogs.navPane() (dialogs.js:297-313) toggles a #nav-pane taskpane listing h1/h2/h3 headings (click scrolls into view). The PANE works. BUG: the control is type:'checkbox' (ribbon-data.js:2558) but H.navigationPane never calls markChecked/markRadio and there is no registered state rule (no registerRibbonRule('navigationPane') anywhere; not in TOGGLE_MAP ribbon.js:35-40). So the checkbox visual NEVER reflects whether the pane is open — a 'lying control' (matches stale prior BUG-050). Also: headings-only — no Pages thumbnail tab and no Results/search tab that Word's Nav Pane has.
- **Confirm:** code-confirmed

