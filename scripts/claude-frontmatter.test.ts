// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import {
  frontmatterReport,
  frontmatterText,
  main,
  yamlParseErrorDetail,
} from "./claude-frontmatter";

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
    ".claude/rules/alpha.md",
    `---
description: "scoped rule: with a colon"
alwaysApply: true
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
    ).toStrictEqual({ ok: true });
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
        ".claude/rules/alpha.md",
        ".claude/agents/reviewer.md",
        ".claude/skills/ticket-work/SKILL.md",
      ],
      problems: [],
    });
  });

  it("should exit zero when main is called on a valid tree", () => {
    expect(main([validTree()])).toBe(0);
  });

  it("should report a missing frontmatter block when the file has no opening delimiter", () => {
    expect(frontmatterText("# Title\n")).toStrictEqual({
      detail: "missing opening --- frontmatter block",
      ok: false,
    });
  });

  it("should list only markdown skill files when a skill folder also holds notes", () => {
    const root = validTree();
    write(root, ".claude/rules/notes.txt", "plain text\n");
    write(root, ".claude/agents/config.json", "{}\n");

    expect(frontmatterReport(root).files).toStrictEqual([
      ".claude/rules/alpha.md",
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
    const unreadable = path.join(root, ".claude/rules/private");
    fs.mkdirSync(unreadable);
    fs.chmodSync(unreadable, 0);
    try {
      expect(frontmatterReport(root).files).toStrictEqual([
        ".claude/rules/alpha.md",
        ".claude/agents/reviewer.md",
        ".claude/skills/ticket-work/SKILL.md",
      ]);
    } finally {
      fs.chmodSync(unreadable, 0o755);
      fs.rmSync(unreadable, { recursive: true });
    }
  });

  it("should exit zero when main is called without a root argument on this repository", () => {
    expect(main([])).toBe(0);
  });

  it("should report a broken rule when its frontmatter does not parse", () => {
    const root = validTree();
    write(
      root,
      ".claude/rules/broken.md",
      `---
description: broken: value
---
`
    );

    expect(frontmatterReport(root).problems).toStrictEqual([
      {
        detail:
          "Nested mappings are not allowed in compact mappings at line 1, column 14:",
        entry: ".claude/rules/broken.md",
      },
    ]);
  });

  it("should exit one when main is called on a tree with broken frontmatter", () => {
    const root = validTree();
    write(
      root,
      ".claude/rules/broken.md",
      `---
description: broken: value
---
`
    );

    expect(main([root])).toBe(1);
  });
});
