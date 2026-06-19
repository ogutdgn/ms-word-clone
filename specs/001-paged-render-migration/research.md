# Phase 0 Research — Milestone 1 (coordinate adapter + dynamic-import)

Grounded in a read-only sweep of the boot path, the `WC.PM` bridge, and the vendored
PresentationEditor. File:line references are exact.

## Decision 1 — The engine already abstracts the mode; the core adapter is a thin `editor.*` delegation

- **Decision**: The adapter's three core methods delegate to the **vendored `Editor`** instance our
  bridge already holds (`WC.editor`), NOT to `editor.view.*`.
- **Rationale**: `Editor` branches internally on `presentationEditor`:
  - `coordsAtPos(pos)` → `presentationEditor.coordsAtPos(pos)` else `view.coordsAtPos(pos)` — `Editor.ts:2053`.
  - `posAtCoords(coords)` → `presentationEditor.hitTest(clientX,clientY)` else `view.posAtCoords(coords)` — `Editor.ts:2102`.
  - `currentTotalPages` → `presentationEditor.getPages().length` — `Editor.ts:642`.
  In paged mode `presentationEditor` is set, so these resolve against the **painted** pages; in overlay
  mode it is `null`, so they resolve against the live `view`. One call site, correct in both modes.
- **Alternatives considered**:
  - *Adapter reaches the PE directly (`WC.presentation.posAtCoords/coordsAtPos`)* — works, but couples
    the adapter to PE internals and duplicates the branch `Editor` already owns. Rejected.
  - *Each consumer keeps calling `editor.view.*` and we patch them mode-by-mode* — that is exactly the
    latent bug (the overlay consumers bypass delegation). Rejected; the seam exists to end that.

## Decision 2 — The bridge-bound inner editor carries the PE back-reference (delegation is live)

- **Decision**: Binding the adapter to `WC.editor` (= `presentation.editor`, the hidden inner Editor) is
  correct because that inner editor's `.presentationEditor` points back at the PE.
- **Rationale**: `PresentationEditor.ts:933` — `(this.#editor).presentationEditor = this` (cleared to
  `null` on destroy at `:4417`). So `WC.editor.coordsAtPos(...)` delegates to the PE's painted-aware
  implementation, confirming Decision 1 for our actual wiring (`main.ts:54` binds `WC.editor = m.editor`).
- **PE public surface** (the painted-aware implementations the delegation lands on):
  `posAtCoords({clientX,clientY|left,top})` → `{pos,inside}` (`PresentationEditor.ts:4166`), backed by
  `hitTest(clientX,clientY)` (`:3118`); `coordsAtPos(pos)` → viewport-space rect (`:3419`);
  `getPages()` → `Layout['pages']` (`:2037`, page shape in `@superdoc/contracts` index `:1988`).

## Decision 3 — getPages source differs by mode; unify behind one method

- **Decision**: `getPageCount()` returns `WC.editor.currentTotalPages` when defined (paged), else the
  overlay's existing page count (`WC.PM.__pagination`). `getPages()` returns `presentation.getPages()`
  in paged mode; in overlay mode it returns a minimal shim list (count only) — full per-page geometry is
  a paged-only concept and overlay consumers that need it are M3/M4's concern.
- **Rationale**: M3 (status bar) only needs the **count**, which both modes can supply; richer page
  geometry is paged-specific. Keeping `getPages()` honest (paged-real, overlay-minimal) avoids faking
  geometry the overlay does not have.
- **Alternatives**: synthesize overlay page rects from the decoration spacers — pointless work for M1
  (no consumer in M1) and re-implements the very hack we are migrating away from. Rejected.

## Decision 4 — Adapter location & exposure

- **Decision**: `src/renderer/layout/coordinate-adapter.ts` (new dir), installed onto `WC.PM.coords`
  during bridge install (`bridge/index.ts`).
- **Rationale**: WC-owned migration glue belongs under `src/renderer/<feature>/` (sibling to `bridge/`,
  `pagination/`, `imageresize/`), never under `src/renderer/core/` (the vendored fork). `WC.PM.coords`
  gives the probe and later-milestone consumers one discoverable seam.
- **Alternative**: `src/renderer/core/coordinate-adapter/` (the Explore agent's first suggestion) —
  rejected: `core/` is `superdoc-fork`, which we keep out of.

## Decision 5 — Dynamic-import the paged path for bundle leanness

- **Decision**: In `create-editor.ts`, replace the top-level `import { PresentationEditor } from
  '@core/presentation-editor/index.js'` with a lazy `await import(...)` inside
  `constructPresentationEditor`. The overlay path (`createPmEditor`) never imports PE.
- **Rationale**: Finding #3 from the standup — static import bloats the default bundle 8.5 → 10.9 MB.
  `create-editor.ts:14` is the **only** eager renderer importer of the PE subgraph, so making it lazy
  peels `presentation-editor/* + layout-engine + painter-dom + measuring-dom` into a separate Rollup
  chunk fetched only when `WC_LAYOUT=paged`.
- **Risk/keep-in-mind**: the `WC_LAYOUT=paged` build-time `define` and the localStorage runtime override
  are unchanged; paged boot is already async (awaits first `onLayoutUpdated`), so adding one `await
  import()` is behavior-preserving. Verify the chunk actually splits (the bundle gate is exactly this).

## Decision 6 — M1 is pure infra; verification is probe + gates + bundle (no consumer rewired)

- **Decision**: M1 adds the adapter + dynamic-import and **does not** rewire focus/comments/track/status.
  Those rewires are M2/M3/M4. M1 is verified by a probe that calls the adapter directly.
- **Rationale**: runbook guardrail "ONE milestone at a time / don't run ahead"; user decision *pure infra*.
- **Consequence**: overlay default stays byte-identical (nothing it uses changed), so the 3 gates must
  remain exactly 268 / 9 / 27.

## Open questions

None blocking. Exact bundle-size threshold is measured at implement time (set a ceiling with headroom
below the 10.9 MB regressed size, near the 8.5 MB baseline).
