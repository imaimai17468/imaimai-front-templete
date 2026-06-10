# Testing

## Testing Model

The Container / Presenter split is the testing strategy. Containers absorb impurity (hooks, fetch, state, side effects) so that Presenters remain pure functions of props. This separation eliminates the need for mocks in most tests:

- **Pure functions** (utils, reducers, validators) — testable with plain arguments. Highest coverage.
- **Presenters** — testable with props alone. Render real children; no mocks needed.
- **Containers** — intentionally untested. They wire hooks to Presenters and have no branching. If a Container has logic worth testing, extract it into a pure function.

If you reach for `vi.mock`, pause and ask: "Why can't I test this with real dependencies?" The answer almost always points to a design improvement — push impurity into a Container, extract logic into a pure function, or provide context via `renderWithRouter`. Mocking is a last resort for true external boundaries (network, auth, browser APIs), not a tool for making poorly-separated code testable.

## When to Write Tests

Write tests based on "will this catch a regression if someone changes it later?" Do not blindly add tests to every component.

- **Pure functions**: **always required**. When you add a function to `utils.ts` (or similar), add `*.test.ts` in the same directory and cover every branch.
- **Components**: write tests when any of the following applies (trivial static components that don't match may be skipped):
  - **Rendering varies by props / state** (different elements render under different conditions)
  - **a11y attributes are present** (`aria-*`, `role`, `htmlFor`, `tabIndex`, keyboard handlers, etc.)
  - **Modifying a component that meets the above** (to catch regressions)
  - → target cases where the change impact cannot be understood without a snapshot
- **Container**: **do not test** by default. A Container that only wires hooks to a Presenter has no branching — testing it just proves React calls props, which is framework behavior. If a Container contains real logic (branching, data transformation), extract that logic into a pure function in `utils.ts` and test the function directly. Never mock a Presenter to capture props passed by a Container.
- **Presenter**: follow the "Components" criteria above. A single static render with no a11y attributes needs no test. Render real child components — do not mock them (see "No Mocking Child Components" below).

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
- **Extracted transformation logic**: data/args built for a gateway or Presenter — test the extracted pure function in `utils.ts`, not the Container that calls it.

## White-Box Testing

Tests must cover internal logic paths, not just inputs/outputs.

## AAA Pattern

**Linter-enforced:** test-naming-format (`should...when...`), single-expect (`tools/oxlint-plugins/arch-rules.js`)

All tests follow **Arrange / Act / Assert**.

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
- Container: do not test (extract logic to pure functions if needed)
- Explicitly test boundary values and edge cases

## No Mocking Child Components

Do not `vi.mock` a child component to isolate a parent. Render the real child. The Container/Presenter split exists precisely so that Presenters are pure and testable without mocks — taking real props and rendering real children.

```tsx
// NG — mocking a child to "isolate" the parent
vi.mock("@/components/shared/KarmaBadge/KarmaBadge", () => ({
  KarmaBadge: ({ level }: { level: number }) => <span>{level}</span>,
}));

// OK — render the real child; assert on what the user actually sees
await renderWithRouter(<ProfileHeader {...props} />);
expect(screen.getByLabelText("Architect: 300")).toBeInTheDocument();
```

If a child needs Router context (uses `Link`, `useRouter`, etc.), use `renderWithRouter` from `src/test/router-utils.tsx` instead of mocking the router.

## When `vi.mock` Is Acceptable

`vi.mock` is a last resort. The only legitimate uses:

| Use case | Reason |
|----------|--------|
| **Gateway functions** (`@/gateways/*/*.fn`) | External API boundary — real calls would hit the network |
| **Auth functions** (`@/lib/auth`) | External auth service — `signOut()` redirects the browser |
| **`sonner` toast** | Side effect (toast notification) with no DOM output to assert |

Everything else — child components, Router, React Hook Form, UI primitives — should be the real implementation. If the real implementation is hard to render in a test, that signals a design problem in the component, not a need for mocks.

**`isolate: false` constraint:** This project runs Vitest with `isolate: false` (shared module state across test files) for speed. Under this mode, `vi.mock` factory functions leak across files — a mock registered in one test file affects all subsequent files in the same run. This makes `vi.mock` not just philosophically wrong for internal modules, but technically dangerous. Restrict it to the external boundaries listed above.

## `renderWithRouter`

Use `renderWithRouter` from `src/test/router-utils.tsx` for any component that uses TanStack Router features (`Link`, `useRouter`, `useNavigate`, etc.). It provides a real Router context with `createMemoryHistory` — no mocking needed.

```tsx
import { renderWithRouter } from "@/test/router-utils";

it("should render the karma link target", async () => {
  await renderWithRouter(<KarmaBadge level={3} karma={300} canOpenDetail />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/info/features#karma");
});
```

Key points:
- `renderWithRouter` is **async** — always `await` it
- Returns `{ container, router, ...rest }` — use `router` to assert navigation state
- Do **not** use `vi.mock("@tanstack/react-router")` anywhere
