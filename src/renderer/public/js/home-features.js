/* home-features.js — Office Clipboard history store. Dictate (speech-to-text)
   and the sensitivity-label engine were retired in slice 11 — their ribbon
   handlers are toasts now; WC.setSensitivity is kept as a toast stub only
   because commands.js still wires the sensitivity menu to it. The Office
   Clipboard store is kept whole (the clipboard task pane in dialogs.js reads
   it, and the [11] survival guard checks WC.Clipboard.items + .pasteAll). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  // PM bridge accessor — clipboard paste routes through the engine (the legacy
  // WC.Editor was retired). Returns the active+ready PM bridge or null.
  const pm = () => (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null;

  // ===================== Office Clipboard =====================
  const Clipboard = {
    items: [], MAX: 24, onChange: null,
    capture() {
      // Read the live selection directly (the legacy WC.Editor.node containment
      // check was dropped with WC.Editor); only collect a non-empty selection.
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      const div = document.createElement('div');
      div.appendChild(r.cloneContents());
      const html = div.innerHTML.replace(/​/g, '');
      const text = sel.toString();
      if (!text.trim() && !div.querySelector('img')) return;
      const kind = (!text.trim() && div.querySelector('img')) ? 'image' : 'text';
      if (this.items[0] && this.items[0].html === html) return; // dedup
      this.items.unshift({ html, text, kind, ts: Date.now() });
      if (this.items.length > this.MAX) this.items.length = this.MAX;
      if (this.onChange) this.onChange();
    },
    paste(item) {
      if (!item) return;
      const p = pm();
      if (!p || typeof p.pasteHTMLString !== 'function') return; // legacy WC.Editor retired
      const html = (item.kind === 'image' || /</.test(item.html)) ? item.html : WC.escapeHtml(item.text).replace(/\n/g, '<br>');
      p.pasteHTMLString(html);
    },
    pasteAll() { this.items.slice().reverse().forEach((it) => this.paste(it)); },
    clear() { this.items.length = 0; if (this.onChange) this.onChange(); },
    remove(i) { this.items.splice(i, 1); if (this.onChange) this.onChange(); },
  };
  WC.Clipboard = Clipboard;

  // ===================== Sensitivity label (retired) =====================
  // The legacy sensitivity-marker engine (a hidden in-document <p> on the retired
  // WC.Editor + the workarea bar) is gone. commands.js still wires the sensitivity
  // menu to WC.setSensitivity, so keep it as a status-bar-only toast stub.
  WC.sensitivity = null;
  WC.setSensitivity = function (label) {
    WC.sensitivity = label;
    if (WC.StatusBar && WC.StatusBar.setSensitivity) WC.StatusBar.setSensitivity(label);
    if (label) WC.toast('Sensitivity set to “' + label + '”.');
    else WC.toast('Sensitivity label removed.');
  };
})();
