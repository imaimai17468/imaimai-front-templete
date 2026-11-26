// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";
import { LocalBindings } from "@/test/local-bindings";
import { insertUser } from "@/test/users";
import { readUserRow } from "./persistence.ts";
import { UserNames } from "./update.ts";

const WRITTEN_AT = DateTime.makeUnsafe("2026-08-13T00:00:00.000Z");

const storedName = (id: string) =>
  readUserRow(id).pipe(
    Effect.map(Option.map((row) => Option.fromNullOr(row.name)))
  );

layer(Layer.mergeAll(LocalBindings.layer, UserNames.layer), {
  timeout: 30_000,
})("UserNames against a local D1", (it) => {
  it.effect.each([
    ["a name", "named-user", Option.some("After")],
    ["no name", "unnamed-user", Option.none()],
  ] satisfies [string, string, Option.Option<string>][])(
    "should store %s on the caller's row and count that one row",
    ([_label, userId, name]) =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;
        const names = yield* UserNames;
        yield* within(insertUser(userId));

        const rowsTouched = yield* within(names.set(userId, name, WRITTEN_AT));
        const stored = yield* within(storedName(userId));

        expect({ rowsTouched, stored }).toStrictEqual({
          rowsTouched: 1,
          stored: Option.some(name),
        });
      })
  );
});
