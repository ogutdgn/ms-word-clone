/* Paged-mode .docx export ↔ Word-for-Windows COM-oracle parity gate (Milestone 5). The product `test:roundtrip`
   re-imports via JS and NEVER opens the file in real Word; this gate does, through the Node→COM bridge
   (scripts/oracle/com-validate.js → validate-*-win.ps1, PID-safe, sandbox-DISABLED).

   DEV-BOX ONLY — needs real foreground Word (Word COM hangs at `New-Object` in a sandbox), so this can NOT run in
   headless CI. Invoke via the dangerously-disable-sandbox path:  npm run test:roundtrip:paged

   What it proves:
     • TIER 1 (4 SHARED-model constructs: image, comment+track, footnote/endnote, header/footer) — the PAGED saved
       .docx STRUCTURALLY EQUALS the OVERLAY saved .docx of the same edit. It UNZIPS BOTH SAVED FILES (the exact bytes
       the COM oracle opens — not a re-export) and diffs every part: binary parts (word/media/*) BYTE-equal; xml parts
       equal after normalizing the handful of per-run values exportDocx mints (comment w:date/internalId/paraId, the
       comment rId-bridge id, drawing docPr/cNvPr ids). Referential ids (rId-bridge, paraId, internalId…) are remapped
       to a STABLE per-doc token by first-occurrence order, so a mis-wire (a cross-reference pointing at a DIFFERENT id
       than its definition) still diffs — the normalization can NOT hide a dropped/duplicated/reordered/mis-wired part.
     • TIER 2 (INK, M4c) — Word-valid (opens with no repair) + lands on the correct page at a page-local offset.
   Mode is BUILD-TIME (electron.vite __WC_LAYOUT_DEFAULT__ ← WC_LAYOUT), so the driver builds PAGED then OVERLAY,
   ENDING on overlay (the default) → no leaked paged build. {RESULT: N pass / M fail}; exit 1 on any fail. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { comValidate, winwordPids } = require('./oracle/com-validate');

const repoRoot = path.resolve(__dirname, '..');
const electron = require('electron'); // binary path in plain Node
// Everything (probe JSONs + the probe's wordAPI.saveBytes .docx) lands in C:/tmp via EXPLICIT absolute paths.
// (A bare `/tmp` is MSYS-translated to AppData under Git-Bash but resolves drive-relative to C:\tmp under a plain
// Node spawnSync — using the absolute C:/tmp here removes that ambiguity so the driver reads what the harness wrote.)
const DOCX_DIR = 'C:/tmp';

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ' ' + name + (!ok && detail ? ' — ' + detail : '')); ok ? pass++ : fail++; };
const die = (msg) => { console.error('FATAL: ' + msg); console.log('RESULT: ' + pass + ' pass / ' + (fail + 1) + ' fail'); process.exit(1); };

// ── build + probe helpers ──
const build = (mode) => {
  console.log('  build WC_LAYOUT=' + (mode || 'overlay') + ' ...');
  // NB: overlay must be set EXPLICITLY — post-FR-013 (paged-default flip) an empty WC_LAYOUT falls back to 'paged'
  // (main.ts:35), so the old `: ''` built paged-as-overlay → the overlay probe booted paged. 'overlay' is explicit.
  const r = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, env: Object.assign({}, process.env, { WC_LAYOUT: mode === 'paged' ? 'paged' : 'overlay' }), stdio: 'inherit', shell: true, timeout: 600000 });
  if (r.status !== 0) die('build (' + mode + ') exited ' + r.status);
};
const probe = (evalfile, outName) => {
  const jpath = DOCX_DIR + '/' + outName;
  try { fs.unlinkSync(jpath); } catch (e) { /* glob-clean already removed it; belt-and-braces so a crash can't leave yesterday's JSON */ }
  // --user-data-dir isolates a throwaway Electron profile so probe runs never touch (or corrupt) the user's real
  // app cache (%APPDATA%/Word); --disable-http-cache keeps that throwaway from accumulating a corruptible disk cache.
  const r = spawnSync(electron, ['--user-data-dir=C:/tmp/wc-probe-profile', '--disable-http-cache', '.', '--probe-out=' + jpath, '--shot-evalfile=' + evalfile], { cwd: repoRoot, stdio: 'inherit', timeout: 300000 });
  let json = null;
  try { json = JSON.parse(fs.readFileSync(jpath, 'utf8')); } catch (e) { die('probe JSON missing/unparseable (' + jpath + '): ' + e.message + ' — electron exit=' + r.status + ' signal=' + r.signal); }
  return json;
};

// ── id/timestamp normalization for the xml-part diff ──────────────────────────────────────────────────────────────
// REFERENTIAL ids are captured (group 1) + remapped to a STABLE per-doc token by first-occurrence order: the SAME
// value → the SAME token everywhere (integrity kept), but a DIFFERENT value at a cross-reference site → a DIFFERENT
// token → a real mis-wire still diffs. FLAT masks blunt purely-unique values (no cross-reference to preserve).
const REF_PATTERNS = [
  /rId-bridge-([A-Za-z0-9]+)/g,            // comment relationship id (document.xml r:id ref ↔ .rels def)
  /(?:w14|w15|w16cid):paraId="([^"]*)"/g,  // comment paraId (comments.xml ↔ commentsExtended/commentsIds)
  /custom:internalId="([^"]*)"/g,          // per-run comment UUID
  /custom:trackedId="([^"]*)"/g,           // per-run tracked-comment UUID (if present)
  /\bw16cid:durableId="([^"]*)"/g,         // commentsIds durableId (if present)
];
const FLAT_MASKS = [
  [/\bw:date="[^"]*"/g, 'w:date="@D"'],                  // comment wall-clock timestamp (non-referential)
  [/\bw16cid:dateUtc="[^"]*"/g, 'w16cid:dateUtc="@D"'],  // commentsExtensible date (non-referential)
  [/(<wp:docPr\b[^>]*?\bid=")[^"]*(")/g, '$1@N$2'],      // drawing id (random int, non-referential)
  [/(<pic:cNvPr\b[^>]*?\bid=")[^"]*(")/g, '$1@N$2'],     // picture id (random int, non-referential)
];
const buildNormalizer = (textParts) => {
  const corpus = textParts.join(' ');
  const maps = REF_PATTERNS.map((re) => { const m = new Map(); const g = new RegExp(re.source, 'g'); let x; let i = 0; while ((x = g.exec(corpus))) { const v = x[1]; if (v && !m.has(v)) m.set(v, '@V' + (i++)); } return { re, m }; });
  return (s) => {
    let out = String(s == null ? '' : s);
    for (const { re, m } of maps) out = out.replace(new RegExp(re.source, 'g'), (whole, val) => (val ? whole.replace(val, m.get(val) || '@V?') : whole));
    for (const [re, to] of FLAT_MASKS) out = out.replace(re, to);
    return out;
  };
};
const allPatterns = REF_PATTERNS.concat(FLAT_MASKS.map(([re]) => re));
const maskHits = (s) => allPatterns.reduce((sum, re) => sum + ((String(s == null ? '' : s).match(new RegExp(re.source, 'g')) || []).length), 0);

// unzip a .docx → { '<part>': {text} | {bin:Buffer} }  (xml/rels = text, everything else = raw bytes)
const loadParts = async (file) => {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
  const out = {};
  for (const n of names) out[n] = /\.(xml|rels)$/i.test(n) ? { text: await zip.files[n].async('string') } : { bin: await zip.files[n].async('nodebuffer') };
  return out;
};

async function main() {
  // ── 1) glob-CLEAN stale artifacts (BOTH the .docx AND the probe JSONs) so a previous run can't green-light this one ──
  try { if (!fs.existsSync(DOCX_DIR)) fs.mkdirSync(DOCX_DIR, { recursive: true }); } catch (e) {}
  for (const f of fs.readdirSync(DOCX_DIR).filter((n) => /^wc-.*-m5-.*\.docx$/.test(n) || /^wc-m5-.*\.json$/.test(n) || /^wc-.*-hf-p[23]\.docx$/.test(n) || /^wc-hf-p[23]-.*\.json$/.test(n) || /^wc-.*-columns\.docx$/.test(n) || /^wc-columns-.*\.json$/.test(n))) { try { fs.unlinkSync(path.join(DOCX_DIR, f)); } catch (e) {} }

  // ── 2) PAGED build → paged kitchen-sink + paged multi-page ink ──
  build('paged');
  const pagedKS = probe('scripts/paged-export-m5-probe.js', 'wc-m5-ks-paged.json');
  const pagedInk = probe('scripts/paged-export-m5-ink-probe.js', 'wc-m5-ink-paged.json');
  const pagedHfP2 = probe('scripts/paged-export-hf-p2-probe.js', 'wc-hf-p2-paged.json'); // 002 P2 variants/flags doc
  const pagedHfP3 = probe('scripts/paged-export-hf-p3-probe.js', 'wc-hf-p3-paged.json'); // 002 P3 footer PAGE-field doc
  const pagedCols = probe('scripts/paged-export-columns-probe.js', 'wc-columns-paged.json'); // 003 P1 2-column doc
  // ── 3) OVERLAY build → overlay kitchen-sink (ENDS on overlay → leak-free) ──
  build('overlay');
  const ovlKS = probe('scripts/paged-export-m5-probe.js', 'wc-m5-ks-overlay.json');

  console.log('\nA) probe self-checks (right mode + the renderer edits + saves succeeded):');
  check('paged kitchen-sink ran in PAGED mode', pagedKS.summary && pagedKS.summary.mode === 'paged', 'mode=' + (pagedKS.summary && pagedKS.summary.mode) + ' (stale localStorage WC_LAYOUT or mislabeled build?)');
  check('overlay kitchen-sink ran in OVERLAY mode', ovlKS.summary && ovlKS.summary.mode === 'overlay', 'mode=' + (ovlKS.summary && ovlKS.summary.mode));
  check('paged ink ran in PAGED mode', pagedInk.summary && pagedInk.summary.mode === 'paged', 'mode=' + (pagedInk.summary && pagedInk.summary.mode));
  check('paged kitchen-sink probe: fail===0', pagedKS.summary && pagedKS.summary.fail === 0, pagedKS.summary ? pagedKS.summary.fail + ' of ' + pagedKS.summary.total : 'no summary');
  check('overlay kitchen-sink probe: fail===0', ovlKS.summary && ovlKS.summary.fail === 0, ovlKS.summary ? ovlKS.summary.fail + ' of ' + ovlKS.summary.total : 'no summary');
  check('paged ink probe: fail===0', pagedInk.summary && pagedInk.summary.fail === 0, pagedInk.summary ? pagedInk.summary.fail + ' of ' + pagedInk.summary.total : 'no summary');
  check('paged HF-P2 probe ran in PAGED mode', pagedHfP2.summary && pagedHfP2.summary.mode === 'paged', 'mode=' + (pagedHfP2.summary && pagedHfP2.summary.mode));
  check('paged HF-P2 probe: fail===0', pagedHfP2.summary && pagedHfP2.summary.fail === 0, pagedHfP2.summary ? pagedHfP2.summary.fail + ' of ' + pagedHfP2.summary.total : 'no summary');
  check('paged HF-P3 probe ran in PAGED mode', pagedHfP3.summary && pagedHfP3.summary.mode === 'paged', 'mode=' + (pagedHfP3.summary && pagedHfP3.summary.mode));
  check('paged HF-P3 probe: fail===0', pagedHfP3.summary && pagedHfP3.summary.fail === 0, pagedHfP3.summary ? pagedHfP3.summary.fail + ' of ' + pagedHfP3.summary.total : 'no summary');
  check('paged columns probe ran in PAGED mode', pagedCols.summary && pagedCols.summary.mode === 'paged', 'mode=' + (pagedCols.summary && pagedCols.summary.mode));
  check('paged columns probe: fail===0', pagedCols.summary && pagedCols.summary.fail === 0, pagedCols.summary ? pagedCols.summary.fail + ' of ' + pagedCols.summary.total : 'no summary');

  const DOCS = {
    'paged kitchen-sink': DOCX_DIR + '/wc-paged-m5-kitchensink.docx',
    'overlay kitchen-sink': DOCX_DIR + '/wc-overlay-m5-kitchensink.docx',
    'paged ink': DOCX_DIR + '/wc-paged-m5-ink.docx',
    'paged HF-P2': DOCX_DIR + '/wc-paged-hf-p2.docx',
    'paged HF-P3': DOCX_DIR + '/wc-paged-hf-p3.docx',
    'paged columns': DOCX_DIR + '/wc-paged-columns.docx',
  };

  // ── 4) real-Word validate-open on every saved .docx (CORE: opens with no repair; OpenAndRepair:=false) ──
  console.log('\nB) real-Word validate-open (sandbox-disabled, PID-safe):');
  const wwBefore = winwordPids();
  for (const [label, d] of Object.entries(DOCS)) {
    if (!fs.existsSync(d)) { check('validate-open: ' + label, false, 'missing file ' + d); continue; }
    const r = comValidate('validate-open-win.ps1', d);
    check('validate-open: ' + label + ' (ok, no repair)', r.ok, (r.json && r.json.error) || r.error || r.raw.slice(0, 160));
  }

  // ── 5) per-construct read-back on the PAGED kitchen-sink (validate-open ok is necessary-not-sufficient) ──
  console.log('\nC) paged read-backs == seeded markers:');
  const pks = DOCS['paged kitchen-sink'];
  {
    const cm = comValidate('validate-comments-win.ps1', pks);
    const scopeErr = cm.json && typeof cm.json.comment1Scope === 'string' && cm.json.comment1Scope.indexOf('<scope-error') >= 0;
    check('comment read-back: comment1Text ~ M5CMT (no scope-error)', cm.ok && cm.json && /M5CMT/.test(String(cm.json.comment1Text || '')) && !scopeErr, cm.ok ? ('comment1Text=' + JSON.stringify(cm.json && cm.json.comment1Text) + ' scope=' + JSON.stringify(cm.json && cm.json.comment1Scope)) : ((cm.json && cm.json.error) || cm.raw.slice(0, 140)));

    const nt = comValidate('validate-notes-win.ps1', pks);
    check('notes read-back: footnote1Text ~ M5FTNOTE + endnoteCount>=1', nt.ok && nt.json && /M5FTNOTE/.test(String(nt.json.footnote1Text || '')) && Number(nt.json.endnoteCount) >= 1, nt.ok ? ('footnote1Text=' + JSON.stringify(nt.json && nt.json.footnote1Text) + ' endnoteCount=' + (nt.json && nt.json.endnoteCount)) : ((nt.json && nt.json.error) || nt.raw.slice(0, 140)));

    const hf = comValidate('validate-headerfooter-win.ps1', pks);
    check('header/footer read-back: headerText ~ M5HDR + footerText ~ M5FTR', hf.ok && hf.json && /M5HDR/.test(String(hf.json.headerText || '')) && /M5FTR/.test(String(hf.json.footerText || '')), hf.ok ? ('headerText=' + JSON.stringify(hf.json && hf.json.headerText) + ' footerText=' + JSON.stringify(hf.json && hf.json.footerText)) : ((hf.json && hf.json.error) || hf.raw.slice(0, 140)));
  }

  // ── 5b) P2 (002) header/footer variant + structure-flag read-back on the dedicated P2 .docx ──
  console.log('\nC2) paged HF-P2 read-backs == authored (DFP/odd-even flags + first/even variant text):');
  {
    const p2 = DOCS['paged HF-P2'];
    const hf2 = comValidate('validate-headerfooter-win.ps1', p2);
    const j = hf2.json || {};
    const errDetail = (extra) => hf2.ok ? extra : ((j.error) || hf2.raw.slice(0, 140));
    check('HF-P2: opened without repair + enum self-check', hf2.ok && j.openedWithoutRepair === true && j.enumCheck === true, errDetail(JSON.stringify({ open: j.openedWithoutRepair, enum: j.enumCheck })));
    check('HF-P2: DifferentFirstPage flag === true', hf2.ok && j.differentFirstPage === true, errDetail('got ' + JSON.stringify(j.differentFirstPage)));
    check('HF-P2: DifferentOddEven flag === true', hf2.ok && j.differentOddEven === true, errDetail('got ' + JSON.stringify(j.differentOddEven)));
    check('HF-P2: primary header ~ P2PRIMH', hf2.ok && /P2PRIMH/.test(String(j.primaryHeader || '')), errDetail('got ' + JSON.stringify(j.primaryHeader)));
    check('HF-P2: first header ~ P2FIRSTH', hf2.ok && /P2FIRSTH/.test(String(j.firstHeader || '')), errDetail('got ' + JSON.stringify(j.firstHeader)));
    check('HF-P2: first footer ~ P2FIRSTF', hf2.ok && /P2FIRSTF/.test(String(j.firstFooter || '')), errDetail('got ' + JSON.stringify(j.firstFooter)));
    check('HF-P2: even header ~ P2EVENH', hf2.ok && /P2EVENH/.test(String(j.evenHeader || '')), errDetail('got ' + JSON.stringify(j.evenHeader)));
    check('HF-P2: even footer ~ P2EVENF', hf2.ok && /P2EVENF/.test(String(j.evenFooter || '')), errDetail('got ' + JSON.stringify(j.evenFooter)));
  }

  // ── 5c) P3 (002) page-number read-back: real Word resolves the footer's PAGE field to a number ──
  console.log('\nC3) paged HF-P3 read-back == a live wdFieldPage field whose result is the page number:');
  {
    const p3 = DOCS['paged HF-P3'];
    const hf3 = comValidate('validate-headerfooter-win.ps1', p3);
    const j = hf3.json || {};
    const pf = j.footerPageField || {};
    const errDetail = (extra) => hf3.ok ? extra : ((j.error) || hf3.raw.slice(0, 140));
    check('HF-P3: opened without repair', hf3.ok && j.openedWithoutRepair === true, errDetail('open=' + JSON.stringify(j.openedWithoutRepair)));
    check('HF-P3: footer carries a wdFieldPage field (type 33, code ~ PAGE)', hf3.ok && pf.present === true && Number(pf.type) === 33 && /PAGE/i.test(String(pf.code || '')), errDetail('footerPageField=' + JSON.stringify(pf)));
    check('HF-P3: the PAGE field result is a number (Word resolved it per page)', hf3.ok && pf.present === true && /^\d+$/.test(String(pf.result || '')) && Number(pf.result) >= 1, errDetail('result=' + JSON.stringify(pf.result)));
  }

  // ── 5d) 003 Columns read-back: real Word reads the section's column layout ──
  console.log('\nC4) paged columns read-back == authored (Sections(1).PageSetup.TextColumns):');
  {
    const cl = comValidate('validate-columns-win.ps1', DOCS['paged columns']);
    const j = cl.json || {};
    const errDetail = (extra) => cl.ok ? extra : ((j.error) || cl.raw.slice(0, 140));
    check('columns: opened without repair', cl.ok && j.openedWithoutRepair === true, errDetail('open=' + JSON.stringify(j.openedWithoutRepair)));
    check('columns: TextColumns.Count === 2', cl.ok && Number(j.columnCount) === 2, errDetail('columnCount=' + JSON.stringify(j.columnCount)));
    check('columns: EvenlySpaced === true', cl.ok && j.evenlySpaced === true, errDetail('evenlySpaced=' + JSON.stringify(j.evenlySpaced)));
  }

  // ── 6) TIER 1 — paged-vs-overlay equality of the SAVED .docx bytes (unzip both; xml normalized, binary byte-equal) ──
  console.log('\nD) paged-vs-overlay SAVED .docx equality (unzip both files — the exact bytes Word opens):');
  const pParts = await loadParts(DOCS['paged kitchen-sink']);
  const oParts = await loadParts(DOCS['overlay kitchen-sink']);
  const pKeys = Object.keys(pParts).sort(), oKeys = Object.keys(oParts).sort();
  const textP = pKeys.filter((k) => pParts[k].text != null).map((k) => pParts[k].text);
  const textO = oKeys.filter((k) => oParts[k].text != null).map((k) => oParts[k].text);
  const normP = buildNormalizer(textP), normO = buildNormalizer(textO);
  const diffs = [];
  for (const k of Array.from(new Set([...pKeys, ...oKeys])).sort()) {
    const pp = pParts[k], op = oParts[k];
    if (!pp || !op) { diffs.push(k + ' (present only in ' + (pp ? 'paged' : 'overlay') + ')'); continue; }
    if (pp.text != null && op.text != null) {
      const va = normP(pp.text), vb = normO(op.text);
      if (va !== vb) { let i = 0; const n = Math.min(va.length, vb.length); while (i < n && va[i] === vb[i]) i++; diffs.push(k + ' @' + i + ' | paged:' + JSON.stringify(va.slice(Math.max(0, i - 15), i + 55)) + ' overlay:' + JSON.stringify(vb.slice(Math.max(0, i - 15), i + 55))); }
    } else if (pp.bin && op.bin) {
      if (!pp.bin.equals(op.bin)) diffs.push(k + ' (binary differs: ' + pp.bin.length + ' vs ' + op.bin.length + ' bytes)');
    } else { diffs.push(k + ' (type mismatch: paged=' + (pp.text != null ? 'text' : 'bin') + ' overlay=' + (op.text != null ? 'text' : 'bin') + ')'); }
  }
  const hitsP = textP.reduce((s, t) => s + maskHits(t), 0), hitsO = textO.reduce((s, t) => s + maskHits(t), 0);
  check('both .docx unzipped to >=10 parts each', pKeys.length >= 10 && oKeys.length >= 10, 'paged=' + pKeys.length + ' overlay=' + oKeys.length);
  check('paged + overlay saved .docx have the SAME part set', JSON.stringify(pKeys) === JSON.stringify(oKeys), 'paged-only/overlay-only parts: ' + diffs.filter((d) => /present only/.test(d)).join(', '));
  // honesty guard: the masks must hit the SAME total on both sides — an asymmetric count means a construct (and its
  // per-run ids) was dropped/added, which value-normalization would otherwise paper over. >0 rejects an all-zero pass.
  check('mask-hit counts match (no construct dropped/added)', hitsP === hitsO && hitsP > 0, 'paged=' + hitsP + ' overlay=' + hitsO);
  check('paged SAVED .docx STRUCTURALLY EQUALS overlay (0 differing parts after id/ts normalize)', diffs.length === 0, diffs.length + ' differing part(s): ' + diffs.slice(0, 3).join(' || '));

  // ── 7) TIER 2 — INK: Word-valid (validate-open above) + page-correct page-local posOffset (from the probe) ──
  console.log('\nE) ink page-correctness (Word-valid + page-local posOffset on the right page):');
  {
    const r = pagedInk.results || [];
    const pageA = r.find((x) => /page-1 stroke exports PAGE-LOCAL/.test(x.name));
    const pageB = r.find((x) => /page-2 top stroke exports PAGE-LOCAL/.test(x.name));
    check('ink: page-1 stroke exports page-local posOffset(V)', !!(pageA && pageA.pass), pageA ? pageA.detail : 'assert row missing');
    check('ink: page-2 top stroke exports page-local posOffset(V)', !!(pageB && pageB.pass), pageB ? pageB.detail : 'assert row missing');
  }

  // ── 8) PID-safety: no WINWORD leaked (the user's Word window untouched) ──
  console.log('\nF) PID-safety:');
  {
    const wwAfter = winwordPids();
    const leaked = wwAfter.filter((p) => !wwBefore.includes(p));
    check('no leaked WINWORD process (user Word untouched)', leaked.length === 0, 'leaked PIDs=' + JSON.stringify(leaked) + ' (before=' + JSON.stringify(wwBefore) + ' after=' + JSON.stringify(wwAfter) + ')');
  }

  console.log('\nRESULT: ' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => die('uncaught: ' + (e && e.stack || e)));
