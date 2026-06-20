# Data Model — Milestone 4d (notes-area disable + header-footer test)

M4d adds NO document-model entities. It changes one overlay's mode behavior + adds tests.

## NotesAreaState (the `#pm-notes-area` overlay, per mode)
- **overlay (unchanged)**: an editable footnote/endnote region (`#pm-notes-area`) flowed below the page sheet; the
  transaction driver (`ed.on('transaction', schedule)`) re-renders it; the clobber-guard + focus-continuity paths
  (`notes-area.ts:200-263`) preserve in-progress edits.
- **paged (new)**: DISABLED. `renderInner()` early-returns (hides + tears down the region; `lastSig=''`); the
  transaction driver is NOT installed. The `WC.NotesArea` facade (`refresh`/`render`/`showNotes`) stays DEFINED as
  guarded no-ops (no caller throws). Footnote/endnote bodies are owned by PE (per-page, editable inline).

## ShowNotesTarget (`refShowNotes` behavior, per mode)
- **overlay (unchanged)**: `WC.NotesArea.showNotes()` → reveal + scroll the `#pm-notes-area` region + focus the first
  note body.
- **paged (new)**: scroll the first **painted** footnote element into view (`scrollIntoView({block:'nearest'})`);
  return `true` if one was found+scrolled, `false` (documented inert) if none is painted. No edit-session entry.

## HeaderFooterSlot (unchanged — the 4 verbs the probe asserts)
- `setHeaderText(text)` / `setFooterText(text)` — `resolveHeaderFooterSlotRuntime` → `selectAll`+`insertContent`+
  `runtime.commit(editor)` on the headless story editor (or the live PE session editor when one is open).
- `getHeaderText()` / `getFooterText()` — `doc.textBetween` over the slot.
- **Mode-agnostic**: reads `editor.converter`/`editor.doc` fresh; binds to `presentation.editor` in paged. Export:
  `word/headerN.xml <w:hdr>` + `sectPr <w:headerReference r:id>` + the document.xml.rels relationship.
- **Live-session coexistence**: an open PE `HeaderFooterSessionManager` session registers a live runtime;
  `resolveStoryRuntime` prefers it, so a bridge set/get routes into the SAME live editor.

## State transitions
- Notes-area: `idle → (overlay) render-on-transaction` | `(paged) disabled no-op`. No model transition.
- Header/footer: `setSlotText → runtime.commit → markDirty → export`. Unchanged by M4d (test only).
