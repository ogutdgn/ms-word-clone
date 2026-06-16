/* Phase 6b cell SHADING oracle probe: a 2x2 table whose first cell is shaded red (FF0000) via the
   bridge tableSetCellShading. The export must emit <w:shd w:fill="FF0000">. Word COM must read
   Tables(1).Rows(1).Cells(1).Shading.BackgroundPatternColor = 255 (wdColor RGB long for pure red =
   R + G*256 + B*65536 = 255). A swapped value (e.g. 16711680) would reveal a BGR/RGB channel bug.
   Saves the docx for validate-cellshading-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>shd</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(200);
    let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; });
    ed().commands.setTextSelection(cp + 2); await sleep(40);
    out.set = PM().tableSetCellShading('FF0000');
    await sleep(160);
    let bg = null; doc().descendants((n) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && bg == null) bg = n.attrs.background; });
    out.attr = bg;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<w:shd\b[^>]*w:fill="([^"]*)"/);
    out.exportedFill = m && m[1];
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-cellshading.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
