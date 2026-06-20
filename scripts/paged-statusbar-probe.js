/* Milestone-3 status-bar page-indicator probe (mode-aware). Run via:
     # paged (the headline check):
     WC_LAYOUT=paged npm run build && \
     electron . --probe-out=/tmp/wc-statusbar.json --shot-evalfile=scripts/paged-statusbar-probe.js
     # overlay parity:
     npm run build && \
     electron . --probe-out=/tmp/wc-statusbar-ovl.json --shot-evalfile=scripts/paged-statusbar-probe.js

   Verifies "Page X of Y" via the WC.PM.coords seam:
     • paged  → getPageCount()===presentation.getPages().length; getCurrentPage() tracks the caret across
                pages (PE.computeCaretLayoutRect); the rendered status-bar text matches; the onLayoutUpdated
                hook is wired for no-transaction refreshes.
     • overlay→ getCurrentPage()/getPageCount() equal the legacy __pagination break-scan/count, and the
                rendered text is byte-identical to the pre-M3 output.
   Same {summary, results[]} JSON contract as scripts/paged-coords-probe.js. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const info = (name, detail) => results.push({ name, pass: true, detail: 'INFO: ' + detail });

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const view = () => W.view;
  const coords = W.PM && W.PM.coords;
  const TS = window.__PM_TextSelection;
  const docSize = () => view().state.doc.content.size;
  const collapseTo = (P) => { try { view().dispatch(view().state.tr.setSelection(TS.create(view().state.doc, P))); } catch (e) {} };

  // Read the rendered "Page X of Y" from the live status bar (after a refresh).
  const readBar = () => {
    try { W.StatusBar.update(); } catch (e) {}
    const txt = (W.StatusBar && W.StatusBar.pageEl && W.StatusBar.pageEl.textContent) || '';
    const m = txt.match(/Page\s+(\d+)\s+of\s+(\d+)/);
    return { txt, X: m ? +m[1] : null, Y: m ? +m[2] : null };
  };

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 200) && false));
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('WC.PM.coords (getPageCount+getCurrentPage) + StatusBar present', () =>
    !!(coords && typeof coords.getPageCount === 'function' && typeof coords.getCurrentPage === 'function' && W.StatusBar && W.view));
  if (!ok) { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); }

  if (mode === 'paged') {
    // force multi-page
    try { view().dispatch(view().state.tr.insertText('Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(500), 1)); } catch (e) {}
    let pages = -1;
    for (let i = 0; i < 240; i++) { pages = (W.presentation && W.presentation.getPages) ? W.presentation.getPages().length : -1; if (pages > 1) break; await sleep(50); }
    t('forced multi-page doc (getPages > 1)', () => pages > 1 ? ('pages=' + pages) : ('pages=' + pages && false));
    await sleep(150);

    // total Y
    t('getPageCount() === presentation.getPages().length (>1)', () => {
      const a = coords.getPageCount(), b = W.presentation.getPages().length;
      return a === b && a > 1 ? ('count=' + a) : ('getPageCount=' + a + ' getPages=' + b && false);
    });

    // caret on page 0 → X = 1; rendered "Page 1 of Y"
    collapseTo(1); await sleep(20);
    t('caret on page 0 → getCurrentPage()===1 AND rendered X===1, Y===getPageCount', () => {
      const cur = coords.getCurrentPage(), bar = readBar();
      return cur === 1 && bar.X === 1 && bar.Y === coords.getPageCount() ? ('"' + bar.txt + '"') : ('cur=' + cur + ' bar=' + JSON.stringify(bar) + ' Y!=' + coords.getPageCount() && false);
    });

    // caret on a LATER page → X = computeCaretLayoutRect(pos).pageIndex+1 (>1); rendered X matches
    let laterP = null, expectX = null;
    const pe = W.presentation;
    for (let P = 3; P < docSize(); P += 29) {
      try { const r = pe.computeCaretLayoutRect(P); if (r && Number.isFinite(r.pageIndex) && r.pageIndex >= 1) { laterP = P; expectX = r.pageIndex + 1; break; } } catch (e) {}
    }
    t('found a caret pos on a later page (pageIndex>=1)', () => laterP != null ? ('P=' + laterP + ' expectX=' + expectX) : ('no later-page pos via computeCaretLayoutRect' && false));
    if (laterP != null) {
      collapseTo(laterP); await sleep(30);
      t('caret on later page → getCurrentPage()===pageIndex+1 (>1) AND rendered X matches', () => {
        const cur = coords.getCurrentPage(), bar = readBar();
        return cur === expectX && cur > 1 && bar.X === cur ? ('X=' + cur + ' "' + bar.txt + '"') : ('cur=' + cur + ' expect=' + expectX + ' barX=' + bar.X && false);
      });
    }

    // onLayoutUpdated trigger wired? (a) the hook exists; (b) best-effort: a no-transaction relayout fires update.
    t('presentation.onLayoutUpdated hook exists (the trigger we subscribe)', () => typeof W.presentation.onLayoutUpdated === 'function');
    {
      const orig = W.StatusBar.update; let calls = 0;
      try {
        W.StatusBar.update = function () { calls++; return orig.apply(this, arguments); };
        const before = calls;
        // try a no-transaction relayout path (PE-level zoom/rerender if present, else the WC zoom)
        try {
          if (typeof W.presentation.setZoom === 'function') W.presentation.setZoom(((W.PM.zoom || 1) === 1) ? 1.25 : 1);
          else if (typeof W.presentation.rerender === 'function') W.presentation.rerender();
          else W.PM.setZoom(((W.PM.zoom || 1) === 1) ? 1.25 : 1);
        } catch (e) {}
        await sleep(500);
        const fired = calls > before;
        results.push({ name: 'onLayoutUpdated → StatusBar.update FIRES on a no-transaction relayout', pass: fired, detail: fired ? ('fired ' + (calls - before) + 'x') : 'did NOT fire — the no-transaction relayout left the status bar stale (trigger not wired?)' });
      } finally { W.StatusBar.update = orig; }
    }
  } else {
    // OVERLAY PARITY — force overlay multi-page, move the caret, compare to the legacy break-scan.
    try { view().dispatch(view().state.tr.insertText('Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(500), 1)); } catch (e) {}
    await sleep(400); // let the overlay paginator measure
    // HARD multi-page requirement: a single-page overlay doc makes the whole parity check trivial
    // ("Page 1 of 1"), so fail loudly if the overlay paginator didn't produce a page transition.
    const tot0 = (W.PM.__pagination && W.PM.__pagination.pageCount) || 1;
    t('overlay: paginator produced a MULTI-PAGE doc (so parity is non-trivial)', () => tot0 > 1 ? ('pageCount=' + tot0) : ('pageCount=' + tot0 + ' — overlay did NOT paginate; cannot exercise page transitions' && false));
    const legacy = () => {
      const pg = W.PM.__pagination || { pageCount: (W.PM.counts().pages || 1), breaks: [] };
      const caret = view().state.selection.from;
      const cur = (pg.breaks || []).filter((b) => b.pos <= caret).reduce((a, b) => a + (b.pages || 1), 0) + 1;
      return { total: pg.pageCount || 1, cur };
    };
    // caret@start
    collapseTo(1); await sleep(20);
    const startCur = coords.getCurrentPage();
    t('overlay: getCurrentPage()/getPageCount() === legacy break-scan/count (caret@start)', () => {
      const L = legacy();
      return coords.getCurrentPage() === L.cur && coords.getPageCount() === L.total ? ('cur=' + L.cur + ' total=' + L.total) : ('coords=(' + coords.getCurrentPage() + ',' + coords.getPageCount() + ') legacy=(' + L.cur + ',' + L.total + ')' && false);
    });
    t('overlay: rendered text === legacy "Page X of Y" (byte-identical)', () => {
      const L = legacy(); const bar = readBar();
      const expect = 'Page ' + Math.min(L.cur, L.total) + ' of ' + L.total;
      return bar.txt === expect ? ('"' + bar.txt + '"') : ('rendered="' + bar.txt + '" expect="' + expect + '"' && false);
    });
    // caret@end
    collapseTo(Math.max(1, docSize() - 2)); await sleep(20);
    const endCur = coords.getCurrentPage();
    t('overlay: getCurrentPage() === legacy break-scan (caret@end)', () => {
      const L = legacy();
      return coords.getCurrentPage() === L.cur ? ('cur=' + L.cur + '/' + L.total) : ('coords=' + coords.getCurrentPage() + ' legacy=' + L.cur && false);
    });
    // ABSOLUTE (not just parity): the current page MUST advance as the caret moves end-ward in a
    // multi-page doc — proves getCurrentPage tracks position, not merely that it equals legacy().
    t('overlay: current page ADVANCES as the caret moves to the end (absolute, not tautological)', () => endCur > startCur ? ('page ' + startCur + ' -> ' + endCur) : ('start=' + startCur + ' end=' + endCur + ' — did not advance' && false));
  }

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, mode }, results }, null, 2);
})()
