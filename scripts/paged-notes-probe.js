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
  const ok = t('refInsert/refShowNotes/refListFootnotes/refUpdateNote present + WC.NotesArea', () => (['refInsertFootnote', 'refInsertEndnote', 'refShowNotes', 'refListFootnotes', 'refUpdateNote'].every((k) => typeof PM[k] === 'function') && !!W.NotesArea) || ('verbs missing' && false));
  if (!ok) return done();

  // insert a footnote + give it a DISTINCT body
  t('refInsertFootnote inserted a footnote', () => PM.refInsertFootnote() === true);
  await sleep(350);
  t('set the footnote body to a distinct marker', () => setFirstNoteBody('PROBEFOOTBODY') || ('refUpdateNote failed' && false));
  await sleep(600);

  if (mode === 'paged') {
    // (a) PE PAINTED the footnote body per-page (disabled overlay ≠ no notes)
    t('PE PAINTED the footnote body on a .superdoc-page (disabled ≠ no-notes)', () => paintedHas('PROBEFOOTBODY') ? 'painted under .superdoc-page' : ('PROBEFOOTBODY NOT painted on any page — disabling the overlay would hide it' && false));
    // (b) the #pm-notes-area overlay is DISABLED (absent or hidden) — no double-render
    t('#pm-notes-area is absent OR display:none (overlay disabled, no double-render)', () => hiddenOrAbsent() ? ('#pm-notes-area=' + (notesArea() ? 'hidden' : 'absent')) : ('#pm-notes-area is VISIBLE — double-render not removed' && false));
    // (c) refShowNotes scrolls the painted footnote into view (BEFORE the mutations below change notes[0])
    t('refShowNotes() scrolls to the painted footnote (returns true)', () => PM.refShowNotes() === true ? 'scrolled to the painted note' : ('refShowNotes returned false in paged (could not locate the painted footnote)' && false));
    // (d) FORCE a render + a doc transaction → the renderInner paged gate must keep the region absent (this directly
    // exercises the gate: were it removed, WC.NotesArea.render() would create + show #pm-notes-area → a double-render).
    t('WC.NotesArea.render() + a transaction do NOT mount #pm-notes-area (renderInner gate holds)', () => { try { W.editor.commands.insertContent(' more body text'); W.NotesArea.render(); } catch (e) {} return hiddenOrAbsent() ? 'gate holds — no region after forced render+transaction' : ('#pm-notes-area appeared — the paged gate was bypassed' && false); });
    // (e) endnotes ALSO disabled (one region gate covers both) — insert an endnote, force a render, still no region
    t('endnotes also disabled: an endnote + forced render still mounts NO #pm-notes-area', () => { try { PM.refInsertEndnote(); W.NotesArea.render(); } catch (e) {} return hiddenOrAbsent() ? 'still absent/hidden (both note types disabled)' : ('#pm-notes-area appeared for an endnote' && false); });
    // WC.NotesArea facade still defined (guarded no-ops) — must not throw
    t('WC.NotesArea facade stays defined (no throw)', () => (typeof W.NotesArea.render === 'function' && typeof W.NotesArea.showNotes === 'function' && typeof W.NotesArea.refresh === 'function' && (W.NotesArea.refresh(), true)) || ('facade missing/threw' && false));
    return done();
  }

  // ── OVERLAY PARITY — the below-sheet editable region still mounts + renders ──
  t('overlay: #pm-notes-area MOUNTS + is visible (editable region present)', () => !hiddenOrAbsent() ? 'visible' : ('#pm-notes-area not visible in overlay — parity broken' && false));
  t('overlay: the region renders an editable .pm-note-body with the footnote text', () => {
    const el = notesArea(); if (!el) return 'no #pm-notes-area' && false;
    const body = el.querySelector('.pm-note-body');
    return body && (body.textContent || '').indexOf('PROBEFOOTBODY') !== -1 && body.getAttribute('contenteditable') === 'true' ? 'editable note body rendered' : ('no editable .pm-note-body with the footnote text' && false);
  });
  t('overlay: refShowNotes() reveals the region (returns true)', () => PM.refShowNotes() === true ? 'revealed' : ('refShowNotes false in overlay' && false));
  return done();
})();
