// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";
import { LocalBindings } from "@/test/local-bindings";
import { insertUser } from "@/test/users";
import { readUserRow } from "../persistence.ts";
import { UserAvatarKeys } from "./update.ts";

const WRITTEN_AT = DateTime.makeUnsafe("2026-08-13T00:00:00.000Z");
const OLD_KEY = "keyed-user/avatar.jpg";
const NEW_KEY = "keyed-user/avatars/123e4567-e89b-42d3-a456-426614174000.png";

const storedKey = (id: string) =>
  readUserRow(id).pipe(
    Effect.map(Option.map((row) => Option.fromNullOr(row.avatarKey)))
  );

layer(Layer.mergeAll(LocalBindings.layer, UserAvatarKeys.layer), {
  timeout: 30_000,
})("UserAvatarKeys against a local D1", (it) => {
  it.effect("should find no row when no row carries the id", () =>
    Effect.gen(function* () {
      const { within } = yield* LocalBindings;
      const keys = yield* UserAvatarKeys;

      const found = yield* within(keys.find("absent-user"));

      expect(found).toStrictEqual(Option.none());
    })
  );

  it.effect.each([
    ["no key", "keyless-user", {}, Option.none()],
    ["a key", "found-user", { avatarKey: OLD_KEY }, Option.some(OLD_KEY)],
  ] satisfies [
    string,
    string,
    { avatarKey?: string },
    Option.Option<string>,
  ][])(
    "should find the row holding %s as that option",
    ([_label, userId, columns, expected]) =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;
        const keys = yield* UserAvatarKeys;
        yield* within(insertUser(userId, columns));

        const found = yield* within(keys.find(userId));

        expect(found).toStrictEqual(Option.some(expected));
      })
  );

  it.effect.each([
    [
      "holds the key the caller read",
      "keyed-user",
      { avatarKey: OLD_KEY },
      Option.some(OLD_KEY),
      1,
      NEW_KEY,
    ],
    [
      "still holds no key, as the caller read",
      "first-upload-user",
      {},
      Option.none(),
      1,
      NEW_KEY,
    ],
    [
      "gained a key after the caller read none",
      "raced-user",
      { avatarKey: OLD_KEY },
      Option.none(),
      0,
      OLD_KEY,
    ],
    [
      "holds a key other than the one the caller read",
      "replaced-user",
      { avatarKey: OLD_KEY },
      Option.some("replaced-user/avatar.png"),
      0,
      OLD_KEY,
    ],
  ] satisfies [
    string,
    string,
    { avatarKey?: string },
    Option.Option<string>,
    number,
    string,
  ][])(
    "should leave the row holding the expected key when the row %s",
    ([_label, userId, columns, previousKey, expectedTouched, expectedKey]) =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;
        const keys = yield* UserAvatarKeys;
        yield* within(insertUser(userId, columns));

        const rowsTouched = yield* within(
          keys.set(userId, previousKey, NEW_KEY, WRITTEN_AT)
        );
        const stored = yield* within(storedKey(userId));

        expect({ rowsTouched, stored }).toStrictEqual({
          rowsTouched: expectedTouched,
          stored: Option.some(Option.some(expectedKey)),
        });
      })
  );
});
