---
name: dispatch-run
description: What a dispatching session does while its workers run: watch the run's pull requests with `scripts/orchestrate.ts watch-prs`, act on the line the watch exits with, and clean the run's worktrees once every pull request is closed. Invoke right after dispatching one worker per ticket.
---

# Dispatch run

Watch the run with `bun scripts/orchestrate.ts watch-prs <branch>...` naming the branches you assigned at dispatch, as a Bash call with `run_in_background`, so a message from the user reaches the session while it waits. The watch resolves each branch's pull request once a minute and exits with one line: `conflict <branch>...` when an open pull request of the run turns CONFLICTING, `all-closed` once every named branch has a pull request that is no longer open, and `gh-failed <message>` when `gh` itself failed, in which case fix what the message names and start the watch again. A branch whose worker has not opened a pull request holds the watch as an open one does, so when a worker's `Agent` result arrives without one, start the watch again over the branches that remain.

Its exit re-invokes the session, and the line is in the task's output file. The watch reports the state it finds each time it runs, so start it again when that file holds no line. `run_in_background` belongs to this session alone. A PR's own author waits in the foreground.

On `conflict`, dispatch one worker per named branch with `isolation: worktree` that removes the worktree still holding that branch (`git worktree remove`, which refuses an unclean worktree unless `--force` is used, so leave that one in place and report it rather than forcing it), fetches and checks the branch out in its own worktree, resolves it as AGENTS.md's *Resolve a conflict by rebasing onto main* bullet says, and holds that branch's pull request from there as its author; then start the watch again without that branch, and name it again once that worker's `Agent` result arrives, because GitHub reports the pull request as CONFLICTING until the worker pushes and the watch would hand you the same branch a second time. Merging stays with each PR's author. On `all-closed`, run `bun scripts/orchestrate.ts clean-worktrees <branch>...` over every branch you assigned at dispatch, including any the watch stopped naming, because a branch the run does not name is kept untouched.
