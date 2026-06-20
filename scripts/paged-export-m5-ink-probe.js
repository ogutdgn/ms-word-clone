/* Milestone-5 multi-page INK export probe (paged-only). Reuses paged-ink-probe.js's proven synthetic-draw mechanism
   to draw strokes on (a) page index 1 (real "page 2"), (b) the TOP of page index 2 (boundary / TextSelection.near
   snapping), and (c) a best-effort inter-page-GAP-spanning stroke, then asserts each committed stroke's EXPORTED
   wp:positionV/posOffset is PAGE-LOCAL EMU on its own page, and SAVES C:/tmp/wc-paged-m5-ink.docx for the driver's
   real-Word validate-open. Ink intentionally differs from overlay (re-anchored insertPos + page-local posOffset) →
   this is a Word-valid/page-correct check, NOT a paged-vs-overlay diff. {summary, results[]} contract. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const done = (extra) => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: Object.assign({ total: results.length, pass: p, fail: results.length - p, mode }, extra || {}), results }, null, 2); };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const EMU = 9525;
  const view = () => W.view;
  const inkLayer = () => document.querySelector('svg.wc-ink-layer');
  const pageEl = (idx) => document.querySelector('.superdoc-page[data-page-index="' + idx + '"]');
  const pageOfClientY = (cy) => { for (const p of document.querySelectorAll('.superdoc-page')) { const pr = p.getBoundingClientRect(); if (cy >= pr.top - 2 && cy <= pr.bottom + 2) return parseInt(p.getAttribute('data-page-index'), 10); } return null; };
  const inkNodes = () => { const a = []; try { view().state.doc.descendants((n, p) => { const cg = n.attrs && n.attrs.customGeometry; if (n.type && n.type.name === 'vectorShape' && ((n.attrs && n.attrs.isInk) || (cg && (cg.inkPoints || cg.paths)))) a.push({ pos: p, node: n }); }); } catch (e) {} return a; };
  const renderedStrokes = () => { const L = inkLayer(); return L ? Array.from(L.querySelectorAll('.pm-ink-stroke')) : []; };
  const activatePen = () => { try { W.PM.dSetPen({ color: '#0033cc', width: 3 }); } catch (e) {} try { W.PM.dSetDrawing(true); } catch (e) {} try { W.PM.__inkOverlay && W.PM.__inkOverlay.sync && W.PM.__inkOverlay.sync(); } catch (e) {} };
  const synthDraw = (pts) => { const L = inkLayer(); if (!L) return; const id = 11; L.dispatchEvent(new PointerEvent('pointerdown', { clientX: pts[0].x, clientY: pts[0].y, button: 0, buttons: 1, pointerId: id, isPrimary: true, bubbles: true, cancelable: true })); for (let i = 1; i < pts.length; i++) window.dispatchEvent(new PointerEvent('pointermove', { clientX: pts[i].x, clientY: pts[i].y, buttons: 1, pointerId: id, bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { clientX: pts[pts.length - 1].x, clientY: pts[pts.length - 1].y, pointerId: id, bubbles: true })); };
  const drawOnPage = (idx) => { const el = pageEl(idx); if (!el) return null; try { el.scrollIntoView({ block: 'center' }); } catch (e) {} return el; };
  const findPosOffsetV = (dc) => { let res = null; const walk = (n, inV) => { if (!n || typeof n !== 'object') return; const isV = n.name === 'wp:positionV'; if (n.name === 'wp:posOffset' && inV) { const txt = n.elements && n.elements[0] && n.elements[0].text; if (txt != null && res == null) res = parseInt(txt, 10); } const kids = n.elements || (Array.isArray(n) ? n : null); if (Array.isArray(kids)) kids.forEach((k) => walk(k, inV || isV)); }; walk(dc, false); return res; };
  // page index an ink node anchors to, via the same forward-first scan as ink-overlay.ts pageOriginForNode
  const pageOfNode = (it) => { const pe = W.presentation; for (const d of [1, 2, 3, -1, -2, -3, 0]) { const p = it.pos + d; if (p < 0) continue; try { const r = pe.computeCaretLayoutRect(p); if (r && Number.isFinite(r.pageIndex)) return r.pageIndex; } catch (e) {} } return null; };
  // assert: the LAST isInk node anchored on `pageIndex` carries a PAGE-LOCAL inkPos + page-local exported posOffset(V)
  const assertPageLocalExport = (label, pageIndex) => t(label, () => {
    let hit = null; for (const it of inkNodes()) { if (!(it.node.attrs && it.node.attrs.isInk)) continue; if (pageOfNode(it) === pageIndex) hit = it; }
    if (!hit) return ('no isInk node anchored on page ' + pageIndex) && false;
    const ip = hit.node.attrs.customGeometry && hit.node.attrs.customGeometry.inkPos;
    if (!ip) return 'no inkPos' && false;
    const posV = hit.node.attrs.drawingContent ? findPosOffsetV(hit.node.attrs.drawingContent) : null;
    const expect = Math.round(ip.y * EMU);
    const pageLocal = ip.y >= 0 && ip.y < 1056;
    const exportOk = posV != null && Math.abs(posV - expect) <= EMU;
    return pageLocal && exportOk ? ('page ' + pageIndex + ': inkPos.y=' + Math.round(ip.y) + 'px posOffsetV=' + posV + 'emu (≈' + Math.round(posV / EMU) + 'px page-local ✓)') : ('page ' + pageIndex + ': inkPos.y=' + Math.round(ip.y) + ' posOffsetV=' + posV + ' expect≈' + expect + ' pageLocal=' + pageLocal + ' exportOk=' + exportOk) && false;
  });

  t('layout mode is paged', () => mode === 'paged' ? 'paged' : ('mode=' + mode + ' — ink probe is paged-only') && false);
  const ok = t('coords + ink bridge present', () => !!(W.PM && W.PM.coords && typeof W.PM.coords.clientToOverlayLocalPt === 'function' && W.PM.__inkOverlay && typeof W.PM.dInsertInk === 'function' && W.view));
  if (!ok || mode !== 'paged') return done();

  // ── force a multi-page doc ──
  try { view().dispatch(view().state.tr.insertText('Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(500), 1)); } catch (e) {}
  let np = -1; for (let i = 0; i < 240; i++) { np = (W.presentation && W.presentation.getPages) ? W.presentation.getPages().length : -1; if (np > 2) break; await sleep(50); }
  t('forced a multi-page doc (getPages > 2)', () => np > 2 ? ('pages=' + np) : ('pages=' + np + ' — cannot exercise multi-page ink') && false);
  await sleep(200); activatePen(); await sleep(100);

  // (a) page index 1 (real "page 2")
  { const el = drawOnPage(1); await sleep(150); const pr = el.getBoundingClientRect(); const bx = pr.left + pr.width * 0.3, by = pr.top + 260; synthDraw([{ x: bx, y: by }, { x: bx + 70, y: by + 35 }, { x: bx + 140, y: by - 8 }]); }
  await sleep(500);
  t('(a) stroke drawn on page index 1 renders on page 1', () => { const ss = renderedStrokes(); const cr = ss[ss.length - 1].getBoundingClientRect(); const pg = pageOfClientY(cr.top + cr.height / 2); return pg === 1 ? 'on page 1' : ('on page ' + pg + ' (expected 1)') && false; });
  assertPageLocalExport('(a) page-1 stroke exports PAGE-LOCAL posOffset(V)', 1);

  // (b) TOP of page index 2 (boundary / TextSelection.near snapping)
  activatePen(); await sleep(60);
  { const el = drawOnPage(2); await sleep(150); const pr = el.getBoundingClientRect(); const bx = pr.left + pr.width * 0.3, by = pr.top + 90; synthDraw([{ x: bx, y: by }, { x: bx + 70, y: by + 30 }, { x: bx + 140, y: by + 6 }]); }
  await sleep(500);
  t('(b) stroke drawn at TOP of page index 2 renders on page 2 (forward-first resolution)', () => { const ss = renderedStrokes(); const cr = ss[ss.length - 1].getBoundingClientRect(); const pg = pageOfClientY(cr.top + cr.height / 2); return pg === 2 ? 'on page 2' : ('on page ' + pg + ' (expected 2)') && false; });
  assertPageLocalExport('(b) page-2 top stroke exports PAGE-LOCAL posOffset(V)', 2);

  // (c) inter-page-GAP-spanning stroke (start near page-1 bottom, drag through the gap onto page-2 top) — best-effort
  activatePen(); await sleep(60);
  { const e1 = pageEl(1), e2 = pageEl(2); if (e1 && e2) { try { e1.scrollIntoView({ block: 'center' }); } catch (e) {} await sleep(120); const r1 = e1.getBoundingClientRect(), r2 = e2.getBoundingClientRect(); const bx = r1.left + r1.width * 0.5; synthDraw([{ x: bx, y: r1.bottom - 40 }, { x: bx + 20, y: r1.bottom - 5 }, { x: bx + 40, y: r2.top + 5 }, { x: bx + 60, y: r2.top + 40 }]); } }
  await sleep(500);
  results.push({ name: '(c) gap-spanning stroke committed (INFO — clamps to one page; not page-asserted)', pass: true, detail: 'strokes=' + renderedStrokes().length });

  // ── export → save the .docx for the driver's real-Word validate-open ──
  let bytes = null; try { bytes = await W.PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed') && false);
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-paged-m5-ink.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  t('saveBytes wrote wc-paged-m5-ink.docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved)) && false);
  return done({ savedPath: saved && saved.path, pages: np });
})();
