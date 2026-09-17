import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { DateTime, Option } from "effect";
import { getDb } from "@/lib/drizzle/db.live";
import { users } from "@/lib/drizzle/schema";
import type { UserProfileRow } from ".";

/**
 * The D1 side of the user gateway's store.
 *
 * `Date` crosses no further than this module: a row's timestamps become
 * `DateTime.Utc` on the way out and a write's `updatedAt` becomes a `Date` on
 * the way in, so the gateway above reads the clock through Effect. A nullable
 * column becomes an `Option` on the way out, and the name a write carries
 * becomes `null` again on the way in.
 */
export const drizzleUserStore = {
  findAvatarKey: (
    userId: string
  ): Promise<Option.Option<Pick<UserProfileRow, "avatarKey">>> =>
    getDb()
      .select({ avatarKey: users.avatarKey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) =>
        Option.fromNullishOr(rows[0]).pipe(
          Option.map((row) => ({ avatarKey: Option.fromNullOr(row.avatarKey) }))
        )
      ),

  findProfile: (userId: string): Promise<Option.Option<UserProfileRow>> =>
    getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then(([row]) =>
        Option.fromNullishOr(row).pipe(
          Option.map((profile) => ({
            avatarKey: Option.fromNullOr(profile.avatarKey),
            createdAt: DateTime.fromDateUnsafe(profile.createdAt),
            id: profile.id,
            image: Option.fromNullOr(profile.image),
            name: Option.fromNullOr(profile.name),
            updatedAt: DateTime.fromDateUnsafe(profile.updatedAt),
          }))
        )
      ),

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

  updateName: (
    userId: string,
    name: Option.Option<string>,
    updatedAt: DateTime.Utc
  ) =>
    getDb()
      .update(users)
      .set({
        name: Option.getOrNull(name),
        updatedAt: DateTime.toDateUtc(updatedAt),
      })
      .where(eq(users.id, userId))
      .execute(),
};
