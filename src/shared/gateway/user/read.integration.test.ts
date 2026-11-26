// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { LocalBindings } from "@/test/local-bindings";
import { INSERTED_AT, insertUser } from "@/test/users";
import { UserProfiles } from "./read.ts";

layer(Layer.mergeAll(LocalBindings.layer, UserProfiles.layer), {
  timeout: 30_000,
})("UserProfiles against a local D1", (it) => {
  it.effect("should find no profile when no row carries the id", () =>
    Effect.gen(function* () {
      const { within } = yield* LocalBindings;
      const profiles = yield* UserProfiles;

      const profile = yield* within(profiles.findProfile("absent-user"));

      expect(profile).toStrictEqual(Option.none());
    })
  );

  it.effect(
    "should decode the row's nullable columns into options and its times into UTC instants when the row exists",
    () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;
        const profiles = yield* UserProfiles;
        yield* within(
          insertUser("profiled-user", { avatarKey: "profiled-user/avatar.png" })
        );

        const profile = yield* within(profiles.findProfile("profiled-user"));

        expect(profile).toStrictEqual(
          Option.some({
            avatarKey: Option.some("profiled-user/avatar.png"),
            createdAt: INSERTED_AT,
            id: "profiled-user",
            image: Option.none(),
            name: Option.some("Before"),
            updatedAt: INSERTED_AT,
          })
        );
      })
  );
});
