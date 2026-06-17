# scripts/oracle/validate-pageborders-win.ps1 — read PAGE borders from a .docx via a FRESH hidden Word
# COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up only
# what it opened + only the spawned PID. DisplayAlerts=0 -> a corrupt/repaired file raises a catchable
# COM error (reported ok=false). The Design page-border surface had no Word-COM oracle before this.
#   powershell -File scripts/oracle/validate-pageborders-win.ps1 <abs path .docx>
# For a Section, .Borders IS the PAGE border collection. .Item(wdBorderTop=-1).LineStyle (WdLineStyle:
# Single=1), .LineWidth (WdLineWidth: 050pt=4, 075pt=6, 100pt=8, 150pt=12, 225pt=18, 300pt=24),
# .Color (WdColor RGB long; red FF0000 == 255). .Enable confirms page borders are on.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-pageborders-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }

$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
# WdBorderType: Top=-1, Left=-2, Bottom=-3, Right=-4. Read ALL FOUR edges so an asymmetric/partial
# export (e.g. top written but bottom/left/right dropped) is caught, not masked by a top-only read.
$edgeIds = @{ top = -1; left = -2; bottom = -3; right = -4 }
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
    $borders = $doc.Sections.Item(1).Borders
    try { $out.bordersEnable = [bool]$borders.Enable } catch {}
    foreach ($edge in $edgeIds.Keys) {
      $b = $borders.Item($edgeIds[$edge])
      $out[$edge + 'LineStyle'] = [int]$b.LineStyle
      $out[$edge + 'LineWidth'] = [int]$b.LineWidth
      $out[$edge + 'Color'] = [int64]$b.Color
    }
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
