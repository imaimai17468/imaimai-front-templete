---
paths:
  - "**/*.tsx"
---

# React Purity (not caught by linters)

Render must be a pure computation. The following three principles are independent — a violation of any one breaks purity.

- **Idempotent** — Components and hooks must return the same result for the same inputs, regardless of how many times or when they are called. Never produce values during render that depend on call count or timing. e.g. `new Date()`, `Math.random()`, `crypto.randomUUID()`, direct `fetch()`, incrementing an ID counter.
- **No side effects in render** — Render only computes JSX — it must not observe or change the outside world. Side effects belong in `useEffect` or event handlers. e.g. `document.title = ...`, `window.scrollTo()`, observational `console.log()`, writes to a global store.
- **No mutation of non-local values** — Only values created within the current render call may be mutated. Module-scope and shared objects are off-limits. e.g. `push` into a module-scope array, incrementing a counter declared outside the function, mutating properties of an argument object.

# React Calls Components and Hooks (not caught by linters)

- **Never pass hooks as values** — Don't pass hooks as props, arguments, or return values. A hook must be called directly and statically inside the component or hook that uses it. e.g. `<Button useData={useDataWithLogging} />`, returning a hook from a factory function, storing a hook in a variable and calling it conditionally.
- **Never create higher-order hooks** — Don't wrap or compose hooks dynamically at call time. Instead, inline the logic into a new named hook. e.g. `const useDataWithLogging = withLogging(useData)` — write a `useDataWithLogging` hook that calls `useData` and logging directly.

# You Might Not Need an Effect (not caught by linters)

The deciding question: is this code running because the user did something (event), or because the component appeared on screen (sync with external system)? Only the latter justifies `useEffect`.

- **Derived values** — Never `useEffect` + `setState` to transform props/state into another state. Compute inline or `useMemo` for expensive calculations.
- **State reset on prop change** — Don't `useEffect(() => setX(initial), [prop])`. Give the component a `key={prop}` so React remounts it with fresh state.
- **Partial state adjustment on prop change** — Prefer deriving the value from existing state/props instead of syncing with an effect. e.g. store `selectedId` instead of `selectedItem`, and derive the item via `items.find()`.
- **Effect chains** — Multiple effects where each sets state that triggers the next is a sign that the logic belongs in a single event handler that batches all state updates at once.
- **Notifying parent of state change** — Don't `useEffect(() => onChange(value), [value])`. Call `onChange` directly in the same event handler that calls `setValue`.
- **useEffect is not componentDidMount** — Don't think of `useEffect(() => {}, [])` as "run once on mount." An effect synchronizes with external systems whenever its reactive dependencies change; mount and update are a single unified lifecycle. When you want "skip on initial render," reframe: the real need is usually an early return based on state value (e.g. `if (!roomId) return;`), not a ref-based "first render" flag.

# Component Splitting (not caught by linters)

- **Re-render boundaries** — A component boundary is also a re-render boundary. When parts of a UI update at different frequencies, split them into separate components so expensive subtrees don't re-render unnecessarily. When a library offers both a hook API and a render-props/component API, prefer the one that isolates re-renders to the smallest scope.
- **Generic component naming** — Props of generic/reusable components should follow standard HTML attribute and platform conventions to minimize mental mapping cost. e.g. `<MyImage src={url} />` not `<MyImage imageUrl={url} />`. For controlled/uncontrolled patterns, follow the Radix convention: `open`/`onOpenChange`/`defaultOpen`, not `isVisible`/`onToggle`.
- **Transparent native wrappers** — UI-library-level components wrapping a native element (`input`, `button`, `a`) should accept all native attributes via `ComponentPropsWithoutRef<"input">` and spread them. Don't restrict props to a handpicked subset — that blocks a11y attributes and makes the wrapper strictly worse than the raw element.
- **Event handler props name intent, not mechanism** — Callback props represent what the component communicates, not how the user interacts. Naming after the DOM event (`onClickPlay`) couples the interface to a specific interaction, breaking when the trigger changes to keyboard, gesture, or programmatic call. e.g. `onPlayMovie` not `onClickPlayMovie`.
- **Minimal props (avoid stamp coupling)** — A child that receives more data than it needs is coupled to the parent's data shape and re-renders when unrelated fields change. Pass the narrowest data that satisfies the child's responsibility. e.g. `<ArticleTitle title={article.title} />` not `<ArticleTitle article={article} />`.
- **useReducer for stable callbacks** — A callback that closes over state breaks identity stability — `useCallback` can't help because its deps include the state. `useReducer` eliminates this by design: `dispatch` is identity-stable and state access moves into the reducer. Reach for `useReducer` when callbacks and state are intertwined, not only when state shape is complex.
- **Reactive vs procedural API** — Libraries offer both reactive APIs (re-render on change: `watch()`, `useSWR`) and procedural APIs (get current value on demand: `getValues()`, `useMutation`). Match the API to the trigger: display-driven → reactive, user-action-driven → procedural/mutation. Don't use `useSWR` for user-initiated fetches; don't use `watch()` inside event handlers.

# Module Organization (not caught by linters)

- **No pass-through layers** — Don't create components that only receive props and forward them to a child. If a component adds no logic, layout, or abstraction, it's a useless intermediate layer that deepens the dependency chain and obscures data flow. Keep the tree flat where possible.
- **Colocation over classification** — Don't organize by technical role (`hooks/`, `atoms/`, `utils/`). Place modules next to where they're used. Colocation limits scope by default — a module in a feature directory is implicitly private to that feature. Classification directories force everything to be "potentially reusable," increasing cognitive load. Only truly generic modules (no domain knowledge — could ship as a library) belong in shared directories like `_ui/` or `_utils/`. A small domain-specific component belongs with its feature, not in a shared directory because of its size. Classify by purpose (data fetching → `_repositories/`), not by implementation mechanism (hook → `_hooks/`). A single concern (e.g. "posts API") often exports a type, a query factory, an async function, and a hook — keep them together in one directory, not scattered across `/types`, `/hooks`, `/utils`.
- **Small for complexity, not reuse** — The purpose of extracting a module is to reduce complexity and limit its scope of usage, not to make it reusable. A module used in exactly one place is fine — what matters is that it has a single, well-defined responsibility.
- **No ceremony for small modules** — Don't wrap every small component in its own directory with `index.ts`. Place files directly in the parent directory. The overhead of creating a directory + re-export barrel for each module discourages fine-grained splitting, which is the opposite of what we want.
