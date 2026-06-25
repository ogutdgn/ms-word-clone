# ms-word-clone — Detailed Bug Documentation

Every confirmed bug, uniformly documented: **Where** (file/function/line + ribbon location) · **When** (trigger + numbered repro) · **Symptom** (Word-expected vs clone-actual) · **Why** (root-cause code mechanism) · **Evidence** · **Solution** (specific fix + effort/risk).

**30 bugs** — 15 S2 · 13 S3 · 1 S4 · 1 S5

| ID | Sev | Title |
|----|-----|-------|
| BUG-001 | S3 | Box-bordered paragraph balloons into a page-tall empty rectangle across a page seam |
| BUG-002 | S3 | Paragraph shading floods the entire rest of the page across a page break |
| BUG-003 | S3 | Image taller than a page bleeds across the page boundary with no clip or seam |
| BUG-004 | S3 | Paragraph shading (w:pPr/w:shd) is mis-imported as a run-level highlight, so on round-trip the text gains a spurious w:highlight matching the shading fill |
| BUG-005 | S2 | Restrict Editing read-only is bypassed by ribbon/programmatic writes (cmd() path has no protection guard) |
| BUG-006 | S2 | Style Set gallery is inert: all 9 named sets apply identical default spacing |
| BUG-007 | S2 | Outline/Draft/Web views are visually dead (CSS targets retired #editor id; headings render as p[styleid]) and Outline wrongly lights the Print status chip |
| BUG-008 | S2 | Mail-merge field codes export with invalid operators, literal guillemets, and all dialog switches/parameters dropped |
| BUG-009 | S2 | All 6 Cover Page designs insert the same generic 3-line block (banding/color/shapes lost) |
| BUG-010 | S3 | Insert Footnote/Endnote seeds the note body with the literal word "Footnote"/"Endnote" |
| BUG-011 | S2 | Apply Theme changes body font but NOT headings (linked Heading*Char styles keep asciiTheme=majorHAnsi) |
| BUG-012 | S3 | Internal-document hyperlink (#anchor) exports as a broken EXTERNAL relationship; no 'Place in This Document' |
| BUG-013 | S3 | Cross-reference "Page number" exports REF \p (Word's above/below switch) instead of PAGEREF |
| BUG-014 | S2 | Font Size silently clamps to 8-96 pt (Word allows 1-1638) |
| BUG-015 | S3 | Non-keyword highlight color exports as w:shd character shading, not w:highlight |
| BUG-016 | S3 | Convert Text to Table (Insert) is a dead toast over a working PM.textToTable bridge |
| BUG-017 | S5 | Format Painter double-click lock CAN be cancelled with Esc — ledger entry is STALE / no longer reproduces |
| BUG-018 | S2 | Replace (Ctrl+H) permanently hides Match case / Whole words / Use wildcards (advanced=undefined) |
| BUG-019a | S2 | Pens-gallery active-tile highlight reads WC.Draw.pen.id, which is never updated — only the first "Pen" tile ever highlights |
| BUG-019b | S2 | Drawing toggle never latches (no ribbon rule) and Pens flyout always reads "Start Drawing" (WC.Draw.enabled never set) |
| BUG-019c | S2 | Eraser point/segment-erase deletes the entire stroke (no split) — only whole-stroke erase exists |
| BUG-019d | S3 | Custom Pen forces opacity 1 (no translucent highlighter) and dSetPen never sets tool='pencil' |
| BUG-020 | S2 | File > Close creates a new blank document instead of closing the current one |
| BUG-021 | S2 | Mailings → Go to Record spinner mis-rendered as a paragraph-indent spinner (indent icon, pt unit, step 6, default 0) |
| BUG-022 | S2 | Mark Entry (index) calls refMarkIndexEntry() with no dialog/args — silent no-op without a selection |
| BUG-023 | S3 | Next/Previous Endnote navigates footnotes too (no note-type filter) |
| BUG-024 | S4 | Themes gallery active checkmark stuck on Aptos/Office (reads static --doc-font) |
| BUG-025 | S3 | Change Case: sentence-case regex needs space after terminator, toggle is locale-unaware, no Shift+F3 |
| BUG-WATERMARK | S2 | Watermark is preview-only CSS (dropped on save); Custom dialog lacks Picture/font/size/transparency |
| SHAPES-STUB | S3 | Insert > Shapes gallery is fully rendered but every shape click is a dead toast (nothing inserted) |

---

## BUG-001 — Box-bordered paragraph balloons into a page-tall empty rectangle across a page seam  
**Severity:** S3

**Where**
: Ribbon: Home > Paragraph group > Borders split button. Render path: src/renderer/pagination/pagination.ts — placeForcedSeam (lines 369-381) and the auto line-split emitSeam (lines 332-337, invoked from solve() line 456) inject a `pm-page-spacer` <div> at a PM position INSIDE the paragraph. The border CSS is applied by src/renderer/core/superdoc-fork/extensions/paragraph/ParagraphNodeView.js#updateDOMStyles (lines 184-197) via encodeCSSFromPPr in core/super-converter/styles.js (border-left/right/top/bottom at lines 360-369).

**When / repro**
: Trigger: a bordered paragraph spans a page boundary, via a mid-paragraph manual break or auto overflow. Repro: 1) Type a paragraph of text. 2) Home > Paragraph > Borders > All Borders. 3) Place the caret in the middle of that paragraph and press Ctrl+Enter (manual page break) — OR make the paragraph long enough (>~1 page) to overflow. 4) Observe page 1: the border box stretches from the text down to the page bottom and across the gray gap instead of closing under the last visible line. Probe C:\tmp\bughunt\probes\borders-visual.js; screenshot C:\tmp\bughunt\borders-visual.png.

**Symptom (Word vs clone)**
: Home > Paragraph > Borders. A paragraph with All Borders (or any box border) that crosses a page boundary should, in Word, close the border under the last line on page 1 and reopen around the continuation at the top of page 2. In the clone the border box balloons into a page-tall empty rectangle: it stays open and stretches all the way down to the bottom of page 1, enclosing the inter-page gap, and never reopens on page 2. The user sees a giant empty bordered box swallowing the page tail. Export OOXML (w:pBdr) is correct — render-only.

**Why it happens (root cause)**
: Pagination places the page seam as a `pm-page-spacer` block <div> at a PM position that lands INSIDE the bordered <p> (placeForcedSeam for mid-paragraph breaks via Decoration.widget at the inline break pos; the auto line-split emitSeam anchors at a posAtCoords-derived position inside the paragraph, buildDecorations line 520-530). ParagraphNodeView.#updateDOMStyles writes the border directly onto `this.dom` (the <p>) — border-top/right/bottom/left from encodeCSSFromPPr (styles.js:360-369). Because the spacer is a child of the <p>, the CSS border box encloses the spacer's full (page-tall) height, so the border wraps down to the page bottom. There is no logic to close the border at the seam and re-open it on the continuation; the paragraph remains one DOM <p> with one continuous border box.

**Evidence**
: Ledger BUG-001: screenshot shows the page-tall empty box; model probe home-borders2.json `seams:0, bands:1` (band rendered inline inside the bordered paragraph); export OOXML correct. Code: pagination.ts buildDecorations lines 520-530 (Decoration.widget at break pos inside the <p>); ParagraphNodeView.js:189-197 applies encodeCSSFromPPr output to this.dom; styles.js:360-369 emits border-* on the paragraph element. deferrals.md §A.1b confirms the in-<p> spacer remains for placeForcedSeam + findLineSplit/emitSeam.

**Solution**
: Files: src/renderer/pagination/pagination.ts (seam placement) + a new paragraph-decoration painter (frames-overlay keystone). Approach: stop relying on the <p>'s own border/background box to span a seam. Either (a) when a seam falls inside a bordered paragraph, split the paragraph's border rendering — close it above the spacer and re-open below — by painting borders as overlay decorations (an absolutely-positioned frame around each page-fragment's line boxes) instead of CSS border on the single <p>; or (b) move the seam to a coords-safe block boundary and render the bordered continuation as a separate decorated fragment. The robust fix is the frames-overlay/paged-layout engine that splits, clips and re-opens a block across a seam (it resolves BUG-001/002/003 + table overflow together). Effort: L. Risk: high — touches the core layout engine and the caret-safe seam invariant; must keep posAtCoords stable and exports untouched.

---

## BUG-002 — Paragraph shading floods the entire rest of the page across a page break  
**Severity:** S3

**Where**
: Ribbon: Home > Paragraph group > Shading split button. Render path: same seam injection in src/renderer/pagination/pagination.ts (placeForcedSeam lines 369-381 / emitSeam lines 332-337 line-split). Background CSS applied by ParagraphNodeView.js#updateDOMStyles (lines 184-197) via encodeCSSFromPPr in core/super-converter/styles.js line 381-382 (`css['background-color'] = '#'+shading.fill`).

**When / repro**
: Trigger: a shaded paragraph spans a page boundary. Repro: 1) Type a paragraph. 2) Home > Paragraph > Shading > pick any fill (e.g. yellow). 3) Put the caret mid-paragraph and press Ctrl+Enter — OR let a shaded paragraph overflow the page. 4) Observe: the fill covers the entire bottom of page 1 (full-width colored block down to the bottom margin) instead of ending under the last shaded line. Probe C:\tmp\bughunt\probes\home-misc.js; screenshot C:\tmp\bughunt\home-misc-shade-break.png.

**Symptom (Word vs clone)**
: Home > Paragraph > Shading. A shaded paragraph crossing a page boundary should, in Word, fill only its own text lines — ending under the last shaded line on page 1 and resuming around the continuation on page 2. In the clone the fill floods the entire remainder of page 1: a full-width colored rectangle from the text down to the bottom margin (and across the gray gap). Visually more severe than BUG-001 because it is a solid fill, not just an outline. Shading export (w:shd) is correct — render-only.

**Why it happens (root cause)**
: Identical mechanism to BUG-001. The page seam is a `pm-page-spacer` block <div> placed at a PM position INSIDE the shaded <p> (placeForcedSeam / line-split emitSeam → buildDecorations Decoration.widget, pagination.ts:520-530). ParagraphNodeView.#updateDOMStyles sets `background-color` directly on the <p> from encodeCSSFromPPr (styles.js:381-382). A child element inherits its parent's background box, so the spacer's full page-tall height is painted with the paragraph's fill — flooding the page tail. There is no per-fragment background; the whole paragraph is one <p> with one background box spanning the seam.

**Evidence**
: Ledger BUG-002: screenshot (giant colored block); home-misc.json `shadeAcrossBreak.pageCount=2`; shading OOXML export correct (w:shd). Code: styles.js:381-382 sets background-color on the paragraph; ParagraphNodeView.js:189-197 applies it to this.dom; pagination.ts buildDecorations 520-530 injects the spacer inside the <p>. Ledger 'Keystone cluster note' groups this with BUG-001/003 as one root cause.

**Solution**
: Same fix as BUG-001 (one change resolves both). Files: src/renderer/pagination/pagination.ts + frames-overlay painter. Approach: paint paragraph shading per page-fragment (an absolutely-positioned background rect behind each fragment's line boxes) rather than as CSS background on the single spanning <p>, so the fill stops at the seam and resumes on page 2; or split the seam to a block boundary and render the continuation as a separately-decorated fragment. Effort: L. Risk: high — core layout-engine change; must preserve caret/posAtCoords stability and leave w:shd export untouched. Group with BUG-001/003 as the single frames-overlay keystone fix.

---

## BUG-003 — Image taller than a page bleeds across the page boundary with no clip or seam  
**Severity:** S3

**Where**
: Ribbon: Insert > Illustrations > Pictures. Layout path: src/renderer/pagination/pagination.ts — solve()'s auto-overflow loop (lines 447-467). An unsplittable block taller than contentH that starts at the page top falls through to the `pagesDone++; pageStartNat += g.contentH` branch (lines 464-466) — it advances the page count but emits no seam and never moves or clips the block. No clipping CSS exists for the image (src/renderer/public/styles/editor.css has no max-height/overflow:hidden on the inline-image container).

**When / repro**
: Trigger: an inline image taller than the content area (~>864px content height; e.g. ~1100px). Repro: 1) New doc. 2) Insert > Pictures and insert (or resize to) an image taller than one page. 3) Observe page 1: the image paints from the top straight down past the page-1 content bottom, across the gray gap, into page 2 with no clip and no seam at the boundary. Probe C:\tmp\bughunt\probes\img-pagination.js; screenshot C:\tmp\bughunt\img-tall.png; img-pagination.json IMG_TALL = top 115 → bottom 1215, seam 1070.

**Symptom (Word vs clone)**
: Insert > Pictures. An inline image taller than the page content area should, in Word, never be split — it is clipped at the page bottom and does not continue across the inter-page gap. In the clone the over-tall image paints continuously from the top of page 1 down across the page seam (img bottom y1215 vs seam y1070 — ~256px past the page-1 content bottom) and into the gray inter-sheet gap, with no clip and no clean page boundary. The page count shows 2 but the object visually overflows the sheet.

**Why it happens (root cause)**
: In solve(), the overflow `while` loop (pagination.ts:447) tries to split the block: isLineSplittable() (line 265-267) returns false for an image container (not P/Hn/LI/BLOCKQUOTE/PRE), so findLineSplit is skipped. The wholesale-move branch only fires when the block does NOT start at the current page top (`b.natTop - pageStartNat > EPS`, line 460); a too-tall image that begins at the page top fails that test, so control reaches lines 464-466 which merely do `pagesDone++; pageStartNat += g.contentH` to avoid an infinite loop — no seam is pushed and the block is never relocated or clipped. The DOM image keeps its natural height with no overflow:hidden, so it renders straight through the seam region. Pagination cannot split or clip a single block taller than a page.

**Evidence**
: Ledger BUG-003 + img-pagination.json IMG_TALL (top 115 → bottom 1215, seam 1070 → 256px past content bottom); IMG_BOUNDARY confirms a short image at a boundary correctly moves (so only the over-tall case fails). Code: pagination.ts:447-467 overflow loop with the no-op advance at 464-466; isLineSplittable 265-267 excludes images; editor.css has no clip on the image container. deferrals.md §A.1b: 'A single block taller than one page that can't be line-split … overflows the sheet without a seam and the page count is best-effort.'

**Solution**
: Files: src/renderer/pagination/pagination.ts (solve overflow loop) + the frames-overlay/paged-layout engine; optionally a clip wrapper in editor.css. Approach: when an unsplittable block exceeds contentH, Word's behaviour is to clip at the page bottom (image is not split). Minimal mitigation: emit a seam before the block when it doesn't fit and CSS-clip the on-page fragment (overflow:hidden on a per-page frame) so it doesn't bleed into the gap. The faithful fix is the frames-overlay engine that lays each block into page frames and clips/relocates over-tall objects. Effort: M for a clip-only mitigation, L for the full engine. Risk: medium-high — interacts with image-resize overlays and caret geometry; verify against Word (clip, no split). Group with BUG-001/002 as the single keystone.

---

## BUG-004 — Paragraph shading (w:pPr/w:shd) is mis-imported as a run-level highlight, so on round-trip the text gains a spurious w:highlight matching the shading fill  
**Severity:** S3

**Where**
: Home > Paragraph shading (and any imported doc with paragraph w:shd). Root cause spans three files in the vendored SuperDoc fork: (1) C:/Users/ogutd/bughunt-wt/src/renderer/core/superdoc-fork/core/super-converter/SuperConverter.js:139 (markTypes table); (2) C:/Users/ogutd/bughunt-wt/src/renderer/core/superdoc-fork/core/super-converter/v2/importer/importerHelpers.js:28-34 (parseProperties parses pPr marks); (3) C:/Users/ogutd/bughunt-wt/src/renderer/core/superdoc-fork/core/super-converter/v3/handlers/w/p/helpers/legacy-handle-paragraph-node.js:138-142 (pushes those marks onto every child run). Helper: markImporter.js:301-306 getHighLightValue; exporter: v3/handlers/w/highlight/highlight-translator.js:23-54.

**When / repro**
: Trigger: any paragraph carrying w:shd in its w:pPr (paragraph shading), then a save+reopen. Repro: 1) New doc, type a line of text. 2) Select the paragraph and apply paragraph shading fill FFFF00 (yellow) via Home shading, producing <w:pPr><w:shd w:fill="FFFF00"/></w:pPr>. 3) exportDocxBytes() then openDocx(bytes) (i.e. save and reopen). 4) Inspect the reimported run rPr (probe C:/tmp/bughunt/probes/highlight-locate.js): the run now carries <w:highlight w:val="yellow"/>. 5) Save+reopen again -> highlight persists/compounds (highlight count 1->2 on a mixed doc). A pure run highlight in isolation round-trips 1->1->1, isolating w:shd as the trigger.

**Symptom (Word vs clone)**
: Word: a shaded paragraph round-trips as paragraph shading only (w:shd in pPr); its text gets NO highlight. Clone-actual: after export -> reopen, the paragraph's text gains a run highlight (w:highlight) whose color equals the shading fill (FFFF00 shading -> yellow highlight; 92D050 -> green) while ALSO keeping the w:shd. Visibly changes shaded documents, and it compounds on every save+reopen.

**Why it happens (root cause)**
: markTypes maps BOTH w:highlight and w:shd to {type:'highlight', mark:'highlight', property:'color'} (SuperConverter.js:138-139). On import, legacy-handle-paragraph-node.js:135 calls parseProperties(node); parseProperties (importerHelpers.js:28-34) runs parseMarks over the paragraph's w:pPr elements, so the paragraph's w:shd produces a highlight mark. getHighLightValue (markImporter.js:301-303) reads w:fill ('FFFF00') and returns '#FFFF00'. parseProperties only copies these marks to paragraph ATTRS for w:p (importerHelpers.js:45-53) but still RETURNS the marks array; legacy-handle-paragraph-node.js:138-142 then does el.marks.push(...marks) onto EVERY child run. Those runs now hold a highlight mark, which the highlight exporter (highlight-translator.js:48-52) decodes to <w:highlight w:val="yellow"/>. The shading round-trips correctly as pPr/w:shd, but the duplicated highlight mark becomes a real, permanent run highlight on the next open.

**Evidence**
: highlight-locate.json: before.hlRuns=[only the intentionally-highlighted run]; after.hlRuns adds the two shaded paragraphs' text with highlight == their fill; hlContexts[1] shows a <w:pPr><w:shd .../></w:pPr> paragraph whose run now carries <w:highlight w:val="yellow"/>. Confirmed across FFFF00->yellow and 92D050->green; pure highlight stays 1->1->1. Code facts: SuperConverter.js:139 'w:shd' -> highlight; markImporter.js:301-306 reads w:fill; legacy-handle-paragraph-node.js:140 el.marks.push(...marks); highlight-translator.js:60 also confirms a highlight mark with a non-keyword hex would even export as w:shd, but a keyword fill exports w:highlight.

**Solution**
: Stop pPr-level w:shd from becoming a run highlight mark. Preferred (S): in importerHelpers.js parseProperties, exclude 'w:shd' (paragraph shading) from the paragraph-properties branch by adding it to disallowedParagraphProperties (line 29) so parseMarks at line 34 never emits a highlight from pPr shd; paragraph shading is already preserved via attributes['paragraphProperties']=paragraphProperties (line 41) and re-exported from pPr. This leaves RUN-level w:shd (inside w:rPr) -> highlight intact, since that path uses the runProperties branch (line 24-26). Alternative (S): in legacy-handle-paragraph-node.js:138-142, do not push paragraph-derived highlight marks onto child runs (filter marks where type==='highlight' before el.marks.push). Risk: low; ensure genuine character shading (w:rPr/w:shd) and intentional run highlights still round-trip. Add a regression test in scripts/test-suite-pm.js: shade a paragraph, export->openDocx, assert no run carries a highlight mark and the pPr still has w:shd. Effort S; coordinate with whichever path (v2 parseProperties vs v3) the active importer uses.

**Related:** Shares the w:shd/w:highlight conflation root with the audit Text-Highlight-Color bug (commands.js:1490 / highlight-translator.js:48-66), where out-of-palette highlight colors export as w:shd; both stem from w:shd and w:highlight being treated as interchangeable.

---

## BUG-005 — Restrict Editing read-only is bypassed by ribbon/programmatic writes (cmd() path has no protection guard)  
**Severity:** S2

**Where**
: Review tab > Protect group > Restrict Editing. Enforcement: src/renderer/public/js/dialogs.js:914-923 (D.restrictEditingPane start handler -> p.getEditor().setEditable(false,false)). The unguarded write path: src/renderer/bridge/commands.ts:11-18 cmd() and :21-30 chain(). The editable enforcement itself: src/renderer/core/superdoc-fork/extensions/editable.js (Editable extension) and src/renderer/core/superdoc-fork/core/Editor.ts:2291 setEditable.

**When / repro**
: 1. Open any document and type a few words. 2. Review tab > Restrict Editing; in the pane keep mode 'No changes (Read only)' and click 'Yes, Start Enforcing Protection'. 3. Toast says 'the document is read-only' and typing into the page now does nothing (correct). 4. Select some text and click Home > Bold (or change Font Size, or Insert > Table). 5. Observe the formatting/insert IS applied — the supposedly read-only document was mutated. 6. Save: the change persists, proving it was a real transaction, not a preview.

**Symptom (Word vs clone)**
: Word: starting 'No changes (Read only)' protection blocks ALL edit paths until you Stop Protection. Clone: after starting read-only protection the document only refuses keyboard/mouse/paste edits typed INTO the page; ribbon buttons (Bold, font, alignment, Insert table/picture, Find&Replace, style apply, etc.) and any programmatic command still mutate the 'protected' document. Result: a read-only doc is not actually read-only — the user can keep changing it via the ribbon.

**Why it happens (root cause)**
: setEditable(false) calls setOptions({editable:false}) + view.setProps({}) (Editor.ts:2291-2304). The Editable extension (editable.js) only sets the PM prop editable:()=>editor.options.editable and registers handleDOMEvents (beforeinput, mousedown, paste, drop) + handleKeyDown that preventDefault when not editable. Those hooks gate ONLY user-originated DOM input and the contentEditable flag. Ribbon handlers H[cmd] drive WC.PM via installCommands' cmd()/chain() (bridge/commands.ts:11-30), which call editor.commands[name](...)/editor.chain().run() -> view.dispatch(tr) directly. dispatch never passes through handleDOMEvents/handleKeyDown, and cmd()/chain() contain NO editable/protected check (grep of bridge/commands.ts: only 'readonly' as a TS type annotation at :144). So every programmatic transaction lands regardless of editable state.

**Evidence**
: dialogs.js:921 p.getEditor().setEditable(false,false); editable.js Editable extension blocks only handleDOMEvents/handleKeyDown/handlePaste/handleDrop via editor.options.editable; bridge/commands.ts:11-18 cmd() and :21-30 chain() dispatch with no guard (grep 'editable|protected' -> no guard, only 'readonly any[]' type at :144); WC.PM.cmd is the spread cmd() (index.ts:278,455) used by all ribbon H[cmd] handlers. **Re-confirmed at runtime 2026-06-17** — probe `C:\tmp\bughunt\probes\restrict-editing-leak.js` (`restrict-editing-leak.json`): with `view.editable===false` (`enforcedReadOnly:true`), `WC.PM.cmd('toggleBold')` raised bold-marked text-node count 0→1 (`formatLeaked:true`).

**Solution**
: Add a protection gate at the single chokepoint. In src/renderer/bridge/commands.ts, make cmd() and chain() early-return false when editor.options.editable===false (and not in an allowed mode), EXCEPT for an allowlist of navigation/selection/clipboard-copy commands. Better: introduce a WC.pmProtect state ('readonly'|'tracked'|null) set by dialogs.js restrict pane, and have cmd()/chain() consult it (readonly => block all mutating verbs; tracked => already handled by pmTrackLock). Wire dialogs.js:914-923 to set/clear that flag alongside setEditable. Add a regression test in scripts/test-suite-pm.js: setEditable(false) then assert WC.PM.cmd('bold')===false and doc unchanged. Effort: M. Risk: M — must not block legitimate read-only-allowed ops (scroll/select/copy, and Stop Protection itself); needs a curated allowlist and care that the bridge focus.ts/state-sync paths aren't broken.

**Related:** BUG-007

---

## BUG-006 — Style Set gallery is inert: all 9 named sets apply identical default spacing  
**Severity:** S2

**Where**
: Ribbon: Design tab > Document Formatting group > Style Sets gallery. Gallery name list: src/renderer/public/js/design-tools.js:102 (STYLE_SETS = ['Default','Basic (Simple)','Basic (Elegant)','Lines (Distinctive)','Shaded','Casual','Centered','Word 2010','Word 2013']). Click wiring: commands.js styleSetGallery() at 705-722 (line 717 calls WC.PM.deApplyStyleSet(name) with the gallery name). Mapping: src/renderer/bridge/design.ts deApplyStyleSet() lines 103-116.

**When / repro**
: 1. Open the app. 2. Design tab > click Style Sets gallery dropdown. 3. Click 'Lines (Distinctive)'. 4. Note spacing/headings. 5. Click 'Shaded', then 'Word 2013'. Result: all three apply identical Normal spacing (before 0/after 160/line 259); headings are never restyled. None matches Word.

**Symptom (Word vs clone)**
: Design > Document Formatting > Style Sets gallery shows 9 cells (Default, Basic (Simple), Basic (Elegant), Lines (Distinctive), Shaded, Casual, Centered, Word 2010, Word 2013). In Word each restyles Title/Headings/Normal differently (fonts, sizes, colors, spacing, e.g. Lines adds heading underlines, Shaded shades headings). In the clone every one of the 9 cells produces the EXACT same result: Normal spacing before 0 / after 160 twips / line 259 auto. The user sees no difference between any style set, and the 3 presets that actually work are unreachable here.

**Why it happens (root cause)**
: design.ts:106-110 defines SETS keyed ONLY on 'No Paragraph Space'/'Compact'/'Double'. Line 111: preset = SETS[name] || { paragraph:{ spacing:{ before:0, after:160, line:259, lineRule:'auto' } } }. The gallery passes one of the 9 STYLE_SETS names, NONE of which is a key in SETS, so SETS[name] is always undefined and every call hits the fallback. The 9 gallery names and the 3 map keys have zero intersection, so the map is dead and the 3 real presets are unreachable from this gallery. The handler also only ever touches Normal spacing — it never restyles headings/Title at all.

**Evidence**
: Source: design-tools.js:102 (9 gallery names) vs design.ts:106-111 (3-key SETS + ||fallback). No key overlap. Ledger BUG-006 confirms static-source analysis; spec DSGN-03.

**Solution**
: Build a real name->preset map in design.ts deApplyStyleSet() (or a shared table in design-tools.js) keyed on the 9 gallery names, each redefining Title/Heading1-3/Normal (run font/size/color + paragraph spacing/borders) per Word's built-in style sets — reuse the existing redefineNamedStyles updates path (themeUpdates pattern) instead of only Normal spacing. Minimum viable: at least give each of the 9 distinct spacing/font presets so they visibly differ. Effort M (data tables + wire heading updates). Risk: low; export already supported via redefineNamedStyles. Add a regression test asserting two different sets yield different Normal/Heading spacing.

---

## BUG-007 — Outline/Draft/Web views are visually dead (CSS targets retired #editor id; headings render as p[styleid]) and Outline wrongly lights the Print status chip  
**Severity:** S2

**Where**
: View tab > Views group (Outline/Draft, status-bar Web/Read/Print). Handlers: src/renderer/public/js/commands.js:1340 (H.outline), :1341 (H.draft), :421 (H.webLayout). View toggling: src/renderer/bridge/index.ts:416-422 setView (adds view-<v> class on #workarea). Dead CSS: src/renderer/public/styles/editor.css:326-350 (all view-web/view-draft/view-outline rules select #editor, not #pm-editor). Heading render: extensions/paragraph/paragraph.js:225-226 renderDOM and ParagraphNodeView.js:64,166-167. Status chip: public/js/statusbar.js:24,50 (no outline/draft button).

**When / repro**
: 1. Open a doc with a Heading 1 and some body text. 2. View tab > click Outline. 3. Observe: page sheet/ruler/shadow unchanged; no indentation, no outline bullets, no Outlining tab; only a toast 'Outline view'. 4. Look at the status bar bottom-right: the 'Print Layout' icon is highlighted as active even though you chose Outline. 5. Click Draft (View tab) or Web Layout (status bar) — again no visible change to the sheet. 6. Inspect the heading element: it is <p styleid="Heading1">, not <h1>.

**Symptom (Word vs clone)**
: Word: View > Outline gives a true outline (indented promote/demote tree + an Outlining contextual tab); Draft hides page chrome; Web reflows to window width. Clone: choosing Outline, Draft, or Web changes NOTHING visible — the page sheet, ruler, shadows and margins all stay exactly as Print Layout (only a transient toast appears). No Outlining tab appears. Worse, switching to Outline lights the 'Print Layout' button in the status bar, so the active-view indicator lies.

**Why it happens (root cause)**
: setView (index.ts:416-422) only does workarea.classList.add('view-'+v). Every restyle rule for those classes lives at editor.css:326-350 and is scoped to '#editor' — the RETIRED legacy element id. The live PM editor is '#pm-editor' (only show-marks/show-grid/page-spacer rules were ported to it, css:469-470,527-528), so none of the view-* rules match any element. Even the tag-based outline rules (css:345-348 '#editor h1/h2/h3') would still miss, because paragraph.js renderDOM always returns ['p',...] (line 226) and ParagraphNodeView creates document.createElement('p') (line 64) with the style exposed as a 'styleid' attribute (line 167) — a Heading 1 is <p styleid="Heading1">, never <h1>. Separately, H.outline (commands.js:1340) calls StatusBar.setActiveView('print'); the status bar only has read/print/web buttons (statusbar.js:24) so 'print' lights instead of an outline indicator. No Outlining contextual tab exists in ribbon-data.js.

**Evidence**
: editor.css:326 '#workarea.view-web #editor{...}', :339 view-draft #editor, :343-350 view-outline #editor (+ #editor h1/h2/h3); ported PM rules only at css:469-470,527-528; paragraph.js:226 renderDOM returns ['p',...]; ParagraphNodeView.js:64 createElement('p'), :166-167 setAttribute('styleid', Heading1); index.ts:419-420 add view-<v>; commands.js:1340 setActiveView('print'); statusbar.js:24 views=[read,print,web], :50 setActiveView toggles only those.

**Solution**
: Two parts. (1) Re-scope the view CSS: in editor.css duplicate/port the view-web/view-draft/view-outline blocks (326-350) to 'body.pm-active #workarea.view-* #pm-editor', and replace the tag selectors '#editor h1/h2/h3' with attribute selectors 'p[styleid^="Heading"]' (and the body rule to 'p:not([styleid^=Heading])') so outline indentation/bullets actually apply. (2) Fix the status chip: change commands.js:1340 to NOT call setActiveView('print') for outline/draft (either add outline/draft buttons in statusbar.js:24 or clear the active state). Effort: S-M (mostly CSS). Risk: S for CSS; M if a real Outlining tab + promote/demote is wanted (out of scope here — file separately). Add a smoke assertion that setView('web') sets a measurable width change on #pm-editor.

**Related:** BUG-020

---

## BUG-008 — Mail-merge field codes export with invalid operators, literal guillemets, and all dialog switches/parameters dropped  
**Severity:** S2

**Where**
: Ribbon: Mailings → Write & Insert Fields → Rules (If…Then…Else / Next Record If / Skip Record If), Greeting Line, Address Block, Insert Merge Field. Code: IF dialog builder src/renderer/public/js/commands.js ifThenElseDialog() lines 1044-1060 (operator labels at :1046, code string at :1057); Rules NEXTIF/SKIPIF onClicks commands.js:1040,1042. Bridge src/renderer/bridge/mail.ts: mmInsertRule:22, mmAddressBlock:20, mmGreetingLine:21, mmInsertField:19 (all parameterless). Export translator src/renderer/core/superdoc-fork/core/super-converter/v3/handlers/w/sdt/helpers/translate-field-annotation.js mergeFieldInstruction() lines 35-43, code sets at 13-17.

**When / repro**
: Repro IF: 1) Mailings → Rules → If…Then…Else…; 2) Field name Balance, Comparison 'Equal to', Compare to 0, Then 'Paid', Else 'Due', OK; 3) Save .docx, open in Word → field shows !Syntax Error, never evaluates. Repro MERGEFIELD: 1) Insert Merge Field on a column named 'First Name'; 2) save; 3) Word merges only 'First'. Repro NEXTIF/SKIPIF: 1) Rules → Skip Record If…; 2) save → instrText is bare ' SKIPIF ' with no condition; merge skips nothing. Repro switches: insert Greeting Line / Address Block with any non-default dialog options; save → all switches absent.

**Symptom (Word vs clone)**
: In Word, Mailings authoring produces evaluable field codes: IF «Balance» = "0" "Paid" "Due"; GREETINGLINE \f "…" \l 0 \e "…"; ADDRESSBLOCK \f "…" \c 1; MERGEFIELD "First Name". The clone instead emits IF «Balance» Equal to "0" "Paid" "Due" (human label "Equal to" + literal guillemets, no nested MERGEFIELD → Word shows !Syntax Error and the merge never evaluates), bare GREETINGLINE / ADDRESSBLOCK with every switch silently dropped (ADDRESSBLOCK's cached result run is the literal «AddressBlock» placeholder), an unquoted MERGEFIELD First Name (Word parses only "First", truncating the column), and Rules ▸ Next/Skip Record If insert a condition-less bare NEXTIF/SKIPIF. Every merge built on these fields is functionally broken in Word.

**Why it happens (root cause)**
: Two-stage loss. (1) Authoring: ifThenElseDialog (commands.js:1057) concatenates the <select> human label op.value ('Equal to') and wraps the field name in literal « » into a plain string, then mmInsertRule(code,code) stores it as the annotation's displayLabel ('{ '+code+' }', mail.ts:22). mmAddressBlock/mmGreetingLine/mmInsertField (mail.ts:19-21) take no dialog state at all — they hard-code the placeholder label and a fixed fieldType, so greeting word / name format / punctuation / fallback and address-block switches never reach the model. (2) Export: mergeFieldInstruction (translate-field-annotation.js:35-43) for RULE codes does inner = label.replace(/^\{\s*|\s*\}$/g,'') and returns instr=inner verbatim — it never parses operators, never escapes, never wraps a nested MERGEFIELD, so 'Equal to' and the guillemets pass straight through to w:instrText. For MERGEFIELD (:38) it builds `MERGEFIELD ${name}` with no quoting, so a name with a space is unquoted. For GREETINGLINE/ADDRESSBLOCK (:39-40) it returns instr=code bare (no \f/\l/\e/\c), and ADDRESSBLOCK's cached text is the literal placeholder label. NEXTIF/SKIPIF ∈ EMPTY_FIELD_CODES (:14) → buildEmptyComplexFieldRuns(instr) (:27-34) emits ` NEXTIF ` / ` SKIPIF ` with no operands.

**Evidence**
: Code-confirmed: commands.js:1046 op options are word labels; :1057 builds 'IF «'+fld+'» '+op.value+' "v" ...'. mail.ts:19-22 fns take no dialog params. translate-field-annotation.js:38 returns `MERGEFIELD ${name}` unquoted; :41-42 RULE strips braces and returns inner literally; :39-40 ADDRESSBLOCK/GREETINGLINE return bare code with cached=label. Audit spec-batch3.json MAILINGS captured exact instr 'IF «Balance» Equal to "0" "Paid" "Due"', bare ' GREETINGLINE ', ' ADDRESSBLOCK ' with ADDRESSBLOCK_cachedLiteral:true, ' MERGEFIELD First Name '. NEXTIF/SKIPIF ∈ EMPTY set (:14) → bare runs.

**Solution**
: Two files. (A) Authoring — commands.js: in ifThenElseDialog map operator labels to Word symbols (Equal to→=, Not equal to→<>, Greater than→>, Less than→<) and emit the field name as a nested MERGEFIELD rather than literal « » (the annotation/exporter must support a compare expression of `IF {MERGEFIELD Balance} = "0" "Paid" "Due"`); give Next/Skip Record If real comparison dialogs (field/op/value) like the IF dialog instead of insertField('NEXTIF'/'SKIPIF'); add dialog params to mmAddressBlock/mmGreetingLine (and mail.ts:20-21) so format/punctuation/fallback switches are carried as annotation attrs. (B) Export — translate-field-annotation.js mergeFieldInstruction: quote MERGEFIELD names containing whitespace (`MERGEFIELD "First Name"`); build GREETINGLINE/ADDRESSBLOCK instr from the carried switch attrs (\f/\l/\e/\c); and for RULE fields parse the operator/operands so nested MERGEFIELDs and valid operators are emitted, not the literal label. Effort L (dialogs + bridge + exporter, plus a switch-attr schema). Risk M — touches the shared exporter; gate with a roundtrip test asserting Word-valid instr for each field type.

**Related:** Extends per ledger note: NEXTIF/SKIPIF condition-less fields (audit) roll into BUG-008. MERGEFIELD name-escaping is MAIL-05. mmBuildMerge (mail.ts:39-57) also has no SKIPIF/NEXTIF skip logic, so the in-app preview/merge ignores them too.

---

## BUG-009 — All 6 Cover Page designs insert the same generic 3-line block (banding/color/shapes lost)  
**Severity:** S2

**Where**
: Insert tab > Pages group > Cover Page flyout. UI/data: src/renderer/public/js/insert-features.js — COVERS[] templates with rich per-design build() HTML (lines 16-23), insertCover (lines 32-34) passes ONLY t.name. Bridge: src/renderer/bridge/insert-exotica.ts xeCoverPage (lines 69-101).

**When / repro**
: 1. New doc. 2. Insert tab > Cover Page > 'Banded'. 3. Observe a plain 3-paragraph block at doc start (title text = 'Banded'). 4. Undo, repeat with 'Facet' then 'Ion'. 5. All three produce byte-identical structure differing only in the title literal (no banding markup; probe xmlLen ~3863-3866, hasBanding:false).

**Symptom (Word vs clone)**
: Insert > Cover Page lists Banded/Facet/Filigree/Ion/Motion/Retrospect, but every choice drops in an identical plain three-paragraph block: bold [design-name title], '[Subtitle]', '[Author Name] — <year>'. No color band, no diagonal art, no distinct layout. Word inserts each built-in's fully-formatted design (color band, shapes, title/subtitle/author content controls). User picks 'Banded' and gets the same unstyled stub as 'Ion'.

**Why it happens (root cause)**
: insert-features.js builds six distinct cover designs as HTML in COVERS[].build(), but Insert.insertCover (line 33) calls WC.PM.xeCoverPage(t.name) — passing only the name string; the build() functions are never invoked (dead code). In the bridge, xeCoverPage(name) (insert-exotica.ts:78-93) ignores the design entirely: it uses `name` solely as the title text and hardcodes one documentPartObject node with a fixed three-paragraph content array (bold title, '[Subtitle]', '[Author Name] — year'). So every design resolves to the same node.

**Evidence**
: spec-batch3.json INSERT_cover: near-identical xmlLen 3863-3866, hasBanding:false for all six, generic text per style. Code: insert-exotica.ts:88-92 fixed `content:[{paragraph title bold},{'[Subtitle]'},{'[Author Name] — '+year}]`; insert-features.js:33 `xeCoverPage(t.name)` drops t.build(); COVERS[].build() (16-23) has no caller.

**Solution**
: Plumb the per-design template to the bridge. Change Insert.insertCover (insert-features.js:33) to pass the chosen design's structure (e.g. t.build() HTML or a design key) to xeCoverPage. Extend xeCoverPage(name, html?) in insert-exotica.ts to parse the design HTML into PM nodes via the existing pasteHTML/HTML-to-PM path (or define per-design node templates) and wrap them in the documentPartObject (keeping the numeric `id` sanitizeId guard at line 87 intact). Effort M. Risk: docx round-trip of cover-page banding (shapes/shading) must export validly — gate with a roundtrip test per design; keep the numeric id requirement.

**Related:** BUG-016 (sibling Insert dead-toast); SHAPES-STUB (cover banding may depend on shape rendering)

---

## BUG-010 — Insert Footnote/Endnote seeds the note body with the literal word "Footnote"/"Endnote"  
**Severity:** S3

**Where**
: Ribbon: References tab > Footnotes group > Insert Footnote / Insert Endnote. Code: src/renderer/bridge/references.ts, insertNote() lines 206-217 — line 212 `const seed = type === 'endnote' ? 'Endnote' : 'Footnote'` then line 213 `d.footnotes.insert({ type, at, content: seed })`. Dispatch: commands.js:897-898 H.insertFootnote/H.insertEndnote.

**When / repro**
: Trigger: any footnote/endnote insert. Repro: 1) Open the app, click into a paragraph. 2) References tab > Insert Footnote. 3) Observe the note body in the notes area already reads "Footnote" (probe spec-batch5.js REF10_footnote: afterFirst:[{text:"Footnote"}], seedTextLeak:true). 4) Save as .docx, reopen in Word > the footnote text is the word "Footnote".

**Symptom (Word vs clone)**
: In Word, References > Insert Footnote (or Insert Endnote) creates an EMPTY note body and parks the caret there to type. In the clone, every new footnote body is pre-filled with the literal text "Footnote" (endnotes with "Endnote"). The user never typed it, yet it is real note content and ships in the saved .docx — every clone footnote contains the stray word "Footnote".

**Why it happens (root cause)**
: insertNote() builds a non-empty `seed` label and passes it as `content` to the footnotes.insert wrapper. In footnote-wrappers.ts footnotesInsertWrapper (line 232) that content flows to addNoteElement, which calls textToNoteOoxmlParagraphs(text) (notes-part-descriptor.ts:132) — the string is rendered as a real <w:r><w:t> run inside the note's <w:p>. So the placeholder label becomes authored note-body text, not an editor hint.

**Evidence**
: spec-batch5.json REF10_footnote: afterFirst:[{text:"Footnote"}], footnoteRefsInxml:1, seedTextLeak:true. Source: references.ts:212 seeds the literal; footnote-wrappers.ts:232 passes input.content to addNoteElement; textToNoteOoxmlParagraphs (notes-part-descriptor.ts:132-145) emits a w:r/w:t for any non-empty line and a bare empty w:p for an empty line.

**Solution**
: Change references.ts insertNote() to seed an empty body: pass `content: ''` (or drop the `content` key entirely if the wrapper treats undefined as empty). textToNoteOoxmlParagraphs('') already yields a valid empty <w:p> with no run, matching Word. Optionally move the caret into the new note. Effort S; risk low (only removes spurious text; verify the footnote round-trip gate test:roundtrip still passes and add a regression assertion that afterFirst content is empty).

---

## BUG-011 — Apply Theme changes body font but NOT headings (linked Heading*Char styles keep asciiTheme=majorHAnsi)  
**Severity:** S2

**Where**
: Ribbon: Design tab > Document Formatting > Themes gallery (H.themes, commands.js:691 -> WC.PM.deApplyTheme). Bridge: src/renderer/bridge/design.ts deApplyTheme() 76-82, themeUpdates() 50-63, HEADING_STYLE_IDS = ['Title','Subtitle','Heading1','Heading2','Heading3'] at line 18. Fork command: src/renderer/core/superdoc-fork/extensions/linked-styles/linked-styles.js redefineNamedStyles 121-227 (theme-binding deletes at 164-181).

**When / repro**
: 1. New doc. 2. Type a line, apply Heading 1 (real applyStyleByName('Heading 1')). 3. New paragraph, type body text. 4. Design > Themes > Celestial (Garamond). 5. Save as .docx, open in Word. Result: body = Garamond 12; Heading 1 = Aptos Display 20pt (theme major font unchanged).

**Symptom (Word vs clone)**
: Design > Themes (and the Fonts gallery, same path) is expected to change BOTH heading and body fonts to the theme's fonts. After applying e.g. Celestial (Garamond) and opening the saved .docx in real Word, the body correctly renders Garamond but every Heading 1 still renders in the previous theme's major font (Aptos Display 20pt), not Garamond. Theme apply visibly half-works: headings are wrong. Word-confirmed via COM oracle.

**Why it happens (root cause)**
: redefineNamedStyles only iterates the updates array it is handed. themeUpdates() emits updates for Title/Subtitle/Heading1-3/Normal only. For each, linked-styles.js:164-181 sets a literal ascii font on translated[id].runProperties.fontFamily AND deletes asciiTheme/hAnsiTheme. But Word's default Heading1 is LINKED to a character style Heading1Char which independently carries w:rPr w:rFonts w:asciiTheme='majorHAnsi'. That *Char styleId is never in updates, so its asciiTheme binding is never deleted. Character styles take precedence for run fonts, so Word resolves the heading run to the still-bound (unchanged) theme major font. styles.xml shows Heading1 = clean ascii='Garamond' but Heading1Char still asciiTheme='majorHAnsi'.

**Evidence**
: Ledger BUG-011: oracle read-word-props on theme2.docx para1 (Heading) = Aptos Display 20pt while body para2 = Garamond 12; styles.xml: Heading1 clean Garamond, Heading1Char still asciiTheme='majorHAnsi'. Code: HEADING_STYLE_IDS has no *Char entries (design.ts:18); redefineNamedStyles deletes theme bindings only on passed ids (linked-styles.js:142,164-181).

**Solution**
: In design.ts, expand the redefine targets to also cover the linked character styles: for each heading paragraph styleId, also push an update for its w:link target (Heading1Char/TitleChar/SubtitleChar) applying the same run font/color and (in the fork) deleting asciiTheme/themeColor. Either hard-map the *Char ids or, better, in redefineNamedStyles follow each style's w:link to its linked char style and strip/redefine its theme font bindings too. Effort M; risk medium (must resolve link targets that may be absent in some docs — guard for missing *Char). Add a roundtrip test asserting Heading1Char has no asciiTheme after theme apply.

---

## BUG-012 — Internal-document hyperlink (#anchor) exports as a broken EXTERNAL relationship; no 'Place in This Document'  
**Severity:** S3

**Where**
: Insert tab > Links group > Link. Dialog: src/renderer/public/js/dialogs.js:45-63 (D.insertLink — URL only). Bridge: src/renderer/bridge/insert.ts insertLink (lines 31-37) -> fork setLink. Engine: src/renderer/core/superdoc-fork/extensions/link/link.js setLink (185-277), addLinkRelationship (506-511). Exporter: .../v3/handlers/w/hyperlink/hyperlink-translator.js (_addNewLinkRelationship 152-170).

**When / repro**
: 1. Add a bookmark named MyBookmark (Insert > Bookmark). 2. Type and select 'go to mark'. 3. Insert > Link, set Address = '#MyBookmark', OK. 4. Save .docx and inspect: the link is <w:hyperlink r:id="rIdN"> and document.xml.rels has Type=hyperlink, TargetMode=External, Target="#MyBookmark". 5. Open in Word: clicking does NOT jump to the bookmark (broken external link).

**Symptom (Word vs clone)**
: The Insert Hyperlink dialog has only 'Text to display' + 'Address' (a raw URL); there is no 'Place in This Document' target to link to a heading/bookmark. If a user enters '#MyBookmark', it is exported as <w:hyperlink r:id="rIdN"> whose relationship is Type=hyperlink, TargetMode=External, Target="#MyBookmark" — Word treats this as a broken external link, not an in-document jump. Word would emit <w:hyperlink w:anchor="MyBookmark"> (no relationship).

**Why it happens (root cause)**
: setLink (link.js:185) accepts only {href,text}; at lines 261-264 it unconditionally calls addLinkRelationship({editor,href}) for docx mode and stores only {text, rId, href} on the mark — it never sets the schema's `anchor` attr (declared at link.js:141-143, rendered:false). addLinkRelationship (506-511 -> findOrCreateRelationship) makes a 'hyperlink' relationship with target=href. On export, hyperlink-translator (113-116) only takes the anchor branch when `!linkAttrs['r:id'] && anchor`; since rId is always present and anchor absent, it calls _addNewLinkRelationship, which writes Target=link, TargetMode='External' (lines 165-166). The exporter and schema ALREADY support w:anchor (translator line 32 _createAttributeHandler('w:anchor','anchor'); resolveHref 92-93 maps anchor→#name) — only the authoring path never produces an anchor.

**Evidence**
: hyperlinks.json: all three links export <w:hyperlink … r:id>; docx-inspect relTargets show '#MyBookmark' as an External relationship target. Code: link.js:261-273 always builds rId, never anchor; hyperlink-translator.js:115-116 anchor branch skipped when rId present; _addNewLinkRelationship 166 TargetMode:'External'.

**Solution**
: Add internal-link support end-to-end. (1) dialogs.js D.insertLink: add a 'Place in This Document' mode listing bookmarks/headings (WC.PM.listBookmarks); pass {anchor:name} instead of href. (2) bridge insert.ts insertLink: forward an optional anchor. (3) link.js setLink: when an anchor is supplied (or href starts with '#'), set linkAttrs.anchor and skip addLinkRelationship/rId. The exporter already emits w:anchor with no rel (translator lines 32/115). Effort M. Risk: low/medium — keep external-URL behavior unchanged; add a roundtrip test for w:anchor (and verify a Word-authored internal link survives re-export, per ledger follow-up).

**Related:** Insert > Bookmark (listBookmarks in insert-features.js:255 supplies targets)

---

## BUG-013 — Cross-reference "Page number" exports REF \p (Word's above/below switch) instead of PAGEREF  
**Severity:** S3

**Where**
: Ribbon: References tab > Captions group > Cross-reference, "Insert reference to: Page number". Dialog: commands.js crossRefDialogPM lines 949-987 (line 982 maps 'Page number' to display:'pageNumber'). Instruction builder: src/renderer/core/superdoc-fork/document-api-adapters/plan-engine/crossref-wrappers.ts, buildRefInstruction() lines 224-235 — line 229 `if (input.display === 'pageNumber') parts.push('\p')`.

**When / repro**
: Trigger: page-number cross-reference. Repro: 1) Create a Heading 1 (or a bookmark). 2) Put the caret elsewhere; References > Cross-reference. 3) Type Heading, Insert: Page number, pick the target, Insert. 4) Save .docx, inspect the field code (probe refxref.js XREF) > field = `REF tgt \p \h` (pageref:false). 5) Open in Word, F9/refresh > the cross-ref renders "above"/"below", not a page number.

**Symptom (Word vs clone)**
: In Word, a cross-reference with "Insert reference to: Page number" must export `{ PAGEREF bookmark \h }` and display the target's page number. The clone instead exports `REF tgt \p \h`. The `\p` switch on a REF field is Word's RELATIVE-POSITION switch (renders "above"/"below"), not a page number — so in Word the page-number cross-reference shows "above"/"below" (or nothing useful), never a page.

**Why it happens (root cause)**
: buildRefInstruction maps BOTH display:'pageNumber' (line 229) and display:'aboveBelow' (line 230) to the same `\p` switch, so a page-number request collapses into the above/below form. Word distinguishes them by FIELD TYPE, not a switch: page numbers use a separate PAGEREF field, while `\p` on a REF/PAGEREF means "include relative position (above/below)". The builder also never emits a PAGEREF field type at all (fieldType is hard-coded REF/NOTEREF/STYLEREF at line 226-227).

**Evidence**
: refxref.json XREF = {pageref:false, refField:"REF tgt \\p \\h"}. Source: crossref-wrappers.ts:229 pageNumber->\p (identical to :230 aboveBelow->\p); fieldType selection :226-227 has no PAGEREF branch. crossReference-translator.js:105 confirms `\p` round-trips back to display 'aboveBelow', proving the two modes are conflated.

**Solution**
: In crossref-wrappers.ts buildRefInstruction: for display:'pageNumber' emit a PAGEREF field — set fieldType='PAGEREF', do NOT push `\p`, keep `\h` (=> `PAGEREF tgt \h`); keep `\p` only for display:'aboveBelow'. The decode path (crossReference-translator.js parseDisplay) needs a matching `PAGEREF`/page-number branch, and the schema node should accept fieldType 'PAGEREF'. Effort M; risk medium (touches the export field-type contract and the importer's parseDisplay — add a crossReference-translator.test.js case and validate the PAGEREF render against the Word COM oracle).

---

## BUG-014 — Font Size silently clamps to 8-96 pt (Word allows 1-1638)  
**Severity:** S2

**Where**
: Home tab > Font group > Font Size combo (home.font.font-size). Clamp: src/renderer/core/superdoc-fork/extensions/font-size/font-size.js:54-59 (defaults min:8,max:96) and :113 (value = minMax(Number(value), min, max)). minMax = Math.min(Math.max(value,min),max) (core/utilities/minMax.js:1-3). Combo commit path: src/renderer/public/js/commands.js:1641 (comboCommit) -> :1734 setFontSize -> :1738 WC.PM.cmd('setFontSize', pt+'pt').

**When / repro**
: 1. Select some text. 2. Click into the Home > Font Size combo box. 3. Type 200 and press Enter. 4. Observe the text becomes 96 pt and the combo shows 96, not 200. 5. Repeat with 4 -> becomes 8; with 1638 -> becomes 96. No toast or validation message appears either way.

**Symptom (Word vs clone)**
: In the Font Size combo, typing a value below 8 or above 96 pt (e.g. 4, 100, 200, 1638) silently snaps to 8 or 96 with no warning. Word for Windows accepts 1-1638 pt and half-points. The clamped value is what gets applied, shown in the combo, exported to .docx (w:sz) and round-tripped, so a 72 pt title or a 1638 pt banner is permanently lost without the user noticing.

**Why it happens (root cause)**
: setFontSize in font-size.js parses the requested size, then unconditionally calls value = minMax(Number(value), min, max) with min=8/max=96 from addOptions defaults (lines 54-59). minMax clamps to [8,96], so any out-of-range request is collapsed to a bound before the textStyle mark is set (chain().setMark('textStyle',{fontSize})). The bridge (commands.ts cmd) just forwards the string and returns ok; there is no pre-validation or user feedback in commands.js setFontSize, so the clamp is invisible. The 8/96 bounds were inherited from the upstream SuperDoc remirror-style defaults and never widened to Word's real 1-1638 range.

**Evidence**
: audit-verify1.json: 4pt->8, 200pt->96, 1638pt->96 (BUG-014, ledger line 256). Code: font-size.js:54-59 defaults {min:8,max:96}; :113 value=minMax(...); minMax.js:2 returns Math.min(Math.max(value,min),max); commands.js:1641/1734/1738 pass the raw pt straight through with no range check.

**Solution**
: Widen the bounds to Word's range in font-size.js addOptions defaults: min:1, max:1638 (S, ~1 line). The minMax call then only guards genuinely invalid input. Optionally also accept half-points (don't Math.round). Risk: low; bounds only constrain, so widening cannot break existing in-range docs. Add a regression test in scripts/test-suite-pm.js asserting setFontSize('1pt')/('1638pt') survive un-clamped and export the right w:sz (2 and 3276 half-points). Effort S.

---

## BUG-015 — Non-keyword highlight color exports as w:shd character shading, not w:highlight  
**Severity:** S3

**Where**
: Home tab > Font group > Text Highlight Color split button (home.font.text-highlight-color). Picker uses the generic palette: commands.js:1490 colorMenu(node,'hilite') -> util.js full colorPalette. Export decision: src/renderer/core/superdoc-fork/core/super-converter/v3/handlers/w/highlight/highlight-translator.js:48-66 decode(): getDocxHighlightKeywordFromHex(value); if null it falls through to return a 'w:shd' node (lines 59-66). Keyword set: super-converter/helpers.js:448-465 DOCX_HIGHLIGHT_KEYWORD_MAP (16 entries) + getDocxHighlightKeywordFromHex :486-494.

**When / repro**
: 1. Select text. 2. Open the Text Highlight Color dropdown and pick a color NOT among Word's 16 highlight keywords, e.g. Standard 'Orange' (#FFC000) or any More-Colors hex. 3. Save as .docx. 4. Inspect the run XML: it is <w:shd w:val='clear' w:fill='FFC000'/>, not <w:highlight>. 5. Reopen in Word: the text shows as character shading; the Highlight button does not show it as active and 'No Color' on the highlighter won't remove it.

**Symptom (Word vs clone)**
: The Text Highlight Color picker shows Word's full color palette (Automatic, Theme Colors, tints, Standard colors, More Colors), but Word's highlighter only supports a fixed set of 16 named keywords. Picking any color outside that set (most theme colors, all tints, custom hexes, even Standard 'Orange' #FFC000) is exported as character shading (w:shd fill=...) instead of a highlight (w:highlight). On reopen in Word the run is character shading, not a highlight: it looks similar but is a different feature, cannot be cleared with the highlighter, and the type silently changed on round-trip.

**Why it happens (root cause)**
: decode() in highlight-translator.js takes the stored highlight color and calls getDocxHighlightKeywordFromHex (helpers.js:486). That function returns a keyword ONLY if the normalized hex exactly equals one of the 16 map values (FFFF00, FF0000, ... helpers.js:448-465); #FFC000 is not in the map, so it returns null. The code then does NOT abort or snap to the nearest keyword; instead lines 56-66 build a 'w:shd' node from normalizeHexColor(value). So a UI affordance (the full palette) promises arbitrary highlight colors the OOXML w:highlight element cannot represent, and the converter quietly downgrades them to character shading - a different run property. The root mismatch is the picker (generic colorPalette) vs the 16-keyword reality of w:highlight.

**Evidence**
: ledger line 257 (BUG-015): #FFC000 -> <w:shd fill='FFC000'> not <w:highlight>. Code: highlight-translator.js:48 keyword=getDocxHighlightKeywordFromHex(...); :49-54 keyword path emits w:highlight; :56-66 null path emits w:shd. helpers.js:448-465 map has exactly 16 keywords; :486-494 returns null for any hex not equal to a mapped value. Picker: commands.js:1490 colorMenu(node,'hilite').

**Solution**
: Two-part. (1) UI fidelity (commands.js/util.js): give 'hilite' its own 16-swatch highlighter palette (the DOCX keywords) + No Color + Stop Highlighting, instead of the generic colorPalette, so only valid keywords are pickable (M). (2) Converter safety net (highlight-translator.js decode): when getDocxHighlightKeywordFromHex returns null, snap to the nearest keyword (or drop to 'none') and still emit w:highlight, never w:shd, so a highlight stays a highlight on round-trip (S). Risk: low-medium; restricting the palette is purely additive UI, and the nearest-keyword snap changes only out-of-gamut colors that were already being silently mistyped. Add a roundtrip test asserting an off-keyword pick exports w:highlight. Effort M.

---

## BUG-016 — Convert Text to Table (Insert) is a dead toast over a working PM.textToTable bridge  
**Severity:** S3

**Where**
: Insert tab > Tables group > Table dropdown > 'Convert Text to Table…'. Dead handler: src/renderer/public/js/insert-features.js:44-46 (Insert.convertTextToTable = toast) wired at line 57. Working impl: src/renderer/bridge/table.ts:206-210 textToTable -> fork src/renderer/core/superdoc-fork/extensions/table/table.js:2061-2121 convertTextToTable.

**When / repro**
: 1. Type three lines like 'a,b' / 'c,d' / 'e,f' (one per paragraph). 2. Select all three. 3. Insert tab > Table > 'Convert Text to Table…'. 4. Only a toast appears; no table is created. 5. Compare: calling WC.PM.textToTable({separator:','}) (via console/Table Tools path) DOES build the table — proving the feature works but the menu item is dead.

**Symptom (Word vs clone)**
: Insert > Table > 'Convert Text to Table…' shows a toast 'Convert Text to Table is available in Table Tools (slice 6b)' and does nothing — no dialog, no table. Word converts the selected paragraphs into a table (with a separator/columns/AutoFit dialog). A fully working conversion command already exists in the engine but is unreachable from its Word ribbon location, AND there is no Table Tools entry that reaches it either.

**Why it happens (root cause)**
: Insert.convertTextToTable (insert-features.js:44) is a pure toast stub; the flyout item at line 57 invokes it. Meanwhile the bridge function textToTable (table.ts:207) calls editor.commands.convertTextToTable(delim), and the fork command (table.js:2061-2121) is fully implemented: it gathers top-level paragraphs across the selection, splits each on the delimiter, computes column widths, and replaceWith a real table node. The menu simply never calls the bridge. There is no H.textToTable handler in commands.js (only H.tblToText at line 126), so no ribbon control reaches the working command.

**Evidence**
: insert-features.js:44-46 toast stub, wired at :57. table.ts:206-210 textToTable -> convertTextToTable. table.js:2061-2121 working command (gather paragraphs, split on delim, build table). Grep of commands.js: only `tblToText` handler exists; no textToTable/convertTextToTable handler is wired anywhere.

**Solution**
: Wire the menu to the working bridge. Replace the Insert.convertTextToTable body (insert-features.js:44-46) to open a small dialog (separator paragraphs/comma/tab/other, optional column count/AutoFit) and call WC.PM.textToTable(separator). Default the separator from the selection (tab vs comma). The fork command already accepts a delimiter string. Effort S (UI dialog) / XS (minimal: drop a default-tab call). Risk: low — the engine path is tested; just ensure a selection exists before calling (guard with a toast when collapsed).

**Related:** BUG-009, SHAPES-STUB (same 'dead Insert UI over real/absent engine' pattern)

---

## BUG-017 — Format Painter double-click lock CAN be cancelled with Esc — ledger entry is STALE / no longer reproduces  
**Severity:** S5

**Where**
: Home -> Clipboard -> Format Painter (split button, cmd:formatPainter / formatPainterLock). Code: working cancel path is src/renderer/bridge/index.ts:433-451 (capture-phase Escape listener `painterEscInstalled`) -> bridge/commands.ts:190-194 cancelFormatPainter -> fork extensions/format-commands/format-commands.js:187-193 cancelFormatPainter + :291-301 clearFormatPainterStorage. painterArmed at bridge/commands.ts:195-198. The audit-cited app.js:70-77 (no painter branch) and format-commands.js:337-363 handleKeyDown (Shift+Arrow only) are real but are NOT the Esc path — the audit missed bridge/index.ts:440.

**When / repro**
: 1) Type and format a word (e.g. bold). 2) Select it. 3) Double-click Format Painter (ribbon.js:496 closeFlyouts()+formatPainterLock) — toast 'Format Painter locked … Press Esc to stop' appears, painter armed persistent. 4) Press Esc once. Result: painter disarms (cursor/armed-state cleared); it does NOT stay armed. Repro confirmed by code path, not the stale ledger note.

**Symptom (Word vs clone)**
: Ledger/audit claim: double-clicking Format Painter locks it and toasts 'Press Esc to stop', but no Esc handler disarms it, so the painter stays armed forever. In the CURRENT tree this does not happen — Esc disarms the locked painter exactly like Word. (Word: dbl-click locks repeated paint; Esc or re-click stops it.)

**Why it happens (root cause)**
: armPainterPM (commands.js:1710-1715) calls WC.PM.armFormatPainter(true) -> fork copyFormat({persistent:true}) sets storage.storedStyle/storedParaProps and storage.persistent. bridge/index.ts:440-450 installs ONE document-level capture-phase keydown: on 'Escape', if no .flyout/.modal-backdrop is open and pm.painterArmed() is true (storedStyle||storedParaProps truthy), it preventDefault/stopPropagation and calls pm.cancelFormatPainter(), which clears storage. The dblclick first ran WC.closeFlyouts() (ribbon.js:496) so no flyout lingers, and the 'Press Esc' toast has class 'toast' (util.js:149) — NOT matched by the :442 guard — so the handler fires and disarms.

**Evidence**
: git: the Esc handler was added in commit dc70b2e ('feat(ribbon): … format-painter arm/cancel'); the bughunt worktree is pinned at 621da99 which already CONTAINS it (bridge/index.ts:433 `if (!painterEscInstalled)`). cancelFormatPainter returns true when storage is armed (format-commands.js:190). The audit-bugs.json evidence cites only app.js:70-77 and format-commands.js handleKeyDown and never inspected bridge/index.ts — hence the false positive.

**Solution**
: No code fix needed — RECLASSIFY to S5 (verified-clean) and strike BUG-017 from the fix queue. Optional hardening (effort S, low risk): add a regression test in scripts/test-suite-pm.js asserting that after WC.PM.armFormatPainter(true), WC.PM.painterArmed()===true, then a synthetic capture-phase Escape keydown makes painterArmed()===false. If desired for symmetry, also add an `if (WC.PM.painterArmed && WC.PM.painterArmed()) { WC.PM.cancelFormatPainter(); return; }` early branch in app.js bindKeys Escape (app.js:70) as belt-and-suspenders, but it is redundant with the existing capture-phase handler.

---

## BUG-018 — Replace (Ctrl+H) permanently hides Match case / Whole words / Use wildcards (advanced=undefined)  
**Severity:** S2

**Where**
: Home -> Editing -> Replace (cmd:replace, Ctrl+H). H.replace at src/renderer/public/js/commands.js:102 -> WC.Dialogs.findPane(true). D.findPane at dialogs.js:102-104 has signature (replace, advanced) and forwards to pmFindPane(replace, advanced, WC.PM). The options row is built at dialogs.js:133 with `display: advanced ? 'block' : 'none'` and never toggled again (grep of optRow/.style.display in dialogs.js shows no later un-hide; there is no More>> button in this pane).

**When / repro**
: 1) Open/seed any doc with mixed-case text (e.g. 'Cat cat CAT'). 2) Press Ctrl+H (or ribbon Home -> Replace). 3) The Replace task-pane opens with Find/Replace inputs + Replace/Replace All. 4) Look for Match case / Whole words only / Use wildcards. Result: the entire `find-opts` row is display:none — the three options are absent. There is no More>> control to reveal them, so a case-sensitive replace is impossible.

**Symptom (Word vs clone)**
: Word's Replace dialog always exposes Match case / Whole words only / Use wildcards (under More>>), so users can do a case-sensitive or whole-word replace. The clone's Replace pane never shows those three checkboxes — Replace is locked to case-insensitive, whole-word-off, no-wildcard, with no UI to enable any of them. (Find via the highlight options is equally hidden, but Word's Navigation/Find legitimately omits them; the Replace gap is the Word-fidelity defect.)

**Why it happens (root cause)**
: H.replace calls findPane(true) with only ONE argument, so the second param `advanced` is undefined. dialogs.js:102 D.findPane(replace, advanced) passes that undefined straight to pmFindPane. At dialogs.js:133 the optRow style is `display: advanced ? 'block' : 'none'`; undefined is falsy -> 'none'. The checkboxes (Match case bound to currentOpts.caseSensitive, Whole words to wholeWord, Use wildcards to useWildcards — dialogs.js:139-154) are created and appended but live inside the hidden row, so their change handlers can never fire. currentOpts therefore stays {caseSensitive:false, wholeWord:false, useWildcards:false} (dialogs.js:115) for every replace.

**Evidence**
: commands.js:102 `H.replace = () => WC.Dialogs.findPane(true);` (no advanced arg). dialogs.js:102 `D.findPane = function (replace, advanced) { return pmFindPane(replace, advanced, WC.PM); }`. dialogs.js:133 optRow `display: advanced ? 'block' : 'none'`. The find session honours the options (findSession(term, currentOpts), dialogs.js:179) — so the backend supports case/whole-word/wildcard; only the UI to set them is hidden. Matches audit-bugs.json (nr:false) and BUG-LEDGER BUG-018.

**Solution**
: Two-line fix (effort S, low risk). Easiest: change commands.js:102 to `H.replace = () => WC.Dialogs.findPane(true, true);` so the Replace pane opens with options visible. Better Word fidelity (effort S/M): in pmFindPane (dialogs.js:110) add a 'More >>/<< Less' toggle button (mirroring the line-1016 pattern) that flips optRow.style.display, and default it OPEN for replace===true (Word shows the basic dialog but More>> persists). Risk: the Navigation/Find pane (findPane(false)) should keep options hidden behind the toggle to match Word's Navigation pane. Ship a regression test in scripts/test-suite-pm.js asserting the Replace pane renders the three .find-opts checkboxes visible (offsetParent !== null) and that toggling Match case sets currentOpts.caseSensitive.

---

## BUG-019a — Pens-gallery active-tile highlight reads WC.Draw.pen.id, which is never updated — only the first "Pen" tile ever highlights  
**Severity:** S2

**Where**
: Draw tab → Pens group → Pens gallery (data-driven cmd 'pens-gallery'/'pensGallery'). Code: src/renderer/public/js/ribbon.js renderPensGallery — line 271 `const active = pmA ? (pmA.dIsDrawing() && draw.pen && draw.pen.id === pen.id) : false;` and line 278 click handler `const isOn = pm.dIsDrawing() && WC.Draw.pen && WC.Draw.pen.id === pen.id;`. State: src/renderer/public/js/draw-tools.js:25 `pen: PENS[0]`. Bridge: src/renderer/bridge/draw.ts:105-110 dSetPen.

**When / repro**
: 1. Open the app. 2. Click the Draw ribbon tab. 3. Click the "Pen (Blue)" tile in the Pens gallery. 4. Observe: the blue tile is NOT highlighted as active; only the first plain "Pen" tile shows the .active class (and only while drawing is on). 5. Click "Pen (Red)" — still no active highlight on red.

**Symptom (Word vs clone)**
: Word: clicking a pen selects it and the tile stays highlighted as the active pen. Clone: clicking Pen (Blue)/Pen (Red)/Highlighter sets the bridge pen and starts drawing, but NO tile shows an active state except the first "Pen"; selecting any other pen shows zero active feedback, so the user can't tell which pen is current.

**Why it happens (root cause)**
: The tile-active check compares each pen's id to `WC.Draw.pen.id`. `WC.Draw.pen` is initialized to `PENS[0]` (the plain 'pen') in draw-tools.js:25 and is NEVER reassigned anywhere. The click handler calls `pm.dSetPen(pen)`, but dSetPen (draw.ts:105-110) only mutates the bridge-private `drawState.pen` (`drawState.pen = {...drawState.pen, ...pen}`) — it does not write back to `WC.Draw.pen`. So `WC.Draw.pen.id` stays 'pen' forever, and `draw.pen.id === pen.id` is true only for the first tile. The gallery never reflects the real selected pen held in `drawState`.

**Evidence**
: ribbon.js:271/278 read `draw.pen.id`/`WC.Draw.pen.id`; draw-tools.js:25 `pen: PENS[0]` (PENS[0].id==='pen'); draw.ts:105-110 dSetPen writes only drawState.pen; grep confirms `WC.Draw.pen` is never reassigned (audit-bugs.json Draw 'Pens Gallery': "active-tile highlight reads WC.Draw.pen.id, which is NEVER updated").

**Solution**
: Source the active id from the bridge tool state instead of the stale WC.Draw.pen. In ribbon.js renderPensGallery, read the current pen from `WC.PM.dGetState().pen` (draw.ts exposes dGetState) and compare its id, OR have dSetPen also assign `WC.Draw.pen = pen` (draw.ts:105-110) and `WC.Draw.tool` so the legacy state object stays in sync. Add an id to drawState.pen (dSetPen currently spreads pen but the tile compares by id — ensure id is carried). Effort S. Risk low (UI-only; no doc mutation). Pair with BUG-019b so the gallery also re-renders on toggle.

**Related:** BUG-019b, BUG-019d

---

## BUG-019b — Drawing toggle never latches (no ribbon rule) and Pens flyout always reads "Start Drawing" (WC.Draw.enabled never set)  
**Severity:** S2

**Where**
: Draw tab → Pens group → Drawing toggle (cmd 'drawing', ribbon-data.js:1097) and Pens flyout. Code: src/renderer/public/js/commands.js:644 `H.drawing = () => { WC.PM.dSetDrawing(!WC.PM.dIsDrawing()); };` and commands.js:675 flyout label `WC.flyItem(WC.Draw.enabled ? 'Stop Drawing' : 'Start Drawing', …)`. State flag: src/renderer/public/js/draw-tools.js:23 `enabled: false`. Overlay binds capture on drawState.on: src/renderer/bridge/ink-overlay.ts:377-390 sync().

**When / repro**
: 1. Open the app, click the Draw tab. 2. Click the "Drawing" button. 3. Observe: the button does NOT appear pressed/latched (no toggled styling). 4. Open the Pens flyout (Pens ▾) — the item still says "Start Drawing" even though drawing is on. 5. Drawing actually works (you can ink), confirming the engine is on but the UI state is dead.

**Symptom (Word vs clone)**
: Word's drawing toggle latches ON (highlighted) and disables text editing while active; clicking again returns to typing. Clone: the Draw → Drawing button never shows a toggled/pressed state even though pointer capture is bound, and the Pens flyout's first action always reads "Start Drawing" — even while drawing is active — so it never offers "Stop Drawing".

**Why it happens (root cause)**
: Two independent state breaks. (a) Latch: ribbon buttons only show a toggled state when a rule is registered via WC.registerRibbonRule(cmd, {latched: …}) (mechanism used by 'formatPainter'/'showHide' in home-features.js:82/90). No rule is registered for 'drawing', so the renderer has no `latched` predicate and never adds the toggled class — H.drawing flips `drawState.on` but nothing reflects it. (b) Flyout label: it reads `WC.Draw.enabled`, but the real on/off lives in the bridge `drawState.on` (toggled by dSetDrawing, draw.ts:93). `WC.Draw.enabled` is initialized false (draw-tools.js:23) and never written, so the ternary always yields 'Start Drawing'.

**Evidence**
: commands.js:644 H.drawing flips dIsDrawing; no registerRibbonRule('drawing') in any js (grep: rules exist for cut/copy/paste/formatPainter/showHide/decreaseIndent only); commands.js:675 label uses WC.Draw.enabled; draw-tools.js:23 enabled:false never reassigned; draw.ts:93 dSetDrawing sets drawState.on, not WC.Draw.enabled (audit-bugs.json Draw 'Drawing toggle').

**Solution**
: Register a latch rule: `WC.registerRibbonRule('drawing', { latched: () => !!(WC.PM && WC.PM.dIsDrawing && WC.PM.dIsDrawing()) })` (or expose drawing in state-sync). In the Pens flyout (commands.js:675) replace `WC.Draw.enabled` with `WC.PM.dIsDrawing()`. Optionally have dSetDrawing mirror to `WC.Draw.enabled` (draw.ts:93) for legacy reads. After toggling, refresh the ribbon state so the latch repaints. Effort S/M. Risk low. Pair the gallery re-render with BUG-019a.

**Related:** BUG-019a

---

## BUG-019c — Eraser point/segment-erase deletes the entire stroke (no split) — only whole-stroke erase exists  
**Severity:** S2

**Where**
: Draw tab → Tools → Eraser (cmd 'eraser', commands.js:657 `H.eraser = () => { WC.PM.dSetEraser(); }`). Erase logic: src/renderer/bridge/ink-overlay.ts — eraseAt() lines 246-254 and deleteNodesAt() lines 231-245. Mode flag `eraseMode` exists in draw.ts:14 ('stroke') but only one path is implemented.

**When / repro**
: 1. Draw tab → click a pen, draw two long overlapping strokes. 2. Click Eraser. 3. Drag the eraser across the MIDDLE of one stroke (not an endpoint). 4. Observe: the ENTIRE stroke vanishes, not just the segment under the eraser. Word would erase only the touched segment (or the whole stroke only in Stroke-eraser mode).

**Symptom (Word vs clone)**
: Word's pen Eraser (and its Stroke vs. Point/Segment modes) erases only the touched portion of a stroke, leaving the rest. Clone: touching ANY part of a stroke with the eraser deletes the whole stroke at once — there is no point/segment erase, so users lose entire ink lines when trying to rub out a small piece.

**Why it happens (root cause)**
: eraseAt (ink-overlay.ts:246) hit-tests every rendered `.pm-ink-stroke` with pathNear() and, on any hit, pushes the node position into `hits`, then calls deleteNodesAt(hits). deleteNodesAt (line 231-245) builds a transaction that does `tr.delete(pos, pos + node.nodeSize)` — it removes the whole vectorShape node. There is no code that splits the stroke's point list at the hit, trims the erased span, and re-inserts the surviving sub-strokes. `drawState.eraseMode` (draw.ts:14) is read nowhere in the erase path, so 'point'/'segment' mode is a no-op; every erase is a full-node delete.

**Evidence**
: ink-overlay.ts:246-254 eraseAt collects node positions and calls deleteNodesAt; ink-overlay.ts:240 `tr.delete(pos, pos + node.nodeSize)` removes the entire node; no point-splitting code anywhere; draw.ts:14 eraseMode set but unused in ink-overlay (audit/ledger BUG-019: "point/segment erase deletes the whole stroke (no split)").

**Solution**
: Implement segment erase in ink-overlay.ts. In eraseAt, when eraseMode !== 'stroke', for each hit recover the stroke's source points (attrs.customGeometry.inkPoints + inkPos), find the contiguous point indices within `radius` of the erase point, split the polyline into the surviving runs, delete the original node, and re-insert one inkShape per surviving run via WC.PM.dInsertInk (preserving pen). Keep the current whole-node delete for eraseMode==='stroke'. Wire a Stroke/Point/Segment mode picker on the Eraser ▾. Effort M/L (geometry + multi-node reinsert in one tr). Risk medium (undo grouping, anchor recomputation).

**Related:** BUG-019d

---

## BUG-019d — Custom Pen forces opacity 1 (no translucent highlighter) and dSetPen never sets tool='pencil'  
**Severity:** S3

**Where**
: Draw tab → Pens → Add Pen ▾ → Custom Pen… (addPenDialog, commands.js:679-688) — line 685 `const pen = { id: 'custom-'+…, name:'Custom Pen', color, width: parseFloat(width.value), opacity: 1 }`. Tool mapping: src/renderer/bridge/draw.ts:105-110 dSetPen — line 107 `drawState.tool = /highlighter/.test((pen && pen.id) || '') ? 'highlighter' : 'pen'`.

**When / repro**
: 1. Draw tab → Pens → Add Pen ▾ → Custom Pen…. 2. Pick a color and thickness; note there is NO transparency control. 3. Click Add → draw: the stroke is fully opaque (opacity 1), never a translucent highlighter. 4. Separately, add/select a Pencil pen (id 'pencil') — the ink overlay tool stays 'pen', never 'pencil'.

**Symptom (Word vs clone)**
: Word lets a custom pen be a translucent highlighter and distinguishes Pen/Pencil/Highlighter tools. Clone: a Custom Pen created via Add Pen… → Custom Pen… is always fully opaque (no transparency slider), so you cannot make a translucent highlighter; and selecting a Pencil-type pen never puts the tool into 'pencil' mode (it stays 'pen'), losing the pencil-specific behavior.

**Why it happens (root cause)**
: addPenDialog (commands.js:685) hardcodes `opacity: 1` and the Add Pen dialog (body, lines 683) exposes only Color + Thickness — no opacity slider — so every custom pen is opaque; a translucent highlighter is impossible to author. Separately, dSetPen (draw.ts:107) derives the tool ONLY by regex-testing the pen id for 'highlighter'; everything else falls to 'pen'. So a pen with id 'pencil' sets tool='pen', not 'pencil'. The overlay's activeCapture (ink-overlay.ts:154) does accept 'pencil', but dSetPen never produces it, so pencil mode is unreachable.

**Evidence**
: commands.js:685 `opacity: 1` hardcoded; addPenDialog body (commands.js:683) has only color + thickness inputs (no opacity); draw.ts:107 tool mapping tests only /highlighter/ on pen.id → else 'pen'; ink-overlay.ts:154 activeCapture lists 'pencil' but it is never set (ledger BUG-019: "forces opacity 1 (no translucent highlighter) + dSetPen never sets tool=pencil").

**Solution**
: In addPenDialog (commands.js:679-688) add an opacity/transparency range input and pass its value as `opacity` instead of the hardcoded 1. In dSetPen (draw.ts:107) derive tool from the pen's type/id with full coverage: `pencil`→'pencil', `highlighter`→'highlighter', else 'pen' (e.g. `pen.type || (/pencil|highlighter/.test(id)…)`), and also reflect it on WC.Draw.tool. Confirm applyPen (ink-overlay.ts:216-221) already honors opacity (it does), so translucent strokes render. Effort S. Risk low (additive UI field + a wider tool switch).

**Related:** BUG-019a, BUG-019c

---

## BUG-020 — File > Close creates a new blank document instead of closing the current one  
**Severity:** S2

**Where**
: File (Backstage) > Close rail item. src/renderer/public/js/backstage.js:48 (show(): if pane==='close' WC.Files.newDoc()). Target it resolves to: src/renderer/public/js/files.js:53-59 newDoc() (confirmDiscard -> WC.PM.newBlank() -> resets path/name -> Backstage.close()).

**When / repro**
: 1. Open or create a document and type some text. 2. Click File to open Backstage. 3. Click 'Close' in the left rail. 4. Observe the discard/save prompt (this is newDoc's confirmDiscard). 5. Choose Don't Save. 6. Result: a fresh blank 'Document<N>' is loaded and Backstage closes — instead of the expected empty/start state with the prior document closed. The title bar shows a new random doc name, confirming a new document was created rather than the current one closed.

**Symptom (Word vs clone)**
: Word: File > Close closes the current document (prompting to save if dirty) and leaves the window on the Backstage/start screen with NO document loaded. Clone: File > Close instead silently creates a NEW blank 'DocumentN' — you can never reach a document-less state, and the save prompt you see is the new-doc discard prompt, not a close prompt. Functionally 'Close' is just a duplicate of 'New'.

**Why it happens (root cause)**
: Backstage.show() (backstage.js:42-53) special-cases immediate-action rail items. For pane==='close' it executes WC.Files.newDoc() (line 48). newDoc() (files.js:53-59) runs confirmDiscard(), then WC.PM.newBlank() to build a fresh empty document, resets this.path=null and assigns a random name, then WC.Backstage.close(). So 'Close' is literally wired to the new-document routine; there is no close-only path that tears down the current doc and shows the start screen. The semantic of Close (leave the window document-less, or show home) is never invoked.

**Evidence**
: backstage.js:48 `if (pane === 'close') { WC.Files.newDoc(); return; }`; files.js:53-59 newDoc(): confirmDiscard() -> WC.PM.newBlank() -> path=null; name='Document'+rand -> Backstage.close(); pane_home (backstage.js:55-64) is the start screen that Close should land on but never does.

**Solution**
: Add a real WC.Files.close() in files.js: run confirmDiscard(), then on confirm clear the editor (WC.PM.newBlank() may stay as the empty-doc backing, but path=null and DO NOT auto-close Backstage) and route to the Backstage home/start pane (Backstage.show('home')) leaving the user document-less, matching Word. Then change backstage.js:48 to `if (pane === 'close') { WC.Files.close(); return; }` (keeping it on the Backstage rather than calling close()). Effort: S. Risk: S — confirmDiscard already handles the dirty-save prompt; main care is leaving a coherent empty state (status bar / title) and not leaving #pm-editor in an unmounted state. Add a regression test asserting WC.Files.close lands on Backstage home and clears path.

**Related:** BUG-007

---

## BUG-021 — Mailings → Go to Record spinner mis-rendered as a paragraph-indent spinner (indent icon, pt unit, step 6, default 0)  
**Severity:** S2

**Where**
: Ribbon: Mailings → Preview Results → Go to Record (ribbon-data.js entry id mailings.preview-results.go-to-record, cmd 'goToRecord', type 'spinner', label 'Go to Record', lines 2034-2041). Renderer: src/renderer/public/js/ribbon.js renderSpinner() lines 450-462 (icon :453, input value/step/min :454, unit suffix :458). Commit handler: src/renderer/public/js/commands.js WC.Commands.spinner lines 1661-1671, goToRecord branch :1670 (WC.Mail.go((value||1)-1)).

**When / repro**
: Repro: 1) Open the Mailings tab; 2) look at the Go to Record control in the Preview Results group — it shows a left-indent icon, value '0', and a 'pt' unit suffix; 3) click the up arrow once — the spinner increments by 6 (records 0→6→12), not by 1; 4) type a record number and commit — go((value||1)-1) is called, but the displayed default/unit and the 6-step arrows make single-record navigation impossible without manual typing.

**Symptom (Word vs clone)**
: Word's Go to Record control is a plain integer box defaulting to 1, step 1, no unit suffix; the up/down arrows move one record at a time. The clone renders it with the generic paragraph spinner chrome: a left-indent icon, a 'pt' unit suffix, value 0 (Word starts at record 1), min 0, and step 6 — so the box reads '0 pt' with an indent glyph, and each arrow click jumps 6 records instead of 1. It looks like an indent control, not a record navigator, and is largely unusable for stepping through recipients.

**Why it happens (root cause)**
: renderSpinner (ribbon.js:450) is a single generic function shared by the Layout paragraph spinners and was never specialized for goToRecord. It derives everything from the cmd/label string: isIndent = /indent/i.test(c.cmd) is false for 'goToRecord', so (1) the icon at :453 falls through `/Left|Before/i.test(c.label) ? 'decreaseIndent' : 'increaseIndent'` — label 'Go to Record' matches neither, giving the increaseIndent glyph; (2) the input at :454 sets step = isIndent ? '0.1' : '6' → '6', value = c.cmd==='spacingAfter' ? '8' : '0' → '0', min = isIndent ? '-2' : '0' → '0'; (3) the unit span at :458 is isIndent ? '"' : 'pt' → 'pt'. There is no goToRecord case anywhere in renderSpinner, so the spacing-spinner defaults (step 6 like spacingBefore/After points, 'pt' unit, 0 base) are applied to a record index. The commit path (commands.js:1670) is correct (go(value-1)); only the rendering metadata is wrong.

**Evidence**
: ribbon.js:453 icon ternary keys off label (no Left/Before → increaseIndent); :454 step '6', value '0' (cmd not spacingAfter), min '0' (not indent); :458 unit 'pt' (isIndent false). ribbon-data.js:2036-2038 confirms cmd 'goToRecord', type 'spinner', label 'Go to Record' (no 'indent' substring). commands.js:1670 goToRecord → go((value||1)-1). Audit ribbon.js:450-461 finding matches exactly.

**Solution**
: Specialize renderSpinner in ribbon.js:450-462 for record-style spinners. Add an isRecord = c.cmd === 'goToRecord' branch: render no unit suffix (or a count glyph instead of increaseIndent), input step '1', value '1', min '1' (integer, no decimals). Cleanest is a small per-cmd config object (icon/step/min/default/unit) replacing the hard-coded isIndent ternaries so future non-indent spinners aren't mis-rendered. Verify the commit math still holds: with default 1, go((1)-1)=go(0) selects record 1 (0-based). Effort S (one renderer function, no bridge/export change). Risk Low — change is scoped to one control; regression-test that Layout indent/spacing spinners keep their 0.1/'"' and 6/'pt' behavior.

**Related:** Same root family as BUG-006/BUG-021-style UI-data wiring gaps — a generic renderer applied to a control whose metadata doesn't fit. Independent of the layout engine; pure renderer fix.

---

## BUG-022 — Mark Entry (index) calls refMarkIndexEntry() with no dialog/args — silent no-op without a selection  
**Severity:** S2

**Where**
: Ribbon: References tab > Index group > Mark Entry (Alt+Shift+X). Dispatch: commands.js:903 `H.markEntry = () => { WC.PM.refMarkIndexEntry(); }` (called with no argument and no dialog). Bridge: src/renderer/bridge/references.ts refMarkIndexEntry(info) lines 334-352.

**When / repro**
: Trigger: Mark Entry with no text selected. Repro: 1) Click into a paragraph WITHOUT selecting any text. 2) References > Mark Entry (or Alt+Shift+X). 3) Nothing happens — no dialog, no XE field, no toast. 4) Now select a word and click Mark Entry > an XE field IS created using the selected/word text (the only path that works), but you still cannot specify subentry, cross-reference, page range, or page-number formatting.

**Symptom (Word vs clone)**
: In Word, Mark Entry (Alt+Shift+X) opens the Mark Index Entry dialog (Main entry, Subentry, Cross-reference / Current page / Page range, page-number bold/italic, Mark / Mark All / Cancel, staying open for repeated marking). In the clone there is NO dialog: clicking Mark Entry with nothing selected does nothing at all, and there is no way to enter a main entry, subentry, cross-reference, page range, or formatting.

**Why it happens (root cause)**
: H.markEntry invokes refMarkIndexEntry() with `info === undefined`. In references.ts the `entry` derivation (line 339) yields null, so the function falls into the no-info branch (lines 340-346): it reads docApi().selection.current({includeText:true}).text; with no selection `txt` is empty, the `if (!txt.trim()) return false` (line 344) bails, and the verb degrades to false silently. There is no authoring dialog anywhere to supply text/subEntry/cross-reference/format, so the rich Word dialog is entirely absent.

**Evidence**
: commands.js:903 H.markEntry = ()=>WC.PM.refMarkIndexEntry() (no dialog, no args). references.ts:334-352: undefined info -> entry null -> needs selected/word text or returns false (line 344 `if (!txt.trim()) return false`). The bridge ALREADY accepts a rich `info` object {text, subEntry, ...} (line 339), so only the UI/dispatch is missing.

**Solution**
: Add a Mark Index Entry dialog (e.g. dialogs.js, mirroring crossRefDialogPM/markCitationPM) with Main entry, Subentry, Cross-reference vs Current page vs Page range (bookmark), and bold/italic page-number toggles, plus Mark / Mark All. Wire commands.js:903 H.markEntry to open it and call WC.PM.refMarkIndexEntry({text, subEntry, ...}). The bridge already consumes the object shape, so minimal bridge change (forward subEntry/crossRef/format keys to d.index.entries.insert if not already). Effort M; risk low-medium (new dialog + verify XE OOXML against Word; keep the selection-fallback as the default entry text).

---

## BUG-023 — Next/Previous Endnote navigates footnotes too (no note-type filter)  
**Severity:** S3

**Where**
: Ribbon: References tab > Footnotes group > Next Footnote (split-button ▾ menu). Menu build: commands.js:1559-1568 — line 1564 `'Next Endnote' onClick: () => pm.refNextNote('next')` and line 1565 `'Previous Endnote' ... pm.refNextNote('prev')` (identical to the Footnote items, no type passed). Bridge: src/renderer/bridge/references.ts refNextNote(dir) lines 260-277.

**When / repro**
: Trigger: a doc with both a footnote and an endnote. Repro: 1) Insert a footnote, then later insert an endnote (so both reference nodes exist). 2) Put the caret before both. 3) References > Next Footnote ▾ > Next Endnote. 4) The caret lands on the nearest reference of EITHER type (the footnote), not the next endnote. 5) Repeat Next Endnote — it walks footnote and endnote refs indiscriminately.

**Symptom (Word vs clone)**
: In Word, the Next Footnote split-button menu offers Next Footnote, Previous Footnote, Next Endnote, Previous Endnote, and each jumps strictly to the matching NOTE TYPE. In the clone, the "Next Endnote"/"Previous Endnote" menu items land on FOOTNOTE references as well — endnote navigation is not type-filtered, so it stops on the wrong note kind.

**Why it happens (root cause)**
: refNextNote(dir) collects positions with `if (n === 'footnoteReference' || n === 'endnoteReference') positions.push(pos)` (references.ts:265) — both node types go into one sorted list with no type discrimination, then it jumps to the next/prev position relative to the caret. The ribbon compounds this: the Endnote menu items call refNextNote('next'/'prev') passing only a direction and no note type (commands.js:1564-1565), so the bridge has no way to filter even if it wanted to.

**Evidence**
: commands.js:1564-1565 Next/Prev Endnote both call pm.refNextNote('next'/'prev') with no type. references.ts:260-277: descendants collector at :265 pushes footnoteReference AND endnoteReference into one array with no type filter, then navigates the merged list.

**Solution**
: Add a `type?: 'footnote'|'endnote'` param to refNextNote (references.ts:260): when set, only push the matching reference node ('footnoteReference' for footnote, 'endnoteReference' for endnote); when unset, keep current behavior. Update commands.js:1561-1565 so the Footnote items pass 'footnote' and the Endnote items pass 'endnote'. Effort S; risk low (pure navigation, no document mutation; add a regression test asserting Next Endnote skips footnote refs).

---

## BUG-024 — Themes gallery active checkmark stuck on Aptos/Office (reads static --doc-font)  
**Severity:** S4

**Where**
: Ribbon: Design tab > Document Formatting > Themes gallery. commands.js:691 H.themes passes isActive=(t)=>firstFont(t.body)===currentDocFont(). currentDocFont() at commands.js:704 reads CSS var --doc-font. The var is a static literal at src/renderer/public/styles/base.css:52 (--doc-font: 'Aptos', Calibri, ...). The active styling is rendered in galleryMenu() commands.js:758-760.

**When / repro**
: 1. Open the app. 2. Design > Themes — note Office shows the active check. 3. Apply a non-Office theme (e.g. Celestial). 4. Reopen Design > Themes. Result: Office still shows the active check; the just-applied theme does not.

**Symptom (Word vs clone)**
: In Word the Themes gallery marks the currently-applied theme. In the clone the green check / active outline is permanently stuck on Office/Aptos regardless of which theme is applied. After applying e.g. Celestial or any Garamond/Calibri theme, the gallery still shows Office as active; and every theme whose body family is Aptos would falsely show active. The active-state indicator is meaningless.

**Why it happens (root cause)**
: currentDocFont() returns firstFont(getComputedStyle(documentElement)['--doc-font']) which is always 'Aptos' because base.css:52 hardcodes --doc-font and nothing ever rewrites it. Grep confirms the only setProperty in this path is WC.setThemeColors writing --word-blue (design-tools.js:108-111); no code writes --doc-font on theme/font apply, and deApplyTheme stores font changes in style definitions / docDefaults, not on the documentElement custom prop. So isActive(t) = (firstFont(t.body) === 'Aptos') — true only for Office/Aptos, false for everything else, forever.

**Evidence**
: commands.js:691 isActive uses currentDocFont; commands.js:704 reads --doc-font; base.css:52 static literal; grep: no write to --doc-font on apply (only --word-blue in setThemeColors). Ledger/audit BUG-024 [S4].

**Solution**
: Track the applied theme name in real state instead of inferring from a never-updated CSS var. In deApplyTheme/deApplyFonts (design.ts), record the last-applied theme/font name (e.g. on WC.Design or a converter field) and have H.themes' isActive compare against that; or, minimally, update document.documentElement.style.setProperty('--doc-font', firstFamily(theme.body)) inside deApplyTheme so currentDocFont() reflects reality. Effort S; risk low (cosmetic indicator only). Note --doc-font also drives editor.css:74 doc rendering, so writing it has a beneficial side effect but verify it doesn't conflict with the styles-based font cascade.

---

## BUG-025 — Change Case: sentence-case regex needs space after terminator, toggle is locale-unaware, no Shift+F3  
**Severity:** S3

**Where**
: Home tab > Font group > Change Case dropdown (home.font.change-case). Menu: commands.js:1790-1793 changeCaseMenu -> :1794 changeCase(mode) -> WC.PM.changeCase. Implementation: src/renderer/bridge/commands.ts changeCase(mode) :53-77. Sentence regex :58 /(^\s*\w|[.!?]\s+\w)/g; toggle :59 ch.toUpperCase()/toLowerCase(); caps :57. Missing shortcut: keydown map in src/renderer/public/js/app.js:67-128 (no F3 branch; line 78 'if (!mod) return' drops plain Shift+F3).

**When / repro**
: Sentence case: 1. Type 'first. second.third' and select it. 2. Home > Change Case > Sentence case. 3. Result is 'First. second.third' - 'second' is capitalized (space after '.') but 'third' is NOT (no space after the second '.'). Word capitalizes both. Toggle: 1. Type Turkish 'İ' or 'ı', select, choose tOGGLE cASE; the dotted/dotless i pair is not mapped per Turkish rules. Shortcut: select text and press Shift+F3 - nothing happens (Word cycles UPPER/lower/Capitalize).

**Symptom (Word vs clone)**
: Three Change Case fidelity gaps vs Word. (a) Sentence case fails to recapitalize a new sentence when the terminator has no following whitespace: 'end.New' and 'a.b' stay lowercase after the period, and a sentence ending right before a newline is missed. (b) tOGGLE cASE flips case per character with ASCII-only rules, mishandling locale (Turkish dotless i, German eszett). (c) There is no Shift+F3 keyboard shortcut to cycle case the way Word does; the feature is dropdown-only.

**Why it happens (root cause)**
: In commands.ts changeCase, sentence mode does t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, upper) (line 58). The second alternation requires [.!?] then \s+ (one-or-more whitespace) then \w, so a terminator immediately followed by a letter ('end.New') never matches and stays lowercase; the same \s+ requirement misses a sentence end adjacent to a newline boundary. Toggle mode (line 59) uses ch.toUpperCase()/toLowerCase() with no locale argument, so JS default casing applies ASCII/Unicode-default rules, wrong for Turkish i and German ß. For the shortcut, app.js's single keydown handler returns early at line 78 ('if (!mod) return') for any combo without Ctrl/Meta, and Word's Change Case cycle is plain Shift+F3 (no Ctrl), so it is filtered out; there is also no F3 entry in map() (lines 81-120).

**Evidence**
: audit-bugs.json (Change Case): commands.ts:58 sentence regex needs \s+ after [.!?]; :59 toggle uses ch.toUpperCase()/toLowerCase() (no locale); no Shift+F3 in app.js map. Verified in source: commands.ts:58 /(^\s*\w|[.!?]\s+\w)/g; :59 toggle per-char; app.js:78 'if (!mod) return' + map() :81-120 has no F3 case; menu wiring commands.js:1790-1794.

**Solution**
: Edit bridge/commands.ts changeCase: (1) sentence regex -> allow zero-or-more separators and quotes after a terminator, e.g. /(^|[.!?])\s*["'(]?\w/g or post-process per detected sentence, so 'end.New' capitalizes (S). (2) toggle: locale-aware casing per character, e.g. ch.toLocaleUpperCase(navigator.language)/toLocaleLowerCase(...) (S). (3) Add Shift+F3 handling in app.js keydown: a plain-key branch (before the 'if (!mod) return' guard) that cycles UPPER -> lower -> Capitalize Each Word -> repeat via WC.PM.changeCase (S-M). Risk: low; sentence-regex change must be tested against multi-terminator and quote-leading cases to avoid over-capitalizing decimals/abbreviations. Add regression tests in scripts/test-suite-pm.js for 'end.New', a Turkish toggle, and the Shift+F3 cycle. Effort M overall.

---

## BUG-WATERMARK — Watermark is preview-only CSS (dropped on save); Custom dialog lacks Picture/font/size/transparency  
**Severity:** S2

**Where**
: Ribbon: Design tab > Page Background > Watermark. Gallery + click: commands.js watermarkMenu() 775-799 (cell click line 790 -> WC.PM.deWatermark(label,{})). Apply: src/renderer/bridge/design.ts deWatermark() 243-259 (sets ed.style.backgroundImage, NO markDirty, preview-only toast). Custom dialog: src/renderer/public/js/dialogs.js D.watermark 1044-1058 (text + color + diagonal checkbox only).

**When / repro**
: 1. New doc, type text. 2. Design > Watermark > 'CONFIDENTIAL'. 3. Watermark appears on the page. 4. Save as .docx (note: no unsaved-changes asterisk appears). 5. Reopen the .docx in the clone or Word. Result: no watermark — it was never exported. For the dialog: Design > Watermark > Custom Watermark… shows only Text/Color/Diagonal — no Picture, font, size, or transparency.

**Symptom (Word vs clone)**
: Design > Page Background > Watermark inserts a visible diagonal watermark on screen, but it is a CSS background-image on #pm-editor only — it is NOT written to the document and is silently dropped on save (the doc isn't even marked dirty). Saving and reopening loses the watermark entirely. Also the Custom Watermark dialog is missing most of Word's options: no Picture watermark (with washout), no font, no size, no semitransparent toggle, no horizontal-vs-diagonal beyond a single checkbox, and a reduced preset gallery (7 vs Word's ~16).

**Why it happens (root cause)**
: deWatermark() (design.ts:243-259) only builds an inline SVG and assigns ed.style.backgroundImage on the #pm-editor DOM node; it deliberately does NOT call markDirty and emits the toast 'preview only; renders in the saved file at Phase 7'. Because it never mutates the PM document model / styles.xml / a header part, the converter exports nothing for it, and io.ts's dirty flag (driven by docChanged transactions) is never flipped — so Save doesn't even prompt and the saved .docx has no w:pict header watermark. The dialog (dialogs.js:1044-1058) constructs only text/color/diagonal inputs and passes {color,diagonal} to the same non-exporting deWatermark, so the missing Picture/font/size/transparency fields have nowhere to go anyway.

**Evidence**
: design.ts:243-259 deWatermark sets backgroundImage, no markDirty, preview-only toast; commands.js:775-799 watermarkMenu 7 presets; dialogs.js:1044-1058 D.watermark text+color+diagonal only. Audit JSON: 'NOT exported... silently dropped on save'; ledger extends GAP-B.

**Solution**
: Implement a real watermark as a Word header construct: on apply, write a w:pict (VML/DrawingML WordArt for text, or a washed-out blip for picture) into the section header part and call markDirty so it exports and round-trips (this is the Phase-7 layout/header work referenced in the toast). Expand D.watermark (dialogs.js) to add Picture-vs-Text radio with file picker + washout, plus font, size, color, semitransparent, and horizontal/diagonal layout, and grow the preset gallery toward Word's ~16. Effort L (header-part authoring + dialog); risk medium-high (depends on header/section support, currently deferred). Interim S fix: at least flip markDirty/show an honest 'will not be saved' state so users aren't misled.

---

## SHAPES-STUB — Insert > Shapes gallery is fully rendered but every shape click is a dead toast (nothing inserted)  
**Severity:** S3

**Where**
: Insert tab > Illustrations group > Shapes dropdown. src/renderer/public/js/insert-features.js: SHAPES catalog (96-103), shapesMenu gallery (104-117), Insert.insertShape (118-122 — toast only). Wiring: commands.js:372 H.shapes -> WC.Insert.shapesMenu; commands.js:1516 dropdown branch.

**When / repro**
: 1. New doc, caret in body. 2. Insert tab > Shapes. 3. Full gallery with all categories renders. 4. Click 'Rectangle' (or any shape). 5. A toast appears: 'Inserting "Rectangle" shapes isn't available on the new engine yet.' 6. The document is unchanged — no shape, no anchor, nothing.

**Symptom (Word vs clone)**
: Insert > Shapes opens a complete picker (Lines, Rectangles, Basic Shapes, Block Arrows, Stars/Banners, Callouts with SVG previews). Clicking any shape shows a toast 'Inserting "X" shapes isn't available on the new engine yet.' and inserts nothing. Word inserts a real selectable/resizable/rotatable auto-shape (DrawingML wps:sp) that round-trips. This is the most misleading Insert stub because the UI looks fully functional.

**Why it happens (root cause)**
: The gallery cell click handler (insert-features.js:111) calls Insert.insertShape(name, svg). insertShape (118-122) is a pure toast — it has NO PM verb: it neither calls any WC.PM.* function nor dispatches a transaction. There is no shape node/insertion command on the bridge at all (unlike pictures/icons/WordArt which route to WC.PM.insertImage/xeIcon/xeWordArt). The legacy WC.Editor inline-SVG path was deleted at slice 11 and not replaced, so the feature is an honest-but-complete-looking no-op.

**Evidence**
: insert-features.js:118-122 Insert.insertShape = WC.toast(...) only — no PM verb. Gallery built 104-117; click -> insertShape -> toast. Ledger GAP-B / audit: 'Shapes (dropdown) … EVERY shape click is a dead no-op toast … Nothing is inserted.' No xeShape/insertShape verb exists in any bridge file.

**Solution**
: Implement a shape insertion verb. Add an xeShape/insertShape bridge fn that inserts a real DrawingML auto-shape node (wps:sp) — mirror the existing WordArt DrawingML-blob replay pattern (insert-exotica xeWordArt) to emit a minimal exportable shape with geometry presets, then make insert-features.js:118 call WC.PM.insertShape(presetGeometry, {fill}) instead of toasting. Reuse the existing image-anchor/resize overlay for selection. Effort L (new node type + exporter coverage + selection/wrap). Risk: high — needs schema + super-converter export support and round-trip tests; gated on the floating-object/frames-overlay layout work. Interim S option: insert the gallery SVG as an inline image so the click is not a no-op.

**Related:** BUG-009 (cover banding may need shapes); GAP-B (SmartArt/Chart/3D stubs share the no-PM-verb pattern)

---


## BUG-026 — Page Setup (orientation/size) updates export + pagination but NOT the visual page
**Severity:** S3

**Where**
: Ribbon: Layout > Page Setup > Orientation / Size (now unblocked). `bridge/design.ts:262 dePageSize` / `:249 dePageMargins` write the body `sectPr` via `d.sections.setPageSetup/setPageMargins` and update the PM pagination geometry, but do NOT update the `--page-w`/`--page-h` CSS vars that size the on-screen sheet (the old `setPageVar` paint path, never driven from the new verbs).

**When / repro**
: 1) New doc. 2) Layout > Orientation > Landscape (or Size > A4). 3) The page sheet stays portrait-shaped; 4) View > Page Width zooms to ~170% (fits the stale 816px portrait width). Probe `C:\tmp\bughunt\probes\pagesetup-test.js`; screenshot `pagesetup-landscape.png`.

**Symptom (Word vs clone)**
: In Word, Landscape/A4 immediately reshape the on-screen page. In the clone the export is correct (`sectPr w:pgSz 15840x12240 orient=landscape`, A4 `11909x16834`, margins `720`) and pagination height updates (1056->816), but the visual sheet stays portrait and Page-Width zoom over-zooms. Export/round-trip faithful; render-only.

**Why it happens (root cause)**
: `dePageSize`/`dePageMargins` write `bodySectPr` + sync `converter.pageStyles` + pagination geometry, but nothing reads the new geometry back into the `--page-w`/`--page-h` CSS vars (or re-renders the page container) that determine the drawn sheet size. Model/export tier updates, paint tier doesn't — the keystone render-tier gap.

**Evidence**
: `pagesetup-test.json`: `ORIENTATION.before.vars == after.vars` (`--page-w` 816 unchanged) while `geom.pageH` 1056->816; `pagesetup-landscape.png` shows a portrait sheet at 170% zoom.

**Solution**
: In `dePageSize/dePageMargins` (or a pagination subscriber), after the sectPr write, drive `--page-w`/`--page-h`/`--page-margin` from the new geometry and re-paginate/re-paint. Effort: M. Risk: medium (page-render path; keep export untouched). A CSS-var update is a cheap partial win before the full overlay.

---

## BUG-027 — Adding a bookmark with an existing name creates a duplicate instead of moving it
**Severity:** S3

**Where**
: Ribbon: Insert > Links > Bookmark. `src/renderer/bridge/insert.ts insertBookmark({name})` inserts `bookmarkStart`+`bookmarkEnd` with a fresh id, no de-dupe-by-name.

**When / repro**
: 1) Select word A, Insert Bookmark "MARK". 2) Select word B, Insert Bookmark "MARK" again. 3) Export -> two `<w:bookmarkStart w:name="MARK">` (ids 0 and 1). Probe `C:\tmp\bughunt\probes\retriage-verify.js` -> `BOOKMARK_DUP`.

**Symptom (Word vs clone)**
: Word keeps ONE bookmark per name (re-adding MOVES it). The clone leaves two bookmarks named "MARK" (different ids), so cross-references / hyperlinks / Go-To to "MARK" become ambiguous (Word honors only the first).

**Why it happens (root cause)**
: `insertBookmark` unconditionally inserts a new pair; it never scans for and removes a pre-existing bookmark with the same name. (PM gives distinct ids, so it's a duplicate-NAME bug, not the legacy same-id corruption.)

**Evidence**
: `retriage-verify.json` `BOOKMARK_DUP` = `{startCountSameName:2, ids:["0","1"], duplicateName:true}`.

**Solution**
: In `insert.ts insertBookmark`, before inserting, find + delete any existing `bookmarkStart`/`bookmarkEnd` with `name===opts.name` (move semantics). Effort: S. Risk: low. Add a regression test: one bookmark per name after a re-add.

---

## BUG-028 — Shift+Tab / Decrease Indent on a level-1 list item is a silent no-op
**Severity:** S3

**Where**
: Ribbon: Home > Paragraph > Decrease Indent, and the Shift+Tab keybinding. `changeListLevel.js` (`newLevel<0` branch) returns `true` (key consumed) without removing numbering; `commands.js:71-82 stepIndent` routes an in-list caret to `decreaseListIndent` and never removes the list at `ilvl=0`.

**When / repro**
: 1) Bullet list, caret in a level-1 item. 2) Shift+Tab (or Decrease Indent). 3) Nothing happens — item stays a bullet. Probe `retriage-verify.js` -> `SHIFT_TAB` (`hasNumbering` true before AND after; `keyHandled:true`).

**Symptom (Word vs clone)**
: In Word, Shift+Tab / Decrease Indent on a level-1 list item REMOVES the bullet (outdents to a normal paragraph). In the clone the key is swallowed and the item stays a bulleted level-1 item — the user can't leave the list via Shift+Tab.

**Why it happens (root cause)**
: `changeListLevel(-1)` computes `newLevel = -1`, hits the `newLevel<0` guard, and returns `true` to consume the key without calling `removeNumberingProperties`. Empty transaction (no-op) yet key marked handled.

**Evidence**
: `retriage-verify.json` `SHIFT_TAB` = `{before.hasNumbering:true, after.hasNumbering:true, stillInList:true, keyHandled:true}`.

**Solution**
: In `changeListLevel.js` (and `stepIndent`'s in-list branch), when `ilvl===0` and decreasing, call `removeNumberingProperties` (exists in `core/commands/`) to drop the item out of the list instead of a consumed no-op. Effort: M. Risk: low-medium (test nested + top-level).

---

## BUG-029 — Positioned/floating objects anchor to the whole document, not their own page
**Severity:** S3

**Where**
: Ribbon: Layout > Arrange > Position / Picture Format positioning. Floating-image offset is computed relative to the document/`#pm-editor`, not the object's own page (PM equivalent of the legacy `layout-tools.js position()` bug).

**When / repro**
: On a multi-page doc, position a floating image relative to "Page" — its offset is measured from the document top, not the page it sits on, so it drifts on pages 2+.

**Symptom (Word vs clone)**
: Word anchors a positioned object to its own page (per-page coordinates). The clone's absolute offsets are doc-relative, so "centered on the page" is only correct on page 1.

**Why it happens (root cause)**
: The fork *does* ship a per-page absolute-anchor branch — `imagePositionPlugin.js:153-169` anchors `vRelativeFrom==='margin'` images to the previous DOM node carrying the class `pagination-break-wrapper` (`findPreviousDomNodeWithClass`, imagePositionPlugin.js:214). But the clone's *owned* pagination layer emits `pm-page-spacer` / `pm-gap-band` nodes (pagination.ts:85/97), **never** `pagination-break-wrapper`, so that lookup always returns null and the per-page branch is dead code. Floats fall back to a doc-relative `position:absolute` (image.js:437/615), so per-page anchoring is impossible on pages 2+.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\anchor-print-verify.js` (`anchor-print-verify.json`, 2026-06-17): on a 7-page doc, `pagination-break-wrapper` count = **0** while `pm-page-spacer` = 7 and `pm-gap-band` = 6 (`perPageAnchorBranchDead:true`). Plus legacy re-triage (Layout) — `new-variant`; see `LEGACY-RETRIAGE.md`.

**Solution**
: Make floating offsets page-relative (compute pageIndex from offsetTop, offset within the page). Effort: M-L (ties into the keystone overlay). Risk: medium.

---

## BUG-030 — PDF export / Print capture app chrome (ribbon/titlebar) and the inter-page gap bands
**Severity:** S3

**Where**
: File > Print / Export to PDF. No `@media print` stylesheet hides `#ribbon`/`#titlebar`/`#statusbar`/`.pm-gap-band` or resets page layout for print.

**When / repro**
: 1) File > Print (or Create PDF). 2) Output includes the app chrome (ribbon, title bar) and the gray inter-page gap bands instead of clean pages.

**Symptom (Word vs clone)**
: Word prints/exports clean document pages. The clone prints the whole app UI + gap bands because there's no print stylesheet.

**Why it happens (root cause)**
: The print/PDF path renders the live DOM with no print-specific CSS to strip chrome and the pagination gap bands.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\anchor-print-verify.js` (`anchor-print-verify.json`, 2026-06-17): scanned all 9 loaded stylesheets — **0** `@media print` rules and **0** print-targeted stylesheets, while `#titlebar`, `#ribbon`, `#statusbar`, and `#ruler` are all present in the DOM the print path renders. Plus legacy re-triage (File-IO) — `still-present`; no `print.css`/`@media print` block in `src/renderer/public/styles/`.

**Solution**
: Ship `print.css` with `@media print` hiding `#titlebar,#ribbon,#ruler,#statusbar,#backstage,.pm-gap-band` and resetting page layout; apply during export/print. Effort: S-M. Risk: low.

---

## BUG-031 — Table of Figures / Bibliography inserted twice stacks a duplicate (no replace-in-place)
**Severity:** S4

**Where**
: Ribbon: References > Table of Figures, and References > Bibliography. `bridge/references.ts` — Index and Table-of-Authorities replace-in-place on re-insert, but `refInsertTOF` and `refInsertBibliography` do not.

**When / repro**
: 1) References > Insert Table of Figures. 2) Insert again -> a second ToF is stacked. Same for Bibliography. (Index / ToA correctly replace.)

**Symptom (Word vs clone)**
: Word's Insert/Update replaces the existing ToF/Bibliography in place. The clone stacks a duplicate, while the sibling Index/ToA correctly replace — an internal inconsistency.

**Why it happens (root cause)**
: `refInsertTOF`/`refInsertBibliography` don't scan for and remove an existing node before inserting, unlike the Index/ToA paths.

**Evidence**
: Legacy re-triage (References) — `still-present` + the Index/ToA-vs-ToF/Bib asymmetry; `references.ts` insert paths.

**Solution**
: Mirror the Index/ToA replace-in-place pattern in `refInsertTOF`/`refInsertBibliography` (remove existing node of that kind before inserting). Effort: S. Risk: low.

---

## BUG-034 — Custom Watermark is a CSS-only stand-in and is silently dropped on save
**Severity:** S2

**Where**
: Ribbon: Design > Page Background > Watermark > Custom Watermark…. Dialog `dialogs.js:1044-1058` (Text + Color + Diagonal only). On OK → `WC.PM.deWatermark` → `bridge/design.ts:274-290 deWatermark`, which paints `#pm-editor` `style.backgroundImage` with an inline SVG, **skips `markDirty`**, and toasts "preview only; renders in the saved file at Phase 7". The watermark never becomes a node in the ProseMirror model. Bridge exposed at `bridge/index.ts:389`.

**When / repro**
: 1) Design > Watermark > Custom Watermark, type "CONFIDENTIAL", OK. 2) The diagonal grey text appears on the sheet. 3) Save (.docx) and reopen (or inspect the export) — the watermark is gone.

**Symptom (Word vs clone)**
: Word's Custom Watermark inserts a real header watermark (`w:pict`/VML) that persists in the file and repeats on every page. The clone shows a CSS background preview only; on save the watermark is **silently lost** (no `w:pict`, no `CONFIDENTIAL` text in the export). The dialog is also materially thinner than Word's (no Picture watermark, no Font/Size, no Semitransparent, no Layout radio).

**Why it happens (root cause)**
: The authoring path is a presentational CSS stand-in, not a document construct. `deWatermark` only sets `ed.style.backgroundImage` (inline SVG) and deliberately does not dirty the doc or insert a model node. The super-converter v3 *has* watermark export translators (`handlers/w/pict/helpers/translate-text-watermark.js` / `translate-image-watermark.js`), but those serialize a model node carrying `textWatermarkData` (e.g. one round-tripped from an imported docx); the clone's own dialog produces no such node, so `exportDocx` emits nothing.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s2-formatting.js` (`s2-formatting.json` → `watermark`): `applied:true`, `cssApplied:true` (an `#pm-editor` SVG background-image is painted), but `afterHasWatermark:false` and the whole `exportDocx({exportXmlOnly:true})` is 16 chars — no `w:pict`/VML/`CONFIDENTIAL`. `bugConfirmed:true`.

**Solution**
: On OK, insert a real text/picture watermark node (carrying `textWatermarkData`) into the header story so the existing super-converter translators serialize it to header `w:pict`, and `markDirty`. Then expand the dialog to Word parity (Picture watermark with washout, Font/Size/Color/Semitransparent, Diagonal/Horizontal layout). Effort: M-L (header authoring + dialog rework; export translators already exist). Risk: medium (header XML + per-page repeat is pagination-gated). **Validate the real save via Word COM, not just `exportXmlOnly`.**

---

## BUG-035 — Font dialog (Ctrl+D) accepts Small caps / All caps / Scale / Spacing / Position with live preview but applies NONE on OK
**Severity:** S2

**Where**
: Home > Font dialog launcher (Ctrl+D) → `WC.Dialogs.font` (`dialogs.js:376`). OK steps array `dialogs.js:444-459` applies only font/size/bold/italic/color/underline/strike/super/sub; `dialogs.js:460-461` calls `notifyBlocked('Caps and Advanced font effects')` for Small caps / All caps / Character Scale / Character Spacing / Position. Root: the fork `textStyle` mark (`extensions/text-style/text-style.js addAttributes`) exposes no settable `smallCaps`/`caps`/`characterScale` attribute (`textTransform` is parseDOM-read-only) and there is no `setSmallCaps`/`setCaps` command.

**When / repro**
: 1) Select text, Ctrl+D. 2) Tick **Small caps** and **All caps**, set **Scale 150%** / **Spacing Expanded** — the in-dialog **preview updates**. 3) Click OK. 4) None of those five are applied; only a `notifyBlocked` toast fires. (The font/size/bold/italic/color/underline/strike/super/sub half *does* apply, as one undo step.)

**Symptom (Word vs clone)**
: Word applies all of these run properties on OK. The clone's dialog visibly accepts the input and previews it, then silently drops the five controls — a false affordance. (Word also offers Double strikethrough, Hidden, Engrave/Emboss/Shadow/Outline, underline color, and Set As Default — all absent.)

**Why it happens (root cause)**
: The OK handler only builds a steps chain for run properties the editor can author. For the five blocked controls it calls `notifyBlocked` because the schema mark has no model attribute and no command for them. The super-converter *has* caps/smallCaps/letter-spacing/position translators (imported runs round-trip), but there is no editor command to *author* them, so the dialog can't apply them; the live preview misleadingly implies they work.

**Evidence**
: **Runtime-confirmed** — probe `s2-formatting.js` (`fontDialog`): `hasSmallCapsAttr:false`, `hasCapsAttr:false`, `hasSetSmallCapsCmd:false`, `hasSetCapsCmd:false`; the probe opened the dialog (`dialogOpened:true`), ticked Small caps + All caps (`tickedSmallCaps/tickedAllCaps:true`), set Scale + Spacing, clicked OK (`okClicked:true`) — yet the export has `afterHasSmallCaps:false`, `afterHasCaps:false`, `afterHasCharSpacing:false`. `bugConfirmed:true`. (`textStyleAttrKeys` does include `letterSpacing`, but the dialog's Spacing select still did not author it.)

**Solution**
: Add settable `textStyle` attrs + commands for caps/smallCaps (font-variant/text-transform) and characterScale/characterSpacing, bridge them to the existing v3 translators, and wire the Font dialog OK to emit those steps instead of `notifyBlocked`; separately add the missing UI (double-strike/hidden, underline color, Set As Default). Effort: M-L (converter side exists; gap is editor attrs+commands+bridge). Risk: medium (new run-property marks touch export ordering — validate via real Word COM save).

---

## BUG-036 — Home Shading on a sub-paragraph selection floods the WHOLE paragraph (paragraph-level shd, not run-level)
**Severity:** S2

**Where**
: Home > Paragraph > Shading split button. `commands.js:1838-1842 applyColor` (kind `'shade'`) always dispatches `pm.cmd('updateAttributes','paragraph',{'paragraphProperties.shading':…})`; driven by `H.shading` (`commands.js:93`) and the arrow palette (`commands.js:1849-1861`). The Borders & Shading dialog's "Apply to: Text" option (`shadeApplyTo`, `dialogs.js:1196/1201`) is **ignored** in OK (`dialogs.js:1262-1264` always writes paragraph-level). No run-level shading path exists.

**When / repro**
: 1) Type "alpha beta gamma delta". 2) Select only "beta gamma". 3) Home > Shading > pick yellow. 4) The **entire paragraph** is shaded yellow, not just the selected words.

**Symptom (Word vs clone)**
: Word shades only the selected **runs** (`w:rPr/w:shd`) when a sub-paragraph range is selected, and shades the paragraph (`w:pPr/w:shd`) only when the whole paragraph / no text is selected. The clone always applies paragraph-level shading regardless of selection. Distinct from BUG-002 (render flooding across a page seam), BUG-004 (import: para shd → run highlight), and BUG-015 (highlight EXPORT mark mismatch): this is a selection-semantics + apply-level defect on the Shading button itself.

**Why it happens (root cause)**
: The Shading button (and the B&S dialog Shading tab) unconditionally writes `paragraphProperties.shading` → `w:pPr/w:shd`. The clone has no run-level shading code path at all (its only run-background mark is `highlight`, which Shading never invokes), and the dialog's `shadeApplyTo` value is never read.

**Evidence**
: **Runtime-confirmed (model level)** — probe `s2-formatting.js` (`shading`): with `paraText:"alpha beta gamma delta"` and a strict sub-range selection (`selectionWasSubRange:true`), after the Shading write the model shows `paraLevelShdPresent:true` (`paragraphProperties.shading.fill==='FFFF00'` on the **whole** paragraph) and `runLevelShdPresent:false` (no run-level bg mark confined to "beta gamma"). `bugConfirmed:true`. (Note: the export-XML `w:shd` regex did not match in `exportXmlOnly` mode — paragraph-shd serialization is a separate detail; the flooding defect is confirmed in the document model.)

**Solution**
: Make Shading selection-aware: when the live selection is a non-empty sub-paragraph TEXT range, route to a run-level shading mark (export `w:rPr/w:shd`, analogous to highlight but emitting `w:shd`); fall back to paragraph-level only for whole-paragraph / empty selections. Touch `commands.js:1838-1842` + `dialogs.js:1262-1264` (honor `shadeApplyTo`) and add a run-shading extension/command. Effort: M. Risk: medium (must not collide with the BUG-004/BUG-015 highlight-vs-shd mapping; ship a round-trip regression test).

---

## BUG-037 — Layout > Breaks dropdown is fully dead (blocked + dead `E()` code); zero section-break semantics
**Severity:** S2

**Where**
: Ribbon: Layout > Page Setup > Breaks. `bridge/index.ts:138` maps `breaks:'layout-page'`; `:52` puts `layout-page` in `DEFERRED`; `:157` ENGINE_READY excludes `breaks`; `:158 isBlocked`. Both dispatch heads — `commands.js:1549` (run) and `:1558` (dropdown) — call `notifyBlocked` and return **before** reaching `H.breaks`/`breaksMenu` (`commands.js:530-544`), which is itself dead code: every item calls `E().insertHTML`, but `E=()=>WC.Editor` (`commands.js:8`) and `WC.Editor` was retired in slice 11 (never assigned), so `E()` is undefined.

**When / repro**
: 1) Layout > Breaks. 2) Only a generic "not available on the new engine yet" toast appears — the Page/Column/Next Page/Continuous/Even/Odd flyout is unreachable. There is no way to insert a section break.

**Symptom (Word vs clone)**
: Word's Breaks dropdown inserts page/column/text-wrapping breaks and Next-Page/Continuous/Even/Odd **section** breaks (`w:sectPr`). The clone's Layout Breaks control does nothing. (The only working page break is the Insert-tab control `H.pageBreak → WC.PM.insertPageBreak`, `commands.js:397`, and Ctrl+Enter.)

**Why it happens (root cause)**
: `breaks` is AREA-mapped to the Phase-7-`DEFERRED` `layout-page` and is not whitelisted in `ENGINE_READY`, so `isBlocked('breaks')` is true and both dispatch heads short-circuit to `notifyBlocked`. Separately, the `breaksMenu` body is dead (`E()` undefined post-slice-11).

**Evidence**
: **Runtime-confirmed** — probe `s2-formatting.js` (`breaks`): `blocked_breaks:true`, `area_breaks:"layout-page"`, `deferred_has_layoutPage:true`, `engineReady_has_breaks:false`, and driving `WC.Commands.run({cmd:'breaks'})` produced **no** model/XML change (`breaksRunMutated:false`). The underlying page-break verb *does* work — `WC.PM.insertPageBreak()` built a 7-page doc in the BUG-029 probe (`anchor-print-verify.json`, `pageCount:7`) — so the capability exists; only the Layout dropdown is dead.

**Solution**
: Route Layout > Breaks > Page to `WC.PM.insertPageBreak` (same verb as Insert tab) by not pre-blocking the Page item (add `breaks` to ENGINE_READY for Page, or special-case it before the `isBlocked` head). Section breaks (Next/Continuous/Even/Odd) need the fork's insert-section-break primitive (+ even/odd parity blank page) — genuine Phase-4f section-model work — so a minimal fix wires Page only and keeps section types honestly toasted. Delete the dead `breaksMenu` `E()` calls. Effort: low (Page-only) / medium-high (real `w:sectPr` section breaks). Risk: low for Page-only.

---

## BUG-038 — Insert Link: a bare domain becomes a `file://` path and a bare email gets no `mailto:` (no Word-style scheme inference)
**Severity:** S2

**Where**
: Insert > Links > Link. Dialog `dialogs.js:45-63` (Text to display + Address only; OK passes `addr.value.trim()` RAW to `WC.PM.insertLink`). Bridge `insert.ts:31-37 insertLink → editor.chain().setLink({href,text})`; command `extensions/link/link.js:185-277 setLink → sanitizeLinkHref` (`:192`). Sanitizer `_vendor/superdoc/url-validation/index.js:605-707 sanitizeHref` + `isRelativeUrl:807-819` + `sanitizeRelativePath:496-528` — a scheme-less token is treated as relative and resolved via `new URL(token, window.location.href)` to a `file://` path; no `mailto:` inference.

**When / repro**
: 1) Insert > Link, Address = `example.com`, OK. 2) The link points at `file:///…/example.com` (a broken local path), not `http://example.com`. 3) Address = `a@b.com` → no `mailto:` (broken). (Explicit `https://…`, `mailto:…`, `#anchor` are handled — the last is the separate BUG-012.)

**Symptom (Word vs clone)**
: Word auto-prefixes `http://` for a bare domain and `mailto:` for a bare email. The clone produces wrong/broken hrefs for the two most common inputs. The dialog is also impoverished vs Word (no Existing File/Web Page · Place in This Document · Create New · E-mail categories, no ScreenTip, no Target Frame).

**Why it happens (root cause)**
: The address is passed RAW with no scheme inference; downstream `sanitizeHref` is fail-closed sanitization, **not** scheme-completion. For a scheme-less token `isRelativeUrl()` is true (no `:`) → `sanitizeRelativePath()` does `new URL(token, window.location.href)`; in Electron the base is `file://`, so `example.com` resolves under the app dir and `a@b.com` to a relative path.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s2-insert-ui.js` (`s2-insert-ui.json` → `insertLink`): input `example.com` stored as `file:///C:/Users/ogutd/bughunt-wt/out/renderer/example.com` (`bareDomainIsWrong:true`); input `a@b.com` stored as `null` (`bareEmailIsWrong:true`); control input `https://example.com` stored verbatim (`explicitOk:true`). `bugConfirmed:true`.

**Solution**
: Add Word-style scheme inference before sanitization (in `D.insertLink` OR a normalizer in the bridge `insertLink`): if raw has no scheme and no leading `#`/`/`/`./`/`../`, then if it matches a bare-email pattern prepend `mailto:`, else if it looks like a bare domain prepend `http://`. Effort: ~1-2h incl. a regression test (`insertLink('example.com')→'http://example.com'`, `insertLink('a@b.com')→'mailto:a@b.com'`). Risk: low (purely additive; explicit-scheme and `#anchor` untouched; `sanitizeHref` still the final gate). The richer 4-category dialog is a larger separate UI effort.

---

## BUG-039 — Cross-reference dialog exposes only 2 of Word's 7 reference types and omits the hyperlink / above-below checkboxes
**Severity:** S3

**Where**
: References > Captions > Cross-reference. `commands.js:1022-1060 crossRefDialogPM`: Type select hardcoded `['Heading','Bookmark']` (`:1023`), "Insert reference to" select `['Page number','Text','Above/below']` (`:1024`), footer has no checkboxes (`:1051-1059`). Bridge `references.ts:624-637 refCrossReference → d.crossRefs.insert` (`:633`) is generic over `target.kind`/`display`.

**When / repro**
: 1) References > Cross-reference. 2) The Type dropdown offers only Heading and Bookmark; "Insert reference to" offers only 3 of Word's options; there is no "Insert as hyperlink" and no "Include above/below" checkbox.

**Symptom (Word vs clone)**
: Word offers 7 reference types (Numbered item, Heading, Bookmark, Footnote, Endnote, Equation, Figure/Table) plus "Insert as hyperlink" and "Include above/below". The clone reaches only 2 types and zero checkboxes; the other types/options are simply unreachable from the UI (the underlying insert works for the 2 supported types).

**Why it happens (root cause)**
: The dialog hardcodes the enumerated options and builds no checkbox elements; the engine (`d.crossRefs.insert`) is generic, so the limitation is purely the UI's enumerated lists.

**Evidence**
: **Runtime-confirmed** — probe `s2-insert-ui.js` (`crossRef`): `dialogTitle:"Cross-reference"`, `typeOptions:["Heading","Bookmark"]`, `refOptions:["Page number","Text","Above/below"]`, `checkboxCount:0`. `bugConfirmed:true`.

**Solution**
: Expand `crossRefDialogPM`: add the missing Type entries (Numbered item, Footnote, Endnote, Equation, Figure, Table) with target-enumeration helpers analogous to `headings()`/`listBookmarks()`, add "Insert as hyperlink" + "Include above/below" checkboxes, and pass them through to `refCrossReference` (extend `d.crossRefs.insert` input). Effort: medium (UI + target enumerators + bridge passthrough; engine insert already generic). Risk: low-medium (verify `d.crossRefs.insert` accepts the extra kinds/display modes, else those options silently no-op).

---

## BUG-040 — Text Box "Draw Text Box" is identical to "Simple Text Box" (no drag) and inserts an INLINE box, not a floating one; gallery + Save-to-Gallery missing
**Severity:** S3

**Where**
: Insert > Text > Text Box. `commands.js:473-477 textBoxMenu` renders only "Simple Text Box" + "Draw Text Box", **both** wired to the identical `H.textBox()` (`commands.js:411 → WC.PM.xeTextBox('')`). `insert-exotica.ts:161-162 xeTextBox → editor.commands.insertTextBox`; `extensions/shape-textbox/shape-textbox.js:86-107` does `insertContent` of a `shapeContainer` at the caret with only inline VML attrs `{id,type,style}` — no anchor/wrap. `ribbon-data.js:894-905` declares a built-in gallery + Office.com + Draw + Save to Gallery that the menu doesn't deliver.

**When / repro**
: 1) Insert > Text Box. 2) The menu shows only two items; "Draw Text Box" does not give a drag-to-place cursor — it immediately inserts the same box as "Simple Text Box". 3) The inserted box is inline (flows with text), not a page-anchored floating box. 4) No styled gallery, no "Save Selection to Text Box Gallery".

**Symptom (Word vs clone)**
: Word's Text Box offers a styled gallery (~30 presets), "Draw Text Box" (drag to place a **floating** box), and "Save Selection to Text Box Gallery". The clone offers two items wired to the same handler, inserts an inline shape with no positioning, and lacks the gallery/save. (Separately, clone reopen degrades the textbox to `passthroughInline` per `deferrals.md:389`.) Distinct from BUG-029 (page-relative anchoring of already-floating objects).

**Why it happens (root cause)**
: `textBoxMenu` renders two items both calling `H.textBox()`, which inserts a `shapeContainer>shapeTextbox` at the caret carrying only inline VML attrs — no floating/anchor/wrap — so the box is inline. The advertised gallery/Draw/Save affordances (ribbon-data) are never built.

**Evidence**
: **Confirmed (model + code)** — probe `s2-insert-ui.js` (`textBox`): after `WC.PM.xeTextBox('')`, `shapeContainerFound:true` with `shapeAttrKeys:["fillcolor","sdBlockId","style","wrapAttributes","attributes"]` and `hasFloatingAnchorAttr:false` (inline, not floating). Both menu items dispatch the same `H.textBox` (`commands.js:473-477`, code). (The probe's VML-export string check did not match in `exportXmlOnly` mode — an export-serialization detail, not the deviation; the inline-not-floating + identical-handlers defect is confirmed.)

**Solution**
: (1) Shippable now, low risk: complete `textBoxMenu` to match ribbon-data — add a styled-preset gallery submenu (each passing distinct `{text/fill/width/height/style}` to `xeTextBox`) and a "Save Selection to Text Box Gallery" item, and stop wiring "Draw Text Box" to the identical inline handler. (2) Layout-gated, medium risk: make "Draw Text Box" insert a FLOATING/anchored box (add anchor + wrap attrs and a `<wp:anchor>` export path), and fix the reopen `passthroughInline` editability loss — track alongside BUG-029 / Phase-4 floating-objects.

---

## NOT-REPRODUCED note — Track Changes "Reject" skip-adjacent (theorized, not confirmed)
The S2-audit triage theorized that `H.reject` (`commands.js:1393` = `rejectChange` then `nextChange`, unconditional) can skip the next **adjacent** revision because `nextChange` (`review.ts:405-411`) uses a strict `c.from > pos` filter. Probe `C:\tmp\bughunt\probes\s2-trackchanges.js` attempted to build two adjacent tracked deletions but they landed non-adjacent (`A.to=25`, `B.from=27`, `adjacent:false`); rejecting A then advancing left the caret at 24, **before** B (`skippedB:false`) — correct behavior in the non-adjacent case. The skip-adjacent defect requires `B.from === A.to` exactly, which the probe could not construct, so it is **unconfirmed** (neither reproduced nor refuted). Logged transparently rather than promoted to a numbered bug. The audit's *primary* "Accept caret-off-change advances without accepting" framing was separately judged **not-a-bug** (Word parity). If revisited, change `nextChange`'s predicate to `c.from >= pos` (`review.ts:409`) and add an adjacent-changes regression test.

---

## BUG-041 — Find/Replace "Use wildcards": quantifiers `{n}`, grouping `(..)`, and `@` are escaped to literal characters (wrong/zero matches); Replace backrefs inserted verbatim
**Severity:** S3

**Where**
: Home > Editing > Replace / Find > Advanced Find (with "Use wildcards" on). `core/superdoc-fork/extensions/search/SearchIndex.js:466-510 wildcardToRegExp` supports only `? * < > [..] [!..]` and `\`-escape; the final else (`:507`) escapes `{ } ( ) @` to literal. `search.js:690-691` builds the RegExp via `wildcardToRegExp`; `search.js:810 replaceSearchMatch` and `:875 replaceAllSearchMatches` both insert `state.schema.text(replacement)` VERBATIM — no `\1..\9` / `^&` substitution.

**When / repro**
: With "Use wildcards" checked: 1) Find `te{2}st` → finds nothing (Word matches "teest"). 2) Find `(a)(b)`, Replace `\2\1` → nothing happens (Word swaps to "ba"). Any Word wildcard using `{n}`/`{n,m}`, `@`, or `(..)` grouping returns wrong/zero results.

**Symptom (Word vs clone)**
: Word's "Use wildcards" honors the full grammar — `{n}`/`{n,m}` repeat, `@` one-or-more, `(..)` grouping, and Replace backrefs `\1..\9` / `^&`. The clone silently treats `{ } ( ) @` as literal characters, so valid Word wildcards match nothing (or the wrong thing) with no error or disclosure — a silently-wrong ("lying") control. (`NOT_IMPLEMENTED.md:82` even marks "support group back-references in replacement" as done, which the code does not do.) Distinct from BUG-018 (Replace pane hiding the options row): this is the wildcard **engine** + replace-substitution gap, reachable from Find/Advanced Find where the options ARE exposed.

**Why it happens (root cause)**
: `wildcardToRegExp` implements only a subset of the grammar; `{n}`, `@`, and `(..)` fall through to the generic escape branch and become literal RegExp characters, so `te{2}st` becomes a literal-brace search. Separately the Replace path inserts the replacement string literally via `schema.text()`, so backrefs would be written into the document as literal text rather than substituted.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3-search.js` (`s3-search.json`): find `te{2}st` with `useWildcards:true` → `qmatchCount:0` (quantifier treated as literal braces — zero matches where Word finds "teest"); find `(a)(b)` then `replaceAllSearchMatches('\2\1')` → `replacedCount:0`, doc unchanged (`"ab"`) because the grouping parens are also literal, so the pattern matches nothing. (The backref-substitution sub-claim could not be *exercised* at runtime because grouping itself fails first; it remains code-confirmed at `search.js:810/875` — verbatim `schema.text()` insert.)

**Solution**
: Extend `wildcardToRegExp` to map `{n}`/`{n,m}`→`{n}`/`{n,m}`, `@`→`+`, and `(..)`→capture groups (track group count); and in `replaceSearchMatch`/`replaceAllSearchMatches`, when `useWildcards`, substitute `\1..\9` and `^&` from the match groups instead of inserting verbatim. Effort: medium (~half day incl. tests). Risk: low-medium — keep plain `? * < > [..]` behavior unchanged and preserve "wildcards are always case-sensitive"; add a regression test in `scripts/test-suite-pm.js`.

---

## BUG-042 — Sort Text dialog: Type=Date sorts by the leading number (not chronologically); "Date" silently reuses the numeric path
**Severity:** S4

**Where**
: Home > Paragraph > Sort. `commands.js:2007-2028 sortDialog` (Type = Text/Number/Date); the OK handler (`:2021`) sets `numeric = (type.value !== 'Text')` — so **Date shares the Number branch**. `bridge/commands.ts:100-105 sortParagraphs` sorts numeric with `parseFloat(node.textContent)||0` (`:102`); there is no date parsing anywhere.

**When / repro**
: 1) Type four paragraphs of dates ("March 5, 2024", "January 12, 2024", "December 31, 2023", "February 1, 2024"). 2) Home > Sort, Type = **Date**, Ascending, OK. 3) The order is not chronological — the paragraphs are left effectively unsorted (each date string `parseFloat`s to `NaN→0`).

**Symptom (Word vs clone)**
: Word's Sort with Type=Date parses the dates and orders chronologically. The clone routes Date through the numeric `parseFloat` path, so date strings sort by any leading number (or, for month-name-first strings, all collapse to `0` and stay in input order). The dialog presents Date as a working type but produces wrong output — a lying control. (The other audit sub-claims — no multi-key, no Options…, no field sort, no case-sensitive toggle — are honest feature-completeness reductions, not bugs.)

**Why it happens (root cause)**
: The OK handler collapses Date and Number into one `numeric` flag and there is no date comparator; `sortParagraphs` only knows text vs `parseFloat`. Selecting Date runs `parseFloat` over date strings, which is unrelated to chronology.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3-misc.js` (`s3-misc.json` → `sortDate`): `sortParagraphs({ascending:true,numeric:true})` on the four date strings returned `orderedTexts` = input order, `matchesChrono:false` (NOT the chronological `expectedChrono`). (Month-name-first strings all `parseFloat→NaN→0`, so the numeric sort is effectively a no-op rather than chronological.)

**Solution**
: Route Type=Date through a real date branch (`Date.parse` / a small locale-aware d-m-y parser, fall back to text on unparseable) instead of reusing `numeric parseFloat`; thread a `type`/`dateSort` opt from `sortDialog` (`commands.js:2021`) into `sortParagraphs` and add a date comparator. Effort: small-medium. Risk: low (isolated to the Date branch; Text/Number unchanged). Add a regression test sorting date strings.

---

## BUG-043 — Date & Time: the "Update automatically" checkbox is never read; the clone always inserts an auto-updating DATE field (no static-text option)
**Severity:** S4

**Where**
: Insert > Text > Date & Time. `insert-features.js:186-196 Insert.dateTimeDialog` builds the `upd` ("Update automatically") checkbox at `:190`, but the OK handler (`:193`) calls `WC.PM.xeDateTime(format)` and never reads `upd.checked`. `bridge/insert-exotica.ts:118-123 xeDateTime` is hardwired to `insertField('DATE \@ "<fmt>"')` with no static-text branch. H wiring `commands.js:461`/`:1602`.

**When / repro**
: 1) Insert > Date & Time, pick a format, **uncheck** "Update automatically", OK. 2) The inserted date is still an auto-updating DATE field — unchecking did nothing. (Word inserts a plain static text run when unchecked, a DATE field when checked.)

**Symptom (Word vs clone)**
: Word toggles between a static text snapshot (unchecked) and a DATE field (checked). The clone offers the choice in the dialog but silently discards it and always inserts a DATE field — a lying control. (Only 6 formats, no Language selector, and no Default button are separate feature-completeness reductions, not bugs.)

**Why it happens (root cause)**
: `xeDateTime` unconditionally inserts a DATE field; there is no code path that inserts plain text for the unchecked case, and the OK handler never passes the checkbox state.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3-misc.js` (`s3-misc.json` → `dateTimeField`): `WC.PM.xeDateTime('M/d/yyyy')` (exactly what the OK handler runs regardless of the checkbox) → `inserted:true`, `hasDateField:true` (a `DATE \@` field instruction in the export) unconditionally; there is no variant that yields a plain static text run.

**Solution**
: In the `dateTimeDialog` OK handler read `upd.checked` and, when unchecked, insert the preformatted date string as plain text (e.g. an `xeDateTime(fmt, {field:false})` overload that inserts the rendered text snapshot via `insertContent` when `field===false`). ~10-line additive change, low risk. Optionally widen the format list + add a Language selector for fuller parity (separate, larger effort).

---

## BUG-044 — Table of Contents "Automatic Table 1" and "Automatic Table 2" collapse to a byte-identical block; the heading caption is silently dropped
**Severity:** S3

**Where**
: References > Table of Contents > Automatic Table 1 / Automatic Table 2. `commands.js:930-931` passes `refInsertTOC({title:'Contents'})` vs `refInsertTOC({title:'Table of Contents'})`, but `bridge/references.ts:114-134 refInsertTOC` reads only `showLevels*/hyperlinks/rightAlignPageNumbers/includePageNumbers/tabLeader` — it **never reads `opts.title`**. The fork create path (`core/superdoc-fork/document-api-adapters/plan-engine/toc-wrappers.ts`) has no title concept (`CreateTableOfContentsInput` has no title field; `materializeTocContent` emits only entry paragraphs or the "No table of contents entries found." placeholder).

**When / repro**
: 1) References > TOC > Automatic Table 1. 2) Undo, then Automatic Table 2. 3) Both produce an identical TOC block — neither shows its Word heading ("Contents" vs "Table of Contents"). The two gallery presets are indistinguishable.

**Symptom (Word vs clone)**
: Word seeds a visibly different heading caption above the field result — "Contents" (Automatic Table 1) vs "Table of Contents" (Automatic Table 2). The clone drops the title at the bridge and the fork has no caption concept, so both presets are byte-identical generic blocks. Same family as BUG-009 (gallery presets collapsing to one generic block) but a distinct control/code, so not a duplicate.

**Why it happens (root cause)**
: Two gaps stack — `refInsertTOC` ignores `opts.title`, and even if threaded the fork TOC node has no styled-caption-paragraph path.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b2-references.js` (`s3b2-references.json` → `toc_presets_identical`): after inserting both presets, `snapshotsDeepEqual:true`, `hasContentsCaption:false`, `hasTableOfContentsCaption:false`; both nodes' leading text is "No table of contents entries found." (`bugConfirmed:true`).

**Solution**
: Thread `opts.title` through `refInsertTOC` into the create input, and extend `CreateTableOfContentsInput`/`prepareTableOfContentsInsertion` to prepend a styled caption paragraph (e.g. `styleId 'TOCHeading'`) carrying the title ahead of the entries, so the two presets differ as in Word. Effort: M. Risk: low. Regression test: the two presets produce different leading captions. (The page-number="0" placeholder is the separate Phase-7 layout gap.)

---

## BUG-045 — Citation Style chosen before any bibliography exists is silently lost; the ribbon toasts success anyway (lying control)
**Severity:** S3

**Where**
: References > Citations & Bibliography > Style. `commands.js:999` (`H.style` flyout) fires `WC.toast('Citation style: <X>')` **unconditionally**, ignoring the return of `refSetCitationStyle`. `bridge/references.ts:577-597 refSetCitationStyle` returns `false` when no bibliography node exists (no global persistence); `references.ts:611-619 refInsertBibliography` inserts with `{at:{kind:'documentEnd'}}` only and never reads the chosen style. The selection lives only in cosmetic `references-tools.js:14 WC.Ref.citationStyle`, which the engine never reads (the `references.ts:576` comment falsely claims "refInsertBibliography carries it through").

**When / repro**
: 1) New doc (no bibliography yet). 2) References > Style > IEEE → toast says "Citation style: IEEE" (success). 3) Insert a bibliography → it renders in the fork default (APA), not IEEE. The chosen style was silently dropped.

**Symptom (Word vs clone)**
: In Word, citation style is a global document setting — choosing it before any bibliography exists is honored, and any later bibliography + in-text citations render in that style. The clone's control is a no-op on the no-bibliography-yet path yet toasts success — a lying control. (The happy path — bibliography already present — DOES work via `bibliography.configure` + `syncBibliographyStyleToConverter`. The "6 styles vs Word's 12+" sub-claim is fewer-options, not a bug.)

**Why it happens (root cause)**
: `refSetCitationStyle` bails to `false` with no persistence when no bibliography node is found; the style is never written to global document/converter settings, so a later bibliography is built at the default.

**Evidence**
: **Runtime-confirmed** — probe `s3b2-references.js` (`citation_style_no_persist`): `refSetCitationStyle('IEEE')` on a doc with no bibliography → `setReturnedFalse:true` (rejected, not persisted), while `commands.js:999` would toast success. (The downstream "bibliography uses APA" assertion needs seeded sources to render a non-empty bibliography, so the empty-export path is not asserted here; the no-persistence + lying-toast root cause is confirmed.)

**Solution**
: Persist the citation style globally the moment it is chosen, independent of whether a bibliography node exists: in `refSetCitationStyle`, when no bibliography is found, still call `syncBibliographyStyleToConverter` (or write document settings) and return `true`; make `refInsertBibliography` read that persisted style. Gate the `commands.js:999` toast on the actual return value, and fix the misleading `references.ts:576` comment. Effort: S-M. Risk: low.

---

## BUG-046 — Quick Tables: every named preset (Calendar / Tabular List / Matrix / Double Table) inserts an identical empty grid; the preset name carries no template
**Severity:** S3

**Where**
: Insert > Table > Quick Tables. `insert-features.js:88-93 quickTablesMenu` maps each preset to a bare `buildTable(rows,cols)` (Calendar→6×7, Tabular List→4×2, Matrix→4×4, Double Table→5×3); `insert-features.js:40-43 buildTable` forwards only `{rows,cols}` to `WC.PM.insertTable`; `bridge/table.ts:34-40 insertTable` runs `editor.chain().insertTable({rows,cols,withHeaderRow:false})` — no cell content, banding, per-preset style, or quick-table metadata.

**When / repro**
: 1) Insert > Table > Quick Tables > Calendar (or Matrix, Tabular List, Double Table). 2) The result is an empty grid of the preset's dimensions with the generic TableGrid style — no month layout, no header text, no sample data, no banding. Every named preset is just a plain empty grid of a fixed size.

**Symptom (Word vs clone)**
: Word's Quick Tables insert fully-styled building-block templates (Calendar with month headers and day cells, Tabular List with headers, Matrix with banding, etc.). The clone collapses every preset to a dimension-only empty grid — the preset identity carries no payload. Same defect *class* as BUG-009 (named gallery designs collapsing to a generic block) but a distinct control/code, so a separate bug, not a literal duplicate. No Quick Tables entry exists in `NOT_IMPLEMENTED.md`/`FEATURE-IMPROVEMENTS.md`, so it is not an honestly-disclosed stub.

**Why it happens (root cause)**
: The preset→geometry mapping forwards only `{rows,cols}`; there is no per-preset template (header text, sample data, banding/style) and no content-aware insert path.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b2-quicktables-fix.js` (`s3b2-qt-fix.json`): each preset inserts at its expected dimensions (`dimsMatchExpected:true`) but with `nonEmptyCells:0`, `headerCells:0`, `tblStyle:"TableGrid"` for **all** of them (`allPresetsEmptyNoHeaderText:true`); the named "Matrix" preset is structurally identical to a plain `insertTable(4×4)` (`matrixStructurallyIdenticalToPlainGrid:true`). `bugConfirmed:true`.

**Solution**
: Replace the geometry-only mapping with real per-preset templates (header text + sample data + a table style/banding), routed through a content-aware insert (extend `WC.PM.insertTable` to accept `cells[][]`/`styleId`/`withHeaderRow`, or add `WC.PM.insertQuickTable(templateKey)`). Round-trip test per preset asserting header text + `tblStyle` survive export. If full templates are out of scope, honest-degrade (drop the preset names or a "styled Quick Tables not available yet" toast) + a `NOT_IMPLEMENTED.md` entry. Effort: M. Risk: low-medium.

---

## BUG-047 — Source Manager ▸ Edit silently destroys authors 2+ on any multi-author source (data loss)
**Severity:** S2 (data loss)

**Where**
: References > Citations & Bibliography > Manage Sources > Edit. `dialogs.js:1317-1323 editPrefill` reads only `f.authors[0]` into a flat "Last, First" string; `dialogs.js:1333` routes the flat patch to `WC.PM.refUpdateSource`. `bridge/references.ts:553-562 refUpdateSource → buildSourceFields` (`:483-498`) + `personFromString` (`:462-482`) synthesize `authors:[ONE person]` from the flat string; the fork update `core/superdoc-fork/document-api-adapters/plan-engine/citation-wrappers.ts:320` does `Object.assign(source.fields, patch)`, overwriting the original multi-author array.

**When / repro**
: 1) Add a source with 2 authors (e.g. Smith + Jones). 2) Manage Sources > Edit that source, change **only the title**, OK. 3) The source now has just **one** author (Smith) — Jones is permanently gone.

**Symptom (Word vs clone)**
: In Word, editing a source's title leaves all authors intact. In the clone, opening Edit on any 2+-author source and saving — even a title-only change — silently collapses the author list to a single author. Permanent data loss in the citation/bibliography data.

**Why it happens (root cause)**
: `editPrefill` collapses the source to `authors[0]` only; on OK the flat `{author:'Last, First', title, …}` patch is rebuilt by `buildSourceFields → personFromString` into `authors:[ONE]`, and the fork's `Object.assign(source.fields, patch)` overwrites the original 2-author array. (The documented "single Current List / no Master List" reduction is an honest fewer-panes deviation; this data loss is a separate defect surfaced while verifying the cited dialog code — matches none of BUG-001..046/DEV-1 and is not a documented stub.)

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b3-misc.js` (`s3b3-misc.json` → `refSourceMgrMultiAuthor`): a source created with `authors:[Smith, Jones]` (`beforeAuthorCount:2`), then `refUpdateSource(id, {author:'Smith, Alice', title:'…(edited)', …})` → `afterAuthorCount:1`, `afterTitle:"Two Author Book (edited)"`, `DATA_LOSS:true` (the title updates but author 2 is destroyed).

**Solution**
: Make the Edit round-trip non-destructive for contributors. In `dialogs.js` editPrefill/Edit flow, start the patch from a deep copy of `s.fields` and only overwrite the simple fields the dialog edits; OR make `refUpdateSource` skip overwriting `authors` when the patch carries only a legacy singular `author` string AND the source already has multiple authors; OR have `buildSourceFields` not synthesize a one-element `authors` array in that case. Longer term, a real multi-author editor (the fork's `CitationPerson[]` is already supported). Effort: S-M. Risk: low. Regression test: `refUpdateSource(title-only)` on a 2-author source preserves `authors.length===2`.

---

## BUG-048 — Merge/Keep-Source paste silently drops bold/italic/underline on docx export (save+reopen data loss)
**Severity:** S2 (data loss on save+reopen)

**Where**
: Home > Clipboard > Paste > Merge Formatting / Keep Source Formatting. `bridge/clipboard.ts:159-168 pasteMergeHtml/pasteMerge → editor.view.pasteHTML` (the strip logic at `:35-39/:60-70 mergeFormattingHtml` is itself correct); Keep-Source `PM.pasteHTMLString` (`bridge/index.ts:484-488`) goes through the same `editor.view.pasteHTML` route. Root cause is downstream in the exporter run translator (`core/superdoc-fork/core/super-converter/exporter.js`): the fork paste parser emits a doubly-nested `run` node wrapping the mark-bearing text, and the translator does not read text-level emphasis marks off that nested structure, emitting bare `<w:r><w:t>` with no `<w:rPr>`.

**When / repro**
: 1) Copy text with bold/italic/underline. 2) Paste > Merge Formatting (or Keep Source Formatting). 3) On screen the emphasis is present, but Save as .docx and reopen → the bold/italic/underline are **gone** (exported as plain runs). Merge Formatting is specifically supposed to preserve emphasis while dropping font/size/color — so the one thing it must keep is lost on save.

**Symptom (Word vs clone)**
: Word's Merge/Keep-Source paste preserves run-level emphasis through save. The clone keeps the marks in the live model but drops them on docx export — data loss that only surfaces on save+reopen, defeating the merge mode. Not merge-specific: Keep-Source paste loses the same marks (shared `view.pasteHTML` route), while `insertContent` of the same HTML exports correctly.

**Why it happens (root cause)**
: After paste the run-level marks ARE in the PM model (descendants carry `bold`/`italic`/`underline`), but the exporter's run translator doesn't read emphasis off the nested `run`-wrapping-`run` node the fork paste parser produces, so it emits `<w:r><w:t>…</w:t></w:r>` with no `<w:rPr>`. (The `mergeFormattingHtml` strip logic works as designed — the audit's "approximate" note is an honest deviation, not this bug.)

**Evidence**
: **Runtime-confirmed with a control** — probe `s3b3-misc.js` (`s3b3-misc.json`): Merge-paste of `<p><b>B</b><i>I</i><u>U</u></p>` → model `modelMarks:[textStyle,bold,italic,underline]` but export `xmlHasBold/Italic/Underline:false` (`EMPHASIS_DROPPED:true`). The CONTROL — same HTML via `insertContent` — exports `<w:b/>`/`<w:i/>`/`<w:u/>` (`CONTROL_OK:true`), isolating the defect to the `view.pasteHTML` route. Keep-Source paste (`pasteHTMLString`) reproduces it (`SAME_DEFECT:true`), confirming the shared root cause.

**Solution**
: In the exporter run translator (`super-converter/exporter.js`), flatten the nested `run`-wrapping-`run` structure the paste parser produces and read text-level emphasis marks (bold/italic/underline/strike/links) when synthesizing `<w:rPr>`; OR normalize the paste output so marked text lands in a single run node whose runProperties reflect the marks (as `insertContent` does). Fixing this one site also repairs Keep-Source paste fidelity. Effort: M. Risk: medium (export run-property path — validate via a real Word COM save). Regression test: merge-paste and keep-source-paste `<b>/<i>/<u>` HTML, export, assert `<w:b/>/<w:i/>/<w:u/>` present.

---

## BUG-049 — Word Count dialog ignores the selection (no Word-style "N of M words" row)
**Severity:** S4

**Where**
: Review > Proofing > Word Count. `dialogs.js:264-274 D.wordCount` renders whole-document totals only and never reads `c.selWords`. The bridge DOES compute the selection word count (`bridge/io.ts:51-53` — `selWords` = words in `textBetween(sel.from, sel.to)`) and returns it in `counts()` (`io.ts:54`); the only consumer today is `statusbar.js:72`.

**When / repro**
: 1) Type "one two three four five". 2) Select "one two". 3) Review > Word Count. 4) The dialog shows "Words: 5" (whole-doc), not Word's "2 of 5 words" for the selection.

**Symptom (Word vs clone)**
: Word's Word Count dialog shows "N of M words" when a range is selected. The clone always shows whole-document totals, discarding the already-computed `selWords`. (The "Include textboxes, footnotes and endnotes" checkbox is an acknowledged faithful no-op, not this defect.)

**Why it happens (root cause)**
: `D.wordCount` builds its rows purely from whole-document totals and never reads `c.selWords`, even though `counts()` returns it.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b4-chrome.js` (`s3b4-chrome.json` → `wordCount`): with "one two" selected, `selWords:2`, `totalWords:5`, the `#modal-root` dialog text shows "Words\n5" only (`dialogShowsOfFormat:false` — no "2 of 5"). `bugConfirmed:true`.

**Solution**
: In `D.wordCount`, when `c.selWords > 0`, render the Words row as "selWords of words" (Word's "N of M" format); ideally apply the same to Characters/Paragraphs/Lines (extend `io.ts counts()` to return `selChars`/`selParas`). No new bridge plumbing needed for the Words row. Effort: S. Risk: low.

---

## BUG-050 — View ▸ Navigation Pane checkbox never reflects the pane's open/closed state (lying control)
**Severity:** S4

**Where**
: View > Show > Navigation Pane (declared `type:"checkbox"` at `ribbon-data.js:2574`, id `view.show.navigation-pane`). `commands.js:507 H.navigationPane = (c,node) => WC.Dialogs.navPane();` — never calls `markChecked(node)`. `dialogs.js:297-313 D.navPane` toggles `#nav-pane` by remove-if-present. Contrast siblings `H.ruler` (`commands.js:500`) and `H.gridlines` (`:501-506`), which call `markChecked` (`:2163`); `navigationPane` is absent from `TOGGLE_MAP` (`ribbon.js:35`) and has no `stateRule` (`ribbon.js:608`).

**When / repro**
: 1) View > Navigation Pane → the pane opens. 2) The ribbon checkbox stays **unchecked** even though the pane is open. 3) Click again → pane closes (blind toggle decoupled from the checkbox).

**Symptom (Word vs clone)**
: Word's Navigation Pane checkbox reflects the pane's actual open state. The clone's checkbox never latches — it's a lying control. (The absent Pages-thumbnail/Results-search/drag-reorder features are a separate, larger feature gap.)

**Why it happens (root cause)**
: The handler only calls `WC.Dialogs.navPane()` and never sets the control's checked class; it isn't in `TOGGLE_MAP` and has no state rule, so the checkbox state is never updated.

**Evidence**
: **Runtime-confirmed** — probe `s3b4-chrome.js` (`navPane`): after one dispatch, `paneOpen:true` (`#nav-pane` present) but `toggledAfterOpen:false` (the checkbox never gains `.toggled`); `toggledBefore:false`; a second dispatch yields `paneClosed:true`. `bugConfirmed:true`.

**Solution**
: Have `D.navPane` return its new open/closed boolean and set the control class in the handler: `H.navigationPane = (c,node) => { const open = WC.Dialogs.navPane(); if (node) node.classList.toggle('toggled', !!open); }` (mirrors `H.ruler`/`H.gridlines`); or register a `stateRule` whose `latched()` checks `#nav-pane`. Effort: S. Risk: low.

---

## BUG-051 — Text Effects ▸ Outline width presets export invalid OOXML color `CURRENTCOLOR` → Word drops the outline color on save+reopen
**Severity:** S3 (data loss / OOXML corruption on save)

**Where**
: Home > Font > Text Effects and Typography > Outline > a width preset (¾/1/1½/2¼/3 pt). `commands.js:584-585 outlineMenu` applies the `textOutline` mark with `color:'currentColor'` (a CSS keyword). Export bridge `core/superdoc-fork/core/super-converter/styles.js:776-778` passes the value verbatim; the v3 translator `…/v3/handlers/w/w14-textOutline/textOutline-translator.js:34-47` does `String(o.color).replace(/^#/,'').toUpperCase()` → `'CURRENTCOLOR'` and emits `<w14:srgbClr w14:val="CURRENTCOLOR"/>` (invalid OOXML — must be 6 hex digits). The separate "Outline Color…" picker (`commands.js:587`) passes a real hex and round-trips fine.

**When / repro**
: 1) Select text, Home > Text Effects > Outline > "1 pt outline". 2) Save as .docx, reopen in Word. 3) The outline color is gone (Word treats the unparseable `srgbClr` as no/black color).

**Symptom (Word vs clone)**
: Word's outline width presets apply an outline in the current text color that persists. The clone stores the CSS keyword `currentColor`, which the exporter uppercases into the invalid hex `CURRENTCOLOR`; Word can't parse it, so the user's outline color is lost on save+reopen.

**Why it happens (root cause)**
: The width presets store the CSS keyword `'currentColor'` instead of a resolved RGB hex. It renders fine on-screen (`-webkit-text-stroke`) and survives the model + bridge unchanged, but the export translator's `.toUpperCase()` produces an invalid OOXML color rather than resolving the keyword to a hex.

**Evidence**
: **Runtime-confirmed via the full .docx package** — probe `C:\tmp\bughunt\probes\s3b4-outline-save.js` saved real .docx files (`WC.PM.exportDocxBytes()` → `wordAPI.saveBytes`); unzipping `word/document.xml` shows the width-preset file containing `<w14:srgbClr w14:val="CURRENTCOLOR" />` (invalid), while the `#FF0000` control file contains valid `<w14:srgbClr w14:val="FF0000" />`. (Note: `exportDocx({exportXmlOnly:true})` omits `w14:textOutline` entirely — the corruption only surfaces in the full package, a textbook case of "validate the real save, not `exportXmlOnly`".) The model stores `textOutline.color === 'currentColor'` (confirmed by `s3b4-outline-fix.json` `modelOutlineColor`).

**Solution**
: Resolve the outline color to a real RGB hex before export. Best: in `outlineMenu` (`commands.js:585`) don't store the keyword for width presets — resolve the run's effective text color (fall back to `#000000`) and store that hex, mirroring "Outline Color…". Defense-in-depth: in `styles.js:777` or the translator decode, coerce any non-hex color (`currentColor`, named CSS colors) to a valid 6-hex `srgbClr` (resolve `currentColor` → the run's `w:color`, default `000000`). Effort: S-M. Risk: low. Regression: assert the width-preset Outline export emits a valid `w14:srgbClr`, not `CURRENTCOLOR`. (Same class of "render-fine-but-export-invalid" as a real save defect — always Word-COM-validate.)

---

## BUG-052 — Font Color theme picks are down-converted to static hex on save (no `w:themeColor`); the advertised Gradient submenu is absent
**Severity:** S3

**Where**
: Home > Font > Font Color (split). `commands.js:1819-1861 applyColor/colorMenu → pm.cmd('setColor', literalHex)`; `util.js:109-140 WC.colorPalette` (Theme swatches pass their resolved hex, no theme-slot id; no gradient branch); `core/superdoc-fork/extensions/color/color.js:50-55` (the color mark carries only a `color` hex, no `themeColor` attr); `core/superdoc-fork/core/super-converter/exporter.js:587-602` (run color exports `w:color w:val=<hex>`, never `w:themeColor`); ribbon advertises "Gradient" at `ribbon-data.js:223,230`.

**When / repro**
: 1) Select text, Font Color > pick a **Theme Color** (e.g. Blue, Accent 1, Lighter 80%). 2) Save .docx. 3) The run is hard-coded to that hex (`w:color w:val="D9E2F3"`), not theme-linked — so changing the document theme doesn't re-color it (Word's theme colors do). Also: the ribbon advertises a "Gradient" text-fill submenu that doesn't exist.

**Symptom (Word vs clone)**
: Word writes `w:color w:themeColor="accent1" w:themeTint="…"` for theme picks so the run re-themes; the clone writes a raw hex, breaking the theme linkage (a silent fidelity/data-linkage loss). The import side (`color-translator.js`) *does* round-trip `themeColor`, so re-saving a Word doc also loses it. The "Gradient" advertisement is a lying tooltip/item.

**Why it happens (root cause)**
: The palette has no theme-slot concept — Theme swatches pass a resolved hex into `setColor`, which stores a plain `color` string; the exporter never emits `w:themeColor`. `colorPalette` has no gradient branch at all.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b5-model.js` (`s3b5-model.json` → `fontColorTheme`): after a theme-tint pick, the export contains `<w:color w:val="D9E2F3" />` with `hasThemeColor:false`, `modelMarkHasThemeColor:false`, and `gradientInPalette:false`.

**Solution**
: Carry theme linkage end-to-end: tag Theme swatches with a stable slot id (accent1..6/text1-2/bg1-2 + tint/shade) and pass `{color, themeColor, themeTint|themeShade}` to `onPick`; extend the color mark schema with `themeColor/themeTint/themeShade`; in `exporter.js` emit `w:themeColor` (+tint/shade) when present (the importer already round-trips these); recompute resolved hex on theme change. Separately, implement a Gradient submenu or stop advertising it. Effort: M. Risk: low-medium. Regression: a theme pick exports `w:themeColor` and survives round-trip.

---

## BUG-053 — "Select All Text With Similar Formatting" selects one contiguous range, sweeping in non-matching text (corruption path)
**Severity:** S3

**Where**
: Home > Editing > Select > "Select All Text With Similar Formatting". `bridge/commands.ts:141-168 selectSimilarFormatting` computes only the FIRST and LAST byte positions of matching runs, then issues ONE contiguous `TextSelection {from:first, to:last}` (`:158-167`); wired at `commands.js:1995`.

**When / repro**
: 1) Type bold "AAAA", plain " plain middle ", bold "BBBB". 2) Caret in the first bold run. 3) Select > Select All Text With Similar Formatting. 4) The selection spans "AAAA plain middle BBBB" — including the non-bold "plain middle". 5) Apply any mark → the previously-plain middle text is corrupted with it.

**Symptom (Word vs clone)**
: Word selects only the discontiguous matching runs (a multi-range selection). The clone, limited to PM's single-range `TextSelection`, sweeps every intervening non-matching run into one contiguous selection, so "similar formatting" selects dissimilar text too — and any subsequently applied mark/style corrupts the in-between text.

**Why it happens (root cause)**
: PM `TextSelection` is single-range; `selectSimilarFormatting` collapses matches to `{first, last}` instead of representing the discontiguous set. (An in-code comment calls it a "recorded deviation," but it's a real behavioral defect with a corruption path.)

**Evidence**
: **Runtime-confirmed** — probe `s3b5-model.js` (`selectSimilar`): caret in the first bold run, `selectSimilarFormatting()` → selection `from:2,to:28`, `selectedText:"AAAA plain middle BBBB"`, `includesPlainMiddle:true`.

**Solution**
: Faithful fix needs multi-range selection (a custom Selection or a decoration-based pseudo-selection set that the format commands iterate). Minimum bar: when matches are discontiguous, select only the run at/nearest the caret (or toast "multi-range select-similar not yet supported") rather than silently over-selecting — so a later mark can't corrupt in-between text. Effort: M-L. Risk: medium. Regression: the applied-mark span excludes the intervening plain run.

---

## BUG-054 — Text Effects ▸ Shadow and Reflection are silently dropped on docx export (no `w14:shadow`/`w14:reflection` translators)
**Severity:** S3 (data loss on save)

**Where**
: Home > Font > Text Effects > Shadow / Reflection. Menu `commands.js:590-603 shadowMenu/reflectionMenu` set `textShadowW14`/`textReflection` via `applyTE`; schema `core/superdoc-fork/extensions/text-style/text-style.js:215-221` stores + renders them in-app. But the export switch `core/superdoc-fork/core/super-converter/styles.js:772-784` handles **only** `textOutline` + `textGlow` (explicit comment: "Shadow + reflection are stage-2b … deferrals A.1"); `rpr-translator.js:241-245` re-hydrates only outline/glow. No `w14-shadow`/`w14-reflection` handler dir exists (only `w14-textOutline`, `w14-glow`, `w14-ligatures`, `w14-numForm`, `w14-numSpacing`, `w14-stylisticSets`, `w14-cntxtAlts`). (`handlers/w/shadow/shadow-translator.js` is the legacy boolean emboss prop, not `w14:shadow`.)

**When / repro**
: 1) Select text, apply Text Effects > Shadow (e.g. Bottom Right) and/or Reflection. 2) The effect shows on screen. 3) Save .docx and reopen → the shadow/reflection are gone.

**Symptom (Word vs clone)**
: Word persists `w14:shadow`/`w14:reflection`. The clone applies a saved-looking effect that vanishes on save — a lying control. **Distinct from BUG-051** (Outline writes an *invalid* `w14:textOutline` with unresolved `currentColor` — written-but-wrong); here Shadow/Reflection are written **nowhere**.

**Why it happens (root cause)**
: The export run-properties switch has no case for `textShadowW14`/`textReflection` and no w14 translator is registered, so the model attrs are never serialized (a known stage-2b deferral, but a silent data drop from the user's view).

**Evidence**
: **Runtime-confirmed via the full .docx package** — probe `C:\tmp\bughunt\probes\s3b5-export.js` (`s3b5-export.json`): the model holds both marks (`modelHasShadow:true`, `modelHasReflection:true`), but unzipping `word/document.xml` from the saved `te-shadow-reflection.docx` finds **zero** `w14:shadow`/`w14:reflection`, while the positive control `te-outline-ctrl.docx` contains `2 × w14:textOutline` (proving the harness/grep work and the absence is real).

**Solution**
: Add `w14:shadow` + `w14:reflection` translators mirroring the `w14-textOutline`/`w14-glow` pair (shadow: `w14:shadow` with blurRad EMU, dist/dir polar from dx/dy, `w14:srgbClr`+alpha; reflection: `w14:reflection` blurRad/stA/stPos/endA/endPos/dist/dir/fadeDir per preset — oracle-derive the numeric values from live Word), register them in `rpr-translator.js`, and add `textShadowW14`/`textReflection` cases to the `styles.js` export switch (+ import rehydration). Until then, honest-degrade (a "deferred" toast) so the menu doesn't silently drop the effect. Effort: M-L. Risk: medium (validate via Word COM). Regression: `w14:shadow`/`w14:reflection` appear in the exported full-package `document.xml`.

---

## BUG-055 — Line Spacing Options / Paragraph dialog OK silently destroys an exact/at-least line rule (even when only the indent was changed)
**Severity:** S3 (with an S2-grade data-loss path)

**Where**
: Home > Paragraph > Line Spacing > Line Spacing Options… (and the Paragraph dialog launcher). `dialogs.js:221-261 D.paragraph`; the line-rule clobber at `dialogs.js:251-252` (always writes `lineRule:'auto'`) + the dropdown limited to 6 multiples at `dialogs.js:232-236` (can't represent exact/atLeast); seed at `state-sync.ts:142-159` (forces `lineSpacing=null` for exact/atLeast imports).

**When / repro**
: 1) A paragraph with "Exactly 14 pt" line spacing (`lineRule:'exact'`, imported or set). 2) Open the Paragraph dialog to change **only the indent**; the line dropdown sits at its default (1.15) because it can't show "Exactly". 3) Click OK. 4) The exact rule is destroyed — the paragraph becomes "Multiple 1.15" (`lineRule:'auto'`, line 276).

**Symptom (Word vs clone)**
: Word preserves a line rule it doesn't touch. The clone's OK handler unconditionally writes `spacing.line = round(1.15*240) = 276` and `lineRule:'auto'` regardless of whether the user touched line spacing, silently converting an exact/atLeast rule to Multiple 1.15. (The dialog is also a 6-row subset — no Special indent, no line-rule selector, no Line-and-Page-Breaks tab, no Tabs, no preview — but those are honest reductions; the unconditional clobber is the bug.)

**Why it happens (root cause)**
: The seed forces `lineSpacing=null` for un-representable rules, so the dropdown defaults to 1.15; the OK handler then writes that default + `lineRule:'auto'` unconditionally. The fork model/converter fully support `lineRule:'exact'/'atLeast'` (round-trip tests exist), so this is a dialog-handler defect, not an engine limit.

**Evidence**
: **Runtime-confirmed** — probe `s3b5-model.js` (`lineSpacingClobber`): seeding `{line:280, lineRule:'exact'}` then replaying the dialog's OK writes (indent-only intent) yields `{line:276, lineRule:'auto'}` — the exact rule and its 280-twip value are gone.

**Solution**
: (1) Stop the clobber: only write `spacing.line`/`lineRule` when the user actually changed the line-spacing control (track the seeded value; skip if unchanged), and never force `lineRule:'auto'` on a paragraph whose existing rule is exact/atLeast. (2) Restore parity: add a line-rule selector (Single/1.5/Double/At least/Exactly/Multiple) + "At" field, a Special indent dropdown (first-line/hanging) + By, and a Line-and-Page-Breaks tab (all already supported by the model/translator). Effort: M. Risk: low-medium. Regression: the dialog's indent-only path preserves a pre-existing `lineRule:'exact'`.

---

## BUG-056 — Custom Table of Contents dialog: the "Tab leader" select is a dead/lying control (never read on OK)
**Severity:** S3

**Where**
: References > Table of Contents > Custom Table of Contents…. `commands.js:942-961 customTOCDialog()`: the leader select is built at `:945` (`['……… (dots)','------ (dashes)','(none)']`), but the OK handler (`:954-958`) calls `WC.PM.refInsertTOC({ includePageNumbers, showLevels, rightAlignPageNumbers })` and **never reads `leader.value`**. The bridge `references.ts:114-126 refInsertTOC` DOES support `opts.tabLeader` (`:125`), and the fork serializes it (`toc-switches.ts:378-387 tabLeader→separator`, `:282-284` emits the `\p "<sep>"` switch / the TOC entry `w:tab w:leader`). Only the dialog→bridge hop is missing.

**When / repro**
: 1) References > Custom Table of Contents. 2) Change "Tab leader" to dashes (or none). 3) OK. 4) The inserted TOC still uses dotted leaders — the choice had no effect. Every leader selection produces identical output.

**Symptom (Word vs clone)**
: Word's Custom TOC "Tab leader" actually changes the leader between TOC entries and page numbers. The clone presents the option but discards it on OK, so dots/dashes/none all yield the default dots — a lying control.

**Why it happens (root cause)**
: The OK handler omits `leader.value` from the `refInsertTOC` call. (Secondary: the select's option labels are display strings, not the bridge enum values `dot`/`hyphen`/`none`, so a fix must map label→enum.)

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b6-toc.js` (`s3b6-toc.json` → `customTocTabLeader`): replaying the dialog's exact `refInsertTOC` args (no `tabLeader`) exports a TOC entry tab with `w:leader="dot"` and no `\p` override (`dialogHasP:false`); passing `tabLeader:'hyphen'` exports `w:leader="hyphen"` (`hyphenHasP:true`). The bridge differentiates leaders; the dialog path never sends one.

**Solution**
: In `customTOCDialog()` OK handler read the leader select, map label→enum (`{'……… (dots)':'dot','------ (dashes)':'hyphen','(none)':'none'}`), and add `tabLeader` to the `refInsertTOC` opts — a ~3-line dialog-side fix (bridge + serialization already work end-to-end). Effort: S. Risk: low. Regression: different leaders produce different `w:leader`/`\p` in the export.

---

## BUG-057 — "Manual Table" TOC harvests the document headings instead of inserting Word's literal placeholder rows
**Severity:** S3

**Where**
: References > Table of Contents > Manual Table. `commands.js:937` wires the "Manual Table" item to `WC.PM.refInsertTOC({showLevels:3})` — the **same** auto-TOC verb as Automatic Table 1/2. `references.ts:114-134 refInsertTOC` unconditionally calls `d.create.tableOfContents()` (the heading-collecting auto builder); there is no manual/literal-placeholder path. (Disclosed as a slice-9 deferral at `deferrals.md:381`, but not surfaced in-UI and not in the bug-hunt NOT_IMPLEMENTED.md/FEATURE-IMPROVEMENTS.md.)

**When / repro**
: 1) A doc with Heading 1 paragraphs ("Alpha", "Beta"). 2) References > Table of Contents > **Manual Table**. 3) Instead of Word's type-it-yourself placeholder rows ("Type chapter title (level 1)", …), the clone inserts an auto field TOC that has harvested "Alpha"/"Beta".

**Symptom (Word vs clone)**
: Word's "Manual Table" inserts literal placeholder paragraphs in TOC styles (no heading collection, no field) for the user to type over. The clone runs the auto heading-collecting builder — wrong output Word never produces for this command, and a misleading/degrading control (not an honest "not implemented" toast). Distinct from BUG-044 (Automatic 1/2 collapse via dropped title) and BUG-031 (re-insert duplication).

**Why it happens (root cause)**
: "Manual Table" shares the auto-TOC bridge verb; there's no manual-placeholder code path.

**Evidence**
: **Runtime-confirmed** — probe `s3b6-toc.js` (`manualTable`): after Manual Table on a doc with "Alpha"/"Beta" headings, the inserted TOC node text is `"Alpha0Beta0"` (`harvestedHeadings:true`) and contains no `"Type chapter title"` placeholder (`hasManualPlaceholder:false`).

**Solution**
: Give "Manual Table" its own non-auto path — insert literal placeholder paragraphs in TOC1/TOC2/TOC3 styles carrying Word's "Type chapter title (level N)" text + a right-aligned tab + page-number slot, with NO field and NO heading collection (a `refInsertManualTOC` verb or a `{manual:true}` branch that builds placeholders directly instead of `d.create.tableOfContents()`). Effort: S-M. Risk: low. Regression: after Manual Table on a doc with headings, the block contains the literal "Type chapter title" placeholder and not the heading captions.

---

## BUG-058 — Mailings Preview Results resolves only MERGEFIELD; composite fields (Address Block, Greeting Line) keep their «placeholder»
**Severity:** S3

**Where**
: Mailings > Preview Results. `bridge/mail.ts:28-38 mmPreview()` hard-filters at `:31` (`if (n.type.name !== 'fieldAnnotation' || n.attrs.fieldType !== 'MERGEFIELD') return`), so only MERGEFIELD `displayLabel`s are updated. `mailings-tools.js:144-148 _previewMap()` only builds value entries for recipient column names (`this.fields`), never `__AddressBlock__`/`__GreetingLine__`/MERGEREC/MERGESEQ.

**When / repro**
: 1) Mail merge with a recipient list, insert a Merge Field + an Address Block. 2) Preview Results ON (toast "Preview on, record 1 of N"). 3) The Merge Field shows the record value, but the Address Block still shows `«AddressBlock»`.

**Symptom (Word vs clone)**
: Word's Preview Results swaps **every** field to its evaluated value. The clone resolves only simple MERGEFIELDs; ADDRESSBLOCK/GREETINGLINE/MERGEREC/MERGESEQ stay as raw guillemet placeholders while the toggle reports "on" — a lying control. (Distinct from BUG-008, which is the exported OOXML of these fields; this is the in-app live preview. The merge path `mmBuildMerge` *does* resolve composites, so only the preview path is deficient.)

**Why it happens (root cause)**
: `mmPreview` filters to `MERGEFIELD` and `_previewMap` only knows recipient columns, so composite/record fields are never evaluated during preview.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b7-mail.js` (`s3b7-mail.json` → `preview`): with preview ON, the MERGEFIELD node `displayLabel:"John"` (resolved) but the ADDRESSBLOCK node `displayLabel:"«AddressBlock»"` (unresolved). `bugConfirmed:true`.

**Solution**
: In `mmPreview` stop hard-filtering to MERGEFIELD; evaluate composite/record types too (reuse the `composite()` resolver at `mailings-tools.js:129-131` already used by Finish&Merge) and restore `defaultDisplayLabel` on toggle-off. Also ensure a Save while preview is ON doesn't persist preview values. Effort: M. Risk: low-medium.

---

## BUG-059 — Mailings Finish & Merge ignores the Directory merge type; emits a page break between every record
**Severity:** S3

**Where**
: Mailings > Finish & Merge > Edit Individual Documents. `mailings-tools.js:171-182 finishMerge('edit')` calls `WC.PM.mmBuildMerge(recipients, resolve)` which (`bridge/mail.ts:39-57`) **always** joins records with `BREAK` (a `manual-break` page-break div, `:42`/`:56`), never consulting `this.mergeType`. The app DOES store a real mergeType — `startMailMerge('directory')` (`commands.js:1097` flyout → `mailings-tools.js:18`) sets `mergeType='directory'` — but neither `finishMerge` nor `mmBuildMerge` reads it.

**When / repro**
: 1) Start Mail Merge > **Directory**. 2) Insert fields, select recipients. 3) Finish & Merge > Edit Individual Documents. 4) The merged document has a page break after every record. Word's Directory merge concatenates records **continuously** (no per-record page break).

**Symptom (Word vs clone)**
: For Letters/Email a per-record page break is correct; for **Directory** Word emits none. The clone emits one regardless — wrong output for the Directory type, from a half-wired control (mergeType is selectable but ignored). (Not BUG-008, which is field-code export; not the BUG-008 SKIPIF/NEXTIF note, a different missing branch.)

**Why it happens (root cause)**
: `mmBuildMerge` unconditionally `.join(BREAK)`s the per-record HTML and never branches on `mergeType`.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b7-directory.js` (`s3b7-directory.json`): with `mergeType:"directory"` and 2 recipients, `WC.PM.mmBuildMerge(...)` output contains a `manual-break`/`break-after:page` BREAK between the records (`pageBreaksBetweenRecords:2` hits on the one BREAK div). `bugConfirmed:true`.

**Solution**
: In `mmBuildMerge` (or `finishMerge`) branch on `mergeType`: for `directory` join records with no break (continuous), for letters/email keep the page break. Effort: S. Risk: low. Regression: a Directory merge of N records produces 0 page breaks.

---

## BUG-060 — Mailings Labels: the "Full page of the same label" checkbox is inert (never read)
**Severity:** S3

**Where**
: Mailings > Labels. `mailings-tools.js:193-203 labels()`: the "Full page of the same label" checkbox is declared at `:196` and placed at `:198`, but its `.checked` is **never read** — `buildHTML()` (`:197`) unconditionally emits a full cols×rows grid of identical label cells.

**When / repro**
: 1) Mailings > Labels, **uncheck** "Full page of the same label", New Document. 2) The result is still a full page of identical labels (e.g. 30 cells for Avery 5160 3×10), not a single label.

**Symptom (Word vs clone)**
: Word's checkbox toggles between a full sheet of identical labels and a single label. The clone always produces the full grid regardless — a lying control.

**Why it happens (root cause)**
: `buildHTML()` always emits the full grid; the `fullPage` checkbox's state is never consulted.

**Evidence**
: **Runtime-confirmed** — probe `s3b7-mail.js` (`labels`): opened the dialog, **unchecked** the full-page box (`uncheckedIt:true`), clicked New Document → the doc has `cellCountAfterUncheck:30` (full Avery 5160 grid). `bugConfirmed:true`.

**Solution**
: Read `fullPage.checked` in the New-Document handler; when unchecked, emit a single populated label cell (or one row) instead of the full grid. Effort: S. Risk: low.

---

## BUG-061 — Mailings: CSV recipient lists with a UTF-8 BOM prepend `﻿` to the first field name (breaks the first merge field)
**Severity:** S3

**Where**
: Mailings > Select Recipients > Use an Existing List (CSV). `mailings-tools.js:232-248 parseCSV` does no BOM stripping — the leading `﻿` is not a quote/delimiter/CR/LF so it falls through to `else field += c` (`:244`) and is prepended to the first header cell. `main.js:304` reads the CSV with `fsp.readFile(filePath,'utf8')`, which decodes the BOM bytes into the string rather than stripping them. `useExistingList` (`:36-56`) then sets `fields = rows[0]` (`:51`).

**When / repro**
: 1) A CSV saved with a UTF-8 BOM (Excel's default "CSV UTF-8"). 2) Use an Existing List → the first column is named `﻿FirstName` instead of `FirstName`. 3) Inserting that merge field exports as `MERGEFIELD ﻿FirstName` and never matches the data.

**Symptom (Word vs clone)**
: Word strips the BOM. The clone keeps it, corrupting the first field name throughout the merge — a common, silent data defect for Excel-exported CSVs.

**Why it happens (root cause)**
: Neither the file read (`utf8` without BOM stripping) nor `parseCSV` removes the leading `﻿`.

**Evidence**
: **Runtime-confirmed** — probe `s3b7-mail.js` (`csvBom`): `WC.Mail._parseCSV('﻿FirstName,LastName\n…')` → `rows[0][0] === "﻿FirstName"`, `firstCharCode:65279` (0xFEFF). `bugConfirmed:true`.

**Solution**
: Strip a leading `﻿` in `parseCSV` (`if (i===0) text = text.replace(/^﻿/, '')`) and/or in the main-process read. Effort: S (1 line). Risk: low. Regression: a BOM-prefixed CSV yields `rows[0][0] === "FirstName"`.

---

## BUG-062 — References Bibliography dropdown: the chosen title (Bibliography / References / Works Cited) is ignored; no title heading is emitted
**Severity:** S3

**Where**
: References > Bibliography > Bibliography / References / Works Cited. `bridge/references.ts:611-619 refInsertBibliography(_title?)` accepts a title from the flyout (`commands.js:1001 insertBib(t)`) but **never uses it** — it calls `d.citations.bibliography.insert({at:{kind:'documentEnd'}})` with no title. (The fork's bibliography insert input has no title slot; an in-code comment notes threading it through `style` would corrupt the export.)

**When / repro**
: 1) References > Bibliography > "Works Cited". 2) The inserted block has no "Works Cited" heading — it's identical to picking "Bibliography" or "References".

**Symptom (Word vs clone)**
: Word's three built-in choices insert a styled heading ("Bibliography"/"References"/"Works Cited") above the field. The clone ignores the choice and emits no heading — all three produce identical output. (Related to BUG-031 — ToF/Bibliography re-insert duplication — but a distinct title-dropping defect.)

**Why it happens (root cause)**
: `refInsertBibliography` discards the `_title` argument; no styled-caption paragraph is inserted.

**Evidence**
: **Runtime-confirmed** — probe `s3b7-mail.js` (`bibTitle`): exporting after `refInsertBibliography('Bibliography')`, `('References')`, and `('Works Cited')` yields byte-identical `document.xml` for all three (`allThreeIdentical:true`) with no `Works Cited` heading run (`worksCitedHeadingPresent:false`). `bugConfirmed:true`.

**Solution**
: Thread the title into a styled heading paragraph (e.g. `styleId 'BibliographyHeading'`/'Heading 1') prepended to the bibliography block — analogous to the BUG-044 TOC-caption fix — without routing it through the citation `style` field. Effort: S-M. Risk: low.

---

## BUG-063 — Draw Lasso Select drops a stroke that is <60% inside the loop and is ink-only / delete-only (Word selects partial enclosure)
**Severity:** S3 (code-confirmed)

**Where**
: Draw > Lasso Select. `bridge/ink-overlay.ts:262-277 finishLasso` selects a rendered ink stroke only when `inside / total > 0.6` (`:274`); it iterates only `.pm-ink-stroke` overlay elements (`:265`); `deleteSelected` (`:393-396`) is Delete/Backspace-only (no move/recolor). Wiring `commands.js:732 H.lassoSelect = () => WC.PM.dSetLasso()`; `draw.ts:104 dSetLasso` sets `tool='lasso'`.

**When / repro**
: 1) Draw > Lasso, loop around a stroke that's ~50% enclosed. 2) The stroke is not selected ("No strokes inside the loop"). 3) Lasso also can't select shapes/images (ink only), and selected strokes can only be deleted (not moved/recolored).

**Symptom (Word vs clone)**
: Word's Lasso selects any object **fully or partially** enclosed, across object types, and supports move/format. The clone requires >60% enclosure, is ink-only, and delete-only.

**Why it happens (root cause)**
: The `inside/total > 0.6` threshold drops partially-enclosed strokes; the selection set is restricted to `.pm-ink-stroke`; `deleteSelected` is the only operation.

**Evidence**
: **Code-confirmed** (the lasso gesture is impractical to synthesize headlessly): `ink-overlay.ts:274` literally gates selection on `inside / total > 0.6`; `:265` queries only `.pm-ink-stroke`; `:393-396` handles only Delete/Backspace. Word's enclosure rule is partial-or-full across object types.

**Solution**
: Match Word's enclosure rule — select a stroke if ANY sampled point is inside the loop (or anchor the threshold far below 0.6); extend the selectable set beyond `.pm-ink-stroke` to shapes/images; add move/format to the lasso selection. Effort: M. Risk: low-medium.

---

## BUG-064 — Mailings Rules ▸ Next Record (NEXT) never advances the record cursor; it's stripped and records stay page-broken
**Severity:** S3

**Where**
: Mailings > Rules > Next Record. Insert: `commands.js:1112` ("Next Record" → `WC.PM.mmInsertRule('NEXT','NEXT')`, `:1105`). Merge: `bridge/mail.ts:51` (`code==='NEXT' → '__NextRecord__'`) and `mail.ts:39-57 mmBuildMerge` (models a merge as one-record-per-output-block joined by a hard page `BREAK`, `:56`; **no record cursor**). Resolver `mailings-tools.js:131` (`composite('__NextRecord__') → ''`). Export `…/v3/handlers/w/sdt/helpers/translate-field-annotation.js:14,57` (NEXT ∈ EMPTY_FIELD_CODES → a structurally-valid but inert 3-run field).

**When / repro**
: 1) A label/directory template with a `«Name»` field and a Next Record field. 2) Merge 2 records. 3) The clone outputs "Name: Alice" + a page break + "Name: Bob" — the NEXT did nothing. Word's NEXT advances the data cursor **mid-page**, packing multiple records onto one page (the basis of label sheets, Directory, and Update Labels).

**Symptom (Word vs clone)**
: Word's NEXT consumes the next data row within the same page. The clone strips NEXT (`__NextRecord__ → ''`) and always emits one record per page-broken block, so multi-record-per-page layouts are impossible. (Shares the `mail.ts:56` unconditional-`BREAK` root with BUG-059; overlaps BUG-008's "no NEXTIF/SKIPIF logic" note, but the specific NEXT record-advance no-op is logged by neither.)

**Why it happens (root cause)**
: `mmBuildMerge` has no record-cursor concept — it maps recipients 1:1 to page-broken blocks and resolves NEXT to an empty string rather than advancing the cursor.

**Evidence**
: **Runtime-confirmed** — probe `C:\tmp\bughunt\probes\s3b8-next2.js` (`s3b8-next2.json`): a template with `«Name»` + a NEXT field, merged over `[{Name:'Alice'},{Name:'Bob'}]`, returns HTML where both `Alice` and `Bob` resolved (`hasAlice/hasBob:true`) but are separated by a `manual-break` page break (`breaksBetweenRecords:2` on the one BREAK div) and the NEXT left no residue (`nextStripped:true`) — NEXT did not pack the records onto one page. `bugConfirmed:true`.

**Solution**
: Give `mmBuildMerge` a record cursor: walk the template runs and, on a NEXT (or satisfied NEXTIF) sentinel, advance an index into `recipients[]` and keep emitting into the **same** block (no `BREAK`) with the next record's values; emit the page `BREAK` only at the per-page template boundary. Pair with BUG-059 (suppress the per-record BREAK for Directory). Effort: M. Risk: medium. Regression: a NEXT-containing template with 2 recipients yields both on one page (zero `manual-break` between them).

---

## BUG-065 — Draw ▸ Select Objects can't select non-ink objects (ink-only, no marquee, no move/resize)
**Severity:** S3 (code-confirmed)

**Where**
: Draw > Select Objects. `commands.js:731 H.selectObjects = () => WC.PM.dSetSelect()`; `bridge/draw.ts:103 dSetSelect()` only sets `drawState.tool='select'; drawState.on=true`; `bridge/ink-overlay.ts:163` `onDown` for `tool==='select'` calls `selectAt(p)` and returns without starting a marquee; `selectAt()` (`ink-overlay.ts:255`) hit-tests **only** `.pm-ink-stroke` elements.

**When / repro**
: 1) Insert a shape/image/text box. 2) Draw > Select Objects, click it. 3) Nothing is selected (only ink strokes are selectable). There is no marquee/rubber-band selection, and selected strokes can't be moved or resized.

**Symptom (Word vs clone)**
: Word's "Select Objects" arrow click- and marquee-selects any floating object (shapes, images, text boxes, ink) and supports move/resize. The clone routes it through the ink-overlay's draw-tool state machine, which only hit-tests ink strokes and offers no marquee or transform — a lying control (the arrow labelled "Select Objects" can't select objects). Same class as BUG-063 (Lasso): an ink-overlay tool that doesn't reach body-level objects.

**Why it happens (root cause)**
: `dSetSelect` drives the ink overlay rather than Word's body-level object-pick arrow; `selectAt()` matches only `.pm-ink-stroke`, and `onDown` returns immediately for the select tool (no marquee), with no move/resize wired.

**Evidence**
: **Code-confirmed** (interactive overlay behavior; the deviations are negative facts — can't select non-ink objects, no marquee, no move/resize — with no model/XML/dialog artifact to assert, and the gesture is impractical to synthesize headlessly, like BUG-063): `ink-overlay.ts:255 selectAt()` queries only `.pm-ink-stroke`; `:163 onDown` returns for `tool==='select'` before starting a drag; `draw.ts:103 dSetSelect` sets only `tool='select'`.

**Solution**
: Wire the Draw-tab Select Objects arrow to the existing image/shape frame-selection machinery so it can click- and marquee-select any floating object (ink, shapes, images, text boxes) and move/resize them, instead of routing through the ink-only overlay. Effort: M. Risk: low-medium.

---
