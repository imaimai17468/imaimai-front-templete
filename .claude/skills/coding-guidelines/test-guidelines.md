# Test Guidelines - Vitest / React Testing Library

This document defines quality standards, structure, and naming conventions for test code using Vitest and React Testing Library.

## Core Guidelines

- Explicitly import necessary functions from `vitest` in all test files. Do not rely on global definitions.
- Write `describe` / `test` descriptions in Japanese with specific conditions and expected results, using the format "when [condition], it should [result]".
- Follow the AAA (Arrange-Act-Assert) pattern strictly, comparing using `actual` and `expected` variables. One test, one assertion (multiple properties can be compared as object).
- Prohibit nested `describe` blocks. Place shared data in the top-level `describe` scope.
- Identify all branches and exception paths to ensure meaningful coverage. Verify behavior, not implementation details.
- Limit snapshots to verifying semantic HTML and accessibility attributes. Do not use them for style changes.

## Code Examples

### Basic Test Structure

```typescript
import { describe, expect, test } from "vitest";
import { calculateTotal } from "./calculateTotal";

describe("calculateTotal", () => {
  test("商品が1つの場合、その価格を返すこと", () => {
    // Arrange
    const items = [{ price: 100 }];
    const expected = 100;

    // Act
    const actual = calculateTotal(items);

    // Assert
    expect(actual).toBe(expected);
  });

  test("商品が複数の場合、合計金額を返すこと", () => {
    // Arrange
    const items = [{ price: 100 }, { price: 200 }, { price: 300 }];
    const expected = 600;

    // Act
    const actual = calculateTotal(items);

    // Assert
    expect(actual).toBe(expected);
  });

  test("商品が空の場合、0を返すこと", () => {
    // Arrange
    const items: Array<{ price: number }> = [];
    const expected = 0;

    // Act
    const actual = calculateTotal(items);

    // Assert
    expect(actual).toBe(expected);
  });
});
```

### Component Test Example

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  test("children が表示されること", () => {
    // Arrange
    const expected = "クリック";

    // Act
    render(<Button>{expected}</Button>);
    const actual = screen.getByRole("button", { name: expected });

    // Assert
    expect(actual).toBeInTheDocument();
  });

  test("disabled が true の場合、ボタンが無効化されること", () => {
    // Arrange & Act
    render(<Button disabled>クリック</Button>);
    const actual = screen.getByRole("button");

    // Assert
    expect(actual).toBeDisabled();
  });

  test("クリック時に onClick が呼ばれること", async () => {
    // Arrange
    const { user } = render(<Button onClick={handleClick}>クリック</Button>);
    const handleClick = vi.fn();
    const button = screen.getByRole("button");

    // Act
    await user.click(button);

    // Assert
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Shared Data Management

```typescript
import { describe, expect, test } from "vitest";
import { formatDate } from "./formatDate";

describe("formatDate", () => {
  // Shared data in top-level describe scope
  const testDate = new Date("2024-01-15T10:30:00");

  test("年月日形式でフォーマットされること", () => {
    // Arrange
    const format = "YYYY-MM-DD";
    const expected = "2024-01-15";

    // Act
    const actual = formatDate(testDate, format);

    // Assert
    expect(actual).toBe(expected);
  });

  test("時分秒を含む形式でフォーマットされること", () => {
    // Arrange
    const format = "YYYY-MM-DD HH:mm:ss";
    const expected = "2024-01-15 10:30:00";

    // Act
    const actual = formatDate(testDate, format);

    // Assert
    expect(actual).toBe(expected);
  });
});
```

### Testing Error Cases

```typescript
import { describe, expect, test } from "vitest";
import { divide } from "./divide";

describe("divide", () => {
  test("正常に除算が行われること", () => {
    // Arrange
    const a = 10;
    const b = 2;
    const expected = 5;

    // Act
    const actual = divide(a, b);

    // Assert
    expect(actual).toBe(expected);
  });

  test("0で除算した場合、エラーがスローされること", () => {
    // Arrange
    const a = 10;
    const b = 0;

    // Act & Assert
    expect(() => divide(a, b)).toThrow("Division by zero");
  });
});
```

### Bad Examples (Avoid These)

```typescript
// ❌ Nested describe blocks
describe("UserService", () => {
  describe("getUser", () => {
    describe("when user exists", () => {
      test("should return user", () => {
        // ...
      });
    });
  });
});

// ❌ Multiple assertions without object comparison
test("ユーザー情報が正しいこと", () => {
  const user = getUser();
  expect(user.name).toBe("Taro");
  expect(user.age).toBe(30);
  expect(user.email).toBe("taro@example.com");
});

// ✅ Correct: Object comparison
test("ユーザー情報が正しいこと", () => {
  // Arrange
  const expected = {
    name: "Taro",
    age: 30,
    email: "taro@example.com",
  };

  // Act
  const actual = getUser();

  // Assert
  expect(actual).toEqual(expected);
});

// ❌ Testing implementation details
test("state が更新されること", () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(0);
  act(() => result.current.increment());
  expect(result.current.count).toBe(1); // Internal state
});

// ✅ Correct: Testing behavior
test("カウンターが1増加すること", () => {
  render(<Counter />);
  const button = screen.getByRole("button", { name: "増やす" });
  const counter = screen.getByText("0");

  user.click(button);

  expect(screen.getByText("1")).toBeInTheDocument();
});

// ❌ No AAA pattern
test("合計金額を計算すること", () => {
  expect(calculateTotal([{ price: 100 }, { price: 200 }])).toBe(300);
});

// ✅ Correct: With AAA pattern
test("合計金額を計算すること", () => {
  // Arrange
  const items = [{ price: 100 }, { price: 200 }];
  const expected = 300;

  // Act
  const actual = calculateTotal(items);

  // Assert
  expect(actual).toBe(expected);
});
```

## Additional Guidelines

### Test File Naming

- Test files should be named `[ComponentName].test.tsx` or `[functionName].test.ts`
- Place test files in the same directory as the component/function being tested

### Import Organization

```typescript
// Correct order
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ComponentUnderTest } from "./ComponentUnderTest";
```

### Snapshot Testing

Use snapshots only for:
- Verifying semantic HTML structure
- Checking accessibility attributes (aria-*, role, etc.)
- Ensuring critical DOM structure remains stable

Do NOT use snapshots for:
- CSS class names or inline styles
- Testing visual appearance
- Replace proper assertions
