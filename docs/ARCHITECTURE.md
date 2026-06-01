# Architecture

A faithful Microsoft Word desktop clone built on **Electron 31**. The renderer
is **vanilla JavaScript with no bundler** — modules are plain classic `<script>`
tags loaded in dependency order, sharing a single global `WC` namespace. The
main process owns all privileged work (filesystem, dialogs, `.docx`
conversion, window control) and exposes a narrow, typed API to the renderer
through a `contextBridge` preload.

---

## 1. Process model

The app runs as two cooperating Electron processes.

### Main process — `src/main/main.js`

A privileged Node.js process. It:

- Creates the single `BrowserWindow` (`createWindow()`), 1440×920, **frameless**
  (`frame: false`) — the renderer draws its own title bar.
- Registers all `ipcMain.handle(...)` channels (window controls, recent files,
  open/save/saveAs, PDF export, print, image pick, screenshot, external links).
- Performs the heavy lifting that the renderer is forbidden from doing: reading
  and writing files (`fs/promises`), showing native `dialog`s, and converting
  documents with lazily-`require`d libraries — **`mammoth`** for `.docx → HTML`
  on open, **`html-to-docx`** for `HTML → .docx` on save.
- Installs **no application menu** (`Menu.setApplicationMenu(null)`): Word uses
  the ribbon, and the renderer is the single source of truth for keyboard
  shortcuts. `buildHiddenMenu()` exists but is intentionally not installed.

Two environment-specific accommodations live here:

- **WSL / WSLg:** `app.disableHardwareAcceleration()` runs automatically under
  WSL (`isWSL()`) to avoid Chromium GPU-init noise.
- **Faux maximize:** frameless windows on Linux/Wayland mis-handle native
  `maximize()`, so `toggleFauxMaximize()` "maximizes" by resizing to the
  display work area, preserving real frameless bounds and click accuracy.

### Renderer process — `src/renderer/`

The Chromium UI. `index.html` defines the DOM skeleton and loads every module.
The renderer never touches Node directly; its only privileged channel is
`window.wordAPI` (see §4). All editing, ribbon, dialogs, pagination, and
document model logic live here as `WC.*` modules.

### `BrowserWindow.webPreferences` — security posture

```js
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,    // renderer + preload run in separate JS worlds
  nodeIntegration: false,    // no require()/process in the renderer
  sandbox: false,            // preload needs Node to require('electron')
  spellcheck: true,
}
```

- **`contextIsolation: true`** — the preload script and page scripts execute in
  isolated contexts; the only thing crossing the boundary is the object passed
  to `contextBridge.exposeInMainWorld`.
- **`nodeIntegration: false`** — page scripts have no `require`, `process`, or
  Node globals. Compromised page content cannot reach the filesystem.
- **`sandbox: false`** — the preload runs with Node access so it can
  `require('electron')` and call `ipcRenderer`. The renderer itself stays
  unprivileged; only the curated bridge surface is reachable.

Additional hardening in `main.js`:

- **CSP** (in `index.html`): `default-src 'self'; script-src 'self'` — no remote
  code; images allow `data:`/`blob:` (for inline base64 pictures), styles allow
  `'unsafe-inline'` (the renderer builds element styles inline).
- **`setWindowOpenHandler`** denies all in-app navigation; `http(s)` URLs are
  handed to `shell.openExternal` instead.
- **Permission handlers** allow only microphone/audio capture (for Dictate via
  Web Speech); everything else is governed by the handler.
- DOMPurify (`vendor/purify.min.js`) is loaded first as a sanitization vendor.

---

## 2. Renderer load order & the `WC` namespace

`index.html` loads classic scripts **in strict dependency order**. There is no
module system — each file does `window.WC = window.WC || {}` and attaches its
public object to it (e.g. `WC.Editor`, `WC.Commands`, `WC.Ribbon`). Order
matters because later modules reference `WC.*` objects defined earlier.

```
vendor/purify.min.js          DOMPurify (sanitizer)
js/icons-fluent.js            raw Fluent SVG icon data (auto-generated)
js/icons.js                   WC.icon / WC.rawIcon — icons keyed by cmd name
js/util.js                    WC.el, WC.debounce, WC.flyout, WC.dialog,
                              WC.toast, WC.colorPalette, WC.escapeHtml …
js/ribbon-data.js             WC.RIBBON — declarative tab/group/control tree
js/editor.js                  WC.Editor — the document surface (see §5)
js/formatting.js              WC.formatBlock + named styles (Normal, Heading 1…)
js/statusbar.js               WC.StatusBar — page/word count, view, zoom
js/home-features.js           WC.Clipboard (Office clipboard) + WC.Dictate
js/insert-features.js         WC.Insert — cover pages, shapes, icons, SmartArt
js/table-tools.js             WC.Table — table editing + context menu
js/header-footer.js           WC.HeaderFooter — header/footer regions, fields
js/draw-tools.js              WC.Draw — freehand SVG ink layer
js/design-tools.js            WC.Design — themes, colors, fonts, watermark
js/layout-tools.js            WC.Layout — line numbers, hyphenation, arrange
js/references-tools.js        WC.Ref — TOC, footnotes, citations, index
js/mailings-tools.js          WC.Mail — mail-merge engine
js/review-tools.js            WC.Review — Track Changes engine
js/dialogs.js                 WC.Dialogs — modal dialogs + task panes
js/comments.js                WC.Comments — modern comments
js/commands.js                WC.Commands — command dispatcher + handlers (§6)
js/ribbon.js                  WC.Ribbon — renders WC.RIBBON, wires controls (§3)
js/files.js                   WC.Files — document lifecycle + IO via wordAPI
js/backstage.js               WC.Backstage — full-screen File menu
js/app.js                     bootstrap: builds title bar, binds keys, boot()
```

`commands.js` must load before `ribbon.js` (the ribbon wires controls to
`WC.Commands`), and both load after the feature modules (`WC.Insert`,
`WC.Design`, `WC.Review`, …) that their handlers delegate to.

### Boot sequence — `app.js`

`app.js` runs last and calls `boot()` (on `DOMContentLoaded` or immediately):

```js
buildTitleBar();          // QAT + window controls, wired to wordAPI.window.*
buildRuler();
WC.Editor.init();         // grab #editor, enable styleWithCSS, attach listeners
WC.StatusBar.init();
WC.Ribbon.init();         // render tabstrip + ribbon body from WC.RIBBON
WC.Backstage.init();
WC.Files.init();
WC.Layout.initSelection(); WC.Review.init();
bindKeys();               // Ctrl+S/O/N/P, alignment, Ctrl+Enter page break …
bindMisc();               // dirty-title sync; forward main's menu:action events
WC.Editor.focus(); WC.Editor.emit();
```

Keyboard shortcuts live entirely in the renderer (`bindKeys()` in `app.js`).
Most route through `WC.Commands.run({ cmd })`, `WC.Editor.exec(...)`, or
`WC.Files.*`.

---

## 3. The ribbon (presentation layer) — `ribbon.js`

`WC.RIBBON` (from `ribbon-data.js`) is a **declarative tree** of tabs → groups →
controls. `WC.Ribbon` renders it and wires each control to the dispatcher; it
holds no document logic.

- `renderTabStrip()` / `renderBody()` build the tab chips and per-tab panels.
  The **File** chip opens `WC.Backstage`; other tabs call `activate(id)`.
- `renderGroup()` lays out controls — large buttons (`LARGE` set), small
  icon-only buttons packed 3-per-column, combos (font name/size), spinners,
  and special galleries (`renderStylesGallery`, `renderPensGallery`).
- `renderControl()` produces three control shapes and wires their clicks:
  - **plain button** → `WC.Commands.run(c, node)` (or `.dropdown` if `type:'dropdown'`)
  - **split button** (`type:'split'`) → main face calls `WC.Commands.run`, the
    arrow calls `WC.Commands.dropdown`
  - **combo** → `comboCommit` (typed value) / `comboDropdown` (arrow)
  - group **launcher** (dialog-box-launcher) → `WC.Commands.launcher(group.id, …)`
- `controlIndex` maps each `cmd` to its DOM node, so handlers can toggle/recolor
  controls (e.g. `setColorBar`, `setComboValue`).
- **Live state sync:** `WC.Editor.onStateChange(st => this.syncToggles(st))`
  flips the `toggled` class on bold/italic/align/list buttons based on
  `queryCommandState`, via `TOGGLE_MAP`.
- **Contextual tabs:** `showContextualTab()` / `hideContextualTab()` inject and
  remove runtime tabs (e.g. Header & Footer), mirroring Word.

---

## 4. The preload bridge — `src/main/preload.js`

The renderer's *entire* privileged surface. `contextBridge.exposeInMainWorld`
publishes a single typed object as `window.wordAPI`; each method is a thin
`ipcRenderer.invoke`/`.on` wrapper. The renderer never sees `ipcRenderer`,
`require`, or any Node primitive.

| `window.wordAPI` member          | IPC channel              | Purpose |
| -------------------------------- | ------------------------ | ------- |
| `window.minimize()`              | `window:minimize`        | title-bar minimize |
| `window.toggleMaximize()`        | `window:toggleMaximize`  | faux maximize/restore |
| `window.close()`                 | `window:close`           | close window |
| `window.isMaximized()`           | `window:isMaximized`     | query state |
| `window.onStateChange(cb)`       | `window:state` (on)      | maximize-state push |
| `open(presetPath)`               | `doc:open`               | open dialog + `mammoth`/text parse → HTML |
| `save(payload)`                  | `doc:save`               | write to known path |
| `saveAs(payload)`                | `doc:saveAs`             | save dialog + `html-to-docx` |
| `exportPdf(payload)`             | `doc:exportPdf`          | `webContents.printToPDF` |
| `print()`                        | `doc:print`              | `webContents.print` |
| `recent.list()` / `recent.clear()` | `recent:list` / `recent:clear` | recent-files JSON |
| `pickImage()`                    | `fs:readImage`           | image dialog → base64 data URL |
| `screenshot()`                   | `insert:screenshot`      | `desktopCapturer` screen grab |
| `openExternal(url)`              | `shell:openExternal`     | open `http(s)` in OS browser |
| `onMenuAction(cb)`               | `menu:action` (on)       | forwarded menu accelerators |

`WC.Files` (`files.js`) and `app.js` are the main renderer-side consumers of
this bridge. Returned payloads are plain `{ ok, html, path, name, format }`
objects; HTML produced by `mammoth` is fed into `WC.Editor.setHTML(...)`.

---

## 5. The editor model — `editor.js`

The document is a **single `contenteditable` element**, `#editor`, inside
`#pages` inside `#canvas`/`#workarea`. There is one continuous editable surface;
"pages" are a visual illusion produced by `repaginate()` (gap spacers), not
separate DOM containers.

```html
<div id="editor" contenteditable="true" spellcheck="true"><p><br></p></div>
```

`WC.Editor` is the model + controller for that surface:

- **execCommand + `styleWithCSS`:** `init()` calls
  `document.execCommand('styleWithCSS', false, true)` and
  `defaultParagraphSeparator → 'p'`, so formatting is emitted as inline CSS and
  Enter creates `<p>` blocks (matching Word's paragraph model). `exec(cmd, val)`
  is the focus-preserving wrapper around `document.execCommand` used by most
  Home-tab handlers.
- **Custom command layer over execCommand:** where `execCommand` is
  insufficient, the editor provides its own primitives:
  `applyInlineStyle` / `applyInlineStyles` (wrap selection in a styled `<span>`,
  e.g. text-stroke outlines), `applyBlockStyle` (per-block CSS),
  `insertNodeHTML` (DOM insertion that preserves `class`/`data-*`), and a full
  **multilevel-list engine** (`demoteListItem`, `promoteListItem`,
  `setListLevel`, `applyMultilevelPattern`).
- **Selection state:** `saveRange()` / `restoreRange()` persist the caret across
  focus loss and ribbon clicks; `queryState()` reports active formatting
  (bold/italic/align/font/block) for ribbon sync via `onStateChange`/`emit`.
- **Pagination:** `repaginate()` lays the continuous flow out as discrete page
  sheets in print view by inserting `.wc-page-gap` spacers at page boundaries,
  binary-searching the split point inside a straddling paragraph and snapping to
  word boundaries. Caret position is preserved by absolute character offset
  across the DOM surgery.
- **View & zoom:** `setView('print'|'web'|'read'|'outline'|'draft')` toggles
  workarea classes; `setZoom` CSS-scales `#pages`.
- **IO seam:** `getHTML()` strips layout artifacts (page-gap spacers, find
  highlights) before saving; `setHTML(html)` loads a document and re-paginates
  once images decode, then rebuilds comments/ink.

---

## 6. Command dispatch flow — `commands.js`

`WC.Commands` is the bridge between ribbon controls and editor behavior. The
core is an object `H` of **handlers keyed by `cmd`**, plus two entry points.

### `Commands.run(control, node)` — the main path

```js
run(control, node) {
  WC.closeFlyouts(); WC.hideTip();
  const cmd = control.cmd;
  if (H[cmd]) { H[cmd](control, node); return; }            // 1. direct handler
  if ((control.type === 'split' || control.type === 'dropdown')
       && control.items) { this.dropdown(control, node); return; } // 2. fallback to menu
  WC.notImplemented(control.label || cmd);                  // 3. documented gap
}
```

Each handler is a one-liner that either drives the editor or delegates to a
feature module. Examples:

```js
H.bold      = () => E().exec('bold');                  // execCommand
H.alignLeft = () => E().exec('justifyLeft');
H.table     = (c, node) => WC.Dialogs.insertTable();   // dialog
H.themes    = (c, node) => galleryMenu(node, …);       // delegate to WC.Design
H.trackChanges = () => WC.Review.setTrackChanges();    // delegate to WC.Review
```

(`E` is `() => WC.Editor`.) Unknown / out-of-scope commands surface a uniform
"not implemented" message — see `docs/NOT_IMPLEMENTED.md`.

### `Commands.dropdown(control, node)` — split arrows & dropdowns

Triggered by a split-button arrow or a `type:'dropdown'` control. It is a long
`if (cmd === '…') return <menuBuilder>(node)` switch that opens the right
**`*Menu` builder** — small functions that call `WC.flyout(node, fly => …)` and
populate it with `WC.flyItem`/`WC.flyHeader`/`WC.flySep`:

```js
if (cmd === 'fontColor')  return colorMenu(node, 'fore');
if (cmd === 'changeCase') return changeCaseMenu(node);
if (cmd === 'margins')    return marginsMenu(node);
if (cmd === 'table')      return WC.Insert.tableMenu(node);   // delegated
…
// generic fallback: list control.items as flyout entries
```

Many entries delegate straight to a feature module's own menu builder
(`WC.Insert.shapesMenu`, `WC.HeaderFooter.headerMenu`, etc.).

### Other dispatch entry points on `WC.Commands`

- `comboCommit` / `comboDropdown` — font-name/size combos (commit typed value,
  or open the value list).
- `spinner(cmd, value)` — Layout paragraph indent/spacing spinners.
- `launcher(groupId, control, node)` — dialog-box-launcher icons, keyed by
  **group id** (avoids `cmd` collisions, e.g. the Font launcher vs. the font
  combo).
- `applyStyle(name)` → `WC.applyNamedStyle` (Styles gallery).

---

## 7. Data-flow diagram

```
                              MAIN PROCESS  (src/main/main.js — Node, privileged)
                              ┌───────────────────────────────────────────────┐
                              │  ipcMain.handle(...)                           │
                              │    doc:open  → mammoth   (.docx → HTML)        │
                              │    doc:save  → html-to-docx (HTML → .docx)     │
                              │    doc:exportPdf → printToPDF                  │
                              │    window:* / fs:readImage / insert:screenshot │
                              │    Menu.setApplicationMenu(null)               │
                              └───────────────▲───────────────────┬───────────┘
                                              │ ipcRenderer.invoke │ webContents.send
                  ── contextIsolation:true ───┼───────────────────┼── nodeIntegration:false ──
                                              │                    │
                              PRELOAD (src/main/preload.js — sandbox:false, has Node)
                              ┌───────────────┴────────────────────┴───────────┐
                              │  contextBridge.exposeInMainWorld('wordAPI', {…})│
                              └───────────────▲────────────────────────────────┘
                                              │ window.wordAPI.*
                              RENDERER (src/renderer/* — vanilla JS, global WC)
   user clicks a ribbon control                       │
            │                                          │
            ▼                                          │
   ribbon.js  renderControl()                          │
   main-face click ──► WC.Commands.run(control, node)  │
   split arrow  ────► WC.Commands.dropdown(control)    │
            │                                          │
            ▼                                          ▼
   commands.js                                  files.js  (WC.Files)
   ┌─────────────────────────────┐   load/save ── window.wordAPI.open/save ──► (main)
   │ H[cmd]? ── yes ─► handler    │                       │
   │   │  no                      │                       ▼ setHTML / getHTML
   │   ▼                          │              editor.js  (WC.Editor)
   │ split/dropdown ─► dropdown() │ ──drives──►   #editor contenteditable
   │   │                          │              execCommand + styleWithCSS
   │   ▼                          │              applyInline/Block, lists,
   │ *Menu builder (WC.flyout)    │              repaginate(), queryState()
   │   │  no match                │                       │
   │   ▼                          │             onStateChange / emit
   │ WC.notImplemented(label)     │                       │
   └─────────────────────────────┘                       ▼
            │ delegates                          ribbon.js syncToggles(st)
            ▼                                    (bold/italic/align highlight)
   feature modules: WC.Insert, WC.Design, WC.Review,
   WC.Ref, WC.Mail, WC.Layout, WC.Table, WC.HeaderFooter,
   WC.Draw, WC.Comments, WC.Dialogs …  (all operate on WC.Editor)
```

---

## 8. Module map

| File | `WC` export | Owns |
| ---- | ----------- | ---- |
| `util.js` | `WC.el`, `WC.debounce`, `WC.flyout`, `WC.dialog`, `WC.toast`, `WC.colorPalette`, `WC.notImplemented`, `WC.escapeHtml` … | DOM helpers, flyouts, color palettes, toasts, screentips, modal dialog shell |
| `icons-fluent.js` / `icons.js` | `WC.icon`, `WC.rawIcon` | SVG icon set keyed by command name (Fluent data is auto-generated) |
| `ribbon-data.js` | `WC.RIBBON`, `WC.FONTS`, `WC.SIZES` | declarative tab/group/control tree (auto-generated from research data) |
| `editor.js` | `WC.Editor` | the `#editor` contenteditable surface, selection state, custom command layer, pagination, zoom, view modes, IO HTML |
| `formatting.js` | `WC.Styles`, `WC.formatBlock`, `WC.applyNamedStyle` | block formatting + Word named styles (Normal, Heading 1…) |
| `statusbar.js` | `WC.StatusBar` | bottom bar: page/word/char count, view buttons, zoom slider |
| `home-features.js` | `WC.Clipboard`, `WC.Dictate` | Office Clipboard history + speech-to-text dictation |
| `insert-features.js` | `WC.Insert` | cover pages, shapes, icons, SmartArt, charts, screenshots, bookmarks |
| `table-tools.js` | `WC.Table` | table editing, insert/delete rows & columns, cell context menu |
| `header-footer.js` | `WC.HeaderFooter` | header/footer editing regions + page-number/date fields |
| `draw-tools.js` | `WC.Draw` | freehand SVG ink layer, pens, eraser, replay |
| `design-tools.js` | `WC.Design` | themes, color schemes, font pairings, paragraph spacing, watermark, page borders |
| `layout-tools.js` | `WC.Layout` | line numbers, hyphenation, object arrange (wrap/position/align/rotate) |
| `references-tools.js` | `WC.Ref` | table of contents, footnotes/endnotes, captions, citations, index |
| `mailings-tools.js` | `WC.Mail` | mail-merge engine (recipients, fields, preview, finish) |
| `review-tools.js` | `WC.Review` | Track Changes engine, display modes, accept/reject, accessibility |
| `dialogs.js` | `WC.Dialogs` | modal dialogs + task panes (Insert Table, Link, Symbol, Find/Replace, Font, Paragraph…) |
| `comments.js` | `WC.Comments` | modern threaded comments anchored to selections |
| `commands.js` | `WC.Commands` | the command dispatcher + the `H` handler table (§6) |
| `ribbon.js` | `WC.Ribbon` | renders `WC.RIBBON`, wires controls to the dispatcher, syncs toggle state, contextual tabs |
| `files.js` | `WC.Files` | document lifecycle + IO through `window.wordAPI`, dirty/title tracking |
| `backstage.js` | `WC.Backstage`, `WC.BACKSTAGE` | full-screen File menu (New, Open, Print, Save, Export…) |
| `app.js` | — (bootstrap) | builds title bar + ruler, binds keyboard shortcuts, `boot()` init order |
