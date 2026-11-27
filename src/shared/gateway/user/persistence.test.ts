import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { capturedReports } from "@/shared/gateway/error-reports";
import { wroteOneRow } from "./persistence.ts";

describe(wroteOneRow, () => {
  it.effect(
    "should refuse the write and report the count when the write touched more than one row",
    () =>
      Effect.gen(function* () {
        const wrote = yield* wroteOneRow("user.updateName", Effect.succeed(2));
        const reported = yield* capturedReports;

        expect({ reported, wrote }).toStrictEqual({
          reported: [
            {
              event: "user.updateName",
              message: "expected 1 row, got 2",
              name: "UnexpectedRowCount",
              operations: ["wroteOneRow"],
            },
          ],
          wrote: false,
        });
      })
  );
});
