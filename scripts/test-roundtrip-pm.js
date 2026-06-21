/* PM-converter docx round-trip driver (slice 7 — THE product docx gate).
   Run: npm run build && npm run test:roundtrip
   1) Spawns electron with the renderer probe (scripts/test-roundtrip-pm-probe.js)
      and judges ONLY from the probe JSON (the harness exits 0 regardless).
   2) Zip-level asserts on the /tmp/wc-rt-*.docx artifacts via the docx-inspect
      CLI (spawned — it is argv-driven with NO module.exports; require() kills
      the host process).
   Output shape mirrors scripts/test_docx.js: per-check PASS/FAIL lines + a
   final "RESULT: N pass / M fail"; exit 1 on any failure. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const probeOut = '/tmp/wc-roundtrip.json';

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  console.log('   ' + (ok ? 'PASS' : 'FAIL') + ' ' + name + (!ok && detail ? ' — ' + detail : ''));
  ok ? pass++ : fail++;
};

// ---------------------------------------------------------------------------
// 1) Electron probe run
// ---------------------------------------------------------------------------
try { fs.unlinkSync(probeOut); } catch { /* no stale probe is fine */ }
// Stale artifacts from a previous run would let the zip-assert phase validate
// yesterday's file and mislead (or, under fixture-rename drift, green-light
// forever). Glob-delete BEFORE the probe runs — the probe JSON that names the
// expected artifacts doesn't exist yet, so this needs no fixture knowledge.
for (const f of fs.readdirSync('/tmp').filter((n) => /^wc-rt-.*\.docx$/.test(n))) {
  try { fs.unlinkSync('/tmp/' + f); } catch { /* best-effort */ }
}

console.log('1) electron probe: docx -> PM -> docx per fixture...');
const electron = require('electron'); // in plain Node this resolves to the binary path
// --user-data-dir isolates a throwaway Electron profile so this gate never touches (or corrupts) the user's real
// app cache (%APPDATA%/Word); --disable-http-cache keeps that throwaway from accumulating a corruptible disk cache.
const run = spawnSync(electron, ['--user-data-dir=C:/tmp/wc-probe-profile', '--disable-http-cache', '.', '--probe-out=' + probeOut, '--shot-evalfile=scripts/test-roundtrip-pm-probe.js'], {
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
  // Surface electron's exit status so a crash reads as a crash, not a file problem.
  console.error('FAIL probe JSON missing/unparseable (' + probeOut + '): ' + e.message
    + ' — electron exit status=' + run.status + ' signal=' + run.signal);
  console.log('RESULT: 0 pass / 1 fail');
  process.exit(1);
}
for (const r of probe.results || []) check(r.name, !!r.pass, r.detail);
check('probe summary: fail === 0', probe.summary && probe.summary.fail === 0,
  probe.summary ? probe.summary.fail + ' probe failure(s) of ' + probe.summary.total : 'no summary');
// Minimum-count pin: insurance against a silently-empty run (a probe that bailed
// early but still wrote well-formed JSON would otherwise sail through).
check('probe summary: total >= 17', !!probe.summary && probe.summary.total >= 17,
  'suite ran suspiciously few checks: total=' + (probe.summary ? probe.summary.total : 'no summary'));

// ---------------------------------------------------------------------------
// 2) Zip-level asserts on the exported artifacts (docx-inspect CLI spawn)
// ---------------------------------------------------------------------------
console.log('2) zip-level asserts on /tmp/wc-rt-*.docx via docx-inspect...');
const inspect = (file) => {
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'docx-inspect.js'), file], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error('docx-inspect exited ' + r.status + ': ' + (r.stderr || '').slice(0, 200));
  return JSON.parse(r.stdout);
};

// Artifact list is single-sourced from the probe (summary.artifacts = [{ name, path }]).
const ARTIFACTS = (probe.summary && probe.summary.artifacts) || [];
const inspected = {};
for (const a of ARTIFACTS) {
  try {
    inspected[a.name] = inspect(a.path);
    check('inspect parses: ' + a.path, true);
  } catch (e) {
    check('inspect parses: ' + a.path, false, e.message);
  }
}

// Fixture-specific asserts, keyed by artifact name (applied when present).
if (ARTIFACTS.some((a) => a.name === 's3-table')) {
  const s3 = inspected['s3-table'];
  check('s3 artifact: tables >= 1', !!s3 && s3.tables >= 1, s3 ? 'tables=' + s3.tables : 'no inspect data');
}

// Slice-6 minting-fix pin: every w:tblStyle ref in document.xml has a matching
// definition in word/styles.xml (refs without definitions = silently unstyled tables).
if (ARTIFACTS.some((a) => a.name === 's6-tablestyles')) {
  const s6 = inspected['s6-tablestyles'];
  check('s6 artifact: tblStyleRefs non-empty', !!s6 && Array.isArray(s6.tblStyleRefs) && s6.tblStyleRefs.length > 0,
    s6 ? 'tblStyleRefs=' + JSON.stringify(s6.tblStyleRefs) : 'no inspect data');
  if (s6 && Array.isArray(s6.tblStyleRefs) && s6.tblStyleRefs.length > 0) {
    const defined = new Set((s6.tableStyles || []).map((s) => s.styleId));
    const missing = s6.tblStyleRefs.filter((id) => !defined.has(id));
    check('s6 artifact: every tblStyle ref defined in styles.xml', missing.length === 0,
      'missing definitions: ' + JSON.stringify(missing) + '; defined: ' + JSON.stringify([...defined]));
  }
}

console.log('RESULT: ' + pass + ' pass / ' + fail + ' fail');
process.exit(fail ? 1 : 0);
