/**
 * Reads the JSON report StrykerJS writes and decides whether a mutant no test
 * notices sits in a file the pull request changes. `Survived` and
 * `NoCoverage` are the two statuses no test noticed; every other status is
 * either a kill or a mutant the run could not judge.
 */

import { readFileSync } from "node:fs";
import { Result, Schema } from "effect";

const Mutant = Schema.Struct({
  location: Schema.Struct({ start: Schema.Struct({ line: Schema.Int }) }),
  mutatorName: Schema.String,
  replacement: Schema.optional(Schema.String),
  status: Schema.String,
});

const MutationReport = Schema.Struct({
  files: Schema.Record(
    Schema.String,
    Schema.Struct({ mutants: Schema.Array(Mutant) })
  ),
});

const decodeMutationReport = Schema.decodeUnknownResult(
  Schema.fromJsonString(MutationReport)
);

const UNNOTICED_STATUSES: ReadonlySet<string> = new Set([
  "NoCoverage",
  "Survived",
]);

export type ReportRead =
  | { readonly kind: "read"; readonly text: string }
  | { readonly kind: "unreadable"; readonly detail: string };

export interface UnnoticedMutant {
  readonly file: string;
  readonly line: number;
  readonly mutatorName: string;
  readonly replacement: string | undefined;
}

type MutatedFiles = typeof MutationReport.Type.files;

export type GateVerdict =
  | { readonly kind: "clean" }
  | { readonly kind: "no-report"; readonly detail: string }
  | {
      readonly kind: "unnoticed";
      readonly mutants: readonly UnnoticedMutant[];
    };

export const readReportFile = (path: URL): ReportRead => {
  try {
    return { kind: "read", text: readFileSync(path, "utf-8") };
  } catch (error) {
    return { detail: String(error), kind: "unreadable" };
  }
};

export const parseChangedFiles = (
  nulSeparatedPaths: string
): readonly string[] =>
  nulSeparatedPaths.split("\0").filter((path) => path !== "");

const readMutatedFiles = (
  report: ReportRead
): Result.Result<MutatedFiles, string> => {
  if (report.kind === "unreadable") {
    return Result.fail(report.detail);
  }
  return decodeMutationReport(report.text).pipe(
    Result.map(({ files }) => files),
    Result.mapError(({ message }) => message)
  );
};

export const listChangedModules = (
  report: ReportRead,
  changedFiles: readonly string[]
): readonly string[] => {
  const mutated = readMutatedFiles(report);
  if (Result.isFailure(mutated)) {
    return [];
  }
  const changed = new Set(changedFiles);
  return Object.keys(mutated.success).filter((file) => changed.has(file));
};

export const decideMutationGate = (
  report: ReportRead,
  changedFiles: readonly string[]
): GateVerdict => {
  const mutated = readMutatedFiles(report);
  if (Result.isFailure(mutated)) {
    return { detail: mutated.failure, kind: "no-report" };
  }
  const changed = new Set(changedFiles);
  const mutants = Object.entries(mutated.success)
    .filter(([file]) => changed.has(file))
    .flatMap(([file, { mutants: fileMutants }]) =>
      fileMutants
        .filter((mutant) => UNNOTICED_STATUSES.has(mutant.status))
        .toSorted(
          (first, second) =>
            first.location.start.line - second.location.start.line
        )
        .map((mutant) => ({
          file,
          line: mutant.location.start.line,
          mutatorName: mutant.mutatorName,
          replacement: mutant.replacement,
        }))
    );
  return mutants.length === 0
    ? { kind: "clean" }
    : { kind: "unnoticed", mutants };
};

export interface GateReport {
  readonly exitCode: number;
  readonly lines: readonly string[];
}

const ANSWERS = [
  "Each of these is code whose behaviour no test states. Answer each one in this pull request:",
  "  1. A caller relies on the behaviour: write the test that states it.",
  "  2. Nothing relies on it: delete or simplify the code until the mutant has nothing to change.",
  "  3. The code holds a value rather than behaviour (page copy): move it into a file stryker.config.mjs excludes, or add an exclusion for that kind of value there.",
  "The Self-check step of .claude/skills/ticket-work/SKILL.md describes the three answers.",
];

const formatMutantLine = (mutant: UnnoticedMutant): string => {
  const location = `${mutant.file}:${String(mutant.line)} ${mutant.mutatorName}`;
  return mutant.replacement === undefined
    ? location
    : `${location} → ${mutant.replacement.replaceAll(/\s+/gu, " ")}`;
};

export const buildGateReport = (verdict: GateVerdict): GateReport => {
  if (verdict.kind === "clean") {
    return {
      exitCode: 0,
      lines: ["No mutant survives in a file this pull request changes."],
    };
  }
  if (verdict.kind === "no-report") {
    return {
      exitCode: 1,
      lines: [
        `The mutation run produced no report to check: ${verdict.detail}`,
      ],
    };
  }
  return {
    exitCode: 1,
    lines: [...verdict.mutants.map(formatMutantLine), "", ...ANSWERS],
  };
};
