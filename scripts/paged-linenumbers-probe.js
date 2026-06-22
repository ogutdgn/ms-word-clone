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
  // ── P3 helpers. authorParas: several body paragraphs, the LAST carrying a SUPPRESSME marker (caret lands there
  //    after insert, so suppressing the "current" paragraph is deterministic). lastIsLong wraps the marker
  //    paragraph onto multiple lines so the overlay-skip test exercises a multi-line suppressed paragraph. ──
  const SUPP = 'SUPPRESSME';
  const authorParas = async (lastIsLong) => {
    try { await PM.newBlank(); } catch (e) {} await sleep(160);
    const tail = lastIsLong ? (SUPP + ' ' + 'wibble wobble wuzzle frobnicate quuxify '.repeat(12)) : (SUPP + ' marker paragraph');
    const html = '<p>First numbered line alpha.</p><p>Second numbered line beta.</p><p>Third numbered line gamma.</p><p>' + tail + '</p>';
    try { W.editor.commands.insertContent(html); } catch (e) {}
    await sleep(350);
  };
  // Identify ALL painted lines of a paragraph by its PM range (a wrapped paragraph only has the marker word on
  // its FIRST line, so textContent matching is unreliable). Mirrors the overlay's own data-pm-start → range map.
  const paraRange = (pred) => { let r = null; try { W.editor.state.doc.descendants((node, pos) => { if (node.type.name === 'paragraph' && pred(node)) { r = [pos, pos + node.nodeSize]; return false; } return true; }); } catch (e) {} return r; };
  const markerParaRange = () => paraRange((n) => /SUPPRESSME/.test(n.textContent || ''));
  const suppressedRange = () => paraRange((n) => n.attrs && n.attrs.paragraphProperties && n.attrs.paragraphProperties.suppressLineNumbers === true);
  const linesInRange = (range) => Array.from(document.querySelectorAll('.superdoc-page .superdoc-line')).filter((l) => { const s = Number(l.dataset.pmStart); return range && Number.isFinite(s) && s >= range[0] && s < range[1]; });
  // count .wc-line-number elements whose vertical center sits beside any of `lines`
  const numbersBesideLines = (lines) => { let hit = 0; for (const el of lnEls()) { const er = el.getBoundingClientRect(); const c = (er.top + er.bottom) / 2; if (lines.some((l) => { const lr = l.getBoundingClientRect(); return c >= lr.top - 2 && c <= lr.bottom + 2; })) hit++; } return hit; };
  const suppParaTag = (doc) => { const paras = doc.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []; const supp = paras.find((p) => /SUPPRESSME/.test(p)) || ''; const others = paras.filter((p) => !/SUPPRESSME/.test(p)); return { inMarker: /<w:suppressLineNumbers\b/.test(supp), leaked: others.some((p) => /<w:suppressLineNumbers\b/.test(p)), count: (doc.match(/<w:suppressLineNumbers\b/g) || []).length }; };

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

  // ── P3 Options dialog model (mode-agnostic, export-based). start/countBy are USER-FACING — the bridge maps the
  //    w:start off-by-one (raw w:start = userStart−1; ≤1 omitted) and getLineNumbers() inverts back. Each scenario
  //    re-authors a fresh section (setLineNumbering is a PARTIAL update — unprovided attrs persist otherwise). ──
  await author();
  t('P3: setLineNumbers({continuous, start:5, countBy:2}) accepted', () => PM.setLineNumbers({ mode: 'continuous', start: 5, countBy: 2 }) === true);
  await sleep(300);
  await ta('P3: export raw w:start="4" (=userStart 5 − 1) + w:countBy="2"', async () => { const { doc } = await exp(); const tag = lnTag(doc); return (/\bw:start="4"/.test(tag) && /\bw:countBy="2"/.test(tag)) ? ('tag=' + tag) : ('snippet=' + tag && false); });
  t('P3: getLineNumbers().start===5 (user-facing round-trips the off-by-one)', () => { const g = PM.getLineNumbers(); return g.start === 5 ? 'start=5' : ('got ' + JSON.stringify(g) && false); });

  await author();
  t('P3: setLineNumbers({continuous, start:1}) accepted', () => PM.setLineNumbers({ mode: 'continuous', start: 1 }) === true);
  await sleep(250);
  await ta('P3: start===1 OMITS w:start (Word default StartingNumber=1; no odd w:start="0")', async () => { const { doc } = await exp(); const tag = lnTag(doc); return /\bw:start=/.test(tag) ? ('unexpected ' + tag && false) : 'omitted'; });
  t('P3: getLineNumbers().start===1 when omitted', () => PM.getLineNumbers().start === 1 ? 'start=1' : ('got ' + JSON.stringify(PM.getLineNumbers()) && false));

  await author();
  t('P3: setLineNumbers({continuous, distance:0.5}) accepted', () => PM.setLineNumbers({ mode: 'continuous', distance: 0.5 }) === true);
  await sleep(250);
  await ta('P3: explicit distance ⇒ w:distance="720" (0.5in) + distanceExplicit', async () => { const { doc } = await exp(); const tag = lnTag(doc); const g = PM.getLineNumbers(); return (/\bw:distance="720"/.test(tag) && g.distanceExplicit === true && Math.abs(g.distance - 0.5) < 1e-6) ? ('tag=' + tag) : ('tag=' + tag + ' g=' + JSON.stringify(g) && false); });

  await author();
  t('P3: setLineNumbers({continuous}) with NO distance accepted', () => PM.setLineNumbers({ mode: 'continuous' }) === true);
  await sleep(250);
  await ta('P3: no distance ⇒ no w:distance + distanceExplicit===false (Auto)', async () => { const { doc } = await exp(); const tag = lnTag(doc); const g = PM.getLineNumbers(); return (!/\bw:distance=/.test(tag) && g.distanceExplicit === false) ? 'auto' : ('tag=' + tag + ' g=' + JSON.stringify(g) && false); });

  // ── P3 partial-update CARRYOVER (the dialog's replace:true full-set must CLEAR omitted attrs on a RE-EDIT of
  //    a LIVE section — setLineNumbering only writes, never clears). Emulates the Options dialog applied twice. ──
  await author();
  t('P3 carryover: first apply start:5 (raw w:start=4)', () => PM.setLineNumbers({ mode: 'continuous', start: 5, countBy: 2, replace: true }) === true);
  await sleep(250);
  await ta('P3 carryover: raw w:start="4" present after first apply', async () => { const { doc } = await exp(); return /\bw:start="4"/.test(lnTag(doc)) ? 'w:start=4' : ('snippet=' + lnTag(doc) && false); });
  t('P3 carryover: re-apply start:1 on the SAME section (replace:true)', () => PM.setLineNumbers({ mode: 'continuous', start: 1, countBy: 1, replace: true }) === true);
  await sleep(250);
  await ta('P3 carryover: stale w:start CLEARED (no w:start) + getLineNumbers().start===1', async () => { const { doc } = await exp(); const tag = lnTag(doc); const g = PM.getLineNumbers(); return (!/\bw:start=/.test(tag) && g.start === 1) ? 'cleared→1' : ('tag=' + tag + ' g=' + JSON.stringify(g) && false); });
  // distance carryover: explicit 0.5 then a replace:true apply with NO distance must CLEAR the prior w:distance.
  await author();
  t('P3 carryover: first apply distance:0.5 (raw w:distance=720)', () => PM.setLineNumbers({ mode: 'continuous', distance: 0.5, replace: true }) === true);
  await sleep(250);
  await ta('P3 carryover: w:distance="720" present after first apply', async () => { const { doc } = await exp(); return /\bw:distance="720"/.test(lnTag(doc)) ? 'w:distance=720' : ('snippet=' + lnTag(doc) && false); });
  t('P3 carryover: re-apply with NO distance (Auto) on the SAME section (replace:true)', () => PM.setLineNumbers({ mode: 'continuous', replace: true }) === true);
  await sleep(250);
  await ta('P3 carryover: stale w:distance CLEARED (Auto) + distanceExplicit===false', async () => { const { doc } = await exp(); const tag = lnTag(doc); const g = PM.getLineNumbers(); return (!/\bw:distance=/.test(tag) && g.distanceExplicit === false) ? 'cleared→auto' : ('tag=' + tag + ' g=' + JSON.stringify(g) && false); });

  // ── P3 per-paragraph suppress (mode-agnostic, export + model). Author paragraphs (last = SUPPRESSME marker);
  //    the caret lands in it, so suppressing the "current" paragraph is deterministic. ──
  await authorParas(false);
  t('P3: suppressLineNumbers() on the marker paragraph accepted', () => PM.suppressLineNumbers() === true);
  await sleep(200);
  t('P3: currentParagraphSuppressed() === true', () => PM.currentParagraphSuppressed() === true ? 'suppressed' : ('got ' + PM.currentParagraphSuppressed() && false));
  await ta('P3: export carries exactly one bare <w:suppressLineNumbers/> in the marker pPr (no leak)', async () => { const { doc } = await exp(); const r = suppParaTag(doc); return (r.count === 1 && r.inMarker === true && r.leaked === false) ? ('count=1 inMarker') : ('r=' + JSON.stringify(r) && false); });
  t('P3: suppressLineNumbers() again accepted (toggles OFF)', () => PM.suppressLineNumbers() === true);
  await sleep(150);
  t('P3: currentParagraphSuppressed() === false after toggle-off', () => PM.currentParagraphSuppressed() === false ? 'restored' : ('got ' + PM.currentParagraphSuppressed() && false));
  await ta('P3: after toggle-off the export drops <w:suppressLineNumbers> (null clear)', async () => { const { doc } = await exp(); return /<w:suppressLineNumbers\b/.test(doc) ? ('still present' && false) : 'cleared'; });

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
    // ── P3 overlay: a suppressed (multi-line) paragraph is EXCLUDED from the count — no number beside any of its
    //    lines, and the running count == the non-suppressed body-line count (continuous, countBy 1). ──
    await authorParas(true); // last paragraph (SUPPRESSME) wraps onto several lines
    await applyLn({ mode: 'continuous' }, 500);
    const beforeMax = (() => { const v = lnVals(); return v.length ? Math.max.apply(null, v) : 0; })();
    const markerLineCount = linesInRange(markerParaRange()).length; // ALL wrapped lines of the marker paragraph (by PM range)
    results.push({ name: 'P3 overlay setup: marker paragraph wrapped to ≥2 lines + numbered before suppress', pass: markerLineCount >= 2 && beforeMax >= 4, detail: 'markerLines=' + markerLineCount + ' maxBefore=' + beforeMax });
    PM.suppressLineNumbers(true); // suppress the current (marker) paragraph
    await applyLn({ mode: 'continuous' }, 500); // re-render the overlay (dispatches wc:linenumbers-changed)
    t('P3 overlay: 0 numbers beside ANY line of the suppressed paragraph (excluded)', () => { const hit = numbersBesideLines(linesInRange(suppressedRange())); return hit === 0 ? 'none beside suppressed' : (hit + ' numbers leaked onto the suppressed paragraph' && false); });
    t('P3 overlay: numbers still painted for non-suppressed lines + count drops (suppressed lines uncounted)', () => { const v = lnVals(); const suppLines = linesInRange(suppressedRange()).length; const allLines = Array.from(document.querySelectorAll('.superdoc-page .superdoc-line')).filter((l) => l.getBoundingClientRect().height > 0).length; const nonSupp = allLines - suppLines; const maxN = v.length ? Math.max.apply(null, v) : 0; return (v.length >= 1 && maxN === v.length && maxN <= nonSupp && maxN < beforeMax) ? ('max=' + maxN + ' nonSupp=' + nonSupp + ' before=' + beforeMax) : ('vals=' + JSON.stringify(v) + ' suppLines=' + suppLines + ' nonSupp=' + nonSupp + ' before=' + beforeMax && false); });
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
