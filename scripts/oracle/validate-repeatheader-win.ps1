# scripts/oracle/validate-repeatheader-win.ps1 — read the first table row's HeadingFormat (the
# "repeat as header row at top of each page" flag) from a .docx via a FRESH hidden Word COM instance.
# PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up only what it opened
# + only the spawned PID. With DisplayAlerts=0 a corrupt/repaired file raises a catchable COM error.
#   powershell -File scripts/oracle/validate-repeatheader-win.ps1 <abs path .docx>
# Word COM Row.HeadingFormat is True(-1)/False(0).
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-repeatheader-win.ps1 <abs .docx>"}'; exit 2 }
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
    $out.row1HeadingFormat = [int]$doc.Tables.Item(1).Rows.Item(1).HeadingFormat
    $out.row2HeadingFormat = [int]$doc.Tables.Item(1).Rows.Item(2).HeadingFormat
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
