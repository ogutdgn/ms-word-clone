/* Picture-effect (grayscale recolor) oracle probe (item 2): insert an inline picture, apply grayscale
   via the bridge (setImageGrayscale), and export. The image node's `grayscale` attr makes the exporter
   emit a plain <a:grayscl/> as a child of a:blip (decode-image-node-helpers.js:369) — Word's OWN grayscale
   OOXML (authored-in-Word COM ground truth: NOT the a14 imgEffect extension). Word COM
   (validate-picteffect-win.ps1) must read InlineShapes(1).PictureFormat.ColorType == 2 (grayscale, the
   1-based MsoPictureColorType — an earlier attempt mis-read 2 as BlackAndWhite via a 0-based enum and was
   wrongly reverted). Asserts a:grayscl present AND no a14 imgEffect. Saves the docx for the validator. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const mkImg = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
  const selectImage = () => { let pos = null; doc().descendants((n, p) => { if (n.type.name === 'image' && pos == null) pos = p; }); if (pos == null) return null; ed().view.dispatch(ed().state.tr.setSelection(window.WC.view.state.selection.constructor.create ? window.__PM_NodeSelection.create(doc(), pos) : ed().state.selection)); return pos; };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>pic body</p>'); await sleep(80);
    window.WC.Commands.insertPictureFromDataUrl(mkImg(120, 120)); await sleep(180);
    out.imgInserted = false; doc().descendants((n) => { if (n.type.name === 'image') out.imgInserted = true; });
    // select the image (NodeSelection) so the bridge verb targets it
    let pos = null; doc().descendants((n, p) => { if (n.type.name === 'image' && pos == null) pos = p; });
    if (pos != null && window.__PM_NodeSelection) ed().view.dispatch(ed().state.tr.setSelection(window.__PM_NodeSelection.create(doc(), pos)));
    await sleep(40);
    out.applied = (typeof PM().setImageGrayscale === 'function') ? PM().setImageGrayscale(true) : 'missing';
    await sleep(120);
    out.nodeGrayscale = null; doc().descendants((n) => { if (n.type.name === 'image' && out.nodeGrayscale == null) out.nodeGrayscale = n.attrs.grayscale; });
    const img = document.querySelector('#pm-editor .ProseMirror img');
    let f = null; if (img) { f = getComputedStyle(img).filter; const sp = img.closest('span'); if ((!f || f === 'none') && sp) f = getComputedStyle(sp).filter; }
    out.imgFilter = f;
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    out.hasGrayscl = /<a:blip[\s\S]*?<a:grayscl\b/.test(docXml);
    out.hasA14ImgEffect = /a14:imgEffect|a14:imgProps|a14:imgLayer/.test(docXml);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-picteffect.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
