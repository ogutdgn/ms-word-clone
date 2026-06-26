/* 020 — author a docx whose paragraph text carries a gradient text fill (textStyle.textGradient → w14:textFill)
   for Word-COM read-back: Word's Range.Font.Fill.Type should read msoFillGradient (3) + 2 gradient stops. */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const ed = window.WC.editor; const PM = window.WC.PM;
  ed.commands.selectAll(); ed.commands.insertContent('<p>GRADIENT</p>'); ed.commands.selectAll(); ed.commands.unsetAllMarks(); await sleep(60);
  ed.commands.selectAll();
  PM.cmd('setMark', 'textStyle', { textGradient: { type: 'linear', angle: 90, stops: [{ pos: 0, color: '#FF0000' }, { pos: 1, color: '#0000FF' }] } });
  await sleep(60);
  let detail;
  try {
    const bytes = await PM.exportDocxBytes();
    const s = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-gradient.docx', bytes });
    detail = (s && s.ok) ? 'saved' : 'save failed: ' + JSON.stringify(s);
  } catch (e) { detail = 'ERR ' + e.message; }
  return JSON.stringify({ results: [{ name: 'author gradient', pass: /saved/.test(detail), detail }] }, null, 2);
})();
