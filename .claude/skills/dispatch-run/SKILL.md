---
name: dispatch-run
description: The two standing parts of a dispatch run: the brief every worker follows to carry its ticket to a merged pull request, and what the dispatching session does while they work (watch the run's pull requests with `scripts/orchestrate.ts watch-prs`, act on the line the watch exits with, clean the run's worktrees once every pull request is closed). A dispatching session names this skill in each worker prompt and invokes it itself right after dispatching one worker per ticket; a worker invokes it when its prompt names it.
---

# Dispatch run

A dispatch names this skill, which hands the worker the Worker brief, so the prompt carries what belongs to its ticket alone: the change and why it is wanted, the files the ticket owns and the region of a file another ticket also edits, the branch name, and the user's own words wherever an action needs them (AGENTS.md's Degraded Environments says which actions those are).

## Worker brief

In a fresh worktree, run `bun run setup` first. Create the ticket's branch, and push it with `-u`.

Hold the pull request as AGENTS.md's *A PR's author holds it until it merges* bullet says, from the Draft opened after the first commit through `gh pr merge --squash` and the deletion of the remote branch, waiting for the check in the foreground. Three concretes that bullet leaves open:

- Poll the CI check with `until gh pr checks <number> --json name,bucket --jq '.[] | select(.name=="build") | .bucket' | grep -qx pass; do sleep 30; done`. `--json` prints each object's fields in alphabetical order, `{"bucket":"pass","name":"build"}`, so a grep for `"name":"build","bucket":"pass"` matches nothing. The same test written as `[ "$(gh pr checks …)" = pass ]` was refused by the pre-Bash guard as a construct it could not check against a worktree-isolated agent's git.
- On #122 the only other check was `cubic · AI code reviewer`, which reported at 5m44s against `build`'s 37s, so the loop tests `build` alone.
- `gh pr update-branch` merges the base branch into the remote branch, which leaves the local branch behind it, so run `git pull` before committing there again.

Name every scratch file after the ticket, `<branch>-pr-body.md` rather than `pr-body.md`. The workers of one run share one scratchpad directory, so a second worker writing the plain name overwrites the first worker's file.

## Watching the run

Watch the run with `bun scripts/orchestrate.ts watch-prs <branch>...` naming the branches you assigned at dispatch, as a Bash call with `run_in_background`, so a message from the user reaches the session while it waits. The watch resolves each branch's pull request once a minute and exits with one line: `conflict <branch>...` when an open pull request of the run turns CONFLICTING, `all-closed` once every named branch has a pull request that is no longer open, and `gh-failed <message>` when `gh` itself failed, in which case fix what the message names and start the watch again. A branch whose worker has not opened a pull request holds the watch as an open one does, so when a worker's `Agent` result arrives without one, start the watch again over the branches that remain.

Its exit re-invokes the session, and the line is in the task's output file. The watch reports the state it finds each time it runs, so start it again when that file holds no line. `run_in_background` belongs to this session alone.

On `conflict`, dispatch one worker per named branch with `isolation: worktree` that removes the worktree still holding that branch (`git worktree remove`, which refuses an unclean worktree unless `--force` is used, so leave that one in place and report it rather than forcing it), fetches and checks the branch out in its own worktree, resolves it as AGENTS.md's *Resolve a conflict by rebasing onto main* bullet says, and holds that branch's pull request from there as its author; then start the watch again without that branch, and name it again once that worker's `Agent` result arrives, because GitHub reports the pull request as CONFLICTING until the worker pushes and the watch would hand you the same branch a second time. Merging stays with each PR's author. On `all-closed`, run `bun scripts/orchestrate.ts clean-worktrees <branch>...` over every branch you assigned at dispatch, including any the watch stopped naming, because a branch the run does not name is kept untouched.
