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
_TBD — locked at section kickoff._

| Section | Feature | Status | Note |
|---|---|---|---|
| Clipboard | _tbd_ | | |
| Font | _tbd_ | | |
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
