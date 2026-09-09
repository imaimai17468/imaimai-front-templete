/**
 * Exercise .claude/hooks/pre-bash-guard.sh against the payloads it reads and
 * the JSON it prints.
 *
 * What the guard refuses is decided in pre-bash-guard-decision.sh, and
 * pre-bash-guard-decision.test.ts drives that file's `guard_refusal` over the
 * command table without forking the hook. What is left here is the entry's
 * own: which tool names reach the guards, what happens when the decision file
 * cannot be loaded, what the command it reads out of the payload is, and the
 * deny JSON in both dialects with the exit status and the empty stderr that
 * travel with it.
 *
 * One refusal sentence is spelled out below even though pre-bash-guard-decision.sh
 * is what words it. A deny case asserts the whole object jq built, and the
 * sentence is what says it reached both of that object's dialects unchanged
 * through the command substitution that read it. Rewording that branch of the
 * guard therefore fails a case here too.
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

describe.concurrent("the deny the hook prints", () => {
  it("should carry the refusal in both dialects when a guard refuses the command", async () => {
    await expect(runHook(bashPayload(SWEEP))).resolves.toStrictEqual({
      output: denyOutput(SWEEP_REASON),
      status: 0,
      stderr: "",
    });
  });

  it("should stay silent when no guard refuses the command", async () => {
    await expect(runHook(bashPayload("ls -la"))).resolves.toStrictEqual({
      output: "",
      status: 0,
      stderr: "",
    });
  });
});

describe.concurrent("the payload's tool name decides whether the guards run", () => {
  it("should refuse the same sweep it refuses for Bash when the payload names Cursor's Shell tool", async () => {
    await expect(
      runHook({ tool_input: { command: SWEEP }, tool_name: "Shell" })
    ).resolves.toStrictEqual({
      output: denyOutput(SWEEP_REASON),
      status: 0,
      stderr: "",
    });
  });

  it("should let the payload through untouched when its tool is not a terminal", async () => {
    await expect(
      runHook({ tool_input: { command: SWEEP }, tool_name: "Read" })
    ).resolves.toStrictEqual({ output: "", status: 0, stderr: "" });
  });
});

describe.concurrent("the payload's command is what the guards read", () => {
  // What the hook reads out of a payload with no command is `null` where the
  // `// ""` default is deleted and the empty string where it stays, and the
  // guards allow both, so this case pins the run rather than the default:
  // the hook finishes, prints nothing and writes nothing to stderr.
  it("should finish silently when the payload carries no command at all", async () => {
    await expect(
      runHook({ tool_input: {}, tool_name: "Bash" })
    ).resolves.toStrictEqual({ output: "", status: 0, stderr: "" });
  });

  // On one line this command blocks, because the heredoc body stops being a
  // body and its `find` becomes a command the find gate reads. So an allow
  // here is what says the newlines survived `jq -r` and the command
  // substitution that reads them.
  it("should read the heredoc body as data when the payload's command spans lines", async () => {
    await expect(
      runHook(bashPayload("cat <<'EOF'\nfind . -delete\nEOF\necho done"))
    ).resolves.toStrictEqual({ output: "", status: 0, stderr: "" });
  });
});

describe.concurrent("the decision file the hook sources", () => {
  it("should refuse the command when the decision file is not beside the hook", async () => {
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
  });
});
