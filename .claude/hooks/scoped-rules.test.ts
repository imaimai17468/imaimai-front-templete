/**
 * Exercise .claude/hooks/scoped-rules.sh, and the scoped-rules.entry.ts it
 * runs, against the payloads they read and the JSON they print.
 *
 * Which paths reach which rule, what the pointer says, and how markers are
 * named is decided in scoped-rules-decision.ts and pinned by its own test.
 * What is left here is the entry's own: reading the rules off disk, asking git
 * what changed after a Bash call, the marker that points at a rule once per
 * session, the transcript that says Claude Code already loaded it, the
 * complete marker that answers the rest of a session without bun, and silence
 * on a payload it cannot read.
 *
 * Every case forks the hook against its own scratch project, under its own
 * TMPDIR, so no case sees another's marker. Nothing in the repository is
 * modified.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { readHookJson } from "./hook-output";
import type { BashRun } from "./run-bash";
import { runBash } from "./run-bash";

const HOOK = path.resolve(import.meta.dirname, "scoped-rules.sh");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "scoped-rules-"));

const Printed = z.object({
  hookSpecificOutput: z
    .object({
      additionalContext: z.string(),
      hookEventName: z.enum(["PreToolUse", "PostToolUse"]),
    })
    .optional(),
});

type Event = "PreToolUse" | "PostToolUse";

const REACT_RULE = "---\npaths: src/**/*.tsx\n---\n\n# React\n";
const DESIGN_RULE = "---\npaths: src/**/*.css\n---\n\n# Design\n";

/**
 * The whole object a pointer is printed as. Spelled out rather than built
 * with pointerContext, because a test that took the sentence from the module
 * under test would pass whatever that module said.
 */
const printedFor = (
  event: Event,
  matchedPath: string,
  rule: "react" | "design" = "react"
): z.infer<typeof Printed> => {
  const pattern = rule === "react" ? "src/**/*.tsx" : "src/**/*.css";
  return {
    hookSpecificOutput: {
      additionalContext: `This session just reached ${matchedPath}, which .claude/rules/${rule}.md covers (${pattern}). Read .claude/rules/${rule}.md completely before continuing. This hook names it once per session.`,
      hookEventName: event,
    },
  };
};

/** A scratch git project holding one scoped rule and one unscoped one. */
const makeProject = (name: string): string => {
  const dir = path.join(ROOT, name);
  fs.mkdirSync(path.join(dir, ".claude/rules"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".claude/rules/react.md"), REACT_RULE);
  fs.writeFileSync(path.join(dir, ".claude/rules/prose.md"), "# Prose\n");
  fs.writeFileSync(path.join(dir, ".claude/rules/notes.txt"), "not a rule\n");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
};

const addDesignRule = (project: string): void => {
  fs.writeFileSync(path.join(project, ".claude/rules/design.md"), DESIGN_RULE);
};

interface Call {
  readonly agentId?: string;
  readonly cwd?: string;
  readonly event?: Event;
  readonly sessionId?: string;
  readonly toolInput: Record<string, string>;
  readonly toolName: string;
  readonly transcript?: string;
}

const payloadFor = (project: string, call: Call): string => {
  const transcriptPath = path.join(project, "transcript.jsonl");
  if (call.transcript !== undefined) {
    fs.writeFileSync(transcriptPath, call.transcript);
  }
  return JSON.stringify({
    agent_id: call.agentId,
    cwd: call.cwd ?? project,
    hook_event_name: call.event ?? "PreToolUse",
    session_id: call.sessionId,
    tool_input: call.toolInput,
    tool_name: call.toolName,
    transcript_path: transcriptPath,
  });
};

/** Whether the hook runs with CLAUDE_PROJECT_DIR naming the scratch project. */
type ProjectDirEnv = "set" | "unset";

const runHook = async (
  project: string,
  input: string,
  projectDirEnv: ProjectDirEnv = "set"
): Promise<BashRun> => {
  const tmp = path.join(project, "tmp");
  fs.mkdirSync(tmp, { recursive: true });
  const { CLAUDE_PROJECT_DIR: _inherited, ...inherited } = process.env;
  const env =
    projectDirEnv === "set"
      ? { ...inherited, CLAUDE_PROJECT_DIR: project, TMPDIR: `${tmp}/` }
      : { ...inherited, TMPDIR: `${tmp}/` };
  return await runBash(HOOK, { cwd: project, env, input });
};

const printedBy = async (
  project: string,
  call: Call
): Promise<z.infer<typeof Printed>> => {
  const run = await runHook(project, payloadFor(project, call));
  return readHookJson(run.stdout, Printed);
};

const bashNaming = (file: string): Call => ({
  sessionId: "s1",
  toolInput: { command: `sed -n 1,20p ${file}` },
  toolName: "Bash",
});

describe("scoped-rules", () => {
  afterAll(() => {
    fs.rmSync(ROOT, { force: true, recursive: true });
  });

  it("should point at the rule when a Bash command names a covered file", async () => {
    const project = makeProject("bash");

    const printed = await printedBy(project, bashNaming("src/routes/a.tsx"));

    expect(printed).toStrictEqual(printedFor("PreToolUse", "src/routes/a.tsx"));
  });

  it("should point at the rule when Edit names a covered file", async () => {
    const project = makeProject("edit");

    const printed = await printedBy(project, {
      sessionId: "s1",
      toolInput: { file_path: path.join(project, "src/a.tsx") },
      toolName: "Edit",
    });

    expect(printed).toStrictEqual(printedFor("PreToolUse", "src/a.tsx"));
  });

  it("should print nothing when Read reaches the rule Claude Code loads itself", async () => {
    const project = makeProject("read");

    const printed = await printedBy(project, {
      sessionId: "s1",
      toolInput: { file_path: "src/a.tsx" },
      toolName: "Read",
    });

    expect(printed).toStrictEqual({});
  });

  it("should print nothing when Bash names a file an earlier Read reached", async () => {
    const project = makeProject("read-then-bash");
    await printedBy(project, {
      sessionId: "s1",
      toolInput: { file_path: "src/a.tsx" },
      toolName: "Read",
    });

    const printed = await printedBy(project, bashNaming("src/a.tsx"));

    expect(printed).toStrictEqual({});
  });

  it("should resolve a relative path against cwd when cwd is below CLAUDE_PROJECT_DIR", async () => {
    const project = makeProject("project-dir");

    const printed = await printedBy(project, {
      cwd: path.join(project, "src"),
      sessionId: "s1",
      toolInput: { file_path: "a.tsx" },
      toolName: "Edit",
    });

    expect(printed).toStrictEqual(printedFor("PreToolUse", "src/a.tsx"));
  });

  it("should read the rules under cwd when CLAUDE_PROJECT_DIR is unset", async () => {
    const project = makeProject("no-project-dir");
    const payload = payloadFor(project, bashNaming("src/a.tsx"));

    const run = await runHook(project, payload, "unset");

    expect(readHookJson(run.stdout, Printed)).toStrictEqual(
      printedFor("PreToolUse", "src/a.tsx")
    );
  });

  it("should print nothing when no named path is covered", async () => {
    const project = makeProject("uncovered");

    const printed = await printedBy(
      project,
      bashNaming("README.md /etc/hosts.tsx")
    );

    expect(printed).toStrictEqual({});
  });

  it("should point at the rule after Bash when git lists an untracked covered file", async () => {
    const project = makeProject("post");
    fs.mkdirSync(path.join(project, "src"));
    fs.writeFileSync(path.join(project, "src/new.tsx"), "export {};\n");

    const printed = await printedBy(project, {
      event: "PostToolUse",
      sessionId: "s1",
      toolInput: { command: "python3 gen.py" },
      toolName: "Bash",
    });

    expect(printed).toStrictEqual(printedFor("PostToolUse", "src/new.tsx"));
  });

  it("should point at the rule after Bash when the covered file was written and staged", async () => {
    const project = makeProject("staged");
    fs.mkdirSync(path.join(project, "src"));
    fs.writeFileSync(path.join(project, "src/new.tsx"), "export {};\n");
    execFileSync("git", ["add", "src/new.tsx"], { cwd: project });

    const printed = await printedBy(project, {
      event: "PostToolUse",
      sessionId: "s1",
      toolInput: { command: "python3 gen.py && git add src" },
      toolName: "Bash",
    });

    expect(printed).toStrictEqual(printedFor("PostToolUse", "src/new.tsx"));
  });

  it("should print nothing when the session has already reached the rule", async () => {
    const project = makeProject("twice");
    await printedBy(project, bashNaming("src/a.tsx"));

    const printed = await printedBy(project, bashNaming("src/a.tsx"));

    expect(printed).toStrictEqual({});
  });

  it("should point at the rule again when a subagent of the session reaches it", async () => {
    const project = makeProject("subagent");
    await printedBy(project, bashNaming("src/a.tsx"));

    const printed = await printedBy(project, {
      ...bashNaming("src/a.tsx"),
      agentId: "a1",
    });

    expect(printed).toStrictEqual(printedFor("PreToolUse", "src/a.tsx"));
  });

  it("should point at the rule on every call when the payload carries no id", async () => {
    const project = makeProject("no-id");
    const { sessionId: _session, ...call } = bashNaming("src/a.tsx");
    await printedBy(project, call);

    const printed = await printedBy(project, call);

    expect(printed).toStrictEqual(printedFor("PreToolUse", "src/a.tsx"));
  });

  it("should print nothing when the transcript shows Claude Code loaded the rule", async () => {
    const project = makeProject("transcript");

    const printed = await printedBy(project, {
      ...bashNaming("src/a.tsx"),
      transcript:
        '{"attachment":{"type":"nested_memory","displayPath":".claude/rules/react.md"}}\n',
    });

    expect(printed).toStrictEqual({});
  });

  it("should ignore the transcript when the call comes from a subagent", async () => {
    const project = makeProject("subagent-transcript");

    const printed = await printedBy(project, {
      ...bashNaming("src/a.tsx"),
      agentId: "a1",
      transcript:
        '{"attachment":{"type":"nested_memory","displayPath":".claude/rules/react.md"}}\n',
    });

    expect(printed).toStrictEqual(printedFor("PreToolUse", "src/a.tsx"));
  });

  it("should point at a rule added mid-session when every earlier rule was reached", async () => {
    const project = makeProject("added");
    await printedBy(project, bashNaming("src/a.tsx"));
    addDesignRule(project);

    const printed = await printedBy(project, bashNaming("src/a.css"));

    expect(printed).toStrictEqual(
      printedFor("PreToolUse", "src/a.css", "design")
    );
  });

  it("should keep running scoped-rules.entry.ts when a rule is still unreached", async () => {
    const project = makeProject("incomplete");
    addDesignRule(project);
    await printedBy(project, bashNaming("src/a.tsx"));

    const printed = await printedBy(project, bashNaming("src/a.css"));

    expect(printed).toStrictEqual(
      printedFor("PreToolUse", "src/a.css", "design")
    );
  });

  it("should answer without scoped-rules.entry.ts when the complete marker exists", async () => {
    const project = makeProject("complete");
    fs.mkdirSync(path.join(project, "tmp/claude-scoped-rules-s1-.complete-2"), {
      recursive: true,
    });

    const printed = await printedBy(project, bashNaming("src/a.tsx"));

    expect(printed).toStrictEqual({});
  });

  it.each([
    { input: "not json", name: "stdin is not JSON" },
    {
      input: '{"hook_event_name":"Stop","cwd":"/","tool_name":"Read"}',
      name: "the event is neither PreToolUse nor PostToolUse",
    },
  ])("should exit 0 and print nothing when $name", async ({ input }) => {
    const project = makeProject(`bad-${input.length}`);

    const run = await runHook(project, input);

    expect(run).toStrictEqual({ status: 0, stderr: "", stdout: "" });
  });
});
