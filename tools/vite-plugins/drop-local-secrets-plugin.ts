import type { Plugin } from "vite";

/**
 * The file `@cloudflare/vite-plugin` writes beside the built `wrangler.json`,
 * holding the value of every `[secrets] required` name it found in `.dev.vars`,
 * `.env*` or the build's own environment.
 */
export const LOCAL_SECRETS_FILE = ".dev.vars";

/**
 * Removes that file from the bundle before it is written, so no build output
 * holds a local secret value. Ordered after the Cloudflare plugin, which emits
 * the file from its own `generateBundle`.
 */
export const dropLocalSecrets = (): Plugin => ({
  apply: "build",
  enforce: "post",
  generateBundle(_options, bundle) {
    Reflect.deleteProperty(bundle, LOCAL_SECRETS_FILE);
  },
  name: "drop-local-secrets",
});
