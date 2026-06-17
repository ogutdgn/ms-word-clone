# scripts/oracle/validate-picteffect-win.ps1 — read a PICTURE's recolor (grayscale) from a .docx via a
# FRESH hidden Word COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's;
# cleans up only what it opened + only the spawned PID. DisplayAlerts=0 -> a corrupt/repaired file raises a
# catchable COM error (reported ok=false). The picture-effect surface had no Word-COM oracle before this.
#   powershell -File scripts/oracle/validate-picteffect-win.ps1 <abs path .docx>
# InlineShapes.Item(1).PictureFormat.ColorType is the MsoPictureColorType enum, which is 1-BASED:
#   msoPictureAutomatic=1, msoPictureGrayscale=2, msoPictureBlackAndWhite=3, msoPictureWatermark=4.
# So GRAYSCALE reads as 2 (NOT 3 — an earlier attempt mis-read 2 as BlackAndWhite via a 0-based enum and
# wrongly reverted the a:grayscl work; a:grayscl IS Word-faithful, verified by authoring grayscale in Word).
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-picteffect-win.ps1 <abs .docx>"}'; exit 2 }
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
  $out.inlineShapeCount = [int]$doc.InlineShapes.Count
  if ($doc.InlineShapes.Count -ge 1) {
    $ct = [int]$doc.InlineShapes.Item(1).PictureFormat.ColorType
    $out.colorType = $ct
    $out.isGrayscale = ($ct -eq 2)   # msoPictureGrayscale (1-based enum)
  }
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
