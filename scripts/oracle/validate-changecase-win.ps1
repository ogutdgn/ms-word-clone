# Oracle: read back how the installed Word applies Change Case (Range.Case / WdCharacterCase)
# to fixed probe strings, so the clone's changeCase() can match Word EXACTLY. PID-safe: spawns
# its own hidden Word, kills only the spawned PID. Outputs JSON of {mode,input,output}.
#   powershell -File scripts/oracle/validate-changecase-win.ps1
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$out = @{ ok = $false; cases = @() }
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
# WdCharacterCase: lower=0 upper=1 titleWord=2 titleSentence=4 toggle=5
$probes = @(
  @{ mode = 'sentence(4)'; case = 4; input = 'end.New sentence here. another test' },
  @{ mode = 'sentence(4)'; case = 4; input = 'no.space here.test done' },
  @{ mode = 'sentence(4)'; case = 4; input = 'the QUICK brown FOX. the lazy DOG' },
  @{ mode = 'sentence(4)'; case = 4; input = 'hello! world? yes. ok' },
  @{ mode = 'toggle(5)'; case = 5; input = 'tOGGLE cASE eXAMPLE Text' },
  @{ mode = 'titleWord(2)'; case = 2; input = 'the quick brown fox' }
)
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $after = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($after | Where-Object { $before -notcontains $_ } | Select-Object -First 1)
  $doc = $word.Documents.Add()
  foreach ($p in $probes) {
    $rng = $doc.Content
    $rng.Text = $p.input
    $rng2 = $doc.Content
    $rng2.Case = [int]$p.case
    $res = $doc.Content.Text
    $res = $res -replace "[\r\n\a]+$", ''
    $out.cases += @{ mode = $p.mode; input = $p.input; output = $res }
  }
  $out.ok = $true
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Depth 5 -Compress)
