# scripts/oracle/validate-bookmark-win.ps1 — read the bookmarks from a .docx via a FRESH hidden Word COM
# instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up only what it
# opened + only the spawned PID. DisplayAlerts=0 → a corrupt/repaired file raises a catchable COM error.
#   powershell -File scripts/oracle/validate-bookmark-win.ps1 <abs path .docx> [expectedName]
# doc.Bookmarks.Exists(name) / .Item(name).Name confirm a valid named bookmark survived export.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
$expected = if ($args.Count -ge 2) { $args[1] } else { 'spot1' }
if (-not $path) { Write-Output '{"error":"usage: validate-bookmark-win.ps1 <abs .docx> [name]"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false; expected = $expected }
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
  $out.bookmarkCount = $doc.Bookmarks.Count
  $out.exists = [bool]$doc.Bookmarks.Exists($expected)
  if ($doc.Bookmarks.Exists($expected)) { $out.name = [string]$doc.Bookmarks.Item($expected).Name }
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
