# Phase 2 — Slice 6 Implementation Plan: insert-basics (+ full Table Tools)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the `insert-basics` ribbon area onto the owned ProseMirror engine — **link, image,
page break, blank page, horizontal line, symbol, equation (styled text), bookmark, and table** —
replacing the legacy `E().insertHTML(...)` / raw-DOM paths with PM transactions through the `WC.PM`
bridge, and **build the full Word Table Tools** (Table Layout + Table Design contextual tabs + a
PM table context menu) on top of ~14 NOTICE'd fork commands — every behavior oracle-validated against
real Word 16.77.1.

**Architecture:** Spec `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md` (D1–D7 +
§5–§9 are the contract; §9.1 row 6 = "link, table (+table tools), image (pickImage → PM `Image`),
page break, symbol/equation (Math), bookmark, horizontal line"). Slice-2/3/4/5 pattern: legacy entry
points in `commands.js` / `dialogs.js` / `insert-features.js` / `app.js` get **PMA-ternary** PM
branches; the `WC.PM` bridge is the only code talking to the vendored Editor; **the FLIPPED-set edit
is the auditable switch and lands LAST (Stage D, same commit as the app.js Ctrl+K re-point + the
AREA-map exotica carve-out).** The fork **already ships** every insert-primitive command
(`setLink`/`unsetLink`, `setImage`, `insertBookmark`/`insertBookmarkEnd`/`goToBookmark`/`removeBookmark`,
`insertContent`, `setFontFamily`, `insertPageBreak`, `insertHorizontalRule`) **and the core table
ops** (`insertTable`, `addRow/Column Before/After`, `deleteRow/Column/Table`, `mergeCells`,
`splitCell`, `toggleHeaderRow/Column`, `setCellAttr`, `setCellBackground`, `deleteCellAndTableBorders`).
**Table Tools beyond the legacy 9** needs **net-new NOTICE'd fork commands** (style apply, cell/row
sizing, margins, borders editor, alignment/indent, distribute, split-table, convert↔text, text-direction,
autofit) — many with **pagination-gated visuals deferred to Phase 7** (attrs land now).
**Contextual ribbon tabs are runtime-injected JS** (`WC.Ribbon.showContextualTab(def)` — exactly how
`header-footer.js` injects the Header & Footer tab), so **no `gen.js` / `raw-research.json` /
`ribbon-data.js` edits are needed** for the Table Layout + Table Design tabs.

**Brainstorm decisions (2026-06-09, user-approved — recorded for the checkpoint):**
- **(1) Full Table Tools** (user chose "Build full Word Table Tools now" with full cost visibility:
  the legacy app has NO Table Tools ribbon tab — table editing is a 9-item right-click menu — so this
  is **net-new feature development**, not migration; ~5-10× a normal slice; ~half pagination-gated).
- **(2) Equation = styled text on PM** (Cambria Math italic run), NOT a real OOXML `<m:oMath>` node —
  matches legacy behavior exactly; record KNOWN DEVIATION; real Math authoring deferred to a later slice.
- **(3) UI-fidelity via Codex** when needed: semantic + round-trip oracle (legs A/B) run headless by
  the agent; side-by-side dialog/tab screenshots via the user's Codex desktop handoff.
- **(4) Exotica carve-out:** the 15 exotic insert cmds (smartart, chart, wordart, dropCap, coverPage,
  textBox, icons, onlineVideo, signatureLine, object, quickParts, onlinePictures, screenshot, dateTime
  + crossReference) are re-mapped OUT of `insert-basics` so they STAY courtesy-blocked: 14 → a new
  `insert-exotica` area key (slice 10), `crossReference` → `references` (slice 9). Mirrors slice-4's
  `select` remap.

**Tech stack:** Electron 31 shell; electron-vite + TS renderer bridge (`src/renderer/bridge/`);
vendored SuperDoc fork (`@core`/`@extensions` aliases — `extensions/table/`, `extensions/image/`,
`extensions/link/`, `extensions/bookmarks/`, `extensions/content-block/`, `extensions/line-break/`,
`extensions/font-family/`); in-renderer probe harness (`--probe-out` + `--shot-evalfile`); osascript
oracle (`scripts/oracle/word-oracle.js`) + **unzip-based `.docx` inspection** (the oracle has no
object-model verbs for tables/links/bookmarks/images — validation greps `word/document.xml` +
`word/_rels/document.xml.rels` + `word/media/`).

**Branching:** everything on `feature/phase-2-slice-6-insert-basics`, branched **directly off `main`**
(no stacked PRs). Create it: `git checkout main && git pull && git checkout -b feature/phase-2-slice-6-insert-basics`.
Verify with `git branch --show-current` before any edit.

**⚠️ RECOMMENDED PR SPLIT (raise with the user at execution start):** this slice is large enough to
ship as **two PRs off the same branch lineage** for reviewability:
- **6a** = Stages A–D (insert primitives + table INSERTION + migrate the existing 9 table ops onto PM
  + THE FLIP). Self-contained, oracle-validated, all gates green. The `insert-basics` flip lands here.
- **6b** = Stages E–H (the net-new fork table commands + the Table Layout/Design contextual tabs + the
  PM table context menu + Design-tab styling). **Additive** — the contextual tabs are runtime-injected
  and call `WC.PM` directly (they do NOT depend on the courtesy-block flip), so 6b stacks cleanly on 6a.

The user chose "one PR" earlier; if they hold that, ship A–H as one PR. Either way the STAGE order is
identical; only the PR boundary differs.

**Critique-hardened (2026-06-09):** 3-critic adversarial workflow (claims-vs-code, consistency/altitude,
design-holes) + author pre-verification of the highest-risk claims. The author pre-verification caught
the two biggest blockers (B1/B2) that the claims-vs-code critic actually got WRONG (it asserted "the
contextual tab pattern correctly mirrors header-footer.js" — it does NOT; the plan's first draft used
inline `onClick`, header-footer uses `{cmd,label,type}` cmd-dispatch). **4 blockers + 6 majors applied:**

- **BLOCKER (B1) — contextual-tab controls are cmd-dispatch, NOT `onClick`:** `header-footer.js`'s
  `contextualTab()` defines EVERY control as `{ cmd, label, type }` (header-footer.js:33-66); the ribbon
  renderer's `renderGroup(def, group)` (ribbon.js:330) wires them through `WC.Commands.run({cmd})` →
  `H[cmd]`. The first-draft `table-tools-pm.js` used inline `onClick: () => PM().tableAddRow(...)` which
  the renderer IGNORES (controls won't function). Task 10 is rewritten: Table Tools controls are
  `{cmd,label,type}` referencing **new `H[cmd]` handlers** (added in commands.js) that route to `WC.PM`;
  dropdown controls (style gallery, shading, borders, autofit) get `WC.Commands.dropdown` handlers like
  every other ribbon dropdown. The new cmd ids are added to the AREA map under `insert-basics` so the
  flip un-blocks them (or left unmapped — they call `WC.PM` directly; decide per Task 10).
- **BLOCKER (B2) — ribbon shows only ONE contextual tab at a time:** `showContextualTab(def)` stores a
  single `this._ctxTab` and `hideContextualTab()` takes NO id (ribbon.js:321-345) — calling it twice
  (Layout + Design) makes the 2nd HIDE the 1st. Task 10 adds a **backward-compatible multi-tab
  extension** to `ribbon.js` (`_ctxTabs` set; `showContextualTab` stacks; `hideContextualTab(id?)` hides
  one or all) — Header & Footer's single-tab usage stays byte-identical (verify the 257 legacy gate). The
  two faithful tabs (Table Design + Table Layout) then coexist. *(Recorded option: if the legacy gate
  proves fragile, fall back to ONE combined "Table" contextual tab and record the deviation.)*
- **BLOCKER (B3) — `tableSelectFirstRowPair` / merge test referenced before defined:** the `[6]` merge
  test (Task 1) calls a CellSelection test-helper added only in Stage F → `not a function` pre-6b. Move
  the **merge test + any CellSelection-dependent test (shading) to the `[6b]` block** (Task 10.3), where
  the helper exists; keep `[6]` (6a) to insertion + row/col add/delete + header toggle (which work off a
  plain caret-in-cell). 
- **BLOCKER (B4) — PM table context-menu may fight PM's native table UI:** a `contextmenu` +
  `preventDefault` listener on `#pm-editor` (first-draft Task 10) can block ProseMirror's native
  cell-selection / column-resize / gapcursor, and Word uses a contextual mini-toolbar, not a full menu.
  **The contextual ribbon tab is the PRIMARY editing affordance**; the PM context menu becomes
  **optional + narrowly scoped** (only `preventDefault` when the right-click target is inside a table
  cell AND a table is active) with a Step-10.4 probe that VERIFIES native cell-selection/resize still
  work. If the probe shows conflict, DEFER the context menu (record) — the contextual tab covers it.
- **MAJOR (M1) — `mergeCells`/`setCellBackground` need a CellSelection:** they `return false` on a plain
  TextSelection (silent no-op). Bridge `tableMerge()`/`tableSetCellShading()` must detect a non-cell
  selection and **toast "Select cells first" + return false** (Task 4.1). Tests build a `CellSelection`
  via `setCellSelection({anchorCell, headCell})` first (the `tableSelectFirstRowPair` helper).
- **MAJOR (M2) — PM bookmark dialog needs real list/refresh code:** the legacy dialog queries DOM
  `[data-bookmark]` (won't see PM nodes). Task 5.3 ships the FULL PM branch: list via
  `WC.PM.listBookmarks()`, Add→`insertBookmark`, Go→`goToBookmark`, Delete→`removeBookmark`, **re-render
  the list after each mutation**.
- **MAJOR (M3) — state-sync contextual-tab call: load-order + guard:** `table-tools-pm.js` MUST load
  before the bridge's first state-sync fires. It's a classic `<script>` in `src/renderer/index.html`
  (add after line 50, `table-tools.js`); the bridge TS bundle loads after the public/js scripts, so the
  module exists by first sync. Keep the call optional-chained (`WC?.TableToolsPM?.syncContextualTabs?.`)
  and idempotent (the `shown` set guards re-injection); verify tabs HIDE when the table is deleted
  (Step 10.4 probe).
- **MAJOR (M4) — equation mark-bleed:** inserting into a bold run yields bold+Cambria+italic; Word
  applies ONLY Cambria+italic. `insertEquation` must set the inserted range's marks to EXACTLY
  `[textStyle{fontFamily:'Cambria Math'}, italic]` (clear inherited marks on the range first), or record
  the inheritance as a deviation (Task 3.1).
- **MAJOR (M5) — image size guard:** `insertImage` accepts any data-URL; a 100MB+ URL bloats the doc and
  can stall export. Reject `src.length` over a ceiling (≈50MB of base64) with a toast (Task 3.1).
- **MAJOR (M6) — `docx-inspect` regex robustness:** OOXML attribute order + namespace prefixes are not
  guaranteed, so `<w:hyperlink[^>]*r:id="..."` can silently miss on Word-authored files. Make the
  extractors **tag-then-attr** (match the element, then pull each attr independently within the tag), or
  parse with a lightweight XML pass; test against BOTH clone- and Word-authored `.docx` (Task 2.1).
- **CLARIFICATIONS (apply inline):** (a) **exactly 9 cmds stay in `insert-basics` and flip** — `table,
  link, bookmark, pageBreak, blankPage, symbol, equation, horizontalLine, pictures` (= spec row 6's
  8 cmds [`image`≡`pictures`] + `blankPage`, which I flip as two page breaks); the other **14 carve to
  `insert-exotica`** + `crossReference`→`references` (the current map has **24** insert-basics cmds, not
  "25" — fix the prose). (b) `setMark('italic')` IS a valid chainable core command (core/commands) — the
  italic extension only exposes `toggleItalic`; the plan's `setMark('italic')` is correct, no fallback
  needed.
- **VERIFIED NOT BLOCKERS (critic confirmations of already-planned items):** Ctrl+K guard (already
  Task 6.3, same commit as the flip); B1 bookmark pairing (already the plan's B1 fix); `__PM_TextSelection`
  export exists (main.ts:15); the script-include list is `src/renderer/index.html`.

**The five gates** (legacy + smoke ×2 + docx green at EVERY commit; the PM suite's `[6]` block is red
from Task 1 and goes fully green at the flip; the `[6b]` table-tools block goes green as Stage E–G land):

```bash
npm run build
npx electron . --legacy --probe-out=/tmp/wc-legacy.json --shot-evalfile=scripts/test-suite.js --shot-delay=800   # 257 pass (FROZEN, byte-identical legacy)
npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js                              # PM suite (130 → ~170+)
npx electron . --probe-out=/tmp/wc-smoke.json --shot-evalfile=scripts/smoke-pm.js                                # 9 pass
npx electron . --legacy --probe-out=/tmp/wc-smoke-legacy.json --shot-evalfile=scripts/smoke-pm.js                # 9 pass
node scripts/test_docx.js                                                                                        # 17 pass (FROZEN legacy html-to-docx)
```

Check results: `node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/wc-pm.json'));console.log(r.summary);r.results.filter(x=>!x.pass).forEach(x=>console.log('FAIL',x.name,x.detail))"`

**⚠️ D6 repoint (slice-6 carry-over — BOTH `[0a]` tests now sit on insert-basics cmds):** when
`insert-basics` flips, BOTH inherited `[0a]` D6 probes invert:
- the **run-block** test (test-suite-pm.js ~line 161) probes cmd `link`,
- the **dropdown-block** test (~line 168) probes cmd `table`.

Task 1 repoints **BOTH** to still-unflipped areas (verified by inventory agent #5 with exact lines):
- run-block `link` → **`newComment`** (RUN/button type, ribbon-data.js:2205-2210; area `review` = slice 8, unflipped).
- dropdown-block `table` → **`tableOfContents`** (DROPDOWN type, ribbon-data.js:1595-1599; area `references` = slice 9, unflipped).

After this slice the two `[0a]` D6 tests live on `newComment`/`tableOfContents`; slice 8's red-tests
task repoints them again (recorded in carry-overs).

**⚠️ Inserts mutate the doc (not decorate):** unlike slice 5 (decorations), every insert here is a
real PM transaction. Tests assert on `doc().toJSON()` node/mark presence + `exportDocx` round-trip,
NOT on injected DOM. Do NOT "fix" a failing insert test by reaching into `#editor` legacy DOM.

**⚠️ Two confirmed integrity blockers (inventory, fold into the relevant tasks):**
- **B1 — `insertBookmark` inserts ONLY `bookmarkStart`:** the fork's `insertBookmark` (bookmark-start.js:111)
  inserts a lone start node; without a paired `bookmarkEnd` (same `id`) the bookmark exports MALFORMED.
  The bridge `insertBookmark` MUST insert BOTH start (at `selection.from`) and end (at `selection.to`)
  in one transaction, end-first to avoid position shift (Task 4.3).
- **B2 — legacy table context menu bypasses D6:** `WC.Table.*` methods (table-tools.js:25-92) do RAW
  DOM mutations (`row.remove()`, `cell.setAttribute(...)`) NOT routed through the `pmGuard` chokepoints
  (editor.js:12-17 guards only `exec/insertHTML/insertNodeHTML/applyInlineStyle*`). In PM mode the
  listener is on the hidden `#editor` (visibility:hidden → unreachable by pointer), so the live risk is
  low, but Task 6 adds `pmGuard('table-tools')` to each `WC.Table` method (belt-and-suspenders) AND
  provides the PM table context menu on `#pm-editor` routing to `WC.PM` (the real functional gap:
  PM tables have NO editing UI today).

---

## File structure (what gets created/modified)

| Path | Role |
|---|---|
| `scripts/test-suite-pm.js` (modify) | D6 repoint (`link`→`newComment`, `table`→`tableOfContents`); the `[6]` block (insert primitives + table insertion + migrated-9 ops) between the `[5]` block and the `[0b]` header (`[0b]` stays LAST); the `[6b]` block (full Table Tools) after `[6]` |
| `scripts/oracle/word-oracle.js` + `README.md` (modify) | NO new AppleScript verbs needed; add **unzip-based** round-trip note + quirks #28+ for slice-6 validation (tables/links/bookmarks/images live in OOXML/media, not the Word object model) |
| `scripts/docx-inspect.js` (new, optional helper) | tiny node helper: unzip a `.docx`, return `{documentXml, rels, mediaFiles[]}` for leg-A assertions (reuse `test_docx.js` unzip approach) |
| `src/renderer/bridge/insert.ts` (new) | insert-primitive surface: `insertLink`, `removeLink`, `insertImage`, `insertBookmark` (paired start+end), `listBookmarks`, `goToBookmark`, `removeBookmark`, `renameBookmark`, `insertSymbol`, `insertEquation`, `insertPageBreak`, `insertBlankPage`, `insertHr` |
| `src/renderer/bridge/table.ts` (new) | table surface: `insertTable`, `tableAddRow/Column`, `tableDeleteRow/Column/Table`, `tableMerge`, `tableSplitCell`, `tableToggleHeaderRow/Column`, `tableSetCellShading`, `tableSetCellVAlign`, `isInTable`, `tableInfo` + (6b) `tableSetStyle`, `tableSetCellWidth`, `tableSetRowHeight`, `tableSetCellMargins`, `tableSetCellBorders`, `tableSetAlignment`, `tableSetIndent`, `tableDistributeRows`, `tableDistributeColumns`, `tableSplit`, `tableToText`, `textToTable`, `tableSetTextDirection`, `tableAutoFit` |
| `src/renderer/bridge/index.ts` (modify) | import + spread `installInsert(editor)` + `installTable(editor)`; pre-mount stubs; **flip commit only:** `FLIPPED += 'insert-basics'` + AREA-map exotica carve-out (15 cmds) |
| `src/renderer/bridge/state-sync.ts` (modify) | add `st.inTable` (selection inside a `table` node) + `st.tableSel` (rows/cols/cell context) to drive the contextual-tab show/hide + Table Tools state |
| `src/renderer/core/superdoc-fork/extensions/table/table.js` (modify, fork — 6b) | ~14 new NOTICE'd commands (see Stage E); each via `setNodeMarkup`/`setCellAttr` on existing attrs, or new attr for `textDirection` |
| `src/renderer/core/superdoc-fork/extensions/table-cell/table-cell.js` + `table-header/table-header.js` (modify, fork — 6b) | add `textDirection` attr (writing-mode render) for the text-direction command |
| `src/renderer/core/superdoc-fork/NOTICE.md` (modify — 6b) | document the new table commands + the `textDirection` attr |
| `src/renderer/public/js/commands.js` (modify) | PM branches: `H.pictures`, `H.pageBreak`, `H.blankPage`, `H.horizontalLine` (the `insertHTML('<hr>')` site); confirm `H.table`/`H.link`/`H.symbol`/`H.equation`/`H.bookmark` route through their dialog PM branches |
| `src/renderer/public/js/dialogs.js` (modify) | PM branches in `D.insertLink`, `D.symbol`, `D.equation`, `D.insertTable` (grid+dialog → `insertTable`) |
| `src/renderer/public/js/insert-features.js` (modify) | PM branches in `Insert.bookmarkDialog`, `Insert.tableMenu` (grid/Quick Tables/Draw → `insertTable`; Convert Text→Table → `textToTable`), `Insert.symbolDialog`, `Insert.convertTextToTable` |
| `src/renderer/public/js/table-tools.js` (modify) | add `pmGuard('table-tools')` to each `WC.Table` method (B2 belt-and-suspenders) |
| `src/renderer/public/js/table-tools-pm.js` (new) | PM Table Tools chrome: the **Table Layout + Table Design contextual-tab defs** (mirror `header-footer.js`'s `contextualTab()` + `WC.Ribbon.showContextualTab`), the **PM right-click table context menu** on `#pm-editor`, and `syncContextualTabs(inTable)` called from state-sync. All onClicks → `WC.PM` table commands |
| `src/renderer/public/js/app.js` (modify, **flip commit**) | wrap bare `Ctrl+K` (line 80) in `pmBlockedOr('insert-basics', () => WC.Dialogs.insertLink())`; verify `Ctrl+Enter`/pageBreak (line 74) stays guarded |
| `src/renderer/public/styles/*.css` (modify, maybe) | Table Design styling (table-style gallery swatches, cell-shading swatch) + contextual-tab fidelity; additive, recorded |

Not touched: `scripts/test-suite.js` (frozen), `ribbon-data.js`/`icons-fluent.js`/`raw-research.json`
(generated/source — contextual tabs are runtime-injected, no regen needed), the legacy
`E().insertHTML` insert paths (stay for `--legacy`), the fork Math nodes (equation = styled text;
real OOXML Math authoring deferred).

---

# ░░░ PART 6a — INSERT PRIMITIVES + TABLE INSERTION + MIGRATE THE 9 OPS ░░░

# Stage A — red tests + validation prep

### Task 0: branch + plan commit

- [ ] **Step 0.1:** `git checkout main && git pull && git checkout -b feature/phase-2-slice-6-insert-basics`;
confirm `git branch --show-current`.
- [ ] **Step 0.2:** Commit this plan (`docs(plan): phase 2 slice 6 implementation plan — insert-basics + full Table Tools`).

### Task 1: D6 repoint (BOTH tests) + failing PM-suite `[6]` tests (red)

**Files:** Modify: `scripts/test-suite-pm.js`

- [ ] **Step 1.0: Read the ACTUAL current suite first.** `grep -n "\[0a\] D6\|\[0b\]\|\[5\]" scripts/test-suite-pm.js`
to get live offsets (the plan's `~161/~168` and "130" are approximate). Confirm (A) the two `[0a]` D6
test line ranges, (B) where the `[5]` block ends, (C) where the `[0b]` header starts (`[6]` inserts
between B and C; `[0b]` MUST stay LAST), (D) the current passing count.

- [ ] **Step 1.1: Repoint BOTH `[0a]` D6 tests.** Run-block probe `link`→`newComment`; dropdown-block
probe `table`→`tableOfContents`. Verify in `bridge/index.ts` AREA map: `newComment` → `review`,
`tableOfContents` → `references` (both unflipped). `newComment` is a RUN/button cmd (opens nothing /
toasts when blocked); `tableOfContents` is a DROPDOWN cmd:

```js
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    // probe lives in a STILL-UNFLIPPED area — repointed link→newComment when
    // insert-basics flipped (slice 6): a link probe would go vacuously green once
    // insert-basics is live; newComment (review, slice 8) keeps the test MEANINGFUL.
    window.WC.Commands.run({ cmd: 'newComment', label: 'New Comment' });
    return document.querySelectorAll('.flyout').length === 0
      && !document.querySelector('.modal-backdrop');
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    window.WC.Commands.dropdown({ cmd: 'tableOfContents', type: 'dropdown' }, document.body);
    const open = document.querySelectorAll('.flyout').length;
    window.WC.closeFlyouts();
    return open === 0;
  });
```

(VERIFY at execution: read both tests' current text first; adjust the absence-asserts to each cmd's
real UI — `newComment` may add a comment thread vs. open a pane; if it has side effects when blocked
fails, fall back to another unflipped RUN cmd e.g. `trackChanges` and record it.)

- [ ] **Step 1.2: Run** (`npm run build && npm run test:pm`) → still 130/130 (repointed tests pass
pre-flip — `newComment`/`tableOfContents` are blocked today).

- [ ] **Step 1.3: Append the `[6]` block** between `[5]` end and the `[0b]` header. Conventions carried
from `[5]`: `sleep(150)` rAF tick, `sleep(550)` to close history groups before one-undo asserts, string
returns are FAILURES, absence-asserts guarded by a proven presence first, `selectText` needles in
homogeneous text. Helpers: `PM()`, `setDoc`, `doc()`, `selectText`. New helper for round-trip:
`exportReopenText()` (already used at test-suite-pm.js ~321 — reuse) and a node-presence scanner
`hasNode(name)` = `doc().descendants` finds a node by type name.

```js
  // ---------- slice 6: insert-basics (link/image/bookmark/symbol/equation/break/hr + table insert) ----------
  // Every insert is a REAL PM transaction. Assert on doc().toJSON() nodes/marks + round-trip,
  // never on legacy #editor DOM.
  await PM().newBlank(); await sleep(100);
  const hasNode = (name) => { let f = false; doc().descendants((n) => { if (n.type.name === name) f = true; }); return f; };
  const hasMark = (name) => { let f = false; doc().descendants((n) => { if (n.marks && n.marks.some((m) => m.type.name === name)) f = true; }); return f; };

  await t('[6] insertLink applies a link mark with href over the display text', async () => {
    setDoc('click here please');
    selectText('click here'); await sleep(60);
    PM().insertLink({ href: 'https://example.com', text: 'click here' }); await sleep(120);
    if (!hasMark('link')) return 'no link mark';
    let href = null; doc().descendants((n) => { (n.marks || []).forEach((m) => { if (m.type.name === 'link') href = m.attrs.href; }); });
    return /example\.com/.test(href || '');
  });
  await t('[6] insertLink with new display text inserts that text + link', async () => {
    setDoc('prefix '); selectText(' '); // collapsed-ish; rely on caret
    PM().getEditor && null;
    // place caret at end, insert a link with explicit text
    PM().insertLink({ href: 'https://anthropic.com', text: 'Anthropic' }); await sleep(120);
    return doc().textContent.includes('Anthropic') && hasMark('link');
  });
  await t('[6] removeLink clears the link mark', async () => {
    setDoc('linked word'); selectText('linked word');
    PM().insertLink({ href: 'https://x.com', text: 'linked word' }); await sleep(80);
    selectText('linked word'); PM().removeLink(); await sleep(80);
    return !hasMark('link');
  });
  await t('[6] insertImage inserts an image node with the data-url src', async () => {
    setDoc('photo: ');
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    PM().insertImage({ src: px, alt: 'dot' }); await sleep(120);
    let src = null; doc().descendants((n) => { if (n.type.name === 'image') src = n.attrs.src; });
    return hasNode('image') && /^data:image\/png/.test(src || '');
  });
  await t('[6] insertBookmark wraps the selection in PAIRED start+end (same id)', async () => {
    setDoc('mark this range'); selectText('this range'); await sleep(60);
    PM().insertBookmark({ name: 'spot1' }); await sleep(120);
    let startId = null, endId = null, name = null;
    doc().descendants((n) => {
      if (n.type.name === 'bookmarkStart') { startId = n.attrs.id; name = n.attrs.name; }
      if (n.type.name === 'bookmarkEnd') endId = n.attrs.id;
    });
    return hasNode('bookmarkStart') && hasNode('bookmarkEnd') && startId != null && startId === endId && name === 'spot1';
  });
  await t('[6] listBookmarks returns inserted bookmarks; goToBookmark finds one', async () => {
    setDoc('alpha beta gamma'); selectText('beta');
    PM().insertBookmark({ name: 'bk_beta' }); await sleep(80);
    const list = PM().listBookmarks();
    const ok = Array.isArray(list) && list.some((b) => b.name === 'bk_beta');
    return ok && PM().goToBookmark('bk_beta') === true;
  });
  await t('[6] removeBookmark deletes the pair', async () => {
    setDoc('one two three'); selectText('two');
    PM().insertBookmark({ name: 'gone' }); await sleep(80);
    PM().removeBookmark('gone'); await sleep(80);
    return !hasNode('bookmarkStart') && !hasNode('bookmarkEnd');
  });
  await t('[6] insertSymbol inserts the unicode character as text', async () => {
    setDoc('temp ');
    PM().insertSymbol('©'); await sleep(80);
    return doc().textContent.includes('©');
  });
  await t('[6] insertEquation inserts styled Cambria Math italic text', async () => {
    setDoc('eq: ');
    PM().insertEquation('a² + b² = c²'); await sleep(120);
    if (!doc().textContent.includes('a²')) return 'equation text missing';
    let fam = null, ital = false;
    doc().descendants((n) => { (n.marks || []).forEach((m) => { if (m.type.name === 'textStyle' && m.attrs.fontFamily) fam = m.attrs.fontFamily; if (m.type.name === 'italic') ital = true; }); });
    return /Cambria Math/i.test(fam || '') && ital === true;
  });
  await t('[6] insertPageBreak inserts a hardBreak page-break node', async () => {
    setDoc('before break');
    PM().insertPageBreak(); await sleep(80);
    let pb = false; doc().descendants((n) => { if (n.type.name === 'hardBreak' && (n.attrs.pageBreakType === 'page')) pb = true; });
    return pb === true;
  });
  await t('[6] insertHr inserts a horizontalRule contentBlock node', async () => {
    setDoc('above line');
    PM().insertHr(); await sleep(80);
    let hr = false; doc().descendants((n) => { if (n.type.name === 'contentBlock' && n.attrs.horizontalRule) hr = true; });
    return hr === true;
  });
  await t('[6] insertTable inserts a table with the requested rows×cols', async () => {
    setDoc('table here');
    PM().insertTable({ rows: 3, cols: 4 }); await sleep(120);
    let rows = 0, cols = 0;
    doc().descendants((n) => { if (n.type.name === 'tableRow') rows++; });
    doc().descendants((n) => { if (n.type.name === 'tableRow' && cols === 0) cols = n.childCount; });
    return hasNode('table') && rows === 3 && cols === 4;
  });
  // ---- migrate the legacy 9 table ops (caret-in-table) ----
  await t('[6] table addRow below grows the row count', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableAddRow('below'); await sleep(100);
    let rows = 0; doc().descendants((n) => { if (n.type.name === 'tableRow') rows++; });
    return rows === 3;
  });
  await t('[6] table addColumn right grows each row', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableAddColumn('right'); await sleep(100);
    let cols = 0; doc().descendants((n) => { if (n.type.name === 'tableRow' && cols === 0) cols = n.childCount; });
    return cols === 3;
  });
  await t('[6] table deleteRow shrinks the row count', async () => {
    setDoc('x'); PM().insertTable({ rows: 3, cols: 2 }); await sleep(120);
    PM().tableDeleteRow(); await sleep(100);
    let rows = 0; doc().descendants((n) => { if (n.type.name === 'tableRow') rows++; });
    return rows === 2;
  });
  await t('[6] table deleteColumn shrinks each row', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 3 }); await sleep(120);
    PM().tableDeleteColumn(); await sleep(100);
    let cols = 99; doc().descendants((n) => { if (n.type.name === 'tableRow') cols = Math.min(cols, n.childCount); });
    return cols === 2;
  });
  await t('[6] table deleteTable removes the table node', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableDeleteTable(); await sleep(100);
    return !hasNode('table');
  });
  // NOTE (Critique B3): mergeCells/setCellBackground need a CellSelection, whose test helper
  // (tableSelectFirstRowPair) lands in Stage F. The merge test therefore lives in the [6b] block
  // (Task 10.3), NOT here — it would no-op + fail pre-6b. The 6a [6] block covers only the table
  // ops that work off a plain caret-in-cell (insert/delete row+col, header toggle).
  await t('[6] table toggleHeaderRow converts the first row to header cells', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableToggleHeaderRow(); await sleep(100);
    let hasHeaderCell = false; doc().descendants((n) => { if (n.type.name === 'tableHeader') hasHeaderCell = true; });
    return hasHeaderCell === true;
  });
  await t('[6] D6 flip: link dialog + table grid open in PM mode', async () => {
    // inverse of the pre-flip D6 block — proves the registry flip reached dispatch.
    window.WC.Commands.run({ cmd: 'link', label: 'Link' }); await sleep(80);
    const linkOpen = !!document.querySelector('.modal-backdrop');
    const bd = document.querySelector('.modal-backdrop'); bd && bd.querySelector('button') && (Array.from(bd.querySelectorAll('button')).find((b) => /Cancel/.test(b.textContent)) || {}).click?.();
    window.WC.Commands.dropdown({ cmd: 'table', type: 'dropdown' }, document.body); await sleep(60);
    const tableOpen = document.querySelectorAll('.flyout').length > 0;
    window.WC.closeFlyouts();
    return linkOpen && tableOpen;
  });
```

(VERIFY at execution: `tableSelectFirstRowPair` is a TEST-ONLY bridge helper added in Stage E that
sets a `CellSelection` over the first two cells — implement it alongside `tableSelect*`. If you prefer
no test-only surface, drive the merge via `tableInfo()` + `setCellSelection` directly in the test.)

- [ ] **Step 1.4: Run** → all 130 pre-existing PASS; the `[6]` block is RED (insert-basics blocked by
D6; bridge `insert.ts`/`table.ts` missing). Record unexpectedly-green pins. Commit
(`test: slice-6 insert-basics PM tests (red) + D6 repoint link→newComment, table→tableOfContents`).

### Task 2: validation prep — unzip-based docx inspection helper

**Files:** Create: `scripts/docx-inspect.js`; Modify: `scripts/oracle/README.md`

The oracle (`word-oracle.js`) has **no object-model verb** for tables/links/bookmarks/images — they
live in `word/document.xml` + `word/_rels/document.xml.rels` + `word/media/`. Validation is unzip-based.

- [ ] **Step 2.1:** Write `scripts/docx-inspect.js` — a tiny node CLI reusing `test_docx.js`'s unzip
approach (`adm-zip` or the same lib `test_docx.js` uses — grep it):

```js
'use strict';
// Unzip a .docx and surface the parts slice-6 validation needs.
const AdmZip = require('adm-zip'); // match test_docx.js's zip lib; swap if it uses another
const path = process.argv[2];
const zip = new AdmZip(path);
const read = (p) => { const e = zip.getEntry(p); return e ? e.getData().toString('utf8') : null; };
const documentXml = read('word/document.xml') || '';
const rels = read('word/_rels/document.xml.rels') || '';
const media = zip.getEntries().filter((e) => e.entryName.startsWith('word/media/')).map((e) => ({ name: e.entryName, bytes: e.getData().length }));
const out = {
  hyperlinks: [...documentXml.matchAll(/<w:hyperlink[^>]*r:id="([^"]+)"/g)].map((m) => m[1]),
  relTargets: [...rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => ({ id: m[1], target: m[2] })),
  bookmarks: [...documentXml.matchAll(/<w:bookmarkStart[^>]*w:id="([^"]+)"[^>]*w:name="([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2] })),
  bookmarkEnds: [...documentXml.matchAll(/<w:bookmarkEnd[^>]*w:id="([^"]+)"/g)].map((m) => m[1]),
  tables: (documentXml.match(/<w:tbl>/g) || []).length,
  rows: (documentXml.match(/<w:tr[ >]/g) || []).length,
  gridCols: (documentXml.match(/<w:gridCol /g) || []).length,
  blips: [...documentXml.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)].map((m) => m[1]),
  media,
};
console.log(JSON.stringify(out, null, 2));
```

- [ ] **Step 2.2:** Verify the zip lib. `grep -n "require(" scripts/test_docx.js | grep -iE "zip|adm"` —
use the SAME dependency (don't add a new one). Adjust the `require` line.
- [ ] **Step 2.3:** Document in `scripts/oracle/README.md`: a "Slice-6 unzip validation" note (the
oracle's AppleScript object model can't enumerate tables/links/bookmarks/images; use `docx-inspect.js`
for leg A; quirks #24-26 session-health still bind for any object-model read like text-readback).
Commit (`test(test): docx-inspect helper for slice-6 unzip round-trip validation`).

# Stage B — bridge insert surface (dispatch still blocks until the flip)

> Pattern: a new `installInsert(editor)` returns the insert verbs; `index.ts` spreads it into `WC.PM`.
> PM branches are reachable via direct `WC.PM` calls immediately; ribbon dispatch stays
> courtesy-blocked until the flip (Stage D). The `PMA()` ternary in commands.js/dialogs.js ignores
> FLIPPED, so dialog PM branches work pre-flip via direct calls (how the `[6]` tests drive them).

### Task 3: bridge — `insert.ts` (link, image, bookmark, symbol, equation, break, hr)

**Files:** Create: `src/renderer/bridge/insert.ts`; Modify: `src/renderer/bridge/index.ts`

- [ ] **Step 3.1: `insert.ts`** (new). Thin wrappers over fork commands; the editor state is the
record. Import `TextSelection` from the PM barrel (`@/pm` — grep how `state-sync.ts`/`search.ts` import
PM classes; the established `__PM_TextSelection` global may also be used in tests):

```ts
// Slice 6: insert-primitive surface. Each verb is one PM transaction (one undo step).
type AnyEditor = any

export interface LinkOpts { href: string; text?: string }
export interface ImageOpts { src: string; alt?: string }
export interface BookmarkInfo { name: string; id: string; pos: number }

export function installInsert(editor: AnyEditor) {
  const schema = () => editor.state.schema

  function insertLink(opts: LinkOpts): boolean {
    // setLink handles "text differs from selection" (inserts text, then marks) and
    // auto-adds underline (Word-faithful) + allocates the docx relationship id.
    return editor.chain().focus().setLink({ href: opts.href, text: opts.text ?? opts.href }).run()
  }
  function removeLink(): boolean { return editor.chain().focus().unsetLink().run() }

  function insertImage(opts: ImageOpts): boolean {
    const ok = editor.chain().focus().setImage({ src: opts.src, alt: opts.alt ?? 'Picture' }).run()
    // Minor hardening (not required for round-trip — export hashes the data-url into
    // word/media regardless): mirror import behavior so storage.media is canonical.
    try { const st = (editor as any).storage?.image; if (st && st.media && !(opts.src in st.media)) st.media[opts.src] = opts.src } catch { /* best-effort */ }
    return ok
  }

  function insertBookmark(opts: { name: string }): boolean {
    // B1: insertBookmark (fork) inserts ONLY bookmarkStart. A valid Word bookmark is a
    // PAIRED start+end with the same id wrapping [from,to]. Insert end FIRST (higher pos)
    // so the start insertion doesn't shift the end position. One transaction = one undo.
    const name = String(opts.name || '').trim().replace(/\s+/g, '_')
    if (!name) return false
    const id = String(nextBookmarkId(editor))
    const { from, to } = editor.state.selection
    return editor.chain().focus().command(({ tr, state }: any) => {
      const start = state.schema.nodes.bookmarkStart.create({ name, id })
      const end = state.schema.nodes.bookmarkEnd.create({ id })
      tr.insert(to, end)
      tr.insert(from, start)
      return true
    }).run()
  }
  function listBookmarks(): BookmarkInfo[] {
    const out: BookmarkInfo[] = []
    editor.state.doc.descendants((n: any, pos: number) => { if (n.type.name === 'bookmarkStart') out.push({ name: n.attrs.name, id: n.attrs.id, pos }) })
    return out
  }
  function goToBookmark(name: string): boolean { return editor.chain().focus().goToBookmark(name).run() }
  function removeBookmark(name: string): boolean { return editor.chain().focus().removeBookmark(name).run() }
  function renameBookmark(name: string, newName: string): boolean { return editor.chain().focus().renameBookmark(name, String(newName).trim().replace(/\s+/g, '_')).run() }

  function insertSymbol(ch: string): boolean { return editor.chain().focus().insertContent(ch).run() }

  function insertEquation(text: string): boolean {
    // Styled text (Cambria Math italic) — NOT an OOXML Math node (KNOWN DEVIATION).
    // Insert the text, then SELECT the inserted range and mark it, so the marks land on
    // the equation (after insertContent the caret is collapsed past it). One transaction.
    const TextSelection = (window as any).__PM_TextSelection // exported from main.ts (test/probe pattern)
    const from = editor.state.selection.from
    return editor.chain().focus()
      .insertContent(text)
      .command(({ tr }: any) => { const end = from + text.length; tr.setSelection(TextSelection.create(tr.doc, from, Math.min(end, tr.doc.content.size))); return true })
      .setFontFamily('Cambria Math')
      .setMark('italic')
      .run()
  }

  function insertPageBreak(): boolean { return editor.chain().focus().insertPageBreak().run() }
  function insertBlankPage(): boolean { return editor.chain().focus().insertPageBreak().insertPageBreak().run() }
  function insertHr(): boolean { return editor.chain().focus().insertHorizontalRule().run() }

  return { insertLink, removeLink, insertImage, insertBookmark, listBookmarks, goToBookmark, removeBookmark, renameBookmark, insertSymbol, insertEquation, insertPageBreak, insertBlankPage, insertHr }
}

// Next free bookmark id = max existing numeric id + 1 (Word uses 0-based integer ids).
function nextBookmarkId(editor: AnyEditor): number {
  let max = -1
  editor.state.doc.descendants((n: any) => { if (n.type.name === 'bookmarkStart') { const v = parseInt(n.attrs.id, 10); if (Number.isFinite(v) && v > max) max = v } })
  return max + 1
}
```

(VERIFY at execution: (a) `setMark('italic')` — confirm the fork exposes `setMark` as a chainable cmd
or use the italic extension's `toggleItalic` (fresh text → ON; idempotent only if not already italic —
prefer `setMark('italic')` if available, else `command` that adds the mark explicitly). (b) Confirm
`__PM_TextSelection` is exported from `main.ts`; if not, export it (the established pattern, spec §5.5).
(c) `setLink` return — it returns false if href sanitization fails; surface that to the dialog.
(d) image `storage.image.media` path — confirm `editor.storage.image` exists; if the storage key differs,
adjust or drop the hardening (round-trip works without it).)

- [ ] **Step 3.2: index.ts wiring.** Import + spread `installInsert(editor)` next to `installSearch`
(index.ts:251). Add pre-mount stubs in `preinstallBridge` (after the search stubs ~index.ts:220):

```ts
    insertLink: () => false, removeLink: () => false, insertImage: () => false,
    insertBookmark: () => false, listBookmarks: () => [], goToBookmark: () => false,
    removeBookmark: () => false, renameBookmark: () => false,
    insertSymbol: () => false, insertEquation: () => false,
    insertPageBreak: () => false, insertBlankPage: () => false, insertHr: () => false,
```

- [ ] **Step 3.3: Probe + gates.** `npm run build`, devtools: `WC.PM.insertLink({href:'https://x.com',text:'x'})`
→ true + a link mark; `WC.PM.insertBookmark({name:'b'})` → paired nodes; `WC.PM.insertEquation('x²')` →
Cambria Math italic; `WC.PM.insertImage({src:'data:image/png;base64,...'})` → image node. The `[6]`
insert-primitive tests go green (link/image/bookmark/symbol/equation/break/hr); table tests stay red.
All five gates. Commit (`feat(ribbon): bridge insert-primitive surface — link/image/bookmark/symbol/equation/break/hr`).

### Task 4: bridge — `table.ts` (insertion + the 9 legacy ops + header/shading)

**Files:** Create: `src/renderer/bridge/table.ts`; Modify: `src/renderer/bridge/index.ts`, `src/renderer/bridge/state-sync.ts`

- [ ] **Step 4.1: `table.ts`** (new) — Part-6a verbs only (the 6b extras append in Stage E):

```ts
// Slice 6: table surface. Insertion + the legacy 9 ops mapped onto fork table commands.
type AnyEditor = any

export function installTable(editor: AnyEditor) {
  function insertTable(opts: { rows?: number; cols?: number; withHeaderRow?: boolean } = {}): boolean {
    const rows = Math.max(1, Math.min(1000, Math.floor(opts.rows ?? 3)))
    const cols = Math.max(1, Math.min(1000, Math.floor(opts.cols ?? 3)))
    return editor.chain().focus().insertTable({ rows, cols, withHeaderRow: !!opts.withHeaderRow }).run()
  }
  function tableAddRow(dir: 'above' | 'below'): boolean { return editor.chain().focus()[dir === 'above' ? 'addRowBefore' : 'addRowAfter']().run() }
  function tableAddColumn(dir: 'left' | 'right'): boolean { return editor.chain().focus()[dir === 'left' ? 'addColumnBefore' : 'addColumnAfter']().run() }
  function tableDeleteRow(): boolean { return editor.chain().focus().deleteRow().run() }
  function tableDeleteColumn(): boolean { return editor.chain().focus().deleteColumn().run() }
  function tableDeleteTable(): boolean { return editor.chain().focus().deleteTable().run() }
  function tableMerge(): boolean { return editor.chain().focus().mergeCells().run() }
  function tableSplitCell(): boolean { return editor.chain().focus().splitCell().run() }
  function tableToggleHeaderRow(): boolean { return editor.chain().focus().toggleHeaderRow().run() }
  function tableToggleHeaderColumn(): boolean { return editor.chain().focus().toggleHeaderColumn().run() }
  function tableSetCellShading(color: string): boolean { return editor.chain().focus().setCellBackground(color).run() }
  function tableSetCellVAlign(v: 'top' | 'middle' | 'bottom'): boolean { return editor.chain().focus().setCellAttr('verticalAlign', v).run() }

  // Is the selection inside a table? (drives the contextual-tab show/hide + Table Tools state)
  function isInTable(): boolean {
    const { $from } = editor.state.selection
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') return true
    return false
  }
  // Lightweight context for the Table Tools UI (cell pos for menu anchoring etc.).
  function tableInfo(): { inTable: boolean } { return { inTable: isInTable() } }

  return { insertTable, tableAddRow, tableAddColumn, tableDeleteRow, tableDeleteColumn, tableDeleteTable, tableMerge, tableSplitCell, tableToggleHeaderRow, tableToggleHeaderColumn, tableSetCellShading, tableSetCellVAlign, isInTable, tableInfo }
}
```

(VERIFY at execution: the fork merge/split need a `CellSelection`. `mergeCells`/`splitCell` operate on
the current selection; for the ribbon/context-menu they run on the user's live cell selection. For
TESTS, add a `tableSelectFirstRowPair()` test-only helper that builds a `CellSelection` over the first
two cells via `setCellSelection({anchorCell, headCell})` — compute the two cell positions from the
table node. Confirm `addColumnBefore/After` chain correctly off `editor.chain()` — they internally
`chain().run()`, so prefer `editor.commands.addColumnAfter()` if the chain double-wraps; test both.)

- [ ] **Step 4.2: state-sync `inTable`.** In `state-sync.ts`, after computing the query state, add
`st.inTable = WC.PM.isInTable()` (or compute inline from the selection) and call the contextual-tab
sync (added in Stage F): `;(window as any).WC?.TableToolsPM?.syncContextualTabs?.(st.inTable)`. Keep
this a no-op until Stage F lands the module (optional-chained). Verify the state-sync object the ribbon
reads gains `inTable` without breaking existing toggles.

- [ ] **Step 4.3: index.ts wiring + stubs.** Spread `installTable(editor)` next to `installInsert`.
Pre-mount stubs:

```ts
    insertTable: () => false, tableAddRow: () => false, tableAddColumn: () => false,
    tableDeleteRow: () => false, tableDeleteColumn: () => false, tableDeleteTable: () => false,
    tableMerge: () => false, tableSplitCell: () => false,
    tableToggleHeaderRow: () => false, tableToggleHeaderColumn: () => false,
    tableSetCellShading: () => false, tableSetCellVAlign: () => false,
    isInTable: () => false, tableInfo: () => ({ inTable: false }),
```

- [ ] **Step 4.4: Probe + gates.** devtools: `WC.PM.insertTable({rows:3,cols:4})` → table; caret inside
→ `WC.PM.tableAddRow('below')` grows rows; `tableDeleteColumn()` shrinks cols; `tableToggleHeaderRow()`
→ tableHeader cells. The `[6]` table tests go green (except any needing the contextual UI). All five
gates. Commit (`feat(ribbon): bridge table surface — insertion + the 9 ops + header/shading`).

# Stage C — entry-point rewrites (dispatch still blocks until the flip)

### Task 5: PM branches in the insert dialogs + handlers

**Files:** Modify: `src/renderer/public/js/commands.js`, `dialogs.js`, `insert-features.js`

Pattern (commands.js): `const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { <PM>; return; } <legacy>`.

- [ ] **Step 5.1: `commands.js` handlers.** Add PM branches (keep legacy arms byte-identical below):
  - `H.pictures` (line 121): PM branch → `const r = await window.wordAPI.pickImage(); if (r && r.ok) WC.PM.insertImage({ src: r.dataUrl, alt: r.name || 'Picture' });` (no `E().insertHTML`, no repaginate).
  - `H.pageBreak` (line 131): PM branch → `WC.PM.insertPageBreak();`
  - `H.blankPage` (line 132): PM branch → `WC.PM.insertBlankPage();`
  - `H.horizontalLine` (line 143): PM branch → `WC.PM.insertHr();`
  - `H.symbol`/`H.equation`/`H.link`/`H.bookmark`/`H.table` need NO change here — they call their
    dialogs, whose PM branches (Step 5.2/5.3) do the routing. Confirm the ternary lands inside the
    DIALOG, not the handler, so both the ribbon click and any direct dialog call route to PM.

```js
  H.pictures = async () => {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    const r = await window.wordAPI.pickImage();
    if (!r || !r.ok) return;
    if (pm) { pm.insertImage({ src: r.dataUrl, alt: r.name || 'Picture' }); return; }
    E().insertHTML(`<img src="${r.dataUrl}" alt="${WC.escapeHtml(r.name || '')}">`);
    E().node.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', () => E().repaginate(), { once: true }); });
  };
  H.pageBreak = () => { const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { pm.insertPageBreak(); return; } insertPageBreak(); };
  H.blankPage = () => { const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { pm.insertBlankPage(); return; } insertBlankPage(); };
  H.horizontalLine = () => { const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { pm.insertHr(); return; } E().insertHTML('<hr>'); };
```

- [ ] **Step 5.2: `dialogs.js` — `D.insertLink`, `D.symbol`, `D.equation`, `D.insertTable`.**
  - `D.insertLink` (line 49): in the OK handler, branch — `if (pm) pm.insertLink({ href: url, text: label }); else E().insertHTML(...)`. Use the existing `WC.safeUrl`/`escapeHtml` for the legacy arm; for PM pass the raw url (setLink sanitizes). Capture selection before opening (slice-4 `WC.PM.captureSelection()` pattern) so the dialog's selection round-trips.
  - `D.symbol` (line 71): the flyout cell click → `if (pm) pm.insertSymbol(s); else E().insertHTML(s);`. Same for `Insert.symbolDialog`.
  - `D.equation` (line 86): Insert handler → `if (pm) pm.insertEquation(ta.value.trim()); else E().insertHTML(...)`.
  - `D.insertTable` (line 12): the grid-cell click `build(r+1,c+1)` and the OK `build(rows,cols)` → in `build()`, `if (pm) { pm.insertTable({ rows, cols }); return true; } E().insertHTML(html);`.

```js
  // D.insertLink OK handler (PM branch):
  onClick: () => {
    const raw = addr.value.trim(); if (!raw) return;
    const label = text.value.trim() || raw;
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    if (pm) { pm.insertLink({ href: raw, text: label }); return; }
    const url = WC.safeUrl(raw);
    E().insertHTML(`<a href="${WC.escapeHtml(url)}">${WC.escapeHtml(label)}</a>&nbsp;`);
  }
```

- [ ] **Step 5.3: `insert-features.js` — `Insert.bookmarkDialog`, `Insert.tableMenu`, `Insert.convertTextToTable`.**
  - `Insert.bookmarkDialog` (line 298): PM branch builds the SAME dialog chrome but lists bookmarks via
    `WC.PM.listBookmarks()`, Add → `WC.PM.insertBookmark({name})`, Go → `WC.PM.goToBookmark(name)`,
    Delete → `WC.PM.removeBookmark(name)`. Legacy arm unchanged.
  - `Insert.tableMenu` (line 79): the grid click `Insert.buildTable(r+1,c+1)` and Quick Tables presets →
    in `Insert.buildTable`, branch `if (pm) { pm.insertTable({ rows, cols }); return; } <legacy insertHTML>`.
    "Insert Table…" → `D.insertTable` (already PM-branched). "Convert Text to Table…" → `Insert.convertTextToTable`
    (PM branch in 6b via `textToTable`; for 6a, PM-mode toasts "available in Table Tools" OR routes to a
    basic `insertTable` — record the choice). "Draw Table"/"Excel Spreadsheet"/"Quick Tables" → PM:
    `insertTable` with the computed rows/cols (Excel-sheet styling deferred — record).
  - `Insert.convertTextToTable` (line 59): 6a → PM-mode toast "Convert Text to Table is available in
    Table Tools (slice 6b)"; the real `textToTable` fork command lands in Stage E.

```js
  // Insert.buildTable (PM branch) — used by grid, Quick Tables, Draw Table:
  Insert.buildTable = function (rows, cols) {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    if (pm) { pm.insertTable({ rows, cols }); return; }
    /* …existing legacy insertHTML body verbatim… */
  };
```

- [ ] **Step 5.4: Probe + gates.** `npm start`: each insert dialog/menu now routes to PM (highlights:
the link dialog inserts a real PM hyperlink; Insert > Table grid inserts a PM table; bookmark dialog
lists PM bookmarks). The `[6]` dialog-path assertions go green where present; the D6-flip test stays
red (registry not flipped). All five gates. Commit
(`feat(ribbon): re-point insert dialogs/menus onto the PM engine (link/image/symbol/equation/table/bookmark)`).

# Stage D — THE FLIP + gates + oracle (6a complete)

### Task 6: legacy table-tools guard + THE FLIP + app.js + exotica carve-out (one commit)

**Files:** Modify: `src/renderer/public/js/table-tools.js`, `src/renderer/bridge/index.ts`, `src/renderer/public/js/app.js`

- [ ] **Step 6.1 (B2): guard legacy `WC.Table` methods.** In `table-tools.js`, add a `pmGuard` check at
the TOP of each mutating method (`insertRow`, `deleteRow`, `insertColumn`, `deleteColumn`, `deleteTable`,
`mergeRight`, `splitCell`). The legacy context menu is on the hidden `#editor` (unreachable in PM mode),
so this is belt-and-suspenders — any direct call no-ops + toasts in PM mode:

```js
  const pmBlock = () => { const pm = window.WC.PM; if (pm && pm.active && pm.ready) { pm.notifyBlocked('Table edit'); return true; } return false; };
  // …at the start of insertRow/deleteRow/insertColumn/deleteColumn/deleteTable/mergeRight/splitCell:
  insertRow(dir, cell) { if (pmBlock()) return; /* …existing body… */ },
```

- [ ] **Step 6.2: THE FLIP + exotica carve-out.** In `bridge/index.ts`:
  - Add `'insert-basics'` to the `FLIPPED` set (line 29). THE auditable switch.
  - Carve the 15 exotic cmds OUT of `insert-basics` in the AREA map (lines 57-61): re-map
    `onlinePictures, screenshot, icons, smartart, chart, onlineVideo, dropCap, wordart, textBox, object,
    signatureLine, dateTime, coverPage, quickParts` → a NEW `'insert-exotica'` key; `crossReference` →
    `'references'`. Keep `table, link, bookmark, pageBreak, blankPage, symbol, equation, horizontalLine,
    pictures` mapped to `insert-basics` (these flip).

```ts
const FLIPPED = new Set<string>(['character', 'history', 'paragraph', 'lists', 'styles', 'clipboard', 'editing-misc', 'find-replace', 'insert-basics']) // slices 1-6
// …in AREA, the insert section becomes:
  // insert basics (slice 6) — these FLIP
  table: 'insert-basics', link: 'insert-basics', bookmark: 'insert-basics', pageBreak: 'insert-basics',
  blankPage: 'insert-basics', symbol: 'insert-basics', equation: 'insert-basics',
  horizontalLine: 'insert-basics', pictures: 'insert-basics',
  // insert exotica (slice 10) — STAY blocked (carved out of insert-basics in the slice-6 flip)
  onlinePictures: 'insert-exotica', screenshot: 'insert-exotica', icons: 'insert-exotica',
  smartart: 'insert-exotica', chart: 'insert-exotica', onlineVideo: 'insert-exotica',
  dropCap: 'insert-exotica', wordart: 'insert-exotica', textBox: 'insert-exotica',
  object: 'insert-exotica', signatureLine: 'insert-exotica', dateTime: 'insert-exotica',
  coverPage: 'insert-exotica', quickParts: 'insert-exotica',
  crossReference: 'references', // slice 9 (fork has the cross-reference extension)
```

- [ ] **Step 6.3 (B2-shortcut): app.js `Ctrl+K`.** Wrap the bare handler (app.js:80) in
`pmBlockedOr('insert-basics', …)` — SAME commit as the flip (guarded pre-flip, active post-flip):

```js
  if (k === 'k') return pmBlockedOr('insert-basics', () => WC.Dialogs.insertLink());
```

Verify `Ctrl+Enter`/pageBreak (line 74) is already `pmBlockedOr('insert-basics', …)` (it is — leave it).

- [ ] **Step 6.4: Run the full PM suite.** `npm run build && npm run test:pm` → the `[6]` block goes
fully GREEN (incl. the D6-flip test). Triage any async dialog-poll failures (tick adjustment, not logic).
Then ALL FIVE gates: legacy 257, smoke 9×2, docx 17, PM ~150. Commit
(`feat(ribbon): flip insert-basics onto the PM engine + Ctrl+K guard + exotica carve-out`).

### Task 7: oracle validation (spec §8.3) — legs A/B for the primitives + table insertion

**Files:** evidence into `docs/superpowers/plans/notes/2026-06-09-slice6-oracle-*.json`

- [ ] **Step 7.0: Ask the USER to relaunch Word WINDOWED** (oracle README quirks #24-26). Don't proceed
headlessly without confirmation.
- [ ] **Step 7.1: Leg A (clone → Word) — unzip-based.** In the clone, insert: a hyperlink
(`https://example.com`), a 3×4 table, a picture (the 1×1 PNG data-url), and a bookmark over a word.
Save via bytes-IPC → run `node scripts/docx-inspect.js /tmp/slice6-legA.docx`. Assert: `hyperlinks`
has 1 rId whose `relTargets` Target is `https://example.com`; `tables===1`, `rows===3`, `gridCols===4`;
`blips` has 1 rId + `media` has 1 file with bytes>0; `bookmarks` has the name + a matching `bookmarkEnds`
id. **No stray markup leaked.** JSON verdict.
- [ ] **Step 7.2: Leg A reopen in real Word.** Open `/tmp/slice6-legA.docx` via the oracle
(`roundtrip` verb) → re-save → re-`docx-inspect` → the link/table/image/bookmark survive Word's own
round-trip (Word didn't drop or "repair" them). JSON verdict.
- [ ] **Step 7.3: Leg B (Word → clone).** In real Word, author a doc with a hyperlink + a 2×3 table +
a bookmark, save, import via `WC.PM.openDocx` → assert `doc().toJSON()` has the `link` mark, a `table`
(2 rows × 3 cols), and a paired `bookmarkStart`/`bookmarkEnd`. JSON verdict.
- [ ] **Step 7.4: Word left clean** (doc count at baseline, never quit). Commit
(`test(test): slice-6 oracle legs A/B — link/table/image/bookmark round-trip`).

> **6a is shippable here.** If shipping 6a/6b as two PRs: run the Stage-I checkpoint+PR steps for 6a
> now (banners → "slice 6a BUILT, 6b next"), then continue to Stage E. If one PR: continue to Stage E
> and do the single checkpoint+PR at the end.

---

# ░░░ PART 6b — FULL TABLE TOOLS (net-new) ░░░

# Stage E — fork table commands (NOTICE-documented)

### Task 8: new fork table commands (model/attr-setting; pagination visuals deferred)

**Files:** Modify: `src/renderer/core/superdoc-fork/extensions/table/table.js`,
`table-cell/table-cell.js`, `table-header/table-header.js`, `NOTICE.md`

All of these operate on EXISTING node attrs (inventory agent #2 confirmed the attrs exist) via
`tr.setNodeMarkup(tablePos, null, {...attrs})` or `setCellAttr`, EXCEPT `textDirection` which needs a
new cell attr. Add them as new entries in the `addCommands` block (after `deleteCellAndTableBorders`,
~line 1460). Helper `getTablePos(state)` (find the ancestor table node pos from the selection) — grep
the file for an existing table-locating helper (`selectedRect`/`isInTable`); reuse it.

- [ ] **Step 8.1: `setTableStyle(styleId)`** — `setNodeMarkup(tablePos, null, { ...table.attrs, tableStyleId: styleId })`.
  (Visual cascade of style borders/shading is Phase-7 paint — the styleId lands + round-trips now.)
- [ ] **Step 8.2: `setTableAlignment(align)`** — `'left'|'center'|'right'` → `setNodeMarkup` `justification`.
- [ ] **Step 8.3: `setTableIndent(px)`** — `setNodeMarkup` `tableIndent: { width: px }`.
- [ ] **Step 8.4: `setCellWidth(px)`** — `setCellAttr('colwidth', [px])` on the selected cell(s).
- [ ] **Step 8.5: `setRowHeight(px, rule)`** — `setNodeMarkup(rowPos, null, { ...row.attrs, rowHeight: px, tableRowProperties: {...row.attrs.tableRowProperties, rowHeight: { value: px, rule } } })`.
- [ ] **Step 8.6: `setCellMargins(margins)`** — `setCellAttr('cellMargins', { top, right, bottom, left })`.
- [ ] **Step 8.7: `setCellBorders(borders)`** — `setCellAttr('borders', borders)` (the OOXML border spec
  shape: `{ top|bottom|left|right: { val, color, size } }`); the existing `deleteCellAndTableBorders`
  is the clear path; this is the set path.
- [ ] **Step 8.8: `distributeColumnsEvenly()`** — compute `tableWidth / colCount`, `setCellAttr('colwidth', [w])`
  across the row's cells (best-effort; exact pixel landing refines under Phase-7 layout — record).
- [ ] **Step 8.9: `distributeRowsEvenly()`** — set each selected row's `rowHeight` to the average
  (pagination-gated VISUAL → attr lands, height honored under Phase-7 — record).
- [ ] **Step 8.10: `splitTableAtRow()`** — split the table at the current row boundary into two tables
  (close the first table before the row, open a new table from the row). Edge cases: merged cells across
  the boundary → record a deviation (refuse or fix via `fixTables`).
- [ ] **Step 8.11: `convertTableToText(delimiter='\t')`** — replace the table node with paragraphs whose
  cell text is joined by `delimiter` per row.
- [ ] **Step 8.12: `convertTextToTable(delimiter)`** — parse selected paragraphs (split each on `delimiter`)
  into a table node (rows = paras, cols = max split count); replace the selection with the table.
- [ ] **Step 8.13: `setTextDirection(dir)`** — add a `textDirection: { default: null }` attr to
  `table-cell.js` + `table-header.js` `addAttributes` (renderDOM → `writing-mode: vertical-rl` for `'tbRl'`,
  `vertical-lr` for `'btLr'`), and a command `setCellAttr('textDirection', dir)`. (Complex BiDi/vertical
  metrics are Phase-7 polish — the attr + basic writing-mode land now; record.)
- [ ] **Step 8.14: `autoFitTable(mode)`** — `'fixed'` sets `tableLayout: 'fixed'` (works now);
  `'contents'`/`'window'` need live measurement → set the intent attr + best-effort, VISUAL deferred to
  Phase-7 (record). `'window'` ≈ table width 100%.
- [ ] **Step 8.15: NOTICE.md.** One bullet per new command + the `textDirection` attr (slice 6, 2026-06-09).
- [ ] **Step 8.16: Probe + gates.** devtools: each command mutates the right attr (read back via
  `WC.editor.state.doc` table node attrs); save→`docx-inspect` shows the attr in `w:tblPr`/`w:tcPr`.
  All five gates. Commit (`feat(editor): table-tools commands — style/size/margins/borders/align/distribute/split/convert/text-direction/autofit (NOTICE'd)`).

# Stage F — bridge table extras + the contextual ribbon tabs + PM context menu

### Task 9: bridge — `table.ts` 6b verbs

**Files:** Modify: `src/renderer/bridge/table.ts`, `src/renderer/bridge/index.ts`

- [ ] **Step 9.1:** Append to `installTable` (mirror Step 4.1 style) thin wrappers:
`tableSetStyle(id)`, `tableSetAlignment(a)`, `tableSetIndent(px)`, `tableSetCellWidth(px)`,
`tableSetRowHeight(px,rule)`, `tableSetCellMargins(m)`, `tableSetCellBorders(b)`,
`tableDistributeColumns()`, `tableDistributeRows()`, `tableSplit()`, `tableToText(d)`, `textToTable(d)`,
`tableSetTextDirection(dir)`, `tableAutoFit(mode)` — each `editor.chain().focus().<forkCmd>(...).run()`.
Plus `tableSelectFirstRowPair()` (test helper, Step 4.1 note) and an enriched `tableInfo()` returning
`{ inTable, rows, cols, styleId, alignment }` read off the table node for the Table Tools state.
- [ ] **Step 9.2: index.ts stubs** for all 6b verbs (`() => false`). Commit
(`feat(ribbon): bridge table-tools extras surface`).

### Task 10: Table Layout + Table Design contextual ribbon tabs + PM context menu

**Files:** Create: `src/renderer/public/js/table-tools-pm.js`; Modify: `src/renderer/public/js/ribbon.js`
(multi-tab extension — B2), `src/renderer/public/js/commands.js` (new `H[cmd]` table-tools handlers — B1),
`src/renderer/bridge/index.ts` (AREA-map entries for the new cmds), `src/renderer/index.html` (load
`table-tools-pm.js` after line 50), `src/renderer/bridge/state-sync.ts` (calls `syncContextualTabs`).

> ⚠️ **CORRECTED APPROACH (Critique B1/B2/B4) — this supersedes the wiring in the Step 10.1 code below.**
> The `table-tools-pm.js` block below is the authoritative **control INVENTORY** (which controls each
> tab/group holds), but its inline `onClick` handlers are WRONG: the ribbon renderer ignores `onClick`
> and dispatches controls by `{ cmd, label, type }` → `WC.Commands.run/dropdown({cmd})` → `H[cmd]`
> (header-footer.js:33-66 is the exact precedent). Build it as follows:
>
> - **Step 10.0a (B2) — extend `ribbon.js` for MULTIPLE contextual tabs.** Today `showContextualTab`
>   keeps a single `this._ctxTab` and `hideContextualTab()` takes no id (ribbon.js:321-345). Make it
>   backward-compatible: keep `_ctxTab`/`_ctxPrev` working for Header & Footer's single-tab call, but
>   track injected contextual tabs in a `this._ctxTabs = this._ctxTabs || []` array; `showContextualTab(def)`
>   appends if not present (no longer auto-hiding the previous one); `hideContextualTab(id)` removes the
>   named tab (and its panel), `hideContextualTab()` with no arg removes ALL (preserving today's
>   behavior). Re-run the **257 legacy gate** — it MUST stay byte-identical (Header & Footer enter/exit
>   still shows/hides exactly one tab). If any legacy test asserts the single-tab internals, fall back to
>   ONE combined "Table" contextual tab (all Layout+Design groups) and record the deviation.
> - **Step 10.0b (B1) — new `H[cmd]` handlers in `commands.js`** (each routes to `WC.PM`, PM-only —
>   these cmds only exist on the contextual tabs which only show in PM mode):
>   `H.tblInsertAbove = () => WC.PM.tableAddRow('above')`, `tblInsertBelow`→`tableAddRow('below')`,
>   `tblInsertLeft`→`tableAddColumn('left')`, `tblInsertRight`→`tableAddColumn('right')`,
>   `tblDeleteRow`→`tableDeleteRow()`, `tblDeleteColumn`→`tableDeleteColumn()`, `tblDeleteTable`→`tableDeleteTable()`,
>   `tblMerge`→`tableMerge()`, `tblSplitCell`→`tableSplitCell()`, `tblSplitTable`→`tableSplit()`,
>   `tblDistRows`→`tableDistributeRows()`, `tblDistCols`→`tableDistributeColumns()`,
>   `tblHeaderRow`→`tableToggleHeaderRow()`, `tblHeaderCol`→`tableToggleHeaderColumn()`,
>   `tblToText`→`tableToText('\t')`, `tblVAlignTop/Mid/Bottom`→`tableSetCellVAlign('top'|'middle'|'bottom')`,
>   `tblTextDir`→`tableSetTextDirection('tbRl')`, `tblAlignLeft/Center/Right`→`tableSetAlignment(...)`.
>   **Dropdown** cmds get `WC.Commands.dropdown` custom handlers (like other ribbon dropdowns —
>   commands.js:918 routes `table`→`Insert.tableMenu`): `tblAutoFit`→a flyout (Contents/Window/Fixed →
>   `tableAutoFit(mode)`); `tblStyles`→style-gallery flyout (`tableSetStyle(id)`); `tblShading`→swatch
>   flyout (`tableSetCellShading(color)`); `tblBorders`→borders flyout (`tableSetCellBorders(spec)`);
>   `tblCellMargins`→`WC.Dialogs.tableProperties()` (or toast-defer).
> - **Step 10.0c — AREA-map entries.** Add the new `tbl*` cmd ids to `bridge/index.ts` AREA under
>   `'insert-basics'` so the flip un-blocks them (they only render in PM mode anyway; mapping them keeps
>   the dispatch audit honest). OR leave them unmapped (`isBlocked` returns false → they dispatch and
>   call `WC.PM` directly). RECOMMENDATION: map them to `insert-basics` for auditability.
> - **The `contextualTab()` defs** in `table-tools-pm.js` therefore use `{ cmd: 'tblInsertAbove',
>   label: 'Insert Above', type: 'button' }` (and `type: 'dropdown'` for styles/shading/borders/autofit)
>   — NOT `onClick`. `syncContextualTabs(inTable)` calls `WC.Ribbon.showContextualTab(designTab())` and
>   `showContextualTab(layoutTab())` (now both coexist via Step 10.0a), and on leave
>   `hideContextualTab('table-design'); hideContextualTab('table-layout')`.
> - **Step 10.0d (B4) — the PM context menu is OPTIONAL + scoped.** The contextual tabs are the primary
>   editing affordance. If kept, the `#pm-editor` `contextmenu` listener must `preventDefault` ONLY when
>   `WC.PM.isInTable()` AND the target is inside a `td/th`, and Step 10.4 MUST verify PM's native
>   cell-selection (Shift/Ctrl-drag) + column-resize still work. If the probe shows conflict, DEFER the
>   context menu and record it (the contextual tab covers all ops).

- [ ] **Step 10.1: `table-tools-pm.js`** — mirror `header-footer.js`'s `contextualTab()` +
`WC.Ribbon.showContextualTab(def)` pattern. Define TWO contextual tab defs:

```js
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const PM = () => (WC.PM && WC.PM.active && WC.PM.ready) ? WC.PM : null;
  let shown = false;

  function layoutTab() {
    return { id: 'table-layout', name: 'Table Layout', contextual: true, groups: [
      { id: 'tl-rowscols', name: 'Rows & Columns', controls: [
        { id: 'tl-insAbove', name: 'Insert Above', icon: 'tableInsertRow', onClick: () => PM() && PM().tableAddRow('above') },
        { id: 'tl-insBelow', name: 'Insert Below', icon: 'tableInsertRow', onClick: () => PM() && PM().tableAddRow('below') },
        { id: 'tl-insLeft', name: 'Insert Left', icon: 'tableInsertColumn', onClick: () => PM() && PM().tableAddColumn('left') },
        { id: 'tl-insRight', name: 'Insert Right', icon: 'tableInsertColumn', onClick: () => PM() && PM().tableAddColumn('right') },
        { id: 'tl-delRow', name: 'Delete Row', icon: 'tableDeleteRow', onClick: () => PM() && PM().tableDeleteRow() },
        { id: 'tl-delCol', name: 'Delete Column', icon: 'tableDeleteColumn', onClick: () => PM() && PM().tableDeleteColumn() },
        { id: 'tl-delTable', name: 'Delete Table', icon: 'delete', onClick: () => PM() && PM().tableDeleteTable() },
      ] },
      { id: 'tl-merge', name: 'Merge', controls: [
        { id: 'tl-merge1', name: 'Merge Cells', icon: 'mergeCells', onClick: () => PM() && PM().tableMerge() },
        { id: 'tl-split1', name: 'Split Cells', icon: 'splitCells', onClick: () => PM() && PM().tableSplitCell() },
        { id: 'tl-splitT', name: 'Split Table', icon: 'splitTable', onClick: () => PM() && PM().tableSplit() },
      ] },
      { id: 'tl-cellsize', name: 'Cell Size', controls: [
        { id: 'tl-distR', name: 'Distribute Rows', icon: 'distributeRows', onClick: () => PM() && PM().tableDistributeRows() },
        { id: 'tl-distC', name: 'Distribute Columns', icon: 'distributeColumns', onClick: () => PM() && PM().tableDistributeColumns() },
        { id: 'tl-autofit', name: 'AutoFit', icon: 'autofit', onClick: (c, node) => autofitMenu(node) },
      ] },
      { id: 'tl-align', name: 'Alignment', controls: [
        { id: 'tl-vtop', name: 'Align Top', icon: 'alignTop', onClick: () => PM() && PM().tableSetCellVAlign('top') },
        { id: 'tl-vmid', name: 'Align Middle', icon: 'alignMiddle', onClick: () => PM() && PM().tableSetCellVAlign('middle') },
        { id: 'tl-vbot', name: 'Align Bottom', icon: 'alignBottom', onClick: () => PM() && PM().tableSetCellVAlign('bottom') },
        { id: 'tl-textdir', name: 'Text Direction', icon: 'textDirection', onClick: () => PM() && PM().tableSetTextDirection('tbRl') },
        { id: 'tl-cellmargins', name: 'Cell Margins', icon: 'cellMargins', onClick: () => WC.Dialogs.tableCellMargins && WC.Dialogs.tableCellMargins() },
      ] },
      { id: 'tl-data', name: 'Data', controls: [
        { id: 'tl-toText', name: 'Convert to Text', icon: 'convertToText', onClick: () => PM() && PM().tableToText('\t') },
        { id: 'tl-headerRow', name: 'Header Row', icon: 'headerRow', onClick: () => PM() && PM().tableToggleHeaderRow() },
      ] },
    ] };
  }

  function designTab() {
    return { id: 'table-design', name: 'Table Design', contextual: true, groups: [
      { id: 'td-styles', name: 'Table Styles', controls: [
        { id: 'td-styleGallery', name: 'Table Styles', icon: 'tableStyles', onClick: (c, node) => styleGallery(node) },
        { id: 'td-shading', name: 'Shading', icon: 'shading', onClick: (c, node) => shadingMenu(node) },
        { id: 'td-borders', name: 'Borders', icon: 'borders', onClick: (c, node) => bordersMenu(node) },
      ] },
      { id: 'td-align', name: 'Alignment', controls: [
        { id: 'td-alignL', name: 'Align Left', icon: 'alignLeft', onClick: () => PM() && PM().tableSetAlignment('left') },
        { id: 'td-alignC', name: 'Align Center', icon: 'alignCenter', onClick: () => PM() && PM().tableSetAlignment('center') },
        { id: 'td-alignR', name: 'Align Right', icon: 'alignRight', onClick: () => PM() && PM().tableSetAlignment('right') },
      ] },
    ] };
  }

  function styleGallery(node) { WC.flyout(node, (fly) => { ['TableGrid', 'GridTable4-Accent1', 'GridTable5Dark-Accent2', 'ListTable3-Accent3'].forEach((id) => fly.appendChild(WC.flyItem(id, { onClick: () => PM() && PM().tableSetStyle(id) }))); }); }
  function shadingMenu(node) { WC.flyout(node, (fly) => { ['#FFF2CC', '#DEEAF6', '#E2EFDA', '#FCE4D6', '#D9D9D9', 'transparent'].forEach((c) => { const sw = el('div', { style: { width: '22px', height: '22px', margin: '3px', background: c, border: '1px solid #ccc', cursor: 'pointer', display: 'inline-block' } }); sw.addEventListener('click', () => { WC.closeFlyouts(); PM() && PM().tableSetCellShading(c === 'transparent' ? '' : c); }); fly.appendChild(sw); }); }); }
  function bordersMenu(node) { WC.flyout(node, (fly) => { [['All Borders', { top: B(), bottom: B(), left: B(), right: B() }], ['No Border', null]].forEach(([label, spec]) => fly.appendChild(WC.flyItem(label, { onClick: () => PM() && (spec ? PM().tableSetCellBorders(spec) : PM().tableSetCellBorders({})) }))); }); function B() { return { val: 'single', color: '000000', size: 4 }; } }
  function autofitMenu(node) { WC.flyout(node, (fly) => { [['AutoFit Contents', 'contents'], ['AutoFit Window', 'window'], ['Fixed Column Width', 'fixed']].forEach(([label, mode]) => fly.appendChild(WC.flyItem(label, { onClick: () => PM() && PM().tableAutoFit(mode) }))); }); }

  // Show/hide the two contextual tabs as the caret enters/leaves a table.
  function syncContextualTabs(inTable) {
    if (!WC.Ribbon || !WC.Ribbon.showContextualTab) return;
    if (inTable && !shown) { WC.Ribbon.showContextualTab(designTab()); WC.Ribbon.showContextualTab(layoutTab()); shown = true; }
    else if (!inTable && shown) { WC.Ribbon.hideContextualTab('table-design'); WC.Ribbon.hideContextualTab('table-layout'); shown = false; }
  }

  // PM right-click table context menu (the legacy one is bound to the hidden #editor).
  function installContextMenu() {
    const mount = document.getElementById('pm-editor');
    if (!mount) return;
    mount.addEventListener('contextmenu', (e) => {
      if (!PM() || !PM().isInTable()) return;
      e.preventDefault();
      WC.closeFlyouts();
      const fly = el('div', { class: 'flyout' });
      const item = (label, fn) => fly.appendChild(WC.flyItem(label, { onClick: () => { WC.closeFlyouts(); fn(); } }));
      item('Insert Row Above', () => PM().tableAddRow('above'));
      item('Insert Row Below', () => PM().tableAddRow('below'));
      item('Insert Column Left', () => PM().tableAddColumn('left'));
      item('Insert Column Right', () => PM().tableAddColumn('right'));
      fly.appendChild(WC.flySep());
      item('Delete Row', () => PM().tableDeleteRow());
      item('Delete Column', () => PM().tableDeleteColumn());
      item('Delete Table', () => PM().tableDeleteTable());
      fly.appendChild(WC.flySep());
      item('Merge Cells', () => PM().tableMerge());
      item('Split Cell', () => PM().tableSplitCell());
      document.body.appendChild(fly);
      fly.style.left = Math.min(e.clientX, window.innerWidth - fly.offsetWidth - 4) + 'px';
      fly.style.top = Math.min(e.clientY, window.innerHeight - fly.offsetHeight - 4) + 'px';
      const close = (ev) => { if (!fly.contains(ev.target)) { fly.remove(); document.removeEventListener('mousedown', close, true); } };
      setTimeout(() => document.addEventListener('mousedown', close, true), 0);
    });
  }

  WC.TableToolsPM = { syncContextualTabs, installContextMenu, layoutTab, designTab };
  // install the context menu once the PM page exists
  if (document.readyState !== 'loading') setTimeout(installContextMenu, 0);
  else document.addEventListener('DOMContentLoaded', installContextMenu);
})();
```

(VERIFY at execution: (a) how `WC.Ribbon.showContextualTab` renders control `onClick` — match
`header-footer.js`'s control shape EXACTLY (does it pass `(cmd, node)`? does it use `icon` keys from
icons-fluent? does it support `dropdown`/flyout controls, or only buttons?). If the contextual-tab
renderer doesn't support flyout-on-click controls, render the style/shading/border/autofit pickers as
their own click handlers that open `WC.flyout` (as written). (b) The icon keys (`tableInsertRow`,
`mergeCells`, etc.) — map to EXISTING `icons-fluent.js` keys; for any missing icon, either reuse a close
existing key or add it via `gen-icons.js` (NOT hand-editing `icons-fluent.js`). Grep `icons-fluent.js`
for available table icons. (c) Confirm the script is loaded — add `<script src="js/table-tools-pm.js">`
to the legacy index alongside `table-tools.js`, or however public/js modules are registered.)

- [ ] **Step 10.2:** Confirm `state-sync.ts` calls `WC.TableToolsPM.syncContextualTabs(st.inTable)`
(Step 4.2) so the tabs appear/disappear with the caret.

- [ ] **Step 10.3: `[6b]` tests.** Append a `[6b]` block (after `[6]`, before `[0b]`): each new fork
command via the bridge mutates the right attr; the contextual tab shows when `isInTable()` and hides
when not; the PM context menu builds. Example shape:

```js
  // ---------- slice 6b: full Table Tools ----------
  await t('[6b] contextual Table tabs appear when caret is in a table', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    WC.TableToolsPM.syncContextualTabs(PM().isInTable());
    const has = !!document.querySelector('.contextual-tab[data-tab="table-layout"]');
    return PM().isInTable() === true && has === true;
  });
  await t('[6b] tableSetAlignment center sets table justification', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableSetAlignment('center'); await sleep(80);
    let j = null; doc().descendants((n) => { if (n.type.name === 'table') j = n.attrs.justification; });
    return j === 'center';
  });
  await t('[6b] tableSetStyle sets tableStyleId', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(120);
    PM().tableSetStyle('GridTable4-Accent1'); await sleep(80);
    let s = null; doc().descendants((n) => { if (n.type.name === 'table') s = n.attrs.tableStyleId; });
    return s === 'GridTable4-Accent1';
  });
  await t('[6b] tableSetCellShading sets the cell background (caret in cell)', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    PM().tableSetCellShading('#FFF2CC'); await sleep(80);
    let bg = null; doc().descendants((n) => { if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && n.attrs.background) bg = n.attrs.background.color || n.attrs.background; });
    return /FFF2CC/i.test(JSON.stringify(bg || ''));
  });
  await t('[6b] convert table to text replaces the table with paragraphs', async () => {
    setDoc('x'); PM().insertTable({ rows: 2, cols: 2 }); await sleep(150);
    PM().tableToText('\t'); await sleep(100);
    return !hasNode('table');
  });
```

(VERIFY at execution: each test puts the caret in the table before a cell-scoped command — after
`insertTable` the fork selects the first cell, so the caret is in-table; add `await sleep` for the
selection to settle. Cell-shading needs a cell selection — `setCellBackground` requires `isCellSelection`;
for the test, set a `CellSelection` on one cell first via a `tableSelectCell()` test helper, or assert
the command returns false gracefully and test shading via the bridge with an explicit cell selection.)

- [ ] **Step 10.4: Probe + gates.** `npm start`: insert a table → the **Table Design + Table Layout
contextual tabs appear**; click Insert Below / Delete Column / Merge / a style swatch / a shading swatch
→ the PM table updates; right-click a cell → the PM context menu; caret out of the table → tabs vanish.
The `[6b]` block goes green. All five gates. Commit
(`feat(ribbon): Table Layout + Table Design contextual tabs + PM table context menu`).

# Stage G — Table Tools oracle + dialogs polish

### Task 11: Table Tools oracle validation + cell-margins/properties dialog

**Files:** Modify: `dialogs.js` (a `D.tableCellMargins`/`D.tableProperties` dialog if wired);
evidence into `docs/superpowers/plans/notes/2026-06-09-slice6-tabletools-oracle.json`

- [ ] **Step 11.1:** Leg A (clone → Word) — build a styled table (header row, a shaded cell, center
alignment, a merged cell, all-borders), save → `docx-inspect` + a deeper unzip grep for `w:tblStyle`,
`w:shd/@w:fill`, `w:jc`, `w:tblBorders`/`w:tcBorders`, `w:gridSpan` (merge). Re-open in real Word via the
oracle → re-save → confirm the structure survives. JSON verdict; record any attr Word drops/normalizes.
- [ ] **Step 11.2:** Leg B (Word → clone) — author a styled table in real Word (built-in table style +
merged cells + shading), import via `openDocx`, assert the table node carries `tableStyleId`, merged
cells (`colspan`/`rowspan`), and cell `background`. JSON verdict.
- [ ] **Step 11.3 (optional):** wire `D.tableCellMargins`/`D.tableProperties` dialogs (Word's Table
Properties) → `tableSetCellMargins`/`tableSetIndent`/`tableSetRowHeight`. If deferred, the contextual-tab
Cell Margins button toasts "Table Properties dialog deferred" — record. Commit
(`test(test): slice-6b Table Tools oracle legs A/B + table properties polish`).

### Task 12: UI-fidelity (Codex handoff) — optional, not gate-blocking

- [ ] **Step 12.1:** Write `.oracle-probes/slice6/CODEX-PROMPT.md` (mirror slice5's): screenshot the
Insert dialogs (link, table grid, symbol, equation, bookmark) and the Table Layout + Table Design
contextual tabs vs real Word for Mac; note Mac-vs-Windows composition deviations. The USER runs Codex
desktop against it. Record verdicts or "UI-fidelity deferred" if the user is unavailable (do NOT block
the slice).

# Stage H/I — checkpoint + PR

### Task 13: checkpoint + PR

- [ ] **Step 13.1: Plan-tracking.** Invoke the `plan-tracking` skill: append a dated `last-point.md`
entry (slice 6 BUILT — what flipped, the new fork table commands, gate counts, KNOWN DEVIATIONS
[equation=styled-text; pagination-gated table visuals: autofit-window/contents, distribute heights,
repeat-header render, text-direction BiDi; Excel-sheet/Draw-Table degrade to plain insertTable], slice-7
carry-overs incl. **BOTH `[0a]` D6 tests now on `newComment`/`tableOfContents`**), tick the Daily work
log, advance CLAUDE.md/AGENTS.md/plan.md banners to slices-0a–6 / slice-7-next. Commit
(`docs(repo): checkpoint Phase 2 slice 6 BUILT — insert-basics + full Table Tools`).
- [ ] **Step 13.2: PR(s).** Open the PR(s) to `main` per `finishing-a-development-branch` (commit-style
skill; no AI trailer). Body: what flipped, the fork edits (NOTICE'd), oracle verdicts, gate counts,
known deviations + carry-overs. If two PRs (6a/6b), 6a first; 6b stacks.

---

## Known deviations / recorded deferrals (fill in from oracle verdicts at execution)

- **Equation = styled Cambria Math italic text**, not an OOXML `<m:oMath>` node (real Math authoring deferred).
- **Pagination-gated table VISUALS** (attrs land, visual deferred to Phase 7): AutoFit-to-Window/Contents,
  Distribute Rows (height), Repeat Header Rows (cross-page repeat), Text Direction (BiDi/vertical metrics).
- **Excel Spreadsheet / Draw Table** (Insert > Table) degrade to a plain `insertTable` in PM mode.
- **Convert Text↔Table** delimiter handling (tab/comma) — record Word's exact behavior from the oracle.
- **Table style gallery** = styleId apply only (visual cascade of style borders/shading is Phase-7 paint;
  built-in style catalog limited to the minted set + imported styles, per slice-3 precedent).
- **Image** authored data-URLs export to `word/media` with a fresh (non-deterministic) rId each export
  (functional; re-export diffs on rId only) — record.

## Carry-overs for slice 7 (file-io)

- **BOTH `[0a]` D6 tests now sit on `newComment`/`tableOfContents`** — slice 7's red-tests task repoints
  BOTH to a still-later-slice area (or, since slice 7 is file-io not a ribbon area, leave them and let
  slice 8/9 repoint when review/references flip — decide in slice-7 brainstorm-lite).
- Slice-4 follow-up still open: the Word→clone list-marker leak (supportLists markers paste as literal
  text → double-marker; candidate fix in bridge `pasteHTML` preprocessing or the converter).
- Slice 7 = file-io: open for html/txt/csv re-enabled; PM-converter round-trip suite replaces
  `test_docx.js`; retire html-to-docx/mammoth/docx-utils for `.docx`.
