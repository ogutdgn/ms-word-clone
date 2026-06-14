# Phase 2 — Slice 11: Legacy Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the dual-world scaffolding so the PM (ProseMirror/SuperDoc-fork) engine is the ONLY editor — remove the `--legacy` boot, the legacy contenteditable `WC.Editor` + its leaf engines, the legacy docx converter, the three legacy test gates, and collapse the dead `pm ? new : legacy` branches — losing **no** feature and keeping Word's look/behavior.

**Architecture:** Surgical subtraction, not a rewrite. The legacy `window.WC` namespace is **not** purely legacy: the ribbon shell, command dispatch (`H[cmd]`), dialogs, util/icons/statusbar/files/backstage/app, several value/state tables (`WC.Design`, `WC.Draw` pens, `WC.Ref` incl. the `THES` thesaurus data, `WC.Clipboard` Office-clipboard store, `WC.Insert` menus), AND the **D6 deferral gate** (`isBlocked`/`notifyBlocked`) are **shared/live and STAY**. We delete the legacy *engines* + the *converter* + the *flag*, collapse the dead `ELSE`/guard branches **in place** inside the kept shared files, and re-point a handful of un-gated doc-touching handlers to honest toasts. Staged, leaf-first, gates re-run after every step so each commit is independently green and bisectable.

**Tech Stack:** Electron 31, electron-vite + TypeScript (renderer), plain CJS (main), the vendored SuperDoc fork (`src/renderer/core/superdoc-fork/`, untouched). Gates: `test:pm` (count will DROP from ~317 as legacy-coupled `[0a]` tests are pruned), `test:smoke` (9), `test:roundtrip` (27). COM oracle: `scripts/oracle/word-oracle-win.ps1` (PID-safe, **positional** args).

---

## Locked decisions (pre-verification + user, 2026-06-14)

1. **`--legacy` flag → remove fully now.** Only consumers are the retiring gates. Archive `scripts/test-suite.js` (257) via a git tag, then delete.
2. **Legacy docx converter → delete now**, isolated commit, only after `test:roundtrip` is confirmed green. **Keep `jszip`** (shared with the fork) and `doc:open`'s csv/txt/html branches (mail-merge + Insert "Text from File" use them).
3. **Dead-branch collapse → incremental, file-by-file**, gates after each file.
4. **Scope → retire only.** Leave the shared `window.WC` chrome as classic `<script>` tags; DEFER the `window.WC`→TS/ESM migration to a future slice.

## The two hard constraints (never violate)

1. **UI fidelity:** keep looking/behaving like Word.
2. **Feature preservation:** lose **no** already-implemented feature.

---

## ⚠️ Critical correction folded from the plan critique (read before executing)

The naive premise "single-world ⇒ every area is flipped ⇒ `isBlocked`/the whole D6 registry is dead" is **FALSE**. `FLIPPED` (`bridge/index.ts:47`) has **15** area keys but the `AREA` map (`index.ts:~48-141`) contains **4 more areas that were never flipped** — **`layout-page`, `layout-arrange`, `header-footer`, `text-effects`** (Phase-7-deferred). For those, `isBlocked(cmd)` returns **true** and the dispatch-head guard (`commands.js:1362/1371/1584`: `if (WC.PM.active && WC.PM.isBlocked(cmd)) { WC.PM.notifyBlocked(...); return }`) is the **only** thing stopping ~25 *un-guarded* handlers (`H.margins/orientation/size/columns/breaks`, `H.header/footer/pageNumber/goToHeader/goToFooter`, `H.position/wrapText/bringForward/sendBackward/align/group/rotate/selectionPane/lineNumbers/hyphenation`, plus the `breaksMenu`/`lineNumbers` builders that call `E()`) from invoking the now-deleted `WC.HeaderFooter`/`WC.Layout`/`E()` and **crashing on click**. The kept gates do NOT click these controls, so the regression would ship silently.

**Therefore:** the **block half of D6 (`isBlocked` + `notifyBlocked` + the deferred-area mappings) is a LIVE Phase-7 feature and STAYS.** Only the vestigial flip-tracking (`FLIPPED`/`isFlipped`) is retired (Task 8), and `isBlocked` is rewritten against a static `DEFERRED` set. Separately, a few doc-touching handlers are **not** in `AREA` (so not gated) — `H.dictate`/`H.dictateMenu`/`H.sensitivity` — and must be re-pointed to honest toasts in lockstep with the `WC.Editor` deletion (Task 4).

---

## File inventory (the surgical map)

### A. DELETE — legacy-only, reached only via dead `ELSE` arms OR via still-`isBlocked` handlers

| File | Role | Safe because |
|---|---|---|
| `src/renderer/public/js/editor.js` | Legacy `WC.Editor` (contenteditable + pagination + execCommand) | `smoke-pm.js:12` + `failBridge` (index.ts:~627-631) + `test-suite-pm.js [0a]` reference it → fix in lockstep (Task 4). |
| `src/renderer/public/js/formatting.js` | `WC.formatBlock`/`WC.applyNamedStyle` on `#editor` | PM uses `pm.applyStyleByName`. Reached only via dead `ELSE`. |
| `src/renderer/public/js/table-tools.js` | Legacy table editing on `#editor` `<table>` | Every method `pmBlock()`-guards; **zero** `WC.Table` refs in commands.js/bridge (verified). PM tables = `bridge/table.ts` + `table-tools-pm.js` (KEEP). |
| `src/renderer/public/js/header-footer.js` | `WC.HeaderFooter.*` on `#editor` | All `H.*` callers are in the `header-footer` **deferred** area → `isBlocked`-gated (stays). Bodies never execute in PM. |
| `src/renderer/public/js/layout-tools.js` | `WC.Layout.*` (margins/orientation/columns/breaks/arrange) | All callers in `layout-page`/`layout-arrange` **deferred** areas → `isBlocked`-gated (stays). Bodies never execute. (`app.js:192` `WC.Layout.initSelection` is `if (WC.Layout && …)`-guarded → safe no-op.) |
| `src/renderer/public/js/comments.js` | Legacy comment anchors in `#editor` | Superseded by `bridge/comments-ui.ts`. Consumers are only editor.js (deleted) + a bridge comment. `WC.commentsViewMode` is owned by comments-ui.ts (survives). |
| `src/main/docx-utils.js` | Legacy html-to-docx post-processing | Sole callers: `writeDocx` + `test_docx.js`. **`jszip` STAYS** (used by `injectComments` + the fork). |
| `scripts/test_docx.js` | The `test:docx` gate | Retires with the converter. |
| `scripts/export_ref.js`, `scripts/analyze_import.js` | Dev/oracle helpers (`html-to-docx`/`mammoth`) | Not wired to any gate. |
| `scripts/test-suite.js` | Frozen 257 legacy functional suite | **Git-tag-archive first** (Task 1), then delete. |

> **NOT on the delete list** (the critique moved these OUT — they are CONFLICT-KEEP, §B): `review-tools.js` (owns `WC.Review.THES`), `home-features.js` (owns `WC.Clipboard`).

### B. CONFLICT-KEEP — mode-aware: prune dead legacy methods; PRESERVE the data/state/UI the PM path reads

| File | PRESERVE (PM reads at runtime) | PRUNE |
|---|---|---|
| `design-tools.js` | `WC.Design.{THEMES, COLOR_SCHEMES, FONT_PAIRS, SPACING, STYLE_SETS}` (commands.js:544-566 PM path) + `WC.setThemeColors` (:153, used by `bridge/design.ts`) + `WC._themeAccents` | **Every method whose body references `E()`**: `snapshot`/`restore` (:66/:78), `applyTheme`/`applyColorScheme`/`applyFontPairing`/`applyParagraphSpacing`/`applyStyleSet`, `pageColor`/`pageBorders`/`watermark`/`removeWatermark`/`setAsDefault`. Grep `E()` in the file → must be 0 after. |
| `insert-features.js` | The `WC.Insert.*Menu`/`*Dialog` UI shells (`H.coverPage/shapes/icons/wordart/...` dispatch into them UNGUARDED, commands.js:228-246; they branch internally to `pm.*`) | the internal legacy `ELSE` arms only |
| `draw-tools.js` | `WC.Draw.PENS` (:235, array) + `WC.Draw.customPens` (:24) + `WC.Ribbon._renderPens` (read commands.js:501/521/538) | the legacy ink-engine `E()`-node methods |
| `references-tools.js` | `WC.Ref.citationStyle` (:12) + `WC.Ref.sources` (:13) — written/read in PM (commands.js:773) — **AND `WC.Review` is separate (below)** | the `WC.Ref.*` apply methods (`insertTOC/insertNote/...`, dead `ELSE`). Grep-confirm PM uses `pm.refListSources`/`pm.refInsertCitation` (commands.js:757) before pruning `addSource`. |
| **`review-tools.js`** (NEW conflict-keep) | **`WC.Review.THES`** (:126 thesaurus data) — read by the PM Thesaurus dialog `pmThesaurus()` at commands.js:976 (review IS flipped → runs in PM). Re-check `pmAccessibility` (commands.js:~1009) for other `WC.Review.*` PM reads. | the legacy Track-Changes engine (DOM metadata + beforeinput) + `WC.Review.thesaurus`/other apply methods. (`WC.pmMarkup`/`WC.pmTrackLock` are NOT here — owned by dialogs.js/commands.js.) **Option:** relocate `THES` into `commands.js` (`pmThesaurus`) and then delete review-tools.js — decide in Task 6. |
| **`home-features.js`** (NEW conflict-keep) | **`WC.Clipboard`** (:8-35: `.items/.capture/.pasteAll/.clear/.paste/.remove/.onChange`) — the Office Clipboard 24-item store read by `WC.Dialogs.clipboardPane` (dialogs.js:638-665), reachable UNBLOCKED via the clipboard launcher (commands.js:1587). **`bridge/clipboard.ts` does NOT define `WC.Clipboard`** (the "duplicated" claim was FALSE). | `WC.Dictate` + the sensitivity menu (both `E()`-bound). Their handlers `H.dictate/H.dictateMenu/H.sensitivity` are re-pointed to toasts in Task 4; prune the now-dead methods here in Task 6. |

> **Pre-existing gap to record (not a slice-11 regression):** `WC.Clipboard.capture()` was triggered by `editor.js:60` (deleted Task 4). In PM the Office Clipboard pane still *opens* (we keep `WC.Clipboard`) but auto-capture was already legacy-editor-bound — record in `deferrals.md` (do not regress the pane into a crash).

### C. KEEP — shared chrome (collapse internal `ELSE`/guard branches only)

`commands.js` (the `H[cmd]` hub + `PMA()` def :11), `ribbon.js`, `ribbon-data.js` (generated), `dialogs.js` (KEEP the `WC.pmMarkup`/`WC.pmTrackLock` latch writes), `util.js`, `icons.js` + `icons-fluent.js` (generated), `app.js` (QAT/titlebar/mode-pill/shortcuts + `pmBlockedOr` def :11), `files.js`, `backstage.js`, `statusbar.js`, `00-netlog.js`, `table-tools-pm.js`, `mailings-tools.js` (own `PMA()` copy :10), `vendor/purify.min.js`, all `public/styles/*.css`. The 3 surviving test scripts. **`bridge/index.ts`** keeps `isBlocked`/`notifyBlocked` (Task 8 reframes, doesn't delete).

### D. EDIT (boot/config/IPC)

`src/main/main.js` (flag 118-126; converter: `require('./docx-utils')` :7, lazy `mammoth`/`htmlToDocx` :11, `openPath` docx branch 254-303, `writeDocx` 336, `doc:save` 387, `doc:saveAs` 397 — KEEP `doc:saveBytes`/`openBytes`/`saveTextFile`/`askSavePath`/`exportPdf`/`print` 422-525), `src/main/preload.js` (remove `wordAPI.save`/`saveAs`; KEEP `wordAPI.open`; comment :6), `src/renderer/bridge/mode.ts` (delete), `src/renderer/bridge/index.ts` (legacyBoot :4/:267/:378/:387, `failBridge` 623-632 incl. `WC.PM.active=false` :627, `notifyBlocked` toast text :258, D6 47-143), `src/renderer/index.html` (delete `#editor` :26 + 7 `<script>` tags: 6 leaf in Task 3 + editor.js :47 in Task 4), `electron.vite.config.ts` (`copyDocxUtilsPlugin` 11-21 + registration :110 + the inline comment :108-109), `package.json` (scripts 14/17/18 + deps html-to-docx :26 / mammoth :28; `npm install`), `scripts/smoke-pm.js` (:12 sentinel), `scripts/test-suite-pm.js` (prune `[0a]` legacy + isFlipped/isBlocked tests — Tasks 4 & 8), `scripts/gen.js` (:111 generator template — Task 9).

---

## The collapse transform rule (Tasks 6–7)

For the FLIPPED areas, `PMA()` always returns the live bridge, so dual branches reduce mechanically:

```js
// BEFORE:                                              // AFTER:
const pm = PMA(); pm ? pm.cmd('bold') : E().exec('bold');   →   WC.PM.cmd('bold');
pm ? pm.deApplyTheme(t) : WC.Design.applyTheme(t);          →   WC.PM.deApplyTheme(t);   // KEEP the WC.Design.THEMES read that produced t
```

**Rules:**
1. Keep the PM branch; delete the legacy `ELSE` arm + the now-pointless `const pm = PMA();` ternary.
2. **NEVER delete a shared-state read/write** even next to a collapsed branch. Explicit preserve list (grep before/after each file): `WC.Design.*` reads (commands.js:544-566), `WC.Draw.PENS`/`_renderPens` (501/521/538), `WC.Ref.citationStyle = s`/`WC.Ref.sources` (773/767), **`WC.pmMarkup` (commands.js:1139)** + **`WC.pmTrackLock` (commands.js:304/1474; dialogs.js:831/850/868/1040)**, `WC.Review.THES` read (976), `WC.Clipboard.*` (dialogs.js:638-665), `WC.Insert.*` dispatch (228-246, do NOT "collapse" to a PM call — the dialog branches internally).
3. Preserve `WC.PM`'s null-safety — `WC.PM.cmd(...)` already no-ops pre-mount; don't introduce raw `pm.x` that throws before `WC.PM.ready`.
4. **Do NOT touch the `isBlocked` dispatch-head guards (commands.js:1362/1371/1584)** — they gate the deferred areas (live feature).
5. One file per commit; `npm run build && npm run test:pm && npm run test:smoke` after each.

---

## Task 0: Baseline + `[11]` guard tests

**Files:** Modify `scripts/test-suite-pm.js` (append `[11]` block).

- [ ] **Step 1: Record the green baseline.**
```
npm run build
npm run test:legacy ; npm run test:docx        # 257 ; 17 — last green runs of the RETIRING gates (for the record)
npm run test:pm                                # ~317
npm run test:smoke ; npm run test:smoke:legacy # 9 ; 9
npm run test:roundtrip                         # 27
```
Re-run any flake idle.

- [ ] **Step 2: Open `design-tools.js`/`draw-tools.js`/`references-tools.js`/`review-tools.js`/`home-features.js` and confirm the EXACT symbol names** (verified by the critique: SCREAMING_CASE — `WC.Design.THEMES/COLOR_SCHEMES/FONT_PAIRS/SPACING/STYLE_SETS`, `WC.Draw.PENS`/`customPens`, `WC.Ref.citationStyle`/`sources`, `WC.Review.THES`, `WC.Clipboard.items`/`pasteAll`). Then append the `[11]` block (copy the file's existing `t('[NN] name', () => …)` harness shape exactly):

```js
// [11] Legacy retirement — single-world invariants + conflict-file/feature survival guards.
t('[11] PM is the only world', () => window.WC.PM && window.WC.PM.active === true && window.WC.PM.ready === true);
t('[11] body is pm-active', () => document.body.classList.contains('pm-active'));
t('[11] legacy WC.Editor is retired', () => typeof window.WC.Editor === 'undefined');                 // RED until Task 4
t('[11] Design themes table survives', () => Array.isArray(window.WC.Design.THEMES) && window.WC.Design.THEMES.length > 0);
t('[11] Design color/font/spacing/styleset tables survive', () => Array.isArray(window.WC.Design.COLOR_SCHEMES) && window.WC.Design.COLOR_SCHEMES.length > 0 && Array.isArray(window.WC.Design.FONT_PAIRS) && !!window.WC.Design.SPACING && !!window.WC.Design.STYLE_SETS);
t('[11] setThemeColors survives (bridge/design.ts dep)', () => typeof window.WC.setThemeColors === 'function');
t('[11] Draw pen registry survives', () => Array.isArray(window.WC.Draw.PENS) && window.WC.Draw.PENS.length > 0 && Array.isArray(window.WC.Draw.customPens));
t('[11] Ref shared-state slots survive', () => typeof window.WC.Ref.citationStyle === 'string' && Array.isArray(window.WC.Ref.sources));
t('[11] Insert menu UI shell survives', () => !!window.WC.Insert && typeof window.WC.Insert === 'object');
t('[11] Thesaurus data survives (WC.Review.THES)', () => !!window.WC.Review && !!window.WC.Review.THES && typeof window.WC.Review.THES === 'object');  // if THES is relocated in Task 6, update this to the new home
t('[11] Office Clipboard store survives', () => !!window.WC.Clipboard && Array.isArray(window.WC.Clipboard.items) && typeof window.WC.Clipboard.pasteAll === 'function');
t('[11] deferred Phase-7 areas still honestly blocked', () => window.WC.PM.isBlocked && window.WC.PM.isBlocked('header') === true && window.WC.PM.isBlocked('margins') === true);
t('[11] command hub intact (Commands.run does not throw)', () => { window.WC.Commands.run('bold'); return window.WC.view.state.doc.content.size > 0; });
```

- [ ] **Step 3: Run + confirm the mix.** `npm run build && npm run test:pm` → `[11] legacy WC.Editor is retired` FAILS (RED, editor.js still loads); all other `[11]` PASS (data exists today; the deferred-block guard proves `isBlocked` works). If a non-inversion `[11]` fails, fix the property name before committing.

- [ ] **Step 4: Commit.**
```bash
git add docs/superpowers/plans/2026-06-14-phase2-slice-11-legacy-retirement.md scripts/test-suite-pm.js
git commit
# subject: test(legacy-retire): slice-11 plan + [11] single-world/feature-survival guards (1 red: WC.Editor retired)
```

> NOTE on the `test:pm` count: legacy-coupled `[0a]` tests are pruned in Tasks 4 & 8, so the suite total will **drop** (then `[11]` adds ~13). Do not assert "stays ~317"; record the new total at each commit.

---

## Task 1: Remove the `--legacy` flag + boot bifurcation

**Files:** `src/main/main.js:118-126`; delete `src/renderer/bridge/mode.ts`; `src/renderer/bridge/index.ts:4,258,267,378,387`; `package.json:14,17`; archive+delete `scripts/test-suite.js`. **(No CSS edits here — see Task 4.)**

- [ ] **Step 1: Archive the 257-suite.** `git tag -a legacy-suite-257-archive -m "Frozen 257-test legacy suite at slice-11 retirement"`
- [ ] **Step 2: `main.js`** — delete the flag parse + `?legacy=1` forwarding (118-126); load the renderer unconditionally (dev: `loadURL(process.env.ELECTRON_RENDERER_URL)`; prod: `loadFile` with no query arg — re-confirm the exact signature in situ).
- [ ] **Step 3: `bridge/index.ts`** — remove the `legacyBoot` import (:4); `:267` `active: !legacyBoot,` → `active: true,`; `:378` → `document.body.classList.add('pm-active')` (unconditional — **keep this call**; the CSS `body.pm-active` gates stay harmless); `:387` delete the `if (legacyBoot) { PM.ready = true; return PM }` early-return.
- [ ] **Step 4: `bridge/index.ts:258`** — reword the `notifyBlocked` toast that references `--legacy` (e.g. → `'This action isn't available on the new engine yet.'`). (`notifyBlocked` STAYS — live for deferred areas.)
- [ ] **Step 5: Delete `mode.ts`.** Grep the tree: `Grep "from './mode'|@/bridge/mode|legacyBoot"` → expect ZERO live imports (comments may remain). Fix stragglers.
- [ ] **Step 6: `package.json`** — delete `test:legacy` (:14) + `test:smoke:legacy` (:17).
- [ ] **Step 7: Delete `scripts/test-suite.js`** (archived in the tag).
- [ ] **Step 8: Gates.** `npm run build && npm run test:pm && npm run test:smoke && npm run test:roundtrip` → green (`[11]` still 1 red; smoke 9/9 — editor.js not yet deleted so the sentinel still passes).
- [ ] **Step 9: Commit.**
```bash
git add src/main/main.js src/renderer/bridge/index.ts package.json
git rm src/renderer/bridge/mode.ts scripts/test-suite.js
git commit
# subject: refactor(legacy-retire): remove --legacy flag + boot bifurcation; retire test:legacy/test:smoke:legacy (archived in tag); reword notifyBlocked
```

---

## Task 2: Audit doc-touching handlers (verify-and-fix, gates the deletions)

Goal: prove that after deleting the legacy engines, **no PM-reachable handler invokes a deleted engine**. The protection is `isBlocked` for deferred-area handlers; un-gated ones must be re-pointed.

- [ ] **Step 1: Enumerate.** Grep `commands.js` for every `H.<x>` whose body calls `WC.HeaderFooter`/`WC.Layout`/`WC.Dictate`/`E()`/`WC.formatBlock`. For each, determine its `AREA[cmd]` (from `bridge/index.ts`) and whether `isBlocked(cmd)` returns true.
- [ ] **Step 2: Classify.** (a) **Gated** (area ∈ {`layout-page`,`layout-arrange`,`header-footer`,`text-effects`}) → safe; the body never runs (record the list as evidence). (b) **Un-gated and doc-touching** → must be re-pointed to a toast in Task 4. The pre-verification found: **`H.dictate` (342), `H.dictateMenu` (1393), `H.sensitivity` (343)**. Confirm there are no others (e.g. any `formatBlock`/`E()` caller not in a deferred area and not behind `PMA()`).
- [ ] **Step 3:** Record the two lists in the Task-3/Task-4 commit bodies. (No code commit here unless Step 2 finds an un-gated handler that must be fixed before its engine is deleted — if so, re-point it to a toast in its own small commit now.)

---

## Task 3: Delete the leaf legacy engines (5 files)

**Files:** delete `comments.js`, `formatting.js`, `table-tools.js`, `layout-tools.js`, `header-footer.js`; remove their `<script>` tags from `index.html` (lines ~48/52/54/57/62). **NOT editor.js (Task 4), NOT review-tools.js / home-features.js (conflict-keep).**

- [ ] **Step 1:** `git rm` the 5 files.
- [ ] **Step 2:** Remove the 5 matching `<script src="/js/…">` lines in `index.html` (keep editor.js for now; keep review-tools.js, home-features.js, table-tools-pm.js).
- [ ] **Step 3: Gates.** `npm run build && npm run test:pm && npm run test:smoke && npm run test:roundtrip` → green. (header-footer/layout handlers are `isBlocked`-gated so their bodies never run; comments/formatting/table-tools reached only via dead `ELSE`.) `[11]` unchanged (1 red); the `[11] deferred areas still blocked` guard must stay GREEN (proves the gate still protects the deleted-engine handlers).
- [ ] **Step 4: Commit.**
```bash
git add src/renderer/index.html
git commit
# subject: refactor(legacy-retire): delete leaf legacy engines (comments/formatting/table-tools/layout/header-footer)
# body: Task-2 evidence — header-footer/layout handlers stay isBlocked-gated; comments/formatting/table-tools reached only via dead ELSE
```

---

## Task 4: Delete `WC.Editor` + lockstep the kept-gate couplings

**Files:** delete `editor.js`; `index.html` (editor.js tag :47 + `#editor` div :26); `scripts/smoke-pm.js:12`; `bridge/index.ts:623-632` (`failBridge`); `scripts/test-suite-pm.js` (`[0a]` legacy tests); `commands.js` (`H.dictate`/`H.dictateMenu`/`H.sensitivity` → toast); `public/styles/editor.css` (dead `#editor` rules, with a visual gate).

- [ ] **Step 1: `failBridge` (index.ts:623-632)** → toast-only; **KEEP `if (w.WC?.PM) w.WC.PM.active = false`** and `classList.remove('pm-active')`; drop ONLY the `WC.Editor.node/.focus` fallback (629-631):
```ts
export function failBridge(err: unknown) {
  console.error('[wc] PM bridge mount failed', err)
  const w = window as any
  if (w.WC?.PM) w.WC.PM.active = false
  document.body.classList.remove('pm-active')
  try { w.WC?.toast?.('Editor failed to load — please restart the app.') } catch {}
}
```
(Re-read 623-632 first; preserve any other cleanup.)

- [ ] **Step 2: `smoke-pm.js:12`** → single-world assertion: `t('WC core present (single-world)', () => !!window.WC && !!window.WC.PM && !!window.WC.Commands);`

- [ ] **Step 3: Prune the legacy-coupled `[0a]` tests in `test-suite-pm.js`** (they reference the deleted `WC.Editor`/`#editor`): delete `[0a] legacy #editor hidden but laid out` (~91-94), the three `[0a] D6 guard: legacy exec/setHTML/undo blocked` (~99-110), and in `[0a] invariants` (~159-160) drop the `&& !!window.WC.Editor` clause (keep `!!window.WC.Ribbon`). Leave the `[0a] D6 dispatch-block` tests (~161-173) for Task 8.

- [ ] **Step 4: Re-point the un-gated doc-touching handlers** (from Task 2) in `commands.js`: `H.dictate` (342), `H.dictateMenu` (1393), `H.sensitivity` (343) → `WC.toast('… available in a future update')`. (Their `WC.Dictate`/sensitivity methods in home-features.js are pruned in Task 6; `WC.Clipboard` stays.)

- [ ] **Step 5: Delete editor.js + `#editor`.** `git rm src/renderer/public/js/editor.js`; in `index.html` remove the editor.js tag (:47) and the `<div id="editor" …>…</div>` (:26) — **keep `#pages`**: `<div id="pages"></div>`.

- [ ] **Step 6: Dead `#editor` CSS (with a visual gate).** In `editor.css`, the `body.pm-active #pm-editor`/footnote/ink rules STAY (the class is always present). Delete only the legacy `#editor …` doc-styling rules (~120-208: `#editor h1/h2/.doc-title/table/blockquote/ul/ol/li/a/img`) **after** confirming the PM engine styles those via the fork schema, not these rules. **Visual gate:** `npm run build` then capture `electron . --shot=C:\tmp\wc-s11-css.png --shot-delay=1400` on a headings+table+list doc and eyeball it (and/or COM-oracle a saved copy) — no visual regression. If anything regresses, keep the relevant rule (re-scoped to `#pm-editor`).

- [ ] **Step 7: Grep residual live `WC.Editor`.** `Grep "WC\.Editor" src/renderer/bridge src/renderer/main.ts scripts/smoke-pm.js scripts/test-suite-pm.js` → only dead `commands.js` `ELSE` arms remain (collapsed Task 6). No bridge/PM-path/test reference may remain.

- [ ] **Step 8: Gates.** `npm run build && npm run test:pm && npm run test:smoke && npm run test:roundtrip` → **`[11] legacy WC.Editor is retired` now GREEN** (all `[11]` green); smoke 9/9 (rewritten :12); roundtrip 27; record the new `test:pm` total (down by the pruned `[0a]` tests).

- [ ] **Step 9: Commit.**
```bash
git add src/renderer/index.html scripts/smoke-pm.js scripts/test-suite-pm.js src/renderer/bridge/index.ts src/renderer/public/js/commands.js src/renderer/public/styles/editor.css
git rm src/renderer/public/js/editor.js
git commit
# subject: refactor(legacy-retire): delete WC.Editor + #editor; failBridge toast-only; prune [0a] legacy tests; re-point dictate/sensitivity to toasts
```

---

## Task 5: Remove the legacy docx converter (isolated, oracle-gated)

**Files:** delete `src/main/docx-utils.js`, `scripts/test_docx.js`, `scripts/export_ref.js`, `scripts/analyze_import.js`; `main.js` (7, 11, 254-303, 336-415); `electron.vite.config.ts` (11-21, 108-110); `package.json` (deps + `test:docx`). (preload `save`/`saveAs` removed in Task 7 with the files.js collapse — see note.)

- [ ] **Step 1: Confirm the replacement gate green.** `npm run build && npm run test:roundtrip` → 27.
- [ ] **Step 2: Prove no PM caller hits the legacy IPC.** `Grep "doc:open|doc:save|doc:saveAs" src/renderer/bridge/io.ts src/main/preload.js src/renderer/public/js/files.js` — confirm PM open/save use `doc:openBytes`/`doc:saveBytes`/`doc:saveTextFile`; `doc:save`/`doc:saveAs` appear only in files.js legacy `ELSE` arms; `doc:open` (csv/txt/html) is used UNGUARDED by `mailings-tools.js:42` + `insert-features.js:398` (KEEP it).
- [ ] **Step 3: `main.js` — strip the mammoth `.docx` branch of `openPath`/`doc:open` (254-303), KEEP csv/txt/html.** Remove the `mammoth` lazy-load + `convertToHtml` docx arm; for a `.docx` arg, error/toast directing through `doc:openBytes` (PM docx opens already use `openBytes`, never `openPath`).
- [ ] **Step 4: `main.js` — delete the legacy save path.** Remove `require('./docx-utils')` (:7), the `htmlToDocx`/`mammoth` holders (:11), `writeDocx` (336-362), the `flattenNestedTables` caller (363-385), `doc:save` (387) + `doc:saveAs` (397). KEEP `doc:saveBytes`/`openBytes`/`saveTextFile`/`askSavePath`/`exportPdf`/`print` (422-525).
- [ ] **Step 5: `electron.vite.config.ts`** — delete `copyDocxUtilsPlugin` (11-21), remove it from `main.plugins` (:110), and update BOTH stale comments (the block 5-10 AND the inline `// externalizeDepsPlugin: keep node deps (html-to-docx, mammoth, …)` at 108-109). Leave `externalizeDepsPlugin()`.
- [ ] **Step 6: `package.json`** — remove `html-to-docx` (:26) + `mammoth` (:28) + `test:docx` (:18). **KEEP `jszip`.** **Orphaned-dep audit:** grep `src/` for live importers of `he`, `rehype-parse`, `rehype-remark`, `remark-gfm`, `remark-parse`, `unified` — these are likely fork/markdown-import deps; remove ONLY any with zero live importer. `npm install` to refresh the lockfile.
- [ ] **Step 7: Delete the scripts.** `git rm src/main/docx-utils.js scripts/test_docx.js scripts/export_ref.js scripts/analyze_import.js`
- [ ] **Step 8: Gates.** `npm run build && npm run test:pm && npm run test:smoke && npm run test:roundtrip` → green; roundtrip 27 proves the fork converter is the sole faithful docx path.
- [ ] **Step 9: COM oracle (Leg A — converter faithful with legacy gone).** Author a PM doc (bold + table + list + image), save via PM to `C:\tmp\wc-slice11-clone.docx`, then (POSITIONAL args):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1 roundtrip C:\tmp\wc-slice11-clone.docx C:\tmp\wc-slice11-resaved.docx
```
Expect `ROUNDTRIP_OK` (Word opens without repair). PID-safe: kill only the spawned WINWORD PID. Write the verdict to `docs/superpowers/plans/notes/2026-06-14-slice11-converter-oracle.json`.
- [ ] **Step 10: Commit.**
```bash
git add src/main/main.js electron.vite.config.ts package.json package-lock.json docs/superpowers/plans/notes/2026-06-14-slice11-converter-oracle.json
git rm src/main/docx-utils.js scripts/test_docx.js scripts/export_ref.js scripts/analyze_import.js
git commit
# subject: refactor(legacy-retire): delete legacy docx converter (html-to-docx/mammoth/docx-utils); retire test:docx; keep jszip + doc:open csv/txt/html
# body: test:roundtrip 27 + COM oracle ROUNDTRIP_OK confirm the fork converter is the sole faithful .docx path
```

---

## Task 6: Collapse `commands.js` + prune the conflict files

**Files:** `commands.js` (collapse PMA sites; keep `PMA()` def or alias); `design-tools.js`, `draw-tools.js`, `references-tools.js`, `review-tools.js`, `home-features.js` (prune per §B).

- [ ] **Step 1: Collapse `commands.js`** per the transform rule (§). Top-to-bottom; keep PM branch, drop legacy `ELSE`. **Honor every preserve item in rule 2** (Design reads, Draw pens, Ref state, `WC.pmMarkup`:1139, `WC.pmTrackLock`:304, `WC.Review.THES`:976, Insert dispatch). **Do NOT touch the `isBlocked` dispatch-head guards (1362/1371/1584).** Remove `PMA()` (:11) LAST only once all sites are rewritten to `WC.PM.x()`, OR keep `PMA()` as a thin `() => WC.PM` alias (document the choice). Build + `test:pm`/`test:smoke`. If a `[11]` data-guard reds, a preserve item was pruned — bisect in-file.
- [ ] **Step 2: Prune `design-tools.js`** — KEEP `{THEMES, COLOR_SCHEMES, FONT_PAIRS, SPACING, STYLE_SETS}` + `WC.setThemeColors` + `WC._themeAccents`; DELETE every method whose body references `E()` (snapshot/restore/applyTheme/applyColorScheme/applyFontPairing/applyParagraphSpacing/applyStyleSet/pageColor/pageBorders/watermark/removeWatermark/setAsDefault). Grep `E()` → 0.
- [ ] **Step 3: Prune `draw-tools.js`** — KEEP `WC.Draw.PENS`/`customPens` (+ the `_renderPens` trigger); DELETE the legacy ink-engine `E()` methods. Grep `E()` → 0.
- [ ] **Step 4: Prune `references-tools.js`** — KEEP `WC.Ref.citationStyle`/`sources`; grep-confirm PM uses `pm.refListSources`/`pm.refInsertCitation`, then DELETE the `WC.Ref.*` apply methods (incl. `addSource`).
- [ ] **Step 5: `review-tools.js`** — decide THES home: EITHER keep the file as a thin module exposing `WC.Review = { THES }` (delete the legacy Track-Changes engine), OR move the `THES` object into `commands.js` `pmThesaurus()` and re-point :976, then `git rm review-tools.js` + its `index.html` tag (:60). Re-check `pmAccessibility` for other `WC.Review.*` PM reads first. Update the `[11] Thesaurus` guard to the chosen home.
- [ ] **Step 6: `home-features.js`** — KEEP `WC.Clipboard` (+ `clipboardPane` wiring intact in dialogs.js); DELETE `WC.Dictate` + the sensitivity menu (their handlers are toasts now). Grep `home-features.js` for `E()` → 0 (Clipboard must not depend on `WC.Editor`; if `capture()` reads the legacy editor, neutralize it to a no-op and record the pre-existing PM-capture gap in deferrals.md — do NOT let the pane crash).
- [ ] **Step 7: Gates after each file** (or batched with per-file verification). `npm run build && npm run test:pm && npm run test:smoke && npm run test:roundtrip` → green, `[11]` green.
- [ ] **Step 8: Commit(s)** (commands.js + the prunes; split if large).
```
# subject: refactor(legacy-retire): collapse commands.js to PM-only; prune dead legacy methods (keep Design/Draw/Ref/THES/Clipboard/Insert data)
```

---

## Task 7: Collapse the remaining shared dispatch (one file per commit, gates after each)

- [ ] **Step 1: `mailings-tools.js`** — collapse its `PMA()` copy (:10) + 12 sites; keep the mail-merge UI. Gates. Commit.
- [ ] **Step 2: `dialogs.js`** — collapse ~37 PMA-bifurcated handlers. **KEEP** the `WC.pmMarkup`/`WC.pmTrackLock` latch writes (831/850/868/1040) + the `WC.Clipboard` reads (638-665). Gates. Commit.
- [ ] **Step 3: `app.js`** — collapse `pmBlockedOr` (:11) + ~13 call sites; collapse the `WC.PM.active` branches in `buildTitleBar`/`bindKeys`/`boot`. **KEEP** the mode pill (`#wc-mode-pill`, ~38-54), QAT, titlebar, shortcuts. Remove the `app.js:195` `Review.init()` skip line (the engine is gone — drop the call). `app.js:192`/`:198` are already guarded → safe. Gates. Commit.
- [ ] **Step 4: `files.js` + `preload.js`** — collapse the 3 IPC-routing `ELSE` arms (open/save/saveAs → PM uses bytes/text). In the SAME commit, remove `wordAPI.save` + `wordAPI.saveAs` from `preload.js` (now unreferenced) — **KEEP `wordAPI.open`** (csv/txt/html) — and update the `preload.js:6` "docx conversion" comment. Gates. Commit.
- [ ] **Step 5: `ribbon.js`** — collapse the `stylePreviewEnter/Leave/Commit` legacy arms (~17-43) + the `syncToggles` legacy-state path; keep the PM getState branch + `_renderPens`. Gates. Commit.
- [ ] **Step 6: `backstage.js`** — collapse PM-aware branches (~31/95); update the info string (~167: "mammoth/html-to-docx" + "contenteditable") → "SuperDoc fork super-converter" / "ProseMirror". Gates. Commit.

---

## Task 8: Reframe the D6 registry (keep the block gate; retire flip-tracking)

**Files:** `src/renderer/bridge/index.ts:47-143,267-272`; `scripts/test-suite-pm.js` (isFlipped/isBlocked/D6 tests).

- [ ] **Step 1: Broaden the grep (src AND scripts).** `Grep "isFlipped|isBlocked|FLIPPED|AREA\[" src scripts` — find every reader, including `test-suite-pm.js` (isBlocked:3617-3620; isFlipped:3943/3976/4128/4246; `[0a]` dispatch-block:161-173).
- [ ] **Step 2: Rewrite `isBlocked` against a static deferred set.** Derive `DEFERRED` = the AREA values NOT in the old `FLIPPED` set (verify by reading the `AREA` map; pre-verification found `{layout-page, layout-arrange, header-footer, text-effects}`):
```ts
const DEFERRED = new Set<string>(['layout-page', 'layout-arrange', 'header-footer', 'text-effects']) // Phase-7-deferred
function isBlocked(cmd: string) { const a = AREA[cmd]; return !!a && DEFERRED.has(a) }
```
KEEP `AREA`, `isBlocked`, `notifyBlocked`, and the `WC.PM.isBlocked` export. DELETE `FLIPPED` (:47) + `isFlipped` (:142) + the `isFlipped` export (:271).
- [ ] **Step 3: Update `test-suite-pm.js`.** Rewrite the `isFlipped` pins (3943/3976/4128/4246) to assert the feature works (e.g. `WC.PM.isBlocked('startMailMerge') === false`) or remove them (redundant with the per-slice feature tests). Keep the `isBlocked` test (3617-3620) — `isBlocked` survives. Keep `[0a]` dispatch-block (161-173) — still valid (margins/header stay blocked). Run `test:pm`.
- [ ] **Step 4: Gates.** `npm run build && npm run test:pm && npm run test:smoke && npm run test:roundtrip` → green; `[11] deferred areas still blocked` stays GREEN.
- [ ] **Step 5: Commit.**
```bash
git add src/renderer/bridge/index.ts scripts/test-suite-pm.js
git commit
# subject: refactor(legacy-retire): D6 becomes the permanent Phase-7 deferral gate (static DEFERRED set); retire FLIPPED/isFlipped
```

---

## Task 9: Docs + checkpoint + graph

- [ ] **Step 1: Single-world doc updates** — `README.md`, `AGENTS.md`, `CLAUDE.md` (drop dual-world box, `--legacy`, `test:legacy`/`test:docx`; gates six→three), `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/architecture/TECH_STACK.md`, `docs/BUILD_AND_RUN.md`, `docs/TESTING.md`, `docs/PAGINATION.md`, `docs/RIBBON.md`, `docs/ICONS.md`, `docs/FEATURES.md`, `docs/NOT_IMPLEMENTED.md`, `docs/PROGRESS.md`, `docs/{HOME,INSERT,DRAW}_TAB.md`. Do NOT hand-edit generated `ribbon-data.js`/`icons-fluent.js`.
- [ ] **Step 2: `scripts/gen.js:111`** — edit the GENERATOR template that emits `NOT_IMPLEMENTED.md` text ("contenteditable + document.execCommand", ".docx export uses html-to-docx") to single-world, else the next `gen` run reintroduces stale claims. (gen.js is a source, editing it is allowed.)
- [ ] **Step 3: Decisions ledger** — `docs/decisions/0005-docx-via-superdoc-converter.md` + a short note in `OPEN_DECISIONS.md` (mark the dual-world ADRs "decision executed"); append the deferred `window.WC`→TS/ESM migration + the Office-Clipboard-PM-capture gap to `docs/plan/deferrals.md`.
- [ ] **Step 4: plan-tracking checkpoint** — invoke the `plan-tracking` skill: append `last-point.md`; tick `execution-map.md`; advance CURRENT PHASE → "slice 11 DONE / Phase 2 editing core complete → Phase 3 Logger next".
- [ ] **Step 5: Commit docs.** `# subject: docs(legacy-retire): single-world docs; gates six→three; gen.js template; record retirement + deferrals`
- [ ] **Step 6: Refresh the graph** — invoke the `/graphify` skill (NEVER the raw CLI; honors the fork exclusion). Commit.

---

## Task 10: Whole-branch review + PR

- [ ] **Step 1: Final gates (idle).** `npm run build && npm run test:pm && npm run test:smoke && npm run test:roundtrip` → green; record final counts.
- [ ] **Step 2: Leak/feature-loss audit (src AND scripts).** `Grep "--legacy|legacyBoot|WC\.Editor|pmGuard|isFlipped|FLIPPED|html-to-docx|mammoth|docx-utils" src scripts` → only intentional residue (historical comments). Confirm preserved symbols still exist: `WC.Design.THEMES`, `WC.Draw.PENS`, `WC.Ref.citationStyle/sources`, `WC.Review.THES` (or its relocated home), `WC.Clipboard.items`, `WC.PM.isBlocked`, the dialog latches.
- [ ] **Step 3: requesting-code-review** — whole-branch review (this stage caught real bugs in slice 10). Fold fixes.
- [ ] **Step 4: PR into `main`** (merge-commit, like #30/#32/#33). **Ask the user before merging.** After merge: delete the branch; confirm the graph refresh landed.

---

## Self-Review (folded the 3-critic critique 2026-06-14)

**Corrected premises:** D6's block half is LIVE (4 deferred areas) — kept, not deleted (Task 8 reframes). `review-tools.js` (`WC.Review.THES`) + `home-features.js` (`WC.Clipboard`) are conflict-keeps, not deletes. The kept `test:pm` suite has legacy-coupled `[0a]`/isFlipped tests pruned in lockstep (Tasks 4 & 8); the suite total DROPS (don't assert "~317"). `preload.js` save/saveAs removed (Task 7); oracle uses POSITIONAL args; CSS `#editor`-rule deletion deferred to Task 4 behind a visual gate (the `body.pm-active` class add stays, so CSS gates are harmless).

**Spec coverage:** decisions 1/2/3/4 → Tasks 1 / 5 / 6-7 / scope-note. Five+two conflict files each have explicit preserve/prune lists (§B). Un-gated handlers (dictate/sensitivity) → Task 4. Gate disposition (retire 3, keep 3) → Tasks 1/5. Docs+generator → Task 9.

**Placeholder scan:** approximate anchors flagged "~"; each editing step instructs grep-locate + re-confirm. `[11]` probes use exact (critique-verified) property names.

**Type/name consistency:** `WC.PM.cmd`/`PMA`/`legacyBoot`/`failBridge`/`isBlocked`/`notifyBlocked`/`DEFERRED`/`AREA`/`pmBlockedOr`/`pmGuard`/`WC.pmMarkup`/`WC.pmTrackLock` used consistently; gate commands consistent.

**Ordering safety:** flag (1) → leaf engines (3, isBlocked-gated) → editor + lockstep prunes (4) → converter isolated+oracle (5) → collapse per-file (6-7) → D6 reframe + test prune (8). Every commit keeps `test:pm`/`test:smoke`/`test:roundtrip` green; the only cross-file couplings (`WC.Editor` sentinel/failBridge/`[0a]` tests; the `isBlocked`/`isFlipped` tests) are handled in the same commit as their cause.
