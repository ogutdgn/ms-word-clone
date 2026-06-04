# Phase 1 — Scaffold the new core (design spec)

- **Date:** 2026-06-04
- **Status:** Draft — pending user review
- **Branch:** `build/phase-1-scaffold` (off `main`, the integration line)
- **Related ADRs:** ADR-0002 (ProseMirror model), ADR-0003 (fork SuperDoc core), ADR-0005 (docx via converter); context ADR-0001 (CUA pivot), ADR-0004 (lists = paragraph+numId)
- **Grounded by:** two analysis passes archived this session — a 5-subsystem context read and a 5-assumption adversarial verification (both codebase-confirmed with file:line evidence).

---

## 1. Goal & scope

**Goal.** Stand up a new renderer build chain (electron-vite + TypeScript) and mount a **minimal, editable ProseMirror document — forked from SuperDoc — in our own `EditorView`, with our own CSS, inside Electron**, while the legacy Word UI keeps rendering and all existing tests stay green. This closes the de-risk spike's unbuilt "Q1 last mile": an interactive editor you can type into.

**In scope (Phase 1):**
- electron-vite + TypeScript for the **renderer** (the build/TS transformation). main/preload stay CommonJS; main.js gains only a loader split + a dev-only CSP relaxation (§7.4–7.5).
- Vendor the SuperDoc fork (schema-builder + extensions + super-converter), **stripping** Vue UI, the DomPainter/layout-engine, and telemetry; pin the version; **own the code by end of phase**.
- Our own `EditorView` mounting a real `.docx` fixture (import → render → type), with a single `dispatchTransaction` choke point.
- A smoke test through the existing probe harness; the 228 + 9 suites stay green.

**Out of scope (later phases), but explicitly noted:**
- **`.docx` export** round-trip — **required upcoming work**, its own phase immediately after. Phase 1 must keep the export path *architecturally reachable* (headless `Editor` retained for IO).
- Wiring ribbon controls → PM transactions (Phase 2).
- Logger / verifier / MCP (Phases 3+). The `dispatchTransaction` seam is built now so these plug in without a refactor.
- Pagination / page sheets (Phase 7). The Phase 1 view is a **continuous flow with no page sheets** — expected, not a regression.

---

## 2. Locked constraints (guardrails — do not violate)

1. **Never work on `main`.** Phase 1 runs on `build/phase-1-scaffold`; `main` gets only reviewed merges at stable milestones.
2. **Hardened shell frozen.** Keep `contextIsolation:true`, `nodeIntegration:false`, `frame:false`, `Menu.setApplicationMenu(null)`, the deny-all `setWindowOpenHandler`, the media-only permission handler, and the single `window.wordAPI` contextBridge surface. The new renderer calls the identical bridge shape and **must not widen** it.
3. **Two hard product constraints:** UI fidelity (must keep looking/behaving like Word) and feature preservation (lose NO already-implemented feature — strangler-fig, never big-bang).
4. **Test gates:** the 228 in-renderer tests (`scripts/test-suite.js` via `--shot-evalfile`) and the 9 docx round-trip tests (`scripts/test_docx.js`) must stay green; add a new PM smoke test.
5. **Schema↔converter inseparability (ADR-0003):** adopting the converter means adopting its schema; any schema change touching what is *saved* must be matched by a converter-handler update.
6. **docx IO via the fork (ADR-0005):** import and export both go through the forked super-converter; export needs **live Editor instances** (esp. headers/footers) — so the headless Editor stays reachable.
7. **Telemetry off:** the offline/deterministic RL-env goal requires telemetry disabled before the new core ships.
8. **Version pin:** `superdoc@1.38.0` (umbrella) / SuperDoc git commit `03ab3f3`; vendor from `opensource-solutions/SuperDoc/` (ignore the redundant `superdoc-dev/`).

---

## 3. Decisions (this spec)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Coexistence model | **Single page, two worlds** | Only option satisfying both the 228 gate (needs `window.WC` + contenteditable present) and strangler-fig. |
| D2 | Vendoring mechanism | **Hybrid: npm-pin → source-vendor, ownership is a Phase-1 gate** | npm-pin de-risks the typeable mount fast (the real unknown); then vendor for real once the import surface is known. **npm dep removed before Phase 1 is "done."** |
| D3 | First slice | **Skeleton + import** (`.docx` fixture → render → type, Tab/indent) | Proves the actual fork chain end-to-end without reaching into the export phase. |
| D4 | Renderer-only migration | **main/preload stay plain JS** | Preserves the hardened shell and `test_docx.js`'s `require('../src/main/docx-utils')`. |
| D5 | Editor runtime | **Our own thin wrapper** over prosemirror-state/view; SuperDoc `Editor` used **headlessly for `.docx` IO only** | `Editor.ts` carries telemetry + the painter/layout graph we drop. |
| D6 | Logger seam | **Single `dispatchTransaction` choke point from day one** | Phase-3 logger plugs in without a refactor. |
| D7 | Test strategy | **Reuse the probe harness** (in-Electron smoke test); defer vitest | Glue is bundler-agnostic and already proven; the key assertion (type into a real view) must run in Electron anyway. |
| D8 | ProseMirror copies | **Mode A (fork source) + single-PM-copy discipline** | Avoids the duplicate-`prosemirror-model` footgun the spike accidentally masked. |

---

## 4. Architecture

### 4.1 The two worlds (one `index.html`)
```
index.html  (one page, served by electron-vite)
├─ 6 <link> CSS  (unchanged)
├─ 24 classic <script src="/js/...">  → window.WC  (LEGACY, runs first, untransformed)
│     └─ #editor contenteditable  ───────────────►  228 tests assert here (stay green)
└─ <script type="module" src="/src/renderer/main.ts">  (NEW, ESM/TS)
      └─ mounts ProseMirror EditorView near #editor   ──►  smoke test asserts here
```
The HTML spec guarantees all 24 classic scripts run, in document order, **before** the deferred ESM module — so `window.WC` is fully built before `main.ts` runs. Only `main.ts` (and its `prosemirror-*` imports) is transformed/HMR'd by Vite.

### 4.2 Build chain (renderer-only transformation)
electron-vite owns the `main` / `preload` / `renderer` configs, but **main.js and preload.js stay plain CommonJS, untransformed by Vite**. main.js does gain **two behavioral changes**: (1) a dev/prod loader split (§7.4), and (2) a dev-only CSP relaxation via `session.defaultSession.webRequest.onHeadersReceived` (§7.5). preload.js is untouched. "Renderer-only" refers to the build/TypeScript transformation — *not* to main.js being change-free.

### 4.3 The new core
- **Schema** built standalone from the fork's extensions (no live Editor needed).
- **Our own `EditorState` + `EditorView`**, every change routed through one `dispatchTransaction`.
- **SuperDoc `Editor` headless, import-only** (`Editor.loadXmlData`) to seed the view from a real `.docx`.
- ProseMirror imported through **one barrel** so the fork's schema and our view share a single PM instance.

---

## 5. Components (units, each with one purpose)

| Unit | File | Responsibility | Depends on |
|------|------|----------------|-----------|
| Vite config | `electron.vite.config.ts` | main/preload/renderer build; renderer root = `src/renderer` | electron-vite |
| Legacy assets | `src/renderer/public/{js,vendor}/…` | the 24 classic scripts, copied verbatim by Vite | — |
| Page | `src/renderer/index.html` | both worlds; root-absolute legacy paths; ESM entry last | public assets, main.ts |
| Loader split | `src/main/main.js` (1 line) | `loadURL(dev)` / `loadFile(dist)` via `ELECTRON_RENDERER_URL` | electron-vite env |
| PM barrel | `src/renderer/pm/index.ts` | single re-export of all `prosemirror-*` | pinned PM deps |
| Schema build | `src/renderer/core/schema.ts` | `createSchemaByExtensions(getStarterExtensions(), undefined)` | fork extensions |
| Editor wrapper | `src/renderer/core/editor-view.ts` | mount `EditorView`, own `dispatchTransaction` (apply + updateState + logger seam), expose handle | PM barrel, schema |
| Headless import | `src/renderer/core/docx-import.ts` | `await Editor.loadXmlData` → headless Editor → `getJSON()` → `destroy()` → PM JSON (telemetry off, **no jsdom**) | fork Editor (headless) |
| Dev CSP | `src/main/main.js` (dev-only) | relax CSP via `session.defaultSession.webRequest.onHeadersReceived` (dev only); prod meta stays strict in `index.html` | — |
| Entry | `src/renderer/main.ts` | wire schema → import fixture → mount view → set `window.WC.view` + `window.__WC_READY = true` (last) | the above |
| Smoke test | `scripts/smoke-pm.js` | probe-harness IIFE: import→render→list-attrs→type + no-network assert | probe harness |

**Boundary test:** each unit is understandable and replaceable in isolation — e.g. `docx-import.ts` can be swapped for a future converter path without touching `editor-view.ts`.

---

## 6. Data flow (the Phase-1 slice)
```
fixture.docx (bytes — loaded without widening the bridge; see §7.7)
  → await Editor.loadXmlData(buf)   [static async, no network] → [docx, _media, mediaFiles, fonts, _decrypted]
  → new Editor({ isHeadless:true, extensions, content: docx, mediaFiles, telemetry:{enabled:false} })
        → editor.getJSON()  (PM JSON)  → editor.destroy()
  → schema.nodeFromJSON(pmJson)                               → PM doc
  → EditorState.create({ schema, doc, plugins })              [plugins incl. the keymap for Tab/indent]
  → new EditorView(mountEl, { state, dispatchTransaction })   → typeable, styled like Word
        ▲ EVERY transaction (incl. appended/plugin) flows through dispatchTransaction (logger seam)
```
**In the Electron renderer the real DOM is present — no jsdom / mockWindow** (those were the Node-only spike shim; details + rationale in §7.7).

---

## 7. Verified configuration recipe (the concrete how)

> All items below were confirmed against the actual files (`index.html`, `main.js`, `package.json`, `spike/`) and current electron-vite/Vite docs.

> **⚠ Planning corrections — the implementation plan (`docs/superpowers/plans/2026-06-04-phase1-scaffold.md`) is authoritative where it differs.** A plan-stage pass verified §7 against the *published* `superdoc@1.38.0` bundle and corrected:
> - **§7.2 ESM path:** it's `./main.ts` (relative; electron-vite's renderer root *is* `src/renderer`), not `/src/renderer/main.ts`.
> - **§7.5 CSP:** relax in dev via a **dev-only Vite `transformIndexHtml` plugin** (swap the meta), NOT `onHeadersReceived` — a strict meta + relaxed header *intersect* and would still block HMR. Prod keeps the strict meta verbatim.
> - **§7.6 PM pins:** use the spike's resolved versions — model **1.25.7**, state 1.4.4, view **1.41.8**, transform **1.12.0** (do not hard-pin keymap/commands/etc.; override only on a detected duplicate).
> - **§7.7 schema/plugins:** `Schema` and `ExtensionService` are **not exported** from the published bundle. Stage B (npm-pin) gets the schema from `editor.schema` on a headless Editor and types via `baseKeymap`; the standalone `createSchemaByExtensions` + the SuperDoc editing plugins (Tab/indent) are rebuilt in **Stage C against the vendored source** (with a documented fallback of letting the vendored Editor own the view). `loadXmlData` is a published **5-tuple** `[docx, media, mediaFiles, fonts, decrypted]`.
> - **§7.1:** there is no `src/renderer/assets/` — move only `js/`, `vendor/`, `styles/`. The fixture is **base64-inlined** (file:// blocks `fetch`).

**7.1 Legacy scripts → `public/`.** Move the 24 assets into `src/renderer/public/` preserving subpaths (`public/vendor/purify.min.js`, `public/js/*.js`). Vite copies `public/` verbatim and never parses them, so `window.WC` is unchanged. **Do not** leave relative non-module `<script src>` in the Vite root — that triggers Vite issue #12921 and the files may not reach `dist`. This is the single way coexistence fails.

**7.2 `index.html`.** Keep the DOM + 6 CSS links. Replace the 24 relative script tags with **root-absolute** paths, *same order*, then the ESM entry **last**:
```html
<script src="/vendor/purify.min.js"></script>
<script src="/js/icons-fluent.js"></script>
<!-- … all 23, identical order … -->
<script src="/js/app.js"></script>
<script type="module" src="/src/renderer/main.ts"></script>
```

**7.3 `electron.vite.config.ts`.**
```ts
import { defineConfig } from 'electron-vite'
export default defineConfig({
  main:    { /* entry: src/main/main.js */ },
  preload: { /* entry: src/main/preload.js */ },
  renderer: {
    root: 'src/renderer',
    build: { rollupOptions: { input: { index: 'src/renderer/index.html' } } },
    // DO NOT set `base` — electron-vite presets a relative base for file://; base:'/' breaks prod loadFile.
  },
})
```
New devDeps: `electron-vite`, `@electron-toolkit/utils`. Current `package.json` — deps: `@fluentui/svg-icons`, `dompurify`, `html-to-docx`, `jszip`, `mammoth`; devDeps: `electron ^31.7.6`. No vite today.

**7.4 `main.js` loader split** (replaces the single `loadFile` at ~L115):
```js
const { is } = require('@electron-toolkit/utils') // or read process.env.ELECTRON_RENDERER_URL directly
if (is.dev && process.env.ELECTRON_RENDERER_URL) mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
else mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')) // verify vs actual build.outDir
```
Use `is.dev`/`ELECTRON_RENDERER_URL`, **not** the existing argv `isDev` (main.js:13), so the headless test binary deterministically hits `loadFile`. Verify the prod path against electron-vite's actual `outDir` (default `out/renderer/index.html`).

**7.5 CSP mode-split.**
- **Prod (verbatim, in shipped HTML):** `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'`
- **Dev only (via `session.defaultSession.webRequest.onHeadersReceived`, wrapped in `if(isDev)`):** `… script-src 'self' 'unsafe-inline' 'unsafe-eval'; … connect-src 'self' ws://localhost:* http://localhost:*`
- Prefer the dev-only header over an env-conditional meta tag so unsafe directives never enter the shipped artifact.

**7.6 ProseMirror pins (Mode A, single copy).** Pin to SuperDoc's **pnpm-lock-resolved** versions (not its catalog ranges, not the standalone clones):
```
prosemirror-model 1.25.4 · state 1.4.4 · view 1.41.7 · transform 1.11.0 (NOT 1.12.0)
keymap 1.2.3 · commands 1.7.1 · schema-list 1.5.1 · schema-basic 1.2.4
tables 1.8.5 · gapcursor 1.4.1 · dropcursor 1.8.2 · history 1.5.0 · inputrules 1.5.1
```
Enforce via npm `overrides` + the single PM barrel; **verify `npm ls prosemirror-model prosemirror-state prosemirror-view prosemirror-transform` shows exactly one of each.**

**7.7 Schema + headless import + view mount.**

*Source & vendored location.* The fork source in the clone is at `opensource-solutions/SuperDoc/packages/super-editor/src/editors/v1/…` (note the `packages/` prefix; there is no top-level `super-editor/`). **Vendored location (LOCKED): `src/renderer/core/superdoc-fork/`** — the owned, stripped copy. Imports change once, at the vendor step:
- **npm-pin sub-phase** (throwaway de-risk): import the same symbols the spike used from the published package — e.g. `import { Editor, getStarterExtensions, Schema } from 'superdoc'` (confirm the exact entry/symbols against the spike's working imports).
- **Vendored sub-phase** (end state): import from the local fork — e.g. `import { getStarterExtensions } from '@/core/superdoc-fork/extensions/index.js'`, `import { Schema } from '@/core/superdoc-fork/core/Schema.js'`. The vendor step also rewrites the fork's internal `@core`/`@extensions`/`@converter` aliases to relative paths (the alias codemod).

*Schema* (no live Editor needed — verified: `createSchemaByExtensions` is a static on the `Schema` class; `getStarterExtensions` is a named export):
```ts
const schema = Schema.createSchemaByExtensions(getStarterExtensions(), undefined) // undefined editor is safe
```

*Headless `.docx` import* (in the Electron renderer — **no jsdom / mockWindow**):
```ts
// Editor.loadXmlData is `static async` → 5-tuple [xmlFiles, media, mediaFiles, fonts, decryptedFileData]
const [docx, , mediaFiles] = await Editor.loadXmlData(buf)
const headless = new Editor({ isHeadless: true, extensions: getStarterExtensions(),
                              content: docx, mediaFiles, telemetry: { enabled: false } })
const pmJson = headless.getJSON()
headless.destroy()
```
**Why no jsdom/mockWindow:** in the renderer the real DOM is present, so the Editor auto-detects globals via `canUseDOM()` (Editor.ts:823-827); the documented headless call is `new Editor({ isHeadless:true, content })` (Editor.ts:3335). `mockDocument/mockWindow` are **deprecated** (Editor.ts:1674-1687, runtime warning) and **assign `global.document`/`global.window`**, which would clobber the legacy world the 228 tests depend on. jsdom + storage shims were the Node-only spike shim — permitted **only** in a future off-renderer Node unit test, never in-renderer.

*Fixture* (the import entry point): reuse a spike fixture (e.g. `basic-list.docx`), vendored under `tests/fixtures/`. Load `buf` **without widening the bridge** (constraint #2 — no `fs` in the renderer): either via the existing `window.wordAPI` open path or as a bundled `public/` asset fetched at runtime. Exact mechanism is a plan-level detail; a Phase-1-close check confirms the fixture file exists.

*Extensions / keymap (DECIDED — not deferred):* Tab/indent and input rules live in the `getStarterExtensions()` PM plugins, **not** in the schema — so schema-only will **not** produce the Tab/indent proof. Build the EditorView plugins from `getStarterExtensions()` — extract the keymap plugin directly, or via `ExtensionService.create(exts, [], editorStub)` if the mount path requires it. **Verify the `editorStub` shape against `ExtensionService.js` before coding**; the minimal stub likely needs `on/off/emit` + lifecycle events, not just `on(){}/off(){}`.

*View mount, global exposure, and the `dispatchTransaction` seam* (in `src/renderer/main.ts`):
```ts
const state = EditorState.create({ schema, doc: schema.nodeFromJSON(pmJson), plugins })
const view  = new EditorView(mountEl, {            // mountEl = new container inside #pages, styled with editor.css
  state,
  dispatchTransaction(tr) {
    const next = view.state.apply(tr)
    view.updateState(next)
    // logger seam — Phase 3 wraps/replaces this; EVERY tr (incl. appended/plugin) flows through here:
    ;(window.WC.pm ??= {}).lastTr = { docChanged: tr.docChanged, steps: tr.steps.length }
  },
})
// expose WITHOUT clobbering the legacy world (classic scripts already built window.WC + window.WC.Editor):
if (!window.WC) window.WC = {}        // never REASSIGN window.WC or window.WC.Editor — only add a new key
window.WC.view = view
window.__WC_READY = true               // LAST statement after mount — the smoke test gates on this sentinel
```

**7.8 Telemetry off + assert no network.** The load-bearing opt-out is the constructor option **`telemetry:{ enabled:false }`** (gate at `Editor.ts:943-945`), which prevents the telemetry object from ever being constructed (no `fetch` to `ingest.superdoc.dev/v1/collect`). **Correction vs. spike lore:** the installed `superdoc@1.38.0` *does* contain telemetry code in its super-editor chunks, and the spike never set `enabled:false` — so do not assume "the published build has none." When source-vendoring, additionally alias `@superdoc/common` Telemetry to a no-op stub. The `process.env` test-guard is **not** a production opt-out. The smoke test hard-asserts no request to any non-`file:` origin.

**7.9 Smoke test.** `scripts/smoke-pm.js` is a new IIFE returning a JSON string (same contract as `test-suite.js`). It **gates on the sentinel** first: `while (!window.__WC_READY) await sleep(50)` (bounded ~5 s; throw if it never becomes true) — this replaces a fixed `--shot-delay`. Then assert:
- **legacy intact:** `window.WC.Editor` still truthy.
- **new view present:** `window.WC.view` truthy and `typeof window.WC.view.dispatch === 'function'`.
- **import + render:** the fixture rendered; the Word-native list attributes (`data-list-level`, …) are present on the imported paragraphs.
- **editing works:** a Tab/indent keypress (or dispatched command) mutates `window.WC.view.state.doc`.
- **no network:** no request fired to `ingest.superdoc.dev` or any non-`file:` origin.

Run against the **built/preview renderer (`loadFile`)**, not the dev server, to avoid HMR/async-chunk races.

---

## 8. Test strategy & definition of done

**Suites:**
- 228 in-renderer (`electron . --probe-out=… --shot-evalfile=scripts/test-suite.js`) — must stay green (the legacy world is untouched).
- 9 docx round-trip (`node scripts/test_docx.js`) — must stay green (export path untouched this phase).
- New PM smoke (`scripts/smoke-pm.js` via the same probe glue) — must pass, **incl. the no-network assertion**.

**Definition of done (all required):**
- [ ] 228 green · 9 green · PM smoke green (incl. the no-network assert).
- [ ] Tab indents a list item in the built (`loadFile`) renderer; smoke asserts `view.state.doc` mutated.
- [ ] `main.ts` sets `window.WC.view` + `window.__WC_READY = true` after mount; smoke gates on the sentinel.
- [ ] `scripts/smoke-pm.js` created (probe-harness IIFE).
- [ ] `dispatchTransaction` choke point routes every transaction (apply + `updateState` + logger seam) — not a bare no-op.
- [ ] `npm ls prosemirror-model` shows exactly one copy (single-PM discipline).
- [ ] **Ownership gate** — ALL of: `npm ls superdoc` = not-installed · `grep -r "from 'superdoc'" src/` = 0 matches · every `@superdoc/*`/`@core/*` import aliased to the local fork or a no-op stub · Telemetry aliased to a no-op · AGPL-3.0 attribution headers added.
- [ ] Ribbon/chrome still visible (unwired) — still looks like Word.
- [ ] Checkpoint via `plan-tracking`; PR opened.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| **`window.WC`/view global not exposed** → 228 + smoke go dark | The legacy classic scripts (kept as classic, in `public/`) still build `window.WC.Editor`; the ESM entry exposes the *new* view under a distinct handle (`window.WC.view`) without overwriting `window.WC.Editor`. Named task + smoke assertion. |
| **Two copies of `prosemirror-model`** (spike masked this via duck-typed serialization) | Mode A + exact pins + npm `overrides` + single PM barrel + `npm ls` = one copy. **This is mandatory, not optional.** |
| **Telemetry phones home** (present in installed 1.38.0; spike didn't disable) | `telemetry:{enabled:false}` + vendor-time Telemetry alias-to-no-op + hard no-network assertion in the smoke test before the ownership gate is called passed. |
| **Relative non-module scripts not emitted to dist** (Vite #12921) | Assets in `public/` + root-absolute paths. |
| **Probe-vs-dev-server race** (executeJavaScript before late ESM chunks mount) | Run probe against built/loadFile renderer + `window.__WC_READY` sentinel. |
| **`build.outDir`/loadFile path drift** | Verify prod path against the configured `outDir`, not the assumed default. |
| **Vendoring effort underestimated** (alias rewrites, transitive `@superdoc/*`, ExtensionService stub) | Scope the vendor as an explicit Phase-1 task with its own checklist; schema-only path avoids ExtensionService unless extension behavior is needed. |
| **Export deferred but architecturally blocked** | Keep the headless `Editor` + super-converter reachable so the next phase can add `exportDocx` without rework. |

---

## 10. Open items (resolved at the vendor step — not blocking kickoff)
> The two formerly-open items (fork location, ExtensionService-vs-schema-only) are now **decided** in §7.7. What remains are vendor-step details, not pre-coding blockers:
- **Trim set:** which of the ~95 extensions to copy (schema-/keymap-bearing vs. droppable UI extensions) — determined by what the mount actually imports. Default: keep all schema- and keymap-defining extensions; drop pure-UI ones (slash-menu, context-menu, comment overlays) only after confirming they define no serialized node/mark.
- **Keymap wiring mechanism:** extract the keymap plugin directly vs. via `ExtensionService.create` — finalized once the `editorStub` shape is confirmed against `ExtensionService.js`.
- **AGPL-3.0 specifics:** attribution/header format for the owned fork — part of the ownership-gate checklist (§8).

---

## 11. Provenance
This spec consolidates **three** analysis passes run this session, each codebase-confirmed with file:line evidence:
1. **Context read** (5 subsystems: legacy app, spike, fork, decisions, tests).
2. **Adversarial verification** (5 load-bearing assumptions) — verdict **sound-with-adjustments**; adjustments folded into §7 and §9.
3. **Adversarial spec critique** (5 lenses) — verdict **ready-after-edits**; all real findings folded in, including the blocker fix (no jsdom/mockWindow in-renderer — it would clobber `window.WC` and break the 228 tests) and corrections that supersede pass 2 (fork path keeps its `packages/` prefix; `Editor.loadXmlData` is `static async` → 5-tuple). ~10 over-corrections were dropped as non-issues.
