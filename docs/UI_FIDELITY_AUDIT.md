# UI-Outcome Fidelity Audit vs Microsoft Word

This document records the audit that compared **what visibly happens on screen when you
press a ribbon control** in this clone against real Microsoft Word, and the fixes that
followed. (Earlier docs cover that each control *exists* and *runs*; this one is about the
*on-screen outcome* matching Word.)

## Method

A multi-agent workflow audited all **212 controls across 10 tabs**, one agent per tab:

1. For each control, the agent stated Word's real on-screen outcome (document/UI change,
   panes, dialogs, contextual tabs, pressed-state, live preview), then read the clone's
   handler and recorded any **user-visible divergence**.
2. Every flagged divergence was then **adversarially re-verified** by a second agent
   (instructed to refute it) before it reached the fix list.

Result: **81 divergences flagged → 53 confirmed real** (3 high, ~47 medium, low). All 53
were fixed; the suite grew from 162 to **213 passing functional tests** (+ 9/9 docx).

## High-severity fixes (control did nothing visible)

| Control | Before | After |
|---|---|---|
| **Focus** (View) | toggled a class with no CSS — no change | hides all chrome, dark backdrop, centered doc, Esc to exit |
| **Side to Side** (View) | class toggle + toast only | pages lay out horizontally (book-style), horizontal scroll |
| **Read Mode** (View) | only a box-shadow tweak | full-screen reading overlay: slim File/Tools/View bar, two-column reflow, page-turn arrows |

## Medium/low fixes by tab

- **Home** — Find split menu (Find / Advanced Find / Go To); Shading main face uses
  last-used color (none on a fresh doc, not hardcoded yellow); Borders main face applies
  the last-used edge (default Bottom); Sort opens a Sort Text dialog; Select menu gains
  Select Objects / Similar Formatting / Selection Pane; Show/Hide ¶ reflects pressed state;
  Styles gallery live-previews on hover.
- **Insert** — Table menu gains Excel Spreadsheet + real Draw Table (drag to draw) + Quick
  Tables submenu; **Header/Footer editing reveals a real "Header & Footer" contextual tab**
  (tinted, with Navigation/Options/Close groups) and dims the body.
- **Draw** — Eraser menu adds Stroke + Segment Eraser; Add Pen offers pen types; **pens
  render as inline ribbon tiles**; Lasso Select draws a real loop and selects strokes
  inside it; Ink Replay animates the strokes being redrawn.
- **Design** — Themes/Style Set/Colors/Fonts/Paragraph Spacing **live-preview on hover** and
  show the active choice; Style Set is a thumbnail gallery; paragraph-spacing labels lost
  their debug suffixes; Effects opens a real effects gallery; Watermark is grouped
  (Confidential/Disclaimers/Urgent) thumbnails.
- **Layout** — Breaks flyout (Page/Column/Section, wired) + Ctrl+Enter; Margins adds
  Mirrored/Office-2003/Custom; Page Size adds A3/Tabloid/Executive/More; Columns adds
  Left/Right/More Columns; Align adds Top/Middle/Bottom + Distribute + Align-to;
  Bring Forward/Send Backward split menus (to Front/Back); Hyphenation Manual is distinct.
- **References** — Citation style list corrected (APA/Chicago/IEEE/ISO 690/MLA/Turabian) and
  changing it re-renders all in-text citations + bibliography; Mark Citation opens a real
  dialog; Table of Authorities builds a real grouped table; Custom Table of Contents dialog;
  Next Footnote split menu (Next/Prev Footnote/Endnote).
- **Mailings** — Insert Address Block / Greeting Line dialogs with format options + recipient
  preview; Envelopes "Add to Document" prepends (no longer replaces the document); Labels
  "New Document" opens a genuine new document; Match Fields mapping dialog; Update Labels
  propagates the first cell with «Next Record».
- **Review** — Show Markup is a stateful checkable menu wired to display state; Read Aloud
  shows a floating playback toolbar (play/pause, prev/next, speed, voice); Editor pane runs
  a real spelling pass with suggestions and Change/Ignore; Language opens a proofing-language
  dialog; Combine is distinct from Compare.
- **View** — (the 3 high fixes above); Page color "No Color" resets the page to white.
- **Help** — Feedback opens a Backstage Feedback page (like/dislike/suggestion); Show
  Training opens a right-docked Help task pane.

## Known approximations

A few outcomes are faithful in shape but limited by the single-`contenteditable`
architecture: asymmetric column widths (Left/Right) and asymmetric page margins (Mirrored)
render with the dominant value; Side-to-Side paging is a CSS-column approximation; the
spelling pass uses a built-in common-misspellings dictionary, not a full dictionary. See
`docs/NOT_IMPLEMENTED.md` for features that require a cloud/host runtime.
