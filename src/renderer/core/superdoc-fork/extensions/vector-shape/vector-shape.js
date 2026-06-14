import { Node } from '@core/Node.js';
import { Attribute } from '@core/Attribute.js';
import { VectorShapeView } from './VectorShapeView';
import { OOXML_Z_INDEX_BASE } from '@extensions/shared/constants.js';
import { generateDocxRandomId } from '@core/helpers/index.js';

// Per-session monotonic wp:docPr id (unique within a doc — duplicate docPr ids trigger Word repair).
let _wordArtSeq = 1000;

// NET-NEW (slice 10 PR3 insert-exotica, NOTICE'd). Build a real DrawingML WordArt blob to stash on
// vectorShape.attrs.drawingContent — translateVectorShape replays it verbatim, so it round-trips
// through Word AND the fork. Mirrors translateImageNode's wp:inline wrapper. Namespaces a/w14/wps
// are already declared in exporter-docx-defs.js.
function synthesizeWordArtDrawing(text, opts = {}) {
  const w = opts.width || 300, h = opts.height || 80;
  const cx = Math.round(w * 9525), cy = Math.round(h * 9525); // px → EMU
  const color = String(opts.color || '#2B579A').replace(/^#/, '').toUpperCase();
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const id = ++_wordArtSeq; // unique per insert
  return {
    elements: [{
      name: 'wp:inline',
      attributes: { distT: '0', distB: '0', distL: '0', distR: '0' },
      elements: [
        { name: 'wp:extent', attributes: { cx: String(cx), cy: String(cy) } },
        { name: 'wp:effectExtent', attributes: { l: '0', t: '0', r: '0', b: '0' } },
        { name: 'wp:docPr', attributes: { id: String(id), name: 'WordArt ' + id } },
        { name: 'wp:cNvGraphicFramePr' },
        { name: 'a:graphic', attributes: { 'xmlns:a': A }, elements: [
          { name: 'a:graphicData', attributes: { uri: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape' }, elements: [
            { name: 'wps:wsp', elements: [
              { name: 'wps:cNvSpPr', attributes: { txBox: '1' } },
              { name: 'wps:spPr', elements: [
                { name: 'a:xfrm', elements: [
                  { name: 'a:off', attributes: { x: '0', y: '0' } },
                  { name: 'a:ext', attributes: { cx: String(cx), cy: String(cy) } },
                ] },
                { name: 'a:prstGeom', attributes: { prst: 'rect' }, elements: [{ name: 'a:avLst' }] },
                { name: 'a:noFill' },
              ] },
              { name: 'wps:txbx', elements: [
                { name: 'w:txbxContent', elements: [
                  { name: 'w:p', elements: [
                    { name: 'w:r', elements: [
                      { name: 'w:rPr', elements: [
                        { name: 'w:sz', attributes: { 'w:val': '72' } },
                        { name: 'w:szCs', attributes: { 'w:val': '72' } },
                        { name: 'w14:textFill', elements: [
                          { name: 'w14:solidFill', elements: [
                            { name: 'w14:srgbClr', attributes: { 'w14:val': color } },
                          ] },
                        ] },
                      ] },
                      { name: 'w:t', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: String(text) }] },
                    ] },
                  ] },
                ] },
              ] },
              { name: 'wps:bodyPr', attributes: { fromWordArt: '1', wrap: 'square', rtlCol: '0', anchor: 'ctr' }, elements: [
                { name: 'a:prstTxWarp', attributes: { prst: 'textNoShape' }, elements: [{ name: 'a:avLst' }] },
              ] },
            ] },
          ] },
        ] },
      ],
    }],
  };
}

// NET-NEW (slice 10 PR4 draw, NOTICE'd). Build a real DrawingML freeform-ink blob to stash on
// vectorShape.attrs.drawingContent — translateVectorShape replays it verbatim (round-trips Word AND
// the fork). Mirrors synthesizeWordArtDrawing but emits a:custGeom/a:pathLst (moveTo + quadBezTo from
// the stroke points) + an a:ln pen stroke instead of prstGeom + txbx.
// points = [{x,y}] overlay px; pen = { color:'#RRGGBB', width:Number(px), opacity:0..1 }; pos = {x,y} PAGE px (anchor mode).
// mode = 'anchor' (wp:anchor, floats where drawn — DEFAULT, oracle-gated) | 'inline' (wp:inline fallback).
// RETURNS { drawingContent, wPx, hPx } so the caller sets node width/height from the SAME bbox (K3 — no divergence).
function synthesizeInkDrawing(points, pen = {}, pos = { x: 0, y: 0 }, mode = 'anchor') {
  const EMU = 9525; // px → EMU
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const pts = (points || []).filter((p) => p && isFinite(p.x) && isFinite(p.y));
  if (!pts.length) return { drawingContent: { elements: [] }, wPx: 1, hPx: 1 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);              // TIGHT bbox (NO ,0 floor — K-fix)
  const wPx = Math.max(1, Math.round(Math.max(...xs) - minX));
  const hPx = Math.max(1, Math.round(Math.max(...ys) - minY));
  const wEmu = wPx * EMU, hEmu = hPx * EMU;
  // process-UNIQUE positive-int wp:docPr id (a per-session counter collides with a reopened doc's ids → Word repair, K2b).
  const id = Math.max(1, parseInt(generateDocxRandomId(), 16));
  const color = String(pen.color || '#000000').replace(/^#/, '').toUpperCase();
  const strokeW = Math.max(1, Math.round((pen.width || 2) * EMU)); // line width in EMU
  const alpha = Math.round(Math.max(0, Math.min(1, pen.opacity == null ? 1 : pen.opacity)) * 100000);
  const pt = (p) => ({ name: 'a:pt', attributes: { x: String(Math.round((p.x - minX) * EMU)), y: String(Math.round((p.y - minY) * EMU)) } });
  const cmds = [{ name: 'a:moveTo', elements: [pt(pts[0])] }];
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }; // quadBezTo: control=prev pt, end=midpoint (mirrors smooth())
    cmds.push({ name: 'a:quadBezTo', elements: [pt(p0), pt(mid)] });
  }
  cmds.push({ name: 'a:lnTo', elements: [pt(pts[pts.length - 1])] });
  // The wps:wsp (custGeom freeform + a:ln pen stroke) is shared by both wrappers. spPr child ORDER
  // xfrm→custGeom→noFill→ln and custGeom child order avLst→gdLst→rect→pathLst are schema-correct
  // (CT_ShapeProperties / CT_CustomGeometry2D) — DO NOT reorder (the import round-trip can't detect a regression).
  const graphic = { name: 'a:graphic', attributes: { 'xmlns:a': A }, elements: [
    { name: 'a:graphicData', attributes: { uri: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape' }, elements: [
      { name: 'wps:wsp', elements: [
        { name: 'wps:cNvSpPr' },
        { name: 'wps:spPr', elements: [
          { name: 'a:xfrm', elements: [{ name: 'a:off', attributes: { x: '0', y: '0' } }, { name: 'a:ext', attributes: { cx: String(wEmu), cy: String(hEmu) } }] },
          { name: 'a:custGeom', elements: [
            { name: 'a:avLst' }, { name: 'a:gdLst' },
            { name: 'a:rect', attributes: { l: '0', t: '0', r: String(wEmu), b: String(hEmu) } },
            { name: 'a:pathLst', elements: [{ name: 'a:path', attributes: { w: String(wEmu), h: String(hEmu), fill: 'none' }, elements: cmds }] },
          ] },
          { name: 'a:noFill' },
          { name: 'a:ln', attributes: { w: String(strokeW), cap: 'rnd' }, elements: [
            { name: 'a:solidFill', elements: [{ name: 'a:srgbClr', attributes: { val: color }, elements: alpha < 100000 ? [{ name: 'a:alpha', attributes: { val: String(alpha) } }] : [] }] },
            { name: 'a:round' },
          ] },
        ] },
        { name: 'wps:bodyPr' },
      ] },
    ] },
  ] };
  let root;
  if (mode === 'inline') {
    root = { name: 'wp:inline', attributes: { distT: '0', distB: '0', distL: '0', distR: '0' }, elements: [
      { name: 'wp:extent', attributes: { cx: String(wEmu), cy: String(hEmu) } },
      { name: 'wp:effectExtent', attributes: { l: '0', t: '0', r: '0', b: '0' } },
      { name: 'wp:docPr', attributes: { id: String(id), name: 'Ink ' + id } },
      { name: 'wp:cNvGraphicFramePr' },
      graphic,
    ] };
  } else {
    const off = (v) => String(Math.max(0, Math.round(v * EMU))); // PAGE px → EMU, clamped >= 0 (K2)
    root = { name: 'wp:anchor', attributes: { distT: '0', distB: '0', distL: '0', distR: '0', simplePos: '0', relativeHeight: String(id), behindDoc: '0', locked: '0', layoutInCell: '1', allowOverlap: '1' }, elements: [
      { name: 'wp:simplePos', attributes: { x: '0', y: '0' } },
      { name: 'wp:positionH', attributes: { relativeFrom: 'page' }, elements: [{ name: 'wp:posOffset', elements: [{ type: 'text', text: off(pos.x) }] }] },
      { name: 'wp:positionV', attributes: { relativeFrom: 'page' }, elements: [{ name: 'wp:posOffset', elements: [{ type: 'text', text: off(pos.y) }] }] },
      { name: 'wp:extent', attributes: { cx: String(wEmu), cy: String(hEmu) } },
      { name: 'wp:effectExtent', attributes: { l: '0', t: '0', r: '0', b: '0' } },
      { name: 'wp:wrapNone' },
      { name: 'wp:docPr', attributes: { id: String(id), name: 'Ink ' + id } },
      { name: 'wp:cNvGraphicFramePr' },
      graphic,
    ] };
  }
  return { drawingContent: { elements: [root] }, wPx, hPx };
}

export const VectorShape = Node.create({
  name: 'vectorShape',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      htmlAttributes: {},
    };
  },

  addAttributes() {
    return {
      kind: {
        default: 'rect',
        renderDOM: (attrs) => {
          if (!attrs.kind) return {};
          return { 'data-kind': attrs.kind };
        },
      },

      width: {
        default: 100,
        renderDOM: (attrs) => {
          if (attrs.width == null) return {};
          return { 'data-width': attrs.width };
        },
      },

      height: {
        default: 100,
        renderDOM: (attrs) => {
          if (attrs.height == null) return {};
          return { 'data-height': attrs.height };
        },
      },

      fillColor: {
        default: null,
        renderDOM: (attrs) => {
          if (!attrs.fillColor) return {};
          return { 'data-fill-color': attrs.fillColor };
        },
      },

      strokeColor: {
        default: null,
        renderDOM: (attrs) => {
          if (!attrs.strokeColor) return {};
          return { 'data-stroke-color': attrs.strokeColor };
        },
      },

      strokeWidth: {
        default: 1,
        renderDOM: (attrs) => {
          if (attrs.strokeWidth == null) return {};
          return { 'data-stroke-width': attrs.strokeWidth };
        },
      },

      customGeometry: {
        default: null,
        rendered: false,
      },

      lineEnds: {
        default: null,
        rendered: false,
      },

      hidden: {
        default: false,
        rendered: false,
      },

      effectExtent: {
        default: null,
        rendered: false,
      },

      rotation: {
        default: 0,
        renderDOM: (attrs) => {
          if (attrs.rotation == null) return {};
          return { 'data-rotation': attrs.rotation };
        },
      },

      flipH: {
        default: false,
        renderDOM: (attrs) => {
          if (!attrs.flipH) return {};
          return { 'data-flip-h': attrs.flipH };
        },
      },

      flipV: {
        default: false,
        renderDOM: (attrs) => {
          if (!attrs.flipV) return {};
          return { 'data-flip-v': attrs.flipV };
        },
      },

      wrap: {
        default: { type: 'Inline' },
        rendered: false,
      },

      anchorData: {
        default: null,
        renderDOM: ({ anchorData, originalAttributes }) => {
          const relativeHeight = originalAttributes?.relativeHeight;
          if (anchorData && relativeHeight) {
            const zIndex = Math.max(0, relativeHeight - OOXML_Z_INDEX_BASE);
            return { style: `z-index: ${zIndex}` };
          }
        },
      },

      isAnchor: {
        rendered: false,
      },

      marginOffset: {
        default: {},
        rendered: false,
      },

      drawingContent: {
        rendered: false,
      },

      originalAttributes: {
        rendered: false,
      },

      textContent: {
        default: null,
        rendered: false,
      },

      textAlign: {
        default: 'center',
        rendered: false,
      },

      textVerticalAlign: {
        default: 'top', // Per OOXML spec, text box defaults to top alignment
        rendered: false,
      },

      textInsets: {
        default: null,
        rendered: false,
      },

      isWordArt: {
        default: false,
        rendered: false,
      },

      isInk: {
        default: false,
        rendered: false,
      },
    };
  },

  parseDOM() {
    return false;
  },

  renderDOM({ htmlAttributes }) {
    return [
      'span',
      Attribute.mergeAttributes(this.options.htmlAttributes, htmlAttributes, { 'data-vector-shape': '' }),
    ];
  },

  addNodeView() {
    return (props) => {
      return new VectorShapeView({ ...props });
    };
  },

  addCommands() {
    return {
      /**
       * NET-NEW (slice 10 PR3 insert-exotica, NOTICE'd). Insert real DrawingML WordArt: a vectorShape
       * carrying a synthesized drawingContent blob (translateVectorShape replays it → real wps:wsp +
       * bodyPr fromWordArt + a:prstTxWarp + w14:textFill; round-trips Word + fork). Also sets textContent
       * so the (non-editable) SVG NodeView shows the text flat in-app (the warp renders in Word, not in-app).
       * options: { text?, color?, width?, height? }.
       */
      insertWordArt:
        (options = {}) =>
        ({ commands }) => {
          const text = (typeof options.text === 'string' && options.text) ? options.text : 'WordArt';
          return commands.insertContent({
            type: this.name,
            attrs: {
              isWordArt: true,
              kind: 'rect',
              width: options.width || 300,
              height: options.height || 80,
              // textAlign/textVerticalAlign are the NODE-level attrs the VectorShapeView reads for
              // centering (textContent.* alignment keys are ignored by the view).
              textAlign: 'center',
              textVerticalAlign: 'center',
              drawingContent: synthesizeWordArtDrawing(text, options),
              textContent: { parts: [{ text, formatting: {} }] },
            },
          });
        },

      /**
       * NET-NEW (slice 10 PR4 draw, NOTICE'd). Insert one freehand ink stroke as a REAL anchored DrawingML
       * freeform shape (a:custGeom replayed by translateVectorShape → round-trips Word + fork). The PM ink
       * overlay renders it in-app (createElement is empty for isInk). options: { points:[{x,y}], pen:{color,width,opacity}, pos:{x,y}, mode:'anchor'|'inline' }.
       */
      insertInkShape:
        (options = {}) =>
        ({ commands }) => {
          const points = Array.isArray(options.points) ? options.points : []
          if (points.length < 1) return false
          const pen = options.pen || {}
          const pos = options.pos || { x: 0, y: 0 }
          const mode = options.mode === 'inline' ? 'inline' : 'anchor'
          // ONE bbox computation, shared with the blob (K3 — node width/height must match wp:extent).
          const { drawingContent, wPx, hPx } = synthesizeInkDrawing(points, pen, pos, mode)
          return commands.insertContent({
            type: this.name,
            attrs: {
              isInk: true,
              kind: 'custom',
              width: wPx,
              height: hPx,
              isAnchor: mode === 'anchor',
              wrap: { type: mode === 'anchor' ? 'None' : 'Inline' },
              drawingContent,
              // stash raw stroke for the overlay renderer (px-space, pen, page pos). NOTE: on export→reimport the
              // fork OVERWRITES customGeometry with { paths:[{d,w,h}] } and drops isInk (K3) — the overlay must
              // render from BOTH .inkPoints (fresh) AND .paths (reopened).
              customGeometry: { inkPoints: points, inkPen: pen, inkPos: pos },
            },
          });
        },
    };
  },
});
