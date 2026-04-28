# Agent Workflow

This document is the working manual for using Claude Code (or other AI coding agents) on this repository. It describes the orchestration entry point, the layers that run automatically, the maintenance loops, and edge-case flows.

For the *why* behind these decisions, see the [ADR index](./adr/README.md). The single-source coding rules live under [`.claude/rules/`](../.claude/rules/) and load into every session via [`AGENTS.md`](../AGENTS.md) `@include`.

---

## TL;DR

> **`/start-workflow` → aegis narrows context → subagent (sonnet) writes → parent reviews → `/commit` → `/pr`**.
> Permissions, hooks, and rule files keep the work safe and conformant in the background.

For the user, the active controls are three slash commands:

1. `/start-workflow` — start of any non-trivial task
2. `/commit` — at each commit boundary
3. `/pr` — when ready to publish

Everything else is automated or invoked from inside `/start-workflow`.

---

## (A) Per-task flow

```
incoming request
  │
  ├─ trivial? (one-line fix · typo · single config value · docs only)
  │   └─ YES → handle directly → /commit
  │
  ↓ NO (= ticket-granularity)

/start-workflow
  ├ 1. Clarify
  │     If acceptance criteria are ambiguous, ask one focused question.
  │
  ├ 2. Compile context (aegis)
  │     aegis_compile_context({ target_files, plan })
  │     → returns relevant rule / ADR docs with relevance scores.
  │
  ├ 3. ADR check
  │     Non-obvious design choice? Draft docs/adr/NNNN-*.md before dispatch.
  │     Pure mechanical work? Skip.
  │
  ├ 4. Plan
  │     Short briefing: goal · files · acceptance criteria · verification.
  │     Complex work → delegate to superpowers:writing-plans.
  │     Fuzzy requirements → use superpowers:brainstorming first.
  │
  ├ 5. (optional) Worktree
  │     Big refactor / parallel branches only.
  │     superpowers:using-git-worktrees automates the setup.
  │
  ├ 6. Dispatch
  │     Agent({ subagent_type: "general-purpose", model: "sonnet", prompt: <briefing> }).
  │     Independent sub-tasks → multiple Agent calls in one message (parallel).
  │     TDD-appropriate work → superpowers:test-driven-development.
  │
  ├ 7. Review (Before-reporting-done pass)
  │     Read the diff. Run typecheck / test. Check for missing branch coverage,
  │     dead code, null/off-by-one bug patterns. Fix via another subagent if
  │     needed — do NOT write code in the parent.
  │
  ├ 8. /commit
  │     Split by purpose (one commit = one revertible intent).
  │
  └ 9. /pr
        English summary + chrome-devtools demo GIF for UI changes.
```

Anchors:
- The orchestration sequence and rationale: [ADR-0006](./adr/0006-orchestration-layering.md).
- Subagent dispatch rules and model selection: [`.claude/rules/agents.md`](../.claude/rules/agents.md), [ADR-0003](./adr/0003-subagent-driven-implementation.md).
- Commit splitting discipline: [`/commit` skill](../.claude/skills/commit/SKILL.md).
- PR format including demo GIF: [`/pr` skill](../.claude/skills/pr/SKILL.md).

---

## (B) Always-on layers — no manual action needed

```
[Permission gates] — physically refuse destructive actions
  · deny: rm -rf / git push --force / git reset --hard / .env access / sudo
  · ask:  git commit / git push / gh pr create / deploy / rm / mv / cp / bun add (no -E)
  · allow: read-only git/gh/bun, tree/find/grep/cat, wrangler types, ffmpeg

[Pre-edit hook] — pre-tool-use-guard.sh
  · Blocks: for/while loops, Tailwind arbitrary [...], color-opacity modifiers,
    package.json range specifiers (^, ~, major-only)

[Post-edit hook] — runs lint + typecheck per .ts/.tsx/.js/.jsx/.mjs/.cjs edit
  · Blocks the next tool call on failure.

[Stop hook chain]
  1. stop-quality-gate.sh:  typecheck + lint + format + knip + similarity (all blocking)
  2. stop-agent-review.sh:  headless Claude (Opus) reviews diff against .claude/rules/*.md
  3. stop-component-verify.sh: chrome-devtools MCP smoke-tests new components

[Always-loaded prompt]
  · AGENTS.md @includes .claude/rules/*.md (style/architecture/testing/dependencies/tools/agents)
  · CLAUDE.md @AGENTS.md + aegis section
```

Source of truth: [`.claude/settings.json`](../.claude/settings.json), [`.claude/hooks/*`](../.claude/hooks/).

ADR references:
- Permission boundary design: [ADR-0004](./adr/0004-permission-deny-as-security-boundary.md).
- Rules file layout and `@include` strategy: [ADR-0001](./adr/0001-coding-rules-via-claude-rules-include.md).

---

## (C) Maintenance loops

### Dependencies

```
[Dependabot]  weekly
  · npm:           versioning-strategy: increase (preserves exact pinning)
  · github-actions: SHA pin updates included
[CI on every PR/push to main]
  · bun install --frozen-lockfile
  · scripts/audit-direct.sh:  direct deps blocking, transitive informational
  · check + test + typecheck + build
```

Direct-dep audit policy: [ADR-0002](./adr/0002-direct-deps-only-audit.md). Audit script: [`scripts/audit-direct.sh`](../scripts/audit-direct.sh).

### Aegis knowledge base

```
[Adding a new rule or ADR]
  aegis_import_doc({ file_path, doc_id, kind, edge_hints, tags })
  → individual proposal IDs returned → approve via aegis_approve_proposal

[Editing an existing rule]
  aegis_sync_docs()
  → detects content_hash drift, generates update_doc proposals → approve

[Compile miss feedback]
  aegis_observe({ event_type: "compile_miss", related_compile_id, related_snapshot_id, payload })
  → triage later via the aegis-triage skill → proposals → approve
```

### ADRs

Add a new ADR when a non-obvious design decision is made. Use the MADR-lite template documented in [`docs/adr/README.md`](./adr/README.md). Numbering is strictly sequential — never renumber.

### Skill / prompt tuning

Use [`/empirical-prompt-tuning`](../.claude/skills/empirical-prompt-tuning/SKILL.md) when creating or substantially editing a skill. Iterate against fresh subagents until convergence (zero new ambiguities for two consecutive iterations).

---

## Special-case flows

| Situation | What to do |
|---|---|
| Figma URL or design implementation request | Dispatch a subagent that uses `figma:figma-implement-design` (calls `mcp__plugin_figma_figma__get_design_context` internally). |
| Anthropic SDK / Claude API code edit | The `claude-api` skill triggers from imports of `anthropic` / `@anthropic-ai/sdk`. |
| Bug with unclear root cause | Insert `superpowers:systematic-debugging` before `/start-workflow` step 4. |
| True parallel multi-agent work (independent branches of one effort) | Use `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`. Single-task offloads stay as single subagent dispatches. |
| Editing `start-workflow` itself or other load-bearing skills | Run `/empirical-prompt-tuning` against the change; merge only after convergence. |
| Removing DB / auth / storage to repurpose the template | `/remove-db` skill performs the surgical removal in one pass. |
| Vulnerability surfaces in transitive dep | Track upstream; do not add `package.json` overrides (per ADR-0002). |

---

## Active vs passive — what the user actually does

**Active** (you type these):
- `/start-workflow` to start
- `/commit` at boundaries
- `/pr` when shipping

**Confirmation-only** (the agent asks, you answer):
- "Should I write an ADR for this decision?"
- "Compile-miss observed — triage now or later?"
- Dependabot PR approvals on GitHub

**Fully automated** (you ignore these unless they fail):
- All hooks (pre/post-tool, stop chain)
- CI gates
- Permission denials

---

## Where things live

| Concern | Location |
|---|---|
| Coding rules | [`.claude/rules/`](../.claude/rules/) (loaded via [`AGENTS.md`](../AGENTS.md) `@include`) |
| Skills | [`.claude/skills/`](../.claude/skills/) |
| Hooks | [`.claude/hooks/`](../.claude/hooks/) and [`.claude/settings.json`](../.claude/settings.json) `hooks` |
| Permissions | [`.claude/settings.json`](../.claude/settings.json) `permissions` |
| MCP servers | [`.mcp.json`](../.mcp.json), enabled in [`.claude/settings.json`](../.claude/settings.json) `enabledMcpjsonServers` |
| Plugins | [`.claude/settings.json`](../.claude/settings.json) `enabledPlugins` |
| ADRs | [`docs/adr/`](./adr/) |
| CI | [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) + [`scripts/audit-direct.sh`](../scripts/audit-direct.sh) |
| Dependency automation | [`.github/dependabot.yml`](../.github/dependabot.yml) |

---

## similarity install

`similarity-ts` requires Rust's `cargo`. Install separately, then run from the project root:

```bash
cargo install similarity-ts

similarity-ts ./src                  # default
similarity-ts ./src --print          # show matched code
similarity-ts ./src --threshold 0.7  # default is 0.85
```

The Stop quality gate hook runs this automatically; the manual command is for ad-hoc investigation.
