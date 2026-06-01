# Technology Stack & Dependencies

This document describes the technologies, runtime, and third-party libraries that power the Word clone. Every version below is taken directly from `package.json`; every architectural claim is grounded in the actual source.

## At a glance

| Layer | Technology | Version | Source |
| --- | --- | --- | --- |
| Desktop shell | Electron | `^31.7.6` | `package.json` (devDependency) |
| Main process | Node.js (bundled with Electron) | — | `src/main/main.js` |
| Renderer | Vanilla JS, no bundler, classic `<script>` tags | — | `src/renderer/index.html` |
| DOCX import | `mammoth` | `^1.8.0` | `package.json`, `src/main/main.js` |
| DOCX export | `html-to-docx` | `^1.8.0` | `package.json`, `src/main/main.js` |
| HTML sanitize | `dompurify` | `^3.4.7` | `package.json`, `src/renderer/vendor/purify.min.js` |
| Office icons | `@fluentui/svg-icons` | `^1.1.328` | `package.json`, `scripts/gen-icons.js` (build-time) |
| ZIP (tooling) | `jszip` | `^3.10.1` | `package.json`, `scripts/test_docx.js` |
| Default theme | Aptos (Microsoft 365) | — | `src/renderer/styles/base.css`, `src/main/main.js` |

## Electron

The app targets **Electron `^31.7.6`** (the only `devDependency`). There are no other build dependencies — there is no webpack, Vite, Rollup, esbuild, Babel, or TypeScript compiler in the toolchain. The npm scripts launch Electron directly:

```json
"scripts": {
  "start": "electron .",
  "dev": "electron . --enable-logging"
}
```

The process model is the standard Electron split:

- **Main process** (`src/main/main.js`) — owns the `BrowserWindow`, the filesystem, native dialogs, printing/PDF export, and the heavy docx conversion libraries.
- **Preload** (`src/main/preload.js`) — a secure `contextBridge` that exposes a single typed surface, `window.wordAPI`, to the renderer.
- **Renderer** (`src/renderer/`) — the entire Word UI, loaded from `index.html`.

The window is created with hardened `webPreferences` — `contextIsolation: true`, `nodeIntegration: false` — so the renderer never touches Node directly. Anything needing the filesystem, dialogs, docx conversion, or window control goes through `wordAPI`:

```js
// src/main/preload.js
contextBridge.exposeInMainWorld('wordAPI', {
  open:    (presetPath) => ipcRenderer.invoke('doc:open', presetPath),
  save:    (payload)    => ipcRenderer.invoke('doc:save', payload),
  saveAs:  (payload)    => ipcRenderer.invoke('doc:saveAs', payload),
  exportPdf: (payload)  => ipcRenderer.invoke('doc:exportPdf', payload),
  // window controls, recent files, image/screenshot inserts, ...
});
```

## The vanilla-JS, no-bundler choice

The renderer is deliberately built **without any bundler or framework**. `src/renderer/index.html` loads the entire application as a sequence of classic `<script>` tags in explicit dependency order:

```html
<!-- vendor -->
<script src="vendor/purify.min.js"></script>
<!-- app modules (classic scripts, dependency order) -->
<script src="js/icons-fluent.js"></script>
<script src="js/icons.js"></script>
<script src="js/util.js"></script>
<script src="js/ribbon-data.js"></script>
<script src="js/editor.js"></script>
<script src="js/formatting.js"></script>
<!-- ... home/insert/table/layout/references/review tools ... -->
<script src="js/app.js"></script>
```

There are no ES module `import`/`export` statements between renderer files. Instead, every module attaches itself to a single global namespace, `window.WC` (Word Clone):

```js
// e.g. src/renderer/js/files.js
window.WC = window.WC || {};
const WC = window.WC;
```

Cross-module references happen through `WC.*` (for example `WC.Editor`, `WC.dialog`, `WC.el`). Because there is no module resolver, **load order in `index.html` is the dependency graph** — utilities and data (`util.js`, `ribbon-data.js`) load before the features that consume them, and `app.js` loads last to wire everything together.

Why this approach:

- **Zero build step.** `npm start` runs the source as-is. There is no compile/transpile/bundle phase to maintain, no source maps, and no stale-build class of bugs.
- **Direct debugging.** The files the editor runs are the files on disk; DevTools shows real line numbers (`isDev` opens DevTools detached automatically).
- **Browser-native primitives.** The editor is a `contenteditable` `<div>` driven by the DOM and `document.execCommand`-style formatting — a bundler buys nothing here.

The single concession is the **`vendor/` folder**: DOMPurify ships as a pre-built UMD file (`src/renderer/vendor/purify.min.js`) and is loaded first, before any app module, so `window.DOMPurify` is available to everything downstream.

## Libraries and what each is for

### `mammoth` (`^1.8.0`) — DOCX import

Used in the **main process** to convert opened `.docx` files into HTML for the `contenteditable` editor. It is lazy-required on first use to keep startup fast:

```js
// src/main/main.js — let mammoth = null; (loaded on first use)
if (!mammoth) mammoth = require('mammoth');
```

`openPath()` calls `mammoth.convertToHtml()` with a custom `styleMap` that translates Word's named paragraph styles into the renderer's expected markup (`Title -> h1.doc-title`, `Heading 1 -> h1`, `Quote -> blockquote`, `Strong -> strong`, etc.) and an image converter that inlines pictures as base64 `data:` URLs:

```js
const result = await mammoth.convertToHtml(
  { path: filePath },
  { styleMap, includeDefaultStyleMap: true,
    convertImage: mammoth.images.imgElement(async (image) => {
      const buf = await image.read('base64');
      return { src: `data:${image.contentType};base64,${buf}` };
    }) }
);
```

### `html-to-docx` (`^1.8.0`) — DOCX export

Used in the **main process** to turn the editor's HTML back into a real `.docx` file on save/Save As. Also lazy-required:

```js
// src/main/main.js
if (!htmlToDocx) htmlToDocx = require('html-to-docx');
const buffer = await htmlToDocx(fullHtml, null, docxOpts);
await fsp.writeFile(filePath, buffer);
```

The export options in `writeDocx()` are tuned to match real Word defaults — `font: 'Aptos'`, `fontSize: 24` (half-points, i.e. 12 pt), and 1-inch (1440 twip) page margins. A code comment flags a real-world quirk: **all margin keys must be integers**, because `html-to-docx` stringifies missing keys as the literal `"undefined"`, which makes real Word reject the file.

### `dompurify` (`^3.4.7`) — HTML sanitization

Loaded in the **renderer** (vendored at `src/renderer/vendor/purify.min.js`, loaded first in `index.html`). It sanitizes incoming/pasted HTML before it enters the editor, via `WC.Files.sanitize()`:

```js
// src/renderer/js/files.js
return window.DOMPurify.sanitize(html, {
  ALLOWED_ATTR: ['style', 'href', 'src', 'alt', 'class', 'colspan', 'rowspan',
                 'width', 'height', 'title', 'align', 'data-comment'],
  ADD_TAGS: ['u'], ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta'],
});
```

This keeps formatting-relevant attributes (styles, table spans, comment markers) while stripping script/embed vectors. It complements the renderer's strict `Content-Security-Policy` (`script-src 'self'`) declared in `index.html`.

### `@fluentui/svg-icons` (`^1.1.328`) — authentic Office icons

This is a **build-time-only** dependency, not loaded at runtime. The script `scripts/gen-icons.js` reads SVGs straight out of `node_modules/@fluentui/svg-icons/icons`, picks the best size/weight per icon (preferring `_24_regular`, falling back through 20/24-filled/28/16), recolors `fill="#..."` to `fill="currentColor"`, and emits a single generated file:

```js
// scripts/gen-icons.js
window.WC = window.WC || {};
window.WC.FLUENT = { /* { iconName: "<path .../>" } */ };
```

The output, `src/renderer/js/icons-fluent.js`, is checked in and loaded as the first app module in `index.html`. This gives the ribbon genuine Microsoft Fluent UI iconography while shipping only the handful of icons the app actually uses (the script reports generated vs. missing counts against `scripts/icon-map.json`).

### `jszip` (`^3.10.1`) — DOCX inspection (tooling)

Used by the developer tooling rather than the app itself — `scripts/test_docx.js` loads exported `.docx` buffers with `JSZip.loadAsync()` to inspect the OOXML inside (a docx is a ZIP). It also transitively backs `html-to-docx`.

## WSL / WSLg runtime notes

The main process contains explicit accommodations for running under WSL/WSLg (Windows Subsystem for Linux GUI), where Chromium's GPU stack and frameless-window decorations behave differently from a native Linux desktop.

### Auto-disable hardware acceleration under WSL

WSLg's virtual GPU often fails Chromium's GPU init (a harmless software-render fallback, but it logs errors and can flicker). The app detects WSL and disables hardware acceleration automatically, so `npm start` is smooth with no extra flags:

```js
// src/main/main.js
function isWSL() {
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try { return /microsoft|wsl/i.test(fs.readFileSync('/proc/version', 'utf8')); }
  catch { return false; }
}
if (isWSL() && !process.argv.includes('--enable-gpu')) {
  app.disableHardwareAcceleration();
}
```

Pass `--enable-gpu` to opt back into hardware acceleration.

### "Faux maximize" for the frameless window

The window is **frameless** (`frame: false`) so the renderer can draw a custom Word title bar. On Linux/Wayland (including WSLg), Electron 31 has no client-side decoration support, so a native `maximize()` leaves the painted content offset from the OS window bounds — clicks then miss the title-bar buttons. The app sidesteps this by never calling native maximize; `toggleFauxMaximize()` instead resizes the window to the display's `workArea` and remembers the previous bounds:

```js
// src/main/main.js
function toggleFauxMaximize() {
  if (!fauxMax) {
    preMaxBounds = mainWindow.getBounds();
    const disp = screen.getDisplayMatching(mainWindow.getBounds());
    mainWindow.setBounds(disp.workArea);
    fauxMax = true;
  } else {
    if (preMaxBounds) mainWindow.setBounds(preMaxBounds);
    fauxMax = false;
  }
  mainWindow.webContents.send('window:state', { maximized: fauxMax });
  return fauxMax;
}
```

The IPC `window:toggleMaximize` and `window:isMaximized` handlers both go through this faux state, and the renderer's title bar reflects it via the `window:state` event.

## Default theme: Aptos (Microsoft 365)

The default document theme matches modern Word's **Aptos** look. Aptos is proprietary and unavailable on Linux, so the renderer defines fallback chains in CSS custom properties:

```css
/* src/renderer/styles/base.css */
--doc-font: "Aptos", Calibri, Carlito, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif;
--doc-heading-font: "Aptos Display", "Aptos", Calibri, Carlito, "Segoe UI", system-ui, sans-serif;
--heading-color: #0E2841;   /* Aptos theme Text 2 (navy) */
```

The body default is **Aptos 12 pt** (`src/renderer/styles/editor.css`: `font-size: 12pt; /* Aptos 12 (real Word default) */`). The Aptos theme colors used throughout (heading navy `#0E2841`, accent palette) were extracted from the user's real Word build (`16.0.19929`, noted in `src/renderer/js/util.js`). The Design tab exposes Aptos as a named theme (`src/renderer/js/design-tools.js`), and the DOCX export pins `font: 'Aptos'` so saved files carry the same default.

## Summary

A deliberately minimal, build-step-free stack: Electron 31 for the desktop shell, a framework-free renderer that loads ordered classic scripts onto a global `WC` namespace, and four runtime/build libraries each with a single clear job — `mammoth` in, `html-to-docx` out, `dompurify` for safety, `@fluentui/svg-icons` for authentic icons — all tuned around a WSL-friendly runtime and a default Aptos theme that mirrors real Microsoft 365 Word.
