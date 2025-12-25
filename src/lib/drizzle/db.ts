import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const projectRef = supabaseUrl.hostname.split(".")[0];

  return `postgresql://postgres.${projectRef}:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
};

const connectionString = getDatabaseUrl();

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
