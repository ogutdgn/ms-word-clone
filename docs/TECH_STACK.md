# Technology Stack & Dependencies

This document describes the technologies, runtime, and third-party libraries that power the Word clone. Every version below is taken directly from `package.json`; every architectural claim is grounded in the actual source.

## At a glance

| Layer | Technology | Version | Source |
| --- | --- | --- | --- |
| Desktop shell | Electron | `^31.7.6` | `package.json` (devDependency) |
| Build | electron-vite + TypeScript | `^5.0.0` / `^6.0.3` | `package.json`, `electron.vite.config.ts` |
| Main process | Node.js (bundled with Electron) | — | `src/main/main.js` |
| Document model | ProseMirror (`prosemirror-*`) | see `package.json` | `src/renderer/core/superdoc-fork/`, `src/renderer/pm/index.ts` |
| Schema + `.docx` converter | Vendored SuperDoc fork (`super-converter`) | (vendored, no npm dep) | `src/renderer/core/superdoc-fork/` |
| Renderer chrome | Vanilla JS, classic `<script>` tags on `window.WC` | — | `src/renderer/index.html`, `src/renderer/public/js/` |
| HTML sanitize | `dompurify` | `^3.4.7` | `package.json`, `src/renderer/public/vendor/purify.min.js` |
| Office icons | `@fluentui/svg-icons` | `^1.1.328` | `package.json`, `scripts/gen-icons.js` (build-time) |
| ZIP | `jszip` | `^3.10.1` | `package.json` (used by the fork converter) |
| Default theme | Aptos (Microsoft 365) | — | `src/renderer/public/styles/base.css`, `src/main/main.js` |

## Electron

The app targets **Electron `^31.7.6`**, built with **electron-vite + TypeScript** (`electron-vite`, `vite`, `typescript` devDependencies). The npm scripts run electron-vite:

```json
"scripts": {
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "start": "electron-vite dev"
}
```

The process model is the standard Electron split:

- **Main process** (`src/main/main.js`, plain CJS) — owns the `BrowserWindow`, the filesystem, native dialogs, and printing/PDF export. It passes `.docx` as raw bytes; the OOXML conversion runs renderer-side in the vendored fork.
- **Preload** (`src/main/preload.js`) — a secure `contextBridge` that exposes a single typed surface, `window.wordAPI`, to the renderer.
- **Renderer** (`src/renderer/`) — the PM core + `WC.PM` bridge (TS/ESM) plus the vanilla-JS chrome, loaded from `index.html`.

The window is created with hardened `webPreferences` — `contextIsolation: true`, `nodeIntegration: false` — so the renderer never touches Node directly. Anything needing the filesystem, dialogs, or window control goes through `wordAPI`:

```js
// src/main/preload.js
contextBridge.exposeInMainWorld('wordAPI', {
  openBytes:    (presetPath) => ipcRenderer.invoke('doc:openBytes', presetPath),
  saveBytes:    (payload)    => ipcRenderer.invoke('doc:saveBytes', payload),
  saveTextFile: (payload)    => ipcRenderer.invoke('doc:saveTextFile', payload),
  exportPdf:    (payload)    => ipcRenderer.invoke('doc:exportPdf', payload),
  // window controls, recent files, image/screenshot inserts, ...
});
```

## The build: electron-vite + TypeScript

The renderer is built by **electron-vite** (which wraps Vite for Electron's three targets — main, preload, renderer). The document core (`src/renderer/core/superdoc-fork/`, the `WC.PM` bridge, `main.ts`) is **TypeScript / ESM**; the editor pulls in ESM ProseMirror + SuperDoc-fork modules, which is what forced the move off the original no-bundler setup. `electron.vite.config.ts` wires the `@superdoc/*` + `@core`/`@converter` aliases, a single `prosemirror-model` copy (`resolve.dedupe`), and dev-only CSP/`.vue`-stub plugins. `npm run build` is a real build step (`out/{main,preload,renderer}`).

The shared chrome, by contrast, is still **vanilla JS** — served verbatim from `src/renderer/public/` (untransformed static assets) and loaded as classic `<script>` tags in dependency order, attaching to a single global namespace `window.WC`:

```html
<!-- shared-chrome classic scripts, then the ESM entry LAST -->
<script src="/js/ribbon-data.js"></script>
<script src="/js/commands.js"></script>
<script src="/js/ribbon.js"></script>
<script src="/js/app.js"></script>
<script type="module" src="./main.ts"></script>   <!-- constructs the Editor, installs WC.PM -->
```

For the chrome there is no module resolver, so **load order in `index.html` is the dependency graph**; `main.ts` loads last (after `window.WC` is built) and mounts the PM editor. Migrating the `WC` chrome to TS/ESM modules is deferred to a future slice.

DOMPurify ships as a pre-built UMD file (`src/renderer/public/vendor/purify.min.js`), loaded before any chrome module so `window.DOMPurify` is available downstream.

## Libraries and what each is for

### ProseMirror + the vendored SuperDoc fork — the document model & `.docx` converter

The document is a **ProseMirror editor** built on an **owned, vendored fork of SuperDoc's `super-editor`** core, checked into `src/renderer/core/superdoc-fork/` (schema + `super-converter` + the editing extensions; no `superdoc` npm dep, Vue UI and `DomPainter` dropped, telemetry stripped). The ProseMirror packages themselves are normal dependencies (`prosemirror-model/-state/-view/-transform/-commands/-keymap/-history/-tables/…`), funnelled through a single barrel (`src/renderer/pm/index.ts`) and deduped to one `prosemirror-model` copy by `electron.vite.config.ts`.

`.docx` import **and** export both go through the fork's **`super-converter`**, renderer-side: the main process hands raw bytes across the bridge (`doc:openBytes` / `doc:saveBytes`), and `bridge/io.ts` calls `WC.PM.openDocx(bytes)` / `WC.PM.exportDocxBytes()`. The converter does a **structural OOXML↔model round-trip** — sections, styles, numbering, tables, fields/TOC, footnotes, comments, track changes — rebuilding the package rather than HTML-flattening it. The legacy `mammoth` (import) and `html-to-docx` (export) libraries were retired with the legacy world in slice 11; html/txt/csv IO is also handled renderer-side (`doc:saveTextFile` + the bridge import legs).

> **Round-trip is rebuild-not-byte-identical.** The export normalizes/drops unmodeled XML; fidelity rests on the handler set + passthrough. `npm run test:roundtrip` (the PM-converter docx gate) is the regression guard — see [TESTING.md](TESTING.md).

### `dompurify` (`^3.4.7`) — HTML sanitization

Loaded in the **renderer** (vendored at `src/renderer/public/vendor/purify.min.js`, loaded before the chrome modules in `index.html`). It sanitizes incoming/pasted HTML before it enters the editor, via `WC.Files.sanitize()`:

```js
// src/renderer/public/js/files.js
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

The output, `src/renderer/public/js/icons-fluent.js`, is checked in and loaded as the first chrome icon module in `index.html`. This gives the ribbon genuine Microsoft Fluent UI iconography while shipping only the handful of icons the app actually uses (the script reports generated vs. missing counts against `scripts/icon-map.json`).

### `jszip` (`^3.10.1`) — OOXML packaging

A docx is a ZIP. `jszip` is used by the fork's `super-converter` to read and write the OOXML package on `.docx` open/save, and by the round-trip test tooling (`scripts/docx-inspect.js`) to assert zip-level invariants.

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
/* src/renderer/public/styles/base.css */
--doc-font: "Aptos", Calibri, Carlito, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif;
--doc-heading-font: "Aptos Display", "Aptos", Calibri, Carlito, "Segoe UI", system-ui, sans-serif;
--heading-color: #0E2841;   /* Aptos theme Text 2 (navy) */
```

The body default is **Aptos 12 pt** (`src/renderer/public/styles/editor.css`: `font-size: 12pt; /* Aptos 12 (real Word default) */`). The Aptos theme colors used throughout (heading navy `#0E2841`, accent palette) were extracted from the user's real Word build (`16.0.19929`, noted in `src/renderer/public/js/util.js`). The Design tab exposes Aptos as a named theme (`src/renderer/public/js/design-tools.js`), and `.docx` export carries the Aptos default through the fork converter's `docDefaults`/Normal style.

## Summary

Electron 31 for the desktop shell; an electron-vite + TypeScript renderer whose document core is an owned ProseMirror engine forked from SuperDoc (schema + `super-converter` doing the bidirectional `.docx` round-trip), with the ribbon chrome still loading ordered classic scripts onto a global `WC` namespace. The runtime libraries each have a single clear job — ProseMirror for the model, the fork converter (+ `jszip`) for `.docx`, `dompurify` for safety, `@fluentui/svg-icons` for authentic icons — tuned around a default Aptos theme that mirrors real Microsoft 365 Word.
