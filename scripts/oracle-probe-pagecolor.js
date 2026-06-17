/* Page-color oracle probe (Design tab — F12): set a YELLOW page color via the bridge (dePageColor).
   The bridge writes <w:background w:color="FFFF00"> into document.xml AND must ensure
   <w:displayBackgroundShape/> in settings.xml — WITHOUT that settings flag Word does NOT render the
   page background on open (the K4 requirement). This probe captures BOTH parts. Word COM page-fill
   reads (doc.Background.Fill) can be unreadable on headless docs, so the validator attempts them
   best-effort (here they read cleanly: RGB 65535) while the byte evidence (both parts present) is the
   authoritative check. Saves the docx for validate-pagecolor-win.ps1. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM;
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>page color body</p>');
    await sleep(120);
    out.applied = (typeof PM().dePageColor === 'function') ? PM().dePageColor('#FFFF00') : 'missing';
    await sleep(120);
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    out.bgInDoc = /<w:background\b/.test(docXml);
    out.bgColor = (docXml.match(/<w:background\b[^>]*\bw:color="([^"]*)"/) || [])[1] || null;
    // settings.xml: <w:displayBackgroundShape/> — REQUIRED for Word to render the page bg on open.
    // getUpdatedDocs returns the MODIFIED parts; settings.xml appears here because dePageColor always
    // touches it (ensureDisplayBackgroundShape) — so displayBgShape is authoritative for THIS probe.
    const parts = await ed().exportDocx({ getUpdatedDocs: true });
    const settings = (parts && parts['word/settings.xml']) || '';
    out.hasSettings = typeof settings === 'string' && settings.length > 0;
    out.displayBgShape = /<w:displayBackgroundShape\b/.test(settings);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-pagecolor.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
