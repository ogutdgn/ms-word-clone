/* 004 Line-Numbers export probe (mode-aware). The driver (test-roundtrip-paged.js) runs it under
   WC_LAYOUT=paged. It authors a Continuous-line-numbers doc (body + sectPr/w:lnNumType restart=continuous)
   and saves it to C:/tmp/wc-<mode>-linenumbers.docx for validate-linenumbers-win.ps1 (real Word
   PageSetup.LineNumbering read-back). */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const summary = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode, savedPath: window.__lnSaved }, results }, null, 2); };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present (setLineNumbers + exportDocxBytes + wordAPI.saveBytes)', () => (typeof PM.setLineNumbers === 'function' && typeof PM.exportDocxBytes === 'function' && typeof PM.newBlank === 'function' && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) return summary();

  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  let big = ''; for (let i = 1; i <= 40; i++) big += 'Line-numbered body word ' + i + ' lorem ipsum dolor sit amet. ';
  try { W.editor.commands.insertContent(big); } catch (e) {}
  await sleep(200);
  // Continuous with countBy:2 (round-trips cleanly to Word). start-at is P3 — Word reports StartingNumber
  // off-by-one from w:start, so its mapping ships with the Line Numbering Options dialog.
  t('setLineNumbers({mode:"continuous", countBy:2}) accepted', () => PM.setLineNumbers({ mode: 'continuous', countBy: 2 }) === true);
  await sleep(350);
  t('model: getLineNumbers().active && mode==="continuous"', () => { const g = PM.getLineNumbers(); return (g.active === true && g.mode === 'continuous') ? 'on' : ('got ' + JSON.stringify(g) && false); });

  let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-' + mode + '-linenumbers.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  window.__lnSaved = saved && saved.path;
  t('saveBytes wrote the .docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));

  try { await PM.newBlank(); } catch (e) {}
  return summary();
})();
