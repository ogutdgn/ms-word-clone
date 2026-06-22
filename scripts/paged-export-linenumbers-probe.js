/* 004 Line-Numbers export probe (mode-aware). The driver (test-roundtrip-paged.js) runs it under
   WC_LAYOUT=paged. It authors a Continuous-line-numbers doc (body + sectPr/w:lnNumType restart=continuous,
   countBy 2, start-at 5 user-facing ⇒ raw w:start=4) with one SUPPRESSME paragraph carrying
   pPr/w:suppressLineNumbers, and saves it to C:/tmp/wc-<mode>-linenumbers.docx for validate-linenumbers-win.ps1
   (real Word PageSetup.LineNumbering read-back: Active/RestartMode/CountBy/StartingNumber + the suppressed flag). */
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
  const ok = t('verbs present (setLineNumbers + suppressLineNumbers + exportDocxBytes + wordAPI.saveBytes)', () => (typeof PM.setLineNumbers === 'function' && typeof PM.suppressLineNumbers === 'function' && typeof PM.exportDocxBytes === 'function' && typeof PM.newBlank === 'function' && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) return summary();

  try { await PM.newBlank(); } catch (e) {}
  await sleep(140);
  // Body paragraphs for line numbering; the LAST one (SUPPRESSME) is the suppress target — the caret lands in it
  // after insert, so suppressing the "current" paragraph is deterministic. Earlier paragraphs are multi-sentence
  // so the page carries several numbered body lines.
  let body = '';
  for (let p = 1; p <= 4; p++) { let s = ''; for (let i = 1; i <= 12; i++) s += 'numbered body word ' + i + ' lorem ipsum dolor sit. '; body += '<p>' + s + '</p>'; }
  body += '<p>SUPPRESSME this paragraph is excluded from line numbering in Word.</p>';
  try { W.editor.commands.insertContent(body); } catch (e) {}
  await sleep(220);
  // Continuous, countBy 2, start-at 5 (USER-FACING ⇒ the bridge writes raw w:start=4; Word reads StartingNumber=5).
  // replace:true mirrors the Options-dialog full-set apply.
  t('setLineNumbers({mode:"continuous", countBy:2, start:5}) accepted', () => PM.setLineNumbers({ mode: 'continuous', countBy: 2, start: 5, replace: true }) === true);
  await sleep(300);
  t('model: getLineNumbers().active && mode==="continuous" && start===5', () => { const g = PM.getLineNumbers(); return (g.active === true && g.mode === 'continuous' && g.start === 5) ? 'on' : ('got ' + JSON.stringify(g) && false); });
  // Suppress the current (SUPPRESSME) paragraph → pPr/w:suppressLineNumbers.
  t('suppressLineNumbers() on the marker paragraph accepted', () => PM.suppressLineNumbers(true) === true);
  await sleep(200);
  t('model: currentParagraphSuppressed() === true', () => PM.currentParagraphSuppressed() === true ? 'suppressed' : ('got ' + PM.currentParagraphSuppressed() && false));

  let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-' + mode + '-linenumbers.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  window.__lnSaved = saved && saved.path;
  t('saveBytes wrote the .docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));

  try { await PM.newBlank(); } catch (e) {}
  return summary();
})();
