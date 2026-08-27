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

const withoutRange = (spec: string | undefined): string | undefined =>
  spec?.replace(/^[=^~]/u, "");

const withoutAlias = (spec: string | undefined): string | undefined =>
  spec?.replace(`npm:${CORE}@`, "");

const { dependencies: bundled, version: bundledVersion } = vitePlus;
const { devDependencies: declared, overrides } = manifest;

const PINS: readonly Pin[] = [
  {
    bundled: withoutRange(bundled[CORE]),
    declared: withoutAlias(declared.vite),
    label: "devDependencies.vite (alias to vite-plus core)",
  },
  {
    bundled: withoutRange(bundled[CORE]),
    declared: withoutAlias(overrides.vite),
    label: "overrides.vite (alias to vite-plus core)",
  },
  {
    bundled: withoutRange(bundled.vitest),
    declared: withoutRange(overrides.vitest),
    label: "overrides.vitest",
  },
  {
    bundled: withoutRange(bundled.vitest),
    declared: withoutRange(declared.vitest),
    label: "devDependencies.vitest",
  },
  {
    bundled: withoutRange(bundled.vitest),
    declared: withoutRange(declared["@vitest/coverage-v8"]),
    label: "devDependencies.@vitest/coverage-v8",
  },
  {
    bundled: withoutRange(bundled.oxlint),
    declared: withoutRange(declared.oxlint),
    label: "devDependencies.oxlint",
  },
  {
    bundled: withoutRange(bundled.oxfmt),
    declared: withoutRange(declared.oxfmt),
    label: "devDependencies.oxfmt",
  },
  {
    bundled: withoutRange(bundled["oxlint-tsgolint"]),
    declared: withoutRange(declared["oxlint-tsgolint"]),
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
