# One-off slice-8 Leg B author: REAL Word authors tracked changes + a comment.
# PID-safe per scripts/oracle/README.md: fresh hidden instance, GUID caption tag,
# graceful Quit — never touches the user's Word. Run UNSANDBOXED + FOREGROUND.
$ErrorActionPreference = 'Stop'
$out = 'C:\tmp\wc-slice8-legB.docx'
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Add()
  $sel = $word.Selection
  $sel.TypeText('Word authored review fixture base text with target words here.')
  $sel.TypeParagraph()
  $sel.TypeText('Second paragraph carrying the comment anchor for the clone.')

  $doc.TrackRevisions = $true

  # tracked INSERT at the end of paragraph 1
  $p1 = $doc.Paragraphs.Item(1).Range
  $insAt = $doc.Range($p1.End - 1, $p1.End - 1) # before the paragraph mark
  $insAt.Text = ' WORDINSERT'

  # tracked DELETE of the word 'target'
  $r = $doc.Content
  $null = $r.Find.Execute('target')
  $r.Delete() | Out-Null

  # tracked FORMAT: bold the word 'words'
  $r2 = $doc.Content
  $null = $r2.Find.Execute('words')
  $r2.Font.Bold = $true

  # comment on 'anchor' (comments are recorded regardless of TrackRevisions)
  $r3 = $doc.Content
  $null = $r3.Find.Execute('anchor')
  $null = $doc.Comments.Add($r3, 'Word-authored comment: import me into the clone.')

  $doc.SaveAs2($out, 12) # wdFormatXMLDocument
  $doc.Close($false)
  Write-Output "LEGB_AUTHORED $out"
} finally {
  $word.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
