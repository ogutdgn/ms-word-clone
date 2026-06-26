// Home › Show/Hide ¶ — paint the FULL set of Word formatting marks (space middle-dots · tab arrows ·
// line-break ↵) when the #pm-editor.show-marks class is on. An OWNED extension over the vendored fork
// (Constitution P1 — NO fork-source edit), the AdvancedFontEffects pattern: it contributes one ProseMirror
// decoration plugin via addPmPlugins(). The pilcrow itself is painted by CSS (::after on each <p>); this plugin
// adds the per-character inline decorations + the hard-break widget that CSS alone can't express.
//
// Gating: the plugin reads the .show-marks class each time `decorations(state)` runs, so toggling the class +
// dispatching a transaction (H.showHide does both) recomputes the set. When marks are OFF it returns
// DecorationSet.empty (zero cost). When ON it is O(doc) per render — acceptable for a deliberate marks-on mode.
// @ts-nocheck
import { Extension } from '@core/Extension.js'
import { Plugin, Decoration, DecorationSet } from '@/pm'

const SPACE = 0x20
const NBSP = 0xa0
const TAB = 0x09

export const FormattingMarks = Extension.create({
  name: 'formattingMarks',

  addPmPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            try {
              const host = document.getElementById('pm-editor')
              if (!host || !host.classList.contains('show-marks')) return DecorationSet.empty
              const decos = []
              state.doc.descendants((node, pos) => {
                if (node.isText && node.text) {
                  const t = node.text
                  for (let i = 0; i < t.length; i++) {
                    const code = t.charCodeAt(i)
                    if (code === SPACE) decos.push(Decoration.inline(pos + i, pos + i + 1, { class: 'wc-mark-space' }))
                    else if (code === NBSP) decos.push(Decoration.inline(pos + i, pos + i + 1, { class: 'wc-mark-nbsp' })) // Word shows NBSP as a degree mark, not a dot
                    else if (code === TAB) decos.push(Decoration.inline(pos + i, pos + i + 1, { class: 'wc-mark-tab' }))
                  }
                  return false // leaf text node — nothing to descend into
                }
                const n = node.type && node.type.name
                if (n === 'hardBreak' || n === 'lineBreak') {
                  // Only a SOFT (manual, Shift+Enter) line break gets the ↵ glyph; column/page breaks are distinct
                  // marks in Word (and carry their own paint), so don't mislabel them as a line return.
                  const bt = node.attrs && node.attrs.lineBreakType
                  if (bt !== 'column' && bt !== 'page') {
                    decos.push(Decoration.widget(pos, () => {
                      const s = document.createElement('span')
                      s.className = 'wc-mark-break'
                      s.textContent = '↵'
                      return s
                    }, { side: -1, ignoreSelection: true }))
                  }
                }
                return true
              })
              return DecorationSet.create(state.doc, decos)
            } catch {
              return DecorationSet.empty
            }
          },
        },
      }),
    ]
  },
})
