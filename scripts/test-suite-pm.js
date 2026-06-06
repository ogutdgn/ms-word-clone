/* PM-world functional suite (Phase 2). Run:
   npm run build && npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js
   Sentinel-gated (NEVER --shot-delay-dependent). Same JSON contract as test-suite.js. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = async (name, fn) => {
    try { const r = await fn(); results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' }); }
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
  await t('[0b] non-docx format save is blocked in PM mode (path/format untouched)', async () => {
    const f = window.WC.Files; const p0 = f.path; const fmt0 = f.format;
    f.format = 'html';
    const r = await f.save();
    const blocked = !!r && r.ok === false;
    f.format = fmt0;
    return blocked && f.path === p0;
  });

  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    window.WC.Commands.run({ cmd: 'bullets', label: 'Bullets' });
    return document.querySelectorAll('.flyout').length === 0; // no flyout, no throw
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    window.WC.Commands.dropdown({ cmd: 'bullets', type: 'dropdown' }, document.body);
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
    const back = await window.wordAPI.openBytes('/tmp/wc-pm-files-save.docx');
    const ok = await PM().openDocx(back.bytes);
    return ok && /saved via Files.save/.test(window.WC.view.dom.textContent) && PM().isDirty() === false;
  });
  await t('[0b] New Document loads the blank template + clean state', async () => {
    const f = window.WC.Files;
    const ok = await PM().newBlank();
    return ok === true && PM().isDirty() === false && window.WC.view.state.doc.content.size < 60;
  });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
