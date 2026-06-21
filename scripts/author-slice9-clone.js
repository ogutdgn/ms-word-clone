/* slice-9 references CLONE author host (Leg-A oracle input, NO Word).
   Run: npm run build && node scripts/author-slice9-clone.js
   Spawns electron with the renderer probe (scripts/author-slice9-clone-probe.js),
   which builds a references doc (footnote + caption + citation + TOC) and writes
   it to C:/tmp/wc-slice9-clone.docx via the production save path. Judges ONLY from
   the probe JSON (mirrors scripts/test-roundtrip-pm.js). Exit 1 on any probe failure.

   The COM/Word resave (Leg-A oracle leg B) is performed separately by the human in
   the foreground; this script ONLY produces the clone-authored .docx + baselines it
   conceptually (the actual inspect is `node scripts/docx-inspect.js <outPath>`). */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const probeOut = '/tmp/wc-slice9-author.json';

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  console.log('   ' + (ok ? 'PASS' : 'FAIL') + ' ' + name + (!ok && detail ? ' — ' + detail : ''));
  ok ? pass++ : fail++;
};

try { fs.unlinkSync(probeOut); } catch { /* no stale probe is fine */ }

console.log('1) electron probe: author references clone -> C:/tmp/wc-slice9-clone.docx ...');
const electron = require('electron'); // in plain Node this resolves to the binary path
// isolated throwaway Electron profile (see test-roundtrip-pm.js) — never touch the user's real %APPDATA%/Word cache.
const run = spawnSync(electron, ['--user-data-dir=C:/tmp/wc-probe-profile', '--disable-http-cache', '.', '--probe-out=' + probeOut, '--shot-evalfile=scripts/author-slice9-clone-probe.js'], {
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

const outPath = (probe.summary && probe.summary.outPath) || 'C:/tmp/wc-slice9-clone.docx';
check('clone docx exists on disk: ' + outPath, fs.existsSync(outPath),
  'expected file at ' + outPath);

console.log('RESULT: ' + pass + ' pass / ' + fail + ' fail');
console.log('clone docx: ' + outPath + '  (inspect: node scripts/docx-inspect.js "' + outPath + '")');
process.exit(fail ? 1 : 0);
