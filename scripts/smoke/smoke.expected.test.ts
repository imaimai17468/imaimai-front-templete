// @vitest-environment node

/**
 * Hold what the smoke run expects of each route against an answer built in
 * process: TanStack Router's SSR request handler rendering the app's router
 * with the current user read as signed out, or the file under `public/` that
 * the path names.
 */

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  createRequestHandler,
  defaultRenderHandler,
} from "@tanstack/react-router/ssr/server";
import { describe, expect, it } from "vite-plus/test";
import { getRouter } from "@/router";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { ROUTES } from "./smoke.expected.ts";
import { missedBy } from "./smoke.ts";

const ORIGIN = "http://localhost";
const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../public");

/** What the router answers for `requestPath` to a visitor with no session. */
const routerAnswer = async (requestPath: string): Promise<Response> =>
  await createRequestHandler({
    createRouter: () => {
      const router = getRouter();
      router.options.context.queryClient.setQueryData(
        currentUserQueryOptions().queryKey,
        null
      );
      return router;
    },
    request: new Request(new URL(requestPath, ORIGIN)),
  })(defaultRenderHandler);

/**
 * The file under `public/` that `requestPath` names, answered as its bytes
 * with no headers, or else what the router answers.
 */
const answerFor = async (requestPath: string): Promise<Response> => {
  const file = path.join(PUBLIC_DIR, new URL(requestPath, ORIGIN).pathname);
  return statSync(file, { throwIfNoEntry: false })?.isFile() === true
    ? new Response(readFileSync(file))
    : await routerAnswer(requestPath);
};

describe("what the smoke run expects of the app", () => {
  it.each(ROUTES)(
    "should answer $path as the smoke run expects when it is answered in process",
    async (route) => {
      const response = await answerFor(route.path);
      const body = await response.text();

      expect({
        missing: missedBy(body, response.headers, route),
        status: response.status,
      }).toStrictEqual({ missing: [], status: route.status });
    }
  );

  it.each(ROUTES.filter((route) => route.marker !== null))(
    "should name text the not-found page lacks when the smoke run checks $path for its marker",
    async (route) => {
      const notFound = await routerAnswer("/no-such-page");

      await expect(notFound.text()).resolves.not.toContain(route.marker);
    }
  );
});
