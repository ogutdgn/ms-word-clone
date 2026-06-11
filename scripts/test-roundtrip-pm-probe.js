/* PM-converter docx round-trip probe (slice 7 — THE product docx gate).
   Run via the Node driver:  npm run test:roundtrip   (scripts/test-roundtrip-pm.js)
   or directly:  npm run build && npx electron . --probe-out=/tmp/wc-roundtrip.json \
                   --shot-evalfile=scripts/test-roundtrip-pm-probe.js
   Per fixture: docx -> PM (openDocx) -> docx (exportDocxBytes saved to /tmp/wc-rt-<name>.docx,
   a Node-driver artifact, NOT Word-bound) + xml grep invariants (exportXmlOnly) + re-import
   of the exported file. Sentinel-gated (NEVER timing-based). Same JSON contract as
   scripts/test-suite-pm.js. */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Convention (matches test-suite-pm.js): string return = FAILURE with detail.
  const t = async (name, fn) => {
    try { const r = await fn(); results.push({ name, pass: r !== false && typeof r !== 'string', detail: typeof r === 'string' ? r : '' }); }
    catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); }
  };
  for (let i = 0; i < 200 && !(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready); i++) await sleep(50);
  if (!(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready)) {
    // Readiness bail: one synthetic failure beats 17 indirect ERRs per fixture.
    return JSON.stringify({
      summary: { total: 1, pass: 0, fail: 1, artifacts: [] },
      results: [{ name: 'harness ready', pass: false, detail: 'sentinel timeout after 10s' }],
    }, null, 2);
  }

  const PM = () => window.WC.PM;

  // Grep invariants re-derived from each fixture's actual word/document.xml
  // (unzip -p <fixture> word/document.xml | grep -o '<w:[a-zA-Z]*' | sort | uniq -c):
  //   negation-run     — ONE bold-NEGATION run: the fixture has <w:b w:val="0"/>;
  //                      the exporter emits <w:b w:val="0" /> (space before the
  //                      self-close — verified by unzipping the exported artifact),
  //                      hence the \s* in the grep. ONE <w:rPr, ZERO <w:i (pinned
  //                      via `absent` so a negation->plain-bold regression can't pass).
  //   basic-list       — 8x <w:numPr, 8x <w:numId
  //   s3-table         — 1x <w:tbl, 1x <w:tblGrid
  //   s6-tablestyles   — 3x <w:tbl, 1x <w:tblStyle
  // Optional `absent: [...]` — regexes that must NOT match the exported xml.
  const FIXTURES = [
    { path: 'tests/fixtures/negation-run.docx', name: 'negation-run', greps: [/<w:b w:val="0"\s*\/>/, /<w:rPr>/], absent: [/<w:i\b/] },
    { path: 'tests/fixtures/basic-list.docx', name: 'basic-list', greps: [/<w:numPr>/, /<w:numId\b/] },
    { path: 'tests/fixtures/oracle-word-s3-table.docx', name: 's3-table', greps: [/<w:tbl>/, /<w:tblGrid>/] },
    { path: 'tests/fixtures/oracle-word-s6-tablestyles.docx', name: 's6-tablestyles', greps: [/<w:tbl>/, /<w:tblStyle\b/] },
  ];

  // Artifact list is single-sourced here and shipped in summary.artifacts: the
  // Node driver derives its zip-assert iteration from it (no hand-mapped copy).
  const outPathFor = (name) => '/tmp/wc-rt-' + name + '.docx';
  const artifacts = FIXTURES.map((f) => ({ name: f.name, path: outPathFor(f.name) }));

  // Note: gate runs push /tmp/wc-rt-*.docx + the fixture paths into the app's
  // recent-files list via the production IPC (accepted side effect; a `silent`
  // IPC flag is a possible future).

  let crossSnippet = null; // text captured from the first import of negation-run

  for (const f of FIXTURES) {
    const tag = '[rt:' + f.name + '] ';
    const outPath = outPathFor(f.name);
    let imported = false;

    // 1) import: openBytes + openDocx (NOT WC.Files.open — that can pop a
    //    confirmDiscard modal and hang the probe; openDocx setCleans on success).
    await t(tag + 'import: openBytes + openDocx', async () => {
      const r = await window.wordAPI.openBytes(f.path);
      if (!r || r.ok !== true) return 'openBytes failed: ' + ((r && r.error) || JSON.stringify(r));
      if (!r.bytes || !r.bytes.length) return 'openBytes returned no bytes';
      const ok = await PM().openDocx(r.bytes);
      if (ok !== true) return 'openDocx returned ' + ok;
      imported = true;
      // Cross-check capture (one text-bearing fixture): snippet from the first
      // import. Lives inside this t() so a DOM-access throw can never reject
      // the whole IIFE — it just fails this check.
      if (f.name === 'negation-run') {
        crossSnippet = (window.WC.view.dom.textContent || '').trim().slice(0, 18) || null;
      }
      return true;
    });

    // 2) export: zip bytes (PK header, length > 500) saved to /tmp.
    await t(tag + 'export: zip bytes + save', async () => {
      if (!imported) return 'skipped: import failed';
      const bytes = await PM().exportDocxBytes();
      if (!bytes || bytes.length <= 500) return 'export too small: ' + (bytes ? bytes.length : 'null') + ' bytes';
      if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'no PK zip header: bytes[0..1]=' + bytes[0] + ',' + bytes[1];
      const s = await window.wordAPI.saveBytes({ filePath: outPath, bytes });
      if (!s || s.ok !== true) return 'saveBytes failed: ' + ((s && s.error) || JSON.stringify(s));
      return true;
    });

    // 3) xml invariants: exportXmlOnly string + every grep matches.
    await t(tag + 'xml invariants (exportXmlOnly)', async () => {
      if (!imported) return 'skipped: import failed';
      const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
      if (typeof xml !== 'string') return 'exportXmlOnly returned ' + typeof xml + ', not a string';
      for (const re of f.greps) {
        if (!re.test(xml)) {
          // No match: show the regex + a 120-char slice near where the element
          // family would live (first occurrence of the tag-name stem, else doc head).
          const stem = re.source.replace(/\\b/g, '').replace(/[\\^$()]/g, '').slice(0, 6);
          const i = xml.indexOf(stem);
          const at = i >= 0 ? Math.max(0, i - 30) : 0;
          return 'no match for ' + re.source + ' — xml@' + at + ': ' + xml.slice(at, at + 120);
        }
      }
      return true;
    });

    // 3b) xml absent-invariants: pinned regexes that must NOT match the exported
    //     xml (e.g. negation-run must not grow a <w:i — presence-only greps would
    //     let a negation->plain-bold regression pass).
    if (f.absent && f.absent.length) {
      await t(tag + 'xml absent-invariants (exportXmlOnly)', async () => {
        if (!imported) return 'skipped: import failed';
        const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
        if (typeof xml !== 'string') return 'exportXmlOnly returned ' + typeof xml + ', not a string';
        for (const re of f.absent) {
          const m = xml.match(re);
          if (m) return 'forbidden match for ' + re.source + ' — found ' + JSON.stringify(m[0]) + ' @' + m.index;
        }
        return true;
      });
    }

    // 4) re-import: the exported file must itself be loadable.
    await t(tag + 're-import exported docx', async () => {
      if (!imported) return 'skipped: import failed';
      const r = await window.wordAPI.openBytes(outPath);
      if (!r || r.ok !== true) return 'openBytes(' + outPath + ') failed: ' + ((r && r.error) || JSON.stringify(r));
      const ok = await PM().openDocx(r.bytes);
      if (ok !== true) return 'openDocx returned ' + ok;
      return true;
    });

    // Cross-check assert: the captured snippet survives the export -> re-import cycle.
    if (f.name === 'negation-run') {
      await t(tag + 'cross-check: text survives re-import', () => {
        if (!crossSnippet) return 'no snippet captured on first import';
        const txt = window.WC.view.dom.textContent || '';
        if (!txt.includes(crossSnippet)) {
          return 'snippet ' + JSON.stringify(crossSnippet) + ' missing after re-import; got: ' + JSON.stringify(txt.slice(0, 120));
        }
        return true;
      });
    }
  }

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({ summary: { total: results.length, pass, fail: results.length - pass, artifacts }, results }, null, 2);
})()
