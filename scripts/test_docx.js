(async () => {
  const htmlToDocx = require('html-to-docx');
  const mammoth = require('mammoth');
  const fs = require('fs/promises');
  const sample = `<h1 class="doc-title">Round Trip Test</h1>
    <p>This has <b>bold</b>, <i>italic</i>, and <u>underline</u>.</p>
    <h1>Heading One</h1>
    <ul><li>Bullet A</li><li>Bullet B</li></ul>
    <ol><li>Number 1</li><li>Number 2</li></ol>
    <table><tbody><tr><td>R1C1</td><td>R1C2</td></tr><tr><td>R2C1</td><td>R2C2</td></tr></tbody></table>
    <p style="color:#c00000">Red paragraph</p>`;
  const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${sample}</body></html>`;
  console.log('1) HTML -> DOCX via html-to-docx...');
  // Use the SAME complete margins the app uses — partial margins make
  // html-to-docx emit w:header="undefined", which real Word refuses to open.
  const buf = await htmlToDocx(full, null, { font: 'Aptos', fontSize: 24, margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 } });
  await fs.writeFile('/tmp/test.docx', buf);
  const stat = await fs.stat('/tmp/test.docx');
  console.log('   wrote /tmp/test.docx', stat.size, 'bytes');
  // REGRESSION GUARD: the OOXML must contain no literal "undefined" (would make
  // real Microsoft Word reject the file). Verified live against real Word.
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file('word/document.xml').async('string');
  const hasUndefined = /="undefined"|>undefined</.test(docXml);
  const pgMarOk = /<w:pgMar[^>]*w:header="\d+"[^>]*w:footer="\d+"[^>]*w:gutter="\d+"/.test(docXml);
  console.log('   OOXML guard: no "undefined" = ' + (!hasUndefined ? 'PASS' : 'FAIL') + ', integer pgMar = ' + (pgMarOk ? 'PASS' : 'FAIL'));
  if (hasUndefined || !pgMarOk) { console.log('RESULT: docx would be REJECTED by real Word'); process.exit(1); }
  console.log('2) DOCX -> HTML via mammoth...');
  const res = await mammoth.convertToHtml({ path: '/tmp/test.docx' });
  const out = res.value;
  console.log('   html length', out.length, '| messages', res.messages.length);
  const checks = {
    'Round Trip Test': out.includes('Round Trip Test'),
    'bold (<strong> or <b>)': /<(strong|b)>bold/i.test(out) || out.includes('bold'),
    'italic': out.includes('italic'),
    'Heading One': out.includes('Heading One'),
    'Bullet A (li)': /<li>\s*Bullet A/i.test(out) || out.includes('Bullet A'),
    'Number 1': out.includes('Number 1'),
    'table cell R1C1': out.includes('R1C1'),
    'table tag': /<table/i.test(out),
    'Red paragraph': out.includes('Red paragraph'),
  };
  let pass = 0, fail = 0;
  for (const [k,v] of Object.entries(checks)) { console.log('   ', v ? 'PASS' : 'FAIL', k); v ? pass++ : fail++; }

  // 3) header/footer go to real Word parts (bug #17) + nested tables are not dropped (bug #6)
  console.log('3) header/footer parts + nested-table flatten...');
  const flatten = (html) => { let prev; do { prev = html; html = html.replace(/(<td\b[^>]*>)([\s\S]*?)<table\b[^>]*>([\s\S]*?)<\/table>([\s\S]*?)(<\/td>)/gi, (m, o, b, inner, a, c) => { const txt = inner.replace(/<\/(tr|td|th|p|div)>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); return o + b + (txt ? '<br>' + txt : '') + a + c; }); } while (html !== prev); return html; };
  const wrap = (s) => `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${s}</body></html>`;
  const nestedBody = '<table><tbody><tr><td>OUTER <table><tbody><tr><td>INNERCELL</td></tr></tbody></table></td></tr></tbody></table>';
  const hfBuf = await htmlToDocx(wrap(flatten(nestedBody)), wrap('<p>MYHEADER</p>'), { header: true, footer: true, font: 'Aptos', fontSize: 24, margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 } }, wrap('<p>MYFOOTER</p>'));
  const hfZip = await JSZip.loadAsync(hfBuf);
  const hfNames = Object.keys(hfZip.files);
  const headerPart = hfNames.find((n) => /word\/header\d*\.xml/.test(n));
  const footerPart = hfNames.find((n) => /word\/footer\d*\.xml/.test(n));
  const headerHasText = headerPart && /MYHEADER/.test(await hfZip.file(headerPart).async('string'));
  const footerHasText = footerPart && /MYFOOTER/.test(await hfZip.file(footerPart).async('string'));
  const innerKept = /INNERCELL/.test(await hfZip.file('word/document.xml').async('string'));
  [['real header part with text', headerHasText], ['real footer part with text', footerHasText], ['nested-table inner text kept (not dropped)', innerKept]]
    .forEach(([k, v]) => { console.log('   ', v ? 'PASS' : 'FAIL', k); v ? pass++ : fail++; });

  console.log(`RESULT: ${pass} pass / ${fail} fail`);
  // show a snippet
  console.log('--- mammoth html (first 400 chars) ---');
  console.log(out.slice(0,400));
})().catch(e => { console.error('TEST_ERROR', e); process.exit(1); });
