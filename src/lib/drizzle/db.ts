import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { getCloudflareEnv } from "@/server/cloudflare";
import * as schema from "./schema";

type Db = DrizzleD1Database<typeof schema>;

let cached: Db | null = null;

export const getDb = (): Db => {
  if (cached) return cached;
  cached = drizzle(getCloudflareEnv().DB, { schema });
  return cached;
};
