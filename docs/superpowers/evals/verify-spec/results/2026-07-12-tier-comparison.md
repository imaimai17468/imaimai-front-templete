# Spec pipeline model-tier comparison — opus vs sonnet, 2026-07-12

First scored tier comparison for `spec-verifier` + `spec-checker`, enabled by
the new sx-02 (liveness + decoy) and sx-03 (refinement gap + decoys)
fixtures. Protocol per `../README.md`; hunter and checker run on the SAME
tier per configuration. Runner: parent session (Fable). sx-01 opus numbers
are from `2026-07-12-flat-spec-pipeline.md` (not re-run); everything else
ran fresh in this session, n=1 per cell.

## Results

| fixture | tier | expected CE | decoys refuted? | FPs | tokens (hunter+checker) | wall |
|---|---|---|---|---|---|---|
| sx-01 | opus | found, CONFIRMED | — (none raised) | 0 | 47.5k | 98s |
| sx-01 | sonnet | found, CONFIRMED | yes (2/2: livelock framing, R1 re-review) | 0 | 26.2k + 27.1k = 53.3k | 85s + 43s |
| sx-02 | opus | found, CONFIRMED (both lenses) | yes (hunter never raised the cart cycle) | 0 | 22.5k + 23.3k = 45.8k | 31s + 32s |
| sx-02 | sonnet | found, CONFIRMED (both lenses) | yes (hunter evaluated and rejected the cart cycle) | 0 | 26.3k + 28.4k = 54.7k | 73s + 34s |
| sx-03 | opus | found, CONFIRMED | yes (2/2: conflict wait, autosave loop) | 0 | 22.7k + 23.8k = 46.5k | 77s + 56s |
| sx-03 | sonnet | found, CONFIRMED | **no — 1 of 3** (autosave loop and I1 refuted; **conflict wait CONFIRMED**) | **1** | 26.5k + 28.0k = 54.5k | 154s + 84s |

## The discriminating case (sx-03, conflict-wait decoy)

Both tiers' checkers received essentially the same candidate: "conflict's
only exit is `resolve`, guarded on 'user chose a merge'; a user unwilling to
merge is stuck." The **opus checker REFUTED** it: the guard is a
user-controllable predicate the user can always satisfy, so an enabled
action exists at every point — a voluntary refusal to take an available
transition is structurally identical to the autosave decoy, not a
machine-imposed dead end. The **sonnet checker CONFIRMED** it (major),
reasoning that `conflict` lacks an external escape valve — importing a
"user may permanently decline" liveness notion the machine doesn't declare.
Per `sx-03/expected.md` this is the listed decoy: a false positive.

Notably the sonnet checker refuted the *same shape* correctly in sx-01 (the
review⇄done livelock) — the sx-03 variant is harder because the escape
guard is a discretionary user choice rather than an unconditional action.
That asymmetry is exactly the tier boundary the fixture was built to probe.

## Read and decision (ADR-0014)

- **Detection (recall): tie.** 3/3 expected counterexamples found and
  CONFIRMED on both tiers, correct traces and mechanisms.
- **Precision: opus wins.** 0 FPs across all fixtures vs sonnet's 1 FP on
  sx-03 — and the FP is severity-major, the kind that would send a design
  back for an unnecessary fix.
- **Cost: opus wins too.** Opus configurations used ~11-16% FEWER tokens
  per fixture (47.5k vs 53.3k, 45.8k vs 54.7k, 46.5k vs 54.5k) and
  comparable-or-better wall time — the
  opus agents produce tighter hunts (fewer low-confidence candidates for
  the checker to replay) and tighter replies.

**Decision: `spec-verifier` and `spec-checker` stay on `opus`.** The
hypothesized efficiency win from downgrading to sonnet does not exist (
sonnet was more expensive AND less precise here), so there is no trade to
weigh. This is now a scored-eval-backed model-tier decision per ADR-0014.

Caveats: n=1 per cell; sonnet's sx-03 FP is one stochastic sample, and the
checker's reasoning was internally coherent — a re-run could land either
way. But with cost also favoring opus, the decision doesn't hinge on the
FP. Re-run the suite before any future downgrade attempt.
