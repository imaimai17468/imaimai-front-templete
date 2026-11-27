import { describe, expect, it } from "vite-plus/test";
import { mutateCommand, mutationTargets } from "./mutation-targets.ts";

describe(mutationTargets, () => {
  it.each([
    "src/shared/gateway/user/read.ts",
    "scripts/rename-project/rename-project.ts",
    "tools/oxlint-plugins/arch-rules/layers.js",
    ".claude/hooks/pre-bash-guard/pre-bash-guard-decision.ts",
    ".github/scripts/mutation-gate/mutation-gate.ts",
  ])(
    "should mutate %s when it is a module the coverage gate measures",
    (file) => {
      expect(mutationTargets([file])).toStrictEqual([file]);
    }
  );

  it.each([
    ["a test", "src/shared/gateway/user/read.test.ts"],
    [
      "a test under .github",
      ".github/scripts/mutation-gate/mutation-gate.test.ts",
    ],
    ["page copy", "src/routes/index/-components/home-page.content.ts"],
    ["a component", "src/routes/index/-components/home-page.tsx"],
    ["a command's entry", "scripts/smoke/smoke.entry.ts"],
    ["a generated file", "src/routeTree.gen.ts"],
    ["a test helper", "src/test/local-bindings.ts"],
    ["a file outside the measured roots", "db/schema.ts"],
  ])("should leave %s unmutated when the file is %s", (_label, file) => {
    expect(mutationTargets([file])).toStrictEqual([]);
  });
});

describe(mutateCommand, () => {
  const TRACKED = ["src/lib/utils.ts", "src/lib/utils.test.ts", "db/schema.ts"];

  it("should mutate every mutated tracked file when the command names none", () => {
    expect(mutateCommand([], TRACKED)).toStrictEqual({
      args: ["run", "src/lib/utils.ts"],
      kind: "run",
    });
  });

  it("should mutate the named mutated files and pass the flags through when the command names files", () => {
    expect(
      mutateCommand(
        ["--json", "src/shared/gateway/user/read.ts", "db/schema.ts"],
        TRACKED
      )
    ).toStrictEqual({
      args: ["run", "src/shared/gateway/user/read.ts", "--json"],
      kind: "run",
    });
  });

  it("should mutate every mutated tracked file and pass the flags through when the command passes flags alone", () => {
    expect(mutateCommand(["--json"], TRACKED)).toStrictEqual({
      args: ["run", "src/lib/utils.ts", "--json"],
      kind: "run",
    });
  });

  it("should run nothing when no named file is mutated", () => {
    expect(mutateCommand(["db/schema.ts"], TRACKED)).toStrictEqual({
      kind: "nothing",
      reason: "None of these files is mutated, so there is nothing to run.",
    });
  });
});
