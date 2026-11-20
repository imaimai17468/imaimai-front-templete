import { defineEnv, string } from "void/env";

export default defineEnv({
  BETTER_AUTH_SECRET: string(),
  GOOGLE_CLIENT_ID: string(),
  GOOGLE_CLIENT_SECRET: string(),
});
