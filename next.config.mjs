import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// ローカル開発時にCloudflare D1/R2バインディングを有効化
// 注意: これはローカルデータベースを使用し、本番DBには接続されません
if (process.env.NODE_ENV === "development") {
  await initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
