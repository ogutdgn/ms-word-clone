# Target Architecture — CUA RL environment

> The **target** architecture after the migration decided in
> [`../decisions/`](../decisions/) (ADR-0001…0005). This is *not yet built* — the current
> app is still the vanilla-JS DOM-as-model clone (see top-level `AGENTS.md`). Locked pending
> the de-risking spike (see decisions/README.md).

## One-line summary
Fork SuperDoc's **document core** (ProseMirror schema + OOXML converter); render it in **our
own** ProseMirror view with **our Word UI**; instrument it with **our** logger, verifier, and
MCP server; ship it in Electron.

## Layered diagram

```
┌──────────────────────────────────────────────────────────────┐
│  ELECTRON SHELL (main + preload)  ── OURS                     │
│  fs · .docx IO (forked converter) · screenshots (capturePage) │
│  · input injection (sendInputEvent) · MCP server host         │
└───────────────▲──────────────────────────────────────────────┘
                │ IPC / contextBridge
┌───────────────┴──────────────────────────────────────────────┐
│  RENDERER  (electron-vite + TypeScript)                       │
│                                                              │
│  ┌─ Word UI chrome ── OURS ────────────────────────────────┐ │
│  │  ribbon (WC.RIBBON · 212 controls) · dialogs · status   │ │
│  │  bar · page-sheet chrome                                │ │
│  └───────────────▲─────────────────────────────────────────┘ │
│                  │ commands → ProseMirror transactions        │
│  ┌─ Editing surface ── OUR ProseMirror EditorView ─────────┐ │
│  │  renders the model via SuperDoc nodes' renderDOM + OUR  │ │
│  │  CSS · OUR model-driven pagination plugin (page sheets) │ │
│  └───────────────▲─────────────────────────────────────────┘ │
│                  │ dispatchTransaction  (single logger tap)   │
│  ┌─ Document CORE ── FORKED from SuperDoc super-editor ────┐ │
│  │  • PM schema (Word-complete: paragraph+numId, runs,     │ │
│  │    marks, tables, sections, headers/footers, fields,    │ │
│  │    track-changes, comments)                             │ │
│  │  • super-converter:  OOXML  ⇄  PM   (bidirectional)     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ RL instrumentation ── OURS ────────────────────────────┐ │
│  │  Logger (taps dispatchTransaction → raw Steps)          │ │
│  │  Verifier client / observation builder                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

  TAKEN from SuperDoc (forked, vendored, pinned, owned):
      its PM schema  +  its OOXML converter
  NOT taken:  its Vue toolbar/UI · its DomPainter renderer ·
      its layout-engine (optional future borrow) · any live dependency
```

## Components

- **Document core (forked).** SuperDoc's ProseMirror **schema** (the Word-complete node/mark
  vocabulary) + its **`super-converter`** (OOXML⇄PM). Vendored, pinned, owned; extended by us
  (with matching converter handlers for anything that touches `.docx`). See ADR-0003/0005.
- **Editing surface (ours).** A plain ProseMirror **`EditorView`** we construct, rendering the
  model via the schema's `renderDOM` + **our CSS**, with **our** model-driven pagination plugin
  (decorations). This is the CUA agent's perception/action surface (real, accessible DOM).
- **Word UI chrome (ours).** The existing `WC.RIBBON` (212 controls), dialogs, status bar, and
  page-sheet chrome — unchanged ownership. Ribbon controls dispatch commands that produce PM
  transactions. *This is how the "looks exactly like Word" constraint is met.*
- **RL instrumentation (ours).** Logger (taps `dispatchTransaction`), verifier (headless query
  of the PM doc / OOXML), MCP server (Electron main).
- **Electron shell (ours).** Main process owns fs + the forked `.docx` converter + screenshots
  (`capturePage`) + pixel input (`sendInputEvent`) + the MCP host; preload bridge keeps the
  hardened posture.

## Key data flows

**Editing (and logging):**
```
agent action ──(pixel: click/type via sendInputEvent)──► our EditorView
            └─(semantic: ribbon/MCP tool)──► command ──► PM transaction
   both → dispatchTransaction(tr) ──► state.apply(tr) (new model)
                                  └─► Logger: tr.steps.toJSON() + obs + doc hash
```
Both action modalities converge on **one** model → the verifier is action-agnostic.

**Verifying (reward):** headless in Node — load `state.doc.toJSON()` (and/or the saved
`.docx` via the forked converter) → run predicate checks against the task's gold → reward.
Computed **server-side**; ground truth never enters the agent's observation.

**Environment exposure:** MCP server (Electron main) exposes `reset`/`step`/observe/reward +
low-level pixel tools + high-level semantic tools; a thin RPC/CDP path carries the pixel
hot-loop where MCP's shape is awkward.

## What this preserves vs the current app
- **UI fidelity** — our own view + CSS + ribbon (no imposed renderer).
- **Features** — migrated strangler-fig behind the existing ribbon, gated by the 228+9 suite.
- **Determinism / verifiability** — gained: a structured, serializable, hashable model.

## Open pieces
Pagination engine choice, agent-drive transport, logger contract, verifier language, MCP
details, determinism mode, task framework, parallelism, repo/merge — see
[`../decisions/OPEN_DECISIONS.md`](../decisions/OPEN_DECISIONS.md).
