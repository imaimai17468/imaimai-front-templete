/**
 * Reads what `bun audit --json` printed and decides the CI audit step's
 * outcome. Bun exits 1 both when advisories exist and when the registry
 * request fails, so the exit code cannot tell them apart; what separates them
 * is stdout, which holds the registry's JSON report only when the registry
 * answered.
 */

import { Result, Schema } from "effect";

const Advisory = Schema.Struct({
  severity: Schema.String,
  title: Schema.String,
  url: Schema.String,
});

const AuditReportSchema = Schema.Record(Schema.String, Schema.Array(Advisory));

type AuditReport = typeof AuditReportSchema.Type;

const decodeJson = Schema.decodeUnknownResult(
  Schema.fromJsonString(Schema.Unknown)
);

const decodeAuditReport = Schema.decodeUnknownResult(AuditReportSchema, {
  errors: "all",
});

export interface AuditRun {
  readonly exitCode: number | null;
  readonly spawnError: string | undefined;
  readonly stderr: string;
  readonly stdout: string;
}

export interface VulnerablePackage {
  readonly advisories: readonly (typeof Advisory.Type)[];
  readonly name: string;
}

export type AuditOutcome =
  | { readonly kind: "unanswered"; readonly detail: string }
  | { readonly kind: "clean" }
  | {
      readonly kind: "direct";
      readonly direct: readonly VulnerablePackage[];
      readonly transitive: readonly string[];
    }
  | {
      readonly kind: "transitive-only";
      readonly transitive: readonly string[];
    };

const stderrLine = (run: AuditRun): string =>
  `stderr: ${run.stderr.trim() || "(empty)"}`;

/** The advisory report the run printed, or why it printed none to judge. */
const readReport = (run: AuditRun): Result.Result<AuditReport, string> => {
  const json = decodeJson(run.stdout);
  if (Result.isFailure(json)) {
    return Result.fail(
      [
        `bun audit exited ${String(run.exitCode)} without printing a JSON report, so the registry gave no answer to judge.`,
        stderrLine(run),
      ].join("\n")
    );
  }
  return Result.mapError(decodeAuditReport(json.success), (issue) =>
    [
      `bun audit exited ${String(run.exitCode)} and printed JSON this step cannot read as an advisory report:`,
      issue.message,
    ].join("\n")
  );
};

const classify = (
  report: AuditReport,
  directNames: ReadonlySet<string>
): AuditOutcome => {
  const packages = Object.entries(report)
    .map(([name, advisories]) => ({ advisories, name }))
    .toSorted((left, right) => left.name.localeCompare(right.name));
  if (packages.length === 0) {
    return { kind: "clean" };
  }
  const transitive = packages
    .filter((pkg) => !directNames.has(pkg.name))
    .map((pkg) => pkg.name);
  const direct = packages.filter((pkg) => directNames.has(pkg.name));
  if (direct.length === 0) {
    return { kind: "transitive-only", transitive };
  }
  return { direct, kind: "direct", transitive };
};

export const auditOutcome = (
  run: AuditRun,
  directNames: readonly string[]
): AuditOutcome => {
  if (run.spawnError !== undefined) {
    return {
      detail: `bun audit could not be started: ${run.spawnError}`,
      kind: "unanswered",
    };
  }
  const report = readReport(run);
  return Result.isFailure(report)
    ? { detail: report.failure, kind: "unanswered" }
    : classify(report.success, new Set(directNames));
};

export interface AuditReportLines {
  readonly exitCode: 0 | 1;
  readonly lines: readonly string[];
}

const advisoryLines = (pkg: VulnerablePackage): readonly string[] => [
  `  ${pkg.name}`,
  ...pkg.advisories.map(
    (advisory) => `    [${advisory.severity}] ${advisory.title} ${advisory.url}`
  ),
];

const transitiveLines = (names: readonly string[]): readonly string[] =>
  names.length === 0
    ? []
    : [
        "ℹ️  Transitive-only vulnerabilities (not blocking):",
        ...names.map((name) => `  - ${name}`),
      ];

export const auditReportLines = (outcome: AuditOutcome): AuditReportLines => {
  if (outcome.kind === "unanswered") {
    return {
      exitCode: 1,
      lines: [
        "⛔ The dependency audit produced no report to judge.",
        outcome.detail,
      ],
    };
  }
  if (outcome.kind === "clean") {
    return { exitCode: 0, lines: ["✅ No vulnerabilities found."] };
  }
  if (outcome.kind === "direct") {
    return {
      exitCode: 1,
      lines: [
        "⛔ Vulnerabilities in direct dependencies:",
        ...outcome.direct.flatMap(advisoryLines),
        ...transitiveLines(outcome.transitive),
      ],
    };
  }
  return {
    exitCode: 0,
    lines: [
      ...transitiveLines(outcome.transitive),
      "✅ No direct-dependency vulnerabilities.",
    ],
  };
};

export const directDependencyNames = (manifest: {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}): readonly string[] =>
  Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
