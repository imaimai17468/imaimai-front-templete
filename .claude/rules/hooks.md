# Custom Hooks

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
