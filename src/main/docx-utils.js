'use strict';
// Pure (no-electron) docx post-processing helpers, shared by the main process and
// the test suite. html-to-docx can't do nested tables or comments, so we fix the
// generated OOXML directly.

// html-to-docx silently drops a <table> nested inside a <td> (and its text too).
// Flatten any inner table to <br>-joined cell text so nothing is lost on export.
function flattenNestedTables(html) {
  if (!/<table/i.test(html) || !/<\/table>/i.test(html)) return html;
  let prev;
  do {
    prev = html;
    html = html.replace(/(<td\b[^>]*>)([\s\S]*?)<table\b[^>]*>([\s\S]*?)<\/table>([\s\S]*?)(<\/td>)/gi, (m, tdOpen, before, inner, after, tdClose) => {
      const text = inner.replace(/<\/(tr|td|th|p|div)>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return tdOpen + before + (text ? '<br>' + text : '') + after + tdClose;
    });
  } while (html !== prev);
  return html;
}

// Turn the @@WCMTS<id>@@ … @@WCMTE<id>@@ sentinels (injected by the renderer's
// getSavePayload around commented runs) into real OOXML comment markers, and add
// a word/comments.xml part with the comment text. Returns a new docx buffer.
// `JSZip` is injected so this module needs no dependencies of its own.
async function injectComments(JSZip, buffer, comments) {
  const zip = await JSZip.loadAsync(buffer);
  let doc = await zip.file('word/document.xml').async('string');
  doc = doc.replace(/@@WCMTS(\d+)@@/g, (m, id) => `</w:t></w:r><w:commentRangeStart w:id="${id}"/><w:r><w:t xml:space="preserve">`);
  doc = doc.replace(/@@WCMTE(\d+)@@/g, (m, id) => `</w:t></w:r><w:commentRangeEnd w:id="${id}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r><w:r><w:t xml:space="preserve">`);
  zip.file('word/document.xml', doc);

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const items = comments.map((c) => `<w:comment w:id="${c.id}" w:author="${esc(c.author)}" w:date="2026-01-01T00:00:00Z" w:initials="WU"><w:p><w:r><w:t xml:space="preserve">${esc(c.text)}</w:t></w:r></w:p></w:comment>`).join('');
  zip.file('word/comments.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments ${ns}>${items}</w:comments>`);

  let ct = await zip.file('[Content_Types].xml').async('string');
  if (!/word\/comments\.xml/.test(ct)) {
    ct = ct.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
    zip.file('[Content_Types].xml', ct);
  }
  let rels = await zip.file('word/_rels/document.xml.rels').async('string');
  if (!/relationships\/comments/.test(rels)) {
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdWcComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', rels);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = { flattenNestedTables, injectComments };
