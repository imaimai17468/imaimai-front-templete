/**
 * Exercise the judgments and the wording in
 * .claude/hooks/stop-gate-decision.sh: which payload field downgrades a block,
 * whether the changed files reach the quality gate, how collected failures
 * become one summary and one body, and the sentence each outcome prints.
 *
 * Every case here reaches the same code .claude/hooks/stop-gate.sh runs,
 * through one bash process for the whole file: the driver below sources the
 * decision file once and evaluates the snippets it reads NUL-delimited on
 * stdin, each inside a command substitution so one case's collected failures
 * do not reach the next. stop-gate.test.ts builds a scratch git repository with
 * stub steps per case instead, because what it judges is which steps the gate
 * ran and which tree it judged them in.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { text } from "node:stream/consumers";
import { describe, expect, it } from "vite-plus/test";

const DECISION = path.resolve(import.meta.dirname, "stop-gate-decision.sh");

/** One shell word carrying `value` verbatim, whatever it holds. */
const quoted = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

/** A call to one decision function, its arguments passed verbatim. */
const call = (fn: string, ...args: readonly string[]): string =>
  [fn, ...args.map(quoted)].join(" ");

/**
 * `read -d ''` splits on NUL, which keeps a snippet spanning lines in one
 * piece, and the answers come back NUL-delimited in the same order.
 *
 * The trailing `.` is what keeps a newline the wording ends on: a command
 * substitution strips them, so the answer would otherwise read as the same
 * text with the newline gone. `answers_yes` reports an exit status as a word,
 * because holds_code_relevant_file prints nothing.
 */
const DRIVER = `
. "$1"
answers_yes() { if "$@"; then printf 'yes'; else printf 'no'; fi; }
while IFS= read -r -d '' SNIPPET; do
  ANSWER=$(eval "$SNIPPET"; printf '.')
  printf '%s\\0' "\${ANSWER%.}"
done
`;

/**
 * What the driver answered for one batch of snippets.
 *
 * A driver that died partway through would leave the answers short of the
 * snippets, and each case after that point would compare against another
 * case's answer. The count and the stderr travel with them, and the first test
 * compares both.
 */
interface DriverRun {
  answers: readonly string[];
  stderr: string;
}

const runDriver = async (snippets: readonly string[]): Promise<DriverRun> => {
  const driver = spawn("bash", ["-c", DRIVER, "bash", DECISION]);
  driver.stdin.end(snippets.map((snippet) => `${snippet}\0`).join(""));
  const [stdout, stderr] = await Promise.all([
    text(driver.stdout),
    text(driver.stderr),
  ]);
  // The driver terminates every answer with a NUL, so the split leaves one
  // trailing empty piece that belongs to no snippet.
  return { answers: stdout.split("\0").slice(0, -1), stderr };
};

const LINK_CLEAN = "md links: clean";
const LINK_FAILED = "md links: FAILED";
const LINK_SKIPPED = "md links: SKIPPED (bun not installed)";

const SUMMARY = "bun run check failed. Fix before ending the turn.";
const RECORD_CHECK = call("record_failure", "bun run check", "check said no");

/** The first path matches, so a reader that stopped at the match would leave the rest unread. */
const LONG_LIST = [
  "src/a.ts",
  ...Array.from({ length: 20_000 }, () => "docs/note.md"),
].join("\n");

interface Case {
  name: string;
  snippet: string;
  answer: string;
}

const CASES: readonly Case[] = [
  {
    answer: "stop_hook_active",
    name: "should name stop_hook_active when Claude Code reports this Stop was already blocked",
    snippet: call(
      "downgrade_cause",
      JSON.stringify({ stop_hook_active: true })
    ),
  },
  {
    answer: "loop_count",
    name: "should name loop_count when Cursor reports an auto-followup already ran",
    snippet: call("downgrade_cause", JSON.stringify({ loop_count: 1 })),
  },
  {
    answer: "stop_hook_active",
    name: "should name stop_hook_active when the payload carries both fields",
    snippet: call(
      "downgrade_cause",
      JSON.stringify({ loop_count: 1, stop_hook_active: true })
    ),
  },
  {
    answer: "",
    name: "should name no cause when the payload carries neither field",
    snippet: call("downgrade_cause", JSON.stringify({ cwd: "/tmp" })),
  },
  {
    answer: "",
    name: "should name no cause when Claude Code reports this Stop was not blocked before",
    snippet: call(
      "downgrade_cause",
      JSON.stringify({ stop_hook_active: false })
    ),
  },
  {
    answer: "",
    name: "should name no cause when Cursor reports no auto-followup yet",
    snippet: call("downgrade_cause", JSON.stringify({ loop_count: 0 })),
  },
  {
    answer: "",
    name: "should name no cause when the payload is not JSON",
    snippet: call("downgrade_cause", "{not json"),
  },
  {
    answer: "yes",
    name: "should reach the quality gate when one changed path carries a code extension",
    snippet: `answers_yes ${call("holds_code_relevant_file", "docs/note.md\nsrc/a.ts")}`,
  },
  {
    answer: "no",
    name: "should skip the quality gate when every changed path is a document",
    snippet: `answers_yes ${call("holds_code_relevant_file", "docs/note.md\nREADME.md")}`,
  },
  {
    answer: "no",
    name: "should skip the quality gate when nothing changed",
    snippet: `answers_yes ${call("holds_code_relevant_file", "")}`,
  },
  {
    answer: "yes",
    name: "should reach the quality gate when the code file's name holds a space",
    snippet: `answers_yes ${call("holds_code_relevant_file", "src/my notes.ts")}`,
  },
  {
    answer: "no",
    name: "should skip the quality gate when a code extension sits inside the name rather than at its end",
    snippet: `answers_yes ${call("holds_code_relevant_file", "src/a.ts.bak")}`,
  },
  {
    answer: "yes",
    name: "should reach the quality gate when the matching path is followed by 20000 more",
    snippet: `answers_yes ${call("holds_code_relevant_file", LONG_LIST)}`,
  },
  {
    answer: SUMMARY,
    name: "should name the one step that failed in the summary",
    snippet: `${RECORD_CHECK}; failure_summary`,
  },
  {
    answer: "bun run check, bun run test failed. Fix before ending the turn.",
    name: "should name both steps in one summary when the step after a failing one fails too",
    snippet: `${RECORD_CHECK}; ${call("record_failure", "bun run test", "test said no")}; failure_summary`,
  },
  {
    answer: `===== markdown link check =====
links said no

${LINK_FAILED}`,
    name: "should carry the failing step's output and the link note into the body",
    snippet: `${call("record_failure", "markdown link check", "links said no")}; failure_body "$(link_note_failed)"`,
  },
  {
    answer: `⛔ Stop block: ${SUMMARY}`,
    name: "should mark the summary as a block when the gate blocks",
    snippet: call("block_message", SUMMARY),
  },
  {
    answer: `${SUMMARY}\n\nthe body`,
    name: "should separate the summary from the body by a blank line in the block reason",
    snippet: call("block_reason", SUMMARY, "the body"),
  },
  {
    answer: `⚠️ Stop gate STILL failing (not re-blocking — stop_hook_active): ${SUMMARY} — if this failure is pre-existing or unfixable, report it to the user explicitly; do not treat it as passed.\nthe body`,
    name: "should name the field that downgraded the block in the warning",
    snippet: call("warning_message", "stop_hook_active", SUMMARY, "the body"),
  },
  {
    answer: `✅ Stop gate: typecheck / lint / format and the test suite pass (${LINK_CLEAN})`,
    name: "should report the quality gate and a clean link check as passing",
    snippet: 'quality_gate_pass_message "$(link_note_clean)"',
  },
  {
    answer: `✅ Stop gate: no code-relevant changes (quality gate skipped, ${LINK_SKIPPED})`,
    name: "should report the skipped quality gate and the link check bun could not run",
    snippet: 'quality_gate_skipped_message "$(link_note_skipped)"',
  },
];

// The whole table is answered while this file is loaded, so each case below is
// a synchronous comparison and none of them carries the driver's wall time.
const RUN = await runDriver(CASES.map((one) => one.snippet));

describe("stop-gate-decision.sh", () => {
  it("should answer every snippet with nothing on stderr when the driver ran to the end", () => {
    expect({ answered: RUN.answers.length, stderr: RUN.stderr }).toStrictEqual({
      answered: CASES.length,
      stderr: "",
    });
  });

  it.each(CASES.map((one, index) => ({ ...one, index })))(
    "$name",
    ({ answer, index, name }) => {
      expect({ answer: RUN.answers[index], name }).toStrictEqual({
        answer,
        name,
      });
    }
  );
});
