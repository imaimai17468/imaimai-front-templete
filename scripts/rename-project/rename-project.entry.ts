#!/usr/bin/env bun

/**
 * ```
 * bun run rename-project <name>
 * ```
 *
 * Renames the project from the `name` in `package.json` to `<name>` across the
 * tracked text files, as `rename-project.ts` decides, formats the tree, and
 * prints each file it rewrote.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Schema } from "effect";
import { isRenamedFileType, planRename } from "./rename-project.ts";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

const readText = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf-8");

const { name: currentName } = Schema.decodeSync(
  Schema.fromJsonString(Schema.Struct({ name: Schema.String }))
)(readText("package.json"));

const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf-8",
})
  .split("\0")
  .filter(
    (file) => isRenamedFileType(file) && fs.existsSync(path.join(root, file))
  )
  .map((file) => ({ path: file, text: readText(file) }));

const uncommitted = execFileSync("git", ["status", "--porcelain"], {
  cwd: root,
  encoding: "utf-8",
});

const plan = planRename(
  process.argv.slice(2),
  currentName,
  files,
  uncommitted === "" ? "clean" : "dirty"
);

if (plan.kind === "rejected") {
  console.error(plan.reason);
  process.exit(1);
}

plan.files.forEach((file) => {
  fs.writeFileSync(path.join(root, file.path), file.text);
});
console.log(
  [
    `Renamed ${plan.from} to ${plan.to} in ${plan.files.length} files:`,
    ...plan.files.map((file) => `  ${file.path}`),
  ].join("\n")
);
// A longer name can push a rewritten line past the print width.
execFileSync("bun", ["run", "format:fix"], {
  cwd: root,
  stdio: ["ignore", "ignore", "inherit"],
});
