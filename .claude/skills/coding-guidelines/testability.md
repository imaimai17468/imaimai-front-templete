# Testability

Make all display states controllable via props. Extract conditional branches into pure functions. Avoid closure variable dependencies in useEffect and event handlers.

---

## Props Control for Testability

Make all display states controllable via props. Avoid conditional branches that depend on internal state.

```typescript
// ❌ Internal state with conditionals (untestable)
function UserProfile({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [user, setUser] = useState<User | null>(null)

  // To test loading=true, you must actually trigger the fetch
  if (loading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  if (!user) return <div>Not found</div>

  return <div>{user.name}</div>
}

// ✅ Props control (testable)
type UserProfileProps = {
  user: User | null
  isLoading?: boolean
  error?: Error | null
}

function UserProfile({ user, isLoading, error }: UserProfileProps) {
  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  if (!user) return <div>Not found</div>

  return <div>{user.name}</div>
}

// Easy to test
test('displays loading state', () => {
  render(<UserProfile user={null} isLoading={true} />)
  expect(screen.getByTestId('spinner')).toBeInTheDocument()
})

test('displays user name', () => {
  const user = { name: 'Taro', id: '1' }
  render(<UserProfile user={user} />)
  expect(screen.getByText('Taro')).toBeInTheDocument()
})
```

### Closure Variable Dependencies

**Critical**: Variables referenced inside useEffect or event handlers are "internal variables" that hinder testability, even if they come from props.

```typescript
// ❌ Closure depends on props (still untestable)
function LayerMarkers({ isInitialFetch, isLoading, prevBounds }: Props) {
  useEffect(() => {
    const handleMoveEnd = () => {
      // These are "internal variables" from the closure's perspective
      if (isInitialFetch) return;  // ❌ Closure variable
      if (isLoading) return;  // ❌ Closure variable

      const current = getBounds();
      if (!areBoundsEqual(prevBounds, current)) {  // ❌ Closure variable
        setNeedsRefresh(true);
      }
    };

    map.on("moveend", handleMoveEnd);
    return () => map.off("moveend", handleMoveEnd);
  }, [map, isInitialFetch, isLoading, prevBounds]);

  // Cannot test handleMoveEnd logic without triggering map events
}

// ✅ Extract to pure functions (testable)
function LayerMarkers({
  isInitialFetch,
  isLoading,
  prevBounds,
  setPrevBounds,
  setNeedsRefresh
}: Props) {
  useEffect(() => {
    const handleMoveEnd = () => {
      const current = getBounds();

      // Pure function - all inputs as arguments
      const action = decideMoveEndAction(
        isInitialFetch,
        isLoading,
        current,
        prevBounds
      );

      // Pure function with dependency injection
      executeActionEffect(action, setPrevBounds, setNeedsRefresh);
    };

    map.on("moveend", handleMoveEnd);
    return () => map.off("moveend", handleMoveEnd);
  }, [map, isInitialFetch, isLoading, prevBounds, setPrevBounds, setNeedsRefresh]);
}

// Now fully testable
test("returns ignore when initial fetch", () => {
  const action = decideMoveEndAction(true, false, mockBounds, null);
  expect(action).toEqual({ type: "ignore" });
});
```

---

## Conditional Branch Extraction

Extract conditional branches into separate components or pure functions. Don't cram multiple conditions into one component.

### JSX Conditionals → Components

```typescript
// ❌ Scattered conditionals
function Dashboard() {
  const { user, subscription, notifications } = useData()

  return (
    <div>
      {user ? (
        <div>
          <h1>{user.name}</h1>
          {subscription?.isPremium ? <PremiumBadge /> : <FreeBadge />}
        </div>
      ) : (
        <LoginPrompt />
      )}

      {notifications.length > 0 ? (
        <NotificationList items={notifications} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

// ✅ Extract conditionals into separate components
type UserSectionProps = {
  user: User | null
  subscription: Subscription | null
}

function UserSection({ user, subscription }: UserSectionProps) {
  if (!user) return <LoginPrompt />

  return (
    <div>
      <h1>{user.name}</h1>
      <SubscriptionBadge subscription={subscription} />
    </div>
  )
}

type SubscriptionBadgeProps = {
  subscription: Subscription | null
}

function SubscriptionBadge({ subscription }: SubscriptionBadgeProps) {
  if (subscription?.isPremium) return <PremiumBadge />
  return <FreeBadge />
}

type NotificationSectionProps = {
  notifications: Notification[]
}

function NotificationSection({ notifications }: NotificationSectionProps) {
  if (notifications.length === 0) return <EmptyState />
  return <NotificationList items={notifications} />
}
```

### useEffect/Handler Conditionals → Pure Functions

Extract **all** conditional logic from useEffect and event handlers into pure functions.

```typescript
// ❌ Conditionals inside closure
useEffect(() => {
  const handleChange = () => {
    if (isLoading) return;  // ❌ Cannot test
    if (!hasData) return;  // ❌ Cannot test

    const result = process(data);
    setResult(result);
  };

  subscribe(handleChange);
}, [isLoading, hasData, data]);

// ✅ Extract to pure function
export function shouldProcess(
  isLoading: boolean,
  hasData: boolean
): boolean {
  if (isLoading) return false;
  if (!hasData) return false;
  return true;
}

useEffect(() => {
  const handleChange = () => {
    if (shouldProcess(isLoading, hasData)) {
      const result = process(data);
      setResult(result);
    }
  };

  subscribe(handleChange);
}, [isLoading, hasData, data]);

// Now testable
test("returns false when loading", () => {
  expect(shouldProcess(true, true)).toBe(false);
});
```

---

## Anti-Patterns (Never Do This)

### Internal State with Conditionals

Using `useState` + conditionals inside components makes testing difficult. Control everything via props.

### Misidentifying Internal Variables

**Mistake**: "This variable comes from props, so it's not an internal variable"

**Reality**: Variables referenced inside useEffect or event handlers are internal variables from the closure's perspective, even if they come from props.

```typescript
// ❌ WRONG - Still untestable
function Component({ isLoading, data }: Props) {
  useEffect(() => {
    const handler = () => {
      if (isLoading) return;  // ❌ Closure dependency
      processData(data);  // ❌ Closure dependency
    };

    subscribe(handler);
  }, [isLoading, data]);
}

// ✅ CORRECT - Extract to pure function
function Component({ isLoading, data, setResult }: Props) {
  useEffect(() => {
    const handler = () => {
      const action = decideAction(isLoading, data);
      executeAction(action, setResult);
    };

    subscribe(handler);
  }, [isLoading, data, setResult]);
}
```

### Thinking "This Guard Clause is Necessary"

**Mistake**: "This if statement is necessary for the logic, so I can't extract it"

**Reality**: Every conditional can be extracted. Guard clauses become return values in pure functions.

```typescript
// ❌ WRONG - "I need these guards here!"
useEffect(() => {
  if (!isReady) return;
  if (isLoading) return;

  const result = calculate(data);
  setResult(result);
}, [isReady, isLoading, data]);

// ✅ CORRECT - Guards become decision logic
export function shouldCalculate(
  isReady: boolean,
  isLoading: boolean
): boolean {
  if (!isReady) return false;
  if (isLoading) return false;
  return true;
}

useEffect(() => {
  if (shouldCalculate(isReady, isLoading)) {
    const result = calculate(data);
    setResult(result);
  }
}, [isReady, isLoading, data]);
```

### Unnecessary useEffect

**Mistake**: "I need to sync this state, so useEffect is required"

**Reality**: Follow React's principle: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect). Most state synchronization can be avoided.

```typescript
// ❌ WRONG - Unnecessary useEffect
const [bounds, setBounds] = useState(null);
const [prevBounds, setPrevBounds] = useState(null);

useEffect(() => {
  if (bounds && !prevBounds) {
    setPrevBounds(bounds);
  }
}, [bounds, prevBounds]);

// ✅ CORRECT - Handle in decision function
export function decideBoundsAction(
  current: Bounds,
  prev: Bounds | null
): BoundsAction {
  if (!prev) return { type: "initialize", bounds: current };
  // Initialization is handled when needed
}
```

**When useEffect IS needed**: Only for external system synchronization (event listeners, subscriptions, browser APIs).

### Missing Closure Dependencies

**Mistake**: Not recognizing every variable used inside a closure as a dependency.

**Detection**: Read through every line inside useEffect/handler. Mark every variable that's not:
- A constant
- A function parameter
- Defined inside the closure itself

```typescript
// Mark every external variable
useEffect(() => {
  const handler = () => {
    if (isLoading) return;  // ❌ Mark: isLoading
    const current = getBounds();  // getBounds is fine (defined here)
    if (prevBounds) {  // ❌ Mark: prevBounds
      const equal = areBoundsEqual(current, prevBounds);  // ❌ Mark: prevBounds
      if (!equal) {
        setNeedsRefresh(true);  // ❌ Mark: setNeedsRefresh
      }
    }
  };

  // All marked variables must be:
  // - Listed in dependency array
  // - Passed as arguments to extracted function
}, [isLoading, prevBounds, setNeedsRefresh]);
```
