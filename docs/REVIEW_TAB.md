# Review Tab — Feature Status

_Real Track Changes engine. Verified by 10 tests (146/146 total) + MS Word oracle (`review_probe.ps1`) + web research._

## Tracking & Changes (the centerpiece)
- ✅ **Track Changes** — `beforeinput` interception: typed text → `<ins>` (red underline), deleted text → `<del>` (red strikethrough), kept not removed
- ✅ **Display for Review** — Simple / All Markup / No Markup / Original (CSS modes, no DOM rewrite)
- ✅ **Accept / Reject** — This Change / All Changes / and Move to Next; **Previous / Next** navigation
- ✅ **Reviewing Pane** — lists every insertion/deletion with type + text, click to scroll
- 🟡 **Show Markup** — toggles (approximated)

## Comments
- ✅ **New Comment**, **Delete** (+ Delete All), **Previous / Next**, **Show Comments** toggle

## Proofing / Accessibility / Language
- ✅ **Word Count**, **Editor/Spelling** (OS proofing), **Thesaurus** (built-in synonyms), **Check Accessibility** (alt-text / heading-order / table-header rules + results pane), **Set Proofing Language**
- ❌ **Translate** — cloud translator, documented stub

## Speech / Compare / Protect / Ink
- ✅ **Read Aloud** (Web Speech), **Compare** (word-level diff → tracked changes), **Restrict Editing** (read-only toggle), **Hide Ink** (toggle ink layer)
- ❌ **Block Authors** (cloud co-auth), **Linked Notes** (OneNote) — documented stubs

## Real-Word validation (`review_probe.ps1`)
- ✅ Track Changes: 3 revisions from a replace+insert; types Insert=1/Delete=2; Accept reduces the count — matches our `<ins>`/`<del>` + accept/reject
- ✅ Comments: `Comments.Add` works (count/author/text)
- ✅ Default markup color = red (by author) — applied
