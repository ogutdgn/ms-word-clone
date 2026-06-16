/* Bookmark oracle probe: select a word and insert a bookmark "spot1" via the bridge (insertBookmark).
   The export must emit a PAIRED <w:bookmarkStart w:id=N w:name="spot1"/> + <w:bookmarkEnd w:id=N/> with
   the SAME id. Word COM must read doc.Bookmarks.Count = 1, .Exists("spot1") = true, .Item("spot1").Name =
   "spot1". Saves the docx for validate-bookmark-win.ps1. (Clean ASCII name: the bridge collapses
   whitespace to _ and Word rejects names with spaces / leading digits.) */
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor, PM = () => window.WC.PM;
  try {
    ed().commands.selectAll(); ed().commands.insertContent('<p>target word</p>'); await sleep(80);
    ed().commands.setTextSelection({ from: 1, to: 7 }); await sleep(40); // select "target"
    out.set = PM().insertBookmark({ name: 'spot1' }); await sleep(160);
    const xml = await ed().exportDocx({ exportXmlOnly: true });
    const start = (xml.match(/<w:bookmarkStart\b[^>]*\/?>/) || [])[0] || null;
    const end = (xml.match(/<w:bookmarkEnd\b[^>]*\/?>/) || [])[0] || null;
    out.bookmarkStart = start; out.bookmarkEnd = end;
    out.startName = start && (start.match(/w:name="([^"]*)"/) || [])[1];
    out.startId = start && (start.match(/w:id="([^"]*)"/) || [])[1];
    out.endId = end && (end.match(/w:id="([^"]*)"/) || [])[1];
    const bytes = await PM().exportDocxBytes();
    const filePath = ['C:', 'tmp', 'wc-bookmark.docx'].join('\\');
    const r = await window.wordAPI.saveBytes({ filePath, bytes });
    out.saved = r && (r.ok !== undefined ? r.ok : r);
    out.filePath = filePath;
  } catch (e) { out.error = e.message || String(e); }
  return JSON.stringify(out, null, 2);
})();
