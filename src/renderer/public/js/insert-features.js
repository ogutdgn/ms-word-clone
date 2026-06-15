/* insert-features.js — Insert tab: cover pages, shapes, icons, SmartArt,
   charts, fields, bookmarks, cross-references, symbol map, media, object. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;

  const Insert = {};
  WC.Insert = Insert;

  // ===================== Cover Page =====================
  const YEAR = new Date().getFullYear();
  function coverHTML(inner, bg) {
    return `<div class="cover-page" contenteditable="true" style="position:relative;width:100%;min-height:920px;box-sizing:border-box;${bg}">${inner}</div><div class="manual-break" style="break-after:page;page-break-after:always;height:0"></div><p><br></p>`;
  }
  const COVERS = [
    { name: 'Banded', build: () => coverHTML(`<div style="height:6px;background:#2B579A"></div><div style="padding:120px 96px 0"><h1 class="cover-field" style="font-size:40pt;color:#2B579A;margin:0">[Document Title]</h1><p class="cover-field" style="font-size:16pt;color:#666;margin:14pt 0">[Subtitle]</p></div><div style="position:absolute;bottom:96px;left:96px;right:96px"><div style="height:3px;background:#2B579A;margin-bottom:10px"></div><p class="cover-field" style="font-weight:bold;margin:2pt 0">[Author Name]</p><p style="color:#888;margin:2pt 0">${YEAR}</p></div>`, 'background:#fff') },
    { name: 'Facet', build: () => coverHTML(`<div style="position:absolute;top:0;left:0;width:0;height:0;border-top:300px solid #2B579A;border-right:200px solid transparent;opacity:.9"></div><div style="position:absolute;top:0;left:0;width:0;height:0;border-top:200px solid #41719C;border-right:340px solid transparent"></div><div style="padding:360px 96px 0"><h1 class="cover-field" style="font-size:34pt;margin:0;letter-spacing:1px">[DOCUMENT TITLE]</h1><p class="cover-field" style="font-size:14pt;color:#555">[Subtitle]</p></div><div style="position:absolute;bottom:90px;left:96px"><p class="cover-field" style="font-weight:bold;margin:0">[Author Name]</p><p style="color:#888;margin:4pt 0">${YEAR}</p></div>`, 'background:#fff') },
    { name: 'Filigree', build: () => coverHTML(`<div style="text-align:center;padding:180px 96px 0"><div style="font-size:40px;color:#7B2D43">❧</div><h1 class="cover-field" style="font-family:Georgia,serif;font-size:32pt;color:#7B2D43;margin:20px 0">[Document Title]</h1><div style="width:120px;height:2px;background:#7B2D43;margin:0 auto"></div><p class="cover-field" style="font-style:italic;color:#666;margin:18px 0">[Subtitle]</p></div><div style="position:absolute;bottom:96px;left:0;right:0;text-align:center"><p class="cover-field" style="margin:2pt 0">[Author Name]</p><p style="color:#888">${YEAR}</p></div>`, 'background:#FBF7F4') },
    { name: 'Ion', build: () => coverHTML(`<div style="padding:200px 96px 0"><h1 class="cover-field" style="font-size:48pt;font-weight:300;color:#222;margin:0">[Document<br>Title]</h1><p class="cover-field" style="font-size:14pt;color:#B33B15;margin:24px 0;text-transform:uppercase;letter-spacing:2px">[Subtitle]</p></div><div style="position:absolute;bottom:96px;left:96px"><p class="cover-field" style="font-weight:bold;margin:0;color:#B33B15">[Author Name]</p><p style="color:#888">${YEAR}</p></div>`, 'background:#F2F2F2') },
    { name: 'Motion', build: () => coverHTML(`<div style="position:absolute;top:0;left:0;right:0;height:280px;background:linear-gradient(120deg,#2B579A,#5B9BD5)"></div><div style="position:relative;padding:110px 96px 0;color:#fff"><h1 class="cover-field" style="font-size:36pt;margin:0">[Document Title]</h1><p class="cover-field" style="font-size:15pt;opacity:.9">[Subtitle]</p></div><div style="position:absolute;bottom:96px;left:96px"><p class="cover-field" style="font-weight:bold;margin:0">[Author Name]</p><p style="color:#888">${YEAR}</p></div>`, 'background:#fff') },
    { name: 'Retrospect', build: () => coverHTML(`<div style="position:absolute;bottom:0;left:0;right:0;height:340px;background:#C0392B"></div><div style="padding:160px 96px 0"><h1 class="cover-field" style="font-size:38pt;color:#C0392B;margin:0">[Document Title]</h1><p class="cover-field" style="font-size:14pt;color:#666">[Subtitle]</p></div><div style="position:absolute;bottom:90px;left:96px;color:#fff"><p class="cover-field" style="font-weight:bold;margin:0">[Author Name]</p><p style="opacity:.85">${YEAR}</p></div>`, 'background:#fff') },
  ];
  Insert.coverPageMenu = function (node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Built-in cover pages'));
      COVERS.forEach((t) => fly.appendChild(WC.flyItem(t.name, { onClick: () => Insert.insertCover(t) })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Remove Current Cover Page', { onClick: () => Insert.removeCover() }));
    });
  };
  Insert.insertCover = function (t) {
    WC.PM.xeCoverPage(t.name);
  };
  Insert.removeCover = function () {
    WC.PM.xeRemoveCoverPage();
  };

  // ===================== Table dropdown =====================
  Insert.buildTable = function (rows, cols) {
    rows = Math.max(1, Math.min(1000, rows | 0)); cols = Math.max(1, Math.min(1000, cols | 0));
    WC.PM.insertTable({ rows, cols });
  };
  Insert.convertTextToTable = function () {
    WC.toast('Convert Text to Table is available in Table Tools (slice 6b)');
  };
  Insert.tableMenu = function (node) {
    WC.flyout(node, (fly) => {
      const ROWS = 8, COLS = 10;
      const label = el('div', { class: 'tablegrid-label', text: 'Insert Table' });
      const grid = el('div', { class: 'tablegrid' });
      const cells = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const cell = el('div', { class: 'cell', dataset: { r, c } }); cell.addEventListener('mouseenter', () => { cells.forEach((cl) => cl.classList.toggle('on', +cl.dataset.r <= r && +cl.dataset.c <= c)); label.textContent = `${c + 1} × ${r + 1} Table`; }); cell.addEventListener('click', () => { WC.closeFlyouts(); Insert.buildTable(r + 1, c + 1); }); cells.push(cell); grid.appendChild(cell); }
      fly.appendChild(label); fly.appendChild(grid); fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Insert Table…', { onClick: () => WC.Dialogs.insertTable() }));
      fly.appendChild(WC.flyItem('Draw Table', { onClick: () => Insert.drawTableMode() }));
      fly.appendChild(WC.flyItem('Convert Text to Table…', { onClick: () => Insert.convertTextToTable() }));
      fly.appendChild(WC.flyItem('Excel Spreadsheet', { onClick: () => Insert.insertExcelSheet() }));
      fly.appendChild(WC.flyItem('Quick Tables', { onClick: () => Insert.quickTablesMenu(node) }));
    });
  };
  // Draw Table — cursor becomes a pen; drag a rectangle on the page to create a
  // table whose rows/columns derive from the size you draw (Word behavior).
  Insert.drawTableMode = function () {
    const ed = WC.PM.getEditor().view.dom; const canvas = document.getElementById('canvas');
    ed.style.cursor = 'crosshair';
    WC.toast('Draw Table: drag on the page to draw the table’s outer border.');
    let start = null, rect = null;
    const z = () => (window.WC.PM && window.WC.PM.zoom) || 1;
    const down = (e) => { start = { x: e.clientX, y: e.clientY }; rect = el('div', { style: { position: 'fixed', border: '2px solid #2b579a', background: 'rgba(43,87,154,.08)', zIndex: '9000', pointerEvents: 'none' } }); document.body.appendChild(rect); e.preventDefault(); };
    const move = (e) => { if (!start) return; const x = Math.min(start.x, e.clientX), y = Math.min(start.y, e.clientY), w = Math.abs(e.clientX - start.x), h = Math.abs(e.clientY - start.y); Object.assign(rect.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); };
    const up = (e) => {
      cleanup();
      if (!start) return;
      const w = Math.abs(e.clientX - start.x) / z(), h = Math.abs(e.clientY - start.y) / z();
      const cols = Math.max(1, Math.round(w / 90)), rows = Math.max(1, Math.round(h / 36));
      start = null;
      Insert.buildTable(rows, cols);
    };
    function cleanup() { ed.style.cursor = ''; if (rect) { rect.remove(); rect = null; } canvas.removeEventListener('mousedown', down, true); window.removeEventListener('mousemove', move, true); window.removeEventListener('mouseup', up, true); }
    canvas.addEventListener('mousedown', down, true); window.addEventListener('mousemove', move, true); window.addEventListener('mouseup', up, true);
  };
  Insert.insertExcelSheet = function () {
    // Embedded Excel sheets are OLE objects with no PM-engine equivalent; honest
    // degrade until/unless an embed subsystem lands.
    WC.toast('Embedding an Excel spreadsheet needs a host runtime — not available on the new engine yet.');
  };
  Insert.quickTablesMenu = function (node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Quick Tables'));
      [['Calendar', () => Insert.buildTable(6, 7)], ['Tabular List', () => Insert.buildTable(4, 2)], ['Matrix', () => Insert.buildTable(4, 4)], ['Double Table', () => Insert.buildTable(5, 3)]].forEach(([name, fn]) => fly.appendChild(WC.flyItem(name, { onClick: fn })));
    });
  };

  // ===================== Shapes =====================
  const SHAPES = {
    Lines: [['Line', '<line x1="4" y1="46" x2="46" y2="4" stroke="COL" stroke-width="2"/>'], ['Arrow', '<line x1="4" y1="46" x2="42" y2="8" stroke="COL" stroke-width="2"/><path d="M42 8 L34 10 L40 16 Z" fill="COL"/>']],
    Rectangles: [['Rectangle', '<rect x="4" y="12" width="42" height="26" fill="COL"/>'], ['Rounded Rectangle', '<rect x="4" y="12" width="42" height="26" rx="6" fill="COL"/>']],
    'Basic Shapes': [['Oval', '<ellipse cx="25" cy="25" rx="21" ry="14" fill="COL"/>'], ['Triangle', '<path d="M25 6 L46 44 L4 44 Z" fill="COL"/>'], ['Diamond', '<path d="M25 5 L45 25 L25 45 L5 25 Z" fill="COL"/>'], ['Pentagon', '<path d="M25 5 L45 20 L37 44 L13 44 L5 20 Z" fill="COL"/>'], ['Hexagon', '<path d="M14 8 L36 8 L46 25 L36 42 L14 42 L4 25 Z" fill="COL"/>']],
    'Block Arrows': [['Right Arrow', '<path d="M4 18 L30 18 L30 10 L46 25 L30 40 L30 32 L4 32 Z" fill="COL"/>'], ['Left Arrow', '<path d="M46 18 L20 18 L20 10 L4 25 L20 40 L20 32 L46 32 Z" fill="COL"/>'], ['Up Arrow', '<path d="M18 46 L18 20 L10 20 L25 4 L40 20 L32 20 L32 46 Z" fill="COL"/>']],
    'Stars and Banners': [['5-Point Star', '<path d="M25 3 L31 19 L48 19 L34 30 L39 47 L25 36 L11 47 L16 30 L2 19 L19 19 Z" fill="COL"/>'], ['4-Point Star', '<path d="M25 4 L30 20 L46 25 L30 30 L25 46 L20 30 L4 25 L20 20 Z" fill="COL"/>']],
    Callouts: [['Speech Bubble', '<path d="M4 6 H46 V34 H22 L12 44 L14 34 H4 Z" fill="COL"/>']],
  };
  Insert.shapesMenu = function (node) {
    WC.flyout(node, (fly) => {
      Object.keys(SHAPES).forEach((cat) => {
        fly.appendChild(WC.flyHeader(cat));
        const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6,30px)', gap: '3px', padding: '2px 10px 6px' } });
        SHAPES[cat].forEach(([name, svg]) => {
          const cell = el('div', { title: name, style: { width: '30px', height: '30px', border: '1px solid #eee', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px' }, html: `<svg viewBox="0 0 50 50" width="24" height="24">${svg.replace(/COL/g, '#5B9BD5')}</svg>` });
          cell.addEventListener('click', () => { WC.closeFlyouts(); Insert.insertShape(name, svg); });
          grid.appendChild(cell);
        });
        fly.appendChild(grid);
      });
    });
  };
  Insert.insertShape = function (name, svg) {
    // No PM verb for auto-shapes (DrawingML wps:sp) yet; honest degrade rather
    // than the deleted WC.Editor legacy inline-SVG path.
    WC.toast('Inserting “' + name + '” shapes isn\'t available on the new engine yet.');
  };

  // ===================== Icons picker =====================
  Insert.iconsPicker = function () {
    const NAMES = Object.keys(WC._iconNames || {});
    const all = WC.ICON_NAMES || ['save', 'find', 'table', 'pictures', 'shapes', 'chart', 'link', 'comment', 'bookmark', 'symbol', 'equation', 'header', 'footer', 'pageNumber', 'wordArt', 'dropCap', 'paste', 'cut', 'copy', 'bold', 'italic', 'underline', 'alignLeft', 'center', 'alignRight', 'justify', 'bullets', 'numbering', 'undo', 'redo', 'zoom', 'readAloud', 'translate', 'spellingGrammar', 'thesaurus', 'wordCount', 'printLayout', 'webLayout', 'ruler', 'gridlines', 'navigationPane', 'share', 'search'];
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: '6px', maxHeight: '300px', overflowY: 'auto' } });
    const search = el('input', { type: 'text', class: 'grow', placeholder: 'Search icons' });
    function render() {
      grid.innerHTML = '';
      const q = search.value.toLowerCase();
      all.filter((n) => n.toLowerCase().includes(q)).forEach((n) => {
        const cell = el('div', { title: n, style: { border: '1px solid #eee', borderRadius: '3px', padding: '8px 4px', textAlign: 'center', cursor: 'pointer' }, html: WC.icon(n, 24) });
        cell.addEventListener('mouseenter', () => cell.style.background = 'var(--word-blue-tint)');
        cell.addEventListener('mouseleave', () => cell.style.background = '');
        cell.addEventListener('click', () => { dlg.close(); WC.PM.xeIcon(n); });
        grid.appendChild(cell);
      });
    }
    search.addEventListener('input', render); render();
    const dlg = WC.dialog({ title: 'Insert Icons', width: '520px', body: el('div', {}, [el('div', { class: 'row' }, [search]), grid]), footer: [{ label: 'Close', primary: true }] });
  };

  // ===================== SmartArt =====================
  Insert.smartArtMenu = function (node) {
    const layouts = [['Basic List', 'list'], ['Basic Process', 'process'], ['Cycle', 'cycle'], ['Hierarchy', 'hierarchy']];
    WC.flyout(node, (fly) => { fly.appendChild(WC.flyHeader('SmartArt Graphics')); layouts.forEach(([l, k]) => fly.appendChild(WC.flyItem(l, { onClick: () => Insert.insertSmartArt(k) }))); });
  };
  Insert.insertSmartArt = function (kind) {
    WC.PM.xeSmartArt();
  };

  // ===================== Chart =====================
  Insert.chartDialog = function () {
    const type = el('select', {}, ['Column', 'Bar', 'Line', 'Pie'].map((t) => el('option', { text: t })));
    const data = el('textarea', { class: 'grow', rows: '6', style: { fontFamily: 'monospace' } });
    data.value = 'Q1, 8.2\nQ2, 3.2\nQ3, 1.4\nQ4, 1.2';
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Chart type:', style: { width: '90px' } }), type]),
      el('div', { style: { fontSize: '12px', color: '#666', margin: '6px 0' }, text: 'Data (label, value per line):' }), data,
    ]);
    WC.dialog({ title: 'Insert Chart', width: '460px', body, footer: [
      { label: 'OK', primary: true, onClick: () => { WC.PM.xeChart(); } },
      { label: 'Cancel' },
    ] });
  };
  Insert.chartSVG = function (type, rows) {
    const W = 420, Hh = 260, pad = 36; const max = Math.max(1, ...rows.map((r) => r[1]));
    const colors = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
    let body = '';
    if (type === 'Pie') {
      const total = rows.reduce((a, b) => a + b[1], 0) || 1; let ang = -Math.PI / 2; const cx = W / 2, cy = Hh / 2, r = 90;
      rows.forEach((row, i) => { const a2 = ang + (row[1] / total) * Math.PI * 2; const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang), x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2); const large = (a2 - ang) > Math.PI ? 1 : 0; body += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${colors[i % colors.length]}"/>`; ang = a2; });
    } else if (type === 'Line') {
      const stepX = (W - pad * 2) / Math.max(1, rows.length - 1); let pts = rows.map((r, i) => `${pad + i * stepX},${Hh - pad - (r[1] / max) * (Hh - pad * 2)}`).join(' ');
      body += `<polyline points="${pts}" fill="none" stroke="#4472C4" stroke-width="2"/>`; rows.forEach((r, i) => { body += `<circle cx="${pad + i * stepX}" cy="${Hh - pad - (r[1] / max) * (Hh - pad * 2)}" r="3" fill="#4472C4"/><text x="${pad + i * stepX}" y="${Hh - 12}" font-size="10" text-anchor="middle" fill="#666">${WC.escapeHtml(r[0])}</text>`; });
    } else {
      const n = rows.length; const bw = (W - pad * 2) / n * 0.6; const gap = (W - pad * 2) / n;
      rows.forEach((r, i) => { const bh = (r[1] / max) * (Hh - pad * 2); const x = pad + i * gap + (gap - bw) / 2; const y = Hh - pad - bh; if (type === 'Bar') { const bwH = (r[1] / max) * (W - pad * 2); body += `<rect x="${pad}" y="${pad + i * gap + (gap - bw) / 2}" width="${bwH}" height="${bw}" fill="${colors[i % colors.length]}"/><text x="${pad - 4}" y="${pad + i * gap + gap / 2}" font-size="10" text-anchor="end" fill="#666">${WC.escapeHtml(r[0])}</text>`; } else { body += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${colors[i % colors.length]}"/><text x="${x + bw / 2}" y="${Hh - 12}" font-size="10" text-anchor="middle" fill="#666">${WC.escapeHtml(r[0])}</text>`; } });
    }
    return `<span class="wc-shape" contenteditable="false" data-chart="${type}" style="display:inline-block"><svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" style="border:1px solid #eee;background:#fff">${body}</svg></span>`;
  };

  // ===================== Date & Time =====================
  Insert.dateTimeDialog = function () {
    const now = new Date();
    const fmts = [now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), now.toLocaleDateString(), now.toISOString().slice(0, 10), now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), now.toLocaleTimeString(), now.toLocaleString()];
    const list = el('select', { size: '7', class: 'grow', style: { height: 'auto' } }, fmts.map((f, i) => el('option', { value: String(i), text: f, selected: i === 0 ? 'selected' : null })));
    const upd = el('input', { type: 'checkbox' });
    const body = el('div', {}, [el('div', { style: { fontSize: '12px', color: '#666' }, text: 'Available formats:' }), list, el('label', { style: { display: 'flex', gap: '6px', marginTop: '8px' } }, [upd, el('span', { text: 'Update automatically' })])]);
    WC.dialog({ title: 'Date and Time', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: () => { WC.PM.xeDateTime(['MMMM d, yyyy', 'M/d/yyyy', 'yyyy-MM-dd', 'dddd, MMMM d, yyyy', 'h:mm AM/PM', 'M/d/yyyy h:mm AM/PM'][+list.value] || 'M/d/yyyy'); } },
      { label: 'Cancel' },
    ] });
  };

  // ===================== WordArt =====================
  const WORDART = [
    'color:#2B579A;text-shadow:1px 1px 2px rgba(0,0,0,.3)', 'color:#C0392B;-webkit-text-stroke:1px #7a2318',
    'color:#fff;-webkit-text-stroke:1px #4472C4;text-shadow:2px 2px 0 #4472C4', 'background:linear-gradient(#4472C4,#1F3864);-webkit-background-clip:text;-webkit-text-fill-color:transparent',
    'color:#70AD47;text-shadow:0 0 8px #70AD47', 'color:#ED7D31;transform:skewX(-8deg);display:inline-block',
  ];
  Insert.wordArtMenu = function (node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('WordArt Styles'));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,60px)', gap: '4px', padding: '4px 10px' } });
      WORDART.forEach((s, i) => { const cell = el('div', { style: { border: '1px solid #eee', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', font: 'bold 22px Calibri' } }); cell.setAttribute('style', cell.getAttribute('style') + ';' + s); cell.textContent = 'A'; cell.addEventListener('click', () => { WC.closeFlyouts(); Insert.insertWordArt(s); }); grid.appendChild(cell); });
      fly.appendChild(grid);
    });
  };
  Insert.insertWordArt = function (style) {
    const sel = window.getSelection(); const txt = (sel && sel.toString()) || 'Your text here';
    const mc = /color:\s*(#[0-9a-fA-F]{3,6})/.exec(style);
    WC.PM.xeWordArt(txt, { color: mc ? mc[1] : '#2B579A' });
  };

  // ===================== Signature Line =====================
  Insert.signatureLine = function () {
    const name = el('input', { type: 'text', class: 'grow', placeholder: 'Suggested signer' });
    const title = el('input', { type: 'text', class: 'grow', placeholder: 'Suggested signer’s title' });
    const body = el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Signer:', style: { width: '60px' } }), name]), el('div', { class: 'row' }, [el('label', { text: 'Title:', style: { width: '60px' } }), title])]);
    WC.dialog({ title: 'Signature Setup', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: () => { WC.PM.xeSignatureLine(); } },
      { label: 'Cancel' },
    ] });
  };

  // ===================== Quick Parts (fields) =====================
  Insert.quickPartsMenu = function (node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('Quick Parts'));
      fly.appendChild(WC.flyItem('Field…', { onClick: () => Insert.fieldDialog() }));
      fly.appendChild(WC.flyItem('Document Property', { onClick: () => Insert.insertField('title') }));
      fly.appendChild(WC.flySep());
      [['Page', 'page'], ['Number of Pages', 'numpages'], ['Date', 'date'], ['Author', 'author'], ['File Name', 'filename']].forEach(([l, k]) => fly.appendChild(WC.flyItem(l, { onClick: () => Insert.insertField(k) })));
    });
  };
  Insert.fieldDialog = function () {
    const sel = el('select', { size: '6', class: 'grow', style: { height: 'auto' } }, [['Page', 'page'], ['NumPages', 'numpages'], ['Date', 'date'], ['Author', 'author'], ['FileName', 'filename'], ['Title', 'title']].map(([l, k]) => el('option', { value: k, text: l })));
    WC.dialog({ title: 'Field', width: '380px', body: el('div', {}, [el('div', { style: { fontSize: '12px', color: '#666' }, text: 'Field names:' }), sel]), footer: [{ label: 'OK', primary: true, onClick: () => Insert.insertField(sel.value) }, { label: 'Cancel' }] });
  };
  Insert.insertField = function (k) { WC.PM.xeQuickPart(k); };

  // ===================== Bookmark =====================
  Insert.bookmarkDialog = function () {
    WC.PM.captureSelection(); Insert._bookmarkDialogPM(WC.PM);
  };
  // M2: full PM bookmark dialog — lists, adds, goes-to, deletes, re-renders on mutation.
  Insert._bookmarkDialogPM = function (pm) {
    const name = el('input', { type: 'text', class: 'grow', placeholder: 'Bookmark name' });
    const listBox = el('div', { style: { border: '1px solid #c8c6c4', maxHeight: '140px', overflowY: 'auto', margin: '8px 0' } });
    function renderList() {
      listBox.innerHTML = '';
      const bms = pm.listBookmarks();
      if (!bms.length) { listBox.appendChild(el('div', { style: { padding: '8px', color: '#888' }, text: 'No bookmarks yet.' })); return; }
      bms.forEach((b) => {
        const row = el('div', { style: { padding: '5px 8px', cursor: 'pointer', display: 'flex' } }, [
          el('span', { style: { flex: 1 }, text: b.name }),
          el('span', { style: { color: '#2B579A', marginRight: '8px' }, text: 'Go To', onclick: () => { pm.goToBookmark(b.name); } }),
          el('span', { style: { color: '#c0392b' }, text: 'Delete', onclick: () => { pm.removeBookmark(b.name); renderList(); } }),
        ]);
        row.querySelector('span').addEventListener('click', () => { name.value = b.name; });
        listBox.appendChild(row);
      });
    }
    renderList();
    WC.dialog({ title: 'Bookmark', width: '380px', body: el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Name:', style: { width: '60px' } }), name]), listBox]), footer: [
      { label: 'Add', primary: true, onClick: () => { const n = name.value.trim().replace(/\s+/g, '_'); if (!n) return; pm.withSelection(() => pm.insertBookmark({ name: n })); name.value = ''; renderList(); WC.toast('Bookmark “' + n + '” added.'); } },
      { label: 'Close' },
    ] });
  };

  // ===================== Cross-reference =====================
  // (legacy Insert.crossRefDialog removed at slice 11 — H.crossReference dispatches
  //  to the PM dialog crossRefDialogPM(WC.PM) in commands.js; this DOM-walking arm
  //  referenced the deleted WC.Editor and had no caller.)

  // ===================== Symbol map dialog =====================
  const SUBSETS = {
    'Common': '© ® ™ ° µ ± × ÷ ≈ ≠ ≤ ≥ ∞ √ π Σ Ω ∆ ∂ ∫ € £ ¥ ¢ § ¶ † ‡ • … “ ” ‘ ’ « » — –',
    'Arrows': '← ↑ → ↓ ↔ ↕ ⇐ ⇒ ⇑ ⇓ ⇔ ➤ ➜ ↩ ↪ ⤴ ⤵ ⟲ ⟳',
    'Math': '∀ ∃ ∅ ∈ ∉ ∋ ∏ ∑ − ∗ ∝ ∠ ∧ ∨ ∩ ∪ ∴ ∼ ≅ ≡ ⊂ ⊃ ⊆ ⊇',
    'Greek': 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω',
    'Currency': '$ € £ ¥ ¢ ₹ ₽ ₩ ₪ ₫ ₴ ₦ ฿ ₡ ₱',
    'Dingbats': '★ ☆ ♥ ♦ ♣ ♠ ✓ ✔ ✗ ✘ ☺ ☹ ☀ ☁ ☂ ✉ ✂ ✈ ⚑ ⚠',
  };
  Insert.symbolDialog = function () {
    const recent = JSON.parse(sessionStorage.getItem('wc-recent-sym') || '[]');
    const subset = el('select', {}, Object.keys(SUBSETS).map((s) => el('option', { text: s })));
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(12,30px)', gap: '2px', maxHeight: '220px', overflowY: 'auto', border: '1px solid #e1dfdd', padding: '4px' } });
    const recentRow = el('div', { style: { display: 'flex', gap: '2px', flexWrap: 'wrap', minHeight: '24px', marginTop: '4px' } });
    function pushRecent(ch) { const r = JSON.parse(sessionStorage.getItem('wc-recent-sym') || '[]').filter((x) => x !== ch); r.unshift(ch); sessionStorage.setItem('wc-recent-sym', JSON.stringify(r.slice(0, 16))); renderRecent(); }
    function renderRecent() { recentRow.innerHTML = ''; (JSON.parse(sessionStorage.getItem('wc-recent-sym') || '[]')).forEach((ch) => { const c = el('div', { text: ch, style: { width: '24px', height: '24px', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } }); c.addEventListener('click', () => { WC.PM.insertSymbol(ch); }); recentRow.appendChild(c); }); }
    function render() { grid.innerHTML = ''; SUBSETS[subset.value].split(' ').forEach((ch) => { if (!ch) return; const c = el('div', { text: ch, style: { width: '30px', height: '30px', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' } }); c.addEventListener('mouseenter', () => c.style.background = 'var(--word-blue-tint)'); c.addEventListener('mouseleave', () => c.style.background = ''); c.addEventListener('click', () => { WC.PM.insertSymbol(ch); pushRecent(ch); }); grid.appendChild(c); }); }
    subset.addEventListener('change', render); render(); renderRecent();
    const body = el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'Subset:', style: { width: '60px' } }), subset]), grid, el('div', { style: { fontSize: '11px', color: '#666', marginTop: '8px' }, text: 'Recently used symbols:' }), recentRow]);
    WC.dialog({ title: 'Symbol', width: '480px', body, footer: [{ label: 'Close', primary: true }] });
  };

  // ===================== Object / Online Video / Screenshot =====================
  Insert.objectMenu = function (node) {
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Text from File…', { onClick: () => Insert.textFromFile() }));
      fly.appendChild(WC.flyItem('Object… (Create New)', { onClick: () => WC.toast('Embedding OLE objects (Excel sheets, etc.) needs a host runtime — not available in this clone.', 'See docs/NOT_IMPLEMENTED.md') }));
    });
  };
  Insert.textFromFile = async function () {
    const r = await window.wordAPI.open();
    if (r && r.ok) {
      WC.PM.pasteHTMLString(WC.Files.sanitize(r.html)); WC.toast('Inserted contents of ' + r.name);
    }
  };
  Insert.onlineVideoDialog = function () {
    const url = el('input', { type: 'text', class: 'grow', placeholder: 'Paste a video URL (YouTube, Vimeo…)' });
    WC.dialog({ title: 'Insert Online Video', width: '460px', body: el('div', {}, [el('div', { class: 'row' }, [el('label', { text: 'URL:', style: { width: '50px' } }), url]), el('div', { style: { fontSize: '12px', color: '#666', marginTop: '6px' }, text: 'A video thumbnail (poster) is inserted; embedded playback is restricted by the app sandbox.' })]), footer: [
      { label: 'Insert', primary: true, onClick: () => { const u = WC.safeUrl(url.value.trim()); if (u === '#') return; Insert.insertVideoThumbnail(u); } },
      { label: 'Cancel' },
    ] });
  };
  // Insert a real, visible video poster: a self-contained SVG data-URL (the CSP is
  // img-src 'self' data: blob:, so remote provider thumbnails are blocked) with a
  // play button + host + URL. It goes in as a normal image node, so it's
  // selectable / movable / deletable like any picture. Embedded playback stays
  // sandbox-restricted; the link is preserved in the image description.
  Insert.insertVideoThumbnail = function (videoUrl) {
    const u = String(videoUrl || '');
    let host = 'Online Video';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (_) { /* keep default */ }
    const disp = u.length > 54 ? u.slice(0, 51) + '…' : u;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#0d0d0d"/></linearGradient></defs>' +
      '<rect width="480" height="270" fill="url(#g)"/>' +
      '<circle cx="240" cy="116" r="42" fill="#ff0000" opacity="0.92"/>' +
      '<path d="M226 94 L226 138 L264 116 Z" fill="#ffffff"/>' +
      '<text x="240" y="206" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="bold" text-anchor="middle">' + esc(host) + '</text>' +
      '<text x="240" y="232" fill="#c8c8c8" font-family="Arial,Helvetica,sans-serif" font-size="12" text-anchor="middle">' + esc(disp) + '</text>' +
      '</svg>';
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    if (WC.Commands && WC.Commands.insertPictureFromDataUrl) {
      WC.Commands.insertPictureFromDataUrl(dataUrl, 'Online video: ' + u);
    } else {
      WC.PM.insertImage({ src: dataUrl, alt: 'Online video: ' + u, width: 480, height: 270 });
    }
    if (WC.toast) WC.toast('Inserted a video thumbnail', 'Embedded playback is restricted by the app sandbox; the video URL is kept as the image description.');
  };
  Insert.screenshot = async function () {
    if (!window.wordAPI.screenshot) { WC.toast('Screenshot capture is not available in this build.'); return; }
    const r = await window.wordAPI.screenshot();
    if (r && r.ok) { WC.PM.insertImage({ src: r.dataUrl, alt: 'Screenshot' }); return; }
    WC.toast('Screenshot ' + (r && r.error ? 'failed: ' + r.error : 'canceled') + '.');
  };
})();
