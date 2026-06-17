/* Multilevel-list oracle probe (multilevel-only doc; AVOIDS the mixed bullet+numbered bug task_eb50ae00):
   apply the Decimal multilevel definition to two paragraphs, then increaseListIndent on para 2 so it
   becomes level 1. The from-scratch MINTED abstractNum must export a w:numPr on each para + a
   numbering.xml abstractNum with per-level numFmt(decimal)/lvlText (%1. and %1.%2.). Word COM
   (read-para-props) must read para1 listString "1." (level 1) and para2 "1.1." (level 2, outline).
   Saves the docx for word-oracle-win.ps1 read-para-props. */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM, doc = () => window.WC.view.state.doc;
  const compound = (i, suffix) => Array.from({ length: i + 1 }, (_, k) => '%' + (k + 1)).join('.') + suffix;
  const decimalDef = { listType: 'orderedList', levels: Array.from({ length: 9 }, (_, i) => ({ fmt: 'decimal', text: compound(i, '.') })) };
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>ml one</p><p>ml two</p>'); await sleep(100);
    ed().commands.selectAll(); await sleep(30);
    out.apply = PM().cmd('applyListDefinition', decimalDef); await sleep(160);
    let p2 = null, c = 0; doc().descendants((n, pos) => { if (n.type.name === 'paragraph') { c++; if (c === 2 && p2 == null) p2 = pos; } });
    if (p2 != null) { ed().commands.setTextSelection(p2 + 2); await sleep(30); }
    out.indent = PM().cmd('increaseListIndent'); await sleep(160);
    out.ilvls = []; doc().descendants((n) => { if (n.type.name === 'paragraph') out.ilvls.push(n.attrs.paragraphProperties?.numberingProperties?.ilvl ?? null); });
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    out.numPrCount = (xml.match(/<w:numPr\b/g) || []).length;
    out.ilvlVals = (xml.match(/<w:ilvl\b[^>]*w:val="(\d+)"/g) || []).map((m) => m.match(/w:val="(\d+)"/)[1]);
    const numXml = ed().converter?.convertedXml?.['word/numbering.xml'];
    if (numXml) {
      const els = (numXml.elements && numXml.elements[0] && numXml.elements[0].elements) || [];
      const abs = els.find((e) => e.name === 'w:abstractNum');
      const lvls = abs ? (abs.elements || []).filter((e) => e.name === 'w:lvl') : [];
      out.abstractLvlCount = lvls.length;
      out.lvl0fmt = lvls[0] && ((lvls[0].elements || []).find((e) => e.name === 'w:numFmt') || {}).attributes?.['w:val'];
      out.lvl0text = lvls[0] && ((lvls[0].elements || []).find((e) => e.name === 'w:lvlText') || {}).attributes?.['w:val'];
      out.lvl1text = lvls[1] && ((lvls[1].elements || []).find((e) => e.name === 'w:lvlText') || {}).attributes?.['w:val'];
    }
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-multilevel.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r); out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
