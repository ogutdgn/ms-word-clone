# Feature Specification: Hyphenation

**Feature Branch**: `005-hyphenation`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Hyphenation (Layout → Hyphenation): None / Automatic / Manual + a Hyphenation Options dialog (hyphenation zone, limit consecutive hyphens, hyphenate words in CAPS), writing real OOXML document settings (settings.xml: w:autoHyphenation, w:hyphenationZone, w:consecutiveHyphenLimit, w:doNotHyphenateCaps), validated against real Word (ActiveDocument.AutoHyphenation / HyphenationZone / ConsecutiveHyphensLimit / HyphenateCaps); no fork edits; incremental oracle-gated slices."

## Clarifications

### Session 2026-06-22

All open questions had a reasonable Word/industry-standard or repo-established default, so they were
resolved autonomously (per the standing autonomous directive) and recorded here — none required a product
decision from the user.

- **Q: Hyphenation-zone default + does Automatic write a zone?** → A: The Options dialog defaults the zone to
  Word's default **0.25" (360 twips)**; choosing **Automatic** alone writes ONLY `w:autoHyphenation` and does
  **not** emit an explicit `w:hyphenationZone` (Word applies its own default) — a zone is written only when the
  user sets one in Options. (Mirrors 004's "don't write a value Word never had.")
- **Q: Consecutive-hyphen-limit default?** → A: Word's default is **0 = no limit**; `w:consecutiveHyphenLimit`
  is written only when the user sets it; `0` is exported faithfully (means unlimited).
- **Q: Hyphenate-CAPS default + mapping?** → A: Word's default is **ON** (hyphenate words in CAPS), i.e.
  `w:doNotHyphenateCaps` **absent**. The user-facing checkbox maps to the **negation**: checkbox OFF ⇒ emit
  `<w:doNotHyphenateCaps/>`; checkbox ON ⇒ remove it.
- **Q: Manual-mode scope?** → A: **Best-effort optional-hyphen insertion** into long words (a faithful
  approximation); Word's full interactive per-word walkthrough is out of scope for v1 and the behavior is
  surfaced honestly (no silent no-op). If a no-fork optional-hyphen write isn't reachable, record the gap + an
  honest toast.
- **Q: In-app rendering of mid-word hyphen breaks?** → A: **Best-effort / known-limitation** — the paged engine
  may not hyphenate natively; the on/off state + the exported settings + Word's read-back are the primary
  fidelity guarantee.
- **Q: Scope — document-level vs per-section?** → A: **Document-level** settings (`settings.xml`), single
  document; per-section hyphenation is out of scope for v1.
- **Q: Clean-clear on toggle (the 004 carryover lesson)?** → A: Each setting is written **explicitly and
  idempotently**; choosing **None** sets `w:autoHyphenation` false (not merely omitted) so a prior "on" can't
  linger; the spike confirms the no-fork settings-write supports explicit clears.

## User Scenarios & Testing *(mandatory)*

The Layout → Hyphenation control is currently blocked (an honest deferral toast). Word's hyphenation is a
**document-level** setting (it lives in the document's settings, not in any page or paragraph), so it does not
need the layout engine to be *set* and *saved* correctly — only to be *rendered* with mid-word breaks. This
feature wires the control onto the document through the `WC.PM` bridge so a saved document carries the real
hyphenation settings and opens in Microsoft Word with hyphenation configured exactly as the user chose.

### User Story 1 - Turn automatic hyphenation on/off (Priority: P1) 🎯 MVP

A user chooses **Automatic** from Layout → Hyphenation; the document is flagged to hyphenate automatically, and
saving produces a `.docx` that opens in Word with automatic hyphenation **on**. Choosing **None** turns it off.

**Why this priority**: This is the core capability and the prerequisite slice — it proves the settings + export
+ ribbon + oracle path. The Options dialog (P2) and Manual mode (P3) extend it.

**Independent Test**: Choose Hyphenation → Automatic; save → reopen in Word — `ActiveDocument.AutoHyphenation`
is **true**; choose None → save → Word reads `AutoHyphenation` **false**; the document opens without repair.

**Acceptance Scenarios**:

1. **Given** a document, **When** the user chooses Hyphenation → Automatic, **Then** the exported settings carry
   `<w:autoHyphenation w:val="true"/>` and Word reads `ActiveDocument.AutoHyphenation` true.
2. **Given** automatic hyphenation on, **When** the user chooses **None**, **Then** the export turns the setting
   off (`w:autoHyphenation` false/removed) and Word reads `AutoHyphenation` false; the document opens without repair.
3. **Given** a document with automatic hyphenation, **When** it is saved and reopened (round-trip), **Then** the
   automatic-hyphenation state is preserved.

---

### User Story 2 - Set hyphenation options (Priority: P2)

A user opens **Hyphenation Options** to set the **hyphenation zone** (how much whitespace Word tolerates before
hyphenating), the **limit on consecutive hyphens** (max lines in a row that may end with a hyphen), and whether
to **hyphenate words in CAPS**. These persist to the export and read back in Word.

**Why this priority**: Fine-grained control over how hyphenation behaves is secondary to turning it on/off; it
builds on P1's settings path.

**Independent Test**: Set the hyphenation zone to 0.25", consecutive-hyphen limit to 2, and turn OFF "hyphenate
words in CAPS"; save → Word reads `HyphenationZone` ≈ 0.25" (18pt), `ConsecutiveHyphensLimit` = 2, and
`HyphenateCaps` = false.

**Acceptance Scenarios**:

1. **Given** Hyphenation Options, **When** the user sets a hyphenation zone, **Then** the export carries
   `w:hyphenationZone` (in twips) and Word reads `HyphenationZone` equal to the authored value.
2. **Given** Hyphenation Options, **When** the user sets the consecutive-hyphen limit to N, **Then** the export
   carries `w:consecutiveHyphenLimit="N"` and Word reads `ConsecutiveHyphensLimit` = N (0 = no limit).
3. **Given** Hyphenation Options, **When** the user turns OFF "hyphenate words in CAPS", **Then** the export
   carries `<w:doNotHyphenateCaps/>` and Word reads `HyphenateCaps` = false (and ON ⇒ the element is absent ⇒
   Word reads `HyphenateCaps` = true).

---

### User Story 3 - Manual hyphenation (Priority: P3)

A user chooses **Manual** to hyphenate the document on demand — inserting optional (soft) hyphens at the breakable
points of long words so they can break at line ends — without turning on automatic hyphenation.

**Why this priority**: Manual hyphenation is a niche, interaction-heavy Word feature; turning hyphenation on and
configuring it (P1/P2) covers the common need. Manual builds on those.

**Independent Test**: With Manual chosen, long words in the document receive optional hyphens; saving produces a
`.docx` that opens in Word without repair and the optional hyphens survive the round-trip.

**Acceptance Scenarios**:

1. **Given** a document with long words, **When** the user chooses Manual, **Then** optional hyphens are inserted
   at breakable points and the document still opens in Word without repair.
2. **Given** Word's full interactive Manual walkthrough is not reachable without a fork edit, **When** Manual is
   chosen, **Then** the app applies a faithful best-effort (optional-hyphen insertion) and states what it did
   (no silent no-op).

---

### Edge Cases

- **None on an already-off document**: a no-op; must not corrupt the document settings.
- **Reopen**: a hyphenated document exported then reopened keeps its hyphenation settings (import reads them).
- **Consecutive-hyphen limit of 0**: valid — Word interprets 0 as "no limit"; export carries `0` faithfully.
- **Hyphenate-CAPS inversion**: the OOXML element `w:doNotHyphenateCaps` is the *negative* of the user-facing
  "hyphenate words in CAPS" checkbox — the mapping must be inverted correctly (checkbox OFF ⇒ element present).
- **In-app rendering**: hyphenation is a *render* behavior (breaking words mid-line); if the paged engine does
  not hyphenate natively, the on/off state + the exported settings are the guarantee and the in-app mid-word
  break is a recorded best-effort/known-limitation — the document is still Word-correct.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Layout → Hyphenation control MUST be un-blocked (no deferral toast) and drive the document.
- **FR-002**: The presets MUST set the document hyphenation mode — None (off) and Automatic (on).
- **FR-003**: Hyphenation MUST export as real OOXML document settings (`settings.xml`: `w:autoHyphenation`, plus
  `w:hyphenationZone`, `w:consecutiveHyphenLimit`, `w:doNotHyphenateCaps` for options), NOT a visual-only effect.
- **FR-004**: A saved hyphenated document MUST open in Microsoft Word without repair, with
  `ActiveDocument.AutoHyphenation` matching the chosen mode.
- **FR-005**: A "Hyphenation Options" surface MUST let the user set the hyphenation zone, the consecutive-hyphen
  limit, and whether to hyphenate words in CAPS; these MUST persist to the export and read back in Word
  (`HyphenationZone` / `ConsecutiveHyphensLimit` / `HyphenateCaps`).
- **FR-006**: A "Manual" option MUST apply manual hyphenation to the document (optional-hyphen insertion); if
  Word's full interactive Manual walkthrough is unreachable without a fork edit, the behavior is a recorded
  best-effort and MUST NOT be a silent no-op.
- **FR-007**: Choosing None MUST cleanly turn hyphenation off without corrupting the document settings.
- **FR-008**: All writes MUST go through the `WC.PM` bridge (the only document-write path); the document model
  stays page-free; NO edits to the vendored fork (`src/renderer/core/superdoc-fork/*`).

### Key Entities *(include if feature involves data)*

- **Document hyphenation settings**: the document-level config in `settings.xml` — `autoHyphenation` (on/off),
  `hyphenationZone` (a length), `consecutiveHyphenLimit` (a count; 0 = unlimited), `doNotHyphenateCaps` (the
  inverse of "hyphenate words in CAPS"). Read back from Word as `ActiveDocument.AutoHyphenation` /
  `HyphenationZone` / `ConsecutiveHyphensLimit` / `HyphenateCaps`.
- **Optional hyphen (Manual)**: a soft-hyphen break opportunity inserted into a word's text so it may break at a
  line end; survives the `.docx` round-trip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can turn automatic hyphenation on (Automatic) and off (None) from the Hyphenation dropdown.
- **SC-002**: 100% of the exercised settings open in **Microsoft Word for Windows** without repair and read back
  the correct `ActiveDocument.AutoHyphenation` (plus `HyphenationZone` / `ConsecutiveHyphensLimit` /
  `HyphenateCaps` for the options case).
- **SC-003**: Setting the hyphenation zone, the consecutive-hyphen limit, and the hyphenate-CAPS toggle each
  persists and reads back equal in Word (the CAPS toggle correctly inverted vs `w:doNotHyphenateCaps`).
- **SC-004**: No regression: the existing gate suite stays green (`test:pm` overlay 475, `test:smoke` 9,
  `test:roundtrip` 27, `test:bundle` 4) and the paged hyphenation probe + the Word-COM oracle pass.

## Assumptions

- **Parity oracle**: "Microsoft Word for Windows" is the project's domain ground-truth oracle (COM read-back),
  the standing fidelity reference (001–004) — not an implementation technology.
- **Hyphenation is document-level**, not per-section: Word's Hyphenation settings live in `settings.xml` and
  apply to the whole document; v1 sets the document-level settings (no per-section hyphenation).
- **Engine may not hyphenate natively**: the paged engine paints lines but may not break words mid-line with
  hyphens; the in-app *render* of automatic hyphenation is therefore best-effort/known-limitation — the on/off
  state + the exported settings + Word's read-back are the primary fidelity guarantee (per the feature intent).
- **Manual is best-effort**: full Word interactive Manual (a per-word proposal walkthrough) may be unreachable
  without a fork edit; the v1 Manual is optional-hyphen insertion, recorded honestly.
- **CAPS mapping is inverted**: the user-facing "hyphenate words in CAPS" maps to the *negation* of
  `w:doNotHyphenateCaps`.
- **Reuses** the paged engine, the `WC.PM` bridge, the Layout ribbon plumbing, the real-paged-renderer probe
  harness, and the Word-COM oracle (`com-validate.js`).
- **Delivery** is incremental, oracle-gated slices (P1 on/off + export + ribbon + oracle, P2 the Options dialog,
  P3 Manual), each its own verify → `/code-review` → ff-merge-into-`general-done` cycle on `005-hyphenation`.
