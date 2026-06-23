# 012 (frames group) Word-COM oracle — opens a paged-exported .docx with a floating picture that was rotated +
# flipped + positioned, and reads back Shape.Rotation / HorizontalFlip / Left / WrapFormat.Type in REAL Word for
# Windows. PID-safe: spawns its own hidden Word, kills ONLY the spawned PID. OpenAndRepair:=false so a silent repair
# (=corruption) fails the open. Emits a single JSON line for com-validate.js / a node assertion.
param([string]$Path = 'C:\tmp\wc-frames-probe.docx')
$ErrorActionPreference = 'Stop'
$out = [ordered]@{ ok = $false; opened = $false }
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
try {
  if (-not (Test-Path $Path)) { throw "fixture missing: $Path" }
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false; $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $after = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($after | Where-Object { $before -notcontains $_ } | Select-Object -First 1)
  $f = $false; $t = $true; $miss = [System.Reflection.Missing]::Value
  $doc = $word.Documents.Open($Path, $f, $t, $f, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $f)
  $out.opened = $true
  $out.inlineShapes = [int]$doc.InlineShapes.Count
  $out.shapes = [int]$doc.Shapes.Count
  if ($doc.Shapes.Count -ge 1) {
    $s = $doc.Shapes.Item(1)
    $out.rotation = [double]$s.Rotation
    try { $out.horizontalFlip = [int]$s.HorizontalFlip } catch { $out.horizontalFlip = -2 }  # msoTriState: -1 true / 0 false
    $out.leftPt = [Math]::Round([double]$s.Left, 2)
    $out.topPt = [Math]::Round([double]$s.Top, 2)
    try { $out.relHPos = [int]$s.RelativeHorizontalPosition } catch {}
    try { $out.wrapType = [int]$s.WrapFormat.Type } catch {}
    try { $out.shapeType = [int]$s.Type } catch {}
  }
  $out.ok = $true
} catch {
  $out.error = $_.Exception.Message
} finally {
  if ($doc) { try { $doc.Close($false) } catch {} }
  if ($word) { try { $word.Quit() } catch {} }
  if ($spawnedPid) { try { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } catch {} }
}
$out | ConvertTo-Json -Depth 4 -Compress
