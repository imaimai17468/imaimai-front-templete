---
name: dispatch-run
description: "The brief a dispatched worker follows to carry one ticket to a merged pull request, and what the dispatching session does around it: choosing each worker's model and effort, watching the pull requests, dispatching conflict fixes, and cleaning the run's worktrees. A dispatching session names this skill in each worker prompt and invokes it itself right after dispatching; a worker invokes it when its prompt names it."
---

# Dispatch run

A dispatch names this skill, which hands the worker the Worker brief, so the prompt carries what belongs to its ticket alone: the change and why it is wanted, the files the ticket owns and the region of a file another ticket also edits, the branch name, and the user's own words wherever an action needs them (AGENTS.md's Degraded Environments says which actions those are). `prose.md`'s Instruction documents rule holds for the prompt as for any other text. A premise the session cannot check reaches the worker as the question it is, because a worker builds on what its prompt states and can carry a false premise into a pull request body as a claim.

## Choosing model and effort

Every `Agent` call that dispatches a worker names `model` and `effort`, a conflict-fix worker's and the `code-reviewer`'s included. Where the call omits `model`, the worker runs on the agent definition's model, the configured default subagent model, or else the dispatching session's own, and an omitted `effort` leaves a level no file here states. The `Agent` tool's description asks the caller to set `effort` only where a skill asks for a level, and this section is that request. A `subagent_type: "fork"` ignores both, so a worker is never a fork.

[CursorBench](https://cursor.com/cursorbench) 4.1 (updated 2026-11-18) scores models on ambiguous multi-file tasks taken from real Cursor sessions, and prices each task at the model's published per-token API rates. Its Claude rows, as score / cost per task:

| Model | low | medium | high | xhigh | max |
|---|---|---|---|---|---|
| Fable 5.2 | 53.4% / $4.26 | 54.2% / $5.01 | 56.5% / $10.51 | **58.8% / $17.84** | **61.3% / $48.11** |
| Opus 5.5 | 42.7% / $1.43 | **50.0% / $2.85** | **54.5% / $3.87** | **56.7% / $6.54** | **58.1% / $11.88** |
| Sonnet 5.5 | 31.8% / $0.44 | 34.3% / $0.63 | 43.8% / $1.41 | 49.9% / $3.13 | 54.4% / $8.63 |
| Haiku 5.5 | **27.8% / $0.08** | **34.2% / $0.17** | **37.5% / $0.31** | **45.2% / $0.56** | **48.4% / $1.14** |

A bold cell is on the cost frontier: no cheaper cell scores higher. Sonnet has no cell on it, because a cheaper Haiku or Opus cell beats each of its levels (Haiku xhigh beats Sonnet high, Opus medium beats Sonnet xhigh, Opus high beats Sonnet max). Opus's curve bends at high: medium to high adds 4.5 points for $1.02 a task, and high to xhigh adds 2.2 points for $2.67. Fable pays only above Opus max's 58.1%, and Haiku's cells all score below Opus medium's 50.0%.

CursorBench's tasks are less specified than a ticket here, so a lower level may score better on a ticket whose specification is written out than its row says. Its cost is API dollars, while this account signs in through claude.ai and spends a five-hour usage window, which only `ticket-costs` below measures.

Name the row the ticket matches, and where it matches more than one, the higher effort:

| Ticket | `model` | `effort` |
|---|---|---|
| `kind: judgment`, whose work is finding what no command can check (open design, acceptance no command decides), a conflict-fix worker whose conflict is not textual included | `opus` | `high` |
| `kind: gate` whose specification is not written out | `opus` | `high` |
| Anything touching permissions, auth, hooks or `permissions.deny` rules | `opus` | `high` |
| Writing instruction documents (`.claude/`, `AGENTS.md`, `CLAUDE.md`) | `opus` | `high` |
| `kind: gate`, whose acceptance is a command's exit code, with the specification written out, a conflict-fix worker whose conflict is textual included | `opus` | `medium` |
| The `code-reviewer` dispatch | `opus` | `high` |

`record-dispatch` takes the ticket's kind, `gate` or `judgment`, whichever row decided its model and effort.

Name `xhigh`, `max`, `fable` or `sonnet` only where the comparison under *Revisit the table* has shown a gain on that kind of ticket, or as a trial that gathers that comparison. Raising effort tends to catch more missed edge cases but "does not fix when the model has the wrong approach" ([Spending your effort](https://claude.dev/blog/spending-your-effort/)). A worker that took the wrong approach is missing the problem setup a user would have supplied, so write that setup into its prompt instead of raising the level: by `SendMessage` while its pull request is open, and as a new ticket once that pull request has merged.

**Revisit the table.** The `gate` and `judgment` rows are revisited from the cost log, and the rows for permissions, instruction documents and the review stay at `opus` `high`.

1. Run `bun .claude/skills/dispatch-run/scripts/orchestrate.ts ticket-costs`, which prints one line per model, effort and kind.
2. Take two lines of one kind, the one the table names and a trial line, each showing `tickets 5` or more. Compare their five-hour percentage only where both show `over 3 solo` or more, because the percentage of a ticket that overlapped another is unknown.
3. List each line's branches from the `dispatch` events in `.claude/ticket-costs.jsonl` in the main checkout. For each branch, count the review findings its pull request answered: the commits that answer a finding, plus each finding written into the PR body for a decision.
4. Move the kind to the trial line where it spends the lower median five-hour percentage (or, where step 2 left that unknown, sits on a cheaper CursorBench cell) and its median minutes and findings per ticket are no worse, or where it costs more but its median findings per ticket are lower. Say in the pull request which lines and medians decided it.

To trial a line for a kind, dispatch that kind's next tickets on it until the line meets step 2's threshold.

## Bounding the dispatch

`ticket-work`'s *Tickets and waves* sets the three bounds each dispatch keeps: free memory, the five-hour window, and three workers in flight. A worker peaks near 4 GB on this template (a Claude Code session, `bun run check` and a dev server together), and memory binds before cores do. A worker that finishes frees its share, which is why `free-gib` runs again before the next dispatch.

The GiB number says nothing about tokens. The account signs in through claude.ai (`claude auth status` prints `authMethod: claude.ai`), whose five-hour and seven-day windows accumulate what every session and worker on the account spent, so a run is cut off by what ran before it as much as by what it dispatches. `remaining-budget` prints what each window has spent and when it resets, or a line opening `unknown` and the reason where it cannot read a current window from `~/.claude/rate-limits.json`. The 80% hold is a choice, because nothing yet ties a window's percentage to what one ticket spends; the log below measures that tie.

Runs with five workers in flight have hit the account's limit where runs with two or three did not, which is why the cap is three. Three in flight does not keep the five-hour window under the hold on its own, so read `remaining-budget` before every dispatch. A limit hit kills every worker in flight mid-ticket. Resume each one from its transcript with `SendMessage` after the reset.

**Log what each ticket spends.**

1. Right before each `Agent` call that dispatches a worker, a conflict-fix worker included, run `bun .claude/skills/dispatch-run/scripts/orchestrate.ts record-dispatch <branch> <model> <effort> <kind>` with the model and effort the call names, and `gate` or `judgment` as the table above defines them.
2. When that worker's first completion notice arrives, run `bun .claude/skills/dispatch-run/scripts/orchestrate.ts record-done <branch> <subagent_tokens> <tool_uses> <duration_ms>` with the three numbers its `<usage>` block prints.
3. A worker resumed with `SendMessage` is not dispatched again, and the notice its resume ends with gets no `record-done`, because `ticket-costs` pairs each dispatch with one completion and drops a second.

Both commands also store the five-hour window from the file `remaining-budget` reads, and append to `.claude/ticket-costs.jsonl` in the main checkout, which `.gitignore` keeps out of the repository because the percentages belong to the account that ran the tickets. `ticket-costs` prints, per model, effort and kind, the median `subagent_tokens` and minutes, and the median five-hour percentage of the tickets that no other recorded dispatch overlapped and whose window did not reset in between. A dispatch with no completion counts as in flight until its branch is dispatched again, or else until its window resets. No file here says what `subagent_tokens` counts, and it grows far more slowly than a worker's turns do, so the five-hour percentage is the measure of what a ticket spent. That percentage also holds what every other session on the account spent over the same span, the dispatching session among them. Until it rests on several solo runs, the 80% hold stands.

## Worker brief

AGENTS.md's Workflow section decides whether the ticket invokes `ticket-work`. A docs-only ticket does not, and takes this brief with the two `ticket-work` paragraphs it points at below.

1. In a fresh worktree, run the setup `ticket-work`'s opening paragraph names before anything else.
2. Create the ticket's branch, and push it with `-u`.
3. Hold the pull request as `ticket-work` step 7 says, from the Draft opened after the first commit through `gh pr merge --squash <number>` and the deletion of the remote branch. Write that step's poll as it stands, because a `$(...)` form of it has been refused in a worktree-isolated session, as `ticket-work`'s opening paragraph says.

While a subagent runs, waiting means ending the turn, because the `Agent` tool notifies you when one completes. Do not run a shell that sleeps to pass the time: it buys nothing, and killing it can stop a background task started alongside it. A wait on a condition nothing will make true never returns. Ending the turn waits only while something that will wake you is running, so where nothing is in flight and you still need a result, dispatch it again rather than end, as `ticket-work` step 7 says. The pull-request poll of that same step is the exception, because `gh pr checks` is not a subagent and nothing wakes you when `build` turns green.

Name every scratch file after the ticket, `<branch>-pr-body.md` rather than `pr-body.md`. The workers of one run share one scratchpad directory, so a second worker writing the plain name overwrites the first worker's file.

## Watching the run

While its workers are in flight, the dispatching session keeps to `Agent` and the `allow` list in `.claude/settings.json`, because a file edit in the main worktree races the worktrees its workers are editing. A pull request whose author was refused at the merge step is merged from the dispatching session rather than by a worker dispatched for that purpose. Ad-hoc `git`, `gh`, and file edits belong to workers, including the worker dispatched to resolve a conflict. Once the wave's workers have finished, the session takes its next wave like any other, which for a wave of one means doing the ticket itself.

Watch the run with `bun .claude/skills/dispatch-run/scripts/orchestrate.ts watch-prs <branch>...` naming the branches you assigned at dispatch, as a Bash call with `run_in_background` and `timeout: 7200000`, the most a background command is allowed, so a message from the user reaches the session while it waits. The watch resolves each branch's pull request once a minute and exits with one line:

- `conflict <branch>...` when an open pull request of the run turns CONFLICTING
- `all-closed` once every named branch has a pull request that is no longer open
- `stalled <branch>...` when a branch still waiting has shown the same pull request head and state, or no pull request, for an hour
- `gh-failed <message>` when `gh` itself failed, in which case fix what the message names and start the watch again

A branch whose worker has not opened a pull request holds the watch as an open one does, so when a worker's `Agent` result arrives without one, start the watch again over the branches that remain.

Its exit re-invokes the session, and the line is in the task's output file. The watch reports the state it finds each time it runs, so start it again when that file holds no line. A watch the timeout stopped also leaves the file without a line. `run_in_background` belongs to this session alone.

**On `conflict`**, dispatch one worker per named branch with `isolation: worktree`, on the row of the table above that the conflict matches. It removes the worktree still holding that branch (`git worktree remove`, which refuses an unclean worktree unless `--force` is used, so it leaves that one in place and reports it rather than forcing it), fetches and checks the branch out in its own worktree, resolves it as `ticket-work`'s *Resolve a conflict by rebasing onto main* paragraph says, and holds that branch's pull request from there as its author. Merging stays with each PR's author. Once each named branch has its worker, start the watch again without those branches, and name each again once its worker's `Agent` result arrives, because GitHub reports the pull request as CONFLICTING until the worker pushes and the watch would hand you the same branch a second time.

**On `stalled`**, look up each named branch's worker:

- Where its `Agent` result has not arrived, the worker is still at work.
- Where it has arrived and the branch has an open pull request, the worker stopped short of merging, so resume it with `SendMessage` to carry that pull request to a merge as the Worker brief says.
- Where it has arrived and the branch has no pull request, drop the branch as for an `Agent` result without one.

Then start the watch again over every branch still waiting, the stalled ones you kept included, which counts each one's hour from zero.

**On `all-closed`**, run `bun .claude/skills/dispatch-run/scripts/orchestrate.ts clean-worktrees <branch>...` over every branch you assigned at dispatch, including any the watch stopped naming, because a branch the run does not name is kept untouched.
