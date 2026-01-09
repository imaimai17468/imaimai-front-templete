# Architecture

Guidelines for directory structure, entity/gateway pattern, function extraction, and presenter pattern.

---

## Directory Structure

### Component Collocation

Functions used by a component are **placed as function files at the same level**. Do not create `utils/` or `helpers/` directories.

```
features/
  gradient-map/
    GradientMap.tsx              # Parent component
    calculateDistance.ts         # Function used by GradientMap
    createGeoJSON.ts             # Function used by GradientMap
    types.ts                     # Type definitions (re-export from entity)
    gradient-layer/              # Child component
      GradientLayer.tsx
    route-markers/               # Child component
      RouteMarkers.tsx
```

**Create directories ONLY when creating components**. Don't create directories for functions.

### Naming Conventions

- Directories: `kebab-case`
- Component files: `PascalCase`
- Function files: `camelCase`

### Parent-Child Hierarchy

Place child components in subdirectories under their parent component.

```
parent-component/
  ParentComponent.tsx
  child-component/
    ChildComponent.tsx
    grandchild-component/
      GrandchildComponent.tsx
```

---

## Entity/Gateway Pattern

### Entity Layer (`entities/`)

Type definitions and validation only. No fetching logic.

```typescript
// entities/user/schema.ts
import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
})

export type User = z.infer<typeof userSchema>
```

### Gateway Layer (`gateways/`)

External API calls and validation. Validate responses with entity schema before returning.

```typescript
// gateways/user.ts
import { userSchema, type User } from '@/entities/user/schema'

export async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`)
  if (!response.ok) throw new Error('Failed to fetch user')

  const json = await response.json()
  return userSchema.parse(json)  // Validate
}
```

### Server Component

Call gateway functions to fetch data. Don't write logic directly—use gateway functions.

```typescript
// app/users/[id]/page.tsx
async function UserPage({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id)  // Gateway function
  return <UserProfile user={user} />
}
```

---

## Function Extraction

Make functions controllable via arguments. Don't depend on global state or closures.

```typescript
// ❌ Depends on global state
function validateUser() {
  const user = getCurrentUser()  // Global state
  if (!user.email) return false
  return true
}

// ✅ Controlled via arguments
function validateUser(user: User): boolean {
  if (!user.email) return false
  return true
}
```

Place function files at the same level as the component.

```typescript
// features/user-profile/validateEmail.ts
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Use in features/user-profile/UserProfile.tsx
import { validateEmail } from './validateEmail'
```

### Action-Based Design Pattern

For complex conditional logic in useEffect/handlers, use action-based design: separate decision from execution.

```typescript
// Step 1: Define action types (Discriminated Union)
export type MoveEndAction =
  | { type: "ignore" }
  | { type: "saveBounds"; bounds: BoundsKey }
  | { type: "refresh"; bounds: BoundsKey };

// Step 2: Pure decision function
export function decideMoveEndAction(
  isInitialFetch: boolean,
  isLoading: boolean,
  currentBounds: BoundsKey,
  prevBounds: BoundsKey | null
): MoveEndAction {
  if (isInitialFetch) return { type: "ignore" };
  if (isLoading) return { type: "ignore" };
  if (!prevBounds) return { type: "saveBounds", bounds: currentBounds };
  if (!areBoundsEqual(prevBounds, currentBounds)) {
    return { type: "refresh", bounds: currentBounds };
  }
  return { type: "ignore" };
}

// Step 3: Pure execution function (Dependency Injection)
export function executeActionEffect(
  action: MoveEndAction,
  setPrevBounds: (bounds: BoundsKey) => void,
  setNeedsRefresh: (value: boolean) => void
): void {
  if (action.type === "saveBounds") {
    setPrevBounds(action.bounds);
  } else if (action.type === "refresh") {
    setPrevBounds(action.bounds);
    setNeedsRefresh(true);
  }
}

// Step 4: Use in component
useEffect(() => {
  const handleMoveEnd = () => {
    const current = getBounds();
    const action = decideMoveEndAction(isInitialFetch, isLoading, current, prevBounds);
    executeActionEffect(action, setPrevBounds, setNeedsRefresh);
  };

  map.on("moveend", handleMoveEnd);
  return () => map.off("moveend", handleMoveEnd);
}, [map, isInitialFetch, isLoading, prevBounds, setPrevBounds, setNeedsRefresh]);

// Now fully testable
test("returns ignore when initial fetch", () => {
  const action = decideMoveEndAction(true, false, mockBounds, null);
  expect(action).toEqual({ type: "ignore" });
});

test("calls both functions on refresh", () => {
  const setPrevBounds = vi.fn();
  const setNeedsRefresh = vi.fn();
  const action = { type: "refresh", bounds: mockBounds };

  executeActionEffect(action, setPrevBounds, setNeedsRefresh);

  expect(setPrevBounds).toHaveBeenCalledWith(mockBounds);
  expect(setNeedsRefresh).toHaveBeenCalledWith(true);
});
```

---

## Presenter Pattern

Consolidate conditional text in presenter.ts. Don't embed in JSX.

```typescript
// presenter.ts
export function getUserStatusText(status: string): string {
  switch (status) {
    case "active": return "Active"
    case "inactive": return "Inactive"
    case "pending": return "Pending"
    default: return "Unknown"
  }
}

export function getUserStatusColor(status: string): string {
  switch (status) {
    case "active": return "green"
    case "inactive": return "gray"
    case "pending": return "yellow"
    default: return "gray"
  }
}

// Use in component
import { getUserStatusText, getUserStatusColor } from './presenter'

function UserStatus({ status }: { status: string }) {
  return (
    <Badge color={getUserStatusColor(status)}>
      {getUserStatusText(status)}
    </Badge>
  )
}
```

---

## Anti-Patterns (Never Do This)

### Creating utils/ Directories

Don't create directories for functions. Place function files at the same level as components.

### Direct Data Fetching Without Gateway

Don't write fetch directly in Server Components. Go through gateway functions. Entity schema validation is important.
