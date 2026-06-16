/* Reproduction probe — does Phase-4a pagination break caret/click coordinate mapping?
   Runs in the PM app via --shot-evalfile. For each scenario (manual break between
   paragraphs, mid-paragraph break, blank page) it:
     1. builds the doc + the break, waits for pagination to settle,
     2. for a word on a LATER page: posAtDOM(word) -> coordsAtPos -> posAtCoords round-trip
        (a big delta = the caret/click bug), plus a real click hit-test at the word's rect,
     3. inspects the rendered DOM: is a .pm-page-spacer a child of a <p> (block-in-inline)? */
(async () => {
  const out = { scenarios: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);
  const ed = () => window.WC.editor;
  const view = () => window.WC.view;
  const PM = () => window.WC.PM;
  const doc = () => view().state.doc;
  const zoom = () => PM().zoom || 1;

  const setDoc = (html) => { ed().commands.selectAll(); ed().commands.insertContent(html); };
  const caretToEndOf = (needle) => {
    let found = null;
    doc().descendants((n, pos) => { if (!found && n.isText && n.text && n.text.indexOf(needle) >= 0) found = pos + n.text.indexOf(needle) + needle.length; });
    if (found == null) return false;
    view().dispatch(view().state.tr.setSelection(window.__PM_TextSelection.create(doc(), found, found)));
    return true;
  };
  // DOM text-node + offset for the START of `needle`, plus its rendered rect.
  const domOf = (needle) => {
    const pm = document.querySelector('#pm-editor .ProseMirror');
    const w = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const i = n.textContent.indexOf(needle);
      if (i >= 0) {
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + needle.length);
        const rect = r.getBoundingClientRect();
        return { node: n, offset: i, rect };
      }
    }
    return null;
  };
  const settle = async (wantPages) => {
    let pc = 1, stable = 0, lastSig = '';
    for (let i = 0; i < 40; i++) {
      await sleep(120);
      const pg = PM().__pagination || {};
      pc = pg.pageCount || 1;
      const sig = JSON.stringify(pg.breaks || []) + '|' + pc;
      if (sig === lastSig && pc >= (wantPages || 2)) { if (++stable >= 3) break; } else stable = 0;
      lastSig = sig;
    }
    return pc;
  };

  // Round-trip + click hit-test for a word that should be on a later page.
  const probeWord = (needle) => {
    const d = domOf(needle);
    if (!d) return { needle, error: 'word not found in DOM' };
    const v = view();
    // PM pos of the word's first char (from the DOM point).
    let pmPos = null; try { pmPos = v.posAtDOM(d.node, d.offset); } catch (e) { return { needle, error: 'posAtDOM threw: ' + e.message }; }
    // pos -> coords
    let c = null; try { c = v.coordsAtPos(pmPos); } catch (e) { c = null; }
    // coords -> pos (round-trip): click the MIDDLE of the word's rendered glyph box.
    const clickX = d.rect.left + 2, clickY = d.rect.top + d.rect.height / 2;
    let back = null; try { back = v.posAtCoords({ left: clickX, top: clickY }); } catch (e) { back = null; }
    // What text sits at the round-tripped pos? (does the click land on the same word?)
    let landedText = null, landedDelta = null;
    if (back && back.pos != null) {
      landedDelta = back.pos - pmPos;
      const $p = doc().resolve(Math.min(doc().content.size, Math.max(0, back.pos)));
      const parent = $p.parent; const txt = parent && parent.textContent ? parent.textContent : '';
      landedText = txt.slice(0, 40);
    }
    // What element is actually under the click point? (is it a spacer / wrong block?)
    const elAtPoint = document.elementFromPoint(clickX, clickY);
    return {
      needle, pmPos,
      coordsAtPos: c ? { left: Math.round(c.left), top: Math.round(c.top), bottom: Math.round(c.bottom) } : null,
      clickAt: { x: Math.round(clickX), y: Math.round(clickY) },
      posAtCoords: back ? back.pos : null,
      roundTripDelta: landedDelta,
      landedInParentText: landedText,
      clickRoundTrips: landedDelta != null && Math.abs(landedDelta) <= 3,
      elementUnderClick: elAtPoint ? (elAtPoint.className || elAtPoint.tagName) : null,
    };
  };

  // DOM sanity: is any .pm-page-spacer a child of inline content (a <p>/<h*>/<li> etc.)?
  const spacerParents = () => {
    const pm = document.querySelector('#pm-editor .ProseMirror');
    return Array.from(pm.querySelectorAll('.pm-page-spacer')).map((s) => {
      const p = s.parentElement;
      return { parentTag: p ? p.tagName : null, parentIsTextBlock: !!(p && /^(P|H[1-6]|LI|BLOCKQUOTE|PRE|SPAN)$/.test(p.tagName)), heightPx: Math.round(s.getBoundingClientRect().height) };
    });
  };

  // Click in WHITESPACE (where users click to place the caret): the page-2 top margin
  // (just above the first line of the next page) and the gray gap between sheets.
  // Word puts the caret on the nearest line of the page you clicked into. If our seam
  // <div> lives INSIDE the previous paragraph, its box covers the gap+next-page margin,
  // so a click there wrongly maps back into the PREVIOUS page's paragraph.
  const probeWhitespace = (lastWordPrevPage, firstWordNextPage) => {
    const prev = domOf(lastWordPrevPage), next = domOf(firstWordNextPage);
    if (!prev || !next) return { error: 'anchors not found (prev=' + !!prev + ' next=' + !!next + ')' };
    const x = next.rect.left + 2;
    const hit = (y) => {
      let r = null; try { r = view().posAtCoords({ left: x, top: y }); } catch (e) { r = null; }
      let parentText = null, page = null;
      if (r && r.pos != null) {
        const $p = doc().resolve(Math.min(doc().content.size, Math.max(0, r.pos)));
        parentText = ($p.parent.textContent || '').slice(0, 24);
        // which page (by comparing the landed pos's coords)
        let cc = null; try { cc = view().coordsAtPos(r.pos); } catch (e) {}
      }
      return { y: Math.round(y), pos: r ? r.pos : null, landedInParentText: parentText };
    };
    const marginY = next.rect.top - 25;          // page-2 top margin, just above its first line
    const gapY = (prev.rect.bottom + next.rect.top) / 2; // gray gap between the two sheets
    return {
      prevPageLastWord: lastWordPrevPage, nextPageFirstWord: firstWordNextPage,
      clickPage2TopMargin: hit(marginY),
      clickInterPageGap: hit(gapY),
      // Word-correct: clicking page-2 top margin should land in the NEXT page's paragraph.
      marginClickWrongPage: (() => { const h = hit(marginY); return h.landedInParentText != null && h.landedInParentText.indexOf(firstWordNextPage.slice(0, 6)) < 0; })(),
    };
  };

  const run = async (name, build, wantPages, words, whitespace) => {
    const sc = { name };
    try {
      build();
      await sleep(200);
      sc.pageCount = await settle(wantPages);
      sc.spacers = spacerParents();
      sc.blockInInline = sc.spacers.filter((s) => s.parentIsTextBlock).length;
      sc.words = words.map(probeWord);
      if (whitespace) sc.whitespace = probeWhitespace(whitespace[0], whitespace[1]);
    } catch (e) { sc.error = e.message || String(e); }
    out.scenarios.push(sc);
  };

  // 1. Manual page break BETWEEN paragraphs: P2/P3 go to page 2.
  await run('manual-break-between', () => {
    setDoc('<p>AlphaOne first paragraph on page one</p><p>BravoTwo second paragraph</p><p>CharlieThree third paragraph word</p>');
    caretToEndOf('AlphaOne first paragraph on page one');
    PM().insertPageBreak();
  }, 2, ['CharlieThree', 'BravoTwo'], ['page one', 'BravoTwo']);

  // 2. MID-paragraph break: split one paragraph; after-text on page 2.
  await run('mid-paragraph-break', () => {
    setDoc('<p>MidBefore the start of one long paragraph here MidAnchor end</p>');
    caretToEndOf('here ');
    PM().insertPageBreak();
    ed().commands.insertContent('MidAfter continues on the next page');
  }, 2, ['MidAfter', 'MidAnchor']);

  // 3. Blank page (two breaks): content after lands on page 3.
  await run('blank-page', () => {
    setDoc('<p>BpAlpha first</p><p>BpBravo middle</p><p>BpCharlie last word</p>');
    caretToEndOf('BpAlpha first');
    PM().insertBlankPage();
  }, 3, ['BpBravo', 'BpCharlie']);

  return JSON.stringify(out, null, 2);
})();
