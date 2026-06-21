/* Paged Open/New regression probe (mode-aware). Proves WC.PM.openDocx + WC.PM.newBlank work in PAGED mode — they used
   to be DEAD there: replaceEditor (index.ts) is mode-blind, so it destroyed the PE's inner editor + wiped the painted
   pages and rebuilt a plain editor no PE drives (open/new → blank forever). The fix adds a paged branch that loads the
   doc INTO the live PE via inner.replaceFile (a replaceWith transaction the PE repaints IN PLACE), preserving the PE +
   bridge + 6 overlays. Self-contained: authors ALPHA → exports its bytes → changes the live doc to BETA → openDocx(ALPHA)
   and asserts the content swapped back + the PE was preserved + the bridge still works; then newBlank → clean doc.
   Overlay runs the same open/new flow (the paged branch must NOT fire) as a parity guard. {summary, results[]} contract.
     WC_LAYOUT=paged npm run build && electron --user-data-dir=C:/tmp/wc-probe-profile --disable-http-cache . \
       --probe-out=/tmp/wc-opennew.json --shot-evalfile=scripts/paged-opennew-probe.js */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  await sleep(300);
  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const ed = () => W.editor;
  const painted = () => (mode === 'paged' ? document.querySelectorAll('.superdoc-page').length > 0 : !!document.querySelector('#pm-editor .ProseMirror'));
  const allText = () => (mode === 'paged' ? Array.from(document.querySelectorAll('.superdoc-page')).map((p) => p.textContent || '').join(' ') : (document.querySelector('#pm-editor .ProseMirror') || {}).textContent || '');
  const waitFor = async (pred) => { for (let i = 0; i < 140; i++) { if (pred()) return i * 50; await sleep(50); } return -1; };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('WC.PM.openDocx + newBlank + exportDocxBytes present', () => typeof W.PM.openDocx === 'function' && typeof W.PM.newBlank === 'function' && typeof W.PM.exportDocxBytes === 'function');
  if (!ok || !painted()) { const p0 = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p0, fail: results.length - p0, mode }, results }, null, 2); }

  // author ALPHA, capture its exported bytes, then change the LIVE doc to BETA
  try { ed().chain().selectAll().clearNodes().insertContent('FIXTUREALPHA alpha bravo charlie delta echo foxtrot golf hotel india juliet.').run(); } catch (e) {}
  await sleep(250);
  let alphaBytes = null; try { alphaBytes = await W.PM.exportDocxBytes(); } catch (e) {}
  try { ed().chain().selectAll().clearNodes().insertContent('FIXTUREBETA beta the live doc is now different content entirely.').run(); } catch (e) {}
  await sleep(250);
  const presBefore = W.presentation;
  t('setup: ALPHA exported + live doc now shows BETA (not ALPHA)', () => alphaBytes && alphaBytes.byteLength > 0 && /FIXTUREBETA/.test(allText()) && !/FIXTUREALPHA/.test(allText()) ? 'ok' : ('alphaBytes=' + (alphaBytes && alphaBytes.byteLength) + ' text=' + allText().slice(0, 30) && false));

  // === OPEN: WC.PM.openDocx(ALPHA) → the doc must swap back to ALPHA, still painted ===
  let ok1 = null; try { ok1 = await W.PM.openDocx(alphaBytes); } catch (e) { results.push({ name: 'openDocx threw', pass: false, detail: (e && e.message) || String(e) }); }
  const openMs = await waitFor(() => painted() && /FIXTUREALPHA/.test(allText()) && !/FIXTUREBETA/.test(allText()));
  t('openDocx returned true', () => ok1 === true);
  t('openDocx loaded ALPHA (content swapped, BETA gone, page still painted) [' + openMs + 'ms]', () => openMs >= 0 && painted() ? ('repaint ' + openMs + 'ms') : ('text=' + allText().slice(0, 40) && false));
  if (mode === 'paged') t('paged: PE preserved IN PLACE (same WC.presentation object — not reconstructed)', () => W.presentation === presBefore);

  // bridge + export must still work after the swap
  try { ed().commands.insertContent(' ZZTYPED'); } catch (e) {}
  await sleep(250);
  t('bridge works after open (typed text lands in the doc)', () => /ZZTYPED/.test(allText()));
  let eb = null; try { eb = await W.PM.exportDocxBytes(); } catch (e) {}
  t('export round-trips after open (valid .docx)', () => eb && eb.byteLength > 0 && eb[0] === 0x50 && eb[1] === 0x4b ? ('bytes=' + eb.byteLength) : false);

  // === NEW: WC.PM.newBlank → a clean blank doc, prior content gone ===
  let ok2 = null; try { ok2 = await W.PM.newBlank(); } catch (e) { results.push({ name: 'newBlank threw', pass: false, detail: (e && e.message) || String(e) }); }
  const blankMs = await waitFor(() => painted() && !/FIXTUREALPHA|ZZTYPED/.test(allText()));
  t('newBlank returned true', () => ok2 === true);
  t('newBlank → clean blank doc (prior content gone, page painted) [' + blankMs + 'ms]', () => blankMs >= 0 && painted() ? ('blank ' + blankMs + 'ms') : ('text=' + allText().slice(0, 40) && false));
  if (mode === 'paged') t('paged: PE still preserved after newBlank', () => W.presentation === presBefore);
  try { ed().commands.insertContent('AFTERBLANK'); } catch (e) {}
  await sleep(250);
  t('bridge works after newBlank (typed text lands)', () => /AFTERBLANK/.test(allText()));

  // === HTML leg: WC.PM.openHtml → replaceEditor(blank, {html}) → the paged branch's replaceFile(blank) + insertContent ===
  if (typeof W.PM.openHtml === 'function') {
    let ok3 = null; try { ok3 = await W.PM.openHtml('<p>HTMLMARKER imported via openHtml into the paged engine here.</p>'); } catch (e) { results.push({ name: 'openHtml threw', pass: false, detail: (e && e.message) || String(e) }); }
    const htmlMs = await waitFor(() => painted() && /HTMLMARKER/.test(allText()) && !/AFTERBLANK/.test(allText()));
    t('openHtml returned true', () => ok3 === true);
    t('openHtml loaded the markup (HTMLMARKER appears, page painted) [' + htmlMs + 'ms]', () => htmlMs >= 0 && painted() ? ('html ' + htmlMs + 'ms') : ('text=' + allText().slice(0, 40) && false));
    if (mode === 'paged') t('paged: PE still preserved after openHtml', () => W.presentation === presBefore);
  }

  const p = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2);
})();
