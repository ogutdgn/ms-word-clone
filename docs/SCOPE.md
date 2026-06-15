# Feature scope registry

> The single source of truth for **what the clone implements, defers, or deliberately
> excludes**, ribbon tab by ribbon tab. Built during **Phase 3 (editing-core hardening)** —
> each section's scope is **locked with the user at section kickoff**, then filled in here.
> Companion: [plan/deferrals.md](plan/deferrals.md) (the detailed deferral/deviation ledger;
> layout-coupled items link to its §A.1). Roadmap: [plan/plan.md](plan/plan.md) · playbook:
> [plan/execution-map.md](plan/execution-map.md) CURRENT PHASE.

## The three buckets (keep them distinct — never blur)

| Status | Meaning |
|---|---|
| ✅ **In scope** | should work; a Phase-3 fix target. |
| ⛔ **Out of scope** | deliberately NOT built — permanent (e.g. Adobe Acrobat, Voice/Dictate, Add-ins, cloud-only services). |
| 🕗 **Layout-deferred (Phase 4)** | needs the pagination/layout engine; **flagged, not hacked** (→ [deferrals.md](plan/deferrals.md) §A.1). Resolves when Phase 4 lands. |

> **Flag-don't-hack rule:** a layout-coupled feature is recorded 🕗 with its *specific
> requirement* in `deferrals.md` §A.1 (the Phase-4 spec) — it is **never** faked with a
> continuous-flow DOM hack. (The legacy spacer-hack pagination was deleted in slice 11; do
> not grow a new one.) **Classifier:** multi-page · floating-object position · text-wrap ·
> headers/footers-on-page · columns · vertical page geometry.

## Methodology (Phase 3)

Tab-by-tab, section-by-section. **Section kickoff** is a human gate (general research →
propose in/out scope → user locks it). Then per in-scope feature: **research Word + its
enablement/checked-state rules → compare three-sided against the live clone → fix-now or
layout-flag → regression test → three gates.** One branch/PR per tab, commit per section.
Each control's **state-machine rules** (enablement + latch) are captured alongside its row and
wired into the central ribbon state-sync. Full playbook:
[plan/execution-map.md](plan/execution-map.md) CURRENT PHASE.

---

> Tables below are **skeletons** — populated as each tab is worked. `_TBD — locked at section
> kickoff._` means not yet researched/decided.

## Home

**Clipboard** — scope locked 2026-06-14 (section kickoff). Not layout-coupled → zero 🕗 Phase-4
items. This section also builds the shared **ribbon state-machine spine** (enablement + latch
evaluator + per-control rule registry), generalized from `bridge/state-sync.ts`.

| Section | Feature | Status | Note |
|---|---|---|---|
| Clipboard | Paste (default) | ✅ In scope | works (`pasteDefault`); + enablement (grey when clipboard empty) |
| Clipboard | Paste options: Keep Source / Picture / Keep Text Only | ✅ In scope | **context-aware** dropdown — each button's active/inactive driven by content type (`pasteOptionStates`); Keep Text Only no longer auto-linkifies a URL |
| Clipboard | Paste option: **Match Formatting** | ✅ In scope | destination-style reconciliation (`mergeFormattingHtml`). Label is **Match Formatting** (user's Mac Word); exact paste-option labels vary by OS/build, so the *enablement state machine* is the locked behavior, not the label set |
| Clipboard | Paste Special dialog | ✅ In scope | flavor-driven |
| Clipboard | Paste Special → **Paste Link** (OLE) | ⛔ Out of scope | no OLE backend in the clone; permanent |
| Clipboard | **Set Default Paste…** | ✅ In scope (minimal) | settings panel (Keep Source / Merge / Text Only) honored by `pasteDefault` |
| Clipboard | Cut / Copy | ✅ In scope | + enablement per Word's real selection rule (validate live) |
| Clipboard | Format Painter (1-click / dbl-click sticky / Esc) | ✅ In scope | latch already synced; parity-verify |
| Clipboard | Office Clipboard pane | ✅ In scope | + **wire auto-capture** on Cut/Copy (history was dead in PM) |
| Clipboard | Ribbon state machine (spine) | ✅ In scope | built here once; later sections register rules |

**Font** — scope locked 2026-06-14 (section kickoff; informed by the `font-section-understand` workflow). Not layout-coupled.

| Section | Feature | Status | Note |
|---|---|---|---|
| Font | Font name + size combos show current/effective value (never blank on empty doc) | ✅ In scope | THE reported bug. Bridge fallback in `toQueryState`: marks → effective computed font (Heading-aware) → `converter.getDocumentDefaultStyles()` |
| Font | Combos blank only on a genuinely mixed selection | ✅ In scope | Word parity; completes the combo state machine |
| Font | `activeElement` guard on combo refresh | ✅ In scope | don't clobber a value mid-edit |
| Font | Two-row group arrangement (Word order) | ✅ In scope | explicit grid: row1 name/size/grow/shrink/case/clear, row2 B/I/U/strike/sub/super/effects/highlight/color |
| Font | B/I/U/strike/sub/super latch | ✅ In scope (works) | already latched via the sync tick; keep |
| **Ribbon** | **Responsive ribbon — Stage A** (condense large→small + hide labels + de-clip) | ✅ In scope | **cross-cutting** — built once at `WC.Ribbon` for all 10 tabs (ResizeObserver on `.ribbon-scroll`) |
| **Ribbon** | Responsive ribbon — Stage B (full group→flyout collapse, per-tab reduction order) | 🕗 Deferred (next slice) | heaviest; needs breakpoint calibration across 212 controls |
| Font | Font-dialog launcher cmd collision cleanup | 🕗 Deferred | works today via group-id keying; bundle into a ribbon-data cleanup |
| Font | Dark theme | ⛔ Out of scope | clone is light-theme; the dark screenshot was the user's real Word as a reference |
| Paragraph | _tbd_ | | |
| Paragraph | _tbd_ | | |
| Styles | _tbd_ | | |
| Editing | _tbd_ | | |
| Adobe Acrobat | (whole section) | ⛔ Out of scope | third-party plugin (proposed — confirm at kickoff) |
| Voice / Dictate | (whole section) | ⛔ Out of scope | cloud speech (deferrals.md §B) (proposed) |
| Editor | (whole section) | ⛔ Out of scope | cloud grammar (deferrals.md §B) (proposed) |
| Add-ins | (whole section) | ⛔ Out of scope | Office.js marketplace (proposed) |

## Insert
_TBD._

## Draw
_TBD._

## Design
_TBD._

## Layout
_TBD — heavy 🕗 Phase-4 expected (margins/columns/orientation/size visuals are layout-gated)._

## References
_TBD._

## Mailings
_TBD — envelopes/labels page geometry already 🕗 Phase-4 (deferrals.md §A)._

## Review
_TBD._

## View
_TBD — multi-page View modes / Side-to-Side are 🕗 Phase-4._

## File (Backstage)
_TBD._
