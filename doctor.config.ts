import { defineConfig } from "react-doctor/api";

export default defineConfig({
  ignore: {
    files: [".wrangler/**", "dist/**", "src/shared/ui/**"],
    // fallow reports unused files and exports for this repository, from the
    // entry points .fallowrc.jsonc names, and CI runs it as `bun run
    // dead-code`. It also exempts the `@public` exports under src/shared and
    // src/lib: deleting those four tags made it report them.
    rules: ["deslop/unused-export", "deslop/unused-file"],
  },
});
