# ADR-0003 — Fork SuperDoc's schema + converter as the document core

- **Status:** Locked — pending the de-risking spike
- **Date:** 2026-06-03
- **Refines:** ADR-0002 (which PM schema to use). **Supersedes** the earlier "bare
  ProseMirror with a hand-built minimal schema" lean.

## Context
ADR-0002 locks a ProseMirror model. The hardest part of a *faithful* Word clone is the
`.docx` (OOXML) pipeline — specifically **import** (opening an arbitrary real Word file into
an editable model). The open-source landscape:
- `mammoth`: `.docx → lossy HTML` only (drops sections, real styles, headers/footers,
  fields, track changes, comments).
- `dolanmiu/docx`, `prosemirror-docx`, `html-to-docx`: **export-only** (no import).
- TipTap / CKEditor `.docx`: **paid cloud black box**.
- **SuperDoc `super-converter`: the only open-source, local, bidirectional OOXML↔(PM)model
  converter** — ~**90,000 LOC**, battle-tested against real-world documents.

A from-scratch importer's correctness is bounded by our test corpus, which we do not have at
the scale of SuperDoc's accumulated edge-case handling. (The user judged, correctly, that we
cannot reproduce 90k LOC of OOXML fidelity with our testing resources.) License and effort
were explicitly removed as decision criteria; the decision rests on **architectural quality +
Word fidelity + UI control**.

**Key coupling fact (from reading the code):** the converter and the schema are
*inseparable*. The converter translates `OOXML ↔ a specific schema` — its output **is**
SuperDoc's node/mark shapes. "Use the converter" therefore means "adopt its schema." There is
no way to keep the proven converter and feed a different custom schema without rewriting its
~196 handlers (= reintroducing the correctness risk). Also confirmed: SuperDoc's nodes define
standard `renderDOM`/`parseDOM` (255/260 occurrences) → its PM model **can** be rendered in a
plain contenteditable `EditorView`; external `@superdoc/*` coupling in the converter dir is
small (~7 import sites).

## Decision
**Fork SuperDoc's document core — its ProseMirror schema + its `super-converter` — vendor it,
pin it, and own it. Build everything around it ourselves:**
- **Render** the model in **our own** ProseMirror `EditorView` with **our CSS** (not their
  Vue `DomPainter`).
- **Our Word UI** (the `WC.RIBBON` ribbon, dialogs, status bar, page-sheet chrome) stays ours.
- **Our RL instrumentation** (logger taps `dispatchTransaction`; verifier queries the headless
  PM doc / OOXML) sits on top.
- **Do NOT take:** SuperDoc's Vue toolbar/UI, its `DomPainter` renderer, its `layout-engine`
  (optional future borrow for pagination), or a live dependency.

The schema is **ours to extend**: because we fork it and PM schemas are extension-composable,
we add/modify/remove nodes/marks/attributes for the clone's needs. **Rule:** any schema change
that touches what is *saved* to `.docx` must be matched by a converter handler update (we own
the fork, so this is in our control).

## Options considered
- **Path 1 — minimal bare-PM core we design + our own converter (or asymmetric mammoth/dolanmiu).**
  Rejected as the default: clean ownership but inherits the 90k-LOC import-correctness risk;
  a long tail of "this real doc renders wrong" bugs we can't test away.
- **Path 2 — fork SuperDoc's schema + converter, own the rest. (CHOSEN.)**
- **Path 3 — own schema, port SuperDoc's converter logic to it.** Rejected: re-targeting ~196
  handlers = rewriting the converter = reintroducing the correctness risk (ported code is new,
  untested code). No free lunch.
- **Adopt SuperDoc as a live framework/product.** Rejected (its imposed Vue renderer + UI
  conflicts with our UI control; live dependency we don't control). Forking neutralizes this.

## Rationale
We inherit 90k LOC of *tested* OOXML fidelity — the one thing we cannot reproduce — while
preserving what we actually care about: we **own the core** (it's our fork; upstream
deprecations/direction/license don't bind us), we **control the UI** (our own `EditorView` +
ribbon, no Vue painter), and we **keep raw Steps** for the logger (it's still ProseMirror).
SuperDoc already models lists as paragraph+`numId` (satisfies ADR-0004) and is bidirectional
(satisfies ADR-0005), so the decisions line up coherently.

## Edge cases & risks (the spike must resolve the first three)
1. **Render+edit in our own view** — SuperDoc normally *hides* the PM view and paints
   separately; its `renderDOM` may be tuned for its layout adapter rather than a clean
   Word-looking contenteditable. Must mount it, render with our CSS, and type into it.
2. **Vue entanglement** — `vue` is a hard dependency of the `super-editor` package; confirm we
   can instantiate schema + converter (+ a minimal Editor) **without** mounting their Vue UI.
3. **Dependency closure + headless export** — measure how much of `@superdoc/* · @core ·
   @extensions` must come along to run import+export (+ a basic editable view) headless;
   header/footer **export needs live editor instances** — confirm that's manageable.
4. **Fork maintenance** — we own a large, actively-evolving (v1→v2) fork; upstream fixes need
   manual porting. Pin a version; track upstream deliberately.
5. **We build *within* their schema's choices** — new features are added as Extensions in their
   style (extensible, but their conventions).
6. **Pagination is still ours** (unless we later adopt their `layout-engine`).

## Consequences
- ADR-0002's bare-PM-vs-TipTap question is moot — we adopt SuperDoc's PM schema.
- ADR-0004 (lists = paragraph+`numId`) and ADR-0005 (.docx converter) are satisfied by this.
- **Fallback (if the spike fails):** revert toward Path 1 — a minimal bare-PM core — and
  *narrow the `.docx` import ambition* (accept that faithful import of arbitrary complex docs
  isn't realistic from scratch); export still via `dolanmiu/docx`.
- A new sub-decision (resolved in the spike, not now): **how much to fork** — just
  schema+converter wrapped in our thin PM setup, vs their whole `Editor` class minus the UI.

## Related
- Research: [`../research/opensource-deepdive/02-superdoc.md`](../research/opensource-deepdive/02-superdoc.md),
  [`03-ooxml-save-and-load.md`](../research/opensource-deepdive/03-ooxml-save-and-load.md).
- ADR-0004, ADR-0005; OPEN_DECISIONS → "the spike", "pagination", "repo/merge".
- Architecture: [`../architecture/TARGET_ARCHITECTURE.md`](../architecture/TARGET_ARCHITECTURE.md).
