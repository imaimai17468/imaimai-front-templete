# Open items: instructions that fire only if an agent remembers — 2026-07-29

Two items left after the review-pipeline series (ADR-0019/0020, PRs #49–#52).
This is an open-items backlog — deliberately a third shape alongside this
directory's `-design.md` (a proposal for something to build) and `-findings.md`
(the output of a `repo-audit` run, with its verification-status scheme). Neither
fits a list of work that is known, argued, and not started.

The two items share a shape: a step the project depends on has no mechanism behind it, so
whether it happens is decided by an agent choosing to do it. This project has
concluded twice that such triggers are unreliable — ADR-0001 abandoned skills for
coding rules because "skill invocation is unreliable", and ADR-0013 rejected
warn-not-block because "a warning the agent may ignore is not a gate".

Written down because both were discussed and neither was recorded anywhere; a
later session would have re-derived them from scratch.

## 1. `verify-spec` has never fired, and nothing would make it

**State, as measured 2026-07-28:**

- `specs/` contains `README.md` and nothing else. No `specs/*.spec.md` has ever
  existed: `git log --diff-filter=A -- '*.spec.md'` returns one commit
  (`1207232`), and all three files it added are eval fixtures under
  `docs/superpowers/evals/verify-spec/` (`wizard`, `checkout`, `draft-editor`).
- All four commits that touched `specs/` are infrastructure: introduction
  (`e6b5de2`), the single-opus-run refactor (`7dd6b80`), the eval suite
  (`1207232`), and the ADR-0015 citation fix (`3eaaed6`).
- The only recorded runs of `spec-verifier` / `spec-checker` are the two eval
  files under `docs/superpowers/evals/verify-spec/results/` — the pipeline
  evaluating itself.

**Why zero specs is not yet evidence of a missed trigger.** `verify-spec` landed
2026-07-03. Most commits touching `src/lib/auth`, `src/server/fn` or `src/routes`
since then are fixes or refactors — the secret-signing hole, the avatar size
ceiling, the client-action rename, an a11y fix. Three `feat:` commits landed too,
and none introduced a new interaction flow: `4b4c7d1` simplifies the theme toggle
to a synchronous one-click state flip, `1b239e2` redesigns the top page into
static content, and `d283030`'s only touch to `src/routes/login.tsx` is a
mechanical `onClick={() => void signInWithGoogle()}` wrapper for
`no-misused-promises`. So no qualifying case has come up — measured, not assumed:
the first draft of this paragraph claimed every such commit was a fix or refactor,
which the review disproved in one `git log`.

**Why it will not fire when one does.**

- No hook, gate or artifact touches `specs/`. ADR-0015 is explicit: design-time
  only, no commit gate. The whole mechanism rests on an agent reading AGENTS.md
  and classifying its own task as "interaction-complex".
- The classification is a judgement ("interaction complexity, not scale") and it
  is demanded at the moment when starting to code is cheapest.
- Failure is silent. Nothing is missing afterwards, no gate goes red, and the
  user is never told the step was skipped — unlike the review, where a missing
  `.review-stamp` blocks `git commit`.
- Aegis does not help: the `specs/** → adr-0010` edge fires when a file under
  `specs/` is edited, i.e. only after someone has already decided to write a
  spec. Backwards for prevention.

**Proposal.** Convert the silent skip into a visible claim. `start-workflow`'s
plan step must state, for every ticket, `spec: required` or `spec: not required`
with a one-line reason. The reviewer then sees the claim next to the diff and can
disagree with it — the same move ADR-0013 made when it turned "a review happened"
into an artifact.

This does not make the classification easier. It makes getting it wrong visible,
which is the part that is currently impossible.

**Rejected:** a heuristic hook (flag a new file under `src/routes/` with a
`beforeLoad` guard, or a component past N `useState` calls). It misfires on
ordinary work and still does not capture "is this interaction-complex", so it
would train the reader to ignore it.

**Also worth doing when this is next touched:** run the seeded fixtures
(`sx-01..03`) once against the current agent definitions. They last ran
2026-07-12; the first real feature that needs spec verification should not also
be the first test of whether the pipeline still works.

## 2. Dispatch briefings are free-form, and that produced real errors

`review-diff` pins the review *procedure*, but the parent's dispatch prompt is
written from scratch each time. ADR-0019 records two procedural failures from
2026-07-28: a full-mode re-review where delta mode was called for (before delta
was removed), and an edit made between the finder and verifier dispatches, which
voided the pass by design.

**Proposal.** A required briefing skeleton in `review-diff`: diff scope, what
changed and why, the specific claims to verify, and the ordering reminder. The
`empirical-prompt-tuning` skill exists for exactly this kind of iteration and can
carry the tuning.

One piece already landed in #50 (`92e75cf`): the parent must verify claims about external
tool behaviour and pass the quote and URL into both dispatch prompts, because
neither review agent has a web tool and so neither can discharge
`.claude/rules/authoring.md`'s verify-every-claim rule for that class of claim.

**Note the cost side, honestly:** a template constrains the parent's briefing,
and ADR-0014's eval obligation covers load-bearing edits to `review-diff`. A
skeleton that changes what the finder is told is arguably load-bearing, so budget
a scored run before assuming this one is free.
