import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env.local" });

const CLOUDFLARE_VARS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_D1_DATABASE_ID",
  "CLOUDFLARE_API_TOKEN",
] as const;

type CloudflareVarName = (typeof CLOUDFLARE_VARS)[number];

const requireCloudflareVar = (name: CloudflareVarName): string => {
  const value = process.env[name];
  if (value !== undefined && value.length > 0) {
    return value;
  }
  throw new Error(
    `${name} is not set. Register it where drizzle-kit reads its environment before targeting the remote D1 database.`
  );
};

export default {
  schema: "./src/lib/drizzle/schema.ts",
  out: "./src/lib/drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  // Getters, so `db:generate` still runs with no Cloudflare credentials: it
  // reads the schema and writes SQL without touching the remote database. Only
  // a command that reads a credential pays for its absence, and it learns which
  // variable is missing instead of sending `undefined`.
  dbCredentials: {
    get accountId() {
      return requireCloudflareVar("CLOUDFLARE_ACCOUNT_ID");
    },
    get databaseId() {
      return requireCloudflareVar("CLOUDFLARE_D1_DATABASE_ID");
    },
    get token() {
      return requireCloudflareVar("CLOUDFLARE_API_TOKEN");
    },
  },
} satisfies Config;
