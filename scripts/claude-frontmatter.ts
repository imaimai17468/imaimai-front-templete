/**
 * Report `.claude/rules/*.md`, `.claude/agents/*.md`, and each
 * `.claude/skills/.../SKILL.md` file whose YAML frontmatter does not parse.
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const REPO = path.resolve(import.meta.dirname, "..");

const FRONTMATTER = /^---\r?\n(?<body>[\s\S]*?)\r?\n---/u;

const TARGETS = [".claude/rules", ".claude/agents", ".claude/skills"] as const;

export interface FrontmatterProblem {
  readonly detail: string;
  readonly entry: string;
}

const readEntries = (dir: string): fs.Dirent[] => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

const collectMarkdownFile = (
  root: string,
  relative: string,
  entryPath: string,
  entryName: string
): readonly string[] => {
  if (!entryName.endsWith(".md")) {
    return [];
  }
  if (relative === ".claude/skills" && entryName !== "SKILL.md") {
    return [];
  }
  return [path.relative(root, entryPath)];
};

/** Every markdown file this check reads under one `.claude` subtree. */
const markdownFilesUnder = (root: string, relative: string): string[] => {
  const walk = (dir: string): readonly string[] =>
    readEntries(dir).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(entryPath);
      }
      return collectMarkdownFile(root, relative, entryPath, entry.name);
    });

  return [...walk(path.join(root, relative))].toSorted();
};

export const frontmatterFiles = (root: string): readonly string[] =>
  TARGETS.flatMap((relative) => markdownFilesUnder(root, relative));

export const yamlParseErrorDetail = (error: unknown): string => {
  if (error instanceof Error) {
    const [firstLine = error.message] = error.message.split("\n");
    return firstLine;
  }
  return String(error);
};

export const frontmatterText = (
  content: string
): { ok: true } | { detail: string; ok: false } => {
  const match = FRONTMATTER.exec(content);
  const body = match?.groups?.body;
  if (body === undefined) {
    return { detail: "missing opening --- frontmatter block", ok: false };
  }
  try {
    parse(body);
    return { ok: true };
  } catch (error) {
    return { detail: yamlParseErrorDetail(error), ok: false };
  }
};

export interface FrontmatterReport {
  readonly files: readonly string[];
  readonly problems: readonly FrontmatterProblem[];
}

export const frontmatterReport = (root: string): FrontmatterReport => {
  const files = frontmatterFiles(root);
  const problems = files.flatMap((entry) => {
    const absolute = path.join(root, entry);
    const content = fs.readFileSync(absolute, "utf-8");
    const parsed = frontmatterText(content);
    return parsed.ok ? [] : [{ detail: parsed.detail, entry }];
  });
  return { files, problems };
};

export const main = (argv: readonly string[]): number => {
  const { files, problems } = frontmatterReport(path.resolve(argv[0] ?? REPO));
  if (problems.length > 0) {
    console.log(
      [
        `Claude frontmatter parse errors: ${problems.length}`,
        ...problems.map(({ detail, entry }) => `  ${entry}: ${detail}`),
        "",
        "Quote description values that contain ': ' or wrap them in a block scalar.",
      ].join("\n")
    );
    return 1;
  }
  console.log(`claude frontmatter ok (${files.length} files)`);
  return 0;
};
