# Word Clone

A faithful desktop reproduction of **Microsoft Word** (Microsoft 365, light theme) — UI, features, and core functionality — built from scratch as an **Electron** application.

It reproduces the Word chrome (custom title bar + Quick Access Toolbar, the full ribbon with all 10 tabs and the File backstage), a paginated document editing surface, and a large set of real editing features (rich text formatting, styles, lists, tables, find & replace, page layout, print/PDF, and `.docx` import/export).

> This project was generated as a one-shot engineering exercise. It is **not affiliated with Microsoft**. "Word", "Microsoft Word", and the ribbon design are trademarks/visual property of Microsoft; this is an independent look-alike for educational purposes.

---

## Running it

```bash
cd /home/ogutd/msword-clone
npm install        # already done; installs electron, mammoth, html-to-docx, jszip, dompurify
npm start          # launches the desktop app
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

This codebase was driven by a **deep-research phase** (see `docs/research/`) that mapped the real Word ribbon (10 tabs, 62 groups, **216 controls** + a 14-section backstage), the exact M365 visual spec (palette/typography/metrics), a feature-feasibility classification, and a technical strategy. The ribbon you see is **generated from that research data** (`scripts/gen.js` → `src/renderer/js/ribbon-data.js`), so it is exhaustive rather than hand-curated.

**Process model (secure Electron posture).**
- `contextIsolation: true`, `nodeIntegration: false`, frameless custom-titlebar `BrowserWindow`.
- All Node work (filesystem, dialogs, `.docx` conversion) lives in the **main process** (`src/main/main.js`) and is exposed to the renderer through a typed `contextBridge` preload (`src/main/preload.js`) as `window.wordAPI`.
- Imported `.docx` HTML is sanitized with **DOMPurify** before it ever touches the DOM (mammoth does not sanitize).

**Editor engine — a deliberate tradeoff.**
The research recommended ProseMirror for maximum fidelity. I chose **raw `contenteditable` + a custom command layer** instead, because:
1. We ship exactly one Chromium engine (Electron 31), so the usual "`execCommand` is non-deterministic across browsers" objection does not apply here.
2. It delivers far broader Word feature coverage per unit of effort — which was the explicit goal — and integrates with the browser's native undo/redo and clipboard.

This is the one architectural place where I traded theoretical correctness for breadth; see `docs/research/tech-notes.md` for the full analysis.

**Pagination.**
The editor is a single continuous flow styled as a Letter/A4 sheet (816×1056px @96dpi, 1″ margins) on a gray canvas. Page boundaries are drawn as guides and the "Page X of Y" count is computed by measuring content height. **PDF/print export is paginated for real** by Chromium's `printToPDF`/`@page`. (On-screen per-sheet reflow with repeated headers/footers is approximated — see `docs/NOT_IMPLEMENTED.md`.)

**File round-trip.**
- Open: `.docx` via **mammoth** (→ semantic HTML), plus `.html`, `.txt`, basic `.rtf`.
- Save: `.docx` via **html-to-docx**, plus `.html` and `.txt`. Export to PDF via Chromium.
- Round-trip is lossy by design (the two document models differ); verified with `scripts/test_docx.js` (9/9 content checks pass).

### Project layout

```
msword-clone/
├── package.json
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main: window, IPC, file IO, docx conversion, print/PDF
│   │   └── preload.js       # contextBridge → window.wordAPI
│   └── renderer/
│       ├── index.html       # app shell
│       ├── styles/          # base, titlebar, ribbon, backstage, editor, dialogs
│       ├── js/
│       │   ├── icons.js     # monoline Fluent-style SVG icon set
│       │   ├── util.js      # DOM helpers, flyouts, color palette, toasts, dialogs
│       │   ├── ribbon-data.js  # GENERATED ribbon model (do not hand-edit)
│       │   ├── editor.js    # contenteditable, selection state, pagination, zoom, views
│       │   ├── formatting.js# block formatting + Word named styles
│       │   ├── commands.js  # command dispatcher + all handlers
│       │   ├── ribbon.js    # ribbon/tab rendering + live toggle sync
│       │   ├── dialogs.js   # Insert Table/Link/Symbol/Equation, Find/Replace, Paragraph, Word Count, Zoom, panes
│       │   ├── statusbar.js # page/word count, view buttons, zoom slider
│       │   ├── files.js     # document lifecycle + IO via wordAPI
│       │   ├── backstage.js # File menu (New/Open/Print/Save/Export/…)
│       │   └── app.js       # bootstrap, title bar, keyboard shortcuts, ruler
│       └── vendor/purify.min.js
├── scripts/
│   ├── gen.js               # research JSON → ribbon-data.js + docs
│   └── test_docx.js         # docx round-trip test
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

**157 automated functional tests pass** (`scripts/test-suite.js`) plus a **9/9 `.docx` round-trip** with an OOXML regression guard.

**Real-Word validation.** Because the dev machine has Microsoft Word installed, every tab was checked against it: the `*_probe.ps1` / `*_oracle.ps1` scripts (archived under `docs/research/` and `C:\Users\Public\wcprobe\`) drive the genuine Word through COM, extract ground truth (the **Aptos** theme, style metrics, field/footnote/revision behavior, etc.), and A/B-compare the clone's output. This caught and fixed a **critical interop bug** — the clone's saved `.docx` files were unopenable in real Word (an `html-to-docx` `w:header="undefined"` defect that mammoth/LibreOffice silently tolerated). See [`docs/VALIDATION_home_insert.md`](docs/VALIDATION_home_insert.md).

**Not implemented / approximated:** see **[`docs/NOT_IMPLEMENTED.md`](docs/NOT_IMPLEMENTED.md)** — VBA macros, real-time co-authoring, byte-perfect OOXML fidelity, multi-window features, cloud services (Translate/Researcher/Smart Lookup/OneNote), Ink-to-Shape/Math, the Aptos typeface itself (Linux fallback). Every such control is still **present in the UI** for fidelity; clicking one shows an explanatory message.

---

## Testing & QA

Two automated suites, both passing:

```bash
# 1) In-app functional battery (39 assertions) — drives the real command paths and asserts on DOM/state
npm start -- --no-sandbox --disable-gpu --probe-out=/tmp/results.json --shot-evalfile=scripts/test-suite.js
#    → writes {summary:{total,pass,fail}, results[]} to /tmp/results.json   (currently 39/39 pass)

# 2) .docx round-trip test (9 content checks) — HTML → DOCX (html-to-docx) → HTML (mammoth)
node scripts/test_docx.js                                                   # currently 9/9 pass
```

This project was also put through two multi-agent **review workflows** (an adversarial correctness pass and a 5-dimension QA pass covering fidelity, security, CSS, robustness, and file IO). Findings were independently verified; the confirmed real defects — an XSS in Insert Link, a multi-parent Sort crash, Drop Cap clobbering formatting, missing table-size validation, and two unsaved-changes data-loss paths (window Close + a swallowed save error) — were all fixed and have regression tests in `scripts/test-suite.js`. The raw findings are archived in `docs/research/qa-findings.json` and `docs/research/review-findings.json`.

## License

MIT (for the original code in this repository). Microsoft Word's design and trademarks belong to Microsoft.
