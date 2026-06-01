/* review-tools.js — Review tab: a real Track Changes engine (mark insertions/
   deletions, accept/reject, display modes), comments navigation, accessibility
   checker, thesaurus, compare, restrict editing. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;

  const Review = {
    trackOn: false,
    markup: { comments: true, inserts: true, formatting: true, balloons: false },
    author: 'Word User',
    displayMode: 'all',   // all | simple | none | original
    commentIdx: -1,

    init() {
      E().node.addEventListener('beforeinput', (e) => this.onBeforeInput(e));
    },

    // ---- Track Changes ----
    setTrackChanges(on) {
      this.trackOn = typeof on === 'boolean' ? on : !this.trackOn;
      const btn = WC.Ribbon.controlIndex.trackChanges && WC.Ribbon.controlIndex.trackChanges.node;
      if (btn) btn.classList.toggle('toggled', this.trackOn);
      WC.toast('Track Changes ' + (this.trackOn ? 'on' : 'off'));
    },
    onBeforeInput(e) {
      if (!this.trackOn) return;
      const t = e.inputType;
      if (t === 'insertText' && e.data != null) { e.preventDefault(); this.insertTracked(e.data); }
      else if (t === 'deleteContentBackward') { e.preventDefault(); this.deleteTracked(-1); }
      else if (t === 'deleteContentForward') { e.preventDefault(); this.deleteTracked(1); }
      else if (t === 'insertFromPaste') { /* allow; marked on next edit */ }
    },
    insertTracked(text) {
      const sel = window.getSelection(); if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0); range.deleteContents();
      const anchor = range.startContainer; const elt = anchor.nodeType === 3 ? anchor.parentNode : anchor;
      const ownIns = elt.closest && elt.closest('ins.wc-ins');
      if (ownIns) { const tn = document.createTextNode(text); range.insertNode(tn); place(tn, tn.length); }
      else { const ins = el('ins', { class: 'wc-ins', dataset: { author: this.author } }); ins.textContent = text; range.insertNode(ins); place(ins.firstChild, text.length); }
      after();
    },
    deleteTracked(dir) {
      const sel = window.getSelection(); if (!sel.rangeCount) return;
      if (sel.isCollapsed) { try { sel.modify('extend', dir < 0 ? 'backward' : 'forward', 'character'); } catch (e) {} }
      if (sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const c = range.commonAncestorContainer; const ce = c.nodeType === 3 ? c.parentNode : c;
      const ownIns = ce.closest && ce.closest('ins.wc-ins');
      if (ownIns && ownIns.contains(range.startContainer) && ownIns.contains(range.endContainer)) { range.deleteContents(); sel.removeAllRanges(); const r = document.createRange(); r.setStart(range.startContainer, range.startOffset); r.collapse(true); sel.addRange(r); }
      else { const frag = range.extractContents(); const del = el('del', { class: 'wc-del', dataset: { author: this.author } }); del.appendChild(frag); range.insertNode(del); const r = document.createRange(); r.setStartBefore(del); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
      after();
    },
    revisions() { return Array.from(E().node.querySelectorAll('ins.wc-ins, del.wc-del')); },
    acceptNode(n) { if (n.tagName === 'INS') n.replaceWith(...n.childNodes); else n.remove(); },
    rejectNode(n) { if (n.tagName === 'INS') n.remove(); else n.replaceWith(...n.childNodes); },
    acceptAll() { this.revisions().forEach((n) => this.acceptNode(n)); E().node.normalize(); after(); WC.toast('All changes accepted.'); },
    rejectAll() { this.revisions().forEach((n) => this.rejectNode(n)); E().node.normalize(); after(); WC.toast('All changes rejected.'); },
    acceptOne() { const n = this.currentRevision(); if (n) { this.acceptNode(n); after(); this.nextChange(); } else this.acceptAll(); },
    rejectOne() { const n = this.currentRevision(); if (n) { this.rejectNode(n); after(); this.nextChange(); } else this.rejectAll(); },
    currentRevision() { const sel = window.getSelection(); if (sel.rangeCount) { let n = sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n; const rev = n && n.closest && n.closest('ins.wc-ins, del.wc-del'); if (rev) return rev; } return this.revisions()[0]; },
    nextChange() { const revs = this.revisions(); if (revs.length) { revs[0].scrollIntoView({ block: 'center' }); const r = document.createRange(); r.selectNode(revs[0]); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } else WC.toast('No more changes.'); },
    prevChange() { const revs = this.revisions(); if (revs.length) revs[revs.length - 1].scrollIntoView({ block: 'center' }); },
    setDisplayMode(mode) { this.displayMode = mode; E().node.classList.remove('review-all', 'review-simple', 'review-none', 'review-original'); E().node.classList.add('review-' + mode); WC.toast('Display for Review: ' + mode); },

    // ---- Reviewing Pane ----
    reviewingPane() {
      let pane = document.getElementById('review-pane'); if (pane) { pane.remove(); return; }
      pane = el('div', { class: 'taskpane', id: 'review-pane' });
      const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Revisions' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
      const body = el('div', { class: 'tp-body' });
      const revs = this.revisions();
      if (!revs.length) body.appendChild(el('div', { style: { color: '#888', padding: '10px 4px' }, text: 'No changes tracked.' }));
      revs.forEach((n) => { const row = el('div', { class: 'tp-result' }, [el('b', { text: (n.tagName === 'INS' ? 'Inserted' : 'Deleted') + ': ' }), document.createTextNode(n.textContent.slice(0, 40))]); row.addEventListener('click', () => n.scrollIntoView({ block: 'center' })); body.appendChild(row); });
      pane.appendChild(head); pane.appendChild(body); document.getElementById('workarea').appendChild(pane);
    },

    // ---- Comments navigation ----
    comments() { return Array.from(E().node.querySelectorAll('[data-comment]')); },
    deleteComment() { const c = this.currentComment() || this.comments()[0]; if (c) { c.replaceWith(...c.childNodes); WC.toast('Comment deleted.'); } },
    deleteAllComments() { this.comments().forEach((c) => c.replaceWith(...c.childNodes)); WC.toast('All comments deleted.'); },
    currentComment() { const sel = window.getSelection(); if (sel.rangeCount) { let n = sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n; return n && n.closest && n.closest('[data-comment]'); } return null; },
    nextComment() { const cs = this.comments(); if (!cs.length) { WC.toast('No comments.'); return; } this.commentIdx = (this.commentIdx + 1) % cs.length; cs[this.commentIdx].scrollIntoView({ block: 'center' }); },
    prevComment() { const cs = this.comments(); if (!cs.length) { WC.toast('No comments.'); return; } this.commentIdx = (this.commentIdx - 1 + cs.length) % cs.length; cs[this.commentIdx].scrollIntoView({ block: 'center' }); },
    showComments() { if (WC.Comments && WC.Comments.togglePane) WC.Comments.togglePane(); else E().node.classList.toggle('hide-comments'); },

    // ---- Accessibility Checker ----
    checkAccessibility() {
      const issues = [];
      E().node.querySelectorAll('img').forEach((img, i) => { if (!img.getAttribute('alt')) issues.push({ sev: 'Error', msg: 'Image #' + (i + 1) + ' is missing alt text.' }); });
      const heads = Array.from(E().node.querySelectorAll('h1,h2,h3,h4')).map((h) => +h.tagName[1]);
      for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) { issues.push({ sev: 'Warning', msg: 'Heading level skipped (h' + heads[i - 1] + ' → h' + heads[i] + ').' }); break; }
      E().node.querySelectorAll('table').forEach((t, i) => { if (!t.querySelector('th')) issues.push({ sev: 'Warning', msg: 'Table #' + (i + 1) + ' has no header row.' }); });
      let pane = document.getElementById('a11y-pane'); if (pane) pane.remove();
      pane = el('div', { class: 'taskpane right', id: 'a11y-pane' });
      const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Accessibility' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
      const body = el('div', { class: 'tp-body' });
      if (!issues.length) body.appendChild(el('div', { style: { color: '#107C10', padding: '10px 4px' }, text: '✓ No accessibility issues found.' }));
      issues.forEach((is) => body.appendChild(el('div', { class: 'tp-result' }, [el('b', { text: is.sev + ': ', style: { color: is.sev === 'Error' ? '#A4262C' : '#797673' } }), document.createTextNode(is.msg)])));
      pane.appendChild(head); pane.appendChild(body); document.getElementById('workarea').appendChild(pane);
      return issues.length;
    },

    // ---- Thesaurus (small built-in) ----
    THES: { good: ['great', 'fine', 'excellent', 'superb'], bad: ['poor', 'inferior', 'awful'], big: ['large', 'huge', 'enormous'], small: ['little', 'tiny', 'compact'], happy: ['glad', 'joyful', 'content'], important: ['crucial', 'vital', 'significant'], quick: ['fast', 'rapid', 'swift'], said: ['stated', 'noted', 'remarked'] },
    wordAtCaret() {
      const sel = window.getSelection(); if (!sel.rangeCount) return '';
      let n = sel.anchorNode; if (!n || n.nodeType !== 3) return '';
      const text = n.nodeValue, off = sel.anchorOffset;
      let s = off, e = off; while (s > 0 && /\w/.test(text[s - 1])) s--; while (e < text.length && /\w/.test(text[e])) e++;
      return text.slice(s, e).trim();
    },
    thesaurus() {
      const sel = window.getSelection(); const word = ((sel && sel.toString().trim()) || this.wordAtCaret() || '').trim();
      if (!word) {
        const input = el('input', { type: 'text', class: 'grow', placeholder: 'Word to look up' });
        WC.dialog({ title: 'Thesaurus', width: '360px', body: el('div', { class: 'row' }, [el('label', { text: 'Word:', style: { width: '50px' } }), input]), footer: [{ label: 'Look Up', primary: true, onClick: () => this.showThesaurus(input.value.trim()) }, { label: 'Cancel' }] });
        return;
      }
      this.showThesaurus(word);
    },
    showThesaurus(word) {
      word = (word || '').trim(); if (!word) return;
      const syns = this.THES[word.toLowerCase()];
      const body = el('div', { class: 'tp-body' });
      if (syns) syns.forEach((s) => { const row = el('div', { class: 'tp-result', text: s, style: { cursor: 'pointer' } }); row.addEventListener('click', () => { E().focus(); E().restoreRange(); E().exec('insertText', s); }); body.appendChild(row); });
      else body.appendChild(el('div', { style: { color: '#888', padding: '10px' }, text: 'No synonyms for “' + word + '” in the built-in thesaurus.' }));
      let pane = document.getElementById('thes-pane'); if (pane) pane.remove();
      pane = el('div', { class: 'taskpane right', id: 'thes-pane' }); pane.appendChild(el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Thesaurus: ' + word }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })])); pane.appendChild(body);
      document.getElementById('workarea').appendChild(pane);
    },

    // ---- Restrict Editing / Compare / misc ----
    restrictEditing() { const ro = E().node.getAttribute('contenteditable') === 'false'; E().node.setAttribute('contenteditable', ro ? 'true' : 'false'); WC.toast(ro ? 'Editing restrictions removed.' : 'Editing restricted (read-only). Click Restrict Editing again to allow.'); },
    hideInk() { const layer = E().node.querySelector('.ink-layer'); if (layer) layer.style.display = layer.style.display === 'none' ? '' : 'none'; WC.toast('Ink ' + (layer && layer.style.display === 'none' ? 'hidden' : 'shown')); },
    compare(mode) {
      mode = mode || 'compare';
      const combine = mode === 'combine';
      const a = el('textarea', { class: 'grow', rows: '4', placeholder: combine ? 'First reviewer’s document' : 'Original text' });
      const b = el('textarea', { class: 'grow', rows: '4', placeholder: combine ? 'Second reviewer’s document' : 'Revised text' });
      WC.dialog({ title: combine ? 'Combine Documents' : 'Compare Documents', width: '520px', body: el('div', {}, [
        el('div', { text: combine ? 'These two sets of revisions will be merged into a single document.' : 'Word will compare the two documents and show the differences as tracked changes.', style: { fontSize: '12px', color: '#666', marginBottom: '6px' } }),
        el('div', { text: combine ? 'Original document:' : 'Original:' }), a,
        el('div', { style: { marginTop: '6px' }, text: combine ? 'Revised document:' : 'Revised:' }), b,
      ]), footer: [
        { label: combine ? 'Combine' : 'Compare', primary: true, onClick: () => { E().setHTML('<p>' + wordDiff(a.value, b.value) + '</p>'); this.setDisplayMode('all'); WC.toast(combine ? 'Documents combined; revisions shown as tracked changes.' : 'Differences shown as tracked changes.'); } },
        { label: 'Cancel' },
      ] });
    },
  };
  function place(node, offset) { const r = document.createRange(); r.setStart(node, Math.min(offset, node.length || 0)); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  function after() { E().saveRange(); E().dirty = true; E().repaginate(); E().updateStatus(); E().emit(); }
  function wordDiff(o, n) {
    const ow = o.split(/(\s+)/), nw = n.split(/(\s+)/); let out = ''; const set = new Set(ow);
    const nset = new Set(nw);
    ow.forEach((w) => { if (!nset.has(w) && w.trim()) out += '<del class="wc-del">' + WC.escapeHtml(w) + '</del>'; });
    nw.forEach((w) => { if (!set.has(w) && w.trim()) out += '<ins class="wc-ins">' + WC.escapeHtml(w) + '</ins>'; else out += WC.escapeHtml(w); });
    return out;
  }
  WC.Review = Review;
})();
