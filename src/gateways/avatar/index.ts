import { getCloudflareEnv } from "@/server/cloudflare";

export interface AvatarObject {
  body: R2ObjectBody["body"];
  contentType: string | null;
}

/**
 * The read side of the avatar bucket.
 *
 * The gateway is written against this rather than against an R2 binding, so a
 * test supplies a fake without a Cloudflare environment.
 */
export interface AvatarBucket {
  get: (key: string) => Promise<{
    body: R2ObjectBody["body"];
    httpMetadata?: { contentType?: string | undefined } | undefined;
  } | null>;
}

export interface AvatarGatewayDeps {
  bucket: AvatarBucket;
}

export const createAvatarGateway = ({ bucket }: AvatarGatewayDeps) => ({
  fetchAvatar: async (key: string): Promise<AvatarObject | null> => {
    const object = await bucket.get(key);
    if (object === null) {
      return null;
    }
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType ?? null,
    };
  },
});

export const avatarGateway = createAvatarGateway({
  bucket: {
    get: async (key) => await getCloudflareEnv().AVATARS_BUCKET.get(key),
  },
});
