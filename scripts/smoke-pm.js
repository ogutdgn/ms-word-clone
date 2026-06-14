/* PM new-core smoke test. Run via:
   npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js
   Returns JSON {summary, results[]} (same contract as scripts/test-suite.js). */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' }); } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + (e && e.message || e) }); } };

  for (let i = 0; i < 100 && !window.__WC_READY; i++) await sleep(50); // sentinel gate

  t('view mounted (sentinel)', () => window.__WC_READY === true);
  t('WC core present (single-world)', () => !!window.WC && !!window.WC.PM && !!window.WC.Commands);
  t('new view present', () => !!window.WC.view && typeof window.WC.view.dispatch === 'function');
  t('view is editable', () => window.WC.view.dom.isContentEditable === true);
  t('imported doc rendered', () => window.WC.view.state.doc.content.size > 4);
  t('Word-native list attrs present', () => /data-list-level|data-marker-type|data-list-numbering-type/.test(window.WC.view.dom.innerHTML));
  t('typing mutates the doc', () => {
    // Path B: the vendored Editor's plugin stack (numbering/derived attrs) may add more
    // than the single inserted char, so assert the doc GREW (mutated) rather than exactly +1.
    const v = window.WC.view; const before = v.state.doc.content.size;
    v.dispatch(v.state.tr.insertText('X', 1));
    return v.state.doc.content.size > before;
  });
  t('no telemetry / non-local network', () => (window.__NET_LOG || []).length === 0 || ('offenders: ' + window.__NET_LOG.join(', ') && false));
  t('Tab indents a list item (doc mutates)', () => {
    const v = window.WC.view; v.focus();
    let pos = null; v.state.doc.descendants((n, p) => { if (pos === null && n.type.name === 'paragraph' && /numbering|listLevel|numId|list/i.test(JSON.stringify(n.attrs))) pos = p + 1; });
    if (pos === null) return false; // no list paragraph found ⇒ FAIL (don't silently skip the Tab proof)
    v.dispatch(v.state.tr.setSelection(window.__PM_TextSelection.create(v.state.doc, pos)));
    const before = JSON.stringify(v.state.doc.toJSON());
    const ok = v.someProp('handleKeyDown', (f) => f(v, new KeyboardEvent('keydown', { key: 'Tab' })));
    return ok === true && JSON.stringify(v.state.doc.toJSON()) !== before;
  });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
