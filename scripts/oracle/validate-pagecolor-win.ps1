# scripts/oracle/validate-pagecolor-win.ps1 — attempt to read the PAGE COLOR (page background) from a
# .docx via a FRESH hidden Word COM instance. PID-safe: spawns its own invisible Word, never attaches to
# the user's; cleans up only what it opened + only the spawned PID. DisplayAlerts=0 -> a corrupt/repaired
# file raises a catchable COM error (reported ok=false).
#   powershell -File scripts/oracle/validate-pagecolor-win.ps1 <abs path .docx>
# NOTE: Word's page-background COM surface (doc.Background -> a Shape, .Fill.ForeColor.RGB) is
# SOMETIMES unreadable — .Background can be $null until rendered, and .Fill / ActiveWindow reads can
# throw on a truly headless session. In practice on this Win+Word-16 box it reads CLEANLY (the probed
# yellow page color returned Fill.ForeColor.RGB=65535, Fill.Type=1 solid, DisplayBackgrounds=true). So
# each read is GUARDED (a throw becomes a '<unreadable: ...>' sentinel, never an ok=false) and the
# byte test (<w:background w:color> + displayBackgroundShape) remains the authoritative gate.
# WdColor RGB long: yellow FFFF00 == 65535 (R=255 + G=255*256). DisplayBackgrounds is a view setting.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-pagecolor-win.ps1 <abs .docx>"}'; exit 2 }
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
  # Best-effort page-background reads — each guarded; absence/throw is itself the (honest) finding.
  try { $out.displayBackgrounds = [bool]$word.ActiveWindow.View.DisplayBackgrounds } catch { $out.displayBackgrounds = '<unreadable: ' + $_.Exception.Message + '>' }
  try {
    $bg = $doc.Background
    if ($null -eq $bg) { $out.backgroundShape = '<null>' }
    else {
      $out.backgroundShape = 'present'
      try { $out.bgFillType = [int]$bg.Fill.Type } catch { $out.bgFillType = '<unreadable>' }
      try { $out.bgForeColorRGB = [int64]$bg.Fill.ForeColor.RGB } catch { $out.bgForeColorRGB = '<unreadable: ' + $_.Exception.Message + '>' }
    }
  } catch { $out.backgroundShape = '<unreadable: ' + $_.Exception.Message + '>' }
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
