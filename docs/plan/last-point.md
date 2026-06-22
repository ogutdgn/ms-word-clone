# Last Point — dated state checkpoints

> A running log of "where we are" at the end of each session/day. **Append a NEW dated entry at
> the TOP each time — never overwrite older entries.** The accumulated history shows our
> progression. Renewed via the `plan-tracking` skill. Big picture: [plan.md](plan.md) · session
> playbook + daily work log: [execution-map.md](execution-map.md).

---

## 2026-06-22 (general-done cleanup LOOP — 🏁 006 Section Breaks COMPLETE; 2 of 8 done)

> **Branch:** `general-done` (cleanup integration branch off `main` @ `89ed1b1`; **user merges general-done→main at
> the END** — nothing pushed during the loop). 006 ff-merged in @ `008db22`. **Phase:** POST-MIGRATION
> `general-done` cleanup loop (autonomous `/loop`, self-paced). Ultracode ON.
>
> **State summary:** 2 of 8 cleanup features COMPLETE — 005 hyphenation ✅, **006 mid-doc section breaks ✅**.
> Loop order remaining: 007 paged test-coverage port → 008 overlay retirement (after 007) → 009 M6→gate → 010
> import fidelity → 011 pagination calibration → 012 frames group.
>
> **Done this session (006 section breaks, NO-FORK):** Layout → Breaks → Section Breaks (Next Page / Continuous /
> Even Page / Odd Page). `bridge/section-breaks.ts` `insertSectionBreak(type)` = the PUBLIC fork command
> `editor.commands.insertSectionBreakAtSelection()` (sets a paragraph-level `pPr/w:sectPr` — the mid-doc break,
> Next Page by default) + for typed variants an OWNED in-place write of `<w:type w:val="…"/>` onto
> `state.doc.attrs.bodySectPr`. Breaks flyout rewired (was a page-break stand-in). `breaks` already un-deferred
> (003) → no D6 change. **EARLY FEASIBILITY SPIKE** (this feature was flagged as possibly fork-gated — 003 called
> section breaks "a future feature") PROVED no-fork: real Word reads `Sections.Count == 2`.
>
> **3 KEY FINDINGS (debugged):** (1) the section TYPE goes on the **BODY sectPr** (the section AFTER the break),
> NOT the mid-doc paragraph sectPr — confirmed by having Word author a Continuous break + inspecting its OOXML
> (`w:type` on the body sectPr → `Sections(2).SectionStart=Continuous`); `converter.bodySectPr` is null until a
> sections-adapter mutation, so write `state.doc.attrs.bodySectPr` (the live source the exporter reads, in place).
> (2) a programmatic caret needs `setTextSelection({from,to})` — the **number form silently no-ops**, which was
> landing the break on the LAST paragraph (degenerate 1-section doc). (3) the mid-doc break sectPr exports
> **self-closing** (`<w:sectPr/>`) — fooled a probe regex.
>
> **/code-review (adversarial workflow, 14 agents): 1 confirmed (+10 refuted) → FIXED:** the **multi-break typed
> corruption** — a typed break writes `w:type` to the BODY sectPr (types only the LAST section); a 2nd+ TYPED break
> would overwrite the 1st's type → Word-wrong (silent). FIXED with a v1 GUARD (refuse a 2nd+ typed break loudly —
> the flyout toasts; multiple Next Page breaks stay allowed). Per-section multi-break typing = a future feature.
>
> **Gates (006): pm 475 / smoke 9 / roundtrip 27 / bundle 4 / probe:sectionbreaks 16 / test:roundtrip:paged 78**
> (C8 real Word: Next Page → 2 sections + section 2 NewPage; Continuous → 2 sections + section 2 Continuous).
> Commits on general-done: `0c0e5a5` plan+spike, `1f7cc4e` impl, `2cdf537` review-fix (guard), `008db22` close-out.
>
> **Known v1 limitations:** no in-app repagination at the break (export-faithful — Word paginates on open); owned
> write outside PM undo; a SINGLE typed break per doc (multiple Next Page fine).
>
> **Next: 007 paged test-coverage port** — port the ~70 overlay-only `test:pm` assertions to paged-aware variants
> (TEST INFRA, NO Word oracle — not a fidelity feature; the enabler for 008 overlay retirement). Read memory
> `paged-testpm-overlay-suite` first (genuine paged `test:pm` = 405/475; ~70 tests assert overlay-only constructs:
> `__pagination`, the disabled notes-area, overlay table/list/border DOM).
>
> **Blockers/notes:** none. Loop self-paced (ScheduleWakeup); each firing re-derives state from feature.json + git.

## 2026-06-22 (general-done cleanup LOOP started — constitution ratified + 🏁 005 Hyphenation COMPLETE)

> **Branch:** `general-done` (the cleanup integration branch off `main` @ `89ed1b1`; **user merges general-done→main
> at the very end** — nothing pushed/merged to main during the loop). 005 ff-merged in @ `22f682d`.
> **Phase:** POST-MIGRATION **`general-done` cleanup loop** (autonomous `/loop`, self-paced). Ultracode ON.
>
> **State summary:** Per the user, the 5-item post-migration cleanup backlog is being driven as an autonomous
> `/loop` into a `general-done` branch (NOT main), each item a spec-kit feature via the FULL chain
> (specify→clarify→plan→tasks→analyze→spike→implement→gates+oracle→/code-review→ff-merge into general-done).
> A project **constitution** was ratified first (`4b00681`, v1.0.0, 7 principles). **005 hyphenation COMPLETE.**
> Loop order: 005 hyphenation ✅ → 006 section breaks → 007 paged test-coverage port → 008 overlay retirement
> (after 007) → 009 M6 glyph tolerance→gate → 010 import fidelity → 011 pagination calibration → 012 frames group.
> STOP-and-ask reserved for: 011 needing a fork edit, the destructive overlay deletion in 008, any spike proving a
> feature not no-fork-achievable.
>
> **Done this session (005 hyphenation, NO-FORK):** Layout → Hyphenation wired onto the document via the `WC.PM`
> bridge. The fork has **no** hyphenation translator, so the write is an **owned upsert into
> `editor.converter.convertedXml['word/settings.xml']`** (the 003 `bodySectPr` pattern on the settings part) —
> `bridge/hyphenation.ts` `setHyphenation({mode,zone?,consecutiveLimit?,hyphenateCaps?})` /`getHyphenation()`
> /`applyManualHyphenation()`. **P1** None/Automatic (`w:autoHyphenation`), **P2** Options dialog (zone /
> consecutive-limit / hyphenate-CAPS → `w:hyphenationZone`/`w:consecutiveHyphenLimit`/`w:doNotHyphenateCaps`;
> CAPS inverted; zone/limit full-set-per-field with clear-on-null), **P3** Manual (best-effort U+00AD optional
> hyphens). Un-deferred `hyphenation` in ENGINE_READY; the 3 D6 guards repointed `hyphenation`→`position`;
> `commands.js` H.hyphenation rewired off `WC.Layout`/`E()`. SPIKE 14/14 (no-fork settings write confirmed).
> **/code-review = an adversarial workflow (31 agents): 2 confirmed (+25 refuted) → both FIXED:** (1) the Manual
> `applyManualHyphenation` reused UNMAPPED positions across the multi-node walk → corrupted/threw on the 2nd+
> text node (each padded word is longer than its source) → now `tr.mapping.map(...)` + a 3-paragraph regression;
> (2) hardened the probe's CT_Settings assertion to ABSOLUTE placement.
>
> **KEY FINDING (recorded, research.md Decision 7):** Word's COM **`ActiveDocument.HyphenationZone` is broken** —
> it returns **9999999 (wdUndefined) for ANY value, even one Word itself authored**, and Word doesn't even persist
> `w:hyphenationZone`. Our export DOES write a correct `<w:hyphenationZone w:val="360"/>` (MORE faithful than
> Word's own COM round-trip) — so the zone is validated at the XML layer (the probe), NOT COM-asserted; the oracle
> validates AutoHyphenation + ConsecutiveHyphensLimit + HyphenateCaps. Also: the CT_Settings child order is
> load-bearing — Word SKIPS a misplaced `w:hyphenationZone`, so the bridge RELOCATES the hyphenation block to its
> schema slot (`placeHyphenation`, after `w:defaultTabStop`).
>
> **Gates (005): pm 475 / smoke 9 / roundtrip 27 / bundle 4 / probe:hyphenation paged 28 + overlay 28 /
> test:roundtrip:paged 68** (C7 real-Word read-back). Commits on general-done: `f704d6f` plan, `f5773f9` tasks+spike,
> `b3640f2` P1, `63d711b` P2+P3+oracle, `22f682d` review-fixes+close-out.
>
> **Known v1 limitations:** in-app mid-word hyphenation not rendered (export-faithful); Manual = optional-hyphen
> best-effort; HyphenationZone not COM-verifiable (Word bug); single document (no per-section).
>
> **Next:** **006 mid-doc section breaks** — fresh sub-branch off `general-done`, full spec-kit chain. ⚠️ likely
> HEAVIER: the paged engine may not support multiple sections / rendering a section break — spike carefully; if it
> needs a vendored-fork edit, STOP and ask the user (Principle-I exception).
>
> **Blockers/notes:** none. Loop is self-paced (ScheduleWakeup); each firing re-derives state from
> `.specify/feature.json` + git log + the active `tasks.md`.

## 2026-06-22 (004 Line Numbers P3 — Options dialog + per-paragraph suppress shipped → 🏁 004 COMPLETE)

> **Branch:** `main` (`02a54f7`, pushed; `feature/line-numbers-paged` ff-merged then deleted). ff-merge per phase.
> **Phase:** POST-MIGRATION spec-kit feature **004 line-numbers — P1+P2+P3 DONE → 🏁 004 COMPLETE.** Ultracode ON.
>
> **State summary:** The last slice of 004 shipped — the Line Numbering Options dialog + per-paragraph suppress,
> all NO-FORK, real-Word-validated. **004 line-numbers is COMPLETE** (modes + in-app overlay + options + suppress).
>
> **Done this session (P3):**
> - **SPIKE (Q1, ultracode workflow + a throwaway runtime probe):** the no-fork per-paragraph suppress =
>   `editor.commands.updateAttributes('paragraph', { 'paragraphProperties.suppressLineNumbers': true|null })`
>   (dot-notation merge into the paragraph node's `rendered:false` paragraphProperties bag → the V3 pPr exporter
>   emits `<w:suppressLineNumbers/>`). Runtime-confirmed: `true`→one bare flag in the caret paragraph's pPr (no
>   leak); `null`→clean-drop; `false`→`w:val="0"`. `styles.apply` RULED OUT (docDefaults-only, not per-paragraph).
>   Overlay suppress-detection = resolve a painted line's `data-pm-start` in `editor.state.doc` → paragraph →
>   `attrs.paragraphProperties.suppressLineNumbers` (spike-confirmed reliable). NO fork edit. (research.md Q1.)
> - **bridge/line-numbers.ts:** `start` is now USER-FACING (write raw `w:start = userStart−1`; read inverts) so
>   the dialog AND overlay both speak user-facing numbers (the P1 off-by-one: Word StartingNumber = w:start + 1);
>   `distanceExplicit` (Auto vs explicit); NEW `suppressLineNumbers(on?)` + `currentParagraphSuppressed()`; NEW
>   `replace` option (the dialog's FULL-SET apply drops the stale lnNumType first → clears omitted attrs).
> - **bridge/line-numbers-overlay.ts:** SKIPS suppressed paragraphs' lines from the count (Word semantics).
> - **commands.js:** H.lineNumbers wires "Suppress for Current Paragraph" (toggle + ✓) + a real "Line Numbering
>   Options" dialog (mode / start / count-by / from-text distance, seeded from getLineNumbers, `replace:true`).
> - **Probe/oracle/roundtrip:** P3 export+model+overlay-skip+**carryover** regression in the probe; the export
>   probe authors start 5 + a suppressed marker paragraph; `validate-linenumbers-win.ps1` reads StartingNumber +
>   the marker paragraph's `w:suppressLineNumbers`; C6 asserts StartingNumber===5 + the suppress flag.
> - **Adversarial review (ultracode, 28 agents): 2 confirmed (the SAME bug) + 21 refuted.** Confirmed =
>   **partial-update carryover**: lowering start to 1 (or distance→Auto) on a LIVE section OMITTED the attr and
>   left the stale value → Word read the OLD value. **FIXED** via the `replace:true` full-set (drop-then-recreate
>   the lnNumType) on the dialog path; the modes dropdown stays partial (preserves settings, as Word does).
>   Added a carryover regression test (re-apply 5→1 clears `w:start`; distance 0.5→Auto clears `w:distance`).
> - **Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `probe:linenumbers` paged 52 + overlay 45 /
>   `test:roundtrip:paged` 60/0** (real Word: StartingNumber===5 via the off-by-one, CountBy 2, continuous,
>   the suppressed paragraph carries `w:suppressLineNumbers`, opens without repair, PID-safe).
>
> **Known v1 limitations (recorded):** table-cell lines not numbered (Word numbers them); pixel-exact gutter not
> oracle-calibrated; v1 = single primary section.
>
> **Next: the 005+ post-migration backlog (USER PICKS the order)** — overlay-retirement (remove the decoration
> overlay engine + the `WC_LAYOUT=overlay` path) · residual `isBlocked` layout reconciliation (position / align /
> group / rotate / hyphenation / mid-doc section breaks) · port the ~70 overlay-only `test:pm` tests to
> paged-aware variants · M6 tolerance → a pass/fail gate + the multi-page pagination calibration (PE 2 vs Word 3)
> · paged html/txt/csv import fidelity. Then THE COMPLETENESS PASS (docs/bug-hunt → spec-kit features). All
> spec-kit, all NO-FORK, all oracle-validated. Branch fresh off `main` per feature.
>
> **Blockers/notes:** none. (Process: P3 was done on a synced `feature/line-numbers-paged` then ff-merged to
> `main` + the branch deleted — back to the short-lived-branch flow.)

## 2026-06-22 (004 Line Numbers P2 — in-app margin-number overlay shipped)

> **Branch:** `main` (`fe12e4b`, pushed; `feature/line-numbers-paged` re-pointed to it). ff-merge per phase.
> **Phase:** POST-MIGRATION spec-kit feature **004 line-numbers — P1+P2 DONE, P3 next.** Ultracode ON.
>
> **State summary:** Line numbers now RENDER in-app (the margin-number overlay), matching the export. P3
> (Options dialog + per-paragraph suppress) remains.
>
> **Done this session (P2):**
> - The paged PE paints `.superdoc-line`s but no numbers → an OWNED overlay (the comments/ink pattern).
> - **Built with ultracode workflows:** (1) a 5-reader parallel understanding sweep (overlay pattern /
>   painted-DOM geometry / event plumbing / Word line-count semantics / probe harness) → architect synthesis;
>   (2) a runtime DOM spike confirming the selectors (`.superdoc-page[data-page-index]`,
>   `.superdoc-line[data-pm-start]`, footnote `data-block-id ^= footnote-`); (3) a 2nd workflow = an
>   adversarial review (5 finder dimensions × 2 diverse refuters).
> - **NEW `src/renderer/bridge/line-numbers-overlay.ts`** (a TS bridge module — corrected the spec-kit T012
>   `public/js`+`<script>` mechanism to the bridge-module pattern, matching comments/ink/notes): mounts
>   `#wc-linenum-overlay` into `#pages`, `render()` counts per `getLineNumbers()` (`n%countBy===0` display,
>   per-page reset for newPage), positions a right-aligned `.wc-line-number` in the left-margin gutter,
>   excludes header/footer/footnote/table/zero-height; 80ms debounce; `wc:paged-relayout` +
>   `wc:linenumbers-changed` + resize + canvas-scroll; bound-once leak guard; READ-ONLY + paged-only.
> - Wiring: `commands.js` `H.lineNumbers` dispatches `wc:linenumbers-changed` after a successful apply
>   (setLineNumbers is a sectPr write with no relayout); `index.ts` install + a `replaceFile` open/new nudge;
>   `index.html` CSS link; `line-numbers-pm.css`.
> - **Adversarial review → 6 survivors:** 2 refuted (`n%countBy===0` IS Word-correct — multiples of countBy
>   regardless of start; the 80ms throttle self-corrects because `wc:paged-relayout` fires after every paint)
>   + 5 fixed (page-sort `||0`→engine-mirror; footnote regex→`/footnote|endnote/i`; narrow-margin collapse;
>   tall-line centering; **line sort client-top→`data-pm-start` so multi-column lines number in reading order**).
> - **Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `probe:linenumbers` paged 25 + overlay 21.**
>
> **Process note:** P2 commits landed directly on `main` (I stayed on main after the P1 merge rather than
> switching back to the feature branch). Outcome identical — reviewed, gates green, ff + pushed; branch
> re-pointed to main. Per merge-mode, prefer the short-lived branch next time, but no harm done.
>
> **Known v1 limitations (recorded):** table-cell lines not numbered (Word numbers them); an imported
> `w:start>1` displays our value (the P1 `w:start`↔Word `StartingNumber` off-by-one still applies — P3);
> pixel-exact gutter not yet oracle-calibrated.
>
> **Next:** **004 P3** — the Line Numbering Options dialog (start / count-by / from-text distance, incl. the
> `w:start = userStart−1` off-by-one mapping) + per-paragraph `w:suppressLineNumbers` (SPIKE-gated: find a
> no-fork `pPr` write, research.md Q1). Tasks T017–T022. Resume on `feature/line-numbers-paged`.
>
> **Blockers/notes:** none.

## 2026-06-22 (004 Line Numbers — planned + P1 (modes) shipped)

> **Branch:** `feature/line-numbers-paged` (P1 `aaf0347`, ff-merged to `main` + pushed; `main == origin/main`).
> ff-merge per phase. **Phase:** POST-MIGRATION spec-kit feature **004 line-numbers — P1 DONE, P2 next.**
>
> **State summary:** the next independent feature (Layout → Line Numbers) is planned + P1 (the modes) shipped,
> all NO-FORK, real-Word-validated. P2 (the in-app margin overlay) + P3 (Options + suppress) remain.
>
> **Done this session:**
> - **Feasibility spike** — `editor.doc.sections.setLineNumbering` exports real `sectPr/w:lnNumType` + reads
>   back, but the paged PE paints **0** margin numbers → the in-app render must be an owned overlay (P2).
> - **Spec-kit** `specs/004-line-numbers/` (spec/plan/research/data-model/contracts/quickstart/checklist/tasks).
> - **P1 (`aaf0347`)** — None / Continuous / Restart Each Page / Restart Each Section. New
>   `bridge/line-numbers.ts` (`setLineNumbers`/`getLineNumbers`, mirrors `columns.ts`); un-deferred
>   `lineNumbers` in `ENGINE_READY`; rewired `commands.js` `H.lineNumbers` off the retired `E()`/`WC.Layout`
>   → `WC.PM`; repointed the **three** D6 guards `lineNumbers`→`hyphenation`. New `probe:linenumbers`
>   (paged 19 + overlay 19) + `validate-linenumbers-win.ps1` + `test:roundtrip:paged` C6.
> - **REAL-WORD DISCOVERY (C6):** authored `w:lnNumType/@w:start="3"` reads back in Word as
>   `StartingNumber=4` — an off-by-one → start-at deferred to P3 (write `w:start = userStart−1`; recorded in
>   research.md Q2). P1 ships modes + count-by only (count-by round-trips cleanly — Word CountBy == authored).
> - **`/code-review` high** → 2 fixes (the dropdown-block D6 comment honesty re the retired-`WC.Layout`
>   `H.hyphenation` throw trap; probe restart-exclusivity) + 3 P3 notes.
> - **Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 57 / `probe:linenumbers` paged 19 + overlay 19.**
>
> **Discovery worth keeping:** real-Word validation earns its keep — the `w:start`↔`StartingNumber` off-by-one
> would never surface in our own export round-trip (we write 3, read 3); only the COM oracle caught it.
>
> **Next:** **004 P2** (the owned margin-number overlay `line-numbers-overlay.js` — the comments/ink pattern:
> read painted `.superdoc-page .superdoc-line` rects + count per mode/countBy/restart, `wc:paged-relayout`;
> tasks T012–T016) → **P3** (Line Numbering Options dialog + per-paragraph `w:suppressLineNumbers`, spike-gated,
> T017–T022). Resume on `feature/line-numbers-paged`, read `specs/004-line-numbers/tasks.md`.
>
> **Blockers/notes:** none. ⚠️ When `hyphenation` is eventually un-deferred, its `H.hyphenation` handler MUST
> be rewired off the retired `WC.Layout` first (it would throw, not toast).

## 2026-06-21 (🏁 003 Columns COMPLETE — P2 customize + P3 column break shipped)

> **Branch:** `main` (`eff06c3`, pushed; `main == origin/main`). Work on `feature/columns-paged` (local),
> ff-merged per phase. **Phase:** POST-MIGRATION — spec-kit feature **003 columns is DONE** (P1+P2+P3 + polish).
>
> **State summary:** the **003 columns** feature is fully shipped, all NO-FORK, all real-Word-validated.
>
> **Done this session (P2+P3 + polish):**
> - **Phase-0 spike** — resolved the no-fork reach: count/spacing/equalWidth via the public `sections.setColumns`;
>   **line-between** (`w:cols/@w:sep`) + **unequal Left/Right** (`<w:col>` children) via an OWNED write to
>   `editor.converter.bodySectPr`'s w:cols (spike-proven to persist + round-trip; NOT a fork-source edit); the
>   **column break** = `hardBreak{lineBreakType:'column'}`.
> - **P2 (`63d94ee`)** — More Columns dialog (count/spacing/equalWidth/line-between) + Left/Right presets.
>   `setColumns` is a safe PARTIAL update (a preset / lineBetween toggle no longer clobbers prior state);
>   `bodyColsEl` = direct-child only; honest-fail when unreachable. `/code-review` 39-agent → 7 findings, 5 fixed
>   (partial-update clobber ×3, direct-child, honest-fail) + 2 recorded (owned write outside PM undo; in-app paint
>   best-effort). Oracle: Word reads `EvenlySpaced=false`, `LineBetween=true`, `columnWidths=[131.75,300.25]pt`
>   (= Word's exact Left preset), opens without repair.
> - **P3 (`eff06c3`)** — the column break (`insert.ts` `insertColumnBreak`/`insertLineBreak`). Un-deferred `breaks`,
>   rewired the Breaks flyout OFF the retired `E()` (Column/Text-Wrapping/the local page-break helper/Continuous-toast).
>   Repointed the three D6 guards `breaks`→`lineNumbers`. Oracle: a char-14 column break present. + Polish: docs
>   reconciled (SCOPE/FEATURES/LAYOUT_ENGINE Columns ✅).
> - **Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 49 / `probe:columns` paged 39 + overlay 36.**
>
> **Recurring lesson:** each ENGINE_READY un-defer (columns, then breaks) requires repointing the D6 guards
> (`[0a]`×2 + `[11]`) to a still-deferred representative — a missed one leaves a stale flyout open and CASCADES
> into ~8 unrelated dropdown-content `test:pm` failures (caught by the overlay suite).
>
> **Next:** **004+** (independent; user picks): overlay-retirement · residual-`isBlocked`-layout (position / align /
> group / rotate / lineNumbers / hyphenation / mid-doc section breaks) · paged-test-coverage port ·
> M6-tolerance→gate + pagination-calibration (PE 2 vs Word 3) · paged html/txt/csv-import fidelity · then the
> COMPLETENESS PASS (`docs/bug-hunt/`). Start a fresh `/speckit-specify` for the chosen feature.
>
> **Blockers/notes:** none. `feature/columns-paged` is at `eff06c3`.

## 2026-06-21 (003 Columns — planned + P1 (presets) shipped)

> **Branch:** `main` (`3326938`, pushed; `main == origin/main`). Work on `feature/columns-paged` (local),
> ff-merged. **Phase:** POST-MIGRATION — spec-kit feature **003 columns**, P1 done.
>
> **State summary:** picked **003 columns** as the next feature (justified: overlay-retirement is blocked on
> the test-coverage port; M6 calibration needs a fork edit; columns is a feasibility-proven no-fork win).
> Ran the spec-kit flow: `/speckit-specify` + `/speckit-plan` + `/speckit-tasks` → `specs/003-columns/`
> (spec/plan/research/data-model/contracts/quickstart/tasks, `a2bc298`). Then implemented **P1 (One/Two/Three
> presets)**.
>
> **Done this session:**
> - **003 plan (`a2bc298`)** — full spec-kit artifacts; `.specify/feature.json` → `specs/003-columns`.
> - **003 P1 (`3326938`)** — `bridge/columns.ts` (NEW): `WC.PM.setColumns({count,gap,equalWidth})`→
>   `editor.doc.sections.setColumns` (renders columns live + exports `sectPr/w:cols`); `getColumns()`. Un-deferred
>   `columns`; rewired the dead `E()`/CSS-multicol `columnsMenu` + More Columns dialog → `WC.PM.setColumns`.
>   Repointed the **three** D6 guards (`[0a]` run + `[0a]` dropdown + `[11]`) off `columns`→`breaks` (cascade
>   lesson: a missed `[0a]` left a stale `columnsMenu` flyout open → 8 unrelated dropdown-content tests failed;
>   the overlay `test:pm` caught it). New `probe:columns` + `validate-columns-win.ps1` (`PageSetup.TextColumns`)
>   + `paged-export-columns-probe.js` → `test:roundtrip:paged` C4. `/code-review` 36-agent → 1 fix.
>   **Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 42 / `probe:columns` paged 15 + overlay 12.**
>   Real Word: `TextColumns.Count==2`, `EvenlySpaced`, opens without repair.
>
> **Next:** **003 P2** (More Columns: spacing/equalWidth + Left/Right unequal + line-between — Phase-0 spike
> bounds the no-fork reach of `<w:col>`/`w:sep`; tasks T015–T020) → **003 P3** (column break, T021–T026). Then
> 004+ (overlay-retirement / residual-`isBlocked`-layout / paged-test-coverage / M6-gate+pagination-calibration
> / import-fidelity). Resume on `feature/columns-paged`, read `specs/003-columns/tasks.md` (T015→).
>
> **Blockers/notes:** none. `feature/columns-paged` is at `main`'s tip (3326938).

## 2026-06-21 (🏁 002 Headers & Footers COMPLETE — P2 variants + P3 page numbers shipped)

> **Branch:** `main` (`5d86503`, pushed; `main == origin/main`). Work was on `feature/headers-footers-paged`
> (kept local), ff-merged per phase. **Phase:** POST-MIGRATION — spec-kit feature **002 headers-footers is DONE**.
>
> **State summary:** The **002 headers-footers** feature is fully shipped (P1 + P2 + P3 + Phase-6 polish), all
> NO-FORK, all Word-COM-validated. P1 (on-page edit + the "Header & Footer Tools" contextual tab) shipped earlier
> (`a3e46da`); this session added P2 + P3 + polish.
>
> **Done this session:**
> - **P2 (`fefbbf9`)** — Different First Page + Different Odd & Even header/footer variants. `bridge/header-footer.ts`:
>   `setHeaderText/getHeaderText` (+footer) take `opts.variant∈{default,first,even}`+`opts.section` (via the story-runtime
>   `HeaderFooterSlotStoryLocator.variant`; write=effective+materializeIfInherited, read=explicit for first/even);
>   `setDifferentFirstPage`→`sections.setTitlePage` (sectPr titlePg), `setDifferentOddEven`→`sections.setOddEvenHeadersFooters`
>   (settings evenAndOddHeaders), `getHeaderFooterOptions`→`sections.get`. UI = an "Options" group on the H&F Tools tab
>   (`header-footer-tools-pm.js`, checked-state via `refreshOptionToggles`). Paged PE paints the first-page variant LIVE.
> - **P3 (`4bfb442`)** — page-number `PAGE` fields. `insertPageNumber({position})`→`editor.doc.fields.insert PAGE` on the
>   slot story editor → a real fldChar/instrText field; `removePageNumbers` (slotHasPageField guard); `ensureInlineTarget`
>   mints an sdBlockId (K-risk-1). UI = Page Number flyout + un-defer `pageNumber` (repointed D6 guards [0a]/[11]→columns/docInfo).
> - **Phase-6 polish (`5d86503`)** — doc reconciliation (SCOPE/FEATURES/LAYOUT_ENGINE #8).
> - **Oracle + gates:** new `paged-export-hf-p{2,3}-probe.js` + hardened `validate-headerfooter-win.ps1` (OpenAndRepair:=false,
>   `.Index` enum self-check, PageSetup flags + Headers(2/3)/Footers(2/3) + `Get-PageField` wdFieldPage=33) wired into
>   `test:roundtrip:paged` C2+C3 → **36/0** (all P2 flags+variant text + the P3 page field read back == authored vs REAL Word).
>   Also fixed a **pre-existing** flip-fallout gate bug: `test-roundtrip-paged.js` `build('overlay')` set `WC_LAYOUT=''` which
>   post-FR-013 boots PAGED (`main.ts:35`) → now explicit `'overlay'`. `/code-review` (40-/36-agent) per slice → 2 fixes.
>   **Gates: pm 475 (overlay) · smoke 9 · roundtrip 27 · bundle 4 · `test:roundtrip:paged` 36 · `probe:headerfooter` paged 52 + overlay 45.**
>
> **KNOWN LIMITATION (fork-gated, recorded):** the paged PE does NOT resolve a *freshly-inserted* footer PAGE field's
> per-page number in-app (renders the empty `resolvedNumber` as "0"); real Word + a reopen render it correctly — the COM
> oracle (C3: wdFieldPage=33 → number) carries the per-page-correctness proof. A future no-fork attempt or a NOTICE'd
> minimal fork accessor could close it.
>
> **Next:** the next spec-kit feature (003+, user picks): overlay-retirement · residual-`isBlocked`-layout reconciliation
> (layout-page/layout-arrange) · paged-test-coverage port · M6-tolerance→gate + pagination-calibration (PE 2 vs Word 3) ·
> paged html/txt/csv-import fidelity · then the COMPLETENESS PASS (`docs/bug-hunt/`). Resume per execution-map CURRENT PHASE.
>
> **Blockers/notes:** none. `feature/headers-footers-paged` is at `main`'s tip (5d86503) — safe to delete or reuse.

## 2026-06-21 (🚢 PAGED-RENDER MIGRATION COMPLETE & SHIPPED — now POST-MIGRATION; 002 headers/footers P1 done)

> **Branch:** `main` (`a3e46da`, pushed). **Phase:** POST-MIGRATION (per-feature reconciliation + cleanup) —
> the layout engine (Phase 4) is DONE.
>
> **▶ NEXT SESSION — CONTINUE STRICTLY VIA SPEC-KIT (no ad-hoc coding).** All remaining work = `specs/00N-*`
> features: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → probe-first spike → implement → VERIFY
> (gates + Word-COM oracle + `/code-review`) → ff-merge to `main` + push → checkpoint (plan-tracking). **RESUME
> the ACTIVE feature 002** from `specs/002-headers-footers/tasks.md` (P2 next, T018→); `.specify/feature.json`
> points at it. The full spec-kit feature SEQUENCE — **002 (headers/footers) → 003+ cleanup features → the
> COMPLETENESS PASS (fix ALL bugs + implement ALL features, sourced from `docs/bug-hunt/` BUG-LEDGER.md + the
> 76-feature/321-control audit)** — is in [execution-map.md](execution-map.md) → CURRENT PHASE. Every fix/feature
> ships under a spec + a regression test (+ the oracle for fidelity).
>
> **🏁 THE PAGED-RENDER MIGRATION IS OVER.** M1…M6 + paged open/new + the paged-default FLIP (FR-013) + doc
> reconciliation are all on `origin/main`. **Paged** (the SuperDoc PresentationEditor — real per-page sheets)
> is the **shipping default**; overlay is the legacy engine behind `WC_LAYOUT=overlay`. Record:
> `specs/001-paged-render-migration/`; full detail: [layout-engine-runbook.md](layout-engine-runbook.md).
>
> **We are now in the POST-MIGRATION PHASE** = per-feature reconciliation + cleanup, driven by spec-kit
> features under `specs/00N-*`. Standing directive (memory `autonomous-postmigration-exec`): user pre-approves
> the spec-kit plans + wants autonomous execution (plan → execute, no per-step approval); ff-merge to `main` + push.
>
> **Done this session:**
> - Shipped the migration endgame (paged open/new fix, the paged-default flip, doc reconciliation, the
>   `layout-engine → main` push).
> - **002 Headers & Footers** (`specs/002-headers-footers/`, full spec-kit set). **P1 DONE + MERGED** (`a3e46da`):
>   on-page header/footer editing on the paged engine + the "Header & Footer Tools" contextual tab, **fully
>   no-fork** (a probe-first spike found entry/exit/state all reachable through the PE's public surface). A
>   52-agent `/code-review` → 4 fixes (off-screen entry, materialize-clobber-race, focus-steal, stuck-tab-on-open/new).
> - **Gate-infra finding + fix:** the migration's "paged test:pm 475" was a **FALSE GREEN** — `test:pm` is an
>   OVERLAY-rendering suite (~70 tests read overlay-only `__pagination` / `#pm-notes-area` / overlay DOM), and a
>   stale `localStorage WC_LAYOUT` in the shared probe profile made paged builds boot overlay (localStorage
>   overrides the build define in `main.ts`). FIXED (`0f828a7`): a boot-mode guard pins `test:pm` to overlay
>   (build overlay → 475; a paged build → 1 loud "build overlay" failure); paged rendering is covered by the
>   dedicated `probe:*` probes. Memory: `paged-testpm-overlay-suite`.
>
> **Gate baseline now:** `test:pm` **475 (OVERLAY ONLY** — `WC_LAYOUT=overlay npm run build`) · `test:smoke`
> **9** · `test:roundtrip` **27** · `test:bundle` **4** + the paged `probe:*` probes + `test:roundtrip:paged`
> 19 + `report:glyphgeom` (dev-box-only).
>
> **Next:** **002 P2** (Different First Page / Different Odd & Even variants) → **P3** (page-number fields) —
> `tasks.md` T018–T033, same no-fork story-runtime bridge + the Word-COM oracle. Then the post-migration
> backlog (user picks order): overlay retirement · more per-feature reconciliation (the residual `isBlocked`
> gates on layout-page/layout-arrange/text-effects) · port the ~70 overlay-only `test:pm` tests to paged-aware
> variants · M6 → pass/fail gate + the multi-page pagination calibration (PE 2 vs Word 3) · paged
> html/txt/csv import fidelity.
>
> **Blockers/notes:** none. ⚠️ `test:pm` MUST build overlay (the boot-guard enforces it; smoke/roundtrip are
> mode-agnostic). Resume 002 P2 on a fresh feature branch off `main`.

## 2026-06-18 (Option-B layout engine: spec-kit adopted + umbrella spec; execution tracked in the RUNBOOK)

> **Branch:** `layout-engine` (off `main` @ 7f15724; pushed to `origin/layout-engine`). **Phase:** 4 — layout engine, EXECUTION.
>
> **▶ Layout-engine execution now has a single live runbook:
> [layout-engine-runbook.md](layout-engine-runbook.md)** — read it + its "Current Status" to resume.
> Decisions locked: scope **A** (umbrella spec) · milestone order **C** · end-state **A** (paged = default
> later via a gated flip). The Option-B engine was **runtime-proven** by a standup spike (real per-page DOM,
> pagination 1→12, model page-free, caret/typing) — see [../layout-engine-standup-findings.md](../layout-engine-standup-findings.md).
> Umbrella spec written via GitHub **spec-kit** at [../../specs/001-paged-render-migration/spec.md](../../specs/001-paged-render-migration/spec.md).
> **NEXT:** `/speckit-plan` for Milestone 1 (per-page coordinate adapter + dynamic-import). Branch model: slices
> off `layout-engine` → ff-merge back; `layout-engine` → `main` only when complete. Commit cadence: consolidated.

## 2026-06-17 (doc maintenance — Word PARITY TARGET LOCKED (ADR-0006); docs verified up-to-date)

> **Branch:** `main`. **Phase:** 4. Docs/plan all current + git clean/synced.
>
> **🔒 PARITY TARGET LOCKED — ADR-0006** (read live via COM on the dev PC): the "real Word" oracle is
> **Microsoft 365 Apps (`O365ProPlusRetail`) — Word for Windows, Current Channel (`Production::CC`), x64,
> en-US, Version 16.0, build 16.0.20026.20168** (`C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE`).
> NOT Mac Word, NOT perpetual 2019/2021/2024. Current Channel auto-updates so the BUILD drifts (was
> `16.0.19929` when Aptos colors + ground-truth JSON were extracted — same install) → lock = the identity,
> record the build per validation. New `docs/decisions/0006-word-parity-target-version.md`; indexed in
> decisions/README; pinned in LAYOUT_ENGINE.md §5; memory `dev-machine-windows` updated.
>
> **📋 DOC-CURRENCY CHECK:** plan docs current through PR #133; git clean + synced. ⚠️ `docs/BUG_BUST_FINDINGS.md`
> is STALE (2026-06-01, pre-PM-pivot — its fixes reference retired legacy files `src/renderer/js/*`,
> `WC.Editor`, `html-to-docx`; all GONE). The 55 bugs need RE-TRIAGE against the current PM codebase before
> any are actionable (several already addressed in PM: comments/headers/endnote export). User is handling
> the bug list separately (a concurrent session); flagged for re-triage, not auto-fixed.

---

## 2026-06-17 (ALL 4 big items have shipped increments; ITEM 4 keystone = drag-reposition DONE (PR #132) + STEERING INFLECTION)

> **Branch:** `main` (PR #132 merged `15aae62`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 475 / smoke 9 / roundtrip 27.** Word COM-validated. Directive: [[phase4-finish-all-directive]].
>
> **ALL 4 BIG ITEMS now have shipped, COM-validated increments:** ① page-setup (#126) · ② grayscale (#128)
> · ③ header/footer text (#130) · ④ frames-overlay keystone — drag-to-reposition carve-out (#132).
>
> **✅ ITEM 4 carve-out — IMAGE DRAG-TO-REPOSITION — DONE (PR #132, Word-COM-validated):** a deep
> scope-workflow audited the layout engine (4a-4f) and found: the MODEL/EXPORT tier is ~90% done; the
> remaining keystone work is the VISUAL/RENDER tier, which all of 4c/4d/4e/4f converge on (the missing
> render-overlay/paged-container rework). The ONE COM-validatable carve-out was the drag-to-reposition
> affordance (4c.2 §A.1d(a)) — shipped: a move-region on the resize overlay (image-resize.ts) writes
> marginOffset → wp:posOffset; **Word read-shapes Left=120pt/Top=60pt** after a +160/+80px drag. New `[4c]`
> gate test (synthetic drag) + probe. /code-review fixed a listener cross-contamination I introduced.
>
> **🧭 STEERING INFLECTION — the keystone's COM-validatable surface is now EXHAUSTED.** The scope's honest
> verdict (with which I agree): the keystone REMAINDER is the visual-render tier — (b) render z-stacking of
> floated images, (c) faithful Square/Tight render position, (d) mid-`<p>` line-split click-misland, (e)
> table row-split-across-pages render, (f) table relocate drag, (g) on-page header/footer band +
> page-number field render. These have **no objective Word-COM gate** (they're pixels, not exportable
> attrs) AND converge on a **design fork**: RENDER MODEL = (A) keep the continuous `#pm-editor` + add a
> synced absolutely-positioned overlay, vs (B) re-render into real per-page `.page` containers (a deeper
> rewrite of pagination.ts + line-split + the editor mount). This cascades through 4c/4d/4e/4f and is the
> kind of decision the prior small slices never needed. **Asked the user to steer (A vs B) + pick the next
> priority** — see the AskUserQuestion this session.
>
> **POSSIBLE next COM-validatable increment IF the user wants to keep the export-loop going:** a
> **page-number FIELD** in the header/footer (builds on item 3) — a PAGE field code exports + Word renders
> the number (the FIELD half may be separable from the on-page render, mirroring the header-text lesson
> "keystone-gated can be PARTIAL"). Verify validatability before committing.
>
> spawn_tasks (NOT this loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list
> `task_eb50ae00`, manualHyphenate `task_a4196ed8`. Branch off `main` (docs checkpoints on a branch + PR).

---

## 2026-06-17 (finish-all loop; ITEM 3 header/footer text DONE (PR #130); NEXT = ITEM 4 frames-overlay KEYSTONE)

> **Branch:** `main` (PR #130 merged `2e6302b`; branch deleted). **Phase:** 4 (layout engine). **Directive:**
> finish ALL big Phase-4 items, no-stop loop, my order — [[phase4-finish-all-directive]].
> Gates: **PM 474 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode (scope-workflow per item).**
>
> **ORDER:** ① page-setup (DONE #126) → ② picture grayscale (DONE #128) → ③ header/footer text (DONE #130)
> → ④ frames-overlay keystone (NEXT, the biggest/last).
>
> **✅ ITEM 3 — HEADER/FOOTER TEXT — DONE (PR #130, Word-COM-validated):** set/read/round-trip the REAL
> OOXML parts. A scope-workflow proved only the on-page VISUAL band is keystone-gated; the export path is
> keystone-INDEPENDENT (converter + Document API `headerFooters` + story-runtime were already built+tested).
> New `src/renderer/bridge/header-footer.ts` (`setHeaderText`/`setFooterText`/`getHeaderText`/`getFooterText`)
> drives `resolveHeaderFooterSlotRuntime` (story-runtime) → edits a headless story editor (selectAll +
> insertContent; there is NO `commands.setContent` in the fork) → `runtime.commit(host)` writes
> `word/headerN.xml` `<w:hdr>` + materializes the sectPr `w:headerReference` + rel (+ `[Content_Types]`
> auto-register). NO converter code. `ENGINE_READY` un-blocked `header`/`footer`; `H.header`/`H.footer` →
> Edit modal (both `run()` AND `dropdown()` dispatch routed to it — the dropdown arrow hit the dead
> `WC.HeaderFooter.headerMenu`). **🔬 Word COM** (validate-headerfooter-win.ps1): `Sections(1).Headers(1).Range.Text=='HdrProbe'`,
> `Footers(1)=='FtrProbe'`. `[9]` test (parts+refs+rel+round-trip+**re-edit replace-not-append**); repointed
> `[0a]`/`[11]` block probes header→`pageNumber`. `/code-review` ×1: removed an editability-leak `setEditable`
> + added the re-edit test.
> **LESSON:** "keystone-gated" can be PARTIALLY true — the EXPORT/round-trip half of a layout feature is
> often independent of the visual/multi-page half. Scope down to the COM-validatable export slice and defer
> only the on-page rendering. The story-runtime (resolveHeaderFooterSlotRuntime) is the content-edit path
> for header/footer/notes (no public domain content verb).
>
> **🆕 LATENT (tracked, not this loop):** the still-blocked header-footer cmds (pageNumber/goToHeader/
> goToFooter/closeHeaderFooter/docInfo/differentFirstPage/OddEven) still call the retired
> `WC.HeaderFooter`/`E()` (commands.js:400-408,457,1593) — will `TypeError` if unblocked without a rewrite.
> Same class as spawn_task `task_a4196ed8` (manualHyphenate).
>
> **NEXT — ITEM 4: FRAMES-OVERLAY KEYSTONE (docs/LAYOUT_ENGINE.md).** The biggest, last item — the Phase-4
> layout-engine keystone that unblocks float/image resize+relocate, floating objects, multi-page positioning,
> the on-page header/footer band, page numbers. This is ARCHITECTURAL (not a bounded export slice) — START
> with a deep scope-workflow over docs/LAYOUT_ENGINE.md + the current PresentationEditor/pagination/layout
> model to decompose it into shippable sub-PRs; expect multiple PRs. Be honest if a sub-part needs steering.
> spawn_tasks (NOT this loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list
> `task_eb50ae00`, manualHyphenate `task_a4196ed8`. Branch off `main` (docs checkpoints on a branch + PR).

---

## 2026-06-16 (finish-all loop; ITEM 2 picture grayscale DONE (PR #128) — a14 deferral was an ENUM MISREAD)

> **Branch:** `main` (PR #128 merged `091c737`; branch deleted). **Phase:** 4 (layout engine). **Directive:**
> finish ALL big Phase-4 items, no-stop loop, my order — see [[phase4-finish-all-directive]].
> Gates: **PM 473 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode (scope-workflow per item).**
>
> **ORDER:** ① page-setup export (DONE PR #126) → ② picture grayscale (DONE PR #128) → ③ headers/footers
> (NEXT) → ④ frames-overlay keystone.
>
> **✅ ITEM 2 — PICTURE GRAYSCALE — DONE (PR #128) + MYTH BUSTED:** Word's OWN grayscale OOXML is plain
> `<a:grayscl/>` in `a:blip` — NOT the a14 imgEffect extension. **The earlier "grayscale needs a14" deferral
> was a FALSE NEGATIVE from a 0-based enum misread:** `PictureFormat.ColorType==2` IS grayscale
> (MsoPictureColorType is **1-based**: Automatic=1, Grayscale=2, BlackAndWhite=3). A scope-workflow agent
> AUTHORED grayscale in live Word 16.0 via COM and extracted the bytes (plain a:grayscl); the fork converter
> ALREADY emits/parses it (decode-image-node-helpers.js:369). So the slice was just: `setImageGrayscale`
> bridge verb (insert.ts) + render the attr as CSS `filter:grayscale(100%)` (image.js renderDOM, single
> site) + Picture-Format Adjust>Color UI (commands.js H.imgColor + picture-tools-pm.js) — ZERO converter/a14
> work. **🔬 Word COM-validated** (validate-picteffect-win.ps1): exported pic → `InlineShapes(1).PictureFormat.ColorType==2`.
> `[4b]` ON/OFF + grayscale-with-rotate coexistence test (the image attrs' renderDOM styles CONCATENATE via
> Attribute.ts, not last-wins). /code-review ×1 clean.
> **LESSON (correction):** the old memory "grayscale-needs-a14 [deferred]" was WRONG — a:grayscl is
> Word-faithful; verify enum base (0 vs 1) before trusting a COM read. Authoring the construct IN Word and
> diffing the bytes is the definitive ground truth.
>
> **✅ ITEM 1 — PAGE-SETUP EXPORT — DONE (PR #126):** LAYOUT margins/size/orientation → body sectPr
> (COM-validated 36pt/1008/612/landscape). Fixed D6-dispatch block + dead `E()` throw; UI-flyout-click gate test.
>
> **NEXT — ITEM 3: headers/footers (4e).** Real header/footer constructs (currently deferred, area
> `header-footer` is D6-blocked). Scope-workflow first: how the fork models headers/footers (the
> super-converter header*.xml parts, sectPr headerReference/footerReference, the doc-section/story model),
> what bridge/insert verbs or sections-adapter support exists, the header/footer ENGINE_READY unblock, and
> the editing UX (header/footer edit region). Word COM-validate via `doc.Sections(1).Headers(wdHeaderFooterPrimary).Range.Text`.
> This is the BIGGEST item before the keystone — expect multi-part (edit region + export + COM). spawn_tasks
> (NOT this loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`,
> manualHyphenate `task_a4196ed8`. Branch off `main` (docs checkpoints on a branch + PR).

---

## 2026-06-16 (finish-all loop; ITEM 1 page-setup export DONE (PR #126))

> **Branch:** `main` (PR #126 merged `aedf0da`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 472 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **🧭 NEW USER DIRECTIVE (supersedes the v4/escalate decision):** "finish all of it, just working loop, do
> not stop, you can decide the order." So I'm building ALL the big steered Phase-4 items autonomously, my
> chosen order. See memory [[phase4-finish-all-directive]]. **ORDER:** ① page-setup export (DONE) →
> ② a14 picture effects (the deferred grayscale, real OOXML) → ③ 4e headers/footers → ④ frames-overlay
> keystone. Same cycle per item: scope (ultracode workflow) → implement → Word-COM validate → 3 gates →
> /code-review → merge → checkpoint → next. NOTE: these are FEATURES (not bounded oracle slices) — bigger,
> source-touching, higher-risk; use the scope-workflow + COM-validate discipline.
>
> **✅ ITEM 1 — PAGE-SETUP EXPORT — DONE (PR #126, real new feature):** LAYOUT margins/size/orientation
> now export to the body `sectPr` and render in Word (were VISUAL-ONLY + double-broken). Bridge verbs
> `dePageMargins`/`dePageSize` (design.ts, inches → `doc.sections.setPageMargins/setPageSetup`, adapter
> writes `w:pgMar`/`w:pgSz` + auto-swaps w/h on orient flip). **Word COM-validated** (validate-pagesetup-win.ps1):
> Narrow+Legal+Landscape → margins 36pt, PageWidth 1008, PageHeight 612, Orientation 1.
> **🔑 TWO BUGS FIXED to make it reachable (a scope-workflow found the mutation API already existed; /code-review
> found the wiring was dead):** (a) the cmds were **D6-blocked** at dispatch → added margins/orientation/size
> to `ENGINE_READY` (index.ts); (b) `setPageVar` called the **retired `E()=WC.Editor.repaginate()`** which
> THREW before the bridge call → use guarded `WC.PM.__repaginate()`; dropped dead `E().pageH`/`E().repaginate()`.
> New `[10th]` bridge-export test + a `[10th]` **UI test that drives the real flyout click** (guards the
> wiring class of bug). Repointed `[0a]`/`[11]` D6-block probes off the now-unblocked `margins` → `columns`.
> **LESSON:** a CSS-only ribbon feature can be triple-gated (blocked dispatch + dead legacy E() + no export);
> always drive the REAL UI path in a probe, not just the bridge verb.
>
> **🆕 spawn_task `task_a4196ed8`:** dead `E()` in `manualHyphenate` (commands.js:857-861) + sibling
> layout-arrange handlers (WC.Layout.*) — latent behind still-blocked cmds; fix when unblocking them.
>
> **NEXT — ITEM 2: a14 picture effects.** Resume the reverted slice-#2 grayscale with the REAL Word OOXML
> (the `a14`/`a:effectLst`/compat extension Word actually authors — NOT `a:grayscl`, which COM read as
> wrong). Scope-workflow first: find the image/pict export path, how picture effects are modeled, and
> author a Word-native grayscale to diff the correct OOXML. COM-validate `InlineShapes`/`Shapes`
> picture-format. spawn_tasks (NOT this loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`,
> mixed-list `task_eb50ae00`, manualHyphenate `task_a4196ed8`. Branch off `main` (docs checkpoints on a branch + PR).

---

## 2026-06-16 (v4 #5 page color DONE (PR #124); design backlog EXHAUSTED → page-setup geometry OR ESCALATE)

> **Branch:** `main` (PR #124 merged `e325b9a`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 470 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **✅ v4 #5 PAGE COLOR — Word-COM-validated CORRECT (PR #124, NO source bug):** new oracle
> (`oracle-probe-pagecolor.js` + `validate-pagecolor-win.ps1`). **Contrary to expectation, page-background
> COM read CLEANLY:** `doc.Background.Fill.ForeColor.RGB=65535` (yellow), `Fill.Type=1` (solid),
> `ActiveWindow.View.DisplayBackgrounds=true`. New `[10th]` test gates BOTH document.xml `<w:background
> w:color>` AND settings.xml `<w:displayBackgroundShape/>` — the K4 render flag the existing test MISSED
> (without it Word shows a WHITE page despite the byte being present; endnote-class blind spot). Non-vacuous
> via clear-first + distinct color 00FFFF + `finally{}` teardown. `/code-review`: softened the now-inaccurate
> "KNOWN UNRELIABLE" framing; clarified getUpdatedDocs = modified parts (authoritative here).
>
> **📊 v4 COMPLETE / VERDICT — design+references bounded surface EXHAUSTED:** 5 slices: #1 endnote
> (FOUND+FIXED a real data-loss bug), #2 comments / #3 paraspacing / #4 pageBorders / #5 pageColor (all
> CONFIRM-CORRECT + a stronger gate). **The bounded, cleanly-COM-validatable export surface is now largely
> covered and faithful.** The endnote bug was the payoff; the rest built the COM-oracle net.
>
> **🗂️ WHAT'S LEFT (re-ranked) — two honest paths:**
>   - **PATH A (bounded, autonomous): PAGE-SETUP GEOMETRY (v4 #6).** FRESH area, CLEAN reliable COM
>     (`Section.PageSetup.TopMargin/.PageWidth/.PageHeight/.Orientation`). ⚠️ FIRST verify a bridge verb
>     exists to MUTATE margins/size/orientation (LAYOUT tab) — grep `bridge/layout.ts` / commands.js for
>     pageSetup/margins/orientation. If a mutate verb exists → probe + `validate-pagesetup-win.ps1`
>     (px/in→twips: 1in=1440). If NOT wired → it's a feature, not a bounded test slice → flag + pivot.
>   - **Low-value remainder (SKIP unless asked):** TOC entries / caption SEQ / citation CITATION export COM
>     — these are DEGRADED-BY-DESIGN (TOC page numbers are "0" placeholder; SEQ/CITATION resolve on Word
>     F9/open), so a COM gate would be flaky/low-signal. Do NOT manufacture a flaky gate here.
>   - **PATH B (RECOMMENDED — STEERED, needs user):** a14 picture effects / FRAMES-OVERLAY keystone /
>     4e headers-footers / highlight-picker UX. These are the high-impact remaining work but are multi-PR
>     and need the user's steer. **I have recommended escalation in chat repeatedly; user keeps firing the
>     autonomous loop without naming one → default continues.**
>
> **NEXT — try PATH A (page-setup geometry) IF a mutate bridge verb exists; else flag it's a feature and
> STRONGLY recommend the user pick a PATH B item.** spawn_tasks (NOT loop): 2+-table `task_0e043993`,
> CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main` (docs checkpoints on a branch + PR).

---

## 2026-06-16 (v4 #4 page borders Word-COM-validated CORRECT (PR #122); next = #5 pageColor (low COM))

> **Branch:** `main` (PR #122 merged `4f2caf3`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 469 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **✅ v4 #4 PAGE BORDERS — Word-COM-validated CORRECT (PR #122, NO source bug):** Design page-border
> surface got its FIRST Word-COM oracle (`oracle-probe-pageborders.js` + `validate-pageborders-win.ps1`,
> reads ALL FOUR edges). `dePageBorders({style:'solid',color:'#FF0000',width:3})` → Word reads
> `Sections(1).Borders.Enable=true`, all edges `LineStyle=1` (single), `LineWidth=24` (wdLineWidth300pt=3pt),
> `Color=255` (red). Export faithful — no fix. New `[10th]` test gates specific val/sz/color on all 4 edges
> + `finally{}` teardown (`dePageBordersRemove`, page borders are global section state). `/code-review`
> hardened the validator to all-4-edges (was top-only) so an asymmetric export can't pass silently.
>
> **📊 v4 PATTERN / DIMINISHING RETURNS:** of 4 v4 slices, #1 endnote found a REAL bug (data loss); #2–#4
> (comments, paraspacing, pageBorders) all came back CORRECT — we are now mostly in **coverage-building
> mode** (adding committed Word-COM oracles + stronger gates to the export surface for the CUA eval net),
> not bug-finding. Still valuable, but the bounded export surface is largely faithful. **Consider ESCALATING
> to a STEERED bigger item soon** (see below) rather than more confirm-correct slices.
>
> **🗂️ SCOUT BACKLOG v4 — progress:**
>   - ✅ #1 Footnote+Endnote (PR #116, FOUND+FIXED endnote drop) · ✅ #2 Comments (PR #118 correct) ·
>     ✅ #3 paragraphSpacing (PR #120 correct) · ✅ #4 pageBorders (PR #122 correct).
>   - **#5 pageColor** (`dePageColor` design.ts:201 → `w:background w:color`). **LOW COM confidence:**
>     `doc.Background.Fill.ForeColor.RGB` / page-fill reads are unreliable via COM; the byte test
>     (`[10th]` dePageColor) already checks `<w:background w:color>`. **Plan: probe + attempt COM read;
>     if COM is unreliable, FLAG byte-only-acceptable, keep the byte test, SKIP a COM gate (honest).** ← NEXT.
>   - Then (more complex, re-rank): TOC/caption/citation export COM (refInsertTOC :114 / refInsertCaption
>     :300 / refAddSource :518), track-changes insert (riskier COM).
>
> **NEXT — ship #5 pageColor (probe + honest COM-or-byte-only verdict).** Then strongly consider ESCALATING.
> spawn_tasks (NOT loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`.
> Branch off `main` (docs checkpoints on a branch + PR too). **Bigger STEERED items still pending the user:**
> a14 picture effects / FRAMES-OVERLAY keystone / 4e headers-footers / highlight-picker UX. Default to v4
> unless the user names one.

---

## 2026-06-16 (v4 #3 paragraph spacing Word-COM-validated CORRECT (PR #120); next = pageBorders)

> **Branch:** `main` (PR #120 merged `76bec23`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 468 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **✅ v4 #3 PARAGRAPH SPACING — Word-COM-validated CORRECT (PR #120, NO source bug):** Design tab got its
> FIRST Word-COM oracle (`scripts/oracle-probe-paraspacing.js` + `scripts/oracle/validate-paraspacing-win.ps1`).
> `deParagraphSpacing({before:12,after:18,line:3})` → Word reads `Paragraphs.Item(1).SpaceBefore=12`,
> `.SpaceAfter=18`, `.LineSpacing=36`, `.LineSpacingRule=5` (wdLineSpaceMultiple). Export faithful — no fix.
> New `[10th]` regression test gates the FULL resolution chain (docDefaults before+after+line + the Normal
> style write) — closes the byte-only-docDefaults blind spot.
> **⚠️ TWO LESSONS this slice:**
>   1. **Test pollution:** `deParagraphSpacing` mutates the Normal style + docDefaults GLOBALLY (`setDoc`
>      resets only body text), so a non-zero `before` (12pt=16px) leaked a top-margin into the later `[4a]`
>      phantom-margin test → added a `finally{}` restoring `before:0`. **Global-style bridge verbs need a
>      teardown in their regression test.**
>   2. **/code-review caught a vacuous assertion:** the prior `[10th]` test leaves `line:2`→`480` in the
>      persisted docDefaults, so a `w:line="480"` check would pass even if THIS call dropped `line`. Fixed
>      by using a DISTINCT value (`line:3`→`720`). **When global state persists across tests, pick assertion
>      values the prior test does not leave.** (Also corrected validator enum comment + `$p`→`$para` shadowing.)
>
> **🗂️ SCOUT BACKLOG v4 — progress:**
>   - ✅ **#1 Footnote+Endnote (PR #116, FOUND+FIXED the endnote drop).**
>   - ✅ **#2 Comments export (PR #118, validated correct).**
>   - ✅ **#3 paragraphSpacing (PR #120, validated correct).**
>   - **#4 pageBorders** (`dePageBorders` design.ts:228; COM `Sections(1).Borders` — `.Item(wdBorderTop=-1)`
>     etc. `.LineStyle`/`.LineWidth`/`.Color`, or `Borders.Enable`). Existing byte test `[10th]` checks
>     `<w:pgBorders>` presence only. **← NEXT.**
>   - **#5 pageColor** (`dePageColor` design.ts:201 → `w:background`; LOW COM confidence — page background
>     reads poorly via COM, `doc.Background` is unreliable. **May be byte-only acceptable — flag + skip COM.**)
>   - Lower: TOC/caption/citation export COM (refInsertTOC :114 / refInsertCaption :300 / refAddSource :518),
>     track-changes insert (riskier COM). Re-rank if pageBorders/pageColor exhaust.
>
> **NEXT — continue v4: ship #4 (pageBorders export + COM).** Keep execute→test→COM-validate→/code-review→
> merge→checkpoint. spawn_tasks (NOT loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list
> `task_eb50ae00`. Branch off `main` (docs checkpoints on a branch + PR too). **Bigger STEERED items still
> pending the user:** a14 picture effects / FRAMES-OVERLAY keystone / 4e headers-footers / highlight-picker
> UX. Default to v4 re-scout unless the user names one.

---

## 2026-06-16 (v4 #2 comments export Word-COM-validated CORRECT (PR #118); next = #3 paragraphSpacing)

> **Branch:** `main` (PR #118 merged `8497efc`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 467 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **✅ v4 #2 COMMENTS EXPORT — Word-COM-validated CORRECT (PR #118, NO source bug):** review area got its
> FIRST Word-COM oracle (`scripts/oracle-probe-comments.js` + `scripts/oracle/validate-comments-win.ps1`).
> Word reads `doc.Comments.Count==1`, body "CommentBodyXYZ", author "Word User", **Scope "anchor" (exact
> anchored span)**. Comment export is faithful — no fix needed. New `[8]` regression test gates the FULL
> set (3 document.xml markers: rangeStart+rangeEnd+reference + `word/comments.xml` body + non-empty
> `w:author`) — closes the endnote-class blind spot (the old test only checked rangeStart+reference bytes).
> `/code-review` applied: validator emits a `<scope-error:…>` sentinel instead of silently swallowing a
> broken-anchor `Scope.Text` throw.
> **⚠️ NEAR-MISS LESSON:** an initial probe showed Scope `" ancho"` (off by one) — I almost "fixed" a
> non-bug in the shared Document API address layer. Root cause was the **PROBE's own `selectText`**
> (`paragraphPos+1+idx` — but the doc wraps blocks in a body node, so the first text node sits at pos 2;
> anchor off the TEXT NODE's own pos like `test-suite-pm.js` selectText `pos+i`). The COM oracle + a precise
> `textBetween`/node-layout probe caught it. **Always confirm the probe's own selection before blaming the engine.**
>
> **🗂️ SCOUT BACKLOG v4 — progress:**
>   - ✅ **#1 Footnote+Endnote export+COM — DONE (PR #116, found+fixed the endnote drop).**
>   - ✅ **#2 Comments export+COM — DONE (PR #118, validated correct).**
>   - **#3 paragraphSpacing** (design.ts:120 `deParagraphSpacing`; COM `Paragraphs.Item(1).SpaceAfter` /
>     `.SpaceBefore` clean float; px/pt→twips). Clone the probe+validator pattern. **← NEXT.**
>   - Then **pageBorders** (`Sections(1).Borders.Item(-3)` / wdBorderTop etc.), **pageColor** (low COM
>     confidence — `Background`/page-fill reads poorly via COM; may flag as "byte-only acceptable").
>   - Lower: TOC/caption/citation export COM (refInsertTOC :114 / refInsertCaption :300 / refAddSource :518),
>     track-changes insert (riskier COM). Re-rank if #3/pageBorders exhaust.
>
> **NEXT — continue v4: ship #3 (paragraphSpacing export + COM).** Keep execute→test→COM-validate→
> /code-review→merge→checkpoint. spawn_tasks (NOT loop): 2+-table `task_0e043993`, CUA vAlign
> `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main` (docs checkpoints on a branch + PR too).
> **Bigger STEERED items still pending the user:** a14 picture effects / FRAMES-OVERLAY keystone /
> 4e headers-footers / highlight-picker UX. Default to v4 re-scout unless the user names one.

---

## 2026-06-16 (v4 RE-SCOUT found+FIXED a REAL bug: endnote lost on export (PR #116))

> **Branch:** `main` (PR #116 merged `62f100f`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 466 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **🐞 REAL BUG FOUND + FIXED — endnotes were silently dropped on export (PR #116):** the v4 re-scout
> over the **references** area (its FIRST target) immediately paid off. The docx exporter node-router
> (`super-converter/exporter.js` → `exportSchemaToJson`) mapped `footnoteReference`→translator but had
> **NO `endnoteReference` entry**, so the endnote MARKER never reached `word/document.xml`. The body still
> landed in `word/endnotes.xml` (so the byte-only `[9]` body test + `test:roundtrip` stayed GREEN), but with
> no marker referencing it **Word read `doc.Endnotes.Count == 0` — the endnote was lost entirely.** Fix = one
> router line (+import), symmetric with footnote. **🔬 Word COM-validated (new `validate-notes-win.ps1`):
> before footnoteCount=1/endnoteCount=0 → after footnoteCount=1/endnoteCount=1, bodies "Footnote"/"Endnote".**
> Regression test: new `[9]` asserting `<w:endnoteReference>` in document.xml (red→green). `/code-review`
> clean (2 finders, 0 findings). **Textbook reinforcement of the lesson: exportXmlOnly + roundtrip both MISS
> this corruption class — only `Documents.Open` in real Word catches it.**
>
> **🆕 References area now has its FIRST Word-COM oracle:** `scripts/oracle-probe-notes.js` +
> `scripts/oracle/validate-notes-win.ps1` (footnote + endnote count/body). It had ZERO before.
>
> **🗂️ SCOUT BACKLOG v4 (re-scout, 3 parallel agents) — ranked, partly consumed:**
>   - ✅ **#1 Footnote+Endnote export+COM — DONE (PR #116, found a bug).**
>   - **#2 Comments export** (review.ts:296 `addComment`; COM `doc.Comments.Count==1`/`.Range.Text`/`.Author`).
>     Clone `oracle-probe-6-bookmark.js` + `validate-bookmark-win.ps1`. **← NEXT bounded candidate.**
>   - **#3 paragraphSpacing** (design.ts:120; COM `Paragraphs.Item(1).SpaceAfter` clean float), then
>     **pageBorders** (`Sections(1).Borders.Item(-3)`), **pageColor** (low COM confidence).
>   - Lower: TOC/caption/citation export COM (refInsertTOC :114 / refInsertCaption :300 / refAddSource :518),
>     track-changes insert (riskier COM). Re-rank if #2/#3 exhaust.
>
> **NEXT — continue v4: ship #2 (comments export + COM).** Then #3 (paragraphSpacing). Keep the
> execute→test→COM-validate→/code-review→merge→checkpoint cycle. spawn_tasks (NOT loop): 2+-table
> `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main`.
> **Bigger STEERED items still pending the user:** a14 picture effects / FRAMES-OVERLAY keystone /
> 4e headers-footers / highlight-picker UX (#3 v3). Default to v4 re-scout unless the user names one.

---

## 2026-06-16 (numbered-list export test DONE (PR #114); SCOUT BACKLOG v3 EXHAUSTED → RE-SCOUT v4 or ESCALATE)

> **Branch:** `main` (numbered-list test merged PR #114 `b59c3ba`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 465 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Numbered-list export test — DONE (PR #114):** v3 **#5**. Numbered list → `w:numPr` linked to a
> `numbering.xml` decimal abstractNum (level-0 numFmt="decimal"). **🔬 Word COM-validated:** read-para-props
> `listType "simple numbering"`, `listString "1."`. **Multilevel also Word-validated** (probe
> `oracle-probe-2-multilevel.js`): the from-scratch minted abstractNum renders as `outline numbering`/`"1.1."`.
> `/code-review` clean. ⚠️ **Deferred + noted:** a gated MULTILEVEL test (the in-app `increaseListIndent`
> level-transition put BOTH paras at ilvl 1 in the probe — lingering-selection caret quirk; NOT corruption;
> same list-toggle area as `task_eb50ae00` — verify/fix there).
>
> **🗂️ SCOUT BACKLOG v3 — EXHAUSTED.** Done: hyperlink (#100), bookmark (#102), char-format matrix 4a–4e
> (#104/#106/#108/#110/#112), bullet (#98) + numbered (#114) lists. Only **#3 highlight over-exposure**
> remains (REAL bug; fix = restrict picker to 15 ST_HighlightColor keywords — a UX judgment call, STEER).
>
> **📊 SESSION TALLY (~17 COM-validated export slices merged):** PRs #82,84,86,88,90,92,94,96,98,100,102,104,
> 106,108,110,112,114 + docs checkpoints. Gates PM 448→465. 1 real feature (cell margins). 3 real bugs
> found+flagged (mixed-list `task_eb50ae00`, grayscale-needs-a14 [deferred], 2+-table `task_0e043993`). A
> reusable `scripts/oracle/validate-*-win.ps1` family (~14) + `oracle-probe-*` pattern is established.
>
> **NEXT — the bounded export-test backlog is genuinely empty. Pick:**
>   A. **RE-SCOUT v4** over FRESH areas not yet covered: **references** (TOC/footnote/SEQ/CITATION export +
>      COM), **comments / track-changes** export, **section/page geometry** that's NOT Phase-7-deferred,
>      **document settings**, **remaining table props**. (The productive autonomous path — may find more bugs.)
>   B. **ESCALATE a bigger STEERED item** (multi-PR, needs the user): **a14 picture effects** (the deferred
>      grayscale), the **FRAMES-OVERLAY keystone**, **4e headers/footers**, or the **highlight-picker UX fix** (#3).
> **The user has been told (in chat) the bigger items need their steer; the loop keeps running, so default to
> RE-SCOUT v4 unless the user picks a big item.** spawn_tasks (NOT loop): 2+-table `task_0e043993`, CUA vAlign
> `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (sub/superscript export test DONE (PR #112); 🏁 CHAR-FORMAT MATRIX COMPLETE; next = #5 lists → RE-SCOUT v4 / ESCALATE)

> **Branch:** `main` (sub/sup test merged PR #112 `137e0cb`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 464 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Sub/superscript export test — DONE (PR #112):** char-format matrix **4e** (the last). Two paragraphs
> (sub/sup) → `<w:vertAlign w:val="subscript"|"superscript">`. **🔬 Word COM-validated:**
> `Paragraphs(1).Font.Subscript = -1`, `Paragraphs(2).Font.Superscript = -1`. `oracle-probe-1-vertalign.js`
> + reusable `validate-vertalign-win.ps1`. `/code-review` clean.
>
> **🏁 CHARACTER-FORMAT EXPORT+COM MATRIX COMPLETE:** underline-style (#104), font color (#106), font size
> (#108), font family (#110), sub/superscript (#112) — all 5 Word-COM-validated at the export boundary.
>
> **📊 SESSION TALLY (this /loop run):** ~15 Word-COM-validated export-regression slices merged (PRs #82,84,86,
> 88,90,92,94,96,98,100,102,104,106,108,110,112) spanning tables, paragraphs, lists, hyperlinks, bookmarks,
> and the full character-format set — plus 1 real feature (cell margins #84) and **3 real bugs found+flagged**
> (mixed-list `task_eb50ae00`, grayscale-needs-a14 [deferred], 2+-table `task_0e043993`). Gates PM 448→464.
> A reusable `scripts/oracle/validate-*-win.ps1` family (~13 validators) + `oracle-probe-*` pattern now exists.
>
> **🗂️ SCOUT BACKLOG v3 — nearly exhausted.** Remaining: **#3 highlight over-exposure** (REAL bug, fix is a
> UX judgment call — restrict picker to 15 ST_HighlightColor keywords; STEER with user) + **#5 numbered/
> multilevel list export+COM** (fold onto the lists harness; multilevel mints a from-scratch abstractNum — the
> higher-risk part; COM read-para-props listType/listString).
>
> **⚖️ DECISION POINT (surfaced to the user in chat):** the docx EXPORT surface is now broadly COM-hardened;
> marginal value of more test-only lock-ins is low. The high-leverage remaining work needs a STEERED session:
> **a14 picture effects** (the deferred grayscale path), the **FRAMES-OVERLAY keystone**, **4e headers/footers**.
>
> **NEXT:** #5 numbered/multilevel list export+COM (last clean bounded v3 item) → then **RE-SCOUT v4** (fresh
> areas: non-Phase-7-deferred section/page props, view/zoom, doc settings, remaining tables) OR escalate a
> bigger item per the user. spawn_tasks (NOT loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`,
> mixed-list `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (font-family (rFonts) export test DONE (PR #110); char-format matrix 4/5 done; next = 4e sub-sup → finish matrix)

> **Branch:** `main` (font-family test merged PR #110 `fde5e76`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 463 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Font-family (rFonts) export test — DONE (PR #110):** char-format matrix **4d**. `setFontFamily('Georgia')`
> → `<w:rFonts w:ascii="Georgia" w:hAnsi/eastAsia/cs>`, whole paragraph. **🔬 Word COM-validated:**
> `Font.Name = "Georgia"` (text-only range). `oracle-probe-1-fontname.js` + reusable `validate-fontname-win.ps1`.
> `/code-review` clean (reset paragraph emits no competing paragraph-mark rFonts; exportXmlOnly excludes styles.xml).
>
> **🗂️ SCOUT BACKLOG v3 (char-format matrix #4 — 4 of 5 done):**
>   Done: 1 hyperlink (#100), 2 bookmark (#102), 4a underline (#104), 4c color (#106), 4b size (#108), 4d rFonts (#110).
>   4e. **sub/superscript export+COM — RECOMMENDED NEXT (finishes the matrix).** `<w:vertAlign
>       w:val="subscript"|"superscript">`; COM `Font.Subscript`/`Font.Superscript` (bool -1/0). Apply each to
>       its own paragraph (two paras). Clean lock-in. Bridge: setMark textStyle {vertAlign} or toggleSub/Superscript.
>   3. **HIGHLIGHT over-exposure (REAL bug, UX-judgment fix — STEER, don't auto-change UX)** — non-keyword
>      swatches export as `w:shd` not `w:highlight` → Word `wdNoHighlight`. Restrict picker to 15 keywords.
>   5. **Numbered/multilevel list export+COM** — fold onto the lists harness.
>
> **NEXT:** 4e sub/superscript → FINISHES the char-format matrix. After that v3 has only #3 highlight
> (steer) + #5 lists → **RE-SCOUT v4** (fresh areas: section/page props that aren't Phase-7-deferred, tables
> remaining, view/zoom export, doc settings) OR **escalate a bigger item** (a14 picture effects / frames-overlay
> / 4e headers — STEERED session). Char-format COM lesson: whole-paragraph apply + text-only COM range.
> spawn_tasks (NOT loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (font-size export test DONE (PR #108); char-format matrix 4a/4b/4c done; next = 4d rFonts / 4e sub-sup)

> **Branch:** `main` (font-size test merged PR #108 `2307876`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 462 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Font-size export test — DONE (PR #108):** char-format matrix **4b**. `setFontSize('20pt')` → `<w:sz
> w:val="40">` (HALF-points; `\b` excludes `<w:szCs>`), whole paragraph. **🔬 Word COM-validated:**
> `Font.Size = 20` (text-only range) — the half-point ×2 conversion is correct. `oracle-probe-1-fontsize.js`
> + reusable `validate-fontsize-win.ps1`. `/code-review` clean (reviewer empirically confirmed `\b` excludes
> szCs; the `fontSize` mark maps only to `w:sz`).
>
> **🗂️ SCOUT BACKLOG v3 (char-format matrix #4 — 3 of 5 done):**
>   1. ~~Hyperlink~~ (#100). 2. ~~Bookmark~~ (#102). 4a. ~~Underline-style~~ (#104). 4c. ~~Font color~~ (#106).
>      4b. ~~Font size~~ **DONE (#108).**
>   3. **HIGHLIGHT over-exposure (REAL bug)** — non-keyword swatches export as `w:shd` not `w:highlight` →
>      Word `wdNoHighlight`. Fix = restrict picker to 15 ST_HighlightColor keywords (UX judgment — steer).
>   4d. **rFonts export+COM** — `<w:rFonts w:ascii="Georgia"..>`; COM `Font.Name`. Clean lock-in.
>   4e. **sub/superscript export+COM** — `<w:vertAlign w:val="subscript"|"superscript">`; COM
>       `Font.Subscript`/`Font.Superscript` (bool). Clean lock-in.
>   5. **Numbered/multilevel list export+COM** — fold onto the lists harness.
>
> **CHAR-FORMAT COM LESSON (reusable):** apply to a WHOLE paragraph + read a TEXT-ONLY COM range (exclude the
> pilcrow) — full Paragraphs(i).Range can read `wdUndefined`(9999999). Mirror validate-fontsize/color-win.ps1.
>
> **NEXT:** 4d rFonts (Font.Name) → 4e sub/superscript. After the matrix, only #3 highlight (UX-judgment bug,
> steer) + #5 lists remain in v3 → then RE-SCOUT v4 or escalate to a bigger item. #3 highlight + the bigger
> items (a14 picture effects / frames-overlay / 4e headers) need a STEERED session. spawn_tasks (NOT loop):
> 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (font-color export test DONE (PR #106); char-format matrix 4a+4c done; next = 4b size / 4d rFonts / 4e sub-sup)

> **Branch:** `main` (font-color test merged PR #106 `577bf07`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 461 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Font-color export test — DONE (PR #106):** char-format matrix **4c**. `setColor` → `<w:color
> w:val="FF0000">` (bare hex), applied to a whole paragraph. **🔬 Word COM-validated:** `Font.Color = 255`
> (RGB long for FF0000; BGR swap would be 16711680) — no swap. `oracle-probe-1-fontcolor.js` + reusable
> `validate-fontcolor-win.ps1` (reads a TEXT-ONLY range — excludes the pilcrow, per a `/code-review` note).
>
> **🗂️ SCOUT BACKLOG v3 (char-format matrix #4 in progress):**
>   1. ~~Hyperlink~~ (PR #100). 2. ~~Bookmark~~ (PR #102). 4a. ~~Underline-style~~ (PR #104). 4c. ~~Font color~~ **DONE (PR #106).**
>   3. **HIGHLIGHT over-exposure (REAL bug)** — non-keyword swatches export as `w:shd` not `w:highlight` →
>      Word `wdNoHighlight`. Fix = restrict picker to 15 ST_HighlightColor keywords (UX judgment — steer).
>   4b. **Font SIZE export+COM** — `w:sz` HALF-points (20pt→40); COM `Font.Size==20`. Clean, high-use, unit check.
>   4d. **rFonts export+COM** (`<w:rFonts w:ascii=..>`; COM `Font.Name`).  4e. **sub/superscript**
>       (`<w:vertAlign>`; COM `Font.Subscript`/`Superscript`). Clean lock-ins.
>   5. **Numbered/multilevel list export+COM** — fold onto the lists harness.
>
> **LESSON (carry forward for char-format COM checks):** apply formatting to a WHOLE paragraph AND read a
> TEXT-ONLY COM range (exclude the trailing pilcrow) — a full Paragraphs(i).Range can read `wdUndefined`
> (9999999) for a uniform-text color/format because the paragraph mark is unformatted.
>
> **NEXT:** 4b font size (clean half-point unit check) → 4d rFonts → 4e sub-sup. #3 highlight = real bug w/
> UX-judgment fix (steer). Bigger items (a14 picture effects / frames-overlay / 4e headers) need a STEERED
> session. spawn_tasks (NOT loop): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (underline-style export test DONE (PR #104); char-format matrix started; next = font size/color/rFonts/sub-sup)

> **Branch:** `main` (underline-style test merged PR #104 `dfa82fc`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 460 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Underline-style export test — DONE (PR #104):** started **scout-v3 #4** (char-format matrix) with the
> highest-fidelity-risk item. Drives the REAL underline menu (label → `UL_TYPE` map → setMark) across 5
> whole paragraphs; export emits `<w:u w:val>` in order [single,double,dotted,dash,wave]. **🔬 Word
> COM-validated:** `Paragraphs(i).Range.Font.Underline = [1,3,4,7,11]` (Single/Double/Dotted/Dash/Wavy) — the
> CSS→OOXML→Word chain (incl. Dashed→"dash", Wavy→"wave") is CORRECT, no bug. `oracle-probe-1-underline.js` +
> reusable `validate-underline-win.ps1`. `/code-review` caught 2 real test-quality issues (probe-vs-test
> doc-shape mismatch + the test bypassing the CSS map by feeding OOXML tokens) → both fixed (drive the menu +
> whole-paragraph underline).
>
> **🗂️ SCOUT BACKLOG v3 (updated — char-format matrix #4 in progress):**
>   1. ~~Hyperlink~~ (PR #100). 2. ~~Bookmark~~ (PR #102). 4a. ~~Underline-style~~ **DONE (PR #104).**
>   3. **HIGHLIGHT color over-exposure (REAL fidelity bug)** — non-keyword highlight swatches export as
>      `w:shd` not `w:highlight` → Word `wdNoHighlight`. Fix = restrict the picker to Word's 15
>      ST_HighlightColor keywords (UX change — judgment call; steer with user).
>   4b. **Font SIZE export+COM** — `w:sz` is HALF-points (20pt→w:sz=40); COM `Font.Size==20`. Catches a
>      half-point unit bug. Clean, high-use.
>   4c. **Font COLOR export+COM** — `<w:color w:val="FF0000">`; COM `Font.Color` RGB long = 255 (catches a
>      BGR/RGB swap). Clean, near-clone of validate-cellshading.
>   4d. **rFonts export+COM** (`<w:rFonts w:ascii=..>`; COM `Font.Name`) + 4e. **sub/superscript**
>      (`<w:vertAlign>`; COM `Font.Subscript`/`Superscript`). Clean lock-ins.
>   5. **Numbered/multilevel list export+COM** — fold onto the lists harness.
>
> **NEXT:** v3 #4b (font size — clean, high-use, half-point unit check) or #4c (font color — BGR-swap check).
> Then rFonts / sub-sup. #3 highlight is a real bug w/ a UX-judgment fix (steer). The bigger items (a14
> picture effects / frames-overlay / 4e headers) still need a STEERED focused session. spawn_tasks (NOT loop):
> 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (bookmark export test DONE (PR #102); scout-v3 #1+#2 shipped; next = #4 char-format matrix)

> **Branch:** `main` (bookmark test merged PR #102 `c3166eb`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 459 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Bookmark export test — DONE (PR #102):** took **scout-v3 #2**. `insertBookmark` was wired but
> export-untested. Added a `[6]` test: paired `<w:bookmarkStart w:name="spot1" w:id="N"/>` +
> `<w:bookmarkEnd w:id="N"/>` (same id) + `oracle-probe-6-bookmark.js` + reusable `validate-bookmark-win.ps1`.
> **🔬 Word COM-validated:** opens clean, `Bookmarks.Count=1`, `.Exists("spot1")=true`, `.Item("spot1").Name=
> "spot1"`. `/code-review` clean (no findings).
>
> **🗂️ SCOUT BACKLOG v3 (updated — pick next):**
>   1. ~~Hyperlink export+COM~~ **DONE (PR #100).**  2. ~~Bookmark export+COM~~ **DONE (PR #102).**
>   3. **HIGHLIGHT color over-exposure (REAL fidelity bug)** — non-keyword highlight swatches export as
>      `w:shd` not `w:highlight` → Word `wdNoHighlight`. Fix = restrict the picker to Word's 15
>      ST_HighlightColor keywords (a UX change — judgment call; consider steering with the user).
>   4. **Character-format export+COM matrix — RECOMMENDED NEXT.** A batch of clean lock-ins, each a near-clone
>      of validate-cellshading: **font color** (Font.Color RGB long, FF0000→255; catches BGR swap), **font
>      size** (w:sz is HALF-points: 20pt→w:sz=40; Font.Size==20), **rFonts** (Font.Name), **underline style**
>      (Font.Underline wdUnderline enum — the CSS→OOXML `dashed→dash`/`wavy→wave` mapping has a fidelity
>      RISK, most likely to catch a bug), **sub/superscript** (Font.Subscript/Superscript). Pick one per slice.
>   5. **Numbered/multilevel list export+COM** — fold onto the lists harness (multilevel mints abstractNum).
>
> **NEXT:** v3 #4 — start with **underline-style** (highest fidelity risk: CSS→OOXML enum map) or **font size**
> (half-points, very high-use). Then font color / rFonts / sub-sup as further clean lock-ins. #3 highlight is a
> real bug but its fix is a UX judgment call (restrict the picker) — flag for a steered decision. The bigger
> items (a14 picture effects / frames-overlay / 4e headers) still need a STEERED focused session. spawn_tasks
> (NOT loop work): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (hyperlink export test DONE (PR #100); scout-v3 #1 shipped; next = #2 bookmark / #4 char-format)

> **Branch:** `main` (hyperlink test merged PR #100 `6cd1647`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 458 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Hyperlink export test — DONE (PR #100):** took **scout-v3 #1**. `insertLink` was wired but export-untested.
> Added a `[6]` test: `<w:hyperlink r:id="rIdN">` + a matching External `<Relationship>` (Target=url,
> `TargetMode="External"`) in `word/_rels/document.xml.rels` + `oracle-probe-6-hyperlink.js` + reusable
> `validate-hyperlink-win.ps1`. **🔬 Word COM-validated:** opens clean, `Hyperlinks.Count=1`,
> `.Address="https://example.com/"`, `.TextToDisplay="click here"` — the External relationship resolves.
> `/code-review` clean (hardened the rels lookup to `.find('Relationships')`).
>
> **🗂️ SCOUT BACKLOG v3 (updated — pick next):**
>   1. ~~Hyperlink export+COM~~ **DONE (PR #100).**
>   2. **BOOKMARK export + COM (rec high) — RECOMMENDED NEXT.** `WC.PM.insertBookmark({name})` → paired
>      `<w:bookmarkStart w:name=.. w:id=..>`/`<w:bookmarkEnd>`. Needs a `validate-bookmark-win.ps1`
>      (`doc.Bookmarks.Count`/`.Exists(name)`/`.Item(name).Name`). Use a clean ASCII name (the bridge
>      collapses whitespace to `_`; Word rejects names with spaces/leading digits). Clean core feature.
>   3. **HIGHLIGHT color over-exposure (REAL fidelity bug)** — non-keyword highlight swatches export as
>      `w:shd` not `w:highlight` → Word `wdNoHighlight`. Fix = restrict the picker to Word's 15
>      ST_HighlightColor keywords (a UX change — judgment call; maybe steer with user).
>   4. **Character-format export+COM matrix** (font color/size half-points/rFonts/underline-style/sub-sup) —
>      clean lock-ins; underline-style + highlight carry the enum-mapping fidelity risk. A batch.
>   5. **Numbered/multilevel list export+COM** — fold onto the lists harness (multilevel mints abstractNum).
>
> **NEXT:** v3 #2 (bookmark — cleanest core feature, mirrors the hyperlink recipe) then #4 (char-format
> matrix). The bigger items (a14 picture effects / frames-overlay / 4e headers) still need a STEERED focused
> session. spawn_tasks (NOT loop work): 2+-table `task_0e043993`, CUA vAlign `task_c62b4d4c`, mixed-list
> `task_eb50ae00`. Branch off `main`.

---

## 2026-06-16 (bullet-list export test DONE (PR #98) via RE-SCOUT v3; found+flagged a real mixed-list BUG; v3 queue recorded)

> **Branch:** `main` (lists test merged PR #98 `b1b634d`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 457 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **#4-rPr SKIPPED (judgment):** the rPr order fix is low value (Word tolerates), its out-of-order path is
> the document-api/plan-engine `runProperties` bag (CUA-adjacent — near the reserved `task_c62b4d4c`), and
> it's not cleanly reproducible via the `test:pm` gate (normal PM marks export rPr in fixed order). Skipped
> to avoid low-value + reserved-task-adjacent work. Pivoted to RE-SCOUT v3.
>
> **RE-SCOUT v3 + bullet-list export test — DONE (PR #98):** 3 parallel agents scouted FRESH areas
> (character-format, lists/numbering, hyperlinks/bookmarks/images). Shipped the lists pick: a `[2]` test that
> a session-created BULLET list exports `w:numPr` linked through `word/numbering.xml` (`w:num`→`w:abstractNum`
> whose `w:ilvl="0"` level has `w:numFmt="bullet"`) — the full chain Word needs. **🔬 Word COM-validated**
> (read-para-props): isolated bullet → `listType "bullet"`/`"•"`, numbered → `"simple numbering"`/`"1."`. `/code-review` clean.
>
> **🐞 REAL BUG FOUND + FLAGGED (spawn_task `task_eb50ae00`):** a bullet paragraph followed by a numbered
> paragraph LOSES the bullet when the numbered list is applied (model: para1 listType null; COM: "no
> numbering", no marker). Reproduced robustly (`scripts/oracle-probe-2-mixedlist.js`; caret-by-text, not an
> artifact). Fix is in intricate fork list-toggle logic (regression risk to working list tests) → NOT a
> bounded loop slice → focused spawn_task. **The re-scout paid off — found a real common-scenario bug.**
>
> **🗂️ SCOUT BACKLOG v3 (from this re-scout — pick next):**
>   1. **HYPERLINK export + COM (rec high) — RECOMMENDED NEXT.** `WC.PM.insertLink` → `w:hyperlink`+r:id; no
>      COM test. Needs a small `read-hyperlinks` verb in word-oracle-win.ps1 (Hyperlinks.Count/.Address). Clean.
>   2. **BOOKMARK export + COM (rec high)** — `WC.PM.insertBookmark` → paired `w:bookmarkStart/End`; needs a
>      `read-bookmarks` verb (Bookmarks.Exists/.Name). Clean; can share a session with #1.
>   3. **HIGHLIGHT color over-exposure (rec, REAL fidelity bug)** — non-keyword highlight swatches export as
>      `w:shd` shading not `w:highlight` → Word reads `wdNoHighlight`. Fix = restrict the highlight picker to
>      Word's 15 ST_HighlightColor keywords (a UX change — judgment call, maybe steer with user).
>   4. **Character-format export+COM matrix** (font color/size half-points/rFonts/underline-style/sub-sup) —
>      a batch of clean lock-ins; underline-style + highlight have the enum-mapping fidelity risk.
>   5. **Numbered/multilevel list export+COM** — fold onto the lists harness (multilevel mints from-scratch abstractNum).
>
> **NEXT:** v3 #1 (hyperlink — cleanest core feature) or #2 (bookmark). Then the char-format matrix (#4). The
> bigger items (a14 picture effects / frames-overlay / 4e headers) still need a STEERED focused session.
> 2+-table corruption (`task_0e043993`), CUA vAlign (`task_c62b4d4c`), mixed-list (`task_eb50ae00`) = spawn_tasks. Branch off `main`.

---

## 2026-06-16 (distribute-columns geometry export test DONE (PR #96); scout-v2 ≈ done → #4 then RE-SCOUT v3)

> **Branch:** `main` (distribute test merged PR #96 `701a4a9`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 456 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Distribute-columns geometry export test — DONE (PR #96):** took **scout-v2 #5**. Added a `[6b]` test:
> start UNEVEN (widen col 0), assert the grid is uneven (non-vacuous precondition — proves the widen took
> effect), distribute, then `<w:tblGrid>` must emit 3 EQUAL `<w:gridCol>` + `oracle-probe-6b-distribute.js`
> + reusable `validate-distribute-win.ps1`. **🔬 Word COM-validated:** uneven [260,208,208]px → even
> [225,225,225]px → 3× `<w:gridCol w:w="3375">` → opens clean, `Columns.Width=[155.8,155.85,155.85]pt` (even;
> the ~13pt gap vs gridCol is Word subtracting cell margins). `/code-review` caught a VACUOUS assertion
> (equal-gridCol passes regardless of an uneven start) → fixed with the uneven-before precondition.
>
> **🗂️ SCOUT BACKLOG v2 — DONE except #4:** #1 gridSpan (PR #90), #2 para shading (PR #94), #3 para borders
> (PR #92), #5 distribute (PR #96) DONE. Remaining: **#4 OOXML child-ORDER sweep** (rPr/pPr/trPr/numPr/pBdr —
> production fix, but Word TOLERATES it → value = strict-consumer portability only; rPr highest-reachability).
>
> **📊 SESSION TALLY:** 6 consecutive Word-COM-validated export-regression slices shipped (PR #86 cell shading,
> #88 repeat-header, #90 gridSpan, #92 para border, #94 para shading, #96 distribute) + the earlier real fixes
> (PR #80 vAlign, #82 tcPr-order, #84 cell-margins). The docx EXPORT surface is now broadly COM-hardened. A
> reusable `scripts/oracle/validate-*-win.ps1` family + `oracle-probe-*` pattern is established for any feature.
>
> **NEXT (forward plan):**
>   1. **#4-rPr** (last v2 item) — add `RPR_XML_ORDER` to rpr-translator.js (mirror PR #77/#82), regression test
>      asserting rPr child order for a programmatically-mutated run. Bounded; pPr/trPr/numPr/pBdr as follow-ups.
>   2. **RE-SCOUT v3** — areas NOT yet scouted: **lists/numbering** (w:numPr/numbering.xml), **fields/references**
>      (TOC/SEQ/CITATION export), **hyperlinks/bookmarks** (w:hyperlink/bookmarkStart), **image remnants**
>      (change-picture, reset-size), **section geometry that is NOT Phase-7-deferred**. Build a v3 queue.
>   3. **ESCALATE (needs a steered focused session, NOT the 5-min loop):** a14 picture effects (deferred),
>      FRAMES-OVERLAY keystone, 4e headers/footers — multi-PR architectural. Surface to the user.
> 2+-table corruption (`task_0e043993`) + CUA vAlign (`task_c62b4d4c`) stay focused-session spawn_tasks. Branch off `main`.

---

## 2026-06-16 (paragraph shading export test DONE (PR #94); scout-v2 winding down → DECISION POINT)

> **Branch:** `main` (parashading test merged PR #94 `ce86522`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 455 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Paragraph shading export test — DONE (PR #94):** took **scout-v2 #2**. Added a `[2]` test: paragraph
> shading emits `<w:pPr><w:shd w:val="clear" w:fill="..." w:color="auto">` (guards the load-bearing
> `val="clear"` — Word only paints the fill when clear — + verbatim hex + full CT_Shd) +
> `oracle-probe-2-parashading.js` + reusable `validate-parashading-win.ps1`. **🔬 Word COM-validated:** red
> FF0000 → `Paragraphs(1).Shading.BackgroundPatternColor = 255` (no swap), opens clean. Test-only. `/code-review` clean.
>
> **🗂️ SCOUT BACKLOG v2 — nearly exhausted:** #1 gridSpan (PR #90), #2 para shading (PR #94), #3 para
> borders (PR #92) DONE. Remaining: **#5 distribute geometry** (table-layout, test-only, bounded) + **#4
> OOXML order sweep** (rPr/pPr/trPr/numPr — production fix, but Word TOLERATES it so value = strict-consumer
> portability only; rPr is highest-reachability).
>
> **⚖️ DECISION POINT (5 consecutive COM-validated export lock-ins shipped — all confirmed Word fidelity;
> marginal value now diminishing):** the bounded high-value backlog is essentially done. Options for the loop:
>   - **#5 distribute geometry** — last clearly-bounded table-LAYOUT test-only slice.
>   - **#4 order sweep (start with rPr)** — a PRODUCTION fix (change of pace from test-only); real
>     portability value for strict OOXML consumers (LibreOffice / OpenXML SDK validator / Google Docs import),
>     even though live Word tolerates it. Mirrors the proven PR #77/#82 recipe. Scope to rPr (1 translator +
>     test) as a bounded slice; pPr/trPr/numPr/pBdr as follow-ups.
>   - **RE-SCOUT** for fresh higher-value bounded candidates.
>   - **ESCALATE to a bigger focused item** — a14 picture effects (deferred), FRAMES-OVERLAY keystone, or 4e
>     headers/footers. These are MULTI-PR architectural work that fits a focused session better than the 5-min
>     autonomous loop (the project docs repeatedly say so) — best done when the user can steer.
>
> **NEXT (recommended):** #5 (bounded, on-topic) then #4-rPr (substantive portability fix); after that, RE-SCOUT
> or surface the escalate-to-bigger-item choice to the user. 2+-table corruption (`task_0e043993`) + CUA vAlign
> (`task_c62b4d4c`) stay focused-session spawn_tasks. Branch off `main`.

---

## 2026-06-16 (paragraph border export test DONE (PR #92); scout-v2 #3 shipped; next = #2/#5/#4)

> **Branch:** `main` (paraborder test merged PR #92 `dc86aca`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 454 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Paragraph bottom-border export test — DONE (PR #92):** took **scout-v2 #3**. Paragraph borders were
> wired (apply + DOM-paint tested) but had no export regression + the eighths→half-point unit mapping was
> unvalidated. Added a `[2]` test: a bottom border emits `<w:pBdr><w:bottom w:val="single" w:sz="4"
> w:color="auto" w:space="1">` (full Word-default CT_Border) + `oracle-probe-2-paraborder.js` + reusable
> `validate-paraborder-win.ps1`. **🔬 Word COM-validated:** opens clean, `Paragraphs(1).Borders(-3).LineStyle
> = 1` (single), `.LineWidth = 4` (wdLineWidth050pt = 0.5pt) — the `w:sz=4` eighths → 0.5pt mapping is
> CORRECT (no fidelity bug). Test-only. `/code-review` clean (applied the one note: also assert color/space).
>
> **🗂️ SCOUT BACKLOG v2 (updated — pick next):**
>   1. ~~Merged-cell gridSpan export~~ **DONE (PR #90).**
>   2. **Paragraph SHADING export + COM (rec 0.95) — RECOMMENDED NEXT.** Wired (commands.js ~1810,
>      `{val:'clear',fill}`), no COM-validated export test. Assert `<w:pPr><w:shd w:val="clear" w:fill="FF0000">`;
>      COM `Selection.ParagraphFormat.Shading.BackgroundPatternColor=255`. Mirror cell-shading (PR #86) +
>      paraborder (PR #92) recipe — reuse the validate-*-win.ps1 + oracle-probe pattern. Highest confidence.
>   3. ~~Paragraph borders export~~ **DONE (PR #92).**
>   4. **OOXML child-ORDER sweep: w:rPr / w:pPr / w:trPr / w:numPr** — spec-compliance (Word tolerates), mirrors
>      PR #77/#82; rPr highest-reachability; multi-file, lower real value. Proposed xmlOrder arrays in scout output.
>      NOTE: `w:pBdr` itself also lacks an xmlOrder (CT_PBdr: top,left,bottom,right,between,bar) — fold in if doing the sweep.
>   5. **distributeColumns/Rows geometry export tests (rec 0.7)** — table layout; assert even `<w:gridCol>`/
>      `<w:trHeight>` actually export. Bounded.
>   - **Bigger (defer):** line-spacing rule dropdown, special-indent (first-line/hanging) dropdown, Tabs dialog;
>     picture effects via a14 (deferred from the earlier session).
>
> **NEXT:** scout-v2 #2 (paragraph shading — recommended, highest confidence) or #5 (distribute geometry —
> table layout). After v2 is down to #4 (order sweep, low real value) + #5, consider re-scouting or tackling a
> bigger item. 2+-table corruption (`task_0e043993`) + CUA vAlign (`task_c62b4d4c`) stay spawn_tasks. Branch off `main`.

---

## 2026-06-16 (merged-cell gridSpan export test DONE (PR #90); scout-v2 #1 shipped; next = #2/#3)

> **Branch:** `main` (gridSpan test merged PR #90 `efdaf1e`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 453 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Merged-cell gridSpan export test — DONE (PR #90):** took **scout-v2 #1**. `tableMerge` (horizontal) was
> the only structural table edit with no export coverage. Added a `[6b]` test: a horizontal merge emits
> `<w:gridSpan w:val="2">` on the surviving cell AND `<w:tblGrid>` keeps all 3 `<w:gridCol>` (a gridSpan/grid
> mismatch is what makes Word repair-prompt) + `oracle-probe-6b-gridspan.js` + reusable
> `validate-gridspan-win.ps1`. **🔬 Word COM-validated:** the saved doc OPENS WITHOUT REPAIR, reads
> `Rows(1).Cells.Count=2` (merged) / `Rows(2)=3` — the Cells.Count read is a POSITIVE structural guard
> (a silent repair that dropped the merge would read 3). **No corruption** (the horizontal merge is valid
> OOXML — distinct from the reserved 2+-table corruption `task_0e043993`). Test-only. `/code-review` clean.
>
> **🗂️ SCOUT BACKLOG v2 (updated — pick next):**
>   1. ~~Merged-cell gridSpan export~~ **DONE (PR #90).**
>   2. **Paragraph SHADING export + COM (rec 0.95) — RECOMMENDED NEXT.** Wired (commands.js ~1810,
>      `{val:'clear',fill}`), no COM-validated export test. Assert `<w:pPr><w:shd w:val="clear" w:fill="FF0000">`;
>      COM `Selection.ParagraphFormat.Shading.BackgroundPatternColor=255`. Mirror the cell-shading recipe (PR #86).
>   3. **Paragraph BORDERS export + COM (rec 0.93)** — wired (commands.js ~207), no COM test. The eighths→
>      half-point (`w:sz=4` → 0.5pt) mapping is a real fidelity risk. COM `ParagraphFormat.Borders(...).LineStyle/LineWidth`.
>   4. **OOXML child-ORDER sweep: w:rPr / w:pPr / w:trPr / w:numPr** — spec-compliance (Word tolerates), mirrors
>      PR #77/#82; rPr highest-reachability; multi-file, lower real value. Proposed xmlOrder arrays in the scout output.
>   5. **distributeColumns/Rows geometry export tests (rec 0.7)** — assert even `<w:gridCol>`/`<w:trHeight>` export.
>   - **Bigger (defer):** line-spacing rule dropdown, special-indent (first-line/hanging) dropdown, Tabs dialog;
>     picture effects via a14 (deferred #2 from the earlier session).
>
> **NEXT:** scout-v2 #2 (paragraph shading export+COM — highest confidence, mirrors PR #86) or #3 (paragraph
> borders — has a real unit-mapping risk). The 2+-table corruption (`task_0e043993`) + CUA vAlign
> (`task_c62b4d4c`) stay focused-session spawn_tasks. Branch off `main`.

---

## 2026-06-16 (Repeat Header Row export test DONE (PR #88) via RE-SCOUT; fresh SCOUT BACKLOG v2 recorded)

> **Branch:** `main` (repeat-header test merged PR #88 `478c8a4`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 452 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Re-scout + Repeat Header Row export test — DONE (PR #88):** the recorded backlog was exhausted, so this
> iteration RE-SCOUTED (4 parallel agents over CSS↔OOXML mapping bugs / table export gaps / latent
> OOXML-order / paragraph-layout export gaps) and shipped the top layout-relevant pick. "Repeat Header Row"
> (`tableToggleHeaderRow` → `tableRowProperties.repeatHeader` → `<w:tblHeader>`) is Word's "repeat as header
> row at the top of each page" pagination flag — wired but export-untested. Added a `[6b]` test (first row's
> `<w:trPr>` gets exactly one `<w:tblHeader>`; toggle-off clears it) + `oracle-probe-6b-repeatheader.js` +
> reusable `validate-repeatheader-win.ps1`. **🔬 Word COM-validated:** opens clean, `Rows(1).HeadingFormat
> = -1` (True), `Rows(2) = 0`. Test-only. `/code-review` clean (tightened a vacuous assertion → exact count).
>
> **🗂️ SCOUT BACKLOG v2 (from this re-scout — ranked; pick next):**
>   1. **Merged-cell `w:gridSpan` export + COM (rec 0.85)** — `tableMerge` (horizontal) is the only structural
>      table edit with NO export test; assert `<w:gridSpan w:val="2">` + Word opens-without-repair. Bounded.
>      (Vertical `w:vMerge` is a separate, bigger item — may surface a real continueMerge covered-cell bug.)
>   2. **Paragraph SHADING export + COM (rec 0.95)** — wired (commands.js ~1810, `{val:'clear',fill}`), no
>      COM-validated export test. Assert `<w:pPr><w:shd w:val="clear" w:fill="FF0000">`; COM
>      `Selection.ParagraphFormat.Shading.BackgroundPatternColor=255`. Mirror the cell-shading recipe (PR #86).
>      (Design/paragraph, not strictly layout-engine — but bounded + high-confidence.)
>   3. **Paragraph BORDERS export + COM (rec 0.93)** — wired (commands.js ~207), no COM test. The
>      eighths-of-a-point → Word half-point (`w:sz=4` → 0.5pt) mapping is a real fidelity risk. COM
>      `ParagraphFormat.Borders(wdBorderBottom).LineStyle/LineWidth`. Slightly bigger (unit assert).
>   4. **OOXML child-ORDER sweep: w:rPr / w:pPr / w:trPr / w:numPr (mirror PR #77/#82)** — none pass an
>      `xmlOrder`; `rPr` is the HIGHEST-reachability (every char-format toggle on pre-formatted text exports
>      out-of-order children), `pPr` (list-toggle on indented paras), `trPr` (cantSplit+trHeight). **Word
>      TOLERATES these on read (spec-compliance only, NOT a crash — per the tcPr finding), so lower real
>      value; multi-file.** Proposed xmlOrder arrays are in the scout output (CT_RPrBase/CT_PPrBase/CT_TrPrBase).
>   5. **distributeColumns/Rows geometry export tests (rec 0.7)** — model-tested only; assert the even
>      `<w:gridCol>`/`<w:trHeight>` actually export. Table layout, bounded.
>   - **Bigger (need UI wiring, defer):** line-spacing rule dropdown (atLeast/exactly), special-indent
>     (first-line/hanging) dropdown, Tabs dialog — each a real Word feature with export-ready translators but
>     no UI to SET it. Also: **picture effects via the a14 extension** (the deferred #2).
>
> **NEXT:** scout-v2 #1 (merged-cell gridSpan — most layout-relevant + may catch corruption) or #2/#3
> (paragraph shading/borders — highest confidence). The 2+-table corruption (`task_0e043993`) + CUA vAlign
> (`task_c62b4d4c`) stay focused-session spawn_tasks. Branch off `main`.

---

## 2026-06-16 (cell-shading export test DONE (PR #86); SCOUT BACKLOG EXHAUSTED; #2 picture-effects deferred (needs a14))

> **Branch:** `main` (cell-shading test merged PR #86 `7587365`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 451 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Cell shading export test — DONE (PR #86):** took scout-backlog **#4**. Cell shading was wired + worked
> but had no EXPORT regression. Added a `[6b]` test (caret-cell shade → `<w:shd w:fill="FF0000">`, hex
> verbatim) + `oracle-probe-6b-cellshading.js` + reusable `scripts/oracle/validate-cellshading-win.ps1`.
> **🔬 Word COM-validated:** a pure-red FF0000 fill opens clean + reads `Cells(1).Shading.
> BackgroundPatternColor = 255` (no BGR/RGB swap). Test-only (no production change). `/code-review` clean.
>
> **⚠️ Picture effects (scout #2) — INVESTIGATED + DEFERRED (key finding):** built a full grayscale slice
> (render `filter: grayscale(1)` + `setImageColorAdjust` bridge + Picture Format → Adjust → Color UI) on
> the fork's existing a:grayscl import/export. **But Word COM revealed it's NOT faithful: live Word
> represents grayscale recolor via the a14 (Office 2010) drawing extension, NOT `<a:grayscl>`.** Authoring a
> Word-native grayscale (`PictureFormat.ColorType=1`) writes a14 (no `a:grayscl`); and Word reads OUR
> `a:grayscl` back as `ColorType=2` (BlackAndWhite), not 1 (Grayscale). a:grayscl IS valid OOXML Word renders
> as grayscale, but it doesn't match Word's representation and the COM oracle can't confirm it. **REVERTED
> the whole slice (never committed; was on the main working tree, discarded).** True picture-recolor fidelity
> needs **a14 imgEffect import/export** — a bigger fork change, NOT a bounded slice. **LESSON re-confirmed:
> COM-validate before shipping (the env mandate) — it caught a non-faithful representation pre-merge.**
>
> **🗂️ SCOUT BACKLOG — EXHAUSTED.** All 5 recorded items resolved: #1 vAlign (PR #80), #3 cell margins
> (PR #84), #4 cell shading (PR #86), #5 tcPr order (PR #82) DONE; **#2 picture effects DEFERRED (needs a14).**
>
> **NEXT (the loop must RE-SCOUT or take a bigger item):** the recorded bounded backlog is empty. Options:
>   1. **RE-SCOUT** — run a fresh parallel-scout pass (like the one that built this backlog) over wired-but-
>      untested / latent-bug table/image/layout features to find new bounded slices. Cheapest next loop step.
>   2. **Bigger Phase-4 items** (need focused work, not 5-min slices): the **FRAMES-OVERLAY keystone**
>      (deferrals §A.1b/d/e — line-split render, table row-split, faithful floating reposition + z-stacking),
>      **4e headers/footers**, or **picture effects via a14** (the deferred #2).
> The 2+-table corruption (`task_0e043993`) + CUA vAlign (`task_c62b4d4c`) stay focused-session spawn_tasks.
> Branch off `main`.

---

## 2026-06-16 (Table Cell Margins flyout DONE (PR #84, Word COM-validated); scout #3 shipped)

> **Branch:** `main` (cell-margins merged PR #84 `96681ff`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 450 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` (5-min cadence).**
>
> **Table Cell Margins flyout — DONE (PR #84):** took scout-backlog **#3**. The Table Layout → Alignment →
> **Cell Margins** control was a dead stub (`H.tblCellMargins` toasted "not implemented"); the bridge
> `tableSetCellMargins` + the `w:tcMar` export already worked, so only the UI was missing. `H.tblCellMargins`
> now opens an inches flyout (Top/Bottom/Left/Right spinners + Apply), px = round(in×96) → caret cell. A
> `/code-review` finding (re-edit clobbered untouched sides because the flyout seeded stock defaults) was
> fixed by a new **`tableGetCellMargins()`** bridge reader that PREFILLS the cell's current margins
> (Word's Cell Options behavior). Guard now checks `tableInfo().inTable`. 1 `[4d]` test (full ribbon path:
> open flyout → 4 distinct sides → Apply → assert px + `<w:tcMar>` twips → re-open asserts prefill) +
> `oracle-probe-4d-cellmargins.js` + reusable `scripts/oracle/validate-cellmargins-win.ps1`.
>
> **🔬 Word COM-validated:** a 0.5" all-sides margin opens CLEAN and reads `Cells(1).Top/Bottom/Left/
> RightPadding = 36pt` (= 720 twips) — exact. `/code-review high` (2 finders) + a follow-up adversarial
> re-review: clean. **Deferred:** Word's "Same as whole table" checkbox (inherit-vs-override); Apply always
> writes explicit per-cell margins. The fresh-cell `inlineKeys` export gate is unchanged (pre-existing).
>
> **🗂️ SCOUT BACKLOG (updated — pick next):**
>   1. ~~Cell vertical-align (rec 5)~~ **DONE (PR #80).**
>   2. **Picture effects: grayscale / brightness-contrast (rec 4.5) — RECOMMENDED NEXT (now the meatiest).**
>      Engine IMPORTS/EXPORTS (a:grayscl, a:lum in decode-image-node-helpers.js) but NOT rendered
>      (rendered:false) + NO bridge setter/UI. Bigger: render CSS filter + setImageColorAdjust bridge +
>      Picture Format→Adjust group + handlers. Oracle: InlineShape.PictureFormat.Brightness/Contrast/ColorType.
>   3. ~~Table cell margins (rec 4)~~ **DONE (PR #84).**
>   4. **Table cell shading (rec 4)** — wired + works, NO export test. Add a `[6b]` w:shd export test + oracle.
>      Smallest (test coverage only, no fix). Good quick win if #2 feels too big for one slice.
>   5. ~~tcBorders XML_ORDER (rec 2)~~ **DONE (PR #82).**
>
> **NEXT:** scout #2 (picture effects — bigger, the last meaty backlog item) or #4 (shading export test —
> smallest). After both, the recorded backlog is exhausted → re-scout or move to a bigger Phase-4 item
> (frames-overlay keystone / 4e headers-footers). 2+-table corruption (`task_0e043993`) + CUA vAlign
> (`task_c62b4d4c`) stay focused-session spawn_tasks. Branch off `main`.

---

## 2026-06-16 (w:tcPr child-order CT_TcPr fix DONE (PR #82); scout #5 RE-RANKED: Word TOLERATES tcPr reorder)

> **Branch:** `main` (tcPr-order fix merged PR #82 `6d42e34`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 449 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode `/loop` iteration.**
>
> **w:tcPr child-order fix — DONE (PR #82):** took scout-backlog **#5** (the `tcBorders`-missing-XML_ORDER
> item). `tcPr-translator.js` now passes a `TCPR_XML_ORDER` (CT_TcPr / ECMA-376 §17.4.66 sequence) into
> `createNestedPropertiesTranslator` so decoded cell-property children stable-sort to schema order on export
> — the exact mirror of the PR #77 `tblPr` fix. **Reproduced the out-of-order export:** a cell with
> borders+shading+vAlign exported `<w:tcBorders>` BEFORE `<w:tcW>` (the exporter migrates `attrs.borders` into
> `tableCellProperties` LAST — `translate-table-cell.js`). Pre-fix idx tcBorders=8 < tcW=164 (`schemaOrdered:
> false`); post-fix tcW(8) < tcBorders(41) < shd(197) < vAlign(222). 1 `[4d]` test (red pre-fix) +
> `scripts/oracle-probe-4d-tcorder.js` + a NEW reusable **`scripts/oracle/validate-open-win.ps1`** (PID-safe
> fresh-Word-COM open validator, alerts-as-errors). `/code-review high` clean (2 finders, zero findings).
>
> **🔬 KEY EMPIRICAL FINDING (re-ranks the backlog): live Word 16 TOLERATES the out-of-order `w:tcPr`.** The
> COM validator opened the PRE-FIX corrupt file CLEAN — `savedOnOpen=true` (no repair, identical to a
> Word-authored baseline), read `cellVAlign=1`/borders intact; a deliberately-broken control file is correctly
> rejected (validator is sensitive). So scout #5's "Word corrupt" hypothesis is **FALSE for tcPr** — this
> shipped as **OOXML spec-compliance + consistency with `w:tblPr`** (strict consumers — Open XML SDK validator,
> some LibreOffice paths — still reject out-of-sequence children), NOT a Word-crash fix. **LESSON re-confirmed:
> COM-validate before trusting a corruption hypothesis** (the env note's whole point). Whether Word is genuinely
> stricter on `tblPr` (PR #77) than `tcPr`, or PR #77's "rejected" was also a strict-consumer effect, is an open
> question — not re-litigated (PR #77 is shipped + harmless).
>
> **🗂️ SCOUT BACKLOG (updated — pick next):**
>   1. ~~Cell vertical-align (rec 5)~~ **DONE (PR #80).**
>   2. **Picture effects: grayscale / brightness-contrast (rec 4.5)** — engine imports/exports but NOT rendered
>      + NO bridge setter/UI. Bigger (render CSS filter + setImageColorAdjust + Picture Format→Adjust group).
>   3. **Table cell margins (rec 4) — RECOMMENDED NEXT.** `H.tblCellMargins` is a STUB (commands.js toast
>      "not implemented"); bridge `tableSetCellMargins` + export (w:tcMar) WORK. Wire the inches flyout (4
>      spinners) + test + oracle (Cells(1).TopPadding/LeftPadding...). Real feature, bounded.
>   4. **Table cell shading (rec 4)** — wired + works, NO export test. Add a `[6b]` w:shd export test + oracle.
>      Smallest (test coverage only, no fix).
>   5. ~~tcBorders XML_ORDER (rec 2)~~ **DONE (PR #82) — and the Word-tolerance finding above re-ranks its premise.**
>
> **NEXT:** scout #3 (cell margins — recommended; real bounded feature) or #2 (picture effects — bigger). The
> 2+-table corruption (`task_0e043993`) + CUA vAlign (`task_c62b4d4c`) stay focused-session spawn_tasks (NOT
> loop work). Branch off `main`.

---

## 2026-06-16 (table cell "Align Middle" w:vAlign fix DONE (PR #80, oracle-validated); scout backlog recorded)

> **Branch:** `main` (cell-vAlign fix merged PR #80 `7fdf431`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 448 / smoke 9 / roundtrip 27.** Word COM-validated. **Ultracode iteration.**
>
> **Table cell vertical-alignment fix — DONE (PR #80):** found via an ultracode parallel-SCOUT
> workflow (6 agents assessing wired-but-untested table/image features for latent Word-bugs). The
> "Align Middle" control set `verticalAlign="middle"` (correct CSS — the cell renderDOM emits
> `vertical-align: middle`) but passed it STRAIGHT to OOXML `w:vAlign/@w:val` — and "middle" is NOT a
> valid `ST_VerticalJc` value (enum: top|center|both|bottom) → **Word IGNORED it (cell not centered).**
> Mirror bug on import (`w:vAlign="center"` → invalid CSS `vertical-align: center`). FIX: map CSS
> `middle` ↔ OOXML `center` at both converter boundaries (`translate-table-cell.js` export +
> `legacy-handle-table-cell-node.js` import); model attr stays the CSS value. **Re-oracle: Word reads
> `Cells(1).VerticalAlignment = 1` (Center).** `/code-review` clean (core fix sound; round-trip byte-stable).
> 1 `[4d]` test + `scripts/oracle-probe-4d-cellvalign.js`. Review flagged the document-api/CUA adapters
> use the OOXML enum directly (pre-existing, separate layer) → **spawn_task `task_c62b4d4c`.**
>
> **🗂️ SCOUT BACKLOG (candidate bounded slices for next iterations — ranked, from the scout workflow):**
>   1. ~~Cell vertical-align (rec 5)~~ **DONE (PR #80).**
>   2. **Picture effects: grayscale / brightness-contrast (rec 4.5)** — engine IMPORTS/EXPORTS (a:grayscl,
>      a:lum in decode-image-node-helpers.js) but NOT rendered (rendered:false) + NO bridge setter/UI.
>      Bigger (render CSS filter + setImageColorAdjust bridge + Picture Format→Adjust group + handlers).
>      Oracle: InlineShape.PictureFormat.Brightness/Contrast/ColorType.
>   3. **Table cell margins (rec 4)** — `H.tblCellMargins` is a STUB (commands.js: toast "not implemented");
>      bridge `tableSetCellMargins` + export (w:tcMar) WORK. Wire the inches flyout (4 spinners) + test +
>      oracle (Cells(1).TopPadding/LeftPadding...). Bounded.
>   4. **Table cell shading (rec 4)** — wired + works, NO export test. Add a `[6b]` w:shd export test +
>      oracle (Cells(1).Shading.BackgroundPatternColor). Smallest.
>   5. **Table borders (rec 2, NOT bounded BUT latent corruption)** — `tcBorders` is MISSING its XML_ORDER
>      in tcPr-translator.js (the EXACT class of bug as the tblPr-order Word-corruption I fixed in PR #77!).
>      A cell with borders + other tcPr props may export out-of-CT_TcPr-order → Word corrupt. Adding the
>      tcBorders XML_ORDER (mirror the tblPr fix) could be a bounded high-value corruption-prevention slice.
>      Validate via Word-open (NOT just gates — roundtrip misses corruption).
>
> **NEXT:** pick from the scout backlog (#3 cell margins or #4 shading = smallest/cleanest; #5 tcBorders-order
> = highest corruption-prevention value). The 2+-table corruption (`task_0e043993`) + the CUA vAlign
> (`task_c62b4d4c`) stay as focused-session spawn_tasks (NOT loop work). Branch off `main`.

---

## 2026-06-16 (2+-table Word-corruption ROOT-CAUSED (not shipped; reverted, re-flagged); env blocked clean validation)

> **Branch:** `main` (clean; the fix was REVERTED, not merged). **Phase:** 4. Gates unchanged: **PM 447 /
> smoke 9 / roundtrip 27.** Investigation iteration — no PR this round.
>
> **Investigated the flagged "2+-table Word-corrupt export" bug. ROOT CAUSE FOUND + a fix confirmed
> at the structure level, but NOT shipped** (couldn't get a clean end-to-end Word-validation of the
> real save path before the environment broke; refused to ship an unvalidated docx fix per the lesson).
>
> **Root cause:** OOXML `CT_Tc` requires a table cell to END with a paragraph — a `w:tbl` may NOT be the
> last block of a `w:tc` or Word rejects the file as corrupt. The natural "insert table, then insert
> another table" NESTS the 2nd table in the 1st cell (caret stays in the cell, which is Word-correct),
> and the export omits the required trailing `<w:p/>`. (Single tables + two SIBLING tables — each
> followed by a `w:p` — already open fine; NOT a sibling-table bug.) **Confirmed by manual patch:** insert
> `<w:p/>` after the nested `</w:tbl>` in document.xml → rezip → Word OPENS it.
>
> **The fix (logic confirmed):** `translateTableCell` (`super-converter/v3/handlers/w/tc/helpers/
> translate-table-cell.js`) — when the cell's content ends with a `w:tbl`, append
> `{ name: 'w:p', type: 'element', elements: [] }` (the `type:'element'` is REQUIRED — a bare `{name:'w:p'}`
> is dropped by the serializer `#generateXml`). With it, `exportDocx({exportXmlOnly})` AND
> `exportDocx({getUpdatedDocs})['word/document.xml']` both gain the trailing p (`</w:tbl><w:p` count 1→2).
>
> **⚠️ THE BLOCKER (must resolve to ship):** early `exportDocxBytes()` (Blob) saves appeared to STILL lack
> the p, even though `getUpdatedDocs` (the SAME `updatedDocs` the Blob zips) HAS it and the DocxZipper code
> overrides `word/document.xml` with `updatedDocs`. Likely the no-p Blob results were stale-build/confounded,
> but I couldn't confirm — `saveBytes` started returning false mid-session (probably a hung headless WINWORD
> locking `C:\tmp` from my many COM `Documents.Open` calls). **Re-flagged via spawn_task `task_0e043993`** with
> the full repro + fix + the Blob/XML-divergence question.
>
> **KEY LESSON (re-confirmed HARD):** `exportDocx({exportXmlOnly})` and `test:roundtrip` (fork reopen) BOTH
> miss Word-corruption — a fix can FALSE-GREEN. Validate the REAL save path (`exportDocxBytes` → `saveBytes`
> → Word COM `Documents.Open`). Ensure no leftover WINWORD locks before validating.
>
> **NEXT:** (1) finish the 2+-table fix with a real Word-validated save (fresh env); (2) frames-overlay
> keystone; (3) 4e headers/footers. Branch off `main`.

---

## 2026-06-16 (Table positioning DONE (PR #77, NON-image): Indent + alignment + Word-corruption fix; multi-table-corruption bug FLAGGED)

> **Branch:** `main` (table positioning merged PR #77 `1fa57cd`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 447 / smoke 9 / roundtrip 27.** Word COM-validated.
>
> **Table page-positioning — DONE (PR #77, the first NON-image slice this session):** wired Word's
> Table Properties → **Indent** (the unwired `tableSetIndent` bridge verb → an inches flyout in the
> Table Design Alignment group) + added the missing **test coverage** for the existing-but-untested
> table **Alignment** (Align Left/Center/Right). **🔬 ORACLE CAUGHT A WORD-CORRUPTION BUG:** an
> aligned/indented table exported a `w:tblPr` with children in the WRONG ORDER (`w:jc`/`w:tblInd` AFTER
> `w:tblLook`), violating `CT_TblPrBase` (§17.4.60) → **Word rejected the file as corrupt.** Root cause:
> `decodeProperties` (fork) emits children in `tableProperties` key-insertion order, so a
> programmatically-added property lands after tblLook. Fix: `createNestedPropertiesTranslator` now takes
> an optional `xmlOrder`; `tblPr-translator` passes the CT_TblPrBase order + the decode stable-sorts to
> it (imported tables already in order → no-op, roundtrip byte-stable). **Re-oracle (single-table
> fixtures): centered table → Rows.Alignment=center(1); left+indent 0.5" → Rows(1).LeftIndent=36pt.**
> New `scripts/oracle-probe-4d-tablepos.js`. `/code-review` clean.
>
> **⚠️ SEPARATE BUG FLAGGED (spawn_task):** a doc with **2+ tables** exports Word-CORRUPT (reproduces
> with two PLAIN tables, no positioning) — a pre-existing base multi-table export bug that the fork-based
> `test:roundtrip` gate misses (it reopens via the fork, not Word). Needs its own fix + a Word-open or
> structural regression check.
>
> **NEXT — bigger items + the flagged bug:**
>   1. **Fix the 2+-table Word-corruption** (flagged; high-value — affects any multi-table doc).
>   2. **FRAMES-OVERLAY keystone** (deferrals §A.1b/d/e) — line-split render, table row-split, faithful
>      floating reposition render + z-stacking. Multi-PR architectural.
>   3. **4e headers/footers** (`header-footer` DEFERRED). Other bounded table/layout features (cell
>      margins, table borders/shading validation, column-balance).
> **LESSON re-confirmed:** the fork-based roundtrip gate does NOT catch Word-corruption — oracle-validate
> (Word COM open) any new docx-emitting feature. Branch off `main`.

---

## 2026-06-16 (Floating-image arrow-nudge DONE (PR #75); 4c.2 reposition now has numeric + keyboard affordances)

> **Branch:** `main` (nudge merged PR #75 `b87dbbd`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 445 / smoke 9 / roundtrip 27.**
>
> **Floating-image arrow-key nudge — DONE (PR #75):** Word's arrow-key nudge of a selected floating
> object, the second 4c.2 reposition affordance (alongside the numeric Position flyout). The
> `wcImageResize` PM plugin gained a `handleKeyDown` (`handleNudgeKeyDown`, `image-resize.ts`): a
> floating-image NodeSelection + arrow → `WC.PM.setImagePosition({±step, relative:true})` (plain=8px,
> Shift=1px), consuming the arrow (the picture is selected, not text). Bumped the extension priority
> 1→200 (> the keymap's 100) so the nudge `handleKeyDown` wins DETERMINISTICALLY (was relying on the
> keymap's arrow handlers bailing on a NodeSelection). `/code-review` + re-review clean (the priority
> reorder is side-effect-free — ImageResize adds no decorations/transactions). 1 `[4c]` test (cumulative
> +16px without re-select proves selection persists across nudges).
>
> **4c.2 reposition status: numeric Position flyout + arrow-key nudge both DONE** (session-inserted
> floating pictures; imported pictures refused — see below).
>
> **NEXT — still the bigger items + 4c.2 follow-ons:**
>   1. **FRAMES-OVERLAY keystone** (deferrals §A.1b/d/e) — line-split coords-safe render, table row-split,
>      faithful Square/Tight RENDER position + render z-stacking. Multi-PR architectural.
>   2. **4c.2 remaining:** a DRAG overlay (mirror the 4b resize overlay — needs preview + a move-region +
>      avoid clobbering the rotation transform); faithful reposition of IMPORTED floating pictures (patch
>      the preserved `wp:positionH/V` in `originalDrawingChildren` — fiddly merge-plumbing, currently refused).
>   3. **4e headers/footers + fields** (`header-footer` AREA DEFERRED).
> Branch off `main`. **NOTE:** the image area is now very deeply covered (Picture Format tab Word-complete
> + resize + crop + rotate + position + nudge). Consider whether the next high-value work is the keystone
> or a different subsystem.

---

## 2026-06-16 (Picture Position 4c.2 DONE + simplePos fix (PR #73); first keystone reposition step, oracle-validated)

> **Branch:** `main` (Position merged PR #73 `cc566cb`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 444 / smoke 9 / roundtrip 27.** Validation: Word COM read-shapes.
>
> **Picture absolute Position (4c.2) — DONE (PR #73):** the FIRST floating-object reposition step.
> `WC.PM.setImagePosition({horizontal,top,relative?})` (`bridge/insert.ts`) sets the selected floating
> picture's `marginOffset` (px; horizontal = right of column, top = below paragraph); the Picture Format
> → Arrange "Position" flyout (inches H/V) drives it. Render places a `wrap=None` picture at left/top
> from marginOffset; exporter writes `wp:positionH/V` → `wp:posOffset` (EMU). Guarded against silent
> save-drop on IMPORTED anchors (refused with a toast).
>
> **🔬 ORACLE CAUGHT A LATENT BUG (this is why we validate vs Word):** a 1"/0.5" positioned picture
> rendered in Word at Left/Top = **−1"/−1"**. Root cause: a GENERATED complex-positioned anchor still
> exported `wp:anchor/@simplePos="1"`, so Word used SIMPLE positioning (`wp:simplePos x=0/y=0` = page
> origin) and IGNORED positionH/V. **Latent since 4c.1** (harmless at offset {0,0}). Fix
> (`translate-anchor-node.js`): force `@simplePos="0"` when positionH/V are emitted
> (`!useOriginalChildren && anchorData`). **Re-oracle: Word reads Left=72pt / Top=36pt — exact.** New
> `scripts/oracle-probe-4c2-position.js` is the reusable fixture.
>
> **NEXT — still the big architectural items, plus 4c.2 follow-ons:**
>   1. **FRAMES-OVERLAY keystone** (deferrals §A.1b/d/e) — line-split coords-safe render, table row-split,
>      faithful Square/Tight RENDER position + render z-stacking. Multi-PR; reposition render spans ~10 branches.
>   2. **4c.2 follow-ons (bounded):** a DRAG overlay (mirror the 4b resize overlay; the numeric flyout is
>      the affordance now), + faithful reposition of IMPORTED floating pictures (patch the preserved
>      `wp:positionH/V` instead of refusing).
>   3. **4e headers/footers + fields** (`header-footer` AREA DEFERRED) — its own subsystem.
> Branch off `main`.

---

## 2026-06-16 (Picture Rotate/Flip DONE (PR #71); Picture Format tab is Word-complete; frames-overlay keystone / 4e headers next)

> **Branch:** `main` (Rotate/Flip merged PR #71 `6dd541c`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 443 / smoke 9 / roundtrip 27.**
>
> **Picture Rotate/Flip — DONE (PR #71):** wired Word's Picture Format → Arrange → Rotate (Rotate
> Right/Left 90° / Flip Vertical/Horizontal / Reset) onto the fork's ALREADY-COMPLETE `transformData`
> pipeline — the render applies `transform: rotate()/scaleX(-1)/scaleY(-1)`, the exporter writes
> `a:xfrm` rot/flipH/flipV, the importer reads them back. Only the UI + a bridge setter were missing
> (same "engine shipped, just unwired" shape as 4c.1 wrap / 4c.3 z-order). New `setImageTransform({rotate?,
> flipH?,flipV?,reset?})`: `rotate` is a relative delta normalized 0..359, flips toggle, transformData
> kept minimal. `H.imgRotate` = a Word-matching flyout. `/code-review` clean (no production bugs).
> 1 `[4b]` test.
>
> **🏁 The Picture Format tab is now Word-complete: Size (Crop / Height / Width / Lock Aspect) +
> Arrange (Wrap / Bring Forward / Send Backward / Rotate) + Accessibility (Alt Text).** Image features
> done: insert, drag+numeric resize, wrap/float, z-order, free-stretch, lock-aspect, alt-text, crop,
> rotate/flip — all ribbon-reachable + round-tripping.
>
> **NEXT — the remaining Phase-4 work is now genuinely the big architectural items:**
>   1. **The FRAMES-OVERLAY / paged-layout rework (THE KEYSTONE, deferrals §A.1b/d/e)** — unblocks
>      line-split coords-safe render, table row-split, faithful floating image/shape REPOSITION (4c.2)
>      + render z-stacking. **NOT a clean single-PR slice** — I checked the position render (image.js
>      ~385-660): floating-image left/top is spread across ~10 interacting branches (hRelativeFrom
>      page/margin/column, alignH, behindDoc, absolute-vs-float), so faithful reposition needs careful
>      oracle-iterated work, NOT an autonomous one-shot. Warrants a dedicated multi-PR push or user steer.
>   2. **4e headers/footers + fields** (`header-footer` AREA still DEFERRED) — its own subsystem; also
>      coupled to real multi-page sheets (Phase-7-gated) for a per-page editing region.
>   3. Tiny image remnants: Change Picture (needs a file-picker + media re-registration), Reset Size
>      (PNG-only natural-dim decode), a crop DRAG-overlay (vs the numeric flyout).
> Branch off `main`.

---

## 2026-06-16 (Picture Crop DONE (PR #69); fixed user-crop export gap; frames-overlay keystone / 4e headers next)

> **Branch:** `main` (Crop merged PR #69 `ce1b31e`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 442 / smoke 9 / roundtrip 27.**
>
> **Picture Crop — DONE (PR #69):** Word's Picture Format → Crop (manual Left/Top/Right/Bottom %) on
> the Picture Format tab's Size group, AND closed a real export-fidelity gap. The fork already
> IMPORTED `a:srcRect` → the `clipPath` attr (CSS inset; render clips + scales-to-fill the box) but
> the EXPORTER only re-emitted a stashed verbatim `rawSrcRect` — it never derived `a:srcRect` from a
> `clipPath`, so a USER crop was lost on save. New `buildSrcRectFromClipPath` (`decode-image-node-helpers.js`)
> is the exact inverse of the importer's `buildClipPathFromSrcRect` (inset T/R/B/L → srcRect l/t/r/b
> thousandths, zero edges omitted); blipFill now emits `rawSrcRect || derived` (imports stay byte-identical,
> user crops round-trip). Bridge `setImageCrop({l,t,r,b}|{remove})` clears rawSrcRect so the user crop
> wins. `H.imgCrop` = an L/T/R/B % flyout + Remove Crop. `/code-review` clean (verified no axis
> transposition across the full cycle + no roundtrip-gate regression). 1 `[4b]` test.
> **Harness note:** synthetic data-URL images don't re-materialize as a queryable node after `openDocx`
> in `test:pm` (real docx images round-trip fine — `test:roundtrip` covers them); the crop round-trip is
> asserted at the XML boundary (export → openDocx → re-export keeps the identical `a:srcRect`).
>
> **The Picture Format tab now has: Size (Crop / Height / Width / Lock Aspect Ratio) + Arrange
> (Wrap / Bring Forward / Send Backward) + Accessibility (Alt Text).** The image area is feature-rich.
> **NEXT — the remaining Phase-4 work each needs a FRESH, FOCUSED session:**
>   1. **The FRAMES-OVERLAY / paged-layout rework (THE KEYSTONE, deferrals §A.1b/d/e)** — unblocks
>      line-split coords-safe render, table row-split, faithful floating image/shape REPOSITION (4c.2)
>      + render z-stacking, AND the still-undefined `WC.Layout.*` Layout-tab cmds. Highest leverage.
>   2. **4e headers/footers + fields** (`header-footer` AREA still DEFERRED) — its own subsystem.
>   3. Tiny remaining image polish: Reset Size, Change Picture, a crop drag-overlay (vs the numeric flyout).
> Branch off `main`.

---

## 2026-06-16 (Picture Alt Text DONE (PR #67); IMAGE AREA COMPLETE; frames-overlay keystone is next, needs a FRESH session)

> **Branch:** `main` (Alt Text merged PR #67 `e27ec79`; branch deleted). **Phase:** 4 (layout engine).
> Gates: **PM 441 / smoke 9 / roundtrip 27.**
>
> **Picture Alt Text — DONE (PR #67):** Word's Picture Format → Alt Text pane on the Picture Format
> tab (new Accessibility group). New bridge verb `setImageAltText({title?,decorative?})`
> (`bridge/insert.ts`): the description is the node's `title` attr (→ `wp:docPr/@descr`); `decorative`
> sets the flag (→ `adec:decorative` ext) and clears the description (matching Word's pane). `H.imgAltText`
> is a flyout with a description textarea (prefilled) + "Mark as decorative" checkbox. `/code-review`
> clean — notably confirmed the description is XML-escaped by the exporter's `#replaceSpecialCharacters`,
> so special chars can't corrupt the docx. 1 `[4b]` test (descr round-trips; decorative omits @descr +
> emits the ext).
>
> **🏁 THE IMAGE AREA IS COMPLETE.** The Picture Format contextual tab now mirrors Word: **Size**
> (Height / Width / Lock Aspect Ratio) + **Arrange** (Wrap Text / Bring Forward / Send Backward) +
> **Accessibility** (Alt Text). Insert, resize (drag + numeric), wrap/float, z-order, free-stretch,
> dimensionless sizing, lock-aspect, alt-text — all faithful + ribbon-reachable + round-tripping.
>
> **This session ran THREE slices (PRs #63/#65/#67 + docs #64/#66) and is now EXTREMELY long.**
> **NEXT — the remaining Phase-4 work each needs a FRESH, FOCUSED session (do NOT start in a long one):**
>   1. **The FRAMES-OVERLAY / paged-layout rework (THE KEYSTONE, deferrals §A.1b/d/e)** — unblocks
>      line-split coords-safe render, table row-split (tall-table overflow reproduced), faithful
>      floating image/shape REPOSITION (4c.2) + render z-stacking, AND the still-undefined `WC.Layout.*`
>      Layout-tab Arrange cmds (position presets / align / group / rotate / selectionPane). Highest leverage.
>   2. **4e headers/footers + fields** (`header-footer` AREA still DEFERRED) — its own subsystem.
>   3. Smaller image polish: **Crop** (overlay + `a:srcRect` OOXML), Reset Size, Change Picture.
> Branch off `main`.

---

## 2026-06-16 (Picture Size group DONE (PR #65); Picture Format tab now has H/W + lock; frames-overlay is the keystone next)

> **Branch:** `main` (Picture Size group merged PR #65 `361fb53`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 440 / smoke 9 / roundtrip 27.**
>
> **Picture Size group — DONE (PR #65):** added Word's Picture Format → Size group (numeric Height +
> Width) to the Picture Format tab, wiring the ribbon onto the already-shipped image `size`-attr export
> path (the 4b resize overlay writes the SAME attr → `wp:extent`/`a:ext` EMU, oracle-proven in 4b). New
> bridge verb `setImageSize({width?,height?})` (`bridge/insert.ts`): honors the aspect lock (locked =
> Word default → the edited dim drives the other; pass both to diverge as the unlocked overlay does),
> clamps width to the content column AND both dims to the overlay's `MAX_DIM=4000` (re-deriving the
> partner when locked so a cap keeps the ratio). Generalized the table `tblSizeFly` helper → `sizeFly`
> (was never table-coupled) and reused it for `H.imgHeight`/`H.imgWidth`. `/code-review` clean; the
> MAX_DIM clamp (a review note) re-reviewed clean with a brute-force simulation. 1 `[4b]` test.
>
> **The Picture Format tab now mirrors Word's: Size (Height / Width / Lock Aspect Ratio) + Arrange
> (Wrap Text / Bring Forward / Send Backward).** The whole IMAGE area is faithful + ribbon-reachable.
> **NEXT — same keystone (deferrals §A.1b/d/e):**
>   1. **The FRAMES-OVERLAY / paged-layout rework** — unblocks line-split coords-safe render, table
>      row-split (tall-table overflow reproduced), AND faithful floating image/shape reposition (4c.2)
>      + render z-stacking. **Highest leverage; needs a focused/fresh session.**
>   2. **4e headers/footers + fields** (`header-footer` DEFERRED).
>   3. Smaller: extend the Picture Format tab further (crop / alt-text / picture-reset).
> Branch off `main`. **Session is EXTREMELY long — a fresh session is strongly recommended.**

---

## 2026-06-16 (Picture Format tab + Arrange un-block DONE (PR #63); image area fully wired to ribbon; frames-overlay is the keystone next)

> **Branch:** `main` (Picture Format tab merged PR #63 `c914f66`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 439 / smoke 9 / roundtrip 27.**
>
> **Picture Format contextual tab — DONE (PR #63, commit `4064a71`):** closes the last §A.1c gap (the
> in-app Lock-Aspect UI). New `src/renderer/public/js/picture-tools-pm.js` injects a "Picture Format"
> tab (mirrors `table-tools-pm.js`) shown on an image `NodeSelection`, hidden on deselect — **Size**
> group (Lock Aspect Ratio → `H.imgLockAspect` → `setImageLockAspect`) + **Arrange** group (Wrap Text /
> Bring Forward / Send Backward). `state-sync.ts` drives `WC.PictureToolsPM.syncContextualTab`.
>
> **Dead-control root-cause fix (PR #63, commit `4e13be8`) — caught by `/code-review`:** `wrapText` /
> `bringForward` / `sendBackward` were DEAD ON CLICK from the ribbon (new tab AND the existing Layout
> tab) — they dispatch through `isBlocked()` first and all map to the coarse `layout-arrange` AREA still
> in the Phase-7 `DEFERRED` set, so the ribbon toasted "not available" and never reached their already-
> shipped bridge verbs (`setImageWrap` = 4c.1, `setImageZOrder` = 4c.3). Fix: an **`ENGINE_READY`**
> allow-set in `bridge/index.ts` un-blocks exactly those three; the still-unimplemented `layout-arrange`
> cmds (`position` presets / `align` / `group` / `rotate` / `selectionPane` → undefined `WC.Layout.*`)
> STAY blocked. Per-command granularity, re-reviewed clean. 2 new `[4b]` tests.
>
> **The IMAGE area is now fully wired** (insert, resize, wrap/float, z-order, stretch, dimensionless
> sizing, lock-aspect — all reachable from the ribbon). **NEXT — same keystone as before (deferrals
> §A.1b/d/e):**
>   1. **The FRAMES-OVERLAY / paged-layout rework** — unblocks line-split coords-safe render, table
>      row-split (tall-table overflow reproduced), AND faithful floating image/shape reposition (4c.2)
>      + render z-stacking. **Highest leverage; needs a focused/fresh session.**
>   2. **4e headers/footers + fields** (currently `header-footer` DEFERRED).
>   3. Smaller: extend the Picture Format tab (crop + alt-text + a numeric size group).
> Branch off `main`. **Session is EXTREMELY long — a fresh session is strongly recommended.**

---

## 2026-06-16 (image free-stretch DONE (PR #61); image area complete; frames-overlay is the keystone next)

> **Branch:** `main` (free-stretch merged PR #61 `110347f`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 437 / smoke 9 / roundtrip 27.**
>
> **Image free-stretch (interaction half of §A.1c) — DONE (PR #61):** the resize overlay reads the
> image's `lockAspectRatio` (default true = Word's lock); when UNLOCKED, edge handles free-stretch one
> axis, corners distort (height clamped). Bridge `setImageLockAspect(bool)`. `/code-review` caught a
> REGRESSION (the importer set lockAspectRatio=false for `picLocks`-absent pictures → normal imported
> photos would free-stretch) — root-fixed: a picture without `a:picLocks` now imports as LOCKED (Word
> UI default; real Word writes `noChangeAspect="1"` so fixtures + roundtrip unaffected). Re-review +
> a stale-vendored-test fix. 3 `[4b]` tests. **STILL deferred (§A.1c):** the in-app Lock-Aspect-Ratio
> UI control — there is NO Picture Format ribbon group; a contextual tab to host it is the remaining piece.
>
> **The IMAGE area is now complete** (insert, resize, wrap/float, z-order, stretch, dimensionless sizing).
> **NEXT — the big remaining layout work all converges on ONE keystone (deferrals §A.1b/d/e):**
>   1. **The FRAMES-OVERLAY / paged-layout rework** — unblocks line-split coords-safe render, table
>      row-split (a tall table overflows the inter-sheet gap — reproduced), AND faithful floating
>      image/shape reposition (4c.2) + render z-stacking. **Highest leverage; needs a focused/fresh session.**
>   2. **4e headers/footers + fields** (currently blocked).
>   3. Smaller: a Picture Format contextual tab (would host the Lock-Aspect toggle + crop + alt-text + size).
> Branch off `main`. **Session is EXTREMELY long — a fresh session is strongly recommended.**

---

## 2026-06-16 (image stretch/render+export fix DONE; pagination + AutoFit trio + image-fidelity all solid)

> **Branch:** `main` (image fix merged PR #59 `cbb7725`; branch deleted). **Phase:** 4 (layout
> engine). Gates: **PM 434 / smoke 9 / roundtrip 27.**
>
> **Image stretch/divergent-box fix (PR #59) — render+export half of §A.1c CLOSED:** a picture whose
> stored box diverged from its intrinsic aspect (a stretched image, or one imported from Word) was
> aspect-forced in BOTH render (`height:auto`) and export (a legacy "scale to intrinsic PNG aspect"
> step collapsed a 240×60 box to 60×60). Fixed: the `size` renderDOM emits the literal height when both
> dims are stored; the exporter SKIPS the aspect-scaling when the model has an explicit box. `/code-review`
> caught a REGRESSION (honoring boxes exposed the bridge's 100×100 placeholder for dimensionless inserts
> — Insert→Screenshot — which the export aspect-correction used to mask, so screenshots would ship
> squashed). Root-fixed: the bridge `insertImage` now computes NATURAL dims (sync
> `readImageDimensionsFromDataUri`, clamped to the text column) instead of the placeholder. Re-review +
> hardening (single-dim honored, 0-px floor, padding-aware clamp). Oracle `read-shapes`: a 240×60 box →
> Word renders 180pt×45pt (stretched, not forced). 2 new `[4b]` tests. **STILL deferred (§A.1c):** the
> overlay EDGE-handle free-stretch UI + a Lock-Aspect-Ratio control (Word gates free-stretch on that
> checkbox) — the render/export now honor a divergent box, so this is just the interaction UI.
>
> **State of the layout engine:** pagination solid (caret bug fixed + exhaustively audited), AutoFit
> trio complete, image fidelity (resize + stretch + dimensionless sizing) solid. **NEXT (the big
> remaining pieces all need a focused/fresh session — deferrals §A.1b/d/e):**
>   1. **The FRAMES-OVERLAY / paged-layout rework** — the keystone that unblocks line-split coords-safe
>      render, table row-split (a tall table still overflows the gap — reproduced), AND faithful floating
>      image/shape reposition + render z-stacking. Highest leverage.
>   2. **4e headers/footers + fields** (currently blocked).
>   3. Smaller: the image free-stretch overlay UI + Lock-Aspect control (§A.1c interaction half).
> Branch off `main`. **Session is VERY long — a fresh session is strongly recommended.**

---

## 2026-06-16 (pagination caret fix + AutoFit Contents (4d.5) DONE; AutoFit trio complete)

> **Branch:** `main` (caret Fix A merged PR #54 `11909cd`; AutoFit Contents merged PR #56 `c70c1fb`;
> branches deleted). **Phase:** 4 (layout engine). Gates: **PM 432 / smoke 9 / roundtrip 27.**
>
> **This session (user `/loop` "keep going, fix the broken pagination + keep the cycle"):**
> 1. **Pagination caret bug — FIXED + thoroughly validated** (see the entry below + the
>    [[pagination-caret-rootcause]] memory). Root cause: forced/blank-page seams were block `<div>`s
>    injected at INLINE positions → corrupted PM `posAtCoords`. Fix A made them coords-safe
>    block-boundary seams. **Then audited pagination exhaustively via probes — ALL behaviors clean
>    post-fix:** auto-overflow (70 paras → break at line 45, matches the oracle), manual breaks, blank
>    pages, clicking at zoom 1.0/1.5/0.75, selecting across a break, typing-after-break, deleting a
>    break (model + re-paginate), export. `focus.ts` confirmed FINE (only clamps X; Fix A un-poisoned
>    posAtCoords). The line-split/mid-paragraph in-`<p>` spacer remains the one structural blemish but is
>    RARE (only a paragraph >1 page tall) + BENIGN (word round-trips clean; gap clicks land at the split)
>    — documented, deferred (a custom split-paragraph NodeView / frames-overlay).
> 2. **AutoFit Contents (Phase 4d.5) — DONE + MERGED** (PR #56 `c70c1fb`): completes the AutoFit trio
>    (Window + Fixed were 4d.4). The bridge (`tableAutoFit`) measures each column's content width by
>    reflowing the selected table's DOM at `table-layout:auto` (capped at the page text width, restore in
>    a `finally`), passes the widths to `autoFitTable`, which now UNIFIES window+contents into one
>    TableMap colwidth writer (the unify cleanup the 4d.4 review flagged). Oracle `read-table`: a 2-col
>    table (short "Hi" vs a long string) → Word renders 22.15pt + 332.25pt (short ≪ long; col 1 exact).
>    `/code-review high` → 2 actionable fixes (finally-restore + a stronger shrink assertion); rest refuted.
>
> **AutoFit trio COMPLETE** (Window/Fixed/Contents). **NEXT (pick one):**
>   1. **Table RELOCATE** (move handle + floating anchor — needs the frames-overlay) OR **row-split across
>      pages** (a table taller than a page still overflows; pagination + `splitTableAtRow` + repeat header
>      rows — oracle-validatable, complex).
>   2. **The FRAMES-OVERLAY** — would also unblock the line-split coords-safe rendering + image reposition.
>   3. **4e headers/footers + fields** (currently blocked).
> Branch off `main`. **Session is VERY long — a fresh session is strongly recommended.**

---

## 2026-06-16 (PAGINATION CARET BUG root-caused + primary fix merged; line-split rework remains)

> **Branch:** `main` (caret Fix A merged via PR #54 `11909cd`; branch deleted). **Phase:** 4 (layout
> engine) — a USER-REPORTED REGRESSION pass: "page breaks, blank pages break normal text-editor
> behavior + the mouse/caret location inside the page." Gates: **PM 431 / smoke 9 / roundtrip 27.**
>
> **What this session did (deep-research debugging, `/loop` redirected to fix pagination):**
> 1. **Root-caused** via a parallel research Workflow (PM-internals + Word behavior + history) + a
>    headless reproduction probe (`scripts/probe-pagination-caret.js`). THREE causes (full writeup in
>    the [[pagination-caret-rootcause]] memory + deferrals.md §A.1b): **(1) PRIMARY** — forced/blank-page
>    seams were a block `<div>` spacer injected at the INLINE hardBreak position INSIDE a paragraph's
>    inline flow; block-in-inline corrupts PM's `posAtCoords` hit-testing (the full-width tall spacer
>    rect becomes "closest" for any x) → clicking the next page mislands the caret. Probe proof:
>    `.pm-page-spacer` with a `<span>` parent + a page-2 margin click landing on a page-1 pos.
>    **(2)** `focus.ts` was suspected multi-page-unaware. **(3)** rAF height-keyed widget recreation.
> 2. **FIXED the PRIMARY, high-severity case (Fix A, PR #54):** forced breaks that END a block +
>    blank pages + section breaks now emit a coords-safe BLOCK-BOUNDARY seam before the next block
>    (`emitSeamBefore`/`trailingForcedCount`, pagination.ts) instead of an inline in-`<p>` spacer.
>    `trailingForcedCount` walks the block's inline LEAVES (the model wraps inline in `run` nodes) +
>    skips tables; a seam reports `pages` (band span) so the status bar weights, not counts. Probe:
>    blockInInline 1→0 (manual break), 2→0 (blank page). 2 new `[4a]` regressions (red before).
>    `/code-review high` + a re-review of the review-fixes → clean (doc-start guard, table guard, the
>    per-keystroke perf guard, a vacuous-test fix). Render-only → model/export unchanged → oracle page
>    counts preserved (geometry tests + roundtrip green).
> 3. **`focus.ts` CONFIRMED FINE post-Fix-A (cause 2 dismissed):** a repro probe showed a page-2 outer-
>    margin click lands correctly on page 2 — focus.ts only clamps X (keeps Y), and Fix A un-poisoned
>    `posAtCoords`, so the clamp maps to the right page-2 line. No focus.ts change needed.
> 4. **Line-split / mid-paragraph in-`<p>` spacer = the LOW-SEVERITY remainder (NOT fixed):** an auto
>    line-split (paragraph overflowing a page) + a mid-paragraph manual break still render a block
>    spacer inside inline flow. BUT probes show word round-trips stay clean (delta 0) — only clicks in
>    the NARROW GAP region of a split paragraph misland. Fixing it coords-safely is HARD/RISKY
>    (mid-paragraph vertical space inherently needs an in-flow box; no trivial fix — likely a custom
>    paragraph NodeView that splits its rendering, or the frames-overlay). Documented, deferred.
>
> **NEXT (pick one):**
>   1. **Line-split coords-safe rendering** (the remaining caret edge) — a focused/fresh session: design
>      a coords-safe mid-paragraph gap (custom split-paragraph NodeView OR overlay). LOW severity, so
>      lower priority than new features. Reproduce with a TRULY page-overflowing paragraph (≥50 lines;
>      short `w0 w1 …` tokens fit ~34 lines/page — use longer content).
>   2. **Resume the layout-engine feature roadmap** (the 4d.4 entry below): table RELOCATE / row-split /
>      AutoFit Contents; OR the FRAMES-OVERLAY (which would ALSO unblock the line-split fix); OR 4e
>      headers/footers.
> The user's PRIMARY complaint (page breaks + blank pages breaking the caret) is RESOLVED. Branch off
> `main`. **Session is VERY long — a fresh session is strongly recommended.**

---

## 2026-06-16 (RESUME HERE — Phase 4d.4 AutoFit Window/Fixed geometry DONE; table RELOCATE / row-split / frames-overlay / 4e next)

> **Branch:** `main` (4d.4 merged via PR #52 `627cfdf`; branch deleted). **Phase:** 4 (layout
> engine). DONE so far: 4a pagination, 4b image resize, 4c.1 wrap, 4c.3 z-order, 4d.1 column resize,
> 4d.2 row-height export, 4d.3 row/col size ribbon UI, **4d.4 AutoFit Window+Fixed geometry**. All
> oracle-validated. Gates: **PM 429 / smoke 9 / roundtrip 27.**
>
> **4d.4 done (PR #52):** AutoFit previously stored only the layout/width INTENT
> (`tableLayout`/`tblW`) — the column geometry AutoFit visibly produces was never applied, so
> **Window didn't actually fill the page** and **window→contents stayed stuck-stretched**. Now:
> `autoFitTable('window', targetWidthPx)` (fork `extensions/table/table.js`) **scales every column
> proportionally to fill** the page text-column width — writes each cell's `colwidth` (px) via the
> TableMap; the `tableColwidthGridSync` plugin rebuilds the twips `grid`, so the **in-app render AND
> the export** (`w:gridCol`/`w:tcW`) both fill (no Phase-7 paint needed). `'contents'` now also
> clears any prior Window stretch (was a no-op on `tableWidth`). The bridge (`tableAutoFit`,
> `bridge/table.ts`) computes the text width from `getPageStyles()` (`pageSize − L/R margins`)×96 and
> passes it down. **Oracle `read-table` (real Word 16):** Window 1:2 cols → **155.85pt + 311.65pt**
> (sum 467.5pt = 6.5" text column, ratio 2.0); Fixed 120/180px → **90pt + 135pt** preserved; both open
> WITHOUT repair. 4 `[4d]` regression tests (incl. a precondition guard against a vacuous even-split
> pass + the full ribbon flyout path). `/code-review` (high): **zero correctness findings**; 5
> cleanup/altitude findings (all "unify Window + `distributeColumnsEvenly` + `setCellWidth` into one
> `setColumnsToTotal(total, even|proportional)` primitive") **deferred** — they'd refactor existing
> tested commands (regression risk on a surgical slice); recorded in deferrals §A.1e.
>
> **AutoFit Contents** in-app column-to-content reflow stays a **layout-pass deferral** (needs
> Word-equivalent text metrics); its EXPORT intent (`tableLayout=autofit`, stretch cleared) is correct
> so Word content-fits the exported file on open.
>
> **NEXT — pick one** (deferrals.md §A.1d frames-overlay, §A.1e tables remaining):
>   1. **Table RELOCATE / row-split / AutoFit Contents** — the remaining 4d items. RELOCATE needs a
>      move handle (+ anchor for floating); row-split needs the pagination engine to split a table at
>      a row boundary (fork's `splitTableAtRow` + repeat header rows); AutoFit Contents needs the
>      content-measurement layout pass.
>   2. **The FRAMES-OVERLAY** (bigger 4c piece) — absolutely-positioned floating frames +
>      text-exclusion; unblocks faithful image reposition (4c.2) + render z-stacking + floating shapes.
>   3. **4e (headers/footers + fields)** — currently fully blocked (toast). High value.
> Branch off `main`. **NOTE the session is now VERY long** — a fresh session is strongly recommended.
>
> GOTCHAS for tables (carry forward): a bare `colwidth` write on a FRESH table does NOT survive to the
> export — set the table `grid` (twips) + `userEdited:true` + every cell `colwidth` together (what a
> real resize leaves; mirror the `[4d]` resize test). Caret won't stay in an HTML-`insertContent`ed
> table (use `insertTable`); synthetic full-drag doesn't drive PM pointer plugins headlessly;
> `read-table` reports col widths + row heights (auto rows = 9999999 pt); a default 2-col Letter table
> is 312px/col = 4680 twips (already fills the 6.5" text column).

---

## 2026-06-16 (Phase 4d.3 Row/Column size ribbon controls DONE; table RELOCATE / frames-overlay / 4e next)

> **Branch:** `main` (4d.3 merged via PR #50 `3c1b527`; branch deleted). **Phase:** 4 (layout
> engine). DONE so far: 4a pagination, 4b image resize, 4c.1 wrap, 4c.3 z-order, 4d.1 column resize,
> 4d.2 row-height export, **4d.3 row/column size ribbon UI**. All oracle-validated.
> Gates: **PM 425 / smoke 9 / roundtrip 27.**
>
> **4d.3 done (PR #50):** the row-resize UI affordance (deferred §A.1e) is now built — as the faithful
> Word **ribbon** controls rather than a drag overlay. Added **Row Height** + **Column Width** `dropdown`
> controls to the Table Layout contextual tab's "Cell Size" group (`table-tools-pm.js`). Each opens a
> shared `tblSizeFly` flyout (`commands.js` — an inches number input + presets) → `H.tblRowHeight`
> applies `tableSetRowHeight(px,'atLeast')`, `H.tblColWidth` applies `tableSetCellWidth(px)` (inches×96=px;
> model/exporter convert px→twips). Both cmds added to the dropdown-dispatcher allow-list (was returning
> "no options"). Oracle `read-table`: Row Height 0.5" → row 1 = 36pt heightRule=atLeast; Column Width
> 1.5" → col 0 = 108pt. 2 regression tests (full ribbon path: `WC.Commands.dropdown` → flyout preset →
> assert model attr + exported OOXML). `/code-review` (xhigh, 3 finder passes incl. test false-pass
> sweep): **zero findings** (confirmed: all `WC.fly*` helpers exist, `flyItem` auto-closes via util.js:89,
> bridge signatures match, 2160-twip clicked column distinguishable from the 4680-twip default).
>
> **NEXT — pick one** (deferrals.md §A.1d frames-overlay, §A.1e tables remaining):
>   1. **Table RELOCATE / row-split / AutoFit** — the remaining 4d table-layout items. RELOCATE needs a
>      move handle (+ anchor for floating); row-split needs the pagination engine to split a table at a
>      row boundary (currently moves it wholesale) via the fork's `splitTableAtRow` + repeat header rows;
>      AutoFit (contents/window/fixed) needs the layout pass.
>   2. **The FRAMES-OVERLAY** (bigger 4c piece) — absolutely-positioned floating frames + text-exclusion;
>      unblocks faithful image reposition (4c.2) + render z-stacking + floating Shapes/TextBox.
>   3. **4e (headers/footers + fields)** — currently fully blocked (toast). High value.
> Branch off `main`. **NOTE the session is now VERY long** — a fresh session is strongly recommended.
>
> GOTCHAS for tables (carry forward): caret won't stay in an HTML-`insertContent`ed table (use
> `insertTable`); synthetic full-drag doesn't drive PM pointer plugins headlessly (validate via
> plugin-arm + direct attr write + oracle); `read-table` oracle verb reports col widths + row heights
> (auto rows = 9999999 pt); a default 2-col Letter table is 312px/col = 4680 twips.

---

## 2026-06-16 (Phase 4d.2 row-height export fix DONE; 4d.3 row-resize UI / frames-overlay / 4e next)

> **Branch:** `main` (4d.2 merged via PR #48 `8849c4e`; branch deleted). **Phase:** 4 (layout
> engine). DONE so far: 4a pagination, 4b image resize, 4c.1 wrap, 4c.3 z-order, 4d.1 column resize,
> 4d.2 row-height export. All oracle-validated. Gates: **PM 423 / smoke 9 / roundtrip 27.**
>
> **4d.2 done (PR #48):** fixed the row-height EXPORT round-trip. `tr-translator`'s reconciliation
> rebuilt the nested row-height `value` as a STRING (`String(pixelsToTwips(...))`), which the
> `trHeight` decode silently dropped (`typeof value === 'number'` guard) — so a set/changed row height
> produced NO `<w:trHeight>` (Word saw auto-height); it also dropped the `rule`. Now a NUMBER + spreads
> the existing nested rowHeight (keeps rule). Imported unchanged rows skip the reconciliation (round-trip
> gate stayed green). Oracle: 60px → `w:trHeight w:val="900" w:hRule="atLeast"` → Word 45pt atLeast.
> (NB the bug was the string cast, NOT px-vs-twips as first diagnosed.) Fixed a stale vendored
> `tr-translator.test.js` (not run by the electron gates; vitest absent).
>
> **NEXT — pick one** (deferrals.md §A.1d frames-overlay, §A.1e tables):
>   1. **4d.3 — row-resize UI affordance** (heights now round-trip, but there's no way to SET one from
>      the UI: no built-in row resize → custom drag overlay, OR wire a ribbon Row Height control;
>      `setRowHeight`/`tableSetRowHeight` exist programmatically). Then table RELOCATE → row-split → AutoFit.
>   2. **The FRAMES-OVERLAY** (bigger 4c piece) — absolutely-positioned floating frames + text-exclusion;
>      unblocks faithful image reposition (4c.2) + render z-stacking + floating Shapes/TextBox.
>   3. **4e (headers/footers + fields)** — currently fully blocked (toast). High value.
> Branch off `main`. **NOTE the session is now very long** — a fresh session is ideal for the next slice.
>
> GOTCHAS for tables (4d.3): caret won't stay in an HTML-`insertContent`ed table (use `insertTable`);
> synthetic full-drag doesn't drive PM pointer plugins headlessly (validate via plugin-arm + direct attr
> write + oracle); `read-table` oracle verb reports col widths + row heights (auto rows = 9999999 pt).

---

## 2026-06-16 (Phase 4d.1 table COLUMN RESIZE DONE; 4d.2 (row resize) or frames-overlay next)

> **Branch:** `main` (4d.1 merged via PR #46 `52d88dd`; branch deleted). **Phase:** 4 (layout
> engine); **4a + 4b + 4c.1 wrap + 4c.3 z-order + 4d.1 column-resize are DONE**, all oracle-validated.
>
> **4d.1 done (PR #46):** table **column resize** works. Re-enabled prosemirror-tables `columnResizing`
> (`handleWidth` 0→5 in `extensions/table/table.js` — it was 0, disabling the drag hit-zone for a
> never-built custom overlay). Drag a column border → cells' `colwidth` (px). KEY FIX: a grid-sync
> `appendTransaction` (table.js) rebuilds the table's `grid` attr (twips) from the changed colwidths +
> marks `userEdited`, because the exporter emits `w:gridCol` verbatim from `grid` — without it a resize
> on an IMPORTED table (which carries a grid) was silently DROPPED on save (caught by `/code-review`).
> New oracle verb `read-table` (column widths + row heights, pt). Oracle-validated: 180px resize →
> `w:gridCol=2700` → Word 135pt, for BOTH new + imported (stale-grid) tables. Code-reviewed +
> re-reviewed (grid-sync round-trip + a per-keystroke deep-walk perf fix).
>
> **Gates on main: PM 422 / smoke 9 / roundtrip 27.**
>
> **NEXT — pick one** (both recorded; deferrals.md §A.1d frames-overlay, §A.1e tables):
>   1. **4d.2 — row RESIZE** (+ FIX the known `setRowHeight` px-vs-twips export bug: it stores px in
>      `tableRowProperties.rowHeight.value` but the exporter writes that as `w:trHeight w:val` which
>      Word reads as TWIPS → ~15× too small). prosemirror-tables has NO built-in row resize → needs a
>      custom handle/overlay. Then table RELOCATE, row-split across pages, AutoFit.
>   2. **The FRAMES-OVERLAY** (the bigger 4c piece) — render every floating object as an absolutely-
>      positioned frame with text-exclusion → unblocks faithful free-REPOSITION (4c.2) + render
>      z-stacking + floating Shapes/TextBox (#7). LAYOUT_ENGINE.md §3.
>   3. **4e (headers/footers + fields)** — currently fully blocked (toast).
> Branch off `main`. Recommend 4d.2 (continues tables) or 4e (high-value, currently blocked).

---

## 2026-06-16 (Phase 4c.1 wrap + 4c.3 z-order DONE; the FRAMES-OVERLAY is the remaining 4c)

> **Branch:** `main` (4c.3 z-order merged via PR #44 `66d691e`; branch deleted). **Phase:** 4
> (layout engine); **4a + 4b + 4c.1 (text wrap) + 4c.3 (z-order export) are DONE**, all
> oracle-validated. **NEXT = the FRAMES-OVERLAY** (the faithful-render core of floating objects)
> OR pivot to **4d (tables)** / **4e (headers/footers)** — see "decision" below.
>
> **4c.3 done (PR #44):** `WC.PM.setImageZOrder(forward|backward|toFront|toBack)`
> (`bridge/insert.ts`) mutates the floating image's `relativeHeight` (Word-sane, relative to other
> floating images; forward/backward use `>=`/`<=` so a tied peer is included — the default state).
> Ribbon Bring/Send items wired (was the phantom `WC.Layout.*`). EXPORT is faithful — oracle
> `read-shapes` (now reports leftPt/topPt/zOrder) confirms Word reads distinct `ZOrderPosition`s.
> Code-reviewed + re-reviewed (caught + fixed a tie no-op bug).
>
> **Gates on main: PM 420 / smoke 9 / roundtrip 27.**
>
> **DECISION POINT — the remaining 4c work is the FRAMES-OVERLAY, a big architectural piece (not a
> clean slice).** 4c.1 (wrap) + 4c.3 (z-order) were EXPORT-faithful wins on the fork's existing
> CSS-based render. But the fork renders floating images via CSS float (Square/Tight/Through) or
> absolute left/top (None only), and z-orders via z-index (positioned elements only). So **faithful
> free-REPOSITION (4c.2) AND faithful render z-stacking both require rendering every floating object
> as an absolutely-positioned frame with text-exclusion** (shape-outside / manual line exclusion) +
> a drag overlay — LAYOUT_ENGINE.md §3 "frames overlay". This is the substantial remaining
> floating-objects work (deferrals.md §A.1d). Options for the next session:
>   1. **Build the frames-overlay** (big, but unblocks faithful reposition + z-stacking + floating
>      shapes/textboxes #7). Branch `build/phase-4c-frames-overlay` off `main`.
>   2. **Pivot to 4d (tables)** — column/row resize (`w:gridCol`/`w:trHeight`), table relocate,
>      row-split across pages. May be cleaner wins than the frames-overlay. LAYOUT_ENGINE.md §2 #4-6.
>   3. **Pivot to 4e (headers/footers + fields)** — per-page regions + page-number/date fields.
> Recommend confirming the priority before committing to the frames-overlay's scope.

---

## 2026-06-16 (Phase 4c.1 TEXT WRAP COMPLETE + merged; 4c.2 drag-reposition next)

> **Branch:** `main` (4c.1 merged via PR #42 `4bbdb51`; branch deleted). **Phase:** 4 (layout
> engine); **4a pagination + 4b image resize + 4c.1 text-wrap are DONE**, all oracle-validated.
> Sub-phase **4c.2 (drag-to-reposition the floating image) is NEXT** — branch off `main`.
>
> **4c.1 done (PR #42):** the ribbon **Wrap Text** menu now works. `WC.PM.setImageWrap(mode)`
> (`bridge/insert.ts`) maps inline/square/tight/through/topbottom/behind/front → the image's
> `wrap`+`isAnchor` attrs (one setNodeMarkup). The fork ALREADY renders wrap (float/shape-outside/
> absolute → real reflow) and round-trips it; the gap was the ribbon calling a never-defined
> `WC.Layout` stub (commands.js re-pointed to `WC.PM.setImageWrap`). KEY FIX: the fork's anchor
> exporter (`translate-anchor-node.js`) now emits a schema-valid `CT_Anchor` for a GENERATED
> (inline→floating) anchor — always a `<wp:simplePos>` child + the required attrs
> (simplePos/behindDoc/locked/layoutInCell/allowOverlap); without them **Word refused to open the
> file**. For tight/through, `setImageWrap` seeds a default bounding-box `wp:wrapPolygon` (CT_WrapTight
> requires one). Oracle (`read-shapes`): all 6 floating modes OPEN in Word as floatingShapes.
> Code-reviewed (no correctness bugs); edges in deferrals.md §A.1d.
>
> **Gates on main: PM 419 / smoke 9 / roundtrip 27.**
>
> **NEXT — sub-phase 4c.2 (drag-to-reposition)** then **4c.3 (z-order)**: branch
> `build/phase-4c2-reposition` off `main`. Build a frames overlay (MIRROR the 4b resize overlay in
> `src/renderer/imageresize/`, mounted in `#pages`) that drags a FLOATING image and writes
> `marginOffset` (→ `wp:posOffset` EMU); validate the exported position vs the oracle (`read-shapes`).
> NOTE: when a custom `marginOffset` exists, reset it on inline-toggle (the §A.1d latent note).
> 4c.3 = wire Bring Forward/Send Backward → mutate the image `relativeHeight` attr (the ribbon items
> still call the retired `WC.Layout.*` → throw). Then 4d tables → 4e headers/footers → 4f.

---

## 2026-06-15 (Phase 4b IMAGE RESIZE COMPLETE + merged; 4c (floating) next)

> **Branch:** `main` (4b merged via PR #40 `6d8c448`; branch deleted). **Phase:** 4 (layout
> engine); **4a pagination + 4b image resize are both DONE**, all oracle-validated. Sub-phase
> **4c (floating anchor/position/wrap) is NEXT** — branch off `main`.
>
> **4b done (PR #40):** live image resize via an owned 8-handle overlay
> (`src/renderer/imageresize/image-resize.ts`, wired in `create-editor.ts` after Pagination —
> same out-of-fork philosophy). Drag a handle → preview → one `setNodeMarkup` writing the image
> `size` attr (px); the fork exporter turns it into `wp:extent`/`a:ext` (EMU), zero exporter
> change. The overlay mounts in `#pages` (the zoom-scaled, `position:relative` containing block),
> positioned at the image's UNSCALED offset → tracks the image through zoom + scroll with no
> per-frame repositioning. Aspect-locked (Word default). New oracle verb `read-shapes` (InlineShape
> Width/Height in pt + EMU). Oracle-validated: 200×100 → 260×130 px = Word 195pt×97.5pt =
> 2476500×1238250 EMU. Hardened through `/code-review` + a re-review of the fixes (listener leak,
> window-resize staleness, containing-block dependency). Deferred 4b edges in deferrals.md §A.1c
> (free one-axis stretch / `lockAspectRatio` not read, inline top-left anchoring, rotated-image AABB).
>
> **Gates on main: PM 414 / smoke 9 / roundtrip 27.**
>
> **NEXT — sub-phase 4c (floating anchor/position/wrap)** (LAYOUT_ENGINE.md §2.3 / §4, deferrals.md
> §A.1 "Object RELOCATE + text-wrap"): branch `build/phase-4c-floating` off `main`. The frames
> overlay — inline ⇄ floating, drag-to-reposition, text-wrap (square/tight/through/top&bottom/
> behind/in-front), `w:anchor` + `posH`/`posV`. Read the fork's image `anchorData`/`wrap` attrs +
> the wp anchor import/export helpers; propose the design vs the real code first; validate the
> exported anchor/position vs the oracle (`read-shapes` floatingShapes + read-props). Then 4d tables
> → 4e headers/footers → 4f page-bg/columns/section-geometry.

---

## 2026-06-15 (Phase 4a pagination page-break family COMPLETE (4a2 + 4a3 merged); 4b next)

> **Branch:** `main` (4a2 merged via PR #37 `7779c53`; 4a3 merged via PR #38 `0e0f29f`; both feature
> branches deleted). **Phase:** 4 (layout engine); **4a pagination is now FULLY COMPLETE** for the
> page-break family — all oracle-validated vs Word for Windows 16.0. Sub-phase **4b (image resize) is
> NEXT** — branch off `main`.
>
> **What this session finished (continuing the `/loop` "finish pagination things, all of them"):**
> - **4a2 — unified forced-seam redesign (PR #37):** manual page breaks now place a seam AT the break
>   position `P` (one mechanism for mid-paragraph, end-of-paragraph, trailing, and blank-page breaks),
>   replacing the buggy "push the next block" model. This RESOLVED the previously-deferred
>   mid-paragraph + trailing breaks. Folded the three seam-emit sites into one `emitSeam` primitive.
>   Oracle: mid-para = 1 paragraph across 2 pages; trailing = +1 page; blank = content on page 3.
> - **4a3 — section breaks (PR #38):** the next-page `w:sectPr` page boundary is paginated
>   (`sectionBoundaries` in `pagination.ts`). Diagnosed by oracle experiment the semantic the prior 4f
>   spike got backwards: a sectPr's `w:type` governs how ITS OWN section BEGINS, so the break AFTER a
>   section-ending paragraph is governed by the NEXT section's type (next ender's sectPr, or the body
>   sectPr — default nextPage). Oracle-validated: single break, explicit-continuous-ender (still
>   breaks), continuous-MIDDLE section (stays on page → 2 pages not 3), and section-break-before-table.
>
> **Gates on main: PM 410/410, smoke 9/9, roundtrip 27/0.** Each increment ran the execute→test→fix→
> /code-review cycle; review findings were fixed + re-validated (table position-match, multi-section
> validation gap, nextColumn) or documented as exotic edges.
>
> **Pagination DONE (the page-break family):** auto multi-page overflow, line-level intra-paragraph
> split (widow/orphan), manual breaks (mid/end/trailing/blank), section breaks (next-page/multi-
> section/before-table), live "Page X of Y", page margins, full-height last sheet.
>
> **Still deferred (NOT page-break pagination — distinct sub-phases; deferrals.md §A.1b):** per-section
> GEOMETRY (different margins/orientation/size per section) + even/odd parity blank pages → 4f; a block
> taller than one page that can't be line-split → 4b/4d; table row-split across pages → 4d; the two
> 4a2-review deep edges (widow/orphan-relative-to-block-start on a re-overflowing mid-broken paragraph;
> forced break in a measureBlocks-skipped block); pre-first-measure page-count flash; no automated
> oracle gate in `test:pm` (the read-layout parity is a manual PowerShell step).
>
> **NEXT — sub-phase 4b (image resize)** (LAYOUT_ENGINE.md §4 / acceptance #2): branch
> `build/phase-4b-image-resize` off `main`. Image NodeView + 8 live resize handles whose drag writes
> `w:extent` (EMU) + aspect-lock, replacing the DECORATIVE handles (`2dca2e4`). Then 4c floating → 4d
> tables → 4e headers/footers → 4f page-bg/columns/section-geometry.

---

## 2026-06-15 (Phase 4a MERGED to main (3 review rounds); 4b (image resize) next)

> **Branch:** `main` (Phase 4a merged via PR #36, merge commit `1c00252`; the
> `build/phase-4a-pagination` branch is deleted). **Phase:** 4 (layout engine); 4a (pagination
> core) **DONE + merged**; sub-phase **4b (image resize) is NEXT** — branch off `main`.
>
> **State:** the pagination engine (`src/renderer/pagination/pagination.ts`) ships in main: auto
> multi-page sheets, page margins, live "Page X of Y", manual page breaks + MID-document blank pages,
> and line-level intra-paragraph splitting — all oracle-validated vs Word for Windows 16.0. Gates on
> main: **PM 404/404, smoke 9/9, roundtrip 27/0.**
>
> **Review hardening (the bulk of this session):** ran `/code-review max` on the 4a diff (15 confirmed
> findings) → fixed the high-value ones (imported run-level `<w:br w:type=page>` detection, table
> mid-cell-seam mangling + nested-cell mis-attribution, asymmetric-margin band bleed, status-bar
> blank-page count, Linux opaque-headless-window). A focused **re-review of the fix commit** caught
> that the fixes over-reached: `pageBreakSource` (section breaks) was page-broken on the wrong side /
> for continuous sections → **reverted + deferred to 4f**. A **third review** found the trailing
> (doc-final) page-break feature had grown a disproportionate edge tail → **reverted + deferred**.
> Net: the COMMON cases are correct + validated; section breaks, trailing breaks, and mid-paragraph
> breaks are documented deferrals (deferrals.md §A.1b). Tables are skipped at any nesting depth.
> Lesson: re-review your own review-fixes — both re-reviews caught real new bugs.
>
> **NEXT — sub-phase 4b (image resize)** (LAYOUT_ENGINE.md §4 / acceptance #2, deferrals.md §A.1
> "Image RESIZE"): branch `build/phase-4b-image-resize` off `main`. Build an image NodeView with 8
> live resize handles whose drag writes `w:extent` (EMU) back to the model + aspect-lock on corner
> drag — replacing the DECORATIVE handles from commit `2dca2e4` (the `.ProseMirror-selectednode`
> handles in editor.css). Read the fork's image extension (`extensions/image/`) + `bridge/insert.ts`
> insertImage; propose the design vs the real code first; validate the exported EMU vs the oracle
> (read-props / docx-inspect); ship tests; keep all 3 gates green. Then 4c floating → 4d tables →
> 4e headers/footers → 4f page-bg/columns/sections.
>
> **Blockers/notes:** none. `npm install` on a fresh checkout (nspell). Oracle = sandbox-disabled,
> foreground, PID-safe. The COM-oracle `read-layout` verb is the pagination ground truth.

---

## 2026-06-15 (Phase 4a PAGINATION CORE COMPLETE + oracle-validated; PR opened)

> **Branch:** `build/phase-4a-pagination` (off `main` @ `4a404ce`). **Phase:** 4 (layout engine),
> sub-phase **4a (pagination core) — COMPLETE.** All four pagination scenarios match real Word exactly
> (COM oracle `read-layout`).
>
> **State summary:** the owned engine `src/renderer/pagination/pagination.ts` now delivers the full 4a
> scope: real multi-page sheets (auto overflow, page-relative baseline), page margins, live "Page X of Y",
> **manual page breaks** (`hardBreak[pageBreakType='page']`), **blank pages** (two consecutive breaks →
> a skipped sheet + 2 gap bands), and **line-level intra-paragraph splitting** (Range.getClientRects line
> boxes + widow/orphan ≥2 lines each side + a mid-paragraph nudge seam). A convergence **deadband**
> (`layoutsClose`) absorbs sub-line getClientRects/posAtCoords jitter so the engine settles (no busy-loop).
> `measureBlocks` subtracts intra-block seam heights for a stable natural height.
>
> **Oracle validation (all EXACT vs Word for Windows 16.0):**
> - 70 single-line paras → 2 pages, break at para 45 (= Word 45).
> - 20 multi-line (3-line) paras → 2 pages, break at para 15 (= Word 15; widow/orphan moves whole).
> - manual break after para 2 of 4 → 2 pages, para 3 on page 2 (= Word); exports `<w:br w:type="page"/>`.
> - blank page → 3 pages (content / blank / content), box exactly 3 sheets, 2 gap bands.
> - one ~65-line paragraph → 2 pages with a mid-paragraph line split (= Word's 2 pages).
>
> **Done this session (commits on the branch, newest last):** `9490d4e` manual breaks + blank pages ·
> `90039b2` line-level intra-paragraph splitting. (Earlier this branch: headless-rAF fix, pagination core,
> oracle `read-layout` verb, Word-fidelity margin+line-height, status-bar page count, the 2026-06-15
> core checkpoint.) **Gates:** PM **402/402**, smoke **9/9**, roundtrip **27/0**. deferrals.md §A.1
> Page-Break row marked RESOLVED.
>
> **NEXT:** open/merge the 4a PR (`build/phase-4a-pagination` → `main`), then **sub-phase 4b — image
> resize** (LAYOUT_ENGINE.md §4 / acceptance #2): an image NodeView with 8 live resize handles writing
> `w:extent` (EMU) back to the model + aspect-lock on corner drag (replaces the decorative handles from
> `2dca2e4`). Branch `build/phase-4b-image-resize` off `main` after 4a merges. Then 4c (floating
> anchor/position/wrap) → 4d (tables) → 4e (headers/footers) → 4f (page background/columns).
>
> **Blockers/notes:** none. `npm install` needed on a fresh checkout (nspell). Oracle = sandbox-disabled,
> foreground, PID-safe. The user's Word window is untouched. A live computer-use side-by-side eyeball vs
> Word is recommended as a final confirmation (geometry already oracle-validated numerically).

---

## 2026-06-15 (Phase 4a PAGINATION CORE built + oracle-validated; manual breaks + line-split next)

> **Branch:** `build/phase-4a-pagination` (off `main` @ `4a404ce`). **Phase:** 4 (layout engine),
> sub-phase **4a (pagination core) — core DONE, oracle-validated vs real Word; 4a not yet complete**
> (manual page-break/blank-page geometry + line-level intra-paragraph split remain).
>
> **State summary:** the single continuous `#pm-editor` sheet is now real **multi-page sheets**, driven
> by an **owned, model-driven engine** `src/renderer/pagination/pagination.ts` — a `Pagination`
> Extension + PM plugin (concatenated into `getStarterExtensions()` in `bridge/create-editor.ts`, so it
> rides the normal pipeline and survives Open/New). A rAF-debounced PluginView **measures** top-level
> block geometry and renders page seams + page margins as **widget decorations** (never model nodes →
> exports clean, caret never moves). Geometry comes from the MODEL (`editor.getPageStyles()`). Seam
> heights use a **measure-and-nudge** solver (margin-collapse-proof; box = exactly N sheets, proven to
> the pixel). Page margins (top/bottom) are realized (the fork left them unrendered). Live **"Page X of Y"**
> in the status bar (`io.ts counts().pages` + `statusbar.js`).
>
> **Oracle validation (THE key result):** new `read-layout` verb in `word-oracle-win.ps1` (page count +
> per-paragraph start-page + break paragraphs). On a 70-para Aptos-12 fixture exported by the clone,
> the clone's pagination now **matches real Word EXACTLY**: 2 pages, page break at paragraph 45
> (= Word's 45). Two fidelity fixes got there: (1) reset the browser-default 16px `<p>` margin
> (`editor.css`) — the fork resets ol/ul/li but not `p`, and only under `.sd-editor-scoped` which the
> bare mount lacks, so every paragraph carried phantom spacing (~25 lines/page vs Word's ~44); real
> spacing still comes inline from the model; (2) `DEFAULT_LINE_HEIGHT` 1.2→**1.225** (fork, NOTICE'd) —
> Word's Aptos-12 line metric (~19.6px), upstream's 19.2px over-fit by one line/page. Evidence:
> `docs/superpowers/plans/notes/2026-06-15-phase4a-pagination-oracle.json`.
>
> **Windows enablement (foundation):** headless probe runs were spuriously failing ~18 ribbon-chrome
> tests on this fresh Windows checkout — a never-shown BrowserWindow throttles rAF to ~2fps, starving
> the rAF-coalesced state-sync. Fixed by painting the headless window **transparent + inactive** on
> non-darwin (`src/main/main.js`) so rAF runs at 60fps without stealing focus. This unblocked the whole
> loop (gates now reliably green on Windows).
>
> **Done this session (commits on the branch, newest last):** `0f144b9` headless-rAF fix · `c11d689`
> pagination core + 7 `[4a]` tests · `ae7ffb4` oracle `read-layout` verb · `47d5d23` Word-fidelity
> (margin + line-height) + 2 tests · `31fb1af` status-bar page count + 1 test. **Gates:** PM **398/398**,
> smoke **9/9**, roundtrip **27/0** (all headless on Windows).
>
> **NEXT (continue 4a):**
> 1. **Manual page breaks** — render `hardBreak[pageBreakType='page']` (confirmed: a `hardBreak` inline
>    atom; DOM `span[linebreaktype="page"]`) as a forced page boundary. Plan: detect forced positions,
>    extend the solver with a **page-relative natural baseline** (`pageStartNat`) so auto-overflow stays
>    correct after a forced break, and place a seam via the same nudge. Single break first; **blank page**
>    (two consecutive hardBreaks) = a multi-band seam skipping a page (generalize `makeSpacer` to a
>    band-offsets array: bottom band at `h - GAP - marginTop`, each earlier band one `pitch` up).
> 2. **Line-level intra-paragraph split** — a paragraph taller than a page splits at the line
>    (PAGINATION.md §7 binary search on rendered line bottoms); today only block-boundary breaks exist.
> 3. Re-validate each vs the oracle (`read-layout`) + computer-use side-by-side; keep all 3 gates green.
>
> **Blockers/notes:** none. The user's Word window is untouched (PID-safe oracle, fresh instance).
> `npm install` is required on a fresh checkout (the pull added `nspell`). Probe fixtures live in `C:/tmp`.

---

## 2026-06-15 (PIVOT: build the LAYOUT ENGINE next, then fix the gated bugs)

> **User decision:** most remaining features/bugs can't be finished until the layout engine
> exists — not just pagination, but image **resize/relocate**, table **resize/relocate/row-split**,
> floating objects, headers/footers, page-border render, columns. So we **build the layout engine
> first (Phase 4)**, then the gated bugs become fixable. The user is moving to a **fresh session on
> a Windows PC**.
>
> **START HERE (fresh session):**
> 1. Read **[../LAYOUT_ENGINE.md](../LAYOUT_ENGINE.md)** — the consolidated Phase-4 spec: what the
>    engine is, the acceptance checklist (§2), the proposed architecture (§3), and the sub-phase
>    build order **4a→4f** (§4). Its checklist is fed by `deferrals.md` §A.1.
> 2. Read **[plan.md](plan.md)** (roadmap: Phase 3 PAUSED, Phase 4 ACTIVE) and its new
>    **"Cross-platform / running on Windows"** section.
> 3. **Branch first** off `main`: e.g. `build/phase-4a-pagination`. Never work on `main`.
>    (`fix/ribbon-home` was **fast-forward-merged into `main` and pushed** on 2026-06-15, so
>    `main` already contains all the Home/Insert/Design/Editor work + this pivot. On Windows:
>    `git pull origin main` then branch off it.)
> 4. Sub-phase 4a = **pagination core** (model-driven multi-page sheets, line-level boundary,
>    page-break/blank-page geometry), oracle-validated lines/page. PAGINATION.md is the prior art.
>
> **Windows: NOT a problem — arguably better.** Parity oracle = **Word for Windows 16.0 COM**
> (`scripts/oracle/word-oracle-win.ps1`) — the intended ground truth (the macOS AppleScript oracle
> was a flaky stopgap). Office fonts (Calibri/Cambria/Aptos) are native on Windows → better
> fidelity. Gates are cross-platform; the probe harness now auto-creates its output dir
> (`src/main/main.js`), so `/tmp/...` → `C:\tmp\...` works. (`d1b591a`-era state; one commit pending
> for the harness mkdir + these docs.)
>
> **Housekeeping (DONE 2026-06-15):** `fix/ribbon-home` (Home/Insert/Design/Editor hardening +
> the editor bug fixes + this pivot) was **fast-forward-merged into `main` and pushed to origin**
> — `main` is now the clean integrated base for Phase 4. All gates green: PM 387/388 (1 known
> win-only `[10mm]` skip), smoke 9/9, roundtrip 27/0.

---

## 2026-06-15 (carousel/borders/picture/design /loop: 4 items DONE, verified vs real Word)

> Continuation /loop on `fix/ribbon-home`. User gave 4 concrete asks + screenshots; all done, each its
> own commit, all three gates green after each (PM 384/385 = 1 known win-only `[10mm]` skip; smoke 9/9;
> roundtrip 27/0). Verified against REAL Mac Word via computer-use throughout.

**Done this session (commits newest last):**
1. `feat(home)` `4b2df70` — **Quick Styles carousel**: shared `makeGalleryCarousel()` (ribbon.js) — ‹ prev
   / › next flanking a clipped, paged viewport + a centered ▾ More. Pages by a full row, **disables the
   arrow at the first/last page** (last page clamps to the final row), ▾ opens the expanded grid. Tiles
   upgraded to Word's preview+name. Word model captured live: 17 styles, ~6/page.
2. `fix(home)` `e8d19aa` — **paragraph borders carry on Enter + merge like Word**. Word model captured
   live: a border is a paragraph property spanning the full column; Enter CONTINUES it; consecutive
   same-bordered paragraphs MERGE (top on the first, bottom on the last, "between"/Inside-Horizontal
   between). `encodeCSSFromPPr` rewritten with the run-merge (+4th param prevProps); new
   `borderCarryPlugin.js` carries only borders on split; ParagraphNodeView re-renders both neighbours on
   border change. **Inside-Horizontal now RENDERS** (was Phase-4-flagged).
3. `fix(insert)` `f77f3e9` — **pictures insert at natural size, clamped to the column width** (were a
   hardcoded 100×100 tiny box). `insertPictureFromDataUrl()` reads natural dims + clamps. Verified
   end-to-end via the real file picker (1400×900 → full column width, aspect kept).
4. `feat(design)` `7f94262` — **Word-faithful Design tab**: Themes button → big inline **Style Set
   carousel** (mini Title/Heading previews, ‹/›/▾, reused makeGalleryCarousel) → Colors/Fonts/Spacing/
   Effects/Set as Default → Watermark/Page Color/Page Borders. THEMES 9→30 (Office + alphabetical),
   COLOR_SCHEMES 8→18, FONT_PAIRS reworked; Themes menu gains Reset/Browse/Save; Colors/Fonts gain
   Customize…; **Page Color now opens the colour picker** (was hardcoded white).

5. `fix(insert)` `904ab85` — image **fallback size** when natural dims are unknown (undecodable data-URL
   / a 0×0 viewBox-only SVG) → column-fit default, not the bridge's 100×100. Surfaced by an **adversarial
   review workflow** over the whole /loop diff (3 review dims × skeptical verify): it confirmed ONLY this
   one edge case; the border-merge plugin, both carousels, and the Design rebuild all held up.

6. `fix(insert)` `2dca2e4` — **visible image selection + real video thumbnail** (user-reported editor bugs):
   - **Image selection had NO feedback** — no CSS for `.ProseMirror-selectednode`, so a clicked image
     looked unselectable → users thought images "couldn't be deleted". Added a Word-like selection frame
     (accent outline + corner handles) in editor.css. Click → frame shows → Delete removes (verified live).
   - **Online Video dropped a bare link** (CSP `img-src 'self' data: blob:` blocks remote posters) →
     `insertVideoThumbnail()` now builds a self-contained **SVG poster** (play button + host + URL) inserted
     as a normal image node. Verified with YouTube + Vimeo. Playback stays sandbox-deferred.
   - Exposed `NodeSelection` (pm/index.ts, main.ts) for the suite. +3 tests (incl. picture-fallback).
   - **Caret "can't change keyboard location":** could NOT reproduce a failure — click repositions the
     caret in text / before+after images / empty space, and typing continues after an inserted image, all
     matching real Word (compared side-by-side). The invisible image selection (now fixed) was the likely
     cause. (An apparent "click replaced all text" was a batch-automation timing artifact, not the app.)

**Still open / next:** image **resize handles are decorative** (drag-to-resize is a future slice); other
Insert stubs (Shapes, SmartArt, Chart, Text Box, Equation, 3D, Screenshot, Signature, Object) remain —
see deferrals §A.3. Text Effects stage 2b (shadow + reflection) still pending (deferrals §A.2). Suggested
wrap-up: PR `fix/ribbon-home` → `main`.

---

## 2026-06-15 (backlog 1–5 DONE + Text Effects stage 2a; stage 2b is the next step)

> Continuation of the /loop below. Branch `fix/ribbon-home`. All three gates green after each commit
> (PM 373–374 pass / 1 known win-only `[10mm]` skip; smoke 9/9; roundtrip 27/0). Verified against REAL
> Mac Word via computer use throughout (Borders dropdown+dialog, Styles gallery, Editor pane, Insert tab).

**Done this session (commits on `fix/ribbon-home`, newest last):**
1. `fix(icons)` — **Show/Hide ¶** now the pilcrow (dropped the `eye_off` Fluent map → hand-authored two-stem ¶).
2. `feat(home)` — **full Word Borders dropdown** (16 items, per-edge checkmarks, greyed diagonals, Horizontal
   Line, View Gridlines) **+ Borders and Shading dialog** (Borders/Page Border/Shading tabs, Setting/Style/
   Color/Width, interactive Preview, Apply to, Options, Horizontal Line). `+ fix(home)` review follow-ups
   (page-width export, nil-edge seed, dialog focus, `document_border` icon).
3. `feat(home)` — **Styles section**: gallery decoupled from ribbon-data → canonical Word order filtered by
   the live catalog; **+ Intense Reference**; the **"More" chevron opens the expanded gallery flyout** (grid +
   Create a Style / Clear Formatting / Apply Styles), not the pane. SCOPE.md locked.
4. `feat(editor)` — **real offline proofing** (`src/renderer/proofing/`): nspell + a vendored SCOWL en_US
   Hunspell dictionary (spelling), mechanical grammar rules, heuristic Clarity/Conciseness. Editor pane
   rewired (real counts + suggestion cards that fix via PM). Cloud ML pieces stay flagged. `+ nspell` dep.
5. `feat(insert)` — **small-button labels + Word arrangement**: trimmed the `LARGE` set; `renderControl`
   `labeled` opt; Insert small buttons stacked 3-per-column WITH labels. Header/Footer/Page Number stay
   `isBlocked` (layout) — deferrals A.1.

6. `feat(docx)` — **Text Effects stage 2a**: `w14:textOutline` + `w14:glow` now EXPORT and round-trip
   (units pt×12700 EMU, probe-verified 2pt→25400 / 6pt→63500; new fork translators + bidirectional bridge
   in `super-converter/styles.js`). The macOS oracle **timed out** this session (`AppleEvent -1712`, the
   documented Word-for-Mac fragility — not a docx defect); structure mirrors the already-oracle-validated
   typography-trio w14-under-`w:rPr`.

**NEXT — Text Effects stage 2b (`w14:shadow` + `w14:reflection`).** Deferred ONLY because their units need
oracle-derived values (shadow: cartesian {dx,dy,blur}→polar dist EMU/dir 60000ths-deg + sx/sy/kx/ky;
reflection: preset string → the full stA/stPos/endA/endPos 1000ths-% + dist/dir/fadeDir set). Build them the
same way as 2a (translator dir + `decodeRPrFromMarks`/`encodeMarksFromRPr` branches + `rpr-translator.js`
registration) once the oracle is reachable. Full spec: **deferrals.md §A.2**. Also recommended: a confirming
oracle open of a textOutline/glow docx in real Word (restart Word first — the session degraded).

**Backlog COMPLETE** (1–5 fully, 6 = stage 2a done + 2b spec'd). Suggested wrap-up: PR the whole
`fix/ribbon-home` branch (now ~14 commits across the Home tab + Insert + Editor + docx) into `main`.

---

## 2026-06-15 (new-session backlog: Home polish + Insert tab, as a /loop)

> Clean handoff: working tree clean at `ab356f2`, all gates green (PM 353/354, smoke 9/9, roundtrip 27/0).
> Mode the user set: **continuous /loop, do NOT ask, decide with engineering insight, compare against REAL
> Word via computer use ALL the time** (incl. popup/dropdown behaviours), flag layout-engine items + post-
> pagination items, keep going. Computer-use tools are loaded; new session must `request_access` (Microsoft
> Word + the Electron clone) and start. Ultracode ON → use Workflow for substantive sub-tasks.

**Queued work (user-provided screenshots captured the specs):**
1. **Show/Hide ¶ icon WRONG** — `showHide` cmd should use the OLD pilcrow ("opposite P", ¶) icon, not the
   current one. Fix the icon mapping (icons-fluent / icons.js / ribbon-data icon field). Quick.
2. **Borders — expand to full Word parity** (Home → Paragraph → Borders split ▾). Real Word dropdown (per
   screenshot): Bottom/Top/Left/Right Border (per-edge CHECK state), No Border, All Borders, Outside Borders,
   Inside Borders, Inside Horizontal Border, Inside Vertical Border, Diagonal Down/Up (greyed outside tables),
   Horizontal Line, Draw Table, View Gridlines, **Borders and Shading…**. Build the **Borders and Shading
   dialog**: tabs Borders / Page Border / Shading; Setting None/Box/Shadow/3-D/Custom; Style/Color/Width;
   clickable Preview edges; Apply to (Paragraph/Text); Options; Horizontal Line. (inside-borders between paras
   + page borders likely need layout — FLAG/defer those; per-paragraph edges work today.) Verify via computer use.
3. **Styles section (Home tab) — section kickoff + harden.** Clipboard/Font/Paragraph are done; Styles is the
   next Home section. Quick Styles gallery (Normal, No Spacing, Heading 1/2, Title, Subtitle, …), the gallery
   scroll/More, Apply Styles, the Styles pane (cmd `stylesGallery`/`stylesPane`). Kickoff = research → propose
   in/out scope → lock in SCOPE.md → register its state rules (active-style highlight already syncs) → fix gaps.
   Verify gallery contents + behaviours vs real Word via computer use.
4. **Editor section — make it REAL** (cmd `editor`, currently a stub pane). User wants actual Spelling + Grammar
   checking — investigate integrating a grammar/spell library (e.g. an offline dictionary + a grammar engine).
   Screenshot shows: Editor Score, Corrections (Spelling N / Grammar N), Refinements, Similarity, Insights.
   Spell-check is feasible offline; grammar is harder — note what's feasible vs cloud-only.
5. **Insert tab ribbon — labels invisible on small screens** (user sees only icons). Even when narrow, controls
   should be viewable/labeled like Word. Likely the Stage-A responsive condense over-hides labels OR the Insert
   groups overflow. Make Insert UI-accurate to Word (buttons + arrangement); then per-feature: FLAG the
   layout-engine-dependent ones (most Insert features — headers/footers/page-geometry/floating objects), make
   the rest work. Compare via computer use.
6. **STILL PENDING from Text Effects: stage 2** — the 4 net-new `w14:textOutline/glow/shadow/reflection` export
   translators (EMU/60000ths-deg/1000ths-% units) + bridge + RUN_PROPERTIES keys + per-effect **oracle**
   round-trip vs real Word. Quartet renders today but doesn't save to docx yet.
7. After Home fully done → **Insert tab** (item 4), then the Home-tab PR.

## 2026-06-15 (Phase 3 — Text Effects & Typography rebuilt: button un-broken, trio docx-faithful)

- **Branch:** `fix/ribbon-home`. **Phase:** Phase 3 Home tab — Text Effects rebuild (stage 1 DONE; quartet export = stage 2).
- **The broken Font button ("Text Effects & Typography") is FIXED on the PM engine** (`5dd55bd`; research via
  `text-effects-research` workflow → user locked "fix fully, all 7, docx-exportable; build it all"):
  - **Crash gone + un-blocked:** all ~12 dead `E()=WC.Editor.applyInlineStyles` call sites re-routed to
    `WC.PM.cmd('setMark','textStyle',{…})`; `textEffectsAndTypography` re-mapped area `text-effects`→`character`
    and `text-effects` removed from the `DEFERRED`/`isBlocked` set (it was gated AND crashing).
  - **One shared mechanism:** 7 new `textStyle` attrs (text-style.js) — trio `fontVariantNumeric` /
    `fontVariantLigatures` / `fontFeatureSettings`, quartet `textOutline` / `textGlow` / `textShadowW14` /
    `textReflection`; render via CSS (glow+shadow share one text-shadow compositor); bridged in `styles.js`.
  - **Typography trio = FULLY docx round-tripping** (their `w14:numForm/numSpacing/ligatures/cntxtAlts/
    stylisticSets` translators already existed): render + export + re-import all validated by probe + tests.
    "Standard and Contextual" maps to `ligatures=standard`+`cntxtAlts` (the `standardContextual` enum is dropped
    by the exporter). Removed the editor-wide `font-feature-settings:'liga' 0` (blocked per-run typography render).
  - **Visual quartet (Outline/Glow/Shadow/Reflection) RENDERS in-app** (CSS: -webkit-text-stroke / text-shadow /
    -webkit-box-reflect) but **does NOT export to docx yet** — its 4 net-new `w14:textOutline/glow/shadow/
    reflection` translators (with EMU/60000ths-degree/1000ths-% unit conversions) are **stage 2**, deliberately
    deferred so the units get **oracle-validated vs real Word** rather than rushed (a units bug silently corrupts
    docx). On a feature branch; interim = quartet renders but save drops it.
- **Gates:** PM **353/354** (1 = Windows-only `[10mm]` fixture skip; +6 Text Effects tests), smoke **9/9**, roundtrip **27/0**.
- **Next (stage 2):** build the 4 quartet `w14` export translators + bridge + RUN_PROPERTIES keys + per-effect
  oracle round-trip vs real Word (macOS AppleScript oracle); then the Home-tab PR.

## 2026-06-15 (Phase 3 — Home/Paragraph section + Text Effects rebuild started)

- **Branch:** `fix/ribbon-home`. **Phase:** Phase 3 Home tab — Paragraph section DONE; Font "Text Effects" rebuild IN PROGRESS.
- **Paragraph section DONE** (`19a3f4e`; kickoff via `paragraph-section-understand` workflow → scope locked):
  - **Two-row arrangement** (`renderParagraphGroupBody`, mirrors Font): row1 lists/indents/sort/show-hide, row2 alignment/spacing/shading/borders. Shared `.para-grid` CSS.
  - **Mixed-selection alignment** (user-locked in scope): `toQueryState` now intersects justification across all selected paragraphs → presses NONE when mixed (Word parity); collapsed/uniform presses the one match.
  - **Decrease-Indent enablement**: greys at zero indent unless in a list (`st.inList` + rule).
  - **Show/Hide ¶ latch**: moved into the state machine (`st.formattingMarks` from the #pm-editor class; `H.showHide` flips the class + nudges sync; rule owns the latch).
  - **Sort**: dropped the un-Word "select multiple paragraphs" toast (silent no-op on <2 paras).
  - Alignment + list latches KEPT on the legacy TOGGLE_MAP path (avoid two writers of 'toggled'). All 14 Paragraph controls already worked; not layout-coupled. +4 tests.
  - **Deferred (Phase-4 / next slice):** per-glyph formatting marks (only ¶ renders) + Paragraph dialog "Line & Page Breaks" tab (both layout-coupled → deferrals.md A.1); dropdown menu completeness.
- **Broken Font button IDENTIFIED = "Text Effects & Typography"** (`textEffectsAndTypography`): every flyout action called the retired `E()=WC.Editor.applyInlineStyles` → live TypeError crash. **User locked: fix it FULLY (MS-Word-faithful + docx-exportable).** Research workflow (`text-effects-research`) running to map fork w14/OpenType support before building.
- **Gates:** PM **348/349** (1 = Windows-only `[10mm]` fixture skip), smoke **9/9**, roundtrip **27/0**.
- **Next:** build Text Effects (w14 outline/glow/shadow/reflection + OpenType ligatures/number-styles/stylistic-sets) per the research plan, with oracle docx round-trip; then Home tab PR.

## 2026-06-15 (Phase 3 — Home/Font eyeball bug fixes) — 3 user-found Font bugs fixed

- **Branch:** `fix/ribbon-home` (continues). **Phase:** Phase 3 Home tab — Font section eyeball loop.
- **3 user-found bugs (each root-caused via a headless probe, not guessed):**
  - **Strikethrough drew UNDER sub/superscript text** (`6b5020b`): schema nests `<s>` outside the
    `vertical-align` span, so line-through painted at the outer baseline. CSS fix moves the decoration to
    the inner shifted span (through the glyph middle). Edge limit (documented): a *partially*-super
    continuous strike run loses the strike on the non-super part.
  - **Sub/superscript ACTIVATED but wouldn't DEACTIVATE on an empty doc** (`d9fbca6`): on an empty
    paragraph sub/super lives in the paragraph RUN PROPERTIES, not storedMarks (probe: storedMarks:[]
    yet superscript:true); toggle-off sent vertAlign:null which `addParagraphRunProperty` merged but
    never cleared. Fork fix (NOTICE'd): clear run-property keys for nulled attrs. Probe: on→off→on works.
  - **Font color "sometimes didn't stay"** (`d9fbca6`): it landed on previously-touched text. `applyColor`
    now wraps the write in `withSelection` (restores the picker's captured range — the flyout blurs the
    editor) AND the main-face color handlers `captureSelection()` FRESH so they target the CURRENT
    selection, not a stale module-level `savedSel` from an earlier combo focus / picker open.
- **Process note:** the `font-bugs-investigate` workflow STALLED (returned empty / TaskStop "no task
  found"); I root-caused bugs 1+2 directly with probes. One stray workflow-agent edit (the `applyColor`
  withSelection wrapper) was left in the tree — verified correct (it's the picker half of the color fix)
  and folded in. Lesson: background agents launched with "propose only" can still leave working-tree edits.
- **Gates:** PM **344/345** (1 = Windows-only `[10mm]` fixture skip; +3 bug tests), smoke **9/9**, roundtrip **27/0**.
- **Next:** user visual eyeball to confirm all three feel right; then Home **section 3 = Paragraph**.

## 2026-06-14 (Phase 3 execution) — Home tab STARTED: Clipboard section built (ribbon state-machine spine + all locked features); test runs now headless on macOS

- **Branch:** `fix/ribbon-home` (off `main` @ `3400932`); **PR pending** (one branch/PR per tab).
- **Phase:** **Phase 3 — ribbon tab-by-tab hardening. Tab 1 = Home, section 1 = Clipboard** —
  functionally DONE (all locked builds + gates); **live-Word visual eyeball still pending** (needs the screen).
- **Env note (back on the MacBook):** the Windows COM oracle (`word-oracle-win.ps1`) is unavailable here;
  Phase-3 parity uses the **macOS AppleScript oracle** (`scripts/oracle/word-oracle.js`). Ribbon *enablement*
  greying isn't oracle-observable (doc-prop only) → it's a computer-use/visual check.
- **State summary:**
  - **Headless tests** (`81f48b8`): probe-mode `electron .` runs (test:pm/smoke/roundtrip) now run HIDDEN on
    macOS — `isHeadless` (a `--probe-out=` with no `--shot=`) sets the `accessory` activation policy + skips
    `mainWindow.show()`. No more window pop-up / focus-steal mid-work. `npm start` + `--shot=` QA unaffected.
  - **Clipboard scope LOCKED** (`8a3a930`, `docs/SCOPE.md`): Merge Formatting + Set Default Paste IN;
    auto-capture wired; **Paste Link OUT** (no OLE backend); state machine built here.
  - **Ribbon state-machine SPINE** (`7d2eb30`) — the reusable Phase-3 core, built once: a declarative
    per-control rule registry on `WC.Ribbon` (`stateRules` / `registerStateRule` / `applyStateRules`,
    rule = `{enabled?,latched?,value?}`; enabled→`wc-disabled`, latched→`toggled`). `toQueryState` carries
    the facts (hasSelection / canUndo/Redo / painterArmed / clipboardHasContent); the sync tick runs one
    `applyStateRules(st)` pass. Load-order-safe registration (`WC.registerRibbonRule` queues →
    ribbon.js drains `WC._pendingStateRules`). Clipboard rules: Cut/Copy enabled on a selection, Paste on
    clipboard content (external cache refreshed on window focus + after our ops), Format Painter latched
    (migrated off the slice-8 direct poke). **Later sections just register rules — don't scatter pokes.**
  - **Office Clipboard auto-capture** (`5c12180`): `capture()` on Cut/Copy (bridge) + a DOM `copy`/`cut`
    listener (keyboard); dedup makes the overlap safe — the 24-item pane history fills now (was dead in PM).
  - **Merge Formatting** (`353999c`): `mergeFormattingHtml()` strips inheriting run props (font/size/color +
    mso-* aliases, `<font>` attrs), keeps emphasis tags → pasted text adopts the destination style; the Paste
    dropdown "Merge Formatting" item enabled (was a disabled stub).
  - **Set Default Paste** (`f32b58c`): `D.setDefaultPaste` modal (Keep Source / Match / Keep Text Only),
    persisted to `localStorage`; `pasteDefault()` honors it via `defaultPasteMode()`.
  - **Keep Text Only autolink BUG fixed** (`f7fb8ad`, user-found via real-Word compare): pasting a URL with
    Keep Text Only made a blue underlined link. Fork edit (NOTICE'd) — `handlePaste` 'plain-text' branch
    early-returns when `editor.options.noPasteAutolink` is set; `pasteTextOnly` sets it around the paste.
    Default paste (Keep Source) still autoformats URLs like Word's AutoFormat.
  - **Context-aware Paste Options + Match Formatting label** (`d282074`, user-found): the Paste dropdown now
    drives every button's active/inactive from `pasteOptionStates(flavors)` (pure, testable) — an image
    disables the text options + enables Picture, etc. Renamed Merge→**Match Formatting** (user's Mac Word).
    KEY DECISION (user): Word's exact paste-option labels vary by OS/build, so the locked behavior is the
    **enablement state machine**, not the label set. (Researched: Mac "Match Formatting" = Win "Use
    Destination Styles"; list/table/Excel/chart sources show different button sets — a future enhancement.)
- **Home section 2 = Font — DONE** (kickoff via the `font-section-understand` workflow; scope locked in
  `docs/SCOPE.md`; built; adversarially reviewed via the `font-section-review` workflow):
  - **Empty font/size combo BUG fixed** (`57be59f` + review refinement `bc19f90`): the combos now always show
    the EFFECTIVE value for a collapsed cursor (new `effectiveFont()` — computed-style, Heading-aware →
    `converter.getDocumentDefaultStyles()` fallback) and blank only on a genuinely mixed selection. Review
    caught that the first cut re-derived mixedness from raw marks (over-blanked uniform style-driven
    selections); the fix TRUSTS the engine's existing resolved intersection (`getActiveFormatting`) and only
    falls back to `effectiveFont` for a collapsed cursor — also drops a redundant per-tick walk. + activeElement
    guard on the combo push; half-point sizes preserved.
  - **Font two-row arrangement** (`2b3bab7`): `renderFontGroupBody` renders Word's two rows (name/size/grow/
    shrink/case/clear · B/I/U/strike/sub/super/effects/highlight/color). Small split color bars (Highlight/Font
    Color) now anchor UNDER the glyph (`bc19f90`).
  - **Responsive ribbon Stage A** (`b63817c`, cross-cutting all 10 tabs): `installResponsive`/`relayoutRibbon`
    — a ResizeObserver on `#ribbon` (loop-safe) condenses the active tab (tighten → drop large labels → shrink
    large→small) until it fits, instead of clipping. Chevron gutter reserved via last-group margin (`bc19f90`).
    **Stage B (full group→flyout collapse, per-tab reduction order) is DEFERRED to a follow-up slice.**
  - **Note (real, informational):** the Home tab has 5 single-control groups (Voice/Sensitivity/Editor/Add-ins/
    Reuse Files) that ARE real Word Home groups (kept; only their cloud *features* are out of scope per SCOPE.md)
    but add width, so condensing engages at normal widths. Trimming/collapsing them = Stage B / a separate
    product call (review-confirmed this is NOT a defect in this diff).
- **Gates:** PM **341/342** (the 1 fail = `[10mm]` Leg-B reads a Windows-authored fixture absent on this Mac —
  self-skips "fixture not readable", NOT a regression; +14 new `[home]`/`[ribbon]` tests), smoke **9/9**, roundtrip **27/0**.
- **Next:** (1) **visual eyeball** of the Font arrangement + responsive condensing + Clipboard chrome (user-triggered —
  needs the screen); (2) Home **section 3 = Paragraph** (kickoff → scope-lock → register its state rules). Optionally re-author
  the `[10mm]` fixture via the Mac oracle for a fully-green `test:pm`.
- **Blockers/notes:** none. `fix/ribbon-home` carries 10 commits; PR the whole Home tab when its sections are done.
  Clipboard section: all locked builds done + 2 user-found issues fixed.

## 2026-06-14 (planning) — Phase 3 RE-SCOPED: ribbon tab-by-tab hardening pass + ribbon state machine; pagination pulled up to Phase 4

- **Branch:** `main` (planning only — no code branch yet; the first will be `fix/ribbon-home`).
- **Phase:** **Phase 3 — Editing-core hardening + scope finalization** (NEW). Re-sequenced from the old
  "Phase 3 = Logger". Full roadmap now: 3 hardening · **4 Pagination/layout engine** (was "last") · 5 Logger ·
  6 Verifier · 7 MCP · 8 hard-constructs verification · 9 docx round-trip · 10 RL loop · 11 cua-bench.
- **Why (user decision):** primary goal = a **fully working editing env first**. The editing core is the
  environment the future CUA agent acts on; logging/verifying a buggy editor = garbage in. "UI fidelity +
  feature preservation" are the locked constraints — so quality here is a project goal, not a detour.
- **The method (Phase 3 loop):** tab-by-tab, section-by-section. **Section kickoff is a HUMAN GATE** — I do
  a general research sweep, propose in/out scope, **user locks scope** (→ `docs/SCOPE.md`). Then per in-scope
  feature I run autonomously: research Word **+ enablement/checked rules** → **three-sided compare** (Word
  reference via COM oracle + live Word, vs the **clone's actual in-env behavior driven live** — real effect +
  its *scope* + edge cases + control state) → **fix-now vs layout-flag** (my call) → fix + regression test +
  eyeball visuals → three gates. **One branch/PR per tab** (`fix/ribbon-<tab>`), commit per section, merge to `main`.
- **Ribbon STATE MACHINE (first-class, concurrent):** a real systemic gap (most controls are always-active).
  Two facets per control — **enablement** (grey when unusable) + **checked/latch + value**. Build a thin
  shared spine ONCE in the first section (one evaluator recomputing enablement per transaction + a declarative
  per-control rule registry, extending `PM.queryState()`→ribbon); each section registers its rules. Enablement
  IS `test:pm`-assertable → real regressions. Don't scatter ad-hoc `wc-disabled` pokes (slice-8 style).
- **Layout = the hard gap, handled as FLAG-AS-SPEC.** We do NOT build the engine first. Architecture is RIGHT
  (PM/OOXML/Word all = a text-flow doc + an anchored floating-object layer; the gap is a missing layout engine,
  not the model — confirmed vs `docs/PAGINATION.md`: "no `repaginate()` engine today"). Two layers: vertical
  pagination (precedented) + floating-object positioning & **text-wrap** (harder; browsers don't do shape-aware
  wrap). **Classifier — flag, don't fix:** multi-page / floating-object position / text-wrap /
  headers-footers-on-page / columns / vertical page geometry. **Flag-don't-hack rule (non-negotiable):** layout
  bugs → `deferrals.md` §A.1 (the accumulating Phase-4 spec), NEVER a continuous-flow DOM hack (the legacy
  spacer-hack was deleted in slice 11 — don't grow a new one). Phase 4 builds the engine model-driven (PM plugin
  + overlay) to CLEAR those flags + add multi-page; validated vs oracle.
- **Docs written this session:** `plan.md` (roadmap re-sequence + "pagination LAST"→Phase 4); `execution-map.md`
  (CURRENT PHASE rewritten + daily-log entry); this entry; new `docs/SCOPE.md` (in/out registry, three buckets);
  `deferrals.md` (§A Phase-7→Phase-4 + new §A.1 layout-engine-requirements + flag-don't-hack rule); resume-point
  memory ([[phase3-ribbon-hardening-resequence]]).
- **Next:** start **Tab 1 = Home**, section **Clipboard** — cut `fix/ribbon-home`, section kickoff (propose
  in/out scope → user locks), set up the state-machine shared spine, run the loop.
- **Blockers/notes:** docs are written but **NOT yet committed** (awaiting user go — per the never-work-on-main
  rule, likely committed on the first `fix/ribbon-home` branch or a quick `docs/phase-3-rescope` branch).
  Graphify refresh still deferred (Windows absolute-path bug). The three gates remain PM 326 / smoke 9 / roundtrip 27.

## 2026-06-14 — Slice 11 (legacy retirement) DONE: dual-world scaffolding retired — the PM engine is the ONLY editor (Phase 2 editing core COMPLETE)

- **Branch:** `feature/phase-2-slice-11-legacy-retirement` (off `main` @ `18bd70b`); **PR pending** into `main`.
- **Phase:** **Phase 2 — slice 11 DONE → Phase 2 editing core COMPLETE (all slices 0a–11) → Phase 3 (Logger) next.**
  The strangler-fig migration finishes by removing the legacy host it grew around.
- **State summary:** the dual-world scaffolding that ran since slice 0a is GONE — PM (ProseMirror/SuperDoc-fork)
  is the single editor. **Net −4229 lines / 54 files.** REMOVED: the `--legacy` boot flag + `?legacy=1`
  forwarding + `bridge/mode.ts`; the legacy contenteditable `WC.Editor` (`editor.js`) + the `#editor` DOM; the
  leaf legacy engines `formatting.js`/`comments.js`/`table-tools.js`/`layout-tools.js`/`header-footer.js` + the
  `review-tools.js` Track-Changes engine; the legacy docx converter (`html-to-docx`/`mammoth`/`src/main/docx-utils.js`
  + the `copyDocxUtilsPlugin` vite step + the `doc:save`/`doc:saveAs` IPC + `wordAPI.save`/`saveAs`); the 3 frozen
  legacy gates (`test:legacy`/`test:smoke:legacy`/`test:docx`) + `scripts/test-suite.js`/`test_docx.js`/
  `export_ref.js`/`analyze_import.js`. COLLAPSED every dual-world `pm ? PM : legacy` branch to PM-only across
  commands.js/dialogs.js/app.js/files.js/ribbon.js/backstage.js/mailings-tools.js/insert-features.js + the
  conflict-keep files. **Migrated onto the `WC.PM` bridge** (the legacy editor secretly still owned these in PM):
  zoom + view-mode (`setZoom`/`zoomIn`/`zoomOut`/`setView`, driving the `#pages` scale() transform the PM overlays
  depend on), the styles catalog (`WC.Styles`→`WC.PM.allStyleNames`), the Office-Clipboard paste
  (`WC.Clipboard.paste`→`pm.pasteHTMLString`), and the equation built-ins (→`pm.insertEquation`). **D6:** retired the
  vestigial flip-tracking (`FLIPPED`/`isFlipped`); KEPT `isBlocked`/`notifyBlocked` rewritten against a static
  `DEFERRED` set ({layout-page, layout-arrange, header-footer, text-effects}) as the **permanent Phase-7 deferral
  gate**. KEPT (shared chrome, still classic `<script>` tags — the `window.WC`→TS/ESM migration is a DEFERRED future
  slice): ribbon/commands/dialogs/util/icons/app/files/backstage/statusbar/00-netlog/table-tools-pm + the value/state
  tables in design/draw/references/review/home-features. `jszip` kept; `lodash` promoted to an explicit dep (was
  transitive via html-to-docx).
- **Process discoveries (caught by the gates + leak audit, NOT the up-front critique):** 3 hidden conflicts —
  `WC.Styles` (style catalog read by dialogs.js), the `WC.Editor` zoom/view ownership (deleting it aborted boot via
  `StatusBar`→`E().zoom`), and the `lodash` transitive dep — plus **4 reachable `E()` leaks** (the equation dropdown
  built-ins; the shapes / Excel-Spreadsheet / Draw-Table inserts) — all fixed (PM verb or honest toast). Final leak
  audit: **zero reachable `E()`** (remaining E() only in `isBlocked`-gated deferred-area handlers — intentional
  Phase-7 residue).
- **Done this session (per-commit):** `8f882fe` plan · `481b50c` `[11]` guards · `4959334` flag/boot · `dfb0d9a`
  leaf engines + WC.Styles reroute · `d01c3bf` WC.Editor delete + zoom/view migration · `21e46f6` converter removal ·
  `7e4ea76` converter oracle · `e22c5a8` commands.js collapse · `17939a0` conflict-file prune · `735e144`+`87854d1`
  dialogs/ribbon/backstage/mailings/app/files/preload collapse · `2f07560` D6 reframe · `c1e76d2`
  insert-features/statusbar dead-arm collapse · `ccf790c` commands.js E() leak sweep · `1080d4f` single-world docs ·
  `a065ae8` review-followup cleanup. Executed subagent-driven (fresh agent/task; coordinator review + leak audit +
  gates after each; ultracode 7-mapper pre-verification + 3-critic plan critique + 2-reviewer whole-branch review).
- **Gates (now THREE):** PM **326/326** (idle — flakes only under heavy concurrent load, a recorded deferral),
  smoke **9/9**, roundtrip **27/0**. test:legacy/test:smoke:legacy/test:docx retired; test-suite.js archived in git
  tag `legacy-suite-257-archive`.
- **Oracle vs Word for Windows 16.0:** converter-removal **Leg A PASS** — `word-oracle-win.ps1 roundtrip` on a fresh
  PM-exported docx → ROUNDTRIP_OK (no repair). The fork super-converter is the sole faithful .docx path.
  `docs/superpowers/plans/notes/2026-06-14-slice11-converter-oracle.json`.
- **Whole-branch review:** 2 adversarial reviewers (feature-preservation + leak/correctness), each ran the gates →
  both **Ready to merge: Yes**, zero Critical/Important; only cosmetic minors (dead-line + stale `--legacy` comments
  folded in `a065ae8`).
- **Deferrals recorded (deferrals.md):** `window.WC`→TS/ESM migration (future slice); shapes / Excel-Spreadsheet /
  Draw-Table / Dictate / sensitivity → honest toasts (were silently-broken-in-PM since slice 10); the 4 Phase-7
  deferred areas stay honestly `isBlocked` (their commands.js handler bodies are dead Phase-7 stubs awaiting Phase 7);
  Office-Clipboard pane opens but auto-capture is best-effort in PM.
- **Next:** PR into `main` → **user approval** → merge (merge-commit) → delete branch → refresh the graph
  (/graphify). Then **Phase 3 (Logger)**.
- **Blockers/notes:** none. The user's Word window untouched (PID-safe oracle).

## 2026-06-13 — Slice 10 PR 4 (draw) DONE: Draw-tab ink FLIPPED to REAL exportable freeform shapes (oracle Leg A+B PASS)

- **Branch:** `feature/phase-2-slice-10-draw` (off `main` after the insert-exotica merge); **PR pending** into `main`.
- **Phase:** **Phase 2 — slice 10 PR 4 (draw) DONE → slice 11 (legacy retirement) next** (slice 10 complete: mail-merge · themes · insert-exotica · draw all flipped).
- **State summary:** area **`draw` FLIPPED** at **maximal real-MS-Word fidelity** — and a STRICT UPGRADE over legacy (whose
  SVG ink never exported to .docx). Freehand strokes now persist as **real DrawingML freeform shapes**: net-new fork command
  **`insertInkShape`** + `synthesizeInkDrawing` (`extensions/vector-shape/vector-shape.js`, NOTICE'd) builds a real
  `a:custGeom`/`a:pathLst` (moveTo + quadBezTo from the smoothed points) + an `a:ln` pen stroke, wrapped **`wp:anchor`** (floats
  where drawn) on a `vectorShape.drawingContent` blob the existing `translateVectorShape` replays verbatim (zero new exporter
  code — the WordArt mechanism); docPr id via `generateDocxRandomId` (process-unique, avoids the PR3 cover-id collision class);
  `VectorShapeView` renders empty for `isInk` (the overlay owns paint). New **`bridge/draw.ts`** (`d*` verbs: dInsertInk,
  dInsertCanvas [a real bounded `prstGeom rect` shape], dSetDrawing/dIsDrawing/dSetEraser/dSetSelect/dSetLasso/dSetPen/dReplay/
  dClearInk [non-dirtying tool state], dInkToShape/dInkToMath honest toasts) + new **`bridge/ink-overlay.ts`** (the PM-only live
  ink overlay: a `.wc-ink-layer` `#pages`-sibling that captures strokes, persists each as a real shape on pointerup, and renders
  ALL ink from the doc — both freshly-drawn `inkPoints` AND reopened importer `customGeometry.paths`, the K3 render-loss fix).
  Legacy `WC.Draw`/`commands.js`/`ribbon.js` (incl. the pen-tile dispatch bypass, two-state preserved) re-pointed via `PMA()`
  (legacy ELSE byte-identical; leak audit clean — the only WC.Draw mutations left are legacy-ELSE arms / pmGuard'd onDocLoad).
- **Oracle vs Word for Windows 16.0 (PID-safe):** **Leg A+B PASS.** An EARLY Task-1 gate proved the custGeom blob opens in Word
  (inline + anchor both EXIT=0) BEFORE building the overlay/flip — the PR3 lesson that only the COM oracle catches schema-fatal
  constructs → kept `INK_MODE='anchor'`. Leg A: Word opens a 3-stroke (black/red/highlighter) + canvas doc **without repair** and
  **preserves** `a:custGeom`/`a:pathLst`/`wp:anchor` + the pen colors + the **highlighter alpha** + the `prstGeom rect` on resave.
  Leg B: clone re-imports Word's serialization healthy and the overlay renders all 3 imported strokes (render-from-paths validated
  on Word's bytes). See `notes/2026-06-13-slice10-draw-oracle.json`.
- **Done this session (per-commit):** `cd9a22f` critique-hardened plan · `b1dabde` red `[10dr]` tests · `cfeedd1` fork
  `insertInkShape`+`synthesizeInkDrawing`+`isInk` (+ the early oracle gate) · `cb31e41` fork `VectorShapeView` empty-for-ink ·
  `fcc43cc` `bridge/draw.ts` + wiring · `35287ef` `bridge/ink-overlay.ts` + CSS + relink · `15feaee` re-point
  WC.Draw/commands.js/ribbon.js · `942f486` THE FLIP + leak audit · `7a33d0a` oracle probes + verdict.
- **Gates:** PM **317/317**, legacy **257/257 byte-identical**, smoke **9/9 ×2**, roundtrip **27/0**, docx **17/0**.
- **Deferrals recorded (deferrals.md):** real InkML `w14:contentPart` ink (net-new, no oracle); real `wpc:wpc` Drawing Canvas
  (degraded to a real rect frame); inkToShape/inkToMath; `arcTo` in custGeom (parser drops it; the smoother never emits arcs);
  highlighter = fat translucent freeform (not Word's true highlighter fill). **Manual-verify note:** live pointer-capture
  drawing is ported from the proven legacy geometry but can't be exercised headlessly — recommend a manual draw in `npm start`.
- **Next:** PR into `main`, merge, delete branch, refresh graph (/graphify). Then **slice 11 (legacy retirement)**.

## 2026-06-13 — Slice 10 PR 3 (insert-exotica) DONE: Insert-tab exotica FLIPPED at real-Word fidelity (oracle Leg A+B PASS)

- **Branch:** `feature/phase-2-slice-10-insert-exotica` (off `main` after the themes merge); **PR pending** into `main`.
- **Phase:** **Phase 2 — slice 10 PR 3 (insert-exotica) DONE → slice 10 PR 4 (draw) next** (then slice 11 legacy retirement).
- **State summary:** area **`insert-exotica` FLIPPED** at **maximal real-MS-Word fidelity**. The 14 exotic Insert
  commands dispatch to the new **`bridge/insert-exotica.ts`** (`installInsertExotica`, 15 `xe*` verbs): **dropCap** =
  real `w:framePr` (`setNodeMarkup` paragraphProperties.framePr); **coverPage** = real `w:sdt` docPartObj content
  (replace-existing); **dateTime/quickParts** = real `DATE`/`AUTHOR`/`PAGE`/… `w:fldChar` fields
  (`editor.doc.fields.insert`, references.ts inlineTarget pattern); **screenshot/icons/onlinePictures** = real
  `w:drawing` images (`PM.insertImage`); **textBox** = editable VML `v:textbox` via a net-new fork command
  `insertTextBox` (`extensions/shape-textbox/shape-textbox.js`, NOTICE'd — inserts shapeContainer>shapeTextbox>paragraph,
  the existing VML exporter synthesizes the `<v:textbox>`); **WordArt** = real DrawingML via a net-new fork command
  `insertWordArt` + `synthesizeWordArtDrawing` (`extensions/vector-shape/vector-shape.js`, NOTICE'd — a `wps:wsp` +
  `bodyPr fromWordArt` + `a:prstTxWarp` + `w14:textFill` blob on `drawingContent`; the replay exporter re-emits it);
  **onlineVideo** = real hyperlink + Phase-7 toast; **chart/smartart/object(OLE)/signatureLine** = honest no-op toasts
  (no fork construction path — recorded follow-ups). 2 net-new fork commands total. Legacy `WC.Insert.*` + commands.js
  re-pointed via the PM guard / `PMA()` (legacy ELSE byte-identical; leak audit clean — incl. the screenshot leak the
  first audit grep missed, and the dropCap()/insertWordArt() local mutators that dirty via E().dirty/repaginate, all
  guarded at their callers).
- **Oracle vs Word for Windows 16.0 (PID-safe):** **Leg A+B PASS.** First `all`-doc run FAILED Word open (EXIT=1);
  bisected to the **coverPage** as the sole culprit — the sdt `<w:id w:val>` is an ST_DecimalNumber, and the
  critique-driven non-numeric string id (`'wc-cover-…'`) was a hard schema violation. **Fixed** to a digits-only string
  (`String(Date.now()%1000000)` — survives sanitizeId AND validates). After the fix Word opens the full 5-construct doc
  **without repair** and **preserves** framePr/dropCap, sdt docPartObj, DATE fldChar, WordArt wps:wsp+prstTxWarp, and VML
  v:textbox on resave (Word canonicalizes the WordArt color). Leg B: clone re-imports Word's serialization healthy
  (cover→editable documentPartObject, WordArt→vectorShape; textBox/DATE→passthrough). See
  `notes/2026-06-13-slice10-exotica-oracle.json`.
- **Done this session (per-commit):** `861b6c7` critique-hardened plan · `59b62ed` red `[10ex]` tests · `c77b394` fork
  `insertTextBox` · `4bd1874` fork `insertWordArt` · `003b2c7` `bridge/insert-exotica.ts` + wiring · `b2add2b` relax
  `[10ex]` textBox round-trip (export-reality + passthrough survival) · `b827c85` re-point WC.Insert/commands.js ·
  `8262258` THE FLIP + leak audit (+ screenshot guard) · `28d28e0` cover-id oracle fix · `81b70eb` oracle probes + verdict.
- **Gates:** PM **310/310**, legacy **257/257 byte-identical**, smoke **9/9 ×2**, roundtrip **27/0**, docx **17/0**.
- **Deferrals recorded (deferrals.md):** block-level VML-textbox import (clone reopen → passthrough, editability lost —
  EXPORT is real, user-approved); WordArt non-editable + flat in-app (warp renders in Word only); dropCap 'drop' not
  painted in-app (fork dropcapPlugin only renders 'margin'); icon SVG-only `w:drawing` (no raster fallback);
  chart/smartart/OLE/signatureLine no construction path; onlineVideo no `wp15:webVideoPr`.
- **Next:** PR into `main`, merge, delete branch, refresh graph (/graphify). Then slice 10 PR 4 (draw).

## 2026-06-13 — Slice 10 PR 2 (themes) DONE: area `themes` FLIPPED with real named-style redefinition + w:background

- **Branch:** `feature/phase-2-slice-10-themes` (off fresh `main` @ `38bf7cf`); **PR pending** into `main`.
- **Phase:** **Phase 2 — slice 10 PR 2 (themes) DONE → slice 10 PR 3 (insert-exotica) next** (then draw).
- **State summary:** area **`themes` FLIPPED** at **maximal real-MS-Word fidelity**. themes/styleSet/colors/fonts
  **redefine NAMED-STYLE DEFINITIONS** (Heading1/2/3/Title/Subtitle/Normal) so headings restyle like real Word —
  net-new fork command **`redefineNamedStyles`** (`extensions/linked-styles/linked-styles.js`, NOTICE'd) that mutates
  BOTH the export structure (`converter.translatedLinkedStyles.styles` + `syncStylesDiffToConvertedXml` → real
  `<w:style><w:rPr>` font+color in `word/styles.xml`, **DELETING the theme bindings** `w:asciiTheme`/`w:themeColor` so
  Word honors the literal — K9) AND the visual structure (`converter.linkedStyles[].definition.styles` — the array the
  linked-styles decoration plugin reads), then forces a decoration regen (re-stamp styled paragraphs, `addToHistory:false`,
  PREVIEW_META-tagged in hover mode so a hover never dirties) + `stylesDefaultsChanged` emit. **pageColor** = net-new real
  **`w:background`** exporter/importer + a `background` doc-node attr + a `displayBackgroundShape` settings flag (4 fork
  edits, NOTICE'd). **pageBorders** = real `w:pgBorders` via `editor.doc.sections.setPageBorders`; **paragraphSpacing** =
  real docDefaults `w:spacing` via `editor.doc.styles.apply`. **watermark** = honest visual stand-in + toast (real header
  watermark = Phase-7); **effects/setAsDefault** = clone-owned (no OOXML). New **`bridge/design.ts`** (17 `de*` verbs +
  hover live-preview snapshot/restore for themes/colors/fonts; styleSet/paragraphSpacing commit-only — spacing isn't
  cheaply previewable) + `PM.markDirty()` in `bridge/io.ts`. `WC.Design` re-pointed via `PMA()` (legacy ELSE byte-identical;
  leak audit clean — every design mutation site PMA()-guarded). No D6-guard repoint (themes ≠ margins/header).
- **Done this session (per-commit):** `990d1fa` critique-hardened plan · `9ce22aa` red `[10th]` tests · `5ab3190`
  test-assertion sync · `7e9fcb9` fork `redefineNamedStyles` · `ffd75f7` fork `w:background` · `5ac7e48` `bridge/design.ts`
  + wiring + io.ts markDirty · `e4b1a24` re-point `WC.Design` · `89b2348` THE FLIP + leak audit · `06bfeb5` fix
  hover-preview-dirty (final-review catch) · `b25292c` oracle probes + verdicts. Executed subagent-driven (6 tasks,
  two-stage review each; plan 3-critic-hardened; final whole-branch review caught the hover-dirty bug).
- **Gates (six):** PM **299/299**, legacy **257/257** (byte-identical), smoke **9/9 ×2**, roundtrip **27/0**, docx **17/0**.
- **Oracle vs Word for Windows 16.0** (`notes/2026-06-13-slice10-themes-oracle.json`): **Leg A clone→Word PASS** —
  `word-oracle-win.ps1 roundtrip` → ROUNDTRIP_OK (no repair); Word's resave PRESERVED `w:background` (FFF2CC) +
  `displayBackgroundShape` + `w:pgBorders` (2E74B5) + Heading1/Title color (C00000) + Normal font (Georgia) + docDefaults
  spacing (260); the K9 theme-binding deletes held. Heading FONT survives via Normal-inheritance (Word optimizes away the
  redundant explicit Heading1 override — faithful). **Leg B Word→clone PASS** — clone imports Word's own serialization
  healthy; all constructs survive import+re-export. **Live heading repaint CONFIRMED** (decoration span flips Aptos→Georgia
  + dark red after `deApplyTheme`).
- **Recorded deviations (ledger):** heading font via Normal-inheritance (Word's redundant-override optimization, faithful);
  docDefaults font reverts to theme `minorHAnsi` on resave but is overridden by Normal's explicit Georgia (cosmetic);
  Style Sets + Paragraph Spacing galleries are commit-only (no hover preview — spacing isn't cheaply live-previewable;
  themes/colors/fonts DO preview); body-font live render for styleId-less paragraphs best-effort (K2); named-style
  redefinition writes literal fonts/colors (not theme1.xml `clrScheme`/`fontScheme` token indirection — K5, deeper-fidelity
  follow-up); watermark + on-page pageBorders/pageColor render = Phase-7 (model/export real now).
- **Next:** slice 10 PR 3 = **insert-exotica** (coverPage/wordArt/dropCap as PM content), then draw. **Blockers/notes:**
  none. `C:\tmp` holds the oracle artifacts (`wc-slice10-themes-clone.docx`, `wc-slice10-themes-resaved.docx`). The
  `sd:mergeField`/named-style-redefinition fork patterns are templates for the carry-over fork-importer gaps (deferrals.md).

---

## 2026-06-12 — Slice 10 PR 1 (mail-merge) DONE: area `mail-merge` FLIPPED with real MERGEFIELD round-trip

- **Branch:** `feature/phase-2-slice-10-mail-merge` (off fresh `main`); **PR pending** into `main`.
- **Phase:** **Phase 2 — slice 10 PR 1 (mail-merge) DONE → slice 10 PR 2 (themes) next** (then exotica, draw).
- **State summary:** area **`mail-merge` FLIPPED** with **maximal real-MS-Word fidelity** (user-directed:
  real `MERGEFIELD` field codes, NOT `w:sdt` content controls — saved to memory `slice10-prefer-real-word-constructs`).
  Merge fields are the fork's mounted **`FieldAnnotation`** node (its `update`/`highlight`/`hideByCondition`
  commands back preview/highlight/rules — no new node). New fork work, BOTH directions (NOTICE'd):
  **export** branches `translate-field-annotation.js` → `w:fldSimple` (MERGEFIELD/GREETINGLINE) · 5-run
  `w:fldChar` (ADDRESSBLOCK) · **3-run** `w:fldChar` (NEXT, no spurious result), non-merge annotations
  still emit `w:sdt`; **import** = `mergefield-preprocessor.js` (covers both fldSimple+fldChar via the
  registry) + a `sd:mergeField` **`NodeTranslator`** (`encode`→`fieldAnnotation`, flag-independent of
  `editor.options.annotations`) + a `generateV2HandlerEntity` in `docxImporter.js` (the load-bearing 3rd
  wiring point the critique caught). New **`bridge/mail.ts`** (8 verbs: insert/addressBlock/greetingLine/
  rule/highlight/**non-destructive preview via `updateFieldAnnotations`**/PM-aware `mmBuildMerge`/finish).
  `WC.Mail` doc-writes + `commands.js:878/:903` rule inserts re-pointed via `PMA()` (legacy ELSE
  byte-identical; leak audit clean — 12 `E()` calls all behind guards); both `[0a]` D6 guards repointed
  `startMailMerge`→`margins`/`header` (Phase-7-gated, stay blocked through slice 11).
- **Done this session (per-commit):** `ea02757` red `[10mm]` + `[0a]` repoint · `2677ec1` export branch ·
  `68d42c5` import (preprocessor+NodeTranslator+handler entity) · `d76065c` bridge/mail.ts · `1738798`
  re-point + THE FLIP + leak audit · `e9e2242` task-5 review fixes (`_mergeResolve` unifies PM merge with
  preview via `_val`; `checkErrors`/`mmBuildMerge` read immutable `data-default-display-label`) · `550180a`
  oracle. Plan `e88bc11` (4-reader gather + 3-critic hardened). Executed subagent-driven (two-stage review).
- **Gates (six):** PM **285/285**, legacy **257/257** (byte-identical), smoke **9/9 ×2**, roundtrip **27/0**, docx **17/0**.
- **Oracle vs Word for Windows 16.0** (`notes/2026-06-12-slice10-mailmerge-oracle.json`): **Leg A clone→Word
  PASS** — `word-oracle-win.ps1 roundtrip` → ROUNDTRIP_OK (no repair prompt); Word's own resave PRESERVED
  all 5 field codes (MERGEFIELD FirstName/Last_Name [underscore intact], ADDRESSBLOCK, GREETINGLINE, NEXT),
  canonicalizing `w:fldSimple`→`w:fldChar` (benign); NO `w:sdt` leak, NO spurious «Next Record». **Leg B
  Word→clone PASS** — the automated `[10mm] IMPORT (Leg B)` test loads the real-Word fixture
  (`C:\tmp\wc-slice10-mergefields.docx`) and imports all 4 field types as `fieldAnnotation` nodes. So merge
  fields are REAL live Word fields, not content controls. A 2-lens review of the flip commit ran clean on
  byte-identity+leak and caught 2 majors on gate-untested paths (fixed in `e9e2242`).
- **Recorded deviations (ledger):** rule-field IF/FILLIN operator semantics deferred — export is
  structurally valid but `Equal to`≠Word `=` so IF won't auto-evaluate (C, D10.9); previewed-composite
  ADDRESSBLOCK/GREETINGLINE import as the `«…»` placeholder, plain MERGEFIELD lossless (C, D10.12);
  envelopes/labels page geometry pagination-gated (A) — PM paths insert real content or toast, never `E()`.
- **Next:** slice 10 PR 2 = **themes** (re-point `WC.Design`; the levers are `editor.doc.styles.apply`
  docDefaults + `sections.setPageBorders`; pageColor/watermark degrade). **Blockers/notes:** none. The
  fork-importer `NodeTranslator` pattern from this slice could also close the slice-9 SEQ/CITATION import
  gap. Computer-Use visual Mailings parity = optional follow-up (COM oracle already validated functionally
  vs the user's Word). `C:\tmp` holds the oracle artifacts (`wc-slice10-clone.docx`, `wc-slice10-resaved.docx`).

---

## 2026-06-12 — Slice 9 (references) DONE: area `references` FLIPPED onto the PM engine

- **Branch:** `feature/phase-2-slice-9-references` (off fresh `main` @ `61e5ec4`); **PR pending** into `main`.
- **Phase:** **Phase 2 — slice 9 (references) DONE → slice 10 (themes/mail-merge/draw/insert-exotica) next.**
- **State summary:** area **`references` FLIPPED**. The fork already MOUNTS the full references
  extension family and EXPOSES the **SuperDoc Document API** (`editor.doc.*`, the slice-8
  comments-export path), so the slice is wiring, not engine-building. New **`bridge/references.ts`**
  (25 `ref*` verbs over `editor.doc.{toc,create.tableOfContents,footnotes,captions,citations,
  crossRefs,index,authorities,fields,format.paragraph.setOutlineLevel}`; the caret→Document-API
  address crux solved by minting an `sdBlockId` on the caret block when `selection.current().target`
  is null; citation minted-source-id flow) + **`bridge/notes-area.ts`** (D9.1 clone-owned
  continuous-flow `#pm-notes-area`, sibling of `#pm-editor`, rendering `footnotes.list()` with
  plain-text body edit via `footnotes.update`; focused-dirty clobber guard). Every References
  `H.*`/flyout/dialog re-pointed via `PMA()`→bridge (legacy ELSE byte-identical; leak audit clean).
  NOTICE'd fork fix: `toc-entry-builder.ts` reads `outlineLevel ?? outlineLvl` so Add-Text feeds the
  TOC. Both `[0a]` D6 guards repointed `tableOfContents`→`startMailMerge`.
- **Done this session (per-commit):** `3c08fed` red `[9]` tests + D6 repoint · `b0a2194`
  bridge/references.ts (+22 `[9]` coverage; the coverage pass caught + fixed a bibliography
  title→style export bug and an Add-Text wrong-namespace no-op) · `37bfa2e` D9.1 notes area
  (clobber guard added in review) · `6098fa5` re-points + **THE FLIP** + Mark-Citation numeric `\c`
  + refAddSource flat→`b:Source` mapping + the NOTICE'd fork fix · `d820fea` oracle.
- **Gates (six):** PM **275/275**, legacy **257/257** (byte-identical), smoke **9/9 ×2**,
  roundtrip **27/0**, docx **17/0**.
- **Oracle vs Word for Windows 16.0** (`notes/2026-06-12-slice9-oracle.json`): **Leg A clone→Word
  PASS** — `word-oracle-win.ps1 roundtrip` → ROUNDTRIP_OK; Word resaved the clone references docx
  and PRESERVED every construct unchanged (footnotes/footnoteRefs/tocFields/seqFields/citationFields/
  sources, before==after via the extended `docx-inspect.js`). **Leg B Word→clone PARTIAL** — importing
  Word's own serialization is healthy (no contentError/blank); footnotes + TOC import faithfully, but
  the **pre-existing fork converter drops SEQ caption + CITATION complex fields on import** (caption
  text survives; in-text citation vanishes).
- **Recorded deviations (ledger):** TOC/ToF/Index/ToA page numbers + caption SEQ numbers + rendered
  citation/bibliography text are layout-gated (Phase 7) — the field codes export and Word repopulates
  on F9 (Leg A confirms). Note bodies are plain-text; bibliography flyout title is cosmetic (no fork
  slot); Manual Table degrades to an auto TOC. **Carry-over (prioritized follow-up):** the fork docx
  importer does not map SEQ/CITATION complex fields → nodes (Leg B) — a NOTICE'd fork-importer fix is
  recommended.
- **Next:** slice 10. **Blockers/notes:** none for the PR. Word never disturbed (PID-safe fresh
  hidden instance, foreground); `C:\tmp` holds the oracle artifacts (`wc-slice9-clone.docx`,
  `wc-slice9-resaved.docx`).

---

## 2026-06-11 (bug-fix batch) — 3 user-reported editor fixes (page-click + styles) → main

- **Branch:** fixes shipped on `fix/page-click-and-style-scope` (**PR #26**) +
  `fix/page-click-to-doc-end` (**PR #27**), both **merged to `main`** and the branches deleted.
- **Phase:** unchanged — **Phase 2, slice 8 (review) DONE → slice 9 (references) next.** These are
  post-slice-8 bug fixes, not a phase move.
- **State summary:** three user-reported usage bugs, each systematic-debugged (probe-proven root
  cause in the built app) and shipped with regression tests:
  - **Page-margin click placed no caret** (`5c4ee25`). Root cause (proven via
    `document.elementFromPoint`): the page sheet `#pm-editor` realizes the page margins as PADDING
    (fork print-layout inline styles) and the editable `.ProseMirror` only covers the content box,
    so the margins + the area below the last paragraph hit the non-editable wrapper (`inProse=false`)
    → no caret, view blurred (the slice-8 overlays were exonerated — both `pointer-events:none`). Fix:
    `bridge/focus.ts` PM-only, live-editor mousedown handler — `posAtCoords` (clamped into the
    `.ProseMirror` box) maps the click to the nearest text position + focuses.
  - **Styles changed everything on hover** (`5cf317d`). Investigation: the ENGINE scope is already
    correct (caret → its paragraph; selection → the selection; the fork applier's
    stale-`lastSelection`/`preservedSelection` fallback is UNREACHABLE in this clone — those snapshots
    are only set by SuperDoc's `.sd-toolbar-button` mousedown / outside-editor paths our ribbon never
    triggers). The real cause was the slice-3 **hover Live Preview**. **Product decision: PM mode no
    longer drives Live Preview on hover** (`ribbon.js` stylePreviewEnter/Leave no-op in PM) — styles
    apply on **CLICK only**, scoped correctly (selection → selection; caret → current paragraph). The
    bridge preview mechanism (`style-preview.ts`) stays for a possible opt-in; `--legacy` keeps its
    snapshot preview.
  - **Click below the text didn't go to the end** (`86540d6`). Refinement: clicking the BLANK area
    below all content now sends the caret to the document END (`Selection.atEnd`, Word's Ctrl+End /
    "son yazılan yer"), regardless of the horizontal click-x — `posAtCoords`-nearest had dropped it at
    the nearest wrapped-line start. Beside-text clicks keep the clamped `posAtCoords` mapping.
    `Selection` added to the `@/pm` barrel.
- **Gates (six, after the batch): PM 241/241** (+4 regression tests: below-content→doc-end +
  left-margin caret placement; hover-no-op; click-scope by selection vs caret), legacy 257/257,
  smoke 9/9 ×2, docx 17/17, roundtrip 27/27.
- **Recorded decision (ledger C):** PM-mode styles have **no hover Live Preview** — click-to-apply
  only (user-directed 2026-06-11; reversible — only the gallery's hover wiring is disabled).
- **Next:** slice 9 (references). **Blockers/notes:** none. Word never launched for this batch
  (all evidence via in-app probes + the existing suites).

## 2026-06-11 (close-out) — Slice 8 DONE + merged to main; loop process RETIRED

- **Branch:** `feature/phase-2-slice-8-review` → **PR #25 merged to `main`**; the
  `completion-driven-agent-loop` branch deleted (its 5 commits — Step-0 Windows
  replication + spec capture — are fully contained in the slice-8 history).
- **Phase:** **Phase 2 — slice 8 (review) DONE → slice 9 (references) next.**
- **Process change (user decision):** the completion-driven agent loop is **retired** —
  back to the plain per-slice PR flow into `main`. `docs/loop/` removed; the deferral
  ledger (process-independent) moved to `docs/plan/deferrals.md`; execution-map CURRENT
  PHASE + banners normalized. Historical log entries stay (append-only).
- **State summary:** area **`review` FLIPPED** — the full Review tab runs on the PM
  engine: Track Changes (latch/chords/lock dialog), tracked ins/del/format render +
  bars/balloons/Revisions pane, modern contextual comment cards (Document-API path —
  comments EXPORT), accept/reject(+advance)/all/by-selection, 4 display modes, Show
  Markup latches, Track Changes Options (+Advanced) + Change User Name, Compare →
  REAL tracked-changes diff (`PM.runCompare`), Restrict Editing (engine `setEditable`),
  proofing re-points (Word Count/Editor pane/Thesaurus/Accessibility/Read Aloud
  per-word `::highlight`/Language/Spelling), R2/R3 enablement greys, D8.8 mode pill.
- **Done this session (tasks 6–9 of the plan, direct execution — no loop):**
  - `16ebaee` task 6 — review dialogs + proofing PM-safe (D8.5–D8.7). Systematic-debug
    catch: `runCompare`'s naive `paraPos+1+offset` mapping was off by the fork's inline
    **run-node boundary tokens** (probe-proven); rewritten **right-to-left with a fresh
    offset→position map per op** (tracked deletes keep text ⇒ no shift arithmetic).
  - `34e578c` task 7 — THE FLIP (`review` in FLIPPED; K8 belt: legacy beforeinput
    interceptor binds only under `--legacy`) + the D8.8 titlebar mode pill
    (Editing|Reviewing|Viewing, state-synced, lock-respecting).
  - `060f55b` — oracle verdicts + 58/58 parity audit + R2/R3 enablement (the audit's
    only miss): comments Delete/Prev/Next grey without comments; No Markup/Original
    grey the markup controls (`wc-disabled` state-sync pokes).
- **Gates (six, Windows): PM 237/237** (233 + 4 task-6/flip pins), legacy 257/257,
  smoke 9/9 ×2, docx 17/17, roundtrip 27/0.
- **Parity:** checklist **57/57 ticked** — evidence = the 58/58 DOM/behavior audit
  (`scripts/probe-slice8-parity.js`, run in the built app) + `[8]` suite semantics +
  oracle legs. Pixel-level look rides the task-5 capture-pinned defaults (no fresh
  pixel diff — cheap follow-up if disputed).
- **Oracle (spec §8.3) vs Word for Windows 16.0 — BOTH LEGS PASS, driven over COM**
  (computer-use access dialog timed out → pivoted to `word-oracle-win.ps1` + a one-off
  PID-safe authoring script; no interactive Word session touched):
  - **Leg A clone→Word:** tracked ins+del+**format**+comment docx → ROUNDTRIP_OK (no
    repair) and Word's own resave keeps `w:ins`/`w:del`/`w:delText`/**`w:rPrChange`** +
    `comments.xml`/`commentsExtended.xml` + authors + texts. **K4 resolved: the fork
    emits `w:rPrChange`.**
  - **Leg B Word→clone:** REAL-Word-authored revisions (TrackRevisions + Comments.Add,
    author = signed-in account "Ogut, Dogan") import as `trackInsert`/`trackDelete`/
    `trackFormat` marks + comment card with the real author; `getRevisions()` counts 4
    (comments count — Word semantics); acceptAll yields Word's outcome.
  - Verdicts: `docs/superpowers/plans/notes/2026-06-11-slice8-oracle.json`.
- **Recorded deviations (ledger C adds):** reactions 👍 are in-session only (no
  commentsExtensible round-trip); Just Mine == For Everyone (single-author clone);
  Compare result replaces the single doc (confirmDiscard-consented, UNBOUND from any
  path — §5.3); selected-text proofing language applies doc-level (per-run `w:lang`
  not on the fork command surface); cloud services (Editor score/refinements,
  Translate, Thesaurus definitions) = class-B local degradations; format-row
  descriptions verbosely list every rPrChange property (cosmetic).
- **Carry-overs → slice 9 (references):** BOTH `[0a]` D6 guard tests probe
  `tableOfContents` — slice 9's flip must repoint them to a still-blocked area probe.
  Slice-6 UI-Codex leftovers fold into slice-10/11 parity passes. Visual pixel
  spot-check of review chrome vs live Word = optional cheap follow-up.
- **Blockers/notes:** none. Word never left running (both COM legs quit gracefully);
  `C:\tmp` holds the leg artifacts (`wc-slice8-legA*.docx`, `wc-slice8-legB.docx`,
  `wc-parity-audit.json`).

---

## 2026-06-11 (later) — Slice 8 IN PROGRESS: Word-side spec capture DONE

- **Branch:** `completion-driven-agent-loop` (slice branch not yet cut — capture phase is
  read-only on the clone side).
- **Phase:** Phase 2 — loop iteration 2, slice 8 (review), per-slice step 2 of 9 done.
- **Word-side spec captured live** (Word for Windows 16.0, Document8 sample left OPEN in
  the user's Word instance — our window, safe to close with Don't Save anytime):
  **32 evidence PNGs** in `.oracle-probes/slice8/word-ref/` + the **50-item parity
  checklist `.oracle-probes/slice8/parity.md`** (all `[ ]`; 6 noted Word-side states
  still to capture during the inner loop). Headline findings for the plan:
  (1) modern ribbon REGROUPS review: a **Markup** group (display combo + Filter All
  Markup + Show Markup + Reviewing Pane + dialog launcher) and **Tracking** holds
  Accept/Reject/Prev/Next — the clone's researched classic layout must be restructured;
  (2) comments are CONTEXTUAL CARDS (composer card, threads, timestamps, reactions 👍,
  Contextual|List view switch, panes share the right dock with a switcher rail);
  (3) Delete menu has a 4th item "Delete All Resolved Comments";
  (4) Track Changes ▾ = For Everyone | Just Mine | Lock Tracking (password dialog);
  (5) Show Markup has NO Comments item; Balloons submenu default = "Show Only
  Formatting in Balloons"; unchecking Insertions and Deletions live-hides inline marks;
  (6) Reviewing Pane counts COMMENTS as revisions ("7 revisions" = 3 comments + 4 edits);
  (7) accept/reject auto-advance verified live (7→6→5 revisions); enablement semantics
  pinned (Accept This Change disabled off-change; All-Shown disabled unfiltered);
  (8) Track Changes Options + Advanced dialogs fully captured (markup rendering spec);
  (9) toggling Track Changes flips the chrome mode pill Editing→Reviewing;
  (10) Editor/Translate/Thesaurus-definitions are sign-in/cloud (class B degradation).
- **Windows-quirk note for computer use:** "Windows Input Experience" (TextInputHost)
  can WEDGE the OS foreground and block all MCP clicks (frontmost check). Graceful fix
  that works: a REAL `SendInput` click on the target window's title bar via PowerShell
  (unsandboxed, foreground) — never kill TextInputHost (denied + unnecessary).
- **Next within slice 8:** cut `feature/phase-2-slice-8-review` → critique-hardened plan
  (fork track-changes/comment extensions per the inventory in this entry's sibling
  below) → red `[8]` tests → bridge/review.ts + ribbon regroup → flip `review` area →
  gates → inner loop vs the parity checklist → oracle legs → PR into the loop branch.

---

## 2026-06-11 — Loop Step 0 DONE: Windows environment replication (gates + COM oracle port)

- **Branch:** `completion-driven-agent-loop` (committed directly — Step 0 is loop
  infrastructure, not a slice; per `docs/loop/loop.md` §Step 0).
- **Phase:** **Phase 2 — completion-driven loop; Step 0 (Windows replication) DONE → slice 8
  (review) next.** The loop now runs on the user's **Windows 11** machine (Word for
  **Windows 16.0**, Microsoft 365, English Office); the Mac oracle/docs stay intact.
- **Computer-use permissions (user-mandated, up front, ONE TIME):** granted at **full tier**
  for **Word** (`winword.exe`), **File Explorer**, and the clone (**Electron**,
  `node_modules\electron\dist\electron.exe` — resolves by the literal name `electron.exe`
  while `npm start` is running), plus **clipboardRead + clipboardWrite + systemKeyCombos**.
  No mid-loop permission prompts remain.
- **All six gates GREEN on Windows:** legacy **257/257**, PM **206/206**, smoke **9/9 ×2**,
  docx **17/17**, roundtrip **27/0**. npm aliases work AS-IS (`/tmp/...` probe paths resolve
  to `C:\tmp`, which exists on this machine — no alias edits).
- **One PM test was Mac-vacuous and is now spy-hardened** (`[1] in-view Mod-Z does not
  double-fire`): prosemirror-keymap binds Mod-z to **Meta-z on macOS but Ctrl-z on Windows**,
  so the old synthetic ctrlKey event matched nothing on Mac (vacuous pass) and legitimately
  fired ONE engine undo on Windows (probe evidence: defaultPrevented=true; bold reverted;
  doc returned to the pre-bold state except `sdBlockRev` 2→3 — the fork's history-exempt
  block-revision stamp; un-bolding heals the run-node split so content.size legitimately
  shrinks 23→21). Critique caught that branching on defaultPrevented alone was a WEAKENING
  (a regressed app.js also preventDefaults); the rewritten test spies on **`WC.PM.cmd`**
  (the app.js undo path — the PM keymap never goes through it) as the load-bearing
  cross-platform assertion + asserts doc-equality-modulo-sdBlockRev after the consumed undo.
- **Windows COM oracle PORTED + live-validated** (`scripts/oracle/word-oracle-win.ps1`):
  all 5 verbs (`read-props`/`read-word-props`/`read-para-props`/`read-style-props`/
  `roundtrip`) validated against real Word 16.0 on the repo fixtures — same JSON shapes as
  the Mac oracle (COM ints → Mac enum-string vocabulary; mixed/wdUndefined → `false`/`null`/
  `"false"` sentinels; BOM-free `--out`). Usage errors exit 2 WITHOUT spawning Word;
  roundtrip writes verified into the repo (`.oracle-probes/step0/s3-roundtrip.docx`,
  structurally identical per docx-inspect). Critique-hardened (3-critic workflow, 20
  findings): non-throwing arg validation, kill-time PID re-verification (name+StartTime),
  index-spliced `--out`, LiteralPath, $PWD-consistent path resolution, stdout UTF-8.
- **WINDOWS COM QUIRKS (the hard-won rules — also in `scripts/oracle/README.md`):**
  (1) **sandboxed shells hang at COM activation** (DCOM) — run unsandboxed;
  (2) **backgrounded shells wedge inside `SaveAs2`** (no dialog exists — verified by window
  enumeration; OneDrive paths exonerated — foreground saves to them work instantly) — run
  Word COM in SHORT FOREGROUND commands only;
  (3) `DocumentN` numbering is **machine-global** across instances — never identify
  documents/instances by it (an early misread of taskbar windows as ours stemmed from this);
  (4) orphan recovery: attach to a specific hidden instance via its own window
  (`OpusApp`→`_WwG`→`AccessibleObjectFromWindow` OBJID_NATIVEOM) and `Quit()` it gracefully —
  never `taskkill /IM WINWORD`. The user's Word (their own instance with an AutoRecovered
  doc + 3 blank docs, running since 6/10) was NEVER touched; all automation orphans from the
  hang investigation were quit via their own OM.
- **Roundtrip fixtures re-authored on Windows** (`scripts/oracle/author-fixtures-win.ps1`,
  new — the gitignored `tests/fixtures/oracle-word-s3-table.docx` + `oracle-word-s6-tablestyles.docx`
  existed only on the Mac): shapes verified IDENTICAL to the originals via docx-inspect
  (s3 = 1 table GridTable4-Accent1 + 6 conditionalFormats; s6 = 3 TableGrid tables, 6 rows /
  6 gridCols). `capture-popups.ps1` (PrintWindow capture of Office flyout/dialog windows —
  prior-art leftover) committed for the per-slice Word-side spec captures.
- **Reference-target note (loop.md Step-0 #4):** slices 1–7 were oracle-validated vs
  **Word for Mac 16.77.1**; from slice 8 onward the parity reference is **Word for Windows
  16.0 on this machine**. No retroactive re-validation of 1–7 unless a regression surfaces.
- **Done this session:** permissions; npm install/build; six gates (incl. the Mod-Z fix +
  fixture regeneration); oracle port + live validation + critique pass; README Windows
  section; this checkpoint. package-lock.json committed once (Windows npm normalization —
  stops perpetual re-dirtying; this machine is now the permanent dev box).
- **Blockers/notes:** none. User's Word untouched and still running. Word now holds recents
  entries for the fixture/probe files (same accepted side effect as the Mac sessions).

### Next slice definition (slice 8 — review)

- **Goal:** flip area **`review`** onto the PM engine — **comments** (new/reply/resolve/
  delete/navigate + the pane), **track changes** (toggle, show-markup rendering,
  accept/reject + navigation), **proofing re-points** (spelling/grammar toggles, language,
  word count) — Word-parity verified side-by-side vs **Windows Word** under computer use.
- **Spec:** `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md` §9.1 review
  rows (+ §8.3 oracle protocol). Procedure: `docs/loop/loop.md` §Per-slice (Word-side spec
  capture FIRST → parity checklist in `.oracle-probes/slice8/parity.md` → critique-hardened
  plan → red-first subagent execution → six gates → execute↔compare↔fix inner loop → oracle
  legs via `word-oracle-win.ps1` → PR into `completion-driven-agent-loop`).
- **Known entry points:** the fork VENDORS review infrastructure — comments plugin +
  **`extensions/track-changes/`** (incl. `review-model/` with mark-metadata, story-locator,
  canonical change types) — leverage, don't rebuild. Legacy review pane/UI under
  `src/renderer/public/js/` (`WC.RIBBON` review tab: 212-control inventory). `H.newComment`
  currently a D6 block target.
- **Carry-overs INTO slice 8:** (1) repoint the `[0a]` D6 run-block test off `newComment`
  (slice-6 note — `tableOfContents` repoints at slice 9); (2) slice-6 UI-Codex leftover
  probes (A2 Insert-Table dialog / A5 Bookmark / B-layout/autofit / C1/C2) fold into the
  computer-use parity passes; (3) recorded follow-ups: contentError recovery automation,
  `onContentError` lifetime asymmetry, `warnOnUnsupportedContent` threading; (4) oracle
  vocabulary beyond the Mac-verified core (decorated underlines, justify med/hi) is
  best-effort — pin from a Mac report if one ever disagrees; (5) `Cmd+Shift+C` arms Format
  Painter (slice 4) — Windows Word uses Ctrl+Shift+C for COPY FORMATTING too; re-check the
  comment-shortcut story (Windows Word: new comment = Ctrl+Alt+M) during spec capture.
- **Risks:** track-changes is the largest fork surface so far (marks + decorations + UI);
  Windows Word's MODERN comments pane (contextual cards, anchors) is visually rich —
  capture the real UI first and scope honestly against the deferrals ledger classes;
  suites flake under load — run gates idle.

---

## 2026-06-10/11 — Phase 2 slice 7 BUILT (file-io on the PM engine) + oracle legs A–D

- **Branch:** `feature/phase-2-slice-7-file-io` (10 commits, directly off `main` post
  slice-6 merge [PR #23, `6ca5679`] — no stacked PRs; **PR #24 to open next**).
- **Phase:** **Phase 2 — slice 7 DONE → slice 8 (review) next.**
- **State summary:** non-docx file IO is back on the PM engine — the two slice-0b blocks are
  GONE. **Open:** docx (fork converter, unchanged) + `.html/.htm` (semantic import) + `.txt`
  (line-per-paragraph) + `.csv/.tsv` (**imported as a real PM table** — recorded deviation:
  real Word opens csv as delimited plain text; csv opens as an UNSAVED doc, path=null, since
  the table form can't be written back — §5.3). **Save/Save As:** docx (bytes, unchanged) +
  html (`PM.getHTML({unflattenLists})` + `Files.wrapHtml`) + txt (`PM.getText`, lineBreak AND
  hardBreak → `\n`); Save As is **two-phase** (`doc:askSavePath` dialog-only → renderer
  exports → `doc:saveBytes`/`doc:saveTextFile`; unknown typed exts refused; `doc:saveAsBytes`
  removed end-to-end). **Architecture:** imports rebuild the editor from the **blank template
  + the fork constructor's `html` option** (converter context intact → everything stays
  docx-exportable); a degraded import (fork `contentError`) recovers to a blank PM editor,
  returns false, and `Files` UNBINDS path/name/format via the new `PM.lastImportBlanked()`
  (closes a Ctrl+S-writes-blank-over-old-file data-loss vector found in review). New
  `bridge/file-content.ts` (RFC-4180 `parseCsv`/`csvToTableHtml`/`textToParagraphHtml`).
  **Gate transition (D7.6):** new **`test:roundtrip`** (driver + probe; 27 checks over 4
  real-Word fixtures incl. the s6 tblStyle minting pin) is THE docx gate; `test_docx.js`
  (17) demoted to the frozen legacy-converter gate (retires with legacy at slice 11; spec
  §8.1 carries a dated amendment). **Slice-4 leak FIXED:** clipboard-sanitized Word HTML
  (comments stripped by Chromium) leaked literal list markers — fixed in the fork's
  `handleDocxPaste` (tag-early/remove-late `mso-list:Ignore` strip so list-START detection
  still reads the marker; + style-deref guard; NOTICE'd).
- **Gates (six now): PM 206/206** (192 → +13 `[7]` +1 `[4]` pin −2 +1 `[0b]` rewrites +
  1 blank-flag pin), legacy 257/257, smoke 9/9 ×2, docx 17/17, **roundtrip 27/0**.
- **Oracle (spec §8.3) vs Word 16.77.1 — first slice validated via computer-use MCP directly**
  (no Codex handoff; verdicts `docs/superpowers/plans/notes/2026-06-10-slice7-oracle.json`,
  artifacts `.oracle-probes/slice7/`): **leg A docx round-trip PASS** (no repair prompt;
  docx-inspect structural identity + minted GridTable4-Accent1 carried; **also closes the
  slice-6 table-style reopen recheck** — the macOS Grant-File-Access prompt was cleared
  interactively); **leg B html export PASS** (bold/bullets/table render; deviations: headings
  export as styled paragraphs, `data-sd-*` attrs leak); **leg C csv evidence** (real Word =
  File-Conversion dialog + raw delimited text → our table import is the documented
  deviation); **leg D txt PASS** (8/8 lines byte-faithful).
- **Done this session** (plan `docs/superpowers/plans/2026-06-10-phase2-slice-7-file-io.md`,
  hardened by a 4-critic critique workflow — 31 findings, 4 unique blockers applied
  [the `[7]`-block confirmDiscard suite hang; the leak fix aimed at the wrong paste pipeline
  — word-html routes to `handleDocxPaste` in docx mode; a phantom `<w:i>` grep on
  negation-run; docx-inspect is CLI-only] — plus author pre-verification that independently
  caught the contextBridge non-writability of a planned spy and verified the critics'
  riskiest claims; executed subagent-driven with two-stage review per task, which caught
  real bugs again: the DOM-vs-model assertion in the `[4]` pin, a red-stage dirty-modal
  hang, stale-artifact gate-lying in the roundtrip driver, the contentError binding hazard,
  `lineBreak` dropped from `getText`, the `Math.max` spread limit):
  - `a50bfc4` plan · `964b395` plan sync · `860d753` red tests (205/192/13)
  - `1384831` **test:roundtrip lands FIRST** (spec §8.1) + six-gate docs + spec amendment
  - `f6572dc` IPC channels · `cbecba8` bridge legs · `f545429` **THE FLIP** (blocks removed)
  - `ae92a36` fork leak fix (NOTICE'd) · `73fdd22` oracle verdicts · `5e9a3cb` docs scoping
- **KNOWN DEVIATIONS (recorded):** csv-as-table (vs Word's plain text — user-directed);
  html import/export semantic (styles stripped but alignment; headings → styled paragraphs
  on export; `data-sd-*` attrs leak); `.md/.rtf` legacy-only (fork `markdown` option noted
  as a cheap future leg); txt export = one block per line (Word tab-separates table cells);
  page-break exports as `\n`; phantom recents carried forward (push precedes import
  verdict); failed import lands on a blank doc (consented via confirmDiscard).
- **Carry-overs for slice 8 (review):** (1) BOTH `[0a]` D6 tests still on
  `newComment`/`tableOfContents` — slice 8 repoints `newComment`. (2) slice-6 UI-Codex
  steps still open (A2/A5/B-layout/autofit/C1/C2) — now feasible directly via computer use.
  (3) Recorded follow-ups from review: no automated pin on the contentError recovery branch
  (probe-only); `onContentError` lifetime asymmetry between html- and docx-seeded editors;
  `warnOnUnsupportedContent` not threaded (silent lossy html imports); `[0a] dirty flag`
  test flakes rarely on slow boots (re-run clears it).
- **Blockers/notes:** none for the PR. Word left RUNNING (never quit), zero documents open,
  user state untouched; Word now holds a file-access grant for `.oracle-probes/slice7/`.

---

## 2026-06-10 — Slice 6 table-defect fix batch (user report → hunt → 5 fixes on PR #23)

- **Branch:** `feature/phase-2-slice-6-insert-basics` (PR #23, still unmerged — fixes pushed onto it).
- **Phase:** **Phase 2 — slice 6 DONE (PR #23 + fix batch) → slice 7 (file-io) next.**
- **State summary:** the user reported "some of the table things not working properly." A 4-agent
  defect-hunt workflow (live-repro probes in the built app + code audit + real-Word fidelity compare
  vs `.oracle-probes/slice6/` + style-minting research) found the real causes; 5 fix tasks executed
  subagent-driven with per-step review:
  - `fdcb7f6` **ribbon yank fixed** — contextual table tabs are now PASSIVE (caret enter/exit never
    steals the active tab; user-chosen tab survives exit; `showContextualTab(def,{activate:false})`
    + conditional restore in `hideContextualTab`; H&F byte-identical); Layout tab display label →
    Word Mac's **'Layout'**.
  - `72b270f` **table Center/Right alignment fixed** — TableView no longer clobbers `margin-left`
    with the zero-indent default (geometry-proven: center 233/233, right 466/0; was always 0/466).
  - `dd56a1a` **caret-cell shading parity** (Word shades the caret cell — fork `setCellBackground`
    caret fallback; bridge gate removed) + **AutoFit Fixed now clears the Window stretch**.
  - `61d84d9` **table styles work end-to-end** — minted REAL Word definitions (`TableGrid` authored
    live via the oracle; `GridTable4-Accent1` from the s3 fixture, all 6 `w:tblStylePr` conditional
    blocks byte-faithful) into `DEFAULT_LINKED_STYLES` → every export carries the definitions (closes
    the Leg-C `w:tblStyle` drop); **apply now visibly bakes** (style-engine-resolved border frame +
    firstRow fill via a non-rendered `styleBakedBackground` marker — user shading survives, exports
    stay free of direct-formatting leaks); **dynamic honest style gallery** (`getTableStyles()` from
    the runtime catalog, display names, phantom IDs dropped); `docx-inspect` gained
    `tableStyles`/`tblStyleRefs`.
  - `474291f` **direct-border precedence** (direct `w:tblBorders` beat the baked style frame across
    save→reopen — importer-merge mirrored via the actual `_processTableBorders`) + user shading
    clears the baked marker; `a23c868` **27 real Fluent icons** for the tbl* contextual-tab commands
    (icon-map + regen; also fixed gen-icons.js's stale pre-Phase-1 output path).
  - `d6a07e4` **"big box" fixed — fresh tables render cell GRIDLINES** (user re-report): the table
    `borders` renderDOM emitted invalid `border-insideH/V` CSS (silently dropped) and style-driven
    cells carry no renderable borders attr — **imported styled tables were big boxes too**. Render-only
    fix: visible insideH/insideV publish as `--wc-inside-h/v` CSS vars on the table; prosemirror.css
    paints INTERIOR cell edges only (outer stays frame-owned, Word's inside/outside split); explicit
    per-cell borders still win; `deleteCellAndTableBorders` → no gridlines; export purity proven
    (no `w:tcBorders`/`w:tblBorders` leak). PM **192/192** (+3).
- **Gates (final, run by the coordinator):** **PM 192/192** (176 → +16 new regression tests incl. gridlines +
  geometry + precedence + export-purity), legacy 257/257, smoke 9/9 ×2, docx 17/17.
- **Verified working (hunt, no action needed):** row/col insert/delete, merge/split via CellSelection,
  cell width, distribute columns, header toggles, text direction, context menu, dropdown flyouts,
  convert-to-text, window-autofit.
- **Recorded deferrals from the hunt (NOT fixed, by design):** Table Style Options checkboxes
  (tblLook toggles — needs conditional-formatting render), full ~50-style gallery, Borders-group pen
  controls/Border Painter, Height/Width spinner fields, View Gridlines/Draw/Eraser/Properties,
  Cell Margins dialog (stub toast), AutoFit-Contents reflow, banded-row live rendering (exported
  definitions carry it — real Word renders the full style), text-direction dropdown gallery,
  Excel-Spreadsheet/Quick-Tables menu items (legacy carryover, absent in Word Mac).
- **Blockers/notes:** a Word **live reopen re-check of the style fix is pending** — scripted opens
  now hit a macOS "Grant File Access" prompt (and Word crashed/recovered during T4's attempt; left
  clean) — artifact-level validation is strong (docx-inspect: definitions byte-faithful + ref +
  conditionals intact); re-run interactively after granting file access. One process incident: a T2
  reviewer subagent left the repo on the slice-5 branch (no data loss — everything was committed;
  coordinator restored the branch and added a no-branch-switch rule to subsequent agent briefs).

---

## 2026-06-10 — Slice 6 Word oracle legs run + PR #23 opened

- **Branch:** `feature/phase-2-slice-6-insert-basics` (pushed) → **PR #23** open to `main`.
- **Phase:** **Phase 2 — slice 6 DONE (PR up) → slice 7 (file-io) next.**
- **State summary:** the slice-6 build is complete + all gates green (PM 176/176, legacy 257, smoke
  9/9 ×2, docx 17 — see the BUILT entry below). Ran the **Word-dependent oracle legs** vs Word 16.77.1
  (notes `docs/superpowers/plans/notes/2026-06-10-slice6-word-oracle.json`; probe
  `scripts/slice6-legC-probe.js`):
  - **Leg A reopen-in-Word — PASS** (the key test): real Word **accepted the clone's OOXML with NO
    repair prompt**; hyperlink→`https://example.com` + 3×4 table + embedded image + paired bookmark all
    survive Word's own round-trip (Word canonicalized rIds / image filename / `w:shd` — benign).
  - **Leg C styled-table — PARTIAL:** `w:jc` (align) + `w:shd` (shading) + `w:gridSpan` (merge) survive;
    **`w:tblStyle` DROPPED** — the clone emits the styleId *reference* but never writes the style
    *definition* into `word/styles.xml`, so Word discards the orphaned reference (NEW recorded
    deviation — same minting gap as slice-3 styles; follow-up = mint built-in table-style definitions).
  - **Leg B Word-authored→clone — BLOCKED** by Word session quirks #24-26 (`make new document`
    spawned spurious untitled windows + dangling refs; native authoring never saved). Open+save-as path
    stayed healthy (legs A/C ran fine); only `make-new-document` was broken this session. Clone import
    of tables/bookmarks is covered indirectly by Leg A's reverse evidence. Re-run in a fresh Word
    session = minor follow-up.
  - **UI Codex** (Task 12): partially captured by the user (Insert dialogs + Table Design tab
    screenshots in `.oracle-probes/slice6/`, gitignored — see the UI-probe entry below); remaining
    steps (A2 dialog, A5 bookmark, B-layout/autofit, context menu, text-direction) a follow-up.
- **Done this session:** Word oracle legs A/C/B (`0bd3773`); **PR #23** opened with full body (what
  flipped, fork edits NOTICE'd, oracle verdicts, gate counts, deviations + carry-overs).
- **Carry-overs for slice 7 / merge:** (1) **mint built-in table-style definitions into `styles.xml`**
  so applied table styles render in Word (closes the Leg-C `tblStyle` gap; slice-3-scale follow-up).
  (2) Re-run Word oracle **leg B** + finish the **UI Codex** steps in a fresh Word session. (3) BOTH
  `[0a]` D6 tests now on `newComment`/`tableOfContents` (slice 8/9 repoints). (4) slice-4 list-marker
  leak still open.
- **Blockers/notes:** none for the PR — Word accepted our OOXML cleanly (well-formed). Word left
  RUNNING (never quit); 2 empty untitled artifacts (`Document2`/`Document4`) from the blocked leg-B
  authoring were left open (PID-safety — not the user's named docs); the user may close them +
  relaunch Word for the remaining UI Codex steps.

---

## 2026-06-10 — Slice 6 Word UI probe partially captured

- **Branch:** `feature/phase-2-slice-6-insert-basics`.
- **Phase:** **Phase 2 — slice 6 DONE → slice 7 (file-io) next.**
- **State summary:** ran the `.oracle-probes/slice6/CODEX-PROMPT.md` Word-for-Mac
  computer-use probe. Captured real screenshots for the Insert Hyperlink dialog, Table grid,
  Symbol dialog, Equation contextual editor, and Table Design contextual tab into
  `.oracle-probes/slice6/shots/`; appended literal observations to `.oracle-probes/slice6/results.md`.
  These oracle artifacts are gitignored.
- **Done this session:** verified Computer Use can drive Word; saved `A1.png`, `A2-grid.png`,
  `A3-dialog.png`, `A3-menu.png`, `A4.png`, and `B-design.png`; recorded exact visible controls for
  those surfaces. Confirmed Mac Word exposes an Equation contextual editor with Unicode/LaTeX/Text,
  Convert, 188-symbol gallery, and structure menus; confirmed Table Design exposes Table Style Options,
  Table Styles, Shading, Border Styles, Pen Style/Weight/Color, Borders, and Border Painter.
- **Next:** rerun the remaining slice-6 UI probe steps in a clean Word session with only one scratch
  document open: A2 Insert Table dialog, A5 Bookmark dialog, B-design gallery/Shading/Borders
  dropdowns, B-layout, B-autofit, C1 context menu, and C2 Text Direction.
- **Blockers/notes:** Word repeatedly snapped focus among existing unsaved Word windows after modal
  close/screenshot events, including an existing oracle-looking document. I stopped short of further
  coordinate actions and did not close ambiguous unsaved windows to avoid touching user state.

---

## 2026-06-10 — Phase 2 slice 6 BUILT (insert-basics + full Table Tools on the PM engine)

- **Branch:** `feature/phase-2-slice-6-insert-basics` (directly off `main` post slice-5 merge
  [PR #22, `260e490`] — no stacked PRs; **PR to open next**, one PR for the whole slice per user).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 6 DONE → slice 7 (file-io) next.**
- **State summary:** area **`insert-basics` FLIPPED** (registry `bridge/index.ts`) **and the
  net-new full Word Table Tools built**. Insert primitives on PM via new **`bridge/insert.ts`**:
  link (`setLink` mark + edit/Remove via `unsetLink`), image (`setImage`; `pickImage()` IPC reused —
  no new IPC), page break (`insertPageBreak` hardBreak), blank page (two breaks), horizontal line
  (`insertHorizontalRule` contentBlock), symbol (`insertContent`), **equation = styled Cambria-Math
  italic text** (KNOWN DEVIATION — real OMML deferred; M4 clears mark-bleed), bookmark
  (**paired `bookmarkStart`+`bookmarkEnd`**, B1) + list/goto/remove dialog. Table on PM via new
  **`bridge/table.ts`**: insertion + the legacy 9 ops + **14 NOTICE'd fork table commands**
  (`setTableStyle`/`setTableAlignment`/`setTableIndent`/`setCellWidth`/`setRowHeight`/`setCellMargins`/
  `setCellBorders`/`distributeRows`/`distributeColumns`/`splitTableAtRow`/`convertTableToText`/
  `convertTextToTable`/`setTextDirection`+attr/`autoFitTable` — all **export round-trip-verified** via
  `[6b] EXPORT:` document.xml-grep tests). **Table Layout + Table Design contextual ribbon tabs**
  (runtime-injected `{cmd,label,type}` dispatch via new `H.tbl*` handlers + dropdown flyouts;
  **`ribbon.js` extended for multiple coexisting contextual tabs**, backward-compatible with Header &
  Footer — 257 byte-identical) + a **PM table context menu** (scoped to `td/th`, native cell-selection
  preserved). **Exotica carve-out:** 14 exotic cmds → new `insert-exotica` (slice 10),
  `crossReference` → `references` (slice 9); 9 core insert cmds flip. `pmGuard` on legacy `WC.Table`
  methods (B2). `Ctrl+K` `pmBlockedOr`-wrapped (same flip commit). D6 tests repointed
  `link`→`newComment`, `table`→`tableOfContents`. New `scripts/docx-inspect.js` (unzip helper).
  Gates: **PM 176/176** (130 + 46 `[6]`/`[6b]`), legacy 257/257, smoke 9/9 ×2, docx 17/17.
- **Done this session** (plan `docs/superpowers/plans/2026-06-09-phase2-slice-6-insert-basics.md`,
  grounded by a 6-agent inventory + hardened by a 3-critic critique + author pre-verification — **4
  blockers + 6 majors** applied; the biggest two [contextual-tab controls are `{cmd,label,type}`
  cmd-dispatch NOT `onClick`; ribbon shows ONE contextual tab] caught by pre-verification after a
  critic wrongly cleared them; executed subagent-driven with two-stage review per task, which caught
  real bugs each task — a `__PM_TextSelection` global regression, an equation `false`-contract
  violation, a modal leak, curly-quote contamination, a `tableInfo` fallback, and a **silent
  export data-loss bug** [`setTableStyle`/`setTableIndent`/`setTextDirection` wrote only the top-level
  attr, never the nested key the exporter reads — fixed via dual-write + export-grep regression tests]):
  - `eb23de9` plan · `20a4fc3` red `[6]` tests + D6 repoint · `f8e76e3` docx-inspect helper
  - `b40f36b` bridge insert · `5feefb9` bridge table (6a) · `6c0d81b` entry-point rewrites (+M2 bookmark dialog)
  - `d2b3ffb` **THE FLIP** + Ctrl+K guard + exotica carve-out (149/149, carve-out machine-verified leak-free)
  - `752e0e1` 14 fork table commands (+ export round-trip fix) · `d4074d7` bridge table extras
  - `e2840f3` contextual tabs + PM context menu (ribbon.js multi-tab, 257 byte-identical) · `366aa66` leg-A oracle
- **Oracle validation (spec §8.3):** **leg A HEADLESS — PASS** (`docx-inspect` of the clone's exported
  `.docx`: hyperlink `rId7`→`https://example.com`; table 1×3rows×4cols; image embedded `word/media/
  image-*.png` 70 bytes; bookmark paired start+end id `0` name `spot1`). Evidence:
  `docs/superpowers/plans/notes/2026-06-10-slice6-legA-headless.json`. **DEFERRED to a Word-windowed
  session:** the Word-dependent legs (leg-A reopen-in-real-Word fidelity; leg-B Word-authored doc →
  `openDocx` import) + UI-fidelity Codex screenshots (Task 12 — needs user's Codex).
- **KNOWN DEVIATIONS (recorded):** equation = styled text not OOXML Math; pagination-gated table
  VISUALS land attrs-only (distribute-rows height, autofit window/contents reflow, repeat-header
  render, text-direction BiDi metrics → Phase 7); `splitTableAtRow` refuses rowspan-straddle (records
  deviation vs invalid doc); `tblCellMargins`/Table Properties dialog toast-deferred (Task 11.3);
  contextual-tab buttons render icon-only (`tbl*` cmds aren't fluent icon keys); Excel-Spreadsheet /
  Draw-Table degrade to plain `insertTable`; authored data-URL images get a fresh rId per export.
- **Carry-overs for slice 7 (file-io):** (1) **Word-dependent oracle legs + UI Codex for slice 6
  still to run** (relaunch Word windowed). (2) **BOTH `[0a]` D6 tests now on `newComment`/
  `tableOfContents`** (review/references) — slice 7 is file-io (not a ribbon area), so it can LEAVE
  them; slice 8/9 repoints when review/references flip. (3) Slice-4 Word→clone list-marker leak still
  open. (4) Spec slice 7 = open html/txt/csv re-enabled; PM-converter round-trip suite replaces
  `test_docx.js`; retire html-to-docx/mammoth/docx-utils for `.docx`.
- **Blockers/notes:** none for the build/PR. Word oracle pending a user Word relaunch (windowed).

---

## 2026-06-09 — Phase 2 slice 5 BUILT (find-replace on the PM engine)

- **Branch:** `feature/phase-2-slice-5-find-replace` (directly off `main` post slice-4 — no
  stacked PRs; **PR to open next**).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 5 DONE → slice 6 (insert-basics) next.**
- **State summary:** area **`find-replace` FLIPPED** (registry `bridge/index.ts:29`): the legacy
  destructive `.find-hit` span rewrite is replaced by the fork's **decoration-based Search
  extension** (non-destructive `.ProseMirror-search-match`/`-active-search-match` highlights). The
  **find pane** (`D.findPane` PM branch → `pmFindPane`) drives the `WC.PM` search surface
  (`findSession` highlight-only/`findNext`/`findPrev`/`replaceOne`/`replaceAll`/`clearFind`/
  `findCount`/`goTo`), with a Word-faithful **options row** (Match case / Whole words / Use
  wildcards), live "N of M" counter, Replace + Replace All (count toast), and **close→`clearFind`**
  (no orphan highlights). **Full Word option scope shipped** (user-approved maximum): **Match Case +
  Whole Words + Wildcards + Advanced Find** (options expanded) + **all three Find-dropdown items**
  (Find · Advanced Find… · Go To…). New **`D.goToDialog`** (B3) with a PM branch (Heading works on
  the model; Page/Line pagination-gated → Phase 7); `findMenu` re-pointed. **Ctrl+F/Ctrl+H +
  edit.find/replace** wrapped in `pmBlockedOr('find-replace', …)` in the flip commit (B2).
  **Fork edits (NOTICE'd):** the Search extension was **unnamed** (defaulted to `'extension'` →
  `extensionStorage.search` was undefined) — now `name: 'search'` (B1); `setSearchSession` + the
  search-index invalidator (M1) + `replaceSearchMatch` (M2) thread `{wholeWord, useWildcards}`;
  `SearchIndex.wildcardToRegExp` (Word wildcard→RegExp) + `isWholeWordMatch` post-filter; **wildcards
  forced case-sensitive** to match Word (oracle A4). Gates: **PM 130/130** (112 + 18 new `[5]`),
  legacy 257/257, smoke 9/9 ×2, docx 17/17.
- **Done this session** (plan `docs/superpowers/plans/2026-06-09-phase2-slice-5-find-replace.md`,
  hardened by a 3-critic adversarial workflow — 3 blockers caught pre-build [unnamed Search
  extension; bare Ctrl+F/H bypassing D6; `goToDialog` not exported] + 4 majors; one critic "blocker"
  [missing `.sd-editor-scoped`] REFUTED by direct verification of ProseMirrorRenderer.ts:584;
  executed subagent-driven with two-stage review per task):
  - `c3f7fb2` plan · `7262ea7`/`4485dc3` red `[5]` tests + D6 repoint (`replace`→`link`, `find`→`table`)
  - `0343330` fork: `name:'search'` + whole-word + Word-wildcards (M1/M2 threaded, NOTICE'd)
  - `0fe1e60`/`375e12b` bridge find/replace surface + one-undo `norm()` test fix
  - `43e3f78` re-point find pane + options row + `D.goToDialog` (B3)
  - `f768175` **THE FLIP** + Ctrl+F/H + edit.find/replace re-points (B2) — 129/0, zero triage
  - `1186532` wildcard case-sensitivity fidelity fix (oracle A4) — 130/0
  - `8a9b9ef`/`2fb33e3` oracle verdicts + legs A/B PASS
- **Oracle validation (spec §8.3) vs Word 16.77.1:** SEMANTICS via Codex computer-use driving
  Word's own AppleScript find object (authoritative) — match-case 3/1, whole-word 4/2, wildcard
  `b?t`=3/`b*t`=5, replace-all 4/2 **all MATCH** our engine; **deviation found+fixed:** Word forces
  wildcards case-sensitive (A4). **Leg A clone→Word PASS** (engine replace-all → Word read-props
  reads 'QUX bar QUX bar QUX'; document.xml QUX×3/bar×2/foo×0; **zero decoration/highlight leak** —
  decorations are view-only). **Leg B Word→clone PASS** (Word-authored 'alpha×4' imports identically;
  `findSession('alpha')`=4). Evidence: `docs/superpowers/plans/notes/2026-06-09-slice5-word-find-replace.json`
  + `.oracle-probes/slice5/` (gitignored: Codex `results.md` + 17 shots).
- **KNOWN DEVIATIONS / recorded follow-ups:** (1) **selection-scoped Replace All** — Word can limit
  Replace All to a selection; our engine replaces whole-doc only (deferred). (2) Mac Word ⌘F is a
  top-right **toolbar search field**, not a sidebar; we keep our preserved sidebar-pane chrome
  (UI-fidelity constraint — cosmetic deviation). (3) Advanced exotic options (Sounds like, Find all
  word forms, Match prefix/suffix, Ignore punctuation/whitespace) deferred. (4) **Go To target list
  unverified** (Word's Find dialog crashed/recovered during the Codex probe) — our Heading/Bookmark/
  Page/Line is a reasonable subset; Page/Line visual landing pagination-gated (Phase 7).
- **Carry-overs for slice 6 (insert-basics):** **BOTH `[0a]` D6 tests now sit on insert-basics
  cmds** (`link` run-block + `table` dropdown-block) — slice 6's red-tests task must repoint BOTH
  (or invert them as the insert-basics flip tests). Slice-4 follow-up still open (NOT slice-5 work):
  the Word→clone list-marker leak (supportLists markers paste as literal text → double-marker).
- **Blockers/notes:** none. Word left name-safe (our scripts only close docs by their own
  `slice5-leg*.docx` names); the long crash-recovered Word session degraded back to windows=0 after
  validation (not a script fault) — user relaunch recovers it when next needed.

---

## 2026-06-08 — Phase 2 slice 4 INTEGRATED to `main`

- **Branch:** `main` (PR #21 merged from GitHub — `696b84b`; `feature/phase-2-slice-4-clipboard`
  can be deleted local+remote).
- **Phase:** **Phase 2 — slices 0a–4 DONE and on `main` → slice 5 (find-replace) next.**
- **State summary:** gates re-verified **on `main` post-merge**: PM 112/112, legacy 257/257,
  docx 17/17. CLAUDE.md/AGENTS.md/plan.md banners advanced to slices-0a–4/slice-5-next
  (this entry's commit). Flipped ribbon areas now: `character`, `paragraph`, `lists`,
  `styles`, `clipboard`, `editing-misc`.
- **Next:** **slice 5 — find-replace** in a FRESH session (orient at docs/plan/ →
  brainstorm-lite → write-plan → execute; branch `feature/phase-2-slice-5-find-replace`
  directly off `main`). ⚠️ **Slice-5-specific carry-over:** BOTH `[0a]` D6 tests now sit on
  `find-replace` cmds — the **run-block** test probes `replace` (test-suite-pm.js ~line 159)
  and the **dropdown-block** test probes `find` (~line 163); BOTH INVERT when `find-replace`
  flips, so slice 5's red-tests task must repoint BOTH to a still-unflipped area (insert-basics,
  e.g. `link`/`table`), exactly like slice 4 repointed the run-block test off `cut`. Slice-4
  recorded follow-up to carry: the **Word→clone list-marker leak** (supportLists markers paste
  as text → double-marker; candidate fix in bridge `pasteHTML` preprocessing or the converter;
  native-Word list paste still UNCONFIRMED). Spec: slice 5 = fork Search extension
  (decoration-based, replaces destructive `.find-hit` spans) + find pane re-point.
- **Blockers/notes:** none. Word left clean.

---

## 2026-06-08 — Phase 2 slice 4 BUILT (clipboard + editing-misc on the PM engine)

- **Branch:** `feature/phase-2-slice-4-clipboard` (directly off `main` post the slice-3
  integration — no stacked PRs; PR to open next).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 4 DONE → slice 5
  (find-replace) next.**
- **State summary:** areas **`clipboard` + `editing-misc` FLIPPED** (registry
  `bridge/index.ts`): ribbon **Cut/Copy/Paste** (PM-native — `webContents.cut/copy/paste`
  IPC triggers so the prosemirror-view serializer/parser own the document work), the
  **Paste split-button dropdown** (Keep Source Formatting / Merge Formatting [deferred,
  disabled] / Picture / Keep Text Only / Paste Special… / Set Default Paste… [deferred]),
  a real **`D.pasteSpecial` dialog** (flavor list clipboard-state-driven — oracle-confirmed:
  rich→HTML/RTF/Unformatted/PDF, text→Unformatted only, image→Picture PNG/TIFF; dblclick +
  Enter = OK), **Format Painter** flipped onto the fork's `copyFormat` extended to **Word
  scope** (paragraph props incl. numbering + first-run marks; replace-not-merge; `link`
  mark preserved; idempotent `persistent` fixing the ribbon click,click,dblclick disarm
  trap; new `cancelFormatPainter`/Esc), single + **double-click-sticky** + Esc-disarm with
  state-sync **button latch + copy cursor**, and **Select** (Select All + Similar
  Formatting — single-range deviation recorded; Select Objects/Selection Pane → slice 10).
  New **clipboard IPC** (`wordAPI.clipboard.*` — module reads/writes + webContents edit
  triggers; nativeImage round-trip). **`select` remapped** `find-replace` → `editing-misc`
  (spec §9.1 row 4 beat the slice-0a ribbon-group-adjacency mapping). **Cmd+Shift+C/V**
  copy/paste-formatting chords (oracle B5; PM-only, null under legacy). Office Clipboard
  pane gated to a toast in PM mode (legacy-DOM pipeline). Gates: **PM 112/112** (96 + 16
  new `[4]`), legacy 257/257 byte-identical, smoke 9/9 ×2, docx 17/17.
- **Done this session** (plan `docs/superpowers/plans/2026-06-07-phase2-slice-4-clipboard.md`,
  hardened by a 4-critic adversarial workflow — 32 findings, 8 confirmed blockers applied
  incl. the painter double-click trap, two never-green tests, the async flyout/dialog
  races; executed subagent-driven with two-stage review per task):
  - `37b03fd` plan · `23c9062`/`6031cc2` red `[4]` tests + D6 run-block repoint (cut→replace)
  - `579c5a0`/`281a08e` clipboard IPC (+ review hardening)
  - `d5d1002` oracle clipboard/painter probes + verdicts (Step 2.1 scripted; UI-only probes
    via **Codex computer-use** into `.oracle-probes/slice4/` — gitignored)
  - `5793f6e`/`e434dfd` fork painter Word scope (+ the resolved-vs-direct-marks fix:
    `getFormattingStateAtPos().inlineMarks`, review-found)
  - `dc70b2e`/`7f9e010` bridge clipboard/select/painter surface (+ Esc layering/pasteHTML
    text/plain) · `1bc5ce5` gitignore `.agents/`
  - `5a27de3`/`2f8f891` entry points — handlers, pasteMenu, Paste Special dialog, selectMenu,
    flyItem disabled (+ dead-toast/keyboard-a11y polish)
  - `34c1633` state-sync painter chrome · `ac98db2`/`0746464` **THE FLIP** + chords (112/0,
    one triage: sdBlockRev normalization in the one-undo test)
  - `3858b64` oracle legs A/B + Task-9 manual-sanity verdicts
- **Oracle validation (spec §8.3) vs Word 16.77.1:** painter matrix B1-B9 (caret-arming,
  paragraph scope incl. style, **replace-not-merge**, **hyperlink survives paint-over**,
  first-run capture on mixed source — all drove the fork code); **leg A clone→Word PASS**
  (clone clipboard HTML is Word-ingestible — Generator meta + MSO `@list` + ListParagraph;
  real Word renders the full list structure incl. nesting/markers, screenshot); **leg B
  Word→clone PASS core** (9 paras, ListParagraph styleId, ilvl nesting survive Word's 46KB
  MSO-list HTML through the PM parser); **physical Cmd+C/V both directions** confirmed via
  real OS keystrokes (Blink-native; no hidden menu needed — closes the Task-8 keyboard
  verdict).
- **KNOWN DEVIATIONS / recorded follow-ups:** **(1) Word→clone LIST-marker leak** — Word's
  supportLists literal markers (`-`/`◦`/`1.`/`a.`) paste in as TEXT alongside the engine's
  numbering (double-marker); Word strips its own `mso-list:Ignore` spans on import, the
  clone's PM parser does not. CAVEAT: leg-B content was clone-round-tripped (carried the
  `data-superdoc-slice` blob) — native-Word list paste UNCONFIRMED (Word session degraded
  this run). USER DECISION (2026-06-08): **ship slice 4, track the fix as a follow-up**
  (candidate: strip supportLists/`mso-list:Ignore` marker spans in bridge `pasteHTML`
  preprocessing — our code; `view.pasteHTML` uses the PM clipboard parser not the OOXML
  converter — or in the converter import; fits slice-7 converter work). **(2)** Merge
  Formatting + Set Default Paste deferred (menu items disabled/toast). **(3)** Similar
  Formatting selects ONE range (PM TextSelection single-range vs Word multi-select). **(4)**
  Office Clipboard pane inert in PM mode. **(5)** Paste Special omits Paste-link radio.
- **Carry-overs for slice 5 (find-replace):** **BOTH `[0a]` D6 tests now sit on
  `find-replace` cmds** (`replace` run-block + `find` dropdown-block) — slice 5's red-tests
  task must repoint BOTH to a later-slice area (insert-basics, e.g. `link`). Phase-3 logger:
  the painter chrome nudge carries `wcPainterChrome` meta (+ reuses `PREVIEW_META`); the
  `clipboard:write*` IPC channels are test-only surface.
- **Blockers/notes:** Word left clean (doc count 0). The user's pre-existing Word `Document1`
  was already absent (count 0) before leg A — not closed by our scripts (which only close
  name-verified scratch docs); flagged to the user.

---

## 2026-06-07 — Phase 2 slice 3 INTEGRATED to `main`

- **Branch:** `main` (PR #19 merged clean — no conflict round; `feature/phase-2-slice-3-styles`
  deleted local+remote).
- **Phase:** **Phase 2 — slices 0a–3 DONE and on `main` → slice 4 (clipboard + editing-misc) next.**
- **State summary:** gates re-verified **on `main` post-merge**: PM 96/96, legacy 257/257.
  CLAUDE.md/AGENTS.md banners advanced to slices-0a–3/slice-4-next (this entry's PR).
- **Next:** **slice 4 — clipboard + editing-misc** in a FRESH session (orient at docs/plan/ →
  brainstorm-lite → write-plan → execute; branch `feature/phase-2-slice-4-clipboard` directly
  off `main`). ⚠️ Slice-4-specific carry-over: the `[0a]` **D6 dispatch-block test probes cmd
  `cut`** (test-suite-pm.js ~line 156) — it INVERTS when `clipboard` flips; repoint it to a
  still-unflipped area (find-replace is slice 5) in the red-tests task, exactly like slice 2
  repointed it off `bullets`. Spec-vs-registry reconciliation needed in brainstorm-lite: spec
  §9.1 row 4 lists `select` in slice 4, but the D6 registry maps `select` → area `find-replace`
  (slice 5, bridge/index.ts). Backlog notes: `D.applyStyles` (dead code) needs a PM branch if
  ever wired; the Phase-3 logger must learn the `wcStylePreview` meta (preview txns ≠ user
  edits); slice-3 visual-only probes (Word's hover-preview scope, IME-mid-preview) still open
  for user observation.
- **Blockers/notes:** none.

---

## 2026-06-07 — Phase 2 slice 3 BUILT (styles on the PM engine)

- **Branch:** `feature/phase-2-slice-3-styles` (directly off `main` post the slice-2
  checkpoint merge — no stacked PRs; PR to open next).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 3 DONE → slice 4 (clipboard +
  editing-misc) next.**
- **State summary:** area **`styles` FLIPPED** (registry `bridge/index.ts`): Quick-Styles
  gallery click (`Commands.applyStyle` → bridge `applyStyleByName` → engine `setStyleById`,
  one transaction, Word plain-apply semantics), **Word's hover live-preview restored
  PM-natively** (new `bridge/style-preview.ts`: throwaway transaction + `editor.setState`
  restore — the fork double-books state in a private `_state`; converter
  documentModified/documentGuid snapshotted; capture-phase keydown/beforeinput cancel so
  typing mid-preview is never discarded), styles pane applies flip (D6 gate closes the
  pre-existing chevron leak; New Style toasts — custom styles deferred), 4 keyboard chords
  live (+ the **Ctrl+N `!shift` shadow fix** — Ctrl+Shift+N was dead code in both worlds,
  now Apply-Normal per Word; recorded legacy-visible), **caret-driven gallery highlight**
  (state-sync `st.block` = display name of the resolved styleId, 'Normal' default —
  net-new fidelity win), bridge name↔id table (`style-names.ts`) + resolved-props read
  (`getResolvedParaProps`), **4 built-in styles minted** into the fork import defaults
  (NoSpacing/Strong/Emphasis/SubtleEmphasis; SubtleEmphasis oracle-amended to live-Word
  404040/themeTint BF), fork Heading `Mod-Alt-1..6` keymap stripped (collision + toggle
  ≠ Word). **Both slice-2 revisits CLOSED:** Change-List-Level reads the resolved ilvl;
  `resolvedPropertiesCache` builds a real TableInfo (real row/cell indices + full
  tableProperties incl. tblLook — review-found deepening). New oracle verb
  **`read-style-props`** (style OBJECT discovery — `name local` reads, display names) +
  quirks #24-27 (headless auto-launch + make-new-document recovery; fresh-path late opens;
  ordinal access; style object forms). **Slice-2 oracle followUps CLOSED** (lists family
  all PASS — U+25AA literal round-trip resolved the square-glyph discovery; literal
  roundtrip PASS, shading/borders survive Word re-save). Gates: **PM 96/96** (76 + 20 new
  `[3]`), legacy 257/257 frozen, smoke 9/9 ×2, docx 17/17.
- **Done this session** (plan `docs/superpowers/plans/2026-06-06-phase2-slice-3-styles.md`,
  grounded by a 6-agent inventory + hardened by a 4-critic adversarial workflow — 20
  findings applied incl. 4 blockers: the `editor.setState` restore channel, the Ctrl+Shift+N
  shadow, the linked-character-style selection trap, the negation-fixture context leak;
  executed subagent-driven with two-stage review per task):
  - `a90ce67` plan · `1885d1d`/`6ec4e56` red tests (20 `[3]` + cellFor + 4 engine pins)
  - `3b5d276` fork: heading keymap strip · `ebaac6f`/`4800ce4` minted defaults
  - `8c5e672`/`fcba36a` TableInfo fix (+tblLook spread, review-found)
  - `131e1d3` bridge (name table, resolved read, applyStyleByName + AllSelection head fallback)
  - `c07d0b6` state-sync (st.block + caret-driven highlight) · `d83b29ec`/`53750c2` hover preview
  - `1b4fdfd`/`4356684`/`e6a6ebc` applyStyle + pane (+Clear-All re-capture, review-found)
  - `3ab3f32` Change-List-Level resolved read · `af7c559`/`dfef873` **THE FLIP** (96/96 first
    run, zero triage) · `9e7c3dc` UI evidence
  - `9951073`/`b54bd69` oracle verb + slice-2 followUps closed + behavior verdicts
  - `7c2f314` SubtleEmphasis live-Word amendment · `02fcba7` quirk-#24 recovery
  - `0e8134b` oracle legs A/B + table spot-check evidence · `dceafa1` final-review polish
    (chords toast like gallery/pane; New Style per-click re-capture).
- **Oracle validation (spec §8.3) vs Word 16.77.1:** leg A clone→Word **PASS 5/5**
  (read-style-props reads back exact display names); leg B Word→clone **PASS 9/9**
  (paragraph styles, Strong/SubtleEmphasis character styles as textStyle marks,
  `st.block` = 'Heading 1'); minted-defaults diff (NoSpacing not-material, Strong match,
  SubtleEmphasis material → amended); table spot-check PASS (Task-5 fix vs a real
  GridTable4-Accent1 + tblLook doc). Behavior verdicts: **re-apply = APPLY (no toggle)**;
  **clearing: Word clears char marks at FULL coverage only, preserves partial** — engine
  clears unconditionally → KNOWN DEVIATION (partial case), recorded.
- **KNOWN DEVIATIONS (recorded):** partial-coverage direct-formatting clearing (above);
  custom styles / New Style deferred (no engine path); foreign docs missing built-ins
  beyond the import defaults toast instead of minting (Word mints from its library);
  empty styled paragraphs render base-size caret (decorations style text nodes only);
  `D.applyStyles` dialog stays dead code; gallery hover preview vs Word's visual scope +
  IME-mid-preview are visual-only probes deferred to user observation; plugin styles list
  is init-frozen (future modify-style feature must refresh both catalogs).
- **Next:** PR slice 3 → `main`; then **slice 4 — clipboard + editing-misc** (cut/copy/
  paste PM-native, paste-special, format painter via fork `copyFormat`, select) via
  brainstorm-lite → write-plan → execute. Backlog noted: `D.applyStyles` needs a PM branch
  if ever wired; Phase-3 logger must learn `PREVIEW_META` (preview txns ≠ user edits).
- **Blockers/notes:** none. Word left healthy (doc count 0, never quit).

---

## 2026-06-06 — Phase 2 slice 2 INTEGRATED to `main`

- **Branch:** `main` (PR #17 merged — one conflict round in the plan docs vs PR #16's
  checkpoint, resolved in `fdef0e3`; `feature/phase-2-slice-2-paragraph` deleted local+remote).
- **Phase:** **Phase 2 — slices 0a–2 DONE and on `main` → slice 3 (styles) next.**
- **State summary:** gates re-verified **on `main` post-merge**: PM 76/76, legacy 257/257.
  CLAUDE.md/AGENTS.md banners advanced to slices-0a–2/slice-3-next (this entry's PR).
- **Next:** **slice 3 — styles** in a FRESH session (orient at docs/plan/ → brainstorm-lite →
  write-plan → execute; branch `feature/phase-2-slice-3-styles` directly off `main`). Before or
  alongside: the ~5-min oracle follow-up (two pending Word reads) after a Word relaunch —
  commands in `notes/2026-06-06-slice2-oracleA-lists.json` → `followUp`. Slice-3 revisit list:
  Change-List-Level resolved-ilvl deviation; vendored `resolvedPropertiesCache` tableStyleId/
  TableInfo mismatch (both recorded in the slice-2 BUILT entry below).
- **Blockers/notes:** none.

---

## 2026-06-06 — Phase 2 slice 2 BUILT (paragraph + lists on the PM engine)

- **Branch:** `feature/phase-2-slice-2-paragraph` (directly off `main` post PR #15 — no stacked
  PRs; **PR #17** open).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 2 DONE → slice 3 (styles) next.**
- **State summary:** areas **`paragraph` + `lists` FLIPPED** (registry `bridge/index.ts:23`):
  align ×4, list-aware indent (level in lists / 36pt text-indent outside), Layout spinners
  (twips dot-paths + caret readback — new fidelity win), line-spacing menu (dynamic Add/Remove
  labels — Word behavior), paragraph **shading** (new fork render in `encodeCSSFromPPr` + setter)
  and **borders** (Word-default 0.5pt box; single edges accumulate), **sort** (one-transaction
  bridge `sortParagraphs`), bullets/numbering (+libraries now **honor glyphs** via
  `toggle*ListStyle`/`applyListDefinition`), **Word-native multilevel** patterns (real per-level
  numbering definitions — the legacy ml-* CSS fake is not ported), Change List Level (new
  one-transaction fork cmd `changeListLevelBy`), Paragraph dialog (caret seeds + ONE-undo chained
  apply), Ctrl+L/E/R/J + Ctrl+Shift+L (= List Bullet; fork's colliding Mod-Shift keymap stripped).
  **The slice-1 hanging-indent gap is CLOSED** — root cause was the fork stylesheet never entering
  the build; `main.ts` now imports `assets/styles/elements/prosemirror.css` (markers/tabs get real
  widths; evidence `docs/superpowers/plans/notes/2026-06-06-slice2-css-markers.png`).
  New oracle verb **`read-para-props`** (paragraph format + list format; quirks #16-23 documented).
  Gates: **PM 76/76** (43 + 33 new `[2]`), legacy 257/257 frozen, smoke 9/9 ×2, docx 17/17;
  full slice-2 attr round-trip evidence `notes/2026-06-06-slice2-roundtrip.png`.
- **Done this session** (plan `docs/superpowers/plans/2026-06-06-phase2-slice-2-paragraph-lists.md`,
  hardened by a 3-critic adversarial workflow; executed subagent-driven with two-stage review):
  - `a81508f` plan · `9e6fa78`/`b9958a2` red tests (33 `[2]` + paraAttrs helpers + D6 test repoint)
  - `aabc710`/`e04bf45` oracle `read-para-props` (live-verified; enums + F0B7 bullet discovery)
  - `45d5017`/`9bd804b` fork: shading render + SuperDoc align-keymap strip (NOTICE'd)
  - `5cf1f2d`/`87a16ca` fork: `applyListDefinition` + `changeListLevelBy` commands (NOTICE'd)
  - `bda0278` fork element CSS into the build (the hanging-indent fix)
  - `1e64d82`/`78908a7` align/indent/spinners/line-spacing PM branches
  - `35fd50d`/`ac0ca1c` lists libraries + multilevel menus · `152634b`/`cf98b04` shading/borders/sort
  - `453a180` state-sync (Align-Left default pressed, resolved fields, spinner readback)
  - `931a2f0` Paragraph dialog · `8d8e14f` **THE FLIP** (76/76 on first post-flip run, zero triage)
  - `3e1a186` round-trip evidence · `882ea7e` oracle validation JSONs · `86ada55` quirks #22-23.
- **Oracle validation (spec §8.3) vs Word 16.77.1:** leg A paragraph family 4/4 PASS (center /
  double=24pt / 36pt indent / 12pt before); leg B Word→clone 4/4 PASS; shading+borders PASS via
  Word-authored attribute-identical fixtures; fresh-Word-paragraph Align-Left default PASS
  (live-read). **Two reads UNVERIFIED-THIS-SESSION** (lists-family Word read; literal roundtrip
  re-save): the long headless Word session degraded (quirk #23) — follow-up commands are in
  `notes/2026-06-06-slice2-oracleA-lists.json` (`followUp` fields); needs a USER Word relaunch,
  ~5 min.
- **KNOWN DEVIATIONS (recorded):** Paragraph dialog always writes lineRule 'auto' (exact/atLeast
  converted on OK); border single-edge accumulation seeds from the selection-head paragraph;
  sort 'Date' stays parseFloat-numeric; mixed-selection alignment still head-paragraph (slice-0a
  deviation); Borders-and-Shading…/Define-New-Multilevel…/inside borders stay notImplemented;
  Change-List-Level reads the INLINE ilvl while the engine applies the delta to the RESOLVED
  level — style-inherited list paragraphs (numbering from a named style, no inline attrs) can
  land off-target (final-review finding; revisit with slice 3 styles, where resolved style
  reads land on the bridge anyway).
- **Tech-debt found:** vendored `resolvedPropertiesCache.js` passes `tableStyleId` (string) where
  `resolveParagraphProperties` expects a TableInfo object — table-style cascade silently skipped
  for in-table paragraphs (pre-existing; newly observable via state-sync's resolved fields).
- **Next:** PR slice 2 → `main`; the 5-min oracle follow-up after Word relaunch; then **slice 3 —
  styles** (gallery + LinkedStyles/setStyleById/toggleHeading; live-preview semantics on PM) via
  brainstorm → write-plan → execute.
- **Blockers/notes:** none for the PR. Word left running (never quit) but wedged for NEW opens —
  user relaunch recovers it.

---

## 2026-06-05 — Phase 2 slices 0a–1 INTEGRATED to `main`

- **Branch:** `main` (all Phase 2 work merged; feature branches deleted local+remote).
- **Phase:** **Phase 2 — slices 0a/0b/0c/1 DONE and on `main` → slice 2 (paragraph + lists) next.**
- **State summary:** the PR stack (#11–#14) was merged, but the stacked PRs cascaded into their
  base branches instead of `main` (classic stacked-merge gotcha — only #11 landed). Fixed via a
  catch-up branch from the complete tip → **PR #15**, merged. `main` verified complete (slice-1
  tip is an ancestor; oracle/fixtures/bridge files all present) and gates re-run **on `main`**:
  PM 43/43, legacy 257/257 (smoke 9/9 ×2 + docx 17/17 ran green on the identical tree pre-merge).
- **Done:** PR #15 (cascade fix); branch cleanup (`feature/phase-2-editing-core`, `-slice-0b`,
  `-slice-0c`, `-slice-1-character`, `merge/phase-2-slices-0b-1` deleted local + remote).
- **Next:** **slice 2 — paragraph + lists**, branched **directly off `main`** (no stacking —
  cut each slice branch off `main` and merge before starting the next, avoiding the cascade).
  Cycle: brainstorm-lite (confirm area inventory against real code) → write plan → red tests →
  flip → oracle validation → PR.
- **Blockers/notes:** none. The 14-slice ladder + carve-outs live in the spec §9; per-slice
  fidelity gaps recorded in the slice-1 entry below.

---

## 2026-06-05 — Phase 2 slice 1 BUILT (character formatting on the PM engine)

- **Branch:** `feature/phase-2-slice-1-character` (stacked on `feature/phase-2-slice-0c`; PR up).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 1 DONE → slice 2 (paragraph + lists) next.**
- **State summary:** ALL character-formatting entry points now run on the PM engine (area
  `character` FLIPPED): bold/italic/underline/strike/sub/sup, font/size combos (comboCommit),
  grow/shrink, color/highlight, clearFormatting, changeCase, Font dialog (one chained PM
  transaction = one undo step), QAT undo/redo (engine history, Word-like greying), in-view
  keyboard shortcuts stand down to the engine. **Oracle validation (spec §8.3) run both ways
  vs Word for Mac 16.77.1 — all PASS:** leg A clone→Word (bold/italic/Georgia-20pt read back
  per-run via the new `read-word-props` oracle verb), leg B Word→clone (Word-authored bold word
  imports with run-level truth), leg C negation-run fixture (`tests/fixtures/negation-run.docx`,
  REAL-Word-authored `w:b w:val="0"`, checked in + inlined via gen-fixture). Leg C caught and
  fixed a REAL bug: style-cascade imports emit BOOLEAN negation attrs (`{value:false}`) which
  state-sync read as bold ON (`a.value !== '0'`); plus a PM-suite harness hole (string returns
  = failure paths counted green). Evidence: `docs/superpowers/plans/notes/2026-06-05-slice1-*`.
  Gates: **PM 43/43**, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- **Done this session** (validation + wrap-up, commit SHAs; slice build commits were
  `8e4e9c1` red tests, `9f03481` character+history flip, `9dc452f` guards, `3a16cdb` Font
  dialog one-transaction, `8888ad7` history keys/QAT greying):
  - `8e521b5` — word-oracle `read-word-props` verb (word-granularity reads; 2 new dictionary quirks: never `set` a word element range to a variable; trailing-space/paragraph-mark word slicing).
  - `30dc4ea` — fix: Word negation runs read as bold ON in PM ribbon state (markOn() mirrors fork renderDOM semantics) + negation-run fixture + suite test + harness string-return tightening.
  - `7fb31e9` — oracle validation notes (3 JSON verdicts) + PM-mode UI screenshot.
- **KNOWN FIDELITY GAPS (recorded, deferred):**
  - (a) mixed-size grow-font flattens the selection to one size — real Word steps per-run.
  - (b) Font dialog on a mixed-underline selection strips underline (legacy-parity; real Word shows an indeterminate state).
  - (c) toggled-off vertAlign leaves a residual all-null `textStyle` mark (cosmetic; no render/export effect).
  - (d) UI shot: list markers render inline without hanging-indent metrics (slice 2 territory); no pagination (Phase 7, expected).
- **Next:** slice 2 — **paragraph + lists** (align ×4, indent, spacing, line-spacing, shading/borders, show-marks; toggleBullet/OrderedList, multilevel, list indent) per the NEXT plan to be written (brainstorm → write-plan → execute).
- **Blockers/notes:** none. Word left clean after every oracle leg (document count at baseline 0; never quit).

---

## 2026-06-05 — Phase 2 slice 0c BUILT (macOS Word oracle harness)

- **Branch:** `feature/phase-2-slice-0c` (stacked on `feature/phase-2-slice-0b`; PR pending).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 0c DONE → slice 1 next.**
- **State summary:** `scripts/oracle/word-oracle.js` is live — read-props (per-paragraph
  bold/italic/underline/font/size/alignment via Word's AppleScript object model) + roundtrip
  (open + save-as). Object-model only; name-verified PID safety; leak-proof read-props,
  best-effort roundtrip close. Verified live against Word for Mac 16.77.1. 13+ AppleScript
  dictionary quirks documented in `scripts/oracle/README.md`. Gates unaffected (pure tooling):
  PM 28/28, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- **Done this session** (slice 0c tasks with commit SHAs):
  - `48f55e5` — `scripts/oracle/word-oracle.js`: read-props + roundtrip implementation.
  - `cd68993` — `scripts/oracle/README.md`: full oracle documentation + 13-entry quirk table.
  - `06a10f7` — `scripts/oracle/README.md`: roundtrip close is best-effort, not guaranteed (re-review fix).
- **Next:** slice 1 — character formatting (bold/italic/underline/font/size/color → PM transactions; plan Stage D).
- **Blockers/notes:** none. Gates unaffected (pure tooling addition).

---

## 2026-06-05 — Phase 2 slice 0b BUILT (file IO on the PM engine)

- **Branch:** `feature/phase-2-slice-0b` (stacked on `feature/phase-2-editing-core`; PR pending).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 0b DONE → 0c next.**
- **State summary:** Open/Save/New run on the PM engine via bytes IPC (docx-only; html/txt/csv
  blocked until slice 7); blank fixture; parse-once `replaceEditor` with `failBridge` recovery +
  replace mutex; `Files.path` invariant enforced + tested. Done: commits `8c13d5f`/`9048cfe`
  (fixture), `3819d82` (IPC), `f4b2443`/`9224d1b`/`041499f` (openDocx/newBlank),
  `ecb33fb`/`7d8ee90` (files.js + tests). Gates: PM 28/28, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- **Done this session** (slice 0b tasks with commit SHAs):
  - `8c13d5f` — blank-document fixture for New Document on the PM core.
  - `9048cfe` — gen-fixture usage guard + regeneration commands in fixture headers.
  - `3819d82` — `doc:saveBytes`/`saveAsBytes`/`openBytes` — raw `.docx` bytes IPC channels for the PM core.
  - `f4b2443` — bridge `openDocx`/`newBlank` — editor re-creation from `.docx` bytes.
  - `9224d1b` — `replaceEditor` parse-once: dry-parse BEFORE teardown.
  - `041499f` — `replaceEditor` failBridge on failure, replace mutex, atomic exposure.
  - `ecb33fb` — `files.js` save/open/new wired to PM engine in PM mode; `Files.path` invariant.
  - `7d8ee90` — de-vacuize save-clean assertion; align PM file-IO toast wording.
- **Next:** slice 0c (oracle harness for PM mode) then slice 1 (character formatting: bold/italic/underline/font/size/color → PM transactions).
- **Blockers/notes:** none. html/txt/csv formats + generated docs (mail merge) stay blocked with toasts until their slices. PR stacked on `feature/phase-2-editing-core` (#11).

---

## 2026-06-05 — Phase 2 slice 0a BUILT (PM core is the visible editor)

- **Branch:** `feature/phase-2-editing-core` (pushed to `origin`; PR pending).
- **Phase:** **Phase 2 — Editing core behind the ribbon; slice 0a DONE, slice 0b next.**
- **State summary:** PM core (`#pm-editor`) is now the **default visible editor** behind the
  `WC.PM` bridge. The legacy app is still intact but boots only under `--legacy`. D6 two-layer
  guards are live (dispatch courtesy block + legacy mutation chokepoint). Ribbon state-sync is
  driven by engine events (caret-tracking font/size combos — fidelity win). Dirty state, statusbar,
  and visible-page commands all re-pointed to be mode-aware. PM-mode Save/Open are intentionally
  blocked until slice 0b. All gates green: legacy 257/257, PM 21/21, smoke 9/9 × 2 modes, docx 17/17.
- **Done this session** (slice 0a tasks with commit SHAs):
  - `870e01a` — `--legacy` boot flag (forwarded to renderer as `?legacy=1`)
  - `210f13f` — PM functional suite skeleton + `test:*` npm aliases
  - `a30f11c` — flip `#pm-editor` to the visible page + `WC.PM` bridge core
  - `7c25a79` — harden `failBridge` against pre-init focus; un-swallow first blocked toast
  - `cf68b84` — D6 integrity guard blocks legacy mutations in PM mode
  - `1ccc507` — block PM-mode Save until the bytes path; correct D6 audit doc
  - `9c6cad7` — D6 courtesy block: unflipped commands toast at dispatch, shortcuts D6-aware
  - `e033fe1` — PM state-sync: engine events drive toggles, combos, statusbar
  - `ab76c5f` — guard list toggle against undefined numberingType; tighten size parse
  - `23f1251` — focus discipline: chrome clicks never blur the PM view
  - `49e5e86` — keep scrollbar dragging alive inside focus-guarded containers
  - `e4ea0bf` — dirty-state readers are mode-aware (PM edits trigger save prompts)
  - `571b1e3` — visible-page commands (showHide, readMode, wordCount, properties) follow active engine
  - `e41fb67` — align paragraph-count selectors; strip `contenteditable` from overlay clones
- **Next:** slice 0b — file-IO bytes layer per
  `docs/superpowers/plans/2026-06-05-phase2-slices-0a-1.md` Stage B; then 0c oracle harness;
  then slice 1 character formatting.
- **Blockers/notes:** none. PM-mode Save/Open intentionally blocked until slice 0b. FYI the
  GitHub repo remote URL may still be `ogutdgn/ms-word-clone` (GitHub redirects; update when convenient).

---

## 2026-06-05 — Phase 1 COMPLETE; Phase 2 next
- **Branch:** `build/phase-1-scaffold` (pushed to `origin`; 18 commits ahead of `main`). Integration
  (merge/PR) is the user's pending choice; **Phase 2 starts on a fresh branch off the integration line.**
- **Phase:** **Phase 1 (Scaffold) DONE → Phase 2 (Editing core behind the ribbon) is next.**
- **State summary:** the owned ProseMirror engine mounts/renders/edits a real `.docx`; all gates green
  (smoke 9/9, functional 257/257, docx 17/17), single PM copy, telemetry off, no `superdoc` npm dep.
  Infra + visual sanity pass passed: `npm run dev` / `build` / built-launch all run; chrome is faithful
  Word; the new core renders the imported list on a Letter page (screenshots reviewed).
- **Done since the 2026-06-04 entry:**
  - Final review = **READY TO INTEGRATE** (spec §8 DoD fully covered); hardened the smoke Tab test (`8de524e`).
  - Docs follow-up: harness now needs `npm run build` first; counts 257/17 (`e5db257`).
  - **Fixed the `npm run dev` crash** (`Cannot find module './docx-utils'`): the A3 build-script `cp`
    didn't run under `electron-vite dev`; moved it to a `closeBundle` plugin (dev+build, cross-platform) (`93e5006`).
  - Plan-doc checkpoints (`4abe94b` + this entry); branch pushed.
- **Next (Phase 2, new session — WE ARE GOOD TO START):** integrate Phase 1 → cut
  `feature/phase-2-editing-core` → brainstorm → spec → plan → build: wire `WC.RIBBON` commands → PM
  transactions (strangler-fig), make `#pm-editor` the visible page (retire legacy `#editor`), wire
  `.docx` save/export on the new engine, per-feature Word fidelity vs the AppleScript oracle.
- **Blockers/notes:** none. **FYI** the GitHub repo was renamed — local `origin` still says
  `ogutdgn/ms-word-clone` (GitHub redirects; update the remote URL to the new name when convenient).
  Tech-debt carried from Phase 1: renderer bundle ~7.4 MB; `presentation-editor`+`layout-adapter`
  vendored (more than the painter-free ideal); list-marker fidelity polish.

---

## 2026-06-04 — Phase 1 build (Stages A–C)
- **Branch:** `build/phase-1-scaffold` (off `main`; not pushed yet).
- **Phase:** **Phase 1 (Scaffold) — Stages A, B, C DONE; only Stage D (final review + integrate) remains.**
- **State summary:** electron-vite + TypeScript renderer is live; the **SuperDoc engine is vendored
  as editable source** (`src/renderer/core/superdoc-fork/` incl. `_vendor/superdoc/` siblings) —
  **no `superdoc` npm dependency**, telemetry routed to a no-op, single `prosemirror-model@1.25.7`.
  The new ProseMirror core mounts a real `.docx`, renders with our schema, is typeable, and
  list **Tab/indent works**. Legacy Word app + chrome intact. **All gates green: smoke 9/9,
  functional 257/257, docx 17/17.**
- **Done this session:**
  - **Spec + plan** written/committed under `docs/superpowers/` (hardened by 4 analysis/critique
    workflows: context, design-verify, spec-critique, plan-critique).
  - **Stage A** — electron-vite + TS build chain; legacy renderer served static from `public/`;
    main dev/prod loader split + preload path; dev-only CSP via a Vite `transformIndexHtml`
    (a strict meta + relaxed header would intersect). (`e8c6276`, `0c9e904`, `d14ebd8`, `0250262`)
  - **Stage B** — npm-pin superdoc@1.38.0 + PM single-copy + barrel; headless `.docx` import +
    base64 fixture; mounted our own `EditorView` + smoke 8/8. (`2120739`, `b348425`, `3e1980b`)
  - **Stage C / Option B (own the engine)** — vendored 5 sibling `@superdoc/*` packages +
    `presentation-editor`/`layout-adapter`; stubbed 3 geometry pkgs at leaf sites; Vite
    aliases/dedupe/`define`; telemetry no-op; rewired to **Path B** (vendored `Editor` owns the
    PM view, `editor.on('transaction')` logger seam → Tab/indent for free); removed the npm dep;
    AGPL `NOTICE.md`. (`8f58e3d`, `38d1d51`, `707649a`, `3587598`)
- **Next:** Stage D — final review + `finishing-a-development-branch` (PR/merge decision) +
  docs follow-up (CLAUDE.md/BUILD_AND_RUN.md/TESTING.md: harness now needs `npm run build` first;
  real counts 257/17). Then **Phase 2** (wire ribbon commands → PM transactions).
- **Blockers/notes:** none. **Decisions this session:** ownership = **full editable source vendor
  within Phase 1** (Option B, per user); the view uses **Path B** (vendored Editor owns the view)
  — a refinement of spec §D5 ("our own thin wrapper"), plan-authorized, no ADR change (ADR-0002…0005
  still hold). **Tech-debt:** renderer bundle ~7.4 MB; `presentation-editor`+`layout-adapter`
  vendored (more than the painter-free ideal — trim in a later pass).

---

## 2026-06-04
- **Branch:** `main` (the `research-architecture` line was merged via PR #8). Today's doc work
  is on `docs/dated-plan-logs`.
- **Phase:** Phase 0 complete → **Phase 1 (Scaffold) is next** — not started.
- **State summary:** all decision/research/plan docs are now on `main`. Architecture is locked
  (ADR-0001…0005) and de-risked (spike GREEN). No build work has started.
- **Done this session:**
  - Made "**never do code work on `main`** — create + checkout a feature branch first" an
    explicit rule in `plan.md` + `execution-map.md`.
  - Restructured `last-point.md` and `execution-map.md` into **dated logs** (append-only history
    + a daily work-log with checkboxes); updated the `plan-tracking` skill to match.
- **Next:** Phase 1 — scaffold electron-vite + TS, vendor the SuperDoc fork, mount the model in
  our own `EditorView` (see [execution-map.md](execution-map.md) → CURRENT PHASE).
- **Blockers/notes:** none. ⚠️ A docs commit (`a7cb0a8`) landed on `main` by mistake before the
  branching rule was internalized; from here, all feature/doc work goes on a branch.

---

## 2026-06-03
- **Branch:** `research-architecture` (later merged to `main` via PR #8).
- **Phase:** Phase 0 complete → Phase 1 next.
- **Done this session:**
  - Locked **ADR-0001…0005** (CUA pivot · ProseMirror model · fork SuperDoc's schema + converter
    + extensions · lists = paragraph+`numId` · `.docx` via the fork).
  - **De-risk spike GREEN** (`docs/research/2026-06-03-spike-superdoc-fork.md`): headless `.docx`
    round-trip with **no Vue**; model renders to clean DOM; dependency closure 185 pkg / 148 MB.
  - Created `docs/decisions/` (ADRs + `OPEN_DECISIONS.md`), `docs/architecture/`,
    `docs/research/`, `docs/plan/`, the `plan-tracking` skill; CLAUDE.md/AGENTS.md banners;
    pushed the `research-architecture` branch.
- **Next:** Phase 1 scaffold.
- **Blockers/notes:** none.
