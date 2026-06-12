/* slice-9 references CLONE authoring probe (Leg-A oracle input, NO Word).
   Runs in the renderer via electron --shot-evalfile; driven by the Node host
   scripts/author-slice9-clone.js. Mirrors scripts/test-roundtrip-pm-probe.js
   exactly (sentinel-gated readiness, same JSON contract, exportDocxBytes ->
   wordAPI.saveBytes write to disk).

   Builds a doc with two Heading-1 paragraphs ("Chapter One"/"Chapter Two") + a
   body paragraph, then drives WC.PM:
     refInsertFootnote()                 (seed a note; caret in the body para)
     refInsertCaption("Figure","sample") (a SEQ caption)
     refAddSource({book...}) -> srcId; refInsertCitation(srcId)  (in-text CITATION)
     refInsertTOC({}) + refUpdateTable() (collect the two headings)
   then exportDocxBytes -> C:/tmp/wc-slice9-clone.docx.

   The COM/Word roundtrip (Leg-A leg B) is done separately by the human. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Convention (matches test-suite-pm.js / the round-trip probe): a string return
  // is a FAILURE carrying detail; true/non-string/non-false is a PASS.
  const t = async (name, fn) => {
    try { const r = await fn(); results.push({ name, pass: r !== false && typeof r !== 'string', detail: typeof r === 'string' ? r : '' }); }
    catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); }
  };

  const OUT_PATH = 'C:/tmp/wc-slice9-clone.docx';

  for (let i = 0; i < 200 && !(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready); i++) await sleep(50);
  if (!(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready)) {
    return JSON.stringify({
      summary: { total: 1, pass: 0, fail: 1, outPath: OUT_PATH },
      results: [{ name: 'harness ready', pass: false, detail: 'sentinel timeout after 10s' }],
    }, null, 2);
  }

  const PM = () => window.WC.PM;
  const v = () => window.WC.view;
  const doc = () => v().state.doc;
  const hasNode = (name) => { let f = false; doc().descendants((n) => { if (n.type.name === name) f = true; }); return f; };

  // Multi-paragraph body, then strip marks/list rendering (test-suite-pm.js setDocs).
  const setDocs = (paras) => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent(paras.map((p) => '<p>' + p + '</p>').join(''));
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.unsetAllMarks();
    window.WC.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']);
  };
  // Select the first occurrence of `needle`; returns {from,to}.
  const selectText = (needle) => {
    let found = null;
    doc().descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) found = { from: pos + i, to: pos + i + needle.length };
    });
    if (!found) throw new Error('text not found: ' + needle);
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), found.from, found.to)));
    return found;
  };
  // Collapse the caret to AFTER the first occurrence of `needle`.
  const caretAfter = (needle) => { const s = selectText(needle); window.WC.editor.commands.setTextSelection({ from: s.to, to: s.to }); };

  // Fresh doc, then the 3 paragraphs: two H1 headings + a body paragraph.
  await PM().newBlank(); await sleep(100);

  await t('seed doc: 2 Heading-1 paragraphs + a body paragraph', async () => {
    setDocs(['Chapter One', 'Chapter Two', 'Body paragraph with an anchor word here.']);
    selectText('Chapter One'); PM().applyStyleByName('Heading 1'); await sleep(60);
    selectText('Chapter Two'); PM().applyStyleByName('Heading 1'); await sleep(60);
    return true;
  });

  // Caret in the BODY paragraph (after "anchor") for the inline footnote + citation.
  await t('refInsertFootnote(): footnoteReference node seeded', async () => {
    caretAfter('anchor');
    const ok = PM().refInsertFootnote();
    if (ok !== true) return 'refInsertFootnote returned ' + JSON.stringify(ok);
    await sleep(150);
    return hasNode('footnoteReference') || 'no footnoteReference node after refInsertFootnote';
  });

  await t('refInsertCaption("Figure","sample"): sequenceField node seeded', async () => {
    caretAfter('anchor');
    const ok = PM().refInsertCaption('Figure', 'sample');
    if (ok !== true) return 'refInsertCaption returned ' + JSON.stringify(ok);
    await sleep(150);
    return hasNode('sequenceField') || 'no sequenceField node after refInsertCaption';
  });

  let srcId = null;
  await t('refAddSource({book Ada Lovelace}) -> sourceId', async () => {
    srcId = PM().refAddSource({ type: 'book', author: 'Ada Lovelace', title: 'On Engines', year: '1843', publisher: 'Analytical' });
    if (!srcId || srcId === false) return 'refAddSource returned ' + JSON.stringify(srcId);
    return typeof srcId === 'string' || 'sourceId not a string: ' + JSON.stringify(srcId);
  });

  await t('refInsertCitation(srcId): citation node seeded', async () => {
    if (!srcId) return 'skipped: no sourceId';
    caretAfter('anchor');
    const ok = PM().refInsertCitation(srcId);
    if (ok !== true) return 'refInsertCitation returned ' + JSON.stringify(ok);
    await sleep(150);
    return hasNode('citation') || 'no citation node after refInsertCitation';
  });

  await t('refInsertTOC({}) + refUpdateTable(): tableOfContents node collecting both headings', async () => {
    window.WC.editor.commands.setTextSelection({ from: 1, to: 1 }); // insert TOC at doc start
    const okIns = PM().refInsertTOC({});
    if (okIns !== true) return 'refInsertTOC returned ' + JSON.stringify(okIns);
    await sleep(180);
    const okUpd = PM().refUpdateTable();
    if (okUpd !== true) return 'refUpdateTable returned ' + JSON.stringify(okUpd);
    await sleep(180);
    if (!hasNode('tableOfContents')) return 'no tableOfContents node after refInsertTOC/refUpdateTable';
    // Confirm both headings were collected (entry paragraphs inside the TOC node).
    let toc = null;
    doc().descendants((n) => { if (!toc && n.type.name === 'tableOfContents') toc = n; });
    const texts = [];
    if (toc) toc.descendants((n) => { if (n.type.name === 'paragraph') texts.push(n.textContent); });
    const both = texts.some((tx) => tx.includes('Chapter One')) && texts.some((tx) => tx.includes('Chapter Two'));
    return both || 'TOC did not collect both headings: ' + JSON.stringify(texts);
  });

  await t('export: exportDocxBytes -> saveBytes(' + OUT_PATH + ')', async () => {
    const bytes = await PM().exportDocxBytes();
    if (!bytes || bytes.length <= 500) return 'export too small: ' + (bytes ? bytes.length : 'null') + ' bytes';
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'no PK zip header: bytes[0..1]=' + bytes[0] + ',' + bytes[1];
    const s = await window.wordAPI.saveBytes({ filePath: OUT_PATH, bytes });
    if (!s || s.ok !== true) return 'saveBytes failed: ' + ((s && s.error) || JSON.stringify(s));
    return true;
  });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, outPath: OUT_PATH }, results }, null, 2);
})()
