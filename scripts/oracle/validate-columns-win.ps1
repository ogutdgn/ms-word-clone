# scripts/oracle/validate-columns-win.ps1 — read the section's COLUMN layout from a .docx via a FRESH hidden
# Word COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up only the
# spawned PID. OpenAndRepair:=false so a malformed .docx ERRORS (ok=false) instead of being silently repaired.
#   powershell -File scripts/oracle/validate-columns-win.ps1 <abs path .docx>
# Read-backs: Sections(1).PageSetup.TextColumns .Count / .EvenlySpaced / .Spacing (points).
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-columns-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false; openedWithoutRepair = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }

$pidsBefore = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $pidsAfter = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($pidsAfter | Where-Object { $pidsBefore -notcontains $_ } | Select-Object -First 1)
  # OpenAndRepair:=false (positional arg 13; intervening optionals padded with [Reflection.Missing]::Value).
  $no = $false; $yes = $true; $miss = [System.Reflection.Missing]::Value
  $doc = $word.Documents.Open($abs, $no, $yes, $no, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $no)
  $out.ok = $true
  $out.openedWithoutRepair = $true
  $out.sectionCount = [int]$doc.Sections.Count
  if ($doc.Sections.Count -ge 1) {
    $tc = $doc.Sections.Item(1).PageSetup.TextColumns
    $out.columnCount = [int]$tc.Count
    $out.evenlySpaced = ([int]$tc.EvenlySpaced -ne 0)
    try { $out.spacing = [double]$tc.Spacing } catch {}  # inter-column spacing, in points
    try { $out.lineBetween = ([int]$tc.LineBetween -ne 0) } catch {}  # the separator line (w:cols/@w:sep)
    try {
      $ws = @()
      for ($i = 1; $i -le [int]$tc.Count; $i++) { $ws += [double]$tc.Item($i).Width }  # per-column widths (points)
      $out.columnWidths = $ws
    } catch {}
  }
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try {
    if ($spawnedPid) {
      $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue
      if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue }
    }
  } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
