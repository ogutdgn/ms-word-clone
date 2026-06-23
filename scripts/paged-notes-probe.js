/* Milestone-4d notes-area probe (mode-aware). Run via:
     WC_LAYOUT=paged npm run build && electron . --probe-out=/tmp/wc-notes.json --shot-evalfile=scripts/paged-notes-probe.js
     npm run build && electron . --probe-out=/tmp/wc-notes-ovl.json --shot-evalfile=scripts/paged-notes-probe.js

   Proves M4d notes-area: in PAGED the #pm-notes-area overlay is DISABLED (PE paints footnote/endnote bodies
   per-page at the page foot — spike-confirmed), so no double-render; refShowNotes scrolls the painted footnote into
   view. In OVERLAY the below-sheet editable region still mounts (byte-identical). Convention: a check returns a
   detail STRING on success and `(... && false)` (literal false) on failure. Same {summary, results[]} contract. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const done = () => { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); };

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const PM = W.PM || {};
  const mode = window.__WC_LAYOUT_MODE;
  const notesArea = () => document.getElementById('pm-notes-area');
  const hiddenOrAbsent = () => { const el = notesArea(); return !el || el.style.display === 'none'; };
  const paintedHas = (needle) => { const pages = document.getElementById('pages'); if (!pages || !needle) return false; return Array.from(pages.querySelectorAll('.superdoc-page .superdoc-line, .superdoc-page .superdoc-fragment, .superdoc-page span')).some((el) => (el.textContent || '').indexOf(needle) !== -1); };
  const setFirstNoteBody = (text) => { try { const l = PM.refListFootnotes() || []; if (l[0]) return PM.refUpdateNote(l[0].target, text) === true; } catch (e) {} return false; };

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 200) && false));
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('refInsert/refShowNotes/refListFootnotes/refUpdateNote present', () => (['refInsertFootnote', 'refInsertEndnote', 'refShowNotes', 'refListFootnotes', 'refUpdateNote'].every((k) => typeof PM[k] === 'function')) || ('verbs missing' && false));
  if (!ok) return done();

  // insert a footnote + give it a DISTINCT body
  t('refInsertFootnote inserted a footnote', () => PM.refInsertFootnote() === true);
  await sleep(350);
  t('set the footnote body to a distinct marker', () => setFirstNoteBody('PROBEFOOTBODY') || ('refUpdateNote failed' && false));
  await sleep(600);

  // 008: the overlay #pm-notes-area region is RETIRED (notes-area.ts deleted). The paged PresentationEditor is the
  // sole footnote/endnote renderer — it paints note bodies per-page at the page foot; #pm-notes-area never mounts.
  // (a) PE PAINTED the footnote body per-page
  t('PE PAINTED the footnote body on a .superdoc-page', () => paintedHas('PROBEFOOTBODY') ? 'painted under .superdoc-page' : ('PROBEFOOTBODY NOT painted on any page' && false));
  // (b) #pm-notes-area never mounts (the overlay region is gone) — no double-render
  t('#pm-notes-area never mounts (overlay region retired)', () => hiddenOrAbsent() ? ('#pm-notes-area=' + (notesArea() ? 'hidden' : 'absent')) : ('#pm-notes-area is VISIBLE — an overlay region leaked' && false));
  // (c) refShowNotes scrolls the painted footnote into view
  t('refShowNotes() scrolls to the painted footnote (returns true)', () => PM.refShowNotes() === true ? 'scrolled to the painted note' : ('refShowNotes returned false (could not locate the painted footnote)' && false));
  // (d) a doc transaction does NOT mount #pm-notes-area (no overlay module to create it)
  t('a transaction does NOT mount #pm-notes-area', () => { try { W.editor.commands.insertContent(' more body text'); } catch (e) {} return hiddenOrAbsent() ? 'no region after a transaction' : ('#pm-notes-area appeared after a transaction' && false); });
  // (e) endnotes also paint via the PE — an endnote does not mount a #pm-notes-area region either
  t('an endnote also paints via the PE (no #pm-notes-area region)', () => { try { PM.refInsertEndnote(); } catch (e) {} return hiddenOrAbsent() ? 'still absent (both note types render via the PE)' : ('#pm-notes-area appeared for an endnote' && false); });
  return done();
})();
