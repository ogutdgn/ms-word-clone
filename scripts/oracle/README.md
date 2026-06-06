# scripts/oracle/word-oracle.js

macOS Microsoft Word oracle for Phase 2 per-feature fidelity validation.
Uses the **AppleScript object model only** — no GUI/AX scripting; no hyperlink
creation (broken in Word 16.x for Mac and excluded by design).

## Requirements

- Microsoft Word for Mac installed at `/Applications/Microsoft Word.app`.
- macOS with `osascript` available at `/usr/bin/osascript`.
- Node.js (any version that ships `node:child_process` and `node:fs`).
- The **verified installed version** at time of authoring: **16.77.1**.

No npm dependencies. No build step.

## Usage

```bash
# Read paragraph formatting from a .docx file
node scripts/oracle/word-oracle.js read-props <abs-path.docx> [--out report.json]

# Read WORD-level formatting (1-based paraIdx; wordIdx optional — omit for all words)
node scripts/oracle/word-oracle.js read-word-props <abs-path.docx> <paraIdx> [wordIdx] [--out report.json]

# Read paragraph-FORMAT + list formatting (spacing, indents, list type/level/string)
node scripts/oracle/word-oracle.js read-para-props <abs-path.docx> [--out report.json]

# Save-as roundtrip (open in Word, save to new path)
node scripts/oracle/word-oracle.js roundtrip <abs-in.docx> <abs-out.docx>
```

### Why `read-word-props` exists — paragraph reads report "mixed" formatting

Word's per-paragraph properties collapse to **mixed** when runs differ inside the
paragraph: `bold`/`italic` come back `false`, `fontName` comes back `""`, and
`font size` comes back `missing value` (parsed to `null`). A paragraph with one
bold word therefore reports `bold:false` at paragraph level. `read-word-props`
reads `bold of font object of (words i thru i of text object of paragraph p ...)`
— true run-level granularity for per-feature validation.

`--out` is required to have a path argument; omitting the value is a usage error
(exit 2).

### Output path constraint for `roundtrip`

Word for Mac 16.x is sandboxed — `save as` to `/tmp` (or `/private/tmp`) silently
shows a Save sheet dialog and blocks indefinitely, or raises an AppleEvent timeout
error (−1712 "AppleEvent timed out" or −1708 "event not handled").  This is a macOS
TCC/sandbox restriction; Word does not have entitlements for `/private/tmp`.

**Verified working:** project subdirectories under `$HOME` (e.g. the repo checkout).
**Verified failing:** bare `$HOME` root and `/tmp`.

The output path **must be inside the user's home directory**, e.g.:

```bash
node scripts/oracle/word-oracle.js roundtrip \
  "$(pwd)/tests/fixtures/basic-list.docx" \
  "$HOME/Desktop/oracle-out.docx"
```

### `save as` quirk — document is renamed after save

After `save as`, Word renames the open document to the basename of the output path.
The oracle accounts for this: the close-by-name step uses the **output** basename,
not the input basename.

### Open-poll timing

After issuing `open file name`, the oracle polls `count of documents` at **0.5 s
intervals** for up to **20 s** (40 iterations) before accessing the document.  The
poll is relative to the pre-open document count (see PID-safety below).

## JSON shape — `read-props`

```json
{
  "file": "/abs/path/to/doc.docx",
  "generatedBy": "word-oracle read-props",
  "paragraphs": [
    {
      "index": 1,
      "text": "Hello world",
      "bold": false,
      "italic": false,
      "underline": false,
      "underlineRaw": "underline none",
      "fontName": "Aptos",
      "fontSize": 12,
      "alignment": "left"
    }
  ]
}
```

| Field          | Type    | Notes                                                        |
|----------------|---------|--------------------------------------------------------------|
| `index`        | number  | 1-based paragraph index                                      |
| `text`         | string  | Paragraph text (trailing `\r` stripped)                      |
| `bold`         | boolean | AS boolean "true"/"false" → JS boolean                       |
| `italic`       | boolean | Same                                                         |
| `underline`    | boolean | `true` if `underlineRaw` ≠ "underline none"                  |
| `underlineRaw` | string  | Raw WdUnderline enum from Word, e.g. "underline single"      |
| `fontName`     | string  | Font name string                                             |
| `fontSize`     | number  | Points; locale comma separator normalised via parseFloat     |
| `alignment`    | string  | "left", "center", "right", "justify", etc. (prefix stripped) |

## JSON shape — `read-word-props`

```json
{
  "file": "/abs/path/to/doc.docx",
  "generatedBy": "word-oracle read-word-props",
  "paragraph": 1,
  "words": [
    {
      "index": 2,
      "text": "bold ",
      "bold": true,
      "italic": false,
      "underline": false,
      "underlineRaw": "underline none",
      "fontName": "Aptos",
      "fontSize": 12
    }
  ]
}
```

Same field semantics as `read-props`, minus `alignment` (a paragraph property).
Notes:

- `text` **includes the word's trailing space** — that is how Word's `words`
  collection slices ranges.
- The **paragraph mark counts as a trailing empty "word"** (its `text` parses to
  `""` after the `\r` strip) — a 4-word paragraph reports 5 entries when read
  without `wordIdx`.
- Formatting evaluation **ignores trailing whitespace**: a bold word followed by a
  plain space still reports `bold:true`, not mixed.

## JSON shape — `read-para-props`

```json
{
  "file": "/abs/path/to/doc.docx",
  "generatedBy": "word-oracle read-para-props",
  "paragraphs": [
    {
      "index": 4,
      "alignment": "left",
      "lineSpacingRule": "single",
      "lineSpacingRuleRaw": "line space single",
      "lineSpacingPt": 12,
      "spaceBeforePt": 0,
      "spaceAfterPt": 0,
      "leftIndentPt": 36,
      "rightIndentPt": 0,
      "firstLineIndentPt": -18,
      "hangingPt": 18,
      "listType": "bullet",
      "listTypeRaw": "list bullet",
      "listLevelNumber": 1,
      "listString": "",
      "text": "Bullet item"
    }
  ]
}
```

| Field                | Type   | Notes                                                                  |
|----------------------|--------|------------------------------------------------------------------------|
| `index`              | number | 1-based paragraph index                                                |
| `alignment`          | string | Same prefix-stripped enum as `read-props`                              |
| `lineSpacingRule`    | string | Normalized: `single`, `1.5`, `double`, `at least`, `exactly`, `multiple` |
| `lineSpacingRuleRaw` | string | Raw WdLineSpacing enum, e.g. `"line space1 pt5"` (sic) for 1.5         |
| `lineSpacingPt`      | number | **Points, not a multiplier** — double spacing on 12pt text reads 24    |
| `spaceBeforePt`      | number | `space before` in points                                               |
| `spaceAfterPt`       | number | `space after` in points                                                |
| `leftIndentPt`       | number | `paragraph format left indent` in points                               |
| `rightIndentPt`      | number | `paragraph format right indent` in points                              |
| `firstLineIndentPt`  | number | `first line indent` in points; **negative = hanging indent**           |
| `hangingPt`          | number | Convenience: `-firstLineIndentPt` when negative, else 0                |
| `listType`           | string | Normalized (`"list "` prefix stripped): `no numbering`, `bullet`, `simple numbering`, … |
| `listTypeRaw`        | string | Raw WdListType enum, e.g. `"list bullet"`                              |
| `listLevelNumber`    | number | 1-based list level — **returns 1 even for non-list paragraphs**; gate on `listType` |
| `listString`         | string | Default bullet is `""` (Symbol PUA, NOT `"•"`); numbered items e.g. `"1."` |
| `text`               | string | Paragraph text (emitted LAST on the wire — text may contain tabs)      |

Numeric fields pass through the comma-decimal normalisation (`"18,0"` → `18`).

## PID-safety contract

The oracle uses **name-verified, count-relative** PID safety — not ordinal-based:

1. Records `initialCount` of open documents **before** opening ours.
2. Polls on `count of documents > initialCount` so a pre-existing user doc never
   satisfies the poll.
3. After open, reads `name of document 1` and compares it to the expected basename.
   If they do not match, the oracle **aborts without closing anything** — it cannot
   safely identify which document is ours.
4. Closes **by name**: `close document "<basename>" saving no`.
5. Never calls `quit` on Word — the user's own open documents are untouchable.

If Word is not running, osascript launches it automatically; it remains running
afterwards (expected — never quit it).

### Leak-proof close on failure

`read-props` wraps its AppleScript work in a `try ... on error errMsg` block that
**always** closes OUR document before re-raising the error — a true leak-proof
guarantee for the read path.

`roundtrip` also wraps in a `try ... on error` block and **attempts** to close OUR
document before re-raising, but the close is **best-effort**: if both the primary
close-by-output-name and the fallback close-by-input-name miss (e.g. the doc was
never opened, or Word renamed it to something unexpected — see quirk #3 above), a
stray document may remain open.  If you suspect a leak after a failed roundtrip, do
**not** run `tell application "Microsoft Word" to close every document saving no"` —
that will silently discard any documents the user already had open.  Instead, locate
the stray window by hand (check the Word Window menu) and close it from the UI.

## Known limits

- **No hyperlink creation** — `make new hyperlink object` is broken in Word 16.x
  for Mac. Do not add it.
- **No GUI/AX scripting** — System Events process scripting is unreliable against
  Word on macOS and is explicitly excluded.
- **`underlineRaw` enum values** — Word returns strings like `"underline none"`,
  `"underline single"`, `"underline double"`, `"underline words"`, etc. The parsed
  `underline` boolean treats anything ≠ `"underline none"` as underlined.
- **`alignment` enum mapping** — Word returns `"align paragraph left"`,
  `"align paragraph center"`, `"align paragraph right"`,
  `"align paragraph justify"`, etc. The prefix `"align paragraph "` is stripped to
  produce the short form.
- **Output path sandbox** — `save as` to `/tmp` or `/private/tmp` silently blocks
  or raises AppleEvent timeout −1712 (Word for Mac sandboxes access to system
  directories). Use `$HOME` subtrees.  The bare `$HOME` root is also known to fail.

## Dictionary renames discovered during iteration

These are property/command names that differ from naive expectations or differ from
the Windows COM object model. All verified against Word for Mac 16.77.1:

| Expected / Windows name    | Actual AppleScript name            | Notes                                                              |
|---------------------------|------------------------------------|--------------------------------------------------------------------|
| `font`                    | `font object`                      | Property of text object                                            |
| `text` / `text range`     | `text object`                      | Property of paragraph                                              |
| `paragraph format`        | `paragraph format`                 | Correct — same as COM                                              |
| `open POSIX file <alias>` | `open file name "<string>"`        | POSIX file form is async in 16.x; `file name` form + poll is reliable |
| `document "<name>"`       | works for close; use count for poll | By-name lookup works for close after name-verification; poll uses count only |
| `save as d file name ...` | `save as document "<name>" file name ...` | Use name (verified) not ordinal for save as                |
| `format document default` | `format document`                  | `format document` (0x0231000c) is the reliable .docx constant      |
| `/tmp/out.docx`           | `$HOME/Desktop/out.docx`           | Sandbox constraint — /tmp blocked; raises −1712 timeout            |
| `font size` decimal sep   | comma on some locales              | "12,0" not "12.0" — use parseFloat after comma→period replacement  |
| `set wr to words i thru i of tr` | query properties **directly through the specifier** | Assigning a word element range to a variable raises −1728 ("Can't get word 1"); `bold of font object of (words i thru i of text object of paragraph p of d)` works |
| word slicing              | trailing space included; paragraph mark is a trailing empty "word" | `content of (words 2 thru 2 ...)` → `"bold "`; formatting evaluation ignores trailing whitespace (bold word + plain space → `bold:true`, not mixed) |
| `LeftIndent` / `RightIndent` (COM) | `paragraph format left indent` / `paragraph format right indent` | Verified as the COM-heritage names; `first line indent`, `space before`, `space after` keep plain names. Hanging indent = **negative** `first line indent` |
| `wdLineSpace1pt5`         | `line space1 pt5`                  | sic — odd token split, defined that way in Word.sdef `WdLineSpacing`; the getter echoes the same string |
| `LineSpacing` (multiplier?) | points, not a multiplier          | Double spacing on 12pt reads `24,0`; 1.5 reads `18,0` (comma decimal per the font-size row) |
| `set lf to list format of tr` | **works** (binds to a variable)  | Unlike word element ranges — no −1728; `list type` / `list level number` / `list string` all read through the variable |
| `ListString` `"•"`        | `""` (Symbol PUA, cp 61623)  | Word's default bullet is the Symbol-font private-use char, invisible in terminals; numbered items read `"1."` |
| `list level number` of non-list para | returns `1`, not `0`    | Gate on `list type` ≠ `"list no numbering"` before trusting the level |
| `close d` after `save as d ...` | close by the **new** basename | Even a variable-bound doc reference dangles after `save as` renames the document (−1728) — by-name close with the output basename is the only reliable form |
| `.dotfile.docx` open/save | **copy to a normal name first** | Dot-prefixed filenames can hang `open file name`/`save as` indefinitely and wedge the session's file commands afterwards (observed 2026-06-06) |
| long headless sessions    | opens degrade → −1712, then stop | Reads on already-open docs keep working while NEW opens stretch past the 2-min AppleEvent default and eventually never complete; wrap in `with timeout of N seconds`; only a USER relaunch of Word recovers it — never quit Word from a script |

## Per-feature validation protocol

See **spec §8.3** in
`docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`
for the Phase 2 per-feature fidelity validation workflow that uses this oracle.

The expected pattern for a single feature (e.g. bold toggle) is:

1. Apply the feature via the editor under test and export a `.docx`.
2. Run `read-props` on the exported file.
3. Compare the oracle JSON against expected values (bold = true for the target
   paragraph).
4. Optionally run `roundtrip` to confirm Word can open/save the file without
   corruption.
