/* REGRESSION guard for the Bug-1 fix: typing/Enter past the viewport bottom MUST still scroll the view to
   follow the caret (the post-relayout render must honor #shouldScrollSelectionIntoView). Fills a single page
   with many lines so the caret falls below the viewport, then presses Enter and verifies the view follows. */
(async () => {
  const out = { mode: null, ready: false, steps: {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 360 && !window.__WC_READY; i++) await sleep(50);
  const W = window.WC || {};
  out.ready = window.__WC_READY === true; out.mode = window.__WC_LAYOUT_MODE;
  const view = () => W.view; const doc = () => view().state.doc; const sel = () => view().state.selection.from;
  const TS = window.__PM_TextSelection;
  const setCaret = (pos) => { try { view().dispatch(view().state.tr.setSelection(TS.create(doc(), pos))); } catch (e) {} };
  const findScroller = () => { const cands = ['.presentation-editor', '#pages', '#pm-editor', '.superdoc-pages']; for (const sB of cands) { const el = document.querySelector(sB); if (el && el.scrollHeight > el.clientHeight + 4) return el; } let n = document.querySelector('[data-page-index="0"]'); while (n && n !== document.body) { if (n.scrollHeight > n.clientHeight + 4 && getComputedStyle(n).overflowY !== 'visible') return n; n = n.parentElement; } return document.scrollingElement || document.documentElement; };
  const caretElTop = () => { const c = document.querySelector('.presentation-editor__selection-caret'); return c ? Math.round(c.getBoundingClientRect().top) : null; };

  // clean empty doc
  try { W.editor.commands.selectAll(); W.editor.commands.deleteSelection(); W.editor.commands.selectAll(); W.editor.commands.unsetAllMarks(); W.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']); } catch (e) {}
  setCaret(1); try { view().focus(); } catch (e) {}
  await sleep(120);
  const scr = findScroller();

  // type MANY lines so the caret goes below the viewport bottom (use real Enter each time)
  const enter = () => { const d = view().dom; const kd = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }); d.dispatchEvent(kd); };
  for (let i = 0; i < 45; i++) { try { view().dispatch(view().state.tr.insertText('Line ' + i + ' of filler text here', sel())); } catch (e) {} enter(); await sleep(8); }
  await sleep(200);
  out.steps.afterFill = { caret: sel(), pages: W.presentation.getPages().length, scrollTop: Math.round(scr.el ? scr.el.scrollTop : scr.scrollTop), clientH: Math.round((scr.clientHeight || scr.el && scr.el.clientHeight)), caretElTop: caretElTop() };

  // Now press Enter once more — the caret is at the doc end (likely below viewport). View should follow.
  const before = Math.round(scr.scrollTop != null ? scr.scrollTop : scr.el.scrollTop);
  enter();
  await sleep(60);
  // one more line of text + Enter
  try { view().dispatch(view().state.tr.insertText('Final line', sel())); } catch (e) {} enter();
  let samples = [];
  for (let i = 0; i < 10; i++) { await sleep(60); samples.push(Math.round(scr.scrollTop != null ? scr.scrollTop : scr.el.scrollTop)); }
  const after = samples[samples.length - 1];
  const ct = caretElTop();
  const containerRect = scr.getBoundingClientRect ? scr.getBoundingClientRect() : null;
  out.steps.afterMoreTyping = {
    scrollBefore: before, scrollAfter: after, scrollDelta: after - before,
    caretElTop: ct, samples,
    containerTop: containerRect ? Math.round(containerRect.top) : null, containerBottom: containerRect ? Math.round(containerRect.bottom) : null,
    caretVisible: ct != null && containerRect ? (ct >= containerRect.top - 5 && ct <= containerRect.bottom + 5) : 'unknown',
  };
  out.steps.verdict = {
    viewFollowedCaret: (after - before) > 20, // the view scrolled DOWN to follow the caret
    caretInView: out.steps.afterMoreTyping.caretVisible,
    REGRESSION_OK: ((after - before) > 20) && out.steps.afterMoreTyping.caretVisible === true,
  };
  return JSON.stringify(out, null, 2);
})()
