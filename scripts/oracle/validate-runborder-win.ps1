# 019 oracle — validate a run-level (character) border .docx via a FRESH hidden Word COM. PID-safe.
# Character borders (rPr/<w:bdr>) have no clean COM read property, so the fidelity check is: Word OPENS the file
# WITHOUT repair (OpenAndRepair off) — i.e. the <w:bdr> is valid OOXML Word accepts — and the bordered run text
# is intact. (Exact val/sz/color are asserted structurally by test:pm; reimport stability by test:roundtrip.)
#   powershell -File scripts/oracle/validate-runborder-win.ps1 <abs .docx>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage"}'; exit 2 }
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
  # OpenAndRepair = $false (4th arg): if the file needed repair, Open throws → caught → ok stays false.
  $doc = $word.Documents.Open($abs, $false, $true, $false)
  $out.ok = $true
  $out.opened = $true
  $txt = [string]$doc.Paragraphs.Item(1).Range.Text
  $out.para1Text = $txt.Trim()
  $out.hasBorderedRun = [bool]($txt -match 'RBORD')
  $out.pass = ($out.ok -and $out.hasBorderedRun)
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
