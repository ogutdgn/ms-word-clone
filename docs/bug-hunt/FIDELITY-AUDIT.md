# MS-Word-Clone Fidelity Audit — Runtime-Verification Worklist

## 1. Per-area tally

| Area | Controls | Bugs | Deviations | Top-level gaps flagged |
|------|---------:|-----:|-----------:|------------------------|
| Home / Font | 16 | 3 | 11 | 9 |
| Home / Paragraph | 22 | 2 | 13 | 7 |
| Home / Styles+Clipboard+Editing | 30 | 3 | 16 | 5 |
| Insert / Pages+Tables | 26 | 2 | 18 | 6 |
| Insert / Illustrations+Media | 12 | 1 | 5 | 7 |
| Insert / Links+Comments+H&F+Text+Symbols | 17 | 0 | 11 | 6 |
| Draw | 11 | 3 | 8 | 8 |
| Design | 21 | 3 | 14 | 6 |
| Layout | 19 | 1 | 4 | 6 |
| References | 25 | 2 | 21 | 6 |
| Mailings | 31 | 4 | 17 | 8 |
| Review | 28 | 1 | 19 | 7 |
| View + File/Backstage | 63 | 4 | 24 | 7 |

(Tally counts the explicitly listed `bugs[]` entries per area; "gaps" = items in `topNewBugs`.)

## 2. Top ~30 to runtime-verify next (needsRuntime=true, ranked sev → confidence)

**S2 — data-loss / read-only / silent-corruption (verify first)**
1. **Review · Restrict Editing · bug/S2** — Enforce read-only, then `WC.Commands.run({cmd:'bold'})` / insert table; confirm doc still mutates (bridge `cmd()` has no editable guard).
2. **Home/Font · Font Size combo · bug/S2** — Type 4pt and 200pt; confirm silent clamp to 8/96 round-trips wrong.
3. **Home/Font · Text Highlight · bug/S2** — Apply Standard 'Orange' #FFC000, save+reopen; confirm highlight became `w:shd` shading.
4. **Home/Paragraph · Shading · dev/S2** — Select a few words, apply Shading; confirm whole paragraph fills (no run-level `w:shd`).
5. **Insert/Illust · Shapes · bug/S2** — Click any shape; confirm nothing inserts (dead toast).
6. **Insert/Illust · Chart · S2** — Build chart, OK; confirm input discarded, nothing inserts.
7. **Insert/Illust · Screenshot Clipping · dev/S2** — Confirm it captures whole screen, no rubber-band region.
8. **Draw · Eraser · dev/S2** — Point/Segment erase a stroke crossing; confirm whole stroke deleted (no split).
9. **Draw · Pens Gallery · bug/S2** — Select blue/red/highlighter; confirm active-tile highlight never moves.
10. **Draw · Drawing toggle · bug/S2** — Enable ink; confirm button never latches + flyout always says "Start Drawing".
11. **Design · Watermark gallery · bug/S2** — Insert watermark, save+reopen; confirm dropped (CSS-only).
12. **Design · Custom Watermark · bug/S2** — Confirm no picture/font/size/transparency options; not exported.
13. **Review · Accept/Reject main · dev/S2** — Caret in plain text w/ 2 changes → Accept; then caret on A adjacent to B → Accept, confirm B not skipped.
14. **Review · Compare · dev/S2** — Confirm `.docx` Browse rejected + result replaces current doc.
15. **Mailings · Rules If…Then…Else · bug/S2** — Build IF rule; confirm literal operator labels written → invalid field.
16. **View · Outline view · bug/S2** — Switch to Outline; confirm no visual change + status chip wrongly = 'print'.
17. **File · Print button · dev/S2** — Set Copies/Range/Orientation; confirm all ignored.
18. **File · Create PDF · dev/S2** — Export an A4/landscape doc; confirm hardcoded Letter/no-margins.
19. **File · Close · bug/S2** — Confirm it creates a new blank doc instead of closing.

**S3 — behavioral fidelity**
20. **Home/Styles · Format Painter lock+Esc · bug/S2** — Double-click lock, press Esc; confirm painter stays armed.
21. **Home/Styles · Format Painter single · bug/S3** — Confirm Esc-cancel only honored for locked variant.
22. **Insert/Pages · Blank Page · dev/S3** — Insert; confirm two `w:br` in one paragraph (no true blank page).
23. **Insert/Pages · Insert Table mid-paragraph · dev/S3** — Caret mid-text; confirm table lands after whole para.
24. **Insert/Text · Drop Cap Dropped · dev/S3** — Apply Dropped; confirm not painted in-app.
25. **References · Mark Entry (Index) · bug/S2** — Alt+Shift+X with no selection; confirm silent no-op, no dialog.
26. **References · Next/Prev Endnote · bug/S3** — Mix footnotes+endnotes; confirm "Next Endnote" lands on a footnote.
27. **Mailings · Go to Record spinner · bug/S2** — Confirm indent icon, 'pt' unit, step 6, default 0.
28. **Mailings · Preview Results · dev/S3** — Preview; confirm ADDRESSBLOCK/GREETINGLINE stay «placeholder».
29. **Mailings · Finish&Merge Print · dev/S4** — Confirm it prints template/preview, not per-record copies.
30. **Review · Word Count · dev/S3** — Select a sentence, open Word Count; confirm whole-doc totals (selWords ignored).
31. **Review · Read Aloud · dev/S3** — Change voice → no effect; Prev/Next just restart.
32. **View · Web/Draft layout · bug/S3** — Switch; confirm nothing changes (CSS targets dead `#editor`).

## 3. Code-confirmed (log directly, no runtime needed)

- **Home/Font** — Ctrl+]/Ctrl+[ do preset-jump not ±1pt (cap 72/8); Ctrl+= / Ctrl+Shift+= / Shift+F3 unbound; Underline dropdown has no color / "More Underlines"; Font Color ▸ Gradient missing.
- **Home/Paragraph** — Multilevel "Change List Level" offers 1–5 not 9 + no grey-out (silent no-op); Paragraph dialog missing Line-and-Page-Breaks tab, special indents, line-spacing rules, Tabs, preview.
- **Home/Styles** — Replace (Ctrl+H) hides Match-case/Whole-word/Wildcard row (advanced=undefined); Paste Special missing Paste-link/Display-as-icon; Apply Styles one-shot modal; Styles pane flat list; Advanced Find reduced to 3 checkboxes.
- **Insert/Pages** — Cover Page: all 6 designs insert identical SDT; Convert Text to Table = dead toast; row limit clamps to 1000 cols (Word=63).
- **Insert/Illust** — Pictures dropdown drops "Stock Images…"; Shapes gallery omits Flowchart/Equation/Recently-Used + New Drawing Canvas.
- **Insert/Links** — Date&Time "Update automatically" never read (always DATE field); Signature Line OK = no-op; Link dialog no scheme-prefix/no E-mail tab; Symbol no font selector/special-chars tab; Equation menu omits Ink/Save-to-Gallery; Quick Parts no AutoText/Building Blocks.
- **Draw** — Custom Pen forces opacity 1 (no translucent highlighter); dSetPen never sets tool='pencil'; Stencils group (Ruler/Protractor) absent; Select Objects = single-stroke delete-only.
- **Design** — Style Set: 9 gallery names don't match 3-key SETS map → all identical; Themes active-checkmark stuck on Aptos; Style Set flyout omits Reset/Save-as-New; Page Border width-unit mismatch between two dialogs; "Save to Watermark Gallery" / Page Color "Fill Effects…" not rendered.
- **Layout** — Breaks fully unreachable (DEFERRED + broken `insertPageBreak()` → would TypeError); whole Page Setup group + most Arrange = blocked toasts on retired `WC.Editor`/undefined `WC.Layout`; Wrap menu missing 4 items.
- **References** — Custom TOC Tab-leader select never read; Bibliography titles all collapse to one; Auto Table 1 vs 2 identical (title arg ignored); Insert Citation "Add New Placeholder" = no-op.
- **Mailings** — Address Block / Greeting Line dialogs ignore all options; NEXTIF/SKIPIF insert bare condition-less fields; CSV import doesn't strip UTF-8 BOM; rule dialogs don't escape quotes; Match Fields maps only 10 fields.
- **Review** — Track Changes split ticks both For-Everyone + Just-Mine; Spelling vs Spelling&Grammar identical handler; Thesaurus = hardcoded 8 words; Accept/Reject-All-Shown permanently disabled.
- **View/File** — Switch Windows shows hardcoded "✓ 1 Document1"; Open limited to docx/html/txt/csv; Save As to docx/html/txt only (.doc/.rtf/.odt/.pdf unreachable); File Info/Options/Account panes read-only stubs.

Source data: per-area JSON summaries provided in the task prompt (no repo files were read).