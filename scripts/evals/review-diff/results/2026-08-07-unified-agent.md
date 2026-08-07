# Unified review agent (ADR-0029) — one `code-reviewer`, sonnet, 2026-08-07

Gates the ADR-0029 change that merges the `code-reviewer` finder and the
`review-verifier` into a single agent running four ordered stages in one context.
Protocol per `../README.md`, one dispatch per fixture, effort standard, read
restricted away from `scripts/evals/` in every dispatch prompt. Runner: parent
session (Opus 5 1M); the agent is sonnet, unchanged by this ADR.

Partial run on fx-01 / fx-06 / fx-07 / fx-08 — the same four fixtures, parent
model and agent model as the baseline below, which is what makes the comparison
direct. Precedent: `2026-07-29-verifier-returns-fix.md` and
`2026-07-29-briefing-skeleton.md` both gated a `review-diff` change on this same
subset.

**The question this run answers.** ADR-0015 put the refute pass in a fresh,
finding-blind context, and that independence was its load-bearing property.
ADR-0029 removed it. So the number that matters is not only "was the seeded
defect found" — it is **whether Stage C still kills candidates when it can see
the Stage A reasoning that produced them.** A run that found everything and
refuted nothing would be the failure mode, not a success.

## Scores

| fixture | expected | found | FP | candidates | refuted | tokens | wall |
| ------- | -------- | ----- | -- | ---------- | ------- | ------ | ---- |
| fx-01 (logic/boundary) | 1 | 1/1 CONFIRMED (critical) | 0 | 1 | 0 | 50.1k | 177s |
| fx-06 (clean-diff FP probe) | 0 | n/a | **0** | 0 | 0 | 47.4k | 81s |
| fx-07 (benign rename + state bug) | 1 | 1/1 CONFIRMED (major) | 0 | 1 | 0 | 49.3k | 136s |
| fx-08 (8 files, 2 defects) | 2 | 2/2 CONFIRMED (critical + major) | 0 | 8 | 6 | 57.1k | 163s |
| **total** | **4** | **4/4** | **0** | **10** | **6** | **203.9k** | **557s** |

## Against the two-agent baseline

Source: `2026-07-29-briefing-skeleton.md` (same four fixtures, same parent model,
both agents sonnet). Its token figures are the sum of two contexts; this run's are
one, so read the totals rather than a per-agent comparison.

| fixture | baseline | this run | cost |
| ------- | -------- | -------- | ---- |
| fx-01 | found, 0 FP, 79.4k, 149s | found, 0 FP, 50.1k, 177s | **63%** |
| fx-06 | 0 FP, 87.6k, 176s | 0 FP, 47.4k, 81s | **54%** |
| fx-07 | found, 0 FP, 78.2k, 109s | found, 0 FP, 49.3k, 136s | **63%** |
| fx-08 | 2 found, 0 FP, 97.3k, 182s | 2 found, 0 FP, 57.1k, 163s | **59%** |
| **total** | **4/4, 0 FP, 342.5k, 616s** | **4/4, 0 FP, 203.9k, 557s** | **60%** |

- **Detection: pass.** 4/4, every one matching the nature `expected.md` names, no
  fixture regressed against the baseline.
- **False positives: pass, and this is the half that mattered.** Zero across all
  four, including the two fixtures built to provoke over-reporting: fx-06 (any
  CONFIRMED finding is an FP) and fx-08's six benign files.
- **Cost: 60% of baseline**, and unanimous — every fixture is cheaper. One context
  replaces two, and the saving is real rather than a measurement artifact: the
  merged agent reads the diff once.
- **Wall time: 557s vs 616s.** Slightly better in total despite the stages now
  running serially inside one agent, because two agent startups are replaced by
  one. Per fixture it goes both ways (fx-01 and fx-07 are slower, fx-06 and fx-08
  faster), which is variance rather than a trend at n=1.

## Did the refute stage survive the merge?

This is the part the merge put at risk, so it is recorded in detail rather than as
a rate.

**6 of 10 candidates refuted (60%), versus 4 of 9 (44%) in the baseline.** The
merged agent raised slightly more candidates and killed a higher fraction of them.
More telling than the rate is *what* it refuted, and on which fixtures:

- **fx-08 carried the whole refutation load: 8 candidates, 6 refuted.** The six
  were the benign majority the fixture exists to probe — four JSDoc/comment
  additions, a local rename, and a string extracted to a constant. Each was killed
  on a specific verified fact rather than waved off: the `cf-typegen` comment was
  checked against `package.json`'s actual script and `worker-configuration.d.ts`'s
  own generated header; the `cn` comment against `twMerge`'s conflict-resolution
  behaviour; the jsdom `scrollTo` comment against what the shim actually does.
  That last one matters — `fx-08/expected.md` records that two earlier attempts at
  that comment shipped false claims and were correctly flagged, voiding a run's FP
  measurement. This run's agent read it and let it stand.
- **fx-06 produced no reportable candidate at all**, and the report shows why: it
  raised the "MB vs MiB" terminology point in Stage A, then set it aside itself as
  identical to the pre-diff text and outside the diff's scope. That is the noise
  calibration working at the stage it is written for.
- **fx-07's discrimination half held.** The `avatarUrl` → `avatarSrc` rename was
  examined, confirmed to be a pure local rename with no stale reference, and not
  reported — while the `setPendingFile(null)` reorder in the other file was
  confirmed by walking all three paths through the block and naming what the user
  observes on the failure path.
- **Verification was empirical where it could be.** fx-01 and fx-08 both had the
  agent run the existing vitest suites and observe the seeded defect failing real
  assertions, rather than reasoning to the conclusion. `fx-08/expected.md` notes
  this makes those two fixtures' *detection* half easy on purpose; the point here
  is that the agent took the available evidence instead of asserting.

Every verdict carried the `file:line` citation ADR-0029 requires, refutations
included.

## Verdict

- **ADR-0014 eval obligation for the ADR-0029 change, review side: satisfied.**
  The revert clause does not fire.
- **Quality non-regression: pass** on both detection and false-positive
  resistance, with no fixture worse than baseline on either.
- **The merged agent did not rubber-stamp its own findings.** That was the
  specific risk ADR-0029 accepted, and on this suite it did not materialize.

## Limits of this result

- **n=1 per cell.** The README's variance note applies: infrastructure config
  alone has been measured to move agentic benchmarks by several points. What
  carries this decision is that the deltas are large and unanimous — 4/4
  detection, 0 FP everywhere, every fixture cheaper — not any single number.
- **This measures review quality, not the gate.** `scripts/test-review-gate.py`
  covers the mechanism, including the residual gap ADR-0029 accepted (a stamp is
  no longer bound to a tree).
- **No fixture probes the independence downgrade directly.** The suite can show
  that Stage C refuted things; it cannot show that a *self-confirming* refutation
  would have been caught, because nothing here is built to bait one. A fixture
  whose seeded defect is a plausible-but-wrong finding — one a finder would raise
  and an independent verifier would kill — is the gap this run leaves open, and it
  is the fixture worth adding next.
- **fx-02, fx-03, fx-04 and fx-05 were not run.** Their comparison targets predate
  ADR-0020 and the briefing slots, so a delta against them would mix pipeline
  generations; that is why the subset is the subset.
- **The narrative above is checkable, but only because this run started saving the
  reports.** The four returned reports are in `2026-08-07-unified-agent/fx-NN.md`,
  extracted verbatim from the run transcripts, so every claim in "Did the refute
  stage survive the merge?" can be read against its source. The review of this file
  raised the gap first — with nothing saved, that section was the runner's account
  of four transcripts nobody else could open, and the review could call it neither
  true nor false. `README.md` step 2 now requires the save. **Earlier results files
  predate it** and their narratives remain unbacked; that is not retroactively
  fixable, since those transcripts are gone.
