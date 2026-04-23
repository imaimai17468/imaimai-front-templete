---
name: coding-guide
description: Coding Guide. Use when the user asks for detailed coding rules, architecture patterns, testing conventions, or references `.claude/skills/coding-guide/SKILL.md`.
user_invocable: true
---

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

## Dependencies

### Exact Version Pinning

`package.json` の依存バージョンは**完全固定**する。レンジ指定子 (`^`, `~`) や major-only 表記 (`"4"`, `"^20"`) は使わず、必ず exact バージョン (`"1.2.3"`) で書く。

**NG**

```json
{
  "dependencies": {
    "next": "^16.1.1",
    "react": "^19.2.3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20"
  }
}
```

**OK**

```json
{
  "dependencies": {
    "next": "16.1.1",
    "react": "19.2.3"
  },
  "devDependencies": {
    "typescript": "5.8.3",
    "@types/node": "20.19.9"
  }
}
```

**追加・更新時の運用:**

- exact で追加する: `bun add -E <pkg>` / `bun add -E -d <pkg>`
- 既存依存を更新する場合も、更新後に `package.json` の `^` / `~` / major-only 表記が残っていないか確認し、レンジが混入していたら手動で exact に修正する
- バージョン一覧が必要なら `bun pm ls` で実際にインストールされているバージョンを確認できる

理由: テンプレート用途なので、派生プロジェクト間で環境差分が出ないよう完全固定する。アップデートは意図的に行い、常に lockfile と `package.json` が一致した状態を保つ。

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

### Directory-First Component Layout

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

### When to Write Tests

テストは「後の変更で壊れたことに気づけるか」を基準に書く。闇雲に全コンポーネントにテストを付ける運用は取らない。

- **Pure 関数**: **常に必須**。`utils.ts` 等に関数を追加したら同ディレクトリに `*.test.ts` を追加し、分岐を全て網羅する。
- **コンポーネント**: 以下のいずれかに該当する時にテストを書く（該当しない trivial な静的コンポーネントはスキップ可）:
  - **props / state で出し分けがある**（条件分岐で異なる要素がレンダリングされる）
  - **a11y 属性が付いている**（`aria-*`, `role`, `htmlFor`, `tabIndex`, keyboard handler 等）
  - 上記に該当するコンポーネントを**変更する時**（回帰検知のため）
  - → スナップショットを取らないと変更の影響が把握できないケースを対象にする
- **Container**: データ取得をモックし、Presenter に渡す props を検証する。
- **Presenter**: 上記「コンポーネント」基準に従う。単一の静的レンダリングで a11y も無ければテスト不要。

判断基準は「このコンポーネントを他人が将来変更した時、意図しない変化を検知できるか」。snapshot / `getByRole` / `getByLabelText` 等で固定する価値があるものにだけ投資する。

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
