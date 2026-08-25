import { defineConfig } from "react-doctor/api";

export default defineConfig({
  ignore: {
    files: [".wrangler/**", "dist/**", "src/components/ui/**"],
    // knip covers unused files and exports for this repo, runs in the stop
    // gate, and honours the `@public` tag these exports carry.
    rules: ["deslop/unused-export", "deslop/unused-file"],
  },
});
