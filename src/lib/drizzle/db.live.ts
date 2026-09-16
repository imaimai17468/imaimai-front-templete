import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareEnv } from "@/lib/cloudflare/env.live";
import { memoizeValue } from "@/lib/memoize-value";
import * as schema from "./schema";

export const getDb: () => DrizzleD1Database<typeof schema> = memoizeValue(() =>
  drizzle(getCloudflareEnv().DB, { schema })
);
