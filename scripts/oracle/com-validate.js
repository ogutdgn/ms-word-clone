/* Reusable Node → Word-COM bridge (M5+). Spawns a scripts/oracle/validate-*-win.ps1 on a .docx and parses its
   JSON stdout. PID-safety lives in each validate-*-win.ps1 (it spawns its OWN hidden WINWORD and kills ONLY that
   spawned PID in a finally — never GetActiveObject, never the user's window); this helper adds no GetActiveObject.

   IMPORTANT: the CALLER must run sandbox-DISABLED — Word COM hangs at `New-Object Word.Application` inside a
   restricted sandbox. (E.g. `npm run test:roundtrip:paged` must be invoked via the dangerously-disable-sandbox path.)

   Usage:
     const { comValidate, winwordPids } = require('./scripts/oracle/com-validate');
     const r = comValidate('validate-open-win.ps1', 'C:/tmp/wc-paged-m5-kitchensink.docx');
     if (!r.ok) fail(r.json && r.json.error);
*/
const { spawnSync } = require('child_process');
const path = require('path');

const oracleDir = __dirname; // scripts/oracle

function parseLastJson(s) {
  // Each validate-*-win.ps1 emits its result as ONE `ConvertTo-Json -Compress` line. Scan bottom-up and return the
  // first line that parses AND looks like a RESULT object (has ok/error/path) — so a future diagnostic line that
  // happens to start with '{' can't be mistaken for the result. Fall back to the last parseable object otherwise.
  const lines = String(s || '').trim().split(/\r?\n/).reverse();
  let fallback = null;
  for (const ln of lines) {
    const t = ln.trim();
    if (!t.startsWith('{')) continue;
    let obj; try { obj = JSON.parse(t); } catch (e) { continue; }
    if (obj && (Object.prototype.hasOwnProperty.call(obj, 'ok') || Object.prototype.hasOwnProperty.call(obj, 'error') || Object.prototype.hasOwnProperty.call(obj, 'path'))) return obj;
    if (fallback === null) fallback = obj;
  }
  return fallback;
}

// Spawn validate-<name>-win.ps1 <docxAbsPath> [...extraArgs] → { ok, json, raw, stderr, status, error }.
// Never throws on a non-zero exit (returns ok:false so the driver reports it).
function comValidate(scriptName, docxAbsPath, extraArgs = []) {
  const script = path.join(oracleDir, scriptName);
  const r = spawnSync('powershell.exe', ['-NonInteractive', '-File', script, docxAbsPath, ...extraArgs], { encoding: 'utf8', timeout: 150000 });
  const raw = r.stdout || '';
  const json = parseLastJson(raw);
  return {
    ok: !!(json && json.ok === true),
    json,
    raw,
    stderr: (r.stderr || '').trim(),
    status: r.status,
    error: r.error ? String((r.error && r.error.message) || r.error) : null,
  };
}

// Current WINWORD PIDs (for a before/after PID-safety assertion in the driver).
function winwordPids() {
  const r = spawnSync('powershell.exe', ['-NonInteractive', '-Command', '(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id) -join ","'], { encoding: 'utf8', timeout: 30000 });
  return (r.stdout || '').trim().split(',').filter(Boolean).map(Number);
}

module.exports = { comValidate, winwordPids, parseLastJson };
