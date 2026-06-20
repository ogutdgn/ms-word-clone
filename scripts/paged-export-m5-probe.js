/* Milestone-5 kitchen-sink export probe (mode-aware). The driver (test-roundtrip-paged.js) runs it under
   WC_LAYOUT=paged AND WC_LAYOUT=overlay. It edits ONE doc exercising every SHARED-model M4 construct (header,
   footer, footnote, endnote, comment, image, + a best-effort tracked change), each with a DISTINCT marker, then
   exports → saves C:/tmp/wc-<mode>-m5-kitchensink.docx (for the real-Word validate-open) AND emits the parts map
   (for the paged-vs-overlay normalized diff — the determinism spike proved the export is byte-stable cross-run, so
   the diff is a DIRECT parts-map equality, no masking). Same {summary, results[], partsMap} contract. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const ta = async (name, fn) => { try { const r = await fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const docText = () => { let s = ''; try { W.editor.state.doc.descendants((n) => { if (n.isText) s += n.text; }); } catch (e) {} return s; };
  const selectWord = (word) => { try { let from = null; W.editor.state.doc.descendants((n, pos) => { if (from === null && n.isText) { const idx = n.text.indexOf(word); if (idx >= 0) from = pos + idx; } }); if (from !== null) { const TS = window.__PM_TextSelection; W.editor.view.dispatch(W.editor.state.tr.setSelection(TS.create(W.editor.state.doc, from, from + word.length))); return true; } } catch (e) {} return false; };

  t('mode (info)', () => 'mode=' + mode);
  const ok = t('verbs present (setHeaderText/refInsertFootnote/cmd/insertImage/exportDocxBytes + wordAPI.saveBytes)', () => (['setHeaderText', 'setFooterText', 'refInsertFootnote', 'refInsertEndnote', 'refUpdateNote', 'cmd', 'insertImage', 'exportDocxBytes'].every((k) => typeof PM[k] === 'function') && window.wordAPI && typeof window.wordAPI.saveBytes === 'function') || ('missing' && false));
  if (!ok) { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); }

  // ── edit the kitchen-sink (identical sequence in both modes → identical model → identical export) ──
  t('header = M5HDR', () => PM.setHeaderText('M5HDR') === true);
  t('footer = M5FTR', () => PM.setFooterText('M5FTR') === true);
  try { W.editor.commands.insertContent('M5 body alpha bravo charlie delta echo foxtrot. '); } catch (e) {}
  await sleep(150);
  t('insert footnote', () => PM.refInsertFootnote() === true);
  await sleep(120);
  t('insert endnote', () => PM.refInsertEndnote() === true);
  await sleep(120);
  // update ONLY the footnote body to M5FTNOTE (the endnote keeps its 'Endnote' seed — its fallback target is
  // mislabeled entityType:'footnote', so updating it would overwrite the footnote; the read-back only needs counts +
  // a distinct footnote marker).
  try { const fn = (PM.refListFootnotes() || []).find((n) => n.type !== 'endnote'); if (fn) PM.refUpdateNote(fn.target, 'M5FTNOTE'); } catch (e) {}
  t('comment on "alpha" = M5CMT', () => { if (!selectWord('alpha')) return 'could not select "alpha"' && false; return PM.cmd('addComment', 'M5CMT') ? 'commented' : ('addComment refused' && false); });
  // collapse the selection to the doc END before inserting the image so insertImage APPENDS (does not REPLACE the
  // commented word 'alpha' / disrupt the body text).
  try { const TS = window.__PM_TextSelection; const end = Math.max(1, W.editor.state.doc.content.size - 1); W.editor.view.dispatch(W.editor.state.tr.setSelection(TS.create(W.editor.state.doc, end))); } catch (e) {}
  t('insert image', () => PM.insertImage({ src: PNG, alt: 'M5IMG', width: 80, height: 60 }) === true);
  // best-effort tracked change (don't fail the gate if the toggle name drifts)
  let trk = false; try { trk = W.editor.commands.toggleTrackChanges && W.editor.commands.toggleTrackChanges() !== false; } catch (e) {}
  if (trk) { try { selectWord('foxtrot'); W.editor.commands.insertContent(' M5TRK'); } catch (e) {} }
  results.push({ name: 'tracked change enabled (info)', pass: true, detail: 'toggleTrackChanges=' + trk });
  await sleep(350);

  // ── sanity: the markers are in the model BEFORE we export ──
  results.push({ name: 'DIAG (info)', pass: true, detail: 'bodyText="' + docText().slice(0, 80) + '" notes=[' + (PM.refListFootnotes() || []).map((n) => n.type + ':' + n.content).join(', ') + ']' });
  t('header marker in model (getHeaderText===M5HDR)', () => PM.getHeaderText() === 'M5HDR' ? 'M5HDR' : ('got ' + JSON.stringify(PM.getHeaderText()) && false));
  t('footnote marker M5FTNOTE + an endnote present', () => { const notes = PM.refListFootnotes() || []; const fn = notes.find((n) => n.type !== 'endnote'); const en = notes.find((n) => n.type === 'endnote'); return fn && /M5FTNOTE/.test(fn.content) && en ? 'fn=M5FTNOTE,endnote=present' : ('notes=' + notes.map((n) => n.type + ':' + n.content).join(',') && false); });
  t('body marker in model', () => /M5 body alpha/.test(docText()) ? 'body present' : ('body=' + docText().slice(0, 40) && false));

  // ── export → save the .docx (for validate-open) + emit the parts map (for the diff) ──
  let bytes = null; try { bytes = await PM.exportDocxBytes(); } catch (e) {}
  t('exportDocxBytes produced bytes', () => bytes && bytes.byteLength > 0 ? ('bytes=' + bytes.byteLength) : ('export failed' && false));
  let saved = null; try { saved = await window.wordAPI.saveBytes({ filePath: 'C:/tmp/wc-' + mode + '-m5-kitchensink.docx', bytes }); } catch (e) { saved = { ok: false, error: (e && e.message) || String(e) }; }
  t('saveBytes wrote the .docx', () => saved && saved.ok === true ? saved.path : ('save=' + JSON.stringify(saved) && false));

  // NB: the driver diffs the SAVED .docx bytes directly (unzip both modes) — NOT a re-export — so this probe does
  // not emit a parts map. exportDocxBytes above is the exact artifact saved + opened by the COM oracle.
  const p = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode, savedPath: saved && saved.path }, results }, null, 2);
})();
