/* 003 Columns probe (mode-aware). Run via:
     npm run probe:columns   (paged build) — and again after WC_LAYOUT=overlay npm run build for parity.

   Proves the Columns wiring on the paged engine: WC.PM.setColumns({count,gap}) re-flows the painted body
   into N columns AND exports real sectPr <w:cols>. The model/export is mode-agnostic; the painted-band
   check is paged-only. Convention: detail STRING on success, `(... && false)` on failure. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const ta = async (name, fn) => { try { const r = await fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const done = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); };

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const exp = async () => { try { const parts = await W.editor.exportDocx({ getUpdatedDocs: true }); return { parts, doc: String(parts['word/document.xml'] || '') }; } catch (e) { return { parts: {}, doc: '' }; } };
  // distinct line-left x bands (rounded to 8px): N columns ⇒ ~N bands.
  const bands = () => { const xs = Array.from(document.querySelectorAll('.superdoc-page .superdoc-line')).map((l) => Math.round(l.getBoundingClientRect().left / 8) * 8).filter((x) => x > 0); return [...new Set(xs)].sort((a, b) => a - b); };
  const author = async () => { try { await PM.newBlank(); } catch (e) {} await sleep(150); let big = ''; for (let i = 1; i <= 60; i++) big += 'Column flow word ' + i + ' lorem ipsum dolor sit amet consectetur. '; try { W.editor.commands.insertContent(big); } catch (e) {} await sleep(450); };

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present (setColumns/getColumns) + newBlank + exportDocx', () => (typeof PM.setColumns === 'function' && typeof PM.getColumns === 'function' && typeof PM.newBlank === 'function' && W.editor && typeof W.editor.exportDocx === 'function') || ('missing' && false));
  if (!ok) return done();

  // ── Two columns ──
  await author();
  t('setColumns({count:2}) accepted', () => PM.setColumns({ count: 2 }) === true);
  await sleep(550);
  t('getColumns().count === 2 (round-trip)', () => PM.getColumns().count === 2 ? 'count=2' : ('got ' + JSON.stringify(PM.getColumns()) && false));
  if (mode === 'paged') await ta('paged paint: body renders at >=2 distinct column x-bands', async () => { const b = bands(); return b.length >= 2 ? ('bands=' + JSON.stringify(b.slice(0, 4))) : ('only ' + b.length + ' band(s): ' + JSON.stringify(b) && false); });
  await ta('export: sectPr carries <w:cols w:num="2">', async () => { const { doc } = await exp(); return /<w:cols\b[^>]*\bw:num="2"/.test(doc) ? 'num=2' : ('no w:cols num=2; snippet=' + ((doc.match(/<w:cols\b[^>]*>/) || [''])[0]) && false); });

  // ── Three columns ──
  t('setColumns({count:3}) accepted', () => PM.setColumns({ count: 3 }) === true);
  await sleep(550);
  if (mode === 'paged') await ta('paged paint: >=3 distinct column x-bands', async () => { const b = bands(); return b.length >= 3 ? ('bands=' + JSON.stringify(b.slice(0, 5))) : ('only ' + b.length + ' band(s): ' + JSON.stringify(b) && false); });
  await ta('export: <w:cols w:num="3">', async () => { const { doc } = await exp(); return /<w:cols\b[^>]*\bw:num="3"/.test(doc) ? 'num=3' : ('no num=3; snippet=' + ((doc.match(/<w:cols\b[^>]*>/) || [''])[0]) && false); });

  // ── Spacing (gap in inches → w:space twips) ──
  t('setColumns({count:2, gap:1}) accepted', () => PM.setColumns({ count: 2, gap: 1 }) === true);
  await sleep(350);
  await ta('export: spacing w:space="1440" (1 inch)', async () => { const { doc } = await exp(); return /<w:cols\b[^>]*\bw:space="1440"/.test(doc) ? 'space=1440' : ('snippet=' + ((doc.match(/<w:cols\b[^>]*>/) || [''])[0]) && false); });

  // ── One column normalizes back ──
  t('setColumns({count:1}) accepted', () => PM.setColumns({ count: 1 }) === true);
  await sleep(450);
  if (mode === 'paged') await ta('paged paint: back to a single column band', async () => { const b = bands(); return b.length <= 1 ? ('bands=' + JSON.stringify(b)) : ('still ' + b.length + ' bands: ' + JSON.stringify(b) && false); });
  await ta('export: no multi-column w:cols (num<=1 or absent)', async () => { const { doc } = await exp(); const m = (doc.match(/<w:cols\b[^>]*\bw:num="(\d+)"/) || []); const n = m[1] ? parseInt(m[1], 10) : 1; return n <= 1 ? 'single column' : ('still num=' + n && false); });

  try { await PM.newBlank(); } catch (e) {} // teardown
  return done();
})();
