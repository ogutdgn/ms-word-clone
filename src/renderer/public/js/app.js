/* app.js — bootstrap: build title bar, wire window controls + keyboard
   shortcuts, initialise all modules. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;

  function buildTitleBar() {
    const tb = document.getElementById('titlebar');

    // QAT
    const qat = el('div', { class: 'qat' });
    const autosave = el('div', { class: 'autosave', title: 'AutoSave (visual only in this clone)' }, [el('span', { class: 'toggle' }), el('span', { text: 'AutoSave' })]);
    autosave.addEventListener('click', () => { autosave.classList.toggle('on'); });
    const qbtn = (icon, title, onClick) => { const b = el('div', { class: 'qat-btn', html: WC.icon(icon, 16), title }); b.addEventListener('click', onClick); WC.attachTip(b, title); return b; };
    qat.appendChild(autosave);
    qat.appendChild(el('span', { class: 'qat-sep' }));
    qat.appendChild(qbtn('save', 'Save (Ctrl+S)', () => WC.Files.save()));
    qat.appendChild(qbtn('undo', 'Undo (Ctrl+Z)', () => { if (WC.PM.ready) WC.PM.cmd('undo'); }));
    qat.appendChild(qbtn('redo', 'Redo (Ctrl+Y)', () => { if (WC.PM.ready) WC.PM.cmd('redo'); }));
    qat.appendChild(qbtn('chevron_down', 'Customize Quick Access Toolbar', () => WC.toast('Customize Quick Access Toolbar is a UI placeholder.')));
    tb.appendChild(qat);

    // centered title
    tb.appendChild(el('div', { class: 'title-center', text: 'Document1 - Word' }));

    // D8.8 chrome mode pill: Editing | Reviewing | Viewing; Reviewing rides the SAME
    // trackChanges dispatch as the ribbon (lock-respecting), state-sync keeps the
    // label honest (T1).
    const pill = el('div', { class: 'mode-pill', id: 'wc-mode-pill', title: 'Editing mode' });
    pill.appendChild(el('span', { class: 'mode-pill-label', text: 'Editing' }));
    pill.appendChild(el('span', { class: 'mode-pill-caret', html: WC.icon('chevron_down', 8) }));
    pill.addEventListener('click', () => {
      const pm = WC.PM.ready ? WC.PM : null;
      if (!pm) return;
      WC.flyout(pill, (fly) => {
        const cur = pill.querySelector('.mode-pill-label').textContent;
        const item = (label, fn) => fly.appendChild(WC.flyItem((cur === label ? '✓ ' : '   ') + label, { onClick: fn }));
        item('Editing', () => { try { pm.getEditor().setEditable(true, false); } catch (e) { /* engine unavailable */ } if (pm.reviewState().tracking) WC.Commands.run({ cmd: 'trackChanges', label: 'Track Changes' }); });
        item('Reviewing', () => { try { pm.getEditor().setEditable(true, false); } catch (e) { /* engine unavailable */ } if (!pm.reviewState().tracking) WC.Commands.run({ cmd: 'trackChanges', label: 'Track Changes' }); });
        item('Viewing', () => { try { pm.getEditor().setEditable(false, false); } catch (e) { /* engine unavailable */ } });
      });
    });
    tb.appendChild(pill);

    // window controls
    const right = el('div', { class: 'titlebar-right' });
    const wc = el('div', { class: 'window-controls' });
    const min = el('div', { class: 'wc-btn', html: WC.rawIcon('win_min', 10), title: 'Minimize' });
    const max = el('div', { class: 'wc-btn', html: WC.rawIcon('win_max', 10), title: 'Maximize' });
    const close = el('div', { class: 'wc-btn close', html: WC.rawIcon('win_close', 10), title: 'Close' });
    min.addEventListener('click', () => window.wordAPI.window.minimize());
    max.addEventListener('click', () => window.wordAPI.window.toggleMaximize());
    close.addEventListener('click', async () => { if (await WC.Files.confirmDiscard()) window.wordAPI.window.close(); });
    wc.appendChild(min); wc.appendChild(max); wc.appendChild(close);
    right.appendChild(wc);
    tb.appendChild(right);

    window.wordAPI.window.onStateChange((s) => {
      max.innerHTML = WC.rawIcon(s.maximized ? 'win_restore' : 'win_max', 10);
      max.title = s.maximized ? 'Restore' : 'Maximize';
    });
  }

  // keyboard shortcuts (renderer is the single source of truth)
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        WC.closeFlyouts();
        if (document.getElementById('read-mode')) { WC.closeReadMode && WC.closeReadMode(); return; }
        const app = document.getElementById('app');
        if (app.classList.contains('focus-mode')) { app.classList.remove('focus-mode'); return; }
        if (!document.getElementById('backstage').hidden) WC.Backstage.close();
        return;
      }
      // Shift+F3 — Word's Change Case keyboard cycle (no Ctrl): lowercase → UPPERCASE →
      // Capitalize Each Word, advancing from the selection's current case (stateless).
      if (e.key === 'F3' && e.shiftKey && !mod && !e.altKey) { e.preventDefault(); WC.shiftF3Cycle && WC.shiftF3Cycle(); return; }
      if (!mod) return;
      const shift = e.shiftKey;
      const applyStyleChord = (name) => () => { if (WC.PM.ready && !WC.PM.applyStyleByName(name)) WC.toast('Style “' + name + '” is not available in this document.'); };
      const map = () => {
        if (k === 'z' && !shift) return () => { if (WC.PM.ready) WC.PM.cmd('undo'); };
        if ((k === 'z' && shift) || (k === 'y' && !shift)) return () => { if (WC.PM.ready) WC.PM.cmd('redo'); };
        if (k === 's' && !shift) return () => WC.Files.save();
        if ((k === 's' && shift) || e.key === 'F12') return () => WC.Files.saveAs();
        if (k === 'enter' && !shift) return () => WC.Commands.run({ cmd: 'pageBreak', label: 'Page Break' });
        if (k === 'o') return () => WC.Files.open();
        if (k === 'n' && !shift) return () => WC.Files.newDoc(); // !shift: don't shadow Ctrl+Shift+N (Apply Normal, below)
        if (k === 'p') return () => WC.Files.print();
        if (k === 'f') return () => WC.Dialogs.findPane(false);
        if (k === 'h') return () => WC.Dialogs.findPane(true);
        if (k === 'k') return () => WC.Dialogs.insertLink();
        if (k === '=' && !shift) return () => WC.PM.zoomIn();
        if (k === '-') return () => WC.PM.zoomOut();
        if (k === '0') return () => WC.PM.zoomReset();
        if (k === 'l' && !shift) return () => { if (WC.PM.ready) WC.PM.cmd('setTextAlign', 'left'); };
        if (k === 'e' && !shift) return () => { if (WC.PM.ready) WC.PM.cmd('setTextAlign', 'center'); };
        // review chords (Word: Ctrl+Shift+E = Track Changes, Ctrl+Alt+M = New Comment,
        // Ctrl+Alt+Space = Read Aloud).
        if (k === 'e' && shift) return () => WC.Commands.run({ cmd: 'trackChanges', label: 'Track Changes' });
        if (e.altKey && k === 'm') return () => WC.Commands.run({ cmd: 'newComment', label: 'New Comment' });
        if (e.altKey && k === ' ') return () => WC.Commands.run({ cmd: 'readAloud', label: 'Read Aloud' });
        if (k === 'r' && !shift) return () => { if (WC.PM.ready) WC.PM.cmd('setTextAlign', 'right'); };
        if (k === 'j' && !shift) return () => { if (WC.PM.ready) WC.PM.cmd('setTextAlign', 'justify'); };
        if (k === 'l' && shift) return () => { if (WC.PM.ready) WC.PM.cmd('toggleBulletList'); };
        if (k === 'd' && !shift) return () => WC.Dialogs.font();
        if (shift && (k === '.' || k === '>')) return () => incFont(1);
        if (shift && (k === ',' || k === '<')) return () => incFont(-1);
        if (k === ']') return () => incFont(1);
        if (k === '[') return () => incFont(-1);
        // Styles chords route through applyStyleByName so a catalog-missing style
        // toasts exactly like the gallery/pane paths (foreign-doc edge; final-review).
        if (shift && k === 'n') return applyStyleChord('Normal');
        if (e.altKey && k === '1') return applyStyleChord('Heading 1');
        if (e.altKey && k === '2') return applyStyleChord('Heading 2');
        if (e.altKey && k === '3') return applyStyleChord('Heading 3');
        // copy/paste formatting chords (Word: Cmd+Shift+C / Cmd+Shift+V — oracle B5).
        if (shift && k === 'c') return WC.PM.ready ? () => WC.PM.armFormatPainter(false) : null;
        if (shift && k === 'v') return WC.PM.ready ? () => WC.PM.cmd('applyStoredFormat') : null;
        return null;
      };
      // PM keymaps own the history keys when focus is in the view — stand down
      // (the fork handles Mod-Z/Y itself; firing our handler too would double-undo).
      if (window.WC.view && window.WC.view.dom.contains(document.activeElement)
          && mod && ['z', 'y'].includes(k)) return;
      const action = map();
      if (action) { e.preventDefault(); action(); }
    });
  }
  function incFont(dir) {
    const cmd = dir > 0 ? 'increaseFontSize' : 'decreaseFontSize';
    WC.Commands.run({ cmd, label: cmd });
  }
  // Shift+F3 case cycle. Reads the selection's text and advances: all-lowercase → UPPERCASE;
  // all-uppercase → Capitalize Each Word; anything else (mixed/capitalized) → lowercase. Requires
  // a non-empty selection (v1; Word also cycles the caret's word). Exposed for the keybinding + tests.
  WC.shiftF3Cycle = function () {
    if (!(WC.PM && WC.PM.ready) || !WC.view) return false;
    const st = WC.view.state; const { from, to, empty } = st.selection;
    if (empty) return false;
    const txt = st.doc.textBetween(from, to, ' ', ' ');
    if (!txt) return false;
    const isLower = txt === txt.toLowerCase() && txt !== txt.toUpperCase();
    const isUpper = txt === txt.toUpperCase() && txt !== txt.toLowerCase();
    const mode = isLower ? 'upper' : isUpper ? 'titlecase' : 'lower';
    WC.PM.changeCase(mode);
    return mode;
  };

  function bindMisc() {
    // keep title in sync with dirty state
    const origUpdate = WC.StatusBar.update.bind(WC.StatusBar);
    WC.StatusBar.update = function () { origUpdate(); WC.Files.updateTitle(); };
    // menu accelerators (if any) from main
    if (window.wordAPI.onMenuAction) window.wordAPI.onMenuAction((action) => {
      const m = {
        'file.new': () => WC.Files.newDoc(), 'file.open': () => WC.Files.open(), 'file.save': () => WC.Files.save(),
        'file.saveAs': () => WC.Files.saveAs(), 'file.print': () => WC.Files.print(),
        'edit.find': () => WC.Dialogs.findPane(false), 'edit.replace': () => WC.Dialogs.findPane(true),
        'view.zoomIn': () => WC.PM.zoomIn(), 'view.zoomOut': () => WC.PM.zoomOut(), 'view.zoomReset': () => WC.PM.zoomReset(),
      };
      if (m[action]) m[action]();
    });
  }

  function buildRuler() {
    const inner = document.querySelector('#ruler .ruler-inner');
    if (!inner) return;
    const pageW = 816, margin = 96;
    // margin shading
    inner.appendChild(el('div', { class: 'ruler-margin', style: { left: '0', width: margin + 'px' } }));
    inner.appendChild(el('div', { class: 'ruler-margin', style: { right: '0', width: margin + 'px' } }));
    const usable = pageW - margin * 2;
    const inches = usable / 96;
    for (let i = 0; i <= Math.ceil(inches); i++) {
      const x = margin + i * 96;
      if (x > pageW) break;
      inner.appendChild(el('div', { class: 'ruler-num', text: String(i), style: { left: x + 'px' } }));
      // minor ticks at 1/8" within text area
      for (let j = 1; j < 8; j++) {
        const mx = x + j * 12;
        if (mx >= pageW - margin) break;
        inner.appendChild(el('div', { class: 'ruler-tick', style: { left: mx + 'px', height: (j === 4 ? 6 : 3) + 'px' } }));
      }
    }
  }

  function boot() {
    buildTitleBar();
    buildRuler();
    WC.StatusBar.init();
    WC.Ribbon.init();
    WC.Backstage.init();
    WC.Files.init();
    bindKeys();
    bindMisc();
    // WC.Editor retired (slice 11): PM is the only editor — the bridge focuses the
    // PM view post-mount and the fork engine drives state sync.
    console.log('WORD_CLONE_READY tabs=' + WC.RIBBON.length);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
