/**
 * Exercise .claude/hooks/stop-gate.sh against the payloads and step outcomes it
 * has to judge.
 *
 * Two of its decisions cost a turn's report when they break, and both broke:
 * a failure body over ARG_MAX made `jq --arg` fail with E2BIG, so the gate ended
 * the turn having printed nothing, and a LINK_NOTE left at "clean" contradicted
 * the link failure in the same body. Each case runs the real hook against a
 * scratch git repository whose `check`, `test` and link-check steps this file
 * writes, so no step of this repository's own toolchain runs.
 *
 * A gate run over a code change execs 14 processes, three of them bun, so the
 * cases run concurrently and copy their repository from one committed tree
 * this file builds once.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { readHookJson } from "./hook-output";
import { runBash } from "./run-bash";

const GATE = path.resolve(import.meta.dirname, "stop-gate.sh");
const DECISION = path.resolve(import.meta.dirname, "stop-gate-decision.sh");

/**
 * Everything the cases write lives under `scratchRoot`, and the suite's
 * `afterAll` removes it. `onTestFinished` registers against whichever case is
 * current when it runs, and under `describe.concurrent` that is not reliably
 * the case that asked for the directory. Removing each case's tree that way
 * failed three of eight runs of this file; removing one root when the file
 * ends failed none of eight.
 *
 * Both are assigned in `beforeAll` rather than here, because vitest runs
 * neither hook for a suite whose cases a `-t` filter all deselects, which left
 * the directories behind while `mkdtempSync` ran at collection time.
 */
let scratchRoot = "";
let templateRoot = "";

/** A directory the case owns. */
const scratchDir = (prefix: string): string =>
  fs.mkdtempSync(path.join(scratchRoot, prefix));

/** A step's stand-in: what `bun run <script>` runs, and what bun executes for the link check. */
interface Steps {
  check: string;
  test: string;
  /** The body of the check-md-links.ts stand-in bun runs directly. */
  links: string;
}

const PASSING: Steps = {
  check: "exit 0",
  links: "process.exit(0);",
  test: "exit 0",
};

/**
 * The paths carrying the step stand-ins, which `scratchRepo` writes with the
 * bodies its caller chose. The template repository lists them in
 * `.git/info/exclude`, so `git status --porcelain` and `git ls-files --others
 * --exclude-standard` report neither and one committed tree serves every set
 * of steps.
 */
const STAND_INS = {
  links: ".claude/hooks/check-md-links.ts",
  packageJson: "package.json",
} as const;

const git = (root: string, ...args: string[]): void => {
  // The identity comes from the environment because a CI runner's git has
  // none, and signing is turned off because a machine whose global config
  // signs every commit has no key for this scratch repository.
  const result = spawnSync(
    "git",
    ["-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args],
    {
      cwd: root,
      encoding: "utf-8",
      env: {
        ...process.env,
        GIT_AUTHOR_EMAIL: "gate@example.com",
        GIT_AUTHOR_NAME: "gate",
        GIT_COMMITTER_EMAIL: "gate@example.com",
        GIT_COMMITTER_NAME: "gate",
      },
    }
  );
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
};

const createScratchTrees = (): void => {
  scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stop-gate-cases-"));
  templateRoot = fs.mkdtempSync(path.join(scratchRoot, "template-"));
  git(templateRoot, "init", "--quiet");
  fs.mkdirSync(path.join(templateRoot, path.dirname(STAND_INS.links)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(templateRoot, ".git/info/exclude"),
    `${Object.values(STAND_INS)
      .map((standIn) => `/${standIn}`)
      .join("\n")}\n`
  );
  git(templateRoot, "commit", "--allow-empty", "--quiet", "-m", "scaffolding");
};

/**
 * A git repository carrying one commit and the three step stand-ins, plus the
 * named files left untracked so `git status --porcelain` reports them and
 * `holds_code_relevant_file` sees them.
 */
const scratchRepo = (steps: Steps, untracked: readonly string[]): string => {
  const root = scratchDir("stop-gate-");
  fs.cpSync(templateRoot, root, { recursive: true });
  fs.writeFileSync(
    path.join(root, STAND_INS.packageJson),
    `${JSON.stringify({
      name: "stop-gate-scratch",
      scripts: { check: steps.check, test: steps.test },
    })}\n`
  );
  fs.writeFileSync(path.join(root, STAND_INS.links), `${steps.links}\n`);
  untracked.forEach((name) => {
    fs.writeFileSync(path.join(root, name), "x\n");
  });
  return root;
};

/**
 * The gate's own output shape. Each field defaults to "" so a run that emitted
 * nothing, and one whose branch emits no `decision`, both read as absent rather
 * than as a parse failure.
 */
const GateOutput = z.object({
  decision: z.string().default(""),
  reason: z.string().default(""),
  systemMessage: z.string().default(""),
});

/** What one Stop gate run reported. */
type GateRun = z.infer<typeof GateOutput> & {
  status: number | null;
  stdout: string;
};

/** The Stop payload the harness sends. JSON.stringify drops the absent fields. */
interface StopPayload {
  cwd: string;
  loop_count: number | undefined;
  stop_hook_active: boolean | undefined;
}

interface RunOptions {
  /** Overrides the payload's `cwd`, which the gate prefers over CLAUDE_PROJECT_DIR. */
  cwd?: string;
  /** Overrides the copy of the gate that runs, which decides where it looks for the decision file. */
  gate?: string;
  loopCount?: number;
  path?: string;
  projectDir?: string;
  stopHookActive?: boolean;
}

const runGate = async (
  root: string,
  options: RunOptions = {}
): Promise<GateRun> => {
  const payload: StopPayload = {
    cwd: options.cwd ?? root,
    loop_count: options.loopCount,
    stop_hook_active: options.stopHookActive,
  };
  const result = await runBash(options.gate ?? GATE, {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: options.projectDir ?? root,
      PATH: options.path ?? process.env.PATH,
    },
    input: JSON.stringify(payload),
  });
  return {
    ...readHookJson(result.stdout, GateOutput),
    status: result.status,
    stdout: result.stdout,
  };
};

/**
 * The gate's warning branch puts the failure body in the same string as its
 * summary, separated by a newline, so a case about the summary reads this.
 */
const firstLine = (text: string): string => text.split("\n")[0] ?? "";

/**
 * A PATH resolving the named commands and nothing else, so `command -v bun`
 * answers no while the commands the gate needs before it still resolve. `bash`
 * is one of them because node looks the gate's own interpreter up on this PATH.
 */
const pathWithOnly = (names: readonly string[]): string => {
  const dir = scratchDir("stop-gate-path-");
  const searched = (process.env.PATH ?? "").split(path.delimiter);
  names.forEach((name) => {
    const found = searched
      .map((searchDir) => path.join(searchDir, name))
      .find((candidate) => fs.existsSync(candidate));
    if (found === undefined) {
      throw new Error(`${name} is not on PATH, so this case cannot run`);
    }
    fs.symlinkSync(found, path.join(dir, name));
  });
  return dir;
};

// The timeout bounds a gate that hangs rather than budgeting one case. A
// case's wall clock here is set by how many of its neighbours are forking at
// the same moment: the slowest reached 2.2 s on an idle machine, and at the
// 5 s default a loaded one failed two of the fifteen before any assertion ran.
describe.concurrent("stop-gate.sh", { timeout: 30_000 }, () => {
  // `git init` plus `git commit` take 275 ms together on this machine (macOS,
  // 2026-09-09) and copying the tree they leave takes 0.8 ms, so the history
  // is built once here rather than at each of `scratchRepo`'s 13 call sites.
  beforeAll(createScratchTrees);

  afterAll(() => {
    fs.rmSync(scratchRoot, { force: true, recursive: true });
  });

  it("should stay silent when the tree holds no change", async () => {
    const root = scratchRepo(PASSING, []);

    const run = await runGate(root);

    expect({ status: run.status, stdout: run.stdout }).toStrictEqual({
      status: 0,
      stdout: "",
    });
  });

  it("should skip the quality gate when only a docs file changed", async () => {
    const root = scratchRepo(PASSING, ["notes.md"]);

    const run = await runGate(root);

    expect(run.systemMessage).toBe(
      "✅ Stop gate: no code-relevant changes (quality gate skipped, md links: clean)"
    );
  });

  it("should report the quality gate and the link check as passing when a code file changed and every step succeeds", async () => {
    const root = scratchRepo(PASSING, ["a.ts"]);

    const run = await runGate(root);

    expect(run.systemMessage).toBe(
      "✅ Stop gate: typecheck / lint / format and the test suite pass (md links: clean)"
    );
  });

  it("should block and name the step when the quality gate fails", async () => {
    const root = scratchRepo({ ...PASSING, check: "exit 1" }, ["a.ts"]);

    const run = await runGate(root);

    expect({
      decision: run.decision,
      status: run.status,
      systemMessage: run.systemMessage,
    }).toStrictEqual({
      decision: "block",
      status: 0,
      systemMessage:
        "⛔ Stop block: bun run check failed. Fix before ending the turn.",
    });
  });

  it("should name both steps in one block when the step after a failing one fails too", async () => {
    const root = scratchRepo({ ...PASSING, check: "exit 1", test: "exit 1" }, [
      "a.ts",
    ]);

    const run = await runGate(root);

    expect(run.systemMessage).toBe(
      "⛔ Stop block: bun run check, bun run test failed. Fix before ending the turn."
    );
  });

  it("should report the link check as failed rather than clean when it fails", async () => {
    const root = scratchRepo(
      {
        ...PASSING,
        links: 'console.log("links said no");\nprocess.exit(1);',
      },
      ["a.ts"]
    );

    const run = await runGate(root);

    expect({ decision: run.decision, reason: run.reason }).toStrictEqual({
      decision: "block",
      reason: `markdown link check failed. Fix before ending the turn.

===== markdown link check =====
links said no

md links: FAILED`,
    });
  });

  // `jq --arg body "$2"` failed with E2BIG here (ARG_MAX is 1048576 on macOS,
  // and Linux caps one argument at 131072), and the gate's own `exit` then
  // ended the turn having printed nothing at all.
  it("should carry the whole failure body into the block when that body is larger than ARG_MAX", async () => {
    const fillerBytes = 1_500_000;
    const root = scratchRepo(
      {
        ...PASSING,
        // `process.exit` after a write this large on a pipe dropped everything
        // past 65 KB, so the exit code is set and the runtime flushes on its own.
        links: `process.stdout.write("x".repeat(${fillerBytes}) + "\\ntail-marker\\n");\nprocess.exitCode = 1;`,
      },
      ["a.ts"]
    );
    // The reason is this head, the filler, and this tail; the whole 1.5 MB
    // string is never built here, because only its length is compared.
    const head =
      "markdown link check failed. Fix before ending the turn.\n\n===== markdown link check =====\n";
    const tail = "\ntail-marker\n\nmd links: FAILED";

    const run = await runGate(root);

    expect({
      decision: run.decision,
      reasonBytes: run.reason.length,
      reasonTail: run.reason.slice(-tail.length),
    }).toStrictEqual({
      decision: "block",
      reasonBytes: head.length + fillerBytes + tail.length,
      reasonTail: tail,
    });
  });

  it("should warn instead of blocking when Claude Code reports this Stop was already blocked", async () => {
    const root = scratchRepo({ ...PASSING, check: "exit 1" }, ["a.ts"]);

    const run = await runGate(root, { stopHookActive: true });

    expect({
      decision: run.decision,
      summary: firstLine(run.systemMessage),
    }).toStrictEqual({
      decision: "",
      summary:
        "⚠️ Stop gate STILL failing (not re-blocking — stop_hook_active): bun run check failed. Fix before ending the turn. — if this failure is pre-existing or unfixable, report it to the user explicitly; do not treat it as passed.",
    });
  });

  it("should warn instead of blocking when Cursor reports an auto-followup already ran", async () => {
    const root = scratchRepo({ ...PASSING, check: "exit 1" }, ["a.ts"]);

    const run = await runGate(root, { loopCount: 1 });

    expect({
      decision: run.decision,
      summary: firstLine(run.systemMessage),
    }).toStrictEqual({
      decision: "",
      summary:
        "⚠️ Stop gate STILL failing (not re-blocking — loop_count): bun run check failed. Fix before ending the turn. — if this failure is pre-existing or unfixable, report it to the user explicitly; do not treat it as passed.",
    });
  });

  it("should report the link check as skipped rather than clean when bun is not installed", async () => {
    const root = scratchRepo(PASSING, ["notes.md"]);

    const run = await runGate(root, {
      path: pathWithOnly(["bash", "cat", "git", "jq", "sort"]),
    });

    expect(run.systemMessage).toBe(
      "✅ Stop gate: no code-relevant changes (quality gate skipped, md links: SKIPPED (bun not installed))"
    );
  });

  // In a worktree session CLAUDE_PROJECT_DIR is the checkout the session
  // started in and the payload's cwd is the one the turn edited, so the gate
  // prefers cwd. The session tree here is clean, which is what the gate would
  // report if it read CLAUDE_PROJECT_DIR instead.
  it("should judge the tree the payload names when the session started in another one", async () => {
    const session = scratchRepo(PASSING, []);
    const work = scratchRepo(PASSING, ["a.ts"]);

    const run = await runGate(work, { cwd: work, projectDir: session });

    expect(run.systemMessage).toBe(
      "✅ Stop gate: typecheck / lint / format and the test suite pass (md links: clean)"
    );
  });

  // The scratch repository's `check` fails, so a gate that carried on in the
  // wrong tree would block naming `bun run check` rather than the root.
  it("should block naming the unreachable root when it cannot enter the tree to judge", async () => {
    const root = scratchRepo({ ...PASSING, check: "exit 1" }, ["a.ts"]);
    const missing = path.join(root, "gone");

    const run = await runGate(root, { cwd: missing, projectDir: missing });

    expect({
      decision: run.decision,
      status: run.status,
      systemMessage: run.systemMessage,
    }).toStrictEqual({
      decision: "block",
      status: 0,
      systemMessage: `⛔ Stop block: the Stop gate could not enter ${missing}, so no check ran.`,
    });
  });

  // `.git` is a file holding text that is not a gitfile pointer, so `git status`
  // exits non-zero with empty stdout without walking up to any repository above
  // the scratch directory. The gate's step stand-ins are absent, so a gate that
  // read that emptiness as a clean tree would exit 0 having judged nothing.
  it("should block naming the root when it cannot read git status in the tree", async () => {
    const broken = scratchDir("stop-gate-nogit-");
    fs.mkdirSync(path.join(broken, ".claude/hooks"), { recursive: true });
    fs.writeFileSync(path.join(broken, ".git"), "not a gitfile\n");

    const run = await runGate(broken, { cwd: broken, projectDir: broken });

    expect({
      decision: run.decision,
      status: run.status,
      systemMessage: run.systemMessage,
    }).toStrictEqual({
      decision: "block",
      status: 0,
      systemMessage: `⛔ Stop block: the Stop gate could not read git status in ${broken}, so no check ran.`,
    });
  });

  // A copy of the entry alone has no stop-gate-decision.sh beside it, which
  // leaves every function it calls undefined. With the entry's `source` guard
  // loosened to `if false`, the gate carried on and emitted an empty
  // systemMessage, ending the turn with nothing judged. Deciding that needs no
  // scratch repository.
  it("should block naming the decision file when the entry cannot load it", async () => {
    const lone = scratchDir("stop-gate-lone-");
    fs.copyFileSync(GATE, path.join(lone, "stop-gate.sh"));

    const run = await runGate(lone, { gate: path.join(lone, "stop-gate.sh") });

    expect({
      decision: run.decision,
      status: run.status,
      systemMessage: run.systemMessage,
    }).toStrictEqual({
      decision: "block",
      status: 0,
      systemMessage: `⛔ Stop block: the Stop gate could not load ${lone}/stop-gate-decision.sh, so no check ran.`,
    });
  });

  // The other way the `source` fails is a decision file that will not parse,
  // and the block's remedy for a missing file is the wrong one for it, so the
  // reason carries what bash says about this file rather than a guess.
  it("should carry bash's reason into the block when the decision file does not parse", async () => {
    const broken = scratchDir("stop-gate-unparsable-");
    fs.copyFileSync(GATE, path.join(broken, "stop-gate.sh"));
    fs.copyFileSync(DECISION, path.join(broken, "stop-gate-decision.sh"));
    fs.appendFileSync(
      path.join(broken, "stop-gate-decision.sh"),
      "if [ x ; then\n"
    );

    const run = await runGate(broken, {
      gate: path.join(broken, "stop-gate.sh"),
    });

    expect({
      decision: run.decision,
      reasonNamesTheParseFailure: run.reason.includes("syntax error"),
    }).toStrictEqual({
      decision: "block",
      reasonNamesTheParseFailure: true,
    });
  });
});
