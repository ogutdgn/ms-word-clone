# Phase 2 — Slice 2 Implementation Plan: paragraph + lists

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the `paragraph` (14 cmd ids) and `lists` (3 cmd ids) ribbon areas onto the
owned ProseMirror engine — align ×4, indent, Layout spinners, line-spacing, shading,
borders, sort, bullets/numbering (+libraries honoring glyphs), Word-native multilevel
lists, the Paragraph dialog — plus the list-marker/hanging-indent rendering fix and a new
`read-para-props` oracle verb.

**Architecture:** Spec `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`
(D1–D7 + §5–§9 are the contract); slice-1 pattern (`docs/superpowers/plans/2026-06-05-phase2-slices-0a-1.md`
Stage D): legacy entry points in `commands.js`/`dialogs.js`/`app.js` get PMA-ternary PM
branches; the `WC.PM` bridge is the only code talking to the vendored Editor; the
**FLIPPED-set edit is the auditable switch and lands LAST** (Task 11) so the dialog-launcher
auto-unblock trap (commands.js:948 probes cmd `alignLeft`) can never expose an un-ported
dialog. Brainstorm decisions (2026-06-06, user-approved): **full shading+borders** (fork
render edit + setters), **Word-native multilevel** (real numbering definitions; the legacy
ml-* CSS fake is not ported), **fork-CSS import** for the hanging-indent fix, and all four
fidelity extras (spinner caret readback, library glyphs honored, Align-Left default
pressed, dynamic spacing menu labels).

**Tech stack:** Electron 31, electron-vite + TS (renderer), vendored SuperDoc fork
(`@core`/`@extensions` aliases), in-renderer probe harness (`--probe-out` + `--shot-evalfile`),
osascript oracle (`scripts/oracle/word-oracle.js`).

**Branching:** everything on `feature/phase-2-slice-2-paragraph`, branched **directly off
`main`** (no stacked PRs — integration note in last-point.md). Verify with
`git branch --show-current` before any edit.

**Units cheat-sheet (model stores twips):** 1 in = 1440 tw = 72 pt = 96 px · 1 pt = 20 tw ·
indent step 36 pt = 720 tw = 0.5 in = 48 px (matches legacy) · line spacing multiplier
`linesToTwips(v) = v × 240` · border size in eighth-points (4 = 0.5 pt, Word's default).

**The five gates** (legacy + smoke ×2 + docx must be green at EVERY commit; the PM suite's
`[2]` block is red from Task 1 and goes fully green at Task 11 — that is the Stage-D
red→green arc, same as slice 1):

```bash
npm run build
npx electron . --legacy --probe-out=/tmp/wc-legacy.json --shot-evalfile=scripts/test-suite.js --shot-delay=800   # 257 pass
npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js                              # PM suite (43 → ~77)
npx electron . --probe-out=/tmp/wc-smoke.json --shot-evalfile=scripts/smoke-pm.js                                # 9 pass
npx electron . --legacy --probe-out=/tmp/wc-smoke-legacy.json --shot-evalfile=scripts/smoke-pm.js                # 9 pass
node scripts/test_docx.js                                                                                        # 17 pass
```

Check results: `node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/wc-pm.json'));console.log(r.summary);r.results.filter(x=>!x.pass).forEach(x=>console.log('FAIL',x.name,x.detail))"`

---

## File structure (what gets created/modified)

| Path | Role |
|---|---|
| `scripts/test-suite-pm.js` (modify) | `paraAttrs`/`paraEl`/`setDocs`/`flyClick` helpers; setDoc paragraph-attr reset; repoint two `[0a]` D6 tests off cmd `bullets`; the `[2]` block |
| `scripts/oracle/word-oracle.js` (modify) | new `read-para-props` verb (paragraph format + list format reads) |
| `scripts/oracle/README.md` (modify) | verb docs + new dictionary-quirk rows (line-spacing-rule/list-type enums, list-format access) |
| `src/renderer/core/superdoc-fork/core/super-converter/styles.js` (modify, fork) | render `paragraphProperties.shading` → `background-color` in `encodeCSSFromPPr` |
| `src/renderer/core/superdoc-fork/extensions/text-align/text-align.js` (modify, fork) | strip the `Mod-Shift-L/E/R/J` SuperDoc keymap (collides with Word's Ctrl+Shift+L = List Bullet) |
| `src/renderer/core/superdoc-fork/core/commands/applyListDefinition.js` (new, fork) | generic per-level list definition command (multilevel patterns + custom bullet glyphs) |
| `src/renderer/core/superdoc-fork/core/commands/index.js` (modify, fork) | export `applyListDefinition` |
| `src/renderer/core/superdoc-fork/NOTICE.md` (modify) | document the three fork edits |
| `src/renderer/main.ts` (modify) | import the fork element stylesheet (hanging-indent/tab-width fix) |
| `src/renderer/public/js/commands.js` (modify) | PM branches: H.align×4/bullets/numbering/stepIndent/sort/shading/borders; lineSpacingMenu, bordersMenu+applyBorder, bulletMenu, multilevelMenu+changeListLevelMenu, sortDialog, applyColor `shade`, colorMenu no-color, Commands.spinner |
| `src/renderer/public/js/app.js` (modify, Task 11 — same commit as the flip) | Ctrl+L/E/R/J + Ctrl+Shift+L keydown entries → live PM commands |
| `src/renderer/public/js/dialogs.js` (modify) | `D.paragraph`: PM seeds from getState + one-chained-transaction OK |
| `src/renderer/bridge/commands.ts` (modify) | `sortParagraphs(opts)` (changeCase precedent) |
| `src/renderer/bridge/state-sync.ts` (modify) | null-justification → justifyLeft; resolved indent/spacing/lineSpacing fields; spinner setComboValue pushes |
| `src/renderer/bridge/index.ts` (modify, **Task 11 only**) | `FLIPPED` += `'paragraph'`, `'lists'` |

Not touched: `scripts/test-suite.js` (frozen), `ribbon-data.js`/`icons-fluent.js` (generated),
`H.showHide` (already live + parity, deliberately not in AREA — do NOT add it).

---

# Stage A — red tests + tooling

### Task 1: failing PM-suite tests for the slice (red)

**Files:** Modify: `scripts/test-suite-pm.js`

- [ ] **Step 1.1: Extend the helpers.** After the existing `markNames` helper (line 48), add:

```js
  // Paragraph node attrs for the paragraph containing `needle`.
  const paraAttrs = (needle) => {
    let attrs = null;
    doc().descendants((node) => {
      if (attrs || node.type.name !== 'paragraph') return;
      if (node.textContent.includes(needle)) attrs = node.attrs;
    });
    if (!attrs) throw new Error('paragraph not found: ' + needle);
    return attrs;
  };
  // First rendered <p> containing `needle` (marker/geometry asserts).
  const paraEl = (needle) =>
    Array.from(document.querySelectorAll('#pm-editor .ProseMirror p')).find((p) => p.textContent.includes(needle)) || null;
  // Multi-paragraph body (insertContentAt parses HTML-looking strings — verified,
  // core/commands/insertContentAt.js looksLikeHTML).
  // NOTE the ARRAY form: resetAttributes is (typeOrName, attrs) — exactly TWO params
  // (core/commands/resetAttributes.js:11-12; deleteProps takes string|array). A third
  // positional arg is SILENTLY DROPPED, and numberingPlugin never clears a stale
  // listRendering once numberingProperties is gone (numberingPlugin.js:236-240).
  const setDocs = (paras) => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent(paras.map((t) => '<p>' + t + '</p>').join(''));
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.unsetAllMarks();
    window.WC.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']);
  };
  // Click a flyout item by its label (fly-item > .fi-label span — util.js:78-86).
  const flyClick = (re) => {
    const it = Array.from(document.querySelectorAll('.flyout .fly-item'))
      .find((n) => re.test((n.querySelector('.fi-label') || n).textContent.trim()));
    if (!it) throw new Error('flyout item not found: ' + re);
    it.click();
  };
```

- [ ] **Step 1.2: setDoc paragraph-attr hygiene.** `[2]` tests set alignment/indent/list
attrs that `setDoc` (marks-only reset) would leak into later tests. Extend `setDoc`
(line 21-26) with one line after `unsetAllMarks()` — **the array form is mandatory**
(see the setDocs note; `unsetLineHeight`'s 3-arg call is an upstream fork BUG whose third
arg is silently dropped, NOT a usage precedent; the fork's own test uses the array form,
resetAttributes.test.js:48):

```js
    window.WC.editor.commands.resetAttributes('paragraph', ['paragraphProperties', 'listRendering']);
```

Run `npm run build && npm run test:pm` → all 43 existing tests still pass. The 43 never
exercise the `listRendering` half of the reset, so ALSO probe it directly once in devtools
(`npm start`): toggle a bullet on a paragraph (`WC.PM.cmd('toggleBulletList')`), run the
reset line, and confirm `WC.editor.getAttributes('paragraph').listRendering == null`
before relying on it across the `[2]` block.

- [ ] **Step 1.3: Repoint the two `[0a]` D6-block tests off cmd `bullets`** (lines
121-130) — they invert the moment `lists` flips (Task 11). They assert the D6 *mechanism*,
not bullets specifically; re-target still-unflipped areas (clipboard slice 4, find-replace
slice 5):

```js
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    window.WC.Commands.run({ cmd: 'cut', label: 'Cut' });
    return document.querySelectorAll('.flyout').length === 0; // no flyout, no throw
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    window.WC.Commands.dropdown({ cmd: 'find', type: 'dropdown' }, document.body);
    const open = document.querySelectorAll('.flyout').length;
    window.WC.closeFlyouts();
    return open === 0;
  });
```

- [ ] **Step 1.4: Append the `[2]` block** between the end of `[1]` (after the negation
test, line ~279) and the `[0b]` header (line ~281 — `[0b]` MUST stay last; the negation
test replaced the doc, and every `[2]` test below sets its own):

```js
  // ---------- slice 2: paragraph + lists (drives the REAL dispatch path) ----------
  // Ribbon-sync asserts sleep(150) for the rAF-coalesced tick. Model units: twips.
  await t('[2] center via WC.Commands.run sets justification + ribbon toggle', async () => {
    setDoc('align probe text'); selectText('align');
    run('center'); await sleep(150);
    const a = paraAttrs('align');
    const btn = document.querySelector('.rbtn[data-cmd="center"]');
    return a.paragraphProperties?.justification === 'center' && !!btn && btn.classList.contains('toggled');
  });
  await t('[2] alignRight then alignLeft round-trips', async () => {
    selectText('align'); run('alignRight'); await sleep(50);
    const r = paraAttrs('align').paragraphProperties?.justification === 'right';
    run('alignLeft'); await sleep(50);
    return r && paraAttrs('align').paragraphProperties?.justification === 'left';
  });
  await t('[2] justify stores OOXML "both" and lights justifyFull', async () => {
    selectText('align'); run('justify'); await sleep(150);
    const btn = document.querySelector('.rbtn[data-cmd="justify"]');
    return paraAttrs('align').paragraphProperties?.justification === 'both' && !!btn && btn.classList.contains('toggled');
  });
  await t('[2] fresh paragraph shows Align Left pressed (Word default)', async () => {
    setDoc('default align probe'); selectText('default'); await sleep(150);
    const btn = document.querySelector('.rbtn[data-cmd="alignLeft"]');
    return !!btn && btn.classList.contains('toggled');
  });
  await t('[2] Ctrl+E keyboard centers in PM mode', async () => {
    setDoc('kbd align probe'); selectText('kbd');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('kbd').paragraphProperties?.justification === 'center';
  });
  await t('[2] Ctrl+Shift+L toggles a bullet list (Word: List Bullet)', async () => {
    setDoc('kbd bullet probe'); selectText('kbd');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    await sleep(50);
    return paraAttrs('kbd').listRendering?.numberingType === 'bullet';
  });
  await t('[2] increaseIndent steps text indent by 0.5in (720tw)', async () => {
    setDoc('indent probe text'); selectText('indent');
    run('increaseIndent'); await sleep(50);
    const one = paraAttrs('indent').paragraphProperties?.indent?.left === 720;
    run('increaseIndent'); await sleep(50);
    return one && paraAttrs('indent').paragraphProperties?.indent?.left === 1440;
  });
  await t('[2] decreaseIndent steps back and clears at zero', async () => {
    selectText('indent'); run('decreaseIndent'); await sleep(50);
    const back = paraAttrs('indent').paragraphProperties?.indent?.left === 720;
    run('decreaseIndent'); run('decreaseIndent'); await sleep(50);
    const left = paraAttrs('indent').paragraphProperties?.indent?.left;
    return back && (left == null);
  });
  await t('[2] Layout indentLeft spinner sets exact indent (1.5in = 2160tw)', async () => {
    setDoc('spinner probe text'); selectText('spinner');
    window.WC.Commands.spinner('indentLeft', 1.5); await sleep(50);
    return paraAttrs('spinner').paragraphProperties?.indent?.left === 2160;
  });
  await t('[2] indentRight spinner (0.5in = 720tw)', async () => {
    selectText('spinner'); window.WC.Commands.spinner('indentRight', 0.5); await sleep(50);
    return paraAttrs('spinner').paragraphProperties?.indent?.right === 720;
  });
  await t('[2] spacingBefore/After spinners set pt as twips', async () => {
    selectText('spinner');
    window.WC.Commands.spinner('spacingBefore', 12);
    window.WC.Commands.spinner('spacingAfter', 6); await sleep(50);
    const sp = paraAttrs('spinner').paragraphProperties?.spacing || {};
    return sp.before === 240 && sp.after === 120;
  });
  await t('[2] spinner readback: Layout inputs track the caret paragraph', async () => {
    window.WC.Ribbon.activate('layout');
    selectText('spinner'); await sleep(200); // selectionUpdate → rAF sync → setComboValue
    const ent = window.WC.Ribbon.controlIndex.indentLeft;
    const ok = !!ent && parseFloat(ent.input.value) === 1.5;
    window.WC.Ribbon.activate('home');
    return ok;
  });
  await t('[2] line-spacing flyout leaf 1.5 sets spacing.line=360 rule=auto', async () => {
    setDoc('linespace probe'); selectText('linespace');
    window.WC.Commands.dropdown({ cmd: 'lineAndParagraphSpacing', type: 'dropdown' }, document.body);
    flyClick(/^1\.5$/); await sleep(50);
    const sp = paraAttrs('linespace').paragraphProperties?.spacing || {};
    return sp.line === 360 && sp.lineRule === 'auto';
  });
  await t('[2] Add Space Before applies 12pt; label flips to Remove (dynamic)', async () => {
    selectText('linespace');
    window.WC.Commands.dropdown({ cmd: 'lineAndParagraphSpacing', type: 'dropdown' }, document.body);
    flyClick(/^Add Space Before Paragraph$/); await sleep(50);
    const applied = paraAttrs('linespace').paragraphProperties?.spacing?.before === 240;
    window.WC.Commands.dropdown({ cmd: 'lineAndParagraphSpacing', type: 'dropdown' }, document.body);
    const flipped = Array.from(document.querySelectorAll('.flyout .fly-item .fi-label'))
      .some((n) => /^Remove Space Before Paragraph$/.test(n.textContent.trim()));
    window.WC.closeFlyouts();
    return applied && flipped;
  });
  await t('[2] shading palette pick lands as paragraphProperties.shading + paints', async () => {
    setDoc('shade probe text'); selectText('shade');
    window.WC.Commands.dropdown({ cmd: 'shading', type: 'split' }, document.body);
    const sw = document.querySelector('.flyout .color-swatch[title="#FFFF00"]') || document.querySelector('.flyout .color-swatch');
    const hex = sw.title.replace(/^#/, '').toUpperCase();
    sw.click(); await sleep(50);
    const a = paraAttrs('shade').paragraphProperties?.shading;
    const el2 = paraEl('shade');
    return !!a && a.fill === hex && !!el2 && el2.style.backgroundColor !== '';
  });
  await t('[2] shading No Color clears it', async () => {
    selectText('shade');
    window.WC.Commands.dropdown({ cmd: 'shading', type: 'split' }, document.body);
    const noColor = Array.from(document.querySelectorAll('.flyout .color-row'))
      .find((r) => /No Color/.test(r.textContent));
    noColor.click(); await sleep(50);
    return paraAttrs('shade').paragraphProperties?.shading == null;
  });
  await t('[2] borders face applies Word-default bottom border', async () => {
    setDoc('border probe text'); selectText('border');
    run('borders'); await sleep(50);
    const b = paraAttrs('border').paragraphProperties?.borders;
    const el2 = paraEl('border');
    return !!b && b.bottom && b.bottom.val === 'single' && !!el2 && el2.style.borderBottom !== '';
  });
  await t('[2] bordersMenu All then No Border round-trips', async () => {
    selectText('border');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body);
    flyClick(/^All Borders$/); await sleep(50);
    const b = paraAttrs('border').paragraphProperties?.borders || {};
    const all = ['top', 'bottom', 'left', 'right'].every((s) => b[s] && b[s].val === 'single');
    window.WC.Commands.dropdown({ cmd: 'borders', type: 'split' }, document.body);
    flyClick(/^No Border$/); await sleep(50);
    return all && paraAttrs('border').paragraphProperties?.borders == null;
  });
  await t('[2] sort dialog OK reorders paragraphs ascending (one undo step)', async () => {
    setDocs(['banana', 'cherry', 'apple']);
    window.WC.editor.commands.selectAll();
    await sleep(550); // close the history group (newGroupDelay 500ms) — else undo also reverts setDocs
    run('sort');
    const dlg = document.querySelector('.modal-backdrop .dialog');
    if (!dlg) return 'sort dialog did not open';
    Array.from(dlg.querySelectorAll('.dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim())).click();
    await sleep(80);
    const order = /apple[\s\S]*banana[\s\S]*cherry/.test(v().dom.textContent);
    PM().cmd('undo'); await sleep(50);
    return order && /banana[\s\S]*cherry[\s\S]*apple/.test(v().dom.textContent);
  });
  await t('[2] bullets via run() creates a list paragraph + presses the toggle', async () => {
    setDoc('bullet probe text'); selectText('bullet');
    run('bullets'); await sleep(150);
    const a = paraAttrs('bullet');
    // bullets is a SPLIT control → renders as .rsplit, not .rbtn (ribbon.js renderControl)
    const btn = document.querySelector('[data-cmd="bullets"]');
    return a.listRendering?.numberingType === 'bullet'
      && a.paragraphProperties?.numberingProperties?.numId != null
      && !!btn && btn.classList.contains('toggled');
  });
  await t('[2] bullets toggles off', async () => {
    // requires the bullet to be ON first (previous test) — else this absence-assert
    // would false-green in the red state (the [1] bold-toggles-off precedent guard)
    if (paraAttrs('bullet').listRendering?.numberingType !== 'bullet') return false;
    selectText('bullet'); run('bullets'); await sleep(50);
    return paraAttrs('bullet').listRendering == null;
  });
  await t('[2] numbering renders "1." / "2." markers across two paragraphs', async () => {
    setDocs(['Numbered one', 'Numbered two']);
    window.WC.editor.commands.selectAll();
    run('numbering'); await sleep(150); // marker styling runs an rAF pass after the nodeview update
    const m1 = paraEl('Numbered one')?.querySelector('.list-marker');
    const m2 = paraEl('Numbered two')?.querySelector('.list-marker');
    return !!m1 && m1.textContent.trim() === '1.' && !!m2 && m2.textContent.trim() === '2.';
  });
  await t('[2] ribbon increaseIndent inside a list raises the level (Word behavior)', async () => {
    selectText('Numbered two');
    run('increaseIndent'); await sleep(50);
    const up = paraAttrs('Numbered two').paragraphProperties?.numberingProperties?.ilvl === 1;
    run('decreaseIndent'); await sleep(50);
    return up && paraAttrs('Numbered two').paragraphProperties?.numberingProperties?.ilvl === 0;
  });
  await t('[2] bullet library honors the square glyph', async () => {
    setDoc('glyph probe text'); selectText('glyph');
    window.WC.Commands.dropdown({ cmd: 'bullets', type: 'split' }, document.body);
    Array.from(document.querySelectorAll('.flyout div')).find((c) => c.textContent.trim() === '■').click();
    await sleep(150);
    return paraAttrs('glyph').listRendering?.markerText === '▪';
  });
  await t('[2] bullet library custom glyph ◆ mints a definition', async () => {
    setDoc('custom glyph probe'); selectText('custom');
    window.WC.Commands.dropdown({ cmd: 'bullets', type: 'split' }, document.body);
    Array.from(document.querySelectorAll('.flyout div')).find((c) => c.textContent.trim() === '◆').click();
    await sleep(150);
    return paraAttrs('custom').listRendering?.markerText === '◆';
  });
  await t('[2] numbering library A. applies upper-alpha', async () => {
    setDoc('alpha probe text'); selectText('alpha');
    window.WC.Commands.dropdown({ cmd: 'numbering', type: 'split' }, document.body);
    Array.from(document.querySelectorAll('.flyout div')).find((c) => c.textContent.trim() === 'A.').click();
    await sleep(150);
    return paraAttrs('alpha').listRendering?.markerText === 'A.';
  });
  await t('[2] multilevel Decimal: nested item shows 1.1.', async () => {
    setDocs(['ml first item', 'ml second item']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.dropdown({ cmd: 'multilevelList', type: 'dropdown' }, document.body);
    flyClick(/^Decimal \(1\. 1\.1\. 1\.1\.1\.\)$/); await sleep(150);
    const top = paraEl('ml first item')?.querySelector('.list-marker')?.textContent.trim() === '1.';
    selectText('ml second item');
    PM().cmd('increaseListIndent'); await sleep(150);
    return top && paraEl('ml second item')?.querySelector('.list-marker')?.textContent.trim() === '1.1.';
  });
  await t('[2] multilevel Outline: 1) then nested a)', async () => {
    setDocs(['ol first item', 'ol second item']);
    window.WC.editor.commands.selectAll();
    window.WC.Commands.dropdown({ cmd: 'multilevelList', type: 'dropdown' }, document.body);
    flyClick(/^Outline \(1\) a\) i\)\)$/); await sleep(150);
    const top = paraEl('ol first item')?.querySelector('.list-marker')?.textContent.trim() === '1)';
    selectText('ol second item');
    PM().cmd('increaseListIndent'); await sleep(150);
    return top && paraEl('ol second item')?.querySelector('.list-marker')?.textContent.trim() === 'a)';
  });
  await t('[2] Change List Level → Level 3 sets ilvl 2 as ONE undo step', async () => {
    setDoc('level probe text'); selectText('level');
    run('numbering'); await sleep(550); // close the history group — undo must revert ONLY the level change
    window.WC.Commands.dropdown({ cmd: 'multilevelList', type: 'dropdown' }, document.body);
    flyClick(/^Change List Level$/);
    flyClick(/^Level 3$/); await sleep(50);
    const at2 = paraAttrs('level').paragraphProperties?.numberingProperties?.ilvl === 2;
    PM().cmd('undo'); await sleep(50);
    return at2 && paraAttrs('level').paragraphProperties?.numberingProperties?.ilvl === 0;
  });
  await t('[2] Paragraph dialog seeds from the caret and applies as ONE undo step', async () => {
    setDoc('dlg para probe'); selectText('dlg');
    run('center');
    window.WC.Commands.spinner('indentLeft', 0.5);
    await sleep(550); // close the history group — undo must revert ONLY the dialog apply
    window.WC.Dialogs.paragraph();
    const dlg = document.querySelector('.modal-backdrop .dialog');
    if (!dlg) return 'paragraph dialog did not open';
    const selects = dlg.querySelectorAll('select');
    const inputs = dlg.querySelectorAll('input[type=number]');
    const seeded = selects[0].value === 'Centered' && parseFloat(inputs[0].value) === 0.5;
    if (!seeded) { dlg.querySelector('.dlg-footer .btn:last-child').click(); return 'seeds wrong: ' + selects[0].value + '/' + inputs[0].value; }
    selects[0].value = 'Right';
    inputs[2].value = '18'; // spacing before (pt)
    Array.from(dlg.querySelectorAll('.dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim())).click();
    await sleep(80);
    const a1 = paraAttrs('dlg').paragraphProperties;
    const applied = a1?.justification === 'right' && a1?.spacing?.before === 360;
    PM().cmd('undo'); await sleep(50);
    const a2 = paraAttrs('dlg').paragraphProperties;
    return applied && a2?.justification === 'center' && a2?.spacing?.before !== 360;
  });
  await t('[2] paragraph launcher opens the dialog (unblocked after flip)', async () => {
    if (document.querySelector('.modal-backdrop')) return 'leaked dialog from a previous test';
    window.WC.Commands.launcher('paragraph', null, null);
    const dlg = document.querySelector('.modal-backdrop .dialog');
    const ok = !!dlg && /Paragraph/.test(dlg.textContent);
    if (dlg) dlg.querySelector('.dlg-footer .btn:last-child').click();
    return ok;
  });
  await t('[2] list marker separator has real width (fork CSS in the build)', async () => {
    setDoc('css probe text'); selectText('css');
    run('numbering'); await sleep(150);
    const tab = document.querySelector('#pm-editor .sd-editor-tab');
    return !!tab && getComputedStyle(tab).display === 'inline-block' && tab.getBoundingClientRect().width > 0;
  });
  await t('[2] nested list indents: margin-left grows with level', async () => {
    setDocs(['nest level zero', 'nest level one']);
    window.WC.editor.commands.selectAll();
    run('bullets'); await sleep(50);
    selectText('nest level one');
    PM().cmd('increaseListIndent'); await sleep(150);
    const p0 = paraEl('nest level zero'); const p1 = paraEl('nest level one');
    return !!p0 && !!p1 && parseFloat(p1.style.marginLeft || '0') > parseFloat(p0.style.marginLeft || '0');
  });
```

- [ ] **Step 1.5: Run** `npm run build && npm run test:pm` → 43 pre-existing tests PASS
(incl. the two repointed `[0a]` tests), all `[2]` tests FAIL (red). Tests that drive
dropdowns fail with `flyout item not found` or block-toasts — both count as red.
Commit (`test: slice-2 paragraph+lists PM tests (red) + paraAttrs helpers + D6 test repoint`).

### Task 2: oracle `read-para-props` verb

**Files:** Modify: `scripts/oracle/word-oracle.js`, `scripts/oracle/README.md`

Pure tooling (no gate impact). New dictionary territory — budget for empirical iteration
against live Word 16.77.1 exactly like slice 0c. **Read `scripts/oracle/README.md` in full
first** (PID-safety + the 15-quirk table are binding).

- [ ] **Step 2.1: Add `readParaProps`** after `readWordProps` (word-oracle.js:203):

```js
/**
 * Paragraph-level format + list read (slice 2). One row per paragraph.
 * Field order puts TEXT LAST: paragraph text may contain literal tabs, which
 * would corrupt the tab-joined protocol for any later field (quirk #16).
 * Unverified dictionary territory (first use on this Mac): `line spacing rule`,
 * `space before/after`, the indent property names, and the `list format` class.
 * If `set lf to list format of tr` raises -1728 (like word ranges, quirk #14),
 * inline the full specifier per property instead of binding the variable.
 */
function readParaProps(docxPath) {
  const basename = openDoc(docxPath);
  const script = `
tell application "Microsoft Word"
  set out to ""
  try
    set d to document "${esc(basename)}"
    repeat with i from 1 to (count of paragraphs of d)
      set pf to paragraph format of paragraph i of d
      set tr to text object of paragraph i of d
      set lf to list format of tr
      set out to out & i & tab & (alignment of pf) & tab & (line spacing rule of pf) & tab & (line spacing of pf) & tab & (space before of pf) & tab & (space after of pf) & tab & (paragraph format left indent of pf) & tab & (paragraph format right indent of pf) & tab & (first line indent of pf) & tab & (list type of lf) & tab & (list level number of lf) & tab & (list string of lf) & tab & (content of tr) & linefeed
    end repeat
  on error errMsg
    close document "${esc(basename)}" saving no
    error errMsg
  end try
  close document "${esc(basename)}" saving no
  return out
end tell`;
  const raw = osa(script);
  // Comma-decimal locale (quirk #13) applies to SIX numeric fields here.
  const num = (s) => { const v = parseFloat((s || '').replace(',', '.')); return isNaN(v) ? null : v; };
  return raw.split('\n').filter(Boolean).map((line) => {
    const p = line.split('\t');
    const firstLine = num(p[8]);
    return {
      index: Number(p[0]),
      alignment: (p[1] || '').replace(/^align paragraph /, ''),
      lineSpacingRuleRaw: p[2],
      lineSpacingPt: num(p[3]), // POINTS, not a multiplier (2.0 spacing on 12pt = 24)
      spaceBeforePt: num(p[4]),
      spaceAfterPt: num(p[5]),
      leftIndentPt: num(p[6]),
      rightIndentPt: num(p[7]),
      firstLineIndentPt: firstLine,
      hangingPt: firstLine != null && firstLine < 0 ? -firstLine : 0, // Word models hanging as negative first-line
      listTypeRaw: p[9],
      listLevelNumber: num(p[10]),
      listString: p[11],
      text: p.slice(12).join('\t').replace(/\r$/, ''),
    };
  });
}
```

- [ ] **Step 2.2: Wire the CLI** — in the dispatch block (word-oracle.js:256), add before
the `roundtrip` branch:

```js
} else if (cmd === 'read-para-props' && a) {
  emit({ file: a, generatedBy: 'word-oracle read-para-props', paragraphs: readParaProps(path.resolve(a)) });
```

and extend the usage strings (header comment + final `console.error`).

- [ ] **Step 2.3: Verify live against real Word.** Author a probe docx IN REAL WORD
(not the clone — this validates the verb itself): 4 paragraphs — (1) centered, (2) double
line spacing, (3) 0.5" left indent + hanging indent, (4) a bullet item. Save as
`tests/fixtures/.oracle-para-probe.docx` (project subtree — the $HOME sandbox rule applies
to save-as only, but keep the habit). Run:

```bash
node scripts/oracle/word-oracle.js read-para-props "$(pwd)/tests/fixtures/.oracle-para-probe.docx" --out /tmp/para-probe.json
```

Iterate on dictionary errors (expected on first contact): record the RAW enum strings
`line spacing rule` and `list type` return, whether `list format` binds to a variable,
and the exact indent property names that resolve. Word must be left clean: document count
back at baseline, never quit.

- [ ] **Step 2.4: Document the discoveries — BOTH targets.** The NUMBERED quirk list
lives in the `word-oracle.js` header comment (lines 30-64, currently #1-15 — append the
new discoveries as #16+); the README's dictionary-renames table
(`scripts/oracle/README.md:191-203`) is UN-numbered — append plain rows there. Cover:
enum prefixes + normalization mapping for `line spacing rule`/`list type`, the
list-format variable-binding verdict, the text-last-field rationale, and the
lineSpacing-is-points trap (COM precedent: `docs/VALIDATION_home_insert.md:25`).
Normalize the enums in `readParaProps` per the discovered strings (same pattern as the
`align paragraph ` strip) and re-run 2.3 to confirm clean JSON. Also document the verb
itself (CLI + JSON shape) in the README's verbs section. Commit
(`test(test): word-oracle read-para-props verb — paragraph + list format reads`).

# Stage B — fork engine work (all NOTICE-documented)

### Task 3: shading render + align-keymap strip

**Files:** Modify: `src/renderer/core/superdoc-fork/core/super-converter/styles.js`,
`src/renderer/core/superdoc-fork/extensions/text-align/text-align.js`,
`src/renderer/core/superdoc-fork/NOTICE.md`

- [ ] **Step 3.1: Render paragraph shading.** In `encodeCSSFromPPr` (styles.js:196), add
`shading` to the destructure on line 202:

```js
  const { spacing, indent, borders, justification, shading } = paragraphProperties;
```

and after the borders block (line 292), before the justification block:

```js
  // Paragraph shading (w:shd → shd-translator key 'shading': { val, color, fill, ... }).
  // Word's ribbon shading writes val="clear" + fill=<hex>; fill="auto" means none.
  if (shading && shading.fill && String(shading.fill).toLowerCase() !== 'auto') {
    css['background-color'] = `#${String(shading.fill).replace(/^#/, '')}`;
  }
```

(The attr shape is the w:shd translator's output — verified:
`core/super-converter/v3/handlers/w/shd/shd-translator.js:10-12` maps `w:shd` →
`sdNodeOrKeyName: 'shading'` with `fill`/`val`/`color` attributes. `ParagraphNodeView`'s
`#updateDOMStyles` applies the `encodeCSSFromPPr` map as inline styles, so the new key
ships without further wiring.)

- [ ] **Step 3.2: Strip the SuperDoc align keymap.** Delete the whole `addShortcuts()`
block in `text-align.js:115-122` (`Mod-Shift-l/e/r/j`). Rationale: they are SuperDoc-isms,
not Word's (Word aligns on plain Ctrl+L/E/R/J — already bound in app.js), and
`Mod-Shift-L` collides with Word's **Ctrl+Shift+L = List Bullet** which Task 6 wires.
The fork's `Mod-Shift-7/8` list toggles (paragraph.js:239-244) are kept — no collision.

- [ ] **Step 3.3: NOTICE.** Append to the "Modifications made in this fork" list in
`src/renderer/core/superdoc-fork/NOTICE.md`:

```markdown
- **Paragraph shading rendered:** `encodeCSSFromPPr` (core/super-converter/styles.js)
  additionally maps `paragraphProperties.shading.fill` → `background-color`; upstream
  imported/serialized w:shd but never painted it (slice 2, 2026-06-06).
- **SuperDoc align keymap removed:** `Mod-Shift-L/E/R/J` shortcuts deleted from the
  TextAlign extension — they shadow Word's Ctrl+Shift+L (List Bullet) semantics; the
  app binds Word's real Ctrl+L/E/R/J at the document level (slice 2, 2026-06-06).
```

- [ ] **Step 3.4: Gates** (`npm run build` + all five). PM `[2]` still mostly red
(expected). Commit (`feat(editor): render paragraph shading; strip SuperDoc align keymap`).

### Task 4: `applyListDefinition` fork command (multilevel + custom glyphs)

**Files:** Create: `src/renderer/core/superdoc-fork/core/commands/applyListDefinition.js`;
Modify: `src/renderer/core/superdoc-fork/core/commands/index.js`,
`src/renderer/core/superdoc-fork/NOTICE.md`

One generic command serves both consumers: the multilevel gallery (per-level fmt/lvlText
patterns) and the bullet-library custom glyphs (a 1-level bullet override).

- [ ] **Step 4.1: Write the command:**

```js
// @ts-check
import { ListHelpers } from '@helpers/list-numbering-helpers.js';
import { mutateNumbering } from '@core/parts/adapters/numbering-mutation';
import { updateNumberingProperties } from './changeListLevel.js';
import { getResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js';

/**
 * Apply a freshly-minted list definition with explicit per-level numFmt/lvlText to every
 * paragraph in the selection (preserving each paragraph's existing ilvl).
 *
 * Used by the multilevel-list gallery (full 9-level patterns) and the bullet library's
 * non-canonical glyphs (single-level override). Levels beyond `levels.length` keep the
 * minted base template's definition.
 *
 * Mirrors toggleList's 'create' mode: numbering-XML mutation happens via mutateNumbering
 * (outside PM history — same recorded caveat as every toggleList create), while paragraph
 * attrs move through the shared `tr` so undo restores the paragraphs.
 *
 * @param {Object} options
 * @param {'orderedList'|'bulletList'} options.listType
 * @param {Array<{fmt: string, text: string}>} options.levels  OOXML w:numFmt + w:lvlText per ilvl
 * @example
 * editor.commands.applyListDefinition({ listType: 'orderedList', levels: [
 *   { fmt: 'decimal', text: '%1.' }, { fmt: 'decimal', text: '%1.%2.' },
 * ]})
 */
export const applyListDefinition =
  ({ listType, levels }) =>
  ({ editor, state, tr, dispatch }) => {
    if (listType !== 'orderedList' && listType !== 'bulletList') return false;
    if (!Array.isArray(levels) || !levels.length) return false;

    const paragraphs = [];
    const { from, to } = state.selection;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'paragraph') {
        paragraphs.push({ node, pos });
        return false;
      }
      return true;
    });
    if (!paragraphs.length) return false;

    const numId = Number(ListHelpers.getNewListId(editor));
    ListHelpers.generateNewListDefinition({ numId, listType, editor });

    // Override the minted abstract's levels with the requested per-level fmt/lvlText.
    mutateNumbering(editor, 'applyListDefinition', (numbering) => {
      const abstractId = numbering.definitions[numId]?.elements?.find(
        (el) => el.name === 'w:abstractNumId',
      )?.attributes?.['w:val'];
      const abstract = numbering.abstracts[abstractId];
      if (!abstract?.elements) return;
      levels.forEach((lvl, i) => {
        const lvlEl = abstract.elements.find(
          (el) => el.name === 'w:lvl' && el.attributes?.['w:ilvl'] === String(i),
        );
        if (!lvlEl?.elements) return;
        const setChild = (name, value) => {
          const existing = lvlEl.elements.find((el) => el.name === name);
          if (existing) existing.attributes = { ...(existing.attributes || {}), 'w:val': value };
          else lvlEl.elements.push({ type: 'element', name, attributes: { 'w:val': value } });
        };
        setChild('w:numFmt', lvl.fmt);
        setChild('w:lvlText', lvl.text);
        // Strip the template's marker font (Symbol/Wingdings on bullet levels) so the
        // override's character renders literally — same move as setLvlStyleOnAbstract
        // (core/parts/adapters/numbering-transforms.ts stripMarkerFont).
        const rPr = lvlEl.elements.find((el) => el.name === 'w:rPr');
        if (rPr?.elements) rPr.elements = rPr.elements.filter((el) => el.name !== 'w:rFonts');
      });
    });

    for (const { node, pos } of paragraphs) {
      // getResolvedParagraphProperties is a cache-only WeakMap read — misses on nodes
      // the rendering pass hasn't visited; mirror textIndent.js's fallback or a fresh
      // paragraph silently resets to ilvl 0.
      const resolved =
        getResolvedParagraphProperties(node) ||
        calculateResolvedParagraphProperties(editor ?? {}, node, state.doc.resolve(pos));
      const existingIlvl = resolved?.numberingProperties?.ilvl ?? 0;
      updateNumberingProperties({ numId, ilvl: existingIlvl }, node, pos, editor, tr);
    }
    if (dispatch) dispatch(tr);
    return true;
  };
```

(Adjust the resolvedPropertiesCache import accordingly:
`import { getResolvedParagraphProperties, calculateResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js';`)

- [ ] **Step 4.1b: `changeListLevelBy` — command-shaped absolute-delta level change.**
The raw `changeListLevel(delta, editor, tr)` reads `editor.state` directly
(changeListLevel.js:15), so CHAINING ±1 steps double-reads stale state and lands one
level short — a single full-delta call is the only one-transaction path. Append to
`core/commands/changeListLevel.js` (its natural home — the file already exports
`updateNumberingProperties`):

```js
/**
 * Command-shaped wrapper: change the list level by an arbitrary delta in ONE
 * call/transaction. Chaining repeated ±1 increase/decreaseListIndent steps does NOT
 * work — changeListLevel reads editor.state (not the chain's shared tr), so every
 * chained step re-computes from the same stale level.
 * @example editor.commands.changeListLevelBy(2)  // ilvl 0 → 2
 */
export const changeListLevelBy =
  (delta) =>
  ({ editor, tr, dispatch }) => {
    if (!delta) return true;
    const ok = changeListLevel(delta, editor, tr);
    if (ok && dispatch) dispatch(tr);
    return ok;
  };
```

(`changeListLevel` validates `hasListDefinition(numId, newLevel)` for the full delta —
arbitrary deltas are already supported. Confirm `core/commands/index.js` re-exports the
file's named exports so the command auto-registers; add the export line if it is
per-name.)

- [ ] **Step 4.2: Register it.** Add the export to
`core/commands/index.js`, matching the file's existing export style for its neighbors
(e.g. the line exporting `toggleList`). The core Commands extension spreads every
`core/commands/index.js` export onto `editor.commands` automatically
(core/extensions/commands.js) — no further mounting.

- [ ] **Step 4.3: NOTICE.** Append:

```markdown
- **`applyListDefinition` command added:** mints a list definition with explicit
  per-level `w:numFmt`/`w:lvlText` overrides and assigns it to the selection — powers
  the Word-style multilevel-list gallery and custom bullet glyphs (slice 2, 2026-06-06).
- **`changeListLevelBy` command added:** command-shaped wrapper applying an arbitrary
  list-level delta in one transaction (chained ±1 steps re-read stale editor.state and
  land one level short) — powers the Change List Level menu (slice 2, 2026-06-06).
```

- [ ] **Step 4.4: Quick probe + gates.** `npm run build`, then in the app devtools:
`WC.PM.cmd('applyListDefinition', { listType: 'orderedList', levels: [{ fmt: 'decimal', text: '%1.' }, { fmt: 'decimal', text: '%1.%2.' }] })`
on a selected paragraph → marker `1.`; Tab → `1.1.`. Also probe
`WC.PM.cmd('changeListLevelBy', 2)` on a numbered item → ilvl 2 in one step. All five
gates. Commit
(`feat(editor): applyListDefinition + changeListLevelBy list commands`).

### Task 5: fork stylesheet into the build (hanging-indent fix)

**Files:** Modify: `src/renderer/main.ts`

Root cause (verified): the bridge imports `@core/Editor.js` directly, so
`superdoc-fork/index.js → style.css` never enters the build; the built renderer has zero
fork CSS. Without `.sd-editor-scoped .ProseMirror .sd-editor-tab { display:inline-block }`
(assets/styles/elements/prosemirror.css:136-139) the marker→text separator's computed
inline `width:Npx` is ignored (width on an inline span) — the slice-1 screenshot's
"1.Numbered 1". `#pm-editor` already receives `sd-editor-scoped` at runtime
(ProseMirrorRenderer.initContainerElement), and the hanging-indent inline styles
(`margin-left` + negative `text-indent`) already ship — this import alone closes the gap,
and fixes typed-tab zero-width (same rule).

- [ ] **Step 5.1: Collision audit.** Read
`src/renderer/core/superdoc-fork/assets/styles/elements/prosemirror.css` end-to-end.
Safe = selectors scoped under `.sd-editor-scoped` OR under SuperDoc-only classes that no
element in this app ever carries (`.presentation-editor*` — 8 such selectors are KNOWN
and expected at lines ~86-95 and ~323-353; they are inert here). Only a rule that can
match legacy/chrome DOM forces the fallback: create
`src/renderer/public/styles/pm-fork-elements.css` with the scoped rules only, link from
`index.html`, record the deviation in the PR. (Expected outcome: direct import is safe —
the fork ships css-isolation tests, `superdoc-fork/tests/css-isolation.test.js`.)

- [ ] **Step 5.2: Import.** In `src/renderer/main.ts`, after the existing imports (line 8):

```ts
// Fork element styles (markers/tabs): the bridge imports @core/Editor.js directly, so
// superdoc-fork/index.js → style.css never enters the build. Without the .sd-editor-tab
// inline-block rule, list-marker separators and typed tabs render zero-width.
import './core/superdoc-fork/assets/styles/elements/prosemirror.css'
```

- [ ] **Step 5.3: Verify the build + both modes.** `npm run build` →
`grep -rl "sd-editor-tab" out/renderer/assets/ | grep -v '\.js$'` finds a CSS asset (or
the rule is inlined into `out/renderer/index.html` — either is fine as long as it ships as
CSS, not just a JS string). Run `npm run test:smoke && npm run test:smoke:legacy` (9+9)
and `npm run test:legacy` (257) — `--legacy` must render byte-identically (the rules are
`.sd-editor-scoped`-prefixed; the hidden legacy `#editor` never carries that class).
PM suite: the `[2] list marker separator has real width` test goes GREEN (the `[2]` list
tests that create lists via dispatch stay red until Task 11; this one uses `run('numbering')`
— still red here, confirm it flips at Task 11 instead. The display:inline-block half can be
spot-checked in devtools now.)

- [ ] **Step 5.4: Visual spot-check + commit.** `npm start`, type into the imported list
fixture: markers now show a real gap and hanging wrap. Screenshot for the PR. Commit
(`fix(editor): ship the fork element stylesheet — list markers/tabs get real widths`).

# Stage C — entry-point rewrites (PMA branches; dispatch still blocks until Task 11)

> Pattern (slice 1, commands.js:33): `const pm = PMA(); pm ? pm.cmd(...) : <legacy>`.
> `PMA()` ignores FLIPPED — these branches are reachable by direct `WC.PM` calls and unit
> probes immediately, but ribbon/keyboard dispatch stays courtesy-blocked until the
> registry flips. Legacy branches must stay byte-identical (frozen 257 gate).

### Task 6: align ×4, indent, spinners, line-spacing

**Files:** Modify: `src/renderer/public/js/commands.js`

- [ ] **Step 6.1: Align + list-aware indent** (commands.js:55-67) — replace:

```js
  H.alignLeft = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'left') : E().exec('justifyLeft'); };
  H.center = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'center') : E().exec('justifyCenter'); };
  H.alignRight = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'right') : E().exec('justifyRight'); };
  // Word stores justify as w:jc="both"; setTextAlign('justify') does that mapping —
  // never pass 'both' (the alignments whitelist rejects it).
  H.justify = () => { const pm = PMA(); pm ? pm.cmd('setTextAlign', 'justify') : E().exec('justifyFull'); };
  H.bullets = () => { const pm = PMA(); pm ? pm.cmd('toggleBulletList') : E().exec('insertUnorderedList'); };
  H.numbering = () => { const pm = PMA(); pm ? pm.cmd('toggleOrderedList') : E().exec('insertOrderedList'); };
  H.decreaseIndent = () => stepIndent(-48);
  H.increaseIndent = () => stepIndent(48);
  function stepIndent(px) {
    const pm = PMA();
    if (pm) {
      // Word behavior: inside a list the ribbon indent buttons change the LIST LEVEL;
      // otherwise they step the paragraph text indent by 0.5" (engine: 36pt = 720tw).
      const para = pm.getEditor().getAttributes('paragraph') || {};
      const inList = !!(para.paragraphProperties && para.paragraphProperties.numberingProperties) || !!para.listRendering;
      if (inList) pm.cmd(px > 0 ? 'increaseListIndent' : 'decreaseListIndent');
      else pm.cmd(px > 0 ? 'increaseTextIndent' : 'decreaseTextIndent');
      return;
    }
    if (E().currentListItem && E().currentListItem()) { if (px > 0) E().demoteListItem(); else E().promoteListItem(); return; }
    E().selectedBlocks().forEach((b) => { const cur = parseFloat(b.style.marginLeft) || 0; const next = Math.max(0, cur + px); b.style.marginLeft = next ? next + 'px' : ''; });
    E().dirty = true; E().repaginate(); E().updateStatus(); E().emit();
  }
```

- [ ] **Step 6.2: Layout spinners** (Commands.spinner, commands.js:934-941) — replace:

```js
    // Layout Paragraph spinners (indent in inches, spacing in points; model = twips).
    spinner(cmd, value) {
      if (WC.PM && WC.PM.active && WC.PM.isBlocked(cmd)) { WC.PM.notifyBlocked(cmd); return; }
      const pm = PMA();
      const PARA_SPIN = {
        indentLeft: ['paragraphProperties.indent.left', (v) => Math.round(v * 1440)],
        indentRight: ['paragraphProperties.indent.right', (v) => Math.round(v * 1440)],
        spacingBefore: ['paragraphProperties.spacing.before', (v) => Math.round(v * 20)],
        spacingAfter: ['paragraphProperties.spacing.after', (v) => Math.round(v * 20)],
      };
      if (pm && PARA_SPIN[cmd]) {
        // withSelection: the spinner input took real focus — focus.ts snapshotted the
        // PM selection on focusin (.rspinner is in its capture list); restore first.
        const [path, conv] = PARA_SPIN[cmd];
        pm.withSelection(() => pm.cmd('updateAttributes', 'paragraph', { [path]: conv(value) }));
        return;
      }
      if (cmd === 'indentLeft') E().applyBlockStyle('marginLeft', value ? value + 'in' : '');
      else if (cmd === 'indentRight') E().applyBlockStyle('marginRight', value ? value + 'in' : '');
      else if (cmd === 'spacingBefore') E().applyBlockStyle('marginTop', value + 'pt');
      else if (cmd === 'spacingAfter') E().applyBlockStyle('marginBottom', value + 'pt');
      else if (cmd === 'goToRecord') WC.Mail.go((value || 1) - 1);
    },
```

- [ ] **Step 6.3: lineSpacingMenu** (commands.js:1132-1141) — replace. PM mode gets the
presets on `setLineHeight` (a LINES multiplier — `linesToTwips(v) = v*240`; never pass pt)
and **dynamic Add/Remove labels** (Word behavior); the legacy branch keeps the original
two hardcoded items verbatim (frozen-UI constraint):

```js
  function lineSpacingMenu(node) {
    const opts = ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'];
    const pm = PMA();
    const st = pm ? pm.getState() : null;
    WC.flyout(node, (fly) => {
      opts.forEach((o) => fly.appendChild(WC.flyItem(o, { onClick: () => {
        const pm2 = PMA();
        if (pm2) pm2.cmd('setLineHeight', parseFloat(o));
        else E().applyBlockStyle('lineHeight', o);
      } })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Line Spacing Options…', { onClick: () => WC.Dialogs.paragraph() }));
      if (pm) {
        // Word-fidelity: labels flip with the caret paragraph's current spacing.
        const hasBefore = !!(st && st.spacingBeforePt > 0);
        const hasAfter = !!(st && st.spacingAfterPt > 0);
        fly.appendChild(WC.flyItem(hasBefore ? 'Remove Space Before Paragraph' : 'Add Space Before Paragraph', {
          onClick: () => { const p2 = PMA(); if (p2) p2.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.spacing.before': hasBefore ? 0 : 240 }); },
        }));
        fly.appendChild(WC.flyItem(hasAfter ? 'Remove Space After Paragraph' : 'Add Space After Paragraph', {
          onClick: () => { const p2 = PMA(); if (p2) p2.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.spacing.after': hasAfter ? 0 : 240 }); },
        }));
      } else {
        fly.appendChild(WC.flyItem('Add Space Before Paragraph', { onClick: () => E().applyBlockStyle('marginTop', '12pt') }));
        fly.appendChild(WC.flyItem('Remove Space After Paragraph', { onClick: () => E().applyBlockStyle('marginBottom', '0') }));
      }
    });
  }
```

(`st.spacingBeforePt`/`spacingAfterPt` land in Task 9 — until then they're undefined,
labels read "Add …", clicks still work. The Task 1 dynamic-label test goes green after
Task 9 + the Task 11 flip.)

- [ ] **Step 6.4: Gates + partial green check.** `npm run build` + five gates. All `[2]`
tests stay red (dispatch is still courtesy-blocked; the app.js keydown entries flip in
Task 11 so keyboard and ribbon go live together — spec §6.C routes the keydown map
"through the same guard as their ribbon commands — blocked + toast until their area
flips"; the recorded D6 exemption covers FORK keymaps only). Legacy 257 untouched. Commit
(`feat(home): align/indent/spinners/line-spacing PM branches behind the D6 gate`).

### Task 7: lists — libraries, multilevel, Change List Level

**Files:** Modify: `src/renderer/public/js/commands.js`

- [ ] **Step 7.1: bulletMenu honors glyphs** (commands.js:1161-1173) — replace:

```js
  function bulletMenu(node, ordered) {
    const bullets = ordered ? ['1.', '1)', 'A.', 'a)', 'i.', 'I.'] : ['●', '○', '■', '◆', '➤', '✓'];
    // Engine style names (toggleOrderedListStyle / toggleBulletListStyle); glyphs without
    // a canonical style mint a one-level definition via applyListDefinition.
    const ORDERED_STYLE = { '1.': 'decimal', '1)': 'decimal-paren', 'A.': 'upper-alpha', 'a)': 'lower-alpha-paren', 'i.': 'lower-roman', 'I.': 'upper-roman' };
    const BULLET_STYLE = { '●': 'disc', '○': 'circle', '■': 'square' };
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader(ordered ? 'Numbering Library' : 'Bullet Library'));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px', padding: '6px 10px' } });
      bullets.forEach((b) => {
        const cell = el('div', { text: b, style: { border: '1px solid #ddd', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } });
        cell.addEventListener('click', () => {
          WC.closeFlyouts();
          const pm = PMA();
          if (!pm) { E().exec(ordered ? 'insertOrderedList' : 'insertUnorderedList'); return; }
          if (ordered) pm.cmd('toggleOrderedListStyle', ORDERED_STYLE[b]);
          else if (BULLET_STYLE[b]) pm.cmd('toggleBulletListStyle', BULLET_STYLE[b]);
          else pm.cmd('applyListDefinition', { listType: 'bulletList', levels: [{ fmt: 'bullet', text: b }] });
        });
        grid.appendChild(cell);
      });
      fly.appendChild(grid);
    });
  }
```

- [ ] **Step 7.2: multilevelMenu → Word-native patterns** (commands.js:282-294) — replace
both functions:

```js
  // Word-native multilevel patterns: per-level OOXML numFmt + lvlText, applied as a real
  // numbering definition (applyListDefinition). The legacy CSS-class fake (ml-decimal/
  // ml-bullet/ml-outline) survives only on the --legacy branch.
  const mlLevels = (mk) => Array.from({ length: 9 }, (_, i) => mk(i));
  const compound = (i, suffix) => Array.from({ length: i + 1 }, (_, k) => '%' + (k + 1)).join('.') + suffix;
  const ML_PATTERNS = {
    'Decimal (1. 1.1. 1.1.1.)': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: 'decimal', text: compound(i, '.') })) },
    'Legal (1 1.1 1.1.1)': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: 'decimal', text: compound(i, '') })) },
    'Bullet hierarchy': { listType: 'bulletList', levels: mlLevels((i) => ({ fmt: 'bullet', text: ['•', '◦', '▪'][i % 3] })) },
    'Outline (1) a) i))': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: ['decimal', 'lowerLetter', 'lowerRoman'][i % 3], text: '%' + (i + 1) + ')' })) },
    'Upper Roman (I. A. 1.)': { listType: 'orderedList', levels: mlLevels((i) => ({ fmt: ['upperRoman', 'upperLetter', 'decimal'][i % 3], text: '%' + (i + 1) + '.' })) },
  };
  function multilevelMenu(node) {
    const lib = [['Decimal (1. 1.1. 1.1.1.)', 'decimal'], ['Legal (1 1.1 1.1.1)', 'decimal'], ['Bullet hierarchy', 'bullet'], ['Outline (1) a) i))', 'outline'], ['Upper Roman (I. A. 1.)', 'outline']];
    WC.flyout(node, (fly) => {
      fly.appendChild(WC.flyHeader('List Library'));
      lib.forEach(([label, key]) => fly.appendChild(WC.flyItem(label, { onClick: () => {
        const pm = PMA();
        if (pm) pm.cmd('applyListDefinition', ML_PATTERNS[label]);
        else E().applyMultilevelPattern(key);
      } })));
      fly.appendChild(WC.flySep());
      fly.appendChild(WC.flyItem('Change List Level', { onClick: () => changeListLevelMenu(node) }));
      fly.appendChild(WC.flyItem('Define New Multilevel List…', { onClick: () => WC.notImplemented('Define New Multilevel List dialog') }));
    });
  }
  function changeListLevelMenu(node) {
    WC.flyout(node, (fly) => {
      for (let i = 1; i <= 5; i++) fly.appendChild(WC.flyItem('Level ' + i, { onClick: () => {
        const pm = PMA();
        if (!pm) { E().setListLevel(i); return; }
        // ONE full-delta call = one transaction = one undo step (Task 4.1b's
        // changeListLevelBy). NEVER chain repeated increase/decreaseListIndent —
        // changeListLevel reads editor.state, so chained ±1 steps land one short.
        const cur = (pm.getEditor().getAttributes('paragraph') || {}).paragraphProperties?.numberingProperties?.ilvl ?? 0;
        const delta = (i - 1) - cur;
        if (delta !== 0) pm.cmd('changeListLevelBy', delta);
      } }));
    });
  }
```

- [ ] **Step 7.3: Gates.** `npm run build` + five gates (PM `[2]` list/dispatch tests
still red — dispatch blocked; `PM().cmd('increaseListIndent')`-driven asserts inside them
are reached only post-flip). Legacy 257 green (multilevelMenu's legacy branch behavior is
unchanged; the Legal/Upper-Roman labels gained distinct PM patterns but identical legacy
keys). Commit (`feat(home): lists libraries honor glyphs; Word-native multilevel patterns`).

### Task 8: shading, borders, sort

**Files:** Modify: `src/renderer/public/js/commands.js`, `src/renderer/bridge/commands.ts`

- [ ] **Step 8.1: applyColor 'shade' flip** (commands.js:1080-1084) — replace the branch
(removing the slice-1 `notifyBlocked` stub):

```js
    } else if (kind === 'shade') {
      if (color && color !== 'transparent') lastShade = color;
      const pm = PMA();
      if (pm) {
        if (!color || color === 'transparent') pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.shading');
        else pm.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.shading': { val: 'clear', color: 'auto', fill: color.replace(/^#/, '').toUpperCase() } });
      } else {
        E().applyBlockStyle('backgroundColor', color || 'transparent');
      }
      WC.Ribbon.setColorBar && WC.Ribbon.setColorBar('shading', color);
    } else if (kind === 'page') {
```

- [ ] **Step 8.2: colorMenu No-Color branch** (commands.js:1094) — the `color === null`
PM branch currently routes `shade` to `notifyBlocked`. Replace its PM section with:

```js
        if (color === null) { const pm = PMA(); if (pm) { if (kind === 'hilite') pm.cmd('unsetHighlight'); else if (kind === 'fore') pm.cmd('unsetColor'); else if (kind === 'shade') pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.shading'); else pm.notifyBlocked(kind); return; } if (kind === 'hilite') E().exec('hiliteColor', 'transparent'); else if (kind === 'shade') E().applyBlockStyle('backgroundColor', 'transparent'); else if (kind === 'page') E().node.style.backgroundColor = '#ffffff'; return; }
```

- [ ] **Step 8.3: applyBorder flip** (commands.js:1151-1159) — replace. CRITICAL: the
legacy version mutates `E().selectedBlocks()` with NO pmGuard, and `selectedBlocks()`
happily returns PM-view `<p>` nodes (editor.js walks up from `window.getSelection()` with
no `#editor` containment check) — without this rewrite, the flip would write inline styles
straight into the PM view DOM (invisible to the model, lost on rerender, never saved):

```js
  function applyBorder(edge) {
    if (edge && edge !== 'none' && edge !== 'all' && edge !== 'outside') lastBorderEdge = edge;
    const pm = PMA();
    if (pm) {
      if (edge === 'none') { pm.cmd('resetAttributes', 'paragraph', 'paragraphProperties.borders'); return; }
      // Word's default paragraph border: single, 0.5pt (size is in EIGHTH-points: 4),
      // auto color, 1pt offset. 'all'≡'outside' replicates the legacy simplification
      // for single paragraphs (no inside-border concept yet; recorded deferral).
      const DEF = { val: 'single', size: 4, color: 'auto', space: 1 };
      const cur = (pm.getEditor().getAttributes('paragraph') || {}).paragraphProperties?.borders || {};
      const borders = (edge === 'all' || edge === 'outside')
        ? { top: { ...DEF }, bottom: { ...DEF }, left: { ...DEF }, right: { ...DEF } }
        : { ...cur, [edge]: { ...DEF } }; // Word ACCUMULATES single edges
      pm.cmd('updateAttributes', 'paragraph', { 'paragraphProperties.borders': borders });
      return;
    }
    const b = '1px solid #000';
    E().selectedBlocks().forEach((el2) => {
      if (edge === 'none') { el2.style.border = ''; el2.style.borderTop = el2.style.borderBottom = el2.style.borderLeft = el2.style.borderRight = ''; }
      else if (edge === 'all' || edge === 'outside') el2.style.border = b;
      else el2.style['border' + edge.charAt(0).toUpperCase() + edge.slice(1)] = b;
    });
  }
```

(`bordersMenu` itself needs no edit — its leaves call `applyBorder`, and the
`Borders and Shading…` leaf stays `notImplemented` in both worlds, recorded deferral.)

- [ ] **Step 8.4: sortParagraphs in the bridge** — add to
`src/renderer/bridge/commands.ts` after `changeCase` (the same custom-transform precedent),
and add `sortParagraphs` to the returned object on line 75:

```ts
  // Paragraph sort as ONE PM transaction (no engine command — legacy sortDialog
  // reordered DOM siblings). Restricted to contiguous siblings of the first selected
  // paragraph's parent, mirroring legacy sortSelection's same-parent guard.
  function sortParagraphs(opts: { ascending?: boolean; numeric?: boolean; header?: boolean } = {}): boolean {
    const { state } = editor
    const { from, to } = state.selection
    const paras: Array<{ node: any; pos: number }> = []
    state.doc.nodesBetween(from, to, (node: any, pos: number) => {
      if (node.type.name === 'paragraph') { paras.push({ node, pos }); return false }
      return true
    })
    if (paras.length < 2) return false
    const parent0 = state.doc.resolve(paras[0].pos).parent
    const blocks = paras.filter((p) => state.doc.resolve(p.pos).parent === parent0)
    if (blocks.length < 2) return false
    // Contiguity guard: replaceWith below rebuilds [start,end) — bail if other nodes interleave.
    const start = blocks[0].pos
    const end = blocks[blocks.length - 1].pos + blocks[blocks.length - 1].node.nodeSize
    if (blocks.reduce((s, b) => s + b.node.nodeSize, 0) !== end - start) return false
    const head = opts.header ? blocks.slice(0, 1) : []
    const toSort = opts.header ? blocks.slice(1) : blocks
    const cmp = (a: any, b: any) => {
      let r: number
      if (opts.numeric) r = (parseFloat(a.node.textContent) || 0) - (parseFloat(b.node.textContent) || 0)
      else r = a.node.textContent.localeCompare(b.node.textContent, undefined, { numeric: true, sensitivity: 'base' })
      return opts.ascending === false ? -r : r
    }
    const sorted = head.concat(toSort.slice().sort(cmp))
    editor.view?.dispatch(state.tr.replaceWith(start, end, sorted.map((p: any) => p.node)))
    editor.view?.focus()
    return true
  }
```

- [ ] **Step 8.5: sortDialog mode-aware** (commands.js:1212-1227) — replace the opening
precheck and the OK handler (the legacy `E().selectedBlocks()` precheck must NOT run in PM
mode — same direct-DOM hazard as 8.3):

```js
  function sortDialog() {
    const pmOpen = PMA();
    if (!pmOpen) {
      const all = E().selectedBlocks();
      if (all.length < 2) { WC.toast('Select multiple paragraphs to sort.'); return; }
    } else {
      pmOpen.captureSelection(); // the dialog steals focus; restore before sorting
    }
    const type = el('select', {}, ['Text', 'Number', 'Date'].map((t) => el('option', { text: t })));
    const dir = el('select', {}, ['Ascending', 'Descending'].map((t) => el('option', { text: t })));
    const hdr = el('input', { type: 'checkbox' });
    const body = el('div', {}, [
      el('div', { class: 'row' }, [el('label', { text: 'Sort by:', style: { width: '70px' } }), el('span', { text: 'Paragraphs' })]),
      el('div', { class: 'row' }, [el('label', { text: 'Type:', style: { width: '70px' } }), type, el('label', { style: { marginLeft: '12px' } }, [dir])]),
      el('div', { class: 'row' }, [el('label', {}, [hdr, el('span', { text: ' My list has a header row' })])]),
    ]);
    WC.dialog({ title: 'Sort Text', width: '440px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        const opts = { ascending: dir.value === 'Ascending', numeric: type.value !== 'Text', header: hdr.checked };
        const pm = PMA();
        if (pm) { let ok = false; pm.withSelection(() => { ok = pm.sortParagraphs(opts); }); if (!ok) WC.toast('Select multiple paragraphs to sort.'); }
        else sortSelection(opts);
      } },
      { label: 'Cancel' },
    ] });
  }
```

- [ ] **Step 8.6: Gates + commit.** Five gates (legacy 257 exercises sort×2/shading/
borders faces — must stay green). Commit
(`feat(home): shading, borders, sort flip to PM transactions`).

### Task 9: state-sync — defaults, resolved values, spinner readback

**Files:** Modify: `src/renderer/bridge/state-sync.ts`

- [ ] **Step 9.0: Note on the keyboard tests.** The two `[2]` keyboard tests (Ctrl+E,
Ctrl+Shift+L) and the `fresh paragraph Align Left` test go green at Task 11 / after this
task respectively — keep tracking which tests each task flips.

- [ ] **Step 9.1: Resolved head-paragraph properties + new st fields.** Add the import and
helper at the top, then extend `toQueryState` after the listRendering block (line 60):

```ts
import { calculateResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js'

function headParagraph(editor: AnyEditor): { node: any; pos: number } | null {
  try {
    const $from = editor.state.selection.$from
    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d)
      if (node?.type?.name === 'paragraph') return { node, pos: d > 0 ? $from.before(d) : 0 }
    }
  } catch { /* selection states the resolver can't read */ }
  return null
}
```

```ts
  // Resolved (style-cascade-included) paragraph values for the Layout spinners and the
  // Paragraph dialog seeds. Inline attrs alone miss style-derived indents/spacing
  // (getActiveFormatting is inline-only — recorded engine constraint).
  const head = headParagraph(editor)
  if (head) {
    let resolved: any = null
    try { resolved = calculateResolvedParagraphProperties(editor, head.node, editor.state.doc.resolve(head.pos)) } catch { resolved = head.node.attrs?.paragraphProperties || null }
    const ind = resolved?.indent || {}
    const sp = resolved?.spacing || {}
    // undefined (NOT 0) when unresolved — so downstream `?? 0`/`?? 8` defaults engage
    // instead of pushing a wrong hard 0 (legacy UI + Word show 8pt spacing-after default).
    st.indentLeftIn = ind.left != null ? Math.round((ind.left / 1440) * 100) / 100 : undefined
    st.indentRightIn = ind.right != null ? Math.round((ind.right / 1440) * 100) / 100 : undefined
    st.spacingBeforePt = sp.before != null ? Math.round(sp.before / 20) : undefined
    st.spacingAfterPt = sp.after != null ? Math.round(sp.after / 20) : undefined
    // Multiplier only when the rule is 'auto' (or unset); exact/atLeast rules are
    // pt-based and have no multiplier representation — report null (dialog shows default).
    st.lineSpacing = sp.line != null && (sp.lineRule === 'auto' || sp.lineRule == null)
      ? Math.round((sp.line / 240) * 100) / 100 : null
  }
```

- [ ] **Step 9.2: Align-Left default pressed (Word).** Replace the justification mapping
(lines 49-53) — `null` now reads as left:

```ts
  const just = para?.paragraphProperties?.justification ?? para?.textAlign ?? null
  if (just === 'center') st.justifyCenter = true
  else if (just === 'right') st.justifyRight = true
  else if (just === 'both' || just === 'justify') st.justifyFull = true
  else st.justifyLeft = true // explicit 'left' AND the unset default — real Word presses Align Left on a fresh paragraph (oracle-confirm in Task 13)
```

- [ ] **Step 9.3: Spinner pushes.** In `sync()` after the font/fontSize `setComboValue`
calls (line 81):

```ts
    // Caret-tracking Layout spinners (real Word does this; legacy never did).
    // controlIndex entries exist from boot (Ribbon.renderBody renders every tab's
    // panel at init — ribbon.js:97-104); skip the push while the user is typing in
    // the input so sync() can't clobber a mid-edit value.
    const pushSpin = (cmd: string, val: string) => {
      const ent = w.WC?.Ribbon?.controlIndex?.[cmd]
      if (ent?.input && document.activeElement !== ent.input) ent.input.value = val
    }
    pushSpin('indentLeft', String(st.indentLeftIn ?? 0))
    pushSpin('indentRight', String(st.indentRightIn ?? 0))
    pushSpin('spacingBefore', String(st.spacingBeforePt ?? 0))
    pushSpin('spacingAfter', String(st.spacingAfterPt ?? 8))
```

- [ ] **Step 9.4: Gates.** Five gates; PM `[0a]`/`[1]` sync tests must stay green
(the justification change only adds a default-on branch — `[2] fresh paragraph` test
flips green NOW; verify no existing test asserts all-four-off). Commit
(`feat(ribbon): state-sync — Align Left default, resolved paragraph fields, spinner readback`).

### Task 10: Paragraph dialog — seeds + one-transaction OK

**Files:** Modify: `src/renderer/public/js/dialogs.js:200-226`

- [ ] **Step 10.1: Rewrite `D.paragraph`:**

```js
  D.paragraph = function () {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    if (pm) pm.captureSelection(); // the dialog steals focus; restore before applying
    const st = pm ? pm.getState() : null;
    const fmtLine = (v) => (v == null ? '1.15' : (Number.isInteger(v) ? v + '.0' : String(v)));
    const align = el('select', {}, ['Left', 'Centered', 'Right', 'Justified'].map((o) => el('option', { text: o })));
    if (st) align.value = st.justifyCenter ? 'Centered' : st.justifyRight ? 'Right' : st.justifyFull ? 'Justified' : 'Left';
    const indL = el('input', { type: 'number', value: String(st ? (st.indentLeftIn ?? 0) : 0), step: '0.1', style: { width: '70px' } });
    const indR = el('input', { type: 'number', value: String(st ? (st.indentRightIn ?? 0) : 0), step: '0.1', style: { width: '70px' } });
    const before = el('input', { type: 'number', value: String(st ? (st.spacingBeforePt ?? 0) : 0), style: { width: '70px' } });
    const after = el('input', { type: 'number', value: String(st ? (st.spacingAfterPt ?? 8) : 8), style: { width: '70px' } });
    // PM mode adds 2.5 (ribbon parity); the legacy option list is frozen UI.
    const lineOpts = pm ? ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'] : ['1.0', '1.15', '1.5', '2.0', '3.0'];
    const line = el('select', {}, lineOpts.map((o) => el('option', { text: o })));
    if (st && st.lineSpacing != null && lineOpts.includes(fmtLine(st.lineSpacing))) line.value = fmtLine(st.lineSpacing);
    const body = el('div', {}, [
      row('Alignment:', align),
      row('Indent left (in):', indL), row('Indent right (in):', indR),
      row('Spacing before (pt):', before), row('Spacing after (pt):', after),
      row('Line spacing:', line),
    ]);
    function row(label, ctrl) { return el('div', { class: 'row' }, [el('label', { text: label, style: { width: '160px' } }), ctrl]); }
    WC.dialog({ title: 'Paragraph', width: '460px', body, footer: [
      { label: 'OK', primary: true, onClick: () => {
        if (pm) {
          const steps = [
            ['setTextAlign', { Left: 'left', Centered: 'center', Right: 'right', Justified: 'justify' }[align.value]],
            ['updateAttributes', 'paragraph', {
              'paragraphProperties.spacing.before': Math.round((parseFloat(before.value) || 0) * 20),
              'paragraphProperties.spacing.after': Math.round((parseFloat(after.value) || 0) * 20),
              'paragraphProperties.spacing.line': Math.round((parseFloat(line.value) || 1.15) * 240),
              'paragraphProperties.spacing.lineRule': 'auto',
              'paragraphProperties.indent.left': Math.round((parseFloat(indL.value) || 0) * 1440),
              'paragraphProperties.indent.right': Math.round((parseFloat(indR.value) || 0) * 1440),
            }],
          ];
          pm.withSelection(() => pm.chain(steps)); // ONE transaction = ONE undo step (Word)
        } else {
          const a = { Left: 'justifyLeft', Centered: 'justifyCenter', Right: 'justifyRight', Justified: 'justifyFull' }[align.value];
          E().exec(a);
          E().applyBlockStyle('marginTop', before.value + 'pt');
          E().applyBlockStyle('marginBottom', after.value + 'pt');
          E().applyBlockStyle('lineHeight', line.value);
          E().applyBlockStyle('marginLeft', (parseFloat(indL.value) * 96) + 'px');
          E().applyBlockStyle('marginRight', (parseFloat(indR.value) * 96) + 'px');
        }
      } },
      { label: 'Cancel' },
    ] });
  };
```

- [ ] **Step 10.2: Gates.** Five gates. Legacy 257 must stay green — the frozen
paragraph-launcher test only asserts the dialog OPENS; the legacy branch's option list and
apply path are byte-identical. Commit
(`feat(home): Paragraph dialog seeds from the caret, applies as one PM transaction`).

# Stage D — the flip, gates, oracle, wrap-up

### Task 11: FLIP the registry — areas `paragraph` + `lists` go live

**Files:** Modify: `src/renderer/bridge/index.ts:23`

- [ ] **Step 11.1: The auditable flip moment for this slice:**

```ts
const FLIPPED = new Set<string>(['character', 'history', 'paragraph', 'lists']) // slices 1-2
```

This single edit un-blocks all 17 cmd ids at the dispatch heads, the Layout spinners, and
the Paragraph launcher (probe cmd `alignLeft`) — every target was rewritten in Tasks 6-10.

- [ ] **Step 11.1b: app.js keydown re-points** (app.js:84-88) — in the SAME commit, so
keyboard and ribbon go live together (spec §6.C). Replace the five `pmBlockedOr`
paragraph/lists entries with live PM ternaries (the undo/redo pattern, app.js:70-71):

```js
        if (k === 'l' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'left') : E().exec('justifyLeft'); };
        if (k === 'e' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'center') : E().exec('justifyCenter'); };
        if (k === 'r' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'right') : E().exec('justifyRight'); };
        if (k === 'j' && !shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('setTextAlign', 'justify') : E().exec('justifyFull'); };
        if (k === 'l' && shift) return () => { const pm = WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null; pm ? pm.cmd('toggleBulletList') : E().exec('insertUnorderedList'); };
```

(Task 3 already stripped the fork's competing `Mod-Shift-L` — Ctrl+Shift+L now has exactly
one owner: Word's List Bullet semantics.)

- [ ] **Step 11.2: Full PM suite green.** `npm run build && npm run test:pm` → ALL tests
pass: 43 pre-existing (incl. the two repointed `[0a]` D6 tests, which now NEED their
Task-1 re-targets) + the full `[2]` block. Triage any stragglers with the probe-JSON
fail details before touching code.

- [ ] **Step 11.3: All five gates + counts.** Record exact totals (expect PM ≈ 77, legacy
257, smoke 9+9, docx 17). Commit
(`feat(home): flip paragraph+lists areas onto the PM engine (D6 registry + Word shortcuts)`).

### Task 12: full-gate sweep + manual sanity

- [ ] **Step 12.1:** Clean-room run of all five gate commands from the plan header; paste
the five summary lines into the PR description draft.
- [ ] **Step 12.2:** Manual smoke in `npm start`: type → align ×4 → indent in/out of a
list → bullets/numbering + a library glyph → multilevel decimal + Tab → spinner round-trip
on the Layout tab → shading + bottom border → sort 3 paragraphs → Paragraph dialog →
Ctrl+Z chain back. Then `npm start -- --legacy`: same ribbon group drives the OLD editor
unchanged.
- [ ] **Step 12.3:** Save a `.docx` with aligned/indented/spaced/shaded/bordered/bulleted/
multilevel content; reopen it (Ctrl+O) — everything round-trips visually.

### Task 13: oracle validation (spec §8.3) — per feature family

Manual, against Word for Mac 16.77.1; **re-read `scripts/oracle/README.md` quirks first**;
reports + screenshots checked into `docs/superpowers/plans/notes/`. Word left clean after
every leg (document count at baseline, never quit).

- [ ] **Step 13.1: Leg A (clone → Word), paragraph family.** In the clone: 4 paragraphs —
center, double-spacing, 0.5" left indent, 12pt space-before. Ctrl+S to
`tests/fixtures/.oracle-out-s2-para.docx`. Run
`node scripts/oracle/word-oracle.js read-para-props "$(pwd)/tests/fixtures/.oracle-out-s2-para.docx" --out docs/superpowers/plans/notes/2026-06-06-slice2-paraA.json`
→ expect alignment `center`, lineSpacingPt 24-on-12pt (rule = double/multiple), 
leftIndentPt 36, spaceBeforePt 12.
- [ ] **Step 13.2: Leg A, lists family.** Bullets, numbering, one library glyph (square),
multilevel decimal with one Tab-nested item. Export + read-para-props → listTypeRaw
bullet/numbered classes, listLevelNumber 1 vs 2, listString `•`/`1.`/`1.1.`. ALSO verify
hanging metrics: firstLineIndentPt negative (hangingPt > 0) on list items.
- [ ] **Step 13.3: Leg A, shading/borders.** Yellow shading + bottom border paragraph →
roundtrip-open in Word and visually confirm (shading/borders are not in the verb's field
set; screenshot evidence) — plus re-import the roundtripped file in the clone (leg B for
the same attrs).
- [ ] **Step 13.4: Leg B (Word → clone).** In real Word author: a centered 2.0-spaced
paragraph, a bulleted list, a multilevel-numbered nested list, custom spacing 18pt-before.
Save, Ctrl+O in the clone → compare `WC.PM.debugFormatting()` + `paraAttrs`-style devtools
reads (`WC.editor.getAttributes('paragraph')`) per paragraph; markers/indents render like
Word side-by-side.
- [ ] **Step 13.5: Behavior decisions validated:** (a) fresh-paragraph Align Left pressed —
confirm Word's ribbon shows Left pressed on a default paragraph; (b) ribbon indent button
inside a list changes the LEVEL in Word; (c) Ctrl+Shift+L applies List Bullet in Word;
(d) bullet-glyph choice round-trips through w:numFmt/w:lvlText. Record verdicts in the
notes JSONs; any mismatch becomes a fix-or-recorded-deviation decision BEFORE the PR.
- [ ] **Step 13.6: UI fidelity screenshots** (`--shot` harness + real Word side-by-side):
the multilevel list + hanging indent shot replaces the slice-1 gap evidence. Commit the
notes (`docs(plan): slice-2 oracle validation evidence`).

### Task 14: checkpoint + PR

- [ ] **Step 14.1:** Invoke the **plan-tracking** skill: append the slice-2 dated entry to
`docs/plan/last-point.md` (top), tick the Daily work log in `docs/plan/execution-map.md`,
update CURRENT PHASE (slice 2 DONE → slice 3 styles next). Note the recorded deferrals
(below) in the entry.
- [ ] **Step 14.2:** Commit per the **commit-style** skill; push; open the PR (slice-2
branch → `main`) with: gate counts, oracle JSONs + screenshots, the fork-edit NOTICE
summary, and the deferral list.

---

## Recorded deferrals (carry into last-point.md)

- Borders and Shading… dialog: stays `notImplemented` (both worlds — never existed).
- Define New Multilevel List… / Define New Bullet… / Set Numbering Value: stay
  `notImplemented` (parity).
- Inside borders ('all' ≡ 'outside' for single paragraphs): Word's multi-paragraph
  inside-border semantics deferred.
- Sort "Date" type stays parseFloat-numeric (legacy parity; Word does real date parsing).
- restartNumbering/continueNumbering: engine-ready, no ribbon control (Word exposes via
  context menu — future slice).
- Mixed-selection alignment reads head-paragraph state, not Word's all-off (recorded
  slice-0a deviation, unchanged).
- Show-marks space-dots/tab-arrows: parity with legacy (¶-only) confirmed; real-Word
  extras need decorations (future polish).

## Self-review + plan-critique (done at authoring)

Grounded by a 6-agent inventory workflow (ribbon dispatch, legacy handlers, engine
commands, state-sync/tests, oracle, list-rendering fidelity — 2026-06-06), then hardened
by a 3-critic adversarial workflow (code-vs-repo, spec-coverage, test-validity; 20
findings, ALL applied). The blockers it caught: `resetAttributes` is `(typeOrName, attrs)`
— the 3-arg form silently drops `listRendering` and numberingPlugin never self-heals it
(→ array form in setDoc/setDocs + devtools probe); bullets/numbering render as `.rsplit`,
not `.rbtn` (→ type-agnostic `[data-cmd]` selector); chained ±1 `increaseListIndent`
provably lands one level short because `changeListLevel` reads `editor.state`, and the
sequential fallback broke the same test's one-undo assert (→ new command-shaped
`changeListLevelBy(delta)` fork command, Task 4.1b). Majors: prosemirror-history's
`newGroupDelay: 500` merges setup+action into one undo event (→ `sleep(550)` before every
undo-asserted action); `[2] bullets toggles off` false-greened in the red state (→ slice-1
precedent guard); `applyListDefinition` ilvl read was cache-only (→ `calculateResolved…`
fallback, the textIndent.js pattern). Minors: keydown re-points moved into the Task-11
flip commit (spec §6.C — the D6 exemption covers fork keymaps only); CSS audit rule now
names the 8 inert `.presentation-editor*` selectors; commit scopes re-matched to the
commit-style skill (`feat(editor)`/`feat(ribbon)`/`test`/`test(test)`); st spinner fields
left `undefined` when unresolved so `?? 8` defaults engage; quirk rows split between the
numbered word-oracle.js header list (#16+) and the un-numbered README table; spinner
pushes guard `document.activeElement`. Everything else the critics verified clean —
notably: insertContent parses HTML strings, dot-path `updateAttributes` stores explicit 0,
the Task-10 dialog chain IS sound (chainable state over the shared tr), w:shd
imports/exports through the v3 pPr translators, mutateNumbering's afterCommit forces the
numberingPlugin recompute, compound `%1.%2.` lvlText renders `1.1.`, and the frozen suite
only asserts the Paragraph dialog opens.

1. **Spec/design coverage:** brainstorm D-shading-full (T3.1/T8.1-8.2), D-multilevel-native
   (T4/T7.2), D-CSS-import (T5), extras: spinner readback (T9.1/9.3), glyphs (T7.1),
   Align-Left default (T9.2), dynamic labels (T6.3); spec §8.3 oracle (T2/T13), §8.4 DoD
   (T11-T14); 17 cmd ids: align×4+indent×2 (T6.1), spinners×4 (T6.2), lineAndParagraphSpacing
   (T6.3), shading (T8.1-8.2), borders (T8.3), sort (T8.4-8.5), bullets/numbering (T6.1/T7.1),
   multilevelList (T7.2), launcher/dialog (T10), keyboard (T11.1b), flip (T11).
2. **Placeholder scan:** every step has code or an exact command; discovery steps (2.3
   enum iteration, 5.1 collision audit, 1.1 setDocs HTML fallback) name their authority
   and decision rule.
3. **Type consistency:** `PMA()` (commands.js:11) reused; `pm.cmd('updateAttributes',
   'paragraph', {dot.path})` shape consistent across T6.2/T6.3/T8.1/T8.3/T10;
   `sortParagraphs` defined T8.4 = called T8.5; `applyListDefinition({listType, levels})`
   defined T4 = called T7.1/T7.2; st fields `spacingBeforePt/spacingAfterPt/indentLeftIn/
   indentRightIn/lineSpacing` defined T9.1 = consumed T6.3/T10 and asserted in T1 tests.
