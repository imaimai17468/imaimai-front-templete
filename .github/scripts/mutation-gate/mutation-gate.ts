/**
 * Reads the JSON report Mootant prints and decides whether a mutant no test
 * notices sits in a file the pull request changes. `Survived` and
 * `NoCoverage` are the two statuses no test noticed; every other status is
 * either a kill or a mutant the run could not judge.
 */

import { readFileSync } from "node:fs";
import { Result, Schema } from "effect";
import { mutationTargets } from "../../../scripts/mutate/mutation-targets.ts";

const Mutant = Schema.Struct({
  file: Schema.String,
  focus: Schema.optional(Schema.Struct({ replacement: Schema.String })),
  line: Schema.Int,
  mutator: Schema.String,
  status: Schema.String,
});

const MutationReport = Schema.Struct({ mutants: Schema.Array(Mutant) });

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

const readMutants = (
  report: ReportRead
): Result.Result<typeof MutationReport.Type.mutants, string> => {
  if (report.kind === "unreadable") {
    return Result.fail(report.detail);
  }
  return decodeMutationReport(report.text).pipe(
    Result.map(({ mutants }) => mutants),
    Result.mapError(({ message }) => message)
  );
};

/** The files a pull request changed that mutation testing mutates. */
export const listChangedModules = (
  changedFiles: readonly string[]
): readonly string[] => mutationTargets(changedFiles);

export const decideMutationGate = (
  report: ReportRead,
  changedFiles: readonly string[]
): GateVerdict => {
  const mutants = readMutants(report);
  if (Result.isFailure(mutants)) {
    return { detail: mutants.failure, kind: "no-report" };
  }
  const changed = new Set(changedFiles);
  const unnoticed = mutants.success
    .filter(
      (mutant) =>
        changed.has(mutant.file) && UNNOTICED_STATUSES.has(mutant.status)
    )
    .toSorted(
      (first, second) =>
        first.file.localeCompare(second.file) || first.line - second.line
    )
    .map((mutant) => ({
      file: mutant.file,
      line: mutant.line,
      mutatorName: mutant.mutator,
      replacement: mutant.focus?.replacement,
    }));
  return unnoticed.length === 0
    ? { kind: "clean" }
    : { kind: "unnoticed", mutants: unnoticed };
};

export interface GateReport {
  readonly exitCode: number;
  readonly lines: readonly string[];
}

const ANSWERS = [
  "Each of these is code whose behaviour no test states. Answer each one in this pull request:",
  "  1. A caller relies on the behaviour: write the test that states it.",
  "  2. Nothing relies on it: delete or simplify the code until the mutant has nothing to change.",
  "  3. The code holds a value rather than behaviour (page copy): move it into a file scripts/mutate/mutation-targets.ts leaves unmutated, or add a pattern for that kind of value there.",
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
