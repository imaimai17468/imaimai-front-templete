import { eq } from "drizzle-orm";
import { getDb } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import type { UserStore } from "./ports";

export const drizzleUserStore: UserStore = {
  findAvatarUrl: async (userId) => {
    const rows = await getDb()
      .select({ avatarUrl: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  },

  findProfile: async (userId) => {
    const rows = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  },

  setAvatarUrl: async (userId, avatarUrl) => {
    const rows = await getDb()
      .update(users)
      .set({ image: avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return rows.length;
  },

  updateName: async (userId, name) => {
    await getDb()
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, userId));
  },
};
