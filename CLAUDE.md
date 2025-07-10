# CLAUDE.md

## 🚨 For AI Agents: Required Reading Order

### Files to Read First
1. **CLAUDE.xml** - Structured summary of core rules, workflow, and checklists
2. **CLAUDE.md** - Detailed implementation guidelines (refer as needed)

### Reference Patterns During Work
- **At work start**: Check CLAUDE.xml for workflow and checklists
- **During implementation**: Check CLAUDE.md for specific naming conventions and technical details
- **When uncertain**: Return to CLAUDE.xml to reconfirm basic principles

**⚠️ CRITICAL**: AI agents must always start by reading CLAUDE.xml first. Never proceed based on assumptions or guesswork.

---

This file provides detailed guidance to Claude Code (claude.ai/code) when working with code in this repository. For structured overview and essential rules, **always start with CLAUDE.xml first**.

## Important: Core Principles

### 1. Japanese Communication
Claude Code must communicate in Japanese. All commit messages, comments, error messages, and user interactions should be in Japanese.

### 2. Pre-approval Requirement
**Critical**: Before creating, editing, or deleting files, always report the following and obtain explicit user approval:
- List of target files
- Detailed description of changes to be made
- Explanation of impact scope

### 3. Decision Authority Principle
- **Final decision authority always belongs to the user**
- AI must not arbitrarily choose alternative approaches or workarounds
- Always ask questions when uncertain, never proceed based on assumptions

### 4. CLAUDE.md Compliance Verification
Before starting work, verify compliance with relevant rules in this CLAUDE.md and report this to the user.

### 5. Standard Workflow
Follow these steps for all tasks:

```yaml
Step 1: Task Understanding
  - Clearly understand user requirements
  - Ask questions if anything is unclear
  - Confirm expected deliverables

Step 2: Planning
  - Create detailed execution plan
  - Identify affected files and systems
  - Assess risks and considerations

Step 3: Pre-reporting
  - Report plan to user
  - Obtain explicit approval
  - Do not execute without approval

Step 4: Execution
  - Execute according to plan
  - Report unexpected situations immediately
  - Do not make independent decisions

Step 5: Completion Report
  - Report execution results in detail
  - Request confirmation of changes
  - Confirm next actions
```

### 6. Mandatory Checklist
Execute these checklists before operations:

#### Before File Operations
- [ ] Verified relevant CLAUDE.md rules
- [ ] Understood current state of target files
- [ ] Identified scope of impact from changes
- [ ] Obtained explicit user approval
- [ ] Considered backup and recovery methods

#### Before Code Generation/Editing
- [ ] Verified project naming conventions
- [ ] Understood existing code style
- [ ] Verified dependencies and tech stack
- [ ] Confirmed testing and quality requirements

#### Before Git Operations
- [ ] Confirmed changes are as intended
- [ ] Verified commit message guidelines
- [ ] Understood branching strategy
- [ ] Performed final verification before push

## Table of Contents

- [Important: Core Principles](#important-core-principles) (Line 5)
  - [1. Japanese Communication](#1-japanese-communication) (Line 7)
  - [2. Pre-approval Requirement](#2-pre-approval-requirement) (Line 10)
  - [3. Decision Authority Principle](#3-decision-authority-principle) (Line 16)
  - [4. CLAUDE.md Compliance Verification](#4-claudemd-compliance-verification) (Line 21)
  - [5. Standard Workflow](#5-standard-workflow) (Line 24)
  - [6. Mandatory Checklist](#6-mandatory-checklist) (Line 54)
- [Development Commands](#development-commands) (Line 58)
  - [Core Commands](#core-commands) (Line 60)
  - [Code Quality Commands](#code-quality-commands) (Line 66)
  - [Git Hooks](#git-hooks) (Line 72)
- [Architecture](#architecture) (Line 76)
  - [Tech Stack](#tech-stack) (Line 78)
  - [Project Structure](#project-structure) (Line 86)
  - [Component Architecture](#component-architecture) (Line 100)
- [Component Naming Conventions](#component-naming-conventions) (Line 107)
  - [Strict Rules](#strict-rules) (Line 109)
  - [Matching Rules](#matching-rules) (Line 117)
  - [Examples](#examples) (Line 122)
  - [Naming Conversion Table](#naming-conversion-table) (Line 151)
  - [Import Style](#import-style) (Line 160)
  - [Directory Structure Guidelines](#directory-structure-guidelines) (Line 170)
  - [Component Creation Checklist](#component-creation-checklist) (Line 195)
  - [Important Notes for AI Agents](#important-notes-for-ai-agents) (Line 205)
- [Naming Conventions](#naming-conventions) (Line 264)
  - [English Grammar Rules](#english-grammar-rules) (Line 266)
  - [Abbreviation Rules](#abbreviation-rules) (Line 291)
- [Component Separation Guidelines](#component-separation-guidelines) (Line 315)
- [Testing Guidelines](#testing-guidelines) (Line 470)
- [Storybook Guidelines](#storybook-guidelines) (Line 750)
- [shadcn/ui Configuration](#shadcnui-configuration) (Line 868)

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

### Testing Commands
- `bun run test` - Run tests with Vitest once and exit (use this instead of `bun test`)

### Code Analysis Commands
- `similarity-ts .` - Detect duplicate functions and similar code patterns across codebase

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

### Package by Feature Architecture

**Core Principle**: Group related code by feature rather than by technical type. Keep feature-specific logic close to the components that use it.

#### Directory Organization Rules
1. **Global Utilities**: Truly generic functions go in `src/lib/` or `src/hooks/`
2. **Feature-Specific Logic**: Hooks, utilities, and types specific to a feature stay within the feature directory
3. **Colocation**: Keep related code as close as possible to where it's used

#### Examples

#### ✅ Correct Feature Organization
```
src/components/features/chat-page/
├── ChatPage.tsx                 # Main component
├── messageHandlers.ts           # Feature-specific logic
├── useChatState.ts             # Feature-specific hook
├── types.ts                    # Feature-specific types
├── chat-header/
│   └── ChatHeader.tsx
├── chat-message/
│   ├── ChatMessage.tsx
│   └── messageUtils.ts         # Message-specific utilities
└── chat-input-area/
    ├── ChatInputArea.tsx
    └── inputValidation.ts      # Input-specific logic
```

#### ❌ Incorrect Organization
```
src/
├── hooks/
│   ├── useChatState.ts         # Should be in chat-page feature
│   └── useMessageHandling.ts   # Should be in chat-page feature
├── utils/
│   ├── messageHandlers.ts      # Should be in chat-page feature
│   └── inputValidation.ts      # Should be in chat-input-area
└── components/features/chat-page/
    └── ChatPage.tsx            # Separated from its logic
```

#### Global vs Feature-Specific Guidelines

**Place in Global Locations** (`src/lib/`, `src/hooks/`):
- Utilities used across multiple features
- Core application logic
- Third-party integrations
- Common type definitions

**Place in Feature Directories**:
- Feature-specific business logic
- Component-specific utilities
- Feature-specific hooks
- Feature-specific types
- Logic used only within that feature

## Component Naming Conventions

### Strict Rules
1. **Directory names**: kebab-case
2. **TSX file names**: PascalCase
3. **TS file names**: camelCase (for utility functions, helpers, types, etc.)
4. **Component names**: PascalCase (matches file name exactly)
5. **Directory and file names must correspond**: kebab-case → PascalCase conversion
6. **No barrel files (index.ts)** - use direct imports only
7. **Import paths**: Use absolute paths with `@/` alias, not relative paths

### Matching Rules
- **Directory name and TSX file name must match** (kebab-case → PascalCase conversion)
- **TSX file name and component name must be identical**
- **If directory name and TSX file name don't match, create a new directory**

### Examples

#### ✅ Correct Structure
```
src/components/features/videos/
├── Videos.tsx              // export function Videos()
├── videoHelpers.ts         // camelCase for TS utility files
└── empty-state/
    └── EmptyState.tsx      // export function EmptyState()
```

#### ❌ Incorrect Structure
```
src/components/features/videos/
├── VideoGrid.tsx           // Directory name doesn't match
├── video-helpers.ts        // Should be camelCase
└── empty-state/
    └── VideoEmpty.tsx      // Directory name doesn't match
```

#### 🔄 Correct Fix
```
src/components/features/
├── videos/
│   ├── Videos.tsx          // export function Videos()
│   └── videoHelpers.ts     // camelCase for TS utility files
├── video-grid/
│   └── VideoGrid.tsx       // export function VideoGrid()
└── video-empty/
    └── VideoEmpty.tsx      // export function VideoEmpty()
```

### Naming Conversion Table

| Directory (kebab-case) | TSX File (PascalCase) | TS File (camelCase) | Component Name |
|------------------------|----------------------|---------------------|----------------|
| `video-grid`           | `VideoGrid.tsx`      | `videoHelpers.ts`   | `VideoGrid`    |
| `empty-state`          | `EmptyState.tsx`     | `stateUtils.ts`     | `EmptyState`   |
| `user-profile`         | `UserProfile.tsx`    | `userHelpers.ts`    | `UserProfile`  |
| `api-client`           | `ApiClient.tsx`      | `apiUtils.ts`       | `ApiClient`    |

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
- [ ] TS file name is camelCase (for utilities, helpers, types)
- [ ] Component name matches file name exactly
- [ ] Directory name converts to file name (kebab-case → PascalCase)
- [ ] Feature-specific logic stays within feature directory (Package by Feature)
- [ ] Global utilities only for truly generic functions
- [ ] No barrel files (index.ts) used
- [ ] Use absolute import paths with `@/` alias, not relative paths
- [ ] Direct imports used for all components
- [ ] **Avoid prop names that conflict with ARIA attributes** (e.g., use `avatarType` instead of `role`)

### Important Notes for AI Agents
- **Always get user approval** before creating, moving, or refactoring components
- **Present a clear plan** showing which naming rules apply and the exact file paths
- **Verify naming consistency** between directory, file, and component names before any file operations

## Naming Conventions

### English Grammar Rules

**Principle**: Use natural English following proper grammar rules.

#### Basic Rules
- **Functions**: Start with verbs (`getUserById`, `isValid`, `canEdit`)
- **Variables**: Use nouns (`userId`, `totalPrice`, `isLoading`)
- **Components**: Use nouns (`UserProfile`, `NavigationMenu`)
- **Event Handlers**: `handle` + event name (`handleSubmit`, `handleClick`)

#### Common Mistakes
```typescript
// ❌ Missing verbs
function userById() // → getUserById()
const validEmail // → isEmailValid or validateEmail()

// ❌ Japanese-style thinking
const getUserInfo // → getUserInformation
const calcPrice // → calculatePrice

// ❌ Unnatural word order
const usersActive // → activeUsers
function getUserFromId() // → getUserById()
```

### Abbreviation Rules

**Principle**: Avoid abbreviations, use full English words.

#### Basic Rules
- **Avoid**: `bg` → `backgroundColor`, `prev` → `previous`, `btn` → `button`
- **Acceptable**: Only established technical terms (`id`, `url`, `ref`)

#### Acronym Casing Rules
In compound words, maintain the standard casing of acronyms:

```typescript
// ✅ Correct
const generateURLParameter = () => {};  // URL stays uppercase
const APIClient = class {};             // API stays uppercase
const parseJWTToken = () => {};         // JWT stays uppercase

// ❌ Wrong
const generateUrlParameter = () => {};  // Url → URL
const apiClient = class {};             // api → API
const parseJwtToken = () => {};         // Jwt → JWT
```


## Component Separation Guidelines

### Core Principle: Observability of Behavior
**The fundamental rule for component separation is whether "all behaviors can be observed."** Length alone is not a criterion for separation. The key question is: **Can you write tests for it? Is separation necessary to write proper tests?**

### When NOT to Separate Components

#### ✅ Props-based Conditional Rendering
If you have conditional rendering based on props that can be directly controlled:

```typescript
// ✅ No need to separate - can test via Storybook stories with different props
function MyComponent({ variant }: { variant: 'primary' | 'secondary' }) {
  return (
    <div>
      {variant === 'primary' && <PrimaryContent />}
      {variant === 'secondary' && <SecondaryContent />}
    </div>
  );
}

// ✅ Test via Storybook stories
export const Primary = { args: { variant: 'primary' } };
export const Secondary = { args: { variant: 'secondary' } };
```

### When TO Separate Components

#### 🔄 Computed/Processed Values for Conditional Rendering
If you process props and use the computed result for conditional rendering:

```typescript
// ❌ Hard to test - computation logic is mixed with rendering
function BadComponent({ user, settings }: Props) {
  const isVipUser = user.level > 5 && settings.vipEnabled && user.subscriptionActive;
  
  return (
    <div>
      {isVipUser && <VipBadge />}
      {!isVipUser && <RegularBadge />}
    </div>
  );
}

// ✅ Better - separate computation and rendering
function computeUserStatus(user: User, settings: Settings): 'vip' | 'regular' {
  return user.level > 5 && settings.vipEnabled && user.subscriptionActive ? 'vip' : 'regular';
}

function UserBadge({ status }: { status: 'vip' | 'regular' }) {
  return (
    <div>
      {status === 'vip' && <VipBadge />}
      {status === 'regular' && <RegularBadge />}
    </div>
  );
}

function MyComponent({ user, settings }: Props) {
  const status = computeUserStatus(user, settings);
  return <UserBadge status={status} />;
}
```

#### 🧪 Testing Benefits
- **Computation function**: Unit test the `computeUserStatus` function
- **Rendering component**: Storybook stories for `UserBadge` with different `status` props
- **Integration**: Test the complete `MyComponent` behavior

### Common Anti-patterns

#### ❌ External State Dependencies
```typescript
// Bad: Cannot control `item.status` via props
{item.status === "active" && (
  <div className="status-indicator active">
    <Icon name="check" />
  </div>
)}
```

**Issue**: `item.status` comes from external state, not controllable via component props.

```typescript
// ✅ Solution: Create controllable component
function StatusIndicator({ status }: { status: 'active' | 'inactive' }) {
  if (status === 'active') {
    return (
      <div className="status-indicator active">
        <Icon name="check" />
      </div>
    );
  }
  return <div className="status-indicator inactive">...</div>;
}

// Usage: Now testable via props
<StatusIndicator status={item.status} />
```

#### ❌ Internal Hook State Dependencies
```typescript
// Bad: Cannot control `isLoading` via props
{isLoading && (
  <div className="loading-container">
    <Spinner />
    <span>Loading...</span>
  </div>
)}
```

**Issue**: `isLoading` is internal hook state, not controllable via props.

```typescript
// ✅ Solution: Extract to controllable component with internal visibility control
function LoadingState({ message, isVisible }: { message: string; isVisible: boolean }) {
  if (!isVisible) return null;
  
  return (
    <div className="loading-container">
      <Spinner />
      <span>{message}</span>
    </div>
  );
}

// Usage: Now testable via props, no external conditional rendering needed
<LoadingState message="Loading..." isVisible={isLoading} />
```

### Advanced Pattern: Internal Visibility Control

**Core Principle**: Instead of external conditional rendering (`{condition && <Component />}`), move the condition inside the component as an `isVisible` prop. This eliminates the need for hook mocking in tests.

### Advanced Pattern: Function Extraction for Complex Logic

**Core Principle**: When encountering complex conditional logic that depends on external state (hooks, props), extract the entire branching logic as a separate function rather than just the condition. This makes the complete logic testable without requiring hook mocking.

#### ❌ External Conditional Rendering (Hard to Test)
```typescript
// Parent component
{isStreaming && (
  <StreamingMessage text={streamingText} timestamp={getCurrentTime()} />
)}
{loading && !isStreaming && <LoadingMessage />}

// Testing requires mocking useTourismAgent hook
jest.mock('@/hooks/useTourismAgent');
mockUseTourismAgent.mockReturnValue({ isStreaming: true, loading: false, ... });
```

#### ✅ Internal Visibility Control (Easy to Test)
```typescript
// Parent component - always render, let component decide visibility
<StreamingMessage 
  text={streamingText} 
  timestamp={getCurrentTime()} 
  isVisible={isStreaming} 
/>
<LoadingMessage isVisible={loading && !isStreaming} />

// Testing is straightforward with props
render(<StreamingMessage text="test" timestamp="12:34" isVisible={true} />);
render(<StreamingMessage text="test" timestamp="12:34" isVisible={false} />);
```

#### Component Implementation Pattern
```typescript
interface ComponentProps {
  // ... other props
  isVisible: boolean;
}

export function Component({ isVisible, ...otherProps }: ComponentProps) {
  // Early return pattern for visibility control
  if (!isVisible) return null;
  
  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

#### Testing Benefits
1. **No Hook Mocking**: Test components directly with props
2. **Simple Test Cases**: `isVisible={true}` vs `isVisible={false}`
3. **Isolated Testing**: Each component can be tested independently
4. **Predictable Behavior**: Props completely control component state

#### ❌ Insufficient Approach: Only Extracting Conditions
```typescript
// Bad: Only extracting condition validation
export function shouldSendMessage(message: string): boolean {
  return message.trim().length > 0;
}

// The actual execution logic is still hard to test
const handleSendMessage = async () => {
  if (!shouldSendMessage(newMessage)) return; // ← This is testable
  
  // But this complex logic is still hard to test
  const userMessage = newMessage;
  setNewMessage("");
  try {
    if (useStreaming) {
      await sendStreamingMessage(userMessage);
    } else {
      await sendMessage(userMessage);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};
```

#### ✅ Better Approach: Extract Complete Logic
```typescript
// Extract the entire branching logic as a testable function
export async function sendUserMessage(
  message: string,
  useStreaming: boolean,
  sendStreamingMessage: (msg: string) => Promise<void>,
  sendMessage: (msg: string) => Promise<unknown>,
): Promise<{ success: boolean; error?: string }> {
  if (!message.trim()) {
    return { success: false, error: "Message is empty" };
  }

  try {
    if (useStreaming) {
      await sendStreamingMessage(message);
    } else {
      await sendMessage(message);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Component becomes simple and focused
const handleSendMessage = async () => {
  const userMessage = newMessage;
  setNewMessage("");

  const result = await sendUserMessage(
    userMessage,
    useStreaming,
    sendStreamingMessage,
    sendMessage,
  );

  if (!result.success && result.error) {
    console.error("Error:", result.error);
  }
};
```

#### Function Extraction Benefits
1. **Complete Logic Testing**: Test all branching scenarios independently
2. **No Hook Dependencies**: Pure functions that don't depend on React hooks
3. **Reusability**: Extracted functions can be used across components
4. **Clear Separation**: Business logic separated from UI concerns
5. **Easy Mocking**: Test with simple function parameters instead of complex hook states

#### When to Extract Functions
1. **Complex conditional logic with multiple branches**
2. **Logic that depends on external state (hooks, context)**
3. **Error handling within conditional flows**
4. **Async operations with branching logic**
5. **Business logic that could be reused elsewhere**

#### Function Extraction Guidelines
1. **Extract complete logic blocks**, not just conditions
2. **Return structured results** (e.g., `{ success: boolean; error?: string }`)
3. **Use camelCase naming** for extracted function files
4. **Place in same directory** as the component for related logic
5. **Accept dependencies as parameters** rather than importing them

### Decision Framework

Ask these questions when considering component separation:

1. **Can I control this behavior via props?**
   - ✅ Yes → Keep in same component, test via Storybook stories
   - ❌ No → Consider separation with internal visibility control

2. **Is there external conditional rendering (`{condition && <Component />}`)?**
   - ✅ Yes → Move condition inside component as `isVisible` prop
   - ❌ No → Keep current structure

3. **Is there complex conditional logic with external state dependencies?**
   - ✅ Yes → Extract entire logic block as separate function
   - ❌ No → Keep together

4. **Is there computation/processing before conditional rendering?**
   - ✅ Yes → Separate computation logic and create component that takes processed values
   - ❌ No → Keep together

4. **Can I write meaningful tests for this part in isolation?**
   - ✅ Yes → Good candidate for separation
   - ❌ No → Keep together

5. **Does this part have clear, single responsibility?**
   - ✅ Yes → Consider separation for better maintainability
   - ❌ No → Refactor logic first

### Benefits of Proper Separation

- **Testability**: Each part can be tested in isolation
- **Reusability**: Separated components can be reused elsewhere
- **Maintainability**: Clear responsibilities and boundaries
- **Storybook**: Better component documentation and visual testing

## Testing Guidelines

### When to Write Tests

**Core Rule**: Write tests for **ALL conditional logic** - every `if` statement, ternary operator, and branching logic must be tested.

#### 🧪 Logic Tests (Unit Tests)
For logic that cannot be controlled via props:

```typescript
// ❌ Hard to test - logic mixed with component
function UserCard({ user, settings }: Props) {
  const canEdit = user.role === 'admin' || (user.role === 'editor' && settings.editingEnabled);
  
  return (
    <div>
      {canEdit && <EditButton />}
      {/* other UI */}
    </div>
  );
}

// ✅ Extract logic for unit testing
export function canUserEdit(user: User, settings: Settings): boolean {
  return user.role === 'admin' || (user.role === 'editor' && settings.editingEnabled);
}

function UserCard({ user, settings }: Props) {
  const canEdit = canUserEdit(user, settings);
  return (
    <div>
      {canEdit && <EditButton />}
      {/* other UI */}
    </div>
  );
}

// Test the logic function
describe('canUserEdit', () => {
  it('should allow admin to edit', () => {
    expect(canUserEdit({ role: 'admin' }, { editingEnabled: false })).toBe(true);
  });
  
  it('should allow editor when editing is enabled', () => {
    expect(canUserEdit({ role: 'editor' }, { editingEnabled: true })).toBe(true);
  });
  
  it('should not allow editor when editing is disabled', () => {
    expect(canUserEdit({ role: 'editor' }, { editingEnabled: false })).toBe(false);
  });
});
```

#### 🎭 Component Tests
For conditional rendering controlled by props:

```typescript
function StatusBadge({ status, showIcon }: { status: 'success' | 'error'; showIcon: boolean }) {
  return (
    <div className={`badge badge-${status}`}>
      {showIcon && <Icon name={status === 'success' ? 'check' : 'x'} />}
      <span>{status}</span>
    </div>
  );
}

// Test all conditional branches via props
describe('StatusBadge', () => {
  it('should render success badge with icon', () => {
    render(<StatusBadge status="success" showIcon={true} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
  });
  
  it('should render error badge without icon', () => {
    render(<StatusBadge status="error" showIcon={false} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });
});
```

#### 📸 Snapshot Tests
Use for **accessibility and semantic testing** when future changes need to be monitored:

```typescript
// For components where HTML structure and accessibility matter
describe('NavigationMenu', () => {
  it('should maintain accessibility structure', () => {
    const { container } = render(<NavigationMenu items={mockItems} />);
    expect(container).toMatchSnapshot();
  });
  
  it('should preserve ARIA attributes for screen readers', () => {
    const { container } = render(<NavigationMenu items={mockItems} expanded={true} />);
    expect(container).toMatchSnapshot();
  });
});
```

### When NOT to Write Snapshot Tests
- ❌ For styling/visual changes (use visual regression tools instead)
- ❌ For dynamic content that changes frequently
- ❌ As a substitute for proper unit/component tests

### Test Structure Rules

#### Test Simplicity and Focus
**Core Rule**: Keep tests simple and focused on essential conditional logic only. Avoid over-testing and unnecessary complexity.

#### Arrange-Act-Assert Pattern
All tests must follow the **Arrange-Act-Assert** pattern with specific variable naming:

```typescript
// ✅ Correct test structure
describe('canUserEdit', () => {
  // Arrange: Common test data at describe level
  const adminUser = { role: 'admin', id: 1 };
  const editorUser = { role: 'editor', id: 2 };
  const defaultSettings = { editingEnabled: true };

  test('should allow admin to edit regardless of settings', () => {
    // Arrange (test-specific data)
    const disabledSettings = { editingEnabled: false };
    
    // Act
    const actual = canUserEdit(adminUser, disabledSettings);
    
    // Assert
    const expected = true;
    expect(actual).toBe(expected);
  });

  test('should allow editor when editing is enabled', () => {
    // Act
    const actual = canUserEdit(editorUser, defaultSettings);
    
    // Assert
    const expected = true;
    expect(actual).toBe(expected);
  });

  test('should deny editor when editing is disabled', () => {
    // Arrange
    const disabledSettings = { editingEnabled: false };
    
    // Act
    const actual = canUserEdit(editorUser, disabledSettings);
    
    // Assert
    const expected = false;
    expect(actual).toBe(expected);
  });
});
```

#### Test Organization Rules

1. **Single-level describe only** - No nested describe blocks
2. **Use `test()` for individual test cases** - Not `it()`
3. **One expect per test** - Each test should verify exactly one thing
4. **Common data at describe level** - Share setup data across tests
5. **Named variables**: Use `actual` for test results, `expected` for expected values
6. **Test only essential branches** - Focus on core conditional logic, avoid over-testing edge cases
7. **Remove unnecessary comments** - Don't include Act/Assert comments for simple tests

#### ❌ Anti-patterns

```typescript
// ❌ Wrong: Nested describes
describe('UserPermissions', () => {
  describe('canUserEdit', () => { // Don't nest!
    // tests...
  });
});

// ❌ Wrong: Multiple expects in one test
test('should handle user permissions', () => {
  expect(canUserEdit(admin, settings)).toBe(true); // Multiple expects
  expect(canUserEdit(editor, settings)).toBe(false); // in one test
});

// ❌ Wrong: Using it() instead of test()
it('should allow admin', () => { // Use test(), not it()
  // ...
});

// ❌ Wrong: Inline values without meaningful variable names
test('should allow admin', () => {
  expect(canUserEdit({ role: 'admin' }, { editing: true })).toBe(true);
  // Hard to understand what's being tested
});

// ❌ Wrong: Over-testing with too many similar test cases
test('should not call onStartChat when question is empty', () => {
  // Test for empty string
});
test('should not call onStartChat when question is whitespace only', () => {
  // Test for whitespace string - redundant if logic only checks trim()
});
test('should not call onStartChat when question is null', () => {
  // Often unnecessary if input validation handles this elsewhere
});

// ❌ Wrong: Testing multiple side effects
test('should call function and not call other function', () => {
  expect(mockFunctionA).toHaveBeenCalled();
  expect(mockFunctionB).not.toHaveBeenCalled(); // Should be separate test
});
```

#### ✅ Test Simplification Examples

**Focus on essential branches only:**

```typescript
// ✅ Correct: Test only the core branching logic
describe('createKeyDownHandler', () => {
  test('should call onStartChat when Enter key is pressed', () => {
    const handleKeyDown = createKeyDownHandler(mockOnStartChat);
    const enterKeyEvent = { key: "Enter" } as React.KeyboardEvent;
    
    handleKeyDown(enterKeyEvent);
    
    expect(mockOnStartChat).toHaveBeenCalledTimes(1);
  });

  test('should not call onStartChat when other keys are pressed', () => {
    const handleKeyDown = createKeyDownHandler(mockOnStartChat);
    const spaceKeyEvent = { key: " " } as React.KeyboardEvent;
    
    handleKeyDown(spaceKeyEvent);
    
    expect(mockOnStartChat).not.toHaveBeenCalled();
  });
});

// ✅ Correct: Test essential conditions only
describe('createHandleStartChat', () => {
  test('should call onStartChat when question has valid content', () => {
    const question = "浅草周辺を午後から回りたい";
    const handleStartChat = createHandleStartChat(question, mockOnStartChat);
    
    handleStartChat();
    
    expect(mockOnStartChat).toHaveBeenCalledWith(question);
  });

  test('should not call onStartChat when question is empty or whitespace', () => {
    const emptyQuestion = "";
    const handleStartChat = createHandleStartChat(emptyQuestion, mockOnStartChat);
    
    handleStartChat();
    
    expect(mockOnStartChat).not.toHaveBeenCalled();
  });
});
```

#### ✅ Handling Multiple Assertions

When you need to verify multiple related properties, use object comparison:

```typescript
// ✅ Correct: Single expect with object comparison
test('should return complete user status', () => {
  const user = { role: 'editor', level: 3 };
  const settings = { editingEnabled: true, maxLevel: 5 };
  
  const actual = getUserStatus(user, settings);
  
  const expected = {
    canEdit: true,
    canDelete: false,
    accessLevel: 'standard'
  };
  expect(actual).toEqual(expected);
});
```

#### Component Test Structure

```typescript
describe('StatusBadge', () => {
  // Arrange: Common props
  const defaultProps = {
    status: 'success' as const,
    showIcon: true,
  };

  test('should render success icon when showIcon is true', () => {
    // Act
    render(<StatusBadge {...defaultProps} />);
    const actual = screen.queryByRole('img');
    
    // Assert
    const expected = expect.anything(); // Icon should exist
    expect(actual).toEqual(expected);
  });

  test('should hide icon when showIcon is false', () => {
    // Arrange
    const props = { ...defaultProps, showIcon: false };
    
    // Act
    render(<StatusBadge {...props} />);
    const actual = screen.queryByRole('img');
    
    // Assert
    const expected = null;
    expect(actual).toBe(expected);
  });

  test('should display error styling for error status', () => {
    // Arrange
    const props = { ...defaultProps, status: 'error' as const };
    
    // Act
    render(<StatusBadge {...props} />);
    const actual = screen.getByText('error').className;
    
    // Assert
    const expected = expect.stringContaining('badge-error');
    expect(actual).toEqual(expected);
  });
});
```

## Storybook Guidelines

### When to Write Stories

**Core Rule**: Create new stories for **visual branching controlled by props**. If there's no visual difference or props can't control the branching, reconsider component separation.

### Story Configuration

#### Meta Object Configuration
**Basic Principle**: Keep meta configuration minimal. Only add `parameters`, `argTypes`, and `autoDocs` when specific requirements demand it.

```typescript
// ✅ Recommended: Simple meta configuration
const meta = {
  component: Button,
  args: { onClick: fn() }, // Add event handlers using fn()
} satisfies Meta<typeof Button>;

// ❌ Avoid: Unnecessary configuration
const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: { docs: { autodocs: true } }, // Usually not needed
  argTypes: { ... }, // Usually not needed
} satisfies Meta<typeof Button>;
```

#### Event Handler Configuration
For components with event handlers (onClick, onSubmit, etc.), use `fn()` function in the `args` property:

```typescript
import { fn } from 'storybook/test';

const meta = {
  component: Button,
  args: { 
    onClick: fn(), // Provides action logging in Storybook
  },
} satisfies Meta<typeof Button>;
```

#### ✅ Write Stories For: Props-Controlled Visual Variations

```typescript
// Component with visual variations via props
function Button({ variant, size, disabled, onClick }: ButtonProps) {
  return (
    <button 
      className={`btn btn-${variant} btn-${size} ${disabled ? 'disabled' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      Click me
    </button>
  );
}

// Stories for each visual variation
const meta = {
  component: Button,
  args: { onClick: fn() }, // Event handler with fn()
} satisfies Meta<typeof Button>;

export default meta;

export const Primary = { args: { variant: 'primary', size: 'medium' } };
export const Secondary = { args: { variant: 'secondary', size: 'medium' } };
export const Large = { args: { variant: 'primary', size: 'large' } };
export const Disabled = { args: { variant: 'primary', disabled: true } };
```

#### ✅ Single Story For: No Visual Variations

```typescript
// Component with no visual branching
function UserProfile({ name, email }: UserProfileProps) {
  return (
    <div className="profile">
      <h2>{name}</h2>
      <p>{email}</p>
    </div>
  );
}

// Only default story needed
export const Default = { 
  args: { name: 'John Doe', email: 'john@example.com' } 
};
```

#### ❌ Anti-pattern: Non-controllable Branching

```typescript
// Bad: Can't control `isLoading` via props
function UserCard({ user }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div>
      {isLoading ? <Spinner /> : <UserInfo user={user} />}
    </div>
  );
}

// ❌ Cannot create meaningful stories for loading state
// This indicates insufficient component separation
```

**Solution**: Extract the loading state to a controllable component:

```typescript
// ✅ Proper separation
function UserCardContent({ user, isLoading }: { user: User; isLoading: boolean }) {
  return (
    <div>
      {isLoading ? <Spinner /> : <UserInfo user={user} />}
    </div>
  );
}

// ✅ Now we can create stories for both states
export const Loading = { args: { user: mockUser, isLoading: true } };
export const Loaded = { args: { user: mockUser, isLoading: false } };
```

### Story Organization

- **One story per meaningful visual state**
- **Use descriptive names** that reflect the visual difference
- **Group related variations** using Storybook's hierarchical naming
- **Include edge cases** (empty states, long text, etc.)

### Avoid Non-Visual Stories

**Don't create stories for states that produce no visual output:**

```typescript
// ❌ Avoid: Hidden/invisible stories
export const Hidden = { args: { isVisible: false } }; // Shows nothing
export const EmptyState = { args: { items: [] } }; // Shows empty div

// ✅ Better: Use snapshot tests for non-visual logic
describe('Component', () => {
  it('should render nothing when not visible', () => {
    const { container } = render(<Component isVisible={false} />);
    expect(container).toMatchSnapshot();
  });
});
```

**Principle**: Storybook is for visual confirmation, not logic testing. If a story shows nothing or provides no visual value, test it with snapshot tests instead.

### Warning Signs

If you encounter these situations, it indicates component separation issues:

1. **Can't create stories for visual variations** → Extract controllable components
2. **Stories require mocking internal hooks** → Move logic to separate functions
3. **Multiple stories look identical** → Reconsider if variation is actually visual
4. **Need to test internal state** → Extract logic to testable functions
5. **Stories that show nothing** → Use snapshot tests instead of Storybook stories

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
