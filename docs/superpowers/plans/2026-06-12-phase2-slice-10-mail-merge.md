# Phase-2 Slice-10 Mail-Merge Implementation Plan (PR 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Hardened:** authored from verbatim source (4-reader gather) + 3-critic adversarial pass (claims-vs-code · design-holes · consistency). All blocker/major amendments folded in; refuted worries annotated.

**Goal:** Flip the Mailings ribbon area onto the PM engine with **maximal real-MS-Word fidelity** — merge fields are real Word `MERGEFIELD` field codes that round-trip both directions (clone↔Word), and the full mail-merge workflow (recipient list, per-record preview, highlight, rule fields, Finish & Merge to a new document) runs on the PM page.

**Architecture:** The clone's mail-merge engine + recipient/match data model **stay clone-owned** (spec §9.3 carve-out); only the *document-mutation* calls move to a new `bridge/mail.ts` over the fork's mounted **`FieldAnnotation`** node. New fork work, both directions: export branches `translateFieldAnnotation` to emit real field OOXML (`w:fldSimple` for MERGEFIELD/GREETINGLINE, `w:fldChar` for ADDRESSBLOCK, 3-run `w:fldChar` for NEXT); import adds a `MERGEFIELD` field preprocessor + a `NodeTranslator`-based `sd:mergeField` → `fieldAnnotation` translator **plus** a `generateV2HandlerEntity` wired into `docxImporter.js` (flag-independent of `editor.options.annotations`). Every fork edit is NOTICE'd.

**Tech Stack:** Electron + vendored ProseMirror fork (SuperDoc), TypeScript bridge (`src/renderer/bridge/`), vanilla-JS legacy chrome (`src/renderer/public/js/`), `scripts/test-suite-pm.js`, `scripts/oracle/word-oracle-win.ps1` (Word-for-Windows-16 COM oracle), `scripts/docx-inspect.js`.

---

## 0. Pre-verified facts (source-grounded — verified by the gather + critique)

**Fork `FieldAnnotation` node (mounted via `getStarterExtensions()` → `extensions/index.js:184`, `create-editor.ts:43`):**
- `field-annotation.js:17-32` — node `fieldAnnotation`, `group:'inline'`, `inline:true`, `atom:true`.
- attrs (`:55-207`): `type` (default `'text'`), `fieldType` (null), `displayLabel`, `defaultDisplayLabel`, `fieldId`, `fieldColor` ('#980043'), `highlighted` (true, `rendered:false`), `hidden`, `visibility`.
- renderDOM (`:345-365`): a merge field renders as `<span class="annotation" data-field-type="MERGEFIELD" data-display-label="«Name»">…«Name»…</span>` — **NOT** the legacy `<span class="wc-mergefield" data-field="Name">`. (Load-bearing for the PM finish-merge builder, K-9.)
- commands (**all return `true` even on no-op — check node counts, K-1**): `addFieldAnnotationAtSelection(attrs={}, editorFocus=false)` (`:488`, inserts at `state.selection.from`, ignores selection range); `updateFieldAnnotations(fieldIdOrArray, attrs={})` (`:667`, non-destructive `tr.setNodeMarkup`, `:719-742`); `setFieldAnnotationsHighlighted(predicate, highlighted=true)` (`:963`); `setFieldAnnotationsHiddenByCondition(predicate, unsetFromOthers=false)` (`:868`).

**Bridge install pattern (copy `bridge/insert.ts`):** `installX(editor)` returns a verb object; verbs do `const ok = editor.commands.X(...); refocus(); return ok !== false` (`insert.ts:400-402`, `table.ts:42-49`). `editor.commands.X` getter (`Editor.ts:1776`). `index.ts:381` `Object.assign(PM, …)`; `index.ts:307-312` pre-install stubs (one `()=>false` per verb). **VERIFIED:** `PM.openHtml` exists live (`index.ts:394`) + stubbed (`:278`); `PM.isFlipped`/`AREA`/`FLIPPED` exposed (`:263-264`).

**Export path (`PM node → docx`):** router `exporter.js:219` `fieldAnnotation: wSdtNodeTranslator` → `sdt-translator.js:47` → `translateFieldAnnotation` (`translate-field-annotation.js:17-106`, builds `w:sdt`; destructures `isFinalDoc` at `:18`, early-returns the bare handler at `:35-36`). `getTranslationByAnnotationType(attrs.type, attrs.fieldType)` (`:114-140`) returns `prepareTextAnnotation` for `type:'text'` (truthy → the `!annotationHandler` guard at `:21` never fires for merge fields — **VERIFIED**). Reusable builder `build-complex-field-runs.js:21-70` `buildComplexFieldRuns({instruction, cachedText, outputMarks, dirty})` (**always 5 runs**: begin/instrText/separate/cachedText/end; adds a leading space to the instruction). **VERIFIED (refuted K-3 worry):** a translator may return an ARRAY of `w:r` runs at the inline `fieldAnnotation` slot — `translateChildNodes.js:44` spreads array returns into paragraph children (`if (translatedNode instanceof Array) translatedNodes.push(...translatedNode)`). **No wrapper needed; no existing `w:fldSimple` emitter — we author the first.**
- **Real Word target (`C:\tmp\wc-slice10-mergefields.docx`, document.xml):** `MERGEFIELD`/`GREETINGLINE` → `<w:fldSimple w:instr=" MERGEFIELD FirstName "><w:r><w:rPr><w:noProof/></w:rPr><w:t>«FirstName»</w:t></w:r></w:fldSimple>` (the `w:t` has **no** `xml:space`; the label has no edge whitespace). `ADDRESSBLOCK` → verbose 5-run `w:fldChar` begin/instrText/separate/`«AddressBlock»`(`w:rPr>w:noProof`)/end. `NEXT` → **3-run only** begin / instrText ` NEXT ` / end (**no `separate`, no result run**).

**Import path (`docx → PM node`) — THREE wiring points (critique blocker):**
- Stage-1 pre-process: `preProcessNodesForFldChar.js` (invoked `docxImporter.js:223`) collapses `w:fldChar` sequences AND `w:fldSimple` (`:138-154`) by keyword via `getInstructionPreProcessor` (`fld-preprocessors/index.js:415-456`). **Registering `MERGEFIELD` covers BOTH forms — VERIFIED.** A preprocessor returns an `sd:*` OpenXmlNode (`xe-preprocessor.js`).
- The `sd:*` → PM-node translator must be a **`NodeTranslator` instance**: `indexEntry-translator.js:108-121` → `export const config = { xmlName, sdNodeOrKeyName, type: NodeTranslator.translatorTypes.NODE, encode, decode }; export const translator = NodeTranslator.from(config);` (`decode` must be a function or `NodeTranslator.from` throws, `node-translator.js:206`).
- **The node-list dispatcher is a separate v2 handler entity, NOT the v3 `translatorList`.** `indexImporter.js:13` `generateV2HandlerEntity('indexEntryHandler', indexEntryTranslator)`; that entity is in `docxImporter.js`'s `defaultNodeListHandler` `entities` array (`~:346-353`, e.g. `indexEntryHandlerEntity` at `:349`), placed **before** `passthroughNodeHandlerEntity` (`:358`). Registering only in `v3/handlers/index.js` `translatorList` makes `passthroughNodeImporter.js:17` **refuse** the node (it skips anything in `registeredHandlers`) and nothing else handles it → dropped. **The handler entity is mandatory.**
- `handleAnnotationNode` (the `w:sdt`→fieldAnnotation builder) gates on `editor.options.annotations` which `constructPmEditor` never sets → **our dedicated `sd:mergeField` translator (encode → `{type:'fieldAnnotation', attrs}`) is flag-independent and is the correct path — VERIFIED (refuted K-2).**

**Legacy `WC.Mail` (`mailings-tools.js`, stays clone-owned, re-pointed):** data model `fields[]`/`recipients[]`/`matchMap`/`parseCSV` (`Mail._parseCSV`)/`_val`/`composite`. Doc-mutation methods that move to the bridge: `insertField` (`:74`, ALSO the sink for `__AddressBlock__`/`__GreetingLine__` via `:87/:109`), `previewResults` (`:148`, **destructive `E().setHTML`**), `fill` (`:143`, selects `.wc-mergefield` + reads `m.dataset.field`), `finishMerge('edit')` (`:170`, `WC.Files.newDocWith`), `envelopes`/`labels`/`updateLabels`, `highlightMergeFields` (`:121`).

**Ribbon (`commands.js`):** `PMA = () => (WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null)` (`:11`). Mail-merge `H.*` `:867-916` (flyout openers). `H.rules` block `:877-889` — its `insertField` closure `E().insertNodeHTML(<span … data-field-code=…>)` is at **`:878`**; `ifThenElseDialog` `:890-906`, its OK insert at **`:903`**. Split route `:1458-1459`. D6 guard heads `Commands.run` `:1354-1357` + `Commands.dropdown` `:1364-1366`.

**D6 registry (`bridge/index.ts`):** `FLIPPED` `:42` (mail-merge ABSENT). mail-merge AREA `:112-117`. Phase-7-gated AREAs `:125-135` (`margins`→`layout-page`, `header`→`header-footer`; both ABSENT from FLIPPED → stay blocked through slice 11 — **VERIFIED repoint targets**). `isBlocked = !!a && !FLIPPED.has(a)` (`:138`).

**Tests (`scripts/test-suite-pm.js`):** `t(name, fn)` — **string return = FAILURE** (`:4-13`). Helpers `PM()`/`doc()`/`setDoc`/`selectText`; **`caretAfter` defined at `:2201`**, **`exportDocumentXml` at `:1553`**, `exportParts` at `:2872` — so any test using them must sit AFTER those `const` declarations (temporal-dead-zone, critique major). Doc-replacing `openDocx` tests use `await sleep(300)` (the documented remount threshold, `:846-848`) and go LAST in their group (`:839-840`). `window.wordAPI.openBytes(path)` returns `{bytes}` (`:1970,3768`) — the real fixture is harness-readable. The two `[0a]` D6 guards `:161-179`.

---

## 1. Scope decisions (D10.x)

- **D10.1 — Reuse `FieldAnnotation`, no new PM node.** Merge fields are `fieldAnnotation` nodes (`type:'text'`, `fieldType` = the Word field code). Its `update`/`highlight`/`hideByCondition` commands back preview/highlight/rules.
- **D10.2 — Conventions.** `fieldId = 'mm-' + slug(name) + '-' + <docsize> + '-' + slug(label)` (unique per insert); `displayLabel = '«'+name+'»'` (= `defaultDisplayLabel`); `fieldType` = the field code verbatim; `type='text'`.
- **D10.3 — Export: branch `translateFieldAnnotation`**, placed right after `const { attrs = {} } = node;` (before `if (!annotationHandler) return {}` and before the `isFinalDoc` return, so it runs on both paths). Field-code → form:
  - `MERGEFIELD`, `GREETINGLINE` → `buildSimpleFieldElement(instr, cached)` = `{name:'w:fldSimple', attributes:{'w:instr':' '+instr+' '}, elements:[{name:'w:r', elements:[{name:'w:rPr', elements:[{name:'w:noProof'}]}, {name:'w:t', elements:[{type:'text', text:cached}]}]}]}`. **No `xml:space`** (`«Name»` has no edge whitespace — exact oracle parity, critique).
  - `ADDRESSBLOCK` → `buildComplexFieldRuns({instruction:instr, cachedText:label, outputMarks:[{name:'w:noProof'}], dirty:false})` (5 runs; the `w:noProof` in `outputMarks` makes every run's `w:rPr` match Word's result run).
  - `NEXT`, `NEXTIF`, `MERGEREC`, `MERGESEQ`, `SET`, `ASK`, `SKIPIF` (no visible result) → new `buildEmptyComplexFieldRuns(instr)` = 3 runs only (begin / instrText / end), **no `separate`, no cached run** (matches real Word's NEXT, critique major).
  - Non-merge `fieldAnnotation`s (no recognized `fieldType`) fall through to the existing `w:sdt` path UNCHANGED — guarantees `test:roundtrip` 27/0.
- **D10.4 — Import: preprocessor + `NodeTranslator` + v2 handler entity (3 edits).** (a) `mergefield-preprocessor.js` → `{name:'sd:mergeField', type:'element', attributes:{instruction, instructionTokens?}, elements:nodesToCombine}`; register `MERGEFIELD`/`ADDRESSBLOCK`/`GREETINGLINE`/`NEXT`(+rule codes) in `fld-preprocessors/index.js`. (b) `sd/mergeField/mergeField-translator.js` via `NodeTranslator.from(config)` whose `encode` → `{type:'fieldAnnotation', attrs}` (flag-independent), `decode = () => null` + `sd/mergeField/index.js` barrel. (c) `mergefieldImporter.js` → `generateV2HandlerEntity('mergeFieldHandler', translator)` imported into `docxImporter.js` and inserted into the `defaultNodeListHandler` `entities` array BEFORE `passthroughNodeHandlerEntity`.
- **D10.5 — Recipient data + match stay clone-owned** in `WC.Mail` (unchanged); only doc-writes re-point.
- **D10.6 — Preview is non-destructive on PM.** `previewResults(on)` → `PM.mmPreview(valuesMap)` → `updateFieldAnnotations(fieldId, {displayLabel:<value>})` per field; OFF → `mmPreview(null)` restores `«name»`. NO `setHTML`. The field NAME survives because `mmPreview` reads `defaultDisplayLabel` (which `addFieldAnnotation` stamps once and never overwrites), not the live `displayLabel` (K-5).
- **D10.7 — Highlight via the node attr.** `PM.mmHighlight(on)` → `setFieldAnnotationsHighlighted(n => n.attrs.fieldType != null, on)`.
- **D10.8 — Finish & Merge → new document via the PM seam, PM-AWARE builder.** A new `PM.mmBuildMerge(recipients, valueResolver)` builds the merged body **from the PM document** (`PM.getHTML()`), matching the PM annotation DOM (`span.annotation[data-field-type]`, name from `data-display-label`), substituting record values via the clone's `composite()`/`_val` (passed in as `valueResolver`), joined with page-break divs. `finishMerge('edit')` then loads it through `PM.openHtml(mergedHtml)` (doc-replacing seam, never legacy `WC.Files.newDocWith`). `'print'`/`'email'` keep graceful messages (ledger B).
- **D10.9 — Rule fields: structural export, semantics deferred (ledger C).** IF/FILLIN/ASK/SKIPIF/SET/MERGEREC/MERGESEQ/NEXT/NEXTIF insert as `fieldAnnotation`s and export as **structurally valid** field codes (the empty-complex form). **Word IF *evaluation* is NOT in scope** — the legacy `'IF «F» Equal to "v" …'` label is not Word's operator syntax (`=`/`<>`); operator mapping is deferred to ledger C. MERGEFIELD/GREETINGLINE/ADDRESSBLOCK/NEXT are the PR-1 *real-fidelity* core; rule fields round-trip as inert-but-valid fields (parity with the legacy engine, which never evaluated them).
- **D10.10 — envelopes/labels: real model now, visual Phase-7 (ledger A).** `envelopes` → real PM paragraphs; `labels` → real PM table (slice-6 table bridge) + `NEXT` fields; `updateLabels` propagates within the PM table guarded on a `wc-labels` marker. Page geometry = Phase 7. (Land as commit 5b if 5a grows large.)
- **D10.11 — `[0a]` D6 guard repoint.** `Commands.run` head → `margins` (`layout-page`); `Commands.dropdown` head → `header` (`header-footer`). In Task 1 (BEFORE the flip, K-6).
- **D10.12 — composite import data-loss is scoped (ledger C).** The import `encode` discards `node.elements` (cached runs) and reconstructs `displayLabel` from the instruction. For MERGEFIELD this is lossless. For a *previewed/merged* ADDRESSBLOCK/GREETINGLINE source the rendered multi-line text is replaced by the `«AddressBlock»` placeholder — recorded as a deviation (importing a placeholder field, not the merged text). Acceptable for slice 10; ledger-C entry required.

## 2. Risks (K-x)

- **K-1 (true on no-op):** verify inserts/updates by node count / attr assertions, never the boolean.
- **K-9 (finish-merge PM shape):** legacy `fill()` selects `.wc-mergefield` + reads the empty legacy editor — DEAD in PM. The PM-aware `mmBuildMerge` (D10.8) is mandatory; a `[10mm]` test must assert the merged doc contains the record VALUE, not `«placeholder»`.
- **K-10 (NEXT run-count):** `buildComplexFieldRuns` always emits 5 runs incl. a spurious `«Next Record»`; NEXT must use the 3-run `buildEmptyComplexFieldRuns` (D10.3).
- **K-2 (annotations flag):** avoided by the dedicated translator (VERIFIED). Add a `[10mm]` test that an imported MERGEFIELD is a `fieldAnnotation` node (not text).
- **K-4 (leak vectors):** every mail-merge flyout item + the `commands.js`-local rule inserts (`:878`, `:903`) must be PMA-re-pointed. Leak audit required.
- **K-5 (preview vs merge):** `mmPreview` reads `defaultDisplayLabel` for the name; finish-merge reads the template via `PM.getHTML()` (the `«name»` form) — turn preview OFF or read names before building.
- **K-6 (guard repoint timing):** the `[0a]` repoint (Task 1) lands before the flip (Task 5).
- **K-8 (legacy 257 frozen):** all re-points use `PMA() ? bridge : <verbatim legacy ELSE>`; under `--legacy` `PMA()` is null → byte-identical.
- **K-11 (composite import data-loss):** D10.12 — ledger-C entry.

## 3. File structure

**Fork (each edit NOTICE'd in `superdoc-fork/NOTICE.md`):**
- Modify `…/v3/handlers/w/sdt/helpers/translate-field-annotation.js` — D10.3 export branch + `buildSimpleFieldElement` + `buildEmptyComplexFieldRuns`.
- Create `…/field-references/fld-preprocessors/mergefield-preprocessor.js`; Modify `…/fld-preprocessors/index.js`.
- Create `…/v3/handlers/sd/mergeField/mergeField-translator.js` + `…/sd/mergeField/index.js` (barrel).
- Create `…/v2/importer/mergefieldImporter.js` (the `generateV2HandlerEntity`); Modify `…/v2/importer/docxImporter.js` (import + add to `entities`).

**Bridge:** Create `src/renderer/bridge/mail.ts`; Modify `src/renderer/bridge/index.ts` (import, `Object.assign`, stubs, `FLIPPED += 'mail-merge'`).

**Legacy chrome:** Modify `commands.js` (PMA re-points + `:878`/`:903`); Modify `mailings-tools.js` (re-point doc-writes + PM-aware merge builder glue; data model unchanged).

**Tests:** Modify `scripts/test-suite-pm.js` (`[0a]` repoint at `:161-179`; `[10mm]` block appended at END of suite).

**Notes:** Create `docs/superpowers/plans/notes/2026-06-12-slice10-mailmerge-oracle.json`; ledger entries in `docs/plan/deferrals.md`.

## 4. Tasks

> Each task = one commit. `npm run build` before any electron suite. Commit-style per `.claude/skills/commit-style/SKILL.md` (explicit `git add`, no AI trailer).

### Task 1: Red `[10mm]` tests + `[0a]` D6 guard repoint

**Files:** Modify `scripts/test-suite-pm.js`.

- [ ] **Step 1 — Repoint the two `[0a]` guards** (`:161-179`) off `startMailMerge`:

```js
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    // Repointed slice 10: startMailMerge flips this slice → run-block probe moves to
    // `margins` (AREA layout-page, Phase-7-gated, stays blocked through slice 11).
    window.WC.Commands.run({ cmd: 'margins', label: 'Margins' });
    return document.querySelectorAll('.flyout').length === 0 && !document.querySelector('.modal-backdrop');
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    // Repointed slice 10: `header` (AREA header-footer, Phase-7-gated, a dropdown control).
    window.WC.Commands.dropdown({ cmd: 'header', type: 'dropdown' }, document.body);
    const open = document.querySelectorAll('.flyout').length;
    window.WC.closeFlyouts();
    return open === 0;
  });
```

- [ ] **Step 2 — Append the `[10mm]` block at the END of the suite** (critique: AFTER the `caretAfter`(`:2201`)/`exportDocumentXml`(`:1553`)/`exportParts` declarations — place near the other late doc-replacing tests, e.g. after the `[9]` round-trip tests ~`:3850`, NOT near the `[0a]` guards — avoids the temporal-dead-zone `ReferenceError`). All RED until Tasks 2-5. The doc-replacing (`openDocx`/real-fixture) tests go LAST in the block, with `await sleep(300)` after `openDocx`:

```js
  // ===== [10mm] mail-merge (slice 10) — KEEP doc-replacing tests LAST in this block =====
  await t('[10mm] insertMergeField: fieldAnnotation node fieldType=MERGEFIELD + «name» label', () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (typeof PM().mmInsertField !== 'function') return 'PM.mmInsertField missing (red — bridge not installed)';
    if (PM().mmInsertField('FirstName') !== true) return 'mmInsertField refused (red)';
    let f = null; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType === 'MERGEFIELD') f = n; });
    if (!f) return 'no fieldAnnotation[fieldType=MERGEFIELD]';
    return f.attrs.displayLabel === '«FirstName»' || 'displayLabel was ' + JSON.stringify(f.attrs.displayLabel);
  });
  await t('[10mm] EXPORT: MERGEFIELD → w:fldSimple " MERGEFIELD FirstName " (not w:sdt)', async () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    const xml = await exportDocumentXml();
    if (/<w:sdt\b[^>]*>[\s\S]*MERGEFIELD/.test(xml)) return 'exported as w:sdt content control, not a field code';
    return /<w:fldSimple\b[^>]*w:instr="\s*MERGEFIELD FirstName\s*"/.test(xml) || 'no <w:fldSimple … MERGEFIELD FirstName>';
  });
  await t('[10mm] EXPORT: NEXT → 3-run w:fldChar (no separate, no «Next Record» result)', async () => {
    setDoc('A B'); caretAfter('A ');
    if (typeof PM().mmInsertRule !== 'function') return 'PM.mmInsertRule missing (red)';
    if (PM().mmInsertRule('NEXT', 'NEXT') !== true) return 'insert refused (red)';
    const xml = await exportDocumentXml();
    if (/«Next Record»/.test(xml)) return 'NEXT emitted a spurious «Next Record» result run';
    if (/<w:fldChar[^>]*w:fldCharType="separate"[\s\S]{0,400}NEXT/.test(xml)) return 'NEXT emitted a w:fldChar separate (should be 3-run)';
    return /NEXT/.test(xml) && /<w:fldChar[^>]*w:fldCharType="begin"/.test(xml) || 'no NEXT field code';
  });
  await t('[10mm] highlightMergeFields toggles the highlighted attr', () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    if (typeof PM().mmHighlight !== 'function') return 'PM.mmHighlight missing (red)';
    PM().mmHighlight(false); let off = true; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation') off = off && n.attrs.highlighted === false; });
    PM().mmHighlight(true); let on = true; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation') on = on && n.attrs.highlighted === true; });
    return (off && on) || 'highlighted did not toggle false→true';
  });
  await t('[10mm] preview substitutes record values into displayLabel (non-destructive)', () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    if (typeof PM().mmPreview !== 'function') return 'PM.mmPreview missing (red)';
    PM().mmPreview({ FirstName: 'Alice' });
    let shown = null; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType === 'MERGEFIELD') shown = n.attrs.displayLabel; });
    if (shown !== 'Alice') return 'preview value was ' + JSON.stringify(shown);
    PM().mmPreview(null);
    let back = null; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType === 'MERGEFIELD') back = n.attrs.displayLabel; });
    return back === '«FirstName»' || 'restore failed: ' + JSON.stringify(back);
  });
  await t('[10mm] finishMerge produces a doc with the record VALUE, not «placeholder» (K-9)', async () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('FirstName') !== true) return 'insert refused (red)';
    if (typeof PM().mmBuildMerge !== 'function') return 'PM.mmBuildMerge missing (red)';
    const html = PM().mmBuildMerge([{ FirstName: 'Alice' }], (field, rec) => rec[field] != null ? String(rec[field]) : '');
    if (typeof html !== 'string') return 'mmBuildMerge did not return html';
    if (/«FirstName»/.test(html)) return 'merged html kept the «FirstName» placeholder';
    return /Alice/.test(html) || 'merged html does not contain the record value Alice';
  });
  await t('[10mm] D6 flip: mail-merge is FLIPPED', () => PM().isFlipped('mail-merge') === true || 'mail-merge not in FLIPPED');
  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10mm] IMPORT (self round-trip): clone export reimports MERGEFIELD as a fieldAnnotation', async () => {
    setDoc('Dear , end'); caretAfter('Dear ');
    if (PM().mmInsertField('LastName') !== true) return 'insert refused (red)';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'export not a zip';
    const ok = await PM().openDocx(bytes); if (ok !== true) return 'reimport returned ' + JSON.stringify(ok);
    await sleep(300);
    let n = 0; doc().descendants((x) => { if (x.type.name === 'fieldAnnotation' && x.attrs.fieldType === 'MERGEFIELD') n++; });
    return n === 1 || 'expected 1 MERGEFIELD fieldAnnotation after reimport, got ' + n;
  });
  await t('[10mm] IMPORT (Leg B, real Word fixture): MERGEFIELD/GREETINGLINE/ADDRESSBLOCK/NEXT import as fieldAnnotations', async () => {
    const r = await window.wordAPI.openBytes('C:\\tmp\\wc-slice10-mergefields.docx');
    if (!r || !r.bytes) return 'fixture not readable (skip if absent on this machine)';
    const ok = await PM().openDocx(r.bytes); if (ok !== true) return 'openDocx returned ' + JSON.stringify(ok);
    await sleep(300);
    const types = new Set(); doc().descendants((n) => { if (n.type.name === 'fieldAnnotation' && n.attrs.fieldType) types.add(n.attrs.fieldType); });
    let firstName = false, last = false; doc().descendants((n) => { if (n.type.name === 'fieldAnnotation') { if (n.attrs.displayLabel === '«FirstName»') firstName = true; if (n.attrs.displayLabel === '«Last_Name»') last = true; } });
    if (!firstName || !last) return 'MERGEFIELD «FirstName»/«Last_Name» (underscore) not both imported';
    return (types.has('MERGEFIELD') && types.has('GREETINGLINE') && types.has('ADDRESSBLOCK') && types.has('NEXT')) || 'missing field types: ' + JSON.stringify([...types]);
  });
```

- [ ] **Step 3 — Run, verify RED.** `npm run build && npm run test:pm`: `[10mm]` FAIL (`PM.mm* missing`); the two `[0a]` PASS (margins/header blocked); other gates unaffected.
- [ ] **Step 4 — Commit.** `git add scripts/test-suite-pm.js` → `test(mail-merge): red [10mm] round-trip/preview/highlight/finish tests + repoint [0a] D6 guards off startMailMerge`.

### Task 2: Fork export — real `MERGEFIELD` field-code emitter

**Files:** Modify `translate-field-annotation.js`; modify `NOTICE.md`.

- [ ] **Step 1 — Add the builders + the merge-field branch** (top of `translateFieldAnnotation`, right after `const { attrs = {} } = node;`):

```js
import { buildComplexFieldRuns } from '../../../sd/build-complex-field-runs.js';

const SIMPLE_FIELD_CODES = new Set(['MERGEFIELD', 'GREETINGLINE']);
const EMPTY_FIELD_CODES = new Set(['NEXT', 'NEXTIF', 'MERGEREC', 'MERGESEQ', 'SET', 'ASK', 'SKIPIF']);
const COMPOSITE_FIELD_CODES = new Set(['ADDRESSBLOCK']);
const RULE_FIELD_CODES = new Set(['IF', 'FILLIN']);
const MERGE_FIELD_CODES = new Set([...SIMPLE_FIELD_CODES, ...EMPTY_FIELD_CODES, ...COMPOSITE_FIELD_CODES, ...RULE_FIELD_CODES]);

const NO_PROOF = [{ name: 'w:noProof' }];

function buildSimpleFieldElement(instruction, cachedText) {
  return {
    name: 'w:fldSimple',
    attributes: { 'w:instr': ` ${instruction} ` },
    elements: [{ name: 'w:r', elements: [{ name: 'w:rPr', elements: NO_PROOF }, { name: 'w:t', elements: [{ type: 'text', text: cachedText }] }] }],
  };
}
// 3-run control field (NEXT etc.): begin / instrText / end — no separate, no result.
function buildEmptyComplexFieldRuns(instruction) {
  const run = (child) => ({ name: 'w:r', elements: [{ name: 'w:rPr', elements: NO_PROOF }, child] });
  return [
    run({ name: 'w:fldChar', attributes: { 'w:fldCharType': 'begin' } }),
    run({ name: 'w:instrText', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: ` ${instruction} ` }] }),
    run({ name: 'w:fldChar', attributes: { 'w:fldCharType': 'end' } }),
  ];
}
function mergeFieldInstruction(attrs) {
  const code = attrs.fieldType;
  const label = attrs.displayLabel || attrs.defaultDisplayLabel || '';
  if (code === 'MERGEFIELD') { const name = label.replace(/^«|»$/g, '').trim() || 'Field'; return { instr: `MERGEFIELD ${name}`, cached: `«${name}»` }; }
  if (COMPOSITE_FIELD_CODES.has(code)) return { instr: code, cached: label };
  if (code === 'GREETINGLINE') return { instr: code, cached: label };
  // empty/rule: the instruction is the inside of "{ … }"
  const inner = label.replace(/^\{\s*|\s*\}$/g, '');
  return { instr: inner || code, cached: label };
}
```

and the branch:

```js
  if (attrs.fieldType && MERGE_FIELD_CODES.has(attrs.fieldType)) {
    const { instr, cached } = mergeFieldInstruction(attrs);
    if (SIMPLE_FIELD_CODES.has(attrs.fieldType)) return buildSimpleFieldElement(instr, cached);
    if (EMPTY_FIELD_CODES.has(attrs.fieldType)) return buildEmptyComplexFieldRuns(instr);
    // COMPOSITE (ADDRESSBLOCK) + RULE (IF/FILLIN) → 5-run w:fldChar with noProof result run
    return buildComplexFieldRuns({ instruction: instr, cachedText: cached, outputMarks: NO_PROOF, dirty: false });
  }
```

- [ ] **Step 2 — NOTICE** the branch (real Word field-code export vs the `w:sdt` default).
- [ ] **Step 3 — Run `test:pm`.** `[10mm] EXPORT` (MERGEFIELD) + `[10mm] EXPORT NEXT` PASS; IMPORT still RED. Run `test:roundtrip` — non-merge field annotations must still emit `w:sdt` (27/0 unchanged).
- [ ] **Step 4 — Commit.** `feat(mail-merge): export merge fields as real Word field codes (w:fldSimple / 3-run + 5-run w:fldChar)`.

### Task 3: Fork import — preprocessor + `NodeTranslator` + handler entity

**Files:** Create `mergefield-preprocessor.js`; modify `fld-preprocessors/index.js`; create `sd/mergeField/{mergeField-translator.js,index.js}`; create `v2/importer/mergefieldImporter.js`; modify `docxImporter.js`; modify `NOTICE.md`.

- [ ] **Step 1 — Preprocessor** (`mergefield-preprocessor.js`, mirror `xe-preprocessor.js`):

```js
export function preProcessMergefieldInstruction(nodesToCombine, instrText, _docx, instructionTokens = null) {
  return [{ name: 'sd:mergeField', type: 'element', attributes: { instruction: (instrText || '').trim(), ...(instructionTokens ? { instructionTokens } : {}) }, elements: nodesToCombine }];
}
```

- [ ] **Step 2 — Register the keywords** in `fld-preprocessors/index.js` (import + `case` lines before `default`):

```js
import { preProcessMergefieldInstruction } from './mergefield-preprocessor.js';
//   case 'MERGEFIELD': case 'ADDRESSBLOCK': case 'GREETINGLINE': case 'NEXT':
//   case 'NEXTIF': case 'MERGEREC': case 'MERGESEQ': case 'IF': case 'FILLIN':
//   case 'ASK': case 'SET': case 'SKIPIF':
//     return preProcessMergefieldInstruction;
```

- [ ] **Step 3 — `NodeTranslator` translator** (`sd/mergeField/mergeField-translator.js`, mirror `indexEntry-translator.js:108-121` EXACTLY):

```js
import { NodeTranslator } from '@translator';

function parseInstruction(instr) {
  const trimmed = (instr || '').trim();
  const code = trimmed.split(/\s+/)[0] || 'MERGEFIELD';
  if (code === 'MERGEFIELD') { const name = trimmed.slice('MERGEFIELD'.length).trim().replace(/^"|"$/g, '') || 'Field'; return { code, label: `«${name}»`, name }; }
  if (code === 'ADDRESSBLOCK') return { code, label: '«AddressBlock»', name: 'AddressBlock' };
  if (code === 'GREETINGLINE') return { code, label: '«GreetingLine»', name: 'GreetingLine' };
  if (code === 'NEXT') return { code, label: '«Next Record»', name: 'Next' };
  return { code, label: `{ ${trimmed} }`, name: code };
}
const encode = (params) => {
  const node = (params?.nodes || [])[0];
  const { code, label, name } = parseInstruction(node?.attributes?.instruction);
  return { type: 'fieldAnnotation', attrs: { type: 'text', fieldType: code, fieldId: `mm-${name}-${(node?.attributes?.instruction || '').length}`, displayLabel: label, defaultDisplayLabel: label } };
};
// Export goes via translate-field-annotation.js (PM node is fieldAnnotation) → decode unused.
const decode = () => null;
export const config = { xmlName: 'sd:mergeField', sdNodeOrKeyName: 'fieldAnnotation-mergeField', type: NodeTranslator.translatorTypes.NODE, encode, decode };
export const translator = NodeTranslator.from(config);
```

> `sdNodeOrKeyName` is a UNIQUE key (`'fieldAnnotation-mergeField'`) to avoid a decode-routing collision with the `w:sdt` translator's `'fieldAnnotation'` (export uses `translate-field-annotation.js`, not this decode). `sd/mergeField/index.js` = `export * from './mergeField-translator.js'`.

- [ ] **Step 4 — Handler entity** (`v2/importer/mergefieldImporter.js`, mirror `indexImporter.js:13`):

```js
import { generateV2HandlerEntity } from '../../v3/handlers/utils.js';
import { translator as mergeFieldTranslator } from '../../v3/handlers/sd/mergeField/mergeField-translator.js';
export const mergeFieldHandlerEntity = generateV2HandlerEntity('mergeFieldHandler', mergeFieldTranslator);
```

- [ ] **Step 5 — Wire into `docxImporter.js`.** Import `mergeFieldHandlerEntity` and add it to the `defaultNodeListHandler` `entities` array near `indexEntryHandlerEntity` (`~:349`), BEFORE `passthroughNodeHandlerEntity` (`:358`). (Verify exact import path/paths during impl — the gather notes the registry shapes.)
- [ ] **Step 6 — NOTICE** all new/changed fork files (preprocessor, registry, translator, barrel, importer entity, docxImporter wiring).
- [ ] **Step 7 — Run `test:pm`.** Both IMPORT tests PASS (self round-trip + the real-Word fixture Leg B). Re-run `test:roundtrip` (27/0).
- [ ] **Step 8 — Commit.** `feat(mail-merge): import Word MERGEFIELD/ADDRESSBLOCK/GREETINGLINE/NEXT fields as fieldAnnotation nodes (preprocessor + NodeTranslator + v2 handler entity)`.

### Task 4: `bridge/mail.ts` — the PM mutation surface

**Files:** Create `src/renderer/bridge/mail.ts`; modify `bridge/index.ts`.

- [ ] **Step 1 — `installMailMerge(editor)`** (count checks per K-1; PM-aware merge builder per K-9):

```ts
// src/renderer/bridge/mail.ts — slice 10 mail-merge doc-mutation surface (engine/data stay clone-owned).
type AnyEditor = any
const slug = (s: string) => String(s || '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 24) || 'Field'

export function installMailMerge(editor: AnyEditor) {
  const refocus = () => editor.view?.focus()
  const countMergeFields = (): number => { let n = 0; editor.state.doc.descendants((x: any) => { if (x.type.name === 'fieldAnnotation' && x.attrs.fieldType) n++ }); return n }

  function insertFieldCode(code: string, name: string, label: string): boolean {
    const before = countMergeFields()
    editor.commands.addFieldAnnotationAtSelection({
      type: 'text', fieldType: code,
      fieldId: `mm-${slug(name)}-${Math.floor(editor.state.doc.content.size)}-${slug(label)}`,
      displayLabel: label, defaultDisplayLabel: label,
    }, false)
    refocus()
    return countMergeFields() === before + 1
  }
  const mmInsertField = (field: string) => insertFieldCode('MERGEFIELD', field, `«${field}»`)
  const mmAddressBlock = () => insertFieldCode('ADDRESSBLOCK', 'AddressBlock', '«AddressBlock»')
  const mmGreetingLine = () => insertFieldCode('GREETINGLINE', 'GreetingLine', '«GreetingLine»')
  const mmInsertRule = (code: string, label: string) => insertFieldCode(code.split(/\s+/)[0], code.split(/\s+/)[0], `{ ${label || code} }`)

  function mmHighlight(on: boolean): boolean {
    editor.commands.setFieldAnnotationsHighlighted((n: any) => n.attrs && n.attrs.fieldType != null, on !== false)
    refocus(); return true
  }
  // Non-destructive preview. values: NAME→value (null restores «name»). Reads defaultDisplayLabel
  // for the immutable name so a second preview pass still resolves correctly (K-5).
  function mmPreview(values: Record<string, string> | null): boolean {
    const updates: Array<{ id: string; label: string }> = []
    editor.state.doc.descendants((n: any) => {
      if (n.type.name !== 'fieldAnnotation' || n.attrs.fieldType !== 'MERGEFIELD') return
      const name = String(n.attrs.defaultDisplayLabel || n.attrs.displayLabel || '').replace(/^«|»$/g, '')
      const label = values == null ? `«${name}»` : (values[name] != null ? String(values[name]) : `«${name}»`)
      updates.push({ id: n.attrs.fieldId, label })
    })
    updates.forEach((u) => editor.commands.updateFieldAnnotations(u.id, { displayLabel: u.label }))
    refocus(); return true
  }
  // PM-aware Finish&Merge builder (K-9): build the merged body from the PM doc, matching the
  // fieldAnnotation DOM (span.annotation[data-field-type]; name from data-display-label).
  // `resolve(fieldName, rec)` is the clone's composite()/_val resolver passed in from WC.Mail.
  function mmBuildMerge(recipients: any[], resolve: (field: string, rec: any) => string): string {
    const w = window as any
    const template: string = w.WC?.PM?.getHTML?.() || ''
    const BREAK = '<div class="manual-break" contenteditable="false" style="break-after:page;page-break-after:always"></div>'
    const fillOne = (rec: any): string => {
      const div = document.createElement('div'); div.innerHTML = template
      div.querySelectorAll('span.annotation[data-field-type]').forEach((m: any) => {
        const code = m.getAttribute('data-field-type')
        const label = m.getAttribute('data-display-label') || ''
        const name = code === 'MERGEFIELD' ? label.replace(/^«|»$/g, '')
          : code === 'ADDRESSBLOCK' ? '__AddressBlock__' : code === 'GREETINGLINE' ? '__GreetingLine__' : code === 'NEXT' ? '__NextRecord__' : ''
        m.outerHTML = name ? (resolve(name, rec) || '') : m.outerHTML
      })
      return div.innerHTML
    }
    return (recipients && recipients.length ? recipients : [{}]).map(fillOne).join(BREAK)
  }
  async function mmFinishToNewDoc(mergedHtml: string): Promise<boolean> {
    const w = window as any
    return !!(await w.WC?.PM?.openHtml?.(mergedHtml))
  }

  return { mmInsertField, mmAddressBlock, mmGreetingLine, mmInsertRule, mmHighlight, mmPreview, mmBuildMerge, mmFinishToNewDoc }
}
```

- [ ] **Step 2 — Wire into `index.ts`:** import `installMailMerge`; add to `Object.assign(PM, …)` (`:381`); add pre-install stubs:

```ts
    // slice 10: mail-merge pre-mount stubs (replaced by installMailMerge on mount)
    mmInsertField: () => false, mmAddressBlock: () => false, mmGreetingLine: () => false,
    mmInsertRule: () => false, mmHighlight: () => false, mmPreview: () => false,
    mmBuildMerge: () => '', mmFinishToNewDoc: async () => false,
```

- [ ] **Step 3 — Run `test:pm`.** `[10mm]` insert/highlight/preview/finishMerge tests PASS (bridge present); flip test still RED. `test:legacy` unchanged (bridge not loaded under `--legacy`).
- [ ] **Step 4 — Commit.** `feat(mail-merge): bridge/mail.ts — insert/highlight/preview/PM-aware finish over FieldAnnotation`.

### Task 5: Re-point ribbon + `WC.Mail` doc-writes + THE FLIP + leak audit

**Files:** Modify `mailings-tools.js`, `commands.js`, `bridge/index.ts`.

- [ ] **Step 1 — Re-point `WC.Mail` doc-mutation methods** (add `const PMA = () => (WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null);`; PM branch then **verbatim legacy ELSE**, K-8):
  - `insertField(field,label,data)` — PM branch with the **composite-sentinel carve-out** (critique minor): `const pm = PMA(); if (pm) { if (field === '__AddressBlock__') { pm.mmAddressBlock(); return; } if (field === '__GreetingLine__') { pm.mmGreetingLine(); return; } pm.mmInsertField(field); return; }` then the original `E().insertNodeHTML(...)`.
  - `highlightMergeFields()` — `const pm = PMA(); if (pm) { this._hl = !this._hl; pm.mmHighlight(this._hl); return; }` ELSE `E().node.classList.toggle('show-mergefields')`. (Init `_hl: false` in the object literal.)
  - `previewResults(on)` — PM branch: build the values map from `this.recipients[this.current]` via `_val` and call `pm.mmPreview(map)`; OFF → `pm.mmPreview(null)`. ELSE the original `setHTML` path. Record nav (`go`) updates the map the same way.
  - `finishMerge('edit')` — PM branch: `const pm = PMA(); if (pm) { const merged = pm.mmBuildMerge(this.recipients, (field, rec) => this.composite(field, rec, {})); return pm.mmFinishToNewDoc(merged); }` ELSE the original `WC.Files.newDocWith`. `'print'`/`'email'` unchanged.
  - `addressBlock`/`greetingLine` dialog OK handlers — `pm ? pm.mmAddressBlock()/mmGreetingLine() : this.insertField('__AddressBlock__', …)`.
  - `envelopes`/`labels`/`updateLabels` — PM branch builds real PM content/table (D10.10) via the bridge (or land as commit 5b); ELSE original.
- [ ] **Step 2 — Re-point `commands.js`-local rule inserts** (K-4): `H.rules` `insertField` closure at **`:878`** and `ifThenElseDialog` OK insert at **`:903`** — both behind `PMA() ? pm.mmInsertRule(code, code) : E().insertNodeHTML(...)`.
- [ ] **Step 3 — THE FLIP** (`bridge/index.ts:42`): add `'mail-merge'` to `FLIPPED`.
- [ ] **Step 4 — Leak audit.** Grep `commands.js` + `mailings-tools.js` mail-merge paths for `E().`; confirm each is behind a `PMA() ? … : E()…` ELSE. Confirm no mail-merge flyout item reaches `E().insertNodeHTML`/`E().setHTML`/`E().node` in PM mode.
- [ ] **Step 5 — Six gates.** `npm run build` then `test:pm` (all `[10mm]` green incl. flip), `test:legacy` (257 byte-identical), `test:smoke` + `test:smoke:legacy` (9/9 ×2), `test:roundtrip` (27/0), `test:docx` (17/0).
- [ ] **Step 6 — Commit.** `feat(mail-merge): flip mail-merge onto PM (re-point WC.Mail + ribbon rule inserts; THE FLIP; leak audit)`.

### Task 6: Oracle legs + Computer-Use parity + checkpoint + PR

- [ ] **Step 1 — Leg A (clone→Word).** Clone-author merge fields → `exportDocxBytes` → `C:\tmp\wc-slice10-clone.docx` → `word-oracle-win.ps1 roundtrip` (no repair) → `docx-inspect.js` confirms `w:fldSimple`/`w:instrText` `MERGEFIELD`+NEXT(3-run)+ADDRESSBLOCK survive Word's resave; diff NEXT/ADDRESSBLOCK run-for-run vs the fixture. PID-safe foreground (sandbox off).
- [ ] **Step 2 — Leg B (Word→clone).** Already pinned by the automated `[10mm]` real-fixture test; re-confirm + capture the verdict.
- [ ] **Step 3 — Computer-Use parity** vs the user's live Word Mailings tab (insertion, Highlight Merge Fields, Preview Results). Request access; PID-safe; never click links.
- [ ] **Step 4 — Verdicts JSON** + ledger entries in `deferrals.md`: envelopes/labels visual (A), rule-field IF semantics (C, D10.9), composite-import placeholder data-loss (C, D10.12).
- [ ] **Step 5 — Checkpoint** (plan-tracking): last-point.md + execution-map + banners.
- [ ] **Step 6 — PR** into `main`; refresh the graph via the `/graphify` skill (fork excluded); merge; delete branch.

## 5. Execution order

**1 (red) → 2 (export) → 3 (import) → 4 (bridge) → 5 (flip+repoint+leak) → 6 (oracle+PR).** 5 may split into 5a (re-point + flip + core leak) / 5b (envelopes/labels real PM content). The `[0a]` repoint (Task 1) lands before THE FLIP (Task 5) — K-6.

## 6. Definition of done

- Six gates green: `test:pm` (+ all `[10mm]`), `test:legacy` 257 byte-identical, `test:smoke`×2 9/9, `test:roundtrip` 27/0, `test:docx` 17/0.
- `mail-merge` ∈ `FLIPPED`; `[0a]` guards repointed (`margins`/`header`) and green.
- Merge fields round-trip: Leg A (real `w:fldSimple`/`w:fldChar` survives Word resave; NEXT 3-run; ADDRESSBLOCK noProof) AND Leg B (the real-Word fixture imports as `fieldAnnotation` nodes — automated `[10mm]` test).
- Finish & Merge produces a doc with record VALUES (PM-aware builder; K-9). Preview non-destructive; highlight a node attr.
- Leak audit clean; every fork edit NOTICE'd; deviations recorded (deferrals.md A/C); checkpoint + PR done; graph refreshed.
