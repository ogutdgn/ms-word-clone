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
