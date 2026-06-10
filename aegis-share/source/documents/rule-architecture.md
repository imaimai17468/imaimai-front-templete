---
doc_id: rule-architecture
title: Architecture
kind: guideline
ownership: file-anchored
source_path: .claude/rules/architecture.md
---
# Architecture

**Linter-enforced:** one-component-per-file, component-file-naming, no-size-props (`tools/oxlint-plugins/arch-rules.js`)

## Directory Structure — Colocation

Place components in a `components/` directory at the same level as the page that uses them. Only promote shared components to a higher level.

**Exceptions:** `src/lib/` and `src/components/` are outside the colocation rule. They hold shared utilities (e.g., shadcn `utils.ts`) and shared UI primitives (e.g., shadcn `ui/`). Do not apply page-level architecture rules (Container/Presenter, etc.) to these directories.

```
src/
├── lib/                     # shared utilities (exception)
│   └── utils.ts
├── components/              # shared UI primitives (exception)
│   └── ui/
│       └── button.tsx
└── app/
    ├── dashboard/
    │   ├── page.tsx
    │   └── components/
    │       ├── DashboardHeader/
    │       │   ├── DashboardHeader.tsx
    │       │   └── DashboardHeader.container.tsx
    │       └── StatsCard/
    │           └── StatsCard.tsx
    ├── settings/
    │   ├── page.tsx
    │   └── components/
    │       └── SettingsForm/
    │           └── SettingsForm.tsx
    └── components/          # shared across multiple pages only
        └── Sidebar/
            └── Sidebar.tsx
```

Non-page files (helpers, tests, utils) placed directly alongside a page file must not conflict with the router's file-based routing. Files inside a subdirectory that is not itself a route (e.g., `components/`) do **not** need special naming — the parent directory's non-route nature already excludes the entire subtree from the router.

## Directory-First Component Layout

**Every component lives in its own directory from day one.** Do not create a flat `Component.tsx` and promote it later when children appear — start with `Component/Component.tsx` even when there are no child components yet.

**Initial state** — no children yet, but the directory exists:

```
components/
└── StatsCard/
    └── StatsCard.tsx              # Presenter (main component)
```

**When children are added** — place them as siblings in the same directory. Do not create a `components/` subdirectory inside a component directory. All child components follow directory-first layout (each gets its own subdirectory).

```
components/
└── StatsCard/
    ├── StatsCard.tsx              # Presenter (main component)
    ├── StatsCard.container.tsx    # Container
    ├── TrendBadge/                # Child component (directory-first)
    │   └── TrendBadge.tsx
    └── StatsChart/                # Child component (directory-first)
        ├── StatsChart.tsx
        └── StatsChart.test.tsx
```

**When to split an internal sub-component into its own sibling directory:**

- Sub-component exceeds ~30 lines
- Sub-component needs its own props type definition
- Sub-component needs its own test file

Until one of the above applies, a small internal helper component may stay inside `StatsCard.tsx` (not exported).

## Container / Presenter Pattern

Split components into **Container** and **Presenter**.

**Presenter** — Pure rendering component. No state, output determined entirely by props.

```tsx
// StatsCard.tsx (Presenter)
type StatsCardProps = {
  title: string;
  value: number;
  trend: "up" | "down" | "flat";
};

export const StatsCard = ({ title, value, trend }: StatsCardProps) => (
  <div>
    <h3>{title}</h3>
    <p>{value}</p>
    <span>{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>
  </div>
);
```

**Container** — Handles data fetching and state, passes data to Presenter.

```tsx
// StatsCard.container.tsx (Container)
import { StatsCard } from "./StatsCard";
import { useStats } from "@/hooks/useStats";

export const StatsCardContainer = ({ statId }: { statId: string }) => {
  const { data, isLoading } = useStats(statId);

  if (isLoading) return <Skeleton />;

  return <StatsCard title={data.title} value={data.value} trend={data.trend} />;
};
```

**Naming convention:**

| File                          | Role      |
| ----------------------------- | --------- |
| `ComponentName.tsx`           | Presenter |
| `ComponentName.container.tsx` | Container |

### Prefer Leaf Containers Over Root Hook Extraction

When a parent Container manages state for multiple independent child sections, **push the state into each child as its own Container** rather than extracting hooks at the root.

```
// NG — root Container calls 5 hooks, pipes everything through a 30-prop Presenter
SettingsPageContainer (useSeoSettings + useBlockedUsers + useKarma + …)
  └─ SettingsPage (30+ props → distributes to children)
       ├─ SeoSection (receives 3 props)
       ├─ BlockListSection (receives 10 props)
       └─ KarmaSection (receives 6 props)

// OK — each section owns its own state; parent is layout-only
SettingsPage
  ├─ SeoSectionContainer → SeoSection
  ├─ BlockListSectionContainer → BlockListSection
  └─ KarmaSectionContainer → KarmaSection
```

Benefits:

- **Narrow re-render scope**: toggling a SEO switch doesn't re-render the Karma section.
- **Smaller prop surface**: each Presenter receives only the props it uses; the parent passes none through.
- **Independent testability**: each leaf Container can be tested in isolation.

When two children genuinely share state (e.g., voting updates a shared `userVotes` map that both a feed list and a sidebar display), keep the shared state in the **lowest common ancestor** and push only the unshared parts down. Hook extraction at the ancestor is appropriate for the shared slice; leaf Containers handle the rest.

The decision rule: "Does this child read or write state that another sibling also reads or writes?" Yes → keep at ancestor. No → push down into a leaf Container.

## Extract Logic into Pure Functions

Extract business logic and transformations out of components as pure functions.

```tsx
// utils.ts
export const calcTrend = (current: number, previous: number): "up" | "down" | "flat" => {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
};
```

Pure function requirements:

- Same input always produces the same output
- No side effects (no DOM manipulation, API calls, or external variable mutation)
- No dependency on external state

## Props-Driven Design

**Applies to Presenters only.** Containers are expected to hold `useState` / hooks and pass derived values to Presenters — that is their role (see Container / Presenter Pattern above).

Presenters must be controllable from the outside via props. Do not branch on internal state.

```tsx
// NG — closed internal state
const Dialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  return isOpen ? <div>...</div> : null;
};

// OK — externally controllable
type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

const Dialog = ({ isOpen, onClose }: DialogProps) => {
  if (!isOpen) return null;
  return (
    <div>
      ...<button onClick={onClose}>Close</button>
    </div>
  );
};
```

## No Appearance-Driven Packaging

Do not organize files by "what the code looks like." Splitting directories by implementation artifact (`hooks/`, `contexts/`, `providers/`) scatters a single feature's code across multiple directories. In cohesion terms, this produces **coincidental cohesion** — the worst level.

```
// NG — appearance-driven (Toast feature scattered across 4 directories)
src/
├── components/
│   └── Toast.tsx
├── providers/
│   └── ToastProvider.tsx
├── contexts/
│   └── toastContext.ts
└── hooks/
    └── useToast.ts

// OK — co-located by feature
src/
├── components/        # shared components
├── hooks/             # shared custom hooks
└── features/
    └── toast/         # everything for Toast lives here
        ├── Toast.tsx
        ├── toastContext.tsx
        ├── ToastProvider.tsx
        └── useToast.ts
```

Co-location provides confidence that related code won't scatter, encouraging aggressive decomposition into small pieces. When a feature lives in one directory, you can assess its blast radius at a glance.

## Component Coupling

Aim for **data coupling** between components — pass only the scalar values needed via props. Coupling worsens in this order:

| Coupling level | Pattern | Mitigation |
|----------------|---------|------------|
| Data coupling (ideal) | Pass only needed scalar values via props | Target state |
| Stamp coupling | Pass objects with unused properties | Separate types at scale |
| Control coupling (dangerous) | Flag props that dictate child's control flow | Use Composition instead |
| External coupling | Call child methods via ref | Avoid as a rule |
| Common coupling (tight) | Share Context or global variables | Use sparingly |

Avoiding control coupling:

```tsx
// NG — flag controls rendering (leads to logical cohesion)
<VideoList videos={videos} showAuthor={false} />

// OK — Composition separates concerns
<VideoList>
  {videos.map(item => (
    <VideoItem key={item.id} title={item.title} />
  ))}
</VideoList>
```

If prop drilling becomes cumbersome, revisit component design. Do not reach for Context as a shortcut.

## No Margin on Components

Do not apply margin to a component's **root element**. Margin is a layout concern, not the component's responsibility. Built-in margins require overrides or resets when reusing the component in a different layout. Internal elements (`ml-*`, `mt-*` etc. inside the component) are not subject to this rule — they are part of the component's internal layout.

Control spacing via the parent's `gap`, `space-y-*`, `space-x-*`, or other layout utilities.

## Component Purity

React components must be **pure functions**. Given the same inputs (props + hook return values), they must always return the same JSX and must not produce side effects during rendering. React does not guarantee how many times a component will execute, so breaking purity causes unpredictable behavior with React Compiler optimizations, Suspense, and transitions.

Where side effects are allowed:

| Location | Side effects | Reason |
|----------|-------------|--------|
| Component body | Forbidden | Affects return value computation |
| Event handlers | OK | Runs on user action, outside return value |
| useEffect | OK | Runs after render, outside return value |
| Inside useMemo | Forbidden | Part of return value computation |

```tsx
// NG — side effect during render
const MyPage = ({ user }: { user: User }) => {
  fetch("/api/log/pageview", { method: "POST", body: JSON.stringify({ userId: user.id }) });
  return <section>My Page</section>;
};

// NG — reading external state
const UserInfo = () => {
  const userId = localStorage.getItem("userId");
  return <p>ID: {userId}</p>;
};

// NG — non-deterministic
const Lottery = () => {
  if (Math.random() < 0.1) return <p>Winner</p>;
  return <p>Try again</p>;
};

// OK — side effect in event handler
const LoginButton = () => (
  <button onClick={() => fetch("/api/login", { method: "POST" })}>
    Log in
  </button>
);
```

## Server Components and the 'use client' Boundary

`'use client'` is not just an "execute in the browser" marker — it declares the **data handoff boundary** between Server Components and Client Components.

Key properties:
- Components imported inside a Client Component are automatically treated as Client Components even without a marker (domino-effect propagation).
- Data passed from Server Components to Client Components must be serializable (RSC Payload format).
- Aim for an **island architecture**: place `'use client'` only where needed. Do not make the entire page a Client Component.
