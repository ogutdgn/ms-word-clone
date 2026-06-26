# Feature Specification: Find/Replace advanced (018)

**Feature Branch**: `feature/018-find-replace-advanced` · **Created**: 2026-06-26 · **Status**: Draft

**Input**: Find/Replace works for plain text + the 3 option toggles, but lacks Word's advanced surface:
Find by **formatting**, **special characters** (^p/^t/…), **Go To Page/Line** (currently heading-only), and
**wildcard ranges/groups** (`{n,m}`/`()`). Built off an exhaustive 5-reader spike (NO-FORK feasibility).

## Spike conclusion (2026-06-26)

| Sub-part | Verdict | Mechanism |
|---|---|---|
| **Find by formatting** | NO-FORK | The fork `SearchMatch` exposes `{from,to}`; resolve + inspect marks (`getFormattingStateAtPos` / `$pos.marks()`). v1 = **navigation-based** `findFormatting(text, filter)` (select+scroll the next range matching text∧format) — Word's Find-Next-with-format flow. (Highlight-all decoration for format = deferred.) |
| **Go To Page** | NO-FORK | Our layout adapter already maps a pos→page via `pe.computeCaretLayoutRect(pos).pageIndex` (used by `getCurrentPage`). Add `pageIndexOfPos(pos)`; scan textblock starts for the first on page N; jump+scroll (the heading-jump pattern). |
| **Special chars** ^p/^t/^l (Find) | NO-FORK | `SearchIndex` joins paragraphs with `\n` and treats `\n`/`\t` as whitespace splits. Bridge translation `^t`→tab, `^p`→`\n`, `^l`→`` before `findSession`. (v1 imprecision: ^p matches any block boundary — acceptable.) |
| **Wildcard `{n,m}` + `()` (Find)** | **Minimal additive fork edit** | `SearchIndex.wildcardToRegExp` (already a slice-5 fork edit) supports `* ? [] < > \esc` but escapes `{}`/`()`. Add pass-through for valid `{n}`/`{n,}`/`{n,m}` quantifiers + `()` groups — Word-faithful (literal parens use `\(`). |
| **Wildcard `\1` backref-replace** | DEFER | The replace path treats the replacement as a literal string (never invokes the group-aware `getReplacements`). A non-additive pipeline rework — v2. |

## User Scenarios (P1)

1. **Find by formatting** — caret at top, "Find Next" with the **Format ▸ Bold** filter (no text, or a text term) selects the next bold run; repeat advances; a filter + text finds the next bold occurrence of the text.
2. **Special characters** — typing `a^tb` in Find (or via the **Special ▸ Tab character** menu) matches "a⇥b"; `^p` matches a paragraph boundary; in the find pane the Special menu inserts the code at the caret.
3. **Go To Page** — Go To → "Page" + "3" scrolls to and places the caret on the first paragraph of page 3.
4. **Wildcard ranges/groups** — with "Use wildcards" on, `a{2,3}` matches "aa"/"aaa"; `(go)+` / `(ab)` groups parse without error; literal `(` still works as `\(`.

## Functional Requirements

- **FR-001**: `WC.PM.findFormatting(text, filter)` — selects+scrolls the next doc range (forward from the caret,
  wrapping) whose marks satisfy `filter` (`{bold, italic, underline, fontFamily, fontSize}`) AND (if `text`) contains
  the text; returns `{found, pos}`. NO-FORK (post-resolve marks via the fork's formatting helpers).
- **FR-002**: Special-char translation in `bridge/search.ts` — `^p`→`\n`, `^t`→`\t`, `^l`→``, `^^`→`^` —
  applied to the Find query before `setSearchSession`; a literal `^` without a known code passes through.
- **FR-003**: Go To **page** — `goToImpl` handles `'page'` via the new `coords.pageIndexOfPos(pos)`; `'line'` stays
  a graceful no-op (deferred). The Go To toast no longer claims "Phase 7" for page.
- **FR-004**: `wildcardToRegExp` passes through `{n}`/`{n,}`/`{n,m}` quantifiers and `()` groups (additive fork edit,
  marked + tracked); existing operators unchanged; an invalid pattern degrades to 0 matches (no crash).
- **FR-005**: Find pane gains a **Special ▸** menu (Find + Replace boxes) and a **Format ▸** menu (Bold/Italic/
  Underline/Font…); Go To dialog already lists Page/Line. All reuse `WC.flyout`/`el`/`WC.dialog`.
- **FR-006**: Every behavior ships a regression test in `scripts/test-suite-pm.js` (paged suite).

## Success Criteria

- **SC-001**: Find by formatting selects the next bold run (with/without a text term). **SC-002**: `a^tb` /`^p` find
  matches across the tab/paragraph boundary. **SC-003**: Go To Page 3 lands the caret on page 3’s first paragraph.
  **SC-004**: wildcard `a{2,3}` and `(ab)` match without error; literal `\(` still matches "(". **SC-005**: gates
  green (`build && test:pm` + smoke + roundtrip + bundle). **SC-006**: NO-FORK except the marked additive
  `wildcardToRegExp` extension.

## Assumptions / out of scope (v1 known limitations)

- 018 is **navigation/search behavior** — it does not change the saved `.docx`, so there is no Word-COM fidelity
  claim (validated in-app via `test:pm`). Parity reference = Word's Find/Replace UX.
- **Deferred (documented):** wildcard `\1`-style backreferences in the **Replace** box (the replace path is literal —
  a non-additive pipeline rework); `^p` in the **Replace** box (would need a paragraph split, not a text insert);
  **Go To Line** (per-line layout traversal — deferred; page is shipped); highlight-all decoration for formatting
  search (v1 is navigation-based); Go To targets beyond Heading/Page (Section/Footnote/etc.).
- **/code-review hardening (v1 known limits):** (a) **Replace-by-formatting** is blocked (toasts) — the replace
  session has no format awareness, so applying it would replace UNformatted matches; clear the Format filter to
  replace. (b) **Ignore Diacritics** is silently dropped when the query contains a special code (`^p/^t/^l`) — the
  precise regexSource path bypasses the diacritic-folding search. (c) Formatting search matches a text term **within
  a single text node** — a phrase split across run boundaries (mid-word font change) isn't found. (d) `findFormatting`
  matches a mark only when it's truly **on** (an imported disabled `<w:b w:val="0"/>`/`<w:u w:val="none"/>` is
  skipped), and a **font** by its primary family (the stored value is a CSS stack). (e) **Go To Page** fails honestly
  (no jump) when the layout isn't ready rather than landing at the document end.
- The one fork edit (`wildcardToRegExp` `{}`/`()` pass-through) is **minimal + additive** (new branches, existing
  operators unchanged) — the pre-authorized pattern; marked `MS-WORD-CLONE FORK EDIT (018, user-authorized)`.
