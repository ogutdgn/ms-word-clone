/* Phase 6b distribute-columns geometry oracle probe: a 3-col table is made UNEVEN (col 0 widened via
   the bridge), then distributeColumnsEvenly. The export must emit <w:tblGrid> with 3 EQUAL <w:gridCol>
   (the px→twips grid projection — a unit bug would land even-in-model but lopsided/odd-twips here). Word
   COM must read Tables(1).Columns(i).Width all ~equal. Saves the docx for validate-distribute-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const colwidths = () => { const w = []; doc().descendants((n) => { if (n.type.name === 'tableRow' && w.length === 0) { n.forEach((c) => { if (c.attrs.colwidth) w.push(c.attrs.colwidth[0]); }); } }); return w; };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>dc</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 3 }); await sleep(200);
    let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; });
    ed().commands.setTextSelection(cp + 2); await sleep(40);
    out.setWide = PM().tableSetCellWidth(260); await sleep(120); // widen col 0 → uneven
    out.before = colwidths();
    out.distribute = PM().tableDistributeColumns(); await sleep(160);
    out.after = colwidths();
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.gridCols = (xml.match(/<w:gridCol\b[^>]*w:w="(\d+)"/g) || []).map((m) => Number(m.match(/w:w="(\d+)"/)[1]));
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-distribute.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
