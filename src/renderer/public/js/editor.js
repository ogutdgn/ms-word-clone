/* editor.js — the document surface: contenteditable, selection state,
   pagination guides, word/char count, zoom, view modes. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;

  // Phase 2 (spec D6/§7.1b): when the PM core is ACTIVE the legacy editor is
  // hidden — any legacy mutation reaching it is an unflipped feature path.
  // No-op + throttled toast instead of silently editing a document Save will
  // never export. Under --legacy (WC.PM.active=false) this passes through.
  function pmGuard(what) {
    const PM = window.WC && window.WC.PM;
    if (!PM || !PM.active) return false;
    if (PM.notifyBlocked) PM.notifyBlocked(what);
    return true;
  }

  const Editor = {
    node: null,
    pagesHost: null,
    workarea: null,
    zoom: 1,
    view: 'print',
    pageH: 1056,
    savedRange: null,
    dirty: false,
    listeners: [],

    init() {
      this.node = document.getElementById('editor');
      this.pagesHost = document.getElementById('pages');
      this.workarea = document.getElementById('workarea');
      try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}

      const onChange = () => { this.dirty = true; this.repaginate(); this.updateStatus(); this.emit(); };
      this.node.addEventListener('input', WC.debounce(onChange, 80));
      // Real undo/redo history — replaces the native execCommand stack, which
      // ignores our direct-DOM operations. A MutationObserver captures EVERY
      // change (typing, execCommand, and direct DOM edits) uniformly.
      this._historyDebounced = WC.debounce(() => this.recordHistory(), 450);
      this._histObserver = new MutationObserver(() => { if (!this._restoringHistory) this._historyDebounced(); });
      this._histObserver.observe(this.node, { childList: true, subtree: true, characterData: true, attributes: true });
      this.node.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'historyUndo') { e.preventDefault(); this.undo(); }
        else if (e.inputType === 'historyRedo') { e.preventDefault(); this.redo(); }
      });
      this.node.addEventListener('keyup', () => { this.saveRange(); this.emit(); this.updateStatus(); });
      this.node.addEventListener('mouseup', () => { this.saveRange(); this.emit(); this.updateStatus(); });
      this.node.addEventListener('focus', () => this.saveRange());
      // Tab / Shift+Tab change list level when inside a list (Word behaviour).
      this.node.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && this.currentListItem()) {
          e.preventDefault();
          if (e.shiftKey) this.promoteListItem(); else this.demoteListItem();
        }
      });
      // Capture copied/cut content into the Office Clipboard history.
      const cap = () => { if (window.WC.Clipboard) window.WC.Clipboard.capture(); };
      this.node.addEventListener('copy', cap);
      this.node.addEventListener('cut', cap);
      // Right-click inside a table -> table editing context menu.
      this.node.addEventListener('contextmenu', (e) => {
        if (!window.WC.Table) return;
        const cell = e.target.closest && e.target.closest('td,th');
        if (cell && this.node.contains(cell)) { e.preventDefault(); window.WC.Table.contextMenu(cell, e.clientX, e.clientY); }
      });
      document.addEventListener('selectionchange', () => {
        if (document.activeElement === this.node) { this.saveRange(); this.emit(); }
      });
      // ensure there is always at least one paragraph
      if (!this.node.innerHTML.trim()) this.node.innerHTML = '<p><br></p>';
      this.repaginate();
      this.updateStatus();
      this.recordHistory(); // seed undo history with the initial state
    },

    onStateChange(fn) { this.listeners.push(fn); },
    emit() { const s = this.queryState(); this.listeners.forEach((f) => f(s)); },

    focus() { this.node.focus(); this.restoreRange(); },

    saveRange() {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && this.node.contains(sel.anchorNode)) this.savedRange = sel.getRangeAt(0).cloneRange();
    },
    restoreRange() {
      if (this.savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }
    },

    // Run an execCommand against the document, keeping editor focus/selection.
    exec(cmd, value) {
      if (pmGuard('exec ' + cmd)) return false;
      if (cmd === 'undo') return this.undo();
      if (cmd === 'redo') return this.redo();
      this.node.focus();
      this.restoreRange();
      let ok = false;
      try { ok = document.execCommand(cmd, false, value); } catch (e) { ok = false; }
      this.saveRange();
      this.dirty = true;
      this.repaginate();
      this.updateStatus();
      this.emit();
      return ok;
    },

    insertHTML(html) { return this.exec('insertHTML', html); },

    // Insert HTML at the caret via direct DOM, preserving classes/data-* attrs
    // (execCommand('insertHTML') with styleWithCSS strips them on some elements).
    insertNodeHTML(html) {
      if (pmGuard('insertNodeHTML')) return;
      this.node.focus(); this.restoreRange();
      const sel = window.getSelection(); if (!sel.rangeCount) { this.node.insertAdjacentHTML('beforeend', html); return; }
      const range = sel.getRangeAt(0); range.deleteContents();
      const tpl = document.createElement('template'); tpl.innerHTML = html;
      const last = tpl.content.lastChild;
      range.insertNode(tpl.content);
      if (last) { const r = document.createRange(); r.setStartAfter(last); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
      this.saveRange(); this.dirty = true; this.repaginate(); this.updateStatus(); this.emit();
    },

    // Wrap current selection / apply a style via CSS on the selection.
    applyInlineStyle(prop, value) {
      if (pmGuard('applyInlineStyle ' + prop)) return;
      this.node.focus();
      this.restoreRange();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        // apply to a zero-width span so typing continues with the style
        const span = el('span'); span.style[prop] = value; span.appendChild(document.createTextNode('​'));
        range.insertNode(span);
        const r = document.createRange(); r.setStart(span.firstChild, 1); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
      } else {
        const span = el('span'); span.style[prop] = value;
        try { range.surroundContents(span); }
        catch (e) { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span); }
        sel.removeAllRanges();
        const r = document.createRange(); r.selectNodeContents(span); sel.addRange(r);
      }
      this.saveRange(); this.dirty = true; this.repaginate(); this.updateStatus(); this.emit();
    },

    // Apply multiple CSS props atomically to the selection (for effects that
    // need >1 property, e.g. outline = stroke + fill).
    applyInlineStyles(styles) {
      if (pmGuard('applyInlineStyles')) return;
      this.node.focus(); this.restoreRange();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const span = el('span');
      for (const k in styles) {
        if (styles[k] == null || styles[k] === '') span.style.removeProperty(k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
        else span.style[k] = styles[k];
      }
      if (range.collapsed) {
        span.appendChild(document.createTextNode('​'));
        range.insertNode(span);
        const r = document.createRange(); r.setStart(span.firstChild, 1); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
      } else {
        try { range.surroundContents(span); }
        catch (e) { span.appendChild(range.extractContents()); range.insertNode(span); }
        sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(span); sel.addRange(r);
      }
      this.saveRange(); this.dirty = true; this.repaginate(); this.updateStatus(); this.emit();
    },

    // ---- Multilevel list engine ----
    currentListItem() {
      const sel = window.getSelection();
      if (!sel.rangeCount || !this.node.contains(sel.anchorNode)) return null;
      let n = sel.anchorNode; n = n.nodeType === 3 ? n.parentNode : n;
      while (n && n !== this.node && n.tagName !== 'LI') n = n.parentNode;
      return n && n.tagName === 'LI' ? n : null;
    },
    listLevel(li) { let d = 0, n = li; while (n && n !== this.node) { if (n.tagName === 'OL' || n.tagName === 'UL') d++; n = n.parentNode; } return d; },
    selectedListItems() {
      const blocks = this.selectedBlocks();
      const lis = blocks.filter((b) => b.tagName === 'LI');
      if (lis.length) return lis;
      const li = this.currentListItem();
      return li ? [li] : [];
    },
    demoteListItem() {
      if (pmGuard('demoteListItem')) return;
      const items = this.selectedListItems(); if (!items.length) return;
      items.forEach((li) => {
        if (this.listLevel(li) >= 9) return;
        const prev = li.previousElementSibling;
        if (!prev || prev.tagName !== 'LI') return; // first item can't demote
        const parentList = li.parentNode;
        let sub = prev.querySelector(':scope > ol, :scope > ul');
        if (!sub) { sub = document.createElement(parentList.tagName); if (parentList.className) sub.className = parentList.className; prev.appendChild(sub); }
        sub.appendChild(li);
      });
      if (items[0] && this.node.contains(items[0])) this.caretInto(items[0]); else this.saveRange();
      this.dirty = true; this.repaginate(); this.updateStatus(); this.emit();
    },
    promoteListItem() {
      if (pmGuard('promoteListItem')) return;
      const items = this.selectedListItems(); if (!items.length) return;
      let last = null;
      items.slice().reverse().forEach((li) => {
        const parentList = li.parentNode;
        const grandLi = parentList.parentNode;
        if (grandLi && grandLi.tagName === 'LI') {
          grandLi.parentNode.insertBefore(li, grandLi.nextSibling);
          if (!parentList.children.length) parentList.remove();
          last = li;
        } else {
          // already top level -> convert the <li> into a real <p> (execCommand
          // 'outdent' leaves a bare span/<br> and splits the list invalidly).
          const p = document.createElement('p');
          while (li.firstChild) p.appendChild(li.firstChild);
          if (!p.firstChild) p.appendChild(document.createElement('br'));
          const after = []; let sib = li.nextElementSibling;
          while (sib) { after.push(sib); sib = sib.nextElementSibling; }
          parentList.parentNode.insertBefore(p, parentList.nextSibling);
          if (after.length) { const rest = document.createElement(parentList.tagName); after.forEach((it) => rest.appendChild(it)); p.parentNode.insertBefore(rest, p.nextSibling); }
          li.remove();
          if (!parentList.children.length) parentList.remove();
          last = p;
        }
      });
      if (last && this.node.contains(last)) this.caretInto(last); else this.saveRange();
      this.dirty = true; this.repaginate(); this.updateStatus(); this.emit();
    },
    caretInto(node) {
      const r = document.createRange(); r.selectNodeContents(node); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); this.saveRange();
    },
    setListLevel(n) {
      if (pmGuard('setListLevel')) return;
      const li = this.currentListItem(); if (!li) return; // same node persists across moves
      let guard = 0;
      while (guard++ < 20) {
        const lvl = this.listLevel(li);
        if (lvl === n) break;
        this.caretInto(li); // re-anchor selection to the tracked item before each move
        if (lvl < n) this.demoteListItem(); else this.promoteListItem();
      }
      if (this.node.contains(li)) this.caretInto(li);
    },
    applyMultilevelPattern(key) {
      if (pmGuard('applyMultilevelPattern')) return;
      let items = this.selectedListItems();
      if (!items.length) { this.exec('insertOrderedList'); items = this.selectedListItems(); }
      const cls = 'ml-' + key;
      items.forEach((li) => {
        let outer = li; let topList = null;
        let n = li.parentNode;
        while (n && n !== this.node) { if (n.tagName === 'OL' || n.tagName === 'UL') topList = n; n = n.parentNode; }
        if (topList) { topList.className = topList.className.replace(/\bml-[\w-]+\b/g, '').trim(); topList.classList.add(cls); topList.dataset.ml = key; }
      });
      this.saveRange(); this.dirty = true; this.repaginate(); this.updateStatus(); this.emit();
    },

    // Apply a CSS property to the block(s) intersecting the selection.
    applyBlockStyle(prop, value) {
      if (pmGuard('applyBlockStyle ' + prop)) return;
      this.node.focus(); this.restoreRange();
      const blocks = this.selectedBlocks();
      blocks.forEach((b) => { b.style[prop] = value; });
      this.saveRange(); this.dirty = true; this.repaginate(); this.updateStatus(); this.emit();
    },

    selectedBlocks() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return [];
      const range = sel.getRangeAt(0);
      const blockOf = (n) => {
        let e = n.nodeType === 3 ? n.parentNode : n;
        while (e && e !== this.node && !/^(P|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|DIV|TD|TH)$/.test(e.tagName)) e = e.parentNode;
        return e && e !== this.node ? e : null;
      };
      const start = blockOf(range.startContainer);
      const end = blockOf(range.endContainer);
      if (!start) return [];
      if (start === end) return [start];
      const all = Array.from(this.node.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,div,td,th'));
      const si = all.indexOf(start), ei = all.indexOf(end);
      if (si === -1 || ei === -1) return [start];
      return all.slice(Math.min(si, ei), Math.max(si, ei) + 1);
    },

    // Query active formatting at the caret for ribbon sync.
    queryState() {
      const st = { bold: false, italic: false, underline: false, strikethrough: false, subscript: false, superscript: false,
        justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
        insertUnorderedList: false, insertOrderedList: false, fontName: '', fontSize: '', block: '' };
      if (document.activeElement !== this.node && !this.savedRange) return st;
      try {
        ['bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript',
         'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
         'insertUnorderedList', 'insertOrderedList'].forEach((c) => { try { st[c] = document.queryCommandState(c); } catch (e) {} });
        st.fontName = (document.queryCommandValue('fontName') || '').replace(/['"]/g, '');
        const px = document.queryCommandValue('fontSize');
        st.fontSize = px;
        // determine block tag
        const sel = window.getSelection();
        if (sel.rangeCount) {
          let n = sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
          while (n && n !== this.node && !/^(P|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE)$/.test(n.tagName)) n = n.parentNode;
          if (n && n.tagName) {
            st.block = n.tagName.toLowerCase();
            if (n.classList && n.classList.contains('doc-title')) st.block = 'title';
            if (n.classList && n.classList.contains('doc-subtitle')) st.block = 'subtitle';
            const cs = getComputedStyle(n);
            st.computedFontSizePt = Math.round(parseFloat(cs.fontSize) / 1.3333 * 10) / 10;
            st.computedFontFamily = cs.fontFamily.split(',')[0].replace(/['"]/g, '');
          }
        }
      } catch (e) {}
      return st;
    },

    // --- pagination guides + page count ---
    pageMetrics() {
      const cs = getComputedStyle(document.documentElement);
      const margin = parseFloat(cs.getPropertyValue('--page-margin')) || 96;
      const gap = parseFloat(cs.getPropertyValue('--page-gap')) || 14;
      const pageH = this.pageH;
      // Guard against margins ≥ page height (would yield ≤0 content height and
      // runaway spacer insertion); keep at least one line of usable height.
      const contentH = Math.max(48, pageH - 2 * margin);
      return { margin, gap, pageH, contentH, pitch: pageH + gap };
    },
    // Lay the continuous flow out as discrete page sheets. Sweep top-to-bottom
    // and, at each page boundary, insert a full-width gap spacer (bottom margin +
    // gray gap + top margin) right before the LINE that would overflow — so even a
    // single long paragraph is split across pages, like real Word.
    repaginate() {
      if (this._repaginating) return this._pageCount || 1;
      this._repaginating = true;
      try { return this._repaginate(); }
      catch (e) { if (window.console) console.warn('repaginate failed:', e); return this._pageCount || 1; }
      finally { this._repaginating = false; }
    },
    _repaginate() {
      const node = this.node;
      const { margin, gap, pageH, contentH, pitch } = this.pageMetrics();
      const zoom = this.zoom || 1;
      const printView = !this.workarea || this.workarea.classList.contains('view-print');

      // Normal-flow content only: exclude headers/footers/page-borders, the SVG
      // ink overlay (.ink-layer) and the layout spacers — none of those define the
      // page's content height (the ink layer is absolutely positioned and its
      // offsetTop is NaN, which previously broke the single-page fast path).
      const isContent = (n) => n && n.nodeType === 1 && n.tagName !== 'svg' && !(n.classList && (n.classList.contains('wc-header') || n.classList.contains('wc-footer') || n.classList.contains('wc-page-border') || n.classList.contains('ink-layer') || n.classList.contains('line-gutter') || n.classList.contains('wc-page-gap') || n.classList.contains('manual-break') || n.classList.contains('wc-gap-band')));

      // Fast path: a single page in print view with nothing to lay out. Do NOT
      // normalize() or save/restore the caret here — that would yank the caret
      // (e.g. back to the end of the previous line) while the user is just typing.
      // Measure real content height from the last flow child (NOT scrollHeight,
      // which is inflated by #editor's one-page min-height).
      const hasArtifacts = !!node.querySelector('.wc-page-gap, .manual-break, .pagebreak-guide');
      let lastFlow = null;
      for (let i = node.children.length - 1; i >= 0; i--) { if (isContent(node.children[i])) { lastFlow = node.children[i]; break; } }
      const contentBottom = lastFlow ? lastFlow.offsetTop + lastFlow.offsetHeight : 0;
      if (printView && !hasArtifacts && contentBottom <= margin + contentH + 2) {
        this._pageCount = 1;
        if (window.WC.HeaderFooter) window.WC.HeaderFooter.refresh();
        if (window.WC.Insert && window.WC.Insert.refreshFields) window.WC.Insert.refreshFields();
        return 1;
      }

      // Preserve the caret across the DOM surgery (by absolute character offset,
      // which is invariant to the empty spacers we add/remove and to normalize()).
      const caretOff = this._caretCharOffset();

      node.querySelectorAll('.pagebreak-guide, .wc-page-gap').forEach((g) => g.remove());
      node.querySelectorAll('.manual-break').forEach((b) => { b.style.height = '0px'; b.querySelectorAll('.wc-gap-band').forEach((x) => x.remove()); });
      node.normalize(); // rejoin text nodes split by a previous pass

      // Web/Draft/Outline/Read are continuous flows — no page sheets to separate.
      if (!printView) {
        this._pageCount = Math.max(1, Math.ceil(node.scrollHeight / pageH));
        if (window.WC.HeaderFooter) window.WC.HeaderFooter.refresh();
        this._setCaretCharOffset(caretOff);
        return this._pageCount;
      }

      const addBand = (parent, offY) => { const band = el('div', { class: 'wc-gap-band' }); band.style.top = offY + 'px'; band.style.height = gap + 'px'; parent.appendChild(band); };
      const sheetBottom = (pg) => pg * pitch + pageH;            // visual bottom edge of a sheet
      const nextContentTop = (pg) => margin + (pg + 1) * pitch;  // content top of the next page
      const isFlowBlock = isContent;
      // Map a character offset inside `block` to a DOM {node, offset} position.
      const domPos = (block, charOff) => {
        const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
        let acc = 0, n;
        while ((n = w.nextNode())) { if (acc + n.nodeValue.length >= charOff) return { node: n, offset: charOff - acc }; acc += n.nodeValue.length; }
        return { node: block, offset: block.childNodes.length };
      };
      // Content-coord bottom of the text run [0..charOff] (i.e. bottom of its last line).
      const bottomAt = (block, charOff, eTop) => {
        const pos = domPos(block, charOff);
        const r = document.createRange();
        try { r.setStart(block, 0); r.setEnd(pos.node, pos.offset); } catch (e) { return null; }
        const rect = r.getBoundingClientRect();
        if (!rect || (!rect.height && !rect.width)) return null;
        return (rect.bottom - eTop) / zoom;
      };

      let p = 0, guard = 0;
      while (guard++ < 600) {
        const boundaryY = margin + p * pitch + contentH;        // content bottom of page p

        // A manual break on page p ends it earlier than the auto boundary.
        let mb = null, mbTop = Infinity;
        node.querySelectorAll('.manual-break').forEach((b) => {
          if (parseFloat(b.style.height) > 0) return;           // already processed
          const t = b.offsetTop;
          if (t >= margin + p * pitch - 1 && t <= boundaryY + 1 && t < mbTop) { mb = b; mbTop = t; }
        });
        if (mb) {
          const blank = mb.classList.contains('blank-page');
          let hgt = nextContentTop(p) - mbTop; if (blank) hgt += pitch;
          mb.style.height = Math.max(gap, hgt) + 'px';
          addBand(mb, sheetBottom(p) - mbTop);
          if (blank) addBand(mb, sheetBottom(p) - mbTop + pitch);
          p += blank ? 2 : 1;
          continue;
        }

        if (node.scrollHeight <= boundaryY + 2) break;           // nothing overflows -> done

        // Find the block straddling the boundary (or the first one below it).
        const eTop = node.getBoundingClientRect().top;
        const blocks = Array.from(node.children).filter(isFlowBlock);
        let straddle = null, nextBlock = null;
        for (const b of blocks) {
          const t = b.offsetTop, bot = t + b.offsetHeight;
          if (t <= boundaryY && bot > boundaryY + 1) { straddle = b; break; }
          if (t > boundaryY + 1) { nextBlock = b; break; }
        }

        const sp = el('span', { class: 'wc-page-gap', contenteditable: 'false' });
        sp.style.height = '0px';
        if (straddle && (straddle.tagName === 'TABLE' || straddle.tagName === 'IMG')) {
          // Never inject a gap inside a table cell (it tears the cell) or an image:
          // push the whole block to the next page instead.
          node.insertBefore(sp, straddle);
        } else if (straddle) {
          // Binary-search the last character whose line still fits on this page,
          // then insert the spacer before the first overflowing line.
          const txt = straddle.textContent;
          const len = txt.length;
          let lo = 0, hi = len, best = 0;
          while (lo <= hi) { const mid = (lo + hi) >> 1; const b = bottomAt(straddle, mid, eTop); if (b != null && b <= boundaryY) { best = mid; lo = mid + 1; } else hi = mid - 1; }
          // Snap the split to a word boundary so a word is never cut in half — but
          // only if a boundary exists. A single unbroken string (e.g. "testtest…")
          // has none, so fall back to a character-level split, like Word.
          let splitOff = Math.min(best + 1, len);
          let snapOff = splitOff;
          while (snapOff > 0 && snapOff < len && !/\s/.test(txt[snapOff - 1])) snapOff--;
          if (snapOff > 0) splitOff = snapOff;
          const pos = domPos(straddle, splitOff);
          const r = document.createRange();
          try { r.setStart(pos.node, pos.offset); r.collapse(true); r.insertNode(sp); } catch (e) { straddle.parentNode.insertBefore(sp, straddle.nextSibling); }
        } else if (nextBlock) {
          node.insertBefore(sp, nextBlock);                      // break falls between blocks
        } else { sp.remove(); break; }

        const lineTop = sp.offsetTop;
        if (lineTop <= margin + p * pitch + 1) { sp.remove(); p += 1; continue; } // unsplittable
        sp.style.height = Math.max(gap, nextContentTop(p) - lineTop) + 'px';
        addBand(sp, sheetBottom(p) - lineTop);
        p += 1;
      }

      const count = p + 1;
      this._pageCount = count;
      if (window.WC.HeaderFooter) window.WC.HeaderFooter.refresh();
      if (window.WC.Insert && window.WC.Insert.refreshFields) window.WC.Insert.refreshFields();
      if (window.WC.Layout && WC.Layout.lineMode && WC.Layout.lineMode !== 'none') WC.Layout.renderLineNumbers();
      this._setCaretCharOffset(caretOff);
      return count;
    },
    // Save/restore the FULL selection (start+end) by absolute character offset, so
    // the empty spacers we add/remove and normalize() never collapse or move it.
    _caretCharOffset() {
      const sel = window.getSelection();
      if (!sel.rangeCount || !this.node.contains(sel.anchorNode)) return null;
      const r = sel.getRangeAt(0);
      const measure = (cont, off) => { const pre = document.createRange(); pre.selectNodeContents(this.node); try { pre.setEnd(cont, off); } catch (e) { return null; } return pre.toString().length; };
      const start = measure(r.startContainer, r.startOffset);
      const end = measure(r.endContainer, r.endOffset);
      if (start == null || end == null) return null;
      return { start, end };
    },
    _posAtOffset(off) {
      const walker = document.createTreeWalker(this.node, NodeFilter.SHOW_TEXT, null);
      let acc = 0, n, last = null;
      while ((n = walker.nextNode())) {
        const len = n.nodeValue.length;
        if (acc + len >= off) return { node: n, offset: Math.max(0, Math.min(len, off - acc)) };
        acc += len; last = n;
      }
      return last ? { node: last, offset: last.nodeValue.length } : null;
    },
    _setCaretCharOffset(o) {
      if (!o) return;
      const s = this._posAtOffset(o.start);
      const e = o.end === o.start ? s : this._posAtOffset(o.end);
      if (!s || !e) return;
      try { const r = document.createRange(); r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); this.saveRange(); } catch (err) {}
    },

    pageCount() { return this._pageCount || 1; },

    currentPage() {
      const sel = window.getSelection();
      if (!sel.rangeCount || !this.node.contains(sel.anchorNode)) return 1;
      let r = sel.getRangeAt(0).getBoundingClientRect();
      // A collapsed caret often yields an empty (0,0,0,0) rect — fall back to the
      // containing element so the page is computed from the real caret position.
      if (!r || (r.top === 0 && r.height === 0 && r.width === 0)) {
        let n = sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
        if (n && n.getBoundingClientRect) r = n.getBoundingClientRect();
      }
      const top = this.node.getBoundingClientRect().top;
      const y = (r.top - top) / this.zoom;
      const { margin, pitch } = this.pageMetrics();
      return Math.max(1, Math.min(this.pageCount(), Math.floor((y - margin) / pitch) + 1));
    },

    // Page that a given element sits on (by its own position, not the caret).
    pageOfElement(el) {
      if (!el || !this.node.contains(el)) return 1;
      const r = el.getBoundingClientRect();
      const top = this.node.getBoundingClientRect().top;
      const y = (r.top - top) / this.zoom;
      const { margin, pitch } = this.pageMetrics();
      return Math.max(1, Math.min(this.pageCount(), Math.floor((y - margin) / pitch) + 1));
    },

    counts() {
      const text = this.node.innerText.replace(/​/g, '');
      const words = (text.match(/\S+/g) || []).length;
      const chars = text.replace(/\n/g, '').length;
      const sel = window.getSelection();
      let selWords = 0;
      if (sel && sel.rangeCount && !sel.isCollapsed && this.node.contains(sel.anchorNode)) {
        selWords = (sel.toString().match(/\S+/g) || []).length;
      }
      return { words, chars, selWords };
    },

    updateStatus() { if (WC.StatusBar) WC.StatusBar.update(); },

    // --- zoom ---
    setZoom(z) {
      this.zoom = Math.max(0.1, Math.min(5, z));
      this.pagesHost.style.transform = `scale(${this.zoom})`;
      this.pagesHost.style.marginBottom = (this.zoom < 1 ? 0 : (this.node.scrollHeight * (this.zoom - 1))) + 'px';
      if (WC.StatusBar) WC.StatusBar.updateZoom();
    },
    zoomIn() { this.setZoom(Math.round((this.zoom + 0.1) * 10) / 10); },
    zoomOut() { this.setZoom(Math.round((this.zoom - 0.1) * 10) / 10); },
    zoomReset() { this.setZoom(1); },

    // --- view mode ---
    setView(v) {
      this.view = v;
      this.workarea.classList.remove('view-print', 'view-web', 'view-read', 'view-outline', 'view-draft');
      this.workarea.classList.add('view-' + v);
      // Rebuild (print) or clear (continuous views) the page-gap spacers for the
      // new layout — otherwise stale spacers paint as misaligned gray stripes.
      this.repaginate();
    },

    // --- content get/set for file IO ---
    getHTML() {
      const clone = this.node.cloneNode(true);
      // Drop pure layout artifacts (auto page-gap spacers, their bands, find
      // highlights, old guides) so they never reach saved files.
      clone.querySelectorAll('.pagebreak-guide,.wc-page-gap,.wc-gap-band,.find-hit').forEach((n) => {
        if (n.classList.contains('find-hit')) { n.replaceWith(...n.childNodes); } else n.remove();
      });
      // Don't bake the computed page-break spacer height into saved files —
      // it is recomputed on load; break-after:page still drives PDF pagination.
      clone.querySelectorAll('.manual-break').forEach((b) => { b.style.height = ''; });
      return clone.innerHTML.replace(/​/g, '');
    },
    // Save payload for .docx export: body HTML WITHOUT the header/footer regions or
    // UI-only overlays, plus the header/footer HTML separately so the exporter can
    // write them as real Word header/footer parts (not demoted to body text).
    getSavePayload() {
      const clone = this.node.cloneNode(true);
      clone.querySelectorAll('.pagebreak-guide,.wc-page-gap,.wc-gap-band,.find-hit,.line-gutter,.ink-layer').forEach((n) => {
        if (n.classList.contains('find-hit')) { n.replaceWith(...n.childNodes); } else n.remove();
      });
      clone.querySelectorAll('.manual-break').forEach((b) => { b.style.height = ''; });
      let header = '', footer = '';
      const h = clone.querySelector('.wc-header'); if (h) { header = h.innerHTML; h.remove(); }
      const f = clone.querySelector('.wc-footer'); if (f) { footer = f.innerHTML; f.remove(); }
      // Collect comments and replace each anchor with sentinel-wrapped text so the
      // docx exporter can turn them into real Word comments (html-to-docx can't).
      const comments = [];
      clone.querySelectorAll('.wc-comment-anchor, [data-comment]').forEach((a, i) => {
        comments.push({ id: i, author: 'Word User', text: a.dataset.comment || '' });
        a.replaceWith(document.createTextNode('@@WCMTS' + i + '@@' + (a.textContent || '') + '@@WCMTE' + i + '@@'));
      });
      return { html: clone.innerHTML.replace(/​/g, ''), header, footer, comments };
    },
    setHTML(html) {
      if (pmGuard('setHTML')) return;
      this.node.innerHTML = html && html.trim() ? html : '<p><br></p>';
      this.dirty = false;
      // Images report height 0 until decoded — re-paginate once each settles so
      // image-heavy docs get correct page breaks instead of an undercount.
      this.node.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', () => this.repaginate(), { once: true }); });
      this.repaginate();
      this.updateStatus();
      if (window.WC.refreshSensitivity) window.WC.refreshSensitivity();
      if (window.WC.Draw) window.WC.Draw.onDocLoad();
      if (window.WC.Comments) window.WC.Comments.rebuild();
      this.emit();
      // Opening/creating a document clears the undo history (Word behaviour).
      this._history = [this._histSnapshot()]; this._histPtr = 0;
    },
    isEmpty() { return !this.node.innerText.trim(); },

    // ---- Undo / redo history (snapshot-based) ----
    _histSnapshot() { return { html: this.getHTML(), caret: this._caretCharOffset() }; },
    recordHistory() {
      if (this._restoringHistory) return;
      if (!this._history) { this._history = [this._histSnapshot()]; this._histPtr = 0; return; }
      const snap = this._histSnapshot();
      if (this._history[this._histPtr] && this._history[this._histPtr].html === snap.html) return; // no real change
      this._history = this._history.slice(0, this._histPtr + 1);
      this._history.push(snap);
      if (this._history.length > 200) this._history.shift();   // cap memory
      this._histPtr = this._history.length - 1;
    },
    undo() {
      if (pmGuard('undo')) return false;
      if (!this._history || this._histPtr <= 0) return false;
      if (this._historyDebounced && this._historyDebounced.flush) this._historyDebounced.flush();
      this.recordHistory();                                    // capture the latest in-flight edit
      if (this._histPtr <= 0) return false;
      this._histPtr--;
      this._restoreHistory(this._history[this._histPtr]);
      return true;
    },
    redo() {
      if (pmGuard('redo')) return false;
      if (!this._history || this._histPtr >= this._history.length - 1) return false;
      this._histPtr++;
      this._restoreHistory(this._history[this._histPtr]);
      return true;
    },
    _restoreHistory(snap) {
      this._restoringHistory = true;
      try {
        this.node.innerHTML = snap.html && snap.html.trim() ? snap.html : '<p><br></p>';
        this.dirty = true;
        this.repaginate();
        this._setCaretCharOffset(snap.caret);
        this.updateStatus();
        if (window.WC.Draw) window.WC.Draw.onDocLoad();
        if (window.WC.Comments) window.WC.Comments.rebuild();
        this.emit();
      } finally { this._restoringHistory = false; }
    },
  };

  WC.Editor = Editor;
})();
