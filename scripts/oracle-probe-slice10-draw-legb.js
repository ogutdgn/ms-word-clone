/* Slice-10 draw oracle Leg B (Word -> clone): import Word's OWN serialization of the ink/canvas
   doc (the resaved docx) back into the clone, confirm it loads healthy + the ink renders via the
   overlay, then re-export and verify the constructs survived the clone's import of Word's bytes. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const PM = () => window.WC.PM;
  const doc = () => window.WC.view.state.doc;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));
  try {
    const r = await window.wordAPI.openBytes('C:\\tmp\\wc-slice10-draw-resaved.docx');
    log('openBytes.ok', !!(r && r.ok));
    if (!r || !r.ok || !r.bytes) { out.error = 'openBytes returned no bytes'; return JSON.stringify(out, null, 2); }
    log('openDocx', await PM().openDocx(r.bytes));
    await sleep(500);
    log('importBlanked', PM().lastImportBlanked ? PM().lastImportBlanked() : 'n/a');
    const types = {};
    doc().descendants((n) => { types[n.type.name] = (types[n.type.name] || 0) + 1; });
    out.nodeTypes = types;
    // overlay should have rendered the imported ink (renderInk reads customGeometry.paths)
    out.overlayStrokes = document.querySelectorAll('.wc-ink-layer .pm-ink-stroke').length;
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    out.has = { custGeom: /<a:custGeom\b/.test(xml), rect: /prst="rect"/.test(xml) };
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})()
