/* 005 Hyphenation probe (mode-agnostic). Run via:
     npm run probe:hyphenation   (paged build) — and again after WC_LAYOUT=overlay npm run build for parity.

   Proves the Hyphenation wiring: WC.PM.setHyphenation writes real document-level settings.xml
   (w:autoHyphenation / w:hyphenationZone / w:consecutiveHyphenLimit / w:doNotHyphenateCaps) via the owned
   converter write, getHyphenation() round-trips, and the CAPS toggle is correctly inverted + clean-clears.
   The write is converter-level (not render) so paged and overlay behave identically. Convention: detail STRING
   on success, `(... && false)` on failure. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const ta = async (name, fn) => { try { const r = await fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const mode = window.__WC_LAYOUT_MODE;
  const done = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); };

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const settings = async () => { try { const parts = await W.editor.exportDocx({ getUpdatedDocs: true }); return String(parts['word/settings.xml'] || ''); } catch (e) { return ''; } };
  const docXml = async () => { try { const parts = await W.editor.exportDocx({ getUpdatedDocs: true }); return String(parts['word/document.xml'] || ''); } catch (e) { return ''; } };
  const autoTag = (s) => (s.match(/<w:autoHyphenation\b[^>]*>/) || [''])[0];

  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present (setHyphenation/getHyphenation/applyManualHyphenation + exportDocx)', () => (typeof PM.setHyphenation === 'function' && typeof PM.getHyphenation === 'function' && typeof PM.applyManualHyphenation === 'function' && typeof PM.newBlank === 'function' && W.editor && typeof W.editor.exportDocx === 'function') || ('missing' && false));
  if (!ok) return done();

  try { await PM.newBlank(); } catch (e) {}
  await sleep(150);

  // ── Automatic ──
  t('setHyphenation({mode:"auto"}) accepted', () => PM.setHyphenation({ mode: 'auto' }) === true);
  await ta('export: <w:autoHyphenation w:val="true">', async () => { const s = await settings(); return /<w:autoHyphenation[^>]*w:val="true"/.test(s) ? 'on' : ('tag=' + autoTag(s) && false); });
  t('getHyphenation().auto === true', () => { const g = PM.getHyphenation(); return g.auto === true ? 'auto' : ('got ' + JSON.stringify(g) && false); });

  // ── None (explicit false, replaced not duplicated) ──
  t('setHyphenation({mode:"none"}) accepted', () => PM.setHyphenation({ mode: 'none' }) === true);
  await ta('export: single <w:autoHyphenation w:val="false"> (replaced)', async () => { const s = await settings(); const all = s.match(/<w:autoHyphenation\b[^>]*>/g) || []; return (all.length === 1 && /w:val="false"/.test(all[0])) ? ('tag=' + all[0]) : ('matches=' + JSON.stringify(all) && false); });
  t('getHyphenation().auto === false after None', () => PM.getHyphenation().auto === false ? 'off' : ('still ' + JSON.stringify(PM.getHyphenation()) && false));

  // ── Options: zone (inches→twips) ──
  t('setHyphenation({mode:"auto", zone:0.25}) accepted', () => PM.setHyphenation({ mode: 'auto', zone: 0.25 }) === true);
  await ta('export: w:hyphenationZone="360" (0.25in)', async () => { const s = await settings(); return /<w:hyphenationZone[^>]*w:val="360"/.test(s) ? 'zone=360' : ('missing; head=' + s.slice(0, 160) && false); });
  t('getHyphenation(): zone≈0.25 + zoneExplicit', () => { const g = PM.getHyphenation(); return (Math.abs(g.zone - 0.25) < 1e-6 && g.zoneExplicit === true) ? 'zone ok' : ('got ' + JSON.stringify(g) && false); });

  // ── Options: consecutive-hyphen limit ──
  t('setHyphenation({consecutiveLimit:2}) accepted', () => PM.setHyphenation({ consecutiveLimit: 2 }) === true);
  await ta('export: w:consecutiveHyphenLimit="2"', async () => { const s = await settings(); return /<w:consecutiveHyphenLimit[^>]*w:val="2"/.test(s) ? 'limit=2' : ('missing' && false); });
  t('getHyphenation(): consecutiveLimit===2 + limitExplicit', () => { const g = PM.getHyphenation(); return (g.consecutiveLimit === 2 && g.limitExplicit === true) ? 'limit ok' : ('got ' + JSON.stringify(g) && false); });

  // ── Options: hyphenate CAPS (inverted ↔ w:doNotHyphenateCaps) + clean-clear carryover ──
  t('setHyphenation({hyphenateCaps:false}) accepted', () => PM.setHyphenation({ hyphenateCaps: false }) === true);
  await ta('export: <w:doNotHyphenateCaps/> present (CAPS off)', async () => { const s = await settings(); return /<w:doNotHyphenateCaps\b/.test(s) ? 'present' : ('absent' && false); });
  t('getHyphenation().hyphenateCaps === false', () => PM.getHyphenation().hyphenateCaps === false ? 'caps off' : ('got ' + JSON.stringify(PM.getHyphenation()) && false));
  t('setHyphenation({hyphenateCaps:true}) accepted (carryover clear)', () => PM.setHyphenation({ hyphenateCaps: true }) === true);
  await ta('export: w:doNotHyphenateCaps REMOVED (clean-clear)', async () => { const s = await settings(); return /<w:doNotHyphenateCaps\b/.test(s) ? ('still present' && false) : 'removed'; });
  t('getHyphenation().hyphenateCaps === true after clear', () => PM.getHyphenation().hyphenateCaps === true ? 'caps on' : ('got ' + JSON.stringify(PM.getHyphenation()) && false));

  // ── CT_Settings ABSOLUTE placement: the hyphenation block must sit in its schema slot — after w:defaultTabStop,
  //    internally ordered, and BEFORE the first post-block element (w:characterSpacingControl). w:hyphenationZone is
  //    the one element the COM oracle CANNOT validate (Word's HyphenationZone is broken), and Word SKIPS it if
  //    misplaced — so this is the ONLY gate proving placeHyphenation positioned the block correctly (review). ──
  t('setHyphenation({mode:"auto", zone:0.25, consecutiveLimit:2}) (both, one call)', () => PM.setHyphenation({ mode: 'auto', zone: 0.25, consecutiveLimit: 2 }) === true);
  await ta('export: block in its CT_Settings slot (defaultTabStop < autoHyph < consecutiveLimit < zone < characterSpacingControl)', async () => {
    const s = await settings();
    const idt = s.indexOf('<w:defaultTabStop'); const iah = s.indexOf('<w:autoHyphenation'); const il = s.indexOf('<w:consecutiveHyphenLimit'); const iz = s.indexOf('<w:hyphenationZone'); const ics = s.indexOf('<w:characterSpacingControl');
    const ok = idt !== -1 && iah !== -1 && il !== -1 && iz !== -1 && idt < iah && iah < il && il < iz && (ics === -1 || iz < ics);
    return ok ? 'placed' : ('idt=' + idt + ' iah=' + iah + ' il=' + il + ' iz=' + iz + ' ics=' + ics && false);
  });

  // ── Options clear-on-null (the dialog's Auto / No-limit must REMOVE a prior value, not leave it stale — the
  //    004 partial-update carryover lesson; zone/limit are full-set per field) ──
  t('setHyphenation({zone:0.4, consecutiveLimit:3}) accepted', () => PM.setHyphenation({ zone: 0.4, consecutiveLimit: 3 }) === true);
  await ta('export: zone="576" (0.4in) + limit="3" present', async () => { const s = await settings(); return (/w:hyphenationZone[^>]*w:val="576"/.test(s) && /w:consecutiveHyphenLimit[^>]*w:val="3"/.test(s)) ? 'present' : ('head=' + s.slice(0, 200) && false); });
  t('setHyphenation({zone:null, consecutiveLimit:null}) accepted (clear)', () => PM.setHyphenation({ zone: null, consecutiveLimit: null }) === true);
  await ta('export: zone + limit REMOVED + getHyphenation *Explicit flags false', async () => { const s = await settings(); const g = PM.getHyphenation(); return (!/w:hyphenationZone\b/.test(s) && !/w:consecutiveHyphenLimit\b/.test(s) && g.zoneExplicit === false && g.limitExplicit === false) ? 'cleared' : ('s=' + s.slice(0, 160) + ' g=' + JSON.stringify(g) && false); });

  // ── P3 Manual: optional hyphens (U+00AD) into long words across MULTIPLE paragraphs / text nodes. This
  //    exercises the transaction position-MAPPING in applyManualHyphenation — an UNMAPPED pos would target the
  //    wrong range on the 2nd+ node (each padded replacement is longer than its source) and corrupt/throw,
  //    silently dropping the op (review finding). ──
  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  try { W.editor.commands.insertContent('<p>Internationalization alpha beta.</p><p>Counterproductive gamma delta.</p><p>Antidisestablishmentarianism epsilon.</p>'); } catch (e) {}
  await sleep(180);
  t('applyManualHyphenation() marks long words across 3 paragraphs (≥3)', () => { const n = PM.applyManualHyphenation(); return (typeof n === 'number' && n >= 3) ? ('marked=' + n) : ('got ' + JSON.stringify(n) && false); });
  await sleep(140);
  await ta('export: ≥3 optional hyphens + all 3 long words INTACT (no position-drift corruption)', async () => {
    const d = await docXml();
    const sh = (d.match(/­/g) || []).length + (d.match(/<w:softHyphen\b/g) || []).length;
    const clean = d.replace(/­/g, '').replace(/<w:softHyphen\b[^>]*\/?>/g, '');
    const intact = /Internationalization/.test(clean) && /Counterproductive/.test(clean) && /Antidisestablishmentarianism/.test(clean);
    return (sh >= 3 && intact) ? ('hyphens=' + sh + ' intact') : ('hyphens=' + sh + ' intact=' + intact && false);
  });

  try { await PM.newBlank(); } catch (e) {} // teardown
  return done();
})();
