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
  // ── P2 (the owned margin-number overlay) helpers. Selector contract: #wc-linenum-overlay / .wc-line-number /
  //    data-line-number. applyLn mirrors the ribbon path — setLineNumbers is a sectPr write with NO relayout, so
  //    the overlay only repaints on the wc:linenumbers-changed event the H.lineNumbers handler dispatches. ──
  const lnEls = () => Array.from(document.querySelectorAll('.wc-line-number'));
  const lnVals = () => lnEls().map((e) => parseInt(e.getAttribute('data-line-number') || e.textContent || 'NaN', 10)).filter(Number.isFinite);
  const pageOfClientY = (cy) => { for (const p of document.querySelectorAll('.superdoc-page')) { const pr = p.getBoundingClientRect(); if (cy >= pr.top - 2 && cy <= pr.bottom + 2) return parseInt(p.getAttribute('data-page-index'), 10); } return null; };
  const applyLn = async (opts, ms) => { const ok = PM.setLineNumbers(opts); try { window.dispatchEvent(new Event('wc:linenumbers-changed')); } catch (e) {} await sleep(ms || 350); return ok; };
  const authorMulti = async () => { try { await PM.newBlank(); } catch (e) {} await sleep(160); try { W.editor.commands.insertContent('Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(500)); } catch (e) {} let np = -1; for (let i = 0; i < 240; i++) { np = document.querySelectorAll('.superdoc-page').length; if (np > 1) break; await sleep(50); } await sleep(350); return np; };

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

  // ── P2: the in-app owned margin-number overlay (paged-only render; overlay-mode no-op parity) ──
  if (mode === 'paged') {
    await author();
    await applyLn({ mode: 'continuous' }, 450);
    t('P2 R1: continuous paints numbers; head = 1,2,3', () => { const v = lnVals(); const head = v.slice(0, 3); return (v.length >= 1 && head[0] === 1 && head.every((nn, i) => nn === i + 1)) ? ('count=' + v.length + ' head=' + JSON.stringify(head)) : ('vals=' + JSON.stringify(v.slice(0, 6)) && false); });
    t('P2 R5: each number is non-collapsed, in the LEFT margin, and overlaps its line vertically', () => {
      const els = lnEls(); const bodyLines = Array.from(document.querySelectorAll('.superdoc-page .superdoc-line'));
      let checked = 0, marginBad = 0, collapsed = 0, misaligned = 0;
      for (const el of els) {
        const er = el.getBoundingClientRect();
        if (er.width < 1 || er.height < 1) { collapsed++; continue; } // narrow-margin collapse / invisible
        const line = bodyLines.find((l) => { const lr = l.getBoundingClientRect(); return er.top >= lr.top - 3 && er.top <= lr.bottom + 3; });
        if (line) { checked++; const lr = line.getBoundingClientRect(); if (er.right > lr.left + 1) marginBad++; if (er.bottom < lr.top - 2 || er.top > lr.bottom + 2) misaligned++; }
      }
      return (checked > 0 && marginBad === 0 && collapsed === 0 && misaligned === 0) ? ('checked=' + checked) : ('checked=' + checked + ' margin=' + marginBad + ' collapsed=' + collapsed + ' misaligned=' + misaligned && false);
    });
    await applyLn({ mode: 'continuous', countBy: 5 }, 450);
    t('P2 R3: countBy=5 ⇒ displayed numbers are only multiples of 5 (head=5)', () => { const v = lnVals(); return (v.length >= 1 && v.every((nn) => nn % 5 === 0) && v[0] === 5) ? ('vals=' + JSON.stringify(v.slice(0, 5))) : ('vals=' + JSON.stringify(v.slice(0, 8)) && false); });
    await applyLn({ mode: 'none' }, 350);
    t('P2 R4: None ⇒ 0 number elements', () => lnEls().length === 0 ? 'cleared' : ('still ' + lnEls().length + ' numbers' && false));
    const np = await authorMulti();
    results.push({ name: 'P2 R2 setup: forced a multi-page doc (>1 .superdoc-page)', pass: np > 1, detail: 'pages=' + np });
    await applyLn({ mode: 'newPage' }, 550);
    await ta('P2 R2: Restart Each Page ⇒ page-2 numbering restarts at 1', async () => {
      const byPage = {};
      for (const el of lnEls()) { const er = el.getBoundingClientRect(); const pg = pageOfClientY((er.top + er.bottom) / 2); const v = parseInt(el.getAttribute('data-line-number'), 10); if (pg != null && Number.isFinite(v)) (byPage[pg] = byPage[pg] || []).push(v); }
      const p0 = byPage[0] || [], p1 = byPage[1] || [];
      if (!p0.length || !p1.length) return ('page buckets p0=' + p0.length + ' p1=' + p1.length && false);
      const p1min = Math.min.apply(null, p1), p1max = Math.max.apply(null, p1);
      return (p1min === 1 && p1max <= p1.length) ? ('p1 restarts 1..' + p1max + ' (p0 max=' + Math.max.apply(null, p0) + ')') : ('p1=[' + p1min + '..' + p1max + '] len=' + p1.length && false);
    });
  } else {
    // overlay mode: the engine paints no .superdoc-page sheets, so the line-numbers overlay must NO-OP. Assert
    // BOTH (no sheets AND no numbers while continuous is active) so a failed-to-apply can't masquerade as a no-op.
    await author();
    await applyLn({ mode: 'continuous' }, 350);
    t('P2 overlay no-op: 0 .superdoc-page sheets (overlay engine has none)', () => document.querySelectorAll('.superdoc-page').length === 0 ? 'no sheets' : ('found ' + document.querySelectorAll('.superdoc-page').length && false));
    t('P2 overlay no-op: 0 .wc-line-number while continuous is active', () => lnEls().length === 0 ? 'overlay correctly absent' : ('rendered ' + lnEls().length + ' in overlay mode' && false));
  }

  try { await PM.newBlank(); } catch (e) {} // teardown
  return done();
})();
