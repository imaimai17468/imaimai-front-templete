#!/usr/bin/env bun

/**
 * ```
 * bun run build
 * ```
 *
 * Builds the Worker bundle and the client assets into `dist/` with the build
 * `alchemy deploy` runs, and deploys nothing. Exits with the build's status.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { serialize } from "node:v8";
import { WORKER_SOURCE } from "../alchemy.run";

// The build child is not among the package's exports, so it is reached by
// path. package.json pins alchemy to one version, which fixes that path.
const runner = path.join(
  import.meta.dirname,
  "../node_modules/alchemy/src/Cloudflare/Workers/ViteBuildChildRunner.ts"
);
const resultDir = mkdtempSync(path.join(tmpdir(), "app-build-"));

const build = spawnSync(process.execPath, ["run", runner], {
  env: { ...process.env, NODE_ENV: "production" },
  input: serialize({
    compatibilityDate: WORKER_SOURCE.compatibility.date,
    compatibilityFlags: WORKER_SOURCE.compatibility.flags,
    env: {},
    main: WORKER_SOURCE.main,
    outputPath: path.join(resultDir, "result.v8"),
    rootDir: process.cwd(),
    viteEnvironments: undefined,
  }),
  stdio: ["pipe", "inherit", "inherit"],
});

rmSync(resultDir, { force: true, recursive: true });
if (build.error) {
  console.error(`[build] could not start ${runner}: ${build.error.message}`);
}
process.exit(build.status ?? 1);
