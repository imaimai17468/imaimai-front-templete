# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `bun run dev` - Start development server (Next.js)
- `bun run build` - Build production application
- `bun run start` - Start production server
- `bun run typecheck` - Type check with TypeScript

### Code Quality Commands
- `bun run check` - Run Biome linter and formatter checks
- `bun run check:fix` - Run Biome with auto-fix (includes unsafe fixes)
- `bun run format` - Check formatting with Biome
- `bun run format:fix` - Auto-format code with Biome

### Git Hooks
- **Pre-commit**: Automatically runs `bun run check:fix` and stages fixed files
- **Pre-push**: Runs `bun run check` and `bun run typecheck` before pushing

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui with Radix UI primitives
- **Code Quality**: Biome for linting and formatting
- **Git hooks**: Lefthook

### Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   └── ui/                # shadcn/ui components
│       └── button.tsx     # Button component
└── lib/
    └── utils.ts           # Utility functions (cn helper)
```

### Component Architecture
- **UI Components**: Located in `src/components/ui/` - shadcn/ui components only
- **Shared Components**: Located in `src/components/shared/` - reusable components across features
- **Feature Components**: Located in `src/components/features/` - screen/page-specific components
- **Utility Function**: `cn()` in `src/lib/utils.ts` for className merging using clsx and tailwind-merge
- **Import Aliases**: Configured with `@/` prefix for clean imports

## Component Naming Conventions

### Strict Rules
1. **Directory names**: kebab-case
2. **TSX file names**: PascalCase
3. **Component names**: PascalCase (matches file name exactly)
4. **Directory and file names must correspond**: kebab-case → PascalCase conversion
5. **No barrel files (index.ts)** - use direct imports only
6. **Import paths**: Use absolute paths with `@/` alias, not relative paths

### Matching Rules
- **Directory name and TSX file name must match** (kebab-case → PascalCase conversion)
- **TSX file name and component name must be identical**
- **If directory name and TSX file name don't match, create a new directory**

### Examples

#### ✅ Correct Structure
```
src/components/features/videos/
├── Videos.tsx              // export function Videos()
└── empty-state/
    └── EmptyState.tsx      // export function EmptyState()
```

#### ❌ Incorrect Structure
```
src/components/features/videos/
├── VideoGrid.tsx           // Directory name doesn't match
└── empty-state/
    └── VideoEmpty.tsx      // Directory name doesn't match
```

#### 🔄 Correct Fix
```
src/components/features/
├── videos/
│   └── Videos.tsx          // export function Videos()
├── video-grid/
│   └── VideoGrid.tsx       // export function VideoGrid()
└── video-empty/
    └── VideoEmpty.tsx      // export function VideoEmpty()
```

### Naming Conversion Table

| Directory (kebab-case) | File (PascalCase) | Component Name |
|------------------------|-------------------|----------------|
| `video-grid`           | `VideoGrid.tsx`   | `VideoGrid`    |
| `empty-state`          | `EmptyState.tsx`  | `EmptyState`   |
| `user-profile`         | `UserProfile.tsx` | `UserProfile`  |
| `api-client`           | `ApiClient.tsx`   | `ApiClient`    |

### Import Style
```typescript
// ✅ Correct - Direct imports only
import { LoginForm } from "@/components/features/auth/login-form/LoginForm";
import { RegisterForm } from "@/components/features/auth/register-form/RegisterForm";

// ❌ Wrong - Using barrel files
import { LoginForm, RegisterForm } from "@/components/features/auth";
```

### Directory Structure Guidelines
```
src/components/
├── ui/                     # shadcn/ui components only
│   ├── button.tsx         # From shadcn/ui (flat naming)
│   └── input.tsx          # From shadcn/ui (flat naming)
├── shared/                # Reusable components across features
│   ├── header/
│   │   └── Header.tsx
│   └── loading-spinner/
│       └── LoadingSpinner.tsx
└── features/              # Screen/page-specific components
    ├── auth/
    │   └── login-form/
    │       └── LoginForm.tsx
    └── dashboard/
        └── user-stats/
            └── UserStats.tsx
```

#### Component Organization Rules
- **`ui/`**: Only components from shadcn/ui (follow shadcn flat naming: `button.tsx`, `input.tsx`)
- **`shared/`**: Reusable components used across multiple features/screens (follow directory naming convention)
- **`features/`**: Screen/page-specific components organized by feature area (follow directory naming convention)

### Component Creation Checklist
- [ ] Determine correct location: `ui/` (shadcn/ui), `shared/` (reusable), or `features/` (screen-specific)
- [ ] Directory name is kebab-case (except for `ui/` which uses flat naming)
- [ ] TSX file name is PascalCase (except for `ui/` which uses flat naming)
- [ ] Component name matches file name exactly
- [ ] Directory name converts to file name (kebab-case → PascalCase)
- [ ] No barrel files (index.ts) used
- [ ] Use absolute import paths with `@/` alias, not relative paths
- [ ] Direct imports used for all components

### Important Notes for AI Agents
- **Always get user approval** before creating, moving, or refactoring components
- **Present a clear plan** showing which naming rules apply and the exact file paths
- **Verify naming consistency** between directory, file, and component names before any file operations

## Code Style

### Biome Configuration
- **Indentation**: Tabs
- **Quotes**: Double quotes for JavaScript
- **Import Organization**: Automatic import sorting enabled
- **Custom Rules**:
  - `noUnusedImports`: error
  - `noUnusedVariables`: error
  - `useSortedClasses`: error (Tailwind class sorting)
- **File Scope**: Only processes `src/**/*.{js,ts,jsx,tsx,json,jsonc}` files

### TypeScript
- Uses strict mode
- Type checking with `tsc --noEmit`
- Next.js App Router with TypeScript configuration

## shadcn/ui Configuration

### Setup
- **Style**: New York variant
- **Base Color**: Neutral
- **CSS Variables**: Enabled
- **RSC**: React Server Components enabled
- **Icon Library**: Lucide React

### Path Aliases
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/utils` → `src/lib/utils`
- `@/ui` → `src/components/ui`
- `@/hooks` → `src/hooks`
