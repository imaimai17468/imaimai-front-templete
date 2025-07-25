import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Supabaseで既に作成されているusersテーブルの定義
export const users = pgTable("users", {
	id: uuid("id").primaryKey(),
	name: text("name"),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.default(sql`TIMEZONE('utc', NOW())`),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.default(sql`TIMEZONE('utc', NOW())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
