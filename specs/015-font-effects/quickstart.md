# Quickstart — validate 015 Font advanced effects

## Build + gates
```bash
npm run build
npm run test:pm         # paged functional gate (incl. new font-effects tests)
npm run test:smoke
npm run test:roundtrip
npm run test:bundle
```

## Paged probe (real renderer)
```bash
npm run build && npm run probe:fonteffects   # (new) authors each effect, asserts model attr + exported rPr
```
Expected: smallCaps→`<w:smallCaps/>`, allCaps→`<w:caps/>`, spacing 2pt→`<w:spacing w:val="40"/>`, position 3pt→`<w:position w:val="6"/>`, scale 150→`<w:w w:val="150"/>`; clearing drops each.

## Word-COM oracle (dev box)
```bash
# probe authors fixtures to C:/tmp, then:
powershell -File scripts/oracle/validate-fonteffects-win.ps1 C:/tmp/wc-fonteffects.docx
```
Expected JSON: `Font.SmallCaps=True, Font.AllCaps=True, Font.Spacing=2, Font.Position=3, Font.Scaling=150` on the respective runs.

## Manual (in-app)
1. Type text, select it, Ctrl+D → Advanced.
2. Tick Small caps → OK → text is small-caps; **no "not available" toast**.
3. Reopen Ctrl+D → Small caps is pre-checked.
4. Set Spacing Expanded By 2pt, Position Raised By 3pt, Scale 150% → OK (one undo reverts all).
5. Save → reopen → effects persist.
