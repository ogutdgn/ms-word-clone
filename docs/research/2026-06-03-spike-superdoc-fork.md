# Spike results — fork SuperDoc's core (validates ADR-0003 / ADR-0005)

- **Date:** 2026-06-03
- **Verdict:** 🟢 **GREEN — proceed.** The three make-or-break unknowns are resolved
  positively. One low-risk confirmation (interactive contenteditable mount in a real browser)
  remains; rendering + state-loading are already proven.
- **Where:** run in a throwaway, gitignored `spike/` project (`superdoc@1.38.0` + `jsdom` on
  Node 25). Not part of the app.

## What was tested
The headless surface `import { Editor, getStarterExtensions } from 'superdoc/super-editor'`,
with `Editor.loadXmlData(buf)` (OOXML→PM) and `editor.exportDocx()` (PM→OOXML), against three
real fixtures (`basic-list`, `memorandum`, `comments-doc`).

## Results by question

### Q2 — can we use schema + converter WITHOUT mounting Vue?  🟢 YES
`superdoc/super-editor` imports and the `Editor` runs fully **headless with no Vue app
mounted** (JSDOM only). Vue is an installed dependency but is **not required at runtime** for
import/export/model access.

### Q3 — headless import + export + bounded closure?  🟢 YES
- **Import + export + re-import round-trip succeeded on all 3 docs**, structure-stable:
  - `basic-list`: 30 → 30 nodes; exported 13,929 bytes.
  - `memorandum`: 94 top-level paragraphs, **273 → 273 nodes**; exported 15,337 bytes.
  - `comments-doc`: 10 → 10 nodes; exported 10,675 bytes.
- Headless Editor build time ~50–80 ms per doc.
- **Dependency closure (full `superdoc` package):** `npm install` clean — **185 packages,
  148 MB, ~22 s** (includes vue/konva/pinia/jsdom we don't need at runtime). A converter-only
  fork would trim this; the full-package number is the upper bound.

### Q1 — renderable + editable in OUR OWN ProseMirror view?  🟢 STRONG (last mile pending)
- Schema is **56 nodes / 14 marks** (Word-complete) and **55/56 nodes define `toDOM`**.
- Rebuilt a **fresh, independent `EditorState` from (schema, docJSON)** — the doc loads into a
  standalone PM state we control (not their Editor).
- **`DOMSerializer` renders the imported Word doc to clean DOM** via the schema's `toDOM`,
  e.g. (list paragraphs carry Word-native numbering metadata — confirms ADR-0004):
  ```html
  <p data-sd-block-id="…" data-marker-type="-" data-list-level="[1]" data-list-numbering-type="bullet">
    <span><span data-run="1"><span style="font-family: Aptos…; font-size: 12pt;">List item 1</span></span></span>
  </p>
  <p … data-list-level="[2,1]" data-marker-type="◦" …>…Indentation 1…</p>
  <p … data-marker-type="1." data-list-numbering-type="decimal">…Numbered 1…</p>
  ```
  This is exactly what a plain PM `EditorView` puts in a contenteditable — we style it with our
  CSS to look like Word.
- **Remaining (low-risk):** mount an interactive `EditorView` in a real browser/Electron and
  type into it. Rendering + state-load are proven, so this is wiring, not a risk.

## Findings & edge cases discovered (feed into the fork plan)
1. **Telemetry is ON by default** (`[super-editor] Telemetry: enabled`). ⚠️ For an
   offline/deterministic RL env we must **disable/strip telemetry** in the fork (it also reads
   `localStorage` at import — see #3).
2. **Headless API is supported and cleaner in current versions:** `new Editor({ document })`
   (the `mockDocument`/`mockWindow` params are deprecated; "global window assignment no longer
   required"). Docs: `docs.superdoc.dev/guide/headless`.
3. **The bundle reads `localStorage`/`sessionStorage` at import time** → in Node we set
   browser-like globals (incl. a storage shim) **before** importing. In the Electron renderer
   these are native, so this is a Node-test-only shim.
4. **Editing *behaviors* live in their extensions** (`getStarterExtensions()` — ProseMirror
   commands/plugins/keymaps, **not** Vue). So "render in our own view" is proven; **full
   editing behavior** (list Tab/indent, input rules) means also taking their *extensions* (PM
   plugins) — which is the natural "fork super-editor core minus the Vue UI + DomPainter" path.
   This answers the **C2 "how much to fork"** sub-question: take **schema + converter +
   extensions (PM layer)**, drop the Vue UI + painter.
5. Import/export entry points are clean: `Editor.loadXmlData()`, `editor.exportDocx()`,
   `editor.schema`, `editor.state.doc`, `editor.getJSON()`.

## Conclusion
ADR-0003 and ADR-0005 are **validated**: we can fork SuperDoc's schema + converter (+ PM
extensions), run them headless without Vue, round-trip real `.docx`, and render the model in
our own ProseMirror view. Proceed to the migration plan (strangler-fig). Next concrete
follow-ups: (a) interactive `EditorView` mount in Electron to close Q1's last mile; (b) scope a
converter-only / extensions-only fork to trim the 148 MB closure and strip telemetry; (c) begin
per-construct round-trip tests vs the macOS Word oracle.
