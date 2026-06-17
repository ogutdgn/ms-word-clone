/* Page-borders oracle probe (Design tab — F6): apply a 3pt solid RED page border on all sides via the
   bridge (dePageBorders). The bridge maps style solid->single, width->eighths-of-pt (size=max(2,
   round(width*8)); 3->24 == 3.0pt), color->bare hex, and writes <w:pgBorders> into the document.xml
   sectPr. Word COM (validate-pageborders-win.ps1) reads Sections(1).Borders.Item(wdBorderTop=-1):
   .LineStyle == wdLineStyleSingle(1), .LineWidth == wdLineWidth300pt(24), .Color == 255 (red RGB long).
   Saves the docx for the validator. The Design tab page-border surface had ZERO Word-COM oracles before. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM;
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>page border body</p>');
    await sleep(120);
    out.applied = (typeof PM().dePageBorders === 'function')
      ? PM().dePageBorders({ style: 'solid', color: '#FF0000', width: 3 }) : 'missing';
    await sleep(120);
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    const pgb = (docXml.match(/<w:pgBorders\b[\s\S]*?<\/w:pgBorders>/) || [''])[0];
    out.hasPgBorders = /<w:pgBorders\b/.test(docXml);
    out.offsetFrom = (pgb.match(/<w:pgBorders\b[^>]*\bw:offsetFrom="([^"]*)"/) || [])[1] || null;
    const top = (pgb.match(/<w:top\b[^>]*\/?>/) || [''])[0];
    out.topVal = (top.match(/\bw:val="([^"]*)"/) || [])[1] || null;
    out.topSz = (top.match(/\bw:sz="(\d+)"/) || [])[1] || null;
    out.topColor = (top.match(/\bw:color="([^"]*)"/) || [])[1] || null;
    out.edgeCount = (pgb.match(/<w:(top|bottom|left|right)\b/g) || []).length;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-pageborders.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
