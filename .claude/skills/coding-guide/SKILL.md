# Coding Guide

Detailed rules and patterns to follow when implementing code.

---

## Coding Style

### No Loops

`for`, `for...in`, `for...of`, `while`, `do...while` are forbidden. Use functional alternatives.

```tsx
// NG
for (let i = 0; i < items.length; i++) {
  results.push(transform(items[i]));
}

// OK
const results = items.map(transform);
```

| Purpose     | Method                  |
| ----------- | ----------------------- |
| Transform   | `map`                   |
| Filter      | `filter`                |
| Aggregate   | `reduce`                |
| Flat + Map  | `flatMap`               |
| Side effect | `forEach`               |
| Existence   | `some`, `every`, `find` |

### Tailwind — 既存クラスを使う

Tailwind の arbitrary value 記法 `[...]` は使わない。既存のユーティリティと `globals.css` のテーマトークンだけで表現する。

**サイズ系 (`w-`, `h-`, `p-`, `m-`, `gap-`, `inset-` 等)**

Tailwind v4 では `--spacing` 変数ベースで動的生成されるため、任意の整数をそのまま使える（例: `w-80` = `20rem`、`w-327` も有効）。`w-[327px]` のような arbitrary は不要。

**色・フォントサイズ・border-radius など "トークン化したいもの"**

arbitrary で直書きせず、`globals.css` にトークンを追加してから Tailwind クラスで参照する。

色の透明度修飾子 `-XXX/YY`（例: `text-gray-800/80`, `bg-blue-600/50`）で色の濃淡を調整しない。「色を薄く」が必要な場面では、透明度を乗せるのではなく**別のシェードのクラス**に切り替える（例: `text-gray-800` → `text-gray-700`）。半透明が本当に必要な場合（オーバーレイ等）は `globals.css` に専用のカラートークンを登録してから参照する。

```tsx
// NG — arbitrary value / 色を薄くするために透明度を使う
<div className="w-[327px] text-[13px] bg-[#1a1a1a] rounded-[10px] text-gray-800/80" />

// OK — サイズは数値クラス、色・フォントサイズはトークン、薄くするならシェードを変える
<div className="w-80 text-sm bg-background rounded-lg text-gray-700" />
```

---

## Architecture

### Directory Structure — Colocation

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
    │       ├── DashboardHeader.tsx
    │       ├── DashboardHeader.container.tsx
    │       └── StatsCard.tsx
    ├── settings/
    │   ├── page.tsx
    │   └── components/
    │       └── SettingsForm.tsx
    └── components/          # shared across multiple pages only
        └── Sidebar.tsx
```

### Component Growth — File to Directory Promotion

When a component grows large enough to have its own sub-components, promote it from a file to a directory.

**Before promotion** — sub-component is small and fits in the same file:

```
components/
└── StatsCard.tsx          # TrendBadge defined internally (not exported)
```

**After promotion** — sub-component needs its own file. Place child components as siblings in the same directory (do not nest `components/` inside):

```
components/
└── StatsCard/
    ├── StatsCard.tsx              # Presenter (main component)
    ├── StatsCard.container.tsx    # Container
    └── TrendBadge.tsx             # Child component
```

When to promote:

- Sub-component exceeds ~30 lines
- Sub-component needs its own props type definition
- Sub-component needs its own test file

### One Component Per File

- Each `.tsx` file exports exactly one component
- File name must match the component name (`StatsCard.tsx` → `StatsCard`)
- Internal helper functions and sub-components are OK but must not be exported

### Container / Presenter Pattern

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

### Extract Logic into Pure Functions

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

### Props-Driven Design

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

---

## Testing

### White-Box Testing

Tests must cover internal logic paths, not just inputs/outputs.

### AAA Pattern + 1 Test = 1 Expect

All tests follow **Arrange / Act / Assert**. Each test case has exactly one `expect`.

Test names must follow the format: `"should [expected behavior] when [condition]"`.

**Pure function tests** — cover all branches:

```tsx
describe("calcTrend", () => {
  it("should return 'up' when current is greater than previous", () => {
    // Arrange
    const current = 10;
    const previous = 5;

    // Act
    const result = calcTrend(current, previous);

    // Assert
    expect(result).toBe("up");
  });

  it("should return 'down' when current is less than previous", () => {
    // Arrange
    const current = 3;
    const previous = 8;

    // Act
    const result = calcTrend(current, previous);

    // Assert
    expect(result).toBe("down");
  });

  it("should return 'flat' when current equals previous", () => {
    // Arrange
    const current = 5;
    const previous = 5;

    // Act
    const result = calcTrend(current, previous);

    // Assert
    expect(result).toBe("flat");
  });
});
```

**Presenter tests** — verify rendering across prop variations:

```tsx
describe("StatsCard", () => {
  it("should render up arrow when trend is 'up'", () => {
    // Arrange & Act
    render(<StatsCard title="Users" value={100} trend="up" />);

    // Assert
    expect(screen.getByText("↑")).toBeInTheDocument();
  });
});
```

**Testing strategy:**

- Pure functions: cover all branch paths
- Presenter: verify rendering for each prop variation
- Container: mock data fetching + verify props passed to Presenter
- Explicitly test boundary values and edge cases
