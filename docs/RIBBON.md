# Ribbon System Reference

The ribbon is the tab strip and command surface at the top of the window. It is
**fully data-driven**: a single generated table (`WC.RIBBON`) describes every tab,
group and control, and `WC.Ribbon` (in `src/renderer/public/js/ribbon.js`) turns that
table into DOM and wires every control to the command dispatcher
`WC.Commands` (in `src/renderer/public/js/commands.js`). The ribbon + dispatcher are
shared chrome (still classic `WC` scripts); each handler drives the **`WC.PM` bridge**
(the PM editor is the only document model — dispatch is PM-only, no legacy fallback).

Nothing in the ribbon is hand-built per control — to change what appears you change
the data; to change what a control *does* you change a handler in `commands.js`.

## Files at a glance

| File | Role |
| --- | --- |
| `src/renderer/public/js/ribbon-data.js` | The generated `WC.RIBBON` table — 10 tabs, 212 controls. **Auto-generated, do not hand-edit.** |
| `src/renderer/public/js/ribbon.js` | `WC.Ribbon` — renders the tab strip + ribbon body, builds each control type, handles tab switching, toggle-state sync, the Styles gallery, and runtime contextual tabs. |
| `src/renderer/public/js/commands.js` | `WC.Commands` — the dispatcher (`run` / `dropdown`) plus the `H` handler table that maps each `cmd` id to a `WC.PM` bridge call (PM-only). |

## The data model: `WC.RIBBON`

`ribbon-data.js` is generated from `docs/research/raw-research.json` by
`scripts/gen.js` (see the header comment: *"AUTO-GENERATED … Do not hand-edit;
re-run the generator."*). It assigns `WC.RIBBON`, an array of **10 tab objects**:

```
home · insert · draw · design · layout · references · mailings · review · view · help
```

Each tab → groups → controls. A control object looks like this (Home ▸ Clipboard ▸ Paste):

```js
{
  "id": "home.clipboard.paste",
  "cmd": "paste",                 // dispatch key — looked up in commands.js H[]
  "label": "Paste",
  "type": "split",               // how it renders + dispatches (see below)
  "tooltip": "Paste content from the Clipboard…",
  "shortcut": "Ctrl+V",
  "feasible": "partial",
  "items": ["Keep Source Formatting", "Merge Formatting", …]  // optional menu items
}
```

A group may also carry a `launcher` object (the small dialog-box-launcher glyph in
the group label). For example, Home ▸ Font has a `launcher` with `cmd: "font"`.

### Control type census (212 controls total)

| `type` | Count | Renders as |
| --- | --- | --- |
| `button` | 94 | `.rbtn` — single click runs the command |
| `dropdown` | 54 | `.rbtn` with a caret — click opens a flyout menu |
| `split` | 28 | `.rsplit` — `.main` face runs, `.arrow` opens a menu |
| `toggle` | 22 | `.rbtn` — like a button, but state-synced (bold/italic/align…) |
| `spinner` | 5 | `.rspinner` — numeric stepper (indents, paragraph spacing) |
| `gallery` | 3 | inline tile grid (Styles, Pens, etc.) |
| `combo` | 3 | `.rcombo` — editable text + arrow (font name, font size, display-for-review) |
| `checkbox` | 3 | rendered through the `.rbtn` path with toggle styling |

(`toggle` and `checkbox` have no dedicated branch in `renderControl`; they fall
through to the `.rbtn` button path. What makes a toggle *behave* like a toggle is
the `TOGGLE_MAP` sync, described later.)

## Rendering pipeline

`WC.Ribbon.init()` (called once at startup) wires up DOM and state:

```js
init() {
  this.tabstrip = document.getElementById('tabstrip');
  this.body = document.getElementById('ribbon');
  this.renderTabStrip();
  this.renderBody();
  this.activate(WC.RIBBON[0].id);                 // Home is active first
  WC.PM.onStateChange((st) => this.syncToggles(st));   // bridge pushes state per transaction
}
```

### Tab strip — `renderTabStrip()`

Builds the row of tab chips. A **File** chip is added first (opens the Backstage:
`WC.Backstage.open()`), then one `.ribbon-tab` per entry in `WC.RIBBON`, each with
a click handler calling `this.activate(tab.id)`. It also appends the Microsoft
Search box (a UI placeholder) and the right cluster (Comments / Share / account).

### Body — `renderBody()` → `renderGroup()`

`renderBody()` creates one hidden `.ribbon-panel[data-tab=…]` per tab and fills it
by calling `renderGroup(tab, group)` for each group, then appends the collapse
chevron (toggles `.collapsed` on the ribbon body; Ctrl+F1 in Word).

`renderGroup()` is where layout heuristics live. It splits a group's controls into
**gallery / combo / rest**, then:

- **Styles group** (`group.id === 'styles'`): handed to `renderStylesGallery()`.
- **Pens gallery** (`group.id === 'pens'`): handed to `renderPensGallery()` so the
  pen tiles show inline (Word shows the pens directly in the ribbon).
- **Combos** (font name / size) go in a top row via `renderCombo()`.
- The remaining controls are split into **large** vs **small**:

  ```js
  const larges = rest.filter((c) => LARGE.has(c.cmd) || group.controls.length <= 2);
  const smalls = rest.filter((c) => !(LARGE.has(c.cmd) || group.controls.length <= 2));
  larges.forEach((c) => body.appendChild(this.renderControl(c, 'large')));
  // small controls are packed 3 per column
  ```

  `LARGE` is an explicit `Set` of `cmd` ids near the top of `ribbon.js` (paste,
  table, pictures, header, footer, margins, …). A control is also promoted to large
  if its group has ≤ 2 controls. Small controls render icon-only and are stacked
  three to a column.

Finally `renderGroup()` appends the group label, and if `group.launcher` exists, a
`.launcher` glyph wired to `WC.Commands.launcher(group.id, group.launcher, …)`.

### `renderControl(c, size)` — the button/split/dropdown builder

This single method renders `button`, `toggle`, `checkbox`, `split`, and `dropdown`
controls (spinners are split off to `renderSpinner` at the top). The shape:

```js
renderControl(c, size) {
  if (c.type === 'spinner') return this.renderSpinner(c);
  const isSplit = c.type === 'split';
  const isDrop  = c.type === 'dropdown';
  const isColor = /color|highlight|shading/i.test(c.cmd) && (c.type === 'split' || /color/i.test(c.label));
  const iconHtml = WC.icon(c.cmd, size === 'large' ? 28 : 16);
  …
}
```

**Split** (`.rsplit`): a `.main` face and a separate `.arrow`. The main face calls
`WC.Commands.run(c, node)`; the arrow calls `WC.Commands.dropdown(c, node)`. So
clicking the icon executes the default action, and clicking the chevron opens the
menu — exactly Word's split-button behavior. Color-ish splits also get a
`.color-bar` element (`data-colorbar`) that reflects the last-used color.

**Button / dropdown / toggle** (`.rbtn`): a single click. For a `dropdown` it opens
the menu (`WC.Commands.dropdown`); otherwise it runs (`WC.Commands.run`). A `caret`
span is added for dropdowns. Format Painter additionally binds `dblclick` →
`formatPainterLock` (Word's "apply to multiple selections" sticky mode).

Every rendered control is registered:

```js
this.controlIndex[c.cmd] = this.controlIndex[c.cmd] || { node, control: c };
if (TOGGLE_MAP[c.cmd]) this.toggleNodes.push({ node, cmd: c.cmd });
WC.attachTip(node, c.label, c.tooltip, c.shortcut);
```

`controlIndex` lets other code find a control's DOM node by `cmd` (used for color
bars, the Format Painter button, radio-style View toggles, etc.). `WC.attachTip`
wires the hover tooltip from the data's `label`/`tooltip`/`shortcut`.

### Combos — `renderCombo(c)`

The font name, font size, and display-for-review combos. An editable `<input>` plus
a `.combo-arrow`. Typing + Enter (or blur) commits via `WC.Commands.comboCommit`;
the arrow opens a list via `WC.Commands.comboDropdown`. The node is registered in
`controlIndex` with its `input`, so `setComboValue(cmd, value)` can push the current
selection's font/size back into the box.

### Spinners — `renderSpinner(c)`

Numeric `<input type=number>` with an icon and a unit (`"` for indents, `pt` for
spacing). On change it calls `WC.Commands.spinner(c.cmd, value)`, which maps to a
`WC.PM` bridge call (indent in inches, spacing in points).

## Command dispatch (`commands.js`)

Two entry points, both on `WC.Commands`.

### `run(control, node)` — execute the default action

```js
run(control, node) {
  WC.closeFlyouts(); WC.hideTip();
  const cmd = control.cmd;
  if (H[cmd]) { H[cmd](control, node); return; }                 // handler exists
  if ((control.type === 'split' || control.type === 'dropdown') && control.items) {
    this.dropdown(control, node); return;                        // fall back to its menu
  }
  WC.notImplemented(control.label || cmd);                       // documented "not implemented"
}
```

`H` is a flat object keyed by `cmd`. Each handler receives `(control, node)` and
drives the `WC.PM` bridge (or opens a dialog). Examples:

```js
H.bold = () => WC.PM.toggleMark('bold');
H.table = (c, node) => WC.Dialogs.insertTable();   // dialog → WC.PM.insertTable
H.header = (c, node) => WC.notifyBlocked('header');  // Phase-7-deferred area
```

A `cmd` with no handler and no menu surfaces `WC.notImplemented(...)`, which shows a
toast pointing at `docs/NOT_IMPLEMENTED.md` — the deliberate behavior for
out-of-scope (cloud/ML) features.

### `dropdown(control, node)` — open the menu

`dropdown` is a large `if`-ladder of special cases (change-case, color pickers,
borders, paste options, the Insert/Design/Layout/References/Mailings/Review menus,
etc.), each opening a `WC.flyout(...)`. If nothing matches, it falls back to a
**generic** flyout that lists the control's `items[]` as menu entries (a `-` item
becomes a separator), each calling `WC.notImplemented(label ▸ item)`:

```js
WC.flyout(node, (fly, close) => {
  const items = control.items && control.items.length ? control.items : ['(no options)'];
  items.forEach((it) => {
    if (/^-+$/.test(it)) { fly.appendChild(WC.flySep()); return; }
    fly.appendChild(WC.flyItem(it, { onClick: () => WC.notImplemented(control.label + ' ▸ ' + it) }));
  });
});
```

This is why simply listing `items` in the data already yields a working (if
not-yet-implemented) menu — the generic path covers it.

### Other dispatch methods

- `comboCommit(c, value)` / `comboDropdown(c, combo, input)` — font name, font size,
  display-for-review.
- `applyStyle(name)` → `WC.PM.applyNamedStyle(name)` (the Styles gallery commit).
- `spinner(cmd, value)` — indent/spacing block styles.
- `launcher(groupId, control, node)` — dialog-box launchers, keyed by **group id**
  (not `cmd`) to avoid collisions like the Font launcher sharing `'font'` with the
  font-name combo. Map: `clipboard`, `font`, `paragraph`, `styles`.

## Flyout menus

All menus use the shared helper `WC.flyout(anchor, builder, opts)`
(`src/renderer/public/js/util.js`). It closes any open flyout, builds a positioned
`.flyout` under the anchor (flipping above if it would overflow the viewport), and
auto-closes on the next outside `mousedown`. Builders compose menus from:

- `WC.flyItem(label, { icon, key, onClick })` — a row; `onClick` auto-closes the
  flyout first.
- `WC.flyHeader(text)` — a section header.
- `WC.flySep()` — a separator.

Submenus (e.g. Home ▸ Text Effects → Outline / Shadow / Glow) are just another
`WC.flyout(node, …)` opened from a parent item's `onClick`.

## Toggle-state sync

The pressed/unpressed look of bold, italic, alignment, lists, etc. is driven by the
editor's live state — not by clicking. The map at the top of `ribbon.js`:

```js
const TOGGLE_MAP = {
  bold: 'bold', italic: 'italic', underline: 'underline', strikethrough: 'strikethrough',
  subscript: 'subscript', superscript: 'superscript',
  alignLeft: 'justifyLeft', center: 'justifyCenter', alignRight: 'justifyRight', justify: 'justifyFull',
  bullets: 'insertUnorderedList', numbering: 'insertOrderedList',
};
```

maps a control `cmd` to a key in the state object the `WC.PM` bridge derives from
the active marks/node attributes on each transaction. During render, any control
whose `cmd` is in `TOGGLE_MAP` is pushed onto `this.toggleNodes`. The bridge fires
state changes (`WC.PM.onStateChange`), and `syncToggles(st)` flips the `.toggled`
class on each node:

```js
syncToggles(st) {
  this.toggleNodes.forEach(({ node, cmd }) => {
    node.classList.toggle('toggled', !!st[TOGGLE_MAP[cmd]]);
  });
}
```

Other "toggle" controls outside this map (Show/Hide ¶, ruler, gridlines, Track
Changes options, etc.) toggle their own `.toggled` class directly inside their
handler in `commands.js`.

## The Styles gallery + live preview

`renderStylesGallery(c)` (`ribbon.js`) builds the inline gallery from the gallery
control's `items[]` (`Normal`, `Heading 1`, `Title`, …), filtering out the trailing
*Create a Style / Clear Formatting / Apply Styles* commands. Each `.style-cell`
carries a small inline-CSS preview of how that style looks.

**Apply-on-click (PM mode).** Clicking a cell commits the style via
`WC.Commands.applyStyle(name)` → `WC.PM.applyNamedStyle(name)`, which applies the
named style as a ProseMirror transaction (selection → selection; caret → current
paragraph). The Styles gallery is **click-only** in PM mode: the hover live-preview
was a recorded deviation (the transient restyle read as a bug — see
`docs/plan/deferrals.md`), so the gallery's hover wiring is disabled, though the
underlying `bridge/style-preview.ts` is intact. The gallery's More button (`▼`)
opens the full styles pane (`WC.Dialogs.stylesPane()`).

Design-tab galleries (themes, colors, fonts) **do** hover-preview via the bridge's
linked-styles decoration; Style Sets + Paragraph Spacing are commit-only (also
recorded in the deferrals ledger).

## Runtime contextual tabs

Contextual tabs (Word shows them only when relevant, e.g. **Header & Footer**, the
**Table Design/Layout** pair) are injected at runtime rather than living in
`WC.RIBBON`. Two methods on `WC.Ribbon` (multi-tab since slice 6):

```js
showContextualTab(def, opts) {
  // MULTIPLE contextual tabs can coexist: each injected id is tracked in _ctxTabs;
  // _ctxPrev remembers the real (non-contextual) tab, saved on the FIRST inject only.
  // opts.activate (default TRUE) controls auto-selection:
  //   - Header & Footer passes no opts → tab is selected on show (enter-mode UX);
  //   - the Table tabs pass { activate: false } → they appear PASSIVELY, like real
  //     Word (the active tab never changes when the caret enters a table).
  // append a .contextual-tab chip + a new .ribbon-panel built from def.groups
  const btn = el('div', { class: 'ribbon-tab contextual-tab', text: def.name, dataset: { tab: def.id } });
  …
  def.groups.forEach((group) => scroll.appendChild(this.renderGroup(def, group)));
}
hideContextualTab(id) {
  // hide ONE tab by id, or ALL contextual tabs when called with no arg (the
  // Header & Footer exit path). The previously-active tab is restored ONLY if
  // the tab being removed was the active one — a tab the user picked manually
  // stays put (Word behavior; the table caret-exit path relies on this).
}
```

The injected panel is built by the **same** `renderGroup` used for static tabs, so a
contextual tab is just a tab definition object — no special rendering path.

The live caller is the **PM-mode Table Tools** (`table-tools-pm.js`): two passive
tabs — **Table Design** + **Layout** — shown/hidden by `syncContextualTabs(inTable)`
driven from the `WC.PM` bridge state-sync as the caret enters/leaves a table. Each is
just a tab definition object (id/name/groups/controls), e.g.:

```js
// table-tools-pm.js (shape)
{ id: 'table-design', name: 'Table Design', contextual: true,
  groups: [ { id: 'table-styles', name: 'Table Styles', controls: [ /* … */ ] }, … ] }
```

`table-tools-pm.js` calls `WC.Ribbon.showContextualTab(def, { activate: false })` to
add the passive tabs and `WC.Ribbon.hideContextualTab(id)` to remove them; the
contextual controls reuse ordinary `cmd`s whose handlers in `commands.js` drive the
`WC.PM` bridge.

> The legacy single-tab Header & Footer contextual tab (the old `header-footer.js`
> `enterMode()`/`exitMode()` example) was removed in slice 11 — header/footer editing
> is a Phase-7-deferred area (its commands honestly block).

## How to add or change a control

The system separates **what appears** (data) from **what it does** (handler).

### Change a control's behavior

Find its `cmd` and edit the handler in `commands.js`. For example, to change what
the bold button does, edit `H.bold`. To change a menu, edit the matching `if (cmd
=== …)` branch in `Commands.dropdown` (or the menu function it calls).

### Add a new control

1. **Add it to the data.** Because `ribbon-data.js` is generated, the source of
   truth is `docs/research/raw-research.json`; add the control there (a `{ id, cmd,
   label, type, tooltip, shortcut?, items? }` object) and re-run
   `scripts/gen.js` to regenerate `ribbon-data.js`. (For a quick local experiment
   you can edit `ribbon-data.js` directly, but it will be overwritten on the next
   generate.)
2. **Add a handler** in `commands.js`: `H.myCmd = (c, node) => { … }`. Use
   `WC.PM.*` (the bridge) for document edits, `WC.flyout(node, …)` for a menu, and
   `WC.toast` / `WC.notImplemented` for status. (Add the actual PM transaction in
   `src/renderer/bridge/*.ts` and expose it on `WC.PM`.)
3. **For a menu** (`type: "dropdown"` or the arrow of a `type: "split"`): either
   provide an `items[]` array in the data (handled automatically by the generic
   path in `Commands.dropdown`) or add a custom `if (cmd === 'myCmd')` branch.
4. **For a toggle that mirrors editor state:** add `myCmd: 'stateKey'` to
   `TOGGLE_MAP` in `ribbon.js` (where `stateKey` is a field the bridge's
   `state-sync.ts` puts on the state object) — it will then sync automatically via
   `syncToggles`. For ad-hoc on/off state, just call
   `node.classList.toggle('toggled')` inside the handler.
5. **Icon:** `renderControl` calls `WC.icon(c.cmd, size)`
   (`src/renderer/public/js/icons.js`); add an SVG for the new `cmd` there, or it falls
   back to a generic glyph.

No change to `ribbon.js` is needed for an ordinary button/dropdown/split — the
renderer is generic over the data.
