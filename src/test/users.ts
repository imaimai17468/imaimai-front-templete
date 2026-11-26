import { users } from "@schema";
import { DateTime, Effect } from "effect";
import { db } from "void/db";

/** The instant every row `insertUser` writes was created and last updated at. */
export const INSERTED_AT = DateTime.makeUnsafe("2026-08-01T00:00:00.000Z");

/**
 * Writes a `users` row whose email is derived from `id`, so two rows written
 * with different ids never collide on the unique email index.
 */
export const insertUser = (
  id: string,
  columns: Partial<
    Omit<typeof users.$inferInsert, "createdAt" | "email" | "id" | "updatedAt">
  > = {}
): Effect.Effect<void> =>
  Effect.promise(() =>
    db.insert(users).values({
      createdAt: DateTime.toDateUtc(INSERTED_AT),
      email: `${id}@example.com`,
      id,
      name: "Before",
      updatedAt: DateTime.toDateUtc(INSERTED_AT),
      ...columns,
    })
  );
