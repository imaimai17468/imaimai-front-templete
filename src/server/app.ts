import { Hono } from "hono";
import { getAuth } from "@/lib/auth/auth";
import { getAvatarResponse } from "@/server/handlers/avatar";

// Bindings are read through `cloudflare:workers` in src/server/cloudflare.ts
// rather than Hono's `c.env`, because this app is reached via `app.fetch(request)`
// from a TanStack Start server route, which passes no env argument.
export const app = new Hono();

// Google drives this one, so it has to stay a URL rather than a procedure call.
app.all("/api/auth/*", async (c) => getAuth().handler(c.req.raw));

// `<img src>` needs a URL too. The bucket stays private; this endpoint is what
// applies the ownership check before streaming an object.
app.get("/api/avatars", async (c) => getAvatarResponse(c.req.raw));
