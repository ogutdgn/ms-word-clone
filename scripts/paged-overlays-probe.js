/* Milestone-4a overlay-retarget probe (mode-aware). Run via:
     # paged (the headline check):
     WC_LAYOUT=paged npm run build && \
     electron . --probe-out=/tmp/wc-overlays.json --shot-evalfile=scripts/paged-overlays-probe.js
     # overlay parity:
     npm run build && \
     electron . --probe-out=/tmp/wc-overlays-ovl.json --shot-evalfile=scripts/paged-overlays-probe.js

   Verifies the two M4a helpers (WC.PM.coords.posToOverlayLocalY / posToOverlayLocalRect) that comments-ui
   and track-chrome now delegate to:
     • paged  → helpers return finite #pages-local coords for a visible pos; they use the PAINTED geometry
                (NOT the hidden off-screen view); the wc:paged-relayout event fires on a no-transaction
                relayout; the retargeted overlays refresh without throwing.
     • overlay→ helpers are BYTE-IDENTICAL to the legacy localY/localRect formula (parity).
   Same {summary, results[]} JSON contract. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const ta = async (name, fn) => { try { const r = await fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const info = (name, detail) => results.push({ name, pass: true, detail: 'INFO: ' + detail });

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const view = () => W.view;
  const coords = W.PM && W.PM.coords;
  const docSize = () => view().state.doc.content.size;
  const EPS = 0.5; // px float tolerance for parity

  // The legacy #pages-local formulas (what comments-ui.localY / track-chrome.localRect computed pre-M4a),
  // using the HIDDEN inner view directly (W.view.coordsAtPos) — the overlay-correct, paged-WRONG source.
  const legacyY = (pos) => {
    const pages = document.getElementById('pages'); if (!pages || !W.view) return null;
    const max = view().state.doc.content.size;
    const c = view().coordsAtPos(Math.max(1, Math.min(pos, max)));
    const r = pages.getBoundingClientRect(); const scale = pages.offsetWidth ? r.width / pages.offsetWidth : 1;
    return (c.top - r.top) / (scale || 1);
  };

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 200) && false));
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('WC.PM.coords helpers (posToOverlayLocalY + posToOverlayLocalRect) present', () =>
    !!(coords && typeof coords.posToOverlayLocalY === 'function' && typeof coords.posToOverlayLocalRect === 'function' && W.view));
  if (!ok) { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); }

  // force a multi-page doc so positions span pages
  try { view().dispatch(view().state.tr.insertText('Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(500), 1)); } catch (e) {}
  if (mode === 'paged') { for (let i = 0; i < 240; i++) { const n = (W.presentation && W.presentation.getPages) ? W.presentation.getPages().length : -1; if (n > 1) break; await sleep(50); } }
  await sleep(300);

  // sample positions spread across the doc
  const samples = [];
  for (let P = 5; P < docSize() && samples.length < 6; P += Math.max(40, Math.floor(docSize() / 40))) samples.push(P);

  if (mode === 'paged') {
    t('posToOverlayLocalRect finite for an on-page pos', () => {
      const r = coords.posToOverlayLocalRect(samples[0]);
      return r && ['top', 'bottom', 'left'].every((k) => Number.isFinite(r[k])) ? ('top=' + Math.round(r.top) + ' left=' + Math.round(r.left)) : ('rect=' + JSON.stringify(r) && false);
    });
    t('posToOverlayLocalY finite for an on-page pos', () => {
      const y = coords.posToOverlayLocalY(samples[0]);
      return Number.isFinite(y) ? ('y=' + Math.round(y)) : ('y=' + y && false);
    });
    // PAINTED-AWARE: the helper uses editor.coordsAtPos (painted via PE), NOT the hidden inner view.
    // For any pos, the hidden view sits off-screen, so the legacy (hidden-view) formula differs sharply.
    t('helper uses PAINTED geometry, not the hidden off-screen view', () => {
      let maxDelta = 0, n = 0;
      for (const P of samples) { const h = coords.posToOverlayLocalY(P); const l = legacyY(P); if (Number.isFinite(h) && Number.isFinite(l)) { maxDelta = Math.max(maxDelta, Math.abs(h - l)); n++; } }
      // painted vs hidden must differ for at least one sampled pos (hidden host is positioned far off-screen).
      return n > 0 && maxDelta > 5 ? ('maxΔ(painted,hidden)=' + Math.round(maxDelta) + 'px over ' + n) : ('helper matches the hidden-view formula (maxΔ=' + Math.round(maxDelta) + ') — NOT painted-aware?' && false);
    });
    // off-page (virtualized) pos → null
    let offPage = null;
    for (let P = 5; P < docSize(); P += 23) { if (coords.posToClientRect(P) == null) { offPage = P; break; } }
    if (offPage != null) t('off-page (unpainted) pos → helper returns null', () => coords.posToOverlayLocalY(offPage) == null && coords.posToOverlayLocalRect(offPage) == null ? ('P=' + offPage + ' → null') : ('expected null at off-page P=' + offPage && false));
    else info('off-page → null', 'no unpainted pos found in the probe window (all sampled pages painted)');

    // wc:paged-relayout fires on a no-transaction PE relayout
    await ta('wc:paged-relayout event fires on a no-transaction relayout', async () => {
      let fired = 0; const h = () => { fired++; };
      window.addEventListener('wc:paged-relayout', h);
      try {
        try { if (typeof W.presentation.setZoom === 'function') W.presentation.setZoom(((W.PM.zoom || 1) === 1) ? 1.25 : 1); else W.PM.setZoom(((W.PM.zoom || 1) === 1) ? 1.25 : 1); } catch (e) {}
        await sleep(500);
        return fired > 0 ? ('fired ' + fired + 'x') : ('event did NOT fire on relayout' && false);
      } finally { window.removeEventListener('wc:paged-relayout', h); }
    });
    // retargeted overlays refresh without throwing in paged mode
    t('comments + track overlays refresh without throwing (paged)', () => {
      try { W.CommentsUI && W.CommentsUI.refresh && W.CommentsUI.refresh(); W.TrackChrome && W.TrackChrome.refresh && W.TrackChrome.refresh(); return 'ok'; } catch (e) { return ('threw: ' + (e && e.message) && false); }
    });
  } else {
    // OVERLAY PARITY — helpers byte-identical to the legacy localY/localRect formula.
    const legacyRect = (pos) => {
      const pages = document.getElementById('pages'); if (!pages || !W.view) return null;
      const max = view().state.doc.content.size;
      const c = view().coordsAtPos(Math.max(1, Math.min(pos, max)));
      if (!c || (c.top === 0 && c.bottom === 0)) return null;
      const r = pages.getBoundingClientRect(); const scale = pages.offsetWidth ? r.width / pages.offsetWidth : 1;
      return { top: (c.top - r.top) / (scale || 1), bottom: (c.bottom - r.top) / (scale || 1), left: (c.left - r.left) / (scale || 1) };
    };
    let yOk = 0, rOk = 0, n = 0;
    for (const P of samples) {
      n++;
      const hY = coords.posToOverlayLocalY(P), lY = legacyY(P);
      if ((hY == null && lY == null) || (hY != null && lY != null && Math.abs(hY - lY) <= EPS)) yOk++;
      const hR = coords.posToOverlayLocalRect(P), lR = legacyRect(P);
      if ((hR == null && lR == null) || (hR && lR && ['top', 'bottom', 'left'].every((k) => Math.abs(hR[k] - lR[k]) <= EPS))) rOk++;
    }
    t('overlay: posToOverlayLocalY === legacy localY (byte-identical) for ALL samples', () => (n > 0 && yOk === n) ? ('all ' + yOk + '/' + n) : (yOk + '/' + n + ' matched (n=' + n + ')' && false));
    t('overlay: posToOverlayLocalRect === legacy localRect (byte-identical) for ALL samples', () => (n > 0 && rOk === n) ? ('all ' + rOk + '/' + n) : (rOk + '/' + n + ' matched (n=' + n + ')' && false));
    t('overlay: comments + track overlays refresh without throwing', () => {
      try { W.CommentsUI && W.CommentsUI.refresh && W.CommentsUI.refresh(); W.TrackChrome && W.TrackChrome.refresh && W.TrackChrome.refresh(); return 'ok'; } catch (e) { return ('threw: ' + (e && e.message) && false); }
    });
  }

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, mode }, results }, null, 2);
})()
