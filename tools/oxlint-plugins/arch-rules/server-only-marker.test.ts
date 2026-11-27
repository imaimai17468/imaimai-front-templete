import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./server-only-marker.js";

const makeLayerContext = (filename?: string) => ({
  filename,
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

/** A `Program` node holding the import declarations a module opens with. */
const programNode = (
  sources: (string | { importKind: string; value: string })[]
) => ({
  body: sources.map((source) =>
    typeof source === "string"
      ? { source: { value: source }, type: "ImportDeclaration" }
      : {
          importKind: source.importKind,
          source: { value: source.value },
          type: "ImportDeclaration",
        }
  ),
  type: "Program",
});

describe("server-only-marker", () => {
  const SERVER_ONLY = "@tanstack/react-start/server-only";

  it("should report when a gateway module opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/read.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when a gateway module carries the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/read.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when the marker arrives as a type-only import", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/read.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(
      programNode([{ importKind: "type", value: SERVER_ONLY }])
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when the module is the fn file the compiler ships to the browser", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.fn.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["@tanstack/react-start"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the module is a gateway test file", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.test.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a session module opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/session/caller.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when a session module carries the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/session/caller.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a session module names a suffix only the gateway layer exempts", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/session/read.fn.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a fn file carries the marker the compiler would ship", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.fn.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "@tanstack/react-start"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a module directly under the auth directory opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/better-auth.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["better-auth"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a sign-in module carries the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/sign-in/client.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when a sign-in module opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/sign-in/client.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when a sign-in module names the marker as a type-only import", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/sign-in/client.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(
      programNode([{ importKind: "type", value: SERVER_ONLY }])
    );

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the module sits outside every directory the rule names", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/avatar-url.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the file sits outside src", () => {
    // Arrange
    const context = makeLayerContext("/repo/scripts/smoke/smoke.entry.ts");

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors).toStrictEqual({});
  });

  it("should stay silent when the linter supplies no filename", () => {
    // Arrange
    const context = makeLayerContext();

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors).toStrictEqual({});
  });

  it("should report when a gateway module's only statements are code rather than imports", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/read.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.({
      body: [{ type: "ExpressionStatement" }],
      type: "Program",
    });

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });
});

describe("server-only-marker messages", () => {
  const SERVER_ONLY = "@tanstack/react-start/server-only";
  const GATEWAY_HINT =
    "Write the `createServerFn` declarations in a `*.fn.ts`, and put everything else in a module that file imports.";
  const AUTH_HINT =
    "`src/lib/auth/session/` is the half the server runs and `src/lib/auth/sign-in/` the half the browser runs.";

  it.each([
    {
      filename: "/repo/src/shared/gateway/user/read.ts",
      message: `A module in a \`gateway/\` directory must open with \`import "${SERVER_ONLY}";\`, so a client module importing it fails the build on this file. ${GATEWAY_HINT}`,
      name: "a gateway module opens without the marker",
      sources: ["effect"],
    },
    {
      filename: "/repo/src/shared/gateway/user/read.fn.ts",
      message: `A \`*.fn.ts\` reaches the browser, so \`import "${SERVER_ONLY}";\` here fails the client build. ${GATEWAY_HINT}`,
      name: "a fn file carries the marker",
      sources: [SERVER_ONLY],
    },
    {
      filename: "/repo/src/lib/auth/session/caller.ts",
      message: `A module under \`src/lib/auth/\` must open with \`import "${SERVER_ONLY}";\`, so a client module importing it fails the build on this file. ${AUTH_HINT}`,
      name: "a session module opens without the marker",
      sources: ["effect"],
    },
    {
      filename: "/repo/src/lib/auth/sign-in/client.ts",
      message: `A module under \`src/lib/auth/sign-in/\` reaches the browser, so \`import "${SERVER_ONLY}";\` here fails the client build. ${AUTH_HINT}`,
      name: "a sign-in module carries the marker",
      sources: [SERVER_ONLY],
    },
  ])(
    "should name the module, the fault and the fix on the program when $name",
    ({ filename, message, sources }) => {
      // Arrange
      const context = makeLayerContext(filename);
      const visitors = rule.create(context);
      const node = programNode(sources);

      // Act
      visitors.Program?.(node);

      // Assert
      expect(context.report.mock.calls).toStrictEqual([[{ message, node }]]);
    }
  );
});
