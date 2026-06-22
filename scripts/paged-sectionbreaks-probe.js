/* 006 Section Breaks probe (mode-agnostic). Run via:
     npm run probe:sectionbreaks   (paged build) — and again after WC_LAYOUT=overlay npm run build for parity.

   Proves the wiring: WC.PM.insertSectionBreak(type) splits the document via a real paragraph pPr/w:sectPr
   (spike-proven: real Word reads Sections.Count==2). nextPage = bare sectPr; the other types add w:type. The
   write is export-level (the paged PE doesn't repaginate in-app), so paged and overlay behave identically.
   Convention: detail STRING on success, `(... && false)` on failure. */
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
  const ed = W.editor;
  const docXml = async () => { try { const parts = await ed.exportDocx({ getUpdatedDocs: true }); return String(parts['word/document.xml'] || ''); } catch (e) { return ''; } };
  const sectPrCount = (d) => (d.match(/<w:sectPr\b/g) || []).length;
  // does a mid-doc sectPr (inside a w:pPr) exist?
  const hasParaSectPr = (d) => /<w:pPr>[\s\S]*?<w:sectPr\b/.test(d);
  const author = async () => { try { await PM.newBlank(); } catch (e) {} await sleep(160); try { ed.commands.insertContent('<p>SEC1 alpha beta gamma.</p><p>SEC1 delta epsilon.</p><p>SEC2 zeta eta.</p><p>SEC2 theta.</p>'); } catch (e) {} await sleep(260); };
  const caretToPara2 = () => { let p = null, c = 0; ed.state.doc.descendants((n, pos) => { if (n.type.name === 'paragraph') { c++; if (c === 2) { p = pos + 1; return false; } } return true; }); if (p != null) { try { ed.commands.setTextSelection({ from: p, to: p }); } catch (e) {} } return p; };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('verb present (insertSectionBreak) + insertContent + exportDocx', () => (typeof PM.insertSectionBreak === 'function' && ed && ed.commands && typeof ed.commands.insertContent === 'function' && typeof ed.exportDocx === 'function') || ('missing' && false));
  if (!ok) return done();

  // ── baseline: a fresh single-section doc has exactly ONE sectPr (the trailing body sectPr) ──
  await author();
  await ta('baseline: single-section doc has exactly 1 <w:sectPr>', async () => { const n = sectPrCount(await docXml()); return n === 1 ? 'one' : ('count=' + n && false); });

  // ── Next Page: a bare paragraph sectPr → 2 sectPr (mid-doc in a w:pPr) ──
  await author(); caretToPara2();
  t('insertSectionBreak("nextPage") accepted', () => PM.insertSectionBreak('nextPage') === true);
  await sleep(150);
  await ta('export: 2 <w:sectPr> after the break (mid-doc one inside a w:pPr)', async () => { const d = await docXml(); return (sectPrCount(d) === 2 && hasParaSectPr(d)) ? 'two+pPr' : ('count=' + sectPrCount(d) + ' pPr=' + hasParaSectPr(d) && false); });
  // The mid-doc break sectPr is EMPTY/self-closing (<w:sectPr/>); the BODY sectPr (the section after the break)
  // carries pgSz/pgMar and — for typed breaks — the w:type. So Next Page ⇒ NO <w:type> anywhere.
  await ta('export: Next Page ⇒ NO <w:type> anywhere (Word default = NewPage) + an empty mid-doc <w:sectPr/>', async () => { const d = await docXml(); const midEmpty = /<w:pPr>[\s\S]*?<w:sectPr\s*\/>/.test(d); return (!/<w:type\b/.test(d) && midEmpty) ? 'no type + empty mid' : ('type=' + /<w:type\b/.test(d) + ' midEmpty=' + midEmpty && false); });

  // ── the typed variants: w:type on the BODY sectPr (the section after the break) ──
  for (const [type, val] of [['continuous', 'continuous'], ['evenPage', 'evenPage'], ['oddPage', 'oddPage']]) {
    await author(); caretToPara2();
    t('insertSectionBreak("' + type + '") accepted', () => PM.insertSectionBreak(type) === true);
    await sleep(150);
    await ta('export: 2 sectPr + <w:type w:val="' + val + '"> on the body sectPr (mid-doc break empty)', async () => {
      const d = await docXml();
      const re = new RegExp('<w:type[^>]*w:val="' + val + '"');
      // the mid-doc break sectPr is empty (<w:sectPr/>), so any w:type necessarily lands on the BODY sectPr.
      const midEmpty = /<w:pPr>[\s\S]*?<w:sectPr\s*\/>/.test(d);
      return (sectPrCount(d) === 2 && re.test(d) && midEmpty) ? (type + ' ok') : ('count=' + sectPrCount(d) + ' type=' + re.test(d) + ' midEmpty=' + midEmpty && false);
    });
  }

  // ── v1 guard (review): a TYPED break writes w:type to the BODY sectPr (types only the last section), so a 2nd+
  //    TYPED break would corrupt the 1st → it is REFUSED (returns false). A 2nd nextPage break IS allowed (bare). ──
  await author(); caretToPara2();
  t('setup: a 1st continuous break is accepted', () => PM.insertSectionBreak('continuous') === true);
  await sleep(120);
  const para3 = () => { let p = null, c = 0; ed.state.doc.descendants((n, pos) => { if (n.type.name === 'paragraph') { c++; if (c === 3) { p = pos + 1; return false; } } return true; }); if (p != null) { try { ed.commands.setTextSelection({ from: p, to: p }); } catch (e) {} } return p; };
  t('v1 guard: a 2nd TYPED break (oddPage) is REFUSED (returns false, no silent corruption)', () => { para3(); return PM.insertSectionBreak('oddPage') === false; });
  t('v1 guard: a 2nd nextPage break IS allowed (returns true)', () => { para3(); return PM.insertSectionBreak('nextPage') === true; });
  await ta('export after the guard: still 3 <w:sectPr> (1st continuous typed on body + 2 mid-doc breaks)', async () => { const d = await docXml(); return sectPrCount(d) === 3 ? 'three' : ('count=' + sectPrCount(d) && false); });

  try { await PM.newBlank(); } catch (e) {} // teardown
  return done();
})();
