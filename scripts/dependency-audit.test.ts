// @vitest-environment node

import { describe, expect, it } from "vite-plus/test";
import {
  auditOutcome,
  auditReportLines,
  directDependencyNames,
} from "./dependency-audit";

const ADVISORY = {
  severity: "high",
  title: "brace-expansion: DoS via uncontrolled recursion",
  url: "https://github.com/advisories/GHSA-qhr7-859c-m2p7",
};

const answered = (report: unknown, exitCode = 1) => ({
  exitCode,
  spawnError: undefined,
  stderr: "bun audit v1.3.1",
  stdout: `${JSON.stringify(report)}\n`,
});

describe(auditOutcome, () => {
  it.each([
    {
      detail: [
        "bun audit exited 1 without printing a JSON report, so the registry gave no answer to judge.",
        "stderr: ConnectionRefused: audit request failed",
      ].join("\n"),
      name: "stdout is empty",
      run: {
        exitCode: 1,
        spawnError: undefined,
        stderr: "ConnectionRefused: audit request failed\n",
        stdout: "",
      },
    },
    {
      detail: [
        "bun audit exited 1 without printing a JSON report, so the registry gave no answer to judge.",
        "stderr: (empty)",
      ].join("\n"),
      name: "stdout is not JSON",
      run: {
        exitCode: 1,
        spawnError: undefined,
        stderr: "",
        stdout: "<html>405</html>",
      },
    },
    {
      detail: [
        "bun audit exited 0 and printed JSON this step cannot read as an advisory report:",
        "✖ Invalid input: expected record, received array",
      ].join("\n"),
      name: "stdout is a JSON array",
      run: { exitCode: 0, spawnError: undefined, stderr: "", stdout: "[]" },
    },
    {
      detail: [
        "bun audit exited 1 and printed JSON this step cannot read as an advisory report:",
        "✖ Invalid input: expected string, received undefined\n  → at x[0].title",
      ].join("\n"),
      name: "an advisory is missing its title",
      run: {
        exitCode: 1,
        spawnError: undefined,
        stderr: "",
        stdout: JSON.stringify({ x: [{ severity: "low", url: "u" }] }),
      },
    },
    {
      detail: "bun audit could not be started: Executable not found",
      name: "the process could not be spawned",
      run: {
        exitCode: null,
        spawnError: "Executable not found",
        stderr: "",
        stdout: "",
      },
    },
  ])("should read as unanswered when $name", ({ detail, run }) => {
    const outcome = auditOutcome(run, ["x"]);

    expect(outcome).toStrictEqual({ detail, kind: "unanswered" });
  });

  it("should read as clean when the report is empty", () => {
    const outcome = auditOutcome(answered({}, 0), ["react"]);

    expect(outcome).toStrictEqual({ kind: "clean" });
  });

  it("should read as transitive-only with sorted names when no reported package is in the manifest", () => {
    const outcome = auditOutcome(
      answered(
        Object.fromEntries([
          ["undici", [ADVISORY]],
          ["esbuild", [ADVISORY]],
        ])
      ),
      ["react"]
    );

    expect(outcome).toStrictEqual({
      kind: "transitive-only",
      transitive: ["esbuild", "undici"],
    });
  });

  it("should read as direct with its advisories when a reported package is in the manifest", () => {
    const outcome = auditOutcome(
      answered({ react: [ADVISORY], undici: [ADVISORY] }),
      ["react"]
    );

    expect(outcome).toStrictEqual({
      direct: [{ advisories: [ADVISORY], name: "react" }],
      kind: "direct",
      transitive: ["undici"],
    });
  });
});

describe(auditReportLines, () => {
  it.each([
    {
      expected: {
        exitCode: 1,
        lines: ["⛔ The dependency audit produced no report to judge.", "why"],
      },
      name: "should fail with the detail when the audit is unanswered",
      outcome: { detail: "why", kind: "unanswered" as const },
    },
    {
      expected: { exitCode: 0, lines: ["✅ No vulnerabilities found."] },
      name: "should pass when the audit is clean",
      outcome: { kind: "clean" as const },
    },
    {
      expected: {
        exitCode: 1,
        lines: [
          "⛔ Vulnerabilities in direct dependencies:",
          "  react",
          `    [high] ${ADVISORY.title} ${ADVISORY.url}`,
        ],
      },
      name: "should fail listing its advisories when only direct findings exist",
      outcome: {
        direct: [{ advisories: [ADVISORY], name: "react" }],
        kind: "direct" as const,
        transitive: [],
      },
    },
    {
      expected: {
        exitCode: 1,
        lines: [
          "⛔ Vulnerabilities in direct dependencies:",
          "  react",
          `    [high] ${ADVISORY.title} ${ADVISORY.url}`,
          "ℹ️  Transitive-only vulnerabilities (not blocking):",
          "  - undici",
        ],
      },
      name: "should fail listing both when direct findings sit beside transitive ones",
      outcome: {
        direct: [{ advisories: [ADVISORY], name: "react" }],
        kind: "direct" as const,
        transitive: ["undici"],
      },
    },
    {
      expected: {
        exitCode: 0,
        lines: [
          "ℹ️  Transitive-only vulnerabilities (not blocking):",
          "  - undici",
          "✅ No direct-dependency vulnerabilities.",
        ],
      },
      name: "should pass while listing them when findings are transitive-only",
      outcome: { kind: "transitive-only" as const, transitive: ["undici"] },
    },
  ])("$name", ({ expected, outcome }) => {
    const report = auditReportLines(outcome);

    expect(report).toStrictEqual(expected);
  });
});

describe(directDependencyNames, () => {
  it.each([
    {
      expected: ["react", "vitest"],
      manifest: {
        dependencies: { react: "19.0.0" },
        devDependencies: { vitest: "4.0.0" },
      },
      name: "should name both sections when the manifest holds both",
    },
    {
      expected: [],
      manifest: {},
      name: "should name none when the manifest holds neither section",
    },
  ])("$name", ({ expected, manifest }) => {
    const names = directDependencyNames(manifest);

    expect(names).toStrictEqual(expected);
  });
});
