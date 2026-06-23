/* M6 glyph-metric divergence REPORT (report:glyphgeom). Measures how far the paged PE's painted typesetting diverges
   from real Word-for-Windows 16.0, per font, and emits the distribution that SETS the tolerance (FR-009/SC-005).
   REPORT-ONLY — not a pass/fail gate. DEV-BOX ONLY: the PE side needs the REAL Electron renderer (headless = mock
   canvas); the Word side needs real Word COM (hangs at New-Object in a sandbox). Invoke sandbox-disabled:
     npm run report:glyphgeom
   Flow: build paged → run the PE probe (one launch authors+measures all fixtures in-session, since paged can't reopen
   a .docx) → per fixture run validate-glyphgeom-win.ps1 (PID-safe COM) → align PE↔Word by LINE SEQUENCE + first word →
   diff (wrap agreement, per-line Y, per-line start-X, page count, lines/page) → per-font distribution. Ends on overlay. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { comValidate, winwordPids } = require('./oracle/com-validate');

const repoRoot = path.resolve(__dirname, '..');
const electron = require('electron');
const DIR = 'C:/tmp';
const ISO = ['--user-data-dir=C:/tmp/wc-probe-profile', '--disable-http-cache'];
const PX_TO_PT = 0.75;

const firstWord = (s) => String(s || '').replace(/ /g, ' ').trim().split(/\s+/)[0].replace(/^[^\w]+|[^\w]+$/g, '') || '';
const pct = (arr, p) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); const idx = (a.length - 1) * p; const lo = Math.floor(idx), hi = Math.ceil(idx); return Math.round((a[lo] + (a[hi] - a[lo]) * (idx - lo)) * 100) / 100; };
const dist = (arr) => arr.length ? { min: pct(arr, 0), median: pct(arr, 0.5), p95: pct(arr, 0.95), max: pct(arr, 1) } : { min: null, median: null, p95: null, max: null };

const die = (msg) => { console.error('FATAL: ' + msg); process.exit(1); };
const build = () => { console.log('  build (paged) ...'); const r = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit', shell: true, timeout: 600000 }); if (r.status !== 0) die('build exited ' + r.status); };

function main() {
  // 1) clean stale artifacts
  try { for (const f of fs.readdirSync(DIR).filter((n) => /^wc-m6-.*\.(docx|json)$/.test(n))) fs.unlinkSync(path.join(DIR, f)); } catch (e) {}

  // 2) build → PE probe (008: paged is the only engine).
  build();
  let report = null, fatal = null;
  try {
    const peOut = DIR + '/wc-m6-pe.json';
    const r = spawnSync(electron, [...ISO, '.', '--probe-out=' + peOut, '--shot-evalfile=scripts/paged-glyphgeom-probe.js'], { cwd: repoRoot, stdio: 'inherit', timeout: 600000 });
    let pe = null; try { pe = JSON.parse(fs.readFileSync(peOut, 'utf8')); } catch (e) { throw new Error('PE probe JSON missing (' + peOut + '): ' + e.message + ' — electron exit ' + r.status); }
    if (pe.error) throw new Error('PE probe error: ' + pe.error);

    console.log('\nMeasuring ' + pe.perFixturePE.length + ' fixtures against Word COM (sandbox-disabled, PID-safe)...');
    const wwBefore = winwordPids();
    let enumVerified = true, fontVerified = true, scaleVerified = true;
    const perFixture = [];
    for (const f of pe.perFixturePE) {
      if (f.error || !f.saved) { perFixture.push({ fixtureId: f.id, error: f.error || 'fixture not saved' }); enumVerified = false; continue; }
      // HONESTY: the requested font must have ACTUALLY painted (probe read-back) — else PE paints + exports the DEFAULT
      // font and PE↔Word agree falsely. A non-applied font invalidates its fixture (excluded from the per-font summary).
      if (f.fontApplied === false) { perFixture.push({ fixtureId: f.id, font: f.font, error: 'font NOT applied (computed=' + f.computedFont + ')' }); fontVerified = false; continue; }
      // the page must be at zoom ~1.0 (Letter ≈ 816px @96dpi) or the fixed px→pt (×0.75) is wrong.
      if (f.pageWidthPx != null && Math.abs(f.pageWidthPx - 816) > 8) scaleVerified = false;
      const w = comValidate('validate-glyphgeom-win.ps1', f.docxPath);
      if (!w.ok || !w.json) { perFixture.push({ fixtureId: f.id, font: f.font, error: 'word: ' + ((w.json && w.json.error) || (w.json && w.json.enumCheck && w.json.enumCheck.detail) || w.raw.slice(0, 160)) }); enumVerified = false; continue; }
      const wj = w.json;
      if (!(wj.enumCheck && wj.enumCheck.ok)) enumVerified = false;

      const peLines = (f.peLines || []).filter((l) => String(l.text || '').trim().length > 0);
      const wLines = wj.perLine || [];
      const N = Math.min(peLines.length, wLines.length);
      const total = Math.max(peLines.length, wLines.length); // a line-count divergence ⇒ the unmatched tail counts as mismatches

      // wrap-point agreement over the FULL line range: line i must start with the same NON-EMPTY word on both sides
      // (two ''s — a bullet/punctuation-only token — must NOT count as agreement).
      let wrapAgree = 0; const wrapMismatches = [];
      for (let i = 0; i < total; i++) {
        const pw = i < peLines.length ? firstWord(peLines[i].text) : null;
        const ww = i < wLines.length ? firstWord(wLines[i].firstWordText) : null;
        if (pw && ww && pw === ww) wrapAgree++; else if (wrapMismatches.length < 8) wrapMismatches.push({ lineIndex: i, pe: pw, word: ww });
      }

      const yDelta = [], xDelta = [];
      for (let i = 0; i < N; i++) { yDelta.push(Math.abs(peLines[i].topPx * PX_TO_PT - wLines[i].yPt)); xDelta.push(Math.abs(peLines[i].leftPx * PX_TO_PT - wLines[i].xPt)); }

      const pePages = f.pageCount, wPages = wj.pages, pePerPage = f.perPageLineCount || [];
      // per-line Y/X is valid ONLY on a single page — across a page-count divergence the global line-index alignment
      // drifts (a line PE put on page 1 that Word put on page 2 shows a ~full-page Y delta), so multi-page fixtures
      // contribute ONLY the page/line counts (the pagination signal).
      const isMulti = pePages > 1 || wPages > 1;

      perFixture.push({
        fixtureId: f.id, font: f.font, sizePt: f.sizePt, alignment: f.alignment, kind: isMulti ? 'multi-page' : 'single-page',
        computedFont: f.computedFont, capped: !!wj.capped,
        pageCount: { pe: pePages, word: wPages, equal: pePages === wPages },
        lineCount: { pe: peLines.length, word: wLines.length, wordStat: wj.lines, equal: peLines.length === wLines.length },
        linesPerPage: { pe: pePerPage, peMax: pePerPage.length ? Math.max(...pePerPage) : 0 },
        wrapPoints: { agree: wrapAgree, total, mismatchRate: total ? Math.round((1 - wrapAgree / total) * 1000) / 1000 : null, mismatches: wrapMismatches },
        dist: isMulti ? null : { lineYPt: dist(yDelta), lineStartXPt: dist(xDelta) },
      });
    }
    const wwAfter = winwordPids();
    const leaked = wwAfter.filter((p) => !wwBefore.includes(p));

    // per-font summary (the tolerance-setting artifact) — only single-page fixtures contribute the per-line Y/X dist
    const byFont = {};
    for (const pf of perFixture) { if (pf.error || !pf.font) continue; (byFont[pf.font] = byFont[pf.font] || []).push(pf); }
    const perFontSummary = Object.keys(byFont).sort().map((font) => {
      const rows = byFont[font];
      const allY = [], allX = []; let pageExact = true, wrapMis = 0, wrapTot = 0;
      // single-page (pf.dist != null) fixtures only contribute the per-line Y/X AND wrap-rate — a multi-page fixture's
      // wrap comparison is unreliable (page-drift + the ps1's word cap truncates Word's per-line list), so its only
      // summary signal is pageCountExact. The per-fixture record keeps the full multi-page numbers + a `capped` flag.
      for (const pf of rows) { if (!pf.pageCount.equal) pageExact = false; if (pf.dist) { if (pf.dist.lineYPt.max != null) allY.push(pf.dist.lineYPt.p95); if (pf.dist.lineStartXPt.max != null) allX.push(pf.dist.lineStartXPt.p95); wrapMis += pf.wrapPoints.total - pf.wrapPoints.agree; wrapTot += pf.wrapPoints.total; } }
      return { font, pageCountExact: pageExact, wrapMismatchRate: wrapTot ? Math.round((wrapMis / wrapTot) * 1000) / 1000 : null, lineYPt_p95: allY.length ? Math.max(...allY) : null, lineStartXPt_p95: allX.length ? Math.max(...allX) : null };
    });

    report = { ok: enumVerified && fontVerified && scaleVerified && leaked.length === 0, enumVerified, fontVerified, scaleVerified, pidSafe: leaked.length === 0, leaked, fontsDetected: pe.fontsDetected, perFixture, perFontSummary };
  } catch (e) { fatal = e; }
  // (008: nothing to restore — paged is the only build; build('paged') above already left the dist paged.)

  if (fatal || !report) { console.error('FATAL: ' + (fatal && (fatal.stack || fatal.message) || 'no report')); process.exit(1); }
  const outPath = DIR + '/wc-m6-report.json';
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\n=== M6 glyph-geometry divergence (REPORT-ONLY) ===');
  console.log('ok=' + report.ok + ' enumVerified=' + report.enumVerified + ' fontVerified=' + report.fontVerified + ' scaleVerified=' + report.scaleVerified + ' pidSafe=' + report.pidSafe + (report.leaked.length ? ' LEAKED=' + JSON.stringify(report.leaked) : ''));
  console.log('\nperFontSummary (the tolerance-setting artifact):');
  for (const s of report.perFontSummary) console.log('  ' + (s.font + '                  ').slice(0, 18) + ' pageExact=' + s.pageCountExact + ' wrapMismatch=' + s.wrapMismatchRate + ' lineY_p95=' + s.lineYPt_p95 + 'pt startX_p95=' + s.lineStartXPt_p95 + 'pt');
  console.log('\nfull report → ' + outPath);
  process.exit(report.ok ? 0 : 1);
}
main();
