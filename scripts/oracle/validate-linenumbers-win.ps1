# scripts/oracle/validate-linenumbers-win.ps1 — read the section's LINE NUMBERING from a .docx via a FRESH
# hidden Word COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up
# only the spawned PID. OpenAndRepair:=false so a malformed .docx ERRORS (ok=false) instead of being silently
# repaired.
#   powershell -File scripts/oracle/validate-linenumbers-win.ps1 <abs path .docx>
# Read-backs: Sections(1).PageSetup.LineNumbering .Active / .RestartMode / .CountBy / .StartingNumber /
#   .DistanceFromText (points). RestartMode is the WdNumberingRule enum: wdRestartContinuous=0,
#   wdRestartPage=1, wdRestartSection=2 (asserted in range as enumCheck).
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-linenumbers-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false; openedWithoutRepair = $false; enumCheck = $false }
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
    $lnum = $doc.Sections.Item(1).PageSetup.LineNumbering
    $out.lineNumbersActive = ([int]$lnum.Active -ne 0)
    $rmode = [int]$lnum.RestartMode
    $out.restartMode = $rmode
    # enum sanity: RestartMode must be in the documented WdNumberingRule range {0,1,2}.
    $out.enumCheck = ($rmode -ge 0 -and $rmode -le 2)
    switch ($rmode) { 0 { $out.restartLabel = 'continuous' } 1 { $out.restartLabel = 'newPage' } 2 { $out.restartLabel = 'newSection' } default { $out.restartLabel = 'unknown' } }
    try { $out.countBy = [int]$lnum.CountBy } catch {}
    try { $out.startingNumber = [int]$lnum.StartingNumber } catch {}
    try { $out.distanceFromText = [double]$lnum.DistanceFromText } catch {}  # points
  }
  # P3: per-paragraph suppress — find the SUPPRESSME marker paragraph; read its pPr (Range.WordOpenXML) and assert
  # it carries an ON w:suppressLineNumbers (bare, NOT w:val="0"). suppressMarkerFound guards against a silent
  # import-drop of the whole paragraph.
  $out.suppressMarkerFound = $false
  $out.paragraphSuppressed = $false
  try {
    foreach ($p in $doc.Paragraphs) {
      $txt = ''
      try { $txt = [string]$p.Range.Text } catch {}
      if ($txt -like '*SUPPRESSME*') {
        $out.suppressMarkerFound = $true
        $xml = ''
        try { $xml = [string]$p.Range.WordOpenXML } catch {}
        if ($xml -match '<w:suppressLineNumbers(?![^>]*w:val="0")') { $out.paragraphSuppressed = $true }
        break
      }
    }
  } catch {}
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
