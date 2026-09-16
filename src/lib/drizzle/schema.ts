import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { DateTime } from "effect";

// Better Auth 必須テーブル
export const users = sqliteTable("users", {
  // The bucket key of an avatar this app uploaded. `image` stays Better Auth's
  // column and holds whatever the social provider supplied, so the two never
  // overwrite each other and the served path is not frozen into a stored URL.
  avatarKey: text("avatar_key"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => DateTime.toDateUtc(DateTime.nowUnsafe())),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => DateTime.toDateUtc(DateTime.nowUnsafe())),
});

export const sessions = sqliteTable("sessions", {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => DateTime.toDateUtc(DateTime.nowUnsafe())),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  id: text("id").primaryKey(),
  ipAddress: text("ip_address"),
  token: text("token").notNull().unique(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => DateTime.toDateUtc(DateTime.nowUnsafe())),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable(
  "accounts",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    accountId: text("account_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => DateTime.toDateUtc(DateTime.nowUnsafe())),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    issuer: text("issuer").notNull(),
    // better-auth が providerId "credential" の行に書くパスワードハッシュ。
    // その資格情報サインインが有効なのは dev ビルドだけ。
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => DateTime.toDateUtc(DateTime.nowUnsafe())),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("accounts_issuer_account_id_uidx").on(
      table.issuer,
      table.accountId
    ),
  ]
);

export const verifications = sqliteTable("verifications", {
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() =>
    DateTime.toDateUtc(DateTime.nowUnsafe())
  ),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() =>
    DateTime.toDateUtc(DateTime.nowUnsafe())
  ),
  value: text("value").notNull(),
});
