# scripts/oracle/validate-pagesetup-win.ps1 — read PAGE SETUP (margins / page size / orientation) from a
# .docx via a FRESH hidden Word COM instance. PID-safe: spawns its own invisible Word, never attaches to
# the user's; cleans up only what it opened + only the spawned PID. DisplayAlerts=0 -> a corrupt/repaired
# file raises a catchable COM error (reported ok=false). The LAYOUT geometry surface had no Word-COM
# oracle before this (and did not even export — setPageVar was CSS-only).
#   powershell -File scripts/oracle/validate-pagesetup-win.ps1 <abs path .docx>
# Sections(1).PageSetup: TopMargin/BottomMargin/LeftMargin/RightMargin + PageWidth/PageHeight are floats
# in POINTS (1in=72pt=1440twips; 0.5in=36pt; Legal 8.5x14in=612x1008pt). Orientation is the WdOrientation
# enum (wdOrientPortrait=0, wdOrientLandscape=1). For Legal+landscape, PageWidth=1008 / PageHeight=612.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-pagesetup-win.ps1 <abs .docx>"}'; exit 2 }
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
    $ps = $doc.Sections.Item(1).PageSetup
    $out.topMarginPt = [double]$ps.TopMargin
    $out.bottomMarginPt = [double]$ps.BottomMargin
    $out.leftMarginPt = [double]$ps.LeftMargin
    $out.rightMarginPt = [double]$ps.RightMargin
    $out.pageWidthPt = [double]$ps.PageWidth
    $out.pageHeightPt = [double]$ps.PageHeight
    $out.orientation = [int]$ps.Orientation
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
