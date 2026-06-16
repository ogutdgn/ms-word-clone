/* Characterize the mixed bullet+numbered interaction with ROBUST caret handling (re-query each
   paragraph's pos by its text AFTER every mutation, to rule out stale-position artifacts). Does a
   bullet para followed by a numbered para keep BOTH w:numPr on export? */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const caretInPara = (needle) => {
    let pos = null;
    doc().descendants((n, p) => { if (pos == null && n.type.name === 'paragraph' && n.textContent.includes(needle)) pos = p; });
    if (pos != null) ed().commands.setTextSelection(pos + 2);
    return pos;
  };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>alpha line</p><p>beta line</p>'); await sleep(80);
    out.caretA = caretInPara('alpha'); await sleep(40);
    out.bullet = PM().cmd('toggleBulletList'); await sleep(150);
    out.caretB = caretInPara('beta'); await sleep(40);  // re-query AFTER the bullet mutation
    out.number = PM().cmd('toggleOrderedList'); await sleep(150);
    // per-paragraph model list type
    out.paraTypes = [];
    doc().descendants((n) => { if (n.type.name === 'paragraph') out.paraTypes.push({ text: n.textContent.slice(0, 12), type: n.attrs.listRendering?.numberingType ?? null, numId: n.attrs.paragraphProperties?.numberingProperties?.numId ?? null }); });
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.numPrCount = (xml.match(/<w:numPr\b/g) || []).length;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-mixedlist.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r); out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
