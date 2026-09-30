#!/usr/bin/env bun

/**
 * ```
 * bun run smoke   # builds, then runs this
 * ```
 *
 * Applies the D1 migrations to a fresh local state, boots `dist/` under
 * workerd on it, requests the routes `smoke.ts` names, then sends the sign-in
 * burst `SIGN_IN_BURST` names. A Worker that builds and then throws on every
 * request fails here, and so does an auth rate limiter that is off or whose
 * table the migrations do not create. No other command in this repository
 * runs what the build produced.
 *
 * Exits non-zero naming every route that answered differently from what
 * `ROUTES` states, or did not answer, where the burst was not limited as
 * `signInBurstFailure` expects, where the migrations did not apply, and before
 * booting where the build left a local secrets file beside the Worker config.
 */

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { LOCAL_SECRETS_FILE } from "../tools/vite-plugins/drop-local-secrets-plugin";
import {
  leftoverSecretsFailure,
  report,
  messageOf,
  missedBy,
  readyUrlIn,
  ROUTES,
  served,
  SIGN_IN_BURST,
  signInBurstFailure,
} from "./smoke";
import type { Route, RouteResult } from "./smoke";

const WORKER_CONFIG = "dist/server/wrangler.json";
const LOCAL_SECRETS_PATH = path.join(
  path.dirname(WORKER_CONFIG),
  LOCAL_SECRETS_FILE
);

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
      missing: missedBy(body, response.headers, route),
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

/** Whether `wrangler d1 migrations apply` left the local D1 migrated. */
const migrate = async (stateDir: string): Promise<boolean> => {
  const child = spawn(
    "bunx",
    [
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "-c",
      WORKER_CONFIG,
      "--persist-to",
      stateDir,
    ],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
  await once(child, "close");
  return child.exitCode === 0;
};

/**
 * One sign-in from the burst's address, answered with its status alone. It
 * carries no body, so the handler answers 415 once the limiter lets it through:
 * the local `wrangler dev` answered some 429s to requests with a body as 503
 * `Your worker restarted mid-request`, and never one without.
 */
const signInStatus = async (baseUrl: string): Promise<number> => {
  const response = await fetch(new URL(SIGN_IN_BURST.path, baseUrl), {
    headers: {
      "cf-connecting-ip": "203.0.113.7",
      origin: new URL(baseUrl).origin,
    },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await response.body?.cancel();
  return response.status;
};

/**
 * The statuses of the burst, one past the limit. Each sign-in waits for the
 * one before it, so the limiter counts them in the order they are listed.
 */
const signInStatuses = async (
  baseUrl: string,
  answered: readonly number[]
): Promise<readonly number[]> =>
  answered.length > SIGN_IN_BURST.allowed
    ? answered
    : await signInStatuses(baseUrl, [...answered, await signInStatus(baseUrl)]);

const run = async (): Promise<number> => {
  const leftover = leftoverSecretsFailure(
    LOCAL_SECRETS_PATH,
    existsSync(LOCAL_SECRETS_PATH)
  );
  if (leftover !== null) {
    console.error(`[smoke] ${leftover}`);
    return 1;
  }
  const stateDir = await mkdtemp(path.join(tmpdir(), "app-smoke-"));
  if (!(await migrate(stateDir))) {
    console.error("[smoke] the D1 migrations did not apply to the local state");
    await rm(stateDir, { force: true, recursive: true });
    return 1;
  }
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
    if (failed.length > 0) {
      console.error(
        `[smoke] the built Worker did not serve: ${failed.map((result) => result.path).join(", ")}`
      );
      return 1;
    }
    const burstFailure = await signInStatuses(baseUrl, []).then(
      signInBurstFailure,
      (error: unknown) =>
        `${SIGN_IN_BURST.path} -> no response (${messageOf(error)})`
    );
    if (burstFailure !== null) {
      console.error(`[smoke] ${burstFailure}`);
      return 1;
    }
    console.log(
      `[smoke] ${SIGN_IN_BURST.path} -> limited after ${SIGN_IN_BURST.allowed}`
    );
    return 0;
  } finally {
    await stop(child);
    await rm(stateDir, { force: true, recursive: true });
  }
};

process.exit(await run());
