/* Phase 4d.5 AutoFit Contents oracle probe: a 2-col table, short content in col 0 + long in
   col 1, AutoFit Contents -> export. Word's read-table must render col 0 narrower than col 1. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>x</p>'); await sleep(80);
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(200);
    let firstCell = null; doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && firstCell == null) firstCell = pos; });
    ed().commands.setTextSelection(firstCell + 2); ed().commands.insertContent('Hi');
    ed().commands.goToNextCell(1); ed().commands.insertContent('Supercalifragilistic expialidocious lengthy column content here');
    await sleep(250);
    out.steps.push('autofit=' + PM().tableAutoFit('contents')); await sleep(250);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.gridColsTwips = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    const bytes = await PM().exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    const filePath = ['C:', 'tmp', 'wc-autofit-contents.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
