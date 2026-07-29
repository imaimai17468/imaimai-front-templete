# fx-08 large mixed diff — full vs delta, 2026-07-12

First run of fx-08 (8 files: 6 benign edits + 2 seeded defects), the fixture
added to close the "no large-diff fixture" gap. Measures detection in a noisy
multi-file diff, FP resistance on the benign majority, and the delta-mode
savings hypothesis at realistic diff size. Both agents sonnet, effort
standard. Runner: parent session (Fable).

## Full run

| metric | result |
|---|---|
| gateways swallowed-error defect | **found**, CONFIRMED critical (call chain traced to the always-success toast) |
| ProfileForm inverted size check | **found**, CONFIRMED critical |
| false positives on the 6 benign files | **0** (finder cleared all six; verifier spot-check agreed) |
| tokens (finder + verifier) | 41.9k + 39.9k = **81.8k** |
| wall time | 47s + 25s |

The finder even cross-checked the cloudflare.ts comment edit against
ADR-0005 before clearing it — benign-majority noise did not degrade
precision.

## Delta scenario — two runs, one protocol lesson

After the full run, `delta.patch` fixed the gateways defect (restoring the
file to HEAD, so it *dropped out of the diff*).

**Attempt 1 — fail-closed fallback (protocol lesson).** The dispatch
described the delta as "one edit to src/gateways/user/index.ts restoring the
error return". The finder checked `git diff HEAD`, found the declared-delta
file absent from the 7-file diff (correct — the fix made it identical to
HEAD), judged the delta description inconsistent with the observed diff, and
fell back to a full pass per the fail-closed rule. Cost: 44.5k tokens / 81s —
i.e. **no savings**, plus it re-raised the still-open ProfileForm finding and
one borderline rule candidate (the pre-existing cloudflare.ts lint-disable,
deferred to a verifier that was never dispatched — the attempt was recorded
and superseded, not scored).

Lesson (now load-bearing for delta dispatches): **describe the delta
relative to the resulting diff, not the edit** — when a fix reverts a file
to HEAD, say the file dropped out and enumerate the expected remaining
files. Fail-closed worked exactly as designed; the cost of a vague delta
description is a silent full-price review.

**Attempt 2 — corrected description.** Declared: "gateways file now matches
HEAD and dropped out; remaining diff = exactly these 7 files, byte-identical
since the prior review; ProfileForm finding intentionally unaddressed,
parent-tracked." Result: `mode: "delta"`, no fallback, fix confirmed, zero
candidates; verifier spot-checked the fix independently and returned clean.

| metric | full run | delta run (attempt 2) | saving |
|---|---|---|---|
| tokens | 81.8k | 29.5k + 28.4k = **57.9k** | **−29%** |
| wall time | 72s | 14s + 12s = **26s** | **−64%** |

## Read

- **Detection at realistic diff size: pass.** Both seeded defects CONFIRMED,
  0 FPs across 6 benign files — the noise-suppression tuning (#1) holds at
  8-file scale.
- **Delta savings are real but bounded by fixed overhead.** Wall time drops
  64%, but tokens only 29%: each dispatch carries ~25-28k of fixed cost
  (preloaded skill + agent scaffolding), so the token floor for any
  two-agent cycle is ~50k regardless of scope. Delta mode saves the
  *variable* cost (re-reading 7 unchanged files), which at this size is
  ~24k. Savings should grow with diff size, but the fixed floor means delta
  mode can never go below ~50k/cycle under the current two-dispatch shape.
- **The fail-closed rule fired correctly on its first real ambiguity** —
  and the cost of triggering it is a full-price review, which is the right
  failure direction (never a silently under-scoped one).

Caveats: n=1 per configuration; the delta candidate-count was zero, so
verifier cost in delta mode is near its floor — a delta with surviving
candidates would cost more.
