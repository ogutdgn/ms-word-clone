# scripts/oracle/validate-paraspacing-win.ps1 — read paragraph spacing from a .docx via a FRESH hidden
# Word COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up
# only what it opened + only the spawned PID. DisplayAlerts=0 -> a corrupt/repaired file raises a
# catchable COM error (reported ok=false). The Design tab had no Word-COM oracle before this.
#   powershell -File scripts/oracle/validate-paraspacing-win.ps1 <abs path .docx>
# Paragraphs.Item(1).SpaceBefore / .SpaceAfter are floats in POINTS — they confirm Word resolves the
# spacing (set into docDefaults + Normal) for a plain inheriting paragraph. .LineSpacing is the line
# value; .LineSpacingRule is the WdLineSpacing enum: Single=0, 1pt5=1, Double=2, AtLeast=3, Exactly=4,
# Multiple=5 (a line multiple of 3.0 reads as Multiple=5, LineSpacing=36).
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-paraspacing-win.ps1 <abs .docx>"}'; exit 2 }
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
  $out.paragraphCount = [int]$doc.Paragraphs.Count
  if ($doc.Paragraphs.Count -ge 1) {
    # Distinct name from the finally's $p (Get-Process result) — avoid the latent shadowing footgun.
    $para = $doc.Paragraphs.Item(1)
    $out.spaceBefore = [double]$para.SpaceBefore
    $out.spaceAfter = [double]$para.SpaceAfter
    $out.lineSpacing = [double]$para.LineSpacing
    $out.lineSpacingRule = [int]$para.LineSpacingRule
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
