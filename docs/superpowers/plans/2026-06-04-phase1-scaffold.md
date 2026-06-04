# Phase 1 — Scaffold the new core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an electron-vite + TypeScript renderer that mounts a minimal, editable ProseMirror document (forked from SuperDoc) in our own `EditorView`, alongside the untouched legacy Word UI, with all existing tests green and the SuperDoc fork vendored/owned by the end.

**Architecture:** Single page, "two worlds." The legacy classic `<script>` files become **static `public/` assets** (verbatim) so `window.WC` and the contenteditable still build and the 228 tests still pass. One new ESM/TS entry (`main.ts`) is the *only* thing Vite transforms; it gets the schema + document JSON from a headless SuperDoc Editor (`.docx` IO only) and mounts **our own** ProseMirror `EditorView` whose every transaction flows through a single `dispatchTransaction` seam. Vendoring is hybrid: npm-pin to prove import→render→type, then source-vendor (strip Vue/painter/telemetry), add the SuperDoc editing plugins (Tab/indent), and remove the npm dep as a definition-of-done gate.

**Tech Stack:** Electron 31, electron-vite, Vite, TypeScript, ProseMirror (pinned to the spike's resolved versions), SuperDoc fork (`superdoc@1.38.0`, commit `03ab3f3`).

**Spec:** `docs/superpowers/specs/2026-06-04-phase1-scaffold-design.md`. **Branch:** `build/phase-1-scaffold` (already created off `main`).

> **Refinements vs. the spec (intentional; all verified against the published `superdoc@1.38.0` bundle in `spike/node_modules` + the source):**
> 1. **CSP mechanism** — a strict CSP **meta** + a relaxed CSP **header** combine by *intersection*, so the spec's §7.5 `onHeadersReceived` would NOT unblock HMR. Instead relax CSP via a **dev-only Vite `transformIndexHtml` plugin** that swaps the meta in dev; the prod build keeps the strict meta verbatim.
> 2. **Legacy renderer is fully static** — `js/`, `vendor/`, `styles/` (the only dirs that exist; there is **no** `src/renderer/assets/`) move to `src/renderer/public/` and are referenced root-absolute; Vite processes only `main.ts`.
> 3. **ESM entry path** — referenced as `./main.ts` (electron-vite's renderer root IS `src/renderer`; `/src/renderer/main.ts` would 404). Corrects spec §4.1/§7.2.
> 4. **`main.js` preload path** — `preload.js` → `../preload/index.js` (electron-vite builds preload to `out/preload/` in dev AND build).
> 5. **Schema + plugins come from a constructed Editor, not standalone exports** — `Schema` and `ExtensionService` are **not** exported from the published bundle. Stage B gets `editor.schema` + `editor.getJSON()` from a headless Editor (IO only) and mounts our own view with `baseKeymap` typing. The SuperDoc editing plugins (Tab/indent — coupled to the Editor's command system + 6 core extensions) are **rebuilt in Stage C against the vendored source**, where those classes are real. Fallback if the rebuild exceeds scaffold scope: let the vendored Editor own the PM view (it's plain prosemirror-view in v1, no painter) with the logger seam via `editor.on('transaction')` — still fully owned code.
> 6. **`loadXmlData` is a published 5-tuple** `[docx, media, mediaFiles, fonts, decrypted]` (mediaFiles = index 2, fonts = index 3). PM versions use the spike's resolved pins (model 1.25.7, state 1.4.4, view 1.41.8, transform 1.12.0). `telemetry:{enabled:false}` is the **primary** no-network control (default is enabled:true; the test-env guard does not apply in Electron).

---

## File structure (created / modified)

**Build chain (Stage A)**
- Create `electron.vite.config.ts`, `tsconfig.json`.
- Modify `package.json` (main field, scripts, devDeps; Stage B: deps + overrides).
- Move `src/renderer/{js,vendor,styles}` → `src/renderer/public/{js,vendor,styles}`.
- Create `src/renderer/public/js/00-netlog.js` (records non-local network for the smoke test).
- Modify `src/renderer/index.html` (root-absolute paths; net-log script first; ESM entry last).
- Modify `src/main/main.js` (preload path; dev/prod loader split).
- Create `src/renderer/main.ts` (ESM entry — stub in A, real in B).

**New core (Stage B)**
- Create `src/renderer/pm/index.ts` (single ProseMirror barrel).
- Create `src/renderer/core/docx-import.ts` (headless Editor → `{ schema, doc }`).
- Create `scripts/gen-fixture.js` + `src/renderer/core/generated/basic-list.docx.b64.ts` + `src/renderer/core/fixture.ts` (base64 fixture).
- Create `src/renderer/core/editor-view.ts` (our `EditorView` + `dispatchTransaction` seam).
- Add `tests/fixtures/basic-list.docx`.
- Create `scripts/smoke-pm.js`.

**Vendoring + editing plugins (Stage C)**
- Create `src/renderer/core/superdoc-fork/**`, `.../telemetry-noop.ts`.
- Create `src/renderer/core/plugins.ts` (rebuild SuperDoc editing plugins from vendored source).
- Modify `docx-import.ts` imports (`superdoc` → `@/core/superdoc-fork/...`), `package.json` (remove `superdoc`).

**Close-out (Stage D)**
- Modify `docs/plan/last-point.md`, `docs/plan/execution-map.md`.

---

## Test commands (used throughout)

`package.json` `main` becomes `./out/main/index.js`, so the renderer must be **built** before the probe runs (run the probe against the built renderer per spec §7.9):

```bash
# 228-test functional suite (legacy world) — must stay green:
npm run build && electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
node -e "const r=require('/tmp/results.json');console.log(r.summary); if(r.summary.fail){console.log(r.results.filter(x=>!x.pass).map(x=>x.name+': '+x.detail));process.exit(1)}"

# 9-test docx round-trip (Node-only; imports SOURCE src/main/docx-utils — unaffected by the build):
node scripts/test_docx.js          # read 'RESULT:'; exit≠0 on guard fail

# PM smoke test (Stage B onward):
npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js
node -e "const r=require('/tmp/smoke.json');console.log(r.summary); if(r.summary.fail){console.log(r.results.filter(x=>!x.pass));process.exit(1)}"
```

---

## Stage A — Build chain (electron-vite + TS), legacy app intact

### Task A1: Install electron-vite + add config and tsconfig

**Files:** Modify `package.json`; Create `electron.vite.config.ts`, `tsconfig.json`.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D electron-vite vite typescript @electron-toolkit/utils
```
Expected: added to `devDependencies`, no errors.

- [ ] **Step 2: Set `main` + scripts in `package.json`** (keep existing fields)

```json
{
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "start": "electron-vite dev"
  }
}
```

- [ ] **Step 3: Create `electron.vite.config.ts`**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

// A strict CSP <meta> + a relaxed header intersect (most-restrictive wins), so we
// swap the meta IN DEV only. The prod build keeps the strict meta verbatim — unsafe
// directives never ship.
const DEV_CSP =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self'; " +
  "connect-src 'self' ws://localhost:* http://localhost:*"

function devCspPlugin() {
  return {
    name: 'dev-csp',
    apply: 'serve' as const, // dev server only; never runs during `build`
    transformIndexHtml(html: string) {
      return html.replace(
        /(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/,
        `$1${DEV_CSP}$2`,
      )
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()], // keep node deps (html-to-docx, mammoth, …) external
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/main.js') } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/preload.js') } } },
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { '@': resolve(__dirname, 'src/renderer') } },
    plugins: [devCspPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } },
  },
})
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/renderer/*"] },
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/renderer/**/*.ts", "electron.vite.config.ts"]
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json electron.vite.config.ts tsconfig.json
git commit -m "chore(repo): add electron-vite + TypeScript build config for the renderer

What: electron.vite.config.ts (main/preload via externalizeDepsPlugin; renderer
root src/renderer with @ alias + a dev-only CSP transformIndexHtml plugin),
tsconfig.json, package.json main -> ./out/main/index.js + electron-vite scripts.
Why: ESM/TS tooling is the forcing function for importing ProseMirror/SuperDoc
(ADR-0002). Dev-only CSP relax avoids the meta+header intersection that would
otherwise block HMR while keeping prod strict."
```

---

### Task A2: Move the legacy renderer to `public/` and rewire `index.html`

**Files:** Move `src/renderer/{js,vendor,styles}` → `public/`; Create `src/renderer/public/js/00-netlog.js`, `src/renderer/main.ts`; Modify `src/renderer/index.html`.

- [ ] **Step 1: Move the three existing legacy dirs into `public/` (verbatim)**

```bash
mkdir -p src/renderer/public
git mv src/renderer/js src/renderer/public/js
git mv src/renderer/vendor src/renderer/public/vendor
git mv src/renderer/styles src/renderer/public/styles
```
(There is no `src/renderer/assets/` — do not move it.) Expected: `src/renderer/public/{js,vendor,styles}` exist; `index.html` stays at the renderer root.

- [ ] **Step 2: Create the network recorder `src/renderer/public/js/00-netlog.js`**

```js
// Records any non-local network attempt so the PM smoke test can assert "no telemetry".
// Loaded FIRST (before all other scripts AND main.ts) so it observes load-time requests.
// External file (not inline) so the strict `script-src 'self'` CSP allows it.
(function () {
  window.__NET_LOG = window.__NET_LOG || [];
  function local(u) { u = String(u || ''); return u.startsWith('/') || u.startsWith('./') || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('file:') || u.startsWith('about:'); }
  var of = window.fetch;
  if (of) window.fetch = function (i) { var u = (i && i.url) || i; if (!local(u)) window.__NET_LOG.push('fetch ' + u); return of.apply(this, arguments); };
  var oo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { if (!local(u)) window.__NET_LOG.push('xhr ' + u); return oo.apply(this, arguments); };
})();
```

- [ ] **Step 3: Create the ESM entry stub `src/renderer/main.ts`**

```ts
// Phase 1 new-core entry. Stage A: stub only (proves the ESM module loads AFTER
// the legacy classic scripts built window.WC). Real mount in Stage B.
console.info('[wc] main.ts loaded; window.WC present:', !!(window as any).WC)
```

- [ ] **Step 4: Rewrite `index.html` references to root-absolute; net-log first; ESM entry last**

Change every legacy `<link href="styles/...">`, `<script src="vendor/...">`, `<script src="js/...">` to a **leading-slash** path (Vite serves `public/` verbatim), preserving order. Add `00-netlog.js` as the **first** script and the ESM module **last**. Leave the strict CSP `<meta>` (line ~5) unchanged. Do NOT convert legacy scripts to `type="module"`.

```html
<!-- CSS (was styles/…) -->
<link rel="stylesheet" href="/styles/base.css" />
<!-- … all existing CSS links, now /styles/… … -->

<!-- network recorder FIRST -->
<script src="/js/00-netlog.js"></script>
<!-- legacy classic scripts (was vendor/… and js/…), SAME order -->
<script src="/vendor/purify.min.js"></script>
<script src="/js/icons-fluent.js"></script>
<!-- … all remaining legacy scripts, now /js/… , identical order … -->
<script src="/js/app.js"></script>

<!-- NEW: the only Vite-processed module, loaded LAST -->
<script type="module" src="./main.ts"></script>
```
Verify the count after editing: `grep -c '<script src=' src/renderer/index.html` (expected: the original script count **+1** for `00-netlog.js`; the original is 25 → expect 26).

- [ ] **Step 5: Verify the app launches in dev and `window.WC` builds**

```bash
npm run dev
```
Expected: window opens looking like Word; DevTools console shows `[wc] main.ts loaded; window.WC present: true`. Close.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/public src/renderer/index.html src/renderer/main.ts
git commit -m "refactor(repo): serve legacy renderer as static public/ assets; add ESM entry + net recorder

What: move js/vendor/styles into src/renderer/public/ (verbatim, untransformed),
rewrite index.html to root-absolute paths, add /js/00-netlog.js (loaded first) and
the ./main.ts ESM entry (loaded last).
Why: 'two worlds' coexistence — the legacy window.WC app stays byte-identical so the
228 tests pass, while Vite processes only main.ts. The net recorder lets the PM smoke
test assert no telemetry fires."
```

---

### Task A3: Main-process loader split + preload path

**Files:** Modify `src/main/main.js`.

- [ ] **Step 1: Add the `@electron-toolkit/utils` require near the top** (after `const docxUtils = require('./docx-utils');`, line ~7)

```js
const { is } = require('@electron-toolkit/utils');
```

- [ ] **Step 2: Fix the preload path** — change (line ~97):

```js
      preload: path.join(__dirname, 'preload.js'),
```
to:
```js
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
```
(electron-vite compiles preload to `out/preload/index.js` in BOTH dev and build — only the renderer is dev-served — so this resolves in both modes.)

- [ ] **Step 3: Replace the single `loadFile`** — change (line ~115):

```js
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
```
to:
```js
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
```
(After build, `__dirname` = `out/main`, so `../renderer/index.html` = `out/renderer/index.html`. The headless probe sets no `ELECTRON_RENDERER_URL`, so it deterministically hits `loadFile`.)

- [ ] **Step 4: Verify dev (loadURL) and built (loadFile) both work**

```bash
npm run dev                    # opens via dev-server URL; window controls work (preload OK); close
npm run build && electron .    # opens via built loadFile; close
```

- [ ] **Step 5: Commit**

```bash
git add src/main/main.js
git commit -m "feat(main): dev/prod renderer loader split + electron-vite preload path

What: add @electron-toolkit/utils is.dev; load the dev-server URL in dev else the
built index.html; point preload at ../preload/index.js (electron-vite output).
Why: the renderer is now built by electron-vite (dev server in dev, dist in prod);
the hardened webPreferences posture is otherwise unchanged."
```

---

### Task A4: Regression gate — 228 + 9 green on the new build chain

**Files:** none (verify + checkpoint commit).

- [ ] **Step 1: 228-test functional suite against the built renderer**

```bash
npm run build && electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
node -e "const r=require('/tmp/results.json');console.log(r.summary); if(r.summary.fail){console.log(r.results.filter(x=>!x.pass).map(x=>x.name));process.exit(1)}"
```
Expected: `{ total: 228, pass: 228, fail: 0 }`. Any failure ⇒ a `public/` path or script-order problem in `index.html` (revisit A2), not the new core.

- [ ] **Step 2: 9-test docx round-trip**

```bash
node scripts/test_docx.js
```
Expected: `RESULT: 9 pass / 0 fail`, exit 0.

- [ ] **Step 3: Checkpoint commit**

```bash
git commit --allow-empty -m "test(repo): confirm 228+9 green on the electron-vite build chain (Stage A)"
```

---

## Stage B — npm-pin + mount our own EditorView (import → render → type)

### Task B1: npm-pin SuperDoc + ProseMirror, enforce a single PM copy, add the barrel

**Files:** Modify `package.json`; Create `src/renderer/pm/index.ts`.

- [ ] **Step 1: Install the pinned versions** (SuperDoc + the PM packages the barrel needs)

```bash
npm install superdoc@1.38.0
npm install prosemirror-model@1.25.7 prosemirror-state@1.4.4 prosemirror-view@1.41.8 \
  prosemirror-transform@1.12.0 prosemirror-keymap@1.2.3 prosemirror-commands@1.7.1
```
(model/state/view/transform are the spike's lock-resolved versions; keymap/commands are for our `baseKeymap` typing.)

- [ ] **Step 2: Confirm a single PM copy; add `overrides` only for any duplicate**

```bash
npm ls prosemirror-model prosemirror-state prosemirror-view prosemirror-transform
```
Expected: one version of each. If any shows a second copy (e.g. under `superdoc`), add **only the duplicated** package(s) to `package.json` `overrides` at the resolved version and re-run `npm install`:
```json
{ "overrides": { "prosemirror-model": "1.25.7", "prosemirror-state": "1.4.4", "prosemirror-view": "1.41.8", "prosemirror-transform": "1.12.0" } }
```
Re-run `npm ls prosemirror-model` until it shows exactly one.

- [ ] **Step 3: Create the single PM barrel `src/renderer/pm/index.ts`**

```ts
// THE single source of ProseMirror for the renderer. Every module imports PM from
// here so only one copy of prosemirror-model/state/view/transform is ever loaded.
export { DOMSerializer } from 'prosemirror-model'
export type { Schema, Node as PMNode } from 'prosemirror-model'
export { EditorState, Plugin, TextSelection } from 'prosemirror-state'
export { EditorView } from 'prosemirror-view'
export { keymap } from 'prosemirror-keymap'
export { baseKeymap } from 'prosemirror-commands'
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/renderer/pm/index.ts
git commit -m "chore(repo): npm-pin superdoc@1.38.0 + ProseMirror (single-copy) + PM barrel

What: install superdoc@1.38.0 and the spike-resolved prosemirror-* versions; add a
single PM barrel; overrides for any duplicated PM package.
Why: build our own EditorView on the fork's schema without loading two copies of
prosemirror-model (the spike masked this via duck-typed serialization)."
```

---

### Task B2: Headless `.docx` import → `{ schema, doc }` + the base64 fixture

**Files:** Add `tests/fixtures/basic-list.docx`; Create `scripts/gen-fixture.js`, `src/renderer/core/generated/basic-list.docx.b64.ts`, `src/renderer/core/fixture.ts`, `src/renderer/core/docx-import.ts`.

- [ ] **Step 1: Copy a fixture and generate its base64 module**

```bash
mkdir -p tests/fixtures src/renderer/core/generated
cp "$(ls spike/fixtures/*.docx | head -1)" tests/fixtures/basic-list.docx
```
Create `scripts/gen-fixture.js`:
```js
// Regenerate the base64-inlined fixture module. Run: node scripts/gen-fixture.js
const fs = require('fs');
const b64 = fs.readFileSync('tests/fixtures/basic-list.docx').toString('base64');
fs.writeFileSync('src/renderer/core/generated/basic-list.docx.b64.ts',
  '// AUTO-GENERATED by scripts/gen-fixture.js — do not edit.\nexport default ' + JSON.stringify(b64) + '\n');
console.log('wrote basic-list.docx.b64.ts (' + b64.length + ' base64 chars)');
```
Run it:
```bash
node scripts/gen-fixture.js
```
Expected: `src/renderer/core/generated/basic-list.docx.b64.ts` created.

- [ ] **Step 2: Create `src/renderer/core/fixture.ts` (browser-safe base64 → ArrayBuffer)**

```ts
import b64 from '@/core/generated/basic-list.docx.b64'

// Decode WITHOUT Node Buffer/fs (renderer has nodeIntegration:false). Works under file://.
export function fixtureArrayBuffer(): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}
```

- [ ] **Step 3: Create `src/renderer/core/docx-import.ts`**

```ts
// Headless .docx import → { schema, doc }. Runs IN the Electron renderer (real DOM
// present), so NO jsdom/mockWindow (those would clobber global document/window and
// break the 228 tests). Stage C swaps the 'superdoc/super-editor' import to the
// vendored '@/core/superdoc-fork/...' path.
import { Editor, getStarterExtensions } from 'superdoc/super-editor'
import type { Schema } from '@/pm'

export interface ImportResult { schema: Schema; doc: unknown }

export async function importDocx(buf: ArrayBuffer): Promise<ImportResult> {
  // Published 5-tuple: [docx, media, mediaFiles, fonts, decrypted] — take index 2 + 3.
  const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(buf)
  // renderer has a real DOM; Editor falls back to global document — do NOT pass jsdom.
  // telemetry:{enabled:false} is load-bearing (ctor default is enabled:true; the
  // test-env guard does not apply in Electron → would POST on document-open).
  const editor = new (Editor as any)({
    isHeadless: true,
    extensions: getStarterExtensions(),
    content: docx,
    mediaFiles,
    fonts,
    telemetry: { enabled: false },
  })
  const schema = editor.schema as Schema     // PM Schema survives destroy()
  const doc = editor.getJSON()
  editor.destroy()
  return { schema, doc }
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/basic-list.docx scripts/gen-fixture.js src/renderer/core/generated src/renderer/core/fixture.ts src/renderer/core/docx-import.ts
git commit -m "feat(editor): headless .docx import to {schema, doc} + base64-inlined fixture

What: docx-import.ts builds a headless SuperDoc Editor (IO only, telemetry off) and
returns editor.schema + editor.getJSON(); fixture.ts decodes a base64-inlined .docx
(file://-safe, no fetch/fs); gen-fixture.js regenerates it.
Why: the published bundle does not export Schema; the proven path is to read schema
+ doc off a constructed Editor. Base64-inline avoids the blocked file:// fetch."
```

---

### Task B3: Mount our own EditorView (typeable) + smoke test

**Files:** Create `src/renderer/core/editor-view.ts`, `scripts/smoke-pm.js`; Modify `src/renderer/main.ts`.

- [ ] **Step 1: Write the failing smoke test `scripts/smoke-pm.js`**

```js
/* PM new-core smoke test. Run via:
   npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js
   Returns JSON {summary, results[]} (same contract as scripts/test-suite.js). */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (name, fn) => { try { const r = fn(); results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' }); } catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + (e && e.message || e) }); } };

  for (let i = 0; i < 100 && !window.__WC_READY; i++) await sleep(50); // sentinel gate

  t('view mounted (sentinel)', () => window.__WC_READY === true);
  t('legacy world intact', () => !!window.WC && !!window.WC.Editor);
  t('new view present', () => !!window.WC.view && typeof window.WC.view.dispatch === 'function');
  t('view is editable', () => window.WC.view.dom.isContentEditable === true);
  t('imported doc rendered', () => window.WC.view.state.doc.content.size > 4);
  t('Word-native list attrs present', () => /data-list-level|data-marker-type|data-list-numbering-type/.test(window.WC.view.dom.innerHTML));
  t('typing mutates the doc', () => {
    const v = window.WC.view; const before = v.state.doc.content.size;
    v.dispatch(v.state.tr.insertText('X', 1));
    return v.state.doc.content.size === before + 1;
  });
  t('no telemetry / non-local network', () => (window.__NET_LOG || []).length === 0 || ('offenders: ' + window.__NET_LOG.join(', ') && false));

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
```

- [ ] **Step 2: Run the smoke test, verify it FAILS** (no mount yet)

```bash
npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js
node -e "const r=require('/tmp/smoke.json');console.log(r.summary)"
```
Expected: failures (sentinel never set; `window.WC.view` undefined).

- [ ] **Step 3: Write `src/renderer/core/editor-view.ts` (our view + the dispatchTransaction seam)**

```ts
import { EditorState, EditorView, keymap, baseKeymap } from '@/pm'
import type { Schema, Plugin } from '@/pm'

export function mountEditor(mountEl: HTMLElement, schema: Schema, docJson: unknown, plugins: Plugin[] = []): EditorView {
  const doc = (schema as any).nodeFromJSON(docJson)
  const state = EditorState.create({ schema, doc, plugins: [...plugins, keymap(baseKeymap)] })
  const view = new EditorView(mountEl, {
    state,
    dispatchTransaction(tr) {
      const next = view.state.apply(tr)
      view.updateState(next)
      // Logger seam (Phase 3 wraps/replaces this). EVERY tr flows through here:
      ;((window as any).WC.pm ??= {}).lastTr = { docChanged: tr.docChanged, steps: tr.steps.length }
    },
  })
  return view
}
```

- [ ] **Step 4: Wire `main.ts` to import the fixture and mount our view**

```ts
import { mountEditor } from '@/core/editor-view'
import { importDocx } from '@/core/docx-import'
import { fixtureArrayBuffer } from '@/core/fixture'

const host = document.getElementById('pages') || document.body
const mountEl = document.createElement('div')
mountEl.id = 'pm-editor' // styled by the globally-loaded editor.css (looks like Word)
host.appendChild(mountEl)

const w = window as any
;(async () => {
  const { schema, doc } = await importDocx(fixtureArrayBuffer())
  const view = mountEditor(mountEl, schema, doc) // Stage B: baseKeymap typing only; Tab/indent plugins added in Stage C
  if (!w.WC) w.WC = {}        // legacy scripts already built window.WC — never reassign it or window.WC.Editor
  w.WC.view = view
  w.__WC_READY = true         // LAST statement after mount — the smoke test gates on this
})()
```

- [ ] **Step 5: Run the smoke test, verify it PASSES**

```bash
npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js
node -e "const r=require('/tmp/smoke.json');console.log(r.summary); if(r.summary.fail){console.log(r.results.filter(x=>!x.pass));process.exit(1)}"
```
Expected: `{ total: 8, pass: 8, fail: 0 }` (typing works via baseKeymap; list attrs render; no network).

- [ ] **Step 6: Confirm the 228 suite is still green**

```bash
npm run build && electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
node -e "const r=require('/tmp/results.json');console.log(r.summary); if(r.summary.fail) process.exit(1)"
```
Expected: `{ total: 228, pass: 228, fail: 0 }`.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/core/editor-view.ts src/renderer/main.ts scripts/smoke-pm.js
git commit -m "feat(editor): mount our own ProseMirror EditorView with a dispatchTransaction seam

What: editor-view.ts builds EditorState+EditorView from the fork-derived schema+doc,
routes every transaction through a single dispatchTransaction (logger seam), and adds
baseKeymap typing; main.ts imports the fixture, mounts the view, exposes window.WC.view
+ window.__WC_READY without clobbering the legacy window.WC; smoke-pm.js asserts
import→render→type + no network.
Why: closes the spike's Q1 last mile — a typeable Word document in our own view."
```

---

## Stage C — Source-vendor the fork + SuperDoc editing plugins (ownership gate)

> Mechanical copy + strip + alias-rewrite, then rebuild the SuperDoc editing plugins (Tab/indent) against the vendored source (where `Schema`/`ExtensionService`/the 6 core extensions are real). The smoke test is the safety net at every sub-step.

### Task C1: Copy the fork source in and strip Vue/painter/telemetry

**Files:** Create `src/renderer/core/superdoc-fork/**`, `.../telemetry-noop.ts`; Modify `electron.vite.config.ts`.

- [ ] **Step 1: Copy the super-editor source subtree**

```bash
mkdir -p src/renderer/core/superdoc-fork
cp -R opensource-solutions/SuperDoc/packages/super-editor/src/editors/v1/* src/renderer/core/superdoc-fork/
ls src/renderer/core/superdoc-fork    # expect: core/ extensions/ (and siblings)
```

- [ ] **Step 2: Delete the dropped surfaces**

```bash
cd src/renderer/core/superdoc-fork
find . -name '*.vue' -delete
rm -rf core/layout-adapter core/presentation-editor 2>/dev/null
grep -rl "DomPainter\|layout-engine\|presentation-editor" . | head   # expect: none reached by the import graph
cd -
```

- [ ] **Step 3: Add a no-op Telemetry stub + alias**

`src/renderer/core/superdoc-fork/telemetry-noop.ts`:
```ts
export class Telemetry { constructor(..._a: any[]) {} trackDocumentOpen() {} sendEvent() {} flush() {} destroy() {} }
export default Telemetry
```
Confirm the exact Telemetry specifier the fork uses, then alias it in `electron.vite.config.ts` renderer `resolve.alias`:
```bash
grep -rn "Telemetry" src/renderer/core/superdoc-fork | grep -i import | head
```
```ts
resolve: { alias: {
  '@': resolve(__dirname, 'src/renderer'),
  '@superdoc/common/telemetry': resolve(__dirname, 'src/renderer/core/superdoc-fork/telemetry-noop.ts'),
} },
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/core/superdoc-fork electron.vite.config.ts
git commit -m "chore(repo): vendor SuperDoc super-editor source; strip Vue/painter; telemetry no-op

What: copy packages/super-editor/src/editors/v1 into src/renderer/core/superdoc-fork,
delete .vue/layout-adapter/presentation-editor, add + alias a no-op Telemetry stub.
Why: ADR-0003 ownership — the fork must be vendored/stripped/owned, telemetry removed."
```

---

### Task C2: Rewrite imports, rebuild editing plugins (Tab/indent), switch our code to the fork

**Files:** Modify fork-internal imports, `src/renderer/core/docx-import.ts`; Create `src/renderer/core/plugins.ts`; Modify `src/renderer/core/editor-view.ts` consumers, `scripts/smoke-pm.js`.

- [ ] **Step 1: Rewrite the fork's internal path aliases to relative imports**

```bash
grep -rln "@core/\|@extensions/\|@converter/\|@harbour\|@/" src/renderer/core/superdoc-fork | head
```
Rewrite each alias to the correct relative path within `superdoc-fork/`; re-run until zero unresolved fork-internal aliases remain.

- [ ] **Step 2: Re-confirm `loadXmlData` arity against the vendored source; point `docx-import.ts` at the fork**

```bash
grep -n "loadXmlData" src/renderer/core/superdoc-fork/core/Editor.* | head
```
Adjust the destructure only if the vendored source differs from the published 5-tuple. Then change the `docx-import.ts` import:
```ts
import { Editor } from '@/core/superdoc-fork/core/Editor.js'
import { getStarterExtensions } from '@/core/superdoc-fork/extensions/index.js'
```

- [ ] **Step 3: Create `src/renderer/core/plugins.ts` — build SuperDoc editing plugins for OUR view**

Read how `Editor.ts` assembles plugins, then replicate against the vendored source. The list Tab/indent commands live on the **6 core extensions** the Editor injects, so prepend those to `getStarterExtensions()` and build via the (now-vendored) `ExtensionService` with a live-editor facade:
```ts
import { ExtensionService } from '@/core/superdoc-fork/core/ExtensionService.js'
import { getStarterExtensions } from '@/core/superdoc-fork/extensions/index.js'
import { getCoreExtensions } from '@/core/superdoc-fork/extensions/index.js' // confirm the real export name via grep
import type { Schema, Plugin, EditorView } from '@/pm'

// Live facade: the plugins close over editor.commands/state/view/dispatch. We bind
// them to OUR view via getters so Tab/indent acts on our EditorState.
export function buildEditingPlugins(schema: Schema, getView: () => EditorView): Plugin[] {
  const facade: any = {
    schema,
    extensionStorage: {},
    options: { enableInputRules: true },
    on() {}, off() {}, emit() {},
    get state() { return getView().state },
    get view() { return getView() },
    dispatch: (tr: any) => getView().dispatch(tr),
  }
  const exts = [...getCoreExtensions(), ...getStarterExtensions()]
  const svc = (ExtensionService as any).create(exts, [], facade)
  facade.commands = svc.commands ?? {}
  return (svc.plugins ?? svc.getPlugins?.() ?? []) as Plugin[]
}
```
> **Fallback (if the facade/command rebuild exceeds scaffold scope):** let the vendored Editor own the view — `new Editor({ element: mountEl, isHeadless:false, extensions:getStarterExtensions(), content, mediaFiles, fonts, telemetry:{enabled:false} })` (plain prosemirror-view in v1, no painter), set `window.WC.view = editor.view`, and wire the logger seam via `editor.on('transaction', …)`. Still fully owned code. Note in the PR which path was used.

- [ ] **Step 4: Wire plugins into the mount + add the Tab/indent smoke assertion**

In `main.ts`, expose `TextSelection` for the page-context smoke test, build plugins, and pass them to `mountEditor` (change `const view` from B3 to `let view`):
```ts
import { TextSelection } from '@/pm'
import { buildEditingPlugins } from '@/core/plugins'
// … expose for the probe (smoke-pm.js runs in page context without imports):
;(window as any).__PM_TextSelection = TextSelection
// … inside the async IIFE, after importDocx (note: buildEditingPlugins reads getView() lazily, so calling it before the assignment is safe):
let view: import('@/pm').EditorView
const plugins = buildEditingPlugins(schema, () => view)
view = mountEditor(mountEl, schema, doc, plugins)
```
Add to `scripts/smoke-pm.js` before the summary (set the selection INTO a list paragraph first, else `increaseListIndent` no-ops):
```js
  t('Tab indents a list item (doc mutates)', () => {
    const v = window.WC.view; v.focus();
    // find the first paragraph carrying list/numbering attrs and place the caret inside it:
    let pos = null; v.state.doc.descendants((n, p) => { if (pos === null && n.type.name === 'paragraph' && JSON.stringify(n.attrs).match(/numbering|listLevel|numId/i)) pos = p + 1; });
    if (pos === null) return 'no list paragraph in fixture';
    v.dispatch(v.state.tr.setSelection(window.__PM_TextSelection.create(v.state.doc, pos)));
    const before = JSON.stringify(v.state.doc.toJSON());
    const ok = v.someProp('handleKeyDown', (f) => f(v, new KeyboardEvent('keydown', { key: 'Tab' })));
    return ok === true && JSON.stringify(v.state.doc.toJSON()) !== before;
  });
```
(Expose `window.__PM_TextSelection = TextSelection` from `main.ts` for the probe, since the smoke file runs in page context without imports.)

- [ ] **Step 5: Verify the build + smoke (Tab/indent) green with vendored imports**

```bash
npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js
node -e "const r=require('/tmp/smoke.json');console.log(r.summary); if(r.summary.fail){console.log(r.results.filter(x=>!x.pass));process.exit(1)}"
```
Expected: all pass, including "Tab indents a list item". If `buildEditingPlugins` throws or returns `[]`, adjust the facade per the `ExtensionService.js`/`Editor.ts` source, or use the Step-3 fallback.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/core src/renderer/main.ts scripts/smoke-pm.js
git commit -m "feat(editor): rebuild SuperDoc editing plugins on our view (Tab/indent); use vendored fork

What: rewrite fork-internal aliases to relative; point docx-import at the vendored
Editor; add plugins.ts that assembles the core+starter extension plugins against a
live facade bound to our EditorView; wire Tab/indent; smoke asserts list indent.
Why: editing behaviors are coupled to the Editor command system — rebuildable only
against the vendored source. Brings the spec's 'our own EditorView' to full function."
```

---

### Task C3: Remove the npm dep, AGPL notice, ownership-gate verification

**Files:** Modify `package.json`; Create `src/renderer/core/superdoc-fork/NOTICE.md`.

- [ ] **Step 1: Remove the `superdoc` npm dependency and confirm zero imports**

```bash
npm uninstall superdoc
grep -rn "from 'superdoc'\|from \"superdoc\"\|from 'superdoc/\|require('superdoc')" src/ ; echo "grep-exit:$?"
npm ls superdoc 2>&1 | tail -1
```
Expected: `grep` finds **zero** matches; `npm ls superdoc` reports not installed.

- [ ] **Step 2: Add the AGPL-3.0 NOTICE**

`src/renderer/core/superdoc-fork/NOTICE.md`: record upstream SuperDoc, commit `03ab3f3`, version 1.38.0, license AGPL-3.0, what was vendored/stripped/modified. Add a short AGPL header comment atop the top-level vendored entry files.

- [ ] **Step 3: Full ownership-gate verification**

```bash
npm run build && electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js && node -e "const r=require('/tmp/smoke.json');if(r.summary.fail)process.exit(1);console.log('smoke',r.summary)"
electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js && node -e "const r=require('/tmp/results.json');if(r.summary.fail)process.exit(1);console.log('228',r.summary)"
node scripts/test_docx.js
npm ls prosemirror-model | grep -c 'prosemirror-model@1.25.7'   # expect 1
```
Expected: smoke all-pass (incl. Tab/indent + no-network), 228/228, docx 9/9, single PM copy, superdoc absent.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/core/superdoc-fork package.json package-lock.json
git commit -m "feat(editor): own the SuperDoc fork — remove npm dep, add AGPL notice

What: uninstall the superdoc npm dep (zero remaining imports), add NOTICE.md +
AGPL headers. Ownership gate: vendored, stripped, telemetry no-op, single PM copy.
Why: ADR-0003 — the fork is ours; no AGPL runtime dependency, no upstream coupling."
```

---

## Stage D — Close out

### Task D1: Final gates, checkpoint, PR

**Files:** Modify `docs/plan/last-point.md`, `docs/plan/execution-map.md`.

- [ ] **Step 1: Run every gate one last time**

```bash
npm run build
electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js && node -e "const r=require('/tmp/results.json');if(r.summary.fail)process.exit(1);console.log('228',r.summary)"
electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js && node -e "const r=require('/tmp/smoke.json');if(r.summary.fail)process.exit(1);console.log('smoke',r.summary)"
node scripts/test_docx.js
npm ls superdoc 2>&1 | tail -1                                  # not installed
npm ls prosemirror-model | grep -c 'prosemirror-model@1.25.7'   # 1
```

- [ ] **Step 2: Visual confirmation it still looks like Word**

`npm run dev` → ribbon + chrome visible (unwired OK); the PM editor renders the fixture inside the page area; type + Tab work. Close.

- [ ] **Step 3: Checkpoint via the plan-tracking skill**

Invoke `plan-tracking`: append a dated `last-point.md` entry (Phase 1 done / Phase 2 next) and tick the `execution-map.md` daily log.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin build/phase-1-scaffold
gh pr create --base main --title "Phase 1: scaffold the new ProseMirror core (electron-vite + vendored SuperDoc fork)" \
  --body "Implements docs/superpowers/specs/2026-06-04-phase1-scaffold-design.md. Two-worlds coexistence; 228+9 green; PM smoke green (import→render→type→Tab/indent, no-network); SuperDoc fork vendored + npm dep removed; single PM copy. Export is the next phase. Note in the description which view-mount path was used (rebuilt plugins vs. vendored-Editor-owns-view fallback)."
```

---

## Definition of done (mirrors spec §8)
- [ ] 228 green · 9 green · PM smoke green (incl. no-network assert).
- [ ] Tab indents a list item in the built renderer; smoke asserts the doc mutated. *(lands in Stage C)*
- [ ] `main.ts` sets `window.WC.view` + `window.__WC_READY` after mount; smoke gates on the sentinel.
- [ ] `scripts/smoke-pm.js` created.
- [ ] `dispatchTransaction` routes every transaction (apply + updateState + logger seam).
- [ ] `npm ls prosemirror-model` = one copy.
- [ ] Ownership gate: `npm ls superdoc` not-installed · zero `superdoc` imports in `src/` · Telemetry aliased to no-op · AGPL notice added.
- [ ] Ribbon/chrome still visible (unwired).
- [ ] Checkpoint via `plan-tracking`; PR opened.

## Out of scope (next phases)
- `.docx` **export** (`editor.exportDocx`) — next phase; the headless `Editor` + super-converter stay reachable so it isn't blocked.
- Ribbon → PM transaction wiring (Phase 2). Logger/verifier/MCP (Phase 3+). Pagination (Phase 7).
```
