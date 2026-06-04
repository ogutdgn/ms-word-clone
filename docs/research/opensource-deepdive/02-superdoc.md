# 02 — SuperDoc (do NOT adopt; mine as reference)

Source read locally: `opensource-solutions/SuperDoc` (npm `superdoc` v1.38.0, by Harbour).
SuperDoc is the most sophisticated open-source DOCX engine — and the wrong dependency for us.

## What SuperDoc is
A contract-first DOCX engine on **ProseMirror + Yjs + Vue** with its **own** layout/render
pipeline: `super-converter` parses OOXML → a **hidden** PM doc → `layout-adapter` → `FlowBlock[]`
→ `layout-engine` paginates → `ResolvedLayout` → `DomPainter` paints the DOM. Per its own
`AGENTS.md`/`CLAUDE.md`: **"ProseMirror is state storage, not the visual renderer," and the
contenteditable PM view "is never shown."**

## The two blockers (why we don't adopt it)
1. **AGPL-3.0 + commercial dual-license.** Root `LICENSE` is GNU AGPL v3; all publishable
   packages declare `"license":"AGPL-3.0"`; README: *"Dual licensed — AGPLv3 for community use.
   Commercial license for proprietary deployments."* AGPL copyleft triggers on **distribution
   AND network/SaaS use** — a distributed Electron app *and* a hosted RL/eval harness both trip
   it. This is a legal/business gate, not a technical one.
2. **It replaces our renderer + imposes Vue.** `vue` is a **hard dependency of
   `@superdoc/super-editor`** (not just the shell) with ~30 `.vue` components; SuperDoc mounts its
   own Vue app and paints the page with `DomPainter`. This **directly conflicts** with our hard
   constraint that our Word-identical contenteditable chrome is the UI. You can hide its toolbar
   (`hideToolbar` / `headless-toolbar`) but the **document body is SuperDoc-rendered**, so our page
   sheets / existing features would be replaced, not preserved.

## The third problem (for the logger specifically)
**Raw ProseMirror access is `@deprecated` and slated for removal.** `editor.state`,
`editor.view`, `editor.schema`, `editor.commands`, `editor.dispatch(tr)` and the re-exported
`EditorView/EditorState/Transaction/Schema` all carry *"will be removed in a future version. Use
the Document API (editor.doc) instead."* (`packages/super-editor/src/editors/v1/core/Editor.ts`).
Raw Steps **are** reachable today via the `onTransaction` event (a real PM Transaction with
`.steps`), but building our logger on a surface the maintainers intend to delete is a standing
risk. The replacement `editor.doc` Document API emits **engine-agnostic domain "steps"**
(`TextRewriteStep`, `StyleApplyStep`, …) that are **coarser than PM Steps** — intent, not exact
transform.

Also note: `@superdoc/document-api`, `@superdoc/layout-engine`, `@superdoc/word-layout` are all
`private:true` workspace packages — **not separately installable**; you take the AGPL bundle or
vendor source (still AGPL).

## What is genuinely worth mining (reading reference only)
SuperDoc is an excellent **blueprint**. Specifically:

- **`super-converter` (OOXML↔PM)** — best-in-class fidelity: ~196 per-element handlers, parses
  `document.xml / styles.xml / numbering.xml / settings.xml / headers / footers / comments /
  footnotes / theme / fontTable` via `xml-js`, models track changes (`w:ins/w:del` →
  `trackInsert/trackDelete` marks), comments, fields/TOC (`fldChar` pre-processing). **Caveat:**
  no static schema (it's extension-built), deep `@superdoc/*` coupling, header/footer **export
  needs live child Editor instances** — so "just vendor the converter" is a myth. Study its OOXML
  handling and reimplement on our stack. *Evidence:* `…/core/super-converter/SuperConverter.js`,
  `…/v2/importer/docxImporter.js`, `…/core/super-converter/exporter.js`, `core/Schema.js`.
- **`layout-engine` deterministic pagination** — `layoutDocument(blocks, measures, options)` is a
  **pure greedy stacking pass** over pre-measured `lines[]`: real page boxes from OOXML `sectPr`
  (twips→px @96dpi), `keepNext` chains, `keepLines`, widow/orphan, tables splitting mid-row
  (`cantSplit`/`repeatHeader`), footnote reservation, multi-column balancing, PAGE/NUMPAGES
  convergence loop. Output (`Layout/Page/Fragment/Line`) is plain JSON. **This is the algorithm and
  data-contract to borrow for our pagination + a page-break verifier.** *Evidence:*
  `…/layout-engine/src/{index,layout-paragraph,paginator,layout-table,column-balancing}.ts`.
  **Determinism caveat:** the pass is pure, but `measures` come from **Canvas `measureText` +
  `actualBoundingBox*`** — so end-to-end layout is `f(model, FONT METRICS)`. Must run "deterministic"
  mode (pinned Noto Sans fallback, 0.1px rounding) + `installNodeCanvasPolyfill` + pinned fonts;
  even then Canvas metrics ≠ Word/embedded-font metrics, so page breaks won't be byte-identical to
  real Word (a fidelity ceiling). *Evidence:* `…/measuring/dom/src/index.ts`.
- **`document-api` contract** — `operation-definitions.ts` / `operation-registry.ts` /
  `invoke.ts` (a compile-time-validated typed dispatch table grouped by domain: find/get/insert/
  format/styles/tables/comments/track-changes/sections/headers-footers/toc/fields). **An excellent
  blueprint for our verifier's query surface and our semantic action-tool API.**
- **`word-layout`** (pure, **no DOM**) — numbering counters, tab stops, list markers, twips/px/pt
  conversions, measurement injected via callback. **Genuinely reusable in our codebase today**,
  MIT-checking aside (it's AGPL-bundled — confirm licensing before lifting code vs reimplementing).
- **`preset-geometry`** — OOXML autoshape SVG path table; handy if we add drawing shapes.

## Verdict
**Reject as a dependency** (AGPL + own renderer + deprecating raw Steps). **Adopt as a reference
design / oracle.** The *one* scenario that flips this: the business buys a SuperDoc **commercial
license** AND accepts ceding the document-rendering surface to SuperDoc (re-skinned to look like
Word) — then SuperDoc becomes a strong candidate **specifically for the headless verifier model**.
That is a separate, deliberate decision, not the default. If we ever consider it, the go/no-go gate
is a prototype measuring the `@superdoc/*` dependency closure to run import+export, and a round-trip
diff on our feature set (tables, lists, track changes, comments, TOC, headers/footers).
