/* Hyperlink oracle probe: insert a hyperlink via the bridge (insertLink). The export must emit
   <w:hyperlink r:id="rIdN"> AND a matching External Relationship in word/_rels/document.xml.rels
   (Target=the url, TargetMode=External) — else Word can't resolve the address. Word COM must read
   doc.Hyperlinks.Count = 1, .Item(1).Address = the url, .TextToDisplay = the link text. Saves the
   docx for validate-hyperlink-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM;
  const URL = 'https://example.com/';
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>see </p>'); await sleep(80);
    ed().commands.setTextSelection(5); await sleep(40); // caret after "see "
    out.set = PM().insertLink({ href: URL, text: 'click here' }); await sleep(160);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const hl = xml.match(/<w:hyperlink\b[^>]*>/);
    out.hyperlinkTag = hl && hl[0];
    out.rId = hl && (hl[0].match(/r:id="([^"]+)"/) || [])[1];
    // Relationship lookup in the converter's rels part.
    const rels = ed().converter?.convertedXml?.['word/_rels/document.xml.rels'];
    let relTarget = null, relMode = null;
    if (rels && out.rId) {
      const els = (rels.elements && rels.elements[0] && rels.elements[0].elements) || [];
      const rel = els.find((e) => e.name === 'Relationship' && e.attributes && e.attributes.Id === out.rId);
      if (rel) { relTarget = rel.attributes.Target; relMode = rel.attributes.TargetMode; }
    }
    out.relTarget = relTarget; out.relMode = relMode;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-hyperlink.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
