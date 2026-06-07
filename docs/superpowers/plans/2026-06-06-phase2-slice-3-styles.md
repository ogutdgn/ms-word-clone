# Phase 2 — Slice 3 Implementation Plan: styles

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the `styles` ribbon area onto the owned ProseMirror engine — the Quick
Styles gallery (click + Word's hover live-preview, PM-native), the Styles pane applies,
the four style keyboard chords, the launcher — plus a caret-driven gallery highlight
(net-new fidelity win), four minted built-in style definitions, a new oracle style-read
verb, and the two recorded slice-2 revisits (resolved-ilvl menu read; the
resolvedPropertiesCache TableInfo bug).

**Architecture:** Spec `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`
(D1–D7 + §5–§9 are the contract); slice-2 pattern
(`docs/superpowers/plans/2026-06-06-phase2-slice-2-paragraph-lists.md`): legacy entry
points in `commands.js`/`dialogs.js`/`ribbon.js`/`app.js` get PMA-ternary PM branches;
the `WC.PM` bridge is the only code talking to the vendored Editor; the **FLIPPED-set
edit is the auditable switch and lands LAST** (Task 11) so the launcher auto-unblock
trap (commands.js:1017 probes cmd `stylesGallery` for group `styles`) can never expose
an un-ported path. Brainstorm decisions (2026-06-06, user-approved): **restore the hover
live-preview PM-natively** (throwaway transaction + EditorState restore), **pane applies
flip / New Style deferred**, **mint the four missing built-in styles** into the fork's
import defaults. Everything applies via **`setStyleById`** (one transaction; full
plugin-state style object → the Word-parity partial-selection→linked-character-style
branch works; plain-apply matches Word's gallery — `toggleHeading`/`toggleLinkedStyle`
stay unused: toggle-to-null is a SuperDoc-ism, and `toggleLinkedStyle` dereferences the
resolved-props cache without a fallback, linked-styles.js:79-80).

**Tech stack:** Electron 31, electron-vite + TS (renderer), vendored SuperDoc fork
(`@core`/`@extensions` aliases), in-renderer probe harness (`--probe-out` +
`--shot-evalfile`), osascript oracle (`scripts/oracle/word-oracle.js`).

**Branching:** everything on `feature/phase-2-slice-3-styles`, branched **directly off
`main`** (no stacked PRs — slice-2 integration precedent). Verify with
`git branch --show-current` before any edit.

**Vocabulary cheat-sheet (the name↔id trap):** ribbon/pane/legacy speak DISPLAY NAMES
(`'Heading 1'` — gallery `dataset.style`, ribbon-data items, BUILTIN list); the engine
speaks OOXML STYLE IDS (`'Heading1'` — `w:styleId`, `setStyleById`, `paragraphProperties.styleId`).
The blank fixture's `w:name` for headings is LOWERCASE (`'heading 1'`) — **never** build
the map from `w:name`; the canonical table is `src/renderer/bridge/style-names.ts`
(Task 6). The 15 names ↔ ids:
`Normal↔Normal · No Spacing↔NoSpacing · Heading 1-4↔Heading1-4 · Title↔Title ·
Subtitle↔Subtitle · Quote↔Quote · Intense Quote↔IntenseQuote · List Paragraph↔ListParagraph ·
Strong↔Strong · Emphasis↔Emphasis · Subtle Emphasis↔SubtleEmphasis · Intense Emphasis↔IntenseEmphasis`.
Strong/Emphasis/Subtle Emphasis/Intense Emphasis are **character** styles (textStyle mark
with `styleId`); the rest are paragraph styles (`paragraphProperties.styleId`).

**The five gates** (legacy + smoke ×2 + docx must be green at EVERY commit; the PM
suite's `[3]` block is red from Task 1 — EXCEPT four recorded engine-capability pins
(Step 1.3) — and goes fully green at Task 11; otherwise the same red→green arc as
slices 1-2):

```bash
npm run build
npx electron . --legacy --probe-out=/tmp/wc-legacy.json --shot-evalfile=scripts/test-suite.js --shot-delay=800   # 257 pass
npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js                              # PM suite (76 → ~96)
npx electron . --probe-out=/tmp/wc-smoke.json --shot-evalfile=scripts/smoke-pm.js                                # 9 pass
npx electron . --legacy --probe-out=/tmp/wc-smoke-legacy.json --shot-evalfile=scripts/smoke-pm.js                # 9 pass
node scripts/test_docx.js                                                                                        # 17 pass
```

Check results: `node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/wc-pm.json'));console.log(r.summary);r.results.filter(x=>!x.pass).forEach(x=>console.log('FAIL',x.name,x.detail))"`

**D6 note:** the two `[0a]` D6-block tests probe cmd `cut` (clipboard, slice 4) and
dropdown `find` (find-replace, slice 5) — the styles flip does **NOT** invert them.
No test repoint this slice (verified: zero existing PM tests assert styles state,
`st.block`, or `stylesGallery`).

---

## File structure (what gets created/modified)

| Path | Role |
|---|---|
| `scripts/test-suite-pm.js` (modify) | `cellFor` helper; the `[3]` block (~20 tests) between `[2]` (ends ~line 585) and the `[0b]` header (~line 587 — `[0b]` MUST stay last) |
| `scripts/oracle/word-oracle.js` (modify) | new `read-style-props` verb (per-paragraph style read); quirks #24+ |
| `scripts/oracle/README.md` (modify) | verb docs + new dictionary-quirk rows |
| `src/renderer/core/superdoc-fork/extensions/heading/heading.js` (modify, fork) | strip the `Mod-Alt-1..6` SuperDoc keymap (collides with the app's Ctrl/Cmd+Alt+1-3; toggle ≠ Word apply) |
| `src/renderer/core/superdoc-fork/core/super-converter/exporter-docx-defs.js` (modify, fork) | `DEFAULT_LINKED_STYLES` += NoSpacing, Strong, Emphasis, SubtleEmphasis (Word-standard defs) |
| `src/renderer/core/superdoc-fork/extensions/paragraph/resolvedPropertiesCache.js` (modify, fork) | TableInfo fix — build `{tableProperties, rowIndex, cellIndex, numRows, numCells}` from `$pos` (both call sites) |
| `src/renderer/core/superdoc-fork/NOTICE.md` (modify) | document the three fork edits |
| `src/renderer/bridge/style-names.ts` (new) | the canonical display-name ↔ styleId table |
| `src/renderer/bridge/commands.ts` (modify) | `getResolvedParaProps()`, `applyStyleByName(name)`, `styleIdForName(name)` |
| `src/renderer/bridge/state-sync.ts` (modify) | export `headParagraph`; `st.block` (display name, 'Normal' default); gallery-highlight push at the `sync()` tail |
| `src/renderer/bridge/style-preview.ts` (new) | PM-native hover preview: throwaway transaction + EditorState restore |
| `src/renderer/bridge/io.ts` (modify) | dirty guard ignores preview-meta transactions |
| `src/renderer/bridge/index.ts` (modify) | wire `installStylePreview`; **Task 11 only:** `FLIPPED` += `'styles'` |
| `src/renderer/public/js/ribbon.js` (modify) | `stylePreviewEnter/Leave/Commit` PM branches (legacy bodies byte-identical) |
| `src/renderer/public/js/commands.js` (modify) | `Commands.applyStyle` PM branch; `changeListLevelMenu` resolved-ilvl fix |
| `src/renderer/public/js/dialogs.js` (modify) | `D.stylesPane`: D6 gate (closes today's chevron leak) + PM item/Clear-All/New-Style branches |
| `src/renderer/public/js/app.js` (modify, **Task 11 — same commit as the flip**) | Ctrl+Shift+N + Ctrl/Cmd+Alt+1/2/3 keydown entries → live PM ternaries |

Not touched: `scripts/test-suite.js` (frozen), `ribbon-data.js`/`icons-fluent.js`
(generated — the gallery's 14-item list and the hardcoded cell-preview CSS map in
`renderStylesGallery` stay as-is in BOTH modes), `H.stylesGallery` (stays the no-op
dispatch-gate stub, commands.js:104), `D.applyStyles` (dialogs.js:367 — dead code, zero
callers, stays dead), `WC.Styles`/`D.createStyle` (legacy-only custom styles, deferred),
References→Add Text (area `references`, slice 9).

---

# Stage A — red tests + oracle tooling

### Task 0: branch + plan commit

- [ ] **Step 0.1:** `git checkout main && git pull && git checkout -b feature/phase-2-slice-3-styles`.
Verify: `git branch --show-current` → `feature/phase-2-slice-3-styles`.
- [ ] **Step 0.2:** Commit this plan file
(`docs(plan): phase 2 slice 3 implementation plan — styles`).

### Task 1: failing PM-suite tests for the slice (red)

**Files:** Modify: `scripts/test-suite-pm.js`

- [ ] **Step 1.1: Add the `cellFor` helper** after the `flyClick` helper (~line 83):

```js
  // Styles-gallery cell by display name (ribbon.js renderStylesGallery: .style-cell
  // carries dataset.style = the display name, e.g. "Heading 1").
  const cellFor = (name) => document.querySelector('.style-cell[data-style="' + name + '"]');
```

- [ ] **Step 1.2: Append the `[3]` block** between the end of `[2]` (~line 585) and the
`[0b]` header (~line 587 — `[0b]` MUST stay last; every `[3]` test below sets its own
doc, and the round-trip test that REPLACES the live document is the last `[3]` test).
Conventions carried from `[2]`: `sleep(150)` for the rAF-coalesced ribbon-sync tick,
`sleep(550)` to close the history group before one-undo asserts, string returns are
FAILURES, absence-asserts are guarded by a proven presence first.

```js
  // ---------- slice 3: styles (gallery + pane + shortcuts + preview) ----------
  // Context reset: the last [1] test left negation-run.docx live — its styles.xml has
  // NO Quote/heading definitions and a BOLD Normal. [3] runs on the blank template
  // (Quote/QuoteChar, Heading1-9+Char, Title, Subtitle, IntenseQuote, ListParagraph,
  // plain Normal all present; Task 4 mints the remaining four).
  await PM().newBlank(); await sleep(100);
  // Vocabulary: UI speaks display names ('Heading 1'), the engine speaks styleIds
  // ('Heading1'); styleId lives INSIDE paragraphProperties (cleared by setDoc's reset).
  // SELECTION RULE: paragraph-style asserts REQUIRE a full-paragraph or collapsed
  // selection — a PARTIAL selection takes the linked-character-style branch
  // (linked-styles/helpers.js:454: w:link styles apply e.g. Heading1Char to the range
  // and NEVER set paragraphProperties.styleId). Tests 6/7 exploit that deliberately;
  // every other apply selects the FULL setDoc string.
  await t('[3] gallery cell click applies Heading1 styleId + lights the cell', async () => {
    setDoc('style probe text'); selectText('style probe text');
    const cell = cellFor('Heading 1');
    if (!cell) return 'gallery cell not found';
    cell.click(); await sleep(150);
    const a = paraAttrs('style');
    return a.paragraphProperties?.styleId === 'Heading1' && cell.classList.contains('active');
  });
  await t('[3] applying a paragraph style clears direct char formatting', async () => {
    setDoc('boldfirst styled text'); selectText('boldfirst styled text');
    run('bold'); await sleep(50);
    // [1]-precedent guard: a negation mark (value '0') must not count as bold-on.
    const isBold = (m) => m.startsWith('bold:') && !m.includes('"value":"0"');
    if (!markNames('boldfirst').some(isBold)) return 'bold did not apply — precondition failed';
    PM().cmd('setStyleById', 'Heading1'); await sleep(50);
    return !markNames('boldfirst').some(isBold);
  });
  await t('[3] re-applying the same style keeps it (apply, not toggle)', async () => {
    // requires Heading1 to be ON first (previous test) — guards the absence-style assert
    if (paraAttrs('boldfirst').paragraphProperties?.styleId !== 'Heading1') return 'precondition failed';
    selectText('boldfirst styled text');
    PM().cmd('setStyleById', 'Heading1'); await sleep(50);
    return paraAttrs('boldfirst').paragraphProperties?.styleId === 'Heading1';
  });
  await t('[3] collapsed caret styles its containing paragraph (Title)', async () => {
    setDoc('caret style probe');
    const sel = selectText('caret');
    window.WC.editor.commands.setTextSelection({ from: sel.from, to: sel.from });
    PM().cmd('setStyleById', 'Title'); await sleep(50);
    return paraAttrs('caret').paragraphProperties?.styleId === 'Title';
  });
  await t('[3] multi-paragraph selection styles every paragraph (Quote)', async () => {
    setDocs(['multi quote one', 'multi quote two']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.applyStyle('Quote'); await sleep(50);
    return paraAttrs('multi quote one').paragraphProperties?.styleId === 'Quote'
      && paraAttrs('multi quote two').paragraphProperties?.styleId === 'Quote';
  });
  await t('[3] partial selection applies the LINKED char style, paragraph untouched', async () => {
    setDoc('partial linked probe words'); selectText('linked'); // one word — never the full paragraph
    window.WC.Commands.applyStyle('Heading 1'); await sleep(50);
    const a = paraAttrs('partial');
    const mark = markNames('linked').find((m) => m.startsWith('textStyle'));
    return a.paragraphProperties?.styleId == null && !!mark && mark.includes('Heading1Char');
  });
  await t('[3] Strong (character style) marks the range, paragraph style untouched', async () => {
    setDoc('strongchar probe text'); selectText('strongchar');
    window.WC.Commands.applyStyle('Strong'); await sleep(50);
    const mark = markNames('strongchar').find((m) => m.startsWith('textStyle'));
    return !!mark && mark.includes('"styleId":"Strong"')
      && paraAttrs('strongchar').paragraphProperties?.styleId == null;
  });
  await t('[3] No Spacing resolves spacing-after 0 through the cascade', async () => {
    setDoc('nospace probe text'); selectText('nospace');
    window.WC.Commands.applyStyle('No Spacing'); await sleep(150);
    return paraAttrs('nospace').paragraphProperties?.styleId === 'NoSpacing'
      && PM().getState().spacingAfterPt === 0;
  });
  await t('[3] Heading1 text renders the style color via decorations', async () => {
    setDoc('decor probe text'); selectText('decor probe text');
    PM().cmd('setStyleById', 'Heading1'); await sleep(150);
    const p = paraEl('decor');
    // LEAF span only: the fork nests .sd-paragraph-content → [data-run] → decorated
    // span, and ALL of them contain the needle text — document-order find() grabs the
    // undecorated outer wrapper (execution finding, Task 1).
    const span = p && Array.from(p.querySelectorAll('span')).find((s) => s.textContent.includes('decor') && !s.querySelector('span'));
    if (!span) return 'no decorated span found';
    const color = getComputedStyle(span).color;
    return color === 'rgb(15, 71, 97)'; // fixture Heading1 w:color 0F4761
  });
  await t('[3] gallery highlight tracks the caret (Heading1 ↔ Normal)', async () => {
    setDocs(['plain paragraph here', 'heading paragraph here']);
    selectText('heading paragraph here'); PM().cmd('setStyleById', 'Heading1'); await sleep(150);
    const h1Cell = cellFor('Heading 1');
    const onHeading = !!h1Cell && h1Cell.classList.contains('active');
    selectText('plain'); await sleep(150);
    const normalCell = cellFor('Normal');
    return onHeading && !h1Cell.classList.contains('active')
      && !!normalCell && normalCell.classList.contains('active');
  });
  await t('[3] getState().block carries the display name (Heading 1 / Normal)', async () => {
    // relies on the previous test's setDocs(['plain paragraph here', 'heading paragraph here'])
    // with Heading1 applied to the second — deliberate chain, no doc reset between them.
    selectText('heading'); await sleep(50);
    const b1 = PM().getState().block === 'Heading 1';
    selectText('plain'); await sleep(50);
    return b1 && PM().getState().block === 'Normal';
  });
  await t('[3] hover preview applies live; mouse-leave restores doc + dirty + history', async () => {
    setDoc('preview probe text'); selectText('preview probe text');
    await sleep(550); // close the history group so the assert below is clean
    PM().setClean();
    const before = JSON.stringify(doc().toJSON());
    const cell = cellFor('Heading 1');
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(50);
    const during = paraAttrs('preview').paragraphProperties?.styleId === 'Heading1';
    cell.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await sleep(50);
    // The editor-state asserts are the desync canaries: a view-only restore
    // (raw view.updateState) would pass the doc() check but desync editor._state
    // (Editor.ts:607) — assert BOTH copies restored and identical.
    return during
      && JSON.stringify(doc().toJSON()) === before
      && JSON.stringify(window.WC.editor.state.doc.toJSON()) === before
      && window.WC.editor.state === window.WC.view.state
      && PM().isDirty() === false;
  });
  await t('[3] preview then click commits as ONE undo step', async () => {
    setDoc('commit probe text'); selectText('commit probe text');
    await sleep(550); // close the history group — undo must revert ONLY the commit
    const cell = cellFor('Heading 2');
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); await sleep(50);
    cell.click(); await sleep(80);
    const applied = paraAttrs('commit').paragraphProperties?.styleId === 'Heading2';
    PM().cmd('undo'); await sleep(50);
    return applied && paraAttrs('commit').paragraphProperties?.styleId == null;
  });
  await t('[3] Ctrl+Alt+2 applies Heading 2 in PM mode', async () => {
    setDoc('kbd heading probe'); selectText('kbd heading probe');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('kbd').paragraphProperties?.styleId === 'Heading2';
  });
  await t('[3] repeated Ctrl+Alt+1 keeps Heading1 (apply semantics, no toggle)', async () => {
    setDoc('repeat kbd probe'); selectText('repeat kbd probe');
    const fire = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    fire(); await sleep(50); fire(); await sleep(50);
    return paraAttrs('repeat').paragraphProperties?.styleId === 'Heading1';
  });
  await t('[3] Ctrl+Shift+N applies Normal (explicit styleId, not null)', async () => {
    // requires Heading1 to be ON first — guards against false-green in the red state.
    // Depends on the Task-11.1b SHADOW FIX (app.js:76 gains !shift) — without it this
    // chord triggers Files.newDoc + a stuck confirmDiscard modal.
    if (paraAttrs('repeat').paragraphProperties?.styleId !== 'Heading1') return 'precondition failed';
    selectText('repeat kbd probe');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('repeat').paragraphProperties?.styleId === 'Normal';
  });
  await t('[3] styles launcher opens the pane; pane item applies via the engine', async () => {
    setDoc('pane probe text'); selectText('pane probe text');
    window.WC.Commands.launcher('styles', null, null);
    const pane = document.getElementById('styles-pane');
    if (!pane) return 'styles pane did not open';
    const item = Array.from(pane.querySelectorAll('.sl-item')).find((n) => n.textContent.trim() === 'Heading 3');
    if (!item) { window.WC.Dialogs.stylesPane(); return 'Heading 3 pane item not found'; }
    item.click(); await sleep(50);
    const ok = paraAttrs('pane').paragraphProperties?.styleId === 'Heading3';
    if (document.getElementById('styles-pane')) window.WC.Dialogs.stylesPane(); // toggle-close
    return ok;
  });
  await t('[3] pane Clear All applies Normal; New Style toasts (deferred)', async () => {
    setDoc('paneclear probe text'); selectText('paneclear probe text');
    PM().cmd('setStyleById', 'Quote'); await sleep(50);
    window.WC.Commands.launcher('styles', null, null);
    const pane = document.getElementById('styles-pane');
    if (!pane) return 'styles pane did not open';
    const clearBtn = Array.from(pane.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Clear All');
    if (!clearBtn) { window.WC.Dialogs.stylesPane(); return 'Clear All button not found'; }
    clearBtn.click();
    await sleep(50);
    const cleared = paraAttrs('paneclear').paragraphProperties?.styleId === 'Normal';
    const newBtn = Array.from(pane.querySelectorAll('button')).find((b) => b.textContent.trim() === 'New Style');
    if (!newBtn) { window.WC.Dialogs.stylesPane(); return 'New Style button not found'; }
    newBtn.click();
    const noDialog = !document.querySelector('.modal-backdrop');
    if (document.getElementById('styles-pane')) window.WC.Dialogs.stylesPane();
    return cleared && noDialog;
  });
  await t('[3] bridge resolved read exposes numbering ilvl (level-menu seam)', async () => {
    setDoc('resolved probe text'); selectText('resolved');
    run('numbering'); await sleep(50);
    PM().cmd('changeListLevelBy', 2); await sleep(50);
    const r = PM().getResolvedParaProps();
    return r?.numberingProperties?.ilvl === 2;
  });
  // KEEP LAST in [3]: openDocx REPLACES the live document (the [0b] block below
  // sets its own docs, so this is safe here and only here).
  await t('[3] styleIds round-trip through save/open (w:pStyle + w:rStyle)', async () => {
    setDocs(['roundtrip heading para', 'roundtrip strongbit para']);
    selectText('roundtrip heading para'); PM().cmd('setStyleById', 'Heading1'); await sleep(50);
    selectText('strongbit'); window.WC.Commands.applyStyle('Strong'); await sleep(50);
    const bytes = await PM().exportDocxBytes();
    const ok = await PM().openDocx(bytes);
    if (!ok) return 'reopen failed';
    await sleep(300); // replaceEditor remount + first sync
    const a = paraAttrs('roundtrip heading');
    const mark = markNames('strongbit').find((m) => m.startsWith('textStyle'));
    return a.paragraphProperties?.styleId === 'Heading1'
      && !!mark && mark.includes('"styleId":"Strong"');
  });
```

- [ ] **Step 1.3: Run** `npm run build && npm run test:pm` → all 76 pre-existing tests
PASS. The `[3]` block is red EXCEPT **four expected-green engine-capability pins**:
tests 2, 3, 4 (direct `setStyleById` on fixture-present styles — the bridge `cmd()`
path has no D6 gate, `LinkedStyles` shipped in slice 0a, and the `newBlank` reset puts
Heading1/Title in the catalog) and 9 (the decoration pipeline already renders fixture
Heading1's color). They pin engine behavior the slice depends on — list them in the
commit message. Every test driving an ENTRY POINT must be RED: gallery click + pane +
launcher (block-toasts), keyboard chords, hover preview, `getResolvedParaProps`,
`st.block`/highlight (missing bridge surface), and Strong/No Spacing (unminted until
Task 4) — toasts, string returns, and throws all count as red (t() catches throws).
Commit (`test: slice-3 styles PM tests (red + 4 engine pins) + cellFor helper`).

### Task 2: oracle — slice-2 followUps + `read-style-props` verb + behavior probes

**Files:** Modify: `scripts/oracle/word-oracle.js`, `scripts/oracle/README.md`;
evidence into `docs/superpowers/plans/notes/`

Pure tooling + validation (no gate impact). **Read `scripts/oracle/README.md` in full
first** — the PID-safety contract and quirks #1-23 are binding; #22 (dot-file hang) and
#23 (long-session degradation) gate everything below.

- [ ] **Step 2.0: Ask the USER to relaunch Word** (quirk #23 — the 2026-06-06 session
wedged; a fresh relaunch is the precondition for every step below). Do not proceed
headlessly without confirmation.

- [ ] **Step 2.1: Run the two pending slice-2 followUps** (~5 min, carry-over):

```bash
# followUp 1 — lists-family read (the cp is part of the recorded command):
cp tests/fixtures/.oracle-out-s2-lists.docx tests/fixtures/oracle-tmp-s2-lists.docx
node scripts/oracle/word-oracle.js read-para-props "$(pwd)/tests/fixtures/oracle-tmp-s2-lists.docx"
# followUp 2 — literal roundtrip. STALE-CLAIM FIX: the followUp says non-dot copies are
# "already staged" but only the dot-file exists (verified) — cp first or quirk #22 hangs Word:
cp tests/fixtures/.oracle-rt-in.docx tests/fixtures/oracle-rt-in.docx
node scripts/oracle/word-oracle.js roundtrip "$(pwd)/tests/fixtures/oracle-rt-in.docx" "$(pwd)/tests/fixtures/oracle-rt-out.docx"
```

Expected: followUp 1 matches the `expected[]` rows in
`notes/2026-06-06-slice2-oracleA-lists.json` (bullet listString U+F0B7/U+2022 family,
'1.', the square-glyph DISCOVERY verdict, multilevel `listLevelNumber` 1 vs 2,
hanging metrics); followUp 2 prints `ROUNDTRIP_OK` and `oracle-rt-out.docx` reimports in
the clone with shading/borders intact. Update BOTH notes JSONs' `followUp`/`verdict`
fields with the outcomes. Word left clean (document count at baseline; never quit).

- [ ] **Step 2.2: Add `readStyleProps`** after `readParaProps` in `word-oracle.js`.
UNTOUCHED dictionary territory (repo-wide: zero prior `style` reads): `paragraph.style`
is declared as the `WdBuiltinStyle` ENUM (134 enumerators, `'style normal'`,
`'style heading1'`…), NOT the `Word style` object class — what a custom style returns is
undeclared. Budget the slice-2 empirical-iteration loop: expect -1700/-1728 errors,
record RAW strings, probe variable-binding per class (#14 vs #19 precedent).

```js
/**
 * Per-paragraph STYLE read (slice 3). One row per paragraph; text LAST (quirk #16).
 * UNVERIFIED dictionary territory (first style read on this Mac): `style of
 * paragraph i` is declared WdBuiltinStyle (an ENUM) in Word.sdef — the `as string`
 * coercion below is the first thing to validate live. If it raises, iterate:
 * (a) try `get style of paragraph i of d` bare; (b) try
 * `name local of (style of paragraph i of d)` (may fail — enum, not object);
 * (c) try `style of text object of paragraph i of d`. Record every raw outcome.
 */
function readStyleProps(docxPath) {
  const basename = openDoc(docxPath);
  const script = `
tell application "Microsoft Word"
  set out to ""
  try
    set d to document "${esc(basename)}"
    repeat with i from 1 to (count of paragraphs of d)
      set tr to text object of paragraph i of d
      set sRaw to (get style of paragraph i of d) as string
      set out to out & i & tab & sRaw & tab & (content of tr) & linefeed
    end repeat
  on error errMsg
    close document "${esc(basename)}" saving no
    error errMsg
  end try
  close document "${esc(basename)}" saving no
  return out
end tell`;
  const raw = osa(script);
  return raw.split('\n').filter(Boolean).map((line) => {
    const p = line.split('\t');
    return {
      index: Number(p[0]),
      styleRaw: p[1], // e.g. 'style heading1' — keep raw; normalization map TBD from live iteration
      style: (p[1] || '').replace(/^style /, ''),
      text: p.slice(2).join('\t').replace(/\r$/, ''),
    };
  });
}
```

- [ ] **Step 2.3: Wire the CLI** — in the dispatch block, add before the `roundtrip`
branch:

```js
} else if (cmd === 'read-style-props' && a) {
  emit({ file: a, generatedBy: 'word-oracle read-style-props', paragraphs: readStyleProps(path.resolve(a)) });
```

and extend the usage strings (header comment + final `console.error`).

- [ ] **Step 2.4: Verify live against real Word.** Author a probe docx IN REAL WORD:
4 paragraphs — (1) Normal, (2) Heading 1 (via Word's gallery), (3) Title, (4) a custom
user style named `MyProbeStyle` (Format → Style → New). Save as
`tests/fixtures/oracle-style-probe.docx` (NON-dot name — quirk #22). Run:

```bash
node scripts/oracle/word-oracle.js read-style-props "$(pwd)/tests/fixtures/oracle-style-probe.docx" --out /tmp/style-probe.json
```

Iterate on dictionary errors per the Step-2.2 ladder. Record: the exact raw enum strings
for built-ins, what the CUSTOM style returns (raw name text? error?), and whether
`style of paragraph` binds to a variable. Normalize in `readStyleProps` per the
discovered strings and re-run to confirm clean JSON.

- [ ] **Step 2.5: Behavior probes (drive slice decisions — record verdicts in
`docs/superpowers/plans/notes/2026-06-06-slice3-word-behavior.json`):** in live Word,
with a scratch doc (never saved):
  1. **Re-apply same style:** apply Heading 1 to a paragraph; click Heading 1 again in
     the gallery → does it stay Heading 1 (apply) or revert to Normal (toggle)?
     *(Engine choice = plain apply; this validates it.)*
  2. **Direct-formatting clearing:** bold ONE word in a paragraph, then apply Heading 1
     to the whole paragraph → does the bold survive? Then bold the ENTIRE paragraph and
     re-apply → does it survive? *(The engine clears char marks unconditionally.
     DECISION GATE: if Word preserves, record a KNOWN DEVIATION — do NOT fork-edit
     `applyLinkedStyleToTransaction` mid-slice; the heuristic (Word's >50% rule) is a
     recorded follow-up.)*
  3. **Gallery highlight:** caret in a Heading-1 paragraph → which Quick-Styles cell is
     highlighted? Caret in an unstyled paragraph → is Normal highlighted? *(Validates
     the st.block 'Normal' default.)*
  4. **Hover preview scope:** select 2 paragraphs, hover a gallery style → do BOTH
     preview? Mouse away → exact restore? *(Validates the preview design.)*

- [ ] **Step 2.6: Document — BOTH targets.** Append the new discoveries as quirks #24+
in the `word-oracle.js` header AND plain rows in the README dictionary-renames table;
document the verb (CLI + JSON shape) in the README verbs section. Word left clean.
Commit (`test(test): word-oracle read-style-props verb + slice-2 followUp closure`).

# Stage B — fork engine work (all NOTICE-documented)

### Task 3: strip the Heading `Mod-Alt-1..6` keymap

**Files:** Modify: `src/renderer/core/superdoc-fork/extensions/heading/heading.js`,
`src/renderer/core/superdoc-fork/NOTICE.md`

- [ ] **Step 3.1:** Delete the whole `addShortcuts()` block (heading.js:75-85) and the
six `@shortcut Mod-Alt-N` doc lines (heading.js:22-27). Rationale: the app's heading
chords are ALSO Mod+Alt+1..3 (app.js:67 requires ctrl/meta + lines 95-97), PM keymaps
don't stop propagation to the document listener (the recorded Mod-Z/Y double-fire
hazard, app.js:100-103), and the fork's `toggleHeading` TOGGLES (→ `styleId:null`)
where Word's chord APPLIES — both firing would apply-then-toggle. Slice-2 precedent:
the TextAlign `Mod-Shift-L/E/R/J` strip (NOTICE.md). The `setHeading`/`toggleHeading`
COMMANDS stay (harmless unused surface).

- [ ] **Step 3.2: NOTICE.** Append to the fork-modifications list:

```markdown
- **SuperDoc heading keymap removed:** `Mod-Alt-1..6` shortcuts deleted from the
  Heading extension — they collide with the app's Ctrl/Cmd+Alt+1-3 heading chords
  (document-level keydown map) and their toggle-to-no-style semantics contradict
  Word's apply-only behavior (slice 3, 2026-06-06).
```

- [ ] **Step 3.3: Gates** (`npm run build` + all five). Commit
(`feat(editor): strip SuperDoc heading keymap (collides with Word chords)`).

### Task 4: mint the four missing built-in styles

**Files:** Modify: `src/renderer/core/superdoc-fork/core/super-converter/exporter-docx-defs.js`,
`src/renderer/core/superdoc-fork/NOTICE.md`

`DEFAULT_LINKED_STYLES` (exporter-docx-defs.js:93) currently holds Normal, Title,
Subtitle, Heading1-3, Hyperlink; `addDefaultStylesIfMissing` (docxImporter.js:756-771)
injects each into any loaded styles.xml that lacks it. The blank/basic-list fixtures
lack **NoSpacing, Strong, Emphasis, SubtleEmphasis** (verified by unzip) — 4 of the 14
gallery names. Word's built-ins are always available; mint them with Word's standard
definitions (oracle Step 13.4 validates against a real-Word-authored styles.xml).

- [ ] **Step 4.1:** Add four entries to the `DEFAULT_LINKED_STYLES` object (same
XML-as-JSON shape as the existing `Normal`/`Title` entries — match the file's style):

```js
  NoSpacing: {
    type: 'element',
    name: 'w:style',
    attributes: { 'w:type': 'paragraph', 'w:styleId': 'NoSpacing' },
    elements: [
      { type: 'element', name: 'w:name', attributes: { 'w:val': 'No Spacing' } },
      { type: 'element', name: 'w:uiPriority', attributes: { 'w:val': '1' } },
      { type: 'element', name: 'w:qFormat' },
      {
        type: 'element',
        name: 'w:pPr',
        elements: [
          {
            type: 'element',
            name: 'w:spacing',
            attributes: { 'w:after': '0', 'w:line': '240', 'w:lineRule': 'auto' },
          },
        ],
      },
    ],
  },
  Strong: {
    type: 'element',
    name: 'w:style',
    attributes: { 'w:type': 'character', 'w:styleId': 'Strong' },
    elements: [
      { type: 'element', name: 'w:name', attributes: { 'w:val': 'Strong' } },
      { type: 'element', name: 'w:basedOn', attributes: { 'w:val': 'DefaultParagraphFont' } },
      { type: 'element', name: 'w:uiPriority', attributes: { 'w:val': '22' } },
      { type: 'element', name: 'w:qFormat' },
      {
        type: 'element',
        name: 'w:rPr',
        elements: [
          { type: 'element', name: 'w:b' },
          { type: 'element', name: 'w:bCs' },
        ],
      },
    ],
  },
  Emphasis: {
    type: 'element',
    name: 'w:style',
    attributes: { 'w:type': 'character', 'w:styleId': 'Emphasis' },
    elements: [
      { type: 'element', name: 'w:name', attributes: { 'w:val': 'Emphasis' } },
      { type: 'element', name: 'w:basedOn', attributes: { 'w:val': 'DefaultParagraphFont' } },
      { type: 'element', name: 'w:uiPriority', attributes: { 'w:val': '20' } },
      { type: 'element', name: 'w:qFormat' },
      {
        type: 'element',
        name: 'w:rPr',
        elements: [
          { type: 'element', name: 'w:i' },
          { type: 'element', name: 'w:iCs' },
        ],
      },
    ],
  },
  SubtleEmphasis: {
    type: 'element',
    name: 'w:style',
    attributes: { 'w:type': 'character', 'w:styleId': 'SubtleEmphasis' },
    elements: [
      { type: 'element', name: 'w:name', attributes: { 'w:val': 'Subtle Emphasis' } },
      { type: 'element', name: 'w:basedOn', attributes: { 'w:val': 'DefaultParagraphFont' } },
      { type: 'element', name: 'w:uiPriority', attributes: { 'w:val': '19' } },
      { type: 'element', name: 'w:qFormat' },
      {
        type: 'element',
        name: 'w:rPr',
        elements: [
          { type: 'element', name: 'w:i' },
          { type: 'element', name: 'w:iCs' },
          {
            type: 'element',
            name: 'w:color',
            attributes: { 'w:val': '595959', 'w:themeColor': 'text1', 'w:themeTint': 'A6' },
          },
        ],
      },
    ],
  },
```

- [ ] **Step 4.2: Quick probe.** `npm run build`, `npm start`, devtools:
`WC.editor.helpers.linkedStyles.getStyleById('Strong')` → an object with
`type: 'character'`; `WC.PM.cmd('setStyleById', 'NoSpacing')` on a selected paragraph →
`WC.editor.getAttributes('paragraph').paragraphProperties.styleId === 'NoSpacing'`.

- [ ] **Step 4.3: NOTICE.** Append:

```markdown
- **Four built-in style definitions added to import defaults:**
  `DEFAULT_LINKED_STYLES` (core/super-converter/exporter-docx-defs.js) additionally
  carries NoSpacing, Strong, Emphasis, SubtleEmphasis (Word-standard definitions) so
  `addDefaultStylesIfMissing` makes the full Quick-Styles gallery resolvable in every
  document, like real Word's always-available built-ins (slice 3, 2026-06-06).
```

- [ ] **Step 4.4: Gates** + commit
(`feat(editor): mint NoSpacing/Strong/Emphasis/SubtleEmphasis import defaults`).

### Task 5: resolvedPropertiesCache TableInfo fix (slice-2 revisit b)

**Files:** Modify: `src/renderer/core/superdoc-fork/extensions/paragraph/resolvedPropertiesCache.js`,
`src/renderer/core/superdoc-fork/NOTICE.md`

CONFIRMED pre-existing bug (recorded in the slice-2 BUILT entry): both
`calculateResolvedParagraphProperties` (line 26) and
`resolveHypotheticalParagraphProperties` (line 50) pass the raw `tableStyleId` STRING
where `resolveParagraphProperties` expects `TableInfo = { tableProperties: { tableStyleId },
rowIndex, cellIndex, numRows, numCells }` (_vendor/superdoc/style-engine/src/ooxml/index.ts:165-169,
44-52) — `tableInfo?.tableProperties?.tableStyleId` on a string is undefined, so the
table-style paragraph cascade silently drops. CRITICAL: rowIndex/cellIndex must be REAL
(they feed `determineCellStyleTypes`; hardcoding 0 would wrongly apply firstRow/firstCol
conditional formats to every in-table paragraph — `DEFAULT_TBL_LOOK` defaults both true,
ooxml/index.ts:58-65). Schema node names verified: `table`, `tableRow`, `tableCell`,
`tableHeader`.

- [ ] **Step 5.1:** Add the builder above `getResolvedParagraphProperties` and use it in
BOTH functions:

```js
/**
 * Build the TableInfo object resolveParagraphProperties expects (style-engine
 * ooxml/index.ts) from the paragraph's ancestor chain. Real row/cell indices are
 * REQUIRED: determineCellStyleTypes keys firstRow/firstCol conditional formats on
 * them, and DEFAULT_TBL_LOOK enables both — hardcoded zeros would mark every
 * in-table paragraph as first-row+first-column.
 * @returns {Object|null} TableInfo, or null when not in a (styled) table
 */
function buildTableInfo($pos) {
  const tableNode = findParentNodeClosestToPos($pos, (node) => node.type.name === 'table');
  const tableStyleId = tableNode?.node.attrs.tableStyleId || null;
  if (!tableStyleId) return null;
  const rowNode = findParentNodeClosestToPos($pos, (node) => node.type.name === 'tableRow');
  const cellNode = findParentNodeClosestToPos(
    $pos,
    (node) => node.type.name === 'tableCell' || node.type.name === 'tableHeader',
  );
  let rowIndex = 0;
  let cellIndex = 0;
  let numCells = 0;
  const numRows = tableNode.node.childCount;
  if (rowNode) {
    tableNode.node.forEach((child, _offset, index) => {
      if (child === rowNode.node) rowIndex = index;
    });
    numCells = rowNode.node.childCount;
    if (cellNode) {
      rowNode.node.forEach((child, _offset, index) => {
        if (child === cellNode.node) cellIndex = index;
      });
    }
  }
  // Spread the table's full tableProperties (carries tblLook + band sizes — the
  // style-engine reads tableInfo.tableProperties?.tblLook ?? DEFAULT_TBL_LOOK);
  // top-level attrs.tableStyleId wins over any stale copy inside tableProperties.
  return {
    tableProperties: { ...(tableNode.node.attrs.tableProperties ?? {}), tableStyleId },
    rowIndex,
    cellIndex,
    numRows,
    numCells,
  };
}
```

In `calculateResolvedParagraphProperties`, replace lines 18-19 + the third argument:

```js
  const tableInfo = buildTableInfo($pos);
  const paragraphProperties = resolveParagraphProperties(
    {
      translatedNumbering: editor.converter.translatedNumbering,
      translatedLinkedStyles: editor.converter.translatedLinkedStyles,
    },
    node.attrs.paragraphProperties || {},
    tableInfo,
  );
```

In `resolveHypotheticalParagraphProperties`, same replacement (lines 42-43 + the third
argument → `tableInfo`).

- [ ] **Step 5.2: Probe.** `npm run build`, `npm start`, devtools: insert a table
(legacy `--legacy` can't probe this — use a Word-authored .docx with a styled table via
Ctrl+O, or skip to the unit assertion): on an in-table paragraph,
`WC.PM.getResolvedParaProps()` no longer throws and in-table paragraphs resolve. The
REAL validation is oracle leg 13.5 (Word-authored styled-table doc renders its table-style
paragraph props). At minimum confirm no regression: the PM suite's `[1]`/`[2]` resolved
asserts (state-sync fields) still pass.

- [ ] **Step 5.3: NOTICE.** Append:

```markdown
- **resolvedPropertiesCache TableInfo fix:** both resolver entry points previously
  passed the raw `tableStyleId` string where the style-engine expects a TableInfo
  object — the table-style paragraph cascade was silently skipped for in-table
  paragraphs. Now builds `{ tableProperties, rowIndex, cellIndex, numRows, numCells }`
  with real indices from the ancestor chain (slice 3, 2026-06-06).
```

- [ ] **Step 5.4: Gates** + commit
(`fix(editor): resolve table-style cascade — real TableInfo from the ancestor chain`).

# Stage C — bridge + entry-point rewrites (dispatch still blocks until Task 11)

> Pattern (commands.js:11): `const pm = PMA(); pm ? <PM path> : <legacy>`. `PMA()`
> ignores FLIPPED — these branches are reachable by direct `WC.PM` calls immediately,
> but ribbon/keyboard dispatch stays courtesy-blocked until the Task-11 registry flip.
> Legacy branches must stay byte-identical (frozen 257 gate — test-suite.js:49-51,
> 157-158 exercise applyNamedStyle/stylesPane under `--legacy`).

### Task 6: bridge — name table, resolved read, named-style apply

**Files:** Create: `src/renderer/bridge/style-names.ts`;
Modify: `src/renderer/bridge/commands.ts`, `src/renderer/bridge/state-sync.ts` (export only)

- [ ] **Step 6.1: `style-names.ts`** (new file):

```ts
// Display-name ↔ OOXML styleId for the styles UI vocabulary (slice 3).
// The UI (ribbon-data gallery items, .style-cell dataset.style, the legacy BUILTIN
// list) speaks display names; the engine (setStyleById, paragraphProperties.styleId,
// w:styleId) speaks ids. NEVER derive this from styles.xml w:name — the blank
// fixture's heading names are lowercase ('heading 1').
export const STYLE_NAME_TO_ID: Record<string, string> = {
  'Normal': 'Normal',
  'No Spacing': 'NoSpacing',
  'Heading 1': 'Heading1',
  'Heading 2': 'Heading2',
  'Heading 3': 'Heading3',
  'Heading 4': 'Heading4',
  'Title': 'Title',
  'Subtitle': 'Subtitle',
  'Quote': 'Quote',
  'Intense Quote': 'IntenseQuote',
  'List Paragraph': 'ListParagraph',
  'Strong': 'Strong',
  'Emphasis': 'Emphasis',
  'Subtle Emphasis': 'SubtleEmphasis',
  'Intense Emphasis': 'IntenseEmphasis',
}
export const STYLE_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STYLE_NAME_TO_ID).map(([name, id]) => [id, name]),
)
```

- [ ] **Step 6.2: Export `headParagraph` from state-sync.ts** — change line 10 from
`function headParagraph(` to `export function headParagraph(` (commands.ts reuses it).
AS-BUILT addition (review-accepted): an AllSelection fallback — when the depth-walk
finds no ancestor paragraph ($from at doc root, e.g. Ctrl+A), descend via
`doc.descendants()` to the FIRST paragraph (the selection-start head, per the recorded
head-paragraph convention). Unreachable for TextSelection (the depth-walk returns
first); `pos` semantics identical to `$from.before(d)`.

- [ ] **Step 6.3: commands.ts additions.** Imports at the top:

```ts
import { STYLE_NAME_TO_ID } from './style-names'
import { calculateResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js'
import { headParagraph } from './state-sync'
```

After `sortParagraphs` (line ~106), add:

```ts
  // Resolved (style-cascade-included) head-paragraph properties — the bridge read
  // the slice-2 changeListLevelMenu DEVIATION comment stipulated for slice 3.
  // Mirrors state-sync's resolved block (same fallback semantics).
  function getResolvedParaProps(): any {
    const head = headParagraph(editor)
    if (!head) return null
    try { return calculateResolvedParagraphProperties(editor, head.node, editor.state.doc.resolve(head.pos)) }
    catch { return head.node.attrs?.paragraphProperties || null }
  }

  const styleIdForName = (name: string): string | null => STYLE_NAME_TO_ID[name] || null

  // Named-style apply: display name → styleId → setStyleById (ONE transaction; the
  // full plugin-state style object, so the partial-selection linked-character-style
  // branch works — never pass bare {id}). Returns false for unknown names AND for
  // styles absent from the doc's catalog (foreign docs missing built-ins beyond the
  // import defaults — recorded deviation: Word mints from its built-in library).
  function applyStyleByName(name: string): boolean {
    const id = styleIdForName(name)
    if (!id) return false
    return cmd('setStyleById', id)
  }
```

Extend the return object (line 108):

```ts
  return { cmd, chain, captureSelection, withSelection, changeCase, sortParagraphs, getResolvedParaProps, styleIdForName, applyStyleByName }
```

- [ ] **Step 6.4: Probe + gates.** `npm run build`, devtools:
`WC.PM.applyStyleByName('Heading 1')` on a selected paragraph → styleId `Heading1`;
`WC.PM.getResolvedParaProps()` → an object with `spacing`/`indent` keys;
`WC.PM.styleIdForName('Quote')` → `'Quote'`. The `[3]` resolved-read test goes green;
most `[3]` stays red. All five gates. Commit
(`feat(ribbon): bridge style-name table, resolved paragraph read, named-style apply`).

### Task 7: state-sync — `st.block` + caret-driven gallery highlight

**Files:** Modify: `src/renderer/bridge/state-sync.ts`

- [ ] **Step 7.1: Populate `block`.** Import at the top:

```ts
import { STYLE_ID_TO_NAME } from './style-names'
```

Inside the existing `if (head)` block (after the `st.lineSpacing` line, ~line 91), add:

```ts
    // slice 3: resolved styleId → display name for the gallery highlight + pane.
    // Unstyled paragraphs read as 'Normal' (real Word highlights Normal by default —
    // oracle-confirmed, Task 2.5 probe 3). Unknown/foreign styleIds → '' (no highlight).
    st.block = resolved?.styleId ? (STYLE_ID_TO_NAME[resolved.styleId] ?? '') : 'Normal'
```

(The `block: ''` initializer on line 27 stays — it is the no-head fallback. Update its
comment from `// populated when the styles area flips (slice 3)` to
`// display name of the head paragraph's resolved style (slice 3)`.)

- [ ] **Step 7.2: Gallery-highlight push** at the `sync()` tail, after the `pushSpin`
calls (~line 125):

```ts
    // Caret-driven styles-gallery highlight (real Word; legacy was apply-driven only).
    // renderStylesGallery registers nothing in controlIndex — query the cells directly.
    document.querySelectorAll('.style-cell').forEach((c: any) => {
      c.classList.toggle('active', !!st.block && c.dataset.style === st.block)
    })
```

NOTE: this push is deliberately live PRE-flip (D6 blocks mutations, not reads) —
between this commit and Task 11 the gallery highlight tracks the caret (Normal lights
up on boot) while cell clicks still block-toast. Expected and accepted; it is why
Task 7.3 can flip the highlight/block tests green before the flip.

- [ ] **Step 7.3: Canary check.** `npm run build && npm run test:pm` → the `[1]`
negation-fixture test (style-cascade bold semantics) and all `[2]` resolved-field tests
MUST stay green (this task only ADDS fields/pushes). The `[3]` highlight + block tests
go green NOW (they use direct `setStyleById`). All five gates. Commit
(`feat(ribbon): state-sync — st.block display name + caret-driven gallery highlight`).

### Task 8: PM-native hover live-preview

**Files:** Create: `src/renderer/bridge/style-preview.ts`;
Modify: `src/renderer/bridge/io.ts`, `src/renderer/bridge/index.ts`,
`src/renderer/public/js/ribbon.js`

Design: hover applies the style as a REAL transaction (true Word preview — renders via
the normal decoration/cascade pipeline) flagged `addToHistory:false` + a preview meta;
mouse-leave restores the exact pre-preview `EditorState` via **`editor.setState`**
(Editor.ts:1758-1763 — sets the Editor's private `_state` AND the view; a raw
`view.updateState` would desync `editor.state` (Editor.ts:607/1709) and the very next
dispatch would throw `Applying a mismatched transaction`). The snapshot ALSO carries
the converter's `documentModified`/`documentGuid` — the docChanged path mutates them
outside EditorState (Editor.ts:3205-3214), so `setState` alone can't revert them. The
dirty flag ignores preview transactions (io.ts meta guard — `emit('update', { editor,
transaction })` carries the tr, Editor.ts:3216). `setState` emits no events
(documented), so a no-op meta transaction nudges the rAF ribbon sync afterwards
(docChanged=false → no 'update' → dirty untouched; applies cleanly since
prevState === the restored snapshot). Real input mid-preview must WIN: gallery hover
never blurs the view (cells preventDefault mousedown), so a keystroke can land on top
of the preview — capture-phase `keydown`/`beforeinput` listeners cancel the preview
first (real Word drops the preview on typing too), else the leave-restore would
silently discard the user's edit.

- [ ] **Step 8.1: `style-preview.ts`** (new file):

```ts
// PM-native styles-gallery hover preview (slice 3): apply on hover as a throwaway
// transaction, restore the exact prior EditorState on leave. The legacy mechanism
// (innerHTML snapshot/restore, ribbon.js stylePreview*) has no PM analogue — and the
// restore MUST go through the Editor wrapper: the fork double-books state in a
// private _state field (Editor.ts:607; `get state()` 1709-1711) that only
// #dispatchTransaction/setState write. A raw view.updateState would restore the VIEW
// only — the next dispatch then applies against the stale preview _state and throws
// RangeError('Applying a mismatched transaction'). editor.setState (Editor.ts:
// 1758-1763) sets _state AND the view, and emits nothing.
//
// TRAP: NEVER route the preview through editor.commands.* — the CommandService
// dispatches its own tr WITH history. We build the tr ourselves and reuse the
// engine's applier (applyLinkedStyleToTransaction, exported via
// linked-styles/index.js → helpers.js).
import { applyLinkedStyleToTransaction } from '@extensions/linked-styles/index.js'

type AnyEditor = any

export const PREVIEW_META = 'wcStylePreview'

export function installStylePreview(editor: AnyEditor) {
  // Snapshot = the authoritative editor state PLUS the converter metadata the
  // docChanged path mutates (documentModified/documentGuid live on the converter,
  // OUTSIDE EditorState — Editor.ts:3205-3214 — so setState alone can't revert them).
  let snap: { state: any; documentModified: any; documentGuid: any } | null = null

  function restore() {
    if (!snap) return
    editor.setState(snap.state) // restores _state AND the view (see header note)
    if (editor.converter) {
      editor.converter.documentModified = snap.documentModified
      editor.converter.documentGuid = snap.documentGuid
    }
    snap = null
    // setState emits no events (documented) — nudge the rAF ribbon sync with a no-op
    // meta transaction so toggles/highlight re-read the restored state. docChanged=false
    // → no 'update' event → dirty untouched; applies cleanly (prevState === snap.state).
    editor.view?.dispatch(editor.view.state.tr.setMeta(PREVIEW_META, true))
  }

  function stylePreviewEnter(styleId: string): boolean {
    // Hop contract: ALWAYS restore a live preview first (covers a missed mouseleave),
    // THEN evaluate the new cell — an unresolvable style must never strand the
    // previous cell's preview.
    restore()
    const view = editor.view
    if (!view || !styleId) return false
    const style = editor.helpers?.linkedStyles?.getStyleById?.(styleId)
    if (!style) return false
    snap = {
      state: editor.state,
      documentModified: editor.converter?.documentModified,
      documentGuid: editor.converter?.documentGuid,
    }
    const tr = editor.state.tr
    tr.setMeta('addToHistory', false) // prosemirror-history: never an undo step
    tr.setMeta(PREVIEW_META, true)    // io.ts dirty guard
    if (!applyLinkedStyleToTransaction(tr, editor, style)) { snap = null; return false }
    view.dispatch(tr)
    return true
  }

  // Real input mid-preview must WIN: the gallery never blurs the view (cells
  // preventDefault mousedown; focus.ts guards #ribbon), so a keystroke can land on
  // top of the preview — cancel it BEFORE the input applies or the leave-restore
  // would silently discard the user's edit (real Word drops the preview on typing
  // too). Capture phase = ahead of PM's own handlers. Listeners die with the editor
  // view on replaceEditor — same lifecycle as every install* binding.
  editor.view?.dom?.addEventListener('keydown', () => { if (snap) restore() }, true)
  editor.view?.dom?.addEventListener('beforeinput', () => { if (snap) restore() }, true)

  return {
    stylePreviewEnter,
    stylePreviewLeave: () => restore(),
    // Click path: restore FIRST, then the caller (Commands.applyStyle) applies for
    // real through the normal path — one clean history transaction from the
    // pre-preview state.
    stylePreviewCommitRestore: () => restore(),
  }
}
```

- [ ] **Step 8.2: io.ts dirty guard.** Replace line 8:

```ts
import { PREVIEW_META } from './style-preview'
```

```ts
  editor.on('update', ({ transaction }: any = {}) => {
    if (transaction?.getMeta?.(PREVIEW_META)) return // gallery hover preview is not an edit
    dirty = true
    w.WC?.Files?.updateTitle?.()
  }) // 'update' fires only on docChanged
```

- [ ] **Step 8.3: index.ts wiring.** In `installBridge` (line 201):

```ts
  Object.assign(PM, installCommands(editor), installIo(editor), installStylePreview(editor))
```

with `import { installStylePreview } from './style-preview'` at the top. Add inert
pre-mount stubs in `preinstallBridge` (after `newBlank`, line 189):

```ts
    stylePreviewEnter: () => false,
    stylePreviewLeave: () => {},
    stylePreviewCommitRestore: () => {},
```

- [ ] **Step 8.4: ribbon.js PM branches.** Rewrite the three preview functions
(ribbon.js:16-30) — PM branch first, legacy bodies BYTE-IDENTICAL:

```js
  function stylePreviewEnter(name) {
    if (window.WC.PM && window.WC.PM.active) {
      // PM-native preview (slice 3): throwaway transaction via the bridge. Gate on
      // the area flip so an unflipped build previews nothing (D6 courtesy).
      if (window.WC.PM.ready && !window.WC.PM.isBlocked('stylesGallery')) {
        window.WC.PM.stylePreviewEnter(window.WC.PM.styleIdForName(name) || '');
      }
      return;
    }
    if (!E() || !E().node) return;
    if (!gallerySnap) gallerySnap = { html: E().node.innerHTML, sel: serializeSel(), dirty: E().dirty };
    WC.applyNamedStyle(name);
  }
  function stylePreviewLeave() {
    if (window.WC.PM && window.WC.PM.active) {
      if (window.WC.PM.ready) window.WC.PM.stylePreviewLeave();
      return;
    }
    if (!gallerySnap) return;
    E().node.innerHTML = gallerySnap.html;
    restoreSel(gallerySnap.sel);
    E().dirty = gallerySnap.dirty;
    E().repaginate();
    gallerySnap = null;
  }
  function stylePreviewCommit() {
    if (window.WC.PM && window.WC.PM.active) {
      if (window.WC.PM.ready) window.WC.PM.stylePreviewCommitRestore();
      return;
    }
    gallerySnap = null;
  }
```

- [ ] **Step 8.5: Gates + partial green.** `npm run build` + five gates. The `[3]`
preview tests stay red until Task 11 (the enter path gates on `isBlocked('stylesGallery')`).
Spot-check in devtools (`npm start`): run `WC.PM.stylePreviewEnter('Heading1')` then
`WC.PM.stylePreviewLeave()` on a selected paragraph → style appears, then the doc is
byte-identical (`WC.editor.getJSON()` equal), `WC.editor.state === WC.view.state`, and
`WC.PM.isDirty()` is unchanged. Also: `WC.PM.stylePreviewEnter('Heading1')` then TYPE a
character → the preview cancels itself and the character lands on the original doc.
Commit
(`feat(ribbon): PM-native styles-gallery hover preview (throwaway txn + state restore)`).

### Task 9: `Commands.applyStyle` + styles pane PM branches

**Files:** Modify: `src/renderer/public/js/commands.js:987-990`,
`src/renderer/public/js/dialogs.js:318-349`

- [ ] **Step 9.1: applyStyle PM branch** (commands.js:987-990) — replace:

```js
    applyStyle(name) {
      if (WC.PM && WC.PM.active && WC.PM.isBlocked('stylesGallery')) { WC.PM.notifyBlocked('Styles'); return; }
      const pm = PMA();
      if (pm) {
        // setStyleById path (one transaction; Word gallery = plain apply). false =
        // style missing from this doc's catalog (foreign docs beyond the import
        // defaults — recorded deviation: real Word mints built-ins on demand).
        if (!pm.applyStyleByName(name)) WC.toast('Style “' + name + '” is not available in this document.');
        return;
      }
      WC.applyNamedStyle(name);
    },
```

- [ ] **Step 9.2: stylesPane mode-aware** (dialogs.js:318-349) — replace the function.
THREE changes, legacy paths byte-identical: (1) a D6 gate at the top — this **closes the
pre-existing PM-mode leak** (the gallery chevron, ribbon.js:235, opens the pane with no
guard and its items mutate the hidden legacy editor TODAY); (2) item clicks + Clear All
apply via the bridge in PM mode; (3) New Style toasts in PM mode (recorded deferral —
custom styles have no engine path):

```js
  D.stylesPane = function () {
    let pane = document.getElementById('styles-pane'); if (pane) { pane.remove(); return; }
    // D6 (slice 3): the gallery chevron calls this directly (ribbon.js) with no
    // launcher gate — block here until the styles area flips.
    if (window.WC.PM && window.WC.PM.active && window.WC.PM.isBlocked('stylesGallery')) { window.WC.PM.notifyBlocked('Styles'); return; }
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    pane = el('div', { class: 'taskpane right', id: 'styles-pane' });
    const head = el('div', { class: 'tp-head' }, [el('div', { class: 'tp-title', text: 'Styles' }), el('span', { class: 'x', html: WC.icon('win_close', 12), style: { cursor: 'pointer' }, onclick: () => pane.remove() })]);
    const body = el('div', { class: 'tp-body styles-list' });
    let preview = true;
    const list = el('div');
    const previewRow = el('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 0' } }, [
      (() => { const cb = el('input', { type: 'checkbox', checked: 'checked' }); cb.addEventListener('change', () => { preview = cb.checked; render(); }); return cb; })(),
      el('span', { text: 'Show Preview' }),
    ]);
    function render() {
      list.innerHTML = '';
      (WC.Styles ? WC.Styles.all() : ['Normal']).forEach((s) => {
        const item = el('div', { class: 'sl-item', text: s });
        if (preview) item.setAttribute('style', (STYLE_PREVIEW[s] || '') + ';');
        item.addEventListener('mousedown', (e) => e.preventDefault());
        item.addEventListener('click', () => {
          const pm2 = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
          if (pm2) { if (!pm2.applyStyleByName(s)) WC.toast('Style “' + s + '” is not available in this document.'); return; }
          WC.applyNamedStyle(s);
        });
        list.appendChild(item);
      });
    }
    render();
    body.appendChild(previewRow);
    body.appendChild(list);
    const footer = el('div', { style: { display: 'flex', gap: '6px', padding: '10px 0 0', borderTop: '1px solid #eee', marginTop: '8px' } }, [
      el('button', { class: 'btn', text: 'New Style', onclick: () => { if (pm) { WC.toast("New Style isn't on the new engine yet", 'Custom styles land in a later slice — run with --legacy for the classic editor'); return; } D.createStyle(render); } }),
      // Re-capture per click (the item-click pm2 pattern): failBridge can un-flip the
      // mode while the pane is open — never act on a stale bridge reference.
      el('button', { class: 'btn', text: 'Clear All', onclick: () => { const pm2 = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm2) { if (!pm2.applyStyleByName('Normal')) WC.toast('Style “Normal” is not available in this document.'); return; } WC.applyNamedStyle('Normal'); } }),
    ]);
    body.appendChild(footer);
    pane.appendChild(head); pane.appendChild(body);
    document.getElementById('workarea').appendChild(pane);
  };
```

(Note: the PM list intentionally still renders `WC.Styles.all()` — the same 15 BUILTIN
display names the legacy pane shows, all of which resolve through `applyStyleByName`
after Task 4 **on blank-template-derived documents** (the `[3]` suite resets via
`newBlank`; a foreign doc missing built-ins beyond the import defaults gets the toast
fallback — recorded deferral). The frozen legacy test 158 only runs under `--legacy`
and the legacy branch is unchanged.)

- [ ] **Step 9.3: Gates.** Five gates. Legacy 257 MUST stay green (test 158 drives
`D.stylesPane` under `--legacy` where `WC.PM.active` is false — both new guards are
inert there). PM `[3]` pane tests stay red until the flip (the D6 gate now blocks the
pane in PM mode — which is the point). Commit
(`feat(home): styles gallery click + styles pane flip to the PM engine (D6-gated)`).

### Task 10: changeListLevelMenu resolved-ilvl fix (slice-2 revisit a)

**Files:** Modify: `src/renderer/public/js/commands.js:332-353`

- [ ] **Step 10.1:** In `changeListLevelMenu`, replace **lines 337-347** — BOTH comment
blocks (the ONE-full-delta comment at 337-339 AND the DEVIATION comment at 340-343),
the attrs/np/cur reads (344-346), AND the `const delta` line (347) — with the block
below (which re-states the kept comment and re-declares `delta`; replacing a narrower
range would leave a duplicate `const delta` → SyntaxError killing all of commands.js).
The engine applies the delta to the RESOLVED level (changeListLevel.js:65-71), so the
menu must read the same source:

```js
        // ONE full-delta call = one transaction = one undo step (changeListLevelBy).
        // NEVER chain repeated increase/decreaseListIndent — changeListLevel reads
        // editor.state, so chained ±1 steps land one short.
        // Slice 3: `cur` reads the RESOLVED level via the bridge (closes the recorded
        // slice-2 deviation — style-inherited list paragraphs land on target; the
        // engine applies the delta against the same resolved source).
        const resolved = pm.getResolvedParaProps();
        const np = resolved && resolved.numberingProperties ? resolved.numberingProperties : null;
        const cur = np && np.ilvl != null ? np.ilvl : 0;
        const delta = (i - 1) - cur;
```

(Lines 348-350 — the non-list no-op comment + the `if (delta !== 0)` dispatch — and the
flyout loop around it stay untouched.)

- [ ] **Step 10.2: Regression check.** `npm run build && npm run test:pm` → the `[2]`
test `Change List Level → Level 3 sets ilvl 2 as ONE undo step` MUST stay green (inline
attrs present → resolved returns the same ilvl). All five gates. Commit
(`fix(home): Change List Level reads the resolved ilvl (slice-2 deviation closed)`).

# Stage D — the flip, gates, oracle, wrap-up

### Task 11: FLIP the registry — area `styles` goes live

**Files:** Modify: `src/renderer/bridge/index.ts:23`, `src/renderer/public/js/app.js:94-97`

- [ ] **Step 11.1: The auditable flip moment:**

```ts
const FLIPPED = new Set<string>(['character', 'history', 'paragraph', 'lists', 'styles']) // slices 1-3
```

This single edit un-blocks: `Commands.applyStyle` (gallery clicks), the hover preview
(`isBlocked` gate in ribbon.js), the styles launcher (probe `stylesGallery` →
`map.styles` → the now-mode-aware pane), the pane's own D6 gate, and the four
`pmBlockedOr('styles', …)` keyboard chords — every target was rewritten in Tasks 6-10.

- [ ] **Step 11.1b: app.js keydown re-points** (app.js:76 + 94-97) — in the SAME
commit, so keyboard and ribbon go live together (spec §6.C; slice-2 precedent).

**First, the SHADOW FIX:** app.js:76's New-Document entry has no shift guard and
precedes the styles entry in the map, so Ctrl+Shift+N returns `newDoc` and line 94 is
DEAD CODE — in both worlds, today. Without this fix the chord triggers
`Files.newDoc()` → a stuck `confirmDiscard` modal. Change line 76 to:

```js
        if (k === 'n' && !shift) return () => WC.Files.newDoc();
```

(Legacy-visible fidelity fix, recorded: Ctrl+Shift+N becomes Apply-Normal — what line
94 always intended and what real Word does — instead of New Document. The frozen 257
gate is unaffected: test-suite.js dispatches no Ctrl(+Shift)+N keydown — verified, its
only synthetic chord is Ctrl+Enter.)

**Then** replace the four styles entries (app.js:94-97) with live PM ternaries (the
app.js:70-71/84-88 pattern; styleIds are engine vocabulary — no name lookup needed
here):

```js
        if (shift && k === 'n') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Normal') : WC.applyNamedStyle('Normal'); };
        if (e.altKey && k === '1') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Heading1') : WC.applyNamedStyle('Heading 1'); };
        if (e.altKey && k === '2') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Heading2') : WC.applyNamedStyle('Heading 2'); };
        if (e.altKey && k === '3') return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setStyleById', 'Heading3') : WC.applyNamedStyle('Heading 3'); };
```

(Task 3 stripped the fork's competing `Mod-Alt-1..6` — each chord now has exactly one
owner with Word's apply semantics.)

- [ ] **Step 11.2: Full PM suite green.** `npm run build && npm run test:pm` → ALL
tests pass: the 76 pre-existing + the full `[3]` block (~96 total). Triage stragglers
with the probe-JSON fail details before touching code.

- [ ] **Step 11.3: All five gates + counts.** Record exact totals (expect PM ≈ 96,
legacy 257, smoke 9+9, docx 17). Commit
(`feat(home): flip styles area onto the PM engine (D6 registry + Word chords)`).

### Task 12: full-gate sweep + manual sanity

- [ ] **Step 12.1:** Clean-room run of all five gate commands from the plan header;
paste the five summary lines into the PR description draft.
- [ ] **Step 12.2:** Manual smoke in `npm start`: type → hover gallery cells (live
preview appears/restores; no dirty-asterisk flicker in the title) → **hover a style and
TYPE without moving the mouse, then mouse away — the character survives and the preview
is gone** (the input-cancel path; also try a dead-key/IME composition start here — the
runtime-only probe the critique flagged) → click Heading 1 → caret-move between
styled/unstyled paragraphs (highlight follows; Normal highlighted on plain text) →
Strong on a word → No Spacing → pane via launcher + chevron (items apply; New Style
toasts; Clear All normalizes) → Ctrl+Shift+N / Ctrl+Alt+1-3 → REAL key-press Cmd+Opt+1
with focus in the page (single fire, applies, no toggle on repeat) → Ctrl+Z chain back.
Then `npm start -- --legacy`: gallery hover-preview + click + pane drive the OLD editor
unchanged, and Ctrl+Shift+N now applies Normal there too (the Step-11.1b shadow fix —
recorded legacy-visible change).
- [ ] **Step 12.3:** Save a `.docx` with Heading 1/2, Title, Quote, Strong, No Spacing
content; reopen (Ctrl+O) — styles survive visually + in `paraAttrs` reads.

### Task 13: oracle validation (spec §8.3) — per feature family

Manual, against Word for Mac 16.77.1; **re-read the README quirks first** (#22 dot-file,
#23 session health — relaunch if Task 2's session degraded); reports + screenshots into
`docs/superpowers/plans/notes/` (naming: `2026-06-06-slice3-*`). Word left clean after
every leg.

- [ ] **Step 13.1: Leg A (clone → Word).** In the clone: 5 paragraphs — Normal,
Heading 1, Heading 2, Title, Quote; plus one word styled Strong inside a sixth Normal
paragraph. Ctrl+S to `tests/fixtures/oracle-out-s3-styles.docx` (non-dot). Run
`node scripts/oracle/word-oracle.js read-style-props "$(pwd)/tests/fixtures/oracle-out-s3-styles.docx" --out docs/superpowers/plans/notes/2026-06-06-slice3-oracleA.json`
→ expect Word to read back the applied styles (`style normal`, `style heading1`,
`style heading2`, `style title`, `style quote` — exact raw strings per the Task-2
discoveries).
- [ ] **Step 13.2: Leg B (Word → clone).** In real Word author: Heading 1, Heading 3,
Title, Subtitle, Intense Quote paragraphs, a Strong word, a Subtle Emphasis word, and a
**No Spacing** paragraph. Save, Ctrl+O in the clone → per paragraph compare
`WC.editor.getAttributes('paragraph').paragraphProperties.styleId` + rendering
side-by-side (heading colors/sizes via decorations; No Spacing's zero after-spacing).
ALSO diff Word's generated styles.xml definitions for Strong/Emphasis/SubtleEmphasis/
NoSpacing against the Task-4 minted defaults — adjust the defaults if Word's real
definitions differ (then re-run gates).
- [ ] **Step 13.3: Behavior verdicts** (close out the Task-2.5 probes with the shipped
behavior): re-apply=apply ✓/✗; direct-formatting clearing — record the engine-vs-Word
verdict as PASS or KNOWN DEVIATION; caret highlight incl. Normal-default ✓/✗; preview
scope ✓/✗. Record in `2026-06-06-slice3-verdicts.json`.
- [ ] **Step 13.4: Table-style spot check (Task 5).** Open a Word-authored .docx with a
styled table (author in leg B's session: insert a table, apply a table style with a
colored header row, put text in cells) → in the clone, in-table paragraphs resolve
without error and the [1]/[2] suites stay green; visual render compared side-by-side
(EXPECTED partial: table-style rendering beyond paragraph props is future-slice
territory — record what resolves).
- [ ] **Step 13.5: UI fidelity screenshots** (`--shot` harness + real Word side-by-side):
gallery with highlight on a Heading-1 caret; hover-preview mid-hover. Commit the notes
(`docs(plan): slice-3 oracle validation evidence`).

### Task 14: checkpoint + PR

- [ ] **Step 14.1:** Invoke the **plan-tracking** skill: append the slice-3 dated entry
to `docs/plan/last-point.md` (top), tick the Daily work log in
`docs/plan/execution-map.md`, update CURRENT PHASE (slice 3 DONE → slice 4 clipboard +
editing-misc next). Carry the recorded deferrals (below) into the entry.
- [ ] **Step 14.2:** Commit per the **commit-style** skill; push; open the PR
(slice-3 branch → `main`) with: gate counts, oracle JSONs + screenshots, the fork-edit
NOTICE summary, and the deferral list.

---

## Recorded deferrals (carry into last-point.md)

- **New Style / custom styles** (WC.Styles registry, wcs-* classes, D.createStyle):
  legacy-only; PM toasts. Engine path requires minting w:style into styles.xml + plugin
  state + translatedLinkedStyles refresh (two-catalog desync risk) — future slice.
- **`D.applyStyles` dialog** (dialogs.js:367): dead code in both worlds (zero callers;
  its Ctrl+Shift+S is Save As); stays dead.
- **Foreign docs missing built-ins beyond the import defaults** (e.g. a doc with no
  `Heading4`/`Quote` definition): `applyStyleByName` returns false → toast. Real Word
  mints from its built-in library — recorded deviation.
- **Empty styled paragraphs** render base-size caret/line (LinkedStyles decorations
  style TEXT nodes only — plugin.js:162) — geometry deviation vs Word until a
  caret-line treatment lands.
- **Direct-formatting clearing on style apply**: engine clears char marks
  unconditionally; ORACLE-VERIFIED (2026-06-07, notes/2026-06-07-slice3-word-behavior.json):
  Word clears only at FULL coverage (whole paragraph bold → cleared) and PRESERVES
  partial coverage (one bold word survives a style apply). The engine deviates on the
  partial case — KNOWN DEVIATION, recorded, not fixed this slice.
- **Plugin styles list is init-frozen** (LinkedStyles plugin state captured at editor
  construction): fine while Open/New rebuild the editor; a future modify-style feature
  must refresh both catalogs (converter.linkedStyles + translatedLinkedStyles).
- Gallery cell preview CSS stays the hardcoded ribbon.js map (UI chrome, both modes).
- **IME composition started mid-hover-preview**: the capture-phase keydown/beforeinput
  cancel covers the common path; exotic composition sequencing is a runtime-only probe
  (Task 12.2) — record the observed behavior.
- **Phase-3 logger note**: preview transactions carry `PREVIEW_META` and are NOT user
  edits — the transaction-seam logger (main.ts `lastTxn`) and the future Phase-3 logger
  must learn to skip them.
- **Ctrl+Shift+N shadow fix** (Step 11.1b) is a deliberate legacy-visible behavior
  change: the chord was dead code (shadowed by Ctrl+N) in both worlds; it now applies
  Normal, per Word. Frozen 257 unaffected (no coverage — verified).

## Self-review + plan-critique (done at authoring)

Grounded by a 6-agent inventory workflow (ribbon gallery/live-preview, legacy applier +
frozen-suite coverage, fork styles engine, bridge/state-sync, PM-suite/gates, oracle +
slice-2 carry-overs — 2026-06-06), then hardened by a 4-critic adversarial workflow
(code-vs-repo, coverage/ordering, test-validity, preview-design; 20 findings incl.
overlaps, ALL applied). The blockers it caught: **the fork double-books editor state**
— `view.updateState(snap)` restores only the view while `editor._state` keeps the
preview, so the next dispatch throws `Applying a mismatched transaction` (→ restore via
`editor.setState`, Editor.ts:1758, + desync-canary asserts in the hover test);
**Ctrl+Shift+N was dead code** — app.js:76's unshifted Ctrl+N→newDoc entry shadows it,
and the test would strand a confirmDiscard modal (→ the Step-11.1b shadow fix, recorded
legacy-visible); **~11 tests used partial selections** that take the
linked-character-style branch (w:link styles never set paragraphProperties.styleId) and
could never go green (→ full-setDoc-string selections + the SELECTION RULE preamble);
**the `[3]` block inherited negation-run.docx** from the last `[1]` test — no Quote
definition, bold Normal (→ the `newBlank()` context reset). Majors: the all-red Step-1.3
gate was unsatisfiable (4 engine-capability tests green from day one — now recorded
pins); Task 10's replace range left a duplicate `const delta` (SyntaxError — range
corrected to 337-347); mid-preview typing was silently discarded by the restore (→
capture-phase keydown/beforeinput cancel, Word-parity). Minors: preview trs flip
converter.documentModified/documentGuid outside EditorState (→ snapshot + restore
both); the hop early-return could strand a stale preview (→ restore-first reorder);
test 2's bold guard matched negation marks (→ the `[1]`-precedent `bold:`+value-0
guard); the pre-flip half-alive highlight is now recorded as deliberate. Everything
else the critics verified clean — notably: no commands↔state-sync import cycle, the
@extensions alias resolves from bridge TS, addDefaultStylesIfMissing runs on EVERY load
incl. character styles (no type filter), w:rStyle round-trips textStyle.styleId both
ways, `addToHistory:false` preserves history-group timing (no newGroupDelay reset), no
autonomous mid-preview transaction sources exist (collab inert without ydoc; all
appendTransaction plugins gate on docChanged), the io.ts meta guard survives
appendTransaction (effectiveTransaction = first docChanged tr), [0b]-last stays safe,
and the frozen-suite/legacy byte-identity claims hold at every intermediate commit.

## Self-review (run at authoring — fix inline)

1. **Spec/design coverage:** brainstorm D-preview-restore (T8, tests in T1),
   D-pane-applies/New-Style-deferred (T9), D-mint-missing (T4); spec §9.1 row 3 surface
   — gallery (T9.1), LinkedStyles/`setStyleById` (T6), `toggleHeading` (consciously
   unused — apply semantics, T3 rationale), live-preview semantics (T8); state-sync
   `block` seam (T7); slice-2 revisits (a) T10 / (b) T5; oracle §8.3 (T2/T13); §8.4 DoD
   (T11-T14); the 1 cmd id `stylesGallery` + launcher + 4 keyboard chords + pane + hover
   (T6-T11).
2. **Placeholder scan:** every step carries code or an exact command; the two discovery
   steps (2.4 style-read iteration, 13.2 minted-defs diff) name their decision rules.
3. **Type consistency:** `applyStyleByName(name)` defined T6.3 = called T9.1/T9.2 and
   asserted in T1 tests; `getResolvedParaProps()` defined T6.3 = called T10.1 + T1 test;
   `styleIdForName` defined T6.3 = called T8.4; `stylePreviewEnter/Leave/CommitRestore`
   defined T8.1 = stubbed T8.3 = called T8.4; `STYLE_NAME_TO_ID`/`STYLE_ID_TO_NAME`
   defined T6.1 = imported T6.3/T7.1; `PREVIEW_META` defined T8.1 = imported T8.2;
   `buildTableInfo` defined T5.1 = used in both resolver functions; `cellFor` defined
   T1.1 = used throughout the T1 tests.
