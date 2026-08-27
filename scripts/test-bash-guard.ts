#!/usr/bin/env bun

/**
 * Exercise .claude/hooks/pre-bash-guard.sh against the shapes it must judge.
 *
 *     bun run scripts/test-bash-guard.ts
 *
 * The guard carries two decisions that are easy to break and impossible to
 * notice: the protected-env-file block and the `find` gate. Each case below
 * feeds the real hook a synthetic PreToolUse payload and asserts the decision it
 * returns. Nothing in the repository is modified and no command from a case is
 * ever executed.
 *
 * Not named `*.test.ts` on purpose: vitest would then run it on every
 * `bun run test` and in CI, where a hook that only runs during local agent
 * sessions has nothing to report. Run it after touching pre-bash-guard.sh.
 * Exits non-zero on a mismatch.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const HOOK = path.join(REPO, ".claude/hooks/pre-bash-guard.sh");

// Joined so this file's own text is not itself a commit-shaped command.
const COMMIT = ["git ", "com", "mit"].join("");

const DECISIONS = ["allow", "block", "ask"] as const;

type Decision = (typeof DECISIONS)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asDecision = (value: unknown): Decision | undefined =>
  DECISIONS.find((decision) => decision === value);

/** The hook's decision for a Bash command. */
const decide = (command: string): Decision => {
  const { stdout } = spawnSync("bash", [HOOK], {
    encoding: "utf-8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO },
    input: JSON.stringify({ tool_input: { command }, tool_name: "Bash" }),
  });
  const out = stdout.trim();
  const hookStayedSilent = out === "";
  if (hookStayedSilent) {
    return "allow";
  }
  const parsed: unknown = JSON.parse(out);
  if (!isRecord(parsed)) {
    return "allow";
  }
  if (parsed.decision === "block") {
    return "block";
  }
  const specific = parsed.hookSpecificOutput;
  if (!isRecord(specific)) {
    return "allow";
  }
  return asDecision(specific.permissionDecision) ?? "allow";
};

interface Case {
  command: string;
  expected: Decision;
  why: string;
}

const failures: string[] = [];

const group = (title: string, cases: readonly Case[]): void => {
  console.log(title);
  cases.forEach(({ command, expected, why }) => {
    const actual = decide(command);
    const ok = actual === expected;
    if (!ok) {
      failures.push(`${why}: ${command}`);
    }
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${actual.padEnd(5)} (want ${expected.padEnd(5)})  ${why}`
    );
  });
};

group("find: scoped discovery runs unattended", [
  {
    command: "find node_modules/vitest -name '*.js'",
    expected: "allow",
    why: "subdirectory root",
  },
  {
    command: "find src -type f -name '*.tsx'",
    expected: "allow",
    why: "subdirectory root",
  },
  {
    command: "find ./src/lib -name '*.ts'",
    expected: "allow",
    why: "./ prefix but scoped",
  },
  {
    command: "find docs -newer README.md",
    expected: "allow",
    why: "metadata predicate",
  },
  {
    command: "find src -type f | xargs grep -l useState",
    expected: "allow",
    why: "piped into a reader, scoped",
  },
]);

group("find: broad reach is refused", [
  { command: "find . -type f", expected: "block", why: "repository root" },
  {
    command: "find . -type f | xargs cat",
    expected: "block",
    why: "the read-everything shape",
  },
  { command: "find ./ -name '*.ts'", expected: "block", why: "bare ./" },
  { command: "find / -name id_rsa", expected: "block", why: "filesystem root" },
  { command: "find ~ -name '*.pem'", expected: "block", why: "home directory" },
  { command: "find .. -type f", expected: "block", why: "parent directory" },
  {
    command: "find src/../ -type f",
    expected: "block",
    why: "escapes upward",
  },
  { command: "find $HOME -type f", expected: "block", why: "variable root" },
  {
    command: "find -name '*.ts'",
    expected: "block",
    why: "no root operand at all",
  },
]);

group("find: actions that run or delete are refused, even when scoped", [
  {
    command: "find src -name '*.log' -delete",
    expected: "block",
    why: "-delete",
  },
  {
    command: "find src -type f -exec cat {} ;",
    expected: "block",
    why: "-exec",
  },
  {
    command: "find src -type d -execdir ls {} ;",
    expected: "block",
    why: "-execdir",
  },
  { command: "find src -type f -fls /tmp/out", expected: "block", why: "-fls" },
]);

// The first version of Guard 2 matched one regex anchored on the character after
// `find `, and a reviewer broke it twice — once with quotes, once with a second
// root. Both classes stay here permanently.
group("find: quoting must not hide the shape", [
  {
    command: 'find "." -type f | xargs cat',
    expected: "block",
    why: "double-quoted root",
  },
  { command: "find '.' -type f", expected: "block", why: "single-quoted root" },
  {
    command: 'find "/" -type f',
    expected: "block",
    why: "quoted filesystem root",
  },
  {
    command: 'find "$HOME" -type f',
    expected: "block",
    why: "quoted variable root",
  },
  { command: 'find ".." -type f', expected: "block", why: "quoted parent" },
  {
    command: 'find src "-exec" cat {} +',
    expected: "block",
    why: "quoted action flag",
  },
  { command: "find src '-delete'", expected: "block", why: "quoted -delete" },
]);

group("find: a broad root hidden behind a narrow one is still caught", [
  {
    command: "find src / -type f",
    expected: "block",
    why: "second root is the filesystem root",
  },
  {
    command: "find src . -type f",
    expected: "block",
    why: "second root is the repository",
  },
  {
    command: "find src ~ -type f",
    expected: "block",
    why: "second root is the home directory",
  },
  {
    command: "find src / -type f | xargs cat",
    expected: "block",
    why: "multi-root read-everything",
  },
  {
    command: "find src docs -name '*.md'",
    expected: "allow",
    why: "two scoped roots stay unattended",
  },
  {
    command: "find src -name '../x'",
    expected: "allow",
    why: "'..' inside a predicate value is not a root",
  },
]);

// The first version of this guard refused the very commit that introduced it,
// because the message body described `find . | xargs cat`.
group("find: text inside a heredoc is data, not a command", [
  {
    command: `git add x && ${COMMIT} -F - <<'MSG'\nrefuse find . -type f | xargs cat and -delete\nMSG`,
    expected: "allow",
    why: "a commit message describing the dangerous shapes",
  },
  {
    command: "cat <<'EOF'\nfind / -delete\nEOF",
    expected: "allow",
    why: "heredoc body naming a dangerous find",
  },
]);

group("env protection still blocks", [
  { command: "cat .env.local", expected: "block", why: "direct read" },
  { command: "grep SECRET .env", expected: "block", why: "grep read" },
  {
    command: "cat .env.local.example",
    expected: "allow",
    why: "the example file is readable",
  },
]);

group("env protection: a git message body is prose, not file access", [
  {
    command: `${COMMIT} -m 'keep the .env guard'`,
    expected: "allow",
    why: "a single-line body naming the file",
  },
  {
    command: "git tag --message='the .env file'",
    expected: "allow",
    why: "the --message= form",
  },
  {
    command: `${COMMIT} -m "$(cat .env)"`,
    expected: "block",
    why: "a substitution in the body is not scrubbed",
  },
]);

group("env protection: a message body may span lines", [
  {
    command: `${COMMIT} -m 'keep the .env guard\nsecond line'`,
    expected: "allow",
    why: "a two-line single-quoted body",
  },
  {
    command: `${COMMIT} -m "keep the .env guard\nsecond line"`,
    expected: "allow",
    why: "a two-line double-quoted body",
  },
  {
    command: `${COMMIT} -m 'keep the .env guard\nsecond line' && cat .env`,
    expected: "block",
    why: "a real access chained after the body",
  },
]);

group("env protection: a git message body is prose, a chained command is not", [
  {
    command: `${COMMIT} -F - <<'MSG'\nkeep the .env guard\nMSG`,
    expected: "allow",
    why: "a heredoc commit body naming the file",
  },
  {
    command: `${COMMIT} -F - <<'MSG'\nbody\nMSG\ncat .env`,
    expected: "block",
    why: "a command chained after the terminator",
  },
  {
    command: `${COMMIT} -F - <<'MSG' > .env\nbody\nMSG`,
    expected: "block",
    why: "a redirect on the operator line",
  },
  {
    command: "cat <<'EOF'\n.env\nEOF",
    expected: "block",
    why: "a heredoc body outside a git command still blocks",
  },
]);

console.log("");
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length}`);
  failures.forEach((failure) => {
    console.log(`  - ${failure}`);
  });
  process.exit(1);
}
console.log("all checks passed");
