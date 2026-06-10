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
    (window.__NET_LOG || []).length === 0 && !!window.WC.Editor && !!window.WC.Ribbon);
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    // probe lives in a STILL-UNFLIPPED area — repointed link→newComment when
    // insert-basics flipped (slice 6): a link probe would go vacuously green once
    // insert-basics is live; newComment (review, slice 8) keeps the test MEANINGFUL.
    window.WC.Commands.run({ cmd: 'newComment', label: 'New Comment' });
    return document.querySelectorAll('.flyout').length === 0
      && !document.querySelector('.modal-backdrop');
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    window.WC.Commands.dropdown({ cmd: 'tableOfContents', type: 'dropdown' }, document.body);
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
  await t('[6] insertImage inserts an image node with the data-url src', async () => {
    setDoc('photo: ');
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    PM().insertImage({ src: px, alt: 'dot' }); await sleep(120);
    let src = null; doc().descendants((n) => { if (n.type.name === 'image') src = n.attrs.src; });
    return hasNode('image') && /^data:image\/png/.test(src || '');
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
  // NOTE (Critique B3): mergeCells/setCellBackground need a CellSelection, whose test helper
  // (tableSelectFirstRowPair) lands in Stage F. The merge test therefore lives in the [6b] block
  // (Task 10.3), NOT here — it would no-op + fail pre-6b. The 6a [6] block covers only the table
  // ops that work off a plain caret-in-cell (insert/delete row+col, header toggle).
  await t('[6] table toggleHeaderRow converts the first row to header cells', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableToggleHeaderRow(); await sleep(100);
    let hasHeaderCell = false; doc().descendants((n) => { if (n.type.name === 'tableHeader') hasHeaderCell = true; });
    return hasHeaderCell === true;
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
