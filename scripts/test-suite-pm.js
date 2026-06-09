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
  await t('[0a] legacy #editor hidden but laid out', () => {
    const ed = document.getElementById('editor'); const cs = getComputedStyle(ed);
    return cs.visibility === 'hidden' && cs.position === 'absolute' && ed.offsetHeight > 0;
  });
  await t('[0a] #pm-editor is the visible page', () => {
    const pe = document.getElementById('pm-editor');
    return !!pe && getComputedStyle(pe).visibility !== 'hidden' && pe.offsetWidth > 600;
  });
  await t('[0a] D6 guard: legacy exec is blocked, returns false, mutates nothing', () => {
    const ed = document.getElementById('editor'); const before = ed.innerHTML;
    const ok = window.WC.Editor.exec('bold');
    return ok === false && ed.innerHTML === before;
  });
  await t('[0a] D6 guard: legacy setHTML/applyBlockStyle blocked', () => {
    const ed = document.getElementById('editor'); const before = ed.innerHTML;
    window.WC.Editor.setHTML('<p>should not land</p>');
    window.WC.Editor.applyBlockStyle('marginLeft', '48px');
    return ed.innerHTML === before;
  });
  await t('[0a] D6 guard: legacy undo blocked', () => window.WC.Editor.undo() === false);
  await t('[0a] dirty flag tracks PM edits', async () => {
    const d0 = PM().isDirty();
    v().dispatch(v().state.tr.insertText('x', 1));
    for (let i = 0; i < 20 && !(PM().isDirty() && document.title.startsWith('•')); i++) await sleep(50);
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
    (window.__NET_LOG || []).length === 0 && !!window.WC.Editor && !!window.WC.Ribbon);
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    // probe cmd lives in a STILL-UNFLIPPED area — repointed cut→replace when
    // clipboard flipped (slice 4): a cut probe would go vacuously green with a
    // destructive live cut mid-suite; replace keeps the test MEANINGFUL.
    window.WC.Commands.run({ cmd: 'replace', label: 'Replace' });
    return document.querySelectorAll('.flyout').length === 0
      && !document.getElementById('find-pane'); // findPane stays closed
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    window.WC.Commands.dropdown({ cmd: 'find', type: 'dropdown' }, document.body);
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

  await t('[1] in-view Mod-Z does not double-fire (engine handles it once)', async () => {
    setDoc('double fire probe'); selectText('double');
    run('bold'); await sleep(50);
    // Capture doc size before: if app.js handler fired it would call pm.cmd('undo')
    // (an explicit, trusted call), reverting the bold AND potentially the setDoc.
    // The guard must prevent that; only the PM keymap path (untrusted event, likely
    // ignored by PM) or nothing should happen.
    const sizeBefore = v().state.doc.content.size;
    const textBefore = v().dom.textContent;
    window.WC.view.focus();
    // Synthetic (untrusted) keydown on the focused element inside the PM view.
    // Our app.js guard sees: WC.PM.active && view.dom.contains(activeElement) && mod && k==='z' → return.
    // So app.js stands down. The PM keymap itself may or may not handle untrusted events.
    // Either way the doc must NOT change via the app.js path.
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    await sleep(80);
    // Assert the guard stood down: doc content unchanged (no double- or single-fire from app.js).
    return v().state.doc.content.size === sizeBefore && /double fire probe/.test(v().dom.textContent);
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
  await t('[2] borders face applies Word-default bottom border', async () => {
    setDoc('border probe text'); selectText('border');
    run('borders'); await sleep(50);
    const b = paraAttrs('border').paragraphProperties?.borders;
    const el2 = paraEl('border');
    return !!b && b.bottom && b.bottom.val === 'single' && !!el2 && el2.style.borderBottom !== '';
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
  await t('[3] hover preview applies live; mouse-leave restores doc + dirty + history', async () => {
    setDoc('preview probe text'); selectText('preview probe text');
    await sleep(550); // close the history group so the assert below is clean
    PM().setClean();
    const before = JSON.stringify(doc().toJSON());
    const cell = cellFor('Heading 1');
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(50);
    const during = paraAttrs('preview').paragraphProperties?.styleId === 'Heading1';
    cell.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await sleep(50);
    // The editor-state asserts are the desync canaries: a view-only restore
    // (raw view.updateState) would pass the doc() check but desync editor._state
    // (Editor.ts:607) — assert BOTH copies restored and identical.
    return during
      && JSON.stringify(doc().toJSON()) === before
      && JSON.stringify(window.WC.editor.state.doc.toJSON()) === before
      && window.WC.editor.state === window.WC.view.state
      && PM().isDirty() === false;
  });
  await t('[3] preview then click commits as ONE undo step', async () => {
    setDoc('commit probe text'); selectText('commit probe text');
    await sleep(550); // close the history group — undo must revert ONLY the commit
    const cell = cellFor('Heading 2');
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); await sleep(50);
    cell.click(); await sleep(80);
    const applied = paraAttrs('commit').paragraphProperties?.styleId === 'Heading2';
    PM().cmd('undo'); await sleep(50);
    return applied && paraAttrs('commit').paragraphProperties?.styleId == null;
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
    // sdBlockRev is a per-block revision counter the numbering plugin bumps via an
    // addToHistory:false appendTransaction — it is NOT undoable content, so it
    // legitimately drifts across paste+undo (unlike a snapshot-restore). Normalize
    // it out so this asserts "one undo reverts the CONTENT", not the rev counter.
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
    return ['Keep Source Formatting', 'Merge Formatting', 'Picture', 'Keep Text Only']
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

  // ---------- slice 0b: file IO (these replace the live document — keep LAST) ----------
  await t('[0b] non-docx format save is blocked in PM mode (path/format untouched)', async () => {
    const f = window.WC.Files; const p0 = f.path; const fmt0 = f.format;
    f.format = 'html';
    const r = await f.save();
    const blocked = !!r && r.ok === false;
    f.format = fmt0;
    return blocked && f.path === p0;
  });
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
  await t('[0b] Files.open with non-docx preset refuses before touching the engine', async () => {
    const f = window.WC.Files; const p0 = f.path;
    const before = window.WC.view.state.doc.content.size;
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-junk.txt', bytes: new Uint8Array([104, 105]) });
    if (!w1 || !w1.ok) return 'setup failed: ' + (w1 && w1.error);
    await f.open('/tmp/wc-pm-junk.txt');
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
  await t('[0b] New Document loads the blank template + clean state', async () => {
    const f = window.WC.Files;
    const ok = await PM().newBlank();
    return ok === true && PM().isDirty() === false && window.WC.view.state.doc.content.size < 60;
  });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
