# 015 oracle — read the 5 advanced character effects back from a .docx via a FRESH hidden Word COM.
# PID-safe (spawns its own WINWORD, kills only the spawned PID). Reads per-paragraph Range.Font:
#   p1 SmallCaps, p2 AllCaps, p3 Spacing (pt), p4 Position (pt), p5 Scaling (%).
#   powershell -File scripts/oracle/validate-fonteffects-win.ps1 <abs .docx>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
function FontOf($doc, $i) { $r = $doc.Paragraphs.Item($i).Range; if (($r.End - $r.Start) -gt 1) { $r.SetRange($r.Start, $r.End - 1) }; return $r.Font }
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $after = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($after | Where-Object { $before -notcontains $_ } | Select-Object -First 1)
  $doc = $word.Documents.Open($abs, $false, $true, $false)
  $out.ok = $true
  $out.paragraphCount = $doc.Paragraphs.Count
  $out.smallCaps = [bool](FontOf $doc 1).SmallCaps
  $out.allCaps = [bool](FontOf $doc 2).AllCaps
  $out.spacing = [double](FontOf $doc 3).Spacing
  $out.position = [double](FontOf $doc 4).Position
  $out.scaling = [int](FontOf $doc 5).Scaling
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
