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

- **Route / page files** (`page.tsx`, `route.tsx`): **do not test directly**. Route files depend on router context which requires full router mocking — test the components they render (Container / Presenter) instead. Inline CSS-class ternaries in route files (e.g., active tab styling) do not warrant extraction solely for testability; extracting a utility that mirrors a ternary produces tautological tests.

The judgment rule is: "if someone else changes this component later, will the test catch unintended changes?" Only invest in tests worth fixing with `snapshot` / `getByRole` / `getByLabelText` / etc.

## Do NOT Write These Tests (Tautological / Low-Value)

The following tests pass but catch no real regression — they re-assert framework behavior or hardcoded values. Do not write them; delete them when found.

### Callback passthrough

Firing an element and asserting that a mock passed **directly** as a prop was called, where the component just forwards it (`onClick={onX}`) with no transformation or branching. This only proves that React invokes `onClick` — framework behavior, not our logic.

```tsx
// NG — tests that React fires the handler, nothing of ours
it("should call onSubmit when the button is clicked", () => {
  const onSubmit = vi.fn();
  render(<Dialog onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole("button"));
  expect(onSubmit).toHaveBeenCalled();
});
```

**Exception (keep):** when the handler runs internal logic before calling out — e.g. a Container that transforms input and calls a server fn — assert the **shape of the arguments** (`expect(fn).toHaveBeenCalledWith(expect.objectContaining({ data: {...} }))`). That tests our transformation, not React.

### Unconditional static render

Rendering with one fixed prop set and asserting a literal string/label that the component **always** renders (no conditional path), where the asserted thing is not an a11y attribute. This just proves "the component renders the text I hardcoded."

```tsx
// NG — the label is always rendered; no branch, no a11y
it("should render the title", () => {
  render(<Card title="Hello" />);
  expect(screen.getByText("Hello")).toBeInTheDocument();
});
```

Passing an irrelevant prop (e.g. `user={null}`) does not make it a branch test if the asserted element renders regardless of that prop.

### What to keep instead

These DO catch regressions — keep / write them:

- **Prop/state-varied rendering**: different output under different inputs (`trend="up"` → `↑`; conditional `{flag && <X/>}`).
- **a11y attributes & link targets** that break silently: `aria-*`, `role`, `htmlFor`, `tabIndex`, `disabled` tied to a prop, and `href` / `to` route targets (a wrong link is a real bug).
- **Mapping / derivation**: `"new" → "新機能"` label maps, formatting, computed values.
- **Container argument shape**: the data/args passed to a server fn or to the Presenter (the transformation), not merely "it was called".

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
