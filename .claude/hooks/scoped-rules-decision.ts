import path from "node:path";
import { z } from "zod";

/** A `.claude/rules/` file whose frontmatter scopes it with `paths`. */
export interface ScopedRule {
  readonly name: string;
  readonly patterns: readonly string[];
}

/** A scoped rule, and the path that brought it into scope. */
export interface Reach {
  readonly matchedPath: string;
  readonly rule: ScopedRule;
}

const OPEN = "---\n";
const CLOSE = "\n---\n";

const PATHS_KEY = "paths:";
const LIST_ITEM = /^\s+-\s+/u;
const QUOTED = /^(?<quote>["'])(?<inner>.*)\k<quote>$/u;

const unquote = (value: string): string => {
  const trimmed = value.trim();
  return QUOTED.exec(trimmed)?.groups?.inner ?? trimmed;
};

/**
 * The patterns under `paths`, in the three spellings Claude Code accepts: one
 * comma-separated string, a flow list, and a block list. Only this key is
 * read, so the `yaml` package stays out of a hook that runs around every tool
 * call, where loading it cost about 130 ms. Frontmatter that YAML itself would
 * refuse is `bun scripts/check-claude-frontmatter.entry.ts`'s to reject.
 */
const readPaths = (frontmatter: string): string[] => {
  const lines = frontmatter.split("\n");
  const at = lines.findIndex((line) => line.startsWith(PATHS_KEY));
  if (at === -1) {
    return [];
  }
  const inline = lines
    .slice(at, at + 1)
    .join("")
    .slice(PATHS_KEY.length)
    .trim();
  if (inline === "") {
    const after = lines.slice(at + 1);
    const end = after.findIndex((line) => !LIST_ITEM.test(line));
    return after
      .slice(0, end === -1 ? after.length : end)
      .map((line) => unquote(line.replace(LIST_ITEM, "")));
  }
  const flow = inline.startsWith("[") && inline.endsWith("]");
  return (flow ? inline.slice(1, -1) : unquote(inline)).split(",").map(unquote);
};

/**
 * The rule a file holds, or `undefined` where it carries no `paths`, which
 * Claude Code loads at launch and which leaves this hook nothing to point at.
 */
export const parseScopedRule = (
  name: string,
  text: string
): ScopedRule | undefined => {
  const close = text.indexOf(CLOSE, OPEN.length - 1);
  if (!text.startsWith(OPEN) || close === -1) {
    return undefined;
  }
  const patterns = readPaths(text.slice(OPEN.length, close)).flatMap(
    (pattern) => {
      const trimmed = pattern.trim();
      return trimmed === "" ? [] : [trimmed];
    }
  );
  if (patterns.length === 0) {
    return undefined;
  }
  return { name, patterns };
};

/**
 * The tools whose input names one file in `file_path`. Every other tool but
 * Bash names none this hook can read.
 */
const FILE_PATH_TOOLS = new Set([
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "Read",
  "Write",
]);

/**
 * A run of path characters ending in an extension. It reads
 * `Path("src/entities/user/index.ts")` inside a python heredoc and
 * `sed -n 1,20p src/routes/index.tsx` alike. A word it reads that names no
 * file the command opens, such as a path quoted in a grep pattern, costs one
 * pointer line and nothing more.
 */
const PATH_IN_COMMAND = /[\w.${}@~[\]/-]*\.[A-Za-z]\w*/gu;

/** The fields of a tool call's input that name a file. */
export const ToolInput = z.object({
  command: z.string().optional(),
  file_path: z.string().optional(),
});

/** The paths a tool call names, as the call wrote them. */
export const namedPaths = (
  toolName: string,
  input: z.infer<typeof ToolInput>
): string[] => {
  if (FILE_PATH_TOOLS.has(toolName)) {
    return input.file_path === undefined ? [] : [input.file_path];
  }
  if (toolName === "Bash") {
    return input.command?.match(PATH_IN_COMMAND) ?? [];
  }
  return [];
};

const PROJECT_DIR_VARIABLE =
  /^(?:\$CLAUDE_PROJECT_DIR|\$\{CLAUDE_PROJECT_DIR\})\//u;

/**
 * A path relative to the project root, which is what a rule's `paths` are
 * written against, or `undefined` where it lies outside the project. A command
 * that spells the root as `$CLAUDE_PROJECT_DIR` names a file under it.
 */
export const projectRelative = (
  written: string,
  cwd: string,
  projectDir: string
): string | undefined => {
  const expanded = written.replace(PROJECT_DIR_VARIABLE, `${projectDir}/`);
  const relative = path.relative(projectDir, path.resolve(cwd, expanded));
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    return undefined;
  }
  return relative;
};

/**
 * Each rule one of the paths brings into scope, paired with the first such
 * path, in the order the rules arrived.
 */
export const reachesFor = (
  rules: readonly ScopedRule[],
  paths: readonly string[]
): Reach[] =>
  rules.flatMap((rule) => {
    const matchedPath = paths.find((candidate) =>
      rule.patterns.some((pattern) => path.matchesGlob(candidate, pattern))
    );
    return matchedPath === undefined ? [] : [{ matchedPath, rule }];
  });

/**
 * Whether Claude Code loads the rules a call reaches on its own. It does for
 * Read, so a Read that reaches a rule first counts the rule as reached and
 * prints nothing, and a later Bash call on the same path stays quiet.
 */
export const loadsNatively = (toolName: string): boolean => toolName === "Read";

/** Only the characters a file name takes, so an id names no path elsewhere. */
const fileNameSafe = (id: string): string => id.replaceAll(/[^\w-]/gu, "");

/**
 * The prefix of one session's marker names, or `undefined` for a payload with
 * no id at all, which cannot be counted and is pointed at a rule every time. A
 * subagent carries its own `agent_id` and is counted apart from its session.
 */
export const markerPrefix = (
  sessionId: string,
  agentId: string,
  tmpDir: string
): string | undefined => {
  const session = fileNameSafe(sessionId);
  const agent = fileNameSafe(agentId);
  if (session === "" && agent === "") {
    return undefined;
  }
  return path.join(tmpDir, `claude-scoped-rules-${session}-${agent}`);
};

/** The marker that records a session reaching one rule. */
export const ruleMarker = (prefix: string, ruleName: string): string =>
  `${prefix}-${fileNameSafe(ruleName)}`;

/**
 * The marker scoped-rules.sh looks for before starting bun. It carries the
 * count of `.md` files under `.claude/rules/`, which the shell counts the same
 * way, so a rule added mid-session changes the name and bun runs again.
 */
export const completeMarker = (prefix: string, ruleFileCount: number): string =>
  `${prefix}.complete-${ruleFileCount}`;

/**
 * Whether the transcript is read for Claude Code's own loads. A subagent's
 * payload is not known to name the subagent's own transcript, so it reads
 * none, and a rule pointed at twice there costs one line.
 */
export const readsTranscript = (agentId: string): boolean => agentId === "";

/**
 * Whether Claude Code has already loaded the rule into this transcript, which
 * it records as a `nested_memory` attachment carrying the rule's display path.
 * Inside a string field the same text has its quotes escaped, so a message
 * that quotes this line does not match it.
 */
export const transcriptHoldsRule = (
  transcript: string,
  name: string
): boolean => transcript.includes(`"displayPath":".claude/rules/${name}"`);

/**
 * The additionalContext that sends the model to each rule. It names the file
 * rather than carrying its text, because Claude Code saves a hook's
 * additionalContext to a file and shows a 2 KB preview once it runs long: the
 * three rules a `.tsx` file reaches came to 43.1 KB and arrived cut, while a
 * Read of each file returns it whole.
 */
export const pointerContext = (reaches: readonly Reach[]): string =>
  reaches
    .map(
      ({ matchedPath, rule }) =>
        `This session just reached ${matchedPath}, which .claude/rules/${rule.name} covers (${rule.patterns.join(", ")}). Read .claude/rules/${rule.name} completely before continuing. This hook names it once per session.`
    )
    .join("\n");
