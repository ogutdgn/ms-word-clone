# Target Tech Stack — CUA RL environment

> The **target** stack after the migration (see [`../decisions/`](../decisions/)). The
> migration is now **EXECUTED** — slice 11 retired the legacy world, so this target is the
> shipped stack; [`../TECH_STACK.md`](../TECH_STACK.md) documents it as built.
> "Locked" = decided in an ADR; "Candidate" = recommended in OPEN_DECISIONS, not yet locked.

## Locked

| Layer | Choice | Source |
|-------|--------|--------|
| Desktop shell | **Electron** | ADR-0001/0002 (good for screenshots + input injection + MCP host) |
| Document model | **ProseMirror** (`prosemirror-model/-state/-view/-transform`) | ADR-0002 |
| Schema + `.docx` converter | **Forked SuperDoc** `super-editor` core (schema + `super-converter`) | ADR-0003, ADR-0005 |
| Lists | paragraph + `numId`/`ilvl` (Word-native; from SuperDoc schema) | ADR-0004 |

## Candidate (recommended, not yet locked — see OPEN_DECISIONS)

| Layer | Recommendation | Notes |
|-------|----------------|-------|
| Build tooling | **electron-vite** + **TypeScript** | forced by ESM imports; replaces the no-bundler setup |
| Renderer view | our own PM `EditorView` + our CSS | not SuperDoc's Vue `DomPainter` |
| Pagination | our model-driven plugin **or** borrow SuperDoc `layout-engine` | OPEN C1 |
| `.docx` export fallback | `dolanmiu/docx` (MIT) | only if forced back to a bare-PM core |
| Logger format | cua-bench three-stream (`raw`/`semantic`/`outcome`) JSONL | + OTel-GenAI / RLDS export views |
| MCP | `@modelcontextprotocol/sdk@^1.29` (TS), in Electron main | stdio + Streamable-HTTP |
| Verifier | Python (cua-bench `Task/Rubric/Check`) reading the JSON log | + optional `python-docx` sidecar |
| Determinism | `seedrandom`, `@sinonjs/fake-timers`, bundled fonts, `force-device-scale-factor=1`, version pins | OPEN H2 |
| Agent transport | MCP-sidecar + thin RPC/CDP for the pixel hot-loop | OPEN D1 |

## Retired (EXECUTED in slice 11)
- **DOM-as-model** (`#editor` contenteditable + `document.execCommand`) → ProseMirror model. ✅ removed.
- **mammoth** + **html-to-docx** (lossy HTML round-trip) → forked SuperDoc `super-converter`. ✅ removed.
- **No-bundler ordered `<script>` tags** for the editor core → electron-vite + ESM/TS modules. ✅ done.
  *(The shared `WC` chrome still uses classic `<script>` tags; its WC→TS/ESM migration is the one
  remaining piece of this line item — deferred to a future slice.)*

## Reference-only (read, do NOT depend on)
Cloned under `opensource-solutions/` (gitignored): `prosemirror-*`, `tiptap`, `SuperDoc`
(source of the fork), `prosemirror-docx`, `docx` (dolanmiu). SuperDoc's `layout-engine` /
`word-layout` / `document-api` are studied as reference designs.

## Hard external dependency we already ship
`jszip` (used by both the SuperDoc converter and `dolanmiu/docx`).

## Notes / risks
- **Fonts:** bundle exact faces for deterministic wrapping/pagination; Aptos/Calibri are
  Microsoft-licensed — confirm redistribution or use metric-compatible substitutes (which shift
  shaping slightly vs real Word).
- **Vue:** `vue` is a hard dependency of SuperDoc's `super-editor` — the spike must confirm we
  can use schema+converter without mounting their Vue UI (ADR-0003 risk #2).
