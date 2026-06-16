# scripts/oracle/validate-open-win.ps1 — open a .docx in a FRESH hidden Word COM
# instance with alerts suppressed and report whether it opens cleanly (no repair).
# PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up
# only the doc it opened + only the spawned PID. With DisplayAlerts=0 a corrupt or
# auto-repaired file raises a catchable COM error -> reported as ok=false.
#   powershell -File scripts/oracle/validate-open-win.ps1 <abs path .docx>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-open-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }

$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0          # wdAlertsNone — a repair prompt becomes a COM error
  try { $word.AutomationSecurity = 3 } catch {}  # msoAutomationSecurityForceDisable
  $after = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($after | Where-Object { $before -notcontains $_ } | Select-Object -First 1)
  # Open(FileName, ConfirmConversions:=false, ReadOnly:=true, AddToRecentFiles:=false, ...,
  #      OpenAndRepair:=false) — disabling auto-repair so an invalid file errors instead of
  #      being silently fixed. Trailing args after ReadOnly use omitted-defaults via $missing.
  $false2 = $false; $true2 = $true
  $doc = $word.Documents.Open($abs, $false2, $true2, $false2)
  # If we got here the file opened without a repair dialog (alerts are errors).
  $out.ok = $true
  $out.tableCount = $doc.Tables.Count
  if ($doc.Tables.Count -ge 1) {
    $cell = $doc.Tables.Item(1).Rows.Item(1).Cells.Item(1)
    $out.cellVAlign = [int]$cell.VerticalAlignment      # wdCellAlignVerticalCenter = 1
    try { $out.cellTopBorder = [int]$cell.Borders.Item(-1).LineStyle } catch {}  # wdBorderTop
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
