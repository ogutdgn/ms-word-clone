# Research — Line Numbers

## Decision 1 — Model/export via the public `sections.setLineNumbering` seam (no fork edit)

**Decision**: drive line numbering through `editor.doc.sections.setLineNumbering({enabled, countBy, start,
distance, restart, target})` (→ `writeSectPrLineNumbering` → `sectPr/w:lnNumType`), wrapped by a new owned
bridge verb `WC.PM.setLineNumbers`. `restart ∈ {continuous, newPage, newSection}`; `enabled:false` removes
`w:lnNumType`.

**Rationale**: feasibility-probed (2026-06-22, real paged renderer) — `setLineNumbering({enabled:true,
countBy:1, restart:'continuous'})` returned success, exported `<w:lnNumType w:countBy="1"
w:restart="continuous"/>`, and `sections.get().lineNumbering` reads it back. No fork edit; one persistence
path. Mirrors 003 columns (public `sections.*` adapter + a thin `WC.PM` verb).

## Decision 2 — In-app render = an OWNED overlay (the engine doesn't paint line numbers)

**Decision**: render the margin numbers with a new owned chrome overlay `line-numbers-overlay.js` that reads
the painted `.superdoc-page .superdoc-line` rects and draws a number to the left of each counted line; it
recomputes on a `wc:paged-relayout` event (and zoom/scroll), exactly like the comments-ui / ink overlays.

**Rationale**: the same feasibility probe showed the paged engine renders **0** line-number elements
(`lineNumberEls: 0`) — it paints `.superdoc-line` rows but no numbers. So an owned overlay is the only no-fork
render path. The overlay counts continuously (or resets per `.superdoc-page` for Restart Each Page) and shows
every `countBy`-th number starting at `start`.

**Alternatives**: a fork edit to the painter (rejected — no fork edits); CSS counters on `.superdoc-line`
(can't express count-by/restart/start or margin positioning faithfully). Rejected.

## Decision 3 — Incremental delivery (P1 → P2 → P3)

**Decision**: P1 = mode/export + ribbon + oracle (a Word-correct document, no in-app numbers yet); P2 = the
owned overlay render; P3 = the Line Numbering Options dialog (start/count-by/distance) + per-paragraph
`w:suppressLineNumbers`. Each its own verify → `/code-review` → ff-merge-to-`main` → push cycle.

**Rationale**: P1 is independently shippable (Word shows the numbers) + the prerequisite; the visible overlay
(P2) and fine controls (P3) layer on. Matches the 002/003 cadence.

## Decision 4 — Word-COM oracle: a new `validate-linenumbers-win.ps1`

**Decision**: read `Sections(1).PageSetup.LineNumbering`: `.Active`, `.RestartMode` (wdRestartContinuous=0 /
wdRestartPage=1 / wdRestartSection=2 — self-verified in-run), `.CountBy`, `.StartingNumber`,
`.DistanceFromText`; PID-safe, `OpenAndRepair:=false`. Invoked via `com-validate.js`, wired into
`test:roundtrip:paged`.

**Rationale**: the export must be real-Word-validated (001–003 standard); XML inspection stays as the fast
in-probe pre-check.

## SPIKE — P3 only (run before the per-paragraph suppress production code)

P1 (model/export) is feasibility-proven; P2 (overlay) reuses the proven comments/ink pattern. The open
P3 questions are the per-paragraph suppress and the start-at off-by-one:

### Q2 — the `w:start` ↔ Word `StartingNumber` off-by-one (P3 start-at)
**Discovered in P1's COM oracle (C6):** authoring `w:lnNumType/@w:start="3"` (our value round-trips through
the bridge — export shows `w:start="3"`, `getLineNumbers().start===3`) reads back in real Word as
`PageSetup.LineNumbering.StartingNumber = 4`. So Word interprets `w:start` off-by-one from its displayed
StartingNumber. **Decision rule (P3):** confirm the exact mapping with ≥2 values (looks like
`StartingNumber = w:start + 1`), then have the start-at control write `w:start = userStart − 1` (clamped
≥0) so Word's StartingNumber equals what the user typed; validate via the COM oracle (StartingNumber ==
authored). P1 ships modes + count-by only (count-by round-trips cleanly — Word `CountBy` == authored);
start-at is deferred to the Options dialog (P3).

**Also for P3 (from review):** `getLineNumbers().distance` defaults to `0.25` for BOTH the no-section case
and an enabled `lnNumType` with NO `w:distance` (where Word means "auto"). P1 never consumes distance (the
Options dialog is a placeholder), so this is inert now — but the P3 Options dialog must NOT write that
synthesized `0.25` back as an explicit `w:distance` Word never had. Track an `distance: 'auto' | number`
distinction (or only write `w:distance` when the user actually sets it) when wiring the dialog.

### Q1 — `w:suppressLineNumbers` (per-paragraph)
**Question**: is setting the current paragraph's `w:suppressLineNumbers` reachable NO-FORK — a fork paragraph
command, an `editor.doc` paragraph-attr API, or an owned `pPr` write (like the 003 columns `bodySectPr`
write)? **Decision rule**: probe a no-fork write + confirm the export carries `<w:suppressLineNumbers/>` in
the paragraph's `pPr` and real Word excludes that paragraph from the count. If unreachable no-fork → record +
an honest toast (P3's suppress is the only spike-gated bit; the Options dialog start/count-by/distance go
through `setLineNumbering`, already no-fork).
