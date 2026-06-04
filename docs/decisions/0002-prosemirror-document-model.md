# ADR-0002 — Introduce a ProseMirror authoritative document model

- **Status:** Locked
- **Date:** 2026-06-03

## Context
Today the **DOM is the document** (`#editor` contenteditable + `document.execCommand`;
state read via `getHTML()`/`queryState()`). For a CUA environment (ADR-0001) this is
disqualifying: there is no structured, queryable, deterministic ground truth for the
**verifier**, no clean operation stream for the **logger**, no single authoritative state
for the two action modalities to converge on, and `execCommand` produces
browser-inconsistent markup that breaks reproducibility.

**Schema** (the term): the rulebook defining what a document is made of — the typed
in-memory structure. **Nodes** = structural blocks (paragraph, heading, table, row, cell,
image). **Marks** = text formatting (bold, italic, color, font, link). Plus the attributes
each carries (a paragraph's style/alignment/indent/`numId`) and the rules for how they
combine. The schema is the central contract the editor, converter, logger, and verifier all
speak.

## Decision
Adopt a **ProseMirror** authoritative document model. ProseMirror's four packages map 1:1
onto the environment's needs:

| PM package | Role for us |
|---|---|
| `prosemirror-model` (schema'd tree) | the verifier's ground truth |
| `prosemirror-state` (immutable EditorState) | `state.doc.toJSON()` = the serializable snapshot |
| `prosemirror-view` (renders to real DOM, captures input) | the CUA perception/action surface |
| `prosemirror-transform` (serializable, invertible **Steps**) | the logger's operation stream |

Concretely: every edit flows through **`dispatchTransaction`** (the single logger tap) as a
Transaction whose `.steps` are JSON-serializable + invertible; the model runs **headless**
in Node (`prosemirror-model/-state/-transform` have no runtime DOM dependency) for the
verifier; PM normalizes the document so two semantically-equal docs serialize identically
(fixing `<b>` vs `<strong>` divergence) → stable per-step hashing.

## Options considered
- **Bare ProseMirror** — direct, minimal, full control. (Initially preferred.)
- **TipTap** — *is* ProseMirror re-exported (MIT) + a convenience Extension API. Keeps raw
  Steps. Good ergonomics, but its main advantage (speed) was de-prioritized.
- **Lexical (Meta)** — the other professional option. *Rejected:* pre-1.0, memory blow-up on
  long documents, change-log coarser than PM Steps (worse for the logger).
- **Slate / CKEditor** — rejected (no enforced schema / paid cloud + GPL).
- **Stay DOM-as-model** — rejected (the whole reason for this ADR).

## Rationale
ProseMirror is the most mature, battle-tested implementation of the model/view/operations
architecture we need (used by NYT, Atlassian, GitLab, The Guardian). Its **Steps** are
uniquely suited to be our trajectory log, and its headless model is the verifier substrate.
SuperDoc (ADR-0003) is itself built on ProseMirror — so PM is the center of gravity.

## Edge cases & risks
- **Silent feature loss on DOM→PM import** — PM's strict schema drops anything not modeled;
  every existing feature needs `parseDOM/toDOM` coverage + a parity gate. (Largely mooted by
  ADR-0003, which adopts SuperDoc's already-complete Word schema.)
- **`appendTransaction` / plugin-generated Steps** — the *effective* transaction can differ
  from the input one; the logger must capture appended Steps too.
- **execCommand leniency vs PM strictness** — some lenient behaviors change; re-test.
- **No native pagination** — PM does not paginate; that is a separate build (OPEN_DECISIONS).

## Consequences
- The document model becomes the canonical asset the whole environment depends on.
- The bare-PM-vs-TipTap choice is downstream and was *superseded* by ADR-0003 (we adopt
  SuperDoc's PM schema, not a hand-built one).
- Build tooling must move to ESM (electron-vite + TypeScript).

## Related
- ADR-0003 (which PM schema/converter), ADR-0004 (lists), research:
  [`../research/opensource-deepdive/01-prosemirror-and-tiptap.md`](../research/opensource-deepdive/01-prosemirror-and-tiptap.md).
