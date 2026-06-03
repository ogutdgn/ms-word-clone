# RL/CUA Re-architecture — Research Notes (2026-06-02)

> **Status: RESEARCH NOTES, not an approved design.** Produced for a joint discussion.
> No code has been changed. Goal of this doc: lay out, with evidence, what kind of
> system we need to turn the Electron MS Word clone into an environment for **teaching /
> training computer-use agents (CUA)** — with a **logger**, a **verifier**, and **MCP
> server(s)** — and whether/how to restructure the architecture and tech stack.

Sourced from a 6-agent research fan-out (1 codebase-grounding reader + 5 web-research
agents: architecture, tech-stack, logger, verifier, MCP). Key external references are
the major CUA benchmarks — **OSWorld, WebArena, BrowserGym, AndroidWorld,
WindowsAgentArena** — plus **Gymnasium**, the **MCP spec/SDK**, **ProseMirror/Lexical**,
and **OSWorld-style verifiers**.

---

## 0. The one headline reframe

> **The load-bearing decision is NOT "move to React." It is "introduce a real,
> separate, authoritative document model."**

Every new requirement is a property of the **document model**, not the view library:

- The **verifier** needs *queryable, schema-valid ground-truth state* to compute reward.
- The **logger** needs a *clean operation/transaction log* to record trajectories.
- The **dual action interface** (pixel CUA + semantic tools) needs *one authoritative
  state both paths converge on*.
- **Determinism** (stable rewards) needs *view = pure function of model*.

Today the **DOM is the model** (`#editor.innerHTML` + `execCommand` + faked-pagination
spacer nodes). You could rewrite the whole app in React and still have this mess if you
keep `contenteditable`+`execCommand`. Conversely, adopting a real model fixes it whether
or not you adopt React. **So: model decision first, React decision second.** React is a
real win for the *chrome* (ribbon/dialogs) and roughly neutral-to-negative on the
*editing surface*.

This is corroborated by every serious benchmark: rewards are computed from **structured
state, never pixels** — OSWorld checks final file/OS state; AndroidWorld reads the
Android system DB via `adb`; WebArena queries the site's backend DB.

---

## 1. Where we are today (codebase grounding)

### Reusable assets (keep & build on)
- **`WC.Commands.run → H[cmd]` dispatch table** (`commands.js:788`) — the natural seam
  for the **high-level semantic action layer** (`set_bold()` == `run({cmd:'bold'})`).
  `ribbon-data.js` already enumerates **212 named commands** → can *generate* the MCP
  tool schema.
- **`Editor.exec()`** (`editor.js:86`) — single mutation primitive 39 call sites funnel
  through (focus→mutate→saveRange→repaginate→emit). One instrumentation point for inline ops.
- **`emit()/onStateChange()` observer bus** + **`queryState()`** (`editor.js:68,277`) —
  ready-made structured state snapshot the logger/verifier can subscribe to.
- **MutationObserver history + absolute-char-offset caret** (`editor.js:31,471,614`) — a
  catch-all tap that already sees *every* DOM change (incl. pixel-level edits that bypass
  the command table); the char-offset caret is a stable serializable cursor.
- **`getSavePayload()/getHTML()`** (`editor.js:563,578`) — already strips layout
  artifacts; the practical "current document state" read for the verifier *today*.
- **docx round-trip** (mammoth in / html-to-docx out) + `docx-utils.js` OOXML
  post-processing + `scripts/test_docx.js` — ground-truth `.docx` interop.
- **`wordAPI` contextBridge + IPC** (`preload.js`, `main.js:226+`) — where an MCP/env
  host hooks in (`ipcMain.handle('env:reset'|'env:step'|'env:observe')`).
- **Probe harness** (`main.js:149` `executeJavaScript` + `capturePage`) +
  `scripts/test-suite.js` (228 tests) — **a working proto-environment loop already
  exists**: act via `WC.Commands.run`, read via `WC.Editor`, observe via `capturePage`.

### Pain points (block the new goal)
1. **Command funnel is NOT a single choke point.** Only ~11 `run()` call sites vs **~39
   direct `exec()` + ~45 `insertHTML`/`insertNodeHTML`** scattered across feature
   modules + dialogs. A tap on `run()` alone misses most mutations and captures *intent*
   (menu opened), not *effect*.
2. **No authoritative model — the DOM is the model.** State is un-normalized HTML whose
   shape depends on `execCommand` (`<b>` vs `<strong>` vs `style`). Two semantically
   identical docs can differ in markup → verification is fragile.
3. **`execCommand` is deprecated & non-deterministic** → direct blocker for reproducible
   rewards.
4. **Undo = whole-document HTML snapshots, not operations** (`editor.js:614`, cap 200,
   debounced) → lossy, no per-action identity; the opposite of a trajectory log.
5. **Hidden side-channel state** (`lastFontColor`, `Ref.sources`, `Layout.lineMode`,
   `Mail`/`Review` state) not in `getHTML` and **not reset** by `setHTML` → cross-episode
   leakage.
6. **Mutations gated behind interactive dialogs / native OS dialogs** (insertTable,
   open/save/pickImage) → not headlessly callable with params.
7. **No input-injection or live screenshot surface** — no `webContents.sendInputEvent`,
   `capturePage` only inside the one-shot probe. **The single largest missing subsystem
   for the low-level (pixel) modality.**
8. **Pagination couples layout into every mutation** (spacer nodes inside `#editor`) →
   "what is the document right now" is ambiguous + nondeterministic timing.
9. **No-bundler global-namespace IIFE architecture resists modular tap-in** — no module
   boundaries/DI/types to insert a model layer cleanly.

---

## 2. Target architecture (what serious CUA envs do)

### 2.1 Authoritative model at the center (env-core)
An explicit, serializable **doc tree** (sections → paragraphs → runs → tables/images with
explicit formatting props, mirroring the OOXML object model). View renders *from* it.
Rewards/observations derive *from* it. This is mandated by OSWorld/AndroidWorld/WebArena.

### 2.2 Gymnasium `reset`/`step` contract (de-facto standard)
- `reset(seed, options) → (obs, info)` — **hard reset of ALL hidden state** (model,
  caret/selection, scroll, zoom, undo stack, clipboard, dialogs, find state,
  comments/track-changes, **RNG + clock shim**). Implement as restore-from-one-serializable
  env-state object.
- `step(action) → (obs, reward, terminated, truncated, info)`. `terminated` = verifier
  success or irrecoverable failure; `truncated` = max-steps. `info` = privileged
  ground-truth + reward breakdown (never shown to agent).

### 2.3 Three action layers, ONE dispatcher (BrowserGym/UltraCUA hybrid)
- **L0 pixel** — `click(x,y)/type/key/scroll/drag` via Electron `webContents.sendInputEvent`
  (true computer-use; **must be built — doesn't exist today**).
- **L1 element** — `click(element_id)` resolved against the AX tree.
- **L2 semantic** — `set_bold()`, `insert_table(3,3)` over `WC.Commands.run → H[cmd]`.

**Invariant:** L0/L1 drive the real UI which mutates the model; L2 mutates the model and
the view re-renders — **all converge on the same model**, so the verifier is
action-layer-agnostic. (This is exactly your "two doors into one model.")

### 2.4 Multimodal, configurable observation (BrowserGym-style)
Per step return any of: **raw screenshot** (`capturePage`), an **AX-tree-style structured
tree** (your **212 declarative `WC.RIBBON` controls are a near-free accessibility tree**),
the **authoritative model JSON**, and an optional **Set-of-Marks** screenshot (numbered
overlay boxes — cheap to inject; VisualWebArena showed it helps *grounding*). Tie them
together with **one stable `element_id`** linking DOM ↔ AX node ↔ SoM box (BrowserGym's
`bid`). Plus feedback fields: `last_action`, `last_action_error`, `step_index`.

### 2.5 Tasks = parameterized templates + checkers (AndroidWorld/OSWorld)
`task = {seed_docx, setup_fn(model), goal_text, params_sampler(seed),
checker_fn(model, params) → {success, partial_credit, reasons}}`. Parameterized
templates ("bold word {W} in para {P}", "insert {R}×{C} table after heading {H}") yield
**millions of seeded variations with auto-correct rewards**. Fold checkers into the
existing `scripts/test-suite.js` harness → every task doubles as a regression test.

### 2.6 Determinism — our hidden advantage over VM-based envs
Fixed window size + `--force-device-scale-factor`; **bundle exact fonts** (host fonts
change wrapping/pagination — fatal for layout tasks); CSS to disable animations + caret
blink; freeze `Date.now()`/`Math.random` behind a seedable shim; pin
Electron/Chromium/html-to-docx/mammoth. **Pagination must become a pure function of
(model, fixed metrics).**

### 2.7 Environment-as-service: two surfaces, one core
- **MCP server** for L2 semantic tools + `reset/run_task/get_document_state` (the
  high-level interface; matches your plan).
- **Thin low-latency RPC** (WebSocket/gRPC, or **CDP** via `--remote-debugging-port`)
  for the L0 pixel + RL stepping hot loop, where MCP's request/response shape and bulk
  image payloads are awkward.
- Run **N headless BrowserWindows/processes** for parallel rollouts.

---

## 3. Tech-stack decision

### 3.1 Model framework comparison (for THIS use case)

| Framework | Schema / ground truth | Op-log for logger | Headless (verifier) | DOCX | License | Verdict |
|---|---|---|---|---|---|---|
| **ProseMirror** | Enforced schema (always valid) | **Serializable, invertible Steps** | `prosemirror-model/-state` run in Node, no DOM | needs work | MIT | **Recommended core** |
| **Lexical** (Meta) | Immutable state, nice update-listeners | dirty-node diff (coarser) | `@lexical/headless` | needs work | MIT, **pre-1.0** | 2nd — **history mem blow-up on long episodes** (crashed ~3.9 GB/23 min; PM stayed 6–18 MB/1 hr) |
| **Slate** | **No enforced schema** | mutation-based | — | needs work | MIT | Out — wrong for a trustworthy verifier; large-doc perf |
| **CKEditor 5** | Rich Word model | operations | — | **best, but paid CLOUD round-trip** | **GPL + commercial** | Out — cloud + license showstoppers |
| **SuperDoc** | PM-based **Word-compatible schema**, **native OOXML↔PM** | (deprecating raw PM step access) | Node/Python SDK + **Agent SDK** | **best local** | **AGPL-3.0 / commercial** | **Evaluate first** — could collapse months of model+OOXML work |

**Why ProseMirror wins for us:** enforced schema = trustworthy ground truth; serializable
**Steps** = a first-class operation log *and* a natural seam to attribute both semantic
tools and pixel edits to concrete ops; headless `EditorState` = verifier & UI share the
*exact same model*; surgical DOM reconciliation + `role=textbox` = **stable pixels + a11y
tree** for the CUA observation channel; proven long-document stability.

### 3.2 React: yes for chrome, not for the editing surface
- **Win for chrome:** the 212-control data-driven ribbon, contextual tabs, dialogs, task
  panes, backstage → React components + typed dispatch is far more maintainable/testable.
  Your instinct is correct *for this layer*.
- **Avoid on the editing surface:** every framework warns that **React node-views
  re-render per keystroke**, shifting layout/coordinates and polluting the a11y tree —
  the opposite of what a coordinate-clicking agent needs. Mount ProseMirror into a ref'd
  `<div>` React never re-renders; use **vanilla** node-views for content.

### 3.3 DOCX fidelity is the true Achilles heel (independent of React)
`mammoth` (open) + `html-to-docx` (save) round-trips through **HTML**, which is reflowable
while DOCX is page-oriented → structurally lossy → **poison for a verifier comparing to
real Word state**. Fix: a model whose serialization maps to OOXML —
**adopt/vendor SuperDoc's OOXML↔PM converter**, or build OOXML emit on the `docx` library.

### 3.4 Build tooling
Importing any of these ESM npm packages forces leaving the no-bundler setup.
**`electron-vite` + TypeScript** is the 2025 standard for React-in-Electron (main
hot-restart, renderer HMR, multi-entry main/preload/renderer) and preserves the hardened
main/preload posture. TS is high-leverage because the logger/verifier reason about model
types.

### 3.5 Recommended target stack
> **Electron (`electron-vite` + TypeScript)** shell → **React** for chrome →
> **ProseMirror** authoritative model with a **Word-compatible schema** (study/vendor
> **SuperDoc**) → **headless model reuse in Node** for the verifier/logger.

---

## 4. Logger design
- **One capture API** `WC.Logger.step({modality, action, args})`. Wrap `Commands.run` +
  `dropdown` for L2 (free, no touching 212 handlers); route L0 pixel events through the
  same API with `modality:'pixel'`. **Log at the intent boundary, not at `execCommand`**
  (one user action = one step even when it fans out).
- **Format:** append-only **JSONL** (event-sourcing / WAL), shaped to **OpenTelemetry
  GenAI semantic conventions (v1.37)** / OpenInference so any backend ingests it.
  Episode = trace; tool call = `execute_tool` span.
- **Step record:** `{schema_version, episode_id, task_id, step_id, ts, modality,
  action{name,args,pixel?}, observation{screenshot_ref, a11y_ref, dom_ref, instruction},
  reward:null, done:false, latency_ms, error?, state_hash{before,after}, info{PRIVILEGED}}`.
  Episode wrapper carries RLDS-style metadata (`is_first/is_last/is_terminal`, env config,
  git sha, versions).
- **Privileged firewall (key privacy rule):** ground truth/target lives ONLY in
  `step.info` / a separate `*.privileged.jsonl` the agent process **cannot read**.
  Enforce as a **regression test**: no privileged key leaks into any observation payload.
- **Replay:** content-address (hash) large payloads; store once, reference by hash;
  per-step doc hash → exact `(s,a,s')` transitions.
- **Tiering:** JSONL+PNG for debugging → converter to **RLDS/Parquet** for replay buffers
  (TorchRL/d3rlpy). Optional self-hosted sink: **Arize Phoenix** or **Langfuse** via
  OpenLLMetry/OTel — kept optional behind the exporter; JSONL stays source of truth.

---

## 5. Verifier design (OSWorld pattern)
- **One authoritative verifier core** (pure Node/JS, no Electron, no model calls), exposed
  via thin adapters (Inspect AI scorer, Prime Intellect `verifiers` reward func, Gym
  reward, MCP `verify_task` tool). Don't scatter assertions across runners.
- **Task schema (copy OSWorld):** `{id, instruction, start_doc, evaluator:{func, result:{source:
  'live_model'|'saved_docx'|'ooxml_part'}, expected, options}, infeasible?}`, with
  conjunction / alternative-path support.
- **Two read surfaces:** verify *interaction* correctness against the **live model**
  (`getHTML()`/`queryState()` today, the real model later); verify *persistence* against
  **OOXML** (reuse `test_docx.js` + JSZip; lift OSWorld's `python-docx` metrics —
  `compare_docx_tables`, `compare_font_names`, `has_page_numbers_in_footers` — via a small
  sidecar if acceptable).
- **Predicate library**, always canonicalizing before compare: `runIsBold`,
  `paragraphStyleIs`, `tableIs(r,c)`, `marginsAre(in, tol)`, `fontFamilyIs`, `alignmentIs`,
  … (collapse whitespace, lowercase fonts, colors→#RRGGBB, twips/EMU→inches w/ tolerance).
  This is where the CLAUDE.md gotchas (integer margins, color rgb-vs-name) become
  normalization rules.
- **Reward shape:** default **binary** task success for evals (sparse, un-gameable); add a
  **decomposed checklist** dense signal for RL *only*, clamped so it can't exceed the
  binary success. Model on `Rubric(funcs, weights)`.
- **Avoid LLM-as-judge by default** for structural Word properties (a naive judge is
  flipped by a single token up to ~80% of the time); reserve + robustify + *gate* it for
  genuinely open-ended prose.
- **Determinism harness:** verifier pure/idempotent given the artifact; pin lib versions;
  CI runs each verifier against its **gold doc (→1.0)** and **start doc (→0.0)**. Include
  OSWorld-style **infeasible tasks** that reward correct refusal.

---

## 6. MCP server design
- **ONE MCP server, hosted IN the Electron main process** (it owns `webContents` + fs +
  docx). Keep `contextIsolation`/sandbox intact — no Node in renderer. The project already
  has the two primitives an MCP env needs: `webContents.executeJavaScript` (semantic
  act + state read) and `capturePage` (screenshot); add `sendInputEvent` for pixel acts.
- **SDK:** `@modelcontextprotocol/sdk@^1.29` (production-stable; the v2
  `@modelcontextprotocol/server` is pre-alpha — avoid). Write `src/mcp/` in TS even if the
  app stays vanilla — clean seam.
- **Primitive mapping:**
  - **Tools** (actions): `env.reset({task_id, seed})`, `env.step({episode_id, action})`,
    + two-tier action surface — L0 `act.click/type/key/scroll/screenshot` (via
    `sendInputEvent`+`capturePage`, exercising the **real** pixel path), L2 `act.set_bold`,
    `act.insert_table` (via `Commands.run`).
  - **Resources** (observations by URI): `word://episode/{id}/screenshot` (image/blob or
    link — **not** giant inline base64 every step), `word://episode/{id}/document`
    (authoritative state for verifier), `word://task/{id}` (goal). **Also embed the obs
    (screenshot ref + compact state/diff + reward/done) directly in the reset/step tool
    result**, because your RL harness drives the loop and shouldn't rely on a client
    auto-attaching resources.
  - **Prompts:** a `task_brief` template the trainer injects.
  - **Verifier/reward lives SERVER-SIDE** (agent never self-reports success); the **MCP
    server is the natural complete chokepoint for trajectory capture**.
- **Transports:** ship **both** — `StreamableHTTPServerTransport` (primary; parallel envs,
  decoupled trainer, auth, stateful sessions via `Mcp-Session-Id`) **and**
  `StdioServerTransport` (single local instance for Claude/Cursor/Inspector debugging +
  the interactive "agent uses Word" demo).
- **Episodes:** prefer **one long-lived MCP session holding many episodes** — `reset()`
  returns an `episode_id` threaded through `step()` args — over one-session-per-episode.
  Map each HTTP session to one Electron env instance; run many for parallelism.
- **Security:** local stdio needs none; remote HTTP → static bearer token for an internal
  rig, OAuth 2.1 + PKCE only if publicly exposed; validate token audience. Bigger risk is
  the *environment* (arbitrary clicks/JS, untrusted `.docx`) → run each env isolated/
  containerized.
- **Pixel-vs-semantic tension:** MCP is great for semantic tools + orchestration +
  verifier; for true pixel-fidelity CUA you may run the screenshot→click hot loop directly
  against Electron (`sendInputEvent`/`capturePage`) and use MCP mainly for the
  semantic/verifier surface. Don't force every pixel into JSON-RPC.

---

## 7. Sequencing (proposed, for discussion)
1. **Authoritative model + deterministic render** (prerequisite for everything; the
   natural moment to evaluate React + electron-vite + TS). Model-first.
2. **Action dispatcher refactor** so L0/L1/L2 share one path into the model.
3. **Observation bundle** + AX tree generated from `WC.RIBBON`.
4. **Gym-style `reset`/`step` + task/checker framework**; reuse the **osascript real-Word
   oracle** ([[macos-word-applescript-oracle]]) to generate ground-truth target docs.
5. **Determinism pinning** (fonts, DPI, clock/RNG shim, version pins).
6. **MCP server + thin RPC + logger.**

Preserve sunk assets where possible: the **`WC.RIBBON` command taxonomy**, the
**docx/OOXML interop layer**, the **`wordAPI` bridge pattern**, the **probe harness**, and
the **228-test suite** (extend it into the task/verifier runtime).

---

## 8. Open decisions (the forks — for our discussion)
1. **Open-source or closed-source distribution?** Gates SuperDoc (AGPL) / CKEditor
   (GPL+commercial). The single answer that most narrows the model choice.
2. **Document-model framework:** bare **ProseMirror** (raw Step access for the logger) vs
   **SuperDoc** (fastest to real-DOCX, but AGPL + deprecating raw PM access) vs **Lexical**
   (nicer DX, but pre-1.0 + history-memory risk on long episodes) vs **keep vanilla +
   bolt on a model** (smallest change, least clean).
3. **React now or later?** Recommended for chrome; confirm *not* for the editing surface.
   Big-bang vs **strangler-fig** (introduce model behind current UI, then port ribbon).
4. **Primary near-term use:** **eval benchmark** (binary reward, fewer parallel envs) vs
   **RL training** (dense reward, high parallel throughput → headless/process isolation).
5. **DOCX fidelity bar:** how close to real Word? Bounds how strict the verifier can be
   and whether to invest in OOXML↔model now.
6. **Action-space v1 scope:** which subset of the 212 commands get first-class semantic
   tools + verifiers first (suggest: formatting, tables, find/replace, styles).
7. **Python sidecar acceptable?** (lets us reuse OSWorld's `python-docx` metrics verbatim
   vs reimplement predicates in Node.)
8. **Standards alignment:** OSWorld + Inspect AI (leaderboard-friendly) and/or Prime
   Intellect Environments Hub (RL-training-friendly)? Shapes task-config + reward signatures.

---

## 9. Key sources
- **Envs/benchmarks:** OSWorld (arxiv 2404.07972), WebArena (webarena.dev paper),
  BrowserGym (arxiv 2412.05467), AndroidWorld (arxiv 2405.14573), WindowsAgentArena
  (microsoft.github.io/WindowsAgentArena), VisualWebArena/Set-of-Marks (arxiv 2401.13649),
  UltraCUA hybrid actions (arxiv 2510.17790), Gymnasium (gymnasium.farama.org/api/env).
- **Editor frameworks:** prosemirror.net/docs/guide, lexical.dev, SuperDoc
  (superdoc.dev), PM-vs-Lexical perf (emergence-engineering.com), electron-vite.org.
- **Logger:** OTel GenAI semconv (opentelemetry.io/docs/specs/semconv/gen-ai),
  OpenInference, RLDS (github.com/google-research/rlds), Langfuse, Arize Phoenix.
- **Verifier:** OSWorld metrics (`OSWorld/.../metrics/docs.py`), Inspect AI
  (inspect.aisi.org.uk), Prime Intellect `verifiers` (github.com/PrimeIntellect-ai/verifiers),
  WebArena-Verified, CUARewardBench (arxiv 2510.18596).
- **MCP:** modelcontextprotocol.io (spec + architecture), `@modelcontextprotocol/sdk`
  (npm), Playwright MCP (github.com/microsoft/playwright-mcp), OpenAI computer-use guide.

---

## ADDENDUM (2026-06-03): align to the EXISTING cua-bench contract

> The clone will merge into the real project at `new_coding/cua-bench`. That repo
> **already defines the logger + verifier contract** (implemented by `apps/figma`), so
> ms-word should **conform to it**, not invent its own. Source: review of
> `cua-bench/apps/figma` + `cua-bench/overview/log-contract.md`.

### The contract ms-word must emit (the real target)
A single session file `<app>-mock-log-<sessionId>.json` with **three streams**:
- **`raw[]`** — every DOM input event (pointer/key/wheel/clipboard), captured by
  capture-phase `window` listeners; fields `{eventId, type, timestamp, sessionTime,
  targetId (nearest `[data-id]`), modifiers, fields}`. Forensic; no rubric reads it.
- **`semantic[]`** — every intent/command event, emitted through ONE funnel
  (`emitSemantic`); base `{schemaVersion, sessionId, eventId, timestamp, pageId,
  rawEventIdRange:[fromRaw,toRaw], name}` + per-name args. `name` is the per-app action
  registry. Drives the efficiency multiplier + event checks.
- **`outcome{}`** — ONE privileged ground-truth snapshot: `{schemaVersion, sessionId,
  capturedAt, summary:{semanticEventCount, shapeCounts}, document:<typed node tree>}`.
  Rebuilt every flush from the app's authoritative model. **This is the verifier's only
  state surface.**

Persisted to `sessionStorage`/`localStorage` under `${date}_${stream}_${sessionId}_data`
and/or POSTed to a `/dev-log` HTTP relay; the runner harvests it via Playwright
`page.evaluate` or HTTP GET.

### The verifier framework (reusable verbatim as an engine)
Pure **Python**, log-driven, app-agnostic. A task = declarative
`task = Task(rubrics=[...], efficiency=EfficiencyRubric(target_turns, lambda_))` in
`task_NN/verifier.py`. Each Rubric holds **Check** primitives; each Check is a
`@dataclass` with `run(log) -> CheckResult{passed, score, max_score, message}`. Scoring:
`base = Σ rubric.weight*(passed/total)` (any `critical[]` check failing **halves** that
rubric), `final_score = base × efficiency_multiplier`
(`0.5 + 0.5*exp(-λ·max(0, len(semantic) - target))`, floor 0.5). Reads **only** the JSON
log — never the live app or a screenshot. Pass threshold **0.7**.
- Task dir: `prompt.md` (instruction) + `verifier.py` (the gold spec) + optional
  `fixture.json` (seed state). Reset = fresh context + `window.__loadFixture(fixture)`.
- QA harness (`qa_verifiers.py`): auto-synthesizes **CORRECT / IMPROPER / CORRECT+TRASH**
  logs per task; passes only if CORRECT==1.0 AND IMPROPER/TRASH<1.0. (This is the
  cua-bench analog of "every task ships a verifier + gold.")
- Driving: `apps/figma` uses **Playwright OS-level input** (`page.mouse`/`keyboard`) +
  `page.screenshot`. cua-bench's *other* ms-word (a separate Qt6/C++ + LibreOfficeKit
  clone with an **MCP sidecar over a socket**) emits the **same three-stream contract** —
  i.e. the contract is transport-agnostic; **the MCP route is already sanctioned**.

### Fit for ms-word: verdict
**The contract transfers; the verifier engine + runner + task layout are reusable almost
verbatim. The one hard prerequisite is a structured, serializable `outcome.document` —
which is the SAME "introduce a real document model" conclusion, independently confirmed
from your own codebase.**

| | figma (works today) | ms-word (today) | gap |
|---|---|---|---|
| Authoritative model | Zustand/Immer store → `buildOutcomeSnapshot()` typed scene tree | **none** — DOM `#editor.innerHTML` IS the doc | **prerequisite** |
| Semantic choke point | `emitSemantic` per command | `WC.Commands.run → H[cmd]` (good, but typing/keyboard/menu **bypass** it) | wrap `run` + secondary capture |
| Raw capture | `installRawCapture()` window listeners | **none** | net-new |
| Node identity | stable layer `id`/`parentId` | contenteditable has **no** stable ids | assign `data-id`s |
| Render surface (CUA perception) | SVG-**DOM**, `data-id`-tagged | contenteditable **DOM**, real elements | **already conforms** ✅ |
| Export path | `/dev-log` + storage | `--probe-out`/`executeJavaScript` harness | adapt to emit contract |
| Verifier checks | geometry/shape/stroke/effect | **irrelevant** — Word needs paragraph/run/style/table/list/pagination/header-footer checks | new `checks/*.py` |

### Word-specific net-new work
1. **`outcome.document` Word schema + `serializeDocument()`** — `body.blocks[]` of
   `paragraph{runs[{text, bold, italic, font, size, color}], style, alignment, listLevel}`,
   `table`, `pageBreak`, plus `sections`, `headers/footers`. (figma's flat per-layer
   `fontWeight` is too coarse — Word bold is a **run-level span**.)
2. **Three-stream `WC.Log` module** (`raw.js` + `semantic.js` + `outcome.js` +
   `export.js`) mirroring `figma/mock/src/logger/`, emitting the exact envelope + storage
   keys; wrap `Commands.run` for `semantic[]` + add a **secondary capture** for direct
   contenteditable typing and keyboard/menu accelerators (Commands.run is necessary but
   **not sufficient**).
3. **Stable `data-id`s** on paragraphs/runs/tables/images (raw `targetId` + semantic↔outcome linkage).
4. **Parallel `verifier/checks/`**: `paragraph_checks`, `run_format_checks`,
   `style_checks`, `table_checks`, `list_checks`, `pagination_checks`,
   `header_footer_checks` — same `@dataclass + run(log)->CheckResult` contract; reuse
   `types.py`/`_base.py`/`efficiency.py`/`loader.py`/the QA harness as-is.
5. **Delivery/serve story** — figma ships a headless web server (`server.mjs`) + Docker
   serving a built SPA that Playwright hits over HTTP. Electron is a desktop binary →
   either expose the renderer over HTTP for Playwright, **or** use the MCP-sidecar pattern
   (the route you already want, already used by cua-bench's other ms-word). The
   logger/verifier contract is identical either way.

### Incremental bridge (consistent with model-first + strangler-fig)
Even before a full ProseMirror model, a deterministic **`serializeDocument()`** that walks
`#editor` HTML → the typed `outcome.document` lets ms-word **start emitting valid logs and
authoring verifiers immediately**; when the authoritative model lands, the serializer
becomes a trivial/loss-free read of the model. So: serializer-adapter now → model later.

### Open integration questions
- **Relationship to the existing `apps/ms-word` (Qt6/LOK + MCP sidecar):** does the
  Electron clone *supersede* it, *coexist* as a different app slot, or serve as an
  *alternative implementation* to compare? (Naming collision to resolve.)
- **Driving pattern:** Playwright-over-HTTP (figma) vs MCP-sidecar (native ms-word) — the
  latter matches your MCP plan and is contract-compatible.
- **Efficiency-multiplier fairness:** ms-word editing is typing-heavy; define
  `semantic[]` granularity (what counts as one "turn") so the multiplier is fair vs
  figma's discrete shape ops.
