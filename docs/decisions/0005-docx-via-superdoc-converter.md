# ADR-0005 — `.docx` import + export via SuperDoc's bidirectional converter

- **Status:** Locked — **spike GREEN (2026-06-03)** → see
  [spike results](../research/2026-06-03-spike-superdoc-fork.md). `Editor.loadXmlData()` +
  `editor.exportDocx()` round-trip real `.docx` headless; structure stable across 3 fixtures.
- **Date:** 2026-06-03

## Context
A faithful Word clone needs **round-trip integrity**: open a real `.docx` → edit → save, and
it stays a faithful Word document (sections, styles, headers/footers, fields, track changes,
comments intact). The `.docx` problem splits into two halves of very different difficulty:
- **Export (save):** *solvable with libraries.* `dolanmiu/docx` (MIT, browser+Node via JSZip,
  which we already ship) can emit every construct we need (sections, headers/footers, styles,
  numbering, tables, fields/TOC, comments, track changes).
- **Import (open):** *the hard, unsolved-except-by-SuperDoc half.* `mammoth` is lossy by design
  (`.docx → semantic HTML`, discards sections/styles/headers/fields/track-changes/comments).
  The only capable open-source structural importer is SuperDoc's.

## Decision
Use **SuperDoc's `super-converter`** (forked, per ADR-0003) for **both** directions of the
`.docx` pipeline. Because the converter is bound to SuperDoc's schema (ADR-0003), this is the
same fork — one schema, symmetric round-trip, no asymmetric mammoth/dolanmiu split.

## Options considered
- **Asymmetric: `dolanmiu/docx` export + `mammoth` import.** *Rejected as the default:* export
  is fine, but `mammoth` import is lossy by design → round-trip loses exactly the constructs
  that make it a Word document. Acceptable *only* if faithfully opening complex real-world
  `.docx` is **not** a core requirement (it is).
- **Build our own bidirectional converter.** *Rejected:* the 90k-LOC correctness/test-coverage
  problem (ADR-0003).
- **SuperDoc's bidirectional converter (forked). CHOSEN.**

## Rationale
Round-trip integrity is a hard requirement for a faithful Word RL environment (tasks include
opening real documents; the verifier must see/grade their full structure). Only SuperDoc's
converter provides capable, local, bidirectional OOXML↔model conversion. `dolanmiu/docx`
remains the documented **fallback export engine** if we are ever forced back to a minimal
bare-PM core (ADR-0003 fallback).

## Edge cases & risks
- **Export needs live editor instances** (esp. headers/footers) — the save path + headless
  verifier must instantiate the (forked) Editor; confirm in the spike.
- **Per-construct round-trip tests are mandatory** — open A → save → reopen → assert equal, per
  feature (paragraphs/styles, lists, tables, sections, headers/footers, fields, track changes,
  comments), validated against the macOS Word AppleScript oracle.
- **Faked-pagination spacers must never be serialized** — renderer-only artifacts stripped
  before emit (the existing app already strips `.wc-page-gap`/`.wc-gap-band`).
- **Rebuild-not-patch export** can normalize/drop unmodeled XML — fidelity relies on passthrough
  + the handler set; round-trip is excellent but not byte-identical. Track diffs.

## Consequences
- The `.docx` layer is the forked converter; `mammoth`/`html-to-docx` (current pipeline) are
  retired once the fork is in place.
- Gold task documents are minted **offline** with the real-Word oracle and checked into task
  fixtures; the verifier never calls Word at runtime (fast, reproducible, OS-independent).

## Related
- ADR-0003 (the fork), ADR-0001 (why round-trip matters), research:
  [`../research/opensource-deepdive/03-ooxml-save-and-load.md`](../research/opensource-deepdive/03-ooxml-save-and-load.md).
