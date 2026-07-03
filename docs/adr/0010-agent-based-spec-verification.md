# 0010. Interaction-complex features get agent-based spec verification (FSL's discipline without fslc)

- Status: accepted
- Date: 2026-07-03

## Context

FSL (https://ymm-oss.github.io/fsl/) verifies finite-state-machine specs with
an SMT-backed checker (`fslc`): BMC, k-induction, liveness, and refinement.
Its when-to-use guidance targets exactly the front-end failure modes that
example-based tests miss — back / cancel / retry / reload / double-submit /
permission branching — and argues the deciding factor is interaction
complexity, not scale.

We evaluated adopting fslc directly (2026-07-03): the tool is real and active
(Apache-2.0, standalone binaries bundling Z3, v2.6.2 released 2026-07-02) but
has essentially zero adoption (5 stars, single org), no TypeScript integration
(test generation emits Python; no TS types, codegen, or CI recipe), and this
template's toolchain is Bun + TS. The verifier would run fine in CI, but
nothing would connect it to the codebase.

Meanwhile the template already has a proven agent pipeline shape: review-diff's
find → adversarial-verify structure (ADR-0009) kills plausible-but-wrong
findings with independent skeptical contexts.

## Decision

Adopt FSL's **discipline**, not its toolchain. For features with non-obvious
state transitions, start-workflow step 4 requires a lightweight spec
(`specs/<feature>.spec.md`: states, actions with requires/ensures, invariants,
forbidden flows, requirements — format in `specs/README.md`) verified by a new
`verify-spec` dynamic workflow before implementation:

1. **Formalize** (1 agent) — normalize the spec into a structured machine and
   flag ambiguities (undefined states, missing guards, nondeterminism,
   unsupported requirements). The `fslc check` analog.
2. **Hunt** (4 parallel lanes) — construct counterexample traces within a
   step bound against invariants, forbidden flows, liveness, and requirements
   refinement, using the adversarial toolkit (back, reload, double-submit,
   permission change). The `fslc verify` analog, heuristic not exhaustive.
3. **Verify** — an independent context replays each trace step by step and
   REFUTEs illegal or non-violating traces, mirroring ADR-0009.

The workflow is design-time and advisory: it does not stamp the commit gate.
The parent fixes the design for every CONFIRMED counterexample and re-runs.

## Alternatives considered

- **Adopt fslc itself**: rejected for now — maturity risk (5 stars, bus factor
  of one org), zero TS linkage, Python-only test generation. The spec format
  is deliberately close to FSL's model so `.spec.md` → `.fsl` migration stays
  cheap if fslc matures; revisit then.
- **Do nothing (tests only)**: rejected — white-box tests verify the
  implementation against the developer's mental model; loophole flows live in
  the mental model itself and need adversarial search before code exists.
- **Fold spec checking into review-diff**: rejected — wrong timing. Review
  runs at commit time on code; counterexamples are cheapest to fix at design
  time before implementation.

## Consequences

- Loophole hunting moves to design time; the spec's invariants and forbidden
  flows double as white-box test cases after implementation.
- Honest limitation: agent search proves nothing — it is bounded, heuristic
  counterexample hunting. Do not present a clean run as verification of
  correctness.
- Cost: ~6 agents per run on sonnet, only for interaction-complex features.
- Specs must be kept current when behavior changes; a stale spec misleads
  every later reader. Spec upkeep is part of the feature's definition of done.
- `verify-spec.js` shares review-diff's load-bearing status: changes should go
  through empirical tuning (ADR-0006 consequence applies).
