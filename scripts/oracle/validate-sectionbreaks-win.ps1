# scripts/oracle/validate-sectionbreaks-win.ps1 — read the SECTION layout from a .docx via a FRESH hidden Word
# COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up only the spawned
# PID. OpenAndRepair:=false so a malformed .docx ERRORS (ok=false) instead of being silently repaired.
#   powershell -File scripts/oracle/validate-sectionbreaks-win.ps1 <abs path .docx>
# Read-backs: ActiveDocument.Sections.Count + each Sections(i).PageSetup.SectionStart (WdSectionStart enum:
#   wdSectionContinuous=0 / wdSectionNewColumn=1 / wdSectionNewPage=2 / wdSectionEvenPage=3 / wdSectionOddPage=4).
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-sectionbreaks-win.ps1 <abs .docx>"}'; exit 2 }
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
  $no = $false; $yes = $true; $miss = [System.Reflection.Missing]::Value
  $doc = $word.Documents.Open($abs, $no, $yes, $no, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $no)
  $out.ok = $true
  $out.openedWithoutRepair = $true
  $out.sectionCount = [int]$doc.Sections.Count
  $starts = @()
  $enumOk = $true
  for ($i = 1; $i -le $doc.Sections.Count; $i++) {
    $s = [int]$doc.Sections.Item($i).PageSetup.SectionStart
    $starts += $s
    if ($s -lt 0 -or $s -gt 4) { $enumOk = $false }
  }
  $out.sectionStarts = $starts
  $out.enumCheck = $enumOk
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
