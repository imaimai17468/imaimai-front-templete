---
name: empirical-prompt-tuning
description: A method for improving an agent-facing text instruction (a skill, a slash command, a task prompt, a CLAUDE.md section, a code-generation prompt) by having a fresh executor run it, evaluating both sides (the executor's self-report plus the caller's metrics), and iterating until the gains plateau. Use right after creating or heavily revising a prompt or skill, or when an agent does not behave as expected and you want to look for the cause in the instruction's ambiguity.
---

# Empirical Prompt Tuning

A prompt's quality is not visible to the person who wrote it. What the writer reads as clear is where another agent gets stuck. **Have a fresh executor run it, evaluate both sides, and iterate** is the core of this skill. Do not stop before the gains plateau.

## When to use

- Right after creating or heavily revising a skill, a slash command, or a task prompt
- When an agent does not behave as expected and you want to look for the cause in the instruction's ambiguity
- When hardening a high-stakes instruction (a skill used often, a prompt at the center of an automation)

When not to use:
- A one-off throwaway prompt (the evaluation costs more than it returns)
- When the aim is the writer's own taste rather than a higher success rate

## Workflow

0. **Iteration 0: check that the description and the body agree** (static, no dispatch)
   - Read the trigger and the purpose the frontmatter `description` claims
   - Read what the body covers
   - Where the two diverge, align the description or the body before going on to iter 1
   - Example: the description says "navigation / form filling / data extraction" while the body holds only a CLI reference for `npx playwright test`
   - Skip this and the subagent reinterprets the body to match the description, so the accuracy comes out high while the skill does not meet the requirement (a false positive)

1. **Baseline**: fix the target prompt and prepare two things.
   - **Evaluation scenarios**, 2 to 3 (1 typical + 1 to 2 edge). Tasks that can happen in practice, where the target prompt actually applies.
   - **Requirement checklist** (to compute accuracy). For each scenario, list 3 to 7 items the deliverable must satisfy. accuracy % = items met / all items. Fix it in advance and do not move it afterwards.
2. **Bias-free read**: have a "blank slate" executor read the instruction. **Dispatch a fresh subagent** with the Agent tool. Do not settle for re-reading it yourself (judging text you wrote a moment ago from the outside is structurally impossible). To run several scenarios in parallel, put several Agent calls in one message. For an environment where dispatch is not possible, see the "Environment constraints" section.
3. **Run**: hand the subagent a prompt that follows the **subagent launch contract** below and have it run the scenario. The executor produces the implementation or output and returns a self-report at the end.
4. **Two-sided evaluation**: record the following from what comes back.
   - **The executor's self-report** (extracted from the body of the subagent's report): ambiguities / discretionary fill-ins / where applying the template got stuck
   - **The caller's measurements** (the judging rules are defined in this section alone, and every other place points here):
     - Success/failure: success (○) only when the requirements tagged `[critical]` are **all ○**. One × or partial among them is a failure (×). The label is the two values ○ / × alone.
     - Accuracy (% of the requirement checklist met. ○ = full, × = 0, partial = 0.5, summed and divided by all items)
     - Step count (`tool_uses` from the usage meta on the Agent tool's return value, as it stands. Read / Grep included, not excluded)
     - Duration (`duration_ms` from the Agent tool's usage meta)
     - Retries (how many times the subagent redid the same decision. Extracted from the subagent's self-report; the caller cannot measure it)
     - **On a failure, add one line naming which [critical] item fell to the "Ambiguities" section of the reporting format** (to trace the cause)
   - The requirement checklist holds **at least one** `[critical]` item (with zero, the success judgment is vacuous). Do not add or remove [critical] after the fact.
5. **Apply the diff**: put the smallest fix that closes the ambiguity into the prompt. One theme per iteration (several related fixes are fine, an unrelated fix waits for the next one). Mixing themes loses which fix worked.
   - **Before the fix, state which requirement-checklist item or which criterion wording it satisfies** (a fix guessed from an axis name often fails to land, see the "How a fix lands" section below).
6. **Re-evaluate**: run 2 through 5 again with a new subagent (never reuse the same agent: it has learned the previous fixes). Raise the parallelism where the gains keep coming as the iterations go on.
7. **Convergence check**: stop once the convergence condition in "Stopping the iteration" is met.

## Evaluation axes

| Axis | What it means |
|---|---|
| Success/failure | the floor |
| Accuracy | how far a partial success got |
| Step count | how much the instruction wastes |
| Duration | a proxy for cognitive load |
| Retries | a signal of ambiguity in the instruction |
| Ambiguities (self-reported) | qualitative material for the fix |
| Discretionary fill-ins (self-reported) | surfaces the implicit spec |

How each axis is taken is defined in the "Workflow 4. Two-sided evaluation" section alone.

**Weighting**: qualitative (ambiguities, discretionary fill-ins) is primary, quantitative (duration, step count) is secondary. Chasing the shorter time alone thins the prompt out.

### Reading `tool_uses` qualitatively

Accuracy alone hides the skill's problem. Used as a **relative value between scenarios**, `tool_uses` shows a structural defect:

- Where one scenario runs **3-5x or more** than the others, that skill is **closer to a decision-tree index and low on self-containment**. The executor is forced into a references descent
- Typical case: every scenario at 1-3 `tool_uses` and one scenario at 15+ → the skill holds no recipe for that scenario and the executor is searching across references/
- Fix: in iter 2, adding "a minimal complete example inline" or "when to read references" at the top of SKILL.md drops `tool_uses` sharply

A skew in `tool_uses` is a reason to run iter 2 even at 100% accuracy. Stopping on accuracy alone tends to miss a structural defect.

### How a fix lands (conservative / over / zero)

A fix and its effect are not linear. An estimate made in advance lands in one of 3 patterns:

- **Conservative** (estimate > measured): one fix aimed at several axes and moved one of them. "Aiming at several axes tends to miss"
- **Over** (estimate < measured): one structural piece of information (a command plus its config plus the expected output, say) satisfied the criterion wording of several axes at once. "A combination of information hits several axes structurally"
- **Zero** (estimate > 0, measured = 0): a fix guessed from an axis name reached none of the criterion wordings. "An axis name and a criterion wording are different things"

To stabilize this, **have the subagent put into words which criterion wording the fix satisfies before the diff is applied**. Without tying it at the threshold-wording level, the estimate is not accurate. When adding an evaluation axis, spell each point's criterion out to the threshold wording as well ("everything stated", "a working minimal configuration in full": the granularity at which the subagent can judge what earns 2 points).

## Subagent launch contract

The prompt handed to the executor takes the structure below. This is the input contract for the two-sided evaluation.

```
You are an executor reading <name of the target prompt> with no prior context.

## Target prompt
<paste the full text of the target prompt, or give a path to read it from. An AGENTS.md / rule / skill edited in this same session sits in the subagent's context at its session-start version, so when giving a path, write "open it with Read first and take that text alone as the instruction">

## Scenario
<one paragraph setting up the scenario>

## Requirement checklist (what the deliverable must satisfy)
1. [critical] <item that belongs to the floor>
2. <normal item>
3. <normal item>
...
(The judging rules are defined in the "Workflow 4. Two-sided evaluation / The caller's measurements" section alone. At least one [critical] is required.)

## Task
1. Follow the target prompt to run the scenario and produce the deliverable.
2. Reply in the report structure below when you finish.

## Report structure
- Deliverable: <the artifact, or a summary of the run>
- Requirements met: ○ / × / partial for each item, with the reason
- Ambiguities: where the target prompt got you stuck, wording you hesitated over (bullets)
- Discretionary fill-ins: what you filled in on your own judgment because the instruction did not decide it (bullets)
- Retries: how many times you redid the same decision, and why
```

The caller extracts the self-reported part from the report, takes `tool_uses` / `duration_ms` from the Agent tool's usage meta, and fills in the evaluation-axis table.

## Environment constraints

Where a fresh subagent cannot be dispatched (already running as a subagent, the Agent tool disabled), this skill **does not apply**.
- Alternative 1: ask the parent session's user to start another Claude Code session and run it there
- Alternative 2: give up the evaluation and report "empirical evaluation skipped: dispatch unavailable" to the user

**Structural review mode**: to check only the **consistency and clarity of the text** of a skill or a prompt instead of running an empirical evaluation, mark the run off as structural review mode. Write "structural review mode this time: a text-consistency check rather than a run" in the request prompt to the subagent. The subagent then returns a static review instead of hitting the skip in the Environment constraints section. Structural review supports the empirical evaluation and cannot count toward the consecutive-clear judgment.

## Stopping the iteration

- **Convergence (stop)**: one clear on its own can happen by chance, so stop once 2 consecutive iterations (3 for a high-stakes prompt) satisfy **all** of:
  - New ambiguities: 0
  - Accuracy gain over the previous iteration: +3 points or less (a saturation such as 5% → 8%)
  - Step count change over the previous iteration: within ±10%
  - Duration change over the previous iteration: within ±15%
  - **Overfitting check**: at the convergence check, add one hold-out scenario not used so far and evaluate it. Accuracy falling 15 points or more below the recent average is overfitting. Go back to the baseline scenario design and add an edge.
- **Divergence (suspect the design)**: new ambiguities that do not fall after 3 or more iterations → the prompt's design may itself be wrong. Stop repairing it with patches and rewrite the structure
- **Resource stop**: stop once the importance no longer matches the cost of improving (the call to ship at 80 points)

## Reporting format

Record each iteration in the form below and present it to the user:

```
## Iteration N

### Changes (diff from the previous iteration)
- <the fix in one line>

### Results (by scenario)
| Scenario | Success/failure | Accuracy | steps | duration | retries |
|---|---|---|---|---|---|
| A | ○ | 90% | 4 | 20s | 0 |
| B | × | 60% | 9 | 41s | 2 |

### Ambiguities (new this time)
- <scenario B>: [critical] item N is ×: <why it fell, one line>   # always added on a failure
- <scenario B>: <other finding, one line>
- <scenario A>: (none new)

### Discretionary fill-ins (new this time)
- <scenario B>: <what was filled in>

### Next fix
- <the smallest fix, one line>

(Convergence: X consecutive clears / Y more to the stop condition)
```

## Red flags (rationalizations to watch)

| The rationalization that comes up | The reality |
|---|---|
| "One scenario is enough" | One scenario overfits. 2 at minimum, 3 where possible. |
| "The scenario is too hard, let's loosen it" | Loosening only makes the ambiguities look gone, and the instruction is unchanged. Keep the scenario fixed and fix the instruction. |
| "The metrics are good, so ignore the qualitative feedback" | A shorter time is also a sign of thinning out. Qualitative is primary. |
| "Rewriting is faster" | Right once ambiguities have not fallen for 3 iterations. Before that stage it is an escape. |
