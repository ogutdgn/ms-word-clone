# 00 — Overview & Recommendation (2026-06-03)

## The decision in one line
> **Adopt a ProseMirror-authoritative document model (via `@tiptap/core`, which is real
> ProseMirror re-exported under MIT). Do NOT adopt SuperDoc — mine it as a reference. Use
> `dolanmiu/docx` for the `.docx` save path. Migrate strangler-fig, model-first, UI last.**

## Why a model at all (recap)
The CUA RL environment needs a **structured, serializable, queryable** document: the
**verifier** scores reward over it, the **logger** records the operation stream, both
the pixel and semantic action paths converge on it, and determinism requires
view = f(model). Today the DOM *is* the model (contenteditable + `execCommand`), which
cannot provide any of those. ProseMirror's four packages map 1:1:

| PM package | Our use |
|---|---|
| `prosemirror-model` (schema'd tree) | verifier ground truth |
| `prosemirror-state` (immutable EditorState) | `state.doc.toJSON()` = the snapshot |
| `prosemirror-view` (renders to real DOM, captures input) | the CUA perception/action surface |
| `prosemirror-transform` (serializable, invertible **Steps**) | the logger's operation stream |

## The candidates, scored

| | ProseMirror (bare) | **TipTap-core** | SuperDoc | dolanmiu/docx |
|---|---|---|---|---|
| License | MIT | **MIT** | **AGPL-3.0** ✗ | MIT |
| Raw serializable Steps (logger) | ✅ first-class | ✅ (re-exports real PM) | ⚠️ **@deprecated, slated for removal** | n/a |
| Headless queryable model (verifier) | ✅ (no DOM dep) | ✅ | ✅ (but AGPL) | n/a |
| Authoring ergonomics | low (raw API) | ✅ Extension API + StarterKit | high but framework-locked | n/a |
| Imposes its own UI/renderer | no | no | ✅ **Vue + DomPainter** ✗ | no |
| OOXML round-trip | ✗ (build it) | ✗ (Pro/cloud) | ✅ **best-in-class** | emit-only (no import) |
| Real Word pagination engine | ✗ | ✗ | ✅ (Canvas-measured) | n/a |
| Fit for our 2 hard constraints | good | **good** | **conflicts** | partial (save only) |

## Recommendation

1. **Model substrate: `@tiptap/core` + vanilla node-views.** It transparently re-exports
   the real `prosemirror-*` packages (`@tiptap/pm/state` = `export * from 'prosemirror-state'`),
   so we keep 100% raw Step access for the logger and a headless queryable doc for the
   verifier, while gaining a declarative `Extension/Node/Mark` API + StarterKit + input/paste
   rules that materially speed up re-implementing bold/headings/lists/tables/links. **Avoid
   `@tiptap/react` / `@tiptap/vue`** (the per-keystroke re-render caveat + framework bloat).
   *Bare PM is the fallback if we want zero abstraction; either way it's "ProseMirror we own."*

2. **Do NOT adopt SuperDoc.** Two independent blockers: **(a) AGPL-3.0** (bundling it in a
   distributed Electron app — and a hosted RL/eval harness, which the network clause covers —
   forces source disclosure or a paid commercial license); **(b) it replaces the renderer** —
   PM is hidden and a Vue-mounted `DomPainter` paints the page, which collides with our
   Word-identical contenteditable UI. It is also **deprecating raw `editor.state/.view/.schema/
   .dispatch`** ("will be removed in a future version"), i.e. the exact surface our logger needs.
   **Mine it instead** (all permissible as reading reference): its `super-converter` OOXML
   handling, its `layout-engine` deterministic pagination algorithm + data contracts, its
   `document-api` contract (a great blueprint for our verifier's query surface), and the **pure,
   genuinely reusable `word-layout`** (numbering, tab stops, twips/px/pt conversions).

3. **Save path: a custom `DocxSerializer` over `dolanmiu/docx`** (MIT, runs in Node+browser via
   JSZip which we already ship; first-class classes for sections, headers/footers, styles,
   numbering, tables, images, page breaks, fields/TOC, comments, **track changes**). Use
   `prosemirror-docx` (MIT, write-only) as a fork-able skeleton for the PM-walk.

4. **Load path: keep an importer separately** (mammoth today, or reimplement an OOXML→model
   importer later). Neither MIT lib can import `.docx`. → **asymmetric pipeline → per-construct
   round-trip tests are mandatory.** (SuperDoc's bidirectional converter is genuinely better
   here, but license/coupling rule it out.)

5. **Pagination = a PM plugin (decorations/node-views) over the single flow**, model-driven,
   built **last**, validated against the macOS Word AppleScript oracle. PM has *zero* native
   pagination; SuperDoc proves a deterministic greedy layout pass works and we can borrow the
   algorithm, but its Canvas-metric approach has a font-fidelity ceiling vs real Word.

6. **Tooling: adopt `electron-vite` + TypeScript** for the renderer (forced the moment we import
   PM/TipTap ESM). Preserve the hardened main/preload posture.

## How the hard constraints are honored
- **"Looks exactly like Word"** → we keep our own ribbon/dialogs/page-sheet chrome; PM/TipTap are
  *headless* and impose no UI. The page interior becomes a model-driven decoration layer that
  reproduces today's look. (This is also why SuperDoc is rejected — it would *replace* that chrome.)
- **"Don't lose features"** → strangler-fig: PM stands up *behind* the existing ribbon; we flip one
  feature area at a time, gated by the existing 228+9 regression suite. The #1 risk is **silent
  feature loss during DOM→PM import**, mitigated by writing `parseDOM/toDOM` for *every* existing
  feature and asserting parity before each cut-over.

## Phased plan (model-first, strangler-fig)
0. **Spike (de-risk):** stand up `electron-vite`+TS; prove (a) Step-level logging via
   `dispatchTransaction`, (b) headless verifier replaying Steps in Node, (c) a pagination plugin
   reproducing one page sheet, (d) `dolanmiu/docx` emit of one section + header/footer + a tracked
   change + a comment. Diff page breaks vs the Word oracle. **These four spikes gate everything.**
1. **Word-compatible PM schema** with lossless `parseDOM/toDOM` for all current features + a
   `serializeDocument()`; run a **shadow model** alongside the DOM (no UI change yet).
2. **Flip the editing core** to PM transactions behind the existing ribbon; re-express `H[cmd]`
   handlers as commands. Wire the **logger** at `dispatchTransaction`.
3. **Build the verifier** (headless, Node) + the task/reward framework.
4. **Hard Word constructs** as custom nodes/plugins: sections, headers/footers, fields/TOC,
   track changes (marks + appendTransaction), comments (decorations).
5. **Pagination** reimplemented as a model-driven plugin; validate vs oracle.
6. **`.docx` save→`dolanmiu/docx`**, load via importer; per-construct round-trip tests.
7. **(Optional) React chrome** migration — only after the model is stable; never on the editing surface.

## What is REUSED unchanged
`WC.RIBBON` config + the 212-command taxonomy, the command-dispatch concept, the dialog layer,
the `.docx` IO seam, the probe harness (`--probe-out`/`executeJavaScript`), the 228+9 test suite,
and the macOS Word oracle (for gold/verification). The cost lives in the **editor core rewrite**
and the **hard page constructs**, not in the ribbon.
