#!/usr/bin/env bun

/**
 * Point the model at a path-scoped rule from `.claude/rules/` once per
 * session, as additionalContext, when a tool call reaches a file its `paths`
 * cover. scoped-rules.sh runs it for PreToolUse and PostToolUse.
 *
 * Claude Code loads such a rule when the Read tool opens a matching file, and a
 * session that reads and writes through Bash can go without that load. Before a
 * call, the paths the call names decide; after a Bash call, the files git
 * lists as changed decide, which covers a write whose command named no path.
 * Every judgment on those paths is in scoped-rules-decision.ts, and this file
 * reads the payload, the rules, git, the transcript and the markers.
 *
 * The context is advisory, so every failure here exits 0 and prints nothing: a
 * hook that cannot decide must not stand between the model and its call.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { text } from "node:stream/consumers";
import { z } from "zod";
import {
  completeMarker,
  loadsNatively,
  markerPrefix,
  namedPaths,
  parseScopedRule,
  pointerContext,
  projectRelative,
  reachesFor,
  readsTranscript,
  ruleMarker,
  ToolInput,
  transcriptHoldsRule,
} from "./scoped-rules-decision";
import type { ScopedRule } from "./scoped-rules-decision";

const HookPayloadSchema = z.object({
  agent_id: z.string().default(""),
  cwd: z.string(),
  hook_event_name: z.enum(["PreToolUse", "PostToolUse"]),
  session_id: z.string().default(""),
  tool_input: ToolInput.default({}),
  tool_name: z.string(),
  transcript_path: z.string().default(""),
});

type HookPayload = z.infer<typeof HookPayloadSchema>;

/** The `.md` files under `.claude/rules/`, and the scoped rules among them. */
interface RuleFiles {
  readonly count: number;
  readonly rules: readonly ScopedRule[];
}

const readRuleFiles = (projectDir: string): RuleFiles => {
  const dir = path.join(projectDir, ".claude/rules");
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .toSorted();
  const rules = names.flatMap((name) => {
    const rule = parseScopedRule(
      name,
      fs.readFileSync(path.join(dir, name), "utf-8")
    );
    return rule === undefined ? [] : [rule];
  });
  return { count: names.length, rules };
};

const gitLines = (projectDir: string, args: readonly string[]): string[] =>
  execFileSync("git", args, { cwd: projectDir, encoding: "utf-8" })
    .split("\n")
    .filter((line) => line !== "");

/**
 * Files that differ from the index, staged files that differ from HEAD, and
 * untracked files git does not ignore. The staged list covers a file a Bash
 * call wrote and then added, and it is empty where no commit exists yet.
 */
const changedFiles = (projectDir: string): string[] => [
  ...gitLines(projectDir, [
    "ls-files",
    "--modified",
    "--others",
    "--exclude-standard",
  ]),
  ...gitLines(projectDir, ["diff", "--name-only", "--cached", "--relative"]),
];

const reachedPaths = (payload: HookPayload, projectDir: string): string[] => {
  if (payload.hook_event_name === "PostToolUse") {
    return changedFiles(projectDir);
  }
  return namedPaths(payload.tool_name, payload.tool_input).flatMap(
    (written) => {
      const relative = projectRelative(written, payload.cwd, projectDir);
      return relative === undefined ? [] : [relative];
    }
  );
};

/**
 * `mkdir` both tests and claims the marker in one step, so of several calls
 * Claude Code issued together exactly one points at the rule, and it refuses
 * an existing path, so a marker another user created is not followed.
 */
const claimsFirstReach = (prefix: string | undefined, rule: ScopedRule) => {
  if (prefix === undefined) {
    return true;
  }
  try {
    fs.mkdirSync(ruleMarker(prefix, rule.name));
    return true;
  } catch {
    return false;
  }
};

const markCompleteWhenAllReached = (
  prefix: string | undefined,
  ruleFiles: RuleFiles
): void => {
  if (
    prefix !== undefined &&
    ruleFiles.rules.every((rule) =>
      fs.existsSync(ruleMarker(prefix, rule.name))
    )
  ) {
    fs.mkdirSync(completeMarker(prefix, ruleFiles.count), { recursive: true });
  }
};

const readTranscript = (payload: HookPayload): string => {
  if (!readsTranscript(payload.agent_id)) {
    return "";
  }
  try {
    return fs.readFileSync(payload.transcript_path, "utf-8");
  } catch {
    return "";
  }
};

const run = (
  stdin: string,
  projectDir: string | undefined,
  tmpDir: string
): string => {
  const payload = HookPayloadSchema.parse(JSON.parse(stdin));
  const root = projectDir ?? payload.cwd;
  const ruleFiles = readRuleFiles(root);
  const reaches = reachesFor(ruleFiles.rules, reachedPaths(payload, root));
  if (reaches.length === 0) {
    return "";
  }
  const prefix = markerPrefix(payload.session_id, payload.agent_id, tmpDir);
  const reachedFirst = reaches.filter((reach) =>
    claimsFirstReach(prefix, reach.rule)
  );
  markCompleteWhenAllReached(prefix, ruleFiles);
  if (reachedFirst.length === 0 || loadsNatively(payload.tool_name)) {
    return "";
  }
  const transcript = readTranscript(payload);
  const unloaded = reachedFirst.filter(
    (reach) => !transcriptHoldsRule(transcript, reach.rule.name)
  );
  if (unloaded.length === 0) {
    return "";
  }
  return JSON.stringify({
    hookSpecificOutput: {
      additionalContext: pointerContext(unloaded),
      hookEventName: payload.hook_event_name,
    },
  });
};

try {
  const printed = run(
    await text(process.stdin),
    process.env.CLAUDE_PROJECT_DIR,
    process.env.SCOPED_RULES_TMP ?? os.tmpdir()
  );
  if (printed !== "") {
    console.log(printed);
  }
} catch {
  process.exitCode = 0;
}
