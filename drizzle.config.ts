import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env.local" });

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
} satisfies Config;
