import "@tanstack/react-start/server-only";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { memoizeValue } from "@/lib/memoize-value";

export const getDb: () => DrizzleD1Database = memoizeValue(() =>
  drizzle(getCloudflareEnv().DB)
);
