# scripts/oracle/validate-headerfooter-win.ps1 — read the HEADER + FOOTER surface from a .docx via a FRESH hidden
# Word COM instance. PID-safe: spawns its own invisible Word, never attaches to the user's; cleans up only what it
# opened + only the spawned PID. The header/footer surface had no Word-COM oracle before 002.
#   powershell -File scripts/oracle/validate-headerfooter-win.ps1 <abs path .docx>
#
# Read-backs (per phase):
#   P1  primaryHeader/primaryFooter = Sections(1).Headers(1)/Footers(1).Range.Text  (wdHeaderFooterPrimary=1)
#       (kept as headerText/footerText too — the M5 roundtrip gate asserts those names)
#   P2  differentFirstPage = PageSetup.DifferentFirstPageHeaderFooter (sectPr w:titlePg)
#       differentOddEven   = PageSetup.OddAndEvenPagesHeaderFooter   (settings w:evenAndOddHeaders)
#       firstHeader/firstFooter = Headers(2)/Footers(2)  (wdHeaderFooterFirstPage=2)
#       evenHeader/evenFooter   = Headers(3)/Footers(3)  (wdHeaderFooterEvenPages=3)
#
# Hardening:
#   • OpenAndRepair:=false (validate-open-win.ps1 positional form) so a malformed .docx ERRORS (ok=false) instead of
#     being silently repaired before read-back. openedWithoutRepair mirrors ok on the open.
#   • Enum self-verification — HeaderFooter.Index IS the wdHeaderFooterIndex; assert Headers(1/2/3).Index == 1/2/3
#     before trusting the variant reads (enumCheck=false ⇒ ok=false). M6 lesson: PowerShell variable names are
#     case-insensitive — the names below are kept distinct so none collides with a pinned constant.
#   • PID-safety — before/after WINWORD PID diff; finally Stop-Process only the spawned PID.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$path = $args[0]
if (-not $path) { Write-Output '{"error":"usage: validate-headerfooter-win.ps1 <abs .docx>"}'; exit 2 }
$abs = [System.IO.Path]::GetFullPath($path)
$out = @{ path = $abs; ok = $false; openedWithoutRepair = $false; enumCheck = $false }
if (-not (Test-Path $abs)) { $out.error = 'file not found'; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }

function Get-HFText($hf) { try { return ([string]$hf.Range.Text).TrimEnd([char]13, [char]10, [char]7) } catch { return '' } }
# P3: the first PAGE field (wdFieldPage=33) in a header/footer + its live result. 33 is empirically
# pinned; the returned `code` (~ "PAGE") cross-verifies the constant so the Node driver can assert both.
function Get-PageField($hf) {
  try {
    foreach ($f in $hf.Range.Fields) {
      if ([int]$f.Type -eq 33) {
        return @{ present = $true; type = [int]$f.Type; code = ([string]$f.Code.Text).Trim(); result = ([string]$f.Result.Text).Trim() }
      }
    }
  } catch {}
  return @{ present = $false }
}

$pidsBefore = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $pidsAfter = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($pidsAfter | Where-Object { $pidsBefore -notcontains $_ } | Select-Object -First 1)
  # Open(FileName, ConfirmConversions:=false, ReadOnly:=true, AddToRecentFiles:=false, [5..12 omitted], OpenAndRepair:=false).
  # OpenAndRepair is positional arg 13; the intervening optionals are padded with [Reflection.Missing]::Value.
  $no = $false; $yes = $true; $miss = [System.Reflection.Missing]::Value
  $doc = $word.Documents.Open($abs, $no, $yes, $no, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $no)
  $out.ok = $true
  $out.openedWithoutRepair = $true
  $out.sectionCount = [int]$doc.Sections.Count
  if ($doc.Sections.Count -ge 1) {
    $sec = $doc.Sections.Item(1)
    $hdrPrimary = $sec.Headers.Item(1); $ftrPrimary = $sec.Footers.Item(1)
    $hdrFirst = $sec.Headers.Item(2);   $ftrFirst = $sec.Footers.Item(2)
    $hdrEven = $sec.Headers.Item(3);     $ftrEven = $sec.Footers.Item(3)

    # Enum self-verification: HeaderFooter.Index == wdHeaderFooterIndex (1/2/3).
    $enumOk = ([int]$hdrPrimary.Index -eq 1) -and ([int]$hdrFirst.Index -eq 2) -and ([int]$hdrEven.Index -eq 3)
    $out.enumCheck = $enumOk
    if (-not $enumOk) { throw "wdHeaderFooter index self-check failed: primary=$([int]$hdrPrimary.Index) first=$([int]$hdrFirst.Index) even=$([int]$hdrEven.Index)" }

    # P1 primary (headerText/footerText kept for the M5 gate; primaryHeader/Footer are the explicit aliases).
    $out.headerText = Get-HFText $hdrPrimary
    $out.footerText = Get-HFText $ftrPrimary
    $out.primaryHeader = $out.headerText
    $out.primaryFooter = $out.footerText

    # P2 structure flags (True=-1/False=0 → boolean; wdUndefined is not produced by single-section docs).
    $pgs = $sec.PageSetup
    $out.differentFirstPage = ([int]$pgs.DifferentFirstPageHeaderFooter -ne 0)
    $out.differentOddEven = ([int]$pgs.OddAndEvenPagesHeaderFooter -ne 0)

    # P2 variant text.
    $out.firstHeader = Get-HFText $hdrFirst
    $out.firstFooter = Get-HFText $ftrFirst
    $out.evenHeader = Get-HFText $hdrEven
    $out.evenFooter = Get-HFText $ftrEven

    # P3 page-number field (wdFieldPage=33 → result is the resolved page number).
    $out.footerPageField = Get-PageField $ftrPrimary
    $out.headerPageField = Get-PageField $hdrPrimary
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
