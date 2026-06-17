/* Header/footer oracle probe (item 3): set the default header + footer TEXT via the bridge
   (setHeaderText/setFooterText). These drive the Document API story-runtime, which writes
   word/header1.xml (<w:hdr>) + a sectPr <w:headerReference> + the document.xml.rels relationship
   (+ [Content_Types] auto-register). Word COM (validate-headerfooter-win.ps1) must read
   Sections(1).Headers(1).Range.Text == 'HdrProbe' and Footers(1) == 'FtrProbe'. Saves the docx for
   the validator. The header/footer surface had ZERO Word-COM oracles before this (and was D6-blocked). */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM;
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>hf body</p>');
    await sleep(120);
    out.setH = (typeof PM().setHeaderText === 'function') ? PM().setHeaderText('HdrProbe') : 'missing';
    await sleep(100);
    out.setF = (typeof PM().setFooterText === 'function') ? PM().setFooterText('FtrProbe') : 'missing';
    await sleep(120);
    // Round-trip readers (cache).
    out.getH = (typeof PM().getHeaderText === 'function') ? PM().getHeaderText() : 'missing';
    out.getF = (typeof PM().getFooterText === 'function') ? PM().getFooterText() : 'missing';
    // document.xml: sectPr header/footer references.
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    out.hdrRef = (docXml.match(/<w:headerReference\b[^>]*\br:id="([^"]+)"/) || [])[1] || null;
    out.ftrRef = (docXml.match(/<w:footerReference\b[^>]*\br:id="([^"]+)"/) || [])[1] || null;
    // Side parts: word/header1.xml + footer + rels.
    const parts = await ed().exportDocx({ getUpdatedDocs: true });
    out.partKeys = Object.keys(parts || {}).filter((k) => /header|footer/i.test(k));
    const hdrPart = Object.entries(parts || {}).find(([k, v]) => /header\d*\.xml$/i.test(k) && /HdrProbe/.test(String(v)));
    const ftrPart = Object.entries(parts || {}).find(([k, v]) => /footer\d*\.xml$/i.test(k) && /FtrProbe/.test(String(v)));
    out.hdrPartHasText = !!hdrPart;
    out.ftrPartHasText = !!ftrPart;
    const rels = (parts && parts['word/_rels/document.xml.rels']) || '';
    out.relHasHeader = /relationships\/header/.test(rels);
    out.relHasFooter = /relationships\/footer/.test(rels);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-headerfooter.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
