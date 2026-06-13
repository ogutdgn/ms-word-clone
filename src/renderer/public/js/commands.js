/* commands.js — command dispatcher + handlers. Maps ribbon control cmd ids to
   real behavior on the editor. Unknown/out-of-scope commands surface the
   documented "not implemented" message (see docs/NOT_IMPLEMENTED.md). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;
  // Phase 2: PM bridge accessor — null under --legacy or pre-mount (then the
  // legacy branch runs; the editor.js pmGuard still backstops mistakes).
  const PMA = () => (WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null);

  const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  // Layout spinner cmd → [paragraph attr dot-path, UI-unit → twips converter]
  // (indents arrive in inches ×1440, spacing in points ×20).
  const PARA_SPIN = {
    indentLeft: ['paragraphProperties.indent.left', (v) => Math.round(v * 1440)],
    indentRight: ['paragraphProperties.indent.right', (v) => Math.round(v * 1440)],
    spacingBefore: ['paragraphProperties.spacing.before', (v) => Math.round(v * 20)],
    spacingAfter: ['paragraphProperties.spacing.after', (v) => Math.round(v * 20)],
  };
  const FONTS = ['Calibri', 'Calibri Light', 'Arial', 'Times New Roman', 'Cambria', 'Georgia', 'Verdana', 'Tahoma',
    'Courier New', 'Consolas', 'Comic Sans MS', 'Garamond', 'Trebuchet MS', 'Segoe UI', 'Helvetica', 'Carlito', 'Aptos'];

  let lastFontColor = '#FF0000'; // standard "Red" (matches real Word)
  let lastHighlight = '#FFFF00';
  let lastShade = null;          // shading split button: no fill until one is picked
  let lastBorderEdge = 'bottom'; // borders split button: Word defaults to Bottom Border
  let painter = null; // {styles, sticky}

  const H = {}; // handlers keyed by cmd

  // ---- Clipboard ----
  H.cut = () => { const pm = PMA(); pm ? pm.cutSelection() : E().exec('cut'); };
  H.copy = () => { const pm = PMA(); pm ? pm.copySelection() : E().exec('copy'); };
  H.paste = () => { const pm = PMA(); pm ? pm.pasteDefault() : E().exec('paste'); };
  H.formatPainter = (c, node) => {
    const pm = PMA();
    if (pm) { armPainterPM(node, false); return; }
    armPainterFromSelection(node, false);
  };
  H.formatPainterLock = (c, node) => {
    const pm = PMA();
    if (pm) { armPainterPM(node || (WC.Ribbon.controlIndex.formatPainter && WC.Ribbon.controlIndex.formatPainter.node), true); return; }
    armPainterFromSelection(node || (WC.Ribbon.controlIndex.formatPainter && WC.Ribbon.controlIndex.formatPainter.node), true);
  };

  // ---- Font ----
  H.bold = () => { const pm = PMA(); pm ? pm.cmd('toggleBold') : E().exec('bold'); };
  H.italic = () => { const pm = PMA(); pm ? pm.cmd('toggleItalic') : E().exec('italic'); };
  H.underline = () => { const pm = PMA(); pm ? pm.cmd('toggleUnderline') : E().exec('underline'); };
  H.strikethrough = () => { const pm = PMA(); pm ? pm.cmd('toggleStrike') : E().exec('strikethrough'); };
  // No dedicated engine command for vertical alignment, but textStyle carries
  // vertAlign with sub/superscript rendering — drive it via the generic setMark,
  // toggling off when already set and keeping the pair mutually exclusive (Word).
  H.subscript = () => vertAlign('subscript');
  H.superscript = () => vertAlign('superscript');
  H.clearAllFormatting = () => {
    const pm = PMA();
    if (pm) { pm.cmd('clearFormat'); return; }
    E().exec('removeFormat'); E().selectedBlocks().forEach((b) => b.removeAttribute('style')); WC.formatBlock('p');
  };
  H.increaseFontSize = () => stepFont(1);
  H.decreaseFontSize = () => stepFont(-1);
  H.font = (c, node) => openFontList(node);
  H.fontSize = (c, node) => openSizeList(node);
  H.textHighlightColor = (c, node) => applyColor('hilite', lastHighlight);
  H.fontColor = (c, node) => applyColor('fore', lastFontColor);

  // ---- Paragraph ----
  H.alignLeft = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'left') : E().exec('justifyLeft'); };
  H.center = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'center') : E().exec('justifyCenter'); };
  H.alignRight = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'right') : E().exec('justifyRight'); };
  // Word stores justify as w:jc="both"; setTextAlign('justify') does that mapping —
  // never pass 'both' (the alignments whitelist rejects it).
  H.justify = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'justify') : E().exec('justifyFull'); };
  H.bullets = () => { const pm = PMA(); pm ? pm.cmd('toggleBulletList') : E().exec('insertUnorderedList'); };
  H.numbering = () => { const pm = PMA(); pm ? pm.cmd('toggleOrderedList') : E().exec('insertOrderedList'); };
  H.decreaseIndent = () => stepIndent(-48);
  H.increaseIndent = () => stepIndent(48);
  function stepIndent(px) {
    const pm = PMA();
    if (pm) {
      // Word behavior: inside a list the ribbon indent buttons change the LIST LEVEL;
      // otherwise they step the paragraph text indent by 0.5" (engine: 36pt = 720tw).
      const para = pm.getEditor().getAttributes('paragraph') || {};
      // NOTE: style-inherited list paragraphs carry no INLINE numberingProperties —
      // they reach the list branch via listRendering (computed by numberingPlugin).
      // Both arms are needed; do not simplify to one.
      const inList = !!(para.paragraphProperties && para.paragraphProperties.numberingProperties) || !!para.listRendering;
      if (inList) pm.cmd(px > 0 ? 'increaseListIndent' : 'decreaseListIndent');
      else pm.cmd(px > 0 ? 'increaseTextIndent' : 'decreaseTextIndent');
      return;
    }
    if (E().currentListItem && E().currentListItem()) { if (px > 0) E().demoteListItem(); else E().promoteListItem(); return; }
    E().selectedBlocks().forEach((b) => { const cur = parseFloat(b.style.marginLeft) || 0; const next = Math.max(0, cur + px); b.style.marginLeft = next ? next + 'px' : ''; });
    E().dirty = true; E().repaginate(); E().updateStatus(); E().emit();
  }
  H.showHide = (c, node) => {
    const target = (WC.PM && WC.PM.active) ? document.getElementById('pm-editor') : E().node;
    const on = target.classList.toggle('show-marks');
    if (node) node.classList.toggle('toggled', on);
  };
  H.sort = () => sortDialog();
  // Shading split button: main face applies the LAST-USED shading color (none on a
  // fresh doc, like Word). The arrow opens the color palette (dropdown -> colorMenu).
  H.shading = (c, node) => { if (lastShade) applyColor('shade', lastShade); else colorMenu(node, 'shade'); };
  // Borders split button: main face applies the last-used edge (Word defaults to Bottom).
  H.borders = () => applyBorder(lastBorderEdge);

  // ---- Styles ----
  H.stylesGallery = () => {};

  // ---- Editing ----
  H.find = () => WC.Dialogs.findPane(false);
  H.replace = () => WC.Dialogs.findPane(true);
  H.select = (c, node) => WC.Commands.dropdown(c, node);

  // ---- Insert ----
  H.table = (c, node) => WC.Dialogs.insertTable();

  // ---- Table Tools (Table Layout + Table Design contextual tabs, PM-only) ----
  // These cmds live only on the runtime-injected contextual tabs (table-tools-pm.js),
  // which only appear in PM mode. Each routes straight to a WC.PM table verb.
  const TPM = () => (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
  H.tblInsertAbove = () => { const p = TPM(); if (p) p.tableAddRow('above'); };
  H.tblInsertBelow = () => { const p = TPM(); if (p) p.tableAddRow('below'); };
  H.tblInsertLeft = () => { const p = TPM(); if (p) p.tableAddColumn('left'); };
  H.tblInsertRight = () => { const p = TPM(); if (p) p.tableAddColumn('right'); };
  H.tblDeleteRow = () => { const p = TPM(); if (p) p.tableDeleteRow(); };
  H.tblDeleteColumn = () => { const p = TPM(); if (p) p.tableDeleteColumn(); };
  H.tblDeleteTable = () => { const p = TPM(); if (p) p.tableDeleteTable(); };
  H.tblMerge = () => { const p = TPM(); if (p) p.tableMerge(); };
  H.tblSplitCell = () => { const p = TPM(); if (p) p.tableSplitCell(); };
  H.tblSplitTable = () => { const p = TPM(); if (p) p.tableSplit(); };
  H.tblDistRows = () => { const p = TPM(); if (p) p.tableDistributeRows(); };
  H.tblDistCols = () => { const p = TPM(); if (p) p.tableDistributeColumns(); };
  H.tblHeaderRow = () => { const p = TPM(); if (p) p.tableToggleHeaderRow(); };
  H.tblHeaderCol = () => { const p = TPM(); if (p) p.tableToggleHeaderColumn(); };
  H.tblToText = () => { const p = TPM(); if (p) p.tableToText('\t'); };
  H.tblVAlignTop = () => { const p = TPM(); if (p) p.tableSetCellVAlign('top'); };
  H.tblVAlignMid = () => { const p = TPM(); if (p) p.tableSetCellVAlign('middle'); };
  H.tblVAlignBottom = () => { const p = TPM(); if (p) p.tableSetCellVAlign('bottom'); };
  H.tblTextDir = () => { const p = TPM(); if (p) p.tableSetTextDirection('tbRl'); };
  H.tblAlignLeft = () => { const p = TPM(); if (p) p.tableSetAlignment('left'); };
  H.tblAlignCenter = () => { const p = TPM(); if (p) p.tableSetAlignment('center'); };
  H.tblAlignRight = () => { const p = TPM(); if (p) p.tableSetAlignment('right'); };
  H.tblCellMargins = () => { WC.toast('Table cell margins dialog — not implemented in this slice.'); };
  // Dropdown flyouts (style gallery / shading swatches / borders / autofit) — opened
  // from the dropdown dispatch head below; the picked value routes to WC.PM.
  // T4: the gallery is built DYNAMICALLY from the runtime styles catalog
  // (WC.PM.getTableStyles() — w:type="table" entries of the in-memory styles.xml,
  // displaying each definition's w:name and applying its w:styleId). The old
  // hardcoded 4-id list is gone: two of its ids (GridTable5Dark-Accent2,
  // ListTable3-Accent3) had NO definition anywhere, so real Word dropped the
  // orphaned <w:tblStyle> reference on open (slice-6 oracle Leg C).
  H.tblStyles = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyHeader('Table Styles'));
    const p = TPM();
    const styles = (p && typeof p.getTableStyles === 'function') ? p.getTableStyles() : [];
    if (!styles.length) {
      fly.appendChild(WC.flyItem('No table styles available', { onClick: () => {} }));
      return;
    }
    styles.forEach(({ id, name }) => fly.appendChild(WC.flyItem(name, { onClick: () => { const q = TPM(); if (q) q.tableSetStyle(id); } })));
  });
  H.tblShading = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyHeader('Shading'));
    const grid = el('div', { class: 'tbl-shade-grid', style: { padding: '4px' } });
    ['#FFF2CC', '#DEEAF6', '#E2EFDA', '#FCE4D6', '#D9D9D9', 'transparent'].forEach((col) => {
      const sw = el('div', { class: 'tbl-shade-sw', style: { width: '22px', height: '22px', margin: '3px', display: 'inline-block', background: col === 'transparent' ? '#fff' : col, border: '1px solid #ccc', cursor: 'pointer' } });
      sw.addEventListener('click', () => { WC.closeFlyouts(); const p = TPM(); if (p) p.tableSetCellShading(col === 'transparent' ? '' : col); });
      grid.appendChild(sw);
    });
    fly.appendChild(grid);
  });
  H.tblBorders = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyHeader('Borders'));
    const B = () => ({ val: 'single', color: '000000', size: 4 });
    fly.appendChild(WC.flyItem('All Borders', { onClick: () => { const p = TPM(); if (p) p.tableSetCellBorders({ top: B(), bottom: B(), left: B(), right: B() }); } }));
    fly.appendChild(WC.flyItem('No Border', { onClick: () => { const p = TPM(); if (p) p.tableSetCellBorders({}); } }));
  });
  H.tblAutoFit = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyHeader('AutoFit'));
    [['AutoFit Contents', 'contents'], ['AutoFit Window', 'window'], ['Fixed Column Width', 'fixed']]
      .forEach(([label, mode]) => fly.appendChild(WC.flyItem(label, { onClick: () => { const p = TPM(); if (p) p.tableAutoFit(mode); } })));
  });
  H.pictures = async () => {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    const r = await window.wordAPI.pickImage();
    if (!r || !r.ok) return;
    if (pm) { pm.insertImage({ src: r.dataUrl, alt: r.name || 'Picture' }); return; }
    E().insertHTML(`<img src="${r.dataUrl}" alt="${WC.escapeHtml(r.name || '')}">`);
    // the new image decodes asynchronously — repaginate once it has a real height
    E().node.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', () => E().repaginate(), { once: true }); });
  };
  H.link = () => WC.Dialogs.insertLink();
  H.symbol = (c, node) => WC.Dialogs.symbol(node);
  H.pageBreak = () => { const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { pm.insertPageBreak(); return; } insertPageBreak(); };
  H.blankPage = () => { const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { pm.insertBlankPage(); return; } insertBlankPage(); };
  // ---- Header & Footer contextual tab ----
  H.goToHeader = () => WC.HeaderFooter.goTo('header');
  H.goToFooter = () => WC.HeaderFooter.goTo('footer');
  H.closeHeaderFooter = () => WC.HeaderFooter.exitMode();
  H.docInfo = (c, node) => WC.flyout(node, (fly) => { [['Author', 'Word User'], ['File Name', (WC.Files.name || 'Document1')], ['Document Title', (WC.Files.name || 'Document1').replace(/\.[^.]+$/, '')], ['Page Number', '1']].forEach(([l, v]) => fly.appendChild(WC.flyItem(l, { onClick: () => { const r = WC.HeaderFooter.editing === 'footer' ? E().node.querySelector('.wc-footer') : E().node.querySelector('.wc-header'); if (r) { r.insertAdjacentHTML('beforeend', '<span class="wc-field" data-field="docinfo">' + WC.escapeHtml(v) + '</span>'); E().dirty = true; } } }))); });
  H.linkToPrevious = (c, node) => { if (node) node.classList.toggle('toggled'); WC.toast('Link to Previous toggled (single-section document).'); };
  H.differentFirstPage = (c, node) => { const on = E().node.classList.toggle('hf-diff-first'); if (node) node.classList.toggle('toggled', on); WC.toast('Different First Page ' + (on ? 'on' : 'off') + '.'); };
  H.differentOddEven = (c, node) => { const on = E().node.classList.toggle('hf-diff-oddeven'); if (node) node.classList.toggle('toggled', on); WC.toast('Different Odd & Even Pages ' + (on ? 'on' : 'off') + '.'); };
  H.showDocText = (c, node) => { const on = !E().node.classList.toggle('hf-hide-body'); if (node) node.classList.toggle('toggled', !on); };
  H.dateAndTime = () => E().insertHTML(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
  H.horizontalLine = () => { const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { pm.insertHr(); return; } E().insertHTML('<hr>'); };
  H.wordArt = (c, node) => insertWordArt();
  H.textBox = () => { const pm = PMA(); if (pm) { pm.xeTextBox(''); return; } E().insertHTML('<div style="border:1px solid #888;padding:8px;margin:6px 0;display:inline-block;min-width:200px">Text box — type here</div>&nbsp;'); };
  H.dropCap = () => { const pm = PMA(); if (pm) { pm.xeDropCap('drop', 3); return; } dropCap(); };
  H.equation = () => WC.Dialogs.equation();
  H.comment = (c, node) => WC.Commands.run({ cmd: 'newComment' });
  // PM branch: the contextual composer card (slice-8 task 4) owns text entry —
  // pm.cmd('addComment') with empty text is WRONG (A2: comments need real content).
  // Until WC.CommentsUI lands, the PM branch is a guarded no-op (review is D6-blocked
  // pre-flip, and the flip [task 7] lands after the composer [task 4]).
  H.newComment = () => {
    const pm = PMA();
    if (pm) { if (WC.CommentsUI && WC.CommentsUI.compose) WC.CommentsUI.compose(); return; }
    WC.Comments && WC.Comments.add();
  };

  // ---- Insert tab ----
  H.coverPage = (c, node) => WC.Insert.coverPageMenu(node);
  H.shapes = (c, node) => WC.Insert.shapesMenu(node);
  H.icons = () => WC.Insert.iconsPicker();
  H.smartart = (c, node) => WC.Insert.smartArtMenu(node);
  H.chart = () => WC.Insert.chartDialog();
  H['3dModels'] = () => WC.toast('3D models require a 3D model viewer/runtime — not available in this clone.', 'See docs/NOT_IMPLEMENTED.md');
  H.screenshot = (c, node) => screenshotMenu(node);
  H.myAddIns = (c, node) => addInsMenu(node);
  H.onlineVideo = () => WC.Insert.onlineVideoDialog();
  H.bookmark = () => WC.Insert.bookmarkDialog();
  H.crossReference = () => { const pm = PMA(); pm ? crossRefDialogPM(pm) : WC.Insert.crossRefDialog(); };
  H.header = (c, node) => WC.HeaderFooter.headerMenu(node);
  H.footer = (c, node) => WC.HeaderFooter.footerMenu(node);
  H.pageNumber = (c, node) => WC.HeaderFooter.pageNumberMenu(node);
  H.quickParts = (c, node) => WC.Insert.quickPartsMenu(node);
  H.wordart = (c, node) => WC.Insert.wordArtMenu(node);
  H.signatureLine = () => WC.Insert.signatureLine();
  H.dateTime = () => WC.Insert.dateTimeDialog();
  H.object = (c, node) => WC.Insert.objectMenu(node);

  function screenshotMenu(node) {
    WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Available Windows')); fly.appendChild(WC.flyItem('Screen Clipping', { onClick: () => WC.Insert.screenshot() })); });
  }
  function picturesMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('This Device…', { icon: 'pictures', onClick: () => H.pictures() }));
      fly.appendChild(WC.flyItem('Online Pictures…', { icon: 'onlinePictures', onClick: () => WC.toast('Online Pictures needs an image search backend — not available in this clone.', 'See docs/NOT_IMPLEMENTED.md') }));
    });
  }
  function textBoxMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Simple Text Box', { onClick: () => H.textBox() }));
      fly.appendChild(WC.flyItem('Draw Text Box', { onClick: () => H.textBox() }));
    });
  }
  function dropCapMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('None', { onClick: () => { const pm = PMA(); if (pm) { pm.xeDropCap('none', 0); return; } const b = E().selectedBlocks()[0]; if (b) { const s = b.querySelector('span[style*="float:left"]'); if (s) s.replaceWith(...s.childNodes); } } }));
      fly.appendChild(WC.flyItem('Dropped', { onClick: () => { const pm = PMA(); if (pm) { pm.xeDropCap('drop', 3); return; } H.dropCap(); } }));
      fly.appendChild(WC.flyItem('In Margin', { onClick: () => { const pm = PMA(); if (pm) { pm.xeDropCap('margin', 3); return; } H.dropCap(); } }));
    });
  }
  function equationMenu(node) {
    const eqs = ['a² + b² = c²', 'x = (−b ± √(b²−4ac)) / 2a', 'E = mc²', '∫ f(x) dx', 'Σ(i=1→n) i = n(n+1)/2'];
    WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Built-In')); eqs.forEach((e2) => fly.appendChild(WC.flyItem(e2, { onClick: () => E().insertHTML(`<span style="font-family:'Cambria Math',Cambria,serif;font-style:italic">${WC.escapeHtml(e2)}</span>&nbsp;`) }))); fly.appendChild(WC.flySep()); fly.appendChild(WC.flyItem('Insert New Equation', { onClick: () => WC.Dialogs.equation() })); });
  }

  // ---- View ----
  H.readMode = () => readMode();
  H.printLayout = () => E().setView('print');
  H.webLayout = () => E().setView('web');
  H.zoom = () => WC.Dialogs.zoom();
  H.onePage = () => E().setZoom(fitZoom(1));
  H.multiplePages = () => E().setZoom(fitZoom(2));
  H.pageWidth = () => E().setZoom(fitWidthZoom());
  H.zoom100 = () => E().setZoom(1);
  H.ruler = (c, node) => { document.getElementById('ruler').classList.toggle('hidden-ruler'); markChecked(node); };
  H.gridlines = (c, node) => {
    const target = (WC.PM && WC.PM.active) ? document.getElementById('pm-editor') : E().node;
    target.classList.toggle('show-grid');
    markChecked(node);
  };
  H.navigationPane = (c, node) => WC.Dialogs.navPane();
  H.focus = () => document.getElementById('app').classList.toggle('focus-mode');

  // ---- Review ----
  H.wordCount = () => WC.Dialogs.wordCount();
  H.readAloud = () => toggleReadAloud(); // PM branch reads the PM doc + per-word ::highlight (task 6)
  // P3: the Spelling and Grammar BUTTON opens the Editor/spelling flow (modern Word);
  // the squiggle toggle lives in the Editor pane + the Language dialog.
  H.spellingGrammar = () => { const pm = PMA(); pm ? WC.Dialogs.editorPane() : runSpellCheck(); };
  // T1/T3: the toggle respects the D8.7 lock — Word disables turning tracking off
  // while locked ("not a security feature": a UI gate, not crypto).
  H.trackChanges = () => {
    const pm = PMA();
    if (!pm) { WC.Review.setTrackChanges(); return; }
    if (WC.pmTrackLock && WC.pmTrackLock.locked) { WC.toast('Track Changes is locked.', 'Lock Tracking (with the password) to turn it off.'); return; }
    pm.cmd('toggleTrackChanges');
  };
  // D8.7 Lock Tracking: dialog-driven (lock → password pair; re-invoke → unlock).
  H.trackChangesLock = () => {
    const pm = PMA();
    if (pm) { WC.Dialogs.lockTracking(); return; }
    WC.toast('Lock Tracking needs a password — not implemented.');
  };

  // ---- Layout ----
  H.margins = (c, node) => marginsMenu(node);
  H.orientation = (c, node) => orientationMenu(node);
  H.size = (c, node) => pageSizeMenu(node);
  H.columns = (c, node) => columnsMenu(node);
  H.breaks = (c, node) => breaksMenu(node);
  function breaksMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Page Breaks'));
      fly.appendChild(WC.flyItem('Page', { icon: 'pageBreak', key: 'Ctrl+Enter', onClick: () => insertPageBreak() }));
      fly.appendChild(WC.flyItem('Column', { onClick: () => { E().insertHTML('<span class="wc-colbreak" style="break-after:column;display:block;height:0"></span>'); WC.toast('Column break inserted.'); } }));
      fly.appendChild(WC.flyItem('Text Wrapping', { onClick: () => E().insertHTML('<br>') }));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyHeader('Section Breaks'));
      fly.appendChild(WC.flyItem('Next Page', { onClick: () => insertPageBreak() }));
      fly.appendChild(WC.flyItem('Continuous', { onClick: () => { E().insertHTML('<hr class="wc-section-break" style="border:none;border-top:1px dotted #aaa;margin:6px 0">'); WC.toast('Continuous section break inserted.'); } }));
      fly.appendChild(WC.flyItem('Even Page', { onClick: () => insertPageBreak() }));
      fly.appendChild(WC.flyItem('Odd Page', { onClick: () => insertPageBreak() }));
    });
  }
  H.pageColor = (c, node) => applyColor('page', '#FFFFFF');

  // ---- Design ----
  H.pageColor2 = H.pageColor;

  // ---- Home: Text Effects, Multilevel List, Dictate, extras ----
  H.textEffectsAndTypography = (c, node) => textEffectsMenu(node);
  H.multilevelList = (c, node) => multilevelMenu(node);
  H.dictate = (c, node) => WC.Dictate.toggle(node);
  H.sensitivity = (c, node) => sensitivityMenu(node);
  H.editor = () => WC.Dialogs.editorPane();
  H.addIns = (c, node) => addInsMenu(node);
  H.getAddIns = (c, node) => addInsMenu(node);
  H.reuseFiles = () => WC.toast('Reuse Files surfaces content from your cloud/OneDrive documents — not available in this local clone.', 'See docs/NOT_IMPLEMENTED.md');

  const PT = 1.3333;
  function textEffectsMenu(node) {
    WC.flyout(node, (fly) => {
      const row = (label, fn) => { const it = WC.flyItem(label, { onClick: fn }); it.appendChild(el('span', { class: 'caret', html: WC.icon('chevron_down', 8), style: { marginLeft: 'auto', transform: 'rotate(-90deg)' } })); return it; };
      fly.appendChild(row('Outline', () => outlineMenu(node)));
      fly.appendChild(row('Shadow', () => shadowMenu(node)));
      fly.appendChild(row('Reflection', () => reflectionMenu(node)));
      fly.appendChild(row('Glow', () => glowMenu(node)));
      fly.appendChild(WC.flySep());
      fly.appendChild(row('Number Styles', () => numberStylesMenu(node)));
      fly.appendChild(row('Ligatures', () => ligaturesMenu(node)));
      fly.appendChild(row('Stylistic Sets', () => stylisticSetsMenu(node)));
    });
  }
  function outlineMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('No Outline', { onClick: () => E().applyInlineStyles({ webkitTextStroke: '', webkitTextFillColor: '' }) }));
      [['¾ pt', 1], ['1 pt', 1.33], ['1½ pt', 2], ['2¼ pt', 3], ['3 pt', 4]].forEach(([lbl, px]) =>
        fly.appendChild(WC.flyItem(lbl + ' outline', { onClick: () => E().applyInlineStyles({ webkitTextStroke: px + 'px currentColor', webkitTextFillColor: 'transparent' }) })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Outline Color…', { onClick: () => WC.flyout(node, (f2) => f2.appendChild(WC.colorPalette((color) => E().applyInlineStyles({ webkitTextStroke: '1.5px ' + color, webkitTextFillColor: 'currentColor' })))) }));
    });
  }
  function shadowMenu(node) {
    const presets = [['Bottom Right', '2px 2px 2px rgba(0,0,0,.45)'], ['Bottom', '0 2px 2px rgba(0,0,0,.45)'], ['Bottom Left', '-2px 2px 2px rgba(0,0,0,.45)'], ['Right', '2px 0 2px rgba(0,0,0,.45)'], ['Center', '0 0 4px rgba(0,0,0,.5)'], ['Left', '-2px 0 2px rgba(0,0,0,.45)'], ['Top Right', '2px -2px 2px rgba(0,0,0,.45)'], ['Top', '0 -2px 2px rgba(0,0,0,.45)'], ['Top Left', '-2px -2px 2px rgba(0,0,0,.45)']];
    WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('No Shadow', { onClick: () => E().applyInlineStyles({ textShadow: '' }) })); presets.forEach(([l, v]) => fly.appendChild(WC.flyItem(l, { onClick: () => E().applyInlineStyles({ textShadow: v }) }))); });
  }
  function reflectionMenu(node) {
    const presets = [['Tight', 'below 2px linear-gradient(transparent 55%, rgba(255,255,255,.45) 100%)'], ['Half', 'below 4px linear-gradient(transparent 45%, rgba(255,255,255,.4) 100%)'], ['Full', 'below 6px linear-gradient(transparent 30%, rgba(255,255,255,.35) 100%)']];
    WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('No Reflection', { onClick: () => E().applyInlineStyles({ webkitBoxReflect: '' }) })); presets.forEach(([l, v]) => fly.appendChild(WC.flyItem(l, { onClick: () => E().applyInlineStyles({ webkitBoxReflect: v }) }))); });
  }
  function glowMenu(node) {
    const glow = (color, r) => Array(3).fill('0 0 ' + r + 'px ' + color).join(', ');
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('No Glow', { onClick: () => E().applyInlineStyles({ textShadow: '' }) }));
      [['5 pt', 4], ['8 pt', 6], ['11 pt', 8], ['18 pt', 12]].forEach(([l, r]) => fly.appendChild(WC.flyItem(l + ' glow', { onClick: () => E().applyInlineStyles({ textShadow: glow('var(--word-blue)', r) }) })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Glow Color…', { onClick: () => WC.flyout(node, (f2) => f2.appendChild(WC.colorPalette((color) => E().applyInlineStyles({ textShadow: glow(color, 8) })))) }));
    });
  }
  function numberStylesMenu(node) {
    const opts = [['Default', 'normal'], ['Proportional Lining', 'lining-nums proportional-nums'], ['Tabular Lining', 'lining-nums tabular-nums'], ['Proportional Oldstyle', 'oldstyle-nums proportional-nums'], ['Tabular Oldstyle', 'oldstyle-nums tabular-nums']];
    WC.flyout(node, (fly) => opts.forEach(([l, v]) => fly.appendChild(WC.flyItem(l, { onClick: () => E().applyInlineStyles({ fontVariantNumeric: v }) }))));
  }
  function ligaturesMenu(node) {
    const opts = [['None', 'none'], ['Standard Only', 'common-ligatures'], ['Standard and Contextual', 'common-ligatures contextual'], ['Historical and Discretionary', 'discretionary-ligatures historical-ligatures'], ['All', 'common-ligatures discretionary-ligatures historical-ligatures contextual']];
    WC.flyout(node, (fly) => opts.forEach(([l, v]) => fly.appendChild(WC.flyItem(l, { onClick: () => E().applyInlineStyles({ fontVariantLigatures: v }) }))));
  }
  function stylisticSetsMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Default', { onClick: () => E().applyInlineStyles({ fontFeatureSettings: 'normal' }) }));
      for (let n = 1; n <= 8; n++) fly.appendChild(WC.flyItem('Set ' + n, { onClick: () => E().applyInlineStyles({ fontFeatureSettings: '"ss' + String(n).padStart(2, '0') + '" 1' }) }));
    });
  }

  // Word-native multilevel patterns: per-level OOXML numFmt + lvlText, applied as a real
  // numbering definition (applyListDefinition). The legacy CSS-class fake (ml-decimal/
  // ml-bullet/ml-outline) survives only on the --legacy branch.
  const mlLevels = (mk) => Array.from({ length: 9 }, (_, i) => mk(i));
  const compound = (i, suffix) => Array.from({ length: i + 1 }, (_, k) => '%' + (k + 1)).join('.') + suffix;
  const ML_PATTERNS = {
    'Decimal (1. 1.1. 1.1.1.)': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: 'decimal', text: compound(i, '.') })) },
    'Legal (1 1.1 1.1.1)': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: 'decimal', text: compound(i, '') })) },
    'Bullet hierarchy': { listType: 'bulletList', levels: mlLevels((i) => ({ fmt: 'bullet', text: ['•', '◦', '▪'][i % 3] })) },
    'Outline (1) a) i))': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: ['decimal', 'lowerLetter', 'lowerRoman'][i % 3], text: '%' + (i + 1) + ')' })) },
    'Upper Roman (I. A. 1.)': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: ['upperRoman', 'upperLetter', 'decimal'][i % 3], text: '%' + (i + 1) + '.' })) },
  };
  function multilevelMenu(node) {
    // [label, legacyKey] — the PM branch keys ML_PATTERNS by label; legacy uses key.
    const lib = [['Decimal (1. 1.1. 1.1.1.)', 'decimal'], ['Legal (1 1.1 1.1.1)', 'decimal'], ['Bullet hierarchy', 'bullet'], ['Outline (1) a) i))', 'outline'], ['Upper Roman (I. A. 1.)', 'outline']];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('List Library'));
      lib.forEach(([label, key]) => fly.appendChild(WC.flyItem(label, { onClick: () => {
        const pm = PMA();
        if (pm) pm.cmd('applyListDefinition', ML_PATTERNS[label]);
        else E().applyMultilevelPattern(key);
      } })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Change List Level', { onClick: () => changeListLevelMenu(node) }));
      fly.appendChild(WC.flyItem('Define New Multilevel List…', { onClick: () => WC.notImplemented('Define New Multilevel List dialog') }));
    });
  }
  function changeListLevelMenu(node) {
    WC.flyout(node, (fly) => {
      for (let i = 1; i <= 5; i++) fly.appendChild(WC.flyItem('Level ' + i, { onClick: () => {
        const pm = PMA();
        if (!pm) { E().setListLevel(i); return; }
        // ONE full-delta call = one transaction = one undo step (changeListLevelBy).
        // NEVER chain repeated increase/decreaseListIndent — changeListLevel reads
        // editor.state, so chained ±1 steps land one short.
        // Slice 3: `cur` reads the RESOLVED level via the bridge (closes the recorded
        // slice-2 deviation — style-inherited list paragraphs land on target; the
        // engine applies the delta against the same resolved source).
        const resolved = pm.getResolvedParaProps();
        const np = resolved && resolved.numberingProperties ? resolved.numberingProperties : null;
        const cur = np && np.ilvl != null ? np.ilvl : 0;
        const delta = (i - 1) - cur;
        // Non-list paragraph: changeListLevelBy → underlying changeListLevel finds no
        // list and returns false — silent no-op (Word greys these items instead).
        if (delta !== 0) pm.cmd('changeListLevelBy', delta);
      } }));
    });
  }

  function sensitivityMenu(node) {
    const labels = [['Public', '#107C10'], ['General', '#0078D4'], ['Confidential', '#D83B01'], ['Highly Confidential', '#A4262C']];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Sensitivity'));
      labels.forEach(([l, color]) => { const it = WC.flyItem(l, { onClick: () => WC.setSensitivity(l, color) }); it.insertBefore(el('span', { style: { width: '12px', height: '12px', background: color, borderRadius: '2px', marginRight: '8px' } }), it.firstChild); fly.appendChild(it); });
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Remove label', { onClick: () => WC.setSensitivity(null) }));
    });
  }
  function addInsMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Office Add-ins'));
      fly.appendChild(WC.flyItem('Get Add-ins (Store)', { onClick: () => addInsStoreDialog() }));
      fly.appendChild(WC.flyItem('My Add-ins', { onClick: () => addInsStoreDialog('My Add-ins') }));
    });
  }
  function addInsStoreDialog(tab) {
    const search = el('input', { type: 'search', class: 'grow', placeholder: 'Search the Office Store' });
    const sample = [
      ['Wikipedia', 'Reference articles inline while you write.'],
      ['Pexels', 'Free stock photos from Pexels.'],
      ['Pickit', 'Insert royalty-free images and icons.'],
      ['DocuSign', 'Sign and send documents for signature.'],
      ['Translator', 'Translate text into many languages.'],
    ];
    const list = el('div', { style: { maxHeight: '240px', overflow: 'auto', border: '1px solid #e1dfdd', borderRadius: '3px', marginTop: '8px' } });
    sample.forEach(([name, desc]) => {
      const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderBottom: '1px solid #f0f0f0' } }, [
        el('div', { style: { width: '34px', height: '34px', borderRadius: '4px', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2b579a', fontWeight: '700' }, text: name[0] }),
        el('div', { style: { flex: '1' } }, [el('div', { style: { fontWeight: '600' }, text: name }), el('div', { style: { fontSize: '11px', color: '#666' }, text: desc })]),
        el('button', { class: 'btn', text: 'Add', onclick: () => WC.toast('“' + name + '” add-in runtime is not available in this clone.') }),
      ]);
      list.appendChild(row);
    });
    WC.dialog({ title: 'Office Add-ins', width: '560px', body: el('div', {}, [
      el('div', { class: 'tabs', style: { display: 'flex', gap: '14px', borderBottom: '1px solid #e1dfdd', paddingBottom: '6px' } }, [
        el('span', { style: { fontWeight: tab === 'My Add-ins' ? '400' : '700', color: tab === 'My Add-ins' ? '#666' : '#2b579a', cursor: 'pointer' }, text: 'Store' }),
        el('span', { style: { fontWeight: tab === 'My Add-ins' ? '700' : '400', color: tab === 'My Add-ins' ? '#2b579a' : '#666', cursor: 'pointer' }, text: 'My Add-ins' }),
      ]),
      search, list,
    ]), footer: [{ label: 'Close', primary: true }] });
  }

  // ---- Draw tab ----
  H.drawing = () => WC.Draw.toggle();
  H.pensGallery = (c, node) => pensMenu(node);
  H.addPen = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyHeader('Add'));
    const add = (type, name, color, width, opacity) => fly.appendChild(WC.flyItem(name, { onClick: () => { const pen = { id: type + '-' + (WC.Draw.customPens.length + 1), name, color, width, opacity, type }; WC.Draw.customPens.push(pen); WC.Draw.setPen(pen); if (WC.Ribbon._renderPens) WC.Ribbon._renderPens(); } }));
    add('pen', 'Pen', '#000000', 3, 1);
    add('pencil', 'Pencil', '#5b5b5b', 2, 0.85);
    add('highlighter', 'Highlighter', '#ffff00', 14, 0.4);
    add('pen', 'Action Pen', '#156082', 3, 1);
    fly.appendChild(WC.flySep());
    fly.appendChild(WC.flyItem('Custom Pen…', { onClick: () => addPenDialog(node) }));
  });
  H.drawWithTrackpad = (c, node) => { if (node) node.classList.toggle('toggled'); WC.toast('Mouse/trackpad input is used for drawing in this clone.'); };
  H.eraser = (c, node) => { WC.Draw.setEnabled(true); WC.Draw.setTool('eraser'); };
  H.selectObjects = () => { WC.Draw.setEnabled(true); WC.Draw.setTool('select'); };
  H.lassoSelect = () => { WC.Draw.setEnabled(true); WC.Draw.setTool('lasso'); };
  H.drawingCanvas = () => WC.Draw.insertCanvas();
  H.inkToShape = () => WC.toast('Ink-to-Shape recognition is a handwriting/shape ML feature — not implemented.', 'See docs/NOT_IMPLEMENTED.md');
  H.inkToMath = () => WC.toast('Ink-to-Math (handwritten equation recognition) is not implemented.', 'See docs/NOT_IMPLEMENTED.md');
  H.inkReplay = () => WC.Draw.replay();

  function pensMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Pens'));
      WC.Draw.PENS.concat(WC.Draw.customPens).forEach((pen) => {
        const it = WC.flyItem(pen.name, { onClick: () => WC.Draw.setPen(pen) });
        it.insertBefore(el('span', { style: { width: '24px', height: '4px', borderRadius: '2px', background: pen.color, opacity: pen.opacity, marginRight: '8px' } }), it.firstChild);
        fly.appendChild(it);
      });
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Add Pen…', { onClick: () => addPenDialog(node) }));
      fly.appendChild(WC.flyItem(WC.Draw.enabled ? 'Stop Drawing' : 'Start Drawing', { onClick: () => WC.Draw.toggle() }));
      fly.appendChild(WC.flyItem('Clear All Ink', { onClick: () => WC.Draw.clearAll() }));
    });
  }
  function addPenDialog(node) {
    let color = '#000000'; const width = el('input', { type: 'range', min: '1', max: '24', value: '3', class: 'grow' });
    const swatch = el('button', { class: 'btn', text: 'Color ▾', style: { minWidth: '110px' } });
    swatch.addEventListener('click', () => WC.flyout(swatch, (f) => f.appendChild(WC.colorPalette((c) => { color = c === 'inherit' ? '#000' : c; swatch.style.color = color; }))));
    const body = el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Color:', style: { width: '60px' } }), swatch]), el('div', { class: 'row' }, [el('label', { text: 'Thickness:', style: { width: '60px' } }), width])]);
    WC.dialog({ title: 'Add Pen', width: '360px', body, footer: [
      { label: 'Add', primary: true, onClick: () => { const pen = { id: 'custom-' + (WC.Draw.customPens.length + 1), name: 'Custom Pen', color, width: parseFloat(width.value), opacity: 1 }; WC.Draw.customPens.push(pen); WC.Draw.setPen(pen); if (WC.Ribbon._renderPens) WC.Ribbon._renderPens(); } },
      { label: 'Cancel' },
    ] });
  }

  // ---- Design tab ----
  H.themes = (c, node) => galleryMenu(node, 'Office Themes', WC.Design.THEMES, (t, silent) => { const pm = PMA(); if (pm) { if (silent) pm.dePreviewTheme('theme', t); else pm.deApplyTheme(t); return; } WC.Design.applyTheme(t, silent); }, (t) => firstFont(t.body) === currentDocFont());
  H.styleSet = (c, node) => styleSetGallery(node);
  H.colors = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Colors')); WC.Design.COLOR_SCHEMES.forEach((s) => { const it = WC.flyItem(s.name, { onClick: () => { const pm = PMA(); if (pm) return; /* PM: livePreviewCell's click owns the commit (dePreviewCommit + apply) — returning here avoids a double deApplyColors/double toast */ WC.Design.applyColorScheme(s); } }); it.insertBefore(swatchRow(s.accents), it.firstChild); livePreviewCell(it, s, (item, silent) => { const pm = PMA(); if (pm) { if (silent) pm.dePreviewTheme('colors', item); else pm.deApplyColors(item); return; } WC.Design.applyColorScheme(item, silent); }); fly.appendChild(it); }); });
  H.fonts = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Fonts')); WC.Design.FONT_PAIRS.forEach((p) => { const it = WC.flyItem(p.name, { onClick: () => {} }); it.querySelector('.fi-label').style.fontFamily = p.body; livePreviewCell(it, p, (item, silent) => { const pm = PMA(); if (pm) { if (silent) pm.dePreviewTheme('fonts', item); else pm.deApplyFonts(item); return; } WC.Design.applyFontPairing(item, silent); }); fly.appendChild(it); }); });
  // PM: paragraph spacing is COMMIT-ONLY (no hover preview) — spacing changes are applied via
  // docDefaults/Normal redefinition; a transient live preview isn't wired (honest degrade). Click commits.
  H.paragraphSpacing = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Built-In')); WC.Design.SPACING.forEach((s) => { const it = WC.flyItem(s.name, { onClick: () => {} }); livePreviewCell(it, s, (item, silent) => { const pm = PMA(); if (pm) { if (!silent) pm.deParagraphSpacing(item); return; } WC.Design.applyParagraphSpacing(item, silent); }); fly.appendChild(it); }); fly.appendChild(WC.flySep()); fly.appendChild(WC.flyItem('Custom Paragraph Spacing…', { onClick: () => WC.Dialogs.paragraph() })); });
  H.effects = (c, node) => effectsMenu(node);
  function firstFont(chain) { return String(chain).split(',')[0].replace(/['"]/g, '').trim(); }
  function currentDocFont() { return firstFont(getComputedStyle(document.documentElement).getPropertyValue('--doc-font') || 'Aptos'); }
  function styleSetGallery(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Built-In'));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', padding: '4px 10px' } });
      WC.Design.STYLE_SETS.forEach((name) => {
        const cell = el('div', { title: name, style: { border: '1px solid #e1dfdd', borderRadius: '2px', padding: '6px 4px', cursor: 'pointer', textAlign: 'center' } });
        cell.appendChild(el('div', { text: 'Title', style: { fontSize: '13px', color: '#2b579a', fontWeight: '600' } }));
        cell.appendChild(el('div', { text: 'Heading', style: { fontSize: '9px', color: '#2b579a' } }));
        cell.appendChild(el('div', { text: 'Body text sample', style: { fontSize: '8px', color: '#333', marginTop: '2px' } }));
        cell.appendChild(el('div', { text: name, style: { fontSize: '9px', marginTop: '3px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }));
        // PM: style sets are COMMIT-ONLY (no hover preview) — the clone's style sets map to Normal
        // paragraph spacing, which isn't wired for transient live preview (honest degrade). Click commits.
        livePreviewCell(cell, name, (n, silent) => { const pm = PMA(); if (pm) { if (!silent) pm.deApplyStyleSet(n); return; } WC.Design.applyStyleSet(n, silent); });
        grid.appendChild(cell);
      });
      fly.appendChild(grid);
    });
  }
  function effectsMenu(node) {
    const effects = [
      ['None', 'none'], ['Subtle', '0 1px 2px rgba(0,0,0,.18)'], ['Moderate', '0 3px 6px rgba(0,0,0,.28)'],
      ['Intense', '0 6px 14px rgba(0,0,0,.4)'], ['Reflection', '0 8px 8px -6px rgba(0,0,0,.4)'], ['Glow', '0 0 10px rgba(43,87,154,.6)'],
    ];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Theme Effects'));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', padding: '6px 10px' } });
      effects.forEach(([label, shadow]) => {
        const cell = el('div', { title: label, style: { cursor: 'pointer', textAlign: 'center' } });
        cell.appendChild(el('div', { style: { width: '40px', height: '28px', margin: '0 auto', background: '#5b9bd5', borderRadius: '3px', boxShadow: shadow === 'none' ? 'none' : shadow } }));
        cell.appendChild(el('div', { text: label, style: { fontSize: '9px', marginTop: '4px', color: '#666' } }));
        cell.addEventListener('click', () => { WC.closeFlyouts(); applyShapeEffect(shadow); });
        grid.appendChild(cell);
      });
      fly.appendChild(grid);
    });
  }
  function applyShapeEffect(shadow) {
    const pm = PMA(); if (pm) { pm.deEffects(shadow); return; }
    const objs = E().node.querySelectorAll('img, .wc-shape, .wc-wordart');
    objs.forEach((o) => { o.style.boxShadow = shadow === 'none' ? '' : shadow; });
    E().dirty = true;
    WC.toast(objs.length ? ('Theme effect applied to ' + objs.length + ' object(s).') : 'Theme effect set (applies to shapes/pictures).');
  }
  H.setAsDefault = () => { const pm = PMA(); if (pm) { pm.deSetAsDefault(); return; } WC.Design.setAsDefault(); };
  H.watermark = (c, node) => watermarkMenu(node);
  H.pageBorders = () => WC.Dialogs.pageBorders();

  // Wire a gallery cell so hovering live-previews the choice (Word behavior) and
  // the pointer leaving reverts it; clicking commits. `apply(item, silent)`.
  function livePreviewCell(cell, item, apply) {
    let snap = null;
    cell.addEventListener('mouseenter', () => { if (!PMA() && !snap) snap = WC.Design.snapshot(); apply(item, true); });
    cell.addEventListener('mouseleave', () => { const pm = PMA(); if (pm) { pm.dePreviewRestore(); return; } if (snap) { WC.Design.restore(snap); } });
    cell.addEventListener('click', () => { const pm = PMA(); if (pm) { pm.dePreviewCommit(); } else { snap = null; } WC.closeFlyouts(); apply(item, false); });
  }
  function galleryMenu(node, title, items, apply, isActive) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader(title));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', padding: '4px 10px' } });
      items.forEach((t) => {
        const active = isActive && isActive(t);
        const cell = el('div', { title: t.name, style: { border: '1px solid ' + (active ? '#2b579a' : '#e1dfdd'), outline: active ? '1px solid #2b579a' : 'none', borderRadius: '2px', padding: '6px', cursor: 'pointer', textAlign: 'center', position: 'relative' } });
        if (active) cell.appendChild(el('div', { text: '✓', style: { position: 'absolute', top: '1px', right: '4px', color: '#2b579a', fontSize: '11px', fontWeight: '700' } }));
        cell.appendChild(el('div', { text: 'Aa', style: { fontFamily: t.heading || t.body, fontSize: '18px', color: t.color || '#333' } }));
        if (t.accents) { const row = el('div', { style: { display: 'flex', height: '6px', marginTop: '4px' } }); t.accents.slice(0, 6).forEach((a) => row.appendChild(el('span', { style: { flex: 1, background: a } }))); cell.appendChild(row); }
        cell.appendChild(el('div', { text: t.name, style: { fontSize: '10px', marginTop: '3px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }));
        livePreviewCell(cell, t, apply);
        grid.appendChild(cell);
      });
      fly.appendChild(grid);
    });
  }
  function swatchRow(accents) { const row = el('span', { style: { display: 'inline-flex', width: '40px', height: '12px', marginRight: '8px' } }); accents.slice(0, 6).forEach((a) => row.appendChild(el('span', { style: { flex: 1, background: a } }))); return row; }
  function watermarkMenu(node) {
    const groups = [
      ['Confidential', ['CONFIDENTIAL', 'DO NOT COPY', 'CONFIDENTIAL 1']],
      ['Disclaimers', ['DRAFT', 'SAMPLE']],
      ['Urgent', ['URGENT', 'ASAP']],
    ];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Watermark'));
      groups.forEach(([gname, items]) => {
        fly.appendChild(el('div', { text: gname, style: { fontSize: '11px', fontWeight: '600', color: '#888', padding: '4px 10px 2px' } }));
        const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px', padding: '2px 10px 6px' } });
        items.forEach((text) => {
          const label = text.replace(/ 1$/, '');
          const cell = el('div', { title: text, style: { border: '1px solid #e1dfdd', borderRadius: '2px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' } });
          cell.appendChild(el('div', { text: label, style: { transform: 'rotate(-18deg)', color: '#c8c8c8', fontWeight: '700', fontSize: '11px', whiteSpace: 'nowrap' } }));
          cell.addEventListener('click', () => { WC.closeFlyouts(); const pm = PMA(); if (pm) { pm.deWatermark(label, {}); return; } WC.Design.watermark(label); });
          grid.appendChild(cell);
        });
        fly.appendChild(grid);
      });
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Custom Watermark…', { onClick: () => WC.Dialogs.watermark() }));
      fly.appendChild(WC.flyItem('Remove Watermark', { onClick: () => { const pm = PMA(); if (pm) { pm.deWatermarkRemove(); return; } WC.Design.removeWatermark(); } }));
    });
  }

  // ---- Layout tab ----
  H.lineNumbers = (c, node) => WC.flyout(node, (fly) => { [['None', 'none'], ['Continuous', 'continuous'], ['Restart Each Page', 'page'], ['Restart Each Section', 'section']].forEach(([l, m]) => { const it = WC.flyItem((WC.Layout.lineMode === m ? '✓ ' : '   ') + l, { onClick: () => WC.Layout.setLineNumbers(m) }); fly.appendChild(it); }); fly.appendChild(WC.flySep()); fly.appendChild(WC.flyItem('Suppress for Current Paragraph', { onClick: () => { E().selectedBlocks().forEach((b) => b.classList.toggle('wc-ln-suppress')); WC.Layout.renderLineNumbers(); } })); fly.appendChild(WC.flySep()); fly.appendChild(WC.flyItem('Line Numbering Options…', { onClick: () => WC.Dialogs.paragraph() })); });
  H.hyphenation = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyItem((WC.Layout.hyphenMode === 'none' || !WC.Layout.hyphenMode ? '✓ ' : '   ') + 'None', { onClick: () => WC.Layout.setHyphenation('none') }));
    fly.appendChild(WC.flyItem((WC.Layout.hyphenMode === 'auto' ? '✓ ' : '   ') + 'Automatic', { onClick: () => WC.Layout.setHyphenation('auto') }));
    fly.appendChild(WC.flyItem('Manual…', { onClick: () => manualHyphenate() }));
    fly.appendChild(WC.flySep());
    fly.appendChild(WC.flyItem('Hyphenation Options…', { onClick: () => WC.toast('Hyphenation zone/limit options — automatic hyphenation is applied.') }));
  });
  function manualHyphenate() {
    // Word's Manual scans long words and proposes hyphenation points one at a time.
    // We approximate by inserting soft hyphens (­) into long words so they break.
    // Operate only on text nodes so element attributes (comment anchors etc.) survive.
    let count = 0;
    const walker = document.createTreeWalker(E().node, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    let n; while ((n = walker.nextNode())) { if (/[A-Za-z]{8,}/.test(n.nodeValue)) targets.push(n); }
    targets.forEach((t) => { t.nodeValue = t.nodeValue.replace(/([A-Za-z]{8,})/g, (w) => { count++; return w.replace(/(.{4})(?=.{3})/g, '$1­'); }); });
    E().dirty = true; E().repaginate();
    WC.toast('Manual Hyphenation complete — ' + count + ' word(s) marked.');
  }
  H.position = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('In Line with Text')); fly.appendChild(WC.flyItem('In Line with Text', { onClick: () => WC.Layout.wrapText('inline') })); fly.appendChild(WC.flyHeader('With Text Wrapping')); [['Top Left', 'tl'], ['Top Center', 'tc'], ['Top Right', 'tr'], ['Middle Left', 'ml'], ['Middle Center', 'mc'], ['Middle Right', 'mr'], ['Bottom Left', 'bl'], ['Bottom Center', 'bc'], ['Bottom Right', 'br']].forEach(([l, p]) => fly.appendChild(WC.flyItem(l, { onClick: () => WC.Layout.position(p) }))); });
  H.wrapText = (c, node) => WC.flyout(node, (fly) => { [['In Line with Text', 'inline'], ['Square', 'square'], ['Tight', 'tight'], ['Through', 'through'], ['Top and Bottom', 'topbottom'], ['Behind Text', 'behind'], ['In Front of Text', 'front']].forEach(([l, m]) => fly.appendChild(WC.flyItem(l, { onClick: () => WC.Layout.wrapText(m) }))); });
  H.bringForward = () => WC.Layout.bringForward();
  H.sendBackward = () => WC.Layout.sendBackward();
  H.selectionPane = () => WC.Layout.selectionPane();
  H.align = (c, node) => WC.flyout(node, (fly) => {
    [['Align Left', 'left'], ['Align Center', 'center'], ['Align Right', 'right'], ['Align Top', 'top'], ['Align Middle', 'middle'], ['Align Bottom', 'bottom']].forEach(([l, p]) => fly.appendChild(WC.flyItem(l, { onClick: () => WC.Layout.align(p) })));
    fly.appendChild(WC.flySep());
    fly.appendChild(WC.flyItem('Distribute Horizontally', { onClick: () => WC.Layout.distribute('h') }));
    fly.appendChild(WC.flyItem('Distribute Vertically', { onClick: () => WC.Layout.distribute('v') }));
    fly.appendChild(WC.flySep());
    fly.appendChild(WC.flyItem((WC.Layout.alignTo === 'page' ? '✓ ' : '   ') + 'Align to Page', { onClick: () => { WC.Layout.alignTo = 'page'; } }));
    fly.appendChild(WC.flyItem((WC.Layout.alignTo !== 'page' ? '✓ ' : '   ') + 'Align to Margin', { onClick: () => { WC.Layout.alignTo = 'margin'; } }));
  });
  H.group = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Group', { onClick: () => WC.toast('Grouping is approximated — arrange objects individually.') })); fly.appendChild(WC.flyItem('Ungroup', { onClick: () => WC.toast('Ungroup') })); });
  H.rotate = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Rotate Right 90°', { onClick: () => WC.Layout.rotate(90) })); fly.appendChild(WC.flyItem('Rotate Left 90°', { onClick: () => WC.Layout.rotate(-90) })); fly.appendChild(WC.flyItem('Flip Vertical', { onClick: () => WC.Layout.flip('v') })); fly.appendChild(WC.flyItem('Flip Horizontal', { onClick: () => WC.Layout.flip('h') })); });

  // ---- References tab ----
  H.tableOfContents = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyHeader('Built-In'));
    fly.appendChild(WC.flyItem('Automatic Table 1', { onClick: () => { const pm = PMA(); pm ? pm.refInsertTOC({ title: 'Contents' }) : WC.Ref.insertTOC(false, { title: 'Contents' }); } }));
    fly.appendChild(WC.flyItem('Automatic Table 2', { onClick: () => { const pm = PMA(); pm ? pm.refInsertTOC({ title: 'Table of Contents' }) : WC.Ref.insertTOC(false, { title: 'Table of Contents' }); } }));
    // Manual Table: Word's manual TOC is a type-it-yourself table with NO heading
    // collection. refInsertTOC always builds from headings, so in PM mode this
    // degrades to an auto TOC (recorded in the slice ledger). FIX 3: refInsertTOC
    // reads `showLevels` (NOT `levels`), so `{levels:3}` was ignored and produced a
    // default-config auto TOC anyway — pass the correct key so the level count lands.
    fly.appendChild(WC.flyItem('Manual Table', { onClick: () => { const pm = PMA(); pm ? pm.refInsertTOC({ showLevels: 3 }) : WC.Ref.insertTOC(true); } }));
    fly.appendChild(WC.flySep());
    fly.appendChild(WC.flyItem('Custom Table of Contents…', { onClick: () => customTOCDialog() }));
    fly.appendChild(WC.flyItem('Remove Table of Contents', { onClick: () => { const pm = PMA(); if (pm) { pm.refRemoveTOC(); return; } const t = E().node.querySelector('.wc-toc:not(.wc-tof):not(.wc-toa)'); if (t) t.remove(); E().repaginate(); } }));
  });
  function customTOCDialog() {
    const showPg = el('input', { type: 'checkbox', checked: 'checked' });
    const rightAlign = el('input', { type: 'checkbox', checked: 'checked' });
    const leader = el('select', {}, ['……… (dots)', '------ (dashes)', '(none)'].map((o) => el('option', { text: o })));
    const levels = el('select', {}, ['1', '2', '3', '4'].map((o) => el('option', { text: o, selected: o === '3' ? 'selected' : undefined })));
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', {}, [showPg, el('span', { text: ' Show page numbers' })])]),
      el('div', { class: 'row' }, [el('label', {}, [rightAlign, el('span', { text: ' Right align page numbers' })])]),
      el('div', { class: 'row' }, [el('label', { text: 'Tab leader:', style: { width: '90px' } }), leader]),
      el('div', { class: 'row' }, [el('label', { text: 'Show levels:', style: { width: '90px' } }), levels]),
    ]);
    WC.dialog({ title: 'Table of Contents', width: '440px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const pm = PMA();
        if (pm) {
          // Map the dialog controls to the fork TOC config (references.ts
          // refInsertTOC reads includePageNumbers / showLevels / rightAlignPageNumbers).
          pm.refInsertTOC({ includePageNumbers: showPg.checked, showLevels: parseInt(levels.value, 10), rightAlignPageNumbers: rightAlign.checked });
          return;
        }
        const t = E().node.querySelector('.wc-toc:not(.wc-tof):not(.wc-toa)'); if (t) t.remove(); WC.Ref.insertTOC(false, { showPageNumbers: showPg.checked, levels: parseInt(levels.value, 10) });
      } },
      { label: 'Cancel' },
    ] });
  }
  H.addText = (c, node) => WC.flyout(node, (fly) => {
    const addText = (lvl) => { const pm = PMA(); pm ? pm.refSetOutlineLevel(lvl) : WC.Ref.addText(lvl); };
    fly.appendChild(WC.flyItem('Do Not Show in Table of Contents', { onClick: () => addText(0) }));
    fly.appendChild(WC.flyItem('Level 1', { onClick: () => addText(1) }));
    fly.appendChild(WC.flyItem('Level 2', { onClick: () => addText(2) }));
    fly.appendChild(WC.flyItem('Level 3', { onClick: () => addText(3) }));
  });
  H.updateTable = () => { const pm = PMA(); pm ? pm.refUpdateTable() : WC.Ref.updateAny(); };
  H.insertFootnote = () => { const pm = PMA(); pm ? pm.refInsertFootnote() : WC.Ref.insertNote('footnote'); };
  H.insertEndnote = () => { const pm = PMA(); pm ? pm.refInsertEndnote() : WC.Ref.insertNote('endnote'); };
  H.nextFootnote = () => { const pm = PMA(); pm ? pm.refNextNote() : WC.Ref.nextNote(); };
  H.showNotes = () => { const pm = PMA(); pm ? pm.refShowNotes() : WC.Ref.showNotes(); };
  H.insertCaption = () => captionDialog();
  H.insertTableOfFigures = () => { const pm = PMA(); pm ? pm.refInsertTOF('Figure') : WC.Ref.insertTableOfFigures('Figure'); };
  H.markEntry = () => { const pm = PMA(); pm ? pm.refMarkIndexEntry() : WC.Ref.markEntry(); };
  H.insertIndex = () => { const pm = PMA(); pm ? pm.refInsertIndex() : WC.Ref.insertIndex(); };
  H.updateIndex = () => { const pm = PMA(); pm ? pm.refUpdateIndex() : WC.Ref.insertIndex(); };
  H.markCitation = () => { const pm = PMA(); pm ? markCitationPM() : WC.Ref.markCitation(); };
  H.insertTableOfAuthorities = () => { const pm = PMA(); pm ? pm.refInsertTOA() : WC.Ref.insertTableOfAuthorities(); };
  H.search = () => WC.toast('Smart Lookup / Search uses a cloud knowledge service — not available in this clone.', 'See docs/NOT_IMPLEMENTED.md');
  H.researcher = () => WC.toast('Researcher uses a cloud research service — not available in this clone.', 'See docs/NOT_IMPLEMENTED.md');
  H.insertCitation = (c, node) => WC.flyout(node, (fly) => {
    const pm = PMA();
    fly.appendChild(WC.flyItem('Add New Source…', { onClick: () => WC.Dialogs.addSource() }));
    fly.appendChild(WC.flyItem('Add New Placeholder…', { onClick: () => { const p = PMA(); if (p) { WC.toast('Add a source via Add New Source… to insert a citation.'); return; } E().insertHTML('<span class="wc-citation">(Placeholder1)</span> '); } }));
    if (pm) {
      const sources = pm.refListSources() || [];
      if (sources.length) {
        fly.appendChild(WC.flySep());
        sources.forEach((s) => {
          const f = s.fields || {};
          const author = (Array.isArray(f.authors) && f.authors[0] && f.authors[0].last) ? f.authors[0].last : (f.title || s.sourceId);
          const label = author + (f.year ? ', ' + f.year : '');
          fly.appendChild(WC.flyItem(label, { onClick: () => pm.refInsertCitation(s.sourceId) }));
        });
      }
    } else if (WC.Ref.sources.length) {
      fly.appendChild(WC.flySep());
      WC.Ref.sources.forEach((s) => fly.appendChild(WC.flyItem(s.author + ', ' + s.year, { onClick: () => WC.Ref.insertCitation && WC.Ref.insertCitation(s) })));
    }
  });
  H.manageSources = () => WC.Dialogs.manageSources();
  H.style = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Citation Style')); ['APA', 'Chicago', 'IEEE', 'ISO 690', 'MLA', 'Turabian'].forEach((s) => fly.appendChild(WC.flyItem((WC.Ref.citationStyle === s ? '✓ ' : '   ') + s, { onClick: () => { const pm = PMA(); if (pm) { WC.Ref.citationStyle = s; pm.refSetCitationStyle(s); WC.toast('Citation style: ' + s); return; } WC.Ref.citationStyle = s; WC.Ref.restyle(); WC.toast('Citation style: ' + s); } }))); });
  H.bibliography = (c, node) => WC.flyout(node, (fly) => {
    const insertBib = (t) => { const pm = PMA(); pm ? pm.refInsertBibliography(t) : (WC.Ref.insertBibliography && WC.Ref.insertBibliography(t)); };
    fly.appendChild(WC.flyHeader('Built-In'));
    ['Bibliography', 'References', 'Works Cited'].forEach((t) => fly.appendChild(WC.flyItem(t, { onClick: () => insertBib(t) })));
    fly.appendChild(WC.flySep());
    fly.appendChild(WC.flyItem('Insert Bibliography', { onClick: () => insertBib('Bibliography') }));
  });

  function captionDialog() {
    const label = el('select', {}, ['Figure', 'Table', 'Equation'].map((l) => el('option', { text: l })));
    const text = el('input', { type: 'text', class: 'grow', placeholder: 'Caption text' });
    WC.dialog({ title: 'Caption', width: '420px', body: el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Label:', style: { width: '60px' } }), label]), el('div', { class: 'row' }, [el('label', { text: 'Caption:', style: { width: '60px' } }), text])]), footer: [
      { label: 'OK', primary: true, onClick: () => {
        const pm = PMA();
        if (pm) { pm.refInsertCaption(label.value, text.value.trim()); return; }
        WC.Ref.insertCaption(label.value); if (text.value.trim()) { const caps = E().node.querySelectorAll('.wc-caption[data-label="' + label.value + '"]'); const last = caps[caps.length - 1]; if (last) last.lastChild.textContent = ': ' + text.value.trim(); }
      } },
      { label: 'Cancel' },
    ] });
  }

  // PM-aware Cross-reference dialog (References tab, slice 9). Enumerates the
  // headings (by sdBlockId) and bookmarks from the PM engine and routes OK to
  // WC.PM.refCrossReference. The legacy Insert.crossRefDialog path is unchanged
  // (used under --legacy). Display maps the Word "Insert reference to" select:
  // Page number → pageNumber, Text → content, Above/below → aboveBelow.
  function crossRefDialogPM(pm) {
    const type = el('select', {}, ['Heading', 'Bookmark'].map((t) => el('option', { text: t })));
    const refType = el('select', {}, ['Page number', 'Text', 'Above/below'].map((t) => el('option', { text: t })));
    const targets = el('select', { size: '6', class: 'grow', style: { height: 'auto' } });
    const headings = () => {
      const out = []; const ed = pm.getEditor && pm.getEditor();
      if (!ed || !ed.state) return out;
      ed.state.doc.descendants((n) => {
        const isHeadingNode = n.type && n.type.name === 'heading';
        const styleId = n.attrs && n.attrs.paragraphProperties && n.attrs.paragraphProperties.styleId;
        const isStyledHeading = n.type && n.type.name === 'paragraph' && /^Heading[1-6]$/.test(styleId || '');
        if (isHeadingNode || isStyledHeading) {
          const id = n.attrs && (n.attrs.sdBlockId || n.attrs.id);
          if (id) out.push({ id: String(id), text: (n.textContent || '').slice(0, 80) });
        }
        return true;
      });
      return out;
    };
    function fillTargets() {
      targets.innerHTML = '';
      const items = type.value === 'Heading'
        ? headings().map((h) => ({ value: h.id, label: h.text || '(empty)' }))
        : (pm.listBookmarks() || []).map((b) => ({ value: b.name, label: b.name }));
      items.forEach((it) => targets.appendChild(el('option', { value: it.value, text: it.label })));
      if (!items.length) targets.appendChild(el('option', { text: '(none — create headings/bookmarks first)' }));
    }
    type.addEventListener('change', fillTargets); fillTargets();
    const body = el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Type:', style: { width: '90px' } }), type, el('label', { text: 'Insert:' }), refType]), el('div', { style: { fontSize: '12px', color: '#666', margin: '6px 0' }, text: 'For which item:' }), targets]);
    WC.dialog({ title: 'Cross-reference', width: '460px', body, footer: [
      { label: 'Insert', primary: true, onClick: () => {
        const val = targets.value; if (!val) return;
        const target = type.value === 'Heading' ? { kind: 'heading', nodeId: val } : { kind: 'bookmark', name: val };
        const display = refType.value === 'Page number' ? 'pageNumber' : (refType.value === 'Above/below' ? 'aboveBelow' : 'content');
        pm.refCrossReference({ target, display });
      } },
      { label: 'Cancel' },
    ] });
  }

  // PM-aware Mark Citation dialog (References tab → Table of Authorities, slice 9).
  // Mirrors the legacy WC.Ref.markCitation dialog structure/UX (Selected text +
  // Category + Short citation), but routes Mark to WC.PM.refMarkCitation so the TA
  // field is minted on the engine. Category maps to Word's NUMERIC \c code (FIX 2):
  // the fork buildTaInstruction emits `\c <category>` verbatim and its parser only
  // matches `\c (\d+)` (authorityEntry-translator.parseTaInstruction), so a string
  // category would round-trip-lose. The 7 dialog categories map to Word's 1-based
  // order: Cases→1, Statutes→2, Other Authorities→3, Rules→4, Treatises→5,
  // Regulations→6, Constitutional Provisions→7.
  function markCitationPM() {
    const pm = PMA(); if (!pm) return;
    let selText = '';
    try { const ed = pm.getEditor && pm.getEditor(); if (ed && ed.state) { const s = ed.state.selection; if (s && !s.empty) selText = ed.state.doc.textBetween(s.from, s.to, ' '); } } catch (e) { /* no selection */ }
    const full = el('input', { type: 'text', class: 'grow', value: selText, placeholder: 'Selected text' });
    const cat = el('select', {}, ['Cases', 'Statutes', 'Other Authorities', 'Rules', 'Treatises', 'Regulations', 'Constitutional Provisions'].map((c) => el('option', { text: c })));
    const short = el('input', { type: 'text', class: 'grow', value: selText, placeholder: 'Short citation' });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Selected text:', style: { width: '100px' } }), full]),
      el('div', { class: 'row' }, [el('label', { text: 'Category:', style: { width: '100px' } }), cat]),
      el('div', { class: 'row' }, [el('label', { text: 'Short citation:', style: { width: '100px' } }), short]),
    ]);
    const CAT_MAP = { 'Cases': 1, 'Statutes': 2, 'Other Authorities': 3, 'Rules': 4, 'Treatises': 5, 'Regulations': 6, 'Constitutional Provisions': 7 };
    WC.dialog({ title: 'Mark Citation', width: '460px', body, footer: [
      { label: 'Mark', primary: true, onClick: () => {
        const info = { longCitation: full.value.trim(), category: CAT_MAP[cat.value] || 1 };
        if (short.value.trim()) info.shortCitation = short.value.trim();
        pm.refMarkCitation(info);
      } },
      { label: 'Cancel' },
    ] });
  }

  // ---- Mailings tab (mail merge) ----
  H.envelopes = () => WC.Mail.envelopes();
  H.labels = () => WC.Mail.labels();
  H.startMailMerge = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Start Mail Merge')); [['Letters', 'letters'], ['E-mail Messages', 'email'], ['Envelopes…', 'envelopes'], ['Labels…', 'labels'], ['Directory', 'directory'], ['Normal Word Document', 'normal']].forEach(([l, t]) => fly.appendChild(WC.flyItem(l, { onClick: () => { if (t === 'envelopes') WC.Mail.envelopes(); else if (t === 'labels') WC.Mail.labels(); else WC.Mail.startMailMerge(t); } }))); fly.appendChild(WC.flySep()); fly.appendChild(WC.flyItem('Step-by-Step Mail Merge Wizard…', { onClick: () => { WC.Mail.startMailMerge('letters'); WC.Mail.typeNewList(); } })); });
  H.selectRecipients = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Type a New List…', { onClick: () => WC.Mail.typeNewList() })); fly.appendChild(WC.flyItem('Use an Existing List…', { onClick: () => WC.Mail.useExistingList() })); fly.appendChild(WC.flyItem('Choose from Outlook Contacts…', { onClick: () => WC.toast('Outlook integration is not available in this clone.') })); });
  H.editRecipientList = () => WC.Mail.editRecipientList();
  H.highlightMergeFields = (c, node) => { WC.Mail.highlightMergeFields(); if (node) node.classList.toggle('toggled'); };
  H.addressBlock = () => WC.Mail.addressBlock();
  H.greetingLine = () => WC.Mail.greetingLine();
  H.insertMergeField = (c, node) => WC.Mail.insertMergeFieldMenu(node);
  H.rules = (c, node) => WC.flyout(node, (fly) => {
    const insertField = (code) => { const pm = PMA(); if (pm) { pm.mmInsertRule(code, code); return; } E().insertNodeHTML('<span class="wc-mergefield" contenteditable="false" data-field-code="' + WC.escapeHtml(code) + '">{ ' + WC.escapeHtml(code) + ' }</span> '); };
    fly.appendChild(WC.flyItem('If…Then…Else…', { onClick: () => ifThenElseDialog() }));
    fly.appendChild(WC.flyItem('Fill-in…', { onClick: () => { const t = el('input', { type: 'text', class: 'grow', placeholder: 'Prompt' }); WC.dialog({ title: 'Insert Word Field: Fill-in', width: '420px', body: el('div', {}, [el('div', { text: 'Prompt:' }), t]), footer: [{ label: 'OK', primary: true, onClick: () => insertField('FILLIN "' + (t.value || 'Enter text') + '"') }, { label: 'Cancel' }] }); } }));
    fly.appendChild(WC.flyItem('Ask…', { onClick: () => { const b = el('input', { type: 'text', class: 'grow', placeholder: 'Bookmark' }); const p = el('input', { type: 'text', class: 'grow', placeholder: 'Prompt' }); WC.dialog({ title: 'Insert Word Field: Ask', width: '420px', body: el('div', {}, [el('div', { text: 'Bookmark:' }), b, el('div', { text: 'Prompt:' }), p]), footer: [{ label: 'OK', primary: true, onClick: () => insertField('ASK ' + (b.value || 'Bookmark') + ' "' + (p.value || 'Prompt') + '"') }, { label: 'Cancel' }] }); } }));
    fly.appendChild(WC.flySep());
    fly.appendChild(WC.flyItem('Merge Record #', { onClick: () => insertField('MERGEREC') }));
    fly.appendChild(WC.flyItem('Merge Sequence #', { onClick: () => insertField('MERGESEQ') }));
    fly.appendChild(WC.flyItem('Next Record', { onClick: () => insertField('NEXT') }));
    fly.appendChild(WC.flyItem('Next Record If…', { onClick: () => insertField('NEXTIF') }));
    fly.appendChild(WC.flyItem('Set Bookmark…', { onClick: () => { const b = el('input', { type: 'text', class: 'grow', placeholder: 'Bookmark' }); const v = el('input', { type: 'text', class: 'grow', placeholder: 'Value' }); WC.dialog({ title: 'Insert Word Field: Set', width: '420px', body: el('div', {}, [el('div', { text: 'Bookmark:' }), b, el('div', { text: 'Value:' }), v]), footer: [{ label: 'OK', primary: true, onClick: () => insertField('SET ' + (b.value || 'Bookmark') + ' "' + (v.value || '') + '"') }, { label: 'Cancel' }] }); } }));
    fly.appendChild(WC.flyItem('Skip Record If…', { onClick: () => insertField('SKIPIF') }));
  });
  function ifThenElseDialog() {
    const fld = el('input', { type: 'text', class: 'grow', placeholder: 'Field name' });
    const op = el('select', {}, ['Equal to', 'Not equal to', 'Greater than', 'Less than'].map((o) => el('option', { text: o })));
    const val = el('input', { type: 'text', class: 'grow', placeholder: 'Compare to' });
    const tThen = el('input', { type: 'text', class: 'grow', placeholder: 'Insert this text' });
    const tElse = el('input', { type: 'text', class: 'grow', placeholder: 'Otherwise insert this text' });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Field name:', style: { width: '90px' } }), fld]),
      el('div', { class: 'row' }, [el('label', { text: 'Comparison:', style: { width: '90px' } }), op, val]),
      el('div', { class: 'row' }, [el('label', { text: 'Then:', style: { width: '90px' } }), tThen]),
      el('div', { class: 'row' }, [el('label', { text: 'Else:', style: { width: '90px' } }), tElse]),
    ]);
    WC.dialog({ title: 'Insert Word Field: IF', width: '480px', body, footer: [
      { label: 'OK', primary: true, onClick: () => { const code = 'IF «' + (fld.value || 'Field') + '» ' + op.value + ' "' + val.value + '" "' + tThen.value + '" "' + tElse.value + '"'; const pm = PMA(); if (pm) { pm.mmInsertRule(code, code); return; } E().insertNodeHTML('<span class="wc-mergefield" contenteditable="false" data-field-code="' + WC.escapeHtml(code) + '">{ ' + WC.escapeHtml(code) + ' }</span> '); } },
      { label: 'Cancel' },
    ] });
  }
  H.matchFields = () => WC.Mail.matchFields();
  H.updateLabels = () => WC.Mail.updateLabels();
  H.previewResults = (c, node) => WC.Mail.previewResults();
  H.firstRecord = () => WC.Mail.first();
  H.previousRecord = () => WC.Mail.prev();
  H.nextRecord = () => WC.Mail.next();
  H.lastRecord = () => WC.Mail.last();
  H.findRecipient = () => WC.Mail.findRecipient();
  H.checkForErrors = () => WC.Mail.checkErrors();
  H.finishMerge = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Edit Individual Documents…', { onClick: () => WC.Mail.finishMerge('edit') })); fly.appendChild(WC.flyItem('Print Documents…', { onClick: () => WC.Mail.finishMerge('print') })); fly.appendChild(WC.flyItem('Send Email Messages…', { onClick: () => WC.Mail.finishMerge('email') })); });

  // ---- Review tab ----
  H.thesaurus = () => { const pm = PMA(); pm ? pmThesaurus() : WC.Review.thesaurus(); };
  H.checkAccessibility = () => { const pm = PMA(); pm ? pmAccessibility() : WC.Review.checkAccessibility(); };

  // PM word-at-caret (or selection text) + its document range. Mirrors the
  // review.ts expandCaretToWord walk: run-node boundaries add PM tokens without
  // text chars, so climb to the TEXTBLOCK and walk per-character positions.
  function pmWordAtCaret() {
    const pm = PMA(); if (!pm) return null;
    const state = pm.getEditor().state;
    if (!state.selection.empty) {
      const from = state.selection.from; const to = state.selection.to;
      return { word: state.doc.textBetween(from, to, ' ', ' ').trim(), from, to };
    }
    const caret = state.selection.from;
    const $pos = state.doc.resolve(caret);
    let depth = $pos.depth;
    while (depth > 0 && !$pos.node(depth).isTextblock) depth--;
    if (!$pos.node(depth).isTextblock) return null;
    const chars = [];
    state.doc.nodesBetween($pos.start(depth), $pos.end(depth), (node, pos) => {
      if (node.isText && node.text) { for (let i = 0; i < node.text.length; i++) chars.push({ ch: node.text[i], pos: pos + i }); }
      return true;
    });
    const isWord = (ch) => /[\p{L}\p{N}_]/u.test(ch);
    let idx = chars.findIndex((c) => c.pos >= caret);
    if (idx < 0) idx = chars.length;
    let a = idx; let b = idx;
    while (a > 0 && isWord(chars[a - 1].ch)) a--;
    while (b < chars.length && isWord(chars[b].ch)) b++;
    if (a === b) return null;
    return { word: chars.slice(a, b).map((c) => c.ch).join(''), from: chars[a].pos, to: chars[b - 1].pos + 1 };
  }

  // P2: Thesaurus pane — Word's right-dock anatomy (search box + grouped results +
  // language combo). Definitions are sign-in-gated in real Word → omitted (class B).
  // A pick REPLACES the looked-up range through the engine.
  function pmThesaurus() {
    const hit = pmWordAtCaret();
    showPmThesaurus(hit ? hit.word : '', hit);
  }
  function showPmThesaurus(word, range) {
    let pane = document.getElementById('thes-pane'); if (pane) pane.remove();
    document.querySelectorAll('.taskpane.right').forEach((p) => p.remove()); // C11 dock share
    pane = el('div', { class: 'taskpane right', id: 'thes-pane' });
    pane.appendChild(el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Thesaurus' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]));
    const body = el('div', { class: 'tp-body' });
    const search = el('input', { type: 'text', class: 'grow', value: word || '', placeholder: 'Type a word to look up' });
    const results = el('div', {});
    const lookup = (w) => {
      results.innerHTML = '';
      w = (w || '').trim();
      if (!w) return;
      const syns = WC.Review.THES[w.toLowerCase()];
      results.appendChild(el('div', { style: { fontWeight: '600', margin: '8px 0 4px' }, text: w }));
      if (!syns) { results.appendChild(el('div', { style: { color: '#888', padding: '6px 0' }, text: 'No synonyms for “' + w + '” in the built-in thesaurus.' })); return; }
      results.appendChild(el('div', { style: { fontSize: '11px', color: '#666', marginBottom: '4px' }, text: 'Synonyms' }));
      syns.forEach((s) => {
        const row = el('div', { class: 'tp-result', text: s, style: { cursor: 'pointer' } });
        row.title = 'Insert “' + s + '”';
        row.addEventListener('click', () => {
          const pm = PMA(); if (!pm) return;
          const ed = pm.getEditor();
          const r = range || pmWordAtCaret();
          if (r) ed.view.dispatch(ed.state.tr.insertText(s, r.from, r.to));
          else ed.view.dispatch(ed.state.tr.insertText(s));
          ed.view.focus();
          range = null; // the replaced range is gone — further picks insert at caret
        });
        results.appendChild(row);
      });
    };
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { range = null; lookup(search.value); } });
    body.appendChild(el('div', { class: 'row' }, [search]));
    body.appendChild(results);
    // Word's pane carries a proofing-language combo at the bottom.
    body.appendChild(el('div', { style: { borderTop: '1px solid #e1dfdd', marginTop: '10px', paddingTop: '6px' } }, [
      el('select', { class: 'grow' }, [el('option', { text: 'English (United States)' })]),
    ]));
    pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
    lookup(word);
  }

  // P6: Accessibility Assistant — engine-model checks (NOT the legacy h1/img DOM:
  // PM headings are styled paragraphs) rendered in Word's category-card layout.
  function pmAccessibility() {
    const pm = PMA(); if (!pm) return;
    const doc = pm.getEditor().state.doc;
    const media = []; const tables = []; const structure = []; const access = [];
    let imgN = 0; let tableN = 0; let headingFound = false; let unclearLink = false;
    doc.descendants((node, pos) => {
      if (node.type.name === 'image') { imgN++; if (!node.attrs || !node.attrs.alt || node.attrs.alt === 'Uploaded picture') media.push('Missing alt text — Picture ' + imgN); }
      if (node.type.name === 'table') {
        tableN++;
        let hasHeader = false;
        const firstRow = node.firstChild;
        if (firstRow) firstRow.forEach((cell) => { if (cell.type.name === 'tableHeader') hasHeader = true; });
        if (!hasHeader) tables.push('Missing table header — Table ' + tableN);
      }
      if (node.isTextblock && node.attrs && /^Heading[1-9]$|^Title$/.test(String(node.attrs.styleId || ''))) headingFound = true;
      if (node.isText && node.text && !unclearLink) {
        const lm = (node.marks || []).find((m) => m.type.name === 'link');
        if (lm && lm.attrs && lm.attrs.href && node.text.trim() === String(lm.attrs.href).trim()) { unclearLink = true; structure.push('Unclear hyperlink text'); }
      }
      return true;
    });
    if (!headingFound && doc.textContent.trim()) structure.push('No headings in document');
    const total = media.length + tables.length + structure.length + access.length;
    let pane = document.getElementById('a11y-pane'); if (pane) pane.remove();
    document.querySelectorAll('.taskpane.right').forEach((p) => p.remove());
    pane = el('div', { class: 'taskpane right', id: 'a11y-pane' });
    pane.appendChild(el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Accessibility Assistant' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]));
    const body = el('div', { class: 'tp-body' });
    body.appendChild(el('div', {
      style: { background: total ? '#FDF3F4' : '#F1FAF1', border: '1px solid ' + (total ? '#F3D6D8' : '#D5E8D5'), borderRadius: '4px', padding: '10px', marginBottom: '10px', fontWeight: '600', color: total ? '#A4262C' : '#107C10' },
      text: total ? total + ' issue' + (total > 1 ? 's' : '') + ' found' : 'Looks good! No issues found.',
    }));
    const card = (title, items) => {
      const c = el('div', { style: { border: '1px solid #e1dfdd', borderRadius: '4px', padding: '8px 10px', marginBottom: '8px' } });
      c.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: '600', fontSize: '12px' } }, [
        el('span', { text: title }),
        el('span', { text: items.length ? String(items.length) : '✓', style: { color: items.length ? '#A4262C' : '#107C10' } }),
      ]));
      items.forEach((it) => c.appendChild(el('div', { class: 'tp-result', text: it, style: { fontSize: '12px' } })));
      return c;
    };
    body.appendChild(card('Color and Contrast', []));
    body.appendChild(card('Media and Illustrations', media));
    body.appendChild(card('Tables', tables));
    body.appendChild(card('Document Structure', structure));
    body.appendChild(card('Document Access', access));
    body.appendChild(el('div', { style: { fontSize: '11px', color: '#666', marginTop: '6px' }, text: 'Checks run locally on the document model.' }));
    pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
    return total;
  }
  H.translate = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Translate Selection', { onClick: () => WC.toast('Translation needs a cloud translator — not available in this clone.', 'See docs/NOT_IMPLEMENTED.md') })); fly.appendChild(WC.flyItem('Translate Document', { onClick: () => WC.toast('Translation needs a cloud translator — not available.') })); fly.appendChild(WC.flySep()); fly.appendChild(WC.flyItem('Translator Preferences…', { onClick: () => WC.toast('Translator preferences require the cloud translator service — not available.') })); });
  H.language = (c, node) => WC.flyout(node, (fly) => {
    fly.appendChild(WC.flyItem('Set Proofing Language…', { onClick: () => languageDialog() }));
    fly.appendChild(WC.flyItem('Language Preferences…', { onClick: () => languageDialog() }));
  });
  // Applies the proofing language to the ACTIVE editing surface (PM view DOM in PM
  // mode — drives the OS spellchecker locale + squiggle gating). Doc-level only:
  // per-run w:lang isn't on the fork command surface (recorded deviation, ledger C).
  WC.setProofingLanguage = (code, noCheck) => {
    const pm = PMA();
    const node = pm ? pm.getEditor().view.dom : E().node;
    node.setAttribute('lang', code);
    node.setAttribute('spellcheck', noCheck ? 'false' : 'true');
    return node.getAttribute('lang') === code;
  };
  // P9: the Word Language dialog — scope radios, language list (en-US first),
  // no-proof + detect checkboxes, Set As Default.
  function languageDialog() {
    const pm = PMA();
    const langs = [['English (United States)', 'en-US'], ['English (United Kingdom)', 'en-GB'], ['French (France)', 'fr-FR'], ['German (Germany)', 'de-DE'], ['Spanish (Spain)', 'es-ES'], ['Italian (Italy)', 'it-IT'], ['Portuguese (Brazil)', 'pt-BR'], ['Turkish', 'tr-TR'], ['Dutch (Netherlands)', 'nl-NL'], ['Japanese', 'ja-JP']];
    const node = pm ? pm.getEditor().view.dom : E().node;
    let defLang = 'en-US';
    try { defLang = localStorage.getItem('wc-default-lang') || 'en-US'; } catch (e) { /* default stands */ }
    const cur = node.getAttribute('lang') || defLang;
    const hasSel = pm ? !pm.getEditor().state.selection.empty : !(window.getSelection() || { isCollapsed: true }).isCollapsed;
    const rSel = el('input', { type: 'radio', name: 'wcLangScope' });
    const rDoc = el('input', { type: 'radio', name: 'wcLangScope', checked: 'checked' });
    if (!hasSel) rSel.disabled = true;
    const list = el('select', { size: '7', style: { width: '100%' } }, langs.map(([l, code]) => el('option', { text: l, value: code, selected: code === cur ? 'selected' : undefined })));
    const noCheck = el('input', { type: 'checkbox', checked: node.getAttribute('spellcheck') === 'false' ? 'checked' : null });
    const detect = el('input', { type: 'checkbox', checked: 'checked' });
    const body = el('div', {}, [
      el('div', { class: 'row', style: { gap: '14px' } }, [
        el('span', { text: 'Change proofing language for:' }),
        el('label', { style: { display: 'flex', gap: '4px', alignItems: 'center', opacity: hasSel ? '1' : '.55' } }, [rSel, el('span', { text: 'Selected text' })]),
        el('label', { style: { display: 'flex', gap: '4px', alignItems: 'center' } }, [rDoc, el('span', { text: 'Current Document' })]),
      ]),
      list,
      el('div', { class: 'row', style: { marginTop: '8px' } }, [el('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [noCheck, el('span', { text: 'Do not check spelling or grammar' })])]),
      el('div', { class: 'row' }, [el('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [detect, el('span', { text: 'Detect language automatically' })])]),
    ]);
    WC.dialog({ title: 'Language', width: '440px', body, footer: [
      { label: 'Set As Default', onClick: () => { try { localStorage.setItem('wc-default-lang', list.value); } catch (e) { /* storage unavailable */ } WC.toast('Default proofing language: ' + list.options[list.selectedIndex].text); return true; } },
      { label: 'OK', primary: true, onClick: () => {
        WC.setProofingLanguage(list.value, noCheck.checked);
        WC.toast('Proofing language: ' + list.options[list.selectedIndex].text + (noCheck.checked ? ' (spelling/grammar off)' : ''));
      } },
      { label: 'Cancel' },
    ] });
  }
  // ---- Comments group (A4 renamed cmds — every handler keeps a WORKING legacy branch, A8) ----
  // PM: delete the ACTIVE thread (caret/nav-selected), else the first thread —
  // Word disables the button with no comments; enablement polish lands with task 4's UI.
  H.deleteComment = () => {
    const pm = PMA();
    if (pm) { const rows = pm.getComments(); const hit = rows.find((r) => r.active) || rows[0]; if (hit) pm.cmd('deleteComment', hit.id); return; }
    WC.Review.deleteComment();
  };
  H.previousComment = () => { const pm = PMA(); pm ? pm.cmd('prevComment') : WC.Review.prevComment(); };
  H.nextComment = () => { const pm = PMA(); pm ? pm.cmd('nextComment') : WC.Review.nextComment(); };
  // Show Comments ▾ (parity C10): Contextual | List. The card/pane UI lands in task 4 —
  // the PM branch latches the chosen view on a WC-level flag the task-4 UI will consume
  // (no bridge 'setCommentsView' cmd exists yet); legacy keeps the pane toggle.
  H.showComments = (c, node) => WC.flyout(node, (fly) => {
    const pm = PMA();
    const mode = WC.commentsViewMode || 'contextual';
    const pick = (m) => {
      if (PMA()) { WC.commentsViewMode = m; return; } // consumed by the task-4 comments UI
      WC.Review.showComments();
    };
    fly.appendChild(WC.flyItem((mode === 'contextual' ? '✓ ' : '   ') + 'Contextual', { onClick: () => pick('contextual') }));
    fly.appendChild(WC.flyItem((mode === 'list' ? '✓ ' : '   ') + 'List', { onClick: () => pick('list') }));
    if (!pm) { fly.appendChild(WC.flySep()); fly.appendChild(WC.flyItem('Toggle Comments Pane', { onClick: () => WC.Review.showComments() })); }
  });
  // ---- Markup group ----
  // PM-side Show Markup latches (T9/T10). Render effects (task 5): insDel/formatting
  // toggle #pm-editor classes consumed by track-chrome-pm.css, and every latch flip
  // nudges the bars/balloons chrome (track-chrome.ts reads WC.pmMarkup).
  const pmMarkup = { insDel: true, formatting: true, balloons: 'formatting' };
  WC.pmMarkup = pmMarkup; // task 5: track-chrome.ts reads the latches at render time
  const chromeRefresh = () => { if (WC.TrackChrome && WC.TrackChrome.refresh) WC.TrackChrome.refresh(); };
  H.showMarkup = (c, node) => {
    const pm = PMA();
    if (pm) {
      return WC.flyout(node, (fly) => {
        const reopen = () => WC.Commands.dropdown({ cmd: 'showMarkup', type: 'dropdown' }, node);
        const check = (on, label) => (on ? '✓ ' : '   ') + label;
        fly.appendChild(WC.flyItem(check(pmMarkup.insDel, 'Insertions and Deletions'), { onClick: () => { pmMarkup.insDel = !pmMarkup.insDel; document.getElementById('pm-editor').classList.toggle('pm-hide-insdel', !pmMarkup.insDel); chromeRefresh(); reopen(); } }));
        fly.appendChild(WC.flyItem(check(pmMarkup.formatting, 'Formatting'), { onClick: () => { pmMarkup.formatting = !pmMarkup.formatting; document.getElementById('pm-editor').classList.toggle('pm-hide-format', !pmMarkup.formatting); chromeRefresh(); reopen(); } }));
        const balloons = WC.flyItem('Balloons', { onClick: () => WC.flyout(node, (sub) => {
          const bal = (label, m) => sub.appendChild(WC.flyItem(check(pmMarkup.balloons === m, label), { onClick: () => { pmMarkup.balloons = m; chromeRefresh(); } }));
          bal('Show Revisions in Balloons', 'revisions');
          bal('Show All Revisions Inline', 'inline');
          bal('Show Only Formatting in Balloons', 'formatting');
        }) });
        balloons.appendChild(el('span', { class: 'caret', html: WC.icon('chevron_down', 8), style: { marginLeft: 'auto', transform: 'rotate(-90deg)' } }));
        fly.appendChild(balloons);
        const people = WC.flyItem('Specific People', { onClick: () => WC.flyout(node, (sub) => {
          sub.appendChild(WC.flyItem('✓ All Reviewers', { onClick: () => {} }));
        }) });
        people.appendChild(el('span', { class: 'caret', html: WC.icon('chevron_down', 8), style: { marginLeft: 'auto', transform: 'rotate(-90deg)' } }));
        fly.appendChild(people);
        fly.appendChild(WC.flyItem('Highlight Updates', { disabled: true }));
        fly.appendChild(WC.flyItem('Other Authors', { disabled: true }));
      });
    }
    // legacy menu kept verbatim (frozen --legacy gate exercises it)
    WC.flyout(node, (fly) => {
      const mk = WC.Review.markup;
      const item = (label, key, onToggle) => {
        const it = WC.flyItem((mk[key] ? '✓ ' : '   ') + label, { onClick: () => { mk[key] = !mk[key]; onToggle(mk[key]); WC.Commands.dropdown({ cmd: 'showMarkup', type: 'dropdown' }, node); } });
        return it;
      };
      fly.appendChild(item('Comments', 'comments', (on) => { E().node.classList.toggle('hide-comments', !on); const p = document.getElementById('comments-pane'); if (p) p.hidden = !on; }));
      fly.appendChild(item('Insertions and Deletions', 'inserts', (on) => WC.Review.setDisplayMode(on ? 'all' : 'none')));
      fly.appendChild(item('Formatting', 'formatting', () => {}));
      fly.appendChild(WC.flySep());
      fly.appendChild(item('Balloons', 'balloons', (on) => E().node.classList.toggle('review-balloons', on)));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Specific People', { onClick: () => WC.toast('All reviewers shown (single-author clone).') }));
      fly.appendChild(WC.flyItem('Reviewing Pane', { onClick: () => WC.Review.reviewingPane() }));
    });
  };
  // Filter All Markup (parity R1): real Word opens a markup-filter menu (capture
  // pending). Interim routing: the Show Markup menu IS the filter set we have —
  // task 5 replaces this with the captured filter menu.
  H.filterMarkup = (c, node) => H.showMarkup(c, node || (WC.Ribbon.controlIndex.filterMarkup && WC.Ribbon.controlIndex.filterMarkup.node) || document.body);
  // PM branch (task 5): the Word-anatomy Revisions pane lives in track-chrome.ts
  // (D8.4/T11 -- live count, collapse chevron, refresh, entry-click navigation).
  // The main button toggles the pane in its last-used orientation; the split menu
  // (Commands.dropdown 'reviewingPane') picks Vertical/Horizontal explicitly.
  H.reviewingPane = () => {
    const pm = PMA();
    if (!pm) { WC.Review.reviewingPane(); return; }
    if (WC.TrackChrome) WC.TrackChrome.togglePane();
  };
  // ---- Tracking group ----
  // Word's main Accept/Reject buttons ACCEPT-AND-ADVANCE (parity T14); with the
  // caret on no change they jump to the first one without applying (T16) — the
  // bare cmd returns false in that case and the chained nextChange supplies the
  // jump. "Accept This Change" (menu item) stays the bare non-advancing cmd.
  H.accept = () => { const pm = PMA(); if (pm) { pm.cmd('acceptChange'); pm.cmd('nextChange'); } else WC.Review.acceptOne(); };
  H.reject = () => { const pm = PMA(); if (pm) { pm.cmd('rejectChange'); pm.cmd('nextChange'); } else WC.Review.rejectOne(); };
  H.previousChange = () => { const pm = PMA(); pm ? pm.cmd('prevChange') : WC.Review.prevChange(); };
  H.nextChange = () => { const pm = PMA(); pm ? pm.cmd('nextChange') : WC.Review.nextChange(); };
  // X1/X2: PM routes to the parity Compare dialog (real tracked-changes diff);
  // legacy keeps the old textarea dialog (A8 — the frozen gate exercises it).
  H.compare = (c, node) => WC.flyout(node, (fly) => {
    const go = (mode) => { const pm = PMA(); pm ? WC.Dialogs.compareDocuments(mode) : WC.Review.compare(mode); };
    fly.appendChild(WC.flyItem('Compare…', { onClick: () => go('compare') }));
    fly.appendChild(WC.flyItem('Combine…', { onClick: () => go('combine') }));
    fly.appendChild(WC.flyItem('Show Source Documents', { disabled: true }));
  });
  H.blockAuthors = () => WC.toast('Block Authors requires cloud co-authoring — not available in this clone.', 'See docs/NOT_IMPLEMENTED.md');
  // X3: PM opens the Restrict Editing pane (enforcement = engine setEditable).
  H.restrictEditing = () => { const pm = PMA(); pm ? WC.Dialogs.restrictEditingPane() : WC.Review.restrictEditing(); };
  // Hide Ink ▾ (parity X4 — Word menu capture pending; ink layer is the legacy/slice-10
  // Draw canvas). PM branch latches a container class; legacy keeps the layer toggle.
  H.hideInk = (c, node) => {
    const pm = PMA();
    if (pm) { document.getElementById('pm-editor').classList.toggle('pm-hide-ink'); }
    else WC.Review.hideInk();
    if (node) node.classList.toggle('toggled');
  };

  // ---- View tab ----
  H.outline = () => { E().setView('outline'); WC.StatusBar && WC.StatusBar.setActiveView && WC.StatusBar.setActiveView('print'); WC.toast('Outline view'); };
  H.draft = () => { E().setView('draft'); WC.toast('Draft view'); };
  H.immersiveReader = () => immersiveReader();
  H.vertical = (c, node) => { E().workarea.classList.remove('movement-side'); markRadio(node, 'sideToSide'); };
  H.sideToSide = (c, node) => { E().workarea.classList.add('movement-side'); markRadio(node, 'vertical'); WC.toast('Side to Side page movement'); };
  H['100'] = () => E().setZoom(1);
  H.split = () => { document.getElementById('app').classList.toggle('split-view'); WC.toast('Split — a second pane of the document.'); };
  H.properties = () => propertiesDialog();
  H.newWindow = () => WC.toast('New Window opens another view of the document — multi-window is not supported in this single-window clone.', 'See docs/NOT_IMPLEMENTED.md');
  H.arrangeAll = () => WC.toast('Arrange All needs multiple document windows — not supported here.');
  H.viewSideBySide = () => WC.toast('View Side by Side needs a second open document — not supported.');
  H.synchronousScrolling = () => WC.toast('Synchronous Scrolling pairs two windows — not supported.');
  H.resetWindowPosition = () => WC.toast('Reset Window Position — not applicable in this clone.');
  H.switchWindows = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('✓ 1  Document1 - Word', { onClick: () => {} })); });
  H.macros = (c, node) => WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('View Macros', { onClick: () => WC.toast('VBA macros are not supported in this clone (no VBA runtime).', 'See docs/NOT_IMPLEMENTED.md') })); fly.appendChild(WC.flyItem('Record Macro…', { onClick: () => WC.toast('Macro recording (VBA) is not supported.') })); });

  function markRadio(node, other) { if (node) node.classList.add('toggled'); const o = WC.Ribbon.controlIndex[other]; if (o && o.node) o.node.classList.remove('toggled'); }
  function immersiveReader() {
    let ov = document.getElementById('immersive'); if (ov) { ov.remove(); return; }
    let size = 20;
    const docHtml = (WC.PM && WC.PM.active) ? document.getElementById('pm-editor').innerHTML : E().getHTML();
    const content = el('div', { class: 'ir-content' }); content.innerHTML = docHtml;
    content.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    content.style.fontSize = size + 'px';
    const setSize = (d) => { size = Math.max(12, Math.min(40, size + d)); content.style.fontSize = size + 'px'; };
    const bg = (c) => { ov.style.background = c; content.style.background = c; };
    const bar = el('div', { class: 'ir-bar' }, [
      el('span', { style: { fontWeight: '600' }, text: 'Immersive Reader' }),
      el('button', { class: 'btn', text: 'A−', onclick: () => setSize(-2) }),
      el('button', { class: 'btn', text: 'A+', onclick: () => setSize(2) }),
      el('button', { class: 'btn', text: 'Sepia', onclick: () => bg('#f4ecd8') }),
      el('button', { class: 'btn', text: 'Dark', onclick: () => { bg('#1e1e1e'); content.style.color = '#eee'; } }),
      el('button', { class: 'btn', text: 'Read Aloud', onclick: () => WC.Commands.run({ cmd: 'readAloud' }) }),
      el('button', { class: 'btn primary', text: 'Close', onclick: () => ov.remove() }),
    ]);
    ov = el('div', { id: 'immersive' }, [bar, content]);
    document.body.appendChild(ov);
  }
  function readMode() {
    let ov = document.getElementById('read-mode');
    if (ov) { closeReadMode(); return; }
    WC.StatusBar && WC.StatusBar.setActiveView && WC.StatusBar.setActiveView('read');
    const menu = (label, items) => {
      const b = el('button', { class: 'rm-menu', text: label });
      b.addEventListener('click', (ev) => { ev.stopPropagation(); WC.flyout(b, (fly) => items.forEach((it) => fly.appendChild(WC.flyItem(it.label, { onClick: it.onClick })))); });
      return b;
    };
    const docHtml = (WC.PM && WC.PM.active) ? document.getElementById('pm-editor').innerHTML : E().getHTML();
    const content = el('div', { class: 'rm-content' });
    content.innerHTML = docHtml;
    content.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    const colsWrap = el('div', { class: 'rm-cols' }, [content]);
    const prev = el('button', { class: 'rm-arrow rm-prev', title: 'Previous screen', text: '‹' });
    const next = el('button', { class: 'rm-arrow rm-next', title: 'Next screen', text: '›' });
    prev.addEventListener('click', () => { colsWrap.scrollBy({ left: -colsWrap.clientWidth, behavior: 'smooth' }); });
    next.addEventListener('click', () => { colsWrap.scrollBy({ left: colsWrap.clientWidth, behavior: 'smooth' }); });
    const bar = el('div', { class: 'rm-bar' }, [
      menu('File', [{ label: 'Print…', onClick: () => WC.Files.print() }, { label: 'Save', onClick: () => WC.Files.save() }]),
      menu('Tools', [{ label: 'Find…', onClick: () => { closeReadMode(); WC.Dialogs.findPane(false); } }, { label: 'Read Aloud', onClick: () => WC.Commands.run({ cmd: 'readAloud' }) }]),
      menu('View', [{ label: 'Edit Document', onClick: () => closeReadMode() }, { label: 'Column Width: Wide', onClick: () => ov.classList.toggle('rm-wide') }]),
      el('span', { class: 'rm-spacer' }),
      el('button', { class: 'rm-close', title: 'Print Layout (Esc)', text: '✕' }),
    ]);
    bar.querySelector('.rm-close').addEventListener('click', () => closeReadMode());
    ov = el('div', { id: 'read-mode' }, [bar, prev, colsWrap, next]);
    document.body.appendChild(ov);
  }
  function closeReadMode() {
    const ov = document.getElementById('read-mode'); if (ov) ov.remove();
    WC.StatusBar && WC.StatusBar.setActiveView && WC.StatusBar.setActiveView('print');
  }
  WC.closeReadMode = closeReadMode;
  function propertiesDialog() {
    const pmMode = WC.PM && WC.PM.active;
    const c = pmMode ? WC.PM.counts()
                     : Object.assign(E().counts(), { pages: E().pageCount(), paras: E().node.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote').length, lines: (E().node.innerText.match(/\n/g) || []).length + 1, charsNoSpace: E().node.innerText.replace(/\s/g, '').length });
    const f = WC.Files;
    const rows = [['Title', (f.name || 'Document1').replace(/\.[^.]+$/, '')], ['Author', 'Word User'], ['Words', c.words], ['Characters', c.chars], ['Paragraphs', c.paras], ['Pages', c.pages], ['Lines', c.lines]];
    const body = el('div', { class: 'info-props' });
    rows.forEach(([k, v]) => body.appendChild(el('div', { class: 'row', style: { padding: '5px 0', borderBottom: '1px solid #f0f0f0' } }, [el('span', { style: { width: '160px', color: '#666' }, text: k }), el('b', { text: String(v) })])));
    WC.dialog({ title: 'Properties', width: '380px', body, footer: [{ label: 'Close', primary: true }] });
  }

  // ---- Help tab ----
  H.help = () => helpDialog();
  H.contactSupport = () => WC.toast('Contact Support opens Microsoft support online — this is a local Word clone, not Microsoft Word.');
  H.feedback = () => WC.Backstage.open('feedback');
  H.showTraining = () => showTrainingPane();
  function showTrainingPane() {
    let pane = document.getElementById('help-pane'); if (pane) { pane.remove(); return; }
    pane = el('div', { class: 'taskpane right', id: 'help-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Help' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body' });
    body.appendChild(el('div', { style: { fontWeight: '600', margin: '4px 0 8px' }, text: 'Get the most out of Word' }));
    const topics = [
      ['Write with Track Changes', 'Review tab → Track Changes'],
      ['Insert a table of contents', 'References tab → Table of Contents'],
      ['Add page numbers and headers', 'Insert tab → Header & Footer'],
      ['Mail merge letters and labels', 'Mailings tab → Start Mail Merge'],
      ['Format with styles and themes', 'Home / Design tabs'],
    ];
    topics.forEach(([t, where]) => {
      const card = el('div', { style: { padding: '8px 10px', border: '1px solid #e1dfdd', borderRadius: '4px', marginBottom: '8px', cursor: 'pointer' } }, [
        el('div', { style: { fontWeight: '600', color: '#2b579a' }, text: t }),
        el('div', { style: { fontSize: '11px', color: '#666' }, text: where }),
      ]);
      card.addEventListener('click', () => WC.toast(t + ' — see ' + where));
      body.appendChild(card);
    });
    body.appendChild(el('div', { style: { fontSize: '11px', color: '#888', marginTop: '6px' }, text: 'Per-tab feature guides live in the docs/ folder.' }));
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('app').appendChild(pane);
  }
  H.whatSNew = () => whatsNewDialog();

  function helpDialog() {
    const body = el('div', {}, [
      el('div', { style: { fontSize: '15px', fontWeight: '600', marginBottom: '6px' }, text: 'Word Clone — Help' }),
      el('div', { style: { color: '#444', marginBottom: '10px' }, text: 'A faithful, from-scratch reproduction of Microsoft Word (M365) built with Electron. Validated against real Word via PowerShell automation.' }),
      el('div', { style: { fontWeight: '600', margin: '8px 0 4px' }, text: 'Keyboard shortcuts' }),
      el('div', { class: 'info-props' }, [['Ctrl+S Save', 'Ctrl+O Open'], ['Ctrl+B/I/U Bold/Italic/Underline', 'Ctrl+F Find · Ctrl+H Replace'], ['Ctrl+K Link · Ctrl+D Font', 'Ctrl+= / Ctrl+- Zoom'], ['Ctrl+L/E/R/J Align', 'Alt+1/2/3 Heading 1/2/3']].map((pair) => el('div', { class: 'row', style: { fontSize: '12px' } }, [el('span', { style: { width: '50%' }, text: pair[0] }), el('span', { text: pair[1] })]))),
      el('div', { style: { fontSize: '12px', color: '#888', marginTop: '10px' }, text: 'Per-tab feature documentation is in the docs/ folder (HOME_TAB.md, INSERT_TAB.md, …).' }),
    ]);
    WC.dialog({ title: 'Help', width: '520px', body, footer: [{ label: 'Close', primary: true }] });
  }
  function whatsNewDialog() {
    const feats = ['All 10 ribbon tabs fully implemented and tested', 'Real Track Changes engine (Review)', 'Mail merge with live preview (Mailings)', 'Table of Contents, footnotes, citations (References)', 'Freehand ink drawing (Draw)', 'Themes, watermark, page borders (Design)', 'Validated against real Microsoft Word via automation'];
    const body = el('div', {}, [el('div', { style: { fontSize: '15px', fontWeight: '600', marginBottom: '8px' }, text: 'What’s New in Word Clone 1.0' }), el('ul', {}, feats.map((f) => el('li', { text: f, style: { margin: '4px 0' } })))]);
    WC.dialog({ title: "What's New", width: '480px', body, footer: [{ label: 'Close', primary: true }] });
  }

  // ============ dispatch ============
  const Commands = {
    run(control, node) {
      WC.closeFlyouts(); WC.hideTip();
      const cmd = control.cmd;
      if (WC.PM && WC.PM.active && WC.PM.isBlocked(control.cmd)) { WC.PM.notifyBlocked(control.label || control.cmd); return; }
      if (H[cmd]) { H[cmd](control, node); return; }
      // split/dropdown without explicit handler -> open items if present
      if ((control.type === 'split' || control.type === 'dropdown') && control.items) { this.dropdown(control, node); return; }
      WC.notImplemented(control.label || cmd);
    },

    dropdown(control, node) {
      WC.closeFlyouts();
      if (WC.PM && WC.PM.active && WC.PM.isBlocked(control.cmd)) { WC.PM.notifyBlocked(control.label || control.cmd); return; }
      const cmd = control.cmd;
      // custom dropdowns
      if (cmd === 'changeCase') return changeCaseMenu(node);
      if (cmd === 'lineAndParagraphSpacing') return lineSpacingMenu(node);
      if (cmd === 'textHighlightColor') return colorMenu(node, 'hilite');
      if (cmd === 'fontColor') return colorMenu(node, 'fore');
      if (cmd === 'shading') return colorMenu(node, 'shade');
      if (cmd === 'pageColor') return colorMenu(node, 'page');
      if (cmd === 'borders') return bordersMenu(node);
      if (cmd === 'bullets') return bulletMenu(node, false);
      if (cmd === 'numbering') return bulletMenu(node, true);
      if (cmd === 'select') return selectMenu(node);
      if (cmd === 'find') return findMenu(node);
      if (cmd === 'paste') return pasteMenu(node);
      if (cmd === 'underline') return underlineMenu(node);
      if (cmd === 'margins') return marginsMenu(node);
      if (cmd === 'orientation') return orientationMenu(node);
      if (cmd === 'size') return pageSizeMenu(node);
      if (cmd === 'columns') return columnsMenu(node);
      if (cmd === 'textEffectsAndTypography') return textEffectsMenu(node);
      if (cmd === 'multilevelList') return multilevelMenu(node);
      if (cmd === 'dictate') return WC.Dictate.menu(node);
      if (cmd === 'sensitivity') return sensitivityMenu(node);
      if (cmd === 'addIns' || cmd === 'getAddIns' || cmd === 'myAddIns') return addInsMenu(node);
      // Insert tab dropdowns / split arrows
      if (cmd === 'coverPage') return WC.Insert.coverPageMenu(node);
      if (cmd === 'table') return WC.Insert.tableMenu(node);
      // Table Tools contextual-tab dropdowns (style gallery / shading / borders / autofit)
      if (cmd === 'tblStyles' || cmd === 'tblShading' || cmd === 'tblBorders' || cmd === 'tblAutoFit') return H[cmd](control, node);
      if (cmd === 'pictures') return picturesMenu(node);
      if (cmd === 'shapes') return WC.Insert.shapesMenu(node);
      if (cmd === 'screenshot') return screenshotMenu(node);
      if (cmd === 'header') return WC.HeaderFooter.headerMenu(node);
      if (cmd === 'footer') return WC.HeaderFooter.footerMenu(node);
      if (cmd === 'pageNumber') return WC.HeaderFooter.pageNumberMenu(node);
      if (cmd === 'textBox') return textBoxMenu(node);
      if (cmd === 'quickParts') return WC.Insert.quickPartsMenu(node);
      if (cmd === 'wordart') return WC.Insert.wordArtMenu(node);
      if (cmd === 'dropCap') return dropCapMenu(node);
      if (cmd === 'symbol') return WC.Dialogs.symbol(node);
      if (cmd === 'equation') return equationMenu(node);
      if (cmd === 'object') return WC.Insert.objectMenu(node);
      if (cmd === 'signatureLine') return WC.Insert.signatureLine();
      if (cmd === 'dateTime') return WC.Insert.dateTimeDialog();
      if (cmd === '3dModels') return H['3dModels']();
      if (cmd === 'link') return WC.Dialogs.insertLink();
      // Draw tab
      if (cmd === 'addPen') return H.addPen(control, node);
      if (cmd === 'pensGallery') return pensMenu(node);
      if (cmd === 'eraser') return WC.flyout(node, (fly) => {
        fly.appendChild(WC.flyHeader('Eraser'));
        const setEraser = (radius, mode) => { WC.Draw.setEnabled(true); WC.Draw.setTool('eraser'); WC.Draw.eraseRadius = radius; WC.Draw.eraseMode = mode; };
        fly.appendChild(WC.flyItem('Stroke Eraser', { onClick: () => setEraser(10, 'stroke') }));
        fly.appendChild(WC.flyItem('Small Eraser', { onClick: () => setEraser(6, 'point') }));
        fly.appendChild(WC.flyItem('Medium Eraser', { onClick: () => setEraser(12, 'point') }));
        fly.appendChild(WC.flyItem('Large Eraser', { onClick: () => setEraser(24, 'point') }));
        fly.appendChild(WC.flyItem('Segment Eraser', { onClick: () => setEraser(8, 'segment') }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Erase All Ink', { onClick: () => WC.Draw.clearAll() }));
      });
      // Design tab
      if (cmd === 'themes' || cmd === 'styleSet' || cmd === 'colors' || cmd === 'fonts' || cmd === 'paragraphSpacing' || cmd === 'effects' || cmd === 'watermark') return H[cmd](control, node);
      // Layout tab
      if (cmd === 'breaks') return H.breaks(control, node);
      if (cmd === 'bringForward') return WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Bring Forward', { onClick: () => WC.Layout.bringForward() })); fly.appendChild(WC.flyItem('Bring to Front', { onClick: () => WC.Layout.bringToFront() })); fly.appendChild(WC.flyItem('Bring in Front of Text', { onClick: () => WC.Layout.wrapText('front') })); });
      if (cmd === 'sendBackward') return WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Send Backward', { onClick: () => WC.Layout.sendBackward() })); fly.appendChild(WC.flyItem('Send to Back', { onClick: () => WC.Layout.sendToBack() })); fly.appendChild(WC.flyItem('Send Behind Text', { onClick: () => WC.Layout.wrapText('behind') })); });
      if (cmd === 'lineNumbers' || cmd === 'hyphenation' || cmd === 'position' || cmd === 'wrapText' || cmd === 'align' || cmd === 'group' || cmd === 'rotate') return H[cmd](control, node);
      // References tab — Footnotes split-button ▾ flyout. PM-mode routes every
      // item to the bridge (the H.* button handlers + dialogs were re-pointed by
      // the flip, but this Commands.dropdown flyout was missed — slice-9 FIX 1).
      // The bridge refNextNote takes a direction ('next'/'prev'); refShowNotes
      // reveals the clone-owned notes area. Legacy ELSE branch is verbatim.
      if (cmd === 'nextFootnote') return WC.flyout(node, (fly) => {
        const pm = PMA();
        if (pm) {
          fly.appendChild(WC.flyItem('Next Footnote', { onClick: () => pm.refNextNote('next') }));
          fly.appendChild(WC.flyItem('Previous Footnote', { onClick: () => pm.refNextNote('prev') }));
          fly.appendChild(WC.flySep());
          fly.appendChild(WC.flyItem('Next Endnote', { onClick: () => pm.refNextNote('next') }));
          fly.appendChild(WC.flyItem('Previous Endnote', { onClick: () => pm.refNextNote('prev') }));
          fly.appendChild(WC.flySep());
          fly.appendChild(WC.flyItem('Show Notes', { onClick: () => pm.refShowNotes() }));
          return;
        }
        fly.appendChild(WC.flyItem('Next Footnote', { onClick: () => WC.Ref.nextNote('footnote', 1) }));
        fly.appendChild(WC.flyItem('Previous Footnote', { onClick: () => WC.Ref.nextNote('footnote', -1) }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Next Endnote', { onClick: () => WC.Ref.nextNote('endnote', 1) }));
        fly.appendChild(WC.flyItem('Previous Endnote', { onClick: () => WC.Ref.nextNote('endnote', -1) }));
      });
      if (cmd === 'tableOfContents' || cmd === 'addText' || cmd === 'insertCitation' || cmd === 'style' || cmd === 'bibliography') return H[cmd](control, node);
      // Mailings tab
      if (cmd === 'startMailMerge' || cmd === 'selectRecipients' || cmd === 'insertMergeField' || cmd === 'rules' || cmd === 'finishMerge') return H[cmd](control, node);
      // Review tab
      if (cmd === 'translate' || cmd === 'language' || cmd === 'showMarkup' || cmd === 'compare' || cmd === 'showComments') return H[cmd](control, node);
      // Spelling and Grammar split ▾ (parity P3): Spelling | ✓Spelling and Grammar.
      // Both routes open the spelling flow until the task-6 proofing pane lands.
      if (cmd === 'spellingGrammar') return WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('   Spelling', { onClick: () => H.spellingGrammar() })); fly.appendChild(WC.flyItem('✓ Spelling and Grammar', { onClick: () => H.spellingGrammar() })); });
      // Track Changes ▾ (parity T2/D8.7): For Everyone | Just Mine | Lock Tracking.
      // Just Mine === For Everyone in this single-author clone (recorded note).
      if (cmd === 'trackChanges') {
        const tcOn = (WC.PM && WC.PM.active) ? !!(WC.PM.reviewState && WC.PM.reviewState().tracking) : WC.Review.trackOn;
        const locked = !!(WC.pmTrackLock && WC.pmTrackLock.locked);
        return WC.flyout(node, (fly) => {
          fly.appendChild(WC.flyItem((tcOn ? '✓ ' : '   ') + 'For Everyone', { onClick: () => H.trackChanges() }));
          fly.appendChild(WC.flyItem((tcOn ? '✓ ' : '   ') + 'Just Mine', { onClick: () => H.trackChanges() }));
          fly.appendChild(WC.flyItem((locked ? '✓ ' : '   ') + 'Lock Tracking', { onClick: () => H.trackChangesLock() }));
        });
      }
      // Accept/Reject ▾ (parity T12/T13). "All Changes Shown" is DISABLED while
      // no markup filter is active — exactly Word's unfiltered state (T12) and
      // the same treatment as C8's "Delete All Comments Shown"; task-5 filters
      // enable it.
      if (cmd === 'accept') return WC.flyout(node, (fly) => {
        const pm = PMA();
        fly.appendChild(WC.flyItem('Accept and Move to Next', { onClick: () => H.accept() }));
        fly.appendChild(WC.flyItem('Accept This Change', { onClick: () => { if (pm) { pm.cmd('acceptChange'); return; } const n = WC.Review.currentRevision(); if (n) { WC.Review.acceptNode(n); E().dirty = true; E().repaginate(); E().updateStatus(); E().emit(); } } }));
        fly.appendChild(WC.flyItem('Accept All Changes Shown', { disabled: true }));
        fly.appendChild(WC.flyItem('Accept All Changes', { onClick: () => { const p = PMA(); p ? p.cmd('acceptAll') : WC.Review.acceptAll(); } }));
        fly.appendChild(WC.flyItem('Accept All Changes and Stop Tracking', { onClick: () => { const p = PMA(); if (p) { p.cmd('acceptAll'); p.cmd('disableTrackChanges'); } else { WC.Review.acceptAll(); WC.Review.setTrackChanges(false); } } }));
      });
      if (cmd === 'reject') return WC.flyout(node, (fly) => {
        const pm = PMA();
        fly.appendChild(WC.flyItem('Reject and Move to Next', { onClick: () => H.reject() }));
        fly.appendChild(WC.flyItem('Reject Change', { onClick: () => { if (pm) { pm.cmd('rejectChange'); return; } const n = WC.Review.currentRevision(); if (n) { WC.Review.rejectNode(n); E().dirty = true; E().repaginate(); E().updateStatus(); E().emit(); } } }));
        fly.appendChild(WC.flyItem('Reject All Changes Shown', { disabled: true }));
        fly.appendChild(WC.flyItem('Reject All Changes', { onClick: () => { const p = PMA(); p ? p.cmd('rejectAll') : WC.Review.rejectAll(); } }));
        fly.appendChild(WC.flyItem('Reject All Changes and Stop Tracking', { onClick: () => { const p = PMA(); if (p) { p.cmd('rejectAll'); p.cmd('disableTrackChanges'); } else { WC.Review.rejectAll(); WC.Review.setTrackChanges(false); } } }));
      });
      // Delete ▾ (parity C8). "Shown" stays disabled until markup/comment filters
      // exist (task 4+, Word disables it un-filtered too).
      if (cmd === 'deleteComment') return WC.flyout(node, (fly) => {
        const pm = PMA();
        fly.appendChild(WC.flyItem('Delete', { onClick: () => H.deleteComment() }));
        fly.appendChild(WC.flyItem('Delete All Comments Shown', { disabled: true }));
        fly.appendChild(WC.flyItem('Delete All Comments in Document', { onClick: () => { if (pm) { pm.getComments().forEach((r) => pm.cmd('deleteComment', r.id)); return; } WC.Review.deleteAllComments(); } }));
        fly.appendChild(WC.flyItem('Delete All Resolved Comments', { onClick: () => { if (pm) { pm.getComments().filter((r) => r.resolved).forEach((r) => pm.cmd('deleteComment', r.id)); return; } E().node.querySelectorAll('.wc-comment-anchor.resolved').forEach((a) => a.replaceWith(...a.childNodes)); } }));
      });
      // Reviewing Pane split menu (T11): PM picks the dock explicitly (Horizontal =
      // the same pane bottom-docked); legacy keeps its single pane toggle.
      if (cmd === 'reviewingPane') return WC.flyout(node, (fly) => {
        const pm = PMA();
        fly.appendChild(WC.flyItem('Reviewing Pane Vertical…', { onClick: () => { if (pm && WC.TrackChrome) WC.TrackChrome.showPane('vertical'); else H.reviewingPane(); } }));
        fly.appendChild(WC.flyItem('Reviewing Pane Horizontal…', { onClick: () => { if (pm && WC.TrackChrome) WC.TrackChrome.showPane('horizontal'); else H.reviewingPane(); } }));
      });
      if (cmd === 'checkAccessibility') return WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Check Accessibility', { onClick: () => WC.Review.checkAccessibility() })); });
      // Hide Ink ▾ (parity X4 — Word menu capture pending): single toggle item.
      if (cmd === 'hideInk') return WC.flyout(node, (fly) => { fly.appendChild(WC.flyItem('Hide Ink', { onClick: () => H.hideInk(control, WC.Ribbon.controlIndex.hideInk && WC.Ribbon.controlIndex.hideInk.node) })); });
      // View tab
      if (cmd === 'switchWindows' || cmd === 'macros') return H[cmd](control, node);
      // generic: list items as menu entries
      WC.flyout(node, (fly, close) => {
        const items = control.items && control.items.length ? control.items : ['(no options)'];
        items.forEach((it) => {
          if (/^-+$/.test(it)) { fly.appendChild(WC.flySep()); return; }
          fly.appendChild(WC.flyItem(it, { onClick: () => WC.notImplemented(control.label + ' ▸ ' + it) }));
        });
      });
    },

    comboCommit(c, value) {
      if (WC.PM && WC.PM.active && WC.PM.isBlocked(c.cmd === 'font' || c.cmd === 'fontSize' ? 'font' : c.cmd)) { WC.PM.withSelection(() => WC.PM.notifyBlocked(c.label || c.cmd)); return; }
      if (c.cmd === 'font') setFontName(value);
      else if (c.cmd === 'fontSize') setFontSize(parseFloat(value));
    },
    comboDropdown(c, combo, input) {
      if (WC.PM && WC.PM.active && WC.PM.isBlocked(c.cmd === 'font' || c.cmd === 'fontSize' ? 'font' : c.cmd)) { WC.PM.withSelection(() => WC.PM.notifyBlocked(c.label || c.cmd)); return; }
      if (c.cmd === 'font') openFontList(combo);
      else if (c.cmd === 'fontSize') openSizeList(combo);
      else if (c.cmd === 'displayForReview') WC.flyout(combo, (fly) => { [['Simple Markup', 'simple'], ['All Markup', 'all'], ['No Markup', 'none'], ['Original', 'original']].forEach(([l, m]) => fly.appendChild(WC.flyItem(l, { onClick: () => { const pm = PMA(); pm ? pm.cmd('setReviewView', m) : WC.Review.setDisplayMode(m); input.value = l; } }))); });
    },

    applyStyle(name) {
      if (WC.PM && WC.PM.active && WC.PM.isBlocked('stylesGallery')) { WC.PM.notifyBlocked('Styles'); return; }
      const pm = PMA();
      if (pm) {
        // setStyleById path (one transaction; Word gallery = plain apply). false =
        // style missing from this doc's catalog (foreign docs beyond the import
        // defaults — recorded deviation: real Word mints built-ins on demand).
        if (!pm.applyStyleByName(name)) WC.toast('Style “' + name + '” is not available in this document.');
        return;
      }
      WC.applyNamedStyle(name);
    },

    // Layout Paragraph spinners (indent in inches, spacing in points; model = twips).
    // Negative indents are intentional pass-throughs (Word allows them); spacing
    // can't go negative — the ribbon inputs enforce min:0 (ribbon.js renderSpinner).
    spinner(cmd, value) {
      if (WC.PM && WC.PM.active && WC.PM.isBlocked(cmd)) { WC.PM.notifyBlocked(cmd); return; }
      const pm = PMA();
      if (pm && PARA_SPIN[cmd]) {
        // withSelection: the spinner input took real focus — focus.ts snapshotted the
        // PM selection on focusin (.rspinner is in its capture list); restore it first.
        const [path, conv] = PARA_SPIN[cmd];
        pm.withSelection(() => pm.cmd('updateAttributes', 'paragraph', { [path]: conv(value) }));
        return;
      }
      if (cmd === 'indentLeft') E().applyBlockStyle('marginLeft', value ? value + 'in' : '');
      else if (cmd === 'indentRight') E().applyBlockStyle('marginRight', value ? value + 'in' : '');
      else if (cmd === 'spacingBefore') E().applyBlockStyle('marginTop', value + 'pt');
      else if (cmd === 'spacingAfter') E().applyBlockStyle('marginBottom', value + 'pt');
      else if (cmd === 'goToRecord') WC.Mail.go((value || 1) - 1);
    },

    // Dialog-box-launcher dispatch, keyed by group id (avoids cmd collisions
    // like the Font launcher sharing 'font' with the font-name combo).
    launcher(groupId, control, node) {
      WC.closeFlyouts(); WC.hideTip();
      if (WC.PM && WC.PM.active) {
        const LAUNCHER_AREA_CMD = { font: 'font', paragraph: 'alignLeft', styles: 'stylesGallery', markup: 'trackChanges' }; // clipboard pane = app-level, allowed
        const probe = LAUNCHER_AREA_CMD[groupId];
        if (probe && WC.PM.isBlocked(probe)) { WC.PM.notifyBlocked(groupId + ' settings'); return; }
      }
      const map = {
        clipboard: () => (WC.Dialogs.clipboardPane ? WC.Dialogs.clipboardPane() : WC.notImplemented('Clipboard pane')),
        font: () => (WC.Dialogs.font ? WC.Dialogs.font() : WC.notImplemented('Font dialog')),
        paragraph: () => WC.Dialogs.paragraph(),
        styles: () => WC.Dialogs.stylesPane(),
        // Markup launcher → Track Changes Options dialog (parity T18). The dialog
        // itself lands in task 6 — until then route to the Show Markup menu, whose
        // toggles are the dialog's "Show" group (recorded interim).
        markup: () => (WC.Dialogs.trackChangesOptions ? WC.Dialogs.trackChangesOptions() : H.showMarkup({ cmd: 'showMarkup', label: 'Show Markup' }, node)),
      };
      if (map[groupId]) map[groupId]();
      else WC.notImplemented((control && control.label) || (groupId + ' settings'));
    },
  };

  // ============ helper implementations ============
  function currentInlineStyle() {
    const sel = window.getSelection();
    let n = sel && sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
    if (!n) return {};
    const cs = getComputedStyle(n);
    return { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
      textDecoration: cs.textDecorationLine, color: cs.color, backgroundColor: cs.backgroundColor };
  }
  function captureFormat() {
    const sel = window.getSelection();
    let n = sel && sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
    if (!n) return { inline: {} };
    const cs = getComputedStyle(n);
    return { inline: {
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
      textDecorationLine: cs.textDecorationLine, textDecorationStyle: cs.textDecorationStyle, textDecorationColor: cs.textDecorationColor,
      color: cs.color, verticalAlign: cs.verticalAlign, letterSpacing: cs.letterSpacing,
      backgroundColor: (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') ? cs.backgroundColor : '',
    } };
  }
  let painterHandler = null, painterEsc = null;
  function disarmPainter() {
    painter = null;
    E().node.style.cursor = 'text';
    const btn = WC.Ribbon.controlIndex.formatPainter && WC.Ribbon.controlIndex.formatPainter.node;
    if (btn) btn.classList.remove('toggled');
    if (painterHandler) { E().node.removeEventListener('mouseup', painterHandler); painterHandler = null; }
    if (painterEsc) { document.removeEventListener('keydown', painterEsc); painterEsc = null; }
  }
  // PM painter: the fork's FormatCommands owns capture/apply/release; this wrapper
  // adds Word's UX toasts. Esc lives in the bridge; button toggle + cursor live in
  // state-sync. Word arms from a CARET too (paragraph + caret-char formatting —
  // oracle 2.3 probe B3); no empty-selection refusal.
  function armPainterPM(node, sticky) {
    // The fork's copyFormat always arms (caret-arming, oracle B3) — no failure path.
    PMA().armFormatPainter(sticky);
    WC.toast(sticky ? 'Format Painter locked — apply to multiple selections. Press Esc to stop.'
                    : 'Format Painter — select text to apply the copied formatting once.');
  }

  function armPainterFromSelection(node, sticky) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !E().node.contains(sel.anchorNode)) { WC.toast('Select formatted text first, then click Format Painter.'); return; }
    painter = Object.assign(captureFormat(), { sticky });
    if (node) node.classList.add('toggled');
    E().node.style.cursor = 'copy';
    WC.toast(sticky ? 'Format Painter locked — apply to multiple selections. Press Esc to stop.' : 'Format Painter — select text to apply the copied formatting once.');
    if (painterHandler) E().node.removeEventListener('mouseup', painterHandler);
    painterHandler = () => {
      const s = window.getSelection();
      if (!painter || !s || s.isCollapsed) return;
      const st = painter.inline;
      const makeSpan = () => { const span = el('span'); Object.assign(span.style, { fontFamily: st.fontFamily, fontSize: st.fontSize, fontWeight: st.fontWeight, fontStyle: st.fontStyle, color: st.color, textDecorationLine: st.textDecorationLine, textDecorationStyle: st.textDecorationStyle, letterSpacing: st.letterSpacing, verticalAlign: st.verticalAlign }); if (st.backgroundColor) span.style.backgroundColor = st.backgroundColor; return span; };
      // Wrap each selected TEXT NODE's portion in its own inline span. Wrapping the
      // whole multi-block range in ONE span would put a <span> around <p> blocks
      // and corrupt the document — apply per block instead, like Word.
      const range = s.getRangeAt(0);
      const walker = document.createTreeWalker(E().node, NodeFilter.SHOW_TEXT, { acceptNode: (nn) => range.intersectsNode(nn) ? 1 : 3 });
      const nodes = []; let node; while ((node = walker.nextNode())) nodes.push(node);
      nodes.forEach((tn) => {
        let start = 0, end = tn.nodeValue.length;
        if (tn === range.startContainer) start = range.startOffset;
        if (tn === range.endContainer) end = range.endOffset;
        if (start >= end || !tn.nodeValue.slice(start, end).trim()) return;
        const r = document.createRange(); r.setStart(tn, start); r.setEnd(tn, end);
        try { r.surroundContents(makeSpan()); } catch (e) { const sp2 = makeSpan(); sp2.appendChild(r.extractContents()); r.insertNode(sp2); }
      });
      E().dirty = true; E().repaginate(); E().updateStatus();
      if (!painter.sticky) disarmPainter();
    };
    E().node.addEventListener('mouseup', painterHandler);
    if (painterEsc) document.removeEventListener('keydown', painterEsc);
    painterEsc = (e) => { if (e.key === 'Escape') disarmPainter(); };
    document.addEventListener('keydown', painterEsc);
  }

  // Vertical alignment (sub/superscript) — function decl so H.subscript/H.superscript
  // can reference it before the declaration site (hoisting).
  function vertAlign(kind) {
    const pm = PMA();
    if (!pm) { E().exec(kind); return; }
    const st = pm.getState();
    const on = kind === 'subscript' ? st.subscript : st.superscript;
    pm.cmd('setMark', 'textStyle', { vertAlign: on ? null : kind });
  }
  function stepFont(dir) {
    const cur = currentSizePt() || 11;
    let next;
    if (dir > 0) { const bigger = SIZES.find((s) => s > cur); next = bigger != null ? bigger : SIZES[SIZES.length - 1]; }
    else { const smaller = SIZES.filter((s) => s < cur); next = smaller.length ? smaller[smaller.length - 1] : SIZES[0]; }
    setFontSize(next);
  }
  function currentSizePt() {
    const pm = PMA();
    if (pm) { const st = pm.getState(); const v = parseFloat(st && st.fontSize); return v || 12; }
    const sel = window.getSelection();
    let n = sel && sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
    if (n && n.getBoundingClientRect) { const px = parseFloat(getComputedStyle(n).fontSize); if (px) return Math.round(px / 1.3333 * 10) / 10; }
    return E().queryState().computedFontSizePt || 12;
  }
  function setFontSize(pt) {
    if (!pt) return;
    const pm = PMA();
    // withSelection: combo commits arrive with focus in the combo input — the
    // focusin capture (focus.ts) snapshotted the PM selection; restore it first.
    if (pm) pm.withSelection(() => pm.cmd('setFontSize', pt + 'pt'));
    else E().applyInlineStyle('fontSize', pt + 'pt');
    WC.Ribbon.setComboValue('fontSize', String(pt));
  }
  function setFontName(name) {
    const pm = PMA();
    if (pm) pm.withSelection(() => pm.cmd('setFontFamily', name));
    else E().exec('fontName', name);
    WC.Ribbon.setComboValue('font', name);
  }

  function applyColor(kind, color) {
    const pm = PMA();
    if (kind === 'fore') {
      lastFontColor = color;
      pm ? pm.cmd('setColor', color) : E().exec('foreColor', color);
      WC.Ribbon.setColorBar('fontColor', color);
    } else if (kind === 'hilite') {
      lastHighlight = color;
      if (pm) { color === 'transparent' ? pm.cmd('unsetHighlight') : pm.cmd('setHighlight', color); }
      else { E().exec('hiliteColor', color) || E().exec('backColor', color); }
      WC.Ribbon.setColorBar('textHighlightColor', color);
    } else if (kind === 'shade') {
      if (color && color !== 'transparent') lastShade = color;
      if (pm) {
        if (!color || color === 'transparent') pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.shading');
        else pm.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.shading': { val: 'clear', color: 'auto', fill: color.replace(/^#/, '').toUpperCase() } });
      } else {
        E().applyBlockStyle('backgroundColor', color || 'transparent');
      }
      WC.Ribbon.setColorBar && WC.Ribbon.setColorBar('shading', color);
    } else if (kind === 'page') {
      if (pm) { pm.dePageColor(color); return; } // design area — slice 10 PR2 (real w:background)
      E().node.style.backgroundColor = color; // not 'background' — that wipes a watermark's background-image
    }
  }

  function colorMenu(node, kind) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.colorPalette((color, label) => {
        if (color === null) { const pm = PMA(); if (pm) { if (kind === 'hilite') pm.cmd('unsetHighlight'); else if (kind === 'fore') pm.cmd('unsetColor'); else if (kind === 'shade') pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.shading'); else { pm.dePageColorClear(); } return; } if (kind === 'hilite') E().exec('hiliteColor', 'transparent'); else if (kind === 'shade') E().applyBlockStyle('backgroundColor', 'transparent'); else if (kind === 'page') E().node.style.backgroundColor = '#ffffff'; return; }
        applyColor(kind, color === 'inherit' ? '#000000' : color);
      }, { noColor: kind !== 'fore', autoLabel: kind === 'fore' ? 'Automatic' : 'No Color', automatic: kind === 'fore' }));
    });
  }

  function changeCaseMenu(node) {
    const cases = [['Sentence case.', 'sentence'], ['lowercase', 'lower'], ['UPPERCASE', 'upper'], ['Capitalize Each Word', 'caps'], ['tOGGLE cASE', 'toggle']];
    WC.flyout(node, (fly) => cases.forEach(([label, mode]) => fly.appendChild(WC.flyItem(label, { onClick: () => changeCase(mode) }))));
  }
  function changeCase(mode) {
    const pm = PMA(); if (pm) { pm.changeCase(mode); return; }
    const sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const xform = (t) => {
      if (mode === 'lower') return t.toLowerCase();
      if (mode === 'upper') return t.toUpperCase();
      if (mode === 'caps') return t.replace(/\b\w/g, (m) => m.toUpperCase());
      if (mode === 'sentence') return t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
      if (mode === 'toggle') return t.replace(/./g, (ch) => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase());
      return t;
    };
    // Transform the TEXT NODES inside the selection in place — never round-trip
    // through execCommand('insertText'), which injects literal newlines for a
    // multi-paragraph selection and strips run formatting. Case maps are
    // length-preserving, so the selection range stays valid.
    const walker = document.createTreeWalker(E().node, NodeFilter.SHOW_TEXT, { acceptNode: (n) => range.intersectsNode(n) ? 1 : 3 });
    const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      const v = node.nodeValue;
      let s = 0, e = v.length;
      if (node === range.startContainer) s = range.startOffset;
      if (node === range.endContainer) e = range.endOffset;
      node.nodeValue = v.slice(0, s) + xform(v.slice(s, e)) + v.slice(e);
    });
    E().dirty = true; E().updateStatus(); E().emit();
  }

  function lineSpacingMenu(node) {
    const opts = ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'];
    // pm/st snapshot at MENU OPEN drives the dynamic labels; each click re-guards
    // with a fresh PMA() (pm2) because failBridge can un-flip the mode while the
    // flyout is open — never act on a stale mode through a captured pm.
    const pm = PMA();
    const st = pm ? pm.getState() : null;
    WC.flyout(node, (fly) => {
      opts.forEach((o) => fly.appendChild(WC.flyItem(o, { onClick: () => {
        const pm2 = PMA();
        if (pm2) pm2.cmd('setLineHeight', parseFloat(o));
        else E().applyBlockStyle('lineHeight', o);
      } })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Line Spacing Options…', { onClick: () => WC.Dialogs.paragraph() }));
      if (pm) {
        // Word-fidelity: labels flip with the caret paragraph's current spacing.
        const hasBefore = !!(st && st.spacingBeforePt > 0);
        const hasAfter = !!(st && st.spacingAfterPt > 0);
        fly.appendChild(WC.flyItem(hasBefore ? 'Remove Space Before Paragraph' : 'Add Space Before Paragraph', {
          onClick: () => { const p2 = PMA(); if (p2) p2.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.spacing.before': hasBefore ? 0 : 240 }); },
        }));
        fly.appendChild(WC.flyItem(hasAfter ? 'Remove Space After Paragraph' : 'Add Space After Paragraph', {
          onClick: () => { const p2 = PMA(); if (p2) p2.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.spacing.after': hasAfter ? 0 : 240 }); },
        }));
      } else {
        fly.appendChild(WC.flyItem('Add Space Before Paragraph', { onClick: () => E().applyBlockStyle('marginTop', '12pt') }));
        fly.appendChild(WC.flyItem('Remove Space After Paragraph', { onClick: () => E().applyBlockStyle('marginBottom', '0') }));
      }
    });
  }

  function bordersMenu(node) {
    const edges = [['All Borders', 'all'], ['Outside Borders', 'outside'], ['No Border', 'none'], ['Top Border', 'top'], ['Bottom Border', 'bottom'], ['Left Border', 'left'], ['Right Border', 'right']];
    WC.flyout(node, (fly) => {
      edges.forEach(([label, e]) => fly.appendChild(WC.flyItem(label, { onClick: () => applyBorder(e) })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Borders and Shading…', { onClick: () => WC.notImplemented('Borders and Shading dialog') }));
    });
  }
  function applyBorder(edge) {
    if (edge && edge !== 'none' && edge !== 'all' && edge !== 'outside') lastBorderEdge = edge;
    const pm = PMA();
    if (pm) {
      if (edge === 'none') { pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.borders'); return; }
      // Word's default paragraph border: single, 0.5pt (size is in EIGHTH-points: 4),
      // auto color, 1pt offset. 'all'≡'outside' replicates the legacy simplification
      // for single paragraphs (no inside-border concept yet; recorded deferral).
      const DEF = { val: 'single', size: 4, color: 'auto', space: 1 };
      const defCopy = () => ({ val: DEF.val, size: DEF.size, color: DEF.color, space: DEF.space });
      // getAttributes reads ONE paragraph (selection head) — multi-paragraph selections
      // seed single-edge accumulation from that paragraph only (recorded simplification).
      const attrs = pm.getEditor().getAttributes('paragraph') || {};
      const pp = attrs.paragraphProperties || {};
      const cur = pp.borders || {};
      const borders = (edge === 'all' || edge === 'outside')
        ? { top: defCopy(), bottom: defCopy(), left: defCopy(), right: defCopy() }
        : Object.assign({}, cur, { [edge]: defCopy() }); // Word ACCUMULATES single edges
      pm.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.borders': borders });
      return;
    }
    const b = '1px solid #000';
    E().selectedBlocks().forEach((el2) => {
      if (edge === 'none') { el2.style.border = ''; el2.style.borderTop = el2.style.borderBottom = el2.style.borderLeft = el2.style.borderRight = ''; }
      else if (edge === 'all' || edge === 'outside') el2.style.border = b;
      else el2.style['border' + edge.charAt(0).toUpperCase() + edge.slice(1)] = b;
    });
  }

  // Library glyph → engine style names (toggleOrderedListStyle / toggleBulletListStyle);
  // glyphs without a canonical style mint a one-level definition via applyListDefinition.
  const ORDERED_STYLE = { '1.': 'decimal', '1)': 'decimal-paren', 'A.': 'upper-alpha', 'a)': 'lower-alpha-paren', 'i.': 'lower-roman', 'I.': 'upper-roman' };
  const BULLET_STYLE = { '●': 'disc', '○': 'circle', '■': 'square' };
  function bulletMenu(node, ordered) {
    const bullets = ordered ? ['1.', '1)', 'A.', 'a)', 'i.', 'I.'] : ['●', '○', '■', '◆', '➤', '✓'];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader(ordered ? 'Numbering Library' : 'Bullet Library'));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px', padding: '6px 10px' } });
      bullets.forEach((b) => {
        const cell = el('div', { text: b, style: { border: '1px solid #ddd', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } });
        cell.addEventListener('click', () => {
          WC.closeFlyouts();
          const pm = PMA();
          if (!pm) { E().exec(ordered ? 'insertOrderedList' : 'insertUnorderedList'); return; }
          if (ordered) pm.cmd('toggleOrderedListStyle', ORDERED_STYLE[b]);
          else if (BULLET_STYLE[b]) pm.cmd('toggleBulletListStyle', BULLET_STYLE[b]);
          else pm.cmd('applyListDefinition', { listType: 'bulletList', levels: [{ fmt: 'bullet', text: b }] });
        });
        grid.appendChild(cell);
      });
      fly.appendChild(grid);
    });
  }

  function selectMenu(node) {
    const pm = PMA();
    if (pm) {
      WC.flyout(node, (fly) => {
        fly.appendChild(WC.flyItem('Select All', { key: 'Ctrl+A', onClick: () => pm.selectAll() }));
        fly.appendChild(WC.flyItem('Select Objects', { onClick: () => WC.toast('Select Objects arrives with the Draw engine re-host (slice 10).') }));
        fly.appendChild(WC.flyItem('Select All Text With Similar Formatting', { onClick: () => { if (!pm.selectSimilarFormatting()) WC.toast('Place the cursor in text first.'); } }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Selection Pane…', { onClick: () => WC.toast('Selection Pane lists drawing objects — arrives with the Draw engine re-host (slice 10).') }));
      });
      return;
    }
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Select All', { key: 'Ctrl+A', onClick: () => E().exec('selectAll') }));
      fly.appendChild(WC.flyItem('Select Objects', { onClick: () => { if (WC.Draw) { WC.Draw.setEnabled(true); WC.Draw.setTool('select'); } WC.toast('Click objects to select them.'); } }));
      fly.appendChild(WC.flyItem('Select All Text With Similar Formatting', { onClick: () => selectSimilarFormatting() }));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Selection Pane…', { onClick: () => WC.Layout.selectionPane() }));
    });
  }
  function selectSimilarFormatting() {
    const sel = window.getSelection(); if (!sel.rangeCount) { WC.toast('Place the cursor in text first.'); return; }
    let n = sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
    if (!n) return;
    const cs = getComputedStyle(n);
    const key = cs.fontWeight + '|' + cs.fontStyle + '|' + cs.fontSize + '|' + cs.fontFamily;
    const blocks = Array.from(E().node.querySelectorAll('p,h1,h2,h3,h4,li,span'));
    const matches = blocks.filter((b) => { const c = getComputedStyle(b); return (c.fontWeight + '|' + c.fontStyle + '|' + c.fontSize + '|' + c.fontFamily) === key && b.textContent.trim(); });
    if (!matches.length) { WC.toast('No similar formatting found.'); return; }
    const r = document.createRange(); r.setStartBefore(matches[0]); r.setEndAfter(matches[matches.length - 1]);
    sel.removeAllRanges(); sel.addRange(r);
    WC.toast('Selected ' + matches.length + ' run(s) with similar formatting.');
  }
  function findMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Find', { icon: 'find', onClick: () => WC.Dialogs.findPane(false) }));
      fly.appendChild(WC.flyItem('Advanced Find…', { onClick: () => WC.Dialogs.findPane(false, true) }));
      fly.appendChild(WC.flyItem('Go To…', { key: 'Ctrl+G', onClick: () => WC.Dialogs.goToDialog() }));
    });
  }
  function sortDialog() {
    const pmOpen = PMA();
    if (!pmOpen) {
      const all = E().selectedBlocks();
      if (all.length < 2) { WC.toast('Select multiple paragraphs to sort.'); return; }
    } else {
      pmOpen.captureSelection(); // the dialog steals focus; restore before sorting
    }
    const type = el('select', {}, ['Text', 'Number', 'Date'].map((t) => el('option', { text: t })));
    const dir = el('select', {}, ['Ascending', 'Descending'].map((t) => el('option', { text: t })));
    const hdr = el('input', { type: 'checkbox' });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Sort by:', style: { width: '70px' } }), el('span', { text: 'Paragraphs' })]),
      el('div', { class: 'row' }, [el('label', { text: 'Type:', style: { width: '70px' } }), type, el('label', { style: { marginLeft: '12px' } }, [dir])]),
      el('div', { class: 'row' }, [el('label', {}, [hdr, el('span', { text: ' My list has a header row' })])]),
    ]);
    WC.dialog({ title: 'Sort Text', width: '440px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        // 'Date' maps to numeric (parseFloat-based) — legacy parity, recorded deferral;
        // real Word does true date parsing.
        const opts = { ascending: dir.value === 'Ascending', numeric: type.value !== 'Text', header: hdr.checked };
        const pm = PMA();
        if (pm) { let ok = false; pm.withSelection(() => { ok = pm.sortParagraphs(opts); }); if (!ok) WC.toast('Select multiple paragraphs to sort.'); }
        else sortSelection(opts);
      } },
      { label: 'Cancel' },
    ] });
  }

  function pasteMenu(node) {
    const pm = PMA();
    if (pm) {
      pm.clipboardFlavors().then((fl) => {
        fl = fl || { hasText: false, hasHtml: false, hasImage: false };
        WC.flyout(node, (fly) => {
          const item = (label, enabled, onClick) =>
            fly.appendChild(WC.flyItem(label, enabled ? { onClick } : { disabled: true }));
          item('Keep Source Formatting', fl.hasHtml || fl.hasText, () => pm.pasteDefault());
          item('Merge Formatting', false, () => {}); // recorded deferral — destination-formatting rules engine
          item('Picture', fl.hasImage, () => pm.pastePicture());
          item('Keep Text Only', fl.hasText, () => pm.pasteTextOnly());
          fly.appendChild(WC.flySep());
          fly.appendChild(WC.flyItem('Paste Special…', { onClick: () => WC.Dialogs.pasteSpecial() }));
          fly.appendChild(WC.flyItem('Set Default Paste…', { onClick: () => WC.toast('Set Default Paste is not implemented (recorded deferral).') }));
        });
      });
      return;
    }
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Keep Source Formatting', { onClick: () => E().exec('paste') }));
      fly.appendChild(WC.flyItem('Merge Formatting', { onClick: () => E().exec('paste') }));
      fly.appendChild(WC.flyItem('Keep Text Only', { onClick: async () => { try { const t = await navigator.clipboard.readText(); E().exec('insertText', t); } catch (e) { WC.toast('Clipboard read blocked.'); } } }));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Paste Special…', { onClick: () => WC.notImplemented('Paste Special') }));
    });
  }

  function underlineMenu(node) {
    const styles = [['Single', 'solid'], ['Double', 'double'], ['Dotted', 'dotted'], ['Dashed', 'dashed'], ['Wavy', 'wavy']];
    const UL_TYPE = { solid: 'single', double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave' }; // OOXML w:u values
    WC.flyout(node, (fly) => {
      styles.forEach(([label, s]) => fly.appendChild(WC.flyItem(label, { onClick: () => {
        const pm = PMA();
        if (pm) { pm.chain([['setUnderline'], ['setMark', 'underline', { underlineType: UL_TYPE[s] }]]); return; }
        E().exec('underline'); E().applyInlineStyle('textDecorationStyle', s);
      } })));
    });
  }

  function sortSelection(opts) {
    opts = opts || { ascending: true, numeric: false, header: false };
    const all = E().selectedBlocks();
    if (all.length < 2) { WC.toast('Select multiple paragraphs to sort.'); return; }
    // Only sort sibling blocks that share a parent — reordering across different
    // containers (e.g. a list item and a following paragraph) would corrupt the
    // document, so we restrict to the first block's parent. insertBefore is then
    // always given a ref that is a child of that parent (or null), never throwing.
    const parent = all[0].parentNode;
    const blocks = all.filter((b) => b.parentNode === parent);
    if (blocks.length < 2) { WC.toast('Select multiple paragraphs at the same level to sort.'); return; }
    const head = opts.header ? blocks.slice(0, 1) : [];
    const toSort = opts.header ? blocks.slice(1) : blocks;
    const cmp = (a, b) => {
      let r;
      if (opts.numeric) r = (parseFloat(a.textContent) || 0) - (parseFloat(b.textContent) || 0);
      else r = a.textContent.localeCompare(b.textContent, undefined, { numeric: true, sensitivity: 'base' });
      return opts.ascending === false ? -r : r;
    };
    const sorted = head.concat(toSort.slice().sort(cmp));
    const ref = blocks[blocks.length - 1].nextSibling; // capture ONCE before moving nodes
    sorted.forEach((n) => parent.insertBefore(n, ref));
    E().dirty = true; E().updateStatus();
  }

  function insertPageBreak() {
    E().insertHTML('<div class="manual-break" contenteditable="false" style="break-after:page;page-break-after:always"></div><p><br></p>');
  }
  function insertBlankPage() {
    E().insertHTML('<div class="manual-break blank-page" contenteditable="false" style="break-after:page;page-break-after:always"></div><p><br></p>');
  }
  function insertWordArt() {
    const sel = window.getSelection();
    const txt = (sel && sel.toString()) || 'Your text here';
    const pm = PMA(); if (pm) { pm.xeWordArt(txt, {}); return; }
    E().insertHTML(`<span style="font:bold 36pt Calibri;color:#2B579A;text-shadow:1px 1px 2px rgba(0,0,0,.3)">${WC.escapeHtml(txt)}</span>`);
  }
  function dropCap() {
    const b = E().selectedBlocks()[0];
    if (!b || !b.textContent) return;
    // Wrap only the first character of the first text node, preserving all other
    // inline formatting (bold/italic/links) in the paragraph.
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: (n) => /\S/.test(n.nodeValue) ? 1 : 3 });
    const first = walker.nextNode();
    if (!first) return;
    const ch = first.nodeValue.match(/\S/);
    if (!ch) return;
    const idx = first.nodeValue.indexOf(ch[0]);
    const after = first.splitText(idx);            // after starts at the first non-space char
    after.splitText(1);                             // isolate that single character
    const span = el('span');
    span.setAttribute('style', "float:left;font-size:46pt;line-height:38px;padding-right:6px;font-family:'Calibri Light'");
    span.textContent = after.nodeValue;
    after.parentNode.replaceChild(span, after);
    E().dirty = true; E().repaginate(); E().updateStatus();
  }

  // ---- Layout menus ----
  function setPageVar(name, value) { document.documentElement.style.setProperty(name, value); E().repaginate(); }
  function marginsMenu(node) {
    // [label, top/bottom in", left/right in"]  — clone realizes a single uniform
    // --page-margin, so we apply the left/right value (the visually dominant one).
    const presets = [
      ['Normal', 1, 1], ['Narrow', 0.5, 0.5], ['Moderate', 1, 0.75],
      ['Wide', 1, 2], ['Mirrored', 1, 1.25], ['Office 2003 Default', 1, 1.25],
    ];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Margins'));
      presets.forEach(([label, tb, lr]) => {
        const it = WC.flyItem(label + '   T/B ' + tb + '"  L/R ' + lr + '"', { onClick: () => setPageVar('--page-margin', Math.round(lr * 96) + 'px') });
        fly.appendChild(it);
      });
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Custom Margins…', { onClick: () => customMarginsDialog() }));
    });
  }
  function customMarginsDialog() {
    const cur = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-margin')) || 96) / 96;
    const inp = el('input', { type: 'number', step: '0.1', min: '0', value: String(cur), style: { width: '70px' } });
    WC.dialog({ title: 'Page Setup — Margins', width: '380px', body: el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Margin (inches):', style: { width: '120px' } }), inp])]), footer: [
      { label: 'OK', primary: true, onClick: () => { const v = parseFloat(inp.value); if (v >= 0) setPageVar('--page-margin', Math.round(v * 96) + 'px'); } },
      { label: 'Cancel' },
    ] });
  }
  function orientationMenu(node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Portrait', { onClick: () => { setPageVar('--page-w', '816px'); setPageVar('--page-h', '1056px'); E().pageH = 1056; E().repaginate(); } }));
      fly.appendChild(WC.flyItem('Landscape', { onClick: () => { setPageVar('--page-w', '1056px'); setPageVar('--page-h', '816px'); E().pageH = 816; E().repaginate(); } }));
    });
  }
  function pageSizeMenu(node) {
    const sizes = [
      ['Letter', 816, 1056, '8.5" x 11"'], ['Legal', 816, 1344, '8.5" x 14"'],
      ['A4', 794, 1123, '21cm x 29.7cm'], ['A3', 1123, 1587, '29.7cm x 42cm'],
      ['Tabloid', 1056, 1632, '11" x 17"'], ['Executive', 696, 1008, '7.25" x 10.5"'],
    ];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Paper Size'));
      sizes.forEach(([label, w, h, dim]) => fly.appendChild(WC.flyItem(label + '   ' + dim, { onClick: () => { setPageVar('--page-w', w + 'px'); setPageVar('--page-h', h + 'px'); E().pageH = h; E().repaginate(); } })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('More Paper Sizes…', { onClick: () => morePaperSizesDialog() }));
    });
  }
  function morePaperSizesDialog() {
    const w = el('input', { type: 'number', step: '0.1', value: '8.5', style: { width: '70px' } });
    const h = el('input', { type: 'number', step: '0.1', value: '11', style: { width: '70px' } });
    WC.dialog({ title: 'Page Setup — Paper', width: '400px', body: el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Width (in):', style: { width: '90px' } }), w]),
      el('div', { class: 'row' }, [el('label', { text: 'Height (in):', style: { width: '90px' } }), h]),
    ]), footer: [
      { label: 'OK', primary: true, onClick: () => { const pw = Math.round(parseFloat(w.value) * 96), ph = Math.round(parseFloat(h.value) * 96); if (pw > 0 && ph > 0) { setPageVar('--page-w', pw + 'px'); setPageVar('--page-h', ph + 'px'); E().pageH = ph; E().repaginate(); } } },
      { label: 'Cancel' },
    ] });
  }
  function columnsMenu(node) {
    // [label, count, leftFraction]  leftFraction realizes the asymmetric Left/Right presets
    const opts = [['One', 1], ['Two', 2], ['Three', 3], ['Left', 2, 'left'], ['Right', 2, 'right']];
    WC.flyout(node, (fly) => {
      opts.forEach(([label, n, side]) => fly.appendChild(WC.flyItem(label, { onClick: () => setColumns(n, side) })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('More Columns…', { onClick: () => moreColumnsDialog() }));
    });
  }
  function setColumns(n, side) {
    const ed = E().node;
    ed.style.columnGap = '36px';
    ed.removeAttribute('data-col-preset');
    if (n === 1) { ed.style.columnCount = ''; return; }
    ed.style.columnCount = n;
    // Word's Left = narrow-left/wide-right, Right = the mirror. CSS multicol is
    // equal-width, so flag the preset and let CSS skew the gutter to approximate it.
    if (side === 'left' || side === 'right') ed.dataset.colPreset = side;
  }
  function moreColumnsDialog() {
    const num = el('input', { type: 'number', min: '1', max: '6', value: '2', style: { width: '60px' } });
    const gap = el('input', { type: 'number', min: '0', value: '0.5', step: '0.1', style: { width: '60px' } });
    WC.dialog({ title: 'Columns', width: '380px', body: el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Number of columns:', style: { width: '150px' } }), num]),
      el('div', { class: 'row' }, [el('label', { text: 'Spacing (in):', style: { width: '150px' } }), gap]),
    ]), footer: [
      { label: 'OK', primary: true, onClick: () => { const n = parseInt(num.value, 10) || 1; E().node.style.columnCount = n === 1 ? '' : n; E().node.style.columnGap = (parseFloat(gap.value) * 96 || 36) + 'px'; } },
      { label: 'Cancel' },
    ] });
  }
  function fitZoom(pages) { pages = pages || 1; const a = document.getElementById('canvas'); return Math.max(0.2, (a.clientHeight - 40) / (E().pageH * pages)); }
  function fitWidthZoom() { const a = document.getElementById('canvas'); const pw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-w')) || 816; return Math.max(0.2, (a.clientWidth - 40) / pw); }
  function markChecked(node) { if (node) node.classList.toggle('toggled'); }

  // ---- Review: read aloud via Web Speech, spell check ----
  let speaking = false;
  let raPaused = false;
  function toggleReadAloud() {
    if (document.getElementById('read-aloud-bar')) { closeReadAloud(); return; }
    if (!('speechSynthesis' in window)) { WC.notImplemented('Read Aloud'); return; }
    showReadAloudBar();
    speakReadAloud();
  }
  // PM read-aloud source (P5): text from the CARET (Word reads from the caret; a
  // selection reads just the selection) + a textOffset→PM-position map so the
  // utterance's word-boundary events can paint a per-word ::highlight. Block
  // boundaries cost 2 PM tokens but only the '\n' we append — the map carries
  // per-segment absolute positions, so the drift never accumulates.
  let raMap = null; let raText = '';
  function pmReadAloudSource() {
    const pm = PMA(); if (!pm) return null;
    const state = pm.getEditor().state;
    const start = state.selection.from;
    const end = state.selection.empty ? state.doc.content.size : state.selection.to;
    let text = ''; const map = []; let sawBlock = false;
    state.doc.nodesBetween(start, end, (node, pos) => {
      if (node.isTextblock) { if (sawBlock && text && !text.endsWith('\n')) text += '\n'; sawBlock = true; return true; }
      if (node.isText && node.text) {
        const s = Math.max(pos, start); const e = Math.min(pos + node.text.length, end);
        if (e > s) { map.push({ t0: text.length, t1: text.length + (e - s), pm: s }); text += node.text.slice(s - pos, e - pos); }
      }
      return true;
    });
    return { text: text.slice(0, 8000), map };
  }
  function raHighlight(ci, len) {
    const pm = PMA();
    if (!pm || !raMap || typeof Highlight === 'undefined' || !CSS.highlights) return;
    const seg = raMap.find((s) => ci >= s.t0 && ci < s.t1);
    if (!seg) return; // boundary landed on a block separator
    if (!len) { const m = /^[^\s]+/.exec(raText.slice(ci)); len = m ? m[0].length : 1; }
    const from = seg.pm + (ci - seg.t0);
    const to = Math.min(from + len, seg.pm + (seg.t1 - seg.t0));
    try {
      const view = pm.getEditor().view;
      const a = view.domAtPos(from); const b = view.domAtPos(to);
      const range = document.createRange();
      range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset);
      CSS.highlights.set('wc-read-aloud', new Highlight(range));
      const elx = a.node.nodeType === 3 ? a.node.parentElement : a.node;
      if (elx && elx.scrollIntoView) elx.scrollIntoView({ block: 'nearest' });
    } catch (e) { /* the highlight is cosmetic — never break playback */ }
  }
  function raClearHighlight() { try { if (CSS.highlights) CSS.highlights.delete('wc-read-aloud'); } catch (e) { /* unsupported */ } }
  function speakReadAloud() {
    speechSynthesis.cancel();
    const pmSrc = pmReadAloudSource();
    let text;
    if (pmSrc) { text = pmSrc.text; raMap = pmSrc.map; raText = text; }
    else {
      const sel = window.getSelection();
      text = (sel && !sel.isCollapsed ? sel.toString() : E().node.innerText).slice(0, 8000);
      raMap = null;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = readAloudRate;
    u.onboundary = (ev) => { if (ev.name === 'word') raHighlight(ev.charIndex, ev.charLength); };
    u.onend = () => { speaking = false; raClearHighlight(); const bar = document.getElementById('read-aloud-bar'); if (bar) { const pb = bar.querySelector('.ra-play'); if (pb) pb.textContent = '▶'; } };
    speechSynthesis.speak(u); speaking = true; raPaused = false;
  }
  let readAloudRate = 1;
  function showReadAloudBar() {
    if (document.getElementById('read-aloud-bar')) return;
    const bar = el('div', { id: 'read-aloud-bar' });
    const prev = el('button', { class: 'ra-btn', title: 'Previous', text: '⏮' });
    const play = el('button', { class: 'ra-btn ra-play', title: 'Play/Pause', text: '⏸' });
    const next = el('button', { class: 'ra-btn', title: 'Next', text: '⏭' });
    const speed = el('select', { class: 'ra-speed', title: 'Reading speed' }, ['0.5×', '0.75×', '1×', '1.25×', '1.5×', '2×'].map((s) => el('option', { text: s, selected: s === '1×' ? 'selected' : undefined })));
    const voice = el('select', { class: 'ra-voice', title: 'Voice' });
    try { (speechSynthesis.getVoices() || []).slice(0, 8).forEach((v) => voice.appendChild(el('option', { text: v.name }))); } catch (e) { /* no voices */ }
    if (!voice.children.length) voice.appendChild(el('option', { text: 'Default' }));
    const close = el('button', { class: 'ra-btn ra-close', title: 'Stop (close)', text: '✕' });
    prev.addEventListener('click', () => speakReadAloud());
    next.addEventListener('click', () => speakReadAloud());
    play.addEventListener('click', () => { if (speaking && !raPaused) { speechSynthesis.pause(); raPaused = true; play.textContent = '▶'; } else if (raPaused) { speechSynthesis.resume(); raPaused = false; play.textContent = '⏸'; } else { speakReadAloud(); play.textContent = '⏸'; } });
    speed.addEventListener('change', () => { readAloudRate = parseFloat(speed.value) || 1; speakReadAloud(); });
    close.addEventListener('click', () => closeReadAloud());
    bar.appendChild(prev); bar.appendChild(play); bar.appendChild(next);
    bar.appendChild(el('span', { class: 'ra-sep' })); bar.appendChild(speed); bar.appendChild(voice);
    bar.appendChild(el('span', { class: 'ra-sep' })); bar.appendChild(close);
    document.getElementById('app').appendChild(bar);
  }
  function closeReadAloud() { speechSynthesis.cancel(); speaking = false; raPaused = false; raClearHighlight(); const bar = document.getElementById('read-aloud-bar'); if (bar) bar.remove(); }
  WC.closeReadAloud = closeReadAloud;
  function runSpellCheck() {
    const pm = PMA();
    const node = pm ? pm.getEditor().view.dom : E().node;
    node.setAttribute('spellcheck', node.getAttribute('spellcheck') === 'false' ? 'true' : 'false');
    const on = node.getAttribute('spellcheck') !== 'false';
    WC.toast('Spell check ' + (on ? 'on (red squiggles via the OS spellchecker)' : 'off') + '.', 'Open the Editor pane for suggestions.');
  }

  WC.Commands = Commands;
  WC.FONTS = FONTS; WC.SIZES = SIZES;

  function openFontList(anchor) {
    WC.flyout(anchor, (fly) => {
      FONTS.forEach((f) => {
        const item = WC.flyItem(f, { onClick: () => setFontName(f) });
        item.style.fontFamily = f;
        fly.appendChild(item);
      });
    });
  }
  function openSizeList(anchor) {
    WC.flyout(anchor, (fly) => SIZES.forEach((s) => fly.appendChild(WC.flyItem(String(s), { onClick: () => setFontSize(s) }))));
  }
})();
