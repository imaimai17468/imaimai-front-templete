# Architecture

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

## Directory-First Component Layout

**Every component lives in its own directory from day one.** Do not create a flat `Component.tsx` and promote it later when children appear — start with `Component/Component.tsx` even when there are no child components yet.

**Initial state** — no children yet, but the directory exists:

```
components/
└── StatsCard/
    └── StatsCard.tsx              # Presenter (main component)
```

**When children are added** — place them as siblings in the same directory (do not nest `components/` inside):

```
components/
└── StatsCard/
    ├── StatsCard.tsx              # Presenter (main component)
    ├── StatsCard.container.tsx    # Container
    └── TrendBadge.tsx             # Child component
```

When to split an internal sub-component into its own sibling file:

- Sub-component exceeds ~30 lines
- Sub-component needs its own props type definition
- Sub-component needs its own test file

Until one of the above applies, a small internal helper component may stay inside `StatsCard.tsx` (not exported).

## One Component Per File

- Each `.tsx` file exports exactly one component
- File name must match the component name (`StatsCard.tsx` → `StatsCard`)
- Internal helper functions and sub-components are OK but must not be exported

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

Components must be controllable from the outside via props. Do not branch on internal state.

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
