/* Slice-10 draw oracle authoring probe (full feature).
   Runs in the PM app via --shot-evalfile; inserts 3 real ink strokes (black pen, red pen,
   yellow highlighter) via PM.dInsertInk + a real bounded canvas frame via PM.dInsertCanvas,
   then exports a .docx and saves it via wordAPI.saveBytes. The Windows COM oracle
   (word-oracle-win.ps1 roundtrip) then resaves it through real Word — a clean exit means
   Word opened the multi-stroke + canvas doc without repair (Leg A). */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const PM = () => window.WC.PM;
  const ed = () => window.WC.editor;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>Ink test page — three strokes + a drawing canvas below.</p><p>Body.</p>');
    await sleep(40); log('seeded', true);

    // 3 strokes at different page positions, different pens.
    log('stroke-black', PM().dInsertInk([{ x: 120, y: 160 }, { x: 180, y: 220 }, { x: 240, y: 170 }], { color: '#000000', width: 2, opacity: 1 }, { x: 120, y: 160 }));
    await sleep(40);
    log('stroke-red', PM().dInsertInk([{ x: 260, y: 180 }, { x: 320, y: 140 }, { x: 380, y: 200 }], { color: '#C00000', width: 3, opacity: 1 }, { x: 260, y: 140 }));
    await sleep(40);
    log('stroke-hl', PM().dInsertInk([{ x: 130, y: 260 }, { x: 300, y: 262 }], { color: '#FFFF00', width: 14, opacity: 0.4 }, { x: 130, y: 255 }));
    await sleep(40);

    // a real bounded canvas frame.
    log('canvas', PM().dInsertCanvas());
    await sleep(60);

    const bytes = await PM().exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    out.isZip = !!(bytes && bytes[0] === 0x50 && bytes[1] === 0x4b);
    const filePath = 'C:\\tmp\\wc-slice10-draw-clone.docx';
    out.saved = await window.wordAPI.saveBytes({ filePath, bytes });
    out.filePath = filePath;
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})()
