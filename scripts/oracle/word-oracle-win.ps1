# scripts/oracle/word-oracle-win.ps1 — Windows Microsoft Word oracle (COM object
# model ONLY — no GUI/UIA scripting). The Windows port of word-oracle.js: same
# verbs, same JSON output shapes, same field semantics, so every consumer of the
# Mac oracle's reports works unchanged against this one.
#
# Usage (PowerShell 5.1+):
#   powershell -File scripts/oracle/word-oracle-win.ps1 read-props       <abs path .docx> [--out report.json]
#   powershell -File scripts/oracle/word-oracle-win.ps1 read-word-props  <abs path .docx> <paraIdx> [wordIdx] [--out report.json]
#   powershell -File scripts/oracle/word-oracle-win.ps1 read-para-props  <abs path .docx> [--out report.json]
#   powershell -File scripts/oracle/word-oracle-win.ps1 read-style-props <abs path .docx> [--out report.json]
#   powershell -File scripts/oracle/word-oracle-win.ps1 roundtrip        <abs in.docx> <abs out.docx>
#
# RUNTIME REQUIREMENTS (verified live 2026-06-11, Word 16.0 / Windows 11):
# - Word COM CANNOT be driven from a sandboxed shell (out-of-proc DCOM activation
#   hangs at New-Object) — run with the sandbox disabled.
# - Word COM must run in a FOREGROUND, STA shell. In this machine's harness,
#   BACKGROUNDED PowerShell tasks wedge inside Word's save pipeline: everything
#   up to SaveAs2 works, then SaveAs2 never returns (no dialog exists — verified
#   by enumerating the hung instance's windows; same hang on both OneDrive and
#   C:\tmp output paths, while the identical foreground call saves instantly).
#   Keep oracle invocations short so they are not auto-backgrounded.
#
# PID-safety contract (Windows variant — STRONGER than the Mac one):
# - `New-Object -ComObject Word.Application` always creates a FRESH, INVISIBLE
#   Word instance (it never attaches to the user's running Word — that would be
#   GetActiveObject, which this script never calls). The user's documents are
#   physically unreachable from this instance.
# - We snapshot WINWORD PIDs before spawning; the PID that appears after spawn
#   is OURS and is recorded for the last-resort cleanup path.
# - Cleanup (finally): close only documents WE opened (SaveChanges:=0), then
#   Quit OUR instance. If Quit itself fails, Stop-Process ONLY the recorded
#   spawned PID. The user's Word window/PIDs are never touched.
# - DisplayAlerts=0 + AutomationSecurity=ForceDisable so a damaged file raises a
#   COM error (catchable, exit 1) instead of a blocking dialog in our hidden
#   instance. A clean exit therefore implies "no repair prompt".
#
# Output-shape parity notes (vs word-oracle.js — see scripts/oracle/README.md):
# - bold/italic: COM ints (-1 true / 0 false / 9999999 mixed) -> booleans; mixed
#   maps to FALSE exactly like the Mac paragraph-level "mixed collapses" rule.
# - underlineRaw: COM WdUnderline ints mapped to the Mac AppleScript enum
#   strings ("underline none", "underline single", ...) so `underline` consumers
#   keep their `!== 'underline none'` logic. Unknown/mixed -> "underline enum<N>"
#   / "underline mixed" (both treated as underlined=false only for "none"/"mixed").
# - fontSize: 9999999 (wdUndefined, mixed runs) -> null, matching the Mac
#   "missing value" -> null parse.
# - alignment / lineSpacingRule / listType raw strings are emitted in the Mac
#   normalized vocabulary (e.g. "line space1 pt5" sic) — mapped from COM ints.
# - text: trailing \r stripped (table-cell paragraphs keep their \a cell mark,
#   exactly like the Mac reports showed \r markers).
# - JSON written WITHOUT a BOM (Node's JSON.parse chokes on BOMs).

$ErrorActionPreference = 'Stop'
# Non-ASCII fidelity on stdout (Symbol-PUA bullets in listString, document text):
# without this, OEM-codepage consoles transcode them to '?'. --out files are
# always safe (BOM-free UTF-8); stdout is made UTF-8 here for direct consumers.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ---------- arg parsing (mirrors the Node CLI: exit 2 on usage errors) ----------
$argv = @($args)
$outPath = $null
$outIdx = [Array]::IndexOf($argv, '--out')
if ($outIdx -ge 0) {
  if ($outIdx + 1 -ge $argv.Count -or [string]::IsNullOrEmpty($argv[$outIdx + 1])) {
    [Console]::Error.WriteLine('usage error: --out requires a path argument')
    exit 2
  }
  $outPath = $argv[$outIdx + 1]
  # Splice the flag/value PAIR out by INDEX — value-based filtering would also
  # delete a positional arg that happens to equal the out path (e.g.
  # `read-word-props f.docx 2 --out 2`).
  $argv = @(0..($argv.Count - 1) | Where-Object { $_ -ne $outIdx -and $_ -ne ($outIdx + 1) } | ForEach-Object { $argv[$_] })
}
# Positive-integer validation that NEVER throws (a [int] cast inside the
# dispatch condition would convert a usage error into a runtime exit-1).
function Is-PosInt([string]$s) { return ($null -ne $s -and $s -match '^[1-9][0-9]*$') }
$cmd = if ($argv.Count -gt 0) { $argv[0] } else { $null }
$a = if ($argv.Count -gt 1) { $argv[1] } else { $null }
$b = if ($argv.Count -gt 2) { $argv[2] } else { $null }
$c = if ($argv.Count -gt 3) { $argv[3] } else { $null }

function Usage-Exit {
  [Console]::Error.WriteLine('usage: word-oracle-win.ps1 read-props <file.docx> [--out r.json] | read-word-props <file.docx> <paraIdx> [wordIdx] [--out r.json] | read-para-props <file.docx> [--out r.json] | read-style-props <file.docx> [--out r.json] | read-layout <file.docx> [--out r.json] | read-shapes <file.docx> [--out r.json] | roundtrip <in.docx> <out.docx>')
  exit 2
}

# ---------- enum maps (COM int -> the Mac oracle's string vocabulary) ----------
# Mixed underline (wdUndefined) maps to the literal string 'false' — the Mac
# wire's sentinel for collapsed mixed formatting (word-oracle.js derives its
# boolean as raw !== 'underline none' && raw !== 'false'; this port uses the
# SAME rule below so the two stay observably identical).
# The decorated-variant strings (dotted/thick/dash...) follow the sdef/COM
# naming pattern; only none/single/words/double are Mac-verified (README).
$UNDERLINE_MAP = @{
  0 = 'underline none'; 1 = 'underline single'; 2 = 'underline words';
  3 = 'underline double'; 4 = 'underline dotted'; 6 = 'underline thick';
  7 = 'underline dash'; 9 = 'underline dot dash'; 10 = 'underline dot dot dash';
  11 = 'underline wavy'; 20 = 'underline dotted heavy'; 23 = 'underline dash heavy';
  25 = 'underline dot dash heavy'; 26 = 'underline dot dot dash heavy';
  27 = 'underline wavy heavy'; 39 = 'underline dash long'; 43 = 'underline wavy double';
  55 = 'underline dash long heavy'; 9999999 = 'false'
}
# 5/7 follow the COM constant names (wdAlignParagraphJustifyMed/JustifyHi) the
# way the Mac sdef token-split would render them; only left/center/right/
# justify are Mac-verified (README).
$ALIGNMENT_MAP = @{ 0 = 'left'; 1 = 'center'; 2 = 'right'; 3 = 'justify'; 4 = 'distribute'; 5 = 'justify med'; 7 = 'justify hi'; 8 = 'justify low'; 9 = 'thai justify'; 9999999 = 'mixed' }
$LINE_SPACING_RAW = @{ 0 = 'line space single'; 1 = 'line space1 pt5'; 2 = 'line space double'; 3 = 'line space at least'; 4 = 'line space exactly'; 5 = 'line space multiple' }
$LINE_SPACING_NORM = @{ 0 = 'single'; 1 = '1.5'; 2 = 'double'; 3 = 'at least'; 4 = 'exactly'; 5 = 'multiple' }
$LIST_TYPE_MAP = @{ 0 = 'no numbering'; 1 = 'listnum only'; 2 = 'bullet'; 3 = 'simple numbering'; 4 = 'outline numbering'; 5 = 'mixed numbering'; 6 = 'picture bullet' }

function Map-Or-Enum([hashtable]$map, $val, [string]$prefix) {
  $i = [int]$val
  if ($map.ContainsKey($i)) { return $map[$i] }
  return "$prefix$i"
}
function Com-Bool($val) { return ([int]$val) -eq -1 }   # -1 true; 0 false; 9999999 mixed -> false (Mac parity)
function Com-Size($val) {
  $f = [double]$val
  if ($f -ge 9999990) { return $null }                  # wdUndefined -> null (Mac "missing value" parity)
  return $f
}
function Strip-ParaMark([string]$s) { return ($s -replace "`r$", '') }

# ---------- Word session (fresh hidden instance; leak-proof cleanup) ----------
$script:word = $null
$script:ourPid = $null
$script:ourPidStart = $null
$script:openDocs = @()

# Guarded for persistent-session reruns: Add-Type on an existing type name
# throws (identical source is a silent no-op, edited source is not). The
# documented invocation is a fresh `powershell -File` process, where the guard
# never bites.
if (-not ([System.Management.Automation.PSTypeName]'WcOracleWin').Type) {
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public static class WcOracleWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  public static uint PidOfWindowTitled(string tag) {
    uint found = 0;
    EnumWindows((h, l) => {
      var sb = new StringBuilder(256); GetWindowText(h, sb, 256);
      if (sb.ToString().Contains(tag)) { GetWindowThreadProcessId(h, out found); return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
}

function Start-WordInstance {
  $script:word = New-Object -ComObject Word.Application
  $script:word.Visible = $false
  $script:word.DisplayAlerts = 0          # wdAlertsNone — never block on a dialog
  try { $script:word.AutomationSecurity = 3 } catch {}  # msoAutomationSecurityForceDisable
  # Deterministic own-PID identification: tag OUR instance's (hidden) main window
  # caption with a GUID and resolve the owning PID — no PID-set diffing races.
  $tag = 'WC-ORACLE-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
  try {
    $script:word.Caption = $tag
    $p = [WcOracleWin]::PidOfWindowTitled($tag)
    if ($p -gt 0) {
      # Record PID + name + StartTime: the kill-time guard re-verifies all
      # three (a dead PID can be reused by an unrelated process — even another
      # WINWORD the USER launched — between record time and kill time).
      $proc = Get-Process -Id ([int]$p) -ErrorAction SilentlyContinue
      if ($null -ne $proc -and $proc.ProcessName -ieq 'WINWORD') {
        $script:ourPid = [int]$p
        $script:ourPidStart = $proc.StartTime
      }
    }
    $script:word.Caption = 'Word'
  } catch {}
}

function Open-Doc([string]$docxPath, [bool]$readOnly) {
  # -LiteralPath: bracket characters in filenames ("report [1].docx") must not
  # glob — wildcard matching could silently resolve to a DIFFERENT file.
  if (-not (Test-Path -LiteralPath $docxPath)) { throw "file not found: $docxPath" }
  $abs = (Resolve-Path -LiteralPath $docxPath).Path
  # Open(FileName, ConfirmConversions:=false, ReadOnly, AddToRecentFiles:=false)
  $doc = $script:word.Documents.Open($abs, $false, $readOnly, $false)
  $script:openDocs += ,$doc
  return $doc
}

function Cleanup-Word {
  # Idempotent (catch + finally may both land here); the finally owns cleanup
  # on ALL exits — including the exit-2 Usage-Exit path (PowerShell runs
  # finally blocks on `exit`).
  foreach ($d in $script:openDocs) {
    try { $d.Close(0) } catch {}     # 0 = wdDoNotSaveChanges; close ONLY docs we opened
  }
  $script:openDocs = @()
  if ($null -ne $script:word) {
    $quitOk = $true
    try { $script:word.Quit() } catch { $quitOk = $false }
    try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:word) } catch {}
    $script:word = $null
    if (-not $quitOk -and $null -ne $script:ourPid) {
      # Last resort: kill ONLY the instance this script spawned — re-verified
      # at kill time by name AND StartTime so a reused PID is never touched.
      try {
        $p = Get-Process -Id $script:ourPid -ErrorAction Stop
        if ($p.ProcessName -ieq 'WINWORD' -and $null -ne $script:ourPidStart -and $p.StartTime -eq $script:ourPidStart) {
          Stop-Process -Id $script:ourPid -Force -Confirm:$false -ErrorAction Stop
        }
      } catch {}
    }
  }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

# ---------- verbs ----------
function Read-Props([string]$docxPath) {
  $doc = Open-Doc $docxPath $true
  $out = @()
  $n = $doc.Paragraphs.Count
  for ($i = 1; $i -le $n; $i++) {
    $para = $doc.Paragraphs.Item($i)
    $r = $para.Range
    $f = $r.Font
    $uRaw = Map-Or-Enum $UNDERLINE_MAP ([int]$f.Underline) 'underline enum'
    $out += [pscustomobject][ordered]@{
      index        = $i
      text         = Strip-ParaMark $r.Text
      bold         = Com-Bool $f.Bold
      italic       = Com-Bool $f.Italic
      underline    = ($uRaw -ne 'underline none' -and $uRaw -ne 'false')  # exact Mac derivation rule
      underlineRaw = $uRaw
      fontName     = [string]$f.Name
      fontSize     = Com-Size $f.Size
      alignment    = Map-Or-Enum $ALIGNMENT_MAP ([int]$para.Format.Alignment) 'enum'
    }
  }
  return $out
}

function Read-WordProps([string]$docxPath, [int]$paraIdx, $wordIdx) {
  $doc = Open-Doc $docxPath $true
  $r = $doc.Paragraphs.Item($paraIdx).Range
  $words = $r.Words
  $firstW = 1; $lastW = $words.Count
  if ($null -ne $wordIdx) { $firstW = [int]$wordIdx; $lastW = [int]$wordIdx }
  $out = @()
  for ($i = $firstW; $i -le $lastW; $i++) {
    $w = $words.Item($i)
    $f = $w.Font
    $uRaw = Map-Or-Enum $UNDERLINE_MAP ([int]$f.Underline) 'underline enum'
    $out += [pscustomobject][ordered]@{
      index        = $i
      text         = Strip-ParaMark $w.Text
      bold         = Com-Bool $f.Bold
      italic       = Com-Bool $f.Italic
      underline    = ($uRaw -ne 'underline none' -and $uRaw -ne 'false')  # exact Mac derivation rule
      underlineRaw = $uRaw
      fontName     = [string]$f.Name
      fontSize     = Com-Size $f.Size
    }
  }
  return $out
}

function Read-ParaProps([string]$docxPath) {
  $doc = Open-Doc $docxPath $true
  $out = @()
  $n = $doc.Paragraphs.Count
  for ($i = 1; $i -le $n; $i++) {
    $para = $doc.Paragraphs.Item($i)
    $pf = $para.Format
    $r = $para.Range
    $lf = $r.ListFormat
    $rule = [int]$pf.LineSpacingRule
    $listTypeInt = [int]$lf.ListType
    $firstLine = Com-Size $pf.FirstLineIndent
    $hanging = 0
    if ($null -ne $firstLine -and $firstLine -lt 0) { $hanging = -$firstLine }
    # Mac parity for unknown rules: normalized falls back to the RAW string
    # (word-oracle.js: LINE_SPACING_RULES[raw] || raw), not a separate token.
    $ruleRaw = Map-Or-Enum $LINE_SPACING_RAW $rule 'line space enum'
    $ruleNorm = $ruleRaw
    if ($LINE_SPACING_NORM.ContainsKey($rule)) { $ruleNorm = $LINE_SPACING_NORM[$rule] }
    $out += [pscustomobject][ordered]@{
      index              = $i
      alignment          = Map-Or-Enum $ALIGNMENT_MAP ([int]$pf.Alignment) 'enum'
      lineSpacingRule    = $ruleNorm
      lineSpacingRuleRaw = $ruleRaw
      lineSpacingPt      = Com-Size $pf.LineSpacing      # POINTS, not a multiplier (Mac quirk #17 parity)
      spaceBeforePt      = Com-Size $pf.SpaceBefore
      spaceAfterPt       = Com-Size $pf.SpaceAfter
      leftIndentPt       = Com-Size $pf.LeftIndent
      rightIndentPt      = Com-Size $pf.RightIndent
      firstLineIndentPt  = $firstLine                    # negative = hanging indent
      hangingPt          = $hanging
      listType           = Map-Or-Enum $LIST_TYPE_MAP $listTypeInt 'enum'
      listTypeRaw        = 'list ' + (Map-Or-Enum $LIST_TYPE_MAP $listTypeInt 'enum')
      listLevelNumber    = [int]$lf.ListLevelNumber      # 1 even for non-list paragraphs — gate on listType
      listString         = [string]$lf.ListString        # default bullet is the Symbol PUA char, numbered "1."
      text               = Strip-ParaMark $r.Text        # emitted LAST in the Mac wire protocol; order kept for readability
    }
  }
  return $out
}

function Read-StyleProps([string]$docxPath) {
  $doc = Open-Doc $docxPath $true
  $out = @()
  $n = $doc.Paragraphs.Count
  for ($i = 1; $i -le $n; $i++) {
    $para = $doc.Paragraphs.Item($i)
    $out += [pscustomobject][ordered]@{
      index = $i
      style = [string]$para.Style.NameLocal   # built-ins read as LOCALIZED display names (same as Mac `name local`)
      text  = Strip-ParaMark $para.Range.Text
    }
  }
  return $out
}

# read-layout — Word's PAGINATION ground truth for the Phase-4 layout engine.
# Forces a repaginate, then reports the page count, line count, and the paragraph
# index that STARTS each page (the break points), plus each paragraph's start page.
# Compare these to the clone's WC.PM.__pagination (pageCount + per-seam block) to
# verify the model-driven engine matches real Word's lines/page.
function Read-Layout([string]$docxPath) {
  $doc = Open-Doc $docxPath $true
  try { $doc.Repaginate() } catch {}
  $pages = 0; try { $pages = [int]$doc.ComputeStatistics(2) } catch {}   # wdStatisticPages
  $lines = 0; try { $lines = [int]$doc.ComputeStatistics(1) } catch {}   # wdStatisticLines
  $n = $doc.Paragraphs.Count
  $perPara = @()
  $breaks = @()
  $prevPage = 0
  for ($i = 1; $i -le $n; $i++) {
    $r = $doc.Paragraphs.Item($i).Range.Duplicate
    $r.Collapse(1)                                    # wdCollapseStart — page of the paragraph's START
    $pg = 0
    try { $pg = [int]$r.Information(3) } catch {}      # wdActiveEndPageNumber
    $perPara += [pscustomobject][ordered]@{ index = $i; page = $pg; text = Strip-ParaMark ($doc.Paragraphs.Item($i).Range.Text) }
    if ($pg -gt $prevPage) {
      if ($prevPage -gt 0) { $breaks += $i }          # this paragraph opens a new page
      $prevPage = $pg
    }
  }
  return [pscustomobject][ordered]@{ pages = $pages; lines = $lines; paragraphs = $n; breakParas = @($breaks); perPara = $perPara }
}

# read-shapes — Word's IMAGE/SHAPE GEOMETRY ground truth for the Phase-4 layout engine
# (sub-phase 4b image resize, 4c floating, 4d tables). Reports every InlineShape and
# floating Shape with its Width/Height in POINTS and the EMU equivalent (pt * 12700),
# so a resized image's clone-exported wp:extent (px * 9525) can be cross-checked against
# what Word actually renders. 260px => 195pt => 2476500 EMU.
function Read-Shapes([string]$docxPath) {
  $doc = Open-Doc $docxPath $true
  $inline = @()
  try {
    $n = $doc.InlineShapes.Count
    for ($i = 1; $i -le $n; $i++) {
      $s = $doc.InlineShapes.Item($i)
      $wPt = [double]$s.Width; $hPt = [double]$s.Height
      $inline += [pscustomobject][ordered]@{
        index = $i
        type = [int]$s.Type
        widthPt = [math]::Round($wPt, 2)
        heightPt = [math]::Round($hPt, 2)
        widthEmu = [int][math]::Round($wPt * 12700)
        heightEmu = [int][math]::Round($hPt * 12700)
      }
    }
  } catch {}
  $floating = @()
  try {
    $m = $doc.Shapes.Count
    for ($j = 1; $j -le $m; $j++) {
      $s = $doc.Shapes.Item($j)
      $wPt = [double]$s.Width; $hPt = [double]$s.Height
      $left = $null; try { $left = [math]::Round([double]$s.Left, 2) } catch {}
      $top = $null; try { $top = [math]::Round([double]$s.Top, 2) } catch {}
      $z = $null; try { $z = [int]$s.ZOrderPosition } catch {}
      $floating += [pscustomobject][ordered]@{
        index = $j
        type = [int]$s.Type
        widthPt = [math]::Round($wPt, 2)
        heightPt = [math]::Round($hPt, 2)
        widthEmu = [int][math]::Round($wPt * 12700)
        heightEmu = [int][math]::Round($hPt * 12700)
        leftPt = $left
        topPt = $top
        zOrder = $z
      }
    }
  } catch {}
  return [pscustomobject][ordered]@{ inlineShapes = @($inline); floatingShapes = @($floating) }
}

# Resolve a (possibly relative) path against the PowerShell $PWD — NOT the .NET
# process CWD, which can differ in hosted sessions ([IO.Path]::GetFullPath alone
# would key off the process CWD while Test-Path/Resolve-Path key off $PWD).
function Full-Path([string]$p) {
  return [System.IO.Path]::GetFullPath([System.IO.Path]::Combine((Get-Location).ProviderPath, $p))
}

function Invoke-Roundtrip([string]$inPath, [string]$outDocx) {
  $abs = Full-Path $outDocx
  $outDir = Split-Path -Parent $abs
  if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { throw "roundtrip: output directory does not exist: $outDir" }
  $doc = Open-Doc $inPath $false
  $doc.SaveAs2($abs, 12)                    # 12 = wdFormatXMLDocument (.docx)
  $doc.Close(0)
  $script:openDocs = @($script:openDocs | Where-Object { $_ -ne $doc })
}

# ---------- emit (no-BOM UTF-8; same stdout-+-optional---out contract) ----------
function Emit($report) {
  $json = $report | ConvertTo-Json -Depth 6
  if ($null -ne $outPath) {
    [System.IO.File]::WriteAllText((Full-Path $outPath), $json)  # UTF-8 WITHOUT BOM
  }
  Write-Output $json
}

# ---------- dispatch ----------
try {
  if ($cmd -eq 'read-props' -and $a) {
    Start-WordInstance
    Emit ([pscustomobject][ordered]@{ file = $a; generatedBy = 'word-oracle read-props'; paragraphs = @(Read-Props $a) })
  } elseif ($cmd -eq 'read-word-props' -and $a -and (Is-PosInt $b)) {
    # Is-PosInt (regex, never throws): a bare [int] cast in this condition would
    # turn a non-numeric/fractional paraIdx into a runtime exit-1 instead of the
    # contract's usage exit-2; same guard for the optional wordIdx below.
    $wordIdx = $null
    if ($c -and -not $c.StartsWith('--')) {
      if (-not (Is-PosInt $c)) { Usage-Exit }
      $wordIdx = $c
    }
    Start-WordInstance
    Emit ([pscustomobject][ordered]@{ file = $a; generatedBy = 'word-oracle read-word-props'; paragraph = [int]$b; words = @(Read-WordProps $a ([int]$b) $wordIdx) })
  } elseif ($cmd -eq 'read-para-props' -and $a) {
    Start-WordInstance
    Emit ([pscustomobject][ordered]@{ file = $a; generatedBy = 'word-oracle read-para-props'; paragraphs = @(Read-ParaProps $a) })
  } elseif ($cmd -eq 'read-style-props' -and $a) {
    Start-WordInstance
    Emit ([pscustomobject][ordered]@{ file = $a; generatedBy = 'word-oracle read-style-props'; paragraphs = @(Read-StyleProps $a) })
  } elseif ($cmd -eq 'read-layout' -and $a) {
    Start-WordInstance
    Emit ([pscustomobject][ordered]@{ file = $a; generatedBy = 'word-oracle read-layout'; layout = (Read-Layout $a) })
  } elseif ($cmd -eq 'read-shapes' -and $a) {
    Start-WordInstance
    Emit ([pscustomobject][ordered]@{ file = $a; generatedBy = 'word-oracle read-shapes'; shapes = (Read-Shapes $a) })
  } elseif ($cmd -eq 'roundtrip' -and $a -and $b) {
    Start-WordInstance
    Invoke-Roundtrip $a $b
    Write-Output ("ROUNDTRIP_OK " + $b)
  } else {
    Usage-Exit
  }
} catch {
  [Console]::Error.WriteLine("word-oracle-win: " + $_.Exception.Message)
  # The finally below owns cleanup on ALL exit paths (verified: PowerShell runs
  # finally on `exit`, including Usage-Exit's exit 2).
  exit 1
} finally {
  Cleanup-Word
}
