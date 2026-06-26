# 016 oracle — read paragraph line-spacing rule/value + first-line indent back from a .docx via a
# FRESH hidden Word COM. PID-safe. p1 = Exactly 18pt + 0.5" first line; p2 = At least 14pt.
# WdLineSpacing: Single=0, 1pt5=1, Double=2, AtLeast=3, Exactly=4, Multiple=5.
#   powershell -File scripts/oracle/validate-paragraph-win.ps1 <abs .docx>
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
  $doc = $word.Documents.Open($abs, $false, $true, $false)
  $out.ok = $true
  $p1 = $doc.Paragraphs.Item(1).Format
  $out.p1_lineSpacingRule = [int]$p1.LineSpacingRule
  $out.p1_lineSpacing = [double]$p1.LineSpacing
  $out.p1_firstLineIndent = [double]$p1.FirstLineIndent
  $p2 = $doc.Paragraphs.Item(2).Format
  $out.p2_lineSpacingRule = [int]$p2.LineSpacingRule
  $out.p2_lineSpacing = [double]$p2.LineSpacing
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
