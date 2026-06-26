/* 016 — author a docx with Exactly-18pt line spacing + a 0.5" first-line indent on para 1,
   and At-least-14pt on para 2, for COM read-back (ParagraphFormat.LineSpacingRule/LineSpacing/
   FirstLineIndent). Applies via the bridge for determinism. */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const ed = window.WC.editor; const PM = window.WC.PM; const TS = window.__PM_TextSelection;
  const sel = (w) => { let f = null; ed.state.doc.descendants((n, p) => { if (f || !n.isText || !n.text) return; const i = n.text.indexOf(w); if (i >= 0) f = { from: p + i, to: p + i + w.length }; }); ed.view.dispatch(ed.view.state.tr.setSelection(TS.create(ed.state.doc, f.from, f.to))); };
  ed.commands.selectAll(); ed.commands.insertContent('<p>ExactPara</p><p>AtLeastPara</p>'); ed.commands.selectAll(); ed.commands.unsetAllMarks(); await sleep(60);
  sel('ExactPara'); ed.commands.updateAttributes('paragraph', { 'paragraphProperties.spacing.line': 360, 'paragraphProperties.spacing.lineRule': 'exact', 'paragraphProperties.indent.firstLine': 720, 'paragraphProperties.contextualSpacing': true }); await sleep(40);
  sel('AtLeastPara'); ed.commands.updateAttributes('paragraph', { 'paragraphProperties.spacing.line': 280, 'paragraphProperties.spacing.lineRule': 'atLeast' }); await sleep(40);
  let detail;
  try {
    const bytes = await PM.exportDocxBytes();
    const s = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-paragraph.docx', bytes });
    detail = (s && s.ok) ? 'saved' : 'save failed: ' + JSON.stringify(s);
  } catch (e) { detail = 'ERR ' + e.message; }
  return JSON.stringify({ results: [{ name: 'author paragraph', pass: /saved/.test(detail), detail }] }, null, 2);
})();
