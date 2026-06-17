/* Comment oracle probe (review area — D8): anchor ONE comment on the word "anchor" via the
   bridge (addComment) and export. A real Word comment needs THREE document.xml markers
   (commentRangeStart / commentRangeEnd / commentReference run) PLUS the comment body in
   word/comments.xml. Word COM (validate-comments-win.ps1) must read doc.Comments.Count==1,
   .Item(1).Range.Text == the body, and a non-empty .Author. Saves the docx for the validator.
   The review area had ZERO Word-COM oracles before this probe (byte-only tests, like the
   endnote bug that exportXmlOnly/roundtrip both missed). */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  // Select the first occurrence of `needle` (text-node-relative: from = textNodePos + indexInNode).
  // NB: a paragraph's content does NOT start at paragraphPos+1 here (the doc wraps blocks in a
  // body node, so the first text sits at pos 2) — anchoring off the text node's own pos is the
  // only correct way, matching scripts/test-suite-pm.js selectText.
  const selectText = (needle) => {
    let from = null, to = null;
    doc().descendants((n, pos) => {
      if (from == null && n.isText && n.text && n.text.includes(needle)) {
        const idx = n.text.indexOf(needle);
        from = pos + idx; to = from + needle.length;
      }
    });
    if (from != null) ed().commands.setTextSelection({ from, to });
    return from != null;
  };
  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>comment anchor words here</p>');
    await sleep(120);
    out.selected = selectText('anchor'); await sleep(40);
    out.added = PM().cmd('addComment', 'CommentBodyXYZ'); await sleep(160);
    out.commentCountBridge = (typeof PM().getComments === 'function' && Array.isArray(PM().getComments())) ? PM().getComments().length : -1;
    // Node-level marker evidence (all three ride in document.xml).
    out.hasRangeStart = false; out.hasRangeEnd = false; out.hasRef = false;
    doc().descendants((n) => {
      if (n.type.name === 'commentRangeStart') out.hasRangeStart = true;
      if (n.type.name === 'commentRangeEnd') out.hasRangeEnd = true;
      if (n.type.name === 'commentReference') out.hasRef = true;
    });
    const docXml = await ed().exportDocx({ exportXmlOnly: true });
    out.rangeStartInDoc = /<w:commentRangeStart\b/.test(docXml);
    out.rangeEndInDoc = /<w:commentRangeEnd\b/.test(docXml);
    out.refInDoc = /<w:commentReference\b/.test(docXml);
    const parts = await ed().exportDocx({ getUpdatedDocs: true });
    out.partKeys = Object.keys(parts || {}).filter((k) => /comment/i.test(k));
    const cx = (parts && parts['word/comments.xml']) || '';
    out.commentEls = (cx.match(/<w:comment\b[^>]*>/g) || []).length;
    out.bodyHasText = /CommentBodyXYZ/.test(cx);
    out.authorAttr = (cx.match(/w:author="([^"]*)"/) || [])[1] || null;
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-comments.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
