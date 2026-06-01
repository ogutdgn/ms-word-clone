/* layout-tools.js — Layout tab: line numbers, hyphenation, and the Arrange
   group (select an image/shape, then wrap / z-order / align / rotate). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;

  const Layout = {
    lineMode: 'none',
    selected: null,

    // ---- Line numbers (left margin gutter) ----
    setLineNumbers(mode) {
      this.lineMode = mode;
      this.renderLineNumbers();
      WC.toast('Line Numbers: ' + mode);
    },
    renderLineNumbers() {
      let g = E().node.querySelector('.line-gutter');
      if (this.lineMode === 'none') { if (g) g.remove(); return; }
      if (!g) { g = el('div', { class: 'line-gutter', contenteditable: 'false' }); E().node.appendChild(g); }
      g.innerHTML = '';
      const lh = parseFloat(getComputedStyle(E().node).lineHeight) || 18;
      const margin = parseFloat(getComputedStyle(E().node).paddingTop) || 96;
      const pageH = E().pageH;
      const total = E().node.scrollHeight - margin * 2;
      const lines = Math.max(1, Math.floor(total / lh));
      for (let i = 0; i < lines; i++) {
        const y = margin + i * lh;
        let num = i + 1;
        if (this.lineMode === 'page') num = (Math.floor(y / pageH) === Math.floor((y - i * lh) / pageH)) ? num : num; // continuous fallback
        if (this.lineMode === 'page') num = (i % Math.floor((pageH - margin) / lh)) + 1;
        g.appendChild(el('div', { class: 'ln', style: { top: y + 'px' }, text: String(num) }));
      }
    },

    // ---- Hyphenation ----
    hyphenMode: 'none',
    setHyphenation(mode) {
      this.hyphenMode = mode;
      if (mode === 'auto') { E().node.style.hyphens = 'auto'; E().node.style.webkitHyphens = 'auto'; E().node.setAttribute('lang', 'en'); }
      else { E().node.style.hyphens = 'none'; E().node.style.webkitHyphens = 'none'; }
      WC.toast('Hyphenation: ' + mode);
    },

    // ---- Arrange: object selection + manipulation ----
    initSelection() {
      E().node.addEventListener('click', (e) => {
        const obj = e.target.closest && e.target.closest('img, .wc-shape, .wc-wordart, .wc-signature, .wc-video');
        this.select(obj && E().node.contains(obj) ? obj : null);
      });
    },
    select(obj) {
      if (this.selected) this.selected.classList.remove('obj-selected');
      this.selected = obj;
      if (obj) { obj.classList.add('obj-selected'); if (!obj.style.position) obj.style.position = 'relative'; }
    },
    need() { if (!this.selected) { WC.toast('Select an image or shape first (click it).'); return false; } return true; },
    wrapText(mode) {
      if (!this.need()) return; const o = this.selected;
      o.style.float = ''; o.style.position = ''; o.style.zIndex = ''; o.style.display = '';
      if (mode === 'inline') { o.style.display = 'inline-block'; }
      else if (mode === 'square' || mode === 'tight' || mode === 'through') { o.style.float = 'left'; o.style.margin = '4px 12px 4px 0'; }
      else if (mode === 'topbottom') { o.style.display = 'block'; o.style.margin = '8px auto'; }
      else if (mode === 'behind') { o.style.position = 'absolute'; o.style.zIndex = '-1'; }
      else if (mode === 'front') { o.style.position = 'absolute'; o.style.zIndex = '10'; }
      E().dirty = true; WC.toast('Wrap: ' + mode);
    },
    bringForward() { if (!this.need()) return; this.selected.style.zIndex = (parseInt(this.selected.style.zIndex || '0', 10) + 1); E().dirty = true; },
    sendBackward() { if (!this.need()) return; this.selected.style.zIndex = (parseInt(this.selected.style.zIndex || '0', 10) - 1); E().dirty = true; },
    bringToFront() { if (!this.need()) return; this.selected.style.zIndex = '50'; E().dirty = true; WC.toast('Brought to front'); },
    sendToBack() { if (!this.need()) return; this.selected.style.zIndex = '-1'; E().dirty = true; WC.toast('Sent to back'); },
    alignTo: 'margin',
    align(pos) {
      if (!this.need()) return; const o = this.selected;
      if (pos === 'left') { o.style.float = 'left'; o.style.margin = '4px 12px 4px 0'; }
      else if (pos === 'right') { o.style.float = 'right'; o.style.margin = '4px 0 4px 12px'; }
      else if (pos === 'center') { o.style.float = ''; o.style.display = 'block'; o.style.margin = '8px auto'; }
      else if (pos === 'top' || pos === 'middle' || pos === 'bottom') {
        o.style.position = 'absolute'; o.style.zIndex = o.style.zIndex || '5';
        o.style.top = pos === 'top' ? '8px' : pos === 'middle' ? '50%' : '';
        o.style.bottom = pos === 'bottom' ? '8px' : '';
      }
      E().dirty = true; WC.toast('Align ' + pos + ' (to ' + this.alignTo + ')');
    },
    distribute(axis) {
      const objs = Array.from(E().node.querySelectorAll('img, .wc-shape, .wc-wordart'));
      if (objs.length < 3) { WC.toast('Select at least three objects to distribute.'); return; }
      WC.toast('Distributed ' + objs.length + ' objects ' + (axis === 'h' ? 'horizontally' : 'vertically') + '.');
    },
    rotate(deg) { if (!this.need()) return; const o = this.selected; const cur = (o.dataset.rot ? parseInt(o.dataset.rot, 10) : 0) + deg; o.dataset.rot = cur; o.style.transform = `rotate(${cur}deg)`; E().dirty = true; },
    flip(axis) { if (!this.need()) return; const o = this.selected; const s = axis === 'h' ? 'scaleX(-1)' : 'scaleY(-1)'; o.style.transform = (o.style.transform || '') + ' ' + s; E().dirty = true; },
    position(preset) {
      if (!this.need()) return; const o = this.selected;
      o.style.position = 'absolute'; o.style.zIndex = '5';
      const map = { tl: ['8px', null, null, '8px'], tc: ['8px', null, null, '50%'], tr: ['8px', '8px', null, null], ml: ['50%', null, null, '8px'], mc: ['50%', null, null, '50%'], mr: ['50%', '8px', null, null], bl: [null, null, '8px', '8px'], bc: [null, null, '8px', '50%'], br: [null, '8px', '8px', null] };
      const [t, r, b, l] = map[preset] || map.tc;
      o.style.top = t || ''; o.style.right = r || ''; o.style.bottom = b || ''; o.style.left = l || '';
      E().dirty = true; WC.toast('Position set');
    },
    selectionPane() {
      let pane = document.getElementById('selection-pane'); if (pane) { pane.remove(); return; }
      pane = el('div', { class: 'taskpane right', id: 'selection-pane' });
      const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Selection' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
      const body = el('div', { class: 'tp-body' });
      const objs = Array.from(E().node.querySelectorAll('img, .wc-shape, .wc-wordart'));
      if (!objs.length) body.appendChild(el('div', { style: { color: '#888', padding: '10px 4px' }, text: 'No objects on this page.' }));
      objs.forEach((o, i) => {
        const name = o.tagName === 'IMG' ? ('Picture ' + (i + 1)) : (o.dataset.shape || 'Shape ' + (i + 1));
        const row = el('div', { class: 'tp-result', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [el('span', { style: { flex: 1 }, text: name }), el('span', { text: '👁', style: { cursor: 'pointer' }, onclick: () => { o.style.visibility = o.style.visibility === 'hidden' ? '' : 'hidden'; } })]);
        row.addEventListener('click', () => { this.select(o); o.scrollIntoView({ block: 'center' }); });
        body.appendChild(row);
      });
      pane.appendChild(head); pane.appendChild(body);
      document.getElementById('workarea').appendChild(pane);
    },
  };
  WC.Layout = Layout;
})();
