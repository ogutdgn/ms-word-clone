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

    wrapHtml(body) {
      const title = WC.escapeHtml((this.name || 'Document').replace(/\.[^.]+$/, ''));
      return '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + title + '</title></head>\n<body>' + body + '</body></html>';
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
        const ext = (r.path.match(/\.([^.\\/]+)$/) || [, ''])[1].toLowerCase();
        let ok = false;
        if (ext === 'docx') ok = await WC.PM.openDocx(r.bytes);
        else if (ext === 'html' || ext === 'htm' || ext === 'txt' || ext === 'csv' || ext === 'tsv') {
          let text = new TextDecoder('utf-8').decode(r.bytes);
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          if (ext === 'html' || ext === 'htm') ok = await WC.PM.openHtml(text);
          else if (ext === 'txt') ok = await WC.PM.openText(text);
          else ok = await WC.PM.openCsv(text);
        } else {
          WC.toast('Unsupported file type on the new engine', ext ? 'Use --legacy for .' + ext + ' files' : "Files without an extension aren't supported");
          return;
        }
        if (!ok) {
          if (WC.PM.lastImportBlanked && WC.PM.lastImportBlanked()) {
            // The failed import replaced the doc with a fresh blank — the old binding no longer
            // represents what's on screen (spec §5.3): unbind so Ctrl+S can't blank the old file.
            this.path = null; this.name = 'Document1'; this.format = 'docx'; this.updateTitle();
          }
          WC.toast('Could not open file', 'The new engine failed to import it');
          return;
        }
        // Invariant (spec §5.3): `path` only re-points after a successful import — and only at a
        // file the PM doc can be saved back into. A csv imports as a TABLE (not re-writable as
        // csv), so it opens as an UNSAVED document: Save routes to Save As.
        if (ext === 'csv' || ext === 'tsv') {
          this.path = null; this.name = r.name || 'Document'; this.format = 'docx';
        } else {
          this.path = r.path; this.name = r.name || 'Document';
          this.format = ext === 'docx' ? 'docx' : (ext === 'txt' ? 'text' : 'html');
        }
        this.updateTitle(); WC.Backstage.close(); WC.toast('Opened ' + (r.name || this.name));
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
        if (!this.path) return this.saveAs();
        try {
          let r;
          if (this.format === 'html') {
            r = await window.wordAPI.saveTextFile({ filePath: this.path, content: this.wrapHtml(WC.PM.getHTML()) });
          } else if (this.format === 'text') {
            r = await window.wordAPI.saveTextFile({ filePath: this.path, content: WC.PM.getText() });
          } else {
            // format domain is gated to docx|html|text by open()/saveAs(); a future fourth value must NOT silently take this docx leg
            const bytes = await WC.PM.exportDocxBytes();
            r = await window.wordAPI.saveBytes({ filePath: this.path, bytes });
          }
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
          const stem = (this.name || 'Document1').replace(/\.[^.]+$/, '');
          const defExt = this.format === 'html' ? 'html' : this.format === 'text' ? 'txt' : 'docx';
          const pick = await window.wordAPI.askSavePath({ suggestedName: stem + '.' + defExt });
          if (pick && pick.error) WC.toast('Save As failed', pick.error);
          if (!pick || !pick.ok) return pick || { ok: false };
          let r, fmt;
          if (pick.ext === 'html' || pick.ext === 'htm') {
            fmt = 'html';
            r = await window.wordAPI.saveTextFile({ filePath: pick.filePath, content: this.wrapHtml(WC.PM.getHTML()) });
          } else if (pick.ext === 'txt') {
            fmt = 'text';
            r = await window.wordAPI.saveTextFile({ filePath: pick.filePath, content: WC.PM.getText() });
          } else if (pick.ext === 'docx') {
            fmt = 'docx';
            const bytes = await WC.PM.exportDocxBytes();
            r = await window.wordAPI.saveBytes({ filePath: pick.filePath, bytes });
          } else {
            // Never write docx zip bytes into an arbitrary typed extension (e.g. foo.csv).
            WC.toast('Unsupported save format', '.' + pick.ext + ' — choose Word Document, Web Page or Plain Text');
            return { ok: false };
          }
          // path/name/format mutate ONLY on a confirmed write (spec §5.3).
          if (r && r.ok) { this.path = r.path; this.name = r.name; this.format = fmt; this.setClean(); WC.toast('Saved ' + r.name); }
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
