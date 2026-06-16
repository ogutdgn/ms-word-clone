/* Lists/numbering oracle probe (ISOLATED): create a SINGLE bullet list para, then separately confirm a
   SINGLE numbered list para, each in its own doc, to isolate whether bullets export a valid w:numPr +
   numbering.xml that Word renders as a list. Saves both docx for word-oracle-win.ps1 read-para-props. */
(async () => {
  const out = { bulletDoc: {}, numberDoc: {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const makeList = async (label, cmd, file) => {
    const o = {};
    ed().commands.selectAll(); ed().commands.insertContent('<p>' + label + ' item</p>'); await sleep(80);
    ed().commands.setTextSelection(3); await sleep(40);
    o.applied = PM().cmd(cmd); await sleep(150);
    // model: does the first paragraph carry list info?
    let pAttrs = null; doc().descendants((n) => { if (n.type.name === 'paragraph' && pAttrs == null) pAttrs = Object.keys(n.attrs || {}).filter((k) => /list|num/i.test(k)).reduce((a, k) => (a[k] = n.attrs[k], a), {}); });
    o.modelListAttrs = pAttrs;
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    o.numPrCount = (xml.match(/<w:numPr\b/g) || []).length;
    o.numId = (xml.match(/<w:numId\b[^>]*w:val="(\d+)"/) || [])[1] || null;
    const numXml = ed().converter?.convertedXml?.['word/numbering.xml'];
    o.hasNumberingXml = !!numXml;
    if (numXml) { const els = (numXml.elements && numXml.elements[0] && numXml.elements[0].elements) || []; o.abstractNumCount = els.filter((e) => e.name === 'w:abstractNum').length; o.numCount = els.filter((e) => e.name === 'w:num').length; }
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', file].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    o.saved = r && (r.ok !== undefined ? r.ok : r); o.filePath = filePath;
    return o;
  };
  try {
    out.bulletDoc = await makeList('bullet', 'toggleBulletList', 'wc-list-bullet.docx');
    out.numberDoc = await makeList('number', 'toggleOrderedList', 'wc-list-number.docx');
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
