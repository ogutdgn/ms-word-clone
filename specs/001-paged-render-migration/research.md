# Phase 0 Research — Milestone 2 (pointer click hit-test routing)

Grounded in a read-only investigation of the vendored PresentationEditor pointer subsystem and the WC
`focus.ts` bridge. File:line references are exact.

## Finding 1 — PE ALREADY owns a complete, enabled click→caret pipeline

- **Decision**: M2 does NOT build a click router. PE's `EditorInputManager` is the router; M2 unblocks it.
- **The path** (paged): a pointer event on the painted pages →
  - `EditorInputManager.bind()` attaches `pointerdown/move/up`, `dblclick`, `click` to `#viewportHost`
    (`pointer-events/EditorInputManager.ts:664-710`; main entry `viewportHost.addEventListener('pointerdown', …)` :692).
  - `#handlePointerDown` (:1331) → `#resolveSelectionPointerHit` (:978) → `PresentationEditor.hitTest(clientX,clientY)` (`PresentationEditor.ts:3118-3236`, body path at :3205 calls `resolvePointerPositionHit({ domContainer:#viewportHost, … })`).
  - `resolvePointerPositionHit` (`input/PositionHitResolver.ts:40-83`) = DOM-first (`clickToPositionDom`) with geometry fallback (`clickToPositionGeometry` + page hint).
  - result → epoch-mapped + clamped → `editor.view.dispatch(tr.setSelection(TextSelection))` (:1680-1715) → `#focusEditor()` (:1677) moves DOM focus to the hidden contenteditable so typing follows.
- **Enabled by our boot**: `constructPresentationEditor` passes `documentMode:'editing'` and no input gate
  (`bridge/create-editor.ts`); `EditorInputManager` is instantiated + bound unconditionally in the PE ctor
  (`PresentationEditor.ts` `#initializeEditorInputManager`/`#setupPointerHandlers`). **No flag disables it.**
- **PE-native interactions present** (build-free): single-click caret, double-click word, triple-click
  paragraph, drag-select (with auto-scroll), margin-click detection, table-cell selection, header/footer hit.
- **Alternative considered**: build a WC-side click router on `WC.PM.coords.clientToPos`. **Rejected** —
  it would duplicate PE's richer pipeline (multi-click, drag, epoch mapping, focus routing) and fight it.

## Finding 2 — The bug is a CONFLICT: focus.ts clobbers PE in paged mode

- **Decision**: gate `focus.ts`'s margin-click handler off in paged mode.
- **Mechanism**: `focus.ts:60-96` adds a **document-level bubble-phase** `mousedown` handler that acts when
  `target.closest('#pm-editor')` is truthy AND `target.closest('.ProseMirror')` is falsy (i.e. "a click in
  the page sheet but not on editable text" → a margin click). In **overlay** that correctly targets the
  page margins. In **paged**, PE wiped `#pm-editor` and the editable `.ProseMirror` lives **hidden
  off-screen**, so a click on any **painted page** matches (`#pm-editor` yes, `.ProseMirror` no) → the
  handler runs `view.posAtCoords({left,top})` on the **hidden** view (`:90`, wrong coordinate space → bogus
  or null pos), `editor.commands.setTextSelection`, `view.focus()`, and `e.preventDefault()` (`:94-95`) —
  **after** PE's pointerdown already placed the correct selection → PE's caret is overwritten.
- **Rationale for the mode guard over a target guard**: in paged mode PE's `#viewportHost` fills
  `#pm-editor`, so `__WC_LAYOUT_MODE==='paged'` and `target.closest('.presentation-editor__viewport')` are
  effectively equivalent here; the mode flag is the honest statement of intent ("paged renderer owns input")
  and makes focus.ts bail completely (gutter clicks do nothing → Word-faithful). The other two `focus.ts`
  handlers (chrome-blur guard :20-39, focusin combo-capture :43-52) bind to chrome, **not** `#pm-editor`, so
  they do NOT conflict and stay untouched.

## Finding 3 — Migrate focus.ts's overlay hit-test to the M1 seam

- **Decision**: replace `view.posAtCoords({left:x,top:y})` (`focus.ts:90`) with `WC.PM.coords.clientToPos(x,y)`.
- **Rationale**: M1 built `WC.PM.coords` precisely to end direct `editor.view.*` calls; focus.ts is the
  natural first consumer. After the paged bail, this line runs only in **overlay**, where the adapter
  delegates to `view.posAtCoords` with `{left,top}` — **byte-identical** (M1's overlay-parity probe proved
  `clientToPos` == `view.posAtCoords({left,top})`). focus.ts keeps its own clamp-to-content-box logic
  (`:87-89`) and its below-text → `Selection.atEnd` branch (`:81`) unchanged; only the hit-test call swaps.

## Finding 4 — Verification gap: only programmatic selection was tested

- **Decision**: add a synthetic-**DOM-pointer** probe (the standup's `paged-spike-probe.js` only did
  `tr.setSelection`, never a real pointer event — `scripts/paged-spike-probe.js:52-68`).
- **Approach**: dispatch real `PointerEvent`s (`pointerdown`/`move`/`up`, plus a `dblclick`) on
  `.superdoc-page` at known coordinates and assert the resulting `editor.state.selection`. Use
  `WC.PM.coords.posToClientRect(P)` to compute the on-screen point of a KNOWN model pos `P`, click its
  center, and assert `selection.from ≈ P` (a true end-to-end DOM-event → caret check, distinct from the
  hit-test it exercises). Force a **multi-page** doc (insert text, as the spike did) to test near-boundary
  clicks — the sites the overlay renderer misplaces.

## Open questions
None blocking. Word click-semantics (in-text → that glyph; side margin → nearest line text; below-text →
doc end) are the behavioral acceptance reference; the Word COM oracle does not apply to interactive caret
placement (no docx artifact is produced by clicking).
