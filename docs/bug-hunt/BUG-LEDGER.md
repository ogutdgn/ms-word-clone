# ms-word-clone — Bug-Hunt Ledger

> **⚠️ Validation currency (read first).** The campaign was run against `main @ 621da99`. `main` has since advanced to
> `98fe04e` (~130 commits — the other agent implemented Page Setup export, Header/Footer text, +750 lines of tests).
> **Re-validated 2026-06-17 against `98fe04e`:** BUG-014/015/016/005 re-reproduced; BUG-001/002/003 + all bugs in unchanged
> files remain valid (their files are untouched). **GAP-A corrected** (Margins/Orientation/Size/Header/Footer now unblocked;
> 15→10 blocked). **Still needs a refresh pass:** the handful of bugs in files the other agent touched since 621da99
> (`commands.js` line refs, `design.ts` → BUG-011/024, `insert.ts` → BUG-012) and a correctness pass on the 5 newly-wired features.

## Current-main re-validation (re-ran on `5f71cfa`, 2026-06-17)
**Confirmed STILL real on current main (probes re-executed):** BUG-014 (font-size clamp), BUG-015 (highlight→shd),
BUG-016 (convert-table dead toast over a working bridge), BUG-005 (restrict read-only LEAK) — all re-reproduced.
BUG-011 re-confirmed via Word `read-word-props`: theme'd heading still renders **Aptos Display 20pt, not Garamond**.
BUG-012 re-confirmed: `#MyBookmark` still exports as a broken external rel. BUG-001/002/003 + all bugs in untouched
files remain valid.

**NEW — BUG-026 [S3] Page Setup (orientation/size) updates export + pagination but NOT the visual page (render gap).**
The just-implemented Page Setup exports a **correct `sectPr`** (margins `720`; landscape `pgSz 15840×12240 orient=landscape`;
A4 `11909×16834`) AND updates pagination `pageH` (1056→816), but the **on-screen sheet stays portrait** (`--page-w/--page-h`
CSS vars not updated) → landscape renders as a portrait sheet and Page-Width zoom over-zooms to 170% on the stale portrait
width. Export/round-trip faithful; render-only (keystone render-tier). Evidence: `pagesetup-test.json` (`ORIENTATION.before==after` vars)
+ `pagesetup-landscape.png`. Source: `bridge/design.ts:262 dePageSize` writes sectPr/geometry; the `--page-w/--page-h` paint isn't driven from it.

**Newly-wired features re-validated (the other agent's recent PRs):**
- **Header/Footer text (PR #130) — CLEAN.** `setHeaderText/setFooterText/getHeaderText/getFooterText` work; exports
  `w:headerReference`/`w:footerReference` + `header1.xml`/`footer1.xml`; **round-trips** (`getHeaderText` after `openDocx` =
  the set text). (A double-export probe sequence once read empty — a probe artifact, not a user flow.) ✓
- **Picture Grayscale (PR #128) — CLEAN.** `setImageGrayscale(true)` → CSS `grayscale(1)` render + `<a:grayscl/>` export +
  survives round-trip + clears on No-Recolor. ✓
- **Page Setup (PR #126) — export ✓ / render ✗ = BUG-026** (above).

**Legacy bug RESOLVED in PM (re-checked):** "Page Color erases Watermark" → FIXED (watermark survives the page color;
`design.ts deWatermark` uses the `backgroundColor` longhand, not the `background` shorthand). ✓

---

Campaign: systematic, Word-parity bug discovery (discovery-only — **no source fixes** while a
second agent develops in the shared repo). Findings are evidenced (clone repro + Word COM oracle +
screenshot) and severity-rated for a later fix pass.

## Rig & isolation
- **Isolated worktree** pinned to clean `main` so we never touch the other agent's WIP and never test
  their half-built code: `C:\Users\ogutd\bughunt-wt` (detached @ `621da99`; `node_modules` junctioned
  from the main checkout). Rebuild from clean main as needed; the other agent's working tree is untouched.
- **Evidence loop (proven):** probe drives the real editor headlessly →
  `npx electron . --shot-evalfile=<probe.js> --probe-out=<json> [--shot=<png>]` (a single run yields
  model/OOXML JSON *and* a screenshot) → save `.docx` via `window.wordAPI.saveBytes` → Word COM oracle
  `scripts\oracle\word-oracle-win.ps1 <verb> <docx> --out <json>` (run unsandboxed; PID-safe).
- Evidence artifacts live in `C:\tmp\bughunt\` (probes/, *.json, *.png).

## Severity scale
- **S1** crash / data-loss / doc-corruption (Word refuses to open, content lost).
- **S2** major wrong behavior or export corruption (feature does the wrong thing; round-trip drops/garbles).
- **S3** fidelity / visual deviation from Word (renders or measures wrong, but content survives).
- **S4** minor / cosmetic.
- **S5** confirmed-as-expected (known deferral verified; logged so we don't re-chase).

## Method note (why some "bugs" are not bugs)
The headless harness has gotchas that can masquerade as bugs (e.g. a page break is an **inline
`hardBreak[pageBreakType='page']`** invisible to a top-level/text-only scan; pagination needs
`PM().__pagination.pageCount` *polled* for the rAF measure). Every candidate is re-checked against the
proven test-suite helpers before logging.

---

## Verified CLEAN (do not re-investigate)
- **Bold round-trips faithfully** — clone export → Word reads `bold=true`, Aptos 12, left. ✓
- **Paragraph borders export correctly** — `<w:pBdr>` with proper per-edge children (`single/auto/sz4/space1`);
  also exports on an **empty** paragraph. ✓
- **Manual page break export is Word-faithful** — inline `<w:r><w:br w:type="page"/></w:r>`; a trailing
  Ctrl+Enter stays **inside the same paragraph** (Word's `read-layout` shows `"…line\f"`, 1 paragraph) and
  Word + clone **agree the doc is 2 pages**. ✓
- **Blank page (two breaks) → +2 pages**, two gap-bands. ✓
- **Bullets / Numbering / Multilevel are Word-faithful** — oracle read-para-props: bullet `listString`
  `•`/`◦`/`▪` per level, `leftIndent` 36/72/108 pt, hanging 18 pt (matches Word defaults exactly); numbering
  increments `1./2./3.`; **numbering continues across page overflow** (55-item list → item 55 = `55.` on page 3).
  (The boot doc's `-` bullets are that seed doc's own numbering def, not a render bug.) ✓
- **Font character formatting all exports to correct OOXML** — bold/italic, `w:u single`, `w:strike`,
  `w:vertAlign super/subscript`, `w:color FF0000`, `w:highlight yellow` (Word's *named* highlight, not a hex
  hack), `w:sz 40`=20pt, `w:rFonts "Courier New"`, `w:spacing 40`=2pt character spacing. ✓
- **Paragraph shading exports correct `w:shd`** (`val=clear color=auto fill=FFFF00`). ✓
- **Clear All Formatting** strips run marks **and** paragraph borders/shading (paraProps → `{}`), matching
  Word's "reset to Normal." ✓

---

## BUG-001 — [S3] Box-bordered paragraph spanning a page boundary renders a page-tall empty border box
- **Area:** Home → Paragraph → Borders, × pagination (manual break *or* auto page overflow).
- **Repro (clone):**
  1. Type a paragraph, apply **All Borders** (or any box border).
  2. Put the caret in the middle of that paragraph and press **Ctrl+Enter** (manual page break), *or* make
     the paragraph long enough to overflow onto the next page.
  - Probe: `C:\tmp\bughunt\probes\borders-visual.js`; screenshot `C:\tmp\bughunt\borders-visual.png`.
- **Expected (Word):** the border box **closes under the last line on page 1** and **reopens** around the
  continuation at the top of page 2. (Adjacent identical-border paragraphs correctly merge into one box —
  that part the clone does right.)
- **Actual (clone):** the bordered `<p>` contains the page-break **inline spacer**, so the CSS border wraps
  the spacer's full height → the box balloons into a **page-tall empty rectangle** down to the bottom of
  page 1; no reopen on page 2.
- **Evidence:** screenshot shows the giant empty box; model probe `home-borders2.json` S5 = `seams:0, bands:1`
  (band rendered *inline* inside the bordered paragraph). Export OOXML is correct; this is a **render-only** bug.
- **Suspected source / root cause:** the known **block-in-inline spacer** (`docs/plan/deferrals.md §A.1b`,
  pagination.ts in-`<p>` spacer) — the same root cause behind the mid-paragraph caret-misland. This is a NEW,
  screenshot-documented *manifestation* (borders, and by extension paragraph shading, balloon across the seam).
  Converges on the unbuilt frames-overlay keystone.
- **Status:** logged (discovery-only). Not a quick point-fix — gated on the frames-overlay rework.

## BUG-002 — [S3] Paragraph shading balloons to fill the rest of the page across a page break
- **Area:** Home → Paragraph → Shading, × pagination (manual break *or* auto page overflow).
- **Repro (clone):** shade a paragraph (any fill), put the caret mid-paragraph, press **Ctrl+Enter**
  (or let a shaded paragraph overflow the page). Probe `C:\tmp\bughunt\probes\home-misc.js`;
  screenshot `C:\tmp\bughunt\home-misc-shade-break.png`.
- **Expected (Word):** the shading fill covers only the text line(s) of the paragraph; on page 1 it ends
  under the last shaded line, and resumes around the continuation on page 2.
- **Actual (clone):** the fill **floods the entire remainder of page 1** — a full-width yellow rectangle
  from the text down to the bottom margin — because the page-break inline spacer lives *inside* the shaded
  `<p>` and inherits the background. Even more visually severe than BUG-001.
- **Evidence:** screenshot (giant yellow block); `home-misc.json` `shadeAcrossBreak.pageCount=2`; shading
  OOXML export itself is correct (`w:shd`), so this is **render-only**.
- **Suspected source / root cause:** same **block-in-inline spacer** as BUG-001 (`deferrals §A.1b`). Confirms
  the root cause is general: **any block-level paragraph decoration (border, shading, and presumably a future
  paragraph background/box) balloons across a page seam.** One fix (frames-overlay) resolves the whole class.
- **Status:** logged (discovery-only). Same keystone dependency as BUG-001.

## BUG-003 — [S3] Image taller than the page bleeds across the page boundary (no clip / no seam)
- **Area:** Insert → Pictures, × pagination (over-tall inline image).
- **Repro (clone):** insert an inline image taller than the content area (~1100px > 864px content height).
  Probe `C:\tmp\bughunt\probes\img-pagination.js`; screenshot `C:\tmp\bughunt\img-tall.png`.
- **Expected (Word):** Word does not split an image; the too-tall image is clipped at the page bottom and
  does not continue across the inter-page gap.
- **Actual (clone):** the image paints continuously from the top of page 1 **down across the page seam**
  (img bottom y1215 vs seam y1070, 256px past the page-1 content bottom) and into the gray gap — no clip,
  no clean page boundary. `pageCount` counts 2 but the object is unsplittable so it just overflows.
- **Evidence:** screenshot; `img-pagination.json` `IMG_TALL` (top 115 → bottom 1215, seam 1070).
- **Suspected source / root cause:** the **over-tall single block** gap (`deferrals §A.1b/§A.1e`) — same
  frames-overlay keystone as BUG-001/002; pagination can't split or clip a block taller than a page.
- **Status:** logged (discovery-only).

### Keystone cluster note
BUG-001 (border), BUG-002 (shading), BUG-003 (tall image), and the **already-recorded table-taller-than-a-page
overflow** (`deferrals §A.1e`: middle rows paint into the gray gap) are all the **same root cause** — the
unbuilt frames-overlay / paged-layout engine that cannot split, clip, or reopen a block across a page seam.
One fix resolves the whole cluster. Logged together so the fix pass treats them as one keystone, not four bugs.

## Verified CLEAN (pagination, cont.)
- **Inline image at a page boundary does NOT straddle** — a 240px image near the bottom of a full page
  correctly moves to the next page (no seam straddle). ✓ (`img-pagination.json` `IMG_BOUNDARY`)

---

## BUG-004 — [S3] Paragraph shading is mis-imported as a spurious run highlight on round-trip
- **Area:** File I/O round-trip (docx importer) × Home shading. **Root cause: importer, NOT the layout keystone.**
- **Repro (clone):** shade a paragraph (`w:shd fill=FFFF00`), `exportDocxBytes()` → `openDocx(bytes)` (save+reopen).
  Probes `C:\tmp\bughunt\probes\roundtrip-stability.js` + `highlight-locate.js`.
- **Expected (Word):** a shaded paragraph round-trips as paragraph shading only (`w:shd`); its text gets **no**
  run highlight.
- **Actual (clone):** after reimport the paragraph's **text gains a run highlight (`w:highlight`) matching the
  shading fill** — `FFFF00`-shaded para → yellow highlight; `92D050`-shaded para → green highlight — *in addition*
  to keeping the `w:shd`. Confirmed across two fill colors. Highlight count 1→2 on a mixed doc; in isolation a
  pure highlight round-trips perfectly (1→1→1), so the trigger is specifically **w:shd on import**.
- **Evidence:** `highlight-locate.json` — `before.hlRuns=[formatted]`; `after.hlRuns` adds the two shaded
  paragraphs' text with highlight = their fill; `hlContexts[1]` shows a `<w:pPr><w:shd .../></w:pPr>` paragraph
  whose run now carries `<w:highlight w:val="yellow"/>`.
- **Suspected source:** the docx importer's shd handling (super-converter v2/v3 importer) bleeds paragraph
  `w:shd` fill onto a run highlight mark. Visible formatting change; persists/compounds on every save+reopen.
- **Status:** logged (discovery-only). Importer fix — independent of the layout keystone (a genuinely
  different bug class). Worth escalating to S2 if the highlight visibly alters shaded docs in normal use.

## BUG-005 — [S2] Restrict Editing "read only" does not block programmatic / ribbon writes (protection bypass)
- **Area:** Review → Restrict Editing (read-only protection). Spec REV-01.
- **Repro (clone):** `ed().setEditable(false,false)` (what the restrict pane's read-only Start does) → then
  `WC.Commands.run({cmd:'bold'})`, a raw `tr.insertText`, and `PM().cmd('addComment',…)`.
  Probe `C:\tmp\bughunt\probes\spec-batch1.js` → `REV01_restrictLeak`.
- **Expected (Word):** read-only protection blocks ALL edits — ribbon formatting, typing, and comments.
- **Actual (clone):** with `view.editable===false`, **Bold applied, text inserted (doc size 28→37), and a comment
  was added** — `verdict: LEAK`. `setEditable(false)` only flips the ProseMirror `editable` prop (gates DOM
  contentEditable / keyboard), but the `WC.PM` bridge command surface (`bridge/commands.ts`, `create-editor.ts`)
  has **no editable check**, so every ribbon `H[cmd]` and `PM.cmd` mutates the doc via `view.dispatch` regardless.
- **Evidence:** `spec-batch1.json` `REV01_restrictLeak` = `{editableProp:false, boldAppliedWhileProtected:true,
  insertLeaked:true, commentAddedWhileProtected:true, verdict:"LEAK"}`. Code: `Editor.setEditable` (Editor.ts:2291)
  gates only the prop; no editable guard in the bridge dispatch (per spec agent's grep).
- **Suspected source:** missing editable/protection guard in the `WC.PM` write path (the only document-write path).
  Different bug class (access-control), unrelated to layout.
- **Status:** logged (discovery-only). High-value, self-contained fix candidate for the later pass.

## BUG-006 — [S3] Style Set gallery is inert: all 9 named sets apply the same fallback spacing
- **Area:** Design → Style Sets gallery. Spec DSGN-03 (static-confirmed in source).
- **Repro:** click any Style Set in the Design gallery (Default, Shaded, Lines (Distinctive), Word 2013, …).
- **Expected (Word):** the 9 style sets are visibly different (different spacing/fonts per set).
- **Actual (clone):** the gallery names and the preset map **don't intersect at all**, so every cell hits the
  default fallback `{before:0, after:160, line:259, lineRule:'auto'}` — all 9 produce identical spacing, and the
  3 real presets (`No Paragraph Space / Compact / Double`) are **unreachable** from this gallery.
- **Evidence (source):** gallery list `STYLE_SETS = ['Default','Basic (Simple)','Basic (Elegant)','Lines (Distinctive)','Shaded','Casual','Centered','Word 2010','Word 2013']`
  (`src/renderer/public/js/design-tools.js:102`) vs `SETS = {'No Paragraph Space','Compact','Double'}`
  (`src/renderer/bridge/design.ts:106-111`, `preset = SETS[name] || <fallback>`). No key overlap → always fallback.
- **Suspected source:** missing name→preset mapping (UI-data wiring gap). Different bug class from the others.
- **Status:** logged (discovery-only). Self-contained fix (populate the preset map for the gallery names).

## BUG-007 — [S2] View modes (Outline / Draft / Web) are visually dead — CSS targets the retired `#editor` id
- **Area:** View tab → Outline / Draft / Web Layout. Spec VIEW-01/02/03/04.
- **Repro (clone):** make a doc with Heading 1/2 + body; switch View → Outline (also Draft, Web).
  Probe `C:\tmp\bughunt\probes\spec-batch3.js` → `VIEW`.
- **Expected (Word):** Outline indents headings by level with collapse markers and dims body; Draft/Web reflow to a
  continuous narrower column with no page sheet.
- **Actual (clone):** the `#pm-editor` box is **byte-identical across print/outline/draft/web** (width `816px`,
  same `box-shadow`, `padding-left:96px`); headings get **no indent, no `::before` marker, no dimming** in Outline
  (`outlineHeadIndentSameAsPrint:true`, `draftBoxSameAsPrint:true`). Only the page-seam hide works. **Plus** the
  status bar shows **"Print Layout" active while `WC.PM.view==='outline'`** (`H.outline` calls `setActiveView('print')`).
- **Evidence:** `spec-batch3.json` `VIEW` — identical `pmBox`/`head` snapshots in all four views; `activeViewBtnWhileOutline:["Print Layout"]`.
- **Root cause:** slice-11 legacy retirement — `editor.css` Outline/Draft/Web rules target `#editor` (gone) while PM
  content is `#pm-editor`, and headings render as `<p styleid="Heading1">` not `<h1>` so even the element selectors miss.
  `H.outline` passes the wrong literal to `setActiveView`. (`VIEW_TAB.md` still advertises the missing behavior.)
- **Status:** logged (discovery-only). Self-contained: re-point the view CSS to `#pm-editor` + `p[styleid^=Heading]`,
  fix the `setActiveView` arg. Not layout-engine-gated.

## BUG-008 — [S2] Mail-merge field codes export with invalid operators and all switches/parameters dropped
- **Area:** Mailings → Rules (IF), Greeting Line, Address Block, Insert Merge Field. Spec MAIL-01/02/03/04.
- **Repro (clone):** insert each field, export; inspect `w:instrText` / `w:fldSimple`. Probe `spec-batch3.js` → `MAILINGS`.
- **Confirmed exported OOXML (all wrong):**
  - **IF rule:** `IF «Balance» Equal to "0" "Paid" "Due"` — uses the human label **"Equal to"** (Word requires `=`,`<>`,`>`,`<`)
    and a **literal `«Balance»`** instead of a nested `MERGEFIELD`. Word shows `!Syntax Error` / never evaluates. **[S2]**
  - **GREETINGLINE:** exports bare ` GREETINGLINE ` — the dialog's greeting word / name format / punctuation / fallback
    `\f \l \e` switches are **all silently dropped**. **[S3]**
  - **ADDRESSBLOCK:** exports bare ` ADDRESSBLOCK` with **no switches**, and the cached result run is the literal
    `«AddressBlock»` placeholder. **[S3]**
  - **MERGEFIELD with a space:** ` MERGEFIELD First Name ` — **unquoted**; Word parses only `First` (truncates the column). **[S3]**
- **Expected (Word):** `IF «…» = "0" …`; `GREETINGLINE \f "…" \l 0 \e "…"`; `ADDRESSBLOCK \f "…" \c 1 \e …`; `MERGEFIELD "First Name"`.
- **Evidence:** `spec-batch3.json` `MAILINGS` (exact `instr` strings + `ADDRESSBLOCK_cachedLiteral:true`).
- **Root cause:** the `mmAddressBlock/mmGreetingLine/mmInsertRule` bridge fns are **parameterless** (dialog state never
  reaches the code) and `mergeFieldInstruction` (translate-field-annotation.js) builds **no switches**; the IF dialog
  emits human operator labels + literal guillemets. Two files: the export router + the authoring dialogs.
- **Status:** logged (discovery-only). Different bug class (field-code authoring/export). The IF operator is the
  highest-severity (functionally broken merge). Note: MERGEFIELD name escaping (MAIL-05) is an unverified related risk.

## BUG-009 — [S3] All Cover Page designs collapse to one generic block (6 styles → 1)
- **Area:** Insert → Cover Page. Spec IEX-01.
- **Repro (clone):** insert Cover Page "Banded", then "Facet", then "Ion" (fresh docs). Probe `spec-batch3.js` → `INSERT_cover`.
- **Expected (Word):** each built-in cover (Banded/Facet/Ion/Filigree/…) has a distinct layout, color band, and shapes.
- **Actual (clone):** all produce the **same generic 3-line structure** `[title][Subtitle][Author Name] — <year>` with
  **no banding/color/shape** (`hasBanding:false` for all; `xmlLen` 3863–3866). The only difference is the title text =
  the style name. The 6 rich `COVERS` `build()` templates are dead code (`insert-features.js`); `xeCoverPage` ignores them.
- **Evidence:** `spec-batch3.json` `INSERT_cover` (near-identical xml length, no banding markup, generic text per style).
- **Root cause:** `Insert.insertCover` passes only the style `name` to `xeCoverPage`, which hardcodes one title/subtitle/author
  tree (`insert-exotica.ts`). Silent design loss (not a documented deferral).
- **Status:** logged (discovery-only). Self-contained (wire the per-style `build()` HTML through to insertion).

## Verified CLEAN (Review / Design)
- **Display-for-Review modes are export-safe** — `all / simple / none / original` all export `w:ins`=1, `w:del`=1,
  doc size constant. "No Markup"/"Original" do NOT bake or strip revisions from the saved file. ✓ (the S1-if-broken case)
- **Page Color (Design) is export-correct** — `<w:background w:color="FFF2CC"/>` is emitted as the **first child of
  `<w:document>` before `<w:body>`** (valid OOXML order), **survives export→reimport**, and is removed by Page Color → No Color. ✓
- **Round-trip stability (formatting)** — borders, shading (`w:shd`), lists (4 `numPr`), alignment (3 `jc`), spacing,
  color, font all survive export→reimport with stable counts (the only round-trip defects are BUG-004 and a cosmetic
  `fontFamily` CSS-fallback string). ✓
- **Comments round-trip fully** — text, author, an unresolved thread's reply, AND a resolved comment's resolved=true
  status all survive export→reopen identically (2 in / 2 out). ✓ (REV-02)
- **Tracked delete across a list boundary** keeps both items' text (marked `trackDelete`), exports `w:del`, and
  preserves both list items' `numPr` (no merge, no lost numbering). ✓ (REV-09)
- **Tracked formatting exports as `w:rPrChange`** (a tracked bold → format revision in the saved file). ✓ (REV-15)
- (DSGN-13 theme-dirties-heading-less doc: inconclusive — the test doc was already dirty from setup; `WC.Design.THEMES`
  exists and `deApplyTheme` returns true. Re-test with a clean doc later.)

## BUG-010 — [S3] Footnote/endnote inserts seed the note body with the literal word "Footnote"/"Endnote"
- **Area:** References → Insert Footnote / Insert Endnote. Spec REF-10.
- **Repro (clone):** caret in a paragraph → References → Insert Footnote. Probe `C:\tmp\bughunt\probes\spec-batch5.js` → `REF10_footnote`.
- **Expected (Word):** a new footnote has an **empty** note body; the cursor moves there for the user to type.
- **Actual (clone):** the note body is pre-seeded with the literal text **"Footnote"** (`refListFootnotes()` → `[{text:"Footnote"}]`,
  `seedTextLeak:true`); endnotes seed **"Endnote"**. This exports as real footnote content the user never authored, so every
  clone footnote ships the word "Footnote" in the saved `.docx`.
- **Evidence:** `spec-batch5.json` `REF10_footnote` (`afterFirst:[{text:"Footnote"}]`, `footnoteRefsInXml:1`). Source: `references.ts:212` seeds the literal.
- **Suspected source:** `refInsertFootnote/refInsertEndnote` seed content (`references.ts`). Different bug class (authoring seed).
- **Status:** logged (discovery-only). Self-contained (seed an empty note body instead of the label literal).

## BUG-013 — [S3] Cross-reference "Page number" exports `REF \p` (Word renders "above/below"), not `PAGEREF`
- **Area:** References / Insert → Cross-reference, "Insert reference to: Page number". Probe `C:\tmp\bughunt\probes\refxref.js`.
- **Expected (Word):** a page-number cross-reference to a bookmark/heading exports `{ PAGEREF bookmark \h }` and shows the
  target's page number.
- **Actual (clone):** `refCrossReference({display:'pageNumber'})` exports **`REF tgt \p \h`**. The `\p` switch on a `REF`
  field is Word's **relative-position** switch ("above"/"below") — NOT a page number. So in Word a "Page number" cross-ref
  renders "above"/"below" (or nothing useful), never the page.
- **Evidence:** `refxref.json` `XREF` = `{pageref:false, refField:"REF tgt \\p \\h"}`.
- **Suspected source:** the `display:'pageNumber'` → field-code mapping in the fork `crossRefs.insert` conflates page-number
  with the above/below (`\p`) form; should emit `PAGEREF` for `pageNumber`.
- **Status:** logged (discovery-only). The cross-reference dialog also exposes only Heading/Bookmark targets and 3 of Word's
  ~7 "insert reference to" options (a separate fidelity gap).

## Audit-surfaced bugs (exhaustive 321-control fidelity audit — full catalog in `FIDELITY-AUDIT.md` + `audit-digest.json`)
The 14-area audit classified **321 controls**: ~27 bugs, ~140 deviations, ~30 gaps, ~30 stubs, ~40 faithful. New confirmed bugs beyond BUG-001…013 (the ~140 deviations + gaps live in the companion files):

- **BUG-014 [S2] Font Size silently clamps to 8–96 pt (verified).** 4pt→8, 200pt→96, 1638pt→96 (`audit-verify1.json`); Word allows 1–1638. No feedback; the clamped value exports + round-trips. `font-size.js:112 minMax(8,96)`.
- **BUG-015 [S3] Non-keyword highlight color exports as character shading, not highlight (verified).** Picker offers the full palette (Word's highlighter is a fixed 15-keyword set); `#FFC000`→`<w:shd fill="FFC000">` not `<w:highlight>` → on reopen it's shading, not highlight. `highlight-translator.js` shd fallback.
- **BUG-016 [S3] Convert Text to Table (Insert) is a dead toast over a working bridge (verified).** The Insert item toasts "slice 6b" and does nothing, but `PM().textToTable({separator:','})` works (created a table). Feature unreachable from its Word location. `insert-features.js:44`.
- **BUG-017 [S2] Format Painter lock can never be turned off with Esc (code).** Double-click locks + toasts "Press Esc to stop", but no Esc handler cancels it — armed forever. `app.js:70-77` (no painter branch), `commands.js:1714`.
- **BUG-018 [S2] Replace (Ctrl+H) hides Match-case / Whole-words / Wildcards (code).** `H.replace`→`findPane(true)` with `advanced=undefined` → options row `display:none`; Replace locked to case-insensitive/no-wildcard with no way to enable. `commands.js:102`, `dialogs.js:133`.
- **BUG-019 [S2] Draw tab pen-select + drawing-toggle UI state is dead (code).** Active pen tile reads `WC.Draw.pen.id` (never updated) → only first "Pen" highlights; Drawing toggle has no latch + flyout always says "Start Drawing" (`WC.Draw.enabled` never set). `ribbon.js:271/278`, `commands.js:644/675`.
- **BUG-020 [S2] File → Close creates a new blank doc instead of closing (code).** Backstage "Close" calls `Files.newDoc()`; you can never end up document-less. `backstage.js:48`, `files.js:53`.
- **BUG-021 [S2] Mailings → Go to Record spinner mis-rendered (code).** Generic paragraph-spinner: indent icon, "pt" unit, step 6, default 0 — should be a plain integer box (default 1, step 1). Arrows jump 6 records. `ribbon.js:450-461`.
- **BUG-022 [S2] References → Mark Entry (Alt+Shift+X) has no dialog, silent no-op without a selection (code).** `refMarkIndexEntry()` called with no args/dialog; Word opens the full Mark Index Entry dialog. `commands.js:903`, `references.ts:334`.
- **BUG-023 [S3] References → Next/Prev Endnote navigates footnotes too (code).** No type filter — `refNextNote` iterates footnote+endnote refs together. `commands.js:1559`, `references.ts:260`.
- **BUG-024 [S4] Design → Themes active checkmark stuck on Aptos (code).** `isActive` reads `--doc-font` (static literal, never updated on apply). `commands.js:691/704`.
- **BUG-025 [S3] Change Case fidelity (code/partial).** Sentence-case regex needs whitespace after a terminator ("end.New" not recapitalized); toggle-case is locale-unaware (Turkish i / German ß); no Shift+F3 cycle. `commands.ts:53-77`.
- _Extensions: Mailings NEXTIF/SKIPIF insert bare condition-less fields → extends BUG-008. Watermark is preview-only/not-exported + Custom dialog lacks Picture/font/size/transparency → extends GAP-B. Layout Breaks menu is blocked AND built on dead `E()` → extends GAP-A._

## Legacy 55-bug re-triage (vs current PM code) → 6 new bugs (full detail in `LEGACY-RETRIAGE.md` / `BUGS-DETAILED.md`)
Re-checked the pre-PM-pivot `docs/BUG_BUST_FINDINGS.md` (55 bugs, the user's separate list) against current PM code:
- **37 fixed-in-PM** — the rebuild structurally eliminated the legacy DOM `execCommand`/Range-surgery corruption classes
  (Format Painter cross-paragraph, Change Case multi-paragraph empty-paragraphs, cover-page stacking, convert-text-to-table-in-list,
  Update-Labels-clobbers-table, nested-table drop, undo-ignores-DOM, etc. — all gone with the PM model).
- **6 already-logged** (BUG-008 address/greeting, BUG-009 cover, BUG-019 draw, BUG-025 change-case + comments/headers COM-validated done).
- **6 not-applicable** (legacy-`.wc-*`-DOM-only, no PM equivalent — e.g. cover-pushes-header-mid-doc: headers are parts now).
- **6 NEW bugs in PM** → BUG-026 (page-setup render, above) + BUG-027…031:
  - **BUG-027 [S3] VERIFIED** — bookmark with an existing name creates a duplicate (Word moves it). `retriage-verify.json`.
  - **BUG-028 [S3] VERIFIED** — Shift+Tab / Decrease Indent at list level 1 is a silent no-op (Word outdents out of the list).
  - **BUG-029 [S3]** — positioned/floating objects anchor to the whole doc, not their own page (code-confirmed; keystone-adjacent).
  - **BUG-030 [S3]** — PDF export / Print capture app chrome + inter-page gap bands (no print stylesheet; code-confirmed).
  - **BUG-031 [S4]** — ToF / Bibliography inserted twice stacks a duplicate (Index/ToA replace-in-place; ToF/Bib don't).

## Feature-research-spotted bugs (BUG-032…033 + 11 more in `FEATURE-IMPROVEMENTS.md`)
The Table/Picture contextual-tab feature research (`FEATURE-IMPROVEMENTS.md`) spotted 13 bugs. The two clearest
wrong-behavior bugs (now **runtime-verified** — probe `C:\tmp\bughunt\probes\table-bugs-verify.js`, 2026-06-17):
- **BUG-032 [S3] Table Text Direction is a one-shot — can't restore horizontal.** `commands.js:130` hardwires the cell
  text direction to `'tbRl'`; pressing it cannot cycle back to horizontal or to `btLr`, so once pressed the user can't
  restore horizontal text from the ribbon. Word's button cycles horizontal → 90° → 270°. Fix: read-current-then-advance
  the cycle + add `btLr`. (S, low risk.) **Runtime evidence:** first press → `tbRl`, second press → `tbRl` (`cycles:false`)
  — the cell is stuck on `tbRl`, ribbon cannot restore horizontal.
- **BUG-033 [S3] Table Indent-from-left is not gated by alignment → silently-ignored dead attribute.** `H.tblIndent`
  (`commands.js:241`) applies a left indent regardless of justification, but the renderer (`TableView.js:158-167`) only
  honors indent when alignment is NOT center/right. A user who sets indent then centers gets the indent silently ignored
  yet still stored (a dead `w:tblInd` Word also ignores under center/right). Fix: gate/clear `tblIndent` on center/right
  alignment, matching Word (which disables the control). (S.) **Runtime evidence:** indent `720` dxa survives setting
  alignment=center, and the export contains BOTH `<w:tblInd>` and `<w:jc w:val="center">` (`bothCoexistInExport:true`).
- The other 11 (Header Row/Column mislocated on Layout vs Design tblLook; Table Design tab has a misplaced 'Alignment'
  group; Row Height has no 'Exactly' rule; no 'Clear table style' on the Design tab; hardcoded 5-swatch shading palette;
  **Picture Format omits Align/Group/Selection Pane**; **Picture Format omits the entire Picture Styles group** — gallery/
  border/effects/layout) are catalogued in `FEATURE-IMPROVEMENTS.md`. Bugs ↔ improvements are connected (fix = complete the feature).

## S2-audit-promoted new bugs (BUG-034…040) — runtime-confirmed 2026-06-17
A parallel triage of every not-yet-confirmed S2 fidelity-audit item (deduped vs the 33 logged bugs) surfaced 7 genuine
new bugs, each runtime-confirmed by headless probe (`C:\tmp\bughunt\probes\s2-formatting.js` / `s2-insert-ui.js`).
Full detail (Where/When/Symptom/Why/Evidence/Solution) in `BUGS-DETAILED.md` § BUG-034…040.
- **BUG-034 [S2] Custom Watermark is CSS-only and silently dropped on save.** `deWatermark` (design.ts:274) paints an
  `#pm-editor` SVG background, skips `markDirty`, never inserts a model node → `exportDocx` emits no `w:pict`. Probe: `applied&cssApplied` true, `afterHasWatermark:false`.
- **BUG-035 [S2] Font dialog (Ctrl+D) accepts Small/All caps, Scale, Spacing, Position with live preview but applies none on OK.**
  `dialogs.js:460-461 notifyBlocked`; the `textStyle` mark has no smallCaps/caps attr or `setSmallCaps`/`setCaps` command. Probe: dialog ticked+OK'd, export has no `w:smallCaps`/`w:caps`/spacing.
- **BUG-036 [S2] Home Shading on a sub-paragraph selection floods the whole paragraph (pPr/shd not rPr/shd).**
  `commands.js:1838-1842` always writes `paragraphProperties.shading`; no run-level path; dialog `shadeApplyTo` ignored. Probe: sub-range selection → whole-paragraph shd in model, no run mark.
- **BUG-037 [S2] Layout > Breaks dropdown fully dead (blocked + dead `E()` code).** `breaks` AREA-mapped to DEFERRED
  `layout-page`, both dispatch heads `notifyBlocked` and return; `breaksMenu` calls `E()`=retired `WC.Editor`. Probe: `blocked_breaks:true`, `breaksRunMutated:false` (the page-break verb itself works — Insert tab).
- **BUG-038 [S2] Insert Link: bare domain → `file://` path, bare email → no `mailto:` (no scheme inference).**
  Address passed RAW to `setLink`; scheme-less token resolved relative to the Electron `file://` base. Probe: `example.com`→`file:///…/example.com`, `a@b.com`→`null`, `https://example.com` ok.
- **BUG-039 [S3] Cross-reference dialog exposes only 2 of Word's 7 reference types and no hyperlink/above-below checkboxes.**
  `commands.js:1023-1024` hardcodes the option lists; engine `d.crossRefs.insert` is generic. Probe: `typeOptions:[Heading,Bookmark]`, `checkboxCount:0`.
- **BUG-040 [S3] Text Box "Draw Text Box" == "Simple Text Box" (no drag), inserts an INLINE box not floating; gallery/Save missing.**
  Both menu items → `H.textBox` (commands.js:473-477); `insertTextBox` has no anchor/wrap. Probe: `shapeContainerFound:true`, `hasFloatingAnchorAttr:false`.
- _Also from this sweep: 1 duplicate (Mailings Rules If/Then/Else → folds into **BUG-008** mail-merge field-code export); 6 not-bugs
  (Colors gallery, Page Borders dialog, **Track Changes Accept** = Word-parity, Compare/Combine, Screenshot + Save-As-type = real but
  not headless-confirmable); 8 honest-degrade stubs (Watermark galleries, Borders split, File Info/Open/Options/Protect, Shapes, Equation).
  One theorized defect — Track Changes **Reject** skip-adjacent — could NOT be reproduced (probe couldn't build adjacency); logged
  transparently in `BUGS-DETAILED.md`, not numbered._

## S3-audit-triage new bugs (BUG-041…043) — runtime-confirmed 2026-06-17
Curated batch-1 of the S3 fidelity-audit tier (16 high-signal items: BUG-tagged + wrong-output-risk, deduped vs the
40-bug catalog) surfaced 3 genuine new "lying control" bugs (wrong output where the control claims to work), each
runtime-confirmed by headless probe (`C:\tmp\bughunt\probes\s3-search.js` / `s3-misc.js`). Full detail in
`BUGS-DETAILED.md` § BUG-041…043.
- **BUG-041 [S3] Find/Replace "Use wildcards": `{n}` / `(..)` / `@` escaped to literal (wrong/zero matches); Replace
  backrefs inserted verbatim.** `SearchIndex.js:507` + `search.js:810/875`. Probe: `te{2}st`→0 matches, `(a)(b)`→0 replacements.
- **BUG-042 [S4] Sort Text Type=Date sorts by leading number, not chronologically** (Date reuses the numeric `parseFloat`
  path; no date parsing). `commands.js:2021` + `commands.ts:102`. Probe: date strings `matchesChrono:false`.
- **BUG-043 [S4] Date & Time "Update automatically" checkbox is never read — always inserts an auto-updating DATE field**
  (no static-text path). `insert-features.js:193` + `insert-exotica.ts:118-123`. Probe: `hasDateField:true` unconditionally.
- _Also from batch-1: 4 duplicates (Mailings NEXTIF/SKIPIF → **BUG-008**; Next/Prev Endnote nav → **BUG-023**; Convert Text
  to Table → **BUG-016**); 8 not-bugs (Format Painter single-click, Insert-Table caret placement, table default widths,
  Replace-All count, Paste options/Paste Special, Go To — all honest reductions / correct); 2 known-stubs (Find/Replace
  `^`-codes, Drop Cap Options). Remaining S3 items (~129) are predominantly DEVIATION/GAP/STUB feature-completeness — future
  curated batches will sweep the wrong-output-risk ones._

## Minor deviations (S4) — works, but not like Word (catalog)
- **DEV-1 — Symbol inserts raw Unicode with no source font.** `insertSymbol('★')` exports a run with no `w:rFonts`
  (`insert-exotica2.json`); Word's Symbol dialog applies the source font (Symbol/Wingdings) to the run. Glyph renders via
  Unicode, but font fidelity + per-font codepoint mapping are absent. (`insert.ts insertSymbol`.)
- _(Drop Cap `framePr` exports correctly — `drop`/`margin` both write `w:framePr dropCap lines=3`; in-app paint of the
  enlarged initial is the known deferral. Date&Time field needs a cleaner re-test — placeholder-text collision.)_

## BUG-012 — [S3] Internal-document hyperlinks unsupported; a `#anchor` link mis-exports as a broken external rel
- **Area:** Insert → Link. Probe `C:\tmp\bughunt\probes\hyperlinks.js` + `docx-inspect`.
- **Expected (Word):** the Insert Hyperlink dialog has a **"Place in This Document"** target (link to a heading/bookmark),
  exported as `<w:hyperlink w:anchor="MyBookmark">` (no relationship) so the link jumps within the doc.
- **Actual (clone):** the dialog (`dialogs.js:45` `D.insertLink`) only accepts a raw URL — no internal-target option. A
  `#MyBookmark` href is exported as `<w:hyperlink r:id="rId9">` with **external** rel target `"#MyBookmark"`, which Word
  treats as a broken external link, not a jump-to-bookmark.
- **Evidence:** `hyperlinks.json` (`<w:hyperlink … r:id>` for all three) + `docx-inspect` relTargets show `#MyBookmark`
  as an External relationship target alongside the web/mailto ones.
- **Suspected source:** `insert.ts insertLink` always builds an external link mark; no `w:anchor` path; dialog lacks the
  internal-target picker. **Follow-up:** verify round-trip of a *Word-authored* internal link (`w:anchor`) — likely also
  degrades to a broken external rel on re-export.
- **Status:** logged (discovery-only). Web + email links are correct (see clean list).

## GAP-A — [S4 catalog] Control groups still honestly blocked (UPDATED for current main `98fe04e`)
- **⚠️ Re-validated 2026-06-17 against current `main` (98fe04e).** Originally found at `621da99`; the other agent has since
  **implemented and UNBLOCKED Margins, Orientation, Size (Page Setup export → sectPr) and Header, Footer.** Blocked set
  shrank **15 → 10**. Those 5 now-wired features need a fresh correctness pass (no longer "missing").
- **Still blocked (10, `WC.PM.isBlocked` true → deferral toast):**
  - **Layout → Page Setup:** **Breaks**, **Columns**, Line Numbers, Hyphenation.
  - **Layout → Arrange:** Position, Align, Group, Rotate, Selection Pane.
  - **Insert/Design → Page Number.**
- **Word-deviation notes (current):**
  - **Layout → Breaks is still blocked**, so **section breaks, column breaks, and text-wrapping breaks are unavailable** —
    only Insert → Page Break works. **Columns** is still blocked (single column only).
  - Behind the block, the remaining menu code still calls the **retired `E()=WC.Editor`** (slice 11) — dead code that would
    throw if unblocked (latent).
- **Status:** updated to current main. Unblocking the remaining 10 is Phase-4/7 layout-engine work.

## GAP-B — [S3/S4 catalog] Wired-but-stub features: UI present, no real effect (Word features missing)
- **What:** these controls are NOT in the hard-blocked set (so they run a handler, no deferral-block), but the handler is a
  **toast/no-op** — the feature looks available but does nothing real. The user reaches a working-looking UI and gets nothing.
- **Insert → Illustrations:**
  - **Shapes — STUB (S3, most misleading).** The Shapes gallery renders the full picker (all categories + SVG previews), but
    `Insert.insertShape` (`insert-features.js:118`) **only toasts** "isn't available on the new engine yet" and inserts nothing.
    Word's entire Shapes feature is absent behind a complete-looking picker.
  - **SmartArt — stub toast** (`xeSmartArt` no-op). **Chart — stub toast** (`xeChart` no-op). **3D Models — toast "not available".**
  - **Icons — works** (inserts inline SVG; no PNG raster fallback = known S4 deviation). **Screenshot — Screen Clipping only.**
- **Insert → Text/Object:** **Signature Line, Object (OLE embed/from-file) — stub toasts** (`xeSignatureLine/xeObject` no-ops).
  Online Pictures / Online Video → plain link or toast (no embed).
- **Review/misc stubs:** Dictate, Sensitivity, Translate, Smart Lookup/Researcher, Read-Aloud (cloud) → honest toasts.
- **Word-deviation note:** in Word all of the above produce real objects; here they're galleries/dialogs with no document
  effect. The honest-degrade ones (toast, no crash, no mutation) are acceptable design — but **Shapes is the worst** because
  the picker fully renders before doing nothing.
- **Status:** catalogued (mostly honest degrades). Shapes-stub-behind-full-UI is the one worth surfacing as near-bug (S3).

## BUG-011 — [S2] Apply Theme changes body font but NOT heading font (linked char styles not updated) — Word-confirmed
- **Area:** Design → Themes (and Fonts gallery, same path). Spec DSGN-01.
- **Repro (clone):** doc with a Heading 1 (via the real `applyStyleByName('Heading 1')`) + a body paragraph →
  Design → Themes → Celestial (Garamond). Save, open in Word. Probes `theme2-savedocx.js`; oracle `read-word-props`.
- **Expected (Word):** the theme changes both heading and body fonts to the theme's fonts (Garamond).
- **Actual (Word-confirmed):** the **body renders Garamond** (correct) but the **heading renders in "Aptos Display" 20pt**
  — the *default/previous* theme's major font, NOT Garamond. The theme apply half-works.
- **Evidence:** oracle `read-word-props` on `theme2.docx` para 1 = `Heading`/`One` → **Aptos Display 20pt**, while body
  (para 2) = **Garamond 12**. `styles.xml`: `Heading1` paragraph style = clean `w:ascii="Garamond"` (theme binding deleted) ✓,
  **but the linked `Heading1Char` character style still has `w:asciiTheme="majorHAnsi"`** — and character styles take
  precedence for run fonts, so Word resolves the heading to the (unchanged) theme major font.
- **Root cause:** `redefineNamedStyles` (theme apply) updates the paragraph styles + docDefaults but **not the linked
  `*Char` character styles**, which keep their `asciiTheme` bindings. (Secondary: the same paragraph showed a run-level
  font split — the trailing word read Garamond 12 — i.e. run-level inconsistency that may compound; the headline body-vs-heading
  asymmetry is the solid, reproducible part.)
- **Status:** logged (discovery-only). Themes is a headline Design feature and is visibly broken for headings in real Word.
  Fix: also strip/redefine the linked character styles' theme font bindings on theme apply. Self-contained.

## Verified CLEAN (zoom) — spec hypotheses that did NOT reproduce
- **Caret landing is accurate under fractional zoom** — `coordsAtPos`→`posAtCoords` round-trip drift = **0** for 5 words at
  zoom 0.75 / 1.0 / 1.5. ✓ (VIEW-07 — not a bug)
- **Image-resize overlay tracks the scaled image** — at 1.5×, overlay rect == image rect exactly (367,342,300,210). ✓ (VIEW-08 — not a bug)

## Verified CLEAN (References / Design / Insert export) — spec hypotheses that did NOT reproduce
- **TOC field threads the level cap** — `refInsertTOC({showLevels:2})` exports `TOC \o "1-2" \u \h \z`; Word's F9 will
  correctly limit to Heading 1–2. ✓ (REF-01/02 — not a bug)
- **Caption exports correct SEQ structure** — `"Figure " + [SEQ Figure \* ARABIC] + ": A sample figure"`; the `: ` delimiter
  and `\* ARABIC` are present, so Word repopulates "Figure 1: …". (Headless shows "Figure : …" = the known empty-number
  placeholder, not a bug.) ✓ (REF-04)
- **Citation field present** — `CITATION <sourceId>` exported (author-split b:Sources in customXml unverified, but the field is well-formed). ✓ (REF-06)
- **Page Borders export is faithful** — `dePageBorders({style:'groove',width:3})` → `w:top val="threeDEngrave" sz="24" color="…"`
  (3→24 eighths-pt, groove→threeDEngrave), and Remove clears it. (On-page render is the known deferral; export is correct.) ✓ (DSGN-07)
- **WordArt docPr ids stay unique across reopen+insert** — `1001`/`1002`, no duplicate → no Word-repair risk. ✓ (IEX-14 — not a bug)
- **Web + email hyperlinks export correctly** — `https://…` and `mailto:…` become External relationships with the right
  targets. ✓ (only the internal `#anchor` case is wrong — BUG-012)
- **Multi-table export is no longer Word-corrupt** — a 2-table doc (3×3 + 2×2) opens cleanly in Word (`read-table` exit 0,
  both tables correct). The recon's "2+ tables → corrupt" base-export bug is resolved in the current tree (other agent's
  `w:tblPr` child-order fix). ✓
- **Word Count is accurate** — 5 words / 23 chars for the doc, `selWords:2` for a 2-word selection. ✓
- **Bookmark insert pairs start+end** — `<w:bookmarkStart id=0 name=BM1>` + matching `<w:bookmarkEnd id=0>` wrap the
  selection (the B1 fix); Go-To moves the caret to the bookmark vicinity. ✓
