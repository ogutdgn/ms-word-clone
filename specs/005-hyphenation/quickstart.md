# Quickstart — Hyphenation (validation guide)

How to prove feature 005 works end-to-end. All commands from the repo root.

## Prerequisites

- Windows dev box with Microsoft Word 16 (for the COM oracle; dev-box-only).
- `npm install` done; on branch `005-hyphenation`.

## Build + the 4 core gates (must stay green)

```bash
WC_LAYOUT=overlay npm run build && npm run test:pm   # 475
npm run build && npm run test:smoke                  # 9
npm run test:roundtrip                               # 27
npm run test:bundle                                  # 4
```

## Paged hyphenation probe (real renderer)

```bash
npm run build && npm run probe:hyphenation           # paged
WC_LAYOUT=overlay npm run build && npm run probe:hyphenation   # overlay parity
```

Expected (paged + overlay — settings export is mode-agnostic):
- `setHyphenation({mode:'auto'})` ⇒ export `word/settings.xml` carries `<w:autoHyphenation w:val="true"/>`;
  `getHyphenation().auto === true`.
- `setHyphenation({mode:'none'})` ⇒ `<w:autoHyphenation w:val="false"/>`; `getHyphenation().auto === false`.
- `setHyphenation({mode:'auto', zone:0.25, consecutiveLimit:2, hyphenateCaps:false})` ⇒
  `w:hyphenationZone="360"` + `w:consecutiveHyphenLimit="2"` + `<w:doNotHyphenateCaps/>` present.
- `hyphenateCaps:true` ⇒ `w:doNotHyphenateCaps` absent.
- carryover: re-applying with `hyphenateCaps:true` removes a prior `w:doNotHyphenateCaps` (clean-clear).

## Word-COM oracle (dev-box-only)

```bash
npm run test:roundtrip:paged   # builds paged+overlay, then real Word COM read-back (C7)
```

Expected C7: a saved Automatic+options doc opens without repair; real Word reads `AutoHyphenation` true,
`HyphenationZone` ≈ 18pt (0.25"), `ConsecutiveHyphensLimit` = 2, `HyphenateCaps` = false; PID-safe (no leaked
WINWORD).

## Manual mode (P3)

In the running app (`npm start`): Layout → Hyphenation → Manual on a doc with long words → optional hyphens are
inserted; save → the `.docx` opens in Word without repair and the words can break at the inserted points.

See [contracts/bridge-verbs.md](contracts/bridge-verbs.md) + [data-model.md](data-model.md) for the exact verb
shapes and OOXML mapping.
