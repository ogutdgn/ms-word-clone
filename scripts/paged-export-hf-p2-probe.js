/* 002 P2 header/footer export probe (mode-aware). The driver (test-roundtrip-paged.js) runs it under
   WC_LAYOUT=paged. It authors ONE doc exercising the P2 structure options — Different First Page (sectPr
   w:titlePg) + Different Odd & Even (settings w:evenAndOddHeaders) — with DISTINCT primary/first/even header &
   footer markers, then exports → saves C:/tmp/wc-<mode>-hf-p2.docx for the real-Word validate-open + the
   validate-headerfooter-win.ps1 variant/flag read-back. Same {summary, results[]} contract as the M5 probes. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const summary = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode, savedPath: window.__hfP2Saved }, results }, null, 2); };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('P2 verbs + exportDocxBytes + wordAPI.saveBytes present', () => (['setDifferentFirstPage', 'setDifferentOddEven', 'setHeaderText', 'setFooterText', 'getHeaderFooterOptions', 'exportDocxBytes', 'newBlank'].every((k) => typeof PM[k] === 'function') && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) return summary();

  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);

  // ── author the P2 doc: flags first, then primary/first/even variant text ──
  t('setDifferentFirstPage(true)', () => PM.setDifferentFirstPage(true) === true);
  t('setDifferentOddEven(true)', () => PM.setDifferentOddEven(true) === true);
  t('options reflect both flags on', () => { const o = PM.getHeaderFooterOptions(); return (o.differentFirstPage === true && o.differentOddEven === true) ? 'both on' : ('got ' + JSON.stringify(o) && false); });
  t('primary header = P2PRIMH', () => PM.setHeaderText('P2PRIMH', { variant: 'default' }) === true);
  t('primary footer = P2PRIMF', () => PM.setFooterText('P2PRIMF', { variant: 'default' }) === true);
  t('first header = P2FIRSTH', () => PM.setHeaderText('P2FIRSTH', { variant: 'first' }) === true);
  t('first footer = P2FIRSTF', () => PM.setFooterText('P2FIRSTF', { variant: 'first' }) === true);
  t('even header = P2EVENH', () => PM.setHeaderText('P2EVENH', { variant: 'even' }) === true);
  t('even footer = P2EVENF', () => PM.setFooterText('P2EVENF', { variant: 'even' }) === true);
  try { W.editor.commands.insertContent('P2 body alpha bravo charlie. '); } catch (e) {}
  await sleep(300);

  // ── sanity: the markers are in the model BEFORE export ──
  t('model: getHeaderText(first)===P2FIRSTH', () => PM.getHeaderText({ variant: 'first' }) === 'P2FIRSTH' ? 'P2FIRSTH' : ('got ' + JSON.stringify(PM.getHeaderText({ variant: 'first' })) && false));
  t('model: getHeaderText(even)===P2EVENH', () => PM.getHeaderText({ variant: 'even' }) === 'P2EVENH' ? 'P2EVENH' : ('got ' + JSON.stringify(PM.getHeaderText({ variant: 'even' })) && false));
  t('model: getHeaderText(default)===P2PRIMH', () => PM.getHeaderText({ variant: 'default' }) === 'P2PRIMH' ? 'P2PRIMH' : ('got ' + JSON.stringify(PM.getHeaderText({ variant: 'default' })) && false));

  // ── export → save the .docx (for validate-open + the COM read-back) ──
  let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-' + mode + '-hf-p2.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  window.__hfP2Saved = saved && saved.path;
  t('saveBytes wrote the .docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));

  try { await PM.newBlank(); } catch (e) {} // teardown: reset global header/footer state
  return summary();
})();
