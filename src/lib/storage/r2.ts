import { getCloudflareContext } from "@opennextjs/cloudflare";

export const uploadToR2 = async (
  key: string,
  file: File | ArrayBuffer,
  contentType: string
): Promise<string> => {
  const { env } = await getCloudflareContext({ async: true });
  await env.AVATARS_BUCKET.put(key, file, {
    httpMetadata: { contentType },
  });
  return `/api/avatars?key=${encodeURIComponent(key)}`;
};

export const deleteFromR2 = async (key: string): Promise<void> => {
  const { env } = await getCloudflareContext({ async: true });
  await env.AVATARS_BUCKET.delete(key);
};
