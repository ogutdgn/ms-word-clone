/* Phase 4d w:tcPr child-ORDER oracle probe (Word-corruption guard, mirrors the PR #77 tblPr-order fix).
   A 2x2 table whose first cell gets borders + shading + vertical-align(middle). The exporter folds
   these into tableCellProperties in code order (borders migrated, then shading/vAlign at export), so
   without a schema sort the <w:tcPr> children come out OUT OF CT_TcPr ORDER (ECMA-376 §17.4.66):
   w:tcW(2) < w:tcBorders(6) < w:shd(7) < w:vAlign(12). Out of order => Word rejects the .docx as
   corrupt. Save the bytes so Word COM (Documents.Open) can confirm it opens WITHOUT repair. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const caretInCell0 = () => {
    let cp = null;
    doc().descendants((n, pos) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cp == null) cp = pos; });
    if (cp != null) ed().commands.setTextSelection(cp + 2);
  };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>tc</p>'); await sleep(60);
    PM().insertTable({ rows: 2, cols: 2 }); await sleep(200);
    caretInCell0(); out.setBorders = ed().commands.setCellBorders({ top: { val: 'single', color: '000000', size: 4 }, bottom: { val: 'single', color: '000000', size: 4 } }); await sleep(140);
    caretInCell0(); out.setShading = ed().commands.setCellBackground('FFFF00'); await sleep(140);
    caretInCell0(); out.setVAlign = ed().commands.setCellAttr('verticalAlign', 'middle'); await sleep(140);

    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const blocks = xml.match(/<w:tcPr\b[\s\S]*?<\/w:tcPr>/g) || [];
    const tcPr = blocks.find((b) => b.includes('<w:tcBorders')) || blocks[0] || '';
    out.tcPr = tcPr;
    const idx = (name) => tcPr.indexOf(name);
    out.idx = { tcW: idx('<w:tcW'), tcBorders: idx('<w:tcBorders'), shd: idx('<w:shd'), vAlign: idx('<w:vAlign') };
    const present = Object.entries(out.idx).filter(([, v]) => v >= 0).map(([k]) => k);
    out.present = present;
    // Schema-correct order: tcW < tcBorders < shd < vAlign (skip any missing).
    const seq = present.map((k) => out.idx[k]);
    out.schemaOrdered = seq.every((v, i) => i === 0 || v > seq[i - 1]);

    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-tcorder.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
