# Contract — Pointer Click → Caret Routing (Milestone 2)

Defines who owns a pointer click per render mode, the `focus.ts` gate that enforces it, and the seam
migration. M2 changes only WC-owned `focus.ts`; the click pipeline itself is PE's (vendored, unedited).

## Ownership contract

| Mode | Painted/text click | Margin / below-text click | Gutter (outside the page) |
|------|--------------------|---------------------------|----------------------------|
| **overlay** | PM `.ProseMirror` (native contenteditable) | **focus.ts** margin handler → caret at nearest text / doc end | no-op |
| **paged** | **PE `EditorInputManager`** → `hitTest` → `TextSelection` into hidden editor → focus | **PE** native margin handling | no-op (focus.ts bailed; PE viewport listener doesn't fire) |

**Invariant:** exactly ONE handler resolves any given click. In paged mode that is always PE.

## The `focus.ts` gate (the M2 change)

In the margin-click handler (`src/renderer/bridge/focus.ts:60-96`), add near the top — after the existing
`button !== 0` / `target` / `WC.PM.active` / `#pm-editor` / `.ProseMirror` early-returns:

```ts
// Paged renderer owns ALL clicks (PresentationEditor.EditorInputManager handles painted-page,
// margin, and below-text clicks with correct per-page geometry). focus.ts's overlay margin
// heuristic would mis-fire on every painted-page click (the editable .ProseMirror is hidden
// off-screen) and clobber PE's selection. So bail entirely in paged mode.
if ((window as any).__WC_LAYOUT_MODE === 'paged') return
```

And migrate the remaining direct view call (`focus.ts:90`):

```ts
// was: const hit = view.posAtCoords({ left: x, top: y })
const hit = (window as any).WC?.PM?.coords?.clientToPos(x, y)
```

- The clamp logic (`:87-89`), the below-text → `Selection.atEnd` branch (`:81`), and `view.focus()` /
  `preventDefault()` (`:94-95`) are UNCHANGED — only the gate and the hit-test call.
- `clientToPos` returns `{ pos, inside } | null`; the existing `hit ? hit.pos : max` fallback already
  handles null, so the substitution is drop-in.

## Behavioral acceptance (Word fidelity)
- In-text click → caret at the clicked glyph.
- Side-margin click (beside text, within the content's vertical span) → caret at nearest text on that line.
- Below-last-paragraph click → caret at document end.
- Double-click → word selection; triple-click → paragraph selection; drag → range from press to release.

## Probe contract (the M2 acceptance check)
`scripts/paged-pointer-probe.js` (mode-aware; multi-page doc forced by inserting text):
1. **paged single-click**: for a known pos `P`, `rect = WC.PM.coords.posToClientRect(P)`; dispatch a real
   `pointerdown`+`pointerup` at `rect` center on the `.superdoc-page`; assert `editor.state.selection.from`
   is within tolerance of `P`; then dispatch a key/insert and assert text landed at `P`.
2. **paged boundary click**: click the last line of page N and the first line of page N+1; assert the caret
   lands on the expected line (not misplaced across the seam).
3. **paged double / triple / drag**: assert word / paragraph / extended-range selections (PE-native).
4. **overlay parity**: a margin-region click still places a caret via the (now adapter-routed) focus.ts path.
5. Gates unchanged: `test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4.

**Triage rule:** a deep PE-native pointer bug surfaced by 3 (fork territory) is flagged for a fix-vs-defer
decision; M2's own fix surface stays `focus.ts` + the probe.
