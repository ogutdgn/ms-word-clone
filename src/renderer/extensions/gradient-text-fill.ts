// Home Font Color › Gradient — a gradient TEXT fill (w14:textFill/gradFill). An OWNED extension over the vendored
// fork (Constitution P1, the 015 advanced-font-effects pattern): it declares a `textGradient` attr on the textStyle
// mark. The net-new v3 rPr w14:textFill translator (a marked additive fork edit) emits/reads the OOXML; the run
// export/import cases in styles.js forward the attr (same path as textGlow/textOutline).
//
// Model: { type:'linear', angle:<deg>, stops:[{pos:0..1, color:'#RRGGBB'}] }. Render = a CSS linear-gradient
// background clipped to the text glyphs (best-effort; the OOXML export is the COM-validated fidelity contract).
// @ts-nocheck
import { Extension } from '@core/Extension.js'

export const GradientTextFill = Extension.create({
  name: 'gradientTextFill',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          textGradient: {
            default: null,
            parseDOM: (el) => {
              const d = el.getAttribute?.('data-wc-gradient')
              if (d) { try { return JSON.parse(d) } catch { return null } }
              return null
            },
            renderDOM: (attrs) => {
              const g = attrs.textGradient
              // Require ≥2 stops — a degenerate gradient + color:transparent could render the glyphs invisible.
              if (!g || !Array.isArray(g.stops) || g.stops.length < 2) return {}
              const stops = g.stops.map((s) => `${s.color} ${Math.round((Number(s.pos) || 0) * 100)}%`).join(', ')
              const angle = Number(g.angle)
              const dir = Number.isFinite(angle) ? `${angle}deg` : 'to right'
              // background-clip:text fills the glyphs with the gradient; transparent text reveals it (best-effort).
              return {
                style: `background:linear-gradient(${dir}, ${stops});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;`,
                'data-wc-gradient': JSON.stringify(g),
              }
            },
          },
        },
      },
    ]
  },
})
