# Layout Engine — Phase 4 (DONE — the paged PresentationEditor is the default engine)

> **Status: ENGINE SHIPPED as the default (2026-06-21, FR-013).** The paged-render migration
> (M1–M6) adopted SuperDoc's per-page **PresentationEditor** as the layout engine and flipped it to
> the `WC_LAYOUT` default (`'overlay'`→`'paged'` in `src/renderer/main.ts`). The FOUNDATION this doc
> called for is built and shipping; the per-feature acceptance items below are now reconcilable against
> it (some — real multi-page pagination, image resize — are already live; others await per-feature
> wiring). This remains the single source of truth for the layout-engine work. Origin: the 2026-06-15
> user decision *"most features can't be finished before the layout engine — build it first, then fix bugs."*
>
> Companions: [plan.md](plan/plan.md) (roadmap) · [deferrals.md](plan/deferrals.md) §A
> (the gated-feature feed = this engine's acceptance checklist) · [PAGINATION.md](PAGINATION.md)
> (prior art: the **retired** contenteditable engine's geometry + line-split + caret math).

---

## 0. The pivot — why we stop bug-fixing and build this first

Phase 3 (ribbon tab-by-tab hardening) finished the *commands* and *chrome*, but it kept
hitting a wall: a large class of features and bugs are not cosmetic gaps — they are
**fundamentally blocked on the absence of a geometry/layout pass**. The document today is a
**single continuous-flow page sheet** (`#pm-editor`, one `.page`) — now the **legacy `overlay` mode**
(reachable only via `WC_LAYOUT=overlay`) — which had **no concept of**:

- page **boundaries** (real multi-page sheets, page breaks, page numbers),
- **frames** with positions (a floating object anchored + positioned + wrapped),
- **resizable / relocatable** objects (drag an image or a table column),
- header/footer **regions**, multi-**column** text, section **geometry**.

So fixing these one at a time leaks: e.g. image *insertion* works, but **resize/relocate**
needs handles + geometry write-back; tables *render*, but **column/row resize + relocate +
row-splitting-across-pages** need a grid layout pass; borders *store + export*, but **page
borders** need a margin-frame render. Every one of these traces back to the same missing
foundation.

**Decision (DONE):** the layout engine was built **first** (Phase 4) and has shipped as the default
paged PresentationEditor, so the gated bugs are now fixable. We did **not** hack continuous-flow
workarounds (that was the rule all along — `deferrals.md` §A.1 flagged them; this doc turned that flag
list into the build plan the migration executed).

---

## 1. What the layout engine IS (and isn't)

**Is:** an **owned, model-driven** layer over our ProseMirror `EditorView` that derives
geometry from the **document model** (and its OOXML) and renders:
multi-page sheets · floating-object frames (anchor/position/wrap) · selectable+resizable
object handles · header/footer regions · page borders · table grids with resizable
columns/rows. It is built as **PM plugins + decorations + targeted NodeViews + a synced
overlay**, and it **writes geometry back into the model** (EMU/twips) so everything
round-trips to `.docx` and is verifiable headlessly (the CUA-env requirement).

**Isn't:** the retired `contenteditable` `repaginate()` engine (removed in slice 11). That
engine is **prior art only** — its geometry constants, binary-search line splitting, and
caret-as-absolute-char-offset trick (see [PAGINATION.md](PAGINATION.md)) inform the rebuild,
but the new engine operates on the **PM model / decorations**, not raw editable DOM.

**Validated against the Word oracle** — **Word for Windows 16.0 over COM**
(`scripts/oracle/word-oracle-win.ps1`), the project's native parity target. Geometry
(lines/page), object anchor positions, table grid metrics, and `.docx` round-trips are all
compared to real Word.

---

## 2. What it unblocks — the acceptance checklist

Each row is a currently-gated feature/bug (mostly from `deferrals.md` §A.1 + the editor bugs
found 2026-06-15). The engine is "done" when these are demonstrably fixable and fixed.

> **Status (2026-06-21):** the engine has SHIPPED as the default paged PresentationEditor. The
> "What was blocked" column below is the **pre-engine baseline** (the motivation), not the current
> state — resolution is now tracked **per-feature**. Already LIVE in paged: real multi-page pagination
> (#1) and image resize (#2 — the `ImageResize` plugin runs in the paged PE, M4b). The rest are now
> buildable on the shipped engine and being reconciled.

| # | Area | What was blocked (pre-engine baseline) | What the engine must provide |
|---|------|----------------------|------------------------------|
| 1 | **Pagination** | one continuous sheet; no page breaks, page numbers, blank pages | real multi-page sheets; line-level page boundary; **page-break / blank-page** vertical geometry; **page-number fields**; widow/orphan + keep-with-next (later) |
| 2 | **Image resize** | handles are **decorative** (added 2026-06-15); can't drag-resize | image **NodeView** with 8 live resize handles → writes `w:extent` (EMU); aspect-lock on corner drag |
| 3 | **Image relocate / wrap** | inserts **inline only**; no positioning or text-wrap | inline ⇄ **floating**; drag to reposition; **text-wrap** (square/tight/through/top&bottom/behind/in-front); `w:anchor` + `posH`/`posV` |
| 4 | **Tables — resize** | fixed render; can't drag column/row borders | grid layout pass; **column/row resize** handles → `w:gridCol` / `w:trHeight`; AutoFit geometry |
| 5 | **Tables — relocate** | can't move a table | table **move handle**; reposition; (floating table = anchor, later) |
| 6 | **Tables — page split** | a tall table can't split across pages | **row-level splitting** across page boundaries; repeat-header-row |
| 7 | **Floating objects** | Shapes / Text Box / WordArt render **inline** | reuse #3's anchor/position/wrap frame layer |
| 8 | **Headers / footers** | ✅ **002 (P1+P2+P3)** — on-page edit + tab, first-page/odd-even variants, real `PAGE`-field page numbers; all export-validated vs real Word. REMAINING: in-app render of a *freshly-inserted* field's per-page number (shows "0"; Word resolves it) + Date/Document-Info fields | per-page **header/footer regions**; first-page / odd-even; field render (page #, date) |
| 9 | **Page borders** | `w:pgBorders` stores + exports, but **doesn't render** | draw the border **around the page margins**; border-art styles |
| 10 | **Watermark** | visual SVG stand-in (not a real header construct) | watermark as a real **header** drawing, per page |
| 11 | **Inside-Vertical border** | no paragraph OOXML equivalent | only meaningful inside a **table/columns** grid → falls out of #4 |
| 12 | **Columns / sections** | ✅ **003 columns (P1+P2+P3)** — One/Two/Three + More Columns (spacing/equal-width) + Left/Right unequal + line-between + a column break; the paged engine flows the text + it round-trips to real Word (oracle: `TextColumns` count/spacing/even/line-between + per-column widths = Word's Left preset). REMAINING: mid-doc **section** breaks change geometry (separate feature) | multi-**column** text flow; section breaks change geometry mid-doc |
| 13 | **Diagonal cell borders / Shadow-3D borders** | greyed / flattened | need the table layout pass (#4) / a depth render |

**Already RESOLVED in continuous flow (no engine needed)** — recorded so we don't re-do them:
Inside-**Horizontal** border between stacked paragraphs (renders via the run-merge,
`e8d19aa`); per-paragraph borders + carry-forward; **picture natural-size + column clamp**;
**image selection frame**; **online-video poster**. (See `deferrals.md`.)

---

## 3. Proposed architecture (confirm against the real code on the branch)

> Per the project's process (`plan.md` §"Development process"): the *foundation* is locked,
> but each subsystem's design is **confirmed/adjusted against the now-real code when we reach
> it**. The below is the starting recommendation, not a frozen contract.

- **`layout` plugin (pagination core).** On each transaction (debounced), measure rendered
  line boxes and compute page boundaries; render sheet seams as **PM widget decorations**
  (preferred over the old in-flow spacer `<span>`s) so the model stays clean and the caret is
  never yanked. Reuse the geometry (Letter 816×1056 @96dpi, 1″ margins, ~26 Aptos-12
  lines/page — oracle-calibrated) and the **binary-search line split** from PAGINATION.md §2/§7.
  Continuous views (Web/Draft) keep a no-sheet fallback.
- **`frames` overlay (floating objects).** An absolutely-positioned overlay synced to anchor
  nodes; drag dispatches a transaction updating the node's `size`/`position` attrs (EMU). One
  frame layer serves images, shapes, text boxes, WordArt.
- **Object NodeViews + handle layer.** Image (and table) NodeViews render **resize handles**;
  dragging writes the new geometry **back into the model** (`w:extent` / `w:gridCol` /
  `w:trHeight`), so it exports + is headlessly verifiable.
- **Header/footer regions.** Per-page editable regions painted by the layout pass; page-number
  and date **fields** rendered from the model.
- **Geometry write-back is the invariant:** the overlay/handles are *views*; the **model** is
  the source of truth. Nothing visual-only — every drag/resize is a transaction → exports →
  verifier-checkable (the CUA-env contract).

---

## 4. Build order (sub-phases — branch per sub-phase, gate + oracle each)

- **4a — Pagination core.** Model-driven multi-page sheets; line-level boundary; page-break /
  blank-page; oracle-validate lines/page. *Unblocks #1.*
- **4b — Image resize.** Image NodeView + live handles → `w:extent` write-back + aspect lock.
  *Unblocks #2; replaces the decorative handles.*
- **4c — Floating anchor/position/wrap.** The frames overlay for images, then Shapes/TextBox/
  WordArt reuse it. *Unblocks #3, #7.*
- **4d — Tables.** Grid layout pass: column/row **resize**, table **relocate**, **row-split**
  across pages, repeat-header. *Unblocks #4, #5, #6, #11, #13.*
- **4e — Headers/footers + fields.** Regions + page-number/date fields. *Unblocks #8.*
- **4f — Page background + columns/sections.** Page-border render, watermark-as-header,
  multi-column, section geometry. *Unblocks #9, #10, #12.*
- **Then:** clear the `deferrals.md` §A.1 flags and re-run the editor bug list against real
  Word — most should now be fixable.

Each sub-phase: read the relevant `deferrals.md` rows + this checklist → confirm the design
against the real code → build → **gate (test:pm / test:smoke / test:roundtrip) + oracle
parity** → update `plan-tracking` → PR.

---

## 5. Validation

- **Oracle = Word for Windows 16.0 COM** (`scripts/oracle/word-oracle-win.ps1`) — native on
  Windows, the project's intended ground truth (the macOS AppleScript oracle was a flaky
  stopgap). The exact parity target is **LOCKED** in [ADR-0006](decisions/0006-word-parity-target-version.md):
  Microsoft 365 **Word for Windows**, Current Channel, x64, en-US, build **16.0.20026.20168**
  (the dev-PC install). Compare: lines/page, page count, object anchor positions
  (`posH/posV`/`extent`), table grid metrics, and `.docx` round-trips.
- **Gates** stay green; add layout-specific cases to `test:pm` (geometry/handle write-back) and
  `test:roundtrip` (the `.docx` extent/gridCol/anchor round-trips).
- **Headless verifiability** (CUA-env requirement): every geometry change is a model
  transaction, so the verifier can assert it without pixels.

---

## 6. Prior art (reference, not reuse-as-is)

[PAGINATION.md](PAGINATION.md) documents the **retired** contenteditable engine in full:
page geometry + `pageMetrics()` (§2), in-flow gap spacers (§5), the single-page fast path
(§6), the full pass + **binary-search line split + word-boundary snap + char-level fallback**
(§7), and **caret preservation by absolute character offset** (§8). The new engine reuses the
*ideas* (geometry constants, line-split search, caret-offset invariance) but renders via PM
decorations on the model, not by mutating an editable DOM.
