/* dialogs.js — modal dialogs + task panes: Insert Table, Link, Symbol,
   Equation, Find/Replace, Paragraph, Word Count, Zoom, Navigation, Styles. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;

  const D = {};

  // ---- Insert Table ----
  D.insertTable = function () {
    const body = el('div');
    const lbl = el('div', { class: 'tablegrid-label', text: 'Insert Table' });
    const grid = el('div', { class: 'tablegrid' });
    const cells = [];
    const ROWS = 8, COLS = 10;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = el('div', { class: 'cell', dataset: { r, c } });
      cell.addEventListener('mouseenter', () => paint(r, c));
      cell.addEventListener('click', () => { dlg.close(); build(r + 1, c + 1); });
      cells.push(cell); grid.appendChild(cell);
    }
    function paint(r, c) { cells.forEach((cl) => cl.classList.toggle('on', +cl.dataset.r <= r && +cl.dataset.c <= c)); lbl.textContent = `${c + 1} × ${r + 1} Table`; }
    body.appendChild(lbl); body.appendChild(grid);
    const custom = el('div', { class: 'row', style: { marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' } }, [
      el('label', { text: 'Columns:' }), el('input', { type: 'number', value: '3', min: '1', id: 'tcols', style: { width: '60px' } }),
      el('label', { text: 'Rows:' }), el('input', { type: 'number', value: '2', min: '1', id: 'trows', style: { width: '60px' } }),
    ]);
    body.appendChild(custom);
    function build(rows, cols) {
      rows = Math.floor(Number(rows)); cols = Math.floor(Number(cols));
      if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 1 || cols < 1 || rows > 1000 || cols > 1000) {
        WC.toast('Rows and columns must be whole numbers between 1 and 1000.');
        return false; // keep dialog open
      }
      let html = '<table><tbody>';
      for (let r = 0; r < rows; r++) { html += '<tr>'; for (let c = 0; c < cols; c++) html += '<td><br></td>'; html += '</tr>'; }
      html += '</tbody></table><p><br></p>';
      E().insertHTML(html);
    }
    const dlg = WC.dialog({ title: 'Insert Table', body, footer: [
      { label: 'OK', primary: true, onClick: () => build(+document.getElementById('trows').value, +document.getElementById('tcols').value) === false },
      { label: 'Cancel' },
    ] });
  };

  // ---- Insert Link ----
  D.insertLink = function () {
    const sel = window.getSelection();
    const selText = sel && !sel.isCollapsed ? sel.toString() : '';
    const text = el('input', { type: 'text', value: selText, class: 'grow' });
    const addr = el('input', { type: 'text', placeholder: 'https://example.com', class: 'grow' });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Text to display:', style: { width: '110px' } }), text]),
      el('div', { class: 'row' }, [el('label', { text: 'Address:', style: { width: '110px' } }), addr]),
    ]);
    WC.dialog({ title: 'Insert Hyperlink', width: '460px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const raw = addr.value.trim(); if (!raw) return;
        const url = WC.safeUrl(raw);
        const label = text.value.trim() || raw;
        E().insertHTML(`<a href="${WC.escapeHtml(url)}">${WC.escapeHtml(label)}</a>&nbsp;`);
      } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Symbol ----
  const SYMBOLS = '© ® ™ ° µ ± × ÷ ≈ ≠ ≤ ≥ ∞ √ π Σ Ω α β γ δ θ λ € £ ¥ ¢ § ¶ † ‡ • … “ ” ‘ ’ « » → ← ↑ ↓ ⇒ ★ ☆ ♥ ♦ ✓ ✗ ☺'.split(' ');
  D.symbol = function (anchor) {
    const open = (target) => WC.flyout(target, (fly) => {
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 28px)', gap: '2px', padding: '8px' } });
      SYMBOLS.forEach((s) => {
        const cell = el('div', { text: s, style: { height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', border: '1px solid #eee' } });
        cell.addEventListener('click', () => { WC.closeFlyouts(); E().insertHTML(s); });
        grid.appendChild(cell);
      });
      fly.appendChild(grid);
      fly.appendChild(WC.flyItem('More Symbols…', { onClick: () => WC.Insert.symbolDialog() }));
    });
    open(anchor || document.body);
  };

  // ---- Equation ----
  D.equation = function () {
    const presets = ['a² + b² = c²', 'x = (−b ± √(b²−4ac)) / 2a', 'E = mc²', '∫ f(x) dx', 'Σ(i=1→n) i = n(n+1)/2', 'lim(x→∞) 1/x = 0'];
    const ta = el('textarea', { class: 'grow', rows: '2', placeholder: 'Type an equation (Unicode math). Full equation editor is not implemented.' });
    const chips = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' } });
    presets.forEach((p) => { const c = el('button', { class: 'btn', text: p, style: { minWidth: 'auto' } }); c.addEventListener('click', () => ta.value = p); chips.appendChild(c); });
    const body = el('div', {}, [el('div', { text: 'Common equations:' }), chips, ta]);
    WC.dialog({ title: 'Insert Equation', width: '520px', body, footer: [
      { label: 'Insert', primary: true, onClick: () => { if (ta.value.trim()) E().insertHTML(`<span style="font-family:'Cambria Math',Cambria,serif;font-style:italic">${WC.escapeHtml(ta.value.trim())}</span>&nbsp;`); } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Find & Replace pane ----
  let findState = { hits: [], idx: -1 };
  D.findPane = function (replace) {
    // PM mode: legacy find/replace rewrites #editor text nodes (raw DOM —
    // bypasses the editor.js chokepoints). Blocked until slice 5 (fork Search ext).
    if (window.WC.PM && window.WC.PM.active) { window.WC.PM.notifyBlocked('Find & Replace'); return; }
    clearHits();
    let pane = document.getElementById('find-pane');
    if (pane) pane.remove();
    pane = el('div', { class: 'taskpane', id: 'find-pane' });
    const input = el('input', { type: 'text', placeholder: 'Find in document' });
    const replInput = el('input', { type: 'text', placeholder: 'Replace with' });
    const counter = el('div', { style: { fontSize: '12px', color: '#666', padding: '4px 0' } });
    const head = el('div', { class: 'tp-head' }, [
      el('div', { class: 'tp-title', text: replace ? 'Replace' : 'Navigation' }),
      el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => { clearHits(); pane.remove(); } }),
    ]);
    const body = el('div', { class: 'tp-body' });
    const search = el('div', { class: 'tp-search' }, [input, el('span', { class: 'go', html: WC.icon('search', 14), onclick: () => doFind() })]);
    body.appendChild(search);
    body.appendChild(counter);
    const nav = el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn', text: '▲ Prev', onclick: () => step(-1) }),
      el('button', { class: 'btn', text: 'Next ▼', onclick: () => step(1) }),
    ]);
    body.appendChild(nav);
    if (replace) {
      body.appendChild(el('div', { class: 'tp-search', style: { marginTop: '8px' } }, [replInput]));
      body.appendChild(el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn', text: 'Replace', onclick: () => doReplace(false) }),
        el('button', { class: 'btn primary', text: 'Replace All', onclick: () => doReplace(true) }),
      ]));
    }
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
    input.focus();

    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doFind, 200); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); step(1); } });

    function doFind() {
      clearHits();
      const term = input.value;
      if (!term) { counter.textContent = ''; return; }
      const re = new RegExp(escapeRe(term), 'gi');
      const walker = document.createTreeWalker(E().node, NodeFilter.SHOW_TEXT, { acceptNode: (n) => /\S/.test(n.nodeValue) && !n.parentElement.closest('.pagebreak-guide') ? 1 : 2 });
      const textNodes = []; let n;
      while ((n = walker.nextNode())) textNodes.push(n);
      textNodes.forEach((node) => {
        const txt = node.nodeValue; let m, last = 0; const frag = document.createDocumentFragment(); let found = false;
        re.lastIndex = 0;
        while ((m = re.exec(txt))) {
          found = true;
          if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
          const span = el('span', { class: 'find-hit', text: m[0] });
          frag.appendChild(span); findState.hits.push(span);
          last = m.index + m[0].length;
          if (m[0].length === 0) re.lastIndex++;
        }
        if (found) { if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last))); node.parentNode.replaceChild(frag, node); }
      });
      findState.idx = findState.hits.length ? 0 : -1;
      mark();
      counter.textContent = findState.hits.length ? `${findState.idx + 1} of ${findState.hits.length}` : 'No matches';
    }
    function step(d) {
      if (!findState.hits.length) return;
      findState.idx = (findState.idx + d + findState.hits.length) % findState.hits.length;
      mark(); counter.textContent = `${findState.idx + 1} of ${findState.hits.length}`;
    }
    function mark() {
      findState.hits.forEach((h, i) => h.classList.toggle('current', i === findState.idx));
      const cur = findState.hits[findState.idx];
      if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    function doReplace(all) {
      if (!findState.hits.length) { doFind(); if (!findState.hits.length) return; }
      const val = replInput.value;
      if (all) {
        findState.hits.forEach((h) => h.replaceWith(document.createTextNode(val)));
        const count = findState.hits.length; findState.hits = []; findState.idx = -1;
        E().node.normalize(); E().dirty = true; E().repaginate(); E().updateStatus();
        counter.textContent = `Replaced ${count}`;
        setTimeout(doFind, 50);
      } else {
        const cur = findState.hits[findState.idx]; if (!cur) return;
        cur.replaceWith(document.createTextNode(val));
        findState.hits.splice(findState.idx, 1); E().node.normalize(); E().dirty = true; E().repaginate();
        if (findState.idx >= findState.hits.length) findState.idx = 0;
        mark(); counter.textContent = findState.hits.length ? `${findState.idx + 1} of ${findState.hits.length}` : 'Replaced';
      }
    }
  };
  function clearHits() {
    document.querySelectorAll('#editor .find-hit').forEach((h) => { const t = document.createTextNode(h.textContent); h.replaceWith(t); });
    if (E().node) E().node.normalize();
    findState = { hits: [], idx: -1 };
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ---- Paragraph dialog ----
  D.paragraph = function () {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    if (pm) pm.captureSelection(); // the dialog steals focus; restore before applying
    const st = pm ? pm.getState() : null;
    const fmtLine = (v) => (v == null ? '1.15' : (Number.isInteger(v) ? v + '.0' : String(v)));
    const align = el('select', {}, ['Left', 'Centered', 'Right', 'Justified'].map((o) => el('option', { text: o })));
    if (st) align.value = st.justifyCenter ? 'Centered' : st.justifyRight ? 'Right' : st.justifyFull ? 'Justified' : 'Left';
    const indL = el('input', { type: 'number', value: String(st ? (st.indentLeftIn != null ? st.indentLeftIn : 0) : 0), step: '0.1', style: { width: '70px' } });
    const indR = el('input', { type: 'number', value: String(st ? (st.indentRightIn != null ? st.indentRightIn : 0) : 0), step: '0.1', style: { width: '70px' } });
    const before = el('input', { type: 'number', value: String(st ? (st.spacingBeforePt != null ? st.spacingBeforePt : 0) : 0), style: { width: '70px' } });
    const after = el('input', { type: 'number', value: String(st ? (st.spacingAfterPt != null ? st.spacingAfterPt : 8) : 8), style: { width: '70px' } });
    // PM mode adds 2.5 (ribbon parity); the legacy option list is frozen UI.
    const lineOpts = pm ? ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'] : ['1.0', '1.15', '1.5', '2.0', '3.0'];
    const line = el('select', {}, lineOpts.map((o) => el('option', { text: o })));
    // lineSpacing is null for exact/atLeast rules (no multiplier form) — leave the
    // select at its default rather than lie with a converted value.
    if (st && st.lineSpacing != null && lineOpts.indexOf(fmtLine(st.lineSpacing)) !== -1) line.value = fmtLine(st.lineSpacing);
    const body = el('div', {}, [
      row('Alignment:', align),
      row('Indent left (in):', indL), row('Indent right (in):', indR),
      row('Spacing before (pt):', before), row('Spacing after (pt):', after),
      row('Line spacing:', line),
    ]);
    function row(label, ctrl) { return el('div', { class: 'row' }, [el('label', { text: label, style: { width: '160px' } }), ctrl]); }
    WC.dialog({ title: 'Paragraph', width: '460px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        if (pm) {
          const steps = [
            ['setTextAlign', { Left: 'left', Centered: 'center', Right: 'right', Justified: 'justify' }[align.value]],
            ['updateAttributes', 'paragraph', {
              'paragraphProperties.spacing.before': Math.round((parseFloat(before.value) || 0) * 20),
              'paragraphProperties.spacing.after': Math.round((parseFloat(after.value) || 0) * 20),
              'paragraphProperties.spacing.line': Math.round((parseFloat(line.value) || 1.15) * 240),
              'paragraphProperties.spacing.lineRule': 'auto',
              'paragraphProperties.indent.left': Math.round((parseFloat(indL.value) || 0) * 1440),
              'paragraphProperties.indent.right': Math.round((parseFloat(indR.value) || 0) * 1440),
            }],
          ];
          pm.withSelection(() => pm.chain(steps)); // ONE transaction = ONE undo step (Word)
        } else {
          const a = { Left: 'justifyLeft', Centered: 'justifyCenter', Right: 'justifyRight', Justified: 'justifyFull' }[align.value];
          E().exec(a);
          E().applyBlockStyle('marginTop', before.value + 'pt');
          E().applyBlockStyle('marginBottom', after.value + 'pt');
          E().applyBlockStyle('lineHeight', line.value);
          E().applyBlockStyle('marginLeft', (parseFloat(indL.value) * 96) + 'px');
          E().applyBlockStyle('marginRight', (parseFloat(indR.value) * 96) + 'px');
        }
      } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Word Count ----
  D.wordCount = function () {
    const pmMode = WC.PM && WC.PM.active;
    const c = pmMode
      ? WC.PM.counts()
      : (() => {
          const ec = E().counts();
          const text = E().node.innerText;
          return Object.assign(ec, {
            pages: E().pageCount(),
            paras: E().node.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote').length,
            lines: (text.match(/\n/g) || []).length + 1,
            charsNoSpace: text.replace(/\s/g, '').length,
          });
        })();
    const rows = [['Pages', c.pages], ['Words', c.words], ['Characters (no spaces)', c.charsNoSpace], ['Characters (with spaces)', c.chars], ['Paragraphs', c.paras], ['Lines', c.lines]];
    const body = el('div', { class: 'info-props' });
    rows.forEach(([k, v]) => body.appendChild(el('div', { class: 'row', style: { borderBottom: '1px solid #f0f0f0', padding: '5px 0' } }, [el('span', { style: { width: '220px', color: '#444' }, text: k }), el('b', { text: String(v) })])));
    WC.dialog({ title: 'Word Count', width: '340px', body, footer: [{ label: 'Close', primary: true }] });
  };

  // ---- Zoom ----
  D.zoom = function () {
    const levels = [['200%', 2], ['100%', 1], ['75%', 0.75], ['Page width', 'pw'], ['Whole page', 'wp']];
    const body = el('div', {}, levels.map(([label, v]) => {
      const r = el('div', { class: 'row' }, [el('input', { type: 'radio', name: 'zoom', id: 'z' + label, checked: v === 1 ? 'checked' : null }), el('label', { text: label, for: 'z' + label })]);
      r.dataset.zoom = v; r.addEventListener('click', () => r.querySelector('input').checked = true);
      return r;
    }));
    WC.dialog({ title: 'Zoom', width: '320px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const sel = body.querySelector('input:checked'); const v = sel.closest('.row').dataset.zoom;
        if (v === 'pw') E().setZoom((document.getElementById('canvas').clientWidth - 40) / 816);
        else if (v === 'wp') E().setZoom((document.getElementById('canvas').clientHeight - 40) / E().pageH);
        else E().setZoom(parseFloat(v));
      } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Navigation pane ----
  D.navPane = function () {
    let pane = document.getElementById('nav-pane'); if (pane) { pane.remove(); return; }
    pane = el('div', { class: 'taskpane', id: 'nav-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Navigation' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body' });
    const headings = E().node.querySelectorAll('h1,h2,h3');
    if (!headings.length) body.appendChild(el('div', { style: { color: '#888', padding: '12px 4px', fontSize: '13px' }, text: 'Create headings (Heading 1–3 styles) to populate the navigation map.' }));
    headings.forEach((h) => {
      const lvl = +h.tagName[1];
      const item = el('div', { class: 'tp-result', style: { paddingLeft: (8 + (lvl - 1) * 14) + 'px' }, text: h.textContent || '(empty heading)' });
      item.addEventListener('click', () => h.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      body.appendChild(item);
    });
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };

  // ---- Styles task pane ----
  const STYLE_PREVIEW = {
    'Heading 1': 'color:#2e74b5;font:13pt Calibri', 'Heading 2': 'color:#2e74b5;font:12pt Calibri', 'Heading 3': 'color:#1f4d78',
    'Heading 4': 'color:#2e74b5;font-style:italic', 'Title': 'font:18pt Calibri', 'Subtitle': 'color:#5a5a5a',
    'Strong': 'font-weight:bold', 'Emphasis': 'font-style:italic', 'Subtle Emphasis': 'font-style:italic;color:#5a5a5a',
    'Intense Emphasis': 'font-style:italic;color:#2e74b5', 'Quote': 'font-style:italic;color:#5a5a5a', 'Intense Quote': 'font-style:italic;color:#2e74b5',
  };
  D.stylesPane = function () {
    let pane = document.getElementById('styles-pane'); if (pane) { pane.remove(); return; }
    // D6 (slice 3): the gallery chevron calls this directly (ribbon.js) with no
    // launcher gate — block here until the styles area flips.
    if (window.WC.PM && window.WC.PM.active && window.WC.PM.isBlocked('stylesGallery')) { window.WC.PM.notifyBlocked('Styles'); return; }
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    pane = el('div', { class: 'taskpane right', id: 'styles-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Styles' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body styles-list' });
    let preview = true;
    const list = el('div');
    const previewRow = el('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 0' } }, [
      (() => { const cb = el('input', { type: 'checkbox', checked: 'checked' }); cb.addEventListener('change', () => { preview = cb.checked; render(); }); return cb; })(),
      el('span', { text: 'Show Preview' }),
    ]);
    function render() {
      list.innerHTML = '';
      (WC.Styles ? WC.Styles.all() : ['Normal']).forEach((s) => {
        const item = el('div', { class: 'sl-item', text: s });
        if (preview) item.setAttribute('style', (STYLE_PREVIEW[s] || '') + ';');
        item.addEventListener('mousedown', (e) => e.preventDefault());
        item.addEventListener('click', () => {
          const pm2 = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
          if (pm2) { if (!pm2.applyStyleByName(s)) WC.toast('Style “' + s + '” is not available in this document.'); return; }
          WC.applyNamedStyle(s);
        });
        list.appendChild(item);
      });
    }
    render();
    body.appendChild(previewRow);
    body.appendChild(list);
    const footer = el('div', { style: { display: 'flex', gap: '6px', padding: '10px 0 0', borderTop: '1px solid #eee', marginTop: '8px' } }, [
      // Re-capture per click (the item-click pm2 pattern): failBridge can un-flip the
      // mode while the pane is open — never act on a stale bridge reference.
      el('button', { class: 'btn', text: 'New Style', onclick: () => { const pm2 = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm2) { WC.toast("New Style isn't on the new engine yet", 'Custom styles land in a later slice — run with --legacy for the classic editor'); return; } D.createStyle(render); } }),
      el('button', { class: 'btn', text: 'Clear All', onclick: () => { const pm2 = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm2) { if (!pm2.applyStyleByName('Normal')) WC.toast('Style “Normal” is not available in this document.'); return; } WC.applyNamedStyle('Normal'); } }),
    ]);
    body.appendChild(footer);
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };

  // Create a Style from the current selection's formatting.
  D.createStyle = function (onDone) {
    const name = el('input', { type: 'text', class: 'grow', placeholder: 'Style name' });
    const type = el('select', {}, [el('option', { value: 'character', text: 'Character (selected text)' }), el('option', { value: 'paragraph', text: 'Paragraph' })]);
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Name:', style: { width: '70px' } }), name]),
      el('div', { class: 'row' }, [el('label', { text: 'Type:', style: { width: '70px' } }), type]),
      el('div', { style: { fontSize: '12px', color: '#666', marginTop: '6px' }, text: 'Captures the current selection’s formatting into a reusable style.' }),
    ]);
    WC.dialog({ title: 'Create New Style from Formatting', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: () => { const nm = name.value.trim(); if (!nm) return; WC.Styles.createFromSelection(nm, type.value); if (onDone) onDone(); WC.toast('Style “' + nm + '” created.'); } },
      { label: 'Cancel' },
    ] });
  };

  // Apply Styles combo (Ctrl+Shift+S)
  D.applyStyles = function () {
    const dl = el('datalist', { id: 'apply-styles-list' }, (WC.Styles ? WC.Styles.all() : []).map((s) => el('option', { value: s })));
    const input = el('input', { type: 'text', class: 'grow', list: 'apply-styles-list', placeholder: 'Style name' });
    const body = el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Style Name:', style: { width: '90px' } }), input, dl])]);
    WC.dialog({ title: 'Apply Styles', width: '360px', body, footer: [
      { label: 'Apply', primary: true, onClick: () => { if (input.value.trim()) WC.applyNamedStyle(input.value.trim()); } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Font dialog (Ctrl+D / Font group launcher) ----
  D.font = function () {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    if (pm) pm.captureSelection(); // the dialog steals focus; restore before applying
    const saved = pm ? null : E().savedRange;
    const st = pm ? pm.getState() : E().queryState();
    let colorVal = '';
    const mk = (tag, props, ch) => el(tag, props, ch);
    const fam = el('select', { class: 'grow' }, (WC.FONTS || ['Calibri']).map((f) => el('option', { value: f, text: f, selected: (st.computedFontFamily === f ? 'selected' : null) })));
    const styleSel = el('select', {}, ['Regular', 'Italic', 'Bold', 'Bold Italic'].map((s) => el('option', { text: s, selected: ((st.bold && st.italic && s === 'Bold Italic') || (st.bold && !st.italic && s === 'Bold') || (!st.bold && st.italic && s === 'Italic') || (!st.bold && !st.italic && s === 'Regular')) ? 'selected' : null })));
    const size = el('input', { type: 'number', value: String(st.computedFontSizePt || 11), step: '1', style: { width: '70px' } });
    const colorBtn = el('button', { class: 'btn', text: 'Automatic ▾', style: { minWidth: '120px' } });
    colorBtn.addEventListener('click', () => WC.flyout(colorBtn, (f) => f.appendChild(WC.colorPalette((c, label) => { colorVal = c === 'inherit' ? '' : c; colorBtn.textContent = (label || 'Color') + ' ▾'; colorBtn.style.color = colorVal || ''; update(); }))));
    const underline = el('select', {}, [['(none)', 'none'], ['Single', 'single'], ['Double', 'double'], ['Dotted', 'dotted'], ['Dashed', 'dashed'], ['Wavy', 'wavy']].map(([l, v]) => el('option', { value: v, text: l })));
    const cb = (label) => { const c = el('input', { type: 'checkbox' }); c.addEventListener('change', update); return { c, row: el('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [c, el('span', { text: label })]) }; };
    const strike = cb('Strikethrough'), sup = cb('Superscript'), sub = cb('Subscript'), small = cb('Small caps'), allc = cb('All caps');
    if (st.subscript) sub.c.checked = true; if (st.superscript) sup.c.checked = true; if (st.strikethrough) strike.c.checked = true;
    sup.c.addEventListener('change', () => { if (sup.c.checked) sub.c.checked = false; });
    sub.c.addEventListener('change', () => { if (sub.c.checked) sup.c.checked = false; });
    [fam, styleSel, size, underline].forEach((n) => n.addEventListener('change', update));
    size.addEventListener('input', update);

    // Advanced
    const scale = el('select', {}, ['200', '150', '100', '90', '80', '66'].map((v) => el('option', { value: v, text: v + '%', selected: v === '100' ? 'selected' : null })));
    const spacing = el('select', {}, ['Normal', 'Expanded', 'Condensed'].map((v) => el('option', { text: v })));
    const spacingBy = el('input', { type: 'number', value: '1', step: '0.1', style: { width: '60px' } });
    const position = el('select', {}, ['Normal', 'Raised', 'Lowered'].map((v) => el('option', { text: v })));
    const positionBy = el('input', { type: 'number', value: '3', step: '1', style: { width: '60px' } });
    [scale, spacing, spacingBy, position, positionBy].forEach((n) => { n.addEventListener('change', update); n.addEventListener('input', update); });

    const previewSpan = el('span', { text: (saved && saved.toString && saved.toString()) || 'AaBbCc — The quick brown fox' });
    const previewBox = el('div', { class: 'font-preview' }, [previewSpan]);

    function buildStyle() {
      const s = {};
      s.fontFamily = fam.value;
      s.fontSize = (parseFloat(size.value) || 11) + 'pt';
      s.fontWeight = /Bold/.test(styleSel.value) ? 'bold' : 'normal';
      s.fontStyle = /Italic/.test(styleSel.value) ? 'italic' : 'normal';
      if (colorVal) s.color = colorVal;
      const deco = []; if (underline.value !== 'none') deco.push('underline'); if (strike.c.checked) deco.push('line-through');
      s.textDecorationLine = deco.join(' ') || 'none';
      if (underline.value !== 'none' && underline.value !== 'single') s.textDecorationStyle = underline.value;
      s.fontVariant = small.c.checked ? 'small-caps' : 'normal';
      s.textTransform = allc.c.checked ? 'uppercase' : 'none';
      if (scale.value !== '100') { s.display = 'inline-block'; s.transform = 'scaleX(' + (parseInt(scale.value, 10) / 100) + ')'; }
      if (spacing.value !== 'Normal') { const by = parseFloat(spacingBy.value) || 1; s.letterSpacing = (spacing.value === 'Expanded' ? by : -by) + 'pt'; }
      if (position.value !== 'Normal') { const by = parseFloat(positionBy.value) || 3; s.position = 'relative'; s.top = (position.value === 'Lowered' ? by : -by) + 'pt'; }
      return s;
    }
    function update() { previewSpan.removeAttribute('style'); Object.assign(previewSpan.style, buildStyle()); }
    update();

    const fontTab = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Font:', style: { width: '70px' } }), fam, el('label', { text: 'Style:' }), styleSel, el('label', { text: 'Size:' }), size]),
      el('div', { class: 'row' }, [el('label', { text: 'Font color:', style: { width: '70px' } }), colorBtn, el('label', { text: 'Underline:' }), underline]),
      el('div', { style: { fontWeight: '600', margin: '8px 0 4px' }, text: 'Effects' }),
      el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' } }, [strike.row, small.row, sup.row, allc.row, sub.row]),
    ]);
    const advTab = el('div', { style: { display: 'none' } }, [
      el('div', { class: 'row' }, [el('label', { text: 'Scale:', style: { width: '90px' } }), scale]),
      el('div', { class: 'row' }, [el('label', { text: 'Spacing:', style: { width: '90px' } }), spacing, el('label', { text: 'By:' }), spacingBy, el('span', { text: 'pt' })]),
      el('div', { class: 'row' }, [el('label', { text: 'Position:', style: { width: '90px' } }), position, el('label', { text: 'By:' }), positionBy, el('span', { text: 'pt' })]),
    ]);
    const tabs = el('div', { class: 'tabs' }, [
      el('div', { class: 't active', text: 'Font', onclick: (e) => { sw(e.target, fontTab); } }),
      el('div', { class: 't', text: 'Advanced', onclick: (e) => { sw(e.target, advTab); } }),
    ]);
    function sw(tabEl, show) { tabs.querySelectorAll('.t').forEach((t) => t.classList.remove('active')); tabEl.classList.add('active'); fontTab.style.display = 'none'; advTab.style.display = 'none'; show.style.display = ''; }
    const body = el('div', {}, [tabs, fontTab, advTab, previewBox]);

    WC.dialog({ title: 'Font', width: '540px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        if (pm) {
          const steps = [['setFontFamily', fam.value], ['setFontSize', (parseFloat(size.value) || 11) + 'pt']];
          steps.push([/Bold/.test(styleSel.value) ? 'setBold' : 'unsetBold']);
          steps.push([/Italic/.test(styleSel.value) ? 'setItalic' : 'unsetItalic']);
          if (colorVal) steps.push(['setColor', colorVal]);
          if (underline.value !== 'none') {
            steps.push(['setUnderline']);
            // 'single' is deliberately absent: setUnderline's default attr IS underlineType:'single' (probe-verified).
            const UL = { double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave' };
            if (UL[underline.value]) steps.push(['setMark', 'underline', { underlineType: UL[underline.value] }]);
          } else steps.push(['unsetUnderline']);
          steps.push([strike.c.checked ? 'setStrike' : 'unsetStrike']);
          if (sup.c.checked) steps.push(['setMark', 'textStyle', { vertAlign: 'superscript' }]);
          else if (sub.c.checked) steps.push(['setMark', 'textStyle', { vertAlign: 'subscript' }]);
          pm.withSelection(() => pm.chain(steps)); // ONE transaction = ONE undo step (matches Word)
          if (small.c.checked || allc.c.checked || scale.value !== '100' || spacing.value !== 'Normal' || position.value !== 'Normal') {
            pm.notifyBlocked('Caps and Advanced font effects');
          }
        } else {
          E().savedRange = saved; E().applyInlineStyles(buildStyle());
          if (sup.c.checked) E().exec('superscript'); else if (sub.c.checked) E().exec('subscript');
        }
        WC.Ribbon.setComboValue('font', fam.value); WC.Ribbon.setComboValue('fontSize', String(parseFloat(size.value) || 11));
      } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Office Clipboard task pane ----
  D.clipboardPane = function () {
    if (WC.PM && WC.PM.active) { WC.toast('Office Clipboard history arrives in a later slice.'); return; }
    let pane = document.getElementById('clipboard-pane'); if (pane) { pane.remove(); WC.Clipboard.onChange = null; return; }
    pane = el('div', { class: 'taskpane', id: 'clipboard-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Clipboard' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => { pane.remove(); WC.Clipboard.onChange = null; } })]);
    const actions = el('div', { class: 'cb-actions' }, [
      el('button', { class: 'btn', text: 'Paste All', onclick: () => WC.Clipboard.pasteAll() }),
      el('button', { class: 'btn', text: 'Clear All', onclick: () => WC.Clipboard.clear() }),
    ]);
    const count = el('div', { class: 'cb-count' });
    const list = el('div', { class: 'cb-list' });
    const body = el('div', { class: 'tp-body' }, [actions, count, list]);
    function render() {
      const items = WC.Clipboard.items;
      count.textContent = items.length ? `${items.length} of 24 - Clipboard` : '';
      list.innerHTML = '';
      if (!items.length) { list.appendChild(el('div', { class: 'cb-empty', text: 'Copy or cut items to collect them here.' })); return; }
      items.forEach((it, i) => {
        const row = el('div', { class: 'cb-item' });
        row.appendChild(el('span', { class: 'cb-ic', html: WC.icon('copy', 16) }));
        if (it.kind === 'image') { const d = el('div', { class: 'cb-prev' }); d.innerHTML = it.html; row.appendChild(d); }
        else row.appendChild(el('span', { class: 'cb-prev', text: it.text.slice(0, 60) + (it.text.length > 60 ? '…' : '') }));
        const menu = el('span', { class: 'cb-item-menu', html: WC.icon('chevron_down', 10) });
        menu.addEventListener('click', (e) => { e.stopPropagation(); WC.flyout(menu, (fly) => { fly.appendChild(WC.flyItem('Paste', { onClick: () => WC.Clipboard.paste(it) })); fly.appendChild(WC.flyItem('Delete', { onClick: () => WC.Clipboard.remove(i) })); }); });
        row.appendChild(menu);
        row.addEventListener('click', () => WC.Clipboard.paste(it));
        list.appendChild(row);
      });
    }
    WC.Clipboard.onChange = () => { if (document.getElementById('clipboard-pane')) render(); else WC.Clipboard.onChange = null; };
    render();
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };

  // ---- Paste Special (PM-only) ----
  // Word's flavor list is clipboard-STATE-driven (oracle 16.77.1): rich clipboard →
  // HTML Format / Unformatted Text; plain text → only Unformatted Text; image →
  // Picture. Double-click on a row = OK (Word behavior).
  D.pasteSpecial = async function () {
    const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null;
    if (!pm) { WC.notImplemented('Paste Special'); return; }
    pm.captureSelection();
    const fl = (await pm.clipboardFlavors()) || { hasText: false, hasHtml: false, hasImage: false };
    const options = [];
    if (fl.hasHtml) options.push(['HTML Format', () => pm.pasteHTML()]);
    if (fl.hasText) options.push(['Unformatted Text', () => pm.pasteTextOnly()]);
    if (fl.hasImage) options.push(['Picture', () => pm.pastePicture()]);
    let chosen = 0;
    const doPaste = () => { if (options[chosen]) pm.withSelection(() => options[chosen][1]()); };
    const list = el('ul', { class: 'ps-list' }, options.map(([label], i) =>
      el('li', { class: 'ps-item' + (i === 0 ? ' selected' : ''), text: label, tabindex: '0' })));
    list.addEventListener('click', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      chosen = Array.from(list.children).indexOf(li);
      list.querySelectorAll('li').forEach((n, i) => n.classList.toggle('selected', i === chosen));
    });
    const body = el('div', {}, [
      el('div', { class: 'row', text: 'As:' }),
      options.length ? list : el('div', { text: 'The Clipboard is empty.' }),
    ]);
    const handle = WC.dialog({ title: 'Paste Special', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: doPaste },
      { label: 'Cancel' },
    ] });
    list.addEventListener('dblclick', (e) => {
      if (!e.target.closest('li')) return;
      doPaste();
      handle.close(); // Word: dblclick = OK
    });
  };

  // ---- Editor / Proofing pane ----
  const MISSPELLINGS = {
    teh: 'the', recieve: 'receive', seperate: 'separate', definately: 'definitely', occured: 'occurred',
    untill: 'until', wich: 'which', accross: 'across', becuase: 'because', beleive: 'believe',
    calender: 'calendar', enviroment: 'environment', goverment: 'government', neccessary: 'necessary',
    occassion: 'occasion', publically: 'publicly', tommorow: 'tomorrow', wierd: 'weird', adn: 'and',
    thier: 'their', alot: 'a lot', acheive: 'achieve', arguement: 'argument', begining: 'beginning',
  };
  function scanSpelling() {
    const issues = [];
    const ignored = D._ignoredSpelling || (D._ignoredSpelling = {});
    const walker = document.createTreeWalker(E().node, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const re = /[A-Za-z]+/g; let m;
      while ((m = re.exec(node.nodeValue))) {
        const word = m[0]; const low = word.toLowerCase();
        if (MISSPELLINGS[low] && !ignored[low]) issues.push({ node, index: m.index, word, suggestion: matchCase(word, MISSPELLINGS[low]) });
      }
    }
    return issues;
  }
  function matchCase(orig, sugg) { if (orig[0] === orig[0].toUpperCase()) return sugg[0].toUpperCase() + sugg.slice(1); return sugg; }
  D.editorPane = function () {
    let pane = document.getElementById('editor-pane'); if (pane) { pane.remove(); return; }
    pane = el('div', { class: 'taskpane right', id: 'editor-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Editor' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body' });
    const on = E().node.getAttribute('spellcheck') !== 'false';
    function render() {
      body.innerHTML = '';
      const issues = scanSpelling();
      const score = el('div', { style: { textAlign: 'center', padding: '8px 0 12px' } }, [
        el('div', { style: { fontSize: '30px', fontWeight: '700', color: issues.length ? '#b85c00' : 'var(--word-blue)' }, text: issues.length ? String(issues.length) : '✓' }),
        el('div', { style: { color: '#444' }, text: issues.length ? (issues.length + ' spelling issue' + (issues.length > 1 ? 's' : '') + ' found') : 'No issues. Looks good!' }),
      ]);
      body.appendChild(score);
      if (issues.length) body.appendChild(el('div', { style: { fontWeight: '600', margin: '4px 0 6px' }, text: 'Spelling' }));
      issues.forEach((iss) => {
        const card = el('div', { style: { border: '1px solid #e1dfdd', borderRadius: '4px', padding: '8px', marginBottom: '8px' } });
        card.appendChild(el('div', {}, [el('span', { style: { textDecoration: 'underline wavy #d13438', color: '#d13438', fontWeight: '600' }, text: iss.word })]));
        card.appendChild(el('div', { style: { fontSize: '12px', color: '#666', margin: '4px 0' }, text: 'Suggestion:' }));
        const sug = el('button', { class: 'btn', style: { display: 'block', width: '100%', textAlign: 'left', marginBottom: '4px' }, text: iss.suggestion });
        sug.addEventListener('click', () => { changeWord(iss); render(); });
        card.appendChild(sug);
        const row = el('div', { style: { display: 'flex', gap: '6px' } }, [
          el('button', { class: 'btn', text: 'Ignore', onclick: () => { (D._ignoredSpelling[iss.word.toLowerCase()] = true); render(); } }),
          el('button', { class: 'btn', text: 'Ignore All', onclick: () => { D._ignoredSpelling[iss.word.toLowerCase()] = true; render(); } }),
        ]);
        card.appendChild(row);
        body.appendChild(card);
      });
      const cbk = el('input', { type: 'checkbox', checked: on ? 'checked' : null });
      cbk.addEventListener('change', () => E().node.setAttribute('spellcheck', cbk.checked ? 'true' : 'false'));
      body.appendChild(el('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '14px', fontSize: '12px' } }, [cbk, el('span', { text: 'Check spelling as you type' })]));
    }
    function changeWord(iss) {
      // re-locate (the node may have shifted) and replace the first occurrence
      const walker = document.createTreeWalker(E().node, NodeFilter.SHOW_TEXT, null); let n;
      while ((n = walker.nextNode())) { const re = new RegExp('\\b' + iss.word + '\\b'); if (re.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(re, iss.suggestion); break; } }
      E().dirty = true; E().updateStatus(); E().emit();
    }
    render();
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };

  // ---- Custom Watermark ----
  D.watermark = function () {
    const text = el('input', { type: 'text', class: 'grow', value: 'CONFIDENTIAL' });
    let color = '#C8C8C8';
    const colorBtn = el('button', { class: 'btn', text: 'Color ▾' });
    colorBtn.addEventListener('click', () => WC.flyout(colorBtn, (f) => f.appendChild(WC.colorPalette((c) => { color = c === 'inherit' ? '#C8C8C8' : c; colorBtn.style.color = color; }))));
    const diag = el('input', { type: 'checkbox', checked: 'checked' });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Text:', style: { width: '60px' } }), text]),
      el('div', { class: 'row' }, [el('label', { text: 'Color:', style: { width: '60px' } }), colorBtn, el('label', { style: { marginLeft: '12px' } }, [diag, el('span', { text: ' Diagonal' })])]),
    ]);
    WC.dialog({ title: 'Custom Watermark', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: () => WC.Design.watermark(text.value, { color, diagonal: diag.checked }) },
      { label: 'Cancel' },
    ] });
  };

  // ---- Page Borders ----
  D.pageBorders = function () {
    const style = el('select', {}, ['solid', 'double', 'dashed', 'dotted', 'groove'].map((s) => el('option', { value: s, text: s[0].toUpperCase() + s.slice(1) })));
    const width = el('input', { type: 'number', value: '1', min: '1', max: '12', style: { width: '70px' } });
    let color = '#000000';
    const colorBtn = el('button', { class: 'btn', text: 'Color ▾' });
    colorBtn.addEventListener('click', () => WC.flyout(colorBtn, (f) => f.appendChild(WC.colorPalette((c) => { color = c === 'inherit' ? '#000' : c; colorBtn.style.color = color; }))));
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Style:', style: { width: '60px' } }), style]),
      el('div', { class: 'row' }, [el('label', { text: 'Color:', style: { width: '60px' } }), colorBtn]),
      el('div', { class: 'row' }, [el('label', { text: 'Width (px):', style: { width: '60px' } }), width]),
    ]);
    WC.dialog({ title: 'Borders and Shading — Page Border', width: '440px', body, footer: [
      { label: 'OK', primary: true, onClick: () => WC.Design.pageBorders({ style: style.value, color, width: parseFloat(width.value) }) },
      { label: 'Remove', onClick: () => WC.Design.pageBorders({ remove: true }) },
      { label: 'Cancel' },
    ] });
  };

  // ---- Add Source / Manage Sources ----
  D.addSource = function (onAdd) {
    const type = el('select', {}, ['Book', 'Journal Article', 'Web Site', 'Report'].map((t) => el('option', { text: t })));
    const author = el('input', { type: 'text', class: 'grow', placeholder: 'Last, First' });
    const title = el('input', { type: 'text', class: 'grow' });
    const year = el('input', { type: 'text', style: { width: '80px' }, placeholder: 'Year' });
    const publisher = el('input', { type: 'text', class: 'grow' });
    const row = (l, c) => el('div', { class: 'row' }, [el('label', { text: l, style: { width: '80px' } }), c]);
    const body = el('div', {}, [row('Type:', type), row('Author:', author), row('Title:', title), row('Year:', year), row('Publisher:', publisher)]);
    WC.dialog({ title: 'Create Source', width: '480px', body, footer: [
      { label: 'OK', primary: true, onClick: () => { const s = { type: type.value, author: author.value.trim() || 'Unknown', title: title.value.trim(), year: year.value.trim(), publisher: publisher.value.trim() }; WC.Ref.addSource(s); if (onAdd) onAdd(s); else WC.Ref.insertCitation(s); } },
      { label: 'Cancel' },
    ] });
  };
  D.manageSources = function () {
    const list = el('div', { style: { border: '1px solid #c8c6c4', maxHeight: '200px', overflowY: 'auto', margin: '8px 0' } });
    function render() { list.innerHTML = ''; if (!WC.Ref.sources.length) list.appendChild(el('div', { style: { padding: '8px', color: '#888' }, text: 'No sources yet.' })); WC.Ref.sources.forEach((s, i) => list.appendChild(el('div', { style: { padding: '6px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex' } }, [el('span', { style: { flex: 1 }, text: s.author + ' (' + (s.year || 'n.d.') + ') — ' + (s.title || '') }), el('span', { style: { color: '#c0392b', cursor: 'pointer' }, text: 'Delete', onclick: () => { WC.Ref.sources.splice(i, 1); render(); } })]))); }
    render();
    WC.dialog({ title: 'Source Manager', width: '560px', body: el('div', {}, [el('div', { style: { fontSize: '12px', color: '#666' }, text: 'Current List' }), list]), footer: [
      { label: 'New…', onClick: () => { D.addSource(() => {}); return true; } },
      { label: 'Close', primary: true },
    ] });
  };

  WC.Dialogs = D;

})();
