/* draw-tools.js — Draw tab pen registry + current-pen/drawing state. The legacy
   freehand ink engine (the SVG #editor overlay, pointer handlers, eraser/lasso/
   replay) was retired in slice 11 — PM owns the ink overlay (bridge/ink-overlay.ts,
   WC.PM.dSetPen/dSetDrawing). Only the pen tables + state slots remain, read by
   commands.js + ribbon.js (_renderPens). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;

  const PENS = [
    { id: 'pen', name: 'Pen', color: '#000000', width: 2, opacity: 1 },
    { id: 'pen-blue', name: 'Pen (Blue)', color: '#2B579A', width: 2, opacity: 1 },
    { id: 'pen-red', name: 'Pen (Red)', color: '#C00000', width: 2, opacity: 1 },
    { id: 'pencil', name: 'Pencil', color: '#595959', width: 1.2, opacity: 0.85 },
    { id: 'highlighter', name: 'Highlighter (Yellow)', color: '#FFFF00', width: 14, opacity: 0.4 },
    { id: 'highlighter-green', name: 'Highlighter (Green)', color: '#92D050', width: 14, opacity: 0.4 },
  ];

  // State slots only — the pen registry + current-pen/drawing flags that
  // commands.js (Add Pen / Pens menu) and ribbon.js (_renderPens, the pen
  // toggle row) read. The ink-drawing engine itself lives in the PM bridge.
  const Draw = {
    enabled: false,
    tool: 'pen',          // pen | highlighter | pencil | eraser | select
    pen: PENS[0],
    customPens: [],
  };

  Draw.PENS = PENS;
  WC.Draw = Draw;
})();
