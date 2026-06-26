# 021 oracle — read a NEW custom style back from a .docx via a FRESH hidden Word COM. PID-safe.
# Confirms Word reads the user-created style 'WcStyleRed' as a paragraph style with the captured formatting:
# Type == wdStyleTypeParagraph (1), Font.Bold == True (-1), Font.Size == 20, Font.Color.RGB == 255 (red, BGR int).
#   powershell -File scripts/oracle/validate-createstyle-win.ps1 <abs .docx>
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
  $style = $doc.Styles.Item('WcStyleRed')   # by name; throws if the style isn't in the document
  $out.styleExists = $true
  $out.styleType = [int]$style.Type          # wdStyleTypeParagraph = 1
  $out.fontBold = [int]$style.Font.Bold      # True = -1
  $out.fontSize = [double]$style.Font.Size
  # Word reads the red via Font.TextColor.RGB (the legacy Font.Color.RGB is unreliable for a direct style rPr color
  # and often reports 0). Gate on TextColor (255 = red, BGR int); report the legacy Color too for evidence.
  try { $out.fontColorRGB = [int]$style.Font.Color.RGB } catch {}
  try { $out.fontTextColorRGB = [int]$style.Font.TextColor.RGB } catch {}
  $out.pass = ($out.styleExists -and $out.styleType -eq 1 -and $out.fontBold -eq -1 -and $out.fontSize -eq 20 -and $out.fontTextColorRGB -eq 255)
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
