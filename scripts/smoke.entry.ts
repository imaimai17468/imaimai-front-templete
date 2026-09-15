#!/usr/bin/env bun

/**
 * ```
 * bun run smoke   # builds, then runs this
 * ```
 *
 * Boots `dist/` under workerd and requests the routes `smoke.ts` names, so a
 * Worker that builds and then throws on every request fails here. No other
 * command in this repository runs what the build produced.
 *
 * Exits non-zero naming every route that answered differently from what
 * `ROUTES` states, or did not answer.
 */

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import {
  report,
  messageOf,
  missingFrom,
  readyUrlIn,
  ROUTES,
  served,
} from "./smoke";
import type { Route, RouteResult } from "./smoke";

const WORKER_CONFIG = "dist/server/wrangler.json";

/**
 * Text bindings for the secrets the Worker requires before it answers a
 * request. Supplying them here keeps the run off any local env file.
 */
const SECRET_ARGS = [
  "--var",
  "BETTER_AUTH_SECRET:smoke-run-placeholder-secret-0123456789",
  "--var",
  "GOOGLE_CLIENT_ID:smoke-run-placeholder-client-id",
  "--var",
  "GOOGLE_CLIENT_SECRET:smoke-run-placeholder-client-secret",
];

const BOOT_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 30_000;
const KILL_TIMEOUT_MS = 10_000;

/**
 * The base URL wrangler prints once workerd is listening. `--port 0` leaves the
 * port to the OS, so this line is the only place the address exists.
 */
const readyUrl = async (child: ChildProcess, stdout: Readable) => {
  const { promise, reject, resolve } = Promise.withResolvers<string>();
  const timer = setTimeout(() => {
    reject(new Error(`wrangler dev was not ready within ${BOOT_TIMEOUT_MS}ms`));
  }, BOOT_TIMEOUT_MS);

  stdout.setEncoding("utf-8");
  stdout.on("data", (chunk: unknown) => {
    process.stdout.write(String(chunk));
  });

  let buffered = "";
  const scan = (chunk: unknown) => {
    buffered += String(chunk);
    const lastBreak = buffered.lastIndexOf("\n");
    if (lastBreak === -1) {
      return;
    }
    const found = readyUrlIn(buffered.slice(0, lastBreak));
    buffered = buffered.slice(lastBreak + 1);
    if (found !== null) {
      stdout.off("data", scan);
      resolve(found);
    }
  };
  stdout.on("data", scan);

  child.on("close", () => {
    reject(new Error("wrangler dev exited before it served anything"));
  });
  child.on("error", (cause) => {
    reject(new Error("wrangler dev could not be started", { cause }));
  });

  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
};

const hasExited = (child: ChildProcess): boolean =>
  child.exitCode !== null || child.signalCode !== null;

/** SIGTERM, then SIGKILL for a child that ignores it, so the run always ends. */
const stop = async (child: ChildProcess) => {
  if (hasExited(child)) {
    return;
  }
  child.kill();
  await Promise.race([once(child, "close"), delay(KILL_TIMEOUT_MS)]);
  if (hasExited(child)) {
    return;
  }
  child.kill("SIGKILL");
  await once(child, "close");
};

const request = async (baseUrl: string, route: Route): Promise<RouteResult> => {
  try {
    const response = await fetch(new URL(route.path, baseUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    return {
      expectedStatus: route.status,
      kind: "answered",
      missing: missingFrom(body, route),
      path: route.path,
      status: response.status,
    };
  } catch (error) {
    return {
      kind: "unanswered",
      path: route.path,
      reason: messageOf(error),
    };
  }
};

const run = async (): Promise<number> => {
  const stateDir = await mkdtemp(path.join(tmpdir(), "app-smoke-"));
  const child = spawn(
    "bunx",
    [
      "wrangler",
      "dev",
      "-c",
      WORKER_CONFIG,
      "--port",
      "0",
      "--persist-to",
      stateDir,
      ...SECRET_ARGS,
    ],
    { stdio: ["ignore", "pipe", "inherit"] }
  );

  try {
    const baseUrl = await readyUrl(child, child.stdout);
    const results = await Promise.all(
      ROUTES.map(async (route) => await request(baseUrl, route))
    );
    results.forEach((result) => {
      console.log(`[smoke] ${report(result)}`);
    });
    const failed = results.filter((result) => !served(result));
    if (failed.length === 0) {
      return 0;
    }
    console.error(
      `[smoke] the built Worker did not serve: ${failed.map((result) => result.path).join(", ")}`
    );
    return 1;
  } finally {
    await stop(child);
    await rm(stateDir, { force: true, recursive: true });
  }
};

process.exit(await run());
