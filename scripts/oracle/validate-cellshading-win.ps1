# scripts/oracle/validate-cellshading-win.ps1 — read the first table cell's shading
# (BackgroundPatternColor) from a .docx via a FRESH hidden Word COM instance. PID-safe: spawns its own
# invisible Word, never attaches to the user's; cleans up only what it opened + only the spawned PID.
# With DisplayAlerts=0 a corrupt/repaired file raises a catchable COM error (reported ok=false).
#   powershell -File scripts/oracle/validate-cellshading-win.ps1 <abs path .docx>
# Cell.Shading.BackgroundPatternColor is a wdColor RGB long (R + G*256 + B*65536); pure red = 255.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-cellshading-win.ps1 <abs .docx>"}'; exit 2 }
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
  $out.ok = $true
  $out.tableCount = $doc.Tables.Count
  if ($doc.Tables.Count -ge 1) {
    $cell = $doc.Tables.Item(1).Rows.Item(1).Cells.Item(1)
    $out.backgroundPatternColor = [int]$cell.Shading.BackgroundPatternColor
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
