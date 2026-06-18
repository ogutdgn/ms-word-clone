/* Option-B PresentationEditor STANDUP probe. Run via:
     WC_LAYOUT=paged npm run build && \
     electron . --probe-out=/tmp/wc-paged.json --shot=/tmp/wc-paged.png --shot-evalfile=scripts/paged-spike-probe.js
   Returns JSON {summary, results[]} (same contract as smoke-pm.js). Proves the real per-page
   layout engine stands up: paints .superdoc-page DOM, maps the caret, and leaves the model
   page-free. The docSig result lets us diff the model across overlay vs paged boots. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' }); } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); } };

  // PE first paint is awaited before __WC_READY; poll generously (≈18s) past the 15s PE timeout.
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);

  const W = window.WC || {};
  const host = document.getElementById('pm-editor');

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('layout mode = paged', () => (window.__WC_LAYOUT_MODE === 'paged') || ('mode=' + window.__WC_LAYOUT_MODE + ' (toggle not active — bad build/seed)' && false));
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 300) && false));

  // ── REAL per-page DOM (the headline proof) ──
  const pages = host ? host.querySelectorAll('.superdoc-page') : [];
  t('real per-page DOM: .superdoc-page count > 0', () => (pages.length > 0) || ('count=0 — no painted pages' && false));
  t('page-0 element has non-zero geometry', () => {
    const p0 = host && host.querySelector('.superdoc-page[data-page-index="0"]');
    if (!p0) return 'no [data-page-index="0"]' && false;
    const r = p0.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? ('page0 ' + Math.round(r.width) + 'x' + Math.round(r.height) + 'px') : ('zero geometry' && false);
  });
  t('presentation.getPages() > 0', () => {
    const n = (W.presentation && typeof W.presentation.getPages === 'function') ? W.presentation.getPages().length : -1;
    return n > 0 ? ('pages=' + n) : ('getPages=' + n && false);
  });
  t('painted page count (info)', () => 'superdoc-page=' + pages.length); // >1 on a multi-page fixture

  // ── inner PM view (bridge binds here, not the PresentationEditor) ──
  t('inner PM view present + editable', () => !!W.view && typeof W.view.dispatch === 'function' && W.view.dom.isContentEditable === true);
  t('imported doc rendered (size>4)', () => !!W.view && W.view.state.doc.content.size > 4);

  // ── MODEL PURITY: pages must NOT be doc nodes (so .docx round-trip is preserved) ──
  let docJson = '';
  try { docJson = JSON.stringify(W.view.state.doc.toJSON()); } catch (e) { docJson = ''; }
  t('model is page-free (no "page" node type)', () => docJson && !/"type"\s*:\s*"page"/.test(docJson));
  t('doc signature (info — compare overlay vs paged)', () => {
    let h = 0; for (let i = 0; i < docJson.length; i++) h = (h * 31 + docJson.charCodeAt(i)) | 0;
    return 'len=' + docJson.length + ' hash=' + h;
  });

  // ── CARET MAPPING: set a selection on the inner view; assert it lands + an overlay rect paints ──
  let selFrom = -1;
  t('caret: programmatic selection lands at a text pos', () => {
    const v = W.view; if (!v || !window.__PM_TextSelection) return 'no view/TextSelection' && false;
    let textPos = null; v.state.doc.descendants((n, p) => { if (textPos === null && n.isText) textPos = p + 1; });
    if (textPos === null) textPos = 1;
    v.focus && v.focus();
    v.dispatch(v.state.tr.setSelection(window.__PM_TextSelection.create(v.state.doc, textPos)));
    selFrom = v.state.selection.from;
    return selFrom === textPos ? ('from=' + selFrom) : ('from=' + selFrom + ' expected ' + textPos && false);
  });
  await sleep(400); // let the selection overlay repaint
  t('caret: selection/caret overlay rect painted', () => {
    if (!host) return false;
    const ov = host.querySelectorAll('[class*="selection"],[class*="caret"]');
    let painted = false, found = ov.length;
    ov.forEach((el) => { const r = el.getBoundingClientRect(); if (r.width > 0 || r.height > 0) painted = true; el.querySelectorAll('*').forEach((c) => { const cr = c.getBoundingClientRect(); if (cr.width > 0 || cr.height > 0) painted = true; }); });
    return painted ? ('overlay nodes=' + found) : ('found ' + found + ' overlay nodes, none painted (caret routing gap?)' && false);
  });

  // ── typing still mutates the (inner) doc ──
  t('typing mutates the inner doc', () => {
    const v = W.view; if (!v) return false; const before = v.state.doc.content.size;
    v.dispatch(v.state.tr.insertText('Z', Math.max(1, selFrom > 0 ? selFrom : 1)));
    return v.state.doc.content.size > before;
  });

  // ── PAGINATION: overflow one page and prove PE splits into N REAL pages ──
  // (single-page paint alone can't distinguish "PE paginates" from "PE painted one sheet".)
  const pagesBefore = (W.presentation && W.presentation.getPages) ? W.presentation.getPages().length : -1;
  let finalPages = pagesBefore, multiOk = false;
  try {
    const v = W.view;
    const big = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod. '.repeat(500); // ~35k chars ≫ one page
    v.dispatch(v.state.tr.insertText(big, 1));
    for (let i = 0; i < 240; i++) { // up to ~12s for incremental relayout
      finalPages = (W.presentation && W.presentation.getPages) ? W.presentation.getPages().length : -1;
      if (finalPages > 1) { multiOk = true; break; }
      await sleep(50);
    }
  } catch (e) { finalPages = 'ERR ' + ((e && e.message) || e); }
  t('pagination: doc overflows to MULTIPLE real pages (getPages>1)', () => multiOk ? ('pages ' + pagesBefore + '->' + finalPages) : ('pages ' + pagesBefore + '->' + finalPages + ' — did NOT split' && false));
  t('pagination: multiple .superdoc-page elements painted', () => {
    const n = host ? host.querySelectorAll('.superdoc-page').length : 0;
    return n > 1 ? ('superdoc-page=' + n) : ('superdoc-page=' + n && false);
  });
  t('pagination: model still page-free after overflow', () => {
    let dj = ''; try { dj = JSON.stringify(W.view.state.doc.toJSON()); } catch (e) {}
    return dj && !/"type"\s*:\s*"page"/.test(dj);
  });

  // ── bridge install survival (a finding, not a standup blocker) ──
  t('bridge installed without throwing (info)', () => !window.__WC_BRIDGE_ERROR || ('bridge threw: ' + String(window.__WC_BRIDGE_ERROR).slice(0, 400) && false));

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, mode: window.__WC_LAYOUT_MODE }, results }, null, 2);
})()
