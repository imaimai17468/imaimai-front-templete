# Tools

- **tsgo**: Type checker. Run `bun run typecheck`.
- **oxlint**: Linter. Run `bun run lint`. Config: `.oxlintrc.json`.
- **oxfmt**: Formatter. Run `bun run format` to fix, `bun run format:check` to verify.
- **knip**: Detects unused dependencies, exports, and files. Run `bun run knip`. Config: `knip.json`.
- **similarity**: Detects duplicate/similar code. Run `similarity-ts ./src` to scan, add `--print` to show code, `--threshold 0.7` to adjust sensitivity.
- **wrangler types**: Generates `CloudflareEnv` from `wrangler.toml`. Run `bun run cf-typegen` after changing bindings. Output `worker-configuration.d.ts` is gitignored — regenerate locally; do not hand-edit.
