'use strict';
// Unzip a .docx and surface the parts slice-6 oracle validation needs.
// Usage: node scripts/docx-inspect.js <path-to-docx>
//
// Uses the SAME zip lib as scripts/test_docx.js (jszip).
//
// Critique M6 — attribute-order robust extraction:
//   OOXML attribute order is NOT guaranteed by the spec. We do NOT write regexes
//   of the form /<w:hyperlink[^>]*r:id="([^"]+)"/ because on Word-authored files
//   the attributes may arrive in any order and the match silently misses.
//   Instead we use a two-step approach for every element:
//     1. Extract the full opening tag text (matchAll /<tagName [^>]*>/g).
//     2. Pull each attribute independently from within that tag string.
//   This works regardless of attribute order or namespace-prefix variations.

const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/docx-inspect.js <path-to-docx>');
  process.exit(1);
}

// Pull a single named attribute out of a tag string, e.g. r:id="rId1" → "rId1".
// Handles single- or double-quoted values; returns null when not found.
function pullAttr(tagStr, attrName) {
  // Escape special regex chars in attrName (e.g. "r:id", "w:name")
  const esc = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = tagStr.match(new RegExp(esc + '=["\']([^"\']*)["\']'));
  return m ? m[1] : null;
}

// Extract all opening tags matching a given element name (handles namespace prefix).
// e.g. extractTags(xml, 'w:hyperlink') finds every <w:hyperlink ...> opening tag.
function extractTags(xml, elementName) {
  const esc = elementName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the full opening tag (up to the first unquoted '>'); this handles
  // self-closing tags too since we only need the attributes.
  const re = new RegExp('<' + esc + '(?:\\s[^>]*)?>', 'g');
  return Array.from(xml.matchAll(re)).map((m) => m[0]);
}

(async () => {
  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch (e) {
    console.error('Cannot read file:', e.message);
    process.exit(1);
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    console.error('Cannot unzip file (not a valid .docx?):', e.message);
    process.exit(1);
  }

  // Helper: read a zip entry to a UTF-8 string; returns null if the entry is absent.
  async function readEntry(entryPath) {
    const entry = zip.file(entryPath);
    if (!entry) return null;
    return entry.async('string');
  }

  const documentXml = (await readEntry('word/document.xml')) || '';
  const rels = (await readEntry('word/_rels/document.xml.rels')) || '';
  const stylesXml = (await readEntry('word/styles.xml')) || '';

  // Media files: collect name + byte size.
  const media = [];
  zip.forEach((relativePath, file) => {
    if (relativePath.startsWith('word/media/') && !file.dir) {
      // We need the raw byte count; JSZip gives it synchronously via _data
      // but the portable way is to store the promise and resolve later.
      // For simplicity collect the entry and read lengths after the forEach.
      media.push(file);
    }
  });
  const mediaEntries = await Promise.all(
    media.map(async (file) => ({
      name: file.name,
      bytes: (await file.async('uint8array')).length,
    }))
  );

  // --- hyperlinks (w:hyperlink) --- attribute-order robust ---
  // Extract every <w:hyperlink ...> tag first, then pull r:id from each tag.
  const hyperlinkTags = extractTags(documentXml, 'w:hyperlink');
  const hyperlinks = hyperlinkTags
    .map((tag) => pullAttr(tag, 'r:id'))
    .filter((id) => id !== null);

  // --- relationship targets --- attribute-order robust ---
  // Pull Id and Target independently from each <Relationship ...> tag.
  const relTags = extractTags(rels, 'Relationship');
  const relTargets = relTags
    .map((tag) => {
      const id = pullAttr(tag, 'Id');
      const target = pullAttr(tag, 'Target');
      return id && target ? { id, target } : null;
    })
    .filter(Boolean);

  // --- bookmarkStart --- attribute-order robust ---
  // w:id and w:name may appear in either order; we pull them independently.
  const bookmarkStartTags = extractTags(documentXml, 'w:bookmarkStart');
  const bookmarks = bookmarkStartTags
    .map((tag) => {
      const id = pullAttr(tag, 'w:id');
      const name = pullAttr(tag, 'w:name');
      return id !== null && name !== null ? { id, name } : null;
    })
    .filter(Boolean);

  // --- bookmarkEnd --- attribute-order robust ---
  const bookmarkEndTags = extractTags(documentXml, 'w:bookmarkEnd');
  const bookmarkEnds = bookmarkEndTags
    .map((tag) => pullAttr(tag, 'w:id'))
    .filter((id) => id !== null);

  // --- table counts ---
  // <w:tbl> has no attributes of interest; just count opening tags.
  const tables = extractTags(documentXml, 'w:tbl').length;

  // <w:tr> can have attributes (e.g. w:trPr children); count opening tags.
  const rows = extractTags(documentXml, 'w:tr').length;

  // <w:gridCol> — count opening tags.
  const gridCols = extractTags(documentXml, 'w:gridCol').length;

  // --- image blips (a:blip) --- attribute-order robust ---
  // r:embed may come before or after other attributes.
  const blipTags = extractTags(documentXml, 'a:blip');
  const blips = blipTags
    .map((tag) => pullAttr(tag, 'r:embed'))
    .filter((id) => id !== null);

  // --- table styles (slice 6 T4) --- attribute-order robust ---
  // Word DROPS an orphaned <w:tblStyle> reference when its styleId has no
  // w:style definition in word/styles.xml (oracle Leg C), so the oracle re-check
  // needs to see which table-type styles a saved file actually DEFINES, plus the
  // styles the document references. Two-step extraction like everything above:
  // grab each full <w:style>…</w:style> block, then pull w:type/w:styleId from
  // the opening tag and the w:name child independently.
  const styleBlocks = Array.from(stylesXml.matchAll(/<w:style[\s>][\s\S]*?<\/w:style>/g)).map((m) => m[0]);
  const tableStyles = styleBlocks
    .map((block) => {
      const openTag = block.match(/<w:style(?:\s[^>]*)?>/);
      if (!openTag) return null;
      if (pullAttr(openTag[0], 'w:type') !== 'table') return null;
      const styleId = pullAttr(openTag[0], 'w:styleId');
      if (styleId === null) return null;
      const nameTags = extractTags(block, 'w:name');
      const name = nameTags.length ? pullAttr(nameTags[0], 'w:val') : null;
      const conditionalFormats = extractTags(block, 'w:tblStylePr')
        .map((tag) => pullAttr(tag, 'w:type'))
        .filter((t) => t !== null);
      return { styleId, name, conditionalFormats };
    })
    .filter(Boolean);

  // The <w:tblStyle> references document.xml carries (to cross-check against
  // the definitions above — every ref should have a matching tableStyles entry).
  const tblStyleRefs = extractTags(documentXml, 'w:tblStyle')
    .map((tag) => pullAttr(tag, 'w:val'))
    .filter((v) => v !== null);

  const out = {
    hyperlinks,
    relTargets,
    bookmarks,
    bookmarkEnds,
    tables,
    rows,
    gridCols,
    blips,
    media: mediaEntries,
    tableStyles,
    tblStyleRefs,
  };

  console.log(JSON.stringify(out, null, 2));
})();
