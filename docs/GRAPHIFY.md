# Using graphify efficiently in ms-word-clone

This repo ships a prebuilt **graphify knowledge graph** of its own code + docs.
The point: answer "how does X work / what touches Y / trace the flow through Z"
questions by **querying the graph instead of reading dozens of files** — far fewer
tokens per research task.

The graph lives in [`graphify-out/`](../graphify-out/):

| File | Tracked? | What it is |
|------|----------|------------|
| `graph.json` | ✅ committed | the queryable graph — what `graphify query` reads |
| `GRAPH_REPORT.md` | ✅ committed | human-readable audit: communities, god nodes, hyperedges, gaps |
| `cost.json` | ✅ committed | cumulative token-cost tracker for builds |
| `graph.html` | ⛔ ignored | interactive viewer — regenerate with `graphify export html` |
| `cache/`, `.graphify_*` | ⛔ ignored | machine-local scratch (one hardcodes a local interpreter path) |

## Scope (read this before rebuilding)

The graph **deliberately excludes** the vendored editor engine
`src/renderer/core/superdoc-fork/` (~3,068 files — a fork of the open-source
SuperDoc/ProseMirror library). It covers only **our own code + docs: 186 files**
→ **1,234 nodes, 2,066 edges, 110 communities**.

Why: the fork is 94% of the file count and would bloat the graph + cost while
adding little about *our* integration. The fork's design intent is already
captured as concept nodes from `docs/decisions/0003-fork-superdoc-core.md`.

**Keep the fork excluded on every rebuild** unless you specifically need to trace
engine internals — and even then, add it AST-only (structural, free), never full
semantic extraction (its 72 icon SVGs would each burn a vision pass).

## The golden rule: query before you grep

For any architecture / "where does this connect" / cross-subsystem question, run
this **from inside the project root** (where `graphify-out/graph.json` lives):

```bash
cd ms-word-clone
graphify query "how does a ribbon button reach a ProseMirror transaction?"
graphify query "what reads the WC.RIBBON data model?" --budget 1500   # cap answer tokens
graphify query "trace the docx save pipeline" --dfs                    # follow one path
graphify path "WC.Ribbon" "Editor Engine (ProseMirror)"               # shortest link
graphify explain "repaginate()"                                        # plain-language node summary
```

Reach for the graph when the question spans files/subsystems. Open the actual
source when you need exact line-level truth — the graph is the **map**, not the
territory. Treat `INFERRED` edges as leads to verify, not facts.

## Keeping the graph fresh (cheaply)

After code changes, refresh incrementally — `--update` re-extracts **only new or
changed files**, so it's cheap:

```bash
cd ms-word-clone
graphify graphify-out/../  --update        # or: /graphify <path> --update via the skill
graphify export html                       # regenerate the local viewer if you want it
```

Full rebuilds cost real tokens (~660K input for the first build). Prefer
`--update`. Don't rebuild over the whole `new-coding/` workspace — that folder
holds ~22 unrelated projects and ~1.2M files; always scope to `ms-word-clone/`.

## Where this came from

Built with the `/graphify` skill (`~/.claude/skills/graphify/`). See
`GRAPH_REPORT.md` for the community map and the most interesting questions the
graph can answer.
