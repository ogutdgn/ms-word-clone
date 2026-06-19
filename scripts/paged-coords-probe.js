/* Milestone-1 coordinate-adapter probe (mode-aware). Run via:
     # paged round-trip:
     WC_LAYOUT=paged npm run build && \
     electron . --probe-out=/tmp/wc-coords-paged.json --shot-evalfile=scripts/paged-coords-probe.js
     # overlay parity:
     npm run build && \
     electron . --probe-out=/tmp/wc-coords-overlay.json --shot-evalfile=scripts/paged-coords-probe.js

   Verifies the shared WC.PM.coords adapter (src/renderer/layout/coordinate-adapter.ts):
     • paged  → client→pos→client round-trips on a painted page; getPageCount === getPages().length.
     • overlay→ the adapter delegates IDENTICALLY to the direct view.* calls (parity).
   Returns JSON {summary, results[]} — same contract as scripts/paged-spike-probe.js. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' }); } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); } };

  // PE first paint is awaited before __WC_READY; poll generously past the 15s PE timeout.
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);

  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const coords = W.PM && W.PM.coords;
  const TOL = 3;          // chars of slack for glyph-edge → caret rounding
  const PX = 4;           // px slack for same-line / round-trip rect closeness

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 300) && false));
  t('layout mode (info)', () => 'mode=' + mode);

  // ── adapter surface ──
  t('WC.PM.coords present with 4 core methods', () =>
    !!coords &&
    typeof coords.clientToPos === 'function' &&
    typeof coords.posToClientRect === 'function' &&
    typeof coords.getPageCount === 'function' &&
    typeof coords.getPages === 'function');

  // The bridge binds to the inner Editor's view in BOTH modes (main.ts sets WC.view =
  // editor.view). A missing W.view must FAIL loudly, not silently skip the substantive checks.
  t('inner PM view present (W.view)', () => !!W.view);
  if (!coords || !W.view) {
    const pass0 = results.filter((r) => r.pass).length;
    return JSON.stringify({ summary: { total: results.length, pass: pass0, fail: results.length - pass0, mode }, results }, null, 2);
  }

  // A stable caret position: just inside the first text run.
  let P = null;
  try { W.view.state.doc.descendants((n, p) => { if (P === null && n.isText) P = p + 1; }); } catch (e) {}
  if (P === null) P = 1;

  // Base rect for the chosen pos (viewport space, zoom-corrected by the engine in both modes).
  let rect = null;
  t('posToClientRect(P) returns a finite rect', () => {
    rect = coords.posToClientRect(P);
    if (!rect) return 'null rect' && false;
    const ok = ['top', 'bottom', 'left', 'right', 'width', 'height'].every((k) => Number.isFinite(rect[k]));
    return ok ? ('P=' + P + ' @ ' + Math.round(rect.left) + ',' + Math.round(rect.top) + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height)) : ('non-finite rect ' + JSON.stringify(rect) && false);
  });

  // A client point solidly INSIDE the glyph at P — at least 1px right of the left edge
  // (a zero-width caret rect would otherwise sample the exact edge, an ambiguous hit-test point).
  const cx = rect ? rect.left + Math.max(1, Math.min(2, rect.width / 2)) : 0;
  const cy = rect ? rect.top + rect.height / 2 : 0;

  if (mode === 'paged') {
    // ── page enumeration ──
    t('getPageCount === presentation.getPages().length (>0)', () => {
      const n = coords.getPageCount();
      const real = (W.presentation && typeof W.presentation.getPages === 'function') ? W.presentation.getPages().length : -1;
      return (n > 0 && n === real) ? ('count=' + n) : ('getPageCount=' + n + ' presentation.getPages=' + real && false);
    });
    t('getPages() length === getPageCount()', () => {
      const a = coords.getPages().length, b = coords.getPageCount();
      return a === b ? ('pages=' + a) : ('getPages=' + a + ' getPageCount=' + b && false);
    });

    // ── client → pos → client ROUND-TRIP on the painted page ──
    let hit = null;
    t('clientToPos(center of P) lands within tolerance of P', () => {
      hit = coords.clientToPos(cx, cy);
      if (!hit || !Number.isFinite(hit.pos)) return 'null/!finite hit' && false;
      return Math.abs(hit.pos - P) <= TOL ? ('pos=' + hit.pos + ' (P=' + P + ')') : ('pos=' + hit.pos + ' far from P=' + P && false);
    });
    t('round-trip closes: posToClientRect(hit) ≈ original rect', () => {
      if (!hit) return 'no hit' && false;
      const r2 = coords.posToClientRect(hit.pos);
      if (!r2) return 'null r2' && false;
      const dTop = Math.abs(r2.top - rect.top), dLeft = Math.abs(r2.left - rect.left);
      // TIGHT bounds: same line (dTop ≤ PX, well under a line box) and within ~1-2 chars
      // (dLeft ≤ 4·PX). The engine round-trips a caret exactly (observed Δ=0/0); a loose
      // band (≥ one line height) would mask an off-by-line / off-by-page hit-test bug.
      return (dTop <= PX && dLeft <= 4 * PX)
        ? ('Δtop=' + Math.round(dTop) + ' Δleft=' + Math.round(dLeft))
        : ('Δtop=' + Math.round(dTop) + ' Δleft=' + Math.round(dLeft) + ' too far' && false);
    });
  } else {
    // ── OVERLAY PARITY: the adapter must equal the direct view.* calls it replaces ──
    t('posToClientRect parity with view.coordsAtPos(P)', () => {
      const direct = W.view.coordsAtPos(P);
      const a = coords.posToClientRect(P);
      if (!direct || !a) return 'null (direct=' + !!direct + ' adapter=' + !!a + ')' && false;
      const same = ['top', 'bottom', 'left', 'right'].every((k) => Math.abs(direct[k] - a[k]) < 0.01);
      return same ? 'identical L/T/R/B' : ('mismatch direct=' + JSON.stringify(direct) + ' adapter=' + JSON.stringify(a) && false);
    });
    t('clientToPos parity with view.posAtCoords({left,top})', () => {
      const direct = W.view.posAtCoords({ left: cx, top: cy });
      const a = coords.clientToPos(cx, cy);
      const dp = direct ? direct.pos : null, ap = a ? a.pos : null;
      return dp === ap ? ('pos=' + ap) : ('direct=' + dp + ' adapter=' + ap && false);
    });
    t('getPageCount === overlay __pagination pageCount', () => {
      // Require the real paginator to be initialized — do NOT fall back to 1, which would
      // make this a vacuous "1 === 1" comparison of two independent fallbacks.
      const pg = W.PM && W.PM.__pagination;
      if (!pg || typeof pg.pageCount !== 'number') return 'overlay paginator not initialized (no __pagination.pageCount)' && false;
      const n = coords.getPageCount();
      return n === pg.pageCount ? ('count=' + n) : ('getPageCount=' + n + ' __pagination=' + pg.pageCount && false);
    });
  }

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, mode }, results }, null, 2);
})()
