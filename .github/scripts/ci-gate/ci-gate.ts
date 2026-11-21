/**
 * Decides whether the job that gates a merge waits on every other job of a
 * workflow. A job left out of the gate's `needs` still runs, but its failure
 * no longer fails the gate.
 */

import { z } from "zod";

const Job = z.object({
  needs: z.union([z.string(), z.array(z.string())]).optional(),
});

const Workflow = z.object({
  jobs: z.record(z.string(), Job),
});

export type GateCoverage =
  | { readonly kind: "covered" }
  | { readonly kind: "malformed"; readonly detail: string }
  | { readonly kind: "gate-missing" }
  | { readonly kind: "jobs-missing"; readonly jobs: readonly string[] };

export const gateCoverage = (
  workflow: unknown,
  gateJob: string
): GateCoverage => {
  const parsed = Workflow.safeParse(workflow);
  if (!parsed.success) {
    return { detail: parsed.error.message, kind: "malformed" };
  }
  const { jobs } = parsed.data;
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
