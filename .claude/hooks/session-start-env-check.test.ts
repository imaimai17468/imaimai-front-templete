/**
 * Exercise what .claude/hooks/session-start-env-check.sh does about the
 * gitignored local env file: it copies the example over when the checkout has
 * none, it leaves an existing file alone, and it reports a copy it could not
 * make as a setup issue.
 *
 * Each case runs the real hook against a scratch checkout carrying the other
 * three files the setup section looks for, so "Checkout setup incomplete"
 * lists the env file or nothing at all. `CLAUDE_PROJECT_DIR` names that
 * directory and stdin is empty, which fixes the tree the hook inspects on a
 * machine with jq and on one without.
 *
 * The gate section mixes what the machine has (jq, bun, mise, node) with what
 * the scratch directory lacks (node_modules, the installed git hooks), so
 * nothing here asserts on it.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { runBash } from "./run-bash";

const HOOK = path.resolve(import.meta.dirname, "session-start-env-check.sh");
const LOCAL_ENV = ".env.local";
const EXAMPLE = ".env.local.example";
const EXAMPLE_BODY = "BETTER_AUTH_SECRET=your_better_auth_secret\n";

const CREATED_LINE =
  "Created .env.local from .env.local.example, whose values are placeholders (edit them before pointing the tree at a real service).";

const NON_REGULAR_ENTRY =
  ".env.local exists and is not a regular file (fix: remove that path, and the next session copies .env.local.example in its place)";

const SETUP_HEADER = "[env-check] Checkout setup incomplete:";
const BULLET = "  - ";
const CREATION = /^\[env-check\] (?<text>Created .*)$/u;
/** What the hook appends `cp`'s own words after, and those words. */
const CP_MESSAGE = / cp said: .*$/su;

/** What the hook printed about the checkout, split by the section it printed it under. */
interface Report {
  created: string[];
  setup: string[];
}

/**
 * The gate section prints its entries as `  - <entry>` too, and it prints them
 * above the setup header, so the entries of the run the setup header opens are
 * the setup issues.
 */
const report = (stdout: string): Report => {
  const lines = stdout.split("\n");
  const header = lines.indexOf(SETUP_HEADER);
  const afterHeader = header === -1 ? [] : lines.slice(header + 1);
  const end = afterHeader.findIndex((line) => !line.startsWith(BULLET));
  const entries = end === -1 ? afterHeader : afterHeader.slice(0, end);
  return {
    created: lines.flatMap((line) => CREATION.exec(line)?.groups?.text ?? []),
    setup: entries.map((line) => line.slice(BULLET.length)),
  };
};

/** What the checkout's local env file holds, or null where it has none. */
const localEnvBody = (dir: string): string | null => {
  const file = path.join(dir, LOCAL_ENV);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : null;
};

describe("session-start-env-check.sh", () => {
  let scratchRoot = "";

  beforeAll(() => {
    scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "env-check-"));
  });

  afterAll(() => {
    fs.rmSync(scratchRoot, { force: true, recursive: true });
  });

  /**
   * A checkout whose only open setup question is the local env file: the three
   * other paths the hook's setup section names are present.
   */
  const scratchCheckout = (): string => {
    const dir = fs.mkdtempSync(path.join(scratchRoot, "checkout-"));
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.mkdirSync(path.join(dir, ".wrangler", "state"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "routeTree.gen.ts"), "");
    fs.writeFileSync(path.join(dir, "worker-configuration.d.ts"), "");
    fs.writeFileSync(path.join(dir, EXAMPLE), EXAMPLE_BODY);
    return dir;
  };

  const runHook = async (dir: string) =>
    await runBash(HOOK, {
      cwd: dir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
      input: "",
    });

  it("should copy the example into place and report the creation rather than a setup issue when the local env file is absent", async () => {
    const dir = scratchCheckout();

    const { stdout } = await runHook(dir);

    expect({ body: localEnvBody(dir), ...report(stdout) }).toStrictEqual({
      body: EXAMPLE_BODY,
      created: [CREATED_LINE],
      setup: [],
    });
  });

  it("should leave the values in place and report no creation when the local env file already exists", async () => {
    const dir = scratchCheckout();
    fs.writeFileSync(path.join(dir, LOCAL_ENV), "BETTER_AUTH_SECRET=mine\n");

    const { stdout } = await runHook(dir);

    expect({ body: localEnvBody(dir), ...report(stdout) }).toStrictEqual({
      body: "BETTER_AUTH_SECRET=mine\n",
      created: [],
      setup: [],
    });
  });

  it("should report a setup issue rather than a creation when a directory sits at the local env path", async () => {
    const dir = scratchCheckout();
    fs.mkdirSync(path.join(dir, LOCAL_ENV));

    const { stdout } = await runHook(dir);

    // `cp` copies a file INTO a directory destination and exits 0, so a guard
    // that only asked whether a regular file is there would report a creation
    // and leave the checkout with no env file.
    expect({
      entries: fs.readdirSync(path.join(dir, LOCAL_ENV)),
      ...report(stdout),
    }).toStrictEqual({
      created: [],
      entries: [],
      setup: [NON_REGULAR_ENTRY],
    });
  });

  it("should report a setup issue rather than write through the link when a dangling symlink sits at the local env path", async () => {
    const dir = scratchCheckout();
    const outside = path.join(scratchRoot, `${path.basename(dir)}-outside`);
    fs.symlinkSync(outside, path.join(dir, LOCAL_ENV));

    const { stdout } = await runHook(dir);

    // `-e` follows the link and reads a dangling one as absent, so a guard
    // built on it alone would have `cp` write the example to `outside`.
    expect({
      outside: fs.existsSync(outside),
      ...report(stdout),
    }).toStrictEqual({
      created: [],
      outside: false,
      setup: [NON_REGULAR_ENTRY],
    });
  });

  it("should report a setup issue when the example it would copy is absent", async () => {
    const dir = scratchCheckout();
    fs.rmSync(path.join(dir, EXAMPLE));

    const { stdout } = await runHook(dir);

    // The entry ends with `cp`'s own message, which this file does not pin, so
    // the comparison stops at the marker the hook appends it after.
    const printed = report(stdout);
    expect({
      body: localEnvBody(dir),
      created: printed.created,
      setup: printed.setup.map((entry) => entry.replace(CP_MESSAGE, "")),
    }).toStrictEqual({
      body: null,
      created: [],
      setup: [
        ".env.local absent, and copying .env.local.example to it failed (fix: restore .env.local.example, or make the checkout writable).",
      ],
    });
  });
});
