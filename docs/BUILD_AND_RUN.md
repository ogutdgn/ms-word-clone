# Build & Run

How to build, run, and operate the Word clone — an Electron 31 desktop app whose
renderer is built by **electron-vite + TypeScript** (the document core is the
owned ProseMirror engine forked from SuperDoc; the chrome is vanilla JS). This is
reference material for engineers working on the app: the dev loop, the headless
screenshot/QA harness, and the real-Microsoft-Word COM oracle used for validation.

> **Single world (slice 11):** the legacy `--legacy` boot flag, the `contenteditable`
> editor, and the `mammoth`/`html-to-docx` converter are gone. The PM engine is the
> only editor and the fork's `super-converter` is the only `.docx` path.

---

## Prerequisites

- **Node.js** — developed and tested on Node 18 (`v18.19.1`). Any Node that satisfies
  Electron 31's bundled runtime is fine; Node is only used to run npm scripts and the
  standalone test scripts, not as the app's own runtime (the app runs inside Electron's
  own Node).
- **Electron 31** — pinned as a devDependency (`"electron": "^31.7.6"`). Installed locally
  by `npm install`; you do **not** need a global Electron. Built with **electron-vite**
  (`electron-vite`, `vite`, `typescript` devDependencies).
- **Runtime libraries** (production deps, installed by `npm install`): `prosemirror-*`
  (the document model), `dompurify` (sanitizes imported HTML), `jszip` (OOXML packaging
  for the fork converter), `@fluentui/svg-icons` (icon source for `scripts/gen-icons.js`),
  `lodash`, plus the vendored SuperDoc fork (checked in under
  `src/renderer/core/superdoc-fork/`, no npm dep).

Install once:

```bash
npm install
```

The renderer is a **real build** (electron-vite). The document core (`src/renderer/core/`,
`bridge/`, `main.ts`) is TypeScript/ESM; the shared chrome under `src/renderer/public/` is
served verbatim as classic `<script>` tags on the global `WC` namespace.

---

## Running the app

```bash
npm start          # == electron-vite dev (builds, then launches)
```

`npm start` runs `electron-vite dev`, which builds and loads `src/main/main.js` (`out/main/index.js`).
The main process creates a frameless 1440×920 `BrowserWindow` (`createWindow()` in
`src/main/main.js`) and loads the built renderer.

Dev / build / preview are the electron-vite scripts:

```bash
npm run dev        # electron-vite dev (watch)
npm run build      # electron-vite build → out/{main,preload,renderer}
npm run preview    # electron-vite preview
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
# Run the PM functional battery; write {summary, results[]} to JSON
npm run build && npx electron . \
  --shot-evalfile=scripts/test-suite-pm.js \
  --probe-out=/tmp/wc-pm.json
```

`scripts/test-suite-pm.js` is an IIFE that exercises real command paths through the
`window.WC.PM` bridge and `window.WC.Commands` and **returns** `{summary, results[]}`,
which `maybeScreenshot()` writes to `--probe-out`. (`npm run test:pm` wraps this exact
invocation.)

You can combine a probe with a screenshot to get both a result file and a picture of the
final state:

```bash
npm run build && npx electron . \
  --shot-evalfile=scripts/test-suite-pm.js \
  --probe-out=/tmp/wc-pm.json \
  --shot=/tmp/after.png
```

A quick one-liner probe (no file) reads live editor state via the bridge:

```bash
npm run build && npx electron . \
  --shot-eval="JSON.stringify(window.WC.PM.queryState())" \
  --probe-out=/tmp/state.json
```

---

## The gate suites

**Three gates (always `npm run build` first):**

| Gate | Script | What it covers |
|---|---|---|
| `test:pm` | `scripts/test-suite-pm.js` | PM in-renderer functional suite (the real `WC.PM` command paths) |
| `test:smoke` | `scripts/smoke-pm.js` | PM-core smoke (9) |
| `test:roundtrip` | `scripts/test-roundtrip-pm.js` | PM-converter docx round-trip — THE docx gate |

**`npm run test:roundtrip` — the PM-converter docx gate.**
`scripts/test-roundtrip-pm.js` spawns Electron with the renderer probe
`scripts/test-roundtrip-pm-probe.js` and runs docx → PM → docx per fixture on the
fork converter (import, zip export to `/tmp/wc-rt-*.docx`, `exportXmlOnly` grep
invariants, re-import + zip-level asserts via `scripts/docx-inspect.js`). See
[docs/TESTING.md](TESTING.md) §2a.

```bash
npm run build && npm run test:pm
npm run build && npm run test:smoke
npm run build && npm run test:roundtrip
```

---

## Real-Word COM oracle workflow

Because the dev machine (Windows 11 + Word 16.0) has genuine Microsoft 365 Word
installed, features are validated **differentially against the real Word object model**
via PowerShell COM automation. This is the ground-truth oracle; the parity reference
is **Word for Windows 16.0**. The in-repo driver is `scripts/oracle/word-oracle-win.ps1`.

### How it works

Drive Word through COM from PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1
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

### Two-leg differential validation

`.docx` fidelity is validated in two legs:

- **Leg A — clone → Word.** The PM converter exports a `.docx` (the same `WC.PM.exportDocxBytes()`
  path the app uses); the oracle opens it in real Word over COM and reads the object model back,
  confirming the construct survives Word's own parse + resave.
- **Leg B — Word → clone.** A real-Word-authored `.docx` is imported through the fork
  `super-converter` and the resulting model is asserted.

The archived oracle output (per slice) lives under `notes/` and `docs/research/`; older `.ps1`
probes live at `C:\Users\Public\wcprobe\`. (The pre-rebuild `export_ref.js`/`analyze_import.js`
helpers — which used `html-to-docx`/`mammoth` — were removed with the legacy converter.)

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
`docs/VALIDATION_home_insert.md` and the Aptos theme corrections in
`docs/research/real-word-groundtruth.json` (body Aptos 12pt, Heading 1 = 20pt navy
`#0E2841`, the Aptos accent palette, etc.). Since slice 8 it validates the PM converter's
`.docx` output construct-by-construct (track changes, comments, fields, themes, …) — each
slice's Leg A/Leg B results are recorded under `notes/`.

---

## Quick reference

```bash
# Run
npm start                                   # build + launch (electron-vite dev)
npm run build                               # electron-vite build → out/
npm start -- --win=1280x800 --start-maximized

# Screenshot / probe (one-shot, auto-quits)
npx electron . --shot=/tmp/word.png

# Gate suites (build first)
npm run build && npm run test:pm            # PM functional suite
npm run build && npm run test:smoke         # PM-core smoke (9)
npm run build && npm run test:roundtrip     # PM-converter docx round-trip (THE docx gate)

# Real-Word COM oracle
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1
```
