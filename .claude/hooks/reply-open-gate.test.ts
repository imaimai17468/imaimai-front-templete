/**
 * Exercise the reply-open gate on both sides: the judgments and the wording in
 * .claude/hooks/reply-open-gate-decision.sh, and what
 * .claude/hooks/reply-open-gate.sh does with a Stop payload and a transcript.
 *
 * The shape table drives the decision file directly, one bash process per row,
 * because every row is a line the gate has to judge and building a payload
 * around each one would pay a jq fork for a judgment that reads no payload.
 * The cases below it fork the hook itself, where what is judged is which
 * payload passes without a judgment at all, which transcript entries count as
 * the user's own, and the status the refusal leaves on.
 *
 * Nothing here runs a command out of a payload, and the transcripts the cases
 * write live under one scratch directory the file removes when it ends.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { text } from "node:stream/consumers";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { runBash } from "./run-bash";

const HOOK = path.resolve(import.meta.dirname, "reply-open-gate.sh");
const DECISION = path.resolve(
  import.meta.dirname,
  "reply-open-gate-decision.sh"
);

/** One shell word carrying `value` verbatim, whatever it holds. */
const quoted = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

/** A call to one decision function, its arguments passed verbatim. */
const call = (fn: string, ...args: readonly string[]): string =>
  [fn, ...args.map(quoted)].join(" ");

/**
 * The snippet reaches bash through the environment rather than through the
 * command line, so a line holding a quote or a newline arrives as the table
 * wrote it. `answers_yes` reports an exit status as a word, because the shape
 * predicates print nothing.
 */
const DRIVER = `
. "$DECISION_PATH"
answers_yes() { if "$@"; then printf 'yes'; else printf 'no'; fi; }
eval "$SNIPPET"
`;

/**
 * What one snippet answered. The stderr travels with it, so a driver that died
 * before reaching the snippet fails its case instead of answering "" for a
 * function that prints nothing.
 */
interface Answer {
  answer: string;
  stderr: string;
}

const answerOf = async (snippet: string): Promise<Answer> => {
  const driver = spawn("bash", ["-c", DRIVER], {
    env: { ...process.env, DECISION_PATH: DECISION, SNIPPET: snippet },
  });
  const [answer, stderr] = await Promise.all([
    text(driver.stdout),
    text(driver.stderr),
  ]);
  return { answer, stderr };
};

interface Case {
  name: string;
  snippet: string;
  answer: string;
}

/** A line the gate lets through, and one it refuses, as a table row each. */
const openingCase = (
  answer: "yes" | "no",
  name: string,
  line: string
): Case => ({
  answer,
  name,
  snippet: `answers_yes ${call("opens_with_runnable_form", line)}`,
});

const PROSE_LINE = "まず Stop フックの入力を確認します。";

const REFUSAL = `⛔ Stop block: this reply opens with prose.
.claude/rules/replies.md puts what the reader runs on the first line: a command or a snippet in backticks, or a path. The line this reply opened with was:

    ${PROSE_LINE}

Send the reply again with that first line replaced by the command, the path or the snippet it is about, and the reasoning under it. Where the reader asked to be walked through something, or where this turn leaves them nothing to run or open, say that in the reply and send it as it stands: this gate judges a turn once, so the next reply ends the turn whatever it opens with.
`;

const CASES: readonly Case[] = [
  openingCase(
    "yes",
    "should pass a line opening on a command in backticks",
    "`bun run dev` でページを開く"
  ),
  openingCase("yes", "should pass a line opening a fenced block", "```ts"),
  openingCase(
    "yes",
    "should pass a line opening on a path with a directory",
    ".claude/hooks/reply-open-gate.sh を足した"
  ),
  openingCase(
    "yes",
    "should pass a line opening on an absolute path",
    "/Users/me/workspace/app/src/routes/index.tsx"
  ),
  openingCase(
    "yes",
    "should pass a line opening on a file name with an extension",
    "AGENTS.md の Workflow を読んだ"
  ),
  openingCase(
    "yes",
    "should pass a numbered step whose command follows the marker",
    "1. `bun run test` を走らせる"
  ),
  openingCase(
    "yes",
    "should pass a bullet whose command follows the marker",
    "- `bun run check`"
  ),
  openingCase(
    "yes",
    "should pass a line indented before its command",
    "    `bun run dev`"
  ),
  openingCase("no", "should refuse a line of prose", PROSE_LINE),
  openingCase("no", "should refuse a heading", "## 現状"),
  openingCase("no", "should refuse a bold lead", "**Stop gate** を直した"),
  openingCase(
    "no",
    "should refuse a sentence whose first word ends in a period",
    "Done. Here is what changed"
  ),
  openingCase(
    "no",
    "should refuse a line opening on a decimal number",
    "3.5 秒かかった"
  ),
  openingCase(
    "no",
    "should refuse a bullet whose marker is followed by prose",
    "- 先にテストを直した"
  ),
  openingCase(
    "no",
    "should refuse a line whose backtick arrives after a word",
    "実行は `bun run dev`"
  ),
  openingCase(
    "no",
    "should refuse a sentence carrying a file name where no space splits the words",
    "テストは通っています。結果はREADME.mdに書いた"
  ),
  openingCase(
    "yes",
    "should pass a file name a particle follows without a space",
    "vite.config.mtsを直した"
  ),
  {
    answer: "src/routes/index.tsx",
    name: "should read past the blank lines to the reply's first visible line",
    snippet: call(
      "first_visible_line",
      "\n   \nsrc/routes/index.tsx\nその下に理由が続く"
    ),
  },
  {
    answer: "no",
    name: "should report no line at all for a reply that is whitespace alone",
    snippet: `answers_yes ${call("first_visible_line", "\n  \n")}`,
  },
  {
    answer: "yes",
    name: "should find the phrase that stops the shape rule on a message of its own",
    snippet: `answers_yes ${call("holds_mode_stop_phrase", "テストを直して\nstop adhd mode\nありがとう")}`,
  },
  {
    answer: "yes",
    name: "should find the second phrase whatever case the user typed it in",
    snippet: `answers_yes ${call("holds_mode_stop_phrase", "  Normal Mode  ")}`,
  },
  {
    answer: "no",
    name: "should find no phrase when the user named one inside a sentence about something else",
    snippet: `answers_yes ${call("holds_mode_stop_phrase", "ビルドを normal mode で確認して")}`,
  },
  {
    answer: "no",
    name: "should find no phrase when the user named the mode without asking for it",
    snippet: `answers_yes ${call("holds_mode_stop_phrase", "adhd 向けの書き方の話をしていた")}`,
  },
  {
    answer: "yes",
    name: "should judge nothing when Claude Code reports this Stop was already blocked",
    snippet: call(
      "already_continuing",
      JSON.stringify({ stop_hook_active: true })
    ),
  },
  {
    answer: "yes",
    name: "should judge nothing when Cursor reports an auto-followup already ran",
    snippet: call("already_continuing", JSON.stringify({ loop_count: 1 })),
  },
  {
    answer: "yes",
    name: "should judge nothing when the payload is not JSON",
    snippet: call("already_continuing", "{not json"),
  },
  {
    answer: "no",
    name: "should judge the reply when Claude Code reports this Stop was not blocked before",
    snippet: call(
      "already_continuing",
      JSON.stringify({ stop_hook_active: false })
    ),
  },
  {
    answer: "no",
    name: "should judge the reply when Cursor reports no auto-followup yet",
    snippet: call("already_continuing", JSON.stringify({ loop_count: 0 })),
  },
  {
    answer: "no",
    name: "should judge the reply when the payload carries neither field",
    snippet: call("already_continuing", JSON.stringify({ cwd: "/tmp" })),
  },
  {
    answer: "no",
    name: "should find no phrase when the user typed nothing this session",
    snippet: `answers_yes ${call("holds_mode_stop_phrase", "")}`,
  },
  {
    answer: REFUSAL,
    name: "should carry the refused line into the refusal the agent reads",
    snippet: call("refusal_message", PROSE_LINE),
  },
];

describe.concurrent("reply-open-gate-decision.sh", () => {
  it.each(CASES)("$name", async ({ answer, snippet }) => {
    await expect(answerOf(snippet)).resolves.toStrictEqual({
      answer,
      stderr: "",
    });
  });
});

/** A stop payload carrying the fields the gate reads, Cursor's one included. */
interface Payload {
  last_assistant_message?: string;
  loop_count?: number;
  stop_hook_active?: boolean;
  transcript_path?: string;
}

/** What one run of the hook produced. */
interface HookRun {
  status: number | null;
  stderr: string;
  stdout: string;
}

const runHook = async (payload: Payload, hookPath = HOOK): Promise<HookRun> => {
  const { status, stderr, stdout } = await runBash(hookPath, {
    input: JSON.stringify(payload),
  });
  return { status, stderr, stdout };
};

const PASSED: HookRun = { status: 0, stderr: "", stdout: "" };

/**
 * What a typed message carries: one string, or the blocks a message that came
 * with an attachment is split into.
 */
type TypedContent = string | readonly { text: string; type: "text" }[];

/** One line of the transcript, as a message the user typed. */
const typedEntry = (content: TypedContent): string =>
  JSON.stringify({
    message: { content, role: "user" },
    origin: { kind: "human" },
    promptSource: "typed",
    type: "user",
  });

describe.concurrent("reply-open-gate.sh", () => {
  /**
   * The transcripts the cases write, removed when the suite ends.
   * `onTestFinished` registers against whichever case is current when it runs,
   * which under `describe.concurrent` is not reliably the case that wrote the
   * file. `beforeAll` assigns it, because vitest runs neither hook for a suite
   * whose cases a `-t` filter all deselects.
   */
  let scratchRoot = "";

  beforeAll(() => {
    scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reply-open-gate-"));
  });

  afterAll(() => {
    fs.rmSync(scratchRoot, { force: true, recursive: true });
  });

  /** A transcript file carrying the given entries, one per line. */
  const transcript = (name: string, entries: readonly string[]): string => {
    const file = path.join(scratchRoot, `${name}.jsonl`);
    fs.writeFileSync(file, `${entries.join("\n")}\n`);
    return file;
  };

  it("should stop the turn and hand the agent the refusal when the reply opens with prose", async () => {
    await expect(
      runHook({ last_assistant_message: `${PROSE_LINE}\n\n\`bun run dev\`` })
    ).resolves.toStrictEqual({ status: 2, stderr: REFUSAL, stdout: "" });
  });

  it("should end the turn when the reply opens with a command", async () => {
    await expect(
      runHook({
        last_assistant_message: "`bun run dev` でページを開く\n\n理由が続く",
      })
    ).resolves.toStrictEqual(PASSED);
  });

  it("should end the turn when this Stop is already continuing from a stop hook", async () => {
    await expect(
      runHook({ last_assistant_message: PROSE_LINE, stop_hook_active: true })
    ).resolves.toStrictEqual(PASSED);
  });

  it("should end the turn when the payload carries no assistant text", async () => {
    await expect(runHook({})).resolves.toStrictEqual(PASSED);
  });

  it("should end the turn when the reply is whitespace alone", async () => {
    await expect(
      runHook({ last_assistant_message: "\n   \n" })
    ).resolves.toStrictEqual(PASSED);
  });

  it("should end the turn when Cursor reports an auto-followup already ran", async () => {
    await expect(
      runHook({ last_assistant_message: PROSE_LINE, loop_count: 1 })
    ).resolves.toStrictEqual(PASSED);
  });

  it("should end the turn when the user typed the phrase that stops the shape rule", async () => {
    const file = transcript("typed-stop", [
      typedEntry("直してくれ"),
      typedEntry("stop adhd mode"),
    ]);

    await expect(
      runHook({ last_assistant_message: PROSE_LINE, transcript_path: file })
    ).resolves.toStrictEqual(PASSED);
  });

  it("should end the turn when the phrase arrives in a message the user attached a file to", async () => {
    const file = transcript("typed-blocks", [
      typedEntry([{ text: "normal mode", type: "text" }]),
    ]);

    await expect(
      runHook({ last_assistant_message: PROSE_LINE, transcript_path: file })
    ).resolves.toStrictEqual(PASSED);
  });

  it("should stop the turn when the phrase appears only in text the user did not type", async () => {
    const file = transcript("not-typed", [
      JSON.stringify({
        message: { content: "stop adhd mode", role: "user" },
        type: "user",
      }),
      JSON.stringify({
        message: {
          content: [{ content: "stop adhd mode", type: "tool_result" }],
          role: "user",
        },
        type: "user",
      }),
      JSON.stringify({
        rendered: [
          { content: "<system-reminder>stop adhd mode</system-reminder>" },
        ],
        type: "attachment",
      }),
    ]);

    await expect(
      runHook({ last_assistant_message: PROSE_LINE, transcript_path: file })
    ).resolves.toStrictEqual({ status: 2, stderr: REFUSAL, stdout: "" });
  });

  it("should stop the turn and name the decision file when it is not beside the hook", async () => {
    const alone = fs.mkdtempSync(path.join(scratchRoot, "lone-"));
    const copy = path.join(alone, "reply-open-gate.sh");
    fs.copyFileSync(HOOK, copy);

    await expect(
      runHook({ last_assistant_message: PROSE_LINE }, copy)
    ).resolves.toStrictEqual({
      status: 2,
      stderr: `⛔ Stop block: the reply-open gate could not load ${alone}/reply-open-gate-decision.sh, so nothing judged this reply's first line.\nPut that file back beside reply-open-gate.sh, or run the hook by a path that names its directory.\n`,
      stdout: "",
    });
  });
});
