import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./layer-boundaries.js";

const makeLayerContext = (filename?: string) => ({
  filename,
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

// A non-string source is what the rule's own guard rejects, so the fixture
// has to be able to produce one.
type ImportSource = string | number;

const importNode = (specifier: ImportSource, importedNames: string[] = []) => ({
  source: { value: specifier },
  specifiers: importedNames.map((name) => ({
    imported: { name, type: "Identifier" },
    type: "ImportSpecifier",
  })),
});

describe("layer-boundaries", () => {
  it("should not report when a route imports a gateway via alias", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/_authed/profile/route.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/user/read.fn"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it.each(["void/db", "void/storage", "void/env", "@schema", "@schema/users"])(
    "should report when a route imports %s",
    (specifier) => {
      // Arrange
      const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).toHaveBeenCalledOnce();
    }
  );

  it("should report when a route imports the session adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports a module inside the session directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session/caller"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports Cloudflare Workers directly", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("cloudflare:workers"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports getRequest from TanStack Start", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@tanstack/react-start/server", ["getRequest"])
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each([
    "/repo/src/shared/components/header/header.tsx",
    "/repo/src/routes/login/-components/sign-in-button.tsx",
    "/repo/src/shared/ui/button.tsx",
  ])(
    "should report when the component at %s imports the database client",
    (filename) => {
      // Arrange
      const context = makeLayerContext(filename);
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode("void/db"));

      // Assert
      expect(context.report).toHaveBeenCalledOnce();
    }
  );

  it("should report when a component imports Cloudflare Workers directly", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/components/header/header.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("cloudflare:workers"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a component imports an entity", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/_authed/profile/-components/profile-page.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/entities/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it.each(["@/lib/auth/better-auth", "@/lib/auth/sign-in"])(
    "should allow the auth adapter %s when a route imports it",
    (specifier) => {
      // Arrange
      const context = makeLayerContext("/repo/src/routes/login/route.tsx");
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).not.toHaveBeenCalled();
    }
  );

  it.each([
    "@/lib/auth/session",
    "void/storage",
    "cloudflare:workers",
    "@tanstack/react-start/server",
  ])("should report when a route dynamically imports %s", (specifier) => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportExpression?.(importNode(specifier));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each([
    "/repo/src/shared/gateway/user/read.fn.ts",
    "/repo/src/routes/login/-gateway/read.ts",
  ])("should report when the gateway at %s imports a route", (filename) => {
    // Arrange
    const context = makeLayerContext(filename);
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/login/route"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a gateway imports a component", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/ui/button"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a gateway imports the session adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a gateway imports the storage client", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/avatar/index.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("void/storage"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a gateway imports an entity", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/entities/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a gateway imports a bare package specifier", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("effect"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it.each([
    "/repo/src/shared/entities/user/index.ts",
    "/repo/src/routes/login/-entities/plan.ts",
  ])("should report when the entity at %s imports a gateway", (filename) => {
    // Arrange
    const context = makeLayerContext(filename);
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports the routes directory itself", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports the lib directory itself", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports an adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/utils"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each(["void/db", "void/storage", "void/env", "@schema"])(
    "should report when an entity imports %s",
    (specifier) => {
      // Arrange
      const context = makeLayerContext(
        "/repo/src/shared/entities/user/index.ts"
      );
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).toHaveBeenCalledOnce();
    }
  );

  it("should report when an entity imports a route", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/login/route"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports a component", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/components/header"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a gateway imports a sibling gateway", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.fn.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/runtime"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it.each([
    "@/routes/login/route",
    "@/shared/gateway/user",
    "@/shared/ui/button",
  ])("should report when an adapter imports %s", (specifier) => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/storage/r2.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode(specifier));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an adapter in a ui directory imports a gateway", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/ui/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an adapter imports a gateway via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/storage/r2.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../shared/gateway/runtime"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each(["@/lib/memoize-value", "@/shared/entities/user"])(
    "should not report when an adapter imports %s",
    (specifier) => {
      // Arrange
      const context = makeLayerContext("/repo/src/lib/storage/r2.ts");
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).not.toHaveBeenCalled();
    }
  );

  it("should report when a route imports the session adapter via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../lib/auth/session"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports a banned specifier carrying the coverage suffix", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session.entry"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a route imports a module whose trailing segment is not a coverage suffix", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session.helpers"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a route imports a banned relative specifier carrying the coverage suffix", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../lib/auth/session.entry"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports another route's private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@/routes/index/-components/code-block/code-block")
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a layout route imports a nested route's private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/_authed/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@/routes/_authed/profile/-components/profile-page")
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a shared component imports a route's private directory", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/components/header/header.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@/routes/login/-components/sign-in-button")
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a route imports its own private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./-components/sign-in-button"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the root route imports the private directory beside it", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/__root.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./-components/root-layout"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a nested route imports the root route's private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/-components/not-found"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should name the root route's own level when it reports a reach into it", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/-components/not-found"));

    // Assert
    expect(context.report.mock.calls[0]?.[0].message).toBe(
      "A `-` directory is private to the route files directly in `src/routes/`. A second route reaching this module makes it shared, so move it to `src/shared/`."
    );
  });

  it("should not report when a module in the root route's private directory imports its sibling", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/-components/root-layout.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./not-found"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a module inside a private directory imports its sibling", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/_authed/profile/-components/profile-form/profile-form.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../profile-page"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a route imports a dash-prefixed file beside it", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./-avatars.test"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a route imports a sibling route via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../index/route"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a relative path escapes the src directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../../tools/helper"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when importing a bare package specifier", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("react"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should return no visitors when the file is outside src", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/tools/oxlint-plugins/arch-rules.js"
    );

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ImportDeclaration).toBeUndefined();
  });

  it("should return no visitors when the file is not in a chain layer", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/router.tsx");

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ImportDeclaration).toBeUndefined();
  });

  it("should return no visitors when filename is unavailable", () => {
    // Arrange
    const context = makeLayerContext();

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ImportDeclaration).toBeUndefined();
  });

  it("should report when a banned module is re-exported via export-from", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.(importNode("void/db"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a banned module is re-exported via export-all", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportAllDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when an export declaration has no source", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({ source: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the import source value is not a string", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode(42));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});
