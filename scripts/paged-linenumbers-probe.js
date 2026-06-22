/* 004 Line Numbers probe (mode-aware). Run via:
     npm run probe:linenumbers   (paged build) — and again after WC_LAYOUT=overlay npm run build for parity.

   P1 proves the Line-Numbers wiring: WC.PM.setLineNumbers({mode}) writes real sectPr <w:lnNumType> with
   the right w:restart, getLineNumbers() round-trips, and None drops it. The model/export is mode-agnostic.
   (P2 will add the owned margin-number overlay assertions — paged-only.) Convention: detail STRING on
   success, `(... && false)` on failure. */
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
  // The w:lnNumType lives in the body sectPr; grab the tag for restart/countBy/start assertions.
  const lnTag = (doc) => (doc.match(/<w:lnNumType\b[^>]*\/?>/) || [''])[0];
  const author = async () => { try { await PM.newBlank(); } catch (e) {} await sleep(150); let big = ''; for (let i = 1; i <= 30; i++) big += 'Line number probe paragraph ' + i + ' with several words to wrap. '; try { W.editor.commands.insertContent(big); } catch (e) {} await sleep(400); };

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present (setLineNumbers/getLineNumbers) + newBlank + exportDocx', () => (typeof PM.setLineNumbers === 'function' && typeof PM.getLineNumbers === 'function' && typeof PM.newBlank === 'function' && W.editor && typeof W.editor.exportDocx === 'function') || ('missing' && false));
  if (!ok) return done();

  await author();

  // ── Continuous ──
  t('setLineNumbers({mode:"continuous"}) accepted', () => PM.setLineNumbers({ mode: 'continuous' }) === true);
  await sleep(350);
  await ta('export: <w:lnNumType w:restart="continuous">', async () => { const { doc } = await exp(); return /<w:lnNumType\b[^>]*\bw:restart="continuous"/.test(doc) ? 'continuous' : ('snippet=' + lnTag(doc) && false); });
  t('getLineNumbers().active + mode==="continuous"', () => { const g = PM.getLineNumbers(); return (g.active === true && g.mode === 'continuous') ? 'rt ok' : ('got ' + JSON.stringify(g) && false); });

  // ── Restart Each Page (assert the single lnNumType tag carries newPage AND the prior 'continuous' is
  //    GONE — switching must REPLACE the restart, not append a second tag / leave a stale value) ──
  t('setLineNumbers({mode:"newPage"}) accepted', () => PM.setLineNumbers({ mode: 'newPage' }) === true);
  await sleep(300);
  await ta('export: lnNumType w:restart="newPage" (prior "continuous" replaced)', async () => { const { doc } = await exp(); const tag = lnTag(doc); return (/\bw:restart="newPage"/.test(tag) && !/\bw:restart="continuous"/.test(tag)) ? 'newPage' : ('snippet=' + tag && false); });
  t('getLineNumbers().mode==="newPage"', () => PM.getLineNumbers().mode === 'newPage' ? 'rt ok' : ('got ' + JSON.stringify(PM.getLineNumbers()) && false));

  // ── Restart Each Section (likewise: newSection set, newPage replaced) ──
  t('setLineNumbers({mode:"newSection"}) accepted', () => PM.setLineNumbers({ mode: 'newSection' }) === true);
  await sleep(300);
  await ta('export: lnNumType w:restart="newSection" (prior "newPage" replaced)', async () => { const { doc } = await exp(); const tag = lnTag(doc); return (/\bw:restart="newSection"/.test(tag) && !/\bw:restart="newPage"/.test(tag)) ? 'newSection' : ('snippet=' + tag && false); });

  // ── Count-by (round-trips cleanly to Word; start-at is P3 — Word reports StartingNumber off-by-one
  //    from w:start, so its mapping lands with the Line Numbering Options dialog). ──
  t('setLineNumbers({mode:"continuous", countBy:5}) accepted', () => PM.setLineNumbers({ mode: 'continuous', countBy: 5 }) === true);
  await sleep(300);
  await ta('export: w:countBy="5"', async () => { const { doc } = await exp(); const tag = lnTag(doc); return /\bw:countBy="5"/.test(tag) ? 'countBy=5' : ('snippet=' + tag && false); });
  t('getLineNumbers().countBy===5', () => { const g = PM.getLineNumbers(); return g.countBy === 5 ? 'rt ok' : ('got ' + JSON.stringify(g) && false); });

  // ── None removes w:lnNumType ──
  t('setLineNumbers({mode:"none"}) accepted', () => PM.setLineNumbers({ mode: 'none' }) === true);
  await sleep(300);
  await ta('export: no w:lnNumType after None', async () => { const { doc } = await exp(); return /<w:lnNumType\b/.test(doc) ? ('w:lnNumType still present: ' + lnTag(doc) && false) : 'removed'; });
  t('getLineNumbers().active === false after None', () => PM.getLineNumbers().active === false ? 'off' : ('still ' + JSON.stringify(PM.getLineNumbers()) && false));

  // ── Idempotent / no-section-corruption: re-applying None is a safe no-op success ──
  t('setLineNumbers({mode:"none"}) again is a safe no-op (true)', () => PM.setLineNumbers({ mode: 'none' }) === true);
  await ta('export: document still well-formed (has a body)', async () => { const { doc } = await exp(); return /<w:body\b/.test(doc) ? 'body intact' : ('no w:body' && false); });

  try { await PM.newBlank(); } catch (e) {} // teardown
  return done();
})();
