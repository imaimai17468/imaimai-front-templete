/**
 * Report `.claude/hooks/guidance/*.md`, `.claude/agents/*.md`, and each
 * `.claude/skills/.../SKILL.md` file whose YAML frontmatter does not parse,
 * and each guidance file whose triggers would never reach a session.
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { HOOK_EVENTS } from "../.claude/hooks/scoped-guidance-decision";

const REPO = path.resolve(import.meta.dirname, "..");

const FRONTMATTER = /^---\r?\n(?<body>[\s\S]*?)\r?\n---/u;

const TARGETS = [
  ".claude/hooks/guidance",
  ".claude/agents",
  ".claude/skills",
] as const;

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
): { data: unknown; ok: true } | { detail: string; ok: false } => {
  const match = FRONTMATTER.exec(content);
  const body = match?.groups?.body;
  if (body === undefined) {
    return { detail: "missing opening --- frontmatter block", ok: false };
  }
  try {
    return { data: parse(body), ok: true };
  } catch (error) {
    return { detail: yamlParseErrorDetail(error), ok: false };
  }
};

const GUIDANCE_DIR = ".claude/hooks/guidance/";

const TriggerList = z
  .union([z.string().transform((list) => list.split(",")), z.array(z.string())])
  .default([])
  .transform((items) =>
    items.flatMap((item) => (item.trim() === "" ? [] : [item.trim()]))
  );

const GuidanceTriggers = z.object({
  commands: TriggerList,
  events: TriggerList,
  paths: TriggerList,
});

/**
 * Why a guidance file would never reach a session, or `undefined` where it
 * would. scoped-guidance.sh drops an event name it does not answer and skips a
 * file that names no trigger without a word, so this check is where either
 * mistake is reported.
 */
export const guidanceTriggerProblem = (data: unknown): string | undefined => {
  const triggers = GuidanceTriggers.safeParse(data);
  if (!triggers.success) {
    return "paths, commands and events must each be a string or a list of strings";
  }
  const { commands, events, paths } = triggers.data;
  const unanswered = events.filter(
    (event) => !HOOK_EVENTS.some((answered) => answered === event)
  );
  if (unanswered.length > 0) {
    return `events names ${unanswered.join(", ")}, which scoped-guidance.sh does not answer (${HOOK_EVENTS.join(", ")})`;
  }
  if (commands.length + events.length + paths.length === 0) {
    return "names no trigger: give it paths, commands or events";
  }
  return undefined;
};

const problemFor = (entry: string, content: string): string | undefined => {
  const parsed = frontmatterText(content);
  if (!parsed.ok) {
    return parsed.detail;
  }
  return entry.startsWith(GUIDANCE_DIR)
    ? guidanceTriggerProblem(parsed.data)
    : undefined;
};

export interface FrontmatterReport {
  readonly files: readonly string[];
  readonly problems: readonly FrontmatterProblem[];
}

export const frontmatterReport = (root: string): FrontmatterReport => {
  const files = frontmatterFiles(root);
  const problems = files.flatMap((entry) => {
    const absolute = path.join(root, entry);
    const detail = problemFor(entry, fs.readFileSync(absolute, "utf-8"));
    return detail === undefined ? [] : [{ detail, entry }];
  });
  return { files, problems };
};

export const main = (argv: readonly string[]): number => {
  const { files, problems } = frontmatterReport(path.resolve(argv[0] ?? REPO));
  if (problems.length > 0) {
    console.log(
      [
        `Claude frontmatter problems: ${problems.length}`,
        ...problems.map(({ detail, entry }) => `  ${entry}: ${detail}`),
        "",
        "Quote description values that contain ': ' or wrap them in a block scalar, and give each guidance file a trigger scoped-guidance.sh answers.",
      ].join("\n")
    );
    return 1;
  }
  console.log(`claude frontmatter ok (${files.length} files)`);
  return 0;
};
