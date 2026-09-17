# Upstream

Every other file in this directory is a verbatim copy of `skills/security-audit/`
from https://github.com/cloudflare/security-audit-skill at commit
`c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14), plus that repository's
`LICENSE` (MIT). Edit none of them: the refresh below overwrites the edit.

`vite.config.ts`, `vitest.config.mts` and `lefthook.yml` each name this
directory, keeping the project's formatter, linter and test runner off a copy
nobody here owns. Drop those entries along with the directory if the skill is
ever removed.

To use the skill, ask a session in this repository for a security audit of the
codebase. `SKILL.md`'s Operating modes section decides guidance or full audit,
and its Full audit setup section decides where the report is written.

## Refresh

```bash
tmp=$(mktemp -d)
git clone https://github.com/cloudflare/security-audit-skill "$tmp"
git -C "$tmp" diff c1c8a8c1471069fb0e188eeaff69b8e8db6564a8..HEAD -- skills/security-audit LICENSE
```

Read that diff before copying anything. The files it replaces instruct an agent,
and `node` runs the two validators, so an upstream change lands unread otherwise.
The clone is deliberately not shallow: `--depth 1` leaves the recorded commit out
of the clone and the diff above then cannot resolve it.

```bash
cp "$tmp"/skills/security-audit/* .claude/skills/security-audit/
cp "$tmp"/LICENSE .claude/skills/security-audit/
git -C "$tmp" log -1 --format=%H
rm -rf "$tmp"
```

Delete whatever file upstream dropped, write the printed commit into the line
above, then run `bun run check`, `bun run test` and
`node --test .claude/skills/security-audit/*.test.cjs`.
