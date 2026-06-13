/* Slice-10 themes oracle Leg B (Word -> clone): import Word's OWN serialization of the
   themed doc (the resaved docx) back into the clone, confirm it loads healthy, then
   re-export and verify the theme constructs survived the clone's import of Word's bytes. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const PM = () => window.WC.PM;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));
  try {
    // Open Word's resaved docx: openBytes returns { ok, path, bytes }; the renderer imports
    // via PM.openDocx(bytes) (the same path files.js + the [10th] round-trip test use).
    const r = await window.wordAPI.openBytes('C:\\tmp\\wc-slice10-themes-resaved.docx');
    log('openBytes.ok', !!(r && r.ok));
    if (!r || !r.ok || !r.bytes) { out.error = 'openBytes returned no bytes'; return JSON.stringify(out, null, 2); }
    const imported = await PM().openDocx(r.bytes);
    log('openDocx', imported);
    out.openedRaw = imported;
    await sleep(400);
    log('importBlanked', PM().lastImportBlanked ? PM().lastImportBlanked() : 'n/a');
    // Re-export the imported doc and inspect.
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    out.background = (xml.match(/<w:background\b[^>]*w:color="([^"]*)"/) || [])[1] || null;
    out.pgBorders = /<w:pgBorders\b/.test(xml);
    const parts = await window.WC.editor.exportDocx({ getUpdatedDocs: true });
    const sx = parts['word/styles.xml'] || '';
    const norm = (sx.match(/<w:style\b[^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/) || [''])[0];
    out.normalAscii = (norm.match(/<w:rFonts\b[^>]*w:ascii="([^"]*)"/) || [])[1] || null;
    const h1 = (sx.match(/<w:style\b[^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/) || [''])[0];
    out.heading1ColorVal = (h1.match(/<w:color\b[^>]*w:val="([^"]*)"/) || [])[1] || null;
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})()
