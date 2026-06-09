# Phase 2 — Slice 5 Implementation Plan: find-replace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the `find-replace` ribbon area (Find / Advanced Find… / Go To… split-button
+ Replace + Ctrl+F/Ctrl+H/Ctrl+G shortcuts) onto the owned ProseMirror engine, replacing the
legacy code that **destructively rewrites `#editor` text nodes into `.find-hit` spans** with the
fork's **decoration-based Search extension** (non-destructive highlights), and shipping the full
Word option set the user approved — **Match Case, Whole Words Only, Use Wildcards, and the
Advanced Find/Replace dialog** — every behavior oracle-validated against real Word 16.77.1.

**Architecture:** Spec `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`
(D1–D7 + §5–§9 are the contract; §9.1 row 5 = "fork Search extension, decoration-based, replaces
destructive `.find-hit` spans; find pane re-point"). Slice-2/3/4 pattern: legacy entry points in
`commands.js` / `dialogs.js` / `app.js` get PMA-ternary PM branches; the `WC.PM` bridge is the only
code talking to the vendored Editor; **the FLIPPED-set edit is the auditable switch and lands LAST
(Task 8, same commit as the app.js Ctrl+F/H/G re-points).** The fork **already ships a complete,
non-destructive Search extension** (`extensions/search/search.js` + a patched `prosemirror-search`):
`setSearchSession(query,{caseSensitive,ignoreDiacritics,highlight})→{matches,activeMatchIndex}`,
`nextSearchMatch()`/`previousSearchMatch()` (wrap-around), `replaceSearchMatch(text)` (re-runs the
session), `replaceAllSearchMatches(text)` (**one transaction**), `clearSearchSession()`; highlights
are `.ProseMirror-search-match`/`.ProseMirror-active-search-match` decorations (CSS already in the
build via `main.ts:12` → `prosemirror.css`). The **only engine gap**: the session path routes through
`SearchIndex`, which supports `caseSensitive`/`ignoreDiacritics` but **NOT whole-word or wildcards**
(`SearchIndex.search()` accepts a `string | RegExp` + `caseSensitive` — search.js:482-541, SearchIndex.js:416);
Task 3 (a NOTICE'd fork edit) plumbs `wholeWord` (doc-position word-boundary post-filter) and
`useWildcards` (Word-wildcard→RegExp translator) through `setSearchSession`.

**Brainstorm decisions (2026-06-09, user-approved — recorded for the checkpoint):**
**(1)** Maximum scope — ship **all four** Word options (Match Case, Whole Words, Wildcards, Advanced
Find dialog), not the minimal Match-Case-only baseline; **(2)** wire **all three** Find-dropdown items
this slice (Find · Advanced Find… · Go To…), not toast-defer the latter two; **(3)** the exotic
linguistic Advanced options (Sounds like, Find all word forms, Match prefix/suffix, Ignore
punctuation/whitespace) and **pagination-gated Go To targets (Page/Line visual landing)** are the
ONLY recorded deferrals — Go To by heading/bookmark works on the model; Page/Line degrade gracefully
("Page 1 of 1" continuous flow until Phase 7). Exact UI composition + option semantics are gated by
the Task-2 oracle probes (which Word for Mac actually surfaces — never assume the Windows dialog).

**Tech stack:** Electron 31 shell; electron-vite + TS renderer bridge
(`src/renderer/bridge/`); vendored SuperDoc fork (`@core`/`@extensions` aliases —
`extensions/search/`); in-renderer probe harness (`--probe-out` + `--shot-evalfile`); osascript
oracle (`scripts/oracle/word-oracle.js`).

**Branching:** everything on `feature/phase-2-slice-5-find-replace`, branched **directly off `main`**
(no stacked PRs). Already created — verify with `git branch --show-current` before any edit.

**Critique-hardened (2026-06-09):** 3-critic adversarial workflow (claims-vs-code, consistency/altitude,
design-holes) + an author cross-check. **3 confirmed blockers** + **4 majors** applied below:
- **BLOCKER (B1) — Search extension has no `name`:** `Search = Extension.create({…})` (search.js:226)
  sets **no `name:`**, and the fork's `Extension` base defaults `name='extension'` (Extension.ts:37,48,51).
  `ExtensionService` keys storage as `extensionStorage[extension.name]` (ExtensionService.js:260) — so
  `extensionStorage.search` is **`undefined`** today (and the unnamed key risks colliding with any other
  unnamed extension, last-write-wins). Task 3.0 adds `name: 'search'` (NOTICE'd) — load-bearing for the
  bridge `store()` key and every `[5]` `searchStore()`. (One critic claimed "convention infers 'search'
  from the export const" — REFUTED by the fork's actual `Extension` base.)
- **BLOCKER (B2) — app.js Ctrl+F/H bypass D6:** app.js:78-79 are **bare** `() => WC.Dialogs.findPane(…)`,
  NOT wrapped in the `pmBlockedOr(area, fn)` D6 guard (app.js:11) that sibling shortcuts use. Once
  `D.findPane` gets its PM branch (Task 5), these would open a working pane while the area is unflipped.
  Task 6.2 wraps both (+ the `edit.find`/`edit.replace` menu items, app.js:128) in
  `pmBlockedOr('find-replace', …)` **in the same commit as the flip** (they auto-unblock when FLIPPED
  gains `find-replace`). This IS the "app.js keydown re-point in the flip commit" carry-over.
- **BLOCKER (B3) — `goToDialog` is not `D.goToDialog`:** it's a **local** legacy fn in commands.js:1365
  (page-number, `E().pageMetrics()` — DOM-only), called directly by `findMenu` (commands.js:1362). The
  `[5]` Go To test calls `WC.Dialogs.goToDialog()`, which doesn't exist. Task 5.2 creates `D.goToDialog`
  in dialogs.js (PM branch + legacy arm) and re-points `findMenu` to `WC.Dialogs.goToDialog()`.
- **MAJORS:** (M1) the `searchIndexInvalidatorPlugin` (search.js:286-338) re-runs the session on every
  doc change passing ONLY `{caseSensitive,searchModel}` — Task 3.3 must explicitly read
  `storage.wholeWord`/`storage.useWildcards` and rebuild pattern+filter there too, else live typing/replace
  drops the options. (M2) `replaceSearchMatch` (search.js:770-775) re-calls `setSearchSession` with the
  stored options — Task 3 must add `wholeWord`/`useWildcards` to that call. (M3) `findSession` must
  **highlight-only** (no auto-jump) so live-search never steals focus from the find input — navigation
  (Enter/Next/Prev) does the selection jump; `activeMatchIndex=0` still holds because `setSearchSession`
  sets it in storage independent of any jump (search.js:664). (M4) whole-word filtering on the flat index
  text is correct for the common case but document a cross-paragraph/multi-range caveat + test it.
- **VERIFIED NOT A BLOCKER:** `#pm-editor` **does** carry `.sd-editor-scoped` at runtime
  (`applyStyleIsolationClass(options.element)` — ProseMirrorRenderer.ts:584, the non-headless docx path),
  so the `.ProseMirror-search-match` decoration CSS applies. Keep only a manual "highlights paint" verify.

**The five gates** (legacy + smoke ×2 + docx green at EVERY commit; the PM suite's `[5]` block is red
from Task 1 — minus any recorded engine-capability pins — and goes fully green at Task 8):

```bash
npm run build
npx electron . --legacy --probe-out=/tmp/wc-legacy.json --shot-evalfile=scripts/test-suite.js --shot-delay=800   # 257 pass
npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js                              # PM suite (112 → ~130)
npx electron . --probe-out=/tmp/wc-smoke.json --shot-evalfile=scripts/smoke-pm.js                                # 9 pass
npx electron . --legacy --probe-out=/tmp/wc-smoke-legacy.json --shot-evalfile=scripts/smoke-pm.js                # 9 pass
node scripts/test_docx.js                                                                                        # 17 pass
```

Check results: `node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/wc-pm.json'));console.log(r.summary);r.results.filter(x=>!x.pass).forEach(x=>console.log('FAIL',x.name,x.detail))"`

**⚠️ D6 repoint (slice-5 carry-over — BOTH `[0a]` tests now sit on find-replace cmds):** when
`find-replace` flips, BOTH inherited `[0a]` D6 probes go vacuously green / invert:
- the **run-block** test (test-suite-pm.js ~line 159) probes cmd `replace`,
- the **dropdown-block** test (~line 167) probes cmd `find`.

Task 1 repoints **BOTH** to a still-unflipped area — **insert-basics (slice 6)**, using `link`
(run-block) and `table` (dropdown-block), exactly as slice 4 repointed the run-block off `cut`. After
this slice the two `[0a]` D6 tests live on `link`/`table`; slice 6's red-tests task must repoint them
again (recorded in Task 9 carry-overs).

**⚠️ Highlights are decorations, not DOM:** the slice exists to replace the destructive `.find-hit`
TreeWalker rewrite (dialogs.js:139-159) with PM decorations — the doc is **never mutated to
highlight**. Tests assert on `editor.extensionStorage.search.searchResults` + the active-match
selection + the decoration set, NOT on injected spans. Do not "fix" a test by reintroducing span
injection.

---

## File structure (what gets created/modified)

| Path | Role |
|---|---|
| `scripts/test-suite-pm.js` (modify) | D6 repoint (`replace`→`link` run-block, `find`→`table` dropdown-block); the `[5]` block (~16-18 tests) between the `[4]` block (ends ~line, the Similar-Formatting/`D6 flip` tests) and the `[0b]` header (`[0b]` MUST stay LAST) |
| `scripts/oracle/word-oracle.js` + `README.md` (modify) | find/replace-semantics probes (match-case, whole-word, wildcard, replace-all scope/count, Go To targets, Mac UI composition); quirks #28+ |
| `src/renderer/core/superdoc-fork/extensions/search/search.js` (modify, fork) | `setSearchSession` gains `{wholeWord, useWildcards}`; builds the search pattern (string vs translated RegExp) + word-boundary post-filter; `searchIndexInvalidatorPlugin` refresh honors the same options |
| `src/renderer/core/superdoc-fork/extensions/search/SearchIndex.js` (modify, fork) | `wordBoundaryAt(offset)` helper (or post-filter on `{start,end}` matches) + `static wildcardToRegExp(pattern)` Word-wildcard translator; keep `search()` signature back-compatible |
| `src/renderer/core/superdoc-fork/NOTICE.md` (modify) | document the fork edits (whole-word + wildcard on the session path) |
| `src/renderer/bridge/search.ts` (new) | find/replace surface: `findSession(query,opts)`, `findNext()`, `findPrev()`, `replaceOne(text)`, `replaceAll(text)`, `clearFind()`, `findCount()`, `goTo(target,value)` |
| `src/renderer/bridge/index.ts` (modify) | import + spread `installSearch(editor)`; pre-mount stubs; **Task 8 only:** `FLIPPED` += `find-replace` |
| `src/renderer/public/js/dialogs.js` (modify) | `D.findPane(replace, advanced)` PM branch — re-point to drive the fork session (decoration highlights, live count, prev/next, replace/replace-all) + an options row (Match case / Whole words / Use wildcards); clear session on close; `goToDialog` PM branch |
| `src/renderer/public/js/commands.js` (modify) | `findMenu` unchanged dispatch verified; `H.find`/`H.replace` unblock via flip (no code change beyond confirming the ternary path); any new `goToDialog` wiring |
| `src/renderer/public/js/app.js` (modify, **Task 8 — same commit as the flip**) | Ctrl+F / Ctrl+H / Ctrl+G re-points become D6-live (verify the keydown guard; F4/Shift+F4 "repeat find" if oracle-confirmed on Mac) |
| `src/renderer/public/styles/editor.css` (modify, maybe) | only if the oracle shows the decoration colors need a Word-fidelity tweak or the `#pm-editor` highlight needs a non-`.sd-editor-scoped` rule — additive, recorded |

Not touched: `scripts/test-suite.js` (frozen), `ribbon-data.js`/`icons-fluent.js` (generated),
the legacy `.find-hit` TreeWalker path (stays for `--legacy`), the exotic Advanced linguistic options
(recorded deferrals — disabled/toast in the dialog).

---

# Stage A — red tests + oracle probes

### Task 0: branch + plan commit

- [ ] **Step 0.1:** confirm `git branch --show-current` → `feature/phase-2-slice-5-find-replace`
(already created off `main`). If not, `git checkout main && git pull && git checkout -b feature/phase-2-slice-5-find-replace`.
- [ ] **Step 0.2:** Commit this plan file
(`docs(plan): phase 2 slice 5 implementation plan — find-replace`).

### Task 1: D6 repoint (BOTH tests) + failing PM-suite tests (red)

**Files:** Modify: `scripts/test-suite-pm.js`

- [ ] **Step 1.0: Read the ACTUAL current suite first.** `grep -n "\[0a\] D6\|\[0b\]\|\[4\]" scripts/test-suite-pm.js`
to get the live offsets (the plan's `~159/~167` and "112" are approximate). Confirm: (A) the two `[0a]`
D6 test line ranges, (B) where the `[4]` block ends, (C) where the `[0b]` header starts (the `[5]` block
inserts between B and C; `[0b]` MUST stay LAST), (D) the current passing count. Use those real numbers
for Steps 1.1/1.3.

- [ ] **Step 1.1: Repoint BOTH `[0a]` D6 tests to insert-basics (slice 6).** At
test-suite-pm.js ~159-166, change the run-block probe `replace`→`link`; at ~167-173 change the
dropdown-block probe `find`→`table`. Both `link` and `table` are area `insert-basics` (verify in
`bridge/index.ts` AREA map — `link`/`table` should map to `insert-basics`; if a different unflipped
cmd is needed adjust and record it). Keep the asserts meaningful (no flyout opens; no dialog opens):

```js
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    // probe cmd lives in a STILL-UNFLIPPED area — repointed replace→link when
    // find-replace flipped (slice 5): a replace probe would go vacuously green once
    // find-replace is live; link keeps the test MEANINGFUL (insert-basics = slice 6).
    window.WC.Commands.run({ cmd: 'link', label: 'Link' });
    return document.querySelectorAll('.flyout').length === 0
      && !document.querySelector('.modal-backdrop'); // link dialog stays closed
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    window.WC.Commands.dropdown({ cmd: 'table', type: 'dropdown' }, document.body);
    const open = document.querySelectorAll('.flyout').length;
    window.WC.closeFlyouts();
    return open === 0;
  });
```

(VERIFY at execution: read the exact current text of both tests first; `link` opens a dialog not a
flyout, `table` opens a grid flyout — adjust the absence-asserts to each cmd's real UI. If `link`
has no dialog in this build, fall back to another insert-basics cmd that does, and record it.)

- [ ] **Step 1.2: Run the suite** (`npm run build && npm run test:pm`) → still 112/112 (the
repointed tests must pass BEFORE the flip too — `link`/`table` are blocked today).

- [ ] **Step 1.3: Append the `[5]` block** between the end of `[4]` and the `[0b]` header
(`[0b]` MUST stay last; the `[5]` tests set their own docs). Conventions carried from `[3]`/`[4]`:
`sleep(150)` for the rAF ribbon-sync tick, `sleep(550)` to close history groups before one-undo
asserts, string returns are FAILURES, absence-asserts guarded by a proven presence first. The
**selectText trap** (helper matches within a SINGLE text node — test-suite-pm.js:29-39): search tests
should `setDoc` plain homogeneous text so `selectText` needles never span a mark-split boundary.
Highlights are decorations: assert on `WC.editor.extensionStorage.search.searchResults` (the fork
storage) and the active selection, never on injected spans.

```js
  // ---------- slice 5: find-replace (decoration-based search + replace + options) ----------
  // These tests drive the fork Search extension through the WC.PM.search surface (Task 4)
  // and the re-pointed find pane (Task 5). Highlights are PM DECORATIONS — assert on
  // editor.extensionStorage.search.searchResults + the active-match selection, never on
  // injected .find-hit spans (the destructive legacy path the slice replaces).
  await PM().newBlank(); await sleep(100);
  const searchStore = () => window.WC.editor.extensionStorage.search;
  await t('[5] find session highlights all matches via decorations (no DOM mutation)', async () => {
    setDoc('alpha needle beta needle gamma needle');
    const before = JSON.stringify(doc().toJSON());
    PM().findSession('needle'); await sleep(150);
    const res = searchStore().searchResults;
    // doc text MUST be byte-identical (decorations don't mutate the doc).
    return res.length === 3 && JSON.stringify(doc().toJSON()) === before
      && document.querySelectorAll('#pm-editor .find-hit').length === 0;
  });
  await t('[5] find session count is exposed and active match starts at 0', async () => {
    setDoc('one two two two end');
    const r = PM().findSession('two'); await sleep(150);
    return PM().findCount().total === 3 && searchStore().activeMatchIndex === 0;
  });
  await t('[5] Next/Prev cycle the active match (wrap-around) and move the selection', async () => {
    setDoc('cat dog cat dog cat');
    PM().findSession('cat'); await sleep(150); // active 0
    PM().findNext(); await sleep(50);          // active 1
    const i1 = searchStore().activeMatchIndex;
    PM().findNext(); await sleep(50);          // active 2
    PM().findNext(); await sleep(50);          // wraps to 0
    const wrapped = searchStore().activeMatchIndex;
    PM().findPrev(); await sleep(50);          // wraps to 2
    const back = searchStore().activeMatchIndex;
    // selection follows the active match: at wrap (active 0) it spans the FIRST 'cat'.
    return i1 === 1 && wrapped === 0 && back === 2;
  });
  await t('[5] Match Case OFF matches mixed case; ON matches only exact case', async () => {
    setDoc('Needle needle NEEDLE');
    PM().findSession('needle', { caseSensitive: false }); await sleep(120);
    const insensitive = searchStore().searchResults.length; // 3
    PM().findSession('needle', { caseSensitive: true }); await sleep(120);
    const sensitive = searchStore().searchResults.length;   // 1
    return insensitive === 3 && sensitive === 1;
  });
  await t('[5] Whole Words ON does not match inside a larger word', async () => {
    setDoc('cat category scatter cat');
    PM().findSession('cat', { wholeWord: false }); await sleep(120);
    const loose = searchStore().searchResults.length;  // 4 (cat, cat-egory, s-cat-ter, cat)
    PM().findSession('cat', { wholeWord: true }); await sleep(120);
    const tight = searchStore().searchResults.length;  // 2 (the standalone 'cat' words)
    return loose === 4 && tight === 2;
  });
  await t('[5] Use Wildcards: ? matches one char, * matches a run', async () => {
    setDoc('bat bet bit boot brat');
    PM().findSession('b?t', { useWildcards: true }); await sleep(120);
    const single = searchStore().searchResults.length; // bat,bet,bit = 3 (NOT boot/brat)
    PM().findSession('b*t', { useWildcards: true }); await sleep(120);
    const star = searchStore().searchResults.length;   // bat,bet,bit,boot,brat = 5
    return single === 3 && star === 5;
  });
  await t('[5] Replace replaces the active match and advances', async () => {
    setDoc('foo bar foo bar foo');
    PM().findSession('foo'); await sleep(120);
    await sleep(550); // close history group
    PM().replaceOne('QUX'); await sleep(120);
    // first 'foo' becomes QUX; two 'foo' remain.
    return doc().textContent.startsWith('QUX bar foo bar foo')
      && searchStore().searchResults.length === 2;
  });
  await t('[5] Replace All replaces every match in ONE undo step', async () => {
    setDoc('aa zz aa zz aa');
    PM().findSession('aa'); await sleep(120);
    await sleep(550);
    const before = JSON.stringify(doc().toJSON());
    const r = PM().replaceAll('XX'); await sleep(120);
    if (!doc().textContent.includes('XX zz XX zz XX')) return 'replace all did not apply';
    if (r.replacedCount !== 3) return 'wrong count ' + r.replacedCount;
    PM().cmd('undo'); await sleep(80);
    return JSON.stringify(doc().toJSON()) === before; // ONE undo restores all
  });
  await t('[5] Replace All reports the count and clears the session', async () => {
    setDoc('q q q q');
    PM().findSession('q'); await sleep(120);
    const r = PM().replaceAll('w'); await sleep(120);
    return r.replacedCount === 4 && searchStore().activeMatchIndex === -1
      && searchStore().searchResults.length === 0;
  });
  await t('[5] clearFind removes all highlights and resets the session', async () => {
    setDoc('hit hit hit');
    PM().findSession('hit'); await sleep(120);
    PM().clearFind(); await sleep(80);
    return searchStore().searchResults.length === 0 && searchStore().query === '';
  });
  await t('[5] find pane (Ctrl+F path) opens in PM mode and is NOT the legacy taskpane block', async () => {
    setDoc('paneword paneword');
    window.WC.Dialogs.findPane(false); await sleep(80);
    // The PM pane renders real chrome (input + counter), not a notifyBlocked toast.
    const pane = document.getElementById('find-pane');
    const input = pane && pane.querySelector('input[type="text"]');
    if (!pane || !input) return 'find pane did not open';
    input.value = 'paneword';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300); // debounced doFind
    const ok = searchStore().searchResults.length === 2;
    pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] closing the find pane clears the search session (no orphan highlights)', async () => {
    setDoc('orphan orphan');
    window.WC.Dialogs.findPane(false); await sleep(80);
    const pane = document.getElementById('find-pane');
    const input = pane.querySelector('input[type="text"]');
    input.value = 'orphan'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    if (searchStore().searchResults.length !== 2) return 'precondition: search did not run';
    pane.querySelector('.x').click(); await sleep(80);
    return searchStore().searchResults.length === 0;
  });
  await t('[5] Replace pane (Ctrl+H path) renders Replace + Replace All controls', async () => {
    setDoc('zzz target zzz');
    window.WC.Dialogs.findPane(true); await sleep(80);
    const pane = document.getElementById('find-pane');
    const labels = Array.from(pane.querySelectorAll('button')).map((b) => b.textContent.trim());
    const ok = labels.some((l) => /^Replace$/.test(l)) && labels.some((l) => /Replace All/.test(l));
    pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] find pane options row exposes Match case / Whole words / Wildcards', async () => {
    window.WC.Dialogs.findPane(false); await sleep(80);
    const pane = document.getElementById('find-pane');
    const text = pane.textContent;
    const ok = /Match case/i.test(text) && /Whole word/i.test(text) && /[Ww]ildcard/i.test(text);
    pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] Advanced Find dropdown item opens the pane in advanced mode', async () => {
    const node = document.querySelector('[data-cmd="find"]') || document.body;
    window.WC.Commands.dropdown({ cmd: 'find', type: 'split' }, node);
    const item = Array.from(document.querySelectorAll('.flyout .fly-item'))
      .find((n) => /Advanced Find/i.test(n.textContent));
    if (!item) { window.WC.closeFlyouts(); return 'Advanced Find item not found'; }
    item.click(); await sleep(120);
    const pane = document.getElementById('find-pane');
    const ok = !!pane; // advanced variant still mounts a find UI (options expanded)
    pane && pane.querySelector('.x') && pane.querySelector('.x').click();
    return ok;
  });
  await t('[5] Go To dialog opens and jumps to a heading target (model-supported)', async () => {
    // Go To by heading works on the model (page/line are pagination-gated → Phase 7).
    setDocs(['Intro body text', 'Chapter Two body']);
    // make para 2 a heading so Go To has a heading target
    selectText('Chapter Two body'); PM().applyStyleByName('Heading 1'); await sleep(80);
    window.WC.Dialogs.goToDialog ? window.WC.Dialogs.goToDialog() : null; await sleep(80);
    const dlg = document.querySelector('.modal-backdrop, #goto-dialog, #find-pane');
    const ok = !!dlg;
    const close = dlg && (dlg.querySelector('.x') || Array.from(dlg.querySelectorAll('button')).find((b) => /Close|Cancel/.test(b.textContent)));
    close && close.click();
    return ok; // structural; exact Go-To semantics validated by oracle Task 2
  });
  await t('[5] D6 flip: find dropdown + replace open in PM mode', async () => {
    // inverse of the pre-flip D6 block — proves the registry flip reached dispatch.
    const node = document.body;
    window.WC.Commands.dropdown({ cmd: 'find', type: 'split' }, node);
    const findOpen = document.querySelectorAll('.flyout .fly-item').length > 0;
    window.WC.closeFlyouts();
    window.WC.Commands.run({ cmd: 'replace', label: 'Replace' }); await sleep(80);
    const replaceOpen = !!document.getElementById('find-pane');
    const p = document.getElementById('find-pane'); p && p.querySelector('.x') && p.querySelector('.x').click();
    return findOpen && replaceOpen;
  });
```

- [ ] **Step 1.4: Run** `npm run build && npm run test:pm` → all 112 pre-existing tests PASS; the
`[5]` block is RED (the `find-replace` area is still blocked by D6, the bridge `search.ts` surface is
missing, and the fork `wholeWord`/`useWildcards` options don't exist yet — throws count as red, `t()`
catches them). **Record any unexpectedly-green pins in the commit message** (e.g. the basic
`findSession`/Next/Prev tests may pass early via direct bridge calls once Task 4 lands, but stay red
now because `WC.PM.findSession` is undefined). Commit
(`test: slice-5 find-replace PM tests (red) + D6 repoint replace→link, find→table`).

### Task 2: oracle — find/replace semantics probes (decision gates for Tasks 3/5)

**Files:** Modify: `scripts/oracle/word-oracle.js`, `scripts/oracle/README.md`;
evidence into `docs/superpowers/plans/notes/2026-06-09-slice5-word-find-replace.json`

Pure tooling + validation (no gate impact). **Read `scripts/oracle/README.md` in full first** —
PID safety + quirks #1-27 are binding; **#24-26 (session health: Word must be launched WINDOWED by
the user; a bare AppleEvent auto-launches it headless with dead opens; recovery = make new document)
gate everything below.** Find/replace probes are partly UI-observed (the Find and Replace dialog) —
budget the empirical loop and, where the AppleScript object model can't drive the dialog, capture
**user-observed** verdicts (slice-4 precedent for the paste menus).

- [ ] **Step 2.0: Ask the USER to relaunch Word windowed** (quirk #24). Do not proceed headlessly
without confirmation.

- [ ] **Step 2.1: Match-case + whole-word semantics (scripted where possible, else observed).** In a
scratch Word doc, type `Needle needle NEEDLE cat category scatter`. Use Word's Find (Cmd+F → Advanced
Find, or the AppleScript `find` object on a text range) to record:
  1. Find `needle`, Match case OFF → how many hits (expect 3)? Match case ON → how many (expect 1)?
  2. Find `cat`, Find whole words only OFF → hits (expect 4: cat, cat-egory, s-cat-ter… confirm Word's
     exact count); ON → hits (expect 2). **Record Word's whole-word boundary definition** (does it
     treat hyphen/apostrophe as boundaries? digits? — gates the Task-3 post-filter boundary char class).

- [ ] **Step 2.2: Wildcard semantics (user-observed — gates the Task-3 translator).** Enable "Use
wildcards" in Word's Find and Replace dialog and record the behavior of each operator on a known
string, so the `wildcardToRegExp` translator matches Word exactly (NOT generic regex):
  - `?` (any single char), `*` (any run), `[abc]` / `[a-z]` (char set/range), `[!x]` (NOT),
    `<` / `>` (word start/end), `{n}` / `{n,m}` (repeats), `@` (one-or-more), `()` groups + `\n`
    backrefs in Replace, and how a LITERAL `?`/`*` is escaped (`\?`). Record which operators we will
    support now vs defer (recommend: `?`, `*`, `[ ]`, `[! ]`, `<`, `>` ship; `{}`,`@`,`()`/backrefs
    deferred unless cheap). **Also record: with wildcards ON, is Match Case forced ON in Word?**
    (Word: wildcards are always case-sensitive — gates a Task-3/Task-5 interaction.)

- [ ] **Step 2.3: Replace scope/count + selection semantics (scripted or observed).**
  1. `Replace All` of `aa`→`XX` in `aa zz aa zz aa` → does Word report "3 replacements"? (gates the
     Task-5 count toast + the `[5]` count test.)
  2. Single `Replace`: does Word replace the CURRENT match then advance to the next, or find-first
     then replace-on-second-click? (Word: Replace replaces the selected match and selects the next —
     confirm; gates `replaceOne` advance behavior.)
  3. Replace scope when there is a selection vs whole doc (Word: "Replace All" can be limited to the
     selection — record whether we honor selection scope now or whole-doc-only with a recorded
     deviation).
  4. Does Replace All wrap and include matches before the caret? (Word: whole document — confirm.)

- [ ] **Step 2.4: Mac UI composition (user-observed — gates Task-5 chrome).** Record what Word for Mac
16.77.1 actually shows so our pane/dialog offers the same *classes* (a Windows-only composition is a
recorded deviation, not silently shipped):
  - **Cmd+F:** the Navigation/Search sidebar — fields, options affordance (gear/dropdown?), count
    display ("1 of 3"), prev/next arrows.
  - **Advanced Find… / Replace (Cmd+H):** the modal Find and Replace dialog — tabs (Find / Replace /
    Go To?), the options under "More ▾" (Match case, Whole words, Use wildcards, Sounds like, Find all
    word forms, …), the buttons (Find Next, Replace, Replace All).
  - **Go To… (Cmd+G):** the Go To tab targets (Page, Section, Line, Bookmark, Comment, Heading, …) and
    which our model can satisfy now (heading/bookmark) vs pagination-gated (page/line → Phase 7).

- [ ] **Step 2.5: Document.** Append discoveries as quirks #28+ in the `word-oracle.js` header AND
README rows; verdicts JSON committed under `docs/superpowers/plans/notes/`. Word left clean (doc count
at baseline, never quit). Commit (`test(test): slice-5 Word find/replace semantics probes + verdicts`).

# Stage B — fork engine work (NOTICE-documented)

### Task 3: extend the Search session for whole-word + wildcards

**Files:** Modify:
`src/renderer/core/superdoc-fork/extensions/search/search.js`,
`src/renderer/core/superdoc-fork/extensions/search/SearchIndex.js`,
`src/renderer/core/superdoc-fork/NOTICE.md`

The fork session (`setSearchSession` — search.js:620-667) calls `searchIndex.search(query,{caseSensitive,searchModel})`
or `searchIgnoringDiacritics`; `SearchIndex.search()` already accepts a `string | RegExp`
(SearchIndex.js:416). Two new option dimensions, adjusted to the Task-2 verdicts before implementing.

- [ ] **Step 3.0 (BLOCKER B1): name the Search extension.** In search.js:226, add `name: 'search',` as
the FIRST field of the `Extension.create({…})` config (before `addStorage`). Without it the extension's
name defaults to `'extension'` (Extension.ts:37) and `editor.extensionStorage.search` — which the bridge
`store()` and every `[5]` test read — is `undefined`. VERIFY first that nothing currently reads
`editor.extensionStorage.extension` expecting the Search storage (`grep -rn "extensionStorage.extension\|extensionStorage\['extension'\]" src/renderer` — expect none) and that no OTHER mounted extension is also unnamed (which would have been silently colliding on the `'extension'` key — if found, name it too and record it). Add a NOTICE bullet (Step 3.5).

- [ ] **Step 3.1: `SearchIndex.wildcardToRegExp` translator.** Add a static method translating the
**Word wildcard operators confirmed in Step 2.2** to a JS RegExp source (NOT generic regex — escape
everything else literally). Minimum operator set (extend per Step 2.2):

```js
  /**
   * Translate a Word "Use wildcards" pattern into a RegExp source string.
   * Supports the operators confirmed against Word 16.77.1 (oracle Step 2.2):
   *   ?  → .            (any single char)
   *   *  → .*?          (any run, lazy)
   *   [abc] / [a-z]     → character set/range (passed through)
   *   [!abc]            → [^abc] (negated set)
   *   <  → \b(?=\w)     (word start)
   *   >  → (?<=\w)\b    (word end)
   * Everything else is escaped literally. `\?`/`\*`/`\[` are literal.
   * @param {string} pattern
   * @returns {string} RegExp source (caller adds flags)
   */
  static wildcardToRegExp(pattern) {
    let out = '';
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === '\\' && i + 1 < pattern.length) { out += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; continue; }
      if (ch === '?') { out += '.'; continue; }
      if (ch === '*') { out += '.*?'; continue; }
      if (ch === '<') { out += '\\b(?=\\w)'; continue; }
      if (ch === '>') { out += '(?<=\\w)\\b'; continue; }
      if (ch === '[') {
        // copy a char class verbatim, mapping a leading ! to ^
        let cls = '['; i++;
        if (pattern[i] === '!') { cls += '^'; i++; }
        while (i < pattern.length && pattern[i] !== ']') { cls += pattern[i]; i++; }
        cls += ']'; out += cls; continue;
      }
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return out;
  }
```

- [ ] **Step 3.2: word-boundary post-filter.** Whole-word is cleaner as a doc-position filter than a
`\b`-wrapped regex (avoids escaping interactions with the flexible-whitespace pattern and Unicode
`\b` gaps). Add to `SearchIndex` a predicate over the index text using the **boundary char class
confirmed in Step 2.1** (default: a "word char" is `[A-Za-z0-9_]`, plus any class the oracle shows
Word treating as in-word):

```js
  /**
   * True when the [start,end) offset range is a "whole word" — the chars immediately
   * outside the range are non-word (or string edges). Boundary class per oracle Step 2.1.
   * @param {number} start @param {number} end @returns {boolean}
   */
  isWholeWordMatch(start, end) {
    const wordRe = /\w/; // adjust to the Step-2.1 verdict if Word's class differs
    const before = start > 0 ? this.text[start - 1] : '';
    const after = end < this.text.length ? this.text[end] : '';
    return !(before && wordRe.test(before)) && !(after && wordRe.test(after));
  }
```

- [ ] **Step 3.3: thread the options through `setSearchSession`.** In search.js, extend the
`setSearchSession` options + the `searchIndexInvalidatorPlugin` refresh (both must agree, or live
edits drop the options). Build the pattern: wildcards → `new RegExp(SearchIndex.wildcardToRegExp(query), caseSensitive?'g':'gi')`
(remember the Step-2.2 verdict on whether wildcards force case-sensitivity); plain → the existing
string path. Then post-filter by `isWholeWordMatch` when `wholeWord`:

```js
  // inside setSearchSession, after reading options:
  const wholeWord = options.wholeWord ?? false;
  const useWildcards = options.useWildcards ?? false;
  this.storage.wholeWord = wholeWord;
  this.storage.useWildcards = useWildcards;
  // ...
  const pattern = useWildcards
    ? new RegExp(SearchIndex.wildcardToRegExp(query), caseSensitive ? 'g' : 'gi')
    : query;
  let indexMatches = ignoreDiacritics && !useWildcards
    ? searchIndex.searchIgnoringDiacritics(query, { caseSensitive, searchModel })
    : searchIndex.search(pattern, { caseSensitive, searchModel });
  if (wholeWord) indexMatches = indexMatches.filter((m) => searchIndex.isWholeWordMatch(m.start, m.end));
```

**(M1) Mirror the EXACT pattern-build + filter in `searchIndexInvalidatorPlugin.appendTransaction`**
(search.js:286-338) — it re-runs the session on EVERY doc change and today passes only
`{caseSensitive,searchModel}` (search.js:310-313). Explicitly read `const wholeWord = storage.wholeWord;`
and `const useWildcards = storage.useWildcards;`, build the same pattern (string vs `wildcardToRegExp`
RegExp), and post-filter `refreshed` with `isWholeWordMatch` when `wholeWord` — BEFORE storing
`storage.searchResults`. Without this, every keystroke/replace silently drops whole-word/wildcards.
Store `wholeWord`/`useWildcards` in `addStorage()` defaults and reset them in `clearSearchSession()`.

**(M2) Thread the options through `replaceSearchMatch`** (search.js:743-792): it re-calls
`commands.setSearchSession(this.storage.query, {…})` after a replace (search.js:770-775) — add
`wholeWord: this.storage.wholeWord, useWildcards: this.storage.useWildcards` to that options object so a
replace doesn't widen the result set by dropping the options.

**Wildcard ↔ case interaction (oracle Task 2.2):** if Word forces "Use wildcards" to be case-SENSITIVE,
the `wildcardToRegExp` path must build its RegExp with the `'g'` (no `'i'`) flag regardless of the Match
Case checkbox, and Task-5's options row should reflect that (disable/auto-check Match case when Wildcards
is on, per the verdict). Record the chosen behavior.

NOTE for the implementer: VERIFY `searchIndex.search()` returns `{start,end,text}` offset matches
(SearchIndex.js:416-451 — yes) so `isWholeWordMatch(m.start, m.end)` is valid; the post-filter runs on
INDEX offsets, before `mapIndexMatchesToDocMatches`. The flat index text's neighbor chars ARE the correct
whole-word boundary signal for the common case; **(M4)** for cross-paragraph/multi-range matches
(`match.ranges.length > 1`) the index-offset neighbors may be a paragraph separator — add a `[5]` test
for a whole-word search whose term sits at a paragraph edge and confirm the verdict, recording any
deviation. Confirm `(?<=...)` lookbehind is supported on the pinned V8 (Electron 31 → yes).

- [ ] **Step 3.4: Quick probe.** `npm run build`, `npm start`, devtools:
`WC.editor.commands.setSearchSession('cat', {wholeWord:true})` on a doc with `cat category` →
`WC.editor.extensionStorage.search.searchResults.length` excludes `category`;
`setSearchSession('b?t', {useWildcards:true})` matches `bat/bet/bit` only. Highlights paint (yellow,
active orange).

- [ ] **Step 3.5: NOTICE.** Append:

```markdown
- **Search extension named + session extended for whole-word + Word wildcards:** the
  `Search` extension now declares `name: 'search'` (was the unnamed `'extension'`
  default, which left `extensionStorage.search` undefined and risked key collisions);
  `SearchIndex` gains `static wildcardToRegExp()` (Word "Use wildcards" → RegExp,
  oracle-matched operator set) and `isWholeWordMatch(start,end)` (word-boundary filter);
  `setSearchSession`, the search-index invalidator, AND `replaceSearchMatch` accept +
  thread `{wholeWord, useWildcards}`, building the pattern / post-filter accordingly.
  Non-destructive (decorations only), back-compatible (`search()` signature unchanged)
  (slice 5, 2026-06-09).
```

- [ ] **Step 3.6: Gates** (all five). The `[5]` whole-word/wildcard tests still red via the D6
dispatch block (entry points not yet reachable through the ribbon) but the engine-capability pins go
green if probed directly. Commit
(`feat(editor): search session whole-word + Word wildcards (decoration-based)`).

# Stage C — bridge + entry-point rewrites (dispatch still blocks until Task 8)

> Pattern (commands.js:11): `const pm = PMA(); pm ? <PM path> : <legacy>`. PMA() ignores FLIPPED —
> PM branches are reachable via direct `WC.PM` calls immediately, but ribbon dispatch stays
> courtesy-blocked until Task 8. Legacy `D.findPane` arm stays byte-identical.

### Task 4: bridge — find/replace surface

**Files:** Create: `src/renderer/bridge/search.ts`;
Modify: `src/renderer/bridge/index.ts`

- [ ] **Step 4.1: `search.ts`** (new file). Thin wrapper over the fork Search commands; the fork
storage (`editor.extensionStorage.search`) is the state of record:

```ts
// Slice 5: find/replace surface. The fork Search extension owns the session, the
// decoration highlights, and the (non-destructive) replace transactions; this wrapper
// exposes Word-shaped entry points and reads the fork storage for counts.
type AnyEditor = any

export interface FindOptions { caseSensitive?: boolean; wholeWord?: boolean; useWildcards?: boolean; ignoreDiacritics?: boolean }

export function installSearch(editor: AnyEditor) {
  const store = () => (editor as any).extensionStorage?.search

  function findSession(query: string, opts: FindOptions = {}): { total: number; activeMatchIndex: number } {
    const r = editor.commands.setSearchSession(query, {
      caseSensitive: !!opts.caseSensitive,
      wholeWord: !!opts.wholeWord,
      useWildcards: !!opts.useWildcards,
      ignoreDiacritics: !!opts.ignoreDiacritics,
      highlight: true,
    })
    // (M3) HIGHLIGHT-ONLY: do NOT jump/scroll here. setSearchSession already sets
    // activeMatchIndex=0 in storage (search.js:664) and paints decorations; jumping
    // (goToFirstMatch) on every debounced keystroke would steal focus from the find
    // input and thrash the viewport. The selection jump happens on explicit nav
    // (findNext/findPrev) and on Enter — those call the fork's goToSearchResult, which
    // carries suppressSelectionSyncScroll for exactly this focus-restore cycle.
    return { total: r?.matches?.length ?? 0, activeMatchIndex: r?.activeMatchIndex ?? -1 }
  }
  function findNext(): number { const r = editor.commands.nextSearchMatch(); return r?.activeMatchIndex ?? -1 }
  function findPrev(): number { const r = editor.commands.previousSearchMatch(); return r?.activeMatchIndex ?? -1 }
  function replaceOne(text: string): { total: number; activeMatchIndex: number } {
    const r = editor.commands.replaceSearchMatch(text ?? '')
    return { total: r?.matches?.length ?? 0, activeMatchIndex: r?.activeMatchIndex ?? -1 }
  }
  function replaceAll(text: string): { replacedCount: number } {
    const r = editor.commands.replaceAllSearchMatches(text ?? '')
    return { replacedCount: r?.replacedCount ?? 0 }
  }
  function clearFind(): boolean { return editor.commands.clearSearchSession() }
  function findCount(): { total: number; activeMatchIndex: number } {
    const s = store()
    return { total: s?.searchResults?.length ?? 0, activeMatchIndex: s?.activeMatchIndex ?? -1 }
  }

  // Go To — model-supported targets now; page/line degrade gracefully (Phase 7).
  function goTo(target: string, value: string | number): boolean {
    // 'heading' | 'bookmark' implemented on the model; 'page' | 'line' → best-effort scroll
    // (continuous flow until pagination). Returns false for unsupported targets (caller toasts).
    return goToImpl(editor, target, value)
  }

  return { findSession, findNext, findPrev, replaceOne, replaceAll, clearFind, findCount, goTo }
}
```

(VERIFY at execution: the fork commands return shapes used above — `setSearchSession`→`{matches,activeMatchIndex}`,
`nextSearchMatch`/`previousSearchMatch`→`{activeMatchIndex,match}`, `replaceSearchMatch`→`{matches,activeMatchIndex}`,
`replaceAllSearchMatches`→`{replacedCount}` — confirmed in search.js:620-832. Implement `goToImpl`
per the Task-2.4 Go-To verdict: for `heading`, scan `doc` for paragraphs whose resolved style is a
heading and `setTextSelection`+scroll to the Nth; for `bookmark`, locate the bookmark node; for
`page`/`line`, scroll best-effort and return a flag so the caller can note the pagination caveat.)

- [ ] **Step 4.2: index.ts wiring.** Import + spread `installSearch(editor)` into the `WC.PM` surface
next to the `installClipboard` spread (index.ts:241). Add typed pre-mount stubs in
`preinstallBridge` (index.ts:~206):

```ts
    findSession: () => ({ total: 0, activeMatchIndex: -1 }),
    findNext: () => -1,
    findPrev: () => -1,
    replaceOne: () => ({ total: 0, activeMatchIndex: -1 }),
    replaceAll: () => ({ replacedCount: 0 }),
    clearFind: () => false,
    findCount: () => ({ total: 0, activeMatchIndex: -1 }),
    goTo: () => false,
```

- [ ] **Step 4.3: Probe + gates.** `npm run build`, devtools: `WC.PM.findSession('the')` → a count;
`WC.PM.findNext()` advances; `WC.PM.replaceAll('X')` returns a count; `WC.PM.clearFind()` → true.
The `[5]` direct-bridge tests (findSession/Next/Prev/Match-case/Whole-word/Wildcard/Replace/Replace-All/clear)
go green; the find-pane-path tests stay red. All five gates. Commit
(`feat(ribbon): bridge find/replace surface — session, navigate, replace, go-to`).

### Task 5: entry-point rewrites — find pane re-point, options, advanced, Go To

**Files:** Modify: `src/renderer/public/js/dialogs.js`, `src/renderer/public/js/commands.js`

- [ ] **Step 5.1: `D.findPane(replace, advanced)` PM branch.** Replace the current PM-mode early
return (dialogs.js:101-103 — the `notifyBlocked('Find & Replace')` stub) with a real PM branch that
builds the SAME pane chrome (so `--legacy` is byte-identical — keep the legacy body intact below the
ternary) but drives the fork session. Structure (reuse the existing `el(...)` pane builders):
  - search input → on debounced `input`, call `WC.PM.findSession(value, currentOpts)`; update the
    counter from `WC.PM.findCount()` ("N of M" / "No matches"); Enter → `WC.PM.findNext()`.
  - Prev/Next buttons → `WC.PM.findPrev()`/`findNext()`; counter reflects `activeMatchIndex+1`.
  - an **options row** (new, Word-faithful) with three checkboxes — *Match case*, *Whole words only*,
    *Use wildcards* — held in a `currentOpts` object; toggling any re-runs `findSession`. When
    `advanced` is true, the options row is expanded by default (the "More ▾" already open).
  - replace mode (`replace===true`): replace input + Replace/Replace All buttons →
    `WC.PM.replaceOne(val)` / `WC.PM.replaceAll(val)`; after Replace All, toast the count
    (`Replaced N`) and refresh the counter (session cleared → "No matches").
  - **close (the `.x` click) calls `WC.PM.clearFind()`** so no decorations orphan when the pane shuts.
  - PM mode does NOT call `clearHits()`/`E().node` (legacy DOM) — those stay in the legacy arm only.

```js
  D.findPane = function (replace, advanced) {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    if (pm) return pmFindPane(replace, advanced, pm);
    // ---- legacy arm (unchanged, byte-identical) ----
    clearHits();
    /* …existing legacy body verbatim… */
  };
```

and a `pmFindPane(replace, advanced, pm)` helper near `D.findPane` building the chrome above. (Show
the full helper at execution — mirror the legacy pane's `el()` structure so the CSS/layout match;
add the options row + wire every control to the `WC.PM` surface. Debounce `findSession` at 200ms like
the legacy `doFind`. The counter element + nav buttons already exist in the legacy structure — reuse
their classes so styling carries.)

- [ ] **Step 5.2 (BLOCKER B3): create `D.goToDialog` in dialogs.js + re-point `findMenu`.** Today
`goToDialog` is a **local** function in commands.js:1365 (legacy page-number via `E().pageMetrics()`),
called directly by `findMenu` (commands.js:1362) — there is NO `WC.Dialogs.goToDialog`, so the `[5]` Go
To test (which calls `window.WC.Dialogs.goToDialog()`) would throw. Create `D.goToDialog = function() { … }`
in dialogs.js following the `D.findPane` shape: a `pm` ternary — PM branch builds a small Go To dialog
(target dropdown Heading / Bookmark / Page / Line per the Task-2.4 verdict; `WC.dialog` pattern — grep
`D.wordCount` for a simple modal) → on Go, `WC.PM.goTo(target, value)`; on `false` (pagination-gated
target), toast "Go To {target} is available after pagination (Phase 7)." The legacy arm holds the
**current commands.js:1365 implementation verbatim** (move it into dialogs.js's legacy arm, or have the
legacy arm call the existing local fn if it stays exported — keep `--legacy` byte-identical). Then change
`findMenu`'s Go To item (commands.js:1362) from `goToDialog()` to `WC.Dialogs.goToDialog()`.

- [ ] **Step 5.3: `findMenu` + handlers.** After Step 5.2, `findMenu` (commands.js:1358) dispatches
Find→`findPane(false)`, Advanced Find→`findPane(false,true)`, Go To→`WC.Dialogs.goToDialog()` —
confirm the `advanced` arg flows through (Step 5.1). `H.find`/`H.replace` (commands.js:115-116) already
route to `findPane`; they stop being D6-blocked at the flip — no per-handler PM ternary (the PM branch
lives inside `D.findPane`). VERIFY the find split-button's primary click (not the dropdown) routes to
`H.find` → `findPane(false)`. **app.js shortcuts are handled separately in Task 6.2 (B2) — they need a
real code edit, not just the flip.**

- [ ] **Step 5.4: Probe + gates.** `npm run build`, `npm start`, devtools/manual: open the find pane
(it now renders chrome, not a toast), type a term → **highlights actually paint yellow (active match
orange)** — confirm `document.querySelector('#pm-editor .ProseMirror-search-match')` exists and is
visibly highlighted (the `.sd-editor-scoped` class is applied at runtime — ProseMirrorRenderer.ts:584 —
but eyeball it; slice-2 had a CSS-in-build surprise). Counter updates, Next/Prev cycle and the input
keeps focus (M3 — no viewport thrash on each keystroke); toggle Whole words → count drops; Replace All →
count toast + cleared. The `[5]` pane-path tests go green; the D6-flip test stays red (registry not
flipped yet). All five gates. Commit
(`feat(ribbon): re-point find/replace pane onto the fork search session + options + go-to`).

# Stage D — flip + gates + oracle validation

### Task 6: THE FLIP + app.js shortcut re-points (one commit)

**Files:** Modify: `src/renderer/bridge/index.ts`, `src/renderer/public/js/app.js`

- [ ] **Step 6.1: Flip the registry.** In `bridge/index.ts:28`, add `'find-replace'` to the `FLIPPED`
set. This is THE auditable switch.

- [ ] **Step 6.2 (BLOCKER B2): app.js shortcut re-points — REAL edit (SAME commit).** app.js:78-79 are
**bare** today: `if (k === 'f') return () => WC.Dialogs.findPane(false);` / `if (k === 'h') return () => WC.Dialogs.findPane(true);`
— NOT wrapped in the `pmBlockedOr(area, fn)` D6 guard (app.js:11) that sibling shortcuts use (e.g.
app.js:74). Because `D.findPane` now has a working PM branch, leaving them bare would open a live pane
even before the flip. Wrap BOTH (and the `edit.find`/`edit.replace` menu entries at app.js:128, and the
Ctrl+G Go To shortcut if present) in `pmBlockedOr('find-replace', …)`:

```js
  if (k === 'f') return pmBlockedOr('find-replace', () => WC.Dialogs.findPane(false));
  if (k === 'h') return pmBlockedOr('find-replace', () => WC.Dialogs.findPane(true));
  // …and at app.js:128:
  'edit.find': pmBlockedOr('find-replace', () => WC.Dialogs.findPane(false)),
  'edit.replace': pmBlockedOr('find-replace', () => WC.Dialogs.findPane(true)),
```

(VERIFY the exact `pmBlockedOr` signature/order at app.js:11 and match sibling usage; confirm Ctrl+G's
binding and wrap its `goToDialog` call too.) Because `pmBlockedOr` reads `isFlipped('find-replace')`
live, wrapping them in THIS commit (which also adds `find-replace` to FLIPPED) means they're guarded
pre-flip and active post-flip — co-locating the flip with shortcut activation per the slice-4 precedent.
Add F4 / Shift+F4 ("repeat find" / "find previous") **only if** the Task-2 oracle confirms them on Mac
Word (otherwise record as deferred).

- [ ] **Step 6.3: Run the full PM suite.** `npm run build && npm run test:pm` → the `[5]` block goes
fully GREEN (including the D6-flip test); 112 + the new `[5]` count. Triage any failures (expect the
async pane tests to need a poll-tick adjustment, not a logic change). Then ALL FIVE gates:
legacy 257, smoke 9×2, docx 17, PM ~130. Commit
(`feat(ribbon): flip find-replace onto the PM engine + Ctrl+F/H/G re-points`).

### Task 7: oracle validation (spec §8.3) + UI evidence

**Files:** evidence into `docs/superpowers/plans/notes/2026-06-09-slice5-oracle-*.json` + screenshots

- [ ] **Step 7.1: Leg A (clone → Word).** In the clone, find+replace a term (e.g. replace-all
`foo`→`bar`), save via bytes-IPC, open in real Word via the oracle, read back the text → confirm the
replacements persisted and no stray highlight/markup leaked into the saved `.docx` (decorations are
view-only → must NOT serialize). JSON verdict.

- [ ] **Step 7.2: Leg B (Word → clone).** In real Word, author a doc with repeated terms + a heading,
save, import via `WC.PM.openDocx`, run `findSession` → confirm counts match what Word's Find reports;
whole-word + match-case + wildcard counts match the Step-2.1/2.2 verdicts. JSON verdict.

- [ ] **Step 7.3: UI fidelity.** `--shot` screenshots of the find pane + Advanced Find + Go To vs the
Word for Mac screenshots from Task 2.4; record deviations (Mac sidebar vs modal composition, deferred
exotic options). Note the recorded deferrals: wildcard `{}`/`@`/`()` backrefs (unless shipped),
Sounds-like / Find-all-word-forms / prefix-suffix / ignore-punctuation, Go To Page/Line visual
landing (pagination-gated).

- [ ] **Step 7.4: Word left clean** (doc count at baseline, never quit). Commit
(`test(test): slice-5 oracle legs A/B + UI fidelity verdicts`).

### Task 8: checkpoint + PR

- [ ] **Step 8.1: Plan-tracking.** Invoke the `plan-tracking` skill: append a dated `last-point.md`
entry (slice 5 BUILT — what flipped, gate counts, known deviations, slice-6 carry-overs incl. **BOTH
`[0a]` D6 tests now on `link`/`table`**), tick the Daily work log, advance CLAUDE.md/AGENTS.md/plan.md
banners to slices-0a–5 / slice-6-next. Commit (`docs(repo): checkpoint Phase 2 slice 5 BUILT`).

- [ ] **Step 8.2: PR.** Open the PR to `main` per `finishing-a-development-branch` (commit-style skill;
no AI trailer). Body: what flipped, the fork edits (NOTICE'd), oracle verdicts, gate counts, known
deviations + carry-overs.

---

## Known deviations / recorded deferrals (fill in at execution from oracle verdicts)

- Wildcard operators shipped vs deferred (`{}`,`@`,`()`/backrefs) — per Step 2.2.
- Advanced exotic options (Sounds like, Find all word forms, Match prefix/suffix, Ignore
  punctuation/whitespace) — deferred (disabled/toast).
- Go To Page/Line **visual** landing — pagination-gated (Phase 7); heading/bookmark work now.
- Mac sidebar vs Windows modal composition — record the chosen UI and any deviation.
- Replace scope (selection vs whole-doc) — per Step 2.3.3.

## Carry-overs for slice 6 (insert-basics)

- **BOTH `[0a]` D6 tests now sit on insert-basics cmds** (`link` run-block + `table` dropdown-block) —
  slice 6's red-tests task must repoint BOTH to a still-later-slice area (or invert them as the
  insert-basics flip tests).
- Slice-4 follow-up still open (not slice-5 work): the Word→clone list-marker leak (supportLists
  markers paste as literal text → double-marker; candidate fix in bridge `pasteHTML` preprocessing or
  the converter).
