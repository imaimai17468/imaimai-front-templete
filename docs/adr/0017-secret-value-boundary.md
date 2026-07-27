# 0017. The boundary is the secret's value, not access to the file holding it

- Status: accepted
- Date: 2026-07-25

## Context

[ADR-0004](0004-permission-deny-as-security-boundary.md) made `permissions.deny`
the security boundary, and [ADR-0013](0013-deterministic-enforcement-gates.md)
added a `PreToolUse(Bash)` guard for the case prefix matching cannot express
("any command touching a file"). ADR-0004's 2026-07-25 amendment then narrowed
the `allow` list after finding that allow-listed readers walked around the deny
entries — and closed by *accepting* the remaining porosity: `cat .*`,
`grep -r . .` and similar still reach protected files without naming them, and
blocking those spellings was judged a poor trade because it misfires on ordinary
work while costing an attacker one more spelling.

That acceptance did not survive the day it was written. It also understated one
path: `cp`/`mv` sit in `ask`, and `ask` collapses into effective `allow` under
`acceptEdits` / `bypassPermissions` / auto mode — ADR-0004's own founding
argument, applied to itself.

Three subagents reached the protected files during a single audit session. All
three had been briefed in writing never to read them:

1. One built quote-split spellings (`c''at`) to defeat the lexical match.
2. One copied a protected file elsewhere with `cp` and read the copy.
3. One ran a repo-wide `grep -rn <name> .` while tracing where a variable was
   consumed. The protected file matched and its contents entered that agent's
   context; it self-reported, judging the value to look real. The owner
   confirmed it was a development placeholder, so nothing needed rotating — but
   that outcome came from what the file happened to hold, not from any control.

The harness flagged the first two. The third is decisive: it was not a
circumvention at all, but a correct, unremarkable command any contributor would
run. No regex tightening survives that case without breaking the work itself.

That also yields a rule worth stating plainly, because it generalises past this
project: **an instruction is not a control.** Telling an agent — in a briefing,
a skill, or a rule file — not to touch something constrains nothing. Only the
deny list and the hooks constrain, and both operate on spellings.

## Decision

Production secrets are never present in the working tree, so that reading one is
not a capability worth having.

- Real values live only in `wrangler secret put` (see `docs/DEPLOYMENT.md`).
  They are never written to a file, not even temporarily.
- Local env files carry development placeholders only. `.env.local.example` is
  the canonical list of *names*; a working copy holds dummy *values*.
- ADR-0004's `Read`/`Edit` deny entries and ADR-0013's guard hook stay, as
  defense-in-depth against accidental exposure. They raise the cost of a mistake
  and keep routine agent work from casually printing these files. They are not
  treated as a barrier against a determined path.
- Anything that would require a real secret on disk — a production-credentialed
  local run, a migration against a live database with its token in a file — is
  out of scope for an agent-driven session. Do it outside one.

**One standing exception: the drizzle-kit token.** `drizzle.config.ts` reads
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and
`CLOUDFLARE_D1_DATABASE_ID` from the local env file for drizzle-kit's `d1-http`
driver, which backs `db:push` / `db:generate` / `db:pull` / `db:studio`. That is
a real credential on disk, and the driver speaks HTTP with no access to
wrangler's authenticated session, so this decision cannot simply be asserted
over it. Conditions:

- The token carries **D1 edit only**. `docs/DATABASE_SETUP.md` used to walk the
  reader through granting Workers R2 Storage edit as well; nothing in the repo
  consumes that permission (the bucket and its public URL are dashboard
  configuration), so that instruction was narrowed alongside this ADR. The
  mitigation *is* the scope, so the scope has to be real rather than asserted.
- The four scripts are never unattended: `db:push` and `db:generate` have
  explicit `ask` entries; `db:pull` / `db:studio` reach `ask` through the default
  fallthrough for unlisted `bun run` targets. Gating the `bun run` wrapper is not
  enough on its own — `Bash(drizzle-kit generate:*)` was allow-listed, so the
  underlying binary ran unconfirmed and made this condition false for the
  equivalent command. It is in `ask` now. The general rule from ADR-0004's
  amendment applies: an entry that reaches the same capability by another
  spelling voids the gate on the first one.
- Its presence is temporary — remove or rotate the token when the remote-schema
  work is done, rather than leaving it in place between tasks.
- Closing the exception means not needing a static token. Direction, not a
  settled answer: `d1-http` takes an explicit token with no known path to
  wrangler's session, so closing this likely means driving remote schema changes
  through a wrangler-authenticated path instead of drizzle-kit, or wrapping it.
  Acceptance test either way: the remote path works with the token slot empty.

## Alternatives considered

- **Keep ADR-0004's acceptance as written**: rejected — it was a prediction about
  attacker cost, and three incidents in one session falsified it. Leaving it
  would document a boundary the project does not actually have.
- **Extend the guard to block dotfile globs and recursive reads**: rejected. The
  third incident was `grep -rn`, which is ordinary work; a pattern broad enough
  to catch it breaks everyday searching, and a narrower one is defeated by the
  next spelling.
- **Scan command output for secret-shaped strings** (`PostToolUse(Bash)`):
  rejected in ADR-0004's amendment and still rejected — lexical in the same way,
  and it fires after the value is already in the transcript. Detection, not
  prevention.
- **Move `cp`/`mv` to `deny`**: rejected — they are needed for ordinary file
  work, and `deny` on them would not stop directory-level or archive-based
  reads. The same spelling problem one level out.

## Consequences

- The failure mode this accepts is narrow: an agent session can read development
  placeholders, and — until the exception closes — a least-privilege D1 token
  while remote schema work is in flight.
- The failure mode it removes is the one that matters: an application secret
  whose leak cannot be undone by tightening a regex afterwards.
- Nothing here is mechanically enforced. The conditions on the exception are
  prose, and no gate checks whether a file holds a real value or a placeholder.
  This ADR trades an unenforceable claim about access for an unenforceable claim
  about content — the difference is that the second one degrades gracefully:
  when it is violated, what leaks is a dummy.
- `wrangler secret put` becomes the only supported path for application secrets,
  so onboarding and rotation both route through `docs/DEPLOYMENT.md`.
