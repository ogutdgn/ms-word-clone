/* 015 — author a docx with one advanced effect per paragraph, save for COM read-back.
   p1 smallCaps, p2 allCaps, p3 spacing +2pt, p4 position +3pt, p5 scale 150%.
   Settle generously between applies (a mark can split the run → shift later positions). */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const ed = window.WC.editor; const PM = window.WC.PM; const TS = window.__PM_TextSelection;
  const selTexts = [];
  const apply = async (w, fx) => {
    let f = null; ed.state.doc.descendants((n, p) => { if (f || !n.isText || !n.text) return; const i = n.text.indexOf(w); if (i >= 0) f = { from: p + i, to: p + i + w.length }; });
    if (!f) { selTexts.push(w + '=>NOT-FOUND'); return; }
    ed.view.dispatch(ed.view.state.tr.setSelection(TS.create(ed.state.doc, f.from, f.to)));
    selTexts.push(w + '=>' + ed.state.doc.textBetween(f.from, f.to));
    PM.setAdvancedFontEffects(fx); await sleep(160);
  };
  ed.commands.selectAll();
  ed.commands.insertContent('<p>Alpha</p><p>Bravo</p><p>Charlie</p><p>Delta</p><p>Echo</p>');
  ed.commands.selectAll(); ed.commands.unsetAllMarks(); await sleep(160);
  await apply('Alpha', { smallCaps: true });
  await apply('Bravo', { allCaps: true });
  await apply('Charlie', { spacingPt: 2 });
  await apply('Delta', { positionPt: 3 });
  await apply('Echo', { scalePct: 150 });
  let detail;
  try {
    const bytes = await PM.exportDocxBytes();
    const s = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-fonteffects.docx', bytes });
    detail = (s && s.ok) ? 'saved' : 'save failed: ' + JSON.stringify(s);
  } catch (e) { detail = 'ERR ' + e.message; }
  return JSON.stringify({ results: [{ name: 'author 5 effects', pass: /saved/.test(detail), detail, selTexts }] }, null, 2);
})();
