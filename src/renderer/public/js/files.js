/* files.js — document lifecycle + IO through the secure wordAPI bridge. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const E = () => WC.Editor;

  const Files = {
    path: null, name: 'Document1', format: 'docx',

    init() { this.updateTitle(); },

    // Phase 2 (spec §5.1 io.ts): single mode-aware dirty accessor. Writers:
    // legacy sets E().dirty; PM mode tracks engine 'update' events in the bridge.
    isDirty() { return (WC.PM && WC.PM.active) ? WC.PM.isDirty() : E().dirty; },
    setClean() { if (WC.PM && WC.PM.active) WC.PM.setClean(); else { E().dirty = false; } },

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
      if (!this.isDirty()) return true;
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
      if (WC.PM && WC.PM.active) {
        if (!(await WC.PM.newBlank())) { WC.toast('Could not create document'); return; }
      } else {
        E().setHTML('<p><br></p>'); E().dirty = false;
      }
      this.path = null; this.name = 'Document' + (Math.floor(Math.random() * 8) + 1); this.format = 'docx';
      this.updateTitle();
      WC.Backstage.close();
    },
    // Open generated content (mail-merge results, labels, etc.) as a fresh document
    // instead of overwriting the user's current one. Returns false if cancelled.
    async newDocWith(html, baseName) {
      if (WC.PM && WC.PM.active) {
        // Mail-merge/labels output is legacy-HTML shaped — its producers flip in slice 10.
        WC.PM.notifyBlocked('Generated documents (' + (baseName || 'document') + ')');
        return false;
      }
      if (!(await this.confirmDiscard())) return false;
      this.path = null; this.name = (baseName || 'Document') + (Math.floor(Math.random() * 8) + 1); this.format = 'docx';
      E().setHTML(html || '<p><br></p>');
      E().dirty = true; this.updateTitle();
      WC.Backstage.close();
      return true;
    },

    async open(presetPath) {
      if (WC.PM && WC.PM.active) {
        if (!(await this.confirmDiscard())) return;
        const r = await window.wordAPI.openBytes(presetPath);
        if (!r || !r.ok) { if (r && r.error) WC.toast('Could not open file', r.error); return; }
        if (!/\.docx$/i.test(r.path)) { WC.toast("Opening non-docx files isn't on the new engine yet", 'Use --legacy for html/txt/csv (returns in slice 7)'); return; }
        const ok = await WC.PM.openDocx(r.bytes);
        if (!ok) { WC.toast('Could not open file', 'The new engine failed to import it'); return; }
        // Invariant (spec §5.3): in PM mode `path` only ever points at a file the PM doc represents —
        // assigned ONLY after openDocx succeeded.
        this.path = r.path; this.name = r.name || 'Document'; this.format = 'docx';
        this.updateTitle(); WC.Backstage.close(); WC.toast('Opened ' + this.name);
        return;
      }
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
      if (WC.PM && WC.PM.active) {
        if (this.format && this.format !== 'docx') {
          WC.toast("Saving as " + this.format + " isn't on the new engine yet", 'Use --legacy for html/txt saves (returns in slice 7)');
          return { ok: false };
        }
        if (!this.path) return this.saveAs();
        try {
          const bytes = await WC.PM.exportDocxBytes();
          const r = await window.wordAPI.saveBytes({ filePath: this.path, bytes });
          if (r && r.ok) { this.setClean(); WC.toast('Saved ' + r.name); }
          else WC.toast('Save failed', r && r.error); // title dot intentionally stays — the doc IS still dirty
          return r;
        } catch (e) { const msg = (e && e.message) || String(e); WC.toast('Save failed', msg); return { ok: false, error: msg }; }
      }
      if (!this.path) return this.saveAs();
      const p = E().getSavePayload();
      const r = await window.wordAPI.save({ filePath: this.path, html: p.html, header: p.header, footer: p.footer, comments: p.comments, format: this.format });
      if (r && r.ok) { E().dirty = false; this.updateTitle(); WC.toast('Saved ' + r.name); }
      else WC.toast('Save failed', r && r.error);
      return r;
    },

    async saveAs() {
      if (WC.PM && WC.PM.active) {
        try {
          const bytes = await WC.PM.exportDocxBytes();
          const r = await window.wordAPI.saveAsBytes({ bytes, suggestedName: (this.name || 'Document1').replace(/\.[^.]+$/, '') + '.docx' });
          if (r && r.ok) { this.path = r.path; this.name = r.name; this.format = 'docx'; this.setClean(); WC.toast('Saved ' + r.name); }
          else if (r && r.error) WC.toast('Save failed', r.error);
          return r;
        } catch (e) { const msg = (e && e.message) || String(e); WC.toast('Save failed', msg); return { ok: false, error: msg }; }
      }
      const p = E().getSavePayload();
      const r = await window.wordAPI.saveAs({ html: p.html, header: p.header, footer: p.footer, comments: p.comments, suggestedName: (this.name || 'Document1').replace(/\.[^.]+$/, '') + '.docx' });
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
      const dirty = this.isDirty() ? '• ' : '';
      const t = `${dirty}${this.name.replace(/\.[^.]+$/, '')} - Word`;
      const node = document.querySelector('.title-center');
      if (node) node.textContent = t;
      document.title = t;
    },
  };

  WC.Files = Files;
})();
