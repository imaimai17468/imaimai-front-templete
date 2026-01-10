# useEffect Guidelines

Effects are an "escape hatch" from React's paradigm. Use them only for synchronizing with external systems. If no external system is involved, you probably don't need an Effect.

Sources:
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects)
- [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies)

---

## Core Principle

**Effects synchronize components with external systems**. This includes:
- Network (WebSocket, fetch with subscriptions)
- Browser DOM (manipulating DOM directly)
- Animations (third-party animation libraries)
- Widgets (third-party UI libraries)
- Other non-React code

**If there's no external system**, you don't need an Effect.

**Dependencies should always match your code**. Rather than modifying the dependency array to match preferences, adjust the code to align with what dependencies should logically be included.

**Critical Warning**: Never suppress the linter with `// eslint-disable-next-line react-hooks/exhaustive-deps`. This creates subtle, hard-to-debug issues. Instead, refactor code to properly reflect dependencies.

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

## Reactive vs Non-Reactive Logic

### Event Handlers (Non-Reactive)

**Event handlers** respond to specific user interactions and don't re-execute when reactive values change.

```typescript
function ChatRoom({ roomId }) {
  function handleSendClick() {
    sendMessage(message);  // Runs only when user clicks
  }

  return <button onClick={handleSendClick}>Send</button>
}
```

### Effects (Reactive)

**Effects** automatically run when dependencies change and maintain synchronization.

```typescript
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);  // Runs when roomId changes
}
```

---

## Strategies for Managing Dependencies

### 1. Move Event Logic to Event Handlers

Code responding to specific user actions shouldn't live in effects.

```typescript
// ❌ WRONG - Event logic in effect
function Form() {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) {
      post('/api/register');
      showNotification('Success!');
    }
  }, [submitted]);

  return <button onClick={() => setSubmitted(true)}>Submit</button>
}

// ✅ CORRECT - Event logic in handler
function Form() {
  function handleSubmit() {
    post('/api/register');
    showNotification('Success!');
  }

  return <button onClick={handleSubmit}>Submit</button>
}
```

### 2. Split Unrelated Synchronization Logic

Each effect should represent **one synchronization process**. Split multiple independent processes into separate effects.

```typescript
// ❌ WRONG - Multiple processes in one effect
useEffect(() => {
  fetch(`/api/cities?country=${country}`)
    .then(setCities);

  if (city) {
    fetch(`/api/areas?city=${city}`)
      .then(setAreas);
  }
}, [country, city]);

// ✅ CORRECT - Separate effects for separate processes
useEffect(() => {
  fetch(`/api/cities?country=${country}`)
    .then(setCities);
}, [country]);

useEffect(() => {
  if (city) {
    fetch(`/api/areas?city=${city}`)
      .then(setAreas);
  }
}, [city]);
```

### 3. Use Updater Functions for State

When calculating new state from previous state, use updater functions instead of reading state directly.

```typescript
// ❌ WRONG - Creates dependency on messages
function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    connection.on('message', (msg) => {
      setMessages([...messages, msg]);  // ❌ Depends on messages
    });
  }, [roomId, messages]);  // Re-connects on every message
}

// ✅ CORRECT - Updater function, no dependency
function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    connection.on('message', (msg) => {
      setMessages(msgs => [...msgs, msg]);  // ✅ No dependency
    });
  }, [roomId]);  // Only re-connects when roomId changes
}
```

### 4. Extract Non-Reactive Logic (useEffectEvent)

**Note**: `useEffectEvent` is an experimental API not yet available in stable React.

Use `useEffectEvent` to read latest values without creating dependencies. This separates reactive logic from non-reactive logic.

```typescript
import { useEffectEvent } from 'react';

// ❌ WRONG - theme causes unnecessary reconnection
function ChatRoom({ roomId, theme }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', () => {
      showNotification('Connected!', theme);  // ❌ Reads theme
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, theme]);  // Reconnects when theme changes!
}

// ✅ CORRECT - useEffectEvent for non-reactive logic
function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);  // Reads latest theme
  });

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', () => {
      onConnected();  // ✅ Non-reactive
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);  // Only roomId is reactive
}
```

#### Passing Arguments to Effect Events

Pass reactive values as parameters for clarity:

```typescript
const onVisit = useEffectEvent(visitedUrl => {
  logVisit(visitedUrl, numberOfItems);
});

useEffect(() => {
  onVisit(url);  // Explicitly shows url is the reactive trigger
}, [url]);
```

### 5. Avoid Objects and Functions as Dependencies

Objects and functions created during render are always "new," causing unnecessary effect re-execution.

#### Strategy A: Move Static Values Outside Component

```typescript
// ✅ Static values outside component
const options = {
  serverUrl: 'https://localhost:1234',
  roomId: 'music'
};

function ChatRoom() {
  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();
  }, []);  // No dependencies needed
}
```

#### Strategy B: Move Creation Inside Effect

```typescript
// ✅ Create inside effect
function ChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const options = { serverUrl, roomId };
    const connection = createConnection(options);
    connection.connect();
  }, [serverUrl, roomId]);  // Only primitives as dependencies
}
```

#### Strategy C: Extract Primitive Values

```typescript
// ❌ WRONG - Object dependency
function ChatRoom({ options }) {
  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();
  }, [options]);  // Re-runs every render
}

// ✅ CORRECT - Extract primitives
function ChatRoom({ options }) {
  const { roomId, serverUrl } = options;

  useEffect(() => {
    const connection = createConnection({ roomId, serverUrl });
    connection.connect();
  }, [roomId, serverUrl]);  // Only re-runs when these change
}
```

#### Strategy D: Calculate Inside Effect

```typescript
// ❌ WRONG - Function dependency
function ChatRoom({ getOptions }) {
  useEffect(() => {
    const options = getOptions();
    const connection = createConnection(options);
    connection.connect();
  }, [getOptions]);  // Re-runs every render
}

// ✅ CORRECT - Pass data, compute inside
function ChatRoom({ roomId, serverUrl }) {
  useEffect(() => {
    function getOptions() {
      return { roomId, serverUrl };
    }
    const options = getOptions();
    const connection = createConnection(options);
    connection.connect();
  }, [roomId, serverUrl]);
}
```

---

## Reactive Values

**Reactive values** include:
- Props
- State variables
- Variables declared inside the component body

```typescript
function ChatRoom({ roomId, serverUrl }) {  // Props (reactive)
  const [message, setMessage] = useState('');  // State (reactive)
  const options = { roomId, serverUrl };  // Computed (reactive)

  useEffect(() => {
    // All reactive values used here must be in dependencies
  }, [roomId, serverUrl, message]);
}
```

**Non-reactive values**:
- Variables defined outside component
- Values that don't change between renders

```typescript
const serverUrl = 'https://localhost:1234';  // Non-reactive

function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
  }, [roomId]);  // serverUrl not needed
}
```

---

## When You Can't Avoid Dependencies

### Problem: Reading Latest State Without Triggering Effect

**Scenario**: You want to read the latest value of a prop/state, but don't want the effect to re-run when it changes.

```typescript
// ❌ WRONG - Omitting dependency
function Page({ url }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    logVisit(url, items.length);  // Reads items.length
  }, [url]);  // ❌ Missing items dependency
}

// ✅ CORRECT - useEffectEvent (experimental)
function Page({ url }) {
  const [items, setItems] = useState([]);

  const onVisit = useEffectEvent(() => {
    logVisit(url, items.length);  // Reads latest items.length
  });

  useEffect(() => {
    onVisit();
  }, [url]);  // Only re-runs when url changes
}
```

### Alternative: Lift State Up or Use Context

If `useEffectEvent` isn't available, consider architectural changes:

```typescript
// ✅ Lift state up
function Parent() {
  const [items, setItems] = useState([]);

  return <Page url={url} itemsCount={items.length} />
}

function Page({ url, itemsCount }) {
  useEffect(() => {
    logVisit(url, itemsCount);
  }, [url, itemsCount]);
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

### Suppressing the Linter

```typescript
// ❌ NEVER DO THIS
useEffect(() => {
  doSomething(prop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Why it's bad**: Creates subtle bugs where the effect doesn't re-run when it should.

**Solution**: Refactor the code to properly reflect dependencies.

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

### Multiple Unrelated Processes in One Effect

```typescript
// ❌ WRONG
useEffect(() => {
  // Process 1: Subscribe to room
  const connection = createConnection(roomId);
  connection.connect();

  // Process 2: Track analytics
  logVisit(roomId);

  // Process 3: Update title
  document.title = `Room: ${roomId}`;

  return () => connection.disconnect();
}, [roomId]);

// ✅ CORRECT - Separate effects
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]);

useEffect(() => {
  logVisit(roomId);
}, [roomId]);

useEffect(() => {
  document.title = `Room: ${roomId}`;
}, [roomId]);
```

### Reading Props/State to Calculate Next State

```typescript
// ❌ WRONG
function Counter({ step }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(count + step);  // ❌ Stale closure
    }, 1000);
    return () => clearInterval(interval);
  }, [count, step]);  // Restarts interval on every count change
}

// ✅ CORRECT - Updater function
function Counter({ step }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => c + step);  // ✅ Always latest
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);  // Only restarts when step changes
}
```

---

## Summary

1. **Dependencies must match code** - don't modify the array, modify the code
2. **Move event logic to handlers** - effects are for synchronization, not user actions
3. **Split unrelated logic** - one effect per synchronization process
4. **Use updater functions** - avoid state dependencies when calculating next state
5. **Extract non-reactive logic** - use `useEffectEvent` (experimental)
6. **Avoid object/function dependencies** - extract primitives or move inside effect
7. **Never suppress the linter** - refactor code instead
