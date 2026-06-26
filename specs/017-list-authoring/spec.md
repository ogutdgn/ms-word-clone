# Feature Specification: List authoring (017)

**Feature Branch**: `feature/017-list-authoring` · **Created**: 2026-06-25 · **Status**: Draft

**Input**: The Bullets / Numbering / Multilevel dropdowns expose only a glyph library. Word's list-authoring
verbs — **Set Numbering Value** (start-at / continue), **Change List Level** (in the bullet *and* number
dropdowns), and the **Define New Bullet / Define New Number Format / Define New Multilevel List** dialogs —
are missing or stubbed (`multilevelMenu` → `WC.notImplemented('Define New Multilevel List dialog')`).

## Spike conclusion — NO-FORK (2026-06-25)

The fork already ships every numbering primitive these controls need; **all reachable via the existing
`WC.PM.cmd(...)` passthrough — NO fork edit required.**

| Control | Mechanism | Status |
|---|---|---|
| Change List Level | `editor.commands.changeListLevelBy(delta)` (core cmd) | already used by `changeListLevelMenu` |
| Restart at 1 | `editor.commands.restartNumbering()` (paragraph addCommands) | exists |
| Continue from previous | `editor.commands.continueNumbering()` (paragraph addCommands) | exists |
| Define New Bullet/Number/Multilevel | `editor.commands.applyListDefinition({listType, levels:[{fmt,text}]})` (core cmd) | already used by `multilevelMenu` + `bulletMenu` |
| **Set value to N (arbitrary start-at)** | `restartNumbering()` for the structural split + `ListHelpers.setLvlOverride(editor, numId, ilvl, {startOverride:N})` to overwrite the override value | NO-FORK: a new `bridge/lists.ts` method `setNumberingValue(value)` that **uses** the fork helper (does not edit it) |

Key facts proven by the spike (file reads):
- `core/commands/restartNumbering.js` sets `startOverride:1` via `ListHelpers.setLvlOverride`; the first-item case
  pins the override on the existing numId, the mid-list case mints a new numId sharing the abstractId and remaps
  paragraphs from the caret onward. `setLvlOverride(editor, numId, ilvl, {startOverride, lvlRestart})` already
  accepts an **arbitrary** `startOverride` — only `restartNumbering` hardcodes `1`.
- `restartNumbering` / `continueNumbering` are registered in `extensions/paragraph/paragraph.js → addCommands`.
- `changeListLevelBy`, `applyListDefinition`, `setListTypeAt`, `increase/decreaseListIndent`,
  `removeNumberingProperties` are core commands (`core/commands/index.js`) → auto-registered on `editor.commands`.
- The bridge `cmd(name, ...args)` (bridge/commands.ts) is a passthrough to `editor.commands[name](...args)`, and
  bridge modules may import fork helpers (015 imported `@core/helpers`; section-breaks uses public commands), so
  `bridge/lists.ts` can import `ListHelpers` from `@helpers/list-numbering-helpers.js`.
- `WC.PM.getResolvedParaProps()` already returns `{numberingProperties:{numId, ilvl}}` for the caret paragraph —
  reused to resolve the target numId/ilvl (no extra fork import needed for the resolve).

→ **Build NO-FORK.** The only net-new bridge logic is `setNumberingValue(value)` (the two-step restart + override).

## User Scenarios (P1)

1. **Set Numbering Value — start at N** — Given the caret is on a numbered list item, When the user opens
   "Set Numbering Value…", chooses **Start new list** + **Set value to: 5** and OKs, Then the current item (and
   the following items) renumber from 5; export carries `<w:lvlOverride><w:startOverride w:val="5"/></w:lvlOverride>`
   on the (possibly new) numId; Word reads the first item's `ListFormat.ListValue == 5`.
2. **Set Numbering Value — continue from previous** — When the user chooses **Continue from previous list**, Then
   the startOverride is removed and numbering continues the prior chain (`continueNumbering`).
3. **Change List Level** — From the Bullets *or* Numbering dropdown, When the user picks "Change List Level ▸
   Level 3", Then the caret item's `ilvl` becomes 2 (one undo step) and the marker reflects the deeper level.
4. **Define New Bullet** — A dialog offering a symbol/character glyph (+ a small symbol palette) inserts a list
   whose level-0 marker is that glyph (`applyListDefinition({listType:'bulletList', levels:[{fmt:'bullet', text:glyph}]})`).
5. **Define New Number Format** — A dialog with a Number-style dropdown (1,2,3 / a,b,c / A,B,C / i,ii,iii / I,II,III)
   + a Number-format text field (e.g. `%1)`) inserts an ordered list with that per-level `fmt`+`lvlText`.
6. **Define New Multilevel List** — A dialog editing the 9-level pattern (per-level number style + format text),
   replacing the `notImplemented` stub → `applyListDefinition` with the 9 authored levels.

## Functional Requirements

- **FR-001**: The Numbering dropdown gains **Set Numbering Value…**, **Change List Level ▸**, **Define New Number
  Format…**. The Bullets dropdown gains **Change List Level ▸**, **Define New Bullet…**. (Multilevel keeps Change
  List Level; its **Define New Multilevel List…** stub becomes a real dialog.)
- **FR-002**: `WC.PM.setNumberingValue(value)` — NO-FORK: `restartNumbering()` (structural split) then, for
  `value !== 1`, re-resolve the caret numId/ilvl and `ListHelpers.setLvlOverride(editor, numId, ilvl,
  {startOverride: value})`. Returns false (silent no-op, like Change List Level) when the caret is not on a list.
- **FR-003**: `WC.PM.continueListNumbering()` → `continueNumbering()` (the "Continue from previous list" leg).
- **FR-004**: Change List Level uses `changeListLevelBy(targetLevel − currentIlvl)` (one transaction = one undo
  step) — the exact pattern already in `changeListLevelMenu` (resolved-level delta, never chained ±1).
- **FR-005**: Define New Bullet/Number/Multilevel build a `levels` array and call `applyListDefinition`; the
  dialogs prefill sensible defaults and validate (non-empty format text; a real glyph).
- **FR-006**: COM-validated fidelity: `Set value to N` → `ListFormat.ListValue == N`; Define New Number Format →
  the list marker format round-trips; Change List Level → `ilvl` change persists.
- **FR-007**: Every behavior ships a regression test in `scripts/test-suite-pm.js` (paged suite).

## Success Criteria

- **SC-001**: Set Numbering Value to 5 renumbers from 5 and exports `w:startOverride w:val="5"`; Word ListValue==5
  (COM oracle `validate-listauthoring-win.ps1`).
- **SC-002**: Continue from previous removes the override and numbering continues.
- **SC-003**: Change List Level reachable from both Bullets and Numbering dropdowns; `ilvl` changes one step/undo.
- **SC-004**: Define New Bullet / Number Format / Multilevel each insert a list with the authored marker(s);
  Define New Multilevel List is no longer a `notImplemented` toast.
- **SC-005**: Gates green — `npm run build && test:pm` + `test:smoke` + `test:roundtrip` + `test:bundle`.
- **SC-006**: NO-FORK (spike-confirmed); `/code-review` findings refuted or fixed with probes.

## Assumptions / out of scope

- NO-FORK; the WC.PM bridge is the only doc-write path. Parity = installed Word (COM oracle).
- Out of scope (v1): "Advance value (skip numbers)" beyond a plain set-value; per-level font/indent/alignment
  tuning in Define New dialogs (we author `fmt`+`lvlText` per level, the applyListDefinition contract); picture
  bullets; the List Styles gallery. The paged PE may not visually repaginate mid-list in-app for every edit
  (export-faithful; Word renders on open) — same known limitation noted for 006.
- **Known v1 limitations (from /code-review):** (a) **Continue from previous** after a *mid-list* Set-Numbering-Value
  uses the fork's `continueNumbering` (drops the startOverride on the item's own minted numId) — for that minted
  numId the counter falls back to the abstract default (1) rather than remapping to the prior chain's numId, so it
  does not literally rejoin the previous list. True rejoin (remap to the prior numId) is deferred. (b) A multilevel
  list whose **level-0 is a bullet** is wrapped as `bulletList` (listType is derived from level 0); the deeper
  numbered levels still carry their own `numFmt` via the per-level override, but the wrapper/base-template is
  bullet-oriented. (c) Define New Bullet accepts a short (≤4-char) string as the glyph; Word's picker is a single
  symbol. Value robustness IS enforced: `setNumberingValue` validates 0..32767 + finite before touching the doc.
