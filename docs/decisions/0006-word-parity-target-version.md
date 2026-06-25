# ADR-0006 — Word parity target: Microsoft 365 **Word for Windows** (Current Channel, x64)

- **Status:** Locked — 2026-06-17. Read live from the dev PC via COM
  (`Word.Application.Version`/`.Build`), the `WINWORD.EXE` file version, and the
  ClickToRun registry config.
- **Date:** 2026-06-17

## Context
"Faithful Microsoft Word clone" is meaningless without saying **which Word**. Word is not one
product: the **macOS** build and the **Windows** build differ in feature set, dialog layout, and
even OOXML emission quirks; and within Windows, **Microsoft 365** (subscription, monthly-updated
build train) differs from the **perpetual** SKUs (Office 2019 / 2021 / 2024, frozen builds). The
oracle that grounds every fidelity decision (geometry, OOXML, COM read-backs) MUST be one specific,
recorded Word, or "validated against real Word" is ambiguous.

Earlier work used a **macOS AppleScript oracle** as a stopgap; the project moved to **Windows + Word
COM** as the native target on 2026-06-10. Ground-truth artifacts (Aptos theme colors, geometry) were
extracted at an earlier build (`16.0.19929`) of the **same** install, which has since auto-updated.

## Decision
The parity target — the single oracle for all "real Word" validation — is the Microsoft Word
installed on the Windows dev PC:

| Property | Value |
|----------|-------|
| **Product** | Microsoft 365 Apps (`O365ProPlusRetail`) — subscription, NOT perpetual 2019/2021/2024 |
| **App** | Microsoft **Word for Windows** (NOT Word for Mac) |
| **Version** | 16.0 |
| **Build** | **16.0.20026.20182** (re-read 2026-06-25 from this PC; was `…20168` on 2026-06-17 — a routine Current Channel auto-update, identity unchanged; COM `Application.Build` reports `16.0.20026`) |
| **Update channel** | **Current Channel** (`AudienceData = Production::CC`; CDN GUID `492350f6-3a01-4f97-b9c0-c7c6ddf67d60`) |
| **Architecture** | **64-bit** (`Platform = x64`) |
| **Language** | en-US (`ClientCulture = en-us`) |
| **Install path** | `C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE` |

The oracle harness is `scripts/oracle/word-oracle-win.ps1` plus the per-feature
`scripts/oracle/validate-*-win.ps1` family, all driving this Word over COM (PID-safe: spawn a fresh
hidden instance, never touch the user's open window — see AGENTS.md).

## Options considered
- **macOS Word (AppleScript oracle).** *Rejected / superseded:* a flaky stopgap; macOS Word diverges
  from Windows in OOXML quirks and the COM object model the harness depends on. Windows is the
  native automation target.
- **A perpetual SKU (Office 2019/2021/2024), frozen build.** *Rejected:* not what is installed; would
  diverge from the live dev oracle and from the subscription feature set most users have.
- **Microsoft 365 Word for Windows, Current Channel (the installed build). CHOSEN.**

## Rationale
The fidelity loop's strength is that every behavior/geometry/OOXML claim is checked against **one
real Word over COM**. Pinning the exact identity makes "validated against real Word" reproducible and
removes the Mac-vs-Windows / subscription-vs-perpetual ambiguity. Current Channel matches the most
common modern Word and is what is installed.

## Edge cases & risks
- **The build will drift.** Current Channel auto-updates, so the exact build moves over time (it
  already went `16.0.19929` → `16.0.20026.20168`). The **lock is the IDENTITY** (Win · M365 · Current
  Channel · x64 · en-US), and **the build is recorded at each validation** — re-read it with the COM
  snippet below and note it in the PR/checkpoint when a fidelity result depends on it. Do NOT assume
  byte-identical OOXML across builds; assert the *construct* Word reads (the existing oracle pattern).
- **Historical ground-truth at `16.0.19929`** (theme colors in `src/renderer/public/js/util.js`,
  `docs/research/*.json`) is from an earlier build of this **same** install — still valid; the auto-update
  is expected, not a target change.
- **macOS oracle docs** (`scripts/oracle/word-oracle.js` + README) are kept as historical reference but
  are **superseded** by this ADR for parity decisions.

## Consequences
- All new fidelity work validates against this Word via the `*-win.ps1` oracle. PRs that hinge on a
  Word read-back record the build they validated against.
- Re-read the live identity any time with (PID-safe):
  `New-Object -ComObject Word.Application` → `.Version` / `.Build`; precise build via
  `(Get-Item "$env:ProgramFiles\Microsoft Office\root\Office16\WINWORD.EXE").VersionInfo.FileVersion`;
  channel/product via `HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration`.

## Related
- ADR-0005 (`.docx` via the fork converter — round-trips validated against this oracle),
  ADR-0001 (why a real-Word oracle matters for the RL/CUA env), `docs/LAYOUT_ENGINE.md` §5
  (oracle = Word for Windows 16.0 COM), AGENTS.md (PID-safe COM oracle rules),
  memory `dev-machine-windows.md` (Windows + Word 16 COM since 2026-06-10).
