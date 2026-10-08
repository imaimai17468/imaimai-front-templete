#!/usr/bin/env bun

/**
 * ```
 * bun run smoke
 * ```
 *
 * Boots the stack under `alchemy dev` on a fresh local state, which applies the
 * D1 migrations, requests the routes `smoke.ts` names, then sends the sign-in
 * burst `SIGN_IN_BURST` names. A Worker that throws on every request fails
 * here, and so does an auth rate limiter that is off or whose table the
 * migrations do not create. The run reads no Cloudflare account: the Alchemy
 * home it gets is empty, and the Cloudflare variables are cleared.
 *
 * Exits non-zero naming every route that answered differently from what
 * `ROUTES` states, or did not answer, and where the burst was not limited as
 * `signInBurstFailure` expects.
 */

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { STACK_NAME } from "../alchemy.run";
import {
  addedSince,
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

const STAGE = "smoke";
const STAGE_STATE = path.join(".alchemy/state", STACK_NAME, STAGE);

/** Where `alchemy dev` keeps the data of each local D1 database and R2 bucket. */
const LOCAL_DATA_DIRS = [
  ".alchemy/local/d1/cloudflare-runtime-D1DatabaseObject",
  ".alchemy/local/r2/cloudflare-runtime-R2BucketObject",
];

/**
 * The environment `alchemy dev` runs under. The secrets the Worker requires
 * before it answers a request are given here, and the variables that would
 * point Alchemy at a Cloudflare account are emptied.
 */
const devEnv = (alchemyHome: string): NodeJS.ProcessEnv => ({
  ...process.env,
  ALCHEMY_HOME: alchemyHome,
  ALCHEMY_TELEMETRY_DISABLED: "1",
  BETTER_AUTH_SECRET: "smoke-run-placeholder-secret-0123456789",
  CLOUDFLARE_ACCOUNT_ID: "",
  CLOUDFLARE_API_TOKEN: "",
  GOOGLE_CLIENT_ID: "smoke-run-placeholder-client-id",
  GOOGLE_CLIENT_SECRET: "smoke-run-placeholder-client-secret",
});

const BOOT_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 30_000;
const KILL_TIMEOUT_MS = 10_000;

/**
 * The base URL `alchemy dev` prints once the Worker listens. It moves to the
 * next free port when the configured one is taken, so this line is the only
 * place the address exists.
 */
const readyUrl = async (child: ChildProcess, stdout: Readable) => {
  const { promise, reject, resolve } = Promise.withResolvers<string>();
  const timer = setTimeout(() => {
    reject(new Error(`alchemy dev was not ready within ${BOOT_TIMEOUT_MS}ms`));
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
    reject(new Error("alchemy dev exited before it served anything"));
  });
  child.on("error", (cause) => {
    reject(new Error("alchemy dev could not be started", { cause }));
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

/**
 * One sign-in from the burst's address, answered with its status alone. It
 * carries no body, so the handler answers 415 once the limiter lets it through:
 * on 2026-09-30 the local `wrangler dev` answered some 429s to requests with a body as 503
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

/** Boots the stack on the smoke stage, with `alchemyHome` as Alchemy's home. */
const smokeOn = async (alchemyHome: string): Promise<number> => {
  const child = spawn(
    "bunx",
    ["alchemy", "dev", "--no-input", "--stage", STAGE],
    { env: devEnv(alchemyHome), stdio: ["ignore", "pipe", "inherit"] }
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
        `[smoke] the Worker did not serve: ${failed.map((result) => result.path).join(", ")}`
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
  }
};

const entriesOf = async (dir: string): Promise<readonly string[]> => {
  const names = await readdir(dir).catch(() => []);
  return names.map((name) => path.join(dir, name));
};

const localDataEntries = async (): Promise<readonly string[]> => {
  const perDir = await Promise.all(LOCAL_DATA_DIRS.map(entriesOf));
  return perDir.flat();
};

/**
 * Each run starts the stage from no records, so Alchemy creates a new local D1
 * for it rather than reusing the rate-limit rows of an earlier run, and the
 * run removes the local data that appeared while it ran. A database a
 * `bun run dev` created during the run goes with it.
 */
const run = async (): Promise<number> => {
  await rm(STAGE_STATE, { force: true, recursive: true });
  const before = await localDataEntries();
  const alchemyHome = await mkdtemp(path.join(tmpdir(), "app-smoke-"));
  try {
    return await smokeOn(alchemyHome);
  } finally {
    await rm(alchemyHome, { force: true, recursive: true });
    await rm(STAGE_STATE, { force: true, recursive: true });
    await Promise.all(
      addedSince(before, await localDataEntries()).map(async (entry) => {
        await rm(entry, { force: true, recursive: true });
      })
    );
  }
};

process.exit(await run());
