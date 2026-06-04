/* home-features.js — Office Clipboard history + Dictate (speech-to-text). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const E = () => WC.Editor;

  // ===================== Office Clipboard =====================
  const Clipboard = {
    items: [], MAX: 24, onChange: null,
    capture() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !E().node.contains(sel.anchorNode)) return;
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
      E().focus(); E().restoreRange();
      if (item.kind === 'image' || /</.test(item.html)) E().insertHTML(item.html);
      else E().insertHTML(WC.escapeHtml(item.text).replace(/\n/g, '<br>'));
    },
    pasteAll() { this.items.slice().reverse().forEach((it) => this.paste(it)); },
    clear() { this.items.length = 0; if (this.onChange) this.onChange(); },
    remove(i) { this.items.splice(i, 1); if (this.onChange) this.onChange(); },
  };
  WC.Clipboard = Clipboard;

  // ===================== Dictate (speech-to-text) =====================
  const Dictate = {
    _SR: null, rec: null, active: false, bar: null,
    state: { lang: 'en-US', autoPunct: true },
    LANGS: [['English (US)', 'en-US'], ['English (UK)', 'en-GB'], ['Français', 'fr-FR'], ['Deutsch', 'de-DE'], ['Español', 'es-ES'], ['Italiano', 'it-IT'], ['Português (BR)', 'pt-BR'], ['Türkçe', 'tr-TR'], ['日本語', 'ja-JP'], ['中文', 'zh-CN']],

    toggle(node) {
      if (this.active) { this.stop(); return; }
      this.start(node);
    },
    start(node) {
      const SR = this._SR || window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { WC.toast('Dictate requires the Web Speech API, which is unavailable in this build.', 'See docs/NOT_IMPLEMENTED.md'); return; }
      E().saveRange();
      let rec;
      try { rec = new SR(); } catch (e) { WC.toast('Dictation could not start: ' + e.message); return; }
      this.rec = rec;
      rec.lang = this.state.lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) this.insertFinal(this.format(res[0].transcript));
          else interim += res[0].transcript;
        }
        this.updateBar(interim);
      };
      rec.onerror = (e) => {
        const m = { 'not-allowed': 'Microphone access was blocked.', 'service-not-allowed': 'Microphone access was blocked.', 'network': 'Dictation needs an internet connection (the speech service is online).', 'no-speech': null, 'audio-capture': 'No microphone was found.' };
        if (e.error === 'no-speech') return;
        WC.toast('Dictation: ' + (m[e.error] || e.error));
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'network' || e.error === 'audio-capture') this.stop();
      };
      rec.onend = () => { if (this.active) { try { rec.start(); } catch (e) { this.teardown(); } } else this.teardown(); };
      try { rec.start(); } catch (e) { WC.toast('Dictation could not start: ' + e.message); return; }
      this.active = true; this.btn = node || (WC.Ribbon.controlIndex.dictate && WC.Ribbon.controlIndex.dictate.node);
      if (this.btn) this.btn.classList.add('toggled');
      this.showBar();
    },
    stop() { this.active = false; if (this.rec) { try { this.rec.stop(); } catch (e) {} } this.teardown(); },
    teardown() { this.active = false; if (this.btn) this.btn.classList.remove('toggled'); this.hideBar(); this.rec = null; },
    insertFinal(text) { E().node.focus(); E().restoreRange(); if (text === '\n') E().insertHTML('<br>'); else E().insertHTML(WC.escapeHtml(text) + ' '); },
    format(raw) {
      let t = raw.trim();
      if (this.state.autoPunct) {
        t = t.replace(/\b(period|full stop)\b/gi, '.').replace(/\bcomma\b/gi, ',').replace(/\bquestion mark\b/gi, '?')
          .replace(/\bexclamation (point|mark)\b/gi, '!').replace(/\b(semicolon)\b/gi, ';').replace(/\bcolon\b/gi, ':')
          .replace(/\bnew line\b/gi, '\n').replace(/\bnew paragraph\b/gi, '\n').replace(/\s+([.,?!;:])/g, '$1');
      }
      return t === '\n' ? '\n' : t;
    },
    showBar() {
      if (this.bar) this.bar.remove();
      this.bar = WC.el('div', { class: 'dictate-bar' }, [
        WC.el('span', { class: 'dot' }),
        WC.el('span', { class: 'dtext', text: 'Listening…' }),
        WC.el('span', { class: 'lang', text: this.state.lang, onclick: (e) => this.langMenu(e.currentTarget) }),
        WC.el('span', { class: 'stop', html: WC.icon('win_close', 10), title: 'Stop dictation', onclick: () => this.stop() }),
      ]);
      document.body.appendChild(this.bar);
    },
    updateBar(interim) { if (this.bar) this.bar.querySelector('.dtext').textContent = interim ? interim : 'Listening…'; },
    hideBar() { if (this.bar) { this.bar.remove(); this.bar = null; } },
    langMenu(anchor) {
      WC.flyout(anchor, (fly) => {
        fly.appendChild(WC.flyHeader('Spoken Language'));
        this.LANGS.forEach(([label, code]) => fly.appendChild(WC.flyItem(label + (code === this.state.lang ? '  ✓' : ''), { onClick: () => { this.state.lang = code; if (this.rec) this.rec.lang = code; if (this.bar) this.bar.querySelector('.lang').textContent = code; } })));
      });
    },
    menu(node) {
      WC.flyout(node, (fly) => {
        fly.appendChild(WC.flyItem(this.active ? 'Stop Dictation' : 'Start Dictation', { onClick: () => this.toggle(node) }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyHeader('Spoken Language'));
        this.LANGS.forEach(([label, code]) => fly.appendChild(WC.flyItem(label + (code === this.state.lang ? '  ✓' : ''), { onClick: () => { this.state.lang = code; if (this.rec) this.rec.lang = code; } })));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Auto-punctuation: ' + (this.state.autoPunct ? 'On' : 'Off'), { onClick: () => { this.state.autoPunct = !this.state.autoPunct; } }));
      });
    },
  };
  WC.Dictate = Dictate;

  // ===================== Sensitivity label =====================
  WC.sensitivity = null;
  WC.setSensitivity = function (label, color) {
    WC.sensitivity = label;
    // persist via a hidden marker at the top of the document so it round-trips
    let marker = E().node.querySelector('.wc-sensitivity');
    if (label) {
      if (!marker) { marker = WC.el('p', { class: 'wc-sensitivity', hidden: 'hidden' }); E().node.insertBefore(marker, E().node.firstChild); }
      marker.dataset.label = label; marker.dataset.color = color || '#605E5C';
    } else if (marker) { marker.remove(); }
    renderSensitivityBar();
    if (WC.StatusBar && WC.StatusBar.setSensitivity) WC.StatusBar.setSensitivity(label);
    E().dirty = true;
    if (label) WC.toast('Sensitivity set to “' + label + '”.');
  };
  function renderSensitivityBar() {
    let bar = document.getElementById('sensitivity-bar');
    const marker = E().node.querySelector('.wc-sensitivity');
    const label = marker && marker.dataset.label;
    if (!label) { if (bar) bar.remove(); return; }
    if (!bar) { bar = WC.el('div', { id: 'sensitivity-bar' }); document.getElementById('workarea').insertBefore(bar, document.getElementById('workarea').firstChild); }
    bar.innerHTML = '';
    bar.appendChild(WC.el('span', { class: 'sw', style: { background: marker.dataset.color || '#605E5C' } }));
    bar.appendChild(WC.el('span', { class: 'lbl', text: 'Sensitivity: ' + label }));
    bar.appendChild(WC.el('span', { class: 'note', text: 'This label classifies the document (visual approximation).' }));
  }
  // Re-sync the bar when a document is loaded (marker may already be present).
  WC.refreshSensitivity = function () {
    const marker = E().node && E().node.querySelector('.wc-sensitivity');
    WC.sensitivity = marker ? marker.dataset.label : null;
    renderSensitivityBar();
    if (WC.StatusBar && WC.StatusBar.setSensitivity) WC.StatusBar.setSensitivity(WC.sensitivity);
  };
})();
