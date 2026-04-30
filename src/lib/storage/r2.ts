import { getCloudflareEnv } from "@/server/cloudflare";

export const uploadToR2 = async (
  key: string,
  file: File | ArrayBuffer,
  contentType: string
): Promise<string> => {
  await getCloudflareEnv().AVATARS_BUCKET.put(key, file, {
    httpMetadata: { contentType },
  });
  return `/api/avatars?key=${encodeURIComponent(key)}`;
};

/** @public R2 オブジェクト削除。テンプレ用途で公開、派生実装で使う想定。 */
export const deleteFromR2 = async (key: string): Promise<void> => {
  await getCloudflareEnv().AVATARS_BUCKET.delete(key);
};
