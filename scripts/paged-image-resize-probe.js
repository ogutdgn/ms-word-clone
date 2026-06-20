/* Milestone-4b image-resize overlay probe (mode-aware). Run via:
     # paged (the headline check):
     WC_LAYOUT=paged npm run build && \
     electron . --probe-out=/tmp/wc-imageresize.json --shot-evalfile=scripts/paged-image-resize-probe.js
     # overlay parity:
     npm run build && \
     electron . --probe-out=/tmp/wc-imageresize-ovl.json --shot-evalfile=scripts/paged-image-resize-probe.js

   Inserts a sized image, selects it (NodeSelection), and verifies the resize-handle overlay (.wc-img-resize):
     • paged  → WC.PM.coords.nodeBoxFor(imagePos) is finite; the overlay sits on the PAINTED image
                (overlay viewport rect ≈ the painted image's rect, NOT the hidden off-screen image);
                overlayScale() finite.
     • overlay→ nodeBoxFor === the legacy boxFor formula (view.nodeDOM); overlayScale() === WC.PM.zoom.
   Same {summary, results[]} JSON contract. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const view = () => W.view;
  const coords = W.PM && W.PM.coords;
  const NS = window.__PM_NodeSelection;
  // 1x1 transparent PNG; insertImage sizes it via the width/height attrs.
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 200) && false));
  t('layout mode (info)', () => 'mode=' + mode);
  const ok = t('WC.PM.coords.nodeBoxFor + overlayScale present', () => !!(coords && typeof coords.nodeBoxFor === 'function' && typeof coords.overlayScale === 'function' && W.view));
  if (!ok) { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); }

  t('overlayScale() finite > 0', () => { const s = coords.overlayScale(); return Number.isFinite(s) && s > 0 ? ('scale=' + s.toFixed(3)) : ('scale=' + s && false); });

  // ── insert + select an image ──
  let inserted = false;
  try { inserted = W.PM.insertImage && W.PM.insertImage({ src: PNG, alt: 'probe', width: 120, height: 80 }) === true; } catch (e) {}
  // wait for the image node + (paged) its paint
  let imagePos = null;
  for (let i = 0; i < 120; i++) {
    imagePos = null;
    try { view().state.doc.descendants((n, p) => { if (imagePos === null && n.type && n.type.name === 'image') imagePos = p; }); } catch (e) {}
    if (imagePos !== null) break;
    await sleep(50);
  }
  const haveImage = t('inserted an image node', () => imagePos !== null ? ('imagePos=' + imagePos) : ('insertImage=' + inserted + ' — no image node found' && false));

  if (!haveImage || imagePos === null || !NS) {
    // The "inserted an image node" check above already FAILS the gate when no image was inserted; surface a
    // missing NodeSelection too. (No info()-pass here — that would mask the failure.)
    if (!NS) results.push({ name: 'NodeSelection (__PM_NodeSelection) available', pass: false, detail: 'missing — cannot select the image' });
    const p = results.filter((r) => r.pass).length;
    return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2);
  }

  // select the image as a NodeSelection → the resize overlay should appear
  try { view().dispatch(view().state.tr.setSelection(NS.create(view().state.doc, imagePos))); } catch (e) {}
  view().focus && view().focus();
  // Poll until the resize overlay is shown AND (paged) the painted element exists — avoids a flaky fixed sleep.
  const paintedReady = () => mode !== 'paged' || (() => { try { return !!(W.editor.getElementAtPos && W.editor.getElementAtPos(imagePos)); } catch (e) { return false; } })();
  for (let i = 0; i < 60; i++) {
    const ovq = document.querySelector('.wc-img-resize');
    if (ovq && ovq.style.display !== 'none' && paintedReady()) break;
    await sleep(50);
  }

  t('nodeBoxFor(imagePos) returns a finite box', () => {
    const b = coords.nodeBoxFor(imagePos);
    return b && ['left', 'top', 'width', 'height'].every((k) => Number.isFinite(b[k])) && b.width > 0 ? ('w=' + Math.round(b.width) + ' h=' + Math.round(b.height) + ' @ ' + Math.round(b.left) + ',' + Math.round(b.top)) : ('box=' + JSON.stringify(b) && false);
  });

  // the rendered resize overlay element
  const ov = document.querySelector('.wc-img-resize');
  t('.wc-img-resize overlay rendered + shown', () => ov && ov.style.display !== 'none' ? 'shown' : ('overlay ' + (ov ? 'hidden' : 'missing') && false));

  if (mode === 'paged') {
    // PAINTED-AWARE: the overlay must sit on the PAINTED image, not the hidden off-screen one.
    t('resize overlay sits on the PAINTED image (viewport rects ≈)', () => {
      if (!ov) return 'no overlay' && false;
      let paintedEl = null;
      try { paintedEl = W.editor.getElementAtPos ? W.editor.getElementAtPos(imagePos) : null; } catch (e) {}
      if (!paintedEl) return 'no painted element via getElementAtPos' && false;
      const o = ov.getBoundingClientRect(), pi = paintedEl.getBoundingClientRect();
      const d = Math.max(Math.abs(o.left - pi.left), Math.abs(o.top - pi.top), Math.abs(o.width - pi.width), Math.abs(o.height - pi.height));
      return d <= 6 ? ('Δ=' + Math.round(d) + 'px (overlay@' + Math.round(o.left) + ',' + Math.round(o.top) + ' painted@' + Math.round(pi.left) + ',' + Math.round(pi.top) + ')') : ('Δ=' + Math.round(d) + 'px too far — overlay NOT on the painted image' && false);
    });
    t('painted image box differs from the hidden view.nodeDOM box (proves painted-aware)', () => {
      let hidden = null, painted = null;
      try { hidden = view().nodeDOM(imagePos)?.getBoundingClientRect?.(); } catch (e) {}
      try { painted = W.editor.getElementAtPos?.(imagePos)?.getBoundingClientRect?.(); } catch (e) {}
      if (!hidden || !painted) return ('hidden=' + !!hidden + ' painted=' + !!painted) && false;
      const d = Math.max(Math.abs(hidden.left - painted.left), Math.abs(hidden.top - painted.top));
      return d > 5 ? ('Δ(hidden,painted)=' + Math.round(d) + 'px') : ('Δ=' + Math.round(d) + ' — too close; nodeBoxFor may be reading the hidden view' && false);
    });
    // M4b.1: a synthetic SE-handle drag must resize the PAINTED <img> LIVE (during the drag, pre-commit) AND
    // commit that size on pointer-up. We measure the INNER <img> (the pixels the user sees), not just the
    // [data-pm] wrapper, so a write that inflates only the wrapper can't false-pass. The drag runs OUTSIDE
    // t() so a try/finally can always fire pointer-up (no leaked window listeners if a measure throws).
    const imgOf = (el) => (el ? (el.tagName === 'IMG' ? el : el.querySelector('img')) : null);
    const paintedAt = () => { try { return W.editor.getElementAtPos(imagePos); } catch (e) { return null; } };
    const paintedEl = paintedAt();
    const handle = document.querySelector('.wc-img-handle-se');
    const beforeW = imgOf(paintedEl) ? imgOf(paintedEl).getBoundingClientRect().width : null;
    let duringW = null, dragThrew = null;
    if (paintedEl && handle && beforeW != null) {
      const hr = handle.getBoundingClientRect();
      const cx = hr.left + hr.width / 2, cy = hr.top + hr.height / 2;
      try {
        handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, button: 0, buttons: 1, pointerId: 9, isPrimary: true, bubbles: true, cancelable: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 80, clientY: cy + 53, buttons: 1, pointerId: 9, bubbles: true }));
        const im = imgOf(paintedEl); // SAME element across the drag (no repaint mid-drag) — its <img> shows the preview
        duringW = im ? im.getBoundingClientRect().width : null;
      } catch (e) { dragThrew = (e && e.message) || String(e); }
      finally { window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx + 80, clientY: cy + 53, pointerId: 9, bubbles: true })); }
    }
    t('dragging a handle resizes the PAINTED <img> LIVE (during drag, pre-commit)', () => {
      if (!paintedEl || !handle) return ('paintedEl=' + !!paintedEl + ' seHandle=' + !!handle) && false;
      if (beforeW == null || duringW == null) return ('no inner <img> rect (before=' + beforeW + ' during=' + duringW + ')') && false;
      if (dragThrew) return ('drag threw: ' + dragThrew) && false;
      return duringW > beforeW + 5 ? ('img W ' + Math.round(beforeW) + '→' + Math.round(duringW) + ' DURING drag') : ('img W ' + Math.round(beforeW) + '→' + Math.round(duringW) + ' — image did NOT resize live (only the outline)' && false);
    });
    // COMMIT outcome: after the pointer-up repaint, the FRESH painted <img> must HOLD the dragged-to size —
    // proves the commit took and no stale inline style fights PE's repaint. Poll for the rebuilt element.
    let committedW = null;
    if (duringW != null) {
      for (let i = 0; i < 50; i++) {
        await sleep(50);
        const im = imgOf(paintedAt());
        const w = im ? im.getBoundingClientRect().width : null;
        if (w != null) { committedW = w; if (Math.abs(w - duringW) <= 8) break; }
      }
    }
    t('commit: painted image HOLDS the dragged-to size after pointer-up', () => {
      if (duringW == null) return 'no live size to compare' && false;
      if (committedW == null) return 'no painted image after commit' && false;
      return Math.abs(committedW - duringW) <= 8 ? ('committed W ' + Math.round(committedW) + ' ≈ dragged ' + Math.round(duringW)) : ('committed W ' + Math.round(committedW) + ' ≠ dragged ' + Math.round(duringW) + ' — commit/stale-style mismatch' && false);
    });
  } else {
    // OVERLAY PARITY — nodeBoxFor === the legacy boxFor formula (view.nodeDOM rect → #pages-local / WC.PM.zoom).
    const legacyBox = () => {
      const dom = view().nodeDOM(imagePos);
      if (!dom || !dom.getBoundingClientRect) return null;
      const pages = document.getElementById('pages'); if (!pages) return null;
      const z = (W.PM && W.PM.zoom) || 1;
      const r = dom.getBoundingClientRect(); const pr = pages.getBoundingClientRect();
      return { left: (r.left - pr.left) / z, top: (r.top - pr.top) / z, width: r.width / z, height: r.height / z };
    };
    t('overlay: nodeBoxFor === legacy boxFor (byte-identical)', () => {
      const a = coords.nodeBoxFor(imagePos), b = legacyBox();
      if (!a || !b) return 'a=' + JSON.stringify(a) + ' b=' + JSON.stringify(b) && false;
      const same = ['left', 'top', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) < 0.5);
      return same ? ('box w=' + Math.round(a.width)) : ('mismatch a=' + JSON.stringify(a) + ' b=' + JSON.stringify(b) && false);
    });
    t('overlay: overlayScale() === WC.PM.zoom', () => {
      const s = coords.overlayScale(), z = (W.PM && W.PM.zoom) || 1;
      return Math.abs(s - z) < 1e-6 ? ('scale=' + s) : ('scale=' + s + ' zoom=' + z && false);
    });
  }

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, mode }, results }, null, 2);
})()
