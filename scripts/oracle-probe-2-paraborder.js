/* Paragraph BORDER oracle probe: apply a single bottom border (Word default: single, 0.5pt = size 4
   eighths, auto color, 1pt space) to the first paragraph via the bridge. The export must emit
   <w:pBdr><w:bottom w:val="single" w:sz="4" ...>. Word COM must read Paragraphs(1).Borders(-3)
   (wdBorderBottom) .LineStyle = 1 (wdLineStyleSingle) and .LineWidth = 4 (wdLineWidth050pt = 0.5pt) —
   the eighths-of-a-point → half-point mapping. Saves the docx for validate-paraborder-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>bordered paragraph</p>'); await sleep(80);
    // caret into the first paragraph (the bordered one)
    ed().commands.setTextSelection(3); await sleep(40);
    const border = { val: 'single', size: 4, color: 'auto', space: 1 };
    out.set = PM().cmd('updateAttributes', 'paragraph', { 'paragraphProperties.borders': { bottom: border } });
    await sleep(160);
    let b = null; doc().descendants((n) => { if (n.type.name === 'paragraph' && b == null) b = n.attrs.paragraphProperties?.borders; });
    out.attr = b;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const pbdr = (xml.match(/<w:pBdr\b[\s\S]*?<\/w:pBdr>/) || [])[0] || '';
    out.pBdr = pbdr;
    const bot = pbdr.match(/<w:bottom\b[^>]*\/?>/);
    out.bottom = bot && bot[0];
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-paraborder.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
