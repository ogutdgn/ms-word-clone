# Phase-2 Slice 10 — PR 3: insert-exotica (Insert tab) on the PM engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Flip the ribbon area `insert-exotica` (the Insert tab's exotic inserts) onto the PM engine at MAXIMAL
real-MS-Word fidelity — dropCap (real `w:framePr`), coverPage (real `w:sdt`/docPartObj content), dateTime &
quickParts (real `w:fldChar` fields), screenshot/icons/online-pictures (real `w:drawing` images), textBox (real
editable `v:textbox`), WordArt (real DrawingML `wps:wsp`+`a:prstTxWarp`+w14 effects); chart/SmartArt/OLE/signatureLine
degrade honestly with recorded follow-ups.

**Architecture:** One new clone module `bridge/insert-exotica.ts` (`installInsertExotica(editor)`, mirrors `bridge/insert.ts`)
holds the `xe*` verbs. Two NOTICE'd net-new fork commands unlock the shape inserts: `insertTextBox` (inserts an editable
`shapeContainer>shapeTextbox>paragraph` whose EXISTING VML exporter synthesizes a real `v:textbox`) and `insertWordArt`
(inserts a `vectorShape` carrying a synthesized DrawingML `drawingContent` blob that the EXISTING replay exporter re-emits —
real `wps:wsp`+`prstTxWarp`+w14). Everything else reuses existing fork capabilities from the bridge: `framePr` paragraph
attr (dropCap), `documentPartObject`/`insertContent` (coverPage), `editor.doc.fields.insert` (dateTime/quickParts),
`PM.insertImage` (screenshot/icons/pictures), `PM.insertLink` (online video). THE FLIP adds `'insert-exotica'` to `FLIPPED`;
legacy `WC.Insert.*` re-points via the established PM-guard pattern (legacy ELSE byte-identical, frozen 257 gate).

**Tech Stack:** Electron + vanilla-JS chrome (`WC` namespace) → `WC.PM` bridge (TS/ESM) → vendored fork
(`src/renderer/core/superdoc-fork/`). Tests: `scripts/test-suite-pm.js` (`[10ex]` label). Oracle:
`scripts/oracle/word-oracle-win.ps1` vs Word for Windows 16.0.

---

## §0. Pre-verified facts (5-agent deep pre-verification + 3-agent verbatim gather; file:line)

**F1 — The area is 14 cmds, currently blocked (verified).** `bridge/index.ts:84-89` maps `onlinePictures, screenshot,
icons, smartart, chart, onlineVideo, dropCap, wordart, textBox, object, signatureLine, dateTime, coverPage, quickParts`
→ `'insert-exotica'`, which is ABSENT from `FLIPPED` (index.ts:44). The dispatch heads block them (`isBlocked`, index.ts:140)
until the area joins `FLIPPED`. **TWO dispatch paths** reach the handlers: the `H.<cmd>` lambdas (commands.js 228-246) AND
the `dispatchMenu` `cmd === '…'` chain (commands.js ~1397-1416). `onlinePictures` is a PHANTOM — no `H.onlinePictures`, not
a ribbon control, only a toast no-op (commands.js:254).

**F2 — dropCap is flip-real via the `framePr` paragraph attr (verified, no fork edit).** `w:framePr` round-trips through
`framePr-translator.js` (handles `w:dropCap` + `w:lines`) and lives at `node.attrs.paragraphProperties.framePr` (the pPr
decode includes framePr; consumed at `dropcapPlugin.js:64` as `paragraphProps.framePr?.dropCap === 'margin'`). Setting
`paragraphProperties.framePr = {dropCap, lines}` via `setNodeMarkup` exports a real `<w:framePr w:dropCap=… w:lines=…>`.

**F3 — coverPage is flip-real via `insertContent` + `documentPartObject` (verified, no fork edit).** The fork's
`documentPartObject` node (`extensions/structured-content/document-part-object.js:5-54`, attrs `id`, `docPartGallery`,
`docPartUnique`, content `block*`) exports via `wSdtNodeTranslator` (exporter.js:241) to a real `w:sdt` docPartObj.
`editor.commands.insertContent(nodeJSON)` inserts it; `core/commands/insertContentAt.js` places at a position.

**F4 — dateTime & quickParts are flip-real via `editor.doc.fields.insert` (verified, no fork edit).**
`d.fields.insert({ at, instruction, mode:'raw' })` ([fields.ts:61-76](../../../src/renderer/core/superdoc-fork/_vendor/superdoc/document-api/src/fields/fields.ts), gated to `mode:'raw'`+non-empty instruction) → real `w:fldChar`/`w:instrText`
(the slice-9/10 path; existing call `references.ts:325`). `at` = a `TextTarget` resolved like references.ts' `inlineTarget()`.
DATE field: `instruction:'DATE \\@ "M/d/yyyy"'`. quickParts: `'AUTHOR'`, `'NUMPAGES'`, `'PAGE'`, `'FILENAME'`, `'TITLE'`, `'DOCPROPERTY Title'`.

**F5 — screenshot/icons/online-pictures are flip-real images via `PM.insertImage` (verified).** `PM.insertImage({src,alt,width,height})`
([bridge/insert.ts:43-69](../../../src/renderer/bridge/insert.ts)) inserts a real `w:drawing` image, keeping the data-URL via the `rId-bridge-` bypass.
Screenshot IPC: `window.wordAPI.screenshot()` → `{ok, dataUrl}` ([main.js:557-572](../../../src/main/main.js)). Local picture pick:
`window.wordAPI.pickImage()` → `{ok, dataUrl, name}` (main.js:538-550). Icons: render `WC.icon(name, N)` (an SVG string) → a
data URL → `insertImage`. Cloud SEARCH (Bing/MS icon library) is non-replicable — degrade honestly.

**F6 — textBox = editable VML, NO net-new exporter (verified, the key cost-saver).** The fork's `shapeTextbox`
(`group:'block'`, `content:'paragraph* block*'`, editable content hole, no NodeView) inside `shapeContainer`
(`content:'block+'`, `fillcolor`/`style`/`attributes` attrs) ALREADY exports via `translate-shape-textbox.js` /
`translate-shape-container.js` which **SYNTHESIZE** `v:textbox`/`v:shape`/`w:pict` from the LIVE node (`translateChildNodes`)
— no `drawingContent` replay. Routed by the exporter map `shapeContainer/shapeTextbox: pictTranslator` (exporter.js:233-234)
+ `pict-translator.js` decode dispatch. **VML `v:textbox` is valid real Word OOXML (opens without repair).** Neither node has
`addCommands` — so the only net-new work is an `insertTextBox` command that `insertContent`s a `shapeContainer>shapeTextbox>paragraph`
tree (attrs `{type:'#_x0000_t202', style:'width:Npt;height:Npt'}` + optional `fillcolor`). Editable in-app; round-trips.

**F7 — WordArt = real DrawingML via a synthesized `drawingContent` blob on `vectorShape` (verified).** `translateVectorShape`
([decode-image-node-helpers.js:605-626](../../../src/renderer/core/superdoc-fork/core/super-converter/v3/handlers/wp/helpers/decode-image-node-helpers.js)) **replays** `node.attrs.drawingContent.elements` inside `mc:AlternateContent > mc:Choice[Requires=wps] > w:drawing`. So a
fresh WordArt = build a `drawingContent` blob (`{elements:[wp:inline → a:graphic → a:graphicData uri=wordprocessingShape →
wps:wsp{cNvSpPr txBox, spPr(xfrm+prstGeom), txbx>w:txbxContent>w:p>w:r(+w14 effects)>w:t, bodyPr fromWordArt="1" + a:prstTxWarp}]}`)
and stash it on `attrs.drawingContent`; the replay exporter re-emits it (round-trips through Word AND the fork's replay).
The `wp:inline` synthesis template is `translateImageNode` (decode-image-node-helpers.js:357-458). Namespaces `a`/`w14`/`wps`
are ALREADY declared in `exporter-docx-defs.js`. **Caveats (ledger A):** `vectorShape` is a non-editable inline atom whose
NodeView paints SVG from `attrs.textContent` (NOT `drawingContent`) — so ALSO set `textContent.parts` for a flat in-app render;
the warp/`w14` effects render in Word but the fork's importer does NOT read them back (they survive via the `drawingContent`
replay blob, not as parsed attrs). `isWordArt`/`isTextBox` are NOT declared attrs on `vectorShape` — declare `isWordArt` so it
survives `nodeFromJSON`.

**F8 — Insert-command idiom (verified).** Content-bearing insert: `addCommands(){ return { insertX: (opts) => ({commands}) =>
commands.insertContent({ type, attrs, content }) } }` (mirror `image.js:708-730` `setImage`, which uses `commands.insertContent`).
`vectorShape` is a leaf/atom (attrs only, no content). `shapeContainer` carries `content`.

**F9 — The re-point idiom (verified).** The established pattern guards INSIDE the legacy method/handler:
`const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { …pm.X(); return; }`
then the unchanged legacy `E().insertHTML(...)` (see `D.equation` dialogs.js:106-108, the symbol dialog, `H.crossReference`
which uses `PMA()`). Guarding inside the `WC.Insert.*` method covers BOTH dispatch paths at once. Leak vectors (the legacy
`E().insertHTML`/`insertNodeHTML` to guard, all in `insert-features.js` unless noted): insertCover (:41), iconsPicker click
(:178), insertSmartArt (:198), chartDialog OK (:211), dateTimeDialog OK (:240), insertWordArt (:261), signatureLine OK (:270),
insertField (:298), textFromFile (:391), onlineVideoDialog Insert (:396), screenshot (:403); plus `commands.js` `H.textBox`
(:213, direct), local `insertWordArt()` (:2022), local `dropCap()` (:2024-2042). `commands.js` PMA() helper = commands.js:11.

**F10 — Bridge wiring (verified).** `FLIPPED` (index.ts:44, `'insert-exotica'` ABSENT); AREA already maps the 14 (index.ts:84-89);
`installInsert(editor)` pattern (insert.ts:20, `refocus()`+verb-bag); `Object.assign(PM, …, installInsert(editor), …, installDesign(editor))`
(index.ts:396); pre-mount stubs (index.ts:311-316 insert stubs as the model); `legacyBoot` early-return (index.ts:372).

**F11 — PM test harness (verified).** `t(name, fn)` passes iff `fn` returns neither `false` nor a string ([test-suite-pm.js:6-11](../../../scripts/test-suite-pm.js));
`exportDocumentXml()` (~:1547, document.xml string), `exportParts()` (~:2866, part map), `setDoc`/`setDocs`/`selectText`/`caretAfter`/`PM`
helpers exist (all in scope at the `[10th]` block ~:3975). Append the `[10ex]` block before the final `const pass =` line; doc-replacing
tests LAST with `await sleep(300)`.

---

## §1. Scope decisions (D10ex.x)

- **D10ex.1 — dropCap = real `w:framePr`** (F2): `xeDropCap(kind, lines)` sets `paragraphProperties.framePr` on the caret paragraph (bridge `setNodeMarkup`). No fork edit.
- **D10ex.2 — coverPage = real PM content in a `documentPartObject`** (F3): `xeCoverPage(name)` inserts a cover-page block (title/subtitle/author/year paragraphs) wrapped in a `documentPartObject` (`docPartGallery:'Cover Pages'`) at the doc start; replaces an existing one. Bridge `insertContent`.
- **D10ex.3 — dateTime = real DATE field** (F4): `xeDateTime(fmt)` → `fields.insert({instruction:'DATE \\@ "<fmt>"', mode:'raw'})`. **quickParts = real fields** (F4): `xeQuickPart(kind)` maps Page→`PAGE`, NumberOfPages→`NUMPAGES`, Date→`DATE \\@ …`, Author→`AUTHOR`, FileName→`FILENAME`, Title→`DOCPROPERTY Title`.
- **D10ex.4 — screenshot/icons/onlinePictures = real `w:drawing` images** (F5): `xeScreenshot()` (screenshot IPC → `insertImage`), `xeIcon(name)` (WC.icon SVG → data URL → `insertImage`), `xeOnlinePicture()` (local `pickImage` → `insertImage`, honest "online search unavailable — pick a local image" toast).
- **D10ex.5 — textBox = editable VML** (F6): net-new fork `insertTextBox` command; `xeTextBox(text)` calls it. Editable `v:textbox`, round-trips.
- **D10ex.6 — WordArt = real DrawingML blob** (F7): net-new fork `insertWordArt` command + `synthesizeWordArtDrawing(text, preset)`; `xeWordArt(text, preset)` calls it. Ledger-A: non-editable + flat in-app render.
- **D10ex.7 — onlineVideo = honest degrade**: `xeOnlineVideo(url)` inserts a real hyperlink to the URL (`PM.insertLink`) + toast that embedded playback lands at Phase 7. No `wp15:webVideoPr` (net-new follow-up).
- **D10ex.8 — chart / smartart / object(OLE) / signatureLine = honest toast + recorded follow-up**: `xeChart`/`xeSmartArt`/`xeObject`/`xeSignatureLine` show an honest "available in a future update" toast (no `E()` leak). Each has no fork construction path (recorded in deferrals.md). object's "Text from File" keeps its real file-insert (degrade only the OLE "Create New" branch).

---

## §2. Risks + binding amendments (K-x)

- **K1 — WordArt blob correctness (the load-bearing risk).** The synthesized `drawingContent` must (a) round-trip through the
  fork's replay exporter (it re-emits `drawingContent.elements` verbatim) and (b) open in Word without repair. **Amendment:** mirror
  the `translateImageNode` `wp:inline` wrapper exactly (F7); the `[10ex]` test greps the exported `wps:wsp`/`fromWordArt`/`prstTxWarp`;
  the oracle Leg A (Word resave, no repair) is the real gate. Declare `isWordArt` on `vectorShape` or `nodeFromJSON` drops it.
- **K2 — WordArt in-app render (ledger A).** `vectorShape` paints SVG from `textContent`, not `drawingContent`; the warp renderer is
  stubbed in this build. **Amendment:** also set `textContent.parts` so the text shows flat; the WordArt is non-editable in-app (record
  honestly — the EXPORT is real, opens warped in Word). User-accepted.
- **K3 — textBox VML validity.** `v:textbox` is legacy-but-valid OOXML. **Amendment:** the oracle Leg A must open the clone's textbox doc
  without repair; the `[10ex]` test greps `v:textbox`/`w:txbxContent`. shapeContainer needs `attrs.attributes.type='#_x0000_t202'` + a
  `style` with width/height (the VML shape geometry).
- **K4 — two dispatch paths (F1).** Re-pointing INSIDE the `WC.Insert.*` methods (F9) covers both the `H.*` and `dispatchMenu` paths in
  one place; the bare `H.textBox`/local `dropCap`/`insertWordArt` in commands.js are guarded separately. Leak audit (Task 5) greps both.
- **K5 — legacy byte-identity.** `WC.Insert`/`commands.js` legacy ELSE branches stay byte-identical (frozen 257 gate). Guards are
  PM-branch-then-return BEFORE the unchanged legacy line.
- **K6 — `editor.doc` freshness.** Read `editor.doc`/`editor.commands` fresh each call (the references.ts discipline); never hoist.
- **K7 — dirty flag.** Shape/field/framePr inserts are real PM transactions (`insertContent`/`setNodeMarkup`) → docChanged → io.ts flips
  dirty automatically. Honest-degrade toasts (chart/smartart/object/signatureLine) are non-dirtying (nothing savable changed).
- **K8 — `at` TextTarget for fields.** dateTime/quickParts need a `TextTarget` at the caret. **Amendment:** reuse the references.ts
  `inlineTarget()` mint-sdBlockId pattern (copy the helper into insert-exotica.ts) so the field inserts at an addressable block.

---

## §3. File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/test-suite-pm.js` | Modify (append `[10ex]` block) | Red→green engine-observable tests for all flipped verbs + FLIP + no-leak toasts. |
| `src/renderer/core/superdoc-fork/extensions/shape-textbox/shape-textbox.js` | Modify (NOTICE'd) | Net-new `insertTextBox` command. |
| `src/renderer/core/superdoc-fork/extensions/vector-shape/vector-shape.js` | Modify (NOTICE'd) | Declare `isWordArt` attr + net-new `insertWordArt` command + `synthesizeWordArtDrawing` helper. |
| `src/renderer/core/superdoc-fork/NOTICE.md` | Modify | Record the 2 fork edits. |
| `src/renderer/bridge/insert-exotica.ts` | Create | `installInsertExotica(editor)` — all `xe*` verbs + `inlineTarget()` + honest-degrade toasts. |
| `src/renderer/bridge/index.ts` | Modify | Import `installInsertExotica`; add `xe*` pre-mount stubs; append to `Object.assign`; add `'insert-exotica'` to `FLIPPED` (THE FLIP). |
| `src/renderer/public/js/insert-features.js` | Modify | Re-point the `WC.Insert.*` exotica mutations via the PM guard (legacy ELSE byte-identical). |
| `src/renderer/public/js/commands.js` | Modify | Re-point `H.textBox` + local `dropCap()`/`insertWordArt()` via `PMA()`. |
| `docs/plan/*`, `docs/superpowers/plans/notes/*` | Modify (Task 6) | Checkpoint + oracle verdicts. |

---

## §4. Tasks

### Task 0: Red `[10ex]` tests (engine-observable, written FIRST)

**Files:** Modify `scripts/test-suite-pm.js` (insert the `[10ex]` block immediately BEFORE the final
`const pass = results.filter((r) => r.pass).length;` line, after the `[10th]` block; doc-replacing tests LAST).

- [ ] **Step 1: Write the failing `[10ex]` block** (uses existing helpers `setDoc`/`setDocs`/`caretAfter`/`PM`/`exportDocumentXml`/`doc`):

```js
  // ===== [10ex] insert-exotica (slice 10 PR3) — doc-replacing tests LAST =====
  await t('[10ex] D6 flip: insert-exotica is FLIPPED', () => PM().isFlipped('insert-exotica') === true || 'insert-exotica not in FLIPPED');

  await t('[10ex] EXPORT: xeDropCap → <w:framePr w:dropCap> in document.xml', async () => {
    setDocs(['Dropped capital paragraph here', 'body']); caretAfter('Dropped');
    if (typeof PM().xeDropCap !== 'function') return 'PM.xeDropCap missing (red — bridge not installed)';
    if (PM().xeDropCap('drop', 3) !== true) return 'xeDropCap refused (red)';
    await sleep(60);
    const xml = await exportDocumentXml();
    return /<w:framePr\b[^>]*w:dropCap="drop"/.test(xml) || 'no <w:framePr w:dropCap=drop>: ' + xml.slice(0, 300);
  });

  await t('[10ex] EXPORT: xeCoverPage → documentPartObject / w:sdt docPartObj', async () => {
    setDocs(['existing body']);
    if (typeof PM().xeCoverPage !== 'function') return 'PM.xeCoverPage missing (red)';
    if (PM().xeCoverPage('Banded') !== true) return 'xeCoverPage refused (red)';
    await sleep(80);
    let hasDpo = false; doc().descendants((n) => { if (n.type.name === 'documentPartObject') hasDpo = true; });
    if (!hasDpo) return 'no documentPartObject node inserted';
    const xml = await exportDocumentXml();
    return /docPartGallery|<w:docPartObj\b/.test(xml) || 'no w:sdt docPartObj in export';
  });

  await t('[10ex] EXPORT: xeDateTime → DATE field in document.xml', async () => {
    setDoc('Today '); caretAfter('Today ');
    if (typeof PM().xeDateTime !== 'function') return 'PM.xeDateTime missing (red)';
    if (PM().xeDateTime('M/d/yyyy') !== true) return 'xeDateTime refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    return /DATE\b/.test(xml) || 'no DATE field in document.xml: ' + xml.slice(0, 300);
  });

  await t('[10ex] EXPORT: xeQuickPart(author) → AUTHOR field', async () => {
    setDoc('By '); caretAfter('By ');
    if (typeof PM().xeQuickPart !== 'function') return 'PM.xeQuickPart missing (red)';
    if (PM().xeQuickPart('author') !== true) return 'xeQuickPart refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    return /AUTHOR/.test(xml) || 'no AUTHOR field';
  });

  await t('[10ex] EXPORT: xeWordArt → wps:wsp + fromWordArt + prstTxWarp', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeWordArt !== 'function') return 'PM.xeWordArt missing (red)';
    if (PM().xeWordArt('Hello WordArt', { color: '#C00000' }) !== true) return 'xeWordArt refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    if (!/<wps:wsp\b/.test(xml)) return 'no <wps:wsp> (WordArt shape) in document.xml';
    if (!/fromWordArt="1"/.test(xml)) return 'no fromWordArt="1" on bodyPr';
    return /<a:prstTxWarp\b/.test(xml) || 'no <a:prstTxWarp> (WordArt warp)';
  });

  await t('[10ex] EXPORT: xeTextBox → editable v:textbox/w:txbxContent', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeTextBox !== 'function') return 'PM.xeTextBox missing (red)';
    if (PM().xeTextBox('Box text') !== true) return 'xeTextBox refused (red)';
    await sleep(80);
    let hasBox = false; doc().descendants((n) => { if (n.type.name === 'shapeContainer' || n.type.name === 'shapeTextbox') hasBox = true; });
    if (!hasBox) return 'no shapeContainer/shapeTextbox node inserted (not editable)';
    const xml = await exportDocumentXml();
    return (/<v:textbox\b/.test(xml) && /<w:txbxContent\b/.test(xml)) || 'no <v:textbox>/<w:txbxContent> in export';
  });

  await t('[10ex] xeIcon inserts a real image node (not a legacy span)', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeIcon !== 'function') return 'PM.xeIcon missing (red)';
    if (PM().xeIcon('save') !== true) return 'xeIcon refused (red)';
    await sleep(60);
    let hasImg = false; doc().descendants((n) => { if (n.type.name === 'image') hasImg = true; });
    return hasImg || 'no image node from xeIcon';
  });

  await t('[10ex] honest-degrade verbs (chart/smartart/object/signatureLine) are no-op toasts (no E() leak)', () => {
    setDoc('keepme');
    for (const v of ['xeChart', 'xeSmartArt', 'xeObject', 'xeSignatureLine']) {
      if (typeof PM()[v] !== 'function') return 'PM.' + v + ' missing (red)';
      PM()[v]();
    }
    let shapes = 0; doc().descendants((n) => { if (['shapeContainer', 'vectorShape', 'image'].includes(n.type.name)) shapes++; });
    return (shapes === 0 && doc().textContent.includes('keepme')) || 'a degrade verb mutated the doc (should be a no-op toast)';
  });

  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10ex] IMPORT round-trip: WordArt survives export→openDocx', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeWordArt !== 'function') return 'PM.xeWordArt missing (red)';
    if (PM().xeWordArt('RT WordArt', {}) !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    let hasWa = false; doc().descendants((n) => { if (n.type.name === 'vectorShape') hasWa = true; });
    return hasWa || 'WordArt vectorShape lost on round-trip';
  });

  await t('[10ex] IMPORT round-trip: textBox survives export→openDocx (editable)', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().xeTextBox !== 'function') return 'PM.xeTextBox missing (red)';
    if (PM().xeTextBox('RT box') !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    let hasBox = false; doc().descendants((n) => { if (n.type.name === 'shapeContainer' || n.type.name === 'shapeTextbox') hasBox = true; });
    return hasBox || 'textBox lost on round-trip';
  });
```

- [ ] **Step 2: Run + verify RED.** `npm run build && npm run test:pm` — the `[10ex]` tests fail (`insert-exotica not in FLIPPED`, `PM.xe* missing`); prior 299 stay green.

- [ ] **Step 3: Commit.**
```bash
git add scripts/test-suite-pm.js
git commit -m "test(insert): slice-10 PR3 red [10ex] tests (dropCap framePr, coverPage docPartObj, DATE/AUTHOR fields, WordArt wps:wsp+prstTxWarp, editable v:textbox, icon image, degrade no-leak, FLIP)"
```

---

### Task 1: Fork — net-new `insertTextBox` command (editable VML text box)

**Files:** Modify `src/renderer/core/superdoc-fork/extensions/shape-textbox/shape-textbox.js` (add `addCommands`); Modify `NOTICE.md`.

- [ ] **Step 1: Add a module-level unique-id counter + `addCommands()` to `ShapeTextbox`.**

At the top of `shape-textbox.js` (after imports, before `export const ShapeTextbox`):
```js
// Per-session monotonic VML shape id (unique within a doc — duplicate VML shape ids trigger Word repair, K1).
let _shapeTextboxSeq = 1025;
```
Then add `addCommands()` inside the `Node.create({...})` object (after `renderDOM`):
```js
  addCommands() {
    return {
      /**
       * NET-NEW (slice 10 PR3 insert-exotica, NOTICE'd). Insert an editable text box:
       * a shapeContainer > shapeTextbox > paragraph tree. The EXISTING VML exporter
       * (translate-shape-container/textbox) synthesizes a real <w:pict><v:shape type="#_x0000_t202">
       * <v:textbox><w:txbxContent> from the live node — VML is valid Word OOXML, editable in-app,
       * round-trips. (Word-no-repair is gated on oracle Leg A — K2; if Word repairs, emit the
       * standard <v:shapetype id="_x0000_t202"> once.) options: { text?, width?, height?, fillcolor? }.
       */
      insertTextBox:
        (options = {}) =>
        ({ commands }) => {
          const text = typeof options.text === 'string' ? options.text : 'Text';
          const w = options.width || 200;
          const h = options.height || 100;
          const shapeId = '_x0000_s' + (++_shapeTextboxSeq); // unique per insert (K1)
          return commands.insertContent({
            type: 'shapeContainer',
            attrs: {
              ...(options.fillcolor ? { fillcolor: options.fillcolor } : {}),
              attributes: { id: shapeId, type: '#_x0000_t202', style: 'width:' + w + 'pt;height:' + h + 'pt' },
            },
            content: [
              {
                type: 'shapeTextbox',
                attrs: {},
                content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
              },
            ],
          });
        },
    };
  },
```

> `shapeContainer.content='block+'` and `shapeTextbox.content='paragraph* block*'` — schema-valid. The module counter
> gives a unique VML shape id per insert (two text boxes in one doc must not collide — Word-repair risk, K1).

- [ ] **Step 2: NOTICE.md** — append:
```markdown
- `extensions/shape-textbox/shape-textbox.js` — NET-NEW `insertTextBox` command (slice 10 PR3): inserts an editable
  shapeContainer>shapeTextbox>paragraph; the existing VML exporter synthesizes a real <v:textbox>/<w:txbxContent>.
```

- [ ] **Step 3: Build.** `npm run build` — must build clean. (Exercised by the `[10ex] xeTextBox` test once the bridge calls it in Task 3.)

- [ ] **Step 4: Commit.**
```bash
git add src/renderer/core/superdoc-fork/extensions/shape-textbox/shape-textbox.js src/renderer/core/superdoc-fork/NOTICE.md
git commit -m "feat(fork): net-new insertTextBox command (editable VML text box)

Inserts an editable shapeContainer>shapeTextbox>paragraph; the existing VML exporter
synthesizes a real <w:pict><v:shape type=#_x0000_t202><v:textbox><w:txbxContent> from the
live node (valid Word OOXML, editable, round-trips). NOTICE'd."
```

---

### Task 2: Fork — net-new `insertWordArt` command + `synthesizeWordArtDrawing` (real DrawingML WordArt)

**Files:** Modify `src/renderer/core/superdoc-fork/extensions/vector-shape/vector-shape.js` (declare `isWordArt` attr + module helper + `addCommands`); Modify `NOTICE.md`.

- [ ] **Step 1: Declare the `isWordArt` attr** — inside `addAttributes()`'s return (after `textInsets`), add:
```js
      isWordArt: {
        default: false,
        rendered: false,
      },
```

- [ ] **Step 2: Add the module-level `synthesizeWordArtDrawing` helper** (top-level in vector-shape.js, after the imports / before `export const VectorShape`):
```js
// Per-session monotonic wp:docPr id (unique within a doc — duplicate docPr ids trigger Word repair, K1).
let _wordArtSeq = 1000;

// NET-NEW (slice 10 PR3 insert-exotica, NOTICE'd). Build a real DrawingML WordArt blob to stash on
// vectorShape.attrs.drawingContent — translateVectorShape replays it verbatim, so it round-trips
// through Word AND the fork. Mirrors translateImageNode's wp:inline wrapper. Namespaces a/w14/wps
// are already declared in exporter-docx-defs.js.
function synthesizeWordArtDrawing(text, opts = {}) {
  const w = opts.width || 300, h = opts.height || 80;
  const cx = Math.round(w * 9525), cy = Math.round(h * 9525); // px → EMU
  const color = String(opts.color || '#2B579A').replace(/^#/, '').toUpperCase();
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const id = ++_wordArtSeq; // unique per insert (K1)
  return {
    elements: [{
      name: 'wp:inline',
      attributes: { distT: '0', distB: '0', distL: '0', distR: '0' },
      elements: [
        { name: 'wp:extent', attributes: { cx: String(cx), cy: String(cy) } },
        { name: 'wp:effectExtent', attributes: { l: '0', t: '0', r: '0', b: '0' } },
        { name: 'wp:docPr', attributes: { id: String(id), name: 'WordArt ' + id } },
        { name: 'wp:cNvGraphicFramePr' },
        { name: 'a:graphic', attributes: { 'xmlns:a': A }, elements: [
          { name: 'a:graphicData', attributes: { uri: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape' }, elements: [
            { name: 'wps:wsp', elements: [
              { name: 'wps:cNvSpPr', attributes: { txBox: '1' } },
              { name: 'wps:spPr', elements: [
                { name: 'a:xfrm', elements: [
                  { name: 'a:off', attributes: { x: '0', y: '0' } },
                  { name: 'a:ext', attributes: { cx: String(cx), cy: String(cy) } },
                ] },
                { name: 'a:prstGeom', attributes: { prst: 'rect' }, elements: [{ name: 'a:avLst' }] },
                { name: 'a:noFill' },
              ] },
              { name: 'wps:txbx', elements: [
                { name: 'w:txbxContent', elements: [
                  { name: 'w:p', elements: [
                    { name: 'w:r', elements: [
                      { name: 'w:rPr', elements: [
                        { name: 'w:sz', attributes: { 'w:val': '72' } },
                        { name: 'w:szCs', attributes: { 'w:val': '72' } },
                        { name: 'w14:textFill', elements: [
                          { name: 'w14:solidFill', elements: [
                            { name: 'w14:srgbClr', attributes: { 'w14:val': color } },
                          ] },
                        ] },
                      ] },
                      { name: 'w:t', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: String(text) }] },
                    ] },
                  ] },
                ] },
              ] },
              { name: 'wps:bodyPr', attributes: { fromWordArt: '1', wrap: 'square', rtlCol: '0', anchor: 'ctr' }, elements: [
                { name: 'a:prstTxWarp', attributes: { prst: 'textNoShape' }, elements: [{ name: 'a:avLst' }] },
              ] },
            ] },
          ] },
        ] },
      ],
    }],
  };
}
```

- [ ] **Step 3: Add `addCommands()` to `VectorShape`** (after `addNodeView`, inside `Node.create({...})`):
```js
  addCommands() {
    return {
      /**
       * NET-NEW (slice 10 PR3 insert-exotica, NOTICE'd). Insert real DrawingML WordArt: a vectorShape
       * carrying a synthesized drawingContent blob (translateVectorShape replays it → real wps:wsp +
       * bodyPr fromWordArt + a:prstTxWarp + w14:textFill; round-trips Word + fork). Also sets textContent
       * so the (non-editable) SVG NodeView shows the text flat in-app (ledger A: the warp renders in Word,
       * not in-app). options: { text?, color?, width?, height? }.
       */
      insertWordArt:
        (options = {}) =>
        ({ commands }) => {
          const text = (typeof options.text === 'string' && options.text) ? options.text : 'WordArt';
          return commands.insertContent({
            type: this.name,
            attrs: {
              isWordArt: true,
              kind: 'rect',
              width: options.width || 300,
              height: options.height || 80,
              // textAlign/textVerticalAlign are the NODE-level attrs the VectorShapeView reads for
              // centering (textContent.* alignment keys are ignored by the view).
              textAlign: 'center',
              textVerticalAlign: 'center',
              drawingContent: synthesizeWordArtDrawing(text, options),
              textContent: { parts: [{ text, formatting: {} }] },
            },
          });
        },
    };
  },
```

- [ ] **Step 4: NOTICE.md** — append:
```markdown
- `extensions/vector-shape/vector-shape.js` — NET-NEW `isWordArt` attr + `synthesizeWordArtDrawing` + `insertWordArt`
  command (slice 10 PR3): inserts a vectorShape with a synthesized DrawingML blob (wps:wsp + bodyPr fromWordArt +
  a:prstTxWarp + w14:textFill) on drawingContent; the replay exporter re-emits it (round-trips Word + fork). Sets
  textContent for a flat in-app SVG render (warp renders in Word only — ledger A).
```

- [ ] **Step 5: Build.** `npm run build` — clean. (Exercised by `[10ex] xeWordArt` in Task 3.)

- [ ] **Step 6: Commit.**
```bash
git add src/renderer/core/superdoc-fork/extensions/vector-shape/vector-shape.js src/renderer/core/superdoc-fork/NOTICE.md
git commit -m "feat(fork): net-new insertWordArt command (real DrawingML WordArt)

vectorShape gains an isWordArt attr + synthesizeWordArtDrawing (builds a real wps:wsp +
bodyPr fromWordArt + a:prstTxWarp + w14:textFill blob on drawingContent; the replay exporter
re-emits it so it round-trips Word and the fork) + an insertWordArt command. Sets textContent
for a flat in-app SVG render (the warp renders in Word, not in-app — ledger A). NOTICE'd."
```

---

### Task 3: `bridge/insert-exotica.ts` — the `xe*` verb surface + wiring

**Files:** Create `src/renderer/bridge/insert-exotica.ts`; Modify `src/renderer/bridge/index.ts` (import + stubs + `Object.assign`, NOT the FLIP).

- [ ] **Step 1: Create `src/renderer/bridge/insert-exotica.ts`** (mirrors `bridge/insert.ts`; reuses `PM.insertImage`/`insertLink` for images/links; `editor.doc.fields` for fields; `editor.commands.insertTextBox`/`insertWordArt` for shapes; `setNodeMarkup` for dropCap; `insertContent` for the cover page):

```ts
// Slice 10 PR3: insert-exotica doc-mutation surface on the PM engine. dropCap (real w:framePr),
// coverPage (documentPartObject content), dateTime/quickParts (real DATE/AUTHOR fields), screenshot/
// icons/onlinePictures (real w:drawing images), textBox (editable v:textbox), WordArt (real DrawingML
// blob); chart/smartart/object/signatureLine/onlineVideo degrade honestly. editor.doc/commands read
// fresh each call (K6). See plan §0 F2-F9.
import { TextSelection } from '@/pm'

type AnyEditor = any

export function installInsertExotica(editor: AnyEditor) {
  const w = window as any
  const refocus = () => editor.view?.focus()
  const toast = (m: string, d?: string) => { try { w.WC?.toast?.(m, d) } catch { /* none */ } }
  const pm = () => (w.WC && w.WC.PM) ? w.WC.PM : null
  const docApi = (): any => { try { return editor.doc } catch { return null } }

  // selection → TextTarget for field inserts; mint an sdBlockId when the caret block lacks one
  // (the references.ts K-risk-1 pattern, condensed).
  function inlineTarget(): any | null {
    const d = docApi(); if (!d) return null
    try { const t = d.selection.current({})?.target; if (t) return t } catch { /* mint */ }
    try {
      const { from } = editor.state.selection
      const $pos = editor.state.doc.resolve(from)
      let depth = $pos.depth
      while (depth > 0 && !$pos.node(depth).isTextblock) depth--
      const node = $pos.node(depth)
      if (!node || !node.isTextblock) return null
      const attrs = (node.attrs ?? {}) as Record<string, unknown>
      const existing = attrs.sdBlockId ?? attrs.id ?? attrs.blockId
      if (!(typeof existing === 'string' && existing.length > 0)) {
        if (!('sdBlockId' in (node.type.spec.attrs ?? {}))) return null
        const blockPos = $pos.before(depth)
        const minted = 'wc-xe-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        const tr = editor.state.tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, sdBlockId: minted })
        tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from)))
        editor.view?.dispatch(tr)
      }
    } catch { return null }
    try { return docApi()?.selection.current({})?.target ?? null } catch { return null }
  }

  function insertField(instruction: string): boolean {
    const d = docApi(); if (!d) return false
    const at = inlineTarget(); if (!at) return false
    try { const r = d.fields.insert({ at, instruction, mode: 'raw' }); refocus(); return !!(r && r.success !== false) } catch { return false }
  }

  // ---- dropCap (real w:framePr) ----
  function xeDropCap(kind: string, lines: number): boolean {
    const dc = kind === 'margin' ? 'margin' : (kind === 'none' || !kind) ? null : 'drop'
    try {
      const { from } = editor.state.selection
      const $pos = editor.state.doc.resolve(from)
      let depth = $pos.depth
      while (depth > 0 && $pos.node(depth).type.name !== 'paragraph') depth--
      const node = $pos.node(depth)
      if (!node || node.type.name !== 'paragraph') return false
      const pos = $pos.before(depth)
      const pp = { ...(node.attrs.paragraphProperties || {}) }
      if (dc) pp.framePr = { dropCap: dc, lines: lines || 3, wrap: 'around', vAnchor: 'text', hAnchor: 'text' }
      else delete pp.framePr
      editor.view?.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, paragraphProperties: pp }))
      refocus(); return true
    } catch { return false }
  }

  // ---- coverPage (documentPartObject content; replace existing) ----
  function xeCoverPage(name: string): boolean {
    try {
      // Remove an existing cover (the first documentPartObject) so we never stack two.
      let removeRange: { from: number; to: number } | null = null
      editor.state.doc.descendants((n: any, p: number) => {
        if (removeRange) return false
        if (n.type.name === 'documentPartObject') { removeRange = { from: p, to: p + n.nodeSize }; return false }
        return true
      })
      const title = (name && name.trim()) ? name : 'Document Title'
      const year = new Date().getFullYear()
      const cover = {
        // id MUST be a non-empty STRING — the docPartObj exporter's sanitizeId drops a numeric id,
        // emitting no <w:id> (lower fidelity in Word). Plan critique fix.
        type: 'documentPartObject',
        attrs: { id: 'wc-cover-' + (Date.now() % 1000000), docPartGallery: 'Cover Pages', docPartUnique: true },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: title, marks: [{ type: 'bold' }] }] },
          { type: 'paragraph', content: [{ type: 'text', text: '[Subtitle]' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '[Author Name] — ' + year }] },
        ],
      }
      let tr = editor.state.tr
      if (removeRange) tr = tr.delete(removeRange.from, removeRange.to)
      // Insert at the document start (pos 0 is before the first block; insertContent at 0).
      tr = tr.insert(0, editor.state.schema.nodeFromJSON(cover))
      editor.view?.dispatch(tr)
      refocus(); toast('Cover page "' + (name || 'Cover') + '" inserted.'); return true
    } catch { return false }
  }
  // Remove the current cover (re-points the legacy "Remove Current Cover Page" — the leak the
  // E().insert/WC.Insert. audit grep misses, since removeCover mutates via E().dirty/repaginate).
  function xeRemoveCoverPage(): boolean {
    try {
      let range: { from: number; to: number } | null = null
      editor.state.doc.descendants((n: any, p: number) => {
        if (range) return false
        if (n.type.name === 'documentPartObject') { range = { from: p, to: p + n.nodeSize }; return false }
        return true
      })
      if (!range) { toast('No cover page found.'); return false }
      editor.view?.dispatch(editor.state.tr.delete(range.from, range.to))
      refocus(); toast('Cover page removed.'); return true
    } catch { return false }
  }

  // ---- dateTime + quickParts (real fields) ----
  function xeDateTime(fmt: string): boolean {
    const f = (fmt && String(fmt).trim()) || 'M/d/yyyy'
    const ok = insertField('DATE \\@ "' + f + '"')
    if (ok) toast('Date field inserted (updates on F9 / open).')
    return ok
  }
  function xeQuickPart(kind: string): boolean {
    const MAP: Record<string, string> = {
      page: 'PAGE', numpages: 'NUMPAGES', date: 'DATE \\@ "M/d/yyyy"', author: 'AUTHOR',
      filename: 'FILENAME', title: 'DOCPROPERTY Title',
    }
    const instr = MAP[String(kind)] || String(kind).toUpperCase()
    return insertField(instr)
  }

  // ---- images (screenshot / icons / online pictures) ----
  async function xeScreenshot(): Promise<boolean> {
    try {
      if (!w.wordAPI?.screenshot) { toast('Screenshot capture is not available in this build.'); return false }
      const r = await w.wordAPI.screenshot()
      if (!(r && r.ok && r.dataUrl)) { toast('Screenshot ' + (r && r.error ? 'failed: ' + r.error : 'canceled') + '.'); return false }
      return pm()?.insertImage?.({ src: r.dataUrl, alt: 'Screenshot' }) === true
    } catch { return false }
  }
  function xeIcon(name: string): boolean {
    try {
      const svg = w.WC?.icon?.(name || 'save', 64)
      if (!svg) { toast('Icon not found.'); return false }
      const src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      return pm()?.insertImage?.({ src, alt: 'Icon: ' + name, width: 32, height: 32 }) === true
    } catch { return false }
  }
  async function xeOnlinePicture(): Promise<boolean> {
    try {
      if (!w.wordAPI?.pickImage) { toast('Online image search is unavailable — pick a local image instead.'); return false }
      toast('Online image search is unavailable in this clone — choose a local image.')
      const r = await w.wordAPI.pickImage()
      if (!(r && r.ok && r.dataUrl)) return false
      return pm()?.insertImage?.({ src: r.dataUrl, alt: r.name || 'Picture' }) === true
    } catch { return false }
  }

  // ---- textBox (editable VML) + WordArt (real DrawingML) ----
  function xeTextBox(text: string): boolean {
    try { const ok = editor.commands.insertTextBox({ text: text || 'Text' }); refocus(); return ok === true } catch { return false }
  }
  function xeWordArt(text: string, opts: any): boolean {
    try { const ok = editor.commands.insertWordArt({ text: text || 'WordArt', ...(opts || {}) }); refocus(); return ok === true } catch { return false }
  }

  // ---- onlineVideo (honest degrade: real link + toast) ----
  function xeOnlineVideo(url: string): boolean {
    const u = String(url || '').trim()
    if (!u) return false
    const ok = pm()?.insertLink?.({ href: u, text: u }) === true
    if (ok) toast('Inserted a link to the video — embedded playback lands at Phase 7.')
    return ok
  }

  // ---- honest-degrade no-op toasts (no fork construction path; recorded follow-ups) ----
  function xeChart(): boolean { toast('Charts (live c:chartSpace + data) need a chart subsystem — available in a future update.'); return true }
  function xeSmartArt(): boolean { toast('SmartArt (dgm: diagrams) needs a diagram subsystem — available in a future update.'); return true }
  function xeObject(): boolean { toast('Embedding OLE objects needs a host runtime — not available in this clone.'); return true }
  function xeSignatureLine(): boolean { toast('Signature lines need the signature-provider subsystem — available in a future update.'); return true }

  // NOTE: xeScreenshot/xeOnlinePicture/xeObject are reserve/test verbs — no live ribbon path invokes
  // them (screenshot re-points to PM.insertImage directly; onlinePictures is a toast-only phantom; the
  // object OLE branch is a non-mutating toast). They're exercised by the [10ex] degrade test only.
  return {
    xeDropCap, xeCoverPage, xeRemoveCoverPage, xeDateTime, xeQuickPart,
    xeScreenshot, xeIcon, xeOnlinePicture,
    xeTextBox, xeWordArt, xeOnlineVideo,
    xeChart, xeSmartArt, xeObject, xeSignatureLine,
  }
}
```

> Build-verify: `editor.commands.insertTextBox`/`insertWordArt` exist after Tasks 1-2; `editor.doc.fields.insert` is the
> references.ts path; `pm().insertImage`/`insertLink` are the slice-6 verbs (installed before this module in the Object.assign
> order — available at user-interaction time). `tr.insert(0, node)` inserts a block before the first block (pos 0). If the cover
> insert at pos 0 mis-nests, fall back to `editor.commands.insertContentAt(0, coverJSON)`.

- [ ] **Step 2: Wire `bridge/index.ts`** (NOT the FLIP):
  - (a) Import after `installDesign` (index.ts:13): `import { installInsertExotica } from './insert-exotica'`
  - (b) Pre-mount stubs after the design stubs (index.ts:362):
```ts
    // slice 10 PR3: insert-exotica pre-mount stubs (replaced by installInsertExotica on mount)
    xeDropCap: () => false, xeCoverPage: () => false, xeRemoveCoverPage: () => false, xeDateTime: () => false, xeQuickPart: () => false,
    xeScreenshot: async () => false, xeIcon: () => false, xeOnlinePicture: async () => false,
    xeTextBox: () => false, xeWordArt: () => false, xeOnlineVideo: () => false,
    xeChart: () => false, xeSmartArt: () => false, xeObject: () => false, xeSignatureLine: () => false,
```
  - (c) Append `installInsertExotica(editor)` to the `Object.assign` (index.ts:396):
```ts
  Object.assign(PM, commands, installIo(editor), installStylePreview(editor), installClipboard(editor), installSearch(editor), installInsert(editor), installTable(editor), installReview(editor, commands.cmd), installReferences(editor), installMailMerge(editor), installDesign(editor), installInsertExotica(editor))
```

- [ ] **Step 3: Build + run the suite — the engine-half `[10ex]` tests now PASS (FLIP test still red).**
Run: `npm run build && npm run test:pm`
Expected: `[10ex]` export/round-trip tests PASS (the tests call `PM().xe*` directly); `[10ex] D6 flip` STILL FAILS (Task 5); 299 prior green.
If `xeTextBox`/`xeWordArt` exports fail, debug the synthesized OOXML (probe `exportDocumentXml()`); the doc-replacing round-trip tests confirm reimport.

- [ ] **Step 4: Commit.**
```bash
git add src/renderer/bridge/insert-exotica.ts src/renderer/bridge/index.ts
git commit -m "feat(insert): bridge/insert-exotica.ts — exotic inserts on the PM engine (real framePr/fields/images/textbox/wordart; honest degrades)"
```

---

### Task 4: Re-point the legacy entry points (legacy ELSE byte-identical)

**Files:** Modify `src/renderer/public/js/insert-features.js` + `src/renderer/public/js/commands.js`.

The established pattern (F9): at the top of each legacy mutation, add the PM guard + `return` BEFORE the unchanged
legacy `E().insertHTML(...)` line. In `insert-features.js` use the inline accessor
`const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;`; in `commands.js` use the
`PMA()` helper (commands.js:11). Guarding INSIDE the `WC.Insert.*` method covers BOTH dispatch paths (F1) at once.

- [ ] **Step 1: `insert-features.js` re-points** — for each, insert the PM branch immediately before the legacy line:

| Method (line) | PM branch (inserted before the legacy `E()` line) |
|---|---|
| `Insert.insertCover` (~:33, before `E().insertNodeHTML`) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeCoverPage(t.name); return; }` |
| `Insert.removeCover` (~:44) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeRemoveCoverPage(); return; }` (the leak the audit grep missed) |
| `Insert.iconsPicker` cell click (~:178) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { dlg.close(); pm.xeIcon(n); return; }` |
| `Insert.insertSmartArt` (~:191) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeSmartArt(); return; }` |
| `Insert.chartDialog` OK onClick (~:211) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeChart(); return; }` |
| `Insert.dateTimeDialog` OK onClick (~:240) | preserve the picked format: `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeDateTime(['MMMM d, yyyy','M/d/yyyy','yyyy-MM-dd','dddd, MMMM d, yyyy','h:mm AM/PM','M/d/yyyy h:mm AM/PM'][+list.value] || 'M/d/yyyy'); return; }` |
| `Insert.insertWordArt` (~:259) | after `txt` is computed, preserve the preset color: `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { const mc = /color:\s*(#[0-9a-fA-F]{3,6})/.exec(style); pm.xeWordArt(txt, { color: mc ? mc[1] : '#2B579A' }); return; }` |
| `Insert.signatureLine` OK onClick (~:270) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeSignatureLine(); return; }` |
| `Insert.insertField` (~:298) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeQuickPart(k); return; }` |
| `Insert.textFromFile` (~:391, after `r.ok`) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.pasteHTMLString(WC.Files.sanitize(r.html)); WC.toast('Inserted contents of ' + r.name); return; }` |
| `Insert.onlineVideoDialog` Insert onClick (~:396) | place the guard AFTER the existing `if (u === '#') return;` line: `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.xeOnlineVideo(u); return; }` (a rejected '#' URL is dropped in PM too) |
| `Insert.screenshot` (~:403, after `r.ok`) | `const pm = (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null; if (pm) { pm.insertImage({ src: r.dataUrl, alt: 'Screenshot' }); return; }` |

(The legacy lines stay byte-identical as the ELSE fall-through.)

- [ ] **Step 2: `commands.js` re-points** (4 sites — `H.textBox`, `H.dropCap`, the `dropCapMenu` items, local `insertWordArt`). Each keeps its legacy body BYTE-IDENTICAL as the ELSE fall-through (frozen 257 gate, K5):

  - **`H.textBox` (commands.js:213)** — guard before the legacy `insertHTML`. Replace the whole line with (legacy string copied BYTE-EXACT from :213 — `border:1px solid #888;padding:8px;margin:6px 0;display:inline-block;min-width:200px`; do NOT invent new CSS):
    ```js
    H.textBox = () => { const pm = PMA(); if (pm) { pm.xeTextBox(''); return; } E().insertHTML('<div style="border:1px solid #888;padding:8px;margin:6px 0;display:inline-block;min-width:200px">Text box — type here</div>&nbsp;'); };
    ```

  - **`H.dropCap` (commands.js:214)** — the bare ribbon-button path (`H.dropCap = () => dropCap();`). The dropCapMenu items below also call `H.dropCap()`, so guard the lambda itself with the default 'drop' (3 lines). Replace the line with:
    ```js
    H.dropCap = () => { const pm = PMA(); if (pm) { pm.xeDropCap('drop', 3); return; } dropCap(); };
    ```

  - **`dropCapMenu` items (commands.js:263-268)** — the three flyout items currently map: `'None'` → inline float-span unwrap; `'Dropped'` → `H.dropCap()`; `'In Margin'` → `H.dropCap()` (both 'Dropped' and 'In Margin' hit the SAME legacy `dropCap()`, so the margin distinction only exists in PM mode). Add a PM branch to each item's `onClick` BEFORE its legacy body, so the kind is explicit:
    ```js
    fly.appendChild(WC.flyItem('None', { onClick: () => { const pm = PMA(); if (pm) { pm.xeDropCap('none', 0); return; } const b = E().selectedBlocks()[0]; if (b) { const s = b.querySelector('span[style*="float:left"]'); if (s) s.replaceWith(...s.childNodes); } } }));
    fly.appendChild(WC.flyItem('Dropped', { onClick: () => { const pm = PMA(); if (pm) { pm.xeDropCap('drop', 3); return; } H.dropCap(); } }));
    fly.appendChild(WC.flyItem('In Margin', { onClick: () => { const pm = PMA(); if (pm) { pm.xeDropCap('margin', 3); return; } H.dropCap(); } }));
    ```
    (The `'None'`/`'Dropped'`/`'In Margin'` legacy bodies stay byte-identical after the guard. `xeDropCap('none', 0)` clears `framePr`; the `lines` arg is ignored for 'none' — see insert-exotica.ts `xeDropCap`.)

  - **Local `insertWordArt()` (commands.js:2019-2023)** — insert the guard as the FIRST statement of the function body, mirroring the legacy text extraction (`const sel = window.getSelection(); const txt = (sel && sel.toString()) || 'Your text here';`) so the same text reaches WordArt:
    ```js
    function insertWordArt() {
      const sel = window.getSelection();
      const txt = (sel && sel.toString()) || 'Your text here';
      const pm = PMA(); if (pm) { pm.xeWordArt(txt, {}); return; }
      E().insertHTML(`<span style="font:bold 36pt Calibri;color:#2B579A;text-shadow:1px 1px 2px rgba(0,0,0,.3)">${WC.escapeHtml(txt)}</span>`);
    }
    ```
    (Legacy `E().insertHTML(...)` body stays byte-identical.)

- [ ] **Step 3: Build + gates (insert-exotica still NOT flipped — re-points dormant):**
Run: `npm run build && npm run test:pm && npm run test:legacy`
Expected: `test:pm` unchanged (FLIP test still red; re-points dormant pre-flip). `test:legacy` **257/257 byte-identical**.

- [ ] **Step 4: Commit.**
```bash
git add src/renderer/public/js/insert-features.js src/renderer/public/js/commands.js
git commit -m "refactor(insert): re-point WC.Insert exotica entry points to the PM bridge (legacy ELSE byte-identical)"
```

---

### Task 5: THE FLIP + leak audit

**Files:** Modify `src/renderer/bridge/index.ts` (add `'insert-exotica'` to `FLIPPED`).

- [ ] **Step 1: THE FLIP (index.ts:44)** — replace the `FLIPPED` set's tail `…, 'mail-merge', 'themes'])` with `…, 'mail-merge', 'themes', 'insert-exotica'])`.

- [ ] **Step 2: Leak audit** — grep + verify every exotica-cmd mutation is PM-guarded. Two greps: the first catches `insertHTML`/`insertNodeHTML` + the `WC.Insert.*` methods; the SECOND catches the non-`insert` doc mutators — `dropCap()` dirties via `E().dirty`/`E().repaginate()`, NOT an `insert` call, so the first grep alone misses it (the critique gap):
```bash
rg -n "E\(\)\.insert|WC\.Insert\." src/renderer/public/js/insert-features.js src/renderer/public/js/commands.js | rg -i "cover|icon|smart|chart|date|wordart|signature|field|textfrom|video|screenshot|textBox|dropCap"
rg -n "E\(\)\.(dirty|repaginate|insertHTML|insertNodeHTML)" src/renderer/public/js/commands.js | rg -i "dropcap|wordart|textbox"
```
Confirm each exotica mutation site sits behind a PM-branch+`return` (so in PM mode the legacy `E()` line is unreachable); the bare `H.textBox`/`H.dropCap`/local `insertWordArt()`/`dropCapMenu` items are guarded in Task 4. **Specifically verify `dropCap()` (commands.js:2024-2042) is unreachable in PM mode** — it has no internal guard, but its only callers (`H.dropCap` + the two dropCapMenu items) all PM-branch BEFORE calling it, so it never runs in PM mode. `onlinePictures` is a phantom (toast — nothing to re-point). Document the audit (both greps + the dropCap-reachability finding) in the commit body.

- [ ] **Step 3: Build + FULL PM suite green.** `npm run build && npm run test:pm` — ALL 11 `[10ex]` PASS including `[10ex] D6 flip`; prior 299 unchanged → PM total **310** (299 + 11).

- [ ] **Step 4: Commit.**
```bash
git add src/renderer/bridge/index.ts
git commit -m "feat(insert): THE FLIP — insert-exotica onto the PM engine + leak audit

Adds 'insert-exotica' to FLIPPED. Leak audit clean: every exotica mutation is PM-guarded
(return before the legacy WC.Insert/E() line); no reachable legacy mutation in PM mode."
```

---

### Task 6: Six gates + oracle vs Word 16 + checkpoint + PR

**Files:** Modify `docs/plan/*` + `docs/superpowers/plans/notes/*` (plan-tracking skill).

- [ ] **Step 1: Six gates green** (build first): `test:pm` (310), `test:legacy` (257 byte-identical), `test:smoke` + `test:smoke:legacy` (9/9 ×2), `test:roundtrip` (27/0), `test:docx` (17/0). Idle machine.

- [ ] **Step 2: Visual verify in the built app** — `npm start`; Insert tab → dropCap, coverPage (a cover block at the top), textBox (an editable bordered box — type into it), WordArt (flat styled text, honest non-editable per K2), dateTime/quickParts (a field). Screenshot into `.oracle-probes/slice10-exotica/`. **Two known in-app render gaps to confirm + record (the EXPORT is correct in both — this is in-app paint only):**
  - **dropCap 'Dropped' does NOT visibly drop in-app** — the fork's `dropcapPlugin.js:64` only paints `framePr.dropCap === 'margin'` (F2); `'drop'` exports a real `<w:framePr w:dropCap="drop">` (renders in Word) but shows as a normal paragraph in-app. `'In Margin'` renders in-app. Note honestly; do NOT treat the un-dropped 'Dropped' as a regression.
  - **xeIcon embeds an `image/svg+xml` data URL** — it renders in-app (the clone NodeView paints SVG) but Word may not show an SVG `w:drawing` without a raster `a:blip` fallback (Word's SVG support needs the `asvg`/`svgBlip` extension + a PNG fallback). The Leg-A oracle (Step 3) is the real gate for whether the icon survives Word's resave; if Word drops/blanks it, record an icon-rasterization follow-up (do NOT block the flip — icons are a minor verb).

- [ ] **Step 3: Oracle vs Word for Windows 16.0** (PID-safe, foreground, unsandboxed) — author a doc with a textBox + WordArt + dropCap paragraph + coverPage + a DATE field (an authoring probe like `scripts/oracle-probe-slice10-themes.js`, saved via `wordAPI.saveBytes`), then:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1 roundtrip C:\tmp\wc-slice10-exotica-clone.docx C:\tmp\wc-slice10-exotica-resaved.docx
```
- **Leg A (clone→Word):** ROUNDTRIP_OK (no repair). Inspect the resaved docx (unzip + grep): `v:textbox`/`w:txbxContent` (textbox), `wps:wsp`+`fromWordArt`+`a:prstTxWarp` (WordArt — or Word's canonicalization of it), `w:framePr w:dropCap` (dropCap), `w:sdt`/docPartObj (coverPage), DATE `fldChar` survive Word's resave. Computer-Use: open in live Word → textbox editable, WordArt shows warped, dropCap renders.
- **Leg B (Word→clone):** the `[10ex] IMPORT round-trip` tests pin clone-authored round-trip; this leg confirms Word's own serialization imports (author a textbox + WordArt in Word → `PM().openDocx`).

Write verdicts to `docs/superpowers/plans/notes/2026-06-13-slice10-exotica-oracle.json` + commit the probe(s).

- [ ] **Step 4: Checkpoint (plan-tracking skill)** — append a dated `last-point.md` entry; tick `execution-map.md` Daily log; advance the banner to "slice 10 PR3 (insert-exotica) DONE → PR4 draw next"; record the ledger deviations in `deferrals.md`:
  - **WordArt non-editable + flat in-app** (K2) — EXPORT is real warped DrawingML; the in-app SVG NodeView paints flat text, no warp; not editable in-app.
  - **dropCap 'drop' not painted in-app** — fork `dropcapPlugin` only renders `framePr.dropCap === 'margin'`; `'drop'` exports correctly (real `w:framePr`, renders in Word) but shows flat in-app. In-app paint follow-up.
  - **xeIcon SVG-only `w:drawing`** — embeds an `image/svg+xml` data URL with no raster `a:blip` fallback; renders in-app, Word-survival pending Leg-A oracle (icon-rasterization follow-up if Word drops it).
  - **chart / smartart / object(OLE) / signatureLine** — no construction path (honest toast) — subsystem follow-ups.
  - **onlineVideo** — real hyperlink only, no `wp15:webVideoPr` embedded-playback (Phase-7 follow-up).
  - **online image search / icon cloud library** — non-replicable cloud backend (honest local-pick degrade).
  Commit.

- [ ] **Step 5: PR into `main`, merge, delete branch, refresh graph** via the `/graphify` skill (fork excluded).

---

## §5. Definition of done

- Area `insert-exotica` FLIPPED; all 14 cmds dispatch to `bridge/insert-exotica.ts` in PM mode; legacy ELSE byte-identical.
- Real OOXML that round-trips: dropCap `w:framePr`, coverPage `w:sdt`/docPartObj, dateTime/quickParts `w:fldChar` fields,
  screenshot/icons/pictures `w:drawing` images, textBox editable `v:textbox`, WordArt `wps:wsp`+`prstTxWarp`+w14.
- chart/smartart/object(OLE)/signatureLine/onlineVideo degrade honestly (no leak, no false-success), recorded in deferrals.md.
- Six gates green (PM 310, legacy 257 byte-identical, smoke 9/9 ×2, roundtrip 27/0, docx 17/0). Oracle Leg A PASS (+ Leg B).
- 2 fork edits NOTICE'd. Plan docs checkpointed. PR merged. Graph refreshed.

## §6. Execution order (one commit each, subagent-driven w/ two-stage review)

1. Task 0 — red `[10ex]` tests.
2. Task 1 — fork `insertTextBox` (NOTICE'd).
3. Task 2 — fork `insertWordArt` + `synthesizeWordArtDrawing` + `isWordArt` attr (NOTICE'd).
4. Task 3 — `bridge/insert-exotica.ts` + index.ts wiring (NOT the flip) → engine-half `[10ex]` green.
5. Task 4 — re-point WC.Insert/commands.js (legacy ELSE byte-identical) — dormant until the flip.
6. Task 5 — THE FLIP + leak audit → full `[10ex]` green.
7. Task 6 — six gates + oracle + checkpoint + PR.



