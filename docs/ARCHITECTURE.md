# Architecture

A faithful Microsoft Word desktop clone built on **Electron 31**, with the
renderer built by **electron-vite + TypeScript**. The document is a single
**owned ProseMirror engine forked from SuperDoc** (`src/renderer/core/superdoc-fork/`)
mounted at `#pm-editor` and driven through the `WC.PM` bridge
(`src/renderer/bridge/*.ts`). As of 2026-06-21 (FR-013) the default rendering mode
is the **paged** SuperDoc PresentationEditor, which paints real per-page sheets; the
legacy continuous-flow `overlay` paint is reachable only via `WC_LAYOUT=overlay npm run build`.
The shared chrome around it (ribbon, dialogs,
backstage, statusbar) is still **vanilla JavaScript** — classic `<script>` tags
loaded in dependency order onto a global `WC` namespace (its WC→TS/ESM migration
is deferred). The main process owns all privileged work (filesystem, dialogs,
text/PDF IO, window control) and exposes a narrow, typed API to the renderer
through a `contextBridge` preload; `.docx` is converted renderer-side by the fork.

> **Single world (slice 11):** the legacy `contenteditable` editor, the `--legacy`
> boot flag, and the `mammoth`/`html-to-docx` converter were removed. The PM engine
> is the only editor and the fork's `super-converter` is the only `.docx` path. Some
> sections below still describe shared chrome (`ribbon.js`, `commands.js`, `dialogs.js`,
> `app.js`) that legitimately lives on the `WC` namespace.

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
  and writing files (`fs/promises`) and showing native `dialog`s. `.docx` open/save
  pass **raw bytes** across the bridge (`doc:openBytes` / `doc:saveBytes`); the
  OOXML↔model conversion happens renderer-side in the vendored fork's
  `super-converter`, not in the main process.
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

The Chromium UI. `index.html` defines the DOM skeleton, loads the shared-chrome
classic scripts first, then the ESM entry `./main.ts` last (which constructs the
vendored ProseMirror Editor and mounts `#pm-editor`). The renderer never touches
Node directly; its only privileged channel is `window.wordAPI` (see §4). The
document model is the PM core + `WC.PM` bridge; the ribbon, dialogs, backstage,
and statusbar live as shared `WC.*` chrome modules.

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

`index.html` loads the shared-chrome classic scripts **in strict dependency order**
onto a global `WC` namespace (each file does `window.WC = window.WC || {}`), then
loads the ESM entry `./main.ts` **last**. The classic scripts build the static
chrome; `main.ts` constructs the ProseMirror Editor and installs the `WC.PM` bridge.

```
js/00-netlog.js               net recorder (loads first; observes load-time requests)
vendor/purify.min.js          DOMPurify (sanitizer)
js/icons-fluent.js            raw Fluent SVG icon data (auto-generated)
js/icons.js                   WC.icon / WC.rawIcon — icons keyed by cmd name
js/util.js                    WC.el, WC.debounce, WC.flyout, WC.dialog,
                              WC.toast, WC.colorPalette, WC.escapeHtml …
js/ribbon-data.js             WC.RIBBON — declarative tab/group/control tree
js/statusbar.js               WC.StatusBar — page/word count, view, zoom
js/home-features.js           WC.Clipboard (Office clipboard pane)
js/insert-features.js         WC.Insert — insert helpers / value tables
js/table-tools-pm.js          PM-mode Table Tools (contextual Table tabs)
js/draw-tools.js              WC.Draw — draw value/state tables
js/design-tools.js            WC.Design — themes/colors/fonts value tables
js/references-tools.js        WC.Ref — references value/state tables
js/mailings-tools.js          WC.Mail — mail-merge dialogs/state
js/review-tools.js            WC.Review — review value/state tables
js/dialogs.js                 WC.Dialogs — modal dialogs + task panes
js/commands.js                WC.Commands — command dispatcher + handlers (§6)
js/ribbon.js                  WC.Ribbon — renders WC.RIBBON, wires controls (§3)
js/files.js                   WC.Files — document lifecycle + IO via WC.PM/wordAPI
js/backstage.js               WC.Backstage — full-screen File menu
js/app.js                     bootstrap: builds title bar, binds keys, boot()
main.ts (ESM)                 constructs the vendored Editor, mounts #pm-editor,
                              installs WC.PM (commands/io/state-sync/focus)
```

`commands.js` must load before `ribbon.js` (the ribbon wires controls to
`WC.Commands`), and the feature value/state modules load before the dispatcher.
The leaf legacy editing engines (`editor.js`, `formatting.js`, `comments.js`,
`table-tools.js`, `layout-tools.js`, `header-footer.js`) were removed in slice 11;
their behavior now lives in the PM core + `bridge/*.ts`.

### Boot sequence

The classic `app.js` `boot()` builds the title bar/ruler and initializes the chrome
(`WC.StatusBar.init()`, `WC.Ribbon.init()`, `WC.Backstage.init()`, `WC.Files.init()`,
`bindKeys()`); the ESM `main.ts` then constructs the Editor, mounts `#pm-editor`, and
exposes `WC.PM` + `window.__WC_READY`. Keyboard shortcuts (`bindKeys()` in `app.js`)
route through `WC.Commands.run({ cmd })` or `WC.Files.*`, which drive the `WC.PM` bridge.

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
- **Live state sync:** the `WC.PM` bridge pushes editor state on each transaction
  (`WC.PM.onStateChange`), and `syncToggles(st)` flips the `toggled` class on
  bold/italic/align/list buttons from that state, via `TOGGLE_MAP`.
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
| `openBytes(presetPath)`          | `doc:openBytes`          | open dialog → raw `.docx` bytes (converted by the fork renderer-side) |
| `saveBytes(payload)` / `saveTextFile` | `doc:saveBytes` / `doc:saveTextFile` | write `.docx` bytes / html/txt to a path |
| `exportPdf(payload)`             | `doc:exportPdf`          | `webContents.printToPDF` |
| `print()`                        | `doc:print`              | `webContents.print` |
| `recent.list()` / `recent.clear()` | `recent:list` / `recent:clear` | recent-files JSON |
| `pickImage()`                    | `fs:readImage`           | image dialog → base64 data URL |
| `screenshot()`                   | `insert:screenshot`      | `desktopCapturer` screen grab |
| `openExternal(url)`              | `shell:openExternal`     | open `http(s)` in OS browser |
| `onMenuAction(cb)`               | `menu:action` (on)       | forwarded menu accelerators |

`WC.Files` (`files.js`) and the `WC.PM` bridge (`bridge/io.ts`) are the main
renderer-side consumers of this bridge. `.docx` bytes are fed into the fork
converter (`WC.PM.openDocx(bytes)` / `WC.PM.exportDocxBytes()`); html/txt/csv
import and html/txt save are handled renderer-side too.

---

## 5. The editor model — the PM core + `WC.PM` bridge

The document is a **ProseMirror editor** mounted at `#pm-editor` (inside `#pages`
inside `#canvas`/`#workarea`). The engine is an owned, vendored fork of SuperDoc's
`super-editor` core (`src/renderer/core/superdoc-fork/`): the schema, the
`super-converter`, and the editing extensions — with the Vue UI and `DomPainter`
dropped and telemetry stripped. `src/renderer/main.ts` constructs it and exposes
`window.WC.view`.

The renderer-side controller is the **`WC.PM` bridge** (`src/renderer/bridge/*.ts`).
It is the only document-write path — every ribbon command becomes a ProseMirror
transaction:

- **Commands:** `bridge/commands.ts` + the per-area modules (`insert.ts`, `table.ts`,
  `search.ts`, `review.ts`, `references.ts`, `design.ts`, `mail.ts`, `draw.ts`,
  `insert-exotica.ts`, …) apply marks/nodes and run the fork's commands. Many wire
  the fork's SuperDoc **Document API** (`editor.doc.*`) so constructs (fields,
  footnotes, comments, citations) export to `.docx`.
- **State sync:** `state-sync.ts` derives ribbon-facing state on each transaction and
  fires `WC.PM.onStateChange(st)` (drives `syncToggles`, the contextual Table tabs,
  combo values, etc.).
- **IO seam:** `bridge/io.ts` runs the fork converter — `WC.PM.openDocx(bytes)` /
  `WC.PM.exportDocxBytes()` for `.docx`, plus html/txt/csv import and html/txt save.
- **View & zoom:** `WC.PM.setView(...)` / `WC.PM.setZoom(...)` own view-mode and zoom
  (moved off the retired `WC.Editor`).
- **Focus & overlays:** `focus.ts`, the ink overlay (`ink-overlay.ts`), and the
  comments/track chrome (`comments-ui.ts`, `track-chrome.ts`) layer UI over the view.

The default engine is the **paged** SuperDoc PresentationEditor, which paints real
per-page sheets (real, model-driven multi-page layout). The legacy continuous-flow
`overlay` sheet is reachable only via `WC_LAYOUT=overlay npm run build` during the
transition and is slated for retirement (see [PAGINATION.md](PAGINATION.md)).

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

Each handler is a one-liner that drives the `WC.PM` bridge or opens a dialog.
Examples:

```js
H.bold      = () => WC.PM.toggleMark('bold');          // PM transaction
H.alignLeft = () => WC.PM.setAlign('left');
H.table     = (c, node) => WC.Dialogs.insertTable();   // dialog → WC.PM.insertTable
H.themes    = (c, node) => galleryMenu(node, …);       // theme via WC.PM bridge
H.trackChanges = () => WC.PM.setTrackChanges();        // PM Track Changes
```

The PM-only dispatch collapsed the old `pm ? PM : legacy` branches — there is no
legacy `E()` fallback. Several layout-coupled areas (layout-page, layout-arrange,
header-footer, text-effects) were gated by `isBlocked`/`notifyBlocked` with a Word-like
deferral toast while the layout engine was unbuilt; that engine has now SHIPPED as the
default paged PresentationEditor, so these gates are RESIDUAL — candidates to be un-blocked
and re-wired per-feature against the paged engine (re-verify the current `isBlocked` state
rather than assuming permanent deferral).
Unknown / out-of-scope commands surface a uniform "not implemented" message — see
`docs/NOT_IMPLEMENTED.md`.

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
(`WC.Insert.shapesMenu`, the references/design/mail menu builders, etc.).

### Other dispatch entry points on `WC.Commands`

- `comboCommit` / `comboDropdown` — font-name/size combos (commit typed value,
  or open the value list).
- `spinner(cmd, value)` — Layout paragraph indent/spacing spinners.
- `launcher(groupId, control, node)` — dialog-box-launcher icons, keyed by
  **group id** (avoids `cmd` collisions, e.g. the Font launcher vs. the font
  combo).
- `applyStyle(name)` → `WC.PM.applyNamedStyle(name)` (Styles gallery commit).

---

## 7. Data-flow diagram

```
                              MAIN PROCESS  (src/main/main.js — Node, privileged)
                              ┌───────────────────────────────────────────────┐
                              │  ipcMain.handle(...)                           │
                              │    doc:openBytes  → raw .docx bytes            │
                              │    doc:saveBytes / doc:saveTextFile → write    │
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
                              RENDERER (src/renderer/* — WC chrome + PM core/bridge)
   user clicks a ribbon control                       │
            │                                          │
            ▼                                          │
   ribbon.js  renderControl()                          │
   main-face click ──► WC.Commands.run(control, node)  │
   split arrow  ────► WC.Commands.dropdown(control)    │
            │                                          ▼
            ▼                                  files.js + bridge/io.ts
   commands.js (PM-only)             load/save ── wordAPI.openBytes/saveBytes ──► (main)
   ┌─────────────────────────────┐                       │
   │ H[cmd]? ── yes ─► handler    │              fork super-converter
   │   │  no                      │              (bytes ↔ PM model)
   │   ▼                          │                       │
   │ split/dropdown ─► dropdown() │ ──drives──►   WC.PM bridge (bridge/*.ts)
   │   │                          │              dispatch ProseMirror transactions
   │ *Menu builder (WC.flyout)    │              into the vendored Editor (#pm-editor)
   │   │  no match                │                       │
   │   ▼                          │             state-sync.ts → onStateChange(st)
   │ WC.notImplemented(label)     │                       │
   └─────────────────────────────┘                       ▼
            │                                    ribbon.js syncToggles(st)
            ▼                                    (bold/italic/align highlight)
   PM core: schema + super-converter + extensions
   (src/renderer/core/superdoc-fork/) — the only document model
```

---

## 8. Module map

| File | `WC` export | Owns |
| ---- | ----------- | ---- |
| `util.js` | `WC.el`, `WC.debounce`, `WC.flyout`, `WC.dialog`, `WC.toast`, `WC.colorPalette`, `WC.notImplemented`, `WC.escapeHtml` … | DOM helpers, flyouts, color palettes, toasts, screentips, modal dialog shell |
| `icons-fluent.js` / `icons.js` | `WC.icon`, `WC.rawIcon` | SVG icon set keyed by command name (Fluent data is auto-generated) |
| `ribbon-data.js` | `WC.RIBBON`, `WC.FONTS`, `WC.SIZES` | declarative tab/group/control tree (auto-generated from research data) |
| `core/superdoc-fork/` | (PM core) | the vendored ProseMirror engine — schema + `super-converter` + editing extensions; the only document model |
| `main.ts` | `window.WC.view`, `WC.PM` | constructs the Editor, mounts `#pm-editor`, installs the bridge |
| `bridge/*.ts` | `WC.PM` | the bridge: ribbon commands → PM transactions (commands/io/state-sync/focus + per-area modules), zoom, view, named styles, the fork Document API |
| `statusbar.js` | `WC.StatusBar` | bottom bar: page/word/char count, view buttons, zoom slider |
| `home-features.js` | `WC.Clipboard` | Office Clipboard pane |
| `insert-features.js` | `WC.Insert` | insert helpers / value tables (menus delegate to `WC.PM`) |
| `table-tools-pm.js` | (PM table tools) | the contextual Table Design/Layout tabs, wired to `WC.PM` |
| `draw-tools.js` | `WC.Draw` | draw value/state tables (ink via `WC.PM`/the ink overlay) |
| `design-tools.js` | `WC.Design` | themes/colors/fonts/paragraph-spacing value tables |
| `references-tools.js` | `WC.Ref` | references value/state tables |
| `mailings-tools.js` | `WC.Mail` | mail-merge dialogs/state |
| `review-tools.js` | `WC.Review` | review value/state tables |
| `dialogs.js` | `WC.Dialogs` | modal dialogs + task panes (Insert Table, Link, Symbol, Find/Replace, Font, Paragraph…) |
| `commands.js` | `WC.Commands` | the command dispatcher + the `H` handler table (PM-only, §6) |
| `ribbon.js` | `WC.Ribbon` | renders `WC.RIBBON`, wires controls to the dispatcher, syncs toggle state, contextual tabs |
| `files.js` | `WC.Files` | document lifecycle + IO through `WC.PM`/`window.wordAPI`, dirty/title tracking |
| `backstage.js` | `WC.Backstage`, `WC.BACKSTAGE` | full-screen File menu (New, Open, Print, Save, Export…) |
| `app.js` | — (bootstrap) | builds title bar + ruler, binds keyboard shortcuts, `boot()` init order |
