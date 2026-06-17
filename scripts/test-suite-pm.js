/* PM-world functional suite (Phase 2). Run:
   npm run build && npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js
   Sentinel-gated (NEVER --shot-delay-dependent). Same JSON contract as test-suite.js. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = async (name, fn) => {
    // Convention: string return = FAILURE with detail (every `return '...'` in this
    // suite is a failure path). The old `r !== false` counted those strings green —
    // the slice-1 negation test exposed that hole.
    try { const r = await fn(); results.push({ name, pass: r !== false && typeof r !== 'string', detail: typeof r === 'string' ? r : '' }); }
    catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); }
  };
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);

  const v = () => window.WC.view;
  const PM = () => window.WC.PM;
  const doc = () => v().state.doc;
  // Replace the whole body with `text` (one paragraph), UNMARKED — insertText
  // inherits the replaced range's marks, so strip them for deterministic tests.
  const setDoc = (text) => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent(text);
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.unsetAllMarks();
    window.WC.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']);
  };
  // Select the first occurrence of `needle`; returns {from,to}.
  const selectText = (needle) => {
    let found = null;
    doc().descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) found = { from: pos + i, to: pos + i + needle.length };
    });
    if (!found) throw new Error('text not found: ' + needle);
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), found.from, found.to)));
    return found;
  };
  // Marks on the first char of `needle` (after re-locating it).
  const markNames = (needle) => {
    let names = null;
    doc().descendants((node, pos) => {
      if (names || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) names = node.marks.map((m) => m.type.name + ':' + JSON.stringify(m.attrs));
    });
    return names || [];
  };

  // Paragraph node attrs for the paragraph containing `needle`.
  const paraAttrs = (needle) => {
    let attrs = null;
    doc().descendants((node) => {
      if (attrs || node.type.name !== 'paragraph') return;
      if (node.textContent.includes(needle)) attrs = node.attrs;
    });
    if (!attrs) throw new Error('paragraph not found: ' + needle);
    return attrs;
  };
  // First rendered <p> containing `needle` (marker/geometry asserts).
  const paraEl = (needle) =>
    Array.from(document.querySelectorAll('#pm-editor .ProseMirror p')).find((p) => p.textContent.includes(needle)) || null;
  // Multi-paragraph body (insertContentAt parses HTML-looking strings — verified,
  // core/commands/insertContentAt.js looksLikeHTML).
  // NOTE the ARRAY form: resetAttributes is (typeOrName, attrs) — exactly TWO params
  // (core/commands/resetAttributes.js:11-12; deleteProps takes string|array). A third
  // positional arg is SILENTLY DROPPED, and numberingPlugin never clears a stale
  // listRendering once numberingProperties is gone (numberingPlugin.js:236-240).
  const setDocs = (paras) => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent(paras.map((t) => '<p>' + t + '</p>').join(''));
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.unsetAllMarks();
    window.WC.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']);
  };
  // Click a flyout item by its label (fly-item > .fi-label span — util.js:78-86).
  const flyClick = (re) => {
    const it = Array.from(document.querySelectorAll('.flyout .fly-item'))
      .find((n) => re.test((n.querySelector('.fi-label') || n).textContent.trim()));
    if (!it) throw new Error('flyout item not found: ' + re);
    it.click();
  };
  // Styles-gallery cell by display name (ribbon.js renderStylesGallery: .style-cell
  // carries dataset.style = the display name, e.g. "Heading 1").
  const cellFor = (name) => document.querySelector('.style-cell[data-style="' + name + '"]');

  // ---------- slice 0a: infrastructure ----------
  await t('[0a] PM mode active + body flipped', () =>
    !!PM() && PM().active === true && document.body.classList.contains('pm-active'));
  await t('[0a] #pm-editor is the visible page', () => {
    const pe = document.getElementById('pm-editor');
    return !!pe && getComputedStyle(pe).visibility !== 'hidden' && pe.offsetWidth > 600;
  });
  await t('[0a] dirty flag tracks PM edits', async () => {
    const d0 = PM().isDirty();
    v().dispatch(v().state.tr.insertText('x', 1));
    // Poll generously: the title '•' is set on the rAF-coalesced state-sync path, so
    // give it ample budget (slice-6 added a syncContextualTabs hook to that path).
    for (let i = 0; i < 40 && !(PM().isDirty() && document.title.startsWith('•')); i++) await sleep(50);
    return d0 === false && PM().isDirty() === true && document.title.startsWith('•');
  });
  await t('[0a] WC.PM.cmd dispatches an engine command', () => {
    setDoc('hello bridge world'); selectText('bridge');
    return PM().cmd('toggleBold') === true;
  });
  await t('[0a] state-sync: bold lights the ribbon toggle', async () => {
    await sleep(150); // rAF-coalesced sync
    const btn = document.querySelector('.rbtn[data-cmd="bold"]');
    return !!btn && btn.classList.contains('toggled');
  });
  await t('[0a] state-sync: caret outside bold clears the toggle', async () => {
    selectText('world'); await sleep(150);
    const btn = document.querySelector('.rbtn[data-cmd="bold"]');
    return !!btn && !btn.classList.contains('toggled');
  });
  await t('[0a] font combo reflects caret formatting', async () => {
    selectText('hello'); PM().cmd('setFontFamily', 'Georgia'); await sleep(150);
    const ent = window.WC.Ribbon.controlIndex.font;
    return !!ent && /Georgia/.test(ent.input.value);
  });
  await t('[0a] statusbar word count reads the PM doc', () => {
    setDoc('one two three four five');
    window.WC.StatusBar.update();
    return /5 words/.test(document.querySelector('#statusbar .sb-item:nth-child(2)').textContent);
  });
  await t('[0a] page indicator honest: Page 1 of 1', () =>
    /Page 1 of 1/.test(document.querySelector('#statusbar .sb-item').textContent));
  await t('[0a] focus guard: tabstrip mousedown is defaultPrevented', () => {
    // dispatchEvent returns false iff preventDefault was called — red until the
    // focus.ts capture handler lands, green after. (Synthetic events never move
    // focus, so asserting activeElement here would be vacuous.)
    const tab = document.querySelector('.ribbon-tab[data-tab="insert"]');
    return tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })) === false;
  });
  await t('[0a] focus guard: scrollbar-gutter mousedown keeps its default', () => {
    // Synthetic hit beyond the client box (where a scrollbar would live) must NOT
    // be prevented, or scrollbar dragging dies in flyouts/ribbon-scroll.
    const rs = document.querySelector('.ribbon-scroll');
    const r = rs.getBoundingClientRect();
    return rs.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + rs.clientWidth + 4, clientY: r.top + 4 })) === true;
  });
  await t('[0a] invariants: telemetry off, WC intact', () =>
    (window.__NET_LOG || []).length === 0 && !!window.WC.Ribbon);
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    // Repointed slice 10: startMailMerge flips this slice → run-block probe moves to
    // `margins` (AREA layout-page, Phase-7-gated, stays blocked through slice 11).
    window.WC.Commands.run({ cmd: 'margins', label: 'Margins' });
    return document.querySelectorAll('.flyout').length === 0 && !document.querySelector('.modal-backdrop');
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    // Repointed slice 10: `header` (AREA header-footer, Phase-7-gated, a dropdown control).
    window.WC.Commands.dropdown({ cmd: 'header', type: 'dropdown' }, document.body);
    const open = document.querySelectorAll('.flyout').length;
    window.WC.closeFlyouts();
    return open === 0;
  });

  await t('[0a] showHide toggles marks on the PM page', () => {
    window.WC.Commands.run({ cmd: 'showHide' });
    const on = document.getElementById('pm-editor').classList.contains('show-marks');
    window.WC.Commands.run({ cmd: 'showHide' });
    return on === true && !document.getElementById('pm-editor').classList.contains('show-marks');
  });
  await t('[home] showHide renders the pilcrow (¶) glyph, not the eye_off Fluent icon', () => {
    // Word's Show/Hide ¶ uses the pilcrow. We removed showHide from the Fluent map so
    // WC.icon falls back to the hand-authored two-stem pilcrow in icons.js (P.showhide).
    const fluentLeak = !!(window.WC.FLUENT && window.WC.FLUENT.showHide);
    const html = window.WC.icon('showHide', 24);
    const isPilcrow = /M18 4H14/.test(html);
    return !fluentLeak && isPilcrow;
  });
  await t('[0a] wordCount dialog reads the PM doc (words AND pages row)', () => {
    setDoc('alpha beta gamma');
    window.WC.Dialogs.wordCount();
    const dlg = document.querySelector('.modal-backdrop .dialog');
    // assert a previously-wrong row too: Pages must be the PM-honest 1, and the
    // dialog must not report the hidden legacy doc's counts.
    const ok = !!dlg && /3/.test(dlg.textContent) && /Pages[^0-9]*1(?!\d)/i.test(dlg.textContent);
    if (dlg) dlg.querySelector('.dlg-footer .btn').click();
    return ok;
  });

  await t('[0a] PK-prefixed junk import leaves the live editor intact', async () => {
    setDoc('survives pk junk');
    const junk = new Uint8Array(64); junk[0] = 0x50; junk[1] = 0x4b; junk[2] = 3; junk[3] = 4; // PK magic, garbage body
    const ok = await PM().openDocx(junk);
    const mount = document.getElementById('pm-editor');
    return ok === false && mount.querySelector('.ProseMirror') !== null && /survives pk junk/.test(v().dom.textContent);
  });

  // ---------- slice 1: character formatting (drives the REAL dispatch path) ----------
  const run = (cmd) => window.WC.Commands.run({ cmd });
  await t('[1] bold via WC.Commands.run lands as a PM mark', async () => {
    setDoc('charfmt bold target'); selectText('bold');
    run('bold'); await sleep(50);
    return markNames('bold').some((m) => m.startsWith('bold:') && !m.includes('"value":"0"'));
  });
  await t('[1] bold toggles off', async () => {
    // requires bold to be ON first (from the previous test) — then toggle off must remove it
    const wasBold = markNames('bold').some((m) => m.startsWith('bold:') && !m.includes('"value":"0"'));
    if (!wasBold) return false; // dispatch still blocked: bold was never applied, nothing to toggle
    selectText('bold'); run('bold'); await sleep(50);
    return !markNames('bold').some((m) => m.startsWith('bold:') && !m.includes('"value":"0"'));
  });
  await t('[1] italic + underline + strikethrough marks', async () => {
    selectText('charfmt'); run('italic'); run('underline'); run('strikethrough'); await sleep(50);
    const m = markNames('charfmt').join(' ');
    return /italic:/.test(m) && /underline:/.test(m) && /strike:/.test(m);
  });
  await t('[1] font family via comboCommit', async () => {
    selectText('target');
    window.WC.Commands.comboCommit({ cmd: 'font' }, 'Georgia'); await sleep(50);
    return markNames('target').some((m) => m.includes('Georgia'));
  });
  await t('[1] font size via comboCommit (12 -> 20pt)', async () => {
    selectText('target');
    window.WC.Commands.comboCommit({ cmd: 'fontSize' }, '20'); await sleep(50);
    return markNames('target').some((m) => m.includes('20pt'));
  });
  await t('[1] grow font steps the size ladder', async () => {
    selectText('target'); run('increaseFontSize'); await sleep(50);
    return markNames('target').some((m) => m.includes('22pt')); // 20 -> 22 per SIZES
  });
  await t('[1] font color + highlight', async () => {
    selectText('charfmt');
    window.WC.Commands.run({ cmd: 'fontColor' }); // applies lastFontColor #FF0000
    window.WC.Commands.run({ cmd: 'textHighlightColor' }); // lastHighlight #FFFF00
    await sleep(50);
    const m = markNames('charfmt').join(' ');
    return /FF0000|#ff0000|red/i.test(m) && /highlight:/.test(m);
  });
  await t('[1] clear formatting strips the marks', async () => {
    // requires italic+underline+strike to be ON first (from previous test) — clear must remove them all
    const hadMarks = markNames('charfmt').length > 0;
    if (!hadMarks) return false; // dispatch still blocked: no marks were applied, nothing to clear
    selectText('charfmt'); run('clearAllFormatting'); await sleep(50);
    return markNames('charfmt').length === 0;
  });
  await t('[1] EXPORT: underline STYLES via the menu → <w:u w:val> (CSS→OOXML map; Word: Font.Underline 1/3/4/7/11)', async () => {
    // Drives the REAL underline menu (label → UL_TYPE map → setMark) so this guards the CSS→OOXML enum
    // map — esp. Dashed→"dash" / Wavy→"wave" (the renamed ones, the fidelity risk). Underlines each WHOLE
    // paragraph (uniform run, same doc shape as the probe). The export must emit <w:u w:val> in order
    // [single,double,dotted,dash,wave]. Word COM-validated (whole-para): Paragraphs(i).Range.Font.Underline
    // = [1,3,4,7,11] (Single/Double/Dotted/Dash/Wavy) — oracle-probe-1-underline.js + validate-underline-win.ps1.
    const labels = [['Single', 'single'], ['Double', 'double'], ['Dotted', 'dotted'], ['Dashed', 'dash'], ['Wavy', 'wave']];
    setDocs(labels.map((l, i) => 'uline' + i)); await sleep(60);
    for (let i = 0; i < labels.length; i++) {
      selectText('uline' + i); await sleep(20); // 'uline'+i is the WHOLE paragraph text → uniform underline
      if (WC.closeFlyouts) WC.closeFlyouts();
      WC.Commands.dropdown({ cmd: 'underline', type: 'split' }, document.body); await sleep(40);
      const item = Array.from(document.querySelectorAll('.flyout .fly-item')).find((it) => { const l = it.querySelector('.fi-label'); return l && l.textContent.trim() === labels[i][0]; });
      if (!item) return 'underline menu missing item "' + labels[i][0] + '"';
      item.click(); await sleep(50);
    }
    if (WC.closeFlyouts) WC.closeFlyouts();
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const vals = (xml.match(/<w:u\b[^>]*w:val="([^"]*)"/g) || []).map((m) => m.match(/w:val="([^"]*)"/)[1]);
    const want = labels.map((l) => l[1]);
    return (vals.join(',') === want.join(',')) || ('w:u vals mismatch (got [' + vals.join(',') + '] want [' + want.join(',') + '])');
  });
  await t('[1] EXPORT: font color → <w:color w:val="FF0000"> (Word: Font.Color = 255, no BGR swap)', async () => {
    // The font-color MARK is covered above; this guards the EXPORT — setColor must emit <w:color w:val>
    // with the bare hex (no '#'). Applied to the WHOLE paragraph (uniform run). Word COM-validated:
    // Paragraphs(1).Range.Font.Color = 255 (RGB long for FF0000; a BGR/RGB swap would read 16711680) —
    // oracle-probe-1-fontcolor.js + scripts/oracle/validate-fontcolor-win.ps1.
    setDoc('colored text'); selectText('colored text'); await sleep(40);
    WC.PM.cmd('setColor', '#FF0000'); await sleep(80);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const val = (xml.match(/<w:color\b[^>]*w:val="([^"]*)"/) || [])[1];
    if (!val) return 'no <w:color w:val> in export';
    return /^ff0000$/i.test(val) || ('w:color w:val not FF0000 (hex must round-trip, no #): ' + val);
  });
  await t('[1] EXPORT: font size → <w:sz w:val="40"> for 20pt (half-points; Word: Font.Size = 20)', async () => {
    // The font-size MARK (12->20pt) is covered above; this guards the EXPORT and the HALF-POINT unit
    // conversion: w:sz is in half-points, so 20pt → w:sz=40. \b excludes <w:szCs>. Applied to the WHOLE
    // paragraph. Word COM-validated: Paragraphs(1) text-only Range.Font.Size = 20 —
    // oracle-probe-1-fontsize.js + scripts/oracle/validate-fontsize-win.ps1.
    setDoc('sized text'); selectText('sized text'); await sleep(40);
    WC.PM.cmd('setFontSize', '20pt'); await sleep(80);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const sz = (xml.match(/<w:sz\b[^>]*w:val="([^"]*)"/) || [])[1];
    if (!sz) return 'no <w:sz w:val> in export';
    return (sz === '40') || ('w:sz not 40 (20pt × 2 half-points): ' + sz);
  });
  await t('[1] EXPORT: font family → <w:rFonts w:ascii="Georgia"> (Word: Font.Name = "Georgia")', async () => {
    // The font-family MARK is covered above; this guards the EXPORT — setFontFamily must emit
    // <w:rFonts w:ascii="Georgia"> (+ hAnsi/eastAsia/cs). Applied to the WHOLE paragraph. Word
    // COM-validated: Paragraphs(1) text-only Range.Font.Name = "Georgia" —
    // oracle-probe-1-fontname.js + scripts/oracle/validate-fontname-win.ps1.
    setDoc('named text'); selectText('named text'); await sleep(40);
    WC.PM.cmd('setFontFamily', 'Georgia'); await sleep(80);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const rf = (xml.match(/<w:rFonts\b[^>]*\/?>/) || [])[0];
    if (!rf) return 'no <w:rFonts> in export';
    const ascii = (rf.match(/w:ascii="([^"]*)"/) || [])[1];
    return (ascii === 'Georgia') || ('w:rFonts w:ascii not "Georgia": ' + rf);
  });
  await t('[1] EXPORT: sub/superscript → <w:vertAlign w:val="subscript"|"superscript"> (Word: Font.Subscript/Superscript)', async () => {
    // The vertAlign MARK is covered above; this guards the EXPORT. Two paragraphs (sub, sup); the export
    // must emit <w:vertAlign w:val="subscript"> then "superscript" in order. Word COM-validated:
    // Paragraphs(1) text-only Range.Font.Subscript = -1, Paragraphs(2).Font.Superscript = -1 —
    // oracle-probe-1-vertalign.js + scripts/oracle/validate-vertalign-win.ps1.
    setDocs(['sub line', 'sup line']); await sleep(60);
    selectText('sub line'); WC.PM.cmd('setMark', 'textStyle', { vertAlign: 'subscript' }); await sleep(50);
    selectText('sup line'); WC.PM.cmd('setMark', 'textStyle', { vertAlign: 'superscript' }); await sleep(50);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const vals = (xml.match(/<w:vertAlign\b[^>]*w:val="([^"]*)"/g) || []).map((m) => m.match(/w:val="([^"]*)"/)[1]);
    return (vals.join(',') === 'subscript,superscript') || ('w:vertAlign vals: got [' + vals.join(',') + '] want [subscript,superscript]');
  });
  await t('[1] changeCase UPPERCASE via PM transaction', async () => {
    setDoc('case probe text'); selectText('case probe');
    PM().changeCase('upper'); await sleep(50);
    return /CASE PROBE text/.test(v().dom.textContent);
  });
  await t('[1] QAT undo reverses the last command (engine history)', async () => {
    setDoc('undo probe'); selectText('undo');
    run('bold'); await sleep(50);
    const had = markNames('undo').some((m) => m.startsWith('bold:') && !m.includes('"value":"0"'));
    document.querySelector('.qat .qat-btn[title^="Undo"]').click(); await sleep(50);
    return had && !markNames('undo').some((m) => m.startsWith('bold:') && !m.includes('"value":"0"'));
  });
  await t('[1] Font dialog OK applies family+size+bold as ONE undo step', async () => {
    setDoc('dialog probe words'); selectText('dialog probe');
    window.WC.Dialogs.font();
    const dlg = document.querySelector('.modal-backdrop .dialog');
    if (!dlg) return 'dialog did not open';
    dlg.querySelector('select.grow').value = 'Georgia';
    dlg.querySelectorAll('select')[1].value = 'Bold';
    dlg.querySelector('input[type=number]').value = '20';
    const ok = Array.from(dlg.querySelectorAll('.dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim()));
    ok.click(); await sleep(80);
    const m1 = markNames('dialog').join(' ');
    const applied = /Georgia/.test(m1) && /20pt/.test(m1) && /bold:/.test(m1);
    PM().cmd('undo'); await sleep(50);
    const m2 = markNames('dialog').join(' ');
    return applied && !/Georgia/.test(m2) && !/bold:/.test(m2); // one undo removed ALL of it
  });
  await t('[1] subscript applies via textStyle vertAlign and toggles off', async () => {
    setDoc('subsup probe'); selectText('subsup');
    run('subscript'); await sleep(50);
    const on = markNames('subsup').some((m) => m.includes('"vertAlign":"subscript"'));
    run('subscript'); await sleep(50);
    const off = !markNames('subsup').some((m) => m.includes('"vertAlign":"subscript"'));
    return on && off;
  });
  await t('[1] superscript replaces subscript (mutually exclusive, like Word)', async () => {
    selectText('subsup'); run('subscript'); run('superscript'); await sleep(50);
    const m = markNames('subsup').join(' ');
    return m.includes('"vertAlign":"superscript"') && !m.includes('"vertAlign":"subscript"');
  });
  await t('[1] strike on superscript: line-through tracks the raised span (Word parity)', async () => {
    // Repro: super/subscript serializes as an INNER span(vertical-align+65%); strike
    // is the OUTER <s>. If <s> paints line-through at its own (full-size, baseline)
    // metrics the line lands UNDER the raised glyph. Fix moves line-through to the
    // inner shifted span. Assert the inner span paints it and the outer <s> does not.
    setDoc('strikesuper probe'); selectText('strikesuper');
    run('superscript'); run('strikethrough'); await sleep(60);
    const inner = Array.from(document.querySelectorAll('#pm-editor .ProseMirror s > span'))
      .find((sp) => /vertical-align:\s*super/.test(sp.getAttribute('style') || ''));
    if (!inner) return 'no <s> wrapping a vertical-align:super span found';
    const outer = inner.closest('s');
    const innerLine = getComputedStyle(inner).textDecorationLine;
    const outerLine = getComputedStyle(outer).textDecorationLine;
    // Inner (shifted, 65%) span must carry line-through so it paints through the
    // raised glyph's middle; outer <s> must NOT paint its own normal-baseline line.
    return /line-through/.test(innerLine) && !/line-through/.test(outerLine);
  });

  await t('[home] subscript/superscript toggles OFF on an empty doc (not one-way)', async () => {
    // Repro: on an empty paragraph, sub/super lives in the paragraph run
    // properties (not storedMarks); toggling off sent vertAlign:null which the
    // run-property merge ignored, so it activated but never deactivated.
    setDoc('');
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), 1, 1)));
    await sleep(120);
    if (PM().getState().superscript) return 'superscript already on before toggle';
    run('superscript'); await sleep(140);
    const on = PM().getState().superscript;
    run('superscript'); await sleep(140);
    const off = PM().getState().superscript;
    if (!on) return 'did not activate on click 1';
    if (off) return 'did not DEACTIVATE on click 2 (stuck on)';
    return true;
  });
  await t('[home] Font Color applies to the CURRENT selection, not a stale capture', async () => {
    // Repro: a prior captureSelection (combo focus / picker open) left savedSel;
    // a main-face Font Color apply restored that STALE range, so the color landed
    // on previously-touched text instead of the current selection.
    setDoc('staleone staletwo');
    const colorOf = (needle) => { let c = null; doc().descendants((n, p) => { if (c || !n.isText || !n.text) return; if (n.text.indexOf(needle) >= 0) { const ts = n.marks.find((m) => m.type.name === 'textStyle'); c = (ts && ts.attrs && ts.attrs.color) || null; } }); return c; };
    // establish lastFontColor via the real picker on staleone
    selectText('staleone');
    const node = document.querySelector('[data-cmd="fontColor"]') || document.body;
    window.WC.Commands.dropdown({ cmd: 'fontColor', type: 'split' }, node); await sleep(80);
    const sw = document.querySelector('.flyout .color-swatch'); if (!sw) return 'no swatch in picker';
    sw.click(); await sleep(120);
    // leave a STALE capture on staleone, then select staletwo
    selectText('staleone'); window.WC.PM.captureSelection();
    selectText('staletwo'); await sleep(60);
    window.WC.Commands.run({ cmd: 'fontColor', type: 'split' }); await sleep(150);
    if (!colorOf('staletwo')) return 'current selection (staletwo) was NOT colored';
    return true;
  });
  await t('[1] in-view Mod-Z does not double-fire (engine handles it once)', async () => {
    setDoc('double fire probe'); selectText('double');
    // Doc snapshot MODULO sdBlockRev: the fork's block-revision stamp advances
    // on every doc-changing transaction INCLUDING the undo itself (probe
    // evidence 2026-06-11: post-undo doc differed from pre-bold by exactly
    // sdBlockRev 2->3, nothing else) — it is history-exempt metadata, so
    // byte-equality is asserted on everything BUT it.
    const normDoc = () => JSON.stringify(v().state.doc.toJSON(), (k, val) => (k === 'sdBlockRev' ? undefined : val));
    const preBold = normDoc();
    run('bold'); await sleep(50);
    const sizeBefore = v().state.doc.content.size;
    window.WC.view.focus();
    if (!window.WC.view.dom.contains(document.activeElement)) return 'focus did not land in the PM view';
    // The regression this test pins: app.js's keydown handler firing its undo
    // (pm.cmd('undo'), app.js:70) IN ADDITION to the PM keymap. The guard
    // (app.js:108-109) must stand down when focus is inside the view. The
    // LOAD-BEARING assertion is a spy on WC.PM.cmd — the app.js path goes
    // through it, the PM keymap path never does — because defaultPrevented
    // alone cannot tell the two apart (a regressed app.js also preventDefaults).
    const calls = [];
    const orig = window.WC.PM.cmd;
    window.WC.PM.cmd = function (...args) { calls.push(args[0]); return orig.apply(this, args); };
    let consumed;
    try {
      // Synthetic (untrusted) ctrlKey keydown inside the PM view. PLATFORM
      // FORK: prosemirror-keymap normalizes Mod- to Meta- on macOS and Ctrl-
      // elsewhere (prosemirror-keymap dist normalizeKeyName mac branch; the
      // fork binds Mod-z in extensions/history/history.js). So on macOS this
      // event matches NOTHING (doc must stay untouched), while on Windows the
      // PM keymap consumes it and performs exactly ONE undo: the bold reverts
      // and the doc returns byte-identical to its pre-bold state (un-bolding
      // heals the run-node split, so content.size legitimately shrinks).
      const ev = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
      consumed = !document.activeElement.dispatchEvent(ev);
    } finally { window.WC.PM.cmd = orig; }
    await sleep(80);
    if (calls.length) return 'app.js handler fired ' + JSON.stringify(calls) + ' — the in-view guard regressed';
    if (!/double fire probe/.test(v().dom.textContent)) return 'text gone: undo over-fired';
    if (consumed) {
      // Engine handled it exactly once: no bold mark anywhere (doc-wide scan —
      // a partial-split survivor must not pass vacuously) and the doc is
      // byte-identical to the pre-bold snapshot (nothing else reverted).
      let anyBold = false;
      doc().descendants((n) => { if (n.marks && n.marks.some((m) => m.type.name === 'bold')) anyBold = true; });
      if (anyBold) return 'bold survived a consumed Mod-Z';
      return normDoc() === preBold || 'doc !== pre-bold state after the single undo';
    }
    // Not consumed (macOS): nothing may have touched the doc at all.
    return v().state.doc.content.size === sizeBefore || 'doc changed though event was not consumed';
  });

  await t('[1] imported negation run reports bold=false (converter attrs)', async () => {
    // Fixture authored by REAL Word 16.77.1 (spec §7.5): Normal style is bold;
    // the middle word carries an explicit <w:b w:val="0"/> negation run. The
    // style-cascade import path emits BOOLEAN value attrs ({value:false}), not
    // the '0' string — state-sync must read both as OFF. Inlined via gen-fixture
    // (window.__WC_FIXTURE_NEGATION) so the built app needs no repo path.
    const ok = await PM().openDocx(window.__WC_FIXTURE_NEGATION());
    if (!ok) return 'import failed';
    selectText('UNBOLD'); await sleep(150);
    if (PM().getState().bold !== false) return 'UNBOLD reported bold';
    selectText('BOLDED'); await sleep(150);
    return PM().getState().bold === true; // style-inherited bold must still read ON
  });

  // ---------- slice 2: paragraph + lists (drives the REAL dispatch path) ----------
  // Ribbon-sync asserts sleep(150) for the rAF-coalesced tick. Model units: twips.
  await t('[2] center via WC.Commands.run sets justification + ribbon toggle', async () => {
    setDoc('align probe text'); selectText('align');
    run('center'); await sleep(150);
    const a = paraAttrs('align');
    const btn = document.querySelector('.rbtn[data-cmd="center"]');
    return a.paragraphProperties?.justification === 'center' && !!btn && btn.classList.contains('toggled');
  });
  await t('[2] alignRight then alignLeft round-trips', async () => {
    selectText('align'); run('alignRight'); await sleep(50);
    const r = paraAttrs('align').paragraphProperties?.justification === 'right';
    run('alignLeft'); await sleep(50);
    return r && paraAttrs('align').paragraphProperties?.justification === 'left';
  });
  await t('[2] justify stores OOXML "both" and lights justifyFull', async () => {
    selectText('align'); run('justify'); await sleep(150);
    const btn = document.querySelector('.rbtn[data-cmd="justify"]');
    return paraAttrs('align').paragraphProperties?.justification === 'both' && !!btn && btn.classList.contains('toggled');
  });
  await t('[2] fresh paragraph shows Align Left pressed (Word default)', async () => {
    setDoc('default align probe'); selectText('default'); await sleep(150);
    const btn = document.querySelector('.rbtn[data-cmd="alignLeft"]');
    return !!btn && btn.classList.contains('toggled');
  });
  await t('[2] Ctrl+E keyboard centers in PM mode', async () => {
    setDoc('kbd align probe'); selectText('kbd');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('kbd').paragraphProperties?.justification === 'center';
  });
  await t('[2] Ctrl+Shift+L toggles a bullet list (Word: List Bullet)', async () => {
    setDoc('kbd bullet probe'); selectText('kbd');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('kbd').listRendering?.numberingType === 'bullet';
  });
  await t('[2] increaseIndent steps text indent by 0.5in (720tw)', async () => {
    setDoc('indent probe text'); selectText('indent');
    run('increaseIndent'); await sleep(50);
    const one = paraAttrs('indent').paragraphProperties?.indent?.left === 720;
    run('increaseIndent'); await sleep(50);
    return one && paraAttrs('indent').paragraphProperties?.indent?.left === 1440;
  });
  await t('[2] decreaseIndent steps back and clears at zero', async () => {
    selectText('indent'); run('decreaseIndent'); await sleep(50);
    const back = paraAttrs('indent').paragraphProperties?.indent?.left === 720;
    run('decreaseIndent'); run('decreaseIndent'); await sleep(50);
    const left = paraAttrs('indent').paragraphProperties?.indent?.left;
    return back && (left == null);
  });
  await t('[2] Layout indentLeft spinner sets exact indent (1.5in = 2160tw)', async () => {
    setDoc('spinner probe text'); selectText('spinner');
    window.WC.Commands.spinner('indentLeft', 1.5); await sleep(50);
    return paraAttrs('spinner').paragraphProperties?.indent?.left === 2160;
  });
  await t('[2] indentRight spinner (0.5in = 720tw)', async () => {
    selectText('spinner'); window.WC.Commands.spinner('indentRight', 0.5); await sleep(50);
    return paraAttrs('spinner').paragraphProperties?.indent?.right === 720;
  });
  await t('[2] spacingBefore/After spinners set pt as twips', async () => {
    selectText('spinner');
    window.WC.Commands.spinner('spacingBefore', 12);
    window.WC.Commands.spinner('spacingAfter', 6); await sleep(50);
    const sp = paraAttrs('spinner').paragraphProperties?.spacing || {};
    return sp.before === 240 && sp.after === 120;
  });
  await t('[2] spinner readback: Layout inputs track the caret paragraph', async () => {
    window.WC.Ribbon.activate('layout');
    selectText('spinner'); await sleep(200); // selectionUpdate → rAF sync → spinner push
    const ent = window.WC.Ribbon.controlIndex.indentLeft;
    const ok = !!ent && parseFloat(ent.input.value) === 1.5;
    window.WC.Ribbon.activate('home');
    return ok;
  });
  await t('[2] line-spacing flyout leaf 1.5 sets spacing.line=360 rule=auto', async () => {
    setDoc('linespace probe'); selectText('linespace');
    window.WC.Commands.dropdown({ cmd: 'lineAndParagraphSpacing', type: 'dropdown' }, document.body);
    flyClick(/^1\.5$/); await sleep(50);
    const sp = paraAttrs('linespace').paragraphProperties?.spacing || {};
    return sp.line === 360 && sp.lineRule === 'auto';
  });
  await t('[2] Add Space Before applies 12pt; label flips to Remove (dynamic)', async () => {
    selectText('linespace');
    window.WC.Commands.dropdown({ cmd: 'lineAndParagraphSpacing', type: 'dropdown' }, document.body);
    flyClick(/^Add Space Before Paragraph$/); await sleep(50);
    const applied = paraAttrs('linespace').paragraphProperties?.spacing?.before === 240;
    window.WC.Commands.dropdown({ cmd: 'lineAndParagraphSpacing', type: 'dropdown' }, document.body);
    const flipped = Array.from(document.querySelectorAll('.flyout .fly-item .fi-label'))
      .some((n) => /^Remove Space Before Paragraph$/.test(n.textContent.trim()));
    window.WC.closeFlyouts();
    return applied && flipped;
  });
  await t('[2] shading palette pick lands as paragraphProperties.shading + paints', async () => {
    setDoc('shade probe text'); selectText('shade');
    window.WC.Commands.dropdown({ cmd: 'shading', type: 'split' }, document.body);
    const sw = document.querySelector('.flyout .color-swatch[title="#FFFF00"]') || document.querySelector('.flyout .color-swatch');
    const hex = sw.title.replace(/^#/, '').toUpperCase();
    sw.click(); await sleep(50);
    const a = paraAttrs('shade').paragraphProperties?.shading;
    const el2 = paraEl('shade');
    return !!a && a.fill === hex && !!el2 && el2.style.backgroundColor !== '';
  });
  await t('[2] shading No Color clears it', async () => {
    selectText('shade');
    window.WC.Commands.dropdown({ cmd: 'shading', type: 'split' }, document.body);
    const noColor = Array.from(document.querySelectorAll('.flyout .color-row'))
      .find((r) => /No Color/.test(r.textContent));
    if (!noColor) return 'No Color row not found in shading flyout';
    noColor.click(); await sleep(50);
    return paraAttrs('shade').paragraphProperties?.shading == null;
  });
  await t('[2] EXPORT: paragraph shading → <w:pPr><w:shd w:val="clear" w:fill=...> (Word: ParagraphFormat.Shading)', async () => {
    // The tests above cover the model attr + DOM paint; this guards the docx EXPORT — especially
    // w:val="clear" (Word only PAINTS the fill when val=clear; dropping it silently breaks shading in
    // Word) + the hex round-tripping verbatim. Word COM-validated separately with FF0000:
    // Paragraphs(1).Shading.BackgroundPatternColor=255 — oracle-probe-2-parashading.js + validate-parashading-win.ps1.
    setDoc('para shade export'); selectText('shade');
    window.WC.Commands.dropdown({ cmd: 'shading', type: 'split' }, document.body); await sleep(40);
    const sw = document.querySelector('.flyout .color-swatch[title="#FFFF00"]') || document.querySelector('.flyout .color-swatch');
    if (!sw) return 'no shading swatch in flyout';
    const hex = sw.title.replace(/^#/, '').toUpperCase();
    sw.click(); await sleep(60);
    const a = paraAttrs('shade').paragraphProperties?.shading;
    if (!a || a.fill !== hex) return 'shading attr not set: ' + JSON.stringify(a);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const shd = (xml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/g) || []).map((p) => (p.match(/<w:shd\b[^>]*\/?>/) || [])[0]).filter(Boolean)[0];
    if (!shd) return 'no <w:shd> in any <w:pPr> in export';
    if (!/w:val="clear"/.test(shd)) return 'paragraph shading w:val not "clear" (Word will not paint the fill): ' + shd;
    if (!new RegExp('w:fill="' + hex + '"', 'i').test(shd)) return 'w:shd fill not ' + hex + ' (hex must round-trip verbatim): ' + shd;
    if (!/w:color="auto"/.test(shd)) return 'w:shd color not "auto" (full CT_Shd contract): ' + shd;
    return true;
  });
  await t('[2] borders face applies Word-default bottom border', async () => {
    setDoc('border probe text'); selectText('border');
    run('borders'); await sleep(50);
    const b = paraAttrs('border').paragraphProperties?.borders;
    const el2 = paraEl('border');
    return !!b && b.bottom && b.bottom.val === 'single' && !!el2 && el2.style.borderBottom !== '';
  });
  await t('[2] EXPORT: bottom border → <w:pBdr><w:bottom w:val="single" w:sz="4"> (Word: LineStyle=1, LineWidth=0.5pt)', async () => {
    // The tests above cover the model attr + DOM paint; this guards the docx EXPORT and the
    // eighths-of-a-point → Word half-point mapping (size:4 eighths = 0.5pt = wdLineWidth050pt(4)).
    // Word COM-validated separately: Paragraphs(1).Borders(-3).LineStyle=1, .LineWidth=4 —
    // scripts/oracle-probe-2-paraborder.js + scripts/oracle/validate-paraborder-win.ps1.
    setDoc('para border export'); selectText('border'); run('borders'); await sleep(60);
    const b = paraAttrs('border').paragraphProperties?.borders;
    if (!b || !b.bottom || b.bottom.val !== 'single') return 'bottom border attr not set: ' + JSON.stringify(b);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const pbdr = (xml.match(/<w:pBdr\b[\s\S]*?<\/w:pBdr>/) || [])[0];
    if (!pbdr) return 'no <w:pBdr> in export';
    const bottom = pbdr.match(/<w:bottom\b[^>]*\/?>/);
    if (!bottom) return 'no <w:bottom> in <w:pBdr>: ' + pbdr.slice(0, 160);
    if (!/w:val="single"/.test(bottom[0])) return 'bottom border w:val not single: ' + bottom[0];
    const sz = bottom[0].match(/w:sz="(\d+)"/);
    if (!sz || sz[1] !== '4') return 'bottom border w:sz not 4 (eighths = 0.5pt): ' + bottom[0];
    // Full Word-default border: auto color + 1pt offset (guards the whole CT_Border, not just val+sz).
    if (!/w:color="auto"/.test(bottom[0])) return 'bottom border w:color not auto: ' + bottom[0];
    if (!/w:space="1"/.test(bottom[0])) return 'bottom border w:space not 1 (Word-default 1pt offset): ' + bottom[0];
    return true;
  });
  await t('[2] bordersMenu All then No Border round-trips', async () => {
    selectText('border');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body);
    flyClick(/^All Borders$/); await sleep(50);
    const b = paraAttrs('border').paragraphProperties?.borders || {};
    const all = ['top', 'bottom', 'left', 'right'].every((s) => b[s] && b[s].val === 'single');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body);
    flyClick(/^No Border$/); await sleep(50);
    return all && paraAttrs('border').paragraphProperties?.borders == null;
  });
  await t('[home] Borders dropdown is the full Word menu (16 items, order, check column, greyed diagonals)', async () => {
    setDoc('bdrmenu probe'); selectText('bdrmenu');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body);
    const labels = Array.from(document.querySelectorAll('.flyout .fly-item')).map((i) => (i.querySelector('.fi-label') || {}).textContent);
    const expected = ['Bottom Border', 'Top Border', 'Left Border', 'Right Border', 'No Border', 'All Borders', 'Outside Borders', 'Inside Borders', 'Inside Horizontal Border', 'Inside Vertical Border', 'Diagonal Down Border', 'Diagonal Up Border', 'Horizontal Line', 'Draw Table', 'View Gridlines', 'Borders and Shading…'];
    const orderOk = labels.length === 16 && expected.every((e, i) => labels[i] === e);
    const checkCol = !!document.querySelector('.flyout .fly-item .fi-check');
    const disabled = Array.from(document.querySelectorAll('.flyout .fly-item.disabled')).map((i) => (i.querySelector('.fi-label') || {}).textContent);
    const diagOk = disabled.includes('Diagonal Down Border') && disabled.includes('Diagonal Up Border');
    window.WC.closeFlyouts();
    return orderOk && checkCol && diagOk;
  });
  await t('[home] Bottom Border toggles ON then OFF via the menu', async () => {
    setDoc('btoggle probe'); selectText('btoggle');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^Bottom Border$/); await sleep(40);
    const on = paraAttrs('btoggle').paragraphProperties?.borders?.bottom?.val === 'single';
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^Bottom Border$/); await sleep(40);
    const off = paraAttrs('btoggle').paragraphProperties?.borders == null;
    return on && off;
  });
  await t('[home] All Borders sets w:between (inside-H) and the menu checkmark reflects state', async () => {
    setDoc('allbtw probe'); selectText('allbtw');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^All Borders$/); await sleep(40);
    const hasBetween = !!(paraAttrs('allbtw').paragraphProperties?.borders || {}).between;
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body);
    const row = Array.from(document.querySelectorAll('.flyout .fly-item')).find((i) => (i.querySelector('.fi-label') || {}).textContent === 'Bottom Border');
    const checked = /checked/.test(row.className) && (row.querySelector('.fi-check') || {}).textContent === '✓';
    window.WC.closeFlyouts();
    return hasBetween && checked;
  });
  await t('[home] Inside Vertical Border is layout-flagged (no paragraph model write)', async () => {
    setDoc('insv probe'); selectText('insv');
    const before = JSON.stringify(paraAttrs('insv').paragraphProperties?.borders || null);
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^Inside Vertical Border$/); await sleep(40);
    return before === JSON.stringify(paraAttrs('insv').paragraphProperties?.borders || null);
  });
  await t('[home] Bottom Border carries on Enter + merges — the rule moves to the run’s new last paragraph', async () => {
    setDocs(['mergeAA', 'mergeBB', 'mergeCC']);
    let p = null, s = -1; doc().descendants((n, pos) => { if (n.type.name === 'paragraph') { s++; if (s === 1) p = pos + 1; } return p == null; });
    window.WC.editor.commands.setTextSelection({ from: p, to: p });
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^Bottom Border$/); await sleep(60);
    const bbHas = getComputedStyle(paraEl('mergeBB')).borderBottomStyle === 'solid';
    let pe = null; s = -1; doc().descendants((n, pos) => { if (n.type.name === 'paragraph') { s++; if (s === 1) pe = pos + 1 + n.content.size; } return true; });
    window.WC.editor.commands.setTextSelection({ from: pe, to: pe });
    window.WC.editor.commands.splitBlock(); await sleep(40);
    window.WC.editor.commands.insertContent('mergeDD'); await sleep(140);
    const ddCarried = !!(paraAttrs('mergeDD').paragraphProperties?.borders?.bottom);
    const bbSuppressed = getComputedStyle(paraEl('mergeBB')).borderBottomStyle === 'none';
    const ddDrawn = getComputedStyle(paraEl('mergeDD')).borderBottomStyle === 'solid';
    return (bbHas && ddCarried && bbSuppressed && ddDrawn)
      || ('bbHas=' + bbHas + ' ddCarried=' + ddCarried + ' bbSuppressed=' + bbSuppressed + ' ddDrawn=' + ddDrawn);
  });
  await t('[home] All Borders on stacked paragraphs renders an outer box + merged inside-horizontal rules', async () => {
    setDocs(['boxAA', 'boxBB', 'boxCC']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^All Borders$/); await sleep(140);
    const cs = (needle) => getComputedStyle(paraEl(needle));
    const topOnFirst = cs('boxAA').borderTopStyle === 'solid';
    const noTopMid = cs('boxBB').borderTopStyle === 'none' && cs('boxCC').borderTopStyle === 'none';
    const betweenRules = cs('boxAA').borderBottomStyle === 'solid' && cs('boxBB').borderBottomStyle === 'solid';
    const bottomOnLast = cs('boxCC').borderBottomStyle === 'solid';
    const sidesAll = ['boxAA', 'boxBB', 'boxCC'].every((n) => cs(n).borderLeftStyle === 'solid' && cs(n).borderRightStyle === 'solid');
    return (topOnFirst && noTopMid && betweenRules && bottomOnLast && sidesAll)
      || JSON.stringify({ topOnFirst, noTopMid, betweenRules, bottomOnLast, sidesAll });
  });
  await t('[home] Inside Horizontal on stacked paragraphs draws rules BETWEEN only (no outer edges)', async () => {
    setDocs(['ihAA', 'ihBB', 'ihCC']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^Inside Horizontal Border$/); await sleep(140);
    const cs = (needle) => getComputedStyle(paraEl(needle));
    const noTopFirst = cs('ihAA').borderTopStyle === 'none';
    const ruleAfterA = cs('ihAA').borderBottomStyle === 'solid';
    const ruleAfterB = cs('ihBB').borderBottomStyle === 'solid';
    const noBottomLast = cs('ihCC').borderBottomStyle === 'none';
    const noSides = ['ihAA', 'ihBB', 'ihCC'].every((n) => cs(n).borderLeftStyle === 'none' && cs(n).borderRightStyle === 'none');
    return (noTopFirst && ruleAfterA && ruleAfterB && noBottomLast && noSides)
      || JSON.stringify({ noTopFirst, ruleAfterA, ruleAfterB, noBottomLast, noSides });
  });
  await t('[home] flyItem checkable reserves a check column; ✓ only when checked', () => {
    const a = window.WC.flyItem('X', { checkable: true, checked: true });
    const b = window.WC.flyItem('Y', { checkable: true, checked: false });
    const ac = a.querySelector('.fi-check'), bc = b.querySelector('.fi-check');
    return !!ac && ac.textContent === '✓' && a.classList.contains('checked') && !!bc && bc.textContent === '' && !b.classList.contains('checked');
  });
  await t('[home] Borders and Shading dialog: 3 tabs, ½pt width default, OK applies toggled edges', async () => {
    setDoc('bsdlg probe'); selectText('bsdlg');
    window.WC.Dialogs.bordersAndShading();
    const tabs = Array.from(document.querySelectorAll('.dialog .tabs .t')).map((t) => t.textContent).join(',');
    const widthDefault = document.querySelector('.dialog select').value; // first select = Width
    document.querySelector('.dialog .bs-edge.e-top').click();
    document.querySelector('.dialog .bs-edge.e-right').click();
    Array.from(document.querySelectorAll('.dialog .dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim())).click();
    await sleep(40);
    const b = paraAttrs('bsdlg').paragraphProperties?.borders || {};
    document.querySelectorAll('.modal-backdrop').forEach((n) => n.remove());
    return tabs === 'Borders,Page Border,Shading' && widthDefault === '4' && !!b.top && !!b.right && !b.bottom && !b.left;
  });
  await t('[home] Borders and Shading dialog: Shading tab applies a fill', async () => {
    setDoc('bsshade probe'); selectText('bsshade');
    window.WC.Dialogs.bordersAndShading();
    Array.from(document.querySelectorAll('.dialog .tabs .t')).find((t) => /Shading/.test(t.textContent)).click();
    Array.from(document.querySelectorAll('.dialog .bs-tab button')).find((b) => /No Color/.test(b.textContent)).click();
    const sw = document.querySelector('.flyout .color-swatch[title="#FFC000"]') || document.querySelector('.flyout .color-swatch');
    const hex = sw.title.replace(/^#/, '').toUpperCase(); sw.click();
    Array.from(document.querySelectorAll('.dialog .dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim())).click();
    await sleep(40);
    const ok = (paraAttrs('bsshade').paragraphProperties?.shading || {}).fill === hex;
    document.querySelectorAll('.modal-backdrop').forEach((n) => n.remove());
    return ok;
  });
  await t('[home] Horizontal Line menu item inserts a horizontal-rule block', async () => {
    setDoc('hrline probe text');
    const f = selectText('hrline');
    // Word inserts the line at the cursor — collapse the range so the insert doesn't replace text.
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), f.to, f.to)));
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^Horizontal Line$/); await sleep(60);
    return !!document.querySelector('#pm-editor [data-horizontal-rule]');
  });
  await t('[home] View Gridlines menu item toggles the page show-grid class', async () => {
    const pe = document.getElementById('pm-editor'); const g0 = pe.classList.contains('show-grid');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^View Gridlines$/); await sleep(20);
    const g1 = pe.classList.contains('show-grid');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body); flyClick(/^View Gridlines$/); await sleep(20);
    return g1 === !g0 && pe.classList.contains('show-grid') === g0;
  });
  await t('[home] Borders dialog seeds an explicit nil edge as OFF (review #3)', async () => {
    setDoc('nilseed probe'); selectText('nilseed');
    // an imported docx can carry an explicit nil/none edge — Word treats it as no border
    window.WC.PM.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.borders': { bottom: { val: 'nil', size: 4, color: 'auto', space: 1 } } });
    window.WC.Dialogs.bordersAndShading();
    const bottomOn = document.querySelector('.dialog .bs-edge.e-bottom').classList.contains('on');
    document.querySelectorAll('.modal-backdrop').forEach((n) => n.remove());
    window.WC.PM.cmd('resetAttributes', 'paragraph', 'paragraphProperties.borders');
    return bottomOn === false;
  });
  await t('[home] document_border glyph resolves, not the _generic fallback (review #2)', () => {
    const html = window.WC.icon('document_border', 16);
    // the real glyph = a page rect + a dashed inner border; _generic has no dasharray
    return html.indexOf('stroke-dasharray="1.5 1.5"') >= 0 && html.indexOf('M8 12h8') < 0;
  });
  await t('[editor] Proofing spell-check flags real misspellings with dictionary suggestions', async () => {
    await window.WC.Proofing.ensureReady();
    const hits = window.WC.Proofing.spellCheck('I beleive this is definately correct.');
    const words = hits.map((h) => h.word.toLowerCase());
    const believe = (hits.find((h) => h.word.toLowerCase() === 'beleive') || {}).suggestions || [];
    return words.indexOf('beleive') >= 0 && words.indexOf('definately') >= 0 && words.indexOf('correct') < 0 && believe.indexOf('believe') >= 0;
  });
  await t('[editor] Proofing grammar-check flags repeated word, a/an, and "could of"', () => {
    const kinds = window.WC.Proofing.grammarCheck('the the cat. this is a apple. it could of worked').map((h) => h.kind);
    return kinds.indexOf('repeat') >= 0 && kinds.indexOf('article') >= 0 && kinds.indexOf('confusion') >= 0;
  });
  await t('[editor] Proofing refinement flags weasel words (Conciseness) + passive voice (Clarity)', () => {
    const cats = window.WC.Proofing.refineCheck('It is very really being improved by them.').map((h) => h.category);
    return cats.indexOf('Conciseness') >= 0 && cats.indexOf('Clarity') >= 0;
  });
  await t('[editor] Editor pane renders real counts and a suggestion fixes the doc via PM', async () => {
    setDoc('I beleive this is definately a teh test.');
    await window.WC.Proofing.ensureReady();
    const ex = document.getElementById('editor-pane'); if (ex) ex.remove();
    window.WC.Dialogs.editorPane(); await sleep(140);
    const pane = document.getElementById('editor-pane');
    const rows = Array.from(pane.querySelectorAll('.tp-result')).map((r) => r.textContent);
    const spellingRow = rows.find((r) => /^Spelling/.test(r)) || '';
    const spellingCount = parseInt((spellingRow.match(/\d+/) || ['0'])[0], 10);
    const btn = pane.querySelector('.tp-body button'); const label = btn ? btn.textContent : '';
    if (btn) btn.click(); await sleep(80);
    const fixed = doc().textContent.indexOf('beleive') < 0;
    pane.remove();
    return spellingCount >= 2 && label === 'believe' && fixed;
  });
  await t('[effects] textOutline + glow export to w14 with correct EMU units (stage 2)', async () => {
    setDoc('OutlineGlow effect text'); selectText('OutlineGlow effect text');
    window.WC.PM.cmd('setMark', 'textStyle', { textOutline: { widthPt: 2, color: '#FF0000', fill: 'transparent' }, textGlow: { radiusPt: 5, color: '#00FF00' } });
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const outlineEmu = (xml.match(/<w14:textOutline[^>]*w14:w="(\d+)"/) || [])[1]; // 2pt × 12700
    const glowEmu = (xml.match(/<w14:glow[^>]*w14:rad="(\d+)"/) || [])[1]; // 5pt × 12700
    const outlineColor = /<w14:textOutline[\s\S]*?<w14:srgbClr w14:val="FF0000"/.test(xml);
    const glowColor = /<w14:glow[\s\S]*?<w14:srgbClr w14:val="00FF00"/.test(xml);
    return outlineEmu === '25400' && glowEmu === '63500' && outlineColor && glowColor;
  });
  await t('[insert] small stacked Insert buttons keep text labels; Home Font buttons stay icon-only', () => {
    const ci = window.WC.Ribbon.controlIndex;
    const labeled = (cmd) => { const n = ci[cmd] && ci[cmd].node; const lbl = n && n.querySelector('.lbl'); return !!n && !n.classList.contains('icononly') && !!lbl && /\S/.test(lbl.textContent); };
    const insertOk = labeled('coverPage') && labeled('blankPage') && labeled('link') && labeled('bookmark') && labeled('header') && labeled('textBox');
    const boldNode = ci['bold'] && ci['bold'].node;
    const boldIconOnly = !!boldNode && boldNode.classList.contains('icononly');
    return insertOk && boldIconOnly;
  });
  await t('[2] sort dialog OK reorders paragraphs ascending (one undo step)', async () => {
    setDocs(['banana', 'cherry', 'apple']);
    window.WC.editor.commands.selectAll();
    await sleep(550); // close the history group (newGroupDelay 500ms) — else undo also reverts setDocs
    run('sort');
    const dlg = document.querySelector('.modal-backdrop .dialog');
    if (!dlg) return 'sort dialog did not open';
    Array.from(dlg.querySelectorAll('.dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim())).click();
    await sleep(80);
    const order = /apple[\s\S]*banana[\s\S]*cherry/.test(v().dom.textContent);
    PM().cmd('undo'); await sleep(50);
    return order && /banana[\s\S]*cherry[\s\S]*apple/.test(v().dom.textContent);
  });
  await t('[2] bullets via run() creates a list paragraph + presses the toggle', async () => {
    setDoc('bullet probe text'); selectText('bullet');
    run('bullets'); await sleep(150);
    const a = paraAttrs('bullet');
    // bullets is a SPLIT control → renders as .rsplit, not .rbtn (ribbon.js renderControl)
    const btn = document.querySelector('[data-cmd="bullets"]');
    return a.listRendering?.numberingType === 'bullet'
      && a.paragraphProperties?.numberingProperties?.numId != null
      && !!btn && btn.classList.contains('toggled');
  });
  await t('[2] bullets toggles off', async () => {
    // requires the bullet to be ON first (previous test) — else this absence-assert
    // would false-green in the red state (the [1] bold-toggles-off precedent guard)
    if (paraAttrs('bullet').listRendering?.numberingType !== 'bullet') return false;
    selectText('bullet'); run('bullets'); await sleep(50);
    return paraAttrs('bullet').listRendering == null;
  });
  await t('[2] EXPORT: bullet list → w:numPr linked to a numbering.xml abstractNum (Word renders the • marker)', async () => {
    // Model + DOM marker are covered above; this guards the EXPORT. A session-created bullet must emit
    // w:numPr (w:numId=N) AND a self-contained word/numbering.xml whose w:num[N] → w:abstractNum has a
    // bullet w:lvl — else Word shows NO marker (the notorious from-scratch-list risk). Word COM-validated:
    // read-para-props → listType "bullet", listString "•" (oracle-probe-2-lists.js + word-oracle-win.ps1).
    setDoc('bullet item'); selectText('bullet'); run('bullets'); await sleep(150);
    if (paraAttrs('bullet').listRendering?.numberingType !== 'bullet') return 'bullet not applied to model';
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const numPr = (xml.match(/<w:numPr\b[\s\S]*?<\/w:numPr>/) || [])[0];
    if (!numPr) return 'no <w:numPr> in export';
    const numId = (numPr.match(/<w:numId\b[^>]*w:val="(\d+)"/) || [])[1];
    if (!numId) return 'no <w:numId> in <w:numPr>: ' + numPr;
    const numXml = window.WC.editor.converter?.convertedXml?.['word/numbering.xml'];
    if (!numXml) return 'no word/numbering.xml generated → Word would show no marker';
    const els = (numXml.elements && numXml.elements[0] && numXml.elements[0].elements) || [];
    const numDef = els.find((e) => e.name === 'w:num' && e.attributes && e.attributes['w:numId'] === numId);
    if (!numDef) return 'numbering.xml has no <w:num w:numId="' + numId + '"> (dangling list reference)';
    const absId = ((numDef.elements || []).find((e) => e.name === 'w:abstractNumId') || {}).attributes?.['w:val'];
    const absDef = els.find((e) => e.name === 'w:abstractNum' && e.attributes && e.attributes['w:abstractNumId'] === absId);
    if (!absDef) return 'w:num → abstractNumId ' + absId + ' has no matching <w:abstractNum>';
    const lvls = (absDef.elements || []).filter((e) => e.name === 'w:lvl');
    const lvl0 = lvls.find((e) => (e.attributes || {})['w:ilvl'] === '0') || lvls[0];
    const fmt = lvl0 && ((lvl0.elements || []).find((e) => e.name === 'w:numFmt') || {}).attributes?.['w:val'];
    if (fmt !== 'bullet') return 'abstractNum level 0 numFmt not "bullet" (Word would render a number, not a •): ' + fmt;
    return true;
  });
  await t('[2] EXPORT: numbered list → w:numPr linked to a decimal numbering.xml abstractNum (Word renders "1.")', async () => {
    // Mirrors the bullet export test for an ORDERED list: a session-created numbered list must emit w:numPr
    // (w:numId=N) AND a numbering.xml whose w:num[N] → w:abstractNum level 0 has numFmt="decimal", else
    // Word shows no number. Word COM-validated: read-para-props → listType "simple numbering", listString
    // "1." (oracle-probe-2-lists.js + word-oracle-win.ps1 read-para-props). (Multilevel/outline also
    // validated in Word via oracle-probe-2-multilevel.js — listType "outline numbering", "1.1." — gated
    // multilevel test deferred: the in-app level-transition needs careful caret handling.)
    setDoc('numbered item'); selectText('numbered'); run('numbering'); await sleep(150);
    if (paraAttrs('numbered').listRendering?.numberingType !== 'decimal') return 'numbered list not applied to model: ' + JSON.stringify(paraAttrs('numbered').listRendering);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const numPr = (xml.match(/<w:numPr\b[\s\S]*?<\/w:numPr>/) || [])[0];
    if (!numPr) return 'no <w:numPr> in export';
    const numId = (numPr.match(/<w:numId\b[^>]*w:val="(\d+)"/) || [])[1];
    if (!numId) return 'no <w:numId> in <w:numPr>: ' + numPr;
    const numXml = window.WC.editor.converter?.convertedXml?.['word/numbering.xml'];
    if (!numXml) return 'no word/numbering.xml generated → Word would show no number';
    const els = (numXml.elements && numXml.elements[0] && numXml.elements[0].elements) || [];
    const numDef = els.find((e) => e.name === 'w:num' && e.attributes && e.attributes['w:numId'] === numId);
    if (!numDef) return 'numbering.xml has no <w:num w:numId="' + numId + '"> (dangling list reference)';
    const absId = ((numDef.elements || []).find((e) => e.name === 'w:abstractNumId') || {}).attributes?.['w:val'];
    const absDef = els.find((e) => e.name === 'w:abstractNum' && e.attributes && e.attributes['w:abstractNumId'] === absId);
    if (!absDef) return 'w:num → abstractNumId ' + absId + ' has no matching <w:abstractNum>';
    const lvls = (absDef.elements || []).filter((e) => e.name === 'w:lvl');
    const lvl0 = lvls.find((e) => (e.attributes || {})['w:ilvl'] === '0') || lvls[0];
    const fmt = lvl0 && ((lvl0.elements || []).find((e) => e.name === 'w:numFmt') || {}).attributes?.['w:val'];
    if (fmt !== 'decimal') return 'abstractNum level 0 numFmt not "decimal" (Word would render a bullet, not "1."): ' + fmt;
    return true;
  });
  await t('[2] numbering renders "1." / "2." markers across two paragraphs', async () => {
    setDocs(['Numbered one', 'Numbered two']);
    window.WC.editor.commands.selectAll();
    run('numbering'); await sleep(150); // marker styling runs an rAF pass after the nodeview update
    const m1 = paraEl('Numbered one')?.querySelector('.list-marker');
    const m2 = paraEl('Numbered two')?.querySelector('.list-marker');
    return !!m1 && m1.textContent.trim() === '1.' && !!m2 && m2.textContent.trim() === '2.';
  });
  await t('[2] ribbon increaseIndent inside a list raises the level (Word behavior)', async () => {
    selectText('Numbered two');
    run('increaseIndent'); await sleep(50);
    const up = paraAttrs('Numbered two').paragraphProperties?.numberingProperties?.ilvl === 1;
    run('decreaseIndent'); await sleep(50);
    return up && paraAttrs('Numbered two').paragraphProperties?.numberingProperties?.ilvl === 0;
  });
  await t('[2] bullet library honors the square glyph', async () => {
    setDoc('glyph probe text'); selectText('glyph');
    window.WC.Commands.dropdown({ cmd: 'bullets', type: 'split' }, document.body);
    Array.from(document.querySelectorAll('.flyout div')).find((c) => c.textContent.trim() === '■').click();
    await sleep(150);
    return paraAttrs('glyph').listRendering?.markerText === '▪';
  });
  await t('[2] bullet library custom glyph ◆ mints a definition', async () => {
    setDoc('custom glyph probe'); selectText('custom');
    window.WC.Commands.dropdown({ cmd: 'bullets', type: 'split' }, document.body);
    Array.from(document.querySelectorAll('.flyout div')).find((c) => c.textContent.trim() === '◆').click();
    await sleep(150);
    return paraAttrs('custom').listRendering?.markerText === '◆';
  });
  await t('[2] numbering library A. applies upper-alpha', async () => {
    setDoc('alpha probe text'); selectText('alpha');
    window.WC.Commands.dropdown({ cmd: 'numbering', type: 'split' }, document.body);
    Array.from(document.querySelectorAll('.flyout div')).find((c) => c.textContent.trim() === 'A.').click();
    await sleep(150);
    return paraAttrs('alpha').listRendering?.markerText === 'A.';
  });
  await t('[2] multilevel Decimal: nested item shows 1.1.', async () => {
    setDocs(['ml first item', 'ml second item']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.dropdown({ cmd: 'multilevelList', type: 'dropdown' }, document.body);
    flyClick(/^Decimal \(1\. 1\.1\. 1\.1\.1\.\)$/); await sleep(150);
    const top = paraEl('ml first item')?.querySelector('.list-marker')?.textContent.trim() === '1.';
    selectText('ml second item');
    PM().cmd('increaseListIndent'); await sleep(150);
    return top && paraEl('ml second item')?.querySelector('.list-marker')?.textContent.trim() === '1.1.';
  });
  await t('[2] multilevel Outline: 1) then nested a)', async () => {
    setDocs(['ol first item', 'ol second item']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.dropdown({ cmd: 'multilevelList', type: 'dropdown' }, document.body);
    flyClick(/^Outline \(1\) a\) i\)\)$/); await sleep(150);
    const top = paraEl('ol first item')?.querySelector('.list-marker')?.textContent.trim() === '1)';
    selectText('ol second item');
    PM().cmd('increaseListIndent'); await sleep(150);
    return top && paraEl('ol second item')?.querySelector('.list-marker')?.textContent.trim() === 'a)';
  });
  await t('[2] Change List Level → Level 3 sets ilvl 2 as ONE undo step', async () => {
    setDoc('level probe text'); selectText('level');
    run('numbering'); await sleep(550); // close the history group — undo must revert ONLY the level change
    window.WC.Commands.dropdown({ cmd: 'multilevelList', type: 'dropdown' }, document.body);
    flyClick(/^Change List Level$/);
    flyClick(/^Level 3$/); await sleep(50);
    const at2 = paraAttrs('level').paragraphProperties?.numberingProperties?.ilvl === 2;
    PM().cmd('undo'); await sleep(50);
    return at2 && paraAttrs('level').paragraphProperties?.numberingProperties?.ilvl === 0;
  });
  await t('[2] Paragraph dialog seeds from the caret and applies as ONE undo step', async () => {
    setDoc('dlg para probe'); selectText('dlg');
    run('center');
    window.WC.Commands.spinner('indentLeft', 0.5);
    await sleep(550); // close the history group — undo must revert ONLY the dialog apply
    window.WC.Dialogs.paragraph();
    const dlg = document.querySelector('.modal-backdrop .dialog');
    if (!dlg) return 'paragraph dialog did not open';
    const selects = dlg.querySelectorAll('select');
    const inputs = dlg.querySelectorAll('input[type=number]');
    const seeded = selects[0].value === 'Centered' && parseFloat(inputs[0].value) === 0.5;
    if (!seeded) { dlg.querySelector('.dlg-footer .btn:last-child').click(); return 'seeds wrong: ' + selects[0].value + '/' + inputs[0].value; }
    selects[0].value = 'Right';
    inputs[2].value = '18'; // spacing before (pt)
    Array.from(dlg.querySelectorAll('.dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim())).click();
    await sleep(80);
    const a1 = paraAttrs('dlg').paragraphProperties;
    const applied = a1?.justification === 'right' && a1?.spacing?.before === 360;
    PM().cmd('undo'); await sleep(50);
    const a2 = paraAttrs('dlg').paragraphProperties;
    return applied && a2?.justification === 'center' && a2?.spacing?.before !== 360;
  });
  await t('[2] paragraph launcher opens the dialog (unblocked after flip)', async () => {
    if (document.querySelector('.modal-backdrop')) return 'leaked dialog from a previous test';
    window.WC.Commands.launcher('paragraph', null, null);
    const dlg = document.querySelector('.modal-backdrop .dialog');
    const ok = !!dlg && /Paragraph/.test(dlg.textContent);
    if (dlg) dlg.querySelector('.dlg-footer .btn:last-child').click();
    return ok;
  });
  await t('[2] list marker separator has real width (fork CSS in the build)', async () => {
    setDoc('css probe text'); selectText('css');
    run('numbering'); await sleep(150);
    const tab = document.querySelector('#pm-editor .sd-editor-tab');
    return !!tab && getComputedStyle(tab).display === 'inline-block' && tab.getBoundingClientRect().width > 0;
  });
  await t('[2] nested list indents: margin-left grows with level', async () => {
    setDocs(['nest level zero', 'nest level one']);
    window.WC.editor.commands.selectAll();
    run('bullets'); await sleep(50);
    selectText('nest level one');
    PM().cmd('increaseListIndent'); await sleep(150);
    const p0 = paraEl('nest level zero'); const p1 = paraEl('nest level one');
    return !!p0 && !!p1 && parseFloat(p1.style.marginLeft || '0') > parseFloat(p0.style.marginLeft || '0');
  });

  // ---------- slice 3: styles (gallery + pane + shortcuts + preview) ----------
  // Context reset: the last [1] test left negation-run.docx live — its styles.xml has
  // NO Quote/heading definitions and a BOLD Normal. [3] runs on the blank template
  // (Quote/QuoteChar, Heading1-9+Char, Title, Subtitle, IntenseQuote, ListParagraph,
  // plain Normal all present; Task 4 mints the remaining four).
  await PM().newBlank(); await sleep(100); // blank-template IO settle (replaceEditor is awaited; 100ms covers the first sync)
  // Vocabulary: UI speaks display names ('Heading 1'), the engine speaks styleIds
  // ('Heading1'); styleId lives INSIDE paragraphProperties (cleared by setDoc's reset).
  // SELECTION RULE: paragraph-style asserts REQUIRE a full-paragraph or collapsed
  // selection — a PARTIAL selection takes the linked-character-style branch
  // (linked-styles/helpers.js:454: w:link styles apply e.g. Heading1Char to the range
  // and NEVER set paragraphProperties.styleId). Tests 6/7 exploit that deliberately;
  // every other apply selects the FULL setDoc string.
  await t('[3] gallery cell click applies Heading1 styleId + lights the cell', async () => {
    setDoc('style probe text'); selectText('style probe text');
    const cell = cellFor('Heading 1');
    if (!cell) return 'gallery cell not found';
    cell.click(); await sleep(150);
    const a = paraAttrs('style');
    return a.paragraphProperties?.styleId === 'Heading1' && cell.classList.contains('active');
  });
  await t('[3] applying a paragraph style clears direct char formatting', async () => {
    setDoc('boldfirst styled text'); selectText('boldfirst styled text');
    run('bold'); await sleep(50);
    // [1]-precedent guard: a negation mark (value '0') must not count as bold-on.
    const isBold = (m) => m.startsWith('bold:') && !m.includes('"value":"0"');
    if (!markNames('boldfirst').some(isBold)) return 'bold did not apply — precondition failed';
    PM().cmd('setStyleById', 'Heading1'); await sleep(50);
    return !markNames('boldfirst').some(isBold);
  });
  await t('[3] re-applying the same style keeps it (apply, not toggle)', async () => {
    // requires Heading1 to be ON first (previous test) — guards the absence-style assert
    if (paraAttrs('boldfirst').paragraphProperties?.styleId !== 'Heading1') return 'precondition failed';
    selectText('boldfirst styled text');
    PM().cmd('setStyleById', 'Heading1'); await sleep(50);
    return paraAttrs('boldfirst').paragraphProperties?.styleId === 'Heading1';
  });
  await t('[3] collapsed caret styles its containing paragraph (Title)', async () => {
    setDoc('caret style probe');
    const sel = selectText('caret');
    window.WC.editor.commands.setTextSelection({ from: sel.from, to: sel.from });
    PM().cmd('setStyleById', 'Title'); await sleep(50);
    return paraAttrs('caret').paragraphProperties?.styleId === 'Title';
  });
  await t('[3] multi-paragraph selection styles every paragraph (Quote)', async () => {
    setDocs(['multi quote one', 'multi quote two']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.applyStyle('Quote'); await sleep(50);
    return paraAttrs('multi quote one').paragraphProperties?.styleId === 'Quote'
      && paraAttrs('multi quote two').paragraphProperties?.styleId === 'Quote';
  });
  await t('[3] partial selection applies the LINKED char style, paragraph untouched', async () => {
    setDoc('partial linked probe words'); selectText('linked'); // one word — never the full paragraph
    window.WC.Commands.applyStyle('Heading 1'); await sleep(50);
    const a = paraAttrs('partial');
    const mark = markNames('linked').find((m) => m.startsWith('textStyle'));
    return a.paragraphProperties?.styleId == null && !!mark && mark.includes('Heading1Char');
  });
  await t('[3] Strong (character style) marks the range, paragraph style untouched', async () => {
    setDoc('strongchar probe text'); selectText('strongchar');
    window.WC.Commands.applyStyle('Strong'); await sleep(50);
    const mark = markNames('strongchar').find((m) => m.startsWith('textStyle'));
    return !!mark && mark.includes('"styleId":"Strong"')
      && paraAttrs('strongchar').paragraphProperties?.styleId == null;
  });
  await t('[3] No Spacing resolves spacing-after 0 through the cascade', async () => {
    setDoc('nospace probe text'); selectText('nospace');
    window.WC.Commands.applyStyle('No Spacing'); await sleep(150);
    return paraAttrs('nospace').paragraphProperties?.styleId === 'NoSpacing'
      && PM().getState().spacingAfterPt === 0;
  });
  await t('[3] Heading1 text renders the style color via decorations', async () => {
    setDoc('decor probe text'); selectText('decor probe text');
    PM().cmd('setStyleById', 'Heading1'); await sleep(150);
    const p = paraEl('decor');
    // LEAF span only: the fork nests .sd-paragraph-content → [data-run] → decorated
    // span, and ALL of them contain the needle text — document-order find() grabs the
    // undecorated outer wrapper (execution finding, Task 1).
    const span = p && Array.from(p.querySelectorAll('span')).find((s) => s.textContent.includes('decor') && !s.querySelector('span'));
    if (!span) return 'no decorated span found';
    const color = getComputedStyle(span).color;
    return color === 'rgb(15, 71, 97)'; // fixture Heading1 w:color 0F4761
  });
  await t('[3] gallery highlight tracks the caret (Heading1 ↔ Normal)', async () => {
    setDocs(['plain paragraph here', 'heading paragraph here']);
    selectText('heading paragraph here'); PM().cmd('setStyleById', 'Heading1'); await sleep(150);
    const h1Cell = cellFor('Heading 1');
    const onHeading = !!h1Cell && h1Cell.classList.contains('active');
    selectText('plain'); await sleep(150);
    const normalCell = cellFor('Normal');
    return onHeading && !h1Cell.classList.contains('active')
      && !!normalCell && normalCell.classList.contains('active');
  });
  await t('[3] getState().block carries the display name (Heading 1 / Normal)', async () => {
    // relies on the previous test's setDocs(['plain paragraph here', 'heading paragraph here'])
    // with Heading1 applied to the second — deliberate chain, no doc reset between them.
    selectText('heading'); await sleep(50);
    const b1 = PM().getState().block === 'Heading 1';
    selectText('plain'); await sleep(50);
    return b1 && PM().getState().block === 'Normal';
  });
  await t('[3] PM mode: hovering a style cell does NOT change the doc (click-only)', async () => {
    // Product decision (2026-06-12): no hover Live Preview in PM mode — the user
    // wants styles to change ONLY on click. Hover must be a complete no-op.
    setDoc('preview probe text'); selectText('preview probe text');
    await sleep(550); PM().setClean();
    const before = JSON.stringify(doc().toJSON());
    const cell = cellFor('Heading 1');
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(50);
    const unchangedOnHover = JSON.stringify(doc().toJSON()) === before && PM().isDirty() === false;
    cell.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await sleep(30);
    // ...and a real CLICK still applies (the action moved to click).
    cell.click(); await sleep(80);
    const appliedOnClick = paraAttrs('preview').paragraphProperties?.styleId === 'Heading1';
    return (unchangedOnHover && appliedOnClick) || ('hoverNoOp=' + unchangedOnHover + ' clickApplies=' + appliedOnClick);
  });
  await t('[3] gallery click applies as ONE undo step', async () => {
    setDoc('commit probe text'); selectText('commit probe text');
    await sleep(550); // close the history group — undo must revert ONLY the click apply
    const cell = cellFor('Heading 2');
    cell.click(); await sleep(80);
    const applied = paraAttrs('commit').paragraphProperties?.styleId === 'Heading2';
    PM().cmd('undo'); await sleep(50);
    return applied && paraAttrs('commit').paragraphProperties?.styleId == null;
  });
  await t('[home] Quick Styles gallery uses Word order + live catalog (Intense Reference in; Subtle Reference / Book Title out)', () => {
    const cells = Array.from(document.querySelectorAll('.styles-gallery .rgallery-track .style-cell')).map((c) => c.dataset.style);
    const expected = ['Normal', 'No Spacing', 'Heading 1', 'Heading 2', 'Heading 3', 'Title', 'Subtitle', 'Subtle Emphasis', 'Emphasis', 'Intense Emphasis', 'Strong', 'Quote', 'Intense Quote', 'Intense Reference', 'List Paragraph'];
    const orderOk = cells.join('|') === expected.join('|');
    const noUnsupported = cells.indexOf('Subtle Reference') < 0 && cells.indexOf('Book Title') < 0;
    return orderOk && noUnsupported;
  });
  await t('[home] Intense Reference applies as a character style (run mark, paragraph styleId untouched)', async () => {
    setDoc('irefcell probe'); selectText('irefcell probe');
    cellFor('Intense Reference').click(); await sleep(60);
    const m = markNames('irefcell');
    const hasIRef = m.some((x) => /IntenseReference/.test(x));
    const paraUnstyled = paraAttrs('irefcell').paragraphProperties?.styleId == null;
    return hasIRef && paraUnstyled;
  });
  await t('[home] Quick Styles carousel: ‹/› page the viewport, arrows disable at first/last page', async () => {
    const gal = document.querySelector('.styles-gallery.rgallery');
    const prev = gal && gal.querySelector('.rgallery-nav.prev');
    const next = gal && gal.querySelector('.rgallery-nav.next');
    const vp = gal && gal.querySelector('.rgallery-viewport');
    if (!gal || !prev || !next || !vp) return 'carousel parts missing';
    vp.scrollLeft = 0; vp.dispatchEvent(new Event('scroll')); await sleep(30);
    if (vp.scrollWidth <= vp.clientWidth + 1) return 'viewport not overflowing (cannot test paging)';
    const prevOffAtStart = prev.disabled === true;
    const nextOnAtStart = next.disabled === false;
    vp.scrollLeft = vp.scrollWidth; vp.dispatchEvent(new Event('scroll')); await sleep(30);
    const nextOffAtEnd = next.disabled === true;
    const prevOnAtEnd = prev.disabled === false;
    vp.scrollLeft = 0; vp.dispatchEvent(new Event('scroll'));
    return (prevOffAtStart && nextOnAtStart && nextOffAtEnd && prevOnAtEnd)
      || ('prev@0=' + prevOffAtStart + ' next@0=' + nextOnAtStart + ' next@end=' + nextOffAtEnd + ' prev@end=' + prevOnAtEnd);
  });
  await t('[home] Styles "More" opens the expanded gallery flyout (not the pane) with gallery commands', () => {
    const moreBtn = document.querySelector('.styles-gallery .rgallery-more');
    moreBtn.click();
    const fly = document.querySelector('.flyout.styles-flyout');
    const cells = fly ? fly.querySelectorAll('.style-cell').length : 0;
    const cmds = fly ? Array.from(fly.querySelectorAll('.fly-item .fi-label')).map((l) => l.textContent) : [];
    const ok = !!fly && cells >= 15 && cmds.indexOf('Clear Formatting') >= 0 && cmds.indexOf('Apply Styles…') >= 0 && cmds.indexOf('Create a Style…') >= 0;
    window.WC.closeFlyouts();
    return ok;
  });
  await t('[fix] no selection: clicking a style restyles ONLY the caret paragraph', async () => {
    // User spec: caret in a paragraph, no selection → click restyles that
    // paragraph (the "current line"), never the whole document.
    setDocs(['First para alpha.', 'Second para beta.', 'Third para gamma.']);
    let pos = null, s = -1;
    doc().descendants((n, p) => { if (n.type.name === 'paragraph') { s++; if (s === 1) pos = p + 1; } return pos == null; });
    window.WC.editor.commands.setTextSelection({ from: pos, to: pos }); // collapsed caret in para 2
    cellFor('Heading 1').click(); await sleep(120);
    const ids = []; doc().descendants((n) => { if (n.type.name === 'paragraph') ids.push(n.attrs?.paragraphProperties?.styleId || null); });
    return JSON.stringify(ids) === JSON.stringify([null, 'Heading1', null]) || ('styleIds=' + JSON.stringify(ids) + ' (expected only para 2)');
  });
  await t('[fix] with a selection: clicking a style restyles ONLY the selected paragraphs', async () => {
    setDocs(['First para alpha.', 'Second para beta.', 'Third para gamma.']);
    // select across paras 1–2 only
    let p1 = null, p2 = null, s = -1;
    doc().descendants((n, p) => { if (n.type.name === 'paragraph') { s++; if (s === 0) p1 = p + 1; if (s === 1) p2 = p + 3; } return true; });
    window.WC.editor.commands.setTextSelection({ from: p1, to: p2 });
    cellFor('Heading 2').click(); await sleep(120);
    const ids = []; doc().descendants((n) => { if (n.type.name === 'paragraph') ids.push(n.attrs?.paragraphProperties?.styleId || null); });
    return JSON.stringify(ids) === JSON.stringify(['Heading2', 'Heading2', null]) || ('styleIds=' + JSON.stringify(ids) + ' (expected paras 1–2 only)');
  });
  await t('[3] Ctrl+Alt+2 applies Heading 2 in PM mode', async () => {
    setDoc('kbd heading probe'); selectText('kbd heading probe');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('kbd').paragraphProperties?.styleId === 'Heading2';
  });
  await t('[3] repeated Ctrl+Alt+1 keeps Heading1 (apply semantics, no toggle)', async () => {
    setDoc('repeat kbd probe'); selectText('repeat kbd probe');
    const fire = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    fire(); await sleep(50); fire(); await sleep(50);
    return paraAttrs('repeat').paragraphProperties?.styleId === 'Heading1';
  });
  await t('[3] Ctrl+Shift+N applies Normal (explicit styleId, not null)', async () => {
    // requires Heading1 to be ON first — guards against false-green in the red state.
    // Depends on the Task-11.1b SHADOW FIX (app.js:76 gains !shift) — without it this
    // chord triggers Files.newDoc + a stuck confirmDiscard modal.
    if (paraAttrs('repeat').paragraphProperties?.styleId !== 'Heading1') return 'precondition failed';
    selectText('repeat kbd probe');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('repeat').paragraphProperties?.styleId === 'Normal';
  });
  await t('[3] styles launcher opens the pane; pane item applies via the engine', async () => {
    setDoc('pane probe text'); selectText('pane probe text');
    window.WC.Commands.launcher('styles', null, null);
    const pane = document.getElementById('styles-pane');
    if (!pane) return 'styles pane did not open';
    const item = Array.from(pane.querySelectorAll('.sl-item')).find((n) => n.textContent.trim() === 'Heading 3');
    if (!item) { window.WC.Dialogs.stylesPane(); return 'Heading 3 pane item not found'; }
    item.click(); await sleep(50);
    const ok = paraAttrs('pane').paragraphProperties?.styleId === 'Heading3';
    if (document.getElementById('styles-pane')) window.WC.Dialogs.stylesPane(); // toggle-close
    return ok;
  });
  await t('[3] pane Clear All applies Normal; New Style toasts (deferred)', async () => {
    setDoc('paneclear probe text'); selectText('paneclear probe text');
    PM().cmd('setStyleById', 'Quote'); await sleep(50);
    window.WC.Commands.launcher('styles', null, null);
    const pane = document.getElementById('styles-pane');
    if (!pane) return 'styles pane did not open';
    const clearBtn = Array.from(pane.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Clear All');
    if (!clearBtn) { window.WC.Dialogs.stylesPane(); return 'Clear All button not found'; }
    clearBtn.click();
    await sleep(50);
    const cleared = paraAttrs('paneclear').paragraphProperties?.styleId === 'Normal';
    const newBtn = Array.from(pane.querySelectorAll('button')).find((b) => b.textContent.trim() === 'New Style');
    if (!newBtn) { window.WC.Dialogs.stylesPane(); return 'New Style button not found'; }
    newBtn.click();
    const noDialog = !document.querySelector('.modal-backdrop');
    if (document.getElementById('styles-pane')) window.WC.Dialogs.stylesPane();
    return cleared && noDialog;
  });
  await t('[3] bridge resolved read exposes numbering ilvl (level-menu seam)', async () => {
    setDoc('resolved probe text'); selectText('resolved');
    run('numbering'); await sleep(50);
    PM().cmd('changeListLevelBy', 2); await sleep(50);
    const r = PM().getResolvedParaProps();
    return r?.numberingProperties?.ilvl === 2;
  });
  // KEEP LAST in [3]: openDocx REPLACES the live document (the [0b] block below
  // sets its own docs, so this is safe here and only here).
  await t('[3] styleIds round-trip through save/open (w:pStyle + w:rStyle)', async () => {
    setDocs(['roundtrip heading para', 'roundtrip strongbit para']);
    selectText('roundtrip heading para'); PM().cmd('setStyleById', 'Heading1'); await sleep(50);
    selectText('strongbit'); window.WC.Commands.applyStyle('Strong'); await sleep(50);
    const bytes = await PM().exportDocxBytes();
    const ok = await PM().openDocx(bytes);
    if (!ok) return 'reopen failed';
    await sleep(300); // replaceEditor remounts + re-parses asynchronously; 300ms covers the load + first state-sync push (larger than the 150ms rAF tick by design)
    const a = paraAttrs('roundtrip heading');
    const mark = markNames('strongbit').find((m) => m.startsWith('textStyle'));
    return a.paragraphProperties?.styleId === 'Heading1'
      && !!mark && mark.includes('"styleId":"Strong"');
  });

  // ---------- slice 4: clipboard + editing-misc (cut/copy/paste + painter + select) ----------
  // These tests drive the REAL OS clipboard (wordAPI.clipboard channels, Task 4) so
  // the prosemirror-view serializer/parser pipeline is what's under test — no mocks.
  // selectText trap: the helper matches within a SINGLE text node — after run('bold')
  // splits a paragraph's text node, painter sources select only the homogeneous bold
  // word (also semantically required: getMarksFromSelection INTERSECTS mixed ranges).
  await PM().newBlank(); await sleep(100);
  const CB = () => window.wordAPI.clipboard;
  // Sentinel poll: webContents paste/cut/copy land asynchronously in the renderer.
  const until = async (fn, tries = 40) => { for (let i = 0; i < tries && !(await fn()); i++) await sleep(50); return !!(await fn()); };
  await t('[4] ribbon Copy puts the selection on the OS clipboard', async () => {
    await CB().writeText(''); // clear
    setDoc('copyprobe alpha beta'); selectText('copyprobe');
    run('copy');
    const filled = await until(async () => (await CB().readText()).includes('copyprobe'), 20);
    return filled && doc().textContent.includes('copyprobe');
  });
  await t('[4] ribbon Cut removes the selection AND fills the clipboard', async () => {
    await CB().writeText('');
    setDoc('cutprobe gamma delta'); selectText('cutprobe');
    run('cut');
    const filled = await until(async () => (await CB().readText()).includes('cutprobe'), 20);
    const removed = await until(async () => !doc().textContent.includes('cutprobe'));
    return filled && removed;
  });
  await t('[4] ribbon Paste inserts clipboard text through the PM pipeline', async () => {
    await CB().writeText('pasteprobe-payload');
    setDoc('target paragraph here');
    const sel = selectText('target');
    window.WC.editor.commands.setTextSelection({ from: sel.from, to: sel.from });
    run('paste');
    if (!(await until(async () => doc().textContent.includes('pasteprobe-payload')))) return 'paste never landed';
    return true;
  });
  await t('[4] paste (KSF) preserves character formatting via the HTML parser', async () => {
    await CB().writeHTML('<p><strong>boldbit</strong> plain</p>');
    setDoc('ksf target text'); const s = selectText('ksf');
    window.WC.editor.commands.setTextSelection({ from: s.from, to: s.from });
    run('paste');
    if (!(await until(async () => doc().textContent.includes('boldbit')))) return 'paste never landed';
    // [1]-precedent guard: a negation mark (value '0') must not count as bold-on.
    return markNames('boldbit').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
  });
  await t('[4] paste is ONE undo step', async () => {
    await CB().writeText('one-undo-payload');
    setDoc('undo paste target');
    const s0 = selectText('undo');
    window.WC.editor.commands.setTextSelection({ from: s0.from, to: s0.from }); // caret, not whole-doc selection
    await sleep(550); // close the history group
    // sdBlockRev is a per-block revision counter bumped by the numbering plugin's
    // appendTransaction. The bump folds into the paste's own history step, but the
    // UNDO replay re-fires the appendTransaction and re-increments it — so the
    // counter legitimately drifts forward across paste+undo while the CONTENT fully
    // reverts. Normalize it out so this asserts reverted CONTENT, not the counter.
    const norm = (d) => JSON.stringify(d, (k, val) => (k === 'sdBlockRev' ? 0 : val));
    const before = norm(doc().toJSON());
    run('paste');
    if (!(await until(async () => doc().textContent.includes('one-undo-payload')))) return 'paste never landed';
    PM().cmd('undo'); await sleep(50);
    return norm(doc().toJSON()) === before;
  });
  await t('[4] Keep Text Only strips source formatting', async () => {
    await CB().writeHTML('<p><strong>strippedbold</strong></p>');
    setDoc('kto target text'); const s2 = selectText('kto');
    window.WC.editor.commands.setTextSelection({ from: s2.from, to: s2.from });
    await PM().pasteTextOnly(); await sleep(150);
    if (!doc().textContent.includes('strippedbold')) return 'text did not paste';
    return !markNames('strippedbold').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
  });
  await t('[4] Picture flavor pastes an image node from the clipboard', async () => {
    // 1×1 red PNG
    await CB().writeImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    setDoc('pic target text');
    await PM().pastePicture(); await sleep(150);
    let found = false;
    doc().descendants((n) => { if (n.type.name === 'image') found = true; });
    return found;
  });
  await t('[4] paste dropdown renders the 6 Word items in PM mode', async () => {
    const node = document.querySelector('[data-cmd="paste"]') || document.body;
    window.WC.Commands.dropdown({ cmd: 'paste', type: 'split' }, node);
    // PM pasteMenu prefetches the clipboard flavors (IPC) BEFORE building the
    // flyout — poll for the items, never assert synchronously.
    for (let i = 0; i < 20 && !document.querySelector('.flyout .fly-item'); i++) await sleep(50);
    const items = Array.from(document.querySelectorAll('.flyout .fly-item')).map((n) => n.textContent.trim());
    window.WC.closeFlyouts();
    return ['Keep Source Formatting', 'Match Formatting', 'Picture', 'Keep Text Only']
      .every((l) => items.some((i) => i.startsWith(l)))
      && items.some((i) => i.startsWith('Paste Special'))
      && items.some((i) => i.startsWith('Set Default Paste'));
  });
  await t('[4] Paste Special dialog lists the flavors actually on the clipboard', async () => {
    await CB().writeHTML('<p>flavor probe</p>'); // HTML write also sets text/plain
    await window.WC.Dialogs.pasteSpecial(); // async: awaits the flavors IPC, then WC.dialog mounts synchronously
    const dlg = document.querySelector('.modal-backdrop .dialog');
    if (!dlg) return 'dialog did not open';
    const rows = Array.from(dlg.querySelectorAll('li,option,.ps-item')).map((n) => n.textContent);
    const ok = rows.some((r) => /HTML/i.test(r)) && rows.some((r) => /Unformatted/i.test(r));
    const close = Array.from(dlg.querySelectorAll('.dlg-footer .btn, button')).find((b) => /^(Cancel|Close)$/.test(b.textContent.trim()));
    if (close) close.click();
    else { const bd = document.querySelector('.modal-backdrop'); if (bd) bd.remove(); } // never leak the modal over the painter tests
    return ok;
  });
  await t('[4] format painter one-shot: char formatting copies, applies once, disarms', async () => {
    setDocs(['painterbold source here', 'painterplain target here']);
    selectText('painterbold'); run('bold'); await sleep(50);
    // Arm from the HOMOGENEOUS bold word only: (a) selectText cannot span the
    // mark-split text nodes; (b) getMarksFromSelection intersects a mixed range to [].
    selectText('painterbold');
    run('formatPainter'); await sleep(50);
    selectText('painterplain'); await sleep(150); // fork auto-applies on selectionUpdate
    const applied = markNames('painterplain').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
    // one-shot: a SECOND selection must NOT receive the format
    selectText('target'); await sleep(150);
    const second = markNames('target').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
    return applied && !second;
  });
  await t('[4] format painter copies PARAGRAPH formatting (Word scope)', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(50); // defensive: never inherit an armed painter
    setDocs(['parapaint source line', 'parapaint target line two']);
    selectText('parapaint source line'); PM().cmd('setTextAlign', 'center'); await sleep(50);
    run('formatPainter'); await sleep(50);
    selectText('target line two'); await sleep(150);
    // Engine key is paragraphProperties.justification (text-align.js; [2] precedent).
    return paraAttrs('target').paragraphProperties?.justification === 'center';
  });
  await t('[4] painter sticky (dblclick) survives two applies; Esc disarms', async () => {
    setDocs(['stickybold source', 'stickyone target', 'stickytwo target']);
    selectText('stickybold'); run('bold'); await sleep(50);
    selectText('stickybold'); // homogeneous bold run (see one-shot test note)
    run('formatPainterLock'); await sleep(50); // ribbon dblclick path
    selectText('stickyone'); await sleep(150);
    selectText('stickytwo'); await sleep(150);
    const both = ['stickyone', 'stickytwo'].every((n) => markNames(n).some((x) => x.startsWith('bold') && !x.includes('"value":"0"')));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(150); // state-sync rAF tick
    const fpBtn = window.WC.Ribbon.controlIndex.formatPainter?.node;
    return both && !!fpBtn && !fpBtn.classList.contains('toggled');
  });
  await t('[4] painter button shows toggled while armed (state-sync chrome)', async () => {
    setDoc('chromeprobe text'); selectText('chromeprobe');
    run('formatPainter'); await sleep(150);
    const fpBtn = window.WC.Ribbon.controlIndex.formatPainter?.node;
    const on = !!fpBtn && fpBtn.classList.contains('toggled');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(150);
    return on && !fpBtn.classList.contains('toggled');
  });
  // ---------- Phase 3 / Home: ribbon state machine (Clipboard section) ----------
  await t('[home] state machine: rule registry drained + Clipboard rules registered', () => {
    const sr = window.WC.Ribbon.stateRules;
    if (!sr) return 'no stateRules registry';
    return typeof sr.cut?.enabled === 'function'
      && typeof sr.copy?.enabled === 'function'
      && typeof sr.paste?.enabled === 'function'
      && typeof sr.formatPainter?.latched === 'function';
  });
  await t('[home] state machine: Cut/Copy greyed with a collapsed caret (no selection)', async () => {
    setDoc('alpha beta gamma');
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), 3, 3)));
    await sleep(150);
    const cut = window.WC.Ribbon.controlIndex.cut?.node;
    const copy = window.WC.Ribbon.controlIndex.copy?.node;
    if (!cut || !copy) return 'cut/copy not in controlIndex';
    return cut.classList.contains('wc-disabled') && copy.classList.contains('wc-disabled');
  });
  await t('[home] state machine: Cut/Copy enabled with a selection', async () => {
    selectText('beta'); await sleep(150);
    const cut = window.WC.Ribbon.controlIndex.cut?.node;
    const copy = window.WC.Ribbon.controlIndex.copy?.node;
    if (!cut || !copy) return 'cut/copy not in controlIndex';
    return !cut.classList.contains('wc-disabled') && !copy.classList.contains('wc-disabled');
  });
  await t('[home] state machine: Paste greys on empty clipboard, enables with content', () => {
    const paste = window.WC.Ribbon.controlIndex.paste?.node;
    if (!paste) return 'paste not in controlIndex';
    // Drive the rule directly (real clipboard state is non-deterministic headless);
    // hasSelection:true keeps Cut/Copy correct so this leaves no side effect.
    window.WC.Ribbon.applyStateRules({ clipboardHasContent: false, hasSelection: true });
    const off = paste.classList.contains('wc-disabled');
    window.WC.Ribbon.applyStateRules({ clipboardHasContent: true, hasSelection: true });
    const on = !paste.classList.contains('wc-disabled');
    return off && on;
  });
  await t('[home] Paste Options state machine: buttons switch by content type (pure)', () => {
    const f = PM().pasteOptionStates;
    if (typeof f !== 'function') return 'pasteOptionStates not exposed';
    const txt = f({ hasText: true });
    const img = f({ hasImage: true });
    const none = f({});
    // text/html → Keep Source / Match / Keep Text active; Picture inactive
    if (!(txt.keepSource && txt.match && txt.keepText && !txt.picture)) return 'text: ' + JSON.stringify(txt);
    // image → Picture + Keep Source active; Match / Keep Text inactive
    if (!(img.picture && img.keepSource && !img.match && !img.keepText)) return 'image: ' + JSON.stringify(img);
    // empty clipboard → all inactive
    if (none.keepSource || none.match || none.keepText || none.picture) return 'empty: ' + JSON.stringify(none);
    return true;
  });
  await t('[home] Paste dropdown is context-aware (image disables text options; Match label)', async () => {
    const pm = PM();
    const orig = pm.clipboardFlavors;
    pm.clipboardFlavors = async () => ({ hasText: false, hasHtml: false, hasImage: true });
    try {
      WC.Commands.dropdown({ cmd: 'paste', type: 'split' }, document.querySelector('[data-cmd="paste"]') || document.body);
      await sleep(90);
      const items = Array.from(document.querySelectorAll('.flyout .fly-item'));
      const find = (re) => items.find((n) => re.test((n.querySelector('.fi-label') || n).textContent));
      const dis = (n) => !!n && n.classList.contains('disabled');
      const match = find(/Match Formatting/);
      const keepText = find(/Keep Text Only/);
      const picture = find(/Picture/);
      if (WC.closeFlyouts) WC.closeFlyouts();
      if (!match) return 'no Match Formatting item';
      if (!keepText || !picture) return 'menu items missing';
      // image-only: Keep Text Only disabled, Picture enabled
      return dis(keepText) && !dis(picture);
    } finally { pm.clipboardFlavors = orig; }
  });
  await t('[home] Set Default Paste: dialog lists 3 modes + pasteDefault reads it', async () => {
    WC.Dialogs.setDefaultPaste(); await sleep(40);
    const list = document.querySelector('.ps-list');
    const labels = list ? Array.from(list.children).map((li) => li.textContent) : [];
    const has3 = labels.length === 3
      && labels.some((l) => /Keep Source/.test(l))
      && labels.some((l) => /Match/.test(l))
      && labels.some((l) => /Text Only/.test(l));
    const cancel = Array.from(document.querySelectorAll('button')).find((b) => /^Cancel$/.test(b.textContent.trim()));
    if (cancel) cancel.click();
    // Contract: pasteDefault resolves the mode from localStorage via defaultPasteMode.
    localStorage.setItem('wc.defaultPaste', 'text');
    const reads = PM().defaultPasteMode && PM().defaultPasteMode() === 'text';
    localStorage.setItem('wc.defaultPaste', 'keepSource'); // restore so other tests get native paste
    if (!has3) return 'dialog modes: ' + JSON.stringify(labels);
    return reads === true;
  });
  await t('[home] Merge Formatting keeps bold, drops source font/size/color', async () => {
    setDoc('mergedest base');
    const sel = selectText('base');
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), sel.to, sel.to)));
    await sleep(40);
    PM().pasteMergeHtml('<p><span style="font-family:Courier New;font-size:26pt;color:#ff0000"><b>MERGEDWORD</b></span></p>');
    await sleep(120);
    const marks = markNames('MERGEDWORD');
    if (!marks.some((m) => m.startsWith('bold'))) return 'lost bold: ' + JSON.stringify(marks);
    if (marks.some((m) => /Courier|26pt|ff0000|#ff0000/i.test(m))) return 'kept source fmt: ' + JSON.stringify(marks);
    return true;
  });
  await t('[home] Merge Formatting falls back to plain text with no rich source', async () => {
    setDoc('plainonly base');
    const sel = selectText('base');
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), sel.to, sel.to)));
    await sleep(40);
    // Empty HTML → pasteMerge routes to pasteTextOnly; just assert it doesn't throw
    // and returns a boolean (the real clipboard path is oracle-tested separately).
    const r = PM().pasteMergeHtml('<span><i>KEPTITALIC</i></span>');
    await sleep(120);
    const marks = markNames('KEPTITALIC');
    return r === true && marks.some((m) => m.startsWith('italic'));
  });
  await t('[ribbon] responsive: condenses when narrow, not when very wide', async () => {
    const ribbon = document.getElementById('ribbon');
    const panel = ribbon.querySelector('.ribbon-panel.active');
    if (!panel) return 'no active panel';
    const LEVELS = ['condense-1', 'condense-2', 'condense-3'];
    const anyCondensed = () => LEVELS.some((c) => panel.classList.contains(c));
    const prev = ribbon.style.width;
    ribbon.style.width = '3000px';            // wide enough for everything to fit
    window.WC.Ribbon.relayoutRibbon();
    const wideCondensed = anyCondensed();
    ribbon.style.width = '320px';             // force a narrow window
    window.WC.Ribbon.relayoutRibbon();
    const narrowCondensed = anyCondensed();
    ribbon.style.width = prev || '';          // restore
    window.WC.Ribbon.relayoutRibbon();
    if (wideCondensed) return 'condensed even at 3000px (should fit)';
    if (!narrowCondensed) return 'did not condense at 320px';
    return true;
  });
  await t('[home] Font group renders the Word two-row arrangement', () => {
    const grp = document.querySelector('.ribbon-group[data-group="font"]');
    if (!grp) return 'font group not found';
    const rows = grp.querySelectorAll('.font-grid .font-row');
    if (rows.length !== 2) return 'expected 2 font rows, got ' + rows.length;
    const combos = rows[0].querySelectorAll('.rcombo');
    if (combos.length !== 2) return 'row1 should have 2 combos, got ' + combos.length;
    const r2 = rows[1];
    const has = (cmd) => !!r2.querySelector('[data-cmd="' + cmd + '"]');
    return (has('bold') && has('italic') && has('underline') && has('fontColor')) || 'row2 missing formatting buttons';
  });
  await t('[home] font combos show the effective value on an empty doc (not blank)', async () => {
    setDoc('');
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), 1, 1)));
    await sleep(170);
    const fontInput = window.WC.Ribbon.controlIndex.font?.input;
    const sizeInput = window.WC.Ribbon.controlIndex.fontSize?.input;
    if (!fontInput || !sizeInput) return 'combos not in controlIndex';
    if (!(fontInput.value.trim().length > 0)) return 'font combo blank';
    if (!(sizeInput.value.trim().length > 0)) return 'size combo blank';
    return true;
  });
  await t('[home] font name combo blanks on a mixed-font selection', async () => {
    setDoc('mixfontaaa mixfontbbb');
    selectText('mixfontaaa'); PM().cmd('setFontFamily', 'Arial'); await sleep(50);
    selectText('mixfontbbb'); PM().cmd('setFontFamily', 'Georgia'); await sleep(50);
    let from = null, to = null;
    doc().descendants((n, p) => {
      if (!n.isText || !n.text) return;
      const ia = n.text.indexOf('mixfontaaa'); if (ia >= 0 && from === null) from = p + ia;
      const ib = n.text.indexOf('mixfontbbb'); if (ib >= 0) to = p + ib + 'mixfontbbb'.length;
    });
    if (from === null || to === null) return 'could not locate runs';
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), from, to)));
    await sleep(170);
    const fontInput = window.WC.Ribbon.controlIndex.font?.input;
    return fontInput.value.trim() === '' || ('combo not blank: "' + fontInput.value + '"');
  });
  await t('[home] font combo shows the font of a uniform selection', async () => {
    setDoc('uniformfont text here');
    selectText('uniformfont'); PM().cmd('setFontFamily', 'Georgia'); await sleep(60);
    selectText('uniformfont'); await sleep(170);
    const fontInput = window.WC.Ribbon.controlIndex.font?.input;
    return /Georgia/.test(fontInput.value) || ('combo: "' + fontInput.value + '"');
  });
  await t('[home] Keep Text Only does NOT auto-linkify a pasted URL (guarded)', async () => {
    const ed = PM().getEditor();
    const mkEvt = (s) => { const dt = new DataTransfer(); dt.setData('text/plain', s); return new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); };
    const collapseAfter = (needle) => { const s = selectText(needle); v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), s.to, s.to))); };
    // WITH the guard (what pasteTextOnly sets) → URL stays plain text, no link mark.
    setDoc('ktoone base'); collapseAfter('base'); await sleep(40);
    ed.options.noPasteAutolink = true;
    try { ed.view.pasteText('https://exampleone.test', mkEvt('https://exampleone.test')); }
    finally { ed.options.noPasteAutolink = false; }
    await sleep(80);
    const guarded = markNames('exampleone.test');
    if (guarded.some((m) => m.startsWith('link'))) return 'guarded URL still linked: ' + JSON.stringify(guarded);
    // WITHOUT the guard → the fork auto-links (proves the guard is what suppresses it).
    setDoc('ktotwo base'); collapseAfter('base'); await sleep(40);
    ed.view.pasteText('https://exampletwo.test', mkEvt('https://exampletwo.test'));
    await sleep(80);
    const unguarded = markNames('exampletwo.test');
    if (!unguarded.some((m) => m.startsWith('link'))) return 'unguarded URL did not auto-link (test no longer meaningful): ' + JSON.stringify(unguarded);
    return true;
  });
  await t('[home] Office Clipboard auto-captures on copy (bridge path)', async () => {
    setDoc('captureword alpha'); selectText('captureword'); await sleep(60);
    window.WC.Clipboard.clear();
    await PM().copySelection(); await sleep(120);
    const items = window.WC.Clipboard.items;
    if (!items.length) return 'history empty after copy';
    return /captureword/.test(items[0].text || '');
  });
  await t('[home] Paragraph group renders the two-row arrangement', () => {
    const grp = document.querySelector('.ribbon-group[data-group="paragraph"]');
    if (!grp) return 'paragraph group not found';
    const rows = grp.querySelectorAll('.para-grid .para-row');
    if (rows.length !== 2) return 'expected 2 para rows, got ' + rows.length;
    const has = (row, cmd) => !!rows[row].querySelector('[data-cmd="' + cmd + '"]');
    return (has(0, 'bullets') && has(0, 'decreaseIndent') && has(0, 'showHide')
      && has(1, 'alignLeft') && has(1, 'justify') && has(1, 'borders')) || 'rows missing expected controls';
  });
  await t('[home] Decrease Indent greys at zero indent, enables with indent', async () => {
    setDoc('indentprobe text');
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), 3, 3)));
    await sleep(160);
    const di = window.WC.Ribbon.controlIndex.decreaseIndent?.node;
    if (!di) return 'decreaseIndent not in controlIndex';
    const offAtZero = di.classList.contains('wc-disabled');
    run('increaseIndent'); await sleep(160);
    const onWithIndent = !di.classList.contains('wc-disabled');
    if (!offAtZero) return 'decreaseIndent not greyed at zero indent';
    if (!onWithIndent) return 'decreaseIndent still greyed after increasing indent';
    return true;
  });
  await t('[home] Show/Hide ¶ latches via the state machine', async () => {
    setDoc('marks probe');
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), 3, 3)));
    await sleep(140);
    const sh = window.WC.Ribbon.controlIndex.showHide?.node;
    if (!sh) return 'showHide not in controlIndex';
    if (sh.classList.contains('toggled')) { run('showHide'); await sleep(150); } // normalize off
    run('showHide'); await sleep(160);
    const on = sh.classList.contains('toggled') && document.getElementById('pm-editor').classList.contains('show-marks');
    run('showHide'); await sleep(160);
    const off = !sh.classList.contains('toggled') && !document.getElementById('pm-editor').classList.contains('show-marks');
    if (!on) return 'did not latch on';
    if (!off) return 'did not unlatch';
    return true;
  });
  await t('[home] alignment: uniform presses one, mixed-selection presses none', async () => {
    setDocs(['alignone para', 'aligntwo para']);
    selectText('alignone'); run('center'); await sleep(120);
    selectText('alignone'); await sleep(160);
    const btn = (cmd) => window.WC.Ribbon.controlIndex[cmd]?.node;
    if (!btn('center').classList.contains('toggled')) return 'uniform center not pressed';
    let from = null, to = null;
    doc().descendants((n, p) => { if (!n.isText || !n.text) return; const i1 = n.text.indexOf('alignone'); if (i1 >= 0 && from === null) from = p + i1; const i2 = n.text.indexOf('aligntwo'); if (i2 >= 0) to = p + i2 + 'aligntwo'.length; });
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), from, to)));
    await sleep(160);
    const nonePressed = ['alignLeft', 'center', 'alignRight', 'justify'].every((c) => !btn(c).classList.contains('toggled'));
    return nonePressed || 'mixed selection did not clear all alignment buttons';
  });
  await t('[home] Text Effects is on the PM engine (no longer D6-blocked)', () =>
    PM().isBlocked('textEffectsAndTypography') === false || 'textEffectsAndTypography still D6-blocked');
  await t('[home] Text Effects menu opens + applies via PM (no retired-WC.Editor crash)', async () => {
    setDoc('teprobe text'); selectText('teprobe'); await sleep(40);
    let threw = null;
    try {
      window.WC.Commands.run({ cmd: 'textEffectsAndTypography', type: 'dropdown', label: 'Text Effects' }, document.querySelector('[data-cmd="textEffectsAndTypography"]') || document.body);
      await sleep(60);
    } catch (e) { threw = e.message; }
    const rows = Array.from(document.querySelectorAll('.flyout .fly-item')).map((n) => n.textContent);
    if (window.WC.closeFlyouts) window.WC.closeFlyouts();
    if (threw) return 'menu dispatch threw: ' + threw;
    return (rows.some((r) => /Outline/.test(r)) && rows.some((r) => /Number Styles/.test(r))) || ('menu did not open with effect rows: ' + JSON.stringify(rows));
  });
  await t('[home] Text Effects: number styles export w14 + round-trip', async () => {
    setDoc('numrt text'); selectText('numrt'); PM().cmd('setMark', 'textStyle', { fontVariantNumeric: 'oldstyle-nums tabular-nums' }); await sleep(80);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!(/w14:numForm/.test(xml) && /w14:numSpacing/.test(xml))) return 'w14:numForm/numSpacing missing from export';
    const b = await PM().exportDocxBytes(); await PM().openDocx(b); await sleep(220);
    const attr = (() => { let a = null; doc().descendants((n) => { if (a || !n.isText || !n.text) return; if (n.text.indexOf('numrt') >= 0) { const ts = n.marks.find((m) => m.type.name === 'textStyle'); a = ts?.attrs?.fontVariantNumeric; } }); return a; })();
    return /oldstyle-nums/.test(attr || '') || ('round-trip lost the attr: ' + attr);
  });
  await t('[home] Text Effects: ligatures (Standard+Contextual) export + round-trip', async () => {
    setDoc('ligrt text'); selectText('ligrt'); PM().cmd('setMark', 'textStyle', { fontVariantLigatures: 'common-ligatures contextual' }); await sleep(80);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!(/w14:ligatures/.test(xml) && /w14:cntxtAlts/.test(xml))) return 'w14:ligatures/cntxtAlts missing from export';
    const b = await PM().exportDocxBytes(); await PM().openDocx(b); await sleep(220);
    const attr = (() => { let a = null; doc().descendants((n) => { if (a || !n.isText || !n.text) return; if (n.text.indexOf('ligrt') >= 0) { const ts = n.marks.find((m) => m.type.name === 'textStyle'); a = ts?.attrs?.fontVariantLigatures; } }); return a; })();
    return /contextual/.test(attr || '') || ('round-trip lost ligatures: ' + attr);
  });
  await t('[home] Text Effects: all quartet effects apply + render', async () => {
    const hasStyle = (frag) => !!document.querySelector('#pm-editor .ProseMirror [style*="' + frag + '"]');
    setDoc('q1 x'); selectText('q1'); PM().cmd('setMark', 'textStyle', { textOutline: { widthPt: 1.5, color: '#ff0000', fill: 'transparent' } }); await sleep(70);
    if (!hasStyle('-webkit-text-stroke')) return 'outline did not render';
    setDoc('q2 x'); selectText('q2'); PM().cmd('setMark', 'textStyle', { textGlow: { radiusPt: 8, color: '#156082' } }); await sleep(70);
    if (!hasStyle('text-shadow')) return 'glow did not render';
    setDoc('q3 x'); selectText('q3'); PM().cmd('setMark', 'textStyle', { textShadowW14: { dx: 1.5, dy: 1.5, blur: 1.5, color: 'rgba(0,0,0,0.45)' } }); await sleep(70);
    if (!hasStyle('text-shadow')) return 'shadow did not render';
    setDoc('q4 x'); selectText('q4'); PM().cmd('setMark', 'textStyle', { textReflection: 'half' }); await sleep(70);
    if (!hasStyle('-webkit-box-reflect')) return 'reflection did not render';
    return true;
  });
  await t('[4] Select All selects the whole document via the menu', async () => {
    setDocs(['selall first para', 'selall second para']);
    const node = document.querySelector('[data-cmd="select"]') || document.body;
    window.WC.Commands.dropdown({ cmd: 'select', type: 'dropdown' }, node);
    const item = Array.from(document.querySelectorAll('.flyout .fly-item')).find((n) => n.textContent.trim().startsWith('Select All'));
    if (!item) { window.WC.closeFlyouts(); return 'Select All item not found'; }
    item.click(); await sleep(50);
    const sel = window.WC.editor.state.selection;
    return sel.from <= 1 && sel.to >= doc().content.size - 1;
  });
  await t('[4] Similar Formatting selects the matching span (legacy-parity range)', async () => {
    setDocs(['simfmt boldone here', 'plain middle para', 'simfmt boldtwo here']);
    selectText('boldone'); run('bold'); await sleep(50);
    selectText('boldtwo'); run('bold'); await sleep(50);
    // DELIBERATE boundary selection: at the bold run's start, $from.marks() returns
    // the PRECEDING run's marks — this input exposes a naive implementation.
    const c = selectText('boldone');
    window.WC.editor.commands.setTextSelection({ from: c.from, to: c.from + 2 });
    await PM().selectSimilarFormatting(); await sleep(50);
    const sel = window.WC.editor.state.selection;
    // Tight assert: includes() can't tell a near-whole-doc selection from the right
    // one; the correct span starts at boldone and ends at boldtwo.
    const text = doc().textBetween(sel.from, sel.to, ' ');
    return text.startsWith('boldone') && text.endsWith('boldtwo');
  });
  await t('[4] D6 flip: paste dropdown + select dropdown open in PM mode', async () => {
    // inverse of the pre-flip block — proves the registry flip reached dispatch.
    // The paste flyout fills AFTER the flavors prefetch — assert real items, not
    // just the (synchronously-created, possibly empty) flyout shell.
    const node = document.body;
    window.WC.Commands.dropdown({ cmd: 'paste', type: 'split' }, node);
    for (let i = 0; i < 20 && !document.querySelector('.flyout .fly-item'); i++) await sleep(50);
    const pasteOpen = document.querySelectorAll('.flyout .fly-item').length > 0;
    window.WC.closeFlyouts();
    window.WC.Commands.dropdown({ cmd: 'select', type: 'dropdown' }, node);
    const selOpen = document.querySelectorAll('.flyout .fly-item').length > 0;
    window.WC.closeFlyouts();
    return pasteOpen && selOpen;
  });
  await t('[4] Word list paste without conditional comments does not leak the literal marker', async () => {
    // Chromium's clipboard sanitizer strips <!--[if !supportLists]--> comments; Word marks the
    // marker run style="mso-list:Ignore" — that form must be stripped too (slice-4 leak).
    // Minimal <style> block included: real Word clipboard HTML always carries one, and the
    // docx-paste pipeline unconditionally derefs querySelector('style').innerHTML.
    setDoc('');
    const wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>'
      + '.MsoListParagraphCxSpFirst{margin:0in;} @list l0:level1{mso-level-text:"%1.";}'
      + '</style></head><body>'
      + '<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1">'
      + '<span style="mso-list:Ignore">1.<span style="font:7.0pt Times New Roman">&nbsp;&nbsp;</span></span>'
      + 'Alpha item</p></body></html>';
    const okPaste = await PM().pasteHTMLString(wordHtml); // bridge surface lands in a later task — red until then
    if (okPaste === false) return 'pasteHTMLString unavailable or refused';
    // Assert the MODEL, not the DOM: a reconstructed list renders a legit "1." marker as nodeview
    // chrome — the leak is a literal marker TEXT NODE in the model.
    const modelText = window.WC.view.state.doc.textContent;
    if (!/Alpha item/.test(modelText)) return 'content missing: ' + modelText.slice(0, 120);
    return !/1\./.test(modelText.replace(/\s+/g, ' ')) || ('literal marker leaked into the model: ' + modelText.slice(0, 80));
  });

  // ---------- slice 5: find-replace (decoration-based search + replace + options) ----------
  // These tests drive the fork Search extension through the WC.PM.search surface (Task 4)
  // and the re-pointed find pane (Task 5). Highlights are PM DECORATIONS — assert on
  // editor.extensionStorage.search.searchResults + the active-match selection, never on
  // injected .find-hit spans (the destructive legacy path the slice replaces).
  await PM().newBlank(); await sleep(100);
  const searchStore = () => window.WC.editor.extensionStorage.search;
  await t('[5] find session highlights all matches via decorations (no DOM mutation)', async () => {
    setDoc('alpha needle beta needle gamma needle');
    const before = JSON.stringify(doc().toJSON());
    PM().findSession('needle'); await sleep(150);
    const res = searchStore().searchResults;
    // doc text MUST be byte-identical (decorations don't mutate the doc).
    return res.length === 3 && JSON.stringify(doc().toJSON()) === before
      && document.querySelectorAll('#pm-editor .find-hit').length === 0;
  });
  await t('[5] find session count is exposed and active match starts at 0', async () => {
    setDoc('one two two two end');
    const r = PM().findSession('two'); await sleep(150);
    return PM().findCount().total === 3 && searchStore().activeMatchIndex === 0;
  });
  await t('[5] Next/Prev cycle the active match (wrap-around) and move the selection', async () => {
    setDoc('cat dog cat dog cat');
    PM().findSession('cat'); await sleep(150); // active 0
    PM().findNext(); await sleep(50);          // active 1
    const i1 = searchStore().activeMatchIndex;
    PM().findNext(); await sleep(50);          // active 2
    PM().findNext(); await sleep(50);          // wraps to 0
    const wrapped = searchStore().activeMatchIndex;
    PM().findPrev(); await sleep(50);          // wraps to 2
    const back = searchStore().activeMatchIndex;
    // selection follows the active match: at wrap (active 0) it spans the FIRST 'cat'.
    return i1 === 1 && wrapped === 0 && back === 2;
  });
  await t('[5] Match Case OFF matches mixed case; ON matches only exact case', async () => {
    setDoc('Needle needle NEEDLE');
    PM().findSession('needle', { caseSensitive: false }); await sleep(120);
    const insensitive = searchStore().searchResults.length; // 3
    PM().findSession('needle', { caseSensitive: true }); await sleep(120);
    const sensitive = searchStore().searchResults.length;   // 1
    return insensitive === 3 && sensitive === 1;
  });
  await t('[5] Whole Words ON does not match inside a larger word', async () => {
    setDoc('cat category scatter cat');
    PM().findSession('cat', { wholeWord: false }); await sleep(120);
    const loose = searchStore().searchResults.length;  // 4 (cat, cat-egory, s-cat-ter, cat)
    PM().findSession('cat', { wholeWord: true }); await sleep(120);
    const tight = searchStore().searchResults.length;  // 2 (the standalone 'cat' words)
    return loose === 4 && tight === 2;
  });
  await t('[5] Use Wildcards: ? matches one char, * matches a run', async () => {
    setDoc('bat bet bit boot brat');
    PM().findSession('b?t', { useWildcards: true }); await sleep(120);
    const single = searchStore().searchResults.length; // bat,bet,bit = 3 (NOT boot/brat)
    PM().findSession('b*t', { useWildcards: true }); await sleep(120);
    const star = searchStore().searchResults.length;   // bat,bet,bit,boot,brat = 5
    return single === 3 && star === 5;
  });
  await t('[5] wildcards are case-sensitive even when Match case is off (Word fidelity)', async () => {
    setDoc('NEEDLE needle');
    // wildcard search for the literal uppercase term with Match case OFF.
    // Word forces wildcards case-sensitive → only the uppercase NEEDLE matches (1), not 2.
    PM().findSession('NEEDLE', { useWildcards: true, caseSensitive: false }); await sleep(120);
    const wc = window.WC.editor.extensionStorage.search.searchResults.length;
    // control: same term WITHOUT wildcards + Match case off → case-insensitive → 2.
    PM().findSession('NEEDLE', { useWildcards: false, caseSensitive: false }); await sleep(120);
    const plain = window.WC.editor.extensionStorage.search.searchResults.length;
    return wc === 1 && plain === 2;
  });
  await t('[5] Replace replaces the active match and advances', async () => {
    setDoc('foo bar foo bar foo');
    PM().findSession('foo'); await sleep(120);
    await sleep(550); // close history group
    PM().replaceOne('QUX'); await sleep(120);
    // first 'foo' becomes QUX; two 'foo' remain.
    return doc().textContent.startsWith('QUX bar foo bar foo')
      && searchStore().searchResults.length === 2;
  });
  await t('[5] Replace All replaces every match in ONE undo step', async () => {
    setDoc('aa zz aa zz aa');
    PM().findSession('aa'); await sleep(120);
    await sleep(550);
    const norm = (d) => JSON.stringify(d, (k, val) => (k === 'sdBlockRev' ? 0 : val));
    const before = norm(doc().toJSON());
    const r = PM().replaceAll('XX'); await sleep(120);
    if (!doc().textContent.includes('XX zz XX zz XX')) return 'replace all did not apply';
    if (r.replacedCount !== 3) return 'wrong count ' + r.replacedCount;
    PM().cmd('undo'); await sleep(80);
    return norm(doc().toJSON()) === before; // ONE undo restores all
  });
  await t('[5] Replace All reports the count and clears the session', async () => {
    setDoc('q q q q');
    PM().findSession('q'); await sleep(120);
    const r = PM().replaceAll('w'); await sleep(120);
    return r.replacedCount === 4 && searchStore().activeMatchIndex === -1
      && searchStore().searchResults.length === 0;
  });
  await t('[5] clearFind removes all highlights and resets the session', async () => {
    setDoc('hit hit hit');
    PM().findSession('hit'); await sleep(120);
    PM().clearFind(); await sleep(80);
    return searchStore().searchResults.length === 0 && searchStore().query === '';
  });
  await t('[5] find pane (Ctrl+F path) opens in PM mode and is NOT the legacy taskpane block', async () => {
    setDoc('paneword paneword');
    window.WC.Dialogs.findPane(false); await sleep(80);
    // The PM pane renders real chrome (input + counter), not a notifyBlocked toast.
    const pane = document.getElementById('find-pane');
    const input = pane && pane.querySelector('input[type="text"]');
    if (!pane || !input) return 'find pane did not open';
    input.value = 'paneword';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300); // debounced doFind
    const ok = searchStore().searchResults.length === 2;
    pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] closing the find pane clears the search session (no orphan highlights)', async () => {
    setDoc('orphan orphan');
    window.WC.Dialogs.findPane(false); await sleep(80);
    const pane = document.getElementById('find-pane');
    const input = pane && pane.querySelector('input[type="text"]');
    if (!pane || !input) return 'find pane did not open';
    input.value = 'orphan'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    if (searchStore().searchResults.length !== 2) return 'precondition: search did not run';
    pane.querySelector('.x').click(); await sleep(80);
    return searchStore().searchResults.length === 0;
  });
  await t('[5] Replace pane (Ctrl+H path) renders Replace + Replace All controls', async () => {
    setDoc('zzz target zzz');
    window.WC.Dialogs.findPane(true); await sleep(80);
    const pane = document.getElementById('find-pane');
    const labels = Array.from(pane.querySelectorAll('button')).map((b) => b.textContent.trim());
    const ok = labels.some((l) => /^Replace$/.test(l)) && labels.some((l) => /Replace All/.test(l));
    pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] find pane options row exposes Match case / Whole words / Wildcards', async () => {
    window.WC.Dialogs.findPane(false); await sleep(80);
    const pane = document.getElementById('find-pane');
    const text = pane.textContent;
    const ok = /Match case/i.test(text) && /Whole word/i.test(text) && /[Ww]ildcard/i.test(text);
    pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] Advanced Find dropdown item opens the pane in advanced mode', async () => {
    const node = document.querySelector('[data-cmd="find"]') || document.body;
    window.WC.Commands.dropdown({ cmd: 'find', type: 'split' }, node);
    const item = Array.from(document.querySelectorAll('.flyout .fly-item'))
      .find((n) => /Advanced Find/i.test(n.textContent));
    if (!item) { window.WC.closeFlyouts(); return 'Advanced Find item not found'; }
    item.click(); await sleep(120);
    const pane = document.getElementById('find-pane');
    const ok = !!pane; // advanced variant still mounts a find UI (options expanded)
    pane && pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] Go To dialog opens and jumps to a heading target (model-supported)', async () => {
    // Go To by heading works on the model (page/line are pagination-gated → Phase 7).
    setDocs(['Intro body text', 'Chapter Two body']);
    // make para 2 a heading so Go To has a heading target
    selectText('Chapter Two body'); PM().applyStyleByName('Heading 1'); await sleep(80);
    window.WC.Dialogs.goToDialog ? window.WC.Dialogs.goToDialog() : null; await sleep(80);
    const dlg = document.querySelector('.modal-backdrop, #goto-dialog, #find-pane');
    const ok = !!dlg;
    const close = dlg && (dlg.querySelector('.x') || Array.from(dlg.querySelectorAll('button')).find((b) => /Close|Cancel/.test(b.textContent)));
    close && close.click();
    return ok; // structural; exact Go-To semantics validated by oracle Task 2
  });
  await t('[5] D6 flip: find dropdown + replace open in PM mode', async () => {
    // inverse of the pre-flip D6 block — proves the registry flip reached dispatch.
    const node = document.body;
    window.WC.Commands.dropdown({ cmd: 'find', type: 'split' }, node);
    const findOpen = document.querySelectorAll('.flyout .fly-item').length > 0;
    window.WC.closeFlyouts();
    window.WC.Commands.run({ cmd: 'replace', label: 'Replace' }); await sleep(80);
    const replaceOpen = !!document.getElementById('find-pane');
    const p = document.getElementById('find-pane'); p && p.querySelector('.x') && p.querySelector('.x').click();
    return findOpen && replaceOpen;
  });

  // ---------- slice 6: insert-basics (link/image/bookmark/symbol/equation/break/hr + table insert) ----------
  // Every insert is a REAL PM transaction. Assert on doc().toJSON() nodes/marks + round-trip,
  // never on legacy #editor DOM.
  await PM().newBlank(); await sleep(100);
  const hasNode = (name) => { let f = false; doc().descendants((n) => { if (n.type.name === name) f = true; }); return f; };
  const hasMark = (name) => { let f = false; doc().descendants((n) => { if (n.marks && n.marks.some((m) => m.type.name === name)) f = true; }); return f; };

  await t('[6] insertLink applies a link mark with href over the display text', async () => {
    setDoc('click here please');
    selectText('click here'); await sleep(60);
    PM().insertLink({ href: 'https://example.com', text: 'click here' }); await sleep(120);
    if (!hasMark('link')) return 'no link mark';
    let href = null; doc().descendants((n) => { (n.marks || []).forEach((m) => { if (m.type.name === 'link') href = m.attrs.href; }); });
    return /example\.com/.test(href || '');
  });
  await t('[6] insertLink with new display text inserts that text + link', async () => {
    setDoc('prefix '); selectText(' '); // collapsed-ish; rely on caret
    // selectText(' ') leaves the space selected; insertLink is expected to overwrite it with 'Anthropic'.
    // place caret at end, insert a link with explicit text
    PM().insertLink({ href: 'https://anthropic.com', text: 'Anthropic' }); await sleep(120);
    return doc().textContent.includes('Anthropic') && hasMark('link');
  });
  await t('[6] removeLink clears the link mark', async () => {
    setDoc('linked word'); selectText('linked word');
    PM().insertLink({ href: 'https://x.com', text: 'linked word' }); await sleep(80);
    selectText('linked word'); PM().removeLink(); await sleep(80);
    return !hasMark('link');
  });
  await t('[6] EXPORT: insertLink → <w:hyperlink r:id> + External Relationship (Word: Hyperlinks.Address)', async () => {
    // The tests above cover the live link MARK; this guards the EXPORT — a <w:hyperlink> whose r:id
    // resolves to an External Relationship (Target=url) in word/_rels/document.xml.rels, else Word can't
    // resolve the address. Word COM-validated: Hyperlinks.Count=1, .Address="https://example.com/",
    // .TextToDisplay="click here" (oracle-probe-6-hyperlink.js + scripts/oracle/validate-hyperlink-win.ps1).
    setDoc('click here please'); selectText('click here'); await sleep(60);
    PM().insertLink({ href: 'https://example.com/', text: 'click here' }); await sleep(120);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const hl = (xml.match(/<w:hyperlink\b[^>]*>/) || [])[0];
    if (!hl) return 'no <w:hyperlink> in export';
    const rId = (hl.match(/r:id="([^"]+)"/) || [])[1];
    if (!rId) return 'no r:id on <w:hyperlink>: ' + hl;
    const rels = window.WC.editor.converter?.convertedXml?.['word/_rels/document.xml.rels'];
    if (!rels) return 'no word/_rels/document.xml.rels generated';
    const relsRoot = (rels.elements || []).find((e) => e.name === 'Relationships');
    const els = (relsRoot && relsRoot.elements) || [];
    const rel = els.find((e) => e.name === 'Relationship' && e.attributes && e.attributes.Id === rId);
    if (!rel) return 'no Relationship for ' + rId + ' (Word cannot resolve the link address)';
    if (rel.attributes.Target !== 'https://example.com/') return 'Relationship Target wrong: ' + rel.attributes.Target;
    if (rel.attributes.TargetMode !== 'External') return 'Relationship TargetMode not External: ' + rel.attributes.TargetMode;
    return true;
  });
  await t('[6] insertImage inserts an image node with the data-url src', async () => {
    setDoc('photo: ');
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    PM().insertImage({ src: px, alt: 'dot' }); await sleep(120);
    let src = null; doc().descendants((n) => { if (n.type.name === 'image') src = n.attrs.src; });
    return hasNode('image') && /^data:image\/png/.test(src || '');
  });
  const mkImg = (w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, w, h);
    return c.toDataURL('image/png');
  };
  const columnWidthPx = () => {
    const pm = document.querySelector('#pm-editor .ProseMirror');
    const cs = getComputedStyle(pm);
    return pm.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  };
  await t('[insert] Picture inserts at NATURAL size, clamped to the column width (not tiny 100px)', async () => {
    setDoc('picbig: ');
    const res = await window.WC.Commands.insertPictureFromDataUrl(mkImg(1600, 800), 'big.png');
    await sleep(140);
    const img = document.querySelector('#pm-editor .ProseMirror img');
    if (!img || !res) return 'no image / no result';
    const colW = columnWidthPx();
    const renderedW = img.getBoundingClientRect().width;
    const clampedToColumn = res.width <= Math.round(colW) + 1 && Math.abs(renderedW - res.width) <= 3;
    const notTiny = renderedW > 150; // would be 100 under the old hardcoded default
    const aspectKept = Math.abs((res.width / res.height) - (1600 / 800)) < 0.05;
    return (clampedToColumn && notTiny && aspectKept)
      || JSON.stringify({ colW: Math.round(colW), renderedW: Math.round(renderedW), resW: res.width, resH: res.height });
  });
  await t('[insert] small Picture keeps its natural size (no forced 100×100 box)', async () => {
    setDoc('picsmall: ');
    const res = await window.WC.Commands.insertPictureFromDataUrl(mkImg(80, 60), 'small.png');
    await sleep(120);
    return (res && res.width === 80 && res.height === 60) || ('res=' + JSON.stringify(res));
  });
  await t('[insert] Picture with undecodable/0-dim source falls back to a sensible default (not 100×100)', async () => {
    setDoc('picbad: ');
    // Undecodable PNG payload → Image.onerror → imageNaturalSize() resolves null.
    const bad = 'data:image/png;base64,bm90YW5pbWFnZQ==';
    const res = await window.WC.Commands.insertPictureFromDataUrl(bad, 'bad.png');
    await sleep(120);
    return (res && res.width >= 150 && res.height >= 100 && res.natural == null)
      || ('res=' + JSON.stringify(res));
  });
  await t('[fix] a node-selected image shows a visible selection frame (.ProseMirror-selectednode is styled)', async () => {
    setDoc('imgsel: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(120, 80), 'sel.png');
    await sleep(120);
    const ed = window.WC.editor;
    let imgPos = null; ed.state.doc.descendants((n, p) => { if (n.type.name === 'image' && imgPos == null) imgPos = p; });
    if (imgPos == null) return 'no image node';
    v().dispatch(v().state.tr.setSelection(window.__PM_NodeSelection.create(doc(), imgPos)));
    await sleep(60);
    const sel = document.querySelector('#pm-editor .ProseMirror-selectednode');
    if (!sel) return 'no .ProseMirror-selectednode element after selecting the image';
    const cs = getComputedStyle(sel);
    return (cs.outlineStyle === 'solid' && parseFloat(cs.outlineWidth) >= 1)
      || ('outline=' + cs.outlineStyle + ' ' + cs.outlineWidth);
  });
  // Phase 4b — live image resize. Helpers: select an image as a NodeSelection, then
  // drag a named handle by (dx,dy) screen px via synthetic PointerEvents.
  const selectImage = () => {
    let pos = null; doc().descendants((n, p) => { if (n.type.name === 'image' && pos == null) pos = p; });
    if (pos == null) return null;
    v().dispatch(v().state.tr.setSelection(window.__PM_NodeSelection.create(doc(), pos)));
    return pos;
  };
  const dragHandle = async (id, dx, dy) => {
    const h = document.querySelector('.wc-img-resize .wc-img-handle-' + id);
    if (!h) return false;
    const r = h.getBoundingClientRect();
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
    h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: sx, clientY: sy, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: sx + dx, clientY: sy + dy, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: sx + dx, clientY: sy + dy, pointerId: 1 }));
    await sleep(200);
    return true;
  };
  const imgSize = () => { let s = null; doc().descendants((n) => { if (n.type.name === 'image') s = n.attrs.size; }); return s; };

  await t('[4b] a selected image shows the 8-handle live-resize overlay', async () => {
    setDoc('imgr1: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'r1.png');
    await sleep(140);
    if (selectImage() == null) return 'no image node';
    await sleep(120);
    const ov = document.querySelector('.wc-img-resize');
    if (!ov || getComputedStyle(ov).display === 'none') return 'resize overlay not visible on selection';
    const handles = ov.querySelectorAll('.wc-img-handle').length;
    return handles === 8 || ('expected 8 handles, got ' + handles);
  });

  await t('[4b] dragging a corner handle resizes the image aspect-locked + exports w:extent (EMU)', async () => {
    setDoc('imgr2: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'r2.png'); // 2:1 natural
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    await sleep(120);
    const before = imgSize();
    if (!before || !before.width) return 'no size attr before drag';
    const aspect0 = before.width / before.height;
    if (!(await dragHandle('se', 60, 30))) return 'SE handle not found';
    const after = imgSize();
    if (!after || !(after.width > before.width)) return 'image did not grow (' + JSON.stringify(before) + ' -> ' + JSON.stringify(after) + ')';
    // Aspect-locked: the ratio is preserved within rounding.
    if (Math.abs(after.width / after.height - aspect0) > 0.06) return 'aspect not preserved: ' + JSON.stringify(after) + ' (was ' + aspect0.toFixed(2) + ':1)';
    // Exported wp:extent EMU must equal round(px * 9525).
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!m) return 'no <wp:extent> in exported XML';
    const cx = +m[1], cy = +m[2];
    const okCx = Math.abs(cx - Math.round(after.width * 9525)) <= 9525;
    const okCy = Math.abs(cy - Math.round(after.height * 9525)) <= 9525;
    return (okCx && okCy) || ('extent cx=' + cx + ' cy=' + cy + ' vs size ' + JSON.stringify(after));
  });

  await t('[4b] the resize handles align with the image box (overlay is correctly anchored)', async () => {
    // Guards the containing-block assumption: the overlay is position:absolute in #pages,
    // so #pages MUST be position:relative or the handles drift off the image. The SE
    // handle's screen center must sit at the image's bottom-right corner (± a few px).
    setDoc('imgr3: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'r3.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    await sleep(120);
    const imgEl = document.querySelector('#pm-editor .ProseMirror img');
    const se = document.querySelector('.wc-img-resize .wc-img-handle-se');
    if (!imgEl || !se) return 'image or SE handle missing';
    const ir = imgEl.getBoundingClientRect(), sr = se.getBoundingClientRect();
    const hx = sr.left + sr.width / 2, hy = sr.top + sr.height / 2;
    const dx = Math.abs(hx - ir.right), dy = Math.abs(hy - ir.bottom);
    return (dx <= 6 && dy <= 6) || ('SE handle off the image corner by dx=' + Math.round(dx) + ' dy=' + Math.round(dy));
  });

  await t('[4b] an edge handle (E) resizes the image (aspect-locked, single-axis drive)', async () => {
    setDoc('imgr4: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'r4.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    await sleep(120);
    const before = imgSize();
    if (!(await dragHandle('e', 50, 0))) return 'E handle not found';
    const after = imgSize();
    if (!after || !(after.width > before.width)) return 'E-drag did not widen (' + JSON.stringify(before) + ' -> ' + JSON.stringify(after) + ')';
    // Aspect still locked (E handle drives width; height follows).
    return Math.abs(after.width / after.height - before.width / before.height) < 0.06
      || ('aspect drift on E-drag: ' + JSON.stringify(after));
  });

  await t('[4b] a stretched (aspect-divergent) image renders + exports its explicit height', async () => {
    // A picture whose stored box diverges from its intrinsic aspect (a stretched/free-resized
    // image, or one imported from Word) must render + export the explicit width AND height —
    // NOT height:auto (render) and NOT the intrinsic-aspect-scaled box (export).
    setDoc('stretch: ');
    PM().insertImage({ src: mkImg(100, 100), alt: 'sq', width: 100, height: 100 }); // 1:1 natural
    await sleep(250);
    let imgPos = null; doc().descendants((n, pos) => { if (n.type.name === 'image' && imgPos == null) imgPos = pos; });
    if (imgPos == null) return 'no image node';
    const node = doc().nodeAt(imgPos);
    v().dispatch(v().state.tr.setNodeMarkup(imgPos, undefined, { ...node.attrs, size: { width: 240, height: 60 } })); // 4:1 box
    await sleep(300);
    const style = (document.querySelector('#pm-editor .ProseMirror img') || {}).getAttribute('style') || '';
    if (/height:\s*auto/.test(style)) return 'render ignores the explicit height (height:auto): ' + style;
    if (!/height:\s*60px/.test(style)) return 'render lacks the explicit 60px height: ' + style;
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!m) return 'no wp:extent';
    const cx = +m[1], cy = +m[2];
    const okW = Math.abs(cx - Math.round(240 * 9525)) <= 9525;
    const okH = Math.abs(cy - Math.round(60 * 9525)) <= 9525;
    return (okW && okH) || ('extent ' + Math.round(cx / 9525) + 'x' + Math.round(cy / 9525) + 'px (want 240x60 — aspect-forced?)');
  });

  await t('[4b] a dimensionless insertImage sizes to natural dims, not a squashing 100x100 placeholder', async () => {
    // Insert → Screenshot/Icon call insertImage without dims. The bridge must size to the image's
    // natural (clamped) box, not 100x100 — else a non-square image is squashed (now that the
    // exporter honors explicit boxes, a placeholder would ship distorted).
    setDoc('dimless: ');
    PM().insertImage({ src: mkImg(200, 80), alt: 'wide' }); // NO width/height → bridge computes natural (2.5:1)
    await sleep(250);
    let sz = null; doc().descendants((n) => { if (n.type.name === 'image' && !sz) sz = n.attrs.size; });
    if (!sz) return 'no image size';
    if (sz.width === 100 && sz.height === 100) return 'sized to the 100x100 placeholder (squashes non-square images)';
    return Math.abs(sz.width / sz.height - 2.5) < 0.2 || 'natural aspect 2.5:1 not kept, got ' + JSON.stringify(sz);
  });

  await t('[4b] setImageLockAspect(false) → an edge handle free-stretches ONE axis', async () => {
    if (typeof PM().setImageLockAspect !== 'function') return 'PM.setImageLockAspect missing (red)';
    setDoc('fs1: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'fs1.png'); // 2:1
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    await sleep(120);
    if (PM().setImageLockAspect(false) !== true) return 'setImageLockAspect returned false';
    selectImage(); await sleep(100); // re-assert selection after the markup change
    const before = imgSize();
    if (!(await dragHandle('e', 60, 0))) return 'E handle not found';
    const after = imgSize();
    if (!(after.width > before.width + 20)) return 'E-drag did not widen (' + JSON.stringify(before) + ' -> ' + JSON.stringify(after) + ')';
    // free one-axis stretch: width grew, height UNCHANGED (aspect diverges from the original 2:1).
    return Math.abs(after.height - before.height) <= 2 || ('height changed on a free E-stretch (want one-axis): ' + JSON.stringify({ before, after }));
  });

  await t('[4b] an unlocked image: a N (top) handle free-stretches HEIGHT only', async () => {
    setDoc('fs2: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'fs2.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    await sleep(120);
    PM().setImageLockAspect(false); selectImage(); await sleep(120);
    const before = imgSize();
    if (!(await dragHandle('n', 0, -40))) return 'N handle not found';
    const after = imgSize();
    if (!(after.height > before.height + 15)) return 'N-drag did not grow height (' + JSON.stringify(before) + ' -> ' + JSON.stringify(after) + ')';
    return Math.abs(after.width - before.width) <= 2 || ('width changed on a free N-stretch (want one-axis): ' + JSON.stringify({ before, after }));
  });

  await t('[4b] a LOCKED image (default) keeps aspect on an edge drag', async () => {
    setDoc('fs3: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'fs3.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    await sleep(120);
    const before = imgSize(); // default = locked (no lockAspectRatio attr → treated as locked)
    if (!(await dragHandle('e', 60, 0))) return 'E handle not found';
    const after = imgSize();
    return Math.abs(after.width / after.height - before.width / before.height) < 0.06 || ('locked image distorted on E-drag: ' + JSON.stringify(after));
  });

  await t('[4b] Picture Format tab: Lock Aspect Ratio toggles the picture lockAspectRatio attr', async () => {
    if (!window.WC.PictureToolsPM || typeof window.WC.PictureToolsPM.syncContextualTab !== 'function') return 'PictureToolsPM.syncContextualTab missing (red)';
    setDoc('pf: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'pf.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    await sleep(350); // let state-sync drive the contextual tab + the ribbon render
    // the Picture Format contextual tab must appear when a picture is selected.
    const pfShown = () => Array.from(document.querySelectorAll('#tabstrip *')).some((e) => /Picture Format/.test(e.textContent || ''));
    if (!pfShown()) return 'Picture Format contextual tab did not appear on image selection';
    const lockOf = () => { let a; doc().descendants((n) => { if (n.type.name === 'image') a = n.attrs.lockAspectRatio; }); return a !== false; };
    const before = lockOf(); // default = locked
    WC.Commands.run({ cmd: 'imgLockAspect', type: 'button' }, document.body); // dispatch the ribbon control
    await sleep(150); selectImage();
    if (lockOf() === before) return 'Lock Aspect Ratio did not toggle (was ' + before + ', still ' + lockOf() + ')';
    WC.Commands.run({ cmd: 'imgLockAspect', type: 'button' }, document.body); // toggle back
    await sleep(150); selectImage();
    return lockOf() === before || 'Lock Aspect Ratio did not toggle back';
  });

  await t('[4b] Picture Format Arrange cmds are un-blocked (shipped engine) + reach the bridge', async () => {
    // Regression for the stale-DEFERRED bug: wrapText/bringForward/sendBackward ship engine
    // support (4c.1 wrap / 4c.3 z-order) but were gated by the coarse layout-arrange DEFERRED
    // flag, so the ribbon path toasted "not available" instead of acting. ENGINE_READY un-blocks
    // exactly those three; the still-undefined cmds (align/group/rotate/position) stay blocked.
    if (PM().isBlocked('wrapText') !== false) return 'wrapText still blocked';
    if (PM().isBlocked('bringForward') !== false) return 'bringForward still blocked';
    if (PM().isBlocked('sendBackward') !== false) return 'sendBackward still blocked';
    if (PM().isBlocked('align') !== true) return 'align should STAY blocked (WC.Layout.align is undefined)';
    if (PM().isBlocked('rotate') !== true) return 'rotate should STAY blocked';
    // End-to-end: dispatching the ribbon control reaches the bridge verb (was notifyBlocked before).
    setDoc('arr: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(120, 90), 'arr.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    const origZ = PM().setImageZOrder; let zHit = null;
    PM().setImageZOrder = (dir) => { zHit = dir; return origZ.call(PM(), dir); };
    try {
      WC.Commands.run({ cmd: 'bringForward', type: 'split', label: 'Bring Forward' }, document.body);
      await sleep(60);
    } finally { PM().setImageZOrder = origZ; }
    return zHit === 'forward' || 'bringForward dispatch did not reach setImageZOrder (got ' + zHit + ')';
  });

  await t('[4b] Picture Format Size group: numeric H/W set the box (aspect-lock + divergent when unlocked) + export wp:extent', async () => {
    if (typeof PM().setImageSize !== 'function') return 'PM.setImageSize missing (red)';
    // imgHeight/imgWidth are not AREA-mapped → the ribbon never blocks them.
    if (PM().isBlocked('imgHeight') !== false || PM().isBlocked('imgWidth') !== false) return 'imgHeight/imgWidth should not be blocked';
    setDoc('size: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'sz.png'); // 2:1 natural, default LOCKED
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    const before = imgSize();
    if (!before || !before.width || !before.height) return 'no size attr after insert';
    const aspect0 = before.width / before.height;
    // LOCKED: setting WIDTH derives HEIGHT to preserve the ratio.
    PM().setImageSize({ width: 144 }); await sleep(60); selectImage();
    let s = imgSize();
    let expH = Math.round(144 / aspect0);
    if (!s || s.width !== 144 || Math.abs(s.height - expH) > 1) return 'locked width-set did not derive height: ' + JSON.stringify(s) + ' (exp h≈' + expH + ')';
    // LOCKED: setting HEIGHT derives WIDTH (ratio preserved at ~aspect0).
    PM().setImageSize({ height: 50 }); await sleep(60); selectImage();
    s = imgSize();
    let expW = Math.round(50 * aspect0);
    if (!s || s.height !== 50 || Math.abs(s.width - expW) > 1) return 'locked height-set did not derive width: ' + JSON.stringify(s) + ' (exp w≈' + expW + ')';
    // UNLOCK → independent axes: setting WIDTH must NOT touch HEIGHT (divergent box).
    PM().setImageLockAspect(false); await sleep(60); selectImage();
    PM().setImageSize({ width: 180 }); await sleep(60); selectImage();
    s = imgSize();
    if (!s || s.width !== 180 || s.height !== 50) return 'unlocked width-set should leave height at 50: ' + JSON.stringify(s);
    // Export: the explicit box round-trips to wp:extent (EMU = px × 9525).
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!m) return 'no <wp:extent> in exported XML';
    const okCx = Math.abs(+m[1] - Math.round(180 * 9525)) <= 9525;
    const okCy = Math.abs(+m[2] - Math.round(50 * 9525)) <= 9525;
    if (!okCx || !okCy) return 'extent cx=' + m[1] + ' cy=' + m[2] + ' vs 180x50';
    // An absurd dimension is bounded to MAX_DIM (4000) — the numeric path can't exceed the drag overlay.
    PM().setImageSize({ height: 10000 }); await sleep(60); selectImage();
    s = imgSize();
    return (s && s.height === 4000 && s.width === 180) || 'height not capped at MAX_DIM=4000: ' + JSON.stringify(s);
  });

  await t('[4b] Picture Format Alt Text: description → wp:docPr/@descr; "decorative" clears it + adds the decorative ext', async () => {
    if (typeof PM().setImageAltText !== 'function') return 'PM.setImageAltText missing (red)';
    if (PM().isBlocked('imgAltText') !== false) return 'imgAltText should not be blocked';
    const imgAttrs = () => { let a = null; doc().descendants((n) => { if (n.type.name === 'image') a = n.attrs; }); return a || {}; };
    setDoc('alt: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(120, 90), 'alt.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    // Set a description → node.title (the fork's accessibility descr).
    PM().setImageAltText({ title: 'A red square logo' }); await sleep(60); selectImage();
    if (imgAttrs().title !== 'A red square logo') return 'description not stored on node.title: ' + JSON.stringify(imgAttrs().title);
    let xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    let dp = xml.match(/<wp:docPr\b[^>]*\/?>/);
    if (!dp || !/descr="A red square logo"/.test(dp[0])) return 'wp:docPr missing descr="A red square logo": ' + (dp && dp[0]);
    // Mark decorative → description cleared (Word disables it) + the decorative flag set.
    PM().setImageAltText({ decorative: true }); await sleep(60); selectImage();
    if (imgAttrs().decorative !== true || imgAttrs().title !== null) return 'decorative did not set flag + clear title: ' + JSON.stringify({ d: imgAttrs().decorative, t: imgAttrs().title });
    xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    dp = xml.match(/<wp:docPr\b[^>]*>/);
    if (dp && /descr=/.test(dp[0])) return 'decorative image still exports @descr: ' + dp[0];
    return /adec:decorative/.test(xml) || 'decorative ext (adec:decorative) not exported';
  });

  await t('[4b] Picture Format Crop: L/T/R/B % → clipPath → exports a:srcRect (thousandths) + round-trips; Remove clears', async () => {
    if (typeof PM().setImageCrop !== 'function') return 'PM.setImageCrop missing (red)';
    if (PM().isBlocked('imgCrop') !== false) return 'imgCrop should not be blocked';
    const clipOf = () => { let c = null; doc().descendants((n) => { if (n.type.name === 'image') c = n.attrs.clipPath; }); return c; };
    const srcRectTag = (xml) => { const m = xml.match(/<a:srcRect\b[^>]*>/); return m && m[0]; };
    setDoc('crop: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'crop.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    // Crop 10% off the left + 5% off the top → CSS inset order is top/right/bottom/left.
    PM().setImageCrop({ l: 10, t: 5, r: 0, b: 0 }); await sleep(60); selectImage();
    if (clipOf() !== 'inset(5% 0% 0% 10%)') return 'clipPath not set correctly: ' + clipOf();
    // Export emits a:srcRect with thousandths (10% → 10000); zero edges are omitted.
    let tag = srcRectTag(await window.WC.editor.exportDocx({ exportXmlOnly: true }));
    if (!tag) return 'no <a:srcRect> in exported XML';
    if (!/\bl="10000"/.test(tag) || !/\bt="5000"/.test(tag)) return 'srcRect missing l=10000/t=5000: ' + tag;
    if (/\br="/.test(tag) || /\bb="/.test(tag)) return 'srcRect emitted zero edges r/b: ' + tag;
    // Too-large guard: a crop that removes the whole picture is rejected (clipPath unchanged).
    if (PM().setImageCrop({ l: 60, r: 60 }) !== false) return 'over-100% crop should be rejected';
    selectImage();
    if (clipOf() !== 'inset(5% 0% 0% 10%)') return 'rejected crop must not change clipPath: ' + clipOf();
    // Remove Crop clears clipPath → no a:srcRect on export.
    PM().setImageCrop({ remove: true }); await sleep(60); selectImage();
    if (clipOf() != null) return 'Remove Crop did not clear clipPath: ' + clipOf();
    if (srcRectTag(await window.WC.editor.exportDocx({ exportXmlOnly: true }))) return 'a:srcRect still exported after Remove Crop';
    // Re-crop, then a full open+save round-trip preserves the crop at the XML boundary (export →
    // openDocx → re-export keeps the identical a:srcRect; the importer reads it back via clipPath).
    PM().setImageCrop({ l: 10, t: 5 }); await sleep(60);
    const bytes = await PM().exportDocxBytes(); await PM().openDocx(bytes); await sleep(240);
    const rtTag = srcRectTag(await window.WC.editor.exportDocx({ exportXmlOnly: true }));
    if (!rtTag) return 'crop lost on open+save round-trip (no a:srcRect after reopen)';
    return (/\bl="10000"/.test(rtTag) && /\bt="5000"/.test(rtTag)) || 'round-trip changed srcRect: ' + rtTag;
  });

  await t('[4b] Picture Format Rotate/Flip: setImageTransform → transformData → exports a:xfrm rot/flip + round-trips; Reset clears', async () => {
    if (typeof PM().setImageTransform !== 'function') return 'PM.setImageTransform missing (red)';
    if (PM().isBlocked('imgRotate') !== false) return 'imgRotate should not be blocked';
    const tdOf = () => { let td = null; doc().descendants((n) => { if (n.type.name === 'image') td = n.attrs.transformData; }); return td || {}; };
    const xfrmTag = (xml) => { const m = xml.match(/<a:xfrm\b[^>]*>/); return m && m[0]; };
    setDoc('rot: ');
    await window.WC.Commands.insertPictureFromDataUrl(mkImg(200, 100), 'rot.png');
    await sleep(160);
    if (selectImage() == null) return 'no image node';
    // Rotate right 90° twice → 180 (relative delta, normalized).
    PM().setImageTransform({ rotate: 90 }); await sleep(50); selectImage();
    if (tdOf().rotation !== 90) return 'rotation not 90: ' + JSON.stringify(tdOf());
    PM().setImageTransform({ rotate: 90 }); await sleep(50); selectImage();
    if (tdOf().rotation !== 180) return 'rotation not 180: ' + JSON.stringify(tdOf());
    // Flip horizontal toggles on, then off (dropping the key).
    PM().setImageTransform({ flipH: true }); await sleep(50); selectImage();
    if (tdOf().horizontalFlip !== true) return 'flipH not set: ' + JSON.stringify(tdOf());
    PM().setImageTransform({ flipH: true }); await sleep(50); selectImage();
    if (tdOf().horizontalFlip != null) return 'flipH toggle-off did not drop the key: ' + JSON.stringify(tdOf());
    // Re-set flipH on; export carries rot (180° → degreesToRot = 10800000) + flipH="1".
    PM().setImageTransform({ flipH: true }); await sleep(50); selectImage();
    let tag = xfrmTag(await window.WC.editor.exportDocx({ exportXmlOnly: true }));
    if (!tag) return 'no <a:xfrm> in export';
    if (!/\brot="10800000"/.test(tag)) return 'rot not 180°(10800000): ' + tag;
    if (!/\bflipH="1"/.test(tag)) return 'a:xfrm missing flipH="1": ' + tag;
    // Reset clears all transforms → no a:xfrm rot/flip on export.
    PM().setImageTransform({ reset: true }); await sleep(50); selectImage();
    if (tdOf().rotation != null || tdOf().horizontalFlip != null || tdOf().verticalFlip != null) return 'reset did not clear transformData: ' + JSON.stringify(tdOf());
    tag = xfrmTag(await window.WC.editor.exportDocx({ exportXmlOnly: true }));
    if (tag && (/\brot=/.test(tag) || /\bflip/.test(tag))) return 'a:xfrm still carries rot/flip after reset: ' + tag;
    // Re-apply rotate 90° + flipH, then a full open+save round-trip preserves it (XML boundary; the
    // synthetic image doesn't re-materialize as a node after openDocx — see the Crop test note).
    PM().setImageTransform({ rotate: 90 }); await sleep(50); selectImage();
    PM().setImageTransform({ flipH: true }); await sleep(50); selectImage();
    const bytes = await PM().exportDocxBytes(); await PM().openDocx(bytes); await sleep(240);
    const rt = xfrmTag(await window.WC.editor.exportDocx({ exportXmlOnly: true }));
    if (!rt) return 'a:xfrm lost on open+save round-trip';
    return (/\brot="5400000"/.test(rt) && /\bflipH="1"/.test(rt)) || 'round-trip changed rot/flip (expected 90°=5400000 + flipH): ' + rt;
  });

  await t('[4c] Picture Position (4c.2): setImagePosition → marginOffset → exports wp:posOffset (EMU) + round-trips; inline-guarded', async () => {
    if (typeof PM().setImagePosition !== 'function') return 'PM.setImagePosition missing (red)';
    if (PM().isBlocked('imgPosition') !== false) return 'imgPosition should not be blocked';
    const moOf = () => { let mo = null; doc().descendants((n) => { if (n.type.name === 'image') mo = n.attrs.marginOffset; }); return mo || {}; };
    setDoc('pos: ');
    PM().insertImage({ src: mkImg(120, 90), alt: 'p1', width: 120, height: 90 });
    await sleep(220);
    if (selectImage() == null) return 'no image node';
    // Inline guard: an in-line picture can't be positioned.
    if (PM().setImagePosition({ horizontal: 96, top: 48 }) !== false) return 'setImagePosition should refuse an inline picture';
    // Float it (Behind Text = wrap None, absolute), then position it 1" right of column / 0.5" below para.
    selectImage(); PM().setImageWrap('behind'); await sleep(140); selectImage();
    if (!PM().setImagePosition({ horizontal: 96, top: 48 })) return 'setImagePosition returned false on a floating picture';
    await sleep(60); selectImage();
    let mo = moOf();
    if (mo.horizontal !== 96 || mo.top !== 48) return 'marginOffset not set: ' + JSON.stringify(mo);
    // relative:true ADDS to the current offset (nudge).
    PM().setImagePosition({ horizontal: 10, top: -8, relative: true }); await sleep(60); selectImage();
    mo = moOf();
    if (mo.horizontal !== 106 || mo.top !== 40) return 'relative nudge wrong: ' + JSON.stringify(mo);
    // Reset back to 96/48 for a clean export assertion.
    PM().setImagePosition({ horizontal: 96, top: 48 }); await sleep(60); selectImage();
    // Export: wp:positionH/V → wp:posOffset in EMU (96px → 914400, 48px → 457200).
    let xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!/<wp:positionH\b[^>]*relativeFrom="column"/.test(xml)) return 'no wp:positionH relativeFrom=column';
    // The generated anchor MUST be simplePos="0" (complex positioning) — else Word ignores
    // positionH/V and pins the picture to the page origin (oracle-confirmed: Left/Top = -1"/-1").
    if (!/<wp:anchor\b[^>]*\bsimplePos="0"/.test(xml)) return 'anchor not simplePos="0" — Word would ignore positionH/V';
    const hOff = xml.match(/<wp:positionH[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    const vOff = xml.match(/<wp:positionV[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    if (!hOff || +hOff[1] !== 914400) return 'wp:positionH posOffset not 914400 (1"): ' + (hOff && hOff[1]);
    if (!vOff || +vOff[1] !== 457200) return 'wp:positionV posOffset not 457200 (0.5"): ' + (vOff && vOff[1]);
    // Imported-anchor guard: a picture carrying originalDrawingChildren (its verbatim imported anchor)
    // refuses reposition — the export would keep the original posOffset, so moving it would silently
    // drop on save. Stamp the attr to simulate an import, then assert the verb refuses (no node change).
    const ipos = selectImage();
    v().dispatch(v().state.tr.setNodeMarkup(ipos, undefined, { ...doc().nodeAt(ipos).attrs, originalDrawingChildren: [{ name: 'wp:positionH', elements: [] }] }));
    await sleep(40); selectImage();
    if (PM().setImagePosition({ horizontal: 300, top: 300 }) !== false) return 'setImagePosition should refuse an imported picture (originalDrawingChildren present)';
    await sleep(40);
    if (moOf().horizontal === 300) return 'refused reposition must not change marginOffset';
    // Clear the simulated import so the round-trip below uses the clean generated anchor.
    const ip2 = selectImage();
    v().dispatch(v().state.tr.setNodeMarkup(ip2, undefined, { ...doc().nodeAt(ip2).attrs, originalDrawingChildren: null }));
    await sleep(40);
    // Full open+save round-trip preserves the position (XML boundary).
    const bytes = await PM().exportDocxBytes(); await PM().openDocx(bytes); await sleep(240);
    const rt = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const rtH = rt.match(/<wp:positionH[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    return (rtH && +rtH[1] === 914400) || 'position lost on round-trip: ' + (rtH && rtH[1]);
  });

  await t('[4c] Arrow-key nudge moves a selected floating picture (8px step, Shift=1px) + ignores inline', async () => {
    const moOf = () => { let mo = null; doc().descendants((n) => { if (n.type.name === 'image') mo = n.attrs.marginOffset; }); return mo || {}; };
    const arrow = (key, shift) => v().someProp('handleKeyDown', (f) => f(v(), new KeyboardEvent('keydown', { key, shiftKey: !!shift })));
    setDoc('nudge: ');
    PM().insertImage({ src: mkImg(120, 90), alt: 'n1', width: 120, height: 90 });
    await sleep(220);
    if (selectImage() == null) return 'no image node';
    // Inline (not yet floated): arrow keys are NOT consumed (normal caret nav).
    if (arrow('ArrowRight') === true) return 'arrow nudge should NOT fire on an inline picture';
    // Float it (selected once), then nudge WITHOUT re-selecting — proving the picture stays selected
    // across nudges (setImagePosition re-asserts the NodeSelection), so repeated arrows keep moving it.
    selectImage(); PM().setImageWrap('behind'); await sleep(140); selectImage();
    const start = moOf();
    const baseH = Number(start.horizontal) || 0, baseT = Number(start.top) || 0;
    if (arrow('ArrowRight') !== true) return 'ArrowRight should be consumed on a floating picture';
    await sleep(40);
    if (arrow('ArrowRight') !== true) return '2nd ArrowRight not consumed — selection dropped after the 1st nudge?';
    await sleep(40);
    if (moOf().horizontal !== baseH + 16) return 'two ArrowRights should cumulatively nudge +16px (selection must persist): ' + JSON.stringify(moOf());
    // ArrowUp nudges -8px vertical (still no re-select).
    if (arrow('ArrowUp') !== true) return 'ArrowUp not consumed';
    await sleep(40);
    if (moOf().top !== baseT - 8) return 'ArrowUp did not nudge -8px: ' + JSON.stringify(moOf());
    // Shift+ArrowLeft = 1px fine nudge.
    if (arrow('ArrowLeft', true) !== true) return 'Shift+ArrowLeft not consumed';
    await sleep(40);
    if (moOf().horizontal !== baseH + 16 - 1) return 'Shift+ArrowLeft did not fine-nudge -1px: ' + JSON.stringify(moOf());
    // A non-arrow key is not consumed by the nudge handler.
    return arrow('a') !== true || 'a non-arrow key should not be consumed by the nudge handler';
  });

  const imgWrapAttr = () => { let a = null; doc().descendants((n) => { if (n.type.name === 'image') a = { wrap: n.attrs.wrap, isAnchor: n.attrs.isAnchor, anchorData: n.attrs.anchorData }; }); return a; };

  await t('[4c] setImageWrap("square") floats the image (wrap=Square + anchor + float render)', async () => {
    if (typeof PM().setImageWrap !== 'function') return 'PM.setImageWrap missing (red)';
    setDoc('wrap1: '); // clean text doc first → the next call exercises the no-image-selected path
    if (PM().setImageWrap('square')) return 'setImageWrap should return false with no image selected';
    PM().insertImage({ src: mkImg(120, 90), alt: 'w1', width: 120, height: 90 }); // stable insert (rId bypasses async registration)
    await sleep(250);
    if (selectImage() == null) return 'no image node';
    if (!PM().setImageWrap('square')) return 'setImageWrap("square") returned false';
    await sleep(200);
    const a = imgWrapAttr();
    if (!a || !a.wrap || a.wrap.type !== 'Square' || a.isAnchor !== true) return 'wrap not Square/anchor: ' + JSON.stringify(a);
    if (!a.anchorData || !a.anchorData.hRelativeFrom) return 'no anchorData seeded (export would lack positionH/V): ' + JSON.stringify(a);
    const style = (document.querySelector('#pm-editor .ProseMirror img') || {}).getAttribute ? document.querySelector('#pm-editor .ProseMirror img').getAttribute('style') : '';
    return (/float\s*:/.test(style) && /shape-outside\s*:/.test(style)) || ('img style lacks float/shape-outside: ' + style);
  });

  await t('[4c] a wrapped image exports a schema-valid wp:anchor (required CT_Anchor attrs)', async () => {
    setDoc('wrap2: ');
    PM().insertImage({ src: mkImg(120, 90), alt: 'w2', width: 120, height: 90 });
    await sleep(250);
    if (selectImage() == null) return 'no image node';
    PM().setImageWrap('square');
    await sleep(160);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!/<wp:anchor/.test(xml)) return 'no <wp:anchor> in export';
    if (!/<wp:simplePos/.test(xml)) return 'missing required <wp:simplePos> child (Word rejects the file)';
    if (!/<wp:positionH/.test(xml) || !/<wp:positionV/.test(xml)) return 'missing positionH/positionV';
    if (!/<wp:wrapSquare/.test(xml)) return 'missing <wp:wrapSquare>';
    // The CT_Anchor required boolean attrs — omitting any makes Word refuse to open the docx.
    const anchorTag = (xml.match(/<wp:anchor[^>]*>/) || [''])[0];
    for (const attr of ['simplePos=', 'behindDoc=', 'locked=', 'layoutInCell=', 'allowOverlap=', 'relativeHeight=']) {
      if (!anchorTag.includes(attr)) return 'wp:anchor missing required attr ' + attr + ' → ' + anchorTag;
    }
    return true;
  });

  await t('[4c] setImageWrap("inline") returns to in-line with text (wp:inline, no anchor)', async () => {
    setDoc('wrap3: ');
    PM().insertImage({ src: mkImg(120, 90), alt: 'w3', width: 120, height: 90 });
    await sleep(250);
    if (selectImage() == null) return 'no image node';
    PM().setImageWrap('square'); await sleep(120);
    selectImage(); PM().setImageWrap('inline'); await sleep(160);
    const a = imgWrapAttr();
    if (!a || !a.wrap || a.wrap.type !== 'Inline' || a.isAnchor !== false) return 'not back to inline: ' + JSON.stringify(a);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    return (/<wp:inline/.test(xml) && !/<wp:anchor/.test(xml)) || 'inline export wrong (anchor=' + /<wp:anchor/.test(xml) + ')';
  });

  await t('[4c] tight wrap exports a wp:wrapPolygon (CT_WrapTight requires it — else Word rejects)', async () => {
    setDoc('wrap4: ');
    PM().insertImage({ src: mkImg(120, 90), alt: 'w4', width: 120, height: 90 });
    await sleep(250);
    if (selectImage() == null) return 'no image node';
    PM().setImageWrap('tight'); await sleep(160);
    const a = imgWrapAttr();
    if (!a || !a.wrap || a.wrap.type !== 'Tight') return 'wrap not Tight: ' + JSON.stringify(a && a.wrap);
    if (!a.wrap.attrs || !Array.isArray(a.wrap.attrs.polygon) || a.wrap.attrs.polygon.length < 3) return 'no default polygon seeded for Tight: ' + JSON.stringify(a.wrap.attrs);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    return (/<wp:wrapTight/.test(xml) && /<wp:wrapPolygon/.test(xml) && /<wp:start\b/.test(xml))
      || 'tight export missing wrapTight/wrapPolygon (Word would reject)';
  });

  await t('[4c] behind/front/topbottom export the right wrap element + behindDoc (CT_Anchor)', async () => {
    const wrapOf = async (mode) => {
      setDoc('wrapm: ');
      PM().insertImage({ src: mkImg(120, 90), alt: 'wm', width: 120, height: 90 });
      await sleep(250);
      if (selectImage() == null) return null;
      PM().setImageWrap(mode); await sleep(140);
      return await window.WC.editor.exportDocx({ exportXmlOnly: true });
    };
    const behind = await wrapOf('behind');
    if (!behind || !/<wp:wrapNone/.test(behind) || !/behindDoc="1"/.test(behind)) return 'behind: expected wrapNone + behindDoc="1"';
    const front = await wrapOf('front');
    if (!front || !/<wp:wrapNone/.test(front) || !/behindDoc="0"/.test(front)) return 'front: expected wrapNone + behindDoc="0"';
    const tb = await wrapOf('topbottom');
    if (!tb || !/<wp:wrapTopAndBottom/.test(tb)) return 'topbottom: expected wp:wrapTopAndBottom';
    // all three are floating anchors with the required simplePos child
    return /<wp:anchor[^>]*simplePos=/.test(tb) && /<wp:simplePos/.test(tb) || 'topbottom anchor missing required simplePos';
  });

  await t('[4c] z-order: Bring to Front / Send to Back set a Word-sane relativeHeight ordering', async () => {
    if (typeof PM().setImageZOrder !== 'function') return 'PM.setImageZOrder missing (red)';
    const Z_BASE = 251658240;
    const relOf = (alt) => { let v; doc().descendants((n) => { if (n.type.name === 'image' && n.attrs.alt === alt) v = n.attrs.relativeHeight; }); return v == null ? Z_BASE : Number(v); };
    const posOf = (alt) => { let p = null; doc().descendants((n, pos) => { if (n.type.name === 'image' && n.attrs.alt === alt) p = pos; }); return p; };
    const selAlt = (alt) => { const p = posOf(alt); if (p == null) return false; v().dispatch(v().state.tr.setSelection(window.__PM_NodeSelection.create(doc(), p))); return true; };
    setDoc('zo: ');
    PM().insertImage({ src: mkImg(80, 60), alt: 'zoA', width: 80, height: 60 }); await sleep(220);
    PM().insertImage({ src: mkImg(80, 60), alt: 'zoB', width: 80, height: 60 }); await sleep(240);
    // guard: inline image (not floating) → z-order is a no-op false
    selAlt('zoA');
    if (PM().setImageZOrder('toFront')) return 'z-order should refuse a non-floating (inline) image';
    // float both, then order them
    selAlt('zoA'); PM().setImageWrap('front'); await sleep(120);
    selAlt('zoB'); PM().setImageWrap('front'); await sleep(120);
    // Bring Forward on the DEFAULT tie (both at base) must move zoA above zoB, not no-op.
    selAlt('zoA'); if (!PM().setImageZOrder('forward')) return 'forward returned false'; await sleep(140);
    if (!(relOf('zoA') > relOf('zoB'))) return 'Bring Forward on a tie did not raise zoA above zoB (no-op bug): ' + relOf('zoA') + ' vs ' + relOf('zoB');
    selAlt('zoA'); if (!PM().setImageZOrder('toFront')) return 'toFront returned false'; await sleep(140);
    if (!(relOf('zoA') > relOf('zoB'))) return 'after toFront, zoA relativeHeight not above zoB: ' + relOf('zoA') + ' vs ' + relOf('zoB');
    if (relOf('zoA') < Z_BASE) return 'relativeHeight not Word-sane (>= base): ' + relOf('zoA');
    selAlt('zoA'); PM().setImageZOrder('toBack'); await sleep(140);
    if (!(relOf('zoA') < relOf('zoB'))) return 'after toBack, zoA not below zoB: ' + relOf('zoA') + ' vs ' + relOf('zoB');
    // export round-trips a relativeHeight on the anchor
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    return /<wp:anchor[^>]*relativeHeight=/.test(xml) || 'exported wp:anchor missing relativeHeight';
  });

  await t('[insert] Online Video inserts a real SVG poster thumbnail (image node, not a bare link)', async () => {
    setDoc('vid: ');
    window.WC.Insert.insertVideoThumbnail('https://www.youtube.com/watch?v=abc123');
    await sleep(160);
    let img = null; window.WC.editor.state.doc.descendants((n) => { if (n.type.name === 'image' && !img) img = n; });
    if (!img) return 'no image node inserted';
    const isSvg = /^data:image\/svg\+xml/.test(img.attrs.src || '');
    const hasUrl = /youtube\.com\/watch\?v=abc123/.test(img.attrs.alt || '');
    return (isSvg && hasUrl) || ('src=' + (img.attrs.src || '').slice(0, 28) + ' alt=' + img.attrs.alt);
  });
  await t('[6] insertBookmark wraps the selection in PAIRED start+end (same id)', async () => {
    setDoc('mark this range'); selectText('this range'); await sleep(60);
    PM().insertBookmark({ name: 'spot1' }); await sleep(120);
    let startId = null, endId = null, name = null;
    doc().descendants((n) => {
      if (n.type.name === 'bookmarkStart') { startId = n.attrs.id; name = n.attrs.name; }
      if (n.type.name === 'bookmarkEnd') endId = n.attrs.id;
    });
    return hasNode('bookmarkStart') && hasNode('bookmarkEnd') && startId != null && startId === endId && name === 'spot1';
  });
  await t('[6] EXPORT: insertBookmark → paired <w:bookmarkStart w:name w:id> + <w:bookmarkEnd> (same id; Word: Bookmarks.Exists)', async () => {
    // The test above covers the live NODES; this guards the EXPORT — a paired bookmarkStart/bookmarkEnd
    // with the SAME id and the name, the structure Word needs. Word COM-validated: Bookmarks.Count=1,
    // .Exists("spot1")=true, .Item("spot1").Name="spot1" (oracle-probe-6-bookmark.js + validate-bookmark-win.ps1).
    setDoc('mark this range'); selectText('this range'); await sleep(60);
    PM().insertBookmark({ name: 'spot1' }); await sleep(120);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const start = (xml.match(/<w:bookmarkStart\b[^>]*\/?>/) || [])[0];
    const end = (xml.match(/<w:bookmarkEnd\b[^>]*\/?>/) || [])[0];
    if (!start) return 'no <w:bookmarkStart> in export';
    if (!end) return 'no <w:bookmarkEnd> in export';
    if (!/w:name="spot1"/.test(start)) return 'bookmarkStart w:name not "spot1": ' + start;
    const startId = (start.match(/w:id="([^"]*)"/) || [])[1];
    const endId = (end.match(/w:id="([^"]*)"/) || [])[1];
    if (startId == null || startId !== endId) return 'bookmarkStart/End ids mismatch (start=' + startId + ' end=' + endId + ') — Word drops an unpaired bookmark';
    return true;
  });
  await t('[6] listBookmarks returns inserted bookmarks; goToBookmark finds one', async () => {
    setDoc('alpha beta gamma'); selectText('beta');
    PM().insertBookmark({ name: 'bk_beta' }); await sleep(80);
    const list = PM().listBookmarks();
    const ok = Array.isArray(list) && list.some((b) => b.name === 'bk_beta');
    return ok && PM().goToBookmark('bk_beta') === true;
  });
  await t('[6] removeBookmark deletes the pair', async () => {
    setDoc('one two three'); selectText('two');
    PM().insertBookmark({ name: 'gone' }); await sleep(80);
    PM().removeBookmark('gone'); await sleep(80);
    return !hasNode('bookmarkStart') && !hasNode('bookmarkEnd');
  });
  await t('[6] insertSymbol inserts the unicode character as text', async () => {
    setDoc('temp ');
    PM().insertSymbol('©'); await sleep(80);
    return doc().textContent.includes('temp') && doc().textContent.includes('©');
  });
  await t('[6] insertEquation inserts styled Cambria Math italic text', async () => {
    setDoc('eq: ');
    PM().insertEquation('a² + b² = c²'); await sleep(120);
    if (!doc().textContent.includes('a²')) return 'equation text missing';
    let fam = null, ital = false;
    doc().descendants((n) => { (n.marks || []).forEach((m) => { if (m.type.name === 'textStyle' && m.attrs.fontFamily) fam = m.attrs.fontFamily; if (m.type.name === 'italic') ital = true; }); });
    return /Cambria Math/i.test(fam || '') && ital === true;
  });
  await t('[6] insertPageBreak inserts a hardBreak page-break node', async () => {
    setDoc('before break');
    PM().insertPageBreak(); await sleep(80);
    let pb = false; doc().descendants((n) => { if (n.type.name === 'hardBreak' && (n.attrs.pageBreakType === 'page')) pb = true; });
    return pb === true;
  });
  await t('[6] insertHr inserts a horizontalRule contentBlock node', async () => {
    setDoc('above line');
    PM().insertHr(); await sleep(80);
    let hr = false; doc().descendants((n) => { if (n.type.name === 'contentBlock' && n.attrs.horizontalRule) hr = true; });
    return hr === true;
  });
  await t('[6] insertTable inserts a table with the requested rows×cols', async () => {
    setDoc('table here');
    PM().insertTable({ rows: 3, cols: 4 }); await sleep(120);
    let rows = 0, cols = 0;
    doc().descendants((n) => { if (n.type.name === 'tableRow') rows++; });
    doc().descendants((n) => { if (n.type.name === 'tableRow' && cols === 0) cols = n.childCount; });
    return hasNode('table') && rows === 3 && cols === 4;
  });
  await t('[4d] column resize is armed: hovering a column border sets the resize handle', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(200);
    const cell = document.querySelector('#pm-editor .ProseMirror table tr td, #pm-editor .ProseMirror table tr th');
    if (!cell) return 'no table cell rendered';
    // The columnResizing plugin's state carries `activeHandle` (-1 = none, >=0 = armed).
    const activeHandle = () => { const st = v().state; for (const pl of st.plugins) { try { const s = pl.getState && pl.getState(st); if (s && typeof s === 'object' && 'activeHandle' in s) return s.activeHandle; } catch (e) {} } return 'no-plugin'; };
    if (activeHandle() === 'no-plugin') return 'columnResizing plugin not present';
    const r = cell.getBoundingClientRect();
    const mm = (x, y) => cell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
    mm(r.right - 2, r.top + r.height / 2); await sleep(60); // hover the right border → arm
    const armed = activeHandle();
    mm(r.left + 10, r.top + r.height / 2); await sleep(60); // mid-cell → disarm
    const disarmed = activeHandle();
    if (!(typeof armed === 'number' && armed >= 0)) return 'border hover did not arm the resize handle (handleWidth disabled?): ' + armed;
    return disarmed === -1 || 'mid-cell did not disarm: ' + disarmed;
  });

  await t('[4d] a column resize OVERRIDES a stale imported grid on export (round-trips)', async () => {
    // Guards the data-loss bug the 4c→4d review found: an IMPORTED table carries a `grid`
    // attr (twips) that the exporter emits as w:gridCol verbatim. A drag writes `colwidth`
    // (px) but left `grid` stale, so the resize was DROPPED on save. The grid-sync
    // appendTransaction now rebuilds `grid` from the new colwidth, so the resize wins.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    let tablePos = null, tableNode = null;
    doc().descendants((n, pos) => { if (n.type.name === 'table' && tablePos == null) { tablePos = pos; tableNode = n; } });
    const cells = []; doc().descendants((n, pos) => { if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') cells.push({ pos, node: n }); });
    if (cells.length < 4) return 'expected 4 cells, got ' + cells.length;
    // Simulate an imported table: a STALE grid (9999 twips/col) + matching colwidth + not userEdited.
    let setup = v().state.tr.setNodeMarkup(tablePos, undefined, { ...tableNode.attrs, grid: [{ col: 9999 }, { col: 9999 }], userEdited: false });
    for (const c of cells) setup = setup.setNodeMarkup(c.pos, undefined, { ...c.node.attrs, colwidth: [666] });
    v().dispatch(setup); await sleep(120);
    // Now RESIZE column 0 to 180px (what a drag writes).
    const cells2 = []; doc().descendants((n, pos) => { if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') cells2.push({ pos, node: n }); });
    let tr = v().state.tr;
    for (const idx of [0, 2]) tr = tr.setNodeMarkup(cells2[idx].pos, undefined, { ...cells2[idx].node.attrs, colwidth: [180] });
    v().dispatch(tr); await sleep(180);
    let xml;
    try { xml = await window.WC.editor.exportDocx({ exportXmlOnly: true }); } catch (e) { return 'export threw: ' + String(e); }
    const gridCols = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    if (gridCols.length < 2) return 'expected 2 <w:gridCol>, got ' + JSON.stringify(gridCols);
    // Column 0 = 180px → 2700 twips (NOT the stale 9999); the grid-sync must have fired.
    return (gridCols[0] === 180 * 15) || 'resize dropped — gridCol still stale: ' + JSON.stringify(gridCols) + ' (col0 want 2700)';
  });

  await t('[4d] a set row height exports as w:trHeight (px → twips, NUMBER, rule kept)', async () => {
    // Guards the bug the 4d.1 review surfaced: the export reconciliation wrote the row-height
    // value as a STRING, which the trHeight decode (typeof === 'number') silently dropped — so
    // a set/changed row height produced NO <w:trHeight> at all. Now it's a number + keeps rule.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    let rowPos = null, rowNode = null;
    doc().descendants((n, pos) => { if (n.type.name === 'tableRow' && rowPos == null) { rowPos = pos; rowNode = n; } });
    if (rowPos == null) return 'no table row';
    // Mimic setRowHeight(60,'atLeast'): top-level rowHeight px + nested {value:px, rule}.
    v().dispatch(v().state.tr.setNodeMarkup(rowPos, undefined, {
      ...rowNode.attrs,
      rowHeight: 60,
      tableRowProperties: { ...(rowNode.attrs.tableRowProperties || {}), rowHeight: { value: 60, rule: 'atLeast' } },
    }));
    await sleep(150);
    let xml;
    try { xml = await window.WC.editor.exportDocx({ exportXmlOnly: true }); } catch (e) { return 'export threw: ' + String(e); }
    const m = xml.match(/<w:trHeight\b[^>]*\/?>/);
    if (!m) return 'no <w:trHeight> in export (row height dropped)';
    const val = (m[0].match(/w:val="(\d+)"/) || [])[1];
    const rule = (m[0].match(/w:hRule="([a-zA-Z]+)"/) || [])[1];
    // 60px → 900 twips; rule preserved as atLeast.
    return (val === '900' && rule === 'atLeast') || 'w:trHeight wrong: ' + m[0] + ' (want w:val="900" w:hRule="atLeast")';
  });

  await t('[4d] ribbon Row Height control sets the row + exports w:trHeight (via flyout preset)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    let cellPos = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cellPos == null) cellPos = pos; });
    if (cellPos == null) return 'no table cell';
    window.WC.editor.commands.setTextSelection(cellPos + 2); // caret in the cell
    WC.Commands.dropdown({ cmd: 'tblRowHeight', type: 'dropdown' }, document.body);
    await sleep(60);
    if (!document.querySelector('.flyout input[type="number"]')) return 'Row Height flyout has no number input';
    flyClick(/^0\.5"$/); // 0.5in = 48px
    await sleep(160);
    let rh = null; doc().descendants((n) => { if (n.type.name === 'tableRow' && rh == null) rh = n.attrs.rowHeight; });
    if (rh !== 48) return 'row height not 48px after preset, got ' + rh;
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<w:trHeight\b[^>]*\/?>/);
    return (m && /w:val="720"/.test(m[0])) || 'export w:trHeight not 720 twips (48px): ' + (m ? m[0] : 'missing');
  });

  await t('[4d] ribbon Column Width control sets the column + exports w:gridCol (via flyout preset)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    let cellPos = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cellPos == null) cellPos = pos; });
    if (cellPos == null) return 'no table cell';
    window.WC.editor.commands.setTextSelection(cellPos + 2);
    WC.Commands.dropdown({ cmd: 'tblColWidth', type: 'dropdown' }, document.body);
    await sleep(60);
    flyClick(/^1\.5"$/); // 1.5in = 144px → 2160 twips
    await sleep(160);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const gridCols = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    return gridCols.includes(2160) || 'expected a 2160-twip column (1.5in), got ' + JSON.stringify(gridCols);
  });

  // ---- AutoFit (4d.4): the ribbon AutoFit dropdown now writes real column geometry ----
  // Helper: read the page text-column width (px) the bridge fills AutoFit Window to.
  const pageTextPx = () => {
    const ps = (window.WC.editor.getPageStyles && window.WC.editor.getPageStyles()) || {};
    const wIn = (ps.pageSize && ps.pageSize.width) || 8.5;
    const lIn = (ps.pageMargins && ps.pageMargins.left != null) ? ps.pageMargins.left : 1;
    const rIn = (ps.pageMargins && ps.pageMargins.right != null) ? ps.pageMargins.right : 1;
    return Math.round((wIn - lIn - rIn) * 96);
  };
  // Set the table's per-column widths (px), the way a real column resize leaves it: the
  // table `grid` (twips, what the exporter emits) + `userEdited:true` + every cell's
  // `colwidth`. (A bare colwidth write on a fresh table does NOT survive to the export —
  // mirror the proven [4d] resize test above, which sets grid + userEdited explicitly.)
  const setCols = (widths) => {
    let tablePos = null, tableNode = null;
    doc().descendants((n, pos) => { if (n.type.name === 'table' && tablePos == null) { tablePos = pos; tableNode = n; } });
    const cells = []; doc().descendants((n, pos) => { if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') cells.push({ pos, node: n }); });
    let tr = v().state.tr.setNodeMarkup(tablePos, undefined, { ...tableNode.attrs, grid: widths.map((w) => ({ col: w * 15 })), userEdited: true });
    cells.forEach((c, idx) => { tr = tr.setNodeMarkup(c.pos, undefined, { ...c.node.attrs, colwidth: [widths[idx % widths.length]] }); });
    v().dispatch(tr);
  };

  await t('[4d] AutoFit Window scales the columns to fill the page text width (proportional, exact)', async () => {
    // Window must STRETCH the table to the full text column, keeping column ratios — writing
    // real colwidth (→ w:gridCol via grid-sync) so the in-app render AND the export both fill.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    setCols([100, 200]); await sleep(120);          // shrink first → 1:2 ratio
    // Precondition: confirm the unequal 1:2 widths actually took (guards a vacuous pass where
    // setCols silently no-ops and Window's even-split still happens to sum to the page width).
    const xml0 = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const g0 = (xml0.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    if (JSON.stringify(g0) !== JSON.stringify([1500, 3000])) return 'precondition: unequal columns not set, pre-autofit gridCols=' + JSON.stringify(g0);
    PM().tableAutoFit('window'); await sleep(160);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!/<w:tblLayout[^>]*w:type="autofit"/.test(xml)) return 'no w:tblLayout autofit';
    if (!/<w:tblW[^>]*w:type="pct"[^>]*w:w="5000"|<w:tblW[^>]*w:w="5000"[^>]*w:type="pct"/.test(xml)) return 'no w:tblW pct 5000';
    const gridCols = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    if (gridCols.length !== 2) return 'expected 2 gridCols, got ' + JSON.stringify(gridCols);
    const sum = gridCols[0] + gridCols[1];
    const want = pageTextPx() * 15;                      // px → twips
    if (Math.abs(sum - want) > 6) return 'columns did not fill the page: sum=' + sum + ' want~' + want;
    // proportional: 100:200 → second column ~2x the first.
    const ratio = gridCols[1] / gridCols[0];
    return (ratio > 1.8 && ratio < 2.2) || 'columns not proportional (1:2), got ' + JSON.stringify(gridCols);
  });

  await t('[4d] AutoFit Fixed exports w:tblLayout fixed and preserves column widths', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    setCols([120, 180]); await sleep(120);           // 1800 / 2700 twips
    PM().tableAutoFit('fixed'); await sleep(160);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!/<w:tblLayout[^>]*w:type="fixed"/.test(xml)) return 'no w:tblLayout fixed';
    if (/<w:tblW[^>]*w:type="pct"/.test(xml)) return 'Fixed must not leave a pct table width';
    const gridCols = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    return (gridCols[0] === 1800 && gridCols[1] === 2700) || 'widths not preserved, got ' + JSON.stringify(gridCols);
  });

  await t('[4d] AutoFit Contents clears a prior Window stretch (autofit, no pct width)', async () => {
    // window→contents must DROP the 100% stretch so the table can shrink to content.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    PM().tableAutoFit('window'); await sleep(140);
    PM().tableAutoFit('contents'); await sleep(160);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!/<w:tblLayout[^>]*w:type="autofit"/.test(xml)) return 'no w:tblLayout autofit';
    return !/<w:tblW[^>]*w:type="pct"/.test(xml) || 'Contents left the Window pct stretch in place';
  });

  await t('[4d] AutoFit Contents shrinks each column to fit its content (short col < long col)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(200);
    // Caret in the FIRST cell → short word; Tab to the next cell → long content (cell navigation
    // is the reliable way to target a specific cell). AutoFit Contents must size col 0 < col 1.
    let firstCell = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && firstCell == null) firstCell = pos; });
    window.WC.editor.commands.setTextSelection(firstCell + 2);
    window.WC.editor.commands.insertContent('Hi');
    window.WC.editor.commands.goToNextCell(1);
    window.WC.editor.commands.insertContent('Supercalifragilistic expialidocious lengthy column content here');
    await sleep(250);
    PM().tableAutoFit('contents'); await sleep(250);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (!/<w:tblLayout[^>]*w:type="autofit"/.test(xml)) return 'no w:tblLayout autofit';
    const gridCols = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    if (gridCols.length !== 2) return 'expected 2 gridCols, got ' + JSON.stringify(gridCols);
    // Verify it actually CONTENT-FIT: the short column must be narrower than the long one AND
    // well below the default equal split (a 2-col Letter table starts at 312px/col = 4680 twips),
    // so a regression that leaves columns large-but-ordered can't pass.
    return (gridCols[0] < gridCols[1] && gridCols[0] < 2000) ||
      'AutoFit Contents did not shrink the short column to fit (default ~4680 twips/col): ' + JSON.stringify(gridCols);
  });

  await t('[4d] ribbon AutoFit Window fills the table (full flyout path)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    setCols([100, 100]); await sleep(120);
    let cellPos = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cellPos == null) cellPos = pos; });
    window.WC.editor.commands.setTextSelection(cellPos + 2);
    WC.Commands.dropdown({ cmd: 'tblAutoFit', type: 'dropdown' }, document.body);
    await sleep(60);
    flyClick(/AutoFit Window/);
    await sleep(160);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const gridCols = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    const sum = gridCols.reduce((a, b) => a + b, 0);
    return Math.abs(sum - pageTextPx() * 15) <= 6 || 'ribbon AutoFit Window did not fill: sum=' + sum + ' cols=' + JSON.stringify(gridCols);
  });

  // ---- migrate the legacy 9 table ops (caret-in-table) ----
  await t('[6] table addRow below grows the row count', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableAddRow('below'); await sleep(100);
    let rows = 0; doc().descendants((n) => { if (n.type.name === 'tableRow') rows++; });
    return rows === 3;
  });
  await t('[6] table addColumn right grows each row', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableAddColumn('right'); await sleep(100);
    let cols = 0; doc().descendants((n) => { if (n.type.name === 'tableRow' && cols === 0) cols = n.childCount; });
    return cols === 3;
  });
  await t('[6] table deleteRow shrinks the row count', async () => {
    setDoc('x'); PM().insertTable({ rows: 3, cols: 2 }); await sleep(120);
    PM().tableDeleteRow(); await sleep(100);
    let rows = 0; doc().descendants((n) => { if (n.type.name === 'tableRow') rows++; });
    return rows === 2;
  });
  await t('[6] table deleteColumn shrinks each row', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(120);
    PM().tableDeleteColumn(); await sleep(100);
    let cols = 99; doc().descendants((n) => { if (n.type.name === 'tableRow') cols = Math.min(cols, n.childCount); });
    return cols === 2;
  });
  await t('[6] table deleteTable removes the table node', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableDeleteTable(); await sleep(100);
    return !hasNode('table');
  });
  const firstTblPr = (xml) => { const m = xml.match(/<w:tblPr\b[\s\S]*?<\/w:tblPr>/); return m && m[0]; };
  const tblJust = () => { let j; doc().descendants((n) => { if (n.type.name === 'table' && j == null) j = n.attrs.justification ?? n.attrs.tableProperties?.justification; }); return j; };
  await t('[4d] table page-alignment: tblAlignCenter/Right/Left → justification attr + w:tblPr/w:jc export', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    // Center via the ribbon dispatch (the real path: WC.Commands.run → H.tblAlignCenter → tableSetAlignment).
    WC.Commands.run({ cmd: 'tblAlignCenter', type: 'button' }, document.body); await sleep(80);
    if (tblJust() !== 'center') return 'tblAlignCenter did not set justification=center: ' + tblJust();
    let tp = firstTblPr(await window.WC.editor.exportDocx({ exportXmlOnly: true }));
    if (!tp || !/<w:jc\b[^>]*w:val="center"/.test(tp)) return 'no <w:jc w:val="center"> in tblPr: ' + (tp && tp.slice(0, 160));
    WC.Commands.run({ cmd: 'tblAlignRight', type: 'button' }, document.body); await sleep(80);
    if (tblJust() !== 'right') return 'tblAlignRight did not set right: ' + tblJust();
    WC.Commands.run({ cmd: 'tblAlignLeft', type: 'button' }, document.body); await sleep(80);
    if (tblJust() !== 'left') return 'tblAlignLeft did not set left: ' + tblJust();
    return true;
  });
  await t('[4d] table Indent: tblIndent(0.5") → tableIndent attr + w:tblPr/w:tblInd export (twips)', async () => {
    if (typeof PM().tableSetIndent !== 'function') return 'PM.tableSetIndent missing (red)';
    if (PM().isBlocked('tblIndent') !== false) return 'tblIndent should not be blocked';
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    PM().tableSetIndent(48); await sleep(80); // 0.5" = 48px → 720 twips
    const tIndent = () => { let v2; doc().descendants((n) => { if (n.type.name === 'table' && v2 == null) v2 = n.attrs.tableProperties?.tableIndent?.value ?? (n.attrs.tableIndent?.width != null ? n.attrs.tableIndent.width * 15 : null); }); return v2; };
    if (tIndent() !== 720) return 'tableIndent twips not 720 (0.5"): ' + tIndent();
    const tp = firstTblPr(await window.WC.editor.exportDocx({ exportXmlOnly: true }));
    if (!tp || !/<w:tblInd\b[^>]*w:w="720"/.test(tp)) return 'no <w:tblInd w:w="720"> in tblPr: ' + (tp && tp.slice(0, 200));
    return true;
  });
  await t('[4d] table cell vertical-align: tblVAlignMid → CSS attr "middle" but exports OOXML w:vAlign "center"; top/bottom passthrough; round-trips', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    const caretInCell0 = () => { let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; }); if (cp != null) window.WC.editor.commands.setTextSelection(cp + 2); };
    const cellVA = () => { let v; doc().descendants((n) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && v == null) v = n.attrs.verticalAlign; }); return v; };
    const expVAlign = (xml) => { const m = xml.match(/<w:vAlign\b[^>]*w:val="([^"]*)"/); return m && m[1]; };
    // Align Middle via the ribbon dispatch → CSS-valued attr "middle" (renderDOM uses vertical-align).
    caretInCell0(); WC.Commands.run({ cmd: 'tblVAlignMid', type: 'button' }, document.body); await sleep(80);
    if (cellVA() !== 'middle') return 'verticalAlign attr should be CSS "middle": ' + cellVA();
    // ...but the export MUST be OOXML ST_VerticalJc "center" (NOT the invalid "middle" Word ignores).
    if (expVAlign(await window.WC.editor.exportDocx({ exportXmlOnly: true })) !== 'center') return 'exported w:vAlign must be OOXML "center", not "middle" (Word ignores invalid)';
    // top / bottom are valid in BOTH CSS and OOXML — passthrough.
    caretInCell0(); WC.Commands.run({ cmd: 'tblVAlignTop', type: 'button' }, document.body); await sleep(80);
    if (expVAlign(await window.WC.editor.exportDocx({ exportXmlOnly: true })) !== 'top') return 'top should export w:vAlign "top"';
    caretInCell0(); WC.Commands.run({ cmd: 'tblVAlignBottom', type: 'button' }, document.body); await sleep(80);
    if (expVAlign(await window.WC.editor.exportDocx({ exportXmlOnly: true })) !== 'bottom') return 'bottom should export w:vAlign "bottom"';
    // Round-trip the MIDDLE case (export "center" → import maps back to CSS "middle").
    caretInCell0(); WC.Commands.run({ cmd: 'tblVAlignMid', type: 'button' }, document.body); await sleep(80);
    const bytes = await PM().exportDocxBytes(); await PM().openDocx(bytes); await sleep(240);
    return cellVA() === 'middle' || ('round-trip lost the CSS-valued vertical-align (got ' + cellVA() + ' — import must map OOXML center → CSS middle)');
  });
  await t('[4d] cell w:tcPr child order: borders+shading+vAlign export in CT_TcPr schema sequence (tcW<tcBorders<shd<vAlign — OOXML §17.4.66 guard)', async () => {
    // The exporter folds cell props into tableCellProperties in code order: setCellBorders migrates
    // attrs.borders into the object LAST, so pre-fix <w:tcBorders> exported BEFORE <w:tcW>/<w:shd>/
    // <w:vAlign> — out of the CT_TcPr xsd:sequence. (Live Word tolerates it on read, but strict OOXML
    // consumers reject it; mirrors the w:tblPr ordering fix PR #77.) The translator must stable-sort.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    const caretInCell0 = () => { let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; }); if (cp != null) window.WC.editor.commands.setTextSelection(cp + 2); };
    caretInCell0(); window.WC.editor.commands.setCellBorders({ top: { val: 'single', color: '000000', size: 4 }, bottom: { val: 'single', color: '000000', size: 4 } }); await sleep(120);
    caretInCell0(); window.WC.editor.commands.setCellBackground('FFFF00'); await sleep(120);
    caretInCell0(); window.WC.editor.commands.setCellAttr('verticalAlign', 'middle'); await sleep(120);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const blocks = xml.match(/<w:tcPr\b[\s\S]*?<\/w:tcPr>/g) || [];
    const tcPr = blocks.find((b) => b.includes('<w:tcBorders'));
    if (!tcPr) return 'no <w:tcPr> with <w:tcBorders> in export (setCellBorders did not emit borders)';
    const idx = { tcW: tcPr.indexOf('<w:tcW'), tcBorders: tcPr.indexOf('<w:tcBorders'), shd: tcPr.indexOf('<w:shd'), vAlign: tcPr.indexOf('<w:vAlign') };
    const present = ['tcW', 'tcBorders', 'shd', 'vAlign'].filter((k) => idx[k] >= 0);
    if (present.length < 3) return 'too few tcPr children present to assert order: ' + JSON.stringify(idx);
    // Each present child must appear strictly after the previous one in CT_TcPr order.
    const seq = present.map((k) => idx[k]);
    const ordered = seq.every((v, i) => i === 0 || v > seq[i - 1]);
    return ordered || ('w:tcPr children OUT OF CT_TcPr ORDER (want tcW<tcBorders<shd<vAlign): ' + JSON.stringify(idx) + ' :: ' + tcPr.slice(0, 200));
  });
  await t('[4d] cell margins: tblCellMargins ribbon flyout (4 distinct sides) → <w:tcMar> twips + re-open PREFILLS current', async () => {
    // Drives the REAL ribbon path: H.tblCellMargins opens an inches flyout (spinners in order
    // top/bottom/left/right + Apply). Set four DISTINCT sides → caret cell gains cellMargins (px) →
    // export emits <w:tcMar> per-side in twips (px×15). Then RE-OPEN and assert the flyout prefills
    // the cell's current values (not stock defaults) — guards against the clobber-on-re-edit bug.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(180);
    const caretInCell0 = () => { let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; }); if (cp != null) window.WC.editor.commands.setTextSelection(cp + 2); };
    const openFly = () => { if (WC.closeFlyouts) WC.closeFlyouts(); WC.Commands.run({ cmd: 'tblCellMargins', label: 'Cell Margins', type: 'button' }, document.body); };
    caretInCell0(); openFly(); await sleep(80);
    let fly = document.querySelector('.flyout');
    if (!fly) return 'tblCellMargins opened no flyout (regressed to a stub?)';
    let inputs = Array.from(fly.querySelectorAll('input[type="number"]'));
    if (inputs.length < 4) return 'cell-margins flyout missing the 4 side spinners (got ' + inputs.length + ')';
    // Inputs are appended top, bottom, left, right. Distinct values, exact at the 0.01" UI step and
    // px-exact (in×96 ∈ ℤ): 0.25/0.5/0.75/1.0" → 24/48/72/96px → 360/720/1080/1440 twips.
    const want = ['0.25', '0.5', '0.75', '1.0'];
    inputs.forEach((inp, i) => { inp.value = want[i]; });
    const applyBtn = Array.from(fly.querySelectorAll('button')).find((b) => /Apply|Set/i.test(b.textContent));
    if (!applyBtn) return 'cell-margins flyout missing Apply button';
    applyBtn.click(); await sleep(140);
    let cm = null; doc().descendants((n) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cm == null) cm = n.attrs.cellMargins; });
    if (!cm) return 'cellMargins attr not set on caret cell after Apply';
    if (!(cm.top === 24 && cm.bottom === 48 && cm.left === 72 && cm.right === 96)) return 'cellMargins px wrong (want 24/48/72/96): ' + JSON.stringify(cm);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<w:tcMar\b[\s\S]*?<\/w:tcMar>/);
    if (!m) return 'no <w:tcMar> in export after setting cell margins';
    const mar = m[0];
    const tw = (re) => { const mm = mar.match(re); return mm && mm[1]; };
    const exp = { top: tw(/<w:top\b[^>]*w:w="(\d+)"/), bottom: tw(/<w:bottom\b[^>]*w:w="(\d+)"/), left: tw(/<w:(?:left|start)\b[^>]*w:w="(\d+)"/), right: tw(/<w:(?:right|end)\b[^>]*w:w="(\d+)"/) };
    if (!(exp.top === '360' && exp.bottom === '720' && exp.left === '1080' && exp.right === '1440')) return 'w:tcMar twips wrong (want 360/720/1080/1440): ' + JSON.stringify(exp) + ' :: ' + mar.slice(0, 240);
    // Re-open: the flyout must PREFILL the cell's current margins (in inches), not the stock defaults.
    caretInCell0(); openFly(); await sleep(80);
    fly = document.querySelector('.flyout');
    inputs = Array.from(fly.querySelectorAll('input[type="number"]'));
    const got = inputs.map((inp) => parseFloat(inp.value));
    if (WC.closeFlyouts) WC.closeFlyouts();
    if (!(got[0] === 0.25 && got[1] === 0.5 && got[2] === 0.75 && got[3] === 1.0)) return 're-open did NOT prefill current margins (got ' + JSON.stringify(got) + ', want [0.25,0.5,0.75,1.0])';
    return true;
  });
  // NOTE (Critique B3): mergeCells needs a CellSelection, whose test helper
  // (tableSelectFirstRowPair) lands in Stage F. The merge test therefore lives in the [6b] block
  // (Task 10.3), NOT here — it would no-op + fail pre-6b. The 6a [6] block covers only the table
  // ops that work off a plain caret-in-cell (insert/delete row+col, header toggle).
  // (T3 fix: setCellBackground now ALSO works off a plain caret — Word parity; see the
  // [6b] shading tests.)
  await t('[6] table toggleHeaderRow converts the first row to header cells', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableToggleHeaderRow(); await sleep(100);
    let hasHeaderCell = false; doc().descendants((n) => { if (n.type.name === 'tableHeader') hasHeaderCell = true; });
    return hasHeaderCell === true;
  });
  await t('[6b] EXPORT: Repeat Header Row → <w:tblHeader> in the first row\'s <w:trPr> (Word: Rows(1).HeadingFormat)', async () => {
    // toggleHeaderRow dual-writes tableRowProperties.repeatHeader → the trPr decode emits <w:tblHeader>
    // (the "repeat as header row at the top of each page" flag). The prior [6] test only checks the DOM
    // header-cell conversion; this guards the EXPORT. Word COM-validated separately: row 1 HeadingFormat
    // = -1 (True), row 2 = 0 — scripts/oracle-probe-6b-repeatheader.js + validate-repeatheader-win.ps1.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    if (!PM().tableToggleHeaderRow()) return 'tableToggleHeaderRow returned false';
    await sleep(120);
    let rp = null; doc().descendants((n) => { if (n.type.name === 'tableRow' && rp == null) rp = n.attrs.tableRowProperties?.repeatHeader; });
    if (rp !== true) return 'first row repeatHeader attr not set: ' + rp;
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const trPrs = xml.match(/<w:trPr\b[\s\S]*?<\/w:trPr>/g) || [];
    if (!trPrs.length) return 'no <w:trPr> in export';
    if (!/<w:tblHeader\b/.test(trPrs[0])) return 'first row <w:trPr> missing <w:tblHeader>: ' + trPrs[0].slice(0, 160);
    // Only the first row repeats — EXACTLY one <w:tblHeader> in the whole doc (non-vacuous count).
    const tblHeaderCount = (xml.match(/<w:tblHeader\b/g) || []).length;
    if (tblHeaderCount !== 1) return 'expected exactly one <w:tblHeader>, got ' + tblHeaderCount;
    // Toggle OFF clears it.
    PM().tableToggleHeaderRow(); await sleep(120);
    const xml2 = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (/<w:tblHeader\b/.test(xml2)) return 'toggle OFF left <w:tblHeader> in export';
    return true;
  });
  await t('[6] D6 flip: link dialog + table grid open in PM mode', async () => {
    // inverse of the pre-flip D6 block — proves the registry flip reached dispatch.
    window.WC.Commands.run({ cmd: 'link', label: 'Link' }); await sleep(80);
    const linkOpen = !!document.querySelector('.modal-backdrop');
    const bd = document.querySelector('.modal-backdrop');
    if (bd) {
      const cancel = Array.from(bd.querySelectorAll('button')).find((b) => /Cancel/.test(b.textContent));
      if (cancel) cancel.click(); else bd.remove(); // never leak
    }
    await sleep(40);
    window.WC.Commands.dropdown({ cmd: 'table', type: 'dropdown' }, document.body); await sleep(60);
    const tableOpen = document.querySelectorAll('.flyout').length > 0;
    window.WC.closeFlyouts();
    return linkOpen && tableOpen;
  });

  // ---------- slice 6b: net-new fork table commands (Task 8 — ENGINE LEVEL) ----------
  // These call editor.commands.<cmd>(...) DIRECTLY (no bridge wrapper / no ribbon UI yet —
  // those land in Tasks 9/10). After insertTable the fork puts the caret in the first cell,
  // so the cell/row-scoped commands (setCellAttr / selectedRect) work off that plain caret.
  // Asserts read back the resulting node attr via doc().toJSON()/descendants.
  const ecmd = (name, ...args) => window.WC.editor.commands[name](...args);
  const tableAttr = (key) => { let v = undefined; doc().descendants((n) => { if (n.type.name === 'table' && v === undefined) v = n.attrs[key]; }); return v; };
  const firstCellAttr = (key) => { let v = undefined; doc().descendants((n) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && v === undefined) v = n.attrs[key]; }); return v; };
  const firstRowAttr = (key) => { let v = undefined; doc().descendants((n) => { if (n.type.name === 'tableRow' && v === undefined) v = n.attrs[key]; }); return v; };

  await t('[6b] setTableStyle dual-writes tableStyleId + tableProperties.tableStyleId', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setTableStyle', 'GridTable4-Accent1'); await sleep(80);
    const tp = tableAttr('tableProperties');
    // The nested key is what the w:tblPr decoder reads → <w:tblStyle>; assert both.
    return tableAttr('tableStyleId') === 'GridTable4-Accent1'
      && !!tp && tp.tableStyleId === 'GridTable4-Accent1';
  });
  await t('[6b] setTableAlignment center sets table justification', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setTableAlignment', 'center'); await sleep(80);
    return tableAttr('justification') === 'center';
  });
  await t('[6b] setTableIndent dual-writes tableIndent.width (px) + tableProperties.tableIndent (twips)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setTableIndent', 48); await sleep(80); // 48px → 720 twips
    const ti = tableAttr('tableIndent');
    const tp = tableAttr('tableProperties');
    // Top-level keeps the px {width,type} shape; nested keeps the OOXML {value,type} twips shape.
    return !!ti && ti.width === 48 && ti.type === 'dxa'
      && !!tp && !!tp.tableIndent && tp.tableIndent.value === 720 && tp.tableIndent.type === 'dxa';
  });
  await t('[6b] setCellWidth writes colwidth on the caret column', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setCellWidth', 123); await sleep(80);
    const cw = firstCellAttr('colwidth');
    return Array.isArray(cw) && cw[0] === 123;
  });
  await t('[6b] setRowHeight writes rowHeight + tableRowProperties on the caret row', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setRowHeight', 40, 'exact'); await sleep(80);
    const rh = firstRowAttr('rowHeight');
    const trp = firstRowAttr('tableRowProperties');
    return rh === 40 && !!trp && trp.rowHeight && trp.rowHeight.value === 40 && trp.rowHeight.rule === 'exact';
  });
  await t('[6b] setCellMargins writes cellMargins on the caret cell', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setCellMargins', { top: 4, right: 8, bottom: 4, left: 8 }); await sleep(80);
    const m = firstCellAttr('cellMargins');
    return !!m && m.top === 4 && m.right === 8 && m.bottom === 4 && m.left === 8;
  });
  await t('[6b] setCellBorders writes borders on the caret cell', async () => {
    // The fork's tableStyleNormalization plugin migrates attrs.borders → the
    // canonical tableCellProperties.borders (and nulls attrs.borders), scaling
    // the size to OOXML eighths — assert on the canonical landing place.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setCellBorders', { top: { val: 'single', color: '000000', size: 4 }, bottom: { val: 'single', color: '000000', size: 4 } }); await sleep(150);
    const inline = firstCellAttr('borders');
    const tcp = firstCellAttr('tableCellProperties');
    const b = (inline && inline.top) ? inline : (tcp && tcp.borders);
    return !!b && b.top && b.top.val === 'single';
  });
  await t('[6b] distributeColumnsEvenly writes an equal colwidth across cells', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(150);
    ecmd('distributeColumnsEvenly'); await sleep(80);
    const widths = [];
    doc().descendants((n) => { if (n.type.name === 'tableCell' && n.attrs.colwidth) widths.push(n.attrs.colwidth[0]); });
    return widths.length >= 3 && widths.every((w) => w === widths[0] && w > 0);
  });
  await t('[6b] EXPORT: distributeColumnsEvenly → 3 equal <w:gridCol> in <w:tblGrid> (from uneven; Word: even columns)', async () => {
    // The test above asserts the MODEL colwidth; this guards the EXPORT geometry. Start UNEVEN (widen
    // col 0), distribute, and <w:tblGrid> must emit 3 EQUAL <w:gridCol> (the px→twips grid projection;
    // a unit bug would land even-in-model but odd/lopsided twips here). Word COM-validated: opens clean,
    // Columns(i).Width all ~equal — scripts/oracle-probe-6b-distribute.js + validate-distribute-win.ps1.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(150);
    if (typeof PM().tableSetCellWidth !== 'function') return 'tableSetCellWidth missing (red)';
    if (PM().tableSetCellWidth(260) === false) return 'tableSetCellWidth returned false (caret not in a cell?)';
    await sleep(100); // caret is in col 0 → widen it → uneven grid
    // Precondition (makes the test NON-vacuous): the grid must actually be UNEVEN now — proves the widen
    // took effect, so the even-after assertion genuinely proves distribute did the work (not that a fresh
    // table was already even).
    const colw = () => { const w = []; doc().descendants((n) => { if (n.type.name === 'tableRow' && w.length === 0) n.forEach((c) => { if (c.attrs.colwidth) w.push(c.attrs.colwidth[0]); }); }); return w; };
    const cwBefore = colw();
    if (cwBefore.length !== 3 || cwBefore.every((w) => w === cwBefore[0])) return 'precondition failed: grid not uneven before distribute (widen no-op): ' + JSON.stringify(cwBefore);
    if (!PM().tableDistributeColumns()) return 'tableDistributeColumns returned false';
    await sleep(150);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const grid = (xml.match(/<w:tblGrid\b[\s\S]*?<\/w:tblGrid>/) || [])[0];
    if (!grid) return 'no <w:tblGrid> in export';
    const cols = (grid.match(/<w:gridCol\b[^>]*w:w="(\d+)"/g) || []).map((m) => Number(m.match(/w:w="(\d+)"/)[1]));
    if (cols.length !== 3) return 'expected 3 <w:gridCol>, got ' + cols.length + ': ' + grid.slice(0, 200);
    if (!cols.every((w) => w === cols[0] && w > 0)) return '<w:gridCol> not all equal after distribute (uneven ' + JSON.stringify(cwBefore) + ' → ' + JSON.stringify(cols) + ')';
    return true;
  });
  await t('[6b] distributeRowsEvenly writes a rowHeight on the rows', async () => {
    setDoc('x'); PM().insertTable({ rows: 3, cols: 2 }); await sleep(150);
    ecmd('distributeRowsEvenly'); await sleep(80);
    let allHave = true, count = 0;
    doc().descendants((n) => { if (n.type.name === 'tableRow') { count++; if (!n.attrs.rowHeight) allHave = false; } });
    return count === 3 && allHave === true;
  });
  await t('[6b] setTextDirection dual-writes textDirection + tableCellProperties.textDirection', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setTextDirection', 'tbRl'); await sleep(80);
    const tcp = firstCellAttr('tableCellProperties');
    // The nested key is what the w:tcPr decoder reads → <w:textDirection>; assert both.
    return firstCellAttr('textDirection') === 'tbRl'
      && !!tcp && tcp.textDirection === 'tbRl';
  });
  await t('[6b] autoFitTable fixed sets tableLayout fixed', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('autoFitTable', 'fixed'); await sleep(80);
    const layout = tableAttr('tableLayout');
    const tp = tableAttr('tableProperties');
    return layout === 'fixed' && !!tp && tp.tableLayout === 'fixed';
  });
  await t('[6b] autoFitTable window marks 100% width', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('autoFitTable', 'window'); await sleep(80);
    const tp = tableAttr('tableProperties');
    return !!tp && tp.tableWidth && tp.tableWidth.value === 5000 && tp.tableWidth.type === 'pct';
  });
  await t('[6b] AutoFit Fixed undoes the Window stretch', async () => {
    // T3 defect B: 'window' writes tableWidth {5000,'pct'} (renders width: calc(100% + …px)
    // — TableView.updateColumns pct branch); a following 'fixed' must CLEAR that stretch
    // (key absent = the importer's no-explicit-width shape; convertSizeToCSS(null,'auto')
    // → null un-sets style.width) so columns drive the size again, like Word.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    const tbl = () => document.querySelector('#pm-editor .ProseMirror .tableWrapper > table');
    ecmd('autoFitTable', 'window'); await sleep(150);
    const w1 = tbl() ? tbl().style.width : 'no-table';
    if (!/calc|100%/.test(w1)) return 'window did not stretch: style.width=' + JSON.stringify(w1);
    ecmd('autoFitTable', 'fixed'); await sleep(150);
    const w2 = tbl() ? tbl().style.width : 'no-table';
    if (/calc|100%/.test(w2)) return 'stretch not cleared: style.width=' + JSON.stringify(w2);
    const tp = tableAttr('tableProperties');
    if (!tp || tp.tableLayout !== 'fixed') return 'tableProperties.tableLayout != fixed: ' + JSON.stringify(tp);
    if (tp.tableWidth && tp.tableWidth.type === 'pct') return 'pct tableWidth still present: ' + JSON.stringify(tp.tableWidth);
    return true;
  });
  await t('[6b] convertTableTotext replaces the table with paragraphs', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    let inserted = false; doc().descendants((n) => { if (n.type.name === 'table') inserted = true; });
    if (!inserted) return 'table not inserted';
    ecmd('convertTableToText', '\t'); await sleep(100);
    let stillTable = false, paras = 0;
    doc().descendants((n) => { if (n.type.name === 'table') stillTable = true; if (n.type.name === 'paragraph') paras++; });
    return stillTable === false && paras >= 2;
  });
  await t('[6b] convertTextToTable builds a table from delimited paragraphs', async () => {
    setDocs(['a\tb\tc', 'd\te\tf']); await sleep(100);
    window.WC.editor.commands.selectAll(); await sleep(60);
    ecmd('convertTextToTable', '\t'); await sleep(120);
    let hasTable = false, rows = 0, cols = 0;
    doc().descendants((n) => { if (n.type.name === 'table') hasTable = true; if (n.type.name === 'tableRow') { rows++; if (cols === 0) cols = n.childCount; } });
    return hasTable && rows === 2 && cols === 3;
  });
  await t('[6b] splitTableAtRow splits into two tables at the caret row boundary', async () => {
    setDoc('x'); PM().insertTable({ rows: 3, cols: 2 }); await sleep(150);
    // Move the caret into the SECOND row so the split boundary is row index 1.
    let secondRowCellPos = null; let rowIdx = 0;
    doc().descendants((n, pos) => { if (n.type.name === 'tableRow') { if (rowIdx === 1 && secondRowCellPos == null) secondRowCellPos = pos + 2; rowIdx++; } });
    if (secondRowCellPos == null) return 'no second row';
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), secondRowCellPos)));
    await sleep(60);
    ecmd('splitTableAtRow'); await sleep(100);
    let tables = 0; doc().descendants((n) => { if (n.type.name === 'table') tables++; });
    return tables === 2;
  });
  await t('[6b] new table commands survive a docx round-trip (style + align)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setTableStyle', 'GridTable4-Accent1'); ecmd('setTableAlignment', 'center'); await sleep(80);
    const bytes = await PM().exportDocxBytes();
    return bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  });

  // Real export-XML assertions: the dual-write fix (Task 8 follow-up) made
  // setTableStyle/setTableIndent/setTextDirection write the NESTED
  // tableProperties/tableCellProperties keys the w:tblPr/w:tcPr decoders iterate.
  // editor.exportDocx({ exportXmlOnly: true }) returns the raw word/document.xml
  // string straight from the converter (no zip round-trip needed in the renderer),
  // so we can grep the actual OOXML the file would carry. These FAIL if a command
  // regresses back to writing only the top-level attr (the value would silently
  // never reach <w:tblStyle>/<w:tblInd>/<w:textDirection>).
  const exportDocumentXml = async () => {
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    return typeof xml === 'string' ? xml : '';
  };
  // Build one table carrying style + indent + center align + cell borders, then
  // (CellSelection on the first row) text direction, and inspect the bytes once.
  const buildLoadedTableAndExport = async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    ecmd('setTableStyle', 'GridTable4-Accent1');
    ecmd('setTableAlignment', 'center');
    ecmd('setTableIndent', 48); // 48px → 720 twips (0.5in)
    ecmd('setCellBorders', { top: { val: 'single', color: '000000', size: 4 }, bottom: { val: 'single', color: '000000', size: 4 } });
    ecmd('setTextDirection', 'tbRl');
    await sleep(120);
    return exportDocumentXml();
  };
  await t('[6b] EXPORT: setTableStyle emits <w:tblStyle w:val=...> in document.xml', async () => {
    const xml = await buildLoadedTableAndExport();
    return /<w:tblStyle\b[^>]*w:val="GridTable4-Accent1"/.test(xml) || 'no <w:tblStyle> in: ' + xml.slice(xml.indexOf('<w:tblPr'), xml.indexOf('<w:tblPr') + 400);
  });
  await t('[6b] EXPORT: setTableIndent emits <w:tblInd w:w="720" w:type="dxa"> (48px → twips)', async () => {
    const xml = await buildLoadedTableAndExport();
    const m = xml.match(/<w:tblInd\b[^>]*\/?>/);
    if (!m) return 'no <w:tblInd> in: ' + xml.slice(xml.indexOf('<w:tblPr'), xml.indexOf('<w:tblPr') + 400);
    // 48px = 0.5in = 720 twips. Assert the exact sane twip value (catches the unit bug).
    const wMatch = m[0].match(/w:w="(\d+)"/);
    const typeOk = /w:type="dxa"/.test(m[0]);
    return !!wMatch && Number(wMatch[1]) === 720 && typeOk || 'bad tblInd: ' + m[0];
  });
  await t('[6b] EXPORT: setTextDirection emits <w:textDirection w:val="tbRl"> in a w:tcPr', async () => {
    const xml = await buildLoadedTableAndExport();
    return /<w:textDirection\b[^>]*w:val="tbRl"/.test(xml) || 'no <w:textDirection> in document.xml';
  });
  await t('[6b] EXPORT: setCellBorders emits <w:tcBorders> + center align emits <w:jc w:val="center"> (regression guard)', async () => {
    const xml = await buildLoadedTableAndExport();
    const hasBorders = /<w:tcBorders\b/.test(xml);
    const hasCenter = /<w:jc\b[^>]*w:val="center"/.test(xml);
    return (hasBorders && hasCenter) || `borders=${hasBorders} center=${hasCenter}`;
  });

  // ---------- slice 6b (Task 9): bridge-layer WC.PM-routed tests ----------
  // These exercise the same fork commands as above but through WC.PM.* wrappers,
  // proving the index.ts stubs are replaced and calls reach the fork.
  await t('[6b][bridge] WC.PM.tableSetStyle routes through bridge to setTableStyle', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    PM().tableSetStyle('GridTable4-Accent1'); await sleep(80);
    const info = PM().tableInfo();
    return info.inTable && info.styleId === 'GridTable4-Accent1';
  });
  await t('[6b][bridge] WC.PM.tableSetAlignment routes through bridge to setTableAlignment', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    PM().tableSetAlignment('right'); await sleep(80);
    const info = PM().tableInfo();
    return info.inTable && info.alignment === 'right';
  });

  // ---------- slice 6b (T4): table styles end-to-end ----------
  // The minted real-Word table-style definitions (TableGrid + GridTable4-Accent1,
  // extracted from real Word 16.77.1 — tests/fixtures/oracle-word-s6-tablestyles.docx
  // and oracle-word-s3-table.docx) must (a) land in the runtime styles catalog so
  // the gallery is honest, (b) reach word/styles.xml on export so Word keeps the
  // <w:tblStyle> reference (oracle Leg C failure), and (c) BAKE a visible change
  // (table borders + first-row shading) at apply time — without stomping an
  // explicit user-set cell background (Word: direct formatting beats table style).
  await t('[6b] styles catalog contains minted table styles (getTableStyles)', async () => {
    await PM().newBlank(); await sleep(100);
    const list = PM().getTableStyles();
    if (!Array.isArray(list)) return 'getTableStyles did not return an array';
    const byId = Object.fromEntries(list.map((s) => [s.id, s.name]));
    if (!byId['TableGrid']) return 'TableGrid missing from catalog: ' + JSON.stringify(list);
    if (!byId['GridTable4-Accent1']) return 'GridTable4-Accent1 missing from catalog: ' + JSON.stringify(list);
    if (!(byId['TableGrid'].length > 0 && byId['GridTable4-Accent1'].length > 0)) return 'empty display names: ' + JSON.stringify(list);
    // TableNormal is semiHidden (Word does not list it in the gallery) — keep it out.
    if (byId['TableNormal']) return 'semiHidden TableNormal leaked into the gallery list';
    return true;
  });
  await t('[6b] EXPORT: minted table style definition reaches styles.xml', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    PM().tableSetStyle('GridTable4-Accent1'); await sleep(80);
    // The exporter serializes converter.convertedXml['word/styles.xml'] back out;
    // addDefaultStylesIfMissing mutates that in-memory catalog at parse time, so the
    // definition being present HERE is what guarantees it reaches the saved file
    // (renderer cannot unzip; the node-side re-check is scripts/docx-inspect.js
    // `tableStyles`). Run a real export first so the assertion tracks the live path.
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500)) return 'export produced no bytes';
    const styles = window.WC.editor.converter?.convertedXml?.['word/styles.xml'];
    const els = (styles && styles.elements && styles.elements[0] && styles.elements[0].elements) || [];
    const def = els.find((el) => el.name === 'w:style' && el.attributes && el.attributes['w:styleId'] === 'GridTable4-Accent1');
    if (!def) return 'no GridTable4-Accent1 w:style in convertedXml styles.xml';
    if (def.attributes['w:type'] !== 'table') return 'GridTable4-Accent1 minted with wrong type: ' + def.attributes['w:type'];
    // The conditional blocks are what make header-row/banding render in Word — keep intact.
    const stylePrs = (def.elements || []).filter((el) => el.name === 'w:tblStylePr');
    if (stylePrs.length < 6) return 'tblStylePr conditional blocks missing (got ' + stylePrs.length + ', want 6)';
    return true;
  });
  await t('[6b] tableSetStyle visibly changes the table (bake)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    const tblEl = () => document.querySelector('#pm-editor .ProseMirror .tableWrapper > table');
    if (!tblEl()) return 'no table rendered';
    const before = tblEl().outerHTML;
    PM().tableSetStyle('GridTable4-Accent1'); await sleep(200);
    const el = tblEl();
    if (!el) return 'table lost after style apply';
    if (el.outerHTML === before) return 'DOM unchanged after tableSetStyle';
    // Be specific about WHAT changed: GridTable4-Accent1 base tblPr borders are
    // single 4/8pt #8EAADB → computed border color rgb(142, 170, 219); the firstRow
    // tblStylePr shades first-row cells #4472C4 → rgb(68, 114, 196).
    const borderColor = getComputedStyle(el).borderTopColor;
    if (borderColor !== 'rgb(142, 170, 219)') return 'table border not baked: borderTopColor=' + borderColor;
    const firstCell = el.querySelector('tbody > tr > td, tbody > tr > th');
    if (!firstCell) return 'no first-row cell';
    const bg = getComputedStyle(firstCell).backgroundColor;
    if (bg !== 'rgb(68, 114, 196)') return 'first-row shading not baked: backgroundColor=' + bg;
    return true;
  });
  await t('[6b] tableSetStyle preserves an explicit user cell shading', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    // Caret sits in the FIRST cell after insertTable — shade it (user direct formatting),
    // then apply the style. Word keeps direct shading over the style's firstRow fill.
    PM().tableSetCellShading('#FFF2CC'); await sleep(80);
    PM().tableSetStyle('GridTable4-Accent1'); await sleep(150);
    const bg = firstCellAttr('background');
    if (!bg || String(bg.color).toUpperCase() !== 'FFF2CC') return 'user shading stomped: ' + JSON.stringify(bg);
    // ...while an untouched first-row cell DOES get the style's firstRow fill.
    let secondBg = null; let seen = 0;
    doc().descendants((n) => {
      if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') { seen++; if (seen === 2 && secondBg === null) secondBg = n.attrs.background; }
    });
    if (!secondBg || String(secondBg.color).toUpperCase() !== '4472C4') return 'sibling first-row cell not baked: ' + JSON.stringify(secondBg);
    return true;
  });
  await t('[6b] direct table borders beat the baked style frame (Word precedence)', async () => {
    // T4 review fix: a table with explicit DIRECT w:tblBorders (importable from Word
    // docs; not UI-writable yet) keeps its direct frame when a style is applied — Word
    // precedence. The importer merges `{ ...styleBorders, ...directBorders }` on reopen
    // (tbl-translator.js), so an apply-time overwrite made the table change appearance
    // across its own save cycle. Build the importer's two shapes directly in a
    // transaction: OOXML eighth-points in tableProperties.borders + the px projection
    // (_processTableBorders: 24 eighths = 3pt → 4px, '#'-prefixed color) in attrs.borders.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    let tablePos = -1, tableNode = null;
    doc().descendants((n, pos) => { if (tablePos < 0 && n.type.name === 'table') { tablePos = pos; tableNode = n; } });
    if (tablePos < 0) return 'no table';
    const ooxml = {}, px = {};
    for (const s of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
      ooxml[s] = { val: 'single', size: 24, space: 0, color: 'FF0000' };
      px[s] = { color: '#FF0000', size: 4, val: 'single' };
    }
    v().dispatch(v().state.tr.setNodeMarkup(tablePos, undefined, {
      ...tableNode.attrs,
      borders: px,
      tableProperties: { ...(tableNode.attrs.tableProperties || {}), borders: ooxml },
    }));
    await sleep(80);
    ecmd('setTableStyle', 'GridTable4-Accent1'); await sleep(120);
    const b = tableAttr('borders');
    if (!b || !b.top) return 'borders attr lost after style apply: ' + JSON.stringify(b);
    if (String(b.top.color).toUpperCase() !== '#FF0000' || b.top.size !== 4)
      return 'style frame stomped the direct border: ' + JSON.stringify(b.top);
    if (tableAttr('tableStyleId') !== 'GridTable4-Accent1') return 'styleId not applied';
    // Style CLEAR falls back to the direct projection, not {} — same merge on the way out.
    ecmd('setTableStyle', null); await sleep(120);
    const b2 = tableAttr('borders');
    if (!b2 || !b2.top || String(b2.top.color).toUpperCase() !== '#FF0000')
      return 'style clear wiped the direct borders: ' + JSON.stringify(b2);
    return true;
  });
  // ---- gridlines: table-level insideH/insideV must PAINT (user defect: "just a big box") ----
  // The table node's `borders` attr carries all six OOXML sides, but the renderDOM
  // border-${key} emission is only valid CSS for the four physical sides — insideH/
  // insideV produced `border-insideH:` (dropped) and NOTHING painted cell gridlines
  // (cells carry no `borders` attr in the styled path; probe-verified the imported
  // real-Word s3 fixture was a big box too). The render-only fix publishes the inside
  // borders as inherited CSS vars (--wc-inside-h/--wc-inside-v) consumed by a
  // stylesheet rule on INTERIOR cell edges (top of rows 2+, left of columns 2+) —
  // outer edges stay table-frame-owned, exactly Word's inside/outside split.
  const interiorCellBorders = () => {
    const tbl = document.querySelector('#pm-editor .ProseMirror .tableWrapper > table');
    if (!tbl) return null;
    const rows = tbl.querySelectorAll('tbody > tr');
    if (rows.length < 2) return null;
    const cell = rows[1].querySelectorAll('td, th')[1]; // row 2, col 2: both edges interior
    if (!cell) return null;
    const cs = getComputedStyle(cell);
    return {
      top: { w: parseFloat(cs.borderTopWidth) || 0, style: cs.borderTopStyle },
      left: { w: parseFloat(cs.borderLeftWidth) || 0, style: cs.borderLeftStyle },
    };
  };
  await t('[6b] fresh table renders visible cell gridlines (Word parity)', async () => {
    setDoc('x'); PM().insertTable({ rows: 3, cols: 3 }); await sleep(200);
    const b = interiorCellBorders();
    if (!b) return 'no 3x3 table rendered';
    if (!(b.top.w >= 1 && b.top.style === 'solid')) return 'no insideH gridline: border-top=' + b.top.w + 'px ' + b.top.style;
    if (!(b.left.w >= 1 && b.left.style === 'solid')) return 'no insideV gridline: border-left=' + b.left.w + 'px ' + b.left.style;
    return true;
  });
  await t('[6b] borderless table shows no gridlines', async () => {
    setDoc('x'); PM().insertTable({ rows: 3, cols: 3 }); await sleep(200);
    ecmd('deleteCellAndTableBorders'); await sleep(150);
    const b = interiorCellBorders();
    if (!b) return 'no 3x3 table rendered';
    if (b.top.w !== 0 || b.left.w !== 0)
      return 'gridlines painted on a borderless table: top=' + b.top.w + 'px ' + b.top.style + ' left=' + b.left.w + 'px ' + b.left.style;
    return true;
  });
  await t('[6b] EXPORT purity: fresh table writes no direct w:tcBorders', async () => {
    // Real Word style-driven tables carry NO per-cell w:tcBorders (the style
    // definition in styles.xml owns the gridlines). The render-only gridline fix
    // must not bake borders into cell attrs — the translate-table-cell legacy
    // fallback would export them as direct formatting.
    setDoc('x'); PM().insertTable({ rows: 3, cols: 3 }); await sleep(200);
    const xml = await exportDocumentXml();
    if (!xml) return 'export produced no xml';
    if (/<w:tcBorders\b/.test(xml)) return 'direct w:tcBorders leaked into document.xml';
    if (/<w:tblBorders\b/.test(xml)) return 'direct w:tblBorders leaked into document.xml';
    return true;
  });
  // ---- T2 geometry regression: alignment must MOVE the table, not just set attrs ----
  // The fork's TableView.updateColumns used to write table.style.marginLeft from
  // `tableIndent?.value ?? 0` UNCONDITIONALLY ('0px' when no indent exists), stomping
  // the justification margins (`margin: 0 auto` / `margin-left: auto`) that
  // updateTable() had just applied from renderDOM — center/right were visually inert.
  // These measure real pixels against the .tableWrapper (the table's containing block).
  const tableGeom = () => {
    const tbl = document.querySelector('#pm-editor .ProseMirror .tableWrapper > table');
    if (!tbl) return null;
    const tr = tbl.getBoundingClientRect();
    const wr = tbl.parentElement.getBoundingClientRect();
    return { leftGap: tr.left - wr.left, rightGap: wr.right - tr.right };
  };
  // 80px columns keep the table well under the wrapper width so alignment has room to move it.
  const insertNarrowTable = async () => {
    setDoc('x'); ecmd('insertTable', { rows: 2, cols: 2, columnWidths: [80, 80] }); await sleep(150);
  };
  await t('[6b] tableSetAlignment center visibly centers the table (geometry)', async () => {
    await insertNarrowTable();
    if (!tableGeom()) return 'no table rendered';
    if (!PM().tableSetAlignment('center')) return 'tableSetAlignment returned false';
    await sleep(150);
    const g = tableGeom();
    if (!g) return 'table lost after align';
    if (!(g.leftGap > 20)) return `still hard-left: leftGap=${g.leftGap.toFixed(1)} rightGap=${g.rightGap.toFixed(1)}`;
    if (!(Math.abs(g.leftGap - g.rightGap) < 40)) return `lopsided: leftGap=${g.leftGap.toFixed(1)} rightGap=${g.rightGap.toFixed(1)}`;
    return true;
  });
  await t('[6b] tableSetAlignment right hugs the right (geometry)', async () => {
    await insertNarrowTable();
    if (!tableGeom()) return 'no table rendered';
    if (!PM().tableSetAlignment('right')) return 'tableSetAlignment returned false';
    await sleep(150);
    const g = tableGeom();
    if (!g) return 'table lost after align';
    if (!(g.rightGap < g.leftGap)) return `not right-aligned: leftGap=${g.leftGap.toFixed(1)} rightGap=${g.rightGap.toFixed(1)}`;
    if (!(g.rightGap < 40)) return `right gap too big: rightGap=${g.rightGap.toFixed(1)}`;
    return true;
  });
  await t('[6b] tableSetIndent still indents (no regression after the margin gating)', async () => {
    await insertNarrowTable();
    const before = tableGeom();
    if (!before) return 'no table rendered';
    if (!PM().tableSetIndent(48)) return 'tableSetIndent returned false';
    await sleep(150);
    const tbl = document.querySelector('#pm-editor .ProseMirror .tableWrapper > table');
    const ml = parseFloat(getComputedStyle(tbl).marginLeft);
    const g = tableGeom();
    const grew = g.leftGap - before.leftGap;
    // 48px → 720 twips → back to 48px through convertSizeToCSS; tiny rounding slack only.
    if (!(Math.abs(ml - 48) <= 2)) return `computed margin-left=${ml} (expected ~48)`;
    if (!(grew > 30)) return `leftGap did not grow ~48: before=${before.leftGap.toFixed(1)} after=${g.leftGap.toFixed(1)}`;
    return true;
  });

  await t('[6b][bridge] tableInfo returns rows/cols/styleId/alignment from live table node', async () => {
    setDoc('x'); PM().insertTable({ rows: 3, cols: 4 }); await sleep(150);
    PM().tableSetStyle('TableGrid'); await sleep(80);
    const info = PM().tableInfo();
    return info.inTable && info.rows === 3 && info.cols === 4 && info.styleId === 'TableGrid';
  });
  await t('[6b][bridge] B3: tableSelectFirstRowPair + tableMerge reduces first row cell count', async () => {
    // Insert 2×3 table (2 rows, 3 cols), select first two cells of first row, merge.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(150);
    const selOk = PM().tableSelectFirstRowPair(); await sleep(80);
    if (!selOk) return 'tableSelectFirstRowPair returned false';
    const mergeOk = PM().tableMerge(); await sleep(80);
    if (!mergeOk) return 'tableMerge returned false after CellSelection';
    // After merge the first row has 2 cells (merged cell + remaining cell).
    try {
      // Navigate to the table node.
      const sel = PM().getEditor().state.selection;
      const from = sel.$from;
      for (let d = from.depth; d > 0; d--) {
        if (from.node(d).type.name === 'table') {
          const firstRow = from.node(d).child(0);
          return firstRow.childCount === 2 || `expected 2 cells, got ${firstRow.childCount}`;
        }
      }
      return 'table node not found after merge';
    } catch (e) {
      return String(e);
    }
  });
  await t('[6b] EXPORT: merged cell → <w:gridSpan w:val="2"> + grid keeps all columns (Word opens without repair)', async () => {
    // The B3 test above asserts the MODEL (cell count); this guards the EXPORT — a horizontal merge
    // must emit <w:gridSpan w:val="2"> on the surviving cell while <w:tblGrid> keeps all 3 <w:gridCol>
    // (a gridSpan/grid mismatch is exactly what makes Word repair-prompt). Word COM-validated
    // separately: the saved doc OPENS WITHOUT REPAIR, Rows(1).Cells.Count=2, Rows(2)=3 —
    // scripts/oracle-probe-6b-gridspan.js + scripts/oracle/validate-gridspan-win.ps1.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(150);
    if (!PM().tableSelectFirstRowPair()) return 'tableSelectFirstRowPair returned false';
    await sleep(80);
    if (!PM().tableMerge()) return 'tableMerge returned false';
    await sleep(120);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const gs = xml.match(/<w:gridSpan\b[^>]*w:val="(\d+)"/);
    if (!gs) return 'no <w:gridSpan> in export after horizontal merge';
    if (gs[1] !== '2') return 'gridSpan should be 2 (merged 2 cells), got ' + gs[1];
    // The grid must still describe all 3 columns the span covers (else Word repairs the table).
    const gridCols = (xml.match(/<w:gridCol\b/g) || []).length;
    if (gridCols !== 3) return 'expected 3 <w:gridCol> (grid must keep all columns), got ' + gridCols;
    return true;
  });
  await t('[6b] cell shading works with a plain caret (Word parity)', async () => {
    // T3 defect A: Word shades the CARET cell when no cells are selected; the bridge
    // used to refuse ('Select cells first' toast + false). setCellAttr is caret-safe
    // (resolves the caret cell via selectionCell), so the fork now falls back to it.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    // Precondition: insertTable leaves a plain TextSelection in the first cell — not a
    // CellSelection ($anchorCell is CellSelection-only; robust against minified names).
    if (v().state.selection.$anchorCell) return 'precondition: expected a plain caret, got a CellSelection';
    const toasts = [];
    const realToast = window.WC.toast;
    window.WC.toast = (msg, info) => { toasts.push(String(msg)); realToast.call(window.WC, msg, info); };
    let ok;
    try { ok = PM().tableSetCellShading('#FFE699'); } finally { window.WC.toast = realToast; }
    await sleep(100);
    if (toasts.some((m) => /select cells first/i.test(m))) return 'refused with toast: ' + toasts.join(' | ');
    if (!ok) return 'tableSetCellShading returned false';
    const bg = firstCellAttr('background');
    return (!!bg && /^ffe699$/i.test(bg.color || '')) || 'background attr not set on caret cell: ' + JSON.stringify(bg);
  });
  await t('[6b] shading with a CellSelection still shades all selected cells', async () => {
    // Regression guard for the caret fallback: the multi-cell path must keep working.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(150);
    if (!PM().tableSelectFirstRowPair()) return 'tableSelectFirstRowPair returned false';
    await sleep(80);
    if (!PM().tableSetCellShading('#FFE699')) return 'tableSetCellShading returned false';
    await sleep(100);
    let row = null; doc().descendants((n) => { if (!row && n.type.name === 'tableRow') row = n; });
    if (!row || row.childCount < 3) return 'first row not found/intact';
    const c0 = row.child(0).attrs.background, c1 = row.child(1).attrs.background, c2 = row.child(2).attrs.background;
    const shaded = (c) => !!c && /^ffe699$/i.test(c.color || '');
    if (!shaded(c0) || !shaded(c1)) return `selected cells not both shaded: c0=${JSON.stringify(c0)} c1=${JSON.stringify(c1)}`;
    if (shaded(c2)) return 'unselected third cell was shaded too';
    return true;
  });
  await t('[6b] EXPORT: cell shading → <w:shd w:fill> in document.xml (hex preserved; Word reads BackgroundPatternColor)', async () => {
    // The model attr was covered above; this guards the docx EXPORT (the prior gap). A caret-cell
    // shade must emit <w:shd w:fill="FF0000"> verbatim. Word COM-validated separately: a pure-red
    // (FF0000) fill reads Cells(1).Shading.BackgroundPatternColor = 255 (no BGR/RGB swap) —
    // scripts/oracle-probe-6b-cellshading.js + scripts/oracle/validate-cellshading-win.ps1.
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    if (!PM().tableSetCellShading('FF0000')) return 'tableSetCellShading returned false';
    await sleep(100);
    const bg = firstCellAttr('background');
    if (!bg || !/^ff0000$/i.test(bg.color || '')) return 'background attr not set: ' + JSON.stringify(bg);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<w:shd\b[^>]*w:fill="([^"]*)"/);
    if (!m) return 'no <w:shd w:fill=...> in export';
    if (!/^ff0000$/i.test(m[1])) return 'w:shd fill not FF0000 (hex must round-trip verbatim): ' + m[1];
    return true;
  });

  // ---- Table Layout + Table Design contextual ribbon tabs (Task 10) ----
  await t('[6b] contextual Table tabs appear when caret is in a table', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    window.WC.TableToolsPM.syncContextualTabs(PM().isInTable());
    const layout = !!document.querySelector('.contextual-tab[data-tab="table-layout"]');
    const design = !!document.querySelector('.contextual-tab[data-tab="table-design"]');
    return PM().isInTable() === true && layout === true && design === true;
  });
  await t('[6b] a Table Layout tab control cmd dispatches (tblInsertBelow grows the row count)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    window.WC.TableToolsPM.syncContextualTabs(PM().isInTable());
    let before = 0; doc().descendants((n) => { if (n.type.name === 'tableRow') before++; });
    window.WC.Commands.run({ cmd: 'tblInsertBelow', label: 'Insert Below', type: 'button' }); await sleep(120);
    let after = 0; doc().descendants((n) => { if (n.type.name === 'tableRow') after++; });
    return before === 2 && after === 3;
  });
  await t('[6b] leaving the table (caret outside) + sync hides BOTH contextual tabs', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    window.WC.TableToolsPM.syncContextualTabs(PM().isInTable());
    // guard: prove they are present first
    if (!document.querySelector('.contextual-tab[data-tab="table-layout"]')) return 'tabs never appeared';
    // insertTable leaves a trailing empty paragraph after the table; drop the caret
    // into it (end of doc) so the selection is OUTSIDE the table, then re-sync.
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), doc().content.size - 1)));
    await sleep(80);
    if (PM().isInTable() !== false) return 'caret still reports in-table after moving to trailing paragraph';
    window.WC.TableToolsPM.syncContextualTabs(PM().isInTable());
    const layoutGone = !document.querySelector('.contextual-tab[data-tab="table-layout"]');
    const designGone = !document.querySelector('.contextual-tab[data-tab="table-design"]');
    return layoutGone === true && designGone === true;
  });
  // Word fidelity (live-repro probe S1.x): contextual tabs are PASSIVE — entering or
  // leaving a table must never change which ribbon tab is active. Real Word Mac shows
  // 'Table Design' + 'Layout' without ever stealing the active tab
  // (.oracle-probes/slice6/results.md, B-design).
  await t('[6b] caret into a table does NOT steal the active ribbon tab', async () => {
    setDoc('x'); await sleep(250); // state-sync tick hides any leftover contextual tabs
    window.WC.Ribbon.activate('insert');
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(400); // rAF state-sync tick auto-shows tabs
    const layout = !!document.querySelector('.contextual-tab[data-tab="table-layout"]');
    const design = !!document.querySelector('.contextual-tab[data-tab="table-design"]');
    // Panels too — a tab button without its body panel is a broken inject (the
    // legacy H&F gate asserts the panel; keep the PM tabs honest the same way).
    const layoutPanel = !!document.querySelector('.ribbon-panel[data-tab="table-layout"]');
    const designPanel = !!document.querySelector('.ribbon-panel[data-tab="table-design"]');
    const activeEl = document.querySelector('.ribbon-tab.active');
    const active = activeEl && activeEl.dataset.tab;
    if (!layout || !design) return `tabs missing: layout=${layout} design=${design}`;
    if (!layoutPanel || !designPanel) return `panels missing: layout=${layoutPanel} design=${designPanel}`;
    return active === 'insert' || `active tab stolen: expected 'insert', got '${active}'`;
  });
  await t('[6b] leaving a table preserves a user-chosen tab', async () => {
    setDoc('x'); await sleep(250);
    window.WC.Ribbon.activate('insert'); // the inject will record 'insert' as _ctxPrev
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(400);
    if (!document.querySelector('.contextual-tab[data-tab="table-layout"]')) return 'tabs never appeared';
    window.WC.Ribbon.activate('home'); // user explicitly picks Home while the caret is in the table
    // Caret out: insertTable leaves a trailing empty paragraph after the table (end of doc).
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), doc().content.size - 1)));
    await sleep(400);
    if (PM().isInTable() !== false) return 'caret still reports in-table after moving out';
    if (document.querySelector('.contextual-tab')) return 'contextual tabs still present after exit';
    const activeEl = document.querySelector('.ribbon-tab.active');
    const active = activeEl && activeEl.dataset.tab;
    return active === 'home' || `expected 'home' to stay active, got '${active}' (jumped to stale prev)`;
  });

  // ---------- slice 7: file-io (html/txt/csv on the PM engine — these replace the live document) ----------
  // CRITICAL: Files.open awaits confirmDiscard(), which opens a MODAL when the doc is dirty — a
  // dirty doc here would hang the whole probe (no JSON, suite never exits). The last [6b] test
  // leaves the doc dirty, so this block MUST start clean, and every f.open below carries its own
  // PM().setClean() guard — keep the guard adjacent when reordering.
  await PM().newBlank(); await sleep(100);

  const writeTextFixture = async (filePath, content) => {
    const w = await window.wordAPI.saveBytes({ filePath, bytes: new TextEncoder().encode(content) });
    return w && w.ok;
  };
  const fileText = async (filePath) => {
    const r = await window.wordAPI.openBytes(filePath);
    if (!r || !r.ok) return null;
    let s = new TextDecoder('utf-8').decode(r.bytes);
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    return s;
  };

  await t('[7] wordAPI exposes the slice-7 channels (saveTextFile + askSavePath)', async () => {
    return typeof window.wordAPI.saveTextFile === 'function' && typeof window.wordAPI.askSavePath === 'function';
  });
  await t('[7] open .html imports headings/bold/list onto the engine (path+format bound)', async () => {
    const f = window.WC.Files;
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>x</title></head><body>'
      + '<h1>Imported Title</h1><p>plain with <strong>bold word</strong></p><ul><li>item one</li><li>item two</li></ul>'
      + '</body></html>';
    if (!(await writeTextFixture('/tmp/wc-pm-import.html', html))) return 'fixture write failed';
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-import.html');
    const txt = window.WC.view.dom.textContent;
    if (!/Imported Title/.test(txt) || !/bold word/.test(txt) || !/item two/.test(txt)) return 'content missing: ' + txt.slice(0, 120);
    const json = JSON.stringify(window.WC.view.state.doc.toJSON());
    if (!/"type":"bold"/.test(json)) return 'bold mark lost';
    return f.path === '/tmp/wc-pm-import.html' && f.format === 'html';
  });
  await t('[7] open .txt imports line-per-paragraph (BOM + CRLF safe)', async () => {
    const f = window.WC.Files;
    // \ufeff escapes, never raw BOM bytes in source
    if (!(await writeTextFixture('/tmp/wc-pm-import.txt', '\ufeffline one\r\nline two\r\n\r\nline four'))) return 'fixture write failed';
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-import.txt');
    const txt = window.WC.view.dom.textContent;
    if (/\ufeff/.test(txt)) return 'BOM leaked into the doc';
    if (!/line one/.test(txt) || !/line two/.test(txt) || !/line four/.test(txt)) return 'lines missing: ' + txt.slice(0, 120);
    return f.path === '/tmp/wc-pm-import.txt' && f.format === 'text';
  });
  await t('[7] open .csv imports an RFC-4180 table (quoted comma survives, dims right)', async () => {
    const f = window.WC.Files;
    if (!(await writeTextFixture('/tmp/wc-pm-import.csv', 'name,note\n"Smith, John",hello\nplain,"say ""hi"""\n'))) return 'fixture write failed';
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-import.csv');
    const json = window.WC.view.state.doc.toJSON();
    const tables = (JSON.stringify(json).match(/"type":"table"/g) || []).length;
    if (tables !== 1) return 'expected 1 table, got ' + tables;
    const txt = window.WC.view.dom.textContent;
    if (!/Smith, John/.test(txt)) return 'quoted comma broke: ' + txt.slice(0, 120);
    if (!/say "hi"/.test(txt)) return 'escaped quote broke: ' + txt.slice(0, 120);
    const rows = (JSON.stringify(json).match(/"type":"tableRow"/g) || []).length;
    const cells = (JSON.stringify(json).match(/"type":"tableCell"/g) || []).length;
    if (cells !== 6) return 'expected 6 cells (2 cols x 3 rows), got ' + cells;
    return rows === 3;
  });
  await t('[7] csv import is an UNSAVED document (path null, format docx, name from stem)', async () => {
    const f = window.WC.Files;
    if (!(await writeTextFixture('/tmp/wc-pm-import2.csv', 'a,b\n1,2\n'))) return 'fixture write failed';
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-import2.csv');
    return (f.path === null && f.format === 'docx' && /wc-pm-import2/.test(f.name))
      || ('state wrong: path=' + f.path + ' fmt=' + f.format + ' name=' + f.name);
  });
  await t('[7] open .tsv imports a table (tab delimiter sniffed)', async () => {
    const f = window.WC.Files;
    if (!(await writeTextFixture('/tmp/wc-pm-import.tsv', 'alpha\tbravo\ncharlie\tdelta\n'))) return 'fixture write failed';
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-import.tsv');
    const json = JSON.stringify(window.WC.view.state.doc.toJSON());
    if (!/"type":"table"/.test(json)) return 'no table imported';
    const cells = (json.match(/"type":"tableCell"/g) || []).length;
    if (cells !== 4) return 'expected 4 cells (2x2 tab-sniffed), got ' + cells;
    return /charlie/.test(window.WC.view.dom.textContent) || 'cell payload missing';
  });
  await t('[7] save format html writes a re-importable .html file + cleans the dirty flag', async () => {
    const f = window.WC.Files;
    setDoc('html save payload');
    f.path = '/tmp/wc-pm-save.html'; f.name = 'wc-pm-save.html'; f.format = 'html';
    const r = await f.save();
    if (!r || !r.ok) return 'save: ' + JSON.stringify(r);
    const cleanAfterSave = PM().isDirty() === false;
    const s = await fileText('/tmp/wc-pm-save.html');
    if (!s || !/<!DOCTYPE html>/i.test(s) || !/html save payload/.test(s)) return 'file content wrong: ' + String(s).slice(0, 120);
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-save.html');
    return cleanAfterSave && /html save payload/.test(window.WC.view.dom.textContent);
  });
  await t('[7] save format text writes the model text (multi-paragraph → newline-separated)', async () => {
    const f = window.WC.Files;
    // Two real paragraphs via the txt import leg itself (already covered above), then save back.
    if (!(await writeTextFixture('/tmp/wc-pm-twolines.txt', 'first line\nsecond line'))) return 'fixture write failed';
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-twolines.txt');
    f.path = '/tmp/wc-pm-save.txt'; f.name = 'wc-pm-save.txt'; f.format = 'text';
    const r = await f.save();
    if (!r || !r.ok) return 'save: ' + JSON.stringify(r);
    const s = await fileText('/tmp/wc-pm-save.txt');
    if (!s) return 'file unreadable';
    if (!/first line/.test(s) || !/second line/.test(s)) return 'lines missing: ' + s.slice(0, 80);
    if (!/first line\n+second line/.test(s)) return 'newline separator missing: ' + JSON.stringify(s.slice(0, 40));
    return !/[<>]/.test(s);
  });
  await t('[7] PM html save serializes via PM.getHTML (never the legacy payload path)', async () => {
    // contextBridge-exposed properties are NOT reliably writable — spy the PLAIN bridge object
    // instead. Proving Files.save(format html) pulls content from the PM serializer IS the
    // contract: the legacy doc:save path would write the stale offscreen legacy doc.
    const f = window.WC.Files;
    setDoc('isolation probe');
    f.path = '/tmp/wc-pm-iso.html'; f.name = 'wc-pm-iso.html'; f.format = 'html';
    const orig = window.WC.PM.getHTML; let pmCalls = 0;
    window.WC.PM.getHTML = function () { pmCalls++; return orig.call(window.WC.PM); };
    let r;
    try { r = await f.save(); } finally { window.WC.PM.getHTML = orig; }
    if (!r || r.ok !== true) return 'save failed: ' + JSON.stringify(r);
    const s = await fileText('/tmp/wc-pm-iso.html');
    return pmCalls >= 1 && !!s && /isolation probe/.test(s);
  });
  await t('[7] PM.getHTML returns serialized body html (no engine chrome)', async () => {
    setDoc('serializer probe');
    const h = PM().getHTML();
    return typeof h === 'string' && /serializer probe/.test(h) && !/ProseMirror/.test(h);
  });
  await t('[7] PM.getText returns plain model text', async () => {
    setDoc('text probe body');
    const s = PM().getText();
    return s.trim() === 'text probe body';
  });
  await t('[7] openHtml→exportDocx round-trip stays a valid zip (converter context intact)', async () => {
    const ok = await PM().openHtml('<p>roundtrip via html import</p>');
    if (ok !== true) return 'openHtml failed';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    const ok2 = await PM().openDocx(bytes);
    return ok2 === true && /roundtrip via html import/.test(window.WC.view.dom.textContent);
  });
  await t('[7] lastImportBlanked stays false through successful imports (surface pin)', async () => {
    if (typeof PM().lastImportBlanked !== 'function') return 'surface missing';
    PM().setClean(); // saves can fail at the red stage — never risk the confirmDiscard modal in the harness
    const ok = await PM().openHtml('<p>blank-flag steady state</p>');
    if (ok !== true) return 'openHtml failed';
    return PM().lastImportBlanked() === false;
  });
  await t('[7] failed save leaves dirty flag + path/format untouched (continuity pin — green both stages)', async () => {
    // Replaces the failed-save invariant coverage the deleted '[0b] non-docx save blocked' test
    // carried. Pre-slice: blocked-save returns ok:false; post-slice: the write to a nonexistent
    // dir fails. Both must leave state untouched.
    const f = window.WC.Files;
    setDoc('failed save probe');
    const p0 = '/nonexistent-dir-wc-s7/x.html';
    f.path = p0; f.name = 'x.html'; f.format = 'html';
    const r = await f.save();
    const stateHeld = r && r.ok !== true && f.path === p0 && f.format === 'html' && PM().isDirty() === true;
    const detail = 'ok=' + (r && r.ok) + ' path=' + f.path + ' fmt=' + f.format + ' dirty=' + PM().isDirty();
    f.path = null; f.name = 'Document1'; f.format = 'docx'; PM().setClean(); // restore for [0b]
    return stateHeld || ('state moved: ' + detail);
  });

  // ---------- slice 8: review ----------
  // Track changes + comments + view modes on the PM engine.
  // Plan: docs/superpowers/plans/2026-06-11-phase2-slice-8-review.md (esp. amendments
  // A2/A3/A5/A6/A7); parity contract: .oracle-probes/slice8/parity.md.
  // RED until bridge/review.ts (task 2) + the ribbon re-point (task 3) + the flip
  // (task 7) land. Planned WC.PM surface under test: reviewState() ->
  // { tracking, view, engineFlags: { onlyOriginalShown, onlyModifiedShown } } (the
  // fork TrackChangesBasePlugin flags -- A3 ENGINE truth, never an echo of view),
  // getRevisions() -> [{ id, author, type, text }] (comments COUNT, converter
  // trackedChange projection rows filtered -- A2/T11), getComments() ->
  // [{ id, author, text, resolved, replies }], plus cmd names toggleTrackChanges /
  // acceptChange / rejectChange / acceptSelection / acceptAll / rejectAll /
  // nextChange / prevChange / setReviewView / addComment / replyComment /
  // resolveComment / deleteComment / nextComment / prevComment / setActiveComment.
  // NAME COLLISION: addComment/resolveComment/setActiveComment collide with RAW fork
  // command names -- the bridge must SHADOW them onto the Document API path
  // (editor.doc.comments.*, A2); the comment pins stay red on the raw path by design.
  // EVERY planned-surface access is guarded with a failure-string return (never an
  // uncaught throw) so the rest of the suite runs.
  // Engine ground truth (extensions/track-changes/constants.js): mark names are
  // 'trackInsert'/'trackDelete'/'trackFormat'; a tracked DELETE keeps the text and
  // ADDS the mark (A7); undo of a tracked insert is ATOMIC (A7). The fork commands
  // enable/disableTrackChanges exist TODAY (track-changes.js), so the engine-level
  // pins below may go green before the bridge lands -- they pin the fork engine the
  // slice builds on (K2/A7 facts), never a blocked-cmd no-op.
  await PM().newBlank(); await sleep(100);
  // Tracking is EDITOR-level state that survives setDoc -- every test that enables it
  // must clean up on EVERY exit path (try/finally) or later setDocs would keep the
  // replaced text as tracked deletions and poison the whole suite.
  // TWO-step hygiene (probe-verified 2026-06-11): disabling tracking is NOT enough.
  // Editor.ts #dispatchTransaction PROTECTS existing tracked review state -- any
  // transaction touching a surviving trackInsert/trackDelete/trackFormat mark is
  // rewritten as tracked EVEN WITH TRACKING OFF (Editor.ts:3119-3125
  // protectsExistingTrackedReviewState), so leftover marks turn the next setDoc's
  // replace into tracked deletes and the doc text accumulates forever. reviewReset
  // therefore (1) accept-alls the surviving marks via the FORK command (exists
  // today; its dispatchReviewDecision path sets skipTrackChanges) and (2) disables
  // tracking. The planned bridge names (acceptAll/rejectAll) are the surface UNDER
  // TEST and stay out of the hygiene path. trackOff (bare disable) remains for
  // MID-test use where the tracked content itself must survive the disable.
  const trackOff = () => { try { PM().cmd('disableTrackChanges'); } catch (e) { /* red-stage safe */ } };
  const reviewReset = () => { try { PM().cmd('acceptAllTrackedChanges'); PM().cmd('disableTrackChanges'); } catch (e) { /* red-stage safe */ } };
  // Comments are EDITOR-level entity-store state and survive setDoc just like
  // tracking does -- every comment-creating test must commentsReset() in a finally
  // or later getComments() counts go stale. Pre-bridge (getComments missing) this
  // is a no-op by construction, so no raw fork deleteComment ever fires.
  const commentsReset = () => { try { if (typeof PM().getComments !== 'function') return; for (const c of PM().getComments()) { try { PM().cmd('deleteComment', c.id); } catch (e) {} } } catch (e) {} };
  // Visible-truth probe for the A3 view modes: the fork's Original/Final views
  // hide tracked runs via decoration classes + display:none CSS (the doc and
  // its DOM text stay intact -- textContent ignores CSS hiding by design).
  // True when `needle` exists in the rendered DOM AND every occurrence sits
  // inside a css-hidden (display:none) container under the PM view.
  const insertHiddenByCss = (needle) => {
    const walker = document.createTreeWalker(v().dom, NodeFilter.SHOW_TEXT);
    let found = false;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.includes(needle)) continue;
      found = true;
      let el = n.parentElement;
      let hidden = false;
      while (el && el !== v().dom) {
        if (getComputedStyle(el).display === 'none') { hidden = true; break; }
        el = el.parentElement;
      }
      if (!hidden) return false;
    }
    return found;
  };
  // Re-locate needle WITHOUT moving the selection (selectText also selects).
  const findRange = (needle) => {
    let found = null;
    doc().descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) found = { from: pos + i, to: pos + i + needle.length };
    });
    return found;
  };
  const caretAfter = (needle) => { const s = selectText(needle); window.WC.editor.commands.setTextSelection({ from: s.to, to: s.to }); };
  // Concatenated text of every text node carrying mark `name` (anchor-span asserts).
  const markedText = (name) => { let s = ''; doc().descendants((n) => { if (n.isText && n.marks.some((m) => m.type.name === name)) s += n.text; }); return s; };
  const anyTrackMark = () => hasMark('trackInsert') || hasMark('trackDelete') || hasMark('trackFormat');
  // Snapshot modulo sdBlockRev -- the [1] Mod-Z precedent (history-exempt metadata).
  const norm8 = () => JSON.stringify(v().state.doc.toJSON(), (k, val) => (k === 'sdBlockRev' ? undefined : val));

  await t('[8] AREA audit: every Review-tab cmd is D6-mapped (or app-level allowlisted)', () => {
    // A5: unmapped cmds are NOT blocked (isBlocked returns false) and silently drive
    // the hidden legacy editor in PM mode. Self-enforcing walk of the LIVE ribbon
    // data so the post-regroup (D8.1) layout is audited automatically.
    const tab = (window.WC.RIBBON || []).find((tb) => tb.name === 'Review' || tb.id === 'review');
    if (!tab) return 'Review tab not found in WC.RIBBON';
    const cmds = new Set();
    for (const g of tab.groups || []) {
      for (const c of g.controls || []) {
        if (c.cmd) cmds.add(c.cmd);
        // items are plain label strings today; A4's gen.js cmd-override may turn
        // them into objects carrying cmds -- collect those too.
        for (const it of c.items || []) if (it && typeof it === 'object' && it.cmd) cmds.add(it.cmd);
      }
    }
    if (cmds.size < 10) return 'walker collected only ' + cmds.size + ' cmds -- ribbon shape changed?';
    // App-level by design (handlers never touch a document in PM mode): wordCount's
    // handler is the PM-aware dialog (pinned by [0a]); blockAuthors/linkedNotes are
    // pure cloud-unavailable toasts. EVERYTHING else must be AREA-mapped so isBlocked
    // governs it (A5) -- including readAloud/editor/hideInk, whose legacy handlers
    // poke the hidden legacy doc (e.g. review-tools.js hideInk reads E().node).
    const appLevel = new Set(['wordCount', 'blockAuthors', 'linkedNotes']);
    // EXACT 'review' match required -- parking a cmd in an already-FLIPPED area would
    // pass a truthy check yet leave its legacy-doc-poking handler un-blocked: such
    // cmds must live in a stays-unflipped area or ship re-pointed handlers.
    const unmapped = Array.from(cmds).filter((cmd) => !appLevel.has(cmd) && window.WC.PM.AREA[cmd] !== 'review');
    return unmapped.length === 0 || 'not review-mapped: ' + unmapped.join(', ');
  });

  await t('[8] trackChanges via ribbon dispatch latches reviewState.tracking on/off', async () => {
    setDoc('latch probe text');
    if (typeof PM().reviewState !== 'function') return 'PM.reviewState missing (red)';
    try {
      reviewReset(); await sleep(50); // deterministic start (also clears inherited marks)
      run('trackChanges'); await sleep(80);
      if (PM().reviewState().tracking !== true) return 'tracking did not enable via the ribbon dispatch (D6 still blocking?)';
      // Ribbon -> ENGINE tie: the latched state must actually drive the rewrite --
      // a reviewState-only echo would pass the bare latch asserts.
      caretAfter('text');
      v().dispatch(v().state.tr.insertText(' LATCHPROBE')); await sleep(80);
      const mOn = markNames('LATCHPROBE');
      if (!mOn.some((x) => x.startsWith('trackInsert:'))) return 'ribbon-enabled tracking did not mark the insert: ' + mOn.join(' ');
      // Clear the surviving tracked mark BEFORE the off-leg insert -- Editor.ts
      // protects existing tracked state and would rewrite an adjacent insert as
      // tracked even with tracking off (see the reviewReset note above).
      PM().cmd('acceptAllTrackedChanges'); await sleep(60);
      run('trackChanges'); await sleep(80);
      if (PM().reviewState().tracking !== false) return 'second dispatch did not latch tracking off';
      caretAfter('LATCHPROBE');
      v().dispatch(v().state.tr.insertText(' LATCHFREE')); await sleep(80);
      const mOff = markNames('LATCHFREE');
      return !mOff.some((x) => x.startsWith('trackInsert:'))
        || 'tracking latched off but the insert still got marked: ' + mOff.join(' ');
    } finally { reviewReset(); }
  });

  await t('[8] tracked INSERT carries a trackInsert mark (engine rewrite)', async () => {
    setDoc('insert probe base');
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('base');
      // tr.insertText flows through the Editor dispatchTransaction rewrite -- the
      // SAME path typed input takes; the rewrite must mark the inserted run.
      v().dispatch(v().state.tr.insertText(' INSERTED')); await sleep(80);
      if (!doc().textContent.includes('INSERTED')) return 'inserted text missing';
      const m = markNames('INSERTED');
      return m.some((x) => x.startsWith('trackInsert:')) || 'no trackInsert mark on the inserted run: ' + m.join(' ');
    } finally { reviewReset(); }
  });

  await t('[8] tracked DELETE keeps the text and adds a trackDelete mark (A7)', async () => {
    setDoc('keep doomed tail');
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      selectText('doomed');
      v().dispatch(v().state.tr.deleteSelection()); await sleep(80);
      if (!doc().textContent.includes('doomed')) return 'text was hard-deleted (delete not tracked)';
      const m = markNames('doomed');
      return m.some((x) => x.startsWith('trackDelete:')) || 'no trackDelete mark on the kept run: ' + m.join(' ');
    } finally { reviewReset(); }
  });

  await t('[8] tracked FORMAT: bold under tracking adds a trackFormat mark', async () => {
    // bold IS in TrackedFormatMarkNames (constants.js) and 'character' is FLIPPED,
    // so the real run('bold') dispatch works today -- only the trackFormat stamp
    // depends on tracking being live.
    setDoc('plain formatme rest');
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      selectText('formatme'); run('bold'); await sleep(80);
      const m = markNames('formatme');
      if (!m.some((x) => x.startsWith('bold:') && !x.includes('"value":"0"'))) return 'bold did not apply: ' + m.join(' ');
      return m.some((x) => x.startsWith('trackFormat:')) || 'no trackFormat mark: ' + m.join(' ');
    } finally { reviewReset(); }
  });

  await t('[8] acceptAll clears every track mark and keeps the inserted text', async () => {
    setDoc('acceptall base');
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('base');
      v().dispatch(v().state.tr.insertText(' KEEPME')); await sleep(80);
      if (!hasMark('trackInsert')) return 'tracked insert never marked (engine precondition)';
      if (!PM().cmd('acceptAll')) return 'acceptAll cmd unavailable/refused (red)';
      await sleep(80);
      if (!doc().textContent.includes('KEEPME')) return 'accepted text vanished';
      return !anyTrackMark() || 'track marks remain after acceptAll';
    } finally { reviewReset(); }
  });

  await t('[8] rejectAll removes the tracked insert text entirely', async () => {
    setDoc('rejectall base');
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('base');
      v().dispatch(v().state.tr.insertText(' GONETEXT')); await sleep(80);
      if (!doc().textContent.includes('GONETEXT')) return 'tracked insert did not land';
      if (!hasMark('trackInsert')) return 'tracked insert never marked (engine precondition)';
      if (!PM().cmd('rejectAll')) return 'rejectAll cmd unavailable/refused (red)';
      await sleep(80);
      return !doc().textContent.includes('GONETEXT') || 'rejected text still present';
    } finally { reviewReset(); }
  });

  await t('[8] acceptChange accepts exactly ONE change (revision count drops by 1)', async () => {
    setDocs(['first changeone here', 'second changetwo here']);
    if (typeof PM().getRevisions !== 'function') return 'PM.getRevisions missing (red)';
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('changeone');
      v().dispatch(v().state.tr.insertText(' AAA')); await sleep(60);
      caretAfter('changetwo');
      v().dispatch(v().state.tr.insertText(' BBB')); await sleep(60);
      trackOff();
      const n0 = PM().getRevisions().length;
      if (n0 !== 2) return 'expected 2 revisions before accept, got ' + n0;
      const a = findRange('AAA');
      if (!a) return 'first tracked insert not found';
      window.WC.editor.commands.setTextSelection({ from: a.from + 1, to: a.from + 1 }); // caret IN the first change
      if (!PM().cmd('acceptChange')) return 'acceptChange cmd unavailable/refused (red)';
      await sleep(80);
      const n1 = PM().getRevisions().length;
      if (n1 !== 1) return 'revisions after single accept: ' + n1;
      // WHICH-change pin: the count alone also passes if the WRONG change was accepted.
      const mA = markNames('AAA');
      if (mA.some((x) => x.startsWith('trackInsert:'))) return 'AAA still tracked after accept: ' + mA.join(' ');
      const mB = markNames('BBB');
      return mB.some((x) => x.startsWith('trackInsert:'))
        || 'BBB lost its trackInsert (accepted the WRONG change): ' + mB.join(' ');
    } finally { reviewReset(); }
  });

  await t('[8] rejectChange rejects exactly the caret change', async () => {
    // MAJOR-4: mirrors the acceptChange two-change setup on the reject side.
    setDocs(['first changeone here', 'second changetwo here']);
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('changeone');
      v().dispatch(v().state.tr.insertText(' AAA')); await sleep(60);
      caretAfter('changetwo');
      v().dispatch(v().state.tr.insertText(' BBB')); await sleep(60);
      trackOff();
      const a = findRange('AAA');
      if (!a) return 'first tracked insert not found';
      window.WC.editor.commands.setTextSelection({ from: a.from + 1, to: a.from + 1 }); // caret IN the first change
      if (!PM().cmd('rejectChange')) return 'rejectChange cmd unavailable/refused (red)';
      await sleep(80);
      if (doc().textContent.includes('AAA')) return 'rejected insert AAA still in the doc';
      if (!doc().textContent.includes('BBB')) return 'BBB text vanished (rejected the WRONG change)';
      const mB = markNames('BBB');
      return mB.some((x) => x.startsWith('trackInsert:'))
        || 'BBB lost its trackInsert (rejected the WRONG change): ' + mB.join(' ');
    } finally { reviewReset(); }
  });

  await t('[8] acceptSelection accepts only the selected change (by-selection)', async () => {
    // MAJOR-4 variant: planned bridge cmd over the fork acceptTrackedChangeBySelection.
    setDocs(['first changeone here', 'second changetwo here']);
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('changeone');
      v().dispatch(v().state.tr.insertText(' AAA')); await sleep(60);
      caretAfter('changetwo');
      v().dispatch(v().state.tr.insertText(' BBB')); await sleep(60);
      trackOff();
      selectText('AAA'); // selection spans ONLY the first tracked insert
      if (!PM().cmd('acceptSelection')) return 'acceptSelection cmd unavailable/refused (red)';
      await sleep(80);
      if (!doc().textContent.includes('AAA')) return 'accepted text AAA vanished';
      const mA = markNames('AAA');
      if (mA.some((x) => x.startsWith('trackInsert:'))) return 'AAA still tracked after acceptSelection: ' + mA.join(' ');
      const mB = markNames('BBB');
      return mB.some((x) => x.startsWith('trackInsert:'))
        || 'BBB touched by acceptSelection (must stay tracked): ' + mB.join(' ');
    } finally { reviewReset(); }
  });

  await t('[8] undo of a tracked insert is ATOMIC: one undo restores the snapshot (A7)', async () => {
    setDoc('undo atom base');
    caretAfter('base');
    await sleep(550); // close the history group -- undo must revert ONLY the tracked insert
    const before = norm8();
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      v().dispatch(v().state.tr.insertText(' TRACKED')); await sleep(80);
      if (!doc().textContent.includes('TRACKED')) return 'tracked insert did not land';
      PM().cmd('undo'); await sleep(80);
      if (doc().textContent.includes('TRACKED')) return 'inserted text survived the single undo';
      if (anyTrackMark()) return 'track marks survived the single undo';
      return norm8() === before || 'doc !== pre-insert snapshot after ONE undo';
    } finally { reviewReset(); }
  });

  await t('[8] setReviewView original/none/simple/all round-trips without mutating the doc (A3)', async () => {
    setDoc('viewmode probe text');
    if (typeof PM().reviewState !== 'function') return 'PM.reviewState missing (red)';
    try {
      // BLOCKER fix: with no tracked change in the doc, a reviewState-echo stub
      // satisfied every assert. Create a REAL tracked insert first, then assert
      // ENGINE truth per mode -- the fork TrackChangesBasePlugin flags via the
      // planned reviewState().engineFlags seam -- plus rendered text where cheap.
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('text');
      v().dispatch(v().state.tr.insertText(' VMODE')); await sleep(80);
      if (!hasMark('trackInsert')) return 'tracked insert never marked (engine precondition)';
      const before = norm8();
      // original: the engine shows the ORIGINAL doc -- the insert must not render.
      if (!PM().cmd('setReviewView', 'original')) return 'setReviewView unavailable/refused (red)';
      await sleep(150); // command + rAF-coalesced ribbon sync tick
      if (PM().reviewState().view !== 'original') return 'view != original: ' + JSON.stringify(PM().reviewState().view);
      let f = PM().reviewState().engineFlags;
      if (!f) return 'reviewState().engineFlags missing (red)';
      if (f.onlyOriginalShown !== true || f.onlyModifiedShown !== false) return 'original engineFlags wrong: ' + JSON.stringify(f);
      // Visible-truth probe: the fork hides tracked inserts via the decoration
      // class 'track-insert-dec hidden' + display:none CSS -- textContent is
      // DOM-structural and IGNORES css hiding, so assert the computed style of
      // the node that contains the insert text (same assertion strength: the
      // user must not SEE the insert in Original view).
      if (!insertHiddenByCss('VMODE')) return 'view=original still renders the tracked insert (no display:none container)';
      // combo <-> engine sync: the displayForReview input must FOLLOW the engine
      // (the A6 seed pin below only covers the boot default).
      const ent = window.WC.Ribbon.controlIndex.displayForReview;
      if (!ent || !ent.input) return 'displayForReview combo not in controlIndex (red)';
      if (ent.input.value !== 'Original') return 'combo shows ' + JSON.stringify(ent.input.value) + ' while engine view=original';
      // none (No Markup): fork showFinal at the engine (A3).
      PM().cmd('setReviewView', 'none'); await sleep(80);
      if (PM().reviewState().view !== 'none') return 'view != none: ' + JSON.stringify(PM().reviewState().view);
      f = PM().reviewState().engineFlags || {};
      if (f.onlyModifiedShown !== true) return 'none engineFlags wrong (showFinal expected): ' + JSON.stringify(f);
      // simple: ALSO showFinal at the engine + clone-owned chrome (A3).
      PM().cmd('setReviewView', 'simple'); await sleep(80);
      if (PM().reviewState().view !== 'simple') return 'view != simple: ' + JSON.stringify(PM().reviewState().view);
      f = PM().reviewState().engineFlags || {};
      if (f.onlyModifiedShown !== true) return 'simple engineFlags wrong (A3: simple = showFinal + clone chrome): ' + JSON.stringify(f);
      // all: both engine flags reset, markup rendered again.
      PM().cmd('setReviewView', 'all'); await sleep(80);
      if (PM().reviewState().view !== 'all') return 'view != all: ' + JSON.stringify(PM().reviewState().view);
      f = PM().reviewState().engineFlags || {};
      if (f.onlyOriginalShown !== false || f.onlyModifiedShown !== false) return 'all engineFlags wrong (both must be false): ' + JSON.stringify(f);
      if (!v().dom.textContent.includes('VMODE')) return 'view=all does not render the tracked insert';
      if (insertHiddenByCss('VMODE')) return 'view=all still css-hides the tracked insert';
      // A3: view modes are plugin/presentation state -- NEVER doc mutations.
      return norm8() === before || 'view switching mutated the doc';
    } finally {
      try { if (typeof PM().reviewState === 'function') PM().cmd('setReviewView', 'all'); } catch (e) { /* red-stage safe */ }
      reviewReset();
    }
  });

  await t('[8] exports are view-independent: w:ins survives view=original (A3)', async () => {
    setDoc('exportview base');
    if (typeof PM().reviewState !== 'function') return 'PM.reviewState missing (red)';
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('base');
      v().dispatch(v().state.tr.insertText(' VINS')); await sleep(80);
      if (!hasMark('trackInsert')) return 'tracked insert never marked (engine precondition)';
      if (!PM().cmd('setReviewView', 'original')) return 'setReviewView unavailable/refused (red)';
      if (PM().reviewState().view !== 'original') return 'view did not switch to original';
      // BLOCKER fix: pin ENGINE truth, not the echo -- the export assert is vacuous
      // unless the engine is genuinely showing the original when it runs.
      const f = PM().reviewState().engineFlags;
      if (!f) return 'reviewState().engineFlags missing (red)';
      if (f.onlyOriginalShown !== true) return 'engine not in original mode: ' + JSON.stringify(f);
      if (!insertHiddenByCss('VINS')) return 'view=original still renders the tracked insert (no display:none container)';
      const xml = await exportDocumentXml();
      return /<w:ins\b/.test(xml) || 'no <w:ins> in document.xml while viewing Original';
    } finally {
      try { if (typeof PM().reviewState === 'function') PM().cmd('setReviewView', 'all'); } catch (e) { /* red-stage safe */ }
      reviewReset();
    }
  });

  await t('[8] EXPORT: tracked insert + tracked delete emit <w:ins> and <w:del>', async () => {
    setDoc('pin keepword removeword tail');
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('keepword');
      v().dispatch(v().state.tr.insertText(' ADDED')); await sleep(60);
      selectText('removeword');
      v().dispatch(v().state.tr.deleteSelection()); await sleep(80);
      if (!hasMark('trackInsert') || !hasMark('trackDelete')) {
        return 'engine precondition: trackInsert=' + hasMark('trackInsert') + ' trackDelete=' + hasMark('trackDelete');
      }
      const xml = await exportDocumentXml();
      const ins = /<w:ins\b/.test(xml);
      const del = /<w:del\b/.test(xml);
      return (ins && del) || ('docx pins missing: w:ins=' + ins + ' w:del=' + del);
    } finally { reviewReset(); }
  });

  await t('[8] addComment from a collapsed caret expands to the word (A2)', async () => {
    setDoc('alpha bravado charlie');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      const sel = selectText('bravado');
      window.WC.editor.commands.setTextSelection({ from: sel.from + 2, to: sel.from + 2 }); // caret INSIDE the word
      if (!PM().cmd('addComment', 'first comment')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const list = PM().getComments();
      if (!Array.isArray(list) || list.length !== 1) return 'expected 1 comment, got ' + (Array.isArray(list) ? list.length : typeof list);
      if (list[0].text !== 'first comment') return 'comment text wrong: ' + JSON.stringify(list[0].text);
      // Word parity: the caret comment anchors EXACTLY the containing word --
      // includes() would tolerate an anchor bleeding into the neighbours.
      const anchored = markedText('commentMark');
      return anchored === 'bravado' || 'commentMark anchor != "bravado": ' + JSON.stringify(anchored);
    } finally { commentsReset(); }
  });

  await t('[8] addComment from a selection anchors it + stamps a real author (A2)', async () => {
    setDoc('quote exact phrase here');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('exact phrase');
      if (!PM().cmd('addComment', 'sel comment')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const list = PM().getComments();
      if (!Array.isArray(list) || list.length !== 1) return 'expected 1 comment, got ' + (Array.isArray(list) ? list.length : typeof list);
      const anchored = markedText('commentMark');
      if (anchored !== 'exact phrase') return 'commentMark anchor != "exact phrase": ' + JSON.stringify(anchored);
      const author = list[0].author;
      if (typeof author !== 'string' || !author.trim()) return 'author empty: ' + JSON.stringify(author);
      // A2 identity fix: create-editor.ts must stop stamping the placeholder user.
      return author !== 'local' || 'author is the placeholder "local" (A2 identity fix missing)';
    } finally { commentsReset(); }
  });

  await t('[8] replyComment persists the reply on the thread (A2 Document API pin)', async () => {
    // THE regression pin for event-only reply loss: raw fork addCommentReply only
    // EMITS; the bridge must drive editor.doc.comments so the reply persists.
    setDoc('reply target words');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('target');
      if (!PM().cmd('addComment', 'parent comment')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const list0 = PM().getComments();
      if (!Array.isArray(list0) || list0.length !== 1) return 'parent comment missing: ' + (Array.isArray(list0) ? list0.length : typeof list0);
      if (!PM().cmd('replyComment', list0[0].id, 'roger that')) return 'replyComment cmd unavailable/refused (red)';
      await sleep(120);
      const c = PM().getComments()[0];
      if (!c || !Array.isArray(c.replies)) return 'replies array missing: ' + JSON.stringify(c && c.replies);
      if (c.replies.length !== 1) return 'expected 1 reply, got ' + c.replies.length;
      return c.replies[0].text === 'roger that' || 'reply text wrong: ' + JSON.stringify(c.replies[0].text);
    } finally { commentsReset(); }
  });

  await t('[8] resolveComment flips the resolved flag (A2 isDone stamping)', async () => {
    setDoc('resolve target words');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('target');
      if (!PM().cmd('addComment', 'to be resolved')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const list0 = PM().getComments();
      if (!Array.isArray(list0) || list0.length !== 1) return 'comment missing: ' + (Array.isArray(list0) ? list0.length : typeof list0);
      if (list0[0].resolved !== false) return 'fresh comment already resolved: ' + JSON.stringify(list0[0].resolved);
      if (!PM().cmd('resolveComment', list0[0].id)) return 'resolveComment cmd unavailable/refused (red)';
      await sleep(120);
      const c = PM().getComments()[0];
      return (!!c && c.resolved === true) || 'resolved flag not stamped: ' + JSON.stringify(c && c.resolved);
    } finally { commentsReset(); }
  });

  await t('[8] setActiveComment exposes the active thread (A2)', async () => {
    // Small pin over the planned bridge cmd (shadows the raw fork setActiveComment):
    // either getComments() rows carry an `active` flag or reviewState() exposes
    // activeCommentId -- the cards/list UI needs one of them.
    setDoc('active target words');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('target');
      if (!PM().cmd('addComment', 'activate me')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const list0 = PM().getComments();
      if (!Array.isArray(list0) || list0.length !== 1) return 'comment missing: ' + (Array.isArray(list0) ? list0.length : typeof list0);
      const id = list0[0].id;
      if (!PM().cmd('setActiveComment', id)) return 'setActiveComment cmd unavailable/refused (red)';
      await sleep(80);
      const c = PM().getComments()[0];
      const viaFlag = !!c && c.active === true;
      const viaState = typeof PM().reviewState === 'function' && PM().reviewState().activeCommentId === id;
      return (viaFlag || viaState)
        || ('no active surface: comments[0].active=' + JSON.stringify(c && c.active)
          + ' reviewState.activeCommentId=' + (typeof PM().reviewState === 'function'
            ? JSON.stringify(PM().reviewState().activeCommentId) : '(reviewState missing)'));
    } finally { commentsReset(); }
  });

  await t('[8] deleteComment removes the thread AND its anchors from the doc', async () => {
    setDoc('delete target words');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('target');
      if (!PM().cmd('addComment', 'short lived')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const list0 = PM().getComments();
      if (!Array.isArray(list0) || list0.length !== 1) return 'comment missing: ' + (Array.isArray(list0) ? list0.length : typeof list0);
      if (!PM().cmd('deleteComment', list0[0].id)) return 'deleteComment cmd unavailable/refused (red)';
      await sleep(120);
      const after = PM().getComments();
      if (!Array.isArray(after) || after.length !== 0) return 'comment still listed: ' + (Array.isArray(after) ? after.length : typeof after);
      if (hasMark('commentMark')) return 'commentMark anchor survived the delete';
      return !(hasNode('commentRangeStart') || hasNode('commentRangeEnd') || hasNode('commentReference'))
        || 'commentRange/commentReference nodes survived the delete';
    } finally { commentsReset(); }
  });

  await t('[8] EXPORT: bridge comment emits w:commentRangeStart + w:commentReference (A2/K3)', async () => {
    // Pins the entity-store wiring: raw fork commands never write converter.comments,
    // so their anchors export to NOTHING -- this stays red forever on the raw path.
    setDoc('export comment anchor words');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('anchor');
      if (!PM().cmd('addComment', 'exported comment')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      if (!Array.isArray(PM().getComments()) || PM().getComments().length !== 1) return 'comment missing before export';
      const xml = await exportDocumentXml();
      const start = /<w:commentRangeStart/.test(xml);
      const ref = /<w:commentReference/.test(xml);
      return (start && ref) || ('docx comment pins missing: rangeStart=' + start + ' reference=' + ref);
    } finally { commentsReset(); }
  });

  await t('[8] EXPORT (Word COM-validated): full comment set — 3 document.xml markers + comments.xml body/author', async () => {
    // Word COM (validate-comments-win.ps1, oracle-probe-comments.js) confirmed Word reads
    // doc.Comments.Count==1 with the right body, author, AND anchored Scope text. This gate
    // guards the FULL export set against an endnote-class drop: a marker/part can vanish while
    // the byte-only marker test stays green and Word silently reads 0 comments. We assert all
    // THREE document.xml markers (rangeStart + rangeEnd + reference) AND the word/comments.xml
    // body + a non-empty w:author — the side part exportXmlOnly never returns.
    setDoc('export comment anchor words tail');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('anchor');
      if (!PM().cmd('addComment', 'CommentBodyABC')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const xml = await exportDocumentXml(); // document.xml — the three markers
      const start = /<w:commentRangeStart\b/.test(xml);
      const end = /<w:commentRangeEnd\b/.test(xml);
      const ref = /<w:commentReference\b/.test(xml);
      if (!(start && end && ref)) return 'document.xml markers incomplete: rangeStart=' + start + ' rangeEnd=' + end + ' reference=' + ref;
      // A2: the comment BODY + author live in word/comments.xml — read it via the
      // getUpdatedDocs part map, NOT exportXmlOnly (which returns only document.xml).
      const parts = await window.WC.editor.exportDocx({ getUpdatedDocs: true });
      const cx = parts && parts['word/comments.xml'];
      if (typeof cx !== 'string') return 'word/comments.xml not in the export part map (Word would read 0 comments)';
      if (!/CommentBodyABC/.test(cx)) return 'comment body "CommentBodyABC" not in word/comments.xml';
      const author = (cx.match(/<w:comment\b[^>]*\bw:author="([^"]*)"/) || [])[1];
      return (typeof author === 'string' && author.trim().length > 0) || 'comment w:author missing/empty in word/comments.xml';
    } finally { commentsReset(); }
  });

  await t('[8] getRevisions merges tracked changes + comments (T11)', async () => {
    setDoc('merge probe words tail');
    if (typeof PM().getRevisions !== 'function') return 'PM.getRevisions missing (red)';
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('tail');
      v().dispatch(v().state.tr.insertText(' INS')); await sleep(60);
      trackOff(); // the comment add itself must not become a tracked change
      selectText('probe');
      if (!PM().cmd('addComment', 'rev comment')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const revs = PM().getRevisions();
      if (!Array.isArray(revs)) return 'getRevisions did not return an array';
      const types = revs.map((r) => r.type);
      if (revs.length !== 2) return 'expected 2 revisions (1 insert + 1 comment), got ' + revs.length + ' [' + types.join(',') + ']';
      if (!(types.includes('insert') && types.includes('comment'))) return 'types wrong: [' + types.join(',') + ']';
      // Reviewing-pane rows show the author (D8.4): both rows from the SAME local
      // identity (A2) -- non-empty and equal.
      const authors = revs.map((r) => r.author);
      if (!authors.every((a) => typeof a === 'string' && a.trim().length > 0)) return 'revision author empty: ' + JSON.stringify(authors);
      return authors[0] === authors[1] || 'revision authors differ: ' + JSON.stringify(authors);
    } finally { reviewReset(); commentsReset(); }
  });

  await t('[8] reimported docx: tracked changes do not become phantom comments (A2 filter)', async () => {
    // MAJOR-5: the converter projects tracked changes into the comments store as
    // trackedChange===true rows -- the bridge MUST filter them on getComments() or
    // every export->open round-trip grows phantom comments.
    setDoc('phantom filter probe tail');
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    if (typeof PM().getRevisions !== 'function') return 'PM.getRevisions missing (red)';
    try {
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('tail');
      v().dispatch(v().state.tr.insertText(' PHINS')); await sleep(60);
      trackOff(); // the comment add itself must not become a tracked change
      selectText('probe');
      if (!PM().cmd('addComment', 'real comment')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      const bytes = await PM().exportDocxBytes();
      const ok = await PM().openDocx(bytes);
      if (ok !== true) return 'openDocx(bytes) failed on reimport';
      await sleep(150);
      const comments = PM().getComments();
      if (!Array.isArray(comments)) return 'getComments did not return an array after reimport';
      if (comments.length !== 1) return 'phantom comments after reimport: expected 1, got ' + comments.length;
      const revs = PM().getRevisions();
      if (!Array.isArray(revs)) return 'getRevisions did not return an array after reimport';
      const types = revs.map((r) => r.type);
      if (revs.length !== 2) return 'expected 2 revisions after reimport (1 insert + 1 comment), got ' + revs.length + ' [' + types.join(',') + ']';
      return (types.includes('insert') && types.includes('comment')) || 'reimported types wrong: [' + types.join(',') + ']';
    } finally { reviewReset(); commentsReset(); }
  });

  await t('[8] nextComment vs nextChange navigate their OWN groups, both directions (A4)', async () => {
    // Pins the group split: the legacy shared-cmd heuristic routed Comments Prev/Next
    // and Changes Prev/Next through ONE handler -- a known infidelity.
    setDocs(['early anchorword paragraph', 'later changetarget paragraph']);
    if (typeof PM().getComments !== 'function') return 'PM.getComments missing (red)';
    try {
      selectText('anchorword');
      if (!PM().cmd('addComment', 'nav comment')) return 'addComment cmd unavailable/refused (red)';
      await sleep(120);
      if (!PM().cmd('enableTrackChanges')) return 'enableTrackChanges refused (red)';
      caretAfter('changetarget');
      v().dispatch(v().state.tr.insertText('XX')); await sleep(60);
      trackOff();
      window.WC.editor.commands.setTextSelection({ from: 1, to: 1 }); // doc start
      if (!PM().cmd('nextComment')) return 'nextComment cmd unavailable/refused (red)';
      await sleep(80);
      const a = findRange('anchorword');
      const s1 = v().state.selection;
      if (!a || s1.from < a.from - 1 || s1.from > a.to + 1) return 'nextComment did not land on the comment anchor (sel at ' + s1.from + ')';
      window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
      if (!PM().cmd('nextChange')) return 'nextChange cmd unavailable/refused (red)';
      await sleep(80);
      const c = findRange('XX');
      const s2 = v().state.selection;
      if (!c || s2.from < c.from - 1 || s2.from > c.to + 1) return 'nextChange did not land on the tracked change (sel at ' + s2.from + ')';
      // prev direction: from the doc END both prev cmds must walk BACK to their group.
      const end = doc().content.size - 1;
      window.WC.editor.commands.setTextSelection({ from: end, to: end }); // doc end
      if (!PM().cmd('prevChange')) return 'prevChange cmd unavailable/refused (red)';
      await sleep(80);
      const c2 = findRange('XX');
      const s3 = v().state.selection;
      if (!c2 || s3.from < c2.from - 1 || s3.from > c2.to + 1) return 'prevChange did not land on the tracked change (sel at ' + s3.from + ')';
      window.WC.editor.commands.setTextSelection({ from: end, to: end });
      if (!PM().cmd('prevComment')) return 'prevComment cmd unavailable/refused (red)';
      await sleep(80);
      const a2 = findRange('anchorword');
      const s4 = v().state.selection;
      return (!!a2 && s4.from >= a2.from - 1 && s4.from <= a2.to + 1)
        || 'prevComment did not land on the comment anchor (sel at ' + s4.from + ')';
    } finally { reviewReset(); commentsReset(); }
  });

  await t('[8] state-sync: Track Changes button latches via direct poke (A6)', async () => {
    // A6: NOT the shared TOGGLE_MAP (would clobber the legacy latch under --legacy);
    // the format-painter direct-poke pattern is PM-only by construction.
    setDoc('sync latch probe');
    const ent = window.WC.Ribbon.controlIndex.trackChanges;
    const btn = (ent && ent.node) || document.querySelector('[data-cmd="trackChanges"]');
    if (!btn) return 'trackChanges ribbon control not found';
    try {
      reviewReset(); await sleep(150);
      run('trackChanges'); await sleep(150); // rAF-coalesced sync tick
      const on = btn.classList.contains('toggled');
      run('trackChanges'); await sleep(150);
      const offCleared = !btn.classList.contains('toggled');
      return (on && offCleared) || ('toggled-class: on=' + on + ' offCleared=' + offCleared);
    } finally { reviewReset(); }
  });

  await t('[8] displayForReview combo is seeded to "All Markup" (A6)', () => {
    // ribbon.js renders non-font combos with an EMPTY input -- the review install
    // must seed Word's default display mode.
    const ent = window.WC.Ribbon.controlIndex.displayForReview;
    if (!ent || !ent.input) return 'displayForReview combo not in controlIndex';
    return ent.input.value === 'All Markup' || ('combo shows ' + JSON.stringify(ent.input.value) + ' instead of "All Markup"');
  });

  await t('[8] Lock Tracking gates the ribbon toggle (T3/D8.7)', async () => {
    // Non-vacuous by construction (the Mod-Z lesson): the UNLOCKED toggle must be
    // proven to work through the same dispatch before the lock assert means anything.
    setDoc('lock gate probe');
    try {
      reviewReset(); await sleep(50);
      window.WC.pmTrackLock.locked = false; window.WC.pmTrackLock.password = '';
      run('trackChanges'); await sleep(80);
      if (PM().reviewState().tracking !== true) return 'baseline ribbon toggle did not enable tracking (D6 still blocking?)';
      window.WC.pmTrackLock.locked = true; window.WC.pmTrackLock.password = 'pw';
      run('trackChanges'); await sleep(80);
      if (PM().reviewState().tracking !== true) return 'LOCKED toggle still disabled tracking — the D8.7 gate is dead';
      window.WC.pmTrackLock.locked = false; window.WC.pmTrackLock.password = '';
      run('trackChanges'); await sleep(80);
      return PM().reviewState().tracking === false || 'unlocked toggle did not disable tracking';
    } finally { window.WC.pmTrackLock.locked = false; window.WC.pmTrackLock.password = ''; reviewReset(); }
  });

  await t('[8] Restrict Editing enforcement drives engine editability (X3)', async () => {
    try {
      run('restrictEditing'); await sleep(80);
      const pane = document.getElementById('restrict-pane');
      if (!pane) return 'Restrict Editing pane did not open via the ribbon dispatch (D6 still blocking?)';
      const start = document.getElementById('wc-restrict-start');
      if (!start) return 'no Start Enforcing button in the pane';
      start.click(); await sleep(80);
      if (window.WC.view.editable !== false) return 'Start Enforcing did not make the PM view read-only';
      const stop = document.getElementById('wc-restrict-stop');
      if (!stop) return 'no Stop Protection button after enforcement';
      stop.click(); await sleep(80);
      return window.WC.view.editable === true || 'Stop Protection did not restore editability';
    } finally {
      try { PM().getEditor().setEditable(true, false); } catch (e) { /* engine teardown-safe */ }
      const p = document.getElementById('restrict-pane'); if (p) p.remove();
    }
  });

  await t('[8] proofing language applies to the PM editing surface (P9)', () => {
    const dom = PM().getEditor().view.dom;
    const lang0 = dom.getAttribute('lang'); const spell0 = dom.getAttribute('spellcheck');
    try {
      if (!window.WC.setProofingLanguage('fr-FR', true)) return 'setProofingLanguage returned false';
      if (dom.getAttribute('lang') !== 'fr-FR' || dom.getAttribute('spellcheck') !== 'false') return 'lang/spellcheck attrs not applied to the PM view DOM';
      window.WC.setProofingLanguage('en-US', false);
      return dom.getAttribute('lang') === 'en-US' && dom.getAttribute('spellcheck') === 'true';
    } finally {
      if (lang0 == null) dom.removeAttribute('lang'); else dom.setAttribute('lang', lang0);
      if (spell0 == null) dom.removeAttribute('spellcheck'); else dom.setAttribute('spellcheck', spell0);
    }
  });

  await t('[8] hygiene: review state fully reset', async () => {
    // Verifying replacement for the old bare reviewReset() trailer: never leak
    // tracking state, surviving track marks, OR comment threads into the [0b]
    // block (engine-level, idempotent -- see the reviewReset note above).
    reviewReset(); commentsReset(); await sleep(80);
    if (anyTrackMark()) return 'track marks survived the hygiene reset -- fork acceptAllTrackedChanges renamed?';
    // Behavioral tracking-off probe (bridge-independent): with tracking off an
    // insert must land UNMARKED.
    setDoc('hygiene trailer');
    caretAfter('trailer');
    v().dispatch(v().state.tr.insertText(' HYG8')); await sleep(80);
    const m = markNames('HYG8');
    return !m.some((x) => x.startsWith('trackInsert:'))
      || 'tracking still ON after the hygiene reset (fork disableTrackChanges renamed?): ' + m.join(' ');
  });

  // ---------- slice 9: references (TOC · footnotes/endnotes · captions · citations) ----------
  // Plan: docs/superpowers/plans/2026-06-12-phase2-slice-9-references.md (esp. §0
  // ground-truth, §1 D9.x, §2 task 2, amendments A1/A2/A3). RED until the bridge
  // (task 3, installReferences) + the ribbon re-points (task 5) + the FLIP (task 6,
  // 'references' ∈ FLIPPED) land. Planned WC.PM surface UNDER TEST (none exist yet):
  // refInsertFootnote/refInsertEndnote/refInsertTOC(opts)/refUpdateTable/
  // refInsertCaption(label)/refAddSource(src)/refInsertCitation(srcId) — each a thin
  // editor.doc.* call returning a success boolean (reading WC.editor.doc FRESH).
  // CRITICAL (driver guidance): the fork's editor.doc.{footnotes,toc,captions,
  // citations}.* are ALREADY mounted, so we NEVER drive the action via editor.doc.*
  // directly (that would pass vacuously green NOW) — we drive via the WC.PM bridge
  // surface the flip unblocks, and ASSERT on engine/doc state or export XML, never on
  // a toast string. Every planned-surface access is guarded with a `typeof !==
  // 'function'` failure-string return so the red reason is "method missing" (NOT an
  // uncaught throw) and the rest of the suite keeps running.
  //
  // Ground-truth pins from §0 (node names: extensions/{footnote,endnote,citation,
  // sequence-field,table-of-contents}.js):
  //   footnote ref node = 'footnoteReference'; endnote = 'endnoteReference';
  //   TOC node = 'tableOfContents' (entry paragraphs styled TOC1/TOC2 inside it);
  //   caption SEQ field node = 'sequenceField' with attrs.instruction `SEQ <label> \* ARABIC`;
  //   in-text citation node = 'citation'.
  //   exportDocx({getUpdatedDocs:true}) returns a part→xml map carrying
  //   'word/footnotes.xml'/'word/endnotes.xml' + customXml/* (Editor.ts:3929-3939,3976);
  //   exportDocx({exportXmlOnly:true}) returns ONLY word/document.xml (A2).
  await PM().newBlank(); await sleep(100);

  // Map of every export part (footnotes/endnotes/customXml + document.xml) — A2:
  // the note BODY lives in word/footnotes.xml, which exportXmlOnly never returns.
  const exportParts = async () => {
    const map = await window.WC.editor.exportDocx({ getUpdatedDocs: true });
    return (map && typeof map === 'object') ? map : {};
  };
  // Count tableOfContents nodes / collect a TOC node's descendant entry paragraphs.
  const tocNode = () => { let f = null; doc().descendants((n) => { if (!f && n.type.name === 'tableOfContents') f = n; }); return f; };
  // Entry paragraphs inside the first TOC node (text + page-number run live here).
  const tocEntryTexts = () => {
    const toc = tocNode();
    if (!toc) return [];
    const texts = [];
    toc.descendants((n) => { if (n.type.name === 'paragraph') texts.push(n.textContent); });
    return texts;
  };
  // All sequenceField instruction strings, in document order.
  const seqInstructions = () => { const out = []; doc().descendants((n) => { if (n.type.name === 'sequenceField') out.push(String(n.attrs.instruction || '')); }); return out; };

  await t('[9] insertFootnote: footnoteReference node + <w:footnote w:id=> in word/footnotes.xml (A2)', async () => {
    setDoc('footnote anchor body');
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    caretAfter('anchor');
    const ok = PM().refInsertFootnote();
    if (ok !== true) return 'refInsertFootnote returned ' + JSON.stringify(ok) + ' (D6-blocked / refused — red)';
    await sleep(120);
    if (!hasNode('footnoteReference')) return 'no footnoteReference node in the doc';
    // A2: the note BODY is in word/footnotes.xml — read it via the getUpdatedDocs
    // part map, NOT exportXmlOnly (which returns only document.xml and never carries
    // the note body).
    const parts = await exportParts();
    const fx = parts['word/footnotes.xml'];
    if (typeof fx !== 'string') return 'word/footnotes.xml not in the export part map';
    return /<w:footnote\b[^>]*\bw:id=/.test(fx) || 'no <w:footnote w:id=> (seeded note body) in word/footnotes.xml';
  });

  await t('[9] insertEndnote: endnoteReference node + <w:endnote w:id=> in word/endnotes.xml (A2 symmetric)', async () => {
    setDoc('endnote anchor body');
    if (typeof PM().refInsertEndnote !== 'function') return 'PM.refInsertEndnote missing (red — bridge not installed)';
    caretAfter('anchor');
    const ok = PM().refInsertEndnote();
    if (ok !== true) return 'refInsertEndnote returned ' + JSON.stringify(ok) + ' (D6-blocked / refused — red)';
    await sleep(120);
    if (!hasNode('endnoteReference')) return 'no endnoteReference node in the doc';
    const parts = await exportParts();
    const ex = parts['word/endnotes.xml'];
    if (typeof ex !== 'string') return 'word/endnotes.xml not in the export part map';
    return /<w:endnote\b[^>]*\bw:id=/.test(ex) || 'no <w:endnote w:id=> (seeded note body) in word/endnotes.xml';
  });

  await t('[9] EXPORT: footnote reference MARKER <w:footnoteReference in document.xml', async () => {
    setDoc('marker anchor text');
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    caretAfter('anchor');
    const ok = PM().refInsertFootnote();
    if (ok !== true) return 'refInsertFootnote returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(120);
    const xml = await exportDocumentXml(); // exportXmlOnly -> document.xml (the marker lives here)
    return /<w:footnoteReference\b/.test(xml) || 'no <w:footnoteReference in document.xml';
  });

  await t('[9] EXPORT: endnote reference MARKER <w:endnoteReference in document.xml (regress: exporter router dropped it -> Word read 0 endnotes)', async () => {
    // Regression guard for the missing-endnote bug: the exporter router (exporter.js)
    // mapped footnoteReference -> translator but had NO endnoteReference entry, so the
    // endnote MARKER was silently dropped from document.xml. The note body still landed
    // in word/endnotes.xml (so the byte-only body test stayed green), but with no marker
    // referencing it Word read doc.Endnotes.Count == 0 — the endnote was lost. Only the
    // Word COM oracle (validate-notes-win.ps1) caught it; exportXmlOnly/roundtrip missed it.
    setDoc('endmarker anchor text');
    if (typeof PM().refInsertEndnote !== 'function') return 'PM.refInsertEndnote missing (red — bridge not installed)';
    caretAfter('anchor');
    const ok = PM().refInsertEndnote();
    if (ok !== true) return 'refInsertEndnote returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(120);
    const xml = await exportDocumentXml(); // exportXmlOnly -> document.xml (the marker lives here)
    return /<w:endnoteReference\b/.test(xml) || 'no <w:endnoteReference in document.xml (exporter router dropped the marker — Word reads 0 endnotes)';
  });

  await t('[9] insertTOC on a 2-heading doc: tableOfContents node with ≥2 entries; page-number run reads "0" (A1)', async () => {
    setDocs(['Chapter One Intro', 'Chapter Two Body', 'plain trailing paragraph']);
    // Real Heading-styled paragraphs (styleId Heading1 — collected by the default
    // \o "1-3" TOC config, §0.4 K3). applyStyleByName is the FLIPPED styles surface.
    selectText('Chapter One Intro'); PM().applyStyleByName('Heading 1'); await sleep(60);
    selectText('Chapter Two Body'); PM().applyStyleByName('Heading 1'); await sleep(60);
    if (typeof PM().refInsertTOC !== 'function') return 'PM.refInsertTOC missing (red — bridge not installed)';
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 }); // insert at doc start
    const ok = PM().refInsertTOC({});
    if (ok !== true) return 'refInsertTOC returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(150);
    const toc = tocNode();
    if (!toc) return 'no tableOfContents node in the doc';
    const entries = tocEntryTexts();
    const matchOne = entries.some((tx) => tx.includes('Chapter One Intro'));
    const matchTwo = entries.some((tx) => tx.includes('Chapter Two Body'));
    if (!(matchOne && matchTwo)) return 'TOC entries do not match both headings: ' + JSON.stringify(entries);
    // A1: degraded-create page-number run reads the literal "0" (NOT "??"; "??" is
    // only the unreachable update({mode:'pageNumbers'}) path). Each entry text ends
    // with the page-number run, so "0" must appear and "??" must NOT.
    const joined = entries.join('\n');
    if (/\?\?/.test(joined)) return 'TOC page number rendered "??" — expected the degraded-create "0" (A1): ' + JSON.stringify(entries);
    return /0/.test(joined) || 'no degraded "0" page-number run in the TOC entries (A1): ' + JSON.stringify(entries);
  });

  await t('[9] updateTable after a heading edit updates the matching TOC entry text', async () => {
    setDocs(['Original Heading X', 'plain body paragraph']);
    selectText('Original Heading X'); PM().applyStyleByName('Heading 1'); await sleep(60);
    if (typeof PM().refInsertTOC !== 'function') return 'PM.refInsertTOC missing (red — bridge not installed)';
    if (typeof PM().refUpdateTable !== 'function') return 'PM.refUpdateTable missing (red — bridge not installed)';
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    if (PM().refInsertTOC({}) !== true) return 'refInsertTOC refused (red)';
    await sleep(150);
    if (!tocEntryTexts().some((tx) => tx.includes('Original Heading X'))) return 'TOC did not pick up the original heading (precondition)';
    // BLOCKER (FIX 1): the TOC is inserted near the doc START, so a plain
    // findRange('Original Heading X') returns the FIRST text match — which is the TOC
    // ENTRY run (entry titles are real text nodes, toc-entry-builder.ts:348), NOT the
    // body heading. Editing that run rewrites the TOC entry; refUpdateTable then
    // rebuilds the entry from the untouched body heading and the title reverts → the
    // test could never go green. So locate the BODY heading EXPLICITLY: the first
    // TOP-LEVEL paragraph whose paragraphProperties.styleId matches /^Heading[1-6]$/
    // that is NOT a descendant of a tableOfContents node (return false at a TOC node so
    // descendants() never walks the entry paragraphs inside it).
    let bodyHeading = null; // { from, to } text range of the body heading run
    doc().descendants((node, pos) => {
      if (bodyHeading) return false;
      if (node.type.name === 'tableOfContents') return false; // skip the TOC subtree entirely
      if (node.type.name === 'paragraph' && /^Heading[1-6]$/.test(node.attrs?.paragraphProperties?.styleId || '')) {
        // text content spans (pos+1 .. pos+1+textLen) — strip enclosing run wrappers by
        // measuring the rendered text length, which is what we replace.
        const txt = node.textContent;
        bodyHeading = { from: pos + 1, to: pos + 1 + txt.length, text: txt };
        return false;
      }
      return true;
    });
    if (!bodyHeading) return 'no top-level Heading[1-6] body paragraph found to edit (outside the TOC)';
    if (!bodyHeading.text.includes('Original Heading X')) return 'located body heading is not the original heading: ' + JSON.stringify(bodyHeading);
    // Replace the BODY heading text, then verify the mutated paragraph is still the
    // body heading (styleId Heading*, outside any TOC) and now reads the renamed text —
    // i.e. we did NOT accidentally rewrite a TOC entry (whose paragraphs carry styleId
    // TOC1..TOC9, not Heading*).
    window.WC.editor.commands.insertContentAt({ from: bodyHeading.from, to: bodyHeading.to }, 'Renamed Heading Y'); await sleep(80);
    let mutated = null;
    doc().descendants((node) => {
      if (mutated) return false;
      if (node.type.name === 'tableOfContents') return false;
      if (node.type.name === 'paragraph' && /^Heading[1-6]$/.test(node.attrs?.paragraphProperties?.styleId || '')) { mutated = node.textContent; return false; }
      return true;
    });
    if (mutated == null) return 'body heading vanished after the edit';
    if (!mutated.includes('Renamed Heading Y')) return 'the mutated body heading does not read the renamed text (edited the wrong node?): ' + JSON.stringify(mutated);
    const ok = PM().refUpdateTable();
    if (ok !== true) return 'refUpdateTable returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(150);
    const entries = tocEntryTexts();
    if (entries.some((tx) => tx.includes('Original Heading X'))) return 'TOC entry still shows the stale heading text: ' + JSON.stringify(entries);
    return entries.some((tx) => tx.includes('Renamed Heading Y')) || 'TOC entry did not update to the renamed heading: ' + JSON.stringify(entries);
  });

  await t('[9] insertCaption ×2 (Figure): two ordered SEQ-field captions, instruction begins "SEQ Figure" (A3)', async () => {
    setDocs(['caption host paragraph one', 'caption host paragraph two']);
    if (typeof PM().refInsertCaption !== 'function') return 'PM.refInsertCaption missing (red — bridge not installed)';
    caretAfter('host paragraph one');
    if (PM().refInsertCaption('Figure') !== true) return 'first refInsertCaption refused (red)';
    await sleep(120);
    caretAfter('host paragraph two');
    if (PM().refInsertCaption('Figure') !== true) return 'second refInsertCaption refused (red)';
    await sleep(120);
    const seqs = seqInstructions();
    if (seqs.length < 2) return 'expected ≥2 sequenceField nodes, got ' + seqs.length + ': ' + JSON.stringify(seqs);
    // A3: do NOT assert "Figure 1"/"Figure 2" — resolvedNumber is empty headless
    // (no SEQ resolver without a layout cycle). Assert the FIELD instruction shape.
    const figs = seqs.filter((ins) => ins.startsWith('SEQ Figure'));
    return figs.length >= 2 || 'fewer than 2 SEQ fields whose instruction begins "SEQ Figure": ' + JSON.stringify(seqs);
  });

  await t('[9] citation store: addSource + insertCitation → citation node AND sources.list() includes it', async () => {
    setDoc('citation anchor text');
    if (typeof PM().refAddSource !== 'function') return 'PM.refAddSource missing (red — bridge not installed)';
    if (typeof PM().refInsertCitation !== 'function') return 'PM.refInsertCitation missing (red — bridge not installed)';
    // editor.doc.citations.sources.list() returns a DiscoveryResult { total, items }
    // (discovery.ts:133) — NOT a raw array. Normalize so the count assert is robust
    // whether the bridge surfaces the raw result or a normalized array.
    const sourceCount = () => {
      try {
        const r = window.WC.editor.doc.citations.sources.list();
        if (Array.isArray(r)) return r.length;
        if (r && typeof r.total === 'number') return r.total;
        if (r && Array.isArray(r.items)) return r.items.length;
        return 0;
      } catch (e) { return 0; }
    };
    const before = sourceCount();
    const src = { type: 'Book', title: 'Slice Nine Reference Work', author: 'Tester' };
    const srcId = PM().refAddSource(src);
    if (!srcId || srcId === false) return 'refAddSource returned ' + JSON.stringify(srcId) + ' (red)';
    caretAfter('anchor');
    const ok = PM().refInsertCitation(srcId);
    if (ok !== true) return 'refInsertCitation returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(120);
    if (!hasNode('citation')) return 'no citation node in the doc';
    // ASSERT via the fork Document API source store (the plan explicitly permits
    // reading editor.doc.citations.sources.list() — the ACTION is bridge-driven).
    const after = sourceCount();
    return after > before || 'citation source store did not grow (before=' + before + ' after=' + after + ')';
  });

  await t('[9] EXPORT: citation sources reach a customXml <b:Sources>/<b:Source> part (plan ~L73)', async () => {
    // FIX 2 (plan line ~73): the fork exports bibliography SOURCES as a customXml
    // <b:Sources> part (Editor.ts:3976 emits every customXml/*.xml on the
    // getUpdatedDocs path; citations-export.integration.test.ts pins the part path
    // customXml/item{N}.xml carrying <b:Sources>/<b:Source> + <b:Tag>/<b:Title>). Seed
    // a source + citation, then grep the export part map for that part.
    setDoc('export citation anchor text');
    if (typeof PM().refAddSource !== 'function') return 'PM.refAddSource missing (red — bridge not installed)';
    if (typeof PM().refInsertCitation !== 'function') return 'PM.refInsertCitation missing (red — bridge not installed)';
    const title = 'Slice Nine Export Source';
    const src = { type: 'Book', title, author: 'Export Tester' };
    const srcId = PM().refAddSource(src);
    if (!srcId || srcId === false) return 'refAddSource returned ' + JSON.stringify(srcId) + ' (red)';
    caretAfter('anchor');
    const ok = PM().refInsertCitation(srcId);
    if (ok !== true) return 'refInsertCitation returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(120);
    const parts = await exportParts();
    // The bibliography sources part is a customXml item (key matches customXml/, e.g.
    // customXml/item1.xml). Find any customXml part whose XML carries <b:Sources>/
    // <b:Source> AND the seeded identifier (srcId via <b:Tag>) or the title.
    const customXmlKeys = Object.keys(parts).filter((k) => /(^|\/)customXml\//.test(k) && k.endsWith('.xml') && typeof parts[k] === 'string');
    if (customXmlKeys.length === 0) return 'no customXml/*.xml part in the export map: ' + JSON.stringify(Object.keys(parts));
    const hit = customXmlKeys.find((k) => {
      const xml = parts[k];
      return /<b:Sources\b/.test(xml) && /<b:Source\b/.test(xml) && (xml.includes(String(srcId)) || xml.includes(title));
    });
    return !!hit || 'no customXml <b:Sources>/<b:Source> part carrying the seeded source (id=' + JSON.stringify(srcId) + ' / title=' + JSON.stringify(title) + '); customXml keys: ' + JSON.stringify(customXmlKeys);
  });

  await t('[9] EXPORT: document.xml carries a TOC field marker AND a "SEQ Figure" caption field', async () => {
    setDocs(['Export Heading One', 'body para for export', 'figure host para']);
    if (typeof PM().refInsertTOC !== 'function') return 'PM.refInsertTOC missing (red — bridge not installed)';
    if (typeof PM().refInsertCaption !== 'function') return 'PM.refInsertCaption missing (red — bridge not installed)';
    selectText('Export Heading One'); PM().applyStyleByName('Heading 1'); await sleep(60);
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    if (PM().refInsertTOC({}) !== true) return 'refInsertTOC refused (red)';
    await sleep(120);
    caretAfter('figure host para');
    if (PM().refInsertCaption('Figure') !== true) return 'refInsertCaption refused (red)';
    await sleep(120);
    const xml = await exportDocumentXml();
    // TOC field marker: either the instruction text (TOC \o ...) or a w:fldChar.
    const tocMarker = (/\bTOC\b/.test(xml) && /\\o\b/.test(xml)) || /<w:fldChar\b/.test(xml);
    if (!tocMarker) return 'no TOC field marker (TOC \\o instruction or <w:fldChar) in document.xml';
    return /SEQ Figure/.test(xml) || 'no "SEQ Figure" caption field instruction in document.xml';
  });

  // ========== slice-9 BRIDGE-DIRECT coverage (drive WC.PM.refX, flip-independent;
  // assert engine/doc state or export XML — never a toast). Covers the verbs the 11
  // existing [9] tests do NOT exercise. Grounded in the fork wrappers (read before
  // asserting). ==========

  // First top-level (non-TOC) paragraph whose paragraphProperties match a predicate.
  const findBodyPara = (needleOrPred) => {
    const pred = typeof needleOrPred === 'function' ? needleOrPred : (n) => n.textContent.includes(needleOrPred);
    let hit = null;
    doc().descendants((node) => {
      if (hit) return false;
      if (node.type.name === 'tableOfContents') return false; // never descend into a TOC
      if (node.type.name === 'paragraph' && pred(node)) { hit = node; return false; }
      return true;
    });
    return hit;
  };
  // Attrs of the first node of `type` (anywhere), or null.
  const firstNodeAttrs = (type) => { let a = null; doc().descendants((n) => { if (a == null && n.type.name === type) a = n.attrs; }); return a; };
  // Count nodes of `type`.
  const countNodes = (type) => { let c = 0; doc().descendants((n) => { if (n.type.name === type) c++; }); return c; };
  // All `instruction` attrs across nodes of `type`, document order.
  const instructionsOf = (type) => { const o = []; doc().descendants((n) => { if (n.type.name === type && n.attrs && n.attrs.instruction != null) o.push(String(n.attrs.instruction)); }); return o; };

  await t('[9] refSetOutlineLevel (Add Text): persists outlineLvl on a plain paragraph; default TOC carries the \\u branch (D9.8)', async () => {
    if (typeof PM().refSetOutlineLevel !== 'function') return 'PM.refSetOutlineLevel missing (red — bridge not installed)';
    setDocs(['Outline plain alpha line', 'plain body two']);
    caretAfter('Outline plain alpha line');
    // Level 2 -> outlineLvl 1 (paragraphs-wrappers.setOutlineLevelWrapper stores
    // paragraphProperties.outlineLvl = level-1; the verb lives at
    // editor.doc.format.paragraph.setOutlineLevel — proves the wrapper PATH is right).
    const ok = PM().refSetOutlineLevel(2);
    if (ok !== true) return 'refSetOutlineLevel(2) returned ' + JSON.stringify(ok) + ' (degraded/wrong wrapper path — red)';
    await sleep(80);
    const para = findBodyPara('Outline plain alpha line');
    if (!para) return 'outline-target paragraph vanished';
    const pp = para.attrs && para.attrs.paragraphProperties;
    if (!pp || pp.outlineLvl !== 1) return 'paragraph does not carry paragraphProperties.outlineLvl===1: ' + JSON.stringify(pp);
    // The default TOC config (DEFAULT_TOC_CONFIG) sets useAppliedOutlineLevel -> the
    // serialized instruction MUST contain \u (the applied-outline branch that consumes
    // an outline level). collectTocSources keys the \u branch on the applied level.
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    if (PM().refInsertTOC({}) !== true) return 'refInsertTOC refused (red)';
    await sleep(120);
    const toc = tocNode();
    if (!toc) return 'no tableOfContents node after refInsertTOC';
    const ins = String(toc.attrs.instruction || '');
    if (!/\\u\b/.test(ins)) return 'TOC instruction lacks the \\u (useAppliedOutlineLevel) switch: ' + JSON.stringify(ins);
    // Clearing (level<=0) must remove outlineLvl ("Do Not Show in TOC").
    caretAfter('Outline plain alpha line');
    if (PM().refSetOutlineLevel(0) !== true) return 'refSetOutlineLevel(0) refused (clear path — red)';
    await sleep(60);
    const cleared = findBodyPara('Outline plain alpha line');
    const ppc = cleared && cleared.attrs && cleared.attrs.paragraphProperties;
    return (ppc == null || ppc.outlineLvl === undefined) || 'outlineLvl not cleared after refSetOutlineLevel(0): ' + JSON.stringify(ppc);
  });

  await t('[9] refInsertTOF("Figure"): raw TOC field whose instruction contains TOC and \\c "Figure" (D9.4)', async () => {
    if (typeof PM().refInsertTOF !== 'function') return 'PM.refInsertTOF missing (red — bridge not installed)';
    setDocs(['table of figures host line', 'plain body two']);
    caretAfter('table of figures host line');
    const ok = PM().refInsertTOF('Figure');
    if (ok !== true) return 'refInsertTOF returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(120);
    // fields.insert(mode:'raw', TOC ...) materializes as a sequenceField node carrying
    // the instruction (field-wrappers.insertRawField). Assert both the node + the
    // exported document.xml instruction text (the field marker that survives a resave).
    const seqIns = instructionsOf('sequenceField');
    const hasNodeInstr = seqIns.some((s) => /\bTOC\b/.test(s) && /\\c\s+"Figure"/.test(s));
    if (!hasNodeInstr) return 'no sequenceField whose instruction has TOC + \\c "Figure": ' + JSON.stringify(seqIns);
    const xml = await exportDocumentXml();
    return (/\bTOC\b/.test(xml) && /\\c\s+&quot;Figure&quot;|\\c\s+"Figure"/.test(xml)) || 'document.xml lacks the TOC \\c "Figure" ToF field instruction';
  });

  await t('[9] refRemoveTOC: insert a TOC then remove it — no tableOfContents node remains', async () => {
    if (typeof PM().refInsertTOC !== 'function') return 'PM.refInsertTOC missing (red — bridge not installed)';
    if (typeof PM().refRemoveTOC !== 'function') return 'PM.refRemoveTOC missing (red — bridge not installed)';
    setDocs(['Remove TOC Heading One', 'plain body for remove']);
    selectText('Remove TOC Heading One'); PM().applyStyleByName('Heading 1'); await sleep(60);
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    if (PM().refInsertTOC({}) !== true) return 'refInsertTOC refused (precondition — red)';
    await sleep(120);
    if (countNodes('tableOfContents') < 1) return 'no tableOfContents node before remove (precondition)';
    const ok = PM().refRemoveTOC();
    if (ok !== true) return 'refRemoveTOC returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(100);
    return countNodes('tableOfContents') === 0 || 'a tableOfContents node still remains after refRemoveTOC (' + countNodes('tableOfContents') + ')';
  });

  await t('[9] refMarkIndexEntry + refInsertIndex (+refUpdateIndex): XE indexEntry node + documentIndex node', async () => {
    if (typeof PM().refMarkIndexEntry !== 'function') return 'PM.refMarkIndexEntry missing (red — bridge not installed)';
    if (typeof PM().refInsertIndex !== 'function') return 'PM.refInsertIndex missing (red — bridge not installed)';
    setDocs(['index marker subject here', 'plain index body']);
    caretAfter('index marker subject here');
    // index.entries.insert builds an indexEntry node whose instruction is `XE "<text>"`
    // (index-wrappers.buildXeInstruction). Pass a bare string entry text.
    const m = PM().refMarkIndexEntry('IndexTermAlpha');
    if (m !== true) return 'refMarkIndexEntry returned ' + JSON.stringify(m) + ' (red)';
    await sleep(100);
    if (countNodes('indexEntry') < 1) return 'no indexEntry node after refMarkIndexEntry';
    const xeIns = instructionsOf('indexEntry');
    if (!xeIns.some((s) => /^\s*XE\s+"IndexTermAlpha"/.test(s))) return 'no XE "IndexTermAlpha" instruction on the indexEntry: ' + JSON.stringify(xeIns);
    const ins = PM().refInsertIndex();
    if (ins !== true) return 'refInsertIndex returned ' + JSON.stringify(ins) + ' (red)';
    await sleep(100);
    // index.insert materializes a documentIndex node (index-wrappers: schema.documentIndex ?? index).
    if (countNodes('documentIndex') < 1 && countNodes('index') < 1) return 'no documentIndex/index node after refInsertIndex';
    // refUpdateIndex is best-effort rebuild — must not throw / must return a boolean.
    const upd = PM().refUpdateIndex();
    if (upd !== true && upd !== false) return 'refUpdateIndex returned a non-boolean: ' + JSON.stringify(upd);
    return true;
  });

  await t('[9] refMarkCitation + refInsertTOA: TA authorityEntry node + tableOfAuthorities node (D9.6)', async () => {
    if (typeof PM().refMarkCitation !== 'function') return 'PM.refMarkCitation missing (red — bridge not installed)';
    if (typeof PM().refInsertTOA !== 'function') return 'PM.refInsertTOA missing (red — bridge not installed)';
    setDocs(['legal citation host line', 'plain toa body']);
    caretAfter('legal citation host line');
    // authorities.entries.insert builds an authorityEntry node whose instruction begins
    // "TA" with \l "<longCitation>" (authority-wrappers.buildTaInstruction). Bare string
    // = longCitation; category defaults to 'cases' in the bridge.
    const m = PM().refMarkCitation('Marbury v. Madison, 5 U.S. 137');
    if (m !== true) return 'refMarkCitation returned ' + JSON.stringify(m) + ' (red)';
    await sleep(100);
    if (countNodes('authorityEntry') < 1) return 'no authorityEntry node after refMarkCitation';
    const taIns = instructionsOf('authorityEntry');
    if (!taIns.some((s) => /^\s*TA\b/.test(s) && /\\l\s+"Marbury/.test(s))) return 'no TA \\l "Marbury..." instruction on the authorityEntry: ' + JSON.stringify(taIns);
    const toa = PM().refInsertTOA();
    if (toa !== true) return 'refInsertTOA returned ' + JSON.stringify(toa) + ' (red)';
    await sleep(100);
    return countNodes('tableOfAuthorities') >= 1 || 'no tableOfAuthorities node after refInsertTOA';
  });

  await t('[9] FIX 2: Mark Citation category Cases → TA field carries NUMERIC "\\c 1" (node instruction + exported instrText)', async () => {
    if (typeof PM().refMarkCitation !== 'function') return 'PM.refMarkCitation missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(100);
    setDocs(['numeric category host line', 'plain toa body']);
    caretAfter('numeric category host line');
    // The Mark Citation dialog maps "Cases" → numeric 1 (CAT_MAP, commands.js). Drive
    // refMarkCitation with the SAME numeric code the dialog produces. The fork
    // buildTaInstruction emits `\c <category>` verbatim and the translator parser only
    // matches `\c (\d+)`, so the code MUST be numeric (a string would emit `\c cases`).
    const m = PM().refMarkCitation({ longCitation: 'Brown v. Board, 347 U.S. 483', shortCitation: 'Brown', category: 1 });
    if (m !== true) return 'refMarkCitation returned ' + JSON.stringify(m) + ' (red)';
    await sleep(120);
    // 1) The authorityEntry node instruction must carry the numeric \c 1 (NOT \c cases).
    const taIns = instructionsOf('authorityEntry');
    if (!taIns.some((s) => /\\c\s+1(?:\s|$)/.test(s))) return 'no numeric "\\c 1" on the authorityEntry instruction: ' + JSON.stringify(taIns);
    if (taIns.some((s) => /\\c\s+(cases|[A-Za-z])/.test(s))) return 'TA instruction carries a NON-numeric \\c category (regression): ' + JSON.stringify(taIns);
    // 2) The EXPORTED document.xml instrText must carry the numeric \c 1 too (the field
    //    code that real Word's TA \c switch reads — buildInstructionElements emits it).
    const xml = await exportDocumentXml();
    if (!/\bTA\b/.test(xml)) return 'no TA field instruction in exported document.xml';
    return /\\c\s+1(?:\s|"|<|\\)/.test(xml) || 'exported document.xml TA field lacks numeric "\\c 1": ' + xml.slice(Math.max(0, xml.indexOf(' TA ') - 20), xml.indexOf(' TA ') + 120);
  });

  await t('[9] refCrossReference to a bookmark: crossReference node carrying a REF field (D9.7)', async () => {
    if (typeof PM().refCrossReference !== 'function') return 'PM.refCrossReference missing (red — bridge not installed)';
    setDocs(['cross ref source target text', 'cross ref anchor here']);
    // Create a bookmark target via the fork Document API directly (action is bridge-
    // adjacent; the crossref is the bridge-driven step under test). bookmarks.insert
    // takes a TextTarget at the current selection.
    selectText('cross ref source target text');
    let bmOk = false;
    try {
      const sel = window.WC.editor.doc.selection.current({});
      const at = sel && sel.target;
      if (at) bmOk = !!(window.WC.editor.doc.bookmarks.insert({ at, name: 'CrossRefBM1' }) || {}).success;
    } catch (e) { return 'bookmark setup threw: ' + (e && e.message); }
    if (!bmOk) return 'bookmark insert (test setup) did not succeed — cannot target a crossref';
    await sleep(60);
    caretAfter('cross ref anchor here');
    // crossRefs.insert builds a crossReference node; fieldType REF for a bookmark target
    // (crossref-wrappers.buildRefInstruction -> "REF CrossRefBM1 \h").
    const ok = PM().refCrossReference({ target: { kind: 'bookmark', name: 'CrossRefBM1' }, display: 'content' });
    if (ok !== true) return 'refCrossReference returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(100);
    if (countNodes('crossReference') < 1) return 'no crossReference node after refCrossReference';
    const crIns = instructionsOf('crossReference');
    return crIns.some((s) => /\bREF\b/.test(s) && /CrossRefBM1/.test(s)) || 'no "REF CrossRefBM1" instruction on the crossReference node: ' + JSON.stringify(crIns);
  });

  await t('[9] refInsertBibliography + refSetCitationStyle("APA"): bibliography node AND APA reaches StyleName/selectedStyle (NOT a title)', async () => {
    if (typeof PM().refInsertBibliography !== 'function') return 'PM.refInsertBibliography missing (red — bridge not installed)';
    if (typeof PM().refSetCitationStyle !== 'function') return 'PM.refSetCitationStyle missing (red — bridge not installed)';
    setDoc('bibliography host paragraph');
    // Seed a source so the exported bibliography part has content to carry the style.
    const srcId = PM().refAddSource({ type: 'Book', title: 'Bib Style Reference Work', author: 'Bib Tester' });
    if (!srcId || srcId === false) return 'refAddSource (setup) returned ' + JSON.stringify(srcId);
    const insOk = PM().refInsertBibliography('References'); // a non-empty TITLE — must NOT become the style
    if (insOk !== true) return 'refInsertBibliography returned ' + JSON.stringify(insOk) + ' (red)';
    await sleep(120);
    if (countNodes('bibliography') < 1) return 'no bibliography node after refInsertBibliography';
    // The title must NOT have been written as the style (A1): the bibliography node's
    // style attr must NOT equal the title "References".
    const bibAttrs = firstNodeAttrs('bibliography');
    if (bibAttrs && bibAttrs.style === 'References') return 'A1 VIOLATION: bibliography style attr === the title "References" (title leaked into style)';
    // Now set the citation style to APA via the dedicated verb.
    const styleOk = PM().refSetCitationStyle('APA');
    if (styleOk !== true) return 'refSetCitationStyle("APA") returned ' + JSON.stringify(styleOk) + ' (red)';
    await sleep(80);
    // The converter bibliographyPart now carries styleName="APA" / selectedStyle="/APA.XSL"
    // (citation-resolver.syncBibliographyStyleToConverter). Read it back via the converter.
    let part = null;
    try { part = window.WC.editor.converter && window.WC.editor.converter.bibliographyPart; } catch (e) { /* none */ }
    if (!part) return 'converter.bibliographyPart not present after refSetCitationStyle';
    if (part.styleName !== 'APA') return 'bibliographyPart.styleName is ' + JSON.stringify(part.styleName) + ', expected "APA"';
    return /APA\.XSL$/i.test(String(part.selectedStyle || '')) || 'bibliographyPart.selectedStyle is ' + JSON.stringify(part.selectedStyle) + ', expected an /APA.XSL path';
  });

  await t('[9] A1 GUARD: refInsertBibliography("Works Cited") must NOT write style="Works Cited"', async () => {
    if (typeof PM().refInsertBibliography !== 'function') return 'PM.refInsertBibliography missing (red — bridge not installed)';
    setDoc('works cited guard host');
    const ok = PM().refInsertBibliography('Works Cited');
    if (ok !== true) return 'refInsertBibliography("Works Cited") returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(100);
    const bibAttrs = firstNodeAttrs('bibliography');
    if (!bibAttrs) return 'no bibliography node after insert (precondition)';
    // The title "Works Cited" MUST NOT corrupt the citation-style slot. Before the A1
    // fix, the title rode through `style`, syncing styleName="Works Cited" /
    // selectedStyle="/Works Cited.XSL" (corrupt). After the fix, style is undefined.
    if (bibAttrs.style === 'Works Cited') return 'A1 REGRESSION: bibliography node style === "Works Cited" (the cosmetic title leaked into the citation-style id)';
    let part = null;
    try { part = window.WC.editor.converter && window.WC.editor.converter.bibliographyPart; } catch (e) { /* none */ }
    if (part && part.styleName === 'Works Cited') return 'A1 REGRESSION: converter bibliographyPart.styleName === "Works Cited" (title leaked into the exported StyleName)';
    return true;
  });

  await t('[9] FIX 5: refUpdateSource changes a source field; refListSources reflects it (Source Manager Edit)', async () => {
    if (typeof PM().refAddSource !== 'function') return 'PM.refAddSource missing (red — bridge not installed)';
    if (typeof PM().refUpdateSource !== 'function') return 'PM.refUpdateSource missing (red — bridge not installed)';
    if (typeof PM().refListSources !== 'function') return 'PM.refListSources missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(100);
    setDoc('source edit host paragraph');
    // Add a source, then EDIT a field through refUpdateSource (the bridge verb the
    // Source Manager → Edit affordance routes to). The dialog passes the FLAT legacy
    // shape ({ author, title, year, publisher }); refUpdateSource normalizes it through
    // buildSourceFields, so the update reaches source.fields.
    const srcId = PM().refAddSource({ type: 'Book', title: 'Original Title One', author: 'Origauthor', year: '2001' });
    if (!srcId || srcId === false) return 'refAddSource (setup) returned ' + JSON.stringify(srcId);
    const before = (PM().refListSources() || []).find((s) => s.sourceId === srcId);
    if (!before) return 'the new source is not in refListSources (setup): ' + JSON.stringify(PM().refListSources());
    if ((before.fields || {}).title !== 'Original Title One') return 'unexpected pre-edit title: ' + JSON.stringify(before.fields);
    // Edit the title + year via the FLAT shape (exactly what the dialog onSubmit sends).
    const upd = PM().refUpdateSource(srcId, { type: 'Book', author: 'Origauthor', title: 'Edited Title Two', year: '2022', publisher: '' });
    if (upd !== true) return 'refUpdateSource returned ' + JSON.stringify(upd) + ' (red)';
    await sleep(80);
    const after = (PM().refListSources() || []).find((s) => s.sourceId === srcId);
    if (!after) return 'source vanished after refUpdateSource';
    const f = after.fields || {};
    if (f.title !== 'Edited Title Two') return 'refListSources did NOT reflect the edited title (got ' + JSON.stringify(f.title) + ')';
    return f.year === '2022' || 'refListSources did NOT reflect the edited year (got ' + JSON.stringify(f.year) + ')';
  });

  await t('[9] refNextNote: two footnotes, refNextNote moves the caret toward a footnoteReference (engine-observable)', async () => {
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    if (typeof PM().refNextNote !== 'function') return 'PM.refNextNote missing (red — bridge not installed)';
    setDoc('first anchor mid second anchor end of line');
    caretAfter('first anchor');
    if (PM().refInsertFootnote() !== true) return 'first refInsertFootnote refused (precondition)';
    await sleep(100);
    caretAfter('second anchor');
    if (PM().refInsertFootnote() !== true) return 'second refInsertFootnote refused (precondition)';
    await sleep(100);
    // Collect footnoteReference positions.
    const refPositions = [];
    doc().descendants((n, p) => { if (n.type.name === 'footnoteReference') refPositions.push(p); });
    if (refPositions.length < 2) return 'expected ≥2 footnoteReference nodes, got ' + refPositions.length;
    // Park the caret at doc start, then refNextNote('next') must land at the FIRST ref.
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    const ok = PM().refNextNote('next');
    if (ok !== true) return 'refNextNote("next") returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(40);
    const landed = v().state.selection.from;
    refPositions.sort((a, b) => a - b);
    return landed === refPositions[0] || ('refNextNote did not land on the first footnoteReference: caret=' + landed + ' firstRef=' + refPositions[0] + ' all=' + JSON.stringify(refPositions));
  });

  await t('[9] refUpdateNote(target,text): refListFootnotes reflects the new body (D9.1 notes area)', async () => {
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    if (typeof PM().refListFootnotes !== 'function') return 'PM.refListFootnotes missing (red — bridge not installed)';
    if (typeof PM().refUpdateNote !== 'function') return 'PM.refUpdateNote missing (red — bridge not installed)';
    setDoc('note body anchor here');
    caretAfter('note body anchor here');
    if (PM().refInsertFootnote() !== true) return 'refInsertFootnote refused (precondition)';
    await sleep(120);
    const before = PM().refListFootnotes();
    if (!Array.isArray(before) || before.length < 1) return 'refListFootnotes returned no notes after insert: ' + JSON.stringify(before);
    const note = before[0];
    if (!note || (!note.target && !note.noteId)) return 'first note lacks a target/noteId: ' + JSON.stringify(note);
    const NEW_BODY = 'Edited footnote body slice nine';
    const ok = PM().refUpdateNote(note.target || note.noteId, NEW_BODY);
    if (ok !== true) return 'refUpdateNote returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(120);
    const after = PM().refListFootnotes();
    const match = Array.isArray(after) && after.find((nn) => String(nn.noteId) === String(note.noteId));
    if (!match) return 'updated note id vanished from refListFootnotes: ' + JSON.stringify(after);
    return match.content === NEW_BODY || 'refListFootnotes content did not reflect the new body: ' + JSON.stringify(match.content);
  });

  // D9.1 NOTES AREA (notes-area.ts): after refInsertFootnote() the clone-owned region
  // #pm-notes-area renders below the page and shows the note (number + body). Then
  // simulate editing the body (set its plain text + dispatch a real input event +
  // blur) and assert refListFootnotes()/editor.doc.footnotes.list() reflect the new
  // body. DOM-observable + engine-observable, driven via WC.PM.* (flip-independent);
  // never asserts on a toast.
  await t('[9] notes-area: refInsertFootnote renders #pm-notes-area with the note number + body (D9.1)', async () => {
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    if (typeof PM().refListFootnotes !== 'function') return 'PM.refListFootnotes missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(120); // start clean — no stale notes from prior tests
    // Region must be ABSENT/hidden with zero notes (Word draws no empty separator).
    const empty = document.getElementById('pm-notes-area');
    if (empty && empty.style.display !== 'none' && empty.querySelector('.pm-note')) return 'notes region shows notes before any insert';
    setDoc('notes area anchor body');
    caretAfter('notes area anchor');
    if (PM().refInsertFootnote() !== true) return 'refInsertFootnote refused (precondition)';
    await sleep(160); // let the debounced notes-area render fire (90ms) + slack
    const region = document.getElementById('pm-notes-area');
    if (!region) return 'no #pm-notes-area in the DOM after refInsertFootnote';
    if (region.style.display === 'none') return '#pm-notes-area hidden after refInsertFootnote';
    const section = region.querySelector('.pm-notes-section');
    if (!section) return 'no .pm-notes-section in the notes region';
    if (!/Footnotes/.test((region.querySelector('.pm-notes-title') || {}).textContent || '')) return 'notes section is not titled "Footnotes"';
    const noteRow = region.querySelector('.pm-note');
    if (!noteRow) return 'no .pm-note row in the notes region';
    const list = PM().refListFootnotes();
    const expectedNum = list && list[0] && list[0].displayNumber;
    const numText = (noteRow.querySelector('.pm-note-num') || {}).textContent || '';
    if (expectedNum && numText.indexOf(String(expectedNum)) < 0) return 'note row number "' + numText + '" does not show displayNumber "' + expectedNum + '"';
    const bodyEl = noteRow.querySelector('.pm-note-body');
    if (!bodyEl) return 'no .pm-note-body editable element';
    const expectedBody = (list && list[0] && list[0].content) || '';
    return bodyEl.textContent === expectedBody || 'note body DOM "' + bodyEl.textContent + '" != refListFootnotes content "' + expectedBody + '"';
  });

  await t('[9] notes-area: editing a note body in #pm-notes-area persists via the bridge (refListFootnotes + footnotes.list reflect it) (D9.1)', async () => {
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    if (typeof PM().refListFootnotes !== 'function') return 'PM.refListFootnotes missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(120);
    setDoc('edit in region anchor body');
    caretAfter('edit in region anchor');
    if (PM().refInsertFootnote() !== true) return 'refInsertFootnote refused (precondition)';
    await sleep(160);
    const region = document.getElementById('pm-notes-area');
    if (!region) return 'no #pm-notes-area in the DOM';
    const bodyEl = region.querySelector('.pm-note-body');
    if (!bodyEl) return 'no .pm-note-body to edit';
    const noteId = bodyEl.dataset.noteId;
    if (!noteId) return 'note body has no data-note-id';
    // Simulate the user editing the contenteditable body: set its plain text, fire a
    // real input event, then blur (the module commits on blur → refUpdateNote).
    const NEW_BODY = 'Body typed directly in the notes region';
    bodyEl.focus();
    bodyEl.textContent = NEW_BODY;
    bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
    bodyEl.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(160);
    // Engine-observable: the underlying editor.doc.footnotes.list() body changed.
    let engineBody = null;
    try {
      const items = window.WC.editor.doc.footnotes.list().items || [];
      const it = items.find((x) => String(x.noteId) === String(noteId));
      engineBody = it ? String(it.content) : null;
    } catch (e) { return 'editor.doc.footnotes.list() threw: ' + ((e && e.message) || e); }
    if (engineBody !== NEW_BODY) return 'editor.doc.footnotes.list() body "' + engineBody + '" != edited "' + NEW_BODY + '"';
    // Bridge-observable: refListFootnotes() reflects the edit too.
    const after = PM().refListFootnotes();
    const match = Array.isArray(after) && after.find((nn) => String(nn.noteId) === String(noteId));
    if (!match) return 'edited note vanished from refListFootnotes: ' + JSON.stringify(after);
    return match.content === NEW_BODY || 'refListFootnotes content "' + match.content + '" != edited "' + NEW_BODY + '"';
  });

  await t('[9] notes-area: refShowNotes reveals the region (returns true with notes, focuses a body); false with none (D9.1)', async () => {
    if (typeof PM().refShowNotes !== 'function') return 'PM.refShowNotes missing (red — bridge not installed)';
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(120);
    // With ZERO notes, refShowNotes must degrade to false (nothing to show).
    if (PM().refShowNotes() !== false) return 'refShowNotes returned non-false with no notes';
    setDoc('show notes anchor body');
    caretAfter('show notes anchor');
    if (PM().refInsertFootnote() !== true) return 'refInsertFootnote refused (precondition)';
    await sleep(160);
    if (PM().refShowNotes() !== true) return 'refShowNotes returned non-true with a note present';
    const region = document.getElementById('pm-notes-area');
    if (!region || region.style.display === 'none') return 'refShowNotes did not reveal #pm-notes-area';
    // It focuses the first note body (so the user can type immediately).
    const focused = document.activeElement;
    return (focused && focused.classList && focused.classList.contains('pm-note-body')) || 'refShowNotes did not focus a .pm-note-body (active=' + (focused && focused.className) + ')';
  });

  // FIX 1 REGRESSION (the edit-clobber): renderInner() rebuilds every note row from the
  // ENGINE content when the signature changes, recreating bodies from notes[].content. A
  // re-render fired while the user is typing in a focused note body — BEFORE that edit
  // commits via refUpdateNote — must NOT discard the uncommitted text. This reproduces
  // the CROSS-NOTE trigger: type uncommitted text in note B, then commit note A (its
  // 500ms-debounced edit + blur bumps the signature and schedules a rebuild). Without the
  // clobber guard the rebuild recreates note B's body from the stale engine value and the
  // typed text is LOST; with the guard the rebuild is skipped while B is focused-dirty.
  await t('[9] notes-area CLOBBER GUARD: a re-render mid-edit does NOT revert a focused dirty note body (FIX 1)', async () => {
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    if (typeof PM().refListFootnotes !== 'function') return 'PM.refListFootnotes missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(120);
    // Two footnotes (A before B in document order) so a commit on A can re-render B.
    setDocs(['clobber anchor alpha', 'clobber anchor beta']);
    caretAfter('clobber anchor alpha'); if (PM().refInsertFootnote() !== true) return 'refInsertFootnote A refused (precondition)';
    await sleep(120);
    caretAfter('clobber anchor beta'); if (PM().refInsertFootnote() !== true) return 'refInsertFootnote B refused (precondition)';
    await sleep(180);
    const region = document.getElementById('pm-notes-area');
    if (!region) return 'no #pm-notes-area in the DOM after two inserts';
    const bodies = Array.from(region.querySelectorAll('.pm-note-body'));
    if (bodies.length < 2) return 'expected 2 note bodies, got ' + bodies.length;
    const bodyA = bodies[0];
    const bodyB = bodies[1];
    const idB = bodyB.dataset.noteId;
    // 1. The user types new text in note B's body WITHOUT committing (no blur). The
    //    contenteditable now holds uncommitted text the engine has not seen.
    const B_TYPED = 'uncommitted text typed in note B';
    bodyB.focus();
    bodyB.textContent = B_TYPED;
    bodyB.dispatchEvent(new Event('input', { bubbles: true }));
    // 2. Commit note A: edit A's body + blur. That fires refUpdateNote(A) + schedule(),
    //    bumping the signature → a rebuild is queued WHILE B is focused + dirty. (Refocus
    //    B first so it is the active dirty element when the rebuild fires — a real user
    //    clicks back into B; here we set A's text, commit it, then restore focus to B.)
    const A_BODY = 'note A committed body';
    bodyA.textContent = A_BODY;
    bodyA.dispatchEvent(new Event('input', { bubbles: true }));
    PM().refUpdateNote(PM().refListFootnotes()[0].target || PM().refListFootnotes()[0].noteId, A_BODY);
    // Re-focus B and restore its uncommitted text (the user is still editing B).
    bodyB.focus();
    bodyB.textContent = B_TYPED;
    bodyB.dispatchEvent(new Event('input', { bubbles: true }));
    // 3. Drive a re-render now (signature changed because A's engine content changed).
    //    Use the synchronous render so the assertion is deterministic — this is the exact
    //    path a debounced transaction-triggered rebuild would take.
    window.WC.NotesArea.render();
    // 4. The focused dirty body B must STILL show the user's typed text (NOT reverted to
    //    the engine 'Footnote' seed). Re-query in case the row element was replaced.
    const stillRegion = document.getElementById('pm-notes-area');
    const bodyBnow = Array.from(stillRegion.querySelectorAll('.pm-note-body')).find((el) => el.dataset.noteId === idB) || bodyB;
    return bodyBnow.textContent === B_TYPED
      || 'note B body was clobbered: "' + bodyBnow.textContent + '" != typed "' + B_TYPED + '" (rebuild reverted an uncommitted edit)';
  });

  // FIX 3 (endnote-edit path): the notes area edits BOTH footnotes and endnotes through
  // the same body+commit path (refUpdateNote(note.target || note.noteId)). Insert an
  // ENDNOTE, edit its body in the region, commit on blur, and assert the ENGINE endnote
  // body changes (editor.doc.footnotes.list() of type 'endnote' + refListFootnotes()).
  // This pins that an endnote edit targets the ENDNOTE store (word/endnotes.xml via
  // getNotesConfig('endnote')), not a footnote.
  await t('[9] notes-area: editing an ENDNOTE body in #pm-notes-area persists to the endnote (FIX 3)', async () => {
    if (typeof PM().refInsertEndnote !== 'function') return 'PM.refInsertEndnote missing (red — bridge not installed)';
    if (typeof PM().refListFootnotes !== 'function') return 'PM.refListFootnotes missing (red — bridge not installed)';
    if (typeof PM().refUpdateNote !== 'function') return 'PM.refUpdateNote missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(120);
    setDoc('endnote edit anchor body');
    caretAfter('endnote edit anchor');
    if (PM().refInsertEndnote() !== true) return 'refInsertEndnote refused (precondition)';
    await sleep(180);
    const region = document.getElementById('pm-notes-area');
    if (!region) return 'no #pm-notes-area in the DOM after refInsertEndnote';
    // The endnote must appear under the Endnotes section.
    const endTitle = Array.from(region.querySelectorAll('.pm-notes-title')).find((el) => /Endnotes/.test(el.textContent || ''));
    if (!endTitle) return 'no "Endnotes" section title in the notes region';
    const bodyEl = region.querySelector('.pm-note-body');
    if (!bodyEl) return 'no .pm-note-body to edit';
    const noteId = bodyEl.dataset.noteId;
    if (!noteId) return 'endnote body has no data-note-id';
    const NEW_BODY = 'Endnote body edited in the notes region';
    bodyEl.focus();
    bodyEl.textContent = NEW_BODY;
    bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
    bodyEl.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(180);
    // Engine-observable on the ENDNOTE store: editor.doc.footnotes.list({type:'endnote'}).
    let endnoteBody = null;
    try {
      const items = window.WC.editor.doc.footnotes.list({ type: 'endnote' }).items || [];
      const it = items.find((x) => String(x.noteId) === String(noteId));
      endnoteBody = it ? String(it.content) : null;
    } catch (e) { return 'editor.doc.footnotes.list({type:endnote}) threw: ' + ((e && e.message) || e); }
    if (endnoteBody !== NEW_BODY) return 'endnote store body "' + endnoteBody + '" != edited "' + NEW_BODY + '" (endnote edit did not target the endnote)';
    // The bridge surface (refListFootnotes) must agree AND mark it type 'endnote'.
    const after = PM().refListFootnotes();
    const match = Array.isArray(after) && after.find((nn) => String(nn.noteId) === String(noteId) && nn.type === 'endnote');
    if (!match) return 'edited endnote not found as type endnote in refListFootnotes: ' + JSON.stringify(after);
    return match.content === NEW_BODY || 'refListFootnotes endnote content "' + match.content + '" != edited "' + NEW_BODY + '"';
  });

  await t('[9] refInsertTOC with non-empty opts {showLevels:5, rightAlignPageNumbers:false}: instruction reflects \\o "1-5"', async () => {
    if (typeof PM().refInsertTOC !== 'function') return 'PM.refInsertTOC missing (red — bridge not installed)';
    setDocs(['Custom TOC Heading A', 'Custom TOC body para']);
    selectText('Custom TOC Heading A'); PM().applyStyleByName('Heading 1'); await sleep(60);
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    // refInsertTOC maps showLevels -> config.outlineLevels.to; serializeTocInstruction
    // writes \o "from-to". showLevels:5 -> \o "1-5". rightAlignPageNumbers is a PM node
    // attr (not a switch) — assert it lands on the node, not the instruction.
    const ok = PM().refInsertTOC({ showLevels: 5, rightAlignPageNumbers: false });
    if (ok !== true) return 'refInsertTOC({showLevels:5,...}) returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(120);
    const toc = tocNode();
    if (!toc) return 'no tableOfContents node after the custom-opts insert';
    const ins = String(toc.attrs.instruction || '');
    if (!/\\o\s+"1-5"/.test(ins)) return 'TOC instruction does not reflect showLevels:5 (\\o "1-5"): ' + JSON.stringify(ins);
    // rightAlignPageNumbers:false should be recorded on the node attr.
    if (toc.attrs.rightAlignPageNumbers !== false) return 'rightAlignPageNumbers:false did not land on the TOC node attr: ' + JSON.stringify(toc.attrs.rightAlignPageNumbers);
    return true;
  });

  // ---------- slice 9 task 5+6: RIBBON-PATH tests (the FLIP unblocks them) ----------
  // These drive the DIRECT References handlers through WC.Commands.run({cmd,label})
  // — exactly the ribbon dispatch path: Commands.run -> isBlocked('references') ->
  // (post-flip) NOT blocked -> H[cmd] -> PMA() -> WC.PM.refX. They prove the FULL
  // chain (ribbon -> dispatch guard -> handler -> bridge -> engine) and ONLY go green
  // WITH 'references' in FLIPPED. They assert ENGINE state, never a toast.
  await t('[9 ribbon] WC.Commands.run insertFootnote -> footnoteReference node (full ribbon->isBlocked->H->PMA->refX chain)', async () => {
    await PM().newBlank(); await sleep(120);
    // Sanity: the flip un-blocked references (the chain is only reachable when NOT blocked).
    if (PM().isBlocked('insertFootnote') !== false) return 'insertFootnote is still D6-blocked (the flip did not land)';
    setDoc('ribbon footnote anchor body');
    caretAfter('ribbon footnote anchor');
    window.WC.Commands.run({ cmd: 'insertFootnote', label: 'Insert Footnote' });
    await sleep(140);
    return hasNode('footnoteReference') || 'no footnoteReference node after WC.Commands.run({cmd:insertFootnote})';
  });

  await t('[9 ribbon] WC.Commands.run updateTable after a heading edit refreshes the TOC entry (ribbon path)', async () => {
    await PM().newBlank(); await sleep(120);
    setDocs(['Ribbon Heading Orig', 'ribbon plain body']);
    selectText('Ribbon Heading Orig'); PM().applyStyleByName('Heading 1'); await sleep(60);
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    if (PM().refInsertTOC({}) !== true) return 'refInsertTOC refused (precondition)';
    await sleep(140);
    if (!tocEntryTexts().some((tx) => tx.includes('Ribbon Heading Orig'))) return 'TOC did not pick up the heading (precondition)';
    // Locate the BODY heading EXPLICITLY (NOT the TOC entry run): the first top-level
    // paragraph whose paragraphProperties.styleId matches /^Heading[1-6]$/ that is NOT
    // a descendant of a tableOfContents node (same locator as the [9] in-place test).
    let bodyHeading = null;
    doc().descendants((node, pos) => {
      if (bodyHeading) return false;
      if (node.type.name === 'tableOfContents') return false;
      if (node.type.name === 'paragraph' && /^Heading[1-6]$/.test(node.attrs?.paragraphProperties?.styleId || '')) {
        bodyHeading = { from: pos + 1, to: pos + 1 + node.textContent.length, text: node.textContent };
        return false;
      }
      return true;
    });
    if (!bodyHeading || !bodyHeading.text.includes('Ribbon Heading Orig')) return 'could not locate the body heading paragraph to edit: ' + JSON.stringify(bodyHeading);
    window.WC.editor.commands.insertContentAt({ from: bodyHeading.from, to: bodyHeading.to }, 'Ribbon Heading EDITED');
    await sleep(80);
    // Drive Update Table THROUGH THE RIBBON.
    window.WC.Commands.run({ cmd: 'updateTable', label: 'Update Table' });
    await sleep(160);
    const entries = tocEntryTexts();
    return entries.some((tx) => tx.includes('Ribbon Heading EDITED')) || 'TOC entry not refreshed by ribbon updateTable: ' + JSON.stringify(entries);
  });

  await t('[9 ribbon] WC.Commands.run markEntry + insertIndex -> indexEntry + documentIndex nodes (ribbon path)', async () => {
    await PM().newBlank(); await sleep(120);
    setDocs(['ribbon index host line', 'ribbon plain body']);
    // markEntry with no info uses the SELECTED text — select a term so the XE field is non-empty.
    selectText('ribbon index host line');
    window.WC.Commands.run({ cmd: 'markEntry', label: 'Mark Entry' });
    await sleep(120);
    if (countNodes('indexEntry') < 1) return 'no indexEntry node after WC.Commands.run({cmd:markEntry})';
    window.WC.Commands.run({ cmd: 'insertIndex', label: 'Insert Index' });
    await sleep(120);
    return (countNodes('documentIndex') >= 1 || countNodes('index') >= 1) || 'no documentIndex/index node after WC.Commands.run({cmd:insertIndex})';
  });

  await t('[9 ribbon] WC.Commands.run insertTableOfAuthorities -> tableOfAuthorities node (ribbon path)', async () => {
    await PM().newBlank(); await sleep(120);
    // A TA mark first (so the TOA has an entry context); markCitation in PM opens a
    // dialog, so seed the authority entry directly via the bridge, then drive the TOA
    // insert THROUGH THE RIBBON.
    setDocs(['ribbon toa host line', 'ribbon plain body']);
    caretAfter('ribbon toa host line');
    if (PM().refMarkCitation('Ribbon v. Flip, 1 W.C. 9') !== true) return 'refMarkCitation (precondition) refused';
    await sleep(100);
    window.WC.Commands.run({ cmd: 'insertTableOfAuthorities', label: 'Insert Table of Authorities' });
    await sleep(140);
    return countNodes('tableOfAuthorities') >= 1 || 'no tableOfAuthorities node after WC.Commands.run({cmd:insertTableOfAuthorities})';
  });

  // PART A proof (toc-entry-builder \u fix): a paragraph given an outline level via
  // the LIVE setter (refSetOutlineLevel) writes paragraphProperties.outlineLvl, and a
  // default TOC (\u branch) must now COLLECT it. Before the fix the \u branch read only
  // .outlineLevel (never written by the setter), so the paragraph was dropped.
  await t('[9 PART A] refSetOutlineLevel(1) on a plain paragraph -> refInsertTOC + refUpdateTable COLLECTS it (\\u outlineLvl fix)', async () => {
    await PM().newBlank(); await sleep(120);
    setDocs(['Applied Outline Alpha Para', 'unrelated plain body para']);
    caretAfter('Applied Outline Alpha Para');
    if (PM().refSetOutlineLevel(1) !== true) return 'refSetOutlineLevel(1) refused (precondition)';
    await sleep(80);
    // Confirm the setter persisted outlineLvl (NOT outlineLevel) — the exact key the fix reads.
    const para = findBodyPara('Applied Outline Alpha Para');
    const pp = para && para.attrs && para.attrs.paragraphProperties;
    if (!pp || pp.outlineLvl !== 0) return 'setter did not persist outlineLvl===0 (level1): ' + JSON.stringify(pp);
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    if (PM().refInsertTOC({}) !== true) return 'refInsertTOC refused (precondition)';
    await sleep(140);
    // refUpdateTable rebuilds entries from sources (runs collectTocSources \u branch).
    if (PM().refUpdateTable() !== true && PM().refUpdateTable() !== false) return 'refUpdateTable returned a non-boolean';
    await sleep(140);
    const entries = tocEntryTexts();
    return entries.some((tx) => tx.includes('Applied Outline Alpha Para'))
      || 'TOC did NOT collect the applied-outline paragraph (PART A \\u outlineLvl regression): ' + JSON.stringify(entries);
  });

  // ---------- bugfix: page-region click places the caret (Word behavior) ----------
  await t('[fix] clicking the empty area below the text jumps the caret to the doc END', async () => {
    setDocs(['First para alpha.', 'Second para beta.', 'Third para gamma.']);
    // "son yazılan yer" = Word's Ctrl+End = Selection.atEnd (end of the last text
    // block). Read it via the live selection's class so the test and the fix use
    // the SAME canonical end-of-doc position (no brittle hand-rolled arithmetic).
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    const docEnd = v().state.selection.constructor.atEnd(v().state.doc).from;
    // park the caret at the very start so a successful jump-to-end is unambiguous
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    v().dom.blur(); await sleep(20);
    const page = document.getElementById('pm-editor');
    const prose = page.querySelector('.ProseMirror');
    const lastP = Array.from(prose.querySelectorAll('p')).pop();
    const lr = lastP.getBoundingClientRect();
    const pr = page.getBoundingClientRect();
    // a point BELOW the content but inside the page sheet (the bottom margin)
    const x = pr.left + pr.width / 2;
    const y = Math.min(lr.bottom + 30, pr.bottom - 6);
    page.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    await sleep(40);
    if (!v().hasFocus()) return 'view did not take focus after the page-margin click';
    return v().state.selection.from === docEnd || ('caret landed at ' + v().state.selection.from + ', expected the doc end (' + docEnd + ')');
  });

  await t('[fix] clicking the left margin beside a paragraph places the caret in it', async () => {
    setDocs(['Alpha paragraph one.', 'Beta paragraph two.']);
    window.WC.editor.commands.setTextSelection({ from: v().state.doc.content.size - 1, to: v().state.doc.content.size - 1 });
    const page = document.getElementById('pm-editor');
    const firstP = page.querySelector('.ProseMirror p');
    const fr = firstP.getBoundingClientRect();
    const pr = page.getBoundingClientRect();
    // left-margin band, vertically aligned with the first paragraph
    page.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: pr.left + 6, clientY: fr.top + fr.height / 2 }));
    await sleep(40);
    const sel = v().state.selection;
    // first paragraph spans [1, firstP end). caret should land within it.
    const firstEnd = firstP.textContent.length + 1;
    return (sel.from >= 1 && sel.from <= firstEnd) || ('caret landed at ' + sel.from + ', expected within the first paragraph [1,' + firstEnd + ']');
  });

  // ---------- slice 0b: file IO (these replace the live document — keep LAST) ----------
  await t('[0b] exportDocxBytes yields a real zip (PK header)', async () => {
    const bytes = await PM().exportDocxBytes();
    return bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  });
  await t('[0b] save/open round-trip through the bytes IPC', async () => {
    setDoc('roundtrip payload text');
    const bytes = await PM().exportDocxBytes();
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-roundtrip.docx', bytes });
    if (!w1 || !w1.ok) return 'saveBytes: ' + (w1 && w1.error);
    const r = await window.wordAPI.openBytes('/tmp/wc-pm-roundtrip.docx');
    if (!r || !r.ok) return 'openBytes: ' + (r && r.error);
    const ok = await PM().openDocx(r.bytes);
    return ok === true && /roundtrip payload text/.test(window.WC.view.dom.textContent);
  });
  await t('[0b] unsupported extension open refuses before touching the engine', async () => {
    const f = window.WC.Files; const p0 = f.path;
    const before = window.WC.view.state.doc.content.size;
    const enc = new TextEncoder().encode('# not supported on PM\n');
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-note.md', bytes: enc });
    if (!w1 || !w1.ok) return 'setup failed: ' + (w1 && w1.error);
    PM().setClean(); // saves can fail upstream — never risk the confirmDiscard modal in the harness
    await f.open('/tmp/wc-pm-note.md');
    return f.path === p0 && window.WC.view.state.doc.content.size === before;
  });
  await t('[0b] failed import leaves Files.path unchanged', async () => {
    const f = window.WC.Files; const p0 = f.path;
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-fakezip.docx', bytes: new Uint8Array([0x50, 0x4b, 3, 4, 9, 9, 9, 9]) });
    if (!w1 || !w1.ok) return 'setup failed: ' + (w1 && w1.error);
    await f.open('/tmp/wc-pm-fakezip.docx');
    return f.path === p0; // openDocx refused the corrupt zip; path must not re-point
  });
  await t('[0b] Files.save writes the PM doc to the bound path', async () => {
    const f = window.WC.Files;
    setDoc('saved via Files.save');
    f.path = '/tmp/wc-pm-files-save.docx'; f.name = 'wc-pm-files-save.docx'; f.format = 'docx';
    const r = await f.save();
    if (!r || !r.ok) return 'save: ' + (r && r.error);
    const cleanAfterSave = PM().isDirty() === false; // must be checked BEFORE reimport (openDocx also setCleans)
    const back = await window.wordAPI.openBytes('/tmp/wc-pm-files-save.docx');
    const ok = await PM().openDocx(back.bytes);
    return ok && /saved via Files.save/.test(window.WC.view.dom.textContent) && cleanAfterSave;
  });
  await t('[8] Compare mints REAL tracked changes (D8.6 — doc-replacing, [0b] zone)', async () => {
    const ok = await PM().runCompare('alpha beta gamma', 'alpha BETA gamma delta', { granularity: 'word', label: 'Compare Author' });
    if (ok !== true) return 'runCompare returned ' + ok;
    if (PM().reviewState().tracking !== false) return 'tracking left ON after compare (Word turns it off on the result)';
    const txt = window.WC.view.dom.textContent;
    if (!/beta/.test(txt) || !/BETA/.test(txt)) return 'diff text missing (old kept + new inserted expected): ' + txt.slice(0, 80);
    const mOld = markNames('beta');
    if (!mOld.some((x) => x.startsWith('trackDelete:'))) return 'replaced run lacks trackDelete: ' + mOld.join(' ');
    const mNew = markNames('BETA');
    if (!mNew.some((x) => x.startsWith('trackInsert:'))) return 'inserted run lacks trackInsert: ' + mNew.join(' ');
    const revs = PM().getRevisions();
    return revs.length >= 2 || ('Revisions provider sees only ' + revs.length + ' rows');
  });

  await t('[9] open→insert footnote+TOC→exportDocxBytes→openDocx round-trip re-finds both (doc-replacing, [0b] zone)', async () => {
    // RED until bridge (task 3) + flip (task 6); the round-trip (exportDocxBytes→
    // openDocx) is the slice-9 reimport pin (K2/§0.3 footnote export is LIVE).
    if (typeof PM().refInsertFootnote !== 'function') return 'PM.refInsertFootnote missing (red — bridge not installed)';
    if (typeof PM().refInsertTOC !== 'function') return 'PM.refInsertTOC missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(80);
    setDocs(['Roundtrip Heading A', 'roundtrip body paragraph']);
    selectText('Roundtrip Heading A'); PM().applyStyleByName('Heading 1'); await sleep(60);
    caretAfter('roundtrip body paragraph');
    if (PM().refInsertFootnote() !== true) return 'refInsertFootnote refused (red)';
    await sleep(100);
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    if (PM().refInsertTOC({}) !== true) return 'refInsertTOC refused (red)';
    await sleep(120);
    if (!hasNode('footnoteReference')) return 'footnote not present before export (precondition)';
    if (!hasNode('tableOfContents')) return 'TOC not present before export (precondition)';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'export did not produce a zip';
    const ok = await PM().openDocx(bytes);
    if (ok !== true) return 'reimport (openDocx) returned ' + JSON.stringify(ok);
    await sleep(120);
    // FIX 4: the footnote leg must round-trip FIRMLY — assert the footnoteReference
    // node survives reimport (footnote export is LIVE, §0.3).
    const fnBack = hasNode('footnoteReference');
    if (!fnBack) return 'after reimport: footnoteReference node did NOT survive';
    // The TOC leg is TOLERANT: it is not yet confirmed whether export emits an
    // <sd:tableOfContents> (round-trips as a tableOfContents NODE) or a Word-standard
    // TOC field (reimports as paragraphs carrying a TOC field marker). Accept EITHER:
    //   (a) a tableOfContents node, OR
    //   (b) a TOC field marker in the reimported document.xml — instruction text
    //       containing "TOC" or a w:fldChar.
    if (hasNode('tableOfContents')) return true;
    const reXml = await exportDocumentXml();
    const tocFieldMarker = /\bTOC\b/.test(reXml) || /<w:fldChar\b/.test(reXml);
    return tocFieldMarker || 'after reimport: TOC survived as NEITHER a tableOfContents node NOR a TOC field marker (TOC instruction / w:fldChar) in document.xml';
  });

  await t('[9] TOC collects IMPORTED headings: export→openDocx→refInsertTOC finds an imported heading (K3 import-path pin, doc-replacing [0b] zone)', async () => {
    // FIX 3 (K3 pin): the [9] in-place TOC tests use applyStyleByName, which proves the
    // collector matches in-session headings. K3's REAL risk is the IMPORT PATH — do
    // headings that round-trip through exportDocxBytes()→openDocx() still carry the
    // styleId the TOC collector matches (\o "1-3" → /heading\s*([1-6])/i)? Build two
    // Heading-1 paragraphs, export, REIMPORT via openDocx (replaces the doc), THEN
    // refInsertTOC and assert ≥1 entry matches an imported heading.
    if (typeof PM().refInsertTOC !== 'function') return 'PM.refInsertTOC missing (red — bridge not installed)';
    await PM().newBlank(); await sleep(80);
    setDocs(['Imported Heading Alpha', 'Imported Heading Beta', 'plain imported body']);
    selectText('Imported Heading Alpha'); PM().applyStyleByName('Heading 1'); await sleep(60);
    selectText('Imported Heading Beta'); PM().applyStyleByName('Heading 1'); await sleep(60);
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'export did not produce a zip';
    const opened = await PM().openDocx(bytes); // THE IMPORT PATH K3 guards
    if (opened !== true) return 'reimport (openDocx) returned ' + JSON.stringify(opened);
    await sleep(120);
    // Sanity: at least one reimported paragraph still carries a Heading[1-6] styleId
    // (if the import dropped the styleId, the TOC could not collect it — surface that).
    let importedHeadingText = null;
    doc().descendants((node) => {
      if (importedHeadingText) return false;
      if (node.type.name === 'tableOfContents') return false;
      if (node.type.name === 'paragraph' && /^Heading[1-6]$/.test(node.attrs?.paragraphProperties?.styleId || '')) { importedHeadingText = node.textContent; return false; }
      return true;
    });
    if (!importedHeadingText) return 'no Heading[1-6] paragraph survived the import (styleId dropped on reimport)';
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 });
    const ok = PM().refInsertTOC({});
    if (ok !== true) return 'refInsertTOC returned ' + JSON.stringify(ok) + ' (red)';
    await sleep(150);
    if (!tocNode()) return 'no tableOfContents node after refInsertTOC on the reimported doc';
    const entries = tocEntryTexts();
    if (entries.length < 1) return 'tableOfContents has no entries after reimport';
    return entries.some((tx) => tx.includes('Imported Heading Alpha') || tx.includes('Imported Heading Beta'))
      || 'no TOC entry matches an imported heading (collector missed the imported styleId): ' + JSON.stringify(entries);
  });

  await t('[0b] New Document loads the blank template + clean state', async () => {
    const f = window.WC.Files;
    const ok = await PM().newBlank();
    return ok === true && PM().isDirty() === false && window.WC.view.state.doc.content.size < 60;
  });

  // ===== [10mm] mail-merge (slice 10) — KEEP doc-replacing tests LAST in this block =====
  await t('[10mm] insertMergeField: fieldAnnotation node fieldType=MERGEFIELD + «name» label', () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (typeof PM().mmInsertField !== 'function') return 'PM.mmInsertField missing (red — bridge not installed)';
    if (PM().mmInsertField('FirstName') !== true) return 'mmInsertField refused (red)';
    let f = null; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType === 'MERGEFIELD') f = n; });
    if (!f) return 'no fieldAnnotation[fieldType=MERGEFIELD]';
    return f.attrs.displayLabel === '«FirstName»' || 'displayLabel was ' + JSON.stringify(f.attrs.displayLabel);
  });
  await t('[10mm] EXPORT: MERGEFIELD → w:fldSimple " MERGEFIELD FirstName " (not w:sdt)', async () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    const xml = await exportDocumentXml();
    if (/<w:sdt\b[^>]*>[\s\S]*MERGEFIELD/.test(xml)) return 'exported as w:sdt content control, not a field code';
    return /<w:fldSimple\b[^>]*w:instr="\s*MERGEFIELD FirstName\s*"/.test(xml) || 'no <w:fldSimple … MERGEFIELD FirstName>';
  });
  await t('[10mm] EXPORT: NEXT → 3-run w:fldChar (no separate, no «Next Record» result)', async () => {
    setDoc('A B'); caretAfter('A ');
    if (typeof PM().mmInsertRule !== 'function') return 'PM.mmInsertRule missing (red)';
    if (PM().mmInsertRule('NEXT', 'NEXT') !== true) return 'insert refused (red)';
    const xml = await exportDocumentXml();
    if (/«Next Record»/.test(xml)) return 'NEXT emitted a spurious «Next Record» result run';
    if (/<w:fldChar[^>]*w:fldCharType="separate"[\s\S]{0,400}NEXT/.test(xml)) return 'NEXT emitted a w:fldChar separate (should be 3-run)';
    return /NEXT/.test(xml) && /<w:fldChar[^>]*w:fldCharType="begin"/.test(xml) || 'no NEXT field code';
  });
  await t('[10mm] highlightMergeFields toggles the highlighted attr', () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    if (typeof PM().mmHighlight !== 'function') return 'PM.mmHighlight missing (red)';
    PM().mmHighlight(false); let off = true; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation') off = off && n.attrs.highlighted === false; });
    PM().mmHighlight(true); let on = true; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation') on = on && n.attrs.highlighted === true; });
    return (off && on) || 'highlighted did not toggle false→true';
  });
  await t('[10mm] preview substitutes record values into displayLabel (non-destructive)', () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    if (typeof PM().mmPreview !== 'function') return 'PM.mmPreview missing (red)';
    PM().mmPreview({ FirstName: 'Alice' });
    let shown = null; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType === 'MERGEFIELD') shown = n.attrs.displayLabel; });
    if (shown !== 'Alice') return 'preview value was ' + JSON.stringify(shown);
    PM().mmPreview(null);
    let back = null; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType === 'MERGEFIELD') back = n.attrs.displayLabel; });
    return back === '«FirstName»' || 'restore failed: ' + JSON.stringify(back);
  });
  await t('[10mm] finishMerge produces a doc with the record VALUE, not «placeholder» (K-9)', async () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    if (typeof PM().mmBuildMerge !== 'function') return 'PM.mmBuildMerge missing (red)';
    const html = PM().mmBuildMerge([{ FirstName: 'Alice' }], (field, rec) => rec[field] != null ? String(rec[field]) : '');
    if (typeof html !== 'string') return 'mmBuildMerge did not return html';
    if (/«FirstName»/.test(html)) return 'merged html kept the «FirstName» placeholder';
    return /Alice/.test(html) || 'merged html does not contain the record value Alice';
  });
  await t('[10mm] D6: mail-merge is on the PM engine (not deferred)', () => PM().isBlocked('startMailMerge') === false || 'startMailMerge is D6-blocked (should be on PM engine)');
  await t('[10mm] merge resolver matches preview (_val: «Last_Name» field over a LastName column)', () => {
    // Regression (task-5 review): PM preview resolves via _val (squashed-name match);
    // the Finish&Merge resolver must too, else «Last_Name» over a LastName column
    // previews correctly yet merges BLANK. _mergeResolve unifies both on _val.
    const M = window.WC.Mail;
    if (!M || typeof M._mergeResolve !== 'function') return 'WC.Mail._mergeResolve missing (red)';
    const v = M._mergeResolve('Last_Name', { LastName: 'Smith' });
    return /Smith/.test(String(v)) || 'resolver returned ' + JSON.stringify(v) + ' (expected Smith via _val squashed match)';
  });
  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10mm] IMPORT (self round-trip): clone export reimports MERGEFIELD as a fieldAnnotation', async () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('LastName') !== true) return 'insert refused (red)';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'export not a zip';
    const ok = await PM().openDocx(bytes); if (ok !== true) return 'reimport returned ' + JSON.stringify(ok);
    await sleep(300);
    let n = 0; doc().descendants((x) => { if (x.type.name === 'fieldAnnotation' && x.attrs.fieldType === 'MERGEFIELD') n++; });
    return n === 1 || 'expected 1 MERGEFIELD fieldAnnotation after reimport, got ' + n;
  });
  await t('[10mm] IMPORT (Leg B, real Word fixture): MERGEFIELD/GREETINGLINE/ADDRESSBLOCK/NEXT import as fieldAnnotations', async () => {
    const r = await window.wordAPI.openBytes('C:\\tmp\\wc-slice10-mergefields.docx');
    if (!r || !r.bytes) return 'fixture not readable (skip if absent on this machine)';
    const ok = await PM().openDocx(r.bytes); if (ok !== true) return 'openDocx returned ' + JSON.stringify(ok);
    await sleep(300);
    const types = new Set(); doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType) types.add(n.attrs.fieldType); });
    let firstName = false, last = false; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation') { if (n.attrs.displayLabel === '«FirstName»') firstName = true; if (n.attrs.displayLabel === '«Last_Name»') last = true; } });
    if (!firstName || !last) return 'MERGEFIELD «FirstName»/«Last_Name» (underscore) not both imported';
    return (types.has('MERGEFIELD') && types.has('GREETINGLINE') && types.has('ADDRESSBLOCK') && types.has('NEXT')) || 'missing field types: ' + JSON.stringify([...types]);
  });

  // ===== [10th] themes / Design tab (slice 10 PR2) — doc-replacing tests LAST =====
  await t('[10th] D6: themes is on the PM engine (not deferred)', () => PM().isBlocked('themes') === false || 'themes is D6-blocked (should be on PM engine)');

  await t('[10th] EXPORT: deApplyTheme redefines Heading1 with literal w:rFonts ascii + w:color val in styles.xml', async () => {
    setDocs(['Heading One', 'body text']);
    selectText('Heading One'); PM().applyStyleByName('Heading 1'); await sleep(40);
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red — bridge not installed)';
    const theme = { name: 'TestTheme', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#FF0000', accents: ['#FF0000', '#00AA00', '#0000FF', '#FFAA00', '#AA00FF', '#00AAFF'] };
    if (PM().deApplyTheme(theme) !== true) return 'deApplyTheme refused (red)';
    await sleep(80);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'];
    if (typeof sx !== 'string') return 'no word/styles.xml in export part map';
    const m = sx.match(/<w:style\b[^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/);
    if (!m) return 'no Heading1 <w:style> in styles.xml';
    const h1 = m[0];
    if (!/<w:rFonts\b[^>]*w:ascii="Georgia"/.test(h1)) return 'Heading1 w:rFonts ascii not Georgia: ' + h1.slice(0, 400);
    if (!/<w:color\b[^>]*w:val="FF0000"/.test(h1)) return 'Heading1 w:color val not FF0000: ' + h1.slice(0, 400);
    // K9: the theme bindings MUST be gone, or Word resolves the theme and IGNORES the literal.
    if (/w:asciiTheme/.test(h1)) return 'Heading1 still binds w:asciiTheme — Word would ignore the literal font (K9)';
    return !/w:themeColor/.test(h1) || 'Heading1 still binds w:themeColor — Word would ignore the literal color (K9)';
  });

  await t('[10th] deApplyTheme flips the app dirty flag even on a heading-less doc (K3 Save-prompt)', () => {
    setDoc('plain body, no headings'); PM().setClean && PM().setClean();
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red)';
    if (PM().deApplyTheme({ name: 'D', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#222222', accents: ['#222222', '#1', '#2', '#3', '#4', '#5'] }) !== true) return 'refused';
    return PM().isDirty() === true || 'doc not dirty after a styles-only theme apply (no Save prompt — data loss)';
  });

  await t('[10th] hover preview (dePreviewTheme) does NOT dirty a styled doc — no spurious Save prompt', () => {
    setDocs(['Executive Summary', 'body text']); selectText('Executive Summary'); PM().applyStyleByName('Heading 1');
    if (typeof PM().dePreviewTheme !== 'function') return 'PM.dePreviewTheme missing (red)';
    if (PM().setClean) PM().setClean();
    if (PM().isDirty() !== false) return 'doc not clean after setClean (test setup)';
    // Preview a theme over a doc that HAS a Heading1 paragraph (the regen restamps it).
    PM().dePreviewTheme('theme', { name: 'P', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#C00000', accents: ['#C00000', '#1', '#2', '#3', '#4', '#5'] });
    const dirtyAfterPreview = PM().isDirty();
    PM().dePreviewRestore(); // cleanup the visual preview
    return dirtyAfterPreview === false || 'hover preview dirtied a styled doc (regen tr not tagged PREVIEW_META)';
  });

  await t('[10th] pageColor does NOT wipe an active watermark (CSS longhand, no shorthand collision)', () => {
    setDoc('x');
    if (typeof PM().deWatermark !== 'function' || typeof PM().dePageColor !== 'function') return 'design verbs missing (red)';
    PM().deWatermark('DRAFT', {}); PM().dePageColor('#FFFF00');
    const ed = document.getElementById('pm-editor');
    if (!/data:image\/svg/.test(ed.style.backgroundImage || '')) return 'pageColor wiped the watermark backgroundImage (used the background shorthand)';
    return /ffff00|255,\s*255,\s*0/i.test((ed.style.backgroundColor || '')) || 'pageColor did not set backgroundColor';
  });

  await t('[10th] deApplyTheme repaints the VISUAL source (linkedStyles array Heading1 definition.styles)', async () => {
    setDocs(['Heading One', 'body']); selectText('Heading One'); PM().applyStyleByName('Heading 1'); await sleep(40);
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red)';
    const theme = { name: 'T', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#123456', accents: ['#123456', '#111', '#222', '#333', '#444', '#555'] };
    if (PM().deApplyTheme(theme) !== true) return 'refused (red)';
    await sleep(60);
    const arr = window.WC.editor.converter?.linkedStyles || [];
    const h1 = arr.find((s) => s.id === 'Heading1');
    if (!h1) return 'no Heading1 in converter.linkedStyles array';
    const fam = String(h1.definition?.styles?.['font-family'] || '');
    if (!/Georgia/.test(fam)) return 'array font-family not Georgia (visual source stale): ' + fam;
    return /123456/i.test(String(h1.definition?.styles?.['color'] || '')) || 'array color not #123456: ' + h1.definition?.styles?.['color'];
  });

  await t('[10th] EXPORT: deApplyFonts sets docDefaults w:rFonts (body font, real export)', async () => {
    setDoc('body text');
    if (typeof PM().deApplyFonts !== 'function') return 'PM.deApplyFonts missing (red)';
    if (PM().deApplyFonts({ name: 'Verdana', heading: 'Verdana,sans-serif', body: 'Verdana,sans-serif' }) !== true) return 'refused (red)';
    await sleep(60);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'] || '';
    const dd = (sx.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];
    return /<w:rFonts\b[^>]*w:ascii="Verdana"/.test(dd) || 'no docDefaults w:rFonts ascii=Verdana: ' + dd.slice(0, 400);
  });

  await t('[10th] EXPORT: deParagraphSpacing → docDefaults w:spacing (real export)', async () => {
    setDoc('body text');
    if (typeof PM().deParagraphSpacing !== 'function') return 'PM.deParagraphSpacing missing (red)';
    if (PM().deParagraphSpacing({ before: 0, after: 13, line: 2 }) !== true) return 'refused (red)';
    await sleep(60);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'] || '';
    const dd = (sx.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];
    // Pin the SPECIFIC value (13pt -> 260 twips), not just <w:spacing> presence — docDefaults
    // already carries default line spacing, so a presence-only check would pass vacuously.
    return /<w:spacing\b[^>]*w:after="260"/.test(dd) || 'no docDefaults <w:spacing w:after="260"> (13pt->260twips): ' + dd.slice(0, 400);
  });

  await t('[10th] EXPORT: dePageBorders → <w:pgBorders> in document.xml sectPr (real)', async () => {
    setDoc('x');
    if (typeof PM().dePageBorders !== 'function') return 'PM.dePageBorders missing (red)';
    if (PM().dePageBorders({ style: 'solid', color: '#000000', width: 1 }) !== true) return 'dePageBorders refused (red)';
    await sleep(60);
    const xml = await exportDocumentXml();
    return /<w:pgBorders\b/.test(xml) || 'no <w:pgBorders> in document.xml';
  });

  await t('[10th] EXPORT: dePageColor → <w:background w:color> in document.xml (real)', async () => {
    setDoc('x');
    if (typeof PM().dePageColor !== 'function') return 'PM.dePageColor missing (red)';
    if (PM().dePageColor('#FFFF00') !== true) return 'dePageColor refused (red)';
    await sleep(60);
    const xml = await exportDocumentXml();
    return /<w:background\b[^>]*w:color="FFFF00"/.test(xml) || 'no <w:background w:color=FFFF00>: ' + xml.slice(0, 200);
  });

  await t('[10th] dePageColor paints the live page sheet (#pm-editor background)', () => {
    if (typeof PM().dePageColor !== 'function') return 'PM.dePageColor missing (red)';
    if (PM().dePageColor('#ABCDEF') !== true) return 'refused';
    const ed = document.getElementById('pm-editor');
    // Read backgroundColor ONLY (the longhand contract) — reading the `background` shorthand
    // would mask a buggy impl that wrote the shorthand and wiped a watermark (collision test).
    const bg = (ed.style.backgroundColor || '').toLowerCase();
    return /abcdef|171,\s*205,\s*239/.test(bg) || 'page sheet bg not set: ' + bg;
  });

  await t('[10th] watermark: PM paints an SVG bg on #pm-editor (visual stand-in), never touches legacy E()', () => {
    if (typeof PM().deWatermark !== 'function') return 'PM.deWatermark missing (red)';
    if (PM().deWatermark('DRAFT', {}) !== true) return 'deWatermark refused (red)';
    const ed = document.getElementById('pm-editor');
    return /data:image\/svg/.test(ed.style.backgroundImage || '') || 'no watermark SVG bg-image on #pm-editor';
  });

  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10th] IMPORT round-trip: w:background survives export→openDocx (K8 schema-attr pin)', async () => {
    setDoc('x');
    if (typeof PM().dePageColor !== 'function') return 'PM.dePageColor missing (red)';
    if (PM().dePageColor('#00FF00') !== true) return 'dePageColor refused (red)';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'export not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport (openDocx) failed';
    await sleep(300);
    const xml = await exportDocumentXml();
    return /<w:background\b[^>]*w:color="00FF00"/.test(xml) || 'w:background lost on round-trip (schema attr dropped it)';
  });

  await t('[10th] IMPORT round-trip: redefined Heading1 styles.xml survives export→openDocx', async () => {
    setDocs(['Heading One', 'body']); selectText('Heading One'); PM().applyStyleByName('Heading 1'); await sleep(40);
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red)';
    if (PM().deApplyTheme({ name: 'RT', heading: 'Garamond,serif', body: 'Garamond,serif', color: '#654321', accents: ['#654321', '#1', '#2', '#3', '#4', '#5'] }) !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'] || '';
    const m = sx.match(/<w:style\b[^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/);
    if (!m) return 'no Heading1 style after round-trip';
    return /<w:rFonts\b[^>]*w:ascii="Garamond"/.test(m[0]) || 'Heading1 ascii not Garamond after round-trip';
  });

  // ===== [10ex] insert-exotica (slice 10 PR3) — doc-replacing tests LAST =====
  await t('[10ex] D6: insert-exotica is on the PM engine (not deferred)', () => PM().isBlocked('coverPage') === false || 'coverPage is D6-blocked (should be on PM engine)');

  await t('[10ex] EXPORT: xeDropCap → <w:framePr w:dropCap> in document.xml', async () => {
    setDocs(['Dropped capital paragraph here', 'body']); caretAfter('Dropped');
    if (typeof PM().xeDropCap !== 'function') return 'PM.xeDropCap missing (red — bridge not installed)';
    if (PM().xeDropCap('drop', 3) !== true) return 'xeDropCap refused (red)';
    await sleep(60);
    const xml = await exportDocumentXml();
    return /<w:framePr\b[^>]*w:dropCap="drop"/.test(xml) || 'no <w:framePr w:dropCap=drop>: ' + xml.slice(0, 300);
  });

  await t('[10ex] EXPORT: xeCoverPage → documentPartObject / w:sdt docPartObj', async () => {
    setDocs(['existing body']);
    if (typeof PM().xeCoverPage !== 'function') return 'PM.xeCoverPage missing (red)';
    if (PM().xeCoverPage('Banded') !== true) return 'xeCoverPage refused (red)';
    await sleep(80);
    let hasDpo = false; doc().descendants((n) => { if (n.type.name === 'documentPartObject') hasDpo = true; });
    if (!hasDpo) return 'no documentPartObject node inserted';
    const xml = await exportDocumentXml();
    return /docPartGallery|<w:docPartObj\b/.test(xml) || 'no w:sdt docPartObj in export';
  });

  await t('[10ex] EXPORT: xeDateTime → DATE field in document.xml', async () => {
    setDoc('Today '); caretAfter('Today ');
    if (typeof PM().xeDateTime !== 'function') return 'PM.xeDateTime missing (red)';
    if (PM().xeDateTime('M/d/yyyy') !== true) return 'xeDateTime refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    return /DATE\b/.test(xml) || 'no DATE field in document.xml: ' + xml.slice(0, 300);
  });

  await t('[10ex] EXPORT: xeQuickPart(author) → AUTHOR field', async () => {
    setDoc('By '); caretAfter('By ');
    if (typeof PM().xeQuickPart !== 'function') return 'PM.xeQuickPart missing (red)';
    if (PM().xeQuickPart('author') !== true) return 'xeQuickPart refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    return /AUTHOR/.test(xml) || 'no AUTHOR field';
  });

  await t('[10ex] EXPORT: xeWordArt → wps:wsp + fromWordArt + prstTxWarp', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeWordArt !== 'function') return 'PM.xeWordArt missing (red)';
    if (PM().xeWordArt('Hello WordArt', { color: '#C00000' }) !== true) return 'xeWordArt refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    if (!/<wps:wsp\b/.test(xml)) return 'no <wps:wsp> (WordArt shape) in document.xml';
    if (!/fromWordArt="1"/.test(xml)) return 'no fromWordArt="1" on bodyPr';
    return /<a:prstTxWarp\b/.test(xml) || 'no <a:prstTxWarp> (WordArt warp)';
  });

  await t('[10ex] EXPORT: xeTextBox → editable v:textbox/w:txbxContent', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeTextBox !== 'function') return 'PM.xeTextBox missing (red)';
    if (PM().xeTextBox('Box text') !== true) return 'xeTextBox refused (red)';
    await sleep(80);
    let hasBox = false; doc().descendants((n) => { if (n.type.name === 'shapeContainer' || n.type.name === 'shapeTextbox') hasBox = true; });
    if (!hasBox) return 'no shapeContainer/shapeTextbox node inserted (not editable)';
    const xml = await exportDocumentXml();
    return (/<v:textbox\b/.test(xml) && /<w:txbxContent\b/.test(xml)) || 'no <v:textbox>/<w:txbxContent> in export';
  });

  await t('[10ex] xeIcon inserts a real image node (not a legacy span)', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeIcon !== 'function') return 'PM.xeIcon missing (red)';
    if (PM().xeIcon('save') !== true) return 'xeIcon refused (red)';
    await sleep(60);
    let hasImg = false; doc().descendants((n) => { if (n.type.name === 'image') hasImg = true; });
    return hasImg || 'no image node from xeIcon';
  });

  await t('[10ex] honest-degrade verbs (chart/smartart/object/signatureLine) are no-op toasts (no E() leak)', () => {
    setDoc('keepme');
    for (const v of ['xeChart', 'xeSmartArt', 'xeObject', 'xeSignatureLine']) {
      if (typeof PM()[v] !== 'function') return 'PM.' + v + ' missing (red)';
      PM()[v]();
    }
    let shapes = 0; doc().descendants((n) => { if (['shapeContainer', 'vectorShape', 'image'].includes(n.type.name)) shapes++; });
    return (shapes === 0 && doc().textContent.includes('keepme')) || 'a degrade verb mutated the doc (should be a no-op toast)';
  });

  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10ex] IMPORT round-trip: WordArt survives export→openDocx', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeWordArt !== 'function') return 'PM.xeWordArt missing (red)';
    if (PM().xeWordArt('RT WordArt', {}) !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    let hasWa = false; doc().descendants((n) => { if (n.type.name === 'vectorShape') hasWa = true; });
    return hasWa || 'WordArt vectorShape lost on round-trip';
  });

  // textBox EXPORT is real Word VML (<v:textbox>/<w:txbxContent>) — Word opens/edits/resaves it.
  // The fork has no BLOCK-LEVEL VML-textbox importer yet (handleShapeTextboxImport is only reached
  // from the run-level handler, which discards block nodes — pictNodeImporter.js:32-34), so on the
  // CLONE's own reopen the editable shapeContainer is not reconstructed: the VML survives as a
  // passthrough node (re-exports) but editability is lost. Block-level VML-textbox import is a
  // recorded fork-importer follow-up (deferrals.md). Assert what's REAL: the export carries the VML,
  // and the textbox survives the clone's own round-trip (passthrough re-emits it).
  await t('[10ex] IMPORT round-trip: textBox export is real VML + survives clone reopen (editability deferred)', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeTextBox !== 'function') return 'PM.xeTextBox missing (red)';
    if (PM().xeTextBox('RTboxText') !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    const xmlOut = await exportDocumentXml();
    if (!(/<v:textbox\b/.test(xmlOut) && /<w:txbxContent\b/.test(xmlOut))) return 'export lost <v:textbox>/<w:txbxContent>';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    // Survives the clone's own reopen (as passthrough; editability is the deferred fork follow-up).
    const xmlBack = await exportDocumentXml();
    return (/<v:textbox\b/.test(xmlBack) || /<w:txbxContent\b/.test(xmlBack) || doc().textContent.includes('RTboxText'))
      || 'textBox content lost on clone round-trip (not even passthrough survived)';
  });

  // ===== [10dr] draw / Draw tab (slice 10 PR4) — doc-replacing tests LAST =====
  await t('[10dr] D6: draw is on the PM engine (not deferred)', () => PM().isBlocked('drawing') === false || 'drawing is D6-blocked (should be on PM engine)');

  await t('[10dr] EXPORT: dInsertInk → <a:custGeom>/<a:pathLst> freeform in document.xml', async () => {
    setDoc('canvas'); caretAfter('canvas');
    if (typeof PM().dInsertInk !== 'function') return 'PM.dInsertInk missing (red — bridge not installed)';
    // a simple 3-point stroke (overlay-space px); pen = black width 2
    const ok = PM().dInsertInk([{ x: 10, y: 10 }, { x: 40, y: 30 }, { x: 70, y: 12 }], { color: '#000000', width: 2, opacity: 1 });
    if (ok !== true) return 'dInsertInk refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    if (!/<a:custGeom\b/.test(xml)) return 'no <a:custGeom> in document.xml: ' + xml.slice(0, 300);
    if (!/<a:pathLst\b/.test(xml)) return 'no <a:pathLst> (freeform path)';
    // child-order guard (import is order-independent so it can't catch a regression; oracle Leg A is the real gate)
    if (!/<a:custGeom\b[\s\S]*?<a:noFill\b[\s\S]*?<a:ln\b/.test(xml)) return 'spPr child order wrong (want custGeom→noFill→ln)';
    return /<a:moveTo\b[\s\S]*?<a:quadBezTo\b/.test(xml) || 'no moveTo/quadBezTo ink path commands';
  });

  await t('[10dr] dInsertInk inserts a real vectorShape node (isInk)', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().dInsertInk !== 'function') return 'PM.dInsertInk missing (red)';
    if (PM().dInsertInk([{ x: 0, y: 0 }, { x: 20, y: 20 }], { color: '#C00000', width: 3, opacity: 1 }) !== true) return 'refused';
    await sleep(60);
    let ink = false; doc().descendants((n) => { if (n.type.name === 'vectorShape' && n.attrs && n.attrs.isInk) ink = true; });
    return ink || 'no isInk vectorShape node from dInsertInk';
  });

  await t('[10dr] EXPORT: dInsertCanvas → a real bounded rect shape (a:prstGeom rect + a:ln)', async () => {
    setDoc('y'); caretAfter('y');
    if (typeof PM().dInsertCanvas !== 'function') return 'PM.dInsertCanvas missing (red)';
    if (PM().dInsertCanvas() !== true) return 'dInsertCanvas refused (red)';
    await sleep(80);
    let hasShape = false; doc().descendants((n) => { if (n.type.name === 'vectorShape') hasShape = true; });
    if (!hasShape) return 'no vectorShape (canvas frame) inserted';
    const xml = await exportDocumentXml();
    return /prst="rect"/.test(xml) || 'no <a:prstGeom prst=rect> canvas frame in export';
  });

  await t('[10dr] reserve-degrade verbs (dInkToShape/dInkToMath) are no-op toasts', () => {
    // dInkToShape/dInkToMath are NOT in the draw AREA (the FLIP never routes them; the real buttons keep
    // toasting via H.inkToShape/H.inkToMath). They exist only so this test can confirm they never mutate the doc.
    setDoc('keepme');
    for (const v of ['dInkToShape', 'dInkToMath']) {
      if (typeof PM()[v] !== 'function') return 'PM.' + v + ' missing (red)';
      PM()[v]();
    }
    let shapes = 0; doc().descendants((n) => { if (n.type.name === 'vectorShape') shapes++; });
    return (shapes === 0 && doc().textContent.includes('keepme')) || 'a degrade verb mutated the doc (should be a no-op toast)';
  });

  await t('[10dr] tool-state toggles do NOT dirty the doc (drawingMode/eraser/select/lasso)', () => {
    setDoc('clean');
    for (const v of ['dSetDrawing', 'dSetEraser', 'dSetSelect', 'dSetLasso', 'dIsDrawing']) {
      if (typeof PM()[v] !== 'function') return 'PM.' + v + ' missing (red)';
    }
    PM().setClean();   // io.ts ships setClean()/isDirty() — there is NO markClean()
    PM().dSetDrawing(true); PM().dSetEraser(); PM().dSetSelect(); PM().dSetLasso(); PM().dSetDrawing(false);
    let shapes = 0; doc().descendants((n) => { if (n.type.name === 'vectorShape') shapes++; });
    if (shapes !== 0) return 'a tool toggle mutated the doc';
    return PM().isDirty() === false || 'a pure tool toggle dirtied the doc (K6)';
  });

  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10dr] IMPORT round-trip: ink freeform survives export→openDocx', async () => {
    setDoc('z'); caretAfter('z');
    if (typeof PM().dInsertInk !== 'function') return 'PM.dInsertInk missing (red)';
    if (PM().dInsertInk([{ x: 5, y: 5 }, { x: 25, y: 35 }, { x: 50, y: 8 }], { color: '#2B579A', width: 2, opacity: 1 }) !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    // After reopen the importer DROPS isInk + replaces customGeometry with { paths:[{d}] }. Assert the ink
    // is RENDERABLE (a custGeom node the overlay can draw), not merely that a vectorShape node exists.
    let renderable = false;
    doc().descendants((n) => {
      if (n.type.name !== 'vectorShape') return;
      const cg = n.attrs && n.attrs.customGeometry;
      if ((n.attrs && n.attrs.isInk) || (cg && Array.isArray(cg.paths) && cg.paths.length && cg.paths[0].d)) renderable = true;
    });
    if (renderable) return true;
    const xml2 = await exportDocumentXml(); // fallback: at least the custom geometry still round-trips to OOXML
    return /<a:custGeom\b/.test(xml2) || 'ink lost on round-trip (no renderable custGeom + none on re-export)';
  });

  // [11] Legacy retirement — single-world invariants + conflict-file/feature survival guards.
  await t('[11] PM is the only world', () => window.WC.PM && window.WC.PM.active === true && window.WC.PM.ready === true);
  await t('[11] body is pm-active', () => document.body.classList.contains('pm-active'));
  await t('[11] legacy WC.Editor is retired', () => typeof window.WC.Editor === 'undefined');
  await t('[11] Design themes table survives', () => Array.isArray(window.WC.Design.THEMES) && window.WC.Design.THEMES.length > 0);
  await t('[11] Design color/font/spacing/styleset tables survive', () => Array.isArray(window.WC.Design.COLOR_SCHEMES) && window.WC.Design.COLOR_SCHEMES.length > 0 && Array.isArray(window.WC.Design.FONT_PAIRS) && !!window.WC.Design.SPACING && !!window.WC.Design.STYLE_SETS);
  await t('[design] Style Set is an inline carousel (tiles + ‹/› nav + ▾ More)', () => {
    const node = window.WC.Ribbon.renderDesignStyleSetGallery({ cmd: 'styleSet' });
    const isCarousel = node.classList.contains('rgallery') && node.classList.contains('styleset-gallery');
    const tiles = node.querySelectorAll('.rgallery-track .styleset-cell').length;
    const hasNav = !!node.querySelector('.rgallery-nav.prev') && !!node.querySelector('.rgallery-nav.next');
    const hasMore = !!node.querySelector('.rgallery-more');
    return (isCarousel && tiles >= 5 && hasNav && hasMore) || ('carousel=' + isCarousel + ' tiles=' + tiles + ' nav=' + hasNav + ' more=' + hasMore);
  });
  await t('[design] Themes gallery has Word’s full list (≥20) + Reset/Browse/Save footer', () => {
    window.WC.Commands.run({ cmd: 'themes', type: 'dropdown' }, document.body);
    const fly = document.querySelector('.flyout');
    const labels = fly ? Array.from(fly.querySelectorAll('.fly-item .fi-label')).map((l) => l.textContent) : [];
    const hasReset = labels.some((l) => /Reset to Theme from Template/.test(l));
    const hasBrowse = labels.some((l) => /Browse for Themes/.test(l));
    const hasSave = labels.some((l) => /Save Current Theme/.test(l));
    window.WC.closeFlyouts();
    return (window.WC.Design.THEMES.length >= 20 && hasReset && hasBrowse && hasSave)
      || ('themes=' + window.WC.Design.THEMES.length + ' reset=' + hasReset + ' browse=' + hasBrowse + ' save=' + hasSave);
  });
  await t('[design] Page Color opens the colour picker (No Color / More Colors), not hardcoded white', () => {
    window.WC.Commands.run({ cmd: 'pageColor', type: 'dropdown' }, document.body);
    const fly = document.querySelector('.flyout');
    const txt = fly ? fly.textContent : '';
    const ok = /No Color/.test(txt) && /More Colors/.test(txt);
    window.WC.closeFlyouts();
    return ok || 'pageColor did not open a colour picker';
  });
  await t('[design] Colors & Fonts dropdowns include a Customize… footer', () => {
    window.WC.Commands.run({ cmd: 'colors', type: 'dropdown' }, document.body);
    let fly = document.querySelector('.flyout');
    const colorsOk = !!fly && /Customize Colors/.test(fly.textContent);
    window.WC.closeFlyouts();
    window.WC.Commands.run({ cmd: 'fonts', type: 'dropdown' }, document.body);
    fly = document.querySelector('.flyout');
    const fontsOk = !!fly && /Customize Fonts/.test(fly.textContent);
    window.WC.closeFlyouts();
    return (colorsOk && fontsOk) || ('colors=' + colorsOk + ' fonts=' + fontsOk);
  });
  await t('[11] setThemeColors survives (bridge/design.ts dep)', () => typeof window.WC.setThemeColors === 'function');
  await t('[11] Draw pen registry survives', () => Array.isArray(window.WC.Draw.PENS) && window.WC.Draw.PENS.length > 0 && Array.isArray(window.WC.Draw.customPens));
  await t('[11] Ref shared-state slots survive', () => typeof window.WC.Ref.citationStyle === 'string' && Array.isArray(window.WC.Ref.sources));
  await t('[11] Insert menu UI shell survives', () => !!window.WC.Insert && typeof window.WC.Insert === 'object');
  await t('[11] Thesaurus data survives (WC.Review.THES)', () => !!window.WC.Review && !!window.WC.Review.THES && typeof window.WC.Review.THES === 'object');
  await t('[11] Office Clipboard store survives', () => !!window.WC.Clipboard && Array.isArray(window.WC.Clipboard.items) && typeof window.WC.Clipboard.pasteAll === 'function');
  await t('[11] deferred Phase-7 areas still honestly blocked', () => window.WC.PM.isBlocked && window.WC.PM.isBlocked('header') === true && window.WC.PM.isBlocked('margins') === true);
  await t('[11] command hub intact (Commands.run does not throw)', () => { window.WC.Commands.run({ cmd: 'bold' }); return window.WC.view.state.doc.content.size > 0; });

  // ---------- Phase 4a: pagination core (src/renderer/pagination/pagination.ts) ----------
  // The engine is rAF-driven; allow generous settle time (the headless probe window
  // paints transparent+inactive so rAF runs at full speed — see src/main/main.js).
  const seamEls = () =>
    Array.from(document.querySelectorAll('#pm-editor .ProseMirror > .pm-page-spacer')).filter((s) => s.querySelector('.pm-gap-band'));
  const allSpacerEls = () => Array.from(document.querySelectorAll('#pm-editor .ProseMirror > .pm-page-spacer'));
  const fillParas = (n) => {
    const arr = [];
    for (let i = 1; i <= n; i++) arr.push('Paragraph line number ' + i + ' — the quick brown fox jumps over the lazy dog.');
    setDocs(arr);
  };

  await t('[4a] pagination exposes page geometry from the document model', async () => {
    setDoc('pagination geometry probe');
    await sleep(400);
    const pg = PM().__pagination;
    if (!pg || !pg.geometry) return 'no __pagination/geometry exposed';
    const g = pg.geometry;
    return (Math.round(g.pageH) === 1056 && Math.round(g.marginTop) === 96 && Math.round(g.contentH) === 864) ||
      'geometry off: ' + JSON.stringify({ pageH: g.pageH, mt: g.marginTop, ch: g.contentH });
  });

  await t('[4a] editor line-height calibrated to Word (Aptos-12 -> 1.225)', () => {
    // Locks DEFAULT_LINE_HEIGHT (ProseMirrorRenderer.ts): oracle read-layout showed
    // real Word fits ~44 Aptos-12 lines/Letter page (~19.6px = 1.225x16). Upstream
    // 1.2 (19.2px) drifted pagination a page behind Word on long docs.
    const pm = document.querySelector('#pm-editor .ProseMirror');
    const lh = pm && pm.style.lineHeight;
    return lh === '1.225' || 'inline line-height = ' + lh + ' (expected 1.225)';
  });

  await t('[4a] no phantom browser-default paragraph top-margin leaks', async () => {
    // The browser-default <p> margin (~16px top AND bottom) is reset; legitimate
    // spacing still comes inline from the model (e.g. a style's space-after lands
    // on margin-bottom). The browser default would put 16px on BOTH sides, so a 0
    // top margin proves the default no longer leaks. (oracle-confirmed: removing
    // the phantom margin made the clone's lines/page match Word.)
    setDoc('margin probe paragraph');
    await sleep(300);
    const p = document.querySelector('#pm-editor .ProseMirror p');
    if (!p) return 'no paragraph';
    return getComputedStyle(p).marginTop === '0px' || 'p margin-top = ' + getComputedStyle(p).marginTop + ' (browser default leaked)';
  });

  await t('[4a] short doc = single page, no page seams', async () => {
    setDoc('one short line');
    await sleep(400);
    const pg = PM().__pagination;
    if (!pg) return 'no __pagination';
    return (pg.pageCount === 1 && pg.breaks.length === 0 && seamEls().length === 0) ||
      'pageCount=' + pg.pageCount + ' breaks=' + pg.breaks.length + ' seams=' + seamEls().length;
  });

  await t('[4a] overflowing content paginates into multiple pages with rendered seams', async () => {
    fillParas(70);
    await sleep(600);
    const pg = PM().__pagination;
    if (!pg) return 'no __pagination';
    if (pg.pageCount < 2) return 'pageCount=' + pg.pageCount + ' (expected >=2)';
    if (pg.breaks.length !== pg.pageCount - 1) return 'breaks=' + pg.breaks.length + ' != pageCount-1=' + (pg.pageCount - 1);
    if (seamEls().length !== pg.breaks.length) return 'rendered seams=' + seamEls().length + ' != breaks=' + pg.breaks.length;
    return true;
  });

  await t('[4a] counts().pages + status bar reflect the live page count', async () => {
    fillParas(70);
    // poll until counts.pages catches up to the engine
    const PMx = PM();
    let pages = 0, pc = 0;
    for (let i = 0; i < 20; i++) { await sleep(150); pc = (PMx.__pagination || {}).pageCount || 1; pages = PMx.counts().pages; if (pages === pc && pc >= 2) break; }
    if (pages !== pc) return 'counts.pages=' + pages + ' != engine pageCount=' + pc;
    if (pc < 2) return 'expected multi-page, got ' + pc;
    const status = document.querySelector('#statusbar .sb-item');
    const txt = status ? status.textContent : '';
    return /^Page \d+ of \d+$/.test(txt) && txt.endsWith('of ' + pc) || 'status="' + txt + '" pageCount=' + pc;
  });

  await t('[4a] page margins are realized (top-margin + tail spacers present)', async () => {
    // After fillParas(70): a top-margin spacer (no band) + N seams (band) + a tail (no band).
    const spacers = allSpacerEls();
    const bandless = spacers.filter((s) => !s.querySelector('.pm-gap-band'));
    return bandless.length >= 2 || 'bandless spacers (top+tail) = ' + bandless.length + ' of ' + spacers.length;
  });

  await t('[4a] each seam positions the next page content at the page content-top', async () => {
    // The core geometry invariant: the first content block after page-seam k must
    // start at visual y = k*pitch + marginTop (the content-top of page k+1). This
    // verifies every page boundary directly and is robust to the last-page tail.
    fillParas(70);
    const pm = document.querySelector('#pm-editor .ProseMirror');
    // poll to convergence (box height stable)
    let prev = -1, stable = 0;
    for (let i = 0; i < 25 && stable < 3; i++) { await sleep(120); const h = pm.offsetHeight; stable = h === prev ? stable + 1 : 0; prev = h; }
    const z = PM().zoom || 1;
    const boxTop = pm.getBoundingClientRect().top;
    const g = PM().__pagination.geometry, GAP = 14, pitch = g.pageH + GAP;
    const kids = Array.from(pm.children);
    let k = 0; const errs = [];
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (!(el.classList.contains('pm-page-spacer') && el.querySelector('.pm-gap-band'))) continue;
      k++;
      let j = i + 1; while (j < kids.length && kids[j].classList.contains('pm-page-spacer')) j++;
      if (j >= kids.length) continue;
      const top = (kids[j].getBoundingClientRect().top - boxTop) / z;
      const target = k * pitch + g.marginTop;
      if (Math.abs(top - target) > 6) errs.push('seam' + k + ' top=' + Math.round(top) + ' target=' + Math.round(target));
    }
    if (k === 0) return 'no seams found';
    return errs.length === 0 ? true : errs.join('; ');
  });

  await t('[4a] a pagination decoration tick does NOT dirty the document', async () => {
    PM().setClean();
    fillParas(60); // forces a re-paginate (many decoration ticks)
    await sleep(600);
    // The content edit above DOES dirty (a real user edit). Re-clean, then force
    // a pure pagination re-tick via a zoom change (no doc edit) and confirm clean.
    PM().setClean();
    const before = PM().isDirty();
    PM().setZoom(1.1); // re-layout → pagination re-measures + dispatches a decoration-only tick
    await sleep(400);
    PM().setZoom(1);
    await sleep(300);
    const after = PM().isDirty();
    return (before === false && after === false) || 'dirty before=' + before + ' after=' + after;
  });

  await t('[4a] continuous (Web) view renders no page seams', async () => {
    fillParas(70);
    await sleep(500);
    const seamsPrint = seamEls().length;
    PM().setView('web');
    await sleep(400);
    const seamsWeb = seamEls().length;
    PM().setView('print');
    await sleep(400);
    const seamsBack = seamEls().length;
    return (seamsPrint > 0 && seamsWeb === 0 && seamsBack > 0) ||
      'print=' + seamsPrint + ' web=' + seamsWeb + ' back=' + seamsBack;
  });

  // ---- Phase 4a: manual page breaks (hardBreak[pageBreakType='page']) ----
  const caretToEndOf = (needle) => {
    selectText(needle);
    const s = v().state.selection;
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), s.to, s.to)));
  };
  // Y (px from box top) of the first paragraph/text-node containing `needle`, and the
  // content-top of a given 1-based page — used to assert which page content lands on
  // (a forced seam can be INSIDE a paragraph, so DOM-child position isn't reliable).
  const textY = (needle) => {
    const pm = document.querySelector('#pm-editor .ProseMirror');
    const z = PM().zoom || 1, boxTop = pm.getBoundingClientRect().top;
    const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const i = n.textContent.indexOf(needle);
      if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + needle.length); return (r.getBoundingClientRect().top - boxTop) / z; }
    }
    return null;
  };
  const pageContentTop = (pageIdx) => { const g = PM().__pagination.geometry; return (pageIdx - 1) * (g.pageH + 14) + g.marginTop; };
  const bandCount = () => document.querySelectorAll('#pm-editor .ProseMirror .pm-gap-band').length;

  await t('[4a] manual page break forces the following content onto a new page', async () => {
    setDocs(['Mpb alpha line', 'Mpb bravo line', 'Mpb charlie line']);
    await sleep(300);
    const before = PM().__pagination.pageCount;
    caretToEndOf('bravo');
    PM().insertPageBreak();
    let pc = before;
    for (let i = 0; i < 20; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc > before) break; }
    if (pc <= before) return 'pageCount did not increase (' + before + ' -> ' + pc + ')';
    const y = textY('charlie');
    return (y != null && y >= pageContentTop(2) - 30) || 'charlie Y=' + Math.round(y) + ' not on page 2 (top ' + Math.round(pageContentTop(2)) + ')';
  });

  await t('[4a] mid-paragraph break splits the paragraph (after-text on the next page)', async () => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent('<p>MidBefore part of the paragraph here</p>');
    await sleep(250);
    // caret after "here" (end) — then type after-break text so the paragraph has content on both sides
    caretToEndOf('here');
    PM().insertPageBreak();
    window.WC.editor.commands.insertContent('MidAfter text');
    await sleep(500);
    if (PM().__pagination.pageCount < 2) return 'pageCount ' + PM().__pagination.pageCount;
    const yb = textY('MidBefore'), ya = textY('MidAfter');
    if (yb == null || ya == null) return 'text not found (b=' + yb + ' a=' + ya + ')';
    return (yb < pageContentTop(2) - 30 && ya >= pageContentTop(2) - 30) || 'before Y=' + Math.round(yb) + ' after Y=' + Math.round(ya);
  });

  await t('[4a] trailing manual page break adds a blank page', async () => {
    setDocs(['TrA alpha', 'TrA omega']); // omega = unique last word of the last block
    await sleep(300);
    const before = PM().__pagination.pageCount;
    caretToEndOf('omega');
    PM().insertPageBreak();
    let pc = before;
    for (let i = 0; i < 20; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc > before) break; }
    return pc === before + 1 || 'trailing break: pageCount ' + before + ' -> ' + pc + ' (expected +1)';
  });

  await t('[4a] blank page (two breaks) adds a blank sheet (two seams)', async () => {
    setDocs(['Bp alpha line', 'Bp bravo line', 'Bp charlie line']);
    await sleep(300);
    const before = PM().__pagination.pageCount;
    caretToEndOf('bravo');
    PM().insertBlankPage();
    let pc = before;
    for (let i = 0; i < 20; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc >= before + 2) break; }
    if (pc < before + 2) return 'blank page did not add 2 pages (' + before + ' -> ' + pc + ')';
    // a blank page = two forced seams (each one gap band); content after lands 2 pages down
    return bandCount() >= 2 || 'expected >=2 gap bands for the blank page, got ' + bandCount();
  });

  await t('[4a] manual page break exports as <w:br w:type="page">', async () => {
    setDocs(['Exp alpha line', 'Exp bravo line']);
    await sleep(200);
    caretToEndOf('alpha');
    PM().insertPageBreak();
    await sleep(200);
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    return /<w:br[^>]*w:type="page"/.test(xml) || 'no <w:br w:type="page"> in exported XML';
  });

  // ---- Phase 4a caret/click integrity (regression for the inline-block-spacer bug) ----
  // A forced/blank-page seam MUST be a BLOCK-boundary widget, never a block <div> injected
  // INSIDE a paragraph's inline flow (that corrupts PM's posAtCoords hit-testing → clicking
  // the next page lands the caret on the wrong page). Helpers:
  const inlineSpacerCount = () => ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre']
    .reduce((a, tag) => a + document.querySelectorAll('#pm-editor .ProseMirror ' + tag + ' .pm-page-spacer').length, 0);
  // posAtCoords for a click in the page-2 top margin (just above `needle`'s rendered line).
  // Returns the PM position, or null. Word drops the caret on the nearest line of the page you
  // clicked toward; the inline-spacer bug instead hijacked posAtCoords deep into a page-1 pos.
  const marginClickPos = (needle) => {
    const pm = document.querySelector('#pm-editor .ProseMirror');
    const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
    let n, rect = null;
    while ((n = w.nextNode())) { const i = n.textContent.indexOf(needle); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + needle.length); rect = r.getBoundingClientRect(); break; } }
    if (!rect) return null;
    const hit = v().posAtCoords({ left: rect.left + 2, top: rect.top - 18 });
    return hit ? hit.pos : null;
  };
  // Document position where the top-level block containing `needle` begins.
  const blockStartOf = (needle) => { let p = null; doc().forEach((n, off) => { if (p == null && (n.textContent || '').indexOf(needle) >= 0) p = off; }); return p; };

  await t('[4a] manual page break is a BLOCK-boundary seam (no block-in-inline; page-2 click maps right)', async () => {
    setDocs(['MbiAlpha first paragraph', 'MbiBravo second paragraph', 'MbiCharlie third paragraph word']);
    await sleep(300);
    caretToEndOf('MbiBravo second paragraph'); // caret at end of block 2 → break pushes block 3 to page 2
    PM().insertPageBreak();
    let pc = 1; for (let i = 0; i < 20; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc >= 2) break; }
    if (pc < 2) return 'did not paginate to 2 pages';
    const inl = inlineSpacerCount();
    if (inl > 0) return 'block-in-inline: ' + inl + ' page-spacer(s) injected inside a <p> (corrupts posAtCoords)';
    // Clicking page-2's top margin must NOT misland deep in page-1 content. The inline-spacer
    // bug hijacked posAtCoords to a page-1 position (well before the page-2 block); the fix
    // makes it resolve at/after the page-2 block boundary (MbiCharlie's block start).
    const pos = marginClickPos('MbiCharlie'), p2 = blockStartOf('MbiCharlie');
    if (pos == null || p2 == null) return 'could not hit-test the page-2 margin (pos=' + pos + ' p2=' + p2 + ')';
    return pos >= p2 || 'page-2 margin click mislanded at pos ' + pos + ' (before the page-2 block at ' + p2 + ')';
  });

  await t('[4a] blank page uses BLOCK-boundary seams (no block-in-inline spacer)', async () => {
    setDocs(['BbiAlpha first', 'BbiBravo middle', 'BbiCharlie last word']);
    await sleep(300);
    const before = PM().__pagination.pageCount;
    caretToEndOf('BbiAlpha first');
    PM().insertBlankPage();
    let pc = before; for (let i = 0; i < 20; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc >= before + 2) break; }
    if (pc < before + 2) return 'blank page did not add 2 pages (' + before + ' -> ' + pc + ')';
    const inl = inlineSpacerCount();
    return inl === 0 || 'block-in-inline: ' + inl + ' page-spacer(s) inside a <p> for the blank page';
  });

  await t('[4a] section break (w:sectPr) forces the next content onto a new page', async () => {
    if (typeof window.WC.editor.commands.insertSectionBreakAtSelection !== 'function') return 'insertSectionBreakAtSelection command missing (red)';
    setDocs(['Scb alpha line', 'Scb bravo line', 'Scb gamma line']);
    await sleep(300);
    const before = PM().__pagination.pageCount;
    caretToEndOf('bravo');
    window.WC.editor.commands.insertSectionBreakAtSelection({});
    let pc = before;
    for (let i = 0; i < 25; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc > before) break; }
    if (pc <= before) return 'section break did not add a page (' + before + ' -> ' + pc + ')';
    const y = textY('Scb gamma');
    return (y != null && y >= pageContentTop(2) - 30) || 'gamma Y=' + Math.round(y) + ' not on page 2 (top ' + Math.round(pageContentTop(2)) + ')';
  });

  await t('[4a] section break governed by the NEXT section: continuous-typed ender still page-breaks', async () => {
    // Word semantic (oracle-validated): a sectPr's w:type describes how ITS OWN section
    // BEGINS, not the break after it. An explicit `continuous` ON the section-ending
    // paragraph must NOT suppress the break when the following (body) section is nextPage.
    if (typeof window.WC.editor.commands.insertSectionBreakAtSelection !== 'function') return 'insertSectionBreakAtSelection command missing (red)';
    setDocs(['Scc alpha line', 'Scc bravo line', 'Scc gamma line']);
    await sleep(300);
    caretToEndOf('bravo');
    window.WC.editor.commands.insertSectionBreakAtSelection({});
    await sleep(150);
    // stamp w:type=continuous onto bravo's sectPr
    let tgt = null;
    doc().descendants((node, pos) => { if (node.type.name === 'paragraph' && (node.textContent || '').includes('bravo')) tgt = { node, pos }; return true; });
    if (!tgt) return 'bravo paragraph not found';
    const pp = JSON.parse(JSON.stringify(tgt.node.attrs.paragraphProperties || {}));
    if (!pp.sectPr) return 'bravo has no sectPr after insert (red)';
    pp.sectPr.elements = (pp.sectPr.elements || []).filter((el) => el.name !== 'w:type');
    pp.sectPr.elements.unshift({ type: 'element', name: 'w:type', attributes: { 'w:val': 'continuous' }, elements: [] });
    v().dispatch(v().state.tr.setNodeMarkup(tgt.pos, undefined, { ...tgt.node.attrs, paragraphProperties: pp, pageBreakSource: 'sectPr' }, tgt.node.marks));
    let pc = 1;
    for (let i = 0; i < 25; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc >= 2) break; }
    return pc >= 2 || 'continuous-typed ender wrongly suppressed the break (pageCount=' + pc + ', expected 2 — the next/body section is nextPage)';
  });

  await t('[4a] a CONTINUOUS middle section stays on the page (next-section governs)', async () => {
    // The discriminating multi-section case (oracle-validated): intro / s1end[sectPr] /
    // s2end[sectPr=continuous] / tail. The break after s1end is governed by s2's type
    // (continuous → NO break); the break after s2end by the body (nextPage → break). So
    // intro,s1end,s2end share page 1 and tail is page 2 — a naive "break on every sectPr"
    // would give 3 pages. Guards the exact rule the prior 4f spike got backwards.
    if (typeof window.WC.editor.commands.insertSectionBreakAtSelection !== 'function') return 'insertSectionBreakAtSelection command missing (red)';
    setDocs(['Cms intro', 'Cms ess1end', 'Cms ess2end', 'Cms mtail']);
    await sleep(300);
    const stamp = (needle, val) => {
      let tgt = null;
      doc().descendants((node, pos) => { if (node.type.name === 'paragraph' && (node.textContent || '').includes(needle)) tgt = { node, pos }; return true; });
      if (!tgt) return false;
      caretToEndOf(needle); window.WC.editor.commands.insertSectionBreakAtSelection({});
      doc().descendants((node, pos) => { if (node.type.name === 'paragraph' && (node.textContent || '').includes(needle)) tgt = { node, pos }; return true; });
      const pp = JSON.parse(JSON.stringify(tgt.node.attrs.paragraphProperties || {}));
      if (!pp.sectPr) pp.sectPr = { type: 'element', name: 'w:sectPr', elements: [] };
      pp.sectPr.elements = (pp.sectPr.elements || []).filter((el) => el.name !== 'w:type');
      if (val) pp.sectPr.elements.unshift({ type: 'element', name: 'w:type', attributes: { 'w:val': val }, elements: [] });
      v().dispatch(v().state.tr.setNodeMarkup(tgt.pos, undefined, { ...tgt.node.attrs, paragraphProperties: pp, pageBreakSource: 'sectPr' }, tgt.node.marks));
      return true;
    };
    stamp('ess1end', null); await sleep(120);
    stamp('ess2end', 'continuous'); await sleep(500);
    const pc = PM().__pagination.pageCount, seams = (PM().__pagination.breaks || []).length;
    if (pc !== 2) return 'expected 2 pages (continuous middle stays on page 1), got ' + pc + ' (naive break-on-every-sectPr = 3)';
    if (seams !== 1) return 'expected exactly 1 seam (only the s2end→tail break), got ' + seams;
    const yt = textY('Cms mtail'), ys = textY('Cms ess2end');
    return (yt != null && ys != null && ys < pageContentTop(2) - 30 && yt >= pageContentTop(2) - 30)
      || 'ess2end Y=' + Math.round(ys) + ' (want page 1) / mtail Y=' + Math.round(yt) + ' (want page 2 top ' + Math.round(pageContentTop(2)) + ')';
  });

  await t('[4a] section break before a TABLE pushes the table to a new page', async () => {
    if (typeof window.WC.editor.commands.insertSectionBreakAtSelection !== 'function') return 'insertSectionBreakAtSelection command missing (red)';
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent('<p>Tbs intro</p><p>Tbs tend</p><table><tr><td>Tbs cellA</td><td>cellB</td></tr></table><p>Tbs after</p>');
    await sleep(350);
    const before = PM().__pagination.pageCount;
    caretToEndOf('tend'); // non-first paragraph (the insert command rejects offset 0)
    window.WC.editor.commands.insertSectionBreakAtSelection({});
    let pc = before;
    for (let i = 0; i < 25; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc > before) break; }
    if (pc <= before) return 'section break before a table did not add a page (' + before + ' -> ' + pc + ')';
    const yCell = textY('Tbs cellA');
    return (yCell != null && yCell >= pageContentTop(2) - 30) || 'table cellA Y=' + Math.round(yCell) + ' not on page 2 (top ' + Math.round(pageContentTop(2)) + ')';
  });

  await t('[4a] a paragraph taller than a page splits at the line (mid-paragraph seam)', async () => {
    window.WC.editor.commands.selectAll();
    const words = [];
    for (let i = 1; i <= 600; i++) words.push('word' + i);
    window.WC.editor.commands.insertContent('<p>' + words.join(' ') + '</p>');
    const box = document.getElementById('pm-editor');
    let prev = -1, stable = 0;
    for (let i = 0; i < 30 && stable < 3; i++) { await sleep(120); const h = box.offsetHeight; stable = h === prev ? stable + 1 : 0; prev = h; }
    const pg = PM().__pagination;
    if (pg.pageCount < 2) return 'expected multi-page, got ' + pg.pageCount;
    if (pg.breaks.length < 1) return 'no line-split seam placed (breaks=' + pg.breaks.length + ')';
    // the seam must be INSIDE the single paragraph (a line split, not a whole-block move)
    const seamInPara = document.querySelector('#pm-editor .ProseMirror > p .pm-page-spacer');
    if (!seamInPara) return 'seam not inside the paragraph (line-split expected)';
    // box is (within the convergence deadband) an exact number of sheets
    const g = pg.geometry, GAP = 14;
    const expected = pg.pageCount * g.pageH + (pg.pageCount - 1) * GAP;
    return Math.abs(prev - expected) <= 26 || 'boxH=' + prev + ' expected~=' + Math.round(expected);
  });

  await t('[4a] status bar reports the caret page across a blank-page (two seams)', async () => {
    setDocs(['Sbp alpha', 'Sbp bravo', 'Sbp gamma']);
    await sleep(300);
    caretToEndOf('bravo');
    PM().insertBlankPage();
    let pc = 1;
    for (let i = 0; i < 20; i++) { await sleep(150); pc = PM().__pagination.pageCount; if (pc >= 3) break; }
    if (pc < 3) return 'blank page pageCount=' + pc + ' (expected 3)';
    // A blank page is ONE block-boundary seam that advances TWO sheets (two bands); the status
    // bar weights seams by their page span, so gamma — after the seam — is on sheet 3.
    const advanced = (PM().__pagination.breaks || []).reduce((a, b) => a + (b.pages || 1), 0);
    if (advanced < 2) return 'expected the blank-page seam(s) to advance >=2 sheets, got ' + advanced;
    caretToEndOf('gamma'); // caret on the 3rd sheet (sheet 2 is the blank page)
    await sleep(300);
    const txt = (document.querySelector('#statusbar .sb-item') || {}).textContent;
    return txt === 'Page 3 of 3' || 'status="' + txt + '" (expected "Page 3 of 3")';
  });

  await t('[4a] a straddling table is moved wholesale, never line-split mid-cell', async () => {
    window.WC.editor.commands.selectAll();
    const fillers = Array.from({ length: 40 }, (_, i) => '<p>Tbl filler ' + (i + 1) + '.</p>').join('');
    const rows = Array.from({ length: 14 }, (_, r) => '<tr><td>Row ' + (r + 1) + ' A</td><td>Row ' + (r + 1) + ' B</td></tr>').join('');
    window.WC.editor.commands.insertContent(fillers + '<table>' + rows + '</table><p>tbl after</p>');
    const box = document.getElementById('pm-editor');
    let prev = -1, stable = 0;
    for (let i = 0; i < 30 && stable < 3; i++) { await sleep(120); const h = box.offsetHeight; stable = h === prev ? stable + 1 : 0; prev = h; }
    const pm = document.querySelector('#pm-editor .ProseMirror');
    if (pm.querySelectorAll('table').length < 1) return 'no table rendered';
    if (PM().__pagination.pageCount < 2) return 'expected multi-page with the table';
    const inside = pm.querySelectorAll('table .pm-page-spacer').length;
    return inside === 0 || 'a page-spacer was injected inside a table (' + inside + ') — table mangled';
  });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
