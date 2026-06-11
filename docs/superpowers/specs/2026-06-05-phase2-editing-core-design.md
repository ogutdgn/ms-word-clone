# Phase 2 — Editing core behind the ribbon (design spec)

- **Date:** 2026-06-05 · **Branch:** `feature/phase-2-editing-core` (off `main`, post PR #10)
- **Status:** approved in brainstorm; hardened by a 3-critic adversarial review (31
  findings applied — see §11)
- **Related:** ADR-0002 (PM model), ADR-0003 (own the SuperDoc fork incl. extensions),
  ADR-0005 (.docx via the fork's converter), `docs/plan/execution-map.md` → CURRENT PHASE,
  Phase 1 spec `2026-06-04-phase1-scaffold-design.md`.

## 1. Goal & scope

**Make the owned ProseMirror engine the editor users (and future CUA agents) actually
use:** the visible page, every ribbon command, keyboard shortcut, dialog, and file
operation driving PM transactions — while the legacy contenteditable world shrinks to a
flag-guarded fallback that exists only to prove we lost nothing, until it is deleted.

**Scope = maximum migration** (user decision): nearly all ribbon/feature/UI functionality
transfers onto the new engine within Phase 2, one feature area at a time (strangler-fig,
never big-bang). One class is **deferred out of Phase 2** (pagination-gated, §9.3); the
no-fork-equivalent class **is in scope**, handled by reimplementation (slice 10).

**Roadmap note:** D4 deliberately absorbs the *wiring* half of plan.md's Phase 6 (track
changes, comments, fields/TOC) into slices 8–9, ahead of the Phase 3 logger; Phase 6
shrinks to verification of the remaining hard constructs (sections, headers/footers).
`docs/plan/plan.md` and `OPEN_DECISIONS.md` I2 are updated via plan-tracking when this
spec lands.

**Non-goals:** pagination (Phase 7 — continuous flow is expected, not a regression);
logger/verifier/MCP (Phases 3–5 — but this phase builds their seam); React chrome
(out of plan); upstream SuperDoc tracking.

## 2. Locked constraints (guardrails — do not violate)

1. **UI fidelity:** the app keeps looking/behaving like real MS Word. The chrome
   (titlebar, tabstrip, ribbon, dialogs, backstage, statusbar) stays the existing
   vanilla-JS UI; only its *dispatch targets* change.
2. **Feature preservation:** lose **no** already-implemented feature. Enforced by the
   `--legacy` boot mode + the frozen 257-test legacy suite (§8).
3. **Invariants from Phase 1:** single `prosemirror-*` copy (electron-vite `dedupe` +
   the `@/pm` barrel as the only app-side PM import), telemetry off (`__NET_LOG` empty,
   vendored no-op), never reassign `window.WC` / `window.WC.Editor`
   (`src/renderer/main.ts:40`), `__WC_READY` set last.
4. **Per feature flipped:** validate behavior + UI vs real Word via the macOS
   AppleScript oracle; keep all gates green; add regression tests. (Docs follow-up in
   slice 0a amends CLAUDE.md rule 2: PM-mode regression tests go in
   `scripts/test-suite-pm.js`; `scripts/test-suite.js` is frozen until retirement.)
5. Generated files (`ribbon-data.js`, `icons-fluent.js`) are never hand-edited.

## 3. Decisions (settled in the 2026-06-05 brainstorm + critique)

| # | Decision | Choice |
|---|---|---|
| D1 | Page flip timing | **Flip first** (slice 0a): `#pm-editor` becomes THE page; legacy `#editor` hidden layout-preserved; `--legacy` boot flag restores the full old app |
| D2 | Test strategy | 257-test legacy suite runs **unchanged under `--legacy`** through slices 0–10; a **new PM functional suite** grows per flip; legacy tests retire only in slice 11, area-by-area, alongside legacy-module deletion |
| D3 | First slices | **0a app infrastructure · 0b file-I/O bytes layer · 0c oracle harness** (three PRs), then **slice 1 = character formatting** (+ QAT undo/redo) |
| D4 | Phase 2 end-state | **Maximum migration** — all areas transfer except the pagination-gated class (§9.3) |
| D5 | Bridge architecture | **Option A:** typed `WC.PM` bridge module is the only code that talks to the vendored Editor; legacy entry points rewritten **in place, per area, mode-aware**. No `WC.Commands` interception table, no `WC.Editor` engine-shim |
| D6 | Transition integrity | Two-layer mechanism (§7.1): a **courtesy block** at dispatch for known-unflipped doc-touching cmd ids, and a **mode-only integrity guard** inside the legacy mutation chokepoints that no-ops + toasts ANY legacy mutation in PM mode. A third command class, *visible-page-targeted app commands*, is re-pointed in slice 0a — never silently wrong |
| D7 | Undo | Engine-owned per world: PM mode uses the fork's `prosemirror-history` (already mounted); the legacy MutationObserver history stays dormant in PM mode. No cross-engine merging |

Rationale for D5 over alternatives (recorded): a `WC.Commands` interception table is
leaky by construction — 69 dropdown + 28 split controls resolve to leaf-item closures
(136 `flyItem()` call sites in commands.js alone) that never re-enter the dispatcher,
and shortcuts/QAT/dialog-OK paths bypass `WC.Commands` entirely. A `WC.Editor` shim
breaks on raw `E().node` DOM access (dozens of sites) and execCommand-verb mismatch.
In-place rewrites keep migration state explicit and greppable. **The D6 integrity guard
is not a shim** — it is a guard *inside* legacy `editor.js` code we own, added once in
slice 0a (§7.1).

## 4. Architecture

### 4.1 Topology (PM mode, the default)

```
┌─ Word chrome (unchanged vanilla JS) ──────────────────────────────┐
│  titlebar · tabstrip · ribbon · dialogs · backstage · statusbar   │
└──────────────┬────────────────────────────────────────────────────┘
               │  legacy entry points, rewritten in place per area:
               │  H.bold = () => WC.PM.active ? WC.PM.cmd('toggleBold')
               │                              : E().exec('bold')
               ▼
┌─ WC.PM bridge (NEW, TS: src/renderer/bridge/) ────────────────────┐
│  cmd()/chain() · focus discipline · state-sync · io · mode        │
│  = the ONLY code that talks to the vendored Editor                │
└──────────────┬────────────────────────────────────────────────────┘
               ▼
   vendored Editor (superdoc-fork) ── owns the PM EditorView
               │
   #pages ▸ #pm-editor  ← THE visible page
          ▸ #editor     ← hidden, layout-preserved, flag-revivable
```

### 4.2 Mode model

One boolean, decided at boot: **`WC.PM.active`**, default `true`.
`npx electron . --legacy` → main process appends `?legacy=1` to the renderer URL
(also honored directly under `electron-vite dev`) → `false`.

- The `pm-active` class is set on `<body>` **synchronously at `main.ts` module
  top-level** (before the async mount IIFE) — no legacy-then-PM flash; the §7.2
  failure path *removes* the class before toasting. (CSP forbids an inline head
  script; `main.ts` is the right place.)
- Both flip CSS rules (`#editor` hidden, `#pm-editor` page styling) are gated under
  `body.pm-active`, so `--legacy` renders byte-identically to today (including the
  unstyled `#pm-editor` mount the 257 suite already tolerates).
- The PM editor still mounts in legacy mode (today's two-worlds; harmless) — the
  smoke suite runs as a gate in **both** modes (§8.1).

### 4.3 Layering rules

1. Legacy modules never import from the fork — they call `WC.PM.*` only.
2. The bridge never reaches into legacy DOM — it exposes PM commands/state only.
3. **The bridge is passive under `--legacy`:** state-sync subscriptions and the
   focus-discipline capture handler are installed **only when `active === true`**;
   in legacy mode the bridge registers zero event handlers (else PM `transaction`
   events would race the legacy `onStateChange` sync the frozen suite asserts).
4. The chrome stays vanilla JS (UI-fidelity constraint).
5. The fork stays untouched except deliberate, NOTICE-documented fork edits.
6. `main.ts` keeps the `editor.on('transaction')` seam — the bridge formalizes it as
   the Phase 3 logger tap.

## 5. Components

### 5.1 `src/renderer/bridge/` — the `WC.PM` module (new, TS)

| File | Purpose | Key contracts |
|---|---|---|
| `index.ts` | assemble + expose `window.WC.PM` after editor mount; owns `active`, the `AREA` cmd-id→area map and `FLIPPED` area set (§7.1) | grafted onto the existing `WC` namespace, never reassigning it. Registry keys = the §9.1 area names |
| `mode.ts` | boot-mode detection (`?legacy=1` query, set from `--legacy` argv by main) | default PM; legacy only by explicit flag |
| `commands.ts` | `cmd(name, ...args)` / `chain([...])` → `editor.commands.*` / `editor.chain()`; returns the engine's success boolean; **always restores view focus after dispatch** (PM keeps `state.selection` across blur — this is the primary focus invariant, §5.1-focus) | **never cache `editor.commands`** — it is a per-access getter that captures a fresh `tr` (CommandService.js:57-81) |
| `focus.ts` | the focus discipline. **Primary invariant:** `cmd()/chain()` re-focus the view after dispatch. **Cosmetic enhancement:** capture-phase `mousedown` → `preventDefault()` extended to flyout content (flyouts are appended to `document.body` — util.js:65, outside the ribbon), tabstrip, and statusbar *buttons*; exemption list: `input[type=range]` (zoom slider, statusbar.js:40), text/number/color inputs, the ribbon search field. (Ribbon buttons already `preventDefault` per-element — ribbon.js:154/172/191/270-271/281.) `withSelection(fn)` for dialogs/combos/spinners that legitimately take focus | `withSelection` keeps its **own** captured selection — the engine nulls `options.lastSelection` on undo/redo (history.js:9-39) |
| `state-sync.ts` | one **coalesced** sync (rAF or 80 ms debounce, mirroring the legacy debounce — editor.js:26-27) off `editor.on('transaction'\|'selectionUpdate')` → `getActiveFormatting(editor)` (returns `{name, attrs}[]`, NOT a flat object) → **explicit mapping table** → `queryState()`-shaped object → `WC.Ribbon.syncToggles` + `setComboValue` + `setColorBar`. Mapping table: `strike`→`strikethrough`; `paragraphProperties.justification` `left/center/right/both`→`justifyLeft/Center/Right/Full`; **list state is a separate query** (paragraph numbering attrs — `getActiveFormatting` does not report list membership); fontSize `'12pt'`→`'12'`; negation attrs (`{value:'0'}`) → `false` | installed only in PM mode (§4.3-3) |
| `io.ts` | `exportDocx()` wrapper that converts the engine's swallowed-error contract (`undefined` result + `'exception'` event, Editor.ts:4049-4053) into a thrown error; `openDocx(bytes)` (slice 0b) via `Editor.loadXmlData` + editor re-create; **dirty tracking** off `editor.on('update')` exposed as the single mode-aware accessor `WC.PM.isDirty()/setClean()` | dirty **readers** are slice-0a rewrites: `Files.confirmDiscard` (files.js:24), `updateTitle` (files.js:103), titlebar close (app.js:36), backstage close → `newDoc` (backstage.js:49) |

### 5.2 Page flip (small edits, not a module)

Gated under `body.pm-active`: `#pm-editor` centered as THE page;
`#editor { position:absolute; left:0; visibility:hidden; }` — **absolute** takes it
out of the `#pages` flex flow (no blank gap), **`visibility:hidden`** preserves layout
boxes (`offsetTop`, `getClientRects`) while disabling paint and hit-testing.
*Not* an off-screen `left` offset: `#pages` carries the zoom `scale()` transform, which
makes it the containing block and scales any offset — at 10 % zoom a `-200vw` ghost
page would land on screen. Zoom itself transforms `#pages` (contains both) — unchanged.

Why `#editor` stays rendered at all: the legacy bootstrap binds and measures it at init
(editor.js:20 ff.) and must not throw in PM mode. The ~31 geometry-dependent legacy
tests run only under `--legacy` (where no flip happens at all); PM-mode geometry
preservation is incidental, not a gate.

Slice 0a also re-points the **visible-page-targeted** chrome (D6 third class):
status-bar word/char counts + page indicator, `wordCount`/`properties` dialogs,
`readMode`/`immersiveReader` content clones → PM doc; `showHide`/`gridlines` class
toggles → `#pm-editor` with equivalent CSS. Never silently wrong (§7.1c).

### 5.3 File I/O bytes layer (slice 0b)

- **Save:** `preload.js` `wordAPI.saveBytes/saveAsBytes` → `doc:saveBytes`/
  `doc:saveAsBytes`; main writes `Buffer.from(bytes)`, **docx-only dialog filters**
  for `saveAsBytes` (the legacy filter set offers .html/.txt — picking those would
  write raw ZIP bytes into a text file), reuses `pushRecentFile`; refuses empty
  payloads (§7.3).
- **Open/New (pulled forward — data-integrity blocker otherwise):** in PM mode,
  `Ctrl+O`/backstage/recent-files must never run the legacy mammoth→`E().setHTML`
  path (it would load into the *offscreen* doc while `this.path` re-targets Save —
  the user's file then gets overwritten by the PM doc). Slice 0b ships
  `wordAPI.openBytes` (`doc:openBytes` returns raw file bytes + path) →
  `WC.PM.openDocx(bytes)`; **New Document** re-creates the editor on the fork's
  blank-docx template (Editor.ts:2543-2560). Non-docx opens (html/txt/csv) in PM
  mode: blocked + toast until slice 7.
- **Invariant:** in PM mode `Files.path` may never point at a file whose content the
  PM doc does not represent.
- **PM-mode html/txt *save*:** blocked + toast (returns in slice 7) — routing them to
  the legacy serializer would write the stale offscreen doc. `print`/`exportPdf` are
  window-level (print what you see = the PM page) — mode-safe as-is.
- Legacy `doc:save`/`doc:saveAs`/mammoth-open stay untouched for `--legacy`.

### 5.4 `scripts/oracle/` — macOS AppleScript oracle harness (slice 0c; none exists in-repo)

Node CLI wrapping `osascript` against Word for Mac, **object-model only** (no GUI/AX
scripting — unreliable per the verified recipes; hyperlink creation known-broken in
16.77 and off-limits). Verbs: open a `.docx` · read range properties (bold/italic/
underline/font/size/color/alignment…) · apply a scripted action · save-as · close —
**PID-safe**: only ever close documents/instances the harness itself opened, never the
user's windows. Output: JSON reports consumed by §8.3. Pure tooling, zero renderer
coupling — its own PR; must exist before slice 1's oracle protocol run. Not a CI gate
(requires Word installed).

### 5.5 `scripts/test-suite-pm.js` — PM functional suite (slice 0a)

Sentinel-gated (`__WC_READY` poll — never `--shot-delay` timing), same
`{summary, results[]}` JSON probe contract as the legacy suite. Helpers mirror the
legacy suite's ergonomics but assert the **model**: `setDoc()`, `selectText('hello')`
(position-based `TextSelection`), `run('toggleBold')` via `WC.PM`, assertions on
`doc.toJSON()` marks/attrs + the state-sync output. PM classes the probe needs are
exported as window globals from `main.ts` (the established `__PM_TextSelection`
pattern).

## 6. Data flow

**A. Ribbon click → document (PM mode), e.g. Bold:** `mousedown` (no blur — §5.1
focus) → click → `WC.Commands.run({cmd:'bold'})` → `H.bold` →
`WC.PM.cmd('toggleBold')` → `editor.commands.toggleBold()` → one PM transaction →
`#dispatchTransaction` → view re-renders + emits `'transaction'` (the logger tap) →
bridge re-focuses the view.

**B. State → ribbon (same event, coalesced):** `'transaction'|'selectionUpdate'` →
debounce → `getActiveFormatting()` → `{name, attrs}[]` → **state-sync mapping table**
→ `{bold:true, fontName:'Aptos', fontSize:'12', …}` → `syncToggles` +
`setComboValue` — font/size combos now track the caret (legacy never did; real Word
does — a fidelity *win*).

**C. Typing & keyboard:** typing never touches the bridge (keystroke → PM view →
transaction → path B). Shortcuts: the fork's in-view keymaps (`Mod-B/I/U`, list
`Tab`, `Mod-Z`…) fire when focus is in the view. The document-level `app.js` keydown
map is made **D6-aware in slice 0a as a whole** (not per-area later): in PM mode,
doc-touching shortcuts route through the same guard as their ribbon commands —
blocked + toast until their area flips; app-level shortcuts (`Ctrl+S/O`, zoom) stay.
**Recorded D6 exemption:** fork keymaps already mounted for unflipped areas (e.g.
list Tab/indent before slice 2) edit the *visible PM doc* — which IS what Save
exports, so no data-integrity issue; acceptable and short-lived.

**D. Dialogs (focus legitimately leaves the view), e.g. Font dialog:** open → initial
values from `WC.PM.getState()` (was `E().queryState()`) → OK →
`WC.PM.withSelection(() => WC.PM.chain([...]))` → **one** transaction = one undo step
(matches Word).

**E. Save:** `Ctrl+S`/QAT/backstage → `WC.Files.save()` → PM mode →
`WC.PM.exportDocx()` → Blob (throws on engine-swallowed failure) → `arrayBuffer()` →
`wordAPI.saveBytes` → main writes + recent-files. Dirty flag via `WC.PM.isDirty()`.
Reminder: **Save has no `H[cmd]` handler** — its entry points are `files.js`,
`app.js:19/65-66`, `backstage.js:47-48` (verified); those get the mode check.

**F. Legacy mode:** every flow short-circuits at `WC.PM.active?` into the unchanged
legacy branch — execCommand, `selectionchange` sync, html-to-docx save — and the
bridge has registered no listeners (§4.3-3).

### 6.1 Undo/history (D7)

- **PM mode:** fork History extension (already in the starter set) — `undo`/`redo`
  commands, `Mod-Z/Mod-Shift-Z/Mod-Y` in-view. QAT ↶/↷ + `E().exec('undo')` call
  sites rewritten mode-aware in **slice 1**. Granularity = Word fidelity: dialog
  applies are one chained transaction = one undo step; the fork's keymap already
  `closeHistory()`s around structural edits. Polish: QAT buttons grey out via
  `editor.can().undo()` (legacy never had this; real Word does).
- **Legacy mode:** the MutationObserver snapshot history (observer wiring
  editor.js:29-33; snapshot methods editor.js:613-652) keeps working untouched; it
  observes only `#editor`, so it is dormant in PM mode by construction.
- Undo/redo emit transactions → the future logger sees them as first-class actions.

## 7. Error handling & edge cases

1. **D6 enforcement — the two-layer mechanism (+ the third class):**
   - **(a) Courtesy block at dispatch:** `WC.Commands.run/dropdown/comboCommit/
     comboDropdown/spinner/applyStyle/launcher` consult the `AREA` map + `FLIPPED`
     set; a doc-touching cmd whose area is unflipped toasts before any dialog/flyout
     opens. Nice UX, known-leaky — which is why:
   - **(b) Integrity guard at the legacy mutation chokepoints** (added once in slice
     0a, inside `editor.js` which we own — *not* a shim): in PM mode,
     `WC.Editor.exec/insertHTML/insertNodeHTML/setHTML/applyInlineStyle(s)/
     applyBlockStyle/applyMultilevelPattern/…` no-op + toast. Elegant property: no
     area lookup needed — *any* call reaching a legacy mutation in PM mode is by
     definition an unflipped path (flipped paths call `WC.PM`). This catches every
     leaf closure, dialog-OK, and shortcut the dispatch layer misses.
   - **Audit deliverable (slice 0a):** the enumerated list of raw `E().node` DOM-
     mutation sites that bypass even the chokepoints (e.g. changeCase TreeWalker,
     find-pane `.find-hit` rewrite, track-changes DOM, draw ink layer), each with a
     block/defer decision. The whole `app.js` keydown map and QAT become D6-aware in
     slice 0a (§6.C).
   - **(c) Visible-page-targeted app commands** (showHide, gridlines, readMode,
     wordCount, properties, navigationPane, immersiveReader): re-pointed in slice 0a
     (§5.2) — blocked only if re-pointing is non-trivial; **never silently wrong**
     (wrong word counts / wrong read-mode content are worse than a toast).
2. **PM mount failure → auto-fallback:** if `main.ts` catches an init error
   (`__WC_ERROR`), it **removes `body.pm-active`** (un-flip) before toasting and the
   legacy world boots visibly. The app never starts to a blank page.
3. **Export/save failure:** `io.ts` throws on the engine's swallowed-error case →
   `files.js` shows "Save failed" and writes nothing; main refuses empty byte
   payloads — a failed export can never truncate an existing file.
4. **Focus discipline:** primary invariant = re-focus after dispatch (§5.1); the
   `preventDefault` layer is cosmetic and scope-listed (flyouts on `document.body`,
   tabstrip, statusbar buttons; exemptions: range/text/number/color inputs). Combo
   inputs/spinners take real focus and use `withSelection()`. Focus-taking controls
   of **unflipped** areas are wrapped by `withSelection` from slice 0a so a blocked
   command never costs the user their PM selection. After undo/redo the engine nulls
   `lastSelection` — `withSelection()` relies only on its own captured selection.
5. **State-sync truthfulness:** negation attrs and `paragraphProperties.
   justification` via the §5.1 mapping table; list state queried from paragraph
   numbering attrs; PM suite includes imported-doc negation-run tests.
6. **Command failure = Word behavior:** `editor.commands.*` → `false` when
   inapplicable; ribbon does nothing (like Word); bridge returns the boolean for
   tests; dev builds `console.debug` it.
7. **Invariants stay gated** in both modes: telemetry-off, single PM copy, `WC`
   namespace identity, `__WC_READY` last.
8. **Status bar honesty:** continuous flow until Phase 7 → page indicator reports
   "Page 1 of 1" in PM mode; word/char counts read the PM doc (slice 0a, §5.2).

## 8. Test strategy & definition of done

### 8.1 The gates (every slice leaves all green; `npm run build` first; the `test:*`
npm aliases are a **slice 0a deliverable** — they do not exist today)

| Gate | Alias → command | Mode | Status through Phase 2 |
|---|---|---|---|
| Legacy functional **257** | `test:legacy` → `--legacy --probe-out=… --shot-evalfile=scripts/test-suite.js --shot-delay=800` (keep the validated delay — the legacy harness is delay-driven) | `--legacy` | **frozen through slices 0–10**; slice 11 retires tests area-by-area alongside legacy-module deletion |
| Docx round-trip **17** | `test:docx` → `node scripts/test_docx.js` | Node | guards the legacy html-to-docx path (still live under `--legacy`); retired at **slice 7 (File I/O swap)**, which must land the PM-converter round-trip suite first. Interim: the PM save path is covered by slice-0b infra tests + per-area round-trip assertions growing in the PM suite from slice 1. **[2026-06-10 amendment, slice 7]:** `test_docx.js` was demoted (not deleted) to the frozen legacy-converter gate per §8.2; `test:roundtrip` (`node scripts/test-roundtrip-pm.js`) is the PM docx gate — see the slice-7 plan D7.6. |
| PM smoke **9** | `test:smoke` (default) **and** `test:smoke:legacy` (`--legacy`) | both | frozen invariants; the both-modes claim in §4.2 is gated, not assumed |
| **PM functional** (new) | `test:pm` → `--shot-evalfile=scripts/test-suite-pm.js` | default | grows every slice; slice 0a/0b ship infra tests: flip happened · `--legacy` restores the old world · D6 chokepoint guard blocks+toasts · dirty/confirmDiscard works on PM edits · `exportDocx` round-trip yields a valid `.docx` · `openDocx` loads it back |

### 8.2 Per-area test rule

Each flipped area adds PM equivalents of its ~35-40 dispatch-coupled legacy tests plus
new fidelity tests (negation runs, undo granularity, combo sync). Legacy tests retire
only with their legacy implementation (slice 11).

### 8.3 Oracle protocol (per feature flip; manual; reports checked into the slice's PR)

1. **Clone → Word:** action in the clone → save via bytes-IPC → `scripts/oracle/`
   opens it in real Word → reads back range properties → JSON diff vs expected.
2. **Word → clone:** same action in real Word → save → **import via
   `WC.PM.openDocx`** (available from slice 0b) → compare `doc.toJSON()`.
3. **UI fidelity:** side-by-side screenshot review (`--shot` harness) vs real Word.

### 8.4 Per-slice definition of done

entry points rewritten → state-sync wired → PM tests added → gates green → oracle
protocol run → plan-docs checkpointed (plan-tracking skill) → PR.

## 9. Migration sequence

### 9.1 Slices (registry area keys in **bold**; each slice = one branch/PR)

| Slice | Area | Notes |
|---|---|---|
| 0a | — app infrastructure | page flip + `--legacy` + bridge (5 files) + state-sync + D6 mechanism (chokepoint guard + dispatch block + keydown/QAT audit + visible-page re-points + dirty re-point) + PM-suite skeleton + `test:*` aliases |
| 0b | — file-I/O bytes layer | `saveBytes`/`saveAsBytes` (docx-only filters) + `openBytes`/`openDocx` + New-on-blank-template + non-docx block&toast + `Files.path` invariant |
| 0c | — oracle harness | `scripts/oracle/` CLI (§5.4); pure tooling PR; prerequisite for slice 1's validation |
| 1 | **character** (+ QAT undo/redo) | bold/italic/underline/strike/sub/sup/font/size/grow-shrink/color/highlight/clearFormatting/changeCase/textEffects → fork mark commands; Font dialog; combo sync |
| 2 | **paragraph**, **lists** | align ×4, indent, spacing spinners, line-spacing, shading/borders(para), show-marks; `toggleBulletList/OrderedList`, multilevel, list indent — the fork's Word-native numbering |
| 3 | **styles** | gallery + `LinkedStyles`/`setStyleById`/`toggleHeading`; live-preview semantics on PM |
| 4 | **clipboard**, **editing-misc** | cut/copy/paste (PM-native), paste-special, format painter (fork `copyFormat` — format-commands.js:101 — is already mounted), select |
| 5 | **find-replace** | fork Search extension (decoration-based, replaces destructive `.find-hit` spans); find pane re-point |
| 6 | **insert-basics** | link, table (+table tools), image (pickImage → PM `Image`), page break, symbol/equation (Math), bookmark, horizontal line |
| 7 | **file-io** | open for html/txt/csv re-enabled; PM-converter round-trip suite replaces `test_docx.js`; retire html-to-docx/mammoth/docx-utils for `.docx` |
| 8 | **review** | comments (fork ranges + existing pane), track changes (fork marks; accept/reject), language/proofing re-points |
| 9 | **references** | footnote/endnote → TOC → citations/bibliography → captions/index (fork field family; TOC page numbers degrade gracefully until Phase 7) |
| 10 | **themes**, **mail-merge**, **draw**, **insert-exotica** | one PR per engine: themes/design re-point · mail-merge engine drives PM `FieldAnnotation` · draw/ink overlay re-hosted on the PM page · coverPage/wordArt/dropCap as PM content |
| 11 | — retirement | default boot loses the legacy editor; legacy tests retired area-by-area with module deletion; **quarantine** = legacy modules moved under `src/renderer/public/js/legacy/`, loaded only when `?legacy=1`; the flag's keep-vs-delete fate decided here and recorded in OPEN_DECISIONS (or a superseding ADR if it changes a locked choice) |

Order within 2–10 may adjust per findings. Slice 10's four engines are independent PRs.

### 9.2 App-level commands (never touch the document)

Zoom, views, ruler, focus, window/macros toasts, help, backstage chrome — available in
both modes; only their *data source* is mode-aware. The visible-page-targeted subset
(§7.1c) is re-pointed in **slice 0a** (cross-ref §5.2); the rest fold into whichever
slice touches them.

### 9.3 Carve-outs

| Class | Items | Disposition |
|---|---|---|
| **Pagination-gated** (deferred OUT of Phase 2) | page-setup *visual* geometry (margins/orientation/size/columns), header/footer **editing** (needs live child editors), page-number fields' visual effect, multi-page indicators | Phase 7. Model-side attrs may land earlier where the fork supports them; imported headers/footers round-trip unchanged through save |
| **No-fork-equivalent** (IN Phase 2 scope) | draw/ink engine, design themes engine, mail-merge engine | reimplemented against PM in slice 10 (engines stay ours; only their document-mutation calls move to the bridge). *Format painter is NOT in this class* — the fork ships `copyFormat` (already mounted); it flips in slice 4 |

## 10. Phase 2 definition of done

- **Slices 0a–11 landed:** default boot = the PM page with the full migrated feature
  set; legacy editor retired from default boot per slice 11's recorded decision.
- All gates green at every checkpoint; both hard constraints intact; every flipped
  area oracle-validated.
- The `dispatchTransaction` seam + `WC.PM` bridge documented as the Phase 3 logger tap.
- Plan docs current (plan-tracking); plan.md roadmap + OPEN_DECISIONS I2 updated per
  §1's roadmap note; new ADRs only if a locked choice changed (none expected).

## 11. Provenance

Brainstormed + decided 2026-06-05 (this session): context mapped by a 6-agent workflow
over the dispatch layer, PM core API, page shell, test harness, docx paths, and feature
inventory; spec then hardened by a 3-critic adversarial workflow (claims-vs-code,
consistency, design-holes — 31 findings, all applied: notably the D6 two-layer
enforcement mechanism, the slice-0b Open/New data-loss fix, `visibility:hidden` over
transform-scaled offsets, flyout/zoom-slider focus scope, the state-sync mapping table
+ debounce, bridge passivity under `--legacy`, dirty-reader re-points, and the slice-0
three-way split). User decisions: D1 flip-first, D2 dual-suite, D3 slice 0+1, D4
maximum migration (absorbing plan.md Phase 6's wiring half), D5 Option A bridge, D6
block+toast with integrity guard, D7 engine-owned undo.
