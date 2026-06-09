# Last Point — dated state checkpoints

> A running log of "where we are" at the end of each session/day. **Append a NEW dated entry at
> the TOP each time — never overwrite older entries.** The accumulated history shows our
> progression. Renewed via the `plan-tracking` skill. Big picture: [plan.md](plan.md) · session
> playbook + daily work log: [execution-map.md](execution-map.md).

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
