# scripts/oracle/validate-comments-win.ps1 — read comments from a .docx via a FRESH hidden Word COM
# instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up only what
# it opened + only the spawned PID. DisplayAlerts=0 -> a corrupt/repaired file raises a catchable COM
# error (reported ok=false). The review area had no Word-COM oracle before this.
#   powershell -File scripts/oracle/validate-comments-win.ps1 <abs path .docx>
# doc.Comments.Count confirms Word reads the exported comment as a REAL comment; .Item(1).Range.Text is
# the comment body and .Item(1).Author the author — both confirm the body/author survived export. The
# anchored ("scope") text is .Item(1).Scope.Text.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-comments-win.ps1 <abs .docx>"}'; exit 2 }
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
  $out.commentCount = [int]$doc.Comments.Count
  if ($doc.Comments.Count -ge 1) {
    $c = $doc.Comments.Item(1)
    $out.comment1Text = [string]$c.Range.Text
    $out.comment1Author = [string]$c.Author
    # Scope is the anchored span. A broken/absent commentRangeStart/End (the
    # endnote-class bug this oracle exists to catch) can make .Scope.Text throw or
    # read empty — emit a sentinel rather than swallowing, so "broken anchor" is
    # VISIBLE in the JSON and not confused with "field not emitted".
    try { $out.comment1Scope = [string]$c.Scope.Text } catch { $out.comment1Scope = '<scope-error: ' + $_.Exception.Message + '>' }
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
