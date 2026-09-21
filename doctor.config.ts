import { defineConfig } from "react-doctor/api";

export default defineConfig({
  ignore: {
    files: [".wrangler/**", "dist/**", "src/shared/ui/**"],
    // `bun run dead-code` reports both for this repository, from the entry
    // points .fallowrc.jsonc names, and it exempts an export tagged `@public`,
    // which the template's deliberately unconsumed exports carry.
    rules: ["deslop/unused-export", "deslop/unused-file"],
  },
});
