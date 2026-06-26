# Feature Specification: Home Font dialog advanced character effects

**Feature Branch**: `feature/015-font-effects`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "Home Font dialog advanced character effects — make Small caps, All caps, Character Scale, Character Spacing, and Position actually apply and export to OOXML (currently preview-only + a notifyBlocked toast). Prefer NO-FORK. Validate against installed Word via the COM oracle."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Small Caps & All Caps actually apply (Priority: P1)

A user selects text, opens the Font dialog (Ctrl+D), ticks **Small caps** (or **All caps**), and clicks **OK**. The selected text is rendered in caps and the formatting is saved to the document — it survives a save→reopen and matches what real Word produces. Today both checkboxes only change the dialog's preview and then drop on OK with a "Caps and Advanced font effects … not available" toast.

**Why this priority**: All Caps / Small Caps are the most-used of the five advanced effects, are pure toggles (lowest complexity), and the "it lied to me — the toast says not available" experience is the worst part of the current gap. Highest value per unit of effort.

**Independent Test**: Select text → Font dialog → tick Small caps → OK → the run carries small-caps formatting in the model and exports `<w:smallCaps/>`; reopen round-trips it; the installed Word reads `Font.SmallCaps = True`. Same for All caps → `<w:caps/>` / `Font.AllCaps = True`.

**Acceptance Scenarios**:

1. **Given** a text selection, **When** the user ticks Small caps and clicks OK, **Then** the run shows small caps, exports `<w:smallCaps/>`, and Word reads `Font.SmallCaps = True`.
2. **Given** a text selection, **When** the user ticks All caps and clicks OK, **Then** the run shows all caps, exports `<w:caps/>`, and Word reads `Font.AllCaps = True`.
3. **Given** a run already in Small caps, **When** the user reopens the Font dialog, **Then** the Small caps box is pre-checked (the dialog reflects current state).
4. **Given** a run in Small caps, **When** the user un-ticks it and clicks OK, **Then** the small-caps formatting is removed (no `<w:smallCaps/>` in export).
5. **Given** OK is clicked, **When** none of the advanced effects changed, **Then** NO "blocked" toast appears.

---

### User Story 2 - Character Spacing (Expanded / Condensed) applies (Priority: P2)

A user selects text, opens the Font dialog → Advanced, sets **Spacing: Expanded By 2 pt** (or **Condensed By 1 pt**), and clicks OK. The inter-character spacing changes and exports as a real `w:spacing` run property that Word honors.

**Why this priority**: Character spacing is a real layout-affecting effect with a clean point-value model and an existing fork translator/attr (letter-spacing). Common in titles/headings.

**Independent Test**: Select text → set Spacing Expanded By 2pt → OK → export contains `<w:spacing w:val="40"/>` (2pt = 40 twips), Word reads `Font.Spacing = 2`. Condensed By 1pt → `w:val="-20"`, `Font.Spacing = -1`.

**Acceptance Scenarios**:

1. **Given** a selection, **When** Spacing = Expanded By 2pt + OK, **Then** export emits `<w:spacing w:val="40"/>` and Word reads `Font.Spacing = 2`.
2. **Given** a selection, **When** Spacing = Condensed By 1.5pt + OK, **Then** export emits `<w:spacing w:val="-30"/>` and Word reads `Font.Spacing = -1.5`.
3. **Given** Spacing = Normal + OK, **Then** no `w:spacing` letter-spacing property is written (effect cleared).

---

### User Story 3 - Position (Raised / Lowered) applies (Priority: P2)

A user sets **Position: Raised By 3 pt** (or **Lowered By 2 pt**) in the Font dialog and clicks OK. The text baseline shifts and exports as a real `w:position` run property (distinct from sub/superscript, which is `w:vertAlign`).

**Why this priority**: Position has an existing `position` textStyle attr and a clean point-value model. It rounds out the Advanced tab. P2 alongside Spacing.

**Independent Test**: Select text → Position Raised By 3pt → OK → export contains `<w:position w:val="6"/>` (3pt = 6 half-points), Word reads `Font.Position = 3`. Lowered By 2pt → `w:val="-4"`, `Font.Position = -2`.

**Acceptance Scenarios**:

1. **Given** a selection, **When** Position = Raised By 3pt + OK, **Then** export emits `<w:position w:val="6"/>` and Word reads `Font.Position = 3`.
2. **Given** a selection, **When** Position = Lowered By 2pt + OK, **Then** export emits `<w:position w:val="-4"/>` and Word reads `Font.Position = -2`.
3. **Given** Position = Normal + OK, **Then** no `w:position` is written.

---

### User Story 4 - Character Scale applies (Priority: P3)

A user sets **Scale: 150%** (or 80%) in the Font dialog and clicks OK. The glyphs stretch/condense horizontally and export as a real `w:w` run property Word honors.

**Why this priority**: Scale is the least-used of the five and the rendering (horizontal glyph stretch) is the hardest to reproduce faithfully in the browser engine; lowest priority but still in scope.

**Independent Test**: Select text → Scale 150% → OK → export contains `<w:w w:val="150"/>`, Word reads `Font.Scaling = 150`. Scale 100% → no `w:w`.

**Acceptance Scenarios**:

1. **Given** a selection, **When** Scale = 150% + OK, **Then** export emits `<w:w w:val="150"/>` and Word reads `Font.Scaling = 150`.
2. **Given** a selection, **When** Scale = 100% (default) + OK, **Then** no `w:w` is written.

---

### Edge Cases

- **Combined effects**: setting several advanced effects + family/size/bold in one OK click MUST remain ONE undo step (Word fidelity; the dialog already chains family/size/bold/etc.).
- **Empty selection (caret only)**: the effect applies as stored marks so the next typed text carries it (consistent with the existing bold/size dialog behavior).
- **Mixed selection** (some runs already have the effect): the dialog reflects a sensible state on open and applies uniformly on OK (Word collapses mixed to the chosen value).
- **All Caps vs Small Caps mutual exclusivity**: Word treats these as independent rPr flags but visually All Caps wins; the dialog should not silently keep both checked in a contradictory way.
- **Clearing**: un-ticking a box / returning a spinner to Normal/100% MUST remove the property, not leave a stale value (the partial-update-carryover class of bug from the line-numbers work).
- **Round-trip**: an imported doc that already has these run properties MUST keep them through an export that does not touch them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Font dialog's **Small caps** and **All caps** checkboxes MUST, on OK, apply/remove the corresponding run formatting on the selection and export `<w:smallCaps/>` / `<w:caps/>` respectively.
- **FR-002**: The Font dialog's **Spacing** control (Normal / Expanded By / Condensed By, in points) MUST, on OK, write a real `w:spacing` run letter-spacing property (twips; Expanded positive, Condensed negative) and clear it when Normal.
- **FR-003**: The Font dialog's **Position** control (Normal / Raised By / Lowered By, in points) MUST, on OK, write a real `w:position` run property (half-points; Raised positive, Lowered negative) distinct from sub/superscript, and clear it when Normal.
- **FR-004**: The Font dialog's **Scale** control (percentage) MUST, on OK, write a real `w:w` run property and clear it at 100%.
- **FR-005**: Applying any combination of these effects together with the dialog's existing family/style/size/color/underline MUST remain a SINGLE undo step.
- **FR-006**: Opening the Font dialog on a selection that already carries these effects MUST pre-populate the corresponding controls (checked / point value / percentage) from the current run state.
- **FR-007**: Clicking OK when none of the five advanced effects changed MUST NOT show the legacy "Caps and Advanced font effects … not available" toast; that toast MUST be removed once all five are implemented.
- **FR-008**: All five effects MUST round-trip through the docx converter (export then re-open preserves them) without data loss.
- **FR-009**: Each effect's export MUST be validated against the installed Word via the COM oracle: `Font.SmallCaps`, `Font.AllCaps`, `Font.Spacing` (pt), `Font.Position` (pt), `Font.Scaling` (%).

### Key Entities

- **Advanced character effect**: a run-level (rPr) property — smallCaps (flag), caps (flag), spacing (twips), position (half-points), scale w (percent) — applied to the current text selection or stored marks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five Advanced-tab effects apply on OK and are visible in the document (0 of 5 fire a "not available" toast).
- **SC-002**: Each of the five effects round-trips through export→reopen with the value preserved (5/5).
- **SC-003**: Each of the five exported effects is read back by the installed Word with the authored value (Font.SmallCaps/AllCaps/Spacing/Position/Scaling match) — COM-validated.
- **SC-004**: Applying the dialog (effects + family/size) is reversible in exactly ONE undo.
- **SC-005**: Re-opening the dialog on formatted text shows the controls reflecting the current state for all five.
- **SC-006**: The full gate suite stays green (test:pm + smoke + roundtrip + bundle) with new regression tests covering all five effects.

## Assumptions

- **NO-FORK preferred**: the fork already exposes rPr translators for caps (`w:caps`→`textTransform`), spacing (letter-spacing), and a `position` textStyle attr; the plan phase will spike whether `w:smallCaps` and `w:w` (scale) are reachable via existing textStyle attrs or need a vendored-fork edit. A required fork edit is a **STOP-AND-ASK** (Constitution P1) — surface it in planning rather than assuming it.
- **Parity target** is the M365 Word installed on this PC (ADR-0006); fidelity claims are COM-validated, not asserted from spec alone.
- **Rendering**: in-app visual rendering uses the existing textStyle/CSS mark mechanism; pixel-exact horizontal-scale rendering may be approximate (the OOXML export is the fidelity contract, COM-validated).
- **Out of scope**: OpenType/kerning/ligatures dialog controls, the "Set As Default" button behavior, and any Advanced-tab control beyond the five named effects.
- **Mechanism**: the doc-write path remains the `WC.PM` bridge; the Font dialog's OK handler routes the five effects through bridge verbs (or existing setMark) — no direct fork-source edits unless the spike forces a STOP-AND-ASK.
