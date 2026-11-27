/**
 * Whether a Bash command names one of the protected env files anywhere but in
 * the prose of a `git` or `gh` command: as a file operand, inside an
 * interpreter's inline code (`node -e "...readFileSync('.env')"`), as a flag's
 * value (`bun --env-file=.env`), or behind the `@` that `curl -d` uploads.
 */

export type GuardDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "refuse"; readonly reason: string };

/**
 * A protected env file named as a word of its own, as a flag's value, or as a
 * path's last component. macOS opens `.ENV` as `.env`, so case is ignored.
 */
const NAMED_ENV_FILE =
  /(?:^|[\s"'`=@{}:,;&|<>(/-])\.env(?:\.(?:local|development|production))?(?=[\s"'`{}:,;&|<>)*]|$)/iu;

/**
 * A heredoc from its operator through its terminator line. A `<<<` here-string
 * is not one, and a heredoc may have no body lines at all.
 */
const HEREDOC =
  /(?<!<)<<-?[ \t]*(?<quote>["']?)(?<delimiter>[\w.-]+)\k<quote>(?<tail>[^\n]*)\n(?<body>(?:[^\n]*\n)*?)[ \t]*\k<delimiter>(?=\n|$)/gu;

const BODY_OPEN = "\uE000";
const BODY_CLOSE = "\uE001";

/**
 * The heredoc rewritten onto its operator's line, with its body between the
 * two markers, so the body stays in the simple command it feeds.
 */
const HEREDOC_ON_ONE_LINE = `<<$<quote>$<delimiter>$<quote>$<tail> ${BODY_OPEN}$<body>${BODY_CLOSE} $<delimiter>`;

/**
 * A marked heredoc body that holds text, a quoted span, an escaped character,
 * or any other single character. A quote that never closes is a token of its
 * own.
 */
const SHELL_TOKEN =
  /\uE000[^\uE001]+\uE001|'[^']*'|"(?:\\[\s\S]|[^"\\])*"|\\[\s\S]|[\s\S]/gu;

/**
 * The characters that end a simple command. `&&` and `||` are two of them in
 * a row, and the empty command between the two names no file.
 */
const CONTROL_OPERATORS: ReadonlySet<string> = new Set([";", "&", "|", "\n"]);

/** A shell command cannot carry a NUL byte, so a split at one lands only where an operator stood. */
const COMMAND_BOUNDARY = "\u0000";

/**
 * A simple command running `git` or `gh`, whose arguments carry prose, such
 * as a commit message or a pull request body, where naming the file is not
 * reading it.
 */
const PROSE_COMMAND = /^\s*(?:gh|git)(?!\S)/u;

/**
 * A heredoc body that holds text, or a quoted span, that may be prose. A
 * double-quoted span holding `$`, a backtick or a backslash runs or decodes
 * something first, so it never is.
 */
const QUOTED_SPAN = /\uE000[^\uE001]+\uE001|'[^']*'|"[^"$`\\]*"/gu;

/** A path rarely holds a blank, so `git add '.env'` is still checked. */
const proseRemoved = (span: string): string => (/\s/u.test(span) ? " " : span);

const REFUSAL =
  "PreToolUse(Bash): this command names a protected env file (.env, .env.local, .env.development or .env.production), which holds the local secrets. Take the documented placeholder values from scripts/setup/placeholders.dotenv instead. A `git` or `gh` command may name the file in a quoted commit message or pull request body that holds a blank, or in a heredoc it reads.";

/** The simple commands a command line runs, split at each unquoted control operator. */
const simpleCommands = (command: string): string[] =>
  Array.from(
    command.replaceAll(HEREDOC, HEREDOC_ON_ONE_LINE).matchAll(SHELL_TOKEN),
    ([token]) => (CONTROL_OPERATORS.has(token) ? COMMAND_BOUNDARY : token)
  )
    .join("")
    .split(COMMAND_BOUNDARY);

/**
 * The text as the shell hands it to the program, with its backslashes dropped
 * and then its quotes as well, which turns `.e\nv` and `.en"v"` into `.env`.
 * No match holds a backslash, so dropping one never hides a match.
 */
const spellings = (text: string): readonly string[] => {
  const unescaped = text.replaceAll("\\", "");
  return [unescaped, unescaped.replaceAll(/["']/gu, "")];
};

const namesEnvFile = (simpleCommand: string): boolean => {
  const checked = PROSE_COMMAND.test(simpleCommand)
    ? simpleCommand.replaceAll(QUOTED_SPAN, proseRemoved)
    : simpleCommand;
  return spellings(checked).some((spelling) => NAMED_ENV_FILE.test(spelling));
};

export const decideCommand = (command: string): GuardDecision =>
  simpleCommands(command).some(namesEnvFile)
    ? { kind: "refuse", reason: REFUSAL }
    : { kind: "allow" };

/**
 * What the hook prints for a command: nothing when it allows the command, and
 * a deny in the `hookSpecificOutput` shape, which both Claude Code and Cursor
 * read, when it refuses it.
 */
export const hookOutput = (command: string): string => {
  const decision = decideCommand(command);
  if (decision.kind === "allow") {
    return "";
  }
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: decision.reason,
    },
  });
};
