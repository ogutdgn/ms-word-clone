/* Page-setup oracle probe (LAYOUT tab — F5/F6): apply NON-DEFAULT page geometry via the new bridge
   verbs — Narrow margins (0.5in all sides) + Legal page (8.5x14in) + LANDSCAPE. The bridge routes to
   the Document API sections adapter (setPageMargins/setPageSetup), which writes w:pgMar/w:pgSz into the
   body sectPr (inches->twips x1440) and auto-swaps w:w/w:h on the orientation flip. After landscape,
   the exported page is 14in wide x 8.5in tall -> w:w=20160 w:h=12240; margins 0.5in -> 720 twips.
   Word COM (validate-pagesetup-win.ps1) must read Sections(1).PageSetup: margins 36pt, PageWidth 1008pt,
   PageHeight 612pt, Orientation 1 (landscape). The LAYOUT geometry surface had ZERO Word-COM oracles
   AND did not even export before this work (setPageVar was CSS-only). Saves the docx for the validator. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM;
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>page setup body</p>');
    await sleep(120);
    out.appliedMargins = (typeof PM().dePageMargins === 'function')
      ? PM().dePageMargins({ top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }) : 'missing';
    await sleep(80);
    out.appliedSize = (typeof PM().dePageSize === 'function')
      ? PM().dePageSize({ width: 8.5, height: 14, orientation: 'landscape' }) : 'missing';
    await sleep(120);
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    const pgMar = (docXml.match(/<w:pgMar\b[^>]*\/?>/) || [''])[0];
    const pgSz = (docXml.match(/<w:pgSz\b[^>]*\/?>/) || [''])[0];
    out.pgMar = pgMar;
    out.pgSz = pgSz;
    out.marTop = (pgMar.match(/\bw:top="(-?\d+)"/) || [])[1] || null;
    out.marLeft = (pgMar.match(/\bw:left="(-?\d+)"/) || [])[1] || null;
    out.szW = (pgSz.match(/\bw:w="(\d+)"/) || [])[1] || null;
    out.szH = (pgSz.match(/\bw:h="(\d+)"/) || [])[1] || null;
    out.orient = (pgSz.match(/\bw:orient="([^"]*)"/) || [])[1] || null;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-pagesetup.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
