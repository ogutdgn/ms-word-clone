// @ts-nocheck
import { Extension } from '@core/Extension.js';
import { applyLinkedStyleToTransaction, generateLinkedStyleString } from './helpers.js';
import { createLinkedStylesPlugin, LinkedStylesPluginKey } from './plugin.js';
import { findParentNodeClosestToPos } from '@core/helpers';
import { getResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js';
import { syncStylesDiffToConvertedXml } from '../../core/helpers/styles-xml-helpers';

/**
 * Style definition from Word document
 * @typedef {Object} LinkedStyle
 * @property {string} id - Style ID (e.g., 'Heading1', 'Normal')
 * @property {string} type - Style type ('paragraph' or 'character')
 * @property {Object} definition - Style definition from Word
 */

/**
 * Configuration options for LinkedStyles
 * @typedef {Object} LinkedStylesOptions
 * @category Options
 */

/**
 * @module LinkedStyles
 * @sidebarTitle Linked Styles
 * @snippetPath /snippets/extensions/linked-styles.mdx
 */
export const LinkedStyles = Extension.create({
  name: 'linkedStyles',

  priority: 1, // We need this plugin to run before the list plugins

  addOptions() {
    return {};
  },

  addPmPlugins() {
    return [createLinkedStylesPlugin(this.editor)];
  },

  addCommands() {
    return {
      /**
       * Apply a linked style to the selected paragraphs
       * @category Command
       * @param {LinkedStyle} style - The style object to apply
       * @example
       * const style = editor.helpers.linkedStyles.getStyleById('Heading1');
       * editor.commands.setLinkedStyle(style);
       * @note Clears existing formatting when applying a style
       * @note Works with custom selection preservation
       */
      setLinkedStyle: (style) => (params) => {
        const { tr } = params;
        return applyLinkedStyleToTransaction(tr, this.editor, style);
      },

      /**
       * Toggle a linked style on the current selection
       * @category Command
       * @param {LinkedStyle} style - The linked style to apply (with id property)
       * @example
       * const style = editor.helpers.linkedStyles.getStyleById('Heading1');
       * editor.commands.toggleLinkedStyle(style)
       * @note Works with both cursor position and text selection
       * @note Removes style if already applied, applies it if not
       */
      toggleLinkedStyle: (style) => (params) => {
        const { tr } = params;
        let node = tr.doc.nodeAt(tr.selection.$from.pos);

        if (!node || node.type.name !== 'paragraph') {
          node = findParentNodeClosestToPos(tr.selection.$from, (n) => {
            return n.type.name === 'paragraph';
          })?.node;
        }
        if (!node) {
          return false;
        }
        const paragraphProps = getResolvedParagraphProperties(node);
        const currentStyleId = paragraphProps.styleId;

        if (currentStyleId === style.id) {
          return applyLinkedStyleToTransaction(tr, this.editor, { id: null });
        }
        return applyLinkedStyleToTransaction(tr, this.editor, style);
      },

      /**
       * Apply a linked style by its ID
       * @category Command
       * @param {string} styleId - The style ID to apply (e.g., 'Heading1')
       * @example
       * editor.commands.setStyleById('Heading1')
       * editor.commands.setStyleById('Normal')
       * @note Looks up the style from loaded Word styles
       */
      setStyleById: (styleId) => (params) => {
        const { state, tr } = params;
        const pluginState = LinkedStylesPluginKey.getState(state);
        if (!pluginState) return false;

        const style = pluginState.styles?.find((s) => s.id === styleId);
        if (!style) return false;

        return applyLinkedStyleToTransaction(tr, this.editor, style);
      },

      /**
       * NET-NEW (slice 10 themes, NOTICE'd). Redefine named-style DEFINITIONS
       * (e.g. Heading1/Title/Normal) so they restyle like real Word. Mutates BOTH
       * the export structure (translatedLinkedStyles.styles + word/styles.xml) AND
       * the visual structure (converter.linkedStyles[].definition.styles — the array
       * the decoration plugin reads), then forces a decoration regenerate (re-stamp
       * affected paragraphs, addToHistory:false) + emits stylesDefaultsChanged for the
       * paginated DOM. See plan §0 F1-F4.
       *
       * @param {Array<{styleId:string, run?:{fontFamily?:string,color?:string,fontSize?:number}, paragraph?:{spacing?:object}}>} updates
       * @param {{export?:boolean}} [opts]  export:false = visual-only (hover preview)
       */
      redefineNamedStyles:
        (updates, opts = {}) =>
        ({ editor, tr, dispatch }) => {
          // Mutate the PROVIDED params.tr (CommandService dispatches it ONCE after we return
          // true) — do NOT create a separate editor.state.tr (that double-dispatches). Plan §0 F8.
          const converter = editor && editor.converter;
          if (!converter || !Array.isArray(updates) || !updates.length) return false;
          const arr = converter.linkedStyles;
          if (!Array.isArray(arr)) return false;
          const translated = converter.translatedLinkedStyles && converter.translatedLinkedStyles.styles;
          const doExport = opts.export !== false;
          const hex = (c) => '#' + String(c).replace(/^#/, '').toUpperCase();
          const bare = (c) => String(c).replace(/^#/, '').toUpperCase();

          // Read-only pass: which styleIds actually exist (drives true/false + the can() probe).
          const exists = updates.map((u) => u && u.styleId).filter((id) => id && arr.some((s) => s.id === id));
          if (!exists.length) return false;
          if (!dispatch) return true; // can() probe — no side effects past this point

          const touched = new Set();
          const modifiedStyles = {};
          for (const u of updates) {
            const id = u && u.styleId;
            if (!id) continue;

            // (1) VISUAL — mutate the array's definition.styles IN PLACE (kebab CSS keys).
            const entry = arr.find((s) => s.id === id);
            if (entry) {
              entry.definition = entry.definition || { styles: {}, attrs: {} };
              entry.definition.styles = entry.definition.styles || {};
              const st = entry.definition.styles;
              if (u.run && u.run.fontFamily != null) st['font-family'] = u.run.fontFamily;
              if (u.run && u.run.color != null) st['color'] = hex(u.run.color);
              if (u.run && u.run.fontSize != null) st['font-size'] = u.run.fontSize + 'pt';
              if (u.paragraph && u.paragraph.spacing) st['spacing'] = { ...(st['spacing'] || {}), ...u.paragraph.spacing };
              touched.add(id);
            }

            // (2) EXPORT — mutate translatedLinkedStyles.styles[id]. CRITICAL (plan §2 K9): when
            // setting a LITERAL font/color, DELETE the competing theme bindings (asciiTheme/
            // themeColor) — the default Heading/Title styles bind to the theme, and Word resolves
            // the theme IN PREFERENCE to the literal, so without deleting them Word IGNORES the
            // new font/color even though styles.xml contains it (a silent false-green).
            if (doExport && translated && translated[id]) {
              const def = translated[id];
              if (u.run && u.run.fontFamily != null) {
                const f = u.run.fontFamily;
                def.runProperties = def.runProperties || {};
                def.runProperties.fontFamily = { ...(def.runProperties.fontFamily || {}), ascii: f, hAnsi: f };
                delete def.runProperties.fontFamily.asciiTheme;
                delete def.runProperties.fontFamily.hAnsiTheme;
                delete def.runProperties.fontFamily.eastAsiaTheme;
                delete def.runProperties.fontFamily.cstheme;
              }
              if (u.run && u.run.color != null) {
                def.runProperties = def.runProperties || {};
                def.runProperties.color = { ...(def.runProperties.color || {}), val: bare(u.run.color) };
                delete def.runProperties.color.themeColor;
                delete def.runProperties.color.themeTint;
                delete def.runProperties.color.themeShade;
              }
              if (u.run && u.run.fontSize != null) {
                def.runProperties = def.runProperties || {};
                def.runProperties.fontSize = Math.round(u.run.fontSize * 2); // pt → half-points
              }
              if (u.paragraph && u.paragraph.spacing) {
                def.paragraphProperties = def.paragraphProperties || {};
                def.paragraphProperties.spacing = { ...(def.paragraphProperties.spacing || {}), ...u.paragraph.spacing };
              }
              // syncStylesDiffToConvertedXml consumes only the styleId KEY (re-decodes the whole
              // node from translated[id]); a bare entry is sufficient (styles-xml-helpers.ts:160-194).
              modifiedStyles[id] = { added: {}, deleted: {}, modified: {} };
              // Also mark touched so an export-only style (present in translatedLinkedStyles but
              // absent from the visual linkedStyles array) is NOT discarded by the !touched.size
              // gate below — which would leave translated mutated without ever syncing styles.xml.
              touched.add(id);
            }
          }

          if (!touched.size) return false;

          // (3a) EXPORT sync to word/styles.xml (re-decodes from the mutated translated[id]).
          if (doExport && Object.keys(modifiedStyles).length) {
            syncStylesDiffToConvertedXml(converter, { docDefaultsDiff: null, latentStylesDiff: null, addedStyles: {}, removedStyles: {}, modifiedStyles });
            converter.documentModified = true;
            if (typeof converter.promoteToGuid === 'function') converter.promoteToGuid();
          }

          // (3b) FORCE decoration regen on params.tr: re-stamp paragraphs whose styleId ∈ touched.
          // setNodeMarkup emits a ReplaceAroundStep that trips the linked-styles plugin's
          // mightAffectStyles gate even with identical attrs (verified). addToHistory:false so a
          // theme apply never pollutes the PM undo stack (plan §2 K3).
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'paragraph') return;
            const sid = node.attrs && node.attrs.paragraphProperties && node.attrs.paragraphProperties.styleId;
            if (sid && touched.has(sid)) tr.setNodeMarkup(pos, undefined, { ...node.attrs });
          });
          tr.setMeta('addToHistory', false);

          // (3c) Paginated DOM refresh (clears the flow-block cache + reschedules render).
          if (typeof editor.emit === 'function') editor.emit('stylesDefaultsChanged');
          return true;
        },
    };
  },

  addHelpers() {
    return {
      /**
       * Get all available linked styles
       * @category Helper
       * @returns {Array} Array of linked style objects
       * @example
       * const styles = editor.helpers.linkedStyles.getStyles();
       * // Returns all styles from the Word document
       */
      getStyles: () => {
        const styles = LinkedStylesPluginKey.getState(this.editor.state)?.styles || [];
        return styles;
      },

      /**
       * Get a specific style by ID
       * @category Helper
       * @param {string} styleId - The style ID to find
       * @returns {Object} The style object or undefined
       * @example
       * const headingStyle = editor.helpers.linkedStyles.getStyleById('Heading1');
       */
      getStyleById: (styleId) => {
        const styles = this.editor.helpers[this.name].getStyles();
        return styles.find((s) => s.id === styleId);
      },

      /**
       * Get the CSS string for a style
       * @category Helper
       * @param {string} styleId - The style ID
       * @returns {string} CSS style string
       * @example
       * const css = editor.helpers.linkedStyles.getLinkedStyleString('Heading1');
       * // Returns: "font-size: 16pt; font-weight: bold; color: #2E74B5"
       * @private
       */
      getLinkedStyleString: (styleId) => {
        const styles = this.editor.helpers.linkedStyles.getStyles();
        const style = styles.find((s) => s.id === styleId);
        if (!style) return '';
        return generateLinkedStyleString(style);
      },
    };
  },
});
