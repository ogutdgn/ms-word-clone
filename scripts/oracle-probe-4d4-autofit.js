/* Phase 4d.4 AutoFit oracle authoring probe.
   Runs in the PM app via --shot-evalfile. Builds two tables and exports a .docx each:
   - WINDOW: a 2-col table with unequal 1:2 columns, then AutoFit Window → must scale the
     columns to fill the page text column (6.5" = 468pt for default Letter/1" margins),
     keeping the 1:2 ratio (≈156pt : 312pt).
   - FIXED : a 2-col table with 120/180 px columns, then Fixed Column Width → widths preserved
     (90pt : 135pt) and tableLayout fixed.
   The Windows COM oracle (word-oracle-win.ps1 read-table) then reports what real Word renders. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const PM = () => window.WC.PM;
  const ed = () => window.WC.editor;
  const view = () => window.WC.view;
  const doc = () => view().state.doc;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));

  // Set the table's per-column widths (px) the way a real column resize leaves it:
  // the table `grid` (twips, what the exporter emits) + userEdited + every cell colwidth.
  const setCols = (widths) => {
    let tablePos = null, tableNode = null;
    doc().descendants((n, pos) => { if (n.type.name === 'table' && tablePos == null) { tablePos = pos; tableNode = n; } });
    const cells = []; doc().descendants((n, pos) => { if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') cells.push({ pos, node: n }); });
    let tr = view().state.tr.setNodeMarkup(tablePos, undefined, { ...tableNode.attrs, grid: widths.map((w) => ({ col: w * 15 })), userEdited: true });
    cells.forEach((c, idx) => { tr = tr.setNodeMarkup(c.pos, undefined, { ...c.node.attrs, colwidth: [widths[idx % widths.length]] }); });
    view().dispatch(tr);
  };

  const buildAndSave = async (widths, mode, filePath) => {
    ed().commands.selectAll();
    ed().commands.insertContent('<p></p>'); // clear to an empty paragraph
    await sleep(80);
    PM().insertTable({ rows: 2, cols: 2 });
    await sleep(160);
    setCols(widths);
    await sleep(140);
    const ok = PM().tableAutoFit(mode);
    await sleep(180);
    // capture the exported gridCols for cross-check vs the oracle
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const gridCols = (xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g) || []).map((s) => +(s.match(/w:w="(\d+)"/) || [])[1]);
    const bytes = await PM().exportDocxBytes();
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    log(mode + '.tableAutoFit', ok);
    log(mode + '.gridColsTwips', gridCols);
    log(mode + '.saved', r && (r.ok ?? r));
    log(mode + '.filePath', filePath);
  };

  try {
    await buildAndSave([100, 200], 'window', 'C:\\tmp\\wc-autofit-window.docx');
    await buildAndSave([120, 180], 'fixed', 'C:\\tmp\\wc-autofit-fixed.docx');
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})();
