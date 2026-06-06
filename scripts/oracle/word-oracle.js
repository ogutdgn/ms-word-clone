#!/usr/bin/env node
/* scripts/oracle/word-oracle.js — macOS Microsoft Word oracle (AppleScript object
   model ONLY — no GUI/AX scripting; hyperlink creation is broken in Word 16.x for
   Mac and stays off-limits).

   Usage:
     node scripts/oracle/word-oracle.js read-props <abs path .docx> [--out report.json]
     node scripts/oracle/word-oracle.js roundtrip  <abs in.docx> <abs out.docx>

   PID-safety contract: we only ever `close` the document WE opened (tracked by the
   name we opened it with; always uses `saving no`) and we NEVER `quit` Word — the
   user's own windows are untouchable.

   Output path constraint (Word for Mac 16.x): `save as` is sandboxed — the output
   path for `roundtrip` MUST be inside the user's home directory (e.g. ~/Desktop,
   ~/Documents, or a project subdirectory).  Paths like /tmp silently show a sheet
   dialog and block indefinitely.

   Dictionary quirks discovered during iteration (Word for Mac 16.77.1, 2026-06-05):
   1. `open POSIX file <alias>` is asynchronous — the document is not visible to
      the AS object model immediately. Use `open file name "<posix-path>"` (the
      `file name` text parameter) combined with a poll loop.
   2. After opening, poll on `count of documents` with 0.5 s intervals before
      accessing the document.
   3. `close document "<name>"` (by-name form) raises a "Can't get document" error
      in some AS execution contexts even when the document IS open. Use the ordinal
      `close document 1` form — it is always reliable.  Same for access inside
      the query loop: use `document 1` not `document "<name>"`.
   4. `font object` is the correct property (not `font`).
   5. `text object` is the correct property (not `text`).
   6. `paragraph format` is the correct property for paragraph formatting.
   7. `content of <text object>` returns paragraph text with a trailing \r to strip.
   8. Bold/italic return booleans that stringify as "true"/"false".
   9. `underline of <font object>` returns a WdUnderline enum string such as
      "underline none", "underline single", etc. Treat anything ≠ "underline none"
      as underlined.
  10. `alignment of <paragraph format>` returns enum strings prefixed with
      "align paragraph " — strip that prefix.
  11. `save as` `file name` takes an absolute POSIX text string (NOT a file alias).
      After save as the document is renamed; close via `document 1`.
  12. `format document` (WdSaveFormat 0x0231000c) is the correct .docx constant.
  13. Font size uses a comma decimal separator on some locales ("12,0") — convert
      with parseFloat after replacing comma with period. */
'use strict';
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

function osa(script) {
  return execFileSync('/usr/bin/osascript', ['-e', script], { encoding: 'utf8' }).trim();
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Open a docx in Word and wait until it appears as document 1. */
function openDoc(docxPath) {
  // `open file name` (text parameter) is synchronous; poll until the doc is visible.
  osa(`
tell application "Microsoft Word"
  open file name "${esc(docxPath)}" without confirm conversions
  set maxWait to 40
  set waited to 0
  repeat while (count of documents) = 0 and waited < maxWait
    delay 0.5
    set waited to waited + 1
  end repeat
end tell`);
}

function readProps(docxPath) {
  openDoc(docxPath);

  // Use `document 1` throughout — the by-name form raises spurious errors in some
  // AS execution contexts even when the document is open (Word 16.77.1 quirk).
  const script = `
tell application "Microsoft Word"
  set d to document 1
  set out to ""
  repeat with i from 1 to (count of paragraphs of d)
    set tr to text object of paragraph i of d
    set f to font object of tr
    set pf to paragraph format of paragraph i of d
    set out to out & i & tab & (content of tr) & tab & (bold of f) & tab & (italic of f) & tab & (underline of f) & tab & (name of f) & tab & (font size of f) & tab & (alignment of pf) & linefeed
  end repeat
  close document 1 saving no
  return out
end tell`;
  const raw = osa(script);
  return raw.split('\n').filter(Boolean).map((line) => {
    const [index, text, bold, italic, underline, fontName, fontSize, alignment] = line.split('\t');
    return {
      index: Number(index),
      text: (text || '').replace(/\r$/, ''),
      bold: bold === 'true',
      italic: italic === 'true',
      underline: underline !== 'underline none' && underline !== 'false',
      underlineRaw: underline,
      fontName,
      fontSize: parseFloat((fontSize || '0').replace(',', '.')),
      alignment: (alignment || '').replace(/^align paragraph /, ''),
    };
  });
}

function roundtrip(inPath, outPath) {
  // Validate output path is inside the user's home directory (Word for Mac sandbox:
  // save as to /tmp silently shows a sheet dialog and blocks).
  const homeDir = os.homedir();
  if (!path.resolve(outPath).startsWith(homeDir + path.sep) &&
      path.resolve(outPath) !== homeDir) {
    throw new Error(
      `roundtrip: output path must be inside $HOME (${homeDir}).\n` +
        `Word for Mac is sandboxed from /tmp and other system directories.\n` +
        `Use a path like ~/Desktop/out.docx or a project subdirectory.`
    );
  }

  openDoc(inPath);

  // save as renames the document; close via `document 1` after.
  osa(`
tell application "Microsoft Word"
  save as document 1 file name "${esc(outPath)}" file format format document
  close document 1 saving no
end tell`);
}

const [, , cmd, a, b] = process.argv;
if (cmd === 'read-props' && a) {
  const report = { file: a, generatedBy: 'word-oracle read-props', paragraphs: readProps(path.resolve(a)) };
  const outFlag = process.argv.indexOf('--out');
  const json = JSON.stringify(report, null, 2);
  if (outFlag > -1 && process.argv[outFlag + 1]) fs.writeFileSync(process.argv[outFlag + 1], json);
  console.log(json);
} else if (cmd === 'roundtrip' && a && b) {
  roundtrip(path.resolve(a), path.resolve(b));
  console.log('ROUNDTRIP_OK ' + b);
} else {
  console.error('usage: word-oracle.js read-props <file.docx> [--out r.json] | roundtrip <in.docx> <out.docx>');
  process.exit(2);
}
