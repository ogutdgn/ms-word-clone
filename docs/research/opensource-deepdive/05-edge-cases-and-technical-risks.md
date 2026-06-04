# 05 — Edge cases & technical risks

Consolidated technical edge cases surfaced by the deep-dive, ordered roughly by severity. These
should gate the decision and seed the de-risking spikes.

## A. Model / migration
1. **Silent feature loss on DOM→PM import (the dominant risk).** PM enforces a strict schema and
   normalizes/drops anything not modeled (`parseHTML` strips unknown spans/inline styles/partial
   pasted HTML). Any feature whose DOM shape lacks a `parseDOM/toDOM` rule **vanishes silently**.
   *Mitigation:* `parseDOM/toDOM` for every existing feature + a shadow-model parity diff before
   each cut-over.
2. **execCommand leniency vs PM strictness.** Today's contenteditable tolerates arbitrary nested
   spans/stray styles; PM rejects/normalizes them. Good for determinism/verification, but a
   **behavioral-fidelity risk** vs "as close to Word as possible" — re-test interaction behaviors.
3. **Side-channel state leaks across episodes.** `lastFontColor`, `WC.Ref.sources`,
   `WC.Layout.lineMode`, `WC.Mail`, `WC.Review.trackOn` live in module singletons and are **not
   reset by `setHTML`** → cross-episode contamination of RL trajectories. Must become resettable
   env-state and be in the verifier's view.
4. **No-bundler convention must end.** PM/TipTap are ESM packages; importing them forces
   `electron-vite` + a build step (a structural change to the project) and TypeScript adoption.

## B. Logger
5. **`appendTransaction` / plugin-generated Steps.** Plugins (track changes, list numbering,
   pagination repair) **append Steps** so the *effective* transaction differs from the input one.
   A naive logger that captures only the input `tr` misses plugin deltas → wrong `(s,a,s')`.
   *Mitigation:* capture appended transactions too (TipTap exposes `appendedTransactions`; PM tags
   them `meta:'appendedTransaction'`).
6. **Typing/keyboard/menu actions bypass the command layer.** Even with PM, classify each
   transaction's origin (semantic tool via `tr.setMeta(actorKey,…)` vs pixel/native input vs IME)
   so the trajectory attributes actions correctly.
7. **Non-doc randomness.** TipTap `Editor.instanceId` uses `Math.random`; key the logger on
   doc/Step content + a seeded id, never on instance ids.

## C. Verifier / determinism
8. **JSON is not byte-deterministic.** `doc.toJSON()` must be canonicalized (RFC-8785 JCS, sorted
   keys) before SHA-256 or hashes won't match across runs.
9. **Pagination determinism hinges on FONT METRICS, not the algorithm.** SuperDoc's `layoutDocument`
   is pure, but `measures` come from Canvas `measureText` + `actualBoundingBox*`, which depend on
   host fonts/rasterizer. Page-break rewards are non-reproducible unless we run "deterministic" mode
   (pinned font stack, 0.1px rounding) **and** ship/pin the exact fonts. *(Same conclusion as our
   determinism research.)*
10. **Canvas metrics ≠ Word/embedded-font metrics.** Even pinned, Canvas substitutes a fallback font
    family; line widths/counts/page breaks won't be byte-identical to real Word — a **fidelity
    ceiling** for "looks exactly like Word" *at the page-break level*. Gate with an oracle diff.
11. **Layout convergence can truncate.** PAGE/NUMPAGES fields resolve via a max-3-iteration fixpoint
    that may stop unconverged → pin `maxIterations`/feature flags for reproducibility.
12. **Header/footer height is measured by live DOM (rAF + `offsetHeight`).** Async, timing-sensitive,
    DOM-dependent → harder to make headless/deterministic; needs an explicit "rendered" handshake.

## D. Word constructs with ZERO native PM support (each = custom build)
13. Pagination/page sheets, sections, headers/footers, page/section breaks, named styles,
    fields/TOC/page-numbers, track changes, comments, footnotes. Tables/lists are the easy 20%;
    **these dominate the cost** and several are already implemented in our DOM today (regression risk).
14. **Lists model fork.** Word/OOXML/SuperDoc model lists as **paragraph + `numId`/`ilvl`**, not PM
    nested `list_item` nodes. Choosing PM nested lists eases authoring but complicates OOXML
    round-trip and Word-exact numbering; choosing the paragraph+`numId` model eases fidelity but
    rewrites our list UI/commands. **Decision required.**

## E. `.docx` pipeline
15. **No MIT importer.** `dolanmiu/docx` + `prosemirror-docx` are emit-only → asymmetric save/load
    with no shared schema → **per-construct round-trip tests mandatory**.
16. **Default serializer drops our shipped features** (headers/footers, sections, fields/TOC,
    comments, track changes) → each needs a custom serializer or it silently disappears from `.docx`.
17. **Strip faked-pagination spacers before emit** (renderer-only artifacts must never reach the file).

## F. SuperDoc-specific (if ever reconsidered)
18. **AGPL-3.0** triggers on distribution AND network use → blocks proprietary desktop + hosted
    eval harness without a commercial license.
19. **Imposes Vue + DomPainter renderer** → conflicts with the Word-identical contenteditable UI.
20. **Raw PM Step access is `@deprecated`/slated for removal** → unstable foundation for our logger.
21. **Internal packages are `private:true`** → can't cherry-pick the converter/layout-engine as a
    supported dependency; the converter is deeply coupled to its extension schema + `@superdoc/*`
    siblings + live Editor instances (header/footer export).

## De-risking spikes (run before committing)
- **S1 — Step logging:** `dispatchTransaction` captures `tr.steps.toJSON()` incl. appended Steps,
  end-to-end into JSONL.
- **S2 — Headless verifier:** replay logged Steps onto `EditorState.fromJSON` in Node; assert over
  the tree; canonical-hash the doc.
- **S3 — Pagination plugin:** reproduce one Word page sheet from the model via decorations; diff
  page breaks vs the macOS Word oracle (quantify the Canvas-vs-Word gap).
- **S4 — `.docx` emit:** one section + header/footer + one tracked change + one comment via
  `dolanmiu/docx`; round-trip test. Sizes the bespoke serializer.

**If S1–S4 pass cleanly, the architecture is validated. If S3's oracle diff is large or S4 balloons,
re-open the SuperDoc-commercial-license question for the model/verifier layer.**
