import { describe, expect, it } from "vitest";
import { classifyLayer, buildGraph } from "./build-graph";

describe("classifyLayer", () => {
  it("should return route when given a route file path", () => {
    expect(classifyLayer("src/routes/__root.tsx")).toBe("route");
  });

  it("should return route when given an API route path", () => {
    expect(classifyLayer("src/routes/api/auth.$.ts")).toBe("route");
  });

  it("should return component when given a UI component path", () => {
    expect(classifyLayer("src/components/ui/button.tsx")).toBe("component");
  });

  it("should return component when given a shared component path", () => {
    expect(classifyLayer("src/components/shared/header/Header.tsx")).toBe(
      "component"
    );
  });

  it("should return server when given a server function path", () => {
    expect(classifyLayer("src/server/fn/user.ts")).toBe("server");
  });

  it("should return gateway when given a gateway path", () => {
    expect(classifyLayer("src/gateways/user/index.ts")).toBe("gateway");
  });

  it("should return entity when given an entity path", () => {
    expect(classifyLayer("src/entities/user/index.ts")).toBe("entity");
  });

  it("should return lib when given a lib path", () => {
    expect(classifyLayer("src/lib/auth.ts")).toBe("lib");
  });

  it("should return lib when given a utils path", () => {
    expect(classifyLayer("src/lib/utils.ts")).toBe("lib");
  });

  it("should return test when given a test directory path", () => {
    expect(classifyLayer("src/test/router-utils.tsx")).toBe("test");
  });

  it("should return test when given a test-setup path", () => {
    expect(classifyLayer("src/test-setup.ts")).toBe("test");
  });

  it("should return config when given a top-level src file", () => {
    expect(classifyLayer("src/client.tsx")).toBe("config");
  });

  it("should return config when given the router entry", () => {
    expect(classifyLayer("src/router.tsx")).toBe("config");
  });

  it("should return config when given the ssr entry", () => {
    expect(classifyLayer("src/ssr.tsx")).toBe("config");
  });
});

describe("buildGraph", () => {
  it("should produce a graph with version 1 when called", () => {
    expect(buildGraph().version).toBe(1);
  });

  it("should include a valid ISO timestamp when generated", () => {
    expect(buildGraph().generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should include at least one node when parsing the codebase", () => {
    expect(Object.keys(buildGraph().nodes).length).toBeGreaterThan(0);
  });

  it("should resolve @/ alias imports when parsing __root.tsx", () => {
    const root = buildGraph().nodes["src/routes/__root.tsx"];
    expect(root).toBeDefined();
  });

  it("should include user.ts in __root imports when resolving aliases", () => {
    expect(buildGraph().nodes["src/routes/__root.tsx"].imports).toContain(
      "src/server/fn/user.ts"
    );
  });

  it("should include Header.tsx in __root imports when resolving aliases", () => {
    expect(buildGraph().nodes["src/routes/__root.tsx"].imports).toContain(
      "src/components/shared/header/Header.tsx"
    );
  });

  it("should populate imported_by on user.ts when __root imports it", () => {
    expect(buildGraph().nodes["src/server/fn/user.ts"].imported_by).toContain(
      "src/routes/__root.tsx"
    );
  });

  it("should only contain src/ paths in imports when excluding externals", () => {
    const graph = buildGraph();
    Object.values(graph.nodes).forEach((node) => {
      node.imports.forEach((imp) => {
        expect(imp).toMatch(/^src\//);
      });
    });
  });

  it("should exclude routeTree.gen.ts when filtering generated files", () => {
    expect(buildGraph().nodes["src/routeTree.gen.ts"]).toBeUndefined();
  });

  it("should exclude env.d.ts when filtering declaration files", () => {
    expect(buildGraph().nodes["src/env.d.ts"]).toBeUndefined();
  });
});
