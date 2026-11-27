/**
 * Whether a Bash command names one of the protected env files anywhere but in
 * the prose of a `git` or `gh` subcommand that takes a message, such as
 * `git commit` or `gh pr create`: as a file operand, inside an interpreter's
 * inline code (`node -e "...readFileSync('.env')"`), as a flag's value
 * (`bun --env-file=.env`), or behind the `@` that `curl -d` uploads.
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

/**
 * A body is prose where a message command reads it as text, or a `cat` passes
 * it to one, and checked where this guard cannot place its reader in either.
 */
type BodyReading = "prose" | "checked";

const BODY_OPEN = {
  checked: "\uE002",
  prose: "\uE000",
} satisfies Record<BodyReading, string>;
const BODY_CLOSE = "\uE001";
const BODY_MARKER = /[\uE000-\uE002]/u;

/**
 * The heredoc rewritten onto its operator's line, with its body between two
 * markers, so the body stays in the simple command it feeds.
 */
const writeOnOneLine = (reading: BodyReading): string =>
  `<<$<quote>$<delimiter>$<quote>$<tail> ${BODY_OPEN[reading]}$<body>${BODY_CLOSE} $<delimiter>`;

/** A heredoc body the rewrite marked, which holds text. */
const MARKED_BODY = /[\uE000\uE002][^\uE001]+\uE001/gu;

/** A marked body that may be prose. */
const PROSE_BODY = /\uE000[^\uE001]+\uE001/gu;

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

/** A simple command running `git` or `gh`. */
const GIT_OR_GH_COMMAND = /^\s*(?:gh|git)(?!\S)/u;

/**
 * A word the shell passes on as exactly one argument: nothing it expands,
 * globs or redirects outside quotes, and nothing it expands inside double
 * quotes.
 */
const LITERAL_WORD = /(?:[\w%+,./:=@~-]|'[^']*'|"[^"$`\\]*")+/u.source;

const GIT_GLOBAL_FLAGS = [
  "-p",
  "--paginate",
  "-P",
  "--no-pager",
  "--bare",
  "--no-replace-objects",
  "--no-lazy-fetch",
  "--no-optional-locks",
  "--no-advice",
  "--literal-pathspecs",
  "--glob-pathspecs",
  "--noglob-pathspecs",
  "--icase-pathspecs",
];

const GIT_GLOBAL_OPTIONS_WITH_VALUE = ["-C", "-c"];

const GIT_GLOBAL_OPTIONS_WITH_JOINED_VALUE = [
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--config-env",
  "--attr-source",
];

/** The `git` subcommands that take a message (`-m` or `-F`). */
const GIT_MESSAGE_SUBCOMMANDS = [
  ["commit"],
  ["tag"],
  ["merge"],
  ["notes", "add"],
  ["notes", "append"],
  ["stash", "push"],
];

/**
 * The `gh` subcommands that take a message (`--body`, `--title`, `--comment`,
 * `--subject` or `--notes`). `gh release create` is left out because it
 * uploads the files its arguments name, and a `#` label makes a blank in one
 * ordinary.
 */
const GH_MESSAGE_SUBCOMMANDS = [
  ...["create", "edit", "comment", "close", "reopen"].flatMap((action) => [
    ["pr", action],
    ["issue", action],
  ]),
  ["pr", "review"],
  ["pr", "merge"],
  ["release", "edit"],
];

/**
 * A blank the shell splits words at, a space or a tab. `\s` also takes in a
 * vertical tab, a form feed, a carriage return and a no-break space, which the
 * shell keeps inside a word.
 */
const SHELL_BLANK = /[ \t]/u.source;

/** The end of a word: no character follows that the shell keeps in it. */
const WORD_END = /(?![^ \t])/u.source;

/** The `u` flag, read off a literal so the patterns built from sources carry it as the literals here do. */
const UNICODE_FLAG = /(?:)/u.flags;

const alternation = (sources: readonly string[]): string =>
  `(?:${sources.join("|")})`;

const subcommandAlternation = (
  subcommands: readonly (readonly string[])[]
): string =>
  alternation(subcommands.map((words) => words.join(`${SHELL_BLANK}+`)));

/**
 * A simple command running a `git` subcommand that takes a message, with the
 * global options before the subcommand in the first group. A global option is
 * one git documents, and its value a literal word, and only a space or a tab
 * separates two words, so the subcommand this finds is the one git runs.
 */
const GIT_MESSAGE_COMMAND = new RegExp(
  String.raw`^${SHELL_BLANK}*git((?:${SHELL_BLANK}+${alternation([
    ...GIT_GLOBAL_FLAGS,
    ...GIT_GLOBAL_OPTIONS_WITH_VALUE.map(
      (name) => `${name}${SHELL_BLANK}+${LITERAL_WORD}`
    ),
    ...GIT_GLOBAL_OPTIONS_WITH_JOINED_VALUE.map(
      (name) => `${name}=${LITERAL_WORD}`
    ),
  ])})*)${SHELL_BLANK}+${subcommandAlternation(GIT_MESSAGE_SUBCOMMANDS)}${WORD_END}`,
  UNICODE_FLAG
);

/**
 * A simple command running a `gh` subcommand that takes a message. `gh` has
 * no global options, so its first group is always empty.
 */
const GH_MESSAGE_COMMAND = new RegExp(
  `^${SHELL_BLANK}*gh()${SHELL_BLANK}+${subcommandAlternation(GH_MESSAGE_SUBCOMMANDS)}${WORD_END}`,
  UNICODE_FLAG
);

/**
 * The global options of a simple command running a subcommand that takes a
 * message, or `undefined` where it runs none. Its arguments after the
 * subcommand carry prose, such as a commit message or a pull request body,
 * where naming the file is not reading it, while its global options, such as
 * `-c core.editor=...`, can make git run what they name.
 */
const messageCommandGlobalOptions = (
  simpleCommand: string
): string | undefined =>
  (
    GIT_MESSAGE_COMMAND.exec(simpleCommand) ??
    GH_MESSAGE_COMMAND.exec(simpleCommand)
  )?.[1];

const isMessageCommand = (simpleCommand: string): boolean =>
  messageCommandGlobalOptions(simpleCommand) !== undefined;

/**
 * A marked heredoc body, or a quoted span, that may be prose. A double-quoted
 * span holding `$`, a backtick or a backslash runs or decodes something
 * first, so it never is. A checked body is removed here too, and the piece
 * reading keeps it.
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
 * A piece of more than one character: a marked body, a single-quoted span,
 * which takes in a `$` right before it, a double-quoted span, or an escaped
 * character.
 */
const PAIRED_PIECE = joinAlternatives(
  MARKED_BODY.source,
  /\$?'[^']*'/u.source,
  DOUBLE_QUOTED_OVER_BODIES,
  /\\[\s\S]/u.source
);

/** A simple command's pieces: a paired piece, or any other character. */
const SHELL_PIECE = joinAlternatives(PAIRED_PIECE.source, /[\s\S]/u.source);

/**
 * A double-quoted piece holding `$`, a backtick or a backslash, which the
 * shell decodes or runs before the program reads it, or a checked body, which
 * another program reads. Neither is ever prose.
 */
const NEVER_PROSE_PIECE = /^(?:"[\s\S]*?[$`\\]|\uE002)/u;

/**
 * A double-quoted piece holding `$(`, `${` or a backtick, inside which the
 * shell starts pairing quotes afresh, so a quote this guard pairs from there
 * on may not be the one the shell pairs.
 */
const NESTED_DOUBLE_QUOTE = /^"[\s\S]*?(?:\$[({]|`)/u;

/**
 * Whether the piece opens quoting this guard cannot pair: a nested double
 * quote, or a `$'` span whose closing quote follows a backslash, which the
 * shell, reading it as ANSI-C quoting, may not take as the end.
 */
const opensNestedQuoting = (piece: string): boolean =>
  NESTED_DOUBLE_QUOTE.test(piece) ||
  (piece.startsWith("$'") && piece.endsWith(String.raw`\'`));

/** A path rarely holds a blank, so `git add '.env'` is still checked. */
const proseRemoved = (span: string): string => (/\s/u.test(span) ? " " : span);

/**
 * Before nested quoting opens, any piece that may be prose and holds a blank
 * is quoted text, a prose body, or a blank, escaped or not, and is removed.
 * From the piece that opens it on, only the prose bodies are.
 */
const removeProse = (piece: string, isNested: boolean): string => {
  if (isNested) {
    return piece.replaceAll(PROSE_BODY, proseRemoved);
  }
  return NEVER_PROSE_PIECE.test(piece) ? piece : proseRemoved(piece);
};

/** An unquoted delimiter lets the shell run `$(...)` and backticks in the body. */
const EXPANDING_BODY = /[$`]/u;

/**
 * A `"$(cat <<'EOF' ... EOF\n)"` whose body the rewrite marked, which closes
 * where this guard reads it as closing.
 */
const CAT_SUBSTITUTION = /^"\$\(cat <<'EOF' \uE000[^\uE001]*\uE001 EOF\n\)"/u;

/**
 * The command line with every span the guard pairs as the shell does reduced
 * to `_`, so the separators and quotes left are the shell's own. A span that
 * opens nested quoting, other than a `"$(cat <<'EOF' ... EOF\n)"`, is reduced
 * to `'`, an unpaired quote, because the guard cannot say where it closes.
 */
const outlineQuoting = (text: string): string =>
  text.replaceAll(PAIRED_PIECE, (piece: string) =>
    opensNestedQuoting(piece) && !CAT_SUBSTITUTION.test(piece) ? "'" : "_"
  );

/** A `#` after a blank on the operator's line, which makes the operator comment text. */
const COMMENT_ON_LINE = /\s#[^\n]*$/u;

/**
 * Whether a line holds two `<<`, or ends in a backslash, which joins the next
 * line to it. The shell may then read a body later than this guard does, so
 * every body from such a line on is checked.
 */
const hasAmbiguousOperatorLine = (text: string): boolean =>
  text
    .split("\n")
    .some((line) => line.split("<<").length > 2 || line.endsWith("\\"));

/**
 * A delimiter word that goes on past its quotes, such as `'E'OF`, whose body
 * ends on a line other than the one this guard reads as its end.
 */
const DELIMITER_CONTINUES = /^[^\s;&|<>()]/u;

/** A parenthesis, a backtick or a quote, around which this guard cannot place the operator's command. */
const NESTING = /[()`"']/u;

const UNPAIRED_QUOTE = /["']/u;

const CAT_COMMAND = /^\s*cat(?!\S)/u;

const isCatCommand = (operatorCommand: string): boolean =>
  CAT_COMMAND.test(operatorCommand);

/** Nothing after a `cat` in a substitution, whose output goes into the argument it stands in. */
const NOTHING_AFTER = /^\s*$/u;

const PIPE = /^\s*\|/u;

/**
 * Whether the rest of the operator's line sends a `cat`'s output into the
 * argument it stands in, or into a pipe to a message command.
 */
const sendsCatIntoProse = (after: string): boolean =>
  NOTHING_AFTER.test(after) ||
  (PIPE.test(after) && isMessageCommand(after.slice(after.indexOf("|") + 1)));

/**
 * `$(cat ` right before the operator, inside double quotes or not, or else the
 * end of the text.
 */
const CAT_SUBSTITUTION_START = /"?\$\(cat $|$/u;

/**
 * Whether the command an operator at the end of `text` belongs to, the text
 * after the last control operator, is one `isCommand` accepts, where this
 * guard pairs every quote and parenthesis before the operator.
 */
const isPlainCommandBefore = (
  text: string,
  isCommand: (operatorCommand: string) => boolean
): boolean => {
  const operatorCommand = text.slice(
    Math.max(
      ...[...CONTROL_OPERATORS].map((operator) => text.lastIndexOf(operator))
    ) + 1
  );
  return (
    !UNPAIRED_QUOTE.test(text) &&
    !NESTING.test(operatorCommand) &&
    isCommand(operatorCommand)
  );
};

/**
 * A body is prose where its delimiter is quoted or it holds nothing the shell
 * expands, this guard reads the operator line as the shell does, the operator
 * is not in a comment, and either a message command owns the operator, or a
 * `cat` does whose output goes to one, the `cat` starting a command or a
 * substitution in an argument of one.
 */
const classifyBody = (
  prefix: string,
  quote: string,
  tail: string,
  body: string
): BodyReading => {
  const before = outlineQuoting(
    prefix.replaceAll(HEREDOC, writeOnOneLine("prose"))
  );
  const after = outlineQuoting(tail);
  const isCatIntoProse =
    sendsCatIntoProse(after) &&
    (isPlainCommandBefore(before, isCatCommand) ||
      isPlainCommandBefore(
        before.slice(0, before.search(CAT_SUBSTITUTION_START)),
        isMessageCommand
      ));
  const isReadAsProse =
    !(quote === "" && EXPANDING_BODY.test(body)) &&
    !hasAmbiguousOperatorLine(`${prefix}<<${tail}`) &&
    !DELIMITER_CONTINUES.test(tail) &&
    !COMMENT_ON_LINE.test(before) &&
    !NESTING.test(after) &&
    (isPlainCommandBefore(before, isMessageCommand) || isCatIntoProse);
  return isReadAsProse ? "prose" : "checked";
};

/**
 * Every heredoc rewritten onto one line, its body marked by how it is read.
 * The text before each operator is classified with its own heredocs already
 * on one line, so a quote inside an earlier body pairs with nothing.
 */
const markHeredocs = (command: string): string =>
  command.replaceAll(
    HEREDOC,
    (
      heredoc: string,
      quote: string,
      _delimiter: string,
      tail: string,
      body: string,
      offset: number
    ) =>
      heredoc.replaceAll(
        HEREDOC,
        writeOnOneLine(
          classifyBody(command.slice(0, offset), quote, tail, body)
        )
      )
  );

const REFUSAL =
  "PreToolUse(Bash): this command names a protected env file (.env, .env.local, .env.development or .env.production), which holds the local secrets. Take the documented placeholder values from scripts/setup/placeholders.dotenv instead. A command that takes a message (`git commit`, `git tag`, `git merge`, `git notes add` or `append`, `git stash push`, `gh pr` or `gh issue` with `create`, `edit`, `comment`, `close` or `reopen`, `gh pr review` or `merge`, and `gh release edit`) may name the file in a quoted message that holds a blank, or in a heredoc with a quoted delimiter (`<<'EOF'`) that it reads, or that a `cat` piped or substituted into it reads, but not in the global options before the subcommand.";

const MARKER_REFUSAL =
  "PreToolUse(Bash): this command holds U+E000, U+E001 or U+E002, the private-use characters this guard writes around a heredoc body, so the guard cannot tell a body it marked from text written to look like one. Remove those characters from the command.";

/** The simple commands a command line runs, split at each unquoted control operator. */
const simpleCommands = (command: string): string[] =>
  Array.from(markHeredocs(command).matchAll(SHELL_TOKEN), ([token]) =>
    CONTROL_OPERATORS.has(token) ? COMMAND_BOUNDARY : token
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
 * A command other than `git` or `gh` is checked whole. Of a message command,
 * the global options are checked whole. Any other `git` or `gh` command is
 * checked whole but for the heredoc bodies a message command reads, because
 * such a body lands in the last simple command on its operator's line. A
 * `git` or `gh` command is then checked twice more, with its prose removed by
 * two readings that pair quotes differently. The scan pairs a quote with the next quote of its kind
 * wherever it stands, so after a span it cannot pair, such as `"$MSG"`, it
 * pairs a closing quote with an opening one and reads the text between them as
 * prose. The pairing follows the command line piece by piece, and never
 * removes a checked body that is a piece of its own. A name either reading
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
  const nestedFrom = pieces.findIndex(({ text }) => opensNestedQuoting(text));
  const piecesByCommand = Map.groupBy(
    pieces.map((piece, index) => ({
      ...piece,
      isNested: nestedFrom !== -1 && index >= nestedFrom,
    })),
    ({ commandIndex }) => commandIndex
  );
  return [...piecesByCommand.values()].flatMap((commandPieces) => {
    const simpleCommand = commandPieces.map(({ text }) => text).join("");
    if (!GIT_OR_GH_COMMAND.test(simpleCommand)) {
      return [simpleCommand];
    }
    return [
      messageCommandGlobalOptions(simpleCommand) ??
        simpleCommand.replaceAll(PROSE_BODY, proseRemoved),
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
