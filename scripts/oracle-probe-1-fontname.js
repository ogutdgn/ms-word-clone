/* Font-family (rFonts) oracle probe: apply "Georgia" to a WHOLE paragraph via the bridge
   (setFontFamily). The export must emit <w:rFonts w:ascii="Georgia" ...>. Word COM must read
   Font.Name = "Georgia" on a TEXT-ONLY range (exclude the pilcrow). Saves the docx for
   validate-fontname-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>named text</p>'); await sleep(80);
    let from = null, to = null;
    doc().descendants((n, pos) => { if (n.type.name === 'paragraph' && from == null) { from = pos + 1; to = pos + 1 + n.content.size; } });
    ed().commands.setTextSelection({ from, to }); await sleep(40);
    out.set = PM().cmd('setFontFamily', 'Georgia'); await sleep(160);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const rf = (xml.match(/<w:rFonts\b[^>]*\/?>/) || [])[0] || null;
    out.rFonts = rf;
    out.ascii = rf && (rf.match(/w:ascii="([^"]*)"/) || [])[1];
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-fontname.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
