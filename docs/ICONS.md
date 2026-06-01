# Icon System

This document describes how ribbon and UI controls get their SVG icons. The
system has three layers, resolved in priority order by a single dispatcher,
`WC.icon(cmd, size)`:

1. **Fluent-first** — authentic Microsoft Fluent UI System icons, generated from
   the `@fluentui/svg-icons` npm package into `src/renderer/js/icons-fluent.js`.
2. **Hand-drawn** — monoline (Fluent-style) SVGs authored by hand in
   `src/renderer/js/icons.js`.
3. **Generic fallback** — a single placeholder glyph so every control renders
   *something*.

## Files at a glance

| File | Role |
| --- | --- |
| `src/renderer/js/icons.js` | The `WC.icon` dispatcher, hand-drawn icon set (`P`), command aliases (`ALIAS`), and the generic fallback (`_generic`). Source of truth, hand-edited. |
| `src/renderer/js/icons-fluent.js` | **Auto-generated.** Defines `window.WC.FLUENT`, a map of `cmd -> inner SVG markup`. Do not hand-edit. |
| `scripts/icon-map.json` | The 208-entry `cmd -> fluent icon name` mapping. **This is the file you edit to add or remap a Fluent icon.** |
| `scripts/gen-icons.js` | Build script that reads `icon-map.json`, pulls SVGs from `@fluentui/svg-icons`, and writes `icons-fluent.js`. |

## Load order

In `src/renderer/index.html` the generated file is loaded **before** the
dispatcher, so `WC.FLUENT` exists by the time `WC.icon` is first called:

```html
<script src="js/icons-fluent.js"></script>
<script src="js/icons.js"></script>
```

## The `WC.icon(cmd, size)` dispatcher

Defined in `src/renderer/js/icons.js`. It resolves a command name to an SVG
string in three tiers:

```js
window.WC.icon = function (cmd, size) {
  // Authentic Fluent UI System Icon (Microsoft's own) for ribbon commands.
  if (cmd && window.WC.FLUENT && window.WC.FLUENT[cmd]) {
    const s = size || 24;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true">${window.WC.FLUENT[cmd]}</svg>`;
  }
  if (!cmd) return svg('_generic', size);
  const name = ALIAS[cmd] || (P[cmd] ? cmd : '_generic');
  return svg(name, size);
};
```

Resolution sequence for a given `cmd`:

1. **Fluent** — if `WC.FLUENT[cmd]` exists, wrap its inner markup in a
   `fill="currentColor"` `<svg>` and return. This is the preferred path and
   covers the 208 commands listed in `icon-map.json`.
2. **No command** — if `cmd` is falsy, return the generic placeholder.
3. **Hand-drawn / alias** — otherwise pick a name via `ALIAS[cmd]` (a small
   alias table) or, if `P[cmd]` exists, the `cmd` itself; if neither matches,
   fall through to `_generic`. The chosen name is rendered by the local `svg()`
   helper.

Both the Fluent path and the hand-drawn path always emit a `viewBox="0 0 24 24"`
SVG sized by `size` (default `24`). The Fluent path uses `fill="currentColor"`
(filled glyphs); the hand-drawn path uses `fill="none"` with
`stroke-width="1.5"` and rounded line caps/joins (monoline glyphs):

```js
function svg(name, size) {
  const inner = P[name] || P._generic;
  const s = size || 24;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
```

`WC.rawIcon` is exported as an alias of `svg`, letting callers render a
hand-drawn icon by its `P` key directly (bypassing the Fluent layer and aliases).

### Color theming

Every icon — Fluent or hand-drawn — paints with `currentColor`. That means an
icon inherits the CSS `color` of whatever element it sits in, so the same markup
works in light/dark themes and for hover/active states without per-icon color
logic.

### Hand-drawn icons (`P`) and aliases (`ALIAS`)

`P` in `icons.js` is an object of `name -> inner SVG markup` (viewBox
`0 0 24 24`, `stroke="currentColor"`), covering common ribbon commands
(clipboard, font, paragraph, insert, references, review, view, QAT/window
controls, etc.) plus window chrome (`win_min`, `win_max`, `win_restore`,
`win_close`) and the `_generic` fallback.

`ALIAS` maps alternate command spellings onto an existing `P` key — for example
`showHide -> showhide`, `3dModels -> icons`, `insertEndnote -> insertFootnote`,
`accept`/`reject`/`next` -> `trackChanges`, `zoom100`/`a100` -> `onePage`. These
aliases only matter for commands that aren't already covered by the Fluent layer.

## The `@fluentui/svg-icons` mapping (`scripts/icon-map.json`)

`scripts/icon-map.json` is a flat JSON object of **208** `cmd -> fluent icon
name` pairs. The key is the renderer command name (matching what `WC.icon` is
called with); the value is a `@fluentui/svg-icons` base name (without the
`_<size>_<variant>` suffix). Examples:

```json
{
  "paste": "clipboard_paste",
  "bold": "text_bold",
  "italic": "text_italic",
  "bullets": "text_bullet_list_ltr",
  "find": "search",
  "table": "table",
  "trackChanges": "edit",
  "zoom": "zoom_fit",
  "whatSNew": "sparkle"
}
```

The package ships each glyph in multiple sizes and variants
(`<name>_24_regular.svg`, `<name>_20_regular.svg`, `<name>_24_filled.svg`, …),
all under `node_modules/@fluentui/svg-icons/icons/`. `icon-map.json` references
only the base name; `gen-icons.js` resolves which concrete file to use.

## How `icons-fluent.js` is generated (`scripts/gen-icons.js`)

`scripts/gen-icons.js` is a small Node script (not wired into an npm script —
run it directly with `node scripts/gen-icons.js`). It:

1. Loads the mapping: `const map = require('./icon-map.json')`.
2. For each `cmd`, calls `load(fluentName)` to find an SVG file.
3. Extracts and normalizes the inner markup with `inner(svg)`.
4. Writes the result as `window.WC.FLUENT = {...}` to
   `src/renderer/js/icons-fluent.js`.
5. Logs how many icons were generated and lists any `MISSING` mappings (entries
   whose Fluent file couldn't be found in any variant).

### Variant fallback (`load`)

For each base name, `load` tries a fixed list of size/variant suffixes in order
and returns the first file that exists:

```js
function load(name) {
  for (const v of [name+'_24_regular', name+'_20_regular', name+'_24_filled',
                   name+'_28_regular', name+'_16_regular']) {
    const p = path.join(DIR, v + '.svg');
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return null;
}
```

So the preferred glyph is the **24px regular** variant, falling back to 20px
regular, then 24px filled, then 28px regular, then 16px regular. If none of
those exist, the icon is reported as missing and simply omitted from
`WC.FLUENT` (at runtime that command then falls through to the hand-drawn /
generic layers).

### Markup normalization (`inner`)

`inner` strips the outer `<svg>` wrapper (keeping only the path/shape children)
and rewrites colors so the glyph is themeable:

```js
function inner(svg) {
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  let b = m ? m[1] : svg;
  b = b.replace(/fill="#[0-9A-Fa-f]{3,8}"/g, 'fill="currentColor"')
       .replace(/\sfill="none"/g, '');
  return b.trim();
}
```

Two transformations matter:

- **`fill="#…" -> fill="currentColor"`** — hard-coded hex fills become
  `currentColor` so the icon inherits text color (theming).
- **`fill="none"` removed** — dropped so it doesn't override the
  `fill="currentColor"` that the dispatcher sets on the wrapping `<svg>`.

The stored value in `WC.FLUENT[cmd]` is just the inner shape markup; the
dispatcher supplies the `<svg viewBox="0 0 24 24" … fill="currentColor">`
wrapper at render time.

### Output shape

`icons-fluent.js` is a single generated line of JSON-stringified data, prefixed
with a provenance comment:

```js
/* AUTO-GENERATED by scripts/gen-icons.js from @fluentui/svg-icons (MIT). */
window.WC = window.WC || {};
window.WC.FLUENT = {"100":"<path d=\"…\"/>","paste":"…", …};
```

## How to add or remap an icon

To give a command an authentic Fluent icon, or to change which Fluent glyph a
command uses:

1. **Find a Fluent icon name.** Browse
   `node_modules/@fluentui/svg-icons/icons/` (each file is
   `<name>_<size>_<variant>.svg`) and pick a base `<name>` that has a
   `_24_regular`, `_20_regular`, `_24_filled`, `_28_regular`, or `_16_regular`
   variant (those are the ones `load` looks for).
2. **Edit `scripts/icon-map.json`.** Add or change the entry, keyed by the
   renderer command name:

   ```json
   "myCommand": "some_fluent_icon"
   ```

3. **Regenerate:** `node scripts/gen-icons.js`. Watch the console summary; if it
   prints `MISSING: myCommand -> some_fluent_icon`, the chosen base name has no
   matching variant — pick a different name. On success, `icons-fluent.js` is
   rewritten with the new entry.
4. **Reload the app.** `WC.icon('myCommand')` now resolves through the Fluent
   layer.

Notes:

- Editing `icons-fluent.js` by hand is pointless — `gen-icons.js` overwrites the
  whole file on the next run.
- To intentionally *prefer the hand-drawn glyph* for a command, remove its
  `icon-map.json` entry and regenerate; the dispatcher will then fall through to
  `ALIAS`/`P` in `icons.js`.
- To add a brand-new hand-drawn glyph, add an entry to `P` (and, if needed,
  `ALIAS`) in `icons.js` directly — no build step involved.
