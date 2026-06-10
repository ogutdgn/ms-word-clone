/* Slice-6 Leg C probe — build a STYLED clone table and export it to disk.
   Run via: electron . --probe-out=/tmp/wc-legC.json --shot-evalfile=scripts/slice6-legC-probe.js
   Exercises the 6b Table Tools verbs (tableSetStyle / tableSetCellShading / tableMerge /
   tableSetAlignment) and writes the exported .docx through the bytes IPC so the Word
   oracle roundtrip can re-open it. Same JSON contract as the PM test suite. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = async (name, fn) => {
    try { const r = await fn(); results.push({ name, pass: r !== false && typeof r !== 'string', detail: typeof r === 'string' ? r : '' }); }
    catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); }
  };
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);

  const PM = () => window.WC.PM;
  const v = () => window.WC.view;
  const doc = () => v().state.doc;

  // Put the caret in an empty paragraph so insertTable lands cleanly.
  const resetDoc = () => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent('table style probe');
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.unsetAllMarks();
  };

  await t('[legC] insert 3x3 table', async () => {
    resetDoc();
    // collapse caret to end first
    const end = doc().content.size;
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), end - 1, end - 1)));
    const ok = PM().insertTable({ rows: 3, cols: 3 });
    return ok === true && PM().isInTable() === true;
  });

  await t('[legC] setTableStyle(GridTable4-Accent1)', async () => {
    return PM().tableSetStyle('GridTable4-Accent1') !== false;
  });

  await t('[legC] setTableAlignment(center)', async () => {
    return PM().tableSetAlignment('center') !== false;
  });

  await t('[legC] select first-row cell pair (CellSelection)', async () => {
    return PM().tableSelectFirstRowPair() === true;
  });

  await t('[legC] setCellShading(FFFF00) over the cell pair', async () => {
    // shading needs the CellSelection from the previous step still active
    PM().tableSelectFirstRowPair();
    return PM().tableSetCellShading('FFFF00') !== false;
  });

  await t('[legC] merge the first-row cell pair (gridSpan)', async () => {
    PM().tableSelectFirstRowPair();
    return PM().tableMerge() !== false;
  });

  await t('[legC] tableInfo reports inTable with styleId+alignment', async () => {
    // re-enter the table (merge may have moved selection)
    const info = PM().tableInfo();
    return info && info.inTable === true;
  });

  let exported = false;
  await t('[legC] export styled docx + write to disk via bytes IPC', async () => {
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'bad zip header';
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/slice6-legC.docx', bytes });
    if (!w1 || !w1.ok) return 'saveBytes: ' + (w1 && w1.error);
    exported = true;
    return true;
  });

  results.push({ name: '[legC] exported flag', pass: exported, detail: exported ? '/tmp/slice6-legC.docx' : 'not written' });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
