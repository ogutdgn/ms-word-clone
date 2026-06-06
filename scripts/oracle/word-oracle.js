#!/usr/bin/env node
/* scripts/oracle/word-oracle.js — macOS Microsoft Word oracle (AppleScript object
   model ONLY — no GUI/AX scripting; hyperlink creation is broken in Word 16.x for
   Mac and stays off-limits).

   Usage:
     node scripts/oracle/word-oracle.js read-props <abs path .docx> [--out report.json]
     node scripts/oracle/word-oracle.js read-word-props <abs path .docx> <paraIdx> [wordIdx] [--out report.json]
     node scripts/oracle/word-oracle.js roundtrip  <abs in.docx> <abs out.docx>

   PID-safety contract (name-verified, not ordinal):
   - Before opening, we record `initialCount` of open documents.
   - We poll on `count of documents > initialCount` so a pre-existing user doc
     never satisfies the poll.
   - After open, we verify `name of document 1` equals the basename we just opened.
     If it does NOT match, we abort without closing ANYTHING (could be a user doc).
   - We close OUR document by NAME: `close document "<basename>" saving no`.
   - We NEVER call `quit` on Word.

   Output path constraint (Word for Mac 16.x): `save as` is sandboxed — the output
   path for `roundtrip` MUST be inside the user's home directory (e.g. ~/Desktop,
   ~/Documents, or a project subdirectory).  Paths like /tmp silently show a sheet
   dialog and block indefinitely.  This is a macOS TCC/sandbox restriction; /tmp
   resolves to /private/tmp which is outside the Word sandbox.
   Verified working: project subdirectories under $HOME.
   Verified failing: bare $HOME root and /tmp — Word shows a Save sheet or hangs
   with AppleEvent timeout −1712 (can't complete in time) or −1708 (handler not
   found).

   Dictionary quirks discovered during iteration (Word for Mac 16.77.1, 2026-06-05):
   1. `open POSIX file <alias>` is asynchronous — the document is not visible to
      the AS object model immediately. Use `open file name "<posix-path>"` (the
      `file name` text parameter) combined with a poll loop.
   2. After opening, poll on `count of documents > initialCount` at 0.5 s intervals,
      up to 20 s (40 × 0.5 s), before accessing the document.
   3. `close document "<name>"` (by-name form) raises a "Can't get document" error
      in some AS execution contexts even when the document IS open. However, for the
      close operation (after our name-verification check) we use it deliberately and
      it works reliably in that context.  During the poll loop use `count of documents`
      only (no document access by name or ordinal).
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
      After `save as` Word renames the document to the new basename; we then close by
      the NEW name (the basename of outPath).
  12. `format document` (WdSaveFormat 0x0231000c) is the correct .docx constant.
  13. Font size uses a comma decimal separator on some locales ("12,0") — convert
      with parseFloat after replacing comma with period.
  14. Word element ranges (`words i thru i of <text range>`) CANNOT be assigned to
      a variable — `set wr to words i thru i of tr` raises -1728 ("Can't get word
      1"). Query properties DIRECTLY through the full specifier instead:
      `bold of font object of (words i thru i of text object of paragraph p of d)`.
  15. `content of (words i thru i ...)` includes the word's trailing space, and the
      paragraph mark counts as a trailing "word" (content "\r"). Range formatting
      evaluation ignores trailing whitespace — a bold word + plain trailing space
      still reports bold=true (NOT "mixed"/missing value). */
'use strict';
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

function osa(script) {
  return execFileSync('/usr/bin/osascript', ['-e', script], { encoding: 'utf8' }).trim();
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Open a docx in Word and wait until it appears, then verify it is OUR doc.
 * Returns the basename Word assigned to the document (same as path.basename(docxPath)
 * for a fresh open).
 *
 * PID-safety: records initialCount BEFORE open; polls count > initialCount so a
 * user's already-open doc never satisfies the poll; verifies name after open.
 */
function openDoc(docxPath) {
  const basename = path.basename(docxPath);

  // Step 1: record how many docs are already open.
  const initialCount = Number(osa(`tell application "Microsoft Word" to count of documents`));

  // Step 2: open our file.
  osa(`tell application "Microsoft Word" to open file name "${esc(docxPath)}" without confirm conversions`);

  // Step 3: poll until count increases beyond the pre-open count (max 20 s).
  osa(`
tell application "Microsoft Word"
  set maxWait to 40
  set waited to 0
  repeat while (count of documents) <= ${initialCount} and waited < maxWait
    delay 0.5
    set waited to waited + 1
  end repeat
end tell`);

  // Step 4: verify that the document at the top of the stack is really ours.
  const openedName = osa(`tell application "Microsoft Word" to get name of document 1`);
  if (openedName !== basename) {
    throw new Error(
      `openDoc: safety abort — document 1 is "${openedName}", expected "${basename}".\n` +
      `We will NOT close anything. Check that no other document opened concurrently.`
    );
  }

  return basename;
}

function readProps(docxPath) {
  const basename = openDoc(docxPath);

  // Collect paragraph data, then close OUR doc by name inside a single AppleScript
  // try/on error block so the close always runs even if the query throws or times out.
  const script = `
tell application "Microsoft Word"
  set out to ""
  try
    set d to document "${esc(basename)}"
    repeat with i from 1 to (count of paragraphs of d)
      set tr to text object of paragraph i of d
      set f to font object of tr
      set pf to paragraph format of paragraph i of d
      set out to out & i & tab & (content of tr) & tab & (bold of f) & tab & (italic of f) & tab & (underline of f) & tab & (name of f) & tab & (font size of f) & tab & (alignment of pf) & linefeed
    end repeat
  on error errMsg
    close document "${esc(basename)}" saving no
    error errMsg
  end try
  close document "${esc(basename)}" saving no
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

/**
 * Word-level formatting read — needed because Word reports per-PARAGRAPH props as
 * "mixed" (bold=false, empty fontName, missing-value fontSize) when a paragraph
 * mixes runs. paraIdx is 1-based; wordIdx is 1-based and optional (omitted = all
 * words of the paragraph, including the trailing paragraph-mark "word").
 *
 * Dictionary quirk #14: word element ranges cannot be `set` to a variable — every
 * property is queried directly through the full specifier.
 */
function readWordProps(docxPath, paraIdx, wordIdx) {
  const basename = openDoc(docxPath);
  const p = Number(paraIdx);
  const range = wordIdx
    ? `set firstW to ${Number(wordIdx)}\n    set lastW to ${Number(wordIdx)}`
    : `set firstW to 1\n    set lastW to (count of words of text object of paragraph ${p} of d)`;
  const spec = (prop) =>
    `(${prop} of font object of (words i thru i of text object of paragraph ${p} of d))`;
  const script = `
tell application "Microsoft Word"
  set out to ""
  try
    set d to document "${esc(basename)}"
    ${range}
    repeat with i from firstW to lastW
      set out to out & i & tab & (content of (words i thru i of text object of paragraph ${p} of d)) & tab & ${spec('bold')} & tab & ${spec('italic')} & tab & ${spec('underline')} & tab & ${spec('name')} & tab & ${spec('font size')} & linefeed
    end repeat
  on error errMsg
    close document "${esc(basename)}" saving no
    error errMsg
  end try
  close document "${esc(basename)}" saving no
  return out
end tell`;
  const raw = osa(script);
  return raw.split('\n').filter(Boolean).map((line) => {
    const [index, text, bold, italic, underline, fontName, fontSize] = line.split('\t');
    return {
      index: Number(index),
      text: (text || '').replace(/\r$/, ''),
      bold: bold === 'true',
      italic: italic === 'true',
      underline: underline !== 'underline none' && underline !== 'false',
      underlineRaw: underline,
      fontName,
      fontSize: parseFloat((fontSize || '0').replace(',', '.')),
    };
  });
}

function roundtrip(inPath, outPath) {
  // Validate output path is inside the user's home directory (Word for Mac sandbox:
  // save as to /tmp silently shows a sheet dialog and blocks indefinitely, or raises
  // AppleEvent timeout −1712).
  const homeDir = os.homedir();
  if (!path.resolve(outPath).startsWith(homeDir + path.sep) &&
      path.resolve(outPath) !== homeDir) {
    throw new Error(
      `roundtrip: output path must be inside $HOME (${homeDir}).\n` +
        `Word for Mac is sandboxed from /tmp and other system directories.\n` +
        `Use a path like ~/Desktop/out.docx or a project subdirectory.`
    );
  }

  const inBasename = openDoc(inPath);
  // After `save as`, Word renames the document to the new basename.
  const outBasename = path.basename(outPath);

  // save as, then close OUR doc by name inside try/on error so close always runs.
  // After save as the doc is known by outBasename, so we close by that name.
  osa(`
tell application "Microsoft Word"
  try
    save as document "${esc(inBasename)}" file name "${esc(outPath)}" file format format document
  on error errMsg
    -- save as failed; try to close whichever name the doc still has.
    -- First attempt the original name (save as may not have renamed it).
    try
      close document "${esc(inBasename)}" saving no
    on error
      try
        close document "${esc(outBasename)}" saving no
      end try
    end try
    error errMsg
  end try
  close document "${esc(outBasename)}" saving no
end tell`);
}

const [, , cmd, a, b, c] = process.argv;
const outFlag = process.argv.indexOf('--out');
if (outFlag > -1 && !process.argv[outFlag + 1]) {
  console.error('usage error: --out requires a path argument');
  process.exit(2);
}
function emit(report) {
  const json = JSON.stringify(report, null, 2);
  if (outFlag > -1) fs.writeFileSync(process.argv[outFlag + 1], json);
  console.log(json);
}
if (cmd === 'read-props' && a) {
  emit({ file: a, generatedBy: 'word-oracle read-props', paragraphs: readProps(path.resolve(a)) });
} else if (cmd === 'read-word-props' && a && b && Number(b) > 0) {
  const wordIdx = c && !c.startsWith('--') ? c : null;
  emit({
    file: a,
    generatedBy: 'word-oracle read-word-props',
    paragraph: Number(b),
    words: readWordProps(path.resolve(a), b, wordIdx),
  });
} else if (cmd === 'roundtrip' && a && b) {
  roundtrip(path.resolve(a), path.resolve(b));
  console.log('ROUNDTRIP_OK ' + b);
} else {
  console.error('usage: word-oracle.js read-props <file.docx> [--out r.json] | read-word-props <file.docx> <paraIdx> [wordIdx] [--out r.json] | roundtrip <in.docx> <out.docx>');
  process.exit(2);
}
