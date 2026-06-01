/* Phase A: open a real-Word .docx through the clone's exact import pipeline
   (mammoth + the app's styleMap) and report which features survive. */
const mammoth = require('mammoth');
const path = process.argv[2] || '/mnt/c/Users/Public/wcprobe/ref_from_word.docx';

const styleMap = [
  "p[style-name='Title'] => h1.doc-title:fresh",
  "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "r[style-name='Strong'] => strong",
];

(async () => {
  const r = await mammoth.convertToHtml({ path }, { styleMap, includeDefaultStyleMap: true });
  const h = r.value;
  const count = (re) => (h.match(re) || []).length;
  const checks = [
    ['Title style → h1.doc-title', /<h1 class="doc-title">\s*Reference Document/i],
    ['Subtitle style', /doc-subtitle/i],
    ['Heading 1 → <h1>', /<h1>\s*Formatted Text/i],
    ['Heading 2 → <h2>', /<h2>\s*Bulleted List/i],
    ['Bold → <strong>', /<strong>\s*bold/i],
    ['Italic → <em>', /<em>\s*italic/i],
    ['Underline run text present', /underline/i],
    ['Colored run text present', /red/i],
    ['Highlight run text present', /highlight/i],
    ['Bulleted list <ul><li>', /<ul>[\s\S]*First bullet[\s\S]*Third bullet[\s\S]*<\/ul>/i],
    ['Numbered list <ol><li>', /<ol>[\s\S]*Step one[\s\S]*Step two[\s\S]*<\/ol>/i],
    ['Table present', /<table[\s\S]*Region[\s\S]*North[\s\S]*<\/table>/i],
    ['Hyperlink <a href>', /<a href="https:\/\/example\.com/i],
    ['Second page heading', /<h1>\s*Second Page/i],
  ];
  let pass = 0;
  console.log('IMPORT FIDELITY (real Word .docx -> clone via mammoth):\n');
  checks.forEach(([name, re]) => { const ok = re.test(h); if (ok) pass++; console.log((ok ? '  ✅' : '  ❌') + ' ' + name); });
  console.log(`\n  rows: ${count(/<tr>/gi)}, cells: ${count(/<td>/gi)}, headings: ${count(/<h[12]>/gi)}, paragraphs: ${count(/<p[ >]/gi)}`);
  console.log(`  messages from mammoth: ${r.messages.length}`);
  console.log(`\nRESULT: ${pass}/${checks.length} features survived import`);
  console.log('\n--- raw HTML (first 700 chars) ---\n' + h.slice(0, 700));
})().catch((e) => { console.error('ERR', e); process.exit(1); });
