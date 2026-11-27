import { describe, expect, it } from "vite-plus/test";
import { isTestStem, srcPathOf, stripSourceExtension } from "./file-paths.js";

describe(srcPathOf, () => {
  it("should return the path from src down when the file sits under src", () => {
    // Act
    const srcPath = srcPathOf({ filename: "/repo/src/routes/login/route.tsx" });

    // Assert
    expect(srcPath).toBe("src/routes/login/route.tsx");
  });

  it("should return null when the file sits outside src", () => {
    // Act
    const srcPath = srcPathOf({
      filename: "/repo/tools/oxlint-plugins/arch-rules.js",
    });

    // Assert
    expect(srcPath).toBeNull();
  });
});

describe(stripSourceExtension, () => {
  it.each([
    ["src/routes/login/route.tsx", "src/routes/login/route"],
    ["src/lib/env.ts", "src/lib/env"],
    ["src/shared/ui/button.jsx", "src/shared/ui/button"],
    ["tools/oxlint-plugins/arch-rules.js", "tools/oxlint-plugins/arch-rules"],
  ])("should strip the source extension when the path is %s", (path, stem) => {
    // Act
    const stripped = stripSourceExtension(path);

    // Assert
    expect(stripped).toBe(stem);
  });

  it("should leave a path unchanged when it does not end in a source extension", () => {
    // Act
    const stripped = stripSourceExtension("src/routes/api/messages.json");

    // Assert
    expect(stripped).toBe("src/routes/api/messages.json");
  });
});

describe(isTestStem, () => {
  it.each(["src/lib/env.test", "src/lib/env.spec"])(
    "should count the stem as a test when it is %s",
    (stem) => {
      // Act
      const isTest = isTestStem(stem);

      // Assert
      expect(isTest).toBeTruthy();
    }
  );

  it("should not count the stem as a test when its name continues past .test", () => {
    // Act
    const isTest = isTestStem("src/lib/env.test-utils");

    // Assert
    expect(isTest).toBeFalsy();
  });
});
