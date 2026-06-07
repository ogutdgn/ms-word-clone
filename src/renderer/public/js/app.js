/* app.js — bootstrap: build title bar, wire window controls + keyboard
   shortcuts, initialise all modules. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;

  // D6 (spec §6.C): doc-touching shortcuts of UNFLIPPED areas block+toast in PM
  // mode, exactly like their ribbon commands. App-level shortcuts pass through.
  const pmBlockedOr = (area, fn) => () => {
    if (WC.PM && WC.PM.active && !WC.PM.isFlipped(area)) { WC.PM.notifyBlocked('Keyboard shortcut'); return; }
    fn();
  };

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
    qat.appendChild(qbtn('undo', 'Undo (Ctrl+Z)', () => (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM.cmd('undo') : E().exec('undo')));
    qat.appendChild(qbtn('redo', 'Redo (Ctrl+Y)', () => (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM.cmd('redo') : E().exec('redo')));
    qat.appendChild(qbtn('chevron_down', 'Customize Quick Access Toolbar', () => WC.toast('Customize Quick Access Toolbar is a UI placeholder.')));
    tb.appendChild(qat);

    // centered title
    tb.appendChild(el('div', { class: 'title-center', text: 'Document1 - Word' }));

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
      if (!mod) return;
      const shift = e.shiftKey;
      const map = () => {
        if (k === 'z' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('undo') : E().undo(); };
        if ((k === 'z' && shift) || (k === 'y' && !shift)) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('redo') : E().redo(); };
        if (k === 's' && !shift) return () => WC.Files.save();
        if ((k === 's' && shift) || e.key === 'F12') return () => WC.Files.saveAs();
        if (k === 'enter' && !shift) return pmBlockedOr('insert-basics', () => WC.Commands.run({ cmd: 'pageBreak', label: 'Page Break' }));
        if (k === 'o') return () => WC.Files.open();
        if (k === 'n' && !shift) return () => WC.Files.newDoc(); // !shift: don't shadow Ctrl+Shift+N (Apply Normal, below)
        if (k === 'p') return () => WC.Files.print();
        if (k === 'f') return () => WC.Dialogs.findPane(false);
        if (k === 'h') return () => WC.Dialogs.findPane(true);
        if (k === 'k') return () => WC.Dialogs.insertLink();
        if (k === '=' && !shift) return () => E().zoomIn();
        if (k === '-') return () => E().zoomOut();
        if (k === '0') return () => E().zoomReset();
        if (k === 'l' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'left') : E().exec('justifyLeft'); };
        if (k === 'e' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'center') : E().exec('justifyCenter'); };
        if (k === 'r' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'right') : E().exec('justifyRight'); };
        if (k === 'j' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'justify') : E().exec('justifyFull'); };
        if (k === 'l' && shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('toggleBulletList') : E().exec('insertUnorderedList'); };
        if (k === 'd' && !shift) return pmBlockedOr('character', () => WC.Dialogs.font());
        if (shift && (k === '.' || k === '>')) return pmBlockedOr('character', () => WC.Commands && incFont(1));
        if (shift && (k === ',' || k === '<')) return pmBlockedOr('character', () => incFont(-1));
        if (k === ']') return pmBlockedOr('character', () => incFont(1));
        if (k === '[') return pmBlockedOr('character', () => incFont(-1));
        if (shift && k === 'n') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Normal') : WC.applyNamedStyle('Normal'); };
        if (e.altKey && k === '1') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Heading1') : WC.applyNamedStyle('Heading 1'); };
        if (e.altKey && k === '2') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Heading2') : WC.applyNamedStyle('Heading 2'); };
        if (e.altKey && k === '3') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Heading3') : WC.applyNamedStyle('Heading 3'); };
        return null;
      };
      // PM keymaps own the history keys when focus is in the view — stand down
      // (the fork handles Mod-Z/Y itself; firing our handler too would double-undo).
      if (WC.PM && WC.PM.active && window.WC.view && window.WC.view.dom.contains(document.activeElement)
          && mod && ['z', 'y'].includes(k)) return;
      const action = map();
      if (action) { e.preventDefault(); action(); }
    });
  }
  function incFont(dir) {
    const cmd = dir > 0 ? 'increaseFontSize' : 'decreaseFontSize';
    WC.Commands.run({ cmd, label: cmd });
  }

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
        'view.zoomIn': () => E().zoomIn(), 'view.zoomOut': () => E().zoomOut(), 'view.zoomReset': () => E().zoomReset(),
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
    WC.Editor.init();
    WC.StatusBar.init();
    WC.Ribbon.init();
    WC.Backstage.init();
    WC.Files.init();
    if (WC.Layout && WC.Layout.initSelection) WC.Layout.initSelection();
    if (WC.Review && WC.Review.init) WC.Review.init();
    bindKeys();
    bindMisc();
    if (!(WC.PM && WC.PM.active)) WC.Editor.focus(); // PM mode: bridge focuses the PM view post-mount
    // initial state sync
    WC.Editor.emit();
    console.log('WORD_CLONE_READY tabs=' + WC.RIBBON.length);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
