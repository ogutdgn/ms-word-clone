# Open Decisions — remaining agenda

The foundational decisions (ADR-0001…0005) are locked. These remain. Each has a researched
**recommendation** (see [`../research/`](../research/)) but is **not yet locked** — it needs
the user's confirmation in a future session. Promote a decision to a numbered ADR when locked.

Legend: ⭐ = my recommendation · ⚠️ = key edge case/risk.

---

## A. The de-risking spike (do this FIRST — gates ADR-0003/0005)
Stand up `electron-vite`+TS; vendor SuperDoc's schema+converter; then prove:
1. mount their PM doc in **our own** `EditorView` (our CSS) and **type into it**;
2. instantiate schema+converter **without** their Vue UI;
3. bounded headless dependency-closure for import+export; round-trip 5–10 real `.docx` and
   diff vs the macOS Word oracle.
**Outcome gates everything.** Green → migrate. Red → fall back to minimal bare-PM + narrowed
import (ADR-0003 fallback). **Status: ✅ RUN GREEN (2026-06-03)** — headless import/export
round-trips real `.docx` with no Vue mount; model renders to clean DOM + loads into a fresh
`EditorState`; closure 185 pkg / 148 MB. See
[spike results](../research/2026-06-03-spike-superdoc-fork.md). Remaining last mile:
interactive `EditorView` mount in a real browser. `electron-vite`+TS scaffolding was NOT part
of this spike (run via a standalone Node project) — still to do for the real migration.

## B. Build tooling & shell
- **B1 — Bundler + language.** ⭐ `electron-vite` + **TypeScript** (forced the moment we import
  ESM PM/SuperDoc; TS de-risks logger/verifier types). Preserve the hardened main/preload
  posture. ⚠️ leaving the no-bundler convention touches load order, preload, and the test
  harness — do it before any feature port. **Status: open (near-certain).**
- **B2 — Keep Electron as the shell.** ⭐ Yes (good for `capturePage` screenshots +
  `sendInputEvent` input injection + main-process MCP host). ⚠️ per-instance cost for parallel
  RL rollouts (see F2). **Status: open (near-certain).**

## C. Rendering & pagination
- **C1 — Pagination engine.** Options: (a) ⭐ **our own model-driven decoration/plugin**
  reproducing today's page sheets (own it, do it LAST, validate vs oracle); (b) **borrow
  SuperDoc's `layout-engine`** (now in the fork — real Word pagination, but Canvas-measured +
  heavier `private` packages). ⚠️ pagination determinism hinges on **font metrics** (pin fonts;
  Canvas metrics ≠ Word's embedded-font metrics → glyph-level page breaks won't be byte-identical
  to real Word). **Status: open — reconsider (a) vs (b) given the fork.**
- **C2 — How much of SuperDoc to fork.** ✅ **Resolved by the spike:** fork **schema +
  converter + their ProseMirror extensions** (the editing-behavior layer — commands/plugins/
  keymaps, not Vue), drop the Vue UI + `DomPainter`, strip telemetry. **Status: decided.**

## D. How the agent drives the environment
- **D1 — Action transport.** Options: **Playwright-over-HTTP** (figma's pattern: serve the
  renderer, drive with OS-level mouse/keyboard, scrape logs) vs **CDP** (`--remote-debugging-port`)
  vs **MCP-sidecar over a socket** (cua-bench's native ms-word pattern — matches our MCP plan).
  ⭐ MCP-sidecar for orchestration + semantic tools; a thin RPC/CDP for the pixel hot-loop.
  ⚠️ Electron is a desktop binary, not a URL — to use Playwright we'd serve the renderer over
  HTTP. **Status: open — couples with E (MCP) and F (repo/merge).**

## E. MCP server
- **E1 — Host & SDK.** ⭐ one MCP server in the **Electron main process**, `@modelcontextprotocol/
  sdk@^1.29`, written in TS. **Status: open (recommendation strong).**
- **E2 — Primitive mapping.** ⭐ **Tools** = actions (`reset`, `step`, low-level `click/type/key/
  screenshot` via `sendInputEvent`/`capturePage`, high-level `set_bold`/`insert_table` via our
  command layer); **Resources** = observations (`screenshot`, `document` state, `task` goal);
  **Prompts** = task brief. Verifier/reward computed **server-side** (agent never self-reports).
  ⚠️ don't force big screenshots through JSON-RPC every step — use resource links + compact
  step results. **Status: open.**
- **E3 — Transports + episodes.** ⭐ ship **both** Streamable-HTTP (training/parallel) + stdio
  (debug); one long-lived session holding many episodes (`reset()` → `episode_id`). **Status: open.**
- **E4 — Action interface identity.** ⭐ **both** pixel (CUA) + semantic tools, converging on the
  one model. ⚠️ keep low-level tools genuinely low-level or it becomes a tool-use env, not CUA.
  **Status: open.**

## F. Logger
- **F1 — Log contract.** ⭐ conform to **cua-bench's three-stream contract** (`raw[]` DOM input,
  `semantic[]` intent/command events, `outcome{summary, document}` ground-truth snapshot) since
  this merges into cua-bench; layer OTel-GenAI/RLDS as export views. ⚠️ requires a
  `serializeDocument()` → typed `outcome.document` (we get this ~free from the PM model).
  **Status: open — confirm we target the cua-bench contract.**
- **F2 — Tap points.** ⭐ `dispatchTransaction` (raw Steps = `semantic`) + capture-phase window
  listeners (`raw`) + per-flush model serialization (`outcome`). ⚠️ capture **appended**
  transactions (plugins) too; typing/keyboard bypass the command layer → the transaction tap is
  the real choke point. **Status: open.**
- **F3 — Storage + firewall.** ⭐ append-only JSONL; content-address screenshots (SHA-256);
  per-step canonical (RFC-8785) doc hash; **privileged ground truth in a separate stream the
  agent can't read**, enforced by a regression test. **Status: open.**

## G. Verifier
- **G1 — Language.** Options: **Python** (cua-bench's verifier framework is Python; reuse its
  `Task/Rubric/Check` engine + QA harness verbatim) vs **Node/JS** (same language as the model;
  no cross-process). ⭐ Python for cua-bench compatibility, reading `outcome.document` JSON (a
  small Python sidecar can also use `python-docx` on the saved `.docx`). ⚠️ cross-language
  (JS model ↔ Python verifier) — mediated by the JSON log, so acceptable. **Status: open.**
- **G2 — Method + reward.** ⭐ execution/state-based predicates over the model/OOXML (no LLM
  judge for structural checks); **binary success** by default (eval), optional clamped
  partial-credit (RL); LLM-judge only for open-ended prose, gated. ⚠️ reward hacking → the QA
  harness (CORRECT/IMPROPER/CORRECT+TRASH; gold→1.0, start→0.0) is a hard CI gate. **Status: open.**
- **G3 — Gold/ground-truth.** ⭐ mint gold `.docx` **offline** via the macOS Word AppleScript
  oracle; check into task fixtures. ⚠️ oracle limits (e.g. hyperlink creation broken in
  Word-for-Mac 16.77) → some task families need hand-authored or Windows-COM gold. **Status: open.**

## H. RL environment
- **H1 — Env loop.** ⭐ Gymnasium `reset(seed)`/`step(action)` semantics; `terminated` =
  verifier success, `truncated` = max-steps; `info` carries privileged state. **Status: open.**
- **H2 — Determinism mode (flipped at `reset`).** ⭐ `force-device-scale-factor=1`, fixed
  window, **bundled fonts**, disabled animations/caret-blink, seeded `Math.random`
  (`seedrandom`) + frozen clock (`@sinonjs/fake-timers`), version pins; pagination = pure
  function of (model, metrics). ⚠️ font **licensing/metrics** (Aptos/Calibri are MS-licensed;
  metric-compatible substitutes shift shaping). **Status: open.**
- **H3 — Observation bundle.** ⭐ screenshot + an a11y-tree-ish structured tree (the 212-control
  `WC.RIBBON` is a near-free accessibility tree) + the model JSON + optional Set-of-Marks; one
  stable `element_id` linking DOM↔a11y↔SoM. **Status: open.**
- **H4 — Task framework.** ⭐ parameterized templates + checkers (AndroidWorld/OSWorld style):
  `task = {seed_doc, params_sampler, goal, checker}` → many seeded variations with auto reward;
  fold checkers into the existing test harness. **Status: open.**
- **H5 — Parallelism/isolation.** Options: many headless `BrowserWindow`s in one process vs many
  Electron processes vs containers. ⚠️ state leakage vs overhead; needed scale = eval vs training.
  **Status: open.**

## I. Repo / merge
- **I1 — Build-here-then-merge.** This app is developed in `ms-word-clone` and **merges into
  `cua-bench`** as an `apps/*` environment. ⚠️ cua-bench already has a *native Qt6/LibreOfficeKit*
  `apps/ms-word`; decide whether this Electron one **supersedes** it, **coexists** as a different
  app slot, or is an **alternative implementation**. **Status: open — user's call.**
- **I2 — Migration sequencing (strangler-fig).** Spike → `electron-vite`+TS + vendor fork →
  render in our view behind the existing ribbon → flip editing core → logger → verifier →
  hard constructs (sections/headers/footers/fields/track-changes/comments) → pagination (last) →
  `.docx` round-trip tests → (optional) React chrome. Gate every cut-over on the 228+9 suite.
  **Status: open (draft in `../research/opensource-deepdive/04-migration-and-feature-preservation.md`).**
