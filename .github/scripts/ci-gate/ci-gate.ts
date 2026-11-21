/**
 * Decides whether the job that gates a merge waits on every other job of a
 * workflow. A job left out of the gate's `needs` still runs, but its failure
 * no longer fails the gate.
 */

import { Result, Schema } from "effect";

const Job = Schema.Struct({
  needs: Schema.optional(
    Schema.Union([Schema.String, Schema.Array(Schema.String)])
  ),
});

const decodeWorkflow = Schema.decodeUnknownResult(
  Schema.Struct({ jobs: Schema.Record(Schema.String, Job) }),
  { errors: "all" }
);

export type GateCoverage =
  | { readonly kind: "covered" }
  | { readonly kind: "malformed"; readonly detail: string }
  | { readonly kind: "gate-missing" }
  | { readonly kind: "jobs-missing"; readonly jobs: readonly string[] };

export const gateCoverage = (
  workflow: unknown,
  gateJob: string
): GateCoverage => {
  const decoded = decodeWorkflow(workflow);
  if (Result.isFailure(decoded)) {
    return { detail: decoded.failure.message, kind: "malformed" };
  }
  const { jobs } = decoded.success;
  const gate = jobs[gateJob];
  if (gate === undefined) {
    return { kind: "gate-missing" };
  }
  const awaited = new Set([gate.needs ?? []].flat());
  const missing = Object.keys(jobs).filter(
    (job) => job !== gateJob && !awaited.has(job)
  );
  return missing.length === 0
    ? { kind: "covered" }
    : { jobs: missing, kind: "jobs-missing" };
};

export interface GateReport {
  readonly exitCode: number;
  readonly message: string;
}

const failure = (message: string): GateReport => ({ exitCode: 1, message });

export const gateCoverageReport = (
  coverage: GateCoverage,
  gateJob: string
): GateReport => {
  if (coverage.kind === "covered") {
    return { exitCode: 0, message: `${gateJob} waits on every job.` };
  }
  if (coverage.kind === "malformed") {
    return failure(`The workflow has no readable jobs map: ${coverage.detail}`);
  }
  if (coverage.kind === "gate-missing") {
    return failure(`The workflow has no job named ${gateJob}.`);
  }
  return failure(
    `${gateJob} does not wait on: ${coverage.jobs.join(", ")}. Add them to its needs.`
  );
};
