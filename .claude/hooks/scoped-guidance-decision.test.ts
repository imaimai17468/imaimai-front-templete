/**
 * Exercise every branch of scoped-guidance-decision.ts by passing values, with no
 * payload, no file and no fork.
 *
 * `coverage.include` in vitest.config.mts covers `src/**`, `tools/**` and
 * `scripts/**`, so no per-file branch threshold reaches this directory and
 * a branch here is pinned by a case rather than by a number.
 */

import { describe, expect, it } from "vite-plus/test";
import type { CallFacts, ScopedRule } from "./scoped-guidance-decision";
import {
  completeMarker,
  markerPrefix,
  namedPaths,
  parseScopedRule,
  pointerContext,
  projectRelative,
  reachesFor,
  ruleMarker,
} from "./scoped-guidance-decision";

const REACT: ScopedRule = {
  commands: [],
  events: [],
  name: "react.md",
  patterns: ["src/**/*.ts", "src/**/*.tsx"],
};

const PROSE: ScopedRule = {
  commands: ["git commit", "gh pr create"],
  events: [],
  name: "prose.md",
  patterns: ["**/*.md"],
};

const REPLIES: ScopedRule = {
  commands: [],
  events: ["UserPromptSubmit"],
  name: "replies.md",
  patterns: [],
};

const toolCall = (facts: Partial<CallFacts>): CallFacts => ({
  command: "",
  event: "PreToolUse",
  paths: [],
  ...facts,
});

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
      text: '---\npaths:\n  - "src/**/*.ts"\n  - src/**/*.tsx\ndescription: x\n---\n# React',
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

  it("should read commands beside paths when both are given", () => {
    const text =
      '---\npaths: "**/*.md"\ncommands: git commit, gh pr create\n---\n# Prose';

    const rule = parseScopedRule("prose.md", text);

    expect(rule).toStrictEqual(PROSE);
  });

  it("should keep only the events this hook answers when events lists others", () => {
    const text = "---\nevents: UserPromptSubmit, SessionStart\n---\n# Replies";

    const rule = parseScopedRule("replies.md", text);

    expect(rule).toStrictEqual(REPLIES);
  });

  it.each([
    { name: "no frontmatter opens the file", text: "# Prose\n" },
    { name: "the frontmatter never closes", text: "---\npaths: src/**\n# X" },
    {
      name: "the frontmatter names no trigger",
      text: "---\ndescription: x\n---\n# X",
    },
    { name: "paths is an empty string", text: '---\npaths: ""\n---\n# X' },
    { name: "paths has no list under it", text: "---\npaths:\n---\n# X" },
    {
      name: "events names only events this hook does not answer",
      text: "---\nevents: SessionStart\n---\n# X",
    },
  ])("should return no rule when $name", ({ text }) => {
    const rule = parseScopedRule("x.md", text);

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

describe(markerPrefix, () => {
  it.each([
    { agent: "", expected: "/t/claude-scoped-guidance-s1-", session: "s1" },
    { agent: "a1", expected: "/t/claude-scoped-guidance-s1-a1", session: "s1" },
    { agent: "", expected: "/t/claude-scoped-guidance-s1-", session: "../s/1" },
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

describe(reachesFor, () => {
  it.each([
    {
      expected: [{ reason: "reached src/b.tsx", rule: REACT }],
      facts: toolCall({ paths: ["README.ts.bak", "src/b.tsx"] }),
      name: "a path the rule covers",
    },
    {
      expected: [{ reason: "ran `git commit`", rule: PROSE }],
      facts: toolCall({ command: "cd x && git commit -m y" }),
      name: "a command the rule names after a separator",
    },
    {
      expected: [{ reason: "ran `gh pr create`", rule: PROSE }],
      facts: toolCall({ command: "gh pr create --draft" }),
      name: "a command the rule names at the start",
    },
    {
      expected: [{ reason: "ran `git commit`", rule: PROSE }],
      facts: toolCall({ command: "x\n    git commit -m y" }),
      name: "a command the rule names on an indented line",
    },
    {
      expected: [{ reason: "ran `git commit`", rule: PROSE }],
      facts: toolCall({ command: "GIT_EDITOR=true git commit" }),
      name: "a command the rule names after an assignment",
    },
    {
      expected: [{ reason: "ran `git commit`", rule: PROSE }],
      facts: toolCall({ command: "if true; then git commit; fi" }),
      name: "a command the rule names after a keyword",
    },
    {
      expected: [{ reason: "ran `git commit`", rule: PROSE }],
      facts: toolCall({ command: "{ git commit; }" }),
      name: "a command the rule names inside a group",
    },
    {
      expected: [],
      facts: toolCall({ command: 'echo "no git commits"' }),
      name: "the phrase only inside another word run",
    },
    {
      expected: [{ reason: "fired UserPromptSubmit", rule: REPLIES }],
      facts: toolCall({ event: "UserPromptSubmit" }),
      name: "an event the rule lists",
    },
    {
      expected: [],
      facts: toolCall({ command: "bun run check", paths: ["scripts/x.sh"] }),
      name: "nothing any rule names",
    },
  ])(
    "should return $expected when the call carries $name",
    ({ expected, facts }) => {
      const reaches = reachesFor([REACT, PROSE, REPLIES], facts);

      expect(reaches).toStrictEqual(expected);
    }
  );
});

describe(pointerContext, () => {
  it("should name each rule and why it applies on its own line when two rules are reached", () => {
    const reaches = [
      { reason: "reached src/b.tsx", rule: REACT },
      { reason: "ran `git commit`", rule: PROSE },
    ];

    const context = pointerContext(reaches);

    expect(context).toBe(
      ".claude/hooks/guidance/react.md applies because this session reached src/b.tsx. Read .claude/hooks/guidance/react.md completely before continuing. This hook names it once per session.\n.claude/hooks/guidance/prose.md applies because this session ran `git commit`. Read .claude/hooks/guidance/prose.md completely before continuing. This hook names it once per session."
    );
  });
});
