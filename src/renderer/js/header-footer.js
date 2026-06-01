/* header-footer.js — header & footer editing regions + page-number fields.
   On-screen the header/footer appear once (top/bottom of the page); the
   per-sheet repetition is approximated. Page-number fields auto-update from
   the pagination engine. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;

  const HF = {
    ensureHeader() {
      let h = E().node.querySelector('.wc-header');
      if (!h) { h = el('div', { class: 'wc-header', contenteditable: 'true' }, [el('span', { html: '&#8203;' })]); E().node.insertBefore(h, E().node.firstChild); }
      return h;
    },
    ensureFooter() {
      let f = E().node.querySelector('.wc-footer');
      if (!f) { f = el('div', { class: 'wc-footer', contenteditable: 'true' }, [el('span', { html: '&#8203;' })]); E().node.appendChild(f); }
      return f;
    },
    enterMode(which) {
      document.getElementById('app').classList.add('hf-edit');
      this.editing = which;
      const region = which === 'header' ? this.ensureHeader() : this.ensureFooter();
      region.focus();
      this.showBanner(which);
      if (WC.Ribbon && WC.Ribbon.showContextualTab) WC.Ribbon.showContextualTab(this.contextualTab());
      E().repaginate();
    },
    exitMode() { document.getElementById('app').classList.remove('hf-edit'); this.editing = null; if (this.banner) { this.banner.remove(); this.banner = null; } if (WC.Ribbon && WC.Ribbon.hideContextualTab) WC.Ribbon.hideContextualTab(); E().node.focus(); },
    goTo(which) { const r = which === 'header' ? this.ensureHeader() : this.ensureFooter(); this.editing = which; r.scrollIntoView({ block: 'center' }); r.focus(); },
    contextualTab() {
      return {
        id: 'header-footer', name: 'Header & Footer', contextual: true,
        groups: [
          { id: 'hf-headerfooter', name: 'Header & Footer', controls: [
            { cmd: 'header', label: 'Header', type: 'dropdown' },
            { cmd: 'footer', label: 'Footer', type: 'dropdown' },
            { cmd: 'pageNumber', label: 'Page Number', type: 'dropdown' },
          ] },
          { id: 'hf-insert', name: 'Insert', controls: [
            { cmd: 'dateTime', label: 'Date & Time', type: 'button' },
            { cmd: 'docInfo', label: 'Document Info', type: 'button' },
          ] },
          { id: 'hf-nav', name: 'Navigation', controls: [
            { cmd: 'goToHeader', label: 'Go to Header', type: 'button' },
            { cmd: 'goToFooter', label: 'Go to Footer', type: 'button' },
            { cmd: 'linkToPrevious', label: 'Link to Previous', type: 'button' },
          ] },
          { id: 'hf-options', name: 'Options', controls: [
            { cmd: 'differentFirstPage', label: 'Different First Page', type: 'button' },
            { cmd: 'differentOddEven', label: 'Different Odd & Even Pages', type: 'button' },
            { cmd: 'showDocText', label: 'Show Document Text', type: 'button' },
          ] },
          { id: 'hf-close', name: 'Close', controls: [
            { cmd: 'closeHeaderFooter', label: 'Close Header and Footer', type: 'button' },
          ] },
        ],
      };
    },
    showBanner(which) {
      if (this.banner) this.banner.remove();
      this.banner = el('div', { class: 'hf-banner' }, [
        el('span', { text: (which === 'header' ? 'Header' : 'Footer') + ' — editing' }),
        el('button', { class: 'btn primary', text: 'Close Header & Footer', onclick: () => this.exitMode() }),
      ]);
      document.body.appendChild(this.banner);
    },
    headerMenu(node) {
      WC.flyout(node, (fly) => {
        fly.appendChild(WC.flyHeader('Built-in'));
        fly.appendChild(WC.flyItem('Blank', { onClick: () => this.enterMode('header') }));
        fly.appendChild(WC.flyItem('Blank (Three Columns)', { onClick: () => { const h = this.ensureHeader(); h.innerHTML = '<span>[Left]</span><span style="float:right">[Right]</span><span style="display:block;text-align:center">[Center]</span>'; this.enterMode('header'); } }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Edit Header', { onClick: () => this.enterMode('header') }));
        fly.appendChild(WC.flyItem('Remove Header', { onClick: () => { const h = E().node.querySelector('.wc-header'); if (h) h.remove(); E().repaginate(); WC.toast('Header removed.'); } }));
      });
    },
    footerMenu(node) {
      WC.flyout(node, (fly) => {
        fly.appendChild(WC.flyHeader('Built-in'));
        fly.appendChild(WC.flyItem('Blank', { onClick: () => this.enterMode('footer') }));
        fly.appendChild(WC.flyItem('Page number (centered)', { onClick: () => { const f = this.ensureFooter(); f.innerHTML = '<span style="display:block;text-align:center">Page <span class="wc-field" data-field="page">1</span></span>'; this.enterMode('footer'); E().repaginate(); } }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Edit Footer', { onClick: () => this.enterMode('footer') }));
        fly.appendChild(WC.flyItem('Remove Footer', { onClick: () => { const f = E().node.querySelector('.wc-footer'); if (f) f.remove(); E().repaginate(); WC.toast('Footer removed.'); } }));
      });
    },
    pageNumberMenu(node) {
      WC.flyout(node, (fly) => {
        fly.appendChild(WC.flyItem('Top of Page', { onClick: () => { const h = this.ensureHeader(); h.innerHTML = '<span style="display:block;text-align:right">' + this.fieldHTML() + '</span>'; E().repaginate(); WC.toast('Page number added to header.'); } }));
        fly.appendChild(WC.flyItem('Bottom of Page', { onClick: () => { const f = this.ensureFooter(); f.innerHTML = '<span style="display:block;text-align:center">' + this.fieldHTML() + '</span>'; E().repaginate(); WC.toast('Page number added to footer.'); } }));
        fly.appendChild(WC.flyItem('Current Position', { onClick: () => { E().focus(); E().restoreRange(); E().insertHTML(this.fieldHTML() + '&nbsp;'); } }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Format Page Numbers…', { onClick: () => this.formatDialog() }));
        fly.appendChild(WC.flyItem('Remove Page Numbers', { onClick: () => { E().node.querySelectorAll('.wc-field[data-field="page"]').forEach((n) => n.remove()); WC.toast('Page numbers removed.'); } }));
      });
    },
    fieldHTML() { return '<span class="wc-field" data-field="page">' + E().currentPage() + '</span>'; },
    formatDialog() {
      const sel = el('select', {}, [['1, 2, 3', 'decimal'], ['a, b, c', 'lower-alpha'], ['A, B, C', 'upper-alpha'], ['i, ii, iii', 'lower-roman'], ['I, II, III', 'upper-roman']].map(([l, v]) => el('option', { value: v, text: l })));
      WC.dialog({ title: 'Page Number Format', width: '340px', body: el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Number format:', style: { width: '110px' } }), sel])]), footer: [
        { label: 'OK', primary: true, onClick: () => { E().node.querySelectorAll('.wc-field[data-field="page"]').forEach((n) => n.dataset.format = sel.value); E().repaginate(); } },
        { label: 'Cancel' },
      ] });
    },
    refresh() {
      if (!E().node) return;
      const total = E().pageCount();
      E().node.querySelectorAll('.wc-field[data-field="page"]').forEach((n) => { n.textContent = fmt(E().pageOfElement(n), n.dataset.format); });
      E().node.querySelectorAll('.wc-field[data-field="numpages"]').forEach((n) => { n.textContent = String(total); });
    },
  };
  function fmt(num, format) {
    if (format === 'lower-alpha') return String.fromCharCode(96 + ((num - 1) % 26) + 1);
    if (format === 'upper-alpha') return String.fromCharCode(64 + ((num - 1) % 26) + 1);
    if (format === 'lower-roman') return roman(num).toLowerCase();
    if (format === 'upper-roman') return roman(num);
    return String(num);
  }
  function roman(n) { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, sym] of m) while (n >= v) { s += sym; n -= v; } return s || '1'; }
  WC.HeaderFooter = HF;
})();
