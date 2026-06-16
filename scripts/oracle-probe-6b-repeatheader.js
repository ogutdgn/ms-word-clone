/* Phase 6b REPEAT HEADER ROW oracle probe: a 2x2 table whose first row is toggled to a repeating
   header via the bridge tableToggleHeaderRow. The export must emit <w:tblHeader> inside the first
   row's <w:trPr>. Word COM must read Tables(1).Rows(1).HeadingFormat = True (-1) — the "repeat as
   header row at the top of each page" pagination flag. Saves the docx for validate-repeatheader-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>rh</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(200);
    let cp = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; });
    ed().commands.setTextSelection(cp + 2); await sleep(40);
    out.set = PM().tableToggleHeaderRow(); await sleep(160);
    // model: first row repeatHeader + header cells
    let rp = null, hdr = false;
    doc().descendants((n) => { if (n.type.name === 'tableRow' && rp == null) rp = n.attrs.tableRowProperties?.repeatHeader; });
    doc().descendants((n) => { if (n.type.name === 'tableHeader') hdr = true; });
    out.repeatHeaderAttr = rp; out.hasHeaderCell = hdr;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const firstTrPr = (xml.match(/<w:trPr\b[\s\S]*?<\/w:trPr>/) || [])[0] || '';
    out.firstTrPrHasTblHeader = /<w:tblHeader\b/.test(firstTrPr);
    out.firstTrPr = firstTrPr.slice(0, 200);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-repeatheader.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
