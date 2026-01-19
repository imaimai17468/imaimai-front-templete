# Storybook Guidelines

This document defines standards and best practices for creating and maintaining Storybook stories.

## Creation Rules

- **Create stories for conditional rendering branches**. Stories target conditional operators like `&&` and `?` that show/hide elements or render different UI.
- Do not create stories for simple prop value differences (variant, size, color, etc.). A default story is sufficient.
- Examples: Displaying error messages on error state, showing spinners during loading, displaying empty state when no data exists.
- Do not create stories for hidden states like `isVisible: false` or for logic verification purposes.
- Keep Meta configuration minimal, specifying only `component`.
- Use `fn()` for event handlers in each story's `args`. Do not include them in meta.
- Barrel imports are prohibited. Use individual imports with `@/` alias.
- Name each story in Japanese to make visual differences immediately clear, avoiding duplicate appearances.
- Implement in TypeScript with Japanese comments and documentation.

## Anti-patterns to Avoid

- Forcing stories for states that require mocking internal hooks.
- Creating multiple stories with identical visual appearance.
- Adding stories for logic verification or empty renders.

## Code Examples

### Basic Story File Structure (No Conditional Branching)

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Button } from "@/components/ui/button/Button";

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Don't create stories for simple prop differences like variant, size
export const Default: Story = {
  args: {
    onClick: fn(),
    children: "Button",
  },
};
```

### Conditional Branching Example (Error State)

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { FormField } from "@/components/ui/form-field/FormField";

const meta = {
  component: FormField,
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

// When component displays different UI based on error presence
export const Default: Story = {
  args: {
    label: "Username",
    value: "",
    onChange: fn(),
  },
};

// Error message is displayed when error exists (conditional branching)
export const ErrorState: Story = {
  args: {
    label: "Username",
    value: "a",
    error: "Username must be at least 3 characters",
    onChange: fn(),
  },
};
```

### Loading State Example

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { DataList } from "@/components/features/data/data-list/DataList";

const meta = {
  component: DataList,
} satisfies Meta<typeof DataList>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockData = [
  { id: "1", name: "Item 1" },
  { id: "2", name: "Item 2" },
  { id: "3", name: "Item 3" },
];

// Normal display
export const Default: Story = {
  args: {
    data: mockData,
    onItemClick: fn(),
  },
};

// Spinner is shown when isLoading is true (conditional branching)
export const Loading: Story = {
  args: {
    data: [],
    isLoading: true,
    onItemClick: fn(),
  },
};

// Empty state is shown when data is empty (conditional branching)
export const NoData: Story = {
  args: {
    data: [],
    onItemClick: fn(),
  },
};
```

### Authentication State Example

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { UserMenu } from "@/components/features/header/user-menu/UserMenu";

const meta = {
  component: UserMenu,
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockUser = {
  id: "1",
  name: "Taro Yamada",
  avatarUrl: "https://example.com/avatar.jpg",
};

// User menu is displayed when logged in
export const LoggedIn: Story = {
  args: {
    user: mockUser,
    onLogout: fn(),
  },
};

// Login button is displayed when user is null (conditional branching)
export const NotLoggedIn: Story = {
  args: {
    user: null,
    onLogin: fn(),
  },
};
```

### Bad Examples (Avoid These)

```typescript
// ❌ Creating multiple stories for simple prop value differences
export const PrimaryButton: Story = {
  args: {
    variant: "primary",
    children: "Button",
  },
};

export const SecondaryButton: Story = {
  args: {
    variant: "secondary",
    children: "Button",
  },
};

export const LargeButton: Story = {
  args: {
    size: "large",
    children: "Button",
  },
};

// ❌ Hidden state story (no visual difference)
export const Hidden: Story = {
  args: {
    isVisible: false,
  },
};

// ❌ Duplicate stories with same appearance
export const Default1: Story = {
  args: {
    text: "Test 1",
  },
};

export const Default2: Story = {
  args: {
    text: "Test 2",
  },
};
```
