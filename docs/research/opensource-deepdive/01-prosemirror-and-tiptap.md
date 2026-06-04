# 01 — ProseMirror & TipTap

Source read locally: `opensource-solutions/prosemirror-{model,state,view,transform,tables,schema-list}`,
`opensource-solutions/tiptap`.

## ProseMirror core — the four packages

- **`prosemirror-model`** — immutable document tree + `Schema` + `Slice`/`Fragment` + JSON
  serialization, with **opt-in** DOM parse/serialize. `NodeSpec`/`MarkSpec` declare `content`
  (a content-expression string compiled to a DFA, e.g. `"paragraph block*"`, `"table_row+"`),
  `group`, `attrs` (default + validate), `marks`, `inline/atom/code/defining/isolating`, and
  `toDOM`/`parseDOM`. *Evidence:* `prosemirror-model/src/schema.ts`, `content.ts`.
- **`prosemirror-transform`** — every change is one or more **Steps**:
  `ReplaceStep`, `ReplaceAroundStep`, `AddMarkStep`, `RemoveMarkStep`, `AddNodeMarkStep`,
  `RemoveNodeMarkStep`, `AttrStep`, `DocAttrStep`. Each is **JSON-pure** (`Step.toJSON()` /
  `Step.fromJSON(schema, json)`, registered via `Step.jsonID`), **invertible** (`invert(doc)`),
  and **mappable** (`getMap()` → `StepMap [start,oldSize,newSize]`). *Evidence:*
  `prosemirror-transform/src/{step,replace_step,mark_step,attr_step,map}.ts`.
- **`prosemirror-state`** — `EditorState` (doc + selection + plugin fields) + `Transaction`
  (a Transform + selection/storedMarks/**meta**) + `Plugin`/`PluginKey`. `state.apply(tr)` is
  **pure** → new state. *Evidence:* `prosemirror-state/src/{state,transaction,plugin}.ts`.
- **`prosemirror-view`** — the contenteditable renderer; calls `props.dispatchTransaction(tr)`
  instead of self-applying. *Evidence:* `prosemirror-view/src/index.ts:510-514`.

### Why this is the perfect logger + verifier substrate
- **Single logger choke point:** supply `dispatchTransaction(tr)` and every user edit, command,
  paste, and IME commit funnels through it as a Transaction whose `.steps` are the operation
  stream. Log `tr.steps.map(s=>s.toJSON())`, `tr.getMeta(actorKey)`, `tr.selection`, then
  `view.updateState(state.apply(tr))`.
- **Headless verifier:** `prosemirror-model` + `-state` + `-transform` have **zero runtime DOM
  dependency** (confirmed: the only `window/document` use is inside the opt-in `from_dom.ts`/
  `to_dom.ts`; `dom.ts`'s `window.Node` is a *type-only*, TS-erased reference). So in Node:
  `EditorState.fromJSON({schema}, json)` → replay logged Steps → query `doc.nodesBetween` /
  `resolve` / `node.attrs` / mark presence → compute programmatic reward. Fully deterministic.
- **Determinism:** PM **normalizes** the doc (merges adjacent same-mark text, fixed mark order),
  so two semantically-equal docs serialize identically — fixing today's `<b>` vs `<strong>` vs
  `style` divergence. `doc.toJSON()` → RFC-8785 JCS → SHA-256 = a stable per-step hash.
- **Plugins/decorations:** `appendTransaction(trs, old, new)` reactively repairs invariants
  (re-paginate, fix list numbering). `Decoration.widget/inline/node` overlay presentation
  (pagination markers, comment highlights, spell squiggles) **without** touching the doc/Step log.

### A Word schema maps cleanly (for the easy 80%)
Nodes: `doc / section / paragraph / heading / table / table_row / table_cell / list_item /
image(atom) / page_break`. Marks: `strong / em / underline / strike / color / highlight /
font / size / super / sub` (+ `comment / insertion / deletion` for review). Content expressions
enforce structure (`table_row` contains `table_cell+`), required attrs are always supplied.

## Tables & lists, and the hard gap

- **`prosemirror-tables`** — adopt largely as-is: a correct, normalized, queryable model
  (`table/row/cell` nodes, `colwidth/colspan/rowspan`, `TableMap` geometry, cell selection).
  Word extras (shading, borders, vertical-align, cell margins, repeat-header) are added as extra
  `cellAttributes` + a Word-styled fork of `TableView`. *Evidence:* `prosemirror-tables/src`.
- **`prosemirror-schema-list`** — use as the **structural base** (wrap/split/lift/sink + nesting)
  but build a **custom Word-numbering layer** on top (a numbering-definition attr per level:
  format/start/restart/continue + decoration- or NodeView-painted ordinals) so our existing
  multilevel patterns (`ml-decimal`/outline/bullet, `setListLevel`) survive. *Decision point:*
  PM nested-list nodes vs **Word's paragraph+`numId`/`ilvl`** model (what OOXML and SuperDoc use).
- **The real cost — ZERO native PM support, each a custom build:** pagination/page sheets,
  sections, headers/footers, page/section breaks, **named styles**, fields/TOC/page-numbers,
  track changes, comments, footnotes. Our app implements all of these in the DOM today; in PM
  each becomes a custom node/mark, plugin, decoration, or NodeView. **Tables/lists are the easy
  20%; these page constructs are the dominant cost and risk.**

## TipTap — a convenience layer *on* ProseMirror (not an alternative)

- **`@tiptap/pm` is a transparent re-export of the real `prosemirror-*` packages**
  (`packages/pm/state/index.ts` = `export * from 'prosemirror-state'`, etc.). So Steps,
  Transaction, EditorState, Schema are the genuine PM classes — `step.toJSON()` /
  `Step.fromJSON` work unchanged. **MIT** (`tiptap/LICENSE.md`).
- **Raw access preserved:** `editor.state`, `editor.view`, `editor.schema`,
  `editor.registerPlugin`, and a `'transaction'` event whose payload is the raw PM Transaction
  with `.steps` (+ `appendedTransactions`). *Evidence:* `tiptap/packages/core/src/Editor.ts:355-361,
  307-350, 622-711`. → **logger and verifier needs are fully met.**
- **What it adds:** a declarative `Extension/Node/Mark` API (`addCommands`, `addInputRules`,
  `addPasteRules`, `addKeyboardShortcuts`, `addNodeView`, `addProseMirrorPlugins`, `parseHTML/
  renderHTML`), a chainable command system that still bottoms out in `view.dispatch(tr)`, and
  StarterKit (~20 extensions). This **accelerates re-implementing ordinary Word features**
  (bold/headings/lists/tables/links).
- **Use `@tiptap/core` + vanilla node-views only.** The infamous per-keystroke whole-tree
  re-render is **React-binding-specific** and now opt-in (`useEditor` `shouldRerenderOnTransaction`
  defaults to `false`, marked "legacy ... will be removed"). Avoid `@tiptap/react`/`vue`.
- **What TipTap does NOT solve (identical to bare PM):** the Word-identical chrome (hand-built),
  the hard Word constructs (pagination/sections/headers-footers/fields/track-changes — note
  `@tiptap/pm/changeset` helps DIY track-changes), and **DOCX round-trip** (Pro/Cloud paid; not in
  OSS — we keep our own `.docx` layer).

## Verdict
ProseMirror is a **strong fit** for logger + verifier + determinism; the cost and risk live
entirely in **schema/`parseDOM` coverage** (lossless import) and **re-creating Word's page
constructs**. **TipTap-core** is the recommended way to consume PM (same raw Steps, MIT, faster
authoring) — but it is a *core-editor rewrite behind the existing ribbon*, not a drop-in, and must
be gated on the spike (Step logging + pagination plugin + DOCX bridge) before committing.
