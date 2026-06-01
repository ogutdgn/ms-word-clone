/* draw-tools.js — Draw tab: a real freehand ink layer (SVG) over the document.
   Pen / Pencil / Highlighter, color + thickness, eraser, select, clear.
   Strokes live inside #editor (contenteditable=false) so they save with the doc. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;
  const SVGNS = 'http://www.w3.org/2000/svg';

  const PENS = [
    { id: 'pen', name: 'Pen', color: '#000000', width: 2, opacity: 1 },
    { id: 'pen-blue', name: 'Pen (Blue)', color: '#2B579A', width: 2, opacity: 1 },
    { id: 'pen-red', name: 'Pen (Red)', color: '#C00000', width: 2, opacity: 1 },
    { id: 'pencil', name: 'Pencil', color: '#595959', width: 1.2, opacity: 0.85 },
    { id: 'highlighter', name: 'Highlighter (Yellow)', color: '#FFFF00', width: 14, opacity: 0.4 },
    { id: 'highlighter-green', name: 'Highlighter (Green)', color: '#92D050', width: 14, opacity: 0.4 },
  ];

  const Draw = {
    enabled: false,
    tool: 'pen',          // pen | highlighter | pencil | eraser | select
    pen: PENS[0],
    customPens: [],
    layer: null,
    drawing: false,
    pts: [],
    curPath: null,
    eraseRadius: 10,

    ensureLayer() {
      let layer = E().node.querySelector('.ink-layer');
      if (!layer) {
        layer = document.createElementNS(SVGNS, 'svg');
        layer.setAttribute('class', 'ink-layer');
        layer.setAttribute('contenteditable', 'false');
        E().node.appendChild(layer);
      }
      this.layer = layer;
      this.size();
      return layer;
    },
    size() {
      if (!this.layer) return;
      const w = E().node.clientWidth, h = Math.max(E().node.scrollHeight, E().node.clientHeight);
      this.layer.setAttribute('width', w); this.layer.setAttribute('height', h);
      this.layer.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.layer.style.width = w + 'px'; this.layer.style.height = h + 'px';
    },

    setEnabled(on) {
      this.enabled = on;
      this.ensureLayer();
      document.getElementById('app').classList.toggle('ink-on', on);
      // While drawing, the text surface must not take edits/selection.
      E().node.setAttribute('contenteditable', on ? 'false' : 'true');
      const btn = WC.Ribbon.controlIndex.drawing && WC.Ribbon.controlIndex.drawing.node;
      if (btn) btn.classList.toggle('toggled', on);
      if (on) { this.bind(); WC.toast('Drawing mode on — draw with the mouse. Toggle Drawing to stop.'); }
      else { this.unbind(); }
    },
    toggle() { this.setEnabled(!this.enabled); },

    setTool(tool) { this.tool = tool; this.refreshCursor(); this.markToolButtons(); },
    setPen(pen) { this.pen = pen; this.tool = pen.id.startsWith('highlighter') ? 'highlighter' : pen.id === 'pencil' ? 'pencil' : 'pen'; if (!this.enabled) this.setEnabled(true); this.refreshCursor(); this.markToolButtons(); },

    refreshCursor() {
      if (!this.layer) return;
      this.layer.style.cursor = this.tool === 'eraser' ? 'cell' : this.tool === 'select' ? 'default' : 'crosshair';
    },
    markToolButtons() {
      ['eraser', 'selectObjects', 'lassoSelect'].forEach((cmd) => { const e2 = WC.Ribbon.controlIndex[cmd]; if (e2 && e2.node) e2.node.classList.toggle('toggled', (cmd === 'eraser' && this.tool === 'eraser') || (cmd === 'selectObjects' && this.tool === 'select') || (cmd === 'lassoSelect' && this.tool === 'lasso')); });
    },

    bind() {
      if (this._bound) return;
      this._down = (e) => this.onDown(e); this._move = (e) => this.onMove(e); this._up = (e) => this.onUp(e);
      this._key = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && this.tool === 'select') { e.preventDefault(); this.deleteSelected(); } };
      this.layer.addEventListener('pointerdown', this._down);
      window.addEventListener('pointermove', this._move);
      window.addEventListener('pointerup', this._up);
      document.addEventListener('keydown', this._key);
      this._bound = true; this.refreshCursor();
    },
    unbind() {
      if (!this._bound) return;
      if (this.layer) this.layer.removeEventListener('pointerdown', this._down);
      window.removeEventListener('pointermove', this._move);
      window.removeEventListener('pointerup', this._up);
      document.removeEventListener('keydown', this._key);
      this._bound = false;
    },
    // Re-link to the ink layer after a document load (setHTML replaces the DOM).
    onDocLoad() {
      this.layer = E().node.querySelector('.ink-layer') || null;
      this._bound = false;
      if (this.enabled) { this.ensureLayer(); this.bind(); }
      else if (this.layer) this.size();
    },

    local(e) {
      const r = this.layer.getBoundingClientRect();
      const z = E().zoom || 1;
      return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z };
    },

    onDown(e) {
      if (!this.enabled) return;
      e.preventDefault();
      const p = this.local(e);
      if (this.tool === 'eraser') { this.drawing = true; this.eraseAt(p); return; }
      if (this.tool === 'lasso') {
        this.layer.querySelectorAll('.ink-stroke.sel').forEach((s) => s.classList.remove('sel'));
        this.drawing = true; this.lasso = true; this.lassoPts = [p];
        const path = document.createElementNS(SVGNS, 'path');
        path.setAttribute('class', 'ink-lasso'); path.setAttribute('fill', 'rgba(43,87,154,.08)');
        path.setAttribute('stroke', '#2b579a'); path.setAttribute('stroke-width', '1'); path.setAttribute('stroke-dasharray', '4 3');
        path.setAttribute('d', `M ${p.x} ${p.y}`);
        this.layer.appendChild(path); this.lassoPath = path;
        return;
      }
      if (this.tool === 'select') { this.selectAt(p); return; }
      this.drawing = true; this.pts = [p];
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('class', 'ink-stroke');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', this.pen.color);
      path.setAttribute('stroke-width', this.pen.width);
      path.setAttribute('stroke-opacity', this.pen.opacity);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('d', `M ${p.x} ${p.y}`);
      this.layer.appendChild(path); this.curPath = path;
    },
    onMove(e) {
      if (!this.drawing) return;
      const p = this.local(e);
      if (this.tool === 'eraser') { this.eraseAt(p); return; }
      if (this.lasso) { this.lassoPts.push(p); this.lassoPath.setAttribute('d', 'M ' + this.lassoPts.map((q) => q.x + ' ' + q.y).join(' L ') + ' Z'); return; }
      this.pts.push(p);
      this.curPath.setAttribute('d', smooth(this.pts));
    },
    onUp() {
      if (!this.drawing) return;
      this.drawing = false;
      if (this.lasso) { this.finishLasso(); this.lasso = false; this.lassoPts = []; if (this.lassoPath) { this.lassoPath.remove(); this.lassoPath = null; } return; }
      if (this.curPath && this.pts.length < 2) { // a dot
        const p = this.pts[0]; this.curPath.setAttribute('d', `M ${p.x} ${p.y} l 0.1 0.1`);
      }
      this.curPath = null; this.pts = [];
      E().dirty = true;
    },
    finishLasso() {
      const poly = this.lassoPts; if (!poly || poly.length < 3) return;
      const strokes = Array.from(this.layer.querySelectorAll('.ink-stroke'));
      let n = 0;
      strokes.forEach((s) => {
        const len = s.getTotalLength(); let inside = 0, total = 0;
        for (let l = 0; l <= len; l += Math.max(2, len / 12)) { const pt = s.getPointAtLength(l); total++; if (pointInPoly(pt, poly)) inside++; }
        if (total && inside / total > 0.6) { s.classList.add('sel'); n++; }
      });
      WC.toast(n ? ('Lassoed ' + n + ' stroke(s).') : 'No strokes inside the loop.');
    },
    // Animate existing strokes being redrawn in order (Word's Ink Replay).
    replay() {
      const strokes = Array.from(this.layer ? this.layer.querySelectorAll('.ink-stroke') : []);
      if (!strokes.length) { WC.toast('No ink to replay.'); return; }
      strokes.forEach((s) => { const len = s.getTotalLength() || 1; s.style.transition = 'none'; s.style.strokeDasharray = len; s.style.strokeDashoffset = len; });
      let i = 0;
      const drawNext = () => {
        if (i >= strokes.length) { strokes.forEach((s) => { s.style.transition = ''; s.style.strokeDasharray = ''; s.style.strokeDashoffset = ''; }); return; }
        const s = strokes[i++];
        s.style.transition = 'stroke-dashoffset .4s linear';
        if (window.requestAnimationFrame) requestAnimationFrame(() => { s.style.strokeDashoffset = '0'; }); else s.style.strokeDashoffset = '0';
        setTimeout(drawNext, 420);
      };
      WC.toast('Replaying ink…'); drawNext();
    },

    eraseAt(p) {
      const strokes = Array.from(this.layer.querySelectorAll('.ink-stroke'));
      strokes.forEach((s) => { if (pathNear(s, p, this.eraseRadius)) { s.remove(); E().dirty = true; } });
    },
    selectAt(p) {
      this.layer.querySelectorAll('.ink-stroke.sel').forEach((s) => s.classList.remove('sel'));
      const strokes = Array.from(this.layer.querySelectorAll('.ink-stroke'));
      const hit = strokes.reverse().find((s) => pathNear(s, p, 8));
      if (hit) hit.classList.add('sel');
    },
    deleteSelected() { this.layer && this.layer.querySelectorAll('.ink-stroke.sel').forEach((s) => s.remove()); E().dirty = true; },
    clearAll() { if (this.layer) this.layer.querySelectorAll('.ink-stroke').forEach((s) => s.remove()); E().dirty = true; WC.toast('All ink cleared.'); },

    // Drawing Canvas: a bounded framed region you draw inside
    insertCanvas() {
      E().insertHTML('<div class="wc-draw-canvas" contenteditable="false" style="border:1px solid #c8c6c4;height:240px;margin:8px 0;position:relative;background:#fff"><span style="position:absolute;top:6px;left:8px;font-size:11px;color:#999">Drawing Canvas — turn on Drawing and sketch here</span></div><p><br></p>');
      WC.toast('Drawing Canvas inserted.');
    },
  };

  // Catmull-Rom -> smooth path
  function smooth(pts) {
    if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }
  // Ray-casting point-in-polygon test (polygon = array of {x,y}).
  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  // Approximate point-near-path test by sampling the path length.
  function pathNear(path, p, radius) {
    const box = path.getBBox();
    if (p.x < box.x - radius || p.x > box.x + box.width + radius || p.y < box.y - radius || p.y > box.y + box.height + radius) return false;
    const len = path.getTotalLength();
    const step = Math.max(2, len / 80);
    for (let l = 0; l <= len; l += step) {
      const pt = path.getPointAtLength(l);
      if ((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2 <= radius * radius) return true;
    }
    return false;
  }

  Draw.PENS = PENS;
  WC.Draw = Draw;
})();
