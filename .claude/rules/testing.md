# Testing

## When to Write Tests

Write tests based on "will this catch a regression if someone changes it later?" Do not blindly add tests to every component.

- **Pure functions**: **always required**. When you add a function to `utils.ts` (or similar), add `*.test.ts` in the same directory and cover every branch.
- **Components**: write tests when any of the following applies (trivial static components that don't match may be skipped):
  - **Rendering varies by props / state** (different elements render under different conditions)
  - **a11y attributes are present** (`aria-*`, `role`, `htmlFor`, `tabIndex`, keyboard handlers, etc.)
  - **Modifying a component that meets the above** (to catch regressions)
  - → target cases where the change impact cannot be understood without a snapshot
- **Container**: mock data fetching and verify the props passed to the Presenter.
- **Presenter**: follow the "Components" criteria above. A single static render with no a11y attributes needs no test.

The judgment rule is: "if someone else changes this component later, will the test catch unintended changes?" Only invest in tests worth fixing with `snapshot` / `getByRole` / `getByLabelText` / etc.

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
