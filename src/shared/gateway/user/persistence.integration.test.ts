// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { users } from "@schema";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DateTime, Effect, Option } from "effect";
import { db, eq } from "void/db";
import { LocalBindings } from "@/test/local-bindings";
import { persistenceEffect, readUserRow, writeUserRow } from "./persistence.ts";

const WRITTEN_AT = DateTime.makeUnsafe("2026-08-13T00:00:00.000Z");

const insertUser = (id: string) =>
  persistenceEffect(() =>
    db.insert(users).values({
      email: `${id}@example.com`,
      id,
      name: "Before",
    })
  );

const storedName = (id: string) =>
  readUserRow(id).pipe(
    Effect.map(
      Option.map((row) => ({ name: row.name, updatedAt: row.updatedAt }))
    )
  );

layer(LocalBindings.layer, { timeout: 30_000 })(
  "user persistence against a local D1",
  (it) => {
    it.effect("should read nothing when no row carries the id", () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;

        const row = yield* within(readUserRow("absent-user"));

        expect(row).toStrictEqual(Option.none());
      })
    );

    it.effect(
      "should read back the name and the time when a write set them",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;
          yield* within(insertUser("renamed-user"));

          const rowsTouched = yield* within(
            writeUserRow("renamed-user", { name: "After" }, WRITTEN_AT)
          );
          const stored = yield* within(storedName("renamed-user"));

          expect({ rowsTouched, stored }).toStrictEqual({
            rowsTouched: 1,
            stored: Option.some({
              name: "After",
              updatedAt: DateTime.toDateUtc(WRITTEN_AT),
            }),
          });
        })
    );

    it.effect(
      "should leave another user's row untouched when one user's row is written",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;
          yield* within(insertUser("writer"));
          yield* within(insertUser("bystander"));
          const before = yield* within(storedName("bystander"));

          yield* within(writeUserRow("writer", { name: "After" }, WRITTEN_AT));
          const after = yield* within(storedName("bystander"));

          expect(after).toStrictEqual(before);
        })
    );

    it.effect(
      "should touch no row when the row no longer holds what the caller read",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;
          yield* within(insertUser("raced-user"));

          const rowsTouched = yield* within(
            writeUserRow(
              "raced-user",
              { name: "After" },
              WRITTEN_AT,
              eq(users.name, "Read earlier")
            )
          );
          const stored = yield* within(storedName("raced-user"));

          expect({
            rowsTouched,
            storedName: stored.pipe(Option.map((row) => row.name)),
          }).toStrictEqual({
            rowsTouched: 0,
            storedName: Option.some("Before"),
          });
        })
    );

    it.effect("should touch no row when no row carries the id", () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;

        const rowsTouched = yield* within(
          writeUserRow("absent-user", { name: "After" }, WRITTEN_AT)
        );

        expect(rowsTouched).toBe(0);
      })
    );

    it.effect(
      "should fail with the driver's error as the cause when the query fails",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;
          yield* within(insertUser("first-holder"));

          const failure = yield* within(
            persistenceEffect(() =>
              db.insert(users).values({
                email: "first-holder@example.com",
                id: "second-holder",
              })
            )
          ).pipe(Effect.flip);

          expect(failure.cause).toBeInstanceOf(DrizzleQueryError);
        })
    );
  }
);
