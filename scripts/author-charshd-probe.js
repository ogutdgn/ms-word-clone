/* TEMP: author a docx with run-level character shading on a sub-paragraph run ("beta"),
   save to disk for COM read-back. Proves the export is Word-valid CHARACTER shading. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ta = async (name, fn) => { try { const r = await fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); } };
  const done = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p }, results }, null, 2); };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const ed = window.WC.editor; const PM = window.WC.PM; const TS = window.__PM_TextSelection;
  ed.commands.selectAll(); ed.commands.insertContent('alpha beta gamma'); ed.commands.selectAll(); ed.commands.unsetAllMarks(); await sleep(40);
  let f = null; ed.state.doc.descendants((n, pos) => { if (f || !n.isText || !n.text) return; const i = n.text.indexOf('beta'); if (i >= 0) f = { from: pos + i, to: pos + i + 4 }; });
  ed.view.dispatch(ed.view.state.tr.setSelection(TS.create(ed.state.doc, f.from, f.to)));
  ed.commands.setHighlight('#FFE599'); await sleep(60);
  await ta('export+save char-shd docx', async () => {
    const bytes = await PM.exportDocxBytes();
    const s = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-charshd.docx', bytes });
    return (s && s.ok) ? 'saved' : 'save failed: ' + JSON.stringify(s);
  });
  return done();
})();
