import type { InferEnv } from "alchemy/Cloudflare";
import type { App } from "../alchemy.run";

type AppEnv = InferEnv<typeof App>;

declare global {
  namespace Cloudflare {
    /** The bindings the Worker reads, each typed from its `App` declaration. */
    interface Env {
      readonly AVATARS_BUCKET: AppEnv["AVATARS_BUCKET"];
      readonly BETTER_AUTH_SECRET: AppEnv["BETTER_AUTH_SECRET"];
      readonly DB: AppEnv["DB"];
      readonly GOOGLE_CLIENT_ID: AppEnv["GOOGLE_CLIENT_ID"];
      readonly GOOGLE_CLIENT_SECRET: AppEnv["GOOGLE_CLIENT_SECRET"];
    }
  }

  type CloudflareEnv = Cloudflare.Env;
}
