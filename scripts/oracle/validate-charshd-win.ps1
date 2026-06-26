# TEMP oracle: read paragraph-shading vs character (run) shading from a .docx via a FRESH hidden Word COM.
# PID-safe. Proves a sub-paragraph w:rPr/w:shd is seen by Word as CHARACTER shading (Range over the run),
# while the paragraph itself has NO shading. wdColorAutomatic = -16777216.
#   powershell -File scripts/oracle/validate-charshd-win.ps1 <abs .docx>
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
  $out.paragraphShading = [int]$doc.Paragraphs.Item(1).Shading.BackgroundPatternColor
  # Find the run "beta" and read its character shading
  $rng = $doc.Content
  $fnd = $rng.Find
  $fnd.Text = 'beta'
  $null = $fnd.Execute()
  if ($rng.Find.Found) {
    $out.found = $true
    $out.charShading = [int]$rng.Shading.BackgroundPatternColor
    $out.charText = $rng.Text
  } else { $out.found = $false }
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
