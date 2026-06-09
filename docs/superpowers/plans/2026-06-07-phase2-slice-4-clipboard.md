# Phase 2 — Slice 4 Implementation Plan: clipboard + editing-misc

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the `clipboard` ribbon area (Cut / Copy / Paste split-button + dropdown
flavors + Paste Special dialog + Format Painter) and a NEW `editing-misc` area (the
Select dropdown) onto the owned ProseMirror engine, with the fork's format painter
extended to Word scope (paragraph properties + full mark set) and every behavior
oracle-validated against the user's real Word 16.77.1.

**Architecture:** Spec `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`
(D1–D7 + §5–§9 are the contract); slice-2/3 pattern: legacy entry points in
`commands.js`/`ribbon.js`/`app.js` get PMA-ternary PM branches; the `WC.PM` bridge is
the only code talking to the vendored Editor; the **FLIPPED-set edit is the auditable
switch and lands LAST** (Task 8). prosemirror-view already owns DOM-level clipboard
(its serializer puts HTML+text on the clipboard; its parser handles paste) — the ribbon
buttons only **trigger** those native paths: cut/copy/paste via new
`webContents.cut()/copy()/paste()` IPC; flavored pastes via new Electron-`clipboard`-
module read channels + `view.pasteText`/`view.pasteHTML`/`setImage`. Brainstorm
decisions (2026-06-07, user-approved): **(1)** spec wins the select conflict — `select`
remaps `find-replace` → new `editing-misc` area and flips THIS slice; **(2)** the fork
painter is extended to Word scope (paragraph properties + missing marks, exact scope
set by oracle probes), NOTICE-documented; **(3)** paste flavors = Keep Source
Formatting + Keep Text Only + Picture + a real Paste Special… dialog; Merge Formatting
and Set Default Paste… stay recorded toast-deferrals.

**Critique-hardened (2026-06-07):** 4-critic adversarial workflow, 32 findings, **8
confirmed blockers** applied (mark-boundary selectText traps ×2, `justification` attr
key, async flyout/dialog races ×3, the painter double-click trap, similar-formatting
boundary-marks vacuity), all 12 majors + 12 minors folded in below.

**Tech stack:** Electron 31 (`clipboard` module + `webContents` edit methods in main),
electron-vite + TS (renderer bridge), vendored SuperDoc fork (`@core`/`@extensions`),
in-renderer probe harness (`--probe-out` + `--shot-evalfile`), osascript oracle
(`scripts/oracle/word-oracle.js`).

**Branching:** everything on `feature/phase-2-slice-4-clipboard`, branched **directly
off `main`** (no stacked PRs). Verify with `git branch --show-current` before any edit.

**Prompt-claim corrections recorded at brainstorm (carry into the checkpoint):**
`buildHiddenMenu` is NOT installed — `Menu.setApplicationMenu(null)` (main.js:110), so
keyboard clipboard rides on Blink's built-in mac editing behavior (Task 1 verifies
empirically); `editing-misc` existed only in docs until this slice creates it.

**The five gates** (legacy + smoke ×2 + docx must be green at EVERY commit; the PM
suite's `[4]` block is red from Task 1 — minus any recorded engine-capability pins —
and goes fully green at Task 8):

```bash
npm run build
npx electron . --legacy --probe-out=/tmp/wc-legacy.json --shot-evalfile=scripts/test-suite.js --shot-delay=800   # 257 pass
npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js                              # PM suite (96 → ~112)
npx electron . --probe-out=/tmp/wc-smoke.json --shot-evalfile=scripts/smoke-pm.js                                # 9 pass
npx electron . --legacy --probe-out=/tmp/wc-smoke-legacy.json --shot-evalfile=scripts/smoke-pm.js                # 9 pass
node scripts/test_docx.js                                                                                        # 17 pass
```

Check results: `node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/wc-pm.json'));console.log(r.summary);r.results.filter(x=>!x.pass).forEach(x=>console.log('FAIL',x.name,x.detail))"`

**⚠️ D6 repoint (slice-4 carry-over, rationale corrected by critique):** the `[0a]`
run-block test (test-suite-pm.js:159-162) probes cmd `cut`. When `clipboard` flips it
does NOT invert — it goes **vacuously green with a destructive side effect** (a live
`run('cut')` mid-suite). The repoint to `replace` (area `find-replace`, slice 5)
restores the test's *meaning*, not its color. The dropdown-block test probes `find`
(also `find-replace`) — unaffected this slice; **both [0a] D6 tests then sit on
find-replace cmds, so slice 5's red-tests task must repoint BOTH** (recorded in
Task 11 carry-overs).

**⚠️ Real-OS-clipboard tests:** the `[4]` tests drive the REAL system clipboard
(deterministic via new `clipboard:write*` channels). Running the PM suite clobbers
whatever the user had on the clipboard — acceptable for a local dev harness; noted
here so nobody "fixes" it into a mock that bypasses the prosemirror-view pipeline the
slice exists to validate. `webContents.paste()` is fire-and-forget (the renderer-side
paste lands asynchronously) — every paste assert below uses a **sentinel poll**
(suite precedent: test-suite-pm.js:114), never a bare fixed sleep.

---

## File structure (what gets created/modified)

| Path | Role |
|---|---|
| `scripts/test-suite-pm.js` (modify) | D6 run-block repoint (`cut`→`replace`); the `[4]` block (~16 tests) between the `[3]` round-trip test (~line 795) and the `[0b]` header (~line 797 — `[0b]` MUST stay last) |
| `scripts/oracle/word-oracle.js` + `README.md` (modify) | clipboard-semantics probes (clipboard-info read after Word copy); quirks #28+ |
| `src/main/preload.js` (modify) | `wordAPI.clipboard.{flavors,readText,readHTML,readImage,writeText,writeHTML,writeImage,cut,copy,paste}` |
| `src/main/main.js` (modify) | `ipcMain.handle('clipboard:*')` blocks; **conditional Task 8.3:** hidden-menu install iff Blink paste fails the Task-1.4 verify (hoist the `legacyBoot` decl above the menu call — it is declared at main.js:118 today, AFTER `Menu.setApplicationMenu(null)`) |
| `src/renderer/core/superdoc-fork/extensions/format-commands/format-commands.js` (modify, fork) | Word-scope painter: stored paragraph properties (numbering CARRIED by default) + full mark capture (link EXCLUDED); generic replace-apply (link survives on targets); `cancelFormatPainter`; options-aware `copyFormat` (idempotent `persistent`, heuristic gated to no-arg callers); app-chrome UI selectors |
| `src/renderer/core/superdoc-fork/NOTICE.md` (modify) | document the fork edits |
| `src/renderer/bridge/clipboard.ts` (new) | flavored paste surface: `pasteDefault/pasteTextOnly/pastePicture/pasteHTML/clipboardFlavors` + cut/copy triggers |
| `src/renderer/bridge/commands.ts` (modify) | `selectAll()`, `selectSimilarFormatting()` (covered-run reference marks); painter: `armFormatPainter(sticky)`, `cancelFormatPainter()`, `painterArmed()` |
| `src/renderer/bridge/state-sync.ts` (modify) | painter button `toggled` + page cursor chrome from fork extensionStorage |
| `src/renderer/bridge/index.ts` (modify) | expose the new surfaces; pre-mount stubs; painter Esc listener (surface-layered); **Task 8 only:** `FLIPPED` += `clipboard`,`editing-misc`; `select` remap → `editing-misc` |
| `src/renderer/public/js/util.js` (modify) | `WC.flyItem` gains a `disabled` option (`.disabled` class, onClick not wired) — additive, legacy callers unaffected |
| `src/renderer/public/js/commands.js` (modify) | `H.cut/copy/paste` PM branches; `pasteMenu` PM branch (prefetch-then-flyout); `selectMenu` PM branch; painter handlers PM branches (legacy arms byte-identical, incl. formatPainterLock's node expression) |
| `src/renderer/public/js/dialogs.js` (modify) | new `D.pasteSpecial()` (flavor list from the real clipboard, dblclick-to-OK); `D.clipboardPane` PM-mode toast branch (legacy-only pipeline, recorded deferral) |
| `src/renderer/public/js/app.js` (modify, **Task 8 — same commit as the flip**) | NEW Cmd+Shift+C / Cmd+Shift+V copy/paste-format chords (PM-ternary returning `null` under legacy; oracle-gated by Task 2 verdicts) |

Not touched: `scripts/test-suite.js` (frozen), `ribbon-data.js`/`icons-fluent.js`
(generated), Set Default Paste… / Merge Formatting (recorded deferrals — PM menu
items disabled/toast), `WC.Draw` (Select Objects PM branch toasts until slice 10),
`WC.Layout.selectionPane` (legacy-DOM reader — PM branch toasts, recorded deferral).

---

# Stage A — red tests + oracle probes

### Task 0: branch + plan commit

- [ ] **Step 0.1:** `git checkout main && git pull && git checkout -b feature/phase-2-slice-4-clipboard`.
Verify: `git branch --show-current` → `feature/phase-2-slice-4-clipboard`.
- [ ] **Step 0.2:** Commit this plan file
(`docs(plan): phase 2 slice 4 implementation plan — clipboard + editing-misc`).

### Task 1: D6 repoint + failing PM-suite tests (red)

**Files:** Modify: `scripts/test-suite-pm.js`

- [ ] **Step 1.1: Repoint the D6 run-block test.** At test-suite-pm.js:159-162, change
the probe cmd from `cut` to `replace` and harden the assert (H.replace opens the find
PANE, not a flyout — assert both stay closed; verify the pane's actual DOM id by
reading `D.findPane` in dialogs.js first and adjust the selector if it differs):

```js
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    // probe cmd lives in a STILL-UNFLIPPED area — repointed cut→replace when
    // clipboard flipped (slice 4): a cut probe would go vacuously green with a
    // destructive live cut mid-suite; replace keeps the test MEANINGFUL.
    window.WC.Commands.run({ cmd: 'replace', label: 'Replace' });
    return document.querySelectorAll('.flyout').length === 0
      && !document.getElementById('find-pane'); // findPane stays closed
  });
```

- [ ] **Step 1.2: Run the suite** (`npm run build && npm run test:pm`) → still 96/96
(the repointed test must pass BEFORE the flip too — `replace` is blocked today).

- [ ] **Step 1.3: Append the `[4]` block** between the end of `[3]` (the round-trip
test, ~line 795) and the `[0b]` header (~line 797 — `[0b]` MUST stay last; the `[4]`
tests set their own docs). Conventions carried from `[2]`/`[3]`: `sleep(150)` for the
rAF ribbon-sync tick, `sleep(550)` to close history groups before one-undo asserts,
string returns are FAILURES, absence-asserts guarded by a proven presence first.
Clipboard determinism: every test WRITES the clipboard first via
`wordAPI.clipboard.write*` — never depends on a previous test's clipboard. Paste
results are awaited by **sentinel polls** (webContents.paste is fire-and-forget).
**selectText trap (critique blocker):** the helper matches within a SINGLE text node
(test-suite-pm.js:29-39) — after `run('bold')` splits a paragraph's text node, a
needle spanning the boundary THROWS. Painter sources therefore select only the
homogeneous bold word — which is also semantically required: `getMarksFromSelection`
aggregates a range by INTERSECTION (fork getMarksFromSelection.test.js: mixed range →
`[]`), so a mixed source would copy no marks at all.

```js
  // ---------- slice 4: clipboard + editing-misc (cut/copy/paste + painter + select) ----------
  // These tests drive the REAL OS clipboard (wordAPI.clipboard channels, Task 4) so
  // the prosemirror-view serializer/parser pipeline is what's under test — no mocks.
  await PM().newBlank(); await sleep(100);
  const CB = () => window.wordAPI.clipboard;
  // Sentinel poll: webContents paste/cut/copy land asynchronously in the renderer.
  const until = async (fn, tries = 40) => { for (let i = 0; i < tries && !fn(); i++) await sleep(50); return fn(); };
  await t('[4] ribbon Copy puts the selection on the OS clipboard', async () => {
    await CB().writeText(''); // clear
    setDoc('copyprobe alpha beta'); selectText('copyprobe');
    run('copy');
    let txt = '';
    const ok = await until(() => txt.includes('copyprobe'), 20) // poll wrapper below refreshes txt
      || await (async () => { for (let i = 0; i < 20; i++) { txt = await CB().readText(); if (txt.includes('copyprobe')) return true; await sleep(50); } return false; })();
    return ok && doc().textContent.includes('copyprobe');
  });
  await t('[4] ribbon Cut removes the selection AND fills the clipboard', async () => {
    await CB().writeText('');
    setDoc('cutprobe gamma delta'); selectText('cutprobe');
    run('cut');
    let txt = '';
    const filled = await (async () => { for (let i = 0; i < 20; i++) { txt = await CB().readText(); if (txt.includes('cutprobe')) return true; await sleep(50); } return false; })();
    const removed = await until(() => !doc().textContent.includes('cutprobe'));
    return filled && removed;
  });
  await t('[4] ribbon Paste inserts clipboard text through the PM pipeline', async () => {
    await CB().writeText('pasteprobe-payload');
    setDoc('target paragraph here');
    const sel = selectText('target');
    window.WC.editor.commands.setTextSelection({ from: sel.from, to: sel.from });
    run('paste');
    return until(() => doc().textContent.includes('pasteprobe-payload'));
  });
  await t('[4] paste (KSF) preserves character formatting via the HTML parser', async () => {
    await CB().writeHTML('<p><strong>boldbit</strong> plain</p>');
    setDoc('ksf target text'); const s = selectText('ksf');
    window.WC.editor.commands.setTextSelection({ from: s.from, to: s.from });
    run('paste');
    if (!(await until(() => doc().textContent.includes('boldbit')))) return 'paste never landed';
    // [1]-precedent guard: a negation mark (value '0') must not count as bold-on.
    return markNames('boldbit').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
  });
  await t('[4] paste is ONE undo step', async () => {
    await CB().writeText('one-undo-payload');
    setDoc('undo paste target');
    const s0 = selectText('undo');
    window.WC.editor.commands.setTextSelection({ from: s0.from, to: s0.from }); // caret, not whole-doc selection
    await sleep(550); // close the history group
    const before = JSON.stringify(doc().toJSON());
    run('paste');
    if (!(await until(() => doc().textContent.includes('one-undo-payload')))) return 'paste never landed';
    PM().cmd('undo'); await sleep(50);
    return JSON.stringify(doc().toJSON()) === before;
  });
  await t('[4] Keep Text Only strips source formatting', async () => {
    await CB().writeHTML('<p><strong>strippedbold</strong></p>');
    setDoc('kto target text'); const s2 = selectText('kto');
    window.WC.editor.commands.setTextSelection({ from: s2.from, to: s2.from });
    await PM().pasteTextOnly(); await sleep(150);
    if (!doc().textContent.includes('strippedbold')) return 'text did not paste';
    return !markNames('strippedbold').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
  });
  await t('[4] Picture flavor pastes an image node from the clipboard', async () => {
    // 1×1 red PNG
    await CB().writeImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    setDoc('pic target text');
    await PM().pastePicture(); await sleep(150);
    let found = false;
    doc().descendants((n) => { if (n.type.name === 'image') found = true; });
    return found; // VERIFY at execution: the Image extension's node name is 'image' (check its `name` field)
  });
  await t('[4] paste dropdown renders the 6 Word items in PM mode', async () => {
    const node = document.querySelector('[data-cmd="paste"]') || document.body;
    window.WC.Commands.dropdown({ cmd: 'paste', type: 'split' }, node);
    // PM pasteMenu prefetches the clipboard flavors (IPC) BEFORE building the
    // flyout — poll for the items, never assert synchronously.
    await (async () => { for (let i = 0; i < 20 && !document.querySelector('.flyout .fly-item'); i++) await sleep(50); })();
    const items = Array.from(document.querySelectorAll('.flyout .fly-item')).map((n) => n.textContent.trim());
    window.WC.closeFlyouts();
    return ['Keep Source Formatting', 'Merge Formatting', 'Picture', 'Keep Text Only']
      .every((l) => items.some((i) => i.startsWith(l)))
      && items.some((i) => i.startsWith('Paste Special'))
      && items.some((i) => i.startsWith('Set Default Paste'));
  });
  await t('[4] Paste Special dialog lists the flavors actually on the clipboard', async () => {
    await CB().writeHTML('<p>flavor probe</p>'); // HTML write also sets text/plain
    await window.WC.Dialogs.pasteSpecial(); // async: awaits the flavors IPC, then WC.dialog mounts synchronously
    const dlg = document.querySelector('.modal-backdrop .dialog');
    if (!dlg) return 'dialog did not open';
    const rows = Array.from(dlg.querySelectorAll('li,option,.ps-item')).map((n) => n.textContent);
    const ok = rows.some((r) => /HTML/i.test(r)) && rows.some((r) => /Unformatted/i.test(r));
    const close = Array.from(dlg.parentNode.querySelectorAll('button')).find((b) => /^(Cancel|Close)$/.test(b.textContent.trim()));
    if (close) close.click();
    return ok;
  });
  await t('[4] format painter one-shot: char formatting copies, applies once, disarms', async () => {
    setDocs(['painterbold source here', 'painterplain target here']);
    selectText('painterbold'); run('bold'); await sleep(50);
    // Arm from the HOMOGENEOUS bold word only: (a) selectText cannot span the
    // mark-split text nodes; (b) getMarksFromSelection intersects a mixed range to [].
    selectText('painterbold');
    run('formatPainter'); await sleep(50);
    selectText('painterplain'); await sleep(150); // fork auto-applies on selectionUpdate
    const applied = markNames('painterplain').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
    // one-shot: a SECOND selection must NOT receive the format
    selectText('target'); await sleep(150);
    const second = markNames('target').some((x) => x.startsWith('bold') && !x.includes('"value":"0"'));
    return applied && !second;
  });
  await t('[4] format painter copies PARAGRAPH formatting (Word scope)', async () => {
    setDocs(['parapaint source line', 'parapaint target line two']);
    selectText('parapaint source line'); PM().cmd('setTextAlign', 'center'); await sleep(50);
    run('formatPainter'); await sleep(50);
    selectText('target line two'); await sleep(150);
    // Engine key is paragraphProperties.justification (text-align.js; [2] precedent
    // test-suite-pm.js:326) — justify/jc/textAlign never exist.
    return paraAttrs('target').paragraphProperties?.justification === 'center';
  });
  await t('[4] painter sticky (dblclick) survives two applies; Esc disarms', async () => {
    setDocs(['stickybold source', 'stickyone target', 'stickytwo target']);
    selectText('stickybold'); run('bold'); await sleep(50);
    selectText('stickybold'); // homogeneous bold run (see one-shot test note)
    run('formatPainterLock'); await sleep(50); // ribbon dblclick path
    selectText('stickyone'); await sleep(150);
    selectText('stickytwo'); await sleep(150);
    const both = ['stickyone', 'stickytwo'].every((n) => markNames(n).some((x) => x.startsWith('bold') && !x.includes('"value":"0"')));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(150); // state-sync rAF tick
    const fpBtn = window.WC.Ribbon.controlIndex.formatPainter?.node;
    return both && !!fpBtn && !fpBtn.classList.contains('toggled');
  });
  await t('[4] painter button shows toggled while armed (state-sync chrome)', async () => {
    setDoc('chromeprobe text'); selectText('chromeprobe');
    run('formatPainter'); await sleep(150);
    const fpBtn = window.WC.Ribbon.controlIndex.formatPainter?.node;
    const on = !!fpBtn && fpBtn.classList.contains('toggled');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(150);
    return on && !fpBtn.classList.contains('toggled');
  });
  await t('[4] Select All selects the whole document via the menu', async () => {
    setDocs(['selall first para', 'selall second para']);
    const node = document.querySelector('[data-cmd="select"]') || document.body;
    window.WC.Commands.dropdown({ cmd: 'select', type: 'dropdown' }, node);
    const item = Array.from(document.querySelectorAll('.flyout .fly-item')).find((n) => n.textContent.trim().startsWith('Select All'));
    if (!item) { window.WC.closeFlyouts(); return 'Select All item not found'; }
    item.click(); await sleep(50);
    const sel = window.WC.editor.state.selection;
    return sel.from <= 1 && sel.to >= doc().content.size - 1;
  });
  await t('[4] Similar Formatting selects the matching span (legacy-parity range)', async () => {
    setDocs(['simfmt boldone here', 'plain middle para', 'simfmt boldtwo here']);
    selectText('boldone'); run('bold'); await sleep(50);
    selectText('boldtwo'); run('bold'); await sleep(50);
    // DELIBERATE boundary selection: at the bold run's start, $from.marks() returns
    // the PRECEDING run's marks — this input exposes a naive implementation.
    const c = selectText('boldone');
    window.WC.editor.commands.setTextSelection({ from: c.from, to: c.from + 2 });
    await PM().selectSimilarFormatting(); await sleep(50);
    const sel = window.WC.editor.state.selection;
    // Tight assert (critique): includes() can't tell a near-whole-doc selection from
    // the right one; the correct span starts at boldone and ends at boldtwo.
    const text = doc().textBetween(sel.from, sel.to, ' ');
    return text.startsWith('boldone') && text.endsWith('boldtwo');
  });
  await t('[4] D6 flip: paste dropdown + select dropdown open in PM mode', async () => {
    // inverse of the pre-flip block — proves the registry flip reached dispatch.
    // The paste flyout fills AFTER the flavors prefetch — assert real items, not
    // just the (synchronously-created, possibly empty) flyout shell.
    const node = document.body;
    window.WC.Commands.dropdown({ cmd: 'paste', type: 'split' }, node);
    await (async () => { for (let i = 0; i < 20 && !document.querySelector('.flyout .fly-item'); i++) await sleep(50); })();
    const pasteOpen = document.querySelectorAll('.flyout .fly-item').length > 0;
    window.WC.closeFlyouts();
    window.WC.Commands.dropdown({ cmd: 'select', type: 'dropdown' }, node);
    const selOpen = document.querySelectorAll('.flyout .fly-item').length > 0;
    window.WC.closeFlyouts();
    return pasteOpen && selOpen;
  });
```

- [ ] **Step 1.4: Run** `npm run build && npm run test:pm` → all 96 pre-existing tests
PASS; the `[4]` block is RED (entry points blocked by D6, bridge surfaces missing,
`wordAPI.clipboard` undefined — throws count as red, `t()` catches them). **Record any
unexpectedly-green pins in the commit message.** **ALSO record the keyboard-clipboard
verify:** launch `npm start`, manually type, select, Cmd+C and Cmd+V in the PM view;
note in the commit body whether Blink's native path works without menu roles (expected
yes for copy/cut; paste may need the menu — if it does NOT work, Task 8.3 installs
`buildHiddenMenu()` and records the decision).
Commit (`test: slice-4 clipboard PM tests (red) + D6 run-block repoint cut→replace`).

### Task 2: oracle — clipboard-semantics probes (decision gates for Tasks 3/6/8)

**Files:** Modify: `scripts/oracle/word-oracle.js`, `scripts/oracle/README.md`;
evidence into `docs/superpowers/plans/notes/2026-06-07-slice4-word-clipboard.json`

Pure tooling + validation (no gate impact). **Read `scripts/oracle/README.md` in full
first** — PID safety + quirks #1-27 are binding; #24-26 (session health: Word must be
launched WINDOWED by the user; recovery = make new document; fresh-path opens can
complete minutes late) gate everything below. Clipboard probes are NEW dictionary
territory — budget the empirical-iteration loop like `read-para-props`/`read-style-props`.

- [ ] **Step 2.0: Ask the USER to relaunch Word windowed** (quirk #24). Do not proceed
headlessly without confirmation.

- [ ] **Step 2.1: Clipboard-formats probe (scripted).** In live Word: type a styled
line (bold word + colored word + Heading 1 paragraph), select-all, Cmd+C (drive via
`tell application "System Events"` keystroke or ask the user), then read the macOS
clipboard inventory from the oracle side:

```bash
osascript -e 'clipboard info' | tr ',' '\n' | head -30
```

Record which flavors Word publishes (expect `public.html`, `public.rtf`,
`public.utf8-plain-text`, possibly `com.microsoft.ole.clipboard`…) and SAVE the raw
`clipboard info` output into the notes JSON. Then capture the actual HTML payload:

```bash
osascript -e 'the clipboard as «class HTML»' > /tmp/word-clip-html.hex || true
# if the coercion errors, record the raw error string and try: the clipboard as record
```

This payload is the **leg-B fidelity input** for Step 10.2 (paste Word-HTML into the
clone) — keep the file.

- [ ] **Step 2.2: Paste menus inventory (user-observed).** Two surfaces, three
clipboard states each — (a) Word-internal rich copy, (b) plain-text copy from another
app (`pbcopy <<< 'plain'`), (c) an image copy:
  - **Edit → Paste Special dialog:** record the exact flavor labels per state.
  - **The RIBBON Paste split-arrow in Mac Word 16.77.1** (critique: the plan's 6-item
    menu is the *Windows* composition — never assumed, always probed): record the
    exact item list per state and which items appear/disappear vs grey out.
  These lists drive `pasteMenu` + `D.pasteSpecial` (Task 6) — our menus must offer
  the same *classes* (document HTML / unformatted text / picture); a deliberate
  Windows-menu choice is recorded as a deviation, not silently shipped.

- [ ] **Step 2.3: Format-painter scope matrix (user-observed, drives Task 3):** in a
scratch Word doc (never saved), probe and record verdicts:
  1. Bold+red a word; select just that word (no ¶ mark); painter to a plain word →
     does the target get char formatting only?
  2. Select a whole paragraph INCLUDING the ¶ (triple-click); paragraph is centered +
     spaced + Heading 1; painter onto another paragraph → which of {alignment,
     spacing, style, char formatting} transfer?
  3. Caret only (no selection) inside a formatted paragraph; click painter → what
     arms? Record BOTH axes: does the target receive char-at-caret formatting AND
     paragraph formatting? (Gates the Task-6.1 caret-arming default.)
  4. Double-click the painter button → sticky across 2+ applies? Esc disarms? Does
     single-click after dblclick also disarm?
  5. Cmd+Shift+C on a selection, then Cmd+Shift+V on another → same as painter?
     (gates the Task-8 chords)
  6. Painter onto a selection that already has OTHER formatting → replaced or merged?
     (Word replaces char formatting — confirm; gates the clear-then-apply design.)
  7. **List membership (critique — gates the captureParaProps default):** bullet a
     paragraph; painter from it (caret-only AND triple-click variants) onto a plain
     paragraph → does the target join the list? Does numbering continue or restart?
  8. **Hyperlink survival (critique — gates the clear-marks design):** painter plain
     bold formatting ONTO a hyperlink → does the link survive (Word: yes)? And painter
     FROM linked text onto plain text → does the target become a link (Word: no)?
  9. If a mixed-formatting selection is the SOURCE (half bold), what arms — first
     character's formatting, or intersection? (Gates a possible Task-3 capture switch
     from `getMarksFromSelection` to a position-based read.)

- [ ] **Step 2.4: Document.** Append discoveries as quirks #28+ in the
`word-oracle.js` header AND README rows; verdicts JSON committed under
`docs/superpowers/plans/notes/`. Word left clean (doc count at baseline, never quit).
Commit (`test(test): slice-4 Word clipboard/painter semantics probes + verdicts`).

# Stage B — fork engine work (NOTICE-documented)

### Task 3: extend FormatCommands to Word painter scope

**Files:** Modify:
`src/renderer/core/superdoc-fork/extensions/format-commands/format-commands.js`,
`src/renderer/core/superdoc-fork/NOTICE.md`

Current fork painter (format-commands.js): stores ONLY marks
(`getMarksFromSelection` — note it INTERSECTS across a range; mixed selection → `[]`),
applies through a hardcoded 6-entry `marksToCommands` table, copies NO paragraph
properties, has no cancel command, and its UI-guard selector list
(`FORMAT_PAINTER_UI_SELECTOR`) knows only SuperDoc's own toolbar classes — **our
ribbon/flyout/dialog chrome is NOT in the list, so any chrome click while armed would
fire `applyIfTargetSelected` on a live selection** (latent bug, fix here). Adjust the
paragraph-property subset and the mixed-source capture to the Task-2.3 verdicts
(probes 7/9) before implementing.

- [ ] **Step 3.1: Word-scope storage + options-aware arming.** Extend storage:

```js
  addStorage() {
    return {
      storedStyle: null,        // StoredStyle[] — marks (link excluded, Step 3.2)
      storedParaProps: null,    // paragraphProperties (Word scope, slice 4)
      sourceSelection: null,
      persistent: false,
      lastCopyFormatClickAt: 0,
      releaseCleanup: null,
      pointerSelecting: false,
      keyboardSelecting: false,
    };
  },
```

Replace `copyFormat` with the options-aware version. **Double-click trap (critique
blocker):** a ribbon dblclick fires `click, click, dblclick` → `copyFormat()` ×2 then
`copyFormat({persistent:true})`; the old body's persistent-clear branch would end
DISARMED with a stale "locked" toast. Fix: explicit-persistent calls are IDEMPOTENT
re-arms, and the 500ms double-click heuristic only runs for no-arg callers:

```js
      copyFormat:
        (options = {}) =>
        ({ chain }) => {
          const currentSelection = getSelectionRange(this.editor.state);

          if (!this.storage.storedStyle && !this.storage.storedParaProps) {
            const marks = getMarksFromSelection(this.editor.state, this.editor)
              .filter((m) => m.type.name !== 'link'); // Word: painter never sprays hyperlinks
            this.storage.storedStyle = marks;
            // Word scope (slice 4): the painter also carries paragraph formatting.
            this.storage.storedParaProps = captureParaProps(this.editor.state);
            this.storage.sourceSelection = currentSelection;
            this.storage.persistent = !!options.persistent;
            this.storage.lastCopyFormatClickAt = Date.now();
            armFormatPainterRelease({ storage: this.storage, editor: this.editor });
            return true;
          }

          // Explicit intent (app entry points): idempotent sticky promotion — the
          // ribbon dblclick arrives as click,click,dblclick and must end ARMED-STICKY.
          if (options.persistent) {
            this.storage.persistent = true;
            this.storage.lastCopyFormatClickAt = 0;
            return true;
          }

          if (this.storage.persistent) {
            clearFormatPainterStorage(this.storage);
            return true;
          }

          const clickedSourceAgain = isSameSelection(currentSelection, this.storage.sourceSelection);
          // The 500ms promotion heuristic stays alive ONLY for no-arg callers
          // (devtools/upstream parity) — explicit callers are deterministic.
          const isDoubleClick = !('persistent' in options) &&
            clickedSourceAgain && Date.now() - this.storage.lastCopyFormatClickAt <= FORMAT_PAINTER_DOUBLE_CLICK_MS;

          if (isDoubleClick && !this.storage.persistent) {
            this.storage.persistent = true;
            this.storage.lastCopyFormatClickAt = 0;
            return true;
          }

          if (clickedSourceAgain) {
            clearFormatPainterStorage(this.storage);
            return true;
          }

          return applyStoredFormat({ chain, storage: this.storage });
        },
```

and the para-capture helper near `getSelectionRange` — **numbering is CARRIED by
default** (critique: Word's painter does move list membership; Task-2.3 probe 7
refutes-or-confirms — strip only on a recorded refutation):

```js
/** Head-paragraph paragraphProperties the Word painter carries (slice 4 — scope per
 *  the oracle Task-2.3 matrix; numbering INCLUDED by default, probe 7 gates it). */
function captureParaProps(state) {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const n = $from.node(d);
    if (n.type.name === 'paragraph') {
      const pp = n.attrs?.paragraphProperties || {};
      return Object.keys(pp).length ? JSON.parse(JSON.stringify(pp)) : null;
    }
  }
  return null;
}
```

- [ ] **Step 3.2: Generic apply.** Rework `applyStoredFormat` — clear the target's
char marks **except `link`** (critique: `unsetAllMarks` would delete hyperlinks Word
preserves; oracle probe 8 confirms), re-apply every stored mark generically, then
write the stored paragraph properties:

```js
function applyStoredFormat({ chain, storage }) {
  if (!storage.storedStyle && !storage.storedParaProps) return false;
  const shouldStayActive = storage.persistent;
  try {
    let result = chain();
    // Replace-not-merge (Word; oracle 2.3 probe 6) — but the link mark SURVIVES
    // (probe 8): clear every schema mark except link, individually.
    result = result.command(({ state, tr, dispatch }) => {
      const { from, to } = state.selection;
      Object.values(state.schema.marks).forEach((markType) => {
        if (markType.name === 'link') return;
        tr.removeMark(from, to, markType);
      });
      if (dispatch) dispatch(tr);
      return true;
    });
    (storage.storedStyle || []).forEach((mark) => {
      result = result.setMark(mark.type.name, { ...mark.attrs });
    });
    if (storage.storedParaProps) {
      result = result.updateAttributes('paragraph', {
        paragraphProperties: JSON.parse(JSON.stringify(storage.storedParaProps)),
      });
    }
    return result.run();
  } finally {
    if (!shouldStayActive) clearFormatPainterStorage(storage);
  }
}
```

NOTE for the implementer: VERIFY the fork chain supports `.command(fn)` (grep
`core/CommandService`); if not, run the mark-clear as a plain `editor.command`-style
dispatch before the chain, keeping apply+para in ONE chain so undo stays a single
step — and confirm one-undo via the `[4]` one-undo test pattern in a devtools probe.
Also VERIFY `setMark`/`updateAttributes` exact names in `core/commands/`.

- [ ] **Step 3.3: `cancelFormatPainter` command + chrome guard.** Add to
`addCommands()`:

```js
      /**
       * Cancel an armed format painter without applying (Esc path, slice 4).
       * @category Command
       */
      cancelFormatPainter:
        () =>
        () => {
          if (!this.storage.storedStyle && !this.storage.storedParaProps) return false;
          clearFormatPainterStorage(this.storage);
          return true;
        },
```

and extend the UI-guard selector so the app's chrome never triggers an apply:

```js
const FORMAT_PAINTER_UI_SELECTOR =
  '[data-editor-ui-surface], .toolbar-dropdown-menu, .sd-toolbar-dropdown-menu, .sd-tooltip-content, ' +
  '#ribbon, #tabstrip, .flyout, .qat, #statusbar, .modal-backdrop, #titlebar';
```

(Verify the app's actual container ids/classes against index.html before committing —
the ribbon root id and titlebar id must match the DOM.)

Also extend `clearFormatPainterStorage` to null `storedParaProps`.

- [ ] **Step 3.4: Quick probe.** `npm run build`, `npm start`, devtools:
`WC.editor.commands.copyFormat()` on a bold selection →
`WC.editor.extensionStorage.formatCommands.storedStyle` non-null; select other text →
auto-applies (bold lands, link untouched if target was linked); double-fire
`copyFormat(); copyFormat({persistent:true})` → still armed + persistent;
`WC.editor.commands.cancelFormatPainter()` → storage cleared.

- [ ] **Step 3.5: NOTICE.** Append:

```markdown
- **Format painter extended to Word scope:** `FormatCommands` stores paragraph
  properties (incl. numbering) alongside marks, applies generically
  (replace-not-merge, link mark preserved, matching Word), gains
  `cancelFormatPainter` (Esc path) and an idempotent `persistent` option on
  `copyFormat` (the 500ms double-click heuristic now only serves no-arg callers);
  the UI-guard selector covers the app's ribbon/flyout/dialog chrome so chrome
  clicks never consume the armed painter (slice 4, 2026-06-07).
```

- [ ] **Step 3.6: Gates** (all five). The `[4]` painter tests stay red (entry points
still blocked). Commit
(`feat(editor): format painter to Word scope — para props, generic apply, cancel command`).

# Stage C — IPC + bridge + entry-point rewrites (dispatch still blocks until Task 8)

> Pattern (commands.js:11): `const pm = PMA(); pm ? <PM path> : <legacy>`. PMA()
> ignores FLIPPED — branches are reachable via direct `WC.PM` calls immediately, but
> ribbon dispatch stays courtesy-blocked until Task 8. Legacy branches byte-identical
> — and since the frozen 257 suite does NOT exercise pasteMenu/selectMenu (verified),
> Task 6.5 adds a manual `--legacy` dropdown check + a line-by-line `git diff` review
> of every legacy arm.

### Task 4: clipboard IPC channels

**Files:** Modify: `src/main/preload.js`, `src/main/main.js`

- [ ] **Step 4.1: preload.** Inside the `wordAPI` object add:

```js
  // Slice 4: clipboard surface. Reads/writes go through the Electron clipboard
  // module (main process); cut/copy/paste TRIGGERS go through webContents so the
  // event flows through prosemirror-view's serializer/parser like a native gesture.
  clipboard: {
    flavors: () => ipcRenderer.invoke('clipboard:flavors'),
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    readHTML: () => ipcRenderer.invoke('clipboard:readHTML'),
    readImage: () => ipcRenderer.invoke('clipboard:readImage'),
    writeText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
    writeHTML: (html) => ipcRenderer.invoke('clipboard:writeHTML', html),
    writeImage: (dataUrl) => ipcRenderer.invoke('clipboard:writeImage', dataUrl),
    cut: () => ipcRenderer.invoke('clipboard:cut'),
    copy: () => ipcRenderer.invoke('clipboard:copy'),
    paste: () => ipcRenderer.invoke('clipboard:paste'),
  },
```

- [ ] **Step 4.2: main.** Add `clipboard, nativeImage` to the existing electron
require, then after the `insert:screenshot` handler:

```js
// ---- Slice 4: clipboard (reads/writes via the clipboard module; cut/copy/paste
// triggers via webContents edit methods → native DOM events in the renderer).
// NOTE: webContents.paste() is FIRE-AND-FORGET — the renderer paste lands async;
// callers poll the document, never assume completion on invoke-resolve. ----
ipcMain.handle('clipboard:flavors', () => {
  const formats = clipboard.availableFormats();
  return {
    formats,
    hasText: formats.includes('text/plain'),
    hasHtml: formats.includes('text/html'),
    hasImage: formats.some((f) => f.startsWith('image/')) || !clipboard.readImage().isEmpty(),
  };
});
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:readHTML', () => clipboard.readHTML());
ipcMain.handle('clipboard:readImage', () => {
  const img = clipboard.readImage();
  if (img.isEmpty()) return null;
  const { width, height } = img.getSize();
  return { dataUrl: img.toDataURL(), width, height };
});
ipcMain.handle('clipboard:writeText', (_evt, text) => clipboard.writeText(String(text ?? '')));
ipcMain.handle('clipboard:writeHTML', (_evt, html) => clipboard.write({ html: String(html ?? ''), text: String(html ?? '').replace(/<[^>]+>/g, '') }));
ipcMain.handle('clipboard:writeImage', (_evt, dataUrl) => clipboard.writeImage(nativeImage.createFromDataURL(String(dataUrl ?? ''))));
ipcMain.handle('clipboard:cut', () => mainWindow && mainWindow.webContents.cut());
ipcMain.handle('clipboard:copy', () => mainWindow && mainWindow.webContents.copy());
ipcMain.handle('clipboard:paste', () => mainWindow && mainWindow.webContents.paste());
```

- [ ] **Step 4.3: Probe + gates.** `npm run build`, `npm start`, devtools:
`await wordAPI.clipboard.writeText('ipc probe'); await wordAPI.clipboard.readText()`
→ `'ipc probe'`; select text in the PM page, `await wordAPI.clipboard.copy()`, then
`await wordAPI.clipboard.readText()` → the selection. All five gates (the `[4]`
copy/cut tests stay red via the D6 dispatch block). Commit
(`feat(io): clipboard IPC — module reads/writes + webContents edit triggers`).

### Task 5: bridge — clipboard surface + select + painter

**Files:** Create: `src/renderer/bridge/clipboard.ts`;
Modify: `src/renderer/bridge/commands.ts`, `src/renderer/bridge/index.ts`

- [ ] **Step 5.1: `clipboard.ts`** (new file):

```ts
// Slice 4: flavored clipboard surface. Default cut/copy/paste TRIGGER the native
// webContents path (prosemirror-view serializer/parser do the document work);
// flavored pastes read the Electron clipboard and enter through view.pasteText /
// view.pasteHTML / setImage so every insertion is a normal PM transaction.
type AnyEditor = any

export function installClipboard(editor: AnyEditor) {
  const api = () => (window as any).wordAPI?.clipboard

  const focusView = () => { try { editor.view.focus() } catch { /* view gone */ } }

  async function cutSelection(): Promise<boolean> {
    focusView(); await api()?.cut(); return true
  }
  async function copySelection(): Promise<boolean> {
    focusView(); await api()?.copy(); return true
  }
  async function pasteDefault(): Promise<boolean> {
    focusView(); await api()?.paste(); return true // fire-and-forget — content lands async
  }
  async function pasteTextOnly(): Promise<boolean> {
    const text = await api()?.readText()
    if (!text) return false
    focusView()
    editor.view.pasteText(text) // prosemirror-view public API — normal paste pipeline
    return true
  }
  async function pasteHTML(): Promise<boolean> {
    const html = await api()?.readHTML()
    if (!html) return false
    focusView()
    editor.view.pasteHTML(html)
    return true
  }
  async function pastePicture(): Promise<boolean> {
    const img = await api()?.readImage()
    if (!img?.dataUrl) return false
    focusView()
    return editor.commands.setImage({ src: img.dataUrl, size: { width: img.width } })
  }
  async function clipboardFlavors(): Promise<{ hasText: boolean; hasHtml: boolean; hasImage: boolean; formats: string[] } | null> {
    return (await api()?.flavors()) ?? null
  }

  return { cutSelection, copySelection, pasteDefault, pasteTextOnly, pasteHTML, pastePicture, clipboardFlavors }
}
```

(VERIFY before coding: `view.pasteText`/`view.pasteHTML` exist on the pinned
prosemirror-view — `grep -n "pasteText\|pasteHTML" node_modules/prosemirror-view/dist/index.d.ts`.
If absent, fall back to dispatching a synthetic `paste` ClipboardEvent with a
`DataTransfer` carrying the payload at `view.dom` — same pipeline, more code.)

- [ ] **Step 5.2: commands.ts — select + painter additions.** After
`applyStyleByName`:

```ts
  // slice 4: editing-misc
  function selectAll(): boolean { return cmd('selectAll') }

  // Legacy-parity similar-formatting: ONE TextSelection spanning the first→last
  // text run whose mark signature matches the reference run's. Recorded deviation:
  // real Word multi-selects discontiguous ranges; PM TextSelection is single-range.
  function selectSimilarFormatting(): boolean {
    const { state } = editor
    const { $from, from, to, empty } = state.selection
    const sig = (marks: readonly any[]) =>
      JSON.stringify(marks.map((m: any) => [m.type.name, m.attrs]).sort())
    // Reference marks (critique blocker): at a run's START boundary, $from.marks()
    // returns the PRECEDING run's marks. For a non-empty selection take the FIRST
    // text run the selection actually covers; the empty-caret case stays
    // storedMarks ?? $from.marks() (mark inclusivity does the right thing there).
    let refMarks: readonly any[] | null = null
    if (!empty) {
      state.doc.nodesBetween(from, to, (node: any) => {
        if (refMarks === null && node.isText) refMarks = node.marks
        return refMarks === null
      })
    }
    if (refMarks === null) refMarks = state.storedMarks ?? $from.marks()
    const ref = sig(refMarks!)
    let first = -1, last = -1
    state.doc.descendants((node: any, pos: number) => {
      if (!node.isText) return
      if (sig(node.marks) === ref) {
        if (first < 0) first = pos
        last = pos + node.nodeSize
      }
    })
    if (first < 0) return false
    return cmd('setTextSelection', { from: first, to: last })
  }

  // slice 4: format painter (fork FormatCommands storage is the state of record)
  const painterStorage = () => (editor as any).extensionStorage?.formatCommands
  function armFormatPainter(sticky: boolean): boolean {
    return cmd('copyFormat', { persistent: sticky })
  }
  function cancelFormatPainter(): boolean { return cmd('cancelFormatPainter') }
  function painterArmed(): boolean {
    const s = painterStorage()
    return !!(s && (s.storedStyle || s.storedParaProps))
  }
```

Extend the return object:

```ts
  return { cmd, chain, captureSelection, withSelection, changeCase, sortParagraphs,
    getResolvedParaProps, styleIdForName, applyStyleByName,
    selectAll, selectSimilarFormatting, armFormatPainter, cancelFormatPainter, painterArmed }
```

(VERIFY `cmd('setTextSelection', {from,to})` arg shape — the `[3]` tests call
`editor.commands.setTextSelection({from,to})` directly; if `cmd()` spreads args
differently, call the editor command directly.)

- [ ] **Step 5.3: index.ts wiring.** Import + spread `installClipboard(editor)` into
the `WC.PM` surface next to the `installCommands` spread. Add the painter Esc
listener (capture-phase, style-preview install/teardown precedent — listeners must
die with the editor instance on `replaceEditor`), **surface-layered** (critique: Esc
must close a topmost flyout/dialog first, like Word):

```ts
  // slice 4: Esc cancels an armed format painter (Word). Capture-phase so the PM
  // keymap can't swallow it; defers to any open flyout/dialog (app.js Esc handling
  // closes those — the painter survives until a bare-Esc press).
  const painterEsc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (document.querySelector('.flyout, .modal-backdrop')) return
    if (w.WC?.PM?.painterArmed?.()) w.WC.PM.cancelFormatPainter()
  }
  document.addEventListener('keydown', painterEsc, true)
```

**Pre-mount stubs (preinstallBridge) — the exact set** (critique: enumerated, typed):

```ts
    cutSelection: async () => false,
    copySelection: async () => false,
    pasteDefault: async () => false,
    pasteTextOnly: async () => false,
    pasteHTML: async () => false,
    pastePicture: async () => false,
    clipboardFlavors: async () => null,
    selectAll: () => false,
    selectSimilarFormatting: () => false,
    armFormatPainter: () => false,
    cancelFormatPainter: () => false,
    painterArmed: () => false,
```

- [ ] **Step 5.4: Probe + gates.** `npm run build`, devtools:
`WC.PM.selectAll()` → whole doc selected; arm painter on a bold selection via
`WC.PM.armFormatPainter(false)` → `WC.PM.painterArmed()` → true; Esc → false.
The `[4]` Keep-Text-Only/Picture/Similar-Formatting tests (direct bridge calls) go
green; ribbon-path tests stay red. All five gates. Commit
(`feat(ribbon): bridge clipboard surface, select, format-painter arm/cancel`).

### Task 6: entry-point rewrites — handlers, paste menu, Paste Special, select menu

**Files:** Modify: `src/renderer/public/js/commands.js`,
`src/renderer/public/js/dialogs.js`, `src/renderer/public/js/util.js`

- [ ] **Step 6.0: `WC.flyItem` disabled support** (util.js — additive; legacy callers
never pass it). In `flyItem`, after the options destructure, honor
`opts.disabled`: add the `disabled` class, skip wiring `onClick`, set
`aria-disabled="true"`; one CSS rule (`.fly-item.disabled { opacity:.45; cursor:default; }`)
in the stylesheet that styles `.fly-item` today (find it by grepping the class).

- [ ] **Step 6.1: clipboard handlers** (commands.js:34-38) — PM branches; **legacy
arms byte-identical including formatPainterLock's node expression** (critique: keep
the original expression inside the legacy arm, don't hoist it):

```js
  // ---- Clipboard ----
  H.cut = () => { const pm = PMA(); pm ? pm.cutSelection() : E().exec('cut'); };
  H.copy = () => { const pm = PMA(); pm ? pm.copySelection() : E().exec('copy'); };
  H.paste = () => { const pm = PMA(); pm ? pm.pasteDefault() : E().exec('paste'); };
  H.formatPainter = (c, node) => {
    const pm = PMA();
    if (pm) { armPainterPM(node, false); return; }
    armPainterFromSelection(node, false);
  };
  H.formatPainterLock = (c, node) => {
    const pm = PMA();
    if (pm) { armPainterPM(node || (WC.Ribbon.controlIndex.formatPainter && WC.Ribbon.controlIndex.formatPainter.node), true); return; }
    armPainterFromSelection(node || (WC.Ribbon.controlIndex.formatPainter && WC.Ribbon.controlIndex.formatPainter.node), true);
  };
```

and the PM arm helper near `armPainterFromSelection` — **caret-arming is the DEFAULT**
(critique: Word arms from a bare caret, carrying char-at-caret + paragraph formatting;
the Task-2.3 probe-3 verdict can only ADD a refusal, not the reverse):

```js
  // PM painter: the fork's FormatCommands owns capture/apply/release; this wrapper
  // adds Word's UX toasts. Esc lives in the bridge (capture listener); button
  // toggle + cursor live in state-sync. Word arms from a CARET too (paragraph +
  // caret-char formatting — oracle 2.3 probe 3); no empty-selection refusal.
  function armPainterPM(node, sticky) {
    const pm = PMA();
    if (!pm.armFormatPainter(sticky)) { WC.toast('Format Painter could not copy the formatting here.'); return; }
    WC.toast(sticky ? 'Format Painter locked — apply to multiple selections. Press Esc to stop.'
                    : 'Format Painter — select text to apply the copied formatting once.');
  }
```

(If the probe-3 verdict REFUTES caret-arming, add the refusal toast back and update
this comment to cite the recorded verdict.)

- [ ] **Step 6.2: `pasteMenu` PM branch** (commands.js:1372) — legacy body unchanged.
**Prefetch-then-flyout is the ONLY arm** (critique: `WC.flyout` calls the builder
synchronously and measures `fly.offsetWidth` immediately — an async builder yields an
empty, mispositioned flyout; the verify-seam is settled, do not ship the async form).
All six items render always (Windows-menu composition — Task-2.2's Mac-ribbon probe
verdict may swap this to show/hide; record either way); inapplicable flavors use the
new `disabled` option:

```js
  function pasteMenu(node) {
    const pm = PMA();
    if (pm) {
      pm.clipboardFlavors().then((fl) => {
        fl = fl || { hasText: false, hasHtml: false, hasImage: false };
        WC.flyout(node, (fly) => {
          const item = (label, enabled, onClick) =>
            fly.appendChild(WC.flyItem(label, enabled ? { onClick } : { disabled: true }));
          item('Keep Source Formatting', fl.hasHtml || fl.hasText, () => pm.pasteDefault());
          item('Merge Formatting', false, () => {}); // recorded deferral — destination-formatting rules engine
          item('Picture', fl.hasImage, () => pm.pastePicture());
          item('Keep Text Only', fl.hasText, () => pm.pasteTextOnly());
          fly.appendChild(WC.flySep());
          fly.appendChild(WC.flyItem('Paste Special…', { onClick: () => WC.Dialogs.pasteSpecial() }));
          fly.appendChild(WC.flyItem('Set Default Paste…', { onClick: () => WC.toast('Set Default Paste is not implemented (recorded deferral).') }));
        });
      });
      return;
    }
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Keep Source Formatting', { onClick: () => E().exec('paste') }));
      fly.appendChild(WC.flyItem('Merge Formatting', { onClick: () => E().exec('paste') }));
      fly.appendChild(WC.flyItem('Keep Text Only', { onClick: async () => { try { const t = await navigator.clipboard.readText(); E().exec('insertText', t); } catch (e) { WC.toast('Clipboard read blocked.'); } } }));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Paste Special…', { onClick: () => WC.notImplemented('Paste Special') }));
    });
  }
```

- [ ] **Step 6.3: `D.pasteSpecial()`** (dialogs.js — new, PM-only; the dropdown only
offers it in PM mode). Word's dialog: a listbox of the clipboard's flavors +
OK/Cancel, **double-click = OK** (critique: core Word muscle memory). Follow the
`sortDialog` capture/withSelection pattern (the dialog steals focus). The function is
async; callers may await it — `WC.dialog` mounts synchronously once flavors resolve:

```js
  D.pasteSpecial = async function () {
    const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null;
    if (!pm) { WC.notImplemented('Paste Special'); return; }
    pm.captureSelection();
    const fl = (await pm.clipboardFlavors()) || { hasText: false, hasHtml: false, hasImage: false };
    const options = [];
    if (fl.hasHtml) options.push(['HTML Format', () => pm.pasteHTML()]);
    if (fl.hasText) options.push(['Unformatted Text', () => pm.pasteTextOnly()]);
    if (fl.hasImage) options.push(['Picture', () => pm.pastePicture()]);
    let chosen = 0;
    const doPaste = () => { if (options[chosen]) pm.withSelection(() => options[chosen][1]()); };
    const list = el('ul', { class: 'ps-list' }, options.map(([label], i) =>
      el('li', { class: 'ps-item' + (i === 0 ? ' selected' : ''), text: label, tabindex: '0' })));
    list.addEventListener('click', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      chosen = Array.from(list.children).indexOf(li);
      list.querySelectorAll('li').forEach((n, i) => n.classList.toggle('selected', i === chosen));
    });
    list.addEventListener('dblclick', (e) => {
      if (!e.target.closest('li')) return;
      doPaste();
      const bd = document.querySelector('.modal-backdrop'); if (bd) bd.remove(); // Word: dblclick = OK
    });
    const body = el('div', {}, [
      el('div', { class: 'row', text: 'As:' }),
      options.length ? list : el('div', { text: 'The Clipboard is empty.' }),
    ]);
    WC.dialog({ title: 'Paste Special', width: '420px', body, footer: [
      { label: 'OK', primary: true, onClick: doPaste },
      { label: 'Cancel' },
    ] });
  };
```

(Match dialogs.js's existing `el`/`WC.dialog` idioms exactly — read a neighbor dialog
first; if `WC.dialog` exposes a close handle, use it instead of removing the backdrop
directly. `.ps-item.selected` styling: follow the existing dialog list idiom; if none,
inline style on toggle. Recorded deviations: no Paste-link radio, no per-flavor
result descriptions.)

- [ ] **Step 6.4: `selectMenu` PM branch + `D.clipboardPane` gate** (commands.js:1306,
dialogs.js). selectMenu legacy body unchanged:

```js
  function selectMenu(node) {
    const pm = PMA();
    if (pm) {
      WC.flyout(node, (fly) => {
        fly.appendChild(WC.flyItem('Select All', { key: 'Ctrl+A', onClick: () => pm.selectAll() }));
        fly.appendChild(WC.flyItem('Select Objects', { onClick: () => WC.toast('Select Objects arrives with the Draw engine re-host (slice 10).') }));
        fly.appendChild(WC.flyItem('Select All Text With Similar Formatting', { onClick: () => { if (!pm.selectSimilarFormatting()) WC.toast('Place the cursor in text first.'); } }));
        fly.appendChild(WC.flySep());
        fly.appendChild(WC.flyItem('Selection Pane…', { onClick: () => WC.toast('Selection Pane lists drawing objects — arrives with the Draw engine re-host (slice 10).') }));
      });
      return;
    }
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyItem('Select All', { key: 'Ctrl+A', onClick: () => E().exec('selectAll') }));
      fly.appendChild(WC.flyItem('Select Objects', { onClick: () => { if (WC.Draw) { WC.Draw.setEnabled(true); WC.Draw.setTool('select'); } WC.toast('Click objects to select them.'); } }));
      fly.appendChild(WC.flyItem('Select All Text With Similar Formatting', { onClick: () => selectSimilarFormatting() }));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Selection Pane…', { onClick: () => WC.Layout.selectionPane() }));
    });
  }
```

**`D.clipboardPane` PM gate** (critique: the clipboard launcher is deliberately
ungated — commands.js:1024 — but the pane's capture/paste pipeline is legacy-DOM-only,
so in PM mode it is a dead surface with dead buttons). At the top of `D.clipboardPane`
in dialogs.js add:

```js
    if (WC.PM && WC.PM.active) { WC.toast('Office Clipboard history arrives in a later slice.'); return; }
```

(legacy body untouched below the guard; recorded deferral.)

- [ ] **Step 6.5: Probe + gates + legacy manual verify.** `npm run build`; devtools
(direct calls — dispatch still blocked): `WC.Dialogs.pasteSpecial()` lists real
flavors after `pbcopy`-ing text. **Legacy verify (critique: the frozen 257 never
exercises these dropdowns):** `npm start -- --legacy` → open the paste split chevron
(4 items, Paste Special → notImplemented toast) and the Select dropdown (all 4 items
fire), arm/apply/Esc the legacy painter, open the clipboard launcher pane. **Then
review `git diff -- src/renderer/public/js/commands.js` line-by-line confirming every
removed legacy line reappears verbatim in an else/legacy arm.** All five gates.
Commit (`feat(ribbon): clipboard + select entry points on PM — menus, Paste Special dialog`).

### Task 7: state-sync — painter chrome

**Files:** Modify: `src/renderer/bridge/state-sync.ts`

- [ ] **Step 7.1:** In `sync()` after the styles-gallery push (~line 146):

```ts
    // slice 4: format-painter chrome — button latches + copy cursor while armed
    // (fork FormatCommands storage is the state of record; commands dispatch a
    // transaction, so sync() runs on arm/apply/cancel — verify: if cancel paths
    // skip a transaction, nudge sync from the bridge cancel wrapper instead).
    const fpStorage = (editor as any).extensionStorage?.formatCommands
    const fpArmed = !!(fpStorage && (fpStorage.storedStyle || fpStorage.storedParaProps))
    const fpBtn = w.WC?.Ribbon?.controlIndex?.formatPainter?.node
    if (fpBtn) fpBtn.classList.toggle('toggled', fpArmed)
    const pmPage = document.getElementById('pm-editor')
    if (pmPage) pmPage.style.cursor = fpArmed ? 'copy' : ''
```

- [ ] **Step 7.2: Canary + gates.** `npm run build && npm run test:pm` — every
pre-existing `[1]`-`[3]` test stays green (this only ADDS pushes); the `[4]`
button-toggled test's chrome half goes green-able (entry-point half still red). If
arm/cancel do NOT fire `transaction` (the verify note above), nudge sync via a no-op
meta transaction from the bridge arm/cancel wrappers (style-preview / io.ts
PREVIEW_META precedent). All five gates. Commit
(`feat(ribbon): state-sync — format-painter button latch + copy cursor`).

# Stage D — the flip, gates, oracle, wrap-up

### Task 8: FLIP the registry — `clipboard` + `editing-misc` go live (+ chords, same commit)

**Files:** Modify: `src/renderer/bridge/index.ts`, `src/renderer/public/js/app.js`,
`src/main/main.js` (conditional — Step 8.3 only)

- [ ] **Step 8.1: registry edit** (bridge/index.ts:24 + :47):

```ts
const FLIPPED = new Set<string>(['character', 'history', 'paragraph', 'lists', 'styles', 'clipboard', 'editing-misc']) // slices 1-4
```

and the AREA remap — `select` leaves `find-replace` (slice-0a grouping accident;
spec §9.1 row 4 is authoritative — reconciliation recorded in the slice-4 plan +
checkpoint):

```ts
  find: 'find-replace', replace: 'find-replace',
  select: 'editing-misc', // slice 4 — spec row 4; was find-replace (ribbon-group adjacency accident, slice 0a)
```

- [ ] **Step 8.2: app.js chords (SAME COMMIT)** — gated on the Task-2.3 probe-5
verdict; if Word-mac confirms Cmd+Shift+C/V = copy/paste formatting, add to the
keydown `map()` after the heading-chord lines (~app.js:99). **Return `null` under
legacy** (a no-op function would still `preventDefault` and eat the browser default):

```js
        // slice 4: copy/paste formatting chords (Word: Cmd+Shift+C / Cmd+Shift+V).
        // PM-only — legacy returns null so the chord keeps its default there.
        if (shift && k === 'c') { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; return pm ? () => pm.armFormatPainter(false) : null; }
        if (shift && k === 'v') { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; return pm ? () => pm.cmd('applyStoredFormat') : null; }
```

(If probe 5 REFUTES the chords, skip this step and record the verdict — no
speculative keyboard surface.)

- [ ] **Step 8.3: keyboard-paste decision point.** Re-run the Task-1.4 manual verify
(Cmd+C/X/V in the PM view). If paste does NOT reach the view through Blink, install
the hidden menu in main.js — **hoist the `legacyBoot` declaration above the menu
call first** (today it is declared at main.js:118, AFTER `Menu.setApplicationMenu(null)`
at :110), then `if (!legacyBoot) buildHiddenMenu(); else Menu.setApplicationMenu(null);`
— and update the "intentionally not installed" comment to record the deviation. If
paste DOES work, change nothing and record that verdict in the commit body.

- [ ] **Step 8.4: Full PM suite** — `npm run build && npm run test:pm` → **~112/112**
(96 + the `[4]` block). Triage any red the slice-2/3 way (fix forward within the
task). All five gates. Commit
(`feat(ribbon): FLIP clipboard + editing-misc onto the PM engine` with the verdicts
in the body).

### Task 9: full-gate sweep + manual sanity

- [ ] **Step 9.1:** All five gates from the header block, fresh build, exact counts
recorded (PM ~112, legacy 257, smoke 9+9, docx 17).
- [ ] **Step 9.2: Manual sanity** (`npm start`): cut/copy/paste via ribbon between
the clone and TextEdit both directions; paste dropdown flavors enable/disable with
clipboard contents; Paste Special on text/HTML/image clipboards (incl. dblclick-OK);
painter single + dblclick-sticky + Esc (incl. Esc-with-flyout-open leaves the painter
armed); painter over a hyperlink keeps the link; Select All / Similar Formatting;
`--legacy` run: everything above behaves exactly as before (legacy branches
untouched).
- [ ] **Step 9.3:** Screenshot evidence via the `--shot` harness if UI changed
states meaningfully (painter latched button). Commit any fixes
(`fix(ribbon): slice-4 sanity follow-ups` — only if needed).

### Task 10: oracle validation (spec §8.3) — per feature family

**Files:** evidence JSONs under `docs/superpowers/plans/notes/`

- [ ] **Step 10.1: leg A (clone → Word):** in the clone, author styled content
(bold+colored word, centered Heading-1 paragraph), select-all, ribbon Copy; in real
Word, paste. Verify formatting survives (char marks + paragraph props). Then Paste
Special in Word over the same clipboard: record which flavors our serializer
publishes (expect HTML + plain text). Record PASS/FAIL rows per property.
- [ ] **Step 10.2: leg B (Word → clone):** copy the Task-2.1 styled content in Word;
in the clone, ribbon Paste (KSF) → marks/styles arrive through the PM parser; Keep
Text Only → plain; Picture (copy an image in Word) → image node. Record per-property
verdicts; deviations (e.g. Word-only OLE flavors we ignore) recorded, not silently
dropped.
- [ ] **Step 10.3: painter scope replay:** repeat the Task-2.3 matrix (all 9 probes,
incl. list membership + hyperlink survival) INSIDE the clone and diff against the
recorded Word verdicts — every row PASS or a recorded KNOWN DEVIATION.
- [ ] **Step 10.4:** Commit evidence
(`test(test): slice-4 oracle legs A/B + painter scope verdicts`).

### Task 11: checkpoint + PR

- [ ] **Step 11.1:** Invoke the `plan-tracking` skill: append the slice-4 BUILT entry
to `last-point.md` (top), tick the Daily work log, advance the CURRENT PHASE blurb
(slice 5 find-replace next). **Carry-overs to record (critique-completed list):**
  - **BOTH `[0a]` D6 tests now sit on `find-replace` cmds** (`replace` run-block +
    `find` dropdown-block) — slice 5's red-tests task must repoint BOTH to a
    later-slice area (insert-basics, e.g. `link`).
  - The `select` AREA remap reconciliation: spec §9.1 row 4 beat the slice-0a
    registry (`find-replace` was a ribbon-group adjacency accident) — resolved this
    slice, recorded.
  - The two brainstorm prompt-claim corrections (hidden menu NOT installed;
    `editing-misc` was docs-only) + the Step-8.3 keyboard-paste verdict.
  - Recorded deferrals: Merge Formatting, Set Default Paste…, Select Objects /
    Selection Pane… (slice 10), Office Clipboard pane (PM toast gate),
    Similar-Formatting single-range deviation, Paste Special dialog omissions
    (Paste-link radio, per-flavor descriptions).
  - Oracle-verdict-dependent records: painter caret-arming, list-membership carry,
    hyperlink survival, mixed-source capture, Mac paste-menu composition, chords.
- [ ] **Step 11.2:** Push; open the PR (commit-style skill: what/why body, no AI
trailers); PR description lists the gates table + oracle verdicts.

---

## Recorded deferrals (carry into last-point.md)

- **Merge Formatting** — needs Word's destination-formatting rules; menu item present
  but disabled (new flyItem `disabled` option) in PM mode.
- **Set Default Paste…** — Word options surface; toast.
- **Select Objects / Selection Pane…** — Draw-engine features; PM branches toast
  until slice 10 re-hosts the draw overlay.
- **Office Clipboard pane (`D.clipboardPane`)** — capture/paste pipeline is
  legacy-DOM-only; PM mode toasts until a future slice re-hosts clipboard history.
- **Similar Formatting selects ONE span** (first→last match) — PM TextSelection is
  single-range; Word multi-selects. Fork `CustomSelection` investigation optional
  follow-up.
- **Paste Special dialog** — no Paste-link radio / per-flavor descriptions (recorded
  deviation; dblclick-OK shipped).
- **Clipboard tests clobber the user clipboard** during PM-suite runs (deliberate —
  real-pipeline testing).
- **Phase-3 logger note:** webContents-triggered paste arrives as a normal PM
  transaction (no special meta) — nothing to teach the logger, but the
  `clipboard:write*` channels are test-only surface the logger should ignore.

## Self-review + plan-critique (done at authoring)

4-critic adversarial workflow (claims-vs-code, test-design, word-fidelity-ux,
process-gates) over the v1 plan: 32 findings — **8 blockers confirmed** (verified
adversarially, 0 refuted), 12 majors, 12 minors, ALL applied above:
selectText mark-boundary traps (painter tests arm from the homogeneous bold word);
`paragraphProperties.justification` is the alignment key; async flyout/dialog races
(sentinel polls + `await pasteSpecial` + prefetch-then-flyout as the only pasteMenu
arm); the painter double-click trap (idempotent `persistent` + heuristic gated to
no-arg callers); similar-formatting boundary-marks fix (covered-run reference) +
tight span assert; numbering carried by default + probe 7; link mark excluded from
clear AND capture + probe 8; caret-arming default + probe-3 both-axes; Mac
ribbon-paste-menu probe; webContents sentinel polls; Office-Clipboard-pane gate;
legacy manual dropdown verify + git-diff byte-identity review; enumerated pre-mount
stubs; flyItem `disabled` support; Esc surface-layering; chords return `null` under
legacy; legacyBoot hoist note; D6 "inverts" rationale corrected (vacuous-green with
a destructive side effect, not a flip).

- Spec coverage: §9.1 row 4 items all present (cut/copy/paste PM-native ✓ Task 4-6;
  paste-special ✓ Task 6; format painter on fork copyFormat ✓ Task 3/5/6; select ✓
  Task 5/6 + registry Task 8). §9.3 carve-out respected (painter flips, not deferred).
- Known verify-first seams called out inline: `view.pasteText/pasteHTML` existence,
  chain `.command(fn)` support, `setMark`/`updateAttributes` names, `setTextSelection`
  arg shape via `cmd()`, transaction-firing on arm/cancel, find-pane DOM id, chrome
  selector ids, Image node name, `WC.dialog` close handle.
