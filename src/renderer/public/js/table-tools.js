/* table-tools.js — table editing: context menu + insert/delete rows & columns,
   merge cells, delete table. Operates on the HTML <table> inside #editor. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;

  function up(node, tag) { let n = node && node.nodeType === 3 ? node.parentNode : node; while (n && n !== E().node && n.tagName !== tag) n = n.parentNode; return n && n.tagName === tag ? n : null; }
  function caretCell() { const sel = window.getSelection(); if (!sel.rangeCount) return null; return up(sel.anchorNode, 'TD') || up(sel.anchorNode, 'TH'); }
  function colIndex(cell) { const row = cell.parentNode; return Array.prototype.indexOf.call(row.children, cell); }
  // Colspan-aware grid helpers: map a row to its visual columns so column ops are
  // correct even when cells are merged (colspan > 1).
  function visualCols(row) { const map = []; let v = 0; Array.from(row.children).forEach((c) => { const sp = parseInt(c.getAttribute('colspan') || '1', 10); for (let i = 0; i < sp; i++) map[v++] = { cell: c, isStart: i === 0 }; }); return map; }
  function visualColOf(cell) { let v = 0, n = cell.previousElementSibling; while (n) { v += parseInt(n.getAttribute('colspan') || '1', 10); n = n.previousElementSibling; } return v; }
  function totalCols(table) { const r = table.querySelector('tr'); return r ? visualCols(r).length : 0; }
  function tableOf(cell) { return up(cell, 'TABLE'); }
  function rowsOf(table) { return Array.from(table.querySelectorAll('tr')); }

  // B2 belt-and-suspenders: in PM mode the legacy #editor is hidden (unreachable
  // by pointer), but direct JS calls could still bypass the PM engine. Block them.
  const pmBlock = () => { const pm = window.WC.PM; if (pm && pm.active && pm.ready) { pm.notifyBlocked('Table edit'); return true; } return false; };

  const Table = {
    currentCell: caretCell,
    currentTable() { const c = caretCell(); return c ? tableOf(c) : null; },
    isInTable() { return !!caretCell(); },

    insertRow(dir, cell) {
      if (pmBlock()) return;
      cell = cell || caretCell(); if (!cell) return;
      const row = cell.parentNode; const cols = row.children.length;
      const nr = document.createElement('tr');
      for (let i = 0; i < cols; i++) nr.appendChild(makeCell());
      if (dir === 'above') row.parentNode.insertBefore(nr, row); else row.parentNode.insertBefore(nr, row.nextSibling);
      done();
    },
    deleteRow(cell) {
      if (pmBlock()) return;
      cell = cell || caretCell(); if (!cell) return;
      const row = cell.parentNode; const table = tableOf(cell);
      if (rowsOf(table).length <= 1) { return this.deleteTable(cell); }
      row.remove(); done();
    },
    insertColumn(dir, cell) {
      if (pmBlock()) return;
      cell = cell || caretCell(); if (!cell) return;
      const table = tableOf(cell);
      const vcol = visualColOf(cell);
      const at = dir === 'left' ? vcol : vcol + parseInt(cell.getAttribute('colspan') || '1', 10);
      rowsOf(table).forEach((row) => {
        const map = visualCols(row); const hit = map[at];
        if (hit && !hit.isStart) { hit.cell.setAttribute('colspan', parseInt(hit.cell.getAttribute('colspan') || '1', 10) + 1); } // insertion falls inside a merged cell -> widen it
        else row.insertBefore(makeCell(), hit ? hit.cell : null);
      });
      done();
    },
    deleteColumn(cell) {
      if (pmBlock()) return;
      cell = cell || caretCell(); if (!cell) return;
      const table = tableOf(cell);
      if (totalCols(table) <= 1) return this.deleteTable(cell);
      const vcol = visualColOf(cell);
      rowsOf(table).forEach((row) => {
        const hit = visualCols(row)[vcol]; if (!hit) return;
        const sp = parseInt(hit.cell.getAttribute('colspan') || '1', 10);
        if (sp > 1) hit.cell.setAttribute('colspan', sp - 1); else hit.cell.remove();
      });
      done();
    },
    deleteTable(cell) { if (pmBlock()) return; cell = cell || caretCell(); const t = cell ? tableOf(cell) : this.currentTable(); if (t) { t.remove(); done(); } },
    mergeRight(cell) {
      if (pmBlock()) return;
      cell = cell || caretCell(); if (!cell) return; const next = cell.nextElementSibling; if (!next) { WC.toast('No cell to the right to merge.'); return; }
      const span = parseInt(cell.getAttribute('colspan') || '1', 10) + parseInt(next.getAttribute('colspan') || '1', 10);
      cell.setAttribute('colspan', span); cell.innerHTML += ' ' + next.innerHTML; next.remove(); done();
    },
    splitCell(cell) {
      if (pmBlock()) return;
      cell = cell || caretCell(); if (!cell) return; const span = parseInt(cell.getAttribute('colspan') || '1', 10);
      // Split only THIS cell within its own row (a merged cell un-merges by one;
      // a normal cell becomes two) — never add a whole column to every row.
      if (span > 1) cell.setAttribute('colspan', span - 1);
      cell.parentNode.insertBefore(makeCell(), cell.nextSibling);
      done();
    },

    contextMenu(cell, x, y) {
      WC.closeFlyouts();
      const fly = el('div', { class: 'flyout' });
      const item = (label, fn, icon) => { const it = WC.flyItem(label, { onClick: fn, icon }); fly.appendChild(it); };
      item('Insert Row Above', () => this.insertRow('above', cell));
      item('Insert Row Below', () => this.insertRow('below', cell));
      item('Insert Column Left', () => this.insertColumn('left', cell));
      item('Insert Column Right', () => this.insertColumn('right', cell));
      fly.appendChild(WC.flySep());
      item('Delete Row', () => this.deleteRow(cell));
      item('Delete Column', () => this.deleteColumn(cell));
      item('Delete Table', () => this.deleteTable(cell));
      fly.appendChild(WC.flySep());
      item('Merge With Right Cell', () => this.mergeRight(cell));
      item('Split Cell', () => this.splitCell(cell));
      document.body.appendChild(fly);
      fly.style.left = Math.min(x, window.innerWidth - fly.offsetWidth - 4) + 'px';
      fly.style.top = Math.min(y, window.innerHeight - fly.offsetHeight - 4) + 'px';
      const close = (e) => { if (!fly.contains(e.target)) { fly.remove(); document.removeEventListener('mousedown', close, true); } };
      setTimeout(() => document.addEventListener('mousedown', close, true), 0);
    },
  };
  function makeCell() { const td = document.createElement('td'); td.innerHTML = '<br>'; return td; }
  function done() { E().dirty = true; E().repaginate(); E().updateStatus(); E().emit(); }
  WC.Table = Table;
})();
