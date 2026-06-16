/* Phase 6b merged-cell gridSpan oracle probe: a 2x3 table whose first two cells of row 1 are merged
   via the bridge (tableSelectFirstRowPair + tableMerge). The export must emit <w:gridSpan w:val="2">
   on the surviving cell while <w:tblGrid> keeps 3 columns. Word COM must OPEN WITHOUT REPAIR (the
   corruption signal) and read Tables(1).Rows(1).Cells.Count = 2 (merged) and Rows(2).Cells.Count = 3.
   Saves the docx for validate-gridspan-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>gs</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 3 }); await sleep(200);
    // caret into the first cell so tableSelectFirstRowPair can resolve the table
    let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; });
    ed().commands.setTextSelection(cp + 2); await sleep(40);
    out.sel = PM().tableSelectFirstRowPair(); await sleep(80);
    out.merge = PM().tableMerge(); await sleep(160);
    // model: first row cell count
    let firstRowCells = null; doc().descendants((n) => { if (n.type.name === 'tableRow' && firstRowCells == null) firstRowCells = n.childCount; });
    out.firstRowCells = firstRowCells;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const gs = xml.match(/<w:gridSpan\b[^>]*w:val="(\d+)"/);
    out.gridSpan = gs && gs[1];
    out.gridColCount = (xml.match(/<w:gridCol\b/g) || []).length;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-gridspan.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
