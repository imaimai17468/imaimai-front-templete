import { describe, expect, it } from "vite-plus/test";
import plugin from "./arch-rules.js";
import componentFileNaming from "./arch-rules/component-file-naming.js";
import layerBoundaries from "./arch-rules/layer-boundaries.js";
import noAppModuleMock from "./arch-rules/no-app-module-mock.js";
import noSizeProps from "./arch-rules/no-size-props.js";
import routeImportsItsComponent from "./arch-rules/route-imports-its-component.js";
import serverOnlyMarker from "./arch-rules/server-only-marker.js";

describe("arch-rules", () => {
  it("should expose each rule module under its rule key when the plugin named arch-rules is loaded", () => {
    expect(plugin).toStrictEqual({
      meta: { name: "arch-rules" },
      rules: {
        "component-file-naming": componentFileNaming,
        "layer-boundaries": layerBoundaries,
        "no-app-module-mock": noAppModuleMock,
        "no-size-props": noSizeProps,
        "route-imports-its-component": routeImportsItsComponent,
        "server-only-marker": serverOnlyMarker,
      },
    });
  });
});
