// 015 — Home Font dialog advanced character effects (Small Caps + Character Scale).
// An OWNED extension over the vendored fork (Constitution P1 — NO fork-source edit), modeled
// on the fork's own FontSize extension (extensions/font-size/font-size.js), which adds a global
// attribute to the textStyle mark via addGlobalAttributes. The fork ALREADY ships the v3 rPr
// translators for these two run properties (w/smallCaps/smallCaps-translator.js → sdKey
// 'smallCaps'; w/w/w-translator.js → sdKey 'w'), but the textStyle MARK does not declare the
// attrs, so setMark silently drops them. Declaring them here from OUTSIDE the fork makes the
// pipeline whole: setMark accepts the attr → the fork's translators export <w:smallCaps/> /
// <w:w w:val="N"/> and re-import them. The other three Advanced effects (All Caps =
// textTransform, Spacing = letterSpacing, Position = position) are already declared textStyle
// attrs and need no extension.
//
// Render is best-effort (the OOXML export is the COM-validated fidelity contract — spec 015
// Assumptions): smallCaps → font-variant:small-caps (faithful); scale w → an inline-block
// scaleX approximation (Word stretches glyphs horizontally; exact glyph metrics are not required).
// @ts-nocheck
import { Extension } from '@core/Extension.js'

export const AdvancedFontEffects = Extension.create({
  name: 'advancedFontEffects',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          // w:smallCaps — boolean flag. true → <w:smallCaps/>; null → omitted.
          smallCaps: {
            default: null,
            parseDOM: (el) => {
              const v = el.style?.fontVariantCaps || el.style?.fontVariant
              return v === 'small-caps' ? true : null
            },
            renderDOM: (attrs) => (attrs.smallCaps ? { style: 'font-variant: small-caps;' } : {}),
          },
          // w:w — horizontal character scale, percent (100 = normal). N → <w:w w:val="N"/>.
          w: {
            default: null,
            parseDOM: (el) => {
              const d = el.getAttribute?.('data-wc-scale')
              const n = d ? Number(d) : NaN
              return Number.isFinite(n) ? n : null
            },
            renderDOM: (attrs) => {
              const n = Number(attrs.w)
              if (!Number.isFinite(n) || n === 100) return {}
              // best-effort: horizontally stretch the run's glyphs (inline-block so scaleX takes effect)
              return { style: `display: inline-block; transform: scaleX(${n / 100}); transform-origin: left;`, 'data-wc-scale': String(n) }
            },
          },
        },
      },
    ]
  },
})
