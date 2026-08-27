/**
 * Vite+ bundles exact versions of the tools it drives. This project restates
 * several of them so plugins and the test runner resolve one copy each, and a
 * dependency bump that moves one side without the other splits the graph the
 * restatement exists to keep single. This compares the two sides and fails on
 * the first disagreement.
 */
import vitePlus from "../node_modules/vite-plus/package.json" with { type: "json" };
import manifest from "../package.json" with { type: "json" };

const CORE = "@voidzero-dev/vite-plus-core";

interface Pin {
  readonly bundled: string | undefined;
  readonly declared: string | undefined;
  readonly label: string;
}

/** vite-plus writes its own pins as `=1.2.3`. */
const bundledVersionOf = (spec: string | undefined): string | undefined =>
  spec?.replace(/^=/u, "");

/**
 * A declaration keeps its range marker, so `^1.79.0` never equals the bundled
 * `1.79.0` and the comparison rejects it. A range lets a second copy of the
 * tool into the graph, which is the thing this check exists to prevent.
 */
const declaredVersionOf = (spec: string | undefined): string | undefined =>
  spec;

const declaredAliasOf = (spec: string | undefined): string | undefined =>
  spec?.replace(`npm:${CORE}@`, "");

const { dependencies: bundled, version: bundledVersion } = vitePlus;
const { devDependencies: declared, overrides } = manifest;

const PINS: readonly Pin[] = [
  {
    bundled: bundledVersionOf(bundled[CORE]),
    declared: declaredAliasOf(declared.vite),
    label: "devDependencies.vite (alias to vite-plus core)",
  },
  {
    bundled: bundledVersionOf(bundled[CORE]),
    declared: declaredAliasOf(overrides.vite),
    label: "overrides.vite (alias to vite-plus core)",
  },
  {
    bundled: bundledVersionOf(bundled.vitest),
    declared: declaredVersionOf(overrides.vitest),
    label: "overrides.vitest",
  },
  {
    bundled: bundledVersionOf(bundled.vitest),
    declared: declaredVersionOf(declared.vitest),
    label: "devDependencies.vitest",
  },
  {
    bundled: bundledVersionOf(bundled.vitest),
    declared: declaredVersionOf(declared["@vitest/coverage-v8"]),
    label: "devDependencies.@vitest/coverage-v8",
  },
  {
    bundled: bundledVersionOf(bundled.oxlint),
    declared: declaredVersionOf(declared.oxlint),
    label: "devDependencies.oxlint",
  },
  {
    bundled: bundledVersionOf(bundled.oxfmt),
    declared: declaredVersionOf(declared.oxfmt),
    label: "devDependencies.oxfmt",
  },
  {
    bundled: bundledVersionOf(bundled["oxlint-tsgolint"]),
    declared: declaredVersionOf(declared["oxlint-tsgolint"]),
    label: "devDependencies.oxlint-tsgolint",
  },
];

const mismatches = PINS.filter((pin) => pin.bundled !== pin.declared);

if (mismatches.length > 0) {
  const lines = mismatches
    .map(
      (pin) =>
        `  ${pin.label}: declared ${String(pin.declared)}, bundled ${String(pin.bundled)}`
    )
    .join("\n");
  console.error(
    [
      `vite-plus ${bundledVersion} bundles versions this manifest disagrees with:`,
      lines,
      "",
      "Run `vp toolchain` to see what this release bundles, then `vp migrate` to re-pin.",
    ].join("\n")
  );
  process.exit(1);
}

console.log(
  `toolchain pins agree with vite-plus ${bundledVersion} (${PINS.length} checked)`
);
