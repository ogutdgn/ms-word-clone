# 017 oracle — read list-authoring fidelity back from two .docx via a FRESH hidden Word COM. PID-safe.
#   snv = Set Numbering Value 5 on a 3-item numbered list → para1 ListValue == 5 (item2 == 6).
#   dnf = Define New Number Format lowerLetter "%1)" → para1 ListString == "a)" (item2 == "b)").
#   powershell -File scripts/oracle/validate-listauthoring-win.ps1 <snv .docx> <dnf .docx>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$snv = $args[0]; $dnf = $args[1]
if (-not $snv -or -not $dnf) { Write-Output '{"error":"usage: <snv .docx> <dnf .docx>"}'; exit 2 }
$snvAbs = [System.IO.Path]::GetFullPath($snv)
$dnfAbs = [System.IO.Path]::GetFullPath($dnf)
$out = @{ ok = $false }
if (-not (Test-Path $snvAbs)) { $out.error = "snv not found: $snvAbs"; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }
if (-not (Test-Path $dnfAbs)) { $out.error = "dnf not found: $dnfAbs"; Write-Output ($out | ConvertTo-Json -Compress); exit 1 }
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$word = $null; $doc = $null; $spawnedPid = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $after = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $spawnedPid = ($after | Where-Object { $before -notcontains $_ } | Select-Object -First 1)

  # (1) Set Numbering Value
  $doc = $word.Documents.Open($snvAbs, $false, $true, $false)
  $lf1 = $doc.Paragraphs.Item(1).Range.ListFormat
  $out.snv_p1_listValue = [int]$lf1.ListValue
  $out.snv_p1_listString = [string]$lf1.ListString
  $lf2 = $doc.Paragraphs.Item(2).Range.ListFormat
  $out.snv_p2_listValue = [int]$lf2.ListValue
  $doc.Close([ref]$false); $doc = $null

  # (2) Define New Number Format
  $doc = $word.Documents.Open($dnfAbs, $false, $true, $false)
  $d1 = $doc.Paragraphs.Item(1).Range.ListFormat
  $out.dnf_p1_listString = [string]$d1.ListString
  $d2 = $doc.Paragraphs.Item(2).Range.ListFormat
  $out.dnf_p2_listString = [string]$d2.ListString
  $doc.Close([ref]$false); $doc = $null

  $out.ok = $true
  $out.pass = ($out.snv_p1_listValue -eq 5) -and ($out.snv_p2_listValue -eq 6) -and ($out.dnf_p1_listString -eq 'a)') -and ($out.dnf_p2_listString -eq 'b)')
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
} finally {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  try { if ($spawnedPid) { $p = Get-Process -Id $spawnedPid -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $spawnedPid -Force -ErrorAction SilentlyContinue } } } catch {}
}
Write-Output ($out | ConvertTo-Json -Compress)
