import { describe, expect, it } from "vite-plus/test";
import plugin from "./start-rules.js";
import noRewrittenFactoryInHandler from "./start-rules/no-rewritten-factory-in-handler.js";

describe("start-rules", () => {
  it("should expose each rule module under its rule key when the plugin named start-rules is loaded", () => {
    expect(plugin).toStrictEqual({
      meta: { name: "start-rules" },
      rules: {
        "no-rewritten-factory-in-handler": noRewrittenFactoryInHandler,
      },
    });
  });
});
