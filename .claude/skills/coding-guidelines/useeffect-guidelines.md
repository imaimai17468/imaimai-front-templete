# useEffect Guidelines

Effects are an "escape hatch" from React's paradigm. Use them only for synchronizing with external systems. If no external system is involved, you probably don't need an Effect.

Source: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

## Core Principle

**Effects synchronize components with external systems**. This includes:
- Network (WebSocket, fetch with subscriptions)
- Browser DOM (manipulating DOM directly)
- Animations (third-party animation libraries)
- Widgets (third-party UI libraries)
- Other non-React code

**If there's no external system**, you don't need an Effect.

---

## When You DON'T Need useEffect

### Transforming Data for Rendering

**❌ Don't**: Use Effect to transform data

```typescript
function TodoList({ todos, filter }) {
  const [filteredTodos, setFilteredTodos] = useState([]);

  useEffect(() => {
    setFilteredTodos(getFilteredTodos(todos, filter));
  }, [todos, filter]);

  return <ul>{filteredTodos.map(...)}</ul>
}
```

**✅ Do**: Calculate during render

```typescript
function TodoList({ todos, filter }) {
  const filteredTodos = getFilteredTodos(todos, filter);
  return <ul>{filteredTodos.map(...)}</ul>
}
```

React automatically recalculates when dependencies change.

### Expensive Calculations

**❌ Don't**: Use Effect for caching

```typescript
function TodoList({ todos, filter }) {
  const [filteredTodos, setFilteredTodos] = useState([]);

  useEffect(() => {
    setFilteredTodos(getFilteredTodos(todos, filter));
  }, [todos, filter]);
}
```

**✅ Do**: Use `useMemo` for expensive computations

```typescript
function TodoList({ todos, filter }) {
  const filteredTodos = useMemo(
    () => getFilteredTodos(todos, filter),
    [todos, filter]
  );
  return <ul>{filteredTodos.map(...)}</ul>
}
```

`useMemo` caches the result and only recalculates when dependencies change.

### Resetting State on Prop Changes

**❌ Don't**: Use Effect to reset state

```typescript
function ProfilePage({ userId }) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    setComment('');
  }, [userId]);
}
```

**✅ Do**: Use `key` to reset component

```typescript
// Parent component
<ProfilePage userId={userId} key={userId} />

// ProfilePage component - state automatically resets
function ProfilePage({ userId }) {
  const [comment, setComment] = useState('');
  // State automatically resets when key changes
}
```

React resets all state when `key` changes.

### Updating State Based on Props or State

**❌ Don't**: Use Effect to derive state

```typescript
function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);
}
```

**✅ Do**: Calculate during render

```typescript
function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const fullName = firstName + ' ' + lastName;  // Derived value
}
```

---

## When You DO Need useEffect

### External System Synchronization

**✅ Event Listeners**

```typescript
useEffect(() => {
  const handleMove = (e) => setPosition({ x: e.clientX, y: e.clientY });

  window.addEventListener('pointermove', handleMove);
  return () => window.removeEventListener('pointermove', handleMove);
}, []);
```

**✅ Subscriptions**

```typescript
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();

  return () => connection.disconnect();
}, [serverUrl, roomId]);
```

**✅ Browser APIs**

```typescript
useEffect(() => {
  const observer = new IntersectionObserver(handleIntersection);
  observer.observe(elementRef.current);

  return () => observer.disconnect();
}, []);
```

---

## Event Handlers vs Effects

**Decision Framework**: *Why* should this code run?

### Event Handlers

**When**: User did something specific (click, type, submit)

```typescript
function Form() {
  const [formData, setFormData] = useState({});

  // ✅ Event handler - runs because user clicked submit
  function handleSubmit() {
    sendToAnalytics(formData);
    submitForm(formData);
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### Effects

**When**: Component displayed or specific value changed

```typescript
function Form() {
  const [formData, setFormData] = useState({});

  // ✅ Effect - runs because component displayed
  useEffect(() => {
    logFormView();
  }, []);

  // ✅ Effect - runs because formData changed
  useEffect(() => {
    saveFormDraft(formData);
  }, [formData]);
}
```

---

## Data Fetching

### Race Conditions

**❌ Don't**: Fetch without cleanup

```typescript
useEffect(() => {
  fetchData(id).then(data => setData(data));
}, [id]);
```

**✅ Do**: Add ignore flag for cleanup

```typescript
useEffect(() => {
  let ignore = false;

  fetchData(id).then(data => {
    if (!ignore) {
      setData(data);
    }
  });

  return () => { ignore = true; };
}, [id]);
```

### Better: Custom Hook

```typescript
// Custom hook
function useData(id) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let ignore = false;

    fetchData(id).then(result => {
      if (!ignore) setData(result);
    });

    return () => { ignore = true; };
  }, [id]);

  return data;
}

// Component
function Profile({ id }) {
  const data = useData(id);
  return <div>{data?.name}</div>
}
```

### Best: Server Components

For Next.js, prefer Server Components over client-side useEffect fetching:

```typescript
// ✅ Server Component (no useEffect needed)
async function ProfilePage({ params }) {
  const user = await fetchUser(params.id);
  return <Profile user={user} />
}
```

---

## Lifting State Up

**❌ Don't**: Use Effects to sync state between components

```typescript
function Parent() {
  return (
    <>
      <ComponentA />  {/* Has count state */}
      <ComponentB />  {/* Tries to sync with ComponentA via Effect */}
    </>
  )
}
```

**✅ Do**: Lift state to common parent

```typescript
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <>
      <ComponentA count={count} setCount={setCount} />
      <ComponentB count={count} />
    </>
  )
}
```

---

## Anti-Patterns (Never Do This)

### Redundant State

Don't store values calculable from existing props/state.

```typescript
// ❌ WRONG
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(firstName + ' ' + lastName);
}, [firstName, lastName]);

// ✅ CORRECT
const fullName = firstName + ' ' + lastName;
```

### Chains of Effects

Don't create dependency chains between Effects.

```typescript
// ❌ WRONG - Chain of Effects
useEffect(() => {
  setX(computeX(a));
}, [a]);

useEffect(() => {
  setY(computeY(x));
}, [x]);

useEffect(() => {
  setZ(computeZ(y));
}, [y]);

// ✅ CORRECT - Compute during render or in single Effect
const x = computeX(a);
const y = computeY(x);
const z = computeZ(y);
```

### Initializing Application

Don't use Effects for one-time initialization that should survive re-renders.

```typescript
// ❌ WRONG - Runs twice in development (Strict Mode)
useEffect(() => {
  initializeApp();
}, []);

// ✅ CORRECT - Run once at module level
if (typeof window !== 'undefined') {
  initializeApp();
}

// Or wrap in a check
let initialized = false;
useEffect(() => {
  if (!initialized) {
    initializeApp();
    initialized = true;
  }
}, []);
```

### Sending Analytics on Mount

Place page view tracking outside Effects when possible.

```typescript
// ❌ WRONG - Runs twice in Strict Mode
useEffect(() => {
  logPageView();
}, []);

// ✅ CORRECT - Use framework's router events
// In Next.js App Router, use layout.tsx or middleware
```

### Event Handler Logic in Effects

Keep user interaction logic in event handlers, not Effects.

```typescript
// ❌ WRONG
function Form() {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) {
      sendAnalytics();
    }
  }, [submitted]);
}

// ✅ CORRECT
function Form() {
  function handleSubmit() {
    sendAnalytics();
  }
}
```
