/**
 * Exercise `guard_refusal` in .claude/hooks/pre-bash-guard-decision.sh against
 * one command per branch it can refuse on, and against the shapes its
 * early-outs let through.
 *
 * Every case here reaches the same code .claude/hooks/pre-bash-guard.sh runs,
 * through one bash process for the whole file: the driver below sources the
 * decision file once and answers the commands it reads NUL-delimited on stdin.
 * pre-bash-guard.test.ts forks the hook per case instead, because what it
 * judges is the payload the hook reads and the JSON it prints.
 *
 * A case asserts the whole refusal sentence rather than allow-or-block, so a
 * branch that returns another branch's reason fails here.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { text } from "node:stream/consumers";
import { describe, expect, it } from "vite-plus/test";

const DECISION = path.resolve(
  import.meta.dirname,
  "pre-bash-guard-decision.sh"
);

// Joined so this file's own text is not itself a commit-shaped command.
const COMMIT_SUB = ["com", "mit"].join("");
const COMMIT = `git ${COMMIT_SUB}`;
const RM_SUB = ["r", "m"].join("");
const RM = `git ${RM_SUB}`;
const ADD = `git ${["a", "dd"].join("")}`;
const STAGE = `git ${["st", "age"].join("")}`;

/**
 * `read -d ''` splits on NUL, which keeps a command that spans lines in one
 * piece, and the answers come back NUL-delimited in the same order.
 *
 * The answer is assigned before it is printed, because an assignment takes the
 * substitution's exit status where `printf "$(...)"` takes printf's. Under the
 * `set -e` the decision file carries, a `guard_refusal` that died would then
 * end the driver, and the answers run short of the commands.
 */
const DRIVER = `
. "$1"
while IFS= read -r -d '' COMMAND; do
  REFUSAL=$(guard_refusal "$COMMAND")
  printf '%s\\0' "$REFUSAL"
done
`;

/**
 * What the driver answered for one batch of commands.
 *
 * An empty refusal is how the decision spells "allow", so a driver that died
 * partway through would hand back a run of allowed commands. The count of
 * answers and the stderr travel with them, and the first test compares both.
 */
interface DriverRun {
  refusals: readonly string[];
  stderr: string;
}

const runDriver = async (commands: readonly string[]): Promise<DriverRun> => {
  const driver = spawn("bash", ["-c", DRIVER, "bash", DECISION]);
  driver.stdin.end(commands.map((command) => `${command}\0`).join(""));
  const [stdout, stderr] = await Promise.all([
    text(driver.stdout),
    text(driver.stderr),
  ]);
  // The driver terminates every answer with a NUL, so the split leaves one
  // trailing empty piece that belongs to no command.
  return { refusals: stdout.split("\0").slice(0, -1), stderr };
};

const ENV_REFUSAL =
  "PreToolUse(Bash): this command references a protected env file (.env / .env.local / .env.development / .env.production). Reading or writing these is denied regardless of tool. Use .env.local.example for documented placeholders. To write the filename as prose, put it in a quoted body of `git` -m/--message or of `gh` --body/--title/--subject: a single-quoted body is read as prose, a double-quoted one only when the command contains no $(, ${ or backtick.";

const findRefusal = (why: string): string =>
  `PreToolUse(Bash): this \`find\` is refused because ${why}. A find scoped to a subdirectory, without -exec/-execdir/-ok/-okdir/-delete/-fprint/-fls, runs unattended — narrow it if that is enough. If the broad form is genuinely needed, ask the user to run it.`;

const NEXT_STEP = {
  add: "Name the files this commit needs (`git add src/foo.ts src/bar.ts`), and take part of a file with `git add -p`. `git status --short` lists what changed.",
  commit: `Stage the files this ${COMMIT_SUB} needs (\`git add src/foo.ts src/bar.ts\`, or \`git add -p\` for part of a file), then ${COMMIT_SUB} that staged set with \`${COMMIT} -m\`. \`git status --short\` lists what changed.`,
  rm: `Name the paths to delete (\`${RM} src/foo.ts src/bar.ts\`, or \`${RM} -r src/old-dir\` for one directory). \`git ls-files\` lists the tracked paths.`,
} as const;

/** The note the walk adds where it read `$PWD` or `pwd` as `.`. */
const PWD_NOTE =
  " `$PWD` and `pwd` expand to the working directory, so this guard reads the operand you spelled with one of them as `.`.";

const gitRefusal = (
  sub: keyof typeof NEXT_STEP | "stage",
  why: string,
  note = ""
): string => {
  const step = sub === "stage" ? NEXT_STEP.add : NEXT_STEP[sub];
  return `PreToolUse(Bash): this \`git ${sub}\` is refused because ${why}.${note} ${step}`;
};

interface Case {
  name: string;
  command: string;
  refusal: string;
}

const CASES: readonly Case[] = [
  {
    command: "ls -la",
    name: "should allow a command that names no protected file, no find and no git",
    refusal: "",
  },
  {
    command: "cat .env.local",
    name: "should refuse a command reading the local env file",
    refusal: ENV_REFUSAL,
  },
  {
    command: "cat .env.local.example",
    name: "should allow a command reading the committed example env file",
    refusal: "",
  },
  {
    command: `${COMMIT} -m 'docs: .env.local を説明した'`,
    name: "should allow a single-quoted git message that names the env file as prose",
    refusal: "",
  },
  {
    command: `${COMMIT} -m "docs: $(date) .env.local"`,
    name: "should refuse a double-quoted git message naming the env file when the command opens a substitution",
    refusal: ENV_REFUSAL,
  },
  {
    command: "find src -type f -name '*.ts'",
    name: "should allow a find scoped to a subdirectory",
    refusal: "",
  },
  {
    command: "find . -type f",
    name: "should refuse a find whose root is the repository",
    refusal: findRefusal(
      "a search root reaches the whole repository (or outside it), so it can read files the deny list protects"
    ),
  },
  {
    command: "find src -type f -exec cat {} ;",
    name: "should refuse a find that carries an action running a command per match",
    refusal: findRefusal(
      "it carries an action that runs a command or deletes files"
    ),
  },
  {
    command: "find -name '*.ts'",
    name: "should refuse a find that names no search root",
    refusal: findRefusal(
      "it names no search root, so it searches the working directory"
    ),
  },
  {
    command: "git status --short",
    name: "should allow a git subcommand that stages, removes and commits nothing",
    refusal: "",
  },
  {
    command: `${ADD} src/foo.ts src/bar.ts`,
    name: "should allow a git add that names its files",
    refusal: "",
  },
  {
    command: `${ADD} -p`,
    name: "should allow a git add that selects hunks",
    refusal: "",
  },
  {
    command: `${ADD} :/`,
    name: "should refuse a git add whose operand is pathspec magic",
    refusal: gitRefusal(
      "add",
      "an operand begins with `:`, so it is pathspec magic rather than a path: `:` is the working directory, and `:/` and `:(top)` are the repository root"
    ),
  },
  {
    command: `${ADD} .`,
    name: "should refuse a git add whose operand is punctuation naming no file",
    refusal: gitRefusal("add", "`.` names no file or directory of its own"),
  },
  {
    command: `${ADD} src/..`,
    name: "should refuse a git add whose operand climbs out of the directory it names",
    refusal: gitRefusal(
      "add",
      "`src/..` ends at `..`, so it reaches the directory above the one it names"
    ),
  },
  {
    command: `${ADD} '*.ts'`,
    name: "should refuse a git add whose first path component is a glob",
    refusal: gitRefusal(
      "add",
      "the first path component of `*.ts` is a glob (`*`, `?` or a `[` class), so it matches names you did not list"
    ),
  },
  {
    command: `${ADD} --all`,
    name: "should refuse a git add taking every worktree change through --all",
    refusal: gitRefusal(
      "add",
      "`--all` stages every change in the worktree instead of the paths you name"
    ),
  },
  {
    command: `${ADD} --no-ignore-removal`,
    name: "should refuse a git add taking every worktree change through --no-ignore-removal",
    refusal: gitRefusal(
      "add",
      "`--no-ignore-removal` stages every change in the worktree instead of the paths you name"
    ),
  },
  {
    command: `${ADD} --update`,
    name: "should refuse a git add taking every tracked change through --update",
    refusal: gitRefusal(
      "add",
      "`--update` stages every tracked change in the worktree instead of the paths you name"
    ),
  },
  {
    command: `${ADD} -Av`,
    name: "should refuse a git add taking every worktree change through a cluster carrying A",
    refusal: gitRefusal(
      "add",
      "the short option -A stages every change in the worktree instead of the paths you name"
    ),
  },
  {
    command: `${ADD} -u`,
    name: "should refuse a git add taking every tracked change through the short -u",
    refusal: gitRefusal(
      "add",
      "the short option -u stages every tracked change in the worktree instead of the paths you name"
    ),
  },
  {
    command: ADD,
    name: "should refuse a git add that names nothing to stage",
    refusal: gitRefusal("add", "it names no path to stage"),
  },
  {
    command: `${ADD} --pathspec-from-file=paths.txt`,
    name: "should refuse a git add reading its pathspec from a file",
    refusal: gitRefusal("add", "it names no path to stage"),
  },
  {
    command: `${STAGE} -A`,
    name: "should refuse the git stage synonym under the same reason as git add",
    refusal: gitRefusal(
      "stage",
      "the short option -A stages every change in the worktree instead of the paths you name"
    ),
  },
  {
    command: `${RM} src/old.ts`,
    name: "should allow a git rm that names its path",
    refusal: "",
  },
  {
    command: RM,
    name: "should refuse a git rm that names nothing to remove",
    refusal: gitRefusal("rm", "it names no path to remove"),
  },
  {
    command: `${RM} -r --pathspec-from-file=paths.txt`,
    name: "should refuse a git rm reading its pathspec from a file",
    refusal: gitRefusal(
      "rm",
      "`--pathspec-from-file` takes its pathspec from a file the command text does not show"
    ),
  },
  {
    command: `${RM} -r "$PWD"`,
    name: "should tell the agent its $PWD operand was read as a dot when a git rm names it",
    refusal: gitRefusal(
      "rm",
      "`.` names no file or directory of its own",
      PWD_NOTE
    ),
  },
  {
    command: COMMIT,
    name: "should allow a git commit of the set already staged",
    refusal: "",
  },
  {
    command: `${COMMIT} -m 'test: *.ts covered'`,
    name: "should allow a git commit whose message body holds a blanket pathspec",
    refusal: "",
  },
  {
    command: `${COMMIT} --all`,
    name: "should refuse a git commit taking every tracked change through --all",
    refusal: gitRefusal(
      "commit",
      "`--all` commits every tracked change in the worktree instead of the ones you staged"
    ),
  },
  {
    command: `${COMMIT} -qa -m x`,
    name: "should refuse a git commit taking every tracked change through a cluster carrying a",
    refusal: gitRefusal(
      "commit",
      "the short option -a commits every tracked change in the worktree instead of the ones you staged"
    ),
  },
  {
    command: `${COMMIT} --pathspec-from-file=paths.txt`,
    name: "should refuse a git commit reading its pathspec from a file",
    refusal: gitRefusal(
      "commit",
      "`--pathspec-from-file` takes its pathspec from a file the command text does not show"
    ),
  },
  {
    command: `${COMMIT} -m 'fix: x' .`,
    name: "should refuse a git commit whose blanket pathspec sits outside its message body",
    refusal: gitRefusal("commit", "`.` names no file or directory of its own"),
  },
  {
    command: `${COMMIT} -F - <<'MSG'\nrefuse ${ADD} -A and find . -type f\nMSG`,
    name: "should allow a heredoc body describing a shape the guards refuse",
    refusal: "",
  },
];

// The whole table is answered while this file is loaded, so each case below is
// a synchronous comparison and none of them carries the driver's wall time.
const RUN = await runDriver(CASES.map((one) => one.command));

describe("guard_refusal", () => {
  it("should answer every command with nothing on stderr when the driver ran to the end", () => {
    expect({ answered: RUN.refusals.length, stderr: RUN.stderr }).toStrictEqual(
      {
        answered: CASES.length,
        stderr: "",
      }
    );
  });

  it.each(CASES.map((one, index) => ({ ...one, index })))(
    "$name",
    ({ command, index, refusal }) => {
      expect({ command, refusal: RUN.refusals[index] }).toStrictEqual({
        command,
        refusal,
      });
    }
  );
});
