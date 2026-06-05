# Phase 2 — Slices 0a/0b/0c + Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the owned ProseMirror core the visible, in-charge editor (page flip +
`--legacy` fallback + `WC.PM` bridge + D6 guards + bytes file-IO + AppleScript oracle
harness), then flip the first feature area — character formatting — onto it.

**Architecture:** Spec `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`
(read it first — D1–D7 + §5–§8 are the contract). Three layers: vanilla-JS Word chrome →
typed `WC.PM` bridge (`src/renderer/bridge/`, the ONLY code touching the vendored
Editor) → vendored SuperDoc/PM engine. Legacy entry points are rewritten in place,
mode-aware. A mode-only integrity guard inside `editor.js` blocks ANY legacy mutation in
PM mode (D6).

**Tech stack:** Electron 31, electron-vite + TS (renderer), vendored SuperDoc fork
(`@core`/`@extensions` aliases), in-renderer probe harness (`--probe-out` +
`--shot-evalfile`), osascript (oracle).

**Branching:** slice 0a continues on `feature/phase-2-editing-core` (holds the spec/plan
docs) → PR to `main`. Slices 0b, 0c, 1 each branch off `main` after the previous merge:
`feature/phase-2-slice-0b`, `feature/phase-2-slice-0c`, `feature/phase-2-slice-1-character`.
Verify with `git branch --show-current` before any edit.

**The four gates** (run before every commit that touches app code; `npm run build` first):

```bash
npm run build
npx electron . --legacy --probe-out=/tmp/wc-legacy.json --shot-evalfile=scripts/test-suite.js --shot-delay=800   # 257 pass
npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js                              # PM suite (grows)
npx electron . --probe-out=/tmp/wc-smoke.json --shot-evalfile=scripts/smoke-pm.js                                # 9 pass
npx electron . --legacy --probe-out=/tmp/wc-smoke-legacy.json --shot-evalfile=scripts/smoke-pm.js                # 9 pass
node scripts/test_docx.js                                                                                        # 17 pass
```

Check results: `node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/wc-pm.json'));console.log(r.summary);r.results.filter(x=>!x.pass).forEach(x=>console.log('FAIL',x.name,x.detail))"`

---

## File structure (what gets created/modified)

| Path | Role |
|---|---|
| `src/renderer/bridge/mode.ts` (new) | synchronous boot-mode flag (`?legacy=1`) |
| `src/renderer/bridge/index.ts` (new) | assemble + expose `window.WC.PM`; pre-mount stub; failure un-flip; throttled blocked-toast |
| `src/renderer/bridge/commands.ts` (new) | `cmd()`/`chain()`/`captureSelection()`/`withSelection()`; slice 1 adds `changeCase()` |
| `src/renderer/bridge/state-sync.ts` (new) | `getActiveFormatting` → queryState-shaped map → `syncToggles`/`setComboValue`; rAF-coalesced |
| `src/renderer/bridge/focus.ts` (new) | capture-phase mousedown preventDefault (chrome + flyouts), with text-entry exemptions |
| `src/renderer/bridge/io.ts` (new) | `exportDocxBytes()`, dirty flag, `counts()`; 0b adds `openDocx()`/`newBlank()` |
| `src/renderer/bridge/create-editor.ts` (new, 0b) | factored editor construction (used by boot + openDocx) |
| `src/renderer/main.ts` (modify) | sync `pm-active` class, bridge install, failure path |
| `src/renderer/public/styles/editor.css` (modify) | `body.pm-active` flip rules |
| `src/renderer/public/js/editor.js` (modify) | D6 `pmGuard` at the mutation chokepoints |
| `src/renderer/public/js/ribbon.js` (modify) | styles-gallery hover preview disabled in PM mode |
| `src/renderer/public/js/dialogs.js` (modify) | findPane D6-block (0a); Font dialog PM branch (slice 1); wordCount counts source |
| `src/renderer/public/js/app.js` (modify) | boot focus mode-aware (0a); QAT undo/redo + Ctrl+Z/Y PM (slice 1) |
| `src/renderer/public/js/statusbar.js` (modify) | PM counts + "Page 1 of 1" (0a) |
| `src/renderer/public/js/files.js` (modify, 0b) | mode-aware save/saveAs/open/newDoc + isDirty/setClean accessors |
| `src/renderer/public/js/commands.js` (modify, slice 1) | character-formatting H handlers + helpers PM branches; launcher font fix |
| `src/main/main.js` (modify) | `--legacy` → `?legacy=1`; 0b: `doc:saveBytes/saveAsBytes/openBytes` |
| `src/main/preload.js` (modify, 0b) | `saveBytes`/`saveAsBytes`/`openBytes` |
| `src/renderer/core/generated/blank.docx.b64.ts` (new, 0b, generated) | blank-doc fixture for New Document |
| `src/renderer/core/fixture.ts` (modify, 0b) | `blankArrayBuffer()` |
| `scripts/test-suite-pm.js` (new) | the PM functional suite |
| `scripts/oracle/word-oracle.js` + `scripts/oracle/README.md` (new, 0c) | AppleScript oracle CLI |
| `package.json` (modify) | `test:*` aliases |

---

# Stage A — Slice 0a: app infrastructure

### Task 1: `--legacy` flag plumbing (main → renderer query)

**Files:** Modify: `src/main/main.js:116-120` · Create: `src/renderer/bridge/mode.ts`

- [ ] **Step 1.1: Confirm branch**

Run: `git branch --show-current` → Expected: `feature/phase-2-editing-core`

- [ ] **Step 1.2: Modify main.js window load** — replace lines 116–120:

```js
  // Phase 2 (spec §4.2): `electron . --legacy` boots the classic pre-PM app.
  // The renderer reads ?legacy=1 synchronously, so the page flip never flashes.
  const legacyBoot = process.argv.includes('--legacy');
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL + (legacyBoot ? '?legacy=1' : ''));
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '..', 'renderer', 'index.html'),
      legacyBoot ? { query: { legacy: '1' } } : undefined,
    );
  }
```

- [ ] **Step 1.3: Create `src/renderer/bridge/mode.ts`**

```ts
// Phase 2 boot mode (spec §4.2): PM-active by default; `electron . --legacy`
// (or ?legacy=1 under `electron-vite dev`) boots the classic app. Read
// synchronously at import time — main.ts flips the page before first paint.
export const legacyBoot = new URLSearchParams(window.location.search).get('legacy') === '1'
```

- [ ] **Step 1.4: Verify both modes reach the renderer**

```bash
npm run build
npx electron . --legacy --probe-out=/tmp/mode.json --shot-eval="location.search" --shot-delay=400
cat /tmp/mode.json    # Expected: ?legacy=1
npx electron . --probe-out=/tmp/mode2.json --shot-eval="location.search" --shot-delay=400
cat /tmp/mode2.json   # Expected: (empty string)
```

- [ ] **Step 1.5: Commit**

```bash
git add src/main/main.js src/renderer/bridge/mode.ts
git commit -m "feat(main): add --legacy boot flag forwarded to the renderer as ?legacy=1

What changed
- main.js passes ?legacy=1 (loadFile query / loadURL suffix) when --legacy is given.
- New src/renderer/bridge/mode.ts reads it synchronously at import time.

Why
- Phase 2 spec D1/§4.2: the PM core becomes the default visible editor; --legacy
  preserves the full classic app for the frozen 257-test feature-preservation gate."
```

### Task 2: PM functional suite skeleton + npm aliases (failing tests first)

**Files:** Create: `scripts/test-suite-pm.js` · Modify: `package.json`

- [ ] **Step 2.1: Create `scripts/test-suite-pm.js`**

```js
/* PM-world functional suite (Phase 2). Run:
   npm run build && npx electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js
   Sentinel-gated (NEVER --shot-delay-dependent). Same JSON contract as test-suite.js. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = async (name, fn) => {
    try { const r = await fn(); results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' }); }
    catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); }
  };
  for (let i = 0; i < 200 && !window.__WC_READY; i++) await sleep(50);

  const v = () => window.WC.view;
  const PM = () => window.WC.PM;
  const doc = () => v().state.doc;
  // Replace the whole body with `text` (one paragraph), UNMARKED — insertText
  // inherits the replaced range's marks, so strip them for deterministic tests.
  const setDoc = (text) => {
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.insertContent(text);
    window.WC.editor.commands.selectAll();
    window.WC.editor.commands.unsetAllMarks();
  };
  // Select the first occurrence of `needle`; returns {from,to}.
  const selectText = (needle) => {
    let found = null;
    doc().descendants((node, pos) => {
      if (found || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) found = { from: pos + i, to: pos + i + needle.length };
    });
    if (!found) throw new Error('text not found: ' + needle);
    v().dispatch(v().state.tr.setSelection(window.__PM_TextSelection.create(doc(), found.from, found.to)));
    return found;
  };
  // Marks on the first char of `needle` (after re-locating it).
  const markNames = (needle) => {
    let names = null;
    doc().descendants((node, pos) => {
      if (names || !node.isText || !node.text) return;
      const i = node.text.indexOf(needle);
      if (i >= 0) names = node.marks.map((m) => m.type.name + ':' + JSON.stringify(m.attrs));
    });
    return names || [];
  };

  // ---------- slice 0a: infrastructure ----------
  await t('[0a] PM mode active + body flipped', () =>
    !!PM() && PM().active === true && document.body.classList.contains('pm-active'));
  await t('[0a] legacy #editor hidden but laid out', () => {
    const ed = document.getElementById('editor'); const cs = getComputedStyle(ed);
    return cs.visibility === 'hidden' && cs.position === 'absolute' && ed.offsetHeight > 0;
  });
  await t('[0a] #pm-editor is the visible page', () => {
    const pe = document.getElementById('pm-editor');
    return !!pe && getComputedStyle(pe).visibility !== 'hidden' && pe.offsetWidth > 600;
  });
  await t('[0a] D6 guard: legacy exec is blocked, returns false, mutates nothing', () => {
    const ed = document.getElementById('editor'); const before = ed.innerHTML;
    const ok = window.WC.Editor.exec('bold');
    return ok === false && ed.innerHTML === before;
  });
  await t('[0a] D6 guard: legacy setHTML/applyBlockStyle blocked', () => {
    const ed = document.getElementById('editor'); const before = ed.innerHTML;
    window.WC.Editor.setHTML('<p>should not land</p>');
    window.WC.Editor.applyBlockStyle('marginLeft', '48px');
    return ed.innerHTML === before;
  });
  await t('[0a] D6 guard: legacy undo blocked', () => window.WC.Editor.undo() === false);
  await t('[0a] dirty flag tracks PM edits', async () => {
    const d0 = PM().isDirty();
    v().dispatch(v().state.tr.insertText('x', 1));
    await sleep(60);
    return d0 === false && PM().isDirty() === true && document.title.startsWith('•');
  });
  await t('[0a] WC.PM.cmd dispatches an engine command', () => {
    setDoc('hello bridge world'); selectText('bridge');
    return PM().cmd('toggleBold') === true;
  });
  await t('[0a] state-sync: bold lights the ribbon toggle', async () => {
    await sleep(150); // rAF-coalesced sync
    const btn = document.querySelector('.rbtn[data-cmd="bold"]');
    return !!btn && btn.classList.contains('toggled');
  });
  await t('[0a] state-sync: caret outside bold clears the toggle', async () => {
    selectText('world'); await sleep(150);
    const btn = document.querySelector('.rbtn[data-cmd="bold"]');
    return !!btn && !btn.classList.contains('toggled');
  });
  await t('[0a] font combo reflects caret formatting', async () => {
    selectText('hello'); PM().cmd('setFontFamily', 'Georgia'); await sleep(150);
    const ent = window.WC.Ribbon.controlIndex.font;
    return !!ent && /Georgia/.test(ent.input.value);
  });
  await t('[0a] statusbar word count reads the PM doc', () => {
    setDoc('one two three four five');
    window.WC.StatusBar.update();
    return /5 words/.test(document.querySelector('#statusbar .sb-item:nth-child(2)').textContent);
  });
  await t('[0a] page indicator honest: Page 1 of 1', () =>
    /Page 1 of 1/.test(document.querySelector('#statusbar .sb-item').textContent));
  await t('[0a] focus guard: tabstrip mousedown is defaultPrevented', () => {
    // dispatchEvent returns false iff preventDefault was called — red until the
    // focus.ts capture handler lands, green after. (Synthetic events never move
    // focus, so asserting activeElement here would be vacuous.)
    const tab = document.querySelector('.ribbon-tab[data-tab="insert"]');
    return tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })) === false;
  });
  await t('[0a] invariants: telemetry off, WC intact', () =>
    (window.__NET_LOG || []).length === 0 && !!window.WC.Editor && !!window.WC.Ribbon);

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass }, results }, null, 2);
})()
```

- [ ] **Step 2.2: Add npm aliases** to `package.json` `"scripts"` (after `"start"`):

```json
    "test:legacy": "electron . --legacy --probe-out=/tmp/wc-legacy.json --shot-evalfile=scripts/test-suite.js --shot-delay=800",
    "test:pm": "electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js",
    "test:smoke": "electron . --probe-out=/tmp/wc-smoke.json --shot-evalfile=scripts/smoke-pm.js",
    "test:smoke:legacy": "electron . --legacy --probe-out=/tmp/wc-smoke-legacy.json --shot-evalfile=scripts/smoke-pm.js",
    "test:docx": "node scripts/test_docx.js"
```

(Each needs `npm run build` first — same convention as CLAUDE.md.)

- [ ] **Step 2.3: Run the PM suite — expect FAILURES** (red phase)

```bash
npm run build && npm run test:pm
node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/wc-pm.json'));console.log(r.summary)"
```
Expected: most `[0a]` tests FAIL (no `pm-active` class, no `WC.PM`, no guards yet).

- [ ] **Step 2.4: Commit**

```bash
git add scripts/test-suite-pm.js package.json
git commit -m "test: add PM functional suite skeleton + test:* npm aliases (red)

What changed
- scripts/test-suite-pm.js: sentinel-gated PM-world suite (15 slice-0a infra tests,
  intentionally failing until the bridge lands) with setDoc/selectText/markNames helpers.
- package.json: test:legacy / test:pm / test:smoke / test:smoke:legacy / test:docx aliases
  (test:legacy keeps the validated --shot-delay=800).

Why
- Phase 2 spec D2/§8.1: the legacy 257 stays frozen under --legacy while PM coverage
  grows in its own suite; TDD red phase for slice 0a."
```

### Task 3: bridge core + page flip + failure fallback

**Files:** Create: `src/renderer/bridge/index.ts`, `src/renderer/bridge/commands.ts`, `src/renderer/bridge/io.ts` · Modify: `src/renderer/main.ts`, `src/renderer/public/styles/editor.css`

- [ ] **Step 3.1: Create `src/renderer/bridge/commands.ts`**

```ts
// Command side of the WC.PM bridge (spec §5.1). The ONLY caller of
// editor.commands/chain in the app. editor.commands is a GETTER capturing a
// fresh tr per access — resolve at call time, never cache (CommandService.js:57-81).
type AnyEditor = any

export function installCommands(editor: AnyEditor) {
  function cmd(name: string, ...args: unknown[]): boolean {
    const c = editor.commands
    const fn = c && c[name]
    if (typeof fn !== 'function') { console.debug('[WC.PM] unknown command:', name); return false }
    const ok = fn(...args)
    editor.view?.focus() // primary focus invariant (spec §7.4)
    return ok !== false
  }

  // steps: Array<[commandName, ...args]> — ONE transaction = ONE undo step (Word fidelity).
  function chain(steps: Array<[string, ...unknown[]]>): boolean {
    let ch = editor.chain()
    for (const [name, ...args] of steps) {
      if (typeof ch[name] !== 'function') { console.debug('[WC.PM] unknown chain step:', name); return false }
      ch = ch[name](...args)
    }
    const ok = ch.run()
    editor.view?.focus()
    return ok !== false
  }

  // Dialog/combo selection round-trip. Keeps its OWN copy — the engine nulls
  // options.lastSelection on undo/redo (history.js:9-39).
  let savedSel: { from: number; to: number } | null = null
  function captureSelection() {
    const { from, to } = editor.state.selection
    savedSel = { from, to }
  }
  function withSelection(fn: () => void) {
    if (savedSel) {
      const size = editor.state.doc.content.size
      editor.commands.setTextSelection({ from: Math.min(savedSel.from, size), to: Math.min(savedSel.to, size) })
    }
    fn()
    savedSel = null
    editor.view?.focus()
  }

  return { cmd, chain, captureSelection, withSelection }
}
```

(If `setTextSelection`'s signature differs — it lives in
`src/renderer/core/superdoc-fork/core/commands/setTextSelection.js` — read that file and
match it; the `[0a]` combo test exercises this path.)

- [ ] **Step 3.2: Create `src/renderer/bridge/io.ts`**

```ts
// IO side of the bridge (spec §5.1 io.ts): export wrapper that un-swallows the
// engine's error contract, the dirty flag, and PM-doc counts for the chrome.
type AnyEditor = any

export function installIo(editor: AnyEditor) {
  const w = window as any
  let dirty = false
  editor.on('update', () => { dirty = true; w.WC?.Files?.updateTitle?.() }) // 'update' fires only on docChanged

  async function exportDocxBytes(): Promise<Uint8Array> {
    const blob = await editor.exportDocx()
    // Editor.ts:4049-4053 catches everything and resolves undefined — re-throw.
    if (!blob) throw new Error('Export failed — the engine reported an exception')
    return new Uint8Array(await blob.arrayBuffer())
  }

  function counts() {
    const text: string = editor.view?.dom?.innerText || ''
    const words = (text.match(/\S+/g) || []).length
    const chars = text.replace(/\n/g, '').length
    const sel = editor.state.selection
    const selWords = sel.empty
      ? 0
      : ((editor.state.doc.textBetween(sel.from, sel.to, ' ') as string).match(/\S+/g) || []).length
    return { words, chars, selWords }
  }

  return {
    isDirty: () => dirty,
    setClean: () => { dirty = false; w.WC?.Files?.updateTitle?.() },
    exportDocxBytes,
    counts,
  }
}
```

- [ ] **Step 3.3: Create `src/renderer/bridge/index.ts`**

```ts
// WC.PM — the bridge between the vanilla-JS Word chrome and the vendored
// ProseMirror engine (spec §4/§5). Grafted onto the existing WC namespace;
// NEVER reassign window.WC or window.WC.Editor (main.ts invariant).
import { legacyBoot } from './mode'
import { installCommands } from './commands'
import { installIo } from './io'
import { installStateSync } from './state-sync'
import { installFocusGuards } from './focus'
import { getActiveFormatting } from '@core/helpers/getActiveFormatting.js'
import { toQueryState } from './state-sync'

type AnyEditor = any
let current: AnyEditor = null

// ---- D6 registry (spec §5.1/§7.1a): cmd-id → area, + the flipped-area set. ----
// Doc-touching cmd ids ONLY — app-level cmds are absent (= never blocked here).
// Keys = the §9.1 area names. Each slice's flip edits FLIPPED in source (auditable).
const FLIPPED = new Set<string>([]) // slice 1 makes this ['character', 'history']
const AREA: Record<string, string> = {
  // character (slice 1)
  bold: 'character', italic: 'character', underline: 'character', strikethrough: 'character',
  subscript: 'character', superscript: 'character', clearAllFormatting: 'character',
  increaseFontSize: 'character', decreaseFontSize: 'character', font: 'character',
  fontSize: 'character', textHighlightColor: 'character', fontColor: 'character',
  changeCase: 'character', textEffectsAndTypography: 'character',
  // clipboard (slice 4)
  cut: 'clipboard', copy: 'clipboard', paste: 'clipboard',
  formatPainter: 'clipboard', formatPainterLock: 'clipboard',
  // paragraph (slice 2)
  alignLeft: 'paragraph', center: 'paragraph', alignRight: 'paragraph', justify: 'paragraph',
  decreaseIndent: 'paragraph', increaseIndent: 'paragraph', sort: 'paragraph',
  lineAndParagraphSpacing: 'paragraph', shading: 'paragraph', borders: 'paragraph',
  indentLeft: 'paragraph', indentRight: 'paragraph', spacingBefore: 'paragraph', spacingAfter: 'paragraph',
  // lists (slice 2)
  bullets: 'lists', numbering: 'lists', multilevelList: 'lists',
  // styles (slice 3)
  stylesGallery: 'styles',
  // editing/find (slice 5)
  find: 'find-replace', replace: 'find-replace', select: 'find-replace',
  // insert basics (slice 6)
  table: 'insert-basics', link: 'insert-basics', bookmark: 'insert-basics', pageBreak: 'insert-basics',
  blankPage: 'insert-basics', symbol: 'insert-basics', equation: 'insert-basics',
  horizontalLine: 'insert-basics', pictures: 'insert-basics', onlinePictures: 'insert-basics',
  screenshot: 'insert-basics', icons: 'insert-basics', smartart: 'insert-basics', chart: 'insert-basics',
  onlineVideo: 'insert-basics', dropCap: 'insert-basics', wordart: 'insert-basics', textBox: 'insert-basics',
  object: 'insert-basics', signatureLine: 'insert-basics', dateTime: 'insert-basics',
  coverPage: 'insert-basics', quickParts: 'insert-basics', crossReference: 'insert-basics',
  // review (slice 8)
  newComment: 'review', comment: 'review', delete: 'review', previous: 'review', next: 'review',
  showComments: 'review', trackChanges: 'review', accept: 'review', reject: 'review',
  thesaurus: 'review', language: 'review',
  // references (slice 9)
  tableOfContents: 'references', addText: 'references', updateTable: 'references',
  insertFootnote: 'references', insertEndnote: 'references', nextFootnote: 'references',
  showNotes: 'references', insertCitation: 'references', manageSources: 'references',
  style: 'references', bibliography: 'references', insertCaption: 'references',
  insertTableOfFigures: 'references', markEntry: 'references', insertIndex: 'references',
  updateIndex: 'references', markCitation: 'references', insertTableOfAuthorities: 'references',
  // mail merge (slice 10)
  envelopes: 'mail-merge', labels: 'mail-merge', startMailMerge: 'mail-merge',
  selectRecipients: 'mail-merge', editRecipientList: 'mail-merge', highlightMergeFields: 'mail-merge',
  addressBlock: 'mail-merge', greetingLine: 'mail-merge', insertMergeField: 'mail-merge',
  rules: 'mail-merge', matchFields: 'mail-merge', updateLabels: 'mail-merge',
  finishMerge: 'mail-merge',
  // draw (slice 10)
  drawing: 'draw', eraser: 'draw', pensGallery: 'draw', addPen: 'draw',
  drawingCanvas: 'draw', inkReplay: 'draw', selectObjects: 'draw', lassoSelect: 'draw',
  // design/themes (slice 10)
  themes: 'themes', styleSet: 'themes', colors: 'themes', fonts: 'themes',
  paragraphSpacing: 'themes', effects: 'themes', setAsDefault: 'themes',
  watermark: 'themes', pageColor: 'themes', pageColor2: 'themes', pageBorders: 'themes',
  // layout page-setup (pagination-gated, Phase 7) + arrange (slice 10)
  margins: 'layout-page', orientation: 'layout-page', size: 'layout-page', columns: 'layout-page',
  breaks: 'layout-page', lineNumbers: 'layout-page', hyphenation: 'layout-page',
  position: 'layout-arrange', wrapText: 'layout-arrange', bringForward: 'layout-arrange',
  sendBackward: 'layout-arrange', selectionPane: 'layout-arrange', align: 'layout-arrange',
  group: 'layout-arrange', rotate: 'layout-arrange',
  // header/footer (pagination-gated, Phase 7)
  header: 'header-footer', footer: 'header-footer', pageNumber: 'header-footer',
  goToHeader: 'header-footer', goToFooter: 'header-footer', closeHeaderFooter: 'header-footer',
  docInfo: 'header-footer', differentFirstPage: 'header-footer', differentOddEven: 'header-footer',
  showDocText: 'header-footer', dateAndTime: 'header-footer', linkToPrevious: 'header-footer',
}
function isFlipped(area: string) { return FLIPPED.has(area) }
function isBlocked(cmd: string) { const a = AREA[cmd]; return !!a && !FLIPPED.has(a) }

let lastToast = 0
function notifyBlocked(what: string) {
  const now = performance.now()
  if (now - lastToast < 1500) return // throttle: leaf-closure paths can fire bursts
  lastToast = now
  const w = window as any
  w.WC?.toast?.("This action isn't on the new engine yet", what + ' — run with --legacy for the classic editor')
}

// Synchronous, pre-mount (spec §4.2): the D6 guards consult WC.PM.active before
// the async mount resolves, and the page must flip before first paint.
export function preinstallBridge() {
  const w = window as any
  w.WC = w.WC || {}
  w.WC.PM = {
    active: !legacyBoot,
    ready: false,
    notifyBlocked,
    isBlocked,   // D6 §7.1a — consulted by the WC.Commands dispatch heads (Task 4B)
    isFlipped,
    AREA, FLIPPED, // exposed for tests/audit
    cmd: () => false,
    chain: () => false,
    getState: () => null,
    isDirty: () => false,
    setClean: () => {},
    counts: () => ({ words: 0, chars: 0, selWords: 0 }),
    captureSelection: () => {},
    withSelection: (fn: () => void) => fn(),
  }
  if (!legacyBoot) document.body.classList.add('pm-active')
}

export function installBridge(editor: AnyEditor) {
  const w = window as any
  current = editor
  const PM = w.WC.PM
  if (legacyBoot) { PM.ready = true; return PM } // §4.3-3: passive under --legacy — zero listeners
  Object.assign(PM, installCommands(editor), installIo(editor))
  PM.getState = () => toQueryState(editor)
  PM.debugFormatting = () => getActiveFormatting(editor) // raw entries (probe/verifier aid)
  PM.getEditor = () => current
  installStateSync(editor)
  installFocusGuards()
  PM.ready = true
  editor.view?.focus() // PM page owns the caret from boot (replaces legacy boot focus)
  return PM
}

// Mount failure (spec §7.2): un-flip BEFORE toasting — never a blank page.
export function failBridge(err: unknown) {
  const w = window as any
  document.body.classList.remove('pm-active')
  if (w.WC?.PM) w.WC.PM.active = false
  w.WC?.toast?.('New engine failed to start — using the classic editor', String((err as any)?.message || err))
  w.WC?.Editor?.focus?.()
}
```

- [ ] **Step 3.4: Create placeholder-free stubs for the two files index.ts imports**
(real implementations land in Tasks 4–6; these keep the build green NOW):

`src/renderer/bridge/state-sync.ts`:
```ts
// Filled in by the state-sync task — see plan Task 5.
export function toQueryState(_editor: any): Record<string, unknown> {
  return {}
}
export function installStateSync(_editor: any) {}
```

`src/renderer/bridge/focus.ts`:
```ts
// Filled in by the focus-discipline task — see plan Task 6.
export function installFocusGuards() {}
```

- [ ] **Step 3.5: Rewrite `src/renderer/main.ts`** — full new content:

```ts
// Path B: construct the VENDORED SuperDoc Editor, which owns the ProseMirror view.
// Phase 2: the PM core is the ACTIVE editor by default (spec D1); --legacy boots
// the classic app. The WC.PM bridge (src/renderer/bridge/) is the only code that
// talks to the engine.
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'
import { TextSelection } from '@/pm'
import { fixtureArrayBuffer } from '@/core/fixture'
import { preinstallBridge, installBridge, failBridge } from '@/bridge'

const w = window as any
w.__PM_TextSelection = TextSelection

// SYNCHRONOUS (before the async mount): mode flag + page flip + D6 stub.
preinstallBridge()

const host = document.getElementById('pages') || document.body
const mountEl = document.createElement('div')
mountEl.id = 'pm-editor' // page look: vendored print-layout inline styles + editor.css pm-active rules
host.appendChild(mountEl)

;(async () => {
  try {
    // loadXmlData returns [docx, media, mediaFiles, fonts, decrypted]; seed content + media + fonts.
    const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(fixtureArrayBuffer())

    // Legacy (content-seeded) mode does NOT auto-load starter extensions — pass them
    // explicitly or the schema has no 'doc' top node.
    const editor = new (Editor as any)({
      element: mountEl,
      mode: 'docx',
      content: docx,
      mediaFiles,
      fonts,
      extensions: getStarterExtensions(),
      user: { name: 'local', email: '' },
      isDebug: false,
      telemetry: { enabled: false },
    })

    if (!w.WC) w.WC = {} // legacy scripts already built window.WC — never reassign it or window.WC.Editor
    w.WC.view = editor.view // plain PM EditorView — smoke checks .dispatch + .dom.isContentEditable
    w.WC.editor = editor

    // Logger seam (Phase 3 wraps/replaces this). The Editor re-emits every PM transaction.
    editor.on?.('transaction', () => {
      ;(w.WC.pm ??= {}).lastTxn = Date.now()
    })

    installBridge(editor)
    w.WC.PM.setClean?.() // load-time transactions must never count as user edits

    w.__WC_READY = true // LAST statement after mount — the probe suites gate on this
  } catch (e: any) {
    w.__WC_ERROR = (e && (e.stack || e.message)) || String(e)
    console.error('[main] editor init failed:', e)
    failBridge(e)
    w.__WC_READY = true // suites still gate on readiness; [0a] tests then fail loudly
  }
})()
```

- [ ] **Step 3.6: Append the flip CSS** to `src/renderer/public/styles/editor.css` (end of file):

```css
/* ===== Phase 2 two-worlds flip (spec §5.2) — gated under body.pm-active so
   --legacy renders byte-identically to the classic app. ===== */
/* Legacy editor: absolute (out of the #pages flex flow — no blank gap) +
   visibility:hidden (layout boxes preserved for the legacy bootstrap; no paint,
   no hit-testing). NEVER an off-screen left offset: #pages carries the zoom
   scale() transform, which scales offsets back into view at low zoom. */
body.pm-active #editor {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
}
/* The PM page: white sheet + shadow (geometry/margins come from the vendored
   renderer's print-layout inline styles, derived from the .docx). */
body.pm-active #pm-editor {
  background: var(--page);
  box-shadow: 0 1px 4px var(--page-shadow);
}
body.pm-active #pm-editor .ProseMirror:focus { outline: none; }
```

- [ ] **Step 3.7: Build + run both modes, visual check**

```bash
npm run build
npx electron . --shot=/tmp/pm-mode.png --shot-delay=1500
npx electron . --legacy --shot=/tmp/legacy-mode.png --shot-delay=1500
```
Open both PNGs. Expected: PM mode shows ONE page (the imported fixture list) with the
full Word chrome; legacy mode is pixel-identical to the pre-Phase-2 app.

- [ ] **Step 3.8: Run suites** — `npm run test:pm` flip tests `[0a] PM mode active`,
`legacy #editor hidden`, `#pm-editor visible` now PASS (guards/sync/focus tests still
red). `npm run test:smoke` and `npm run test:smoke:legacy` → 9/9 both.

- [ ] **Step 3.9: Commit**

```bash
git add src/renderer/bridge/ src/renderer/main.ts src/renderer/public/styles/editor.css
git commit -m "feat(editor): flip #pm-editor to the visible page behind WC.PM bridge core

What changed
- New src/renderer/bridge/: mode-aware WC.PM (preinstall stub -> installBridge),
  commands.ts cmd/chain/withSelection (per-access editor.commands, re-focus invariant),
  io.ts (exportDocxBytes un-swallows engine errors, dirty flag, counts), stubs for
  state-sync/focus (next tasks).
- main.ts: synchronous pm-active flip + bridge install + failBridge un-flip fallback.
- editor.css: body.pm-active rules — legacy #editor absolute+visibility:hidden
  (layout preserved, zoom-transform-safe), #pm-editor gets the page sheet look.

Why
- Phase 2 spec D1/D5/§5.2/§7.2: PM core becomes THE page from slice 0a, with the
  classic app intact under --legacy and a never-blank failure path."
```

### Task 4: D6 integrity guard at the legacy mutation chokepoints

**Files:** Modify: `src/renderer/public/js/editor.js`, `src/renderer/public/js/ribbon.js:16-28`, `src/renderer/public/js/dialogs.js` (findPane head), `src/renderer/public/js/app.js:152`

- [ ] **Step 4.1: Add the guard helper** in `editor.js` immediately after `const el = WC.el;` (line 6):

```js
  // Phase 2 (spec D6/§7.1b): when the PM core is ACTIVE the legacy editor is
  // hidden — any legacy mutation reaching it is an unflipped feature path.
  // No-op + throttled toast instead of silently editing a document Save will
  // never export. Under --legacy (WC.PM.active=false) this passes through.
  function pmGuard(what) {
    const PM = window.WC && window.WC.PM;
    if (!PM || !PM.active) return false;
    if (PM.notifyBlocked) PM.notifyBlocked(what);
    return true;
  }
```

- [ ] **Step 4.2: Guard every mutation chokepoint** — add as the FIRST line of each method:

| Method (editor.js line) | Guard line |
|---|---|
| `exec(cmd, value)` (:86) | `if (pmGuard('exec ' + cmd)) return false;` |
| `insertNodeHTML(html)` (:105) | `if (pmGuard('insertNodeHTML')) return;` |
| `applyInlineStyle(prop, value)` (:117) | `if (pmGuard('applyInlineStyle ' + prop)) return;` |
| `applyInlineStyles(styles)` (:141) | `if (pmGuard('applyInlineStyles')) return;` |
| `demoteListItem()` (:179) | `if (pmGuard('demoteListItem')) return;` |
| `promoteListItem()` (:193) | `if (pmGuard('promoteListItem')) return;` |
| `setListLevel(n)` (:225) | `if (pmGuard('setListLevel')) return;` |
| `applyMultilevelPattern(key)` (:236) | `if (pmGuard('applyMultilevelPattern')) return;` |
| `applyBlockStyle(prop, value)` (:250) | `if (pmGuard('applyBlockStyle ' + prop)) return;` |
| `setHTML(html)` (:596) | `if (pmGuard('setHTML')) return;` |
| `undo()` (:625) | `if (pmGuard('undo')) return false;` |
| `redo()` (:634) | `if (pmGuard('redo')) return false;` |

(`insertHTML` routes through `exec` — covered. `repaginate`/`emit`/`queryState` stay
unguarded: read-only or layout-internal.)

- [ ] **Step 4.3: Disable the styles-gallery hover live-preview in PM mode** — `ribbon.js:16`:

```js
  function stylePreviewEnter(name) {
    if (window.WC.PM && window.WC.PM.active) return; // PM mode: gallery preview lands in slice 3
    if (!E() || !E().node) return;
```

- [ ] **Step 4.4: D6-block the find pane (raw-DOM mutator)** — first line of `D.findPane`
(dialogs.js:100):

**Keep the existing signature** (`function (replace)` — dialogs.js:100; its body reads
`replace` at :109/:121 and the frozen suite drives `findPane(true)` at test-suite.js:59-60).
Insert ONLY the guard as the new first statement:

```js
  D.findPane = function (replace) {
    // PM mode: legacy find/replace rewrites #editor text nodes (raw DOM —
    // bypasses the editor.js chokepoints). Blocked until slice 5 (fork Search ext).
    if (window.WC.PM && window.WC.PM.active) { window.WC.PM.notifyBlocked('Find & Replace'); return; }
    /* ...existing body unchanged... */
```

- [ ] **Step 4.5: Boot focus mode-aware** — `app.js:152`, replace `WC.Editor.focus();` with:

```js
    if (!(WC.PM && WC.PM.active)) WC.Editor.focus(); // PM mode: bridge focuses the PM view post-mount
```

- [ ] **Step 4.6: Raw-DOM mutation audit (deliverable, spec §7.1).** Run:

```bash
grep -n "E()\.node\." src/renderer/public/js/*.js | grep -v "querySelector\|contains\|getBoundingClientRect\|innerText\|classList.contains\|scroll" | head -40
```
Write the per-site block/defer table into `docs/superpowers/plans/notes/2026-06-05-d6-raw-dom-audit.md`
(one row per hit: file:line · what it mutates · disposition: `chokepoint-covered` /
`blocked-by-flipped-area-slice-N` / `harmless-readonly`). Sites already known to need rows:
`changeCase` (commands.js:1055, slice 1 rewires), format-painter `armPainterFromSelection`
(commands.js:956+, slice 4), track-changes DOM (review-tools.js:50-74, slice 8), draw ink
layer (draw-tools.js, slice 10), `pageColor` `E().node.style` (commands.js:1024, blocked via
applyColor PM branch in slice 1), styles-gallery preview (handled in 4.3).

- [ ] **Step 4.7: Run gates.** `npm run build && npm run test:pm` → the three `[0a] D6 guard`
tests PASS. `npm run test:legacy` → **257 pass / 0 fail** (guards are inert under the flag).
`npm run test:smoke` + `test:smoke:legacy` → 9/9.

- [ ] **Step 4.8: Commit**

```bash
git add src/renderer/public/js/editor.js src/renderer/public/js/ribbon.js \
        src/renderer/public/js/dialogs.js src/renderer/public/js/app.js \
        docs/superpowers/plans/notes/2026-06-05-d6-raw-dom-audit.md
git commit -m "feat(editor): D6 integrity guard blocks legacy mutations in PM mode

What changed
- editor.js pmGuard() on all 12 mutation chokepoints (exec/insertNodeHTML/
  applyInlineStyle(s)/applyBlockStyle/list ops/setHTML/undo/redo) — no-op +
  throttled toast when WC.PM.active.
- ribbon.js styles-gallery hover preview and dialogs.js findPane blocked in PM
  mode (raw-DOM mutators outside the chokepoints).
- app.js boot focus is mode-aware.
- Raw-DOM mutation audit table (plans/notes/).

Why
- Spec D6/§7.1: an unflipped command silently editing the hidden legacy doc means
  Save (PM export) drops 'applied' edits — block loudly instead.
Tests: 257 legacy + 9 smoke x2 green; PM suite D6 tests green."
```

### Task 4B: D6 courtesy block at dispatch + D6-aware shortcuts (spec §7.1a, §6.C)

**Files:** Modify: `src/renderer/public/js/commands.js` (the 7 dispatch heads:
run :788, dropdown :797, comboCommit :889, comboDropdown :893, applyStyle :899,
spinner :902, launcher :912), `src/renderer/public/js/app.js:62-91`,
`scripts/test-suite-pm.js`

- [ ] **Step 4B.1: Guard the dispatch heads.** The chokepoint guard (Task 4) is the
integrity backstop; this layer toasts BEFORE any dialog/flyout opens. Add as the first
statement of each method (after the existing `WC.closeFlyouts()` lines where present):

```js
    // run(), dropdown():
    if (WC.PM && WC.PM.active && WC.PM.isBlocked(control.cmd)) { WC.PM.notifyBlocked(control.label || control.cmd); return; }
    // comboCommit(c, value), comboDropdown(c, ...):  (font/fontSize → 'character')
    if (WC.PM && WC.PM.active && WC.PM.isBlocked(c.cmd === 'font' || c.cmd === 'fontSize' ? 'font' : c.cmd)) { WC.PM.withSelection(() => WC.PM.notifyBlocked(c.cmd)); return; }
    // spinner(cmd, value):
    if (WC.PM && WC.PM.active && WC.PM.isBlocked(cmd)) { WC.PM.notifyBlocked(cmd); return; }
    // applyStyle(name):
    if (WC.PM && WC.PM.active && WC.PM.isBlocked('stylesGallery')) { WC.PM.notifyBlocked('Styles'); return; }
    // launcher(groupId, ...): map group → representative cmd:
    if (WC.PM && WC.PM.active) {
      const LAUNCHER_AREA_CMD = { font: 'font', paragraph: 'alignLeft', styles: 'stylesGallery' }; // clipboard pane = app-level, allowed
      const probe = LAUNCHER_AREA_CMD[groupId];
      if (probe && WC.PM.isBlocked(probe)) { WC.PM.notifyBlocked(groupId + ' settings'); return; }
    }
```

- [ ] **Step 4B.2: D6-aware keydown map (whole map, slice 0a — spec §6.C).** In `app.js`,
add after `const E = () => WC.Editor;` (line 7):

```js
  // D6 (spec §6.C): doc-touching shortcuts of UNFLIPPED areas block+toast in PM
  // mode, exactly like their ribbon commands. App-level shortcuts pass through.
  const pmBlockedOr = (area, fn) => () => {
    if (WC.PM && WC.PM.active && !WC.PM.isFlipped(area)) { WC.PM.notifyBlocked('Keyboard shortcut'); return; }
    fn();
  };
```

Wrap the doc-touching entries in `map()` (app.js:62-91):

```js
        if (k === 'z' && !shift) return pmBlockedOr('history', () => E().undo());
        if ((k === 'z' && shift) || (k === 'y' && !shift)) return pmBlockedOr('history', () => E().redo());
        if (k === 'enter' && !shift) return pmBlockedOr('insert-basics', () => WC.Commands.run({ cmd: 'pageBreak', label: 'Page Break' }));
        if (k === 'l' && !shift) return pmBlockedOr('paragraph', () => E().exec('justifyLeft'));
        if (k === 'e' && !shift) return pmBlockedOr('paragraph', () => E().exec('justifyCenter'));
        if (k === 'r' && !shift) return pmBlockedOr('paragraph', () => E().exec('justifyRight'));
        if (k === 'j' && !shift) return pmBlockedOr('paragraph', () => E().exec('justifyFull'));
        if (k === 'l' && shift) return pmBlockedOr('lists', () => E().exec('insertUnorderedList'));
        if (k === 'd' && !shift) return pmBlockedOr('character', () => WC.Dialogs.font());
        if (shift && (k === '.' || k === '>')) return pmBlockedOr('character', () => incFont(1));
        if (shift && (k === ',' || k === '<')) return pmBlockedOr('character', () => incFont(-1));
        if (k === ']') return pmBlockedOr('character', () => incFont(1));
        if (k === '[') return pmBlockedOr('character', () => incFont(-1));
        if (shift && k === 'n') return pmBlockedOr('styles', () => WC.applyNamedStyle('Normal'));
        if (e.altKey && k === '1') return pmBlockedOr('styles', () => WC.applyNamedStyle('Heading 1'));
        if (e.altKey && k === '2') return pmBlockedOr('styles', () => WC.applyNamedStyle('Heading 2'));
        if (e.altKey && k === '3') return pmBlockedOr('styles', () => WC.applyNamedStyle('Heading 3'));
```
(`s/o/n/p/f/h/k/=/-/0` entries stay as-is: app-level, or already D6-handled inside their
target — findPane is blocked in Task 4.4, insertLink's OK lands on a guarded chokepoint;
Ctrl+K/F/H courtesy-block via `find-replace`/`insert-basics` is optional polish.)
QAT undo/redo (app.js:20-21) get the same wrap:

```js
    qat.appendChild(qbtn('save', 'Save (Ctrl+S)', () => WC.Files.save()));
    qat.appendChild(qbtn('undo', 'Undo (Ctrl+Z)', pmBlockedOr('history', () => E().exec('undo'))));
    qat.appendChild(qbtn('redo', 'Redo (Ctrl+Y)', pmBlockedOr('history', () => E().exec('redo'))));
```
(Slice 1 Task 18 then rewrites the `history` entries to `WC.PM.cmd('undo'/'redo')` and
flips the area.)

- [ ] **Step 4B.3: PM-suite tests** (append to the `[0a]` block in `scripts/test-suite-pm.js`):

```js
  await t('[0a] D6 dispatch block: unflipped cmd toasts before opening UI', () => {
    window.WC.Commands.run({ cmd: 'bullets', label: 'Bullets' });
    return document.querySelectorAll('.flyout').length === 0; // no flyout, no throw
  });
  await t('[0a] D6 dispatch block: unflipped dropdown does not open', () => {
    window.WC.Commands.dropdown({ cmd: 'bullets', type: 'dropdown' }, document.body);
    const open = document.querySelectorAll('.flyout').length;
    window.WC.closeFlyouts();
    return open === 0;
  });
```

- [ ] **Step 4B.4: Run gates.** PM suite: the two new tests PASS; `npm run test:legacy`
→ 257 (all guards check `WC.PM.active` first). Commit:

```bash
git add src/renderer/public/js/commands.js src/renderer/public/js/app.js scripts/test-suite-pm.js
git commit -m "feat(commands): D6 courtesy block — unflipped commands toast at dispatch, shortcuts D6-aware

What changed
- The 7 WC.Commands dispatch heads consult WC.PM.isBlocked(cmd) (AREA registry in the
  bridge) and toast BEFORE opening dialogs/flyouts.
- app.js: whole keydown map + QAT undo/redo routed through pmBlockedOr(area, fn) in 0a.
- 2 PM-suite tests.

Why
- Spec D6/§7.1a/§6.C: the chokepoint guard alone lets users open a dialog and only fail
  at OK; blocking at dispatch is the intended UX, and the registry is the audit surface."
```

### Task 5: state-sync (engine → ribbon)

**Files:** Modify: `src/renderer/bridge/state-sync.ts` (replace stub), `src/renderer/public/js/statusbar.js:59-66`

- [ ] **Step 5.1: Discovery probe** — confirm the exact entry names `getActiveFormatting`
emits for the fixture + the paragraph attrs shape:

```bash
npm run build && npx electron . --probe-out=/tmp/fmt.json --shot-eval="(async()=>{for(let i=0;i<100&&!window.__WC_READY;i++)await new Promise(r=>setTimeout(r,50));const e=window.WC.editor;e.commands.selectAll();return JSON.stringify({entries:window.WC.PM.debugFormatting(),para:e.getAttributes('paragraph')},null,2)})()"
cat /tmp/fmt.json
```
Read the output. Expected entry names include `fontFamily`/`fontSize`/`color` (unwrapped
textStyle) and mark names `bold`/`italic`/`underline`/`strike` where present; paragraph
attrs carry justification under `paragraphProperties` and the list/numbering attrs the
smoke test greps (`numId`/`listLevel`-ish). **Adjust the switch cases in Step 5.2 to the
observed names before proceeding** — the mapping below is the expected shape, the probe is
the authority.

- [ ] **Step 5.2: Replace `src/renderer/bridge/state-sync.ts`**

```ts
// Engine → ribbon state sync (spec §5.1/§6.B). Maps getActiveFormatting()'s
// ActiveFormattingEntry[] + paragraph attrs onto the legacy queryState() shape
// that WC.Ribbon.syncToggles/TOGGLE_MAP consume (ribbon.js:46-51, 327-333).
// Negation-attr-safe: Word marks explicit-off as e.g. bold {value:'0'}.
import { getActiveFormatting } from '@core/helpers/getActiveFormatting.js'

type AnyEditor = any

export function toQueryState(editor: AnyEditor): Record<string, any> {
  const st: Record<string, any> = {
    bold: false, italic: false, underline: false, strikethrough: false,
    subscript: false, superscript: false,
    justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertUnorderedList: false, insertOrderedList: false,
    fontName: '', fontSize: '', block: '',
    computedFontFamily: '', computedFontSizePt: null, // Font-dialog aliases (dialogs.js:347-349)
  }
  let entries: Array<{ name: string; attrs: any }> = []
  try { entries = getActiveFormatting(editor) || [] } catch { /* selection the helper can't read */ }
  for (const e of entries) {
    const a = e.attrs || {}
    switch (e.name) {
      case 'bold': st.bold = a.value !== '0'; break
      case 'italic': st.italic = a.value !== '0'; break
      case 'underline': st.underline = a.underlineType !== 'none' && a.value !== '0'; break
      case 'strike': st.strikethrough = a.value !== '0'; break
      case 'fontFamily': st.fontName = String(a.fontFamily || '').split(',')[0].replace(/['"]/g, ''); break
      case 'fontSize': st.fontSize = String(a.fontSize || '').replace(/pt$/, ''); break
      // vertAlign rides on textStyle (text-style.js:85-103) — slice 1 sub/sup support.
      case 'vertAlign':
        st.subscript = a.vertAlign === 'subscript'
        st.superscript = a.vertAlign === 'superscript'
        break
    }
  }
  // Alignment + list state live on the paragraph node, not in the mark entries
  // (spec §7.5: paragraphProperties.justification, NOT a flat textAlign).
  const para = (editor.getAttributes('paragraph') || {}) as any
  const just = para?.paragraphProperties?.justification ?? para?.textAlign ?? null
  if (just === 'left') st.justifyLeft = true
  else if (just === 'center') st.justifyCenter = true
  else if (just === 'right') st.justifyRight = true
  else if (just === 'both' || just === 'justify') st.justifyFull = true
  // List membership: numbering attrs on the paragraph (confirm keys via the Step 5.1 probe).
  const numJson = JSON.stringify(para)
  if (/numId|listLevel|numbering/i.test(numJson)) {
    if (/bullet/i.test(numJson)) st.insertUnorderedList = true
    else st.insertOrderedList = true
  }
  st.computedFontFamily = st.fontName
  st.computedFontSizePt = parseFloat(st.fontSize) || null
  return st
}

export function installStateSync(editor: AnyEditor) {
  const w = window as any
  let scheduled = false
  const sync = () => {
    scheduled = false
    const st = toQueryState(editor)
    w.WC?.Ribbon?.syncToggles?.(st)
    // Fidelity WIN over legacy: combos now track the caret (real Word does this).
    // Deliberate spec deviation (recorded): setColorBar is NOT caret-driven — the
    // split-button color bars show the LAST-USED color (applyColor writes them),
    // matching real Word; syncing them to the caret would be wrong.
    w.WC?.Ribbon?.setComboValue?.('font', st.fontName || '')
    w.WC?.Ribbon?.setComboValue?.('fontSize', st.fontSize || '')
    w.WC?.StatusBar?.update?.()
  }
  // Coalesce 'transaction' + 'selectionUpdate' (both fire per keystroke) into one
  // rAF tick — mirrors the legacy 80ms debounce intent (editor.js:26-27).
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(sync) } }
  editor.on('transaction', schedule)
  editor.on('selectionUpdate', schedule)
  schedule()
}
```

- [ ] **Step 5.3: Statusbar PM branch** — in `statusbar.js`, replace `update()` (:59-66):

```js
    update() {
      if (!this.node) return;
      if (WC.PM && WC.PM.active && WC.PM.ready) {
        // Continuous flow until Phase 7 — report honestly (spec §7.8).
        this.pageEl.textContent = 'Page 1 of 1';
        const c = WC.PM.counts();
        this.wordEl.textContent = c.selWords ? `${c.selWords} of ${c.words} words` : `${c.words} words`;
        return;
      }
      const count = E().pageCount();
      const cur = E().currentPage();
      this.pageEl.textContent = `Page ${cur} of ${count}`;
      const c = E().counts();
      this.wordEl.textContent = c.selWords ? `${c.selWords} of ${c.words} words` : `${c.words} words`;
    },
```

- [ ] **Step 5.4: Run gates.** `npm run build && npm run test:pm` → state-sync + statusbar
tests PASS (`bold lights the ribbon toggle`, `caret outside bold clears`, `font combo
reflects caret`, `word count`, `Page 1 of 1`). `npm run test:legacy` → 257 (bridge is
passive under the flag — verify no syncToggles races). Smoke ×2 → 9/9.

- [ ] **Step 5.5: Commit**

```bash
git add src/renderer/bridge/state-sync.ts src/renderer/public/js/statusbar.js
git commit -m "feat(ribbon): PM state-sync — engine events drive toggles, combos, statusbar

What changed
- bridge/state-sync.ts: getActiveFormatting entries + paragraph attrs mapped onto the
  legacy queryState shape (negation attrs, paragraphProperties.justification, numbering
  attrs); rAF-coalesced on 'transaction'+'selectionUpdate'; combos now track the caret.
- statusbar.js: PM-mode counts from the PM doc; honest 'Page 1 of 1' until Phase 7.

Why
- Spec §5.1/§6.B/§7.5/§7.8: ribbon pressed-state must read the model truthfully (naive
  isActive lies on Word negation runs), and visible chrome must never report the hidden
  legacy doc's numbers."
```

### Task 6: focus discipline

**Files:** Modify: `src/renderer/bridge/focus.ts` (replace stub)

- [ ] **Step 6.1: Replace `src/renderer/bridge/focus.ts`**

```ts
// Focus discipline (spec §5.1/§7.4). PRIMARY invariant: cmd()/chain() re-focus
// the view after dispatch (commands.ts). This capture-phase layer is the
// COSMETIC enhancement: chrome clicks shouldn't blur the view at all.
// Ribbon buttons already preventDefault per-element (ribbon.js:154/172/191/
// 270-271/281); this extends coverage to flyouts (appended to document.body —
// util.js), the tabstrip, statusbar buttons, and the QAT.
// Exemptions: anything text-entry-ish legitimately takes focus (combos,
// spinners, search field, zoom range slider, dialog inputs) — those instead get
// a focusin capture that snapshots the PM selection (spec §7.1-4: a blocked
// command must never cost the user their selection).
let installed = false // idempotent: replaceEditor() re-runs installBridge on Open/New
export function installFocusGuards() {
  if (installed) return
  installed = true
  document.addEventListener(
    'mousedown',
    (e) => {
      const t = e.target as Element | null
      if (!t || !(t instanceof Element)) return
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      if (t.closest('#ribbon, #tabstrip, #statusbar, .qat, .flyout')) e.preventDefault()
    },
    true,
  )
  // Combos/spinners take real focus — capture the PM selection on the way out
  // so withSelection() can restore it (used by comboCommit + dialogs).
  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target as Element | null
      if (t instanceof Element && t.closest('.rcombo, .rspinner')) {
        ;(window as any).WC?.PM?.captureSelection?.()
      }
    },
    true,
  )
}
```

- [ ] **Step 6.2: Run gates.** `npm run test:pm` → `[0a] focus guard: ribbon tab click does
not blur the view` PASSES. Legacy 257 unaffected (guard installs only in PM mode —
`installFocusGuards` is called from `installBridge` after the `legacyBoot` early-return).
Manual check: `npx electron .` → click in the PM page, click the Insert tab — the text
caret must stay visible in the page; then click the font-size combo — it must take focus
normally.

- [ ] **Step 6.3: Commit**

```bash
git add src/renderer/bridge/focus.ts
git commit -m "feat(ribbon): focus discipline — chrome clicks never blur the PM view

What changed
- bridge/focus.ts: capture-phase mousedown preventDefault over ribbon/tabstrip/
  statusbar/QAT/flyouts with text-entry exemptions (inputs, selects, contenteditable).

Why
- Spec §7.4: the CustomSelection extension clears the preserved selection on blur for
  non-toolbar targets; cheapest correct fix is not blurring at all, with cmd()/chain()
  re-focus as the load-bearing invariant."
```

### Task 7: dirty re-point (readers)

**Files:** Modify: `src/renderer/public/js/files.js:23-24,102-103`

- [ ] **Step 7.1: Add mode-aware accessors + re-point the readers** in `files.js` — insert
after `init()` (line 10):

```js
    // Phase 2 (spec §5.1 io.ts): single mode-aware dirty accessor. Writers:
    // legacy sets E().dirty; PM mode tracks engine 'update' events in the bridge.
    isDirty() { return (WC.PM && WC.PM.active) ? WC.PM.isDirty() : E().dirty; },
    setClean() { if (WC.PM && WC.PM.active) WC.PM.setClean(); else { E().dirty = false; } },
```

Then change `confirmDiscard` (line 24): `if (!E().dirty) return true;` →
`if (!this.isDirty()) return true;`
and `updateTitle` (line 103): `const dirty = E().dirty ? '• ' : '';` →
`const dirty = this.isDirty() ? '• ' : '';`

- [ ] **Step 7.1b: Block PM-mode Save until slice 0b** (critique finding — without this,
the 0a→0b window lets confirmDiscard's Save button run `E().getSavePayload()` on the
hidden legacy doc and write WRONG bytes to a user file). Add as the first line of BOTH
`save()` (:74) and `saveAs()` (:83):

```js
      // Slice 0a interim: PM export lands in slice 0b — never serialize the hidden
      // legacy doc to disk in PM mode (spec §7.1c: wrong bytes beat no bytes... not).
      if (WC.PM && WC.PM.active) { WC.PM.notifyBlocked('Save'); return { ok: false }; }
```
(`confirmDiscard`'s Save button already keeps the dialog open on `!r.ok` — files.js:32-34.)
Add the PM-suite test (append to the `[0a]` block):

```js
  await t('[0a] PM-mode save is blocked until the bytes path (no legacy serialize)', async () => {
    const r = await window.WC.Files.save();
    return !!r && r.ok === false;
  });
```
**Slice 0b Task 13.1 REPLACES this block with the bytes implementation** (and the test
starts passing through the real path because save() then returns the saveBytes result —
update the test in Task 13.2 to assert the round-trip instead; the block-test moves to
the html/txt-format case).

- [ ] **Step 7.2: Run gates.** `npm run test:pm` → `[0a] dirty flag tracks PM edits` PASSES
(typing-dispatch → `isDirty()` true → title shows `•`). `npm run test:legacy` → 257.

- [ ] **Step 7.3: Commit**

```bash
git add src/renderer/public/js/files.js
git commit -m "fix(editor): dirty-state readers are mode-aware (PM edits trigger save prompts)

What changed
- files.js: isDirty()/setClean() accessors; confirmDiscard + updateTitle read them.

Why
- Spec critique finding: in PM mode typing never touches E().dirty, so close/new/open
  silently discarded PM edits and the title-bar dot never showed."
```

### Task 8: visible-page-targeted command re-points

**Files:** Modify: `src/renderer/public/js/commands.js` (showHide :58, gridlines :164,
readMode content :~707, properties :~730), `src/renderer/public/js/dialogs.js`
(wordCount :~226), `src/renderer/public/styles/editor.css`

- [ ] **Step 8.1: showHide + gridlines target the visible page.** In `commands.js:58`:

```js
  H.showHide = (c, node) => {
    const target = (WC.PM && WC.PM.active) ? document.getElementById('pm-editor') : E().node;
    const on = target.classList.toggle('show-marks');
    if (node) node.classList.toggle('toggled', on);
  };
```
Locate `H.gridlines` (commands.js:164 area, toggles a class for the grid overlay) and apply
the same `target` pattern to whatever element it toggles when the class is on `E().node`.
Add the PM CSS twins in `editor.css` (after the pm-active block) — BOTH classes, else
gridlines becomes a silent no-op (the legacy rule is `#editor.show-grid`, editor.css:220;
mirror its exact declarations):

```css
body.pm-active #pm-editor.show-marks p::after { content: '¶'; color: #2b8aef; margin-left: 2px; }
/* copy the declaration block of `#editor.show-grid` (editor.css:220) verbatim: */
body.pm-active #pm-editor.show-grid { /* ← same background-image/background-size as editor.css:220 */ }
```

- [ ] **Step 8.2: Content clones read the PM doc.** In `commands.js`, find the readMode
builder (`H.readMode`, ~:697-727) and the immersiveReader builder (~:679-696); both clone
`E().getHTML()`. Replace each content read with:

```js
    const docHtml = (WC.PM && WC.PM.active) ? document.getElementById('pm-editor').innerHTML : E().getHTML();
```
In the properties dialog (`H.properties`, ~:730-732) and `D.wordCount` (dialogs.js:~226),
the dialogs read MORE than `E().counts()` — they also read `E().node.innerText`,
`E().node.querySelectorAll(...)` (paragraphs/lines) and `E().pageCount()` (dialogs.js:
227-232, commands.js:730-732). Re-point ALL of it, not just counts, or the dialog mixes
PM words with legacy pages (critique finding). Extend `WC.PM.counts()` in
`src/renderer/bridge/io.ts` to cover every row:

```ts
  function counts() {
    const dom = editor.view?.dom as HTMLElement | undefined
    const text: string = dom?.innerText || ''
    const words = (text.match(/\S+/g) || []).length
    const chars = text.replace(/\n/g, '').length
    const charsNoSpace = text.replace(/\s/g, '').length
    const paras = dom ? dom.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li').length : 0
    const lines = (text.match(/\n/g) || []).length + 1
    const pages = 1 // continuous flow until Phase 7 (spec §7.8)
    const sel = editor.state.selection
    const selWords = sel.empty
      ? 0
      : ((editor.state.doc.textBetween(sel.from, sel.to, ' ') as string).match(/\S+/g) || []).length
    return { words, chars, charsNoSpace, paras, lines, pages, selWords }
  }
```
Then in both dialogs source EVERY row from one mode-aware object:

```js
    const pmMode = WC.PM && WC.PM.active;
    const c = pmMode ? WC.PM.counts()
                     : Object.assign(E().counts(), { pages: E().pageCount() }); // legacy keeps its own paras/lines reads
```
and use `c.pages`/`c.paras`/`c.lines`/`c.charsNoSpace` for the rows that previously read
`E().pageCount()`/`E().node.*` (keep the legacy reads in the legacy branch).

- [ ] **Step 8.3: Add PM-suite tests** (append to `scripts/test-suite-pm.js` before the
summary lines):

```js
  await t('[0a] showHide toggles marks on the PM page', () => {
    window.WC.Commands.run({ cmd: 'showHide' });
    const on = document.getElementById('pm-editor').classList.contains('show-marks');
    window.WC.Commands.run({ cmd: 'showHide' });
    return on === true && !document.getElementById('pm-editor').classList.contains('show-marks');
  });
  await t('[0a] wordCount dialog reads the PM doc (words AND pages row)', () => {
    setDoc('alpha beta gamma');
    window.WC.Dialogs.wordCount();
    const dlg = document.querySelector('.modal-backdrop .dialog');
    // assert a previously-wrong row too: Pages must be the PM-honest 1, and the
    // dialog must not report the hidden legacy doc's counts.
    const ok = !!dlg && /3/.test(dlg.textContent) && /Pages[^0-9]*1\b/i.test(dlg.textContent);
    if (dlg) dlg.querySelector('.dlg-footer .btn').click();
    return ok;
  });
```

- [ ] **Step 8.4: Run gates** (all five commands). Expected: PM suite all green
(17 tests), 257 legacy, 9+9 smoke, 17 docx.

- [ ] **Step 8.5: Commit**

```bash
git add src/renderer/public/js/commands.js src/renderer/public/js/dialogs.js \
        src/renderer/public/styles/editor.css scripts/test-suite-pm.js
git commit -m "fix(view): visible-page commands (showHide, readMode, wordCount, properties) follow the active engine

What changed
- showHide/gridlines toggle classes on #pm-editor in PM mode (+ CSS twin for ¶ marks);
  readMode/immersiveReader clone the PM page; wordCount/properties use WC.PM.counts().
- 2 new PM-suite tests.

Why
- Spec §7.1c third class: wrong word counts / wrong read-mode content presented silently
  is worse than a blocked toast."
```

### Task 9: slice 0a wrap-up — gates, checkpoint, PR

- [ ] **Step 9.1: Full gate run** (all five commands from the header). Record numbers.
- [ ] **Step 9.2: Plan-tracking checkpoint + docs follow-up** — invoke the `plan-tracking`
skill: append a dated entry to `docs/plan/last-point.md` (top), tick
`docs/plan/execution-map.md` Daily work log, note slice 0a complete. Also:
  - update `docs/plan/plan.md` roadmap + Phase 6 row and `docs/decisions/OPEN_DECISIONS.md`
    I2 per spec §1's roadmap note (D4 absorbs Phase 6's wiring half into slices 8–9);
  - **amend CLAUDE.md** (spec §2-4): working rule 2 becomes "every fix ships a regression
    test — PM-mode features in `scripts/test-suite-pm.js`; `scripts/test-suite.js` is
    frozen until legacy retirement", and the Quick commands block gains the `test:*`
    aliases + the `--legacy` flag (Task 2.2 made the old block stale).
  Commit per commit-style (`docs(repo): ...`).
- [ ] **Step 9.3: PR** — `gh pr create` from `feature/phase-2-editing-core` → `main`,
title `Phase 2 slice 0a: PM core becomes the visible editor (bridge + flip + D6 guards)`.
Body: spec link, gate numbers, screenshots from Step 3.7.

---

# Stage B — Slice 0b: file-IO bytes layer

**Branch:** after 0a merges: `git checkout main && git pull && git checkout -b feature/phase-2-slice-0b`

### Task 10: blank-document fixture

**Files:** Create: `src/renderer/core/generated/blank.docx.b64.ts` (generated) · Modify: `src/renderer/core/fixture.ts`

- [ ] **Step 10.1: Generate** (mirrors the basic-list fixture pattern; the source is the
fork's own blank template):

```bash
node -e "const fs=require('fs');const b=fs.readFileSync('src/renderer/core/superdoc-fork/_vendor/superdoc/common/data/blank.docx').toString('base64');fs.writeFileSync('src/renderer/core/generated/blank.docx.b64.ts','// AUTO-GENERATED from _vendor/superdoc/common/data/blank.docx — do not hand-edit.\nexport const BLANK_DOCX_B64 =\n  '+JSON.stringify(b)+'\n')"
```
(If that path 404s: `find src/renderer/core/superdoc-fork/_vendor -name 'blank.docx'` and
use the hit. Check `scripts/gen-fixture.js` — if it accepts args, prefer extending it.)

- [ ] **Step 10.2: Add `blankArrayBuffer()`** to `src/renderer/core/fixture.ts`, mirroring
the existing `fixtureArrayBuffer()` decode exactly but importing `BLANK_DOCX_B64`.

- [ ] **Step 10.3: Commit** (`feat(docx): add blank-document fixture for New Document on the PM core`).

### Task 11: bytes IPC (main + preload)

**Files:** Modify: `src/main/main.js` (after the `doc:saveAs` handler, :409), `src/main/preload.js:23`

- [ ] **Step 11.1: Main handlers** — append after `doc:saveAs`:

```js
// ---------------------------------------------------------------------------
// IPC: Phase 2 bytes channels — the PM core produces/consumes whole .docx
// bytes in the renderer (fork converter); main is a dumb byte writer/reader.
// ---------------------------------------------------------------------------
ipcMain.handle('doc:saveBytes', async (_evt, { filePath, bytes }) => {
  try {
    if (!filePath) return { ok: false, error: 'No path' };
    const buf = Buffer.from(bytes);
    if (!buf.length) return { ok: false, error: 'Empty document data (export failed?)' }; // never truncate a real file
    await fsp.writeFile(filePath, buf);
    await pushRecentFile(filePath);
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

ipcMain.handle('doc:saveAsBytes', async (_evt, { bytes, suggestedName }) => {
  try {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save As',
      defaultPath: suggestedName || 'Document1.docx',
      // docx-only: the PM bytes ARE a docx zip — offering .html/.txt here would
      // write zip bytes into a text file (spec §5.3).
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    const buf = Buffer.from(bytes);
    if (!buf.length) return { ok: false, error: 'Empty document data (export failed?)' };
    await fsp.writeFile(res.filePath, buf);
    await pushRecentFile(res.filePath);
    return { ok: true, path: res.filePath, name: path.basename(res.filePath), format: 'docx' };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

ipcMain.handle('doc:openBytes', async (_evt, presetPath) => {
  try {
    let filePath = presetPath;
    if (!filePath) {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Open',
        properties: ['openFile'],
        filters: [{ name: 'Word Documents', extensions: ['docx'] }], // PM core opens .docx; other formats return in slice 7
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
      filePath = res.filePaths[0];
    }
    const buf = await fsp.readFile(filePath);
    await pushRecentFile(filePath);
    return { ok: true, path: filePath, name: path.basename(filePath), bytes: buf };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});
```

- [ ] **Step 11.2: Preload** — after `print:` (preload.js:23):

```js
  // Phase 2 bytes channels (PM core: renderer-side .docx converter)
  saveBytes: (payload) => ipcRenderer.invoke('doc:saveBytes', payload),
  saveAsBytes: (payload) => ipcRenderer.invoke('doc:saveAsBytes', payload),
  openBytes: (presetPath) => ipcRenderer.invoke('doc:openBytes', presetPath),
```

- [ ] **Step 11.3: Commit** (`feat(ipc): doc:saveBytes/saveAsBytes/openBytes — raw .docx bytes channels for the PM core`; body notes docx-only filters + empty-payload refusal).

### Task 12: bridge open/new + editor re-creation

**Files:** Create: `src/renderer/bridge/create-editor.ts` · Modify: `src/renderer/main.ts`, `src/renderer/bridge/index.ts`, `src/renderer/bridge/io.ts`

- [ ] **Step 12.1: Create `src/renderer/bridge/create-editor.ts`** (factor the mount so boot
and openDocx share it):

```ts
// One construction path for the vendored Editor (boot + Open + New).
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'

export async function createPmEditor(mountEl: HTMLElement, source: ArrayBuffer) {
  const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(source)
  return new (Editor as any)({
    element: mountEl,
    mode: 'docx',
    content: docx,
    mediaFiles,
    fonts,
    extensions: getStarterExtensions(),
    user: { name: 'local', email: '' },
    isDebug: false,
    telemetry: { enabled: false },
  })
}
```
Rewrite `main.ts`'s mount body to call `createPmEditor(mountEl, fixtureArrayBuffer())`
(delete the now-duplicated `loadXmlData` + `new Editor` lines; imports of
`Editor`/`getStarterExtensions` move out of main.ts).

- [ ] **Step 12.2: Add `openDocx`/`newBlank` to the bridge** — in `index.ts`:

```ts
import { createPmEditor } from './create-editor'
import { blankArrayBuffer } from '@/core/fixture'

// Replace the live editor with one loaded from `source` (Open / New).
// Re-runs the install path so commands/io/state-sync bind the new instance.
async function replaceEditor(source: ArrayBuffer): Promise<boolean> {
  const w = window as any
  try {
    const mountEl = document.getElementById('pm-editor')!
    try { current?.destroy?.() } catch { /* old view already gone */ }
    mountEl.innerHTML = ''
    const next = await createPmEditor(mountEl, source)
    w.WC.view = next.view
    w.WC.editor = next
    next.on?.('transaction', () => { ;(w.WC.pm ??= {}).lastTxn = Date.now() }) // logger seam survives reopen
    installBridge(next)
    w.WC.PM.setClean()
    return true
  } catch (e) {
    console.error('[WC.PM] replaceEditor failed', e)
    return false
  }
}
```
Expose in `installBridge`'s `Object.assign` additions:

```ts
  PM.openDocx = (bytes: Uint8Array | ArrayBuffer) => {
    const buf = bytes instanceof Uint8Array
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes
    return replaceEditor(buf as ArrayBuffer)
  }
  PM.newBlank = () => replaceEditor(blankArrayBuffer())
```

- [ ] **Step 12.3: Commit** (`feat(editor): bridge openDocx/newBlank — editor re-creation from .docx bytes`).

### Task 13: files.js mode-aware save/open/new

**Files:** Modify: `src/renderer/public/js/files.js` (save :74, saveAs :83, open :62, newDoc :44, newDocWith :53)

- [ ] **Step 13.1: Rewrite the five methods** — PM branch first, legacy branch
verbatim-unchanged. **This REPLACES the slice-0a interim block from Step 7.1b** (delete
those two guard lines from `save()`/`saveAs()` as part of this rewrite):

```js
    async save() {
      if (WC.PM && WC.PM.active) {
        if (this.format && this.format !== 'docx') {
          WC.toast('Saving as ' + this.format + ' is not on the new engine yet', 'Use --legacy for html/txt saves (returns in slice 7)');
          return { ok: false };
        }
        if (!this.path) return this.saveAs();
        try {
          const bytes = await WC.PM.exportDocxBytes();
          const r = await window.wordAPI.saveBytes({ filePath: this.path, bytes });
          if (r && r.ok) { this.setClean(); WC.toast('Saved ' + r.name); }
          else WC.toast('Save failed', r && r.error);
          return r;
        } catch (e) { WC.toast('Save failed', String((e && e.message) || e)); return { ok: false, error: String(e) }; }
      }
      if (!this.path) return this.saveAs();
      const p = E().getSavePayload();
      const r = await window.wordAPI.save({ filePath: this.path, html: p.html, header: p.header, footer: p.footer, comments: p.comments, format: this.format });
      if (r && r.ok) { E().dirty = false; this.updateTitle(); WC.toast('Saved ' + r.name); }
      else WC.toast('Save failed', r && r.error);
      return r;
    },

    async saveAs() {
      if (WC.PM && WC.PM.active) {
        try {
          const bytes = await WC.PM.exportDocxBytes();
          const r = await window.wordAPI.saveAsBytes({ bytes, suggestedName: (this.name || 'Document1').replace(/\.[^.]+$/, '') + '.docx' });
          if (r && r.ok) { this.path = r.path; this.name = r.name; this.format = 'docx'; this.setClean(); WC.toast('Saved ' + r.name); }
          else if (r && r.error) WC.toast('Save failed', r.error);
          return r;
        } catch (e) { WC.toast('Save failed', String((e && e.message) || e)); return { ok: false, error: String(e) }; }
      }
      const p = E().getSavePayload();
      const r = await window.wordAPI.saveAs({ html: p.html, header: p.header, footer: p.footer, comments: p.comments, suggestedName: (this.name || 'Document1').replace(/\.[^.]+$/, '') + '.docx' });
      if (r && r.ok) { this.path = r.path; this.name = r.name; this.format = r.format; E().dirty = false; this.updateTitle(); WC.toast('Saved ' + r.name); }
      else if (r && r.error) WC.toast('Save failed', r.error);
      return r;
    },

    async open(presetPath) {
      if (WC.PM && WC.PM.active) {
        if (!(await this.confirmDiscard())) return;
        const r = await window.wordAPI.openBytes(presetPath);
        if (!r || !r.ok) { if (r && r.error) WC.toast('Could not open file', r.error); return; }
        if (!/\.docx$/i.test(r.path)) { WC.toast('Only .docx opens on the new engine for now', 'Use --legacy for html/txt/csv (returns in slice 7)'); return; }
        const ok = await WC.PM.openDocx(r.bytes);
        if (!ok) { WC.toast('Could not open file', 'The new engine failed to import it'); return; }
        // Invariant (spec §5.3): in PM mode `path` only ever points at a file the PM doc represents.
        this.path = r.path; this.name = r.name || 'Document'; this.format = 'docx';
        this.updateTitle(); WC.Backstage.close(); WC.toast('Opened ' + this.name);
        return;
      }
      /* legacy branch — unchanged lines 63-71 */
    },

    async newDoc() {
      if (!(await this.confirmDiscard())) return;
      if (WC.PM && WC.PM.active) {
        if (!(await WC.PM.newBlank())) { WC.toast('Could not create document'); return; }
      } else {
        E().setHTML('<p><br></p>'); E().dirty = false;
      }
      this.path = null; this.name = 'Document' + (Math.floor(Math.random() * 8) + 1); this.format = 'docx';
      this.updateTitle();
      WC.Backstage.close();
    },

    async newDocWith(html, baseName) {
      if (WC.PM && WC.PM.active) {
        // Mail-merge/labels output is legacy-HTML shaped — its producers flip in slice 10.
        WC.PM.notifyBlocked('Generated documents (' + (baseName || 'document') + ')');
        return false;
      }
      /* legacy branch — unchanged lines 54-60 */
    },
```

- [ ] **Step 13.2: PM-suite tests** (append to `scripts/test-suite-pm.js`):

```js
  // ---------- slice 0b: file IO ----------
  await t('[0b] exportDocxBytes yields a real zip (PK header)', async () => {
    const bytes = await PM().exportDocxBytes();
    return bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  });
  await t('[0b] save/open round-trip through the bytes IPC', async () => {
    setDoc('roundtrip payload text');
    const bytes = await PM().exportDocxBytes();
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-roundtrip.docx', bytes });
    if (!w1 || !w1.ok) return 'saveBytes: ' + (w1 && w1.error);
    const r = await window.wordAPI.openBytes('/tmp/wc-pm-roundtrip.docx');
    if (!r || !r.ok) return 'openBytes: ' + (r && r.error);
    const ok = await PM().openDocx(r.bytes);
    return ok === true && /roundtrip payload text/.test(window.WC.view.dom.textContent);
  });
  await t('[0b] saveBytes refuses empty payloads', async () => {
    const r = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-empty.docx', bytes: new Uint8Array(0) });
    return !!r && r.ok === false;
  });
  await t('[0b] New Document loads the blank template + clean state', async () => {
    const ok = await PM().newBlank();
    return ok === true && PM().isDirty() === false && window.WC.view.state.doc.content.size < 60;
  });
  // ---- spec §5.3 invariant: Files.path may never point at a file the PM doc
  // does not represent (critique finding — enforce by test, not statement order) ----
  await t('[0b] html-format save is blocked in PM mode (path untouched)', async () => {
    const f = window.WC.Files; const p0 = f.path; const fmt0 = f.format;
    f.format = 'html';
    const r = await f.save();
    f.format = fmt0;
    return !!r && r.ok === false && f.path === p0;
  });
  await t('[0b] failed openDocx leaves path + doc unchanged', async () => {
    const f = window.WC.Files; const p0 = f.path;
    const before = window.WC.view.state.doc.content.size;
    const ok = await PM().openDocx(new Uint8Array([1, 2, 3, 4, 5]).buffer); // garbage, not a zip
    return ok === false && f.path === p0 && window.WC.view.state.doc.content.size === before;
  });
  await t('[0b] non-docx open is refused before touching the engine', async () => {
    // files.js open() must refuse a non-.docx path BEFORE calling openDocx.
    const f = window.WC.Files; const p0 = f.path;
    const before = window.WC.view.state.doc.content.size;
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-junk.txt', bytes: new Uint8Array([104, 105]) });
    if (!w1 || !w1.ok) return 'setup failed: ' + (w1 && w1.error);
    await f.open('/tmp/wc-pm-junk.txt');
    return f.path === p0 && window.WC.view.state.doc.content.size === before;
  });
```
(Hardening required by the garbage-bytes test: `openDocx` must validate the zip magic —
`bytes[0] === 0x50 && bytes[1] === 0x4b` — and return `false` BEFORE destroying the live
editor, so a failed import can never leave an empty mount.)
**Note:** these tests run LAST in the suite file (they replace the live document); keep
them after every `[0a]`/`[1]` test. Re-verify `[0a]` ordering when appending.

- [ ] **Step 13.3: Run all gates.** PM suite green; 257 legacy; 9+9 smoke; 17 docx.
Manual: `npx electron .` → type, Ctrl+S → save dialog (docx only) → reopen the file with
real Word or `npx electron . --legacy` to eyeball it.

- [ ] **Step 13.4: Commit + PR** (`feat(docx): save/open/new run on the PM engine in PM mode` —
this touches the save path: PR per CLAUDE.md rule 3). Then plan-tracking checkpoint.

---

# Stage C — Slice 0c: AppleScript oracle harness

**Branch:** `feature/phase-2-slice-0c` off `main`. Pure tooling — no renderer coupling, no gate impact.

### Task 14: `scripts/oracle/word-oracle.js` + README

**Files:** Create: `scripts/oracle/word-oracle.js`, `scripts/oracle/README.md`

- [ ] **Step 14.1: Create the CLI**

```js
#!/usr/bin/env node
/* scripts/oracle/word-oracle.js — macOS Microsoft Word oracle (AppleScript object
   model ONLY — no GUI/AX scripting; per-recipe notes: hyperlink creation is broken
   in Word 16.77 and stays off-limits).

   Usage:
     node scripts/oracle/word-oracle.js read-props <abs path .docx> [--out report.json]
     node scripts/oracle/word-oracle.js roundtrip  <abs in.docx> <abs out.docx>

   PID-safety contract: we only ever `close` the document WE opened (by name,
   saving no) and we NEVER `quit` Word — the user's own windows are untouchable. */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function osa(script) {
  return execFileSync('/usr/bin/osascript', ['-e', script], { encoding: 'utf8' }).trim();
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function readProps(docxPath) {
  const name = path.basename(docxPath);
  const script = `
tell application "Microsoft Word"
  open POSIX file "${esc(docxPath)}"
  set d to document "${esc(name)}"
  set out to ""
  repeat with i from 1 to (count of paragraphs of d)
    set tr to text object of paragraph i of d
    set f to font object of tr
    set pf to paragraph format of paragraph i of d
    set out to out & i & tab & (content of tr) & tab & (bold of f) & tab & (italic of f) & tab & (underline of f) & tab & (name of f) & tab & (font size of f) & tab & (alignment of pf) & linefeed
  end repeat
  close d saving no
  return out
end tell`;
  const raw = osa(script);
  return raw.split('\n').filter(Boolean).map((line) => {
    const [index, text, bold, italic, underline, fontName, fontSize, alignment] = line.split('\t');
    return {
      index: Number(index),
      text: (text || '').replace(/\r$/, ''),
      bold: bold === 'true',
      italic: italic === 'true',
      underline: underline !== 'underline none' && underline !== 'false',
      fontName, fontSize: parseFloat(fontSize),
      alignment: (alignment || '').replace(/^align paragraph /, ''),
    };
  });
}

function roundtrip(inPath, outPath) {
  const name = path.basename(inPath);
  osa(`
tell application "Microsoft Word"
  open POSIX file "${esc(inPath)}"
  set d to document "${esc(name)}"
  save as d file name (POSIX file "${esc(outPath)}") file format format document default
  close d saving no
end tell`);
}

const [, , cmd, a, b] = process.argv;
if (cmd === 'read-props' && a) {
  const report = { file: a, generatedBy: 'word-oracle read-props', paragraphs: readProps(path.resolve(a)) };
  const outFlag = process.argv.indexOf('--out');
  const json = JSON.stringify(report, null, 2);
  if (outFlag > -1 && process.argv[outFlag + 1]) fs.writeFileSync(process.argv[outFlag + 1], json);
  console.log(json);
} else if (cmd === 'roundtrip' && a && b) {
  roundtrip(path.resolve(a), path.resolve(b));
  console.log('ROUNDTRIP_OK ' + b);
} else {
  console.error('usage: word-oracle.js read-props <file.docx> [--out r.json] | roundtrip <in.docx> <out.docx>');
  process.exit(2);
}
```

- [ ] **Step 14.2: README.md** — document: requirements (Word for Mac installed; tested
recipe base = Word 16.77), the two verbs with examples, the PID-safety contract (close
only our doc, never quit), known limits (no hyperlink creation; GUI scripting off-limits;
underline reports Word's enum — treat anything ≠ `underline none` as underlined), and the
per-feature validation protocol from spec §8.3.

- [ ] **Step 14.3: Manual verification** (needs Word installed; NOT a CI gate):

```bash
node scripts/oracle/word-oracle.js read-props "$(pwd)/tests/fixtures/basic-list.docx" --out /tmp/oracle-fixture.json
cat /tmp/oracle-fixture.json
```
Expected: JSON with one entry per paragraph, plausible fonts/sizes. **AppleScript property
names may need iteration against the installed Word version** — adjust the script until
the fixture reads cleanly, and record any renames in the README. If Word was not running
before, it will be left running but with no document windows of ours.

- [ ] **Step 14.4: Commit + PR** (`test: add macOS Word AppleScript oracle harness (read-props, roundtrip)`).
Plan-tracking checkpoint.

---

# Stage D — Slice 1: character formatting

**Branch:** `feature/phase-2-slice-1-character` off `main`.
**Area registry:** this slice flips area `character` (+ QAT history buttons).

### Task 15: failing PM-suite tests for the area (red)

**Files:** Modify: `scripts/test-suite-pm.js`

- [ ] **Step 15.1: Append the slice-1 block** (BEFORE the `[0b]` block — 0b tests replace the doc):

```js
  // ---------- slice 1: character formatting (drives the REAL dispatch path) ----------
  const run = (cmd) => window.WC.Commands.run({ cmd });
  await t('[1] bold via WC.Commands.run lands as a PM mark', async () => {
    setDoc('charfmt bold target'); selectText('bold');
    run('bold'); await sleep(50);
    return markNames('bold').some((m) => m.startsWith('bold:') && !m.includes('"value":"0"'));
  });
  await t('[1] bold toggles off', async () => {
    selectText('bold'); run('bold'); await sleep(50);
    return !markNames('bold').some((m) => m.startsWith('bold:') && !m.includes('"value":"0"'));
  });
  await t('[1] italic + underline + strikethrough marks', async () => {
    selectText('charfmt'); run('italic'); run('underline'); run('strikethrough'); await sleep(50);
    const m = markNames('charfmt').join(' ');
    return /italic:/.test(m) && /underline:/.test(m) && /strike:/.test(m);
  });
  await t('[1] font family via comboCommit', async () => {
    selectText('target');
    window.WC.Commands.comboCommit({ cmd: 'font' }, 'Georgia'); await sleep(50);
    return markNames('target').some((m) => m.includes('Georgia'));
  });
  await t('[1] font size via comboCommit (12 -> 20pt)', async () => {
    selectText('target');
    window.WC.Commands.comboCommit({ cmd: 'fontSize' }, '20'); await sleep(50);
    return markNames('target').some((m) => m.includes('20pt'));
  });
  await t('[1] grow font steps the size ladder', async () => {
    selectText('target'); run('increaseFontSize'); await sleep(50);
    return markNames('target').some((m) => m.includes('22pt')); // 20 -> 22 per SIZES
  });
  await t('[1] font color + highlight', async () => {
    selectText('charfmt');
    window.WC.Commands.run({ cmd: 'fontColor' }); // applies lastFontColor #FF0000
    window.WC.Commands.run({ cmd: 'textHighlightColor' }); // lastHighlight #FFFF00
    await sleep(50);
    const m = markNames('charfmt').join(' ');
    return /FF0000|#ff0000|red/i.test(m) && /highlight:/.test(m);
  });
  await t('[1] clear formatting strips the marks', async () => {
    selectText('charfmt'); run('clearAllFormatting'); await sleep(50);
    return markNames('charfmt').length === 0;
  });
  await t('[1] changeCase UPPERCASE via PM transaction', async () => {
    setDoc('case probe text'); selectText('case probe');
    PM().changeCase('upper'); await sleep(50);
    return /CASE PROBE text/.test(v().dom.textContent);
  });
  await t('[1] QAT undo reverses the last command (engine history)', async () => {
    setDoc('undo probe'); selectText('undo');
    run('bold'); await sleep(50);
    const had = markNames('undo').some((m) => m.startsWith('bold:'));
    document.querySelector('.qat .qat-btn[title^="Undo"]').click(); await sleep(50);
    return had && !markNames('undo').some((m) => m.startsWith('bold:'));
  });
  await t('[1] Font dialog OK applies family+size+bold as ONE undo step', async () => {
    setDoc('dialog probe words'); selectText('dialog probe');
    window.WC.Dialogs.font();
    const dlg = document.querySelector('.modal-backdrop .dialog');
    dlg.querySelector('select.grow').value = 'Georgia';
    dlg.querySelectorAll('select')[1].value = 'Bold';
    dlg.querySelector('input[type=number]').value = '20';
    const ok = Array.from(dlg.querySelectorAll('.dlg-footer .btn')).find((b) => /^OK$/.test(b.textContent.trim()));
    ok.click(); await sleep(80);
    const m1 = markNames('dialog').join(' ');
    const applied = /Georgia/.test(m1) && /20pt/.test(m1) && /bold:/.test(m1);
    PM().cmd('undo'); await sleep(50);
    const m2 = markNames('dialog').join(' ');
    return applied && !/Georgia/.test(m2) && !/bold:/.test(m2); // one undo removed ALL of it
  });
  await t('[1] subscript applies via textStyle vertAlign and toggles off', async () => {
    setDoc('subsup probe'); selectText('subsup');
    run('subscript'); await sleep(50);
    const on = markNames('subsup').some((m) => m.includes('"vertAlign":"subscript"'));
    run('subscript'); await sleep(50);
    const off = !markNames('subsup').some((m) => m.includes('"vertAlign":"subscript"'));
    return on && off;
  });
  await t('[1] superscript replaces subscript (mutually exclusive, like Word)', async () => {
    selectText('subsup'); run('subscript'); run('superscript'); await sleep(50);
    const m = markNames('subsup').join(' ');
    return m.includes('"vertAlign":"superscript"') && !m.includes('"vertAlign":"subscript"');
  });
```

- [ ] **Step 15.2: Run** `npm run build && npm run test:pm` → all `[1]` tests FAIL (red).
Commit (`test: slice-1 character-formatting PM tests (red)`).

### Task 16: rewrite the H handlers + helpers (green)

**Files:** Modify: `src/renderer/public/js/commands.js`, `src/renderer/bridge/commands.ts`, `src/renderer/bridge/index.ts`

- [ ] **Step 16.1: Flip the area + add the accessor.** In `src/renderer/bridge/index.ts`,
flip the registry (the auditable flip moment for this slice):

```ts
const FLIPPED = new Set<string>(['character', 'history'])
```

In `commands.js` after `const E = () => WC.Editor;` (line 8):

```js
  // Phase 2: PM bridge accessor — null under --legacy or pre-mount (then the
  // legacy branch runs; the editor.js pmGuard still backstops mistakes).
  const PMA = () => (WC.PM && WC.PM.active && WC.PM.ready ? WC.PM : null);
```

In `app.js`, rewrite the two `history` keydown entries + QAT buttons from Task 4B's
`pmBlockedOr('history', …)` wrappers to the live PM commands:

```js
        if (k === 'z' && !shift) return () => { const pm = WC.PM && WC.PM.active ? WC.PM : null; pm ? pm.cmd('undo') : E().undo(); };
        if ((k === 'z' && shift) || (k === 'y' && !shift)) return () => { const pm = WC.PM && WC.PM.active ? WC.PM : null; pm ? pm.cmd('redo') : E().redo(); };
```
(plus the same ternary in the two QAT buttons — this supersedes Task 18's old wording;
Task 18 keeps only the in-view double-fire guard + can() greying.)

- [ ] **Step 16.2: Rewrite the simple marks** (commands.js:30-36):

```js
  H.bold = () => { const pm = PMA(); pm ? pm.cmd('toggleBold') : E().exec('bold'); };
  H.italic = () => { const pm = PMA(); pm ? pm.cmd('toggleItalic') : E().exec('italic'); };
  H.underline = () => { const pm = PMA(); pm ? pm.cmd('toggleUnderline') : E().exec('underline'); };
  H.strikethrough = () => { const pm = PMA(); pm ? pm.cmd('toggleStrike') : E().exec('strikethrough'); };
  // No dedicated fork command, but the textStyle mark carries vertAlign with
  // subscript/superscript rendering (text-style.js:85-103) — drive it via the
  // generic setMark, toggling off when already set and keeping the pair mutually
  // exclusive (Word behavior).
  const vertAlign = (kind) => {
    const pm = PMA();
    if (!pm) { E().exec(kind); return; }
    const st = pm.getState();
    const on = kind === 'subscript' ? st.subscript : st.superscript;
    pm.cmd('setMark', 'textStyle', { vertAlign: on ? null : kind });
  };
  H.subscript = () => vertAlign('subscript');
  H.superscript = () => vertAlign('superscript');
  H.clearAllFormatting = () => {
    const pm = PMA();
    if (pm) { pm.cmd('clearFormat'); return; }
    E().exec('removeFormat'); E().selectedBlocks().forEach((b) => b.removeAttribute('style')); WC.formatBlock('p');
  };
```

- [ ] **Step 16.3: Font name/size/step helpers** (commands.js:991-1018) — replace:

```js
  function stepFont(dir) {
    const cur = currentSizePt() || 11;
    let next;
    if (dir > 0) { const bigger = SIZES.find((s) => s > cur); next = bigger != null ? bigger : SIZES[SIZES.length - 1]; }
    else { const smaller = SIZES.filter((s) => s < cur); next = smaller.length ? smaller[smaller.length - 1] : SIZES[0]; }
    setFontSize(next);
  }
  function currentSizePt() {
    const pm = PMA();
    if (pm) { const st = pm.getState(); const v = parseFloat(st && st.fontSize); return v || 12; }
    const sel = window.getSelection();
    let n = sel && sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
    if (n && n.getBoundingClientRect) { const px = parseFloat(getComputedStyle(n).fontSize); if (px) return Math.round(px / 1.3333 * 10) / 10; }
    return E().queryState().computedFontSizePt || 12;
  }
  function setFontSize(pt) {
    if (!pt) return;
    const pm = PMA();
    // withSelection: combo commits arrive with focus in the combo input — the
    // focusin capture (focus.ts) snapshotted the PM selection; restore it first.
    if (pm) pm.withSelection(() => pm.cmd('setFontSize', pt + 'pt'));
    else E().applyInlineStyle('fontSize', pt + 'pt');
    WC.Ribbon.setComboValue('fontSize', String(pt));
  }
  function setFontName(name) {
    const pm = PMA();
    if (pm) pm.withSelection(() => pm.cmd('setFontFamily', name));
    else E().exec('fontName', name);
    WC.Ribbon.setComboValue('font', name);
  }
```

- [ ] **Step 16.4: Colors** (commands.js:1020-1033) — replace `applyColor` + the `colorMenu`
null-branch:

```js
  function applyColor(kind, color) {
    const pm = PMA();
    if (kind === 'fore') {
      lastFontColor = color;
      pm ? pm.cmd('setColor', color) : E().exec('foreColor', color);
      WC.Ribbon.setColorBar('fontColor', color);
    } else if (kind === 'hilite') {
      lastHighlight = color;
      if (pm) { color === 'transparent' ? pm.cmd('unsetHighlight') : pm.cmd('setHighlight', color); }
      else { E().exec('hiliteColor', color) || E().exec('backColor', color); }
      WC.Ribbon.setColorBar('textHighlightColor', color);
    } else if (kind === 'shade') {
      if (pm) { pm.notifyBlocked('Shading'); return; } // paragraph area — slice 2
      if (color && color !== 'transparent') lastShade = color;
      E().applyBlockStyle('backgroundColor', color || 'transparent');
      WC.Ribbon.setColorBar && WC.Ribbon.setColorBar('shading', color);
    } else if (kind === 'page') {
      if (pm) { pm.notifyBlocked('Page Color'); return; } // design area — slice 10
      E().node.style.backgroundColor = color;
    }
  }
```
And in `colorMenu`'s `color === null` branch (commands.js:1030): prepend
`const pm = PMA(); if (pm) { if (kind === 'hilite') pm.cmd('unsetHighlight'); else if (kind === 'fore') pm.cmd('unsetColor'); else pm.notifyBlocked(kind); return; }`.

- [ ] **Step 16.5: changeCase on the engine** — add to `src/renderer/bridge/commands.ts`'s
returned object:

```ts
  // Length-preserving case transform as ONE PM transaction (no fork command for
  // this — verified; text-transform ext has no addCommands). insertText inherits
  // the replaced range's marks; mapping keeps later positions valid.
  function changeCase(mode: string): boolean {
    const xform = (t: string) => {
      if (mode === 'lower') return t.toLowerCase()
      if (mode === 'upper') return t.toUpperCase()
      if (mode === 'caps') return t.replace(/\b\w/g, (m) => m.toUpperCase())
      if (mode === 'sentence') return t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase())
      if (mode === 'toggle') return t.replace(/./g, (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()))
      return t
    }
    const { state } = editor
    const { from, to, empty } = state.selection
    if (empty) return false
    let tr = state.tr
    state.doc.nodesBetween(from, to, (node: any, pos: number) => {
      if (!node.isText || !node.text) return
      const s = Math.max(from, pos)
      const e = Math.min(to, pos + node.nodeSize)
      const slice = node.text.slice(s - pos, e - pos)
      const next = xform(slice)
      if (next !== slice) tr = tr.insertText(next, tr.mapping.map(s), tr.mapping.map(e))
    })
    if (tr.docChanged) editor.view.dispatch(tr)
    editor.view?.focus()
    return true
  }
```
Add `changeCase` to the returned object, and in `commands.js`'s `changeCase(mode)`
(:1040) prepend: `const pm = PMA(); if (pm) { pm.changeCase(mode); return; }`.

- [ ] **Step 16.6: underline-style + bullets-cell + paste-keep-text leaf closures** —
`underlineMenu` (commands.js:1176-1180):

```js
  function underlineMenu(node) {
    const styles = [['Single', 'solid'], ['Double', 'double'], ['Dotted', 'dotted'], ['Dashed', 'dashed'], ['Wavy', 'wavy']];
    const UL_TYPE = { solid: 'single', double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave' }; // OOXML w:u values
    WC.flyout(node, (fly) => {
      styles.forEach(([label, s]) => fly.appendChild(WC.flyItem(label, { onClick: () => {
        const pm = PMA();
        if (pm) { pm.chain([['setUnderline'], ['setMark', 'underline', { underlineType: UL_TYPE[s] }]]); return; }
        E().exec('underline'); E().applyInlineStyle('textDecorationStyle', s);
      } })));
    });
  }
```
(`openFontList`/`openSizeList` leaf items call `setFontName`/`setFontSize` — already
PM-aware via 16.3; verify by reading commands.js:1378-1395.)

- [ ] **Step 16.7: textEffects stays blocked** — `textEffectsMenu` (commands.js:~210-262)
applies webkit-CSS effects with `applyInlineStyles` (chokepoint-guarded → toast). Add the
explicit row to the slice notes: no engine equivalent; revisit with design area.

- [ ] **Step 16.8: Run** `npm run test:pm` → `[1]` mark/font/color/clear/changeCase tests
PASS (undo/dialog tests still red). 257 legacy still green. Commit
(`feat(home): character formatting dispatches to the PM engine (area 'character' flip, part 1)`).

### Task 17: Font dialog PM branch + launcher fix

**Files:** Modify: `src/renderer/public/js/dialogs.js:342-418`, `src/renderer/public/js/commands.js:916`

- [ ] **Step 17.1: D.font PM branch.** At the top of `D.font` (dialogs.js:342):

```js
  D.font = function () {
    const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null;
    if (pm) pm.captureSelection(); // the dialog steals focus; restore before applying
    const saved = pm ? null : E().savedRange;
    const st = pm ? pm.getState() : E().queryState();
```
(The `st.computedFontFamily`/`st.computedFontSizePt`/`st.bold`/`st.italic`/`st.strikethrough`
reads at lines 347-355 work unchanged — `toQueryState` provides those keys.)

Replace the OK handler (dialogs.js:411-414):

```js
      { label: 'OK', primary: true, onClick: () => {
        if (pm) {
          const steps = [['setFontFamily', fam.value], ['setFontSize', (parseFloat(size.value) || 11) + 'pt']];
          steps.push([/Bold/.test(styleSel.value) ? 'setBold' : 'unsetBold']);
          steps.push([/Italic/.test(styleSel.value) ? 'setItalic' : 'unsetItalic']);
          if (colorVal) steps.push(['setColor', colorVal]);
          if (underline.value !== 'none') {
            steps.push(['setUnderline']);
            const UL = { double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave' };
            if (UL[underline.value]) steps.push(['setMark', 'underline', { underlineType: UL[underline.value] }]);
          } else steps.push(['unsetUnderline']);
          steps.push([strike.c.checked ? 'setStrike' : 'unsetStrike']);
          pm.withSelection(() => pm.chain(steps)); // ONE transaction = ONE undo step (Word)
          if (sup.c.checked || sub.c.checked || small.c.checked || allc.c.checked
              || scale.value !== '100' || spacing.value !== 'Normal' || position.value !== 'Normal') {
            pm.notifyBlocked('Sub/superscript, caps and Advanced effects');
          }
        } else {
          E().savedRange = saved; E().applyInlineStyles(buildStyle());
          if (sup.c.checked) E().exec('superscript'); else if (sub.c.checked) E().exec('subscript');
        }
        WC.Ribbon.setComboValue('font', fam.value); WC.Ribbon.setComboValue('fontSize', String(parseFloat(size.value) || 11));
      } },
```

- [ ] **Step 17.2: Fix the dead Font launcher** (latent legacy bug — commands.js:916
resolves `WC.Dialogs.fontDialog`, which was never defined):

```js
        font: () => (WC.Dialogs.font ? WC.Dialogs.font() : WC.notImplemented('Font dialog')),
```

- [ ] **Step 17.3: Run** `npm run test:pm` → `[1] Font dialog ... ONE undo step` PASSES.
257 legacy green (the launcher fix only un-breaks a path the suite never asserted; spot-check
`npm run test:legacy`). Commit (`feat(home): Font dialog applies via one chained PM transaction; fix dead Font launcher`).

### Task 18: history keys — double-fire guard + can() greying

**Files:** Modify: `src/renderer/public/js/app.js` (bindKeys), `src/renderer/bridge/state-sync.ts`

(The QAT/keydown PM rewrites themselves moved into Step 16.1 with the area flip.)

- [ ] **Step 18.1: In-view double-fire guard.** When focus is IN the PM view the fork
keymap handles Mod-Z/Y first, then the document-level app.js handler fires again —
double-undo. In `bindKeys` (app.js), insert before `const action = map();`:

```js
      // PM keymaps own the history keys when focus is in the view — stand down.
      if (WC.PM && WC.PM.active && window.WC.view && window.WC.view.dom.contains(document.activeElement)
          && mod && ['z', 'y'].includes(k)) return;
```
Verify by manual test: type 2 words in the PM page, Ctrl+Z once → exactly one word
group reverts (not two).

- [ ] **Step 18.2: QAT greying (fidelity polish)** — in `state-sync.ts`'s `sync()` after the
combo updates:

```ts
    // Real-Word fidelity: QAT undo/redo grey out when the stacks are empty.
    const can = (window as any).WC?.editor?.can?.()
    document.querySelectorAll('.qat .qat-btn').forEach((b: any) => {
      if (/^Undo/.test(b.title)) b.style.opacity = can?.undo?.() ? '' : '0.4'
      if (/^Redo/.test(b.title)) b.style.opacity = can?.redo?.() ? '' : '0.4'
    })
```

- [ ] **Step 18.3: Run** `npm run test:pm` → `[1] QAT undo` PASSES → ALL PM tests green.
Full gates: 257 + smoke ×2 + 17 docx. Commit
(`feat(home): undo/redo flip to engine history (double-fire guard, can() greying)`).

### Task 19: slice-1 validation — oracle protocol + fidelity + wrap-up

- [ ] **Step 19.1: Oracle protocol (spec §8.3), clone → Word.** In the app
(`npx electron .`): type `oracle bold italic georgia`, bold the word `bold`, italicize
`italic`, set `georgia` to Georgia 20pt, Ctrl+S to `/tmp/oracle-clone.docx`. Then:

```bash
node scripts/oracle/word-oracle.js read-props /tmp/oracle-clone.docx --out /tmp/oracle-clone-report.json
```
Expected report: paragraph 1 shows `bold:true` only on the run containing `bold` — Word's
object model reports per-range; spot-check by selecting in Word manually if ambiguous;
fonts/sizes match. Save the JSON into the slice PR.

- [ ] **Step 19.2: Word → clone.** In real Word: new doc, type `from word`, bold `word`,
save `/tmp/oracle-word.docx`. In the clone: Ctrl+O → open it → verify the bold renders and
`WC.PM.debugFormatting()` (devtools) shows the bold mark. Screenshot both apps side-by-side
(`--shot` for the clone) for the UI-fidelity check.

- [ ] **Step 19.2b: Negation-run fixture test (spec §7.5).** In real Word: create a doc
whose paragraph style is bold, with one run explicitly un-bolded (select a word →
Ctrl+B to force bold OFF), save as `tests/fixtures/negation-run.docx` and check it in.
Append the PM-suite test (in the `[1]` block, before `[0b]` — it replaces the doc, so
order it last among `[1]`):

```js
  await t('[1] imported negation run reports bold=false (converter attrs)', async () => {
    const r = await window.wordAPI.openBytes(/* absolute repo path */ window.__WC_FIXTURE_NEGATION || (location.pathname.replace(/out\/renderer.*/, '') + 'tests/fixtures/negation-run.docx'));
    if (!r || !r.ok) return 'open failed: ' + (r && r.error);
    const ok = await PM().openDocx(r.bytes);
    if (!ok) return 'import failed';
    selectText('UNBOLD'); await sleep(120); // the explicitly-not-bold word in the fixture
    return PM().getState().bold === false;
  });
```
(Author the fixture so the un-bolded word is literally `UNBOLD`. If the path resolution
proves brittle under the built app, bake the fixture via `scripts/gen-fixture.js` like
basic-list and expose `window.__WC_FIXTURE_NEGATION` from main.ts instead.)

- [ ] **Step 19.3: Full gates + counts.** All five commands green. Record: legacy 257,
PM suite total (expect ~40: 20 `[0a]` + 13 `[1]` + 7 `[0b]` — adjust to the actual
authored count and record it in the checkpoint), smoke 9+9, docx 17.

- [ ] **Step 19.4: Plan-tracking checkpoint + PR.** Append last-point.md entry (slice 1
done, area `character` flipped, sub/superscript + textEffects deferral noted), tick the
daily log, PR with the oracle JSONs + screenshots.

---

## Post-plan: what the NEXT plan covers (not this one)

Slice 2 (paragraph + lists) onward — written after slice 1 lands, reusing this slice
template. Deferred engine work recorded here: subscript/superscript fork extension,
textEffects, shading (slice 2), page color (slice 10).

## Self-review + plan-critique (done at authoring)

Hardened by a 2-critic adversarial workflow (code-vs-repo + spec-coverage; 21 findings,
all applied): the §7.1a dispatch courtesy block + AREA/FLIPPED registry became Task 4B
(was missing entirely); findPane keeps its real `(replace)` signature (the rewrite would
have broken frozen tests 59-60); PM-mode Save is blocked during the 0a→0b window
(Step 7.1b — wrong-bytes-to-disk hazard); sub/superscript are implemented via
`textStyle.vertAlign` rather than deferred (critic verified rendering support);
wordCount/properties re-point ALL rows; combos capture selection on focusin;
focus guards are idempotent; the focus test asserts `defaultPrevented`; setDoc
strips inherited marks; gridlines gets its CSS twin; §5.3 invariant has 3 tests;
negation-run fixture test added; CLAUDE.md amendment scheduled in 9.2.

1. **Spec coverage:** D1 (T1/T3), D2 (T2), D5 (T3/T16), **D6 two-layer (T4 chokepoints +
   T4B dispatch/keydown/QAT + registry)**, D7 (T16.1/T18), §5.1 all six bridge files
   (T1/T3/T5/T6), §5.2 (T3/T8), §5.3 (T10-T13 + invariant tests), §5.4 (T14), §5.5 (T2),
   §6.C (T4B.2), §7.1-7.8 (T4/T4B/T5/T7/T8), §8.1 gates (header + every task),
   §8.3 oracle (T19 incl. negation fixture). Slice-1 inventory: bold/italic/
   underline(+styles)/strike (T16.2/16.6), sub/sup via vertAlign (T16.2), clear (T16.2),
   grow/shrink+combos (T16.3), color/highlight (T16.4), changeCase (T16.5),
   textEffects deferred-explicit (T16.7), Font dialog + launcher fix (T17),
   history flip + double-fire guard + greying (T16.1/T18).
2. **Placeholders:** none — every step has code or an exact command; the
   "verify/adjust" steps (5.1 probe, 14.3 AppleScript iteration, gridlines CSS mirror)
   are explicit discovery steps with the authority named, not gaps.
3. **Type consistency:** `WC.PM` surface is identical across files: `active/ready/cmd/
   chain/getState/captureSelection/withSelection/isDirty/setClean/counts/exportDocxBytes/
   openDocx/newBlank/notifyBlocked/isBlocked/isFlipped/AREA/FLIPPED/debugFormatting/
   changeCase`; `PMA()` defined once in commands.js; `pmBlockedOr` defined once in app.js;
   `toQueryState` exported from state-sync and aliased into `PM.getState`.
