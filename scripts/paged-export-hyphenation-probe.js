/* 005 Hyphenation export probe (mode-aware). The driver (test-roundtrip-paged.js) runs it under
   WC_LAYOUT=paged. It authors an Automatic-hyphenation doc with options (zone 0.25" ⇒ 360tw, consecutive
   limit 2, hyphenate-CAPS OFF ⇒ w:doNotHyphenateCaps) and saves it to C:/tmp/wc-<mode>-hyphenation.docx for
   validate-hyphenation-win.ps1 (real Word ActiveDocument.AutoHyphenation / HyphenationZone /
   ConsecutiveHyphensLimit / HyphenateCaps read-back). */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const summary = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode, savedPath: window.__hyphSaved }, results }, null, 2); };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present (setHyphenation + exportDocxBytes + wordAPI.saveBytes)', () => (typeof PM.setHyphenation === 'function' && typeof PM.exportDocxBytes === 'function' && typeof PM.newBlank === 'function' && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) return summary();

  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  let big = ''; for (let i = 1; i <= 40; i++) big += 'Internationalization counterproductive antidisestablishmentarianism lorem ipsum. ';
  try { W.editor.commands.insertContent(big); } catch (e) {}
  await sleep(200);
  // Automatic + zone 0.25" + consecutive limit 2 + hyphenate-CAPS OFF (⇒ w:doNotHyphenateCaps).
  t('setHyphenation({mode:"auto", zone:0.25, consecutiveLimit:2, hyphenateCaps:false}) accepted', () => PM.setHyphenation({ mode: 'auto', zone: 0.25, consecutiveLimit: 2, hyphenateCaps: false }) === true);
  await sleep(250);
  t('model: getHyphenation().auto && !hyphenateCaps', () => { const g = PM.getHyphenation(); return (g.auto === true && g.hyphenateCaps === false && g.consecutiveLimit === 2) ? 'on' : ('got ' + JSON.stringify(g) && false); });

  let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-' + mode + '-hyphenation.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  window.__hyphSaved = saved && saved.path;
  t('saveBytes wrote the .docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));

  try { await PM.newBlank(); } catch (e) {}
  return summary();
})();
