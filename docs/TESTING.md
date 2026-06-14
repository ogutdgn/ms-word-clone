# Testing & QA Strategy

This clone has no Jest/Mocha runner and no headless DOM mock. Instead, every
test runs **inside the real renderer**, driving the actual command paths against a
live Chromium DOM, and (where ground truth matters) is checked against **genuine
Microsoft Word** via PowerShell COM automation.

There are three layers:

1. **In-renderer functional harness** — `scripts/test-suite-pm.js` (the PM functional suite; grows per slice). Runs the real command dispatcher against the `WC.PM` bridge + PM editor and asserts on the resulting model/DOM/state.
2. **docx round-trip suite** — `scripts/test-roundtrip-pm.js` (+ its renderer probe `scripts/test-roundtrip-pm-probe.js`): the **PM-converter docx round-trip suite, THE docx gate** (`npm run test:roundtrip`), running docx → PM → docx on the fork `super-converter`.
3. **Real-Word COM oracle differential tests** — `scripts/oracle/word-oracle-win.ps1` (+ the archived `*_probe.ps1` scripts) that drive the installed Word over COM and emit ground-truth JSON; per-slice Leg A/Leg B results recorded under `notes/` and `docs/research/`.

**Gate suites (three):** `test:pm`, `test:smoke` (9), and `test:roundtrip` (the
PM-converter docx gate). Run all three (after `npm run build`) before committing.

> **Slice 11 (legacy retirement):** the old `test:legacy`/`test:smoke:legacy`/`test:docx`
> gates and their scripts (`scripts/test-suite.js`, `scripts/test_docx.js`) were removed with
> the legacy world. The six gates collapsed to three; `test:roundtrip` remains THE docx gate.

---

## 1. In-renderer functional harness

### What it is

`scripts/test-suite-pm.js` is one big async IIFE that runs **in the page context**
of the running app. It never imports app modules — it reaches into the live
globals the renderer already exposes:

```js
const PM = window.WC.PM;       // the bridge (commands, io, state) over the PM editor
const WC = window.WC;          // the global namespace (Commands, Dialogs, …)
```

Because it executes the genuine `WC.Commands.run(...)`, `WC.Dialogs.*`,
`WC.PM.*` etc., it exercises the same code path a user click takes — not a stub.
Assertions then read back the PM model/state and the rendered DOM (e.g.
`PM.queryState()`, `WC.view.state.doc`, `#pm-editor` DOM).

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
| `selectText(substr)` | place a PM selection over the first match in `#pm-editor` |
| `caretIn(...)` | collapse a caret into a block |
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
npm run build && npm run test:pm
# (== electron . --probe-out=/tmp/wc-pm.json --shot-evalfile=scripts/test-suite-pm.js)
```

The app launches, runs the PM suite in the renderer, writes `/tmp/wc-pm.json`,
prints `PROBE_SAVED /tmp/wc-pm.json` to stdout, and `app.quit()`s. (If the eval
throws before returning, you get `PROBE_FAIL` on stderr and no file.)

### How to read results

The output file is `{ summary, results[] }`:

```json
{
  "summary": { "total": 326, "pass": 326, "fail": 0 },
  "results": [
    { "name": "Bold applies to selection", "pass": true, "detail": "" },
    { "name": "Find highlights all matches", "pass": true, "detail": "3 hits" }
  ]
}
```

Quick triage with `jq`:

```bash
# overall tally
jq .summary /tmp/wc-pm.json

# just the failures, with their diagnostic detail
jq '.results[] | select(.pass==false) | {name, detail}' /tmp/wc-pm.json
```

A `detail` beginning with `ERR:` means the test body **threw** (likely a real
regression, not just a soft assertion miss). A plain `false`-return failure
usually means the asserted model/state condition was not met.

### Test categories

The PM suite is grouped by ribbon area / concern with banner comments and
self-labelling bracket prefixes in the test names (`[fix]`, `[home]`, `[insert]`,
`[review]`, `[ref]`, `[mail]`, `[design]`, `[draw]`, `[ui]`, …), which makes
filtering trivial. It grows per slice as each ribbon area is wired onto the
`WC.PM` bridge; the bracket prefixes double as the filter (there is no `--grep`,
so filter the result JSON). Many `[fix]`/`[ui]` tests assert the **negative** —
e.g. an Insert-Link XSS payload must *not* produce an `<img>` and must neutralise
`javascript:` URLs to `#`; a dropdown must *not* contain the text "not implemented".

### Cleanup contract

The suite mutates the live document and opens real panes/dialogs. Before
returning it tears everything down (read-mode overlay, help/comments/find/nav
panes, modal backdrops, contextual tabs, review state, mail-merge state, etc.)
so the harness leaves no dangling DOM. **New tests must clean up after
themselves or add to this teardown block** so later tests start from a known
state.

---

## 2. `.docx` round-trip suite — THE docx gate

`npm run test:roundtrip` (the PM-converter round-trip).
`scripts/test-roundtrip-pm.js` (Node driver) spawns Electron with the renderer
probe `scripts/test-roundtrip-pm-probe.js` and judges only from the probe JSON
(`/tmp/wc-roundtrip.json`). Per fixture (`negation-run`, `basic-list`,
`oracle-word-s3-table`, `oracle-word-s6-tablestyles`) it runs the full
docx → PM → docx cycle on the fork converter: `PM().openDocx(bytes)` import,
`exportDocxBytes()` zip export saved to `/tmp/wc-rt-<name>.docx`,
`exportDocx({ exportXmlOnly: true })` grep invariants (re-derived from each
fixture's actual `word/document.xml`), and a re-import of the exported file —
plus a text-survival cross-check and zip-level asserts via the
`scripts/docx-inspect.js` CLI (s3: `tables >= 1`; s6: every `w:tblStyle` ref has
a matching definition in `word/styles.xml` — the slice-6 minting-fix pin).

```bash
npm run build && npm run test:roundtrip    # read the RESULT: line; exit 1 on any failure
```

Round-trip is **rebuild-not-byte-identical** (the export normalizes/drops unmodeled
XML); the suite asserts that constructs and content survive, not byte-for-byte
fidelity. The pre-rebuild legacy `scripts/test_docx.js` (the `html-to-docx`/`mammoth`
converter gate) was removed with the legacy world in slice 11.

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
2. **As Leg A/Leg B construct checks** — since slice 8 the oracle opens the PM
   converter's exported `.docx` in real Word (Leg A) and imports Word-authored
   `.docx` through the fork (Leg B), confirming each construct (track changes,
   comments, fields, themes, …) survives. Per-slice results are recorded under `notes/`.

This differential approach is the ground truth for `.docx` fidelity — the clone's
saved files are validated in the one program that ultimately matters.

---

## 4. Regression-test convention

**Every confirmed fix gets a regression test in `scripts/test-suite-pm.js`.** This
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

The bracketed prefixes (`[fix]`, `[home]`, `[insert]`, `[ui]`, …) double as a
lightweight filter — there is no test runner to pass `--grep` to, so filter the
result JSON instead:

```bash
jq '.results[] | select(.name | startswith("[fix]"))' /tmp/wc-pm.json
```

---

## Quick reference

```bash
# PM functional harness → /tmp/wc-pm.json {summary,results[]}
npm run build && npm run test:pm
jq .summary /tmp/wc-pm.json
jq '.results[] | select(.pass==false)' /tmp/wc-pm.json   # show failures

# PM-core smoke (9) → /tmp/wc-smoke.json
npm run build && npm run test:smoke

# PM-converter docx round-trip — THE docx gate (read the RESULT: line; exit≠0 on fail)
npm run build && npm run test:roundtrip

# Real-Word oracle: scripts/oracle/word-oracle-win.ps1 (Windows + Word 16.0);
#   captured ground truth under docs/research/*-oracle.json + notes/ (per-slice Leg A/B)
```
