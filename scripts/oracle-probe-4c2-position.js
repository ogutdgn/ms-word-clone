/* Phase 4c.2 reposition oracle probe: a floating (Behind Text) picture positioned 1" right of the
   column + 0.5" below the paragraph via setImagePosition. Word's read-shapes must report a floating
   Shape whose Left ≈ 72pt (1") and Top ≈ 36pt (0.5") — proving wp:positionH/V posOffset is honored. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc, view = () => window.WC.view;
  const mkImg = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#cc6633'; x.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
  const selectImage = () => { let p = null; doc().descendants((n, pos) => { if (n.type.name === 'image' && p == null) p = pos; }); if (p == null) return null; const NS = window.__PM_NodeSelection; view().dispatch(view().state.tr.setSelection(NS.create(view().state.doc, p))); return p; };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>pos</p>'); await sleep(80);
    PM().insertImage({ src: mkImg(120, 90), alt: 'p', width: 120, height: 90 });
    await sleep(250);
    selectImage(); PM().setImageWrap('behind'); await sleep(160);
    selectImage(); out.set = PM().setImagePosition({ horizontal: 96, top: 48 }); await sleep(160);
    let mo = null; doc().descendants((n) => { if (n.type.name === 'image') mo = n.attrs.marginOffset; }); out.marginOffset = mo;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const h = xml.match(/<wp:positionH[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    const v = xml.match(/<wp:positionV[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    out.posOffsetEmu = { h: h && +h[1], v: v && +v[1] };
    const bytes = await PM().exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    const filePath = ['C:', 'tmp', 'wc-pos-4c2.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
