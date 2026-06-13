/* Slice-10 insert-exotica oracle authoring probe (parametrized for bisecting Word-validity).
   MODE selects which constructs to author. Saves C:\tmp\wc-slice10-exotica-<MODE>-clone.docx.
   The Windows COM oracle (word-oracle-win.ps1 roundtrip) then resaves through real Word —
   a clean exit means Word opened it without repair (Leg A). */
(async () => {
  const MODE = 'all'; // 'dropcap' | 'date' | 'cover' | 'wordart' | 'textbox' | 'safe' | 'all'
  const out = { mode: MODE, steps: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const PM = () => window.WC.PM;
  const ed = () => window.WC.editor;
  const doc = () => window.WC.view.state.doc;
  const log = (k, v) => out.steps.push(k + '=' + JSON.stringify(v));

  const caretAfter = (needle) => {
    let found = null;
    doc().descendants((node, pos) => {
      if (found != null || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) found = pos + i + needle.length;
    });
    if (found == null) throw new Error('text not found: ' + needle);
    window.WC.view.dispatch(window.WC.view.state.tr.setSelection(window.__PM_TextSelection.create(doc(), found)));
    return found;
  };

  try {
    ed().commands.selectAll();
    ed().commands.insertContent('<p>Dropped capital opening paragraph for the drop cap test.</p><p>Body text here for the shape anchors.</p><p>Author byline </p>');
    log('seeded', true); await sleep(40);

    const want = (k) => MODE === 'all' || MODE === k || (MODE === 'safe' && ['dropcap', 'date', 'cover'].includes(k));
    if (want('dropcap')) { caretAfter('Dropped'); log('xeDropCap', PM().xeDropCap('drop', 3)); await sleep(40); }
    if (want('date')) { caretAfter('Author byline '); log('xeDateTime', PM().xeDateTime('M/d/yyyy')); await sleep(40); }
    if (want('wordart')) { caretAfter('shape anchors.'); log('xeWordArt', PM().xeWordArt('Annual Review', { color: '#C00000' })); await sleep(40); }
    if (want('textbox')) { caretAfter('shape anchors.'); log('xeTextBox', PM().xeTextBox('Sidebar note')); await sleep(40); }
    if (want('cover')) { log('xeCoverPage', PM().xeCoverPage('Banded')); await sleep(60); }

    const bytes = await PM().exportDocxBytes();
    out.byteLen = bytes ? bytes.length : 0;
    out.isZip = !!(bytes && bytes[0] === 0x50 && bytes[1] === 0x4b);
    const filePath = 'C:\\tmp\\wc-slice10-exotica-' + MODE + '-clone.docx';
    out.saved = await window.wordAPI.saveBytes({ filePath, bytes });
    out.filePath = filePath;
  } catch (e) {
    out.error = (e && e.message) || String(e);
  }
  return JSON.stringify(out, null, 2);
})()
