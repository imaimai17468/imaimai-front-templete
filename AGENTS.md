<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Coding Style

- Do not use `for`, `for...in`, `for...of`, `while`, or `do...while` loops. Use functional alternatives such as `map`, `filter`, `reduce`, `flatMap`, and `forEach` instead.

## Architecture

- `src/lib/` and `src/components/` are exceptions to the colocation rule — they hold shared utilities (e.g., shadcn `utils.ts`) and shared UI components (e.g., shadcn `ui/`) respectively. Do not apply page-level architecture rules to these directories.
- Colocate components with their page: create a `components/` directory at the same level as the page that uses them.
- One component per `.tsx` file. When a component grows sub-components, promote it from a file to a directory (`Component.tsx` → `Component/Component.tsx`). Place child components as siblings in the same directory — do not nest `components/` inside.
- Use the Container / Presenter pattern. Container handles data fetching and state; Presenter is a pure rendering component receiving props.
- Extract logic into pure functions. Keep components free of complex inline logic.
- Components must be controllable from the outside via props. Avoid internal state that cannot be overridden — design for testability.
- Tests follow white-box testing: test internal logic paths, not just inputs/outputs.
- Use the AAA pattern (Arrange, Act, Assert). One `expect` per test case.
- Test names must follow the format: "should [expected behavior] when [condition]" (e.g., "should return error when value is 0").

## Tools

- **tsgo**: Type checker. Run `bun run typecheck`.
- **oxlint**: Linter. Run `bun run lint`. Config: `.oxlintrc.json`.
- **oxfmt**: Formatter. Run `bun run format` to fix, `bun run format:check` to verify.
- **knip**: Detects unused dependencies, exports, and files. Run `bun run knip`. Config: `knip.json`.
- **similarity**: Detects duplicate/similar code. Run `similarity-ts ./src` to scan, add `--print` to show code, `--threshold 0.7` to adjust sensitivity.
