# scripts/oracle/validate-vertalign-win.ps1 — read sub/superscript (Font.Subscript / Font.Superscript)
# for paragraphs 1 and 2 from a .docx via a FRESH hidden Word COM instance. PID-safe: spawns its own
# invisible Word, never attaches to the user's; cleans up only what it opened + only the spawned PID.
# DisplayAlerts=0 → a corrupt/repaired file raises a catchable COM error (reported ok=false).
#   powershell -File scripts/oracle/validate-vertalign-win.ps1 <abs path .docx>
# Font.Subscript / Font.Superscript are True(-1)/False(0). Reads TEXT-ONLY ranges (exclude the pilcrow).
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-vertalign-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }

$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
function TextRange($p) { $r = $p.Range; if (($r.End - $r.Start) -gt 1) { $r.SetRange($r.Start, $r.End - 1) }; return $r }
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
  if ($doc.Paragraphs.Count -ge 1) { $out.para1Subscript = [int](TextRange $doc.Paragraphs.Item(1)).Font.Subscript }
  if ($doc.Paragraphs.Count -ge 2) { $out.para2Superscript = [int](TextRange $doc.Paragraphs.Item(2)).Font.Superscript }
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
