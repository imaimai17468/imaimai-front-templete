#!/usr/bin/env bun

/**
 * ```
 * bun run smoke
 * ```
 *
 * Boots the dev server under Void on an empty local D1 and R2, which applies
 * the D1 migrations, requests the routes `smoke.expected.ts` names, then sends the
 * sign-in burst `SIGN_IN_BURST` names. A Worker that throws on every request
 * fails here, and so does an auth rate limiter that is off or whose table the
 * migrations do not create. The run reads no Cloudflare account.
 *
 * Exits non-zero naming every route that answered differently from what
 * `ROUTES` states, or did not answer, and where the burst was not limited as
 * `signInBurstFailure` expects.
 */

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { ROUTES } from "./smoke.expected.ts";
import {
  report,
  messageOf,
  pointsAt,
  missedBy,
  readyUrlIn,
  served,
  SIGN_IN_BURST,
  signInBurstFailure,
} from "./smoke.ts";
import type { Route, RouteResult } from "./smoke.ts";

/**
 * The environment the dev server runs under. `SMOKE_STATE_DIR` is where
 * `vite.config.ts` points Void's local D1 and R2, and the secrets the Worker
 * requires before it answers a request are given here.
 */
const devEnv = (stateDir: string): NodeJS.ProcessEnv => ({
  ...process.env,
  BETTER_AUTH_SECRET: "smoke-run-placeholder-secret-0123456789",
  GOOGLE_CLIENT_ID: "smoke-run-placeholder-client-id",
  GOOGLE_CLIENT_SECRET: "smoke-run-placeholder-client-secret",
  SMOKE_STATE_DIR: stateDir,
});

const BOOT_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 30_000;
const KILL_TIMEOUT_MS = 10_000;

/**
 * The base URL the dev server prints once it listens. It moves to the next
 * free port when the default one is taken, so this line is the only place the
 * address exists.
 */
const readyUrl = async (child: ChildProcess, stdout: Readable) => {
  const { promise, reject, resolve } = Promise.withResolvers<string>();
  const timer = setTimeout(() => {
    reject(
      new Error(`the dev server was not ready within ${BOOT_TIMEOUT_MS}ms`)
    );
  }, BOOT_TIMEOUT_MS);

  stdout.setEncoding("utf-8");
  stdout.on("data", (chunk: unknown) => {
    process.stdout.write(String(chunk));
  });

  const pending = { text: "" };
  const scan = (chunk: unknown) => {
    pending.text += String(chunk);
    const lastBreak = pending.text.lastIndexOf("\n");
    if (lastBreak === -1) {
      return;
    }
    const found = readyUrlIn(pending.text.slice(0, lastBreak));
    pending.text = pending.text.slice(lastBreak + 1);
    if (found !== null) {
      stdout.off("data", scan);
      resolve(found);
    }
  };
  stdout.on("data", scan);

  child.on("close", () => {
    reject(new Error("the dev server exited before it served anything"));
  });
  child.on("error", (cause) => {
    reject(new Error("the dev server could not be started", { cause }));
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

/** Boots the dev server with its local D1 and R2 kept under `stateDir`. */
const smokeOn = async (stateDir: string): Promise<number> => {
  const child = spawn("bunx", ["vp", "dev"], {
    env: devEnv(stateDir),
    stdio: ["ignore", "pipe", "inherit"],
  });

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
    const burstFailure = await signInStatuses(baseUrl, [])
      .then(signInBurstFailure)
      .catch(
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

/** Where void 1.11.0 records the local D1 directory the `void db` CLI uses. */
const LOCAL_D1_RECORD = ".void/local-d1.json";

/**
 * Removes the record when this run wrote it, which is what `bun run dev`
 * starting without `persistTo` does, so `void db` goes back to `.void/`.
 */
const releaseLocalD1Record = async (stateDir: string) => {
  const recordText = await readFile(LOCAL_D1_RECORD, "utf-8").catch(() => "");
  if (pointsAt(recordText, stateDir)) {
    await rm(LOCAL_D1_RECORD, { force: true });
  }
};

/**
 * Each run starts from an empty directory, so Void creates a new local D1 for
 * it rather than reusing the rate-limit rows of an earlier run.
 */
const run = async (): Promise<number> => {
  const stateDir = await mkdtemp(path.join(tmpdir(), "app-smoke-"));
  try {
    return await smokeOn(stateDir);
  } finally {
    await rm(stateDir, { force: true, recursive: true });
    await releaseLocalD1Record(stateDir);
  }
};

process.exit(await run());
