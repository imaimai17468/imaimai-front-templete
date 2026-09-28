import path from "node:path";
import { z } from "zod";

/** The hook events this hook answers. */
export const HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

/**
 * A `.claude/hooks/guidance/` file and what brings it into a session: a file
 * its `paths` cover, a command its `commands` name, or an event its `events`
 * list.
 */
export interface ScopedRule {
  readonly commands: readonly string[];
  readonly events: readonly HookEvent[];
  readonly name: string;
  readonly patterns: readonly string[];
}

/** A rule a call brought into scope, and what the session did to bring it. */
export interface Reach {
  readonly reason: string;
  readonly rule: ScopedRule;
}

/** What one hook call did, as far as a rule's triggers read it. */
export interface CallFacts {
  readonly command: string;
  readonly event: HookEvent;
  readonly paths: readonly string[];
}

const OPEN = "---\n";
const CLOSE = "\n---\n";

const LIST_ITEM = /^\s+-\s+/u;
const QUOTED = /^(?<quote>["'])(?<inner>.*)\k<quote>$/u;

const unquote = (value: string): string => {
  const trimmed = value.trim();
  return QUOTED.exec(trimmed)?.groups?.inner ?? trimmed;
};

const blockItems = (after: readonly string[]): string[] => {
  const end = after.findIndex((line) => !LIST_ITEM.test(line));
  return after
    .slice(0, end === -1 ? after.length : end)
    .map((line) => unquote(line.replace(LIST_ITEM, "")));
};

const inlineItems = (inline: string): string[] => {
  const flow = inline.startsWith("[") && inline.endsWith("]");
  return (flow ? inline.slice(1, -1) : unquote(inline)).split(",").map(unquote);
};

/**
 * The items under one frontmatter key, in three spellings: one
 * comma-separated string, a flow list, and a block list. Only these keys are
 * read, so the `yaml` package stays out of a hook that runs around every tool
 * call, where loading it cost about 130 ms. Frontmatter that YAML itself would
 * refuse is `bun scripts/check-claude-frontmatter.entry.ts`'s to reject.
 */
const readList = (frontmatter: string, key: string): string[] => {
  const prefix = `${key}:`;
  const lines = frontmatter.split("\n");
  const at = lines.findIndex((line) => line.startsWith(prefix));
  if (at === -1) {
    return [];
  }
  const inline = lines
    .slice(at, at + 1)
    .join("")
    .slice(prefix.length)
    .trim();
  const items =
    inline === "" ? blockItems(lines.slice(at + 1)) : inlineItems(inline);
  return items.flatMap((item) => (item === "" ? [] : [item]));
};

const isHookEvent = (value: string): value is HookEvent =>
  HOOK_EVENTS.some((event) => event === value);

/**
 * The rule a file holds, or `undefined` where its frontmatter names no
 * trigger, which leaves this hook nothing to point at. An event name this hook
 * does not answer is dropped rather than read as a trigger.
 */
export const parseScopedRule = (
  name: string,
  text: string
): ScopedRule | undefined => {
  const close = text.indexOf(CLOSE, OPEN.length - 1);
  if (!text.startsWith(OPEN) || close === -1) {
    return undefined;
  }
  const frontmatter = text.slice(OPEN.length, close);
  const rule = {
    commands: readList(frontmatter, "commands"),
    events: readList(frontmatter, "events").filter(isHookEvent),
    name,
    patterns: readList(frontmatter, "paths"),
  };
  if (rule.commands.length + rule.events.length + rule.patterns.length === 0) {
    return undefined;
  }
  return rule;
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

const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/**
 * Whether the command runs the phrase as a command of its own: at the start of
 * a line, after a separator, a `{`, or a `then`, `do`, `else` or `time`
 * keyword, past any indentation and `VAR=value` assignments, and followed by
 * an argument, a separator or the end. `git commit` matches `cd x && git commit -m y` and
 * `GIT_EDITOR=true git commit`, and not `echo "no git commits"`.
 */
const runsPhrase = (command: string, phrase: string): boolean =>
  new RegExp(
    String.raw`(?:^|[;&|({]|\b(?:then|do|else|time)\b)\s*(?:\w+=\S*\s+)*${escapeRegExp(phrase)}(?:[\s;&|)}]|$)`,
    "mu"
  ).test(command);

const reasonFor = (rule: ScopedRule, facts: CallFacts): string | undefined => {
  if (rule.events.includes(facts.event)) {
    return `fired ${facts.event}`;
  }
  const matchedPath = facts.paths.find((candidate) =>
    rule.patterns.some((pattern) => path.matchesGlob(candidate, pattern))
  );
  if (matchedPath !== undefined) {
    return `reached ${matchedPath}`;
  }
  const phrase = rule.commands.find((candidate) =>
    runsPhrase(facts.command, candidate)
  );
  return phrase === undefined ? undefined : `ran \`${phrase}\``;
};

/** Each rule the call brings into scope, in the order the rules arrived. */
export const reachesFor = (
  rules: readonly ScopedRule[],
  facts: CallFacts
): Reach[] =>
  rules.flatMap((rule) => {
    const reason = reasonFor(rule, facts);
    return reason === undefined ? [] : [{ reason, rule }];
  });

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
  return path.join(tmpDir, `claude-scoped-guidance-${session}-${agent}`);
};

/** The marker that records a session reaching one rule. */
export const ruleMarker = (prefix: string, ruleName: string): string =>
  `${prefix}-${fileNameSafe(ruleName)}`;

/**
 * The marker scoped-guidance.sh looks for before starting bun. It carries the
 * count of `.md` files under `.claude/hooks/guidance/`, which the shell counts the same
 * way, so a rule added mid-session changes the name and bun runs again.
 */
export const completeMarker = (prefix: string, ruleFileCount: number): string =>
  `${prefix}.complete-${ruleFileCount}`;

/**
 * The rules a session has to reach before it counts as complete. A subagent
 * receives no prompt of its own, so a rule that only a `UserPromptSubmit`
 * brings in would hold its count open forever and keep bun starting on every
 * one of its tool calls.
 */
export const rulesCountedForCompletion = (
  rules: readonly ScopedRule[],
  agentId: string
): ScopedRule[] =>
  rules.filter(
    (rule) =>
      agentId === "" ||
      rule.patterns.length > 0 ||
      rule.commands.length > 0 ||
      rule.events.some((event) => event !== "UserPromptSubmit")
  );

/**
 * The additionalContext that sends the model to each rule. It names the file
 * rather than carrying its text, because Claude Code saves a long
 * additionalContext to a file and shows a 2 KB preview: the three rules a
 * `.tsx` file reaches came to 43.1 KB and arrived cut, while a Read of each
 * file returns it whole.
 */
export const pointerContext = (reaches: readonly Reach[]): string =>
  reaches
    .map(
      ({ reason, rule }) =>
        `.claude/hooks/guidance/${rule.name} applies because this session ${reason}. Read .claude/hooks/guidance/${rule.name} completely before continuing. This hook names it once per session.`
    )
    .join("\n");
