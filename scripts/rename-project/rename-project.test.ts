import { describe, expect, it } from "vite-plus/test";
import { isRenamedFileType, planRename } from "./rename-project.ts";
import type { TrackedFile } from "./rename-project.ts";

const MANIFEST = `{
  "name": "my-app",
  "dependencies": { "name": "my-app" }
}
`;

const SERVICE = `>()("my-app/shared/gateway/user/read/UserProfiles") {`;

const TEMPLATE: readonly TrackedFile[] = [
  { path: "package.json", text: MANIFEST },
  { path: "bun.lock", text: MANIFEST },
  { path: "src/shared/gateway/user/read.ts", text: SERVICE },
  { path: "src/routes/index/-components/home-page.tsx", text: SERVICE },
  { path: "tools/stryker/ignore-identifiers.test.ts", text: SERVICE },
  { path: "docs/src/example.ts", text: SERVICE },
  { path: "src/content/example.ts.md", text: SERVICE },
  { path: "README.md", text: "http://fix-ui.my-app.localhost:1355" },
  { path: "docs/FORKING.md", text: "nothing to rename" },
];

const renamedTo = (name: string) =>
  planRename([name], "my-app", TEMPLATE, "clean");

describe(planRename, () => {
  it("should rewrite the project's own name and leave a dependency's alone when the file is a manifest", () => {
    const plan = renamedTo("zenn-award");

    expect(plan.kind === "rename" && plan.files.slice(0, 2)).toStrictEqual([
      {
        path: "package.json",
        text: `{
  "name": "zenn-award",
  "dependencies": { "name": "my-app" }
}
`,
      },
      {
        path: "bun.lock",
        text: `{
  "name": "zenn-award",
  "dependencies": { "name": "my-app" }
}
`,
      },
    ]);
  });

  it("should rewrite a service key's leading segment when the file is one of the application's sources", () => {
    const plan = renamedTo("zenn-award");

    expect(
      plan.kind === "rename" &&
        plan.files
          .filter(({ path }) => path.startsWith("src/"))
          .map(({ text }) => text)
    ).toStrictEqual([
      `>()("zenn-award/shared/gateway/user/read/UserProfiles") {`,
      `>()("zenn-award/shared/gateway/user/read/UserProfiles") {`,
    ]);
  });

  it("should rewrite the dev server's host name when any tracked file names it", () => {
    const plan = renamedTo("zenn-award");

    expect(
      plan.kind === "rename" &&
        plan.files.find(({ path }) => path === "README.md")
    ).toStrictEqual({
      path: "README.md",
      text: "http://fix-ui.zenn-award.localhost:1355",
    });
  });

  it("should list only the files whose text changed when the rename is accepted", () => {
    const plan = renamedTo("zenn-award");

    expect(plan).toStrictEqual({
      files: [
        expect.objectContaining({ path: "package.json" }),
        expect.objectContaining({ path: "bun.lock" }),
        expect.objectContaining({ path: "src/shared/gateway/user/read.ts" }),
        expect.objectContaining({
          path: "src/routes/index/-components/home-page.tsx",
        }),
        expect.objectContaining({ path: "README.md" }),
      ],
      from: "my-app",
      kind: "rename",
      to: "zenn-award",
    });
  });

  it.each([
    ["no name is given", []],
    ["more than one name is given", ["zenn", "award"]],
  ])("should print the usage when %s", (_label, argv) => {
    expect(planRename(argv, "my-app", TEMPLATE, "clean")).toStrictEqual({
      kind: "rejected",
      reason: "usage: bun run rename-project <name>",
    });
  });

  it.each([
    ["Zenn", "Zenn: use lowercase letters, digits and single hyphens"],
    [
      "zenn--award",
      "zenn--award: use lowercase letters, digits and single hyphens",
    ],
    ["-zenn", "-zenn: use lowercase letters, digits and single hyphens"],
    [
      "zenn/award",
      "zenn/award: use lowercase letters, digits and single hyphens",
    ],
    ["a".repeat(64), `${"a".repeat(64)}: use at most 63 characters`],
    ["my-app", "my-app: the project is already named my-app"],
  ])(
    "should refuse the name with its reason when the name is %s",
    (name, reason) => {
      expect(planRename([name], "my-app", TEMPLATE, "clean")).toStrictEqual({
        kind: "rejected",
        reason,
      });
    }
  );

  it("should accept the name when it is exactly as long as a host name label allows", () => {
    expect(planRename(["a".repeat(63)], "my-app", TEMPLATE, "clean").kind).toBe(
      "rename"
    );
  });

  it("should name every problem the name has when it has more than one", () => {
    const name = "A".repeat(64);

    expect(planRename([name], "my-app", TEMPLATE, "clean")).toStrictEqual({
      kind: "rejected",
      reason: `${name}: use lowercase letters, digits and single hyphens; use at most 63 characters`,
    });
  });

  it("should refuse to rename when the working tree holds uncommitted changes", () => {
    expect(
      planRename(["zenn-award"], "my-app", TEMPLATE, "dirty")
    ).toStrictEqual({
      kind: "rejected",
      reason: "commit or stash your changes before renaming",
    });
  });

  it("should refuse to rename when package.json names the project with a name this command cannot match", () => {
    expect(
      planRename(["zenn-award"], "My App", TEMPLATE, "clean")
    ).toStrictEqual({
      kind: "rejected",
      reason:
        "package.json names the project My App, which this command cannot rename",
    });
  });

  it("should leave an import alone when its package shares the project's name", () => {
    const plan = planRename(
      ["next-app"],
      "void",
      [
        {
          path: "src/a.ts",
          text: 'import { db } from "void/db";\n>()("void/a/A") {',
        },
      ],
      "clean"
    );

    expect(plan.kind === "rename" && plan.files).toStrictEqual([
      {
        path: "src/a.ts",
        text: 'import { db } from "void/db";\n>()("next-app/a/A") {',
      },
    ]);
  });

  it("should rewrite the dev host only when the old name stands alone before .localhost", () => {
    const plan = planRename(
      ["next-app"],
      "app",
      [
        {
          path: "README.md",
          text: "http://webapp.localhost http://fix-ui.app.localhost http://app.localhost",
        },
      ],
      "clean"
    );

    expect(plan.kind === "rename" && plan.files).toStrictEqual([
      {
        path: "README.md",
        text: "http://webapp.localhost http://fix-ui.next-app.localhost http://next-app.localhost",
      },
    ]);
  });
});

describe(isRenamedFileType, () => {
  it.each([
    ["README.md", true],
    ["bun.lock", true],
    ["scripts/setup/setup.sh", true],
    [".claude/skills/web-security-audit/scripts/validate.cjs", true],
    [".github/workflows/ci.yml", true],
    ["public/favicon.svg", false],
    ["public/readme.md.png", false],
    ["public/logo.png", false],
  ])(
    "should answer whether to scan %s when deciding which files the rename reads",
    (path, expected) => {
      expect(isRenamedFileType(path)).toBe(expected);
    }
  );
});
