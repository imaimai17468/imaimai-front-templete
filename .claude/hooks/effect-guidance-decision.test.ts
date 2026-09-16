/**
 * Exercise `guidance_reminder` in .claude/hooks/effect-guidance-decision.sh
 * against the three judgments it makes: which tool names write a file, which
 * paths hold Effect code, and which import spellings count as Effect.
 *
 * Every case here reaches the same code .claude/hooks/effect-guidance-reminder.sh
 * runs. effect-guidance-reminder.test.ts forks the hook instead, because what
 * it judges is the payload the hook reads, the marker file that silences the
 * second reminder of a session, and the JSON it prints.
 *
 * The whole table is answered before the first test runs, by one bash process
 * that sources the decision file once and reads NUL-delimited triples off
 * stdin. A case is then a synchronous comparison.
 *
 * A case asserts the whole reminder rather than that something was printed, so
 * rewording the sentence fails here and the reword reaches a reader who has to
 * agree with it.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { text } from "node:stream/consumers";
import { describe, expect, it } from "vite-plus/test";

const DECISION = path.resolve(
  import.meta.dirname,
  "effect-guidance-decision.sh"
);

/**
 * The reminder the hook feeds Claude as additionalContext.
 *
 * Spelled out rather than read back out of the decision file, because a test
 * that took the sentence from the file under test would pass whatever that
 * file said.
 */
const REMINDER =
  "This file imports Effect. Read node_modules/effect/AGENTS.md completely and follow the links it names before writing or changing Effect code here. That file is the pinned version's own guidance, and AGENTS.md (Knowledge Currency) ranks it above your training data and above a web search. For an API or a concept it leaves out, search node_modules/effect/src, which is that version's source.";

/**
 * `read -d ''` splits on NUL, so a file's text spanning lines arrives in one
 * piece, and the three fields of a case arrive in the order they were sent.
 *
 * `guidance_reminder` reads from /dev/null because the cases still queued on
 * the driver's own stdin would otherwise be there for anything it forks, where
 * under effect-guidance-reminder.sh the payload has already been read to EOF
 * by the time the same call runs.
 */
const DRIVER = `
. "$1"
while IFS= read -r -d '' TOOL; do
  IFS= read -r -d '' FILE
  IFS= read -r -d '' TEXT
  ANSWER=$(guidance_reminder "$TOOL" "$FILE" "$TEXT" </dev/null)
  printf '%s\\0' "$ANSWER"
done
`;

/** How long the driver may take before it is killed. */
const DRIVER_TIMEOUT_MS = 60_000;

/** One row of the table: what the hook was handed, and what it must answer. */
interface Case {
  readonly answer: string;
  readonly file: string;
  readonly name: string;
  readonly text: string;
  readonly tool: string;
}

const EFFECT_IMPORT = 'import { Option } from "effect";';

const CASES: readonly Case[] = [
  {
    answer: REMINDER,
    file: "src/gateways/user/index.ts",
    name: "should ask for the guidance when an Edit writes a TypeScript file that imports Effect",
    text: EFFECT_IMPORT,
    tool: "Edit",
  },
  {
    answer: REMINDER,
    file: "src/components/shared/mode-toggle/mode-toggle.tsx",
    name: "should ask for the guidance when a Write writes a TSX file that imports Effect",
    text: EFFECT_IMPORT,
    tool: "Write",
  },
  {
    answer: REMINDER,
    file: "src/gateways/user/index.ts",
    name: "should ask for the guidance when a MultiEdit writes a TypeScript file that imports Effect",
    text: EFFECT_IMPORT,
    tool: "MultiEdit",
  },
  {
    answer: REMINDER,
    file: "src/lib/auth/session.live.ts",
    name: "should ask for the guidance when the import is written with single quotes",
    text: "import { Option } from 'effect';",
    tool: "Edit",
  },
  {
    answer: REMINDER,
    file: "src/lib/db.ts",
    name: "should ask for the guidance when the import names one of Effect's subpaths",
    text: 'import { SqlClient } from "effect/unstable/sql";',
    tool: "Edit",
  },
  {
    answer: "",
    file: "src/gateways/user/index.ts",
    name: "should say nothing when the tool is a Read",
    text: EFFECT_IMPORT,
    tool: "Read",
  },
  {
    answer: "",
    file: "src/gateways/user/index.ts",
    name: "should say nothing when the tool is a Bash call",
    text: EFFECT_IMPORT,
    tool: "Bash",
  },
  {
    answer: "",
    file: "AGENTS.md",
    name: "should say nothing when the path is a Markdown file quoting an Effect import",
    text: EFFECT_IMPORT,
    tool: "Edit",
  },
  {
    answer: "",
    file: "package.json",
    name: "should say nothing when the path is a JSON file naming Effect",
    text: '"effect": "4.0.0-rc.112"',
    tool: "Edit",
  },
  {
    answer: "",
    file: "src/lib/utils.ts",
    name: "should say nothing when the TypeScript file imports no Effect",
    text: 'import { clsx } from "clsx";',
    tool: "Edit",
  },
  {
    answer: "",
    file: "vite.config.ts",
    name: "should say nothing when the module name only ends with the library's name",
    text: 'import effect from "oxlint-plugin-effect";',
    tool: "Edit",
  },
  {
    answer: "",
    file: "oxlint.effect.ts",
    name: "should say nothing when a relative specifier ends with the library's name",
    text: 'import { effectRules } from "./oxlint.effect.ts";',
    tool: "Edit",
  },
  {
    answer: "",
    file: "src/lib/utils.ts",
    name: "should say nothing when the edit writes no text",
    text: "",
    tool: "Edit",
  },
];

/** Answer the whole table in one bash process. */
const runDriver = async (): Promise<readonly string[]> => {
  const driver = spawn("bash", ["-c", DRIVER, "bash", DECISION], {
    killSignal: "SIGKILL",
    timeout: DRIVER_TIMEOUT_MS,
  });
  driver.stdin.end(
    CASES.map(
      ({ file, text: body, tool }) => `${tool}\0${file}\0${body}\0`
    ).join("")
  );
  const stdout = await text(driver.stdout);
  // The driver terminates every answer with a NUL, so the split leaves one
  // trailing empty piece that belongs to no case.
  return stdout.split("\0").slice(0, -1);
};

const answers = await runDriver();

/**
 * Each case's answer under its own name, so a case reads the answer it asked
 * for rather than one at a position it has to keep track of. A case the driver
 * never reached has no answer at all, which fails that case rather than
 * reading as silence.
 */
const answered = new Map(
  CASES.map((testCase, index) => [testCase.name, answers[index]] as const)
);

describe("guidance_reminder", () => {
  it.each(CASES)("$name", ({ answer, name }) => {
    expect({ answer: answered.get(name), name }).toStrictEqual({
      answer,
      name,
    });
  });

  it("should answer every case when the whole table is sent at once", () => {
    expect(answers).toHaveLength(CASES.length);
  });
});
