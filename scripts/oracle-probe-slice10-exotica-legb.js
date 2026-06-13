/* Slice-10 insert-exotica oracle Leg B (Word -> clone): import Word's OWN serialization of the
   exotica doc (the resaved docx) back into the clone, confirm it loads healthy, then re-export and
   verify the exotic constructs survived the clone's import of Word's bytes. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const PM = () => window.WC.PM;
  const doc = () => window.WC.view.state.doc;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));
  try {
    const r = await window.wordAPI.openBytes('C:\\tmp\\wc-slice10-exotica-all-resaved.docx');
    log('openBytes.ok', !!(r && r.ok));
    if (!r || !r.ok || !r.bytes) { out.error = 'openBytes returned no bytes'; return JSON.stringify(out, null, 2); }
    const imported = await PM().openDocx(r.bytes);
    log('openDocx', imported);
    await sleep(400);
    log('importBlanked', PM().lastImportBlanked ? PM().lastImportBlanked() : 'n/a');
    // Node types present after importing Word's serialization.
    const types = {};
    doc().descendants((n) => { types[n.type.name] = (types[n.type.name] || 0) + 1; });
    out.nodeTypes = types;
    out.docText = doc().textContent.slice(0, 120);
    // Re-export and confirm the real OOXML constructs survive the clone's import->export of Word's bytes.
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    out.has = {
      framePrDropCap: /<w:framePr\b[^>]*w:dropCap/.test(xml),
      docPartObj: /docPartGallery|<w:docPartObj\b/.test(xml),
      dateField: /DATE\b/.test(xml),
      wordArtWsp: /<wps:wsp\b/.test(xml) || /fromWordArt/.test(xml),
      textboxVml: /<v:textbox\b/.test(xml) || /<w:txbxContent\b/.test(xml),
    };
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})()
