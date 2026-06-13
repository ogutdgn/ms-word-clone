# Deferrals & exclusions ledger

> The single place for everything the build must NOT chase right now. Three classes:
> **(A) Phase-7 / pagination-gated** — lands when real page sheets land, after Phase 2.
> **(B) Cloud-runtime stubs** — physically need Microsoft cloud services; get graceful
> Word-like degraded behavior, final hide-vs-keep list presented to the user at Phase-2 end.
> **(C) Recorded product decisions / known deviations** — deliberate, evidence-backed.
> Moving a parity item HERE mid-slice requires it to fit A, B, or an explicit C decision —
> never "hard to fix". Append, date, justify; never silently drop items.
> *(Moved from `docs/loop/` 2026-06-11 when the short-lived loop process was retired —
> the ledger itself is process-independent and stays live.)*

## A — Phase-7 / pagination-gated (spec §9.3)

- Page-setup *visual* geometry: margins, orientation, size, columns (model attrs may land earlier).
- Header/footer **editing** (needs live child editors); page-number fields' visual effect.
- Multi-page indicators, multi-page View modes, Side-to-Side.
- TOC page numbers (slice 9 ships TOC with degraded numbers).
- Find → Go To "Page"/"Line" visual landing.
- Table visuals pinned to layout: distribute-rows height render, AutoFit reflow,
  repeat-header render, text-direction BiDi metrics.
- **Mail-merge envelopes/labels page geometry (slice 10, D10.10).** PM mode inserts REAL
  content honestly — envelopes prepend a real PM page (`PM.openHtml(env + getHTML())`,
  existing content preserved); Labels → New Document builds a real PM label grid
  (`PM.openHtml(gridHtml)`). DEFERRED to Phase 7: Avery-grid page fidelity (true
  envelope/label sheet geometry), Labels → **Print** (PM path toasts, no E() mutation),
  and `updateLabels` «Next Record» propagation across a PM label table (PM path toasts,
  no E() mutation). NO `E()` mutation is reachable in PM mode (leak audit clean).

## B — Cloud-runtime stubs (docs/NOT_IMPLEMENTED.md is the authority)

Office.js add-ins · 3D models · online pictures/video playback · co-authoring ·
translator services · Editor (cloud grammar) · Researcher. Loop obligation: no jarring
"not implemented" toasts — graceful Word-like degradation only.

## C — Recorded decisions & known deviations (as of end of slice 7)

| Item | Decision / evidence | Recorded |
|---|---|---|
| Equation = styled Cambria-Math text, not OMML | real OMML math deferred (slice-6 deviation) | slice 6 |
| csv/tsv opens as a real PM **table**; opens UNSAVED (path=null) | user-directed; real Word shows raw delimited text (screenshot evidence in the slice-7 oracle JSON) | slice 7, D7.3/D7.4 |
| html import/export is **semantic** (inline styles stripped, alignment kept; headings export as styled paragraphs; `data-sd-*` attrs leak) | fork `stripHtmlStyles` + DOMSerializer design | slice 7, D7.10 + leg B |
| `.md`/`.rtf` open = legacy-only (fork `markdown` option noted as cheap future leg) | scope per spec §9.1 row 7 | slice 7, D7.2 |
| txt export: one block per line (Word tab-separates table cells); page break exports as `\n` | `textBetween` semantics | slice 7 |
| Save As offers docx/html/txt only | scope per spec | slice 7 |
| Phantom recents (push precedes import verdict) | pre-existing behavior carried forward; renderer-confirmed push = follow-up | slice 7 |
| Failed html import lands on a blank doc, binding UNBOUND via `PM.lastImportBlanked()` | data-loss guard; confirmDiscard consented | slice 7 |
| Mac Word ⌘F = toolbar search; our preserved sidebar pane | re-evaluate vs WINDOWS Word in slice-8 parity (Windows Word HAS a nav sidebar — may now be parity, not deviation) | slice 5 → revisit |
| Selection-scoped Replace All not supported (whole-doc only) | slice-5 deferral | slice 5 |
| Find "Sounds like / word forms / prefix-suffix / punctuation" options | deferred exotic options | slice 5 |
| Table Tools deferrals: tblLook checkboxes, ~50-style gallery breadth, border pen tools/Border Painter, Height/Width spinners, View Gridlines/Draw/Eraser/Properties, Cell Margins dialog, AutoFit-Contents reflow, banded-row live render, text-direction dropdown gallery | slice-6 recorded deferrals — candidates for slice-10/11 parity passes where NOT pagination-gated | slice 6 |
| Excel-Spreadsheet / Quick-Tables menu items | absent in Word Mac (re-check vs Windows Word in parity) | slice 6 |
| Authored data-URL images get a fresh rId per export | converter behavior | slice 6 |
| `onContentError` lifetime asymmetry (html- vs docx-seeded editors) | recorded follow-up, no current consumer | slice 7 review |
| No automated pin on the contentError recovery branch (probe-only) | synthetic fault injection needed | slice 7 review |
| `warnOnUnsupportedContent` not threaded (silent lossy html imports possible) | recorded follow-up | slice 7 review |
| `[0a] dirty flag` PM test flakes rarely on slow boots | re-run clears; don't chase | slice 7 |
| Suites flake under heavy parallel load | run gates on an idle machine | slice 7 |
| **PM-mode styles: NO hover Live Preview** — the gallery applies on CLICK only (selection → selection; caret → current paragraph) | user-directed (the hover preview restyled the selection/whole-paragraph live, read as a bug). REVERSIBLE — only `ribbon.js`'s hover wiring is disabled; `bridge/style-preview.ts` is intact. `--legacy` keeps its snapshot preview | post-slice-8 bug-fix (2026-06-11), PR #26 |
| TOC / Table of Figures / Index / Table of Authorities page numbers + caption SEQ numbers + rendered in-text-citation/bibliography text degrade to placeholders headless (TOC entry page run = `'0'`; caption number empty; bibliography/citation render empty) — the FIELD CODES + structure export and real Word repopulates on F9 (oracle Leg A clone→Word PASS) | Phase-7 layout gap (ledger-A class); `notes/2026-06-12-slice9-oracle.json` | slice 9 |
| Footnote/endnote note bodies are plain-text (rich formatting dropped); bibliography flyout title is cosmetic (the fork `BibliographyInsertInput` has no title slot — Bibliography/References/Works Cited collapse to one); Manual Table degrades to an auto TOC (`refInsertTOC` always builds from headings) | fork Document API shapes | slice 9 |
| **Word→clone import: the fork docx converter drops SEQ caption + CITATION complex fields → nodes** (footnotes + TOC import faithfully; an imported caption keeps its literal text but loses the SEQ number; an imported managed citation vanishes) — **PRIORITIZED fork-importer follow-up** (map `w:fldChar`+`w:instrText` SEQ/CITATION fields to `sequenceField`/`citation` nodes, or at least a `fieldAnnotation` preserving the cached display text) | oracle Leg B (`notes/2026-06-12-slice9-oracle.json`); pre-existing fork limitation, NOT a slice-9 wiring defect — clone create+export is faithful (Leg A) | slice 9 |
| **Mail-merge rule fields (IF/FILLIN/ASK/SKIPIF/SET) export as structurally-valid field codes but the IF OPERATOR is not mapped** — the legacy dialog builds `IF «F» Equal to "v" …`; Word's IF syntax is `IF «F» = "v" …`, so an exported IF won't auto-evaluate in Word (it round-trips as an inert-but-valid field, parity with the legacy engine which never evaluated rule fields). MERGEFIELD/GREETINGLINE/ADDRESSBLOCK/NEXT are full-fidelity (oracle Leg A PASS). Follow-up: map the operator labels (`Equal to`→`=`, `Not equal to`→`<>`, …) in `ifThenElseDialog` | recorded product decision (D10.9); `notes/2026-06-12-slice10-mailmerge-oracle.json` | slice 10 |
| **Word→clone import: a previewed/merged ADDRESSBLOCK/GREETINGLINE imports as the «…» placeholder, not the rendered multi-line text** — the `sd:mergeField` translator reconstructs `displayLabel` from the field instruction and discards the cached result runs. A plain MERGEFIELD is lossless (the cached run IS just «Name»). Follow-up: extract the cached text into `displayLabel` when it differs from the placeholder | recorded deviation (D10.12); `notes/2026-06-12-slice10-mailmerge-oracle.json` | slice 10 |

## Process notes

- Slices 1–7 were oracle-validated vs **Word for Mac 16.77.1**; from slice 8 the
  reference is **Word for Windows 16.0** (recorded in last-point.md, 2026-06-11
  Windows-replication entry). Mac-specific C-entries are
  re-evaluated against Windows Word during each slice's parity pass.
- Slice-6 UI-Codex leftover probes (A2 Insert-Table dialog, A5 Bookmark, B-layout/
  autofit, C1/C2) fold into the slice-10/11 parity passes naturally.
