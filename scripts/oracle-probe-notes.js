/* Footnote + endnote oracle probe (references area — D9.3): insert ONE footnote after the
   anchor word in paragraph 1 and ONE endnote after the anchor word in paragraph 2 via the
   bridge (refInsertFootnote / refInsertEndnote). The export must emit a footnoteReference
   marker + word/footnotes.xml note body, and an endnoteReference marker + word/endnotes.xml.
   Word COM (validate-notes-win.ps1) must read doc.Footnotes.Count==1 / doc.Endnotes.Count==1
   and the seeded note bodies ("Footnote" / "Endnote"). Saves the docx for the validator.
   The references area had ZERO Word-COM oracles before this probe. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  // Collapse a caret immediately AFTER the first occurrence of `needle` in body text.
  const caretAfter = (needle) => {
    let at = null;
    doc().descendants((n, pos) => {
      if (at == null && n.type.name === 'paragraph' && n.textContent.includes(needle)) {
        const idx = n.textContent.indexOf(needle) + needle.length;
        at = pos + 1 + idx;
      }
    });
    if (at != null) ed().commands.setTextSelection({ from: at, to: at });
    return at != null;
  };
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>fnanchor body one</p><p>enanchor body two</p>');
    await sleep(120);
    out.caretFn = caretAfter('fnanchor'); await sleep(30);
    out.setFootnote = PM().refInsertFootnote(); await sleep(140);
    out.caretEn = caretAfter('enanchor'); await sleep(30);
    out.setEndnote = PM().refInsertEndnote(); await sleep(140);
    // Node-level evidence (the markers ride in document.xml; bodies ride in the side parts).
    out.hasFootnoteRef = false; out.hasEndnoteRef = false;
    doc().descendants((n) => {
      if (n.type.name === 'footnoteReference') out.hasFootnoteRef = true;
      if (n.type.name === 'endnoteReference') out.hasEndnoteRef = true;
    });
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    out.fnRefInDoc = /<w:footnoteReference\b/.test(docXml);
    out.enRefInDoc = /<w:endnoteReference\b/.test(docXml);
    const parts = await ed().exportDocx({ getUpdatedDocs: true });
    const fx = (parts && parts['word/footnotes.xml']) || '';
    const ex = (parts && parts['word/endnotes.xml']) || '';
    out.fnBodyIds = (fx.match(/<w:footnote\b[^>]*\bw:id="(-?\d+)"/g) || []).map((m) => m.match(/w:id="(-?\d+)"/)[1]);
    out.enBodyIds = (ex.match(/<w:endnote\b[^>]*\bw:id="(-?\d+)"/g) || []).map((m) => m.match(/w:id="(-?\d+)"/)[1]);
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-notes.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
