import {
  Array,
  Context,
  Effect,
  Layer,
  Order,
  Record,
  String,
  pipe,
} from "effect";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { withRuntimeEnv } from "void/_env";
import type projectEnv from "../../env.ts";

const MIGRATION_FILES = import.meta.glob<string>("../../db/migrations/*.sql", {
  eager: true,
  import: "default",
  query: "?raw",
});

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

/** Every statement of `db/migrations/`, in the order the file names sort. */
const migrationStatements = pipe(
  Record.toEntries(MIGRATION_FILES),
  Array.sortWith(([file]) => file, Order.String),
  Array.flatMap(([, sql]) => String.split(sql, STATEMENT_BREAKPOINT)),
  Array.map(String.trim),
  Array.filter(String.isNonEmpty)
);

/**
 * Placeholder secrets, installed beside the bindings so a run that builds
 * Better Auth reads them. No test here signs in with Google, so its two only
 * have to be present.
 */
const LOCAL_SECRETS = {
  BETTER_AUTH_SECRET: "local-bindings-secret-at-least-32-chars",
  GOOGLE_CLIENT_ID: "local-bindings-google-client-id",
  GOOGLE_CLIENT_SECRET: "local-bindings-google-client-secret",
} satisfies typeof projectEnv;

/**
 * Starts workerd through Miniflare with an empty D1 in a temporary directory
 * of its own, bound as `DB`, and an empty R2 bound as `STORAGE`.
 */
const startMiniflare = Effect.acquireRelease(
  Effect.sync(
    () =>
      new Miniflare(
        convertV4MiniflareOptions({
          d1Databases: { DB: "local-bindings-db" },
          modules: true,
          r2Buckets: { STORAGE: "local-bindings-bucket" },
          script: "export default { fetch: () => new Response(null) };",
        })
      )
  ),
  (miniflare) => Effect.promise(() => miniflare.dispose())
);

/**
 * A local D1, migrated from `db/migrations/`, a local R2, and the secrets
 * Better Auth reads.
 *
 * `within` hands the bindings to one run through Void's request env, an
 * `AsyncLocalStorage`, so nothing is left installed once the run ends and a
 * file that runs later in the same worker finds no binding.
 */
export class LocalBindings extends Context.Service<
  LocalBindings,
  {
    readonly within: <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>;
  }
>()("my-app/test/local-bindings/LocalBindings") {
  static readonly layer = Layer.effect(
    LocalBindings,
    Effect.gen(function* () {
      const miniflare = yield* startMiniflare;
      const database = yield* Effect.promise(() =>
        miniflare.getD1Database("DB")
      );
      const bucket = yield* Effect.promise(() =>
        miniflare.getR2Bucket("STORAGE")
      );
      yield* Effect.promise(() =>
        database.batch(
          pipe(
            migrationStatements,
            Array.map((statement) => database.prepare(statement))
          )
        )
      );
      const env = { ...LOCAL_SECRETS, DB: database, STORAGE: bucket };

      return LocalBindings.of({
        within: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          Effect.context<R>().pipe(
            Effect.flatMap((context) =>
              Effect.promise((signal) =>
                withRuntimeEnv(env, () =>
                  Effect.runPromiseExitWith(context)(effect, { signal })
                )
              )
            ),
            Effect.flatten
          ),
      });
    })
  );
}
