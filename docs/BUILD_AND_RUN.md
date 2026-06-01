# Build & Run

How to build, run, and operate the Word clone — an Electron 31 desktop app with a
vanilla-JS renderer (no bundler, no transpile step). This is reference material for
engineers working on the app: the dev loop, the WSL/WSLg specifics, the headless
screenshot/QA harness, and the real-Microsoft-Word COM oracle used for validation.

All paths are relative to the repo root unless noted: `/home/ogutd/msword-clone`.

---

## Prerequisites

- **Node.js** — developed and tested on Node 18 (`v18.19.1`). Any Node that satisfies
  Electron 31's bundled runtime is fine; Node is only used to run npm scripts and the
  standalone test scripts, not as the app's own runtime (the app runs inside Electron's
  own Node).
- **Electron 31** — pinned as a devDependency (`"electron": "^31.7.6"`, currently
  `31.7.6`). Installed locally by `npm install`; you do **not** need a global Electron.
- **Runtime libraries** (production deps, installed by `npm install`): `mammoth`
  (`.docx` → HTML import), `html-to-docx` (HTML → `.docx` export), `jszip` (OOXML
  inspection in the round-trip test), `dompurify` (sanitizes imported HTML),
  `@fluentui/svg-icons` (icon source for `scripts/gen-icons.js`).

Install once:

```bash
cd /home/ogutd/msword-clone
npm install
```

There is **no build/compile/bundle step**. The renderer is a set of classic `<script>`
tags loaded in dependency order from `src/renderer/index.html`; everything attaches to a
global `WC` namespace. Editing a renderer file and relaunching (or reloading) is the
entire "build".

---

## Running the app

```bash
cd /home/ogutd/msword-clone
npm start          # == electron .
```

`npm start` runs `electron .`, which loads `src/main/main.js` (the `"main"` field in
`package.json`). The main process creates a frameless 1440×920 `BrowserWindow`
(`createWindow()` in `src/main/main.js`) and loads `src/renderer/index.html`.

Dev mode (adds Chromium logging and auto-opens detached DevTools):

```bash
npm run dev        # == electron . --enable-logging
```

`isDev` is true when `--dev` **or** `--enable-logging` is present
(`src/main/main.js:12`); in dev mode the window opens DevTools detached on
`ready-to-show` (`main.js:121`).

### WSL / WSLg notes

The app is developed under WSL2 with WSLg, so a real window opens directly from
`npm start` with no extra setup — WSLg provides the X/Wayland server and the `DISPLAY`
(typically `:0`) is already exported by the WSL session. If you launch from a bare shell
that doesn't have it set, export it first:

```bash
export DISPLAY=:0
npm start
```

Two WSL-specific behaviors are baked into `src/main/main.js`:

1. **Hardware acceleration is auto-disabled under WSL.** WSLg's virtual GPU often fails
   Chromium's GPU init (harmless software-render fallback, but it logs errors and can
   flicker). `isWSL()` (`main.js:41`) checks `WSL_DISTRO_NAME` / `WSL_INTEROP` and
   `/proc/version`; when true and `--enable-gpu` is **not** passed, the app calls
   `app.disableHardwareAcceleration()` (`main.js:45`). So you normally don't need any GPU
   flags. To force GPU on anyway:

   ```bash
   npm start -- --enable-gpu
   ```

2. **"Maximize" is faux-maximize, not native maximize.** Frameless Electron 31 on
   Linux/Wayland (incl. WSLg) has no client-side decoration support, so a native
   `maximize()` leaves content bounds offset from where the OS paints — clicks miss the
   buttons. `toggleFauxMaximize()` (`main.js:23`) instead resizes the window to the
   display work area, preserving the real frameless bounds. This is why the title-bar
   maximize button and `--start-maximized` resize rather than truly maximize.

If GPU rendering is still flaky, fall back to fully software rendering (this is the
documented WSL escape hatch from the README):

```bash
npm start -- --no-sandbox --disable-gpu
```

Everything after `--` is passed through to Electron / Chromium, not to npm.

---

## CLI flags (parsed in `src/main/main.js`)

All flags are read directly off `process.argv` in the main process. Pass them after `--`
when using npm (`npm start -- --flag`), or directly when invoking Electron
(`electron . --flag`).

| Flag | Where | Effect |
|---|---|---|
| `--dev` | `main.js:12` | Enables dev mode (DevTools detached, dev logging). |
| `--enable-logging` | `main.js:12` | Also enables dev mode; what `npm run dev` passes. |
| `--enable-gpu` | `main.js:45` | Opt back into hardware acceleration under WSL. |
| `--win=WxH` | `main.js:117` | Resize the window on `ready-to-show`, e.g. `--win=1280x800`. Parsed as two numbers split on `x`. |
| `--start-maximized` | `main.js:119` | Faux-maximize to the display work area on show. |
| `--shot=/path.png` | `main.js:149` | Capture the rendered window to a PNG, then quit. |
| `--shot-delay=ms` | `main.js:154` | Delay before capture/eval (default **1200** ms). |
| `--shot-eval="js"` | `main.js:160` | Run a JS string in the renderer before capture. |
| `--shot-evalfile=/path.js` | `main.js:161` | Read a JS **file** and run it in the renderer before capture. |
| `--probe-out=/path.json` | `main.js:150` | Write the eval's return value to a file (JSON-stringified if not already a string), then quit. |

`--shot`, `--shot-eval`/`--shot-evalfile`, and `--probe-out` are all driven by the same
`maybeScreenshot()` routine (`main.js:148`), wired into `ready-to-show`.

---

## Headless QA / screenshot harness

`maybeScreenshot()` turns the app into a one-shot, scriptable, exit-on-completion
process. It activates whenever **either** `--shot=` or `--probe-out=` is present
(`main.js:151`). The lifecycle is:

1. Wait `--shot-delay` ms (default 1200) for the renderer to settle.
2. If `--shot-eval` / `--shot-evalfile` was given, run that JS in the renderer via
   `webContents.executeJavaScript(js)` and `await` its result, then wait another 600 ms
   for the DOM to settle (`main.js:163`).
3. If `--probe-out` was given, write the eval result to that path. Strings are written
   verbatim; anything else is `JSON.stringify(..., null, 2)`. Logs `PROBE_SAVED <path>`
   (`main.js:164`).
4. If `--shot` was given, `webContents.capturePage()` → write PNG. Logs
   `SHOT_SAVED <path>` (`main.js:165`).
5. `app.quit()` unconditionally (`main.js:167`). On error it logs `PROBE_FAIL` first.

Because the eval script runs **inside the renderer**, it has the full `window.WC`
namespace (the editor, command dispatcher, dialogs, etc.) and `window.wordAPI`.

### Visual screenshot

```bash
# Capture the default window to a PNG and quit
npm start -- --shot=/tmp/word.png

# Slower-settling capture at a custom size, maximized
npm start -- --start-maximized --shot-delay=2500 --shot=/tmp/word.png
```

### Probe (run JS in the renderer, capture its return value)

The probe is the workhorse for automated checks. Point `--shot-evalfile` at a script
that returns a value (an object is fine), and collect it via `--probe-out`:

```bash
# Run the in-app functional battery; write {summary, results[]} to JSON
electron . \
  --no-sandbox --disable-gpu \
  --shot-evalfile=scripts/test-suite.js \
  --probe-out=/tmp/results.json
```

`scripts/test-suite.js` is an IIFE that exercises real command paths through
`window.WC.Editor` and `window.WC.Commands` and **returns** `{summary, results[]}`,
which `maybeScreenshot()` writes to `--probe-out`. Its own header documents the exact
invocation:

```js
/* In-renderer functional test battery. Run via:
   electron . --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
   Returns JSON {summary, results[]} as the executeJavaScript result. */
```

You can combine a probe with a screenshot to get both a result file and a picture of the
final state:

```bash
electron . --no-sandbox --disable-gpu \
  --shot-evalfile=scripts/test-suite.js \
  --probe-out=/tmp/results.json \
  --shot=/tmp/after.png
```

A quick one-liner probe (no file) reads live editor state:

```bash
electron . --no-sandbox --disable-gpu \
  --shot-eval="JSON.stringify(window.WC.Editor.queryState())" \
  --probe-out=/tmp/state.json
```

---

## The `.docx` round-trip test (standalone, no Electron)

`scripts/test_docx.js` runs in plain Node and validates the file pipeline end-to-end:
HTML → DOCX (html-to-docx) → HTML (mammoth), with an **OOXML regression guard**.

```bash
node scripts/test_docx.js          # currently 9/9 content checks pass
```

It uses the exact same complete `margins` object the app uses in `writeDocx`
(`main.js:328`), and after generating the `.docx` it unzips `word/document.xml` with
JSZip and **fails** if the XML contains a literal `"undefined"` or a non-integer
`<w:pgMar>` (`scripts/test_docx.js:25`). This guards the single most important interop
bug found during validation (see below): a partial `margins` object made `html-to-docx`
emit `w:header="undefined"`, which real Microsoft Word refuses to open.

---

## Real-Word COM oracle workflow

Because the dev machine (Windows host under WSL2) has genuine Microsoft 365 Word
installed, features are validated **differentially against the real Word object model**
via PowerShell COM automation. This is the ground-truth oracle — it caught the
`w:header="undefined"` bug that mammoth and LibreOffice silently tolerated.

### How it works

From WSL you can invoke the Windows PowerShell and drive Word through COM:

```bash
powershell.exe -ComObject Word.Application
```

In practice the oracle is a `.ps1` script that:

- creates `$word = New-Object -ComObject Word.Application` (run **hidden**,
  `$word.Visible = $false`),
- types text / toggles properties (e.g. `Font.Bold`) or opens a `.docx`,
- reads ground-truth values back out of the object model (`Document`, `Styles`,
  `PageSetup`, `DocumentTheme`, fields, footnotes, revisions, …),
- emits JSON, then **quits cleanly** so no orphan WINWORD process is left behind.

The extracted ground truth is archived as JSON under `docs/research/`, e.g.
`real-word-groundtruth.json` and `word-oracle-home-insert.json`. Each file records the
`_source` / `_method` — the genuine Word version (`16.0`, build `16.0.19929`, Aptos
theme) and that values were read via `powershell.exe -ComObject Word.Application`.

### Script location and the WSL ↔ Windows path bridge

The oracle/probe `.ps1` scripts live on the Windows side at:

```
C:\Users\Public\wcprobe\
```

referenced as `C:\Users\Public\wcprobe\oracle.ps1` in
`docs/VALIDATION_home_insert.md` and `docs/research/word-oracle-home-insert.json`. From
WSL that directory is the same files under:

```
/mnt/c/Users/Public/wcprobe/
```

This shared directory is the handoff point between the Node/WSL side and the
Windows/Word side. The clone's two round-trip helper scripts read/write there directly:

- `scripts/export_ref.js` — generates a `.docx` from rich HTML through the clone's exact
  export pipeline (html-to-docx) and writes it to
  `/mnt/c/Users/Public/wcprobe/ref_from_clone.docx` for **real Word to open and read
  back** (clone → Word fidelity).
- `scripts/analyze_import.js` — opens a real-Word-authored `.docx`
  (`/mnt/c/Users/Public/wcprobe/ref_from_word.docx`) through the clone's exact import
  pipeline (mammoth + the app `styleMap`) and reports which features survive (Word →
  clone fidelity).

```bash
# Clone -> real Word: emit a .docx into the shared probe dir for Word to open
node scripts/export_ref.js
# (then a .ps1 in C:\Users\Public\wcprobe opens ref_from_clone.docx via COM and reads it back)

# Real Word -> clone: analyze a Word-authored .docx through the import pipeline
node scripts/analyze_import.js /mnt/c/Users/Public/wcprobe/ref_from_word.docx
```

### The PID-safe pattern (don't kill the user's open Word)

The host's Word may already be open with the user's own documents. The oracle **must not**
quit/kill a Word instance it didn't create. The safe pattern is:

- Snapshot existing WINWORD PIDs **before** launching the oracle's instance.
- Create a fresh hidden `Word.Application` and remember its **own** process id.
- Do all work in that instance; on exit, `$doc.Close()` (without saving) and
  `$word.Quit()` only the instance the script spawned — never any pre-existing PID.
- Release the COM object so the spawned WINWORD actually terminates.

This "only touch the PID you created" discipline is why the validation runs are safe to
execute on a machine where the user has live Word documents open.

### What the oracle validated

The COM oracle is what produced the per-tab validation in
`docs/VALIDATION_home_insert.md` (26/28 sampled features matched real Word) and the Aptos
theme corrections in `docs/research/real-word-groundtruth.json` (body Aptos 12pt,
Heading 1 = 20pt navy `#0E2841`, the Aptos accent palette, etc.). Most importantly, the
**clone → Word** direction surfaced the critical `w:header="undefined"` OOXML defect that
made every saved file unopenable in real Word — fixed by always passing the complete
integer margin set in `writeDocx` (`src/main/main.js:328`) and now regression-guarded by
`scripts/test_docx.js`.

---

## Quick reference

```bash
# Run
npm start                                   # launch the app (electron .)
npm run dev                                 # launch with logging + DevTools
npm start -- --no-sandbox --disable-gpu     # software-render fallback (WSL)
npm start -- --win=1280x800 --start-maximized

# Screenshot / probe (one-shot, auto-quits)
npm start -- --shot=/tmp/word.png
electron . --shot-evalfile=scripts/test-suite.js --probe-out=/tmp/results.json

# File-pipeline tests (plain Node, no Electron)
node scripts/test_docx.js                   # HTML->DOCX->HTML round trip + OOXML guard
node scripts/export_ref.js                  # emit .docx into the COM probe dir
node scripts/analyze_import.js <word.docx>  # import-fidelity report

# Real-Word COM oracle (Windows side)
powershell.exe -ComObject Word.Application   # scripts live in C:\Users\Public\wcprobe\
```
