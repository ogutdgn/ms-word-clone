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

# Save-as roundtrip (open in Word, save to new path)
node scripts/oracle/word-oracle.js roundtrip <abs-in.docx> <abs-out.docx>
```

### Output path constraint for `roundtrip`

Word for Mac 16.x is sandboxed — `save as` to `/tmp` (or `/private/tmp`) silently
shows a Save sheet dialog and blocks indefinitely. The output path **must be inside
the user's home directory**, e.g.:

```bash
node scripts/oracle/word-oracle.js roundtrip \
  "$(pwd)/tests/fixtures/basic-list.docx" \
  "$HOME/Desktop/oracle-out.docx"
```

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

| Field          | Type    | Notes                                                   |
|----------------|---------|--------------------------------------------------------|
| `index`        | number  | 1-based paragraph index                                 |
| `text`         | string  | Paragraph text (trailing `\r` stripped)                 |
| `bold`         | boolean | AS boolean "true"/"false" → JS boolean                  |
| `italic`       | boolean | Same                                                    |
| `underline`    | boolean | `true` if `underlineRaw` ≠ "underline none"             |
| `underlineRaw` | string  | Raw WdUnderline enum from Word (see Alignment section)  |
| `fontName`     | string  | Font name string                                        |
| `fontSize`     | number  | Points; locale comma separator normalised via parseFloat|
| `alignment`    | string  | "left", "center", "right", "justify", etc.              |

## PID-safety contract

- This harness **only closes documents it opened**, identified by name, using
  `close document 1 saving no` immediately after each operation.
- It **never calls `quit`** on Word — the user's own open documents are untouchable.
- If Word is not running, it will be launched automatically by osascript; it will
  remain running afterwards (as expected — never quit it).

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
  `"align paragraph justify"`, etc. The prefix `"align paragraph "` is stripped.
- **Output path sandbox** — `save as` to `/tmp` or `/private/tmp` silently blocks
  (Word for Mac sandboxes access to system directories). Use `$HOME` subtrees.

## Dictionary renames discovered during iteration

These are property/command names that differ from naive expectations or differ from
the Windows COM object model. All verified against Word for Mac 16.77.1:

| Expected / Windows name    | Actual AppleScript name      | Notes                              |
|---------------------------|------------------------------|------------------------------------|
| `font`                    | `font object`                | Property of text object            |
| `text` / `text range`     | `text object`                | Property of paragraph              |
| `paragraph format`        | `paragraph format`           | Correct — same as COM              |
| `open POSIX file <alias>` | `open file name "<string>"`  | POSIX file form is async in 16.x   |
| `document "<name>"`       | `document 1`                 | By-name lookup raises spurious errors in some execution contexts; use ordinal form |
| `close d`                 | `close document 1`           | Variable reference after loop causes "Can't get document" error; use ordinal  |
| `save as d file name ...` | `save as document 1 file name ...` | Same — use ordinal form       |
| `format document default` | `format document`            | `format document` (0x0231000c) is the reliable .docx constant |
| `/tmp/out.docx`           | `$HOME/Desktop/out.docx`     | Sandbox constraint — /tmp blocked  |
| `font size` decimal sep   | comma on some locales        | "12,0" not "12.0" — use parseFloat after comma→period replacement |

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
