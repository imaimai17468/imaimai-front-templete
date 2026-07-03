# Code Graph Workflow Integration

Token-efficient workflow execution via a pre-built dependency graph that replaces per-agent codebase exploration.

## Problem

The `review-diff` and `verify-spec` workflows fan out multiple subagents (5-7 finders + N verifiers, 4 hunters + N verifiers). Each agent independently runs `git diff HEAD` and explores the codebase to understand context around the changed files. This duplicated exploration is the primary token cost driver.

## Solution

A statically-generated dependency graph (`.claude/code-graph.json`) extracted from TypeScript imports. Workflows inject the relevant subgraph into each agent's prompt with an explicit constraint to not explore beyond it, eliminating redundant codebase traversal.

## Data Model

`scripts/build-graph.ts` produces `.claude/code-graph.json`:

```json
{
  "version": 1,
  "generated_at": "2026-07-03T12:00:00Z",
  "nodes": {
    "src/routes/__root.tsx": {
      "layer": "route",
      "imports": ["src/components/shared/Header.tsx", "src/server/fn/getCurrentUserFn.ts"],
      "imported_by": []
    },
    "src/server/fn/getCurrentUserFn.ts": {
      "layer": "server",
      "imports": ["src/gateways/user/fetchCurrentUser.ts", "src/lib/auth.ts"],
      "imported_by": ["src/routes/__root.tsx"]
    }
  }
}
```

### Node fields

| Field | Type | Description |
|-------|------|-------------|
| `layer` | `"route" \| "component" \| "server" \| "gateway" \| "entity" \| "lib"` | Auto-classified from file path |
| `imports` | `string[]` | Project-internal files this file depends on (repo-relative paths) |
| `imported_by` | `string[]` | Project-internal files that depend on this file |

### Design decisions

- **Project-internal only**: External packages (`react`, `@tanstack/*`, etc.) are excluded — they add noise without actionable context for review.
- **Bidirectional references**: Both `imports` and `imported_by` are stored. `imports` answers "what does this file depend on?" (for understanding context). `imported_by` answers "what breaks if this file changes?" (for impact analysis).
- **Repo-relative paths**: Keys match `git diff --name-only` output directly — no path normalization needed at query time.
- **Layer classification**: Derived from path prefix (`src/routes/` → `route`, `src/components/` → `component`, `src/server/` → `server`, `src/gateways/` → `gateway`, `src/entities/` → `entity`, `src/lib/` → `lib`). Gives agents architectural context without codebase exploration.

## Graph Generation: `scripts/build-graph.ts`

Uses TypeScript Compiler API (`ts.createProgram`) with the project's `tsconfig.json` to:

1. Enumerate all `.ts` / `.tsx` files under `src/`
2. Walk each file's import declarations
3. Resolve import specifiers (including `tsconfig.json` path aliases like `~/`) to actual file paths
4. Build the bidirectional `imports` / `imported_by` maps
5. Classify each node's `layer` from its path
6. Write `.claude/code-graph.json`

**Why TS Compiler API over regex**: Path aliases (`~/`), barrel re-exports, and `index.ts` resolution require the real module resolver. Regex would miss these or produce incorrect edges.

**No new dependencies**: `typescript` is already in `devDependencies`.

**Execution**: `bun run graph` (added to `package.json` scripts).

## Workflow Integration: review-diff.js

### Current flow

```
Find (parallel: 5-7 finders) → barrier → dedup → Verify (parallel) → Stamp
```

### New flow

```
Graph (1 haiku agent) → Find (parallel, graph-injected) → barrier → dedup → Verify (parallel, graph-injected) → Stamp
```

### Phase 0: Graph

A single haiku agent with structured output:

1. Reads `.claude/code-graph.json`
2. Runs `git diff --name-only HEAD` to get changed files
3. Extracts depth-1 subgraph: changed files + their direct `imports` + direct `imported_by`
4. Returns the subgraph as a JSON object

If `code-graph.json` does not exist, the agent runs `bun run graph` first (fallback).

Schema for the graph agent's return:

```json
{
  "type": "object",
  "required": ["changed_files", "subgraph"],
  "properties": {
    "changed_files": { "type": "array", "items": { "type": "string" } },
    "subgraph": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "layer": { "type": "string" },
          "imports": { "type": "array", "items": { "type": "string" } },
          "imported_by": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

### Prompt injection

The graph scout's return is serialized as `GRAPH_CONTEXT` and prepended to every finder and verifier prompt:

```
Dependency graph for the affected files (depth-1 neighborhood):
${JSON.stringify(graphResult.subgraph)}

Changed files: ${graphResult.changed_files.join(', ')}

CONSTRAINT: Use this graph to understand the impact of changes.
Do NOT read or explore files outside this graph unless a finding
specifically requires verifying behavior in an unlisted file.
```

The constraint is critical — it converts the graph from advisory context to a hard exploration boundary.

### Expected token savings

Each finder currently spends tokens on:
- Running `git diff HEAD` (~same, unchanged)
- Reading changed files to understand them (~same, unchanged)
- Exploring imports, callers, and related files to understand context (~eliminated by graph)
- Reading those explored files (~eliminated or greatly reduced)

The exploration phase is typically 30-50% of a finder's token budget. With 5-7 finders, the aggregate savings compound.

## Workflow Integration: verify-spec.js

### Current flow

```
Formalize (1 agent) → Hunt (4 parallel lanes) → Verify (parallel)
```

### New flow

```
Graph+Formalize (1 agent, combined) → Hunt (graph-injected) → Verify (graph-injected)
```

The Formalize agent's prompt gains an additional instruction:

```
Also read .claude/code-graph.json. For each state/action in the spec that
maps to a source file, include the relevant subgraph (depth 1) in your output.
```

The machine schema gains an optional `file_graph` field:

```json
{
  "file_graph": {
    "type": "object",
    "description": "depth-1 subgraph of source files related to the spec's states and actions",
    "additionalProperties": {
      "type": "object",
      "properties": {
        "layer": { "type": "string" },
        "imports": { "type": "array", "items": { "type": "string" } },
        "imported_by": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

Hunters receive the `file_graph` alongside the machine definition, enabling them to ground counterexamples in actual file dependencies rather than guessing.

## Automation

### Pre-commit hook

A new Claude Code `PreToolUse(Bash)` hook at `.claude/hooks/pre-commit-graph-refresh.sh`. When the agent runs `git commit` and `src/` files are staged, it regenerates the graph and stages the result before the commit proceeds:

```bash
# Detect git commit → check if src/ files are staged → bun run graph → git add
```

This follows the same pattern as `pre-commit-review-reminder.sh` (PreToolUse guard on `git commit`). Unlike that hook, this one does not block — it runs the generation and exits 0.

### .gitattributes

```
.claude/code-graph.json -diff
```

Prevents the generated JSON from cluttering commit diffs.

### Workflow fallback

Both workflows check for `code-graph.json` existence in their graph agent. If missing, the agent runs `bun run graph` before reading — handles first-time setup and accidental deletion.

## File manifest

| File | Action | Purpose |
|------|--------|---------|
| `scripts/build-graph.ts` | Create | Graph generation script |
| `package.json` | Edit | Add `"graph"` script |
| `.claude/code-graph.json` | Generated | The dependency graph |
| `.gitattributes` | Edit | Suppress diff for generated file |
| `.claude/workflows/review-diff.js` | Edit | Add Phase 0, inject graph into finders/verifiers |
| `.claude/workflows/verify-spec.js` | Edit | Extend Formalize to read graph, inject into hunters |
| `.claude/hooks/pre-commit-graph-refresh.sh` | Create | PreToolUse hook to regenerate graph on commit |
| `.claude/settings.json` | Edit | Register the new hook |

## Non-goals

- **Semantic relationships** (use-case grouping, domain boundaries): Out of scope. The graph captures structural (import) dependencies only. Semantic relationships can be added to Aegis documents manually as a future enhancement.
- **Cross-repo dependencies**: Not applicable — single-repo project.
- **Runtime call graph**: Static imports only. Dynamic `import()` is not used in this codebase.
- **MCP memory server**: Not adopted. The graph is a plain JSON file read by workflow agents, not a separate knowledge system to maintain.
