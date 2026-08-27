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

/**
 * `=1.2.3` and `1.2.3` are the same exact pin, and vite-plus writes the first
 * form. `^` and `~` survive, so a range never equals the bundled version and
 * the comparison rejects it: a range lets a second copy of the tool into the
 * graph, which is the thing this check exists to prevent.
 */
const exactVersionOf = (spec: string | undefined): string | undefined =>
  spec?.replace(/^=/u, "");

const declaredAliasOf = (spec: string | undefined): string | undefined =>
  spec?.replace(`npm:${CORE}@`, "");

const { dependencies: bundled, version: bundledVersion } = vitePlus;
const { devDependencies: declared, overrides } = manifest;

const PINS: readonly Pin[] = [
  {
    bundled: exactVersionOf(bundled[CORE]),
    declared: declaredAliasOf(declared.vite),
    label: "devDependencies.vite (alias to vite-plus core)",
  },
  {
    bundled: exactVersionOf(bundled[CORE]),
    declared: declaredAliasOf(overrides.vite),
    label: "overrides.vite (alias to vite-plus core)",
  },
  {
    bundled: exactVersionOf(bundled.vitest),
    declared: exactVersionOf(overrides.vitest),
    label: "overrides.vitest",
  },
  {
    bundled: exactVersionOf(bundled.vitest),
    declared: exactVersionOf(declared.vitest),
    label: "devDependencies.vitest",
  },
  {
    bundled: exactVersionOf(bundled.vitest),
    declared: exactVersionOf(declared["@vitest/coverage-v8"]),
    label: "devDependencies.@vitest/coverage-v8",
  },
  {
    bundled: exactVersionOf(bundled.oxlint),
    declared: exactVersionOf(declared.oxlint),
    label: "devDependencies.oxlint",
  },
  {
    bundled: exactVersionOf(bundled.oxfmt),
    declared: exactVersionOf(declared.oxfmt),
    label: "devDependencies.oxfmt",
  },
  {
    bundled: exactVersionOf(bundled["oxlint-tsgolint"]),
    declared: exactVersionOf(declared["oxlint-tsgolint"]),
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
