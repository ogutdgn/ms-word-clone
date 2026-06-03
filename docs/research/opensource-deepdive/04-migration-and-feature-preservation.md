# 04 — Migration & feature preservation

The two hard constraints — **UI stays Word-identical** and **no feature is lost** — make this a
**strangler-fig, model-first** migration: ProseMirror stands up *behind* the existing ribbon/chrome,
one feature area is flipped at a time, and every cut-over is gated by the existing 228+9 regression
suite. The dominant risk is **silent feature loss during DOM→PM import**, not the PM core itself.

## What is REUSED unchanged
- **`WC.RIBBON`** (10 tabs / 212 controls) + the command taxonomy — it stays the action vocabulary
  and the generator for any semantic action-tool API.
- **The dialog layer** (`dialogs.js` and per-feature dialogs).
- **The `.docx` IO seam** + the macOS Word AppleScript oracle (now used for gold/verification).
- **The probe harness** (`main.js` `executeJavaScript` + `--probe-out`, `capturePage`) — the
  proto act/observe channel.
- **The 228-test in-renderer suite + the 9-test `test_docx.js`** — extended into the parity gate
  and the verifier QA harness.

## What is REWRITTEN
- `editor.js` mutation funnels (`exec()` over `execCommand`, `insertNodeHTML`, the
  MutationObserver-snapshot history) → **PM transactions + Steps**, with PM's own history.
- Every `H[cmd]` handler → a TipTap/PM command (still bottoms out in `view.dispatch(tr)`).
- DOM-as-model reads (`getHTML`/`queryState`) → `state.doc` queries + a `serializeDocument()`.
- Side-channel singletons (`lastFontColor`, `WC.Ref.sources`, `WC.Layout.lineMode`, `WC.Mail`,
  `WC.Review.trackOn`) → folded into **resettable env-state** (today they leak across `setHTML`).

## Feature-by-feature map

| Feature area | Difficulty | Notes |
|---|---|---|
| **Char formatting** (bold/italic/underline/color/font/size/highlight/sub/sup) | **Easy** | PM marks; TipTap StarterKit + custom marks. Canonical, diffable (verifier win). |
| **Paragraph** (align/indent/spacing/styles) | **Easy–Med** | Paragraph node attrs; **named styles** need a styles model (attr + a style registry). |
| **Lists / numbering** | **Medium** | `prosemirror-schema-list` base + **custom Word-numbering layer**. *Decide:* nested-list nodes vs Word paragraph+`numId/ilvl`. Preserve `ml-decimal`/outline/`setListLevel`. |
| **Tables** | **Medium** | `prosemirror-tables` + Word cell attrs (shading/borders/valign/repeat-header) + styled `TableView`. |
| **Insert: images/shapes/links** | **Medium** | image = atom node; links = mark; shapes = atom node-view (borrow `preset-geometry` SVG). |
| **Find/Replace** | **Easy–Med** | over `doc` text + decorations for hits (cleaner than today's DOM `.find-hit`). |
| **Header/Footer** | **HARD** | **No PM native concept.** Needs a section model + separate header/footer docs (study SuperDoc's child-editor approach). |
| **Layout** (margins/columns/page setup/sections) | **HARD** | Section properties on a `section` node / `doc.attrs`; section breaks; column model. |
| **References: TOC / captions / citations / footnotes / bibliography** | **HARD** | **Fields** (TOC/PAGE/SEQ/cross-ref) need a field-node model + a numbering fixpoint that depends on layout; footnotes reserve page space. |
| **Review: track changes / comments** | **HARD** | Track changes = `insertion/deletion` marks + an `appendTransaction` plugin that blocks/records deletes (`@tiptap/pm/changeset` helps); comments = ranges as decorations + a comments store. |
| **Mail merge** | **Medium–Hard** | field/merge-field nodes + the recipient data model (today a `WC.Mail` singleton → env-state). |
| **Pagination / page sheets** | **HARDEST** | PM has **zero** pagination. Reimplement as a **model-driven plugin** (decorations/node-views) reproducing today's look; do it **LAST**; validate page breaks vs the Word oracle. Borrow SuperDoc's greedy layout algorithm + `word-layout`. |
| **`.docx` save / load** | **HARD** | save → custom `dolanmiu/docx` serializer; load → separate importer; per-construct round-trip tests. See [03](03-ooxml-save-and-load.md). |

**Highest-risk cluster:** pagination, headers/footers, sections, fields/TOC, track changes,
comments — each has **zero native PM support** and is **already implemented in our DOM today**, so
the risk is regression/loss, not greenfield.

## Sequencing (strangler-fig)
1. **Tooling:** `electron-vite` + TypeScript (forced by ESM PM/TipTap import); preserve the hardened
   main/preload posture; keep the ribbon/dialog DOM as-is.
2. **Schema + lossless import:** define the Word-compatible PM schema with `parseDOM/toDOM` for
   **every** existing feature; run a **shadow PM model** alongside the live DOM and diff — no UI
   change yet. *(This is where silent feature loss is caught.)*
3. **Flip the core:** make PM authoritative behind the ribbon; re-express `H[cmd]` as commands; wire
   the **logger** at `dispatchTransaction`.
4. **Verifier** (headless Node) + task/reward framework.
5. **Hard constructs** (sections, headers/footers, fields/TOC, track changes, comments) as custom
   nodes/plugins/decorations.
6. **Pagination** as a model-driven plugin; validate vs oracle.
7. **`.docx` save/load** swap; round-trip tests.
8. **(Optional) React chrome** — only after the model is stable; **never on the editing surface**
   (vanilla node-views only).

## Guardrails
- **Parity gate before every cut-over:** the 228+9 suite must stay green; add a feature-parity diff
  (shadow model vs DOM) per area.
- **`parseDOM/toDOM` coverage is the #1 deliverable** — incomplete coverage = silent feature loss.
- **No React/Vue on the editing surface** (coordinate/a11y stability for the CUA agent + perf).
- **Pagination last**, behind the Word oracle, because it's the highest-risk + most-visible feature.
