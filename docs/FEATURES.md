# Features — Inventory & Index

This is the top-level map of what the Word clone does. It is an **index**, not a
re-statement of the per-tab docs: each row links to a dedicated `*_TAB.md` that lists every
control and its status. The clone renders the full Microsoft 365 ribbon — **10 tabs, 62
groups, 216 controls** (counting dialog-box launchers) — driven by
[`src/renderer/public/js/ribbon-data.js`](../src/renderer/public/js/ribbon-data.js), which is
auto-generated from the feature research and is the single source of truth for the ribbon
layout. Every command drives the single **PM/SuperDoc-fork engine** through the `WC.PM` bridge.

## Legend

- ✅ **Works** — implemented and functional in the app (possibly simplified).
- 🟡 **Partial / approximated** — a usable approximation; full Word behavior not replicated.
- ❌ **Stub** — present in the UI for fidelity, but the engine behind it needs a cloud/host
  runtime (Office.js, VBA, translator, 3D, co-authoring) — see
  [`NOT_IMPLEMENTED.md`](NOT_IMPLEMENTED.md).

## Tab-by-tab summary

Control counts are from `ribbon-data.js` (controls + group dialog-box launchers). The
"What works" column summarizes the per-tab doc — follow the link for the full control list,
the test count, and the MS Word COM-oracle validation notes.

| Tab | Groups | Controls | What works (summary) | Detail |
|---|---:|---:|---|---|
| **Home** | 10 | 46 | Clipboard (incl. Office Clipboard pane + Format Painter), full Font group + Font dialog (Ctrl+D), Paragraph (lists, multilevel, alignment, spacing, borders/shading, sort), Styles gallery + pane, Find/Replace/Select. Dictate is 🟡 (Web Speech), Add-ins / Reuse Files are ❌. | [HOME_TAB.md](HOME_TAB.md) |
| **Insert** | 10 | 30 | Cover/Blank/Break pages, live-grid Tables, Shapes/Icons/SmartArt/Chart as inline SVG, Screenshot, Links/Bookmark/Cross-ref, Header/Footer/Page Number, Text Box/Quick Parts/WordArt/Drop Cap, Equation/Symbol. 3D Models, OLE Object, Online Pictures, cloud Add-ins, video playback are ❌ stubs. | [INSERT_TAB.md](INSERT_TAB.md) |
| **Draw** | 5 | 11 | Real freehand-ink SVG overlay (Pointer Events + Catmull-Rom smoothing): Pens gallery, Add Pen, Eraser (stroke radius), Select Objects, Drawing Canvas. Lasso/Trackpad are 🟡; Ink-to-Shape, Ink-to-Math, Ink Replay are ❌ (ML/recognition). | [DRAW_TAB.md](DRAW_TAB.md) |
| **Design** | 2 | 10 | CSS-variable theming: Themes, Style Set, Colors, Fonts, Paragraph Spacing, Set as Default; Page Background = Watermark, Page Color, Page Borders (color/page-border validated vs real Word). Effects is a 🟡 stub. | [DESIGN_TAB.md](DESIGN_TAB.md) |
| **Layout** | 3 | 19 | Page Setup (Margins/Orientation/Size/Columns/Breaks, Line Numbers, Hyphenation), Paragraph indent/spacing spinners, Arrange on a selected object (Position, Wrap, z-order, Align, Rotate, Selection Pane). Group/Ungroup is 🟡. | [LAYOUT_TAB.md](LAYOUT_TAB.md) |
| **References** | 7 | 23 | TOC (from Heading 1–3 with page numbers), Add Text / Update Table, Footnotes & Endnotes, Citations & Bibliography (APA/MLA/Chicago/IEEE/Harvard), Captions + Table of Figures, Index (Mark/Insert/Update). Table of Authorities is 🟡; Smart Lookup / Researcher are ❌. | [REFERENCES_TAB.md](REFERENCES_TAB.md) |
| **Mailings** | 5 | 21 | Real mail-merge engine: Envelopes/Labels, Start Mail Merge, Select/Edit Recipients (CSV import), Insert Merge Field (`«Field»`), Address Block / Greeting Line, Preview Results navigation, Finish & Merge. Send Email is a ❌ stub. | [MAILINGS_TAB.md](MAILINGS_TAB.md) |
| **Review** | 11 | 25 | Real Track Changes (`<ins>`/`<del>` via `beforeinput`), Display for Review modes, Accept/Reject, Reviewing Pane, Comments, Word Count, Editor/spelling, Thesaurus, Accessibility Checker, Read Aloud, Compare (word-level diff), Restrict Editing. Translate, Block Authors, Linked Notes are ❌. | [REVIEW_TAB.md](REVIEW_TAB.md) |
| **View** | 8 | 26 | Read Mode / Print / Web / Outline / Draft, Focus + Immersive Reader, page-movement toggle, Ruler/Gridlines/Navigation Pane, Zoom set, Split, Properties dialog. Multi-window features and Macros are ❌. | [VIEW_TAB.md](VIEW_TAB.md) |
| **Help** | 1 | 5 | Help / Feedback / Show Training open Backstage or a docked Help pane; Contact Support / What's New are stubs. (No dedicated tab doc — see the audit's Help notes.) | — |
| **Totals** | **62** | **216** | 10 tabs fully rendered; per-tab docs above carry the authoritative status. | — |

> The `feasible` field inside `ribbon-data.js` is the *original research rating*, not the
> shipped status. Many controls rated `partial` there were finished and now work — the
> per-tab `*_TAB.md` docs reflect what actually ships. Use those docs, not the raw
> feasibility tags, as the source of truth for status.

**File IO (Backstage, not a ribbon tab)** — on the PM engine: open `.docx` (fork
converter), `.html`/`.htm` (semantic import), `.txt` (line-per-paragraph),
`.csv`/`.tsv` (imported as a real table — a recorded deviation: real Word opens csv as
delimited plain text; a csv import opens as an *unsaved* document since the table form
can't be written back); save/Save As `.docx`, `.html`, `.txt`; PDF export. Oracle-validated
(slice-7 legs A–D). (`.md`/`.rtf` open was a legacy-only path, removed in slice 11.)

## What "works" means here — two layers of verification

There are two distinct claims this project makes, documented separately:

1. **Each control exists and runs** — covered by the per-tab `*_TAB.md` docs and the
   PM functional suite (`scripts/test-suite-pm.js`). Many tabs were additionally checked
   against **real Microsoft Word via COM** (`scripts/oracle/word-oracle-win.ps1` + the
   archived `*_probe.ps1`) — e.g. page geometry, caption format, MailMerge type enums,
   Track-Changes revision counts — and the docs note where the clone matches the oracle
   and where it diverges.

2. **What visibly happens on screen matches Word** — the *on-screen-outcome parity* work,
   recorded in **[UI_FIDELITY_AUDIT.md](UI_FIDELITY_AUDIT.md)**. A multi-agent audit of all
   **212 controls across 10 tabs** flagged 81 divergences, adversarially confirmed 53, and
   fixed all of them. Read this for the parity fixes per tab (e.g. Focus/Side-to-Side/
   Read-Mode behaviors, split menus, contextual tabs). *(This audit ran on the pre-rebuild
   app; its outcomes carried forward as the parity bar the PM engine is held to.)*

## Features that need a cloud or host runtime

Everything deliberately left as a placeholder — because it requires a server, a proprietary
runtime, or an Office-grade engine — is cataloged in
**[NOT_IMPLEMENTED.md](NOT_IMPLEMENTED.md)**. The major ❌ buckets:

- **Add-ins** — Office.js task panes / store (Home, Insert).
- **Macros / VBA** — no VBA runtime (View ▸ Macros).
- **Cloud knowledge** — Smart Lookup, Researcher, Translate (References, Review).
- **Co-authoring & cloud** — Block Authors, Linked Notes, Reuse Files, real-time merge.
- **3D & OLE** — 3D Models, OLE Object embedding, embedded video playback (Insert).
- **Ink ML** — Ink-to-Shape, Ink-to-Math, Ink Replay (Draw).
- **Multi-window** — New Window, Arrange All, View Side by Side, Switch Windows (View).

`NOT_IMPLEMENTED.md` contains the full per-control list (the "Ribbon controls present in the
UI but not fully functional" section) and the area-by-area feasibility matrix.

## Known architectural approximations

The default **paged** layout engine (SuperDoc PresentationEditor, the rendering default since the
2026-06-21 paged-render migration) paints real per-page multi-page sheets. A few layout-coupled
outcomes are still being reconciled against it **per-feature**:

- **Real multi-page layout** is now LIVE in the default paged engine. Per-page **headers/footers**
  are fully wired (spec-kit **002**): on-page edit + the "Header & Footer Tools" contextual tab,
  **Different First Page / Odd & Even** variants, and real OOXML **`PAGE`-field page numbers** — all
  Word-COM-validated. (Caveat: a *freshly-inserted* page-number field shows "0" in-app until the doc
  is reopened; real Word resolves it per page.) **Multi-page View modes** are engine-backed; some
  other layout ribbon commands (floating-object position, line numbers, mid-doc section breaks) are
  still being reconciled.
- **Columns** are fully wired (spec-kit **003**): One/Two/Three + More Columns (spacing / equal-width)
  + **Left/Right unequal** + **line between** + a **column break** — the paged engine flows the text
  and it round-trips to real Word (oracle-validated; Left/Right match Word's 1.83"/4.17" preset). The
  owned `bodySectPr` write for line-between/unequal is outside undo + best-effort in-app paint (export +
  Word correct). Mid-doc **section** breaks remain a future feature.
- **Mirrored margins** render with the dominant value; **Side-to-Side** paging is approximate. (UI
  Fidelity Audit, "Known approximations".)
- **Spelling** uses a built-in common-misspellings dictionary, not a full dictionary.
- **`.docx` export** is a structural rebuild (the fork `super-converter`), not a
  byte-identical round-trip. (`NOT_IMPLEMENTED.md`; guarded by `test:roundtrip`.)

## Where to look

- Per-tab control inventories: the `*_TAB.md` files linked in the table above.
- On-screen parity vs Word and the fix log: [`UI_FIDELITY_AUDIT.md`](UI_FIDELITY_AUDIT.md).
- Stubs, feasibility matrix, and architecture tradeoffs: [`NOT_IMPLEMENTED.md`](NOT_IMPLEMENTED.md).
- The ribbon definition (source of the counts above): [`src/renderer/public/js/ribbon-data.js`](../src/renderer/public/js/ribbon-data.js).
- Functional tests: `scripts/test-suite-pm.js`; real-Word COM oracle: `scripts/oracle/word-oracle-win.ps1`.
