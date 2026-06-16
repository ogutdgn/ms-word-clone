/* Font-COLOR oracle probe: apply red (#FF0000) to a WHOLE paragraph via the bridge (setColor). The
   export must emit <w:color w:val="FF0000"> (no '#'). Word COM must read Paragraphs(1).Range.Font.Color
   = 255 (wdColor RGB long for pure red = R + G*256 + B*65536; a BGR/RGB swap would read 16711680).
   Whole-paragraph apply → uniform run so the COM read is representative. Saves the docx for
   validate-fontcolor-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>colored text</p>'); await sleep(80);
    let from = null, to = null;
    doc().descendants((n, pos) => { if (n.type.name === 'paragraph' && from == null) { from = pos + 1; to = pos + 1 + n.content.size; } });
    ed().commands.setTextSelection({ from, to }); await sleep(40);
    out.set = PM().cmd('setColor', '#FF0000'); await sleep(160);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.colorVal = (xml.match(/<w:color\b[^>]*w:val="([^"]*)"/) || [])[1] || null;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-fontcolor.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
