---
name: prod-logs
description: "Carry an error from the deployed Worker's logs, which the user fetches with `void project logs`, to a local reproduction under `bun run dev` and a ticket. Use when the user reports an error, a 500, or a broken page on the deployed app, or asks what the production Worker logged."
---

# Production logs

Every `void` command that reaches the deployed Worker waits for the user, as AGENTS.md's Commits & Pull Requests section says, so the model fetches no log itself and reports the fetch "not run".

## Fetch

**Hand the command to the user.** Give them this one, run from the repository root on a machine signed in with `void auth login`:

```sh
bunx void project logs --level error
```

What it returns depends on where `void deploy` sent the app (`node_modules/void/docs/reference/cli/project.md`). A Void platform keeps history, and `--range <number><m|h|d>` (up to `7d`, default `1h`) picks the window. A direct Cloudflare deploy opens a live tail of the Worker named in `void.config.ts` and keeps no history, so the user leaves it running while they repeat the failing request. `--filter <text>` narrows either one to entries whose message or exception holds the text.

Each request prints as `HH:MM:SS METHOD URL STATUS`, with its `console.*` lines and exceptions indented beneath. Read what the user pastes for a stack trace, a `console.error` line, or a status of 500 or above, and note each one's time, path, and message.

**Keep personal data out of what you write down.** Copy the method, path, status, error message, and stack frames into the ticket and the PR, and leave out headers, query values, email addresses, user ids, and tokens wherever they appear.

## Reproduce

Start `bun run dev` and send the request the log names to the URL it prints, with `curl` for an API route and the browser tools AGENTS.md's Workflow section names for a page. A reproduction is the same error message or the same stack frame under `bun run dev`'s terminal, where the Worker's `console.error` lands locally.

Where it does not reproduce, write down what differs between the deployed Worker and `bun run dev`: a secret's value, a row only the remote D1 holds, a compatibility date, or a request header Cloudflare adds. No command the model may run reads the remote D1, so a failure that needs production data to reproduce goes back to the user with the log entry and that difference, rather than a guessed fix.

## Hand off

A reproduced error becomes a ticket under `ticket-work`. The log entry, trimmed as above, is step 1's evidence, and a test that fails on the reproduced input before the fix is step 3's acceptance. The PR body names the time the entry was logged, so the reviewer can tell which deploy it was read on.
