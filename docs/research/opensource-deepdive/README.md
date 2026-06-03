# Open-Source Editor Deep-Dive — Index (2026-06-03)

> **Status: RESEARCH / DECIDING phase.** No app code changed. Produced on branch
> `research-architecture` for a joint architecture decision. The upstream repos were
> shallow-cloned into `opensource-solutions/` (gitignored — reference only, not committed)
> and read as **real source**; every claim below cites a file path in those clones.

We are deciding the authoritative-document-model foundation for turning the Electron
MS Word clone into a **computer-use-agent RL/eval environment** (logger + verifier),
under two hard constraints: **(1) the UI must keep looking exactly like Microsoft Word**,
and **(2) no already-implemented feature may be lost.**

## Documents
| # | Doc | What it covers |
|---|-----|----------------|
| 00 | [Overview & Recommendation](00-overview-and-recommendation.md) | The decision, the matrix, the phased plan, the constraint analysis |
| 01 | [ProseMirror & TipTap](01-prosemirror-and-tiptap.md) | The recommended model substrate; schema, Steps, headless, tables/lists, TipTap-core |
| 02 | [SuperDoc](02-superdoc.md) | Why we **don't adopt** it; what to mine from it (converter, layout engine, document-api) |
| 03 | [OOXML save & load](03-ooxml-save-and-load.md) | `dolanmiu/docx`, `prosemirror-docx`, the asymmetric import/export problem |
| 04 | [Migration & feature preservation](04-migration-and-feature-preservation.md) | Strangler-fig plan; feature-by-feature map; what's reused vs rewritten |
| 05 | [Edge cases & technical risks](05-edge-cases-and-technical-risks.md) | Consolidated technical edge cases that must gate the decision |

## Repos cloned (in `opensource-solutions/`)
`prosemirror-{model,state,view,transform,tables,schema-list}`, `tiptap`,
`SuperDoc` (Harbour/`superdoc-dev`), `prosemirror-docx` (curvenote), `docx` (dolanmiu).

## One-paragraph conclusion
ProseMirror's four packages map 1:1 onto our needs (Model = verifier ground truth, State =
serializable snapshot, View = CUA surface, Transform/Steps = the logger). **TipTap-core** is
the same real ProseMirror re-exported under MIT with a nicer authoring API and keeps 100% raw
Step access — so it's a convenience layer *on* PM, not an alternative. **SuperDoc** has the best
OOXML fidelity and a real Word layout engine, but it is **AGPL-3.0**, **imposes its own Vue
renderer/DomPainter** (conflicts with our Word-identical UI), and is **actively deprecating raw
ProseMirror Step access** (which our logger needs) — so we treat it as a *reference design and
oracle*, not a dependency. The dominant risk is not the PM core; it is **silently losing
execCommand features during the DOM→PM import** and **re-creating Word's page/section constructs**
that PM has zero native support for.
