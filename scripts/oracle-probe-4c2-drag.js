/* Phase 4c.2 DRAG oracle probe: insert a floating (Behind Text) picture, then DRAG it via the resize
   overlay's new move-region (synthetic pointer events, like the [4b] dragHandle helper). The drag writes
   marginOffset → wp:positionH/V → wp:posOffset (EMU). Word's read-shapes must report a floating Shape
   whose Left/Top (pt) ≈ marginOffset(px) * 0.75 — proving the DRAG affordance produces a Word-faithful
   position (the geometry path is the same setImagePosition the numeric/nudge halves already validated). */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc, view = () => window.WC.view;
  const mkImg = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#cc6633'; x.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
  const selectImage = () => { let p = null; doc().descendants((n, pos) => { if (n.type.name === 'image' && p == null) p = pos; }); if (p == null) return null; const NS = window.__PM_NodeSelection; view().dispatch(view().state.tr.setSelection(NS.create(view().state.doc, p))); return p; };
  const moOf = () => { let mo = null; doc().descendants((n) => { if (n.type.name === 'image') mo = n.attrs.marginOffset; }); return mo || {}; };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>drag</p>'); await sleep(80);
    PM().insertImage({ src: mkImg(120, 90), alt: 'd', width: 120, height: 90 });
    await sleep(250);
    selectImage(); PM().setImageWrap('behind'); await sleep(180);
    selectImage(); PM().setImagePosition({ horizontal: 0, top: 0 }); await sleep(150); // known baseline
    selectImage(); await sleep(120);
    out.before = moOf();
    // Drag the move-region by +160/+80 screen px (zoom is 1 in the probe → marginOffset += 160/80).
    const mv = document.querySelector('.wc-img-resize .wc-img-move-region');
    out.moveRegionPresent = !!mv;
    out.moveRegionActive = mv ? getComputedStyle(mv).pointerEvents : null;
    if (mv) {
      const r = mv.getBoundingClientRect();
      const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
      mv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: sx, clientY: sy, pointerId: 2 }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: sx + 160, clientY: sy + 80, pointerId: 2 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: sx + 160, clientY: sy + 80, pointerId: 2 }));
      await sleep(220);
    }
    out.after = moOf();
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const h = xml.match(/<wp:positionH[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    const v = xml.match(/<wp:positionV[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    out.posOffsetEmu = { h: h && +h[1], v: v && +v[1] };
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-pos-4c2-drag.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
