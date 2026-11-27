import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./no-app-module-mock.js";

const makeContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

interface MockArgumentFixture {
  type: string;
  value?: string | number;
  source?: MockArgumentFixture;
}

/** A call node carrying the fields `no-app-module-mock` reads. */
interface MockCallFixture {
  arguments: MockArgumentFixture[];
  callee: {
    type: string;
    name?: string;
    object?: { name: string; type: string };
    property?: { name: string; type: string };
  };
  type: string;
}

const literal = (value: string | number): MockArgumentFixture => ({
  type: "Literal",
  value,
});

const viCall = (
  method: string,
  args: MockArgumentFixture[]
): MockCallFixture => ({
  arguments: args,
  callee: {
    object: { name: "vi", type: "Identifier" },
    property: { name: method, type: "Identifier" },
    type: "MemberExpression",
  },
  type: "CallExpression",
});

const reportCount = (node: MockCallFixture) => {
  const context = makeContext();
  rule.create(context).CallExpression(node);
  return context.report.mock.calls.length;
};

describe("no-app-module-mock", () => {
  it.each([
    { args: [literal("./client")], method: "mock", name: "a relative path" },
    { args: [literal("../client")], method: "mock", name: "a parent path" },
    { args: [literal("@/lib/auth")], method: "doMock", name: "an alias path" },
    {
      args: [{ source: literal("./client"), type: "ImportExpression" }],
      method: "mock",
      name: "an import() of a relative path",
    },
  ])("should report when vi.$method names $name", ({ args, method }) => {
    expect(reportCount(viCall(method, args))).toBe(1);
  });

  it.each([
    { args: [literal("react-grab")], method: "mock", name: "a package" },
    {
      args: [literal("react-grab/./core")],
      method: "mock",
      name: "a package subpath holding a relative segment",
    },
    { args: [literal("./client")], method: "spyOn", name: "a spy" },
    { args: [], method: "mock", name: "no argument" },
    { args: [literal(1)], method: "mock", name: "a non-string literal" },
    {
      args: [{ type: "TemplateLiteral" }],
      method: "mock",
      name: "a non-literal",
    },
  ])("should not report when the call is $name", ({ args, method }) => {
    expect(reportCount(viCall(method, args))).toBe(0);
  });

  it("should report the module and the fix on the call when vi.mock names an app module", () => {
    const context = makeContext();
    const node = viCall("mock", [literal("./client")]);

    rule.create(context).CallExpression(node);

    expect(context.report.mock.calls).toStrictEqual([
      [
        {
          message:
            "'./client' is an app module, and test files share a worker's module cache (isolate: false), so this mock does nothing once another file has loaded it. Pass the dependency in as an argument instead.",
          node,
        },
      ],
    ]);
  });

  it("should not report when the callee is not a member of vi", () => {
    expect(
      reportCount({
        arguments: [literal("./client")],
        callee: {
          object: { name: "jest", type: "Identifier" },
          property: { name: "mock", type: "Identifier" },
          type: "MemberExpression",
        },
        type: "CallExpression",
      })
    ).toBe(0);
  });

  it("should not report when the callee is a plain function", () => {
    expect(
      reportCount({
        arguments: [literal("./client")],
        callee: { name: "mock", type: "Identifier" },
        type: "CallExpression",
      })
    ).toBe(0);
  });
});
