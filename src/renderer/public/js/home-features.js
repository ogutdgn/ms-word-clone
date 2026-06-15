/* home-features.js — Office Clipboard history store. Dictate (speech-to-text)
   and the sensitivity-label engine were retired in slice 11 — their ribbon
   handlers are toasts now; WC.setSensitivity is kept as a toast stub only
   because commands.js still wires the sensitivity menu to it. The Office
   Clipboard store is kept whole (the clipboard task pane in dialogs.js reads
   it, and the [11] survival guard checks WC.Clipboard.items + .pasteAll). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;

  // Phase 3 ribbon state machine: register enablement/latch rules. ribbon.js
  // loads AFTER this file, so queue until WC.Ribbon exists — ribbon.js drains
  // WC._pendingStateRules on load and swaps this for a direct call.
  WC.registerRibbonRule = WC.registerRibbonRule || function (cmd, rule) {
    (WC._pendingStateRules = WC._pendingStateRules || []).push([cmd, rule]);
  };
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

  // Auto-capture every copy/cut into the Office Clipboard history (Word parity).
  // Catches keyboard Ctrl+C / Ctrl+X (prosemirror-view fires a DOM copy/cut event
  // on the editable); ribbon Cut/Copy are also captured in the PM bridge. The
  // 'cut' event fires before the default deletion, so the selection is still live.
  // capture() dedups identical consecutive content, so the overlap is harmless.
  document.addEventListener('copy', function () { try { Clipboard.capture(); } catch (e) { /* no selection */ } });
  document.addEventListener('cut', function () { try { Clipboard.capture(); } catch (e) { /* no selection */ } });

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

  // ===================== Clipboard ribbon state rules =====================
  // Word's Home → Clipboard enablement (validated live): Cut and Copy require a
  // non-empty selection; Paste requires pasteable clipboard content; Format
  // Painter shows a pressed latch while armed. Facts come from the bridge
  // state-sync (toQueryState: hasSelection / clipboardHasContent / painterArmed).
  WC.registerRibbonRule('cut', { enabled: (st) => !!st.hasSelection });
  WC.registerRibbonRule('copy', { enabled: (st) => !!st.hasSelection });
  WC.registerRibbonRule('paste', { enabled: (st) => !!st.clipboardHasContent });
  WC.registerRibbonRule('formatPainter', { latched: (st) => !!st.painterArmed });

  // ===================== Paragraph ribbon state rules =====================
  // Word: Decrease Indent greys at zero left indent unless in a list (can't go
  // below the margin); Show/Hide ¶ latches while formatting marks are visible.
  // (Alignment + list latches stay on the legacy TOGGLE_MAP path — they already
  // work; not double-registering here avoids two writers of the 'toggled' class.)
  WC.registerRibbonRule('decreaseIndent', { enabled: (st) => !!st.inList || (st.indentLeftIn || 0) > 0 });
  WC.registerRibbonRule('showHide', { latched: (st) => !!st.formattingMarks });
})();
