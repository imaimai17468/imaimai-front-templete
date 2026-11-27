// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import {
  frontmatterOutcome,
  frontmatterReport,
  frontmatterRoot,
  frontmatterText,
  guidanceTriggerProblem,
  yamlParseErrorDetail,
} from "./claude-frontmatter.ts";

const exitCodeFor = (root: string): number =>
  frontmatterOutcome(frontmatterReport(root)).exitCode;

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "claude-frontmatter-"));

const write = (root: string, relative: string, content: string): void => {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
};

const validTree = (): string => {
  const root = fs.mkdtempSync(path.join(WORK, "case-"));
  write(
    root,
    ".claude/hooks/guidance/alpha.md",
    `---
description: "scoped rule: with a colon"
paths: "src/**"
---

# Alpha
`
  );
  write(
    root,
    ".claude/agents/reviewer.md",
    `---
name: reviewer
description: "reviews code: carefully"
---

Review.
`
  );
  write(
    root,
    ".claude/skills/ticket-work/SKILL.md",
    `---
name: ticket-work
description: "step one: clarify"
---

# Ticket work
`
  );
  write(root, ".claude/skills/ticket-work/notes.md", "# not a skill\n");
  return root;
};

describe("claude-frontmatter", () => {
  afterAll(() => {
    fs.rmSync(WORK, { force: true, recursive: true });
  });

  it("should return the first line when an Error message spans multiple lines", () => {
    expect(yamlParseErrorDetail(new Error("line one\nline two"))).toBe(
      "line one"
    );
  });

  it("should stringify the value when the thrown value is not an Error", () => {
    expect(yamlParseErrorDetail("broken")).toBe("broken");
  });

  it("should parse when the description contains a quoted colon", () => {
    expect(
      frontmatterText(`---
description: "work: clarify"
---
`)
    ).toStrictEqual({ data: { description: "work: clarify" }, ok: true });
  });

  it("should report a parse error when the description contains an unquoted colon", () => {
    expect(
      frontmatterText(`---
description: work: clarify
---
`)
    ).toStrictEqual({
      detail:
        "Nested mappings are not allowed in compact mappings at line 1, column 14:",
      ok: false,
    });
  });

  it("should report no problem when every target file parses", () => {
    const root = validTree();

    expect(frontmatterReport(root)).toStrictEqual({
      files: [
        ".claude/hooks/guidance/alpha.md",
        ".claude/agents/reviewer.md",
        ".claude/skills/ticket-work/SKILL.md",
      ],
      problems: [],
    });
  });

  it("should exit zero when the tree is valid", () => {
    expect(exitCodeFor(validTree())).toBe(0);
  });

  it("should parse an empty block when the frontmatter holds nothing", () => {
    expect(frontmatterText("---\n\n---\n")).toStrictEqual({
      data: null,
      ok: true,
    });
  });

  it("should report a missing frontmatter block when the block does not open the file", () => {
    expect(
      frontmatterText("# Title\n---\ndescription: x\n---\n")
    ).toStrictEqual({
      detail: "missing opening --- frontmatter block",
      ok: false,
    });
  });

  it("should list the files in path order when one directory's name starts another's", () => {
    const root = fs.mkdtempSync(path.join(WORK, "order-"));
    write(root, ".claude/skills/a/SKILL.md", "---\nname: a\n---\n");
    write(root, ".claude/skills/a-b/SKILL.md", "---\nname: a-b\n---\n");

    expect(frontmatterReport(root).files).toStrictEqual([
      ".claude/skills/a-b/SKILL.md",
      ".claude/skills/a/SKILL.md",
    ]);
  });

  it("should fail when the tree holds no file to check", () => {
    expect(frontmatterOutcome({ files: [], problems: [] })).toStrictEqual({
      exitCode: 1,
      text: "Claude frontmatter: no rule, agent or skill file under the checked tree",
    });
  });

  it("should print the file count when the tree is valid", () => {
    expect(
      frontmatterOutcome({ files: ["a.md", "b.md"], problems: [] })
    ).toStrictEqual({ exitCode: 0, text: "claude frontmatter ok (2 files)" });
  });

  it("should print every problem and how to fix it when some files are broken", () => {
    expect(
      frontmatterOutcome({
        files: ["a.md", "b.md"],
        problems: [
          { detail: "missing opening --- frontmatter block", entry: "a.md" },
          { detail: "names no trigger", entry: "b.md" },
        ],
      })
    ).toStrictEqual({
      exitCode: 1,
      text: [
        "Claude frontmatter problems: 2",
        "  a.md: missing opening --- frontmatter block",
        "  b.md: names no trigger",
        "",
        "Quote description values that contain ': ' or wrap them in a block scalar, and give each guidance file a trigger scoped-guidance.sh answers.",
      ].join("\n"),
    });
  });

  it("should report a missing frontmatter block when the file has no opening delimiter", () => {
    expect(frontmatterText("# Title\n")).toStrictEqual({
      detail: "missing opening --- frontmatter block",
      ok: false,
    });
  });

  it("should list only markdown skill files when a skill folder also holds notes", () => {
    const root = validTree();
    write(root, ".claude/hooks/guidance/notes.txt", "plain text\n");
    write(root, ".claude/agents/config.json", "{}\n");

    expect(frontmatterReport(root).files).toStrictEqual([
      ".claude/hooks/guidance/alpha.md",
      ".claude/agents/reviewer.md",
      ".claude/skills/ticket-work/SKILL.md",
    ]);
  });

  it("should report an empty file list when the `.claude` tree is absent", () => {
    const root = fs.mkdtempSync(path.join(WORK, "empty-"));

    expect(frontmatterReport(root)).toStrictEqual({
      files: [],
      problems: [],
    });
  });

  it("should skip a subdirectory it cannot read when collecting rule files", () => {
    const root = validTree();
    const unreadable = path.join(root, ".claude/hooks/guidance/private");
    fs.mkdirSync(unreadable);
    fs.chmodSync(unreadable, 0);
    try {
      expect(frontmatterReport(root).files).toStrictEqual([
        ".claude/hooks/guidance/alpha.md",
        ".claude/agents/reviewer.md",
        ".claude/skills/ticket-work/SKILL.md",
      ]);
    } finally {
      fs.chmodSync(unreadable, 0o755);
      fs.rmSync(unreadable, { recursive: true });
    }
  });

  it("should check this repository's rules when no tree is named", () => {
    expect(frontmatterReport(frontmatterRoot([])).files).toContain(
      ".claude/hooks/guidance/prose.md"
    );
  });

  it("should check the named tree when one is named", () => {
    expect(frontmatterRoot(["some/tree"])).toBe(path.resolve("some/tree"));
  });

  it("should exit zero when the tree is this repository's", () => {
    expect(exitCodeFor(frontmatterRoot([]))).toBe(0);
  });

  it("should report a missing frontmatter block when a guidance file opens with a byte order mark", () => {
    const root = validTree();
    write(
      root,
      ".claude/hooks/guidance/marked.md",
      '\uFEFF---\npaths: "src/**"\n---\n'
    );

    expect(frontmatterReport(root).problems).toStrictEqual([
      {
        detail: "missing opening --- frontmatter block",
        entry: ".claude/hooks/guidance/marked.md",
      },
    ]);
  });

  it("should report a broken rule when its frontmatter does not parse", () => {
    const root = validTree();
    write(
      root,
      ".claude/hooks/guidance/broken.md",
      `---
description: broken: value
---
`
    );

    expect(frontmatterReport(root).problems).toStrictEqual([
      {
        detail:
          "Nested mappings are not allowed in compact mappings at line 1, column 14:",
        entry: ".claude/hooks/guidance/broken.md",
      },
    ]);
  });

  it.each([
    { data: { paths: "src/**" }, expected: undefined },
    { data: { commands: ["git commit"] }, expected: undefined },
    { data: { events: "UserPromptSubmit" }, expected: undefined },
    { data: { events: "PreToolUse, PostToolUse" }, expected: undefined },
    {
      data: { events: ["Stop", "SessionStart"] },
      expected:
        "events names Stop, SessionStart, which scoped-guidance.sh does not answer (PreToolUse, PostToolUse, UserPromptSubmit)",
    },
    {
      data: { events: "UserPromptSubmitt" },
      expected:
        "events names UserPromptSubmitt, which scoped-guidance.sh does not answer (PreToolUse, PostToolUse, UserPromptSubmit)",
    },
    {
      data: { description: "x", paths: " , " },
      expected: "names no trigger: give it paths, commands or events",
    },
    {
      data: { paths: 3 },
      expected:
        "paths, commands and events must each be a string or a list of strings",
    },
  ])(
    "should return $expected when a guidance file's frontmatter is $data",
    ({ data, expected }) => {
      expect(guidanceTriggerProblem(data)).toBe(expected);
    }
  );

  it("should report a guidance file that names no trigger when the report runs", () => {
    const root = validTree();
    write(root, ".claude/hooks/guidance/idle.md", "---\ndescription: x\n---\n");

    expect(frontmatterReport(root).problems).toStrictEqual([
      {
        detail: "names no trigger: give it paths, commands or events",
        entry: ".claude/hooks/guidance/idle.md",
      },
    ]);
  });

  it("should exit one when the tree holds broken frontmatter", () => {
    const root = validTree();
    write(
      root,
      ".claude/hooks/guidance/broken.md",
      `---
description: broken: value
---
`
    );

    expect(exitCodeFor(root)).toBe(1);
  });
});
