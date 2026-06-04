/* util.js — DOM helpers, flyouts, color palettes, toasts, screentips, dialogs */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;

  // --- element builder ---
  function el(tag, props, children) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === 'class') e.className = props[k];
        else if (k === 'html') e.innerHTML = props[k];
        else if (k === 'text') e.textContent = props[k];
        else if (k === 'style' && typeof props[k] === 'object') Object.assign(e.style, props[k]);
        else if (k.startsWith('on') && typeof props[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), props[k]);
        else if (k === 'dataset') Object.assign(e.dataset, props[k]);
        else if (props[k] != null) e.setAttribute(k, props[k]);
      }
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }
  WC.el = el;

  WC.debounce = function (fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  };

  // Escape text for safe interpolation into innerHTML/insertHTML.
  WC.escapeHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  // Neutralise dangerous URL schemes (javascript:, data:, vbscript:) for hrefs.
  WC.safeUrl = function (url) {
    const u = String(url || '').trim();
    if (/^\s*(javascript|data|vbscript):/i.test(u)) return '#';
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || /^[/#]/.test(u)) return u; // has a scheme or is relative/anchor
    return 'https://' + u; // bare domain -> assume https
  };

  // --- overlay/flyout management ---
  let openFly = null;
  function closeFly() {
    if (openFly) { openFly.remove(); openFly = null; document.removeEventListener('mousedown', onDocDown, true); }
  }
  function onDocDown(e) {
    if (openFly && !openFly.contains(e.target) && !(e.target.closest && e.target.closest('[data-fly-anchor]'))) closeFly();
  }
  WC.closeFlyouts = closeFly;

  // open a flyout positioned under an anchor element
  WC.flyout = function (anchor, builder, opts) {
    closeFly();
    opts = opts || {};
    const fly = el('div', { class: 'flyout' });
    builder(fly, closeFly);
    document.body.appendChild(fly);
    const r = anchor.getBoundingClientRect();
    let left = opts.align === 'right' ? r.right - fly.offsetWidth : r.left;
    left = Math.max(4, Math.min(left, window.innerWidth - fly.offsetWidth - 4));
    let top = r.bottom + 2;
    if (top + fly.offsetHeight > window.innerHeight - 4) top = Math.max(4, r.top - fly.offsetHeight - 2);
    fly.style.left = left + 'px';
    fly.style.top = top + 'px';
    openFly = fly;
    setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
    return fly;
  };

  WC.flyItem = function (label, opts) {
    opts = opts || {};
    const item = el('div', { class: 'fly-item' });
    if (opts.icon !== undefined) item.appendChild(el('span', { class: 'fi-ic', html: WC.icon(opts.icon, 16) }));
    item.appendChild(el('span', { text: label, class: 'fi-label' }));
    if (opts.key) item.appendChild(el('span', { class: 'fi-key', text: opts.key }));
    if (opts.onClick) item.addEventListener('click', () => { WC.closeFlyouts(); opts.onClick(); });
    return item;
  };
  WC.flySep = () => el('div', { class: 'fly-sep' });
  WC.flyHeader = (t) => el('div', { class: 'fly-header', text: t });

  // --- color palette ---
  // Aptos theme colors (extracted from the user's real Word, build 16.0.19929)
  const THEME_COLORS = [
    '#FFFFFF', '#000000', '#E8E8E8', '#0E2841', '#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E',
  ];
  const THEME_TINTS = [
    ['#F2F2F2', '#7F7F7F', '#D0CECE', '#D6DCE5', '#D9E2F3', '#FBE5D6', '#EDEDED', '#FFF2CC', '#DEEAF7', '#E2EFDA'],
    ['#D9D9D9', '#595959', '#AEAAAA', '#ACB9CA', '#B4C7E7', '#F8CBAD', '#DBDBDB', '#FFE699', '#BDD7EE', '#C6E0B4'],
    ['#BFBFBF', '#404040', '#757070', '#8497B0', '#8FAADC', '#F4B183', '#C9C9C9', '#FFD966', '#9DC3E6', '#A9D18E'],
    ['#A6A6A6', '#262626', '#3B3838', '#333F50', '#2F5496', '#C55A11', '#ABABAB', '#BF9000', '#2E75B6', '#538135'],
    ['#808080', '#0D0D0D', '#161616', '#222B35', '#1F3864', '#833C00', '#7B7B7B', '#806000', '#1F4E79', '#375623'],
  ];
  const STANDARD = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];

  WC.colorPalette = function (onPick, opts) {
    opts = opts || {};
    const wrap = el('div', { class: 'color-palette' });
    if (opts.automatic !== false) {
      wrap.appendChild(el('div', { class: 'color-row', onclick: () => { WC.closeFlyouts(); onPick(opts.autoValue || 'inherit', 'Automatic'); } }, [
        el('span', { class: 'sw', style: { background: opts.autoSwatch || '#000' } }), el('span', { text: opts.autoLabel || 'Automatic' }),
      ]));
    }
    wrap.appendChild(el('div', { class: 'color-section-title', text: 'Theme Colors' }));
    const tg = el('div', { class: 'color-grid' });
    THEME_COLORS.forEach((c) => tg.appendChild(swatch(c, onPick)));
    wrap.appendChild(tg);
    const tints = el('div', { class: 'color-grid', style: { marginTop: '3px' } });
    THEME_TINTS.forEach((row) => row.forEach((c) => tints.appendChild(swatch(c, onPick))));
    wrap.appendChild(tints);
    wrap.appendChild(el('div', { class: 'color-section-title', text: 'Standard Colors' }));
    const sg = el('div', { class: 'color-grid' });
    STANDARD.forEach((c) => sg.appendChild(swatch(c, onPick)));
    wrap.appendChild(sg);
    if (opts.noColor) {
      wrap.appendChild(el('div', { class: 'color-row', onclick: () => { WC.closeFlyouts(); onPick(null, 'No Color'); } }, [
        el('span', { class: 'sw', style: { background: '#fff' } }), el('span', { text: opts.noColorLabel || 'No Color' }),
      ]));
    }
    wrap.appendChild(el('div', { class: 'color-row', onclick: () => {
      const input = el('input', { type: 'color', style: { position: 'absolute', opacity: 0 } });
      document.body.appendChild(input);
      input.addEventListener('input', () => { WC.closeFlyouts(); onPick(input.value, input.value); input.remove(); });
      input.click();
    } }, [el('span', { class: 'sw', html: WC.icon('_generic', 14) }), el('span', { text: 'More Colors…' })]));
    return wrap;
  };
  function swatch(c, onPick) {
    return el('div', { class: 'color-swatch', title: c, style: { background: c }, onclick: () => { WC.closeFlyouts(); onPick(c, c); } });
  }

  // --- toast ---
  let toastWrap = null;
  WC.toast = function (msg, info) {
    if (!toastWrap) { toastWrap = el('div', { class: 'toast-wrap' }); document.body.appendChild(toastWrap); }
    const t = el('div', { class: 'toast' }, [el('div', { text: msg }), info ? el('div', { class: 't-info', text: info }) : null]);
    toastWrap.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, info ? 3400 : 2200);
  };
  WC.notImplemented = function (name) {
    WC.toast(`“${name}” is part of Word's UI but is not implemented in this clone.`, 'See docs/NOT_IMPLEMENTED.md for the full list of gaps.');
  };

  // --- screentip (hover tooltip) ---
  let tip = null, tipTimer = null;
  WC.attachTip = function (node, title, body, key) {
    node.addEventListener('mouseenter', () => {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => {
        hideTip();
        tip = el('div', { class: 'screentip' }, [
          el('div', { class: 'st-title' }, [document.createTextNode(title || ''), key ? el('span', { class: 'st-key', text: '  (' + key + ')' }) : null]),
          body ? el('div', { class: 'st-body', text: body }) : null,
        ]);
        document.body.appendChild(tip);
        const r = node.getBoundingClientRect();
        let left = Math.min(r.left, window.innerWidth - tip.offsetWidth - 8);
        let top = r.bottom + 4;
        if (top + tip.offsetHeight > window.innerHeight - 8) top = r.top - tip.offsetHeight - 4;
        tip.style.left = Math.max(4, left) + 'px';
        tip.style.top = top + 'px';
      }, 550);
    });
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('mousedown', hideTip);
  };
  function hideTip() { clearTimeout(tipTimer); if (tip) { tip.remove(); tip = null; } }
  WC.hideTip = hideTip;

  // --- modal dialog framework ---
  WC.dialog = function (opts) {
    // opts: { title, body (node), footer: [{label, primary, onClick, close}], width, onClose }
    const backdrop = el('div', { class: 'modal-backdrop' });
    const dlg = el('div', { class: 'dialog' });
    if (opts.width) dlg.style.width = opts.width;
    const close = () => { backdrop.remove(); if (opts.onClose) opts.onClose(); };
    dlg.appendChild(el('div', { class: 'dlg-title' }, [
      el('span', { text: opts.title }),
      el('span', { class: 'x', html: WC.icon('win_close', 12), onclick: close }),
    ]));
    const body = el('div', { class: 'dlg-body' });
    if (opts.body) body.appendChild(opts.body);
    dlg.appendChild(body);
    if (opts.footer) {
      const f = el('div', { class: 'dlg-footer' });
      opts.footer.forEach((b) => {
        const btn = el('button', { class: 'btn' + (b.primary ? ' primary' : ''), text: b.label });
        btn.addEventListener('click', () => { const keep = b.onClick && b.onClick(); if (b.close !== false && !keep) close(); });
        f.appendChild(btn);
      });
      dlg.appendChild(f);
    }
    backdrop.appendChild(dlg);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop && opts.dismissable !== false) close(); });
    document.getElementById('modal-root').appendChild(backdrop);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    return { close, body, dlg };
  };
})();
