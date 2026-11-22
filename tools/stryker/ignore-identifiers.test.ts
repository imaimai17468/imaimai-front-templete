import { parseSync, traverse } from "@babel/core";
import { describe, expect, it } from "vite-plus/test";
import {
  IGNORER_NAME,
  reasonToIgnore,
  strykerPlugins,
} from "./ignore-identifiers.ts";

const parseTypeScript = (source: string) => {
  const file = parseSync(source, {
    babelrc: false,
    configFile: false,
    filename: "module.ts",
    parserOpts: { plugins: ["typescript"] },
  });
  if (file === null) {
    throw new Error("Babel returned no syntax tree");
  }
  return file;
};

const reasonsByLiteral = (source: string) => {
  const reasons = new Map<string, string | undefined>();
  traverse(parseTypeScript(source), {
    StringLiteral(path) {
      reasons.set(path.node.value, reasonToIgnore(path));
    },
  });
  return reasons;
};

describe("ignore-identifiers", () => {
  it("should ignore the literal when it names an Effect.fn span", () => {
    const reasons = reasonsByLiteral(
      'const read = Effect.fn("Reader.read")(function* () {});'
    );
    expect(reasons.get("Reader.read")).toContain("Effect.fn span name");
  });

  it.each([
    [
      "declaration",
      'class Reader extends Context.Service<Reader, { read: number }>()("my-app/Reader") {}',
    ],
    [
      "expression",
      'const Reader = class extends Context.Service<Reader, {}>()("my-app/Reader") {};',
    ],
  ])(
    "should ignore the literal when it keys a service class %s",
    (_, source) => {
      expect(reasonsByLiteral(source).get("my-app/Reader")).toContain(
        "Service key"
      );
    }
  );

  it.each([
    [
      "a tagged error tag",
      'class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}',
      "Missing",
    ],
    ["a string outside any call", 'const tag = "loose";', "loose"],
    [
      "the second argument of Effect.fn",
      'Effect.fn(span, "second");',
      "second",
    ],
    ["a fn call on another object", 'Stream.fn("other")(gen);', "other"],
    ["a bare fn call", 'fn("bare")(gen);', "bare"],
    ["a computed Effect member", 'Effect["fn"]("computed")(gen);', "computed"],
    [
      "a service call outside a class",
      'const key = Context.Service<Reader, {}>()("my-app/Loose");',
      "my-app/Loose",
    ],
    [
      "a service call that is not the superclass",
      'class Reader extends Base { key = Context.Service<Reader, {}>()("my-app/Field"); }',
      "my-app/Field",
    ],
    [
      "a key passed to a plain call",
      'class Reader extends make()("my-app/Plain") {}',
      "my-app/Plain",
    ],
  ])("should keep the literal mutable when it is %s", (_, source, literal) => {
    expect([...reasonsByLiteral(source)]).toContainEqual([literal, undefined]);
  });

  it("should keep the node mutable when it is a template literal", () => {
    const reasons: (string | undefined)[] = [];
    traverse(parseTypeScript("Effect.fn(`span`)(gen);"), {
      TemplateLiteral(path) {
        reasons.push(reasonToIgnore(path));
      },
    });
    expect(reasons).toStrictEqual([undefined]);
  });

  it("should declare one ignorer when Stryker loads the module", () => {
    expect(strykerPlugins).toStrictEqual([
      {
        kind: "Ignore",
        name: IGNORER_NAME,
        value: { shouldIgnore: reasonToIgnore },
      },
    ]);
  });
});
