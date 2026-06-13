# Phase-2 Slice 10 — PR 2: themes (Design tab) on the PM engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Flip the ribbon area `themes` (the Design tab) from the legacy `WC.Design` CSS-variable engine
onto the PM bridge at MAXIMAL real-MS-Word fidelity — themes/styleSet/colors/fonts **redefine named-style
definitions** (Heading1/2/3/Title/Subtitle/Normal) that EXPORT to `word/styles.xml` AND visually repaint
the PM view; page color writes a real `w:background`; page borders write real `w:pgBorders`; paragraph
spacing writes real docDefaults — all round-tripping through Word; watermark/effects/setAsDefault degrade
honestly.

**Architecture:** One new clone module `bridge/design.ts` (`installDesign(editor)`, mirrors
`bridge/references.ts`' fresh-`editor`/`refocus()` discipline) holds the `de*` verbs. Two NOTICE'd fork
investments unlock real fidelity: (A) a net-new `redefineNamedStyles` command on the `linked-styles`
extension that mutates **both** the export structure (`translatedLinkedStyles.styles` + `syncStylesDiffToConvertedXml`)
**and** the visual structure (`converter.linkedStyles[].definition.styles`), then forces a decoration
regenerate + `stylesDefaultsChanged` emit; (B) a net-new document-level `w:background` exporter + importer
+ `doc` schema attr (+ `w:displayBackgroundShape` settings flag). `pageBorders`/`paragraphSpacing` ride
existing real Document-API levers (`editor.doc.sections.setPageBorders`, `editor.doc.styles.apply`). THE
FLIP adds `'themes'` to `FLIPPED`; the legacy `WC.Design` stays loaded with its ELSE branch byte-identical
(frozen 257 gate).

**Tech Stack:** Electron + vanilla-JS chrome (`WC` namespace) → `WC.PM` bridge (TS/ESM) → vendored
ProseMirror/SuperDoc fork (`src/renderer/core/superdoc-fork/`). Tests: `scripts/test-suite-pm.js`
(engine-observable, `[10th]` label). Oracle: `scripts/oracle/word-oracle-win.ps1` vs Word for Windows 16.0.

---

## §0. Pre-verified facts (grounded by a 7-agent verbatim gather + author re-verification; file:line)

**F1 — Named-style export machinery EXISTS and round-trips (verified).** `replayStyles({stylesDiff,editor})`
([extensions/diffing/replay/replay-styles.ts:56](../../../src/renderer/core/superdoc-fork/extensions/diffing/replay/replay-styles.ts)) mutates
`converter.translatedLinkedStyles.styles[id]` via `applyAttributesDiff` (deep dotted-path, non-clobbering —
[replay-style-utils.ts:135](../../../src/renderer/core/superdoc-fork/extensions/diffing/replay/replay-style-utils.ts)),
then `syncStylesDiffToConvertedXml` upserts the matching `<w:style w:rPr/w:pPr>` node in `convertedXml['word/styles.xml']`
([core/helpers/styles-xml-helpers.ts:114,173-193](../../../src/renderer/core/superdoc-fork/core/helpers/styles-xml-helpers.ts)),
sets `documentModified`, `promoteToGuid()`, emits `stylesDefaultsChanged`.
`modifiedStyles` requires the style to ALREADY exist in `translatedLinkedStyles.styles` (skips otherwise —
replay-styles.ts:103-108).

**F2 — Heading1/Title/Normal ARE populated at runtime (verified, the load-bearing chain).**
`addDefaultStylesIfMissing` injects the built-in `<w:style>` defs into `convertedXml['word/styles.xml']` at
parse time ([SuperConverter.js:316](../../../src/renderer/core/superdoc-fork/core/super-converter/SuperConverter.js));
`translateStyleDefinitions(docx)` then encodes that post-injection XML into `translatedLinkedStyles.styles`
([docxImporter.js:261](../../../src/renderer/core/superdoc-fork/core/super-converter/v2/importer/docxImporter.js)) →
assigned to `converter.translatedLinkedStyles` ([SuperConverter.js:1119](../../../src/renderer/core/superdoc-fork/core/super-converter/SuperConverter.js)).
`DEFAULT_LINKED_STYLES` keys: `Normal, Title, Subtitle, Heading1, Heading2, Heading3, Hyperlink, NoSpacing,
Strong, Emphasis, SubtleEmphasis, TableGrid` ([exporter-docx-defs.js:93+](../../../src/renderer/core/superdoc-fork/core/super-converter/exporter-docx-defs.js)).

**F3 — `translatedLinkedStyles.styles[id]` is an encoded `StyleDefinition`** (NOT raw `w:style` JSON).
`runProperties.fontFamily.ascii` (plain string), `runProperties.color.val` (hex string), `runProperties.fontSize`
(half-points integer), `paragraphProperties.spacing` (`{before,after,line,lineRule}` integers/enum). `styleTranslator.decode`
reads `node.attrs.style` = this object ([style-translator.js:104](../../../src/renderer/core/superdoc-fork/core/super-converter/v3/handlers/w/style/style-translator.js)).
Default Heading1 binds font/color to the THEME (`asciiTheme:majorHAnsi`, `color/themeColor:accent1`); to override
with a literal, set `fontFamily.ascii`/`hAnsi` and `color.val` (and optionally null the theme bindings).

**F4 — THE VISUAL/EXPORT ASYMMETRY (decisive; verified).** PM "headings" are paragraphs with a styleId; their
font/color/size render as inline ProseMirror **Decorations** from the linked-styles plugin. The plugin reads
`editor.converter.linkedStyles` — the **ARRAY** (`{id,type,definition,attributes}`, `definition.styles` carries
kebab-CSS keys `font-family`/`color`/`font-size`) — NOT `translatedLinkedStyles`
([linked-styles/plugin.js:39,106,185-188](../../../src/renderer/core/superdoc-fork/extensions/linked-styles/plugin.js);
lookup `getLinkedStyle` [helpers.js:30-35](../../../src/renderer/core/superdoc-fork/extensions/linked-styles/helpers.js)).
The two structures are **independent snapshots** built side-by-side at import (`linkedStyles` via `getStyleDefinitions`
[docxImporter.js:313](../../../src/renderer/core/superdoc-fork/core/super-converter/v2/importer/docxImporter.js); `translatedLinkedStyles`
via `translateStyleDefinitions` [docxImporter.js:261]) and NEVER synced afterward. The plugin regenerates
decorations ONLY inside `apply` when `tr.docChanged` AND a step touches a styled paragraph (no `setMeta` refresh
hook exists; a no-op `dispatch(state.tr)` does nothing — plugin.js:54-114). The paginated visible DOM listens for
`stylesDefaultsChanged` and clears its flow-block cache + reschedules render
([PresentationEditor.ts:4784-4793](../../../src/renderer/core/superdoc-fork/core/presentation-editor/PresentationEditor.ts)),
but that rerender re-pulls the plugin's decoration set — inert unless the set actually changed.
**⇒ A faithful named-style redefinition MUST: (1) mutate `translatedLinkedStyles.styles[id]` + `syncStylesDiffToConvertedXml`
[export]; (2) mutate `linkedStyles[].definition.styles` in place, kebab-CSS keys [visual]; (3) force regen via a
`docChanged` transaction re-stamping each affected paragraph's attrs (`addToHistory:false`); (4) `emit('stylesDefaultsChanged')`
[paginated DOM].**

**F5 — `w:background` is genuinely net-new (verified).** Repo-wide grep `w:background` over the fork = ZERO matches.
Export seam: `translateDocumentNode` builds `{name:'w:document', elements:[translatedBodyNode]}`
([exporter.js:418-443](../../../src/renderer/core/superdoc-fork/core/super-converter/exporter.js)); `params.node` IS the
PM doc-node JSON (`params.node.attrs` readable — proven via `Editor.ts:3646` `tr.doc.toJSON()`). `w:background` must be
the FIRST child of `w:document` (before `w:body`). Import seam: `createDocumentJson` finds `w:body` then builds
`result.attrs:{attributes, bodySectPr?}` ([docxImporter.js:204-295](../../../src/renderer/core/superdoc-fork/core/super-converter/v2/importer/docxImporter.js));
`w:background` is a sibling in `json.elements[0].elements`. Doc schema: the `doc` node (`extensions/document/document.js`
`addAttributes()`, mirrors the `bodySectPr` attr) must declare a `background` attr (`rendered:false`) or `nodeFromJSON`
silently drops it. Word only RENDERS the bg if `word/settings.xml` has `<w:displayBackgroundShape/>` (separate settings write).

**F6 — pageBorders is real now (verified).** `editor.doc.sections.setPageBorders({target, borders})` /
`clearPageBorders({target})` write real `<w:pgBorders>` in `w:sectPr` and round-trip
([sections.types.ts:84-101,265-269](../../../src/renderer/core/superdoc-fork/_vendor/superdoc/document-api/src/sections/sections.types.ts);
adapter `writePageBorders` sections-xml.ts:529). `target = editor.doc.sections.list().items[i].address`
(`{kind:'section', sectionId:'section-0'}`). `validatePageBorders` requires ≥1 border field; each edge needs ≥1 of
`style/size/space/color/shadow/frame`. Visual frame render is Phase-7 (continuous flow).

**F7 — docDefaults run/paragraph is real now (verified).** `editor.doc.styles.apply({target:{scope:'docDefaults',
channel:'run'|'paragraph'}, patch})` writes `w:docDefaults/w:rPrDefault/w:rPr` (`fontFamily`→`w:rFonts`, `color`→`w:color`,
`fontSize`→`w:sz`) and `.../w:pPrDefault/w:pPr` (`spacing`→`w:spacing`); exports + round-trips
([registry.ts:56-94,421-424](../../../src/renderer/core/superdoc-fork/_vendor/superdoc/document-api/src/styles/registry.ts)).
Scope is docDefaults-ONLY (cannot restyle headings — that's F1/F4's job).

**F8 — Fork command seam (verified).** Commands are `(args) => (params) => boolean`; `params = {tr, editor, view,
state, dispatch, chain, can, commands}` ([CommandService.js:195-207](../../../src/renderer/core/superdoc-fork/core/CommandService.js)).
`editor.converter` IS reachable as `params.editor.converter` (precedent: `extensions/collaboration/collaboration.js:42`
mutates `editor.converter.bodySectPr` in place). Guard `if (!dispatch) return true` for `can()` probes. CommandService
dispatches the (possibly empty) `tr` after the fn returns truthy. `linked-styles.js` `addCommands()` is the natural home
(it owns the array + plugin key + helpers).

**F9 — Clone surface + leak vectors (verified, file:line in §4 tasks).** Legacy `WC.Design`
([design-tools.js](../../../src/renderer/public/js/design-tools.js), 159 lines, CSS-variable theming — `applyTheme`/
`applyColorScheme`/`applyFontPairing` set `--doc-*` vars that feed ONLY legacy `#editor`; `applyParagraphSpacing`
inline-styles every `p,li`; `applyStyleSet` toggles a className; `pageColor` sets `.node` bg; `pageBorders` injects a
`.wc-page-border` div; `watermark` sets a bg-image SVG; `setAsDefault` is a toast no-op). Dispatch handlers
[commands.js:334,337,543-646](../../../src/renderer/public/js/commands.js) (Design block + `livePreviewCell` 598-603 +
`applyColor('page')` 1713-1737, already `notifyBlocked` in PM). `PMA()` = `WC.PM && active && ready ? WC.PM : null`
(commands.js:11). Leak vectors calling `WC.Design.*` directly: gallery `apply` callbacks (544/546/547/548/562),
`livePreviewCell` snapshot/restore (600/601), watermark gallery cell (637), remove-watermark (644), `setAsDefault` (592),
`D.watermark` ([dialogs.js:1180](../../../src/renderer/public/js/dialogs.js)), `D.pageBorders` (1198/1199). `effects` is
self-contained (`applyShapeEffect` boxShadow on `E().node` images, commands.js:586-591 — no `WC.Design`).

**F10 — Bridge wiring (verified).** `FLIPPED` set (index.ts:43, `'themes'` ABSENT); AREA map already routes all 11 cmds
→ `'themes'` (index.ts:122-125); `isBlocked`/`isFlipped` (index.ts:138-139); `preinstallBridge` stubs (index.ts:256-352);
`installBridge` `Object.assign(PM, …, installReferences(editor), installMailMerge(editor))` (index.ts:386), `legacyBoot`
early-return at index.ts:362 keeps the bridge passive under `--legacy`.

**F11 — PM test harness (verified).** `t(name, fn)` — passes iff `fn` returns NEITHER `false` NOR a string (every
`return '...'` is a failure-with-detail) ([test-suite-pm.js:6-11](../../../scripts/test-suite-pm.js)). Export helpers:
`exportDocumentXml()` → `word/document.xml` string (`editor.exportDocx({exportXmlOnly:true})`, ~:1547); `exportParts()`
→ part map incl. `word/styles.xml` (`exportDocx({getUpdatedDocs:true})`, ~:2866); `window.WC.editor.converter.convertedXml['word/styles.xml']`
→ live element tree; round-trip `PM().exportDocxBytes()` → `PM().openDocx(bytes)` (doc-replacing — put LAST, `await sleep(300)`).
No JSZip in renderer. Template: `[10mm]` block (~:3890). `setDoc`/`setDocs`/`selectText`/`caretAfter`/`applyStyleByName`/`flyClick`/`cellFor` helpers exist.

**F12 — PM rendering CSS (verified).** PM headings carry NO CSS-class/variable styling (`--doc-*` feed only legacy
`#editor` — [editor.css:119-129](../../../src/renderer/public/styles/editor.css)); they paint from F4's inline
decorations. PM page background: `body.pm-active #pm-editor { background: var(--page) }` (editor.css:415, `--page:#FFFFFF`
[base.css:29](../../../src/renderer/public/styles/base.css)); canvas behind = `--canvas:#E6E6E6`. ⇒ pageColor visual =
override `#pm-editor` background (or `--page`); heading/body visual = F4 decoration path only.

---

## §1. Scope decisions (D10t.x)

- **D10t.1 — themes/styleSet/colors/fonts = REAL named-style redefinition** (F1/F3/F4). One net-new fork command
  `redefineNamedStyles` does the full F4 four-step (export + visual + regen + emit). Targets `Title, Heading1, Heading2,
  Heading3, Subtitle, Normal`. Exports `<w:style><w:rPr>` font+color and repaints the PM view.
- **D10t.2 — fonts/colors also touch docDefaults** (F7, belt-and-suspenders for non-Normal body text export):
  `fonts` sets docDefaults run `fontFamily`; `colors` does NOT touch docDefaults (heading/accent colors via named styles).
- **D10t.3 — paragraphSpacing = docDefaults paragraph spacing** (F7, real export) **+ Normal style spacing** (F4 visual).
- **D10t.4 — pageColor/pageColor2 = REAL `w:background`** (F5 net-new) + live `#pm-editor` bg paint (F12) + `<w:displayBackgroundShape/>` settings flag.
- **D10t.5 — pageBorders = REAL `w:pgBorders`** via `editor.doc.sections.setPageBorders` (F6). Visual frame Phase-7 (ledger A).
- **D10t.6 — watermark = visual stand-in + honest toast** (user-chosen). Paint the legacy diagonal SVG on `#pm-editor`
  (NOT legacy `E()`), toast "preview only — renders in the saved file at Phase 7". No `w:pict` (real header watermark = Phase 7, ledger A).
- **D10t.7 — effects = clone-owned presentational** boxShadow on PM images/shapes (no OOXML, no fork model). Re-pointed
  so it never touches legacy `E().dirty` in PM.
- **D10t.8 — setAsDefault = clone-owned toast no-op** (app preference; no doc mutation; no fork model). Recorded deferral.
- **D10t.9 — hover live-preview = REAL (user-chosen).** The Design galleries live-preview on hover by driving the SAME
  named-style redefinition VISUAL path with `{export:false}` (F4 steps 2+3+4 only — no styles.xml mutation). The bridge
  snapshots the affected styles' current values when the gallery opens and restores them on `mouseleave`; `click` commits
  with `{export:true}`. (Supersedes the report's CSS-variable preview idea, which F4/F12 disproved.)

---

## §2. Risks + binding amendments (K-x)

- **K1 — decoration regen cost on hover.** Re-stamping styled paragraphs (F4 step 3) on every `mouseenter`/`mouseleave`
  across a 9-cell gallery could lag. **Amendment:** restamp txn is `addToHistory:false`; only paragraphs whose styleId ∈
  the redefined set are touched; debounce is available. **Fallback (recorded honestly if janky in-build):** click-only
  apply per the ledger-C styles precedent — the slice still ships. VERIFY in the built app (Task 6).
- **K2 — body-font visual for styleId-LESS paragraphs.** Most body paragraphs have `styleId:null` (inherit Normal), so
  redefining `Normal` in the array repaints only EXPLICITLY-Normal paragraphs; styleId-less paragraphs' live font is
  best-effort. **Amendment:** EXPORT is correct regardless (docDefaults D10t.2 + Normal redefinition). Heading restyle
  (explicit styleIds) is the guaranteed visual. Body-font live render = ledger-A honest degrade; verify the actual PM
  plain-text font source in-build and improve if cheap.
- **K3 — theme apply is NOT on the PM undo stack; dirty flips via `PM.markDirty`.** The converter mutation
  (linkedStyles/translatedLinkedStyles/convertedXml) is a side-effect, not a PM transaction; the restamp txn is
  `addToHistory:false`. ⇒ Ctrl+Z does not revert a committed theme (parity with the legacy engine). **Recorded ledger-C
  deviation.** **Dirty flag:** committing verbs call `PM.markDirty()` (Task 3 Step 2.5 — added to io.ts), because
  `editor.converter.documentModified` is the FORK's flag, NOT the app's `dirty` (which `PM.isDirty` reads, flipped by
  `editor.on('update')` on docChanged). A theme/color on a heading-less doc, and docDefaults/`w:pgBorders`, mutate
  styles.xml WITHOUT a docChanged tr, so `PM.markDirty()` is required or the Save prompt would not fire (silent data
  loss). **watermark/effects/setAsDefault are intentionally NON-dirtying** (presentational, not exported — nothing savable
  changed). A `[10th]` test pins `deApplyTheme` on a heading-less doc → `PM().isDirty() === true`.
- **K9 — named-style redefinition MUST delete the theme bindings (else a silent false-green).** The default Heading/Title
  styles bind font/color to the theme (`runProperties.fontFamily.asciiTheme`, `color.themeColor`). Word resolves the theme
  IN PREFERENCE to a literal, so adding `w:ascii`/`w:color@val` while keeping `w:asciiTheme`/`w:themeColor` makes Word
  IGNORE the literal — yet a grep-only test passes green. **Amendment:** Task 1's EXPORT branch DELETES `asciiTheme/
  hAnsiTheme/eastAsiaTheme/cstheme` and `themeColor/themeTint/themeShade` whenever a literal is set; a `[10th]` test
  asserts the resaved `Heading1` contains the literal AND does NOT contain `w:asciiTheme`/`w:themeColor` (the oracle Leg A
  Word-honors check). Caught by the design-holes critic.
- **K10 — the in-memory style shape is FLAT (verified).** `translatedLinkedStyles.styles[id].runProperties.fontFamily.ascii`
  / `.color.val` / `.fontSize` (half-points) are flat keys (NOT nested under `.attributes`) — confirmed against the
  rFonts/color/sz translators + the docDefaults path. The visual array uses kebab `definition.styles['font-family']`/
  `['color']`. Task 1 sets exactly these; the TDD export test is the backstop if a translator differs.
- **K4 — `w:displayBackgroundShape` settings seam.** Needed for Word to RENDER the page color on open. The exporter passes
  `word/settings.xml` through from `convertedXml`. **Amendment:** a NOTICE'd fork helper `ensureDisplayBackgroundShape(converter, on)`
  mutates `convertedXml['word/settings.xml']` (add/remove the element); the bridge calls it on pageColor set/clear. If the
  settings part is absent, create a minimal one (model: the importer's `importViewSettingFromSettings`). The `w:background`
  color export + round-trip is independent of this and is the deterministic test target; `displayBackgroundShape` is verified
  via the oracle (Word resave/open shows the color).
- **K5 — named-style redefinition is global, not theme-token.** We write literal `w:ascii`/`w:color@val` into `<w:style>`
  (valid real OOXML, opens identically in Word). Word's own themes use `theme1.xml` token indirection. **Recorded deeper-fidelity
  follow-up** (deferrals C); NOT in this PR's locked scope.
- **K6 — `editor.doc` freshness.** `editor.doc` is a cached DocumentApi reset on Open/New/destroy. **Amendment:** `bridge/design.ts`
  reads `editor.doc`/`editor.converter` FRESH each call (the references.ts/K2 discipline); never hoist.
- **K7 — legacy byte-identity.** `WC.Design` stays loaded; only its mutation CALL SITES re-point via `PMA()` (legacy ELSE
  byte-identical). The frozen 257 legacy gate + the leak audit (Task 5) enforce this. No D6-guard repoint (themes ≠ margins/header).
- **K8 — `w:background` schema attr default.** A `doc` node WITHOUT the new `background` attr declared would lose
  `result.attrs.background` on `nodeFromJSON`. **Amendment:** declare `background:{rendered:false, default:null}` (Task 2) and
  add a PM round-trip test (Task 0) so a regression is caught.

---

## §3. File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/test-suite-pm.js` | Modify (append `[10th]` block before the LAST doc-replacing tests) | Red→green engine-observable tests: redefined Heading1/Title export `w:rPr` font+color + repaint; `w:background` round-trip; `w:pgBorders`; docDefaults; FLIP; leak. |
| `src/renderer/core/superdoc-fork/extensions/linked-styles/linked-styles.js` | Modify (NOTICE'd) | Net-new `redefineNamedStyles(updates, opts)` command (F4 four-step). |
| `src/renderer/core/superdoc-fork/extensions/document/document.js` | Modify (NOTICE'd) | Declare the `background` doc-node attr. |
| `src/renderer/core/superdoc-fork/core/super-converter/exporter.js` | Modify (NOTICE'd) | Inject `<w:background>` first child of `w:document` from `params.node.attrs.background`. |
| `src/renderer/core/superdoc-fork/core/super-converter/v2/importer/docxImporter.js` | Modify (NOTICE'd) | Read the `w:background` sibling into `result.attrs.background`. |
| `src/renderer/core/superdoc-fork/core/super-converter/v2/importer/settings-background.js` | Create (NOTICE'd) | `ensureDisplayBackgroundShape(converter, on)` settings-part helper (K4). |
| `src/renderer/core/superdoc-fork/NOTICE.md` | Modify | Record the 5 fork edits above. |
| `src/renderer/bridge/design.ts` | Create | `installDesign(editor)` — all `de*` verbs + hover-preview snapshot/restore + theme→named-style mapping tables. |
| `src/renderer/bridge/index.ts` | Modify | Import `installDesign`; add `de*` + `markDirty` pre-mount stubs; append `installDesign(editor)` to `Object.assign`; add `'themes'` to `FLIPPED` (THE FLIP). |
| `src/renderer/bridge/io.ts` | Modify | Add `markDirty()` (flips the app `dirty` flag) so styles-only design commits prompt to Save (K3). |
| `src/renderer/public/js/commands.js` | Modify | Re-point the Design `H.*` handlers + `livePreviewCell` + watermark gallery + `applyColor('page')` via `PMA()` (legacy ELSE byte-identical). |
| `src/renderer/public/js/dialogs.js` | Modify | Re-point `D.watermark` + `D.pageBorders` OK/Remove via `PMA()`. |
| `docs/plan/last-point.md`, `docs/plan/execution-map.md`, `docs/plan/deferrals.md` | Modify (Task 6) | Checkpoint via plan-tracking skill. |

**Theme→named-style mapping (data, lives in `bridge/design.ts`):** the legacy `WC.Design.THEMES/COLOR_SCHEMES/FONT_PAIRS/SPACING/STYLE_SETS`
tables stay the clone-owned source of values (read off `WC.Design.*`). `bridge/design.ts` translates a chosen theme/scheme/pairing/spacing
into a `redefineNamedStyles` `updates` array (heading font = `theme.heading`'s first family; heading color = `theme.color`; body =
`theme.body`; accent → heading colors) + a docDefaults patch. Keep the family-name extraction identical to legacy `firstFont()`
(first comma-split token, quotes stripped).

---

## §4. Tasks

### Task 0: Red `[10th]` tests (engine-observable, written FIRST)

**Files:**
- Modify: `scripts/test-suite-pm.js` (insert the `[10th]` block immediately BEFORE the final results
  `const pass = results.filter((r) => r.pass).length;` line, ~:3975 — doc-replacing tests LAST within the block)

- [ ] **Step 1: Write the failing `[10th]` block**

Insert this block (uses the existing harness helpers `setDoc`/`setDocs`/`selectText`/`caretAfter`/`PM`/
`exportDocumentXml`/`exportParts`/`paraEl`, and `PM().applyStyleByName` from slice 3):

```js
  // ===== [10th] themes / Design tab (slice 10 PR2) — doc-replacing tests LAST =====
  await t('[10th] D6 flip: themes is FLIPPED', () => PM().isFlipped('themes') === true || 'themes not in FLIPPED');

  await t('[10th] EXPORT: deApplyTheme redefines Heading1 with literal w:rFonts ascii + w:color val in styles.xml', async () => {
    setDocs(['Heading One', 'body text']);
    selectText('Heading One'); PM().applyStyleByName('Heading 1'); await sleep(40);
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red — bridge not installed)';
    const theme = { name: 'TestTheme', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#FF0000', accents: ['#FF0000', '#00AA00', '#0000FF', '#FFAA00', '#AA00FF', '#00AAFF'] };
    if (PM().deApplyTheme(theme) !== true) return 'deApplyTheme refused (red)';
    await sleep(80);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'];
    if (typeof sx !== 'string') return 'no word/styles.xml in export part map';
    const m = sx.match(/<w:style\b[^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/);
    if (!m) return 'no Heading1 <w:style> in styles.xml';
    const h1 = m[0];
    if (!/<w:rFonts\b[^>]*w:ascii="Georgia"/.test(h1)) return 'Heading1 w:rFonts ascii not Georgia: ' + h1.slice(0, 400);
    if (!/<w:color\b[^>]*w:val="FF0000"/.test(h1)) return 'Heading1 w:color val not FF0000: ' + h1.slice(0, 400);
    // K9: the theme bindings MUST be gone, or Word resolves the theme and IGNORES the literal.
    if (/w:asciiTheme/.test(h1)) return 'Heading1 still binds w:asciiTheme — Word would ignore the literal font (K9)';
    return !/w:themeColor/.test(h1) || 'Heading1 still binds w:themeColor — Word would ignore the literal color (K9)';
  });

  await t('[10th] deApplyTheme flips the app dirty flag even on a heading-less doc (K3 Save-prompt)', () => {
    setDoc('plain body, no headings'); PM().setClean && PM().setClean();
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red)';
    if (PM().deApplyTheme({ name: 'D', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#222222', accents: ['#222222', '#1', '#2', '#3', '#4', '#5'] }) !== true) return 'refused';
    return PM().isDirty() === true || 'doc not dirty after a styles-only theme apply (no Save prompt — data loss)';
  });

  await t('[10th] pageColor does NOT wipe an active watermark (CSS longhand, no shorthand collision)', () => {
    setDoc('x');
    if (typeof PM().deWatermark !== 'function' || typeof PM().dePageColor !== 'function') return 'design verbs missing (red)';
    PM().deWatermark('DRAFT', {}); PM().dePageColor('#FFFF00');
    const ed = document.getElementById('pm-editor');
    if (!/data:image\/svg/.test(ed.style.backgroundImage || '')) return 'pageColor wiped the watermark backgroundImage (used the background shorthand)';
    return /ffff00|255,\s*255,\s*0/i.test((ed.style.backgroundColor || '')) || 'pageColor did not set backgroundColor';
  });

  await t('[10th] deApplyTheme repaints the VISUAL source (linkedStyles array Heading1 definition.styles)', async () => {
    setDocs(['Heading One', 'body']); selectText('Heading One'); PM().applyStyleByName('Heading 1'); await sleep(40);
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red)';
    const theme = { name: 'T', heading: 'Georgia,serif', body: 'Georgia,serif', color: '#123456', accents: ['#123456', '#111', '#222', '#333', '#444', '#555'] };
    if (PM().deApplyTheme(theme) !== true) return 'refused (red)';
    await sleep(60);
    const arr = window.WC.editor.converter?.linkedStyles || [];
    const h1 = arr.find((s) => s.id === 'Heading1');
    if (!h1) return 'no Heading1 in converter.linkedStyles array';
    const fam = String(h1.definition?.styles?.['font-family'] || '');
    if (!/Georgia/.test(fam)) return 'array font-family not Georgia (visual source stale): ' + fam;
    return /123456/i.test(String(h1.definition?.styles?.['color'] || '')) || 'array color not #123456: ' + h1.definition?.styles?.['color'];
  });

  await t('[10th] EXPORT: deApplyFonts sets docDefaults w:rFonts (body font, real export)', async () => {
    setDoc('body text');
    if (typeof PM().deApplyFonts !== 'function') return 'PM.deApplyFonts missing (red)';
    if (PM().deApplyFonts({ name: 'Verdana', heading: 'Verdana,sans-serif', body: 'Verdana,sans-serif' }) !== true) return 'refused (red)';
    await sleep(60);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'] || '';
    const dd = (sx.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];
    return /<w:rFonts\b[^>]*w:ascii="Verdana"/.test(dd) || 'no docDefaults w:rFonts ascii=Verdana: ' + dd.slice(0, 400);
  });

  await t('[10th] EXPORT: deParagraphSpacing → docDefaults w:spacing (real export)', async () => {
    setDoc('body text');
    if (typeof PM().deParagraphSpacing !== 'function') return 'PM.deParagraphSpacing missing (red)';
    if (PM().deParagraphSpacing({ before: 0, after: 13, line: 2 }) !== true) return 'refused (red)';
    await sleep(60);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'] || '';
    const dd = (sx.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];
    // Pin the SPECIFIC value (13pt -> 260 twips), not just <w:spacing> presence — docDefaults
    // already carries default line spacing, so a presence-only check would pass vacuously.
    return /<w:spacing\b[^>]*w:after="260"/.test(dd) || 'no docDefaults <w:spacing w:after="260"> (13pt->260twips): ' + dd.slice(0, 400);
  });

  await t('[10th] EXPORT: dePageBorders → <w:pgBorders> in document.xml sectPr (real)', async () => {
    setDoc('x');
    if (typeof PM().dePageBorders !== 'function') return 'PM.dePageBorders missing (red)';
    if (PM().dePageBorders({ style: 'solid', color: '#000000', width: 1 }) !== true) return 'dePageBorders refused (red)';
    await sleep(60);
    const xml = await exportDocumentXml();
    return /<w:pgBorders\b/.test(xml) || 'no <w:pgBorders> in document.xml';
  });

  await t('[10th] EXPORT: dePageColor → <w:background w:color> in document.xml (real)', async () => {
    setDoc('x');
    if (typeof PM().dePageColor !== 'function') return 'PM.dePageColor missing (red)';
    if (PM().dePageColor('#FFFF00') !== true) return 'dePageColor refused (red)';
    await sleep(60);
    const xml = await exportDocumentXml();
    return /<w:background\b[^>]*w:color="FFFF00"/.test(xml) || 'no <w:background w:color=FFFF00>: ' + xml.slice(0, 200);
  });

  await t('[10th] dePageColor paints the live page sheet (#pm-editor background)', () => {
    if (typeof PM().dePageColor !== 'function') return 'PM.dePageColor missing (red)';
    if (PM().dePageColor('#ABCDEF') !== true) return 'refused';
    const ed = document.getElementById('pm-editor');
    // Read backgroundColor ONLY (the longhand contract) — reading the `background` shorthand
    // would mask a buggy impl that wrote the shorthand and wiped a watermark (collision test).
    const bg = (ed.style.backgroundColor || '').toLowerCase();
    return /abcdef|171,\s*205,\s*239/.test(bg) || 'page sheet bg not set: ' + bg;
  });

  await t('[10th] watermark: PM paints an SVG bg on #pm-editor (visual stand-in), never touches legacy E()', () => {
    if (typeof PM().deWatermark !== 'function') return 'PM.deWatermark missing (red)';
    if (PM().deWatermark('DRAFT', {}) !== true) return 'deWatermark refused (red)';
    const ed = document.getElementById('pm-editor');
    return /data:image\/svg/.test(ed.style.backgroundImage || '') || 'no watermark SVG bg-image on #pm-editor';
  });

  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10th] IMPORT round-trip: w:background survives export→openDocx (K8 schema-attr pin)', async () => {
    setDoc('x');
    if (typeof PM().dePageColor !== 'function') return 'PM.dePageColor missing (red)';
    if (PM().dePageColor('#00FF00') !== true) return 'dePageColor refused (red)';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'export not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport (openDocx) failed';
    await sleep(300);
    const xml = await exportDocumentXml();
    return /<w:background\b[^>]*w:color="00FF00"/.test(xml) || 'w:background lost on round-trip (schema attr dropped it)';
  });

  await t('[10th] IMPORT round-trip: redefined Heading1 styles.xml survives export→openDocx', async () => {
    setDocs(['Heading One', 'body']); selectText('Heading One'); PM().applyStyleByName('Heading 1'); await sleep(40);
    if (typeof PM().deApplyTheme !== 'function') return 'PM.deApplyTheme missing (red)';
    if (PM().deApplyTheme({ name: 'RT', heading: 'Garamond,serif', body: 'Garamond,serif', color: '#654321', accents: ['#654321', '#1', '#2', '#3', '#4', '#5'] }) !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    const parts = await exportParts();
    const sx = parts['word/styles.xml'] || '';
    const m = sx.match(/<w:style\b[^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/);
    if (!m) return 'no Heading1 style after round-trip';
    return /<w:rFonts\b[^>]*w:ascii="Garamond"/.test(m[0]) || 'Heading1 ascii not Garamond after round-trip';
  });
```

- [ ] **Step 2: Run the suite; verify the `[10th]` tests FAIL (red)**

Run: `npm run build && npm run test:pm`
Expected: the new `[10th]` tests FAIL — `themes not in FLIPPED`, `PM.deApplyTheme missing (red — bridge not installed)`,
`PM.dePageColor missing`, etc. All PRIOR tests (285) stay green.

- [ ] **Step 3: Commit the red tests**

```bash
git add scripts/test-suite-pm.js
git commit -m "test(design): slice-10 themes red [10th] tests (named-style redefinition export+visual, w:background round-trip, w:pgBorders, docDefaults, FLIP, watermark/pageColor visual)"
```

---

### Task 1: Fork — net-new `redefineNamedStyles` command (export + visual + regen + emit)

**Files:**
- Modify: `src/renderer/core/superdoc-fork/extensions/linked-styles/linked-styles.js` (add to `addCommands()`; add imports)
- Modify: `src/renderer/core/superdoc-fork/NOTICE.md`

This is the F4 four-step. `updates` = `Array<{ styleId, run?: { fontFamily?, color?, fontSize? }, paragraph?: { spacing? } }>`.
`opts.export !== false` ⇒ commit (mutate export structure + styles.xml). Always mutates the visual array + forces regen + emits.

- [ ] **Step 1: Confirm the red test that drives this** — `[10th] EXPORT: deApplyTheme …` and `[10th] deApplyTheme repaints the VISUAL source …`
  (both currently fail at `PM.deApplyTheme missing`; this task is the engine half they exercise once the bridge calls it in Task 3).

- [ ] **Step 2: Add the imports at the top of `linked-styles.js`**

Add (the file already imports from `./helpers`; add the styles-xml sync helper):

```js
import { syncStylesDiffToConvertedXml } from '../../core/helpers/styles-xml-helpers';
```

- [ ] **Step 3: Add the `redefineNamedStyles` command inside `addCommands()`**

Add this entry to the object returned by `addCommands()` (alongside `setLinkedStyle`/`setStyleById`):

```js
      /**
       * NET-NEW (slice 10 themes, NOTICE'd). Redefine named-style DEFINITIONS
       * (e.g. Heading1/Title/Normal) so they restyle like real Word. Mutates BOTH
       * the export structure (translatedLinkedStyles.styles + word/styles.xml) AND
       * the visual structure (converter.linkedStyles[].definition.styles — the array
       * the decoration plugin reads), then forces a decoration regenerate (re-stamp
       * affected paragraphs, addToHistory:false) + emits stylesDefaultsChanged for the
       * paginated DOM. See plan §0 F1-F4.
       *
       * @param {Array<{styleId:string, run?:{fontFamily?:string,color?:string,fontSize?:number}, paragraph?:{spacing?:object}}>} updates
       * @param {{export?:boolean}} [opts]  export:false = visual-only (hover preview)
       */
      redefineNamedStyles:
        (updates, opts = {}) =>
        ({ editor, tr, dispatch }) => {
          // Mutate the PROVIDED params.tr (CommandService dispatches it ONCE after we return
          // true) — do NOT create a separate editor.state.tr (that double-dispatches). Plan §0 F8.
          const converter = editor && editor.converter;
          if (!converter || !Array.isArray(updates) || !updates.length) return false;
          const arr = converter.linkedStyles;
          if (!Array.isArray(arr)) return false;
          const translated = converter.translatedLinkedStyles && converter.translatedLinkedStyles.styles;
          const doExport = opts.export !== false;
          const hex = (c) => '#' + String(c).replace(/^#/, '').toUpperCase();
          const bare = (c) => String(c).replace(/^#/, '').toUpperCase();

          // Read-only pass: which styleIds actually exist (drives true/false + the can() probe).
          const exists = updates.map((u) => u && u.styleId).filter((id) => id && arr.some((s) => s.id === id));
          if (!exists.length) return false;
          if (!dispatch) return true; // can() probe — no side effects past this point

          const touched = new Set();
          const modifiedStyles = {};
          for (const u of updates) {
            const id = u && u.styleId;
            if (!id) continue;

            // (1) VISUAL — mutate the array's definition.styles IN PLACE (kebab CSS keys).
            const entry = arr.find((s) => s.id === id);
            if (entry) {
              entry.definition = entry.definition || { styles: {}, attrs: {} };
              entry.definition.styles = entry.definition.styles || {};
              const st = entry.definition.styles;
              if (u.run && u.run.fontFamily != null) st['font-family'] = u.run.fontFamily;
              if (u.run && u.run.color != null) st['color'] = hex(u.run.color);
              if (u.run && u.run.fontSize != null) st['font-size'] = u.run.fontSize + 'pt';
              if (u.paragraph && u.paragraph.spacing) st['spacing'] = { ...(st['spacing'] || {}), ...u.paragraph.spacing };
              touched.add(id);
            }

            // (2) EXPORT — mutate translatedLinkedStyles.styles[id]. CRITICAL (plan §2 K9): when
            // setting a LITERAL font/color, DELETE the competing theme bindings (asciiTheme/
            // themeColor) — the default Heading/Title styles bind to the theme, and Word resolves
            // the theme IN PREFERENCE to the literal, so without deleting them Word IGNORES the
            // new font/color even though styles.xml contains it (a silent false-green).
            if (doExport && translated && translated[id]) {
              const def = translated[id];
              if (u.run && u.run.fontFamily != null) {
                const f = u.run.fontFamily;
                def.runProperties = def.runProperties || {};
                def.runProperties.fontFamily = { ...(def.runProperties.fontFamily || {}), ascii: f, hAnsi: f };
                delete def.runProperties.fontFamily.asciiTheme;
                delete def.runProperties.fontFamily.hAnsiTheme;
                delete def.runProperties.fontFamily.eastAsiaTheme;
                delete def.runProperties.fontFamily.cstheme;
              }
              if (u.run && u.run.color != null) {
                def.runProperties = def.runProperties || {};
                def.runProperties.color = { ...(def.runProperties.color || {}), val: bare(u.run.color) };
                delete def.runProperties.color.themeColor;
                delete def.runProperties.color.themeTint;
                delete def.runProperties.color.themeShade;
              }
              if (u.run && u.run.fontSize != null) {
                def.runProperties = def.runProperties || {};
                def.runProperties.fontSize = Math.round(u.run.fontSize * 2); // pt → half-points
              }
              if (u.paragraph && u.paragraph.spacing) {
                def.paragraphProperties = def.paragraphProperties || {};
                def.paragraphProperties.spacing = { ...(def.paragraphProperties.spacing || {}), ...u.paragraph.spacing };
              }
              // syncStylesDiffToConvertedXml consumes only the styleId KEY (re-decodes the whole
              // node from translated[id]); a bare entry is sufficient (styles-xml-helpers.ts:160-194).
              modifiedStyles[id] = { added: {}, deleted: {}, modified: {} };
            }
          }

          if (!touched.size) return false;

          // (3a) EXPORT sync to word/styles.xml (re-decodes from the mutated translated[id]).
          if (doExport && Object.keys(modifiedStyles).length) {
            syncStylesDiffToConvertedXml(converter, { docDefaultsDiff: null, latentStylesDiff: null, addedStyles: {}, removedStyles: {}, modifiedStyles });
            converter.documentModified = true;
            if (typeof converter.promoteToGuid === 'function') converter.promoteToGuid();
          }

          // (3b) FORCE decoration regen on params.tr: re-stamp paragraphs whose styleId ∈ touched.
          // setNodeMarkup emits a ReplaceAroundStep that trips the linked-styles plugin's
          // mightAffectStyles gate even with identical attrs (verified). addToHistory:false so a
          // theme apply never pollutes the PM undo stack (plan §2 K3).
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'paragraph') return;
            const sid = node.attrs && node.attrs.paragraphProperties && node.attrs.paragraphProperties.styleId;
            if (sid && touched.has(sid)) tr.setNodeMarkup(pos, undefined, { ...node.attrs });
          });
          tr.setMeta('addToHistory', false);

          // (3c) Paginated DOM refresh (clears the flow-block cache + reschedules render).
          if (typeof editor.emit === 'function') editor.emit('stylesDefaultsChanged');
          return true;
        },
```

- [ ] **Step 4: Record the fork edit in NOTICE.md**

Append under the slice-10 section:

```markdown
- `extensions/linked-styles/linked-styles.js` — NET-NEW `redefineNamedStyles(updates, {export})` command
  (slice 10 PR2 themes): redefines named-style definitions (Heading1/Title/Normal …) for real Word fidelity.
  Mutates BOTH the export structure (`translatedLinkedStyles.styles` + `syncStylesDiffToConvertedXml`) and the
  visual structure (`converter.linkedStyles[].definition.styles`), then forces a linked-styles decoration regen
  (re-stamp styled paragraphs, addToHistory:false) and emits `stylesDefaultsChanged`. `{export:false}` = visual-only
  (hover preview). Imports `syncStylesDiffToConvertedXml` from `core/helpers/styles-xml-helpers`.
```

- [ ] **Step 5: Build (the command is exercised once the bridge calls it in Task 3 — no standalone test yet)**

Run: `npm run build`
Expected: builds clean (no type/syntax errors).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/core/superdoc-fork/extensions/linked-styles/linked-styles.js src/renderer/core/superdoc-fork/NOTICE.md
git commit -m "feat(fork): net-new redefineNamedStyles command for real Word theme fidelity

Redefines named-style definitions (Heading1/Title/Normal) so themes restyle headings
like real Word. Mutates the export structure (translatedLinkedStyles.styles + styles.xml
via syncStylesDiffToConvertedXml) AND the visual structure (converter.linkedStyles array
definition.styles — the source the decoration plugin reads), then forces a decoration
regen (re-stamp styled paragraphs, addToHistory:false) + emits stylesDefaultsChanged.
{export:false} drives the hover live-preview. NOTICE'd."
```

---

### Task 2: Fork — net-new `w:background` (page color) exporter + importer + doc-schema attr + settings flag

**Files:**
- Modify: `src/renderer/core/superdoc-fork/extensions/document/document.js` (declare the `background` doc attr)
- Modify: `src/renderer/core/superdoc-fork/core/super-converter/exporter.js` (inject `<w:background>`)
- Modify: `src/renderer/core/superdoc-fork/core/super-converter/v2/importer/docxImporter.js` (read `<w:background>`)
- Create: `src/renderer/core/superdoc-fork/core/super-converter/v2/importer/settings-background.js` (`ensureDisplayBackgroundShape`)
- Modify: `src/renderer/core/superdoc-fork/NOTICE.md`

Drives the red tests `[10th] EXPORT: dePageColor → <w:background …>` and `[10th] IMPORT round-trip: w:background survives …` (K8).

- [ ] **Step 1: Declare the `background` doc-node attr**

In `extensions/document/document.js`, inside the `addAttributes()` return, after the `bodySectPr` block:

```js
      background: {
        rendered: false,
        default: null,
        // NET-NEW (slice 10 themes, NOTICE'd). Document page color — the raw
        // <w:background> element JSON (child of <w:document>, sibling-before <w:body>).
        // null = no page color. rendered:false keeps it out of the DOM (export-only,
        // like bodySectPr). Without this declaration nodeFromJSON drops result.attrs.background.
      },
```

- [ ] **Step 2: Inject `<w:background>` on export**

In `core/super-converter/exporter.js`, in `translateDocumentNode`, replace the `w:document` node construction
(the `const node = { name: 'w:document', elements: [translatedBodyNode], attributes };` block) with:

```js
  // NET-NEW (slice 10 themes, NOTICE'd): document page color. <w:background> must be
  // the FIRST child of <w:document> (before <w:body>) per OOXML ordering. The value is
  // the raw element JSON stashed on the doc node's `background` attr (round-trips via
  // the importer at docxImporter.js createDocumentJson). carbonCopy already imported.
  const docElements = [translatedBodyNode];
  const background = params.node && params.node.attrs && params.node.attrs.background;
  if (background) docElements.unshift(carbonCopy(background));

  const node = {
    name: 'w:document',
    elements: docElements,
    attributes,
  };
```

- [ ] **Step 3: Read `<w:background>` on import**

In `core/super-converter/v2/importer/docxImporter.js`, in `createDocumentJson`, after the `w:body` find
(`const bodyNode = json.elements[0].elements.find((el) => el.name === 'w:body');`) add:

```js
  // NET-NEW (slice 10 themes, NOTICE'd): document page color — the <w:background>
  // sibling of <w:body> under <w:document>. Stashed on the doc node attrs so it
  // round-trips to the exporter (parallel to the bodySectPr passthrough).
  const backgroundNode = json.elements[0].elements?.find((el) => el.name === 'w:background') ?? null;
```

Then extend the `result.attrs` object literal (currently `{ attributes: …, ...(bodySectPr ? { bodySectPr } : {}) }`) to:

```js
    attrs: {
      attributes: json.elements[0].attributes,
      // Attach body-level sectPr if it exists
      ...(bodySectPr ? { bodySectPr } : {}),
      // NET-NEW (slice 10 themes): document page color
      ...(backgroundNode ? { background: backgroundNode } : {}),
    },
```

- [ ] **Step 4: Create the `ensureDisplayBackgroundShape` settings helper (K4)**

Create `core/super-converter/v2/importer/settings-background.js`:

```js
// NET-NEW (slice 10 themes, NOTICE'd). Word only RENDERS a document page color
// (<w:background>) when word/settings.xml contains <w:displayBackgroundShape/>.
// This helper add/removes that flag on the converter's settings part so a clone
// page color shows on Word open. The exporter passes word/settings.xml through from
// convertedXml, so mutating it here is sufficient. (No imports — builds plain object literals.)

const SETTINGS_PART = 'word/settings.xml';

function settingsRoot(converter) {
  const part = converter && converter.convertedXml && converter.convertedXml[SETTINGS_PART];
  if (part && part.elements) {
    const root = part.elements.find((el) => el.name === 'w:settings');
    if (root) {
      if (!root.elements) root.elements = [];
      return root;
    }
  }
  return null;
}

// Create a minimal settings part when none exists (rare — most docx ship one).
function ensureSettingsPart(converter) {
  let root = settingsRoot(converter);
  if (root) return root;
  if (!converter.convertedXml) return null;
  converter.convertedXml[SETTINGS_PART] = {
    declaration: { attributes: { version: '1.0', encoding: 'UTF-8', standalone: 'yes' } },
    elements: [
      {
        type: 'element',
        name: 'w:settings',
        attributes: { 'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main' },
        elements: [],
      },
    ],
  };
  return settingsRoot(converter);
}

export function ensureDisplayBackgroundShape(converter, on) {
  const root = on ? ensureSettingsPart(converter) : settingsRoot(converter);
  if (!root) return false;
  const idx = root.elements.findIndex((el) => el.name === 'w:displayBackgroundShape');
  if (on) {
    if (idx < 0) root.elements.unshift({ type: 'element', name: 'w:displayBackgroundShape' });
  } else if (idx >= 0) {
    root.elements.splice(idx, 1);
  }
  if (converter) converter.documentModified = true;
  return true;
}
```

> Note: `settings-background.js` needs NO imports — `ensureSettingsPart` builds plain object literals. (An earlier draft
> imported `carbonCopy` from `helpers.js`; that export does NOT exist there — the real `carbonCopy` lives at
> `@core/utilities/carbonCopy.js` — and it is unused here anyway, so the import is omitted.) `ensureDisplayBackgroundShape`
> is unused-but-harmless until the bridge calls it (Task 3, `dePageColor`, via a STATIC import).

- [ ] **Step 5: Record the fork edits in NOTICE.md**

```markdown
- `extensions/document/document.js` — NET-NEW `background` doc-node attr (slice 10 themes): raw <w:background>
  element JSON, rendered:false (export-only, mirrors bodySectPr).
- `core/super-converter/exporter.js` (`translateDocumentNode`) — NET-NEW: inject <w:background> as the first child
  of <w:document> from the doc node's `background` attr.
- `core/super-converter/v2/importer/docxImporter.js` (`createDocumentJson`) — NET-NEW: read the <w:background>
  sibling of <w:body> into result.attrs.background (round-trips with the exporter).
- `core/super-converter/v2/importer/settings-background.js` — NET-NEW `ensureDisplayBackgroundShape(converter,on)`:
  add/removes <w:displayBackgroundShape/> in word/settings.xml so Word renders the page color on open.
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/core/superdoc-fork/extensions/document/document.js src/renderer/core/superdoc-fork/core/super-converter/exporter.js src/renderer/core/superdoc-fork/core/super-converter/v2/importer/docxImporter.js src/renderer/core/superdoc-fork/core/super-converter/v2/importer/settings-background.js src/renderer/core/superdoc-fork/NOTICE.md
git commit -m "feat(fork): net-new w:background (document page color) exporter + importer + doc attr

Real Word page color: <w:background w:color> as the first child of <w:document>,
threaded via a new `background` doc-node attr (rendered:false, mirrors bodySectPr) so it
round-trips. Plus ensureDisplayBackgroundShape() to set <w:displayBackgroundShape/> in
settings.xml so Word renders it on open. NOTICE'd."
```

---

### Task 3: `bridge/design.ts` — the `installDesign(editor)` verb surface + hover preview

**Files:**
- Create: `src/renderer/bridge/design.ts`
- Modify: `src/renderer/bridge/index.ts` (import + stubs + `Object.assign` — NOT the FLIP yet)

Mirrors `bridge/references.ts` (fresh `editor`, `refocus()`). Reads the clone-owned legacy value tables off `WC.Design`
(THEMES/COLOR_SCHEMES/FONT_PAIRS/SPACING/STYLE_SETS stay the source of truth). Drives `redefineNamedStyles` (Task 1),
`editor.doc.styles.apply` (F7), `editor.doc.sections.setPageBorders` (F6), and the `w:background` doc attr (Task 2).

- [ ] **Step 1: Create `src/renderer/bridge/design.ts`**

```ts
// Slice 10 PR2: themes (Design tab) doc-mutation surface on the PM engine. The
// WC.Design ENGINE + its value tables (THEMES/COLOR_SCHEMES/FONT_PAIRS/SPACING/
// STYLE_SETS) stay clone-owned (spec §9.3 carve-out); only the document-mutation
// calls move here. Real fidelity: themes/styleSet/colors/fonts REDEFINE named-style
// definitions (editor.commands.redefineNamedStyles — exports to word/styles.xml AND
// repaints the PM view, plan §0 F1-F4); pageColor writes a real w:background doc attr
// (Task 2); pageBorders writes real w:pgBorders (editor.doc.sections, F6);
// paragraphSpacing writes real docDefaults (editor.doc.styles.apply, F7). watermark =
// visual stand-in + honest toast (Phase-7); effects/setAsDefault = clone-owned.
//
// editor.doc / editor.converter are read FRESH each call (K6 — cached, reset on Open/New).
import { ensureDisplayBackgroundShape } from '@core/super-converter/v2/importer/settings-background.js'

type AnyEditor = any

// The named styles a theme restyles. Heading2/3 derive from Heading1's font; Title is biggest.
const HEADING_STYLE_IDS = ['Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3']

// First family of a CSS font chain, quotes stripped (legacy firstFont parity, design-tools.js:150).
const firstFamily = (chain: string): string => String(chain || '').split(',')[0].replace(/['"]/g, '').trim()
const bareHex = (c: string): string => String(c || '').replace(/^#/, '').toUpperCase()

export function installDesign(editor: AnyEditor) {
  const w = window as any
  const refocus = () => editor.view?.focus()
  const toast = (m: string) => { try { w.WC?.toast?.(m) } catch { /* none */ } }
  // Flip the APP unsaved-changes flag (io.ts `dirty`), NOT converter.documentModified — the
  // Save prompt reads io.ts's `dirty` closure (PM.isDirty), flipped by editor.on('update') on a
  // docChanged tr. Theme/color on a HEADING-LESS doc, or docDefaults/pageBorders, mutate styles.xml
  // WITHOUT a docChanged tr, so we must flip the real flag explicitly (PM.markDirty, added to io.ts).
  const markDirty = () => { try { w.WC?.PM?.markDirty?.() } catch { /* none */ } }

  const converter = (): any => { try { return editor.converter } catch { return null } }
  const docApi = (): any => { try { return editor.doc } catch { return null } }

  // ---- core: redefine named styles (the F4 four-step lives in the fork command) ----
  // updates: Array<{ styleId, run?, paragraph? }>. doExport=false = hover preview (visual only).
  function redefine(updates: any[], doExport = true): boolean {
    if (!Array.isArray(updates) || !updates.length) return false
    try { return editor.commands.redefineNamedStyles(updates, { export: doExport }) === true } catch { return false }
  }

  // Build the named-style updates for a theme/font-pairing/color-scheme.
  // headingFont/bodyFont are CSS chains; color is a hex (heading text color); accents[] optional.
  function themeUpdates(headingChain: string | null, bodyChain: string | null, headingColor: string | null): any[] {
    const ups: any[] = []
    const hFam = headingChain ? firstFamily(headingChain) : null
    const bFam = bodyChain ? firstFamily(bodyChain) : null
    for (const id of HEADING_STYLE_IDS) {
      const run: any = {}
      if (hFam) run.fontFamily = hFam
      if (headingColor) run.color = headingColor
      if (Object.keys(run).length) ups.push({ styleId: id, run })
    }
    // Normal carries the body font (covers explicitly-Normal paragraphs; plan K2).
    if (bFam) ups.push({ styleId: 'Normal', run: { fontFamily: bFam } })
    return ups
  }

  // ---- docDefaults (F7) — body font / paragraph spacing (real export) ----
  function applyDocDefaultsRun(patch: any): boolean {
    const d = docApi(); if (!d) return false
    try { const r = d.styles.apply({ target: { scope: 'docDefaults', channel: 'run' }, patch }); return !!(r && r.success !== false) } catch { return false }
  }
  function applyDocDefaultsParagraph(patch: any): boolean {
    const d = docApi(); if (!d) return false
    try { const r = d.styles.apply({ target: { scope: 'docDefaults', channel: 'paragraph' }, patch }); return !!(r && r.success !== false) } catch { return false }
  }

  // ---- themes / colors / fonts / styleSet ----
  function deApplyTheme(theme: any): boolean {
    if (!theme || typeof theme !== 'object') return false
    const ok = redefine(themeUpdates(theme.heading, theme.body, theme.color), true)
    if (ok && theme.body) applyDocDefaultsRun({ fontFamily: { ascii: firstFamily(theme.body), hAnsi: firstFamily(theme.body) } })
    if (ok) { markDirty(); refocus(); toast('Theme "' + (theme.name || 'Office') + '" applied.') }
    return ok
  }
  function deApplyColors(scheme: any): boolean {
    if (!scheme || typeof scheme !== 'object') return false
    // Heading color = first accent (Word's Text/accent cascade); also re-map the picker theme row.
    const color = Array.isArray(scheme.accents) && scheme.accents[0] ? scheme.accents[0] : null
    if (!color) return false
    const ups = HEADING_STYLE_IDS.map((id) => ({ styleId: id, run: { color } }))
    const ok = redefine(ups, true)
    try { w.WC?.setThemeColors?.(scheme.accents) } catch { /* none */ }
    if (ok) { markDirty(); refocus(); toast('Colors: ' + (scheme.name || '')) }
    return ok
  }
  function deApplyFonts(pair: any): boolean {
    if (!pair || typeof pair !== 'object') return false
    const ok = redefine(themeUpdates(pair.heading, pair.body, null), true)
    if (pair.body) applyDocDefaultsRun({ fontFamily: { ascii: firstFamily(pair.body), hAnsi: firstFamily(pair.body) } })
    if (ok) { markDirty(); refocus(); toast('Fonts: ' + (pair.name || '')) }
    return ok
  }
  function deApplyStyleSet(name: string): boolean {
    // Style sets are font+spacing presets. Map the few legacy names to Normal spacing
    // tweaks (the visible part); the full Word style-set catalog is a recorded follow-up.
    const SETS: Record<string, any> = {
      'No Paragraph Space': { paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' } } },
      'Compact': { paragraph: { spacing: { before: 0, after: 80, line: 240, lineRule: 'auto' } } },
      'Double': { paragraph: { spacing: { before: 0, after: 160, line: 480, lineRule: 'auto' } } },
    }
    const preset = SETS[name] || { paragraph: { spacing: { before: 0, after: 160, line: 259, lineRule: 'auto' } } }
    const ok = redefine([{ styleId: 'Normal', paragraph: preset.paragraph }], true)
    if (ok && preset.paragraph?.spacing) applyDocDefaultsParagraph({ spacing: preset.paragraph.spacing })
    if (ok) { markDirty(); refocus(); toast('Style Set: ' + name) }
    return ok
  }

  // ---- paragraph spacing (F7 docDefaults + Normal style, real export) ----
  // s: { before, after, line } — before/after in pt; line is a multiple (1, 1.15, 2 …).
  function deParagraphSpacing(s: any): boolean {
    if (!s || typeof s !== 'object') return false
    const spacing: any = {}
    if (s.before != null) spacing.before = Math.round(Number(s.before) * 20)  // pt → twips
    if (s.after != null) spacing.after = Math.round(Number(s.after) * 20)
    if (s.line != null) { spacing.line = Math.round(Number(s.line) * 240); spacing.lineRule = 'auto' } // multiple → 240ths
    const okDoc = applyDocDefaultsParagraph({ spacing })
    const okStyle = redefine([{ styleId: 'Normal', paragraph: { spacing } }], true)
    const ok = okDoc || okStyle
    if (ok) { markDirty(); refocus(); toast('Paragraph Spacing: ' + (s.name || '')) }
    return ok
  }

  // ---- hover live-preview (D10t.9) — visual-only redefinition with snapshot/restore ----
  // Snapshot the affected styles' current visual values (linkedStyles array) when a gallery
  // opens; restore on mouseleave. Preview uses {export:false} (no styles.xml write).
  // previewSnap = a DEEP CLONE of each affected style's FULL definition.styles, captured once per
  // gallery-open. Restoring REPLACES definition.styles wholesale (so keys the preview ADDED — e.g.
  // a font-family on a style that originally had none — are removed, not just overwritten). Plan K-min.
  const PREVIEW_IDS = [...HEADING_STYLE_IDS, 'Normal']
  let previewSnap: Record<string, any> | null = null
  const clone = (o: any) => JSON.parse(JSON.stringify(o || {}))
  function snapshotStyles(styleIds: string[]): Record<string, any> | null {
    const c = converter(); const arr = c && c.linkedStyles
    if (!Array.isArray(arr)) return null
    const snap: Record<string, any> = {}
    for (const id of styleIds) {
      const e = arr.find((s: any) => s.id === id)
      snap[id] = (e && e.definition && e.definition.styles) ? clone(e.definition.styles) : {}
    }
    return snap
  }
  // dePreviewTheme(kind, item): visual-only preview. kind ∈ 'theme'|'colors'|'fonts'.
  function dePreviewTheme(kind: string, item: any): boolean {
    if (!item) return false
    if (!previewSnap) previewSnap = snapshotStyles(PREVIEW_IDS)
    let ups: any[] = []
    if (kind === 'colors') ups = HEADING_STYLE_IDS.map((id) => ({ styleId: id, run: { color: (item.accents || [])[0] } }))
    else if (kind === 'fonts') ups = themeUpdates(item.heading, item.body, null)
    else ups = themeUpdates(item.heading, item.body, item.color)
    return redefine(ups, false)
  }
  // dePreviewRestore(): revert to the snapshot by REPLACING each style's definition.styles with the
  // clone (deletes preview-added keys), then regen decorations (a no-prop redefine restamps + emits).
  function dePreviewRestore(): boolean {
    if (!previewSnap) return false
    const c = converter(); const arr = c && c.linkedStyles
    const ids = Object.keys(previewSnap)
    if (Array.isArray(arr)) {
      for (const id of ids) {
        const e = arr.find((s: any) => s.id === id)
        if (e && e.definition) e.definition.styles = clone(previewSnap[id])
      }
    }
    previewSnap = null
    return redefine(ids.map((id) => ({ styleId: id })), false) // regen from the restored array
  }
  function dePreviewCommit(): void { previewSnap = null } // click committed; drop the snapshot
  // dePreviewEnd(): defensive restore for a flyout that closes WITHOUT a per-cell mouseleave
  // (outside-click / keyboard close). Wire into the flyout-teardown path in Task 4 (verify the
  // exact WC.closeFlyouts hook in-build); idempotent (no-op when previewSnap is null).
  function dePreviewEnd(): void { if (previewSnap) dePreviewRestore() }

  // ---- page color (Task 2 real w:background) + live page-sheet paint (F12) ----
  // Use backgroundColor (longhand), NOT the `background` shorthand — the shorthand RESETS
  // background-image and would WIPE an active watermark SVG (legacy warned this at commands.js:1735).
  function paintPageSheet(hex: string | null): void {
    const ed = document.getElementById('pm-editor')
    if (ed) ed.style.backgroundColor = hex || ''
  }
  function setBackgroundAttr(hex: string | null): boolean {
    // Set the TOP doc node's `background` attr via setDocAttribute (the fork idiom for doc-level
    // data, e.g. bodySectPr — sections-adapter.ts:249). setNodeMarkup(0) would target the FIRST
    // PARAGRAPH, not the doc node (plan §2 blocker fix). DocAttrStep is docChanged → io.ts flips dirty.
    try {
      const bg = hex ? { type: 'element', name: 'w:background', attributes: { 'w:color': bareHex(hex) } } : null
      const tr = editor.state.tr.setDocAttribute('background', bg)
      editor.view ? editor.view.dispatch(tr) : editor.dispatch?.(tr)
      return true
    } catch { return false }
  }
  function dePageColor(hex: string): boolean {
    if (!hex || hex === 'transparent') return dePageColorClear()
    const ok = setBackgroundAttr(hex)
    if (ok) {
      paintPageSheet(hex)
      try { ensureDisplayBackgroundShape(converter(), true) } catch { /* none */ } // K4: Word renders bg on open
      refocus() // setDocAttribute already flips dirty (docChanged)
    }
    return ok
  }
  function dePageColorClear(): boolean {
    const ok = setBackgroundAttr(null)
    if (ok) {
      paintPageSheet(null)
      try { ensureDisplayBackgroundShape(converter(), false) } catch { /* none */ }
      refocus()
    }
    return ok
  }

  // ---- page borders (F6 real w:pgBorders; visual Phase-7) ----
  // opts: { style, color, width } (legacy shape) or { remove:true }.
  const BORDER_STYLE_MAP: Record<string, string> = { solid: 'single', double: 'double', dashed: 'dashed', dotted: 'dotted', groove: 'threeDEngrave' }
  function sectionTarget(d: any): any | null {
    // list() returns DiscoveryItem<SectionDomain> with `address` spread at the top level.
    try { const items = d.sections.list()?.items ?? []; return items[0]?.address ?? null } catch { return null }
  }
  function dePageBorders(opts: any): boolean {
    const d = docApi(); if (!d) return false
    const target = sectionTarget(d); if (!target) return false
    if (opts && opts.remove) {
      try { const r = d.sections.clearPageBorders({ target }); if (r && r.success !== false) { markDirty(); refocus(); return true } return false } catch { return false }
    }
    const style = BORDER_STYLE_MAP[String(opts?.style || 'solid')] || 'single'
    const size = Math.max(2, Math.round(Number(opts?.width || 1) * 8)) // px → eighths of a pt
    const spec = { style, size, space: 24, color: bareHex(opts?.color || '#000000') }
    const borders = { display: 'allPages', offsetFrom: 'text', top: spec, right: spec, bottom: spec, left: spec }
    try { const r = d.sections.setPageBorders({ target, borders }); if (r && r.success !== false) { markDirty(); refocus(); return true } return false } catch { return false }
  }
  function dePageBordersRemove(): boolean { return dePageBorders({ remove: true }) }

  // ---- watermark (D10t.6 visual stand-in + honest toast; Phase-7 for the real header construct) ----
  function deWatermark(text: string, opts: any): boolean {
    if (!text) return deWatermarkRemove()
    const ed = document.getElementById('pm-editor'); if (!ed) return false
    const color = String(opts?.color || '#C8C8C8').replace('#', '%23')
    const rot = opts?.diagonal === false ? 0 : -45
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='816' height='1056'><text x='408' y='560' font-family='Calibri,Arial' font-size='80' fill='${color}' fill-opacity='0.5' text-anchor='middle' transform='rotate(${rot} 408 560)'>${esc(text)}</text></svg>`
    ed.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    ed.style.backgroundRepeat = 'repeat-y'
    ed.style.backgroundPosition = 'center top'
    // Non-dirtying: the watermark is a presentational stand-in, NOT exported (real header
    // watermark = Phase 7). No markDirty — honest (nothing savable changed). Plan §2 K3.
    toast('Watermark "' + text + '" — preview only; renders in the saved file at Phase 7.')
    return true
  }
  function deWatermarkRemove(): boolean {
    const ed = document.getElementById('pm-editor'); if (ed) ed.style.backgroundImage = ''
    return true
  }

  // ---- effects (D10t.7 clone-owned presentational, no E() leak) ----
  function deEffects(shadow: string): boolean {
    const ed = document.querySelector('#pm-editor .ProseMirror') as HTMLElement | null
    if (!ed) return false
    const objs = ed.querySelectorAll('img, .wc-shape, .wc-wordart')
    objs.forEach((o: any) => { o.style.boxShadow = shadow === 'none' ? '' : shadow })
    // Non-dirtying: boxShadow is a presentational DOM style, not in the model / not exported (K3).
    toast(objs.length ? ('Theme effect applied to ' + objs.length + ' object(s).') : 'Theme effect set (applies to shapes/pictures).')
    return true
  }

  // ---- setAsDefault (D10t.8 clone-owned toast no-op) ----
  function deSetAsDefault(): boolean { toast('Current theme/spacing set as the default for new documents (session).'); return true }

  return {
    deApplyTheme, deApplyColors, deApplyFonts, deApplyStyleSet, deParagraphSpacing,
    dePreviewTheme, dePreviewRestore, dePreviewCommit, dePreviewEnd,
    dePageColor, dePageColorClear, dePageBorders, dePageBordersRemove,
    deWatermark, deWatermarkRemove, deEffects, deSetAsDefault,
  }
}
```

> Build-verify: `editor.doc.styles.apply` / `editor.doc.sections.*` return `{success}` or throw; the `!== false`
> guard tolerates both. `editor.state.doc.attrs` is the doc-node attrs; `tr.setNodeMarkup(0, …)` re-stamps the top
> doc node (pos 0). Confirm `@core` resolves to the fork in this module's tsconfig path aliases (index.ts uses
> `@core/...` at line 20); if the dynamic `import('@core/...settings-background.js')` mis-resolves at runtime, fall
> back to a static top-of-file import.

- [ ] **Step 2: Wire it into `bridge/index.ts` (import + stubs + Object.assign — NOT the FLIP)**

(a) Add the import after `installMailMerge` (index.ts:12):
```ts
import { installDesign } from './design'
```

(b) Add the pre-mount stub block in `preinstallBridge`, after the mail-merge stubs (index.ts:351), before the closing `}`:
```ts
    // slice 10 PR2: design/themes pre-mount stubs (replaced by installDesign on mount)
    deApplyTheme: () => false, deApplyColors: () => false, deApplyFonts: () => false,
    deApplyStyleSet: () => false, deParagraphSpacing: () => false,
    dePreviewTheme: () => false, dePreviewRestore: () => false, dePreviewCommit: () => {}, dePreviewEnd: () => {},
    dePageColor: () => false, dePageColorClear: () => false,
    dePageBorders: () => false, dePageBordersRemove: () => false,
    deWatermark: () => false, deWatermarkRemove: () => false,
    deEffects: () => false, deSetAsDefault: () => false,
```

(c) Append `installDesign(editor)` to the `Object.assign` (index.ts:386):
```ts
  Object.assign(PM, commands, installIo(editor), installStylePreview(editor), installClipboard(editor), installSearch(editor), installInsert(editor), installTable(editor), installReview(editor, commands.cmd), installReferences(editor), installMailMerge(editor), installDesign(editor))
```

(d) Add a `markDirty: () => {}` pre-mount stub next to the existing `setClean: () => {}` (index.ts:270).

- [ ] **Step 2.5: Add `PM.markDirty()` to `bridge/io.ts` (the Save-prompt fix, plan §2 K3)**

`bridge/io.ts` owns the app `dirty` closure (flipped by `editor.on('update')` on docChanged; read by `PM.isDirty`).
Design verbs that mutate `styles.xml`/docDefaults/`w:pgBorders` WITHOUT a docChanged transaction (e.g. a theme/color
applied to a heading-less doc) must flip it explicitly. Add a `markDirty` mirroring the existing `setClean`:

- Find where `installIo` defines `setClean` (it sets the private `dirty = false` and pokes the statusbar/title).
- Add a sibling: `const markDirty = () => { dirty = true; <the same statusbar/title poke setClean uses> }`.
- Include `markDirty` in the object `installIo` returns (so `Object.assign` publishes `PM.markDirty`).

(Verify the exact poke by reading the existing `setClean` body; mirror it with `dirty = true`.)

- [ ] **Step 3: Build + run the suite — the engine-half `[10th]` tests now PASS (FLIP test still red)**

Run: `npm run build && npm run test:pm`
Expected: the export/visual/round-trip `[10th]` tests PASS (`deApplyTheme`/`deApplyFonts`/`deParagraphSpacing`/`dePageBorders`/`dePageColor`/`deWatermark` now exist + work).
`[10th] D6 flip: themes is FLIPPED` STILL FAILS (the FLIP is Task 5). All 285 prior tests stay green.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/bridge/design.ts src/renderer/bridge/index.ts src/renderer/bridge/io.ts
git commit -m "feat(design): bridge/design.ts — themes verbs on the PM engine (real named-style redefinition + w:background + w:pgBorders + docDefaults; hover preview)

+ PM.markDirty() in io.ts so styles-only design commits flip the app dirty flag (Save prompt)."
```

---

### Task 4: Re-point the legacy entry points via `PMA()` (legacy ELSE byte-identical)

**Files:**
- Modify: `src/renderer/public/js/commands.js` (Design handlers + `livePreviewCell` + `applyColor`/`colorMenu` page branches + `applyShapeEffect` + watermark gallery)
- Modify: `src/renderer/public/js/dialogs.js` (`D.watermark`, `D.pageBorders`)

Every edit is `const pm = PMA(); if (pm) { <bridge verb>; return; }` BEFORE the unchanged legacy line — so the
`--legacy` ELSE path is byte-identical (frozen 257 gate). `PMA()` = commands.js:11; in dialogs.js use the inline
equivalent `(WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null`.

- [ ] **Step 1: `livePreviewCell` (commands.js:598-603) → PM-aware preview/restore/commit**

Replace:
```js
  function livePreviewCell(cell, item, apply) {
    let snap = null;
    cell.addEventListener('mouseenter', () => { if (!snap) snap = WC.Design.snapshot(); apply(item, true); });
    cell.addEventListener('mouseleave', () => { if (snap) { WC.Design.restore(snap); } });
    cell.addEventListener('click', () => { snap = null; WC.closeFlyouts(); apply(item, false); });
  }
```
with:
```js
  function livePreviewCell(cell, item, apply) {
    let snap = null;
    cell.addEventListener('mouseenter', () => { if (!PMA() && !snap) snap = WC.Design.snapshot(); apply(item, true); });
    cell.addEventListener('mouseleave', () => { const pm = PMA(); if (pm) { pm.dePreviewRestore(); return; } if (snap) { WC.Design.restore(snap); } });
    cell.addEventListener('click', () => { const pm = PMA(); if (pm) { pm.dePreviewCommit(); } else { snap = null; } WC.closeFlyouts(); apply(item, false); });
  }
```
(Legacy ELSE byte-identical: when `PMA()` is null, `snap` is set on enter, restored on leave, nulled on click — exactly as before. In PM the snapshot/restore lives in the bridge's `dePreview*`.)

- [ ] **Step 1.5: Defensive preview-end on flyout close (covers close-without-mouseleave)**

Locate `WC.closeFlyouts` (the shared flyout teardown). Add at the top of its body:
`try { const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm && pm.dePreviewEnd) pm.dePreviewEnd(); } catch (e) {}`
This reverts an un-committed hover preview if a gallery closes via outside-click/keyboard (no per-cell `mouseleave`).
Idempotent (no-op when no preview is active) and a harmless no-op under `--legacy` (`WC.PM.active` false → `pm` null).
(Verify the exact `closeFlyouts` location in-build; if it lives in `util.js`/`ribbon.js` rather than `commands.js`, edit it there.)

- [ ] **Step 2: The gallery `apply` callbacks (commands.js 544, 546, 547, 548, 562) → PM-aware**

`apply(item, silent)`: `silent` (preview) → `dePreviewTheme(kind, item)`; commit → the `deApply*` verb.

- `H.themes` (544): replace `(t, silent) => WC.Design.applyTheme(t, silent)` with
  `(t, silent) => { const pm = PMA(); if (pm) { if (silent) pm.dePreviewTheme('theme', t); else pm.deApplyTheme(t); return; } WC.Design.applyTheme(t, silent); }`
- `H.colors` (546): the `livePreviewCell` apply — replace `(item, silent) => WC.Design.applyColorScheme(item, silent)` with
  `(item, silent) => { const pm = PMA(); if (pm) { if (silent) pm.dePreviewTheme('colors', item); else pm.deApplyColors(item); return; } WC.Design.applyColorScheme(item, silent); }`
  — AND the flyItem onClick: replace `{ onClick: () => WC.Design.applyColorScheme(s) }` with
  `{ onClick: () => { const pm = PMA(); if (pm) { pm.deApplyColors(s); pm.dePreviewCommit(); return; } WC.Design.applyColorScheme(s); } }`
- `H.fonts` (547): replace `(item, silent) => WC.Design.applyFontPairing(item, silent)` with
  `(item, silent) => { const pm = PMA(); if (pm) { if (silent) pm.dePreviewTheme('fonts', item); else pm.deApplyFonts(item); return; } WC.Design.applyFontPairing(item, silent); }`
- `H.paragraphSpacing` (548): replace `(item, silent) => WC.Design.applyParagraphSpacing(item, silent)` with
  `(item, silent) => { const pm = PMA(); if (pm) { if (!silent) pm.deParagraphSpacing(item); return; } WC.Design.applyParagraphSpacing(item, silent); }`
  (spacing has no cheap visual preview; PM previews are no-ops, commit applies — honest.)
- `styleSetGallery` (562): replace `(n, silent) => WC.Design.applyStyleSet(n, silent)` with
  `(n, silent) => { const pm = PMA(); if (pm) { if (!silent) pm.deApplyStyleSet(n); return; } WC.Design.applyStyleSet(n, silent); }`

- [ ] **Step 3: `H.setAsDefault` (592) + `applyShapeEffect` (586) → PM-aware**

- `H.setAsDefault` (592): replace `H.setAsDefault = () => WC.Design.setAsDefault();` with
  `H.setAsDefault = () => { const pm = PMA(); if (pm) { pm.deSetAsDefault(); return; } WC.Design.setAsDefault(); };`
- `applyShapeEffect` (586): insert at the top of the function body, before `const objs = …`:
  `const pm = PMA(); if (pm) { pm.deEffects(shadow); return; }`

- [ ] **Step 4: Watermark gallery cell (637) + remove (644) → PM-aware**

- Cell click (637): replace `cell.addEventListener('click', () => { WC.closeFlyouts(); WC.Design.watermark(label); });` with
  `cell.addEventListener('click', () => { WC.closeFlyouts(); const pm = PMA(); if (pm) { pm.deWatermark(label, {}); return; } WC.Design.watermark(label); });`
- Remove item (644): replace `fly.appendChild(WC.flyItem('Remove Watermark', { onClick: () => WC.Design.removeWatermark() }));` with
  `fly.appendChild(WC.flyItem('Remove Watermark', { onClick: () => { const pm = PMA(); if (pm) { pm.deWatermarkRemove(); return; } WC.Design.removeWatermark(); } }));`

- [ ] **Step 5: Page color — `applyColor('page')` (1733-1735) + `colorMenu` no-color branch (1742)**

- `applyColor` page branch (1733-1736): replace
  ```js
    } else if (kind === 'page') {
      if (pm) { pm.notifyBlocked('Page Color'); return; } // design area — slice 10
      E().node.style.backgroundColor = color; // not 'background' — that wipes a watermark's background-image
    }
  ```
  with
  ```js
    } else if (kind === 'page') {
      if (pm) { pm.dePageColor(color); return; } // design area — slice 10 PR2 (real w:background)
      E().node.style.backgroundColor = color; // not 'background' — that wipes a watermark's background-image
    }
  ```
  (`pm` is already `const pm = PMA();` at the top of `applyColor`, line 1714.)
- `colorMenu` no-color branch (1742): the `else pm.notifyBlocked(kind)` inside the `color === null` PM path — replace
  `else pm.notifyBlocked(kind);` with `else { pm.dePageColorClear(); } return;` (preserve the existing `return;` semantics —
  the surrounding block already `return`s after the PM branch).

> Implementation note: line 1742 is one long line; the PM `color===null` sub-branch reads
> `if (pm) { if (kind === 'hilite') …; else if (kind === 'fore') …; else if (kind === 'shade') …; else pm.notifyBlocked(kind); return; }`.
> Change only the final `else pm.notifyBlocked(kind);` to `else pm.dePageColorClear();` (the `return;` stays).

- [ ] **Step 6: Dialogs — `D.watermark` (dialogs.js:1180) + `D.pageBorders` (1198-1199)**

- `D.watermark` OK (1180): replace `{ label: 'OK', primary: true, onClick: () => WC.Design.watermark(text.value, { color, diagonal: diag.checked }) },` with
  ```js
      { label: 'OK', primary: true, onClick: () => { const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.deWatermark(text.value, { color, diagonal: diag.checked }); return; } WC.Design.watermark(text.value, { color, diagonal: diag.checked }); } },
  ```
- `D.pageBorders` OK (1198): replace `{ label: 'OK', primary: true, onClick: () => WC.Design.pageBorders({ style: style.value, color, width: parseFloat(width.value) }) },` with
  ```js
      { label: 'OK', primary: true, onClick: () => { const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.dePageBorders({ style: style.value, color, width: parseFloat(width.value) }); return; } WC.Design.pageBorders({ style: style.value, color, width: parseFloat(width.value) }); } },
  ```
- `D.pageBorders` Remove (1199): replace `{ label: 'Remove', onClick: () => WC.Design.pageBorders({ remove: true }) },` with
  ```js
      { label: 'Remove', onClick: () => { const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.dePageBordersRemove(); return; } WC.Design.pageBorders({ remove: true }); } },
  ```

- [ ] **Step 7: Build + gates (themes still NOT flipped, so PM dispatch is still BLOCKED at the dispatch head — these re-points are dormant until the FLIP)**

Run: `npm run build && npm run test:pm && npm run test:legacy`
Expected: PM suite unchanged (FLIP test still red; the re-points don't fire until `themes` is in FLIPPED — the dispatch
head blocks them). Legacy **257/257 byte-identical** (the ELSE branches are unchanged).

- [ ] **Step 8: Commit**

```bash
git add src/renderer/public/js/commands.js src/renderer/public/js/dialogs.js
git commit -m "refactor(design): re-point WC.Design entry points via PMA() (legacy ELSE byte-identical)

Design handlers + livePreviewCell (hover preview) + applyColor('page') + colorMenu +
applyShapeEffect + watermark gallery + D.watermark/D.pageBorders dialogs branch to the
bridge in PM mode, fall through to WC.Design under --legacy. Dormant until the FLIP."
```

---

### Task 5: THE FLIP + leak audit

**Files:**
- Modify: `src/renderer/bridge/index.ts` (add `'themes'` to `FLIPPED`)

- [ ] **Step 1: Confirm the FLIP test is the only `[10th]` failure** — `npm run test:pm` shows `[10th] D6 flip: themes is FLIPPED` failing, all other `[10th]` green.

- [ ] **Step 2: THE FLIP — add `'themes'` to `FLIPPED` (index.ts:43)**

Replace:
```ts
const FLIPPED = new Set<string>(['character', 'history', 'paragraph', 'lists', 'styles', 'clipboard', 'editing-misc', 'find-replace', 'insert-basics', 'review', 'references', 'mail-merge']) // slices 1-6 + 8-10
```
with:
```ts
const FLIPPED = new Set<string>(['character', 'history', 'paragraph', 'lists', 'styles', 'clipboard', 'editing-misc', 'find-replace', 'insert-basics', 'review', 'references', 'mail-merge', 'themes']) // slices 1-6 + 8-10
```

- [ ] **Step 3: Leak audit — no reachable legacy `E()` mutation for design cmds in PM mode**

Run a grep audit and reason through each remaining `WC.Design.` / `E().` call reachable from a design cmd:
```bash
rg -n "WC\.Design\.|E\(\)\." src/renderer/public/js/commands.js src/renderer/public/js/dialogs.js | rg -i "theme|color|font|spacing|watermark|border|effect|styleSet|setAsDefault|applyColor|page"
```
Confirm EVERY design-cmd mutation site has a `PMA()`/`WC.PM` guard with `return` BEFORE the legacy `WC.Design.*`/`E()` line
(Task 4 covered: livePreviewCell, the 5 apply callbacks, colors onClick, setAsDefault, applyShapeEffect, watermark cell + remove,
applyColor page, colorMenu no-color, D.watermark, D.pageBorders OK/Remove). Note `WC.Design.snapshot()` on mouseenter (600) is
guarded by `if (!PMA() && !snap)`. Document the audit result in the commit body.

- [ ] **Step 4: Build + the FULL PM suite green**

Run: `npm run build && npm run test:pm`
Expected: ALL `[10th]` tests PASS including `[10th] D6 flip: themes is FLIPPED`. Prior 285 unchanged → PM total grows (~285 + 12).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/bridge/index.ts
git commit -m "feat(design): THE FLIP — themes onto the PM engine + leak audit

Adds 'themes' to FLIPPED so the Design tab dispatches to bridge/design.ts. Leak audit
clean: every design-cmd mutation site is PMA()-guarded (return before the legacy WC.Design/
E() line); no reachable legacy mutation in PM mode. Hover live-preview + real named-style
redefinition (headings export to styles.xml), real w:background page color, real w:pgBorders,
real docDefaults spacing; watermark = honest Phase-7 visual stand-in."
```

---

### Task 6: Six gates + oracle vs Word 16 + checkpoint + PR

**Files:**
- Modify: `docs/plan/last-point.md`, `docs/plan/execution-map.md`, `docs/plan/deferrals.md` (plan-tracking skill)

- [ ] **Step 1: All six gates green (build first)**

```bash
npm run build && npm run test:pm
npm run build && npm run test:legacy        # 257/257 byte-identical
npm run build && npm run test:smoke && npm run test:smoke:legacy   # 9/9 ×2
npm run build && npm run test:roundtrip      # 27/0
npm run test:docx                            # 17/0 (frozen legacy gate)
```
Expected: PM ~297/297, legacy 257/257, smoke 9/9 ×2, roundtrip 27/0, docx 17/0. Run on an idle machine (suites flake under load).

- [ ] **Step 2: Verify the hover-preview + heading repaint VISUALLY in the built app (K1/K2)**

`npm start`, open a doc with a Heading 1 + Title + body, open Design → Themes, hover a theme cell → confirm headings
repaint live; mouse-out → confirm they revert; click → confirm they stick. If hover is janky (K1) or body font doesn't
repaint (K2): record honestly in the commit/ledger (export is correct regardless) and, if needed, fall back to click-only
preview per ledger-C. Screenshot evidence into `.oracle-probes/slice10-themes/`.

- [ ] **Step 3: Oracle vs Word for Windows 16.0 (`word-oracle-win.ps1`, PID-safe, foreground, unsandboxed)**

Author a themed doc in the clone (apply a theme → redefines Heading1/Title; set page color; set page borders; set
paragraph spacing), export bytes to `C:\tmp\wc-slice10-themes-clone.docx`, then:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1 roundtrip --in C:\tmp\wc-slice10-themes-clone.docx --out C:\tmp\wc-slice10-themes-resaved.docx
```
- **Leg A (clone→Word):** ROUNDTRIP_OK (no repair prompt). Inspect the resaved docx (`scripts/docx-inspect.js` + unzip): the
  redefined `Heading1`/`Title` `<w:style>` carry the literal `w:rFonts`/`w:color`; `<w:background w:color>` + `<w:displayBackgroundShape/>`
  survive; `<w:pgBorders>` survives; docDefaults `<w:spacing>` survives. Computer-Use: open the resaved doc in live Word →
  headings show the theme font/color; page shows the color; page border renders.
- **Leg B (Word→clone):** author a doc in Word with a heading-style override + page color, save, `PM().openDocx` → confirm
  the heading style imports + `w:background` round-trips (the `[10th] IMPORT round-trip` test already pins the clone-authored
  path; this leg pins Word's own serialization).

Write verdicts to `docs/superpowers/plans/notes/2026-06-13-slice10-themes-oracle.json`.

- [ ] **Step 4: Checkpoint (plan-tracking skill)**

Append a dated entry to `docs/plan/last-point.md` (top); tick `docs/plan/execution-map.md` Daily log; advance the CURRENT
PHASE banner to "slice 10 PR2 themes DONE → PR3 insert-exotica next"; add the ledger deviations to `docs/plan/deferrals.md`
(K3 theme-apply not undoable; K2 body-font live render best-effort; K5 named-style not theme-token; watermark Phase-7;
pageBorders/pageColor visual Phase-7). Commit the oracle JSON + docs.

```bash
git add docs/plan/last-point.md docs/plan/execution-map.md docs/plan/deferrals.md docs/superpowers/plans/notes/2026-06-13-slice10-themes-oracle.json
git commit -m "docs(plan): checkpoint slice-10 PR2 (themes) DONE -> PR3 insert-exotica next"
```

- [ ] **Step 5: PR into `main`, merge, delete branch, refresh the graph**

```bash
git push -u origin feature/phase-2-slice-10-themes
gh pr create --base main --title "Phase 2 slice 10 PR2: themes (Design tab) on the PM engine — real named-style redefinition + w:background + w:pgBorders" --body "<what flipped · fork edits NOTICE'd · oracle verdicts · gate counts · ledger deviations>"
```
After merge: delete the branch (local + remote); refresh the committed graphify graph via the **`/graphify` skill** (NOT the
raw CLI — it re-extracts the excluded fork).

---

## §5. Definition of done

- Area `themes` FLIPPED; all 11 design cmds dispatch to `bridge/design.ts` in PM mode; legacy ELSE byte-identical.
- themes/styleSet/colors/fonts **redefine named-style definitions** that EXPORT real `<w:style><w:rPr>` font+color to
  `word/styles.xml` AND repaint the PM view (headings guaranteed; body-font live render best-effort per K2).
- pageColor writes a real `<w:background>` (+ `<w:displayBackgroundShape/>`) that round-trips; pageBorders writes real
  `<w:pgBorders>`; paragraphSpacing writes real docDefaults `<w:spacing>`. All survive Word's resave (oracle Leg A).
- watermark = honest visual stand-in + toast (Phase-7 real construct); effects/setAsDefault clone-owned, no leak.
- Six gates green (PM grown ~297, legacy 257 byte-identical, smoke 9/9 ×2, roundtrip 27/0, docx 17/0).
- Oracle Leg A PASS (+ Leg B), Computer-Use visual parity captured. 5 fork edits NOTICE'd. Plan docs checkpointed. PR merged.

## §6. Execution order (one commit each, subagent-driven w/ two-stage review)

1. Task 0 — red `[10th]` tests.
2. Task 1 — fork `redefineNamedStyles` (NOTICE'd).
3. Task 2 — fork `w:background` exporter+importer+attr+settings (NOTICE'd).
4. Task 3 — `bridge/design.ts` + index.ts wiring (NOT the flip) → engine-half `[10th]` tests go green.
5. Task 4 — re-point WC.Design entry points (legacy ELSE byte-identical) — dormant until the flip.
6. Task 5 — THE FLIP + leak audit → full `[10th]` green.
7. Task 6 — six gates + oracle + checkpoint + PR.



