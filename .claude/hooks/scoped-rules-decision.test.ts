/**
 * Exercise every branch of scoped-rules-decision.ts by passing values, with no
 * payload, no file and no fork.
 *
 * `coverage.include` in vitest.config.mts covers `src/**`, `tools/**` and
 * `scripts/**`, so no per-file branch threshold reaches this directory and
 * a branch here is pinned by a case rather than by a number.
 */

import { describe, expect, it } from "vite-plus/test";
import type { ScopedRule } from "./scoped-rules-decision";
import {
  completeMarker,
  loadsNatively,
  markerPrefix,
  pointerContext,
  reachesFor,
  readsTranscript,
  ruleMarker,
  namedPaths,
  parseScopedRule,
  projectRelative,
  transcriptHoldsRule,
} from "./scoped-rules-decision";

const REACT: ScopedRule = {
  name: "react.md",
  patterns: ["src/**/*.ts", "src/**/*.tsx"],
};

const DESIGN: ScopedRule = {
  name: "design.md",
  patterns: ["src/**/*.css", "src/**/*.tsx"],
};

describe(parseScopedRule, () => {
  it.each([
    {
      name: "a comma-separated string",
      text: "---\npaths: src/**/*.ts, src/**/*.tsx\n---\n\n# React\n",
    },
    {
      name: "a quoted comma-separated string",
      text: '---\ndescription: x\npaths: "src/**/*.ts, src/**/*.tsx"\n---\n# React',
    },
    {
      name: "a flow list",
      text: "---\npaths: ['src/**/*.ts', \"src/**/*.tsx\"]\n---\n# React",
    },
    {
      name: "a block list followed by another key",
      text: '---\npaths:\n  - "src/**/*.ts"\n  - src/**/*.tsx\nalwaysApply: false\n---\n# React',
    },
    {
      name: "a block list closing the frontmatter",
      text: "---\npaths:\n  - src/**/*.ts\n  - src/**/*.tsx\n---\n# React",
    },
    {
      name: "a list with a blank entry",
      text: "---\npaths: src/**/*.ts,, src/**/*.tsx\n---\n# React",
    },
  ])("should read the patterns when paths is $name", ({ text }) => {
    const rule = parseScopedRule("react.md", text);

    expect(rule).toStrictEqual(REACT);
  });

  it.each([
    { name: "no frontmatter opens the file", text: "# Prose\n" },
    { name: "the frontmatter never closes", text: "---\npaths: src/**\n# X" },
    {
      name: "the frontmatter has no paths",
      text: "---\nalwaysApply: true\n---\n# X",
    },
    { name: "paths is an empty string", text: '---\npaths: ""\n---\n# X' },
    { name: "paths has no list under it", text: "---\npaths:\n---\n# X" },
  ])("should return no rule when $name", ({ text }) => {
    const rule = parseScopedRule("prose.md", text);

    expect(rule).toBeUndefined();
  });
});

describe(namedPaths, () => {
  it.each([
    {
      expected: ["src/a.tsx"],
      input: { file_path: "src/a.tsx" },
      tool: "Read",
    },
    { expected: [], input: {}, tool: "Edit" },
    {
      expected: ["src/entities/user/index.ts", "p.read_text"],
      input: {
        command: `python3 - <<'PY'\np = Path("src/entities/user/index.ts")\ns = p.read_text()\nPY`,
      },
      tool: "Bash",
    },
    {
      expected: ["$CLAUDE_PROJECT_DIR/src/a.tsx"],
      input: { command: 'cat "$CLAUDE_PROJECT_DIR/src/a.tsx"' },
      tool: "Bash",
    },
    { expected: [], input: { command: "bun run check" }, tool: "Bash" },
    { expected: [], input: {}, tool: "Bash" },
    { expected: [], input: { file_path: "src/a.tsx" }, tool: "Grep" },
  ])(
    "should return $expected when $tool is called with $input",
    ({ expected, input, tool }) => {
      const paths = namedPaths(tool, input);

      expect(paths).toStrictEqual(expected);
    }
  );
});

describe(projectRelative, () => {
  it.each([
    { expected: "src/a.tsx", written: "/repo/src/a.tsx" },
    { expected: "src/a.tsx", written: "a.tsx" },
    { expected: "..a.ts", written: "/repo/..a.ts" },
    { expected: undefined, written: "/repo" },
    { expected: undefined, written: "/elsewhere/a.ts" },
    { expected: undefined, written: "/" },
    { expected: "src/a.tsx", written: "$CLAUDE_PROJECT_DIR/src/a.tsx" },
    {
      expected: "src/a.tsx",
      written: ["$", "{CLAUDE_PROJECT_DIR}/src/a.tsx"].join(""),
    },
  ])(
    "should return $expected when $written is written from /repo/src",
    ({ expected, written }) => {
      const relative = projectRelative(written, "/repo/src", "/repo");

      expect(relative).toStrictEqual(expected);
    }
  );
});

describe(reachesFor, () => {
  it("should pair each rule with the first path it covers when several paths are covered", () => {
    const paths = ["README.md", "src/a.css", "src/b.tsx"];

    const reaches = reachesFor([REACT, DESIGN], paths);

    expect(reaches).toStrictEqual([
      { matchedPath: "src/b.tsx", rule: REACT },
      { matchedPath: "src/a.css", rule: DESIGN },
    ]);
  });

  it("should return nothing when no path is covered", () => {
    const paths = ["README.md", "scripts/x.sh"];

    const reaches = reachesFor([REACT, DESIGN], paths);

    expect(reaches).toStrictEqual([]);
  });
});

describe(transcriptHoldsRule, () => {
  it.each([
    {
      expected: true,
      line: '{"attachment":{"type":"nested_memory","path":"/r/.claude/rules/react.md","displayPath":".claude/rules/react.md"}}',
    },
    {
      expected: false,
      line: '{"message":{"content":"\\"displayPath\\":\\".claude/rules/react.md\\""}}',
    },
    {
      expected: false,
      line: '{"attachment":{"type":"nested_memory","displayPath":".claude/rules/design.md"}}',
    },
  ])(
    "should return $expected when the transcript holds $line",
    ({ expected, line }) => {
      const holds = transcriptHoldsRule(line, "react.md");

      expect(holds).toBe(expected);
    }
  );
});

describe(pointerContext, () => {
  it("should name each rule, its scope and the path on its own line when two rules are reached", () => {
    const reaches = [
      { matchedPath: "src/b.tsx", rule: REACT },
      { matchedPath: "src/a.css", rule: DESIGN },
    ];

    const context = pointerContext(reaches);

    expect(context).toBe(
      "This session just reached src/b.tsx, which .claude/rules/react.md covers (src/**/*.ts, src/**/*.tsx). Read .claude/rules/react.md completely before continuing. This hook names it once per session.\nThis session just reached src/a.css, which .claude/rules/design.md covers (src/**/*.css, src/**/*.tsx). Read .claude/rules/design.md completely before continuing. This hook names it once per session."
    );
  });
});

describe(loadsNatively, () => {
  it.each([
    { expected: true, tool: "Read" },
    { expected: false, tool: "Bash" },
    { expected: false, tool: "Edit" },
  ])("should return $expected when the tool is $tool", ({ expected, tool }) => {
    const native = loadsNatively(tool);

    expect(native).toBe(expected);
  });
});

describe(markerPrefix, () => {
  it.each([
    { agent: "", expected: "/t/claude-scoped-rules-s1-", session: "s1" },
    { agent: "a1", expected: "/t/claude-scoped-rules-s1-a1", session: "s1" },
    { agent: "", expected: "/t/claude-scoped-rules-s1-", session: "../s/1" },
    { agent: "", expected: undefined, session: "" },
    { agent: "", expected: undefined, session: "../" },
  ])(
    "should return $expected when the session is $session and the agent is $agent",
    ({ agent, expected, session }) => {
      const prefix = markerPrefix(session, agent, "/t");

      expect(prefix).toBe(expected);
    }
  );
});

describe(ruleMarker, () => {
  it("should drop the characters a file name does not take when the rule name has a dot", () => {
    const marker = ruleMarker("/t/p", "react.md");

    expect(marker).toBe("/t/p-reactmd");
  });
});

describe(completeMarker, () => {
  it("should carry the rule file count when the marker is named", () => {
    const marker = completeMarker("/t/p", 6);

    expect(marker).toBe("/t/p.complete-6");
  });
});

describe(readsTranscript, () => {
  it.each([
    { agent: "", expected: true },
    { agent: "a1", expected: false },
  ])(
    "should return $expected when the agent is $agent",
    ({ agent, expected }) => {
      const reads = readsTranscript(agent);

      expect(reads).toBe(expected);
    }
  );
});
