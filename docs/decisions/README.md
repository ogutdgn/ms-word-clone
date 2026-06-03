# Decision Log (Architecture Decision Records)

This folder is the **durable record of the architectural decisions** for turning the
ms-word-clone into a **computer-use-agent (CUA) reinforcement-learning / evaluation
environment**. It exists so any future session (AI or human) can pick up the *locked*
decisions and continue without re-litigating them.

Each decision is an **ADR** (Architecture Decision Record) with a fixed shape:
**Context → Decision → Options considered → Rationale → Edge cases & risks →
Consequences → Related.** ADRs are append-only: to change a locked decision, add a new
ADR that *supersedes* the old one (don't rewrite history).

> Research that backs these decisions lives in [`../research/`](../research/) (the
> open-source deep-dive + the RL/CUA architecture notes). The **target architecture** and
> **tech stack** live in [`../architecture/`](../architecture/).

## Status of decisions

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](0001-pivot-to-rl-cua-environment.md) | Repurpose the app into a CUA RL/eval environment (logger + verifier + MCP); merges into `cua-bench` | **Locked** |
| [0002](0002-prosemirror-document-model.md) | Introduce a ProseMirror authoritative document model (replace DOM-as-model) | **Locked** |
| [0003](0003-fork-superdoc-core.md) | Fork SuperDoc's schema + OOXML converter as the document core; own renderer/UI/instrumentation | **Locked — pending de-risking spike** |
| [0004](0004-lists-as-paragraph-numid.md) | Model lists as paragraph + `numId`/`ilvl` (Word-native) | **Locked** (satisfied by 0003) |
| [0005](0005-docx-via-superdoc-converter.md) | `.docx` import+export via SuperDoc's bidirectional converter (forked) | **Locked — pending spike** |
| — | RL env / logger / verifier / MCP / pagination / tooling / repo decisions | **Open → see [OPEN_DECISIONS.md](OPEN_DECISIONS.md)** |

## The two hard constraints (apply to every decision)
1. **UI fidelity:** the app must keep looking and behaving like **Microsoft Word** as
   closely as possible (ribbon, page sheets, dialogs, on-screen outcomes).
2. **Feature preservation:** no already-implemented feature may be lost in the migration.

## The de-risking spike (gates 0003 + 0005)
Before any production migration, one spike must prove three unknowns:
1. We can render+edit SuperDoc's PM document in **our own** ProseMirror `EditorView` (our
   CSS, our ribbon) — *not* their Vue painter.
2. We can instantiate the schema + converter **without** dragging in their Vue UI.
3. The dependency closure to run import+export **headless** is bounded, and round-tripping
   real `.docx` files is faithful (diffed against the macOS Word oracle).

If the spike is green → migrate. If not → fall back to a minimal bare-PM core with a
narrowed `.docx` import ambition (see ADR-0003 "Consequences").
