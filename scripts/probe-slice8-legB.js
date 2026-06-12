/* Slice-8 oracle Leg B import probe: open the REAL-Word-authored review docx in
   the clone and verify the tracked changes + comment arrive on the engine. */
(async () => {
  const PM = () => window.WC.PM;
  const out = {};
  const r = await window.wordAPI.openBytes('C:/tmp/wc-slice8-legB.docx');
  if (!r || !r.ok) return JSON.stringify({ error: 'openBytes failed: ' + (r && r.error) });
  out.imported = await PM().openDocx(r.bytes);

  const v = () => window.WC.view;
  const marks = { ins: [], del: [], fmt: [] };
  v().state.doc.descendants((n) => {
    if (!n.isText) return;
    for (const m of n.marks || []) {
      if (m.type.name === 'trackInsert') marks.ins.push(n.text);
      if (m.type.name === 'trackDelete') marks.del.push(n.text);
      if (m.type.name === 'trackFormat') marks.fmt.push(n.text);
    }
  });
  out.marks = marks;
  out.text = v().state.doc.textContent.slice(0, 160);
  out.revisions = PM().getRevisions().map((x) => ({ type: x.type, author: x.author, text: String(x.text).slice(0, 32) }));
  out.comments = PM().getComments().map((c) => ({ author: c.author, text: c.text.slice(0, 48), resolved: c.resolved }));
  out.changeRanges = PM().getChangeRanges().length;
  // Word parity sanity: accept-all clears every mark
  PM().cmd('acceptAllTrackedChanges');
  let any = false;
  v().state.doc.descendants((n) => { for (const m of n.marks || []) if (/^track/.test(m.type.name)) any = true; });
  out.acceptAllClears = !any;
  out.textAfterAccept = v().state.doc.textContent.slice(0, 140);
  return JSON.stringify(out, null, 2);
})()
