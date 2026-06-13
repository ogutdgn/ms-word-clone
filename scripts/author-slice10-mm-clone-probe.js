/* slice-10 mail-merge CLONE authoring probe (Leg-A oracle input, NO Word).
   Runs in the renderer via electron --shot-evalfile. Mirrors
   scripts/author-slice9-clone-probe.js: builds a merge-field letter via the
   WC.PM mail-merge bridge, then exportDocxBytes -> wordAPI.saveBytes to disk.
   The COM/Word roundtrip (open + resave + docx-inspect) is done separately. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = async (name, fn) => {
    try { const r = await fn(); results.push({ name, pass: r !== false && typeof r !== 'string', detail: typeof r === 'string' ? r : '' }); }
    catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); }
  };

  const OUT_PATH = 'C:/tmp/wc-slice10-clone.docx';

  for (let i = 0; i < 200 && !(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready); i++) await sleep(50);
  if (!(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready)) {
    return JSON.stringify({ summary: { total: 1, pass: 0, fail: 1, outPath: OUT_PATH }, results: [{ name: 'harness ready', pass: false, detail: 'sentinel timeout after 10s' }] }, null, 2);
  }

  const PM = () => window.WC.PM;
  const v = () => window.WC.view;
  const doc = () => v().state.doc;
  const countFields = () => { let n = 0; doc().descendants((x) => { if (x.type.name === 'fieldAnnotation' && x.attrs.fieldType) n++; }); return n; };
  const setDocs = (paras) => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent(paras.map((p) => '<p>' + p + '</p>').join(''));
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.unsetAllMarks();
    window.WC.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']);
  };
  const selectText = (needle) => {
    let found = null;
    doc().descendants((node, pos) => { if (found || !node.isText || !node.text) return; const i = node.text.indexOf(needle); if (i >= 0) found = { from: pos + i, to: pos + i + needle.length }; });
    if (!found) throw new Error('text not found: ' + needle);
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), found.from, found.to)));
    return found;
  };
  const caretAfter = (needle) => { const s = selectText(needle); window.WC.editor.commands.setTextSelection({ from: s.to, to: s.to }); };

  await PM().newBlank(); await sleep(100);

  await t('author a merge letter: MERGEFIELD x2 + ADDRESSBLOCK + GREETINGLINE + NEXT', async () => {
    setDocs(['Dear , ', 'Addr: ', 'Greet: ', 'Rec: ']);
    caretAfter('Dear '); PM().mmInsertField('FirstName');
    window.WC.editor.commands.insertContent(' '); PM().mmInsertField('Last_Name');
    caretAfter('Addr: '); PM().mmAddressBlock();
    caretAfter('Greet: '); PM().mmGreetingLine();
    caretAfter('Rec: '); PM().mmInsertRule('NEXT', 'NEXT');
    await sleep(80);
    const n = countFields();
    return n === 5 || ('expected 5 merge fields, got ' + n);
  });

  await t('export emits real field codes (w:fldSimple MERGEFIELD + NEXT begin/end, no «Next Record»)', async () => {
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    if (typeof xml !== 'string') return 'export returned non-string';
    if (/<w:sdt\b[^>]*>[\s\S]*MERGEFIELD/.test(xml)) return 'MERGEFIELD exported as w:sdt content control';
    if (!/<w:fldSimple\b[^>]*w:instr="\s*MERGEFIELD FirstName\s*"/.test(xml)) return 'no fldSimple MERGEFIELD FirstName';
    if (!/<w:fldSimple\b[^>]*w:instr="\s*MERGEFIELD Last_Name\s*"/.test(xml)) return 'no fldSimple MERGEFIELD Last_Name (underscore)';
    if (/«Next Record»/.test(xml)) return 'NEXT emitted a spurious «Next Record» result run';
    if (!/\bNEXT\b/.test(xml) || !/<w:fldChar[^>]*w:fldCharType="begin"/.test(xml)) return 'no NEXT field code';
    return true;
  });

  await t('export: exportDocxBytes -> saveBytes(' + OUT_PATH + ')', async () => {
    const bytes = await PM().exportDocxBytes();
    if (!bytes || bytes.length <= 500) return 'export too small: ' + (bytes ? bytes.length : 'null');
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'no PK zip header';
    const s = await window.wordAPI.saveBytes({ filePath: OUT_PATH, bytes });
    if (!s || s.ok !== true) return 'saveBytes failed: ' + ((s && s.error) || JSON.stringify(s));
    return true;
  });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, outPath: OUT_PATH }, results }, null, 2);
})()
