/**
 * Vite+ bundles exact versions of the tools it drives, and Void depends on the
 * Drizzle this project's code shares with it. This project restates those
 * versions so each package resolves one copy, and a dependency bump that moves
 * one side without the other splits the graph the restatement exists to keep
 * single. This compares the two sides and fails on every disagreement.
 */
import vitePlus from "../node_modules/vite-plus/package.json" with { type: "json" };
import voidPackage from "../node_modules/void/package.json" with { type: "json" };
import manifest from "../package.json" with { type: "json" };

const CORE = "@voidzero-dev/vite-plus-core";

interface Pin {
  readonly bundled: string | undefined;
  readonly declared: string | undefined;
  readonly label: string;
  /** The package whose version `bundled` was read from. */
  readonly source: string;
}

/**
 * `=1.2.3` and `1.2.3` are the same exact pin, and vite-plus writes the first
 * form. `^` and `~` survive, so a range never equals the bundled version and
 * the comparison rejects it: a range lets a second copy of the tool into the
 * graph, which is the thing this check exists to prevent.
 */
const exactVersionOf = (spec: string | undefined): string | undefined =>
  spec?.replace(/^=/u, "");

const coreVersionOf = (spec: string | undefined): string | undefined =>
  spec?.replace(`npm:${CORE}@`, "");

/**
 * Void's `^0.45.4` resolves to the direct `0.45.4` only while that is its
 * floor, so the floor is what the direct pin has to equal.
 */
const floorVersionOf = (spec: string | undefined): string | undefined =>
  spec?.replace(/^\^/u, "");

const { dependencies: bundled, version: bundledVersion } = vitePlus;
const {
  dependencies: declaredRuntime,
  devDependencies: declared,
  overrides,
} = manifest;
const VITE_PLUS = `vite-plus ${bundledVersion}`;
const VOID = `void ${voidPackage.version}`;

const PINS: readonly Pin[] = [
  {
    bundled: coreVersionOf(bundled.vite),
    declared: coreVersionOf(declared.vite),
    label: "devDependencies.vite (alias to vite-plus core)",
    source: VITE_PLUS,
  },
  {
    bundled: coreVersionOf(bundled.vite),
    declared: coreVersionOf(overrides.vite),
    label: "overrides.vite (alias to vite-plus core)",
    source: VITE_PLUS,
  },
  {
    bundled: exactVersionOf(bundled.vitest),
    declared: exactVersionOf(overrides.vitest),
    label: "overrides.vitest",
    source: VITE_PLUS,
  },
  {
    bundled: exactVersionOf(bundled.vitest),
    declared: exactVersionOf(declared.vitest),
    label: "devDependencies.vitest",
    source: VITE_PLUS,
  },
  {
    bundled: exactVersionOf(bundled.vitest),
    declared: exactVersionOf(declared["@vitest/coverage-v8"]),
    label: "devDependencies.@vitest/coverage-v8",
    source: VITE_PLUS,
  },
  {
    bundled: exactVersionOf(bundled.oxlint),
    declared: exactVersionOf(declared.oxlint),
    label: "devDependencies.oxlint",
    source: VITE_PLUS,
  },
  {
    bundled: exactVersionOf(bundled.oxfmt),
    declared: exactVersionOf(declared.oxfmt),
    label: "devDependencies.oxfmt",
    source: VITE_PLUS,
  },
  {
    bundled: exactVersionOf(bundled["oxlint-tsgolint"]),
    declared: exactVersionOf(declared["oxlint-tsgolint"]),
    label: "devDependencies.oxlint-tsgolint",
    source: VITE_PLUS,
  },
  {
    bundled: floorVersionOf(voidPackage.dependencies["drizzle-orm"]),
    declared: exactVersionOf(declaredRuntime["drizzle-orm"]),
    label: "dependencies.drizzle-orm",
    source: VOID,
  },
  {
    bundled: exactVersionOf(declared["@cloudflare/workers-types"]),
    declared: exactVersionOf(overrides["@cloudflare/workers-types"]),
    label: "overrides.@cloudflare/workers-types",
    source: "devDependencies.@cloudflare/workers-types",
  },
];

const mismatches = PINS.filter((pin) => pin.bundled !== pin.declared);

if (mismatches.length > 0) {
  const lines = mismatches
    .map(
      (pin) =>
        `  ${pin.label}: declared ${String(pin.declared)}, ${pin.source} has ${String(pin.bundled)}`
    )
    .join("\n");
  console.error(
    [
      "These pins disagree with the package they restate:",
      lines,
      "",
      "For vite-plus, run `vp toolchain` to see what this release bundles, then `vp migrate` to re-pin. For the others, set the pin to the version named.",
    ].join("\n")
  );
  process.exit(1);
}

console.log(
  `toolchain pins agree with ${VITE_PLUS} and ${VOID} (${PINS.length} checked)`
);
