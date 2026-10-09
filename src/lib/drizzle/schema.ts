import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { DateTime } from "effect";

const nowUtc = () => DateTime.toDateUtc(DateTime.nowUnsafe());

const stampedAt = (column: "created_at" | "updated_at") =>
  integer(column, { mode: "timestamp" }).$defaultFn(nowUtc);

// Better Auth 必須テーブル
export const users = sqliteTable(
  "users",
  {
    // The bucket key of an avatar this app uploaded. `image` stays Better Auth's
    // column and holds whatever the social provider supplied, so the two never
    // overwrite each other and the served path is not frozen into a stored URL.
    avatarKey: text("avatar_key"),
    createdAt: stampedAt("created_at").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }),
    id: text("id").primaryKey(),
    image: text("image"),
    name: text("name"),
    updatedAt: stampedAt("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

const ownerId = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const sessions = sqliteTable(
  "sessions",
  {
    createdAt: stampedAt("created_at").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    token: text("token").notNull(),
    updatedAt: stampedAt("updated_at").notNull(),
    userAgent: text("user_agent"),
    userId: ownerId(),
  },
  (table) => [uniqueIndex("sessions_token_unique").on(table.token)]
);

export const accounts = sqliteTable(
  "accounts",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    accountId: text("account_id").notNull(),
    createdAt: stampedAt("created_at").notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    // better-auth が providerId "credential" の行に書くパスワードハッシュ。
    // その資格情報サインインが有効なのは dev ビルドだけ。
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    updatedAt: stampedAt("updated_at").notNull(),
    userId: ownerId(),
  },
  (table) => [
    uniqueIndex("accounts_provider_id_account_id_uidx").on(
      table.providerId,
      table.accountId
    ),
  ]
);

export const verifications = sqliteTable("verifications", {
  createdAt: stampedAt("created_at"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  updatedAt: stampedAt("updated_at"),
  value: text("value").notNull(),
});

// Better Auth の rateLimit モデル（`rateLimit.storage: "database"`）。
// `key` は `<IP>|<パス>`、`last_request` はミリ秒のエポック時刻。
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    count: integer("count").notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    lastRequest: integer("last_request").notNull(),
  },
  // Better Auth prunes rows older than its longest window with
  // `DELETE ... WHERE last_request < ?` inside the request that reset a window.
  (table) => [
    index("rate_limits_last_request_idx").on(table.lastRequest),
    uniqueIndex("rate_limits_key_unique").on(table.key),
  ]
);
