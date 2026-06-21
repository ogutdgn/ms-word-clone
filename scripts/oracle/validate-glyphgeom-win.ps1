# scripts/oracle/validate-glyphgeom-win.ps1 — read Word's per-LINE wrap + first-word page X/Y (POINTS) for a .docx, to
# diff against the paged PE's painted lines (M6 glyph-metric tolerance). PID-safe: spawns its own hidden Word, kills
# ONLY the spawned PID. SELF-VERIFIES the Range.Information() enum ints in-run (X-page=5, Y-page=6, line#=10) — asserts
# the first char's X(5) ≈ the left margin AND a line-2 char's Y(6) > the line-1 Y (disambiguating X from Y, since both
# margins may equal). Iterates doc.Words (wraps fall on word boundaries) capped for speed; ComputeStatistics gives the
# true totals. NOT Window.GetPoint (needs Visible=true). Run SANDBOX-DISABLED.
#   powershell -NonInteractive -File scripts/oracle/validate-glyphgeom-win.ps1 <abs .docx>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-glyphgeom-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }

# enum ints — empirically pinned by scripts/m6-spike-enum.ps1 (only Information(3) was proven in-repo before)
$X = 5   # wdHorizontalPositionRelativeToPage (pt)
$Y = 6   # wdVerticalPositionRelativeToPage (pt)
$LN = 10 # wdFirstCharacterLineNumber

$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $after = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($after | Where-Object { $before -notcontains $_ } | Select-Object -First 1)
  $false2 = $false; $true2 = $true; $miss = [System.Reflection.Missing]::Value
  $doc = $word.Documents.Open($abs, $false2, $true2, $false2, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $false2)
  $doc.Repaginate()
  try { $word.ActiveWindow.View.Type = 3 } catch {}   # wdPrintView

  $leftMarginPt = [double]$doc.PageSetup.LeftMargin
  $out.leftMarginPt = $leftMarginPt
  $out.lines = [int]$doc.ComputeStatistics(1)   # wdStatisticLines
  $out.pages = [int]$doc.ComputeStatistics(2)   # wdStatisticPages

  # iterate words; a NEW line-number = the first word of a new painted line
  $perLine = New-Object System.Collections.ArrayList
  $words = $doc.Words
  $count = [int]$words.Count
  $lastLine = -1
  $y1 = $null; $y2 = $null   # line-1 + line-2 first-word Y, for the enum disambiguation
  $cap = [Math]::Min($count, 1200)   # bound time; ComputeStatistics still reports the true total
  $capped = $false
  for ($wi = 1; $wi -le $cap; $wi++) {
    $w = $words.Item($wi)
    $t = [string]$w.Text
    if ($t.Trim().Length -eq 0) { continue }   # skip whitespace-only words
    $r = $w.Duplicate; $r.Collapse(1)          # wdCollapseStart
    $curLine = [int]$r.Information($LN)         # NB: PowerShell vars are case-insensitive — do NOT name this $ln ($LN collision)
    if ($curLine -ne $lastLine) {
      $xPt = [double]$r.Information($X); $yPt = [double]$r.Information($Y)
      [void]$perLine.Add(@{ lineNumber = $curLine; start = [int]$r.Start; firstWordText = $t.Trim(); xPt = [Math]::Round($xPt, 2); yPt = [Math]::Round($yPt, 2) })
      if ($null -eq $y1) { $y1 = $yPt } elseif ($null -eq $y2) { $y2 = $yPt }
      $lastLine = $curLine
      if ($perLine.Count -ge 140) { $capped = $true; break }   # cap per-line detail (single-para tiny; multipage characterized)
    }
  }
  if ($cap -lt $count) { $capped = $true }
  $out.perLine = $perLine
  $out.capped = $capped   # the per-line list is truncated (multipage); ComputeStatistics lines/pages remain the true totals

  # SELF-VERIFY the enum ints: line-1 first-word X ≈ left margin, AND line-2 Y > line-1 Y (so 5=X, 6=Y, not swapped)
  # REQUIRE both: line-1 X ≈ left margin (so 5 is the horizontal-page enum) AND a line-2 whose Y is strictly greater
  # (so 6 is the vertical-page enum, not a swap). A fixture with only ONE line CANNOT disambiguate Y → enumOk=false
  # (honest: we never trust an unverified Y). All M6 single-para fixtures wrap to ≥4 lines, so this passes for real data.
  $enumOk = $false; $enumDetail = ''
  if ($perLine.Count -ge 2) {
    $x1 = [double]$perLine[0].xPt
    $xNearMargin = [Math]::Abs($x1 - $leftMarginPt) -le 4
    $yIncreases = ($null -ne $y2) -and ($y2 -gt $y1 + 1)
    $enumOk = $xNearMargin -and $yIncreases
    $enumDetail = "x1=$x1 leftMargin=$leftMarginPt xNearMargin=$xNearMargin y1=$y1 y2=$y2 yIncreases=$yIncreases"
  } else { $enumDetail = "needs >=2 lines to verify Y; got $($perLine.Count)" }
  $out.enumCheck = @{ ok = $enumOk; detail = $enumDetail; X = $X; Y = $Y; LN = $LN }
  $out.ok = $enumOk
} catch {
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress -Depth 6)
