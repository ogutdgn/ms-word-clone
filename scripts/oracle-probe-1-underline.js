/* Underline-STYLE oracle probe: 5 paragraphs, each underlined with a different style via the bridge
   (setUnderline + setMark underline {underlineType}). The export must emit <w:u w:val="..."> per
   paragraph in order [single, double, dotted, dash, wave] (OOXML ST_Underline). Word COM must read
   Paragraphs(i).Range.Font.Underline = [1,3,4,7,11] (wdUnderline Single/Double/Dotted/Dash/Wavy) — the
   CSS→OOXML enum map (dashed→dash, wavy→wave) is the fidelity risk. Saves the docx for validate-underline-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const styles = ['single', 'double', 'dotted', 'dash', 'wave'];
  const selectPara = (needle) => {
    let from = null, to = null;
    doc().descendants((n, pos) => { if (n.type.name === 'paragraph' && from == null && n.textContent.includes(needle)) { from = pos + 1; to = pos + 1 + n.content.size; } });
    if (from != null) ed().commands.setTextSelection({ from, to });
    return from != null;
  };
  try {
    ed().commands.selectAll();
    ed().commands.insertContent(styles.map((s, i) => `<p>uline${i} text</p>`).join(''));
    await sleep(100);
    for (let i = 0; i < styles.length; i++) {
      if (!selectPara('uline' + i)) { out.error = 'could not select para ' + i; break; }
      await sleep(30);
      PM().chain([['setUnderline'], ['setMark', 'underline', { underlineType: styles[i] }]]);
      await sleep(80);
    }
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.exportedVals = (xml.match(/<w:u\b[^>]*w:val="([^"]*)"/g) || []).map((m) => m.match(/w:val="([^"]*)"/)[1]);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-underline.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
