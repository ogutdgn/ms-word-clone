/* slice-9 references LEG-B import HOST (Word -> clone). NO Word/COM here.
   Run: npm run build && node scripts/import-slice9-legb.js
   Spawns electron headless with the renderer probe
   (scripts/import-slice9-legb-probe.js), which reads the REAL-Word resaved docx
   C:/tmp/wc-slice9-resaved.docx off disk (via wordAPI.openBytes), imports it with
   WC.PM.openDocx(bytes), and inspects the rebuilt PM document. Judges ONLY from
   the probe JSON (mirrors scripts/author-slice9-clone.js / test-roundtrip-pm.js).
   Exit 1 on any probe failure.

   This proves whether the fork converter can PARSE real-Word references XML
   (footnote + TOC field + SEQ Figure caption + CITATION + <b:Source>) without
   blanking the doc. A contentError / blank / drop is a REAL finding, not masked. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const probeOut = '/tmp/wc-slice9-legb.json';
const FIXTURE = 'C:/tmp/wc-slice9-resaved.docx';

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  console.log('   ' + (ok ? 'PASS' : 'FAIL') + ' ' + name + (!ok && detail ? ' — ' + detail : ''));
  ok ? pass++ : fail++;
};

if (!fs.existsSync(FIXTURE)) {
  console.error('FAIL fixture missing: ' + FIXTURE);
  console.log('RESULT: 0 pass / 1 fail');
  process.exit(1);
}

try { fs.unlinkSync(probeOut); } catch { /* no stale probe is fine */ }

console.log('1) electron probe: import real-Word references docx -> WC.PM.openDocx ...');
const electron = require('electron'); // in plain Node this resolves to the binary path
// isolated throwaway Electron profile (see test-roundtrip-pm.js) — never touch the user's real %APPDATA%/Word cache.
const run = spawnSync(electron, ['--user-data-dir=C:/tmp/wc-probe-profile', '--disable-http-cache', '.', '--probe-out=' + probeOut, '--shot-evalfile=scripts/import-slice9-legb-probe.js'], {
  cwd: repoRoot,
  stdio: 'inherit',
  timeout: 300000,
});
if (run.error) {
  console.error('FAIL electron spawn: ' + run.error.message);
  console.log('RESULT: 0 pass / 1 fail');
  process.exit(1);
}

let probe = null;
try {
  probe = JSON.parse(fs.readFileSync(probeOut, 'utf8'));
} catch (e) {
  console.error('FAIL probe JSON missing/unparseable (' + probeOut + '): ' + e.message
    + ' — electron exit status=' + run.status + ' signal=' + run.signal);
  console.log('RESULT: 0 pass / 1 fail');
  process.exit(1);
}

for (const r of probe.results || []) check(r.name, !!r.pass, r.detail);
check('probe summary: fail === 0', probe.summary && probe.summary.fail === 0,
  probe.summary ? probe.summary.fail + ' probe failure(s) of ' + probe.summary.total : 'no summary');

// Surface the verdict prominently for the parent (host judges the assertions object).
const a = (probe.summary && probe.summary.assertions) || {};
console.log('');
console.log('importResult: ' + ((probe.summary && probe.summary.importResult) || 'n/a'));
console.log('assertions:   ' + JSON.stringify(a));
check('footnoteRefNode (footnoteReference node exists)', a.footnoteRefNode === true);
check('tocNodeOrField (tableOfContents node OR TOC field survived)', a.tocNodeOrField === true);
check('captionSeq (sequenceField / SEQ Figure survived)', a.captionSeq === true);
check('citationNode (citation node / CITATION field survived)', a.citationNode === true);
check('contentError === false (import did not blank/throw)', a.contentError === false);

console.log('');
console.log('RESULT: ' + pass + ' pass / ' + fail + ' fail');
process.exit(fail ? 1 : 0);
