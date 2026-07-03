# Code Graph Workflow Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce workflow token consumption by injecting a pre-built dependency graph into review-diff and verify-spec agents, eliminating per-agent codebase exploration.

**Architecture:** A TypeScript script (`scripts/build-graph.ts`) statically analyzes imports under `src/` using the TS Compiler API and writes `.claude/code-graph.json`. Both workflow scripts read this file via a lightweight haiku agent (Phase 0), extract the subgraph relevant to the diff or spec, and inject it into every downstream agent's prompt with an explicit "do not explore beyond this graph" constraint.

**Tech Stack:** TypeScript Compiler API (already in devDependencies), bun for script execution, Claude Code hooks for automation.

## Global Constraints

- Path alias: `@/*` maps to `./src/*` (tsconfig.json)
- Typecheck: `bun run typecheck` (`tsgo --noEmit`)
- Lint: `bun run lint` (`oxlint --type-aware src`)
- Test: `bun run test` (`vitest --run`)
- No `as` casts (except `as const`), no `any`, no `@ts-ignore`
- Scripts run with `bun` (not `node`)
- Workflow scripts are plain JS (no TypeScript annotations)

---

### Task 1: Graph Generation Script

**Files:**
- Create: `scripts/build-graph.ts`
- Modify: `package.json` (add `"graph"` script)

**Interfaces:**
- Consumes: `tsconfig.json` (for path alias resolution)
- Produces: `.claude/code-graph.json` with this shape:

```typescript
interface CodeGraph {
  version: 1;
  generated_at: string;
  nodes: Record<string, {
    layer: "route" | "component" | "server" | "gateway" | "entity" | "lib" | "test" | "config";
    imports: string[];
    imported_by: string[];
  }>;
}
```

- [ ] **Step 1: Write the failing test**

Create `scripts/build-graph.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { classifyLayer, buildGraph } from "./build-graph";

describe("classifyLayer", () => {
  it("classifies route files", () => {
    expect(classifyLayer("src/routes/__root.tsx")).toBe("route");
    expect(classifyLayer("src/routes/api/auth.$.ts")).toBe("route");
  });

  it("classifies component files", () => {
    expect(classifyLayer("src/components/ui/button.tsx")).toBe("component");
    expect(classifyLayer("src/components/shared/header/Header.tsx")).toBe("component");
  });

  it("classifies server files", () => {
    expect(classifyLayer("src/server/fn/user.ts")).toBe("server");
  });

  it("classifies gateway files", () => {
    expect(classifyLayer("src/gateways/user/index.ts")).toBe("gateway");
  });

  it("classifies entity files", () => {
    expect(classifyLayer("src/entities/user/index.ts")).toBe("entity");
  });

  it("classifies lib files", () => {
    expect(classifyLayer("src/lib/auth.ts")).toBe("lib");
    expect(classifyLayer("src/lib/utils.ts")).toBe("lib");
  });

  it("classifies test files", () => {
    expect(classifyLayer("src/test/router-utils.tsx")).toBe("test");
    expect(classifyLayer("src/test-setup.ts")).toBe("test");
  });

  it("classifies top-level src files as config", () => {
    expect(classifyLayer("src/client.tsx")).toBe("config");
    expect(classifyLayer("src/router.tsx")).toBe("config");
    expect(classifyLayer("src/ssr.tsx")).toBe("config");
  });
});

describe("buildGraph", () => {
  it("produces a valid graph with version 1", () => {
    const graph = buildGraph();
    expect(graph.version).toBe(1);
    expect(graph.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(graph.nodes).length).toBeGreaterThan(0);
  });

  it("resolves @/ path alias imports", () => {
    const graph = buildGraph();
    const root = graph.nodes["src/routes/__root.tsx"];
    expect(root).toBeDefined();
    expect(root.imports).toContain("src/server/fn/user.ts");
    expect(root.imports).toContain("src/components/shared/header/Header.tsx");
  });

  it("builds bidirectional references", () => {
    const graph = buildGraph();
    const root = graph.nodes["src/routes/__root.tsx"];
    const userFn = graph.nodes["src/server/fn/user.ts"];
    expect(root.imports).toContain("src/server/fn/user.ts");
    expect(userFn.imported_by).toContain("src/routes/__root.tsx");
  });

  it("excludes external packages", () => {
    const graph = buildGraph();
    for (const node of Object.values(graph.nodes)) {
      for (const imp of node.imports) {
        expect(imp).toMatch(/^src\//);
      }
    }
  });

  it("excludes generated route tree", () => {
    const graph = buildGraph();
    expect(graph.nodes["src/routeTree.gen.ts"]).toBeUndefined();
  });

  it("excludes .d.ts files", () => {
    const graph = buildGraph();
    expect(graph.nodes["src/env.d.ts"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test scripts/build-graph.test.ts`
Expected: FAIL — `build-graph` module does not exist.

- [ ] **Step 3: Implement `scripts/build-graph.ts`**

```typescript
import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const OUT_PATH = path.join(ROOT, ".claude", "code-graph.json");

const LAYER_RULES: Array<{ pattern: RegExp; layer: string }> = [
  { pattern: /^src\/routes\//, layer: "route" },
  { pattern: /^src\/components\//, layer: "component" },
  { pattern: /^src\/server\//, layer: "server" },
  { pattern: /^src\/gateways\//, layer: "gateway" },
  { pattern: /^src\/entities\//, layer: "entity" },
  { pattern: /^src\/lib\//, layer: "lib" },
  { pattern: /^src\/test[\/-]/, layer: "test" },
];

export function classifyLayer(filePath: string): string {
  for (const rule of LAYER_RULES) {
    if (rule.pattern.test(filePath)) return rule.layer;
  }
  return "config";
}

export function buildGraph(): {
  version: 1;
  generated_at: string;
  nodes: Record<string, { layer: string; imports: string[]; imported_by: string[] }>;
} {
  const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) throw new Error("tsconfig.json not found");

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);

  const srcFiles = parsedConfig.fileNames.filter((f) => {
    const rel = path.relative(ROOT, f);
    return (
      rel.startsWith("src/") &&
      !rel.endsWith(".d.ts") &&
      !rel.includes("routeTree.gen")
    );
  });

  const program = ts.createProgram(srcFiles, parsedConfig.options);
  const nodes: Record<string, { layer: string; imports: string[]; imported_by: string[] }> = {};

  for (const filePath of srcFiles) {
    const rel = path.relative(ROOT, filePath);
    nodes[rel] = { layer: classifyLayer(rel), imports: [], imported_by: [] };
  }

  const srcFileSet = new Set(srcFiles.map((f) => path.relative(ROOT, f)));

  for (const filePath of srcFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;

    const rel = path.relative(ROOT, filePath);

    ts.forEachChild(sourceFile, (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        const resolved = ts.resolveModuleName(
          specifier,
          filePath,
          parsedConfig.options,
          ts.sys,
        );

        if (resolved.resolvedModule && !resolved.resolvedModule.isExternalLibraryImport) {
          const resolvedRel = path.relative(ROOT, resolved.resolvedModule.resolvedFileName);
          if (srcFileSet.has(resolvedRel) && resolvedRel !== rel) {
            nodes[rel].imports.push(resolvedRel);
          }
        }
      }
    });
  }

  for (const [filePath, node] of Object.entries(nodes)) {
    for (const imp of node.imports) {
      if (nodes[imp]) {
        nodes[imp].imported_by.push(filePath);
      }
    }
  }

  for (const node of Object.values(nodes)) {
    node.imports.sort();
    node.imported_by.sort();
  }

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    nodes,
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("build-graph.ts")) {
  const graph = buildGraph();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(graph, null, 2) + "\n");
  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = Object.values(graph.nodes).reduce((sum, n) => sum + n.imports.length, 0);
  console.log(`code-graph: ${nodeCount} nodes, ${edgeCount} edges -> ${OUT_PATH}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test scripts/build-graph.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Add `graph` script to package.json**

In `package.json`, add to `"scripts"`:

```json
"graph": "bun run scripts/build-graph.ts"
```

- [ ] **Step 6: Generate the initial graph and verify output**

Run: `bun run graph`
Expected: prints `code-graph: ~40 nodes, ~N edges -> .claude/code-graph.json`

Verify: `cat .claude/code-graph.json | jq '.version, (.nodes | keys | length)'` outputs `1` and a number around 40.

- [ ] **Step 7: Run typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-graph.ts scripts/build-graph.test.ts package.json .claude/code-graph.json
git commit -m "feat: import 静的解析によるコードグラフ生成スクリプトを追加する"
```

---

### Task 2: Git Automation (`.gitattributes` + PreToolUse hook)

**Files:**
- Create: `.gitattributes`
- Create: `.claude/hooks/pre-commit-graph-refresh.sh`
- Modify: `.claude/settings.json` (register hook in existing `PreToolUse` Bash matcher)

**Interfaces:**
- Consumes: `bun run graph` (Task 1)
- Produces: automatic graph regeneration on `git commit` when `src/` files are staged

- [ ] **Step 1: Create `.gitattributes`**

```
.claude/code-graph.json -diff
```

- [ ] **Step 2: Create the PreToolUse hook**

Create `.claude/hooks/pre-commit-graph-refresh.sh`:

```bash
#!/usr/bin/env bash
# PreToolUse(Bash) hook:
# When the agent runs `git commit` and src/ files are staged,
# regenerate code-graph.json and stage the result.
# Runs alongside pre-commit-review-reminder.sh on the same
# Bash matcher — both fire on every Bash call, each filters
# for git commit internally.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')
case "$CMD" in
  *git\ commit*|*git\ -c\ *commit*) ;;
  *) exit 0 ;;
esac

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

if git -C "$ROOT" diff --cached --name-only | grep -q '^src/'; then
  (cd "$ROOT" && bun run graph 2>/dev/null)
  git -C "$ROOT" add .claude/code-graph.json 2>/dev/null || true
fi

exit 0
```

- [ ] **Step 3: Make the hook executable**

Run: `chmod +x .claude/hooks/pre-commit-graph-refresh.sh`

- [ ] **Step 4: Register hook in `.claude/settings.json`**

Add to the existing `PreToolUse` array entry with `"matcher": "Bash"`, appending a second hook object to its `hooks` array:

```json
{
  "type": "command",
  "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-graph-refresh.sh",
  "timeout": 30,
  "statusMessage": "Graph refresh: regenerating code-graph.json if src/ changed..."
}
```

The existing Bash matcher block becomes:

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-review-reminder.sh",
      "timeout": 5,
      "statusMessage": "Review reminder: checking code-reviewer dispatch..."
    },
    {
      "type": "command",
      "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-graph-refresh.sh",
      "timeout": 30,
      "statusMessage": "Graph refresh: regenerating code-graph.json if src/ changed..."
    }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add .gitattributes .claude/hooks/pre-commit-graph-refresh.sh .claude/settings.json
git commit -m "chore: コミット時にコードグラフを自動再生成する PreToolUse フックを追加する"
```

---

### Task 3: Integrate Graph into review-diff.js

**Files:**
- Modify: `.claude/workflows/review-diff.js`

**Interfaces:**
- Consumes: `.claude/code-graph.json` (Task 1)
- Produces: `GRAPH_CONTEXT` string injected into all finder and verifier prompts

- [ ] **Step 1: Add the Graph schema and Phase 0 constants**

After the existing `VERDICT_SCHEMA` definition (line 94), add:

```javascript
const GRAPH_SCHEMA = {
  type: "object",
  required: ["changed_files", "subgraph"],
  properties: {
    changed_files: { type: "array", items: { type: "string" } },
    subgraph: {
      type: "object",
      description: "depth-1 neighborhood of changed files from code-graph.json",
      additionalProperties: {
        type: "object",
        properties: {
          layer: { type: "string" },
          imports: { type: "array", items: { type: "string" } },
          imported_by: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};
```

- [ ] **Step 2: Add Phase 0 "Graph" before the Find phase**

Insert before the existing `phase("Find")` line (line 134):

```javascript
// ---- Phase 0: Graph (extract dependency subgraph for the diff) ----
phase("Graph");
const graphResult = await agent(
  `Extract the dependency subgraph for the current uncommitted diff.
1. Run \`git diff --name-only HEAD\` and \`git ls-files --others --exclude-standard\` to get the list of changed/new files.
2. Read \`.claude/code-graph.json\`. If it does not exist, run \`bun run graph\` first, then read it.
3. For each changed file that appears in the graph's nodes, collect it plus its depth-1 neighbors (direct imports and imported_by).
4. Return the changed_files list and the subgraph containing only those nodes.
If there are no changed files or the graph has no matching nodes, return {"changed_files": [], "subgraph": {}}.`,
  { label: "graph", phase: "Graph", model: "haiku", effort: "low", schema: GRAPH_SCHEMA }
);

const graphContext = graphResult && Object.keys(graphResult.subgraph).length > 0
  ? `\nDependency graph for affected files (depth-1 neighborhood):\n${JSON.stringify(graphResult.subgraph)}\nChanged files: ${graphResult.changed_files.join(", ")}\nCONSTRAINT: Use this graph to understand impact. Do NOT explore or read files outside this graph unless a finding specifically requires verifying behavior in an unlisted file.\n`
  : "";
```

- [ ] **Step 3: Inject `graphContext` into finder prompts**

Modify the BUG_LANES `.map` callback. Change the agent prompt from:

```javascript
`You are one finder lane in a multi-agent code review; your ONLY lens is ${lane.focus}. ${DIFF_INSTRUCTIONS} Dig deep within your lens...`
```

to:

```javascript
`You are one finder lane in a multi-agent code review; your ONLY lens is ${lane.focus}. ${DIFF_INSTRUCTIONS}${graphContext} Dig deep within your lens and ignore everything outside it. Report every issue you find in your lens, including ones you are uncertain about — do NOT filter for importance or confidence; a separate adversarial verification stage does that. Every finding still needs a concrete failure scenario and a severity estimate.`
```

Do the same for the rules lane agent prompt — insert `${graphContext}` after `${DIFF_INSTRUCTIONS}`.

- [ ] **Step 4: Inject `graphContext` into verifier prompts**

In the Verify phase, modify the adversarial verify agent prompt to include the graph:

Change from:

```javascript
`Adversarially verify one code-review finding through the ${lens} lens. Try to REFUTE it by reading the actual code...`
```

to:

```javascript
`Adversarially verify one code-review finding through the ${lens} lens.${graphContext} Try to REFUTE it by reading the actual code; if it cites an AGENTS.md rule, read AGENTS.md and respect rule scope qualifiers...`
```

- [ ] **Step 5: Update the meta phases**

Add Graph phase to the `meta.phases` array as the first entry:

```javascript
{ title: "Graph", detail: "extract dependency subgraph for the diff", model: "haiku" },
```

- [ ] **Step 6: Verify the workflow runs**

Run on the current uncommitted state (if any changes exist) or make a trivial edit to a src file:

```bash
# From Claude Code, run: Workflow({name: "review-diff"})
```

Verify: Graph phase completes, finder prompts include the subgraph context, no errors.

- [ ] **Step 7: Commit**

```bash
git add .claude/workflows/review-diff.js
git commit -m "feat: review-diff ワークフローにコードグラフ注入を追加しエージェント探索を削減する"
```

---

### Task 4: Integrate Graph into verify-spec.js

**Files:**
- Modify: `.claude/workflows/verify-spec.js`

**Interfaces:**
- Consumes: `.claude/code-graph.json` (Task 1), the Formalize agent's existing output
- Produces: `file_graph` field in the machine schema, injected into hunter prompts

- [ ] **Step 1: Add `file_graph` to the MACHINE_SCHEMA**

In the `MACHINE_SCHEMA.properties` object (after `ambiguities`), add:

```javascript
file_graph: {
  type: "object",
  description: "depth-1 subgraph of source files related to the spec's states and actions, extracted from .claude/code-graph.json",
  additionalProperties: {
    type: "object",
    properties: {
      layer: { type: "string" },
      imports: { type: "array", items: { type: "string" } },
      imported_by: { type: "array", items: { type: "string" } },
    },
  },
},
```

Note: `file_graph` is NOT added to `required` — it is optional so the workflow works even without `code-graph.json`.

- [ ] **Step 2: Update the Formalize agent prompt**

Append to the existing Formalize prompt (before the closing backtick):

```javascript
` Also read .claude/code-graph.json (run \`bun run graph\` first if it does not exist). For each state or action in the spec that maps to a source file or module, look up that file in the graph and include its depth-1 neighborhood (the file plus its direct imports and imported_by) in the file_graph field. If no files can be mapped, return an empty file_graph object.`
```

- [ ] **Step 3: Inject `file_graph` into hunter prompts**

After the Formalize phase, build a graph context string:

```javascript
const fileGraphContext = machine.file_graph && Object.keys(machine.file_graph).length > 0
  ? `\nSource file dependency graph for this spec:\n${JSON.stringify(machine.file_graph)}\nUse this to ground counterexamples in actual file dependencies.\n`
  : "";
```

Then modify the `HUNT_PREAMBLE` to include it:

```javascript
const HUNT_PREAMBLE = `You are one counterexample-hunting lane in an agent-based model check of the spec at ${specPath}. The normalized machine: ${machineJson}.${fileGraphContext} Search traces of at most ${depth} steps...`;
```

- [ ] **Step 4: Commit**

```bash
git add .claude/workflows/verify-spec.js
git commit -m "feat: verify-spec ワークフローにコードグラフ注入を追加しハンターの精度を向上させる"
```
