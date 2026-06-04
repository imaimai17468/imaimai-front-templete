# React Patterns

## Prop Getters Pattern

Do not return event handlers and attributes from custom hooks as individual `onX` / `ref` values. Instead, return a **function that produces props** (`getXxxProps`). Two benefits:

1. **Intent is clear from the name** — Including the target in the function name (`getInputProps`, `getModalProps`, etc.) makes it obvious what to spread the result onto.
2. **Default and custom handlers compose** — With a plain Prop Collection (an object of props), spreading a handler with the same key overwrites the default. Prop Getters compose handlers internally, preserving default behavior while allowing customization.

```tsx
// NG — unclear what these are for; overwrite risk when adding custom handlers
const { onInput, onCompositionStart, onCompositionEnd } = useSuggest();

// OK — clearly for an input element; custom handlers compose with defaults
const { getInputProps } = useSuggest();

<input {...getInputProps()} />
<input {...getInputProps({ onChange: customHandler })} />
```

On the implementation side, the getter returns a composed function that runs both the user-provided handler and the default handler.

```tsx
const getInputProps = (overrides: Partial<InputProps> = {}) => {
  const { onChange, ...rest } = overrides;
  return {
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      defaultOnChange(e);
      onChange?.(e);
    },
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    ...rest,
  };
};
```

## Group by Concern, Not by Kind

Do not arrange a hook's internals or return values as "all state first, then all functions." This is **logical cohesion** in cohesion terminology — items of the same kind grouped together, but with no meaningful relationship between them.

Instead, group state, refs, and callbacks **by use case (concern)** to achieve **functional cohesion** — a single capability with all its required pieces co-located. React Hooks achieve functional cohesion in `useEffect` by grouping side effects by concern rather than lifecycle phase. The same principle applies to state and callback placement inside hooks.

```tsx
// NG — logical cohesion (state alone tells you nothing about usage)
const [query, setQuery] = useState("");
const [shouldShowDropdown, setShouldShowDropdown] = useState(false);
const composingRef = useRef(false);

const handleInput = () => { /* uses query, composingRef */ };
const handleToggle = () => { /* uses shouldShowDropdown */ };

// OK — functional cohesion (each block's state and callbacks are self-contained)

// --- suggest query ---
const [query, setQuery] = useState("");
const composingRef = useRef(false);
const handleInput = () => { /* uses query, composingRef */ };

// --- dropdown ---
const [shouldShowDropdown, setShouldShowDropdown] = useState(false);
const handleToggle = () => { /* uses shouldShowDropdown */ };
```

When concerns are sufficiently independent, extract each block into its own custom hook.

## Distinguish Reactive State from Procedural Getters

React library features fall into two categories based on **what triggers execution**. The deciding question is: "Does this code run because the component rendered, or because the user performed an action?"

- **Reactive state features**: Watch for value changes and automatically trigger re-renders. Used to declaratively sync the UI.
  - `useState`, `useSWR`, `useQuery`, `useRecoilValue`, React Hook Form's `watch()` / `useWatch()`
- **Procedural getter features**: Return the current value on demand without triggering re-renders. Used inside event handlers when you need "the value right now."
  - `useRef`'s `.current`, React Hook Form's `getValues()`, `useSWRMutation`, `useMutation`, `useRecoilCallback`

Do not pick features by shortcut ("it's a GET request, so `useSWR`"). Choose by trigger. For example, fetching a zip code on button press calls for `useSWRMutation` (procedural); auto-fetching on page load calls for `useSWR` (reactive).

When exposing a ref from a custom hook, reflect this distinction in the interface. Returning the ref object directly makes it ambiguous whether it's reactive or procedural. Return a **getter function** instead so the procedural nature is explicit.

```tsx
// NG — returning refs directly (ambiguous whether reactive or procedural)
return { composingRef, currentInputValueRef };

// OK — returning getter functions (clearly procedural)
return {
  getIsComposing: () => composingRef.current,
  getCurrentInputValue: () => inputValueRef.current,
};
```

## Push State Down

Place state **as close to where it's used as possible**. If state was lifted into a parent but only one child actually uses it, push it back down.

Component splitting is not just for reuse — it's for **organizing your thinking into parts**. Confining state to a child means the parent doesn't need to know about the child's transient state, simplifying the state-update dependency graph.

Problems caused by unnecessary lifting:

- **More navigation hops**: Definition and usage are far apart, requiring jumps across files to understand the whole picture.
- **Wider re-render scope**: High-frequency state (e.g., input fields) in a parent re-renders sibling components unnecessarily. Pushing down avoids this without `React.memo()`.
- **Bloated responsibility**: The parent manages transient state (e.g., in-progress text) it has no reason to know about.

Decision criteria:

| Criterion | Push down | Keep in parent |
|-----------|-----------|---------------|
| Persistence | Transient (in-progress text, etc.) | Persistent (list items, etc.) |
| Update frequency | High (every keystroke, etc.) | Low |
| Scope of reference | Only this component | Siblings or parent also reference it |
| Impact on other components | None | Yes |

### Push down into Leaf Containers, not just hooks

Extracting concern-grouped hooks at the root Container is an intermediate step, **not the goal**. If the extracted hook's state is consumed by only one child, the hook should move into that child's own Container (see architecture.md "Prefer Leaf Containers Over Root Hook Extraction"). Hooks at the root are correct only for state that multiple siblings genuinely share.

## Boolean Flag Naming

Name boolean identifiers by **purpose (what the flag is for)**, not by **state (what condition is true)**. This applies to all booleans: `useState` flags, props, hook options, and return values.

State-based names (`isAuthenticated`, `isSubmitted`, `isActive`) describe the current condition but force the reader to infer why it matters: "What happens when this is true? What does the consumer do with it?" Purpose-based names convey usage directly.

```tsx
// NG — named by state; reader must trace what the consumer does with it
const [isSubmitted, setIsSubmitted] = useState(false);
isAuthenticated: boolean;  // option: what is this used for?

// OK — named by purpose
const [shouldPreventCommit, setShouldPreventCommit] = useState(false);
canSavePreset: boolean;    // option: clearly gates preset saving
```

## JSDoc for Hook Return Functions

Follow these principles for JSDoc on functions returned from hooks:

1. **Lead with what it does** — Describe the external behavior first. Do not lead with internal details (debounce timers, flag manipulation, etc.).
2. **State call timing in a separate sentence** — "Does X when Y" is ambiguous about which is primary. Write "Does X. Call when Y." as two sentences, making the action primary and timing secondary.
3. **Push internal details to the end** — Put externally relevant behavior first; implementation details go in parentheses or at the end.

```tsx
// NG — internal implementation as subject / action and condition mixed / details up front
/** Resets the debounce timer for suggestions and clears the keyword */
clearSuggestionKeyword: () => void;
/** Gets the input value; returns empty string during composition */
getCurrentInputValue: () => string;
/** Sets the isSubmitted flag to prevent commit */
notifySubmitted: () => void;

// OK — external behavior as subject / timing in separate sentence / details at end
/** Clears the suggestion keyword (also resets the internal debounce timer). */
clearSuggestionKeyword: () => void;
/** Returns the current input value. Returns empty string during composition. */
getCurrentInputValue: () => string;
/** Call on form submission. Prevents commits while submitting. */
notifySubmitted: () => void;
```

## Correct Mental Model for useEffect

The default behavior of useEffect is **"run after every render."** The dependency array is not a trigger ("run when this changes") but a **skip filter** ("skip if this hasn't changed").

```tsx
// No dependency array → runs after every render
useEffect(() => {
  document.title = `You clicked ${count} times`;
});

// Dependency array → skips if count hasn't changed
useEffect(() => {
  document.title = `You clicked ${count} times`;
}, [count]);

// Empty array → no dependencies to change, so always skips → runs only on mount
useEffect(() => {
  initialize();
}, []);
```

Do not use useEffect with the mental model of "mount-time processing." The essence of useEffect is "synchronizing render results with an external system." Using an empty array for initialization should be extremely rare.

Additionally, useEffect **cannot detect changes outside of re-renders**. Changes inside a ref's `.current` or DOM element resizing are not detected — use event listeners or `ResizeObserver` instead.

## useState Initial Value Is Applied Only Once

`useState(initialValue)` uses `initialValue` **only on the first render**. State does not auto-update when props change.

```tsx
// NG — textValue does not follow changes to initialTextValue
const SomeComponent = ({ initialTextValue }: { initialTextValue: string }) => {
  const [textValue, setTextValue] = useState(initialTextValue);
  return <input value={textValue} onChange={e => setTextValue(e.target.value)} />;
};

// OK — use key to reset the component and re-apply the initial value
<SomeComponent key={initialTextValue} initialTextValue={initialTextValue} />
```

## useMemo Is "Skip Recomputation," Not "Change Detection"

Ordinary expressions are recomputed on every render. That is the baseline. `useMemo` is an optimization that **skips expensive computations** — nothing more.

Do not use `useMemo` or `useEffect` with a "when A changes, auto-update B" two-way-binding mindset. In most cases, a plain expression in the render function is sufficient.

```tsx
// NG — using useMemo as "change detection"
const fullName = useMemo(() => surname + " " + personalName, [surname, personalName]);

// OK — plain expression is sufficient (recomputed each render, which is fine)
const fullName = surname + " " + personalName;
```

## Do Not Fetch Inside useEffect

Do not fetch directly inside useEffect. Since React 18, prefer Suspense or data-fetching libraries (SWR, TanStack Query, etc.).

If you must fetch inside useEffect, use a **declarative approach** — "fetch because state is loading" — not a procedural one — "fetch once on mount." The fetch doesn't cause the state change; the "loading" state is what causes the fetch.

```tsx
// NG — procedural "fetch once on mount" thinking
useEffect(() => {
  fetch("/api/data").then(res => res.json()).then(setData);
}, []);

// OK — loading state is the trigger for fetch
const [state, setState] = useState<FetchState<Data>>({ state: "loading" });

useEffect(() => {
  if (state.state !== "loading") return;

  const controller = new AbortController();
  fetch("/api/data", { signal: controller.signal })
    .then(res => res.json())
    .then(data => setState({ state: "fulfilled", data }))
    .catch(error => setState({ state: "rejected", error }));

  return () => controller.abort();
}, [state]);
// To refetch, just call setState({ state: "loading" })
```

## State Structure Principles

Five rules for structuring state. The goal: make state easy to update without introducing bugs.

### Group Related State

If two state variables always update together, merge them.

```tsx
// NG — always updated as a pair but stored separately
const [x, setX] = useState(0);
const [y, setY] = useState(0);

// OK
const [position, setPosition] = useState({ x: 0, y: 0 });
```

### Avoid Contradictions

Do not use multiple booleans that can form impossible combinations. Use a single discriminated status instead.

```tsx
// NG — isSending && isSent can both be true
const [isSending, setIsSending] = useState(false);
const [isSent, setIsSent] = useState(false);

// OK — only one status at a time
const [status, setStatus] = useState<"typing" | "sending" | "sent">("typing");
const isSending = status === "sending";
const isSent = status === "sent";
```

### Avoid Redundant State

Do not store a value in state if it can be computed from existing state or props during render.

```tsx
// NG — fullName is derivable and must be manually synced
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [fullName, setFullName] = useState("");

// OK — computed every render, always in sync
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const fullName = firstName + " " + lastName;
```

### Avoid Duplication

Store identifiers, not copies of objects that already live in another state variable.

```tsx
// NG — selectedItem is a copy; editing items leaves it stale
const [items, setItems] = useState(initialItems);
const [selectedItem, setSelectedItem] = useState(items[0]);

// OK — derive the selected object from the id
const [items, setItems] = useState(initialItems);
const [selectedId, setSelectedId] = useState(items[0].id);
const selectedItem = items.find((item) => item.id === selectedId) ?? null;
```

### Avoid Deeply Nested State

Flatten tree structures. Deeply nested state requires copying entire parent chains for a single update.

```tsx
// NG — tree shape: updating a leaf copies every ancestor
const [plan, setPlan] = useState({
  id: 0, title: "Root",
  childPlaces: [{ id: 1, title: "Earth", childPlaces: [/* … */] }],
});

// OK — normalized: each entity keyed by id, children stored as id arrays
const [plan, setPlan] = useState<Record<number, { id: number; title: string; childIds: number[] }>>({
  0: { id: 0, title: "Root", childIds: [1, 42] },
  1: { id: 1, title: "Earth", childIds: [2, 10] },
});
```

## When to Use useReducer

Prefer `useReducer` over many `useState` calls when:

- Multiple event handlers modify the same state in similar ways
- State updates involve interdependent fields (updating one requires updating another)
- You want to log / debug every state transition in one place
- The component has ≥ 5 `useState` calls that could be grouped

Stick with `useState` when state is simple, independent, and updated by one or two handlers.

| Aspect       | useState                   | useReducer                              |
| ------------ | -------------------------- | --------------------------------------- |
| Code size    | Less upfront               | More boilerplate, but consolidates many handlers |
| Readability  | Easy for simple state      | Cleanly separates "what happened" from "how state updates" |
| Debugging    | Hard to trace updates      | Single place to log every action        |
| Testing      | Requires component context | Reducer is a pure function — test in isolation |

### Migration pattern

1. Replace `setState` calls with `dispatch({ type: "event_name", ... })` — describe what the user did, not what to set.
2. Write a reducer function: `(state, action) => nextState`. Must be pure — no side effects.
3. Replace `useState` with `useReducer(reducer, initialState)`.

```tsx
// NG — scattered state updates
const [tasks, setTasks] = useState(initialTasks);
const handleAdd = (text: string) => setTasks([...tasks, { id: nextId(), text, done: false }]);
const handleToggle = (id: string) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
const handleDelete = (id: string) => setTasks(tasks.filter((t) => t.id !== id));

// OK — centralized in a reducer
type TaskAction =
  | { type: "added"; text: string }
  | { type: "toggled"; id: string }
  | { type: "deleted"; id: string };

const tasksReducer = (tasks: Task[], action: TaskAction): Task[] => {
  switch (action.type) {
    case "added":
      return [...tasks, { id: nextId(), text: action.text, done: false }];
    case "toggled":
      return tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case "deleted":
      return tasks.filter((t) => t.id !== action.id);
  }
};

const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);
```

Each action describes **one user interaction**. Do not create generic `set_field` actions.

## You Might Not Need an Effect

Most `useEffect` calls that set state are unnecessary. The sections below supplement "Do Not Fetch Inside useEffect" and "Correct Mental Model for useEffect" above.

### Compute during render instead of syncing with useEffect

```tsx
// NG — extra render pass to sync derived value
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
useEffect(() => {
  setFilteredItems(items.filter((i) => i.active));
}, [items]);

// OK — compute inline (use useMemo only when the computation is expensive)
const filteredItems = items.filter((i) => i.active);
```

### Reset state with `key` instead of useEffect

```tsx
// NG — manually clearing state on prop change
const ProfilePage = ({ userId }: { userId: string }) => {
  const [comment, setComment] = useState("");
  useEffect(() => { setComment(""); }, [userId]);
  return <CommentInput value={comment} onChange={setComment} />;
};

// OK — key forces React to remount with fresh state
const ProfilePage = ({ userId }: { userId: string }) => (
  <Profile userId={userId} key={userId} />
);
```

### Put event-specific logic in the event handler, not in an Effect

The decision rule: does this code run **because the component was displayed**, or **because the user did something**? Display → Effect. User action → event handler.

```tsx
// NG — notification fires on mount if product is already in cart
useEffect(() => {
  if (product.isInCart) {
    showNotification(`Added ${product.name} to cart`);
  }
}, [product]);

// OK — notification fires only when the user clicks
const handleBuy = () => {
  addToCart(product);
  showNotification(`Added ${product.name} to cart`);
};
```

### Avoid Effect chains

Multiple Effects that set state in sequence cause cascading re-renders.

```tsx
// NG — chain: card → goldCardCount → round → isGameOver (4 renders)
useEffect(() => { if (card?.gold) setGoldCardCount((c) => c + 1); }, [card]);
useEffect(() => { if (goldCardCount > 3) { setRound((r) => r + 1); setGoldCardCount(0); } }, [goldCardCount]);
useEffect(() => { if (round > 5) setIsGameOver(true); }, [round]);

// OK — compute and update in a single handler (1 render)
const isGameOver = round > 5;
const handlePlaceCard = (nextCard: Card) => {
  setCard(nextCard);
  if (nextCard.gold) {
    if (goldCardCount < 3) { setGoldCardCount(goldCardCount + 1); }
    else { setGoldCardCount(0); setRound(round + 1); }
  }
};
```

### Notify parents from the handler, not from an Effect

```tsx
// NG — cascading render: child sets state → renders → Effect notifies parent → parent renders
const [isOn, setIsOn] = useState(false);
useEffect(() => { onChange(isOn); }, [isOn, onChange]);

// OK — both updates batched in one event
const handleToggle = () => {
  const next = !isOn;
  setIsOn(next);
  onChange(next);
};
```

### Subscribe to external stores with useSyncExternalStore

```tsx
// NG — manual subscription in useEffect
const [isOnline, setIsOnline] = useState(true);
useEffect(() => {
  const update = () => setIsOnline(navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
}, []);

// OK — purpose-built API
const isOnline = useSyncExternalStore(
  (cb) => {
    window.addEventListener("online", cb);
    window.addEventListener("offline", cb);
    return () => {
      window.removeEventListener("online", cb);
      window.removeEventListener("offline", cb);
    };
  },
  () => navigator.onLine,
  () => true,
);
```

## Controlled vs Uncontrolled Components

A **controlled** component's behavior is fully determined by props. An **uncontrolled** component manages its own internal state. When multiple components must stay in sync, lift state up to their closest common parent and make the children controlled.

```tsx
// Uncontrolled — owns its state; parent cannot coordinate
const Panel = ({ title, children }: { title: string; children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return isOpen ? <section>{children}</section> : <button onClick={() => setIsOpen(true)}>Show</button>;
};

// Controlled — parent decides which panel is open
const Panel = ({ title, children, isOpen, onToggle }: PanelProps) =>
  isOpen ? <section>{children}</section> : <button onClick={onToggle}>Show</button>;
```

**Single source of truth:** for each piece of state, exactly one component owns it. All other components receive it via props. Do not duplicate the same value in multiple `useState` calls across siblings.

## Reactive Values and Dependency Arrays

A **reactive value** is anything recalculated during render: props, state, and variables derived from them. Constants declared outside the component and `ref.current` are **not** reactive.

Every reactive value read inside an Effect must appear in the dependency array. The array is not "when to run" — it is "skip if nothing here changed" (see "Correct Mental Model for useEffect" above). React compares each dependency with `Object.is`.

```tsx
const serverUrl = "https://localhost:1234"; // not reactive — constant

const ChatRoom = ({ roomId }: { roomId: string }) => {
  const [message, setMessage] = useState("");
  const greeting = `Welcome to ${roomId}`; // reactive — derived from prop

  useEffect(() => {
    const conn = createConnection(serverUrl, roomId);
    conn.connect();
    return () => conn.disconnect();
  }, [roomId]); // serverUrl is not reactive, roomId is
};
```

### Never suppress the linter

`// eslint-disable-next-line react-hooks/exhaustive-deps` hides real bugs. If a dependency seems wrong, restructure the code instead:

- Move non-reactive values outside the component.
- Move object/function creation inside the Effect so it is not a dependency.
- Extract a custom hook when the pattern repeats.

### One Effect = one concern

Do not combine unrelated synchronization logic into one Effect. If analytics and connection management share a dependency, splitting them prevents unintended triggers when one concern adds a new dependency.

```tsx
// NG — analytics re-fires when serverUrl changes
useEffect(() => {
  logVisit(roomId);
  const conn = createConnection(serverUrl, roomId);
  conn.connect();
  return () => conn.disconnect();
}, [roomId, serverUrl]);

// OK — independent Effects
useEffect(() => { logVisit(roomId); }, [roomId]);
useEffect(() => {
  const conn = createConnection(serverUrl, roomId);
  conn.connect();
  return () => conn.disconnect();
}, [roomId, serverUrl]);
```

## When to Use Context

Context solves **prop drilling** — passing data through many intermediate components that do not use it. Before reaching for Context, try these alternatives first:

1. **Pass props explicitly.** Even through a dozen components, explicit data flow is easier to trace.
2. **Extract components and pass JSX as `children`.** This removes intermediate layers between data producer and consumer.

Use Context when the data is genuinely "ambient" and consumed by many distant descendants:

| Good use case    | Reason                                           |
| ---------------- | ------------------------------------------------ |
| Theme (dark/light) | Most components need to read it                |
| Current user / auth | Deeply nested components check permissions    |
| Routing state    | Active links need the current route              |
| Locale / i18n    | All text components read the language            |

Do not use Context merely to avoid passing props through two or three levels.

### Context + useReducer for complex state

For state shared by many components with complex update logic, combine Context (distribution) with `useReducer` (centralized updates). Provide both the state and `dispatch` via context so any descendant can read state and trigger actions without prop drilling.

## useMemo and useCallback Decision Criteria

Both are **performance optimizations only**. If your code does not work without them, fix the underlying bug first. React Compiler (React 19+) can automate memoization; manual calls become less necessary over time.

### useMemo

Use when **all three** conditions are true:

1. The computation takes ≥ 1 ms (measure with `console.time` in production mode + CPU throttling).
2. Dependencies rarely change — the cached result is reused across most renders.
3. The result is passed to a `memo()`-wrapped child **or** used as a dependency of another hook.

If any condition is false, a plain expression is sufficient (see "useMemo Is 'Skip Recomputation'" above).

### useCallback

`useCallback(fn, deps)` is equivalent to `useMemo(() => fn, deps)`. Use it when:

- The function is passed as a prop to a `memo()`-wrapped child.
- The function is used as a dependency of `useEffect` or another hook.
- The function is returned from a custom hook (so consumers can optimize).

Prefer **updater functions** in `setState` to reduce dependencies:

```tsx
// NG — depends on todos, so callback re-creates when todos changes
const handleAdd = useCallback(
  (text: string) => setTodos([...todos, createTodo(text)]),
  [todos],
);

// OK — updater removes the dependency on todos
const handleAdd = useCallback(
  (text: string) => setTodos((prev) => [...prev, createTodo(text)]),
  [],
);
```

### Alternatives that eliminate the need for memoization

Before adding `useMemo` / `useCallback`, check whether you can:

- Move state down so fewer components re-render.
- Accept JSX as `children` so the child tree is not re-rendered by the parent.
- Move object / function creation inside the Effect that uses it, removing it as a dependency.
- Extract a pure computation into the render body (no hook needed at all).
