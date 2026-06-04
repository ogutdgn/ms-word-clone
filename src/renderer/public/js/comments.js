/* comments.js — Word-style modern comments: select text → New Comment anchors
   a highlight and opens a comment card in the right pane (author, time, text,
   delete/resolve). No prompt() (Electron disables it). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;
  let seq = 0;

  const Comments = {
    add() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !E().node.contains(sel.anchorNode)) { WC.toast('Select the text you want to comment on, then click New Comment.'); return; }
      const id = 'cmt' + (++seq) + Date.now().toString(36).slice(-3);
      const span = el('span', { class: 'wc-comment-anchor', dataset: { commentId: id, comment: '' } });
      const range = sel.getRangeAt(0);
      try { range.surroundContents(span); } catch (e) { span.appendChild(range.extractContents()); range.insertNode(span); }
      E().dirty = true; E().repaginate();
      this.openPane();
      this.renderCards(id);
    },
    anchors() { return Array.from(E().node.querySelectorAll('.wc-comment-anchor, [data-comment]')); },
    openPane() {
      let pane = document.getElementById('comments-pane');
      if (!pane) {
        pane = el('div', { class: 'taskpane right', id: 'comments-pane' });
        pane.appendChild(el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Comments' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]));
        pane.appendChild(el('div', { class: 'tp-body', id: 'comments-body' }));
        document.getElementById('workarea').appendChild(pane);
      }
      return pane;
    },
    togglePane() { const p = document.getElementById('comments-pane'); if (p) p.remove(); else { this.openPane(); this.renderCards(); } },
    renderCards(focusId) {
      const body = document.getElementById('comments-body'); if (!body) return;
      body.innerHTML = '';
      const anchors = this.anchors();
      if (!anchors.length) { body.appendChild(el('div', { style: { color: '#888', padding: '12px 4px', fontSize: '13px' }, text: 'No comments. Select text and click New Comment.' })); return; }
      anchors.forEach((a) => {
        if (!a.dataset.commentId) a.dataset.commentId = 'cmt' + (++seq);
        const id = a.dataset.commentId;
        const card = el('div', { class: 'comment-card', dataset: { commentId: id } });
        const head = el('div', { class: 'cc-head' }, [el('span', { class: 'cc-avatar', text: 'W' }), el('div', {}, [el('div', { class: 'cc-author', text: 'Word User' }), el('div', { class: 'cc-time', text: a.dataset.time || 'Just now' })])]);
        const ta = el('textarea', { class: 'cc-text', rows: '2', placeholder: 'Type a comment…' }); ta.value = a.dataset.comment || '';
        ta.addEventListener('input', () => { a.dataset.comment = ta.value; a.title = 'Comment: ' + ta.value; E().dirty = true; });
        const actions = el('div', { class: 'cc-actions' }, [
          el('button', { class: 'cc-btn', text: 'Resolve', onclick: () => { a.classList.toggle('resolved'); card.classList.toggle('resolved'); } }),
          el('button', { class: 'cc-btn del', text: 'Delete', onclick: () => this.delete(id) }),
        ]);
        card.appendChild(head); card.appendChild(ta); card.appendChild(actions);
        card.addEventListener('click', (e) => { if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return; a.scrollIntoView({ block: 'center', behavior: 'smooth' }); a.classList.add('wc-comment-focus'); setTimeout(() => a.classList.remove('wc-comment-focus'), 1200); });
        body.appendChild(card);
        if (id === focusId) { setTimeout(() => ta.focus(), 30); a.dataset.time = a.dataset.time || 'Just now'; }
      });
    },
    delete(id) {
      const a = E().node.querySelector('[data-comment-id="' + id + '"]');
      if (a) { a.replaceWith(...a.childNodes); E().dirty = true; }
      this.renderCards();
      WC.toast('Comment deleted.');
    },
    rebuild() { if (document.getElementById('comments-pane')) this.renderCards(); },
  };
  WC.Comments = Comments;
})();
