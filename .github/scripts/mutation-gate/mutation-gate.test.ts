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

const mutant = (
  file: string,
  status: string,
  line: number,
  replacement?: string
) => {
  const base = {
    column: 3,
    file,
    id: `${file}:${String(line)}`,
    line,
    mutator: "condition",
    status,
  };
  if (replacement === undefined) {
    return base;
  }
  return { ...base, focus: { column: 3, line, original: "x", replacement } };
};

const read = (mutants: readonly unknown[]) =>
  ({
    kind: "read",
    text: JSON.stringify({ command: "run", mutants, schemaVersion: 3 }),
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
  it("should name only the changed files mutation testing mutates when the pull request changes others too", () => {
    expect(
      listChangedModules([
        "src/lib/utils.ts",
        "README.md",
        "src/lib/utils.test.ts",
      ])
    ).toStrictEqual(["src/lib/utils.ts"]);
  });
});

describe(decideMutationGate, () => {
  it("should name each survived and uncovered mutant in file and line order when it sits in a changed file", () => {
    expect(
      decideMutationGate(
        read([
          mutant("src/b.ts", "Survived", 2, "true"),
          mutant("src/a.ts", "NoCoverage", 7),
          mutant("src/a.ts", "Killed", 9, "false"),
          mutant("src/a.ts", "Survived", 12, "false"),
          mutant("src/a.ts", "Survived", 3, "true"),
        ]),
        ["src/a.ts", "src/b.ts"]
      )
    ).toStrictEqual({
      kind: "unnoticed",
      mutants: [
        {
          file: "src/a.ts",
          line: 3,
          mutatorName: "condition",
          replacement: "true",
        },
        {
          file: "src/a.ts",
          line: 7,
          mutatorName: "condition",
          replacement: undefined,
        },
        {
          file: "src/a.ts",
          line: 12,
          mutatorName: "condition",
          replacement: "false",
        },
        {
          file: "src/b.ts",
          line: 2,
          mutatorName: "condition",
          replacement: "true",
        },
      ],
    });
  });

  it("should report clean when the only unnoticed mutants sit in files the pull request did not change", () => {
    expect(
      decideMutationGate(read([mutant("src/other.ts", "Survived", 1)]), [
        "src/a.ts",
      ])
    ).toStrictEqual({ kind: "clean" });
  });

  it.each(["Ignored", "Killed", "Timeout", "Error"])(
    "should report clean when a changed file's mutants are all %s",
    (status) => {
      expect(
        decideMutationGate(read([mutant("src/a.ts", status, 1)]), ["src/a.ts"])
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
    { text: '{"command":"run"}', what: "has no mutants list" },
    {
      text: '{"mutants":[{"file":"src/a.ts","mutator":"condition","status":"Survived"}]}',
      what: "has a mutant without a line",
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
        "  3. The code holds a value rather than behaviour (page copy): move it into a file scripts/mutate/mutation-targets.ts leaves unmutated, or add a pattern for that kind of value there.",
        "The Self-check step of .claude/skills/ticket-work/SKILL.md describes the three answers.",
      ],
    });
  });
});
