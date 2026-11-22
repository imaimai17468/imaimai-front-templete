// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  buildGateReport,
  decideMutationGate,
  listChangedModules,
  parseChangedFiles,
  readReportFile,
} from "./mutation-gate.ts";

const mutant = (status: string, line: number, replacement?: string) => ({
  location: { end: { column: 9, line }, start: { column: 3, line } },
  mutatorName: "ConditionalExpression",
  replacement,
  status,
});

const read = (files: Record<string, readonly unknown[]>) =>
  ({
    kind: "read",
    text: JSON.stringify({
      files: Object.fromEntries(
        Object.entries(files).map(([file, mutants]) => [file, { mutants }])
      ),
      schemaVersion: "1.0",
    }),
  }) as const;

describe(readReportFile, () => {
  it("should return the file's text when the file can be read", () => {
    expect(readReportFile(new URL(import.meta.url))).toStrictEqual({
      kind: "read",
      text: readFileSync(new URL(import.meta.url), "utf-8"),
    });
  });

  it("should return the read error when the file does not exist", () => {
    const report = readReportFile(
      new URL("no-such-report.json", import.meta.url)
    );
    expect(
      report.kind === "unreadable" && report.detail.includes("ENOENT")
    ).toBeTruthy();
  });
});

describe(parseChangedFiles, () => {
  it("should list each path verbatim when git diff -z separates them with NUL", () => {
    expect(parseChangedFiles("src/a b.ts\0src/日.ts\0\0")).toStrictEqual([
      "src/a b.ts",
      "src/日.ts",
    ]);
  });
});

describe(listChangedModules, () => {
  it("should name only the changed files the mutation run mutated when the report lists other files too", () => {
    expect(
      listChangedModules(
        read({
          "src/a.ts": [],
          "src/b.ts": [mutant("Killed", 1)],
          "src/c.ts": [mutant("Survived", 1)],
        }),
        ["src/b.ts", "README.md", "src/a.ts"]
      )
    ).toStrictEqual(["src/a.ts", "src/b.ts"]);
  });

  it("should name no file when the report cannot be read", () => {
    expect(
      listChangedModules({ detail: "ENOENT", kind: "unreadable" }, ["src/a.ts"])
    ).toStrictEqual([]);
  });
});

describe(decideMutationGate, () => {
  it("should name each survived and uncovered mutant in line order when it sits in a changed file", () => {
    expect(
      decideMutationGate(
        read({
          "src/a.ts": [
            mutant("NoCoverage", 7),
            mutant("Killed", 9, "false"),
            mutant("Survived", 12, "false"),
            mutant("Survived", 3, "true"),
          ],
        }),
        ["src/a.ts"]
      )
    ).toStrictEqual({
      kind: "unnoticed",
      mutants: [
        {
          file: "src/a.ts",
          line: 3,
          mutatorName: "ConditionalExpression",
          replacement: "true",
        },
        {
          file: "src/a.ts",
          line: 7,
          mutatorName: "ConditionalExpression",
          replacement: undefined,
        },
        {
          file: "src/a.ts",
          line: 12,
          mutatorName: "ConditionalExpression",
          replacement: "false",
        },
      ],
    });
  });

  it("should report clean when the only unnoticed mutants sit in files the pull request did not change", () => {
    expect(
      decideMutationGate(read({ "src/other.ts": [mutant("Survived", 1)] }), [
        "src/a.ts",
      ])
    ).toStrictEqual({ kind: "clean" });
  });

  it.each(["Ignored", "Killed", "Timeout", "RuntimeError", "CompileError"])(
    "should report clean when a changed file's mutants are all %s",
    (status) => {
      expect(
        decideMutationGate(read({ "src/a.ts": [mutant(status, 1)] }), [
          "src/a.ts",
        ])
      ).toStrictEqual({ kind: "clean" });
    }
  );

  it("should report no-report with the read error when the report could not be read", () => {
    expect(
      decideMutationGate({ detail: "ENOENT", kind: "unreadable" }, [])
    ).toStrictEqual({ detail: "ENOENT", kind: "no-report" });
  });

  it.each([
    { text: "not json", what: "is not JSON" },
    { text: '{"files":{"src/a.ts":{}}}', what: "has no mutants list" },
    {
      text: '{"files":{"src/a.ts":{"mutants":[{"location":{"start":{}},"mutatorName":"BlockStatement","status":"Survived"}]}}}',
      what: "has a mutant without a start line",
    },
  ])(
    "should report no-report with the decode error when the report $what",
    ({ text }) => {
      const verdict = decideMutationGate({ kind: "read", text }, ["src/a.ts"]);
      expect(
        verdict.kind === "no-report" && verdict.detail.length > 0
      ).toBeTruthy();
    }
  );
});

describe(buildGateReport, () => {
  it("should exit 0 when no unnoticed mutant sits in a changed file", () => {
    expect(buildGateReport({ kind: "clean" })).toStrictEqual({
      exitCode: 0,
      lines: ["No mutant survives in a file this pull request changes."],
    });
  });

  it("should exit 1 and say the run produced no report when there is none", () => {
    expect(
      buildGateReport({ detail: "ENOENT", kind: "no-report" })
    ).toStrictEqual({
      exitCode: 1,
      lines: ["The mutation run produced no report to check: ENOENT"],
    });
  });

  it("should exit 1 with one line per mutant followed by the three answers when mutants go unnoticed", () => {
    expect(
      buildGateReport({
        kind: "unnoticed",
        mutants: [
          {
            file: "src/a.ts",
            line: 3,
            mutatorName: "BlockStatement",
            replacement: "{\n    return  x;\n}",
          },
          {
            file: "src/a.ts",
            line: 7,
            mutatorName: "ConditionalExpression",
            replacement: undefined,
          },
        ],
      })
    ).toStrictEqual({
      exitCode: 1,
      lines: [
        "src/a.ts:3 BlockStatement → { return x; }",
        "src/a.ts:7 ConditionalExpression",
        "",
        "Each of these is code whose behaviour no test states. Answer each one in this pull request:",
        "  1. A caller relies on the behaviour: write the test that states it.",
        "  2. Nothing relies on it: delete or simplify the code until the mutant has nothing to change.",
        "  3. The code holds a value rather than behaviour (page copy, a trace name, a key): move it into a file stryker.config.mjs excludes, or add an exclusion for that kind of value there.",
        "The Self-check step of .claude/skills/ticket-work/SKILL.md describes the three answers.",
      ],
    });
  });
});
