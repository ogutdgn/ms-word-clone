// 007: genuine PAGED `test:pm`. Runs the functional suite against a FRESH user-data-dir so no stale
// `localStorage WC_LAYOUT` can override the paged build define (the footgun that produced the migration's
// false-green — see memory paged-testpm-overlay-suite). Asserts the booted mode is paged (guards the footgun)
// and that there are 0 HARD failures (paged-skips of overlay-only constructs + deferred known-gaps count as
// pass; the auditable counts are surfaced). Build paged FIRST (`npm run build` — paged is the default); this
// runner does NOT build, it only runs + asserts (symmetric to run-pm-overlay.js).
const cp = require('child_process');
const fs = require('fs');
const PROFILE = 'C:/tmp/wc-paged-pm';
const OUT = 'C:/tmp/wc-pm-paged.json';
fs.rmSync(PROFILE, { recursive: true, force: true });
cp.execSync(`electron --user-data-dir=${PROFILE} --disable-http-cache . --probe-out=${OUT} --shot-evalfile=scripts/test-suite-pm.js`, { stdio: 'inherit' });
const j = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const s = j.summary;
console.log('test:pm:paged', JSON.stringify(s));
if (s.mode !== 'paged') {
  console.error('NOT PAGED — booted mode=' + s.mode + '. Build paged first (`npm run build`, paged is the default); a stale build/profile is overriding the mode.');
  process.exit(1);
}
if (s.fail !== 0) {
  console.error(s.fail + ' paged HARD failures:');
  j.results.filter((r) => !r.pass).forEach((r) => console.error('  FAIL ' + r.name + ' | ' + r.detail));
  process.exit(1);
}
console.log('PAGED OK: ' + s.pass + '/' + s.total + ' pass (' + s.pagedSkips + ' overlay-only skips, ' + s.pagedKnownGaps + ' deferred known-gaps)');
