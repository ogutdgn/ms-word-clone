// 007 (review w4szfpzey, Defect B): the OVERLAY `test:pm` gate, symmetric to run-pm-paged.js. Runs the suite
// against a FRESH user-data-dir (no stale `localStorage WC_LAYOUT`) so the build define wins, then ASSERTS the
// booted mode is overlay + 0 failures. This re-closes the false-green footgun that the old hard boot-guard used
// to close (007 replaced that guard with a soft mode-record): without this, `npm run test:pm` was a bare electron
// run against the shared persistent profile with NO mode check, so a stale `WC_LAYOUT='paged'` there could boot
// paged and report a green `mode:'paged'` 475 — silently validating the wrong engine. Build overlay first:
// `WC_LAYOUT=overlay npm run build` (the gate command), then `npm run test:pm`.
const cp = require('child_process');
const fs = require('fs');
const PROFILE = 'C:/tmp/wc-overlay-pm';
const OUT = 'C:/tmp/wc-pm.json'; // keep the canonical overlay output path other tooling reads
fs.rmSync(PROFILE, { recursive: true, force: true });
cp.execSync(`electron --user-data-dir=${PROFILE} --disable-http-cache . --probe-out=${OUT} --shot-evalfile=scripts/test-suite-pm.js`, { stdio: 'inherit' });
const j = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const s = j.summary;
console.log('test:pm (overlay)', JSON.stringify(s));
if (s.mode !== 'overlay') {
  console.error('NOT OVERLAY — booted mode=' + s.mode + '. Build overlay first (`WC_LAYOUT=overlay npm run build`); a stale build/profile is overriding the mode (the false-green footgun this guard exists to catch).');
  process.exit(1);
}
if (s.fail !== 0) {
  console.error(s.fail + ' overlay failures:');
  j.results.filter((r) => !r.pass).forEach((r) => console.error('  FAIL ' + r.name + ' | ' + r.detail));
  process.exit(1);
}
console.log('OVERLAY OK: ' + s.pass + '/' + s.total + ' pass');
