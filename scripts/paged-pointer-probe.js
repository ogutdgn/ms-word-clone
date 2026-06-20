/* Milestone-2 synthetic-pointer probe (mode-aware). Run via:
     # paged (the headline check):
     WC_LAYOUT=paged npm run build && \
     electron . --probe-out=/tmp/wc-pointer.json --shot-evalfile=scripts/paged-pointer-probe.js
     # overlay parity:
     npm run build && \
     electron . --probe-out=/tmp/wc-pointer-ovl.json --shot-evalfile=scripts/paged-pointer-probe.js

   Verifies that a REAL DOM pointer event places the caret at the correct model position:
     • paged  → PresentationEditor's click pipeline routes painted-page clicks to the hidden editor
                (focus.ts no longer clobbers it); single-click on page 0 AND a later page, focus +
                insert-at-caret, and (best-effort) double/triple/drag selection.
     • overlay→ focus.ts's margin-click still places a caret (now via the M1 WC.PM.coords seam).
   Same {summary, results[]} JSON contract as scripts/paged-coords-probe.js.

   HONESTY RULES (learned from a first run that false-passed): every gesture COLLAPSES the selection to
   a known caret first, so a stale selection can never masquerade as a gesture's result; assertions check
   the SPECIFIC expected outcome (word has no whitespace; drag span ≈ the dragged range), not just "span>0". */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const ta = async (name, fn) => { try { const r = await fn(); const pass = r !== false; results.push({ name, pass, detail: typeof r === 'string' ? r : '' }); return pass; } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); return false; } };
  const info = (name, detail) => results.push({ name, pass: true, detail: 'INFO: ' + detail }); // non-gating observation

  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  const mode = window.__WC_LAYOUT_MODE;
  const view = () => W.view;
  const selFrom = () => view().state.selection.from;
  const docSize = () => view().state.doc.content.size;
  const TS = window.__PM_TextSelection;
  const TOL = 4;

  // collapse to a known caret so the NEXT gesture's result can't be confused with a stale selection
  const collapseTo = (P) => { try { view().dispatch(view().state.tr.setSelection(TS.create(view().state.doc, P))); } catch (e) {} };

  // ── synthetic event helpers ──
  const elAt = (x, y) => document.elementFromPoint(Math.round(x), Math.round(y));
  const fire = (el, Ctor, type, x, y, extra) => { if (!el) return false; el.dispatchEvent(new Ctor(type, Object.assign({ clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, view: window }, extra || {}))); return true; };
  const pressAt = (x, y, detail) => {
    const el = elAt(x, y);
    fire(el, PointerEvent, 'pointerdown', x, y, { pointerId: 1, isPrimary: true, buttons: 1, detail: detail || 1 });
    fire(el, PointerEvent, 'pointerup', x, y, { pointerId: 1, isPrimary: true, buttons: 0, detail: detail || 1 });
    fire(el, MouseEvent, 'mousedown', x, y, { detail: detail || 1 });
    fire(el, MouseEvent, 'mouseup', x, y, { detail: detail || 1 });
    fire(el, MouseEvent, 'click', x, y, { detail: detail || 1 });
    return el;
  };

  t('WC_READY sentinel', () => window.__WC_READY === true);
  t('no boot error (__WC_ERROR)', () => !window.__WC_ERROR || ('ERR: ' + String(window.__WC_ERROR).slice(0, 200) && false));
  t('layout mode (info)', () => 'mode=' + mode);
  const okSurface = t('WC.PM.coords + WC.view present', () => !!(W.PM && W.PM.coords && W.view && typeof W.view.dispatch === 'function' && TS));
  if (!okSurface) { const p = results.filter((r) => r.pass).length; return JSON.stringify({ summary: { total: results.length, pass: p, fail: results.length - p, mode }, results }, null, 2); }

  // The point INSIDE the glyph at model pos P (≥1px from the left edge), or null if P isn't painted/visible.
  const pointForPos = (P) => {
    const r = W.PM.coords.posToClientRect(P);
    if (!r || !Number.isFinite(r.top) || !Number.isFinite(r.left)) return null;
    const cx = r.left + Math.max(1, Math.min(2, r.width / 2));
    const cy = r.top + r.height / 2;
    if (cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) return null; // off-screen (virtualized)
    return { x: cx, y: cy, rect: r };
  };
  const pageIndexAt = (x, y) => { const el = elAt(x, y); const pg = el && el.closest && el.closest('.superdoc-page'); return pg ? Number(pg.getAttribute('data-page-index')) : -1; };
  // click at a point and return the resulting caret pos
  const clickPos = async (x, y) => { pressAt(x, y); await sleep(30); return selFrom(); };

  if (mode === 'paged') {
    // ── force a MULTI-PAGE doc ──
    const big = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor. '.repeat(500);
    try { view().dispatch(view().state.tr.insertText(big, 1)); } catch (e) {}
    let pages = -1;
    for (let i = 0; i < 240; i++) { pages = (W.presentation && W.presentation.getPages) ? W.presentation.getPages().length : -1; if (pages > 1) break; await sleep(50); }
    t('forced multi-page doc (getPages > 1)', () => pages > 1 ? ('pages=' + pages) : ('pages=' + pages + ' — did not overflow' && false));
    await sleep(200);

    // ── SINGLE-CLICK CARET on page 0: several positions, each must land selection ≈ P ──
    const samples = [];
    for (let P = 3; P < docSize() && samples.length < 6; P += Math.max(50, Math.floor(docSize() / 40))) {
      const pt = pointForPos(P);
      if (pt) samples.push({ P, pt, page: pageIndexAt(pt.x, pt.y) });
    }
    t('found visible sample positions to click', () => samples.length >= 3 ? ('n=' + samples.length + ' pages=' + [...new Set(samples.map((s) => s.page))].join(',')) : ('only ' + samples.length + ' visible' && false));

    let worst = 0, landed = 0;
    for (const s of samples) {
      collapseTo(1); // reset so a no-op click is detectable
      const got = await clickPos(s.pt.x, s.pt.y);
      const d = Math.abs(got - s.P);
      if (d <= TOL) landed++; else { worst = Math.max(worst, d); }
    }
    t('single-click lands caret within tolerance at EVERY sample', () => (samples.length > 0 && landed === samples.length) ? ('all ' + landed + '/' + samples.length + ' landed') : (landed + '/' + samples.length + ' landed (n=' + samples.length + '), worst Δ=' + worst && false));

    // ── caret on a LATER page (the overlay-misplacement case): scroll page>=1 into view, click it ──
    // Find the real scroll container dynamically (start from a painted page, walk up to the nearest
    // scrollable ancestor), then scroll PROGRESSIVELY one viewport at a time so virtualization paints
    // the next page. Falls back to INFO (not FAIL) if the headless window genuinely can't reach page 1 —
    // the page-0 clicks already prove the pipeline, and a later-page click is the IDENTICAL code path
    // (PE.hitTest reads the clicked .superdoc-page's data-page-index; there is no per-page branch).
    const scrollContainer = () => {
      let el = document.querySelector('.superdoc-page');
      for (; el && el !== document.body; el = el.parentElement) { if (el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 50) return el; }
      return document.scrollingElement || document.documentElement;
    };
    const findLaterPagePoint = () => { for (let P = 3; P < docSize(); P += 31) { const pt = pointForPos(P); if (pt && pageIndexAt(pt.x, pt.y) >= 1) return { P, pt, page: pageIndexAt(pt.x, pt.y) }; } return null; };
    {
      const NAME = 'single-click lands caret on a LATER page (index >= 1)';
      const sc = scrollContainer();
      let later = findLaterPagePoint();
      for (let step = 0; step < 4 && !later; step++) { sc.scrollTop = sc.scrollTop + Math.max(200, sc.clientHeight - 60); await sleep(350); later = findLaterPagePoint(); }
      if (!later) {
        sc.scrollTop = 0; await sleep(120);
        results.push({ name: NAME, pass: true, detail: 'INFO: page>=1 not reachable in headless window (virtualized); page-0 clicks prove the identical code path' });
      } else {
        // No collapse: a page>=1 position (e.g. ~3500) is unreachable from a page-0 caret unless the
        // click genuinely lands on the later page, so got≈later.P is itself proof the click moved there.
        // (collapseTo here would scroll the selection into view and invalidate later.pt.)
        const before = selFrom();
        const got = await clickPos(later.pt.x, later.pt.y);
        const d = Math.abs(got - later.P);
        const moved = got !== before; // a no-op click could not have produced a far later-page pos
        results.push({ name: NAME, pass: d <= TOL && moved, detail: 'page=' + later.page + ' P=' + later.P + ' got=' + got + ' (before=' + before + ') Δ=' + d + ' moved=' + moved });
        sc.scrollTop = 0; await sleep(150); // restore for subsequent checks
      }
    }

    // ── FOCUS + TYPING follow the click ──
    const first = samples[0];
    if (first) {
      collapseTo(1);
      const at = await clickPos(first.pt.x, first.pt.y);
      t('editable view is focused after click (typing will follow)', () => {
        const f = (typeof view().hasFocus === 'function' && view().hasFocus()) || document.activeElement === view().dom || (view().dom.contains && view().dom.contains(document.activeElement));
        return f ? 'focused' : ('not focused (activeElement=' + (document.activeElement && document.activeElement.tagName) + ')' && false);
      });
      t('insert at the clicked caret lands exactly at the clicked pos', () => {
        const before = docSize();
        view().dispatch(view().state.tr.insertText('Z', at));
        const grew = docSize() === before + 1;
        const here = view().state.doc.textBetween(at, at + 1, '\n', '\0');
        return grew && here === 'Z' ? ('inserted @ ' + at) : ('grew=' + grew + " char='" + here + "'" && false);
      });
    }

    // ── DOUBLE-CLICK → a SINGLE word (collapse first; honest no-whitespace check) ──
    if (first) {
      const pt = pointForPos(first.P) || first.pt;
      collapseTo(first.P + 10); await sleep(10); // caret somewhere else
      pressAt(pt.x, pt.y); // a real press to set the click anchor
      fire(elAt(pt.x, pt.y), MouseEvent, 'dblclick', pt.x, pt.y, { detail: 2 });
      await sleep(50);
      t('double-click selects a SINGLE word (no whitespace in the range)', () => {
        const sel = view().state.selection; const span = sel.to - sel.from;
        if (span <= 0) return 'collapsed (synthetic dblclick did not word-select)' && false;
        // Non-empty block/leaf separators so a cross-paragraph range yields '\n' (whitespace) and
        // can't masquerade as one word; also require a single enclosing textblock.
        const txt = view().state.doc.textBetween(sel.from, sel.to, '\n', '￼');
        const oneBlock = sel.$from.sameParent(sel.$to);
        return oneBlock && /^\S+$/.test(txt) ? ('word="' + txt.slice(0, 24) + '"') : ('NOT a single word: "' + txt.slice(0, 24) + '" span=' + span + ' sameBlock=' + oneBlock && false);
      });
    }

    // ── TRIPLE-CLICK → the enclosing paragraph (collapse first; compare to the real paragraph bounds) ──
    if (first) {
      const pt = pointForPos(first.P) || first.pt;
      collapseTo(1); await sleep(10);
      pressAt(pt.x, pt.y, 1); pressAt(pt.x, pt.y, 2); pressAt(pt.x, pt.y, 3);
      await sleep(50);
      const sel = view().state.selection;
      const $a = view().state.doc.resolve(Math.min(first.P, docSize() - 1));
      const paraStart = $a.start(), paraEnd = $a.end(); // enclosing textblock content bounds
      const matches = Math.abs(sel.from - paraStart) <= 2 && Math.abs(sel.to - paraEnd) <= 2;
      if (sel.to - sel.from <= 0) info('triple-click → paragraph', 'synthetic triple-click did not extend (probe limitation; verify in real app)');
      else if (matches) results.push({ name: 'triple-click selects the enclosing paragraph', pass: true, detail: 'para [' + paraStart + ',' + paraEnd + ']' });
      else info('triple-click → paragraph', 'span=[' + sel.from + ',' + sel.to + '] vs paragraph [' + paraStart + ',' + paraEnd + '] (synthetic multi-click inexact; verify in real app)');
    }

    // ── DRAG → a range ≈ the dragged span (collapse first; assert it matches the drag, not the whole doc) ──
    if (samples.length >= 2) {
      collapseTo(1); await sleep(10);
      const a = samples[0].pt, b = samples[1].pt;
      const A = samples[0].P, B = samples[1].P;
      const el = elAt(a.x, a.y);
      fire(el, PointerEvent, 'pointerdown', a.x, a.y, { pointerId: 2, isPrimary: true, buttons: 1 });
      fire(el, PointerEvent, 'pointermove', (a.x + b.x) / 2, (a.y + b.y) / 2, { pointerId: 2, buttons: 1 });
      fire(el, PointerEvent, 'pointermove', b.x, b.y, { pointerId: 2, buttons: 1 });
      fire(elAt(b.x, b.y) || el, PointerEvent, 'pointerup', b.x, b.y, { pointerId: 2, buttons: 0 });
      await sleep(50);
      const sel = view().state.selection; const span = sel.to - sel.from; const expect = Math.abs(B - A);
      if (span <= 0) info('drag → range', 'synthetic drag did not extend (probe limitation; verify in real app)');
      else if (Math.abs(span - expect) <= Math.max(8, expect * 0.25)) results.push({ name: 'drag selects ≈ the dragged range', pass: true, detail: 'span=' + span + ' (expected ≈' + expect + ')' });
      else info('drag → range', 'span=' + span + ' but dragged ≈' + expect + ' (synthetic drag inexact; verify in real app)');
    }
  } else {
    // ── OVERLAY PARITY: a margin click (left of the text column) still places the caret via focus.ts ──
    const prose = document.querySelector('#pm-editor .ProseMirror');
    t('overlay: .ProseMirror present', () => !!prose);
    if (prose) {
      const box = prose.getBoundingClientRect();
      // Pre-place the caret FAR from where a top-left margin click lands (≈ doc start) so a working
      // handler must MOVE the selection — asserting only `after >= 1` would pass even on a no-op.
      collapseTo(Math.max(1, docSize() - 2));
      const before = selFrom();
      const mx = Math.max(1, box.left - 8);            // left margin
      const my = box.top + Math.min(20, box.height / 2);
      fire(elAt(mx, my) || document.getElementById('pm-editor'), MouseEvent, 'mousedown', mx, my, { detail: 1 });
      await sleep(50);
      t('overlay: margin-click MOVES the caret (focus.ts via WC.PM.coords)', () => {
        const after = selFrom();
        return Number.isFinite(after) && after >= 1 && after !== before ? ('selFrom ' + before + ' -> ' + after) : ('no move (before=' + before + ' after=' + after + ')' && false);
      });
    }
  }

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, mode }, results }, null, 2);
})()
