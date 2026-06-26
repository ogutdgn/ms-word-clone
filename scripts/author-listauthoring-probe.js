/* 017 — author two docx fixtures for Word-COM read-back of the list-authoring fidelity claims:
   (1) wc-listauthoring-snv.docx — a 3-item numbered list with Set Numbering Value 5 on the first item
       (NO-FORK: restartNumbering + ListHelpers.setLvlOverride startOverride=5). COM: para1 ListValue==5.
   (2) wc-listauthoring-dnf.docx — a list with a Define-New-Number-Format definition (lowerLetter "%1)")
       via applyListDefinition. COM: para1 ListString=="a)".
   Applies via the bridge for determinism (the same verbs the dialogs dispatch). */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const ed = window.WC.editor; const PM = window.WC.PM; const TS = window.__PM_TextSelection;
  const sel = (w) => {
    let f = null;
    ed.state.doc.descendants((n, p) => { if (f || !n.isText || !n.text) return; const i = n.text.indexOf(w); if (i >= 0) f = { from: p + i, to: p + i + w.length }; });
    ed.view.dispatch(ed.view.state.tr.setSelection(TS.create(ed.state.doc, f.from, f.to)));
  };
  const reset = (html) => { ed.commands.selectAll(); ed.commands.insertContent(html); ed.commands.selectAll(); ed.commands.unsetAllMarks(); ed.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']); };
  const save = async (file) => { const bytes = await PM.exportDocxBytes(); const s = await window.wordAPI.saveBytes({ filePath: file, bytes }); return !!(s && s.ok); };
  const results = [];
  try {
    // (1) Set Numbering Value 5 on the first item of a numbered list.
    reset('<p>SNVitem1</p><p>SNVitem2</p><p>SNVitem3</p>'); await sleep(80);
    ed.commands.selectAll(); PM.cmd('toggleOrderedList'); await sleep(150);
    sel('SNVitem1'); const ok1 = PM.setNumberingValue(5); await sleep(150);
    results.push({ name: 'setNumberingValue(5)', pass: ok1 === true, detail: 'ok=' + ok1 });
    results.push({ name: 'save snv', pass: await save('C:/tmp/wc-listauthoring-snv.docx'), detail: '' });

    // (2) Define New Number Format: lowerLetter "%1)".
    reset('<p>DNFitem1</p><p>DNFitem2</p>'); await sleep(80);
    ed.commands.selectAll(); PM.cmd('applyListDefinition', { listType: 'orderedList', levels: [{ fmt: 'lowerLetter', text: '%1)' }] }); await sleep(150);
    results.push({ name: 'save dnf', pass: await save('C:/tmp/wc-listauthoring-dnf.docx'), detail: '' });
  } catch (e) {
    results.push({ name: 'author', pass: false, detail: 'ERR ' + (e && e.message) });
  }
  return JSON.stringify({ results }, null, 2);
})();
