// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { EFFECT_LAYERS } from "./vite.config.ts";

const ROOT = import.meta.dirname;

const readJson = <S extends z.ZodType>(file: string, schema: S): z.infer<S> =>
  schema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf-8")));

const Severities = z.record(z.string(), z.string());

const Override = z.object({
  include: z.array(z.string()),
  options: z.object({ diagnosticSeverity: Severities }),
});

const TsConfig = z.object({
  compilerOptions: z.object({
    plugins: z.tuple([
      z.object({
        diagnosticSeverity: Severities,
        overrides: z.array(Override),
      }),
    ]),
  }),
});

const [plugin] = readJson("tsconfig.json", TsConfig).compilerOptions.plugins;

const overrideIncluding = (glob: string) =>
  plugin.overrides.find(({ include }) => include.includes(glob));

const PluginSchema = z.object({
  definitions: z.object({
    effectLanguageServicePluginDiagnosticSeverityDefinition: z.object({
      properties: z.record(z.string(), z.looseObject({})),
    }),
  }),
});

const decidedRules = new Set(Object.keys(plugin.diagnosticSeverity));

const knownRules = new Set(
  Object.keys(
    readJson("node_modules/@effect/tsgo/schema.json", PluginSchema).definitions
      .effectLanguageServicePluginDiagnosticSeverityDefinition.properties
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
  it("should raise the Effect-native rules in exactly the layers vite.config.ts lets import Effect when a layer is added or removed", () => {
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
