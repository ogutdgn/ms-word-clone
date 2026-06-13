/* Slice-10 themes oracle authoring probe.
   Runs in the PM app via --shot-evalfile; applies a theme (redefines Heading1/Title/Normal
   font+color), a real page color (w:background), real page borders (w:pgBorders), and
   docDefaults paragraph spacing, then exports a .docx and saves it to disk via wordAPI.saveBytes.
   The Windows COM oracle (word-oracle-win.ps1 roundtrip) then resaves it through real Word. */
(async () => {
  const out = { steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const PM = () => window.WC.PM;
  const ed = () => window.WC.editor;
  const doc = () => window.WC.view.state.doc;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));

  const selectText = (needle) => {
    let found = null;
    doc().descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) found = { from: pos + i, to: pos + i + needle.length };
    });
    if (!found) throw new Error('text not found: ' + needle);
    window.WC.view.dispatch(window.WC.view.state.tr.setSelection(window.__PM_TextSelection.create(doc(), found.from, found.to)));
    return found;
  };

  try {
    // 1. Seed a doc with a Title + a Heading 1 + body.
    ed().commands.selectAll();
    ed().commands.insertContent('<p>Quarterly Report</p><p>Executive Summary</p><p>This paragraph is the body text of the document, set in the theme body font.</p>');
    ed().commands.selectAll(); ed().commands.unsetAllMarks();
    selectText('Quarterly Report'); PM().applyStyleByName('Title'); await sleep(40);
    selectText('Executive Summary'); PM().applyStyleByName('Heading 1'); await sleep(40);
    log('seeded', true);

    // 2. Apply a theme: heading font Georgia, heading color dark red, body Georgia.
    const theme = { name: 'OracleTheme', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#C00000', accents: ['#C00000', '#2E74B5', '#548235', '#BF8F00', '#7030A0', '#0F9ED5'] };
    log('deApplyTheme', PM().deApplyTheme(theme)); await sleep(60);

    // 3. Real page color (w:background) + displayBackgroundShape.
    log('dePageColor', PM().dePageColor('#FFF2CC')); await sleep(40);

    // 4. Real page borders (w:pgBorders).
    log('dePageBorders', PM().dePageBorders({ style: 'solid', color: '#2E74B5', width: 2 })); await sleep(40);

    // 5. docDefaults paragraph spacing (after 13pt -> 260 twips, 1.5 line).
    log('deParagraphSpacing', PM().deParagraphSpacing({ before: 0, after: 13, line: 1.5 })); await sleep(40);

    // 6. Export + save to disk.
    const bytes = await PM().exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    out.isZip = !!(bytes && bytes[0] === 0x50 && bytes[1] === 0x4b);
    const filePath = 'C:\\tmp\\wc-slice10-themes-clone.docx';
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r;
    out.filePath = filePath;
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})()
