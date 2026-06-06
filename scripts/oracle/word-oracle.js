#!/usr/bin/env node
/* scripts/oracle/word-oracle.js — macOS Microsoft Word oracle (AppleScript object
   model ONLY — no GUI/AX scripting; hyperlink creation is broken in Word 16.x for
   Mac and stays off-limits).

   Usage:
     node scripts/oracle/word-oracle.js read-props <abs path .docx> [--out report.json]
     node scripts/oracle/word-oracle.js read-word-props <abs path .docx> <paraIdx> [wordIdx] [--out report.json]
     node scripts/oracle/word-oracle.js read-para-props <abs path .docx> [--out report.json]
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
      still reports bold=true (NOT "mixed"/missing value).
  16. readParaProps puts paragraph TEXT LAST in the tab-joined row: paragraph text
      may contain literal tabs, which would corrupt the protocol for any later
      field. The parser re-joins p.slice(12) to recover the text.
  17. `line spacing` is POINTS, not a multiplier — double spacing on 12pt text
      reads 24, 1.5 spacing reads 18 (matches the Windows COM oracle precedent
      `LineSpacing = 24` at docs/VALIDATION_home_insert.md:25). Comma-decimal
      (quirk #13) applies to all six numeric paragraph-format fields ("18,0").
      The indent/spacing property names resolved exactly as the COM heritage
      suggests: `paragraph format left indent`, `paragraph format right indent`,
      `first line indent`, `space before`, `space after`. Hanging indents are a
      NEGATIVE `first line indent` (left 36 + first line -18 = 0.5" + 0.25" hang).
  18. `line spacing rule` returns enum strings "line space single",
      "line space1 pt5" (sic — the dictionary's odd token split for 1.5, defined
      that way in Word.sdef's WdLineSpacing and echoed verbatim by the getter),
      "line space double", "line space at least", "line space exactly",
      "line space multiple". Normalized via explicit map to
      single|1.5|double|at least|exactly|multiple.
  19. `list format` DOES bind to a variable (`set lf to list format of tr`) —
      unlike word element ranges (quirk #14). `list type` returns enum strings
      "list no numbering", "list bullet", "list simple numbering" (all verified
      live); Word.sdef's WdListType also defines "list listnum only",
      "list outline numbering", "list mixed numbering", "list picture bullet".
      Normalized by stripping the "list " prefix. `list level number` returns 1
      (not 0) for paragraphs in NO list — gate on listType !== "no numbering".
  20. `list string` for Word's DEFAULT bullet is U+F0B7 (Symbol-font private-use
      area, codepoint 61623) — NOT U+2022 "•" — and renders invisibly in most
      terminals/JSON viewers. Numbered items return plain text ("1."). Compare
      bullets against "", or require non-empty listString + listType
      "bullet".
  21. After `save as`, even a VARIABLE-bound document reference dangles: with
      `set d to make new document`, `save as d ...` then `close d` raises -1728
      because Word renamed the document underneath the binding. Close by the NEW
      basename instead (extends quirk #11 to authoring scripts).
  22. DOT-PREFIXED filenames (".oracle-x.docx") can hang Word's `open file name`
      and `save as` machinery indefinitely and (observed 2026-06-06) wedge the
      scripting session's file commands afterwards. Always `cp` a dot-scratch
      fixture to a normal name before handing it to Word.
  23. Long-lived headless Word sessions degrade: opens that answered in seconds
      can stretch to minutes (beyond the AppleEvent 2-minute default → -1712 on
      every stock run) and eventually stop completing at all, while property
      reads on ALREADY-open documents keep working. Wrap long operations in
      `with timeout of N seconds`; if opens stop completing, the only fix is the
      USER relaunching Word — never quit it from a script. */
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

/**
 * Paragraph-level format + list read (slice 2). One row per paragraph.
 * Field order puts TEXT LAST: paragraph text may contain literal tabs, which
 * would corrupt the tab-joined protocol for any later field (quirk #16).
 * All property names below are VERIFIED against Word for Mac 16.77.1 (quirks
 * #17-20): the COM-heritage indent names resolve as-is, `list format` binds to
 * a variable (unlike word ranges, quirk #14), `line spacing` is points, and the
 * default bullet's `list string` is U+F0B7 (Symbol PUA), not U+2022.
 */
const LINE_SPACING_RULES = {
  'line space single': 'single',
  'line space1 pt5': '1.5', // sic — Word.sdef's odd token split (quirk #18)
  'line space double': 'double',
  'line space at least': 'at least',
  'line space exactly': 'exactly',
  'line space multiple': 'multiple',
};
function readParaProps(docxPath) {
  const basename = openDoc(docxPath);
  const script = `
tell application "Microsoft Word"
  set out to ""
  try
    set d to document "${esc(basename)}"
    repeat with i from 1 to (count of paragraphs of d)
      set pf to paragraph format of paragraph i of d
      set tr to text object of paragraph i of d
      set lf to list format of tr
      set out to out & i & tab & (alignment of pf) & tab & (line spacing rule of pf) & tab & (line spacing of pf) & tab & (space before of pf) & tab & (space after of pf) & tab & (paragraph format left indent of pf) & tab & (paragraph format right indent of pf) & tab & (first line indent of pf) & tab & (list type of lf) & tab & (list level number of lf) & tab & (list string of lf) & tab & (content of tr) & linefeed
    end repeat
  on error errMsg
    close document "${esc(basename)}" saving no
    error errMsg
  end try
  close document "${esc(basename)}" saving no
  return out
end tell`;
  const raw = osa(script);
  // Comma-decimal locale (quirk #13) applies to SIX numeric fields here.
  const num = (s) => { const v = parseFloat((s || '').replace(',', '.')); return isNaN(v) ? null : v; };
  return raw.split('\n').filter(Boolean).map((line) => {
    const p = line.split('\t');
    const firstLine = num(p[8]);
    return {
      index: Number(p[0]),
      alignment: (p[1] || '').replace(/^align paragraph /, ''),
      lineSpacingRule: LINE_SPACING_RULES[p[2]] || p[2] || '',
      lineSpacingRuleRaw: p[2] || '',
      lineSpacingPt: num(p[3]), // POINTS, not a multiplier (2.0 spacing on 12pt = 24) — quirk #17
      spaceBeforePt: num(p[4]),
      spaceAfterPt: num(p[5]),
      leftIndentPt: num(p[6]),
      rightIndentPt: num(p[7]),
      firstLineIndentPt: firstLine,
      hangingPt: firstLine != null && firstLine < 0 ? -firstLine : 0, // Word models hanging as negative first-line
      listType: (p[9] || '').replace(/^list /, ''), // "no numbering" | "bullet" | "simple numbering" | ... — quirk #19
      listTypeRaw: p[9] || '',
      listLevelNumber: num(p[10]), // returns 1 even for non-list paragraphs — gate on listType (quirk #19)
      listString: p[11] || '', // default bullet is "" (Symbol PUA), numbered items "1." — quirk #20
      text: p.slice(12).join('\t').replace(/\r$/, ''),
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
} else if (cmd === 'read-para-props' && a) {
  emit({ file: a, generatedBy: 'word-oracle read-para-props', paragraphs: readParaProps(path.resolve(a)) });
} else if (cmd === 'roundtrip' && a && b) {
  roundtrip(path.resolve(a), path.resolve(b));
  console.log('ROUNDTRIP_OK ' + b);
} else {
  console.error('usage: word-oracle.js read-props <file.docx> [--out r.json] | read-word-props <file.docx> <paraIdx> [wordIdx] [--out r.json] | read-para-props <file.docx> [--out r.json] | roundtrip <in.docx> <out.docx>');
  process.exit(2);
}
