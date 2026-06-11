# Capture all visible top-level windows of a process via PrintWindow.
# Office flyouts/menus/dialogs are separate top-level windows (Net UI Tool
# Window / NUIDialog) — the main-window capture misses them; this catches them.
# Usage: capture-popups.ps1 -ProcessName WINWORD -OutPrefix 'C:\...\home-flyout-paste'
#        [-MinWidth 40] [-MinHeight 40] [-SkipTitleLike '*Document*']
param(
  [string]$ProcessName = 'WINWORD',
  [Parameter(Mandatory=$true)][string]$OutPrefix,
  [int]$MinWidth = 40,
  [int]$MinHeight = 40,
  [string]$SkipTitleLike = ''
)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public struct WRECT { public int Left; public int Top; public int Right; public int Bottom; }
public static class WinEnum {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out WRECT r);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static List<IntPtr> Find(uint targetPid) {
    var found = new List<IntPtr>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == targetPid && IsWindowVisible(h)) found.Add(h);
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
[WinEnum]::SetProcessDPIAware() | Out-Null
$procs = Get-Process $ProcessName -ErrorAction Stop
$n = 0
foreach ($proc in $procs) {
  foreach ($h in [WinEnum]::Find([uint32]$proc.Id)) {
    $r = New-Object WRECT
    [WinEnum]::GetWindowRect($h, [ref]$r) | Out-Null
    $w = $r.Right - $r.Left; $ht = $r.Bottom - $r.Top
    if ($w -lt $MinWidth -or $ht -lt $MinHeight) { continue }
    $sbT = New-Object System.Text.StringBuilder 256; [WinEnum]::GetWindowText($h, $sbT, 256) | Out-Null
    $title = $sbT.ToString()
    if ($SkipTitleLike -and $title -like $SkipTitleLike) { continue }
    $sbC = New-Object System.Text.StringBuilder 256; [WinEnum]::GetClassName($h, $sbC, 256) | Out-Null
    $bmp = New-Object System.Drawing.Bitmap $w, $ht
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    [WinEnum]::PrintWindow($h, $hdc, 2) | Out-Null
    $g.ReleaseHdc($hdc)
    $p = "$OutPrefix-$n.png"
    $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Output "captured $p (${w}x${ht}, class '$($sbC.ToString())', title '$title')"
    $n++
  }
}
if ($n -eq 0) { Write-Output 'no matching windows captured' }
