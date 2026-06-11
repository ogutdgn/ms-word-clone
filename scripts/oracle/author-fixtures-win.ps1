# scripts/oracle/author-fixtures-win.ps1 — re-author the gitignored real-Word
# roundtrip fixtures on a Windows machine (regeneration method for
# tests/fixtures/oracle-word-s3-table.docx and oracle-word-s6-tablestyles.docx;
# the originals were authored by Word for Mac 16.77.1 via the object model —
# notes/2026-06-07-slice3-table-spotcheck.json documents the method; these were
# re-authored with Word for Windows 16.0 on 2026-06-11).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/oracle/author-fixtures-win.ps1
#
# RUNTIME REQUIREMENTS: same as word-oracle-win.ps1 — FOREGROUND, STA,
# unsandboxed shell (backgrounded shells wedge inside SaveAs2; sandboxed shells
# hang at COM activation). Word-bound writes go to a C:\tmp staging dir and are
# copied into the repo afterwards (belt-and-braces; also keeps Word away from
# OneDrive-synced paths).
#
# Shapes (must satisfy scripts/test-roundtrip-pm-probe.js + the Node driver —
# verified identical to the original Mac-authored fixtures via docx-inspect):
# - s3-table:       ONE 3x4 table, style "Grid Table 4 - Accent 1"
#                   -> tables=1, tblStyleRefs [GridTable4-Accent1] (+ the full
#                   6-block conditionalFormats definition in styles.xml)
# - s6-tablestyles: THREE 2x2 tables (6 rows / 6 gridCols), style "Table Grid"
#                   -> tables=3, tblStyleRefs [TableGrid x3]
#
# Style names are LOCALIZED in COM ("Grid Table 4 - Accent 1" verified on this
# machine's English Office). On a localized Office, replace with the localized
# display names (assignment by name string is the only style-application form
# Word COM accepts for table styles without the interop enum).
#
# PID-safety: fresh hidden Word instance (never attaches to the user's Word);
# closes only documents it created; quits only its own instance.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$fixtures = Join-Path $repo 'tests\fixtures'
if (-not (Test-Path $fixtures)) { throw "fixtures dir not found: $fixtures" }
$stage = 'C:\tmp\wc-oracle'
if (-not (Test-Path $stage)) { New-Item -ItemType Directory -Force $stage | Out-Null }

$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  # ---------------- s3: one 3x4 table, Grid Table 4 - Accent 1 ----------------
  $doc = $word.Documents.Add()
  $tbl = $doc.Tables.Add($doc.Range(0, 0), 3, 4)
  $texts = @('Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima')
  $k = 0
  for ($r = 1; $r -le 3; $r++) { for ($c = 1; $c -le 4; $c++) { $tbl.Cell($r, $c).Range.Text = $texts[$k]; $k++ } }
  $tbl.Style = 'Grid Table 4 - Accent 1'
  $s3Stage = Join-Path $stage 'oracle-word-s3-table.docx'
  $doc.SaveAs2($s3Stage, 12)   # wdFormatXMLDocument
  $doc.Close(0)
  Write-Output ("AUTHORED " + $s3Stage)

  # ------------- s6: three 2x2 tables (6 rows, 6 gridCols), Table Grid -------------
  $doc = $word.Documents.Add()
  # Three empty skeleton paragraphs; capture their (sticky, edit-tracking) Range
  # objects BEFORE inserting anything — table insertion shifts paragraph indices,
  # and two tables with no paragraph between them would MERGE into one <w:tbl>.
  # Inserting each table at a captured paragraph-start keeps the empty paragraph
  # below it as the separator.
  $doc.Range().Text = "`r`r`r"
  $slots = @()
  foreach ($i in 1, 2, 3) {
    $r = $doc.Paragraphs.Item($i).Range
    $r.Collapse(1) | Out-Null   # wdCollapseStart
    $slots += , $r
  }
  foreach ($t in 1..3) {
    $tbl = $doc.Tables.Add($slots[$t - 1], 2, 2)
    $base = ($t - 1) * 4
    $tbl.Cell(1, 1).Range.Text = "Cell $($base + 1)"; $tbl.Cell(1, 2).Range.Text = "Cell $($base + 2)"
    $tbl.Cell(2, 1).Range.Text = "Cell $($base + 3)"; $tbl.Cell(2, 2).Range.Text = "Cell $($base + 4)"
    $tbl.Style = 'Table Grid'
  }
  if ($doc.Tables.Count -ne 3) { throw ("s6: expected 3 separate tables, got " + $doc.Tables.Count) }
  $s6Stage = Join-Path $stage 'oracle-word-s6-tablestyles.docx'
  $doc.SaveAs2($s6Stage, 12)
  $doc.Close(0)
  Write-Output ("AUTHORED " + $s6Stage)
} catch {
  [Console]::Error.WriteLine("author-fixtures-win: " + $_.Exception.Message)
  exit 1
} finally {
  if ($null -ne $word) {
    # Close OUR documents first (0 = wdDoNotSaveChanges) so Quit never faces an
    # unsaved-changes decision — a throw mid-build (e.g. localized Office
    # rejecting an English style name) leaves a dirty open doc behind. This
    # instance is exclusively ours, so draining Documents is safe.
    try { foreach ($i in 1..$word.Documents.Count) { try { $word.Documents.Item(1).Close(0) } catch {} } } catch {}
    try { $word.Quit() } catch {}   # if Quit still fails, the hidden instance intentionally leaks (no kill fallback here — see word-oracle-win.ps1 for the verified-PID pattern)
    try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {}
  }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

Copy-Item (Join-Path $stage 'oracle-word-s3-table.docx') $fixtures -Force
Copy-Item (Join-Path $stage 'oracle-word-s6-tablestyles.docx') $fixtures -Force
Write-Output ("COPIED both fixtures into " + $fixtures)
