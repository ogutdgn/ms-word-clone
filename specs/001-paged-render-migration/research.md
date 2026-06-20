# Phase 0 Research — Milestone 4d (notes-area disable + header-footer test)

Sourced from the **M4d understanding sweep** (2 parallel readers → synthesis; code-grounded, file/line cited).

## Decision: DISABLE the `#pm-notes-area` overlay in paged (editing moves to PE's per-page footnotes)
- **Rationale**: In paged, PE paints footnote/endnote **bodies per-page** at the page bottom
  (`PresentationEditor.ts` `buildFootnotesInput` → `layoutOptions.footnotes`, ~6532-6559; the clone does NOT set
  `flowMode:'semantic'`, so it gets the per-page print path) and makes them **editable inline** via `NoteStorySession`
  (`documentMode` inherited from PE's `'editing'`, double-click to edit, ~5573-5584). The bridge's `#pm-notes-area`
  overlay (`notes-area.ts`) appends an editable region as a `#pages` child sibling of `#pm-editor`, flowing BELOW the
  sheet — in paged `#pm-editor` is the paint host, so the region renders AFTER the painted pages → **double-render +
  mis-position**. The overlay only ever existed because in OVERLAY mode note bodies are not editable PM nodes
  (`word/footnotes.xml`, Phase-7-deferred — the WHY comment at `notes-area.ts:6-13`). In paged that reason is gone.
- **Word fidelity**: Word edits footnotes inline at the page bottom, NOT in a separate below-document panel → disabling
  the overlay is HIGHER fidelity, not a regression. **Editing is NOT lost.**
- **Alternatives considered**: keep a paged fallback region alongside PE → REJECTED (that IS the double-render defect;
  two surfaces both writing `footnotes.xml`).

## Decision: the disable mechanism = a 2-point in-module gate (not skip-install)
- **Rationale**: gate inside `notes-area.ts` on `window.__WC_LAYOUT_MODE === 'paged'` so `installBridge` stays uniform
  and the `WC.NotesArea` facade survives. **(1)** `renderInner()` early-returns (hides + tears down `#pm-notes-area`,
  resets `lastSig`) in paged — covers every render path (initial `schedule()`, `showNotes()`'s `render()`, any stray
  transaction) and BOTH footnotes + endnotes (one region). **(2)** `installNotesArea()` keeps the facade
  (`refresh`/`render`/`showNotes`) DEFINED but skips the per-keystroke driver (`ed.on('transaction', schedule)` +
  initial `schedule()`) in paged → no listener thrash on the paged editor. Overlay takes NEITHER branch → byte-identical.
- **Alternatives considered**: skip `installNotesArea()` in `main.ts` → REJECTED (non-uniform install; a future runtime
  mode switch would leave the facade undefined → callers throw).

## Decision: `refShowNotes` (Show Notes) in paged = scroll the first painted footnote into view
- **Rationale** (user; Word behavior): References ▸ Show Notes jumps to the note area. The footnote is **painted DOM**,
  so the bridge can `scrollIntoView({block:'nearest'})` the first painted footnote element cheaply; `return false`
  (documented) if none is painted. NOT a PE story-session entry (non-trivial, out of scope for the light slice).
- **Alternatives considered**: full PE story-session entry (scope-creep), clean no-op (less faithful than scroll).

## Decision: header-footer.ts is mode-agnostic → PURE TEST, no production change
- **Rationale**: `header-footer.ts` installs exactly 4 verbs — `setHeaderText`/`setFooterText`/`getHeaderText`/
  `getFooterText` (116-121) — operating ONLY on the doc model: `resolveHeaderFooterSlotRuntime` →
  `selectAll()`+`insertContent()`+`runtime.commit(editor)` for writes (`setSlotText` 68-95), `doc.textBetween` for
  reads (`getSlotText` 99-114). The only side-effecty calls are `editor.view?.focus()` (32) + `WC.PM.markDirty()` (33).
  **No** `getBoundingClientRect`/`coordsAtPos`/`#pages`/`querySelector`/`.dom` math. It reads `editor.converter`/
  `editor.doc` FRESH each call and binds to `presentation.editor` in paged exactly as the plain Editor in overlay →
  mode-agnostic by construction. The story-runtime is PE-aware: `resolveStoryRuntime` checks
  `resolveLiveStorySessionRuntime` FIRST (a registry of "live PresentationEditor sub-editors for header/footer slots"),
  so a bridge set/get during an OPEN PE header session routes into the SAME live editor — **designed coexistence**, not
  a race (`setSlotText` deliberately does NOT `setEditable(true)` on the live branch, 77-80).
- **Verdict**: no fix needed → just a paged integration TEST proving (a) parity (set/get + docx export round-trip) and
  (b) interop (a programmatically-opened PE header session routes the bridge verbs into the live editor).

## Decision: verify via standalone PAGED PROBES, not new `test-suite-pm.js` cases
- **Rationale**: paged behavior needs `WC_LAYOUT=paged` (which `test:pm` does not set), matching the M2/M3/M4
  probe-per-paged-milestone cadence. The suite ALSO has a pre-existing 268/475 early-abort (tracked separately) that
  could mask a new case. The existing OVERLAY header/footer test `[9]` (`test-suite-pm.js:4853-4900`, `newBlank`
  teardown — header/footer parts are GLOBAL converter state) already covers overlay + the docx-export assertions.
- **Interop driving**: PROGRAMMATIC `HeaderFooterSessionManager` activation (computer-use is blocked for the dev
  Electron build — the recurring M2+ lesson), never a synthetic click.
