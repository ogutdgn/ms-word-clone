# NOTICE — Vendored SuperDoc Fork

## Upstream

- **Project:** SuperDoc
- **Repository:** https://github.com/opensource-solutions/SuperDoc
- **Git commit:** 03ab3f3
- **Published version:** 1.38.0
- **License:** AGPL-3.0

## What is vendored

The following upstream packages are included in this directory tree:

- `core/`, `extensions/`, `components/`, `utils/`, `schema/`, `types/` — the SuperDoc
  editors/v1 editing engine (core + all extensions + super-converter)
- `_vendor/superdoc/contracts/` — `@superdoc/contracts`
- `_vendor/superdoc/common/` — `@superdoc/common`
- `_vendor/superdoc/style-engine/` — `@superdoc/style-engine`
- `_vendor/superdoc/url-validation/` — `@superdoc/url-validation`
- `_vendor/superdoc/document-api/` — `@superdoc/document-api`
- `_vendor/superdoc/presentation-editor/` — `@superdoc/presentation-editor`
- `_vendor/superdoc/layout-adapter/` — layout-adapter sibling package

## Modifications made in this fork

- **Vue UI removed:** the Vue application shell (`SuperEditor.vue`, `Toolbar.vue`,
  `SuperInput.vue`, `AIWriter.vue`, `ContextMenu.vue`) and all Vue-rendered overlay
  surfaces are excluded from the build. Remaining `.vue` imports are stubbed to inert
  no-op components by a Vite plugin (`fork-vue-stub` in `electron.vite.config.ts`).
- **Telemetry routed to no-op:** `telemetry-noop.ts` replaces all analytics/telemetry
  calls so no network traffic is emitted during editor initialisation or operation.
- **Geometry helpers stubbed:** browser layout helpers that depend on a full DOM at
  module evaluation time are guarded or replaced with no-op stubs to allow headless
  operation in the Electron renderer.
- **Paragraph shading rendered:** `encodeCSSFromPPr` (core/super-converter/styles.js)
  additionally maps `paragraphProperties.shading.fill` → `background-color`; upstream
  imported/serialized w:shd but never painted it (slice 2, 2026-06-06).
- **SuperDoc align keymap removed:** `Mod-Shift-L/E/R/J` shortcuts deleted from the
  TextAlign extension — they shadow Word's Ctrl+Shift+L (List Bullet) semantics; the
  app binds Word's real Ctrl+L/E/R/J at the document level (slice 2, 2026-06-06).
- All other editing-engine logic (ProseMirror schema, extensions, converters, DOCX
  import/export) is unmodified from upstream commit 03ab3f3.

## License

This vendored code is derived from SuperDoc (AGPL-3.0). It is used and distributed
under the terms of the GNU Affero General Public License v3.0. A copy of the AGPL-3.0
is available at https://www.gnu.org/licenses/agpl-3.0.html.

Under AGPL-3.0, any modified version of this software that is made available over a
network must also make its complete source code available under the same license.
