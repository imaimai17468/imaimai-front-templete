---
name: prod-logs
description: "Read the deployed Worker's recent logs with `alchemy logs`, then carry an error found there to a local reproduction under `bun run dev` and a ticket. Use when the user reports an error, a 500, or a broken page on the deployed app, or asks what the production Worker logged."
---

# Production logs

`alchemy logs` without `--tail` is the one command here that reaches the Cloudflare account, and AGENTS.md's Commits & Pull Requests section holds the user's words that allow it. `--tail` and every other `alchemy` command stay the user's, so a step that would need one stops and hands it back.

## Fetch

**Check the login first.** `alchemy logs` signs in with the profile in `~/.alchemy/profiles/<profile>/cloudflare.json`, where `<profile>` is `ALCHEMY_PROFILE` or else `default`, and `~/.alchemy` is `$ALCHEMY_HOME` where that is set (`node_modules/alchemy/src/Auth/Paths.ts`). Run `ls ~/.alchemy/profiles/<profile>/cloudflare.json`. Where the file is missing, report the fetch "not run", name the missing file, and leave `bunx alchemy profile edit --add Cloudflare` to the user, because `profile` is one of the commands that wait for them. The rest of this skill then starts from whatever error text the user can paste.

**Name the production stage.** Without `--stage`, `alchemy logs` reads `$ALCHEMY_STAGE` from the environment, `--env-file` or `.env`, and otherwise `live_$USER` (`resolveStage` in `node_modules/alchemy/src/cli/commands/flags.ts`), and `docs/DEPLOYMENT.md` deploys production with an explicit `--stage <name>`. Take the stage from the user's request or from `ALCHEMY_STAGE`, and where neither names one, ask the user which stage production is, because nothing in the repository records it.

**Fetch a window, not a stream.**

```sh
bunx alchemy logs --stage <stage> --since 1h --limit 200
```

`--since` takes `<number><s|m|h|d>` or an ISO timestamp, and `--limit` defaults to 100. `--resource <logical id>` narrows the output to one resource, and leaving it out reads every resource in the stack, which is what to do until the output shows which logical id the Worker has. The command loads `alchemy.run.ts` and reads the deployed resources from the state store in the account. Where the account's state store is missing or older than this Alchemy version, the command fails with a line ending `without an interactive terminal`, because a Bash call has no TTY and the CLI then refuses every prompt (`node_modules/alchemy/src/Cli/CliKit/layer.ts`). Report the fetch "not run" and leave deploying or upgrading the store to the user, because in a terminal that prompt's default answer deploys a Worker to the account. Without `--resource` it prints `No resources with logs found. Deploy first, then run logs.` whenever the window returns no entry (with `--resource` the line starts `No resources with logs match --resource`), which a quiet hour and a stage that was never deployed both produce, so widen `--since` once, and where that also returns nothing, check the stage name with the user.

How an uncaught exception or an invocation log reads in this output has not been observed on this repository's Worker. Read the entries for a stack trace, a `console.error` line, or a response status of 500 or above, and note each one's timestamp, path, and message.

**Keep personal data out of what you write down.** An entry is the event's message field alone (`parseEvents` in `node_modules/alchemy/src/Cloudflare/Logs.ts`), and whether Cloudflare's invocation message holds headers or a `Cookie` has not been checked on this Worker. Copy the method, path, status, error message, and stack frames into the ticket and the PR, and leave out headers, query values, email addresses, user ids, and tokens wherever they appear.

## Reproduce

Start `bun run dev` and send the request the log names to the URL it prints, with `curl` for an API route and the browser tools AGENTS.md's Workflow section names for a page. A reproduction is the same error message or the same stack frame under `bun run dev`'s terminal, where the Worker's `console.error` lands locally.

Where it does not reproduce, write down what differs between the deployed Worker and `alchemy dev`: a secret's value, a row only the remote D1 holds, a compatibility date, or a request header Cloudflare adds. No command this skill may run reads the remote D1, so a failure that needs production data to reproduce goes back to them with the log entry and that difference, rather than a guessed fix.

## Hand off

A reproduced error becomes a ticket under `ticket-work`. The log entry, trimmed as above, is step 1's evidence, and a test that fails on the reproduced input before the fix is step 3's acceptance. The PR body names the stage and the `--since` window the entry came from, so the reviewer can tell which deploy it was read on.
