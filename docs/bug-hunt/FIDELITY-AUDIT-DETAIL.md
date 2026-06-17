# ms-word-clone — Full Fidelity Audit (every control vs Word)

Generated from the 14-area, 321-control exhaustive audit. Each entry: what Word does vs what the clone does, code evidence (file:line), edge-case flows to test, and an improvement note. Parity: **bug** (broken/wrong/corrupts) · **deviation** (works, differs from Word) · **stub** (UI present, no real effect) · **gap** (missing) · **match** (faithful).

**Totals:** 321 controls — 27 bug · 181 deviation · 41 stub · 34 gap · 38 match

---

## Design tab (Document Formatting + Page Background)  
_21 controls audited_

### Style Set gallery (9 cells) — BUG · S2
- **Word vs clone:** Word style sets restyle Title/Headings/Normal (font, size, color, spacing, borders per set — e.g. Lines adds heading underlines, Shaded shades headings). Clone gallery shows 9 names (Default, Basic (Simple), …, Word 2013) but deApplyStyleSet only has a 3-entry map keyed on DIFFERENT names ('No Paragraph Space'/'Compact'/'Double'); none of the 9 gallery names match, so EVERY click falls to the same default Normal-spacing preset (before0/after160twips/line259). All 9 cells produce an identical result and none matches Word.
- **Evidence:** design-tools.js:102 STYLE_SETS names; bridge/design.ts:103-116 SETS map keyed 'No Paragraph Space'/'Compact'/'Double' → preset=SETS[name]||default; gallery passes the STYLE_SETS name so SETS[name] is always undefined → default branch.
- **Edge cases to test:** click each of the 9 cells (all identical); click 'Default' (applies after-160/line-259, not a true reset); cell only changes Normal spacing, never heading fonts/sizes
- _needsRuntime: false_

### Watermark (galleries: Confidential/Disclaimers/Urgent) — BUG · S2
- **Word vs clone:** Word inserts a real WordArt/header watermark (w:pict in header XML) repeated on every page, exported to .docx, printed. Clone paints a CSS background-image SVG on #pm-editor — preview only, non-dirtying, NOT exported (toast admits 'renders in saved file at Phase 7'). So watermark is visually present but silently dropped on save. Gallery set is also reduced (Word has ~16 presets incl. ASAP/Original/Personal/Copy diagonal+horizontal variants).
- **Evidence:** bridge/design.ts:243-259 deWatermark sets ed.style.backgroundImage, no markDirty, toast preview-only; commands.js:775-794 watermarkMenu 7 presets.
- **Edge cases to test:** apply preset then save+reopen (gone); apply over a page color (background-image vs backgroundColor coexist? legacy bug noted); multi-page doc (CSS repeat-y, not per-page WordArt); watermark then page color then remove watermark (does bg-color survive?)
- **Improvement:** Build the header-XML w:pict watermark so it exports.
- _needsRuntime: true_

### Watermark ▸ Custom Watermark… (text/picture) — BUG · S2
- **Word vs clone:** Word's Custom Watermark dialog offers Picture watermark (with washout) AND Text watermark (language, text, font, size, color, semitransparent, layout diagonal/horizontal). Clone dialog only has Text + Color + Diagonal checkbox — NO Picture-watermark option, no font, no size, no semitransparent toggle, no Apply-vs-OK. And like the gallery it's preview-only/not exported.
- **Evidence:** dialogs.js:1044-1058 D.watermark: text input + color + diagonal only; OK→WC.PM.deWatermark (non-exporting).
- **Edge cases to test:** pick Picture watermark (no UI); set font/size (no UI); OK then save (dropped); color via picker maps inherit→#C8C8C8
- _needsRuntime: false_

### Colors (color-scheme gallery, 18 schemes) — DEVIATION · S2
- **Word vs clone:** Word's Colors swaps the theme clrScheme (dk1/lt1/dk2/lt2/accent1-6/hlink) so all theme-colored text, accents, table styles, shape fills update. Clone only sets run.color=accents[0] on the 5 heading styles and remaps one picker CSS var (--word-blue); it does NOT change theme color slots, table/shape fills, or hyperlink color. Heading color = accents[0] is wrong: Word headings use dk2/text2, not accent1.
- **Evidence:** bridge/design.ts:83-93 deApplyColors color=accents[0], redefine sets only run.color on HEADING_STYLE_IDS; WC.setThemeColors only sets --word-blue (design-tools.js:108-111).
- **Edge cases to test:** apply scheme then check accent fills on a shape/table (unchanged); Grayscale scheme on colored headings; colors-only vs full-theme (only heading text recolors); save+reopen (color persists via styles.xml only)
- **Improvement:** Recolor headings from dk2 (scheme[?]) not accent1, and write theme clrScheme.
- _needsRuntime: true_

### Page Borders (dialog) — DEVIATION · S2
- **Word vs clone:** Word's Page Border tab = Setting (None/Box/Shadow/3-D/Custom), Style (24 line styles), Color, Width, ART (~160 decorative art borders), per-edge apply, Apply to (Whole doc/This section/1st page only), Options (measure from edge/text, surround header/footer/align). Clone has only Style(4: single/double/dashed/dotted)+Color+Width, all-4-edges always, display='allPages', offsetFrom='text' hardcoded; NO Art borders, NO Shadow/3-D, NO per-edge, NO Apply-to scope, NO Options. The XML writer also has no w:art support. Width is parsed as px→eighths (Math.max(2,width*8)); the simple D.pageBorders dialog labels it 'Width (px)' while the bordersAndShading Page tab uses eighth-point WIDTHS — two different dialogs with inconsistent width units for the same feature. Render is layout-gated (Phase 4, honest warning) but it DOES export real w:pgBorders.
- **Evidence:** dialogs.js:1061-1077 simple dialog 4 styles + px width; dialogs.js:1207-1219,1269 page tab WIDTHS eighth-pt then /8; bridge/design.ts:228-239 hardcodes display allPages/offsetFrom text/all 4 edges; sections-xml.ts:443-466 writer has shadow/frame but NO art.
- **Edge cases to test:** set width then save+read pgBorders sz (px*8 vs eighth-pt mismatch between the two dialogs); double/dashed/dotted style export (BORDER_STYLE_MAP); Remove (clearPageBorders); art border (absent); Apply to: first-page-only (absent — always allPages); reopen a docx that has 1st-page-only borders (display preserved on import but UI can't edit); groove style in simple dialog maps to threeDEngrave
- **Improvement:** Unify on the bordersAndShading Page tab, add Art + Apply-to scope; fix the px-vs-eighth-pt width disagreement.
- _needsRuntime: true_

### Themes (gallery: 29 themes) — DEVIATION · S2
- **Word vs clone:** Word retheme = swap the whole theme part (theme1.xml majorFont/minorFont + 12 theme colors) so EVERY style keyed to the theme font/color updates, plus shape fills/effects. Clone only rewrites fontFamily+color on 5 named styles (Title/Subtitle/Heading1-3) + docDefaults run-font; it never touches theme1.xml, accent color slots, or the linked *Char run styles.
- **Evidence:** bridge/design.ts:50-63 themeUpdates() only sets run.fontFamily/run.color on HEADING_STYLE_IDS + Normal docDefaults; deApplyTheme:76-82. No theme1.xml mutation anywhere.
- **Edge cases to test:** apply theme to heading-less doc (only Normal font changes; toast still says applied); apply theme then save+reopen (does font survive via styles.xml? theme part unchanged); heading text whose run is Heading1Char-linked (known: font won't change); apply twice (idempotent?); undo after apply (single undo step?); accent colors in picker theme row vs body text color
- **Improvement:** Drive theme via theme1.xml majorFont/minorFont + clrScheme so all theme-keyed content updates like Word.
- _needsRuntime: true_

### Fonts (font-pair gallery, 15 pairs) — DEVIATION · S3
- **Word vs clone:** Word swaps theme majorFont(heading)/minorFont(body) so all theme-font content reflows. Clone sets fontFamily on the 5 heading styles (heading face) + Normal & docDefaults run (body face) — visually close for default-styled text, but uses only the FIRST family of the CSS chain and doesn't write theme1.xml; explicitly-fonted runs and *Char-linked headings won't change.
- **Evidence:** bridge/design.ts:94-102 deApplyFonts→themeUpdates(pair.heading,pair.body,null)+applyDocDefaultsRun; firstFamily strips to one family (:21).
- **Edge cases to test:** pair with serif heading + sans body (Office 2007-2010 Cambria/Calibri); heading run linked to Heading1Char; save+reopen font survival; apply font pair then theme (interaction)
- _needsRuntime: true_

### Page Color (Theme/Standard/No Color/More Colors) — DEVIATION · S3
- **Word vs clone:** Word writes w:background + settings displayBackgroundShape and offers Fill Effects (gradient/texture/pattern/picture). Clone writes a REAL w:background (round-trips on open) + paints the sheet — good — but the picker lacks the 'Fill Effects…' entry that ribbon-data promises, and a theme-tint swatch is stored as a literal hex (no theme-color reference, so it won't recolor when the theme changes).
- **Evidence:** ribbon-data.js:1286 lists 'Fill Effects...'; commands.js:1776-1787 colorMenu uses WC.colorPalette (util.js:109-140) which has Theme/Standard/No Color/More Colors but NO Fill Effects; bridge/design.ts:190-210 setBackgroundAttr stores w:color hex.
- **Edge cases to test:** pick page color then save+reopen (w:background round-trip — verify renders in Word); No Color clears displayBackgroundShape; theme-tint swatch then theme change (stays literal hex); page color + watermark coexistence (longhand backgroundColor preserves bg-image); Fill Effects… (absent)
- **Improvement:** Add Fill Effects… gradient/texture path (w:background can carry a fill).
- _needsRuntime: true_

### Paragraph Spacing (presets: No Para Space/Compact/Tight/Open/Relaxed/Double) — DEVIATION · S3
- **Word vs clone:** Word's built-in spacing-set 'after' pt values: Compact=4/1.0, Tight=6/1.15, Open=10/1.15, Relaxed=6/1.5, Double=8/2.0, No Space=0/1.0 — clone's SPACING table matches these. BUT it applies to docDefaults+Normal only (commit-only, no hover live-preview unlike Word which previews on hover), and the 'line multiple' encoding writes line=multiple*240 with lineRule='auto' which is correct, yet Word's actual sets also set contextualSpacing/widow rules the clone omits.
- **Evidence:** design-tools.js:94-101 SPACING; bridge/design.ts:120-131 deParagraphSpacing pt*20 twips, line*240; commands.js:699-701 comment 'COMMIT-ONLY (no hover preview)'.
- **Edge cases to test:** hover a preset (no live preview — Word previews); apply on doc with per-paragraph spacing overrides (docDefaults won't win); No Paragraph Space then save+reopen; line multiple 1.15 → exact 276 twips check
- **Improvement:** Wire hover live-preview (paragraphSpacing flyout passes silent but bridge ignores it).
- _needsRuntime: true_

### Paragraph Spacing ▸ Custom Paragraph Spacing… — DEVIATION · S3
- **Word vs clone:** Word's 'Custom Paragraph Spacing' opens Manage Styles ▸ Set Defaults (doc-wide before/after/line that write docDefaults). Clone routes to the per-paragraph Paragraph dialog (WC.Dialogs.paragraph), which applies to the SELECTION via updateAttributes, not docDefaults — wrong scope and missing the line-spacing-rule (Exactly/At least/Multiple) and 'Don't add space between same-style' options.
- **Evidence:** commands.js:701 'Custom Paragraph Spacing…'→WC.Dialogs.paragraph(); dialogs.js:244-258 applies via pm.cmd updateAttributes on selection.
- **Edge cases to test:** open with empty selection (applies to one paragraph not doc); line spacing select has only multiples, no Exactly/At least
- _needsRuntime: false_

### Themes ▸ Reset to Theme from Template — DEVIATION · S3
- **Word vs clone:** Word resets to the attached template's theme. Clone just re-applies THEMES[0] (Office/Aptos) unconditionally, ignoring the document's actual template/original theme.
- **Evidence:** commands.js:692 onClick re-applies WC.Design.THEMES[0].
- **Edge cases to test:** doc imported with a non-Office theme then Reset (snaps to Aptos, not the imported theme)
- _needsRuntime: false_

### Style Set ▸ Reset to the Default Style Set — GAP · S3
- **Word vs clone:** ribbon-data lists this footer item; Word resets styles to the template default set. Clone's styleSetGallery has NO reset/save-as footer at all — only the 9 cells are rendered.
- **Evidence:** commands.js:705-722 styleSetGallery builds only the grid; no flySep/footer items (contrast galleryMenu footer for Themes).
- _needsRuntime: false_

### Themes gallery active-state checkmark — BUG · S4
- **Word vs clone:** Word marks the currently-applied theme. Clone's isActive compares firstFont(theme.body) to currentDocFont(), which reads CSS var --doc-font — a STATIC value (always 'Aptos', never updated on apply). So the checkmark is stuck on Office/Aptos regardless of the applied theme, and several body-Calibri themes will all falsely show active.
- **Evidence:** commands.js:691 isActive=(t)=>firstFont(t.body)===currentDocFont(); :704 currentDocFont reads --doc-font; base.css:52 --doc-font is a static literal; grep shows nothing writes --doc-font on theme apply.
- **Edge cases to test:** apply Garamond-body theme then reopen gallery (no check on it; check still on Office); any theme whose body firstFont is Aptos/Calibri (false-active)
- _needsRuntime: false_

### Effects (theme effects gallery) — DEVIATION · S4
- **Word vs clone:** Word theme Effects swap the theme effectStyleLst (fill/line/shadow recipes for SHAPES) and persist in theme1.xml. Clone applies a CSS box-shadow directly to img/.wc-shape/.wc-wordart DOM nodes — presentational only, non-dirtying, not exported, lost on reopen; 6 labels (None/Subtle/Moderate/Intense/Reflection/Glow) don't match Word's effect-set names.
- **Evidence:** bridge/design.ts:266-274 deEffects sets o.style.boxShadow, toast, no markDirty/export; commands.js:723-740 effectsMenu shadow CSS strings.
- **Edge cases to test:** apply with no shapes/images (toast 'applies to shapes/pictures'); apply then save+reopen (lost); Reflection/Glow are box-shadow approximations
- _needsRuntime: false_

### Page Borders ▸ live preview / hover restore (theme galleries) — DEVIATION · S4
- **Word vs clone:** Themes/Colors/Fonts galleries DO live-preview on hover and restore on mouseleave (snapshot/replace of definition.styles) — good Word parity. BUT Paragraph-Spacing and Style-Set galleries are commit-only (livePreviewCell passes silent=true but their apply fn ignores it: `if(!silent)`), so hovering them does nothing where Word previews. Also dePreviewEnd (defensive restore on keyboard/outside close) is exported but its wiring into WC.closeFlyouts is marked 'verify in-build' — a flyout closed without a per-cell mouseleave could leave a preview stuck.
- **Evidence:** commands.js:748-752 livePreviewCell; :701 paragraphSpacing apply `if(!silent)`; :717 styleSet `if(!silent)`; bridge/design.ts:178-181 dePreviewEnd comment 'verify the exact WC.closeFlyouts hook in-build'.
- **Edge cases to test:** hover theme then press Esc (does dePreviewEnd fire? stuck preview?); hover theme then click another tab; hover a color then hover a different color (snapshot taken once); hover spacing/style-set (no preview)
- _needsRuntime: true_

### Watermark ▸ Remove Watermark / Save Selection to Gallery — DEVIATION · S4
- **Word vs clone:** Remove works (clears the CSS bg-image) but since the watermark was never in the header it only removes the preview. 'Save Selection to Watermark Gallery…' is listed in ribbon-data but NOT rendered in the flyout (only Custom + Remove appear).
- **Evidence:** commands.js:796-797 only 'Custom Watermark…' + 'Remove Watermark' items; ribbon-data.js:1271 lists the Save-Selection item; bridge/design.ts:260-263 deWatermarkRemove clears backgroundImage only.
- **Edge cases to test:** Remove also clears any non-watermark bg-image set elsewhere; Save Selection to Gallery (absent)
- _needsRuntime: false_

### Colors ▸ Customize Colors… — STUB · S4
- **Word vs clone:** Word opens the Create New Theme Colors dialog (12 color pickers). Clone honest notImplemented toast.
- **Evidence:** commands.js:697 WC.notImplemented('Customize Colors').
- _needsRuntime: false_

### Fonts ▸ Customize Fonts… — STUB · S4
- **Word vs clone:** Word opens Create New Theme Fonts dialog. Clone honest notImplemented toast.
- **Evidence:** commands.js:698 WC.notImplemented('Customize Fonts').
- _needsRuntime: false_

### Set as Default — STUB · S4
- **Word vs clone:** Word writes the current theme+style-set+spacing into Normal.dotm so new docs inherit it. Clone is a pure toast no-op (claims 'set as default for new documents (session)' but stores nothing).
- **Evidence:** bridge/design.ts:277 deSetAsDefault just toasts; commands.js:742.
- **Edge cases to test:** click then New doc (no effect)
- _needsRuntime: false_

### Themes ▸ Browse for Themes… — STUB · S4
- **Word vs clone:** Word opens a file picker for .thmx. Clone shows an honest notImplemented toast.
- **Evidence:** commands.js:693 WC.notImplemented('Browse for Themes').
- _needsRuntime: false_

### Themes ▸ Save Current Theme… — STUB · S4
- **Word vs clone:** Word saves a .thmx to the theme gallery. Clone honest notImplemented toast.
- **Evidence:** commands.js:694 WC.notImplemented('Save Current Theme').
- _needsRuntime: false_

### Style Set ▸ Save as a New Style Set… — GAP · S4
- **Word vs clone:** ribbon-data lists it; missing entirely from the rendered flyout (no footer).
- **Evidence:** commands.js:705-722 no save-as item.
- _needsRuntime: false_

---

## Draw tab  
_11 controls audited_

### Drawing toggle (draw.pens.drawing → drawing → dSetDrawing(!dIsDrawing)) — BUG · S2
- **Word vs clone:** Word's 'Draw with Touch/Drawing' toggle latches ON (highlighted) and disables text editing while active; clicking again returns to typing. Clone: dSetDrawing flips drawState.on and the overlay binds pointer capture, BUT the ribbon button has NO latch rule, so it never shows as toggled; and the pens flyout 'Start/Stop Drawing' label reads WC.Draw.enabled (always false) so it ALWAYS says 'Start Drawing' even while drawing is active.
- **Evidence:** commands.js:644 H.drawing flips dIsDrawing; no registerRibbonRule('drawing'); commands.js:675 label uses WC.Draw.enabled which is never set true; ink-overlay sync() binds capture on state.on
- **Edge cases to test:** toggle on then type — is text editing blocked? (overlay captures pointer but keyboard still edits); toggle on, switch tabs, return — latch lost; Start/Stop label always wrong; toggle off mid-stroke
- **Improvement:** Add a latched ribbon rule bound to dIsDrawing(); drive the flyout label off dIsDrawing() not WC.Draw.enabled; block caret edits while drawing like Word.
- _needsRuntime: true_

### Pens Gallery (draw.pens.pens-gallery → pensGallery; gallery tiles + flyout) — BUG · S2
- **Word vs clone:** Word: clicking a pen selects it and the tile stays highlighted as the active pen; click again opens Thickness/Color/Effects. Clone: clicking a tile sets drawState.pen via dSetPen and toggles drawing, BUT the active-tile highlight reads WC.Draw.pen.id, which is NEVER updated (dSetPen only mutates draw.ts drawState, not WC.Draw.pen). So the wrong tile (only the first 'Pen') ever highlights, and selecting blue/red/highlighter shows no active state.
- **Evidence:** ribbon.js:271 active = dIsDrawing() && draw.pen.id===pen.id (draw.pen is always PENS[0]); ribbon.js:278 reads WC.Draw.pen.id; draw.ts:105-110 dSetPen updates only drawState; grep shows WC.Draw.pen never reassigned anywhere
- **Edge cases to test:** click Pen(Blue) — drawing starts but no tile highlights; click active pen again — should open settings; clone just toggles drawing off; second click toggles drawing vs Word's settings flyout; gallery has no per-pen Thickness/Color/Effects sub-flyout (only flyout 'Pens' menu lists names)
- **Improvement:** Have dSetPen also set WC.Draw.pen (and a drawing flag) so the active-pen highlight tracks the real selected pen; add per-pen thickness/color popover.
- _needsRuntime: false_

### Eraser (split: draw.tools.eraser → eraser → dSetEraser + flyout modes) — DEVIATION · S2
- **Word vs clone:** Word: Stroke Eraser removes a whole stroke; Small/Medium/Large point erasers rub out only the touched PORTION (splitting a stroke); Segment Eraser erases the segment between intersections. Clone: ALL modes delete the ENTIRE underlying vectorShape node — eraseMode ('stroke'/'point'/'segment') is stored but NEVER read; only the hit-radius differs. No partial erase / no stroke splitting.
- **Evidence:** commands.js:1538-1542 setEraser(radius,mode); draw.ts:95-102 stores eraseMode; ink-overlay.ts:246-254 eraseAt() always deleteNodesAt(whole node) — eraseMode unread; deleteNodesAt deletes pos..pos+nodeSize
- **Edge cases to test:** point-erase the middle of a long stroke (Word splits; clone removes all); Segment Eraser on crossing strokes; drag eraser across many strokes (pointermove erases continuously — verify multi-delete tr); Erase All Ink then undo; erase reopened (paths[]) ink — data-ink-pos staleness; undo after erase
- **Improvement:** Implement true point/segment erase by rewriting the stroke's inkPoints (split into sub-strokes) instead of node delete.
- _needsRuntime: true_

### Add Pen (draw.pens.add-pen → addPen flyout + Custom Pen dialog) — DEVIATION · S3
- **Word vs clone:** Word's Add Pen adds Pen/Pencil/Highlighter/Action Pen, each then fully editable (color/thickness/effects). Clone flyout adds preset Pen/Pencil/Highlighter/Action; the 'Custom Pen…' dialog offers only Color + Thickness (no opacity, no pencil/highlighter type, no effects) and ALWAYS forces opacity:1 and id 'custom-N' so it can never be a translucent highlighter. Action Pen is just a teal opaque pen (no annotation-action behavior).
- **Evidence:** commands.js:646-655 add(...) presets; 679-688 addPenDialog → opacity:1 hardcoded, id 'custom-'+n; draw.ts:107 tool=highlighter only if /highlighter/.test(pen.id) so 'custom-*' never highlighter
- **Edge cases to test:** Custom Pen with width 14 — still opaque (no highlighter translucency); Action Pen draws — no action attached; added pen persists only in-session (customPens array, not saved); Add Pen then _renderPens refresh — new tile appears
- **Improvement:** Add opacity + type selectors to Custom Pen; tie highlighter translucency to type not id-substring.
- _needsRuntime: false_

### Drawing Canvas (draw.insert.drawing-canvas → drawingCanvas → dInsertCanvas) — DEVIATION · S3
- **Word vs clone:** Word inserts a real wpc:wpc wordprocessingCanvas — a resizable grouping region that holds and clips child drawings/ink. Clone inserts a fixed 480x240 px bounded rect (prstGeom rect, grey 1px border, noFill, no text, no child-grouping) as an inline vectorShape. It is NOT a true canvas: nothing is parented/clipped into it; it's just a framed box. Fixed size, inserted inline at caret (not floating).
- **Evidence:** draw.ts:48-90 dInsertCanvas builds prstGeom rect wp:inline, 480x240; deferrals.md:396 records 'real wpc:wpc canvas net-new'; comment line 4-5
- **Edge cases to test:** insert in a table cell; insert then draw ink 'inside' it (ink is not actually parented); insert then resize (no resize handles?); two canvases — docPr id seq 5000+ collision risk vs imported ids; export+reopen — renders as a plain rect in Word; undo insert
- **Improvement:** At minimum make the canvas resizable and clip child ink to its bounds; ideally emit wpc:wpc.
- _needsRuntime: true_

### Lasso Select (draw.tools.lasso-select → lassoSelect → dSetLasso) — DEVIATION · S3
- **Word vs clone:** Word: draw a freeform loop; everything fully OR partially enclosed is selected as a group you can then move/delete/recolor. Clone: draws a loop, selects strokes whose sampled points are >60% inside (so partially-enclosed strokes are MISSED), only ink strokes (not shapes), and the selection is delete-only — no move/recolor.
- **Evidence:** ink-overlay.ts:262-277 finishLasso() samples each path, inside/total>0.6 threshold; only .pm-ink-stroke; deleteSelected only on Delete key (393-396)
- **Edge cases to test:** loop enclosing a stroke ~50% (Word selects, clone drops at 0.6 thr); loop around a shape/image (ignored); incomplete loop <3 pts (no-op); loop then move — unsupported; lasso across a page break / when zoomed
- **Improvement:** Lower/anchor the inclusion test to 'any point inside' to match Word's partial-enclosure rule; enable group move.
- _needsRuntime: true_

### Select Objects (draw.tools.select-objects → selectObjects → dSetSelect) — DEVIATION · S3
- **Word vs clone:** Word: arrow tool to click/marquee-select ANY object (ink, shapes, images, text boxes) then move/resize. Clone: only single-click selects ONE ink stroke (adds .sel class, drop-shadow); cannot marquee, cannot select shapes/images/text boxes, no move/resize — selection is delete-only (Delete key).
- **Evidence:** commands.js:658 H.selectObjects=()=>WC.PM.dSetSelect(); ink-overlay.ts:255-261 selectAt() only finds .pm-ink-stroke and toggles .sel; no shape/image hit-test, no drag/resize
- **Edge cases to test:** click a shape/image (not ink) — nothing selectable; click empty area — clears selection; Delete with stroke selected; select then switch tab — does selection persist / how to deselect; select on imported (reopened paths[]) ink
- **Improvement:** Wire to the existing image/shape frame-selection so the arrow can select+move non-ink objects like Word.
- _needsRuntime: false_

### Pens Gallery — Effects (Rainbow/Galaxy/Gold) + per-pen settings — GAP · S3
- **Word vs clone:** Word pens expose Thickness, Color, and special Effects (Rainbow, Galaxy, Rose Gold, Bronze, etc.). Clone has a fixed 6-pen list with only solid colors; no Effects, no per-pen thickness/color editor from the gallery (only Add Pen / Custom Pen dialog).
- **Evidence:** draw-tools.js:10-17 PENS fixed solid colors; pensMenu (commands.js:665-678) lists names + Add Pen / Start-Stop / Clear only — no per-pen settings or effects
- **Edge cases to test:** select highlighter then expect translucent — works via opacity; rainbow/galaxy unavailable
- **Improvement:** Add gradient/effect pen strokes (gradFill on a:ln) for at least Rainbow/Gold to approach Word.
- _needsRuntime: false_

### Stencils group — Ruler + Protractor (ENTIRE GROUP) — GAP · S3
- **Word vs clone:** Word's Draw tab has a Stencils group with Ruler and Protractor — on-screen straightedge/angle guides you can rotate and snap ink to. Clone: the group and BOTH controls are absent from ribbon-data.js (Draw tab has only Tools/Pens/Convert/Insert/Replay). No cmd, no handler.
- **Evidence:** ribbon-data.js:1018-1155 Draw groups = Tools, Pens, Convert, Insert, Replay only — no Stencils/Ruler/Protractor anywhere; grep for ruler/protractor in handlers = none
- **Edge cases to test:** n/a — not present
- **Improvement:** Add a Stencils group; even a non-snapping visual ruler/protractor overlay would raise fidelity.
- _needsRuntime: false_

### Draw with Trackpad (draw.pens.draw-with-trackpad → drawWithTrackpad) — DEVIATION · S4
- **Word vs clone:** Word toggles trackpad-as-pen input mode (finger/trackpad draws ink). Clone: pure toast 'Mouse/trackpad input is used for drawing in this clone' + local class toggle on the button; toggles nothing functional (mouse always draws). The toggled class is set ad-hoc on the node, not via a state rule, so it won't persist on re-render.
- **Evidence:** commands.js:656 H.drawWithTrackpad toggles node.classList + WC.toast; no dSet* call; no registerRibbonRule for it
- **Edge cases to test:** toggle twice; switch tab and back — toggled state lost (no latch rule)
- **Improvement:** Either remove (mouse already draws) or make it a real no-op-with-persisted-latch.
- _needsRuntime: false_

### Eraser split-arrow size labels (Small/Medium/Large/Segment radii) — DEVIATION · S4
- **Word vs clone:** Word shows a visible eraser-tip circle sized to the choice. Clone maps Small=6/Medium=12/Large=24/Stroke=10/Segment=8 px radius but shows only a generic 'cell' cursor — no eraser-size cursor preview, and Segment's radius (8) is unused for its intended semantics.
- **Evidence:** commands.js:1538-1542 radius constants; ink-overlay.ts:385 cursor='cell' for eraser (fixed, not size-scaled)
- **Edge cases to test:** pick Large then hover — cursor unchanged; radius affects only pathNear bbox tolerance
- **Improvement:** Render a radius-sized circle cursor; honor segment semantics.
- _needsRuntime: false_

### Ink Replay (draw.replay.ink-replay → inkReplay → dReplay) — DEVIATION · S4
- **Word vs clone:** Word replays strokes IN THE ORDER DRAWN with pause/play timeline controls and per-stroke timing. Clone: animates all currently-rendered .pm-ink-stroke paths via stroke-dashoffset, sequentially with a fixed 420ms/stroke, in DOM order (≈doc order, which for floating anchored ink may not equal draw order), no pause/play UI, no original timing. Reopened ink replays too (renders from paths[]).
- **Evidence:** ink-overlay.ts:349-374 replay(): fixed 420ms cadence, DOM order, no controls; ribbon-data.js:1151 feasible:'no'
- **Edge cases to test:** replay with 0 strokes (toast 'No ink to replay'); replay reopened-doc ink (paths[] order); replay while drawing tool active; replay across multiple pages (does the whole-page overlay animate off-screen strokes); stroke order vs insertion order
- **Improvement:** Add play/pause and use captured per-stroke timestamps for true ordered replay.
- _needsRuntime: true_

### Pencil pen type (gallery 'Pencil' / Add Pen Pencil) — DEVIATION · S4
- **Word vs clone:** Word's pencil has a distinct textured/graphite stroke. Clone: 'pencil' is just a thin grey semi-opaque solid stroke; dSetPen NEVER sets tool='pencil' (only 'pen' or 'highlighter' via id regex), so a pencil draws through the identical 'pen' code path with no textured rendering.
- **Evidence:** draw.ts:107 tool = /highlighter/.test(id)?'highlighter':'pen' (no pencil branch); ink-overlay applyPen just sets stroke/width/opacity; draw-tools.js:14 pencil width 1.2 opacity .85
- **Edge cases to test:** select Pencil then draw — looks like a thin pen, no texture; export pencil — plain a:ln stroke, no pencil hint
- **Improvement:** Add a pencil texture (dashed/jitter or a:ln with sketchy preset) to differentiate.
- _needsRuntime: false_

### Ink to Math (draw.convert.ink-to-math → inkToMath) — STUB · S5
- **Word vs clone:** Word: opens an ink-math input panel that recognizes handwritten equations into typeset OMML. Clone: honest toast 'Ink-to-Math … is not implemented'.
- **Evidence:** commands.js:662 H.inkToMath = toast; draw.ts:136 dInkToMath honest toast; ribbon-data.js:1123 feasible:'no'
- **Edge cases to test:** click — toast only
- **Improvement:** Out of scope (ML); keep honest toast.
- _needsRuntime: false_

### Ink to Shape (draw.convert.ink-to-shape → inkToShape) — STUB · S5
- **Word vs clone:** Word: a TOGGLE that, while on, auto-snaps freehand drawings into clean geometric shapes as you draw. Clone: button shows honest toast 'Ink-to-Shape recognition is a handwriting/shape ML feature — not implemented'; type is declared 'toggle' in ribbon-data but handler is a one-shot toast (no toggle/no latch).
- **Evidence:** commands.js:661 H.inkToShape = toast(...); ribbon-data.js:1113 type:'toggle' feasible:'no'; draw.ts:135 dInkToShape honest toast
- **Edge cases to test:** click — toast only; declared toggle but never latches
- **Improvement:** Either drop the toggle affordance or add a minimal line/ellipse/rect snap heuristic.
- _needsRuntime: false_

---

## Home / Font group  
_16 controls audited_

### Font Size combo (home.font.font-size) — BUG · S2
- **Word vs clone:** Word accepts 1 to 1638 pt (and half-points); clone's engine setFontSize hard-clamps to min 8 / max 96 with NO feedback, so typing 1, 5, 100, 200, 400 silently becomes 8 or 96.
- **Evidence:** font-size.js:54-59 defaults {min:8,max:96}; font-size.js:112-113 value = minMax(Number(value),min,max) — silent clamp. Combo commit setFontSize commands.js:1734-1739 passes through.
- **Edge cases to test:** type 1; type 5; type 7.5; type 100; type 1638; type 0; type non-numeric; half-point like 10.5 (in SIZES) vs 9.5 (not); then save+reopen to confirm clamped value persists
- _needsRuntime: true_

### Text Highlight Color split button (home.font.text-highlight-color) — BUG · S2
- **Word vs clone:** Word's highlighter palette is a FIXED 15-color set (the only valid w:highlight keywords) + No Color + Stop Highlighting. Clone reuses the generic colorPalette (Automatic + Theme Colors + Tints + Standard + More Colors). Picking any color NOT in the 16-keyword map (most theme colors, tints, More-Colors hexes, even Standard 'Orange' #FFC000) exports as w:shd (character SHADING) instead of w:highlight — so on reopen it becomes character shading, not highlight (round-trip type mismatch). Also no 'Stop Highlighting' painter mode (Word turns the cursor into a highlighter).
- **Evidence:** commands.js:1490 colorMenu(node,'hilite') → util.js:109-140 full palette; highlight.js stores arbitrary color; highlight-translator.js:48-66 falls back to w:shd when getDocxHighlightKeywordFromHex returns null; map only 16 colors helpers.js:448-465.
- **Edge cases to test:** pick Standard Orange #FFC000 then save → w:shd not w:highlight; pick a theme tint then save+reopen; pick yellow (default, maps clean); No Color removes highlight; Stop Highlighting (no painter mode); apply highlight then font shading on same run (collision); highlight across paragraphs
- _needsRuntime: true_

### Font dialog launcher Ctrl+D (home.font.font-2 / launcher) — DEVIATION · S2
- **Word vs clone:** Opens a Font dialog (Font+Advanced tabs) but several controls are non-functional or missing vs Word: (1) Small caps, All caps, Character Scale, Spacing (Expanded/Condensed), and Position (Raised/Lowered) just call notifyBlocked — they DON'T apply, only the live preview updates. (2) Missing Word effects: Double strikethrough, Hidden, Engrave/Emboss/Shadow/Outline checkboxes. (3) No underline COLOR control. (4) No 'Set As Default' button. (5) No OpenType/Ligatures section on Advanced tab. (6) Color picker lacks Gradient.
- **Evidence:** dialogs.js:460-462 notifyBlocked('Caps and Advanced font effects') for small/allc/scale/spacing/position; dialogs.js:388 only Strikethrough/Super/Sub/Small caps/All caps checkboxes (no double-strike/hidden/emboss); dialogs.js:386 underline select has no color; no setAsDefault footer (dialogs.js:444-466).
- **Edge cases to test:** check Small caps + OK (no-op + toast); set Character Spacing Expanded By 2pt + OK (no-op); set Scale 150% + OK (no-op); apply font+size+bold via dialog (works as one undo); Set As Default expectation (missing); Double strikethrough expectation (missing); Hidden text expectation (missing); Advanced Position Raised By 3pt (no-op)
- _needsRuntime: true_

### Change Case dropdown — 5 modes (home.font.change-case) — BUG · S3
- **Word vs clone:** Word's Sentence case correctly capitalizes the first letter even when the run starts with whitespace/quote and after every sentence terminator; clone's 'sentence' regex `(^\s*\w|[.!?]\s+\w)` requires whitespace AFTER the terminator, so 'a.b' or 'end.New' (no space) is NOT recapitalized, and a sentence ending the selection right before a newline is missed. Also no Shift+F3 cycle shortcut (Word's case-cycle) and toggle-case uses per-char toUpperCase which mis-handles locale (e.g. Turkish i).
- **Evidence:** commands.ts:58 sentence regex needs `\s+` after [.!?]; commands.ts:53-77 changeCase; no Shift+F3 binding in app.js map (lines 82-120); toggle commands.ts:59 uses ch.toUpperCase()/toLowerCase() (no locale).
- **Edge cases to test:** 'hello world.goodbye' sentence case (no space after period); selection with leading spaces; UPPERCASE on already-upper; Capitalize Each Word on hyphenated/apostrophe words (o'brien, mother-in-law); tOGGLE on Turkish 'İ'/'ı' or German ß; empty selection (returns false — no toast); caps on numbers/symbols; Shift+F3 expecting cycle; undo restores exact original casing
- _needsRuntime: true_

### Clear All Formatting button (home.font.clear-all-formatting) — DEVIATION · S3
- **Word vs clone:** Word's eraser removes direct char+para formatting AND resets the paragraph STYLE to Normal (Default Paragraph Font). Clone runs clearNodes().unsetAllMarks(): clearNodes resets node type to default paragraph and unsetAllMarks drops marks, but it is unclear the named paragraph styleId is reset to Normal (style reference may survive), and it converts a list item to a plain paragraph which matches Word but the resulting style may not be 'Normal'.
- **Evidence:** format-commands.js:79-83 clearFormat = chain().clearNodes().unsetAllMarks().run(); no explicit setStyleById('Normal').
- **Edge cases to test:** clear on a Heading 1 paragraph (should become Normal, verify styleId); clear on a bullet/numbered list item; clear on a table cell; clear with mixed marks across multiple paragraphs; clear then save+reopen (confirm style reset persists); undo after clear; clear on imported styled content
- _needsRuntime: true_

### Decrease Font Size button + Ctrl+< / Ctrl+[ (home.font.decrease-font-size) — DEVIATION · S3
- **Word vs clone:** Same as grow: Ctrl+[ should shrink by 1pt but maps to the preset-list jump; clamps at 8 (bottom of SIZES) — Word shrinks to 1pt.
- **Evidence:** app.js:108-110 '<' and '[' both incFont(-1); stepFont commands.js:1727-1728 SIZES.filter(<cur), floor SIZES[0]=8.
- **Edge cases to test:** Ctrl+[ expecting -1pt; shrink at 8 (caps?); shrink on 13pt imported size; shrink below 8 attempt; mixed selection
- _needsRuntime: false_

### Font Color split button (home.font.font-color) — DEVIATION · S3
- **Word vs clone:** Main button applies last-used color (default Red #FF0000 — matches Word). Dropdown gives Automatic + Theme + Standard + More Colors (good), but ribbon-data also lists 'Gradient' which is NOT implemented — Word's Font Color ▸ Gradient submenu (None/Light/Dark variations + More Gradients) is entirely missing. Theme-color picks export as raw hex (w:color val=hex) rather than as a theme-color reference (w:color themeColor=...), so they don't re-theme on theme change.
- **Evidence:** commands.js:1491 colorMenu(node,'fore'); util.js:109-140 colorPalette has NO gradient branch; ribbon-data.js:225-231 lists 'Gradient'; applyColor commands.js:1759 pm.cmd('setColor',color) passes literal hex.
- **Edge cases to test:** Font Color ▸ Gradient (missing); pick a Theme Color then change document theme (should re-color; won't); Automatic vs explicit black; More Colors custom hex; apply to empty caret then type; save+reopen color value
- _needsRuntime: true_

### Font name combo (home.font.font) — DEVIATION · S3
- **Word vs clone:** Word enumerates ALL installed system fonts grouped (Theme Fonts / Recently Used / All Fonts) with live hover-preview on the selection; clone shows a fixed 17-name hardcoded list, no grouping, no live preview, and accepts any free-typed name without validation.
- **Evidence:** commands.js:22-23 FONTS hardcoded 17 entries; commands.js:2183-2189 openFontList only sets item.style.fontFamily (per-item render, NOT selection hover-preview); setFontName commands.js:1741-1743 applies on commit only. ribbon-data tooltip claims 'live preview of installed fonts'.
- **Edge cases to test:** type a font not in the list (e.g. 'Wingdings') and commit; type a non-installed font name; hover an item expecting selection preview; open on mixed-font selection (combo should blank); apply then save+reopen
- _needsRuntime: false_

### Increase Font Size button + Ctrl+> / Ctrl+] (home.font.increase-font-size) — DEVIATION · S3
- **Word vs clone:** Word: Ctrl+Shift+> walks the size-preset list, but Ctrl+] grows by exactly +1pt (two distinct behaviors). Clone maps BOTH Ctrl+> and Ctrl+] to the same preset-list jump, so Ctrl+] never does +1pt. Also caps at 72 (top of SIZES) instead of stepping further like Word.
- **Evidence:** app.js:107-110 both '>' and ']' call incFont(1); stepFont commands.js:1724-1730 walks SIZES; SIZES max 72 commands.js:13, so grow stops at 72 (Word continues to e.g. 80).
- **Edge cases to test:** Ctrl+] expecting +1pt vs preset jump; grow at 72 (does it cap?); grow on a size not in SIZES like 13pt (imported); grow on empty selection / caret; grow on mixed-size selection; undo after grow
- _needsRuntime: false_

### Text Effects and Typography ▸ Outline (home.font.text-effects-and-typography) — DEVIATION · S3
- **Word vs clone:** Word's Outline is a real text-effect with color/weight/dash gallery + 'No Outline'/'Outline Color'/'Weight'/'Dashes'/'More Outline Colors'. Clone offers No Outline + 5 fixed widths + Outline Color, renders via -webkit-text-stroke, exports as w14:textOutline (good), but no dash/gradient sub-options and stroke render differs visually from Word's.
- **Evidence:** commands.js:508-516 outlineMenu; text-style.js:201-205 -webkit-text-stroke; export rpr-translator.js:100 textOutlineTranslator.
- **Edge cases to test:** apply 3pt outline + a fill color; Outline Color via More Colors; render fidelity vs Word; save+reopen (w14:textOutline round-trip); outline on large heading
- _needsRuntime: true_

### Text Effects ▸ Shadow + Reflection (home.font.text-effects-and-typography) — GAP · S3
- **Word vs clone:** Word's Shadow (Outer/Inner/Perspective presets) and Reflection (variations) are real effects that save. Clone renders them in-app (CSS text-shadow / -webkit-box-reflect) but they are EXPORT-ONLY DROPPED on save — no w14:shadow/w14:reflection translator — so the effect vanishes after save+reopen (documented deferral A.2 stage-2b).
- **Evidence:** commands.js:517-530 shadowMenu/reflectionMenu set textShadowW14/textReflection; styles.js:772-783 export switch handles ONLY textOutline+textGlow (comment: 'Shadow + reflection are stage-2b'); w:shadow translator (shadow-translator.js) is the legacy boolean, NOT w14.
- **Edge cases to test:** apply Shadow Bottom-Right then save+reopen (effect lost); apply Reflection Full then save+reopen; shadow preset directions render correctly; No Shadow clears; combine shadow+glow
- _needsRuntime: true_

### Underline split button + Ctrl+U + style/color dropdown (home.font.underline) — GAP · S3
- **Word vs clone:** Word dropdown offers underline styles, 'More Underlines...' (opens Font dialog), AND an 'Underline Color' submenu. Clone's underlineMenu offers only 5 styles (Single/Double/Dotted/Dashed/Wavy) — NO underline color picker and NO 'More Underlines...' entry, despite ribbon-data listing both. Underline color is unreachable from the ribbon entirely.
- **Evidence:** commands.js:1980-1988 underlineMenu = 5 styles only; ribbon-data.js:156-160 lists 'More Underlines...' and 'Underline Color' but neither is built; Font dialog underline select (dialogs.js:386) also has no color.
- **Edge cases to test:** pick Wavy then save (exports w:u val='wave'?); try to set underline color (impossible); Double underline export; 'More Underlines' click expecting Font dialog; apply style then toggle Ctrl+U off — does it clear the styled underline?; words-only underline (Ctrl+Shift+W) not present
- _needsRuntime: false_

### Subscript toggle + Ctrl+= (home.font.subscript) — DEVIATION · S4
- **Word vs clone:** Behavior matches (mutually exclusive with superscript, exports w:vertAlign='sub'), BUT the advertised Ctrl+= shortcut is NOT bound anywhere (not in app.js map, no fork shortcut), and render uses font-size:65% scaling which is an approximation of Word's baseline-shift+~58% rendering.
- **Evidence:** commands.js:47,1719-1723 vertAlign mutual-exclusive + toggle; export styles.js:557-563 → 'sub'; text-style.js:131-132 font-size:65%; NO Ctrl+= in app.js:82-120 nor fork extensions.
- **Edge cases to test:** press Ctrl+= expecting subscript (no-op); toggle sub then super (mutual exclusion); toggle twice to clear; apply on selection with custom font size (does 65% compound?); save+reopen vertAlign
- _needsRuntime: false_

### Superscript toggle + Ctrl+Shift+= (home.font.superscript) — DEVIATION · S4
- **Word vs clone:** Like subscript: correct toggle+export but advertised Ctrl+Shift+= shortcut is unbound; 65% scale approximation.
- **Evidence:** commands.js:48,1719-1723; export styles.js:562-563 → 'super'; text-style.js:128-129; no Ctrl+Shift+= binding in app.js/fork.
- **Edge cases to test:** Ctrl+Shift+= expecting superscript (no-op); super then sub mutual exclusion; toggle off; footnote-ref interaction; save+reopen
- _needsRuntime: false_

### Text Effects ▸ Glow (home.font.text-effects-and-typography) — DEVIATION · S4
- **Word vs clone:** Word offers glow presets in theme-accent colors + size variations + Glow Color + 'More Glow Colors'. Clone offers No Glow + 4 radii (all the same blue #156082) + Glow Color picker; exports w14:glow. Default glow color is a single fixed blue vs Word's accent-based gallery.
- **Evidence:** commands.js:531-538 glowMenu GLOW_BLUE #156082 fixed; export styles.js:780-782 textGlow; glow-translator.js w14:glow.
- **Edge cases to test:** apply 18pt glow + custom color; glow color via More Colors; save+reopen w14:glow round-trip; glow render vs Word
- _needsRuntime: true_

### Text Effects ▸ Number Styles / Ligatures / Stylistic Sets (home.font.text-effects-and-typography) — DEVIATION · S4
- **Word vs clone:** Maps OpenType features to CSS font-variant-numeric/ligatures/font-feature-settings and exports w14:numForm/numSpacing/ligatures/cntxtAlts/stylisticSets (good fidelity). Deviation: Stylistic Sets is a flat 'Set 1..8' list vs Word's font-specific named-set gallery; effects only visible with OpenType-capable fonts; no Contextual Alternates as a separate toggle.
- **Evidence:** commands.js:539-552 numberStylesMenu/ligaturesMenu/stylisticSetsMenu; text-style.js:179-197 font-variant CSS; export styles.js:755-769 + w14 translators.
- **Edge cases to test:** apply Tabular Lining on a font with oldstyle nums; Set 5 on a font lacking ss05; ligatures All on Calibri vs Gabriola; save+reopen each w14 attr; mixed selection
- _needsRuntime: true_

### Bold toggle + Ctrl+B (home.font.bold) — match
- **Word vs clone:** Matches Word: toggleBold via Mod-b; negation-attr aware in state read.
- **Evidence:** commands.js:40 H.bold=toggleBold; bold.js:103-106 Mod-b/Mod-B; state-sync.ts:92 markOn(a.value).
- **Edge cases to test:** toggle on mixed bold/non-bold selection (Word: first click makes ALL bold); toggle twice; caret-only then type; across a list item
- _needsRuntime: false_

### Italic toggle + Ctrl+I (home.font.italic) — match
- **Word vs clone:** Matches Word: toggleItalic via Mod-i.
- **Evidence:** commands.js:41; italic.js:97-100; state-sync.ts:93.
- **Edge cases to test:** mixed selection first-click-makes-all; toggle twice; caret then type
- _needsRuntime: false_

### Strikethrough toggle (home.font.strikethrough) — match
- **Word vs clone:** Single strikethrough matches Word (toggleStrike → w:strike). Note: Word also has Double Strikethrough (only in Font dialog) which the clone lacks (see Font dialog finding).
- **Evidence:** commands.js:43 H.strikethrough=toggleStrike; state-sync.ts:95.
- **Edge cases to test:** toggle twice; mixed selection; then save+reopen
- _needsRuntime: false_

---

## Home / Paragraph group  
_22 controls audited_

### Borders (split button — per-edge + No/All/Outside/Inside + Inside-H/V + diagonals + Horizontal Line + Draw Table + View Gridlines + Borders and Shading…) — DEVIATION · S2
- **Word vs clone:** Edge toggles, No/All/Outside/Inside, checkmarks, Horizontal Line, and the B&S dialog are wired. BUT: (1) Inside Vertical → honest toast 'deferred to layout engine', never applied; (2) Inside Horizontal maps to w:between which only RENDERS as the rule between consecutive identically-bordered paragraphs (no real between-rule render — Phase-4 deferred); (3) multi-paragraph selection seeds single-edge toggles from the HEAD paragraph only (getAttributes reads one paragraph), so a mixed selection toggles inconsistently; (4) Draw Table → notImplemented; (5) diagonals correctly greyed (table-only); (6) 'View Gridlines' toggles a 24px DRAWING grid background, NOT Word's table cell gridlines.
- **Evidence:** bordersMenu commands.js:1826-1853; applyBorder commands.js:1861-1885 — insideV toast (1865), between handling (1876-1878), reads ONE paragraph (1868, comment 1866-1867); Draw Table notImplemented (1850); View Gridlines toggles show-grid (1851) = drawing grid editor.css:528.
- **Edge cases to test:** Bottom Border on single paragraph (default 0.5pt single); All Borders then No Border; Inside Horizontal on 3 stacked paragraphs (between render); Inside Vertical (toast only); multi-paragraph selection with mixed existing borders; border on a table cell vs paragraph; border across page seam (known balloon bug); View Gridlines expecting table gridlines; save+reopen
- _needsRuntime: true_

### Shading (split button — quick apply + palette) — DEVIATION · S2
- **Word vs clone:** In Word the Home Shading button shades the SELECTED TEXT (run-level w:shd) when a sub-paragraph range is selected, and the paragraph only when the whole paragraph/no text is selected. Clone ALWAYS writes paragraphProperties.shading (paragraph-level) regardless of selection — shading a few words fills the entire paragraph background. No run-level shading path from the quick button.
- **Evidence:** applyColor kind==='shade' commands.js:1765-1769 always updateAttributes('paragraph', paragraphProperties.shading); B&S dialog 'Apply to: Text' likewise deferred to paragraph (dialogs.js:1258).
- **Edge cases to test:** select 2 words and apply shading (shades whole paragraph); No Color clears; More Colors…; main face re-applies last shade; Theme vs Standard swatch; save+reopen (run vs para shd); shading across a page seam (known balloon bug)
- _needsRuntime: true_

### Line Spacing Options… (→ Paragraph dialog) — DEVIATION · S3
- **Word vs clone:** Word's Paragraph dialog (Indents and Spacing tab) has: Alignment, Outline level, Indentation L/R + Special {none/first-line/hanging} + By, Mirror indents, Spacing Before/After + 'Don't add space between same style', Line spacing {Single/1.5/Double/At least/Exactly/Multiple} + At, Preview, Tabs…, plus a full 'Line and Page Breaks' tab (widow/orphan, keep with next, keep lines together, page break before, suppress line numbers, don't hyphenate). Clone's dialog has only Alignment, Indent L/R, Spacing before/after, and a Line spacing dropdown limited to the 6 multiples (NO Single/At least/Exactly rules, NO Special indent, NO hanging/first-line, NO Line and Page Breaks tab, NO Tabs button, NO preview).
- **Evidence:** D.paragraph dialogs.js:221-261 — 6 fields only; line select hardcodes 6 multiples and always writes lineRule:'auto' (dialogs.js:251-252); no Special/hanging/breaks/tabs.
- **Edge cases to test:** need hanging indent (unavailable); need Exactly 14pt line rule (forced to auto multiple); need page-break-before / keep-with-next; need first-line indent; OK writes one undo step
- _needsRuntime: false_

### Multilevel — Change List Level submenu — DEVIATION · S3
- **Word vs clone:** Word's Change List Level shows all 9 levels as live thumbnails of the current list's per-level markers and greys when not in a list. Clone offers Level 1–5 only (not 9) as plain text; on a non-list paragraph the items are NOT greyed — clicking is a silent no-op (changeListLevelBy returns false, no dispatch).
- **Evidence:** changeListLevelMenu() commands.js:579-597 loops i=1..5; non-list → delta computed against ilvl 0, changeListLevel returns false (changeListLevel.js:57) — silent. Comment at commands.js:593-594 acknowledges 'Word greys these items instead'.
- **Edge cases to test:** open on a non-list paragraph (greyed in Word, clickable no-op here); Level 6-9 unavailable; change level on a one-level bullet list (hasListDefinition may fail); multi-paragraph selection
- _needsRuntime: false_

### Paragraph group dialog launcher — DEVIATION · S3
- **Word vs clone:** Launcher opens the same reduced Paragraph dialog (see Line Spacing Options entry) — missing the Line and Page Breaks tab, Special indents, line-spacing rules, Tabs button, and preview.
- **Evidence:** ribbon-data.js:415-422 launcher cmd 'paragraph'; LAUNCHER routes paragraph()→WC.Dialogs.paragraph (commands.js:1685); dialog body dialogs.js:237-242.
- **Edge cases to test:** launcher vs Line Spacing Options open same dialog; OK applies as one undo step; seeds reflect head paragraph
- _needsRuntime: false_

### Show/Hide ¶ — DEVIATION · S3
- **Word vs clone:** Word's Show/Hide reveals pilcrows, space dots (·), tab arrows (→), line-break arrows, non-breaking-space marks, optional hyphens, object anchors, and hidden-text underlines. Clone toggles a CSS class that renders ONLY a pilcrow ¶ via p::after — no space/tab/break/anchor marks at all (the CSS comment literally says 'spaces/tabs marks are approximated' but in PM mode nothing is). Latch state correctly tracked.
- **Evidence:** H.showHide commands.js:83-89 toggles #pm-editor.show-marks; CSS editor.css:527 body.pm-active #pm-editor.show-marks p::after{content:'¶'} only; latch home-features.js:90.
- **Edge cases to test:** toggle and look for space/tab marks (absent); pilcrow on empty paragraph; pilcrow inside table cells / headings; marks persist while typing; marks excluded from print/export; toggle twice
- _needsRuntime: true_

### Sort (Sort Text dialog) — DEVIATION · S3
- **Word vs clone:** Word's Sort dialog has Sort by (up to 3 keys), Type {Text/Number/Date}, Using {Paragraphs/Field}, Asc/Desc, header checkbox, Options… (separator, case-sensitive, sort language). Clone has a single key, Type {Text/Number/Date} with Date mapped to numeric parseFloat (NOT real date parsing — recorded), Asc/Desc, header checkbox. No Options…, no case-sensitive toggle (always sensitivity:'base' = case-insensitive), no multi-key, no field sort.
- **Evidence:** sortDialog() commands.js:1934-1955: single Type/dir/header; sortParagraphs cmp uses localeCompare {numeric:true, sensitivity:'base'} (commands.ts:103) — case-insensitive always; numeric=parseFloat (commands.ts:102). Date→numeric noted commands.js:1946-1947.
- **Edge cases to test:** sort numbers as Text vs Number (10 before 9?); case-sensitive needed (no option); sort dates (wrong — parseFloat); header row excluded from sort; single paragraph (no-op); selection spanning a table or list; Descending; undo
- _needsRuntime: true_

### Bullets (dropdown items: Document Bullets / Change List Level / Define New Bullet…) — GAP · S3
- **Word vs clone:** ribbon-data declares 4 menu items (Bullet Library, Document Bullets, Change List Level, Define New Bullet…); the actual flyout renders ONLY the 6-glyph library grid — Document Bullets, Change List Level and Define New Bullet are entirely absent.
- **Evidence:** ribbon-data.js:255-260 lists the 4 items; bulletMenu() at commands.js:1897-1915 builds only flyHeader + glyph grid, no other rows. dropdown() routes bullets→bulletMenu (commands.js:1495).
- **Edge cases to test:** open bullets dropdown and look for Change List Level / Define New Bullet; compare to numbering dropdown (same omission)
- _needsRuntime: false_

### Multilevel List (Current List / List Library / Change List Level / Define New Multilevel List… / Define New List Style…) — GAP · S3
- **Word vs clone:** Word groups Current List + List Library + Lists in Current Documents + Change List Level + Define New Multilevel List + Define New List Style. Clone shows a 'List Library' header, 5 hardcoded patterns, Change List Level, and Define New Multilevel List → notImplemented toast. There is NO 'Current List' section, NO 'Define New List Style…' item at all, and the 5 patterns are clone-invented label strings (e.g. 'Outline (1) a) i))', 'Bullet hierarchy') not Word's gallery thumbnails.
- **Evidence:** multilevelMenu() commands.js:566-578: only List Library header + 5 ML_PATTERNS + Change List Level + 'Define New Multilevel List…'→WC.notImplemented; no Define New List Style despite ribbon-data.js:284-288 listing it.
- **Edge cases to test:** open dropdown — confirm Current List + Define New List Style absent; apply 'Legal (1 1.1 1.1.1)' then Tab through 9 levels; apply on existing single-level list; save+reopen multilevel fidelity
- _needsRuntime: false_

### Numbering (dropdown items: Numbering Library / Change List Level / Define New Number Format… / Set Numbering Value…) — GAP · S3
- **Word vs clone:** ribbon-data declares Numbering Library, Change List Level, Define New Number Format…, Set Numbering Value…; the flyout renders ONLY the 6-format library grid. Change List Level, Define New Number Format, and Set Numbering Value (restart-at / continue / set value) are all missing — there is no way to restart or set a starting number.
- **Evidence:** ribbon-data.js:269-274; bulletMenu(node,true) at commands.js:1897 (ordered) builds only the grid; no setNumberingValue path anywhere in commands.js.
- **Edge cases to test:** need to restart numbering at 1 on a second list; need to continue previous list; need to start at N; Define New Number Format dialog
- _needsRuntime: false_

### Bullets — Bullet Library glyphs — DEVIATION · S4
- **Word vs clone:** Word library shows 7 cells incl. Recently-Used + the standard 7 symbols (•, o, ▪, etc. drawn from Symbol/Wingdings); clone offers 6 hardcoded glyphs (● ○ ■ ◆ ➤ ✓), no recently-used, no None. Non-canonical glyphs (◆ ➤ ✓) mint a one-level numbering def so deeper levels fall back to the base template's bullets, not the chosen glyph.
- **Evidence:** commands.js:1898 bullets = ['●','○','■','◆','➤','✓']; BULLET_STYLE only maps ●○■ (commands.js:1896); others → applyListDefinition with levels:[single] (commands.js:1909).
- **Edge cases to test:** pick ◆ then Tab to level 2 (does glyph persist?); pick ● then save+reopen (Wingdings vs literal char); apply to multi-paragraph selection
- _needsRuntime: true_

### Bullets (split button — main face) — DEVIATION · S4
- **Word vs clone:** Word's main face re-applies the LAST-USED bullet from the gallery; clone always toggles the engine default disc bullet via toggleBulletList.
- **Evidence:** commands.js:67 H.bullets = () => WC.PM.cmd('toggleBulletList'); no last-bullet memory (cf. lastShade/lastBorderEdge state at commands.js:27-28).
- **Edge cases to test:** click on empty paragraph; toggle twice (on then off); multi-paragraph selection mixing list + non-list; inside a table cell; main-face after picking a non-default glyph from the gallery; undo/redo; save+reopen
- _needsRuntime: false_

### Increase Indent — DEVIATION · S4
- **Word vs clone:** Increments 0.5in (36pt) for text, demotes list level inside a list. Word's button uses the default tab stop and, for a one-level list, still demotes; clone's increaseListIndent fails silently if the list def lacks the next level (changeListLevel returns false when !hasListDefinition).
- **Evidence:** commands.js:70 stepIndent(48); inList→increaseListIndent; changeListLevel.js:78-80 returns false (no dispatch) when hasListDefinition(numId,newLevel) is false.
- **Edge cases to test:** increase a one-level toggleBulletListStyle list to level 2 (does it demote or no-op?); increase text indent past page width; head paragraph in list, others not; undo restores prior indent
- _needsRuntime: true_

### Line and Paragraph Spacing (1.0/1.15/1.5/2.0/2.5/3.0) — DEVIATION · S4
- **Word vs clone:** Word marks the CURRENT multiple with a checkmark/radio in the menu; clone's lineSpacingMenu renders the 6 multiples as plain items with NO active-state checkmark. setLineHeight writes spacing.line=mult*240, lineRule=auto (correct).
- **Evidence:** lineSpacingMenu commands.js:1796-1801 — no checked/active marking; setLineHeight lineHeight.js:10-18 (linesToTwips, lineRule auto).
- **Edge cases to test:** open menu on a 1.5-spaced paragraph (no checkmark); apply 1.0 then 2.0; on multi-paragraph mixed spacing; exact/atLeast rule paragraph (menu can't represent); save+reopen
- _needsRuntime: true_

### Line Spacing — Add/Remove Space Before/After Paragraph — DEVIATION · S4
- **Word vs clone:** Word adds the style's default before/after (typically 12pt before / removes after to 0). Clone hard-codes 240 twips (12pt) for Add, 0 for Remove; the label correctly flips (Add↔Remove) based on current spacing, but only one before-item AND one after-item show (Word shows whichever pair applies). Uses a snapshot at open so label can be stale if spacing changed since.
- **Evidence:** commands.js:1804-1812: hasBefore/hasAfter from st snapshot at open; writes spacing.before/after 240|0.
- **Edge cases to test:** Add Space Before on a paragraph that already has 6pt before (jumps to 12, not +); Remove after then undo; multi-paragraph; label correctness after external spacing change
- _needsRuntime: true_

### Numbering — main face + Library formats — DEVIATION · S4
- **Word vs clone:** Main face always toggles default decimal (toggleOrderedList) instead of last-used format. Library offers 6 fixed formats (1. 1) A. a) i. I.); Word shows 7 incl. None + recently-used and uses each format's trailing punctuation/alignment.
- **Evidence:** commands.js:68 H.numbering=toggleOrderedList; ORDERED_STYLE map commands.js:1895; grid commands.js:1898.
- **Edge cases to test:** toggle on/off twice; apply A. then increase indent (level change vs format); two separate lists in one doc (restart?); save+reopen format fidelity
- _needsRuntime: true_

### Sort — selection/contiguity behavior — DEVIATION · S4
- **Word vs clone:** Word sorts the selected paragraphs (or whole doc if nothing selected) including across nested structures; clone only sorts contiguous direct siblings of the first paragraph's parent and bails (returns false, silent) if <2 paragraphs or if other nodes interleave or parents differ.
- **Evidence:** sortParagraphs commands.ts:90-97: same-parent filter + contiguity guard, returns false silently otherwise.
- **Edge cases to test:** select 1 paragraph (silent no-op); selection with an interleaving table/image; paragraphs under different parents; no selection at all
- _needsRuntime: true_

### Decrease Indent — match
- **Word vs clone:** Steps left indent down 0.5in (36pt) or outdents a list level inside a list; clamps at 0 (won't go negative) and the ribbon greys at 0 unless in a list — matches Word.
- **Evidence:** commands.js:69 stepIndent(-48); inList branch commands.js:79-81; decreaseTextIndent clamps left<=0→null (textIndent.js:77-79); enable rule home-features.js:89.
- **Edge cases to test:** decrease at 0 indent (no-op, greyed); decrease inside list at ilvl 0 (outdents out of list in Word?); multi-paragraph selection where head is list but others aren't (head decides branch); imported paragraph with style-derived indent
- _needsRuntime: true_

### Justify (Ctrl+J) — match
- **Word vs clone:** Maps to w:jc=both and renders text-align:justify. Word additionally offers Distributed / justify-low/medium/high via the Paragraph dialog, which the clone lacks — but the ribbon Justify button itself matches.
- **Evidence:** commands.js:66 setTextAlign('justify'); maps 'justify'→'both' (paragraph-alignment.js:11); whitelist accepts 'justify' not 'both' (text-align.js:41).
- **Edge cases to test:** justify last line of paragraph (Word leaves ragged); justify single word; justify list item; save+reopen exports w:jc=both
- _needsRuntime: true_

### Center (Ctrl+E) — DEVIATION · S5
- **Word vs clone:** Sets w:jc=center. In Word, clicking the already-active Center button toggles back to Left; clone's setTextAlign returns false (no-op) when already center — never un-toggles.
- **Evidence:** setTextAlign center: if existingParagraphProperties.justification===storedAlignment return false (text-align.js:70).
- **Edge cases to test:** click Center twice (should revert to left in Word); center an empty paragraph; center a list item; center across page break
- _needsRuntime: true_

### Align Left (Ctrl+L) — match
- **Word vs clone:** Sets w:jc=left (or omits when default); RTL-aware mapping; latch shows pressed when left. Matches Word.
- **Evidence:** commands.js:61 setTextAlign('left'); mapDisplayAlignmentToStoredJustification (paragraph-alignment.js:12); latch st.justifyLeft state-sync.ts:128.
- **Edge cases to test:** click when already left (Word un-presses to nothing; clone no-op); multi-paragraph mixed alignment (none pressed); in table cell; RTL paragraph
- _needsRuntime: false_

### Align Right (Ctrl+R) — match
- **Word vs clone:** Sets w:jc=right with RTL swap (left<->right) — matches Word. Same re-click-no-toggle nuance as Center.
- **Evidence:** commands.js:63; paragraph-alignment.js:13-14 RTL swap.
- **Edge cases to test:** re-click (no un-toggle); RTL paragraph swaps to left; in table cell
- _needsRuntime: false_

---

## Home / Styles + Clipboard + Editing + Voice(Dictate) + Sensitivity + Editor  
_30 controls audited_

### Format Painter — double-click lock + Esc to stop — BUG · S2
- **Word vs clone:** Word: double-click locks the painter for repeated application until Esc or re-click. Clone double-click arms persistent mode and TOASTS 'Press Esc to stop', but NOTHING listens for Esc to cancel the painter — the global Esc handler never calls cancelFormatPainter and the fork only watches Shift+Arrow keys. The painter stays armed forever (until manual re-toggle).
- **Evidence:** ribbon.js:496 dblclick→formatPainterLock; commands.js:37/1714 toast 'Press Esc to stop'; app.js:70-77 Escape handler has NO painter branch; format-commands.js:337-363 handleKeyDown only isFormatPainterSelectionKey (Shift+Arrows), no Escape
- **Edge cases to test:** double-click lock then apply to 3 paragraphs in a row; press Esc — SHOULD disarm, currently does not; click the painter button again to toggle off; apply across a page break; lock then open a dialog (does arm survive?)
- **Improvement:** Wire Esc (and a re-click) to WC.PM.cancelFormatPainter; latch reflects painterArmed already.
- _needsRuntime: true_

### Replace (cmd:replace, Ctrl+H) — BUG · S2
- **Word vs clone:** Word's Replace dialog ALWAYS exposes Match case / Whole words / Use wildcards (via More>>) plus Replace/Replace All/Find Next and Format/Special. Clone calls findPane(replace=true) with advanced=undefined, so the options row is display:none — Replace is locked to case-insensitive, whole-word-off, no-wildcard, with no way to enable them.
- **Evidence:** commands.js:102 H.replace=findPane(true); dialogs.js:133 optRow display: advanced?'block':'none'; H.replace passes no advanced flag
- **Edge cases to test:** Ctrl+H → no options visible; cannot do case-sensitive replace; cannot do whole-word replace; cannot wildcard replace from the Replace pane; Replace All toasts 'Replaced N'
- **Improvement:** Pass advanced=true (or always show options) for the Replace pane.
- _needsRuntime: false_

### Styles Gallery — 'Create a Style…' — STUB · S2
- **Word vs clone:** Word opens 'Create New Style from Formatting' dialog (name + Modify for full style def) and mints a real custom style. Clone's More→'Create a Style…' calls WC.notImplemented.
- **Evidence:** ribbon.js:375 onClick WC.notImplemented('Create a Style (custom style authoring)')
- **Edge cases to test:** More menu → Create a Style → notImplemented toast; no custom style ever creatable
- **Improvement:** Even a minimal name+based-on dialog that writes a styles.xml entry would close a major gap.
- _needsRuntime: false_

### Format Painter — single click (cmd:formatPainter) — BUG · S3
- **Word vs clone:** Word: single-click arms a one-shot painter, cursor becomes a paintbrush, next selection gets char+para formatting then auto-disarms; Esc cancels. Clone arms via fork copyFormat (one-shot) and shows a toast, but the toast and Esc-to-cancel promise is only honored for the LOCKED variant; single-shot path otherwise matches.
- **Evidence:** commands.js:36/1710-1714 armPainterPM; commands.ts:185-189 armFormatPainter→copyFormat; cursor set state-sync.ts:242
- **Edge cases to test:** arm then click target paragraph — applies para+char props; arm then select multi-paragraph range; arm then click — does it auto-disarm after one apply?; painted run keeps hyperlink (oracle B8) but clears other marks; arm with empty source selection (nothing to copy); arm then click inside a table cell; undo a paint = one step
- _needsRuntime: true_

### Editor (cmd:editor, F7) — DEVIATION · S3
- **Word vs clone:** Word's Editor pane gives an ML Editor Score, spelling, grammar, and refinements (Clarity/Conciseness/Formality/Inclusiveness/Punctuation/Vocabulary/Resume/Similarity/Insights) with cloud ML. Clone's editorPane ships REAL offline spelling (nspell+SCOWL) + mechanical grammar + heuristic Clarity/Conciseness; the ML-only refinements + Similarity/Insights are disabled rows honestly flagged. Editor Score is a heuristic, not Word's model.
- **Evidence:** dialogs.js:595-658 editorPane; deferrals.md:347-360 cloud ML deferral; ribbon feasible:'no' but handler opens pane
- **Edge cases to test:** misspelled word → spelling card with suggestions; grammar issue (double space/article) → card; apply a correction via PM transaction; ignore a word persists in session; Editor Score updates after fix; F7 keyboard opens pane; disabled cloud rows show tooltip
- _needsRuntime: true_

### Find dropdown — Advanced Find… — DEVIATION · S3
- **Word vs clone:** Word's Advanced Find dialog has Search direction (Up/Down/All), Find Next, Reading Highlight (Highlight All/Clear), Find In, and a 'More >>' panel with Match case, Whole words, Use wildcards, Sounds like, Find all word forms, Match prefix/suffix, Ignore punctuation/whitespace, plus Format and Special menus. Clone's Advanced Find reuses the same task pane with only 3 checkboxes (Match case / Whole words only / Use wildcards).
- **Evidence:** commands.js findMenu dialogs.js:930 findPane(false,true); optRow only 3 mkOpt rows (139-154)
- **Edge cases to test:** Advanced Find shows the 3 options row; Use wildcards greys Match case (forced case-sensitive) — implemented (146-153); no Format/Special menus; no Sounds-like / word-forms; no search direction
- **Improvement:** deferrals.md:370 records the exotic options gap; Format/Special menus + direction are still missing.
- _needsRuntime: false_

### Find/Replace — wildcard syntax — DEVIATION · S3
- **Word vs clone:** Word wildcards: ? * < > [..] [!..] {n}/{n,m} @ (1+) (..) grouping with \1 replace backrefs. Clone's wildcardToRegExp supports ? * < > [..] [!..] and escaping, but NOT {n}/{n,m}, @ (one-or-more), () grouping, or \1 backreferences in Replace.
- **Evidence:** SearchIndex.js:466-510 wildcardToRegExp handles ? * < > [ ! ; no {} @ () ; replace is literal text search.js:810/875
- **Edge cases to test:** find 'a{2,3}' → unsupported; find '(a)(b)' replace '\2\1' → no backref, literal; find 'colou?r' works (?); find '<word>' boundary works; find '[A-C]at' class works; find '[!0-9]' negation works
- **Improvement:** Add {n,m}, @, grouping + \1 backreference and Replace ^& (matched text).
- _needsRuntime: true_

### Go To… (Ctrl+G) — DEVIATION · S3
- **Word vs clone:** Word's Go To lists ~13 targets (Page/Section/Line/Bookmark/Comment/Footnote/Endnote/Field/Table/Graphic/Equation/Object/Heading) with +/- relative jumps and Next/Previous buttons. Clone offers only Heading/Bookmark/Page/Line; Heading works, Bookmark always false, Page/Line toast 'available after pagination (Phase 7)'. No relative +/-, no Next/Prev.
- **Evidence:** dialogs.js:201-218 goToDialog (4 targets); search.ts:14-64 goToImpl: heading ok, bookmark false, page/line false; deferrals.md:25
- **Edge cases to test:** Go To Heading 2 → jumps to 2nd heading; Go To Heading beyond count → clamps to last; Go To Bookmark → false (no toast?); Go To Page → 'after pagination' toast; Go To Line → toast; no +5/-2 relative; no Next button
- **Improvement:** Bookmark Go To returns false silently with a generic toast — add real bookmark support once schema has bookmarks.
- _needsRuntime: true_

### Merge/Match Formatting paste (pasteMerge) — DEVIATION · S3
- **Word vs clone:** Word's Merge Formatting keeps source emphasis but adopts destination paragraph style incl. list/number context and theme; clone strips a fixed CSS prop list (font-family/size/color/bg/line-height/mso-*) from source HTML and lets it fall through — approximate, no list/style reconciliation.
- **Evidence:** clipboard.ts:35-39 MERGE_STRIP_PROPS, 60-70 mergeFormattingHtml, 164-168 pasteMerge
- **Edge cases to test:** merge a bulleted list into a numbered context; merge text carrying a table; merge colored heading text into Normal; merge then save+reopen — do dest fonts persist in OOXML?
- _needsRuntime: true_

### Paste (split, main face) — home.clipboard.paste / cmd:paste — DEVIATION · S3
- **Word vs clone:** Word's plain Ctrl+V default is Keep Source Formatting and pastes rich HTML/RTF/image with full fidelity; clone routes to api().paste() native webContents paste honoring a localStorage 'Set Default Paste' mode (keepSource/merge/text).
- **Evidence:** commands.js:35 H.paste=WC.PM.pasteDefault; clipboard.ts:113-121 pasteDefault reads defaultPasteMode() then native paste / pasteMerge / pasteTextOnly
- **Edge cases to test:** paste rich HTML from Word/web; paste an image from clipboard via Ctrl+V (should it route to picture? default doesn't); paste RTF only (no html flavor); paste into a table cell; paste at empty doc start; set default=Keep Text Only then Ctrl+V; paste then undo (one step?); paste then save+reopen fidelity
- **Improvement:** Ctrl+V of an image-only clipboard should still paste the picture; verify native paste covers image.
- _needsRuntime: true_

### Paste dropdown options (Keep Source / Match / Picture / Keep Text Only / Paste Special / Set Default Paste) — DEVIATION · S3
- **Word vs clone:** Word labels the merge option 'Merge Formatting' (icon MF); clone labels it 'Match Formatting'. Word shows live-preview thumbnails on hover for each paste option; clone's flyout items have no hover preview and a fixed 4-button set with enablement by flavor.
- **Evidence:** commands.js:1969-1975 pasteMenu items 'Keep Source Formatting'/'Match Formatting'/'Picture'/'Keep Text Only'; ribbon-data label set says 'Merge Formatting'; pasteOptionStates clipboard.ts:49-58
- **Edge cases to test:** dropdown with text-only clipboard (Picture disabled?); with image-only clipboard (only Picture enabled?); with empty clipboard (all disabled); Merge: paste Word heading into Normal para — does dest font win?; Keep Text Only must not autolink a URL (noPasteAutolink) — verify; Picture from html-with-img clipboard
- _needsRuntime: true_

### Paste Special… dialog — DEVIATION · S3
- **Word vs clone:** Word's Paste Special lists many formats (Microsoft Word Document Object, Formatted Text RTF, Unformatted Text, Picture (Enhanced Metafile/PNG/JPEG/GIF/Bitmap/Device Independent Bitmap), HTML Format, Unformatted Unicode Text, Hyperlink) AND a 'Paste link' radio + 'Display as icon'. Clone shows at most 3 rows (HTML Format / Unformatted Text / Picture) driven by clipboard flavors, no Paste-link, no Display-as-icon, no result description.
- **Evidence:** dialogs.js:509-545 pasteSpecial builds options from fl.hasHtml/hasText/hasImage only
- **Edge cases to test:** clipboard empty → 'The Clipboard is empty.'; rich clipboard shows HTML+Unformatted; dblclick row = OK; Enter/arrow keyboard nav; RTF-only clipboard (no html) — does it offer anything?
- **Improvement:** Add 'Paste link', RTF, Unformatted Unicode Text, and a description line per Word.
- _needsRuntime: false_

### Replace All — count + scope — DEVIATION · S3
- **Word vs clone:** Word reports 'Word has completed... N replacements' and supports selection-scoped Replace All (asks to continue past selection). Clone toasts 'Replaced N' but Replace All is WHOLE-DOC only (no selection scope).
- **Evidence:** dialogs.js:192-197 doReplaceAll toast 'Replaced N'; deferrals.md:369 selection-scoped Replace All not supported
- **Edge cases to test:** replace all 5 occurrences → 'Replaced 5'; replace all with empty replace = delete matches; replace all then undo (one step?); replace all with selection active (ignores selection scope); replace all across page break
- _needsRuntime: true_

### Select dropdown — Select All Text With Similar Formatting — DEVIATION · S3
- **Word vs clone:** Word selects ALL discontiguous runs matching the reference run's formatting (multi-range). Clone collapses to ONE TextSelection spanning first→last matching run (contiguous range), so intervening non-matching text is included in the selection.
- **Evidence:** commands.js:1922; commands.ts:141-168 selectSimilarFormatting single-range first..last; comment notes recorded deviation
- **Edge cases to test:** bold run A ... plain ... bold run B → selects A..B incl plain (wrong vs Word); caret not in text → toast 'Place the cursor in text first.'; single matching run; selection at run start boundary marks edge case; then apply a mark to the over-broad selection
- _needsRuntime: true_

### Styles Gallery — apply built-in style (cmd:stylesGallery, cells) — DEVIATION · S3
- **Word vs clone:** Word applies the clicked Quick Style and shows LIVE hover preview over the selection; gallery reflects the active style and theme fonts/colors. Clone applies on CLICK only (no hover preview — product-locked 2026-06-11) via applyStyleByName→setStyleById; cells use hardcoded CSS approximations, not theme-resolved.
- **Evidence:** ribbon.js:14-16 no-op preview, 335-380 renderStylesGallery, commands.js:1650-1656 applyStyle; deferrals.md:379
- **Edge cases to test:** apply Heading 1 to a paragraph; apply to multi-paragraph selection; apply char-style (Strong) to a sub-word selection (linked char style branch); apply on empty caret = current paragraph; apply a style absent from doc catalog → toast 'not available'; apply then save+reopen styleId persists; hover does NOT preview (verify no flicker)
- _needsRuntime: true_

### Styles task pane (dialog-box launcher, Ctrl+Alt+Shift+S) — DEVIATION · S3
- **Word vs clone:** Word's Styles pane lists every style with paragraph/char markers, hover dropdown (Modify/Select All instances/Rename/Delete/Remove from gallery), Show Preview, Disable Linked Styles, and Options + New Style/Style Inspector/Manage Styles footer buttons. Clone shows a flat name list with Show Preview, click-to-apply, and footer New Style (toast stub) + Clear All only.
- **Evidence:** dialogs.js:322-361 stylesPane; 'New Style' toasts 'isn't on the new engine yet' (355)
- **Edge cases to test:** open pane → flat list; click style applies; New Style → toast stub; no per-style Modify/Delete/Rename; no Style Inspector button; no Manage Styles; Show Preview toggle restyles list rows
- **Improvement:** Add Style Inspector + Manage Styles entry points and per-style context menu.
- _needsRuntime: false_

### Clipboard dialog-box launcher (Office Clipboard task pane) — STUB · S3
- **Word vs clone:** Word's Office Clipboard pane shows up to 24 collected cut/copy items with thumbnails, Paste All, Clear All, and per-item paste/delete. Clone in PM mode shows a toast 'Office Clipboard history arrives in a later slice.' and never opens the pane — although capture() silently runs on every copy/cut, so a hidden store fills but is unreachable.
- **Evidence:** commands.js:1683 launcher→clipboardPane; dialogs.js:470-471 PM-branch toasts and returns; capture still called clipboard.ts:105/home-features.js:59-60
- **Edge cases to test:** open pane in PM → toast only; copy several items → no visible history; deferrals.md:410 claims pane opens — verify it does NOT
- **Improvement:** Either render the captured WC.Clipboard.items in PM (data already collected) or stop capturing; current state wastes work + contradicts the deferral note.
- _needsRuntime: false_

### Find/Replace — Special characters (^p ^t ^& ^w ^m ^l...) — GAP · S3
- **Word vs clone:** Word's Find/Replace 'Special' menu inserts codes (^p paragraph mark, ^t tab, ^l manual line break, ^m manual page break, ^w white space, ^& Find What text, ^nnnn unicode, etc.) usable in both find and replace. Clone has no Special menu and no code interpretation — '^p' is searched literally; replacement is plain text only.
- **Evidence:** No '^p'/special handling in search.js or dialogs.js; replace inserts schema.text literally (search.js:810/875)
- **Edge cases to test:** replace ^p with space → searches literal caret-p; find ^t (tab) → literal; replace 'foo' with 'bar^&baz' → literal ^& inserted
- **Improvement:** Pre-translate ^p/^t/^&/^l/^m at least in non-wildcard mode.
- _needsRuntime: true_

### Style Inspector — GAP · S3
- **Word vs clone:** Word has a Style Inspector pane (paragraph style + plus-direct-formatting, char style + plus-direct, with Reset/Clear/New Style buttons). Clone has no Style Inspector at all (no command, no menu entry).
- **Evidence:** No 'styleInspector' cmd or function anywhere; not in ribbon-data, commands.js, dialogs.js
- **Edge cases to test:** not reachable from any UI
- **Improvement:** Surface a minimal inspector reading getState().block + direct marks.
- _needsRuntime: false_

### Select dropdown — Select Objects — DEVIATION · S4
- **Word vs clone:** Word's Select Objects turns the cursor into an arrow that selects/drags floating drawing objects (and stays in object-select mode). Clone routes to pm.dSetSelect() which flips the DRAW overlay tool to 'select' — tied to the Draw engine, not Word's object-pick arrow over body floats.
- **Evidence:** commands.js:1921 'Select Objects'→pm.dSetSelect(); draw.ts:103 dSetSelect sets drawState.tool='select'
- **Edge cases to test:** Select Objects then click a floating image; Select Objects with no drawings; does it persist as a mode; Esc exits mode
- _needsRuntime: true_

### Set Default Paste… — DEVIATION · S4
- **Word vs clone:** Word's File→Options→Advanced cut/copy/paste section has many knobs (pasting within same doc / between docs / from other programs / insert-paste settings / Smart Cut & Paste / Show Paste Options button / Use Insert key / Keep bullets & numbers). Clone ships ONE global default-paste mode (keepSource/merge/text) in a custom mini-dialog.
- **Evidence:** dialogs.js:551-585 setDefaultPaste; clipboard.ts:20-26 defaultPasteMode reads single localStorage key
- **Edge cases to test:** set merge → Ctrl+V uses merge; set text → Ctrl+V plain; persists across reload (localStorage); no per-source granularity
- **Improvement:** Add the within/between/other-program granularity at least as no-op-faithful rows.
- _needsRuntime: false_

### Styles Gallery — 'Apply Styles…' (Ctrl+Shift+S) — DEVIATION · S4
- **Word vs clone:** Word's Apply Styles is a small floating combo with Reapply/Modify/New buttons and shows current style; it stays open and tracks the caret. Clone is a one-shot modal with a datalist text input and only Apply/Cancel — no Reapply/Modify/New, no live caret tracking.
- **Evidence:** dialogs.js:364-373 applyStyles; ribbon.js:377
- **Edge cases to test:** type a style name + Apply; type an unknown name (silent? Word offers to create); Ctrl+Shift+S keyboard route; datalist autocomplete from allStyleNames
- **Improvement:** Add Modify/New buttons and keep it dockable like Word.
- _needsRuntime: false_

### Styles Gallery — active-style highlight / sync — DEVIATION · S4
- **Word vs clone:** Word highlights the current paragraph's style in the gallery and scrolls it into view. Clone only marks active in the EXPANDED More grid (cell gets .active if s===getState().block); the inline carousel row has no active marker.
- **Evidence:** ribbon.js:371-372 active only in openMore expanded grid; inline cells (354-365) no active class
- **Edge cases to test:** place caret in Heading 2 → is Heading 2 marked active in collapsed gallery?; imported doc with a heading style; caret in a List Paragraph
- _needsRuntime: true_

### Dictate (split, cmd:dictate) — STUB · S4
- **Word vs clone:** Word's Dictate does live speech-to-text with language picker + auto-punctuation. Clone main face and dropdown both toast "Dictate isn't available in this clone". ribbon feasible:'no'.
- **Evidence:** commands.js:482 H.dictate toast; 1507 dropdown toast; deferrals.md:411
- **Edge cases to test:** click main → toast; open dropdown (Spoken Language/Settings) → toast
- **Improvement:** Web Speech API is a feasible PM follow-up per deferrals.md:411.
- _needsRuntime: false_

### Select dropdown — Selection Pane… — STUB · S4
- **Word vs clone:** Word's Selection Pane lists all objects on the page with show/hide eyes, reorder, and rename. Clone toasts 'Selection Pane lists drawing objects — arrives with the Draw engine re-host (slice 10).'
- **Evidence:** commands.js:1924 onClick toast
- **Edge cases to test:** click → toast only; no pane ever opens
- _needsRuntime: false_

### Find (split main face, Ctrl+F) — match
- **Word vs clone:** Word Ctrl+F opens the Navigation pane with incremental search + result count + prev/next. Clone opens a Navigation task pane (findPane(false)) with debounced highlight-only search, '#of#' counter, Prev/Next, Enter=next. Matches well; no Headings/Pages results tabs in the pane.
- **Evidence:** commands.js:101 H.find; dialogs.js:102-198 pmFindPane; findNext/refreshCount
- **Edge cases to test:** incremental type updates count; Enter jumps next; Prev/Next wrap; no matches → 'No matches'; find across paragraphs; find inside table; find then edit doc (session refresh); close pane clears highlights; find with caret in header (n/a)
- _needsRuntime: true_

### Replace (single) — match
- **Word vs clone:** Word's Replace replaces the current match and advances. Clone replaceOne replaces active match then refreshes count.
- **Evidence:** dialogs.js:187-191 doReplaceOne→pm.replaceOne; search.js:794-833
- **Edge cases to test:** replace one, advance to next; replace one with no active match (runs find first); replace at last match; replace then continue Replace All
- _needsRuntime: true_

### Sensitivity (dropdown, cmd:sensitivity) — STUB · S5
- **Word vs clone:** Word applies a Microsoft Purview sensitivity label (org policy, may encrypt). Clone toasts "Sensitivity labels aren't available in this clone" for button and each item. Expected cloud/runtime deferral.
- **Evidence:** commands.js:483 H.sensitivity toast; 1508 dropdown toast; deferrals.md:411
- **Edge cases to test:** click Public/Confidential → toast
- _needsRuntime: false_

### Copy (cmd:copy, Ctrl+C) — match
- **Word vs clone:** Both copy selection to clipboard; clone disables button with no selection and refreshes paste enablement.
- **Evidence:** commands.js:34; clipboard.ts:110-112 copySelection; home-features.js:80
- **Edge cases to test:** copy empty selection (disabled); copy image; copy then paste into same doc; copy formatted run then Keep Text Only paste loses format
- _needsRuntime: true_

### Cut (cmd:cut, Ctrl+X) — match
- **Word vs clone:** Both remove the selection to the clipboard. Clone focuses the view, captures into Office-Clipboard store, calls native cut; button disabled when no selection (ribbon rule).
- **Evidence:** commands.js:33; clipboard.ts:107-109 cutSelection; home-features.js:79 enabled rule
- **Edge cases to test:** cut with empty selection (button should be disabled); cut a whole paragraph incl. mark of style; cut across a list boundary; cut in a table cell; cut then paste elsewhere keeps formatting; undo restores
- _needsRuntime: true_

### Select dropdown — Select All (Ctrl+A) — match
- **Word vs clone:** Both select the whole document. Clone routes to pm.selectAll→selectAll command.
- **Evidence:** commands.js:1920 selectMenu 'Select All'; commands.ts:136 selectAll
- **Edge cases to test:** select all empty doc; select all with table; select all then apply style; Ctrl+A keyboard
- _needsRuntime: true_

### Styles Gallery — 'Clear Formatting' — match
- **Word vs clone:** Both clear direct formatting back to the underlying style. Clone routes More→Clear Formatting to clearAllFormatting (clearFormat command).
- **Evidence:** ribbon.js:376; commands.js:49 H.clearAllFormatting→WC.PM.cmd('clearFormat')
- **Edge cases to test:** clear a bold+colored run; clear a styled paragraph (keeps style, drops direct fmt?); clear across paragraphs; clear in a list item
- _needsRuntime: true_

---

## Insert / Illustrations + Media (Pictures, Shapes, Icons, 3D Models, SmartArt, Chart, Screenshot, Online Video)  
_12 controls audited_

### Shapes (dropdown) — gallery + insert — BUG · S2
- **Word vs clone:** Word inserts a real auto-shape (DrawingML wps:sp) that is selectable/resizable/rotatable/wrappable and round-trips. Clone shows a shape gallery but EVERY shape click is a dead no-op toast: 'Inserting "X" shapes isn't available on the new engine yet.' Nothing is inserted.
- **Evidence:** insert-features.js:118-122 Insert.insertShape = WC.toast(...) only — no PM verb. Gallery built at 104-117 but click→insertShape→toast.
- **Edge cases to test:** click any shape in each category (Lines/Rectangles/Basic/Block Arrows/Stars/Callouts) → toast, no insert; verify no E()/document leak; confirm gallery missing Recently Used + Flowchart + Equation Shapes categories declared in ribbon-data:684-693
- _needsRuntime: false_

### Screenshot (dropdown: Available Windows / Screen Clipping) — DEVIATION · S2
- **Word vs clone:** Word's Available Windows shows live thumbnails of each open non-minimized window (click one → inserts that window's capture); Screen Clipping dims the screen and lets you drag a rectangular region. Clone: the 'Available Windows' header is a NON-FUNCTIONAL label (no window enumeration/thumbnails at all), and the single 'Screen Clipping' item does NOT clip a region — it minimizes the app and captures the ENTIRE primary screen as one image (no rubber-band selection, no multi-monitor choice, picks sources[0] only).
- **Evidence:** commands.js:391-392 screenshotMenu adds flyHeader('Available Windows') [inert] + one flyItem 'Screen Clipping'→WC.Insert.screenshot(); insert-features.js:349-354 screenshot→wordAPI.screenshot; main.js:492-507 captures full-screen via desktopCapturer types:['screen'], inserts sources[0].thumbnail (whole display), no region crop, no window picker.
- **Edge cases to test:** open dropdown — 'Available Windows' shows no thumbnails (verify inert); Screen Clipping with 2 windows open → captures whole screen not a region; multi-monitor → only display[0] captured; captured image inserted at natural display resolution (likely huge — verify clamp); app un-minimize timing (450ms) race
- _needsRuntime: true_

### Chart (button → dialog) — STUB · S2
- **Word vs clone:** Word inserts a live chart (c:chartSpace) backed by an embedded Excel worksheet with editable data and chart-type gallery. Clone shows a chart-type + data dialog, but pressing OK calls xeChart which is a no-op toast — the dialog's type/data input is collected and then THROWN AWAY; nothing is inserted. (A full chartSVG renderer exists in insert-features.js:168-183 but is never called by the OK button — dead code.)
- **Evidence:** insert-features.js:155-167 chartDialog OK→WC.PM.xeChart() ignoring `type`/`data`; insert-exotica.ts:178 xeChart = toast only. Insert.chartSVG (168-183) is orphaned — no caller.
- **Edge cases to test:** fill dialog, change type to Pie, edit data, OK → toast only, no insert; confirm chartSVG renderer is dead/unwired; verify data textarea parsing is never used
- _needsRuntime: false_

### Icons (button → picker) — DEVIATION · S3
- **Word vs clone:** Word opens a categorized stock-icon library (hundreds of monochrome SVG icons across categories with search). Clone opens a small picker built from the app's OWN Fluent UI ribbon-icon set (~40 names like save/find/bold/zoom), inserts the chosen icon as an inline image. So you get app chrome icons, not Word's icon content library. Insert path works.
- **Evidence:** insert-features.js:125-143 iconsPicker uses WC.ICON_NAMES (ribbon icon list); click→WC.PM.xeIcon(n); insert-exotica.ts:142-149 xeIcon embeds 'data:image/svg+xml;utf8,'+SVG as a w:drawing image (32x32).
- **Edge cases to test:** search filter behavior; insert an icon → size 32x32 inline; save+reopen: SVG-only w:drawing has NO raster a:blip fallback (deferrals.md:392) — verify it renders in real Word and survives resave via oracle read-shapes; insert icon inside table cell; insert then resize via picture overlay
- _needsRuntime: true_

### Online Video (button → dialog) — DEVIATION · S3
- **Word vs clone:** Word embeds a playable video frame (wp15:webVideoPr) showing the provider poster; double-click plays inline. Clone's ribbon H.onlineVideo opens onlineVideoDialog which inserts a SELF-GENERATED SVG poster thumbnail (generic red play button + host + truncated URL) as a normal inline image, with the URL kept only in the image alt/description — NO embedded playback, NO real provider thumbnail (CSP blocks remote img), and it is a plain picture not a video object. (Separately, a bridge xeOnlineVideo exists that inserts a real hyperlink instead — but the ribbon path uses the SVG-poster dialog, not that verb.)
- **Evidence:** commands.js:379 H.onlineVideo→WC.Insert.onlineVideoDialog (insert-features.js:314-348); insertVideoThumbnail builds an SVG data-url poster and inserts via insertPictureFromDataUrl; URL stored as alt 'Online video: '+u. Bridge xeOnlineVideo (insert-exotica.ts:169-175) inserts a link but is unused by this path.
- **Edge cases to test:** paste a YouTube URL → SVG poster inserted (no embed); invalid/non-http URL (safeUrl returns '#' → no insert, verify); very long URL truncation to 54 chars; save+reopen: is it a w:drawing image with the URL only in description? confirm no webVideoPr; URL with special chars (esc)
- _needsRuntime: true_

### Pictures (dropdown) — body / menu open — DEVIATION · S3
- **Word vs clone:** Word's Pictures dropdown offers This Device / Stock Images / Online Pictures (3 items). Clone's picturesMenu renders only TWO items: 'This Device…' and 'Online Pictures…' — the declared 'Stock Images…' item is dropped, and Online Pictures is a dead toast.
- **Evidence:** commands.js:394-399 picturesMenu builds only 2 flyItems; ribbon-data.js:670-674 declares 3 items incl 'Stock Images...'; Online Pictures onClick = WC.toast('Online Pictures needs an image search backend…').
- **Edge cases to test:** open dropdown and count items vs ribbon-data; click 'Stock Images' expectation (no such item); verify caret/body both open the same 2-item menu
- _needsRuntime: false_

### Shapes gallery — category coverage — DEVIATION · S3
- **Word vs clone:** Word's Shapes flyout has Recently Used Shapes, Lines, Rectangles, Basic Shapes, Block Arrows, Equation Shapes, Flowchart, Stars and Banners, Callouts, plus 'New Drawing Canvas'. Clone's SHAPES map has only Lines(2), Rectangles(2), Basic Shapes(5), Block Arrows(3), Stars and Banners(2), Callouts(1) — and OMITS Recently Used, Equation Shapes, Flowchart entirely, and has NO 'New Drawing Canvas' item even though ribbon-data declares it.
- **Evidence:** insert-features.js:96-103 SHAPES has 6 categories, missing Flowchart/Equation Shapes/Recently Used; shapesMenu (104-117) renders no 'New Drawing Canvas' entry though ribbon-data.js:693 lists it. Each category has far fewer shapes than Word (e.g. Lines has 2 vs Word's ~6).
- **Edge cases to test:** open flyout, enumerate categories vs Word; look for 'New Drawing Canvas' (absent); count shapes per category
- _needsRuntime: false_

### SmartArt (button → menu) — STUB · S3
- **Word vs clone:** Word opens the full SmartArt gallery (List/Process/Cycle/Hierarchy/Relationship/Matrix/Pyramid/Picture, dozens of layouts) and inserts an editable dgm: diagram. Clone shows a 4-item flyout (Basic List/Basic Process/Cycle/Hierarchy) but EVERY pick calls xeSmartArt which is a no-op toast — nothing is inserted regardless of chosen layout.
- **Evidence:** insert-features.js:146-152 smartArtMenu→insertSmartArt(kind)→WC.PM.xeSmartArt(); insert-exotica.ts:179 xeSmartArt = toast('SmartArt … available in a future update.') returns true. The chosen 'kind' is discarded.
- **Edge cases to test:** pick each of the 4 layouts → all produce identical toast, no insert; confirm 'kind' arg is ignored; no false-success/E() leak
- _needsRuntime: false_

### Pictures → Online Pictures… — GAP · S3
- **Word vs clone:** Word opens Bing image search / OneDrive picker. Clone shows an honest no-op toast and inserts nothing. (Note: a separate xeOnlinePicture bridge verb exists that degrades to a LOCAL file pick, but the live menu does NOT call it — it calls a bare toast, so there is no insert at all.)
- **Evidence:** commands.js:397 onClick=WC.toast('Online Pictures needs an image search backend — not available in this clone.'); the working xeOnlinePicture (insert-exotica.ts:150-158) is dead code per its own NOTE at line 183.
- **Edge cases to test:** click → expect toast only, no document mutation; confirm xeOnlinePicture is never reachable from ribbon
- _needsRuntime: false_

### 3D Models (split: This Device / Stock 3D Models) — STUB · S4
- **Word vs clone:** Word inserts a rotatable 3D model (glTF/fbx/obj) with a 3D orbit control + Pan & Zoom. Clone shows a single honest toast for the whole control; neither the 'This Device' nor 'Stock 3D Models' dropdown items are wired to anything functional.
- **Evidence:** commands.js:376 H['3dModels'] = WC.toast('3D models require a 3D model viewer/runtime…'); commands.js:1530 dropdown also routes to the same toast — the two declared items (ribbon-data.js:712-713) have no individual handlers.
- **Edge cases to test:** click split body and caret → both toast; verify the two dropdown items are non-functional/identical
- _needsRuntime: false_

### Shapes → New Drawing Canvas — GAP · S4
- **Word vs clone:** Word inserts a bounded drawing canvas region. Clone's Shapes menu has no New Drawing Canvas item at all (declared in ribbon-data but never rendered). Note: a separate Draw-tab dInsertCanvas exists but it is not on this menu.
- **Evidence:** ribbon-data.js:693 declares 'New Drawing Canvas'; insert-features.js:104-117 shapesMenu builds only the SHAPES grid, never appends a Drawing Canvas item.
- **Edge cases to test:** open Shapes flyout — confirm item absent
- _needsRuntime: false_

### Pictures → This Device… — match
- **Word vs clone:** Word opens a file picker, inserts the image inline at natural size clamped to text-column width. Clone does the same: pickImage IPC → insertPictureFromDataUrl reads natural size, clamps to content-column width, preserves aspect.
- **Evidence:** commands.js:339-343 H.pictures→pickImage→insertPictureFromDataUrl (322-338) reads imageNaturalSize, clamps to contentWidthPx; main.js:473-485 fs:readImage returns base64 data-url. Filters png/jpg/jpeg/gif/bmp/webp/svg.
- **Edge cases to test:** insert into empty doc; insert a very wide image (clamp to column); insert a 0x0/undecodable SVG (falls back to 480x360 default — verify); insert >50MB data-url (rejected by insert.ts:48); insert inside a table cell; insert at caret in mid-paragraph; save+reopen → image still embedded as word/media; insert tiny icon-sized PNG (should stay natural, not blow up)
- _needsRuntime: true_

---

## Insert / Links + Comments + Header&Footer + Text + Symbols  
_17 controls audited_

### Cross-reference (button) — DEVIATION · S2
- **Word vs clone:** Word offers 7 reference types (Numbered item, Heading, Bookmark, Footnote, Endnote, Equation, Figure, Table) and ~6 'Insert reference to' options plus 'Insert as hyperlink' and 'Include above/below' checkboxes; the clone offers only Type={Heading,Bookmark} and Insert={Page number,Text,Above/below}, no hyperlink checkbox.
- **Evidence:** commands.js:949-987 crossRefDialogPM — type select only ['Heading','Bookmark'], refType ['Page number','Text','Above/below']; underlying d.crossRefs.insert is real (references.ts:624-637).
- **Edge cases to test:** cross-ref to a Heading vs a Bookmark; 'Above/below' display result wording; empty doc (no headings/bookmarks → '(none)' option); REF field updates on F9 after target moves; save+reopen field code survives; caret inside a table cell
- _needsRuntime: false_

### Equation (split: gallery / Insert New / Ink Equation / Save to Gallery) — DEVIATION · S2
- **Word vs clone:** Word inserts real OMML <m:oMath> via a structured equation editor (Equation Tools tab, structures/symbols, professional/linear toggle, ink). The clone: main click opens a plain Unicode-text textarea (placeholder admits 'Full equation editor is not implemented'); the split-arrow menu (equationMenu) lists 5 built-in strings + 'Insert New Equation' but OMITS the ribbon-declared 'Ink Equation…' and 'Save Selection to Equation Gallery…'. Result is Cambria-Math + italic STYLED TEXT, not OMML — round-trips as text, not as a math object.
- **Evidence:** dialogs.js:84-98 D.equation (textarea, placeholder admits not implemented); commands.js:413-415 equationMenu (5 presets + Insert New only, no Ink/Save); insert.ts:177-217 insertEquation = unsetAllMarks+Cambria Math+italic text; deferrals.md:360 'Equation = styled Cambria-Math text, not OMML'.
- **Edge cases to test:** insert in a bold/red run (marks must be cleared — M4); built-in preset insert; Ink Equation item (missing); Save to Equation Gallery (missing); Alt+= shortcut; startPos=endPos-text.length assumption with multi-codepoint glyphs; save+reopen — comes back as styled text not a math zone
- _needsRuntime: true_

### Link (split — Insert Link…) — DEVIATION · S2
- **Word vs clone:** Word's Insert Hyperlink dialog has 4 link-to categories (Existing File/Web Page, Place in This Document [bookmarks+headings], Create New Document, E-mail Address), a 'ScreenTip' button, and a 'Target Frame' option; the clone shows only 'Text to display' + a single raw 'Address' field.
- **Evidence:** dialogs.js:45-63 D.insertLink — only text+addr inputs, no category tabs / ScreenTip / email tab; passes addr.value RAW to WC.PM.insertLink (no safeUrl, no mailto/http auto-prefix).
- **Edge cases to test:** type a bare domain 'example.com' (no scheme) — sanitizeHref treats it as a RELATIVE path vs Word auto-prefixing http://; type a bare email 'a@b.com' — no mailto: prepended (Word's E-mail tab adds it); type '#bookmarkName' anchor — should become internal anchor; insert over a multi-word selection (text differs from display); insert with empty Address (OK should no-op); mailto:/tel: scheme passes (allowed protocols); save+reopen: link rId relationship survives
- _needsRuntime: false_

### Text Box (dropdown: gallery / Draw / Save to Gallery) — DEVIATION · S2
- **Word vs clone:** Word has a built-in gallery (~30 styled boxes), 'Draw Text Box' (drag to place a floating box), and 'Save Selection to Text Box Gallery'. The clone's flyout (textBoxMenu) shows only 'Simple Text Box' + 'Draw Text Box' and BOTH call H.textBox()→xeTextBox('') which inserts an INLINE editable v:textbox at the caret; Draw Text Box does NOT draw and the box is inline not floating; no gallery, no Save-to-Gallery. On the clone's OWN reopen the textbox degrades to passthroughInline (editability lost — recorded).
- **Evidence:** commands.js:400-405 textBoxMenu both items → H.textBox; insert-exotica.ts:161-162 xeTextBox→insertTextBox inline; deferrals.md:389 reimport loss; ribbon-data lists gallery+Draw+Save (lines 899-904).
- **Edge cases to test:** Draw Text Box — expect drag-to-place; clone inserts inline immediately; insert with a text selection (should the selection become box content?); floating position / wrap (inline today); Save Selection to Text Box Gallery — no path; save+reopen in clone (editable shape lost) vs in Word (editable)
- _needsRuntime: true_

### Footer (dropdown) — STUB · S2
- **Word vs clone:** Same as Header: honest Phase-7 block + dead WC.HeaderFooter.footerMenu body.
- **Evidence:** index.ts:142 footer AREA='header-footer' (DEFERRED); dead calls commands.js:383,1519.
- **Edge cases to test:** click footer dropdown → deferral toast; imported footer round-trips despite blocked UI
- _needsRuntime: false_

### Header (dropdown: gallery / Edit / Remove / Save to Gallery) — STUB · S2
- **Word vs clone:** Word inserts/edits a real page header region; the clone HONESTLY BLOCKS the whole control with a deferral toast 'This action isn't available on the new engine yet' (Phase-7 layout gate). The WC.HeaderFooter.headerMenu body is DEAD CODE — WC.HeaderFooter is never defined; it is never reached because isBlocked short-circuits first.
- **Evidence:** index.ts:51 DEFERRED has 'header-footer'; index.ts:142 header AREA='header-footer'; isBlocked():155; Commands.dropdown guards at commands.js:1485 → notifyBlocked; dead WC.HeaderFooter calls at commands.js:382,1518 (WC.HeaderFooter never assigned anywhere in loaded scripts).
- **Edge cases to test:** click header dropdown — expect single throttled deferral toast, NOT a TypeError; built-in gallery item, Edit Header, Remove Header, Save to Gallery all blocked equally; open a .docx that already has a header — verify it imports/renders/exports even though the ribbon control is blocked
- _needsRuntime: false_

### Page Number (dropdown: Top/Bottom/Margins/Current Position/Format/Remove) — STUB · S2
- **Word vs clone:** Word can insert a PAGE field. Clone blocks the ENTIRE control. Note over-broad block: Word's 'Current Position' inserts a PAGE field at the body caret WITHOUT needing a header region, but the clone gates it together with the header-footer area, so even body page-number insertion is unavailable (a PAGE field IS reachable via Quick Parts→Page, so this is an inconsistency, not a hard cap).
- **Evidence:** index.ts:142 pageNumber AREA='header-footer'; dead WC.HeaderFooter.pageNumberMenu commands.js:384,1520; contrast xeQuickPart 'page'→'PAGE' field works (insert-exotica.ts:125-130).
- **Edge cases to test:** Current Position when caret is in body — blocked here, allowed in Word; Format Page Numbers… (number format i/ii/iii, start-at) blocked; Remove Page Numbers blocked
- _needsRuntime: false_

### Signature Line (split: Office Signature Line / Add Signature Services) — STUB · S2
- **Word vs clone:** Word inserts a real signature-line content control (signer name/title/email, instructions, allow-comments, show-date). The clone's dialog collects Signer + Title, but OK calls xeSignatureLine() which is a NO-OP TOAST — nothing is inserted; the collected fields are discarded.
- **Evidence:** insert-features.js:219-227 signatureLine dialog → xeSignatureLine; insert-exotica.ts:181 xeSignatureLine()=toast only; ribbon-data feasible:'no' (line 952).
- **Edge cases to test:** fill Signer+Title, click OK → expect a signature line, get a toast and no insertion; 'Add Signature Services…' item; save — nothing to round-trip
- _needsRuntime: false_

### Bookmark (button) — DEVIATION · S3
- **Word vs clone:** Real bookmark insert is solid (paired bookmarkStart+bookmarkEnd, exports), but the dialog lacks Word's 'Sort by: Name/Location' radios and 'Hidden bookmarks' checkbox, and silently converts spaces→'_' instead of Word's validation error; no rule that names must start with a letter.
- **Evidence:** insert-features.js:246-272 _bookmarkDialogPM (no sort/hidden options); insert.ts:102-123 insertBookmark name=name.replace(/\s+/g,'_'); commands H.bookmark:380.
- **Edge cases to test:** add bookmark on collapsed caret (zero-length) vs on a selection; name starting with a digit or containing punctuation; duplicate name (Word replaces existing); Go To then Delete then re-render; bookmark spanning a table cell / across paragraphs; save+reopen — both start and end survive
- _needsRuntime: false_

### Date & Time (button) — DEVIATION · S3
- **Word vs clone:** Word's dialog has ~17 date/time formats, a Language selector, a 'Default…' button, and an 'Update automatically' checkbox that toggles between a static text snapshot (unchecked) and a DATE field (checked). The clone offers 6 formats, no language, and ALWAYS inserts an auto-updating DATE field — the 'Update automatically' checkbox is created but NEVER READ, so unchecking it does nothing.
- **Evidence:** insert-features.js:186-196 dateTimeDialog — upd checkbox created (line 190) but OK handler (line 193) only passes the format to xeDateTime, never reads upd.checked; xeDateTime always inserts 'DATE \@ ...' field (insert-exotica.ts:118-123). Confirmed: grep upd.checked → no usage.
- **Edge cases to test:** uncheck 'Update automatically' then OK → still a field, not static text (deviation); each of the 6 formats → verify DATE \@ switch string; field updates on reopen/F9; language/locale not selectable; caret in empty paragraph
- _needsRuntime: false_

### Drop Cap (dropdown: None / Dropped / In Margin / Options) — DEVIATION · S3
- **Word vs clone:** Drop Cap menu maps None/Dropped/In Margin and exports a real w:framePr (round-trips in Word). Two deviations: (1) 'Drop Cap Options…' (font, lines-to-drop spinner, distance-from-text) listed in ribbon-data is ABSENT from the flyout; (2) 'Dropped' is NOT painted in-app (fork dropcapPlugin only renders framePr.dropCap==='margin'), so a Dropped cap looks like normal text in the clone (renders correctly only in Word and only 'In Margin' paints in-app). Lines fixed at 3.
- **Evidence:** commands.js:406-412 dropCapMenu (None/Dropped/In Margin only, no Options; lines hardcoded 3); insert-exotica.ts:50-66 xeDropCap real framePr; deferrals.md:391 Dropped not painted in-app.
- **Edge cases to test:** Dropped on a normal paragraph — in-app shows no drop cap (bug); In Margin renders; None removes framePr; apply on an empty paragraph / first char already styled; change lines-to-drop (no Options dialog → can't); save+reopen — framePr survives, Word paints it
- _needsRuntime: true_

### Object (split: Object… / Text from File…) — DEVIATION · S3
- **Word vs clone:** Word embeds OLE objects (Create New / Create from File) and inserts Text from File. The clone: main split-body click opens a flyout (not the Object dialog); 'Object… (Create New)' is a no-op toast (no OLE host); 'Text from File…' is REAL (opens a docx/html and pastes its sanitized HTML). Also no Display-as-icon / Link-to-file options.
- **Evidence:** commands.js:389 H.object→objectMenu; insert-features.js:302-313 objectMenu — 'Object…'=toast, 'Text from File…'=real pasteHTMLString; ribbon-data feasible:'no' (line 972).
- **Edge cases to test:** Text from File — open a .docx, content paste fidelity; Object Create New → toast only; Text from File with a .csv/.txt; large file paste / undo as one step
- _needsRuntime: false_

### Quick Parts (dropdown: Field / Document Property / AutoText / Building Blocks Organizer / Save to Gallery) — DEVIATION · S3
- **Word vs clone:** Word's Quick Parts menu has AutoText, Document Property (10+ props), Field… (full ~70-field dialog with categories+options+switches), Building Blocks Organizer, and Save Selection to Quick Part Gallery. The clone offers Field… (6 fields, no categories/options), 'Document Property' hardwired to Title only, and convenience items (Page/NumPages/Date/Author/FileName). No AutoText, no Building Blocks Organizer, no Save-to-Gallery.
- **Evidence:** insert-features.js:230-243 quickPartsMenu/fieldDialog (6 fields); insert-exotica.ts:124-131 xeQuickPart MAP only page/numpages/date/author/filename/title; Document Property→'title' (insert-features.js:234) → DOCPROPERTY Title only.
- **Edge cases to test:** Field… pick each of the 6 — verify field code emitted (PAGE/NUMPAGES/DATE/AUTHOR/FILENAME/DOCPROPERTY Title); Document Property — only Title; other props missing; field updates on F9 / reopen; caret in empty paragraph (inlineTarget mints sdBlockId); save+reopen field instruction text
- _needsRuntime: false_

### Symbol (dropdown: recent grid / More Symbols…) — DEVIATION · S3
- **Word vs clone:** Word's Symbol dialog has a Font selector (Symbol/Wingdings/etc.), Subset dropdown, character-code box, 'from:' (Unicode/ASCII), AutoCorrect/Shortcut-Key buttons, and a separate 'Special Characters' TAB (em dash, nonbreaking space/hyphen, etc.). The clone's quick grid + symbolDialog have a Subset dropdown (6 hardcoded subsets) and a session 'recently used' row, but NO font selector, NO special-characters tab, NO character-code box, NO AutoCorrect/shortcut. insertSymbol inserts the glyph as plain text (insertContent) with NO font mark, so true symbol-font characters (Wingdings code points) can't be represented.
- **Evidence:** dialogs.js:65-82 D.symbol quick grid + 'More Symbols…'→symbolDialog; insert-features.js:280-299 symbolDialog (SUBSETS only, no font/special-chars tab); insert.ts:166-175 insertSymbol = collapse+insertContent(ch) plain text.
- **Edge cases to test:** insert a symbol with a selection active (collapses to end first — Word inserts at caret); 'recently used' persistence (sessionStorage, lost on restart vs Word's persistent MRU); Special Characters tab (em dash / nonbreaking hyphen) — absent; Wingdings glyph round-trip (no font mark); insert then undo; save+reopen the inserted codepoint
- _needsRuntime: false_

### WordArt (dropdown: style gallery) — DEVIATION · S3
- **Word vs clone:** Word inserts a floating, warpable WordArt object (live text effects, editable). The clone's gallery has 6 CSS styles; insert exports REAL DrawingML (wps:wsp + prstTxWarp + textFill, renders warped in Word) but the in-app NodeView paints the text FLAT (no warp), is a non-editable atom, and is inline not floating.
- **Evidence:** insert-features.js:198-216 wordArtMenu (6 styles) → xeWordArt; insert-exotica.ts:164-165; deferrals.md:390 (flat in-app render, warp only in Word).
- **Edge cases to test:** insert with a selection vs default 'Your text here'; edit the WordArt text after insert (non-editable atom); color extracted from style string only (insert-features.js:214); floating vs inline placement; save→open in Word (warp renders) vs reopen in clone (flat)
- _needsRuntime: true_

### Link — Recent Items (split dropdown item) — GAP · S4
- **Word vs clone:** Word's Link split-arrow lists recently used links/files; the clone declares a 'Recent Items' item in ribbon-data but the arrow routes to Commands.dropdown which has no 'link' custom branch → falls through to generic items list (no real recent tracking).
- **Evidence:** ribbon-data.js:798-801 items ['Insert Link...','Recent Items']; commands.js dropdown() has no cmd==='link' recent handler before line 1531 (run path only).
- **Edge cases to test:** click the split arrow vs the main body; after inserting several links, check whether Recent Items populates
- _needsRuntime: true_

### Comment (button, Ctrl+Alt+M) — match
- **Word vs clone:** Insert→Comment routes to WC.Commands.run({cmd:'newComment'}) → CommentsUI.compose(); composer expands a collapsed caret to the surrounding word (Word-faithful) and exports real OOXML comments. NOT blocked (review area is not in DEFERRED). Reactions/likes are session-only (recorded OOXML deviation).
- **Evidence:** commands.js:363,368 H.comment→run('newComment'); comments-ui.ts:11-14 composer caret→word; bridge index.ts:103-104 comment/newComment AREA='review' which is NOT in DEFERRED (index.ts:51).
- **Edge cases to test:** insert with no selection (caret in middle of word); insert with a multi-paragraph selection; Ctrl+Enter to post, empty post disabled; add a reaction then save+reopen (reaction lost — recorded); comment then accept/reject track-changes interplay; save+reopen comment author/timestamp
- _needsRuntime: true_

---

## Insert / Pages+Tables (Cover Page, Blank Page, Page Break; Table dropdown: grid/dialog/draw/convert/excel/quick-tables; reachable Table Tools)  
_26 controls audited_

### Cover Page > Built-in design (Banded/Facet/Filigree/Ion/Motion/Retrospect) — BUG · S2
- **Word vs clone:** Word inserts the chosen design's fully-formatted layout (color band, art, title/subtitle/author fields). Clone inserts the SAME plain 3-paragraph SDT for ALL six designs - the design name is ignored.
- **Evidence:** insert-features.js:32-34 Insert.insertCover->WC.PM.xeCoverPage(t.name); insert-exotica.ts:69-101 xeCoverPage ignores name except as the title string and always builds the identical 3-paragraph documentPartObject. The rich COVERS[] HTML templates (insert-features.js:16-23) are DEAD CODE (never passed to PM).
- **Edge cases to test:** pick each of the 6 designs and diff inserted content (all identical?); insert cover then save+reopen - docPartGallery='Cover Pages' survives; insert cover with existing body content (body pushed to page 2?); insert two covers (xeCoverPage removes first documentPartObject - verify only one remains)
- **Improvement:** Build distinct OOXML per design from COVERS templates, or cut the gallery to designs that actually render.
- _needsRuntime: false_

### Table dropdown > Convert Text to Table — BUG · S2
- **Word vs clone:** Word converts selected paragraphs into a table with a dialog for separator (paragraphs/commas/tabs/other), column count, and AutoFit. Clone's Insert-tab item is a DEAD TOAST ('available in Table Tools (slice 6b)') even though a working PM.textToTable bridge + fork command exist.
- **Evidence:** insert-features.js:44-46 Insert.convertTextToTable = ()=>WC.toast('...slice 6b'); wired at line 57. Real impl: table.ts:206-210 textToTable -> fork table.js:2061-2121 convertTextToTable. The Insert ribbon never reaches it.
- **Edge cases to test:** select 3 tab-separated lines, click (currently just toasts); comma-separated (fork default delim is tab only); ragged rows (fork pads to maxCols); selection spanning a table
- **Improvement:** Wire the Insert-tab item to a real dialog (separator radios + column count) calling PM.textToTable(delim).
- _needsRuntime: false_

### Blank Page — DEVIATION · S3
- **Word vs clone:** Word's Blank Page inserts a page break, an empty paragraph, then another page break (a genuinely empty page sits between). Clone inserts TWO consecutive w:br type=page run-breaks in the SAME paragraph with no intervening paragraph mark.
- **Evidence:** insert.ts:225-230 insertBlankPage = chain().insertPageBreak().insertPageBreak().run(); each insertPageBreak (line-break.js:160-167) is a hardBreak{pageBreakType:'page'} via insertContent at the caret - no empty paragraph between.
- **Edge cases to test:** Blank Page at doc start; mid-paragraph (caret between words); inside a table cell; at doc end; save+reopen COM read-layout (truly blank middle page?); one undo - does it remove both breaks?
- **Improvement:** Insert break + empty paragraph + break to match Word's structure and render a real empty page.
- _needsRuntime: true_

### Convert Text to Table engine (separator handling) — DEVIATION · S3
- **Word vs clone:** Word lets you pick the separator (paragraph mark, comma, tab, custom) and auto-sets column count. The fork command splits on ONE delimiter (default tab) with no UI; comma/paragraph require the caller to pass it, and no separator dialog exists.
- **Evidence:** table.js:2061-2089 convertTextToTable(delimiter='\t') splits node.textContent.split(delim); maxCols from longest row; no separator UI. Bridge table.ts:206 passes whatever caller gives.
- **Edge cases to test:** tab-delimited; comma-delimited (must pass ','); single paragraph (1 row); empty cells (createAndFill); trailing delimiter -> empty trailing cell; select inside a table (depth guard)
- **Improvement:** Expose separator choice + a 'paragraphs' mode like Word.
- _needsRuntime: true_

### Insert Table - caret position semantics (mid-paragraph) — DEVIATION · S3
- **Word vs clone:** Word SPLITS a non-empty paragraph at the caret and drops the table there. Clone inserts the table AFTER the whole paragraph (offset=end()+1) when non-empty; only an empty top-level paragraph is replaced in place.
- **Evidence:** table.js:878-906 insertTable: when $from.depth!=0, offset=$from.end()+1; only isEmptyParagraph top-level para is replaced. Non-empty para -> table after it, no split.
- **Edge cases to test:** caret mid-word in non-empty paragraph; caret at paragraph start (before or after?); caret at paragraph end; empty paragraph (replaced in place); Ctrl+A AllSelection (depth-0 branch); selection across multiple paragraphs
- **Improvement:** Split the paragraph at the caret before inserting to match Word.
- _needsRuntime: true_

### Inserted table default width / AutoFit — DEVIATION · S3
- **Word vs clone:** Word's default new table is AutoFit-to-window with equal columns spanning text width AND per-column type 'auto'. Clone computes equal px widths filling page content width (close), but falls back to NULL widths when pageStyles are unavailable.
- **Evidence:** table.js:854 widths=computeColumnWidths(editor,cols); computeColumnWidths.js:13 returns null when pageWidth unavailable -> createTable gets null widths (no per-cell colwidth).
- **Edge cases to test:** insert before page layout (pageStyles missing -> null widths); non-Letter page size / custom margins; landscape; export and COM read-table tblW/gridCol widths
- **Improvement:** Always emit valid auto/dxa widths even when pageStyles are missing.
- _needsRuntime: true_

### Table dropdown > Draw Table — DEVIATION · S3
- **Word vs clone:** Word's Draw Table gives a pen to draw the outer border then individual row/column lines (irregular grids). Clone uses a crosshair, you drag ONE rectangle, and it derives an even NxM grid (cols=round(w/90), rows=round(h/36)).
- **Evidence:** insert-features.js:64-82 drawTableMode: on mouseup computes cols/rows from drag/zoom and calls Insert.buildTable. NOTE deferrals.md:408 records Draw Table as an 'honest toast' - the live code is NOT a toast; the doc is stale.
- **Edge cases to test:** draw a tiny rectangle (rounds to 1x1); draw a huge rectangle (cols clamp at 1000); draw at zoom != 100%; click without dragging (mousedown start, zero-size up -> 1x1); draw over existing content/inside a table
- **Improvement:** Implement true cell-by-cell pen drawing, or relabel and fix the stale deferrals.md entry.
- _needsRuntime: true_

### Table dropdown > Insert Table dialog — DEVIATION · S3
- **Word vs clone:** Word's dialog has Table size PLUS an 'AutoFit behavior' radio group (Fixed column width Auto/value, AutoFit to contents, AutoFit to window) and a 'Remember dimensions for new tables' checkbox. Clone has only the grid + cols/rows number inputs.
- **Evidence:** dialogs.js:11-42 D.insertTable: grid + tcols(default 3)/trows(default 2); build()->WC.PM.insertTable({rows,cols}) with no autofit/header args. Word default cols=5/rows=2; clone defaults 3/2.
- **Edge cases to test:** OK with rows/cols=0 or >1000 (rejected at dialogs.js:32-34); fractional input; use number boxes only; compare default 3x2 vs Word 5x2
- **Improvement:** Add the AutoFit radio group + Remember-dimensions checkbox; align default to 5x2.
- _needsRuntime: false_

### Table dropdown > Quick Tables — DEVIATION · S3
- **Word vs clone:** Word's Quick Tables are preformatted styled templates (Calendar 1-4, Double Table, Matrix, Tabular List, With Subheads) with real headers/data/styling. Clone inserts PLAIN empty NxM grids (Calendar=6x7, Tabular List=4x2, Matrix=4x4, Double Table=5x3).
- **Evidence:** insert-features.js:88-93 quickTablesMenu maps each name to Insert.buildTable(NxM) - bare grids, no style/content.
- **Edge cases to test:** insert Calendar -> 6x7 empty grid (no headers); insert each preset and verify empty; save+reopen (no quick-table metadata)
- **Improvement:** Seed presets with header text/banding/styling, or mark honest-degrade.
- _needsRuntime: true_

### Table Tools (Design) > Table Styles gallery — DEVIATION · S3
- **Word vs clone:** Word shows a rich live-preview gallery (Grid/List/Plain families with banding). Clone builds a TEXT list from in-memory styles.xml table styles; shows 'No table styles available' when the catalog is empty (a fresh doc may have none).
- **Evidence:** commands.js:143-152 H.tblStyles flyout uses TPM().getTableStyles(); empty -> 'No table styles available'. No thumbnails/preview.
- **Edge cases to test:** fresh doc (empty -> 'No table styles available'); imported doc with styles; apply a style then save+reopen (styleId persists?); apply then undo
- **Improvement:** Seed the default Word table-style set so the gallery isn't empty on new docs; add thumbnails.
- _needsRuntime: true_

### Table Tools (Layout) > AutoFit (Contents/Window/Fixed) — DEVIATION · S3
- **Word vs clone:** Word's AutoFit Contents reflows columns to text via real text metrics. Clone measures by temporarily reflowing the DOM at table-layout:auto and reading clientWidths - approximate and DOM-dependent.
- **Evidence:** commands.js:169 H.tblAutoFit flyout (Contents/Window/Fixed); table.ts:218-228 pageTextWidthPx + DOM reflow measurement (comments).
- **Edge cases to test:** AutoFit Contents on text-heavy vs empty cells; AutoFit Window then save (tblW=pct?); Fixed Column Width locks widths; content exceeding page width (capped); COM read-table widths
- _needsRuntime: true_

### Table Tools (Layout) > Convert to Text — DEVIATION · S3
- **Word vs clone:** Word's Convert to Text dialog lets you choose the separator (paragraph marks, tabs, commas, other). Clone hardcodes TAB with no dialog.
- **Evidence:** commands.js:126 H.tblToText -> TPM().tableToText('\t'); table.ts:200-204 -> fork convertTableToText('\t'). No separator dialog.
- **Edge cases to test:** multi-column -> tab-separated text; single column; merged cells; nested table in a cell; round-trip to-text then text-to-table
- **Improvement:** Add separator choice (paragraph/tab/comma/other).
- _needsRuntime: true_

### Insert Table - at document start — DEVIATION · S4
- **Word vs clone:** Word allows a table as the first block with an empty paragraph after it. Clone inserts via insertTopLevelTableWithSeparators (adds separator paragraphs); first-block placement needs verification.
- **Evidence:** table.js:906 insertTopLevelTableWithSeparators(...); separator helper table.js:272-308 wraps top-level tables. Exact first-block placement needs runtime.
- **Edge cases to test:** empty doc, insert table (leading empty paragraph?); table immediately followed by content; save+reopen COM read-table position/structure; two tables back-to-back (separator between?)
- _needsRuntime: true_

### Insert Table - row/column limits — DEVIATION · S4
- **Word vs clone:** Word's hard limits are 63 columns and 32767 rows. Clone clamps BOTH dims to 1..1000 (permits up to 1000 columns, past Word's 63; caps rows below Word's max).
- **Evidence:** insert-features.js:41 buildTable clamps 1..1000; table.ts:35-36 clamps 1..1000 both dims; dialogs.js:32 rejects >1000.
- **Edge cases to test:** enter 64 columns (Word rejects; clone allows up to 1000); enter 1001 (toast); enter 1000x1000 (perf / does it render?)
- **Improvement:** Clamp columns to 63 to match Word.
- _needsRuntime: false_

### Table dropdown > Insert Table grid (live picker) — DEVIATION · S4
- **Word vs clone:** Word's grid is 10 cols x 8 rows and EXPANDS as you drag toward the edges. Clone's grid is fixed 8 rows x 10 cols with no expansion; otherwise live-highlights and inserts on click.
- **Evidence:** insert-features.js:49-53 ROWS=8,COLS=10; label shows cols x rows; click -> Insert.buildTable(r+1,c+1) (correct rows,cols order). No drag-expand handler.
- **Edge cases to test:** hover label reads cols x rows at the 10x8 corner; click max 10x8 cell -> 8-row/10-col table; insert at doc start; insert mid-paragraph (see separate finding); insert inside an existing cell (nested table?)
- **Improvement:** Add drag-to-expand beyond 10x8 to match Word.
- _needsRuntime: true_

### Table Tools (Design) > Shading / Borders — DEVIATION · S4
- **Word vs clone:** Word's Shading is a full theme/standard/more-colors picker; Borders is a 13-option dropdown + Borders and Shading dialog + line style/weight/pen color. Clone's Shading is 6 fixed swatches + transparent; Borders is only 'All Borders' and 'No Border'.
- **Evidence:** commands.js:153-168 H.tblShading (6 hardcoded swatches), H.tblBorders (All Borders / No Border only, fixed single black 4-size border).
- **Edge cases to test:** apply each swatch to caret cell vs CellSelection; No Border then save (borders removed?); Shading on a header cell; All Borders on a styled table (overrides style borders?)
- **Improvement:** Expand Borders to Word's full menu + Borders and Shading dialog; make Shading a real color picker.
- _needsRuntime: false_

### Table Tools (Layout) > Header Row / Header Column toggle — DEVIATION · S4
- **Word vs clone:** Word's 'Repeat Header Rows' marks the first row to repeat across pages (w:tblHeader). Clone toggles the fork's header-cell node type (structural header), not the print-repeat property.
- **Evidence:** commands.js:124 H.tblHeaderRow -> TPM().tableToggleHeaderRow(); table.ts:95-99 -> editor.commands.toggleHeaderRow() (flips header cell type, not w:trPr/w:tblHeader).
- **Edge cases to test:** toggle on a table spanning a page break (row 1 repeats on page 2?); toggle twice; save+reopen COM read-table for tblHeader; header column on a multi-row table
- **Improvement:** Map to OOXML tblHeader (repeat header rows), or clarify it's structural-header only.
- _needsRuntime: true_

### Table Tools (Layout) > Merge Cells / Split Cells — DEVIATION · S4
- **Word vs clone:** Word's Merge greys out without a multi-cell selection; Split Cells opens a dialog (target rows x cols). Clone's Merge toasts 'Select cells first' on a caret (good), but Split Cells calls splitCell() directly with NO dialog.
- **Evidence:** table.ts:79-93 tableMerge gates on isCellSelection + toasts; tableSplitCell -> editor.commands.splitCell() with no dialog. commands.js:119-120.
- **Edge cases to test:** merge with caret only (toast); merge a rectangular CellSelection; split an already-merged cell; split a plain cell (Word dialog vs clone fixed); undo after merge
- **Improvement:** Add a Split Cells dialog (columns/rows) to match Word.
- _needsRuntime: true_

### Table Tools (Layout) > Text Direction — DEVIATION · S4
- **Word vs clone:** Word's Text Direction CYCLES horizontal / rotate-270 (tbRl) / rotate-90 (btLr) on each click. Clone always sets 'tbRl' (one fixed direction), never cycling.
- **Evidence:** commands.js:130 H.tblTextDir -> TPM().tableSetTextDirection('tbRl') - hardcoded single direction.
- **Edge cases to test:** click once (tbRl); click again (Word cycles; clone stays tbRl); apply to a CellSelection; save+reopen text direction
- **Improvement:** Cycle horizontal -> tbRl -> btLr -> horizontal like Word.
- _needsRuntime: true_

### Table Tools (Layout) > Cell Margins — STUB · S4
- **Word vs clone:** Word opens a Table Options dialog for default cell margins + spacing. Clone toasts 'not implemented in this slice'.
- **Evidence:** commands.js:134 H.tblCellMargins -> WC.toast('Table cell margins dialog - not implemented in this slice.').
- **Edge cases to test:** click -> toast only
- **Improvement:** Implement the cell-margins dialog (bridge has tableSetCellMargins).
- _needsRuntime: false_

### Cover Page dropdown items (More Cover Pages from Office.com / Save Selection to Cover Page Gallery) — GAP · S4
- **Word vs clone:** Word's gallery has ~16 thumbnail designs plus 'More Cover Pages from Office.com', 'Remove Current Cover Page', and 'Save Selection to Cover Page Gallery'. Clone's flyout lists only 6 text names + 'Remove Current Cover Page'.
- **Evidence:** ribbon-data.js:611-616 declares 4 items incl. those two, but insert-features.js:24-31 coverPageMenu renders only the 6 built-ins + Remove. The other two declared items are never built.
- **Edge cases to test:** open Cover Page dropdown and confirm only 6+Remove appear
- **Improvement:** Add the two missing items as honest-degrade entries or implement Save-to-Gallery.
- _needsRuntime: false_

### Table dropdown > Excel Spreadsheet — GAP · S4
- **Word vs clone:** Word embeds a live OLE Excel worksheet. Clone shows an honest 'needs a host runtime' toast (no mutation).
- **Evidence:** insert-features.js:83-87 Insert.insertExcelSheet -> WC.toast(...). Recorded deferrals.md:372,408.
- **Edge cases to test:** click and confirm toast only, no document change
- **Improvement:** Expected deferral; keep the honest toast.
- _needsRuntime: false_

### Page Break (button + Ctrl+Enter) — match
- **Word vs clone:** Word inserts a w:br w:type=page at the cursor (Ctrl+Enter). Clone inserts a hardBreak{pageBreakType:'page'} at the caret.
- **Evidence:** commands.js:346 H.pageBreak->WC.PM.insertPageBreak(); insert.ts:219-223 -> line-break.js:160-167. ribbon-data.js:632 declares shortcut 'Ctrl+Enter' (display label only).
- **Edge cases to test:** Ctrl+Enter actually wired to insertPageBreak (verify keymap, not just ribbon label); page break mid-paragraph (does the paragraph split visually?); inside a table cell; across a forced break; undo/redo; save+reopen COM read-layout page count
- **Improvement:** Confirm the Ctrl+Enter keybinding reaches this handler (ribbon 'shortcut' is display-only).
- _needsRuntime: true_

### Cover Page > Remove Current Cover Page — match
- **Word vs clone:** Word removes the cover SDT. Clone deletes the first documentPartObject node and toasts.
- **Evidence:** insert-features.js:35-37 -> insert-exotica.ts:103-114 xeRemoveCoverPage finds first documentPartObject and deletes it; toasts 'No cover page found.' if absent (code-verified).
- **Edge cases to test:** remove with no cover present (toast, no mutation); insert then remove then undo/redo; remove when an IMPORTED .docx cover SDT exists (does the scan match it?)
- _needsRuntime: true_

### Table Tools (Layout) > Delete Row/Column/Table — match
- **Word vs clone:** Word deletes the caret's row/column or whole table. Clone routes to deleteRow/deleteColumn/deleteTable.
- **Evidence:** commands.js:116-118 -> table.ts:61-77.
- **Edge cases to test:** delete the last remaining row; delete column leaving 0 columns; delete table at doc start (separator paragraph left?); undo
- _needsRuntime: true_

### Table Tools (Layout) > Insert Above/Below/Left/Right — match
- **Word vs clone:** Word inserts a row/column adjacent to the caret cell. Clone routes to addRow/Column Before/After.
- **Evidence:** commands.js:112-115 H.tblInsert* -> TPM().tableAddRow/Column; table.ts:42-59. Contextual tabs appear on caret-in-table (table-tools-pm.js:84-97).
- **Edge cases to test:** insert at first/last row/col; on a merged-cell row; with a CellSelection spanning rows; undo/redo; save+reopen
- _needsRuntime: true_

---

## Layout tab (Page Setup, Paragraph, Arrange)  
_19 controls audited_

### Breaks (dropdown: Page/Column/Text Wrapping/Next Page/Continuous/Even Page/Odd Page) — BUG · S2
- **Word vs clone:** Word: 3 page-level + 4 section breaks, distinct. Clone: whole 'breaks' cmd is layout-page→DEFERRED→blocked so the flyout is UNREACHABLE (toast only). breaksMenu() is also broken: Page/Next/Even/Odd Page ALL call legacy insertPageBreak() (commands.js:1990, E().insertHTML on undefined WC.Editor → TypeError); Column/Text Wrapping/Continuous use E().insertHTML too. The REAL page break works only via Insert tab (H.pageBreak→WC.PM.insertPageBreak, commands.js:346) and Ctrl+Enter (fork keymap), NOT via this Layout control.
- **Evidence:** index.ts:137 breaks:'layout-page' (DEFERRED); run/dropdown block at commands.js:1476/1485 before commands.js:1549; breaksMenu commands.js:458-470 all use insertPageBreak() (1990) + E().insertHTML; E()=WC.Editor never defined.
- **Edge cases to test:** click Breaks → expect blocked toast, no menu; confirm Insert→Page Break still works (only entry point); Next/Even/Odd Page collapse to plain page break even in dead code (no section semantics, no even/odd blank-page insertion); Continuous = decorative <hr> in dead code, not a real section
- **Improvement:** Route Layout→Breaks→Page to WC.PM.insertPageBreak (same as Insert tab) and section breaks to the fork's insertSectionBreakAtSelection; distinguish Even/Odd (insert blank page to land on parity).
- _needsRuntime: false_

### Columns (dropdown: One/Two/Three/Left/Right/More Columns...) — STUB · S2
- **Word vs clone:** Word: multi-column section layout (w:cols), per-section, balancing + column-break support. Clone: blocked toast. setColumns() (CSS column-count on E().node) and moreColumnsDialog() dead; even if revived apply CSS multicol to the whole editor (not a Word section), and Left/Right are only a CSS gutter-skew approximation.
- **Evidence:** index.ts:136 columns:'layout-page'; columnsMenu commands.js:2055, setColumns 2064 mutates E().node.style.columnCount, moreColumnsDialog 2074. deferrals.md A: true columns are 4f; nextColumn treated as a page break (single-column render).
- **Edge cases to test:** pick Two → toast; More Columns dialog never opens; Breaks→Column also blocked; imported multi-column docx renders single-column (deferrals A.1 §4f)
- **Improvement:** Real w:cols section model + column render is Phase-4f; Left/Right asymmetric widths need real col widths, not a CSS hack.
- _needsRuntime: false_

### Margins (dropdown: Normal/Narrow/Moderate/Wide/Mirrored/Office 2003 Default/Custom Margins...) — STUB · S2
- **Word vs clone:** Word: applies T/B/L/R margins to the section, repaginates, exports w:pgMar. Clone: cmd 'margins' is AREA-mapped 'layout-page' which is in DEFERRED, so the dispatch head blocks it and shows toast "This action isn't available on the new engine yet". marginsMenu()/customMarginsDialog() never reached (dead code driving the retired WC.Editor via setPageVar/E().repaginate()).
- **Evidence:** bridge/index.ts:51 DEFERRED has 'layout-page'; index.ts:136 margins:'layout-page'; index.ts:155 isBlocked; commands.js:1485 dropdown() blocks before reaching marginsMenu; marginsMenu commands.js:2000 uses setPageVar→E().repaginate() and E()=WC.Editor (commands.js:8) never assigned anywhere.
- **Edge cases to test:** click Normal → expect blocked toast not apply; Custom Margins dialog never opens; reopen a docx with non-default margins, confirm no preset highlight; dead marginsMenu would set only single uniform --page-margin (L/R), ignoring top/bottom — wrong even if revived
- **Improvement:** Wire margins to the PM section model (w:sectPr/pgMar) per-section, applying all four edges; Mirrored should set mirrorMargins. Clone preset table only carries 2 values.
- _needsRuntime: false_

### Orientation (dropdown: Portrait/Landscape) — STUB · S2
- **Word vs clone:** Word: swaps page w/h, forces a section/page boundary, exports w:pgSz @orient. Clone: blocked toast (layout-page deferred). orientationMenu() (sets --page-w/--page-h + E().pageH + E().repaginate) is dead code on the retired editor.
- **Evidence:** index.ts:136 orientation:'layout-page' (DEFERRED); dropdown head blocks at commands.js:1485; orientationMenu commands.js:2025 uses E().pageH/E().repaginate() on undefined WC.Editor.
- **Edge cases to test:** click Landscape → expect toast not rotation; import a landscape docx → render uses old geometry (deferrals A.1: single doc-level getPageStyles)
- **Improvement:** Honor orientation as a section geometry attr and repaginate via the new engine; per-section geometry is Phase-4f per deferrals.md.
- _needsRuntime: false_

### Position (dropdown: In Line + 9 wrap-position presets + More Layout Options...) — STUB · S2
- **Word vs clone:** Word: positions a floating object at a page-relative preset (top-left..bottom-right) with auto square wrap. Clone: blocked toast (layout-arrange deferred). H.position (commands.js:822) calls WC.Layout.position(p) for the 9 presets — WC.Layout undefined (would TypeError); only 'In Line with Text' would reach setImageWrap but it's blocked at the head. 'More Layout Options...' absent from the menu.
- **Evidence:** index.ts:138 position:'layout-arrange' (DEFERRED, NOT in ENGINE_READY index.ts:154); H.position commands.js:822 → WC.Layout.position; index.ts:151 comment: 'position presets ... still call the undefined WC.Layout.* and MUST stay blocked'.
- **Edge cases to test:** select a picture then click a preset → blocked toast; no picture selected → still blocked toast (Word greys it); More Layout Options missing
- **Improvement:** Needs the frames-overlay/paged layout (deferrals A.1d) for page-relative absolute positioning; the 4c.2 setImagePosition primitive exists for numeric offsets but the preset grid isn't wired.
- _needsRuntime: false_

### Size (dropdown: Letter/Legal/A4/A3/Tabloid/Executive/More Paper Sizes...) — STUB · S2
- **Word vs clone:** Word: sets paper size, exports w:pgSz w/h twips. Clone: blocked toast. pageSizeMenu()/morePaperSizesDialog() dead (drive E().pageH/repaginate on retired editor).
- **Evidence:** index.ts:136 size:'layout-page'; pageSizeMenu commands.js:2031 + morePaperSizesDialog 2044 use setPageVar+E().pageH.
- **Edge cases to test:** pick A4 → toast; More Paper Sizes dialog never opens; does exported docx carry non-Letter pgSz? likely default Letter regardless (runtime)
- **Improvement:** Map paper presets to section pgSz; the px dimension table (A4 794x1123 @96dpi etc.) is correct and reusable when wired to the engine.
- _needsRuntime: false_

### Bring Forward (split: Bring Forward/Bring to Front/Bring in Front of Text) — DEVIATION · S3
- **Word vs clone:** Word: raises z-order one level / to front; 'In Front of Text' floats over text; any object. Clone: UN-blocked + REAL via WC.PM.setImageZOrder('forward'/'toFront') + setImageWrap('front') — but IMAGE-ONLY and only re-stacks ABSOLUTE (wrap=None) images; CSS-floated (Square/Tight/Through) images stack by document order regardless (z-index no-op). Requires the image already floating (isAnchor) or it toasts.
- **Evidence:** index.ts:154 ENGINE_READY has bringForward; dropdown commands.js:1550 wires forward/toFront/front; setImageZOrder insert.ts:313 guards isAnchor (316) and only meaningfully re-stacks wrap=None (comment insert.ts:305-308).
- **Edge cases to test:** inline image → 'needs a floating picture' toast; two floating images tied at Z_BASE (forward uses >= to break tie); Bring to Front with 3+ images; Bring in Front of Text sets behindDoc=false; floated (Square) images: z-index no visual effect; apply to shape → image-only toast; save+reopen relativeHeight
- **Improvement:** Extend z-order to shapes; floated-image re-stacking needs the frames-overlay render (deferrals A.1d).
- _needsRuntime: true_

### Send Backward (split: Send Backward/Send to Back/Send Behind Text) — DEVIATION · S3
- **Word vs clone:** Word: lowers z-order / to back / behind text; any object. Clone: UN-blocked + REAL via setImageZOrder('backward'/'toBack') + setImageWrap('behind'); same image-only + absolute-only limitations as Bring Forward.
- **Evidence:** index.ts:154 ENGINE_READY has sendBackward; dropdown commands.js:1551 wires backward/toBack/behind; setImageZOrder insert.ts:313.
- **Edge cases to test:** inline image toast; tie-break with peers at same relativeHeight; Send Behind Text sets behindDoc=true (text overlays image); floated images unaffected visually; shape → toast; save+reopen
- **Improvement:** Same as Bring Forward — extend to shapes + real float re-stacking.
- _needsRuntime: true_

### Wrap Text (dropdown: Inline/Square/Tight/Through/Top&Bottom/Behind/In Front/Edit Wrap Points/Move with Text/Fix Position on Page/More Layout Options...) — DEVIATION · S3
- **Word vs clone:** Word: 7 wrap modes + Edit Wrap Points + Move with Text/Fix Position on Page toggles + More Layout Options; any drawing object. Clone: UN-blocked (ENGINE_READY) and REAL for the 7 modes via WC.PM.setImageWrap — but IMAGE-ONLY (selectedImage()), not shapes/text boxes/WordArt; menu MISSING 4 Word items (Edit Wrap Points, Move with Text, Fix Position on Page, More Layout Options). Square/Tight/Through render is CSS-float approximation; absolute positioning deferred.
- **Evidence:** index.ts:154 ENGINE_READY has wrapText; H.wrapText commands.js:823 lists only 7 modes; setImageWrap insert.ts:252 acts on selectedImage() only; deferrals A.1 floating-object: renders inline today / absolute positioning needs layout engine.
- **Edge cases to test:** wrap on inline image → becomes anchored (isAnchor true); Square then back to Inline (anchorData cleared); Tight/Through seed a bounding-box wrapPolygon — verify Word opens the export; apply to a SHAPE/text box → 'Select a picture first' toast (Word would wrap it); Behind/In Front toggle z (behindDoc); save+reopen wp:anchor wrap type; render: does Square actually float text around it or render inline (deferred)
- **Improvement:** Add the 4 missing menu items; extend wrap to shapes/text boxes/WordArt (image-only today); real shape-aware wrap render is layout-engine-gated.
- _needsRuntime: true_

### Align (dropdown: Left/Center/Right/Top/Middle/Bottom/Distribute H/V/Align to Page/Margin/Selected Objects/View Gridlines/Grid Settings...) — STUB · S3
- **Word vs clone:** Word: aligns/distributes selected objects relative to page/margin/each other, gridlines + grid settings. Clone: blocked toast (layout-arrange). H.align (commands.js:842) calls WC.Layout.align/distribute and reads/writes WC.Layout.alignTo — all undefined (TypeError). Menu also omits 'Align Selected Objects', 'View Gridlines', 'Grid Settings...' present in ribbon-data.
- **Evidence:** index.ts:139 align:'layout-arrange' (DEFERRED; test asserts isBlocked('align')===true in test-suite-pm.js:2095); H.align commands.js:842-850 → WC.Layout.* undefined.
- **Edge cases to test:** click any align → blocked toast; Align to Page/Margin checkmark from undefined WC.Layout.alignTo (dead); missing View Gridlines / Grid Settings items
- **Improvement:** Needs multi-object selection model + frames overlay; fully stubbed today.
- _needsRuntime: false_

### Hyphenation (dropdown: None/Automatic/Manual/Hyphenation Options...) — STUB · S3
- **Word vs clone:** Word: w:autoHyphenation / manual per-word prompts / hyphenation zone + consecutive-limit options. Clone: blocked toast (layout-page deferred). H.hyphenation (commands.js:803) calls WC.Layout.setHyphenation (undefined); 'Manual' runs manualHyphenate() walking E().node text inserting soft hyphens (retired editor; would TypeError). 'Hyphenation Options...' is a pure toast no-op.
- **Evidence:** index.ts:137 hyphenation:'layout-page' (DEFERRED); H.hyphenation commands.js:803-809 uses WC.Layout.hyphenMode/setHyphenation; manualHyphenate commands.js:810 uses E().node + E().repaginate; Options is WC.toast only (808).
- **Edge cases to test:** click Automatic → toast; Manual would mangle text with soft hyphens (not Word's per-word prompt) if revived; Hyphenation Options never shows zone/limit fields
- **Improvement:** Auto-hyphenation maps to CSS hyphens:auto + w:autoHyphenation export once on the new engine; Manual + Options need real implementations.
- _needsRuntime: false_

### Line Numbers (dropdown: None/Continuous/Restart Each Page/Restart Each Section/Suppress for Current Paragraph/Line Numbering Options...) — STUB · S3
- **Word vs clone:** Word: renders gutter line numbers, w:lnNumType in sectPr, restart modes. Clone: blocked toast (layout-page deferred). H.lineNumbers (commands.js:802) calls WC.Layout.setLineNumbers/renderLineNumbers + E().selectedBlocks() — WC.Layout is NEVER defined (would TypeError) and E() is the retired editor; only isBlocked saves it from throwing. 'Line Numbering Options...' routes to the Paragraph dialog (wrong dialog).
- **Evidence:** index.ts:137 lineNumbers:'layout-page' (DEFERRED); H.lineNumbers commands.js:802 references WC.Layout.lineMode/setLineNumbers/renderLineNumbers + E().selectedBlocks; grep confirms no 'WC.Layout =' anywhere in src/renderer.
- **Edge cases to test:** click Continuous → toast not numbering; Line Numbering Options opens Paragraph dialog (wrong) if ever unblocked; Suppress for Current Paragraph toggles a CSS class on retired editor blocks (dead)
- **Improvement:** Needs the layout engine to render gutter numbers + w:lnNumType export; 'Options...' must open a real Line Numbers dialog (start at / count by / restart), not the Paragraph dialog.
- _needsRuntime: false_

### Rotate (dropdown: Rotate Right 90/Left 90/Flip Vertical/Flip Horizontal/More Rotation Options...) — STUB · S3
- **Word vs clone:** Word: rotates/flips the selected object, More Rotation Options dialog. Clone: blocked toast (layout-arrange; test asserts isBlocked('rotate')===true). H.rotate (commands.js:852) calls WC.Layout.rotate/flip (undefined → TypeError) and omits 'More Rotation Options...'. NOTE: a SEPARATE working rotate exists in Picture Format (imgRotate→setImageTransform), so the capability exists but this Layout-tab control is dead.
- **Evidence:** index.ts:140 rotate:'layout-arrange' (DEFERRED); test-suite-pm.js:2096 isBlocked('rotate')===true; H.rotate commands.js:852 → WC.Layout.rotate/flip undefined; Picture Format imgRotate uses setImageTransform (commands.js:265-266).
- **Edge cases to test:** click Rotate Right → blocked toast; More Rotation Options missing; contrast with Picture Format → Rotate which works on a selected image
- **Improvement:** Re-route Layout-tab Rotate to the existing setImageTransform path so the duplicate control isn't dead; add More Rotation Options dialog.
- _needsRuntime: false_

### Selection Pane (button) — STUB · S3
- **Word vs clone:** Word: opens a pane listing all objects with show/hide toggles + reorder. Clone: blocked toast (layout-arrange deferred). H.selectionPane (commands.js:841) calls WC.Layout.selectionPane() — WC.Layout undefined → would TypeError; only isBlocked prevents the throw.
- **Evidence:** index.ts:139 selectionPane:'layout-arrange' (DEFERRED, not in ENGINE_READY); H.selectionPane commands.js:841 → WC.Layout.selectionPane (undefined).
- **Edge cases to test:** click → blocked toast; no pane ever appears
- **Improvement:** Build a real selection pane over the PM doc's floating objects once the frames model lands.
- _needsRuntime: false_

### Spacing Before (spinner, points) — DEVIATION · S4
- **Word vs clone:** Word: space-before in 6pt steps, exports w:spacing/@before (pt×20 twips). Clone: REAL — updateAttributes paragraph spacing.before ×20; step 6, min 0, default shown 0; caret-tracked. Minor deviation: no upper clamp (Word ~1584pt); contextual/auto spacing (w:beforeAutospacing) not modeled.
- **Evidence:** commands.js:19 PARA_SPIN spacingBefore ×20; ribbon.js:454 step 6 min 0 default 0; state-sync.ts:154,230 (?? 0).
- **Edge cases to test:** empty selection; multi-paragraph; table cell; 'auto'/contextual spacing interaction not modeled; imported para with style-derived spacing (resolved value shown); undo/redo; save+reopen w:spacing before; very large value (no max)
- **Improvement:** Add max clamp; consider modeling contextualSpacing/autospacing so the spinner reflects/clears them like Word.
- _needsRuntime: true_

### Group (dropdown: Group/Regroup/Ungroup) — STUB · S4
- **Word vs clone:** Word: groups objects into one (wpg:grpSp). Clone: blocked toast (layout-arrange). H.group (commands.js:851) only shows 'Grouping is approximated' / 'Ungroup' toasts even if reached, and omits 'Regroup'. No real grouping.
- **Evidence:** index.ts:140 group:'layout-arrange' (DEFERRED); H.group commands.js:851 toast-only, Regroup missing.
- **Edge cases to test:** click Group → blocked toast; no grouping occurs; Regroup item absent
- **Improvement:** Real object grouping is a large layout/drawing feature; honest stub today.
- _needsRuntime: false_

### Indent Left (spinner, inches) — match
- **Word vs clone:** Word: left indent in 0.1" steps, allows negatives, caret-tracks current value. Clone: REAL — WC.PM.cmd('updateAttributes','paragraph',{indent.left: inches*1440 twips}); state-sync pushes resolved value back on caret move. step 0.1, min -2. Verified by code only.
- **Evidence:** commands.js:17 PARA_SPIN indentLeft→indent.left ×1440; spinner() commands.js:1661-1668 (no AREA entry → isBlocked false); ribbon.js:454 step 0.1/min -2; state-sync.ts:152,228 caret-track.
- **Edge cases to test:** apply to empty selection (collapsed caret); multi-paragraph selection; negative indent (hangs into margin); inside a table cell; imported styled paragraph (resolved vs inline); undo/redo; save+reopen confirm w:ind; no upper clamp vs Word ~22" — try 9999
- **Improvement:** Add Word's upper clamp (~22") and confirm twips rounding at fractional inches matches Word.
- _needsRuntime: true_

### Indent Right (spinner, inches) — match
- **Word vs clone:** Word: right indent in 0.1" steps. Clone: REAL — updateAttributes paragraph indent.right ×1440 twips; caret-tracked. Verified by code only.
- **Evidence:** commands.js:18 PARA_SPIN indentRight; spinner commands.js:1661; state-sync.ts:153,229.
- **Edge cases to test:** empty selection; multi-paragraph; negative value; table cell; imported content; undo/redo; save+reopen w:ind right; no max clamp
- **Improvement:** Same upper-bound clamp as left indent.
- _needsRuntime: true_

### Spacing After (spinner, points) — match
- **Word vs clone:** Word: space-after in 6pt steps; default 8pt (Word 2007+ Normal). Clone: REAL — updateAttributes paragraph spacing.after ×20; step 6, default 8 (matches Word), caret-tracked (?? 8). Verified by code only.
- **Evidence:** commands.js:20 PARA_SPIN spacingAfter ×20; ribbon.js:454 value '8' for spacingAfter; state-sync.ts:155,231 (?? 8).
- **Edge cases to test:** empty selection; multi-paragraph selection; table cell; imported content with explicit after=0; undo/redo; save+reopen; no max clamp; interaction with 'Don't add space between paragraphs of the same style'
- **Improvement:** Add upper clamp; otherwise faithful.
- _needsRuntime: true_

---

## Mailings tab (mail merge, envelopes/labels, recipients, write&insert fields, preview, finish&merge)  
_31 controls audited_

### Go to Record (spinner) — BUG · S2
- **Word vs clone:** Word's Go-to-Record is a plain integer box defaulting to 1, step 1, no unit. Clone renders it with the GENERIC paragraph-spinner: shows an INDENT icon, a 'pt' unit suffix, step=6, min=0, and default value 0.
- **Evidence:** ribbon.js:450-461 renderSpinner is generic — icon increaseIndent (label has no Left/Before so 'increase'), unit 'pt' (isIndent false), step '6', value '0', min '0'. commands.js:1670 go((value||1)-1). So arrows jump 6 records and the box shows '0'/'pt'.
- **Edge cases to test:** type a record number; click up arrow (jumps +6 records, not +1); type 0 → go(-1)→clamp to record 1 but box shows 0; 'pt' unit is nonsensical; indent icon is wrong; value not synced when nav buttons change record
- **Improvement:** Give goToRecord a dedicated spinner: step 1, min 1, default 1, no unit/icon, and bind its value to Mail.current+1 on nav.
- _needsRuntime: false_

### Rules ▸ If…Then…Else… — BUG · S2
- **Word vs clone:** Word's IF field uses operators = <> > < >= <=; clone's dialog offers labels 'Equal to/Not equal to/Greater than/Less than' and writes them LITERALLY into the instruction, so the exported IF field is syntactically invalid and never evaluates in Word.
- **Evidence:** commands.js:1046 op options are word-labels; :1057 code='IF «'+fld+'» '+op.value+' "v" "then" "else"'. translate-field-annotation.js:41-42 RULE strips {} → instr literally 'IF «F» Equal to "v" ...'. Recorded D10.9 deferrals.md:383 (KNOWN).
- **Edge cases to test:** each operator; empty Then/Else; field name with «»; no >= <= <> options at all (missing operators); export+reopen — Word shows error or literal text
- **Improvement:** Map labels→symbols (Equal to→=, Not equal to→<>, Greater than→>, Less than→<) and add >= <=; quote the field as a real nested MERGEFIELD not literal «F».
- _needsRuntime: false_

### Rules ▸ Next Record If… (NEXTIF) — BUG · S3
- **Word vs clone:** Word's NEXTIF opens a Field-name/Comparison/Compare-to dialog and inserts a CONDITIONAL next-record. Clone's menu item ends in '…' implying a dialog but inserts a BARE 'NEXTIF' with no condition — an incomplete/invalid field (NEXTIF requires Expression1 Operator Expression2).
- **Evidence:** commands.js:1040 'Next Record If…' onClick insertField('NEXTIF') — no dialog, no operands. translate-field-annotation.js:14 NEXTIF∈EMPTY → exports ' NEXTIF ' with no condition.
- **Edge cases to test:** insert (no dialog despite ellipsis); export bare NEXTIF (invalid in Word); Finish&Merge (treated as empty, never advances conditionally)
- **Improvement:** Add the comparison dialog (reuse ifThenElseDialog operands) and emit 'NEXTIF «F» = "v"'.
- _needsRuntime: false_

### Rules ▸ Skip Record If… (SKIPIF) — BUG · S3
- **Word vs clone:** Word's SKIPIF opens a comparison dialog and skips records matching the condition; clone inserts a BARE 'SKIPIF' (ellipsis implies dialog, none shown), exports an invalid condition-less SKIPIF, and the merge never actually skips any record.
- **Evidence:** commands.js:1042 'Skip Record If…'→insertField('SKIPIF'); translate-field-annotation.js:14 SKIPIF∈EMPTY → bare ' SKIPIF '. mmBuildMerge never honors SKIPIF (no skip logic).
- **Edge cases to test:** insert (no dialog); Finish&Merge (no record skipped); export bare SKIPIF (invalid)
- **Improvement:** Add comparison dialog + actually drop matching records in mmBuildMerge.
- _needsRuntime: false_

### Address Block (dialog) — DEVIATION · S3
- **Word vs clone:** Word's Insert Address Block has name-format list, 'Insert company name', 'Insert postal address' (with country/region rules), Match Fields button, and live recipient preview; clone shows the format/company/postal controls + a recipient preview BUT the OK ignores ALL of them and always inserts a bare «AddressBlock» field.
- **Evidence:** mailings-tools.js:66-89 — fmt/company/postal selects built; refresh() previews via composite(); OK at :86 just WC.PM.mmAddressBlock() (no options passed). mail.ts:20 mmAddressBlock always 'ADDRESSBLOCK'/'«AddressBlock»'.
- **Edge cases to test:** change format then OK (ignored); uncheck company/postal then OK (ignored); preview nav ‹ › cycles recipients; no recipients (uses dummy Joshua Randall); export: instr is bare 'ADDRESSBLOCK' with no \\f format/country switches
- **Improvement:** Encode the chosen name format and company/postal flags into the ADDRESSBLOCK field switches (\f, \c, \d, \e) so it matches Word.
- _needsRuntime: false_

### Check for Errors — DEVIATION · S3
- **Word vs clone:** Word's Checking and Reporting Errors offers 3 modes (simulate+report / complete+report-as-occur / complete+report-in-new-doc); clone has NO mode dialog — it scans inserted MERGEFIELD names and toasts unmatched fields or a 'ready' count.
- **Evidence:** mailings-tools.js:169 checkErrors — parses span.annotation[data-field-type=MERGEFIELD], diffs vs this.fields, toasts. No 3-mode dialog (Alt+Shift+K shortcut present in ribbon-data but only runs this).
- **Edge cases to test:** fields all matched (ready toast); an inserted field name not in recipient columns (unmatched toast); no recipients (toast); ADDRESSBLOCK/GREETINGLINE present (not name-checked); Match Fields remaps a field (still flagged unmatched? checkErrors ignores matchMap)
- **Improvement:** Add the 3-mode dialog; honor matchMap when deciding 'unmatched'.
- _needsRuntime: false_

### Edit Recipient List — DEVIATION · S3
- **Word vs clone:** Word's dialog lists recipients with per-row checkboxes (include/exclude), Sort, Filter, Find Duplicates, Find Recipient, Validate, and data-source refresh; clone just re-opens the Type-a-New-List grid (no checkboxes/sort/filter/dedupe).
- **Evidence:** mailings-tools.js:57-60 editRecipientList → typeNewList(); tooltip promises 'sort, filter, find, and remove duplicates' — none implemented.
- **Edge cases to test:** open with 0 recipients (toast guides to Type a New List); exclude a recipient (no mechanism); sort/filter (absent); dedupe (absent)
- **Improvement:** Add include checkboxes + sort/filter/dedupe; these are core Word recipient-management features.
- _needsRuntime: false_

### Envelopes — DEVIATION · S3
- **Word vs clone:** Word opens the Envelopes/Labels dialog with sizes, fonts, Options, E-postage, printer feed; clone shows a 2-textarea dialog (delivery/return) and prepends a hard-coded <div.wc-envelope> page with fixed 140px/320px CSS offsets.
- **Evidence:** mailings-tools.js:184-192 — fixed inline-style positioning, no size/font/options; 'Print' just WC.Files.print().
- **Edge cases to test:** Add to Document with empty addresses; multi-line address (newlines→<br>); Add twice (two envelope pages); then save+reopen — does wc-envelope survive docx roundtrip?; address with < > & (escapeHtml); Print path
- **Improvement:** Use a real envelope page size (#10) and Word's envelope/return-address layout; offer size dropdown.
- _needsRuntime: false_

### Finish & Merge ▸ Edit Individual Documents… — DEVIATION · S3
- **Word vs clone:** Word's Merge to New Document asks All / Current / From-To record range; clone merges ALL recipients with no range dialog into a new doc (one page break per record).
- **Evidence:** mailings-tools.js:171-182 finishMerge('edit') — no range dialog, merges all; mmBuildMerge (mail.ts:39-57) joins every record with a page break. commands.js:1070 menu.
- **Edge cases to test:** merge with 1 recipient (still appends a break? join of 1 = no break — ok); merge with ADDRESSBLOCK/GREETINGLINE (resolved via composite); merge with rule fields (IF/NEXT — NEXT stripped, IF literal); preview ON before finish (K-5: restored to «name» first, mailings-tools.js:179); record range All/Current/From-To (absent); Directory type should NOT page-break per record
- **Improvement:** Add the record-range dialog; suppress per-record page break for Directory merge type.
- _needsRuntime: true_

### Greeting Line (dialog) — DEVIATION · S3
- **Word vs clone:** Word's GREETINGLINE field stores greeting/name-format/punctuation/invalid-name fallback as switches (\f \e \l); clone's dialog collects greet/nameFmt/punct/fallback and previews them, but OK inserts a bare «GreetingLine» field with NONE of the chosen options encoded.
- **Evidence:** mailings-tools.js:90-111 — selects built + live preview; OK :108 WC.PM.mmGreetingLine() only. mail.ts:21 mmGreetingLine always 'GREETINGLINE'/'«GreetingLine»'. Export: translate-field-annotation.js:40 GREETINGLINE → instr just 'GREETINGLINE' (no \f/\e/\l switches).
- **Edge cases to test:** choose 'Hello'/'!'/'(none)' then OK (ignored); empty fallback; preview vs inserted result mismatch (preview shows 'Dear Mr Randall,' but field is bare); export instr lacks switches → Word renders default greeting, not user's
- **Improvement:** Build the GREETINGLINE switch string (\f "<<First>> <<Last>>" \e "fallback" \l 0) from the dialog selections.
- _needsRuntime: false_

### Insert Merge Field (split button + menu) — DEVIATION · S3
- **Word vs clone:** Word's split button: top half opens the Insert Merge Field DIALOG (Address Fields vs Database Fields radio + list + Insert/Match Fields); arrow shows a quick field list. Clone treats the whole control as a flyout of the recipient column names only (no dialog, no Address-vs-Database split, no Match Fields button).
- **Evidence:** commands.js:1030 insertMergeField→insertMergeFieldMenu; mailings-tools.js:62-64 flyout of this.fields; if no fields, '(no fields — select recipients first)'. type:'split' in ribbon-data but handled as a plain menu.
- **Edge cases to test:** no recipients (shows disabled placeholder); insert field at caret in empty para; insert into a table cell; insert twice same field; fields with spaces in name; split-button top-half click vs arrow (no distinction)
- **Improvement:** Honor the split: top half = dialog, arrow = quick list.
- _needsRuntime: false_

### Labels — DEVIATION · S3
- **Word vs clone:** Word's Labels dialog has a full Avery/label-vendor catalog with real page geometry + 'Options' + single-label vs full-page; clone offers 3 Avery presets and builds a plain dashed-border HTML table (no real page/label geometry, gutters, or margins).
- **Evidence:** mailings-tools.js:193-203 — only Avery 5160/5161/5163; buildHTML emits <td height:48px dashed>; 'Print' toasts 'lands with page layout (Phase 7)'.
- **Edge cases to test:** each of 3 presets dims; Full-page checkbox is INERT (read but never used in buildHTML); New Document replaces vs preserves doc; label text with newlines; Print path = toast only; save+reopen the label table
- **Improvement:** Wire the 'Full page of the same label' checkbox (currently dead); add real label geometry; expand vendor list.
- _needsRuntime: false_

### Match Fields — DEVIATION · S3
- **Word vs clone:** Word maps ~30 standard address fields (and remembers per-source) with 'Remember this matching' checkbox; clone maps 10 standard fields to recipient columns, auto-matches by squashed name, persists matchMap in RAM only.
- **Evidence:** mailings-tools.js:204-220 — STD has 10 fields; matchMap in memory; no 'remember' persistence; only 10 vs Word's full set. Used by _val (117-126).
- **Edge cases to test:** map then Address Block uses mapping; '(not matched)' selection; auto-match squashed (FirstName~First Name); confusable columns (Company vs CompanyName — _val 'contains' match could mis-resolve); reopen Match Fields keeps prior matchMap
- **Improvement:** Expand STD set; the _val 'contains' fallback (line 124) can mis-map e.g. 'State'~'StateProvince' vs 'RealEstate' — tighten.
- _needsRuntime: false_

### Preview Results (toggle) — DEVIATION · S3
- **Word vs clone:** Word swaps every field (MERGEFIELD, ADDRESSBLOCK, GREETINGLINE, rules) to its evaluated value; clone previews ONLY MERGEFIELD nodes (mmPreview filters fieldType==='MERGEFIELD'), so ADDRESSBLOCK/GREETINGLINE/MERGEREC keep their «placeholder» during preview.
- **Evidence:** mail.ts:28-38 mmPreview iterates but skips n.attrs.fieldType!=='MERGEFIELD' (line 31). mailings-tools.js:149-159 previewResults; toggled class via Ribbon.controlIndex.previewResults.
- **Edge cases to test:** preview with an ADDRESSBLOCK present (stays «AddressBlock»); preview with no recipients (toast); toggle off restores «name» via defaultDisplayLabel; preview then edit text then toggle (state); preview then SAVE — should restore placeholders (finishMerge restores but plain Save may not); toggled class vs previewOn divergence
- **Improvement:** Preview should also resolve ADDRESSBLOCK/GREETINGLINE/MERGEREC/MERGESEQ; and ensure plain Save (not just Finish&Merge) restores placeholders so preview values aren't persisted.
- _needsRuntime: true_

### Rules ▸ Ask… — DEVIATION · S3
- **Word vs clone:** Word's Ask has Bookmark+Prompt+Default+'Ask once'; clone collects Bookmark+Prompt only, inserts 'ASK Bookmark "Prompt"'. ASK is in EMPTY_FIELD_CODES so it exports as an empty complex field (begin/instr/end, no result) — Word renders nothing for ASK which is correct, but no default/ask-once and no merge-time prompt.
- **Evidence:** commands.js:1035 ASK dialog; translate-field-annotation.js:14 ASK∈EMPTY_FIELD_CODES → buildEmptyComplexFieldRuns. quotes in prompt unescaped.
- **Edge cases to test:** empty bookmark/prompt defaults; quotes in prompt; ASK then reference the bookmark via Fill-in (no linkage)
- **Improvement:** Add default + ask-once; escape quotes.
- _needsRuntime: false_

### Rules ▸ Fill-in… — DEVIATION · S3
- **Word vs clone:** Word's Fill-in dialog has Prompt + Default fill-in text + 'Ask once' checkbox and prompts the user at merge time; clone collects only Prompt, inserts FILLIN "prompt", and never prompts at merge.
- **Evidence:** commands.js:1034 — only Prompt input; insertField('FILLIN "'+t.value+'"'). translate-field-annotation.js:16 FILLIN is a RULE code → exports as complex field (structurally valid). No default-text, no merge-time prompt.
- **Edge cases to test:** empty prompt → 'Enter text'; quotes in prompt (unescaped → breaks instr); Finish&Merge with a FILLIN present (no prompt occurs)
- **Improvement:** Add default text + \d switch; escape quotes; surface a prompt during Finish&Merge.
- _needsRuntime: false_

### Rules ▸ Next Record (NEXT) — DEVIATION · S3
- **Word vs clone:** Word's NEXT advances to the next data row mid-page (used in directory/label merges). Clone inserts NEXT as empty complex field; mmBuildMerge maps NEXT→'__NextRecord__'→'' (composite returns '') so it is REMOVED in the merged output but does NOT actually advance records — every record still gets its own page break.
- **Evidence:** commands.js:1039 NEXT; mail.ts:51 code==='NEXT'→'__NextRecord__'; mailings-tools.js:131 composite('__NextRecord__')→''. mmBuildMerge:56 always joins per-recipient blocks with a page BREAK regardless of NEXT.
- **Edge cases to test:** NEXT in a label/directory layout; two NEXT in one block (should consume 2 records on one page); NEXT with Finish&Merge
- **Improvement:** Implement true NEXT semantics (consume next record within the same output page) instead of stripping it; this is what Update Labels relies on.
- _needsRuntime: true_

### Select Recipients ▸ Type a New List… — DEVIATION · S3
- **Word vs clone:** Word's New Address List has a fixed 13-column schema, Customize Columns (add/rename/delete/reorder), and saves a .mdb/.csv data source; clone shows an editable grid over 9 hard-coded fields, can add/delete ROWS only (no column customize), and keeps data only in memory (never persisted to a data source).
- **Evidence:** mailings-tools.js:8 DEFAULT_FIELDS (9 fields); typeNewList 20-35 — row add/delete only, no Customize Columns; recipients live in Mail.recipients (RAM).
- **Edge cases to test:** add many rows then OK; delete all rows; empty values filtered (Object.values some v); reopen Edit Recipient List keeps edits; no save-to-file → lost on reload
- **Improvement:** Add Customize Columns; persist the list.
- _needsRuntime: false_

### Select Recipients ▸ Use an Existing List… — DEVIATION · S3
- **Word vs clone:** Word opens a data source (xlsx/csv/mdb/accdb/Outlook) with a Select Table step; clone reuses the generic file-open and only handles CSV/TSV (RFC-4180 parsed) or a .txt-as-html fallback — no xlsx, no Excel sheet picker.
- **Evidence:** mailings-tools.js:36-56 useExistingList — wordAPI.open(); r.csv→parseCSV else decode html text; needs header row; xlsx unsupported.
- **Edge cases to test:** CSV with quoted comma in header; CSV with embedded newline in quoted field; TSV detection (tab present, comma absent); single-line CSV (rows<2 → toast); header with spaces 'First Name' vs MERGEFIELD 'First Name'; BOM in CSV header (not stripped — first field name corrupted); xlsx attempt
- **Improvement:** Strip UTF-8 BOM from the first header cell; add xlsx import + sheet picker.
- _needsRuntime: true_

### Finish & Merge ▸ Send Email Messages… — STUB · S3
- **Word vs clone:** Word's Merge to Email has To-field/Subject/Mail-format(HTML/attachment/plain)/record-range and sends via Outlook; clone toasts 'Sending email requires a mail backend — not implemented.'
- **Evidence:** mailings-tools.js:174 mode==='email' → toast not-implemented; commands.js:1070 menu item 'Send Email Messages…'.
- **Edge cases to test:** click (honest toast); no recipients (earlier guard toasts 'No recipients' first)
- **Improvement:** Out of scope without a mail backend; keep honest toast.
- _needsRuntime: false_

### Start Mail Merge ▸ Letters/E-mail/Directory/Normal — STUB · S3
- **Word vs clone:** Word changes the merge main-document TYPE (letters/email/envelopes/labels/directory) which affects export and Finish&Merge options; clone just sets an in-memory string and toasts 'Mail merge type: X' with no document-type effect.
- **Evidence:** commands.js:1024 dropdown; mailings-tools.js:18 startMailMerge(type){this.mergeType=type;WC.toast(...)} — mergeType is set but never read except cosmetically.
- **Edge cases to test:** pick Directory then Finish&Merge (still inserts page breaks per record — wrong for Directory); pick E-mail Messages then Finish&Merge→Email (toasts not-implemented); pick Normal Word Document (no effect)
- **Improvement:** Directory type must NOT emit a page-break per record in mmBuildMerge; email type should enable the email finish path.
- _needsRuntime: false_

### Start Mail Merge ▸ Step-by-Step Wizard — STUB · S3
- **Word vs clone:** Word opens a 6-step task-pane wizard (select doc type→starting doc→recipients→write→preview→complete); clone fakes it by calling startMailMerge('letters') then opening the New Address List dialog — no wizard pane, no steps.
- **Evidence:** commands.js:1024 tail — 'Step-by-Step…' onClick: WC.Mail.startMailMerge('letters'); WC.Mail.typeNewList().
- **Edge cases to test:** launch wizard with no recipients; cancel mid-flow
- **Improvement:** Either implement the staged pane or relabel honestly.
- _needsRuntime: false_

### Update Labels — STUB · S3
- **Word vs clone:** Word propagates the first label cell (with «Next Record») to every cell of the label sheet; clone is a pure toast that tells the user to do it manually (page-layout-gated).
- **Evidence:** mailings-tools.js:221-227 updateLabels → WC.toast('Update Labels lands with the label-sheet page layout (Phase 7)…'). Recorded D10.10 deferrals.md:28-33.
- **Edge cases to test:** click with no label table; click on a real PM label table (still toasts); Word disables it outside a label merge — clone always enabled
- **Improvement:** Gate enablement to label merges; implement propagation once layout lands.
- _needsRuntime: false_

### Find Recipient — DEVIATION · S4
- **Word vs clone:** Word's Find Entry lets you scope to 'All fields' or a specific field and Find Next iteratively; clone searches ALL fields, jumps to the FIRST match only (no Find Next iteration, no field scope).
- **Evidence:** mailings-tools.js:162-168 — findIndex first match across Object.values; 'Find Next' button always re-finds from index 0 (no cursor advance).
- **Edge cases to test:** query matching multiple records (only first); case-insensitive (yes); empty query (returns true, no-op); no match (toast); 'This field' scope (absent); repeat Find Next (same record every time)
- **Improvement:** Add field-scope dropdown + iterate from current+1 on repeated Find Next.
- _needsRuntime: false_

### Finish & Merge ▸ Print Documents… — DEVIATION · S4
- **Word vs clone:** Word merges then opens Print with a record-range; clone toasts a count and calls WC.Files.print() on the CURRENT (un-merged or preview) doc — it does NOT build the merged document first, so it prints the template/preview, not per-record copies.
- **Evidence:** mailings-tools.js:173 mode==='print' → toast + WC.Files.print() (no mmBuildMerge call). commands.js:1070 menu.
- **Edge cases to test:** print with preview off (prints «name» template); print with preview on (prints record 1 only); record range (absent); >1 recipient (still one template printed)
- **Improvement:** Build the merged doc (mmBuildMerge) before printing, like the Edit path; add range dialog.
- _needsRuntime: true_

### Start Mail Merge ▸ Envelopes…/Labels… — DEVIATION · S4
- **Word vs clone:** In Word these set the main-doc type AND open the setup dialog; clone routes them straight to the same Envelopes/Labels dialogs as the Create group (no merge-type set).
- **Evidence:** commands.js:1024 — if(t==='envelopes')WC.Mail.envelopes() else if labels WC.Mail.labels() — does NOT call startMailMerge('envelopes'), so mergeType stays previous.
- **Edge cases to test:** pick Envelopes… then Insert Merge Field (no envelope merge context)
- **Improvement:** Set mergeType before opening the setup dialog.
- _needsRuntime: false_

### First/Previous/Next/Last Record — match
- **Word vs clone:** Word navigates the preview record; clone go()/first/last/next/prev clamp to [0,len-1] and re-render via mmPreview. If preview is OFF, pressing them turns preview ON (Word also enables preview).
- **Evidence:** mailings-tools.js:160-161 go/first/last/next/prev; go: if !previewOn→previewResults(true).
- **Edge cases to test:** Next past last (clamped to last, Word stops too); Prev before first (clamped); with 0 recipients; nav updates StatusBar (WC.StatusBar.update); nav while a field is mid-edit
- **Improvement:** none major; verify StatusBar shows 'Record N of M'.
- _needsRuntime: true_

### Highlight Merge Fields — match
- **Word vs clone:** Word toggles a gray highlight behind all merge fields; clone toggles highlight on ALL fieldAnnotations (not just merge fields) via setFieldAnnotationsHighlighted, and the ribbon button toggles 'toggled' class.
- **Evidence:** mailings-tools.js:112 highlightMergeFields toggles _hl; mail.ts:24-27 mmHighlight filters n.attrs.fieldType!=null (ALL field types, e.g. REF/TOC/citations too, not just MERGEFIELD); commands.js:1027 toggles node class.
- **Edge cases to test:** toggle twice; document with a REF/citation field present (gets highlighted too — over-broad); no fields present; then save (highlight is view-only, must NOT persist); toggled class vs _hl state divergence if both paths fire
- **Improvement:** Scope the predicate to MERGEFIELD/ADDRESSBLOCK/GREETINGLINE/rule codes only, not every fieldAnnotation.
- _needsRuntime: true_

### Insert Merge Field — inserted node OOXML — match
- **Word vs clone:** A real Word MERGEFIELD exports as w:fldSimple w:instr=' MERGEFIELD Name ' with a cached «Name» result run; clone produces exactly that.
- **Evidence:** translate-field-annotation.js:13,38,56,20-26 — MERGEFIELD in SIMPLE_FIELD_CODES → buildSimpleFieldElement(' MERGEFIELD Name ', '«Name»'). Oracle Leg A PASS per deferrals.md:383.
- **Edge cases to test:** field name with spaces ('First Name' → instr 'MERGEFIELD First Name' — Word needs no quotes for spaced names? verify); field name with special chars; save+reopen roundtrip preserves field; preview-on then save (must save «name», not the preview value — see Finish&Merge restore)
- **Improvement:** Verify spaced field names need no quoting in instrText vs Word.
- _needsRuntime: true_

### Rules ▸ Merge Record # (MERGEREC) — match
- **Word vs clone:** Word inserts a MERGEREC field showing the source-row number; clone inserts MERGEREC as an empty complex field (correct structure). NOTE: clone never evaluates it during preview/finish (always renders empty).
- **Evidence:** commands.js:1037 insertField('MERGEREC'); translate-field-annotation.js:14 EMPTY → begin/instr/end. mmBuildMerge resolves only MERGEFIELD/ADDRESSBLOCK/GREETINGLINE/NEXT (mail.ts:50-52), so MERGEREC stays empty.
- **Edge cases to test:** insert then preview (shows nothing, Word shows 1,2,3…); insert then Finish&Merge (stays empty); save+reopen
- **Improvement:** Substitute the 1-based record index for MERGEREC/MERGESEQ during preview + mmBuildMerge.
- _needsRuntime: true_

### Rules ▸ Merge Sequence # (MERGESEQ) — match
- **Word vs clone:** Same as MERGEREC; exports as empty complex field, never evaluated to a number in preview/finish.
- **Evidence:** commands.js:1038 MERGESEQ; translate-field-annotation.js:14 EMPTY_FIELD_CODES; mmBuildMerge ignores it.
- **Edge cases to test:** preview shows nothing (Word shows seq #); with Skip Record If filtering (seq vs rec differ)
- **Improvement:** Evaluate to the merged-output sequence number.
- _needsRuntime: true_

### Rules ▸ Set Bookmark… (SET) — match
- **Word vs clone:** Word's SET assigns a bookmark a value; clone collects Bookmark+Value and inserts 'SET Bookmark "Value"', exported as an empty complex field (correct — SET produces no visible result).
- **Evidence:** commands.js:1041 SET dialog; translate-field-annotation.js:14 SET∈EMPTY → begin/instr/end. quotes in value unescaped.
- **Edge cases to test:** empty value → 'SET Bookmark ""'; quotes in value (breaks instr); reference the bookmark elsewhere (no linkage in preview/finish)
- **Improvement:** Escape quotes in value.
- _needsRuntime: false_

---

## References tab  
_25 controls audited_

### Mark Entry (Alt+Shift+X) — index — BUG · S2
- **Word vs clone:** Word opens the Mark Index Entry dialog: Main entry, Subentry, Options (Cross-reference / Current page / Page range by bookmark), Page number format (bold/italic), and Mark / Mark All / Cancel — staying open for repeated marking. Clone's H.markEntry calls refMarkIndexEntry() with NO arguments and NO dialog; the bridge then only falls back to selected/word text — so with no selection it silently does nothing, and there is no way to enter a main entry, subentry, cross-reference, page range, or formatting at all.
- **Evidence:** commands.js:903 H.markEntry = ()=>WC.PM.refMarkIndexEntry()  (no dialog, no args); references.ts:334-352 — undefined info → entry null → needs selected text or returns false
- **Edge cases to test:** Mark Entry with NO selection (silent no-op — major); Mark Entry with a selection (marks raw text, no subentry); subentry / cross-reference / page-range entirely unavailable; Mark All not implemented; mark inside a table cell; save+reopen → XE field
- **Improvement:** Add the Mark Index Entry dialog (bridge refMarkIndexEntry already accepts {text, subEntry, ...}); this is the single biggest functional gap in the tab.
- _needsRuntime: true_

### Next Footnote (split button + ▾ menu) — BUG · S3
- **Word vs clone:** Word's ▾ offers Next Footnote, Previous Footnote, Next Endnote, Previous Endnote — each jumps to the correct NOTE TYPE. Clone's menu items 'Next Endnote'/'Previous Endnote' call refNextNote('next'/'prev') which navigates over BOTH footnoteReference AND endnoteReference nodes indiscriminately — endnote nav is not type-filtered, so it lands on footnotes too.
- **Evidence:** commands.js:1559-1568 (Next/Prev Endnote both call pm.refNextNote with no type); references.ts:260-277 collects footnoteReference|endnoteReference together with no type filter
- **Edge cases to test:** doc with footnotes only — Next Endnote should do nothing but jumps to a footnote; doc with both — Next Endnote should skip footnotes; wrap-around at last note; no notes present (degrade honestly)
- **Improvement:** Add a noteType param to refNextNote and filter to footnoteReference XOR endnoteReference per menu item.
- _needsRuntime: true_

### Add Text (dropdown) — outline level — DEVIATION · S3
- **Word vs clone:** Word's Add Text offers Do Not Show + Level 1/2/3 AND actually applies the matching Heading style (Level 1→Heading 1) so the paragraph both gets outline level and looks like a heading; clone only sets paragraph outlineLevel (0-8) via format.paragraph.setOutlineLevel, leaving the paragraph's visible style unchanged.
- **Evidence:** commands.js:889-895; references.ts:188-203 sets outlineLevel only, no style change
- **Edge cases to test:** Add Text Level 1 on a Normal paragraph then insert TOC — does it appear?; Do Not Show on an existing Heading 1 (Word removes it from TOC); apply on multi-paragraph selection; caret with no addressable block (mint path); undo
- **Improvement:** Apply the corresponding Heading style alongside the outline level to match Word's visual + structural behavior.
- _needsRuntime: true_

### Bibliography (dropdown) — Bibliography / References / Works Cited / Insert Bibliography — DEVIATION · S3
- **Word vs clone:** Word inserts a built-in bibliography with the chosen HEADING ('Bibliography' vs 'References' vs 'Works Cited') as a styled title; 'Insert Bibliography' inserts the field with no heading. Clone: the title arg is COSMETIC — refInsertBibliography ignores it (fork BibliographyInsertInput has no title slot), so all three collapse to ONE identical bibliography with no distinct heading; body renders empty headless. Also the ribbon-data 'Save Selection to Bibliography Gallery…' item is not rendered.
- **Evidence:** commands.js:927-933; references.ts:611-619 (_title ignored); deferrals.md:381; ribbon-data.js:1756 lists Save-Selection item, flyout omits it
- **Edge cases to test:** insert Bibliography vs Works Cited — confirm identical output; insert with zero sources (Word inserts empty placeholder); insert twice; save+reopen, F9 → bibliography populates
- **Improvement:** Insert a heading paragraph (Bibliography style) carrying the chosen title above the field so the three variants differ.
- _needsRuntime: true_

### Cross-reference (button → dialog) — DEVIATION · S3
- **Word vs clone:** Word's Cross-reference dialog: Reference type (Numbered item, Heading, Bookmark, Footnote, Endnote, Equation, Figure, Table), 'Insert reference to' (varies per type: Page number, Paragraph number, Heading text, Above/below, Entire caption, Only label and number, Only caption text), 'Insert as hyperlink', 'Include above/below', and a live target list. Clone supports only Type=Heading|Bookmark and Insert=Page number|Text|Above/below; no Footnote/Endnote/Figure/Table/Numbered-item targets, no hyperlink checkbox, no caption-specific 'insert to' options.
- **Evidence:** commands.js:949-987 (type only Heading/Bookmark; refType only 3 options; no hyperlink checkbox)
- **Edge cases to test:** cross-ref to a figure caption (unsupported); cross-ref to a footnote (unsupported); 'Above/below' resolution across a page break; target list empty (no headings/bookmarks); insert as hyperlink (missing); field display empty headless then F9 in Word
- **Improvement:** Add Footnote/Endnote/Figure/Table/Equation/Numbered-item reference types + the 'insert as hyperlink' checkbox; map caption 'insert to' variants.
- _needsRuntime: true_

### Insert Caption (button → dialog) — DEVIATION · S3
- **Word vs clone:** Word's Caption dialog has Label (Figure/Table/Equation + New Label…/Delete Label), Position (Above/Below selected item), 'Exclude label from caption', Numbering… (format 1/a/i, chapter-number inclusion + separator), and a live 'Caption:' preview showing 'Figure 1'. Clone dialog has only Label (3 fixed) + free-text Caption; position is hardcoded 'below'; no New Label, no Exclude label, no Numbering options; SEQ number renders empty headless.
- **Evidence:** commands.js:935-942 (Label select of 3 + text input only); references.ts:300-329 position:'below' hardcoded, no numbering opts; deferrals.md:380 (caption number empty headless)
- **Edge cases to test:** insert two Figure captions → SEQ 1,2; insert a Table caption → independent SEQ; Above vs Below (only Below available); caption on a selected image vs at caret; exclude-label option missing; save+reopen → SEQ field repopulates number
- **Improvement:** Add Position above/below, New Label, Exclude label, and Numbering format; the SEQ field already exports.
- _needsRuntime: true_

### Insert Citation (dropdown) — Add New Source / Add New Placeholder / existing sources — DEVIATION · S3
- **Word vs clone:** Word lists existing sources (formatted per style), Add New Source… (full Create Source dialog: 12 source types, Author with Edit/Corporate, multiple field rows per type, language), and Add New Placeholder… (mints a tag placeholder citation you fill later). Clone: existing sources shown as 'Last, year'; Add New Source dialog has only 4 source types (Book/Journal Article/Web Site/Report) and 5 flat fields (Type/Author/Title/Year/Publisher) — no per-type fields, no multi-author editor, no corporate author; Add New Placeholder is a NO-OP toast ('Add a source via Add New Source…').
- **Evidence:** commands.js:910-924; dialogs.js:1282-1306 (4 types, 5 fields, single author string); placeholder toast at commands.js:913
- **Edge cases to test:** add source with two authors (only first surname survives — personFromString takes one string); pick a non-Book type → fields don't change; Add New Placeholder → nothing inserted; insert citation with no caret block (mint path); in-text citation renders empty headless (repopulates in Word)
- **Improvement:** Expand source types to the full 12 (bridge normalizeSourceType already maps them) and add per-type field rows + multi-author editor; implement Add New Placeholder via a tag source.
- _needsRuntime: false_

### Insert Endnote (Alt+Ctrl+D) — DEVIATION · S3
- **Word vs clone:** Word inserts a roman-numbered (i, ii…) endnote at document/section end; clone inserts an endnote seeded with literal 'Endnote' text and uses the same insert path as footnote — numbering format/placement parity unverified, and caret isn't moved into the note.
- **Evidence:** references.ts:206-219 seed='Endnote'
- **Edge cases to test:** endnote default number format (Word default i,ii,iii); mix footnotes + endnotes, verify separate sequences; endnote placement (end of section vs end of document); save+reopen → endnotes.xml
- **Improvement:** Empty seed + caret into note; verify endnote numbering style matches Word (lowercase roman).
- _needsRuntime: true_

### Insert Footnote (Alt+Ctrl+F) — DEVIATION · S3
- **Word vs clone:** Word inserts an auto-numbered footnote ref at the caret and moves the caret into the footnote area at page bottom for typing; clone inserts a footnote seeded with literal placeholder text 'Footnote' and does NOT move the caret into the note for editing (notes live in a separate clone-owned notes area). Note bodies are plain-text only (rich formatting dropped).
- **Evidence:** references.ts:206-218 seed='Footnote'; deferrals.md:381 (plain-text note bodies); known-bug list (footnote seeds 'Footnote')
- **Edge cases to test:** insert two footnotes — numbering 1,2 sequential?; insert footnote then endnote — independent numbering?; insert inside a table cell; insert at end of doc; caret with no stable block id (mint path); save+reopen and read footnotes.xml; undo immediately after insert
- **Improvement:** Seed with empty content + place caret in the note body (or open notes area focused) instead of literal 'Footnote'.
- _needsRuntime: true_

### Insert Index (button) — DEVIATION · S3
- **Word vs clone:** Word opens the Index dialog (Type Indented/Run-in, Columns, Language, Right align page numbers, Tab leader, Formats, AutoMark…, Mark Entry…, Modify…) then inserts at the caret. Clone immediately inserts at documentEnd with NO dialog and no options (always hardcoded {at:{kind:'documentEnd'}}); entries render empty headless.
- **Evidence:** commands.js:904; references.ts:354-362 (documentEnd, no options)
- **Edge cases to test:** insert with no marked entries; insert at caret vs forced doc end; indented vs run-in (unsupported); columns count (unsupported); update after marking more entries; save+reopen F9
- **Improvement:** Insert at the caret (not forced doc end) and add the Index dialog (columns, indented/run-in, tab leader).
- _needsRuntime: true_

### Insert Table of Authorities (button) — DEVIATION · S3
- **Word vs clone:** Word's ToA dialog: Category selector (All / specific 1-16), 'Use passim', 'Keep original formatting', Tab leader, Formats, Modify — then inserts. Clone immediately inserts at documentEnd with NO dialog and no category/passim/formatting options; entries render empty headless.
- **Evidence:** commands.js:907; references.ts:410-418 (documentEnd, no options)
- **Edge cases to test:** insert with multiple categories of marked citations (no per-category control); 'Use passim' (unsupported); insert at caret vs doc end; update after marking more; save+reopen F9
- **Improvement:** Add a ToA dialog (category, passim, tab leader) and insert at the caret.
- _needsRuntime: true_

### Insert Table of Figures (button) — DEVIATION · S3
- **Word vs clone:** Word opens a Table of Figures dialog (Caption label dropdown Figure/Table/Equation/(none), Include label and number, tab leader, formats, Options/Modify) before inserting. Clone immediately inserts a raw TOC field hardcoded to label 'Figure' (TOC \c "Figure" \h \z) with NO dialog — cannot pick Table/Equation ToF; entries render empty headless.
- **Evidence:** commands.js:902 refInsertTOF('Figure'); references.ts:318-329 (label default 'Figure', no dialog)
- **Edge cases to test:** doc with Table captions — ToF for Figures wrongly empty/no Table option; insert ToF then Update; save+reopen F9 populates; no captions present
- **Improvement:** Add a ToF dialog to choose the caption label (the bridge refInsertTOF already accepts a label param).
- _needsRuntime: true_

### Manage Sources (Source Manager) — DEVIATION · S3
- **Word vs clone:** Word's Source Manager has a Master List + Current List (two panes), Search/Sort, Copy between lists, New/Edit/Delete, Browse for an external XML library, and a preview pane. Clone has only a single Current List with inline Edit/Delete and a New… button — no Master List, no copy, no browse, no search/sort, no preview.
- **Evidence:** dialogs.js:1307-1346
- **Edge cases to test:** edit a source then verify export reflects it (refUpdateSource); delete a cited source (Word keeps the citation as broken; verify clone); multi-author edit loses authors 2+; empty list message
- **Improvement:** Add Master/Current dual-list + Browse XML; at minimum a search box.
- _needsRuntime: false_

### Mark Citation (Alt+Shift+I) — Table of Authorities — DEVIATION · S3
- **Word vs clone:** Word's Mark Citation dialog has Selected text, Category (8 built-in: Cases, Statutes, Other Authorities, Rules, Treatises, Regulations, Constitutional Provisions, plus user 8-16), Short citation, Long citation, a Next Citation finder, Category… editor, and Mark / Mark All. Clone has Selected text + Category (7, missing Word's empty slot for user categories and any Category editor) + Short citation, with a single Mark button — no Mark All, no Next Citation, no long-vs-selected distinction, no category editor.
- **Evidence:** commands.js:998-1019 (7 categories CAT_MAP 1-7, single Mark); references.ts:388-408
- **Edge cases to test:** mark with category 'Other Authorities' (→ \c 3); Mark All across duplicate citations (unsupported); short vs long citation both default to selected text; mark with empty selection (falls back to caret word/none); save+reopen → TA field \c numeric survives (FIX 2)
- **Improvement:** Add Mark All + Next Citation; expose the long-citation field separately from selected text.
- _needsRuntime: true_

### Style (dropdown) — citation style — DEVIATION · S3
- **Word vs clone:** Word ships ~12+ styles (APA, Chicago, GB7714, GOST variants, Harvard-Anglia, IEEE, ISO 690 two forms, MLA, SIST02, Turabian) and changing it RE-RENDERS every in-text citation + bibliography immediately. Clone offers only 6 (APA/Chicago/IEEE/ISO 690/MLA/Turabian); selecting one only calls bibliography.configure on an EXISTING bibliography (degrades to false if none) and shows a toast — in-text citations are NOT re-rendered (they're placeholder/empty headless anyway).
- **Evidence:** commands.js:926 (6 styles); references.ts:577-597 refSetCitationStyle requires an existing bibliography node, else false
- **Edge cases to test:** change style before any bibliography exists (no-op/false); change style after bibliography — does StyleName change on export?; ribbon-data lists 'and more' as a literal item (cosmetic, never rendered in flyout)
- **Improvement:** Persist the selected style globally (so a later Insert Bibliography uses it) and re-render citations; ribbon-data's 'and more' literal should be dropped.
- _needsRuntime: true_

### Table of Contents (dropdown) — Automatic Table 1 / 2 — DEVIATION · S3
- **Word vs clone:** Word inserts a TOC field inside an SDT content control with a styled 'Contents'/'Table of Contents' heading + a real updatable field result; clone calls refInsertTOC({title}) but the `title` arg is IGNORED by the bridge (refInsertTOC only reads showLevels/page-number/align opts, never title), and entry page numbers render as placeholder '0' headless.
- **Evidence:** commands.js:857-858 pass {title:...}; references.ts:114-134 refInsertTOC never reads opts.title; deferrals.md:380 (TOC entry page run='0')
- **Edge cases to test:** insert with zero headings present (Word shows 'No table of contents entries found'); insert, edit a heading, then Update Table; insert two TOCs; Automatic 1 vs 2 should differ only by heading caption — verify both produce identical body; save+reopen in Word and F9 to confirm page numbers populate
- **Improvement:** Thread the chosen heading title into the SDT/leading paragraph so Automatic Table 1 ('Contents') and 2 ('Table of Contents') visibly differ as in Word.
- _needsRuntime: true_

### Table of Contents → Custom Table of Contents… dialog — DEVIATION · S3
- **Word vs clone:** Word's Custom TOC dialog has a Print/Web Preview, a Formats dropdown (From template/Classic/Distinctive/Fancy/Modern/Formal/Simple), 'Use hyperlinks instead of page numbers', and Options/Modify buttons (build from styles/outline levels/TC fields). Clone dialog has only 4 controls (Show page numbers, Right align, Tab leader, Show levels) and the Tab leader select is DEAD — its value is never read by the OK handler.
- **Evidence:** commands.js:869-888 — leader select built at 872 but OK handler (881-885) only passes includePageNumbers/showLevels/rightAlignPageNumbers; no Formats/hyperlinks/Options/Modify
- **Edge cases to test:** change Tab leader to dashes/none → confirm no effect on output; set Show levels=4 → confirm \o range; uncheck Show page numbers
- **Improvement:** Wire the tab-leader select into config.tabLeader (bridge already supports opts.tabLeader), add the hyperlinks checkbox and a Formats dropdown.
- _needsRuntime: false_

### Table of Contents → Manual Table — DEVIATION · S3
- **Word vs clone:** Word inserts a type-it-yourself manual TOC (literal 'Type chapter title (level 1)' placeholder rows, NO heading collection); clone degrades to an AUTO TOC built from headings (refInsertTOC({showLevels:3})).
- **Evidence:** commands.js:864 + comment 859-863; references.ts always builds from headings; deferrals.md:381
- **Edge cases to test:** pick Manual Table in a doc with headings — confirm it wrongly collects them; pick Manual Table in an empty doc
- **Improvement:** Emit a real manual TOC (literal placeholder paragraphs in TOC styles, no field) to match Word.
- _needsRuntime: false_

### Update Table (TOC group button) — DEVIATION · S3
- **Word vs clone:** Word prompts 'Update page numbers only / Update entire table' then renumbers; clone rebuilds every TOC + all generic fields silently with no dialog, and page numbers stay placeholder headless (repopulate only in real Word on F9).
- **Evidence:** commands.js:896; references.ts:138-165 (no prompt, mode:'all')
- **Edge cases to test:** add a heading then Update — new entry appears?; delete a heading then Update; update with no TOC present (should no-op honestly); page-numbers-only vs whole-table
- **Improvement:** Add the Word update-mode prompt; ensure ToF/Index/ToA also refresh (currently piggybacks on fields.rebuild).
- _needsRuntime: true_

### Footnote & Endnote dialog launcher (group dialog-box launcher) — GAP · S3
- **Word vs clone:** Word's Footnotes group has a dialog launcher opening the Footnote and Endnote dialog (Location: footnotes Bottom of page/Below text; endnotes End of document/section; Number format; Start at; Numbering Continuous/Restart each section/page; Apply changes to; Convert…). The clone has NO such dialog and ribbon-data exposes no launcher control — every numbering/location/format option is missing.
- **Evidence:** ribbon-data.js:1635-1678 (Footnotes group has only 4 buttons, no dialogLauncher); no footnote-options dialog anywhere in commands.js/dialogs.js
- **Edge cases to test:** change number format to symbols; Start at 5; restart numbering each section; convert footnotes to endnotes
- **Improvement:** Add the Footnote & Endnote options dialog (the fork footnotes API likely supports type/numberFormat/startAt).
- _needsRuntime: false_

### Show Notes (button + appears in ▾) — DEVIATION · S4
- **Word vs clone:** Word's Show Notes scrolls to the footnote/endnote area; in Draft view with both present it prompts 'View footnote area / View endnote area'. Clone reveals/scrolls a custom 'pm-notes-area' DOM region (not Word's bottom-of-page footnote pane) and shows no footnote-vs-endnote chooser.
- **Evidence:** commands.js:900; references.ts:283-292 (WC.NotesArea.showNotes / #pm-notes-area)
- **Edge cases to test:** Show Notes with no notes (returns false/no-op); both footnotes and endnotes present (no chooser); after deleting all notes
- **Improvement:** When both note types exist, prompt which area to show, matching Word.
- _needsRuntime: true_

### Update Table (Captions group button) — DEVIATION · S4
- **Word vs clone:** In Word this updates the Table of Figures (with the page-numbers-only / entire-table prompt). Clone reuses the SHARED H.updateTable which rebuilds ALL TOCs and all generic fields (so a ToF gets rebuilt via fields.rebuild), with no prompt; headless page numbers stay placeholder.
- **Evidence:** ribbon-data.js:1782 cmd='updateTable'; commands.js:896 + references.ts:138-165
- **Edge cases to test:** update with a ToF but no TOC; update with both a TOC and a ToF (both rebuild); no prompt for update mode
- **Improvement:** Scope the Captions Update Table to ToF fields + add the update-mode prompt.
- _needsRuntime: true_

### Update Table (Table of Authorities group button) — DEVIATION · S4
- **Word vs clone:** Word updates the ToA from TA fields. Clone reuses the SHARED H.updateTable which rebuilds all TOCs + all generic fields (a ToA TOC field gets caught by fields.rebuild), no prompt; headless numbers stay placeholder.
- **Evidence:** ribbon-data.js:1852 cmd='updateTable'; commands.js:896; references.ts:138-165
- **Edge cases to test:** update with a ToA but no TOC; mark a new citation then update; no prompt
- **Improvement:** Scope to ToA fields and add the update-mode prompt.
- _needsRuntime: true_

### Update Index (button) — match
- **Word vs clone:** Word rebuilds the index from XE fields; clone iterates d.index.list() and rebuilds each — structurally correct, but headless page numbers stay placeholder until opened in real Word (Phase-7 layout gap).
- **Evidence:** commands.js:905; references.ts:364-380
- **Edge cases to test:** update with no index present (no-op); mark a new entry then update; update twice
- **Improvement:** None beyond the global headless page-number gap.
- _needsRuntime: true_

### Researcher — STUB · S5
- **Word vs clone:** Word opens the Researcher pane (cloud knowledge service); clone shows an honest toast.
- **Evidence:** commands.js:909 (toast)
- **Edge cases to test:** click → toast
- **Improvement:** None (expected deferral).
- _needsRuntime: false_

### Search (Smart Lookup) — STUB · S5
- **Word vs clone:** Word opens the Smart Lookup / Search pane (Bing-backed); clone shows an honest toast ('not available in this clone').
- **Evidence:** commands.js:908 (toast)
- **Edge cases to test:** click → toast appears, nothing inserted
- **Improvement:** None (expected cloud-service deferral, ribbon feasible='no').
- _needsRuntime: false_

### Table of Contents → More Tables from Office.com — GAP · S5
- **Word vs clone:** Word opens an Office.com gallery; clone's flyout doesn't even render this item (ribbon-data lists it but H.tableOfContents builds only Auto1/Auto2/Manual/Custom/Remove).
- **Evidence:** ribbon-data.js:1604 lists 'More Tables from Office.com'; commands.js:855-868 flyout omits it
- **Edge cases to test:** open the TOC dropdown and confirm the item is absent
- **Improvement:** Either render a disabled item or drop it from ribbon-data so the flyout matches the spec.
- _needsRuntime: false_

### Table of Contents → Save Selection to Table of Contents Gallery… — GAP · S5
- **Word vs clone:** Word saves the selection as a building block; clone's flyout omits this item entirely (listed in ribbon-data but not rendered).
- **Evidence:** ribbon-data.js:1607; commands.js:855-868 omits it
- **Edge cases to test:** open dropdown, confirm absent
- **Improvement:** Drop from ribbon-data or stub a toast for honesty.
- _needsRuntime: false_

---

## Review tab  
_28 controls audited_

### Restrict Editing — BUG · S2
- **Word vs clone:** Word: enforces editing restrictions (read-only / tracked-changes-only / comments-only / forms) with a real protection that blocks ALL edit paths until stopped, optionally password-protected. Clone (dialogs.js:885): pane with 'No changes (Read only)' and 'Tracked changes'; Comments/Filling-forms are disabled options (dialogs.js:907). Read-only enforcement = editor.setEditable(false) (dialogs.js:921). KNOWN LEAK (confirmed new specifics): the bridge cmd() path has NO editable guard (no editable/protected check in bridge/commands.ts), so RIBBON commands and WC.PM.cmd dispatch transactions straight to editor.state, bypassing the non-editable DOM — formatting, insert, even type-via-some-paths can still mutate a 'read-only' document. There is also NO password option, and Formatting restrictions checkbox is disabled (dialogs.js:896).
- **Evidence:** dialogs.js:885-947; dialogs.js:921 setEditable(false); bridge/commands.ts has no 'editable'/'protected' guard (grep: no matches); dialogs.js:896,907 disabled options
- **Edge cases to test:** Start Enforcing read-only then apply Bold from ribbon (leaks); read-only then Insert > Table (leaks?); read-only then type in body (DOM blocks); Tracked-changes mode then edit (recorded as tracked + locked); Stop Protection restores editable; no password prompt (Word offers one); Comments/Forms options disabled; reopen pane reflects enforced state
- _needsRuntime: true_

### Accept (split + main) — DEVIATION · S2
- **Word vs clone:** Word main Accept = accept-and-advance. Clone main H.accept (commands.js:1319) calls acceptChange THEN nextChange unconditionally — but acceptChange uses changeIdAtCaret (review.ts:358-370); if the caret is NOT on a change it returns false and nothing is accepted, yet nextChange still moves — so with the caret off a change, main Accept silently advances without accepting (Word jumps to & does not accept the first either, roughly OK, but the chaining can also skip a change: accept removes the range, then nextChange searches from the NEW caret and may jump past the adjacent change). 'Accept All Changes Shown' is permanently DISABLED (commands.js:1596, no filter). 'Accept All and Stop Tracking' chains acceptAll + disableTrackChanges (commands.js:1598) — order/idempotency needs runtime check.
- **Evidence:** commands.js:1319 accept=acceptChange+nextChange; review.ts:358-370 caret-based id; commands.js:1596 Shown disabled; 1598 acceptAll+disableTrackChanges
- **Edge cases to test:** caret on a change -> accept+advance; caret NOT on a change -> advances without accepting; accept the LAST change (nextChange wraps to first); Accept This Change (non-advancing, commands.js:1595); Accept All Changes; Accept All + Stop Tracking; accept a delete vs insert vs format; accept inside a table; accept then undo (single undo?); accept then save+reopen
- _needsRuntime: true_

### Compare (dropdown: Compare / Combine / Show Source) — DEVIATION · S2
- **Word vs clone:** Word: Compare produces a legal blackline as a NEW document with full structural diff (insertions, deletions, moves, formatting, tables, headers/footers); 'Show Source Documents' panes the originals. Clone (dialogs.js:954): a faithful dialog but the engine does a TEXT-LEVEL diff only (htmlToText/getText, dialogs.js:956-957) replayed as tracked changes — Moves/Comments/Formatting/Tables/Headers/Footnotes/Textboxes/Fields settings are all DISABLED no-ops (dialogs.js:991), and 'Show changes in: Original/Revised' radios are disabled (only New, dialogs.js:998-999). Critically the result REPLACES the current document (acknowledged deviation, dialogs.js:1033) rather than opening a new one — and Browse only accepts .txt/.htm (NOT .docx, dialogs.js:964), so you cannot compare two real Word files. 'Show Source Documents' is disabled (commands.js:1328).
- **Evidence:** dialogs.js:954-1041; dialogs.js:956 htmlToText word-level; dialogs.js:964 accept .txt/.html only; dialogs.js:1033 REPLACES current doc; commands.js:1328 Show Source disabled
- **Edge cases to test:** Compare current vs a browsed .txt; try to browse a .docx (rejected by accept filter); Combine vs Compare (combine flag, dialogs.js:955); character vs word granularity (only live setting, dialogs.js:1031); confirmDiscard cancel path; result unbound from file path (Ctrl+S safety, dialogs.js:1034); compare docs with tables/formatting (ignored); large docs ('Compare failed')
- _needsRuntime: true_

### Reject (split + main) — DEVIATION · S2
- **Word vs clone:** Symmetric to Accept. Clone main H.reject = rejectChange + nextChange (commands.js:1320); same caret-dependency and advance-without-rejecting edge as Accept. 'Reject All Changes Shown' permanently disabled (commands.js:1604). 'Reject All and Stop Tracking' = rejectAll + disableTrackChanges (commands.js:1606).
- **Evidence:** commands.js:1320 reject chain; commands.js:1604 Shown disabled; 1606 rejectAll+disableTrackChanges
- **Edge cases to test:** reject an insertion (text removed); reject a deletion (text restored); reject a format change; caret off a change advances without rejecting; Reject Change (non-advancing, commands.js:1603); Reject All; Reject All + Stop Tracking; reject across page break / in table; undo after reject
- _needsRuntime: true_

### Check Accessibility (split) — DEVIATION · S3
- **Word vs clone:** Word: Accessibility Checker pane with Errors/Warnings/Tips categories, contrast analysis, reading-order, per-issue 'Recommended Actions' and live re-check; split has Alt Text, Accessibility Reminder, Options. Clone: a clone-styled pane (commands.js:1158 pmAccessibility) checking only 4 things — image alt text, table header row, presence of headings, and self-href links. The split-menu's Alt Text / Accessibility Reminder / Options items are absent — the dropdown only renders 'Check Accessibility' (commands.js:1623). 'Color and Contrast' and 'Document Access' cards always render EMPTY (no checks). No fix actions; clicking an issue does nothing.
- **Evidence:** commands.js:1158-1208 4 checks only; commands.js:1199/1203 empty Color/Access cards; commands.js:1623 dropdown drops 3 of 4 declared items
- **Edge cases to test:** image without alt -> flagged; image alt=='Uploaded picture' -> flagged (commands.js:1164); table missing header row; doc with no headings + text -> 'No headings'; self-link (href==text); empty doc -> 'Looks good'; Alt Text / Reminder / Options menu items (missing); click an issue (no navigation/fix)
- _needsRuntime: false_

### Display for Review (combo: Simple/All/No Markup/Original) — DEVIATION · S3
- **Word vs clone:** Word: 4 distinct render states; Simple Markup shows a change bar in the margin only, No Markup hides all. Clone: combo (commands.js:1647) maps to setReviewView (review.ts:130-141). Engine-wise 'simple' and 'none' are the SAME engine state (enableTrackChangesShowFinal) distinguished only by a 'review-simple' CSS class (review.ts:133,138) — so Simple Markup's margin change-bars depend on clone chrome (track-chrome) rather than the engine, a fidelity risk. Also the combo input default label/value may not sync with the engine's actual current view on open.
- **Evidence:** review.ts:130-141 simple===none engine state + review-simple class; commands.js:1647 combo sets value text only
- **Edge cases to test:** Simple Markup with tracked insertions (change bar shown?); No Markup hides ins/del visually but keeps marks; Original shows pre-change text; All Markup resets both engine flags; switch views then Accept (does the hidden change still apply correctly?); combo label reflects engine state after Compare populates changes; across a page break
- _needsRuntime: true_

### Editor (Proofing) — DEVIATION · S3
- **Word vs clone:** Word: M365 Editor pane with live cloud refinements + clickable suggestion cards driven by Microsoft Editor service. Clone: opens a local Editor pane (dialogs.js:595 D.editorPane) using a built-in WC.Proofing dictionary; Clarity/Conciseness run locally, but Formality/Punctuation/Vocabulary/Similarity are rendered DISABLED rows (dialogs.js:667-669) and an 'Editor Score' is a clone-invented heuristic (score = 100 - n*8/5/2, dialogs.js:643) that has no Word equivalent.
- **Evidence:** commands.js:484 H.editor=>WC.Dialogs.editorPane; dialogs.js:643 invented score; dialogs.js:667-669 disabled refinement rows
- **Edge cases to test:** empty document (no issues -> 100% / 'Looks good'); misspelled word -> suggestion buttons replace at PM position; 'Ignore All' then re-open pane; 'Add to Dictionary' then re-scan; grammar issue spanning a paragraph break; inside a table cell; run pane while Track Changes ON (does replaceAt create tracked edits?); toggle 'Check spelling as you type' checkbox
- _needsRuntime: false_

### Language (dropdown: Set Proofing Language / Language Preferences) — DEVIATION · S3
- **Word vs clone:** Word: Set Proofing Language sets per-RUN w:lang on the selection (or document); Language Preferences opens the distinct Office editing-languages dialog. Clone: BOTH items open the SAME languageDialog (commands.js:1210-1213). Applying sets only the DOM lang/spellcheck attribute on the whole editor surface (setProofingLanguage commands.js:1217) — it is DOC-LEVEL ONLY and does not write per-run w:lang (acknowledged ledger-C deviation, commands.js:1214-1216), so 'Selected text' radio has no real per-run effect and the language does NOT round-trip to .docx. 'Detect language automatically' checkbox is inert. 'Do not check spelling' only flips the spellcheck attr.
- **Evidence:** commands.js:1210-1213 both items->languageDialog; commands.js:1217-1222 doc-level lang attr only; comment 1214-1216 'per-run w:lang isn't on the fork command surface'
- **Edge cases to test:** Set proofing lang for Selected text (no per-run effect, no export); set then Save+reopen (lang lost); 'Set As Default' persists to localStorage only; 'Do not check spelling' toggles spellcheck attr; Detect-automatically checkbox (inert); Language Preferences opens identical dialog (not the Office one)
- _needsRuntime: true_

### Read Aloud — DEVIATION · S3
- **Word vs clone:** Word: reads from caret, highlights word+sentence, floating controls with real voice picker and prev/next that jump by paragraph. Clone: Web Speech API (commands.js:2092 toggleReadAloud) reads PM text from selection-or-caret to doc end, truncated to 8000 chars (commands.js:2118); per-word CSS ::highlight (commands.js:2120). The floating bar's Prev/Next BOTH just restart playback from the start (commands.js:2161-2162) rather than navigating; the voice <select> is built but never bound to the utterance (commands.js:2157-2159, u.voice never set), so changing voice does nothing; speed works.
- **Evidence:** commands.js:2161-2162 prev/next=speakReadAloud; commands.js:2157-2159 voice select unbound; commands.js:2118 8000-char cap
- **Edge cases to test:** no voices installed (option 'Default'); >8000 char doc gets cut; Prev/Next buttons (both restart); change voice dropdown (no effect); change speed mid-playback (restarts); read with a selection vs caret; pause/resume; close bar mid-utterance; read across a page break (highlight scroll)
- _needsRuntime: true_

### Show Markup (dropdown) — DEVIATION · S3
- **Word vs clone:** Word submenu: Insertions and Deletions, Formatting, Comments, Ink, Balloons (3 modes), Specific People (per-reviewer checklist), plus Highlight Updates/Other Authors (cloud). Clone (commands.js:1282-1304): InsDel and Formatting toggle #pm-editor classes (functional). Balloons submenu sets pmMarkup.balloons (consumed by track-chrome). BUT 'Comments' and 'Ink' toggles are MISSING from the menu (Word has them). 'Specific People' submenu shows only a static '✓ All Reviewers' no-op (commands.js:1297). 'Highlight Updates' and 'Other Authors' are disabled (cloud, acceptable).
- **Evidence:** commands.js:1286-1287 insDel/formatting class toggles; 1296-1298 Specific People no-op; 1301-1302 disabled; no Comments/Ink items
- **Edge cases to test:** toggle Insertions and Deletions hides ins/del; toggle Formatting hides format marks; Balloons mode switch (revisions/inline/formatting); Specific People (no real reviewers); missing Comments toggle (Word can hide comments here); missing Ink toggle; reopen menu reflects current latches
- _needsRuntime: true_

### Spelling & Grammar (split: Spelling | Spelling and Grammar) — DEVIATION · S3
- **Word vs clone:** Word 2021: F7 opens the classic Spelling & Grammar checker (modal, one issue at a time, Change/Ignore/Add). Clone: BOTH split-menu items AND the main button route to the SAME Editor pane (commands.js:442, 1576) — there is no classic one-issue-at-a-time modal, and the 'Spelling' vs 'Spelling and Grammar' distinction is cosmetic (identical handler).
- **Evidence:** commands.js:442 H.spellingGrammar=>editorPane; commands.js:1576 both flyItems call H.spellingGrammar()
- **Edge cases to test:** F7 shortcut (declared in ribbon-data; verify it maps); 'Spelling' item vs 'Spelling and Grammar' item produce identical pane; no errors -> Word shows 'Spelling and grammar check complete' toast; clone shows pane with 100%; document with only grammar (no spelling) errors
- _needsRuntime: false_

### Thesaurus — DEVIATION · S3
- **Word vs clone:** Word: Shift+F7 opens Thesaurus pane backed by a full synonym/antonym lexicon with meaning groups and definitions. Clone: a right-dock pane (commands.js:1109 pmThesaurus) backed by a hard-coded 8-word table (review-tools.js:15 WC.Review.THES: good/bad/big/small/happy/important/quick/said only). Any other word shows 'No synonyms ... in the built-in thesaurus'. No antonyms, no meaning groups, no definitions; the language combo at the bottom is a static non-functional <select> (commands.js:1149).
- **Evidence:** review-tools.js:15 8-entry THES; commands.js:1125 lookup misses everything else; commands.js:1148-1150 inert language select
- **Edge cases to test:** word in table (e.g. 'good') -> shows synonyms; word not in table -> 'No synonyms'; caret in empty paragraph -> pmWordAtCaret null; multi-word selection -> looks up the trimmed phrase (never matches); pick a synonym -> replaces range; pick again -> inserts at caret (range nulled, commands.js:1139); Shift+F7 shortcut
- _needsRuntime: false_

### Track Changes (split: For Everyone / Just Mine / Lock Tracking) — DEVIATION · S3
- **Word vs clone:** Word: toggles tracking; 'Just Mine' (Track only my changes) vs 'For Everyone' are distinct co-authoring scopes; Lock Tracking requires password. Clone: main button toggles fork tracking honoring the lock (commands.js:445-448). In the split menu 'Just Mine' === 'For Everyone' (both call H.trackChanges, commands.js:1583-1584) — the per-author scope is collapsed (acknowledged single-author note). Lock Tracking is a clone-level UI gate over the toggle (not the OOXML w:trackChanges lock); the check-mark shows BOTH For Everyone and Just Mine ticked when tracking is on, which is wrong (Word ticks only the active mode).
- **Evidence:** commands.js:445-448 H.trackChanges; commands.js:1583-1584 both items->H.trackChanges; tick logic uses tcOn for both
- **Edge cases to test:** toggle on/off via Ctrl+Shift+E; Just Mine vs For Everyone (identical); Lock Tracking sets password + forces tracking ON (dialogs.js:731); try to turn off while locked (blocked toast, commands.js:446); unlock with wrong password; both items show check when on (deviation); tracking state persists to docx (w:trackChanges)
- _needsRuntime: true_

### Track Changes Options (Markup launcher) — DEVIATION · S3
- **Word vs clone:** Word: Track Changes Options dialog -> Advanced opens the full Advanced Track Changes Options (per-mark style/color, moves, table cell highlighting, formatting, balloons). Clone (dialogs.js:758): a faithful-looking dialog where Show toggles + balloons combo + pane orientation are LIVE, but in Advanced (dialogs.js:808) only Insertions/Deletions mark-style+color and balloon width are honored; Changed lines, Moves, Table cell highlighting, Formatting, Paper orientation are rendered DISABLED at Word defaults (honest stubs). Balloons combo labels are remapped ('Comments and formatting'/'Revisions'/'Nothing') and stored as formatting/revisions/inline which may not 1:1 match Word semantics.
- **Evidence:** dialogs.js:758-802 options dialog; dialogs.js:808-855 advanced (most controls dis()-abled); dialogs.js:773 balloon label remap
- **Edge cases to test:** change insertion deco to Bold/Italic/Color-only (decoLine maps these to 'none', dialogs.js:840 -> may show nothing); change ins/del color By author vs explicit; balloon width min2/max6; Changed lines/Moves/Tables disabled; Change User Name updates w:author; reopen dialog reflects saved _advTrack
- _needsRuntime: true_

### Word Count — DEVIATION · S3
- **Word vs clone:** Word: dialog shows Pages/Words/Characters(no/with spaces)/Paragraphs/Lines AND when a selection exists shows 'N of M words'. Clone: dialog (dialogs.js:264) shows only whole-document totals — the bridge computes selWords (io.ts:51) but the dialog NEVER reads/displays it, so a selection is ignored. The 'Include textboxes, footnotes and endnotes' checkbox is an admitted no-op (dialogs.js:269-273). Counts are derived from rendered innerText (io.ts:40) so hidden/collapsed content and field codes may miscount; pages comes from pagination.pageCount or falls back to 1.
- **Evidence:** dialogs.js:264-274 no selWords use; io.ts:51 selWords computed but unused; dialogs.js:272 inert checkbox
- **Edge cases to test:** select a sentence -> Word shows 'X of Y'; clone shows only Y; empty doc -> 0 words, 1 line, 1 page; multi-page doc -> pages reflects pagination engine vs Word; doc with a table (cell text counted?); footnote/textbox content (clone has none outside body); characters-with-vs-without-spaces accuracy vs Word
- _needsRuntime: true_

### Delete Comment (split: Delete / All Shown / All in Document / All Resolved) — DEVIATION · S4
- **Word vs clone:** Word: 'Delete All Comments Shown' deletes those passing the active markup/reviewer filter. Clone: deletes active-or-first thread; 'Delete All Comments in Document' and 'Delete All Resolved Comments' iterate getComments (commands.js:1614-1615); 'Delete All Comments Shown' is permanently DISABLED (commands.js:1613) because no comment filter exists. Word disables it too only when unfiltered, so this is acceptable but means the 'Shown' subset feature is entirely missing.
- **Evidence:** commands.js:1261-1263 H.deleteComment first/active; commands.js:1613 'Shown' disabled; 1614-1615 all/resolved loops
- **Edge cases to test:** delete with no comments (button should be disabled); delete active thread vs first; Delete All in Document with replies; Delete All Resolved when none resolved (no-op); 'Shown' item always greyed
- _needsRuntime: true_

### Filter All Markup — DEVIATION · S4
- **Word vs clone:** Word: opens a markup-filter menu (by type and by reviewer) that drives the 'Shown' subset used by Accept/Reject/Delete All Shown. Clone: routes to the SAME Show Markup menu (commands.js:1308 H.filterMarkup=>H.showMarkup) — it is NOT a real filter, so no 'All Changes Shown' subset is ever produced (which is why those menu items stay disabled).
- **Evidence:** commands.js:1305-1308 filterMarkup delegates to showMarkup; comment 'interim routing'
- **Edge cases to test:** click button -> shows the show-markup menu; no actual filtering occurs; interaction with disabled 'All Changes Shown' items
- _needsRuntime: false_

### Hide Ink (dropdown) — DEVIATION · S4
- **Word vs clone:** Word: Hide Ink hides ink annotations; the dropdown appears contextually for ink/pen. Clone: toggles a 'pm-hide-ink' class on #pm-editor (commands.js:1334-1337) over the slice-10 Draw canvas ink layer; the dropdown shows a single 'Hide Ink' item (commands.js:1625). Functional as a CSS toggle but is a button-styled-as-dropdown and only affects the in-app draw layer, not imported w:ink.
- **Evidence:** commands.js:1334-1337 class toggle; commands.js:1625 single-item dropdown
- **Edge cases to test:** toggle with ink present (hides draw layer); toggle with no ink; imported docx ink (w:ink) — does the class affect it?; toggle twice; export with ink hidden (does it persist?)
- _needsRuntime: true_

### New Comment keyboard (Ctrl+Alt+M) + Track Changes (Ctrl+Shift+E) shortcuts — DEVIATION · S4
- **Word vs clone:** Declared shortcuts in ribbon-data (F7 Editor, Shift+F7 Thesaurus, Ctrl+Alt+M comment, Ctrl+Alt+Space Read Aloud, Ctrl+Shift+E Track Changes). These are tooltip strings only; whether app.js actually binds each chord to the handler is not verifiable from ribbon-data and must be runtime-checked (only Ctrl+Enter page-break chord was seen referenced in comments-ui.ts).
- **Evidence:** ribbon-data.js:2112,2133,2156,2222,2343 shortcut strings; binding not located in this audit
- **Edge cases to test:** press F7 (opens Editor pane?); Shift+F7 (Thesaurus); Ctrl+Alt+M (New Comment / compose); Ctrl+Alt+Space (Read Aloud toggle); Ctrl+Shift+E (Track Changes toggle, respects lock)
- _needsRuntime: true_

### Reviewing Pane (split: Vertical/Horizontal) — DEVIATION · S4
- **Word vs clone:** Word: dockable pane listing every revision+comment with a summary count header; the main button toggles last orientation, split picks V/H. Clone: H.reviewingPane toggles TrackChrome pane (commands.js:1313); split items call TrackChrome.showPane('vertical'|'horizontal') (commands.js:1619-1621). Functional via track-chrome.ts (not read here) but the V/H distinction and the Word 'Summary: N revisions' header should be verified at runtime.
- **Evidence:** commands.js:1313 togglePane; 1619-1621 showPane V/H; depends on WC.TrackChrome existing
- **Edge cases to test:** open Vertical vs Horizontal; summary count matches actual revisions; click an entry navigates to the change (review.ts pos); pane with comments + changes merged order (review.ts:237-253); toggle main button reuses last orientation; empty document (no revisions) header text
- _needsRuntime: true_

### Translate (dropdown: Selection/Document/Preferences) — STUB · S4
- **Word vs clone:** Word: Microsoft Translator translates selection inline or whole document into a chosen language, plus a Translator pane. Clone: all three menu items are honest toasts ('Translation needs a cloud translator — not available', commands.js:1209). No language picker, no offline fallback.
- **Evidence:** commands.js:1209 three flyItems all toast NOT_IMPLEMENTED
- **Edge cases to test:** Translate Selection with text selected; Translate Document; Translator Preferences
- _needsRuntime: false_

### New Comment — match
- **Word vs clone:** Word: inserts a modern comment anchored to selection (or expands caret to word) and opens the composer card. Clone: WC.CommentsUI.compose (comments-ui.ts:158) opens a Word-style composer at the caret; posting drives bridge addComment via the Document API, which expands a collapsed caret to the containing word (review.ts:269-306). Faithful. Minor: if caret is not in/adjacent to a word, post is refused with a toast (comments-ui.ts:185) — Word would still create an empty-range point comment.
- **Evidence:** commands.js:368 H.newComment->CommentsUI.compose; review.ts:296-306 addComment via doc API; comments-ui.ts:170-188 composerPost
- **Edge cases to test:** caret in word -> anchors word; caret in empty paragraph -> post refused (Word allows point comment); selection across paragraphs; comment inside table cell; Ctrl+Alt+M shortcut; post then export+reopen (entity-store survival); comment anchor after editing surrounding text
- _needsRuntime: true_

### Previous / Next Change — match
- **Word vs clone:** Word: jump to prev/next tracked change. Clone: prevChange/nextChange walk changeRanges in doc order with wrap (review.ts:405-419, commands.js:1321-1322). Group-split from comment nav (A4). Matches; note nextChange wraps to first at end (Word also cycles).
- **Evidence:** commands.js:1321-1322; review.ts:405-419 range walk with wrap
- **Edge cases to test:** no changes (returns false; Word greys); single change wraps to itself; caret between two changes; contiguous same-id range treated as one (review.ts:151-160); wrap at document end; format-only change navigation
- _needsRuntime: true_

### Previous / Next Comment — match
- **Word vs clone:** Word: jump to prev/next comment anchor, wrapping. Clone: bridge prevComment/nextComment walk comment anchors in doc order with wrap and set the active thread so cards follow (review.ts:421-439). Group-split from change nav (correct, A4). Matches.
- **Evidence:** commands.js:1264-1265; review.ts:421-439 anchor walk + setActiveComment
- **Edge cases to test:** no comments (returns false; Word greys button); single comment (wrap to itself); caret between two comments; resolved comments included? (commentAnchors includes commentRangeStart, review.ts:195); next from end wraps to first
- _needsRuntime: true_

### Show Comments (dropdown: Contextual / List) — match
- **Word vs clone:** Word: toggles between contextual margin cards and the Comments list pane. Clone: H.showComments latches WC.commentsViewMode (commands.js:1269-1274) which is promoted to an accessor (comments-ui.ts:536-540) that re-renders the overlay vs the right-dock list pane. Faithful.
- **Evidence:** commands.js:1269-1274 latch; comments-ui.ts:491-507 list pane render
- **Edge cases to test:** switch Contextual<->List with comments present; List pane New button; List pane filter button (disabled, comments-ui.ts:418); collapse pane; close pane reverts to contextual (comments-ui.ts:404); check-mark reflects current mode
- _needsRuntime: true_

### Block Authors — STUB · S5
- **Word vs clone:** Word: blocks other co-authors from editing a selection (SharePoint/OneDrive shared docs). Clone: honest toast 'Block Authors requires cloud co-authoring — not available' (commands.js:1330). Expected deferral (cloud feature).
- **Evidence:** commands.js:1330 toast NOT_IMPLEMENTED
- **Edge cases to test:** click with selection (toast); click with no selection (toast)
- _needsRuntime: false_

### Linked Notes / OneNote — GAP · S5
- **Word vs clone:** Word (some builds) has a OneNote Linked Notes button. NOT present in the clone's Review ribbon-data at all (no control emitted) — neither stub nor toast. Expected omission (OneNote integration).
- **Evidence:** ribbon-data.js review groups (2098-2454) contain no linked-notes/onenote control
- **Edge cases to test:** n/a — control absent
- _needsRuntime: false_

---

## View + File/Backstage  
_63 controls audited_

### File ▸ Close — BUG · S2
- **Word vs clone:** Word: Close closes the current document (prompts to save) and shows the Backstage/start screen, leaving the window open WITHOUT a document. Clone: rail 'close' calls Files.newDoc() — i.e. it CREATES A NEW BLANK doc instead of closing; the close prompt is the new-doc discard prompt, and you can never end up document-less.
- **Evidence:** backstage.js:48 if pane==='close' WC.Files.newDoc(); files.js:53 newDoc creates blank
- **Edge cases to test:** Close on dirty doc (prompts, then blanks not closes); Close then expect empty shell (instead get Document1); Close vs Ctrl+W
- _needsRuntime: true_

### View ▸ Views ▸ Outline — BUG · S2
- **Word vs clone:** Word: true Outline view with Outlining contextual tab (promote/demote, collapse, move up/down, show level). Clone: setView('outline') only adds #workarea.view-outline whose CSS again targets dead '#editor' (no #pm-editor twin) → no visual outline; NO Outlining tab appears; AND it wrongly sets StatusBar active view to 'print'. Toast 'Outline view'.
- **Evidence:** commands.js:1340 setView('outline')+setActiveView('print')+toast; editor.css:343-350 view-outline rules on '#editor' only; no Outlining ribbon tab in ribbon-data.js
- **Edge cases to test:** enter Outline with H1/H2/H3 doc (no indent/bullets render); look for Outlining tab (absent); status bar shows Print not Outline; promote/demote (unavailable)
- _needsRuntime: true_

### File ▸ Export ▸ Create PDF/XPS — DEVIATION · S2
- **Word vs clone:** Word: PDF/XPS export with Optimize (Standard/Minimum), Options (range, tagged PDF, bookmarks from headings, ISO PDF/A). Clone: pane_export 'Create PDF/XPS' → exportPdf → printToPDF Letter, margins:none, printBackground — NO options, hardcoded Letter (ignores actual A4/Legal/landscape page setup), no tagging/bookmarks, no XPS.
- **Evidence:** backstage.js:138 pane_export pdf action→Files.exportPdf; main.js:440 exportPdf pageSize:'Letter' margins:'none' hardcoded
- **Edge cases to test:** export A4 doc (forced to Letter!); landscape doc (orientation ignored); export with headers/footers; tagged/bookmarked PDF (absent); XPS (absent); range (absent)
- _needsRuntime: true_

### File ▸ Info — DEVIATION · S2
- **Word vs clone:** Word Info: Protect Document, Check for Issues (Inspect/Accessibility/Compatibility), Manage Document/Versions, full Properties (Size/Pages/Words/Editing Time/Title/Tags/Comments + Advanced), Related Dates/People. Clone: pane_info shows ONLY Name/Location/Format/Words/Pages as static text plus a note that Protect/Inspect/Version are 'not implemented' — none of those buttons are clickable.
- **Evidence:** backstage.js:102 pane_info rows=[Name,Location,Format,Words,Pages] + plain disclaimer text; protect/inspect not wired
- **Edge cases to test:** Protect Document (absent); Inspect Document (absent); editing time (absent); tags/title editable (absent); Show All Properties (absent)
- _needsRuntime: false_

### File ▸ Open ▸ Browse — DEVIATION · S2
- **Word vs clone:** Word Open opens: docx/doc/docm/dotx/rtf/odt/txt/htm/xml/wps/mht/pdf etc. Clone: native picker filters to docx/html/htm/txt/csv/tsv only — DOC, RTF, ODT, MHT, DOTX, XML, PDF are NOT openable (selecting 'All Files' + a .doc/.rtf/.odt yields 'Unsupported file type on the new engine').
- **Evidence:** main.js:368-380 openBytes filters [docx,html,htm,txt,csv,tsv]; files.js:74 else→toast 'Unsupported file type'
- **Edge cases to test:** open .doc (unsupported); open .rtf (unsupported); open .odt (unsupported); open .csv (imports as TABLE, path nulled); open extensionless file; open corrupt docx (error toast + blank guard)
- _needsRuntime: true_

### File ▸ Options — DEVIATION · S2
- **Word vs clone:** Word Options: multi-tab dialog (General/Display/Proofing/Save/Language/Accessibility/Advanced/Customize Ribbon/QAT/Add-ins/Trust Center) with hundreds of live settings. Clone: pane_options shows a READ-ONLY summary table (Theme/Default font/Page size/Margins/Engine) + a note that the full dialog is 'not implemented'; none of the 12 ribbon-data option tabs are interactive.
- **Evidence:** backstage.js:164 pane_options static info-props rows + disclaimer; ribbon-data options.* (general…trust-center) not wired
- **Edge cases to test:** change default font (read-only); AutoCorrect options (absent); AutoRecover interval (absent); Customize Ribbon (absent); every Options tab inert
- _needsRuntime: false_

### File ▸ Print ▸ Print button — DEVIATION · S2
- **Word vs clone:** Word Print: applies all the print settings (copies, range, duplex, collation, pages-per-sheet) to the OS print job and renders Word's paginated output. Clone: pane_print's settings controls (Copies/Printer/Pages/Orientation/Paper) are INERT decorative inputs — Print button calls wordAPI.print() which just webContents.print({printBackground:true}) with NO options passed; the on-screen settings are ignored.
- **Evidence:** backstage.js:113 pane_print builds inert inputs; printBtn→Files.print(); main.js:460 doc:print = webContents.print({printBackground:true}) ignores settings
- **Edge cases to test:** set Copies=3 then print (ignored); page range (ignored); landscape setting (ignored); cancel print dialog; print a multi-page doc
- _needsRuntime: true_

### File ▸ Save As ▸ Save as type — DEVIATION · S2
- **Word vs clone:** Word Save As type list: docx, doc, dotx, pdf, rtf, odt, txt, htm, xml, mht, etc. Clone: native Save dialog filters to docx/html/txt ONLY; ribbon-data advertises .doc/.pdf/.rtf/.odt/.dotx but askSavePath cannot produce them; any other typed ext → 'Unsupported save format' toast. PDF only via Export, not Save As.
- **Evidence:** main.js:404-412 askSavePath filters [docx,html,txt]; files.js:118 saveAs handles html/txt/docx else toast 'Unsupported save format'
- **Edge cases to test:** choose .doc (unavailable); type foo.pdf manually (rejected); type foo.csv (rejected, no docx-zip into csv); save as .dotx (unsupported); html save fidelity vs Word .htm; odt (unsupported)
- _needsRuntime: true_

### File ▸ Info ▸ Protect Document — GAP · S2
- **Word vs clone:** Word: Mark as Final, Encrypt with Password, Restrict Editing, Restrict Access, Add Digital Signature, Always Open Read-Only. Clone: ribbon-data lists all 6 but pane_info renders no Protect dropdown; (note: Restrict Editing exists only on Review tab, out of this area).
- **Evidence:** ribbon-data.js info.protect-document items; backstage.js pane_info has no protect control
- **Edge cases to test:** Mark as Final (absent); Encrypt (absent)
- _needsRuntime: false_

### View ▸ Views ▸ Draft — BUG · S3
- **Word vs clone:** Word: Draft view hides headers/footers/floating images, continuous text, fast typing, page-break dotted line. Clone: setView('draft') adds #workarea.view-draft but its CSS targets dead '#editor' (no #pm-editor twin) → no change in PM app. Toast 'Draft view'.
- **Evidence:** commands.js:1341; editor.css:339-340 view-draft on '#editor' only
- **Edge cases to test:** Draft view with floating image (should hide → won't); Draft typing; toggle back to Print; header/footer visibility
- _needsRuntime: true_

### View ▸ Views ▸ Web Layout — BUG · S3
- **Word vs clone:** Word: text reflows to window width, no page edges, images positioned as browser. Clone: setView('web') toggles #workarea.view-web, but ALL view-web CSS targets the RETIRED legacy '#editor' element — there is no #pm-editor twin — so in the live PM-only app NOTHING visually changes (page sheet, ruler, shadows all stay).
- **Evidence:** editor.css:326-328 '#workarea.view-web #editor{...}' targets #editor; grep finds NO 'pm-active … view-web … #pm-editor' twin (only show-grid/show-marks at css:527-528 were ported)
- **Edge cases to test:** switch to Web Layout and observe (no change expected → bug); Web Layout then type; Web Layout + wide window; save+reopen view setting
- _needsRuntime: true_

### File ▸ Export ▸ Change File Type — DEVIATION · S3
- **Word vs clone:** Word: gallery of types (docx/doc/odt/dotx/txt/rtf/mht) with single-click Save As. Clone: pane_export 'Change File Type' just calls Files.saveAs() (the docx/html/txt picker) — no type gallery; advertised .doc/.odt/.dotx/.rtf/.mht unreachable.
- **Evidence:** backstage.js:146 docx action→Files.saveAs(); ribbon-data export.change-file-type lists 7 types
- **Edge cases to test:** pick .doc (unreachable); pick .rtf (unreachable); only docx/html/txt land
- _needsRuntime: false_

### File ▸ New ▸ Blank + Templates — DEVIATION · S3
- **Word vs clone:** Word New: large online template catalog, search, suggested-search chips, preview-then-Create dialog. Clone: pane_new = Blank + same 4 hardcoded local HTML templates inserted via openHtml; no search box, no chips, no preview dialog. Templates open as UNSAVED docx (path=null).
- **Evidence:** backstage.js:82 pane_new; useTemplate(t) openHtml(t.content) path=null
- **Edge cases to test:** create from template then Save (routes Save As); confirmDiscard on dirty doc; template fidelity vs Word's; search chips (absent)
- _needsRuntime: true_

### File ▸ Print ▸ Print preview pane — DEVIATION · S3
- **Word vs clone:** Word: accurate paginated WYSIWYG preview with page navigation + zoom slider matching final output. Clone: a single .sheet div with getHTML() dumped in — continuous (not paginated), no page nav, no zoom slider, won't match printed pages.
- **Evidence:** backstage.js:130 preview .sheet.innerHTML = WC.PM.getHTML() (single continuous block); ribbon-data page-navigation+zoom-slider declared but absent
- **Edge cases to test:** multi-page doc preview (no page breaks); preview vs actual print output; page nav (absent); zoom slider (absent)
- _needsRuntime: true_

### File ▸ Save As ▸ html/txt fidelity — DEVIATION · S3
- **Word vs clone:** Word .htm: full MSO-namespaced HTML + filelist; Word .txt: encoding dialog. Clone: html = DOMPurify-light wrapHtml(getHTML()) wrapper; txt = getText() with no encoding/line-ending dialog. Round-trips lossy vs Word.
- **Evidence:** files.js:27 wrapHtml; files.js:128/131 saveTextFile html/text; no encoding dialog
- **Edge cases to test:** save html with image (data-uri vs filelist); txt with unicode (no encoding choice); reopen saved html; CRLF vs LF
- _needsRuntime: true_

### View ▸ Immersive ▸ Immersive Reader — DEVIATION · S3
- **Word vs clone:** Word: full Immersive Reader (Column Width, Page Color, Text Spacing, Syllables, Parts of Speech, Line Focus, Picture Dictionary, Read Aloud, language). Clone: a minimal overlay from a STATIC innerHTML snapshot with only A−/A+, Sepia, Dark, Read Aloud, Close — no syllables/line-focus/parts-of-speech/column-width, content frozen.
- **Evidence:** commands.js:1357 immersiveReader() builds #immersive overlay; buttons A−/A+/Sepia/Dark/Read Aloud/Close only
- **Edge cases to test:** open then edit doc (stale snapshot); A+ past max (clamped 40); Dark then Sepia; Read Aloud from inside; toggle twice
- _needsRuntime: true_

### View ▸ Page Movement ▸ Side to Side — DEVIATION · S3
- **Word vs clone:** Word: horizontal page-flip with thumbnail navigation, page-snap. Clone: adds #workarea.movement-side which uses CSS columns on '#editor' (editor.css:388 '#workarea.movement-side #editor{columns…}') — that targets the RETIRED editor; #canvas/#pages flex-row rules apply but the per-page column splitting on #pm-editor is absent, so it scrolls horizontally without true page paging.
- **Evidence:** commands.js:1344; editor.css:386-390 movement-side: #canvas/#pages generic OK but #editor columns rule dead for PM
- **Edge cases to test:** enable Side to Side on multi-page doc (no page columns); scroll snap; notes-area reflow (css:567); switch back to Vertical; caret position after toggle
- _needsRuntime: true_

### View ▸ SharePoint ▸ Properties — DEVIATION · S3
- **Word vs clone:** Word: this group only appears for SharePoint-hosted files and edits server document properties. Clone: group always present; H.properties opens a local Properties dialog (Title/Author/Words/Chars/Paras/Pages/Lines) — Author hardcoded 'Word User', Title derived from filename; does NOT read/write docx core.xml metadata.
- **Evidence:** commands.js:1347,1412 propertiesDialog() rows hardcode Author 'Word User'; reads WC.PM.counts(); no core.xml binding
- **Edge cases to test:** open doc with real dc:creator (ignored); edit Title (read-only, no save); Author always 'Word User'; group should be hidden for non-SharePoint
- _needsRuntime: true_

### View ▸ Show ▸ Navigation Pane — DEVIATION · S3
- **Word vs clone:** Word: Navigation pane with Headings / Pages (thumbnails) / Results (search) tabs, drag-to-reorder headings, live search. Clone: a left taskpane listing h1/h2/h3 with click-to-scroll only — NO Pages thumbnails, NO Results/search tab, NO drag-reorder; checkbox doesn't reflect open state (toggles pane each call).
- **Evidence:** dialogs.js:297 D.navPane lists h1,h2,h3 click-scroll; no tabs/thumbnails/search; commands.js:434 routes here
- **Edge cases to test:** doc with no headings (placeholder text); click heading scroll; Pages tab (absent); search tab (absent); checkbox active state; reorder heading (unsupported)
- _needsRuntime: true_

### View ▸ Views ▸ Print Layout — DEVIATION · S3
- **Word vs clone:** Word: default paginated view; the three view buttons are a radio group that shows the active one. Clone: setView('print') adds #workarea.view-print but the ribbon button is a plain non-toggle button (never shows active), and it does NOT call StatusBar.setActiveView so the status-bar view chip desyncs from the ribbon.
- **Evidence:** commands.js:420 H.printLayout=()=>WC.PM.setView('print') (no setActiveView); ribbon-data type 'button'; statusbar.js:31 status-bar path DOES call setActiveView
- **Edge cases to test:** switch print→web→print and watch status-bar chip; click ribbon Print Layout while status bar shows Web; after Read Mode
- _needsRuntime: false_

### View ▸ Views ▸ Read Mode — DEVIATION · S3
- **Word vs clone:** Word: dedicated reflow Read Mode with column layout, object zoom, Read Mode-only tools (Resume Reading, Translate, Define, Comments). Clone: builds an overlay (#read-mode) from a STATIC innerHTML snapshot of #pm-editor with ‹/› screen scroll and a File/Tools/View menu; content is frozen (no live edit, no reflow-to-page).
- **Evidence:** commands.js:1378 readMode(); content.innerHTML = #pm-editor.innerHTML, contenteditable stripped; toolbar menus File/Tools/View; CSS #read-mode overlay
- **Edge cases to test:** open Read Mode then edit underlying doc (snapshot stale); Read Mode with images/tables; Esc to exit; toggle Read Mode twice; Read Mode then Find (closes overlay); Column Width Wide toggle; reopen after doc change
- _needsRuntime: true_

### View ▸ Zoom ▸ Multiple Pages — DEVIATION · S3
- **Word vs clone:** Word: shows two-or-more pages side by side, picker grid. Clone: fitZoom(2) just halves the One-Page height fit (zoom to fit 2 page-heights) — does not arrange pages in a 2-up grid, no page-count picker.
- **Evidence:** commands.js:424 H.multiplePages=()=>setZoom(fitZoom(2)) (height/(pageH*2))
- **Edge cases to test:** single-page doc (over-shrinks); actual side-by-side arrangement (absent); picker grid (absent)
- _needsRuntime: true_

### View ▸ Zoom ▸ One Page — DEVIATION · S3
- **Word vs clone:** Word: fits exactly one whole page in window. Clone: fitZoom(1) = (canvas.clientHeight-40)/pageH where pageH falls back to 1056 — approximate; uses canvas height only (ignores width), so a tall narrow window can clip page sides.
- **Evidence:** commands.js:423,2085 fitZoom uses clientHeight/(pageH*pages), pageH default 1056
- **Edge cases to test:** narrow tall window (sides clip); very short window (min 0.2 clamp); multi-page doc; after orientation change
- _needsRuntime: true_

### View ▸ Zoom ▸ Zoom (dialog) — DEVIATION · S3
- **Word vs clone:** Word Zoom dialog: 200/100/75/Page width/Text width/Whole page/Many pages + custom % spinner + live preview thumbnail. Clone: radios for 200%/100%/75%/Page width/Whole page only — no custom percent box, no Text width, no Many pages, no preview.
- **Evidence:** dialogs.js:278 D.zoom levels=[200,100,75,'pw','wp']; OK applies setZoom; no percent input/preview
- **Edge cases to test:** custom % (missing); Page width on wide window; Whole page uses pageH 1056; Cancel keeps zoom; apply then status-bar % sync
- _needsRuntime: false_

### View ▸ Window ▸ Split — STUB · S3
- **Word vs clone:** Word: splits the window into two independently-scrollable panes of the same doc with a draggable splitter and Remove Split. Clone: toggles #app.split-view which only draws a double-line top border on #canvas (editor.css:413) — NO second pane, NO independent scroll, NO splitter. Cosmetic only.
- **Evidence:** commands.js:1346 toggle #app.split-view + toast; editor.css:413 split-view only adds border-top
- **Edge cases to test:** toggle Split (just a border); scroll (single pane); Remove Split (re-toggle)
- _needsRuntime: true_

### File ▸ Info ▸ Check for Issues / Inspect — GAP · S3
- **Word vs clone:** Word: Document Inspector (strip metadata/comments), Accessibility Checker, Compatibility Checker. Clone: declared feasible 'partial' in ribbon-data but no UI rendered.
- **Evidence:** ribbon-data.js info.check-for-issues; backstage.js pane_info text-only
- **Edge cases to test:** Inspect (absent); Accessibility (absent)
- _needsRuntime: false_

### File ▸ Print ▸ Settings (copies/printer/range/duplex/collation/paper/margins/pages-per-sheet) — GAP · S3
- **Word vs clone:** Word: each setting is live and affects the job. Clone: ribbon-data declares the full set, but pane_print only renders Copies/Printer/Pages/Orientation/Paper as DEAD inputs (no duplex, collation, margins, pages-per-sheet at all) and none feed the print call.
- **Evidence:** backstage.js:120-124 only 5 prow() inert controls; no duplex/collation/pages-per-sheet; main.js print ignores all
- **Edge cases to test:** duplex (absent); collation (absent); pages per sheet (absent); custom range (inert)
- _needsRuntime: false_

### File ▸ Save — match
- **Word vs clone:** Word: saves to current path silently, or Save As if never saved. Clone: Files.save() saves docx via exportDocxBytes / html / text by tracked format; routes to saveAs when path null; csv-opened docs have path nulled so Save→Save As (intentional). Toast on success/fail; dirty dot stays on fail.
- **Evidence:** files.js:99 save(); format gate docx|html|text; backstage.js:46 'save' pane closes + Files.save()
- **Edge cases to test:** save new doc (→Save As); save imported csv (→Save As); save html-opened doc (writes .html, not docx!); save fails mid-write (dirty stays); Ctrl+S after open
- _needsRuntime: true_

### File ▸ Account — DEVIATION · S4
- **Word vs clone:** Word Account: user identity, photo, sign-in/out, Office Background, Office Theme (Colorful/Dark Gray/Black/White/System), Connected Services, About/version/license. Clone: pane_account shows a static 'Word User / Local account' avatar + a product blurb — NO Office Theme picker, NO Office Background, NO About dialog, NO sign-in, despite ribbon-data marking Theme/Background feasible 'yes'.
- **Evidence:** backstage.js:154 pane_account static avatar+blurb; no theme/background/about controls; ribbon-data account.office-theme/background feasible:yes but absent
- **Edge cases to test:** change Office Theme (absent); Dark theme (app stays light); About Word version (absent); sign in (absent)
- _needsRuntime: false_

### File ▸ Home (backstage) — DEVIATION · S4
- **Word vs clone:** Word Home: greeting, New row (blank + templates), Recent with pinned, Shared with Me, search box. Clone: pane_home shows greeting (morning/afternoon/evening), Blank + 4 local templates (Resume/Cover Letter/Report/Letter), Recent list — NO pinned, NO Shared, NO online template search; ribbon-data lists 7 home actions but only blank+templates+recent exist.
- **Evidence:** backstage.js:55 pane_home; TEMPLATES has 4 entries; ribbon-data backstage Home has pinned/shared/search marked feasible but unimplemented
- **Edge cases to test:** no recent files (empty msg); pin a doc (unsupported); template card click; greeting time-of-day
- _needsRuntime: false_

### File ▸ Open ▸ Recent — DEVIATION · S4
- **Word vs clone:** Word: Recent docs + folders, pin, right-click context (copy path, remove), Shared with Me. Clone: recentList shows name/path/timeAgo, click-to-open; NO pinning, NO folders, NO context menu, NO Shared with Me.
- **Evidence:** backstage.js:196 recentList via window.wordAPI.recent.list(); click→Files.open(path)
- **Edge cases to test:** recent file moved/deleted (open error); pin (absent); clear recent (absent); timeAgo formatting
- _needsRuntime: true_

### Help ▸ Feedback (→ Backstage Feedback) — DEVIATION · S4
- **Word vs clone:** Word: opens Feedback in Backstage that submits to Microsoft. Clone: H.feedback opens Backstage 'feedback' pane with 3 textarea cards (Like/Don't like/Suggestion); Submit just toasts 'Thanks' and clears — no endpoint.
- **Evidence:** commands.js:1424 H.feedback=()=>WC.Backstage.open('feedback'); backstage.js:66 pane_feedback Submit→WC.toast
- **Edge cases to test:** submit empty; submit then reopen (cleared)
- _needsRuntime: false_

### View ▸ Show ▸ Gridlines — DEVIATION · S4
- **Word vs clone:** Word: layout gridlines (non-printing) across the page, checkbox reflects state. Clone: toggles #pm-editor.show-grid (this ONE was twin-ported to pm-active, css:528) plus markChecked. Works visually, but grid is 24px CSS lines not Word's snap grid; same desync risk between .toggled and .show-grid.
- **Evidence:** commands.js:428-433 toggle #pm-editor.show-grid + markChecked; editor.css:528 body.pm-active #pm-editor.show-grid
- **Edge cases to test:** toggle twice; grid vs object snap (no snap); grid + zoom; print (should not show)
- _needsRuntime: true_

### View ▸ Show ▸ Ruler — DEVIATION · S4
- **Word vs clone:** Word: checkbox reflects ruler state; ruler default ON in Print Layout. Clone: toggles #ruler.hidden-ruler AND independently toggles node.toggled — the .toggled checkmark and the actual ruler visibility are tracked separately, so they can desync (e.g. if ruler started hidden). No persistence.
- **Evidence:** commands.js:427 H.ruler toggles '#ruler' hidden-ruler then markChecked(node) toggles node class independently; editor.css:24 #ruler.hidden-ruler{display:none}
- **Edge cases to test:** toggle twice (checkmark vs ruler sync); initial state vs checkmark; ruler in focus mode (force-hidden) then untoggle; save+reopen
- _needsRuntime: true_

### View ▸ Window ▸ Switch Windows — STUB · S4
- **Word vs clone:** Word: dropdown lists every open document, ✓ on current, click to activate. Clone: flyout with a single hardcoded '✓ 1  Document1 - Word' that does nothing on click; never reflects the real file name.
- **Evidence:** commands.js:1353 H.switchWindows flyItem('✓ 1  Document1 - Word', onClick:()=>{})
- **Edge cases to test:** open after renaming doc (still says Document1); click item (no-op)
- _needsRuntime: false_

### File ▸ Open ▸ Recover Unsaved Documents — GAP · S4
- **Word vs clone:** Word: opens AutoRecover/UnsavedFiles folder. Clone: listed in ribbon-data but no button rendered in pane_open and no autosave store exists.
- **Evidence:** ribbon-data.js open.recover-unsaved-documents; backstage.js pane_open has only Browse+Recent
- **Edge cases to test:** not rendered
- _needsRuntime: false_

### View ▸ Macros ▸ Macros — GAP · S4
- **Word vs clone:** Word: View Macros dialog (run/edit/create/delete), Record Macro, Pause Recording — full VBA. Clone: flyout View Macros / Record Macro… both toast 'VBA not supported (no VBA runtime)'.
- **Evidence:** commands.js:1354 H.macros flyout → toasts
- **Edge cases to test:** View Macros (toast); Record Macro (toast); Alt+F8 shortcut
- _needsRuntime: false_

### View ▸ Window ▸ New Window — GAP · S4
- **Word vs clone:** Word: opens a second window onto the SAME document (Document:2). Clone: toast 'multi-window not supported in this single-window clone'.
- **Evidence:** commands.js:1348 H.newWindow=()=>WC.toast(...not supported)
- **Edge cases to test:** click (toast only)
- _needsRuntime: false_

### View ▸ Immersive ▸ Focus — match
- **Word vs clone:** Word: hides ribbon/status/UI, dark background, content centered, Esc to exit. Clone: toggles #app.focus-mode; CSS hides titlebar/tabstrip/ribbon/statusbar/ruler and darkens workarea with an 'Press Esc to exit' hint. Targets generic #app so it works in PM. Close: bare Esc bubble handler.
- **Evidence:** commands.js:435 toggle #app.focus-mode; editor.css:375-382 focus-mode rules on #app/#titlebar/#workarea (generic, not #editor)
- **Edge cases to test:** toggle Focus on/off; Esc to exit; Focus while a flyout open; ribbon hidden + keyboard shortcuts still work; Focus then open backstage
- _needsRuntime: true_

### View ▸ Page Movement ▸ Vertical — match
- **Word vs clone:** Word: default vertical scroll. Clone: removes #workarea.movement-side, marks radio. CSS for the default (no movement-side) is the normal column layout, so this works.
- **Evidence:** commands.js:1343 remove movement-side + markRadio(node,'sideToSide')
- **Edge cases to test:** toggle from Side-to-Side back to Vertical; radio state both buttons; with notes area present
- _needsRuntime: false_

### View ▸ Zoom ▸ Page Width — match
- **Word vs clone:** Word: zoom so page width fills window. Clone: fitWidthZoom = (canvas.clientWidth-40)/page-w (CSS var or 816). Reasonable parity though the 40px fudge and var fallback may differ a few %.
- **Evidence:** commands.js:425,2086 fitWidthZoom uses --page-w or 816
- **Edge cases to test:** A4 vs Letter width; landscape; margin var changes; resize window then re-click
- _needsRuntime: true_

### File ▸ New ▸ Search online templates — GAP · S5
- **Word vs clone:** Word: searches Office.com template service. Clone: declared in ribbon-data (feasible 'partial') but pane_new renders no search box at all.
- **Evidence:** ribbon-data.js new.search-online-templates-box; backstage.js pane_new has no search input
- **Edge cases to test:** no UI present
- _needsRuntime: false_

### File ▸ Open ▸ OneDrive / Add a Place / Shared — GAP · S5
- **Word vs clone:** Word: cloud locations, add storage service, Shared with Me. Clone: declared in ribbon-data but pane_open only renders Browse + Recent; cloud entries absent (expected deferral — no backend).
- **Evidence:** ribbon-data.js open.onedrive/add-a-place/shared-with-me; backstage.js pane_open omits them
- **Edge cases to test:** none rendered
- _needsRuntime: false_

### File ▸ Share — GAP · S5
- **Word vs clone:** Word: Share with People (cloud co-author), Copy Link, Email (attachment/link/PDF/XPS), Present Online. Clone: rail click 'share' immediately toasts 'Sharing requires a cloud backend — not implemented'; no pane, even Email-as-attachment (locally feasible) is absent.
- **Evidence:** backstage.js:49 if pane==='share' toast + return (no pane_share)
- **Edge cases to test:** click Share (toast only); Email as attachment (feasible but absent)
- _needsRuntime: false_

### File ▸ Transform (Sway) — GAP · S5
- **Word vs clone:** Word: Transform to Web Page via Sway. Clone: ribbon-data feasible 'no'; rail has no 'transform' entry, paneGeneric would show 'not implemented'. Expected deferral.
- **Evidence:** ribbon-data.js transform.transform-to-web-page-sway feasible:no; backstage rail omits transform
- **Edge cases to test:** unreachable from rail
- _needsRuntime: false_

### View ▸ Window ▸ Arrange All — GAP · S5
- **Word vs clone:** Word: tiles all open document windows. Clone: toast 'needs multiple windows — not supported'.
- **Evidence:** commands.js:1349 H.arrangeAll toast
- **Edge cases to test:** click (toast only)
- _needsRuntime: false_

### View ▸ Window ▸ Reset Window Position — GAP · S5
- **Word vs clone:** Word: equalizes side-by-side window split. Clone: toast 'not applicable'.
- **Evidence:** commands.js:1352 H.resetWindowPosition toast
- **Edge cases to test:** click (toast)
- _needsRuntime: false_

### View ▸ Window ▸ Synchronous Scrolling — GAP · S5
- **Word vs clone:** Word: scrolls two side-by-side docs together. Clone: toast 'pairs two windows — not supported'.
- **Evidence:** commands.js:1351 H.synchronousScrolling toast
- **Edge cases to test:** click (toast)
- _needsRuntime: false_

### View ▸ Window ▸ View Side by Side — GAP · S5
- **Word vs clone:** Word: tiles two open docs for comparison; enables Sync Scrolling. Clone: toast 'needs a second open document — not supported'. Toggle never visually toggles.
- **Evidence:** commands.js:1350 H.viewSideBySide toast
- **Edge cases to test:** click (toast); toggle state never set
- _needsRuntime: false_

### View ▸ Zoom ▸ 100% — match
- **Word vs clone:** Word: resets to 100%. Clone: H['100'] (and H.zoom100) call setZoom(1); status bar updates. Note the cmd id is literally '100' and handler keyed H['100'] — matches.
- **Evidence:** commands.js:1345 H['100']=()=>WC.PM.setZoom(1); index.ts:402 setZoom updates StatusBar
- **Edge cases to test:** from 250% to 100%; caret stays visible after zoom; repaginate fires
- _needsRuntime: false_

---

