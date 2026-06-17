/* Sub/superscript oracle probe: para 1 → subscript, para 2 → superscript via the bridge
   (setMark textStyle {vertAlign}). The export must emit <w:vertAlign w:val="subscript"> and
   <w:vertAlign w:val="superscript">. Word COM must read Paragraphs(1).Range.Font.Subscript = -1 (True)
   and Paragraphs(2).Range.Font.Superscript = -1. Whole-paragraph apply + (validator) text-only range.
   Saves the docx for validate-vertalign-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const selectPara = (needle) => {
    let from = null, to = null;
    doc().descendants((n, pos) => { if (n.type.name === 'paragraph' && from == null && n.textContent.includes(needle)) { from = pos + 1; to = pos + 1 + n.content.size; } });
    if (from != null) ed().commands.setTextSelection({ from, to });
    return from != null;
  };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>sub line</p><p>sup line</p>'); await sleep(100);
    selectPara('sub'); await sleep(30); out.setSub = PM().cmd('setMark', 'textStyle', { vertAlign: 'subscript' }); await sleep(80);
    selectPara('sup'); await sleep(30); out.setSup = PM().cmd('setMark', 'textStyle', { vertAlign: 'superscript' }); await sleep(80);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.vertAligns = (xml.match(/<w:vertAlign\b[^>]*w:val="([^"]*)"/g) || []).map((m) => m.match(/w:val="([^"]*)"/)[1]);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-vertalign.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
