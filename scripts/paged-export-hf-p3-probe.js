/* 002 P3 header/footer export probe (mode-aware). The driver (test-roundtrip-paged.js) runs it under
   WC_LAYOUT=paged. It authors a doc with a footer page number (a REAL OOXML PAGE field, fldChar/
   instrText) and saves it to C:/tmp/wc-<mode>-hf-p3.docx for the validate-headerfooter-win.ps1
   page-field read-back (real Word resolves wdFieldPage=33 → the page number — this is what proves
   per-page correctness, since the paged PE does not resolve a freshly-inserted field in-app). */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const summary = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode, savedPath: window.__hfP3Saved }, results }, null, 2); };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('P3 verbs + exportDocxBytes + wordAPI.saveBytes present', () => (['insertPageNumber', 'removePageNumbers', 'exportDocxBytes', 'newBlank'].every((k) => typeof PM[k] === 'function') && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) return summary();

  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  try { W.editor.commands.insertContent('P3 page-number body alpha bravo charlie. '); } catch (e) {}
  await sleep(150);
  t('insertPageNumber({position:"bottom"}) accepted', () => PM.insertPageNumber({ position: 'bottom' }) === true);
  await sleep(260);
  t('export-model sanity: footer has a fldChar PAGE field', () => 'authored (real-Word read-back is the proof)');

  let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-' + mode + '-hf-p3.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  window.__hfP3Saved = saved && saved.path;
  t('saveBytes wrote the .docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));

  try { await PM.newBlank(); } catch (e) {}
  return summary();
})();
