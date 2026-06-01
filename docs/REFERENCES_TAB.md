# References Tab — Feature Status

_Verified by 11 tests (127/127 total) + MS Word oracle (`references_probe.ps1`)._

## Table of Contents
- ✅ **Table of Contents** — Automatic/Manual gallery; generates from Heading 1–3 with page numbers (via `pageOfElement`), dotted leaders, clickable to jump
- ✅ **Add Text** — set paragraph TOC level (Level 1–3 / Do Not Show)
- ✅ **Update Table** — regenerates TOC/ToF/Index

## Footnotes
- ✅ **Insert Footnote** — superscript ref + auto-numbered note at the bottom; **Insert Endnote** — roman-numbered note at end; auto-renumber; **Next Footnote**, **Show Notes**

## Citations & Bibliography
- ✅ **Insert Citation** (Add New Source, Placeholder, pick existing), **Manage Sources**, **Style** (APA/MLA/Chicago/IEEE/Harvard), **Bibliography** (References/Works Cited). In-text + bibliography formatted per style.

## Captions
- ✅ **Insert Caption** ("Figure N: …" — format matches real Word), **Insert Table of Figures** (collects captions with page numbers), Cross-reference

## Index
- ✅ **Mark Entry** (tags a term), **Insert Index** (alphabetical with page numbers), **Update Index**

## Table of Authorities / Research
- 🟡 **Table of Authorities** — basic Mark Citation; full ToA approximated
- ❌ **Search (Smart Lookup) / Researcher** — cloud knowledge services, documented stubs

## Real-Word validation (`references_probe.ps1`)
- ✅ Caption format = "Figure 1: A sample figure" — matches
- ✅ Footnotes/Endnotes add successfully (arabic / roman)
- ✅ TOC `TablesOfContents.Add` works (levels 1–3)
- ✅ Index `MarkIndexEntry` adds fields
