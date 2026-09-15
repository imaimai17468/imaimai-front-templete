import { getCloudflareEnv } from "@/lib/cloudflare/env.live";

/**
 * The `AVATARS_BUCKET` binding, reached by key.
 *
 * `put` records `contentType` as the stored object's `httpMetadata` and returns
 * nothing, so the URL a user row stores and the failure a caller reports are
 * both decided above this module.
 */
export const r2AvatarBucket = {
  delete: async (key: string): Promise<void> => {
    await getCloudflareEnv().AVATARS_BUCKET.delete(key);
  },

  get: async (key: string): Promise<R2ObjectBody | null> =>
    await getCloudflareEnv().AVATARS_BUCKET.get(key),

  put: async (
    key: string,
    file: File | ArrayBuffer,
    contentType: string
  ): Promise<void> => {
    await getCloudflareEnv().AVATARS_BUCKET.put(key, file, {
      httpMetadata: { contentType },
    });
  },
};
