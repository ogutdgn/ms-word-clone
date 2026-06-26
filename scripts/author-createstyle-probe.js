/* 021 — author a docx with a NEW custom paragraph style (bold, 20pt, red) created from a formatted selection,
   for Word-COM read-back: Word's Styles('WcStyleRed') should exist as a paragraph style with Font.Bold/Size/Color. */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const ed = window.WC.editor; const PM = window.WC.PM; const TS = window.__PM_TextSelection;
  const sel = (w) => {
    let f = null;
    ed.state.doc.descendants((n, p) => { if (f || !n.isText || !n.text) return; const i = n.text.indexOf(w); if (i >= 0) f = { from: p + i, to: p + i + w.length }; });
    ed.view.dispatch(ed.view.state.tr.setSelection(TS.create(ed.state.doc, f.from, f.to)));
  };
  ed.commands.selectAll(); ed.commands.insertContent('<p>STYLEDTEXT here</p>'); ed.commands.selectAll(); ed.commands.unsetAllMarks(); await sleep(60);
  sel('STYLEDTEXT'); PM.cmd('toggleBold'); PM.cmd('setMark', 'textStyle', { fontSize: '20pt' }); PM.cmd('setColor', '#FF0000'); await sleep(60);
  sel('STYLEDTEXT');
  const r = PM.createNamedStyle('WcStyleRed'); await sleep(60);
  let detail;
  try {
    const bytes = await PM.exportDocxBytes();
    const s = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-createstyle.docx', bytes });
    detail = (s && s.ok) ? ('saved id=' + (r && r.styleId)) : 'save failed: ' + JSON.stringify(s);
  } catch (e) { detail = 'ERR ' + e.message; }
  return JSON.stringify({ results: [{ name: 'author createstyle', pass: /saved/.test(detail) && !!(r && r.ok), detail }] }, null, 2);
})();
