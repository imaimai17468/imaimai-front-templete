import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SETUP = path.resolve(import.meta.dirname, "setup.sh");

const STEPS_AFTER_TRUST = [
  "[setup] bun install --frozen-lockfile",
  "[setup] bun run prepare",
  "[setup] bun run generate-routes",
  "[setup] bun run cf-typegen",
  "[setup] done.",
] as const;

// Silent stand-ins on a PATH that holds nothing else, so each step reports
// itself without installing anything or writing a git hook, and no directory
// outside this one can answer `command -v mise`.
const stubCommands = (names: readonly string[]): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "setup-stubs-"));
  names.forEach((name) => {
    const stub = path.join(dir, name);
    writeFileSync(stub, "#!/bin/sh\nexit 0\n");
    chmodSync(stub, 0o755);
  });
  return dir;
};

interface SetupRun {
  status: number | null;
  steps: string[];
  failure: string;
}

const setupLines = (output: string): string[] =>
  output.split("\n").filter((line) => line.startsWith("[setup] "));

const runSetup = (stubs: readonly string[]): SetupRun => {
  const dir = stubCommands(stubs);
  try {
    const result = spawnSync("/bin/bash", [SETUP], {
      encoding: "utf-8",
      env: { ...process.env, PATH: dir },
    });
    return {
      failure: setupLines(result.stderr).join("\n"),
      status: result.status,
      steps: setupLines(result.stdout),
    };
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

describe("setup.sh", () => {
  it("should trust mise.toml before the remaining steps when mise is on PATH", () => {
    const stubs = ["bun", "mise"];

    const run = runSetup(stubs);

    expect(run).toStrictEqual({
      failure: "",
      status: 0,
      steps: ["[setup] mise trust mise.toml", ...STEPS_AFTER_TRUST],
    });
  });

  it("should report the skipped trust step and still run the rest when mise is absent", () => {
    const stubs = ["bun"];

    const run = runSetup(stubs);

    expect(run).toStrictEqual({
      failure: "",
      status: 0,
      steps: [
        "[setup] mise not on PATH: skipped trusting mise.toml.",
        ...STEPS_AFTER_TRUST,
      ],
    });
  });

  it("should name the failing step and stop when a step cannot run", () => {
    const stubs: string[] = [];

    const run = runSetup(stubs);

    expect(run).toStrictEqual({
      failure: "[setup] failed at: bun install --frozen-lockfile",
      status: 127,
      steps: [
        "[setup] mise not on PATH: skipped trusting mise.toml.",
        "[setup] bun install --frozen-lockfile",
      ],
    });
  });
});
