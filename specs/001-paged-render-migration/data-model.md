# Phase 1 Data Model — Milestone 2 (pointer click hit-test routing)

M2 is an interaction-routing fix; its "entities" are the pointer interaction and the routing decision. No
persistent storage, no document-model change (model stays page-free).

## Entities

### `PointerInteraction` (conceptual)
A user pointer gesture on a painted page and its expected caret/selection outcome.
| field | type | notes |
|-------|------|-------|
| `kind` | `'single' \| 'double' \| 'triple' \| 'drag'` | gesture type (all PE-native). |
| `clientPoint` | `{ x: number; y: number }` | viewport coords of the press. |
| `expectedOutcome` | selection | single → caret at hit pos; double → word range; triple → paragraph range; drag → range from down→up. |

### `RoutingDecision` (the focus.ts gate)
Which handler owns a given click, per mode.
| mode | owner | focus.ts margin handler |
|------|-------|-------------------------|
| `overlay` | overlay PM view (`.ProseMirror`) for text; **focus.ts** for margins/below-text | RUNS (hit-test via `WC.PM.coords.clientToPos`) |
| `paged` | **PresentationEditor.EditorInputManager** (all clicks, incl. margins) | **BAILS** (`__WC_LAYOUT_MODE==='paged'` → return) |

### `SelectionOutcome`
The observable result asserted by the probe.
| field | type | notes |
|-------|------|-------|
| `from` / `to` | `number` | model positions of the resulting selection. |
| `focused` | boolean | the (hidden, in paged) editable view holds DOM focus → typing follows. |

## Validation rules / invariants
- **Single owner per click**: in paged mode exactly ONE handler (PE) places the selection; focus.ts must not
  also dispatch (the conflict). Probe asserts the caret matches PE's hit-test, not a hidden-view artifact.
- **Overlay unchanged**: the focus.ts gate is false in overlay; the `clientToPos` swap is behavior-identical.
- **Page-free model**: clicking/selecting never introduces page nodes (selection is over the page-free doc).
- **Word semantics** (behavioral acceptance): in-text click → that glyph; side-margin click → nearest text
  on the line; below-last-paragraph click → document end.

## State / lifecycle
- The focus.ts gate is evaluated per-click from the live `__WC_LAYOUT_MODE` (set once at boot in `main.ts`).
- No new mutable state introduced by M2.
