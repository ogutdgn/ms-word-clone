# Contract — 015 Font advanced effects

## Owned extension (NO-FORK)

`src/renderer/extensions/advanced-font-effects.ts` — an owned `Extension` adding two global attributes to `textStyle` (the `FontSize` pattern):

- `smallCaps`: default `null`; renderDOM `true` → `font-variant: small-caps`; parseDOM from `font-variant`.
- `w` (scale): default `null`; renderDOM `n` → best-effort horizontal scale; parseDOM best-effort.

Wired in `bridge/create-editor.ts`: `extensions: [...getStarterExtensions(), ImageResize, AdvancedFontEffects]`. (`caps`/`textTransform`, `letterSpacing`, `position` are already declared — no extension change needed for those three.)

## Bridge verbs (`WC.PM`, in `bridge/commands.ts`)

Each applies to the current selection / stored marks via `setMark('textStyle', …)`; `null` clears.

- `setAllCaps(on: boolean)` → `textStyle.textTransform = on ? 'uppercase' : null`
- `setSmallCaps(on: boolean)` → `textStyle.smallCaps = on ? true : null`
- `setCharSpacingPt(pt: number|null)` → `textStyle.letterSpacing = pt ? pt+'pt' : null` (signed)
- `setPositionPt(pt: number|null)` → `textStyle.position = pt ? pt+'pt' : null` (signed; distinct from vertAlign)
- `setCharScale(pct: number|null)` → `textStyle.w = (pct && pct !== 100) ? pct : null`
- Readers (for prefill): expose current head-run textStyle attrs via the existing `getState()`/state-sync or a small reader.

(Or a single `setAdvancedFontEffects({allCaps, smallCaps, spacingPt, positionPt, scalePct})` that builds one `setMark` patch — preferred for the one-undo-step chain.)

## Font dialog (`dialogs.js` `D.font`)

- **OK**: include the five effects in the existing `steps`/`pm.chain` (one undo step); **remove** the `notifyBlocked('Caps and Advanced font effects')` branch.
- **Open**: prefill Small caps / All caps checkboxes, Scale %, Spacing (mode + pt), Position (mode + pt) from the current run state.

## OOXML / COM contract (the fidelity surface)

Authoring each effect and exporting MUST produce the rPr element in data-model.md, and the installed Word MUST read back the authored value:
- Small Caps → `<w:smallCaps/>` → `Font.SmallCaps = True`
- All Caps → `<w:caps/>` → `Font.AllCaps = True`
- Spacing Expanded 2pt → `<w:spacing w:val="40"/>` → `Font.Spacing = 2`
- Position Raised 3pt → `<w:position w:val="6"/>` → `Font.Position = 3`
- Scale 150% → `<w:w w:val="150"/>` → `Font.Scaling = 150`

Validated by `scripts/oracle/validate-fonteffects-win.ps1` (PID-safe, sandbox-disabled).
