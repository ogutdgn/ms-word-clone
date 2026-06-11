# Loop prompt (static — re-fed every iteration)

> Use with `/loop` (self-paced) or the official `ralph-wiggum` plugin:
> `/ralph-loop "Read docs/loop/loop-prompt.md and do exactly one iteration of it." --completion-promise "PHASE2-COMPLETE" --max-iterations 60`

You are running the completion-driven agent loop for ms-word-clone. The contract is
`docs/loop/loop.md` — read it fully first. Do exactly ONE iteration, then exit (the
runner re-invokes you).

1. **Startup ritual:** `git checkout completion-driven-agent-loop && git pull`. Read
   `docs/plan/last-point.md` (top entry) and `docs/plan/execution-map.md` (CURRENT
   PHASE). Confirm working tree clean.

2. **If Step 0 (Windows replication) is not yet checkpointed** (no
   `scripts/oracle/word-oracle-win.ps1` in the repo, or no Step-0 entry in
   last-point.md): do Step 0 per loop.md §Step 0 — INCLUDING requesting ALL
   computer-use permissions (Microsoft Word + the clone Electron app + Explorer) UP
   FRONT in one request_access call so the user is never blocked mid-loop later.
   Checkpoint, commit, exit the iteration.

3. **Otherwise pick the next unit of work**, in order: slice 8 (review) → slice 9
   (references) → slice 10a themes → 10b mail-merge → 10c draw/ink → 10d
   insert-exotica → slice 11 (retirement). The previous iteration's checkpoint ends
   with a `### Next slice definition` — that is your brief. One unit per iteration.

4. **Run the per-slice procedure** from loop.md: Word-side spec capture + parity
   checklist (all items start failing) → critique-hardened plan → subagent-driven
   execution with red-first tests and two-stage review → all six gates green → the
   execute↔compare↔fix inner loop under computer use until every parity item is
   verified `[x]` (side-by-side screenshots, clone vs real Windows Word: UI, dialogs,
   popups, in-document behavior) → oracle legs → PR into
   `completion-driven-agent-loop`, merge when green.

5. **Checkpoint** via the plan-tracking skill (dated last-point.md entry ending with
   the `### Next slice definition` for the next iteration; tick execution-map). Commit
   everything. Never merge to `main`.

6. **Completion / escape:**
   - If slice 11 just merged and all six gates are green on
     `completion-driven-agent-loop` and `docs/loop/deferrals.md` is current: write the
     final Phase-2 checkpoint, present the cloud-stub list for the user's hide-vs-keep
     decision in the checkpoint notes, and output exactly: `PHASE2-COMPLETE`
   - If blocked by something ONLY the user can resolve (an OS dialog computer use
     cannot operate, licensing, hardware): document the blocker + everything attempted
     in last-point.md, then output: `BLOCKED-NEEDS-USER`
   - Otherwise just exit; the runner continues the loop.

Rules that override everything: decide autonomously (the goal — exact MS Word behavior
— is the arbiter; never wait for user input on design choices); never weaken or delete
a test or parity item to make it pass; one unit of work per iteration; all state lives
in the repo files, never in conversation memory.
