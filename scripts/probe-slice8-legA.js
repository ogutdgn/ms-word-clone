/* Slice-8 oracle Leg A author probe: build a doc with REAL tracked changes
   (insert + delete + format) and a comment in the clone engine, then export
   docx bytes to C:\tmp\wc-slice8-legA.docx for the Word-side oracle. */
(async () => {
  const PM = () => window.WC.PM;
  const out = { steps: [] };
  const v = () => window.WC.view;
  const find = (needle) => {
    let hit = null;
    v().state.doc.descendants((n, p) => {
      if (hit || !n.isText || !n.text) return !hit;
      const i = n.text.indexOf(needle);
      if (i >= 0) hit = { from: p + i, to: p + i + needle.length };
      return !hit;
    });
    return hit;
  };
  const setSel = (from, to) => window.WC.editor.commands.setTextSelection({ from, to });

  await PM().openText('Review oracle base paragraph with doomed words inside.\nSecond paragraph for the comment anchor target here.');
  out.steps.push('opened 2-paragraph base');

  // tracked INSERT + DELETE + FORMAT
  PM().cmd('enableTrackChanges');
  const afterBase = find('paragraph');
  setSel(afterBase.to, afterBase.to);
  v().dispatch(v().state.tr.insertText(' INSERTEDRUN'));
  const doomed = find('doomed');
  v().dispatch(v().state.tr.delete(doomed.from, doomed.to));
  const words = find('words');
  setSel(words.from, words.to);
  PM().cmd('toggleBold');
  PM().cmd('disableTrackChanges');
  out.steps.push('tracked ins/del/format applied');

  // comment on 'anchor' (Document API path — A2)
  const anchor = find('anchor');
  setSel(anchor.from, anchor.to);
  const cOk = PM().cmd('addComment', 'Oracle leg-A comment: does this survive Word?');
  out.steps.push('addComment -> ' + cOk);

  // state evidence
  const marks = { ins: false, del: false, fmt: false };
  v().state.doc.descendants((n) => {
    for (const m of n.marks || []) {
      if (m.type.name === 'trackInsert') marks.ins = true;
      if (m.type.name === 'trackDelete') marks.del = true;
      if (m.type.name === 'trackFormat') marks.fmt = true;
    }
  });
  out.marks = marks;
  out.revisions = PM().getRevisions().map((r) => ({ type: r.type, author: r.author, text: String(r.text).slice(0, 30) }));
  out.comments = PM().getComments().map((c) => ({ author: c.author, text: c.text.slice(0, 40), resolved: c.resolved }));

  const bytes = await PM().exportDocxBytes();
  const w = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-slice8-legA.docx', bytes });
  out.saved = w && w.ok;
  return JSON.stringify(out, null, 2);
})()
