/* Renderer entry-size gate (008: generalized from the former overlay-bundle gate).
   Proves the heavy PresentationEditor subgraph stays code-split OUT of the renderer ENTRY
   chunk via the dynamic import in src/renderer/bridge/create-editor.ts, so the entry stays
   lean (it loads the PE chunk on demand at boot). Mode-agnostic — paged is the sole engine —
   guarding against an accidental static re-import bloating the entry.

   Run AFTER `npm run build`. Exits non-zero on any violation.

   Discriminator (robust): the PE chunk is the chunk the ENTRY actually dynamic-imports
   (`import("./index-*.js")`) that carries the PresentationEditor implementation — NOT a
   fragile "chunk with the most marker hits" argmax. If PE were re-inlined (static import),
   there is NO such dynamic-import target AND the entry blows past the size ceiling — caught twice.

   Measured baseline: entry ≈ 8.5 MB (the shared fork graph: Editor + extensions + layout/painter/measuring-dom),
   PE-specific impl chunk ≈ 2.39 MB (71 marker hits), dynamic-imported out; a static-PE regression ≈ 10.9 MB. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RENDERER = path.join(ROOT, 'out', 'renderer');
const HTML = path.join(RENDERER, 'index.html');
const ASSETS = path.join(RENDERER, 'assets');

// Ceiling for the renderer entry chunk. 9.5 MB: passes the ~8.5 MB entry baseline with headroom,
// FAILS if the 2.39 MB PE impl re-inlines (static import → ~10.9 MB). Re-pin only with a measured
// justification. (NB: the entry carries the shared fork graph either way; the dynamic import only
// code-splits the PresentationEditor-SPECIFIC impl out — check #2 above is the real inline guard.)
const ENTRY_MAX_BYTES = Math.round(9.5 * 1024 * 1024);
const MARKER = 'PresentationEditor';
const PE_MIN_HITS = 30; // the PE impl chunk has ~71; incidental refs elsewhere are few.

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? ' — ' + detail : '')); };
const die = (msg) => { console.error('check-entry-bundle: ' + msg); process.exit(2); };
const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
const markerHits = (file) => (fs.readFileSync(path.join(ASSETS, file), 'utf8').match(new RegExp(MARKER, 'g')) || []).length;

if (!fs.existsSync(HTML)) die('no out/renderer/index.html — run `npm run build` first');
if (!fs.existsSync(ASSETS)) die('no out/renderer/assets — run `npm run build` first');

// 1) Entry chunk: the module <script src="…assets/index-*.js">. Require exactly one.
const html = fs.readFileSync(HTML, 'utf8');
const entryRefs = [...html.matchAll(/<script[^>]*\bsrc="[^"]*assets\/(index-[^"]+\.js)"/g)].map((m) => m[1]);
if (entryRefs.length !== 1) die('expected exactly one entry <script> to assets/index-*.js, found ' + entryRefs.length + ' (' + entryRefs.join(', ') + ')');
const entryFile = entryRefs[0];
const entryPath = path.join(ASSETS, entryFile);
if (!fs.existsSync(entryPath)) die('entry chunk ' + entryFile + ' not found on disk');
const entrySize = fs.statSync(entryPath).size;
const entryText = fs.readFileSync(entryPath, 'utf8');

// 2) Chunks the ENTRY dynamic-imports (the only legitimate way the entry pulls in the PE).
const dynTargets = [...new Set([...entryText.matchAll(/import\(\s*["']\.?\/?(?:assets\/)?(index-[^"']+\.js)["']\s*\)/g)].map((m) => m[1]))]
  .filter((f) => fs.existsSync(path.join(ASSETS, f)));
// The PE chunk = the dynamic-import target carrying the PresentationEditor implementation.
const peChunk = dynTargets
  .map((f) => ({ f, hits: markerHits(f) }))
  .filter((x) => x.hits >= PE_MIN_HITS)
  .sort((a, b) => b.hits - a.hits)[0];

console.log('[check-entry-bundle] entry=' + entryFile + ' (' + mb(entrySize) + ')  dyn-imports=[' + dynTargets.join(', ') + ']');
if (peChunk) console.log('[check-entry-bundle] PE chunk=' + peChunk.f + ' (' + peChunk.hits + ' marker hits)');

check('exactly one entry chunk identified from index.html', true, entryFile);
check('PresentationEditor is a DYNAMIC-import target of the entry (code-split)',
  !!peChunk && peChunk.f !== entryFile,
  peChunk ? (peChunk.f + ', ' + peChunk.hits + ' hits') : 'NO dynamic-import chunk carries ' + MARKER + ' (PE inlined into entry?)');
check('index.html does NOT eagerly load the PE chunk',
  !!peChunk && !html.includes(peChunk.f),
  peChunk ? (peChunk.f + ' is not <script>-ed by index.html') : 'n/a');
check('renderer entry under the ' + mb(ENTRY_MAX_BYTES) + ' ceiling',
  entrySize <= ENTRY_MAX_BYTES,
  mb(entrySize) + ' <= ' + mb(ENTRY_MAX_BYTES));

const failed = results.filter((r) => !r.ok);
console.log('\n[check-entry-bundle] ' + (results.length - failed.length) + '/' + results.length + ' checks passed');
if (failed.length) { console.error('FAIL: PresentationEditor is NOT cleanly code-split out of the renderer entry chunk.'); process.exit(1); }
console.log('OK: PresentationEditor is code-split out of the lean renderer entry chunk.');
