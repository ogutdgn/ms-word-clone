# Phase 2 — Slice 9: references (TOC · footnotes/endnotes · citations/bibliography · captions/index · cross-reference) on the PM engine

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (fresh subagent + two-stage review per task) or `superpowers:executing-plans`. Steps use `- [ ]` checkboxes.

- **Status:** CRITIQUE-HARDENED (3-critic adversarial workflow 2026-06-12, 13 findings: 3 blockers, 7 amendments, 3 info — applied in §4, verdicts in §5) → ready to execute.
- **Branch:** `feature/phase-2-slice-9-references` (off fresh `main`; PR back into `main` — never work on `main`).
- **Spec:** `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md` §9.1 row 9 + §8.3/§8.4.
- **Reference:** Word for **Windows 16.0** over COM (`scripts/oracle/word-oracle-win.ps1`); COM rules in `scripts/oracle/README.md` (unsandboxed + foreground; PID-safe; never touch the user's Word window).
- **Goal:** flip area **`references`** onto the PM engine — every blocked references cmd either works on the engine or degrades honestly (no "not implemented" toast) — by wiring the clone to the fork's **SuperDoc Document API** (`editor.doc.*`), the same path slice-8 comments used so they EXPORT. Legacy `WC.Ref` (`references-tools.js`) stops driving PM mode (stays loaded; gated by `FLIPPED`+`PMA()`, not unloaded — F-K10).
- **Architecture:** the fork already MOUNTS the full references extension family and EXPOSES a complete Document API. The slice is overwhelmingly *wiring* (a new `bridge/references.ts` → `editor.doc.{toc, create.tableOfContents, footnotes, captions, citations, crossRefs, index, authorities, fields}`), ribbon `H.*` re-points via the `PMA()` pattern, the registry flip, plus one net-new clone-owned **notes area**. No new schema, no new engine. **Degradation reality (Phase-7 layout gap):** the fork resolves TOC page numbers, caption SEQ numbers, and rendered citation/bibliography text only during a layout cycle we don't run — so those land as placeholders/empty and are recorded in the ledger; the field codes + structure export correctly and real Word repopulates them on F9/open.
- **Tech stack:** Electron 31 · vendored ProseMirror fork (`src/renderer/core/superdoc-fork/`) · `WC.PM` bridge (TS, `src/renderer/bridge/`) · legacy `WC` (vanilla JS, `src/renderer/public/js/`).

---

## 0. Ground truth already verified (author pre-verification + 3-critic confirmation; fork grepped directly — graphify excludes it)

**0.1 Extensions — ALL mounted.** `constructPmEditor` → `getStarterExtensions()` (`src/renderer/bridge/create-editor.ts:43`) mounts (`src/renderer/core/superdoc-fork/extensions/index.js:144-246`): `FootnoteReference`, `EndnoteReference`, `TableOfContents`+`TocPageNumber`, `TableOfContentsEntry`, `DocumentIndex`, `IndexEntry`, `CrossReference`, `SequenceField`, `FieldUpdate`, `Citation`, `Bibliography`, `AuthorityEntry`, `TableOfAuthorities`, `PageReference`, `BookmarkStart/End`. **Nothing to add to the schema.**

**0.2 The seam = the SuperDoc Document API (`editor.doc.*`) — CONFIRMED live headless (F-1).** `editor.doc` is a lazily-built, cached `DocumentApi` (`src/renderer/core/superdoc-fork/core/Editor.ts:1797-1802`: `createDocumentApi(getDocumentApiAdapters(this))`), where `getDocumentApiAdapters` → `assembleDocumentApiAdapters(editor)` (`document-api-adapters/index.ts` → `document-api-adapters/assemble-adapters.ts:355-766`). The assembly is pure wiring — it closes over `editor` only (state.doc / schema / converter / dispatch / view), with NO Vue/ydoc/collab/UI-host dependency; fork integration tests build editors from a real blank `.docx` (same converter path as ours) and call these wrappers headlessly. The cache is **reset to `null` on Open/New + destroy** (`Editor.ts:4232,4417`) → the bridge MUST read `WC.editor.doc` fresh per call (F-K2). Public namespaces verified in `assemble-adapters.ts`:
| Feature | Public API | line |
|---|---|---|
| TOC insert | `editor.doc.create.tableOfContents(input, opts)` | :459 |
| TOC update/configure/remove/markEntry | `editor.doc.toc.{update,configure,remove,markEntry,unmarkEntry,listEntries,editEntry,list,get}` | :575-586 |
| Footnotes/endnotes | `editor.doc.footnotes.{insert,update,remove,configure,list,get}` | :656-663 |
| Captions | `editor.doc.captions.{insert,update,remove,configure,list,get}` | :686-693 |
| Generic field refresh | `editor.doc.fields.{insert,rebuild,remove,list,get}` | :694-700 |
| Citations + sources + bibliography | `editor.doc.citations.{insert,update,remove,list,get}` + `.sources.{…}` + `.bibliography.{insert,configure,rebuild,remove,get}` | :701-721 |
| Cross-reference | `editor.doc.crossRefs.{insert,rebuild,remove,list,get}` | :664-670 |
| Index + entries | `editor.doc.index.{insert,configure,rebuild,remove,…}` + `.entries.{insert,update,remove,…}` | :671-685 |
| Table of Authorities + entries | `editor.doc.authorities.{insert,configure,rebuild,remove,…}` + `.entries.{…}` | :722-736 |
| Targets / outline | `editor.doc.bookmarks.{…}` (:645-651) · `editor.doc.paragraphs.setOutlineLevel` (:428) |

**0.3 Footnote insert works end-to-end (import + export); content is a STRING (F-K4).** `footnotesInsertWrapper` (`document-api-adapters/plan-engine/footnote-wrappers.ts:187`) runs a `compoundMutation`: `bootstrapNotesPart` creates `word/footnotes.xml` if absent (works on the blank template — F-K9), `mutatePart` adds `<w:footnote>` (canonical store) with an allocated id, and inserts the `footnoteReference` node. **`FootnoteInsertInput.content` and `FootnoteUpdateInput.patch.content` are plain `string`** — `addNoteElement` does `text.split(/\r?\n/)` → one `w:p` per line (`core/parts/adapters/notes-part-descriptor.js:210`; `footnote-wrappers.test.ts:211,249`). So note bodies are plain-text round-trip (rich formatting in a note body is dropped — ledger C). Export is LIVE, not dormant (F-K8): `prepareFootnotesXmlForExport`/`…Endnotes…` run inside `SuperConverter.exportToDocx` (`core/super-converter/SuperConverter.js:1203-1221`), which `Editor.exportDocx` calls (:3840).

**0.4 TOC builds from headings; page numbers degrade to `'0'` on insert (F-`'??'`, F-K3).** `createTableOfContentsWrapper` → `materializeTocContent` → `collectTocSources(doc, config)` + `buildTocEntryParagraphs` (`document-api-adapters/helpers/toc-entry-builder.ts`). `DEFAULT_TOC_CONFIG.source = { outlineLevels:{from:1,to:3}, useAppliedOutlineLevel:true }`; the `\o` branch matches `getHeadingLevel(paragraphProperties.styleId)` via `/heading\s*([1-6])/i` (`node-address-resolver.ts:80`). The clone stores `Heading 1 → "Heading1"` (`bridge/style-names.ts:9`), so default-config TOC collects clone headings — it will **not** build empty. With no layout, the page-number run renders the literal **`'0'`** on the insert/`toc.update({mode:'all'})` path (`toc-entry-builder.ts:373`). (`'??'` appears ONLY on `toc.update({mode:'pageNumbers'})`, which returns `CAPABILITY_UNAVAILABLE` headless — we never call it.) **This is deferrals.md ledger A** ("TOC page numbers — slice 9 ships TOC with degraded numbers").

**0.5 Our-side wiring (graphify + reads).**
- Legacy engine: `src/renderer/public/js/references-tools.js` (`WC.Ref` — DOM `.wc-toc`/`.wc-note`/`.wc-caption`/`.wc-index-list`/`.wc-toa`/`.wc-bibliography`; page numbers via `E().pageOfElement`). Drives the hidden legacy editor in PM mode today via RAW DOM (`E().node.insertBefore/appendChild` + `E().repaginate()`) that is **not** all behind `pmGuard` → the only PM-mode leak guard is each re-pointed handler taking its `PMA()` branch (F-K10).
- **AREA map already maps ALL 19 references cmds** (`bridge/index.ts:86` `crossReference: 'references'` + `:104-109` the other 18: `tableOfContents, addText, updateTable, insertFootnote, insertEndnote, nextFootnote, showNotes, insertCitation, manageSources, style, bibliography, insertCaption, insertTableOfFigures, markEntry, insertIndex, updateIndex, markCitation, insertTableOfAuthorities`). `references` is **NOT in `FLIPPED`** (`:40`). So no AREA edit is needed — only the `H.*` re-points + the flip.
- Entry points to re-point (`commands.js:686-722`, all currently call `WC.Ref.*`/dialogs, none use `PMA()` yet): `H.tableOfContents` (687, flyout: Automatic Table 1/2 · Manual · Custom TOC `customTOCDialog` 688-703 · Remove), `H.addText` (704, levels flyout), `H.updateTable` (705 → `WC.Ref.updateAny`), `H.insertFootnote`/`H.insertEndnote` (706-707), `H.nextFootnote` (708), `H.showNotes` (709), `H.insertCaption` (710 → `captionDialog` 724), `H.insertTableOfFigures` (711), `H.markEntry`/`H.insertIndex`/`H.updateIndex` (712-714), `H.markCitation`/`H.insertTableOfAuthorities` (715-716), `H.insertCitation` (719, flyout), `H.manageSources` (720), `H.style` (721, APA/Chicago/IEEE/ISO 690/MLA/Turabian), `H.bibliography` (722). Plus `H.crossReference` (`:238` → `WC.Insert.crossRefDialog()`). `H.search`/`H.researcher` (717-718) are pre-existing cloud-stub toasts — leave them.
- **No ribbon-data change needed (F-6b/6c):** the References tab already lays out in Word-faithful groups (no regroup, unlike slice-8's Review tab); `crossReference` already exists in `ribbon-data.js` twice — Insert (`:813`) and References (`:1789-1795`) — with cmd `crossReference` derived by `gen.js` `camel('Cross-reference')`. Don't hand-edit generated files.
- D6 guard: both `[0a]` D6 dispatch tests probe **`tableOfContents`** (`scripts/test-suite-pm.js:168` cmd, `:173` dropdown). They INVERT when `references` flips → **must repoint** to `startMailMerge` (AREA `mail-merge`, `index.ts:111`; mail-merge not in `FLIPPED`; its control is a `dropdown`, so both guard heads stay meaningful) in the SAME red-tests commit.

**0.6 `PMA()` is NOT area-aware (F-1).** `PMA() = () => (WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null)` (`commands.js:11`) — it returns the whole bridge whenever PM is active+ready, regardless of area. The per-cmd flip is gated UPSTREAM by the D6 dispatch heads consulting `WC.PM.isBlocked(cmd)` (`bridge/index.ts:136` — false once `references ∈ FLIPPED`). The re-point shape `H.x = () => { const pm = PMA(); pm ? pm.refX() : <legacy> }` is correct; the flip itself is `FLIPPED`/`isBlocked`, not `PMA()`.

---

## 1. Scope decisions (D9.x — recorded up front; deviations → `docs/plan/deferrals.md` ledger at slice end)

- **D9.1 Footnote/endnote notes area (the trim point).** The fork renders the reference superscript only; the note BODY lives in `word/footnotes.xml` (plain-text per F-K4), and no inline notes-area extension is mounted. SHIP a **clone-owned, continuous-flow notes region** appended below the document body (legacy `.wc-notes` precedent), listing footnotes then endnotes, each editable as **plain text**; reads `editor.doc.footnotes.list()`, writes via `editor.doc.footnotes.update({target,patch:{content:<string>}})`. Numbering follows the engine (`footnoteNumberById`). Built as its **own commit** = the clean trim point → if dropped, footnotes degrade to insert+export-only (ledger A: Phase-7 "notes pane" follow-up). Page-foot placement is Phase-7 regardless. Rich-text in a note body is dropped (ledger C).
- **D9.2 TOC = real fork field.** `tableOfContents` → `editor.doc.create.tableOfContents()`; entries from Heading 1–N styleIds; **page-number runs render `'0'`** with no layout (ledger A). `customTOCDialog` options map to the TOC config: Show levels → `config.source.outlineLevels`; Show/Right-align page numbers → `rightAlignPageNumbers` + omit-page-number config; tab leader → best-effort. `Remove` → `editor.doc.toc.remove`. `updateTable` → `editor.doc.toc.update({mode:'all'})` for every TOC, then `editor.doc.fields.rebuild` for ToF/Index/ToA fields (legacy `updateAny` parity).
- **D9.3 Footnotes/endnotes = real fork notes.** `insertFootnote`/`insertEndnote` → `editor.doc.footnotes.insert({type, at:selection, content:'<seed text>'})`; `nextFootnote` → bridge-side navigation over `footnoteReference`/`endnoteReference` nodes (caret-relative, legacy `nextNote` parity); `showNotes` → focus/scroll the D9.1 notes area.
- **D9.4 Captions + Table of Figures.** `insertCaption` → `editor.doc.captions.insert({label, …})` (SEQ field; label from `captionDialog`); **caption SEQ numbers are empty (`resolvedNumber:''`) headless** — same layout gap as TOC (ledger A; assert SEQ-field shape, not "Figure 1"). `insertTableOfFigures` → `editor.doc.fields.insert({ at, instruction:'TOC \\c "Figure" \\h \\z', mode:'raw' })` (the TOC config can't carry the `\c` switch — F-K6); entries don't materialize headless, Word repopulates on F9/open (ledger C).
- **D9.5 Citations/bibliography = real FIELD/SOURCE engine; rendered text is Phase-7 (the honest deliverable).** `insertCitation` Add-New-Source → `editor.doc.citations.sources.insert(...)` then `editor.doc.citations.insert(...)`; existing-source items → `citations.insert`; placeholder → a placeholder source. `manageSources` → `editor.doc.citations.sources.{list,update,remove}`. `style` combo → `editor.doc.citations.bibliography.configure({style})` (free string — no enum, F-K5) → persists `StyleName` + `{style}.XSL`. `bibliography` flyout → `editor.doc.citations.bibliography.insert({title})`. **What's real:** sources persisted + exported (customXml `<b:Sources>`), CITATION/BIBLIOGRAPHY field codes + StyleName exported, real Word renders them on open. **What degrades (ledger A — layout gap):** `bibliography.rebuild` is a no-op (defers to layout); the inserted bibliography node + in-text citations render with the field code / empty list, NOT formatted reference text, headless. This is the honest scope — NOT the legacy styled-text spans.
- **D9.6 Index + Table of Authorities = full fields (area-completion beyond the literal spec-row text — justified by ribbon-area + extension-family).** `markEntry` → `editor.doc.index.entries.insert`; `insertIndex` → `editor.doc.index.insert`; `updateIndex` → `editor.doc.index.rebuild`. `markCitation` → `editor.doc.authorities.entries.insert` (category + short form from the Mark Citation dialog); `insertTableOfAuthorities` → `editor.doc.authorities.insert`. Page numbers degrade (ledger A).
- **D9.7 Cross-reference (area-completion beyond the literal spec-row text).** `crossReference` is ALREADY AREA-mapped (`index.ts:86`) and in ribbon-data on both Insert + References. Only the `H.crossReference` re-point remains → `editor.doc.crossRefs.insert({ targetKind, target, refKind })`; the dialog enumerates targets via `editor.doc.{bookmarks.list, toc.listEntries, footnotes.list}` + headings.
- **D9.8 `addText` (Add Text → TOC level) = `paragraphs.setOutlineLevel` (F-K7).** Map `H.addText` levels → `editor.doc.paragraphs.setOutlineLevel(n-1)` (Level 1→outlineLvl 0, …), and clear/`null` for "Do Not Show in Table of Contents". Because `DEFAULT_TOC_CONFIG.useAppliedOutlineLevel=true`, the applied `outlineLvl` is collected by the `\u` branch on the next `updateTable`. (`toc.markEntry` inserts an explicit TC-field node and does NOT set the paragraph outline level — wrong tool for "Add Text".) Mirror legacy heading-style parity only if Word does so.
- **D9.9 Keep `--legacy` byte-identical; flip via `FLIPPED`+`PMA()`, not unload (F-K10).** `references-tools.js` (`WC.Ref`) stays loaded (all legacy modules load unconditionally; the shared `dialogs.js` even calls `WC.Ref.addSource`/`insertCitation`, so `WC.Ref` must remain defined). PM-mode safety = every re-pointed `H.*` takes its `PMA()` branch and never falls through to `WC.Ref`'s raw `#editor` DOM mutations. The frozen 257 legacy gate stays green; a manual `--legacy` References-tab smoke after the flip commit.

---

## 2. Execution order (each task: red tests where engine-observable → implement → two-stage review → ONE commit; commit-style skill: `type(scope): summary` + what/why body, explicit `git add`, NO AI trailer)

1. **Plan commit** — this file. `docs(plan): slice-9 references plan (critique-hardened — D9.x + K-risks)`.

2. **[9] RED TESTS + D6 repoint** (`scripts/test-suite-pm.js`; ONE commit). Engine-observable only; doc-replacing tests in the `[0b]` zone at the suite END (~`:2882`). SAME commit: repoint both `[0a]` D6 guard tests (`:168`,`:173`) `tableOfContents` → `startMailMerge`.
   - `[9]` footnote insert: after `PM.refInsertFootnote()`, `doc.toJSON()` contains a `footnoteReference` node; `word/footnotes.xml` (read via `exportDocx({getUpdatedDocs:true})` — NOT `exportXmlOnly`, which returns only document.xml, F-blocker) contains `<w:footnote w:id=` with the seeded string; endnote symmetric.
   - `[9]` footnote reference marker: `exportDocx({exportXmlOnly})` (document.xml) greps `<w:footnoteReference`.
   - `[9]` TOC insert: on a 2-Heading doc, a `tableOfContents` node with ≥2 entry paragraphs whose text matches the headings; page-number run reads **`'0'`** (degraded-create, pins ledger A) — NOT `'??'`.
   - `[9]` TOC update after heading edit: edit a heading → `PM.refUpdateTable()` → entry text updates.
   - `[9]` caption: two `PM.refInsertCaption('Figure')` → two ordered SEQ-field caption paragraphs whose instruction starts `SEQ Figure`; do NOT assert "Figure 1/2" (resolvedNumber empty headless, F-blocker).
   - `[9]` citation source store: `PM.refAddSource(src)` then `PM.refInsertCitation(srcId)` → a citation field node exists AND `editor.doc.citations.sources.list()` includes the source.
   - `[9] EXPORT:` document.xml greps for a TOC field marker (`TOC \\o` instruction or `w:fldChar`) and `SEQ Figure`; `<b:Sources>`/customXml citation part presence via the `getUpdatedDocs` map.
   - `[0b]` (suite end): full open→insert-footnote+TOC→`exportDocxBytes`→`openDocx` round-trip keeps the footnote + TOC.
   - Commit: `test(pm): red [9] references tests + repoint [0a] D6 guards to startMailMerge`.

3. **bridge/references.ts** — `installReferences(editor)` exposing `WC.PM` methods, each a thin `editor.doc.*` call returning the success boolean, reading `WC.editor.doc` FRESH every call (F-K2; never hoist): `refInsertTOC(opts)`, `refUpdateTable()`, `refRemoveTOC()`, `refSetOutlineLevel(n)` (addText), `refInsertFootnote()`, `refInsertEndnote()`, `refNextNote(dir)`, `refShowNotes()`, `refInsertCaption(label)`, `refInsertTOF(label)`, `refMarkIndexEntry()`, `refInsertIndex()`, `refUpdateIndex()`, `refMarkCitation(info)`, `refInsertTOA()`, `refInsertCitation(srcId)`, `refAddSource(src)`, `refListSources()`/`refUpdateSource`/`refRemoveSource`, `refSetCitationStyle(style)`, `refInsertBibliography(title)`, `refCrossReference(input)`, `refListFootnotes()`/`refUpdateNote(target,text)` (for the notes area). Register in `installBridge` next to `installReview`. Headless-probe each path BEFORE the suite (F-K1 belt-and-suspenders + the live TOC/citation/caption export check, F-K8). Commit: `feat(bridge): references surface over the SuperDoc Document API`.

4. **D9.1 notes area** — clone-owned region (new `bridge/notes-area.ts` + CSS) rendering `editor.doc.footnotes.list()` (plain-text bodies), editable → `editor.doc.footnotes.update`; re-render on transaction; `refShowNotes` focuses it. Commit: `feat(bridge): continuous-flow footnote/endnote notes area (D9.1)`. **(Trim point — droppable without touching tasks 2/3/5/6.)**

5. **Ribbon/handler re-points** (`commands.js`) — every `H.*` from §0.5 gets a `PMA()` branch to the task-3 surface (`H.addText` → `refSetOutlineLevel`; `H.insertTableOfFigures` → `refInsertTOF`; `H.crossReference` → `refCrossReference`); `customTOCDialog`/`captionDialog`/Mark Citation/Add Source/**Manage Sources** get PM branches that route to the bridge (NOT `WC.Ref`), so the shared `dialogs.js` source paths don't leak (F-K10/5b). No AREA edit (already mapped). Legacy byte-identical under `--legacy`. Commit: `feat(references): re-point ribbon handlers to PM via PMA()`.

6. **THE FLIP + leak audit** — add `'references'` to `FLIPPED` (`bridge/index.ts`); remove the now-dead block toasts. **Per-handler leak audit (F-K10, replaces a phantom "script-gate"):** verify EVERY references `H.*` takes its `PMA()` branch in PM mode and none falls through to `WC.Ref`'s raw `#editor` DOM mutations; keep `WC.Ref` + `references-tools.js` loaded (shared `dialogs.js` needs `WC.Ref` defined). Commit: `feat(references): FLIP references onto the PM engine`.

7. **Gates ×6 + parity + oracle** — `npm run build` then `test:pm`, `test:legacy` (257), `test:smoke`+`test:smoke:legacy` (9/9), `test:roundtrip` (27), `test:docx` (17) + a manual `--legacy` References-tab smoke. Parity vs **Word for Windows 16.0** (TOC from headings, footnote insert, caption insert). Oracle (verdicts → `docs/superpowers/plans/notes/2026-06-12-slice9-oracle.json`): **extend `scripts/docx-inspect.js`** to detect `w:footnoteReference` + `word/footnotes.xml`/`<w:footnote w:id=`, TOC/SEQ/CITATION/BIBLIOGRAPHY field instr text, and caption SEQ (the 5 COM read-verbs can't see these — F-10); **clone→Word** — author a doc with a footnote + TOC + caption, run the oracle `roundtrip` verb, then the extended inspector on Word's resave to confirm parts/fields survive; **no-repair-prompt** stays a MANUAL screenshot leg (COM can't read the repair dialog); **Word→clone** — a Word-authored equivalent imports with notes + TOC rendering. Commit (if fixes): `fix(references): <parity/oracle fix> + regression test`.

8. **Checkpoint + PR** — `plan-tracking` skill: append `last-point.md`, tick `execution-map.md`, advance the CLAUDE.md/AGENTS.md banners to "slice 9 done → slice 10 next", add ledger deviations (§6). Refresh the committed graphify graph (`--update`, fork excluded) — rides the checkpoint commit. PR into `main` → merge → delete the branch.

---

## 3. Risks (post-critique status; verify-as-you-go pins below)

- **K1 — Document API live headless.** RESOLVED (F-1): assembled from `editor` alone, no Vue/ydoc; slice-8 comments + fork integration tests prove it. Pin: task-3 headless probe of each namespace as belt-and-suspenders.
- **K2 — `editor.doc` lifetime.** RESOLVED rule (F-2): cached + reset on Open/New/destroy; read `WC.editor.doc` fresh per call (slice-8 `review.ts` precedent). Pin: a regression test — insert footnote → Open new doc → insert again succeeds.
- **K3 — TOC source = heading styleIds.** REFUTED as a blocker (F-3): clone headings carry `Heading1`-form styleId; default `\o "1-3"` config collects them. Pin: the `[9]` TOC test on an IMPORTED-headings doc (docx path), not only `applyStyleByName`.
- **K4 — footnote content shape.** RESOLVED (F-K4): plain `string` (split on `\n`). Notes-area edits plain text; rich-text dropped (ledger C).
- **K5 — citation style vocabulary.** DOWNGRADED to INFO (F-7): `style` is a free string (no enum) — all 6 legacy styles accept trivially. The REAL risk is rendered-text emptiness (see D9.5).
- **K6 — Table of Figures.** RESOLVED path (F-3): `fields.insert` raw `TOC \c "Figure"` (TOC config can't carry `\c`); entries materialize on Word F9/open (ledger C).
- **K7 — addText.** RESOLVED (F-4): `paragraphs.setOutlineLevel`, not `toc.markEntry`.
- **K8 — export wiring invoked.** Footnotes/endnotes CONFIRMED live (F-K8). Pin: task-3 probe confirms TOC/citation/caption FIELD export through `editor.exportDocx()` before the suite.
- **K9 — parts bootstrap.** RESOLVED (F-5): footnotes bootstrap; index/citations/authorities insert PM nodes / customXml, no sidecar needed.
- **K10 — `--legacy` flip mechanism.** AMENDED (F-K10): there is NO `?legacy=1` script-gate; all legacy modules load unconditionally and `dialogs.js` uses `WC.Ref`. Flip = `FLIPPED`+`PMA()` + a per-handler leak audit (task 6); keep `WC.Ref` loaded.

---

## 4. Binding amendments (from the 3-critic pass 2026-06-12 — APPLIED above)

- **A1 (blocker):** TOC page-number placeholder is **`'0'`** on the insert/`update(all)` path, not `'??'` (`'??'` is only the unreachable `pageNumbers` path). §0.4/D9.2 + the `[9]` TOC test now assert `'0'`.
- **A2 (blocker):** footnote-body export must be read via `exportDocx({getUpdatedDocs:true})` or unzipped `exportDocxBytes()` — `exportXmlOnly` returns only `document.xml`. `[9]` test split: marker grep on document.xml, body grep on the footnotes.xml part.
- **A3 (blocker):** caption SEQ numbers are empty headless (`resolvedNumber:''`); `[9]` caption test asserts SEQ-field shape/order, not "Figure 1/2"; caption-number degradation added to the ledger (§6).
- **A4 (amendment):** `addText` → `editor.doc.paragraphs.setOutlineLevel(n-1)` (+ clear for "Do Not Show"), not `toc.markEntry` (D9.8).
- **A5 (amendment):** D9.5 reworded — citations/bibliography are real at the FIELD/SOURCE/StyleName/export level, but render empty (no formatted reference text) headless (`bibliography.rebuild` is a no-op); recorded as a ledger-A layout-gap deviation. K5 downgraded to INFO (free string).
- **A6 (amendment):** ToF = `fields.insert` raw `TOC \c "Figure"` (D9.4); TOC config can't carry `\c`; entries repopulate in Word (ledger C).
- **A7 (amendment):** footnote `content` is plain `string`; D9.1 notes-area edits plain text; rich note-body formatting dropped (ledger C).
- **A8 (amendment):** task 6 re-scoped — no script-gate exists; flip = `FLIPPED`+`PMA()` + a per-handler leak audit; keep `WC.Ref` loaded (shared by `dialogs.js`); route Add-Source/Manage-Sources dialogs to the bridge (D9.9, task 5/6).
- **A9 (amendment):** oracle leg — extend `docx-inspect.js` for references constructs; resave via the COM `roundtrip` verb; "no repair" stays a manual screenshot leg (task 7).
- **A10 (info):** `crossReference` is ALREADY AREA-mapped (`index.ts:86`) and in ribbon-data twice — no AREA edit, no ribbon-data regen (§0.5/D9.7 corrected).
- **A11 (info):** `PMA()` is not area-aware; the flip gate is `isBlocked`/`FLIPPED` (§0.6 corrected).
- **A12 (info):** ToA + cross-reference exceed the literal spec-row wording; in-scope by ribbon-area + extension-family — named explicitly in D9.6/D9.7.

## 5. Critique verdicts (3 critics, 2026-06-12)

| Domain | Severity | Verdict | Evidence |
|---|---|---|---|
| Document API live headless (K1) | CONFIRMED-OK | Assembled from `editor` only; no Vue/ydoc; fork integration tests + slice-8 comments prove it | `Editor.ts:1797-1802`, `assemble-adapters.ts:355-766`, `review.ts:300-343` |
| `editor.doc` lifetime (K2) | CONFIRMED-OK | Cached + reset on Open/New/destroy; slice-8 reads fresh, never hoists | `Editor.ts:4232,4417`, `review.ts:105,207,302` |
| TOC source = heading styleIds (K3) | CONFIRMED-OK (blocker refuted) | Clone `Heading1` styleId collected by default `\o "1-3"` | `toc-entry-builder.ts:122-146`, `node-address-resolver.ts:80`, `style-names.ts:9` |
| TOC page-number `'??'` vs `'0'` | BLOCKER → A1 | Insert path emits `'0'`; `'??'` only on unreachable pageNumbers path | `toc-entry-builder.ts:373`, `toc-wrappers.ts:708,817-826` |
| footnote export via `exportXmlOnly` | BLOCKER → A2 | `exportXmlOnly` returns only document.xml; body is in footnotes.xml | `Editor.ts:3854`, `SuperConverter.js:1203-1221` |
| caption "Figure 1/2" headless | BLOCKER → A3 | `resolvedNumber:''` (no headless SEQ resolver) | `caption-wrappers.ts:138`, `caption-resolver.ts:85` |
| addText → toc.markEntry | AMENDMENT → A4 | markEntry inserts a TC field; doesn't set outline level | `toc-entry-wrappers.ts:168-208`, `paragraphs-wrappers.ts:539-552` |
| D9.5 citations "real engine" | AMENDMENT → A5 | Real fields/sources/export; `rebuild` no-op; renders empty headless; `style` free string | `citation-wrappers.ts:387-415,459-472`, `citations.types.ts:173-185` |
| ToF via create.tableOfContents | AMENDMENT → A6 | `\c`/`\a` are preserved-only switches; use raw `fields.insert` | `toc-switches.ts:6-7,177-197`, `fields.types.ts:30-33` |
| footnote content shape (K4) | AMENDMENT → A7 | plain `string`, split on `\n` | `footnotes.types.ts:54,59`, `notes-part-descriptor.js:210` |
| `--legacy` script-gate (K10) | AMENDMENT → A8 | No gate exists; all legacy loads; `dialogs.js` uses `WC.Ref`; raw `#editor` mutations not all behind pmGuard | `index.html` static `<script>`, `references-tools.js:16,32,38`, `dialogs.js` `WC.Ref.addSource` |
| export wiring (K8) | CONFIRMED-OK (footnotes) | Live in `exportToDocx`; captions/fields/citations proven by integration tests | `SuperConverter.js:1203-1221`, `fields-captions-export.integration.test.ts` |
| parts bootstrap (K9) | CONFIRMED-OK | footnotes bootstrap; others insert nodes/customXml | `notes-part-descriptor.js:452-460`, `index-wrappers.ts`, `citation-wrappers.ts` |
| oracle observability | AMENDMENT → A9 | 5 COM verbs + docx-inspect don't read references constructs | `scripts/oracle/README.md`, `scripts/docx-inspect.js` |
| crossReference already mapped | INFO → A10 | `index.ts:86` + ribbon-data `:813,:1789` | `bridge/index.ts:86` |
| PMA not area-aware | INFO → A11 | flip gate is `isBlocked`/`FLIPPED` | `commands.js:11`, `index.ts:136` |
| ToA/cross-ref scope creep | INFO → A12 | beyond literal spec-row; area/family-justified | spec §9.1 row 9 |
| D6 repoint target | CONFIRMED-OK | `startMailMerge`→`mail-merge` (not flipped); dropdown → both heads meaningful | `index.ts:111,40`, `test-suite-pm.js:168,173` |

---

## 6. Definition of done (spec §8.4)

- Area `references` in `FLIPPED`; all 19 references cmds work on the PM engine or degrade honestly (no "not implemented" toast); the per-handler leak audit passes (no references `H.*` drives the hidden legacy editor in PM mode); `WC.Ref` stays loaded for `--legacy` + shared dialogs.
- Six gates green: `test:pm` (grown by `[9]`/`[0b]`), `test:legacy` 257, `test:smoke`+`:legacy` 9/9, `test:roundtrip` 27, `test:docx` 17; manual `--legacy` References-tab smoke.
- Both `[0a]` D6 guard tests repointed off `tableOfContents` → `startMailMerge` and still meaningful.
- Oracle legs PASS/recorded vs Word for Windows 16.0 (clone→Word: footnotes.xml + TOC/SEQ/CITATION fields survive Word's resave per the extended `docx-inspect.js`; manual no-repair screenshot; Word→clone import renders). Verdicts JSON checked in.
- **Ledger updated** — A (layout-gap): TOC/ToF/Index/ToA page numbers (`'0'`); caption SEQ numbers empty; bibliography/in-text-citation **rendered text** empty (field codes + sources export). C (recorded decisions): footnote/endnote note bodies are plain-text (rich formatting dropped); D9.1 trim outcome; ToF entries repopulate only in Word. Fork edits (if any) carry a NOTICE in `superdoc-fork/NOTICE.md`.
- Plan docs checkpointed (plan-tracking); banners advanced to "slice 9 done → slice 10 next"; graph `--update`'d (fork excluded). PR merged into `main`; branch deleted.
