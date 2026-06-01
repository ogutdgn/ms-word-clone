# Design Tab — Feature Status

_Implemented as CSS-variable theming + document overlays. Verified by 9 tests in scripts/test-suite.js (106/106 total pass). Page color / page borders / theme also validated against the real Word COM oracle (`design_probe.ps1`)._

## Document Formatting
- ✅ **Themes** — gallery (Aptos/Office, Office 2013, Berlin, Facet, Ion, Integral); applies heading+body fonts, heading color, and the 6-accent palette via CSS variables
- ✅ **Style Set** — gallery (Default, Basic, Lines, Shaded, Casual, Centered, Word 2010/2013); restyles headings via CSS classes
- ✅ **Colors** — built-in color schemes (Office, Grayscale, Blue Warm, Blue, Red, Green); remaps the accent palette
- ✅ **Fonts** — font pairings (Aptos, Calibri, Arial, Georgia, Times, Garamond, Cambria, Verdana); sets heading+body fonts
- ✅ **Paragraph Spacing** — built-in presets (No Space, Compact, Tight, Open, Relaxed, Double) applied to all paragraphs (before/after pt + line)
- 🟡 **Effects** — theme shape effects are a documented stub (no shape-effect engine)
- ✅ **Set as Default** — stores current theme/spacing as the session default

## Page Background
- ✅ **Watermark** — built-ins (CONFIDENTIAL, DO NOT COPY, DRAFT, SAMPLE, URGENT, ASAP) + Custom (text, color, diagonal); rendered as a repeating semi-transparent SVG overlay per page
- ✅ **Page Color** — fills the page background (validated: real Word `Background.Fill`)
- ✅ **Page Borders** — box border around the page (style/color/width); add + remove (validated: real Word `Sections(1).Borders`)

## Real-Word validation (`design_probe.ps1`)
- ✅ Theme fonts = **Aptos Display / Aptos**; theme accents confirmed (navy `#0E2841`, `#156082`, `#E97132`, …)
- ✅ **Page Borders** scriptable (enabled, single style) — our implementation matches
- ✅ **Page Color** scriptable (`Background.Fill`, e.g. `#CCFFFF` set + read back) — matches
- ⚠️ **Watermark** is a Word building-block (COM `AddTextEffect` anchored to a header threw `0x800A16DA`); implemented as a visual overlay instead and documented.

_Gallery item names/values were cross-checked with web research; exact built-in lists may differ slightly from a specific Word build._
