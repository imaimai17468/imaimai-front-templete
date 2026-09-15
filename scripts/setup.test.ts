import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const SETUP = path.resolve(import.meta.dirname, "setup.sh");
const LOCAL_ENV = ".env.local";
const EXAMPLE = ".env.local.example";
/** The bytes the repository ships, so losing that file fails this suite rather than `bun run setup`. */
const EXAMPLE_BODY = readFileSync(
  path.resolve(import.meta.dirname, "..", EXAMPLE),
  "utf-8"
);

const STEPS_AFTER_TRUST = [
  "[setup] bun install --frozen-lockfile",
  "[setup] bun run prepare",
  "[setup] bun run generate-routes",
  "[setup] bun run cf-typegen",
] as const;

/** What the copy branch prints, in order, and the line that closes the run. */
const COPIED_TAIL = [
  "[setup] cp .env.local.example .env.local",
  "[setup] .env.local holds placeholder values: edit them before pointing the tree at a real service.",
  "[setup] done.",
] as const;

const SKIPPED_LINE =
  "[setup] .env.local already exists: skipped copying .env.local.example.";

const NON_REGULAR_LINE =
  "[setup] .env.local exists and is not a regular file: remove that path, then setup copies .env.local.example in its place.";

const TRUST_SKIPPED = "[setup] mise not on PATH: skipped trusting mise.toml.";

type StubName = "bun" | "cp" | "mise";

const SILENT = "#!/bin/sh\nexit 0\n";

/**
 * Silent stand-ins, so each step reports itself without installing anything or
 * writing a git hook. `cp` is the one command whose effect a case reads, so its
 * stand-in runs the real one.
 */
const STUB_BODIES = {
  bun: SILENT,
  cp: '#!/bin/sh\nexec /bin/cp "$@"\n',
  mise: SILENT,
} satisfies Record<StubName, string>;

const WITH_MISE: readonly StubName[] = ["bun", "cp", "mise"];
const WITHOUT_MISE: readonly StubName[] = ["bun", "cp"];

interface SetupRun {
  status: number | null;
  steps: string[];
  failure: string;
}

const setupLines = (output: string): string[] =>
  output.split("\n").filter((line) => line.startsWith("[setup] "));

describe("setup.sh", () => {
  let scratchRoot = "";

  beforeAll(() => {
    scratchRoot = mkdtempSync(path.join(tmpdir(), "setup-"));
  });

  afterAll(() => {
    rmSync(scratchRoot, { force: true, recursive: true });
  });

  /**
   * A checkout carrying the script and the example it copies. The script cds to
   * its own directory's parent, so the copy lands here rather than in this
   * repository.
   */
  const scratchCheckout = (): string => {
    const dir = mkdtempSync(path.join(scratchRoot, "checkout-"));
    mkdirSync(path.join(dir, "scripts"));
    copyFileSync(SETUP, path.join(dir, "scripts", "setup.sh"));
    writeFileSync(path.join(dir, EXAMPLE), EXAMPLE_BODY);
    return dir;
  };

  /** A PATH that holds these stand-ins and nothing else, so no directory outside it answers `command -v mise`. */
  const stubPath = (names: readonly StubName[]): string => {
    const dir = mkdtempSync(path.join(scratchRoot, "stubs-"));
    names.forEach((name) => {
      const stub = path.join(dir, name);
      writeFileSync(stub, STUB_BODIES[name]);
      chmodSync(stub, 0o755);
    });
    return dir;
  };

  const runSetup = (dir: string, stubs: readonly StubName[]): SetupRun => {
    const result = spawnSync(
      "/bin/bash",
      [path.join(dir, "scripts", "setup.sh")],
      {
        encoding: "utf-8",
        env: { ...process.env, PATH: stubPath(stubs) },
      }
    );
    return {
      failure: setupLines(result.stderr).join("\n"),
      status: result.status,
      steps: setupLines(result.stdout),
    };
  };

  /** What the checkout's local env file holds, or null where the path holds no regular file. */
  const localEnvBody = (dir: string): string | null => {
    const file = path.join(dir, LOCAL_ENV);
    return statSync(file, { throwIfNoEntry: false })?.isFile() === true
      ? readFileSync(file, "utf-8")
      : null;
  };

  it("should trust mise.toml before the remaining steps when mise is on PATH", () => {
    const dir = scratchCheckout();

    const run = runSetup(dir, WITH_MISE);

    expect(run).toStrictEqual({
      failure: "",
      status: 0,
      steps: [
        "[setup] mise trust mise.toml",
        ...STEPS_AFTER_TRUST,
        ...COPIED_TAIL,
      ],
    });
  });

  it("should report the skipped trust step and still run the rest when mise is absent", () => {
    const dir = scratchCheckout();

    const run = runSetup(dir, WITHOUT_MISE);

    expect(run).toStrictEqual({
      failure: "",
      status: 0,
      steps: [TRUST_SKIPPED, ...STEPS_AFTER_TRUST, ...COPIED_TAIL],
    });
  });

  it("should name the failing step and stop when a step cannot run", () => {
    const dir = scratchCheckout();

    const run = runSetup(dir, []);

    expect(run).toStrictEqual({
      failure: "[setup] failed at: bun install --frozen-lockfile",
      status: 127,
      steps: [TRUST_SKIPPED, "[setup] bun install --frozen-lockfile"],
    });
  });

  it("should write the example's values into the local env file when the checkout has none", () => {
    const dir = scratchCheckout();

    runSetup(dir, WITHOUT_MISE);

    expect(localEnvBody(dir)).toBe(EXAMPLE_BODY);
  });

  it("should keep the existing values and report the skipped copy when the local env file is already there", () => {
    const dir = scratchCheckout();
    writeFileSync(path.join(dir, LOCAL_ENV), "BETTER_AUTH_SECRET=mine\n");

    const run = runSetup(dir, WITHOUT_MISE);

    expect({ body: localEnvBody(dir), steps: run.steps }).toStrictEqual({
      body: "BETTER_AUTH_SECRET=mine\n",
      steps: [
        TRUST_SKIPPED,
        ...STEPS_AFTER_TRUST,
        SKIPPED_LINE,
        "[setup] done.",
      ],
    });
  });

  it("should report the path and copy nothing when a directory sits at the local env path", () => {
    const dir = scratchCheckout();
    mkdirSync(path.join(dir, LOCAL_ENV));

    const run = runSetup(dir, WITHOUT_MISE);

    // `cp` copies a file INTO a directory destination and exits 0, so a guard
    // that only asked whether a regular file is there would report a copy and
    // leave the checkout with no env file.
    expect({
      entries: readdirSync(path.join(dir, LOCAL_ENV)),
      ...run,
    }).toStrictEqual({
      entries: [],
      failure: NON_REGULAR_LINE,
      status: 1,
      steps: [TRUST_SKIPPED, ...STEPS_AFTER_TRUST],
    });
  });

  it("should report the path and write nothing through the link when a dangling symlink sits at the local env path", () => {
    const dir = scratchCheckout();
    const outside = path.join(scratchRoot, `${path.basename(dir)}-outside`);
    symlinkSync(outside, path.join(dir, LOCAL_ENV));

    const run = runSetup(dir, WITHOUT_MISE);

    // `-e` follows the link and reads a dangling one as absent, so a guard
    // built on it alone would have `cp` write the example to `outside`.
    expect({ outside: existsSync(outside), ...run }).toStrictEqual({
      failure: NON_REGULAR_LINE,
      outside: false,
      status: 1,
      steps: [TRUST_SKIPPED, ...STEPS_AFTER_TRUST],
    });
  });
});
