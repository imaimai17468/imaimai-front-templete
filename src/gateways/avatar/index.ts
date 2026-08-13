import { getCloudflareEnv } from "@/server/cloudflare";

export interface AvatarObject {
  body: R2ObjectBody["body"];
  contentType: string | null;
}

export const fetchAvatar = async (
  key: string
): Promise<AvatarObject | null> => {
  const object = await getCloudflareEnv().AVATARS_BUCKET.get(key);
  if (object === null) {
    return null;
  }
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType ?? null,
  };
};
