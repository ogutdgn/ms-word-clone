/* M6 PE glyph-geometry probe (paged, REAL Electron renderer — NEVER headless, else the mock-canvas stub measures a
   0.5-units/char stub instead of Chromium). Because paged mode CANNOT reopen a .docx (replaceEditor loses the PE), the
   PE is measured IN-SESSION: per font, CLEAR the boot doc to one clean wrapping paragraph via a transaction
   (chain().selectAll().clearNodes().insertContent(text) — the PE survives transactions), set the font/size/alignment,
   read each painted `.superdoc-page .superdoc-line` geometry, then export that SAME live model to a .docx (which Word
   then opens + measures). Aligns PE↔Word by LINE SEQUENCE + text (the line's data-pm-start is a PM position, NOT Word's
   char offset). Run: WC_LAYOUT=paged npm run build && electron --user-data-dir=C:/tmp/wc-probe-profile
   --disable-http-cache . --probe-out=/tmp/wc-m6-pe.json --shot-evalfile=scripts/paged-glyphgeom-probe.js */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  await sleep(300);
  const W = window.WC || {};
  const round = (n) => Math.round(n * 100) / 100;
  const mode = window.__WC_LAYOUT_MODE;
  if (mode !== 'paged') return JSON.stringify({ error: 'not paged (mode=' + mode + ') — PE not painted', mode });

  // BYTE-IDENTICAL calibration paragraph (forces ~6–8 wrapped lines at Letter / 1in margins / 11pt)
  const TEXT = 'Hello World this is a calibration paragraph for glyph geometry measurement across the full text column width to force wrapping onto several lines so the probe can read each painted line and align it against Word for Windows sixteen on this machine carefully. The quick brown fox jumps over the lazy dog while measuring advances.';
  const MULTI = (TEXT + ' ').repeat(30); // ~2.5 pages (each TEXT ≈ 4 lines; ~48 lines/page)

  // canvas font-availability (so we only author fixtures for fonts Chromium AND Word both have)
  const ctx = document.createElement('canvas').getContext('2d');
  const isAvail = (f) => { const probe = 'mmmmmmlliWQ@'; ctx.font = '72px monospace'; const b1 = ctx.measureText(probe).width; ctx.font = '72px serif'; const b2 = ctx.measureText(probe).width; ctx.font = '72px "' + f + '", monospace'; const w1 = ctx.measureText(probe).width; ctx.font = '72px "' + f + '", serif'; const w2 = ctx.measureText(probe).width; return w1 !== b1 || w2 !== b2; };
  const CANDIDATES = ['Aptos', 'Calibri', 'Calibri Light', 'Cambria', 'Times New Roman', 'Arial', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Consolas', 'Comic Sans MS', 'Segoe UI', 'Garamond', 'Book Antiqua'];
  const fonts = CANDIDATES.filter(isAvail);

  const ed = () => W.editor;
  // measure every painted line across all pages, in doc order
  const measureLines = () => {
    const pages = Array.from(document.querySelectorAll('.superdoc-page'));
    const lines = [];
    pages.forEach((pg) => {
      const pi = parseInt(pg.getAttribute('data-page-index') || '0', 10);
      const pbox = pg.getBoundingClientRect();
      Array.from(pg.querySelectorAll('.superdoc-line')).forEach((el) => {
        const r = el.getBoundingClientRect();
        const txt = (el.textContent || '').replace(/ /g, ' ');
        lines.push({ page: pi, topPx: round(r.top - pbox.top), leftPx: round(r.left - pbox.left), widthPx: round(r.width), text: txt, pmStart: parseInt(el.getAttribute('data-pm-start') || '-1', 10) });
      });
    });
    lines.sort((a, b) => a.pmStart - b.pmStart);
    lines.forEach((l, i) => { l.lineIndex = i; });
    const pageCount = pages.length;
    const perPageLineCount = pages.map((pg) => pg.querySelectorAll('.superdoc-line').length);
    return { lines, pageCount, perPageLineCount };
  };

  // author one fixture (clear → set body text → font/size/align) + measure the PE + export the .docx
  const authorAndMeasure = async (id, font, sizePt, alignment, text) => {
    const applied = { font: false, size: false, align: false };
    try { ed().chain().selectAll().clearNodes().insertContent(text).run(); } catch (e) { return { id, error: 'clear/insert: ' + (e.message || e) }; }
    await sleep(120);
    // commands return a BOOLEAN (chain().run()) — a no-op returns false WITHOUT throwing, so capture the return, not
    // just "didn't throw".
    try { applied.font = ed().chain().selectAll().setFontFamily(font).run() !== false; } catch (e) {}
    try { applied.size = ed().chain().selectAll().setFontSize(sizePt + 'pt').run() !== false; } catch (e) { try { applied.size = ed().chain().selectAll().setFontSize(String(sizePt)).run() !== false; } catch (e2) {} }
    // set alignment EVERY fixture (reset 'left' explicitly too) so a prior fixture's justify can't bleed in.
    try { applied.align = ed().chain().selectAll().setTextAlign(alignment === 'justify' ? 'justify' : 'left').run() !== false; } catch (e) {}
    await sleep(350);
    // HONESTY READ-BACK: a silently-no-op setFontFamily would paint+export the DEFAULT font, making PE and Word agree
    // falsely. Read the ACTUALLY-painted run's computed font-family and assert it is the requested font.
    const sp = document.querySelector('.superdoc-page .superdoc-line span:not(.superdoc-list-marker):not(.superdoc-tab)');
    const computedFont = sp ? String(getComputedStyle(sp).fontFamily || '').replace(/["']/g, '') : '';
    const fontApplied = !!font && computedFont.toLowerCase().includes(String(font).toLowerCase());
    // page-scale guard: a Letter page at zoom 1.0 is ~816px wide @96dpi; a CSS transform/zoom would scale the client
    // rects and break the fixed px→pt (×0.75) the driver applies. Record it so the driver can assert ≈ 816.
    const page0 = document.querySelector('.superdoc-page');
    const pageWidthPx = page0 ? Math.round(page0.getBoundingClientRect().width) : null;
    const m = measureLines();
    let bytes = null; try { bytes = await W.PM.exportDocxBytes(); } catch (e) {}
    const docxPath = 'C:/tmp/wc-m6-' + id + '.docx';
    let saved = null; try { saved = bytes ? await window.wordAPI.saveBytes({ filePath: docxPath, bytes }) : null; } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
    return { id, font, sizePt, alignment, applied, computedFont, fontApplied, pageWidthPx, docxPath, saved: !!(saved && saved.ok), text, peLines: m.lines, pageCount: m.pageCount, perPageLineCount: m.perPageLineCount };
  };

  const results = [];
  // 1) full font set, left-aligned, 11pt, byte-identical text
  for (const f of fonts) { const id = f.toLowerCase().replace(/[^a-z0-9]+/g, '-'); results.push(await authorAndMeasure(id, f, 11, 'left', TEXT)); }
  // 2) justified variant (worst case) — use the first available common body font
  const jf = fonts.find((f) => /calibri|aptos|times/i.test(f)) || fonts[0];
  if (jf) results.push(await authorAndMeasure(jf.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-justified', jf, 11, 'justify', TEXT));
  // 3) multi-page (~2.5 pages)
  results.push(await authorAndMeasure('multipage', (fonts.find((f) => /calibri|aptos/i.test(f)) || fonts[0]), 11, 'left', MULTI));

  return JSON.stringify({ mode, fontsDetected: fonts, fixtures: results.map((r) => ({ id: r.id, font: r.font, sizePt: r.sizePt, alignment: r.alignment, kind: r.id === 'multipage' ? 'multi-page' : 'single-para', docxPath: r.docxPath, saved: r.saved, applied: r.applied, text: r.text })), perFixturePE: results }, null, 2);
})();
