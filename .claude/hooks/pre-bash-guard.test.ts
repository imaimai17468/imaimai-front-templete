/**
 * Exercise .claude/hooks/pre-bash-guard.sh against the payloads it reads and
 * the JSON it prints.
 *
 * What the guard refuses is decided in pre-bash-guard-decision.sh, and
 * pre-bash-guard-decision.test.ts drives that file's `guard_refusal` over the
 * command table without forking the hook. What is left here is the entry's
 * own: which tool names reach the guards, what happens when the decision file
 * cannot be loaded, the default a payload without a command takes, and the
 * deny JSON in both dialects with the exit status and the empty stderr that
 * travel with it.
 *
 * Every case forks the hook, which forks jq of its own, so the cases of this
 * file run concurrently. Nothing in the repository is modified and no command
 * from a case is ever executed.
 */

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { text } from "node:stream/consumers";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { z } from "zod";
import { readHookJson } from "./hook-output";

const HOOK = path.resolve(import.meta.dirname, "pre-bash-guard.sh");

/** A sweep the unnamed-changes gate refuses, which every deny case here sends. */
const SWEEP = "git add -A";

const SWEEP_REASON =
  "PreToolUse(Bash): this `git add` is refused because the short option -A stages every change in the worktree instead of the paths you name. Name the files this commit needs (`git add src/foo.ts src/bar.ts`), and take part of a file with `git add -p`. `git status --short` lists what changed.";

/**
 * The two dialects a deny is emitted in at once: Claude Code reads the legacy
 * decision/reason pair, Cursor reads hookSpecificOutput. Both carry the same
 * sentence, and a case asserts the whole object so a dialect that drops a
 * field or disagrees with the other one fails.
 */
const HookOutput = z.object({
  decision: z.string(),
  hookSpecificOutput: z.object({
    hookEventName: z.string(),
    permissionDecision: z.string(),
    permissionDecisionReason: z.string(),
  }),
  reason: z.string(),
});

const denyOutput = (reason: string): z.infer<typeof HookOutput> => ({
  decision: "block",
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
  reason,
});

/** node emits `close` with the exit code and the signal that ended the child. */
const CloseArgs = z.tuple([z.number().nullable(), z.string().nullable()]);

const exitStatusOf = async (hook: ChildProcess): Promise<number | null> => {
  const closed: unknown = await once(hook, "close");
  const [status] = CloseArgs.parse(closed);
  return status;
};

/**
 * What one run of the hook produced.
 *
 * Silence is how the hook spells "allow", so a hook that died before printing
 * produces the same empty stdout as an allow, and every `exit` in
 * pre-bash-guard.sh is `exit 0`, both deny sites included. So a case asserts
 * the status and the empty stderr with the output, and a guard that dies on
 * the CI runner fails the cases expecting allow rather than passing them.
 */
interface HookRun {
  output: "" | z.infer<typeof HookOutput>;
  status: number | null;
  stderr: string;
}

/**
 * A PreToolUse payload as the two harnesses send it. `command` is optional
 * because the hook defaults it, and `tool_name` is a plain string because the
 * tool names that reach the guards are what a case here decides.
 */
interface Payload {
  tool_input: { command?: string };
  tool_name: string;
}

const runHook = async (payload: Payload, hookPath = HOOK): Promise<HookRun> => {
  const hook = spawn("bash", [hookPath]);
  hook.stdin.end(JSON.stringify(payload));
  const [stdout, stderr, status] = await Promise.all([
    text(hook.stdout),
    text(hook.stderr),
    exitStatusOf(hook),
  ]);
  return {
    output: stdout.trim() === "" ? "" : readHookJson(stdout, HookOutput),
    status,
    stderr,
  };
};

const bashPayload = (command: string): Payload => ({
  tool_input: { command },
  tool_name: "Bash",
});

// A case waits on the other cases of its group, so its wall time tracks the
// machine's load rather than the hook's own work. At vitest's 5 s default this
// file failed 18 of its 202 cases in one round of three, and passed the other
// two, on a machine under parallel load (2026-09-09). Six times that default
// carried three rounds run beside a `bun run check`, and a hook that hangs
// still fails.
const HOOK_TIMEOUT_MS = 30_000;

describe.concurrent("the deny the hook prints", () => {
  it(
    "should carry the refusal in both dialects when a guard refuses the command",
    async () => {
      await expect(runHook(bashPayload(SWEEP))).resolves.toStrictEqual({
        output: denyOutput(SWEEP_REASON),
        status: 0,
        stderr: "",
      });
    },
    HOOK_TIMEOUT_MS
  );

  it(
    "should stay silent when no guard refuses the command",
    async () => {
      await expect(runHook(bashPayload("ls -la"))).resolves.toStrictEqual({
        output: "",
        status: 0,
        stderr: "",
      });
    },
    HOOK_TIMEOUT_MS
  );
});

describe.concurrent("the payload's tool name decides whether the guards run", () => {
  it(
    "should refuse the same sweep it refuses for Bash when the payload names Cursor's Shell tool",
    async () => {
      await expect(
        runHook({ tool_input: { command: SWEEP }, tool_name: "Shell" })
      ).resolves.toStrictEqual({
        output: denyOutput(SWEEP_REASON),
        status: 0,
        stderr: "",
      });
    },
    HOOK_TIMEOUT_MS
  );

  it(
    "should let the payload through untouched when its tool is not a terminal",
    async () => {
      await expect(
        runHook({ tool_input: { command: SWEEP }, tool_name: "Read" })
      ).resolves.toStrictEqual({ output: "", status: 0, stderr: "" });
    },
    HOOK_TIMEOUT_MS
  );
});

describe.concurrent("the payload's command is what the guards read", () => {
  it(
    "should judge the empty command when the payload carries no command at all",
    async () => {
      await expect(
        runHook({ tool_input: {}, tool_name: "Bash" })
      ).resolves.toStrictEqual({ output: "", status: 0, stderr: "" });
    },
    HOOK_TIMEOUT_MS
  );
});

describe.concurrent("the decision file the hook sources", () => {
  it(
    "should refuse the command when the decision file is not beside the hook",
    async () => {
      const alone = fs.mkdtempSync(path.join(os.tmpdir(), "pre-bash-guard-"));
      onTestFinished(() => {
        fs.rmSync(alone, { force: true, recursive: true });
      });
      const copy = path.join(alone, "pre-bash-guard.sh");
      fs.copyFileSync(HOOK, copy);

      await expect(runHook(bashPayload(SWEEP), copy)).resolves.toStrictEqual({
        output: denyOutput(
          `PreToolUse(Bash): the guard could not load ${alone}/pre-bash-guard-decision.sh, so nothing checked this command. Put that file back beside pre-bash-guard.sh, or run the hook by a path that names its directory.`
        ),
        status: 0,
        stderr: "",
      });
    },
    HOOK_TIMEOUT_MS
  );
});
