/**
 * Reads what `bun audit --json` printed and decides the CI audit step's
 * outcome. Bun exits 1 both when advisories exist and when the registry
 * request fails, so the exit code cannot tell them apart; what separates them
 * is stdout, which holds the registry's JSON report only when the registry
 * answered.
 */

import { z } from "zod";

const Advisory = z.object({
  severity: z.string(),
  title: z.string(),
  url: z.string(),
});

const AuditReportSchema = z.record(z.string(), z.array(Advisory));

type AuditReport = z.infer<typeof AuditReportSchema>;

export interface AuditRun {
  readonly exitCode: number | null;
  readonly spawnError: string | undefined;
  readonly stderr: string;
  readonly stdout: string;
}

export interface VulnerablePackage {
  readonly advisories: readonly z.infer<typeof Advisory>[];
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

type ParsedReport =
  | { readonly kind: "report"; readonly report: AuditReport }
  | { readonly kind: "not-json" }
  | { readonly kind: "unexpected-shape"; readonly issues: string };

const parseReport = (stdout: string): ParsedReport => {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    return { kind: "not-json" };
  }
  const parsed = AuditReportSchema.safeParse(json);
  return parsed.success
    ? { kind: "report", report: parsed.data }
    : { issues: z.prettifyError(parsed.error), kind: "unexpected-shape" };
};

const stderrLine = (run: AuditRun): string =>
  `stderr: ${run.stderr.trim() || "(empty)"}`;

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
  const parsed = parseReport(run.stdout);
  if (parsed.kind === "not-json") {
    return {
      detail: [
        `bun audit exited ${String(run.exitCode)} without printing a JSON report, so the registry gave no answer to judge.`,
        stderrLine(run),
      ].join("\n"),
      kind: "unanswered",
    };
  }
  if (parsed.kind === "unexpected-shape") {
    return {
      detail: [
        `bun audit exited ${String(run.exitCode)} and printed JSON this step cannot read as an advisory report:`,
        parsed.issues,
      ].join("\n"),
      kind: "unanswered",
    };
  }
  return classify(parsed.report, new Set(directNames));
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
