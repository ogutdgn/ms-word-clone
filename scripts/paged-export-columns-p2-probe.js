/* 003 P2 Columns export probe. Authors a doc with the Left (unequal) preset + a line-between separator
   and saves it for validate-columns-win.ps1 (real Word: Count==2, EvenlySpaced==false, LineBetween==true,
   per-column Width[0] < Width[1]). Run under WC_LAYOUT=paged by test-roundtrip-paged.js. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const summary = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode, savedPath: window.__colP2Saved }, results }, null, 2); };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present', () => (typeof PM.setColumns === 'function' && typeof PM.exportDocxBytes === 'function' && typeof PM.newBlank === 'function' && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) return summary();

  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  let big = ''; for (let i = 1; i <= 40; i++) big += 'P2 columns word ' + i + ' lorem ipsum dolor sit amet. ';
  try { W.editor.commands.insertContent(big); } catch (e) {}
  await sleep(200);
  // Left (unequal) + line-between, both via the owned bodySectPr write.
  t('setColumns({unequal:"left"}) accepted', () => PM.setColumns({ unequal: 'left' }) === true);
  await sleep(250);
  t('setColumns({count:2, unequal:"left", lineBetween:true}) accepted', () => PM.setColumns({ count: 2, unequal: 'left', lineBetween: true }) === true);
  await sleep(300);

  let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-' + mode + '-columns-p2.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  window.__colP2Saved = saved && saved.path;
  t('saveBytes wrote the .docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));

  try { await PM.newBlank(); } catch (e) {}
  return summary();
})();
