/* Phase 4d table page-positioning oracle probe: a SINGLE table set LEFT-aligned + indented 0.5" via
   the new tableSetIndent (and tableSetAlignment), exported. Word's COM must OPEN it (proving the
   w:tblPr child order is schema-valid — w:jc/w:tblInd before w:tblLook) and report
   Tables(1).Rows(1).LeftIndent ≈ 36pt (0.5") and Rows.Alignment = wdAlignRowLeft(0).

   Validated 2026-06-16: align=center reads back as Rows.Alignment=1 and indent 0.5" as LeftIndent=36pt
   (each on its OWN single-table doc). NOTE: a doc with 2+ tables exports Word-CORRUPT — a SEPARATE,
   pre-existing base-export bug (reproduces with two PLAIN tables, no positioning) — so this probe uses
   a single table. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc, view = () => window.WC.view;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>tablepos</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(170);
    let p = null; doc().descendants((n, pos) => { if (n.type.name === 'table' && p == null) p = pos; });
    view().dispatch(view().state.tr.setSelection(window.__PM_TextSelection.near(view().state.doc.resolve(p + 2))));
    await sleep(40);
    PM().tableSetAlignment('left'); PM().tableSetIndent(48); await sleep(160);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.tblIndCount = (xml.match(/<w:tblInd\b[^>]*w:w="720"/g) || []).length;
    const bytes = await PM().exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    const filePath = ['C:', 'tmp', 'wc-tablepos.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
