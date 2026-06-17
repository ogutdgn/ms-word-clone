/* Paragraph-spacing oracle probe (Design tab — F7): set before=12pt / after=18pt / line=3.0 via the
   bridge (deParagraphSpacing). The bridge writes spacing into BOTH word/styles.xml docDefaults AND the
   Normal style (pt->twips x20; line multiple->240ths). A plain paragraph inherits Normal/docDefaults, so
   Word COM (validate-paraspacing-win.ps1) must read Paragraphs.Item(1).SpaceBefore == 12 and
   .SpaceAfter == 18 (points), with LineSpacingRule == wdLineSpaceMultiple(5). Saves the docx for the
   validator. The Design tab had ZERO Word-COM oracles before this probe (byte-only docDefaults check). */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>spacing body text</p>');
    await sleep(120);
    out.applied = (typeof PM().deParagraphSpacing === 'function') ? PM().deParagraphSpacing({ before: 12, after: 18, line: 3 }) : 'missing';
    await sleep(120);
    // styles.xml: docDefaults + Normal style spacing (pt->twips: 12->240, 18->360; line 3->720).
    const parts = await ed().exportDocx({ getUpdatedDocs: true });
    const sx = (parts && parts['word/styles.xml']) || '';
    const dd = (sx.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];
    out.ddBefore = (dd.match(/<w:spacing\b[^>]*\bw:before="(\d+)"/) || [])[1] || null;
    out.ddAfter = (dd.match(/<w:spacing\b[^>]*\bw:after="(\d+)"/) || [])[1] || null;
    out.ddLine = (dd.match(/<w:spacing\b[^>]*\bw:line="(\d+)"/) || [])[1] || null;
    const normal = (sx.match(/<w:style\b[^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/) || [''])[0];
    out.normalAfter = (normal.match(/<w:spacing\b[^>]*\bw:after="(\d+)"/) || [])[1] || null;
    out.normalBefore = (normal.match(/<w:spacing\b[^>]*\bw:before="(\d+)"/) || [])[1] || null;
    // document.xml: does the body paragraph carry a DIRECT pPr spacing (would shadow the inherited)?
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    const firstP = (docXml.match(/<w:p\b[\s\S]*?<\/w:p>/) || [''])[0];
    out.directSpacingInP = /<w:spacing\b/.test(firstP);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-paraspacing.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
