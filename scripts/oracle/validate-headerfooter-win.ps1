# scripts/oracle/validate-headerfooter-win.ps1 — read the primary HEADER + FOOTER text from a .docx via a
# FRESH hidden Word COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's;
# cleans up only what it opened + only the spawned PID. DisplayAlerts=0 -> a corrupt/repaired file raises a
# catchable COM error (reported ok=false). The header/footer surface had no Word-COM oracle before this.
#   powershell -File scripts/oracle/validate-headerfooter-win.ps1 <abs path .docx>
# Sections(1).Headers(1) / Footers(1) = wdHeaderFooterPrimary (the default pair the clone emits).
# Range.Text carries a trailing CR (char 13) — TrimEnd it. PASS = headerText 'HdrProbe' + footerText 'FtrProbe'.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-headerfooter-win.ps1 <abs .docx>"}'; exit 2 }
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
  $out.sectionCount = [int]$doc.Sections.Count
  if ($doc.Sections.Count -ge 1) {
    $sec = $doc.Sections.Item(1)
    $h = [string]$sec.Headers.Item(1).Range.Text
    $f = [string]$sec.Footers.Item(1).Range.Text
    $out.headerText = $h.TrimEnd([char]13, [char]10, [char]7)
    $out.footerText = $f.TrimEnd([char]13, [char]10, [char]7)
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
