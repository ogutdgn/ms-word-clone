# Quickstart — Section Breaks (validation guide)

How to prove feature 006 works end-to-end. From the repo root, on branch `006-section-breaks`.

## Build + the 4 core gates (must stay green)

```bash
WC_LAYOUT=overlay npm run build && npm run test:pm   # 475
npm run build && npm run test:smoke                  # 9
npm run test:roundtrip                               # 27
npm run test:bundle                                  # 4
```

## Paged section-breaks probe (real renderer)

```bash
npm run build && npm run probe:sectionbreaks                  # paged
WC_LAYOUT=overlay npm run build && npm run probe:sectionbreaks  # overlay parity
```

Expected (paged + overlay — the write is export-level, not render):
- baseline single-section doc ⇒ exactly 1 `<w:sectPr>`.
- `insertSectionBreak('nextPage')` ⇒ export carries 2 `<w:sectPr>` (the mid-doc one inside a `<w:pPr>`).
- `insertSectionBreak('continuous'|'evenPage'|'oddPage')` ⇒ the section's `sectPr` carries
  `<w:type w:val="continuous|evenPage|oddPage"/>`.

## Word-COM oracle (dev-box-only)

```bash
npm run test:roundtrip:paged   # builds paged+overlay, then real Word COM read-back (C8)
```

Expected C8: a section-broken doc opens without repair; real Word reads `Sections.Count == 2`; the inserted
section's `SectionStart` matches the type (newPage 2 / continuous 0 / evenPage 3 / oddPage 4); PID-safe.

## In the running app (`npm start`)

Layout → Breaks → Section Breaks → Next Page (or Continuous / Even Page / Odd Page) → save → the `.docx` opens in
Word with two sections starting per the chosen type. (Note: the app does not repaginate at the break in-app —
known limitation; Word paginates on open.)

See [contracts/bridge-verbs.md](contracts/bridge-verbs.md) + [data-model.md](data-model.md) for the verb + OOXML mapping.
