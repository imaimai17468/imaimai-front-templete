import type { DummyRuleMap } from "oxlint";
import type { recommended } from "oxlint-plugin-effect/presets/recommended";

// `complexity` is the one entry the preset does not namespace, and
// `vite.config.ts` already sets it for every file.
type EffectRuleName = Exclude<keyof typeof recommended, "complexity">;

/**
 * Every rule `presets.recommended` carries, at the severity the preset chose or
 * off.
 *
 * `satisfies` over the preset's own key union is what makes a rule the preset
 * adds or renames fail to compile here, rather than arrive silently enabled or
 * leave a dead key behind.
 *
 * The nine set to `"off"` are the ones `src/` reports today. `noNullish` is the
 * gateways answering `A | null` where the rule wants `Option`, and
 * `noAsyncFunction` is the Promise boundary `createServerFn` requires; turning
 * one on means fixing what it reports.
 */
export const effectRules = {
  "effect/maxCognitiveComplexity": ["error", { max: 21 }],
  "effect/maxHalsteadDifficulty": ["error", { max: 79 }],
  "effect/noAs": "error",
  "effect/noAsyncFunction": "off",
  "effect/noChainedTypeAssertions": "error",
  "effect/noConditionalEmptyObjectSpread": "error",
  "effect/noDynamicImports": "error",
  "effect/noEffectBind": "error",
  "effect/noEffectDo": "error",
  "effect/noGlobals": "off",
  "effect/noInlineProvide": "error",
  "effect/noKnownValueWidening": "error",
  "effect/noManagedRuntimeInEffect": "error",
  "effect/noModuleMocks": "error",
  "effect/noNestedEffectGen": "error",
  "effect/noNewError": "error",
  "effect/noNewPromise": "error",
  "effect/noNodeBuiltinImport": "error",
  "effect/noNullish": "off",
  "effect/noObjectParameters": "error",
  "effect/noPerCallCacheConstruction": "error",
  "effect/noRunCollectOnUnboundedStream": "error",
  "effect/noRuntimeTypeof": "error",
  "effect/noSequentialEffectAll": "error",
  "effect/noShapeInSymbolNames": "error",
  "effect/noSilentCatchAll": "error",
  "effect/noTernary": "off",
  "effect/noTestLifecycleHooks": "error",
  "effect/noThrowStatement": "error",
  "effect/noTryCatch": "error",
  "effect/noUnboundedConcurrency": "error",
  "effect/noUnboundedRetry": "error",
  "effect/noUnknownParameters": "error",
  "effect/noUnknownTypeAliases": "error",
  "effect/noUnsafeDictionaryType": "error",
  "effect/noWidenThenAssert": "error",
  "effect/preferCatchTag": "error",
  "effect/preferEffectFn": "error",
  "effect/preferMatchTagsExhaustive": "error",
  "effect/preferPredicateIsTagged": "error",
  "effect/preferServiceOf": "error",
  "effect/requireNamedEffectFn": "error",
} satisfies Record<EffectRuleName, DummyRuleMap[string]>;
