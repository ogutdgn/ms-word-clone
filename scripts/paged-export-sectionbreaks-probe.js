/* 006 Section-Breaks export probe (mode-aware). The driver (test-roundtrip-paged.js) runs it under
   WC_LAYOUT=paged. It authors TWO docs — a Next-Page section break and a Continuous section break — and saves
   them (C:/tmp/wc-<mode>-sectionbreaks.docx + …-sectionbreaks-cont.docx) for validate-sectionbreaks-win.ps1
   (real Word Sections.Count + each PageSetup.SectionStart read-back). */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const ta = async (name, fn) => { try { const r = await fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const ed = W.editor;
  const mode = window.__WC_LAYOUT_MODE;
  const summary = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode, saved: window.__sbSaved }, results }, null, 2); };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present (insertSectionBreak + exportDocxBytes + wordAPI.saveBytes)', () => (typeof PM.insertSectionBreak === 'function' && typeof PM.exportDocxBytes === 'function' && typeof PM.newBlank === 'function' && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) return summary();

  window.__sbSaved = {};
  const caretToPara2 = () => { let p = null, c = 0; ed.state.doc.descendants((n, pos) => { if (n.type.name === 'paragraph') { c++; if (c === 2) { p = pos + 1; return false; } } return true; }); if (p != null) { try { ed.commands.setTextSelection({ from: p, to: p }); } catch (e) {} } return p; };
  const authorAndSave = async (type, file) => {
    try { await PM.newBlank(); } catch (e) {}
    await sleep(150);
    try { ed.commands.insertContent('<p>Section one paragraph alpha beta gamma.</p><p>Section one paragraph delta epsilon.</p><p>Section two paragraph zeta eta.</p><p>Section two paragraph theta iota.</p>'); } catch (e) {}
    await sleep(260);
    caretToPara2();
    t('insertSectionBreak("' + type + '") accepted', () => PM.insertSectionBreak(type) === true);
    await sleep(200);
    let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
    t(type + ': exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
    let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: file, bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
    window.__sbSaved[type] = saved && saved.path;
    t(type + ': saveBytes wrote ' + file, () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));
  };

  await authorAndSave('nextPage', 'C:/tmp/wc-' + mode + '-sectionbreaks.docx');
  await authorAndSave('continuous', 'C:/tmp/wc-' + mode + '-sectionbreaks-cont.docx');

  try { await PM.newBlank(); } catch (e) {}
  return summary();
})();
