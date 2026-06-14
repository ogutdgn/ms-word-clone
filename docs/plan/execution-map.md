# Execution Map — session playbook + daily work log

> How to orient, execute the current phase, and record what got done. The forward plan lives
> here; the **Daily work log** (below) records what we actually did each day, with checkboxes.
> Big picture: [plan.md](plan.md) · dated state snapshots: [last-point.md](last-point.md).
> Renewed via the `plan-tracking` skill.

## At session START (always, in order)
1. Read **[last-point.md](last-point.md)** (top entry) — where we left off, current branch, next.
2. Read **this file** — current phase, next actions, and the Daily work log.
3. Skim **[plan.md](plan.md)** — goal, locked architecture, the two hard constraints, dev process.
4. Read the **ADR(s)** + matching [OPEN_DECISIONS.md](../decisions/OPEN_DECISIONS.md) item for
   the current phase.

> ⚠️ **Branching rule — never do code work on `main`.** Before writing or committing any code,
> **create and checkout a fresh feature branch** off the integration line, e.g. `feature/logger`.
> Confirm first with `git branch --show-current`. `main` receives **only reviewed merges at
> stable milestones**. (Docs-only updates may go on a docs branch and PR.)

## How to execute ANY phase/subsystem (the loop)
1. **Create + checkout a feature branch** (e.g. `feature/<subsystem>`) — do **NOT** work on
   `main`. Verify with `git branch --show-current` before any edit.
2. **Confirm the decision:** read its `OPEN_DECISIONS.md` recommendation + edge cases; confirm or
   adjust against the *real* code; if it changes a locked choice, add a superseding ADR.
3. **Build** it (strangler-fig — behind the existing ribbon; never break the Word UI).
4. **Test:** the 228-test in-renderer suite + the 9-test docx suite stay green; add a regression
   test per change; check feature parity.
5. **Checkpoint** (via the `plan-tracking` skill): **append** a dated entry to last-point.md and
   **tick** the Daily work log below.
6. **PR** for review; merge to the integration line; merge to `main` only at a stable milestone.

## CURRENT PHASE → Phase 2: Editing core behind the existing ribbon (strangler-fig)
> **Phase 1 (Scaffold) is COMPLETE** — see the 2026-06-05 entry in [last-point.md](last-point.md).
> The owned ProseMirror engine mounts/renders/edits a real `.docx` on `build/phase-1-scaffold`
> (all gates green: smoke 9/9, functional 257/257, docx 17/17; single PM copy; telemetry off; no
> `superdoc` npm dep). Branch **pushed**; merged to `main` via PR #10.
>
> **Slice 0a is DONE** (merged to `main` via PRs #11/#15): `#pm-editor` is now the visible
> editor behind the `WC.PM` bridge; `--legacy` restores the full legacy app; D6 two-layer guards live;
> ribbon state-sync from engine events; dirty/statusbar/visible-page re-pointed. Gates: 257/21/9×2/17.
>
> **Slices 0b, 0c and 1 are DONE and INTEGRATED** (all on `main` via PRs #11–#15; the stacked
> PRs #12–#14 cascaded into their bases, #15 was the catch-up — see last-point.md): file-IO
> bytes layer, the macOS Word oracle harness, and the **character-formatting flip** (area
> `character` on the PM engine, oracle-validated both ways vs Word 16.77.1). Gates re-verified
> on `main`: PM 43/43, 257, 9/9 × 2, 17.
>
> **Slice 2 is DONE** (`feature/phase-2-slice-2-paragraph`, PR #17): areas **`paragraph` +
> `lists` FLIPPED** — align/indent/spinners/line-spacing/shading/borders/sort, glyph-honoring
> list libraries, Word-native multilevel, Paragraph dialog, Word shortcuts; the slice-1
> hanging-indent gap closed (fork CSS shipped); new `read-para-props` oracle verb (quirks
> #16-23). Gates: **PM 76/76**, legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 3 is DONE** (`feature/phase-2-slice-3-styles`, PR pending): area **`styles`
> FLIPPED** — gallery click + PM-native hover live-preview (`bridge/style-preview.ts`:
> throwaway txn + `editor.setState` restore), styles pane applies (chevron leak closed;
> New Style deferred), 4 chords (+ the Ctrl+N `!shift` shadow fix), caret-driven gallery
> highlight (`st.block`), 4 minted built-in style defaults (SubtleEmphasis oracle-amended),
> heading keymap stripped; BOTH slice-2 revisits closed (resolved-ilvl level menu;
> resolvedPropertiesCache TableInfo+tblLook). New `read-style-props` verb (quirks #24-27);
> slice-2 oracle followUps closed; oracle legs A 5/5 + B 9/9 PASS. Gates: **PM 96/96**,
> legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 4 is DONE** (`feature/phase-2-slice-4-clipboard`, PR pending): areas
> **`clipboard` + `editing-misc` FLIPPED** — ribbon Cut/Copy/Paste (PM-native via
> `webContents` clipboard IPC), the Paste dropdown + a real `D.pasteSpecial` dialog
> (flavor list clipboard-state-driven, oracle-confirmed), Format Painter on the fork's
> `copyFormat` extended to Word scope (para props + first-run marks, replace-not-merge,
> link-preserving, double-click-sticky + Esc, state-sync button latch/copy cursor),
> Select All + Similar Formatting; `select` remapped find-replace → editing-misc (spec
> §9.1 row 4); Cmd+Shift+C/V chords (oracle B5). New `wordAPI.clipboard.*` IPC. Oracle
> leg A clone→Word PASS (full list fidelity), leg B Word→clone PASS core + a recorded
> list-marker leak (ship-and-track, user-approved 2026-06-08); physical Cmd+C/V both
> directions confirmed. Gates: **PM 112/112**, legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 5 is DONE** (`feature/phase-2-slice-5-find-replace`, PR pending): area
> **`find-replace` FLIPPED** — the legacy destructive `.find-hit` rewrite replaced by the fork's
> **decoration-based Search extension**; find pane (`pmFindPane`) drives the `WC.PM` search surface
> with a Word-faithful options row (Match case / Whole words / Use wildcards), live count, Replace +
> Replace All, close→`clearFind`; full Word scope (Match Case + Whole Words + Wildcards + Advanced
> Find) + all three Find-dropdown items (Find · Advanced Find · Go To); new `D.goToDialog`;
> Ctrl+F/H + edit.find/replace `pmBlockedOr`-wrapped in the flip commit. Fork edits (NOTICE'd): the
> Search ext gained `name:'search'` (was undefined storage), whole-word + Word-wildcard on the
> session path, wildcards forced case-sensitive (oracle A4). Oracle legs A 'QUX' clone→Word + B
> 'alpha×4' Word→clone both PASS; zero decoration leak in saved docx. Gates: **PM 130/130**, legacy
> 257, smoke 9/9 × 2, docx 17.
>
> **Slice 6 is DONE** (`feature/phase-2-slice-6-insert-basics`, PR pending): area
> **`insert-basics` FLIPPED** + the **net-new full Table Tools** built — insert primitives (link/
> image/page-break/blank-page/hr/symbol/equation-as-styled-text/bookmark-paired) via `bridge/insert.ts`;
> table insertion + the 9 ops + **14 NOTICE'd fork table commands** (style/align/indent/size/margins/
> borders/distribute/split/convert/text-direction/autofit — export round-trip-verified) via
> `bridge/table.ts`; **Table Layout + Table Design contextual ribbon tabs** (runtime-injected
> `{cmd,label,type}` via new `H.tbl*` handlers; `ribbon.js` extended for multiple contextual tabs,
> Header & Footer byte-identical) + a PM table context menu; exotica carve-out (14 → `insert-exotica`,
> `crossReference` → `references`); `Ctrl+K` guard; D6 tests repointed `link`→`newComment`,
> `table`→`tableOfContents`. Headless leg-A oracle PASS (link/table/image/bookmark survive export —
> docx-inspect). A post-build **table-defect fix batch** (user report → 4-agent hunt → 6 reviewed
> fixes on PR #23) landed: passive contextual tabs (no ribbon yank; Word Mac 'Layout' label),
> Center/Right table alignment geometry fix, caret-cell shading parity, AutoFit-Fixed un-stretch,
> **table styles end-to-end** (minted real-Word definitions + visual bake + dynamic gallery +
> direct-border precedence), 27 real Fluent icons, and **fresh/imported tables now render cell
> gridlines** (the "big box" fix — inside borders paint via CSS vars, export-pure).
> Gates: **PM 192/192**, legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 7 is DONE** (`feature/phase-2-slice-7-file-io`, PR #24 pending): **file-io on the PM
> engine** — open docx/html/htm/txt/**csv-as-table** (recorded deviation; csv opens UNSAVED per
> §5.3) + save/Save As docx/html/txt (two-phase `doc:askSavePath`; `doc:saveAsBytes` removed);
> imports rebuild the editor from the blank template + the fork's `html` constructor option
> (stay docx-exportable); degraded imports recover to a blank PM editor + `Files` unbinds via
> `PM.lastImportBlanked()`. **Gate transition (D7.6):** new **`test:roundtrip`** (27 checks,
> real-Word fixtures) is THE docx gate; `test_docx.js` demoted to the frozen legacy-converter
> gate (retires at slice 11). Slice-4 list-marker leak FIXED in fork `handleDocxPaste`
> (tag-early/remove-late, NOTICE'd). Oracle legs A–D PASS/recorded vs Word 16.77.1 — driven
> directly via computer-use MCP (first slice; slice-6 table-style reopen recheck closed).
> Gates (six): **PM 206/206**, legacy 257, smoke 9/9 × 2, docx 17, **roundtrip 27/0**.
>
> **Windows replication is DONE (2026-06-11):** development moved to the user's **Windows 11**
> machine — all six gates green on Windows (one Mac-vacuous PM test spy-hardened); the
> **Windows COM oracle** (`scripts/oracle/word-oracle-win.ps1`) ported, live-validated,
> critique-hardened; the two gitignored real-Word roundtrip fixtures re-authored
> (`author-fixtures-win.ps1`). From slice 8 the parity reference is **Word for Windows 16.0**
> (slices 1–7 stay validated vs Word for Mac 16.77.1). *(The short-lived
> completion-driven-agent-loop process was retired the same day — its Windows Step-0 work and
> the slice-8 build merged to `main` via the normal PR flow (PR #25); `docs/loop/` was removed
> and the deferral ledger lives on at [deferrals.md](deferrals.md).)*
>
> **Slice 8 is DONE** (`feature/phase-2-slice-8-review`, PR #25): area **`review` FLIPPED** —
> fork-engine **Track Changes** (ribbon latch + Ctrl+Shift+E + D8.7 Lock Tracking password
> dialog), tracked ins/del/format render + changed-line bars + format balloons + the
> Word-anatomy **Revisions pane** (comments count), modern contextual **comment cards**
> (composer/reply/like/edit/resolve + Contextual|List + right-dock pane) on the Document-API
> path (A2 — comments EXPORT), accept/reject(+advance)/all/by-selection, display modes
> (All/Simple/None/Original — fork-native ×3 + CSS ×1), Show Markup latches, **Track Changes
> Options (+Advanced, honestly-consumed settings) + Change User Name**, **Compare → REAL
> tracked-changes diff** (`PM.runCompare`, right-to-left fresh-offset-map apply), **Restrict
> Editing pane** (engine `setEditable`), proofing re-points (Word Count/Editor pane/Thesaurus/
> Accessibility Assistant/Read Aloud per-word `::highlight`/Language P9/Spelling P3), R2/R3
> enablement greys, **D8.8 titlebar mode pill** (Editing|Reviewing|Viewing). Parity: 57-item
> checklist ticked via the 58/58 DOM/behavior audit (`scripts/probe-slice8-parity.js`);
> **oracle legs A+B PASS vs Word for Windows 16.0 over COM** (w:ins/w:del/**w:rPrChange** +
> comments survive Word's own resave; Word-authored revisions import with real authors;
> `notes/2026-06-11-slice8-oracle.json`). Gates (six): **PM 237/237**, legacy 257,
> smoke 9/9 × 2, docx 17, roundtrip 27/0.
>
> **Slice 9 is DONE** (`feature/phase-2-slice-9-references`, PR pending): area **`references`
> FLIPPED** — TOC (create-from-headings/update/remove; page numbers degrade to `'0'`),
> footnotes/endnotes (insert + a clone-owned continuous-flow **notes area** `#pm-notes-area`
> editing bodies via the Document API), captions + Table of Figures (SEQ; ToF = raw `TOC \c` field),
> citations/bibliography (real source store + exportable CITATION/BIBLIOGRAPHY fields + style combo),
> index + Table of Authorities (numeric `\c`), and cross-reference — all wired to the fork's
> **SuperDoc Document API** (`editor.doc.*`) via new `bridge/references.ts` + `bridge/notes-area.ts`;
> ribbon `H.*` re-pointed via `PMA()` (legacy byte-identical; leak audit clean); both `[0a]` D6
> guards repointed `tableOfContents`→`startMailMerge`; NOTICE'd fork fix (`toc-entry-builder.ts` reads
> `outlineLevel ?? outlineLvl`) so Add-Text feeds the TOC. Gates (six): **PM 275/275**, legacy 257,
> smoke 9/9 × 2, roundtrip 27/0, docx 17/0. Oracle vs Word for Windows 16.0: **Leg A clone→Word
> PASS** (footnotes/TOC/SEQ/CITATION/sources survive Word's resave unchanged), **Leg B Word→clone
> partial** (footnotes+TOC import; SEQ caption + CITATION drop on import — a recorded fork-converter
> follow-up). `notes/2026-06-12-slice9-oracle.json`.
> **Next: slice 10 — themes · mail-merge · draw · insert-exotica** (§9.1 row 10; independent PRs).
> ⚠️ Carry-over: the fork docx importer drops SEQ/CITATION complex fields → nodes (Leg B) — a
> prioritized fork-importer follow-up; slice-6 UI-Codex leftovers fold into slice-10/11 parity.
>
> **Slice 10 PR 1 (mail-merge) is DONE** (`feature/phase-2-slice-10-mail-merge`, PR pending): area
> **`mail-merge` FLIPPED** with MAXIMAL real-MS-Word fidelity — merge fields are REAL Word
> `MERGEFIELD` field codes (`w:fldSimple`/`w:fldChar`), NOT `w:sdt` content controls, round-tripping
> BOTH directions over the fork's mounted `FieldAnnotation` node. New fork work (NOTICE'd): an export
> branch in `translate-field-annotation.js` (`w:fldSimple` MERGEFIELD/GREETINGLINE · 5-run `w:fldChar`
> ADDRESSBLOCK · **3-run** NEXT, no spurious result) + an import path (`mergefield-preprocessor` +
> `sd:mergeField` `NodeTranslator` + a `generateV2HandlerEntity` in `docxImporter`, flag-independent of
> `editor.options.annotations`). New `bridge/mail.ts` (insert/highlight/non-destructive preview via
> `updateFieldAnnotations`/PM-aware Finish&Merge); `WC.Mail` doc-writes + `commands.js` rule inserts
> re-pointed via `PMA()` (legacy byte-identical; leak audit clean); both `[0a]` D6 guards repointed
> `startMailMerge`→`margins`/`header` (Phase-7-gated). Gates (six): **PM 285/285**, legacy 257, smoke
> 9/9 × 2, roundtrip 27/0, docx 17/0. Oracle vs Word 16: **Leg A clone→Word PASS** (ROUNDTRIP_OK no
> repair; Word's own resave preserved all 5 field codes), **Leg B Word→clone PASS** (automated
> `[10mm]` real-fixture import). `notes/2026-06-12-slice10-mailmerge-oracle.json`. A 2-lens review of
> the flip commit verified byte-identity+leak clean and caught 2 majors on gate-untested paths (PM
> merge resolver vs preview; checkErrors name read) — fixed in `e9e2242`. ⚠️ Ledger: rule-field IF
> operator semantics (C) · composite-import placeholder (C) · envelopes/labels page geometry (A).
>
> **Slice 10 PR 4 (draw) is DONE** (`feature/phase-2-slice-10-draw`, PR pending): area **`draw` FLIPPED** at MAXIMAL
> real-MS-Word fidelity — a STRICT UPGRADE over legacy (whose SVG ink never exported to .docx). Freehand strokes persist as
> REAL DrawingML freeform shapes: net-new fork `insertInkShape` + `synthesizeInkDrawing` (a:custGeom/a:pathLst moveTo+quadBezTo
> + a:ln pen stroke, wp:anchor floats-where-drawn, on a vectorShape.drawingContent blob the existing translateVectorShape
> replays — zero new exporter code, the WordArt mechanism; docPr id via generateDocxRandomId); `VectorShapeView` empty-for-isInk.
> New `bridge/draw.ts` (d* verbs incl. dInsertCanvas = a real prstGeom rect frame; non-dirtying tool state) + `bridge/ink-overlay.ts`
> (a `.wc-ink-layer` #pages-sibling overlay: captures strokes, persists each as a real shape on pointerup, renders ALL ink from
> the doc — fresh inkPoints AND reopened importer customGeometry.paths). Legacy WC.Draw/commands.js/ribbon.js re-pointed (pen-tile
> bypass + two-state; legacy byte-identical; leak audit clean). Gates (six): **PM 317/317**, legacy 257, smoke 9/9 × 2,
> roundtrip 27/0, docx 17/0. Oracle vs Word 16 **Leg A+B PASS**: an EARLY Task-1 gate proved the custGeom blob opens in Word
> (inline+anchor) BEFORE the flip (the PR3 lesson) → kept INK_MODE='anchor'; Leg A Word opens a 3-stroke+canvas doc without repair
> + preserves custGeom/wp:anchor/pen-colors/highlighter-alpha/prstGeom-rect on resave; Leg B clone re-imports Word's serialization
> healthy + the overlay renders all 3 imported strokes. `notes/2026-06-13-slice10-draw-oracle.json`. ⚠️ Ledger: real InkML
> w14:contentPart + real wpc:wpc canvas deferred (net-new); inkToShape/inkToMath honest toasts; arcTo dropped; highlighter =
> translucent freeform; live pointer-capture needs a manual `npm start` draw to confirm.
> **Next: slice 11 = legacy retirement** (slice 10 complete).
>
> **Slice 10 PR 3 (insert-exotica) is DONE** (`feature/phase-2-slice-10-insert-exotica`, merged): area
> **`insert-exotica` FLIPPED** at MAXIMAL real-MS-Word fidelity. The 14 exotic Insert commands dispatch to the
> new **`bridge/insert-exotica.ts`** (15 `xe*` verbs): dropCap = real `w:framePr`; coverPage = real `w:sdt`
> docPartObj (replace-existing); dateTime/quickParts = real `DATE`/`AUTHOR`/… `w:fldChar` fields
> (`editor.doc.fields.insert`); screenshot/icons/onlinePictures = real `w:drawing` images (`PM.insertImage`);
> textBox = editable VML `v:textbox` via net-new fork `insertTextBox` (NOTICE'd); WordArt = real DrawingML via
> net-new fork `insertWordArt` + `synthesizeWordArtDrawing` (`wps:wsp`+`bodyPr fromWordArt`+`a:prstTxWarp`+`w14`,
> NOTICE'd); onlineVideo = real link + Phase-7 toast; chart/smartart/object(OLE)/signatureLine = honest no-op
> toasts. 2 net-new fork commands. Legacy `WC.Insert.*`/commands.js re-pointed (legacy byte-identical; leak audit
> clean incl. the screenshot leak the first grep missed). Gates (six): **PM 310/310**, legacy 257, smoke 9/9 × 2,
> roundtrip 27/0, docx 17/0. Oracle vs Word 16 **Leg A+B PASS**: first run FAILED Word open — **bisected** to the
> coverPage sdt `<w:id>` (an ST_DecimalNumber; the critique-driven non-numeric string id was a hard schema
> violation) — **fixed** to a digits-only string; after the fix Word opens the 5-construct doc WITHOUT repair +
> preserves framePr/docPartObj/DATE/WordArt-wps/v:textbox on resave; Leg B clone re-imports Word's serialization
> healthy. `notes/2026-06-13-slice10-exotica-oracle.json`. ⚠️ Ledger: block-level VML-textbox import (user-approved
> defer — EXPORT real, reopen→passthrough) · WordArt non-editable/flat in-app · dropCap 'drop' not painted in-app ·
> icon SVG-only drawing · chart/smartart/OLE/signatureLine no construction path · onlineVideo no webVideoPr.
> **Next: slice 10 PR 4 = draw** (then slice 11 legacy retirement).
>
> **Slice 10 PR 2 (themes) is DONE** (`feature/phase-2-slice-10-themes`, merged): area **`themes`
> FLIPPED** at MAXIMAL real-MS-Word fidelity — themes/styleSet/colors/fonts **redefine NAMED-STYLE
> DEFINITIONS** (Heading1/2/3/Title/Subtitle/Normal) so headings restyle like real Word. Net-new fork
> command `redefineNamedStyles` (NOTICE'd) mutates BOTH the export structure (`translatedLinkedStyles.styles`
> + `syncStylesDiffToConvertedXml` → real `<w:style><w:rPr>` font+color, DELETING the `w:asciiTheme`/
> `w:themeColor` bindings so Word honors the literal) AND the visual array (`converter.linkedStyles[].definition.styles`,
> the decoration source), then forces a regen + emit (PREVIEW_META-tagged in hover so it never dirties).
> pageColor = net-new real `w:background` exporter/importer + `background` doc-attr + `displayBackgroundShape`
> settings flag (4 fork edits, NOTICE'd); pageBorders = real `w:pgBorders` (`editor.doc.sections.setPageBorders`);
> paragraphSpacing = real docDefaults `w:spacing` (`editor.doc.styles.apply`); watermark = honest visual stand-in
> + toast (Phase-7); effects/setAsDefault clone-owned. New `bridge/design.ts` (17 `de*` verbs + hover preview)
> + `PM.markDirty()` in io.ts; `WC.Design` re-pointed via `PMA()` (legacy byte-identical; leak audit clean).
> Gates (six): **PM 299/299**, legacy 257, smoke 9/9 × 2, roundtrip 27/0, docx 17/0. Oracle vs Word 16:
> **Leg A clone→Word PASS** (ROUNDTRIP_OK no repair; Word preserved w:background/displayBackgroundShape/
> w:pgBorders/heading color/Normal font/docDefaults spacing; K9 theme-deletes held; heading font survives via
> Normal-inheritance), **Leg B Word→clone PASS** (clone imports Word's serialization healthy). Live heading
> repaint confirmed. `notes/2026-06-13-slice10-themes-oracle.json`. The final whole-branch review caught a
> hover-preview-dirties-styled-doc bug (fixed `06bfeb5`, PREVIEW_META). ⚠️ Ledger: Style-Set/Spacing hover
> preview commit-only (C) · body-font live render best-effort (A/K2) · named-style not theme-token (C/K5) ·
> watermark/on-page render Phase-7 (A).
> **Next: slice 10 PR 3 = insert-exotica** (then draw).

**Goal:** make the owned engine the **ACTIVE** editor — wire `WC.RIBBON` commands → PM transactions,
feature area by feature area, and **retire the legacy `contenteditable` editor** (no more "two
worlds"; the new `#pm-editor` becomes THE page). Strangler-fig: flip one feature at a time, never
big-bang; gate on the 257/17 suites + per-feature Word fidelity.

**First actions (next session — slice 0b):**
- [x] **Integrate Phase 1 first** (merged to `main` via PR #10), then cut `feature/phase-2-editing-core`.
- [x] Run Phase 2 through its own cycle: **`brainstorming` → `writing-plans` → subagent execution**.
- [x] Decide the **command→transaction bridge**: `WC.PM` bridge (D5) + page flip to `#pm-editor` (D1) — DONE in slice 0a.
- [x] **Per feature flipped:** validate behavior + UI vs real Word (macOS AppleScript oracle); keep
  the gates green; add PM regression tests in `scripts/test-suite-pm.js`. *(Protocol established +
  run for slice 1; repeats every slice.)*
- [x] Wire **`.docx` SAVE/export** on the new engine — slice 0b (file-IO bytes layer). DONE.

**Watch-outs:** no pagination yet (Phase 7 — continuous flow is expected, not a regression);
list-marker/spacing fidelity is per-feature polish; keep the headless Editor reachable for export;
hold the single-PM-copy + telemetry-off invariants.

## Daily work log (newest first — check off what got done)

### 2026-06-13 (Phase 2 — slice 10 PR 4: draw)
- [x] **Orient + deep pre-verification** (ultracode 4-agent fan-out + synthesis): mapped the 8 draw cmds, the fork ink
  capability (real a:custGeom freeform achievable TODAY via the WordArt replay path; real InkML w14:contentPart + wpc:wpc canvas
  are net-new/out-of-scope), the dispatch+leak surface (incl. the ribbon pen-tile bypass), the render gap, and the export baseline.
- [x] **User scope decisions** (AskUserQuestion): real custGeom ink · full live ink chrome · real canvas frame.
- [x] **Critique-hardened plan** (`cd9a22f`) — 3-critic adversarial pass folded in: the reopened-ink render-loss (importer drops
  isInk + overwrites customGeometry → overlay renders from .paths too), missing dIsDrawing/dClearInk verbs, the pre-wired
  .wc-ink-layer Hide-Ink rule, buggy bbox math, and an EARLY Task-1 oracle gate.
- [x] **Subagent-driven execution (Tasks 0–6)**: `b1dabde` red [10dr] · `cfeedd1` fork insertInkShape (+ early oracle gate:
  inline+anchor both open clean → INK_MODE='anchor') · `cb31e41` VectorShapeView empty-for-isInk · `fcc43cc` bridge/draw.ts ·
  `35287ef` bridge/ink-overlay.ts (headless render probe: persisted ink renders) · `15feaee` re-point (legacy 257 byte-identical) ·
  `942f486` THE FLIP + leak audit.
- [x] **Six gates**: PM **317/317**, legacy **257/257 byte-identical**, smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle vs Word 16** (`7a33d0a`, `notes/2026-06-13-slice10-draw-oracle.json`): Leg A — Word opens 3-stroke + canvas
  without repair + preserves custGeom/wp:anchor/colors/highlighter-alpha/rect on resave; Leg B — clone re-imports Word's
  serialization healthy + the overlay renders all 3 imported strokes. **Both legs PASS.**
- [x] **Checkpoint + PR** (this entry). **Next:** slice 11 = legacy retirement.

### 2026-06-13 (Phase 2 — slice 10 PR 3: insert-exotica)
- [x] **Orient + deep fork pre-verification** (5-agent + 3-agent verbatim gather): textBox is much cheaper than
  feared (existing editable VML path); WordArt needs a synthesized `drawingContent` blob; only 2 net-new fork
  commands needed (`insertTextBox`, `insertWordArt`). 14-cmd area, 2 dispatch paths (H.* + dispatchMenu).
- [x] **Critique-hardened plan** (`861b6c7`, `docs/superpowers/plans/2026-06-13-phase2-slice-10-insert-exotica.md`)
  — 3-critic pass folded in (string-typed coverPage id, per-insert id counters, broadened leak grep, byte-exact
  legacy strings, explicit dropCapMenu kind mapping, in-app render-gap notes).
- [x] **Subagent-driven execution (Tasks 0–5)**: `59b62ed` red `[10ex]` tests · `c77b394` fork `insertTextBox` ·
  `4bd1874` fork `insertWordArt` · `003b2c7` `bridge/insert-exotica.ts`+wiring · `b2add2b` relax textBox round-trip
  (user-approved defer of block-level VML-textbox reimport) · `b827c85` re-point WC.Insert/commands.js · `8262258`
  THE FLIP + leak audit (caught + fixed a screenshot leak the first grep missed).
- [x] **Six gates**: PM **310/310**, legacy **257/257 byte-identical**, smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle vs Word 16** (`28d28e0` fix, `81b70eb` probes, `notes/2026-06-13-slice10-exotica-oracle.json`):
  Leg A first FAILED Word open → bisected to coverPage sdt `<w:id>` non-numeric string (ST_DecimalNumber violation)
  → fixed to digits-only string → Word opens 5-construct doc without repair + preserves all constructs on resave;
  Leg B clone re-imports Word's serialization healthy. **Both legs PASS.**
- [x] **Checkpoint + PR** (this entry). **Next:** slice 10 PR 4 = draw.

### 2026-06-13 (Phase 2 — slice 10 PR 2: themes)
- [x] **Orient + deep fork pre-verification** (7-agent verbatim gather + author re-verification): the
  load-bearing finds — named-style export machinery exists (`replayStyles`/`syncStylesDiffToConvertedXml`) and
  Heading1/Title/Normal ARE populated in `translatedLinkedStyles.styles` at runtime; the **export/visual
  asymmetry** (the decoration plugin reads `converter.linkedStyles` ARRAY, not `translatedLinkedStyles`) so a
  faithful redefinition must mutate BOTH + force regen; `w:background` is genuinely net-new.
- [x] **Brainstorm + user decisions** (AskUserQuestion): hover **live-preview** + watermark **visual stand-in**.
- [x] **Critique-hardened plan** (`990d1fa`, `docs/superpowers/plans/2026-06-13-phase2-slice-10-themes.md`) —
  3-critic adversarial pass folded 3 blockers (setDocAttribute not setNodeMarkup(0); DELETE theme bindings or
  Word ignores the literal — K9; drop a non-existent carbonCopy import) + 3 majors (params.tr; backgroundColor
  longhand; PM.markDirty).
- [x] **Subagent-driven execution (6 tasks, two-stage review each):** `9ce22aa`/`5ab3190` red `[10th]` tests ·
  `7e9fcb9` fork `redefineNamedStyles` · `ffd75f7` fork `w:background` · `5ac7e48` `bridge/design.ts` + wiring +
  io.ts markDirty · `e4b1a24` re-point `WC.Design` · `89b2348` THE FLIP + leak audit. Per-task reviews caught:
  the export-only-style sync gate (Task 1), the documentModified-on-no-op (Task 2), the deApplyFonts ok-guard +
  watermark double-encode (Task 3), the colors double-fire (Task 4).
- [x] **Six gates green:** PM 299/299, legacy 257/257 (byte-identical), smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
  (A 2-fail `[6b]` flip-run blip was load-flake — idle re-run 298→299.)
- [x] **Oracle vs Word 16** (`b25292c`, `notes/2026-06-13-slice10-themes-oracle.json`): Leg A clone→Word PASS
  (ROUNDTRIP_OK; constructs survive Word resave; K9 deletes held; heading font via Normal-inheritance), Leg B
  Word→clone PASS (clone imports Word's serialization healthy). Live heading repaint confirmed (decoration span
  Aptos→Georgia).
- [x] **Final whole-branch review** caught a hover-preview-dirties-styled-doc bug → fixed `06bfeb5` (PREVIEW_META
  on the preview regen tr) + a `[10th]` regression test.
- [x] **Checkpoint + PR** (this entry). **Next:** slice 10 PR 3 = insert-exotica.

### 2026-06-12 (Phase 2 — slice 10 PR 1: mail-merge)
- [x] **Orient + graph currency** — graph was already current (commit `de4f967`, 1315 nodes,
  `.graphifyignore` excludes the fork); incremental detect = 0 changed. Per-engine pre-verification
  (4-agent fan-out): fork inventory + scope decisions + PR order (mail-merge → themes → exotica → draw).
- [x] **User decision: maximal real-MS-Word fidelity** (real MERGEFIELD, not w:sdt) → saved to memory.
  Captured real Word's merge-field OOXML via PID-safe COM (`w:fldSimple`).
- [x] **Brainstorm → critique-hardened plan** (`e88bc11`, `docs/superpowers/plans/2026-06-12-phase2-slice-10-mail-merge.md`)
  — 4-reader verbatim gather + 3-critic pass (2 blockers + 3 majors folded in).
- [x] **Subagent-driven execution (6 tasks, two-stage review):** `ea02757` red `[10mm]` + `[0a]` repoint ·
  `2677ec1` fork export branch · `68d42c5` fork import (preprocessor + NodeTranslator + handler entity) ·
  `d76065c` bridge/mail.ts · `1738798` re-point + THE FLIP + leak audit · `e9e2242` review fixes
  (`_mergeResolve` preview/merge unification; immutable name read) · `550180a` oracle.
- [x] **Six gates green:** PM 285/285, legacy 257/257 (byte-identical), smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle vs Word 16:** Leg A clone→Word PASS (ROUNDTRIP_OK; Word resave preserved all 5 field codes,
  no w:sdt, no spurious «Next Record»); Leg B Word→clone PASS (automated fixture import).
- [x] **Checkpoint + PR** (this entry). **Next:** slice 10 PR 2 = themes. Computer-Use visual Mailings
  parity = optional follow-up (functional fidelity already proven via the COM oracle on the user's Word).

### 2026-06-12 (Phase 2 — slice 9: references)
- [x] **Critique-hardened plan** (`docs/superpowers/plans/2026-06-12-phase2-slice-9-references.md`)
  — fork pre-verification (the references family is already mounted + exposed via `editor.doc.*`)
  then a 3-critic adversarial pass (12 amendments: TOC `'0'` not `'??'`, footnote body via
  `getUpdatedDocs`, caption SEQ-shape, `addText`→`setOutlineLevel`, ToF raw field, citations real
  at field/source level / empty-render headless, `--legacy` has no script-gate, …).
- [x] **Red `[9]` tests + D6 repoint** (`3c08fed`) — engine-observable; both `[0a]` guards
  `tableOfContents`→`startMailMerge`.
- [x] **`bridge/references.ts`** (`b0a2194`) — 25 `ref*` verbs over `editor.doc.*` (caret→address
  via an `sdBlockId` mint; citation minted-source-id flow); +22 `[9]` coverage tests (caught + fixed
  a bibliography title→style export bug and an Add-Text wrong-namespace no-op).
- [x] **D9.1 notes area** (`37bfa2e`) — clone-owned continuous-flow `#pm-notes-area` over
  `footnotes.list()`/`footnotes.update`; focused-dirty clobber guard (proven via test).
- [x] **Re-points + THE FLIP** (`6098fa5`) — every References `H.*`/flyout/dialog → `PMA()`→bridge
  (legacy byte-identical); `references` in FLIPPED; leak audit clean; NOTICE'd Add-Text→TOC fork fix;
  Mark-Citation numeric `\c`; refAddSource flat→`b:Source` mapping; refUpdateSource wired.
- [x] **Six gates green:** PM 275/275, legacy 257/257, smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle** (`d820fea`) — extended `docx-inspect.js` + author/import probes; **Leg A clone→Word
  PASS**, **Leg B Word→clone partial** (footnotes+TOC import; SEQ/CITATION fork-importer gap recorded).
- [x] **Checkpoint + PR** — last-point/execution-map/banners advanced; ledger deviations; PR into
  `main`. *(Graph refresh DEFERRED: the raw `graphify update .` CLI pulls the excluded
  `superdoc-fork/` — 19.7k nodes; refresh via the `/graphify` skill, which honors the
  `docs/GRAPHIFY.md` exclusion, next session.)*

### 2026-06-11 (post-slice-8 bug-fix batch — page-click + styles)
- [x] **Page-margin click placed no caret** (`5c4ee25`, PR #26) — root-caused via
  `document.elementFromPoint` (margins are `#pm-editor` padding, outside `.ProseMirror`); fixed in
  `bridge/focus.ts` (clamped `posAtCoords` → nearest text + focus).
- [x] **Styles changed everything on hover** (`5cf317d`, PR #26) — engine scope already correct;
  **disabled PM-mode hover Live Preview** (`ribbon.js`) → click-only apply (selection → selection;
  caret → current paragraph). Recorded as a ledger-C decision.
- [x] **Click below the text → caret to doc END** (`86540d6`, PR #27) — `Selection.atEnd` for
  below-content clicks (Word Ctrl+End); `Selection` added to the `@/pm` barrel.
- [x] **Six gates green:** PM **241/241** (+4 regression tests), legacy 257, smoke 9/9 ×2, docx 17,
  roundtrip 27. Both PRs merged to `main`; branches deleted.

### 2026-06-11 (Slice 8 close-out — direct session; loop process retired)
- [x] **Task 6 (dialogs + proofing PM-safe, `16ebaee`):** Lock/Unlock Tracking (T3) + lock
  gate on the toggle; Track Changes Options (T18) + Advanced (T19, consumed: ins/del mark
  style+color, balloon width) + Change User Name (persisted author identity); Restrict
  Editing pane (X3 → engine `setEditable`); **Compare → real tracked-changes diff**
  (`PM.runCompare` — probe found the naive offset map off by the fork's run-node tokens;
  rewritten right-to-left with a fresh map per op); Thesaurus/Accessibility/Read-Aloud
  (per-word `::highlight`)/Language (P9)/Editor pane (P4)/Word Count (P1) re-pointed at PM.
- [x] **Task 7 THE FLIP (`34e578c`):** `review` → FLIPPED; K8 belt (legacy beforeinput
  interceptor `--legacy`-only); **D8.8 titlebar mode pill** built (cheap): Editing |
  Reviewing | Viewing, state-synced. The 4 flip-pending `[8]` pins went green.
- [x] **Six gates green:** PM **237/237** · legacy 257/257 · smoke 9/9 ×2 · docx 17/17 ·
  roundtrip 27/0.
- [x] **Parity pass:** 58/58 DOM/behavior audit (`scripts/probe-slice8-parity.js`) over the
  57-item checklist — the only finding (R2/R3 enablement greys missing) fixed via
  state-sync `wc-disabled` pokes (`060f55b`); checklist ticked 57/57.
- [x] **Oracle legs A+B PASS vs REAL Word for Windows 16.0 over COM** (no interactive
  session; computer-use access dialog timed out → pivoted to the COM oracle): Leg A
  clone→Word — ROUNDTRIP_OK, `w:ins`/`w:del`/`w:rPrChange` + comments survive Word's own
  resave (K4 resolved: the fork EMITS `w:rPrChange`); Leg B Word→clone — COM-authored
  revisions import as engine marks with the real account author; acceptAll applies Word's
  outcome. Verdicts: `notes/2026-06-11-slice8-oracle.json`.
- [x] **Loop process retired (user decision):** `docs/loop/` removed; the deferral ledger
  moved to [docs/plan/deferrals.md](deferrals.md); execution-map/banners normalized to the
  plain PR flow.
- [x] **PR #25 opened → merged to `main`;** `completion-driven-agent-loop` branch deleted
  (fully contained in the slice-8 history).

### 2026-06-11 (Completion-driven loop — Step 0: Windows replication)
- [x] **Permissions up front (ONE request flow):** Word + File Explorer + Electron (clone)
  at full tier + clipboardRead/Write + systemKeyCombos — no mid-loop prompts remain.
- [x] **Toolchain:** npm install + build; npm `/tmp` probe aliases verified working AS-IS
  (`C:\tmp` exists).
- [x] **Six gates green on Windows:** legacy 257/257 · PM 206/206 · smoke 9/9 ×2 · docx 17/17
  · roundtrip 27/0.
- [x] **`[1]` Mod-Z test platform fix** — was Mac-vacuous (Mod-z = Meta-z there); probe-driven
  root-cause (defaultPrevented + sdBlockRev evidence); critique caught the first rewrite as a
  weakening; final form spies `WC.PM.cmd` (the app.js path) + doc-equality-modulo-sdBlockRev.
- [x] **Windows COM oracle port** (`word-oracle-win.ps1`): 5 verbs live-validated vs Word 16.0;
  critique-hardened (20 findings: exit-2 validation, kill-time PID re-verify, --out splice,
  LiteralPath, $PWD resolution, UTF-8 stdout, vocabulary parity incl. underlineRaw "false").
- [x] **COM runtime rules discovered + documented:** unsandboxed-only (DCOM hang), FOREGROUND-only
  (backgrounded shells wedge in SaveAs2 — OneDrive exonerated), machine-global DocumentN,
  per-instance OM attach for orphan recovery. README Windows section written.
- [x] **Fixtures re-authored on real Windows Word** (`author-fixtures-win.ps1` committed;
  docx-inspect-verified identical shapes) — unblocked `test:roundtrip` on this machine;
  `capture-popups.ps1` committed for slice spec-captures.
- [x] **Checkpoint + commits + push** on `completion-driven-agent-loop`; next iteration = slice 8.

### 2026-06-10/11 (Phase 2 — slice 7)
- [x] Post-merge routine: PR #23 merge verified (`6ca5679`); gates re-verified ON `main`
  (PM 192/192 after an idle re-run — 5 initial fails were load-flake from concurrent agents);
  CLAUDE/AGENTS/plan banners advanced (`343387f`); branch cut.
- [x] Slice-7 **brainstorm-lite** — file-io inventory verified against real code (3-agent sweep +
  author verification). Keys: the fork constructor takes `options.html` in docx mode
  (`createDocFromHTML` composes with the blank-template converter context); legacy opened csv as
  a BLANK doc (csv-as-table = net-new, user-directed); `stripHtmlStyles` = semantic import;
  `getHTML({unflattenLists})` + `textBetween`; docx-inspect is CLI-only.
- [x] Slice-7 **plan** written + 4-critic-hardened (31 findings; 4 unique blockers incl. the
  wrong-paste-pipeline aim and the `[7]` confirmDiscard suite hang) + author pre-verification
  (caught the contextBridge spy non-writability independently) + committed (`a50bfc4`, `964b395`).
- [x] Slice-7 **red `[7]` tests** (13) + `[0b]` rewrites + `[4]` leak pin (`860d753`) — review
  caught the DOM-vs-model pin defect + a red-stage modal hang; 205/192/13.
- [x] Slice-7 **`test:roundtrip` lands FIRST** (`1384831`) — driver+probe, 27 checks, six-gate
  docs + spec §8.1 dated amendment; review hardened stale-artifact deletion + negation pin.
- [x] Slice-7 **IPC** (`f6572dc`) — openBytes filters + `doc:saveTextFile` + `doc:askSavePath`
  (htm→html normalize; extensionless append + GTK overwrite guard).
- [x] Slice-7 **bridge legs** (`cbecba8`) — file-content.ts, `extra.html`+`onContentError`
  threading, contentError blank-recovery, `openHtml/openText/openCsv/pasteHTMLString`,
  io `getHTML`/`getText` (both break leaves); probe-verified html→table→exportDocx BEFORE the
  suite; review fixed the `Math.max` spread + comment contracts.
- [x] Slice-7 **THE FLIP** (`f545429`) — files.js blocks removed; open routing; save legs;
  two-phase saveAs; mode-aware backstage copy; `saveAsBytes` removed; review closed the
  `lastImportBlanked` data-loss vector (+ csv-name, toasts, escapeHtml reuse). 206/205/1.
- [x] Slice-7 **leak fix** (`ae92a36`) — repro confirmed all three forms; fork `handleDocxPaste`
  tag-early/remove-late strip + style-deref guard (NOTICE'd); spec review adjudicated the
  divergence as strictly better (early strip would regress list starts). **PM 206/206.**
- [x] **All six gates green: PM 206/206, legacy 257/257, smoke 9/9 ×2, docx 17/17,
  roundtrip 27/0.**
- [x] Slice-7 **oracle legs A–D** (`73fdd22`) — driven via word-oracle.js + **computer-use MCP**
  (first slice; Grant-File-Access prompt cleared interactively): A docx round-trip PASS (no
  repair; structural identity; slice-6 recheck CLOSED), B html PASS (semantic deviations
  recorded), C csv deviation evidence (real Word = raw delimited text), D txt PASS.
- [x] Slice-7 **docs scoping** (`5e9a3cb`) + checkpoint; **PR #24 next**.

### 2026-06-10 (Phase 2)
- [x] Slice-6 **Word UI Codex probe partially captured** via `.oracle-probes/slice6/CODEX-PROMPT.md`
  — screenshots saved for `A1`, `A2-grid`, `A3-dialog`/`A3-menu`, `A4`, and `B-design`; transcript
  appended to `.oracle-probes/slice6/results.md`. Remaining UI-Codex steps carry because Word kept
  snapping focus among existing unsaved windows after modal close/screenshot events.
- [x] Slice-6 **brainstorm-lite** — confirmed the insert entry-point inventory against real code (6-agent inventory workflow). Key findings: fork ships all insert-primitive + core table commands; **legacy app has NO Table Tools ribbon tab** (table editing was a 9-item right-click menu) → full Table Tools = net-new; equation has no fork `insertMath` (→ styled text); contextual tabs are runtime-injected. User scope decisions: **full Table Tools** + styled-text equation + exotica carve-out + UI-Codex when needed.
- [x] Slice-6 **plan** written + 3-critic-hardened + author-pre-verified + committed (`eb23de9`) — 4 blockers + 6 majors (the two biggest — contextual-tab `{cmd,label,type}` dispatch not `onClick`; ribbon single-tab limit — caught by pre-verification after a critic wrongly cleared them).
- [x] Slice-6 **red `[6]` tests** (19) + D6 repoint `link`→`newComment`, `table`→`tableOfContents` (`20a4fc3`); **docx-inspect** unzip helper (`f8e76e3`).
- [x] Slice-6 **bridge insert.ts** (`b40f36b`) + **bridge table.ts** 6a (`5feefb9`) — insert primitives + table insertion + the 9 ops; review caught a `__PM_TextSelection` global regression + the equation `false`-contract.
- [x] Slice-6 **entry-point rewrites** (`6c0d81b`) — PM branches in commands/dialogs/insert-features + the M2 PM bookmark dialog; legacy byte-identical.
- [x] Slice-6 **THE FLIP** (`d2b3ffb`) — `FLIPPED += insert-basics` + exotica carve-out (machine-verified leak-free) + `Ctrl+K` guard + B2 `WC.Table` guard. 149/149.
- [x] Slice-6 **14 fork table commands** (`752e0e1`) — style/align/indent/size/margins/borders/distribute/split/convert/text-direction/autofit; review found + fixed a **silent export data-loss bug** (top-level attr never reached the nested key the exporter reads) → dual-write + `[6b] EXPORT:` document.xml-grep regression tests.
- [x] Slice-6 **bridge table extras** (`d4074d7`) — the 14 wrapper verbs + `tableSelectFirstRowPair` + B3 merge test.
- [x] Slice-6 **contextual tabs + PM context menu** (`e2840f3`) — Table Layout/Design tabs (runtime `{cmd,label,type}` + new `H.tbl*` handlers + dropdown flyouts), `ribbon.js` multi-tab extension (Header & Footer byte-identical, 257 green), PM `td/th`-scoped context menu (native selection preserved).
- [x] Slice-6 **headless leg-A oracle** (`366aa66`) — clone-exported `.docx` validated via `docx-inspect`: hyperlink rel → `https://example.com`, table 3×4, image embedded in `word/media`, bookmark paired start+end. **All four PASS.**
- [x] **All five gates green: PM 176/176, legacy 257/257, smoke 9/9 ×2, docx 17/17.** Build complete; checkpoint this entry; PR + Word-dependent oracle legs + UI Codex next.
- [x] Slice-6 **Word oracle legs** (`0bd3773`) — leg A reopen-in-Word PASS (no repair prompt); leg C styled-table PARTIAL (`w:tblStyle` dropped → fixed below); leg B blocked (Word session quirks). **PR #23 opened**; banners advanced.
- [x] Slice-6 **table-defect fix batch** (user report → 4-agent hunt: live-repro/code-audit/Word-fidelity/minting-research → 6 reviewed fixes): `fdcb7f6` passive contextual tabs + 'Layout' label; `72b270f` Center/Right alignment geometry fix; `dd56a1a` caret-shading parity + AutoFit-Fixed; `61d84d9` **table styles end-to-end** (minted real-Word defs + visual bake + dynamic gallery); `474291f` direct-border precedence; `a23c868` 27 Fluent icons.
- [x] Slice-6 **"big box" fix** (`d6a07e4`, user re-report) — fresh AND imported tables never painted cell gridlines (invalid `border-insideH/V` CSS, silently dropped); render-only inside-border CSS vars + interior-edge rules; export purity proven. **Final gates: PM 192/192, legacy 257/257, smoke 9/9 ×2, docx 17/17.**

### 2026-06-09 (Phase 2)
- [x] Slice-5 **brainstorm-lite** — confirmed the find/replace entry-point inventory against real code (`H.find`/`H.replace`→`D.findPane`; the legacy `.find-hit` TreeWalker; the fork **already ships** a decoration-based Search extension; ribbon `find` split + `replace` button; app.js Ctrl+F/H). User scope decision: **maximum** (Match Case + Whole Words + Wildcards + Advanced Find + all three Find-dropdown items).
- [x] Slice-5 **plan** written + 3-critic-hardened + committed (`c3f7fb2`) — 3 blockers pre-build (unnamed Search ext → `extensionStorage.search` undefined; bare Ctrl+F/H bypassing D6; `goToDialog` not exported) + 4 majors; one critic "blocker" (missing `.sd-editor-scoped`) refuted by direct verification.
- [x] Slice-5 **red `[5]` tests** (18) + D6 repoint `replace`→`link`, `find`→`table` (`7262ea7`, `4485dc3`).
- [x] Slice-5 **fork work**: `name:'search'` + whole-word + Word-wildcards, threaded through setSearchSession/invalidator/replaceSearchMatch (`0343330`, NOTICE'd).
- [x] Slice-5 **bridge** find/replace surface (`0fe1e60`) + one-undo `norm()` test fix (`375e12b`).
- [x] Slice-5 **entry points**: find pane re-point + options row + `D.goToDialog` (`43e3f78`).
- [x] Slice-5 **THE FLIP** + Ctrl+F/H/edit re-points (`f768175`) — 129/0 first run, zero triage.
- [x] Slice-5 **oracle**: Codex computer-use semantics probes (all match Word) → **wildcard case-sensitivity fix** (`1186532`, 130/0); verdicts (`8a9b9ef`); **legs A/B PASS** (`2fb33e3`).
- [x] **All five gates green: PM 130/130, legacy 257/257, smoke 9/9 ×2, docx 17/17.** Checkpoint + PR next.

### 2026-06-08 (Phase 2)
- [x] Slice-4 **plan** written + 4-critic-hardened + committed (`37b03fd`) — `docs/superpowers/plans/2026-06-07-phase2-slice-4-clipboard.md` (32 findings, 8 confirmed blockers applied: painter double-click trap, two never-green tests, async flyout/dialog races).
- [x] Slice-4 **red `[4]` tests** (16) + D6 run-block repoint cut→replace (`23c9062`, `6031cc2`).
- [x] Slice-4 **clipboard IPC** — `wordAPI.clipboard.*` + webContents edit triggers (`579c5a0`, `281a08e`).
- [x] Slice-4 **oracle probes** — clipboard flavors + Paste Special lists + 9-probe painter matrix vs Word 16.77.1; Step 2.1 scripted, UI-only probes via Codex computer-use → `.oracle-probes/slice4/` (`d5d1002`).
- [x] Slice-4 **fork painter Word scope** — para props + first-run marks, replace-not-merge, link-preserving, cancel cmd, double-click-trap fix (`5793f6e`); resolved→direct marks fix (`e434dfd`).
- [x] Slice-4 **bridge** — clipboard surface + select + painter arm/cancel + Esc layering (`dc70b2e`, `7f9e010`); gitignore `.agents/` (`1bc5ce5`).
- [x] Slice-4 **entry points** — handlers, pasteMenu, `D.pasteSpecial` dialog, selectMenu, flyItem disabled (`5a27de3`, `2f8f891`).
- [x] Slice-4 **state-sync painter chrome** — button latch + copy cursor (`34c1633`).
- [x] Slice-4 **THE FLIP** + Cmd+Shift+C/V chords (`ac98db2`, `0746464`) — 112/0, one triage (sdBlockRev normalization).
- [x] Slice-4 **oracle legs A/B** + Task-9 manual sanity (`3858b64`) — leg A clone→Word PASS (full list fidelity), leg B core PASS + recorded list-marker leak (ship-and-track, user-approved); five gates green; physical Cmd+C/V both directions confirmed.
- [x] Slice-4 **PR #21** merged to `main` (from GitHub, `696b84b`); gates re-verified on `main` (PM 112/112, legacy 257/257, docx 17/17); CLAUDE/AGENTS/plan banners advanced to slices-0a–4 / slice-5-next.

### 2026-06-07 (Phase 2)
- [x] Slice-3 **plan** written + 4-critic-hardened + committed (`a90ce67`) — `docs/superpowers/plans/2026-06-06-phase2-slice-3-styles.md` (4 blockers caught pre-build: setState restore channel, Ctrl+Shift+N shadow, linked-char selection trap, negation-fixture context leak).
- [x] Slice-3 **red tests** (20 `[3]` + cellFor + 4 engine pins) (`1885d1d`, `6ec4e56`).
- [x] Slice-3 **fork work**: heading keymap strip (`3b5d276`), minted style defaults (`ebaac6f`, `4800ce4`, SubtleEmphasis live-Word amendment `7c2f314`), TableInfo+tblLook fix (`8c5e672`, `fcba36a`).
- [x] Slice-3 **bridge**: style-names/resolved-read/applyStyleByName (`131e1d3`), st.block + caret highlight (`c07d0b6`), PM-native hover preview (`d83b29ec`).
- [x] Slice-3 **entry points**: applyStyle + pane (`1b4fdfd` +review fixes), Change-List-Level resolved read (`3ab3f32` — slice-2 deviation closed).
- [x] Slice-3 **THE FLIP** (`af7c559`) — 96/96 first run, zero triage; all five gates green; final-review polish (`dceafa1`).
- [x] **Oracle**: slice-2 followUps CLOSED (lists family PASS incl. the U+25AA discovery; literal roundtrip PASS); `read-style-props` verb + quirks #24-27 (`9951073`); behavior verdicts (re-apply=APPLY; clearing=full-coverage-only) (`b54bd69`); slice-3 legs A 5/5 + B 9/9 + table spot-check (`0e8134b`).
- [x] Slice-3 **PR #19** merged to `main` (clean, no conflicts); gates re-verified on `main` (PM 96/96, legacy 257/257); branch deleted local+remote; CLAUDE/AGENTS banners advanced.

### 2026-06-05 (Phase 2)
- [x] Phase 2 **spec** written + committed (`d68c187`) — `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`.
- [x] Phase 2 **implementation plan** written + committed (`75e2d89`) — `docs/superpowers/plans/2026-06-05-phase2-slices-0a-1.md`.
- [x] Slice 0a **`--legacy` boot flag** (`870e01a`) — forwarded to renderer as `?legacy=1`.
- [x] Slice 0a **PM functional suite skeleton + `test:*` aliases** (`210f13f`) — 21 tests scaffolded.
- [x] Slice 0a **page flip + WC.PM bridge core** (`a30f11c`) — `#pm-editor` is the visible page; bridge commands/io/state-sync/focus.
- [x] Slice 0a **failBridge hardening** (`7c25a79`) — pre-init focus guard; un-swallow first blocked toast.
- [x] Slice 0a **D6 integrity guard** (`cf68b84`) — legacy mutations blocked in PM mode at the chokepoints.
- [x] Slice 0a **D6 Save block + audit doc** (`1ccc507`) — PM-mode Save/Open blocked until 0b.
- [x] Slice 0a **D6 courtesy block** (`9c6cad7`) — unflipped commands toast at dispatch; shortcuts D6-aware.
- [x] Slice 0a **PM state-sync** (`e033fe1`) — engine events drive toggles, combos, statusbar; caret-tracking font/size combos.
- [x] Slice 0a **state-sync fixes** (`ab76c5f`) — list toggle guard; size parse tighten.
- [x] Slice 0a **focus discipline** (`23f1251`) — chrome clicks never blur PM view.
- [x] Slice 0a **scrollbar drag fix** (`49e5e86`) — scrollbar dragging alive inside focus-guarded containers.
- [x] Slice 0a **dirty re-point** (`e4ea0bf`) — dirty-state readers mode-aware (PM edits trigger save prompts).
- [x] Slice 0a **visible-page re-points** (`571b1e3`, `e41fb67`) — showHide/readMode/wordCount/properties follow active engine; paragraph-count selectors aligned.
- [x] **All gates green: legacy 257/257, PM 21/21, smoke 9/9 × 2, docx 17/17.**
- [x] **Slice 0b** — file-IO bytes layer (PM-mode open/save via the fork's OOXML converter). DONE: bytes IPC channels, parse-once replaceEditor + failBridge recovery + replace mutex, blank fixture, Files.path invariant enforced + tested. Gates: PM 28/28, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- [x] **Slice 0c** — oracle harness for PM mode. DONE: `scripts/oracle/word-oracle.js` (read-props + roundtrip; object-model only; PID-safe; leak-proof read-props, best-effort roundtrip close). Verified vs Word for Mac 16.77.1; 13+ quirks documented. Commits: `48f55e5`, `cd68993`, `06a10f7`.
- [x] **Slice 1** — character formatting (bold/italic/underline/strike/sub/sup/font/size/grow-shrink/color/highlight/clearFormatting/changeCase + Font dialog + QAT undo/redo → PM transactions; area `character` FLIPPED). Oracle validation (spec §8.3) both legs + negation-run fixture vs Word 16.77.1 — ALL PASS; caught + fixed a boolean-negation state-sync bug and a PM-harness string-return hole; new `read-word-props` oracle verb. Gates: **PM 43/43**, legacy 257/257, smoke 9/9 × 2, docx 17/17. Branch `feature/phase-2-slice-1-character`, PR stacked on slice 0c.
- [x] **Slice 2** — paragraph + lists. DONE 2026-06-06 (`feature/phase-2-slice-2-paragraph`): align ×4, list-aware indent, Layout spinners (+caret readback), line-spacing (+dynamic labels), shading (new fork render), borders, sort, bullets/numbering (+glyph-honoring libraries), Word-native multilevel (`applyListDefinition`/`changeListLevelBy` fork cmds), Paragraph dialog (seeds + one-undo apply), Ctrl+L/E/R/J + Ctrl+Shift+L; hanging-indent gap closed (fork CSS shipped); oracle `read-para-props` verb + validation legs A/B (2 reads pending Word relaunch). Gates: PM 76/76, legacy 257, smoke 9/9 × 2, docx 17. show-marks verified already-done (slice-0a parity).

### 2026-06-06 (Phase 2)
- [x] Slice-2 **plan** written + critique-hardened + committed (`a81508f`) — `docs/superpowers/plans/2026-06-06-phase2-slice-2-paragraph-lists.md`.
- [x] Slice-2 **red tests** (33 `[2]` + helpers + D6 repoint) (`9e6fa78`, `b9958a2`).
- [x] Slice-2 **oracle verb** `read-para-props` + quirks #16-21 (`aabc710`, `e04bf45`).
- [x] Slice-2 **fork work**: shading render + keymap strip (`45d5017`), `applyListDefinition`+`changeListLevelBy` (`5cf1f2d`), element CSS into the build (`bda0278`).
- [x] Slice-2 **entry-point rewrites**: para handlers (`1e64d82`), lists menus (`35fd50d`), shading/borders/sort (`152634b`), state-sync (`453a180`), Paragraph dialog (`931a2f0`).
- [x] Slice-2 **THE FLIP** (`8d8e14f`) — 76/76 first run, zero triage; all five gates green.
- [x] Slice-2 **evidence**: round-trip (`3e1a186`), oracle legs A/B JSONs (`882ea7e`), quirks #22-23 (`86ada55`).
- [x] Slice-2 **PR #17** merged to `main` (conflict round vs PR #16 resolved in `fdef0e3`); gates re-verified on `main` (PM 76/76, legacy 257/257); branch deleted local+remote; CLAUDE/AGENTS banners advanced.
- [x] 5-min **oracle follow-up** after a Word relaunch (two pending reads — commands in the oracleA-lists JSON `followUp` fields). *(Closed 2026-06-07 in the slice-3 oracle session — all rows PASS.)*

### 2026-06-05 (Phase 1 wrap-up)
- [x] Phase 1 **Stage D** — final review = READY TO INTEGRATE; hardened the smoke Tab test (`8de524e`).
- [x] Docs follow-up: harness now needs `npm run build` first; counts 257/17 (`e5db257`).
- [x] Fixed `npm run dev` crash (`Cannot find module './docx-utils'`) — copy via electron-vite `closeBundle` plugin, dev+build, cross-platform (`93e5006`).
- [x] Infra + visual sanity pass: dev/build/built-launch all run; chrome = faithful Word; new core renders the imported `.docx` (lists/numbering) on a Letter page.
- [x] Plan-doc checkpoints; **Phase 1 COMPLETE**; branch `build/phase-1-scaffold` pushed for integration.
- [x] **Phase 2** — started this session (integrated Phase 1 → slice 0a built on `feature/phase-2-editing-core`).

### 2026-06-04
- [x] Merged `research-architecture` → `main` (PR #8).
- [x] Made "never work on `main` — branch first" an explicit rule (plan.md + execution-map.md).
- [x] Restructured last-point.md + execution-map.md into dated logs; updated the `plan-tracking` skill.
- [x] Wrote + committed the Phase 1 spec + implementation plan (`docs/superpowers/`), hardened by 4 workflows.
- [x] Phase 1 **Stage A** — electron-vite + TS build chain; legacy app static under `public/`; gates green.
- [x] Phase 1 **Stage B** — npm-pin + PM single-copy; headless import + fixture; mounted our EditorView; smoke 8/8.
- [x] Phase 1 **Stage C / Option B** — vendored + own the SuperDoc engine (editable source, no npm dep, telemetry no-op, Path B view, Tab/indent); smoke 9/9, functional 257, docx 17.
- [ ] Phase 1 **Stage D** — final review + integrate (PR/merge) + docs follow-up (carries to next session if not finished today).

### 2026-06-03
- [x] Locked ADR-0001…0005; de-risk spike GREEN.
- [x] Created docs/decisions, docs/architecture, docs/research, docs/plan; the `plan-tracking` skill.
- [x] CLAUDE.md / AGENTS.md banners; pushed the `research-architecture` branch.

## At session END (always)
Invoke the **`plan-tracking`** skill: (1) **append** a new dated entry to
[last-point.md](last-point.md) (top); (2) **tick** the Daily work log above (start a new
`### <date>` block if it's a new day); (3) if the phase advanced, update the **CURRENT PHASE**
section.
