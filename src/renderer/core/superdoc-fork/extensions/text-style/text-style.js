// @ts-nocheck
import { Mark } from '@core/Mark.js';
import { Attribute } from '@core/Attribute.js';
import { normalizeBaselineShift } from '@superdoc/contracts';
import { annotationClass, annotationContentClass } from '../field-annotation/index.js';

const hasExplicitPosition = (position) => {
  if (typeof position !== 'string') {
    return false;
  }

  const parsed = parseFloat(position);
  return normalizeBaselineShift(parsed) != null;
};

// MS-WORD-CLONE FORK EDIT (Phase 3, Text Effects, NOTICE'd): visual-effect render
// helpers. Glow + Shadow both target the CSS text-shadow property, so ONE shared
// compositor reads BOTH textStyle attrs and joins them into a single value
// (two independent text-shadow renderDOMs would clobber each other). Effects
// carry STRUCTURED values; the bridge (styles.js) + w14 translators map them to OOXML.
const REFLECTION_CSS = {
  tight: 'below 2px linear-gradient(transparent 55%, rgba(255,255,255,0.45))',
  half: 'below 4px linear-gradient(transparent 45%, rgba(255,255,255,0.4))',
  full: 'below 6px linear-gradient(transparent 30%, rgba(255,255,255,0.35))',
};
const composeTextShadow = (attrs) => {
  const parts = [];
  const g = attrs.textGlow;
  if (g && g.color && g.radiusPt) {
    const r = (Number(g.radiusPt) * 1.3333).toFixed(1);
    parts.push(`0 0 ${r}px ${g.color}`, `0 0 ${r}px ${g.color}`, `0 0 ${r}px ${g.color}`);
  }
  const s = attrs.textShadowW14;
  if (s && s.color) {
    parts.push(`${Number(s.dx) || 0}px ${Number(s.dy) || 0}px ${Number(s.blur) || 0}px ${s.color}`);
  }
  if (!parts.length) return {};
  const out = { style: `text-shadow: ${parts.join(', ')};` };
  if (g) out['data-wc-glow'] = JSON.stringify(g);
  if (s) out['data-wc-shadow'] = JSON.stringify(s);
  return out;
};
const readJsonAttr = (el, name) => {
  try { const d = el?.getAttribute?.(name); return d ? JSON.parse(d) : null; } catch { return null; }
};

/**
 * Configuration options for TextStyle
 * @typedef {Object} TextStyleOptions
 * @category Options
 * @property {Object} [htmlAttributes={}] - Custom HTML attributes to apply to text style spans
 */

/**
 * Attributes for text style marks
 * @typedef {Object} TextStyleAttributes
 * @category Attributes
 * @property {string} [styleId] - Style identifier for referencing predefined styles
 */

/**
 * @module TextStyle
 * @sidebarTitle Text Style
 * @snippetPath /snippets/extensions/text-style.mdx
 */
export const TextStyle = Mark.create({
  name: 'textStyle',

  addOptions() {
    return {
      htmlAttributes: {},
    };
  },

  parseDOM() {
    return [
      {
        tag: 'span',
        getAttrs: (el) => {
          const hasStyles = el.hasAttribute('style');
          const isAnnotation = el.classList.contains(annotationClass) || el.classList.contains(annotationContentClass);
          if (!hasStyles || isAnnotation) return false;
          return {};
        },
      },
      {
        getAttrs: (node) => {
          const fontFamily = node.style.fontFamily?.replace(/['"]+/g, '');
          const fontSize = node.style.fontSize;
          const textTransform = node.style.textTransform;
          if (fontFamily || fontSize || textTransform) {
            return {
              fontFamily: fontFamily || null,
              fontSize: fontSize || null,
              textTransform: textTransform || null,
            };
          }
          return false;
        },
      },
    ];
  },

  renderDOM({ htmlAttributes }) {
    return ['span', Attribute.mergeAttributes(this.options.htmlAttributes, htmlAttributes), 0];
  },

  addAttributes() {
    return {
      /**
       * @category Attribute
       * @param {string} [styleId] - Style identifier for referencing predefined styles
       */
      styleId: {},
      /**
       * Vertical alignment for subscript/superscript text (DOCX w:vertAlign).
       * Standard values: 'superscript', 'subscript', 'baseline'.
       * Non-zero position values override the default superscript/subscript offset.
       * A position of 0 is treated as an identity value.
       * Renders as CSS vertical-align with 65% font-size scaling for super/subscript.
       * @category Attribute
       * @param {string} [vertAlign] - Vertical alignment mode ('superscript' | 'subscript' | 'baseline')
       */
      vertAlign: {
        default: null,
        renderDOM: (attrs) => {
          if (!attrs.vertAlign || hasExplicitPosition(attrs.position)) return {};
          if (attrs.vertAlign === 'superscript') {
            return { style: 'vertical-align: super; font-size: 65%;' };
          }
          if (attrs.vertAlign === 'subscript') {
            return { style: 'vertical-align: sub; font-size: 65%;' };
          }
          if (attrs.vertAlign === 'baseline') {
            return { style: 'vertical-align: baseline;' };
          }
          return {};
        },
        parseDOM: (el) => {
          const va = el.style?.verticalAlign;
          if (va === 'super') return 'superscript';
          if (va === 'sub') return 'subscript';
          if (va === 'baseline') return 'baseline';
          return null;
        },
      },
      /**
       * Custom vertical position offset in points (DOCX w:position).
       * Numeric value specifying vertical offset (positive raises, negative lowers).
       * Format: '{number}pt' (e.g., '2pt', '-1.5pt').
       * Non-zero position values override the default superscript/subscript offset.
       * A position of 0 is treated as an identity value.
       * Renders as CSS vertical-align with the exact offset value.
       * @category Attribute
       * @param {string} [position] - Vertical position offset (e.g., '2pt', '-1pt')
       */
      position: {
        default: null,
        renderDOM: (attrs) => {
          if (!hasExplicitPosition(attrs.position)) return {};
          return { style: `vertical-align: ${attrs.position};` };
        },
        parseDOM: (el) => {
          const va = el.style?.verticalAlign;
          if (!va) return null;
          const numeric = parseFloat(va);
          if (!Number.isNaN(numeric)) {
            return `${numeric}pt`;
          }
          return null;
        },
      },
      // MS-WORD-CLONE FORK EDIT (Phase 3, Text Effects & Typography, NOTICE'd).
      // OpenType typography attrs (the round-tripping trio): the v3 rPr translators
      // for w14:numForm/numSpacing, w14:ligatures/cntxtAlts and w14:stylisticSets
      // already exist; these textStyle attrs carry the resolved CSS value and the
      // bridge (styles.js) maps them <-> those run properties.
      /** Number styles → CSS font-variant-numeric (w14:numForm + w14:numSpacing). */
      fontVariantNumeric: {
        default: null,
        renderDOM: (attrs) => (attrs.fontVariantNumeric && attrs.fontVariantNumeric !== 'normal'
          ? { style: `font-variant-numeric: ${attrs.fontVariantNumeric};` } : {}),
        parseDOM: (el) => el.style?.fontVariantNumeric || null,
      },
      /** Ligatures → CSS font-variant-ligatures (w14:ligatures + w14:cntxtAlts). */
      fontVariantLigatures: {
        default: null,
        renderDOM: (attrs) => (attrs.fontVariantLigatures && attrs.fontVariantLigatures !== 'normal'
          ? { style: `font-variant-ligatures: ${attrs.fontVariantLigatures};` } : {}),
        parseDOM: (el) => el.style?.fontVariantLigatures || null,
      },
      /** Stylistic sets → CSS font-feature-settings "ssNN" (w14:stylisticSets). */
      fontFeatureSettings: {
        default: null,
        renderDOM: (attrs) => (attrs.fontFeatureSettings && attrs.fontFeatureSettings !== 'normal'
          ? { style: `font-feature-settings: ${attrs.fontFeatureSettings};` } : {}),
        parseDOM: (el) => el.style?.fontFeatureSettings || null,
      },
      // Visual effects (the w14 quartet). Structured values; rendered via CSS here,
      // exported via net-new w14 translators (bridged in styles.js).
      /** Outline → -webkit-text-stroke (w14:textOutline). Value {widthPt,color,fill}. */
      textOutline: {
        default: null,
        renderDOM: (attrs) => {
          const o = attrs.textOutline;
          if (!o || !o.color) return {};
          const px = ((Number(o.widthPt) || 1) * 1.3333).toFixed(2);
          return { style: `-webkit-text-stroke: ${px}px ${o.color}; -webkit-text-fill-color: ${o.fill || 'transparent'};`, 'data-wc-outline': JSON.stringify(o) };
        },
        parseDOM: (el) => readJsonAttr(el, 'data-wc-outline'),
      },
      /** Glow → composed into text-shadow (w14:glow). Value {radiusPt,color}. */
      textGlow: { default: null, renderDOM: composeTextShadow, parseDOM: (el) => readJsonAttr(el, 'data-wc-glow') },
      /** Shadow → composed into text-shadow (w14:shadow). Value {dx,dy,blur,color,preset}. */
      textShadowW14: { default: null, renderDOM: composeTextShadow, parseDOM: (el) => readJsonAttr(el, 'data-wc-shadow') },
      /** Reflection → -webkit-box-reflect (w14:reflection, preset). Value 'tight'|'half'|'full'. */
      textReflection: {
        default: null,
        renderDOM: (attrs) => (attrs.textReflection && REFLECTION_CSS[attrs.textReflection] ? { style: `-webkit-box-reflect: ${REFLECTION_CSS[attrs.textReflection]};` } : {}),
        parseDOM: () => null,
      },
    };
  },

  addCommands() {
    return {
      /**
       * Remove empty text style marks
       * @category Command
       * @example
       * editor.commands.removeEmptyTextStyle()
       * @note Cleanup utility to prevent empty span elements
       * @note Automatically checks if any style attributes exist before removal
       */
      removeEmptyTextStyle:
        () =>
        ({ state, commands }) => {
          const attributes = Attribute.getMarkAttributes(state, this.type);
          const hasStyles = Object.entries(attributes).some(([, value]) => !!value);
          if (hasStyles) return true;
          return commands.unsetMark(this.name);
        },
    };
  },
});
