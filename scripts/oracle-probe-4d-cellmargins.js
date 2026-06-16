/* Phase 4d cell-MARGINS oracle probe: a 2x2 table whose first cell gets 0.5" margins on all four
   sides via the bridge tableSetCellMargins (px = 0.5*96 = 48 → exporter writes <w:tcMar> in twips,
   48px = 720 twips = 36pt). Word COM must read Tables(1).Rows(1).Cells(1).TopPadding/BottomPadding/
   LeftPadding/RightPadding = 36 (points). Saves the docx so validate-cellmargins-win.ps1 can read it. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>cm</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(200);
    let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; });
    ed().commands.setTextSelection(cp + 2); await sleep(40);
    out.set = PM().tableSetCellMargins({ top: 48, bottom: 48, left: 48, right: 48 }); await sleep(160);
    let cm = null; doc().descendants((n) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cm == null) cm = n.attrs.cellMargins; });
    out.attr = cm;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<w:tcMar\b[\s\S]*?<\/w:tcMar>/);
    out.tcMar = m && m[0];
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-cellmargins.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
