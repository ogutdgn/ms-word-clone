# 020 oracle — read a gradient text fill back from a .docx via a FRESH hidden Word COM. PID-safe.
# Word exposes a w14:textFill gradient via Range.Font.Fill (a FillFormat): .Type == msoFillGradient (3),
# .GradientStops.Count == the number of stops. validate-open (OpenAndRepair off) also proves the OOXML is valid.
#   powershell -File scripts/oracle/validate-gradient-win.ps1 <abs .docx>
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
  $doc = $word.Documents.Open($abs, $false, $true, $false) # OpenAndRepair off → throws if invalid
  $out.ok = $true
  $rng = $doc.Paragraphs.Item(1).Range
  $out.para1Text = ([string]$rng.Text).Trim()
  try {
    $fill = $rng.Font.Fill
    $out.fillType = [int]$fill.Type   # msoFillGradient = 3
    try { $out.gradientStops = [int]$fill.GradientStops.Count } catch {}
  } catch { $out.fillReadError = $_.Exception.Message }
  # pass: the doc opened clean (valid w14:textFill) AND Word reports the fill as a gradient (msoFillGradient = 3).
  $out.pass = ($out.ok -and ($out.fillType -eq 3))
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
