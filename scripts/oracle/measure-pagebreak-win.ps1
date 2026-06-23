# measure-pagebreak-win.ps1 — GROUND TRUTH for page-break / blank-page behavior in real Word.
# PID-safe: spawns its own invisible Word, measures live edits on FRESH empty docs, kills only the spawned PID.
# Reports page count (wdStatisticPages=2), paragraph count, and the selection's active-end page (wdActiveEndPageNumber=3)
# for: (1) empty baseline, (2) one page break (Ctrl+Enter), (3) two page breaks (the "Blank Page" = 2-breaks model),
# (4) "Hello" + one page break.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$out = @{ ok = $false }
$pidsBefore = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $spawnedPid = $null
$wdPageBreak = 7; $wdStatPages = 2; $wdActiveEndPage = 3
function Snap($doc, $word) {
  return @{
    pages = [int]$doc.ComputeStatistics($wdStatPages)
    paras = [int]$doc.Paragraphs.Count
    selPage = [int]$word.Selection.Information($wdActiveEndPage)
    selStart = [int]$word.Selection.Start
  }
}
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false; $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $pidsAfter = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($pidsAfter | Where-Object { $pidsBefore -notcontains $_ } | Select-Object -First 1)

  # (1) empty baseline
  $d1 = $word.Documents.Add()
  $out.baseline = Snap $d1 $word
  $d1.Close([ref]$false)

  # (2) one page break on an empty doc (Ctrl+Enter)
  $d2 = $word.Documents.Add()
  $word.Selection.InsertBreak([ref]$wdPageBreak)
  $out.onePageBreak = Snap $d2 $word
  $d2.Close([ref]$false)

  # (3) two page breaks on an empty doc (the Blank-Page = two-breaks model)
  $d3 = $word.Documents.Add()
  $word.Selection.InsertBreak([ref]$wdPageBreak)
  $word.Selection.InsertBreak([ref]$wdPageBreak)
  $out.twoPageBreaks = Snap $d3 $word
  $d3.Close([ref]$false)

  # (4) "Hello" then one page break
  $d4 = $word.Documents.Add()
  $word.Selection.TypeText("Hello")
  $word.Selection.InsertBreak([ref]$wdPageBreak)
  $out.helloThenBreak = Snap $d4 $word
  $d4.Close([ref]$false)

  $out.ok = $true
} catch {
  $out.error = $_.Exception.Message
} finally {
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Depth 5 -Compress)
