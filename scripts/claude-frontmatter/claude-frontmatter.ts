/**
 * Report `.claude/hooks/guidance/*.md`, `.claude/agents/*.md`, and each
 * `.claude/skills/.../SKILL.md` file whose YAML frontmatter does not parse,
 * and each guidance file whose triggers would never reach a session.
 */

import fs from "node:fs";
import path from "node:path";
import { Effect, Predicate, Result, Schema } from "effect";
import { parse } from "yaml";
import { HOOK_EVENTS } from "../../.claude/hooks/scoped-guidance/scoped-guidance-decision.ts";

const REPO = path.resolve(import.meta.dirname, "../..");

/** The tree the check reads: the one `argv` names, or this repository. */
export const frontmatterRoot = (argv: readonly string[]): string =>
  path.resolve(argv[0] ?? REPO);

/**
 * Reads a file as UTF-8 with any byte order mark left in place, so a file
 * whose frontmatter a byte order mark pushes off the first line is reported.
 */
const UTF8_KEEPING_BOM = new TextDecoder("utf-8", { ignoreBOM: true });

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

const TriggerList = Schema.Union([
  Schema.String,
  Schema.Array(Schema.String),
]).pipe(Schema.withDecodingDefault(Effect.succeed([])));

/** The triggers a frontmatter field names, as a list or one comma-joined string. */
const triggersIn = (field: string | readonly string[]): readonly string[] =>
  (Predicate.isString(field) ? field.split(",") : field).flatMap((item) =>
    item.trim() === "" ? [] : [item.trim()]
  );

const decodeGuidanceTriggers = Schema.decodeUnknownResult(
  Schema.Struct({
    commands: TriggerList,
    events: TriggerList,
    paths: TriggerList,
  })
);

/**
 * Why a guidance file would never reach a session, or `undefined` where it
 * would. scoped-guidance.sh drops an event name it does not answer and skips a
 * file that names no trigger without a word, so this check is where either
 * mistake is reported.
 */
export const guidanceTriggerProblem = (data: unknown): string | undefined => {
  const triggers = decodeGuidanceTriggers(data);
  if (Result.isFailure(triggers)) {
    return "paths, commands and events must each be a string or a list of strings";
  }
  const commands = triggersIn(triggers.success.commands);
  const events = triggersIn(triggers.success.events);
  const paths = triggersIn(triggers.success.paths);
  const unanswered = events.filter(
    (event) => !HOOK_EVENTS.some((answered) => answered === event)
  );
  if (unanswered.length > 0) {
    return `events names ${unanswered.join(", ")}, which scoped-guidance.sh does not answer (${HOOK_EVENTS.join(", ")})`;
  }
  if (
    [commands, events, paths].every((triggerList) => triggerList.length === 0)
  ) {
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
    const content = UTF8_KEEPING_BOM.decode(fs.readFileSync(absolute));
    const detail = problemFor(entry, content);
    return detail === undefined ? [] : [{ detail, entry }];
  });
  return { files, problems };
};

export interface FrontmatterOutcome {
  readonly exitCode: 0 | 1;
  readonly text: string;
}

/** What the check prints for `report`, and the code it exits with. */
export const frontmatterOutcome = ({
  files,
  problems,
}: FrontmatterReport): FrontmatterOutcome =>
  problems.length > 0
    ? {
        exitCode: 1,
        text: [
          `Claude frontmatter problems: ${problems.length}`,
          ...problems.map(({ detail, entry }) => `  ${entry}: ${detail}`),
          "",
          "Quote description values that contain ': ' or wrap them in a block scalar, and give each guidance file a trigger scoped-guidance.sh answers.",
        ].join("\n"),
      }
    : { exitCode: 0, text: `claude frontmatter ok (${files.length} files)` };
