# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from your training data. Heed deprecation notices emitted by `next dev`.

## Coding Style

- Do not use `for`, `for...in`, `for...of`, `while`, or `do...while` loops. Use functional alternatives such as `map`, `filter`, `reduce`, `flatMap`, and `forEach` instead.
- Do not use Tailwind arbitrary value notation `[...]` (e.g., `w-[327px]`, `text-[#1a1a1a]`). For sizing utilities (`w-`, `h-`, `p-`, `m-`, `gap-`, etc.), rely on Tailwind v4's `--spacing`-based system, where any integer class is valid (e.g., `w-80`, `w-327`). For "tokenizable" values like colors, font sizes, and radii, add a token to `globals.css` first and then reference it via a Tailwind class.
- Do not adjust shades with the color opacity modifier `-XXX/YY` (e.g., `text-gray-800/80`, `bg-blue-600/50`). When you need a "lighter color," switch to a **different shade** instead of layering opacity (e.g., `text-gray-800` → `text-gray-700`). When true transparency is genuinely required (overlays, etc.), register a dedicated color token in `globals.css` first and reference it.

## Architecture

- `src/lib/` and `src/components/` are exceptions to the colocation rule — they hold shared utilities (e.g., shadcn `utils.ts`) and shared UI components (e.g., shadcn `ui/`) respectively. Do not apply page-level architecture rules to these directories.
- Colocate components with their page: create a `components/` directory at the same level as the page that uses them.
- One component per `.tsx` file. Every component is placed in its own directory from the start (`Component/Component.tsx`) — do not create flat `Component.tsx` files and later promote them. Child components are added as siblings in the same directory (`Component/Child.tsx`). Do not nest `components/` inside a component directory.
- Use the Container / Presenter pattern. Container handles data fetching and state; Presenter is a pure rendering component receiving props.
- Extract logic into pure functions. Keep components free of complex inline logic.
- Components must be controllable from the outside via props. Avoid internal state that cannot be overridden — design for testability.
- Pure functions always require tests. Components require tests when rendering varies by props/state, or when a11y attributes (`aria-*`, `role`, etc.) are attached — i.e. cases where a snapshot is the only way to catch regressions on later changes. See `.claude/skills/coding-guide/SKILL.md` for details.
- Tests follow white-box testing: test internal logic paths, not just inputs/outputs.
- Use the AAA pattern (Arrange, Act, Assert). One `expect` per test case.
- Test names must follow the format: "should [expected behavior] when [condition]" (e.g., "should return error when value is 0").

## Dependencies

- **Pin dependency versions exactly** in `package.json`. Do not use range specifiers like `^` or `~`, or major-only specifiers like `"4"` — always write exact versions such as `"1.2.3"`. When adding a package, either install it as exact (`bun add -E <pkg>`) or manually strip the range marker after installation so the entry is an exact version.

## Tools

- **tsgo**: Type checker. Run `bun run typecheck`.
- **oxlint**: Linter. Run `bun run lint`. Config: `.oxlintrc.json`.
- **oxfmt**: Formatter. Run `bun run format` to fix, `bun run format:check` to verify.
- **knip**: Detects unused dependencies, exports, and files. Run `bun run knip`. Config: `knip.json`.
- **similarity**: Detects duplicate/similar code. Run `similarity-ts ./src` to scan, add `--print` to show code, `--threshold 0.7` to adjust sensitivity.
- **wrangler types**: Generates `CloudflareEnv` from `wrangler.toml`. Run `bun run cf-typegen` after changing bindings. Output `worker-configuration.d.ts` is gitignored — regenerate locally; do not hand-edit.
