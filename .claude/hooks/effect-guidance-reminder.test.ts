/**
 * Exercise .claude/hooks/effect-guidance-reminder.sh against the payloads it
 * reads and the JSON it prints.
 *
 * Which tool, path and text earn a reminder is decided in
 * effect-guidance-decision.sh, and effect-guidance-decision.test.ts drives
 * that file's `guidance_reminder` over the whole table without forking the
 * hook. What is left here is the entry's own: where it finds the text an edit
 * produces, the marker directory that leaves a session with one reminder, what
 * it prints, and what it does when the decision file cannot be loaded.
 *
 * Every case forks the hook under its own TMPDIR and its own session id, so no
 * case sees another's marker. Nothing in the repository is modified.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { readHookJson } from "./hook-output";
import { runBash } from "./run-bash";

const HOOK = path.resolve(import.meta.dirname, "effect-guidance-reminder.sh");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "effect-guidance-"));

/** The additionalContext shape the hook prints, and silence read as an empty object. */
const Printed = z.object({
  hookSpecificOutput: z
    .object({
      additionalContext: z.string(),
      hookEventName: z.literal("PreToolUse"),
    })
    .optional(),
});

/**
 * The whole object a reminder is printed as.
 *
 * Spelled out rather than read back out of the hook, because a test that took
 * the sentence from the file under test would pass whatever that file said.
 */
const PRINTED_REMINDER = {
  hookSpecificOutput: {
    additionalContext:
      "This file imports Effect. Read node_modules/effect/AGENTS.md completely and follow the links it names before writing or changing Effect code here. That file is the pinned version's own guidance, and AGENTS.md (Knowledge Currency) ranks it above your training data and above a web search. For an API or a concept it leaves out, search node_modules/effect/src, which is that version's source.",
    hookEventName: "PreToolUse",
  },
};

const EFFECT_IMPORT = 'import { Option } from "effect";';

/** One edit of a MultiEdit, as the entry reads it out of the payload. */
interface PayloadEdit {
  readonly new_string: string;
  readonly old_string: string;
}

/** The fields of a PreToolUse payload this hook reads. */
interface Payload {
  readonly session_id?: string;
  readonly tool_input: {
    readonly content?: string;
    readonly edits?: readonly PayloadEdit[];
    readonly file_path: string;
    readonly new_string?: string;
    readonly old_string?: string;
  };
  readonly tool_name: string;
}

/** A directory of this case's own, so its marker and its fixtures reach no other case. */
const caseDir = (name: string): string =>
  fs.mkdtempSync(path.join(ROOT, `${name}-`));

/**
 * Run the hook on one payload.
 *
 * `TMPDIR` points at the directory given, which is where the hook claims the
 * marker that silences a session's second reminder, so a case that runs the
 * hook twice sees the suppression and a case that runs it once does not
 * inherit another's.
 */
const runHook = async (payload: Payload, tmpdir: string, hook = HOOK) =>
  await runBash(hook, {
    env: { ...process.env, TMPDIR: tmpdir },
    input: JSON.stringify(payload),
  });

const editPayload = (
  filePath: string,
  newString: string,
  session: string
): Payload => ({
  session_id: session,
  tool_input: { file_path: filePath, new_string: newString, old_string: "" },
  tool_name: "Edit",
});

describe("effect-guidance-reminder.sh", () => {
  afterAll(() => {
    fs.rmSync(ROOT, { force: true, recursive: true });
  });

  it("should ask for the guidance when an edit adds an Effect import to a file that had none", async () => {
    const dir = caseDir("adds-import");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, 'import { clsx } from "clsx";\n');

    const run = await runHook(editPayload(file, EFFECT_IMPORT, "s-adds"), dir);

    expect(readHookJson(run.stdout, Printed)).toStrictEqual(PRINTED_REMINDER);
  });

  it("should ask for the guidance when a Write creates a file whose content imports Effect", async () => {
    const dir = caseDir("write-content");

    const run = await runHook(
      {
        session_id: "s-write",
        tool_input: {
          content: EFFECT_IMPORT,
          file_path: path.join(dir, "new-gateway.ts"),
        },
        tool_name: "Write",
      },
      dir
    );

    expect(readHookJson(run.stdout, Printed)).toStrictEqual(PRINTED_REMINDER);
  });

  it("should ask for the guidance when the edited text carries no import but the file on disk does", async () => {
    const dir = caseDir("import-on-disk");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\nconst a = 1;\n`);

    const run = await runHook(
      editPayload(file, "const a = 2;", "s-on-disk"),
      dir
    );

    expect(readHookJson(run.stdout, Printed)).toStrictEqual(PRINTED_REMINDER);
  });

  it("should ask for the guidance when a MultiEdit's edits carry the import", async () => {
    const dir = caseDir("multi-edit");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, "const a = 1;\n");

    const run = await runHook(
      {
        session_id: "s-multi",
        tool_input: {
          edits: [{ new_string: EFFECT_IMPORT, old_string: "" }],
          file_path: file,
        },
        tool_name: "MultiEdit",
      },
      dir
    );

    expect(readHookJson(run.stdout, Printed)).toStrictEqual(PRINTED_REMINDER);
  });

  it("should say nothing when the same session has already had its reminder", async () => {
    const dir = caseDir("second-edit");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\n`);
    const payload = editPayload(file, "const a = 1;", "s-twice");
    await runHook(payload, dir);

    const second = await runHook(payload, dir);

    expect(second.stdout).toBe("");
  });

  it("should remind once when one session's edits run at the same time", async () => {
    const dir = caseDir("concurrent");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\n`);
    const payload = editPayload(file, "const a = 1;", "s-concurrent");

    const runs = await Promise.all(
      [1, 2, 3, 4, 5].map(async () => await runHook(payload, dir))
    );

    expect(runs.filter((run) => run.stdout !== "")).toHaveLength(1);
  });

  it("should remind every time when the payload carries no id to count by", async () => {
    const dir = caseDir("no-id");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\n`);
    const payload: Payload = {
      tool_input: { file_path: file, new_string: "const a = 1;" },
      tool_name: "Edit",
    };
    await runHook(payload, dir);

    const second = await runHook(payload, dir);

    expect(readHookJson(second.stdout, Printed)).toStrictEqual(
      PRINTED_REMINDER
    );
  });

  it("should stay silent when the marker cannot be claimed because TMPDIR is missing", async () => {
    const dir = caseDir("missing-tmpdir");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\n`);

    const run = await runHook(
      editPayload(file, "const a = 1;", "s-missing"),
      path.join(dir, "never-created")
    );

    expect({
      status: run.status,
      stderr: run.stderr,
      stdout: run.stdout,
    }).toStrictEqual({ status: 0, stderr: "", stdout: "" });
  });

  it("should say nothing when the tool only reads a file", async () => {
    const dir = caseDir("read-tool");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\n`);

    const run = await runHook(
      {
        session_id: "s-read",
        tool_input: { file_path: file },
        tool_name: "Read",
      },
      dir
    );

    expect(run.stdout).toBe("");
  });

  it("should say nothing when the edited file imports no Effect", async () => {
    const dir = caseDir("no-effect");
    const file = path.join(dir, "utils.ts");
    fs.writeFileSync(file, 'import { clsx } from "clsx";\n');

    const run = await runHook(
      editPayload(file, "const a = 1;", "s-no-effect"),
      dir
    );

    expect(run.stdout).toBe("");
  });

  it("should say nothing when the decision file is not beside it", async () => {
    const dir = caseDir("no-decision");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\n`);
    const orphan = path.join(dir, "effect-guidance-reminder.sh");
    fs.copyFileSync(HOOK, orphan);

    const run = await runHook(
      editPayload(file, EFFECT_IMPORT, "s-orphan"),
      dir,
      orphan
    );

    expect(run.stdout).toBe("");
  });

  it("should leave the tool call alone by exiting zero when it asks for the guidance", async () => {
    const dir = caseDir("exit-status");
    const file = path.join(dir, "gateway.ts");
    fs.writeFileSync(file, `${EFFECT_IMPORT}\n`);

    const run = await runHook(editPayload(file, "const a = 1;", "s-exit"), dir);

    expect({ status: run.status, stderr: run.stderr }).toStrictEqual({
      status: 0,
      stderr: "",
    });
  });
});
