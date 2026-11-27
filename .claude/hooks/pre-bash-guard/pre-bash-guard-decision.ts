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
const BODY_MARKER = /[\uE000\uE001]/u;

/**
 * The heredoc rewritten onto its operator's line, with its body between the
 * two markers, so the body stays in the simple command it feeds.
 */
const HEREDOC_ON_ONE_LINE = `<<$<quote>$<delimiter>$<quote>$<tail> ${BODY_OPEN}$<body>${BODY_CLOSE} $<delimiter>`;

/** A heredoc body the rewrite marked, which holds text. */
const MARKED_BODY = /\uE000[^\uE001]+\uE001/gu;

/** One global pattern trying each source's alternatives in the order given. */
const joinAlternatives = (...sources: readonly string[]): RegExp =>
  new RegExp(sources.join("|"), "gu");

/**
 * A marked heredoc body, a quoted span, an escaped character, or any other
 * single character. A quote that never closes is a token of its own.
 */
const SHELL_TOKEN = joinAlternatives(
  MARKED_BODY.source,
  /'[^']*'|"(?:\\[\s\S]|[^"\\])*"|\\[\s\S]|[\s\S]/u.source
);

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
 * A marked heredoc body, or a quoted span, that may be prose. A double-quoted
 * span holding `$`, a backtick or a backslash runs or decodes something
 * first, so it never is.
 */
const QUOTED_SPAN = joinAlternatives(
  MARKED_BODY.source,
  /'[^']*'|"[^"$`\\]*"/u.source
);

/**
 * A double-quoted span in which a marked body is one piece, so a quote inside
 * that body does not end the span.
 */
const DOUBLE_QUOTED_OVER_BODIES = String.raw`"(?:${MARKED_BODY.source}|\\[\s\S]|[^"\\])*"`;

/**
 * A simple command's pieces: a marked body, a single- or double-quoted span,
 * an escaped character, or any other character.
 */
const SHELL_PIECE = joinAlternatives(
  MARKED_BODY.source,
  /'[^']*'/u.source,
  DOUBLE_QUOTED_OVER_BODIES,
  /\\[\s\S]|[\s\S]/u.source
);

/**
 * A double-quoted piece holding `$`, a backtick or a backslash, which the
 * shell decodes or runs before the program reads it, so it is never prose.
 */
const EXPANDING_DOUBLE_QUOTE = /^"[\s\S]*?[$`\\]/u;

/**
 * A double-quoted piece holding `$(`, `${` or a backtick, inside which the
 * shell starts pairing quotes afresh, so a quote this guard pairs from there
 * on may not be the one the shell pairs.
 */
const NESTED_QUOTING_OPENER = /^"[\s\S]*?(?:\$[({]|`)/u;

/** A path rarely holds a blank, so `git add '.env'` is still checked. */
const proseRemoved = (span: string): string => (/\s/u.test(span) ? " " : span);

/**
 * Before nested quoting opens, any piece but an expanding double quote that
 * holds a blank is quoted text, a marked body, or a blank, escaped or not, and
 * is removed. From the piece that opens it on, only the marked bodies are.
 */
const removeProse = (piece: string, isNested: boolean): string => {
  if (isNested) {
    return piece.replaceAll(MARKED_BODY, proseRemoved);
  }
  return EXPANDING_DOUBLE_QUOTE.test(piece) ? piece : proseRemoved(piece);
};

const REFUSAL =
  "PreToolUse(Bash): this command names a protected env file (.env, .env.local, .env.development or .env.production), which holds the local secrets. Take the documented placeholder values from scripts/setup/placeholders.dotenv instead. A `git` or `gh` command may name the file in a quoted commit message or pull request body that holds a blank, or in a heredoc it reads.";

const MARKER_REFUSAL =
  "PreToolUse(Bash): this command holds U+E000 or U+E001, the private-use characters this guard writes around a heredoc body, so the guard cannot tell a body it marked from text written to look like one. Remove those characters from the command.";

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

const namesEnvFile = (checked: string): boolean =>
  spellings(checked).some((spelling) => NAMED_ENV_FILE.test(spelling));

/**
 * A command other than `git` or `gh` is checked whole. A `git` or `gh`
 * command is checked twice, with its prose removed by two readings that pair
 * quotes differently. The scan pairs a quote with the next quote of its kind
 * wherever it stands, so after a span it cannot pair, such as `"$MSG"`, it
 * pairs a closing quote with an opening one and reads the text between them as
 * prose. The pairing follows the command line piece by piece, but it reads a
 * heredoc operator inside a quoted span as a heredoc. A name either reading
 * leaves outside prose is refused. Nested quoting that opens in one simple
 * command stays open for the ones that follow it.
 */
const readTextsToCheck = (command: string): string[] => {
  const pieces = simpleCommands(command).flatMap(
    (simpleCommand, commandIndex) =>
      Array.from(simpleCommand.matchAll(SHELL_PIECE), ([text]) => ({
        commandIndex,
        text,
      }))
  );
  const nestedFrom = pieces.findIndex(({ text }) =>
    NESTED_QUOTING_OPENER.test(text)
  );
  const piecesByCommand = Map.groupBy(
    pieces.map((piece, index) => ({
      ...piece,
      isNested: nestedFrom !== -1 && index >= nestedFrom,
    })),
    ({ commandIndex }) => commandIndex
  );
  return [...piecesByCommand.values()].flatMap((commandPieces) => {
    const simpleCommand = commandPieces.map(({ text }) => text).join("");
    if (!PROSE_COMMAND.test(simpleCommand)) {
      return [simpleCommand];
    }
    return [
      simpleCommand.replaceAll(QUOTED_SPAN, proseRemoved),
      commandPieces
        .map(({ isNested, text }) => removeProse(text, isNested))
        .join(""),
    ];
  });
};

export const decideCommand = (command: string): GuardDecision => {
  if (BODY_MARKER.test(command)) {
    return { kind: "refuse", reason: MARKER_REFUSAL };
  }
  return readTextsToCheck(command).some(namesEnvFile)
    ? { kind: "refuse", reason: REFUSAL }
    : { kind: "allow" };
};

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
