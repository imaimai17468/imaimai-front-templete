import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.AVATARS_BUCKET.get(key);

  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "image/png");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new NextResponse(object.body, { headers });
}
