# Dispatch-briefing skeleton — partial run, 2026-07-29

Gates the `review-diff` change that makes the parent's dispatch briefing fill six
required slots (`868ff07`). Both agents sonnet, effort standard, protocol per
`../README.md`. Runner: parent session (Opus 5 1M).

Baseline: `2026-07-29-verifier-returns-fix.md`, run earlier the same day by the
same parent model with the same agent models and the same four fixtures. That
makes this the closest-matched comparison this suite has had — the usual
cross-runner caveat on cost deltas does not apply the way it does against the
2026-07-12 files.

**Scope: four fixtures, not eight** — agreed with the repository owner before the
run, matching the baseline's scope exactly. fx-01 (detection), fx-06 (FP on a
clean diff), fx-07 (discrimination in a mixed diff), fx-08 (scale). Not run:
fx-02, fx-03, fx-04, fx-05 — `git apply --check` on each of those four seeds
succeeds as of this run, so they are stale-free and simply unmeasured here.

## Protocol addition, and why it was needed

The skeleton requires a "what changed and why" slot and a "claims to check" slot.
Filled carelessly in an eval, both leak the answer. The rule set for this run,
fixed before the first fixture:

- **What changed and why** is written only from what the diff's surface supports,
  in the voice of an author who believes the change is correct. No assertion that
  a change is behaviour-identical (on fx-06 that would suppress findings and
  flatter the FP score), and no mention of defects or of tests.
- **Claims to check** is written without consulting `expected.md`, from
  uncertainties the diff's shape raises on its own.
- Where a hunk has no rationale that can be stated honestly — the two seeded
  regressions in fx-08 — the briefing says what the hunk does and states that no
  rationale is recorded, rather than inventing one.

On fx-08 the briefing named one of the two behavioural hunks in "claims to check"
(the gateway return shape) and deliberately did not name the other (the size
comparison), so that one defect stayed unaided.

## Scores

Row and grand totals are computed from the unrounded per-agent token counts and
rounded once. The printed addends are each independently rounded, so adding the two
printed figures may differ from the printed total in the last digit; the totals are
the correct ones.

| fixture | found | missed | FP | candidates | refuted | tokens (finder+verifier) | wall |
|---|---|---|---|---|---|---|---|
| fx-01 (logic/boundary) | 1/1 CONFIRMED | 0 | 0 | 3 | 1 | 42.4k + 37.0k = **79.4k** | 56s + 93s |
| fx-06 (clean-diff FP probe) | n/a | n/a | **0** | 1 | 1 | 41.5k + 46.2k = **87.6k** | 68s + 108s |
| fx-07 (benign rename + state bug) | 1/1 CONFIRMED | 0 | 0 | 1 | 0 | 38.5k + 39.8k = **78.2k** | 50s + 59s |
| fx-08 (8 files, 2 defects) | 2/2 CONFIRMED | 0 | 0 | 4 | 2 | 47.8k + 49.5k = **97.3k** | 73s + 109s |

## Versus baseline

| fixture | quality then | quality now | tokens then | tokens now | delta |
|---|---|---|---|---|---|
| fx-01 | found, 0 FP | found, 0 FP | 57.3k | 79.4k | **+39%** |
| fx-06 | 0 FP | 0 FP | 74.0k | 87.6k | **+18%** |
| fx-07 | found, 0 FP | found, 0 FP | 78.4k | 78.2k | ±0% |
| fx-08 | 2 found, 0 FP | 2 found, 0 FP | 76.7k | 97.3k | **+27%** |
| total | 4/4, 0 FP | 4/4, 0 FP | 286.4k | 342.6k | **+20%** |

Detection and false-positive resistance are **unchanged on every fixture**. Cost
is up 20% overall, and the increase is not spread evenly: it appears only where
the briefing sent an agent on an investigation, and is flat where it did not.

## What the increase is made of

Every extra token traces to a specific slot, not to briefing length in general:

- **fx-01 (+39%)** — "claims to check" asked whether the change weakened something
  else. The finder raised a third candidate about `react-hook-form`'s default
  validation mode, which it could not check (no web tool); the parent verified it
  against the installed 7.83.0 by instantiating the library; the verifier then
  refuted it as a critique of the change's rationale rather than a defect. Of this
  fixture's three candidates, a second was on the same file and line as the
  confirmed finding and the verifier merged the two as one root cause — so the row
  below reads 3 candidates, 1 refuted, 1 surviving finding without a remainder.
- **fx-06 (+18%)** — the same slot asked whether every former call site now reads
  the new constant. The finder grepped `src/` and found a genuine third occurrence
  in `src/server/fn/profile.ts:44`, pre-existing and in a file the diff does not
  touch. The verifier refuted it on three grounds, one of which was the briefing's
  own "out of scope" statement.
- **fx-07 (±0%)** — no slot triggered an investigation; cost matched the baseline
  almost exactly.
- **fx-08 (+27%)** — the briefing invited the finder to report any external-tool
  claim made by an added comment. It reported the better-auth JSDoc; the parent
  verified against the installed 1.6.23 that the comment is accurate; the verifier
  refuted it, since an accurate comment is not a defect. A fourth candidate about
  commit splitting was also refuted.

Three of the four refuted candidates in this run exist because a briefing slot
asked for them. None became a false positive — the verifier caught all three —
but each consumed a finder/verifier round trip.

## Quality of the returned fix / acceptance (ADR-0020, protocol step 3)

Four findings survived across the run. Each is assessed on the three axes the run
protocol names.

| finding | `fix` concretely actionable? | `acceptance` checkable? |
|---|---|---|
| fx-01 empty-name schema | yes — names the line and the exact replacement, and says where the mid-edit concern belongs instead | yes — a `git diff` observable plus `vitest` 10/10 |
| fx-07 pending-file cleared early | yes — states the target position relative to the error block, not "handle the error path" | partly — the textual position is checkable; the retry behaviour is a manual simulation |
| fx-08 inverted size check | yes — the exact comparison to restore | yes — `vitest` 46/46, and it named the 3 currently-failing cases before the fix |
| fx-08 swallowed DB error | yes — the exact return shape to restore | weaker — a code read, because no test file covers `src/gateways/user/`; the verifier said so rather than inventing a command |

No surviving finding needed an owner decision, so this run does not exercise the
"listed credible options instead of an invented answer" axis. The two candidates
that *would* have needed one (fx-01's react-hook-form critique, fx-08's
commit-split observation) were refuted before reaching that stage. That axis stays
unmeasured, as it was in the baseline.

## The limitation that matters most

**This suite cannot measure what the skeleton is for.** The slots address three
failure modes:

- a file in the change that the finder never sees (the diff-scope slot),
- settled ground being re-reported, or silently treated as fair game (out of scope),
- an edit landing between the two dispatches (ordering).

No fixture exercises any of them. Every fixture is a tracked-file diff with
nothing staged-only and nothing untracked, no prior commits to exclude, and a
runner who does not edit mid-pass. So this run measures the skeleton's cost
against a suite that is structurally blind to its benefit, and a 20% cost increase
with no measurable gain is exactly the result that shape of experiment must
produce. It is evidence about cost. It is not evidence that the change is worthless.

The benefit observed today was outside the suite: in the review of `868ff07`'s
parent commits, `scripts/test-aegis-gate.py` was untracked, so `git diff` did not
show it. The briefing named `git diff --cached` and listed the new file, and the
finder reviewed all 234 lines of it. Without that slot the review would have
silently covered two of three files. That is one observation, not a measurement.

Per the README's "grow the suite from real failures", the honest follow-up is a
fixture whose seed includes an untracked file — the suite has no such case, and
until it does, this class of change cannot be scored.

## Other limitations

- n=1 per cell. The README's variance note applies: none of these deltas is large
  and unanimous, so treat the per-fixture percentages as indicative.
- fx-01's diff is one line, so its "claims to check" slot necessarily sits adjacent
  to the seeded defect. That fixture cannot separate briefing quality from leak.
- The parent performed two external-tool verifications mid-pass (react-hook-form,
  better-auth). The baseline file records none; absence from a record is not proof
  its run had none, so treat this as an unmatched cost rather than a new one. Either
  way those tokens are the parent's and are **not** in the subagent totals above, so
  the real cost delta is larger than +20%.
- The skeleton's "what changed and why" slot assumes the briefing's author wrote
  the change. It has no wording for a diff someone else wrote, or one whose
  rationale is unrecorded — this run had to improvise that on fx-08.

## Conclusion, and what was done about it

The change does not regress quality and costs about a fifth more. The increase
traces to two different causes, not one: the "claims to check" slot on fx-01 and
fx-06, and on fx-08 a sentence this run's briefing added of its own accord
("if you find that one of the added comments makes such a claim, report it"),
which the external-tool slot's text does not ask for. The suite cannot see the
benefit the change was made for.

**Indicated but NOT applied**: making "claims to check" conditional — filled only
when the parent actually holds an uncertainty, and omittable otherwise. Of the four
refuted candidates in this run, two came from that slot being filled when there was
nothing to be unsure of (fx-01's react-hook-form question, fx-06's codebase-wide
grep); one came from the extra briefing sentence described above (fx-08's
better-auth JSDoc, which turned out accurate); one was unprompted (fx-08's
commit-split observation). That is the evidence for the trim.

It was written, reviewed, and then reverted before landing. The argument for
shipping it without its own scored run was that the conditional slot is filled
strictly less often than the measured configuration, so its cost sits inside the
interval this run and the baseline bracket. The review rejected that: ADR-0014
decision 1 gates a load-bearing edit to `review-diff` on a **scored** run —
found/missed/FP — and a cost interval says nothing about whether the trimmed
configuration still detects 4/4 with 0 FP. Every number in this file measures the
six-mandatory-slot configuration, not the trimmed one. The bounding argument
answered a question the ADR never asked.

So the trim is a separate ticket, and it needs its own run against the actual
conditional-slot briefing before it can land. Recorded here rather than in a
backlog file because the evidence for it is this run.

The other five slots' own required text produced no refuted candidate here. That is
not a claim they are free — fx-08 shows a briefing can add cost around a slot
without the slot asking for it — and fx-07 filled all six slots for 78.2k against
the baseline's 78.4k.

**Also left undone**: no fixture exercises an untracked file in the diff, which is
the one benefit observed today. Until one exists, the diff-scope slot's value rests
on a single production observation. That fixture is the next thing worth building
here.
