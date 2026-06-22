# Data Model — Hyphenation

The document model stays **page-free**. These entities describe the document-settings domain — not new
persisted model nodes.

## Entity: Document hyphenation settings

Document-level config in `word/settings.xml`.

| Field | OOXML | Word COM read-back | Notes |
|-------|-------|--------------------|-------|
| `auto` | `w:autoHyphenation/@w:val` | `ActiveDocument.AutoHyphenation` | true (Automatic) / false (None); None writes `false` (explicit), not just omit |
| `zone` | `w:hyphenationZone/@w:val` (twips) | `.HyphenationZone` (points) | gap before hyphenating; default 0.25"=360tw; written only when set |
| `consecutiveLimit` | `w:consecutiveHyphenLimit/@w:val` | `.ConsecutiveHyphensLimit` | max lines in a row ending with a hyphen; 0 = unlimited |
| `hyphenateCaps` | absence of `w:doNotHyphenateCaps` | `.HyphenateCaps` | **inverted**: element present ⇒ HyphenateCaps false |

**Relationships**: a single document-level settings block (no per-section hyphenation in v1). **State
transitions**: *off* → *on(Automatic)* (`setHyphenation auto:true`) → *exported* (`w:autoHyphenation`) →
*reopened* (import reads it). None writes `auto:false` cleanly (no stale "on").

**Validation**: must export the matching `settings.xml` flags (FR-003) + open in Word with `AutoHyphenation` +
the right `HyphenationZone`/`ConsecutiveHyphensLimit`/`HyphenateCaps` (FR-004/FR-005).

## Entity: Manual optional hyphen (P3)

| Field | OOXML | Word COM | Notes |
|-------|-------|----------|-------|
| `optionalHyphen` | a soft hyphen (U+00AD) in run text / `<w:softHyphen/>` | the word can break there | inserted into long words by Manual; survives round-trip |

Not persisted as a new model node — it is text content inside existing runs.
