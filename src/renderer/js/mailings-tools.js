/* mailings-tools.js — Mailings tab: a real mail-merge engine (recipients,
   merge fields, address/greeting blocks, preview with live data, finish&merge). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;

  const DEFAULT_FIELDS = ['Title', 'FirstName', 'LastName', 'CompanyName', 'Address1', 'City', 'State', 'ZIP', 'Email'];

  const Mail = {
    fields: DEFAULT_FIELDS.slice(),
    recipients: [],
    mergeType: 'letters',
    previewOn: false,
    current: 0,
    template: null,

    startMailMerge(type) { this.mergeType = type; WC.toast('Mail merge type: ' + type); },
    selectRecipients() {},
    typeNewList() {
      const fields = this.fields.slice();
      const rows = this.recipients.length ? this.recipients.map((r) => Object.assign({}, r)) : [blank(fields)];
      const table = el('table', { style: { borderCollapse: 'collapse', width: '100%', fontSize: '12px' } });
      function render() {
        table.innerHTML = '';
        const thead = el('tr', {}); fields.forEach((f) => thead.appendChild(el('th', { text: f, style: { border: '1px solid #ccc', padding: '2px 4px', background: '#f3f2f1' } }))); thead.appendChild(el('th', { text: '', style: { border: '1px solid #ccc' } })); table.appendChild(thead);
        rows.forEach((row, ri) => { const tr = el('tr', {}); fields.forEach((f) => { const td = el('td', { style: { border: '1px solid #ccc', padding: '0' } }); const inp = el('input', { type: 'text', value: row[f] || '', style: { border: 'none', width: '90px', padding: '2px 4px', font: 'inherit' } }); inp.addEventListener('input', () => row[f] = inp.value); td.appendChild(inp); tr.appendChild(td); }); const del = el('td', { style: { border: '1px solid #ccc', textAlign: 'center', color: '#c0392b', cursor: 'pointer' }, text: '✕', onclick: () => { rows.splice(ri, 1); render(); } }); tr.appendChild(del); table.appendChild(tr); });
      }
      render();
      const body = el('div', {}, [el('div', { style: { maxHeight: '300px', overflow: 'auto' } }, [table]), el('button', { class: 'btn', text: '+ New Entry', style: { marginTop: '8px' }, onclick: () => { rows.push(blank(fields)); render(); } })]);
      WC.dialog({ title: 'New Address List', width: '720px', body, footer: [
        { label: 'OK', primary: true, onClick: () => { this.recipients = rows.filter((r) => Object.values(r).some((v) => v)); WC.toast(this.recipients.length + ' recipients.'); } },
        { label: 'Cancel' },
      ] });
    },
    async useExistingList() {
      const r = await window.wordAPI.open();
      if (!r || !r.ok) return;
      let rows;
      if (r.csv != null) {
        rows = parseCSV(r.csv);                     // real .csv/.tsv: RFC-4180 parse the raw text
      } else {
        // opened via another route (e.g. .txt): decode entities via the DOM, never strip them
        const tmp = document.createElement('div'); tmp.innerHTML = r.html || '';
        const text = (tmp.textContent || '');
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const delim = (lines[0] || '').includes('\t') ? '\t' : ',';
        rows = lines.map((l) => l.split(delim));
      }
      if (!rows || rows.length < 2) { WC.toast('No tabular data found. Use a CSV with a header row.'); return; }
      this.fields = rows[0].map((s) => s.trim());
      this.recipients = rows.slice(1)
        .map((cells) => { const o = {}; this.fields.forEach((f, i) => o[f] = (cells[i] != null ? String(cells[i]).trim() : '')); return o; })
        .filter((o) => Object.values(o).some((v) => v));
      WC.toast('Imported ' + this.recipients.length + ' recipients (' + this.fields.length + ' fields).');
    },
    editRecipientList() {
      if (!this.recipients.length) { WC.toast('No recipients yet. Use Select Recipients → Type a New List.'); return; }
      this.typeNewList();
    },

    insertMergeFieldMenu(node) {
      WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('Fields')); if (!this.fields.length) fly.appendChild(WC.flyItem('(no fields — select recipients first)', {})); this.fields.forEach((f) => fly.appendChild(WC.flyItem(f, { onClick: () => this.insertField(f, '«' + f + '»') }))); });
    },
    insertField(field, label, data) { let attrs = ''; if (data) Object.keys(data).forEach((k) => { if (data[k] != null) attrs += ' data-' + k + '="' + WC.escapeHtml(String(data[k])) + '"'; }); E().focus(); E().restoreRange(); E().insertNodeHTML('<span class="wc-mergefield" data-field="' + WC.escapeHtml(field) + '"' + attrs + '>' + WC.escapeHtml(label || ('«' + field + '»')) + '</span>&#8203;'); },
    addressBlock() {
      const fmt = el('select', {}, ['Mr. Joshua Randall Jr.', 'Joshua Randall', 'Joshua', 'Mr. Randall'].map((o) => el('option', { text: o })));
      const company = el('input', { type: 'checkbox', checked: 'checked' });
      const postal = el('input', { type: 'checkbox', checked: 'checked' });
      const preview = el('div', { style: { border: '1px solid #e1dfdd', borderRadius: '3px', padding: '10px', minHeight: '70px', background: '#fafafa', fontSize: '12px' } });
      let pIdx = 0;
      const refresh = () => { const rec = this.recipients[pIdx] || { Title: 'Mr.', FirstName: 'Joshua', LastName: 'Randall', CompanyName: 'Contoso', Address1: '123 Main St', City: 'Seattle', State: 'WA', ZIP: '98101' }; preview.innerHTML = this.composite('__AddressBlock__', rec) || '<span style="color:#999">No recipient data</span>'; };
      const nav = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' } }, [
        el('button', { class: 'btn', text: '‹', onclick: () => { if (this.recipients.length) { pIdx = (pIdx - 1 + this.recipients.length) % this.recipients.length; refresh(); } } }),
        el('span', { style: { fontSize: '11px', color: '#666' }, text: 'Preview recipient' }),
        el('button', { class: 'btn', text: '›', onclick: () => { if (this.recipients.length) { pIdx = (pIdx + 1) % this.recipients.length; refresh(); } } }),
      ]);
      refresh();
      const body = el('div', {}, [
        el('div', { text: 'Insert recipient’s name in this format:' }), fmt,
        el('div', { class: 'row', style: { marginTop: '6px' } }, [el('label', {}, [company, el('span', { text: ' Insert company name' })])]),
        el('div', { class: 'row' }, [el('label', {}, [postal, el('span', { text: ' Insert postal address' })])]),
        el('div', { style: { marginTop: '8px', fontWeight: '600' }, text: 'Preview' }), preview, nav,
      ]);
      WC.dialog({ title: 'Insert Address Block', width: '460px', body, footer: [
        { label: 'OK', primary: true, onClick: () => this.insertField('__AddressBlock__', '«AddressBlock»') },
        { label: 'Cancel' },
      ] });
    },
    greetingLine() {
      const greet = el('select', {}, ['Dear', 'To', 'Hello', '(none)'].map((o) => el('option', { text: o })));
      const nameFmt = el('select', {}, ['Mr. Randall', 'Joshua Randall', 'Joshua', 'Mr. Joshua Randall'].map((o) => el('option', { text: o })));
      const punct = el('select', {}, [',', ':', '!', '(none)'].map((o) => el('option', { text: o })));
      const fallback = el('input', { type: 'text', class: 'grow', value: 'Dear Sir or Madam,' });
      const preview = el('div', { style: { border: '1px solid #e1dfdd', borderRadius: '3px', padding: '10px', minHeight: '40px', background: '#fafafa', fontSize: '12px' } });
      let pIdx = 0;
      const refresh = () => { const rec = this.recipients[pIdx] || { Title: 'Mr.', LastName: 'Randall' }; const g = greet.value === '(none)' ? '' : greet.value + ' '; const p = punct.value === '(none)' ? '' : punct.value; preview.textContent = (g + [rec.Title, rec.LastName].filter(Boolean).join(' ') + p) || fallback.value; };
      [greet, nameFmt, punct].forEach((s) => s.addEventListener('change', refresh));
      fallback.addEventListener('input', refresh);
      refresh();
      const body = el('div', {}, [
        el('div', { text: 'Greeting line format:' }),
        el('div', { class: 'row' }, [greet, nameFmt, punct]),
        el('div', { class: 'row', style: { marginTop: '6px' } }, [el('label', { text: 'For invalid names:', style: { width: '120px' } }), fallback]),
        el('div', { style: { marginTop: '8px', fontWeight: '600' }, text: 'Preview' }), preview,
      ]);
      WC.dialog({ title: 'Insert Greeting Line', width: '480px', body, footer: [
        { label: 'OK', primary: true, onClick: () => this.insertField('__GreetingLine__', '«GreetingLine»', { greet: greet.value, punct: punct.value }) },
        { label: 'Cancel' },
      ] });
    },
    highlightMergeFields() { E().node.classList.toggle('show-mergefields'); },

    // Resolve a Word standard field name (e.g. "First Name") to the recipient's
    // actual column: Match Fields map first, then exact name, then squashed-name
    // match (FirstName ~ First Name) so blocks work even without Match Fields.
    _val(rec, std) {
      const m = this.matchMap || {}; const col = m[std];
      if (col && col !== '(not matched)' && rec[col] != null) return rec[col];
      if (rec[std] != null) return rec[std];
      const sq = std.toLowerCase().replace(/[^a-z]/g, '');
      const keys = Object.keys(rec);
      let k = keys.find((kk) => kk.toLowerCase().replace(/[^a-z]/g, '') === sq); // exact squashed
      if (!k) k = keys.find((kk) => { const ks = kk.toLowerCase().replace(/[^a-z]/g, ''); return ks && (ks.indexOf(sq) >= 0 || sq.indexOf(ks) >= 0); }); // contains (Company~CompanyName, ZIP Code~ZIP)
      return k ? rec[k] : '';
    },
    composite(field, rec, opts) {
      const esc = WC.escapeHtml; const v = (std) => this._val(rec, std);
      if (field === '__AddressBlock__') { return [[v('Title'), v('First Name'), v('Last Name')].filter(Boolean).join(' '), v('Company'), v('Address 1'), [v('City'), v('State')].filter(Boolean).join(', ') + ' ' + (v('ZIP Code') || '')].filter((s) => s && s.trim()).map(esc).join('<br>'); }
      if (field === '__GreetingLine__') { const greet = (opts && opts.greet) || 'Dear'; const punct = (opts && opts.punct) || ','; const g = greet === '(none)' ? '' : greet + ' '; const p = punct === '(none)' ? '' : punct; return esc(g + [v('Title'), v('Last Name')].filter(Boolean).join(' ') + p); }
      if (field === '__NextRecord__') { return ''; }
      return rec[field] != null ? esc(rec[field]) : '';
    },
    fill(rec) {
      const div = document.createElement('div'); div.innerHTML = this.template;
      div.querySelectorAll('.wc-mergefield').forEach((m) => { m.outerHTML = this.composite(m.dataset.field, rec || {}, { greet: m.dataset.greet, punct: m.dataset.punct }); });
      return div.innerHTML;
    },
    previewResults(on) {
      if (typeof on !== 'boolean') on = !this.previewOn;
      if (on) {
        if (!this.recipients.length) { WC.toast('No recipients to preview.'); return; }
        this.template = E().getHTML(); this.previewOn = true; this.current = 0;
        E().setHTML(this.fill(this.recipients[0]));
      } else { this.previewOn = false; if (this.template != null) E().setHTML(this.template); this.template = null; }
      const btn = WC.Ribbon.controlIndex.previewResults && WC.Ribbon.controlIndex.previewResults.node;
      if (btn) btn.classList.toggle('toggled', this.previewOn);
      WC.toast('Preview ' + (this.previewOn ? 'on (record 1 of ' + this.recipients.length + ')' : 'off'));
    },
    go(n) { if (!this.previewOn) { this.previewResults(true); return; } this.current = Math.max(0, Math.min(this.recipients.length - 1, n)); E().setHTML(this.fill(this.recipients[this.current])); if (WC.StatusBar) WC.StatusBar.update(); },
    first() { this.go(0); }, last() { this.go(this.recipients.length - 1); }, next() { this.go(this.current + 1); }, prev() { this.go(this.current - 1); },
    findRecipient() {
      const input = el('input', { type: 'text', class: 'grow', placeholder: 'Find text in recipient fields' });
      WC.dialog({ title: 'Find Entry', width: '400px', body: el('div', { class: 'row' }, [el('label', { text: 'Find:', style: { width: '50px' } }), input]), footer: [
        { label: 'Find Next', primary: true, onClick: () => { const q = input.value.trim(); if (!q) return true; const i = this.recipients.findIndex((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q.toLowerCase()))); if (i >= 0) this.go(i); else WC.toast('“' + q + '” not found.'); return true; } },
        { label: 'Close' },
      ] });
    },
    checkErrors() { const tmpl = this.previewOn ? this.template : E().getHTML(); const used = (tmpl.match(/data-field="([^"]+)"/g) || []).map((m) => m.slice(12, -1)).filter((f) => !f.startsWith('__')); const missing = used.filter((f) => !this.fields.includes(f)); WC.toast(missing.length ? 'Unmatched fields: ' + missing.join(', ') : (this.recipients.length ? 'No errors. ' + this.recipients.length + ' recipients ready.' : 'No recipients selected.')); },

    finishMerge(mode) {
      const tmpl = this.previewOn ? this.template : E().getHTML();
      if (!this.recipients.length) { WC.toast('No recipients. Select recipients first.'); return; }
      if (mode === 'print') { WC.toast('Merged ' + this.recipients.length + ' records — sending to Print.'); WC.Files.print(); return; }
      if (mode === 'email') { WC.toast('Sending email requires a mail backend — not implemented.', 'See docs/NOT_IMPLEMENTED.md'); return; }
      // Edit Individual Documents: one filled copy per recipient, page-break between,
      // opened in a NEW document so the merge template is not overwritten in place.
      const old = this.template; this.template = tmpl;
      const merged = this.recipients.map((r) => this.fill(r)).join('<div class="manual-break" contenteditable="false" style="break-after:page;page-break-after:always"></div>');
      this.template = old; this.previewOn = false;
      const n = this.recipients.length;
      return WC.Files.newDocWith(merged, 'Letters').then((ok) => { if (ok) WC.toast('Merged to a new document: ' + n + ' records.'); return ok; });
    },

    envelopes() {
      const deliver = el('textarea', { class: 'grow', rows: '4', placeholder: 'Delivery address' });
      const ret = el('textarea', { class: 'grow', rows: '3', placeholder: 'Return address' });
      WC.dialog({ title: 'Envelopes and Labels — Envelopes', width: '480px', body: el('div', {}, [el('div', { text: 'Delivery address:' }), deliver, el('div', { style: { marginTop: '8px' }, text: 'Return address:' }), ret]), footer: [
        { label: 'Add to Document', primary: true, onClick: () => { const env = '<div class="wc-envelope"><p style="font-size:9pt">' + WC.escapeHtml(ret.value).replace(/\n/g, '<br>') + '</p><div style="margin:140px 0 0 320px"><p>' + WC.escapeHtml(deliver.value).replace(/\n/g, '<br>') + '</p></div></div><div class="manual-break" style="break-after:page;page-break-after:always;border-top:1px dashed #b9b9b9"></div>'; E().node.insertAdjacentHTML('afterbegin', env); E().dirty = true; E().repaginate(); WC.toast('Envelope added as the first page (existing content preserved).'); } },
        { label: 'Print', onClick: () => WC.Files.print() },
        { label: 'Cancel' },
      ] });
    },
    labels() {
      const product = el('select', {}, ['Avery 5160 (3×10)', 'Avery 5161 (2×10)', 'Avery 5163 (2×5)'].map((p) => el('option', { text: p })));
      const text = el('textarea', { class: 'grow', rows: '3', placeholder: 'Label text' });
      const fullPage = el('input', { type: 'checkbox', checked: 'checked' });
      const buildHTML = () => { const m = product.value.match(/(\d+)×(\d+)/); const cols = +m[1], rows = +m[2]; let html = '<table class="wc-labels no-border" style="width:100%">'; for (let r = 0; r < rows; r++) { html += '<tr>'; for (let c = 0; c < cols; c++) html += '<td style="height:48px;font-size:9pt;border:1px dashed #ccc;padding:4px">' + WC.escapeHtml(text.value).replace(/\n/g, '<br>') + '</td>'; html += '</tr>'; } html += '</table>'; return { html, cols, rows }; };
      WC.dialog({ title: 'Envelopes and Labels — Labels', width: '460px', body: el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Product:' }), product]), el('div', { text: 'Address:' }), text, el('div', { class: 'row', style: { marginTop: '6px' } }, [el('label', {}, [fullPage, el('span', { text: ' Full page of the same label' })])])]), footer: [
        { label: 'New Document', primary: true, onClick: async () => { const { html, cols, rows } = buildHTML(); const ok = await WC.Files.newDocWith(html, 'Labels'); if (ok) WC.toast('Labels sheet created in a new document (' + cols + '×' + rows + ').'); } },
        { label: 'Print', onClick: async () => { const { html } = buildHTML(); const snap = E().getHTML(); E().node.insertAdjacentHTML('beforeend', html); E().repaginate(); try { await WC.Files.print(); } finally { E().setHTML(snap); } } },
        { label: 'Cancel' },
      ] });
    },
    matchFields() {
      // Word's standard address fields mapped to the recipient list's columns.
      const STD = ['Title', 'First Name', 'Last Name', 'Company', 'Address 1', 'City', 'State', 'ZIP Code', 'Country/Region', 'Email Address'];
      this.matchMap = this.matchMap || {};
      const cols = ['(not matched)'].concat(this.fields);
      const rows = STD.map((std) => {
        const sel = el('select', { style: { width: '180px' } }, cols.map((c) => el('option', { text: c, selected: this.matchMap[std] === c ? 'selected' : undefined })));
        // auto-match by squashed name
        if (!this.matchMap[std]) { const guess = this.fields.find((f) => f.toLowerCase().replace(/[^a-z]/g, '') === std.toLowerCase().replace(/[^a-z]/g, '')); if (guess) sel.value = guess; }
        sel.addEventListener('change', () => { this.matchMap[std] = sel.value; });
        return el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [el('label', { text: std, style: { width: '140px' } }), sel]);
      });
      WC.dialog({ title: 'Match Fields', width: '420px', body: el('div', { style: { maxHeight: '320px', overflow: 'auto' } }, [el('div', { style: { fontSize: '12px', color: '#666', marginBottom: '6px' }, text: 'Match the address fields Word uses with your recipient list columns.' })].concat(rows)), footer: [
        { label: 'OK', primary: true, onClick: () => { STD.forEach((std, i) => { const sel = rows[i].querySelector('select'); this.matchMap[std] = sel.value; }); WC.toast('Field matches saved.'); } },
        { label: 'Cancel' },
      ] });
    },
    updateLabels() {
      // Propagate the first label cell's merge fields to every other cell, with a
      // «Next Record» field at the start of each subsequent cell (Word behavior).
      // Only ever touch a real labels table — never fall back to the first table,
      // which would clobber an ordinary user table.
      const table = E().node.querySelector('table.wc-labels');
      if (!table) { WC.toast('No label sheet found. Create one first (Mailings → Labels → New Document).'); return; }
      const cells = Array.from(table.querySelectorAll('td'));
      if (cells.length < 2) { WC.toast('Need a label grid to update.'); return; }
      const first = cells[0].innerHTML;
      cells.forEach((td, i) => { td.innerHTML = (i === 0 ? '' : '<span class="wc-mergefield" data-field="__NextRecord__">«Next Record»</span> ') + first; });
      E().dirty = true; E().repaginate();
      WC.toast('Updated all ' + cells.length + ' labels from the first.');
    },
  };
  function blank(fields) { const o = {}; fields.forEach((f) => o[f] = ''); return o; }
  // RFC-4180-aware CSV/TSV parser: handles quoted fields with embedded
  // delimiters, quotes ("" escape), and newlines. Returns an array of rows.
  function parseCSV(text) {
    const delim = (text.indexOf('\t') >= 0 && text.indexOf(',') < 0) ? '\t' : ',';
    const rows = []; let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') { inQ = true; }
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }
  Mail._parseCSV = parseCSV; // exposed for tests
  WC.Mail = Mail;
})();
