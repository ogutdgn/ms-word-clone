/* PM new-core smoke test. Run via:
   npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js
   Returns JSON {summary, results[]} (same contract as scripts/test-suite.js). */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' }); } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + (e && e.message || e) }); } };

  for (let i = 0; i < 100 && !window.__WC_READY; i++) await sleep(50); // sentinel gate

  t('view mounted (sentinel)', () => window.__WC_READY === true);
  t('legacy world intact', () => !!window.WC && !!window.WC.Editor);
  t('new view present', () => !!window.WC.view && typeof window.WC.view.dispatch === 'function');
  t('view is editable', () => window.WC.view.dom.isContentEditable === true);
  t('imported doc rendered', () => window.WC.view.state.doc.content.size > 4);
  t('Word-native list attrs present', () => /data-list-level|data-marker-type|data-list-numbering-type/.test(window.WC.view.dom.innerHTML));
  t('typing mutates the doc', () => {
    const v = window.WC.view; const before = v.state.doc.content.size;
    v.dispatch(v.state.tr.insertText('X', 1));
    return v.state.doc.content.size === before + 1;
  });
  t('no telemetry / non-local network', () => (window.__NET_LOG || []).length === 0 || ('offenders: ' + window.__NET_LOG.join(', ') && false));

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
