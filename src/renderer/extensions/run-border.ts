// Home Borders › "Apply to: Text" — a run-level (character) border. An OWNED extension over the vendored fork
// (Constitution P1, the 015 advanced-font-effects pattern): it declares a single `borders` attr on the textStyle
// mark. The fork ALREADY ships the v3 rPr border translator (w/bdr/bdr-translator.js → run property key 'borders',
// createBorderPropertyHandler), so once the mark carries the attr and the run-export/import whitelists forward it
// (3 minimal additive fork edits in calculateInlineRunPropertiesPlugin.js + styles.js), the pipeline emits/reads
// <w:bdr> under rPr — Word's character border.
//
// The value is a SINGLE OOXML border object {val, size, color, space} (w:bdr is one border around the run, unlike
// the 4-sided paragraph w:pBdr). Render is best-effort CSS (the OOXML export is the COM-validated fidelity
// contract); a data attr round-trips the exact object for HTML copy/paste.
// @ts-nocheck
import { Extension } from '@core/Extension.js'

const STYLE_CSS = { single: 'solid', thick: 'solid', double: 'double', dotted: 'dotted', dashed: 'dashed', dashSmallGap: 'dashed', dotDash: 'dashed', wave: 'solid' }

export const RunBorder = Extension.create({
  name: 'runBorder',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          // w:bdr — a single character border. {val:'single', size:<eighth-points>, color:'RRGGBB'|'auto', space:<pt>}.
          borders: {
            default: null,
            parseDOM: (el) => {
              const d = el.getAttribute?.('data-wc-run-border')
              if (d) { try { return JSON.parse(d) } catch { return null } }
              return null
            },
            renderDOM: (attrs) => {
              const b = attrs.borders
              if (!b || typeof b !== 'object' || b.val === 'nil' || b.val === 'none') return {}
              const px = Math.max(1, Math.round((Number(b.size) || 4) / 8 * 1.3333)) // eighth-points → px
              const css = STYLE_CSS[b.val] || 'solid'
              const color = b.color === 'auto' || !b.color ? '#000000' : ('#' + String(b.color).replace(/^#/, ''))
              // Minimal inline inset (1px) so a bordered run perturbs line measurement/wrap as little as possible
              // (the OOXML w:bdr export — not the CSS — is the fidelity contract; render is best-effort, like 015).
              return { style: `border:${px}px ${css} ${color};padding:0 1px;`, 'data-wc-run-border': JSON.stringify(b) }
            },
          },
        },
      },
    ]
  },
})
