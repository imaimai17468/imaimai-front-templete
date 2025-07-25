import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/drizzle/schema.ts",
  out: "./src/lib/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      (() => {
        throw new Error("DATABASE_URL is not set");
      })(),
  },
  // publicスキーマのみを対象にする（Supabaseの他のスキーマを除外）
  schemaFilter: ["public"],
  // アンダースコアで始まるテーブルを除外
  tablesFilter: ["!_*"],
  // RLSとSupabase固有の機能を有効化
  entities: {
    roles: true,
  },
} satisfies Config;
