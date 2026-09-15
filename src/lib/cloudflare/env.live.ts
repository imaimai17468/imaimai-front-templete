// `cloudflare:workers` is provided by the Workers runtime (and by
// @cloudflare/vite-plugin during dev). When running outside a Worker (vitest),
// imports of this module should be avoided — D1 / R2 bindings have no meaning
// in that environment.
import { env as runtimeEnv } from "cloudflare:workers";

export const getCloudflareEnv = (): CloudflareEnv => runtimeEnv;
