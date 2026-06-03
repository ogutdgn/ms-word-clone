# ADR-0004 — Model lists as paragraph + `numId`/`ilvl` (Word-native)

- **Status:** Locked (satisfied by ADR-0003)
- **Date:** 2026-06-03

## Context
Lists/numbering can be modeled two ways in a rich-text schema, and the choice ripples into
`.docx` fidelity and the verifier.

## Decision
Model lists the **Word/OOXML-native** way: a list is **not** a nested node structure; instead
each **paragraph carries `numId`** (which numbering definition) and **`ilvl`** (which level,
0 = top), and the renderer computes the ordinals ("1.", "a.", "i.") from those. This is
exactly how a `.docx` stores lists, and how SuperDoc's schema (ADR-0003) already models them.

## Options considered
- **(A) Nested list nodes** (`prosemirror-schema-list`: `ordered_list > list_item`). The
  PM-native, easier-to-author option, with free indent/outdent commands. *Rejected* because it
  does not match Word's storage, so every `.docx` round-trip needs a nesting↔flat translation,
  and Word behaviors (numbering continuing across non-list paragraphs, level jumps, shared
  numbering definitions, restart/continue) are awkward to represent.
- **(B) Paragraph + `numId`/`ilvl`** (Word-native). **Chosen.**

## Rationale
Maximum Word fidelity + cleanest `.docx` round-trip (the tags serialize directly), and the
verifier grades against Word's *actual* structure. The current app already leans this way
(`ml-decimal`/outline classes + `setListLevel` ≈ "paragraph has a level"). Decided on
fidelity/correctness grounds, not effort.

## Edge cases & risks
- We write our own list commands (Tab = raise `ilvl`, toggle = set/clear `numId`, renumber =
  compute ordinals across the flow) — the standard PM list commands don't apply.
- Numbering **definitions** (`abstractNum`) are shared across the document with restart/continue
  semantics — must be modeled and round-tripped, not invented per-list.
- Mixed content (a numbered list interrupted by a normal paragraph, then continuing) must keep
  numbering — straightforward with `numId` continuation, hard with nesting.

## Consequences
- Satisfied automatically by adopting SuperDoc's schema (ADR-0003) — no extra schema work.
- The clone's existing multilevel patterns (`ml-decimal`/outline/`setListLevel`) map onto this
  model and are preserved.

## Related
- ADR-0003 (provides this model), research:
  [`../research/opensource-deepdive/01-prosemirror-and-tiptap.md`](../research/opensource-deepdive/01-prosemirror-and-tiptap.md).
