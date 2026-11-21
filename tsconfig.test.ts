// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { EFFECT_LAYERS } from "./oxlint.project.ts";

const ROOT = import.meta.dirname;

const readText = (file: string): string =>
  fs.readFileSync(path.join(ROOT, file), "utf-8");

const Severities = Schema.Record(Schema.String, Schema.String);

const Override = Schema.Struct({
  include: Schema.Array(Schema.String),
  options: Schema.Struct({ diagnosticSeverity: Severities }),
});

const decodeTsConfig = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      compilerOptions: Schema.Struct({
        plugins: Schema.Tuple([
          Schema.Struct({
            diagnosticSeverity: Severities,
            overrides: Schema.Array(Override),
          }),
        ]),
      }),
    })
  )
);

const [plugin] = decodeTsConfig(readText("tsconfig.json")).compilerOptions
  .plugins;

const overrideIncluding = (glob: string) =>
  plugin.overrides.find(({ include }) => include.includes(glob));

const decodePluginSchema = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      definitions: Schema.Struct({
        effectLanguageServicePluginDiagnosticSeverityDefinition: Schema.Struct({
          properties: Schema.Record(
            Schema.String,
            Schema.Record(Schema.String, Schema.Unknown)
          ),
        }),
      }),
    })
  )
);

const decidedRules = new Set(Object.keys(plugin.diagnosticSeverity));

const knownRules = new Set(
  Object.keys(
    decodePluginSchema(readText("node_modules/@effect/tsgo/schema.json"))
      .definitions.effectLanguageServicePluginDiagnosticSeverityDefinition
      .properties
  )
);

// A rule an @effect/tsgo upgrade adds arrives at its own default, which is
// often off, so the base map names every rule to keep each one decided here.
describe("the Effect diagnostics in tsconfig.json", () => {
  it("should name every rule the installed @effect/tsgo knows when it is upgraded", () => {
    expect(
      [...knownRules].filter((rule) => !decidedRules.has(rule))
    ).toStrictEqual([]);
  });

  it("should name no rule the installed @effect/tsgo has dropped when it is upgraded", () => {
    expect(
      [...decidedRules].filter((rule) => !knownRules.has(rule))
    ).toStrictEqual([]);
  });
});

// An entity may import only `Schema` from Effect, so the rules that ask for
// the rest of Effect reach its tests alone.
const effectNativeGlobs = (layer: string) =>
  layer.includes("-entities") || layer.includes("/entities/")
    ? [`${layer}/*.test.ts`]
    : [`${layer}/*.ts`, `${layer}/*.tsx`];

describe("the overrides in tsconfig.json", () => {
  it("should raise the Effect-native rules in exactly the layers oxlint.project.ts lets import Effect when a layer is added or removed", () => {
    expect(
      overrideIncluding("src/lib/**/*.ts")?.include.toSorted()
    ).toStrictEqual(EFFECT_LAYERS.flatMap(effectNativeGlobs).toSorted());
  });

  it("should lower every rule in shadcn output when a rule is added", () => {
    expect(
      overrideIncluding("src/shared/ui/**/*.tsx")?.options.diagnosticSeverity
    ).toStrictEqual(
      Object.fromEntries([...decidedRules].map((rule) => [rule, "suggestion"]))
    );
  });
});
