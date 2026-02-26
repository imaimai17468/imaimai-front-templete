import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env.local" });

export default {
  schema: "./src/lib/drizzle/schema.ts",
  out: "./src/lib/drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
} satisfies Config;
