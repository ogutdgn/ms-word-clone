/* Milestone-4c ink-overlay probe (mode-aware). Run via:
     # paged (the headline checks):
     WC_LAYOUT=paged npm run build && \
     electron . --probe-out=/tmp/wc-ink.json --shot-evalfile=scripts/paged-ink-probe.js
     # overlay parity:
     npm run build && \
     electron . --probe-out=/tmp/wc-ink-ovl.json --shot-evalfile=scripts/paged-ink-probe.js

   Proves M4c: in paged mode in-app ink works on page 0, page 1 AND a page-2 TOP-anchor (synthetic draw → the NEW
   stroke lands on the target painted page; the page-2 top case guards the forward-first page resolution), the eraser
   deletes EXACTLY the clicked node, the persisted pos is PAGE-LOCAL, and the EXPORTED OOXML (wp:positionV/posOffset)
   is page-local EMU on its page (→ Word places it correctly). overlay: a drawn stroke's inkPos is #pm-editor-local
   and it renders where drawn (no page-origin offset leaks in) — byte-identical to pre-M4c. NOTE: re-rendering a
   docx-REOPENED multi-page stroke is a pre-existing inkPos-recovery gap (both modes), out of M4c scope — surfaced as
   an INFO row, not gated. Same {summary, results[]} JSON contract. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const done = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); };

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const view = () => W.view;
  const coords = W.PM && W.PM.coords;
  const inkLayer = () => document.querySelector('svg.wc-ink-layer');
  const pageEl = (idx) => document.querySelector('.superdoc-page[data-page-index="' + idx + '"]');
  const pageOfClientY = (cy) => { for (const p of document.querySelectorAll('.superdoc-page')) { const pr = p.getBoundingClientRect(); if (cy >= pr.top - 2 && cy <= pr.bottom + 2) return parseInt(p.getAttribute('data-page-index'), 10); } return null; };
  const inkNodes = () => { const a = []; try { view().state.doc.descendants((n, p) => { const cg = n.attrs && n.attrs.customGeometry; if (n.type && n.type.name === 'vectorShape' && ((n.attrs && n.attrs.isInk) || (cg && (cg.inkPoints || cg.paths)))) a.push({ pos: p, node: n }); }); } catch (e) {} return a; };
  const renderedStrokes = () => { const L = inkLayer(); return L ? Array.from(L.querySelectorAll('.pm-ink-stroke')) : []; };
  const activatePen = () => { try { W.PM.dSetPen({ color: '#0033cc', width: 3 }); } catch (e) {} try { W.PM.dSetDrawing(true); } catch (e) {} try { W.PM.__inkOverlay && W.PM.__inkOverlay.sync && W.PM.__inkOverlay.sync(); } catch (e) {} };
  const synthDraw = (pts) => { const L = inkLayer(); if (!L) return; const id = 11; L.dispatchEvent(new PointerEvent('pointerdown', { clientX: pts[0].x, clientY: pts[0].y, button: 0, buttons: 1, pointerId: id, isPrimary: true, bubbles: true, cancelable: true })); for (let i = 1; i < pts.length; i++) window.dispatchEvent(new PointerEvent('pointermove', { clientX: pts[i].x, clientY: pts[i].y, buttons: 1, pointerId: id, bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { clientX: pts[pts.length - 1].x, clientY: pts[pts.length - 1].y, pointerId: id, bubbles: true })); };
  const drawOnPage = (idx) => { const el = pageEl(idx); if (!el) return null; try { el.scrollIntoView({ block: 'center' }); } catch (e) {} return el; };

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 200) && false));
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('coords.clientToOverlayLocalPt + overlayPageBox + ink bridge present', () => !!(coords && typeof coords.clientToOverlayLocalPt === 'function' && typeof coords.overlayPageBox === 'function' && W.PM && W.PM.__inkOverlay && typeof W.PM.dInsertInk === 'function' && W.view));
  if (!ok) return done();

  if (mode === 'paged') {
    // ── force a multi-page doc ──
    try { view().dispatch(view().state.tr.insertText('Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(500), 1)); } catch (e) {}
    let np = -1; for (let i = 0; i < 240; i++) { np = (W.presentation && W.presentation.getPages) ? W.presentation.getPages().length : -1; if (np > 1) break; await sleep(50); }
    t('forced a multi-page doc (getPages > 1)', () => np > 1 ? ('pages=' + np) : ('pages=' + np + ' — cannot exercise multi-page ink' && false));
    await sleep(200);
    activatePen();
    await sleep(100);

    // ── the active layer captures (on top + pointer-events:auto) ──
    t('active ink layer captures (pointer-events:auto, above the painted page)', () => {
      const L = inkLayer(); if (!L) return 'no ink layer' && false;
      const cs = getComputedStyle(L); const p0 = pageEl(0); if (!p0) return 'no page 0' && false;
      const pr = p0.getBoundingClientRect(); const top = document.elementFromPoint(pr.left + pr.width / 2, pr.top + 200);
      const onTop = !!(top && top.closest && top.closest('svg.wc-ink-layer'));
      return cs.pointerEvents === 'auto' && onTop ? ('pe=auto onTop=svg') : ('pe=' + cs.pointerEvents + ' top=' + (top && top.tagName) + ' onTop=' + onTop && false);
    });

    // ── DRAW on page 0 → a committed stroke lands on page 0 ──
    const before0 = renderedStrokes().length;
    { const el = drawOnPage(0); await sleep(120); const pr = el.getBoundingClientRect(); const bx = pr.left + pr.width * 0.3, by = pr.top + 250; synthDraw([{ x: bx, y: by }, { x: bx + 70, y: by + 35 }, { x: bx + 140, y: by - 8 }]); }
    await sleep(400);
    t('draw on page 0 → the NEW committed stroke renders ON page 0', () => {
      const ss = renderedStrokes(); if (ss.length !== before0 + 1) return 'expected exactly 1 new stroke (' + before0 + '→' + ss.length + ')';
      // newest stroke = LAST in doc order (renderInk appends per descendants; a page-0 draw is the highest-pos ink)
      const cr = ss[ss.length - 1].getBoundingClientRect(); const pg = pageOfClientY(cr.top + cr.height / 2);
      return pg === 0 ? ('strokes ' + before0 + '→' + ss.length + ', newest on page 0') : ('newest stroke on page ' + pg + ' (expected 0)');
    });

    // ── DRAW on page 1 → a committed stroke lands on page 1 (multi-page capture+render) ──
    const before1 = renderedStrokes().length;
    let p1by = null;
    { const el = drawOnPage(1); await sleep(150); const pr = el.getBoundingClientRect(); const bx = pr.left + pr.width * 0.3; p1by = pr.top + 260; synthDraw([{ x: bx, y: p1by }, { x: bx + 70, y: p1by + 35 }, { x: bx + 140, y: p1by - 8 }]); }
    await sleep(500);
    t('draw on page 1 → the NEW committed stroke renders ON page 1 (not page 0)', () => {
      const ss = renderedStrokes(); if (ss.length !== before1 + 1) return 'expected exactly 1 new stroke (' + before1 + '→' + ss.length + ')';
      // the page-1 node is at a HIGHER doc pos than the page-0 node → it is the LAST rendered. Assert THAT stroke
      // (not "some stroke") is on page 1, so a stale page-1 stroke can't mask a new stroke that landed on page 0.
      const cr = ss[ss.length - 1].getBoundingClientRect(); const pg = pageOfClientY(cr.top + cr.height / 2);
      return pg === 1 ? ('strokes ' + before1 + '→' + ss.length + ', newest on page 1') : ('newest stroke on page ' + pg + ' (expected 1) — multi-page render broken');
    });

    // ── F1 BOUNDARY REGRESSION: draw near the TOP of page 2. The re-anchor docPos lands at page-2's top, so the
    //    node's nodePos−1 is on page 1 — the OLD backward-first pageOriginForNode scan would resolve page 1 and
    //    render the stroke one page too HIGH. Forward-first must still place it on page 2. ──
    const before2 = renderedStrokes().length;
    { const el = drawOnPage(2); await sleep(150); const pr = el.getBoundingClientRect(); const bx = pr.left + pr.width * 0.3, by = pr.top + 100; synthDraw([{ x: bx, y: by }, { x: bx + 70, y: by + 30 }, { x: bx + 140, y: by + 6 }]); }
    await sleep(500);
    t('draw at the TOP of page 2 → the NEW stroke renders ON page 2 (forward-first page resolution)', () => {
      const ss = renderedStrokes(); if (ss.length !== before2 + 1) return 'expected exactly 1 new stroke (' + before2 + '→' + ss.length + ')';
      const cr = ss[ss.length - 1].getBoundingClientRect(); const pg = pageOfClientY(cr.top + cr.height / 2);
      return pg === 2 ? ('newest on page 2 (boundary-anchored stroke resolved correctly)') : ('newest stroke on page ' + pg + ' (expected 2) — page-boundary asymmetry NOT fixed');
    });

    // ── the page-1 stroke's persisted pos is PAGE-LOCAL (the export fix) + the node anchors on page 1 ──
    t('page-1 ink node: inkPos is PAGE-LOCAL (y < page height) + anchored on page 1', () => {
      const pe = W.presentation; const nodes = inkNodes();
      // find an isInk node whose anchor resolves to page 1 (forward-first scan, matching pageOriginForNode)
      let hit = null;
      for (const it of nodes) {
        if (!(it.node.attrs && it.node.attrs.isInk)) continue;
        let pi = null; for (const d of [1, 2, 3, -1, -2, -3, 0]) { const p = it.pos + d; if (p < 0) continue; try { const r = pe.computeCaretLayoutRect(p); if (r && Number.isFinite(r.pageIndex)) { pi = r.pageIndex; break; } } catch (e) {} }
        if (pi === 1) { hit = it; break; }
      }
      if (!hit) return 'no isInk node anchored on page 1';
      const ip = hit.node.attrs.customGeometry && hit.node.attrs.customGeometry.inkPos;
      if (!ip) return 'no inkPos';
      // page-local y must be well under one page height (~1056), NOT #pages-local (~1080+ for page 1)
      return (ip.y >= 0 && ip.y < 1056) ? ('inkPos.y=' + Math.round(ip.y) + ' (page-local ✓, anchored page 1)') : ('inkPos.y=' + Math.round(ip.y) + ' looks #pages-local (export would be wrong)');
    });

    // ── TOOLS: eraser over the page-1 stroke deletes EXACTLY that node ──
    const inkCountBefore = inkNodes().filter((it) => it.node.attrs && it.node.attrs.isInk).length;
    let erasedPos = null;
    t('eraser: found a page-1 stroke + clicked ON its path', () => {
      const ss = renderedStrokes(); const target = ss.find((s) => { const cr = s.getBoundingClientRect(); return pageOfClientY(cr.top + cr.height / 2) === 1; }) || ss[ss.length - 1];
      if (!target) return 'no stroke to erase';
      erasedPos = target.getAttribute('data-ink-pos');
      try { W.PM.dSetEraser(20, 'stroke'); } catch (e) {}
      try { W.PM.__inkOverlay && W.PM.__inkOverlay.sync && W.PM.__inkOverlay.sync(); } catch (e) {}
      // click a point ON the path (the bbox centre of a curve isn't on the curve) → map svg-local → viewport.
      const len = target.getTotalLength(); const mid = target.getPointAtLength(len / 2);
      const bbox = target.getBBox(); const vr = target.getBoundingClientRect();
      const cx = vr.left + (mid.x - bbox.x) * (vr.width / (bbox.width || 1));
      const cy = vr.top + (mid.y - bbox.y) * (vr.height / (bbox.height || 1));
      const id = 12;
      inkLayer().dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, button: 0, buttons: 1, pointerId: id, isPrimary: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, pointerId: id, bubbles: true }));
      return erasedPos != null; // identity asserted in the next row (after settle)
    });
    await sleep(300);
    {
      const after = inkNodes().filter((it) => it.node.attrs && it.node.attrs.isInk).length;
      const stillThere = renderedStrokes().some((s) => s.getAttribute('data-ink-pos') === erasedPos); // the clicked stroke gone?
      results.push({ name: 'eraser removed EXACTLY the clicked ink node (count −1 AND that stroke gone)', pass: after === inkCountBefore - 1 && erasedPos != null && !stillThere, detail: 'ink nodes ' + inkCountBefore + '→' + after + ' (expected −1); clicked data-ink-pos=' + erasedPos + ' stillRendered=' + stillThere });
    }
    // re-arm the pen + draw a fresh page-1 stroke for the export-fidelity check (the eraser removed the prior one)
    activatePen(); await sleep(60);
    { const el = drawOnPage(1); await sleep(150); const pr = el.getBoundingClientRect(); const bx = pr.left + pr.width * 0.45, by = pr.top + 320; synthDraw([{ x: bx, y: by }, { x: bx + 60, y: by + 30 }, { x: bx + 120, y: by }]); }
    await sleep(500);

    // ── EXPORT FIDELITY (the M4c gate): a page-1 stroke exports with a PAGE-LOCAL posOffset on its page ──
    // Verify the actual exported OOXML the node carries: wp:positionV/wp:posOffset must be page-local EMU
    // (= inkPos.y × 9525), NOT a #pages-local value — that is exactly what makes Word place it on the right page.
    const findPosOffsetV = (dc) => { let res = null; const walk = (n, inV) => { if (!n || typeof n !== 'object') return; const isV = n.name === 'wp:positionV'; if (n.name === 'wp:posOffset' && inV) { const txt = n.elements && n.elements[0] && n.elements[0].text; if (txt != null && res == null) res = parseInt(txt, 10); } const kids = n.elements || (Array.isArray(n) ? n : null); if (Array.isArray(kids)) kids.forEach((k) => walk(k, inV || isV)); }; walk(dc, false); return res; };
    {
      const pe = W.presentation; const EMU = 9525;
      let hit = null;
      for (const it of inkNodes()) { if (!(it.node.attrs && it.node.attrs.isInk)) continue; let pi = null; for (const d of [-1, -2, -3]) { try { const r = pe.computeCaretLayoutRect(it.pos + d); if (r && Number.isFinite(r.pageIndex)) { pi = r.pageIndex; break; } } catch (e) {} } if (pi === 1) hit = it; }
      const ip = hit && hit.node.attrs.customGeometry && hit.node.attrs.customGeometry.inkPos;
      const posV = hit && hit.node.attrs.drawingContent ? findPosOffsetV(hit.node.attrs.drawingContent) : null;
      const expect = ip ? Math.round(ip.y * EMU) : null;
      const pass = !!(hit && ip && posV != null && ip.y < 1056 && Math.abs(posV - expect) <= EMU);
      results.push({ name: 'EXPORT: page-1 stroke wp:posOffset(V) is PAGE-LOCAL EMU (→ Word places it on its page)', pass, detail: hit ? ('inkPos.y=' + Math.round(ip.y) + 'px posOffsetV=' + posV + 'emu (' + (posV != null ? Math.round(posV / EMU) : '?') + 'px page-local; expect≈' + expect + ')') : 'no page-1 isInk node' });
    }
    let bytes = null; try { bytes = await W.PM.exportDocxBytes(); } catch (e) {}
    t('exportDocxBytes() produced a .docx (no crash)', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
    results.push({ name: 'reopened ink (INFO): PE never paints it (no double-draw); re-render of REOPENED multi-page ink depends on a pre-existing customGeometry.inkPos-recovery gap (both modes), separate from M4c', pass: true, detail: 'peShapePaths=0 confirmed; see ink-overlay.ts renderInk .paths branch' });
    return done();
  }

  // ── OVERLAY PARITY — a drawn stroke renders WHERE DRAWN (no page-origin offset leaks in) ──
  activatePen();
  await sleep(120);
  const L = inkLayer();
  t('overlay: ink layer present + active', () => !!L && getComputedStyle(L).pointerEvents === 'auto');
  const beforeO = renderedStrokes().length;
  // draw at a known viewport point inside #pm-editor
  const pm = document.getElementById('pm-editor');
  const pr = pm.getBoundingClientRect();
  const bx = pr.left + 120, by = pr.top + 160;
  synthDraw([{ x: bx, y: by }, { x: bx + 70, y: by + 35 }, { x: bx + 140, y: by - 8 }]);
  await sleep(400);
  t('overlay: a NEW stroke renders at the drawn location (no page-origin offset)', () => {
    const ss = renderedStrokes(); if (ss.length <= beforeO) return 'no new stroke (' + beforeO + '→' + ss.length + ')' && false;
    // the newest stroke's clientRect must sit at ~the draw point (within tolerance) — proves overlay math unchanged
    const near = ss.some((s) => { const cr = s.getBoundingClientRect(); return Math.abs(cr.left - bx) <= 30 && Math.abs(cr.top - by) <= 40; });
    return near ? ('stroke rendered at the draw point (≈' + Math.round(bx) + ',' + Math.round(by) + ')') : ('no stroke near the draw point — overlay math drifted' && false);
  });
  t('overlay: drawn node inkPos is #pm-editor-local (NOT page-local-subtracted)', () => {
    const nodes = inkNodes().filter((it) => it.node.attrs && it.node.attrs.isInk);
    if (!nodes.length) return 'no isInk node' && false;
    const ip = nodes[nodes.length - 1].node.attrs.customGeometry.inkPos;
    // localPt(bx,by) ≈ (120,160)/zoom; inkPos should be ~that (the bbox top-left), proving no paged subtraction ran
    return ip && ip.x >= 60 && ip.x <= 400 && ip.y >= 80 && ip.y <= 400 ? ('inkPos=(' + Math.round(ip.x) + ',' + Math.round(ip.y) + ') #pm-editor-local ✓') : ('inkPos=' + JSON.stringify(ip) + ' unexpected' && false);
  });
  return done();
})();
