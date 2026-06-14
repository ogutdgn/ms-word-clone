# Word Clone

A faithful desktop reproduction of **Microsoft Word** (Microsoft 365, light theme) — UI, features, and core functionality — built from scratch as an **Electron** application.

It reproduces the Word chrome (custom title bar + Quick Access Toolbar, the full ribbon with all 10 tabs and the File backstage), a paginated document editing surface, and a large set of real editing features (rich text formatting, styles, lists, tables, find & replace, page layout, print/PDF, and `.docx` import/export).

> This project was generated as a one-shot engineering exercise. It is **not affiliated with Microsoft**. "Word", "Microsoft Word", and the ribbon design are trademarks/visual property of Microsoft; this is an independent look-alike for educational purposes.

---

## Running it

```bash
npm install        # installs electron, electron-vite, prosemirror-*, jszip, dompurify, …
npm start          # builds (electron-vite) and launches the desktop app
```

On WSL2/WSLg a window opens directly. If GPU rendering is flaky, launch with software rendering:

```bash
npm start -- --no-sandbox --disable-gpu
```

### Optional debug flags (used for visual QA)
- `--shot=/path/out.png` — capture the window to a PNG after load and quit.
- `--shot-delay=<ms>` — delay before capture (default 1200).
- `--shot-evalfile=/path/script.js` — run a JS file in the renderer before capturing.

---

## What it looks like

| | |
|---|---|
| Home tab + document | bold/italic/underline/strike/color/highlight, headings, bullets, tables, live word count |
| Insert tab | Pages, Tables, Illustrations, Add-ins, Media, Links, Comments, Header & Footer, Text, Symbols |
| Backstage (File) | New (template gallery), Open (recent files), Print, Save As, Export PDF, Info, Account |

---

## Architecture & key decisions

This codebase was driven by a **deep-research phase** (see `docs/research/`) that mapped the real Word ribbon (10 tabs, 62 groups, **216 controls** + a 14-section backstage), the exact M365 visual spec (palette/typography/metrics), a feature-feasibility classification, and a technical strategy. The ribbon you see is **generated from that research data** (`scripts/gen.js` → `src/renderer/public/js/ribbon-data.js`), so it is exhaustive rather than hand-curated.

**Process model (secure Electron posture).**
- `contextIsolation: true`, `nodeIntegration: false`, frameless custom-titlebar `BrowserWindow`.
- All Node work (filesystem, dialogs, raw `.docx` bytes, print/PDF) lives in the **main process** (`src/main/main.js`) and is exposed to the renderer through a typed `contextBridge` preload (`src/main/preload.js`) as `window.wordAPI`. The OOXML↔model conversion runs renderer-side in the vendored fork.
- Imported/pasted HTML is sanitized with **DOMPurify** before it ever touches the DOM.

**Editor engine — a real document model.**
The document is a **ProseMirror editor** rendered into `#pm-editor`, built on an **owned, vendored fork of SuperDoc's `super-editor`** core (schema + `super-converter` + the editing extensions), under `src/renderer/core/superdoc-fork/`. The ribbon chrome (still vanilla JS) drives it through the `WC.PM` bridge (`src/renderer/bridge/*.ts`), which turns ribbon commands into ProseMirror transactions. This replaced the original `contenteditable` + `execCommand` prototype: a real document model gives faithful round-trip integrity and a clean tap point for the planned logger/verifier. See `docs/architecture/` for the target design and `docs/decisions/` for the locked ADRs.

**Pagination.**
The editor is a single continuous flow styled as a Letter/A4 sheet (816×1056px @96dpi, 1″ margins) on a gray canvas. Page boundaries are drawn as guides and the "Page X of Y" count is computed by measuring content height. **PDF/print export is paginated for real** by Chromium's `printToPDF`/`@page`. (On-screen per-sheet reflow with repeated headers/footers is approximated — see `docs/NOT_IMPLEMENTED.md`.)

**File round-trip.**
- Open: `.docx` via the **forked SuperDoc converter** (`super-converter`, structural OOXML → PM model), plus `.html`, `.txt`, `.csv`/`.tsv`.
- Save: `.docx` via the same fork converter (PM model → OOXML), plus `.html` and `.txt`. Export to PDF via Chromium.
- The fork converter does a full structural round-trip (sections, styles, lists, tables, fields, track changes, comments); it is not byte-identical. Verified by `npm run test:roundtrip` (the docx gate).

### Project layout

```
msword-clone/
├── package.json
├── electron.vite.config.ts  # electron-vite build (main/preload/renderer + fork aliases)
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main: window, IPC, file IO, docx bytes, print/PDF
│   │   └── preload.js       # contextBridge → window.wordAPI
│   └── renderer/
│       ├── index.html       # app shell (loads the shared chrome scripts, then main.ts LAST)
│       ├── main.ts          # NEW-core entry: constructs the vendored Editor, mounts #pm-editor
│       ├── core/superdoc-fork/  # OWNED vendored ProseMirror engine (schema + super-converter + extensions)
│       ├── bridge/          # WC.PM bridge: ribbon commands → ProseMirror transactions (TS/ESM)
│       │   ├── index.ts     # the WC.PM surface (commands/io/state-sync/focus)
│       │   ├── io.ts        # docx/html/txt/csv open + docx/html/txt save via wordAPI
│       │   └── …            # insert, table, search, review, references, design, mail, draw, …
│       └── public/          # shared chrome, served verbatim (still classic <script> tags):
│           ├── js/          # icons*, util, ribbon-data (gen), ribbon, commands (H[cmd] hub),
│           │                #   dialogs, statusbar, files, backstage, app, *-tools value tables
│           ├── styles/      # base, titlebar, ribbon, backstage, editor, dialogs, comments-pm, …
│           └── vendor/purify.min.js
├── scripts/
│   ├── gen.js               # research JSON → ribbon-data.js + docs
│   ├── test-suite-pm.js     # PM functional suite (test:pm)
│   ├── smoke-pm.js          # PM-core smoke (test:smoke)
│   └── test-roundtrip-pm.js # PM-converter docx round-trip (test:roundtrip — THE docx gate)
└── docs/
    ├── NOT_IMPLEMENTED.md   # ← the catalog of Word features not (fully) replicated
    └── research/            # raw research + visual-spec.md + tech-notes.md
```

---

## Feature coverage — all 10 ribbon tabs implemented

Every ribbon tab has been built, tested, web-researched, and **validated against the user's real Microsoft Word** (via PowerShell COM automation). Per-tab feature docs live in `docs/`:

| Tab | Highlights | Doc |
|---|---|---|
| **Home** | rich text, fonts, Font dialog, Text Effects, Multilevel List, Clipboard pane, Format Painter, Dictate, Styles pane, Find/Replace | [HOME_TAB.md](docs/HOME_TAB.md) |
| **Insert** | Cover Page, tables (+right-click editing), Shapes/Icons/SmartArt/Chart (SVG), Header/Footer, Page Numbers, Bookmark, Cross-ref, WordArt, Symbol map | [INSERT_TAB.md](docs/INSERT_TAB.md) |
| **Draw** | real freehand ink (pen/pencil/highlighter), eraser, select, Drawing Canvas | [DRAW_TAB.md](docs/DRAW_TAB.md) |
| **Design** | themes, color schemes, font pairings, paragraph spacing, watermark, page color, page borders | [DESIGN_TAB.md](docs/DESIGN_TAB.md) |
| **Layout** | margins/orientation/size/columns, line numbers, hyphenation, indent/spacing spinners, Arrange (wrap/order/align/rotate) | [LAYOUT_TAB.md](docs/LAYOUT_TAB.md) |
| **References** | Table of Contents, footnotes/endnotes, citations & bibliography, captions, table of figures, index | [REFERENCES_TAB.md](docs/REFERENCES_TAB.md) |
| **Mailings** | full mail-merge engine (recipients, merge fields, address/greeting blocks, live preview, finish & merge), envelopes, labels | [MAILINGS_TAB.md](docs/MAILINGS_TAB.md) |
| **Review** | real Track Changes engine (ins/del, accept/reject, display modes, reviewing pane), comments, accessibility checker, thesaurus, compare | [REVIEW_TAB.md](docs/REVIEW_TAB.md) |
| **View** | Read/Print/Web/Outline/Draft, Immersive Reader, zoom, ruler/gridlines/nav pane, properties | [VIEW_TAB.md](docs/VIEW_TAB.md) |
| **Help** | Help, What's New, Feedback dialogs | — |

The PM functional suite (`scripts/test-suite-pm.js`) and the PM-converter docx round-trip (`scripts/test-roundtrip-pm.js`) are the active gates (see [docs/TESTING.md](docs/TESTING.md)).

**Real-Word validation.** Because the dev machine has Microsoft Word installed, features are validated differentially against the genuine Word object model through COM (`scripts/oracle/word-oracle-win.ps1` and the archived `*_probe.ps1` scripts under `docs/research/` / `C:\Users\Public\wcprobe\`), extracting ground truth (the **Aptos** theme, style metrics, field/footnote/revision behavior, etc.) and A/B-comparing the clone's saved `.docx`. The current parity reference is **Word for Windows 16.0**. See [`docs/VALIDATION_home_insert.md`](docs/VALIDATION_home_insert.md).

**Not implemented / approximated:** see **[`docs/NOT_IMPLEMENTED.md`](docs/NOT_IMPLEMENTED.md)** — VBA macros, real-time co-authoring, byte-perfect OOXML fidelity, multi-window features, cloud services (Translate/Researcher/Smart Lookup/OneNote), Ink-to-Shape/Math, the Aptos typeface itself (Linux fallback). Every such control is still **present in the UI** for fidelity; clicking one shows an explanatory message.

---

## Testing & QA

Three gate suites (build first with `npm run build`):

```bash
npm run test:pm          # PM in-renderer functional suite (drives the real WC.PM command paths)
npm run test:smoke       # PM-core smoke (9)
npm run test:roundtrip   # PM-converter docx round-trip — THE docx gate
```

See [docs/TESTING.md](docs/TESTING.md) for the harness internals, the COM-oracle workflow, and the "regression test per fix" rule.

## License

MIT (for the original code in this repository). Microsoft Word's design and trademarks belong to Microsoft.
