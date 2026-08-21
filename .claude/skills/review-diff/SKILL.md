---
name: review-diff
description: Unified pre-commit review of the uncommitted diff — one agent hunts across all lenses (bugs + AGENTS.md rules), adversarially refutes each candidate against the real code, and returns the survivors with their fixes; its completion stamps the commit gate. Run before every commit, or whenever the uncommitted diff needs a full review. Pass "high" for a deeper multi-lens refute pass.
---

# Review Diff

Fresh-context review of the uncommitted diff before a commit. The review runs as **one parent-dispatched agent, `code-reviewer`, in a fresh implementation-blind context**, executing four ordered stages:

- **Stage A — find**: read the diff, report every candidate across all lenses.
- **Stage B — dedup**: merge candidates anchored to the same (file, line).
- **Stage C — refute**: re-derive each candidate from the real code and try to kill it.
- **Stage D — return**: the survivors, each with its fix and acceptance check.

It is a depth-1 dispatch the parent waits on directly — never a nested "agent waiting on its own child," which was the fragile joint that lost verdicts under an earlier nested design (2026-07-10 incidents). The agent's completion stamps the commit gate.

**find ≠ verify is now a discipline, not a mechanism.** Stage C shares a context with Stage A and can see the reasoning that produced each candidate; the separate verifier that could not was what an earlier design relied on. That downgrade is the accepted risk of the single-agent shape, taken after measuring that the second dispatch was not what made the pipeline expensive — proving the parent had not edited *between* two dispatches was. The counterweight is that every verdict must cite the `file:line` it was re-derived from, so a refutation that never opened the code is visible in the output.

Benchmarking (2026-07-04) already collapsed the old 5–7-lane parallel workflow to one comprehensive finder + one verifier at ~1/5 the cost; the verifier was then unnested, and later merged back into the finder as Stage C.

## Routing — how this runs

- **You are the parent session** (human invoked `/review-diff`, or step 7 of the AGENTS.md Workflow sequence):
  0. **Dispatch with `run_in_background: false`.** Background is the platform default for subagents: the dispatch returns launch metadata rather than a result, so the parent's turn ends at the launch and the report arrives in a later turn (122 Agent results measured on 2026-07-30, all `async_launched`). That split costs no human input — the completion notification resumes the session by itself — but it is still a split, with a Stop gate running inside it. Pass the flag — it is the documented switch — but do not write the single uninterrupted turn down as something this repository has confirmed: nothing observed here shows it producing a synchronous return. A `cloud_default` remote container was found exporting `CLAUDE_AUTO_BACKGROUND_TASKS=true`, and both behaviours were then seen there with that variable unchanged: eleven dispatches came back `Async agent launched successfully`, and later ones returned synchronously. So the variable correlates with backgrounding without being a confirmed override — check it as the first suspect, not as an established mechanism, and do not read a synchronous return as proof it is unset. **This is the one place that observation is recorded**; AGENTS.md's Delegation section points here for it. The gate is indifferent to which way it goes: `post-agent-review-stamp.sh` keys on `SubagentStop`, which fires on completion either way.
  1. Dispatch the `code-reviewer` agent on the uncommitted diff (this clears any stale stamp — new cycle), passing the `effort` if the user asked for `high`. Wait for it. It runs all four stages and returns the surviving findings; its completion stamps `.claude/.review-stamp`.
  2. Integrate the findings it returns. Do NOT run the stages in the parent context yourself — the fresh agent context is the whole point.
  **The agent has no web tool** (`tools: Read, Bash, Skill`), so it cannot
  check a claim about how an external tool behaves — a CLI flag, a config key, a
  framework's API. When the diff makes such a claim, verify it yourself and put
  the quote and its URL in the dispatch prompt. Without that it can only
  report it as unverified, which is correct of it and useless to you.
- **You are the `code-reviewer` agent** (this skill is preloaded): execute **Stages A–D** below, in order, and return the report. Do not dispatch anything and do not touch the stamp.

### The briefing (parent) — required slots

The procedure above is pinned; the dispatch prompt is not — it is written from scratch every time. Fill every slot below. A slot with nothing to say gets one line saying so: an omitted slot reads as "not applicable" when it usually means "not thought about".

**No hook checks that these slots are filled** — a known limitation, not a claim of enforcement. This repo has rejected instruction-only mitigations more than once — on skill invocation, on warn-not-block, and on delta mode. This one is kept anyway because it downgrades no mechanism: before it the dispatch prompt had no guidance at all.

- **Diff scope.** The paths, and the command that actually shows them. `git diff` shows neither staged-only nor untracked files, so name `git diff --cached` and list new files explicitly when the change includes them. A new file the agent never saw is not a reviewed file. **When the diff fits comfortably in the prompt (roughly a few hundred lines), paste it in** — the parent has just produced it, and inlining gives Stage A the diff in context from the first token — the Procedure's scope-discovery commands still run, but the agent can begin pattern-matching before their results arrive. The pasted text is a convenience copy, not the target: the Procedure still has the agent read the diff from the tree, and a mismatch between the two means the briefing is stale — say so instead of reviewing the paste. Also name the path-scoped rule files under `.claude/rules/` whose scope (listed in AGENTS.md "Rules") matches the diff, so the rules lens opens the right files without re-deriving the match; naming none is a claim that none match, so check before writing it.
- **What changed and why.** The intent, in a few sentences. Whether the code does what was meant is only checkable by someone who was told what was meant.
- **Out of scope.** Earlier commits on the branch, adjacent files, known debt — what must not be re-reported, and why it is out. Without this the agent either re-reports settled ground or silently treats it as fair game.
- **Claims to check.** The two or three things you are least sure of, written as claims rather than areas: "confirm this cannot abort under `set -e`" gets checked, "review the hook" does not.
- **What to challenge hardest.** Name the candidates whose truth would change the fix, and say plainly where the diff contradicts something you believe — that is the cue for Stage C to re-derive rather than wave through. Stage C can see Stage A's reasoning, so this slot is where you spend the independence the mechanism no longer supplies.
- **External tool behaviour.** Handled by the parent routing bullet above ("The agent has no web tool…") — nothing to add here beyond following it.
- **Ordering.** State that you will not edit any file while the dispatch is running. That is the hole the path-scope mechanism does not close: the stamp is written when the agent finishes, so a path first touched mid-run is recorded as reviewed. Nothing enforces it.

## When to run

- Step 7 of the AGENTS.md Workflow sequence, before proposing a commit.
- Any time the uncommitted diff needs a full review.

**Once per commit.** Applying what the review confirmed does not require running
this again: the stamp records which paths the reviewer read, and a fix touches
those same paths. The pass ends at the fix. One review also covers a multi-commit
split, because committing removes paths from the diff rather than adding any. What
it does not cover is a file the review never saw — that needs a fresh pass.

## Effort

- **standard** (default): Stage C uses a single reproduction lens.
- **high**: Stage C uses three lenses (correctness, reproduction, scope) and a finding survives only if it is NOT refuted by a majority. Use for security-sensitive or high-blast-radius diffs.

There is one mode: find over the entire uncommitted diff. The pass runs once per
commit and ends at the fix — there is no re-review mode to reach for, and a
partial-scope re-run no longer exists.

## Procedure

**Target:** the uncommitted diff. Run `git status`, `git diff HEAD`, and `git ls-files --others --exclude-standard`; read untracked files directly. If there are no uncommitted changes, return an empty candidate list.

The four stages run in one context, in order. Their standards differ — Stage A is coverage-first, Stage C is adversarial — so do not blend them.

### Stage A — Find (all lenses, one pass)

Read the diff once and hunt across ALL of these lenses at the same time. Report EVERY issue including uncertain ones (coverage-first; Stage C filters). Each finding needs a concrete failure scenario and a concrete fix.

- **logic**: off-by-one, inverted conditions, wrong operators, null/undefined handling, unhandled empty/extreme inputs
- **state**: race conditions, stale React state/closures, effects with wrong dependencies, shared mutable state, double submission
- **integrity**: swallowed errors, missing failure paths, partial writes, inconsistent persisted state, missing boundary validation
- **cleanup**: duplication, dead code, needless complexity, obvious performance problems, drift from surrounding conventions
- **rules**: read `AGENTS.md` AND every path-scoped rule file under `.claude/rules/` whose scope (listed in the AGENTS.md "Rules" section) matches files in the diff — these are NOT auto-loaded, read them — and review against them. Set `rule` to the violated rule and never dismiss a finding as "pre-existing" when the file is in the diff.

Each finding: `{ file (repo-relative), line (1-indexed), title, description (failure scenario + concrete fix), severity ("critical"|"major"|"minor"), rule? }`.

**Signal-to-noise on benign diffs.** Coverage-first applies fully to correctness lenses (logic/state/integrity) and to rule violations — report every candidate there. But for `cleanup` and process/style observations (naming drift, commit-split hygiene, "could centralize this constant"), calibrate to the diff: when the change is behavior-identical (a pure rename, a constant extraction, a doc reword) and carries no critical/major finding, a minor cleanup/process comment is usually noise, not a defect — a benign refactor should draw few or no findings. Raise such a comment only when it is genuinely actionable and material; otherwise omit it. This does not lower the bar on real bugs or rule breaches (those are always reported); it keeps Stage A from burying a clean refactor in true-but-trivial remarks. (Golden-eval fixtures fx-06/fx-07 measure exactly this over-reporting tendency.)

### Stage B — Dedup

Merge findings anchored to the same (file, line): keep the highest-severity one, fold the others into its description. Sort by severity. Carry the whole deduped list into Stage C — do not drop anything here.

### Stage C — Refute

Take the deduped candidates and try to REFUTE each one by reading the actual code:

- **standard**: one reproduction lens — walk the failure scenario step by step through the real code.
- **high**: three lenses per finding — correctness (is the claimed behavior actually wrong?), reproduction (walk it step by step), scope (does the cited rule/expectation actually apply?) — refute if a majority of lenses refute.

If a finding cites an AGENTS.md rule, read AGENTS.md and respect rule scope qualifiers. Verdict per finding: CONFIRMED (traced the failure/violation in real code), PLAUSIBLE (credible but not fully traced), REFUTED (does not hold). Default to REFUTED when uncertain. You may regrade severity. Never add findings Stage A did not raise.

**You wrote Stage A, so this stage is where the discipline has to come from you.** The separate verifier agent that used to run it could not see the reasoning that produced a candidate; you can, and that downgrade was accepted knowingly. Re-open the code for each candidate rather than trusting what Stage A concluded about it, and put the `file:line` you re-read into `verification` for **every** verdict, refutations included — that is what makes a code-blind judgement visible in your output rather than indistinguishable from a real one.

**For every finding you do not refute, also decide the fix.** The review is one pass: the parent applies what you return and commits, so a finding you leave without a fix is a finding whose remedy nobody judged. Two fields per surviving finding:

- `fix` — the concrete change. Which file, what it should say instead, and why that shape rather than the alternative you considered. Not a restatement of the problem: "validate the size server-side" is not a fix, "add `avatarSizeRejection(file.size)` to `uploadAvatarFn`'s `inputValidator`, sharing `MAX_AVATAR_BYTES` with the client so the two cannot drift" is.
- `acceptance` — how the parent confirms it landed, checkable without re-running this review: a command, or a specific observable in the code.

The fix you sketched in Stage A (inside the candidate's `description`) is input, not the answer — you wrote it before establishing the finding was real. Re-judge it now that you have, adopt it if it holds up, but the `fix` you return here is the authoritative one.

When a finding cannot be fixed without a decision that is not yours to make — an ADR-level choice, a genuine trade-off, a question for the repository owner — put that in `fix` explicitly and say what the options are. Do **not** invent a fix to fill the field; an honest "this needs a decision, here are the two credible options" is the useful answer and tells the parent to ask rather than guess. For such a finding `acceptance` states what the parent will be able to observe once the owner has picked — which file or section will name the chosen option. Never leave it blank, and never assert a false certainty to fill it.

### Stage D — Return

Drop REFUTED findings. Sort survivors by verdict (CONFIRMED first) then severity. Return, as your final message:

```
{ effort, findings: [ { file, line, title, description, severity, verdict, verification, fix, acceptance } ], stats: { candidates, refuted } }
```

Report `stats.candidates` and `stats.refuted` honestly even when every candidate died — a pass that refuted everything is a normal outcome and the numbers are how anyone can tell Stage C ran at all.

Do NOT manually create `.claude/.review-stamp` — a `SubagentStop` hook stamps it when you finish.

**Fail-closed (parent responsibility).** The gate needs two facts. One is deterministic and checked: at `SubagentStop` the hook records every changed path, and `pre-bash-guard.sh` later refuses a commit touching a path that is not on that list. The other is not checked: that the agent finished having reported something — its `SubagentStop` with a non-blank `last_assistant_message`. Consequences the parent must respect:
- **Do not edit files while the dispatch is running.** The stamp is written when the agent finishes, so a path first touched mid-run is recorded as reviewed. This is the hole the mechanism does not close; nothing enforces it. Fix *after* the agent returns — those fixes keep the stamp.
- Your own `Bash` use does not void the pass — only touching a path the review never saw does.
- If the dispatch errors, times out, or returns a malformed/empty report, treat the review as NOT done — the findings are unverified. Do not commit; re-dispatch. A completed-but-degenerate response is not a clean pass, and the blank-report check refuses to stamp one.

## After the review (parent session)

1. Read the surviving findings. Never dismiss a finding as "pre-existing" when the file is in the diff. Apply rules literally; when in doubt, fix.
2. **Apply each finding's `fix` and check its `acceptance`.** The fix was judged by a context that did not write the code; that is the point of it arriving with the finding. Departing from it is allowed — you can see things the agent could not — but then say so and why, in the commit message or to the user. Where `fix` says the finding needs a decision, ask the user rather than picking for them.
3. That is **the end of the review**. Those edits keep the stamp, so commit once every finding is addressed or explicitly justified as out of scope. Running this skill again is a fresh review of a fresh diff, not a follow-up on this one.
