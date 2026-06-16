/* Stretched-image oracle probe: a 1:1 PNG given a 4:1 box (240x60), exported. Word's read-shapes
   must report a 240x60px (180pt x 45pt) InlineShape — NOT aspect-forced to 60x60 or 240x240. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc, view = () => window.WC.view;
  const mkImg = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>stretch</p>'); await sleep(80);
    PM().insertImage({ src: mkImg(100, 100), alt: 'sq', width: 100, height: 100 });
    await sleep(250);
    let pos = null; doc().descendants((n, p) => { if (n.type.name === 'image' && pos == null) pos = p; });
    const node = doc().nodeAt(pos);
    view().dispatch(view().state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, size: { width: 240, height: 60 } }));
    await sleep(300);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const m = xml.match(/<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    out.extentPx = m ? { cx: Math.round(+m[1] / 9525), cy: Math.round(+m[2] / 9525) } : null;
    const bytes = await PM().exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    const filePath = ['C:', 'tmp', 'wc-img-stretch.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
