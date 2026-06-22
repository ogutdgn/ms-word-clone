# Contract — `WC.PM` hyphenation bridge verbs

New verbs in `bridge/hyphenation.ts`, merged onto `WC.PM` in `bridge/index.ts`. All route through an OWNED
upsert into the converter's settings part (`editor.converter.convertedXml['word/settings.xml']`) — no fork edit.

## New — P1 (mode) + P2 (options)

- `WC.PM.setHyphenation(opts)` — `opts = { mode: 'none'|'auto', zone? (inches), consecutiveLimit? (int≥0),
  hyphenateCaps? (boolean) }`. `mode:'auto'` ⇒ `w:autoHyphenation w:val="true"`; `mode:'none'` ⇒
  `w:val="false"` (explicit off, clean-clear). `zone`/`consecutiveLimit` write their elements only when
  provided (inches→twips for zone); `hyphenateCaps:false` ⇒ add `<w:doNotHyphenateCaps/>`, `true` ⇒ remove it.
  Idempotent; returns `true` on success. `markDirty()`.
- `WC.PM.getHyphenation()` — `{ auto:boolean, zone (inches), consecutiveLimit (int), hyphenateCaps (boolean),
  zoneExplicit, limitExplicit }` read from the settings part. Drives the dropdown checked-state + the Options
  dialog defaults (the `*Explicit` flags = "Auto/unset" vs a real value, so the dialog never replays a
  synthesized default — the 004 lesson).

## New — P3 (Manual) — spike-gated

- `WC.PM.applyManualHyphenation()` — inserts optional hyphens (U+00AD) into long document words via a `WC.PM`
  text transaction; returns the count changed, or `false`/honest toast if a no-fork optional-hyphen write is
  unreachable.

## Inactive-bridge fallbacks

`setHyphenation`/`applyManualHyphenation` → `false`; `getHyphenation` → `{ auto:false, zone:0.25,
consecutiveLimit:0, hyphenateCaps:true, zoneExplicit:false, limitExplicit:false }`.

## Invariants

- Single document-write path (the owned settings upsert); model stays page-free.
- `setHyphenation` is idempotent; `mode:'none'` writes an explicit `false` (no stale "on").
- No fork edit for the settings write; any P3 sub-capability needing one is recorded (plan.md Complexity Tracking).
- The CAPS toggle is the inverse of `w:doNotHyphenateCaps`.
