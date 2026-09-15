import { eq } from "drizzle-orm";
import { DateTime } from "effect";
import { getDb } from "@/lib/drizzle/db.live";
import { users } from "@/lib/drizzle/schema";

/**
 * The D1 side of the user gateway's store.
 *
 * `Date` crosses no further than this module: a row's timestamps become
 * `DateTime.Utc` on the way out and a write's `updatedAt` becomes a `Date` on
 * the way in, so the gateway above reads the clock through Effect.
 */
export const drizzleUserStore = {
  findAvatarUrl: async (
    userId: string
  ): Promise<{ avatarUrl: string | null } | null> => {
    const rows = await getDb()
      .select({ avatarUrl: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  },

  findProfile: async (
    userId: string
  ): Promise<{
    id: string;
    name: string | null;
    image: string | null;
    createdAt: DateTime.Utc;
    updatedAt: DateTime.Utc;
  } | null> => {
    const rows = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [row] = rows;
    if (row === undefined) {
      return null;
    }
    return {
      createdAt: DateTime.fromDateUnsafe(row.createdAt),
      id: row.id,
      image: row.image,
      name: row.name,
      updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
    };
  },

  setAvatarUrl: async (
    userId: string,
    avatarUrl: string,
    updatedAt: DateTime.Utc
  ): Promise<number> => {
    const rows = await getDb()
      .update(users)
      .set({ image: avatarUrl, updatedAt: DateTime.toDateUtc(updatedAt) })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return rows.length;
  },

  updateName: async (
    userId: string,
    name: string | null,
    updatedAt: DateTime.Utc
  ): Promise<void> => {
    await getDb()
      .update(users)
      .set({ name, updatedAt: DateTime.toDateUtc(updatedAt) })
      .where(eq(users.id, userId));
  },
};
