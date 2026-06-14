/* references-tools.js — References tab SHARED STATE (citationStyle + sources).
   The legacy apply engine (TOC/footnotes/captions/index/citations/bibliography/
   table-of-authorities — all of which drove the retired WC.Editor DOM) was
   removed in slice 11; PM owns these via WC.PM.ref* + bridge/references.ts.
   Only the shared-state slots remain, read by commands.js (citation-style menu)
   and dialogs.js (the source manager's legacy fallback). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;

  // Shared state only — citationStyle is written by commands.js:722 and the
  // [11] survival guard checks both citationStyle (string) and sources (array).
  const Ref = {
    citationStyle: 'APA',
    sources: [],
  };
  WC.Ref = Ref;
})();
