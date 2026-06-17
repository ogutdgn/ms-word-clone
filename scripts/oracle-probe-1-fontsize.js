/* Font-SIZE oracle probe: apply 20pt to a WHOLE paragraph via the bridge (setFontSize). The export must
   emit <w:sz w:val="40"> (w:sz is HALF-points, so 20pt = 40). Word COM must read Font.Size = 20 (points)
   on a TEXT-ONLY range (exclude the pilcrow). Saves the docx for validate-fontsize-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>sized text</p>'); await sleep(80);
    let from = null, to = null;
    doc().descendants((n, pos) => { if (n.type.name === 'paragraph' && from == null) { from = pos + 1; to = pos + 1 + n.content.size; } });
    ed().commands.setTextSelection({ from, to }); await sleep(40);
    out.set = PM().cmd('setFontSize', '20pt'); await sleep(160);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.szVal = (xml.match(/<w:sz\b[^>]*w:val="([^"]*)"/) || [])[1] || null; // \b excludes w:szCs
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-fontsize.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
