import { drizzle } from "drizzle-orm/d1";
import { getCloudflareEnv } from "@/server/cloudflare";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = () => {
  if (cached) return cached;
  cached = drizzle(getCloudflareEnv().DB, { schema });
  return cached;
};
