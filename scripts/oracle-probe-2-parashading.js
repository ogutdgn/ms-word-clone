/* Paragraph SHADING oracle probe: apply a red (FF0000) shade to the first paragraph via the bridge.
   The export must emit <w:pPr><w:shd w:val="clear" w:color="auto" w:fill="FF0000"/> (w:val MUST be
   "clear" for Word to paint the fill). Word COM must read Paragraphs(1).Shading.BackgroundPatternColor
   = 255 (wdColor RGB long for pure red = R + G*256 + B*65536). Saves the docx for
   validate-parashading-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>shaded paragraph</p>'); await sleep(80);
    ed().commands.setTextSelection(3); await sleep(40);
    out.set = PM().cmd('updateAttributes', 'paragraph', { 'paragraphProperties.shading': { val: 'clear', color: 'auto', fill: 'FF0000' } });
    await sleep(160);
    let s = null; doc().descendants((n) => { if (n.type.name === 'paragraph' && s == null) s = n.attrs.paragraphProperties?.shading; });
    out.attr = s;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const shd = (xml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/g) || []).map((p) => p.match(/<w:shd\b[^>]*\/?>/)).filter(Boolean).map((m) => m[0]);
    out.shd = shd[0] || null;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-parashading.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
