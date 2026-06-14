/* Slice-10 draw (ink) oracle authoring probe (parametrized for the wp:anchor vs wp:inline gate).
   MODE selects the ink-shape wrapper. Inserts ONE ink stroke via the net-new insertInkShape command
   and saves C:\tmp\wc-ink-<MODE>-clone.docx. The Windows COM oracle (word-oracle-win.ps1 roundtrip)
   then resaves through real Word — a clean exit means Word opened the a:custGeom blob without repair (Leg A). */
(async () => {
  const MODE = 'anchor'; // 'inline' | 'anchor'
  const out = { mode: MODE, steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));

  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>Ink stroke probe paragraph.</p>');
    log('seeded', true);
    await sleep(40);

    const ok = ed().commands.insertInkShape({
      points: [{ x: 120, y: 140 }, { x: 180, y: 200 }, { x: 240, y: 150 }],
      pen: { color: '#C00000', width: 3, opacity: 1 },
      pos: { x: 120, y: 140 },
      mode: MODE,
    });
    log('insertInkShape', ok);
    await sleep(80);

    const bytes = await window.WC.PM.exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    out.isZip = !!(bytes && bytes[0] === 0x50 && bytes[1] === 0x4b);
    const filePath = 'C:\\tmp\\wc-ink-' + MODE + '-clone.docx';
    out.saved = await window.wordAPI.saveBytes({ filePath, bytes });
    out.filePath = filePath;
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})()
