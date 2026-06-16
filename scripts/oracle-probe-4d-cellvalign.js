/* Phase 4d cell vertical-alignment oracle probe: a 2x2 table whose first cell is set to MIDDLE via
   tableSetCellVAlign('middle'). The CSS-valued attr is 'middle'; the export must emit OOXML
   w:vAlign w:val="center" (ST_VerticalJc). Word COM must read Tables(1).Rows(1).Cells(1).
   VerticalAlignment = wdCellAlignVerticalCenter(1) — NOT 0 (top/default, the symptom of the
   pre-fix invalid "middle" value Word ignores). */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>va</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(200);
    let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; });
    ed().commands.setTextSelection(cp + 2); await sleep(40);
    out.set = PM().tableSetCellVAlign('middle'); await sleep(160);
    let va = null; doc().descendants((n) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && va == null) va = n.attrs.verticalAlign; });
    out.attr = va;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<w:vAlign\b[^>]*w:val="([^"]*)"/);
    out.exportedVAlign = m && m[1];
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-cellvalign.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
