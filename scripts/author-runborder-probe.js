/* 019 — author a docx with a run-level (character) border on a sub-paragraph run for Word-COM read-back.
   The fidelity contract is that Word ACCEPTS the rPr/<w:bdr> without repair (character borders have no clean
   COM read property); validate-runborder-win.ps1 opens it (OpenAndRepair off) + reads the bordered run text. */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const ed = window.WC.editor; const PM = window.WC.PM; const TS = window.__PM_TextSelection;
  const sel = (w) => {
    let f = null;
    ed.state.doc.descendants((n, p) => { if (f || !n.isText || !n.text) return; const i = n.text.indexOf(w); if (i >= 0) f = { from: p + i, to: p + i + w.length }; });
    ed.view.dispatch(ed.view.state.tr.setSelection(TS.create(ed.state.doc, f.from, f.to)));
  };
  ed.commands.selectAll(); ed.commands.insertContent('<p>Plain RBORD bordered tail</p>'); ed.commands.selectAll(); ed.commands.unsetAllMarks(); await sleep(60);
  sel('RBORD'); PM.cmd('setMark', 'textStyle', { borders: { val: 'single', size: 12, color: 'FF0000', space: 1 } }); await sleep(60);
  let detail;
  try {
    const bytes = await PM.exportDocxBytes();
    const s = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-runborder.docx', bytes });
    detail = (s && s.ok) ? 'saved' : 'save failed: ' + JSON.stringify(s);
  } catch (e) { detail = 'ERR ' + e.message; }
  return JSON.stringify({ results: [{ name: 'author runborder', pass: /saved/.test(detail), detail }] }, null, 2);
})();
