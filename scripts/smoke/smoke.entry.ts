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
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { constants, tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import {
  chooseStopRequest,
  stopGroup,
  toProcessGroup,
} from "./process-group.ts";
import type { Kill, ProcessGroup } from "./process-group.ts";
import { ROUTES } from "./smoke.expected.ts";
import {
  describeError,
  exitStatus,
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
const STOP_POLL_MS = 100;

/**
 * The numbers of the signals that interrupted the run. The server sits in a
 * process group of its own, so a Ctrl-C in the terminal reaches this process
 * alone, which stops the group and lets the run clean up and exit.
 */
const interruptingSignals: number[] = [];

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

const killProcess: Kill = (pid, signal) => {
  process.kill(pid, signal);
};

/** The group of a dev server that never started, so it has nothing to stop. */
const GROUP_NEVER_STARTED: ProcessGroup = {
  isAlive: () => false,
  send: () => {
    /* A group that never started has no process to signal. */
  },
};

/** The stop in flight, which every later request to stop waits on. */
interface PendingStop {
  promise: Promise<void> | null;
}

/**
 * Stops the dev server and every process it started, so no `vite` or
 * `workerd` keeps the run's output open after the run exits.
 */
const stop = async (group: ProcessGroup) => {
  const outcome = await stopGroup(
    group,
    async () => {
      await delay(STOP_POLL_MS);
    },
    KILL_TIMEOUT_MS / STOP_POLL_MS
  );
  if (outcome === "survived") {
    console.error(
      "[smoke] the dev server's process group still had processes after SIGKILL"
    );
  }
};

/**
 * Stops the group on the first SIGHUP, SIGINT or SIGTERM and kills it on any
 * that follows, so a repeated Ctrl-C still leaves nothing running. The run
 * goes on to fail its requests, clean up, and exit with `exitStatus`.
 */
const stopOnSignals = (
  group: ProcessGroup,
  stopServer: () => Promise<void>
) => {
  const answer = (signalName: NodeJS.Signals) => {
    const request = chooseStopRequest(interruptingSignals);
    interruptingSignals.push(constants.signals[signalName]);
    if (request === "forced") {
      group.send("SIGKILL");
      return;
    }
    console.error(`[smoke] stopping the dev server on ${signalName}`);
    void stopServer();
  };
  process.on("SIGHUP", answer);
  process.on("SIGINT", answer);
  process.on("SIGTERM", answer);
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
    detached: true,
    env: devEnv(stateDir),
    stdio: ["ignore", "pipe", "inherit"],
  });
  const group =
    child.pid === undefined
      ? GROUP_NEVER_STARTED
      : toProcessGroup(child.pid, killProcess);
  const stopping: PendingStop = { promise: null };
  const stopServer = async () => {
    stopping.promise ??= stop(group);
    await stopping.promise;
  };
  stopOnSignals(group, stopServer);

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
    await stopServer();
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

const result = await run().catch((error: unknown) => {
  console.error(`[smoke] ${describeError(error)}`);
  return 1;
});
process.exit(exitStatus(result, interruptingSignals));
