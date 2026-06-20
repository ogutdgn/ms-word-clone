# Contract — Milestone 4d (notes-area disable + header-footer test)

## Consumer: `src/renderer/bridge/notes-area.ts` (paged-gated on `window.__WC_LAYOUT_MODE === 'paged'`)

| Function | overlay (unchanged) | paged (new) |
|---|---|---|
| `renderInner()` (~165) | build/diff `#pm-notes-area` (footnotes + endnotes; clobber-guard + focus-continuity) | **early-return**: if a `#pm-notes-area` exists → `innerHTML=''` + `display:none`; `lastSig=''`; return. (Placed right after `let region = document.getElementById('pm-notes-area')`.) |
| `installNotesArea(ed)` (291) | define the `WC.NotesArea` facade + `ed.on('transaction', schedule)` + initial `schedule()` | define the `WC.NotesArea` facade (UNCHANGED — `refresh`/`render`/`showNotes` callable); **skip** `ed.on('transaction', schedule)` + the initial `schedule()` |

**Guarantee**: overlay takes NEITHER branch → byte-identical (the clobber-guard/focus-continuity at 200-263 untouched).
In paged the region never mounts/shows and no transaction listener thrashes the paged editor. Both footnotes AND
endnotes are disabled (one region).

## Consumer: `src/renderer/bridge/references.ts` — `refShowNotes()` (~283-292)
- **overlay (unchanged)**: route to `WC.NotesArea.showNotes()`.
- **paged (new)**: find the first PE-painted footnote element (a `.superdoc-page` footnote body / footnote-note DOM
  node — the probe pins the exact selector), `scrollIntoView({block:'nearest'})`, return `true`; if none painted,
  `return false` (documented inert). Do NOT enter a PE story-session.

## NOT changed: `src/renderer/bridge/header-footer.ts`
- The 4 verbs (`setHeaderText`/`setFooterText`/`getHeaderText`/`getFooterText`) are mode-agnostic (doc-model only,
  zero coords). M4d asserts them in paged via the probe — no edit.

## Probe contracts
- **`probe:notes`** (`scripts/paged-notes-probe.js`, mode-aware `{summary,results[]}`): **paged** — insert a footnote
  (`WC.PM.refInsertFootnote` or the available verb) → (a) PE PAINTED a per-page footnote body (disabled ≠ no-notes),
  (b) `#pm-notes-area` is absent OR `display:none`, (c) the transaction-driver re-render does NOT fire (no thrash),
  (d) endnotes also disabled, (e) `WC.NotesArea`/`refShowNotes` paged scroll returns true + scrolls. **overlay** —
  `#pm-notes-area` mounts + renders the editable region (parity).
- **`probe:headerfooter`** (`scripts/paged-headerfooter-probe.js`): **paged parity** — `newBlank`; no pre-existing
  `w:headerReference`; `setHeaderText('HdrProbe')`/`setFooterText('FtrProbe')`; `get*` round-trip; `exportDocxBytes` →
  `word/headerN.xml <w:hdr>` + `sectPr <w:headerReference r:id>` + rels relationship + REPLACE (`HdrTwo`, no stale
  `HdrProbe`). **interop** — programmatically open a PE header session (`HeaderFooterSessionManager`), set/get routes
  through the live editor + survives exit/commit. **overlay parity** — same round-trip.

## Behavioral guarantees
- Overlay byte-identical (notes-area gates paged-only; header-footer untouched).
- No fork edits; model page-free; the `WC.NotesArea` facade always defined.
