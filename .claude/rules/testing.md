# Testing

## When to Write Tests

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

## White-Box Testing

Tests must cover internal logic paths, not just inputs/outputs.

## AAA Pattern + 1 Test = 1 Expect

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
