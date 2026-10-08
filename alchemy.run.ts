import { existsSync, readFileSync } from "node:fs";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { parse } from "dotenv";
import { Config, Effect, Layer } from "effect";
import { secretsFromDevFile } from "./scripts/deploy-secrets";

export const STACK_NAME = "my-project";

const DEV_ENV_FILE = ".env.local";

const Database = Cloudflare.D1.Database("db", {
  migrations: "src/lib/drizzle/migrations",
});

const AvatarsBucket = Cloudflare.R2.Bucket("avatars");

export const WORKER_SOURCE = {
  compatibility: { date: "2026-07-15", flags: ["nodejs_compat"] },
  main: "src/ssr.tsx",
};

export const App = Cloudflare.Website.Vite("app", {
  ...WORKER_SOURCE,
  // portless hands the port it proxies to in PORT, and serves nothing if the
  // dev server moves off it. Without PORT, Google's redirect URI for local
  // sign-in is http://localhost:5173, and a taken port moves to the next one.
  dev: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: process.env.PORT !== undefined,
  },
  env: {
    AVATARS_BUCKET: AvatarsBucket,
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    DB: Database,
    GOOGLE_CLIENT_ID: Config.Redacted("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: Config.Redacted("GOOGLE_CLIENT_SECRET"),
  },
});

const isDev = Effect.orDie(Alchemy.ALCHEMY_DEV);

// `alchemy dev` keeps its records in .alchemy/ so it runs without a Cloudflare
// account. A deploy keeps them in the account, where CI and every machine read
// the same records.
const state = Layer.unwrap(
  isDev.pipe(
    Effect.map((dev) => (dev ? Alchemy.localState() : Cloudflare.state()))
  )
);

const devFileValues = () =>
  existsSync(DEV_ENV_FILE) ? parse(readFileSync(DEV_ENV_FILE)) : {};

export default Alchemy.Stack(
  STACK_NAME,
  { providers: Cloudflare.providers(), state },
  Effect.gen(function* stack() {
    const leaked = (yield* isDev)
      ? []
      : secretsFromDevFile(process.env, devFileValues());
    if (leaked.length > 0) {
      return yield* Effect.die(
        new Error(
          `${leaked.join(", ")} would deploy with the value ${DEV_ENV_FILE} holds, which bun loads into every process it starts. Export the production values in the shell, which win over the file, then deploy.`
        )
      );
    }
    const app = yield* App;
    return { url: app.url };
  })
);
