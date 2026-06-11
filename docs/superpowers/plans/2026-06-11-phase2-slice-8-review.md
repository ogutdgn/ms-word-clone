# Phase 2 — Slice 8: review (comments · track changes · proofing) on the PM engine

- **Status:** CRITIQUE-HARDENED (3-critic workflow 2026-06-11, 18 verdicts: 1 blocker,
  6 amendments, 4 info, 7 confirmed-ok — §5) → executing
- **Branch:** `feature/phase-2-slice-8-review` (off `completion-driven-agent-loop`; PR back into it — NEVER `main`)
- **Spec:** `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md` §9.1 row 8 + §8.3/§8.4
- **Parity contract:** `.oracle-probes/slice8/parity.md` (50 items, all `[ ]`, captured live vs Word for Windows 16.0 2026-06-11; evidence `word-ref/01–32.png`)
- **Reference:** Word for WINDOWS 16.0 (loop Step-0 note). Mac deviations re-evaluated here (ledger C: the slice-5 find-pane row).

## 0. Ground truth already verified (author pre-verification)

- Fork track-changes commands EXIST (`extensions/track-changes/track-changes.js`):
  `toggleTrackChanges`(:487)/`enableTrackChanges`(:499)/`disableTrackChanges`(:509),
  `acceptTrackedChange`(:284), `acceptTrackedChangeBySelection`(:291),
  `acceptTrackedChangeById`(:332), `acceptAllTrackedChanges`(:345),
  `rejectTrackedChangeById`(:358), `rejectTrackedChange`(:371),
  `rejectAllTrackedChanges`(:419), `toggleTrackChangesShowOriginal`(:519),
  `enableTrackChangesShowOriginal`(:531), `disableTrackChangesShowOriginal`(:541).
- Fork comments commands EXIST (`extensions/comment/comments-plugin.js`):
  `addComment`(:61), `addCommentReply`(:151), `insertComment`(:202),
  `removeComment`(:246), `setActiveComment`(:253), `resolveComment`(:310); typed
  options in `extensions/types/comment-commands.ts` (:173–:266).
- Converter has comment OOXML handlers: import
  `core/super-converter/v3/handlers/w/commentRange/comment-range-translator.js`;
  export `core/super-converter/v2/exporter/commentsExporter.js`. w:ins/w:del
  handled by track-changes converter paths (slice-7 era inventory).
- Legacy engines to re-point/retire: `public/js/review-tools.js` (Review.*),
  `public/js/comments.js` (Comments.*), dialogs in `public/js/dialogs.js`.
- D6: `review` area NOT in FLIPPED (`bridge/index.ts`); `[0a]` D6 test probes
  `newComment` (test-suite-pm.js:161-165).

## 1. Scope decisions (recorded up front; deviations → ledger C at slice end)

- **D8.1 Ribbon regroup to modern layout** (parity R1): edit
  `docs/research/raw-research.json` review-tab section + `npm run` gen
  (`scripts/gen.js`) — Markup group (displayForReview combo · filterMarkup btn ·
  showMarkup ▾ · reviewingPane split · dialog launcher) + Tracking group
  (trackChanges split · accept split · reject split · previousChange ·
  nextChange). Comments group order: newComment · deleteComment ▾ · previousComment ·
  nextComment · showComments ▾. `linkedNotes` REMOVED (absent in modern build);
  `blockAuthors` stays disabled-with-tooltip (cloud).
- **D8.2 Display-for-Review mapping:** All Markup = fork marks rendered (native).
  Original = fork `enableTrackChangesShowOriginal`. No Markup ("final") and
  Simple Markup = view-layer presentation: `#pm-editor` container classes
  `review-none` / `review-simple` hiding ins/del mark decoration styles +
  swapping deletion display, mirroring the legacy CSS-mode approach — NO doc
  mutation, exports unaffected. Simple additionally renders red changed-line
  bars + collapses balloons.
- **D8.3 Comments UI:** modern contextual CARDS (composer + thread + timestamps
  + Contextual|List switch + per-comment edit; resolve+delete via card menu)
  built as a clone-owned DOM overlay fed by the fork comments plugin state;
  List view = right-dock pane (re-skinned from the legacy pane shell). Reactions
  (👍): UI + in-session metadata only — OOXML round-trip of reactions is a
  recorded deviation (modern Word uses commentsExtensible; out of scope).
- **D8.4 Reviewing Pane:** left-dock pane fed by a new bridge provider that
  merges tracked-change marks + comments into Word's revision-list shape
  (author · type label · content), with live count; comments COUNT (parity T11).
- **D8.5 Proofing:** Word Count (re-point counts at PM text), Thesaurus (legacy
  THES list re-pointed; definitions = sign-in-gated in real Word → our pane
  omits definitions section), Editor pane = DEGRADED local (spell-counts only,
  Word-like layout; cloud score absent — class B), Translate = menu parity +
  class-B degradation, Language dialog = full parity (proofing-language attr on
  PM marks/doc metadata as the fork supports; else doc-level setting),
  Spelling&Grammar split menu parity, Accessibility Assistant = re-point legacy
  checks, rendered in Word's category-card layout, Read Aloud = re-point at PM
  text with per-word highlight via decorations.
- **D8.6 Compare:** dialog parity (incl. More>> settings, word/character level);
  engine = legacy wordDiff re-pointed to produce REAL fork tracked changes in
  the CURRENT doc (Word opens a new doc — recorded deviation unless cheap).
- **D8.7 Track Changes ▾:** For Everyone | Just Mine | Lock Tracking. Just Mine
  = same as For Everyone in single-author clone (recorded note); Lock Tracking
  dialog parity (password pair; enforcement = toggle lock flag consumed by the
  toggle handler; "not a security feature" honored literally).
- **D8.8 Chrome pill (Editing→Reviewing):** the clone's title-bar has no mode
  pill today — ADD the pill (Editing/Reviewing/Viewing menu) IF cheap within the
  existing titlebar; else record C-deviation and sync Track Changes state only.
  (Inner loop decides; parity T1 splits accordingly.)

## 2. Execution order (each task: red tests where engine-observable → implement → two-stage review → commit)

1. **[8] RED TESTS** (`scripts/test-suite-pm.js`, new `[8]` section; suite count
   grows; D6 `[0a]` probe repointed `newComment`→`tableOfContents` in the SAME
   commit so the guard test never goes vacuous): trackChanges toggle latch +
   state-sync key; insert/delete produce `trackInsert`/`trackDelete` marks (names
   per fork const.js); accept/reject one+all+by-selection semantics; showOriginal
   mode flips; comments add/reply/resolve/remove + setActiveComment; revisions
   provider merge (counts comments); display-mode classes; docx pins via
   `exportDocx({exportXmlOnly})` greps: `<w:ins\b`, `<w:del\b`,
   `<w:commentRangeStart`, `<w:commentReference`, comments part presence via
   exportDocxBytes+docx-inspect in the roundtrip driver only if cheap.
2. **bridge/review.ts** — `installReview(editor)`: command registrations
   (`WC.PM.cmd` names: `toggleTrackChanges`, `acceptChange`, `rejectChange`,
   `acceptAll`, `rejectAll`, `nextChange`, `prevChange`, `setReviewView`,
   `addComment`, `replyComment`, `resolveComment`, `deleteComment`,
   `nextComment`, `prevComment`, `setProofingLanguage`, …), state-sync keys
   (`trackChanges`, `reviewView`), providers (`getRevisions()`,
   `getComments()`), display-mode class driver, lock-tracking flag.
3. **Ribbon regroup** (D8.1) + handlers `H.*` re-pointed via the PMA() pattern
   (commands.js), keyboard chords (Ctrl+Shift+E, Ctrl+Alt+M) pmBlockedOr→PM.
4. **Comments UI** (D8.3) — overlay cards + list pane + glyphs.
5. **Tracked-changes chrome** (D8.4/D8.2) — changed-line bars, format balloons,
   Reviewing pane, display modes.
6. **Dialogs + proofing** (D8.5–D8.7) — Track Changes Options (+Advanced; the
   options it controls map to clone settings actually consumed), Lock Tracking,
   Language, Word Count, Compare, panes.
7. **THE FLIP** — `review` → FLIPPED set; legacy review/comments modules become
   `--legacy`-only; remove block toasts; chrome pill decision (D8.8).
8. **Gates** ×6 + **inner loop** (execute↔compare↔fix vs all 50 parity items,
   side-by-side under computer use; Document8 still open in Word) + **oracle
   legs** (clone→Word: comments+tracked docx opens clean, Reviewing pane lists
   match; Word→clone: Document8 saved as fixture, import renders identically;
   verdicts JSON `docs/superpowers/plans/notes/2026-06-XX-slice8-oracle.json`).
9. **Checkpoint** (plan-tracking; ledger C updates: reactions persistence,
   Just-Mine, Compare-into-current-doc, chrome pill if dropped, find-pane Mac
   row re-evaluation) + **PR into `completion-driven-agent-loop`**.

## 3. Risks for critique (verify against code; blockers amend this plan)

- **K1:** Do fork comment commands need SuperDoc-app UI context (Vue host,
  `editor.options.ydoc`, user identity) or do they work headless on our editor
  construction? Verify `addComment` path end-to-end incl. what
  `editor.options.user` it stamps.
- **K2:** Mark NAMES for red tests: confirm `TrackInsertMarkName`/
  `TrackDeleteMarkName`/`TrackFormatMarkName` string values in
  `extensions/track-changes/const.js` (+ what schema mark names appear in
  doc.toJSON()).
- **K3:** Is `commentsExporter.js` actually INVOKED by our `exportDocxBytes()`
  path (or dormant code)? Trace exporter wiring; same for comment import via
  openDocx. If dormant: wiring task lands in task 2 with explicit NOTICE'd fork
  edits.
- **K4:** Does the fork emit `w:rPrChange` (tracked FORMAT changes) on export
  and import it back? If absent: format-change tracking is render-only this
  slice (ledger C note) and red tests pin only ins/del round-trip.
- **K5:** `toggleTrackChangesShowOriginal` semantics — does it RENDER original
  (decoration-level) or rebuild doc state? Exports must stay final-text.
- **K6:** Comment marker nodes (`commentRangeStart/End`, `commentReference`) —
  are they in OUR schema build (ExtensionService list) or do they need
  registration? Blank-template docs must accept them.
- **K7:** ribbon-data regen — confirm `scripts/gen.js` source of truth +
  regen command + that contextual-tab injection (slice 6) survives regrouping;
  H&F snapshot byte-identity rule from slice 6 applies where?
- **K8:** Legacy `Review.onBeforeInput` interception — confirm it can't fire in
  PM mode already (guards), so no double-tracking when fork tracking is on.
- **K9:** prosemirror-history vs fork tracking: does undo of a tracked insert
  remove the mark+text atomically (history event grouping with appendTransaction
  steps)? Red test T22 shape depends on it.

## 5. CRITIQUE AMENDMENTS (binding; supersede conflicting text above)

**A1 (K7 BLOCKER) — gen.js is broken for the regroup.** There is no `npm run gen`;
the command is `node scripts/gen.js`, and gen.js:99 still writes to the dead
pre-Phase-1 path `src/renderer/js/ribbon-data.js` (ENOENT crash; the live file is
`src/renderer/public/js/ribbon-data.js`). Task-3 step 0: fix gen.js's output path,
run with ZERO raw-research edits, and require a CLEAN DIFF vs the checked-in file
before any review-tab JSON edit. gen.js also rewrites docs/NOT_IMPLEMENTED.md,
docs/research/visual-spec.md and tech-notes.md with stale pre-pivot text
(gen.js:106,134,145,155) — diff-review those side effects deliberately or scope
gen.js to ribbon-data only.

**A2 (K1+K3+store-drift) — comments MUST go through the Document API.** Raw
`editor.commands.addComment` only marks the selection and EMITS content
(`commentsUpdate` event, default no-op Editor.ts:754); `addCommentReply`/edit are
event-only; `resolveComment` never stamps isDone; and export reads
`converter.comments` — which raw commands never write — while the commentRange
decode DROPS anchors with no matching store entry. In-session comments created via
raw commands export to NOTHING. Bridge drives `editor.doc.comments.*`
(comments-wrappers.ts:1720-1739: add/edit/reply/resolve/reopen/remove/setActive/
goTo/get/list — lazily available on our plain editor, no Vue/ydoc) which runs the
command AND upserts the entity store + isDone/resolvedTime. Undo reconciliation
(`reconcileCommentEntityStoreWithAnchors`) also lives only on that path. Bridge
`getComments()`/revision counts filter `trackedChange === true` projection rows;
card geometry consumes the plugin's `comment-positions` + `commentsUpdate` events.
ALSO: `addComment` hard-requires a non-collapsed selection → bridge expands
caret→word first (Word parity); set a REAL author identity in create-editor.ts
(currently `{name:'local'}` → stamped as w:author/w:initials and shown on cards).

**A3 (showFinal) — D8.2 mapping is fork-native ×3, CSS ×1:** All Markup =
`disableTrackChangesShowOriginal` (resets BOTH view flags); Original =
`enableTrackChangesShowOriginal`; **No Markup = `enableTrackChangesShowFinal`**
(track-changes.js:551-571 — exists; drop the planned `review-none` CSS); Simple
Markup = `enableTrackChangesShowFinal` + clone-owned changed-line bars/balloon
chrome (`review-simple` class). Red tests assert the PLUGIN flags
(`TrackChangesBasePluginKey.getState` onlyOriginalShown/onlyModifiedShown), not
container classes. Exports are view-mode-independent (verified; isFinalDoc is a
separate explicit export arg — exists for save-as-final, do not rebuild).

**A4 (cmd ids) — gen.js derives cmd from the LABEL** (gen.js:62, no override).
To rename cmds (deleteComment/previousComment/nextComment/previousChange/
nextChange) while keeping Word-faithful labels: extend gen.js with an optional
per-control `"cmd"` override field (`cmd: c.cmd ? c.cmd : camel(c.label)`).
Add the Tracking-group dialog launcher to `Commands.launcher` + LAUNCHER_AREA_CMD
(commands.js:1099-1113) or it lands on notImplemented un-D6-blocked. Add icon-map
entries + `node scripts/gen-icons.js` for previousChange/nextChange/filterMarkup
(icons.js ALIAS already covers deleteComment/previousComment/nextComment).
Red test pins group-specific nav (Comments Prev/Next ≠ Changes Prev/Next — the
current shared-cmd heuristic at commands.js:785-787 is a known infidelity).

**A5 (AREA completeness) — these review-tab cmds are NOT D6-blocked today** and
silently drive the hidden legacy editor in PM mode: displayForReview, showMarkup,
reviewingPane, compare, checkAccessibility, restrictEditing, translate, readAloud,
editor, spellingGrammar (bridge/index.ts:85-87 lacks them; isBlocked returns false
for unmapped cmds). Task 2 enumerates EVERY post-regroup review-tab cmd into AREA
(or deliberately app-level with a PM-aware handler, like wordCount). Add a
self-enforcing `[8]` audit test: walk WC.RIBBON's review tab and assert every
doc-touching control's cmd is AREA-mapped.

**A6 (state-sync) — do NOT extend the shared TOGGLE_MAP** for trackChanges: in
--legacy mode syncToggles would read `!!undefined` and clobber the legacy latch
(review-tools.js:24-25) — a silent regression the frozen gate misses. Use the
format-painter DIRECT-POKE pattern (state-sync.ts:149-155, controlIndex +
classList) — PM-only by construction. Seed the displayForReview combo input to
"All Markup" (non-font combos render empty, ribbon.js:184).

**A7 (red-test facts):** mark names live in `extensions/track-changes/constants.js`
(NOT const.js): 'trackInsert'/'trackDelete'/'trackFormat'. Tracked DELETE keeps
the text and ADDS the mark — assert mark presence, not text removal. trackFormat
fires only for TrackedFormatMarkNames = [bold, italic, strike, underline,
textStyle, highlight, link] (constants.js:9). Undo of a tracked insert is ATOMIC
(dispatchTransaction rewrite, single history event — assert final doc state after
undo, not per-character). Both `[0a]` D6 guards converge on `tableOfContents`
after the repoint but exercise distinct dispatch heads (run:950 / dropdown:959) —
both stay.

**A8 (legacy survival):** every renamed/regrouped review cmd's H.* handler keeps a
working legacy else-branch (PMA pattern → WC.Review/WC.Comments) — the frozen gate
calls WC.Review.* directly and won't catch dead legacy ribbon buttons; run
test:legacy after the regroup commit + a manual --legacy review-tab smoke.

**Oracle watch-items (info):** w:del wrapper on non-text atoms lacks author/date
(track-change-helpers.js:115-127); tracked deletions across field chars normalize
to stay conformant — check both in leg A if exercised.

## 4. Definition of done (spec §8.4 + loop contract)

Entry points rewritten → state-sync wired → `[8]` tests green → six gates green
→ all 50 parity items `[x]` or ledger-justified → oracle legs PASS → plan-docs
checkpointed → PR merged into `completion-driven-agent-loop`.
