/* ribbon.js — renders the tab strip + ribbon body from WC.RIBBON and wires
   every control to the command dispatcher. Handles tab switching, flyouts,
   combos, galleries, split buttons, and live toggle-state sync. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;

  // ---- Styles-gallery live preview ----
  // PM mode (2026-06-12 product decision): NO hover Live Preview — styles apply on
  // CLICK only, scoped to the selection (else the caret paragraph). The bridge
  // preview mechanism (style-preview.ts) stays for a possible opt-in later, but the
  // gallery no longer drives it on hover, so enter/leave are no-ops.
  function stylePreviewEnter() { /* no hover preview in PM mode */ }
  function stylePreviewLeave() { /* nothing previewed on hover */ }
  function stylePreviewCommit() { if (WC.PM && WC.PM.ready) WC.PM.stylePreviewCommitRestore(); }

  // Commands rendered as large buttons (the prominent button in each group).
  const LARGE = new Set([
    'paste', 'table', 'pictures', 'onlinePictures', 'shapes', 'icons', 'smartArt', 'chart', 'screenshot',
    'coverPage', 'blankPage', 'header', 'footer', 'pageNumber', 'textBox', 'wordArt', 'dropCap', 'object', 'equation', 'symbol',
    'tableOfContents', 'insertFootnote', 'insertCitation', 'bibliography', 'insertCaption', 'insertTableOfFigures', 'markEntry', 'insertIndex',
    'startMailMerge', 'selectRecipients', 'insertMergeField', 'finishMerge', 'greetingLine', 'addressBlock',
    'spellingGrammar', 'thesaurus', 'newComment', 'trackChanges', 'readAloud', 'translate', 'compare', 'protect',
    'readMode', 'printLayout', 'webLayout', 'zoom', 'onePage', 'multiplePages', 'pageWidth', 'switchWindows',
    'margins', 'orientation', 'size', 'columns', 'breaks', 'watermark', 'pageColor', 'pageBorders',
    'getAddIns', 'wikipedia', 'onlineVideo', 'link', 'comment', 'crossReference', 'bookmark', 'quickParts', 'signatureLine', 'dateAndTime',
    'themes', 'help', 'feedback', 'showTraining', 'contactSupport', 'colors', 'fonts', 'paragraphSpacing', 'effects', 'setAsDefault',
    'navigationPane', 'immersiveReader', 'focus', 'draft', 'outline', 'macros',
  ]);

  // toggle cmd -> queryCommandState key
  const TOGGLE_MAP = {
    bold: 'bold', italic: 'italic', underline: 'underline', strikethrough: 'strikethrough',
    subscript: 'subscript', superscript: 'superscript',
    alignLeft: 'justifyLeft', center: 'justifyCenter', alignRight: 'justifyRight', justify: 'justifyFull',
    bullets: 'insertUnorderedList', numbering: 'insertOrderedList',
  };

  const Ribbon = {
    tabstrip: null, body: null, activeTab: null, controlIndex: {}, toggleNodes: [],

    init() {
      this.tabstrip = document.getElementById('tabstrip');
      this.body = document.getElementById('ribbon');
      this.renderTabStrip();
      this.renderBody();
      this.activate(WC.RIBBON[0].id);
      this.installResponsive();
      // WC.Editor retired (slice 11): in PM mode the bridge's state-sync drives
      // syncToggles via the fork engine; there is no legacy onStateChange to bind.
    },

    // Phase 3 responsive ribbon (Stage A): when the active tab's groups overflow
    // the window width, progressively condense them (tighten spacing → hide large
    // labels → shrink large buttons to small icons) instead of clipping behind a
    // horizontal scrollbar. Cross-cutting — works for every tab.
    installResponsive() {
      const relayout = () => this.relayoutRibbon();
      if (typeof ResizeObserver === 'function') {
        // Observe #ribbon (full window width). Our condense-class changes alter
        // CHILD sizes, not #ribbon's own box, so they never re-fire the observer
        // (no measure→mutate→refire feedback loop). rAF-coalesced.
        let scheduled = false;
        const ro = new ResizeObserver(() => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => { scheduled = false; relayout(); });
        });
        ro.observe(this.body);
      } else {
        window.addEventListener('resize', relayout);
      }
      relayout();
    },

    relayoutRibbon() {
      const panel = this.body && this.body.querySelector('.ribbon-panel.active');
      if (!panel) return;
      const scroll = panel.querySelector('.ribbon-scroll');
      if (!scroll) return;
      const LEVELS = ['condense-1', 'condense-2', 'condense-3'];
      LEVELS.forEach((c) => panel.classList.remove(c));
      // Escalate until the groups fit (or levels run out). Reading scrollWidth
      // after each add forces a reflow so the next comparison is fresh.
      for (let i = 0; i < LEVELS.length && scroll.scrollWidth > scroll.clientWidth + 1; i++) {
        panel.classList.add(LEVELS[i]);
      }
    },

    renderTabStrip() {
      const tabs = el('div', { class: 'ribbon-tabs' });
      // File chip
      const fileTab = el('div', { class: 'ribbon-tab file-tab', text: 'File' });
      fileTab.addEventListener('click', () => WC.Backstage.open());
      tabs.appendChild(fileTab);
      WC.RIBBON.forEach((tab) => {
        const t = el('div', { class: 'ribbon-tab', text: tab.name, dataset: { tab: tab.id } });
        t.addEventListener('click', () => this.activate(tab.id));
        tabs.appendChild(t);
      });
      this.tabstrip.appendChild(tabs);

      // Search box
      this.tabstrip.appendChild(el('div', { class: 'ribbon-search' }, [
        el('span', { html: WC.icon('search', 14) }),
        el('input', { type: 'text', placeholder: 'Search', onkeydown: (e) => { if (e.key === 'Enter') WC.toast('Microsoft Search is a UI placeholder in this clone.'); } }),
      ]));

      // right cluster: account, comments, share
      const cluster = el('div', { class: 'ribbon-right-cluster' });
      const comments = el('div', { class: 'pill', html: WC.icon('comment', 14) + '<span style="margin-left:6px">Comments</span>' });
      comments.addEventListener('click', () => WC.Commands.run({ cmd: 'newComment', label: 'Comments' }));
      const share = el('div', { class: 'pill', html: WC.icon('share', 14) + '<span style="margin-left:6px">Share</span>' });
      share.addEventListener('click', () => WC.toast('Sharing requires a cloud backend — not implemented.', 'See docs/NOT_IMPLEMENTED.md'));
      const acct = el('div', { class: 'account' }, [el('span', { class: 'avatar', text: 'W' }), el('span', { text: 'Word User' })]);
      acct.addEventListener('click', () => WC.Backstage.open('account'));
      cluster.appendChild(comments); cluster.appendChild(share); cluster.appendChild(acct);
      this.tabstrip.appendChild(cluster);
    },

    renderBody() {
      WC.RIBBON.forEach((tab) => {
        const panel = el('div', { class: 'ribbon-panel', dataset: { tab: tab.id } });
        const scroll = el('div', { class: 'ribbon-scroll' });
        tab.groups.forEach((group) => scroll.appendChild(this.renderGroup(tab, group)));
        panel.appendChild(scroll);
        this.body.appendChild(panel);
      });
      // ribbon collapse chevron
      const collapse = el('div', { class: 'ribbon-collapse', html: WC.icon('chevron_down', 12), title: 'Collapse the Ribbon (Ctrl+F1)' });
      collapse.addEventListener('click', () => this.body.classList.toggle('collapsed'));
      this.body.appendChild(collapse);
    },

    renderGroup(tab, group) {
      const g = el('div', { class: 'ribbon-group', dataset: { group: group.id } });
      const body = el('div', { class: 'ribbon-group-body' });

      const gallery = group.controls.find((c) => c.type === 'gallery');
      const combos = group.controls.filter((c) => c.type === 'combo');
      const rest = group.controls.filter((c) => c.type !== 'gallery' && c.type !== 'combo');

      if (gallery && group.id === 'styles') {
        body.appendChild(this.renderStylesGallery(gallery));
        rest.length = 0; // styles group handled
      } else if (group.id === 'font') {
        // Home Font group: explicit two-row Word arrangement (the generic
        // 3-per-column packing only loosely matched Word). Row 1 = name + size
        // combos, then Grow/Shrink/Change Case/Clear Formatting; row 2 = the
        // B/I/U… formatting buttons. Cmd ids already match Word.
        this.renderFontGroupBody(body, group);
      } else if (group.id === 'paragraph') {
        // Home Paragraph group: explicit two-row Word arrangement (matches the
        // user screenshot). Row 1 = lists + indents + sort + show/hide; row 2 =
        // alignment + line spacing + shading + borders.
        this.renderParagraphGroupBody(body, group);
      } else {
        // Pens gallery: inline pen tiles (Word shows the pens directly in the ribbon)
        if (gallery && group.id === 'pens') body.appendChild(this.renderPensGallery(gallery));
        // combos first (font name/size) in a top row
        if (combos.length) {
          const colTop = el('div', { class: 'ctrl-stack', style: { gap: '2px' } });
          const topRow = el('div', { class: 'ctrl-row' });
          combos.forEach((c) => topRow.appendChild(this.renderCombo(c)));
          colTop.appendChild(topRow);
          // small controls that should sit under the combos (heuristic: none by default)
          body.appendChild(colTop);
        }
        // large controls
        const larges = rest.filter((c) => LARGE.has(c.cmd) || group.controls.length <= 2);
        const smalls = rest.filter((c) => !(LARGE.has(c.cmd) || group.controls.length <= 2));
        larges.forEach((c) => body.appendChild(this.renderControl(c, 'large')));
        // pack small controls 3 per column
        for (let i = 0; i < smalls.length; i += 3) {
          const stack = el('div', { class: 'ctrl-stack' });
          smalls.slice(i, i + 3).forEach((c) => {
            const row = el('div', { class: 'ctrl-row' });
            row.appendChild(this.renderControl(c, 'small'));
            stack.appendChild(row);
          });
          body.appendChild(stack);
        }
      }

      g.appendChild(body);
      const label = el('div', { class: 'ribbon-group-label' }, [el('span', { text: group.name })]);
      if (group.launcher) {
        const launch = el('span', { class: 'launcher', html: WC.icon('_generic', 9), title: group.launcher.tooltip || (group.name + ' settings') });
        launch.innerHTML = '<svg viewBox="0 0 12 12" width="9" height="9"><path d="M2 2h6v6" fill="none" stroke="#444"/><path d="M8 8 3 3" stroke="#444"/></svg>';
        launch.addEventListener('mousedown', (e) => e.preventDefault());
        launch.addEventListener('click', () => WC.Commands.launcher(group.id, group.launcher, launch));
        label.appendChild(launch);
        WC.attachTip(launch, group.name, group.launcher.tooltip);
      }
      g.appendChild(label);
      return g;
    },

    // Home Font group body: two rows in Word's order. Row 2 holds the character
    // formatting buttons; everything else (combos + Grow/Shrink/Change Case/Clear)
    // goes in row 1, preserving declaration order.
    renderFontGroupBody(body, group) {
      const ROW2 = new Set(['bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'textEffectsAndTypography', 'textHighlightColor', 'fontColor']);
      const grid = el('div', { class: 'font-grid' });
      const row1 = el('div', { class: 'font-row' });
      const row2 = el('div', { class: 'font-row' });
      group.controls.forEach((c) => {
        if (ROW2.has(c.cmd)) { row2.appendChild(this.renderControl(c, 'small')); return; }
        if (c.type === 'combo') { row1.appendChild(this.renderCombo(c)); return; }
        row1.appendChild(this.renderControl(c, 'small'));
      });
      grid.appendChild(row1);
      grid.appendChild(row2);
      body.appendChild(grid);
    },

    // Home Paragraph group body: two rows in Word's order. Row 2 = alignment +
    // line spacing + shading + borders; everything else (lists, indents, sort,
    // show/hide) goes in row 1, preserving declaration order. Routed through
    // renderControl so controlIndex/toggleNodes/state-rule wiring is preserved.
    renderParagraphGroupBody(body, group) {
      const ROW2 = new Set(['alignLeft', 'center', 'alignRight', 'justify', 'lineAndParagraphSpacing', 'shading', 'borders']);
      const grid = el('div', { class: 'para-grid' });
      const row1 = el('div', { class: 'para-row' });
      const row2 = el('div', { class: 'para-row' });
      group.controls.forEach((c) => {
        (ROW2.has(c.cmd) ? row2 : row1).appendChild(this.renderControl(c, 'small'));
      });
      grid.appendChild(row1);
      grid.appendChild(row2);
      body.appendChild(grid);
    },

    renderCombo(c) {
      const cls = c.cmd === 'font' ? 'font-name' : c.cmd === 'fontSize' ? 'font-size' : '';
      const combo = el('div', { class: 'rcombo ' + cls });
      const input = el('input', { type: 'text', value: c.cmd === 'font' ? 'Aptos' : c.cmd === 'fontSize' ? '12' : '' });
      const arrow = el('div', { class: 'combo-arrow', html: WC.icon('chevron_down', 8) });
      combo.appendChild(input); combo.appendChild(arrow);
      combo.dataset.cmd = c.cmd;
      input.addEventListener('change', () => WC.Commands.comboCommit(c, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { WC.Commands.comboCommit(c, input.value); input.blur(); } });
      arrow.addEventListener('mousedown', (e) => e.preventDefault());
      arrow.addEventListener('click', () => WC.Commands.comboDropdown(c, combo, input));
      this.controlIndex[c.cmd] = { node: combo, input, control: c };
      WC.attachTip(combo, c.label, c.tooltip, c.shortcut);
      return combo;
    },

    renderPensGallery(c) {
      const wrap = el('div', { class: 'pens-gallery' });
      const grid = el('div', { class: 'pens-grid' });
      const draw = WC.Draw;
      const render = () => {
        grid.innerHTML = '';
        const pens = (draw.PENS || []).concat(draw.customPens || []);
        pens.forEach((pen) => {
          const tile = el('div', { class: 'pen-tile', title: pen.name });
          const pmA = (window.WC.PM && window.WC.PM.ready) ? window.WC.PM : null;
          // The highlight reflects PM drawing state (the overlay owns ink).
          const active = pmA ? (pmA.dIsDrawing() && draw.pen && draw.pen.id === pen.id) : false;
          if (active) tile.classList.add('active');
          tile.appendChild(el('span', { class: 'pen-swatch', style: { background: pen.color, opacity: String(pen.opacity), height: Math.max(3, Math.min(14, pen.width)) + 'px' } }));
          tile.addEventListener('mousedown', (e) => e.preventDefault());
          tile.addEventListener('click', () => {
            const pm = (window.WC.PM && window.WC.PM.ready) ? window.WC.PM : null;
            if (!pm) return;
            const isOn = pm.dIsDrawing() && WC.Draw.pen && WC.Draw.pen.id === pen.id; pm.dSetPen(pen); pm.dSetDrawing(!isOn); render();
          });
          grid.appendChild(tile);
        });
      };
      render();
      this._renderPens = render; // allow refresh after Add Pen
      wrap.appendChild(grid);
      this.controlIndex[c.cmd] = { node: wrap, control: c, refresh: render };
      WC.attachTip(wrap, c.label || 'Pens', c.tooltip);
      return wrap;
    },

    renderStylesGallery(c) {
      const wrap = el('div', { class: 'styles-gallery' });
      const grid = el('div', { class: 'styles-grid' });
      // Word's Quick Styles order, filtered to the LIVE catalog (WC.PM.allStyleNames)
      // so a cell never renders a style that can't apply — decoupled from ribbon-data.
      const ORDER = ['Normal', 'No Spacing', 'Heading 1', 'Heading 2', 'Heading 3', 'Title', 'Subtitle', 'Subtle Emphasis', 'Emphasis', 'Intense Emphasis', 'Strong', 'Quote', 'Intense Quote', 'Subtle Reference', 'Intense Reference', 'Book Title', 'List Paragraph'];
      const catalog = (WC.PM && WC.PM.allStyleNames) ? WC.PM.allStyleNames() : null;
      const styles = catalog ? ORDER.filter((s) => catalog.indexOf(s) >= 0)
        : (c.items || []).filter((s) => !/^(Create a Style|Clear Formatting|Apply Styles)/i.test(s));
      const preview = {
        'Normal': 'font:11pt Aptos,Calibri', 'No Spacing': 'font:11pt Aptos,Calibri',
        'Heading 1': 'color:#0E2841;font:13pt Aptos,Calibri', 'Heading 2': 'color:#0E2841;font:12pt Aptos,Calibri',
        'Heading 3': 'color:#0E2841;font:11.5pt Aptos,Calibri', 'Title': 'font:18pt Aptos,Calibri',
        'Subtitle': 'color:#595959;font-style:italic',
        'Strong': 'font-weight:bold', 'Emphasis': 'font-style:italic', 'Subtle Emphasis': 'font-style:italic;color:#595959',
        'Intense Emphasis': 'font-style:italic;font-weight:bold;color:#0E2841',
        'Quote': 'font-style:italic;color:#595959', 'Intense Quote': 'font-style:italic;font-weight:bold;color:#0E2841',
        'Subtle Reference': 'text-transform:uppercase;letter-spacing:.4px;color:#595959',
        'Intense Reference': 'text-transform:uppercase;letter-spacing:.4px;font-weight:bold;color:#0E2841',
        'Book Title': 'font-weight:bold;font-style:italic', 'List Paragraph': 'font:11pt Aptos,Calibri',
      };
      const cell = (s) => {
        const node = el('div', { class: 'style-cell', title: s, dataset: { style: s } });
        node.setAttribute('style', (preview[s] || '') + ';');
        node.appendChild(el('span', { text: s }));
        node.addEventListener('mousedown', (e) => e.preventDefault());
        // Live preview is a no-op in PM (click-only, locked 2026-06-11); kept for opt-in.
        node.addEventListener('mouseenter', () => stylePreviewEnter(s));
        node.addEventListener('mouseleave', () => stylePreviewLeave());
        node.addEventListener('click', () => { stylePreviewCommit(); WC.Commands.applyStyle(s); if (WC.closeFlyouts) WC.closeFlyouts(); });
        return node;
      };
      styles.forEach((s) => grid.appendChild(cell(s)));
      wrap.appendChild(grid);
      const more = el('div', { class: 'styles-more' });
      const up = el('button', { html: '▲', title: 'Row up' }); const down = el('button', { html: '▼', title: 'Row down' });
      const all = el('button', { html: WC.icon('chevron_down', 8), title: 'More' });
      up.addEventListener('click', () => { grid.scrollLeft -= 70; });
      down.addEventListener('click', () => { grid.scrollLeft += 70; });
      // Word's "More" opens the EXPANDED Quick Styles gallery (the full grid + the
      // gallery commands) — NOT the Styles task pane (that's the dialog-launcher chevron).
      all.addEventListener('click', () => {
        WC.flyout(all, (fly) => {
          fly.classList.add('styles-flyout');
          const fg = el('div', { class: 'styles-grid-expanded' });
          const active = (WC.PM && WC.PM.getState) ? (WC.PM.getState().block || '') : '';
          styles.forEach((s) => { const ec = cell(s); if (s === active) ec.classList.add('active'); fg.appendChild(ec); });
          fly.appendChild(fg);
          fly.appendChild(WC.flySep());
          fly.appendChild(WC.flyItem('Create a Style…', { icon: 'stylesGallery', onClick: () => WC.notImplemented('Create a Style (custom style authoring)') }));
          fly.appendChild(WC.flyItem('Clear Formatting', { icon: 'clearAllFormatting', onClick: () => WC.Commands.run({ cmd: 'clearAllFormatting' }) }));
          fly.appendChild(WC.flyItem('Apply Styles…', { icon: 'styles', onClick: () => WC.Dialogs.applyStyles() }));
        }, { align: 'right' });
      });
      more.appendChild(up); more.appendChild(down); more.appendChild(all);
      wrap.appendChild(more);
      return wrap;
    },

    renderSpinner(c) {
      const isIndent = /indent/i.test(c.cmd);
      const wrap = el('div', { class: 'rspinner', dataset: { cmd: c.cmd } });
      wrap.appendChild(el('span', { class: 'sp-ic', html: WC.icon(/Left|Before/i.test(c.label) ? 'decreaseIndent' : 'increaseIndent', 14) }));
      const input = el('input', { type: 'number', step: isIndent ? '0.1' : '6', value: c.cmd === 'spacingAfter' ? '8' : '0', min: isIndent ? '-2' : '0' });
      const apply = () => WC.Commands.spinner(c.cmd, parseFloat(input.value) || 0);
      input.addEventListener('change', apply);
      wrap.appendChild(input);
      wrap.appendChild(el('span', { class: 'sp-unit', text: isIndent ? '"' : 'pt' }));
      this.controlIndex[c.cmd] = { node: wrap, input, control: c };
      WC.attachTip(wrap, c.label, c.tooltip);
      return wrap;
    },

    renderControl(c, size) {
      if (c.type === 'spinner') return this.renderSpinner(c);
      const isSplit = c.type === 'split';
      const isDrop = c.type === 'dropdown';
      const isColor = /color|highlight|shading/i.test(c.cmd) && (c.type === 'split' || /color/i.test(c.label));
      const iconHtml = WC.icon(c.cmd, size === 'large' ? 28 : 16);

      let node;
      if (isSplit) {
        node = el('div', { class: 'rsplit ' + size, dataset: { cmd: c.cmd } });
        const main = el('div', { class: 'main' });
        main.appendChild(el('span', { class: 'ic', html: iconHtml }));
        if (size === 'large') main.appendChild(el('span', { class: 'lbl', text: c.label }));
        if (isColor) main.appendChild(el('span', { class: 'color-bar', dataset: { colorbar: c.cmd } }));
        const arrow = el('div', { class: 'arrow' }, [size === 'large' ? null : null, el('span', { html: WC.icon('chevron_down', 8) })]);
        node.appendChild(main); node.appendChild(arrow);
        main.addEventListener('mousedown', (e) => e.preventDefault());
        arrow.addEventListener('mousedown', (e) => e.preventDefault());
        main.addEventListener('click', () => WC.Commands.run(c, node));
        arrow.addEventListener('click', () => WC.Commands.dropdown(c, node));
      } else {
        node = el('div', { class: 'rbtn ' + size, dataset: { cmd: c.cmd } });
        node.appendChild(el('span', { class: 'ic', html: iconHtml }));
        if (size === 'large') node.appendChild(el('span', { class: 'lbl', text: c.label }));
        else if (!this.isIconOnly(c)) node.appendChild(el('span', { class: 'lbl', text: c.label }));
        if (isDrop) node.appendChild(el('span', { class: 'caret', html: WC.icon('chevron_down', 8) }));
        if (isColor) node.appendChild(el('span', { class: 'color-bar', dataset: { colorbar: c.cmd } }));
        node.addEventListener('mousedown', (e) => e.preventDefault());
        node.addEventListener('click', () => { if (isDrop) WC.Commands.dropdown(c, node); else WC.Commands.run(c, node); });
        if (c.cmd === 'formatPainter') node.addEventListener('dblclick', () => { WC.closeFlyouts(); WC.Commands.run({ cmd: 'formatPainterLock' }, node); });
      }
      if (size === 'small') node.classList.add('icononly');
      this.controlIndex[c.cmd] = this.controlIndex[c.cmd] || { node, control: c };
      if (TOGGLE_MAP[c.cmd]) this.toggleNodes.push({ node, cmd: c.cmd });
      WC.attachTip(node, c.label, c.tooltip, c.shortcut);
      return node;
    },

    isIconOnly() { return true; }, // small ribbon buttons in Word are icon-only

    activate(tabId) {
      this.activeTab = tabId;
      this.tabstrip.querySelectorAll('.ribbon-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tabId));
      this.body.querySelectorAll('.ribbon-panel').forEach((p) => p.classList.toggle('active', p.dataset.tab === tabId));
      this.body.classList.remove('collapsed');
      this.relayoutRibbon(); // different tabs have different widths — recheck the fit
    },

    // Inject a contextual ribbon tab at runtime (Header & Footer = one tab;
    // Table Tools = two coexisting tabs) and remove it on hide — mirroring Word's
    // contextual tabs. Multiple tabs can be shown at once: each injected tab id is
    // tracked in `_ctxTabs`; `_ctxTab` still points at the most recently shown one
    // so existing single-tab callers behave unchanged. `_ctxPrev` records the LAST
    // non-contextual tab so we can restore it once ALL contextual tabs are gone
    // (Header & Footer's enter→exit cycle stays byte-identical).
    // opts.activate (default TRUE — Header & Footer relies on the select-on-show
    // behaviour): pass { activate: false } for PASSIVE tabs that must appear
    // without stealing the active tab (real Word's table contextual tabs —
    // .oracle-probes/slice6/results.md).
    showContextualTab(def, opts) {
      const activate = !opts || opts.activate !== false;
      this._ctxTabs = this._ctxTabs || [];
      if (this._ctxTabs.indexOf(def.id) !== -1) { if (activate) this.activate(def.id); this._ctxTab = def.id; return; }
      // Remember the real (non-contextual) tab we came from, only on the FIRST inject.
      if (this._ctxTabs.length === 0) this._ctxPrev = this.activeTab;
      const tabsRow = this.tabstrip.querySelector('.ribbon-tabs');
      const btn = el('div', { class: 'ribbon-tab contextual-tab', text: def.name, dataset: { tab: def.id } });
      btn.addEventListener('click', () => this.activate(def.id));
      tabsRow.appendChild(btn);
      const panel = el('div', { class: 'ribbon-panel', dataset: { tab: def.id } });
      const scroll = el('div', { class: 'ribbon-scroll' });
      def.groups.forEach((group) => scroll.appendChild(this.renderGroup(def, group)));
      panel.appendChild(scroll);
      this.body.appendChild(panel);
      this._ctxTabs.push(def.id);
      this._ctxTab = def.id;
      if (activate) this.activate(def.id);
    },
    // hideContextualTab(id)  -> remove just that contextual tab (and re-activate a
    //                           sensible neighbour). hideContextualTab() with NO id
    //                           removes EVERY contextual tab (Header & Footer relies
    //                           on this exact no-arg behaviour — the 257 gate asserts
    //                           `!document.querySelector('.contextual-tab')` after exit).
    hideContextualTab(id) {
      this._ctxTabs = this._ctxTabs || [];
      const ids = (id == null) ? this._ctxTabs.slice() : (this._ctxTabs.indexOf(id) !== -1 ? [id] : []);
      if (!ids.length && id == null && !this._ctxTab) return;
      ids.forEach((tid) => {
        this.tabstrip.querySelectorAll('.contextual-tab[data-tab="' + tid + '"]').forEach((t) => t.remove());
        this.body.querySelectorAll('.ribbon-panel[data-tab="' + tid + '"]').forEach((p) => p.remove());
        const at = this._ctxTabs.indexOf(tid);
        if (at !== -1) this._ctxTabs.splice(at, 1);
      });
      // Decide what to activate now: a remaining contextual tab, else the saved prev.
      if (this._ctxTabs.length) {
        const next = this._ctxTabs[this._ctxTabs.length - 1];
        this._ctxTab = next;
        // Only re-activate if the tab we just removed (or were on) is no longer present.
        if (!this.tabstrip.querySelector('.ribbon-tab.active') || ids.indexOf(this.activeTab) !== -1) this.activate(next);
      } else {
        // ALL contextual tabs are gone. Word only changes the active tab when the
        // disappearing tab WAS the active one — if the user explicitly picked a
        // regular tab while a contextual tab was showing, leaving the context must
        // NOT yank them back to the stale `_ctxPrev` (live-repro probe S1.5).
        // Header & Footer's exit still restores: its contextual tab IS active when
        // hideContextualTab() runs, so `ids` contains `this.activeTab`.
        const prev = this._ctxPrev || WC.RIBBON[0].id;
        const activeWasRemoved = ids.indexOf(this.activeTab) !== -1 || !this.tabstrip.querySelector('.ribbon-tab.active');
        this._ctxTab = null; this._ctxPrev = null;
        if (activeWasRemoved) this.activate(prev);
      }
    },

    syncToggles(st) {
      this.toggleNodes.forEach(({ node, cmd }) => {
        const key = TOGGLE_MAP[cmd];
        const on = !!st[key];
        node.classList.toggle('toggled', on);
      });
    },

    setComboValue(cmd, value) {
      const ent = this.controlIndex[cmd];
      if (ent && ent.input) ent.input.value = value;
    },
    setColorBar(cmd, color) {
      const bar = this.body.querySelector(`[data-colorbar="${cmd}"]`);
      if (bar) bar.style.background = color;
    },

    // ---- Phase 3 ribbon state machine ------------------------------------
    // A declarative per-control rule registry. Each rule is
    //   { enabled?(st)->bool, latched?(st)->bool, value?(st)->string }
    // evaluated every transaction by applyStateRules(st) (called from the
    // bridge state-sync tick). enabled→`wc-disabled` (greyed + click-blocked
    // via ribbon.css), latched→`toggled`, value→combo/input text. Sections
    // register their rules with WC.registerRibbonRule(cmd, rule).
    stateRules: {},
    registerStateRule(cmd, rule) {
      this.stateRules[cmd] = Object.assign(this.stateRules[cmd] || {}, rule);
    },
    applyStateRules(st) {
      for (const cmd in this.stateRules) {
        const r = this.stateRules[cmd];
        const ent = this.controlIndex[cmd];
        if (!ent || !ent.node) continue;
        if (r.enabled) ent.node.classList.toggle('wc-disabled', !r.enabled(st));
        if (r.latched) ent.node.classList.toggle('toggled', !!r.latched(st));
        if (r.value && ent.input && document.activeElement !== ent.input) ent.input.value = r.value(st);
      }
    },
  };

  WC.Ribbon = Ribbon;
  // Drain any state rules queued by section scripts that loaded BEFORE this file
  // (script order: section-features → ribbon.js — see WC.registerRibbonRule in
  // home-features.js), then route further registrations straight through.
  (WC._pendingStateRules || []).forEach(([cmd, rule]) => Ribbon.registerStateRule(cmd, rule));
  WC._pendingStateRules = null;
  WC.registerRibbonRule = (cmd, rule) => Ribbon.registerStateRule(cmd, rule);
})();
