// Cloudflare bindings augmentation
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    AVATARS_BUCKET: R2Bucket;
  }
}

export {};
