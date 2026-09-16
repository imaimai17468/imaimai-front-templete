import { eq } from "drizzle-orm";
import { DateTime } from "effect";
import { getDb } from "@/lib/drizzle/db.live";
import { users } from "@/lib/drizzle/schema";
import type { UserProfileRow } from ".";

/**
 * The D1 side of the user gateway's store.
 *
 * `Date` crosses no further than this module: a row's timestamps become
 * `DateTime.Utc` on the way out and a write's `updatedAt` becomes a `Date` on
 * the way in, so the gateway above reads the clock through Effect.
 */
export const drizzleUserStore = {
  findAvatarKey: (
    userId: string
  ): Promise<{ avatarKey: string | null } | null> =>
    getDb()
      .select({ avatarKey: users.avatarKey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),

  findProfile: (userId: string): Promise<UserProfileRow | null> =>
    getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then(([row]) => {
        if (row === undefined) {
          return null;
        }
        return {
          avatarKey: row.avatarKey,
          createdAt: DateTime.fromDateUnsafe(row.createdAt),
          id: row.id,
          image: row.image,
          name: row.name,
          updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
        };
      }),

  setAvatarKey: (
    userId: string,
    avatarKey: string,
    updatedAt: DateTime.Utc
  ): Promise<number> =>
    getDb()
      .update(users)
      .set({ avatarKey, updatedAt: DateTime.toDateUtc(updatedAt) })
      .where(eq(users.id, userId))
      .returning({ id: users.id })
      .then((rows) => rows.length),

  updateName: (userId: string, name: string | null, updatedAt: DateTime.Utc) =>
    getDb()
      .update(users)
      .set({ name, updatedAt: DateTime.toDateUtc(updatedAt) })
      .where(eq(users.id, userId))
      .execute(),
};
