import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { serverFnQuery, serverFnQueryWith } from "./server-fn-query.ts";

const { signal } = new AbortController();

describe(serverFnQuery, () => {
  it.effect(
    "should hand the query's signal to the server function and answer what it resolved to when the query runs",
    () =>
      Effect.gen(function* () {
        const serverFn =
          vi.fn<(options: { signal: AbortSignal }) => Promise<string>>();
        serverFn.mockResolvedValue("answer");

        const answer = yield* Effect.promise(() =>
          serverFnQuery(serverFn)({ signal })
        );

        expect({ answer, calls: serverFn.mock.calls }).toStrictEqual({
          answer: "answer",
          calls: [[{ signal }]],
        });
      })
  );
});

describe(serverFnQueryWith, () => {
  it.effect(
    "should hand the server function its input and the query's signal when the query runs",
    () =>
      Effect.gen(function* () {
        const serverFn =
          vi.fn<
            (options: {
              data: { id: string };
              signal: AbortSignal;
            }) => Promise<string>
          >();
        serverFn.mockResolvedValue("answer");

        const answer = yield* Effect.promise(() =>
          serverFnQueryWith(serverFn, { id: "x" })({ signal })
        );

        expect({ answer, calls: serverFn.mock.calls }).toStrictEqual({
          answer: "answer",
          calls: [[{ data: { id: "x" }, signal }]],
        });
      })
  );
});
