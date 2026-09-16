import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Option } from "effect";
import { getCloudflareEnv } from "@/lib/cloudflare/env.live";
import * as schema from "./schema";

type Db = DrizzleD1Database<typeof schema>;

const dbMemo = {
  instance: Option.none<Db>(),
};

export const getDb = (): Db =>
  Option.getOrElse(dbMemo.instance, () => {
    const fresh = drizzle(getCloudflareEnv().DB, { schema });
    dbMemo.instance = Option.some(fresh);
    return fresh;
  });
