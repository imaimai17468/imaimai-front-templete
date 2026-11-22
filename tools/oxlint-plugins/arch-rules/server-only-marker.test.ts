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
});
