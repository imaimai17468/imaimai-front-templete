# Current-tree code-reviewer tier comparison

- Date: 2026-08-13
- Baseline: `3fb7e0259e47e9ceb9d04198c2f5467fae5375f8`
- Claude Code: `2.1.226`
- Agent: `.claude/agents/code-reviewer.md`
- CLI effort: `medium`
- Review effort requested in every prompt: `standard`
- Runs: fx-01, fx-06, fx-07, fx-08, fx-09, fx-10; one run per model and fixture
- Actual models from `modelUsage`: `claude-sonnet-5`, `claude-opus-5`

Every run used the same fixture-specific prompt for both models, prohibited
reading `scripts/evals/**` and `docs/superpowers/**`, applied one seed to a clean
tree, and reverse-applied it before the next run. Raw returned reports are saved
under `results/2026-08-13-sonnet-opus-current/`.

## Quality score

| fixture | expected | Sonnet 5 | Opus 5 |
|---|---:|---|---|
| fx-01 | 1 | found 1/1, FP 0 | found 1/1, FP 0; test-failure facet is an acceptable extra |
| fx-06 | 0 | FP 0 | FP 0 |
| fx-07 | 1 | found 1/1, FP 0 | found 1/1, FP 1 on the benign UserMenu rename |
| fx-08 | 2 | found 2/2, FP 0 | found 2/2, FP 1 on a benign auth-actions comment |
| fx-09 | 1 | found 1/1, FP 0 | found 1/1, FP 0; three reports are facets of the seeded boundary defect |
| fx-10 | 1 | found 1/1, FP 0, fix pass | found 1/1, FP 0, fix pass |
| **total** | **6** | **found 6/6, missed 0, FP 0, fix-degraded 0** | **found 6/6, missed 0, FP 2, fix-degraded 0** |

Opus raised more candidates and often provided deeper supporting analysis, but
it did not improve expected-defect detection or the fx-10 remedy. Its two extra
process findings contradict the fixtures' explicit benign-edit contracts and
therefore score as false positives.

The fx-08 FP difference is effort-confounded: Sonnet returned `effort: high`
while Opus returned `effort: standard`. The fx-07 difference is not confounded
because both returned `standard`; even if fx-08 is treated as inconclusive,
Opus still has no detection/fix gain and one additional FP.

## Cost and latency

| fixture | Sonnet cost | Sonnet wall | Opus cost | Opus wall |
|---|---:|---:|---:|---:|
| fx-01 | $0.3268 | 66.0s | $0.6194 | 108.1s |
| fx-06 | $0.2448 | 41.3s | $0.7615 | 112.3s |
| fx-07 | $0.3616 | 69.8s | $0.5339 | 65.4s |
| fx-08 | $0.5167 | 95.9s | $0.6887 | 107.7s |
| fx-09 | $0.4905 | 144.1s | $1.1039 | 200.6s |
| fx-10 | $0.3597 | 57.9s | $0.5884 | 75.5s |
| **total** | **$2.3000** | **474.9s** | **$4.2958** | **669.6s** |

Opus cost 1.87 times as much and took 1.41 times as long wall-clock for this
suite. Usage totals:

| model | cache creation | cache reads | output |
|---|---:|---:|---:|
| Sonnet 5 | 233,254 | 1,467,032 | 30,675 |
| Opus 5 | 251,882 | 1,727,697 | 36,503 |

## Decision

Keep `code-reviewer` pinned to `sonnet`.

The promotion criterion was measurable quality headroom that justified higher
cost and latency. This run found equal detection and equal remedy quality, with
one unconfounded additional false positive from Opus and one effort-confounded
false positive. The existing escalation policy remains appropriate: use Opus
after a demonstrably weak Sonnet result or for a targeted high-risk second
opinion, not for every commit.

No agent frontmatter or model-policy document changes in this run.

## Limits

- One run per cell; close differences remain subject to run variance.
- Both models ran under `permissionMode: auto`, but their attempted Bash commands
  differed and some were denied. Core verdicts were re-derived from code in the
  returned reports.
- CLI effort was `medium` for every run, but returned review effort differed:
  Sonnet fx-01=`normal`, fx-06/07=`standard`, fx-08/09/10=`high`; Opus returned
  `standard` for all six. In particular, fx-08's FP delta must not be attributed
  to model family without a matched-review-effort rerun.
