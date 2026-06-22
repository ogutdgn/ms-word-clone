/* Milestone-4d header/footer probe (mode-aware). Run via:
     WC_LAYOUT=paged npm run build && electron . --probe-out=/tmp/wc-hf.json --shot-evalfile=scripts/paged-headerfooter-probe.js
     npm run build && electron . --probe-out=/tmp/wc-hf-ovl.json --shot-evalfile=scripts/paged-headerfooter-probe.js

   Proves M4d header-footer: the 4 verbs (set/get Header/Footer Text) are MODE-AGNOSTIC (doc-model only, zero
   coords) → identical in paged + overlay. Mirrors overlay test [9] (test-suite-pm.js:4853-4900): set → get
   round-trip → exportDocx parts (word/headerN.xml <w:hdr> + sectPr w:headerReference + rels) → REPLACE. NO
   production change to header-footer.ts. Convention: detail STRING on success, `(... && false)` on failure. */
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

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 200) && false));
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('set/get Header/Footer verbs + newBlank + editor.exportDocx present', () => (['setHeaderText', 'setFooterText', 'getHeaderText', 'getFooterText'].every((k) => typeof PM[k] === 'function') && typeof PM.newBlank === 'function' && W.editor && typeof W.editor.exportDocx === 'function') || ('missing' && false));
  if (!ok) return done();

  // clean baseline (header/footer parts are GLOBAL converter state, not reset by setDoc)
  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);

  await ta('blank doc has NO w:headerReference before setHeaderText (non-vacuous)', async () => { const { doc } = await exp(); if (!doc) return 'export returned EMPTY document.xml (exportDocx failed — baseline would be vacuous)' && false; return /<w:headerReference\b/.test(doc) ? ('doc already had a w:headerReference (vacuous baseline)' && false) : 'clean baseline'; });

  t('setHeaderText("HdrProbe") accepted', () => PM.setHeaderText('HdrProbe') === true);
  t('setFooterText("FtrProbe") accepted', () => PM.setFooterText('FtrProbe') === true);
  await sleep(160);

  // cache round-trip (the dialog-prefill path) — proves the doc-model write took in THIS mode
  t('getHeaderText() round-trips "HdrProbe" (' + mode + ')', () => PM.getHeaderText() === 'HdrProbe' ? 'HdrProbe' : ('got ' + JSON.stringify(PM.getHeaderText()) && false));
  t('getFooterText() round-trips "FtrProbe" (' + mode + ')', () => PM.getFooterText() === 'FtrProbe' ? 'FtrProbe' : ('got ' + JSON.stringify(PM.getFooterText()) && false));

  await ta('export: document.xml sectPr carries <w:headerReference r:id> + <w:footerReference r:id>', async () => {
    const { doc } = await exp();
    if (!/<w:headerReference\b[^>]*\br:id="[^"]+"/.test(doc)) return 'no <w:headerReference r:id> in document.xml' && false;
    if (!/<w:footerReference\b[^>]*\br:id="[^"]+"/.test(doc)) return 'no <w:footerReference r:id> in document.xml' && false;
    return 'header+footer references present';
  });
  await ta('export: word/headerN.xml <w:hdr> has HdrProbe + word/footerN.xml <w:ftr> has FtrProbe + rels', async () => {
    const { parts } = await exp();
    const hdr = Object.entries(parts).find(([k, v]) => /header\d*\.xml$/i.test(k) && /<w:hdr\b/.test(String(v)) && /HdrProbe/.test(String(v)));
    if (!hdr) return 'no word/headerN.xml part with <w:hdr> containing HdrProbe' && false;
    const ftr = Object.entries(parts).find(([k, v]) => /footer\d*\.xml$/i.test(k) && /<w:ftr\b/.test(String(v)) && /FtrProbe/.test(String(v)));
    if (!ftr) return 'no word/footerN.xml part with <w:ftr> containing FtrProbe' && false;
    const rels = String(parts['word/_rels/document.xml.rels'] || '');
    if (!/relationships\/header/.test(rels)) return 'no header relationship in document.xml.rels' && false;
    if (!/relationships\/footer/.test(rels)) return 'no footer relationship in document.xml.rels' && false;
    return 'header/footer parts + rels present';
  });

  // RE-EDIT must REPLACE, not append (guards 'HdrProbeHdrTwo')
  t('re-edit setHeaderText("HdrTwo") accepted', () => PM.setHeaderText('HdrTwo') === true);
  await sleep(140);
  t('re-edit REPLACED (getHeaderText === "HdrTwo", not appended)', () => PM.getHeaderText() === 'HdrTwo' ? 'HdrTwo' : ('got ' + JSON.stringify(PM.getHeaderText()) && false));
  await ta('re-edit: header part rewritten with HdrTwo, no stale HdrProbe', async () => {
    const { parts } = await exp();
    const re = Object.entries(parts).find(([k, v]) => /header\d*\.xml$/i.test(k) && /HdrTwo/.test(String(v)));
    if (!re) return 'header part not rewritten with HdrTwo' && false;
    if (/HdrProbe/.test(String(re[1]))) return 're-edit left stale HdrProbe (append bug)' && false;
    return 'replaced cleanly';
  });

  // ─── P1 (002): on-page enter/edit/close + the "Header & Footer Tools" contextual tab ───
  // No-fork (spike-verified, research.md): enter = materialize-if-absent + synthesize the PE's
  // double-click on the .superdoc-page-{header,footer} band; close = exitActiveStorySurface();
  // state/tab signal = getActiveStoryLocator() + the 'headerFooterModeChanged' -> 'wc:hf-mode' event.
  // PAGED-only (the PE paints the bands); overlay returns false (parity).
  t('P1 verbs present (enterHeaderFooter/closeHeaderFooter/headerFooterState)', () => ['enterHeaderFooter', 'closeHeaderFooter', 'headerFooterState'].every((k) => typeof PM[k] === 'function'));
  const hfTab = () => document.querySelector('.contextual-tab[data-tab="header-footer-tools"]');
  const pagesText = () => Array.from(document.querySelectorAll('.superdoc-page')).map((p) => p.textContent || '').join(' ');
  if (mode === 'paged') {
    await ta('enterHeaderFooter("header") activates the header session', async () => { const ok = await PM.enterHeaderFooter('header'); await sleep(200); const st = PM.headerFooterState(); return (ok === true && st.active === true && st.region === 'header') ? 'active header' : ('ok=' + ok + ' state=' + JSON.stringify(st) && false); });
    await ta('the "Header & Footer Tools" contextual tab is shown on enter', async () => { await sleep(120); return hfTab() ? 'tab shown' : ('no contextual tab in ribbon' && false); });
    t('edit-on-page: setHeaderText while active persists', () => { PM.setHeaderText('OnPageHdr'); return PM.getHeaderText() === 'OnPageHdr' ? 'OnPageHdr' : ('got ' + JSON.stringify(PM.getHeaderText()) && false); });
    await ta('the header text paints in the band', async () => { await sleep(300); return /OnPageHdr/.test(pagesText()) ? 'painted' : ('not painted' && false); });
    await ta('Go to Footer switches the active region to footer', async () => { const ok = await PM.enterHeaderFooter('footer'); await sleep(200); const st = PM.headerFooterState(); return (ok === true && st.region === 'footer') ? 'footer active' : ('ok=' + ok + ' state=' + JSON.stringify(st) && false); });
    await ta('closeHeaderFooter returns to the body (state inactive)', async () => { const ok = PM.closeHeaderFooter(); await sleep(300); const st = PM.headerFooterState(); return (ok === true && st.active === false) ? 'closed' : ('ok=' + ok + ' state=' + JSON.stringify(st) && false); });
    await ta('the contextual tab is hidden after Close', async () => { await sleep(150); return !hfTab() ? 'tab hidden' : ('contextual tab still present after Close' && false); });
    // review #4: Open/New while a header session is active must reconcile (force-exit in replaceEditor) — tab hides + state clears.
    await ta('Open/New while a header session is active reconciles (tab hides + state inactive)', async () => {
      const reEntered = await PM.enterHeaderFooter('header'); await sleep(200);
      if (!hfTab()) return ('precondition: tab did not re-show before New (entered=' + reEntered + ')' && false);
      await PM.newBlank(); await sleep(300);
      const st = PM.headerFooterState();
      return (!hfTab() && st.active === false) ? 'reconciled' : ('tab=' + !!hfTab() + ' state=' + JSON.stringify(st) && false);
    });
  } else {
    await ta('overlay: enterHeaderFooter returns false (on-page entry is paged-only)', async () => { const ok = await PM.enterHeaderFooter('header'); return ok === false ? 'no-op in overlay' : ('returned ' + ok && false); });
    t('overlay: headerFooterState inactive + no contextual tab', () => (PM.headerFooterState().active === false && !hfTab()) ? 'inactive' : ('unexpected' && false));
  }

  // ─── P2 (002): Different First Page / Different Odd & Even variants ─────────────────────
  // Mode-agnostic model + export (the toggles + variant text route through the doc-api section
  // adapters + the story-runtime — zero coords, identical paged/overlay); the painted-band check
  // is paged-only. variant ∈ default|first|even = Word Primary/FirstPage/EvenPages.
  t('P2 verbs present (setDifferentFirstPage/setDifferentOddEven/getHeaderFooterOptions)', () => ['setDifferentFirstPage', 'setDifferentOddEven', 'getHeaderFooterOptions'].every((k) => typeof PM[k] === 'function'));
  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);

  // Different First Page: the titlePg flag + distinct first/primary header & footer text.
  t('setDifferentFirstPage(true) accepted', () => PM.setDifferentFirstPage(true) === true);
  t('getHeaderFooterOptions().differentFirstPage === true', () => PM.getHeaderFooterOptions().differentFirstPage === true ? 'on' : ('got ' + JSON.stringify(PM.getHeaderFooterOptions()) && false));
  t('setHeaderText("PrimaryHdr", {variant:"default"}) accepted', () => PM.setHeaderText('PrimaryHdr', { variant: 'default' }) === true);
  t('setHeaderText("FirstHdr", {variant:"first"}) accepted', () => PM.setHeaderText('FirstHdr', { variant: 'first' }) === true);
  t('setFooterText("FirstFtr", {variant:"first"}) accepted', () => PM.setFooterText('FirstFtr', { variant: 'first' }) === true);
  await sleep(180);
  t('getHeaderText({variant:"first"}) round-trips "FirstHdr"', () => PM.getHeaderText({ variant: 'first' }) === 'FirstHdr' ? 'FirstHdr' : ('got ' + JSON.stringify(PM.getHeaderText({ variant: 'first' })) && false));
  t('getHeaderText({variant:"default"}) round-trips "PrimaryHdr" (no variant bleed)', () => PM.getHeaderText({ variant: 'default' }) === 'PrimaryHdr' ? 'PrimaryHdr' : ('got ' + JSON.stringify(PM.getHeaderText({ variant: 'default' })) && false));
  await ta('export: sectPr has <w:titlePg> + headerReference type="first" AND type="default"', async () => {
    const { doc } = await exp();
    if (!/<w:titlePg\b/.test(doc)) return 'no <w:titlePg> in sectPr' && false;
    if (!/<w:headerReference\b[^>]*\bw:type="first"/.test(doc)) return 'no headerReference type="first"' && false;
    if (!/<w:headerReference\b[^>]*\bw:type="default"/.test(doc)) return 'no headerReference type="default"' && false;
    return 'titlePg + first/default refs present';
  });
  await ta('export: a first-variant header part carries "FirstHdr" distinct from the primary "PrimaryHdr"', async () => {
    const { parts } = await exp();
    const first = Object.entries(parts).find(([k, v]) => /header\d*\.xml$/i.test(k) && /FirstHdr/.test(String(v)));
    const prim = Object.entries(parts).find(([k, v]) => /header\d*\.xml$/i.test(k) && /PrimaryHdr/.test(String(v)));
    if (!first) return 'no header part with FirstHdr' && false;
    if (!prim) return 'no header part with PrimaryHdr' && false;
    if (first[0] === prim[0]) return 'first + primary collapsed into one part' && false;
    return 'distinct first/primary parts';
  });

  // Different Odd & Even: the document-level evenAndOddHeaders flag + even-variant text.
  t('setDifferentOddEven(true) accepted', () => PM.setDifferentOddEven(true) === true);
  t('getHeaderFooterOptions().differentOddEven === true', () => PM.getHeaderFooterOptions().differentOddEven === true ? 'on' : ('got ' + JSON.stringify(PM.getHeaderFooterOptions()) && false));
  t('setHeaderText("EvenHdr", {variant:"even"}) accepted', () => PM.setHeaderText('EvenHdr', { variant: 'even' }) === true);
  await sleep(180);
  t('getHeaderText({variant:"even"}) round-trips "EvenHdr"', () => PM.getHeaderText({ variant: 'even' }) === 'EvenHdr' ? 'EvenHdr' : ('got ' + JSON.stringify(PM.getHeaderText({ variant: 'even' })) && false));
  await ta('export: settings.xml has <w:evenAndOddHeaders> + headerReference type="even" with EvenHdr', async () => {
    const { parts, doc } = await exp();
    const settings = String(parts['word/settings.xml'] || '');
    if (!/<w:evenAndOddHeaders\b/.test(settings)) return 'no <w:evenAndOddHeaders> in settings.xml' && false;
    if (!/<w:headerReference\b[^>]*\bw:type="even"/.test(doc)) return 'no headerReference type="even"' && false;
    const even = Object.entries(parts).find(([k, v]) => /header\d*\.xml$/i.test(k) && /EvenHdr/.test(String(v)));
    if (!even) return 'no header part with EvenHdr' && false;
    return 'evenAndOddHeaders + even ref present';
  });

  // Toggle OFF clears each flag (round-trip both directions).
  t('setDifferentFirstPage(false) clears the flag', () => { PM.setDifferentFirstPage(false); return PM.getHeaderFooterOptions().differentFirstPage === false ? 'cleared' : ('still on' && false); });
  t('setDifferentOddEven(false) clears the flag', () => { PM.setDifferentOddEven(false); return PM.getHeaderFooterOptions().differentOddEven === false ? 'cleared' : ('still on' && false); });
  await ta('export after clear: no <w:titlePg> and no <w:evenAndOddHeaders>', async () => {
    const { parts, doc } = await exp();
    const settings = String(parts['word/settings.xml'] || '');
    if (/<w:titlePg\b/.test(doc)) return 'titlePg still present after clear' && false;
    if (/<w:evenAndOddHeaders\b/.test(settings)) return 'evenAndOddHeaders still present after clear' && false;
    return 'both flags cleared';
  });

  // Painted first-page band (paged only): with titlePg on + first content authored, page 1's
  // header band reflects the FIRST variant (a blank doc is a single page == the first page).
  if (mode === 'paged') {
    await ta('paged paint: page-1 header band reflects the first-page variant', async () => {
      try { await PM.newBlank(); } catch (e) {}
      await sleep(140);
      PM.setDifferentFirstPage(true);
      PM.setHeaderText('PaintFirst', { variant: 'first' });
      PM.setHeaderText('PaintPrimary', { variant: 'default' });
      await sleep(400);
      const band = document.querySelector('.superdoc-page .superdoc-page-header');
      const txt = band ? (band.textContent || '') : '';
      return /PaintFirst/.test(txt) ? 'first-variant painted on page 1' : ('page-1 band="' + txt.slice(0, 48) + '" (expected PaintFirst)' && false);
    });
  }

  // ─── P3 (002): page-number PAGE field ───────────────────────────────────────────────────
  // The bridge inserts a REAL OOXML PAGE field (fldChar/instrText) via the slot story-runtime —
  // the export + real Word resolve it per page (the COM oracle proves wdFieldPage=33 → the page
  // number). NOTE: the paged PE does NOT resolve a freshly-inserted footer field's number IN-APP
  // (it renders the empty resolvedNumber as "0") — that per-page paint is a fork-gated limitation
  // (Word + a reopen render the correct number). So the probe asserts the FIELD (not a painted
  // digit); per-page-number correctness is the oracle's job (test:roundtrip:paged C3).
  t('P3 verbs present (insertPageNumber/removePageNumbers)', () => ['insertPageNumber', 'removePageNumbers'].every((k) => typeof PM[k] === 'function'));
  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  t('insertPageNumber({position:"bottom"}) accepted', () => PM.insertPageNumber({ position: 'bottom' }) === true);
  await sleep(240);
  await ta('export: footer carries a REAL PAGE field (fldChar begin + instrText PAGE), not static text', async () => {
    const { parts } = await exp();
    const ftr = Object.entries(parts).find(([k, v]) => /footer\d*\.xml$/i.test(k) && /<w:ftr\b/.test(String(v)) && /<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/.test(String(v)) && /<w:fldChar\b[^>]*\bw:fldCharType="begin"/.test(String(v)));
    return ftr ? ('real PAGE field (' + ftr[0] + ')') : ('no footer part with a real PAGE field' && false);
  });
  results.push({ name: 'INFO: in-app footer band after insert (fork-gated per-page paint; Word resolves correctly)', pass: true, detail: 'band="' + ((document.querySelector('.superdoc-page .superdoc-page-footer') || {}).textContent || '').trim() + '"' });
  t('insertPageNumber({position:"top"}) targets the header', () => PM.insertPageNumber({ position: 'top' }) === true);
  await sleep(200);
  await ta('export: header ALSO carries a PAGE field', async () => {
    const { parts } = await exp();
    const hdr = Object.entries(parts).find(([k, v]) => /header\d*\.xml$/i.test(k) && /<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/.test(String(v)));
    return hdr ? 'header PAGE field present' : ('no header PAGE field' && false);
  });
  t('removePageNumbers() accepted', () => PM.removePageNumbers() === true);
  await sleep(220);
  await ta('export after remove: no PAGE field in any header/footer part', async () => {
    const { parts } = await exp();
    const still = Object.entries(parts).some(([k, v]) => /(header|footer)\d*\.xml$/i.test(k) && /<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/.test(String(v)));
    return still ? ('a PAGE field remains after remove' && false) : 'page numbers cleared';
  });
  // removePageNumbers must NOT wipe an unrelated header title (the slotHasPageField guard).
  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  t('guard setup: header="KeepTitle" + a footer page number', () => { PM.setHeaderText('KeepTitle'); return PM.insertPageNumber({ position: 'bottom' }) === true; });
  await sleep(220);
  t('removePageNumbers() preserves the header title (only clears page-number bands)', () => { PM.removePageNumbers(); return PM.getHeaderText() === 'KeepTitle' ? 'title preserved' : ('header now ' + JSON.stringify(PM.getHeaderText()) && false); });

  try { await PM.newBlank(); } catch (e) {} // teardown: reset global header/footer state
  return done();
})();
