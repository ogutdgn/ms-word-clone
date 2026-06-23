# Page Break / Blank Page / Empty-Page Caret — Root-Cause Analysis

_From a multi-agent deep-dive of the paged layout engine (2026-06-23) + a Word-COM ground-truth measurement._
_Status: KNOWN ISSUE. Baseline behavior (page break needs content to show a page) is left in place; the proper fix
is scoped below but not yet implemented (it needs layout-adapter work + LIVE click/caret verification)._

## The one root cause

A manual page break is modeled as an **inline `hardBreak{pageBreakType:'page'}` atom** that lives *inside* the
current paragraph and **never terminates it** (`extensions/line-break/line-break.js:160`). So the page *after* the
break owns no paragraph node. The paged engine only paints a line — and a caret, and a click target — where a real
paragraph **fragment** exists, and `pruneTrailingEmptyPages` (`paginator.ts:47`) deletes any trailing page with zero
fragments. Result: the new page has nothing to render, nothing to click, no cursor, and is often pruned. The caret
renderer, click hit-test, scroll/focus, and prune logic are each individually **correct** — they simply have nothing
to act on, because the document model never produces a paragraph on the new page.

Word does the opposite (measured via COM — `"Hello"` + Ctrl+Enter):
- **3 paragraphs**: `["Hello", "", ""]` — Word ends the paragraph and seeds real empty paragraphs.
- inline **`<w:br w:type="page"/>`** (1), **no** `pageBreakBefore`.
- the **caret lands in paragraph 2** (a real empty paragraph on **page 2**); **2 pages**.

So Word's new page always carries a real empty paragraph that hosts the caret. Ours does not.

## Symptom → mechanism

| Symptom | Mechanism | Code |
|---|---|---|
| Break doesn't make a usable page | new page has no paragraph → no fragment → no line/caret/click → pruned | `paragraph.ts:743`, `paginator.ts:47`, `index.ts:2564` |
| Blank doc "works" but content+break doesn't | the converter's empty-paragraph fallback fires only when the WHOLE paragraph is empty (`!hasParagraphBlock`) — the blank case, by accident | `paragraph.ts:875` |
| Blank Page adds "2 by 2" | it's literally two raw inline breaks (`insertPageBreak().insertPageBreak()`); each starts a page; the interior one isn't trailing so prune can't remove it | `insert.ts:227`, `paginator.ts:74` |
| Pages grow in pairs after edits | once content follows a break, the extra page isn't trailing → prune can't hide it | `index.ts:620`, `paginator.ts:47` |
| Can't move caret UP to an empty page | the post-break caret PM-pos is still inside the *previous* paragraph's range → resolves to the previous page | `layout-bridge/index.ts:1077`, `PresentationEditor.ts:7396` |
| No cursor / can't click an empty page | caret overlay + both hit-test paths strictly require a `.superdoc-fragment`; a fragment-less page resolves nothing | `PresentationEditor.ts:7395`, `EditorInputManager.ts:1516/1549` |
| Focus "jumps" between pages | caret resolves to the wrong page → auto-scroll chases it; two scroll owners race (selection-sync vs the focus-restore RAF) | `PresentationEditor.ts:4705/7523`, `insert.ts:24`, `focus.ts` |

## Why three fix attempts failed

1. **Paginator keeps the empty break-page.** A page is only usable if it owns a *fragment*; a fragment-less kept page
   paints no line, shows no caret, resolves no click. Targeted the prune (a symptom), not the missing paragraph.
2. **Bridge appends an empty paragraph at the doc tail.** Created a fragment, but the paragraph wasn't part of the
   break, the caret wasn't correctly moved into it, and geometry/epoch gaps dropped the click.
3. **Bridge splits the paragraph after the break (`splitBlock` / `tr.split`).** The SuperDoc schema wraps inline
   content in a **`run`** node (`paragraph → run → hardBreak`), so the caret sits *inside* a run (depth 2) and the
   split hits the run, not the paragraph — it silently no-ops for the content+break case. And the blank-doc case
   still needs engine-level page creation the bridge can't provide.

**Lesson:** the empty paragraph must be created with real **break semantics** — a true paragraph boundary after the
break (respecting the `run` wrapper), the caret explicitly moved into it, and the layout epoch resolved — not bolted
onto the paginator or the doc tail.

## The correct fix (scoped, not yet implemented)

The fix belongs in the **page-break model / FlowBlock layer**, NOT the caret renderer / hit-test / focus / scheduler
(all correct; they only need a real fragment-bearing paragraph). A complete fix must do all three: (i) a real
paragraph on the new page, (ii) painted as a `.superdoc-line` with `data-pm-start`, (iii) the PM selection moved into
it.

- **Option A (bridge/command, no fork):** make `insertPageBreak` end the paragraph properly (split at the *paragraph*
  depth, accounting for the `run` wrapper — `tr.split(pos, 2)` or a `paragraph.createAndFill()` insert after
  `$from.after(1)`), then `setTextSelection` into the new paragraph's start. Fix `insertBlankPage` to break + one
  empty paragraph + break. **Limitation found:** the blank-doc case still needs engine page-creation, so Option A is
  not sufficient alone.
- **Option B (layout-adapter, fork — RECOMMENDED for robustness):** a post-pass over the FlowBlock list guaranteeing
  every trailing `pageBreak`/`columnBreak` is followed by a caret-bearing empty paragraph block (with valid
  `pmStart=pmEnd`), mirroring the `paragraph.ts:875` fallback but **per-break**. Keeps the inline `<w:br>` model
  (faithful round-trip), covers content+break, blank-doc, AND imported `[para][w:br page]` docx in one place. Must
  still pair with a command-level `setTextSelection`.

## Verification requirement (the crux)

Headless probes can confirm page counts, that a fragment exists, and that PM positions resolve — but **cannot**
confirm a live human click lands a visible caret on the new page (the test window is one page tall; the coords seam
returns hidden-view coordinates). Any fix MUST be verified live (run the app: Ctrl+Enter, click low on the new page,
arrow-up into an empty page, confirm a visible caret and that typing lands there). This is what caused two shipped
half-fixes — do not declare victory on headless evidence alone.

## Open questions
- Does Insert>Blank Page in Word net +1 page (measure the building block via COM)?
- Does feature 011's known PE-2-vs-Word-3 multipage gap share this root cause (trailing-pageBreak pruning)?
- After the model fix, does the focus-jump (#6 scroll-owner race) disappear, or need a separate fix?
