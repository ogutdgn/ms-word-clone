# Phase 1 Data Model — Milestone 4a (overlay helpers + comments + track-chrome)

M4a is overlay-positioning; entities are coordinate value-types + the relayout event. No storage, no
document-model change (positions are derived; model stays page-free).

## Value types

### `OverlayLocalRect`
A position rect in **#pages-local** space (page-relative, zoom-divided) — what the overlays position against.
| field | type | notes |
|-------|------|-------|
| `top` / `bottom` / `left` | `number` | #pages-local px (viewport rect minus #pages.rect, divided by #pages scale). |

### `OverlayLocalY`
Just the local `top` (comments only need Y). `number | null`.

## Adapter methods (NEW on `WC.PM.coords`)
| method | signature | mode behavior |
|--------|-----------|---------------|
| `posToOverlayLocalRect` | `(pos:number) => {top,bottom,left} \| null` | `posToClientRect(clamp(pos))` → `(rect − #pages.rect)/scale`; null if rect null OR `top===0&&bottom===0` (hidden-run guard, verbatim from track-chrome). |
| `posToOverlayLocalY` | `(pos:number) => number \| null` | `posToClientRect(clamp(pos)).top` → `(top − #pages.rect.top)/scale`; null if rect null. |

- `scale = #pages.rect.width / #pages.offsetWidth` (or 1). `clamp(pos)` = `max(1, min(pos, doc.content.size))`.
- **Mode-agnostic:** the only mode difference is `posToClientRect` (view vs painted, handled by M1). Overlay
  output is byte-identical to the legacy `localY`/`localRect`.

## Entity — `PagedRelayoutEvent`
A `window` event `wc:paged-relayout` dispatched by the bridge's `presentation.onLayoutUpdated` handler (paged
only). Consumers (comments-ui, track-chrome; later image-resize/ink) listen and call their `schedule()`.

## Validation rules / invariants
- **Per-page visibility:** annotation on a non-painted page → helper returns null → overlay skips it (renders
  when the page paints). Documented, intentional.
- **Overlay byte-identical:** for a painted/visible pos, helper output == legacy formula output (gate-verified).
- **Page-free model:** anchors are model positions (comment marks, change ranges); no page data stored.
- **Coordinate commensurability:** comments + track both use the same #pages-local space, so track's
  balloon-vs-card collision detection stays correct.

## State / lifecycle
- Helpers read live each call (no state). The `wc:paged-relayout` listeners are added once per overlay install
  (idempotent; survive `replaceEditor` since install* re-runs). The onLayoutUpdated subscription is the M3
  idempotent one, extended by one event dispatch.
