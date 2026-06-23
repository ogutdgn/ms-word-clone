# measure-pbb-overflow-win.ps1 — GROUND TRUTH for the EXACT structure our app produces:
#   [N paragraphs of body text] + [a trailing EMPTY paragraph carrying w:pageBreakBefore]
# Question (Bug 2): once the N body paragraphs overflow page 1, does Word put the trailing empty
# pageBreakBefore paragraph on its OWN extra page (matching our engine), or not?
# Also measures the same N body paragraphs WITHOUT the trailing pbb paragraph as a control.
# PID-safe: spawns its own invisible Word, kills only the spawned PID.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$out = @{ ok = $false; cases = @() }
$pidsBefore = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $spawnedPid = $null
$wdStatPages = 2

function BodyChunk([int]$wordsPerPara) {
  $a = @(); for ($i = 0; $i -lt $wordsPerPara; $i++) { $a += ('w' + ($i % 10)) }
  return ($a -join ' ')
}

# Build a doc with N body paragraphs; optionally add a trailing empty paragraph with PageBreakBefore.
function MakeCase($word, [int]$nParas, [int]$wordsPerPara, [bool]$withPbb) {
  $d = $word.Documents.Add()
  $sel = $word.Selection
  $chunk = BodyChunk $wordsPerPara
  for ($i = 0; $i -lt $nParas; $i++) {
    $sel.TypeText($chunk)
    if ($i -lt $nParas - 1) { $sel.TypeParagraph() }
  }
  if ($withPbb) {
    # Start a fresh trailing paragraph and set PageBreakBefore on it (the OOXML <w:pageBreakBefore/> our app emits).
    $sel.TypeParagraph()
    $sel.ParagraphFormat.PageBreakBefore = $true
  }
  $pages = [int]$d.ComputeStatistics($wdStatPages)
  $paras = [int]$d.Paragraphs.Count
  $d.Close([ref]$false)
  return @{ nParas = $nParas; wordsPerPara = $wordsPerPara; withPbb = $withPbb; pages = $pages; paras = $paras }
}

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false; $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $pidsAfter = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($pidsAfter | Where-Object { $pidsBefore -notcontains $_ } | Select-Object -First 1)

  foreach ($n in @(0, 20, 40, 60, 80)) {
    $out.cases += (MakeCase $word $n 8 $true)    # WITH trailing pageBreakBefore paragraph (our app's structure)
    $out.cases += (MakeCase $word $n 8 $false)   # control: body only, no pbb paragraph
  }
  $out.ok = $true
} catch {
  $out.error = $_.Exception.Message
} finally {
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Depth 6 -Compress)
