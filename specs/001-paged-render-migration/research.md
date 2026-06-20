# Phase 0 Research — Milestone 4a (overlay retarget: helpers + comments + track-chrome)

From a read-only map of all 6 overlays (full map kept for M4b–M4d). File:line references are exact.

## The 6-overlay map (M4 overview; M4a = the first two)

| Overlay | M4 sub-slice | Action | PE-native? |
|---------|--------------|--------|------------|
| **comments-ui** (`bridge/comments-ui.ts`) | **M4a** | retarget `localY` → `posToOverlayLocalY` | PE decorates text only; bridge owns glyphs/cards |
| **track-chrome** (`bridge/track-chrome.ts`) | **M4a** | retarget `localRect` → `posToOverlayLocalRect` | PE decorates; bridge owns bars/balloons |
| **image-resize** (`imageresize/image-resize.ts`) | M4b | retarget `boxFor` → `nodeBoxFor`, or DISABLE if PE's `ImageInteractionLayer` draws handles (verify) | unclear |
| **ink-overlay** (`bridge/ink-overlay.ts`) | M4c | retarget `localPt` → `clientToOverlayLocalPt` + SVG must track the visible page | No (hardest) |
| **notes-area** (`bridge/notes-area.ts`) | M4d | DISABLE in paged (PE owns footnotes via `semantic-flow-footnotes.ts`/`FootnotesBuilder.ts`) | Yes |
| **header-footer** (`bridge/header-footer.ts`) | M4d | NO retarget — pure API module, zero coordinates; integration-test vs PE `HeaderFooterSessionManager` | Yes |

## Decision 1 — The two M4a helpers (mode-agnostic; overlay byte-identical)

- Both consumers compute the SAME thing today — *#pages-local* coords from `view.coordsAtPos`:
  - `comments-ui.localY` (comments-ui.ts:125-136): `(view.coordsAtPos(clamp(pos)).top − #pages.rect.top) / (#pages.rect.width/offsetWidth)`.
  - `track-chrome.localRect` (track-chrome.ts:91-106): same, returning `{top,bottom,left}`, with a `clamp(pos)`, a `c.top===0&&c.bottom===0 → null` hidden-run guard, and `left` measured from `#pages.rect.left`.
- **Decision:** the helpers replicate those formulas VERBATIM, swapping ONLY `view.coordsAtPos` → the M1
  `posToClientRect` (painted-aware in paged; **identical** in overlay). The `#pages` container math is unchanged.
- **Why this is overlay-safe + resolves the zoom baseline:** the overlay (`#wc-comments-overlay` /
  `#wc-track-chrome`) is a child of `#pages`, so the only transform between *#pages-local* and viewport is
  `#pages`'s own scale — captured by `rect.width/offsetWidth` in BOTH modes (paged may keep `#pages` scale=1
  with PE owning zoom; the ratio is then 1 and the formula still holds). No need to know "the zoom baseline".
- **Alternative considered:** reach into PE's `CoordinateTransform`/`convertPageLocalToOverlayCoords` —
  rejected; the consumers already work off `#pages`-local space, and `posToClientRect` already encapsulates
  the view-vs-painted difference (M1), so the minimal swap keeps overlay byte-identical and paged correct.

## Decision 2 — Per-page visibility contract

- If `pos` is on a non-painted (virtualized) page in paged mode, `posToClientRect` returns null → the helper
  returns null → the overlay does NOT render that annotation until its page paints (it appears on scroll).
  Matches virtualization; documented in the contract.

## Decision 3 — Paged relayout trigger (the no-transaction gap, as in M3)

- comments-ui/track-chrome `schedule()` today on `transaction` / `selectionUpdate` / `commentsUpdate` /
  `comment-positions`. In paged mode PE re-paginates without a transaction (zoom/reflow) → stale positions.
- **Decision:** extend the M3 `presentation.onLayoutUpdated` handler (bridge/index.ts) to ALSO
  `window.dispatchEvent(new Event('wc:paged-relayout'))` (M3's `StatusBar.update()` stays). comments-ui +
  track-chrome add a `wc:paged-relayout` listener → `schedule()`. Extensible: M4b/M4c overlays listen too.

## Decision 4 — Consumer retarget shape (minimal diff)

- Keep the `localY`/`localRect` function names; make them thin delegators:
  `localY = (pos) => WC.PM.coords.posToOverlayLocalY(pos)`, `localRect = (pos) => WC.PM.coords.posToOverlayLocalRect(pos)`.
  All existing call sites + the balloon/card stacking + the comment-vs-balloon collision-detection are
  unchanged; they now read painted-page-correct values in paged mode and identical values in overlay.

## Coupling note (why these two together)
track-chrome balloon stacking collision-detects against comment cards (reads `#wc-comments-overlay .wc-cc-card`
y-intervals, track-chrome.ts:176-206). Retargeting BOTH in M4a keeps their coordinate spaces commensurate.

## Open questions
None blocking for M4a. Deferred to their sub-slices: image-resize "does PE draw handles?" (M4b);
ink SVG page-tracking primitive (M4c); notes-area disable confirmation (M4d).
