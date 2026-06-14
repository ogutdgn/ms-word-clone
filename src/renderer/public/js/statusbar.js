/* statusbar.js — bottom status bar: page count, word count, view buttons, zoom */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;

  const StatusBar = {
    node: null, pageEl: null, wordEl: null, zlevel: null, zslider: null,

    init() {
      this.node = document.getElementById('statusbar');
      const left = el('div', { style: { display: 'flex', alignItems: 'center', height: '100%' } });
      this.pageEl = el('span', { class: 'sb-item', text: 'Page 1 of 1', onclick: () => WC.Dialogs.goTo && WC.Dialogs.goTo() });
      this.wordEl = el('span', { class: 'sb-item', text: '0 words', onclick: () => WC.Dialogs.wordCount() });
      const lang = el('span', { class: 'sb-item', text: 'English (United States)' });
      const spell = el('span', { class: 'sb-item', html: WC.icon('spellingGrammar', 14), title: 'Proofing' });
      spell.addEventListener('click', () => WC.Commands.run({ cmd: 'spellingGrammar', label: 'Spelling & Grammar' }));
      this.sensEl = el('span', { class: 'sb-item', style: { display: 'none' } });
      left.appendChild(this.pageEl); left.appendChild(this.wordEl); left.appendChild(lang); left.appendChild(spell); left.appendChild(this.sensEl);

      const spacer = el('div', { class: 'sb-spacer' });

      const right = el('div', { style: { display: 'flex', alignItems: 'center', height: '100%' } });
      const views = [['readMode', 'Read Mode', 'read'], ['printLayout', 'Print Layout', 'print'], ['webLayout', 'Web Layout', 'web']];
      this.viewBtns = {};
      views.forEach(([icon, title, v]) => {
        const b = el('span', { class: 'view-btn' + (v === 'print' ? ' active' : ''), title, html: WC.icon(icon, 16) });
        b.addEventListener('click', () => {
          if (v === 'read') { WC.Commands.run({ cmd: 'readMode', label: 'Read Mode' }); return; }
          if (WC.closeReadMode) WC.closeReadMode();
          WC.PM.setView(v); this.setActiveView(v);
        });
        this.viewBtns[v] = b; right.appendChild(b);
      });
      right.appendChild(el('span', { class: 'sb-sep' }));

      const zoom = el('div', { class: 'zoom-control' });
      const minus = el('span', { class: 'zbtn', text: '−', onclick: () => WC.PM.zoomOut() });
      this.zslider = el('input', { type: 'range', min: '10', max: '500', value: '100' });
      this.zslider.addEventListener('input', () => WC.PM.setZoom(parseInt(this.zslider.value, 10) / 100));
      const plus = el('span', { class: 'zbtn', text: '+', onclick: () => WC.PM.zoomIn() });
      this.zlevel = el('span', { class: 'zlevel', text: '100%', onclick: () => WC.Dialogs.zoom() });
      zoom.appendChild(minus); zoom.appendChild(this.zslider); zoom.appendChild(plus); zoom.appendChild(this.zlevel);
      right.appendChild(zoom);

      this.node.appendChild(left); this.node.appendChild(spacer); this.node.appendChild(right);
      this.update(); this.updateZoom();
    },

    setActiveView(v) { for (const k in this.viewBtns) this.viewBtns[k].classList.toggle('active', k === v); },

    setSensitivity(label) {
      if (!this.sensEl) return;
      if (label) { this.sensEl.textContent = '🔒 ' + label; this.sensEl.style.display = ''; }
      else { this.sensEl.style.display = 'none'; }
    },

    update() {
      if (!this.node) return;
      // WC.Editor retired (slice 11): the PM bridge owns counts. The pre-mount
      // counts() stub returns zeros (the correct boot display) before PM.ready.
      if (!(WC.PM && WC.PM.active)) return;
      // Continuous flow until Phase 7 — report honestly (spec §7.8).
      this.pageEl.textContent = 'Page 1 of 1';
      const c = WC.PM.counts();
      this.wordEl.textContent = c.selWords ? `${c.selWords} of ${c.words} words` : `${c.words} words`;
    },
    updateZoom() {
      if (!this.zlevel) return;
      const pct = Math.round(((window.WC.PM && window.WC.PM.zoom) || 1) * 100);
      this.zlevel.textContent = pct + '%';
      this.zslider.value = String(pct);
    },
  };

  WC.StatusBar = StatusBar;
})();
