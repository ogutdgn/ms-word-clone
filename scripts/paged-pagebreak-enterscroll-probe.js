/* BUG 1 probe: Enter on page 1 (with a page-2 pageBreakBefore para present) scrolls the VIEW to the bottom
   while the caret stays correct. Reproduces faithfully: builds the 2-page break state, scrolls to page 1,
   places caret in the page-1 paragraph, types text, then performs a REAL Enter (split + scrollIntoView, the
   same tr splitBlock.js dispatches), and samples scrollTop + caret page before/after to catch the view jump. */
(async () => {
  const out = { mode: null, ready: false, steps: {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  out.ready = window.__WC_READY === true;
  out.mode = window.__WC_LAYOUT_MODE;
  const view = () => W.view;
  const doc = () => view().state.doc;
  const sel = () => view().state.selection.from;
  const TS = window.__PM_TextSelection;
  const setCaret = (pos) => { try { view().dispatch(view().state.tr.setSelection(TS.create(doc(), pos))); } catch (e) {} };
  const caretPage = (pos) => { try { const r = W.presentation.computeCaretLayoutRect(pos == null ? sel() : pos); return r ? { page: r.pageIndex + 1, x: Math.round(r.x), y: Math.round(r.y), h: Math.round(r.height) } : 'null'; } catch (e) { return 'ERR ' + e.message; } };

  // find the scroller
  const findScroller = () => {
    const cands = ['.presentation-editor', '#pages', '#pm-editor', '.superdoc-pages'];
    for (const sB of cands) { const el = document.querySelector(sB); if (el && el.scrollHeight > el.clientHeight + 4) return { sel: sB, el }; }
    let n = document.querySelector('[data-page-index="0"]');
    while (n && n !== document.body) { if (n.scrollHeight > n.clientHeight + 4 && getComputedStyle(n).overflowY !== 'visible') return { sel: '(anc)', el: n }; n = n.parentElement; }
    return { sel: 'scrollingElement', el: document.scrollingElement || document.documentElement };
  };

  // reset to a clean empty doc
  try {
    W.editor.commands.selectAll(); W.editor.commands.deleteSelection();
    W.editor.commands.selectAll(); W.editor.commands.unsetAllMarks();
    W.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']);
  } catch (e) {}
  setCaret(1); try { view().focus(); } catch (e) {}
  await sleep(150);

  // page break -> 2 pages
  W.PM.insertPageBreak();
  await sleep(300);
  const scr = findScroller();
  out.steps.scroller = scr.sel;
  out.steps.afterBreak = { caret: sel(), caretPage: caretPage(), pages: W.presentation.getPages().length, scrollTop: Math.round(scr.el.scrollTop), clientH: Math.round(scr.el.clientHeight), scrollH: Math.round(scr.el.scrollHeight) };

  // doc structure (find the page-1 paragraph position)
  const struct = []; let pos = 0;
  doc().forEach((n) => { struct.push({ type: n.type.name, start: pos + 1, pbb: !!(n.attrs && n.attrs.paragraphProperties && n.attrs.paragraphProperties.pageBreakBefore), text: (n.textContent || '').slice(0, 12) }); pos += n.nodeSize; });
  out.steps.struct = struct;
  const page1Para = struct[0]; // first para on page 1

  // scroll to page 1 top + click-place caret in the page-1 paragraph
  try { const p1 = document.querySelector('[data-page-index="0"]'); if (p1 && p1.scrollIntoView) p1.scrollIntoView({ block: 'start' }); } catch (e) {}
  try { scr.el.scrollTop = 0; } catch (e) {}
  await sleep(120);
  setCaret(page1Para.start); try { view().focus(); } catch (e) {}
  await sleep(120);

  // type some text into page-1 paragraph (so Enter splits a non-empty line)
  try { view().dispatch(view().state.tr.insertText('Hello page one', sel()).scrollIntoView()); } catch (e) {}
  await sleep(150);
  // re-anchor scroll to page 1 top (typing may have scrolled)
  try { scr.el.scrollTop = 0; } catch (e) {}
  await sleep(120);
  out.steps.beforeEnter = { caret: sel(), caretPage: caretPage(), scrollTop: Math.round(scr.el.scrollTop), p1Top: (() => { const e = document.querySelector('[data-page-index="0"]'); return e ? Math.round(e.getBoundingClientRect().top) : null; })(), p2Top: (() => { const e = document.querySelector('[data-page-index="1"]'); return e ? Math.round(e.getBoundingClientRect().top) : null; })() };

  // caret-element screen rect BEFORE Enter
  const caretElRect = () => { const c = document.querySelector('.presentation-editor__selection-caret'); return c ? (() => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })() : 'no-caret-el'; };
  out.steps.beforeEnter.caretElRect = caretElRect();

  // ---- THE REAL ENTER: dispatch a genuine keydown on the PM view DOM (the hidden contenteditable),
  // exercising the real keymap (splitBlock + scrollIntoView) AND the native caret-tracking scroll path. ----
  const scrollBefore = Math.round(scr.el.scrollTop);
  out.steps.viewDomInfo = (() => { try { const d = view().dom; const wrap = d.closest('.presentation-editor__hidden-host-wrapper'); const wcs = wrap ? getComputedStyle(wrap) : null; return { tag: d.tagName, cls: String(d.className).slice(0, 40), hasFocus: view().hasFocus(), insideHiddenWrapper: !!wrap, wrapperOverflow: wcs ? wcs.overflow : null, wrapperSize: wrap ? Math.round(wrap.getBoundingClientRect().width) + 'x' + Math.round(wrap.getBoundingClientRect().height) : null }; } catch (e) { return 'ERR ' + e.message; } })();
  // snapshot scrollTop of every scrollable ancestor before Enter so we can see WHICH element scrolls
  const scrollables = []; { let n = scr.el; const all = document.querySelectorAll('*'); for (const e of all) { try { if (e.scrollHeight > e.clientHeight + 4) scrollables.push(e); } catch (x) {} } }
  const snapScrolls = () => scrollables.map((e) => ({ id: (e.id || e.className || e.tagName).toString().slice(0, 30), top: Math.round(e.scrollTop) }));
  out.steps.scrollablesBefore = snapScrolls();
  // Patch the canvas scroll API to capture WHO scrolls it + a synchronous stack.
  out.steps.scrollTrace = [];
  try {
    const canvas = scrollables.find((e) => /canvas/.test((e.id || e.className || '').toString()));
    if (canvas) {
      const proto = Object.getPrototypeOf(canvas);
      const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
      Object.defineProperty(canvas, 'scrollTop', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) { const before = desc.get.call(this); if (Math.abs(v - before) > 2) { out.steps.scrollTrace.push({ via: 'scrollTop=', from: Math.round(before), to: Math.round(v), stack: (new Error().stack || '').split('\n').slice(1, 8).map((s) => s.trim().replace(/https?:\S*?\/([^/]+:\d+:\d+)/, '$1')) }); } desc.set.call(this, v); },
      });
      const origTo = canvas.scrollTo.bind(canvas);
      canvas.scrollTo = function (...a) { const top = (a[0] && typeof a[0] === 'object') ? a[0].top : a[1]; out.steps.scrollTrace.push({ via: 'scrollTo', to: Math.round(top), stack: (new Error().stack || '').split('\n').slice(1, 8).map((s) => s.trim().replace(/https?:\S*?\/([^/]+:\d+:\d+)/, '$1')) }); return origTo(...a); };
      const origBy = canvas.scrollBy.bind(canvas);
      canvas.scrollBy = function (...a) { const top = (a[0] && typeof a[0] === 'object') ? a[0].top : a[1]; out.steps.scrollTrace.push({ via: 'scrollBy', delta: Math.round(top), stack: (new Error().stack || '').split('\n').slice(1, 8).map((s) => s.trim().replace(/https?:\S*?\/([^/]+:\d+:\d+)/, '$1')) }); return origBy(...a); };
    }
  } catch (e) { out.steps.hookErr = e.message; }
  try {
    const d = view().dom;
    try { view().focus(); } catch (e) {}
    const kd = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true });
    d.dispatchEvent(kd);
  } catch (e) { out.steps.enterErr = e.message; }
  out.steps.afterEnterImmediate = { caret: sel(), scrollTop: Math.round(scr.el.scrollTop), scrollablesAfter: snapScrolls() };

  // sample scrollTop right after Enter (catch the jump)
  const samples = [];
  for (let i = 0; i < 10; i++) { await sleep(60); samples.push(Math.round(scr.el.scrollTop)); }
  out.steps.afterEnter = {
    caret: sel(),
    caretPage: caretPage(),
    caretElRect: caretElRect(),
    scrollBefore,
    scrollSamples: samples,
    scrollTopFinal: Math.round(scr.el.scrollTop),
    p1Top: (() => { const e = document.querySelector('[data-page-index="0"]'); return e ? Math.round(e.getBoundingClientRect().top) : null; })(),
    p2Top: (() => { const e = document.querySelector('[data-page-index="1"]'); return e ? Math.round(e.getBoundingClientRect().top) : null; })(),
  };
  out.steps.verdict = {
    caretStayedOnPage1: out.steps.afterEnter.caretPage && out.steps.afterEnter.caretPage.page === 1,
    viewJumpedDown: out.steps.afterEnter.scrollTopFinal - scrollBefore,
    BUG_REPRODUCED: (out.steps.afterEnter.scrollTopFinal - scrollBefore) > 50 && out.steps.afterEnter.caretPage && out.steps.afterEnter.caretPage.page === 1,
  };

  return JSON.stringify(out, null, 2);
})()
