import { defineConfig } from "void/config";

export default defineConfig({
  cloudflare: { main: "./src/server.entry.ts", name: "my-project" },
  worker: {
    compatibility_date: "2026-07-15",
    compatibility_flags: ["nodejs_compat"],
  },
});
