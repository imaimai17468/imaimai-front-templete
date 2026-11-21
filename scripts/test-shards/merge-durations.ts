/**
 * Each shard records durations only for the files it ran, in Vitest's
 * `results.json`. This combines the shards' copies into one, keeping for each
 * file the entry from the most recent run, so the next run plans every shard
 * from the whole suite.
 */

import { z } from "zod";

const FileResult = z.looseObject({ lastRun: z.number() });

const ResultsFileSchema = z.object({
  projects: z.record(
    z.string(),
    z.object({ files: z.record(z.string(), FileResult) })
  ),
  version: z.number(),
});

type ResultsFile = z.infer<typeof ResultsFileSchema>;

export type MergedDurations =
  | { readonly kind: "merged"; readonly results: ResultsFile }
  | { readonly kind: "empty"; readonly detail: string }
  | { readonly kind: "malformed"; readonly detail: string };

interface ParsedResults {
  readonly kind: "parsed";
  readonly results: ResultsFile;
}

interface MalformedResults {
  readonly kind: "malformed";
  readonly detail: string;
}

type ParsedText = ParsedResults | MalformedResults;

const parseResultsText = (text: string): ParsedText => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { detail: "A results.json is not JSON.", kind: "malformed" };
  }
  const parsed = ResultsFileSchema.safeParse(json);
  return parsed.success
    ? { kind: "parsed", results: parsed.data }
    : {
        detail: `A results.json did not have the expected shape: ${parsed.error.message}`,
        kind: "malformed",
      };
};

/** Each input is the text of one shard's `results.json`. */
export const mergeDurations = (texts: readonly string[]): MergedDurations => {
  const parsed = texts.map(parseResultsText);
  const failure = parsed.find(
    (result): result is MalformedResults => result.kind === "malformed"
  );
  if (failure !== undefined) {
    return failure;
  }
  const files = parsed
    .filter((result): result is ParsedResults => result.kind === "parsed")
    .map(({ results }) => results);
  const [first] = files;
  if (first === undefined) {
    return { detail: "No results.json was given to merge.", kind: "empty" };
  }
  // A stable sort by run time lets the later entry for a path overwrite the
  // earlier one when `Object.fromEntries` collects them below.
  const entries = files
    .flatMap(({ projects }) =>
      Object.entries(projects).flatMap(([project, { files: results }]) =>
        Object.entries(results).map(([path, result]) => ({
          path,
          project,
          result,
        }))
      )
    )
    .toSorted((a, b) => a.result.lastRun - b.result.lastRun);
  const projectNames = [...new Set(entries.map(({ project }) => project))];
  const projects = Object.fromEntries(
    projectNames.map((name) => [
      name,
      {
        files: Object.fromEntries(
          entries
            .filter(({ project }) => project === name)
            .map(({ path, result }) => [path, result])
        ),
      },
    ])
  );
  return { kind: "merged", results: { projects, version: first.version } };
};
