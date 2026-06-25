# Fidelity Audit — re-baseline 2026-06-25

> Per-tab summary of the fresh re-baseline (127 confirmed findings across 10 ribbon tabs / ~212 controls). Detail: [BUG-LEDGER.md](BUG-LEDGER.md) + [FEATURE-IMPROVEMENTS.md](FEATURE-IMPROVEMENTS.md). Execution order: [COMPLETENESS-BACKLOG.md](COMPLETENESS-BACKLOG.md).

## Headline
Across all 10 ribbon tabs the clone's core typing/formatting/file path is solid, but the re-baseline confirms 64 severity-rated defects (0 S1, 19 S2, 28 S3, 14 S4, 3 S5) plus 64 honest-degrade stubs/fidelity gaps. The most dangerous cluster is editing-protection and silent data-loss on export: Restrict Editing's read-only mode does not block the programmatic ribbon write path, multi-author citation sources lose authors 2+ on edit, and mail-merge IF/ADDRESSBLOCK/GREETINGLINE/MERGEFIELD fields export invalid or switch-stripped OOXML. A second large cluster is paged-engine debt from the overlay-to-paged migration: View modes (Web/Draft/Outline/Side-to-Side), Split, and print/PDF still target the retired #editor node, and counts().pages reads the dead __pagination paginator so every Pages count (Info, Properties, Word Count) is stuck at 1. The richest engineered subsystems (TOC/footnotes/citations, tables, headers/footers, track-changes, the Editor pane) work but carry galleries that collapse to a single output (cover pages, style sets, themes' heading half) or dialogs whose advanced controls silently no-op. Most other gaps are honest, documented cloud/ML stubs (Dictate, Translate, SmartArt, Shapes, Researcher) that degrade gracefully. Versus Word: faithful for everyday authoring and docx round-trip, but not yet trustworthy under document protection, multi-record mail merge, multi-page page accounting, alternate view modes, or printing non-Letter geometry.

_The headline counts are the synthesis agent's approximate bucketing. The authoritative per-finding tally (the tables here + the ledger) is **127 confirmed = 54 bugs** (0 S1 · 18 S2 · 27 S3 · 9 S4) **+ 73 feature gaps** (1 P1 · 21 P2 · 51 P3)._

## Per-tab tally
| Tab | Findings | Bugs (S2/S3/S4) | Gaps (P1/P2/P3) | needs-runtime | needs-live |
|---|---:|---|---|---:|---:|
| Home | 16 | 2/2/3 | 0/3/6 | 5 | 1 |
| Insert | 15 | 0/1/1 | 1/7/5 | 10 | 5 |
| Draw | 10 | 1/1/0 | 0/2/6 | 1 | 6 |
| Design | 6 | 3/0/1 | 0/0/2 | 3 | 0 |
| Layout | 9 | 0/5/1 | 0/1/2 | 3 | 7 |
| References | 19 | 3/8/1 | 0/2/5 | 11 | 8 |
| Mailings | 14 | 4/5/0 | 0/2/3 | 8 | 5 |
| Review | 12 | 1/0/1 | 0/2/8 | 1 | 3 |
| View | 14 | 0/4/1 | 0/0/9 | 0 | 8 |
| File/Backstage | 12 | 4/1/0 | 0/2/5 | 2 | 3 |

## Phase-2 / Phase-3 worklist
- **44** findings need a headless probe + Word-COM oracle (Phase 2) to harden.
- **46** findings need a live computer-use Word-vs-clone comparison (Phase 3).
