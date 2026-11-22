import { describe, expect, it } from "vite-plus/test";
import plugin from "./style-rules.js";
import noLoops from "./style-rules/no-loops.js";

describe("style-rules plugin", () => {
  it("should expose no-loops under the style-rules name when the entry module is imported", () => {
    expect(plugin).toStrictEqual({
      meta: { name: "style-rules" },
      rules: { "no-loops": noLoops },
    });
  });
});
