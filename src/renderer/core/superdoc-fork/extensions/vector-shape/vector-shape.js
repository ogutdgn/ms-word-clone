import { Node } from '@core/Node.js';
import { Attribute } from '@core/Attribute.js';
import { VectorShapeView } from './VectorShapeView';
import { OOXML_Z_INDEX_BASE } from '@extensions/shared/constants.js';

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
    };
  },
});
