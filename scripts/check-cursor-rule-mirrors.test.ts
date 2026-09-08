// @vitest-environment node

/**
 * Exercise check-cursor-rule-mirrors.ts against the arrangements it must judge.
 *
 * Each case builds real files and real symlinks under a temp directory, then
 * breaks the arrangement one way. A fixture made of plain data would not reach
 * the decision this checker rests on, which the checker's own comment on
 * `withFileTypes` states.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { main, mirrorReport } from "./check-cursor-rule-mirrors";

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-rule-mirrors-"));
const RULE_NAMES = ["alpha", "beta"];

const rule = (root: string, name: string): string =>
  path.join(root, `.claude/rules/${name}.md`);

const mirror = (root: string, name: string): string =>
  path.join(root, `.cursor/rules/${name}.mdc`);

/** A tree with two rules, each mirrored the way AGENTS.md requires. */
const mirroredTree = (): string => {
  const root = fs.mkdtempSync(path.join(WORK, "case-"));
  fs.mkdirSync(path.join(root, ".claude/rules"), { recursive: true });
  fs.mkdirSync(path.join(root, ".cursor/rules"), { recursive: true });
  RULE_NAMES.forEach((name) => {
    fs.writeFileSync(rule(root, name), `# ${name}\n`);
    fs.symlinkSync(`../../.claude/rules/${name}.md`, mirror(root, name));
  });
  return root;
};

describe("check-cursor-rule-mirrors", () => {
  afterAll(() => {
    fs.rmSync(WORK, { force: true, recursive: true });
  });

  it("should report no problem when every rule is mirrored by a symlink to it", () => {
    const root = mirroredTree();

    expect(mirrorReport(root)).toStrictEqual({
      problems: [],
      rules: ["alpha", "beta"],
    });
  });

  it("should report the mirror when a symlink was replaced by a copy of the rule", () => {
    const root = mirroredTree();

    fs.rmSync(mirror(root, "alpha"));
    fs.copyFileSync(rule(root, "alpha"), mirror(root, "alpha"));

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail: "not a symlink to ../../.claude/rules/alpha.md",
          entry: ".cursor/rules/alpha.mdc",
        },
      ],
      rules: ["alpha", "beta"],
    });
  });

  it("should report the mirror when it links to another rule", () => {
    const root = mirroredTree();

    fs.rmSync(mirror(root, "alpha"));
    fs.symlinkSync("../../.claude/rules/beta.md", mirror(root, "alpha"));

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail:
            "links to ../../.claude/rules/beta.md instead of ../../.claude/rules/alpha.md",
          entry: ".cursor/rules/alpha.mdc",
        },
      ],
      rules: ["alpha", "beta"],
    });
  });

  it("should report the mirror when its link reaches the rule by a detour", () => {
    const root = mirroredTree();

    fs.rmSync(mirror(root, "alpha"));
    fs.symlinkSync(
      "../../.claude/rules/../rules/alpha.md",
      mirror(root, "alpha")
    );

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail:
            "links to ../../.claude/rules/../rules/alpha.md instead of ../../.claude/rules/alpha.md",
          entry: ".cursor/rules/alpha.mdc",
        },
      ],
      rules: ["alpha", "beta"],
    });
  });

  it("should report the mirror when its link is absolute", () => {
    const root = mirroredTree();

    fs.rmSync(mirror(root, "alpha"));
    fs.symlinkSync(rule(root, "alpha"), mirror(root, "alpha"));

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail: `links to ${rule(root, "alpha")} instead of ../../.claude/rules/alpha.md`,
          entry: ".cursor/rules/alpha.mdc",
        },
      ],
      rules: ["alpha", "beta"],
    });
  });

  it("should report the mirror when its link text matches but resolves to nothing", () => {
    const root = fs.mkdtempSync(path.join(WORK, "case-"));
    fs.mkdirSync(path.join(root, ".claude/rules"), { recursive: true });
    fs.mkdirSync(path.join(root, "nested/.cursor/rules"), { recursive: true });
    fs.writeFileSync(rule(root, "alpha"), "# alpha\n");
    fs.symlinkSync(
      "../../.claude/rules/alpha.md",
      path.join(root, "nested/.cursor/rules/alpha.mdc")
    );

    fs.symlinkSync("nested/.cursor", path.join(root, ".cursor"));

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail:
            "links to ../../.claude/rules/alpha.md, which resolves to nothing",
          entry: ".cursor/rules/alpha.mdc",
        },
      ],
      rules: ["alpha"],
    });
  });

  it("should report a subdirectory when either rules directory holds one", () => {
    const root = mirroredTree();

    fs.mkdirSync(path.join(root, ".claude/rules/sub"));
    fs.mkdirSync(path.join(root, ".cursor/rules/sub"));

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail:
            "a directory, and only the files directly in .claude/rules are read",
          entry: ".claude/rules/sub",
        },
        {
          detail:
            "a directory, and only the files directly in .cursor/rules are read",
          entry: ".cursor/rules/sub",
        },
      ],
      rules: ["alpha", "beta"],
    });
  });

  it("should report the missing mirror when a rule was added without one", () => {
    const root = mirroredTree();

    fs.writeFileSync(rule(root, "gamma"), "# gamma\n");

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail: "missing: add a symlink to ../../.claude/rules/gamma.md",
          entry: ".cursor/rules/gamma.mdc",
        },
      ],
      rules: ["alpha", "beta", "gamma"],
    });
  });

  it("should report the mirror when the rule it links to was deleted", () => {
    const root = mirroredTree();

    fs.rmSync(rule(root, "alpha"));

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail: "no .claude/rules/alpha.md exists for it to mirror",
          entry: ".cursor/rules/alpha.mdc",
        },
      ],
      rules: ["beta"],
    });
  });

  it("should report every rule when the mirror directory is gone", () => {
    const root = mirroredTree();

    fs.rmSync(path.join(root, ".cursor/rules"), { recursive: true });

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail: "missing: add a symlink to ../../.claude/rules/alpha.md",
          entry: ".cursor/rules/alpha.mdc",
        },
        {
          detail: "missing: add a symlink to ../../.claude/rules/beta.md",
          entry: ".cursor/rules/beta.mdc",
        },
      ],
      rules: ["alpha", "beta"],
    });
  });

  it("should report the rule directory when it holds no rule", () => {
    const root = mirroredTree();

    fs.rmSync(path.join(root, ".claude/rules"), { recursive: true });

    expect(mirrorReport(root)).toStrictEqual({
      problems: [
        {
          detail: "holds no rule, so this check compares nothing",
          entry: ".claude/rules",
        },
        {
          detail: "no .claude/rules/alpha.md exists for it to mirror",
          entry: ".cursor/rules/alpha.mdc",
        },
        {
          detail: "no .claude/rules/beta.md exists for it to mirror",
          entry: ".cursor/rules/beta.mdc",
        },
      ],
      rules: [],
    });
  });

  it("should exit non-zero when a mirror is a copy of its rule", () => {
    const root = mirroredTree();

    fs.rmSync(mirror(root, "alpha"));
    fs.copyFileSync(rule(root, "alpha"), mirror(root, "alpha"));

    expect(main([root])).toBe(1);
  });

  it("should exit zero when every mirror is a symlink to its rule", () => {
    const root = mirroredTree();

    expect(main([root])).toBe(0);
  });

  it("should exit zero when this repository's own mirrors are in sync", () => {
    expect(main([])).toBe(0);
  });
});
