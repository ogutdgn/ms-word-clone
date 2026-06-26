/* dialogs.js — modal dialogs + task panes: Insert Table, Link, Symbol,
   Equation, Find/Replace, Paragraph, Word Count, Zoom, Navigation, Styles. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;

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
      WC.PM.insertTable({ rows, cols }); return true;
    }
    const dlg = WC.dialog({ title: 'Insert Table', body, footer: [
      { label: 'OK', primary: true, onClick: () => build(+document.getElementById('trows').value, +document.getElementById('tcols').value) === false },
      { label: 'Cancel' },
    ] });
  };

  // ---- Insert Link ----
  D.insertLink = function () {
    if (WC.PM.ready) WC.PM.captureSelection(); // dialog steals focus; restore selection before inserting
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
        const label = text.value.trim() || raw;
        WC.PM.insertLink({ href: raw, text: label });
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
        cell.addEventListener('click', () => {
          WC.closeFlyouts();
          WC.PM.insertSymbol(s);
        });
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
      { label: 'Insert', primary: true, onClick: () => {
        if (!ta.value.trim()) return;
        WC.PM.insertEquation(ta.value.trim());
      } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Find & Replace pane ----
  // Drives the fork Search extension (non-destructive decoration highlights).
  D.findPane = function (replace, advanced) {
    return pmFindPane(replace, advanced, WC.PM);
  };

  // ---- Find & Replace pane — PM (fork Search extension) branch ----
  // Same chrome/classes as the legacy pane (so CSS + layout match) but drives the
  // non-destructive decoration session via WC.PM. The doc is NEVER mutated to
  // highlight — counts come from WC.PM.findCount(), highlights are PM decorations.
  function pmFindPane(replace, advanced, pm) {
    pm.clearFind(); // drop any stale session before re-opening
    let pane = document.getElementById('find-pane');
    if (pane) pane.remove();
    pane = el('div', { class: 'taskpane', id: 'find-pane' });
    const currentOpts = { caseSensitive: false, wholeWord: false, useWildcards: false, format: {} };
    const input = el('input', { type: 'text', placeholder: 'Find in document' });
    const replInput = el('input', { type: 'text', placeholder: 'Replace with' });
    // 018: the Special-character menu targets the last-focused box (Find or Replace), like Word.
    let lastFocused = input;
    input.addEventListener('focus', () => { lastFocused = input; });
    replInput.addEventListener('focus', () => { lastFocused = replInput; });
    const counter = el('div', { style: { fontSize: '12px', color: '#666', padding: '4px 0' } });
    const head = el('div', { class: 'tp-head' }, [
      el('div', { class: 'tp-title', text: replace ? 'Replace' : 'Navigation' }),
      el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => { pm.clearFind(); pane.remove(); } }),
    ]);
    const body = el('div', { class: 'tp-body' });
    const search = el('div', { class: 'tp-search' }, [input, el('span', { class: 'go', html: WC.icon('search', 14), onclick: () => runFind() })]);
    body.appendChild(search);
    body.appendChild(counter);
    const nav = el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn', text: '▲ Prev', onclick: () => stepNav(-1) }),
      el('button', { class: 'btn', text: 'Next ▼', onclick: () => stepNav(1) }),
    ]);
    body.appendChild(nav);
    // options row (Word-faithful: Match case / Whole words only / Use wildcards)
    const optRow = el('div', { class: 'find-opts', style: { display: advanced ? 'block' : 'none', padding: '6px 0', fontSize: '12px' } });
    const mkOpt = (label, key) => {
      const cb = el('input', { type: 'checkbox' });
      cb.addEventListener('change', () => { currentOpts[key] = cb.checked; runFind(); });
      return el('label', { class: 'row', style: { gap: '4px', alignItems: 'center' } }, [cb, el('span', { text: ' ' + label })]);
    };
    const matchCaseLabel = mkOpt('Match case', 'caseSensitive');
    const matchCaseCb = matchCaseLabel.querySelector('input');
    optRow.appendChild(matchCaseLabel);
    optRow.appendChild(mkOpt('Whole words only', 'wholeWord'));
    const wcLabel = mkOpt('Use wildcards', 'useWildcards');
    const wcCb = wcLabel.querySelector('input');
    // Word fidelity: wildcard mode is always case-sensitive — grey Match case when wildcards on, then RESTORE the
    // user's prior choice when wildcards turn off (and keep currentOpts in sync with the forced DOM state).
    let savedCaseSensitive = null;
    wcCb.addEventListener('change', () => {
      if (wcCb.checked) {
        savedCaseSensitive = matchCaseCb.checked;
        matchCaseCb.disabled = true;
        matchCaseCb.checked = true;            // wildcard search is case-sensitive
        currentOpts.caseSensitive = true;       // sync state (a programmatic .checked= does NOT fire mkOpt's handler)
      } else {
        matchCaseCb.disabled = false;
        if (savedCaseSensitive !== null) { matchCaseCb.checked = savedCaseSensitive; currentOpts.caseSensitive = savedCaseSensitive; }
      }
      runFind();
    });
    optRow.appendChild(wcLabel);
    body.appendChild(optRow);
    // 018: advanced tools — Special characters (^p/^t/…) + Find by Formatting. Shown with the other advanced opts.
    const fmtLabel = el('span', { style: { fontSize: '11px', color: '#2b579a', marginLeft: '6px' } });
    const refreshFmtLabel = () => {
      const on = Object.keys(currentOpts.format).filter((k) => currentOpts.format[k]);
      fmtLabel.textContent = on.length ? 'Format: ' + on.map((k) => k === 'fontFamily' ? currentOpts.format.fontFamily : k === 'fontSize' ? currentOpts.format.fontSize : k.charAt(0).toUpperCase() + k.slice(1)).join(', ') : '';
    };
    const toolRow = el('div', { class: 'find-tools', style: { display: advanced ? 'flex' : 'none', gap: '6px', alignItems: 'center', padding: '4px 0', fontSize: '12px' } });
    const specialBtn = el('button', { class: 'btn', text: 'Special ▾', onclick: () => WC.flyout(specialBtn, (fly) => {
      [['Paragraph Mark', '^p'], ['Tab Character', '^t'], ['Manual Line Break', '^l'], ['Caret ^', '^^']].forEach(([label, code]) =>
        fly.appendChild(WC.flyItem(label, { onClick: () => insertSpecial(code) })));
    }) });
    const formatBtn = el('button', { class: 'btn', text: 'Format ▾', onclick: () => WC.flyout(formatBtn, (fly) => {
      fly.appendChild(WC.flyHeader('Find text formatted as'));
      [['Bold', 'bold'], ['Italic', 'italic'], ['Underline', 'underline']].forEach(([label, key]) =>
        fly.appendChild(WC.flyItem((currentOpts.format[key] ? '✓ ' : '') + label, { onClick: () => { currentOpts.format[key] = !currentOpts.format[key]; refreshFmtLabel(); runFind(); } })));
      fly.appendChild(WC.flyItem('Font…', { onClick: () => promptFont() }));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Clear Formatting', { onClick: () => { currentOpts.format = {}; refreshFmtLabel(); runFind(); } }));
    }) });
    toolRow.appendChild(specialBtn);
    toolRow.appendChild(formatBtn);
    toolRow.appendChild(fmtLabel);
    body.appendChild(toolRow);
    function insertSpecial(code) {
      const t = lastFocused || input;
      const s = (t.selectionStart != null ? t.selectionStart : t.value.length);
      const e = (t.selectionEnd != null ? t.selectionEnd : t.value.length);
      t.value = t.value.slice(0, s) + code + t.value.slice(e);
      t.focus();
      const np = s + code.length;
      try { t.setSelectionRange(np, np); } catch (err) { /* non-text input */ }
      if (t === input) runFind();
    }
    function promptFont() {
      // Minimal Font filter (name + size) — applies on top of any bold/italic/underline already chosen.
      const name = el('input', { type: 'text', class: 'grow', placeholder: 'e.g. Calibri', value: currentOpts.format.fontFamily || '' });
      const size = el('input', { type: 'text', placeholder: 'e.g. 12pt', style: { width: '80px' }, value: currentOpts.format.fontSize || '' });
      WC.dialog({ title: 'Find Font', width: '340px', body: el('div', {}, [
        el('div', { class: 'row' }, [el('label', { text: 'Font:', style: { width: '60px' } }), name]),
        el('div', { class: 'row' }, [el('label', { text: 'Size:', style: { width: '60px' } }), size]),
      ]), footer: [
        { label: 'OK', primary: true, onClick: () => {
          const n = name.value.trim(); const z = size.value.trim();
          if (n) currentOpts.format.fontFamily = n; else delete currentOpts.format.fontFamily;
          if (z) currentOpts.format.fontSize = /pt$/.test(z) ? z : (z + 'pt'); else delete currentOpts.format.fontSize;
          refreshFmtLabel(); runFind();
        } },
        { label: 'Cancel' },
      ] });
    }
    function hasFormat() { return Object.keys(currentOpts.format).some((k) => currentOpts.format[k]); }
    if (replace) {
      body.appendChild(el('div', { class: 'tp-search', style: { marginTop: '8px' } }, [replInput]));
      body.appendChild(el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn', text: 'Replace', onclick: () => doReplaceOne() }),
        el('button', { class: 'btn primary', text: 'Replace All', onclick: () => doReplaceAll() }),
      ]));
    }
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
    input.focus();

    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runFind, 200); });
    // (M3) Enter navigates — runFind is highlight-only (keeps focus in the input).
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (hasFormat()) { stepNav(1); } else { pm.findNext(); refreshCount(); } } });

    function refreshCount() {
      const c = pm.findCount();
      counter.textContent = c.total ? `${c.activeMatchIndex + 1} of ${c.total}` : 'No matches';
    }
    function runFind() {
      const term = input.value;
      // 018: formatting search is navigation-ONLY (no text-highlight session) — clear any stale highlights so the
      // highlights never disagree with the navigation target; Next ▼ / Enter drive findFormatting.
      if (hasFormat()) { pm.clearFind(); counter.textContent = 'Press Next ▼ / Enter to find formatting'; return; }
      if (!term) { pm.clearFind(); counter.textContent = ''; return; }
      pm.findSession(term, currentOpts); // highlight-only, no jump (M3)
      refreshCount();
    }
    function stepNav(d) {
      // 018: formatting search wins — jump to the next run matching the Format filter (and the text term, if any).
      // Carry the case-sensitivity flag (it lives on currentOpts, not currentOpts.format) so Match Case is honored.
      if (hasFormat()) {
        const r = pm.findFormatting(input.value, Object.assign({}, currentOpts.format, { caseSensitive: currentOpts.caseSensitive }));
        if (!r || !r.found) WC.toast('No matching formatted text found');
        return;
      }
      if (!input.value) return;
      d < 0 ? pm.findPrev() : pm.findNext();
      refreshCount();
    }
    function doReplaceOne() {
      // 018: Replace-by-formatting is not supported in v1 — guard so a Format filter can't silently replace
      // UNformatted matches (the replace session ignores the filter). Word-faithful: clear the filter to replace.
      if (hasFormat()) { WC.toast('Replace by formatting isn’t supported yet — clear the Format filter'); return; }
      if (!pm.findCount().total) { runFind(); if (!pm.findCount().total) return; }
      pm.replaceOne(replInput.value);
      refreshCount();
    }
    function doReplaceAll() {
      if (hasFormat()) { WC.toast('Replace by formatting isn’t supported yet — clear the Format filter'); return; }
      if (!pm.findCount().total) { runFind(); if (!pm.findCount().total) return; }
      const r = pm.replaceAll(replInput.value);
      WC.toast('Replaced ' + (r && r.replacedCount != null ? r.replacedCount : 0));
      refreshCount(); // session cleared by replaceAll → "No matches"
    }
  }

  // ---- Go To dialog ----
  D.goToDialog = function () {
    const pm = WC.PM;
    const sel = el('select', {}, ['Page', 'Heading', 'Line', 'Bookmark'].map((o) => el('option', { text: o })));
    const input = el('input', { type: 'text', class: 'grow', placeholder: 'Enter target' });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Go to what:', style: { width: '110px' } }), sel]),
      el('div', { class: 'row' }, [el('label', { text: 'Enter value:', style: { width: '110px' } }), input]),
    ]);
    WC.dialog({ title: 'Go To', width: '380px', body, footer: [
      { label: 'Go To', primary: true, close: false, onClick: () => {
        const target = sel.value.toLowerCase();
        const ok = pm.goTo(target, input.value);
        if (!ok) WC.toast(target === 'page'
          ? 'Enter a page number'
          : 'Go To ' + sel.value + (target === 'line' || target === 'bookmark' ? ' is not available yet' : ' found no match'));
      } },
      { label: 'Close' },
    ] });
    setTimeout(() => input.focus(), 30);
  };

  // ---- Paragraph dialog ----
  D.paragraph = function () {
    const pm = WC.PM;
    if (pm.ready) pm.captureSelection(); // the dialog steals focus; restore before applying
    const st = pm.getState();
    const fmtLine = (v) => (v == null ? '1.15' : (Number.isInteger(v) ? v + '.0' : String(v)));
    const align = el('select', {}, ['Left', 'Centered', 'Right', 'Justified'].map((o) => el('option', { text: o })));
    align.value = st.justifyCenter ? 'Centered' : st.justifyRight ? 'Right' : st.justifyFull ? 'Justified' : 'Left';
    const indL = el('input', { type: 'number', value: String(st.indentLeftIn != null ? st.indentLeftIn : 0), step: '0.1', style: { width: '70px' } });
    const indR = el('input', { type: 'number', value: String(st.indentRightIn != null ? st.indentRightIn : 0), step: '0.1', style: { width: '70px' } });
    const before = el('input', { type: 'number', value: String(st.spacingBeforePt != null ? st.spacingBeforePt : 0), style: { width: '70px' } });
    const after = el('input', { type: 'number', value: String(st.spacingAfterPt != null ? st.spacingAfterPt : 8), style: { width: '70px' } });
    // 016: full line-spacing rule + "At", Special indent (first-line/hanging), contextual spacing.
    const pp = (pm.ready && pm.getResolvedParaProps && pm.getResolvedParaProps()) || {};
    const sp = pp.spacing || {}; const ind = pp.indent || {};
    const lineRule = el('select', {}, ['Single', '1.5 lines', 'Double', 'At least', 'Exactly', 'Multiple'].map((o) => el('option', { text: o })));
    const lineAt = el('input', { type: 'number', value: '12', step: '0.5', style: { width: '70px' } });
    // prefill the rule + At from the current paragraph (exact/atLeast = pt; auto = preset or ×-multiple)
    if (sp.lineRule === 'exact') { lineRule.value = 'Exactly'; lineAt.value = String((sp.line || 240) / 20); }
    else if (sp.lineRule === 'atLeast') { lineRule.value = 'At least'; lineAt.value = String((sp.line || 240) / 20); }
    else if (sp.line === 360) lineRule.value = '1.5 lines';
    else if (sp.line === 480) lineRule.value = 'Double';
    else if (sp.line && sp.line !== 240) { lineRule.value = 'Multiple'; lineAt.value = String(Math.round((sp.line / 240) * 100) / 100); }
    else lineRule.value = 'Single';
    const special = el('select', {}, ['(none)', 'First line', 'Hanging'].map((o) => el('option', { text: o })));
    const specialBy = el('input', { type: 'number', value: '0.5', step: '0.1', style: { width: '70px' } });
    if (ind.firstLine) { special.value = 'First line'; specialBy.value = String(Math.round((ind.firstLine / 1440) * 100) / 100); }
    else if (ind.hanging) { special.value = 'Hanging'; specialBy.value = String(Math.round((ind.hanging / 1440) * 100) / 100); }
    const ctx = el('input', { type: 'checkbox' }); if (pp.contextualSpacing) ctx.checked = true;
    const inline = (a, label, b) => el('span', {}, [a, el('label', { style: { marginLeft: '8px' } }, [el('span', { text: label }), b])]);
    const body = el('div', {}, [
      row('Alignment:', align),
      row('Indent left (in):', indL), row('Indent right (in):', indR),
      row('Special:', inline(special, ' By (in): ', specialBy)),
      row('Spacing before (pt):', before), row('Spacing after (pt):', after),
      row('Line spacing:', inline(lineRule, ' At: ', lineAt)),
      el('div', { class: 'row' }, [el('label', {}, [ctx, el('span', { text: " Don't add space between paragraphs of the same style" })])]),
    ]);
    function row(label, ctrl) { return el('div', { class: 'row' }, [el('label', { text: label, style: { width: '160px' } }), ctrl]); }
    // line-rule → {line twips/240ths, rule}; Single/1.5/Double = auto presets; At least/Exactly = pt×20; Multiple = ×240.
    const lineSpacing = () => {
      const at = parseFloat(lineAt.value);
      switch (lineRule.value) {
        case '1.5 lines': return { line: 360, rule: 'auto' };
        case 'Double': return { line: 480, rule: 'auto' };
        case 'At least': return { line: Math.round((at || 12) * 20), rule: 'atLeast' };
        case 'Exactly': return { line: Math.round((at || 12) * 20), rule: 'exact' };
        case 'Multiple': return { line: Math.round((at || 1.15) * 240), rule: 'auto' };
        default: return { line: 240, rule: 'auto' }; // Single
      }
    };
    WC.dialog({ title: 'Paragraph', width: '480px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const ls = lineSpacing();
        const by = Math.round((parseFloat(specialBy.value) || 0) * 1440);
        const steps = [
          ['setTextAlign', { Left: 'left', Centered: 'center', Right: 'right', Justified: 'justify' }[align.value]],
          ['updateAttributes', 'paragraph', {
            'paragraphProperties.spacing.before': Math.round((parseFloat(before.value) || 0) * 20),
            'paragraphProperties.spacing.after': Math.round((parseFloat(after.value) || 0) * 20),
            'paragraphProperties.spacing.line': ls.line,
            'paragraphProperties.spacing.lineRule': ls.rule,
            'paragraphProperties.indent.left': Math.round((parseFloat(indL.value) || 0) * 1440),
            'paragraphProperties.indent.right': Math.round((parseFloat(indR.value) || 0) * 1440),
            'paragraphProperties.indent.firstLine': special.value === 'First line' ? by : null,
            'paragraphProperties.indent.hanging': special.value === 'Hanging' ? by : null,
            'paragraphProperties.contextualSpacing': ctx.checked ? true : null,
          }],
        ];
        pm.withSelection(() => pm.chain(steps)); // ONE transaction = ONE undo step (Word)
      } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Word Count ----
  D.wordCount = function () {
    const c = WC.PM.counts();
    const rows = [['Pages', c.pages], ['Words', c.words], ['Characters (no spaces)', c.charsNoSpace], ['Characters (with spaces)', c.chars], ['Paragraphs', c.paras], ['Lines', c.lines]];
    const body = el('div', { class: 'info-props' });
    rows.forEach(([k, v]) => body.appendChild(el('div', { class: 'row', style: { borderBottom: '1px solid #f0f0f0', padding: '5px 0' } }, [el('span', { style: { width: '220px', color: '#444' }, text: k }), el('b', { text: String(v) })])));
    // Parity P1: the include-textboxes checkbox. Counts can't differ in this clone
    // (no textboxes/footnotes content exists outside the body), so toggling is a
    // faithful no-op rather than a stub.
    const inc = el('input', { type: 'checkbox', checked: 'checked' });
    body.appendChild(el('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', fontSize: '12px' } }, [inc, el('span', { text: 'Include textboxes, footnotes and endnotes' })]));
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
        if (v === 'pw') WC.PM.setZoom((document.getElementById('canvas').clientWidth - 40) / 816);
        else if (v === 'wp') WC.PM.setZoom((document.getElementById('canvas').clientHeight - 40) / ((window.WC.PM && window.WC.PM.pageH) || 1056));
        else WC.PM.setZoom(parseFloat(v));
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
    const root = WC.PM.getEditor().view.dom;
    const headings = root.querySelectorAll('h1,h2,h3');
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

  // ---- Selection pane (Home › Editing › Select › Selection Pane) ----
  // Lists the document's objects (pictures, shapes/ink) from WC.PM.listObjects(); a row click selects the object
  // (NodeSelection) and scrolls to it. Toggle-on-reopen like the Navigation pane.
  D.selectionPane = function () {
    let pane = document.getElementById('selection-pane'); if (pane) { pane.remove(); return; }
    pane = el('div', { class: 'taskpane', id: 'selection-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Selection' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body' });
    const objects = (WC.PM.listObjects && WC.PM.listObjects()) || [];
    if (!objects.length) body.appendChild(el('div', { style: { color: '#888', padding: '12px 4px', fontSize: '13px' }, text: 'No objects in this document. Insert a picture or shape to see it here.' }));
    objects.forEach((o) => {
      const row = el('div', { class: 'tp-result', style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } }, [
        el('span', { html: WC.icon(o.type === 'shape' ? 'shapes' : 'pictures', 14) }),
        el('span', { style: { flex: '1' }, text: o.label + (o.floating ? '' : '  (inline)') }),
      ]);
      row.addEventListener('click', () => {
        // o.pos is captured at build time; if the doc changed since, selectObjectAt returns false → rebuild the
        // pane with fresh positions (Word's pane stays live; this is the lightweight equivalent).
        if (WC.PM.selectObjectAt && WC.PM.selectObjectAt(o.pos)) return;
        pane.remove(); D.selectionPane();
      });
      body.appendChild(row);
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
    if (WC.PM.isBlocked('stylesGallery')) { WC.PM.notifyBlocked('Styles'); return; }
    const pm = WC.PM.ready ? WC.PM : null;
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
      // slice 11: WC.Styles (formatting.js) retired — read the PM bridge catalog.
      const styleList = pm ? pm.allStyleNames() : ['Normal'];
      styleList.forEach((s) => {
        const item = el('div', { class: 'sl-item', text: s });
        if (preview) item.setAttribute('style', (STYLE_PREVIEW[s] || '') + ';');
        item.addEventListener('mousedown', (e) => e.preventDefault());
        item.addEventListener('click', () => {
          if (WC.PM.ready && !WC.PM.applyStyleByName(s)) WC.toast('Style “' + s + '” is not available in this document.');
        });
        list.appendChild(item);
      });
    }
    render();
    body.appendChild(previewRow);
    body.appendChild(list);
    const footer = el('div', { style: { display: 'flex', gap: '6px', padding: '10px 0 0', borderTop: '1px solid #eee', marginTop: '8px' } }, [
      el('button', { class: 'btn', text: 'New Style', onclick: () => { D.createStyle(); } }),
      el('button', { class: 'btn', text: 'Clear All', onclick: () => { if (WC.PM.ready && !WC.PM.applyStyleByName('Normal')) WC.toast('Style “Normal” is not available in this document.'); } }),
    ]);
    body.appendChild(footer);
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };

  // ---- Create a Style (custom style from the current selection's formatting) ----
  D.createStyle = function () {
    if (WC.PM.isBlocked && WC.PM.isBlocked('stylesGallery')) { WC.PM.notifyBlocked('Styles'); return; }
    WC.PM.captureSelection(); // the dialog steals focus; restore before minting
    const nameInput = el('input', { type: 'text', class: 'grow', placeholder: 'Name your style', value: 'Style 1' });
    const body = el('div', {}, [
      el('div', { style: { fontSize: '12px', color: '#444', marginBottom: '8px' }, text: 'Create a new style from the current selection’s formatting.' }),
      el('div', { class: 'row' }, [el('label', { text: 'Name:', style: { width: '60px' } }), nameInput]),
    ]);
    WC.dialog({ title: 'Create New Style from Formatting', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const name = (nameInput.value || '').trim();
        if (!name) { WC.toast('Enter a style name.'); return true; } // truthy → keep the dialog open
        let r;
        WC.PM.withSelection(() => { r = WC.PM.createNamedStyle(name); });
        // The Quick Styles ribbon gallery is curated to built-in names, so a custom style is reached via Apply
        // Styles / the Styles pane (both list it through allStyleNames) — no ribbon refresh needed.
        if (r && r.ok) WC.toast('Created style “' + (r.name || name) + '”', 'Apply it from Styles ▸ Apply Styles.');
        else WC.toast('Could not create the style.');
      } },
      { label: 'Cancel' },
    ] });
    setTimeout(() => { try { nameInput.focus(); nameInput.select(); } catch (e) {} }, 30);
  };

  // Apply Styles combo (Ctrl+Shift+S)
  D.applyStyles = function () {
    const pm2 = WC.PM.ready ? WC.PM : null;
    const dl = el('datalist', { id: 'apply-styles-list' }, (pm2 ? pm2.allStyleNames() : []).map((s) => el('option', { value: s })));
    const input = el('input', { type: 'text', class: 'grow', list: 'apply-styles-list', placeholder: 'Style name' });
    const body = el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Style Name:', style: { width: '90px' } }), input, dl])]);
    WC.dialog({ title: 'Apply Styles', width: '360px', body, footer: [
      { label: 'Apply', primary: true, onClick: () => { if (input.value.trim() && pm2) pm2.applyStyleByName(input.value.trim()); } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Font dialog (Ctrl+D / Font group launcher) ----
  D.font = function () {
    const pm = WC.PM;
    if (pm.ready) pm.captureSelection(); // the dialog steals focus; restore before applying
    const st = pm.getState();
    let colorVal = '';
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

    // 015: prefill the five advanced effects from the current run state (FR-006).
    const fx = pm.ready ? pm.getAdvancedFontEffects() : { allCaps: false, smallCaps: false, spacingPt: null, positionPt: null, scalePct: null };
    if (fx.smallCaps) small.c.checked = true;
    if (fx.allCaps) allc.c.checked = true;
    // Preserve a non-preset scale (e.g. an imported 120%) — add it as an option so OK doesn't
    // silently clear it (the dialog always re-applies the control state).
    if (fx.scalePct != null && fx.scalePct !== 100) {
      if (!Array.from(scale.options).some((o) => o.value === String(fx.scalePct))) scale.appendChild(el('option', { value: String(fx.scalePct), text: fx.scalePct + '%' }));
      scale.value = String(fx.scalePct);
    }
    if (fx.spacingPt != null && fx.spacingPt !== 0) { spacing.value = fx.spacingPt > 0 ? 'Expanded' : 'Condensed'; spacingBy.value = String(Math.abs(fx.spacingPt)); }
    if (fx.positionPt != null && fx.positionPt !== 0) { position.value = fx.positionPt > 0 ? 'Raised' : 'Lowered'; positionBy.value = String(Math.abs(fx.positionPt)); }

    const previewSpan = el('span', { text: 'AaBbCc — The quick brown fox' });
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
        // RB-009: apply size via textStyle.fontSize (NO-FORK) honouring Word's 1–1638 range,
        // not the fork setFontSize 8–96 clamp — consistent with the ribbon combo (setFontSizePt).
        const szPt = Math.min(1638, Math.max(1, parseFloat(size.value) || 11));
        // 015: the five Advanced-tab effects apply in the SAME setMark (one undo step); each is
        // set-or-cleared from its control. Normal/100% clears the property (no stale carryover).
        const spPt = spacing.value === 'Normal' ? 0 : (spacing.value === 'Expanded' ? 1 : -1) * (parseFloat(spacingBy.value) || 1);
        const poPt = position.value === 'Normal' ? 0 : (position.value === 'Raised' ? 1 : -1) * (parseFloat(positionBy.value) || 3);
        const advFx = pm.advFxAttrs({ allCaps: allc.c.checked, smallCaps: small.c.checked, spacingPt: spPt, positionPt: poPt, scalePct: parseInt(scale.value, 10) });
        const steps = [['setFontFamily', fam.value], ['setMark', 'textStyle', Object.assign({ fontSize: szPt + 'pt' }, advFx)]];
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
        // vertAlign must be written UNCONDITIONALLY (setMark merges attrs; an absent key leaves the stale value).
        // null clears it — otherwise unchecking BOTH Superscript & Subscript can't remove an existing sub/superscript.
        steps.push(['setMark', 'textStyle', { vertAlign: sup.c.checked ? 'superscript' : (sub.c.checked ? 'subscript' : null) }]);
        pm.withSelection(() => pm.chain(steps)); // ONE transaction = ONE undo step (matches Word)
        // 015: the five advanced effects are now applied above (no more notifyBlocked).
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
    const select = (i) => { chosen = i; list.querySelectorAll('li').forEach((n, j) => n.classList.toggle('selected', j === chosen)); };
    list.addEventListener('click', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      select(Array.from(list.children).indexOf(li));
    });
    const body = el('div', {}, [
      el('div', { class: 'row', text: 'As:' }),
      options.length ? list : el('div', { text: 'The Clipboard is empty.' }),
    ]);
    const handle = WC.dialog({ title: 'Paste Special', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: doPaste },
      { label: 'Cancel' },
    ] });
    const okAndClose = () => { doPaste(); handle.close(); }; // Word: dblclick / Enter = OK
    list.addEventListener('dblclick', (e) => { if (e.target.closest('li')) okAndClose(); });
    // Keyboard: arrow to move the selection, Enter/Space to apply the focused row.
    list.addEventListener('keydown', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      const i = Array.from(list.children).indexOf(li);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); okAndClose(); }
      else if (e.key === 'ArrowDown' && list.children[i + 1]) { e.preventDefault(); list.children[i + 1].focus(); select(i + 1); }
      else if (e.key === 'ArrowUp' && list.children[i - 1]) { e.preventDefault(); list.children[i - 1].focus(); select(i - 1); }
    });
  };

  // ---- Set Default Paste (PM-only) ----
  // Word's Options→Advanced cut/copy/paste has several knobs; the clone ships the
  // primary "default paste" mode that plain Paste (Ctrl+V / the split-button main
  // face) honors. Persisted to localStorage; read by the bridge's defaultPasteMode.
  D.setDefaultPaste = function () {
    const KEY = 'wc.defaultPaste';
    const MODES = [
      ['keepSource', 'Keep Source Formatting (Default)'],
      ['merge', 'Match Formatting'],
      ['text', 'Keep Text Only'],
    ];
    let current = 'keepSource';
    try { current = localStorage.getItem(KEY) || 'keepSource'; } catch (e) { /* no storage */ }
    let chosen = Math.max(0, MODES.findIndex(([id]) => id === current));
    const list = el('ul', { class: 'ps-list' }, MODES.map(([id, label], i) =>
      el('li', { class: 'ps-item' + (i === chosen ? ' selected' : ''), text: label, tabindex: '0', dataset: { mode: id } })));
    const select = (i) => { chosen = i; list.querySelectorAll('li').forEach((n, j) => n.classList.toggle('selected', j === chosen)); };
    list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) select(Array.from(list.children).indexOf(li)); });
    const body = el('div', {}, [
      el('div', { class: 'row', text: 'Pasting (plain Paste / Ctrl+V) uses:' }),
      list,
    ]);
    const apply = () => {
      try { localStorage.setItem(KEY, MODES[chosen][0]); } catch (e) { /* no storage */ }
      WC.toast('Default paste set to “' + MODES[chosen][1].replace(' (Default)', '') + '”.');
    };
    const handle = WC.dialog({ title: 'Set Default Paste', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: apply },
      { label: 'Cancel' },
    ] });
    list.addEventListener('dblclick', (e) => { if (e.target.closest('li')) { apply(); handle.close(); } });
    list.addEventListener('keydown', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      const i = Array.from(list.children).indexOf(li);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); apply(); handle.close(); }
      else if (e.key === 'ArrowDown' && list.children[i + 1]) { e.preventDefault(); list.children[i + 1].focus(); select(i + 1); }
      else if (e.key === 'ArrowUp' && list.children[i - 1]) { e.preventDefault(); list.children[i - 1].focus(); select(i - 1); }
    });
  };

  // ---- Editor / Proofing pane ----
  // Real offline proofing via window.WC.Proofing (src/renderer/proofing/proofing.ts):
  // nspell + a vendored SCOWL en_US Hunspell dictionary for spelling, mechanical rules
  // for grammar, and heuristic refinements (Clarity/Conciseness). The ML Editor Score,
  // Similarity, Insights and Formality/Punctuation/Resume/Vocabulary refinements need
  // the Microsoft 365 cloud Editor and stay honestly flagged (deferrals.md §B).
  // Replacements go through PM transactions (a direct nodeValue write would desync the
  // model from the view), mapped back to exact doc positions via scanModel().
  D.editorPane = function () {
    let pane = document.getElementById('editor-pane'); if (pane) { pane.remove(); return; }
    document.querySelectorAll('.taskpane.right').forEach((p) => p.remove()); // C11: right-dock panes replace each other
    pane = el('div', { class: 'taskpane right', id: 'editor-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Editor' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body' });
    const root = () => WC.PM.getEditor().view.dom;
    const ignoredSp = D._ignoredSpelling || (D._ignoredSpelling = {});
    const ignoredGr = D._ignoredGrammar || (D._ignoredGrammar = {});
    const P = () => WC.Proofing;

    // Flatten the doc to text with a char-index → PM-position map (\n between blocks so
    // a grammar span never crosses a paragraph). Replacements use exact positions.
    function scanModel() {
      const ed = WC.PM.getEditor(); const segs = []; let full = '';
      ed.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) { segs.push({ s: full.length, from: pos, len: node.text.length }); full += node.text; }
        else if (node.isBlock && full.length && !full.endsWith('\n')) { full += '\n'; }
        return true;
      });
      const pmPosOf = (idx) => { for (let i = 0; i < segs.length; i++) { const g = segs[i]; if (idx >= g.s && idx <= g.s + g.len) return g.from + (idx - g.s); } return null; };
      return { full, pmPosOf };
    }
    function replaceAt(from, length, repl) {
      if (from == null) return;
      const ed = WC.PM.getEditor();
      ed.view.dispatch(ed.state.tr.insertText(repl, from, from + length));
    }
    function card(title, color, message, actions) {
      const c = el('div', { style: { border: '1px solid #e1dfdd', borderRadius: '4px', padding: '8px', marginBottom: '8px' } });
      c.appendChild(el('div', {}, [el('span', { style: { textDecoration: 'underline wavy ' + color, color, fontWeight: '600' }, text: title })]));
      if (message) c.appendChild(el('div', { style: { fontSize: '12px', color: '#666', margin: '4px 0' }, text: message }));
      const wrap = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' } });
      actions.forEach((a) => { const b = el('button', { class: 'btn', text: a.label }); b.addEventListener('click', a.onClick); wrap.appendChild(b); });
      c.appendChild(wrap); body.appendChild(c);
    }
    function render() {
      body.innerHTML = '';
      if (!P() || !P().isReady()) {
        body.appendChild(el('div', { style: { textAlign: 'center', padding: '34px 0', color: '#888' }, text: 'Checking spelling and grammar…' }));
        if (P()) P().ensureReady().then(() => { if (document.getElementById('editor-pane')) render(); });
        return;
      }
      const { full, pmPosOf } = scanModel();
      const spelling = P().spellCheck(full).filter((s) => !ignoredSp[s.word.toLowerCase()]);
      const grammar = P().grammarCheck(full).filter((g) => !ignoredGr[g.kind + ':' + g.text]);
      const refine = P().refineCheck(full);
      const corrections = spelling.length + grammar.length;
      const score = corrections === 0 && refine.length === 0 ? 100 : Math.max(40, 100 - spelling.length * 8 - grammar.length * 5 - refine.length * 2);
      body.appendChild(el('div', { style: { textAlign: 'center', padding: '8px 0 4px' } }, [
        el('div', { style: { fontSize: '30px', fontWeight: '700', color: corrections ? '#b85c00' : 'var(--word-blue)' }, text: score + '%' }),
        el('div', { style: { color: '#444', fontWeight: '600' }, text: 'Editor Score' }),
        el('div', { style: { fontSize: '11px', color: '#888', margin: '2px 0 6px' }, text: 'Local spelling, grammar & style. Cloud refinements need Microsoft 365.' }),
      ]));
      const section = (t) => body.appendChild(el('div', { style: { fontWeight: '600', margin: '12px 0 4px', fontSize: '12px' }, text: t }));
      const row = (label, badge, opts) => {
        opts = opts || {};
        const r = el('div', { class: 'tp-result', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: opts.disabled ? '.55' : '1' } }, [
          el('span', { text: label }),
          el('b', { text: badge, style: { color: badge === '✓' ? '#107C10' : (opts.disabled ? '#888' : '#b85c00') } }),
        ]);
        if (opts.disabled) r.title = 'Requires the Microsoft 365 cloud Editor service — not available in this clone.';
        body.appendChild(r);
      };
      const clarity = refine.filter((r) => r.category === 'Clarity');
      const concise = refine.filter((r) => r.category === 'Conciseness');
      section('Corrections');
      row('Spelling', spelling.length ? String(spelling.length) : '✓');
      row('Grammar', grammar.length ? String(grammar.length) : '✓');
      section('Refinements');
      row('Clarity', clarity.length ? String(clarity.length) : '✓');
      row('Conciseness', concise.length ? String(concise.length) : '✓');
      ['Formality', 'Punctuation Conventions', 'Vocabulary'].forEach((t) => row(t, '—', { disabled: true }));
      section('Similarity');
      row('Similarity check', '—', { disabled: true });

      if (spelling.length) {
        section('Spelling');
        spelling.forEach((iss) => {
          const acts = iss.suggestions.map((s) => ({ label: s, onClick: () => { replaceAt(pmPosOf(iss.index), iss.word.length, s); render(); } }));
          acts.push({ label: 'Ignore All', onClick: () => { ignoredSp[iss.word.toLowerCase()] = true; render(); } });
          acts.push({ label: 'Add to Dictionary', onClick: () => { P().add(iss.word); render(); } });
          card(iss.word, '#d13438', iss.suggestions.length ? 'Spelling' : 'No suggestions', acts);
        });
      }
      if (grammar.length) {
        section('Grammar');
        grammar.forEach((iss) => {
          const acts = [];
          if (iss.suggestion != null) acts.push({ label: 'Change to “' + iss.suggestion + '”', onClick: () => { replaceAt(pmPosOf(iss.index), iss.length, iss.suggestion); render(); } });
          acts.push({ label: 'Ignore', onClick: () => { ignoredGr[iss.kind + ':' + iss.text] = true; render(); } });
          card(iss.text.replace(/\n/g, '¶'), '#0F6CBD', iss.message, acts);
        });
      }
      if (refine.length) {
        section('Refinement suggestions');
        refine.forEach((iss) => {
          const acts = [];
          if (iss.suggestion != null) acts.push({ label: 'Change to “' + iss.suggestion + '”', onClick: () => { replaceAt(pmPosOf(iss.index), iss.length, iss.suggestion); render(); } });
          card(iss.text, '#6a5acd', iss.message, acts);
        });
      }
      const on = root().getAttribute('spellcheck') !== 'false';
      const cbk = el('input', { type: 'checkbox' }); cbk.checked = on;
      cbk.addEventListener('change', () => root().setAttribute('spellcheck', cbk.checked ? 'true' : 'false'));
      body.appendChild(el('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '14px', fontSize: '12px' } }, [cbk, el('span', { text: 'Check spelling as you type' })]));
    }
    render();
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };

  // ---- Review dialogs (slice 8 task 6: D8.5–D8.7 / T3 / T18 / T19 / X2 / X3) ----
  // Lock state lives at WC level (not the engine): Word's lock is a UI gate over the
  // toggle ("not a security feature" — honored literally), enforced by H.trackChanges.
  WC.pmTrackLock = WC.pmTrackLock || { locked: false, password: '' };
  const pmActive = () => (WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null);

  // T3: Lock Tracking dialog (password pair). Re-invoking while locked = unlock flow.
  D.lockTracking = function () {
    if (WC.pmTrackLock.locked) return D.unlockTracking();
    const pw = el('input', { type: 'password', class: 'grow' });
    const pw2 = el('input', { type: 'password', class: 'grow' });
    const err = el('div', { style: { color: '#A4262C', fontSize: '12px', minHeight: '16px', marginTop: '4px' } });
    const body = el('div', {}, [
      el('div', { text: 'Prevent other authors from turning off Track Changes.', style: { marginBottom: '10px' } }),
      el('div', { class: 'row' }, [el('label', { text: 'Enter password (optional):', style: { width: '170px' } }), pw]),
      el('div', { class: 'row' }, [el('label', { text: 'Reenter to confirm:', style: { width: '170px' } }), pw2]),
      err,
      el('div', { text: '(This is not a security feature.)', style: { fontSize: '12px', color: '#666', marginTop: '6px' } }),
    ]);
    WC.dialog({ title: 'Lock Tracking', width: '430px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        if (pw.value !== pw2.value) { err.textContent = 'The passwords don’t match. Please reenter.'; return true; }
        WC.pmTrackLock.locked = true; WC.pmTrackLock.password = pw.value;
        const pm = pmActive();
        if (pm && !pm.reviewState().tracking) pm.cmd('enableTrackChanges'); // Word: locking turns tracking ON
        WC.toast('Track Changes is locked.');
      } },
      { label: 'Cancel' },
    ] });
  };
  D.unlockTracking = function () {
    const pw = el('input', { type: 'password', class: 'grow' });
    const err = el('div', { style: { color: '#A4262C', fontSize: '12px', minHeight: '16px', marginTop: '4px' } });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Password:', style: { width: '90px' } }), pw]),
      err,
    ]);
    WC.dialog({ title: 'Unlock Tracking', width: '380px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        if ((WC.pmTrackLock.password || '') !== pw.value) { err.textContent = 'The password is incorrect.'; return true; }
        WC.pmTrackLock.locked = false; WC.pmTrackLock.password = '';
        WC.toast('Track Changes is unlocked.');
      } },
      { label: 'Cancel' },
    ] });
  };

  // T18: Track Changes Options (Markup-group dialog launcher). Wired to settings the
  // clone actually consumes: the Show toggles drive WC.pmMarkup + the #pm-editor
  // classes (same latches as the Show Markup menu), the balloons combo drives the
  // T10 mode, the pane combo drives the Revisions-pane orientation.
  D.trackChangesOptions = function () {
    const mk = WC.pmMarkup || (WC.pmMarkup = { insDel: true, formatting: true, balloons: 'formatting' });
    const page = () => document.getElementById('pm-editor');
    const mkCb = (label, checked, disabled) => {
      const c = el('input', Object.assign({ type: 'checkbox' }, checked ? { checked: 'checked' } : {}));
      if (disabled) { c.disabled = true; }
      const lab = el('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', margin: '3px 0', opacity: disabled ? '.55' : '1' } }, [c, el('span', { text: label })]);
      if (disabled) lab.title = 'Not available in this clone (cloud/co-authoring).';
      return { c, lab };
    };
    const ink = mkCb('Ink', !(page() && page().classList.contains('pm-hide-ink')));
    const insdel = mkCb('Insertions and Deletions', mk.insDel !== false);
    const fmt = mkCb('Formatting', mk.formatting !== false);
    const hl = mkCb('Highlight Updates', false, true);
    const oa = mkCb('Other Authors', false, true);
    const balloons = el('select', { class: 'grow' }, [['Comments and formatting', 'formatting'], ['Revisions', 'revisions'], ['Nothing', 'inline']].map(([l, v]) => el('option', { text: l, value: v, selected: mk.balloons === v ? 'selected' : undefined })));
    const paneSel = el('select', { class: 'grow' }, [['Vertical', 'vertical'], ['Horizontal', 'horizontal']].map(([l, v]) => el('option', { text: l, value: v })));
    const group = el('div', { style: { border: '1px solid #e1dfdd', borderRadius: '4px', padding: '8px 10px', marginBottom: '10px' } }, [
      el('div', { style: { fontWeight: '600', marginBottom: '4px' }, text: 'Show' }),
      ink.lab, insdel.lab, fmt.lab, hl.lab, oa.lab,
    ]);
    const body = el('div', {}, [
      group,
      el('div', { class: 'row' }, [el('label', { text: 'Balloons in All Markup view show:', style: { width: '210px' } }), balloons]),
      el('div', { class: 'row' }, [el('label', { text: 'Reviewing Pane:', style: { width: '210px' } }), paneSel]),
      el('div', { class: 'row', style: { marginTop: '10px', gap: '8px' } }, [
        el('button', { class: 'btn', text: 'Advanced Options…', onclick: () => D.advancedTrackChangesOptions() }),
        el('button', { class: 'btn', text: 'Change User Name…', onclick: () => D.changeUserName() }),
      ]),
    ]);
    WC.dialog({ title: 'Track Changes Options', width: '440px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        mk.insDel = insdel.c.checked; mk.formatting = fmt.c.checked; mk.balloons = balloons.value;
        const p = page();
        if (p) {
          p.classList.toggle('pm-hide-insdel', !mk.insDel);
          p.classList.toggle('pm-hide-format', !mk.formatting);
          p.classList.toggle('pm-hide-ink', !ink.c.checked);
        }
        if (WC.TrackChrome && WC.TrackChrome.setOrientation) WC.TrackChrome.setOrientation(paneSel.value);
        if (WC.TrackChrome && WC.TrackChrome.refresh) WC.TrackChrome.refresh();
      } },
      { label: 'Cancel' },
    ] });
  };

  // T19: Advanced Track Changes Options. CONSUMED settings: insertions/deletions
  // mark style + color (CSS vars + .wc-track-custom on #pm-editor) and balloon
  // width (--wc-balloon-width). Everything else renders Word's defaults DISABLED —
  // honesty over stubs: an enabled control that silently does nothing would lie.
  D.advancedTrackChangesOptions = function () {
    const page = () => document.getElementById('pm-editor');
    const DECOS = [['(none)', 'none'], ['Color only', 'color'], ['Bold', 'bold'], ['Italic', 'italic'], ['Underline', 'underline'], ['Double underline', 'double-underline'], ['Strikethrough', 'strikethrough']];
    const COLORS = [['By author', ''], ['Auto', 'inherit'], ['Red', '#c00000'], ['Blue', '#0070c0'], ['Green', '#107c10'], ['Violet', '#7030a0'], ['Dark Red', '#7f1d1d'], ['Teal', '#008080']];
    const sel = (opts, cur) => el('select', { class: 'grow' }, opts.map(([l, v]) => el('option', { text: l, value: v, selected: v === cur ? 'selected' : undefined })));
    const cur = D._advTrack || (D._advTrack = { insDeco: 'underline', insColor: '', delDeco: 'strikethrough', delColor: '', balloonIn: 3.2 });
    const insDeco = sel(DECOS, cur.insDeco); const insColor = sel(COLORS, cur.insColor);
    const delDeco = sel(DECOS, cur.delDeco); const delColor = sel(COLORS, cur.delColor);
    const balloonW = el('input', { type: 'number', value: String(cur.balloonIn), min: '2', max: '6', step: '0.1', style: { width: '70px' } });
    const dis = (node) => { node.disabled = true; node.title = 'Fixed at Word’s default in this clone.'; return node; };
    const row = (label, ctl, ctl2) => el('div', { class: 'row' }, [el('label', { text: label, style: { width: '150px' } }), ctl].concat(ctl2 ? [ctl2] : []));
    const sec = (t) => el('div', { style: { fontWeight: '600', margin: '8px 0 4px' }, text: t });
    const body = el('div', {}, [
      sec('Markup'),
      row('Insertions:', insDeco, insColor),
      row('Deletions:', delDeco, delColor),
      row('Changed lines:', dis(sel([['Outside border', 'outside']], 'outside'))),
      sec('Moves'),
      row('Moved from:', dis(sel([['Double strikethrough', 'ds']], 'ds')), dis(sel([['Green', 'g']], 'g'))),
      row('Moved to:', dis(sel([['Double underline', 'du']], 'du')), dis(sel([['Green', 'g']], 'g'))),
      sec('Table cell highlighting'),
      row('Inserted cells:', dis(sel([['Light Blue', 'lb']], 'lb')), dis(sel([['Deleted cells: Pink', 'p']], 'p'))),
      sec('Formatting'),
      row('Track formatting:', dis(sel([['By author', 'ba']], 'ba'))),
      sec('Balloons'),
      row('Preferred width:', balloonW, el('span', { text: ' Inches', style: { color: '#666', fontSize: '12px' } })),
      row('Paper orientation:', dis(sel([['Preserve', 'p']], 'p'))),
    ]);
    WC.dialog({ title: 'Advanced Track Changes Options', width: '470px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        Object.assign(cur, { insDeco: insDeco.value, insColor: insColor.value, delDeco: delDeco.value, delColor: delColor.value, balloonIn: parseFloat(balloonW.value) || 3.2 });
        const p = page(); if (!p) return;
        const decoLine = (d, def) => (d === 'underline' ? 'underline' : d === 'double-underline' ? 'underline double' : d === 'strikethrough' ? 'line-through' : d === 'none' || d === 'color' || d === 'bold' || d === 'italic' ? 'none' : def);
        p.classList.add('wc-track-custom');
        p.style.setProperty('--wc-track-ins-line', decoLine(cur.insDeco, 'underline'));
        p.style.setProperty('--wc-track-ins-weight', cur.insDeco === 'bold' ? '700' : 'inherit');
        p.style.setProperty('--wc-track-ins-fontstyle', cur.insDeco === 'italic' ? 'italic' : 'inherit');
        p.style.setProperty('--wc-track-ins-color', cur.insColor || 'inherit');
        p.style.setProperty('--wc-track-del-line', decoLine(cur.delDeco, 'line-through'));
        p.style.setProperty('--wc-track-del-weight', cur.delDeco === 'bold' ? '700' : 'inherit');
        p.style.setProperty('--wc-track-del-fontstyle', cur.delDeco === 'italic' ? 'italic' : 'inherit');
        p.style.setProperty('--wc-track-del-color', cur.delColor || 'inherit');
        document.documentElement.style.setProperty('--wc-balloon-width', Math.round(cur.balloonIn * 96) + 'px');
        if (WC.TrackChrome && WC.TrackChrome.refresh) WC.TrackChrome.refresh();
      } },
      { label: 'Cancel' },
    ] });
  };

  // T18 "Change User Name…": the identity stamped as w:author on tracked changes and
  // creatorName on comment cards. Live via editor.setOptions; persisted for relaunch
  // (create-editor.ts reads wc-author-name on every construction).
  D.changeUserName = function () {
    let curName = 'Word User'; let curIni = '';
    try { curName = localStorage.getItem('wc-author-name') || 'Word User'; curIni = localStorage.getItem('wc-author-initials') || ''; } catch (e) { /* storage unavailable */ }
    if (!curIni) curIni = curName.split(/\s+/).map((w) => w[0] || '').join('').slice(0, 3).toUpperCase();
    const name = el('input', { type: 'text', class: 'grow', value: curName });
    const ini = el('input', { type: 'text', value: curIni, style: { width: '70px' } });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'User name:', style: { width: '90px' } }), name]),
      el('div', { class: 'row' }, [el('label', { text: 'Initials:', style: { width: '90px' } }), ini]),
      el('div', { text: 'Used for tracked changes and comments.', style: { fontSize: '12px', color: '#666', marginTop: '6px' } }),
    ]);
    WC.dialog({ title: 'Change User Name', width: '380px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const n = name.value.trim() || 'Word User';
        try { localStorage.setItem('wc-author-name', n); localStorage.setItem('wc-author-initials', ini.value.trim()); } catch (e) { /* storage unavailable */ }
        const pm = pmActive();
        if (pm) { const ed = pm.getEditor(); try { ed.setOptions({ user: { name: n, email: '' } }); } catch (e) { /* applies on next launch */ } }
        WC.toast('User name updated: ' + n);
      } },
      { label: 'Cancel' },
    ] });
  };

  // X3: Restrict Editing pane. Enforcement re-points the clone's read-only toggle at
  // the PM engine (setEditable) — "Tracked changes" mode = tracking ON + locked.
  D.restrictEditingPane = function () {
    let pane = document.getElementById('restrict-pane'); if (pane) { pane.remove(); return; }
    document.querySelectorAll('.taskpane.right').forEach((p) => p.remove());
    pane = el('div', { class: 'taskpane right', id: 'restrict-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Restrict Editing' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body' });
    const enforced = () => { const p = pmActive(); try { return p ? p.getEditor().view.editable === false : false; } catch (e) { return false; } };
    function render() {
      body.innerHTML = '';
      const sec = (t) => el('div', { style: { fontWeight: '600', margin: '10px 0 4px' }, text: t });
      body.appendChild(sec('1. Formatting restrictions'));
      const fmtCb = el('input', { type: 'checkbox' }); fmtCb.disabled = true;
      body.appendChild(el('label', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start', opacity: '.55' }, title: 'Style-set restrictions are not implemented in this clone.' }, [fmtCb, el('span', { text: 'Limit formatting to a selection of styles' })]));
      body.appendChild(sec('2. Editing restrictions'));
      const editCb = el('input', { type: 'checkbox', checked: 'checked' });
      body.appendChild(el('label', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start' } }, [editCb, el('span', { text: 'Allow only this type of editing in the document:' })]));
      const mode = el('select', { class: 'grow', style: { margin: '4px 0 0 22px', width: 'calc(100% - 22px)' } }, [
        el('option', { text: 'No changes (Read only)', value: 'readonly' }),
        el('option', { text: 'Tracked changes', value: 'tracked' }),
        el('option', { text: 'Comments', value: 'comments' }),
        el('option', { text: 'Filling in forms', value: 'forms' }),
      ]);
      Array.from(mode.options).forEach((o) => { if (o.value === 'comments' || o.value === 'forms') { o.disabled = true; } });
      body.appendChild(mode);
      body.appendChild(sec('3. Start enforcement'));
      if (!enforced()) {
        const start = el('button', { class: 'btn primary', id: 'wc-restrict-start', text: 'Yes, Start Enforcing Protection' });
        start.disabled = !editCb.checked;
        editCb.addEventListener('change', () => { start.disabled = !editCb.checked; mode.disabled = !editCb.checked; });
        start.addEventListener('click', () => {
          const p = pmActive();
          if (mode.value === 'tracked') {
            if (p) { if (!p.reviewState().tracking) p.cmd('enableTrackChanges'); }
            WC.pmTrackLock.locked = true;
            WC.toast('Protection started: all edits are tracked.');
          } else if (p) {
            try { p.getEditor().setEditable(false, false); } catch (e) { /* engine unavailable */ }
            WC.toast('Protection started: the document is read-only.');
          }
          render();
        });
        body.appendChild(start);
      } else {
        body.appendChild(el('div', { style: { color: '#A4262C', margin: '4px 0 8px', fontSize: '12px' }, text: 'This document is protected (read-only).' }));
        const stop = el('button', { class: 'btn', id: 'wc-restrict-stop', text: 'Stop Protection' });
        stop.addEventListener('click', () => {
          const p = pmActive();
          if (p) { try { p.getEditor().setEditable(true, false); } catch (e) { /* engine unavailable */ } }
          render();
        });
        body.appendChild(stop);
      }
      if (WC.pmTrackLock.locked) {
        body.appendChild(el('div', { style: { color: '#666', marginTop: '8px', fontSize: '12px' }, text: 'Track Changes is locked — edits are recorded as tracked changes.' }));
        const unlock = el('button', { class: 'btn', text: 'Stop Tracking Protection', style: { marginTop: '4px' } });
        unlock.addEventListener('click', () => { D.unlockTracking(); setTimeout(render, 300); });
        body.appendChild(unlock);
      }
    }
    render();
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };

  // X2/D8.6: Compare Documents — full dialog parity; the engine (PM.runCompare)
  // replays original→revised as REAL fork tracked changes. Word opens the result as
  // a new document; this single-doc clone REPLACES the current doc (recorded
  // deviation) — confirmDiscard is the consent gate, and the result is UNBOUND from
  // any file path (the §5.3 lesson: Ctrl+S must never write a diff over the source).
  D.compareDocuments = function (mode) {
    const combine = mode === 'combine';
    const htmlToText = (html) => { const d = document.createElement('div'); d.innerHTML = html; return (d.innerText || '').replace(/ /g, ' '); };
    const currentText = () => WC.PM.getText();
    const mkSource = (labelText) => {
      const selEl = el('select', { class: 'grow' }, [
        el('option', { text: '(Current document)', value: 'current' }),
        el('option', { text: 'Browse for a file…', value: 'browse' }),
      ]);
      const fileLabel = el('span', { text: '', style: { fontSize: '11px', color: '#666', marginLeft: '6px' } });
      const file = el('input', { type: 'file' }); file.accept = '.txt,.text,.htm,.html'; file.style.display = 'none';
      let fileText = null;
      file.addEventListener('change', () => {
        const f = file.files && file.files[0]; if (!f) { selEl.value = 'current'; return; }
        const r = new FileReader();
        r.onload = () => { fileText = /\.html?$/i.test(f.name) ? htmlToText(String(r.result)) : String(r.result); fileLabel.textContent = f.name; };
        r.readAsText(f);
      });
      selEl.addEventListener('change', () => { if (selEl.value === 'browse') file.click(); else { fileText = null; fileLabel.textContent = ''; } });
      return {
        node: el('div', { style: { flex: '1' } }, [
          el('div', { text: labelText, style: { fontWeight: '600', margin: '2px 0 4px' } }),
          el('div', { class: 'row' }, [selEl, fileLabel, file]),
        ]),
        get: () => (selEl.value === 'browse' && fileText != null ? fileText : currentText()),
      };
    };
    const orig = mkSource(combine ? 'Original document' : 'Original document');
    const rev = mkSource(combine ? 'Revised document' : 'Revised document');
    let authorName = 'Word User';
    try { authorName = localStorage.getItem('wc-author-name') || 'Word User'; } catch (e) { /* default stands */ }
    const label = el('input', { type: 'text', class: 'grow', value: authorName });
    const more = el('div', { style: { display: 'none', borderTop: '1px solid #e1dfdd', marginTop: '10px', paddingTop: '8px' } });
    const cmpSettings = ['Insertions and deletions', 'Moves', 'Comments', 'Formatting', 'Case changes', 'White space', 'Tables', 'Headers and footers', 'Footnotes and endnotes', 'Textboxes', 'Fields'];
    const settingsGrid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' } });
    cmpSettings.forEach((s, i) => {
      const c = el('input', { type: 'checkbox', checked: 'checked' });
      c.disabled = true;
      const lab = el('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', opacity: i === 0 ? '1' : '.55' }, title: i === 0 ? 'Always compared.' : 'Word-level text comparison only in this clone.' }, [c, el('span', { text: s })]);
      settingsGrid.appendChild(lab);
    });
    const granWord = el('input', { type: 'radio', name: 'cmpGran', checked: 'checked' });
    const granChar = el('input', { type: 'radio', name: 'cmpGran' });
    const showNew = el('input', { type: 'radio', name: 'cmpShow', checked: 'checked' });
    const showO = el('input', { type: 'radio', name: 'cmpShow' }); showO.disabled = true;
    const showR = el('input', { type: 'radio', name: 'cmpShow' }); showR.disabled = true;
    more.appendChild(el('div', { style: { fontWeight: '600', marginBottom: '4px' }, text: 'Comparison settings' }));
    more.appendChild(settingsGrid);
    more.appendChild(el('div', { style: { fontWeight: '600', margin: '8px 0 4px' }, text: 'Show changes' }));
    more.appendChild(el('div', { class: 'row', style: { gap: '14px' } }, [
      el('span', { text: 'Show changes at:', style: { fontSize: '12px' } }),
      el('label', { style: { display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px' } }, [granChar, el('span', { text: 'Character level' })]),
      el('label', { style: { display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px' } }, [granWord, el('span', { text: 'Word level' })]),
    ]));
    more.appendChild(el('div', { class: 'row', style: { gap: '14px' } }, [
      el('span', { text: 'Show changes in:', style: { fontSize: '12px' } }),
      el('label', { style: { display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px', opacity: '.55' } }, [showO, el('span', { text: 'Original document' })]),
      el('label', { style: { display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px', opacity: '.55' } }, [showR, el('span', { text: 'Revised document' })]),
      el('label', { style: { display: 'flex', gap: '4px', alignItems: 'center', fontSize: '12px' } }, [showNew, el('span', { text: 'New document' })]),
    ]));
    more.appendChild(el('div', { text: 'The result opens as a new unsaved document in this clone.', style: { fontSize: '11px', color: '#666', marginTop: '4px' } }));
    const moreBtn = el('button', { class: 'btn', text: 'More >>' });
    moreBtn.addEventListener('click', () => { const open = more.style.display !== 'none'; more.style.display = open ? 'none' : 'block'; moreBtn.textContent = open ? 'More >>' : '<< Less'; });
    const body = el('div', {}, [
      el('div', { text: combine ? 'Combine revisions from multiple authors into a single document.' : 'Compare two versions of a document (legal blackline).', style: { fontSize: '12px', color: '#666', marginBottom: '8px' } }),
      el('div', { style: { display: 'flex', gap: '16px' } }, [orig.node, rev.node]),
      el('div', { class: 'row', style: { marginTop: '8px' } }, [el('label', { text: 'Label changes with:', style: { width: '140px' } }), label]),
      el('div', { class: 'row', style: { marginTop: '6px' } }, [moreBtn]),
      more,
    ]);
    WC.dialog({ title: combine ? 'Combine Documents' : 'Compare Documents', width: '560px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const pm = pmActive();
        if (!pm) { WC.toast('Compare needs the new engine.'); return; }
        const o = orig.get(); const r = rev.get();
        (async () => {
          if (!(await WC.Files.confirmDiscard())) return;
          const ok = await pm.runCompare(o, r, { granularity: granChar.checked ? 'character' : 'word', label: label.value.trim() || authorName });
          if (!ok) { WC.toast('Compare failed', 'The documents may be too large.'); return; }
          // Result = a NEW unsaved document (Word parity): never bound to a path.
          WC.Files.path = null; WC.Files.name = combine ? 'Combine Result' : 'Compare Result'; WC.Files.format = 'docx';
          WC.Files.updateTitle();
          WC.toast(combine ? 'Documents combined' : 'Documents compared', 'Differences are shown as tracked changes.');
        })();
      } },
      { label: 'Cancel' },
    ] });
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
      { label: 'OK', primary: true, onClick: () => { WC.PM.deWatermark(text.value, { color, diagonal: diag.checked }); } },
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
      { label: 'OK', primary: true, onClick: () => { WC.PM.dePageBorders({ style: style.value, color, width: parseFloat(width.value) }); } },
      { label: 'Remove', onClick: () => { WC.PM.dePageBordersRemove(); } },
      { label: 'Cancel' },
    ] });
  };

  // ---- Borders and Shading (Home → Paragraph → Borders ▾ → Borders and Shading…) ----
  // Faithful 3-tab dialog. Paragraph edge borders + shading are fully functional today;
  // Inside-Horizontal renders between paragraphs only with the layout engine, and the
  // whole Page Border tab + Shadow/3-D depth are layout-gated (Phase 4, deferrals A.1).
  D.bordersAndShading = function (initialTab) {
    const pm = WC.PM;
    if (pm.ready) pm.captureSelection(); // the dialog steals focus; restore before applying
    const para = (pm.getEditor().getAttributes('paragraph') || {}).paragraphProperties || {};
    const cur0 = para.borders || {};
    // a "live" edge is present AND not an explicit nil/none (matches the dropdown's has())
    const live = (e) => !!e && e.val !== 'none' && e.val !== 'nil';
    const seed = [cur0.bottom, cur0.top, cur0.left, cur0.right, cur0.between].find(live) || null;
    // working border state
    const edges = { top: live(cur0.top), bottom: live(cur0.bottom), left: live(cur0.left), right: live(cur0.right), between: live(cur0.between) };
    let style = (seed && seed.val) || 'single';
    let width = (seed && seed.size) || 4;            // eighth-points
    let color = seed && seed.color && seed.color !== 'auto' ? '#' + String(seed.color).replace(/^#/, '') : 'auto';
    let setting = computeSetting();
    let applyTo = 'paragraph';
    let bordersTouched = false, shadingTouched = false, pageTouched = false;
    // working shading state
    const sh0 = para.shading;
    let shadeFill = sh0 && sh0.fill && String(sh0.fill).toLowerCase() !== 'auto' ? '#' + String(sh0.fill).replace(/^#/, '') : null;

    function computeSetting() {
      const o = edges.top && edges.bottom && edges.left && edges.right;
      if (!edges.top && !edges.bottom && !edges.left && !edges.right && !edges.between) return 'none';
      if (o && !edges.between) return 'box';
      return 'custom';
    }
    const STYLES = [['single', 'Solid'], ['dotted', 'Dotted'], ['dashed', 'Dashed'], ['double', 'Double'], ['thick', 'Thick']];
    const WIDTHS = [['¼ pt', 2], ['½ pt', 4], ['¾ pt', 6], ['1 pt', 8], ['1½ pt', 12], ['2¼ pt', 18], ['3 pt', 24], ['4½ pt', 36], ['6 pt', 48]];
    function styleCss(v) { return ({ single: 'solid', thick: 'solid', dotted: 'dotted', dashed: 'dashed', double: 'double' })[v] || 'solid'; }
    function widthPx() { const base = Math.max(1, Math.round((width / 8) * (96 / 72))); return style === 'thick' ? base + 2 : base; }
    function edgeCss(on) { return on ? `${widthPx()}px ${styleCss(style)} ${color === 'auto' ? '#000' : color}` : 'none'; }

    // ---------- Borders tab ----------
    const settingBtns = {};
    function setSetting(s) {
      setting = s; bordersTouched = true;
      if (s === 'none') { edges.top = edges.bottom = edges.left = edges.right = edges.between = false; }
      else if (s === 'box' || s === 'shadow' || s === '3d') { edges.top = edges.bottom = edges.left = edges.right = true; edges.between = false; }
      // 'custom' leaves edges as-is
      Object.keys(settingBtns).forEach((k) => settingBtns[k].classList.toggle('active', k === s));
      renderPreview();
    }
    const settingCol = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' } }, [
      el('div', { style: { fontWeight: '600', marginBottom: '2px' }, text: 'Setting:' }),
      ...[['none', 'None', 'borderNoneIc'], ['box', 'Box', 'borderAllIc'], ['shadow', 'Shadow', 'borderOutsideIc'], ['3d', '3-D', 'borderOutsideIc'], ['custom', 'Custom', 'borderInsideIc']].map(([k, label, ic]) => {
        const b = el('button', { class: 'bs-setting' + (setting === k ? ' active' : ''), onclick: () => setSetting(k) }, [
          el('span', { class: 'bs-set-ic', html: WC.icon(ic, 18) }), el('span', { text: label }),
        ]);
        settingBtns[k] = b; return b;
      }),
    ]);

    const styleList = el('div', { class: 'bs-style-list' }, STYLES.map(([v, label]) => {
      const row = el('div', { class: 'bs-style-row' + (style === v ? ' active' : ''), onclick: () => { style = v; bordersTouched = true; styleList.querySelectorAll('.bs-style-row').forEach((r) => r.classList.remove('active')); row.classList.add('active'); renderPreview(); } }, [
        el('span', { class: 'bs-style-sample', style: { borderTop: `${v === 'thick' ? 3 : v === 'double' ? 3 : 2}px ${styleCss(v)} #000` } }),
        el('span', { text: label, style: { fontSize: '12px' } }),
      ]);
      return row;
    }));
    const colorBtn = el('button', { class: 'btn', style: { minWidth: '110px', textAlign: 'left' } });
    function paintColorBtn() { colorBtn.innerHTML = ''; colorBtn.appendChild(el('span', { style: { display: 'inline-block', width: '12px', height: '12px', verticalAlign: 'middle', marginRight: '6px', border: '1px solid #888', background: color === 'auto' ? '#000' : color } })); colorBtn.appendChild(document.createTextNode(color === 'auto' ? 'Automatic' : color)); colorBtn.appendChild(document.createTextNode('  ▾')); }
    colorBtn.addEventListener('click', () => WC.flyout(colorBtn, (f) => f.appendChild(WC.colorPalette((c) => { color = (c === 'inherit' || c == null) ? 'auto' : c; bordersTouched = true; paintColorBtn(); renderPreview(); }, { autoLabel: 'Automatic', automatic: true, autoValue: 'auto' }))));
    paintColorBtn();
    const widthSel = el('select', { onchange: () => { width = parseInt(widthSel.value, 10); bordersTouched = true; renderPreview(); } }, WIDTHS.map(([label, v]) => el('option', { value: String(v), text: label })));
    widthSel.value = String(width);

    // Preview: a sample box with clickable edge toggles (Word's "click the diagram" area).
    const sampleBox = el('div', { class: 'bs-sample' });
    const betweenLine = el('div', { class: 'bs-between' });
    sampleBox.appendChild(el('div', { class: 'bs-sample-text' }, [el('div', {}), el('div', {}), el('div', {})]));
    sampleBox.appendChild(betweenLine);
    function edgeToggle(edge, cls) { return el('button', { class: 'bs-edge ' + cls, title: edge[0].toUpperCase() + edge.slice(1) + ' border', onclick: () => { edges[edge] = !edges[edge]; bordersTouched = true; setting = computeSetting(); Object.keys(settingBtns).forEach((k) => settingBtns[k].classList.toggle('active', k === setting)); renderPreview(); } }); }
    const eT = edgeToggle('top', 'e-top'), eB = edgeToggle('bottom', 'e-bottom'), eL = edgeToggle('left', 'e-left'), eR = edgeToggle('right', 'e-right');
    const previewGrid = el('div', { class: 'bs-preview-grid' }, [
      el('div'), eT, el('div'),
      eL, sampleBox, eR,
      el('div'), eB, el('div'),
    ]);
    function renderPreview() {
      sampleBox.style.borderTop = edgeCss(edges.top);
      sampleBox.style.borderBottom = edgeCss(edges.bottom);
      sampleBox.style.borderLeft = edgeCss(edges.left);
      sampleBox.style.borderRight = edgeCss(edges.right);
      betweenLine.style.borderTop = edges.between ? edgeCss(true) : 'none';
      [['top', eT], ['bottom', eB], ['left', eL], ['right', eR]].forEach(([k, b]) => b.classList.toggle('on', edges[k]));
    }
    const applyToSel = el('select', { onchange: () => { applyTo = applyToSel.value; } }, [el('option', { value: 'paragraph', text: 'Paragraph' }), el('option', { value: 'text', text: 'Text' })]);
    const bordersTab = el('div', { class: 'bs-tab' }, [
      el('div', { style: { display: 'flex', gap: '18px' } }, [
        settingCol,
        el('div', { style: { width: '150px' } }, [
          el('div', { style: { fontWeight: '600', marginBottom: '2px' }, text: 'Style:' }), styleList,
          el('div', { class: 'row', style: { marginTop: '8px' } }, [el('label', { text: 'Color:', style: { width: '46px' } }), colorBtn]),
          el('div', { class: 'row' }, [el('label', { text: 'Width:', style: { width: '46px' } }), widthSel]),
        ]),
        el('div', { style: { flex: '1' } }, [
          el('div', { style: { fontWeight: '600' }, text: 'Preview' }),
          el('div', { style: { fontSize: '11px', color: '#605E5C', margin: '2px 0 8px' }, text: 'Click on diagram below or use buttons to apply borders' }),
          previewGrid,
          el('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [el('label', { text: 'Apply to:' }), applyToSel]),
        ]),
      ]),
    ]);

    // ---------- Shading tab ----------
    const shadeBtn = el('button', { class: 'btn', style: { minWidth: '130px', textAlign: 'left' } });
    const shadeSample = el('div', { class: 'bs-sample', style: { margin: '0 auto' } }, [el('div', { class: 'bs-sample-text' }, [el('div', {}), el('div', {}), el('div', {})])]);
    function paintShade() {
      shadeBtn.innerHTML = ''; shadeBtn.appendChild(el('span', { style: { display: 'inline-block', width: '12px', height: '12px', verticalAlign: 'middle', marginRight: '6px', border: '1px solid #888', background: shadeFill || '#fff' } })); shadeBtn.appendChild(document.createTextNode(shadeFill || 'No Color')); shadeBtn.appendChild(document.createTextNode('  ▾'));
      shadeSample.style.background = shadeFill || 'transparent';
    }
    shadeBtn.addEventListener('click', () => WC.flyout(shadeBtn, (f) => f.appendChild(WC.colorPalette((c) => { shadeFill = (c == null) ? null : (c === 'inherit' ? '#000000' : c); shadingTouched = true; paintShade(); }, { noColor: true, automatic: false }))));
    paintShade();
    const shadeApplyTo = el('select', {}, [el('option', { value: 'paragraph', text: 'Paragraph' }), el('option', { value: 'text', text: 'Text' })]);
    const shadingTab = el('div', { class: 'bs-tab', style: { display: 'none' } }, [
      el('div', { style: { display: 'flex', gap: '24px' } }, [
        el('div', {}, [
          el('div', { style: { fontWeight: '600', marginBottom: '4px' }, text: 'Fill' }), shadeBtn,
          el('div', { class: 'row', style: { marginTop: '16px' } }, [el('label', { text: 'Apply to:' }), shadeApplyTo]),
        ]),
        el('div', { style: { flex: '1' } }, [el('div', { style: { fontWeight: '600' }, text: 'Preview' }), el('div', { style: { marginTop: '8px' } }, [shadeSample])]),
      ]),
    ]);

    // ---------- Page Border tab (layout-gated; model/export real via dePageBorders) ----------
    const pgStyle = el('select', { onchange: () => { pageTouched = true; } }, ['single', 'double', 'dashed', 'dotted'].map((s) => el('option', { value: s, text: s[0].toUpperCase() + s.slice(1) })));
    let pgColor = '#000000';
    const pgColorBtn = el('button', { class: 'btn', text: 'Automatic  ▾' });
    pgColorBtn.addEventListener('click', () => WC.flyout(pgColorBtn, (f) => f.appendChild(WC.colorPalette((c) => { pgColor = (c === 'inherit' || c == null) ? '#000000' : c; pageTouched = true; pgColorBtn.textContent = pgColor + '  ▾'; }, { autoLabel: 'Automatic', automatic: true }))));
    const pgWidth = el('select', { onchange: () => { pageTouched = true; } }, WIDTHS.map(([label, v]) => el('option', { value: String(v), text: label })));
    pgWidth.value = '8';
    const pageTab = el('div', { class: 'bs-tab', style: { display: 'none' } }, [
      el('div', { style: { fontSize: '11px', color: '#9a6700', background: '#fff4ce', border: '1px solid #f0d98a', padding: '6px 9px', borderRadius: '3px', marginBottom: '10px' }, text: 'Page borders are saved to the document and export to .docx, but drawing them around the page needs the layout engine (Phase 4).' }),
      el('div', { class: 'row' }, [el('label', { text: 'Style:', style: { width: '60px' } }), pgStyle]),
      el('div', { class: 'row' }, [el('label', { text: 'Color:', style: { width: '60px' } }), pgColorBtn]),
      el('div', { class: 'row' }, [el('label', { text: 'Width:', style: { width: '60px' } }), pgWidth]),
    ]);

    // ---------- Tabs + footer ----------
    const panels = { borders: bordersTab, page: pageTab, shading: shadingTab };
    const tabs = el('div', { class: 'tabs' }, [
      el('div', { class: 't active', text: 'Borders', onclick: (e) => sw(e.target, 'borders') }),
      el('div', { class: 't', text: 'Page Border', onclick: (e) => sw(e.target, 'page') }),
      el('div', { class: 't', text: 'Shading', onclick: (e) => sw(e.target, 'shading') }),
    ]);
    function sw(tabEl, key) { tabs.querySelectorAll('.t').forEach((t) => t.classList.remove('active')); tabEl.classList.add('active'); Object.keys(panels).forEach((k) => panels[k].style.display = k === key ? '' : 'none'); }
    const optionsBtn = el('button', { class: 'btn', text: 'Options…', onclick: () => borderOptions() });
    const hLineBtn = el('button', { class: 'btn', text: 'Horizontal Line…', onclick: () => { const ed = pm.getEditor(); if (ed.commands.insertHorizontalRule) { ed.commands.insertHorizontalRule(); pm.markDirty && pm.markDirty(); } } });
    const body = el('div', {}, [tabs, el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, [hLineBtn, optionsBtn]), bordersTab, pageTab, shadingTab]);
    renderPreview();

    let space = (seed && seed.space != null) ? seed.space : 1; // border distance from text (pt), Options dialog
    function borderOptions() {
      const fromText = el('input', { type: 'number', value: String(space), min: '0', max: '31', style: { width: '70px' } });
      WC.dialog({ title: 'Border and Shading Options', width: '340px', body: el('div', {}, [
        el('div', { style: { fontWeight: '600', marginBottom: '6px' }, text: 'From text' }),
        el('div', { class: 'row' }, [el('label', { text: 'Distance (pt):', style: { width: '90px' } }), fromText]),
      ]), footer: [{ label: 'OK', primary: true, onClick: () => { space = parseInt(fromText.value, 10) || 0; bordersTouched = true; } }, { label: 'Cancel' }] });
    }

    function buildBorders() {
      const def = () => ({ val: style, size: width, color: color === 'auto' ? 'auto' : color.replace(/^#/, '').toUpperCase(), space: space });
      const out = {}; ['top', 'bottom', 'left', 'right', 'between'].forEach((k) => { if (edges[k]) out[k] = def(); });
      return out;
    }

    WC.dialog({ title: 'Borders and Shading', width: '620px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const flags = [];
        // restore the captured selection (the dialog blurred the editor) before writing
        pm.withSelection(() => {
          if (bordersTouched) {
            if (applyTo === 'text') {
              // 019: "Apply to: Text" = a run-level (character) border — a SINGLE <w:bdr> around the selection
              // (not the 4-sided paragraph w:pBdr). null clears it. Uses the chosen style/width/color/distance.
              const chosen = ['top', 'bottom', 'left', 'right'].filter((k) => edges[k]);
              const def = chosen.length ? { val: style, size: width, color: color === 'auto' ? 'auto' : color.replace(/^#/, '').toUpperCase(), space: space } : null;
              pm.cmd('setMark', 'textStyle', { borders: def });
              // w:bdr has no per-edge option — a character border is always a full box. Tell the user if they chose a subset.
              if (chosen.length && chosen.length < 4) flags.push('Apply to: Text draws a full box around the characters (a character border has no per-edge option).');
            } else {
              const b = buildBorders();
              if (Object.keys(b).length) pm.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.borders': b });
              else pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.borders');
              if (edges.between) flags.push('Inside Horizontal border renders between paragraphs with the layout engine (Phase 4).');
            }
            if (setting === 'shadow' || setting === '3d') flags.push('Shadow / 3-D border depth renders with the layout engine (Phase 4).');
          }
          if (shadingTouched) {
            if (shadeApplyTo.value === 'text') {
              // "Apply to: Text" = run-level character shading (rPr/w:shd) via the highlight mark — the same path
              // the ribbon's setShading uses for a sub-paragraph selection. null clears both run + paragraph shading.
              if (shadeFill) pm.cmd('setHighlight', shadeFill);
              else { pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.shading'); pm.cmd('unsetHighlight'); }
            } else if (shadeFill) {
              pm.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.shading': { val: 'clear', color: 'auto', fill: shadeFill.replace(/^#/, '').toUpperCase() } });
            } else {
              pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.shading');
            }
          }
        });
        // page borders are section-level (no text selection needed). dePageBorders treats
        // width as POINTS (round(pt*8)); pass eighth-points/8 so sub-1pt widths survive export.
        if (pageTouched) { pm.dePageBorders({ style: pgStyle.value === 'single' ? 'solid' : pgStyle.value, color: pgColor, width: parseInt(pgWidth.value, 10) / 8 }); flags.push('Page border saved to the document; on-page render arrives with the layout engine (Phase 4).'); }
        if (flags.length) WC.toast(flags[0], flags.length > 1 ? flags.slice(1).join(' ') : undefined);
      } },
      { label: 'Cancel' },
    ] });
    if (initialTab && panels[initialTab]) { const ix = { borders: 0, page: 1, shading: 2 }[initialTab]; sw(tabs.children[ix], initialTab); }
  };

  // ---- Add Source / Manage Sources ----
  // opts (additive): { prefill, onSubmit }. When `onSubmit` is supplied (the Source
  // Manager → Edit flow, slice-9 FIX 5) it OVERRIDES the default add/insert behavior
  // and receives the flat source `s`, so the caller can route to refUpdateSource.
  // `prefill` seeds the inputs for editing.
  D.addSource = function (onAdd, opts) {
    const pre = (opts && opts.prefill) || null;
    const type = el('select', {}, ['Book', 'Journal Article', 'Web Site', 'Report'].map((t) => el('option', { text: t, selected: (pre && pre.type === t) ? 'selected' : undefined })));
    const author = el('input', { type: 'text', class: 'grow', placeholder: 'Last, First', value: pre ? (pre.author || '') : undefined });
    const title = el('input', { type: 'text', class: 'grow', value: pre ? (pre.title || '') : undefined });
    const year = el('input', { type: 'text', style: { width: '80px' }, placeholder: 'Year', value: pre ? (pre.year || '') : undefined });
    const publisher = el('input', { type: 'text', class: 'grow', value: pre ? (pre.publisher || '') : undefined });
    const row = (l, c) => el('div', { class: 'row' }, [el('label', { text: l, style: { width: '80px' } }), c]);
    const body = el('div', {}, [row('Type:', type), row('Author:', author), row('Title:', title), row('Year:', year), row('Publisher:', publisher)]);
    WC.dialog({ title: pre ? 'Edit Source' : 'Create Source', width: '480px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const s = { type: type.value, author: author.value.trim() || 'Unknown', title: title.value.trim(), year: year.value.trim(), publisher: publisher.value.trim() };
        // Edit override: route to the supplied onSubmit (refUpdateSource) and
        // skip the add/insert default entirely.
        if (opts && typeof opts.onSubmit === 'function') { opts.onSubmit(s); return; }
        // refAddSource accepts the flat shape and maps author/title/year/publisher
        // into the fork CitationSourceFields (so the source EXPORTS its real values).
        // It MINTS + returns the engine sourceId.
        const id = WC.PM.refAddSource(s);
        if (onAdd) onAdd(s, id);
        else if (id) WC.PM.refInsertCitation(id);
      } },
      { label: 'Cancel' },
    ] });
  };
  D.manageSources = function () {
    const list = el('div', { style: { border: '1px solid #c8c6c4', maxHeight: '200px', overflowY: 'auto', margin: '8px 0' } });
    // Normalize a fork source { sourceId, type, fields } into the flat display shape.
    function sourceLabel(s) {
      const f = s.fields || {};
      const author = (Array.isArray(f.authors) && f.authors[0] && f.authors[0].last) ? f.authors[0].last : 'Unknown';
      return author + ' (' + (f.year || 'n.d.') + ') — ' + (f.title || '');
    }
    // Edit prefill (FIX 5): map a fork source { sourceId, type, fields } into the
    // flat Create-Source shape the D.addSource inputs expect.
    function editPrefill(s) {
      const f = s.fields || {};
      const author = (Array.isArray(f.authors) && f.authors[0])
        ? [f.authors[0].last, f.authors[0].first].filter(Boolean).join(', ')
        : '';
      return { type: s.type, author, title: f.title || '', year: f.year || '', publisher: f.publisher || '' };
    }
    function render() {
      list.innerHTML = '';
      const sources = WC.PM.refListSources() || [];
      if (!sources.length) list.appendChild(el('div', { style: { padding: '8px', color: '#888' }, text: 'No sources yet.' }));
      sources.forEach((s) => {
        const actions = [];
        // Edit opens D.addSource prefilled and routes OK → refUpdateSource so the
        // edit reaches the engine (and the exported source reflects it).
        actions.push(el('span', { style: { color: '#0066cc', cursor: 'pointer', marginRight: '12px' }, text: 'Edit', onclick: () => {
          D.addSource(null, { prefill: editPrefill(s), onSubmit: (patch) => { WC.PM.refUpdateSource(s.sourceId, patch); render(); } });
        } }));
        actions.push(el('span', { style: { color: '#c0392b', cursor: 'pointer' }, text: 'Delete', onclick: () => { WC.PM.refRemoveSource(s.sourceId); render(); } }));
        list.appendChild(el('div', { style: { padding: '6px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex' } }, [
          el('span', { style: { flex: 1 }, text: sourceLabel(s) }),
        ].concat(actions)));
      });
    }
    render();
    WC.dialog({ title: 'Source Manager', width: '560px', body: el('div', {}, [el('div', { style: { fontSize: '12px', color: '#666' }, text: 'Current List' }), list]), footer: [
      { label: 'New…', onClick: () => { D.addSource(() => { render(); }); return true; } },
      { label: 'Close', primary: true },
    ] });
  };

  WC.Dialogs = D;

})();
