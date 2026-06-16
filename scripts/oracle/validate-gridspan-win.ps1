# scripts/oracle/validate-gridspan-win.ps1 — open a .docx with a horizontally-merged table cell in a
# FRESH hidden Word COM instance and confirm it opens WITHOUT repair (the corruption signal), reading
# the merged row structure. PID-safe: spawns its own invisible Word, never attaches to the user's;
# cleans up only what it opened + only the spawned PID. DisplayAlerts=0 → a repaired/corrupt file
# raises a catchable COM error (reported ok=false).
#   powershell -File scripts/oracle/validate-gridspan-win.ps1 <abs path .docx>
# A horizontal merge spans grid columns; Rows(1).Cells.Count reflects the merged (reduced) count.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-gridspan-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }

$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $after = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($after | Where-Object { $before -notcontains $_ } | Select-Object -First 1)
  $doc = $word.Documents.Open($abs, $false, $true, $false)
  $out.ok = $true   # reached here => opened without a repair dialog
  $out.tableCount = $doc.Tables.Count
  if ($doc.Tables.Count -ge 1) {
    $t = $doc.Tables.Item(1)
    try { $out.row1Cells = [int]$t.Rows.Item(1).Cells.Count } catch { $out.row1CellsErr = $_.Exception.Message }
    try { $out.row2Cells = [int]$t.Rows.Item(2).Cells.Count } catch { $out.row2CellsErr = $_.Exception.Message }
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
