import { sql } from "drizzle-orm";
import {
	pgPolicy,
	pgSchema,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// Supabase Auth スキーマの参照用（型定義のみ、マイグレーション対象外）
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
	id: uuid("id").primaryKey(),
});

export const users = pgTable(
	"users",
	{
		id: uuid("id")
			.primaryKey()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		name: text("name"),
		avatarUrl: text("avatar_url"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.default(sql`TIMEZONE('utc', NOW())`),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.default(sql`TIMEZONE('utc', NOW())`),
	},
	(table) => [
		// ユーザーは自分のデータのみ閲覧可能
		pgPolicy("users_select_policy", {
			for: "select",
			to: authenticatedRole,
			using: sql`auth.uid() = ${table.id}`,
		}),
		// ユーザーは自分のデータのみ更新可能
		pgPolicy("users_update_policy", {
			for: "update",
			to: authenticatedRole,
			using: sql`auth.uid() = ${table.id}`,
			withCheck: sql`auth.uid() = ${table.id}`,
		}),
	],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
