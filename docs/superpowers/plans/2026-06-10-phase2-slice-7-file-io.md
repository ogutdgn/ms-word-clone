# Phase 2 Slice 7 — file-io (html/txt/csv on the PM engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-enable non-docx file IO (open `.html/.htm/.txt/.csv/.tsv`, save `.html/.txt`) on the
PM engine, land the PM-converter docx round-trip suite as the new docx gate (demoting
`test_docx.js` to a frozen legacy-converter gate), retire mammoth/html-to-docx/docx-utils from
every PM-mode path, and absorb the slice-4 Word-paste list-marker leak fix.

**Architecture:** Non-docx imports ride the existing `replaceEditor` machinery: a fresh editor is
constructed in `mode:'docx'` from the **blank docx template** (so the OOXML converter context —
styles.xml, numbering, export — stays fully intact) with the fork constructor's **`html` option**,
which routes through `createDocFromHTML` → `htmlHandler` (the same sanitize pipeline as paste).
txt/csv are converted renderer-side to HTML first (`<p>`-per-line / `<table>`). Exports come
straight off the model: `editor.getHTML({unflattenLists:true})` for html, `doc.textBetween` for
txt. The main process stays a dumb fs layer (spec §5.3 bytes-layer philosophy): one new write
channel (`doc:saveTextFile`) + one new dialog channel (`doc:askSavePath`); `doc:openBytes` just
gains dialog filters. The legacy `doc:open/save/saveAs` + mammoth/html-to-docx/docx-utils stay
untouched for `--legacy` (until slice 11).

**Tech stack:** vendored SuperDoc fork (`createDocFromHTML`, `getHTML`, `exportDocx`), bridge TS
(`src/renderer/bridge/`), legacy-chrome JS (`files.js`, `backstage.js`), Electron IPC (main +
preload), probe-harness test suites.

---

## Locked decisions (brainstorm-lite 2026-06-10, verified against code)

| # | Decision | Grounding |
|---|----------|-----------|
| D7.1 | Import = rebuild editor from **blank template + `html` option** (never paste-into-live-doc): fresh history, `setClean` inside `replaceEditor`, converter context preserved → doc stays docx-exportable | `Editor.ts#generatePmData` (~2810): docx mode + `options.html` → `createDocFromHTML`; `importHtml.js:23`; blank-template flow = `bridge/index.ts replaceEditor` |
| D7.2 | Open formats: docx (existing) + html/htm + txt + csv/tsv. Save formats: docx (existing) + html + txt. **No csv save** (Word offers none for documents). `.md/.rtf` stay legacy-only (recorded; the fork's `markdown` option is a cheap future leg) | spec §9.1 row 7; legacy `doc:saveAs` filter set = docx/html/txt |
| D7.3 | **csv/tsv import = a real PM table** (RFC-4180). KNOWN DEVIATION vs real Word (Word opens csv as delimited plain text — oracle leg records the evidence). Legacy parity does NOT exist: legacy `Files.open` of a csv loads a **blank** doc (`r.html` is undefined for csv → `setHTML('<p><br></p>')`) — csv-as-table is net-new, user-directed | `files.js:93`, `main.js openPath` csv leg returns `{csv}` only |
| D7.4 | After csv import: **`path=null`, `format='docx'`, name=basename-stem** (an unsaved imported document). The table representation can't be written back to `.csv`, so binding the path would violate the §5.3 invariant (Save would corrupt). html/txt keep `path` bound + `format` html/text (Save writes the same format back, Word parity) | spec §5.3 invariant |
| D7.5 | Save As goes **two-phase**: `doc:askSavePath` (dialog only → `{filePath, ext}`) then the renderer exports the right payload → `doc:saveBytes` (docx) / `doc:saveTextFile` (html/txt). Serialization stays 100% renderer-side; payloads are lazy. `doc:saveAsBytes` becomes dead and is **removed** (channel + preload + caller in the same commit) | `main.js:432-448`; sole caller `files.js:128` |
| D7.6 | Gate transition: **`test_docx.js` (17) is KEPT but demoted** to the frozen *legacy-converter gate* (guards `--legacy`'s mammoth/html-to-docx path; retires with legacy at slice 11, per §8.2's "legacy tests retire only with their legacy implementation"). The NEW `test:roundtrip` PM-converter suite takes over as THE product docx gate — this is how the spec's "replaces / retired at slice 7" wording is honored: the *role* transfers, the script lives on frozen. Gates become **six**. Recorded here as the reconciliation the spec asked for | spec §8.1 docx row vs §8.2 |
| D7.7 | The round-trip suite lands **before** the file-io swap (spec §8.1: "must land the PM-converter round-trip suite first") | spec §8.1 |
| D7.8 | The slice-4 **Word-paste list-marker leak is absorbed** into this slice (converter-adjacent). CRITIQUE-CORRECTED pipeline fact: in docx mode (our editors — `create-editor.ts:22`), Word-flavored paste HTML routes to **`handleDocxPaste` (docx-paste.js)**, NOT `htmlHandler`/`sanitizeHtml` (`InputRule.js:699-701: case 'word-html' → handleDocxPaste`); docx-paste's own comment strip (`extractAndRemoveConditionalPrefix`, docx-paste.js:338-372) handles only the `<!--[if !supportLists]-->` comment form. Chromium's clipboard sanitizer strips comments from `readHTML`, exposing the marker run Word marks `style="mso-list:Ignore"` — never stripped on this path. ALSO: docx-paste.js:51 unconditionally derefs `tempDiv.querySelector('style').innerHTML` — Word HTML without a `<style>` block throws. **Fix lands in docx-paste.js** (NOTICE'd; optionally also in InputRule.js sanitize for the browser-html leg). Live repro FIRST still mandatory. File-based html import is unaffected (fs reads keep comments; import uses `createDocFromHTML`, not the paste router) | `InputRule.js:699-701`, `docx-paste.js:51, 338-372` (author-verified post-critique); slice-4 checkpoint |
| D7.9 | file-io is **NOT a ribbon area**: no `AREA`/`FLIPPED` registry change. "The flip" of this slice = deleting the two `files.js` blocks (open line 81, save lines 103-105). The `[0a]` D6 tests stay on `newComment`/`tableOfContents` (slices 8/9 repoint). The `newDocWith` mail-merge block **stays** (slice 10) | `files.js:62-67, 81, 103-105` |
| D7.10 | html import fidelity = **semantic** (fork `stripHtmlStyles` keeps structure + alignment, drops other inline styles) — recorded deviation vs Word's rich HTML import; comparable to the legacy mammoth semantics | `htmlSanitizer.js stripHtmlStyles` |

## File structure (what gets created/modified)

```
Create:
  scripts/test-roundtrip-pm.js            # Node driver: spawn electron probe + zip-level asserts
  scripts/test-roundtrip-pm-probe.js      # renderer probe: fixtures → openDocx → export → reopen
  src/renderer/bridge/file-content.ts     # pure helpers: parseCsv, csvToTableHtml, textToParagraphHtml
Modify:
  src/main/main.js                        # openBytes filters; + doc:saveTextFile; + doc:askSavePath; − doc:saveAsBytes
  src/main/preload.js                     # + saveTextFile, askSavePath; − saveAsBytes
  src/renderer/bridge/create-editor.ts    # constructPmEditor(mountEl, parsed, extra?: {html})
  src/renderer/bridge/index.ts            # replaceEditor(source, extra?) + PM.openHtml/openText/openCsv
  src/renderer/bridge/io.ts               # + getHTML(), getText()
  src/renderer/public/js/files.js         # PM open routing, save/saveAs legs, blocks REMOVED, wrapHtml
  src/renderer/public/js/backstage.js     # Browse copy → ".docx, .html, .txt or .csv"
  src/renderer/core/superdoc-fork/core/inputRules/docx-paste/docx-paste.js  # mso-list:Ignore strip + style-deref guard (NOTICE'd)
  src/renderer/core/superdoc-fork/NOTICE.md           # the fork-edit bullet
  scripts/test-suite-pm.js                # [7] block (between [6b] and [0b]); 2 [0b] rewrites; [4] leak test
  package.json                            # "test:roundtrip" alias
  CLAUDE.md, docs/BUILD_AND_RUN.md, docs/TESTING.md, docs/TECH_STACK.md  # six-gate block + converter retirement note
```

## Process rules (every subagent brief MUST carry these)

- **NEVER switch git branches** (work happens on `feature/phase-2-slice-7-file-io`; verify with
  `git branch --show-current` before any edit; a slice-6 reviewer broke this).
- After every Edit to a `.js`/`.ts` file, **byte-check quotes**: `grep -n '[""'']' <file>` must
  come back empty (Edit-tool curly-quote contamination caused a slice-6 syntax error + a silent
  selector bug).
- Never hand-edit `src/renderer/public/js/ribbon-data.js` or `icons-fluent.js` (generated).
- Probe harness contract: the eval'd file's **return value** is written to `--probe-out` —
  `return JSON.stringify(...)`, never console.log.
- Bridge idioms: `installX(editor)` factories; `editor.view?.focus()` refocus; command wrappers
  `return ok !== false`; `import { TextSelection } from '@/pm'` (never window globals).
- Fork edits get a NOTICE.md bullet in the same commit.
- Commits per `.claude/skills/commit-style/SKILL.md` — no AI trailers, explicit `git add <path>`.
- Suites run against the BUILT app: `npm run build` first, always.

---

### Task 0: plan commit

**Files:** Create: `docs/superpowers/plans/2026-06-10-phase2-slice-7-file-io.md` (this file)

- [ ] **Step 1:** `git add docs/superpowers/plans/2026-06-10-phase2-slice-7-file-io.md && git commit` —
  `docs(repo): add the phase-2 slice-7 file-io implementation plan` with a body naming the
  critique workflow + blocker count once hardened.

---

### Task 1: RED tests — `[7]` block + `[0b]` rewrites + `[4]` list-marker pin

**Files:**
- Modify: `scripts/test-suite-pm.js` (insert `[7]` block between the end of `[6b]` (~line 1883)
  and the `[0b]` header (~line 1885); rewrite 2 `[0b]` tests; add 1 `[4]` test after the existing
  paste tests (~line 988))

The suite self-counts (`summary.total` = number of `t()` calls) — no count constant to bump.
**Run, don't trust:** after writing, `npm run build && npm run test:pm` and verify the NEW tests
FAIL (red) and all 192 existing tests still pass.

- [ ] **Step 1: rewrite the two `[0b]` tests whose semantics slice 7 inverts.**
  Replace `'[0b] non-docx format save is blocked in PM mode (path/format untouched)'` and
  `'[0b] Files.open with non-docx preset refuses before touching the engine'` with:

```js
  await t('[0b] unsupported extension open refuses before touching the engine', async () => {
    const f = window.WC.Files; const p0 = f.path;
    const before = window.WC.view.state.doc.content.size;
    const enc = new TextEncoder().encode('# not supported on PM\n');
    const w1 = await window.wordAPI.saveBytes({ filePath: '/tmp/wc-pm-note.md', bytes: enc });
    if (!w1 || !w1.ok) return 'setup failed: ' + (w1 && w1.error);
    await f.open('/tmp/wc-pm-note.md');
    return f.path === p0 && window.WC.view.state.doc.content.size === before;
  });
```
  (`.md` stays legacy-only per D7.2 — the refusal+invariant coverage the old tests carried now
  lives here; the happy-path coverage moves to `[7]`.)

- [ ] **Step 2: add the `[7]` block** between `[6b]` and `[0b]` (these also replace the live doc —
  the whole `[7]`+`[0b]` tail stays LAST, `[0b]` after `[7]`):

```js
  // ---------- slice 7: file-io (html/txt/csv on the PM engine — these replace the live document) ----------
  // CRITICAL (critique blocker): Files.open awaits confirmDiscard(), which opens a MODAL when the
  // doc is dirty — a dirty doc here would hang the whole probe (no JSON, suite never exits). The
  // last [6b] test leaves the doc dirty, so this block MUST start clean (established [5]-block
  // pattern), and every later f.open in [7] must be reached clean (each is preceded by an
  // import or save, both of which setClean — keep it that way when reordering).
  await PM().newBlank(); await sleep(100);

  const writeTextFixture = async (filePath, content) => {
    const w = await window.wordAPI.saveBytes({ filePath, bytes: new TextEncoder().encode(content) });
    return w && w.ok;
  };
  const fileText = async (filePath) => {
    const r = await window.wordAPI.openBytes(filePath);
    if (!r || !r.ok) return null;
    let s = new TextDecoder('utf-8').decode(r.bytes);
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    return s;
  };

  await t('[7] wordAPI exposes the slice-7 channels (saveTextFile + askSavePath)', async () => {
    return typeof window.wordAPI.saveTextFile === 'function' && typeof window.wordAPI.askSavePath === 'function';
  });
  await t('[7] open .html imports headings/bold/list onto the engine (path+format bound)', async () => {
    const f = window.WC.Files;
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>x</title></head><body>'
      + '<h1>Imported Title</h1><p>plain with <strong>bold word</strong></p><ul><li>item one</li><li>item two</li></ul>'
      + '</body></html>';
    if (!(await writeTextFixture('/tmp/wc-pm-import.html', html))) return 'fixture write failed';
    await f.open('/tmp/wc-pm-import.html');
    const txt = window.WC.view.dom.textContent;
    if (!/Imported Title/.test(txt) || !/bold word/.test(txt) || !/item two/.test(txt)) return 'content missing: ' + txt.slice(0, 120);
    const json = JSON.stringify(window.WC.view.state.doc.toJSON());
    if (!/"type":"bold"/.test(json)) return 'bold mark lost';
    return f.path === '/tmp/wc-pm-import.html' && f.format === 'html';
  });
  await t('[7] open .txt imports line-per-paragraph (BOM + CRLF safe)', async () => {
    const f = window.WC.Files;
    // \uFEFF escapes, never raw BOM bytes in source (toolchain-proof — critique fix)
    if (!(await writeTextFixture('/tmp/wc-pm-import.txt', '\uFEFFline one\r\nline two\r\n\r\nline four'))) return 'fixture write failed';
    await f.open('/tmp/wc-pm-import.txt');
    const txt = window.WC.view.dom.textContent;
    if (/\uFEFF/.test(txt)) return 'BOM leaked into the doc';
    if (!/line one/.test(txt) || !/line two/.test(txt) || !/line four/.test(txt)) return 'lines missing: ' + txt.slice(0, 120);
    return f.path === '/tmp/wc-pm-import.txt' && f.format === 'text';
  });
  await t('[7] open .csv imports an RFC-4180 table (quoted comma survives, dims right)', async () => {
    const f = window.WC.Files;
    if (!(await writeTextFixture('/tmp/wc-pm-import.csv', 'name,note\n"Smith, John",hello\nplain,"say ""hi"""\n'))) return 'fixture write failed';
    await f.open('/tmp/wc-pm-import.csv');
    const json = window.WC.view.state.doc.toJSON();
    const tables = (JSON.stringify(json).match(/"type":"table"/g) || []).length;
    if (tables !== 1) return 'expected 1 table, got ' + tables;
    const txt = window.WC.view.dom.textContent;
    if (!/Smith, John/.test(txt)) return 'quoted comma broke: ' + txt.slice(0, 120);
    if (!/say "hi"/.test(txt)) return 'escaped quote broke: ' + txt.slice(0, 120);
    const rows = (JSON.stringify(json).match(/"type":"tableRow"/g) || []).length;
    return rows === 3;
  });
  await t('[7] csv import is an UNSAVED document (path null, format docx, name from stem)', async () => {
    const f = window.WC.Files;
    if (!(await writeTextFixture('/tmp/wc-pm-import2.csv', 'a,b\n1,2\n'))) return 'fixture write failed';
    await f.open('/tmp/wc-pm-import2.csv');
    return f.path === null && f.format === 'docx' && /wc-pm-import2/.test(f.name);
  });
  await t('[7] open .tsv imports a table (tab delimiter sniffed)', async () => {
    const f = window.WC.Files;
    if (!(await writeTextFixture('/tmp/wc-pm-import.tsv', 'x\ty\n1\t2\n'))) return 'fixture write failed';
    await f.open('/tmp/wc-pm-import.tsv');
    const json = JSON.stringify(window.WC.view.state.doc.toJSON());
    return /"type":"table"/.test(json) && /x/.test(window.WC.view.dom.textContent);
  });
  await t('[7] save format html writes a re-importable .html file + cleans the dirty flag', async () => {
    const f = window.WC.Files;
    setDoc('html save payload');
    f.path = '/tmp/wc-pm-save.html'; f.name = 'wc-pm-save.html'; f.format = 'html';
    const r = await f.save();
    if (!r || !r.ok) return 'save: ' + (r && r.error);
    const cleanAfterSave = PM().isDirty() === false;
    const s = await fileText('/tmp/wc-pm-save.html');
    if (!s || !/<!DOCTYPE html>/i.test(s) || !/html save payload/.test(s)) return 'file content wrong: ' + String(s).slice(0, 120);
    await f.open('/tmp/wc-pm-save.html');
    return cleanAfterSave && /html save payload/.test(window.WC.view.dom.textContent);
  });
  await t('[7] save format text writes the model text (multi-paragraph → newline-separated)', async () => {
    const f = window.WC.Files;
    // Two real paragraphs via the txt import leg itself (already covered above), then save back.
    if (!(await writeTextFixture('/tmp/wc-pm-twolines.txt', 'first line\nsecond line'))) return 'fixture write failed';
    await f.open('/tmp/wc-pm-twolines.txt');
    f.path = '/tmp/wc-pm-save.txt'; f.name = 'wc-pm-save.txt'; f.format = 'text';
    const r = await f.save();
    if (!r || !r.ok) return 'save: ' + (r && r.error);
    const s = await fileText('/tmp/wc-pm-save.txt');
    if (!s) return 'file unreadable';
    if (!/first line/.test(s) || !/second line/.test(s)) return 'lines missing: ' + s.slice(0, 80);
    if (!/first line\n+second line/.test(s)) return 'newline separator missing: ' + JSON.stringify(s.slice(0, 40));
    return !/[<>]/.test(s);
  });
  await t('[7] PM html save serializes via PM.getHTML (never the legacy payload path)', async () => {
    // contextBridge-exposed properties are NOT reliably writable (pre-verified: no suite
    // precedent for monkey-patching wordAPI) — spy the PLAIN bridge object instead. Proving
    // Files.save(format html) pulls content from the PM serializer IS the contract: the legacy
    // doc:save path would write the stale offscreen legacy doc.
    const f = window.WC.Files;
    setDoc('isolation probe');
    f.path = '/tmp/wc-pm-iso.html'; f.name = 'wc-pm-iso.html'; f.format = 'html';
    const orig = window.WC.PM.getHTML; let pmCalls = 0;
    window.WC.PM.getHTML = function () { pmCalls++; return orig.call(window.WC.PM); };
    const r = await f.save();
    window.WC.PM.getHTML = orig;
    if (!r || r.ok !== true) return 'save failed: ' + (r && r.error);
    const s = await fileText('/tmp/wc-pm-iso.html');
    return pmCalls >= 1 && !!s && /isolation probe/.test(s);
  });
  await t('[7] PM.getHTML returns serialized body html (no engine chrome)', async () => {
    setDoc('serializer probe');
    const h = PM().getHTML();
    return typeof h === 'string' && /serializer probe/.test(h) && !/ProseMirror/.test(h);
  });
  await t('[7] PM.getText returns plain model text', async () => {
    setDoc('text probe body');
    const s = PM().getText();
    return s.trim() === 'text probe body';
  });
  await t('[7] openHtml→exportDocx round-trip stays a valid zip (converter context intact)', async () => {
    const ok = await PM().openHtml('<p>roundtrip via html import</p>');
    if (ok !== true) return 'openHtml failed';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    const ok2 = await PM().openDocx(bytes);
    return ok2 === true && /roundtrip via html import/.test(window.WC.view.dom.textContent);
  });
  await t('[7] failed save leaves dirty flag + path/format untouched (continuity pin — green both stages)', async () => {
    // Replaces the failed-save invariant coverage the deleted '[0b] non-docx save blocked' test
    // carried (critique gap). Pre-slice: blocked-save returns ok:false; post-slice: the write to
    // a nonexistent dir fails. Both must leave state untouched.
    const f = window.WC.Files;
    setDoc('failed save probe');
    const p0 = '/nonexistent-dir-wc-s7/x.html';
    f.path = p0; f.name = 'x.html'; f.format = 'html';
    const r = await f.save();
    const stateHeld = r && r.ok !== true && f.path === p0 && f.format === 'html' && PM().isDirty() === true;
    f.path = null; f.name = 'Document1'; f.format = 'docx'; PM().setClean(); // restore for [0b]
    return !!stateHeld;
  });
```

- [ ] **Step 3: add the `[4]` list-marker leak pin** (after the existing `[4]` paste tests):

```js
  await t('[4] Word list paste without conditional comments does not leak the literal marker', async () => {
    // Chromium's clipboard sanitizer strips <!--[if !supportLists]--> comments; Word marks the
    // marker run style="mso-list:Ignore" — that form must be stripped too (slice-4 leak).
    setDoc('');
    // Minimal <style> block included (critique blocker): real Word clipboard HTML always carries
    // one, and docx-paste.js:51 unconditionally derefs querySelector('style').innerHTML — without
    // it the fixture throws before any marker logic and the pin could never go green.
    const wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>'
      + '.MsoListParagraphCxSpFirst{margin:0in;} @list l0:level1{mso-level-text:"%1.";}'
      + '</style></head><body>'
      + '<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1">'
      + '<span style="mso-list:Ignore">1.<span style="font:7.0pt Times New Roman">&nbsp;&nbsp;</span></span>'
      + 'Alpha item</p></body></html>';
    const okPaste = await PM().pasteHTMLString(wordHtml); // bridge surface from Task 4 — red until then
    if (okPaste === false) return 'pasteHTMLString unavailable or refused';
    // Assert the MODEL, not the DOM (quality-review critical): a correctly reconstructed list
    // renders a legit "1." marker as NODEVIEW CHROME in the DOM — the leak is a literal marker
    // TEXT NODE in the model.
    const modelText = window.WC.view.state.doc.textContent;
    if (!/Alpha item/.test(modelText)) return 'content missing: ' + modelText.slice(0, 120);
    return !/1\./.test(modelText.replace(/\s+/g, ' ')) || ('literal marker leaked into the model: ' + modelText.slice(0, 80));
  });
```
  *(As landed in commit `860d753`, which also added: tsv 4-cell + csv 6-cell pins, diagnosable
  state-pin returns, a try/finally spy restore, and `PM().setClean()` guards before every `[7]`/
  `[0b]` `f.open` — saves can fail at the RED stage leaving the doc dirty, which would hang the
  probe on the confirmDiscard modal.)*
  *(Executor note: the exact paste entry point is calibrated in Task 6's repro step — the test
  must drive the SAME path real paste uses (`editor.view.pasteHTML(html, pasteEvent(...))` via
  the bridge). If the repro shows the leak reproduces differently — e.g. comments DO survive
  Electron's `readHTML` — rewrite this pin to match the true repro before fixing.)*

- [ ] **Step 4:** `npm run build && npm run test:pm` → expected RED: the 12 feature `[7]` tests +
  the 1 `[4]` pin (13 red). Expected GREEN-from-the-start (continuity pins — do NOT "fix" them):
  the rewritten `[0b]` `.md`-refusal test (current code already refuses all non-docx) and the
  `[7]` failed-save pin (current code's block also returns ok:false with state untouched). All
  192 pre-existing tests stay green. **Expected total: 192 − 2 removed + 1 `[0b]` + 13 `[7]` +
  1 `[4]` = 205.** Record the exact red list.
- [ ] **Step 5:** Commit: `test(editor): red slice-7 file-io tests + [0b] rewrites + list-marker pin`.

---

### Task 2: the PM-converter round-trip suite (`test:roundtrip`) — lands FIRST (D7.7)

**Files:**
- Create: `scripts/test-roundtrip-pm-probe.js` (renderer probe)
- Create: `scripts/test-roundtrip-pm.js` (Node driver)
- Modify: `package.json` (alias), `CLAUDE.md` quick-commands, `docs/BUILD_AND_RUN.md`,
  `docs/TESTING.md` (six gates)

This suite must be GREEN on the current engine (docx→PM→docx already works) — it pins the
converter before the slice touches anything.

- [ ] **Step 1: write the renderer probe.** Same sentinel/probe contract as `test-suite-pm.js`
  (copy its `__WC_READY` poll + `t()` runner skeleton). Fixtures are opened via
  `window.wordAPI.openBytes('<repo-relative path>')` (main resolves relative to cwd = repo root):

```js
  // scripts/test-roundtrip-pm-probe.js — PM-converter docx round-trip suite (slice 7).
  // For each REAL fixture: openBytes → PM.openDocx → exportDocxBytes (zip sanity) →
  // saveBytes to /tmp → reopen → re-import → exportXmlOnly greps for fixture invariants.
  const FIXTURES = [
    // CRITIQUE-CORRECTED: negation-run.docx contains exactly ONE <w:b> and ZERO <w:i> (verified
    // by unzip tag inventory) — grep only what the fixture really carries. MANDATORY sub-step:
    // re-derive every grep below from `unzip -p tests/fixtures/<f>.docx word/document.xml`
    // BEFORE writing the probe; never trust this table blind.
    { path: 'tests/fixtures/negation-run.docx', name: 'negation-run',
      greps: [/<w:b\b/, /<w:rPr>/], textProbe: null },
    { path: 'tests/fixtures/basic-list.docx', name: 'basic-list',
      greps: [/<w:numPr>/, /<w:numId\b/], textProbe: null },
    { path: 'tests/fixtures/oracle-word-s3-table.docx', name: 's3-table',
      greps: [/<w:tbl>/, /<w:tblGrid>/], textProbe: null },
    { path: 'tests/fixtures/oracle-word-s6-tablestyles.docx', name: 's6-tablestyles',
      greps: [/<w:tbl>/, /<w:tblStyle\b/], textProbe: null },
  ];
  // per fixture, four t() checks: import OK · export is a zip · re-import OK · greps hold
  // plus two cross-checks: a text snippet survives the full cycle; exported file lands in
  // /tmp/wc-rt-<name>.docx for the Node driver's zip-level asserts.
```
  Full runner: for each fixture run the cycle, `await window.WC.PM.openDocx(r.bytes)`,
  `const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true })`, grep, then
  `saveBytes({ filePath: '/tmp/wc-rt-' + name + '.docx', bytes })`, reopen+re-import. Return the
  standard `{summary, results}` JSON string.

- [ ] **Step 2: write the Node driver** (`scripts/test-roundtrip-pm.js`): spawn the built app with
  the probe (`require('electron')` gives the binary path; args
  `['.', '--probe-out=/tmp/wc-roundtrip.json', '--shot-evalfile=scripts/test-roundtrip-pm-probe.js']`),
  read the probe JSON, then run **zip-level** asserts on `/tmp/wc-rt-*.docx` via
  `scripts/docx-inspect.js` — NOTE: it is CLI-only (an IIFE printing JSON, no `module.exports`;
  pre-verified), so spawn it per file: `spawnSync(process.execPath, ['scripts/docx-inspect.js', f])`
  and `JSON.parse` stdout (it ships `tableStyles`/`tblStyleRefs` since slice 6). Asserts:
  document.xml parses, `[Content_Types].xml` present, s6 fixture keeps its
  `w:tblStyle` ref **and** its style definition in `word/styles.xml` (the slice-6 minting fix
  pin). Driver hygiene (critique): spawn with explicit `cwd` = repo root (resolve from
  `__dirname/..`) so both the `'.'` app path and the probe's repo-relative `openBytes` fixture
  paths resolve; judge pass/fail ONLY from `/tmp/wc-roundtrip.json` (missing file or
  `summary.fail > 0` ⇒ driver fails) — the electron harness always exits 0. Print per-check
  PASS/FAIL lines + `RESULT: N pass / M fail` (mirror `test_docx.js`'s output shape) and
  `process.exit(fail ? 1 : 0)`.
- [ ] **Step 3:** add the alias to `package.json` scripts:
  `"test:roundtrip": "node scripts/test-roundtrip-pm.js"`.
- [ ] **Step 4:** `npm run build && npm run test:roundtrip` → expect ALL PASS (this is a pin of
  current behavior). If any fixture fails, STOP and report — that is a pre-existing converter
  defect to triage with the user, not something to paper over.
- [ ] **Step 5:** update the gates docs — six gates now; `test:docx` re-captioned "frozen
  legacy-converter gate (--legacy html-to-docx path; retires at slice 11)"; `test:roundtrip`
  captioned "PM-converter docx round-trip (THE docx gate)". Touch ALL the spots that present
  test_docx as the docx gate (critique-enumerated): CLAUDE.md quick-commands block **and**
  working-rule 3 ("Run both suites + scripts/test_docx.js"), AGENTS.md run/test commands block
  (~line 128) **and** its scripts map (~line 79), `docs/BUILD_AND_RUN.md`, `docs/TESTING.md`.
  Record decision D7.6 verbatim in `docs/TESTING.md`, **and add a dated one-line amendment note
  to the spec's §8.1 docx row** (docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md)
  pointing at D7.6, so the authoritative doc isn't silently contradicted.
- [ ] **Step 6:** Commit: `test(docx): land the PM-converter round-trip suite as the docx gate` —
  body records D7.6 (test_docx demoted-not-deleted + why).

---

### Task 3: main-process channels (additive only — nothing removed yet)

**Files:** Modify: `src/main/main.js`, `src/main/preload.js`

- [ ] **Step 1:** widen `doc:openBytes` dialog filters (main.js ~457):

```js
        filters: [
          { name: 'All Supported', extensions: ['docx', 'html', 'htm', 'txt', 'csv', 'tsv'] },
          { name: 'Word Documents', extensions: ['docx'] },
          { name: 'Web Page', extensions: ['html', 'htm'] },
          { name: 'Plain Text', extensions: ['txt'] },
          { name: 'Data Source (CSV/TSV)', extensions: ['csv', 'tsv'] },
        ], // slice 7: the PM engine now imports html/txt/csv renderer-side (bytes stay raw here)
```

- [ ] **Step 2:** add the two new handlers next to the bytes channels (~line 450):

```js
// slice 7: dumb utf8 writer for PM html/txt saves — serialization lives renderer-side (§5.3).
ipcMain.handle('doc:saveTextFile', async (_evt, { filePath, content }) => {
  try {
    if (!filePath) return { ok: false, error: 'No path' };
    if (typeof content !== 'string') return { ok: false, error: 'No content' };
    await fsp.writeFile(filePath, content, 'utf8');
    await pushRecentFile(filePath);
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

// slice 7: dialog-only half of the two-phase PM Save As (renderer exports per chosen ext).
ipcMain.handle('doc:askSavePath', async (_evt, { suggestedName }) => {
  try {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save As',
      defaultPath: suggestedName || 'Document1.docx',
      filters: [
        { name: 'Word Document', extensions: ['docx'] },
        { name: 'Web Page', extensions: ['html'] },
        { name: 'Plain Text', extensions: ['txt'] },
      ],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    let filePath = res.filePath;
    let ext = path.extname(filePath).replace('.', '').toLowerCase();
    // Word always appends the chosen type's extension — an extensionless typed name gets .docx
    // (otherwise Files.open would later refuse the very file we created).
    if (!ext) { ext = 'docx'; filePath += '.docx'; }
    return { ok: true, filePath, ext };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});
```

- [ ] **Step 3:** expose both in `preload.js` next to the bytes trio:

```js
  saveTextFile: (payload) => ipcRenderer.invoke('doc:saveTextFile', payload),
  askSavePath: (payload) => ipcRenderer.invoke('doc:askSavePath', payload),
```

- [ ] **Step 4:** `npm run build && npm run test:pm` — the `[7]` channel-surface test goes green;
  the rest of `[7]` stays red. `npm run test:legacy` must stay 257 (main.js is shared — additive
  changes only).
- [ ] **Step 5:** Commit: `feat(ipc): slice-7 file-io channels — saveTextFile + askSavePath + open filters`.

---

### Task 4: bridge import/export legs

**Files:**
- Create: `src/renderer/bridge/file-content.ts`
- Modify: `src/renderer/bridge/create-editor.ts`, `src/renderer/bridge/index.ts`,
  `src/renderer/bridge/io.ts`

- [ ] **Step 1:** `file-content.ts` — pure, dependency-free helpers (the bridge must NOT lean on
  legacy `WC.Mail._parseCSV`: legacy modules die in slice 11):

```ts
// file-content.ts — pure converters for slice-7 file IO (no DOM, no legacy deps).
// (No decode helper here: files.js — legacy-chrome JS that can't import bridge TS — inlines its
// own TextDecoder + BOM strip; keeping a duplicate export here would be dead code. Critique fix.)
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Mirrors the legacy main.js txt leg: line-per-<p>, blank line → empty paragraph.
export function textToParagraphHtml(text: string): string {
  return text.split(/\r?\n/).map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`).join('')
}

// RFC-4180 (port of the proven legacy parser, mailings-tools.js:231 — delimiter sniff: tab
// when tabs present and commas absent; quoted fields; "" escape; CRLF tolerant).
export function parseCsv(text: string): string[][] {
  const delim = text.indexOf('\t') >= 0 && text.indexOf(',') < 0 ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export function csvToTableHtml(text: string): string | null {
  const rows = parseCsv(text)
  if (!rows.length) return null
  const cols = Math.max(...rows.map((r) => r.length))
  const body = rows
    .map((r) => `<tr>${Array.from({ length: cols }, (_, i) => `<td>${escapeHtml(r[i] ?? '') || '<br>'}</td>`).join('')}</tr>`)
    .join('')
  return `<table>${body}</table>`
}
```

- [ ] **Step 2:** `create-editor.ts` — thread the html option:

```ts
export type ExtraContent = { html?: string }

export function constructPmEditor(mountEl: HTMLElement, parsed: ParsedDocx, extra?: ExtraContent) {
  return new (Editor as any)({
    element: mountEl,
    mode: 'docx',
    content: parsed.docx,
    mediaFiles: parsed.mediaFiles,
    fonts: parsed.fonts,
    // slice 7: when set, the doc initializes from HTML via createDocFromHTML while the
    // converter keeps the (blank-template) docx context — the doc stays docx-exportable.
    ...(extra?.html ? { html: extra.html } : {}),
    extensions: getStarterExtensions(),
    user: { name: 'local', email: '' },
    isDebug: false,
    telemetry: { enabled: false },
  })
}
```

- [ ] **Step 3:** `index.ts` — generalize `replaceEditor(source, extra?)`:
  - signature `async function replaceEditor(source: ArrayBuffer, extra?: { html?: string }): Promise<boolean>`
  - **CRITIQUE-CORRECTED failure handling — do NOT pre-validate against the live editor.**
    `createDocFromHTML(html, current)` is NOT pure: for any `<ul>/<ol>` it mutates the LIVE
    editor's `word/numbering.xml` part (`flattenListsInHtml` → `ListHelpers.generateNewListDefinition`
    → `mutateNumbering`), so phase-1 prevalidation would pollute the editor we're trying to
    protect. Instead, detect failure IN phase 2 via the fork's own channel: a constructor-internal
    parse failure degrades to a BLANK doc and emits **`contentError`** (`#generatePmData` catch;
    `options.onContentError` is wired at Editor.ts:1497/1590 — author-verified). Without
    detection, a garbage html file would silently bind `Files.path` to a blank doc and the next
    Save would overwrite the user's file (§5.3 data loss).
  - phase-1 cheap guard only: `extra?.html` empty/whitespace ⇒ return false (no teardown).
  - phase 2: thread a flag — `let contentErr = false`; pass
    `onContentError: () => { contentErr = true }` through `constructPmEditor(mountEl, parsed, extra)`
    (create-editor.ts spreads it into the Editor options only when `extra` is present, keeping the
    docx path's default). After construction: `if (extra?.html && contentErr)` → destroy the new
    editor, re-run `constructPmEditor(mountEl, parsed)` WITHOUT extra (the already-parsed blank
    template — keeps PM mode alive with a blank doc instead of failBridge), `installBridge` it,
    and **return false** so `files.js` never binds the path. (User already passed confirmDiscard,
    so landing on a blank doc after a failed import is acceptable; record in deviations.)
  - new PM surface (after `PM.newBlank`):

```ts
  PM.openHtml = (html: string) => replaceEditor(blankArrayBuffer(), { html })
  PM.openText = (text: string) => replaceEditor(blankArrayBuffer(), { html: textToParagraphHtml(text) })
  PM.openCsv = (text: string) => {
    const table = csvToTableHtml(text)
    return table ? replaceEditor(blankArrayBuffer(), { html: table }) : Promise.resolve(false)
  }
  PM.pasteHTMLString = (html: string) => { // [4] leak test + paste-path probes drive THIS
    const ed = current
    if (!ed?.view) return false
    return !!ed.view.pasteHTML(html, pasteEvent({ 'text/html': html, 'text/plain': '' }))
  }
```
  (reuse `pasteEvent` from `clipboard.ts` — export it there if module-local. Also add matching
  no-op stubs to `preinstallBridge()` like every other surface: `openHtml: async () => false`,
  `openText: async () => false`, `openCsv: async () => false`, `pasteHTMLString: () => false`.)

- [ ] **Step 4:** `io.ts` — the export legs:

```ts
  function getHTML(): string {
    // unflattenLists: Word-shaped nested <ul>/<ol> in the exported file.
    return editor.getHTML({ unflattenLists: true })
  }
  function getText(): string {
    const doc = editor.state.doc
    // BOTH break leaves (critique fix): the fork parses <br>/Shift+Enter as `lineBreak` and the
    // page-break span as `hardBreak` — dropping lineBreak would concatenate soft-wrapped words.
    return doc.textBetween(0, doc.content.size, '\n', (leaf: any) =>
      (leaf?.type?.name === 'lineBreak' || leaf?.type?.name === 'hardBreak') ? '\n' : '')
  }
```
  Return them from `installIo`'s object.

- [ ] **Step 5: probe-verify the riskiest assumption NOW** (html-seeded editor exports valid docx):
  `npm run build`, then run a one-off probe evalfile (pattern: write `/tmp/wc-probe-s7.js`, run
  `npx electron . --probe-out=/tmp/wc-probe-s7.json --shot-evalfile=/tmp/wc-probe-s7.js`) that
  returns `JSON.stringify` of: `await WC.PM.openHtml('<h2>probe</h2><table><tr><td>c1</td><td>c2</td></tr></table>')`,
  the doc JSON node types, `(await WC.PM.exportDocxBytes()).length`, and a
  `exportDocx({exportXmlOnly:true})` grep for `<w:tbl>` + the heading text. **If the table or
  heading doesn't survive, STOP — recalibrate the `<td>` HTML shape (e.g. `<td><p>…</p></td>`)
  against what `createDocFromHTML` parses, BEFORE the entry-point task.**
- [ ] **Step 6:** `npm run test:pm` — `[7]` bridge-surface tests (`getHTML`/`getText`/
  `openHtml→exportDocx`) go green; the `files.js`-dependent `[7]` tests stay red.
- [ ] **Step 7:** Commit: `feat(editor): bridge html/txt/csv import + html/text export legs (slice 7)`.

---

### Task 5: entry points — files.js rewrite (THE BLOCK REMOVAL) + backstage copy + saveAsBytes removal

**Files:** Modify: `src/renderer/public/js/files.js`, `src/renderer/public/js/backstage.js`,
`src/main/main.js` (− `doc:saveAsBytes`), `src/main/preload.js` (− `saveAsBytes`)

- [ ] **Step 1: `Files.open` PM branch** (replaces lines 77-89 incl. the line-81 block):

```js
      if (WC.PM && WC.PM.active) {
        if (!(await this.confirmDiscard())) return;
        const r = await window.wordAPI.openBytes(presetPath);
        if (!r || !r.ok) { if (r && r.error) WC.toast('Could not open file', r.error); return; }
        const ext = (r.path.match(/\.([^.\\/]+)$/) || [, ''])[1].toLowerCase();
        let ok = false;
        if (ext === 'docx') ok = await WC.PM.openDocx(r.bytes);
        else if (ext === 'html' || ext === 'htm' || ext === 'txt' || ext === 'csv' || ext === 'tsv') {
          let text = new TextDecoder('utf-8').decode(r.bytes);
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          if (ext === 'html' || ext === 'htm') ok = await WC.PM.openHtml(text);
          else if (ext === 'txt') ok = await WC.PM.openText(text);
          else ok = await WC.PM.openCsv(text);
        } else {
          WC.toast('Unsupported file type on the new engine', 'Use --legacy for .' + ext + ' files');
          return;
        }
        if (!ok) { WC.toast('Could not open file', 'The new engine failed to import it'); return; }
        // Invariant (spec §5.3): `path` only re-points after a successful import — and only at a
        // file the PM doc can be saved back into. A csv imports as a TABLE (not re-writable as
        // csv), so it opens as an UNSAVED document: Save routes to Save As.
        if (ext === 'csv' || ext === 'tsv') {
          this.path = null; this.name = (r.name || 'Document').replace(/\.[^.]+$/, ''); this.format = 'docx';
        } else {
          this.path = r.path; this.name = r.name || 'Document';
          this.format = ext === 'docx' ? 'docx' : (ext === 'txt' ? 'text' : 'html');
        }
        this.updateTitle(); WC.Backstage.close(); WC.toast('Opened ' + (r.name || this.name));
        return;
      }
```

- [ ] **Step 2: `Files.save` PM branch** (replaces lines 102-114 incl. the 103-105 block) + the
  `wrapHtml` helper method on `Files`:

```js
    wrapHtml(body) {
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const title = esc((this.name || 'Document').replace(/\.[^.]+$/, ''));
      return '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + title + '</title></head>\n<body>' + body + '</body></html>';
    },

    async save() {
      if (WC.PM && WC.PM.active) {
        if (!this.path) return this.saveAs();
        try {
          let r;
          if (this.format === 'html') {
            r = await window.wordAPI.saveTextFile({ filePath: this.path, content: this.wrapHtml(WC.PM.getHTML()) });
          } else if (this.format === 'text') {
            r = await window.wordAPI.saveTextFile({ filePath: this.path, content: WC.PM.getText() });
          } else {
            const bytes = await WC.PM.exportDocxBytes();
            r = await window.wordAPI.saveBytes({ filePath: this.path, bytes });
          }
          if (r && r.ok) { this.setClean(); WC.toast('Saved ' + r.name); }
          else WC.toast('Save failed', r && r.error); // title dot intentionally stays — the doc IS still dirty
          return r;
        } catch (e) { const msg = (e && e.message) || String(e); WC.toast('Save failed', msg); return { ok: false, error: msg }; }
      }
      // legacy branch unchanged below …
```

- [ ] **Step 3: `Files.saveAs` PM branch** (two-phase; replaces lines 125-132):

```js
    async saveAs() {
      if (WC.PM && WC.PM.active) {
        try {
          const stem = (this.name || 'Document1').replace(/\.[^.]+$/, '');
          const defExt = this.format === 'html' ? 'html' : this.format === 'text' ? 'txt' : 'docx';
          const pick = await window.wordAPI.askSavePath({ suggestedName: stem + '.' + defExt });
          if (!pick || !pick.ok) return pick || { ok: false };
          let r, fmt;
          if (pick.ext === 'html' || pick.ext === 'htm') {
            fmt = 'html';
            r = await window.wordAPI.saveTextFile({ filePath: pick.filePath, content: this.wrapHtml(WC.PM.getHTML()) });
          } else if (pick.ext === 'txt') {
            fmt = 'text';
            r = await window.wordAPI.saveTextFile({ filePath: pick.filePath, content: WC.PM.getText() });
          } else if (pick.ext === 'docx') {
            fmt = 'docx';
            const bytes = await WC.PM.exportDocxBytes();
            r = await window.wordAPI.saveBytes({ filePath: pick.filePath, bytes });
          } else {
            // Never write docx zip bytes into an arbitrary typed extension (critique: foo.csv).
            WC.toast('Unsupported save format', '.' + pick.ext + ' — choose Word Document, Web Page or Plain Text');
            return { ok: false };
          }
          // path/name/format mutate ONLY on a confirmed write (§5.3).
          if (r && r.ok) { this.path = r.path; this.name = r.name; this.format = fmt; this.setClean(); WC.toast('Saved ' + r.name); }
          else if (r && r.error) WC.toast('Save failed', r.error);
          return r;
        } catch (e) { const msg = (e && e.message) || String(e); WC.toast('Save failed', msg); return { ok: false, error: msg }; }
      }
      // legacy branch unchanged below …
```

- [ ] **Step 4:** backstage.js Browse copy (~line 95) — MODE-AWARE (critique: the pane is shared
  and `.rtf` IS still legacy-openable while a csv opens blank there):
  `text: (WC.PM && WC.PM.active) ? 'Open a .docx, .html, .txt or .csv file from this PC' : 'Open a .docx, .html, .txt or .rtf file from this PC'`.
- [ ] **Step 5:** remove `doc:saveAsBytes` (main.js handler ~432-448) + `saveAsBytes` (preload) —
  dead after Step 3. `grep -rn "saveAsBytes" src/ scripts/` must come back empty.
- [ ] **Step 6:** `npm run build && npm run test:pm` → **all `[7]` + rewritten `[0b]` green** (the
  `[4]` leak pin stays red until Task 6); `npm run test:legacy` → 257 byte-identical (files.js
  legacy branches untouched — verify the legacy paths by diff inspection too);
  `npm run test:smoke && npm run test:smoke:legacy` → 9/9 ×2; `npm run test:roundtrip` still green.
- [ ] **Step 7:** Commit: `feat(editor): PM-mode html/txt/csv open + html/txt save — slice-7 blocks removed`
  — body records: the two slice-0b blocks deleted, csv-as-table deviation (D7.3/D7.4), the
  saveAsBytes retirement, converter isolation (mammoth/html-to-docx now unreachable from PM mode).

---

### Task 6: the list-marker leak (slice-4 carry-over) — repro FIRST, then the fork fix

**Files:** Modify: `src/renderer/core/superdoc-fork/core/inputRules/docx-paste/docx-paste.js`
(+ optionally `core/InputRule.js` if the repro shows the browser-html leg leaks too),
`src/renderer/core/superdoc-fork/NOTICE.md`, (test landed in Task 1)

**CRITIQUE-CORRECTED pipeline (author-verified):** in docx mode, Word-flavored paste HTML routes
`view.pasteHTML → handleClipboardPaste → case 'word-html' → handleDocxPaste` (InputRule.js:699-701)
— `handleDocxPaste` (docx-paste.js) NEVER calls `htmlHandler`/`sanitizeHtml`, so a fix there would
patch dead code for the product paste path. docx-paste's own comment strip is
`extractAndRemoveConditionalPrefix` (docx-paste.js:338-372, comment nodes only).

- [ ] **Step 1: REPRO.** Run a probe (pattern as Task 4 Step 5) that calls
  `WC.PM.pasteHTMLString(wordHtml)` with BOTH forms — (a) WITH `<!--[if !supportLists]-->`
  comments, (b) WITHOUT comments but with `style="mso-list:Ignore"` spans (use the Task-1 pin
  fixture WITH its `<style>` block) — and returns the doc text for each, plus a variant of (b)
  with NO `<style>` block (expected: TypeError from docx-paste.js:51 — decide whether the
  null-guard is part of the real-world bug). Confirm: (a) clean, (b) leaks the literal marker.
  If (b) does NOT leak, STOP — re-derive the real repro from a live Word clipboard capture
  (`wordAPI.clipboard.readHTML` after a manual Word copy; ask the user if a manual step is
  needed) and recalibrate the Task-1 pin BEFORE touching the fork.
- [ ] **Step 2: fix in the docx-paste pipeline** — in `handleDocxPaste`'s preprocessing (next to
  the `extractAndRemoveConditionalPrefix` call site), strip the Ignore-marked marker runs, and
  guard the unconditional style deref:

```js
  // Chromium's clipboard sanitizer strips conditional comments, so the [if !supportLists]
  // wrapper can be gone by the time Word HTML reaches us — but Word also marks the marker run
  // itself with style="mso-list:Ignore". Strip that form too (slice-7 fix of the slice-4 leak).
  const stripWordListIgnoreRuns = (root) => {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('[style*="mso-list"]').forEach((el) => {
      if (/mso-list\s*:\s*ignore/i.test(el.getAttribute('style') || '')) el.remove();
    });
  };
  stripWordListIgnoreRuns(tempDiv);
```
  and at docx-paste.js:51: `const css = (tempDiv.querySelector('style') || {}).innerHTML || '';`
  *(exact splice points calibrated against the Step-1 repro; if the repro shows the browser-html
  leg ALSO leaks, add the same strip beside `stripWordListConditionalPrefixes` in InputRule.js's
  sanitize step.)*

- [ ] **Step 3:** NOTICE.md bullet: what was changed in docx-paste.js + why (clipboard-sanitized
  Word HTML leaks list markers; comment-form strip already existed; style-deref guard).
- [ ] **Step 4:** `npm run build && npm run test:pm` → the `[4]` pin green; full suite green.
  Also re-run the Step-1 probe: form (b) now clean, form (a) still clean (no regression).
  GREEN-STAGE CONTRACT (per the Task-1 quality review): the pin asserts the MODEL text only —
  a rendered "1." list marker in the DOM is *legitimate nodeview chrome* when the engine
  reconstructs the list from `mso-list:l0 level1 lfo1`; do NOT try to suppress it, and do not
  weaken the model assertion to accommodate it.
- [ ] **Step 5:** Commit: `fix(editor): Word list paste without conditional comments leaked literal markers (NOTICE'd)`.

---

### Task 7: full gates (now six)

- [ ] **Step 1:** on an OTHERWISE-IDLE machine (the PM suite flakes ~5 timing tests under heavy
  parallel load — observed in this session's pre-flight):
  `npm run build && npm run test:pm && npm run test:legacy && npm run test:smoke && npm run test:smoke:legacy && npm run test:docx && npm run test:roundtrip`
- [ ] **Step 2:** verify summaries from the probe JSONs (never trust exit codes alone — the
  electron harness exits 0 on test failures): **PM 205/205** (192 − 2 + 1 `[0b]` + 13 `[7]` +
  1 `[4]`), legacy 257/257, smoke 9/9 ×2, docx 17/17, roundtrip all-pass. Record exact counts.
- [ ] **Step 3:** if anything is red: triage with superpowers:systematic-debugging — no
  test-weakening, no skipped tests.

---

### Task 8: oracle validation (spec §8.3) + slice-6 carry-over legs

**Read `scripts/oracle/README.md` quirks FIRST — esp. #24-26:** Word must be launched WINDOWED by
the user; `make new document` was broken/crashy last session — prefer open+save-as legs; PID-safe
name-verified closes only; NEVER quit Word. The slice-6 table-style visual recheck also needs the
user to grant macOS "File Access" to Word once.

**Artifact location (critique blocker-adjacent):** Word for Mac is sandboxed — it CANNOT open
`/tmp` paths (silent −1712 stalls, oracle README §sandbox + quirk #25). ALL Word-bound artifacts
go to **`.oracle-probes/slice7/`** (the verified-working project-subdirectory pattern from slices
4-6), never `/tmp`.

- [ ] **Leg A (docx round-trip through the PM converter):** open a REAL Word-authored fixture
  (`tests/fixtures/oracle-word-s6-tablestyles.docx`) in the clone → save via Files.save to
  `.oracle-probes/slice7/wc-s7-rt.docx` → `scripts/oracle/word-oracle.js` opens it in real Word →
  **no repair prompt** + read-back of a text probe + table presence. (This doubles as the pending
  slice-6 table-style visual recheck — same artifact class.)
- [ ] **Leg B (html export fidelity):** export a styled doc (heading + bold + list + table) as
  `.html` via the new save leg → drive Word to open the `.html` → read back text + heading
  presence. Record styling fidelity honestly (semantic export — D7.10).
- [ ] **Leg C (csv deviation evidence):** drive Word to open a small `.csv` → record what Word
  ACTUALLY does (expected: delimited plain text, not a table) → write the deviation record for
  D7.3 with this evidence.
- [ ] **Leg D (txt):** export `.txt` → Word open → text matches the model text.
- [ ] **Carry-overs if the session allows:** slice-6 leg B (Word-authored → `openDocx`) re-run;
  the remaining UI-Codex steps (A2 Insert-Table dialog, A5 Bookmark, B-layout/autofit, C1/C2) are
  USER-driven (Codex) — surface to the user, do not block the PR on them.
- [ ] Save verdicts JSON to `docs/superpowers/plans/notes/2026-06-10-slice7-oracle.json` + commit:
  `test(oracle): slice-7 file-io legs A-D verdicts (+ slice-6 reopen recheck)`.

---

### Task 9: docs + checkpoint + PR

- [ ] **Step 1:** `docs/TECH_STACK.md`: mammoth/html-to-docx/docx-utils re-captioned
  "**legacy-mode only** since slice 7 (PM mode never touches them); removed at slice 11".
  `docs/FEATURES.md` File row updated (PM open html/txt/csv; save html/txt; csv→table deviation).
  AGENTS.md gotchas: keep the html-to-docx notes but mark them `--legacy`-scoped.
- [ ] **Step 2:** invoke the **plan-tracking** skill: append the dated entry to
  `docs/plan/last-point.md` (top), tick `execution-map.md`'s daily log + CURRENT PHASE (slice 7
  BUILT → slice 8 review next), record deviations + carry-overs (UI-Codex steps if still pending;
  `.md/.rtf` legacy-only; selection-scoped replace-all etc. inherited list).
- [ ] **Step 3:** push branch + open **PR #24** to `main`: what flipped (the two files.js blocks),
  the new channels, the fork edit (NOTICE'd), D7.x decisions (esp. the test_docx demotion + csv
  deviation), gate counts (all six), oracle verdicts.

---

## Known deviations to record (fill in oracle evidence at execution)

- csv/tsv opens as a **table** (Word: delimited plain text) — user-directed, D7.3.
- html import/export is **semantic** (structure + alignment; inline styles dropped) — D7.10.
- `.md`/`.rtf` open stays legacy-only (fork `markdown` option noted as a cheap future leg).
- txt export flattens table cells to block-separated lines (`textBetween` semantics); a page
  break (`hardBreak`) exports as a plain newline, not a form feed.
- Save As offers docx/html/txt only (Word offers many more) — scope per spec §9.1 row 7.
- **Phantom recents carried forward** (pre-existing): `doc:openBytes` pushes into Recent Files on
  read success, BEFORE the renderer import verdict — a failed import still lists the file.
  Accepted as current behavior; a renderer-confirmed recents push is a recorded follow-up.
- A failed html/txt/csv import (fork `contentError`) lands the user on a **blank doc** (path
  unbound, ok=false toast) — confirmDiscard was already accepted, so no un-consented data loss.

## Carry-overs / explicitly NOT this slice

- Mail-merge `newDocWith` block (slice 10). Review/references areas (slices 8/9) — the two `[0a]`
  D6 tests stay where they are. Table-tools deferrals from slice 6 (tblLook checkboxes, style
  gallery breadth, border pen tools, cell-margins dialog, AutoFit-Contents reflow, banded-row
  render). Legacy converter deletion + `test_docx.js`/legacy-suite retirement (slice 11).
