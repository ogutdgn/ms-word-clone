import { Node } from '@core/Node.js';
import { Attribute } from '@core/Attribute.js';

// Per-session monotonic VML shape id (unique within a doc — duplicate VML shape ids trigger Word repair).
let _shapeTextboxSeq = 1025;

/**
 * Configuration options for ShapeTextbox
 * @typedef {Object} ShapeTextboxOptions
 * @category Options
 * @property {Object} [htmlAttributes] - HTML attributes for shape textbox elements
 */

/**
 * Attributes for shape textbox nodes
 * @typedef {Object} ShapeTextboxAttributes
 * @category Attributes
 * @property {string} [sdBlockId] @internal - Internal block tracking ID
 * @property {Object} [attributes] @internal - Internal attributes storage
 */

/**
 * @module ShapeTextbox
 * @sidebarTitle Shape Textbox
 * @snippetPath /snippets/extensions/shape-textbox.mdx
 */
export const ShapeTextbox = Node.create({
  name: 'shapeTextbox',

  group: 'block',

  content: 'paragraph* block*',

  isolating: true,

  addOptions() {
    return {
      htmlAttributes: {
        class: 'sd-editor-shape-textbox',
        'aria-label': 'Shape textbox node',
      },
    };
  },

  addAttributes() {
    return {
      sdBlockId: {
        default: null,
        keepOnSplit: false,
        parseDOM: (elem) => elem.getAttribute('data-sd-block-id'),
        renderDOM: (attrs) => {
          return attrs.sdBlockId ? { 'data-sd-block-id': attrs.sdBlockId } : {};
        },
      },
      attributes: {
        rendered: false,
      },
    };
  },

  parseDOM() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
      },
    ];
  },

  renderDOM({ htmlAttributes }) {
    return [
      'div',
      Attribute.mergeAttributes(this.options.htmlAttributes, htmlAttributes, { 'data-type': this.name }),
      0,
    ];
  },

  addCommands() {
    return {
      /**
       * NET-NEW (slice 10 PR3 insert-exotica, NOTICE'd). Insert an editable text box:
       * a shapeContainer > shapeTextbox > paragraph tree. The EXISTING VML exporter
       * (translate-shape-container/textbox) synthesizes a real <w:pict><v:shape type="#_x0000_t202">
       * <v:textbox><w:txbxContent> from the live node — VML is valid Word OOXML, editable in-app,
       * round-trips. options: { text?, width?, height?, fillcolor? }.
       */
      insertTextBox:
        (options = {}) =>
        ({ commands }) => {
          const text = typeof options.text === 'string' ? options.text : 'Text';
          const w = options.width || 200;
          const h = options.height || 100;
          const shapeId = '_x0000_s' + (++_shapeTextboxSeq); // unique per insert
          return commands.insertContent({
            type: 'shapeContainer',
            attrs: {
              ...(options.fillcolor ? { fillcolor: options.fillcolor } : {}),
              attributes: { id: shapeId, type: '#_x0000_t202', style: 'width:' + w + 'pt;height:' + h + 'pt' },
            },
            content: [
              {
                type: 'shapeTextbox',
                attrs: {},
                content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
              },
            ],
          });
        },
    };
  },
});
