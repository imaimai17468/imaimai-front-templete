# Imaimai Front Template

### Overview
"Imaimai Front Template" is a Next.js project designed for high-performance and fast development using cutting-edge technology. With Bun as the package manager, it achieves faster build times and execution. Lefthook automates pre-commit and pre-push checks to ensure stable code quality.

### Features
- **High Performance**: Leveraging Bun for faster builds and execution compared to traditional environments.
- **Theme Switching**: Integrated with `next-themes` for seamless dark/light theme toggling.
- **Intuitive UI**: Built with shadcn/ui, offering stylish, highly customizable UI components.
- **Code Quality Assurance**: Biome handles code checks and formatting automatically before commits. TypeScript type checks are also run to catch potential errors early.
- **Sidebar Included**: An implemented sidebar enhances usability and navigation.

### Technologies Used
- **Next.js**: A powerful framework for server-side rendering and static site generation.
- **Bun**: A fast JavaScript runtime for building, executing, and managing packages.
- **shadcn/ui**: A stylish and modern UI component library.
- **Tailwind CSS**: A customizable utility-first CSS framework.
- **TypeScript**: Ensures type safety and reliability.

### Scripts
- `dev`: Starts the development server.
- `build`: Builds the app for production.
- `start`: Runs the production build.
- `check`: Runs Biome for code checks with auto-fixes.
- `format`: Formats code using Biome.
- `init:lefthook`: Sets up Lefthook.

### Lefthook Hooks
#### pre-commit
1. **fix**: Formats staged files using Biome and updates the index.
2. **check**: Runs Biome checks on staged files.
3. **type**: Runs TypeScript type checks to prevent potential errors.

#### pre-push
1. **check**: Runs Biome checks on staged files.
