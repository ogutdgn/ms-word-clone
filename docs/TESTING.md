# Testing & QA Strategy

This clone has no Jest/Mocha runner and no headless DOM mock. Instead, every
test runs **inside the real renderer**, driving the actual `WC` command paths
against a live Chromium DOM, and (where ground truth matters) is checked against
**genuine Microsoft Word** via PowerShell COM automation.

There are three layers:

1. **In-renderer functional harness** — `scripts/test-suite.js` (257 tests). Runs the real command dispatcher and asserts on the resulting DOM/state.
2. **`.docx` round-trip suite** — `scripts/test_docx.js` (17 content checks + 2 OOXML regression guards). Pure Node, no Electron.
3. **Real-Word COM oracle differential tests** — `*_probe.ps1` / `oracle.ps1` scripts that drive the user's installed Word and emit ground-truth JSON under `docs/research/`.

---

## 1. In-renderer functional harness

### What it is

`scripts/test-suite.js` is one big async IIFE that runs **in the page context**
of the running app. It never imports app modules — it reaches into the live
globals the renderer already exposes:

```js
const E  = window.WC.Editor;   // the editor instance (contenteditable + commands)
const WC = window.WC;          // the global namespace (Commands, Dialogs, Styles, …)
```

Because it executes the genuine `WC.Commands.run(...)`, `WC.Dialogs.*`,
`WC.applyNamedStyle(...)` etc., it exercises the same code path a user click
takes — not a stub. Assertions then read back the DOM (`E.node.innerHTML`,
`E.queryState()`, `document.queryCommandState(...)`, `E.pageCount()`, …).

### The `t()` helper

Every test is registered via `t(name, fn)`:

```js
async function t(name, fn) {
  try {
    const r = await fn();
    results.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' });
  } catch (e) {
    results.push({ name, pass: false, detail: 'ERR: ' + (e && e.message ? e.message : String(e)) });
  }
}
```

Pass/fail convention:

- **Pass** = the body returns anything other than the boolean `false` (so `true`, a string, `undefined`, or a truthy value all pass). Returning a **string** is the idiom for "pass, and here is a diagnostic" — it lands in `detail` (e.g. `return '3 hits'`, `return E.pageCount() + ' pages'`).
- **Fail** = the body returns `false`, **or** throws. Several tests deliberately `throw new Error('bad order: ' + order)` so the failure message carries the actual value.
- `fn` may be `async`; `await sleep(ms)` is used to wait out debounced UI (Find/Replace, Format Painter, async dialogs).

Helpers available inside the suite:

| Helper | Purpose |
|---|---|
| `selectText(substr)` | TreeWalk the editor, place a `Range` over the first match, `E.saveRange()` |
| `caretIn(block)` | Collapse a caret to the start of a block |
| `selectBlock(block)` | Select an entire block's contents |
| `H()` | Shorthand for `E.node.innerHTML` |
| `sleep(ms)` | `setTimeout` promise for debounce waits |

### How it is run (exact command)

The harness is injected by the main process. `src/main/main.js` →
`maybeScreenshot()` recognizes two flags:

- `--shot-evalfile=<path>` — read a JS file and `executeJavaScript` it in the window.
- `--probe-out=<path>` — write the eval result to that path (string written as-is, objects `JSON.stringify`'d).

The relevant glue (`src/main/main.js`):

```js
if (evalFileArg) js = require('fs').readFileSync(evalFileArg.slice('--shot-evalfile='.length), 'utf8');
if (js) { result = await mainWindow.webContents.executeJavaScript(js); await new Promise((r) => setTimeout(r, 600)); }
if (probeOut) { await fsp.writeFile(probeOut, typeof result === 'string' ? result : JSON.stringify(result, null, 2)); console.log('PROBE_SAVED ' + probeOut); }
```

The suite ends by returning a JSON **string**, which `executeJavaScript`
resolves and `--probe-out` writes verbatim:

```js
const pass = results.filter((r) => r.pass).length;
const fail = results.length - pass;
return JSON.stringify({ summary: { total: results.length, pass, fail }, results }, null, 2);
```

**Run command:**

```bash
npm run build && npx electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
# in headless / CI environments add the usual Electron flags:
npm run build && npx electron . --no-sandbox --disable-gpu --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
```

The app launches, runs all 257 tests in the renderer, writes
`/tmp/results.json`, prints `PROBE_SAVED /tmp/results.json` to stdout, and
`app.quit()`s. (If the eval throws before returning, you get `PROBE_FAIL` on
stderr and no file.)

### How to read results

The output file is `{ summary, results[] }`:

```json
{
  "summary": { "total": 257, "pass": 257, "fail": 0 },
  "results": [
    { "name": "Bold applies to selection", "pass": true, "detail": "" },
    { "name": "Find highlights all matches", "pass": true, "detail": "3 hits" },
    { "name": "[word-validated] ~26 single-line paragraphs per page (matches Word COM oracle)", "pass": true, "detail": "per-page=26" }
  ]
}
```

Quick triage with `jq`:

```bash
# overall tally
jq .summary /tmp/results.json

# just the failures, with their diagnostic detail
jq '.results[] | select(.pass==false) | {name, detail}' /tmp/results.json
```

A `detail` beginning with `ERR:` means the test body **threw** (likely a real
regression, not just a soft assertion miss). A plain `false`-return failure
usually means the asserted DOM/state condition was not met.

### Test categories

The suite is grouped by tab / concern with banner comments
(`// ================= HOME TAB feature tests =================`). Tests are
also self-labelling via a bracket prefix in their name, which makes filtering
trivial. Current counts (257 total):

| Prefix / group | ~Count | Covers |
|---|---|---|
| (unprefixed core) | — | Bold/Italic/Underline, color, font/size ladder, alignment, lists, headings/styles, tables, page/blank break, symbols, Find/Replace, word count, pagination, zoom, views, ribbon, sort, change case |
| `[fix]` | 24 | **Regression tests** for confirmed QA/review defects (see §4) |
| `[home]` | 20 | Text effects, multilevel lists, clipboard pane, format painter, Font dialog, dictate, sensitivity bar, custom styles |
| `[insert]` | 29 | Tables, pictures/shapes, links, bookmarks, header/footer, page-number/date fields, symbols, screenshot bridge |
| `[layout]` | 10 | Margins, orientation, size, columns, breaks, line numbers, hyphenation, indent/spacing |
| `[ref]` | 11 | TOC, footnotes/endnotes, captions, citations/bibliography, index |
| `[review]` | 10 | Track Changes, comments, accessibility checker, thesaurus, compare |
| `[mail]` | 9 | Mail-merge fields, recipients, preview, envelopes/labels |
| `[design]` | 9 | Themes, style sets, page color/borders, watermark |
| `[draw]` | 8 | Ink/drawing tools |
| `[view]` | 8 | Read mode, focus mode, web/print layout, navigation |
| `[help]` | 3 | Help pane wiring |
| `[ui]` | — | UI-outcome fidelity regressions (read mode overlay, focus hides ribbon, dropdown wiring not "not implemented") |
| `[page]` | 7 | Real per-page separation (gap spacers, `pageOfElement`, line-level mid-block splits) |
| `[word-validated]` | 1 | Asserts against a numeric value taken from the real-Word COM oracle (≈26 single-line paragraphs/page) |

Many `[fix]` and `[ui]` tests assert the **negative** — e.g. an Insert-Link XSS
payload must *not* produce an `<img>` and must neutralise `javascript:` URLs to
`#`; a "Breaks" dropdown must *not* contain the text "not implemented".

### Cleanup contract

The suite mutates the live document and opens real panes/dialogs. Before
returning it tears everything down (read-mode overlay, help/comments/find/nav
panes, modal backdrops, contextual tabs, review state, mail-merge state, etc.)
so the harness leaves no dangling DOM. **New tests must clean up after
themselves or add to this teardown block** so later tests start from a known
state.

---

## 2. `.docx` round-trip suite

`scripts/test_docx.js` is a plain Node script (no Electron) that proves the
file pipeline survives a full round trip and, critically, that the emitted
OOXML is openable by **real** Microsoft Word.

**Run command:**

```bash
node scripts/test_docx.js     # currently 17/17 content checks pass
```

What it does:

1. **HTML → DOCX** via `html-to-docx`, using the *exact same complete margins
   the app uses* (`{ top, right, bottom, left, header, footer, gutter }`) and
   writes `/tmp/test.docx`.
2. **OOXML regression guards** — unzips the result with `jszip`, reads
   `word/document.xml`, and asserts:
   - **no literal `undefined`** (`/="undefined"|>undefined</`), and
   - **integer `pgMar`** (`w:header`/`w:footer`/`w:gutter` are numeric).

   ```js
   const hasUndefined = /="undefined"|>undefined</.test(docXml);
   const pgMarOk = /<w:pgMar[^>]*w:header="\d+"[^>]*w:footer="\d+"[^>]*w:gutter="\d+"/.test(docXml);
   if (hasUndefined || !pgMarOk) { console.log('RESULT: docx would be REJECTED by real Word'); process.exit(1); }
   ```

   This guard exists because of a real interop bug: passing **partial** margins
   made `html-to-docx` emit `w:header="undefined"`, which mammoth and
   LibreOffice silently tolerated but real Word **refused to open** (see
   `docs/VALIDATION_home_insert.md`).
3. **DOCX → HTML** via `mammoth`, then 17 content checks (title, bold, italic,
   heading, bullet, number, table cell `R1C1`, `<table>` tag, coloured
   paragraph).

**Interpreting output** — it prints to stdout, not JSON:

```
   OOXML guard: no "undefined" = PASS, integer pgMar = PASS
    PASS Round Trip Test
    ...
RESULT: 17 pass / 0 fail
```

Exit code is **non-zero** if the OOXML guard fails (`process.exit(1)`) or any
exception is thrown (`TEST_ERROR`). The 9 content checks are tallied but do not
themselves set the exit code — read the `RESULT:` line. Round-trip is **lossy by
design** (the HTML and OOXML document models differ); these checks assert that
*content survives*, not byte-for-byte fidelity.

---

## 3. Real-Word COM oracle (differential tests)

Because the dev machine has Microsoft Word installed, behaviour that has an
objective "right answer" is validated against the genuine application rather
than against the author's assumptions. PowerShell scripts drive Word through
COM (`New-Object -ComObject Word.Application`, run hidden), perform an action,
read the resulting object-model values back, and emit JSON.

- Scripts live on the dev box at `C:\Users\Public\wcprobe\` (e.g. `oracle.ps1`,
  `layout_probe.ps1`, `references_probe.ps1`, `design_probe.ps1`). They are not
  checked into this repo; their **captured output** is.
- Captured ground truth is archived under `docs/research/`:

| File | Oracle | Captures |
|---|---|---|
| `real-word-groundtruth.json` | `Word.Application` | Defaults: **Aptos** theme (not Calibri), body Aptos 12pt, Letter 8.5×11, 1″ margins, full style table, theme palette |
| `word-oracle-home-insert.json` | `oracle.ps1` | Home/Insert object-model values (`Font.Bold=-1`, `ListType`, `Alignment`, field types, etc.) |
| `layout-oracle.json` | `layout_probe.ps1` | Page sizes in px@96, line numbering, hyphenation, columns, indent/spacing in points |
| `references-oracle.json` | `references_probe.ps1` | Caption format, footnote/endnote numbering, TOC levels, index marking |
| `design-oracle.json` | `design_probe.ps1` | Theme major/minor fonts, theme colours, page borders/colour, watermark scriptability |

Each file carries a `_source` / `_method` note recording the Word build
(`16.0.19929`, Microsoft 365, Aptos) and how it was extracted.

These oracles are used two ways:

1. **As design ground truth** — the per-tab A/B comparison tables in
   `docs/VALIDATION_home_insert.md` (✅ matches · 🟡 metric differs · ❌ wrong)
   were built by diffing the clone against these values. This is how the default
   red was corrected from `#C00000` to `#FF0000`, the indent step to 0.5″, etc.
2. **As assertions baked into the harness** — the `[word-validated]` tests
   encode an oracle number directly. Example (test-suite.js): "≈26 single-line
   paragraphs per page" asserts the clone's pagination matches what real Word
   produced (`Word=26`), throwing with the measured `per-page` if it drifts.

This differential approach caught the **critical `w:header="undefined"` interop
defect** above — the clone's saved files looked fine everywhere except the one
program that matters.

---

## 4. Regression-test convention

**Every confirmed fix gets a regression test in `scripts/test-suite.js`.** This
is a hard rule, not a nicety — the project went through two multi-agent review
workflows (an adversarial correctness pass and a 5-dimension QA pass covering
fidelity, security, CSS, robustness, and file IO), and every verified defect was
fixed *with* a guard test.

Conventions:

- Name the test with a `[fix]` (or `[ui]`) prefix so it is greppable and
  self-documents that it guards a known bug.
- Assert the **bug condition cannot recur** — usually the negative case. Examples already in the suite:
  - `[fix] Insert Link escapes XSS payload + neutralizes javascript: URL` — the payload must produce no `<img>` and `href` must be `#`.
  - `[fix] Sort across containers keeps list valid (no crash)` — multi-parent selection must not throw and must keep the list well-formed.
  - `[fix] Drop Cap preserves inline formatting (<b> survives)`.
  - `[fix] Insert Table rejects out-of-range counts (no hang)` — `99999` rows must be refused, dialog stays open, no giant table.
  - `[fix] Bibliography / Mail merge / Index escapes XSS in source/recipient fields`.
- Raw review findings are archived in `docs/research/qa-findings.json`,
  `docs/research/review-findings.json`, and `docs/research/final-review.json`.

The bracketed prefixes (`[fix]`, `[home]`, `[insert]`, `[ui]`, `[page]`,
`[word-validated]`, …) double as a lightweight filter — there is no test runner
to pass `--grep` to, so filter the result JSON instead:

```bash
jq '.results[] | select(.name | startswith("[fix]"))' /tmp/results.json
```

---

## Quick reference

```bash
# Functional harness (257 tests) → /tmp/results.json {summary,results[]}
npm run build && npx electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
jq .summary /tmp/results.json
jq '.results[] | select(.pass==false)' /tmp/results.json   # show failures

# .docx round-trip + OOXML guards (read the RESULT: line; exit≠0 on guard fail)
node scripts/test_docx.js

# ProseMirror smoke test (9 assertions) → /tmp/smoke.json
npm run build && npx electron . --probe-out=/tmp/smoke.json --shot-evalfile=scripts/smoke-pm.js

# Real-Word oracles: captured under docs/research/*-oracle.json + real-word-groundtruth.json
#   (drive scripts live from C:\Users\Public\wcprobe\ on a Windows box with Word installed)
```
