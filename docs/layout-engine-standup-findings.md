# Option-B Layout Engine — Standup Spike Findings (2026-06-18)

> A throwaway-grade **learning spike** to convert "the SuperDoc layout engine *transpiles*"
> into "it **runs and paints real pages** in our app." Branch `feature/superdoc-layout-engine-vendor`.
> Deliverable = this note (input for the spec-driven plan), not production code. Behind the
> `WC_LAYOUT=overlay|paged` toggle; the shipping app (default `overlay`) is untouched.

## Verdict: GO — the engine stands up, paginates, and keeps the model page-free

Headless probe (`scripts/paged-spike-probe.js`, run in the real Electron renderer with a painted
window): **18/18 PASS** in `WC_LAYOUT=paged`. Key results:

| Proof | Result |
|---|---|
| Real per-page DOM (`.superdoc-page[data-page-index]`) | ✅ page-0 = **816×1056px** (true US-Letter @96dpi) |
| **Real pagination** (overflow one page → N pages) | ✅ inserting ~35k chars → **getPages() 1 → 12** + **12** painted `.superdoc-page` elements |
| Model stays **page-free** (so `.docx` round-trips) | ✅ no `"type":"page"` node, even at 12 pages |
| Inner PM view present + editable (bridge binds here) | ✅ `WC.view.dispatch` + `.dom.isContentEditable` |
| Caret maps to the painted pages | ✅ programmatic selection lands (`from=3`) + a selection-overlay rect paints |
| Typing mutates the inner doc | ✅ |
| WC bridge installs without throwing | ✅ (the feared sub-installer `#pm-editor`/`.pages` derefs did NOT fatally throw) |
| Boot error / layout error | ✅ none (`onLayoutUpdated` fired; no `onLayoutError`) |

Visual confirmation: a real Letter sheet renders the doc with a working caret and the WC ribbon
chrome intact; after overflow, page 1 of 12 is filled to the margins with text.

**Regression (default `overlay` build):** `test:pm` **268/268**, `test:smoke` **9/9**,
`test:roundtrip` **27/0** — all green. The overlay path is byte-for-byte unchanged.

## The verified construction recipe (what actually worked)

- `new PresentationEditor({ element: mountEl, mode:'docx', content: parsed.docx, mediaFiles, fonts,
  extensions: getStarterExtensions() /* NO Pagination/ImageResize */, documentId:'wc-paged-boot',
  documentMode:'editing', user, isDebug:false, telemetry:{enabled:false} })`.
- Paint is **automatic** (the ctor schedules a rAF rerender). Await the **first** `onLayoutUpdated`
  before declaring ready (so `__WC_READY` never races first paint); reject on `onLayoutError` /
  timeout and `destroy()` on reject to avoid an orphaned hidden host + a live static-registry entry.
- PresentationEditor **wipes `mountEl`** and builds a **hidden offscreen inner Editor** (the real
  PM view/edit/undo/IME) appended to `document.body`; it paints real pages into the visible mount.
- The WC bridge reads `editor.view`, which PresentationEditor does **not** expose → the bridge MUST
  bind to `presentation.editor` (the inner Editor, which has `.view`), never to the PE instance.
- Toggle: the renderer can't read `process.env` (contextIsolation), so `WC_LAYOUT` is read from a
  runtime `localStorage` override, else a build-time default baked by vite `define`
  (`WC_LAYOUT=paged npm run build`). Default `overlay`.

## Gaps observed at runtime → the full-B retarget surface (now grounded, not guessed)

These are the real, scoped pieces the spec/plan must cover. None block the standup.

1. **Status bar / page count** reads the *overlay's* `WC.PM.__pagination`, so it shows "Page 1 of 1"
   while PE actually has 12 pages → retarget the page-count UI to `presentation.getPages()`.
2. **WC bridge installs cleanly but the *commands* aren't wired to the painted pages.** Visible-DOM
   bridge behaviors (selection-coords, the 6 overlays) still target the wiped `#pm-editor` / overlay
   geometry → the bulk of full-B is retargeting `bridge/*.ts` + the 6 overlays (image-resize,
   ink-overlay, notes-area, track-chrome, comments-ui, header-footer) to the per-page DOM.
3. **Static import bloats the default bundle** (overlay build 8.5 → 10.9 MB) because
   `create-editor.ts` statically imports PresentationEditor → full-B should **dynamic-import** the
   paged path so the overlay bundle stays lean.
4. **Cross-mode model byte-identity was inconclusive** — the docx import assigns random ids, so the
   doc hash differs run-to-run at the same length. Used the **page-free model** invariant as the
   export-safety proof instead (it held through 1→12 pagination). A real export round-trip in paged
   mode is a stronger follow-up check.
5. **Caret: programmatic selection + overlay paint verified; synthetic-CLICK hit-test routing** (a
   real pointer click → layout-bridge `clickToPosition` → hidden editor) was not exhaustively
   exercised → a click-to-position probe is a focused follow-up.
6. **Fonts/geometry:** Aptos shows in the UI but layout uses Chromium/Canvas metrics (the
   irreducible "tuned-to-oracle, not GDI/DirectWrite-identical" ceiling). Acceptable + expected.

## Next step

Standup is done → write the **spec-driven plan** (brainstorming → writing-plans → update
`docs/LAYOUT_ENGINE.md`) grounded in items 1–6 above, then execute full-B as toggle-guarded,
COM-oracle-gated slices. The spike toggle + probe stay as the strangler-fig scaffold.
