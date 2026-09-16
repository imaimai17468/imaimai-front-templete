import { getCloudflareEnv } from "@/lib/cloudflare/env.live";

/**
 * The `AVATARS_BUCKET` binding, reached by key.
 *
 * Each call hands back what the binding answers with, so the URL a user row
 * stores and the failure a caller reports are both decided above this module.
 */
export const r2AvatarBucket = {
  delete: (key: string) => getCloudflareEnv().AVATARS_BUCKET.delete(key),

  get: (key: string) => getCloudflareEnv().AVATARS_BUCKET.get(key),

  put: (key: string, file: File | ArrayBuffer, contentType: string) =>
    getCloudflareEnv().AVATARS_BUCKET.put(key, file, {
      httpMetadata: { contentType },
    }),
};
