import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

// Supabaseで既に作成されているusersテーブルの定義
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
  (t) => [
    // RLSポリシー: ユーザーは自分のデータのみ閲覧可能
    pgPolicy("users_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
    }),
    // RLSポリシー: ユーザーは自分のデータのみ挿入可能
    pgPolicy("users_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${authUid} = ${t.id}`,
    }),
    // RLSポリシー: ユーザーは自分のデータのみ更新可能
    pgPolicy("users_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
      withCheck: sql`${authUid} = ${t.id}`,
    }),
    // RLSポリシー: ユーザーは自分のデータのみ削除可能
    pgPolicy("users_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
    }),
  ],
).enableRLS();

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
