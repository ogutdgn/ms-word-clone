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
  app already binds Word's real Ctrl+L/E/R/J in its document-level keydown map
  (app.js), and Ctrl+Shift+L's PM list wiring lands with the slice-2 area flip
  (slice 2, 2026-06-06).
- **`applyListDefinition` command added:** mints a list definition with explicit
  per-level `w:numFmt`/`w:lvlText` overrides and assigns it to the selection — powers
  the Word-style multilevel-list gallery and custom bullet glyphs (slice 2, 2026-06-06).
- **`changeListLevelBy` command added:** command-shaped wrapper applying an arbitrary
  list-level delta in one transaction (chained ±1 steps re-read stale editor.state and
  land one level short) — powers the Change List Level menu (slice 2, 2026-06-06).
- **SuperDoc heading keymap removed:** `Mod-Alt-1..6` shortcuts deleted from the
  Heading extension — they collide with the app's Ctrl/Cmd+Alt+1-3 heading chords
  (document-level keydown map) and their toggle-to-no-style semantics contradict
  Word's apply-only behavior (slice 3, 2026-06-06).
- **Four built-in style definitions added to import defaults:**
  `DEFAULT_LINKED_STYLES` (core/super-converter/exporter-docx-defs.js) additionally
  carries NoSpacing, Strong, Emphasis, SubtleEmphasis (Word-standard definitions) so
  `addDefaultStylesIfMissing` makes the full Quick-Styles gallery resolvable in every
  document, like real Word's always-available built-ins (slice 3, 2026-06-06).
- **resolvedPropertiesCache TableInfo fix:** both resolver entry points previously
  passed the raw `tableStyleId` string where the style-engine expects a TableInfo
  object — the table-style paragraph cascade was silently skipped for in-table
  paragraphs. Now builds `{ tableProperties, rowIndex, cellIndex, numRows, numCells }`
  with real indices from the ancestor chain (slice 3, 2026-06-06).
- **Format painter extended to Word scope:** `FormatCommands` stores paragraph
  properties (incl. numbering) alongside marks, captures first-run marks on a
  non-empty selection (oracle B9) and caret marks when collapsed, applies
  generically (replace-not-merge per oracle B6, `link` mark preserved per oracle
  B8), gains `cancelFormatPainter` (Esc path) and an idempotent `persistent`
  option on `copyFormat` (the 500ms double-click heuristic now only serves no-arg
  callers, fixing the ribbon click,click,dblclick disarm trap); the UI-guard
  selector covers the app's ribbon/flyout/dialog chrome so chrome clicks never
  consume the armed painter (slice 4, 2026-06-08).
  - The painter copies DIRECT character formatting + the paragraph style (not the
    resolved style cascade), matching Word — captured via the run's inline-override
    marks (`getFormattingStateAtPos(...).inlineMarks`), so a styled (e.g. Heading 1)
    source no longer bakes the style's font/color as explicit inline overrides on the
    target; the style travels via paragraphProperties (slice 4, 2026-06-08).
- All other editing-engine logic (ProseMirror schema, extensions, converters, DOCX
  import/export) is unmodified from upstream commit 03ab3f3.

## License

This vendored code is derived from SuperDoc (AGPL-3.0). It is used and distributed
under the terms of the GNU Affero General Public License v3.0. A copy of the AGPL-3.0
is available at https://www.gnu.org/licenses/agpl-3.0.html.

Under AGPL-3.0, any modified version of this software that is made available over a
network must also make its complete source code available under the same license.
