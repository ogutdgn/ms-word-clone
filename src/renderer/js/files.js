/* files.js — document lifecycle + IO through the secure wordAPI bridge. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const E = () => WC.Editor;

  const Files = {
    path: null, name: 'Document1', format: 'docx',

    init() { this.updateTitle(); },

    sanitize(html) {
      if (window.DOMPurify) {
        return window.DOMPurify.sanitize(html, {
          ALLOWED_ATTR: ['style', 'href', 'src', 'alt', 'class', 'colspan', 'rowspan', 'width', 'height', 'title', 'align', 'data-comment'],
          ADD_TAGS: ['u'], ALLOW_DATA_ATTR: true,
          FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta'],
        });
      }
      return html;
    },

    async confirmDiscard() {
      if (!E().dirty) return true;
      return new Promise((resolve) => {
        const dlg = WC.dialog({
          title: 'Microsoft Word', width: '420px',
          body: WC.el('div', { text: `Do you want to save changes to ${this.name}?`, style: { padding: '8px 0' } }),
          footer: [
            // Only proceed if the save actually succeeded; on failure keep the
            // dialog open (save() shows its own error toast) so edits aren't lost.
            { label: 'Save', primary: true, onClick: () => {
                this.save().then((r) => { if (r && r.ok) { dlg.close(); resolve(true); } });
                return true; // keep open until save resolves
              } },
            { label: "Don't Save", onClick: () => resolve(true) },
            { label: 'Cancel', onClick: () => resolve(false) },
          ],
          onClose: () => resolve(false),
        });
      });
    },

    async newDoc() {
      if (!(await this.confirmDiscard())) return;
      E().setHTML('<p><br></p>');
      this.path = null; this.name = 'Document' + (Math.floor(Math.random() * 8) + 1); this.format = 'docx';
      E().dirty = false; this.updateTitle();
      WC.Backstage.close();
    },
    // Open generated content (mail-merge results, labels, etc.) as a fresh document
    // instead of overwriting the user's current one. Returns false if cancelled.
    async newDocWith(html, baseName) {
      if (!(await this.confirmDiscard())) return false;
      this.path = null; this.name = (baseName || 'Document') + (Math.floor(Math.random() * 8) + 1); this.format = 'docx';
      E().setHTML(html || '<p><br></p>');
      E().dirty = true; this.updateTitle();
      WC.Backstage.close();
      return true;
    },

    async open(presetPath) {
      if (!presetPath && !(await this.confirmDiscard())) return;
      const r = await window.wordAPI.open(presetPath);
      if (!r || !r.ok) { if (r && r.error) WC.toast('Could not open file', r.error); return; }
      E().setHTML(this.sanitize(r.html || '<p><br></p>'));
      this.path = r.path; this.name = r.name || 'Document'; this.format = r.format || 'docx';
      E().dirty = false; this.updateTitle();
      WC.Backstage.close();
      if (r.messages && r.messages.length) WC.toast(`Opened ${this.name}`, `${r.messages.length} import note(s) — .docx import is semantic (mammoth) and may simplify complex formatting.`);
      else WC.toast(`Opened ${this.name}`);
    },

    async save() {
      if (!this.path) return this.saveAs();
      const r = await window.wordAPI.save({ filePath: this.path, html: E().getHTML(), format: this.format });
      if (r && r.ok) { E().dirty = false; this.updateTitle(); WC.toast('Saved ' + r.name); }
      else WC.toast('Save failed', r && r.error);
      return r;
    },

    async saveAs() {
      const r = await window.wordAPI.saveAs({ html: E().getHTML(), suggestedName: (this.name || 'Document1').replace(/\.[^.]+$/, '') + '.docx' });
      if (r && r.ok) { this.path = r.path; this.name = r.name; this.format = r.format; E().dirty = false; this.updateTitle(); WC.toast('Saved ' + r.name); }
      else if (r && r.error) WC.toast('Save failed', r.error);
      return r;
    },

    async exportPdf() {
      const r = await window.wordAPI.exportPdf({ suggestedName: this.name });
      if (r && r.ok) WC.toast('Exported PDF', r.path);
      else if (r && r.error) WC.toast('PDF export failed', r.error);
    },

    async print() {
      const r = await window.wordAPI.print();
      if (r && !r.ok && r.error) WC.toast('Print canceled or failed', String(r.error));
    },

    updateTitle() {
      const dirty = E().dirty ? '• ' : '';
      const t = `${dirty}${this.name.replace(/\.[^.]+$/, '')} - Word`;
      const node = document.querySelector('.title-center');
      if (node) node.textContent = t;
      document.title = t;
    },
  };

  WC.Files = Files;
})();
