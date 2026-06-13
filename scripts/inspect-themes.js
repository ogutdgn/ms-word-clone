'use strict';
// Slice-10 themes oracle inspector: extract the theme constructs from a .docx so we can
// confirm they survive Word's resave (Leg A). Usage: node scripts/inspect-themes.js <docx>
const JSZip = require('jszip');
const fs = require('fs');

(async () => {
  const p = process.argv[2];
  const zip = await JSZip.loadAsync(fs.readFileSync(p));
  const docXml = await (zip.file('word/document.xml') || { async: async () => '' }).async('string');
  const stylesXml = await (zip.file('word/styles.xml') || { async: async () => '' }).async('string');
  const settingsXml = zip.file('word/settings.xml') ? await zip.file('word/settings.xml').async('string') : '';

  const styleBlock = (id) => {
    const m = stylesXml.match(new RegExp('<w:style\\b[^>]*w:styleId="' + id + '"[\\s\\S]*?</w:style>'));
    return m ? m[0] : '';
  };
  const h1 = styleBlock('Heading1');
  const title = styleBlock('Title');
  const dd = (stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];

  const attr = (frag, tag, a) => {
    const t = (frag.match(new RegExp('<' + tag + '\\b[^>]*>')) || [''])[0];
    const m = t.match(new RegExp(a + '="([^"]*)"'));
    return m ? m[1] : null;
  };

  const out = {
    file: p,
    background_color: attr(docXml, 'w:background', 'w:color'),
    displayBackgroundShape: /<w:displayBackgroundShape\b/.test(settingsXml),
    pgBorders_present: /<w:pgBorders\b/.test(docXml),
    pgBorders_top_color: (() => { const b = (docXml.match(/<w:pgBorders[\s\S]*?<\/w:pgBorders>/) || [''])[0]; return attr(b, 'w:top', 'w:color'); })(),
    Heading1_rFonts_ascii: attr(h1, 'w:rFonts', 'w:ascii'),
    Heading1_asciiTheme: attr(h1, 'w:rFonts', 'w:asciiTheme'),
    Heading1_color_val: attr(h1, 'w:color', 'w:val'),
    Heading1_color_themeColor: attr(h1, 'w:color', 'w:themeColor'),
    Title_rFonts_ascii: attr(title, 'w:rFonts', 'w:ascii'),
    Title_color_val: attr(title, 'w:color', 'w:val'),
    docDefaults_spacing_after: attr(dd, 'w:spacing', 'w:after'),
  };
  console.log(JSON.stringify(out, null, 2));
})();
