// @vitest-environment node

/**
 * Hold what the smoke run expects of each route against an answer built in
 * process. A file under `public/` answers as its bytes. Every other path goes
 * through the Worker entry's dispatch, with TanStack Router's SSR request
 * handler rendering the app's router in place of Start's handler, against a
 * local D1 and R2 and with no session.
 */

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  createRequestHandler,
  defaultRenderHandler,
} from "@tanstack/react-router/ssr/server";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { getRouter } from "@/router";
import { dispatchToTarget } from "@/server-dispatch";
import { serveAvatar } from "@/shared/gateway/user/avatar/read";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { LocalBindings } from "@/test/local-bindings";
import { inRequest, SIGNED_OUT } from "@/test/local-request";
import { ROUTES } from "./smoke.expected.ts";
import { missedBy } from "./smoke.ts";
import type { Route } from "./smoke.ts";

const ORIGIN = "http://localhost";
const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../public");

/** What the router answers to `request` from a visitor with no session. */
const routerAnswer = async (request: Request): Promise<Response> =>
  await createRequestHandler({
    createRouter: () => {
      const router = getRouter();
      router.options.context.queryClient.setQueryData(
        currentUserQueryOptions().queryKey,
        null
      );
      return router;
    },
    request,
  })(defaultRenderHandler);

const dispatch = dispatchToTarget({ avatar: serveAvatar, start: routerAnswer });

/**
 * The file under `public/` that `requestPath` names, answered as its bytes
 * with no headers, or else what the dispatch answers to a signed-out request.
 */
const answerFor = (requestPath: string): Effect.Effect<Response> => {
  const url = new URL(requestPath, ORIGIN);
  const file = path.join(PUBLIC_DIR, url.pathname);
  if (statSync(file, { throwIfNoEntry: false })?.isFile() === true) {
    return Effect.succeed(new Response(readFileSync(file)));
  }
  return inRequest(
    SIGNED_OUT,
    Effect.promise(async () => await dispatch(new Request(url)))
  );
};

/** The row's path, its answer's status, and what the answer failed to carry. */
const judged = (route: Route) =>
  answerFor(route.path).pipe(
    Effect.flatMap((response) =>
      Effect.promise(async () => await response.text()).pipe(
        Effect.map((body) => ({
          missing: missedBy(body, response.headers, route),
          path: route.path,
          status: response.status,
        }))
      )
    )
  );

describe("what the smoke run expects of the app", () => {
  it("should answer every row as the smoke run expects when each is answered in process", async () => {
    const answers = await Effect.runPromise(
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;
        return yield* within(
          Effect.forEach(ROUTES, judged, { concurrency: 1 })
        );
      }).pipe(Effect.provide(LocalBindings.layer))
    );

    expect(answers).toStrictEqual(
      ROUTES.map((route) => ({
        missing: [],
        path: route.path,
        status: route.status,
      }))
    );
  }, 30_000);

  it("should name only text the not-found page lacks when the smoke run checks a page for its marker", async () => {
    const notFound = await routerAnswer(
      new Request(new URL("/no-such-page", ORIGIN))
    );
    const body = await notFound.text();

    expect(
      ROUTES.flatMap((route) =>
        route.marker !== null && body.includes(route.marker) ? [route.path] : []
      )
    ).toStrictEqual([]);
  });
});
