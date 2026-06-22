# Research — Hyphenation

## Decision 1 — No-fork settings write via an owned upsert into the converter's settings part

**Decision**: write the hyphenation flags into `editor.converter.convertedXml['word/settings.xml']` from a new
owned bridge module `bridge/hyphenation.ts`, upserting `w:autoHyphenation` / `w:hyphenationZone` /
`w:consecutiveHyphenLimit` / `w:doNotHyphenateCaps` under the `w:settings` root (creating the root/part if
absent), exactly the element shapes that `document-api-adapters/document-settings.ts` already reads/writes for
sibling flags (`setUpdateFields`, `setOddEvenHeadersFooters`, `setDefaultTableStyle`). The exporter serializes
`convertedXml` back into `word/settings.xml`.

**Rationale**: the fork has **no** `w:autoHyphenation` translator (grep of `src/renderer/core/superdoc-fork` for
`autoHyphenation`/`hyphenationZone`/`consecutiveHyphenLimit`/`doNotHyphenateCaps` = 0 hits), so there is no
public `editor.doc.*` setter and no node-attr path. The owned-write-into-`convertedXml` pattern is the **same
no-fork mechanism 003 columns used** for the `bodySectPr` `w:cols` write (`editor.converter.bodySectPr`), proven
to persist through export + round-trip. `document-settings.ts` confirms `convertedXml[SETTINGS_PART_PATH]` is the
canonical settings tree and shows the exact upsert shape (find-or-create the `w:settings` root, replace-or-push
the element).

**Alternatives**: (a) `editor.doc.styles.apply` — docDefaults only, wrong scope. (b) a fork edit to add a
hyphenation translator — rejected (Principle I). (c) a public `editor.doc.settings.*` API — none exists for
hyphenation. Rejected.

**SPIKE — RESOLVED (2026-06-22, throwaway probe, 14/14 paged).** NO-FORK and clean. Confirmed:
- `editor.converter.convertedXml['word/settings.xml']` is reachable from the bridge — an xml-js **doc wrapper
  whose root element is `w:settings`** (a blank doc already carries it, 14 existing children). `findSettingsRoot`
  (mirror `document-settings.ts`: `part.name==='w:settings'` else `part.elements.find(name==='w:settings')`)
  resolves the root; create-if-absent works.
- An owned upsert (find-or-replace-or-push, the `document-settings.ts` shape) of
  `<w:autoHyphenation w:val="true"/>` **survives `editor.exportDocx({getUpdatedDocs:true})`** — it appears in
  the exported `word/settings.xml`; flipping to `w:val="false"` **replaces** the element (single tag, no dup).
- The options shapes export too: `w:hyphenationZone w:val="360"`, `w:consecutiveHyphenLimit w:val="2"`,
  `<w:doNotHyphenateCaps/>`.
- Read-back from the tree works (the `getHyphenation` path).
- P3 optional hyphen: an inserted U+00AD survives export as a **literal U+00AD** in `document.xml` (Word reads it
  as a soft hyphen) — no fork edit, a plain `insertContent` text write.

**Caveat (validate in the real probe + COM oracle, not the spike):** the re-import leg was inconclusive in the
spike (`PM.openDocx` wasn't exercised). The mechanism is sound — the importer preserves `settings.xml` into
`convertedXml` (round-trip of unknown settings), so `getHyphenation` reads it back after open — but T007 (open a
saved hyphenated `.docx` → `getHyphenation()`) + the **Word-COM oracle** (real Word reads `AutoHyphenation`) are
the authoritative round-trip proofs. Implement `bridge/hyphenation.ts` operating on the LIVE converter each call
(open/newBlank swaps `convertedXml`), exactly like `columns.ts`'s `bodySectPr`.

## Decision 2 — OOXML element shapes + value mapping

| Setting | OOXML (`settings.xml`) | Word COM read-back | Notes |
|---------|------------------------|--------------------|-------|
| Automatic on/off | `<w:autoHyphenation w:val="true"/>` (false/absent ⇒ off) | `ActiveDocument.AutoHyphenation` | None ⇒ write `w:val="false"` (explicit off, not just omit — clean-clear) |
| Hyphenation zone | `<w:hyphenationZone w:val="N"/>` (twips) | `.HyphenationZone` (points) | inches→twips on write; default 0.25" = 360 twips; written only when set |
| Consecutive-hyphen limit | `<w:consecutiveHyphenLimit w:val="N"/>` | `.ConsecutiveHyphensLimit` | 0 = no limit (Word default); written only when set |
| Hyphenate words in CAPS | `<w:doNotHyphenateCaps/>` present ⇔ **do NOT** hyphenate caps | `.HyphenateCaps` | **inverted**: checkbox OFF ⇒ element present; ON ⇒ element absent |

**Rationale**: matches ECMA-376 + the Word COM object model; the CAPS inversion is the one gotcha (the OOXML
element is the negative of the UI checkbox).

## Decision 3 — Word-COM oracle: a new `validate-hyphenation-win.ps1`

**Decision**: read `ActiveDocument.AutoHyphenation` / `.HyphenationZone` (points) / `.ConsecutiveHyphensLimit` /
`.HyphenateCaps`; PID-safe, `OpenAndRepair:=false`; invoked via `com-validate.js`, wired into
`test:roundtrip:paged` (a new C7 block). XML inspection stays the fast in-probe pre-check. Mirrors 002/003/004.

## Decision 4 — Incremental delivery (P1 → P2 → P3)

P1 = None/Automatic + export + ribbon + oracle (a Word-correct on/off document — the prerequisite). P2 = the
Options dialog (zone / consecutive-limit / hyphenate-CAPS). P3 = Manual (best-effort optional-hyphen insertion).
Each its own verify → `/code-review` → ff-merge-into-`general-done` cycle. Matches the 002/003/004 cadence.

## Decision 5 — In-app rendering = out of scope (export is the guarantee)

The paged engine paints lines but is not expected to break words mid-line with hyphens. Per the feature intent,
the on/off state + the exported settings + Word's read-back are the fidelity guarantee; in-app mid-word
hyphenation is a recorded known-limitation (no overlay, no render work). This keeps 005 a pure
settings-write + ribbon feature — no layout-engine dependency.

## Decision 6 — Manual hyphenation (P3) = best-effort optional hyphens

**Decision**: Manual inserts optional hyphens (U+00AD) into long words (≥ a threshold) in the document body via
the `WC.PM` bridge, so the word can break at a line end and the markers survive the `.docx` round-trip; an honest
toast states what happened. Word's full interactive per-word walkthrough is out of v1. **SPIKE the no-fork
optional-hyphen write** (a PM text transaction inserting U+00AD; confirm it exports as a soft-hyphen / survives);
if unreachable no-fork, record the gap + keep the honest toast.
