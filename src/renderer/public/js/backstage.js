/* backstage.js — full-screen File menu (New, Open, Print, Save, Export…). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;

  const Backstage = {
    root: null, railEl: null, contentEl: null, active: 'home',

    init() {
      this.root = document.getElementById('backstage');
      this.render();
    },

    render() {
      this.root.innerHTML = '';
      const rail = el('div', { class: 'bs-rail' });
      const back = el('div', { class: 'bs-back', html: WC.icon('back', 18), title: 'Back' });
      back.addEventListener('click', () => this.close());
      rail.appendChild(back);

      const items = [
        ['home', 'Home'], ['new', 'New'], ['open', 'Open'], ['SEP'],
        ['info', 'Info'], ['save', 'Save'], ['saveAs', 'Save As'], ['print', 'Print'], ['share', 'Share'], ['export', 'Export'], ['close', 'Close'], ['SEP'],
        ['account', 'Account'], ['feedback', 'Feedback'], ['options', 'Options'],
      ];
      this.railButtons = {};
      items.forEach((it) => {
        if (it[0] === 'SEP') { rail.appendChild(el('div', { class: 'bs-rail-sep' })); return; }
        const b = el('div', { class: 'bs-rail-item', text: it[1], dataset: { pane: it[0] } });
        b.addEventListener('click', () => this.show(it[0]));
        this.railButtons[it[0]] = b; rail.appendChild(b);
      });
      this.content = el('div', { class: 'bs-content' });
      this.root.appendChild(rail);
      this.root.appendChild(this.content);
    },

    open(section) { this.root.hidden = false; this.show(section || 'home'); },
    close() { this.root.hidden = true; },

    show(pane) {
      this.active = pane;
      for (const k in this.railButtons) this.railButtons[k].classList.toggle('active', k === pane);
      // immediate actions
      if (pane === 'save') { this.close(); WC.Files.save(); return; }
      if (pane === 'saveAs') { this.close(); WC.Files.saveAs(); return; }
      if (pane === 'close') { WC.Files.newDoc(); return; }
      if (pane === 'share') { WC.toast('Sharing requires a cloud backend — not implemented.', 'See docs/NOT_IMPLEMENTED.md'); return; }
      this.content.innerHTML = '';
      const fn = this['pane_' + pane];
      if (fn) fn.call(this); else this.paneGeneric(pane);
    },

    pane_home() {
      this.content.appendChild(el('h1', { text: 'Good ' + dayPart() }));
      this.content.appendChild(el('div', { style: { fontSize: '15px', margin: '0 0 14px', color: '#444' }, text: 'New' }));
      const grid = el('div', { class: 'tpl-grid' });
      grid.appendChild(this.templateCard('Blank document', null, () => WC.Files.newDoc()));
      TEMPLATES.forEach((t) => grid.appendChild(this.templateCard(t.name, t, () => this.useTemplate(t))));
      this.content.appendChild(grid);
      this.content.appendChild(el('div', { style: { fontSize: '15px', margin: '22px 0 8px', color: '#444' }, text: 'Recent' }));
      this.recentList(this.content);
    },

    pane_feedback() {
      this.content.appendChild(el('h1', { text: 'Feedback' }));
      this.content.appendChild(el('div', { style: { color: '#444', margin: '0 0 16px' }, text: 'Tell us what you think of this Word clone.' }));
      const card = (icon, title, placeholder) => {
        const c = el('div', { style: { border: '1px solid #e1dfdd', borderRadius: '6px', padding: '14px', marginBottom: '12px', maxWidth: '560px' } });
        c.appendChild(el('div', { style: { fontWeight: '600', marginBottom: '6px' } }, [el('span', { style: { marginRight: '8px' }, text: icon }), el('span', { text: title })]));
        const ta = el('textarea', { class: 'grow', rows: '3', placeholder });
        const send = el('button', { class: 'btn primary', text: 'Submit', style: { marginTop: '8px' }, onclick: () => { WC.toast('Thanks for your feedback!'); ta.value = ''; } });
        c.appendChild(ta); c.appendChild(send);
        return c;
      };
      this.content.appendChild(card('👍', 'I like something', 'What do you like?'));
      this.content.appendChild(card('👎', 'I don’t like something', 'What can we improve?'));
      this.content.appendChild(card('💡', 'I have a suggestion', 'Share your idea'));
    },

    pane_new() {
      this.content.appendChild(el('h1', { text: 'New' }));
      const grid = el('div', { class: 'tpl-grid' });
      grid.appendChild(this.templateCard('Blank document', null, () => WC.Files.newDoc()));
      TEMPLATES.forEach((t) => grid.appendChild(this.templateCard(t.name, t, () => this.useTemplate(t))));
      this.content.appendChild(grid);
    },

    async pane_open() {
      this.content.appendChild(el('h1', { text: 'Open' }));
      const browse = el('div', { class: 'bs-action' }, [
        el('span', { class: 'bic', html: WC.icon('blankPage', 28) }),
        el('div', { class: 'btxt' }, [el('div', { class: 'bt', text: 'Browse' }), el('div', { class: 'bd', text: 'Open a .docx, .html, .txt or .csv file from this PC' })]),
      ]);
      browse.addEventListener('click', () => WC.Files.open());
      this.content.appendChild(browse);
      this.content.appendChild(el('div', { style: { fontSize: '15px', margin: '18px 0 8px', color: '#444' }, text: 'Recent' }));
      this.recentList(this.content);
    },

    pane_info() {
      this.content.appendChild(el('h1', { text: 'Info' }));
      const f = WC.Files;
      const props = el('div', { class: 'info-props' });
      const c = WC.PM.counts();
      const rows = [['Name', f.name], ['Location', f.path || 'Not saved yet'], ['Format', (f.format || 'docx').toUpperCase()], ['Words', c.words], ['Pages', c.pages]];
      rows.forEach(([k, v]) => props.appendChild(el('div', { class: 'row' }, [el('span', { class: 'k', text: k }), el('span', { text: String(v) })])));
      this.content.appendChild(props);
      this.content.appendChild(el('div', { style: { marginTop: '18px', color: '#888', maxWidth: '560px', fontSize: '12px' }, text: 'Protect Document, Inspect Document, and Version History are part of Word but are not implemented in this clone (see docs/NOT_IMPLEMENTED.md).' }));
    },

    pane_print() {
      this.content.appendChild(el('h1', { text: 'Print' }));
      const wrap = el('div', { class: 'print-pane' });
      const settings = el('div', { class: 'print-settings' });
      const printBtn = el('div', { class: 'pbtn', html: WC.icon('printLayout', 20) + '<span>Print</span>' });
      printBtn.addEventListener('click', () => { this.close(); WC.Files.print(); });
      settings.appendChild(printBtn);
      settings.appendChild(prow('Copies', el('input', { type: 'number', value: '1', min: '1' })));
      settings.appendChild(prow('Printer', el('select', {}, [el('option', { text: 'System Printer' }), el('option', { text: 'Microsoft Print to PDF' })])));
      settings.appendChild(prow('Pages', el('input', { type: 'text', placeholder: 'e.g. 1-3, 5' })));
      settings.appendChild(prow('Orientation', el('select', {}, [el('option', { text: 'Portrait' }), el('option', { text: 'Landscape' })])));
      settings.appendChild(prow('Paper size', el('select', {}, [el('option', { text: 'Letter (8.5" x 11")' }), el('option', { text: 'A4' })])));
      const pdfBtn = el('button', { class: 'btn', text: 'Export to PDF instead', style: { marginTop: '12px' } });
      pdfBtn.addEventListener('click', () => { this.close(); WC.Files.exportPdf(); });
      settings.appendChild(pdfBtn);
      function prow(label, ctrl) { return el('div', { class: 'prow' }, [el('label', { text: label }), ctrl]); }

      const preview = el('div', { class: 'print-preview' });
      const sheet = el('div', { class: 'sheet' });
      sheet.innerHTML = WC.PM.getHTML();
      preview.appendChild(sheet);
      wrap.appendChild(settings); wrap.appendChild(preview);
      this.content.appendChild(wrap);
    },

    pane_export() {
      this.content.appendChild(el('h1', { text: 'Export' }));
      const pdf = el('div', { class: 'bs-action' }, [
        el('span', { class: 'bic', html: WC.icon('blankPage', 28) }),
        el('div', { class: 'btxt' }, [el('div', { class: 'bt', text: 'Create PDF/XPS Document' }), el('div', { class: 'bd', text: 'Preserves layout — paginated by the print engine' })]),
      ]);
      pdf.addEventListener('click', () => { this.close(); WC.Files.exportPdf(); });
      this.content.appendChild(pdf);
      const docx = el('div', { class: 'bs-action' }, [
        el('span', { class: 'bic', html: WC.icon('save', 28) }),
        el('div', { class: 'btxt' }, [el('div', { class: 'bt', text: 'Change File Type' }), el('div', { class: 'bd', text: 'Save As .docx / .html / .txt' })]),
      ]);
      docx.addEventListener('click', () => { this.close(); WC.Files.saveAs(); });
      this.content.appendChild(docx);
    },

    pane_account() {
      this.content.appendChild(el('h1', { text: 'Account' }));
      const box = el('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', margin: '10px 0' } }, [
        el('div', { class: 'avatar', style: { width: '64px', height: '64px', borderRadius: '50%', background: 'var(--word-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }, text: 'W' }),
        el('div', {}, [el('div', { style: { fontSize: '18px', fontWeight: '600' }, text: 'Word User' }), el('div', { style: { color: '#888' }, text: 'Local account' })]),
      ]);
      this.content.appendChild(box);
      this.content.appendChild(el('div', { style: { color: '#444', maxWidth: '560px' }, text: 'Product: Word Clone 1.0 — an Electron-based faithful reproduction of the Microsoft Word UI and core editing features. Built for this exercise; not affiliated with Microsoft.' }));
    },

    pane_options() {
      this.content.appendChild(el('h1', { text: 'Word Options' }));
      const list = el('div', { class: 'info-props' });
      [['Theme', 'Colorful (M365 light)'], ['Default font', 'Calibri 11'], ['Page size', 'Letter'], ['Margins', 'Normal (1")'], ['Editor engine', 'ProseMirror'], ['File round-trip', 'SuperDoc fork super-converter']].forEach(([k, v]) =>
        list.appendChild(el('div', { class: 'row' }, [el('span', { class: 'k', style: { width: '160px' }, text: k }), el('span', { text: v })])));
      this.content.appendChild(list);
      this.content.appendChild(el('div', { style: { marginTop: '16px', color: '#888', fontSize: '12px', maxWidth: '560px' }, text: 'The full multi-tab Word Options dialog (Proofing, AutoCorrect, Advanced, Customize Ribbon, etc.) is not implemented.' }));
    },

    paneGeneric(pane) {
      this.content.appendChild(el('h1', { text: (this.railButtons[pane] && this.railButtons[pane].textContent) || pane }));
      this.content.appendChild(el('div', { style: { color: '#888' }, text: 'This backstage section is part of Word but is not implemented in this clone.' }));
    },

    templateCard(name, tpl, onClick) {
      const card = el('div', { class: 'tpl-card' });
      const thumb = el('div', { class: 'tpl-thumb' + (tpl ? '' : ' blank') });
      if (tpl) thumb.innerHTML = `<div style="transform:scale(.42);transform-origin:top left;width:238%;padding:18px 22px;font-family:var(--doc-font)">${tpl.preview}</div>`;
      else thumb.appendChild(el('div', { html: WC.icon('blankPage', 48) }));
      card.appendChild(thumb);
      card.appendChild(el('div', { class: 'tpl-name', text: name }));
      card.addEventListener('click', onClick);
      return card;
    },

    async useTemplate(t) {
      if (!(await WC.Files.confirmDiscard())) return;
      if (!(await WC.PM.openHtml(t.content))) { WC.toast('Could not create document from template'); return; }
      WC.Files.path = null; WC.Files.name = t.name; WC.Files.format = 'docx'; WC.Files.setClean(); WC.Files.updateTitle();
      this.close();
    },

    async recentList(container) {
      const list = el('div', { class: 'recent-list' });
      container.appendChild(list);
      const recents = await window.wordAPI.recent.list();
      if (!recents.length) { list.appendChild(el('div', { style: { color: '#888', padding: '12px 0' }, text: 'No recent documents yet.' })); return; }
      recents.forEach((r) => {
        const row = el('div', { class: 'recent-row' }, [
          el('span', { class: 'ric', html: WC.icon('blankPage', 24) }),
          el('div', {}, [el('div', { class: 'rname', text: r.name }), el('div', { class: 'rpath', text: r.path })]),
          el('span', { class: 'rmeta', text: timeAgo(r.at) }),
        ]);
        row.addEventListener('click', () => WC.Files.open(r.path));
        list.appendChild(row);
      });
    },
  };

  function dayPart() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
  function timeAgo(ts) { if (!ts) return ''; const d = (Date.now() - ts) / 1000; if (d < 60) return 'Just now'; if (d < 3600) return Math.floor(d / 60) + 'm ago'; if (d < 86400) return Math.floor(d / 3600) + 'h ago'; return new Date(ts).toLocaleDateString(); }

  const TEMPLATES = [
    { name: 'Resume', preview: '<h1 class="doc-title">Your Name</h1><p class="doc-subtitle">City, State • email@example.com • (555) 555-5555</p><h2>Experience</h2><p><b>Job Title</b> — Company<br>2020–Present</p><h2>Education</h2><p>Degree, University</p>',
      content: '<h1 class="doc-title">Your Name</h1><p class="doc-subtitle">City, State • email@example.com • (555) 555-5555</p><h2>Experience</h2><p><b>Job Title</b> — Company, 2020–Present</p><p>Describe your accomplishments here.</p><h2>Education</h2><p>Degree, University</p><h2>Skills</h2><ul><li>Skill one</li><li>Skill two</li></ul>' },
    { name: 'Cover Letter', preview: '<p>Dear Hiring Manager,</p><p>I am writing to apply for…</p>',
      content: '<p>[Your Name]<br>[Address]<br>[Date]</p><p>Dear Hiring Manager,</p><p>I am writing to express my interest in the [Position] role at [Company]. With my background in [field], I am confident I would be a strong addition to your team.</p><p>Sincerely,<br>[Your Name]</p>' },
    { name: 'Report', preview: '<h1 class="doc-title">Report Title</h1><h2>Introduction</h2><p>Lorem ipsum…</p>',
      content: '<h1 class="doc-title">Report Title</h1><p class="doc-subtitle">Prepared by [Author] • ' + new Date().toLocaleDateString() + '</p><h1>Introduction</h1><p>Provide an overview here.</p><h1>Findings</h1><h2>Section 1</h2><p>Details…</p><h1>Conclusion</h1><p>Summary…</p>' },
    { name: 'Letter', preview: '<p>Dear [Name],</p><p>Body of the letter…</p>',
      content: '<p>[Date]</p><p>Dear [Name],</p><p>Write the body of your letter here.</p><p>Warm regards,<br>[Your Name]</p>' },
  ];

  WC.Backstage = Backstage;
})();
