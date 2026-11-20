import { defineConfig } from "void/config";

export default defineConfig({
  cloudflare: { name: "my-project" },
  worker: {
    compatibility_date: "2026-07-15",
    compatibility_flags: ["nodejs_compat"],
  },
});
