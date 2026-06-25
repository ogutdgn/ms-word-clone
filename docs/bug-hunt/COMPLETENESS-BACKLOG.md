# Completeness Pass — grouped backlog (2026-06-25)

> The actionable output of the re-discovery campaign: the 127 confirmed findings grouped into **22 spec-kit-feature-sized buckets**, fix-order prioritized. Each bucket = one candidate Completeness-Pass feature (`/speckit-specify → … → ff-merge`). Detail per finding: [BUG-LEDGER.md](BUG-LEDGER.md) + [FEATURE-IMPROVEMENTS.md](FEATURE-IMPROVEMENTS.md).
>
> Severity (synthesis agent's tally): **S1:0 S2:19 S3:28 S4:14 S5:3 none:64**. Authoritative per-finding tally: **54 bugs** (0 S1 · 18 S2 · 27 S3 · 9 S4) **+ 73 gaps** (1 P1 · 21 P2 · 51 P3) = **127**.
>
> **Phase-2 hardening status (2026-06-25):** P1 bucket runtime confirmations done — ✅ **Read-only protection bypass** (probe: `editableProp=false` yet doc mutated + bold dispatched), ✅ **Page-count stuck** (`counts().pages=1` vs `coords.getPageCount()=2` after a break), ✅ **Mail-merge field codes** (probe: IF exports only its label — condition dropped; ADDRESSBLOCK/GREETINGLINE no switches; `MERGEFIELD First Name` unquoted — *worse* than the archived BUG-008). **Citation multi-author data-loss** = code-confirmed (dialog reads `authors[0]`); **Print/PDF** = Phase-3 (live). Probes: `C:/tmp/bughunt/probes/p2-*.js`. The remaining ~40 `needsRuntime` + 46 `needsLive` findings are unhardened (code-confirmed + adversarially verified).

## P1

### Read-only / editing protection enforcement
- **Area:** Review › Protect
- **Controls (1):** Review › Restrict Editing (read-only leg)
- **Why one feature:** Single highest-risk protection defect: setEditable(false) only gates user DOM input, not the programmatic WC.PM/H[cmd] ribbon write path, so formatting, tr.insertText and addComment still mutate a 'read-only' doc. A spec must add an editable-aware guard at the single document-write seam (bridge/index.ts isBlocked) so ALL programmatic writes are rejected under protection. Coherent, self-contained, and a trust/protection promise that is currently broken.

### Mail-merge field-code export fidelity
- **Area:** Mailings › Write & Insert Fields / Finish
- **Controls (8):** Mailings › Rules (IF/NEXTIF/SKIPIF) · Mailings › Greeting Line · Mailings › Address Block · Mailings › Insert Merge Field (quoting) · Mailings › Finish & Merge (per-record page breaks) · Mailings › Start Mail Merge (mergeType ignored) · Mailings › Select Recipients (CSV BOM) · Mailings › Preview Results (composite resolution)
- **Why one feature:** All of these are one OOXML-correctness problem: dialogs collect parameters that never reach the parameterless bridge verbs, so IF exports human operator labels + literal fields (non-evaluating), ADDRESSBLOCK/GREETINGLINE drop \f/\c/\e/\l switches, MERGEFIELD leaves space-containing names unquoted (truncates columns), Finish&Merge/Directory drop the per-record page break (paged importer can't parse the manual-break div) and ignore mergeType, the CSV import keeps the UTF-8 BOM, and preview won't resolve composite/rule fields. A single spec fixes the field-instruction builders + bridge parameter threading + per-record pageBreakBefore. Wrong-output data path.

### Print & PDF output fidelity (chrome + page geometry)
- **Area:** File/Backstage › Print / Export
- **Controls (5):** File › Print (chrome capture) · File › Export → Create PDF/XPS (chrome capture) · File › Export → PDF page geometry · File › Print pane — settings controls (inert) · File › Print pane — live preview (unpaginated)
- **Why one feature:** Printing/exporting captures the full app chrome (no @media print / @page stylesheet exists) AND hardcodes pageSize:'Letter' + margins:none, so any A4/Legal/Landscape/custom doc exports clipped to portrait Letter with ribbon+statusbar baked in — the printed/PDF artifact is the user's deliverable, so this is effectively data-loss-grade. One spec adds a print stylesheet scoped to .superdoc-page, routes the backstage Copies/Pages/Orientation/Paper settings into the job, drives printToPDF from real section geometry, and paginates the preview.

### Citation source multi-author data loss + placeholders
- **Area:** References › Citations & Bibliography
- **Controls (2):** References › Insert Citation (Add New Source / Add New Placeholder) · References › Manage Sources (Edit/Source Manager)
- **Why one feature:** BUG-047 S2 data loss: the Add Source dialog captures a single author string and Source Manager Edit prefills authors[0] then Object.assign-overwrites the fork's multi-author array, so editing any multi-author source destroys authors 2+. Same surface also stubs Add New Placeholder and lacks the Master/Current two-pane manager. A single spec reworks the author model end-to-end (dialog → buildSourceFields → fork update) to preserve all authors, plus placeholders. Irreversible data loss = top priority.

### Paged page-count accounting (counts().pages)
- **Area:** File/Backstage + Review (shared counts())
- **Controls (3):** File › Info pane — Pages count · File › Properties dialog — Pages row · Review › Word Count — Pages row
- **Why one feature:** io.ts counts() reads w.WC.PM.__pagination.pageCount — the overlay paginator retired in feature 008 — so it always falls back to 1 under the paged engine; the correct value is WC.PM.coords.getPageCount(). One ~one-line routing fix simultaneously repairs the Info pane, Properties dialog and Word Count. Core-broken numeric correctness, already tracked as task_3436e431.

## P2

### Paged view modes & window layout (dead-#editor CSS)
- **Area:** View › Views / Page Movement / Window
- **Controls (5):** View › Web Layout · View › Outline (+ wrong setActiveView('print')) · View › Draft · View › Side to Side · View › Split
- **Why one feature:** Identical root cause from the overlay→paged migration: all view-mode/movement/split CSS still targets the retired #editor id, so Web/Draft/Outline/Side-to-Side/Split produce no visible change in the paged engine (and Outline additionally sets the status bar to 'Print'). One spec re-points the view-mode CSS/engine hooks to #pm-editor/.superdoc-page (or switches the engine layout mode) and fixes the Outline view-state literal. Grouped because they share the fix and the file.

### Floating-object arrange completeness (Position/Align/Wrap/Rotate)
- **Area:** Layout › Arrange
- **Controls (4):** Layout › Position (vertical anchor; More Layout Options) · Layout › Align (10 of 13 items missing; to-Page/Margin; distribute) · Layout › Wrap Text (Edit Wrap Points; Move-with-Text/Fix-Position; More Layout Options) · Layout › Rotate (More Rotation Options arbitrary angle)
- **Why one feature:** The Phase-4/012 frames work shipped the cores but each arrange control exposes only a subset of Word's menu: Position collapses 9 presets to 3 (vertical ignored), Align wires 3 of 13 (no to-Page/Margin, gridlines, multi-object distribute), Wrap omits 4 items (incl. the real Move-with-Text/Fix-Position OOXML toggles), Rotate lacks arbitrary-angle. All are image-only (no shapes/text boxes). One spec extends the arrange bridge verbs + menus + the More-Layout-Options dialog across the group.

### Page-setup & break fidelity
- **Area:** Layout › Page Setup
- **Controls (3):** Layout › Margins (true mirror margins; per-side Custom dialog) · Layout › Size (orientation preserved on paper change) · Layout › Breaks (mid-paragraph split semantics)
- **Why one feature:** Export is faithful for the common case but three Word behaviors diverge: Mirrored writes symmetric lr instead of w:mirrorMargins+inside/outside, choosing a paper size silently forces portrait, and Ctrl+Enter inserts an empty pageBreakBefore paragraph instead of splitting the paragraph at the caret (text after caret should move to the next page). One page-setup spec covers mirror margins, the per-side Custom Margins dialog, orientation preservation, and mid-paragraph split.

### Design galleries collapse to one output (themes/style-set/fonts)
- **Area:** Design › Document Formatting
- **Controls (4):** Design › Themes (heading *Char theme binding) · Design › Fonts (heading *Char theme binding) · Design › Style Set (name→preset map empty) · Design › Themes (active checkmark stuck on Office)
- **Why one feature:** Two real wrong-output bugs that share the redefine-named-styles path: themeUpdates()/redefineNamedStyles never enumerate the linked Heading*Char character styles, so headings keep the old major-font theme binding (body changes, headings don't) for both Themes and Fonts; and Style Set's name→preset map has none of the 9 gallery names, so all 9 produce identical Normal spacing. Plus the cosmetic checkmark stuck on Office (currentDocFont reads an unwritten --doc-font). One Design spec fixes the Char-style stripping, populates the style-set table, and tracks last-applied for the tick.

### References gallery/dialog fidelity (TOC/notes/bibliography/cross-ref)
- **Area:** References (TOC / Footnotes / Citations / Captions / Index)
- **Controls (9):** References › Table of Contents (Auto 1/2 caption dropped; Manual harvests headings) · References › Custom TOC (Tab leader dropped) · References › Insert Footnote (literal 'Footnote' seed) · References › Insert Endnote (literal 'Endnote' seed) · References › Next/Prev Footnote/Endnote (no type filter) · References › Style (pre-bibliography pick lost but toasts success) · References › Bibliography (title dropped; re-insert stacks) · References › Insert Table of Figures (re-insert stacks; no dialog) · References › Cross-reference (pageNumber→\p collides; 2 of 7 types)
- **Why one feature:** The TOC/footnote/citation engines are substantial and the cores work, so this is a fidelity/wrong-output cleanup over one subsystem: drop the literal note seeds that leak into export (BUG-010), wire the Custom-TOC leader + Automatic-Table captions, filter note navigation by type, stop dropping the bibliography title + de-dupe re-inserts (BUG-031/062), persist citation style pre-bibliography, and fix the cross-reference 'page number' field (PAGEREF vs the \p above/below collision — a fork edit). One References fidelity spec.

### References dialog completeness (Mark Entry / Caption / Index / ToA)
- **Area:** References › Index / Captions / Table of Authorities
- **Controls (4):** References › Mark Entry (no dialog; silent no-op without selection) · References › Insert Caption (no Position/New-Label/format; attaches to caret not object) · References › Insert Index (no Insert-Index dialog) · References › Insert Table of Authorities (no ToA dialog)
- **Why one feature:** These fields work mechanically but lack their defining Word dialogs: Mark Entry silently no-ops with no selection and offers no Main/Subentry/cross-ref/page-range/Mark-All (the core of indexing UX), Caption has no position/label-management/format chooser and attaches to the caret not the selected object, and Index/ToA insert with zero options dialog. One spec adds the four reference dialogs on top of the existing field engines.

### Header/footer/page-number gallery surfacing
- **Area:** Insert › Header & Footer
- **Controls (3):** Insert › Header (5 ribbon items collapse to one text dialog) · Insert › Footer (same) · Insert › Page Number (missing Page Margins position + Format Page Numbers)
- **Why one feature:** Header/footer text round-trips (002, Word-COM validated) and page-number inserts a real PAGE field, but the Insert dropdowns collapse Word's 5 gallery items (Built-in gallery / More / Edit / Remove / Save Selection) into a single textarea, and Page Number omits Page-Margins position and Format Page Numbers (numbering format/start-at). One spec surfaces the galleries + the Format Page Numbers dialog over the working bridge. (The freshly-inserted-field-paints-0 issue is a known fork-gated paint gap noted separately.)

### Insert text galleries: Cover Page designs + Date field static option
- **Area:** Insert › Pages / Text
- **Controls (2):** Insert › Cover Page (6 designs collapse to one generic block) · Insert › Date & Time (Update-automatically checkbox ignored)
- **Why one feature:** Two wired-but-wrong inserts: xeCoverPage ignores the chosen design name and always emits the same 3-paragraph stub (all 6 gallery designs identical), and the Date & Time dialog's 'Update automatically' checkbox is never read so it always inserts an updating field instead of a static snapshot when unchecked. One spec gives the 6 cover designs distinct formatted layouts and honors the date checkbox.

### Home font dialog & character-formatting edge cases
- **Area:** Home › Font
- **Controls (5):** Home › Font dialog (Small/All caps, Scale, Spacing, Position no-op + toast) · Home › Font Size combo (silent clamp 8–96) · Home › Increase Font (ceiling at 72) · Home › Underline dropdown (no More Underlines / Underline Color) · Home › Shading (floods paragraph on sub-paragraph selection)
- **Why one feature:** The Font dialog presents Caps/Scale/Spacing/Position controls that update only the preview then drop on OK with a notifyBlocked toast (no w:smallCaps/caps/spacing/position/w emitted) — a lying advanced tab. Grouped with the related character-formatting fidelity bugs: the font-size combo silently clamps typed 8–96 (fork minMax) vs Word 1–1638, Increase-Font ceilings at 72, underline color is unreachable anywhere, and Shading always writes pPr/w:shd (paragraph) even on a sub-paragraph selection where Word applies rPr/w:shd to the run. One Home-font spec restores the advanced-effects export, widens the size clamp, and scopes shading to the selection.

## P3

### Home editing/marks fidelity (Show/Hide, Change Case, Sort, Highlight)
- **Area:** Home › Paragraph / Font / Editing
- **Controls (7):** Home › Show/Hide ¶ (only pilcrow; no space/tab/break marks; paged paint unverified) · Home › Text Highlight Color (full palette instead of 15-keyword set → non-keyword becomes w:shd shading) · Home › Change Case (Sentence-case/toggle edge cases; no Shift+F3 cycle) · Home › Sort (Date sorts numerically not chronologically) · Home › Text Effects Outline (width presets pass currentColor → invalid srgbClr dropped by Word) · Home › Select (Selection Pane only) · Home › Editor pane (shallow proofing depth)
- **Why one feature:** Lower-severity Home fidelity gaps that don't share a single fix but are all 'Home looks right, behaves slightly wrong': Show/Hide draws only the pilcrow (no dots/arrows/break marks, and paged-paint match is unverified), the highlighter uses the full color palette so any non-keyword swatch silently becomes character shading with different semantics, Change-Case has locale-naive toggle + sentence-case regex edge cases and no Shift+F3, Sort treats dates as numbers, and the Text-Effects width presets emit an invalid 'currentColor' outline that Word drops on open. One Home-polish spec.

### Draw tool fidelity & pressed-state
- **Area:** Draw › Pens / Tools / Convert / Insert / Replay
- **Controls (8):** Draw › Drawing toggle (button never latches; menu stuck on 'Start Drawing') · Draw › Pens Gallery (active highlight always first tile; no pen-options flyout) · Draw › Select Objects (ink-only, no marquee/move/resize) · Draw › Lasso Select (ink-only, 60% enclosure heuristic) · Draw › Add Pen (no opacity, no persistence, Action Pen decorative) · Draw › Drawing Canvas (inline rect, not wpc:wpc; ink not grouped) · Draw › Draw with Trackpad (cosmetic toggle) · Draw › Ink Replay (no scrub UI; DOM-order not timestamps)
- **Why one feature:** Ink mode functions but the Draw tab is riddled with wrong pressed-state UI (Drawing/pen-gallery latch reads WC.Draw.pen/.enabled which are never reassigned) and partial tool semantics (Select/Lasso are ink-only with no marquee/move, the Drawing Canvas is a plain inline rect not a real canvas group). One Draw spec fixes the state plumbing (TOGGLE_MAP/state rules + actually setting WC.Draw.pen/.enabled) and rounds out the selection/canvas behavior. Niche surface, hence P3.

### Mailings recipient & job-control UX
- **Area:** Mailings › Preview / Create / Start
- **Controls (6):** Mailings › Go to Record (generic spinner: wrong icon, step 6, 'pt' unit, default 0, no sync-back) · Mailings › Envelopes (manual-break div dropped; no envelope page size) · Mailings › Labels (Full-page checkbox inert; no Avery geometry) · Mailings › Update Labels (stub; propagation now feasible) · Mailings › Edit Recipient List (aliases entry grid; no sort/filter/dedupe) · Mailings › Check for Errors (one-shot vs 3-mode dialog)
- **Why one feature:** The remaining Mailings issues are UX/layout rather than the P1 export-correctness set: the Go-to-Record spinner is mis-rendered by the generic renderSpinner (BUG-021) and never syncs after navigation, Envelopes/Labels lose their page separation/geometry (the manual-break div the paged importer can't parse — same family as Finish&Merge but lower stakes), the inert Full-page-of-same-label checkbox, and Update-Labels/Edit-Recipient-List remain stubs/aliases now mechanically buildable. One Mailings-UX spec.

### View zoom/ruler/navigation approximations
- **Area:** View › Zoom / Show / Immersive
- **Controls (5):** View › One Page (hardcoded 1056px Letter height) · View › Multiple Pages (fixed fit-2; no grid chooser) · View › Ruler (static decorative; no interactive markers; no geometry) · View › Navigation Pane (checkbox never reflects open state; no Pages/Results tabs) · View › Immersive Reader (minimal subset; tooltip over-promises)
- **Why one feature:** Functional-but-approximate View features that share the theme of ignoring real section geometry / lying pressed-state: One Page and Multiple Pages use a hardcoded 1056px page height (wrong for A4/Legal/Landscape), the Ruler is static and non-interactive, the Navigation Pane works but its checkbox never latches and it lacks Pages-thumbnail/search tabs, and Immersive Reader is a small subset of what its tooltip advertises. One View-polish spec drives zoom/ruler from real geometry and fixes the nav-pane latch.

### Word Options & document-default persistence
- **Area:** Design + File/Backstage
- **Controls (4):** File › Options pane (read-only; no editable settings) · Design › Set as Default (pure toast, no persistence) · File › Close (replaces doc with New instead of closing) · File › Recent list (pin / clear-unpinned UI missing; backend half-wired)
- **Why one feature:** A small persistence/settings cluster: Word Options is purely informational (default font/AutoCorrect have real impact but aren't editable), Set-as-Default neither persists nor is read by New Document, File→Close silently does New (semantics wrong, not data-loss since confirmDiscard runs), and the Recent list lacks pin/clear-unpinned UI though the recent:clear backend exists. One spec adds a minimal persistence layer (localStorage/template) + fixes Close semantics.

### Review proofing & markup depth
- **Area:** Review › Proofing / Markup / Comments / Language
- **Controls (7):** Review › Word Count (no selection-scoped count) · Review › Spelling and Grammar (routes to Editor pane; split items identical; no step-through modal) · Review › Thesaurus (~8-word dictionary) · Review › Check Accessibility (Alt Text/Reminder/Options unwired) · Review › Show Markup (Specific People/Highlight Updates/Other Authors stubbed; no multi-author model) · Review › Language (no per-run w:lang) · Review › Show Comments / Filter All Markup / Hide Ink (render-verify + interim routing)
- **Why one feature:** The Review subsystem is substantively built (real local Editor/spell/grammar loop, real track-chrome hide toggles) but shallow vs Word: no selection-scoped word count, the classic step-through Spelling modal is replaced by the Editor pane (and the split's two items are identical), the thesaurus dictionary is tiny, accessibility/markup have unwired split items and no multi-author model, and Language doesn't write per-run w:lang. One Review-depth spec deepens proofing coverage and wires the missing markup/accessibility items.

### Real-object insert subsystems (Shapes/SmartArt/Chart/Signature/OLE/Equation)
- **Area:** Insert › Illustrations / Text / Symbols
- **Controls (9):** Insert › Shapes (full picker, every click is a no-op toast; VectorShape fork ext exists) · Insert › SmartArt (renders 4 layouts, xeSmartArt no-op) · Insert › Chart (dialog computes SVG but xeChart no-op; chart ext render-only) · Insert › Signature Line (dialog → xeSignatureLine no-op) · Insert › Object (Create New OLE no-op; Text from File works) · Insert › Equation (Cambria-Math styled text not m:oMath; Alt+= unwired) · Insert › Table (Convert-Text-to-Table + Excel stubs) · Insert › Pictures (Stock/Online stubs; SVG sizing) · Insert › Online Video (static SVG poster)
- **Why one feature:** These are stubs behind complete-looking pickers — Shapes is the most misleading (full 8-category gallery, zero document change) but a VectorShape fork extension already exists so a real wps:sp path is feasible; SmartArt/Chart/Signature similarly render dialogs over no-op bridge verbs, Equation is a documented styled-text deviation (not real OOXML m:oMath), and OLE/Stock/Online/Convert-Text are host-runtime/cloud stubs. Grouped as the 'make insert objects real' epic; P3 because most need new render/diagram/OLE subsystems and several are honest degrades, but Shapes is the priority within the bucket.

### Honest cloud/ML/runtime degrade stubs (no action)
- **Area:** Cross-tab (Home/Insert/Draw/References/Review/View/File)
- **Controls (7):** Home › Dictate / Sensitivity / Add-ins / Reuse Files · Insert › My Add-ins · Draw › Ink to Shape / Ink to Math · References › Smart Lookup / Researcher · Review › Translate · View › Synchronous Scrolling / Reset Window Position / Switch Windows / Macros · File › Share / Feedback / Info Protect-Inspect-Version History
- **Why one feature:** These are intentional, documented honest-degrade stubs that toast and make no document change — they require cloud services (Translator, Researcher, Smart Lookup, Sharing, Sensitivity/Purview), ML (ink recognition), a VBA runtime (Macros), Office.js (Add-ins), or multi-window/document backends (Switch Windows, Sync Scrolling) that are out of scope for a single-window local clone. Tracked together as a 'known-not-implemented' register so they aren't re-triaged each pass; no spec work expected unless scope changes (notably the stale Dictate/Sensitivity doc claims should be corrected). Includes the lowest-severity S5 items.

